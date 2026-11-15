"""Erase a person's core rows and source files, or vacuum retained core files."""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from io import BytesIO
from pathlib import Path
from typing import NamedTuple
from uuid import uuid4

# Serverless entrypoints have no __file__; the bundle passes --root instead.
ROOT = Path(__file__).resolve().parents[2] if '__file__' in globals() else None


class Plan(NamedTuple):
    tombstone: tuple[str, dict]
    deletes: list[tuple[str, dict]]
    reorgs: list[tuple[str, dict]]
    counts: list[tuple[str, dict]]
    principal_delete: tuple[str, dict]


def validate_user(user_id: str) -> None:
    if not re.fullmatch(r'usr_[A-Za-z0-9]+', user_id):
        raise ValueError('refused: expected user id usr_[A-Za-z0-9]+')


def plan(user_id: str, catalog: str, tables: list[str]) -> Plan:
    """Pure statement plan over discovered core tables with an owner column."""
    from break_glass import identifier

    validate_user(user_id)
    names = [f'{identifier(catalog)}.`core`.{identifier(t)}' for t in tables]
    governance = f'{identifier(catalog)}.`governance`'
    return Plan(
        (f'MERGE INTO {governance}.`erasure` AS target '
         'USING (SELECT :user_id AS user_id) AS source ON target.user_id = source.user_id '
         'WHEN MATCHED THEN UPDATE SET purged_at = NULL, tables = NULL, files_rewritten = NULL, '
         'vacuum_due_at = NULL, vacuumed_at = NULL '
         'WHEN NOT MATCHED THEN INSERT (user_id, requested_at) VALUES (source.user_id, current_timestamp())',
         {'user_id': user_id}),
        [(f'DELETE FROM {name} WHERE user_id = :user_id', {'user_id': user_id}) for name in names],
        [(f'REORG TABLE {name} APPLY (PURGE)', {}) for name in names],
        [(f'SELECT count(*) AS n FROM {name} WHERE user_id = :user_id', {'user_id': user_id}) for name in names],
        (f'DELETE FROM {governance}.`principal_map` WHERE user_id = :user_id', {'user_id': user_id}),
    )


def decision_statement(user_id: str, catalog: str, left: dict, decision_id: str) -> tuple[str, dict]:
    from break_glass import identifier

    # The audit belongs to the system, so deletion does not recreate a user row.
    return (f'INSERT INTO {identifier(catalog)}.`core`.`decision` '
            '(id, user_id, created_at, updated_at, version, kind, action, actor, policy_mode, '
            'policy_result, policy_version, why, state, data) '
            "VALUES (:id, 'system', current_timestamp(), current_timestamp(), 1, 'delete_user', 'purge', 'user', 'ask', "
            ":policy_result, 'delete_user', :why, 'done', 'live:secondhand')",
            {'id': decision_id, 'policy_result': json.dumps({'allow': True, 'mode': 'ask'}),
             'why': json.dumps({'user_id': user_id, 'tables': left}, sort_keys=True)})


def run_purge(sql, user_id: str, catalog: str, tables: list[str], rewrite_logs, captures) -> dict:
    from break_glass import break_glass, identifier

    statements = plan(user_id, catalog, tables)
    governance = f'{identifier(catalog)}.`governance`'
    with break_glass(sql, f'delete_user {user_id}', catalog=catalog):
        sql(*statements.tombstone)
        for statement, args in [*statements.deletes, *statements.reorgs]:
            sql(statement, args)
        left = {table: sql(statement, args)[0]['n'] for table, (statement, args) in zip(tables, statements.counts)}
        if any(left.values()):
            raise RuntimeError(f'rows remain after delete: {left}')
        sql(*statements.principal_delete)
        files_rewritten = rewrite_logs()
        captures()
        sql(f'UPDATE {governance}.`erasure` SET purged_at = current_timestamp(), tables = :tables, '
            'files_rewritten = :files_rewritten, vacuum_due_at = current_timestamp() + INTERVAL 7 DAYS '
            'WHERE user_id = :user_id',
            {'user_id': user_id, 'tables': json.dumps(left, sort_keys=True), 'files_rewritten': files_rewritten})
        # The loader now MERGEs and keeps non-log rows, including this final decision.
        sql(*decision_statement(user_id, catalog, left, 'dec_' + uuid4().hex))
    return left


def run_vacuum(sql, catalog: str, tables: list[str]) -> None:
    from break_glass import identifier

    started_at = sql('SELECT current_timestamp() AS vacuum_started_at', {})[0]['vacuum_started_at']
    # Keep the default seven-day safety window, including change data feed files.
    # https://docs.databricks.com/aws/en/security/privacy/gdpr-delta
    for table in tables:
        sql(f'VACUUM {identifier(catalog)}.`core`.{identifier(table)} RETAIN 168 HOURS', {})
    sql(f'UPDATE {identifier(catalog)}.`governance`.`erasure` SET vacuumed_at = current_timestamp() '
        'WHERE purged_at IS NOT NULL AND vacuum_due_at <= :vacuum_started_at AND vacuumed_at IS NULL',
        {'vacuum_started_at': started_at})


