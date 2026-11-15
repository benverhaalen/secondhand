"""Add and backfill writer provenance on existing core tables."""
from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

TABLES = (
    'observation', 'evidence', 'citation', 'guarded_number', 'claim_check',
    'decision', 'event', 'job', 'storefront_snapshot', 'log_event',
)
COMMENT = 'Writer provenance: synthetic, example, captured, dataset:<name> or live:<site>; immutable (spec/product.md section 3).'
BASIS_COMMENT = 'Fallback level that answered: variant, product, family, kind, prior, or an engine named level (spec/product.md section 3).'


def plan(existing_columns_by_table: dict[str, str], tables, *, basis_level_exists=False) -> list[str]:
    """Plan from information_schema is_nullable values (YES/NO); absent means missing."""
    statements = []
    for table in tables:
        if existing_columns_by_table.get(table) == 'NO':
            continue
        name = f'secondhand.core.{table}'
        if table not in existing_columns_by_table:
            statements.append(f"ALTER TABLE {name} ADD COLUMNS (data STRING COMMENT '{COMMENT}')")
        statements.append(f"UPDATE {name} SET data = 'example' WHERE data IS NULL")
        statements.append(f'ALTER TABLE {name} ALTER COLUMN data SET NOT NULL')
    if 'guarded_number' in tables:
        if not basis_level_exists:
            statements.append(f"ALTER TABLE secondhand.core.guarded_number ADD COLUMNS (basis_level STRING COMMENT '{BASIS_COMMENT}')")
        statements.append("UPDATE secondhand.core.guarded_number SET basis_level = CASE WHEN basis_count > 0 THEN 'product' ELSE 'prior' END WHERE basis_level IS NULL AND metric LIKE 'valuation.%'")
    return statements


def guard_setup_plan(sql: str, *, reason_closed_exists: bool) -> list[str]:
    statements = [clean for part in re.split(r';\s*$', sql, flags=re.M)
                  if (clean := '\n'.join(line for line in part.splitlines()
                                         if not line.strip().startswith('--')).strip())]
    return [statement for statement in statements if not (
        reason_closed_exists and statement.startswith('ALTER TABLE secondhand.governance.break_glass ADD COLUMNS'))]


def run_plan(statements, execute) -> None:
    if not statements:
        return
    from break_glass import break_glass

    with break_glass(execute, 'data column backfill (spec/product.md §3)'):
        for statement in statements:
            if not statement.startswith('UPDATE secondhand.core.observation '):
                execute(statement, {})
                continue
            table = 'secondhand.core.observation'
            properties = execute(f'SHOW TBLPROPERTIES {table}', {})
            prior = next((row['value'] for row in properties if row['key'] == 'delta.appendOnly'), None)
            value = prior.replace("'", "''") if prior is not None else None
            restore = (f"ALTER TABLE {table} SET TBLPROPERTIES ('delta.appendOnly' = '{value}')"
                       if prior is not None else f"ALTER TABLE {table} UNSET TBLPROPERTIES ('delta.appendOnly')")
            try:
                execute(f"ALTER TABLE {table} SET TBLPROPERTIES ('delta.appendOnly' = 'false')", {})
                execute(statement, {})
            finally:
                execute(restore, {})


def main() -> None:
    # Serverless executes the entrypoint without __file__; --root locates the logger.
    root = Path(__file__).resolve().parents[2] if '__file__' in globals() else None
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=root, required=root is None)
    args = parser.parse_args()
    sys.path[:0] = [str(args.root.resolve() / 'log'), str(args.root.resolve() / 'databricks')]
    from secondhand_log import create_log, stdout_sink
    from pyspark.sql import SparkSession

    log = create_log(src='job.migrate_data', build=os.environ.get('SECONDHAND_BUILD', 'dev'), sink=stdout_sink)
    log.job('migrate_data', 'migrate_data', 'running')
    try:
        spark = SparkSession.getActiveSession() or SparkSession.builder.getOrCreate()
        query = """SELECT table_name, column_name, is_nullable
                   FROM secondhand.information_schema.columns
                   WHERE table_schema = 'core' AND column_name IN ('data', 'basis_level')"""
        columns = log.call('db', 'read_data_columns', {'sql': query},
                           lambda: spark.sql(query).collect(),
                           describe=lambda rows: {'rows': len(rows)})
        statements = plan({row['table_name']: row['is_nullable'] for row in columns if row['column_name'] == 'data'},
                          TABLES, basis_level_exists=any(row['table_name'] == 'guarded_number' and row['column_name'] == 'basis_level' for row in columns))

        def execute(statement, parameters):
            return log.call('db', 'migrate_data', {'sql': statement}, lambda: spark.sql(statement, args=parameters).collect(),
                            describe=lambda rows: {'rows': len(rows)})

        grant_columns = execute("SELECT column_name FROM secondhand.information_schema.columns "
                                "WHERE table_schema = 'governance' AND table_name = 'principal_map' AND column_name = 'grant_id'", {})
        if not grant_columns:
            execute("ALTER TABLE secondhand.governance.principal_map ADD COLUMNS "
                    "(grant_id STRING COMMENT 'The break_glass.id this wildcard row belongs to.')", {})
        run_plan(statements, execute)
        log.job('migrate_data', 'migrate_data', 'done', statements=len(statements))
        log.end()
    except Exception as error:
        log.error('migrate_data', error)
        log.job('migrate_data', 'migrate_data', 'failed')
        log.end(ok=False)
        raise


if __name__ == '__main__':
    main()
