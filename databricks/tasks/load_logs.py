"""Load the log envelope and decision answers; malformed lines remain counted rejects."""
from __future__ import annotations

import hashlib
import json
import argparse
import os
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import NamedTuple

# Serverless executes the entrypoint without __file__; imported modules still have it.
ROOT = Path(__file__).resolve().parents[2] if '__file__' in globals() else None
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT, required=ROOT is None)
    ROOT = parser.parse_args().root.resolve()
sys.path[:0] = [str(ROOT / 'log'), str(ROOT / 'databricks')]
from secondhand_log import create_log, stdout_sink
from guard import guard_batch
from break_glass import break_glass

ENVELOPE = {'ts', 'session', 'seq', 'src', 'level', 'event'}
LOG_FIELDS = ENVELOPE | {'item', 'job', 'call', 'trace', 'user', 'user_id'}
LOG_SCHEMA = 'data STRING, user_id STRING, ts TIMESTAMP, session STRING, seq INT, src STRING, level STRING, event STRING, item STRING, job STRING, call STRING, trace STRING, body STRING'
DECISION_SCHEMA = 'data STRING, id STRING, user_id STRING, created_at TIMESTAMP, updated_at TIMESTAMP, version INT, kind STRING, item_id STRING, action STRING, actor STRING, price_cents BIGINT, floor_cents BIGINT, site STRING, policy_mode STRING, policy_result STRING, policy_version STRING, why STRING, state STRING, buyer_handle STRING'
REPORT_SCHEMA = 'file STRING, lines BIGINT, loaded BIGINT, rejected BIGINT, reasons STRING'


class Parsed(NamedTuple):
    log_events: list[dict]
    decisions: list[dict]
    rejects: list[dict]


def _timestamp(value: str) -> datetime:
    date = datetime.fromisoformat(value.replace('Z', '+00:00'))
    return date.replace(tzinfo=timezone.utc) if date.tzinfo is None else date.astimezone(timezone.utc)


def _validate(row) -> None:
    if not isinstance(row, dict):
        raise ValueError('line must be a JSON object')
    for field in ('ts', 'session', 'event'):
        if not isinstance(row.get(field), str) or not row[field].strip():
            raise ValueError(f'{field} must be a nonempty string')
    if type(row.get('seq')) is not int or not 0 <= row['seq'] <= 2147483647:
        raise ValueError('seq must be a nonnegative 32-bit integer')
    try:
        _timestamp(row['ts'])
    except ValueError as error:
        raise ValueError('ts must be a parseable ISO timestamp') from error
    for field in ('src', 'level', 'item', 'job', 'call', 'trace', 'user', 'user_id'):
        if row.get(field) is not None and not isinstance(row[field], str):
            raise ValueError(f'{field} must be a string')
    if row.get('level') is not None and row['level'] not in ('debug', 'info', 'warn', 'error'):
        raise ValueError('level must be debug, info, warn or error')
    if row['event'] == 'decision.answer':
        for field in ('kind', 'decision_kind', 'action', 'decision', 'mode', 'site', 'policy_version', 'why', 'buyer_handle'):
            if row.get(field) is not None and not isinstance(row[field], str):
                raise ValueError(f'{field} must be a string')
        for field in ('price_cents', 'floor_cents'):
            if row.get(field) is not None and (type(row[field]) is not int or not -(2**63) <= row[field] < 2**63):
                raise ValueError(f'{field} must be integer cents')
        if not (row.get('kind') or row.get('decision_kind') or row.get('decision')):
            raise ValueError('decision.answer needs kind or decision')


def provenance(row: dict) -> str:
    if row.get('src') == 'policy_sweep':
        return 'synthetic'
    if row.get('src') == 'walk' or row.get('fixture') is True:
        return 'example'
    site = row.get('site')
    return f'live:{site.strip()}' if isinstance(site, str) and site.strip() else 'example'


def parse(lines, source_name: str, *, erased_users=frozenset()) -> Parsed:
    """Return log rows, decision rows and rejects (file, 1-based line, reason)."""
    logs, decisions, rejects = [], [], []
    for number, line in enumerate(lines, 1):
        try:
            row = json.loads(line)
            if isinstance(row, dict) and any(isinstance(row.get(key), str) and row[key] in erased_users for key in ('user', 'user_id')):
                rejects.append({'file': source_name, 'line': number, 'reason': 'erased user skipped'})
                continue
            _validate(row)
        except (ValueError, TypeError) as error:
            rejects.append({'file': source_name, 'line': number, 'reason': str(error)})
            continue
        ts = _timestamp(row['ts'])
        user = row.get('user') or row.get('user_id') or 'system'
        data = provenance(row)
        logs.append({'data': data, 'user_id': user, 'ts': ts, 'session': row['session'], 'seq': row['seq'],
                     **{k: row.get(k) for k in ('src', 'level', 'event', 'item', 'job', 'call', 'trace')},
                     'body': json.dumps({k: v for k, v in row.items() if k not in LOG_FIELDS}, ensure_ascii=False)})
        if row['event'] != 'decision.answer':
            continue
        body = {k: v for k, v in row.items() if k not in ENVELOPE}
        kind = row.get('kind') or row.get('decision_kind') or row['decision'].removeprefix('walk_')
        decisions.append({'id': 'dec_' + hashlib.sha256(f"{row['session']}:{row['seq']}".encode()).hexdigest()[:16],
                          'data': data, 'user_id': user, 'created_at': ts, 'updated_at': ts, 'version': 1,
                          'kind': kind, 'item_id': row.get('item'), 'action': row.get('action') or kind,
                          'actor': 'auto' if row.get('src') == 'policy_sweep' else 'user',
                          'price_cents': row.get('price_cents'), 'floor_cents': row.get('floor_cents'),
                          'site': row.get('site'), 'policy_mode': row.get('mode') or 'ask',
                          'policy_result': json.dumps(body, ensure_ascii=False),
                          'policy_version': row.get('policy_version') or 'walk',
                          'why': row.get('why'), 'state': 'answered', 'buyer_handle': row.get('buyer_handle')})
    return Parsed(logs, decisions, rejects)


