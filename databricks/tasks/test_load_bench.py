import json
import re
import sqlite3
import statistics
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace

import pytest

from tasks.load_bench import parse, MERGE_KEYS, SCHEMAS

ROOT = Path(__file__).resolve().parents[2]
BASE = {'run_id': 'run1', 'tool': 'a', 'item_id': 'i1', 'manifest_sha256': 'a' * 64,
        'question': 'search', 'asked_at': '2026-11-15T00:00:00Z',
        'first_at': '2026-11-15T00:00:01Z', 'full_at': '2026-11-15T00:00:02Z',
        'ok': True, 'error': None, 'sites': ['ebay'], 'facts': [{'kind': 'sold', 'count': 2}],
        'numbers': [{'name': 'price', 'value_cents': 100, 'citation_id': None, 'evidence': ['e1']}],
        'range': None, 'delist': None, 'raw_ref': 'answer/1'}


def test_fixture_preserves_answers_and_counts_malformed_lines():
    rows = [{**BASE, 'question': q, 'tool': 'a' if i < 2 else 'b', 'item_id': str(i)}
            for i, q in enumerate(('search', 'product', 'value', 'delist'))]
    rows[3].update(ok=False, first_at=None, full_at=None, sites=[], facts=[], numbers=[])
    result = parse([*(json.dumps(r) for r in rows), 'malformed'])
    assert len(result.records) == 4
    assert len(result.rejects) == 1 and result.rejects[0]['line'] == 5 and result.rejects[0]['reason']
    assert result.records[0]['first_ms'] == 1000 and result.records[0]['full_ms'] == 2000
    assert result.records[3]['first_ms'] is None and result.records[3]['full_ms'] is None
    assert result.numbers[0]['citation_id'] is None
    assert all(r['data'] == 'dataset:bench_' + 'a' * 12 and r['run_id'] == 'run1'
               for group in (result.records, result.numbers, result.facts, result.sites) for r in group)


def test_invalid_times_float_cents_and_duplicate_keys_are_rejected():
    bad = [{**BASE, 'full_at': '2026-11-14T23:59:59Z'},
           {**BASE, 'numbers': [{**BASE['numbers'][0], 'value_cents': 1.5}]},
           BASE, BASE]
    result = parse([json.dumps(r) for r in bad])
    assert len(result.records) == 1 and len(result.rejects) == 3
    assert 'full_at' in result.rejects[0]['reason']
    assert 'value_cents' in result.rejects[1]['reason']
    assert result.rejects[2]['reason'] == 'duplicate record key'
    for table, rows in [('record', result.records), ('number', result.numbers), ('fact', result.facts), ('site', result.sites)]:
        keys = [tuple(row[k] for k in MERGE_KEYS[table]) for row in rows]
        assert len(keys) == len(set(keys))


def test_sql_speed_uses_percentiles_not_average():
    sql = (ROOT / 'databricks/sql/06_bench.sql').read_text().lower()
    speed = sql.split('view secondhand.measures.bench_speed', 1)[1].split(';', 1)[0]
    assert 'avg(' not in speed and speed.count('percentile_cont') >= 4


def test_repeated_values_have_distinct_positions():
    row = {**BASE, 'numbers': [{**BASE['numbers'][0], 'value_cents': n} for n in (100, 200, 300)],
           'sites': ['ebay', 'ebay'], 'facts': [{'kind': 'sold', 'count': 1}] * 2}
    result = parse([json.dumps(row), json.dumps(row)])
    assert len(result.records) == 1
    assert result.rejects[0]['reason'] == 'duplicate record key'
    for table, rows, length in [('number', result.numbers, 3), ('site', result.sites, 2), ('fact', result.facts, 2)]:
        assert [r['position'] for r in rows] == list(range(length))
        assert len({tuple(r[k] for k in MERGE_KEYS[table]) for r in rows}) == length
    assert [n['name'] for n in result.numbers] == ['price'] * 3


READ = {'site': 'ebay', 'lane': 'plain', 'ms': 125, 'outcome': 'ok', 'rows': 2, 'warm': False}
COST = {'browser_s': 1, 'proxy_bytes': 2, 'model_calls': 3, 'cents': 0.5}


