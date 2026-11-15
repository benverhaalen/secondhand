import csv
import gzip
import hashlib
import json
import math
from pathlib import Path

import pytest

from param.registry import FIELDS
from valuation.export import build_rows, read_comps, main

NOW = '2026-11-15T12:00:00+00:00'
ROOT = Path(__file__).resolve().parents[2]


def comps(n=60):
    return [{'row_id': f'c{i}', 'source': 'nber_ebay_bo', 'kind': 'electronics', 'site': 'ebay',
             'may_model': True, 'listed_at': '2013-01-01', 'at': '2013-04-11',
             'price_type': 'sold' if i < 30 else 'ended_unsold'} for i in range(n)]


def estimates(n=30, contestant='engine_all_on'):
    return [{'item_id': f'e{i}', 'contestant': contestant, 'kind': 'electronics', 'site': None,
             'q10_cents': 100, 'q90_cents': 200, 'truth_cents': 150 if i < 23 else 400,
             'data': 'dataset:nber_ebay_bo'} for i in range(n)]


def build(cs=(), es=(), contestant='engine_all_on'):
    return build_rows(cs, es, contestant, NOW, 'run-test', 'abc123')


def test_envelope_and_every_param_match_the_shared_contract():
    out = build(comps(), estimates())
    assert set(out) == {'version', 'exported_at', 'run_id', 'code_version', 'params'}
    assert {k: v for k, v in out.items() if k != 'params'} == {
        'version': 1, 'exported_at': NOW, 'run_id': 'run-test', 'code_version': 'abc123'}
    assert {r['name'] for r in out['params']} == {'valuation_sale_curve', 'valuation_calibration'}
    fixture = json.loads((ROOT / 'app/src/engines/param/row.json').read_text())
    for row in out['params']:
        assert set(row) == set(fixture) == set(FIELDS)
        assert row['scope'] == {'kind': 'electronics', 'site': 'ebay' if row['name'] == 'valuation_sale_curve' else None}
        assert row['family'] == 'model_ref' and row['status'] == 'champion'
        assert row['origin'] == 'fit' and row['version'] == 1 and row['frozen'] is False
        assert row['promoted_at'] == NOW
        assert row['held_out_score'] is row['guard_lo'] is row['guard_hi'] is None
        assert row['value_or_hyperparams']['fitted_on'] == 'dataset:nber_ebay_bo'
        assert row['value_or_hyperparams']['use_scope'] == 'hackathon_demo'
    sale = next(r for r in out['params'] if r['name'] == 'valuation_sale_curve')
    assert sale['n_eff'] == 60
    assert sale['fitted_on_ids_hash'] == hashlib.sha256('\n'.join(sorted(r['row_id'] for r in comps())).encode()).hexdigest()
    assert sale['value_or_hyperparams'] == {
        'reference': 'median_adjusted_sold', 'days': [7, 30, 90], 'bins': [{'ratio': 1.0, 'p': [0, 0, 0]}],
        't': [100, 100, None], 'n_events': 30, 'calibration_error': 0,
        'price_blind': True, 'fitted_on': 'dataset:nber_ebay_bo', 'use_scope': 'hackathon_demo'}


def test_conformal_uses_finite_sample_order_statistic_and_counts_hits():
    row = build(es=estimates())['params'][0]
    assert row['n_eff'] == 30
    assert row['fitted_on_ids_hash'] == hashlib.sha256('\n'.join(sorted(r['item_id'] for r in estimates())).encode()).hexdigest()
    assert row['value_or_hyperparams'] == {'Q_g': pytest.approx(math.log(2)), 'n': 30, 'hits': 23, 'nominal': .8,
                                          'fitted_on': 'dataset:nber_ebay_bo', 'use_scope': 'hackathon_demo'}


def test_conformal_rank_is_ceil_n_plus_one_times_nominal():
    es = estimates()
    for i, row in enumerate(es):
        row['truth_cents'] = 200 * math.exp(i / 10)
    assert build(es=es)['params'][0]['value_or_hyperparams']['Q_g'] == pytest.approx(2.4)


def test_no_calibration_fallback_to_an_unserved_contestant():
    assert build(es=estimates(contestant='market_model'))['params'] == []
    assert len(build(es=estimates(contestant='market_model'), contestant='market_model')['params']) == 1


def test_invalid_ranges_are_skipped_counted_and_cannot_pass_the_group_floor():
    es = estimates(29)
    for field, value in [('q10_cents', None), ('q90_cents', 0), ('truth_cents', -1), ('truth_cents', float('nan'))]:
        es.append({**estimates(1)[0], field: value})
    counts = {}
    assert build_rows([], es, 'engine_all_on', NOW, 'r', 'dev', counts=counts)['params'] == []
    assert counts['invalid_estimates'] == 4


def test_only_model_allowed_sold_or_ended_rows_with_both_dates_count():
    for value in [False, 'False', None, '']:
        cs = comps()
        cs[0]['may_model'] = value
        assert build(cs)['params'] == []
    for field, value in [('listed_at', None), ('at', ''), ('price_type', 'asking')]:
        cs = comps()
        cs[0][field] = value
        assert build(cs)['params'] == []


def test_csv_gzip_and_cli_use_frozen_booleans_and_jsonl(tmp_path):
    path = tmp_path / 'rows.csv.gz'
    with gzip.open(path, 'wt', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=comps()[0])
        writer.writeheader()
        writer.writerows(comps())
    assert len(read_comps(path)) == 60
    es = tmp_path / 'estimates.jsonl'
    es.write_text('\n'.join(json.dumps(r) for r in estimates()))
    out = tmp_path / 'params.json'
    log = tmp_path / 'export.jsonl'
    result = main(['--comps', str(path), '--estimates', str(es), '--run-id', 'test-cli',
                   '--out', str(out)], log_path=log)
    assert json.loads(out.read_text()) == result
    assert len(result['params']) == 2
    assert 'call.start' in log.read_text() and 'session.end' in log.read_text()


def test_permutation_does_not_change_the_export():
    assert build(comps(), estimates()) == build(list(reversed(comps())), list(reversed(estimates())))


def test_forbidden_rows_never_enter_a_valid_groups_count_or_hash():
    forbidden = {**comps(1)[0], 'row_id': 'forbidden', 'may_model': 'False'}
    assert build(comps() + [forbidden]) == build(comps())


def test_scopes_are_fitted_independently_and_unsupported_horizon_stays_null():
    cs = [{**r, 'at': '2013-02-01'} for r in comps()]
    cs += [{**r, 'row_id': 'other-' + r['row_id'], 'kind': 'media'} for r in cs]
    rows = build(cs)['params']
    assert {r['scope']['kind'] for r in rows} == {'electronics', 'media'}
    assert all(r['n_eff'] == 60 and r['value_or_hyperparams']['bins'][0]['p'] == [0, 0, None] for r in rows)


def test_calibration_hits_include_both_issued_endpoints():
    es = estimates()
    for i, row in enumerate(es):
        row['truth_cents'] = 100 if i % 2 else 200
    value = build(es=es)['params'][0]['value_or_hyperparams']
    assert value['hits'] == 30 and value['Q_g'] == 0
