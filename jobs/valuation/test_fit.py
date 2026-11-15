import numpy as np
import pytest
from valuation.fit import switch_rule, fit_quantiles, fit_cure, fit_weights, calibrate, publish
from param.registry import MemoryStore


def report(error=.1, coverage=.8):
    return {'overall': {'q50_median_error': error}, 'cells': [
        {'group': 'jacket', 'price_band': '25_to_100', 'passes': True,
         'coverage': coverage, 'q50_median_error': error}]}


def test_worse_model_keeps_champion():
    assert switch_rule(report(), report(.12)) == (False, 'kept: median error')


def test_coverage_drop_fails_even_when_error_improves():
    assert switch_rule(report(), report(.08, .74)) == (False, 'fail: coverage')


def test_missing_or_regressing_cell_cannot_promote():
    old = report(.2)
    new = report(.1)
    old['cells'][0]['q50_median_error'] = .05
    assert not switch_rule(old, new)[0]
    new['cells'] = []
    assert not switch_rule(old, new)[0]


def test_one_point_improvement_can_promote_through_registry():
    store = MemoryStore()
    assert publish(store, {}, {'uri': 'local:model'}, report(.2), report(.18), '2026-11-15')[0]
    assert store.champion('valuation', {})['held_out_score'] == -.18


def test_conformal_widens_from_independent_scores():
    q = calibrate(np.array([[40, 48, 58]] * 10), np.array([39] * 10), np.ones(10))
    assert q == 1


def test_censored_rows_fit_a_monotone_cure_curve():
    model = fit_cure(np.ones((8, 1)), [2, 3, 5, 8, 12, 20, 30, 45], [1, 1, 1, 1, 0, 0, 0, 0])
    p = [model.probability([1], d) for d in [0, 7, 30, 90]]
    assert p[0] == 0 and p == sorted(p) and p[-1] < 1


def test_d1_coordinate_descent_respects_prior_guards():
    got = fit_weights({'w_extract': .7}, lambda w: (w['w_extract'] - 9) ** 2)
    assert .35 <= got['w_extract'] <= 1.05


def test_forbidden_training_row_is_refused_before_lightgbm_import():
    with pytest.raises(ValueError, match='may_model'):
        fit_quantiles([{'features': [1], 'price_cents': 40, 'may_model': False}])


def test_quantile_dependency_has_explicit_local_failure():
    import importlib.util
    if importlib.util.find_spec('lightgbm') is None:
        with pytest.raises(ModuleNotFoundError, match='lightgbm'):
            fit_quantiles([{'features': [1], 'price_cents': 40}])


def nightly_rows():
    from datetime import datetime, timedelta, timezone
    rng = np.random.default_rng(31)
    start = datetime(2025, 11, 15, tzinfo=timezone.utc)
    return [{'comp_id': f'n{i}', 'price_type': 'sold', 'category': 'jacket',
             'brand': 'a' if i % 2 else 'b', 'condition': 'good', 'site': 'ebay',
             'price_cents': round(5000 * np.exp((.2 if i % 2 else -.2) + rng.normal(0, .1))),
             'at': (start + timedelta(days=i * 365 / 2500)).isoformat()}
            for i in range(2500)]


class LocalRow(dict):
    def asDict(self):
        return dict(self)


class LocalTable:
    def __init__(self, spark, rows):
        self.spark, self.rows = spark, rows
        self.write = self

    def collect(self):
        return [LocalRow(r) for r in self.rows]

    def mode(self, mode):
        assert mode == 'append'
        return self

    def saveAsTable(self, name):
        self.spark.tables.setdefault(name, []).extend(self.rows)

    def createOrReplaceTempView(self, name):
        self.spark.views[name] = self.rows


class LocalSpark:
    def __init__(self, rows):
        self.tables = {'workspace.secondhand.comp': rows}
        self.views = {}
        self.catalog = self

    def tableExists(self, name):
        return name in self.tables

    def createDataFrame(self, rows, schema=None):
        return LocalTable(self, rows)

    def sql(self, query):
        if query.lstrip().startswith('MERGE INTO'):
            target = query.split()[2]
            for row in self.views['valuation_param_update']:
                existing = self.tables[target]
                existing[:] = [r for r in existing if (r['name'], r['scope'], r['version']) != (row['name'], row['scope'], row['version'])]
                existing.append(row)
            return LocalTable(self, [])
        if '.param' in query:
            return LocalTable(self, self.tables.get('workspace.secondhand.param', []))
        return LocalTable(self, self.tables['workspace.secondhand.comp'])


