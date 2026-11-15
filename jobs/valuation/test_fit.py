import ast
import json
import re
from pathlib import Path

import numpy as np
import pytest
from valuation.fit import switch_rule, fit_quantiles, fit_cure, fit_weights, calibrate, publish
from param.registry import FIELDS, MemoryStore, scope_key

ROOT = Path(__file__).resolve().parents[2]
CATALOG = "secondhand"
REGISTRY = f"{CATALOG}.core.param"
COMPS = f"{CATALOG}.market.comp_for_product"
MISSING_COLUMNS = {"origin": "STRING", "previous_version": "INT", "keep": "STRING", "days_since_last": "DOUBLE"}


def registry_columns():
    sql = (ROOT / "databricks/sql/01_tables.sql").read_text()
    body = sql.split("CREATE TABLE IF NOT EXISTS secondhand.core.param (", 1)[1].split(") COMMENT", 1)[0]
    body = re.sub(r"'([^']|'')*'", "", body)
    return dict(re.findall(r"(?:^|,)\s*(\w+)\s+(STRING|INT|DOUBLE|BOOLEAN|TIMESTAMP)\b", body))


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
    def __init__(self, spark, rows, columns=()):
        self.spark, self.rows, self.columns = spark, rows, columns
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
    def __init__(self, rows, missing=()):
        self.tables = {COMPS: rows, REGISTRY: []}
        self.columns = {k: v for k, v in registry_columns().items() if k not in missing}
        self.views = {}
        self.queries = []
        self.frames = []
        self.catalog = self

    def tableExists(self, name):
        return name in self.tables

    def table(self, name):
        assert name == REGISTRY, 'migration must inspect the governed registry'
        return LocalTable(self, self.tables[name], list(self.columns))

    def createDataFrame(self, rows, schema=None):
        self.frames.append((rows, schema))
        return LocalTable(self, rows)

    def sql(self, query):
        self.queries.append(query)
        if query.lstrip().startswith('ALTER TABLE'):
            assert query.split()[2] == REGISTRY
            added = re.search(r'ADD COLUMNS \((.*?)\)', query, re.S)[1]
            for column in added.split(','):
                name, dtype = column.strip().split()
                assert name not in self.columns, f'column already exists: {name}'
                self.columns[name] = dtype
            return LocalTable(self, [])
        if query.lstrip().startswith('MERGE INTO'):
            target = query.split()[2]
            assert target == REGISTRY
            for row in self.views['valuation_param_update']:
                existing = self.tables[target]
                existing[:] = [r for r in existing if (r['name'], r['scope'], r['version']) != (row['name'], row['scope'], row['version'])]
                existing.append(row)
            return LocalTable(self, [])
        if query.startswith(f'SELECT * FROM {REGISTRY}'):
            return LocalTable(self, self.tables[REGISTRY])
        assert f'FROM {COMPS} c' in query, 'fit must read only the product-cleared view'
        assert f'JOIN {CATALOG}.market.product p' in query
        return LocalTable(self, self.tables[COMPS])


def run_main(monkeypatch, spark, log, configure=None):
    import importlib
    import sys
    import types
    from valuation import fit as job
    monkeypatch.setenv('SECONDHAND_CATALOG', CATALOG)
    monkeypatch.setenv('SECONDHAND_SCHEMA', 'market')
    importlib.reload(job)
    session = types.SimpleNamespace(getActiveSession=lambda: spark)
    monkeypatch.setitem(sys.modules, 'pyspark.sql', types.SimpleNamespace(SparkSession=session))
    monkeypatch.setattr(job, '_log', lambda: log)
    if configure:
        configure(job)
    return job.main()


