"""Load benchmark answer records, retaining a reason for each rejected line."""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import NamedTuple

KEY = ('run_id', 'tool', 'item_id', 'question')
MERGE_KEYS = {'record': KEY, 'number': (*KEY, 'position'), 'fact': (*KEY, 'position'), 'site': (*KEY, 'position'), 'read': (*KEY, 'position')}
COST_COLUMNS = {'cost_cents': 'DOUBLE', 'browser_s': 'DOUBLE', 'proxy_bytes': 'BIGINT', 'model_calls': 'BIGINT'}
SCHEMAS = {
    'record': 'run_id STRING, tool STRING, item_id STRING, question STRING, data STRING, manifest_sha256 STRING, asked_at TIMESTAMP, first_at TIMESTAMP, full_at TIMESTAMP, first_ms DOUBLE, full_ms DOUBLE, ok BOOLEAN, error STRING, range_json STRING, delist_json STRING, raw_ref STRING, cost_cents DOUBLE, browser_s DOUBLE, proxy_bytes BIGINT, model_calls BIGINT',
    'number': 'run_id STRING, tool STRING, item_id STRING, question STRING, data STRING, position INT, name STRING, value_cents BIGINT, citation_id STRING, evidence ARRAY<STRING>',
    'fact': 'run_id STRING, tool STRING, item_id STRING, question STRING, data STRING, position INT, kind STRING, count BIGINT',
    'site': 'run_id STRING, tool STRING, item_id STRING, question STRING, data STRING, position INT, site STRING',
    'read': 'run_id STRING, tool STRING, item_id STRING, question STRING, data STRING, position INT, site STRING, lane STRING, ms DOUBLE, outcome STRING, rows BIGINT, warm BOOLEAN',
    'load_report': 'run_id STRING, data STRING, file STRING, lines BIGINT, loaded BIGINT, rejected BIGINT, reasons STRING',
}


class Parsed(NamedTuple):
    records: list[dict]
    numbers: list[dict]
    facts: list[dict]
    sites: list[dict]
    reads: list[dict]
    rejects: list[dict]


def _string(value, field, nullable=False):
    if nullable and value is None:
        return
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f'{field} must be a nonempty string' + (' or null' if nullable else ''))


def _integer(value, field):
    if type(value) is not int or not -(2**63) <= value < 2**63:
        raise ValueError(f'{field} must be a 64-bit integer')


def _nonnegative(value, field, integer=False):
    if integer:
        _integer(value, field)
    elif type(value) not in (int, float) or not -sys.float_info.max <= value <= sys.float_info.max:
        raise ValueError(f'{field} must be a nonnegative number')
    if value < 0:
        raise ValueError(f'{field} must be nonnegative')


def _time(value, field, nullable=False):
    _string(value, field, nullable)
    if value is None:
        return None
    try:
        date = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError as error:
        raise ValueError(f'{field} must be an ISO timestamp') from error
    return date.replace(tzinfo=timezone.utc) if date.tzinfo is None else date.astimezone(timezone.utc)


def _object(value, fields, name):
    if not isinstance(value, dict):
        raise ValueError(f'{name} must be an object')
    missing = fields - value.keys()
    if missing:
        raise ValueError(f'{name} missing {sorted(missing)[0]}')


def _array(value, name):
    if not isinstance(value, list):
        raise ValueError(f'{name} must be an array')