def test_old_record_has_no_reads_and_unknown_cost_without_changing_answer():
    result = parse([json.dumps(BASE)])
    assert not result.rejects
    assert result.reads == []
    assert result.records[0]['first_ms'] == 1000
    assert result.sites[0]['site'] == 'ebay'
    for field in ('cost_cents', 'browser_s', 'proxy_bytes', 'model_calls'):
        assert result.records[0][field] is None, f'old record must keep {field} unknown'


def test_three_reads_keep_positions_warm_flags_and_answer_identity():
    reads = [READ, {**READ, 'warm': True, 'ms': 10.5}, {**READ, 'lane': 'mcp', 'warm': True}]
    result = parse([json.dumps({**BASE, 'reads': reads, 'cost': COST,
                               'cited_facts': 0, 'lane': 'plain', 'time_source': 'job', 'served_ref': []})])
    assert not result.rejects
    assert result.reads == [{**{key: BASE[key] for key in MERGE_KEYS['record']},
                             'data': 'dataset:bench_' + 'a' * 12, **read, 'position': i}
                            for i, read in enumerate(reads)]
    assert MERGE_KEYS['read'] == (*MERGE_KEYS['record'], 'position')
    assert result.records[0]['browser_s'] == 1.0
    assert result.records[0]['cost_cents'] == 0.5
    assert result.records[0]['proxy_bytes'] == 2
    assert result.records[0]['model_calls'] == 3
    assert type(result.reads[0]['ms']) is float, 'Spark DOUBLE requires Python floats'
    assert type(result.records[0]['browser_s']) is float


@pytest.mark.parametrize('reads,reason', [
    ({}, 'reads must be an array'),
    ([None], 'read must be an object'),
    ([{k: v for k, v in READ.items() if k != 'warm'}], 'read missing warm'),
    *[([{**READ, field: value}], reason) for field, value, reason in [
        ('ms', -1, 'read.ms must be nonnegative'),
        ('ms', True, 'read.ms must be a nonnegative number'),
        ('ms', float('inf'), 'read.ms must be a nonnegative number'),
        ('ms', float('nan'), 'read.ms must be a nonnegative number'),
        ('rows', 1.5, 'read.rows must be a 64-bit integer'),
        ('rows', True, 'read.rows must be a 64-bit integer'),
        ('rows', -1, 'read.rows must be nonnegative'),
        ('rows', 2**63, 'read.rows must be a 64-bit integer'),
        ('warm', 1, 'read.warm must be a boolean'),
        ('site', None, 'read.site must be a nonempty string'),
        ('outcome', 1, 'read.outcome must be a nonempty string'),
        ('lane', 'invalid', 'read.lane must be plain, cloud_browser, own_browser, official or mcp'),
    ]],
])
def test_invalid_read_is_rejected_with_reason_and_next_line_loads(reads, reason):
    result = parse([json.dumps({**BASE, 'reads': reads}), json.dumps(BASE)])
    assert result.rejects == [{'line': 1, 'reason': reason}]
    assert len(result.records) == 1
    assert not result.reads, 'invalid record must leave no partial reads'


def test_null_cents_stays_unknown_and_zero_cost_stays_zero():
    result = parse([json.dumps({**BASE, 'cost': {key: None for key in COST}}),
                    json.dumps({**BASE, 'item_id': 'free', 'cost': {key: 0 for key in COST}})])
    assert not result.rejects
    for field in ('cost_cents', 'browser_s', 'proxy_bytes', 'model_calls'):
        assert result.records[0][field] is None
        assert result.records[1][field] == 0


@pytest.mark.parametrize('cost,reason', [
    (None, 'cost must be an object'),
    ([], 'cost must be an object'),
    *[({**COST, field: value}, f'cost.{field}') for field in COST
      for value in (-1, True, '1', float('inf'), float('nan'))],
    *[({**COST, field: 1.5}, f'cost.{field} must be a 64-bit integer')
      for field in ('proxy_bytes', 'model_calls')],
])
def test_invalid_cost_is_rejected_without_stopping_other_lines(cost, reason):
    result = parse([json.dumps({**BASE, 'cost': cost}), json.dumps(BASE)])
    assert len(result.records) == 1
    assert len(result.rejects) == 1 and reason in result.rejects[0]['reason']


