"""Delete a person's core rows and captures, with temporary cross-user access."""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import NamedTuple
from uuid import uuid4

# Serverless entrypoints have no __file__; the bundle passes --root instead.
ROOT = Path(__file__).resolve().parents[2] if '__file__' in globals() else None


class Plan(NamedTuple):
    deletes: list[tuple[str, dict]]
    reorgs: list[tuple[str, dict]]
    counts: list[tuple[str, dict]]


def validate_user(user_id: str) -> None:
    if not re.fullmatch(r'usr_[A-Za-z0-9]+', user_id):
        raise ValueError('refused: expected user id usr_[A-Za-z0-9]+')


def plan(user_id: str, catalog: str, tables: list[str]) -> Plan:
    """Pure statement plan over discovered core tables with an owner column."""
    from break_glass import identifier

    validate_user(user_id)
    names = [f'{identifier(catalog)}.`core`.{identifier(t)}' for t in tables]
    return Plan(
        [(f'DELETE FROM {name} WHERE user_id = :user_id', {'user_id': user_id}) for name in names],
        [(f'REORG TABLE {name} APPLY (PURGE)', {}) for name in names],
        [(f'SELECT count(*) AS n FROM {name} WHERE user_id = :user_id', {'user_id': user_id}) for name in names],
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


def run_purge(sql, user_id: str, catalog: str, tables: list[str], captures) -> dict:
    from break_glass import break_glass

    statements = plan(user_id, catalog, tables)
    with break_glass(sql, f'delete_user {user_id}', catalog=catalog):
        for statement, args in [*statements.deletes, *statements.reorgs]:
            sql(statement, args)
        left = {table: sql(statement, args)[0]['n'] for table, (statement, args) in zip(tables, statements.counts)}
        if any(left.values()):
            raise RuntimeError(f'rows remain after delete: {left}')
        captures()
        sql(*decision_statement(user_id, catalog, left, 'dec_' + uuid4().hex))
    return left


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
    parser.add_argument('user_id')
    parser.add_argument('catalog', nargs='?', default='secondhand')
    parser.add_argument('--root', type=Path, default=ROOT, required=ROOT is None)
    args = parser.parse_args(argv)
    validate_user(args.user_id)
    root = args.root.resolve()
    sys.path.insert(0, str(root / 'databricks'))
    sys.path.insert(0, str(root / 'log'))
    from break_glass import identifier
    from secondhand_log import create_log, stdout_sink
    from pyspark.sql import SparkSession
    from databricks.sdk import WorkspaceClient

    log = create_log(src='job.purge', build=os.environ.get('SECONDHAND_BUILD', 'dev'), sink=stdout_sink,
                     config={'user_id': args.user_id, 'catalog': args.catalog})
    log.job('purge', 'delete_user', 'running')
    try:
        spark = SparkSession.builder.getOrCreate()

        def sql(statement, parameters):
            return log.call('db', 'purge_statement', {'statement': statement, 'args': parameters},
                            lambda: [row.asDict() for row in spark.sql(statement, args=parameters).collect()])

        schema = f'{identifier(args.catalog)}.`core`'
        tables = log.call('db', 'purge_tables', {'schema': schema},
                          lambda: [t.tableName for t in spark.sql(f'SHOW TABLES IN {schema}').collect()
                                   if 'user_id' in [c.name for c in spark.table(f'{schema}.{identifier(t.tableName)}').schema]])
        files = WorkspaceClient().files
        left = run_purge(sql, args.user_id, args.catalog, tables,
                         lambda: log.call('tool', 'delete_captures', {'user_id': args.user_id, 'catalog': args.catalog},
                                          lambda: delete_captures(files, args.user_id, args.catalog)))
        result = {'user_id': args.user_id, 'rows_left': left, 'zero': True}
        log.job('purge', 'delete_user', 'done', **result)
        log.end(ok=True)
        return result
    except Exception as error:
        log.error('purge', error)
        log.job('purge', 'delete_user', 'failed')
        log.end(ok=False)
        raise


if __name__ == '__main__':
    main()