def rewrite_logs(files, user_id: str, catalog: str) -> int:
    """Scrub owned JSONL rows while keeping every retained line's original bytes."""
    from databricks.sdk.errors import NotFound

    validate_user(user_id)
    directory = f'/Volumes/{catalog}/raw/landing/logs'
    try:
        entries = list(files.list_directory_contents(directory))
    except NotFound:
        return 0
    rewritten = 0
    for entry in entries:
        if entry.is_directory or not entry.path.endswith('.jsonl'):
            continue
        with files.download(entry.path).contents as stream:
            lines = stream.read().splitlines(keepends=True)
        kept = []
        for line in lines:
            try:
                row = json.loads(line)
            except (json.JSONDecodeError, UnicodeDecodeError):
                # Malformed lines remain available to the loader's reject counter.
                kept.append(line)
                continue
            if isinstance(row, dict) and (row.get('user') == user_id or row.get('user_id') == user_id):
                continue
            kept.append(line)
        if len(kept) != len(lines):
            files.upload(entry.path, BytesIO(b''.join(kept)), overwrite=True)
            rewritten += 1
    return rewritten


def delete_captures(files, user_id: str, catalog: str) -> None:
    """Delete children before their directories, including the capture root."""
    from databricks.sdk.errors import NotFound

    validate_user(user_id)
    path = f'/Volumes/{catalog}/raw/captures/{user_id}'

    def remove(directory):
        for entry in files.list_directory_contents(directory):
            if entry.is_directory:
                remove(entry.path)
            else:
                files.delete(entry.path)
        files.delete_directory(directory)

    try:
        remove(path)
    except NotFound:
        # Only an absent capture root is success. A missing child in a present
        # root is a partial deletion and must fail rather than claim completion.
        try:
            next(iter(files.list_directory_contents(path)), None)
        except NotFound:
            return
        raise


def main(argv=None) -> dict:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('user_id', nargs='?')
    parser.add_argument('catalog', nargs='?', default='secondhand')
    parser.add_argument('--catalog', dest='catalog_override')
    parser.add_argument('--vacuum', action='store_true')
    parser.add_argument('--root', type=Path, default=ROOT, required=ROOT is None)
    args = parser.parse_args(argv)
    if args.catalog_override is not None:
        args.catalog = args.catalog_override
    if args.vacuum:
        if args.user_id is not None:
            parser.error('--vacuum does not take a user_id')
    else:
        if args.user_id is None:
            parser.error('user_id is required unless --vacuum is set')
        validate_user(args.user_id)
    root = args.root.resolve()
    sys.path.insert(0, str(root / 'databricks'))
    sys.path.insert(0, str(root / 'log'))
    from break_glass import identifier
    from secondhand_log import create_log, stdout_sink
    from pyspark.sql import SparkSession

    job = 'vacuum_core' if args.vacuum else 'purge'
    kind = 'vacuum_core' if args.vacuum else 'delete_user'
    log = create_log(src=f'job.{job}', build=os.environ.get('SECONDHAND_BUILD', 'dev'), sink=stdout_sink,
                     config={'user_id': args.user_id, 'catalog': args.catalog})
    log.job(job, kind, 'running')
    try:
        spark = SparkSession.builder.getOrCreate()

        def sql(statement, parameters):
            return log.call('db', f'{job}_statement', {'statement': statement, 'args': parameters},
                            lambda: [row.asDict() for row in spark.sql(statement, args=parameters).collect()])

        schema = f'{identifier(args.catalog)}.`core`'
        tables = log.call('db', f'{job}_tables', {'schema': schema},
                          lambda: [t.tableName for t in spark.sql(f'SHOW TABLES IN {schema}').collect()
                                   if args.vacuum or 'user_id' in [c.name for c in spark.table(f'{schema}.{identifier(t.tableName)}').schema]])
        if args.vacuum:
            run_vacuum(sql, args.catalog, tables)
            result = {'tables': tables}
        else:
            from databricks.sdk import WorkspaceClient

            files = WorkspaceClient().files
            left = run_purge(sql, args.user_id, args.catalog, tables,
                             lambda: log.call('tool', 'rewrite_logs', {'user_id': args.user_id, 'catalog': args.catalog},
                                              lambda: rewrite_logs(files, args.user_id, args.catalog)),
                             lambda: log.call('tool', 'delete_captures', {'user_id': args.user_id, 'catalog': args.catalog},
                                              lambda: delete_captures(files, args.user_id, args.catalog)))
            result = {'user_id': args.user_id, 'rows_left': left, 'zero': True}
        log.job(job, kind, 'done', **result)
        log.end(ok=True)
        return result
    except Exception as error:
        log.error(job, error)
        log.job(job, kind, 'failed')
        log.end(ok=False)
        raise


if __name__ == '__main__':
    main()
