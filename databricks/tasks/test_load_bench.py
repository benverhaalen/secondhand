import json
from pathlib import Path

from tasks.load_bench import parse, MERGE_KEYS

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
           {**BASE, 'sites': ['ebay', 'ebay']}, BASE, BASE]
    result = parse([json.dumps(r) for r in bad])
    assert len(result.records) == 1 and len(result.rejects) == 4
    assert 'full_at' in result.rejects[0]['reason']
    assert 'value_cents' in result.rejects[1]['reason']
    assert 'duplicate' in result.rejects[2]['reason'] and 'duplicate' in result.rejects[3]['reason']
    for table, rows in [('record', result.records), ('number', result.numbers), ('fact', result.facts), ('site', result.sites)]:
        keys = [tuple(row[k] for k in MERGE_KEYS[table]) for row in rows]
        assert len(keys) == len(set(keys))


def test_sql_speed_uses_percentiles_not_average():
    sql = (ROOT / 'databricks/sql/06_bench.sql').read_text().lower()
    speed = sql.split('view secondhand.measures.bench_speed', 1)[1].split(';', 1)[0]
    assert 'avg(' not in speed and speed.count('percentile_cont') >= 4
