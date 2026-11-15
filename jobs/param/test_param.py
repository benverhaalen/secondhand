import json
import pathlib
import sys

import pytest

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from registry import FIELDS, MemoryStore, VersionConflict, scope_key  # noqa: E402

ROW = json.loads((pathlib.Path(__file__).parents[2] / "app/src/engines/param/row.json").read_text())
AT = "2026-11-14T22:00:00-06:00"
SCOPE = {"site": "depop"}


def fit(**over):
    return {**ROW, **over}


def test_same_row_shape_as_typescript():
    assert set(ROW) == set(FIELDS)
    assert set(MemoryStore().propose(fit(), 0)) == set(FIELDS)


def test_no_promote_when_challenger_loses_held_out():
    s = MemoryStore()
    s.propose(fit(held_out_score=0.5), 0)
    assert s.promote("p_min_quick", SCOPE, 1, 0.01, AT) == (True, "first champion")
    s.propose(fit(value_or_hyperparams=0.9, held_out_score=0.505), 1)
    assert s.promote("p_min_quick", SCOPE, 2, 0.01, AT) == (False, "lost held-out")
    assert s.champion("p_min_quick", SCOPE)["version"] == 1


def test_fit_without_held_out_score_is_refused():
    with pytest.raises(ValueError, match="held-out"):
        MemoryStore().propose(fit(held_out_score=None), 0)


def test_version_conflict_one_of_two_racing_fits_wins():
    s = MemoryStore()
    s.propose(fit(), 0)
    with pytest.raises(VersionConflict):
        s.propose(fit(value_or_hyperparams=0.8), 0)
    assert len(s.history("p_min_quick", SCOPE)) == 1


def test_rollback_restores_previous_version():
    s = MemoryStore()
    s.propose(fit(held_out_score=0.5), 0)
    s.promote("p_min_quick", SCOPE, 1, 0, AT)
    s.propose(fit(value_or_hyperparams=0.9, held_out_score=0.8), 1)
    s.promote("p_min_quick", SCOPE, 2, 0, AT)
    assert s.rollback("p_min_quick", SCOPE, AT)["version"] == 1
    assert s.champion("p_min_quick", SCOPE)["value_or_hyperparams"] == 0.7


def test_unknown_scope_key_is_refused():
    with pytest.raises(ValueError, match="scope"):
        MemoryStore().propose(fit(scope={"city": "x"}), 0)


PARITY = json.loads((pathlib.Path(__file__).parents[2] / 'app/src/engines/param/parity.json').read_text())


@pytest.mark.parametrize('case', PARITY, ids=lambda c: c['name'])
def test_parity(case):
    s = MemoryStore()
    for d in case['declare']:
        s.declare(d)
    assert len(case['ops']) == len(case['expect'])
    for i, (op, expected) in enumerate(zip(case['ops'], case['expect'])):
        label = f"{case['name']}, op {i} ({op['op']})"
        try:
            name = op.get('name', case['declare'][0]['name'])
            scope, at = op.get('scope', {}), op.get('at', '2026-01-01')
            d = next(d for d in case['declare'] if d['name'] == name)
            def execute():
                kind = op['op']
                if kind == 'observe':
                    return s.observe(name, scope, op['outcome'], at)
                if kind == 'apply_gamma':
                    def step(v, keep):
                        return {'value': {'shape': v['shape'] * keep + op['weight'] * op['count'],
                                          'rate': v['rate'] * keep + op['weight'] * op['exposure']}, 'weight': op['weight']}
                    return s.apply(name, scope, step, at, op.get('days_since_last'))
                if kind == 'propose':
                    row = dict(name=name, scope=scope, family=d['family'], prior=d['prior'], value_or_hyperparams=op['value'], n_eff=40,
                               fitted_on_ids_hash=None, metric=None, held_out_score=op['held_out_score'], guard_lo=d.get('guard_lo'), guard_hi=d.get('guard_hi'))
                    return s.propose(row, op['expect_version'])
                if kind == 'promote':
                    return s.promote(name, scope, op['version'], op.get('noise', 0), at, op.get('champion_score'))
                if kind == 'rollback':
                    return s.rollback(name, scope, at, op.get("keep_evidence", False))
                if kind == 'freeze':
                    return s.freeze(name, scope, op['on'])
                return s.read(name, scope, op.get("as_of"))
            if op.get('error'):
                with pytest.raises(VersionConflict):
                    execute()
            else:
                result = execute()
                if op.get('reason'):
                    assert (result[1] if isinstance(result, tuple) else result['reason']) == op['reason'], label
                if op.get('anomaly'):
                    assert result['anomaly'] is True
            actual = s.read(name, scope, op.get("as_of"))
            assert {k: actual[k] for k in ('version', 'from', 'scope')} == {k: expected[k] for k in ('version', 'from', 'scope')}, label
            assert actual['n_eff'] == pytest.approx(expected['n_eff'], abs=1e-9, rel=0), label
            assert actual['value'] == pytest.approx(expected['value'], abs=1e-9, rel=0), label
        except Exception as error:
            raise AssertionError(label) from error


