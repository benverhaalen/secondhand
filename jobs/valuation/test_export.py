import csv
import gzip
import hashlib
import json
import math
import subprocess
from pathlib import Path

import pytest

from param.registry import FIELDS
from valuation.export import build_rows, read_comps, main

NOW = '2026-11-15T12:00:00+00:00'
SPLIT_AT = '2019-01-01'
ROOT = Path(__file__).resolve().parents[2]


def comps(n=60):
    return [{'row_id': f'c{i}', 'source': 'nber_ebay_bo', 'kind': 'electronics', 'site': 'ebay',
             'may_model': True, 'listed_at': '2013-01-01', 'at': '2013-04-11',
             'price_type': 'sold' if i < 30 else 'ended_unsold'} for i in range(n)]


def estimates(n=30, contestant='engine_all_on'):
    return [{'item_id': f'e{i}', 'contestant': contestant, 'kind': 'electronics', 'site': None,
             'q10_cents': 100, 'q90_cents': 200, 'truth_cents': 150 if i < 23 else 400,
             'data': 'dataset:nber_ebay_bo', 'as_of': '2018-12-31'} for i in range(n)]


def build(cs=(), es=(), contestant='engine_all_on'):
    return build_rows(cs, es, contestant, NOW, 'run-test', 'abc123', split_at=SPLIT_AT)


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
                                          'split_at': SPLIT_AT, 'holdout_n': 0,
                                          'holdout_raw_coverage': None, 'holdout_coverage': None,
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
    assert build_rows([], es, 'engine_all_on', NOW, 'r', 'dev', split_at=SPLIT_AT, counts=counts)['params'] == []
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
    result = main(['--comps', str(path), '--estimates', str(es), '--split-at', SPLIT_AT, '--run-id', 'test-cli',
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


def test_estimates_without_split_at_exits_nonzero_naming_the_flag(tmp_path):
    result = subprocess.run([
        str(ROOT / '.venv/bin/python'), str(ROOT / 'jobs/valuation/export.py'),
        '--comps', str(tmp_path / 'rows.csv.gz'), '--estimates', str(tmp_path / 'estimates.jsonl'),
        '--run-id', 'missing-split', '--out', str(tmp_path / 'params.json'),
    ], capture_output=True, text=True)
    assert result.returncode != 0
    assert '--split-at' in result.stderr, 'missing split must be rejected before reading input files'


def test_wild_holdout_never_changes_the_fit_quantile():
    fit = [{**r, 'truth_cents': 200 * math.exp(i / 10)} for i, r in enumerate(estimates())]
    before = build(es=fit)['params'][0]['value_or_hyperparams']
    wild = {**fit[0], 'item_id': 'wild-holdout', 'as_of': '2019-02-01', 'truth_cents': 1e12}
    after = build(es=fit + [wild])['params'][0]['value_or_hyperparams']
    assert after['Q_g'] == before['Q_g'], 'holdout score leaked into the fit order statistic'
    assert after['n'] == before['n'] == 30
    assert after['hits'] == before['hits']


@pytest.mark.parametrize('widened_only', [75, 250])
def test_holdout_raw_and_widened_coverage_use_different_ranges(widened_only):
    holdout = [{**estimates(1)[0], 'item_id': f'h{i}', 'as_of': '2019-02-01', 'truth_cents': truth}
               for i, truth in enumerate([150, widened_only, 500])]
    value = build(es=estimates() + holdout)['params'][0]['value_or_hyperparams']
    assert value.get('holdout_n') == 3, 'holdout rows need their own denominator'
    assert value['holdout_raw_coverage'] == .3333, 'raw coverage must use the issued interval'
    assert value['holdout_coverage'] == .6667, 'widened coverage must apply exp(Q_g) on both ends'
    assert isinstance(value['holdout_raw_coverage'], float) and isinstance(value['holdout_coverage'], float)


def test_empty_holdout_reports_zero_rows_and_null_shares():
    value = build(es=estimates())['params'][0]['value_or_hyperparams']
    assert value.get('holdout_n') == 0, 'empty holdout must have an explicit zero count'
    assert value['holdout_raw_coverage'] is None
    assert value['holdout_coverage'] is None
    assert value['split_at'] == SPLIT_AT


def test_row_exactly_on_split_at_is_holdout_and_never_a_fit_hit():
    boundary = {**estimates(1)[0], 'item_id': 'boundary', 'as_of': SPLIT_AT}
    row = build(es=estimates() + [boundary])['params'][0]
    value = row['value_or_hyperparams']
    assert value['n'] == row['n_eff'] == 30, 'split-at belongs to holdout, not fit'
    assert value['hits'] == 23
    assert value['holdout_n'] == 1
    assert value['holdout_raw_coverage'] == value['holdout_coverage'] == 1.0


def test_ids_hash_changes_only_when_fit_ids_change():
    fit = estimates()
    holdout = {**fit[0], 'item_id': 'holdout', 'as_of': '2019-02-01'}
    before = build(es=fit + [holdout])['params'][0]['fitted_on_ids_hash']
    changed_holdout = build(es=fit + [{**holdout, 'item_id': 'other-holdout'}])['params'][0]
    assert changed_holdout['fitted_on_ids_hash'] == before, 'holdout ids leaked into fit lineage'
    changed_fit = [{**r, 'item_id': 'other-fit' if i == 0 else r['item_id']} for i, r in enumerate(fit)]
    after = build(es=changed_fit + [holdout])['params'][0]['fitted_on_ids_hash']
    assert after != before, 'fit id changes must change lineage'
    assert after == hashlib.sha256('\n'.join(sorted(r['item_id'] for r in changed_fit)).encode()).hexdigest()


def test_holdout_rows_cannot_satisfy_the_thirty_fit_row_floor():
    holdout = {**estimates(1)[0], 'item_id': 'holdout', 'as_of': SPLIT_AT}
    counts = {}
    out = build_rows([], estimates(29) + [holdout], 'engine_all_on', NOW, 'r', 'dev',
                     split_at=SPLIT_AT, counts=counts)
    assert out['params'] == [], 'group floor counts fit rows only'
    assert counts['omitted_calibration_groups'] == 1


@pytest.mark.parametrize('split_at', [None, '20190101', '2019-02-30', 'tomorrow'])
def test_build_rejects_missing_or_invalid_split_at(split_at):
    with pytest.raises(ValueError, match='--split-at'):
        build_rows([], estimates(), 'engine_all_on', NOW, 'r', 'dev', split_at=split_at)


def test_failed_cli_log_passes_the_log_contract(tmp_path):
    log = tmp_path / 'failed.jsonl'
    with pytest.raises(FileNotFoundError):
        main(['--comps', str(tmp_path / 'missing.csv.gz'), '--run-id', 'f',
              '--out', str(tmp_path / 'params.json')], log_path=log)
    checked = subprocess.run(['node', str(ROOT / 'spec/log.mjs'), str(log)], capture_output=True, text=True)
    assert checked.returncode == 0, checked.stdout + checked.stderr


@pytest.mark.parametrize('as_of', [None, 'not-a-date'])
def test_invalid_as_of_is_counted_and_enters_neither_split(as_of):
    invalid = {**estimates(1)[0], 'item_id': 'invalid-date', 'as_of': as_of}
    counts = {}
    out = build_rows([], estimates() + [invalid], 'engine_all_on', NOW, 'r', 'dev',
                     split_at=SPLIT_AT, counts=counts)
    value = out['params'][0]['value_or_hyperparams']
    assert counts.get('invalid_estimates') == 1, 'invalid as_of must be counted'
    assert value['n'] == 30 and value['holdout_n'] == 0, 'invalid as_of entered a split'


@pytest.mark.parametrize('as_of', ['2018-12-31T23:30:00-05:00', '2019-01-01T00:00:00Z', '2019-01-01'])
def test_time_split_uses_the_utc_date(as_of):
    boundary = {**estimates(1)[0], 'item_id': 'utc-boundary', 'as_of': as_of}
    value = build(es=estimates() + [boundary])['params'][0]['value_or_hyperparams']
    assert value['n'] == 30, 'UTC holdout leaked into fit'
    assert value['holdout_n'] == 1, 'UTC boundary must be holdout'


@pytest.mark.parametrize('stray_as_of', ['2018-12-31', '2019-01-01'])
def test_mixed_provenance_omits_only_its_calibration_group_and_writes_file(tmp_path, stray_as_of):
    path = tmp_path / 'rows.csv.gz'
    with gzip.open(path, 'wt', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=comps()[0])
        writer.writeheader()
        writer.writerows(comps())
    stray = {**estimates(1)[0], 'item_id': 'stray', 'data': 'dataset:other', 'as_of': stray_as_of}
    other = [{**r, 'kind': 'media', 'item_id': 'other-' + r['item_id']} for r in estimates()]
    es = tmp_path / 'estimates.jsonl'
    es.write_text('\n'.join(json.dumps(r) for r in estimates() + [stray] + other))
    out, log = tmp_path / 'params.json', tmp_path / 'export.jsonl'
    main(['--comps', str(path), '--estimates', str(es), '--split-at', SPLIT_AT,
          '--run-id', 'mixed', '--out', str(out)], log_path=log)
    rows = json.loads(out.read_text())['params']
    assert {(r['name'], r['scope']['kind']) for r in rows} == {
        ('valuation_sale_curve', 'electronics'), ('valuation_calibration', 'media')}
    events = [json.loads(line) for line in log.read_text().splitlines()]
    assert any(e.get('omitted_calibration_groups') == 1 for e in events)
    assert any(e.get('reason') == 'calibration scope must contain one dataset provenance'
               and e.get('scope') == {'kind': 'electronics', 'site': None} for e in events)
