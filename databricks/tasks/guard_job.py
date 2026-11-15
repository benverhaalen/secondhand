"""Sweep abandoned access, check all owners, then publish a guard snapshot."""
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2] if '__file__' in globals() else None
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT, required=ROOT is None)
    ROOT = parser.parse_args().root.resolve()
sys.path[:0] = [str(ROOT / 'log'), str(ROOT / 'databricks')]
from secondhand_log import create_log, stdout_sink
from break_glass import break_glass
from tasks.migrate_data import guard_setup_plan

SNAPSHOT_SCHEMA = 'checked_at TIMESTAMP, violations BIGINT, by_rule STRING, data STRING'
ROWS_SCHEMA = 'checked_at TIMESTAMP, table_name STRING, row_id STRING, rule STRING, data STRING'


def sweep(sql):
    unlogged = sql("SELECT DISTINCT m.principal FROM secondhand.governance.principal_map m "
                   "WHERE m.user_id = '*' AND NOT EXISTS (SELECT 1 FROM secondhand.governance.break_glass b "
                   'WHERE b.principal = m.principal AND b.ended_at IS NULL)', {})
    violations = []
    for row in unlogged:
        principal = row['principal']
        sql('INSERT INTO secondhand.governance.break_glass '
            '(id, principal, reason, started_at, ended_at, reason_closed) '
            "VALUES (:id, :principal, 'unlogged wildcard found by guard', current_timestamp(), current_timestamp(), 'swept by guard')",
            {'id': 'bg_' + uuid4().hex, 'principal': principal})
        sql("DELETE FROM secondhand.governance.principal_map WHERE principal = :principal AND user_id = '*'",
            {'principal': principal})
        violations.append({'table_name': 'principal_map', 'row_id': principal,
                           'rule': 'principal_map_unlogged_wildcard', 'data': None})
    stale = sql('SELECT id, principal FROM secondhand.governance.break_glass '
                'WHERE ended_at IS NULL AND started_at < current_timestamp() - INTERVAL 60 MINUTES', {})
    for row in stale:
        sql("DELETE FROM secondhand.governance.principal_map WHERE principal = :principal AND user_id = '*'",
            {'principal': row['principal']})
        sql("UPDATE secondhand.governance.break_glass SET ended_at = current_timestamp(), reason_closed = 'swept by guard' "
            'WHERE id = :id AND ended_at IS NULL', {'id': row['id']})
    return violations


def run_guard(spark, log, sql):
    swept = sweep(sql)
    with break_glass(sql, 'guard check'):
        rows = sql('SELECT table_name, row_id, rule, data FROM secondhand.measures.guard_violations', {})
        violations = swept + [{key: row[key] for key in ('table_name', 'row_id', 'rule', 'data')} for row in rows]
        checked_at = datetime.now(timezone.utc)
        details = [{'checked_at': checked_at, **row} for row in violations]
        snapshot = {'checked_at': checked_at, 'violations': len(violations),
                    'by_rule': json.dumps(dict(Counter(row['rule'] for row in violations)), sort_keys=True),
                    'data': 'live:secondhand'}
        if details:
            log.call('db', 'guard_snapshot_rows', {'rows': len(details)},
                     lambda: spark.createDataFrame(details, ROWS_SCHEMA).write.mode('append').saveAsTable('secondhand.measures.guard_snapshot_rows'))
        log.call('db', 'guard_snapshot', {'violations': len(violations)},
                 lambda: spark.createDataFrame([snapshot], SNAPSHOT_SCHEMA).write.mode('append').saveAsTable('secondhand.measures.guard_snapshot'))
    if violations:
        raise ValueError(f'guard violations: {len(violations)}; see secondhand.measures.guard_snapshot_rows')
    return snapshot


def main():
    from pyspark.sql import SparkSession

    log = create_log(src='job.guard', build=os.environ.get('SECONDHAND_BUILD', 'dev'), sink=stdout_sink)
    log.job('guard', 'guard', 'running')
    try:
        spark = SparkSession.getActiveSession() or SparkSession.builder.getOrCreate()

        def sql(statement, args):
            return log.call('db', 'guard_sql', {'sql': statement},
                            lambda: spark.sql(statement, args=args).collect(), describe=lambda rows: {'rows': len(rows)})

        columns = sql("SELECT column_name FROM secondhand.information_schema.columns "
                      "WHERE table_schema = 'governance' AND table_name = 'break_glass' AND column_name = 'reason_closed'", {})
        definition = log.call('tool', 'guard_definition', {'file': 'databricks/sql/09_guard.sql'},
                              lambda: (ROOT / 'databricks/sql/09_guard.sql').read_text(), describe=lambda _: {'read': True})
        for statement in guard_setup_plan(definition, reason_closed_exists=bool(columns)):
            sql(statement, {})
        snapshot = run_guard(spark, log, sql)
        log.job('guard', 'guard', 'done', violations=snapshot['violations'])
        log.end()
    except Exception as error:
        log.error('guard', error)
        log.job('guard', 'guard', 'failed')
        log.end(ok=False)
        raise


if __name__ == '__main__':
    main()
