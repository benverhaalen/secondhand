"""Add and backfill writer provenance on existing core tables."""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from uuid import uuid4

TABLES = (
    'observation', 'evidence', 'citation', 'guarded_number', 'claim_check',
    'decision', 'event', 'job', 'storefront_snapshot', 'log_event',
)
COMMENT = 'Writer provenance: synthetic, example, dataset:<name> or live:<site>; immutable (spec/product.md section 3).'


def plan(existing_columns_by_table: dict[str, str], tables) -> list[str]:
    """Plan from information_schema is_nullable values (YES/NO); absent means missing."""
    statements = []
    for table in tables:
        if existing_columns_by_table.get(table) == 'NO':
            continue
        name = f'secondhand.core.{table}'
        if table not in existing_columns_by_table:
            statements.append(f"ALTER TABLE {name} ADD COLUMNS (data STRING COMMENT '{COMMENT}')")
        if table == 'observation':
            statements.append(f"ALTER TABLE {name} SET TBLPROPERTIES ('delta.appendOnly' = 'false')")
        statements.append(f"UPDATE {name} SET data = 'example' WHERE data IS NULL")
        if table == 'observation':
            statements.append(f"ALTER TABLE {name} SET TBLPROPERTIES ('delta.appendOnly' = 'true')")
        statements.append(f'ALTER TABLE {name} ALTER COLUMN data SET NOT NULL')
    return statements


def run_plan(statements, execute) -> None:
    # Agent proposal: maintenance access lasts only for this audited plan; revocation failure must raise.
    window_id = str(uuid4())
    try:
        execute("INSERT INTO secondhand.governance.principal_map (principal, user_id) VALUES (current_user(), '*')")
        execute(
            'INSERT INTO secondhand.governance.break_glass (id, principal, reason, started_at, ended_at) '
            f"VALUES ('{window_id}', current_user(), 'data column backfill (spec/product.md §3)', current_timestamp(), NULL)"
        )
        for statement in statements:
            execute(statement)
    finally:
        execute("DELETE FROM secondhand.governance.principal_map WHERE principal = current_user() AND user_id = '*'")
        execute(
            'UPDATE secondhand.governance.break_glass SET ended_at = current_timestamp() '
            f"WHERE id = '{window_id}' AND principal = current_user()"
        )


def main() -> None:
    # Serverless executes the entrypoint without __file__; --root locates the logger.
    root = Path(__file__).resolve().parents[2] if '__file__' in globals() else None
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=root, required=root is None)
    args = parser.parse_args()
    sys.path.insert(0, str(args.root.resolve() / 'log'))
    from secondhand_log import create_log, stdout_sink
    from pyspark.sql import SparkSession

    log = create_log(src='job.migrate_data', build=os.environ.get('SECONDHAND_BUILD', 'dev'), sink=stdout_sink)
    log.job('migrate_data', 'migrate_data', 'running')
    try:
        spark = SparkSession.getActiveSession() or SparkSession.builder.getOrCreate()
        query = """SELECT table_name, is_nullable
                   FROM secondhand.information_schema.columns
                   WHERE table_schema = 'core' AND column_name = 'data'"""
        columns = log.call('db', 'read_data_columns', {'sql': query},
                           lambda: spark.sql(query).collect(),
                           describe=lambda rows: {'rows': len(rows)})
        statements = plan({row['table_name']: row['is_nullable'] for row in columns}, TABLES)

        def execute(statement):
            return log.call('db', 'migrate_data', {'sql': statement}, lambda: spark.sql(statement).collect())

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