def bench_query(name):
    sql = (ROOT / 'databricks/sql/06_bench.sql').read_text()
    match = re.search(rf'VIEW secondhand\.measures\.{name}\s+COMMENT \'[^\']*\' AS\s+(.*?);', sql, re.S)
    assert match, f'{name} view must exist'
    return match[1]


def sqlite_bench():
    class Median:
        def __init__(self):
            self.values = []

        def step(self, value):
            if value is not None:
                self.values.append(value)

        def finalize(self):
            return statistics.median(self.values) if self.values else None

    db = sqlite3.connect(':memory:')
    db.row_factory = sqlite3.Row
    db.create_aggregate('median', 1, Median)
    for name in ('record', 'read'):
        db.execute(f'CREATE TABLE bench_{name} ({SCHEMAS[name]})')
    return db


def sqlite_query(query):
    # Translate only the two Databricks aggregate spellings, preserving their inputs.
    query = query.replace('secondhand.measures.', '')
    query = re.sub(r'percentile_cont\(0\.5\) WITHIN GROUP \(ORDER BY ([^()]+)\)', r'median(\1)', query, flags=re.I)
    return re.sub(r'count_if\(([^()]+)\)', r'sum(CASE WHEN \1 THEN 1 ELSE 0 END)', query, flags=re.I)


def insert_parsed(db, parsed):
    for name, rows in (('record', parsed.records), ('read', parsed.reads)):
        for row in rows:
            columns = list(row)
            db.execute(f'INSERT INTO bench_{name} ({", ".join(columns)}) VALUES ({", ".join("?" for _ in columns)})',
                       [str(row[c]) if c.endswith('_at') and row[c] is not None else row[c] for c in columns])


def test_by_site_counts_only_ok_and_keeps_empty_medians_null():
    query = bench_query('bench_by_site')
    db = sqlite_bench()
    insert_parsed(db, parse([json.dumps(BASE), json.dumps({**BASE, 'item_id': 'later',
        'asked_at': '2026-11-15T00:00:01Z', 'reads': [
            READ, {**READ, 'warm': True, 'ms': 375, 'rows': 4},
            {**READ, 'warm': True, 'ms': 625, 'outcome': 'empty', 'rows': 0},
            {**READ, 'lane': 'cloud_browser', 'outcome': 'blocked', 'rows': 0},
        ]})]))
    rows = {row['lane']: dict(row) for row in db.execute(sqlite_query(query))}
    assert len(rows) == 2, 'site lanes must remain separate'
    plain = rows['plain']
    assert plain['reads'] == 3 and plain['answered'] == 2
    assert plain['answered_share'] == pytest.approx(2 / 3)
    assert plain['median_rows'] == 3, 'only ok reads contribute to median rows'
    assert plain['cold_p50_s'] == 0.125 and plain['warm_p50_s'] == 0.5
    assert plain['cold_reads'] == 1 and plain['warm_reads'] == 2
    assert plain['asked_at'] == '2026-11-15 00:00:00+00:00', 'run time includes records without reads'
    blocked = rows['cloud_browser']
    assert blocked['answered'] == 0 and blocked['answered_share'] == 0
    assert blocked['median_rows'] is None, 'no answered reads means null median rows'
    assert blocked['warm_p50_s'] is None, 'no warm reads means null warm median'
    assert blocked['warm_reads'] == 0


def test_cost_view_keeps_unknown_cost_null_and_counts_all_answers():
    query = bench_query('bench_cost')
    db = sqlite_bench()
    records = [BASE, {**BASE, 'item_id': 'paid', 'cost': COST},
               {**BASE, 'item_id': 'free', 'ok': False, 'cost': {**COST, 'cents': 0}},
               {**BASE, 'tool': 'baseline', 'cost': {**COST, 'cents': None}}]
    insert_parsed(db, parse(map(json.dumps, records)))
    rows = {row['tool']: dict(row) for row in db.execute(sqlite_query(query))}
    assert rows['a']['answers'] == 3 and rows['a']['answers_with_cost'] == 2
    assert rows['a']['unknown_cost'] == 1
    assert rows['a']['median_cents_per_answer'] == 0.25
    assert rows['baseline']['unknown_cost'] == 1
    assert rows['baseline']['median_cents_per_answer'] is None


@pytest.mark.parametrize('existing_cost', [(), ('cost_cents', 'proxy_bytes'),
                                         ('cost_cents', 'browser_s', 'proxy_bytes', 'model_calls')])