def test_model_apply_is_local_and_uses_elapsed_time():
    s = MemoryStore()
    s.declare({'name': 'P_accept', 'family': 'model_ref', 'prior': {'term': 0}, 'guard_hi': 0})
    s.apply('P_accept', SCOPE, lambda v, keep: {'value': {'term': 4}, 'weight': 8}, '2026-01-01')
    person = {**SCOPE, 'person': 'usr_1'}
    s.apply('P_accept', person, lambda v, keep: {'value': {'term': v['term'] + 1}, 'weight': 1}, '2026-01-01')
    s.apply('P_accept', person, lambda v, keep: {'value': {'term': v['term'] * keep}, 'weight': 2}, '2026-01-31')
    assert s.read('P_accept', person)['value'] == {'term': 2.5}
    assert s.read('P_accept', person)['n_eff'] == 2.5
    assert s.read('P_accept', SCOPE)['value'] == {'term': 4}
    with pytest.raises(ValueError, match='beta|gamma'):
        s.observe('P_accept', person, {'success': 1, 'weight': 1}, AT)


def test_gamma_freeze_guards_and_three_sold_comps():
    s = MemoryStore()
    s.declare({'name': 'velocity', 'family': 'gamma', 'prior': {'shape': 2, 'rate': 4}, 'guard_hi': 10})
    for _ in range(3):
        s.observe('velocity', {}, {'count': 1, 'exposure': 0, 'weight': 1, 'days_since_last': 30}, AT)
    assert s.read('velocity', {})['value'] == {'shape': 3.75, 'rate': 4}
    s.freeze('velocity', {}, True)
    assert s.observe('velocity', {}, {'count': 1, 'exposure': 1, 'weight': 1}, AT)['reason'] == 'frozen'
    s.freeze('velocity', {}, False)
    assert s.observe('velocity', {}, {'count': 100, 'exposure': 0, 'weight': 1}, AT)['reason'] == 'clamped'
    assert s.read('velocity', {})['version'] == 4


def test_promotion_only_writes_same_set_score_on_win():
    s = MemoryStore()
    s.propose(fit(held_out_score=0.9), 0)
    s.promote('p_min_quick', SCOPE, 1, 0, AT)
    s.propose(fit(held_out_score=0.5), 1)
    assert s.promote('p_min_quick', SCOPE, 2, 0.01, AT, 0.6)[0] is False
    assert s.history('p_min_quick', SCOPE)[0]['held_out_score'] == 0.9
    assert s.promote('p_min_quick', SCOPE, 2, 0.01, AT, 0.4)[0] is True
    assert s.history('p_min_quick', SCOPE)[0]['held_out_score'] == 0.4


@pytest.mark.parametrize('family', ['beta', 'gamma'])
def test_pooling_sparse_dense_person_and_kappa(family):
    s = MemoryStore()
    def value(m):
        return {'alpha': 10 * m, 'beta': 10 * (1 - m)} if family == 'beta' else {'shape': 10 * m, 'rate': 10}
    s.declare({'name': 'velocity', 'family': family, 'prior': value(0.8)})
    for scope, mean, n in [(SCOPE, 0.8, 200), ({**SCOPE, 'person': 'usr_1'}, 0.2, 3), ({**SCOPE, 'person': 'usr_2'}, 0.1, 200)]:
        s.propose(fit(name='velocity', scope=scope, family=family, prior=value(0.8), value_or_hyperparams=value(mean), n_eff=n), 0)
        s.promote('velocity', scope, 1, 0, AT)
    sparse = s.readPooled('velocity', {**SCOPE, 'person': 'usr_1'})
    assert sparse['mean'] == pytest.approx((3 * 0.2 + 20 * 0.8) / 23)
    assert sparse['versions'] == [1, 1]
    assert abs(s.readPooled('velocity', {**SCOPE, 'person': 'usr_2'})['mean'] - 0.1) < 0.07
    absent = s.readPooled('velocity', {**SCOPE, 'state': 'listed', 'person': 'usr_3'})
    assert absent['mean'] == 0.8 and absent['versions'] == []
    assert s.read('param_pool_kappa', {})['value'] == 20
    s.propose(fit(name='param_pool_kappa', scope={}, value_or_hyperparams=40), 0)
    s.promote('param_pool_kappa', {}, 1, 0, AT)
    assert s.readPooled('velocity', {**SCOPE, 'person': 'usr_1'})['mean'] == pytest.approx((3 * 0.2 + 40 * 0.8) / 43)
    assert s.readPooled('param_pool_kappa', {}) == s.read('param_pool_kappa', {})


