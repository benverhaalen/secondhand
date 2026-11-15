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
