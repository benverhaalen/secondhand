"""Regression checks for the Demand and trend audit."""
import math
import pytest
from demand.velocity import Week, velocity
from demand.forecast import price_comps, price_forecast
from demand.direction import Proxy, direction, demand_index
from demand.ensemble import brier, ask, Record


def test_registry_gamma_and_censor_count():
    p = velocity([Week(99, 0)], {"shape": 2, "rate": 3})
    assert (p.shape, p.rate, p.censored_weeks) == (2, 3, 1)


@pytest.mark.parametrize('value', [-1, 0, 1.5, math.nan, math.inf, True])
def test_money_refuses_invalid_cents(value):
    with pytest.raises(ValueError, match='price_cents'):
        price_comps([{'price_cents': value}])


def test_money_rounds_half_up():
    r = price_forecast('p', [101], age_step=0.5, decay=1, as_of='t', seed=1)
    assert r['p50'] == 51


@pytest.mark.parametrize('week', [Week(-1, 1), Week(1.5, 1), Week(1, -1), Week(1, math.nan), Week(1, 1, 0)])
def test_velocity_refuses_invalid_evidence(week):
    with pytest.raises(ValueError):
        velocity([week], {'shape': 2, 'rate': 3})


def test_index_refuses_negative_weights():
    with pytest.raises(ValueError):
        demand_index({'sold': Proxy(10, 1)}, {'sold': -1})


def test_single_item_direction_cannot_bypass_category_adjustment():
    p = {'sold': Proxy(40, 20), 'watchers': Proxy(120, 60)}
    assert direction(p, {'sold': 1, 'watchers': 1}, sold_recent=40, sold_prior=60).state == 'hidden'


def test_brier_refuses_mismatched_arrays():
    with pytest.raises(ValueError):
        brier([.5, .5], [1])


def test_ensemble_refuses_invalid_probability():
    with pytest.raises(ValueError):
        ask({'id': 'q'}, [], lambda q, e: math.nan, Record())


def test_category_adjustment_is_passed_to_each_verdict():
    from demand.direction import category_directions, m15_test
    proxies = {'sold': Proxy(40, 20), 'watchers': Proxy(120, 60)}
    candidates = [dict(proxies=proxies, sold_recent=40, sold_prior=60)]
    candidates += [dict(proxies=proxies, sold_recent=20, sold_prior=60) for _ in range(99)]
    out = category_directions(candidates, {'sold': 1, 'watchers': 1})
    assert out[0].p == pytest.approx(m15_test([(40, 60)] + [(20, 60)] * 99)[0])
    assert out[0].state == 'steady'


def test_hourly_reads_do_not_alert():
    from demand.direction import Read, trending
    assert trending([Read('rising', .5, .001), Read('rising', .5, .001)]) is None


def test_resolution_uses_forecast_identity():
    from demand.learn import Forecast, resolve
    a = Forecast('f1', 'same', '2026-11-01', 1, 2, 3)
    b = Forecast('f2', 'same', '2026-11-08', 1, 2, 3)
    out = resolve([a, b], {'f1': 2, 'f2': 3}, '2026-11-15')
    assert [f.resolved_value for f in out] == [2, 3]


def test_pairing_refuses_mismatched_truth_or_windows():
    from demand.learn import Forecast, _paired_win
    a = Forecast('f1', 'same', '2026-11-01', 1, 2, 3, 2)
    b = Forecast('f2', 'same', '2026-11-08', 1, 2, 3, 3)
    with pytest.raises(ValueError, match='paired'):
        _paired_win([a], [b])


def test_weight_fit_does_not_depend_on_insertion_order():
    import numpy as np
    from demand.learn import refit_weights
    x = np.array([1., 2., 3.])
    assert refit_weights({'a': x, 'b': x}, x) == refit_weights({'b': x, 'a': x}, x)


def test_missing_resolved_param_throws():
    from demand.params import resolve
    p = resolve()
    del p['values']['demand_half_life_weeks']
    with pytest.raises(KeyError):
        velocity([], {'shape': 1, 'rate': 1}, params=p)


def test_param_read_versions_and_half_life_are_used():
    from demand.params import DECLARED, resolve
    priors = {d['name']: d['prior'] for d in DECLARED}
    p = resolve(lambda name, scope: {'value': 4 if name == 'demand_half_life_weeks' else priors[name], 'version': 7}, {'kind': 'shoes'})
    v = velocity([Week(4, 1)] + [Week(0, 1)] * 8, {'shape': 1, 'rate': 1}, params=p)
    assert v.shape == 2
    from demand.forecast import count_forecast
    row = count_forecast('p', v, weeks=[1] * 4, D=0, params=p, basis_count=9, as_of='2026-11-15')
    assert set(row['param_versions'].values()) == {7}


def test_publication_refuses_an_uncited_number():
    from demand.forecast import count_forecast
    row = count_forecast('p', velocity([], {'shape': 2, 'rate': 2}), weeks=[1] * 4,
                         D=0, basis_count=20, as_of='2026-11-15')
    assert row['guarded']['state'] == 'hidden'
    assert row['guarded']['hide_reason'] == 'source_gap'


def test_publication_cites_versions_and_hides_stale_basis():
    from demand.forecast import price_forecast
    basis = [{'id': f'c{i}', 'source': 'sold', 'at': '2026-10-01', 'price_cents': 100 + i} for i in range(10)]
    row = price_forecast('p', list(range(100, 110)), age_step=1, decay=1, as_of='2026-11-15', seed=1, basis=basis)
    assert row['guarded']['hide_reason'] == 'stale'
    assert row['citation']['param_versions'] == row['param_versions']
    assert len(row['citation']['basis_ids']) == 10