def test_pooling_recurses_shared_ancestors_but_person_stops_at_shared_scope():
    s = MemoryStore()
    s.declare({'name': 'sale_rate', 'family': 'gamma', 'prior': {'shape': 2, 'rate': 10}})
    shared = {'kind': 'shoes', 'site': 'ebay', 'segment': 'boots'}
    for scope, shape, n in [({}, 8, 20), ({'kind': 'shoes'}, 4, 40), (shared, 9, 3), ({**shared, 'person': 'usr_2'}, 1000, 200)]:
        s.propose(fit(name='sale_rate', family='gamma', scope=scope, value_or_hyperparams={'shape': shape, 'rate': 10}, n_eff=n), 0)
        s.promote('sale_rate', scope, 1, 0, AT)
    parent = (40 * 0.4 + 20 * ((20 * 0.8 + 20 * 0.2) / 40)) / 60
    result = s.readPooled('sale_rate', {**shared, 'state': 'listed'})
    assert result['mean'] == pytest.approx((3 * 0.9 + 20 * parent) / 23)
    assert result['versions'] == [1, 1, 1]
    person = s.readPooled('sale_rate', {**shared, 'person': 'usr_1'})
    assert person['mean'] == pytest.approx((3 * 0.9 + 20 * 0.2) / 23)
    assert person['versions'] == [1]


SCOPE_CASES = json.loads((pathlib.Path(__file__).parents[2] / 'app/src/engines/param/scope-keys.json').read_text())

@pytest.mark.parametrize('case', SCOPE_CASES)
def test_canonical_scope_key(case):
    assert scope_key(case['scope']) == case['key']


def test_idle_evidence_keeps_prior_and_read_decay():
    s = MemoryStore()
    s.declare({'name': 'assist_span_open', 'family': 'beta', 'prior': {'alpha': 8, 'beta': 2}})
    s.observe('assist_span_open', SCOPE, {'success': 1, 'weight': 50}, '2026-01-01')
    aged = s.read('assist_span_open', SCOPE, as_of='2026-05-01')
    assert aged['value'] == {'alpha': 11.125, 'beta': 2}
    assert aged['n_eff'] == 3.125
    result = s.observe('assist_span_open', SCOPE, {'success': 0, 'weight': 0}, '2026-05-01')
    assert result['read']['value'] == aged['value']
    assert result['read']['n_eff'] == aged['n_eff']


def test_guard_keeps_all_counts_and_recovers():
    s = MemoryStore()
    s.declare({'name': 'assist_span_open', 'family': 'beta', 'prior': {'alpha': 8, 'beta': 2}, 'guard_hi': 0.9})
    for _ in range(60):
        result = s.observe('assist_span_open', SCOPE, {'success': 1, 'weight': 1}, '2026-01-01')
    assert result['applied'] and result['reason'] == 'clamped' and result['anomaly']
    assert s.champion('assist_span_open', SCOPE)['value_or_hyperparams'] == {'alpha': 68, 'beta': 2}
    assert s.champion('assist_span_open', SCOPE)['n_eff'] == 60
    v = s.read('assist_span_open', SCOPE)['value']
    assert v['alpha'] / (v['alpha'] + v['beta']) == 0.9
    for _ in range(60):
        s.observe('assist_span_open', SCOPE, {'success': 0, 'weight': 1}, '2026-01-01')
    assert s.read('assist_span_open', SCOPE)['value'] == {'alpha': 68, 'beta': 62}


def test_rollback_restores_fit_not_event_and_keeps_only_active_evidence():
    s = MemoryStore()
    s.declare({'name': 'assist_span_open', 'family': 'beta', 'prior': {'alpha': 8, 'beta': 2}})
    s.propose(fit(name='assist_span_open', family='beta', prior={'alpha': 8, 'beta': 2}, value_or_hyperparams={'alpha': 8, 'beta': 2}, n_eff=20), 0)
    s.promote('assist_span_open', SCOPE, 1, 0, AT)
    for success in [1, 0]:
        s.observe('assist_span_open', SCOPE, {'success': success, 'weight': 2}, AT)
    restored = s.rollback('assist_span_open', SCOPE, AT)
    assert restored['version'] == 1 and restored['origin'] == 'fit'
    s.observe('assist_span_open', SCOPE, {'success': 1, 'weight': 4}, AT)
    kept = s.rollback('assist_span_open', SCOPE, AT, keep_evidence=True)
    assert kept['value_or_hyperparams'] == {'alpha': 12, 'beta': 2}
    assert kept['n_eff'] == 24


def test_rollback_keeps_exact_evidence_with_explicit_clock_override():
    s = MemoryStore()
    s.declare({'name': 'assist_span_open', 'family': 'beta', 'prior': {'alpha': 8, 'beta': 2}})
    s.propose(fit(name='assist_span_open', family='beta', prior={'alpha': 8, 'beta': 2}, value_or_hyperparams={'alpha': 18, 'beta': 2}, n_eff=20), 0)
    s.promote('assist_span_open', SCOPE, 1, 0, '2026-01-01')
    s.observe('assist_span_open', SCOPE, {'success': 1, 'weight': 1, 'days_since_last': 0}, '2026-01-31')
    kept = s.rollback('assist_span_open', SCOPE, '2026-01-31', keep_evidence=True)
    assert kept['value_or_hyperparams'] == {'alpha': 19, 'beta': 2}
    assert kept['n_eff'] == 21