def merge_rows(spark, log, table, rows, schema, keys):
    if not rows:
        return
    source = 'load_logs_' + table.rsplit('.', 1)[-1]
    frame = spark.createDataFrame(rows, schema).dropDuplicates(keys)
    frame.createOrReplaceTempView(source)
    predicate = ' AND '.join(f't.{key} = s.{key}' for key in keys)
    statement = f'MERGE INTO {table} t USING {source} s ON {predicate} WHEN NOT MATCHED THEN INSERT *'
    log.call('db', 'merge_log_rows', {'table': table, 'rows': len(rows)}, lambda: spark.sql(statement).collect(),
             describe=lambda result: {'rows': len(result)})


def merge_logs(spark, log, logs, decisions):
    if not logs and not decisions:
        return

    def sql(statement, args):
        return log.call('db', 'load_logs_access', {'sql': statement},
                        lambda: spark.sql(statement, args=args).collect(), describe=lambda rows: {'rows': len(rows)})

    with break_glass(sql, 'load logs'):
        merge_rows(spark, log, 'secondhand.core.log_event', logs, LOG_SCHEMA, ['session', 'seq'])
        merge_rows(spark, log, 'secondhand.core.decision', decisions, DECISION_SCHEMA, ['id'])


def main() -> dict:
    from pyspark.sql import SparkSession

    log = create_log(src='job.load_logs', build=os.environ.get('SECONDHAND_BUILD', 'dev'), sink=stdout_sink)
    log.job('load_logs', 'load_logs', 'running')
    try:
        spark = SparkSession.getActiveSession() or SparkSession.builder.getOrCreate()
        directory = Path('/Volumes/secondhand/raw/landing/logs')
        files = log.call('tool', 'list_log_files', {'path': str(directory)}, lambda: sorted(directory.glob('*.jsonl')),
                         describe=lambda paths: {'files': len(paths)})
        if not files:
            raise FileNotFoundError(f'no JSONL files in {directory}')
        erased = log.call('db', 'read_erasure', {},
                          lambda: spark.sql('SELECT user_id FROM secondhand.governance.erasure').collect(),
                          describe=lambda rows: {'rows': len(rows)})
        erased_users = {row['user_id'] for row in erased}
        logs, decisions, reports = [], [], []
        for path in files:
            lines = log.call('tool', 'read_log_file', {'file': str(path)}, lambda: path.read_text(encoding='utf-8').splitlines(),
                             describe=lambda rows: {'lines': len(rows)})
            parsed = parse(lines, str(path), erased_users=erased_users)
            logs.extend(parsed.log_events)
            decisions.extend(parsed.decisions)
            reasons = Counter(r['reason'] for r in parsed.rejects)
            reports.append({'file': str(path), 'lines': len(lines), 'loaded': len(parsed.log_events),
                            'rejected': len(parsed.rejects), 'reasons': json.dumps(dict(reasons), sort_keys=True)})
            for reject in parsed.rejects:
                log.event('note', {'msg': 'log line rejected', **reject}, 'warn')
        batches = [('secondhand.core.log_event', logs, LOG_SCHEMA),
                   ('secondhand.core.decision', decisions, DECISION_SCHEMA),
                   ('secondhand.measures.load_report', reports, REPORT_SCHEMA)]
        for table, rows, _ in batches:
            guard_batch(spark, log, 'load_logs', table, rows)
        merge_logs(spark, log, logs, decisions)
        log.call('db', 'load_report', {'files': len(reports)},
                 lambda: spark.createDataFrame(reports, REPORT_SCHEMA).write.mode('overwrite').saveAsTable('secondhand.measures.load_report'))
        result = {'files': len(files), 'loaded': len(logs), 'decisions': len(decisions),
                  'rejected': sum(r['rejected'] for r in reports)}
        log.job('load_logs', 'load_logs', 'done', **result)
        log.end()
        return result
    except Exception as error:
        log.error('load_logs', error)
        log.job('load_logs', 'load_logs', 'failed')
        log.end(ok=False)
        raise


if __name__ == '__main__':
    main()