def test_calibration_refuses_empty_or_impossible_width():
    from demand.learn import k_cov, Forecast
    with pytest.raises(ValueError):
        k_cov([])
    with pytest.raises(ValueError):
        k_cov([Forecast('f', 'p', '2026-11-01', 2, 2, 2, 3)])


def test_weight_guards_reject_infeasible_simplex():
    from demand.learn import guard_weights
    with pytest.raises(ValueError):
        guard_weights({'a': 1}, {'a': .1})


def test_unrelated_price_evidence_is_refused():
    basis = [{'id': str(i), 'source': 'sold', 'at': '2026-11-15', 'price_cents': 10000} for i in range(10)]
    with pytest.raises(ValueError, match='basis'):
        price_forecast('p', [100] * 10, age_step=1, decay=1, as_of='2026-11-15', seed=1, basis=basis)


def test_extreme_gamma_refuses_nonfinite_output():
    with pytest.raises(ValueError):
        velocity([], {'shape': 1e308, 'rate': 1e-308})


def test_scalar_p_value_cannot_be_used_as_category_evidence():
    with pytest.raises(ValueError, match='category'):
        direction({'sold': Proxy(40, 20), 'watchers': Proxy(120, 60)}, {'sold': 1, 'watchers': 1},
                  sold_recent=40, sold_prior=60, adjusted_p=.0001)


@pytest.mark.parametrize('weeks', [[(-1, 1)] * 16, [(2.5, 1)] * 16, [(1, -1)] * 16])
def test_event_estimator_validates_evidence_even_when_parked(weeks):
    from demand.event_effect import estimate, Series
    with pytest.raises(ValueError):
        estimate(Series(weeks), Series([(20, 100)] * 16), 12)


def test_fold_refuses_a_dictionary_disguised_as_a_scalar():
    from demand.learn import fold, Forecast
    from param.registry import MemoryStore
    f = Forecast('f', 'p', '2026-11-01', 1, 2, 3, 2)
    with pytest.raises(ValueError, match='value'):
        fold(MemoryStore(), 'demand_weight_sold', {}, champion=[f], challenger=[f], value={'sold': .5}, at='2026-11-15')


def test_citation_changes_with_forecast_terms():
    basis = [{'id': str(i), 'source': 'sold', 'at': '2026-11-15', 'price_cents': 100} for i in range(10)]
    args = dict(as_of='2026-11-15', seed=1, basis=basis)
    a = price_forecast('p', [100] * 10, age_step=1, decay=1, **args)
    b = price_forecast('p', [100] * 10, age_step=.5, decay=1, **args)
    assert a['citation']['id'] != b['citation']['id']


def test_interval_refuses_crossed_bootstrap_endpoints():
    from demand.forecast import _widen
    with pytest.raises(ValueError, match='unordered'):
        _widen(10, 5, 12, 1)


def test_promotion_refuses_duplicate_or_old_windows():
    from demand.learn import Forecast, fold
    from param.registry import MemoryStore
    f = Forecast('f', 'p', '2026-11-01', 1, 2, 3, 2)
    for end in ('2026-11-01', '2025-01-01'):
        from dataclasses import replace
        with pytest.raises(ValueError, match='paired'):
            fold(MemoryStore(), 'demand_weight_sold', {}, champion=[replace(f, horizon_end=end)] * 300,
                 challenger=[replace(f, horizon_end=end)] * 300, value=.4, at='2026-11-15')


def test_weight_guard_caps_zero_start_and_obeys_resolved_band():
    from demand.params import resolve
    from demand.learn import guard_weights
    p = resolve()
    p['values']['demand_weight_band'] = .1
    p['values']['demand_zero_start_cap'] = .05
    out = guard_weights({'sold': 1, 'search': 0, 'new': 1}, {'sold': .5, 'search': .5, 'new': 0}, params=p)
    assert .45 <= out['sold'] <= .55
    assert .45 <= out['search'] <= .55
    assert out['new'] <= .05
    assert sum(out.values()) == pytest.approx(1)


def test_every_declared_param_is_read_and_has_provenance():
    from demand.params import DECLARED, resolve
    calls = []
    def read(name, scope):
        calls.append((name, scope))
        return {'value': next(d['prior'] for d in DECLARED if d['name'] == name), 'version': 2}
    scope = {'kind': 'shoes'}
    out = resolve(read, scope)
    assert len(calls) == len(DECLARED)
    assert all(s == scope for _, s in calls)
    assert all(d['source'] and d['family'] == 'scalar' for d in DECLARED)
    assert set(out['versions'].values()) == {2}


def test_proof_effective_count_is_scale_invariant():
    from demand.publication import publication
    for scale in (1e308, 1e-308):
        basis = [{'id': str(i), 'source': 'sold', 'at': '2026-11-15', 'weight': scale} for i in range(5)]
        assert publication(100, metric='demand', basis=basis, as_of='2026-11-15')['guarded']['hide_reason'] == 'too_few'


def test_fold_validates_the_declared_parameter_domain():
    from demand.learn import fold, Forecast
    from param.registry import MemoryStore
    f = Forecast('f', 'p', '2026-11-01', 1, 2, 3, 2)
    with pytest.raises(ValueError, match='demand_min_resolved'):
        fold(MemoryStore(), 'demand_min_resolved', {}, champion=[f], challenger=[f], value=.5, at='2026-11-15')