def test_main_migrates_only_missing_cost_columns_and_merges_reads_with_run_cleanup(monkeypatch, tmp_path, existing_cost):
    from tasks import load_bench

    run = tmp_path / 'run1'
    run.mkdir()
    path = run / 'records.jsonl'
    path.write_text(json.dumps({**BASE, 'reads': [READ, {**READ, 'warm': True}], 'cost': COST}) + '\n')

    class Spark:
        def __init__(self):
            self.columns = list(existing_cost)
            self.statements = []
            self.views = {}

        def table(self, table):
            return SimpleNamespace(columns=self.columns if table.endswith('bench_record') else ['position'])

        def sql(self, statement):
            self.statements.append(statement)
            if statement.startswith('ALTER TABLE secondhand.measures.bench_record'):
                self.columns.extend(column.split()[0] for column in statement.split('ADD COLUMNS (')[1][:-1].split(', '))

        def createDataFrame(self, rows, schema):
            return SimpleNamespace(createOrReplaceTempView=lambda name: self.views.update({name: (rows, schema)}))

    spark = Spark()
    pyspark = ModuleType('pyspark')
    pyspark.sql = ModuleType('pyspark.sql')
    pyspark.sql.SparkSession = SimpleNamespace(getActiveSession=lambda: spark)
    monkeypatch.setitem(sys.modules, 'pyspark', pyspark)
    monkeypatch.setitem(sys.modules, 'pyspark.sql', pyspark.sql)
    monkeypatch.setattr(sys, 'argv', ['load_bench', '--root', str(ROOT)])
    monkeypatch.setattr(Path, 'glob', lambda self, pattern: iter([path]))

    assert load_bench.main() == {'files': 1}
    migrations = [s for s in spark.statements if s.startswith('ALTER TABLE')]
    expected = [f'{column} {dtype}' for column, dtype in load_bench.COST_COLUMNS.items() if column not in existing_cost]
    assert migrations == ([f'ALTER TABLE secondhand.measures.bench_record ADD COLUMNS ({", ".join(expected)})'] if expected else [])
    read_rows, read_schema = spark.views['bench_load_read']
    assert [row['position'] for row in read_rows] == [0, 1]
    assert read_schema == SCHEMAS['read']
    merge = next(s for s in spark.statements if s.startswith('MERGE INTO secondhand.measures.bench_read '))
    for key in (*MERGE_KEYS['record'], 'position'):
        assert f't.{key} = s.{key}' in merge
    assert 'WHEN MATCHED THEN UPDATE SET * WHEN NOT MATCHED THEN INSERT *' in merge
    assert "WHEN NOT MATCHED BY SOURCE AND t.run_id = 'run1' THEN DELETE" in merge

    spark.statements.clear()
    path.write_text(json.dumps(BASE) + '\n')
    load_bench.main()
    assert not any(s.startswith('ALTER TABLE') for s in spark.statements), 'migration must be idempotent'
    assert spark.views['bench_load_read'][0] == [], 'reload without reads must merge an empty source to delete stale reads'
    assert any(s.startswith('MERGE INTO secondhand.measures.bench_read ') for s in spark.statements)

    spark.statements.clear()
    spark.columns = list(existing_cost)
    monkeypatch.setattr(sys, 'argv', ['load_bench', '--root', str(ROOT), '--migrate-only'])
    assert load_bench.main() == {'files': 0}
    assert not any(s.startswith('MERGE INTO') for s in spark.statements), 'migration must run before SQL creates bench_read and bench_cost'
    assert spark.columns == list(existing_cost) + [column for column in load_bench.COST_COLUMNS if column not in existing_cost]


def test_read_table_and_cost_columns_match_loader_schema_with_comments():
    sql = (ROOT / 'databricks/sql/06_bench.sql').read_text()
    for name in ('record', 'read'):
        table = re.search(rf'CREATE TABLE IF NOT EXISTS secondhand\.measures\.bench_{name} \((.*?)\n\)', sql, re.S)
        assert table, f'bench_{name} table must exist'
        columns = [line.strip().split(' COMMENT ')[0] for line in table[1].strip().splitlines()]
        assert columns == SCHEMAS[name].split(', '), f'bench_{name} columns must match loader order and types'
        assert all(' COMMENT ' in line for line in table[1].strip().splitlines())