def _validate(row):
    fields = set(KEY) | {'manifest_sha256', 'asked_at', 'first_at', 'full_at', 'ok', 'error', 'sites', 'facts', 'numbers', 'range', 'delist', 'raw_ref'}
    _object(row, fields, 'record')
    for field in (*KEY, 'manifest_sha256', 'raw_ref'):
        _string(row[field], field)
    if not re.fullmatch(r'[0-9a-fA-F]{64}', row['manifest_sha256']):
        raise ValueError('manifest_sha256 must be a SHA-256 hex digest')
    if row['question'] not in ('search', 'product', 'value', 'delist'):
        raise ValueError('question must be search, product, value or delist')
    asked = _time(row['asked_at'], 'asked_at')
    times = [_time(row[field], field, True) for field in ('first_at', 'full_at')]
    for field, value in zip(('first_at', 'full_at'), times):
        if value is not None and value < asked:
            raise ValueError(f'{field} precedes asked_at')
    if type(row['ok']) is not bool:
        raise ValueError('ok must be a boolean')
    _string(row['error'], 'error', True)
    for field in ('sites', 'facts', 'numbers'):
        _array(row[field], field)
    for site in row['sites']:
        _string(site, 'site')
    if 'reads' in row:
        _array(row['reads'], 'reads')
        for read in row['reads']:
            _object(read, {'site', 'lane', 'ms', 'outcome', 'rows', 'warm'}, 'read')
            for field in ('site', 'lane', 'outcome'):
                _string(read[field], 'read.' + field)
            if read['lane'] not in ('plain', 'cloud_browser', 'own_browser', 'official', 'mcp'):
                raise ValueError('read.lane must be plain, cloud_browser, own_browser, official or mcp')
            _nonnegative(read['ms'], 'read.ms')
            _nonnegative(read['rows'], 'read.rows', integer=True)
            if type(read['warm']) is not bool:
                raise ValueError('read.warm must be a boolean')
    if 'cost' in row:
        _object(row['cost'], set(), 'cost')
        for field in ('browser_s', 'proxy_bytes', 'model_calls', 'cents'):
            value = row['cost'].get(field)
            if value is not None:
                _nonnegative(value, 'cost.' + field, integer=field in ('proxy_bytes', 'model_calls'))
    for fact in row['facts']:
        _object(fact, {'kind', 'count'}, 'fact')
        _string(fact['kind'], 'kind')
        _integer(fact['count'], 'count')
        if fact['count'] < 0:
            raise ValueError('count must be nonnegative')
    for number in row['numbers']:
        _object(number, {'name', 'value_cents', 'citation_id', 'evidence'}, 'number')
        _string(number['name'], 'name')
        _integer(number['value_cents'], 'value_cents')
        _string(number['citation_id'], 'citation_id', True)
        _array(number['evidence'], 'evidence')
        for evidence in number['evidence']:
            _string(evidence, 'evidence')
    if row['range'] is not None:
        _object(row['range'], {'low_cents', 'high_cents', 'as_of'}, 'range')
        for field in ('low_cents', 'high_cents'):
            _integer(row['range'][field], field)
        _time(row['range']['as_of'], 'as_of')
    if row['delist'] is not None:
        _array(row['delist'], 'delist')
        for entry in row['delist']:
            _object(entry, {'site', 'sold_at', 'ended_at'}, 'delist entry')
            _string(entry['site'], 'delist.site')
            _time(entry['sold_at'], 'sold_at', True)
            _time(entry['ended_at'], 'ended_at', True)
    return asked, times


