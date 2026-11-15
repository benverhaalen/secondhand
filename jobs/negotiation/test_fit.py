import numpy as np
import pytest
from negotiation.fit import Logistic, fit, online_update, nightly, calibration_error
from param.registry import MemoryStore


def rows(n=400, prefix="o"):
    return [{'outcome_id': f'{prefix}{i}', 'site': 'ebay', 'category': 'jacket', 'features': [0.5],
             'accepted': int(i % 2 == 0), 'returned': int(i % 5 == 0), 'may_model': True} for i in range(n)]


def test_hierarchy_fits_fixture_and_calibration():
    model = fit(rows(), prior=Logistic({'global': -1.}, [1.]))
    assert abs(model.predict(rows()[0]) - .5) < .01
    assert calibration_error(model, rows()) < .05
    assert {'global', 'site:ebay', 'category:jacket', 'cell:ebay:jacket'} <= model.terms.keys()


def test_poisoned_offers_are_capped_and_zero_prior_does_not_move():
    model = Logistic({'global': 1., 'site:ebay': 0.}, [1.])
    for _ in range(100):
        model = online_update(model, {**rows(1)[0], 'features': [1e12], 'accepted': 0}, days=0)
    assert .5 <= model.weights[0] <= 1.5
    assert .5 <= model.terms['global'] <= 1.5
    assert model.terms['site:ebay'] == 0
    assert .02 <= model.predict(rows(1)[0]) <= .98


def test_worse_challenger_is_kept_out_of_registry():
    store = MemoryStore()
    champion = Logistic({'global': 0}, [0])
    out = nightly(rows(), rows(prefix="held"), champion, store, {}, '2026-11-15')
    assert out['state'] == 'kept'
    assert store.history('P_accept', {}) == []


def test_improved_calibrated_fit_is_versioned_for_accept_and_return():
    store = MemoryStore()
    out = nightly(rows(), rows(prefix='held'), Logistic({'global': -1.}, [1.]), store, {}, '2026-11-15')
    assert out['state'] == 'promoted'
    assert store.champion('P_accept', {}) is not None
    assert out['q_return'].predict(rows()[0]) == pytest.approx(.2, abs=.015)


def test_no_holdout_or_overlapping_ids_refuses_fit():
    with pytest.raises(ValueError, match='held-out'):
        nightly(rows(), [], Logistic({}, [0]), MemoryStore(), {}, '2026-11-15')
    with pytest.raises(ValueError, match='overlap'):
        nightly(rows(), rows(), Logistic({}, [0]), MemoryStore(), {}, '2026-11-15')


def test_forbidden_rows_and_nonfinite_features_refused():
    with pytest.raises(ValueError, match='may_model'):
        fit([{**rows(1)[0], 'may_model': False}], Logistic({}, [0]))
    with pytest.raises(ValueError, match='features'):
        online_update(Logistic({}, [0]), {**rows(1)[0], 'features': [np.nan]})


def test_nightly_fit_respects_the_same_guards_as_event_updates():
    prior = Logistic({'global': 1.}, [1.])
    model = fit([{**r, 'accepted': 0} for r in rows()], prior)
    assert .5 <= model.terms['global'] <= 1.5
    assert .5 <= model.weights[0] <= 1.5
