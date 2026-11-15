"""Local contract: ./.venv/bin/python -m pytest databricks/tasks/test_backtest.py -q."""
import csv
import hashlib
import json
import sys
from datetime import datetime
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / 'databricks/tasks'), str(ROOT / 'jobs'), str(ROOT / 'log')]
import backtest as b
from valuation import experiment as e


def sale(row_id='test', at='2019-01-15', price=10001, **over):
    return {**dict.fromkeys(e.FIELDS), **e.FLAGS, 'row_id': row_id, 'source': 'synthetic',
            'at': at, 'price_cents': price, 'price_type': 'sold', 'kind': 'shoes',
            'site': 'stockx', 'product_id': 'shoe', **over}


def basis_hash(rows):
    return hashlib.sha256(json.dumps(sorted(rows, key=lambda r: r['id']), sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def citation_id(cite, digest):
    identity = {k: cite[k] for k in ('metric', 'filters', 'table_versions', 'definition_version',
                                    'code_version', 'param_versions', 'model_version')}
    identity['basis_hash'] = digest
    return 'cit_' + hashlib.sha256(json.dumps(identity, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def sample():
    rows = [sale('a', '2018-12-01'), sale('b', '2018-12-02', 10002), sale()]
    est = {'contestant': e.PRIMARY, 'item_id': 'test', 'as_of': '2019-01-14T00:00:00Z',
           'freeze_basis': 'sale_date_proxy', 'q10': 10001.1, 'q50': 10001.5, 'q90': 10001.9,
           'shown': True, 'comp_ids': ['a', 'b']}
    return {r['row_id']: r for r in rows}, est


def test_spark_adapter_matches_csv_loader_timestamps_flags_and_fields(tmp_path):
    raw = {'row_id': 'one', 'at': '2019-01-02T00:00:00Z', 'listed_at': '',
           'price_cents': '1234', 'may_model': '', 'at_ask': 'false', 'unrelated': 'discard'}
    path = tmp_path / 'rows.csv'
    with path.open('w') as f:
        w = csv.DictWriter(f, fieldnames=list(raw))
        w.writeheader()
        w.writerow(raw)
    spark_row = {**raw, 'at': datetime(2019, 1, 2), 'price_cents': 1234}
    assert b.to_runner_rows([spark_row]) == e.load(str(path))
    assert set(b.to_runner_rows([spark_row])[0]) == set(e.FIELDS)


def test_float_money_never_leaves_backtest_tables():
    rows, est = sample()
    records = b.estimates_table([est], rows, 'run')
    guarded, _ = b.guarded_rows([est], rows, basis_hash, citation_id, 'run', '2019-02-01')
    for record in records + guarded:
        assert all(type(v) is int for k, v in record.items() if k.endswith('_cents') and v is not None)
    assert records[0]['q50_cents'] == 10002


def test_guarded_number_shown_without_citation_id_cannot_be_written():
    rows, est = sample()
    guarded, citations = b.guarded_rows([est], rows, basis_hash, citation_id, 'run', '2019-02-01',
                                      meta={'code_sha': 'abc', 'table_versions': [{'table': 'secondhand.market.comp', 'version': 7}]})
    assert guarded[0]['citation_id'] == citations[0]['id']
    assert guarded[0]['state'] == 'shown'
    assert citations[0]['basis_hash'] == basis_hash([{'id': k, 'source': rows[k]['source'], 'at': rows[k]['at'] + 'T00:00:00.000Z', 'weight': 1, 'price_cents': rows[k]['price_cents']} for k in est['comp_ids']])
    assert json.loads(citations[0]['filters']) == {'source': 'synthetic', 'product_id': 'shoe'}
    assert json.loads(citations[0]['table_versions'])[0]['version'] == 7
    assert citations[0]['code_version'] == 'abc'
    assert citations[0]['computed_at'] == est['as_of']


def test_rerun_deduplicates_same_identity_but_keeps_different_metrics():
    rows, est = sample()
    guarded, citations = b.guarded_rows([est, {**est, 'contestant': 'last_sale'}], rows, basis_hash, citation_id, 'run', '2019-02-01')
    assert len(citations) == 2
    assert len(guarded) == 2
    assert guarded[0]['citation_id'] != guarded[1]['citation_id']
    assert len(b.new_citations(citations + citations, set())) == 2
    assert b.new_citations(citations, {c['id'] for c in citations}) == []


def test_hidden_comp_estimate_keeps_basis_but_not_display_citation():
    rows, est = sample()
    guarded, citations = b.guarded_rows([{**est, 'shown': False}], rows, basis_hash, citation_id, 'run', '2019-02-01')
    assert citations
    assert guarded[0]['state'] == 'hidden'
    assert guarded[0]['citation_id'] is None
    assert guarded[0]['hide_reason'] == 'too_few'  # baseline never hides a nonempty basis: ambiguous reason
    assert b.guarded_rows([{**est, 'contestant': 'model', 'comp_ids': []}], rows, basis_hash, citation_id, 'run', '2019-02-01') == ([], [])
    for key in ['c', 'd', 'e']:
        rows[key] = sale(key, '2018-12-04')
    random_hidden = {**est, 'contestant': 'random_comps', 'shown': False, 'comp_ids': ['a', 'b', 'c', 'd', 'e']}
    guarded, _ = b.guarded_rows([random_hidden], rows, basis_hash, citation_id, 'run', '2019-02-01')
    assert guarded[0]['hide_reason'] == 'too_few', 'an impossible baseline hide has no distinguishable width reason'


def test_measures_rows_without_data_are_impossible_and_score_keys_are_real():
    rows, est = sample()
    report = e.score([est, {**est, 'contestant': 'model', 'comp_ids': []}], list(rows.values()))
    meta = {'run_id': 'run', 'source': 'synthetic', 'test_from': '2019-01-01', 'test_to': None,
            'rows_hash': 'hash', 'code_sha': 'sha', 'started_at': '2019-02-01', 'ended_at': '2019-02-01',
            'mlflow_run_id': 'mlf', 'uncited_contestants': {'model': 1}}
    run, heads = b.run_table(report, meta)
    estimates = b.estimates_table([est], rows, 'run')
    assert all(r['data'] == 'synthetic' for r in [run] + heads + estimates)
    assert heads[0]['median_ape'] == report['contestants'][e.PRIMARY]['overall']['median_pct_off']
    assert heads[1]['lift_vs_primary'] == report['contestants']['model']['lift_vs_primary']['diff']
    assert heads[0]['lift_vs_primary'] is None
    assert json.loads(run['report'])['uncited_contestants'] == {'model': 1}
    public = b.estimates_table([est], {k: {**v, 'source': 'stockx_2019'} for k, v in rows.items()}, 'run')
    assert public[0]['data'] == 'dataset:stockx_2019'
    assert b.provenance('live:stockx') == 'live:stockx'


def test_frozen_fit_never_reads_sale_on_or_after_month():
    class Spy(e.ProductMedian):
        def fit(self, training):
            assert all(e.ts(r['at']) < e.ts('2019-01-01') for r in training), 'fit leaked a sale from scoring month'
    rows = [sale('old', '2018-12-01'), sale('future', '2019-02-01'), sale()]
    estimates = e.run(rows, [Spy()], test_from='2019-01-01', test_to='2019-02-01')
    assert estimates[0]['comp_ids'] == ['old']


def test_stockx_timestamp_adapter_preserves_csv_date_granularity():
    row = b.to_runner_rows([{'comp_id': 'one', 'source': 'stockx_2019', 'sold_at': datetime(2019, 1, 2),
                             'price_cents': 12345, 'price_type': 'sold'}])[0]
    assert row['at'] == '2019-01-02'
    assert row['row_id'] == 'one'


def test_learning_schema_accepts_all_emitted_measure_columns_with_provenance():
    import re
    sql = (ROOT / 'databricks/sql/04_learning.sql').read_text()
    rows, est = sample()
    report = e.score([est], list(rows.values()))
    run, headlines = b.run_table(report, {'run_id': 'r', 'source': 'stockx_2019'})
    for name, records in [('backtest_run', [run]), ('backtest_headline', headlines),
                          ('backtest_estimate', b.estimates_table([est], rows, 'r'))]:
        body = re.search(rf'CREATE TABLE IF NOT EXISTS secondhand.measures.{name} \((.*?)\n\)', sql, re.S)[1]
        columns = {re.match(r'\s*(\w+)', line)[1] for line in body.strip().splitlines()}
        assert columns == set(records[0]), f'{name} schema loses an emitted column'
        assert 'data STRING NOT NULL' in body
        assert all(' COMMENT ' in line for line in body.strip().splitlines())


def test_comp_commit_during_view_read_refuses_false_citation_version():
    b.require_snapshot_version(7, 7)
    with pytest.raises(ValueError, match='changed during read'):
        b.require_snapshot_version(7, 8)


def test_delta_frame_converts_parameter_values_to_declared_double_and_utc_timestamp():
    from types import SimpleNamespace as NS
    class FrameBoundary:
        def createDataFrame(self, rows, schema):
            assert type(rows[0]['value']) is float, 'Spark DoubleType rejects Python int parameter values'
            assert rows[0]['as_of'] == datetime(2019, 1, 1, 6), 'Delta timestamp lost UTC offset'
            return rows
    class Type:
        def __init__(self, kind):
            self.kind = kind
        def typeName(self):
            return self.kind
    spark = FrameBoundary()
    spark.table = lambda name: NS(schema=[NS(name='value', dataType=Type('double')),
                                          NS(name='as_of', dataType=Type('timestamp'))])
    b.table_frame(spark, 'param_moves', [{'value': 90, 'as_of': '2019-01-01T00:00:00-06:00'}])


def test_serverless_backtest_has_no_file_global(serverless_entrypoint):
    serverless_entrypoint('databricks/tasks/backtest.py', ['--root', str(ROOT)])


def test_core_proof_rows_carry_current_schema_data_column():
    rows, est = sample()
    guards, citations = b.guarded_rows([est], rows, basis_hash, citation_id, 'run', '2019-02-01')
    assert guards[0]['data'] == citations[0]['data'] == 'synthetic'
    public = {k: {**v, 'source': 'stockx_2019'} for k, v in rows.items()}
    guards, citations = b.guarded_rows([est], public, basis_hash, citation_id, 'run', '2019-02-01')
    assert guards[0]['data'] == citations[0]['data'] == 'dataset:stockx_2019'


def test_hash_receives_full_basis_with_javascript_utc_milliseconds():
    rows, est = sample()
    rows['a']['at'] = '2018-12-01T18:00:00.123987-06:00'
    rows['b']['at'] = datetime(2018, 12, 2)
    expected = [{'id': 'a', 'source': 'synthetic', 'at': '2018-12-02T00:00:00.123Z', 'weight': 1, 'price_cents': 10001},
                {'id': 'b', 'source': 'synthetic', 'at': '2018-12-02T00:00:00.000Z', 'weight': 1, 'price_cents': 10002}]
    def check_basis(basis):
        assert basis == expected
        assert all(type(r['weight']) is type(r['price_cents']) is int for r in basis)
        return basis_hash(basis)
    seen = []
    def check_identity(cite, digest):
        assert isinstance(cite['filters'], dict), 'hash the JSON objects before serializing Delta STRING fields'
        assert isinstance(cite['table_versions'], list)
        assert cite['param_versions'] == {}
        seen.append(cite)
        return citation_id(cite, digest)
    guards, citations = b.guarded_rows([est], rows, check_basis, check_identity, 'run', '2019-02-01')
    assert guards[0]['citation_id'] == citation_id(seen[0], basis_hash(expected))
    assert citations[0]['basis_hash'] == basis_hash(expected)


def test_citation_identity_changes_with_versions_filters_and_source():
    rows, est = sample()
    def identity(*, source='synthetic', product='shoe', version=1, code='abc'):
        changed = {k: {**v, 'source': source, 'product_id': product} for k, v in rows.items()}
        _, citations = b.guarded_rows([est], changed, basis_hash, citation_id, 'run', '2019-02-01',
                                     meta={'code_sha': code, 'table_versions': [{'table': 'secondhand.market.comp', 'version': version}]})
        return citations[0]['id']
    assert len({identity(), identity(source='stockx_2019'), identity(product='other'), identity(version=2), identity(code='def')}) == 5


def test_mlflow_input_records_exact_integer_delta_version():
    from types import SimpleNamespace as NS
    calls = []
    ds = object()
    def load_delta(**kwargs):
        calls.append(('load', kwargs))
        return ds
    def log_input(dataset, **kwargs):
        assert dataset is ds
        calls.append(('input', kwargs))
    def set_tags(tags):
        calls.append(('tags', tags))
    class Log:
        def call(self, kind, name, fields, fn):
            return fn()
    b.log_training_input(NS(data=NS(load_delta=load_delta), log_input=log_input, set_tags=set_tags), Log(), '7')
    assert calls == [('load', {'table_name': 'secondhand.market.comp', 'version': 7, 'name': 'comp_for_model'}),
                     ('input', {'context': 'training'}),
                     ('tags', {'input_filter': 'may_model = true', 'input_view': 'secondhand.market.comp_for_model'})]


def test_learning_setup_maps_backtest_owner_idempotently():
    sql = ' '.join((ROOT / 'databricks/sql/04_learning.sql').read_text().split())
    assert "INSERT INTO secondhand.governance.principal_map SELECT current_user(), 'usr_backtest' WHERE NOT EXISTS (SELECT 1 FROM secondhand.governance.principal_map WHERE principal = current_user() AND user_id = 'usr_backtest')" in sql


def test_serverless_bundle_passes_workspace_root_to_both_jobs():
    import re
    bundle = (ROOT / 'deploy/resources/learning.yml').read_text()
    for name in ('valuation_backtest', 'param_walk'):
        job = re.search(rf'^    {name}:\n(.*?)(?=^    \w+:|\Z)', bundle, re.M | re.S)[1]
        assert 'parameters: [--root, "${workspace.file_path}",' in job
        assert 'environment_key: learning' in job
        assert 'new_cluster' not in job and 'existing_cluster_id' not in job
        assert '--contestants' not in job


def test_current_market_model_cited_hides_distinguish_count_from_width():
    rows, est = sample()
    for i in range(8):
        rows[str(i)] = sale(str(i), '2018-12-15')
    cited = {**est, 'contestant': 'model', 'shown': False, 'q10': 1000, 'q90': 40000}
    guards, _ = b.guarded_rows([cited], rows, basis_hash, citation_id, 'run', '2019-02-01')
    assert guards[0]['hide_reason'] == 'too_wide'
    rows = {k: v for k, v in rows.items() if k in ('a', 'b', 'test')}
    guards, _ = b.guarded_rows([cited], rows, basis_hash, citation_id, 'run', '2019-02-01')
    assert guards[0]['hide_reason'] == 'too_few'