def test_nightly_main_computes_cells_and_persists_only_a_held_out_win(monkeypatch, log_lines):
    import json
    log, _ = log_lines
    spark = LocalSpark(nightly_rows())
    out = run_main(monkeypatch, spark, log)
    assert out['promotion']['promoted'], out
    assert out['promotion']['report']['cells']
    assert all(c['passes'] and .75 <= c['coverage'] <= .85 for c in out['promotion']['report']['cells'])
    registry = spark.tables[REGISTRY]
    champion = next(r for r in registry if r['status'] == 'champion')
    payload = json.loads(champion['value_or_hyperparams'])
    assert champion['n_eff'] == float(len(payload['sold'])) > 0, 'core.param requires the fitted basis as n_eff'
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
    before = copy.deepcopy(spark.tables[REGISTRY])
    cutoff = first['promotion']['held_out_from']
    for r in spark.tables[COMPS]:
        if r['at'] >= cutoff:
            r['price_cents'] *= 2
    out = run_main(monkeypatch, spark, log)
    assert out['promotion']['reason'] == 'fail: coverage'
    assert spark.tables[REGISTRY] == before


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


def test_fit_sql_never_reads_bare_comps():
    from valuation import fit as job
    source = Path(job.__file__).read_text()
    assert not re.search(r'\.comp\b(?!_for_)', source), 'fit names the bare comp table'
    assert 'comp_for_product' in job.ROWS_SQL, 'ROWS_SQL must read the product-cleared view'


def test_jobs_name_the_governed_registry_once():
    names = []
    for path in (ROOT / 'jobs').rglob('*.py'):
        if path.name.startswith('test_') or path.name in ('conftest.py',):
            continue
        for node in ast.walk(ast.parse(path.read_text())):
            if isinstance(node, ast.Constant) and isinstance(node.value, str):
                names.extend((path.relative_to(ROOT), name) for name in re.findall(r'(?:\.\w+)*\.param\b', node.value))
    assert len(names) == 1, f'registry table must be named once across jobs: {names}'
    assert names[0] == (Path('jobs/valuation/fit.py'), '.core.param'), names


def test_empty_product_cleared_view_skips_without_writing(monkeypatch, log_lines):
    log, lines = log_lines
    spark = LocalSpark([], missing=MISSING_COLUMNS)
    assert run_main(monkeypatch, spark, log) == {
        'state': 'skipped', 'why': 'no rows cleared for a shipped model'}
    assert not spark.frames, 'empty cleared input must not write any rows'
    assert not any(q.lstrip().startswith(('ALTER', 'MERGE')) for q in spark.queries)
    assert not spark.tables[REGISTRY]
    assert any(line.get('skipped') == 'no rows cleared for a shipped model' for line in lines)


@pytest.mark.parametrize('missing', [tuple(MISSING_COLUMNS), ('previous_version', 'keep'), ()])
def test_promotion_merges_exact_governed_columns_and_adds_only_missing(monkeypatch, log_lines, missing):
    log, _ = log_lines
    spark = LocalSpark(nightly_rows(), missing=missing)
    out = run_main(monkeypatch, spark, log)
    assert out['promotion']['promoted'], out
    merges = [q for q in spark.queries if q.lstrip().startswith('MERGE INTO')]
    assert len(merges) == 1
    merge = merges[0]
    assert merge.split()[2] == REGISTRY
    assert not re.search(r'(?:SET|INSERT)\s+\*', merge), 'wildcard writes drift from governed columns'
    inserted = re.search(r'WHEN NOT MATCHED THEN INSERT\s*\((.*?)\)', merge, re.S)[1]
    columns = [c.strip() for c in inserted.split(',')]
    assert columns == list(registry_columns()), 'MERGE columns differ from the core.param CREATE TABLE'
    updated = re.search(r'WHEN MATCHED THEN UPDATE SET(.*?)WHEN NOT MATCHED', merge, re.S)[1]
    assignments = dict(re.findall(r'(?:t\.)?(\w+)\s*=\s*([^,]+)', updated))
    assert set(assignments) == set(columns), 'UPDATE must name every governed column'
    for name in ('created_at', 'updated_at'):
        assert assignments[name].strip() == 'current_timestamp()'
    assert assignments['user_id'].strip() == 'NULL'
    assert assignments['moved_by'].strip() == "'promote nightly_fits valuation'"
    assert assignments['promoted_at'].strip() == 'CAST(s.promoted_at AS TIMESTAMP)'
    alters = [q for q in spark.queries if q.lstrip().startswith('ALTER TABLE')]
    assert len(alters) == bool(missing), 'only a nonempty set of missing columns warrants an ALTER'
    if missing:
        additions = re.search(r'ADD COLUMNS \((.*?)\)', alters[0], re.S)[1]
        assert dict(c.strip().split() for c in additions.split(',')) == {k: MISSING_COLUMNS[k] for k in missing}
        assert spark.queries.index(alters[0]) < spark.queries.index(merge)
    row = spark.tables[REGISTRY][0]
    assert set(row) == set(FIELDS) | {'id'}, 'staging row must contain the registry fields and stable id'
    assert re.fullmatch(r'par_[0-9a-f]{24}', row['id'])
    assert row['scope'] == scope_key({})
    assert isinstance(json.loads(row['value_or_hyperparams']), dict)
    assert json.loads(row['prior']) is None
    assert json.loads(row['keep']) is None
    _, schema = next((rows, schema) for rows, schema in spark.frames if schema)
    types = dict(c.strip().split() for c in schema.split(','))
    assert types['previous_version'] == 'INT' and types['days_since_last'] == 'DOUBLE'
    assert all(row[k] is None or isinstance(row[k], float) for k, dtype in types.items() if dtype == 'DOUBLE')