def run_main(monkeypatch, spark, log):
    import sys
    import types
    from valuation import fit as job
    session = types.SimpleNamespace(getActiveSession=lambda: spark)
    monkeypatch.setitem(sys.modules, 'pyspark.sql', types.SimpleNamespace(SparkSession=session))
    monkeypatch.setattr(job, '_log', lambda: log)
    return job.main()


def test_nightly_main_computes_cells_and_persists_only_a_held_out_win(monkeypatch, log_lines):
    import json
    log, _ = log_lines
    spark = LocalSpark(nightly_rows())
    out = run_main(monkeypatch, spark, log)
    assert out['promotion']['promoted'], out
    assert out['promotion']['report']['cells']
    assert all(c['passes'] and .75 <= c['coverage'] <= .85 for c in out['promotion']['report']['cells'])
    registry = spark.tables['workspace.secondhand.param']
    champion = next(r for r in registry if r['status'] == 'champion')
    payload = json.loads(champion['value_or_hyperparams'])
    assert max(r['at'] for r in payload['sold']) < out['promotion']['held_out_from']
    again = run_main(monkeypatch, spark, log)
    assert not again['promotion']['promoted'], 'equal model cannot replace the persisted champion'
    assert next(r for r in registry if r['status'] == 'champion')['version'] == champion['version']


def test_nightly_main_keeps_champion_when_coverage_breaks(monkeypatch, log_lines):
    log, _ = log_lines
    spark = LocalSpark(nightly_rows())
    first = run_main(monkeypatch, spark, log)
    assert first['promotion']['promoted']
    import copy
    before = copy.deepcopy(spark.tables['workspace.secondhand.param'])
    cutoff = first['promotion']['held_out_from']
    for r in spark.tables['workspace.secondhand.comp']:
        if r['at'] >= cutoff:
            r['price_cents'] *= 2
    out = run_main(monkeypatch, spark, log)
    assert out['promotion']['reason'] == 'fail: coverage'
    assert spark.tables['workspace.secondhand.param'] == before


@pytest.mark.parametrize('owner', ['other', None])
def test_person_scoped_valuation_refuses_other_peoples_comps(owner):
    from valuation.fit import nightly
    rows = [{**r, 'person': 'owner'} for r in nightly_rows()]
    rows[0]['person'] = owner
    store = MemoryStore()
    with pytest.raises(ValueError, match='person scope'):
        nightly(rows, store, {'person': 'owner'}, '2026-11-15T00:00:00Z')
    assert not store.rows


def test_person_scoped_valuation_uses_only_its_own_rows():
    from valuation.fit import nightly
    rows = [{**r, 'person': 'owner'} for r in nightly_rows()]
    store = MemoryStore()
    result = nightly(rows, store, {'person': 'owner'}, '2026-11-15T00:00:00Z')
    assert result['promoted']
    assert store.champion('valuation', {}) is None
    assert store.champion('valuation', {'person': 'other'}) is None


def test_current_valuation_win_is_not_blocked_by_historical_champion_score():
    from valuation.fit import model_payload, nightly
    from valuation import market
    rows = nightly_rows()
    training = [r for r in rows if r['at'] < '2026-08-01']
    bad = market.fit(training)
    bad.hedonic.beta[0] += .15
    store = MemoryStore()
    row = store.propose({'name': 'valuation', 'scope': {}, 'family': 'model_ref',
                         'value_or_hyperparams': model_payload(bad), 'held_out_score': 0}, 0)
    store.promote('valuation', {}, row['version'], 0, '2026-11-14')
    result = nightly(rows, store, {}, '2026-11-15T00:00:00Z')
    assert result['promoted'], result


def test_nightly_report_cannot_omit_the_stronger_90_day_family_baseline():
    import math
    from datetime import datetime, timedelta, timezone
    from valuation.fit import held_out_report
    from valuation import market
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    training = [{'comp_id': f'past{i}', 'price_type': 'sold', 'price_cents': 4000, 'category': 'jacket',
                 'family_id': 'sweater', 'brand': 'fixture', 'at': (start + timedelta(days=i)).isoformat()}
                for i in range(40)]
    model = market.fit(training)
    model.hedonic.beta[0] += math.log(5250 / 4000)
    model.widen = {'*': .2}
    held = [{**training[0], 'comp_id': f'held{i}', 'price_cents': 7000 if i % 5 == 4 else 5000,
             'at': (start + timedelta(days=200 + i / 10)).isoformat()} for i in range(150)]
    report = held_out_report(model, training, held)
    assert report['cells'][0]['coverage'] == .8
    assert report['baselines']['family_90_day_median']['overall']['q50_median_error'] == 0
    assert not report['cells'][0]['passes'], 'coverage alone cannot beat the stronger family baseline'