def parse(lines) -> Parsed:
    records, numbers, facts, sites, reads, rejects = [], [], [], [], [], []
    seen = set()
    for line_number, line in enumerate(lines, 1):
        try:
            row = json.loads(line)
            asked, (first, full) = _validate(row)
            key = tuple(row[k] for k in KEY)
            if key in seen:
                raise ValueError('duplicate record key')
            seen.add(key)
        except (ValueError, TypeError) as error:
            rejects.append({'line': line_number, 'reason': str(error)})
            continue
        base = {k: row[k] for k in KEY}
        base['data'] = 'dataset:bench_' + row['manifest_sha256'][:12]
        cost = row.get('cost', {})
        usage = {column: cost.get('cents' if column == 'cost_cents' else column) for column in COST_COLUMNS}
        for column, dtype in COST_COLUMNS.items():
            if dtype == 'DOUBLE' and usage[column] is not None:
                usage[column] = float(usage[column])
        records.append({**base, 'manifest_sha256': row['manifest_sha256'], 'asked_at': asked,
                        'first_at': first, 'full_at': full,
                        'first_ms': (first - asked).total_seconds() * 1000 if first else None,
                        'full_ms': (full - asked).total_seconds() * 1000 if full else None,
                        'ok': row['ok'], 'error': row['error'],
                        'range_json': json.dumps(row['range']) if row['range'] is not None else None,
                        'delist_json': json.dumps(row['delist']) if row['delist'] is not None else None,
                        'raw_ref': row['raw_ref'], **usage})
        numbers.extend({**base, **n, 'position': i} for i, n in enumerate(row['numbers']))
        facts.extend({**base, **f, 'position': i} for i, f in enumerate(row['facts']))
        sites.extend({**base, 'site': s, 'position': i} for i, s in enumerate(row['sites']))
        reads.extend({**base, **{field: read[field] for field in ('site', 'lane', 'outcome', 'rows', 'warm')},
                      'ms': float(read['ms']), 'position': i} for i, read in enumerate(row.get('reads', [])))
    return Parsed(records, numbers, facts, sites, reads, rejects)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root')
    parser.add_argument('--migrate-only', action='store_true', help='Add missing columns before running benchmark SQL setup.')
    args = parser.parse_args()
    if args.root:
        root = Path(args.root)
    elif '__file__' in globals():
        root = Path(__file__).resolve().parents[2]
    else:
        raise RuntimeError('--root is required when __file__ is unavailable')
    sys.path.insert(0, str(root / 'log'))
    from secondhand_log import create_log, stdout_sink
    from pyspark.sql import SparkSession

    log = create_log(src='job.load_bench', build=os.environ.get('SECONDHAND_BUILD', 'dev'), sink=stdout_sink)
    log.job('load_bench', 'load_bench', 'running')
    try:
        spark = SparkSession.getActiveSession() or SparkSession.builder.getOrCreate()
        for name in ('number', 'fact', 'site'):
            table = 'secondhand.measures.bench_' + name
            def migrate():
                if 'position' not in spark.table(table).columns:
                    spark.sql(f'ALTER TABLE {table} ADD COLUMNS (position INT)')
            log.call('db', 'migrate_bench_' + name, {'table': table}, migrate)
        def migrate_cost():
            table = 'secondhand.measures.bench_record'
            columns = spark.table(table).columns
            missing = [f'{column} {dtype}' for column, dtype in COST_COLUMNS.items() if column not in columns]
            if missing:
                spark.sql(f'ALTER TABLE {table} ADD COLUMNS ({", ".join(missing)})')
        log.call('db', 'migrate_bench_cost', {'table': 'secondhand.measures.bench_record'}, migrate_cost)
        directory = Path('/Volumes/secondhand/raw/landing/bench')
        files = [] if args.migrate_only else log.call('tool', 'list_bench_files', {'path': str(directory)},
                                                    lambda: sorted(directory.glob('*/records.jsonl')), describe=lambda paths: {'files': len(paths)})
        for path in files:
            run_id = path.parent.name
            lines = log.call('tool', 'read_bench_file', {'file': str(path)},
                             lambda: path.read_text(encoding='utf-8').splitlines(), describe=lambda rows: {'lines': len(rows)})
            parsed = parse(lines)
            if any(row['run_id'] != run_id for row in parsed.records):
                raise ValueError(f'run_id does not match folder {run_id}')
            datasets = {row['data'] for row in parsed.records}
            if len(datasets) > 1:
                raise ValueError(f'multiple manifest datasets in run {run_id}')
            for reject in parsed.rejects:
                log.event('note', {'msg': 'benchmark line rejected', 'file': str(path), **reject}, 'warn')
            for name, rows in zip(('record', 'number', 'fact', 'site', 'read'), parsed[:5]):
                table = 'secondhand.measures.bench_' + name
                temp = 'bench_load_' + name
                def merge():
                    spark.createDataFrame(rows, SCHEMAS[name]).createOrReplaceTempView(temp)
                    condition = ' AND '.join(f't.{key} = s.{key}' for key in MERGE_KEYS[name])
                    escaped = run_id.replace("'", "''")
                    spark.sql(f"MERGE INTO {table} t USING {temp} s ON {condition} "
                              f"WHEN MATCHED THEN UPDATE SET * WHEN NOT MATCHED THEN INSERT * "
                              f"WHEN NOT MATCHED BY SOURCE AND t.run_id = '{escaped}' THEN DELETE")
                log.call('db', 'merge_bench_' + name, {'table': table, 'run_id': run_id, 'rows': len(rows)}, merge)
            report = {'run_id': run_id, 'data': next(iter(datasets), None), 'file': str(path), 'lines': len(lines), 'loaded': len(parsed.records),
                      'rejected': len(parsed.rejects), 'reasons': json.dumps(dict(Counter(r['reason'] for r in parsed.rejects)), sort_keys=True)}
            def merge_report():
                spark.createDataFrame([report], SCHEMAS['load_report']).createOrReplaceTempView('bench_report_input')
                spark.sql('MERGE INTO secondhand.measures.bench_load_report t USING bench_report_input s ON t.run_id = s.run_id WHEN MATCHED THEN UPDATE SET * WHEN NOT MATCHED THEN INSERT *')
            log.call('db', 'merge_bench_report', {'run_id': run_id}, merge_report)
        result = {'files': len(files)}
        log.job('load_bench', 'load_bench', 'done', **result)
        log.end()
        return result
    except Exception as error:
        log.error('load_bench', error)
        log.job('load_bench', 'load_bench', 'failed')
        log.end(ok=False)
        raise


if __name__ == '__main__':
    main()