def test_existing_history_json_round_trips_and_ids_are_stable(monkeypatch, log_lines):
    log, _ = log_lines
    spark = LocalSpark(nightly_rows())
    run_main(monkeypatch, spark, log)
    first = dict(spark.tables[REGISTRY][0])
    from valuation import fit as job

    def promote_again(rows, store, scope, at):
        current = store.champion('valuation', {})
        assert current['scope'] == {} and isinstance(current['value_or_hyperparams'], dict)
        assert current['prior'] is None and current['keep'] is None
        current['status'] = 'retired'
        publish(store, {}, {'uri': 'fixture:model'}, report(.2), report(.1), at)
        return {'promoted': True, 'reason': 'held-out win'}

    # run_main reloads the module to exercise the bundle's environment configuration.
    import sys
    import types
    monkeypatch.setitem(sys.modules, 'pyspark.sql', types.SimpleNamespace(
        SparkSession=types.SimpleNamespace(getActiveSession=lambda: spark)))
    monkeypatch.setattr(job, 'nightly', promote_again)
    job.main()
    retired, champion = spark.tables[REGISTRY]
    assert retired['id'] == first['id'], 'rewriting history must preserve the version id'
    assert champion['id'] != first['id'], 'different versions need different ids'
    assert json.loads(champion['value_or_hyperparams']) == {'uri': 'fixture:model'}


def test_legacy_history_without_new_columns_can_be_promoted(monkeypatch, log_lines):
    log, _ = log_lines
    spark = LocalSpark(nightly_rows(), missing=MISSING_COLUMNS)
    store = MemoryStore()
    old = store.propose({'name': 'valuation', 'scope': {}, 'family': 'model_ref',
                         'value_or_hyperparams': {'uri': 'fixture:old'}, 'prior': None,
                         'n_eff': 30., 'held_out_score': -.2}, 0)
    store.promote('valuation', {}, old['version'], 0, '2026-11-14')
    old = store.history('valuation', {})[0]
    spark.tables[REGISTRY] = [{k: json.dumps(v) if k in ('scope', 'value_or_hyperparams', 'prior') else v
                               for k, v in old.items() if k not in MISSING_COLUMNS}]

    def configure(job):
        monkeypatch.setattr(job, 'run', lambda rows: {'n_rows': len(rows), 'backtest': {
            'coverage': .8, 'median_ape': .1, 'median_ape_category_median': .2}, 'premiums': []})

        def promote(rows, store, scope, at):
            promoted, reason = publish(store, scope, {'uri': 'fixture:new'}, report(.2), report(.1), at)
            return {'promoted': promoted, 'reason': reason}

        monkeypatch.setattr(job, 'nightly', promote)

    out = run_main(monkeypatch, spark, log, configure)
    assert out['promotion']['promoted'], out
    assert len(spark.tables[REGISTRY]) == 2
    retired, champion = spark.tables[REGISTRY]
    assert retired['origin'] is None, 'migration cannot invent provenance for an old version'
    assert champion['origin'] == 'fit' and champion['previous_version'] == retired['version']
