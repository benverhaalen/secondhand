import numpy as np
import pytest
from negotiation.fit import Logistic, fit, online_update, nightly, calibration_error, log_loss
from param.registry import MemoryStore


def rows(n=400, prefix="o"):
    return [{'outcome_id': f'{prefix}{i}', 'site': 'ebay', 'category': 'jacket', 'features': [0.5],
             'accepted': int(i % 2 == 0), 'returned': int(i % 5 == 0), 'may_model': True} for i in range(n)]


def test_hierarchy_fits_fixture_and_calibration():
    model = fit(rows(), prior=Logistic({'global': -1.}, [1.]))
    assert abs(model.predict(rows()[0]) - .5) < .01
    assert calibration_error(model, rows()) < .05
    assert {'global', 'site:ebay', 'category:jacket', 'cell:ebay:jacket'} <= model.terms.keys()


def test_poisoned_offers_are_capped_and_zero_prior_can_learn():
    model = Logistic({'global': 1., 'site:ebay': 0.}, [1.])
    for _ in range(100):
        model = online_update(model, {**rows(1)[0], 'features': [1e12], 'accepted': 0}, days=0)
    assert .5 <= model.weights[0] <= 1.5
    assert .5 <= model.terms['global'] <= 1.5
    assert -np.log(49) <= model.terms['site:ebay'] < 0
    assert .02 <= model.predict(rows(1)[0]) <= .98


def test_worse_challenger_is_kept_out_of_registry():
    store = MemoryStore()
    champion = Logistic({'global': 0}, [0])
    training = [{**r, 'accepted': int(i % 10 != 0)} for i, r in enumerate(rows())]
    held = rows(prefix="held")
    candidate = fit(training, champion)
    assert log_loss(candidate, held) > log_loss(champion, held)
    out = nightly(training, held, champion, store, {}, '2026-11-15')
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


def test_zero_prior_and_new_hierarchy_terms_have_bounded_learning_range():
    prior = Logistic({'global': 0.}, [0.])
    model = fit([{**r, 'accepted': 1} for r in rows()], prior)
    assert all(0 < v <= np.log(49) for v in model.terms.values())
    assert 0 < model.weights[0] <= np.log(49)


@pytest.mark.parametrize('split', ['training', 'held_out'])
@pytest.mark.parametrize('owner', ['other', None])
def test_person_scope_refuses_foreign_or_unowned_rows(split, owner):
    training = [{**r, 'person': 'owner'} for r in rows()]
    held = [{**r, 'person': 'owner'} for r in rows(prefix='held')]
    (training if split == 'training' else held)[0]['person'] = owner
    store = MemoryStore()
    with pytest.raises(ValueError, match='person scope'):
        nightly(training, held, Logistic({'global': -1.}, [1.]), store, {'person': 'owner'}, '2026-11-15')
    assert not store.rows


def test_prediction_does_not_require_outcome_label():
    assert Logistic({}, [0]).predict({'site': 'ebay', 'category': 'jacket', 'features': [1]}) == .5


def test_return_calibration_validates_returned_not_accepted():
    data = [{k: v for k, v in r.items() if k != 'accepted'} for r in rows()]
    model = fit(data, Logistic({}, [0]), 'returned')
    assert np.isfinite(log_loss(model, data, 'returned'))
    with pytest.raises(ValueError, match='returned'):
        calibration_error(model, [{**data[0], 'returned': 2}], 'returned')


def test_scoped_probability_and_missing_parameter():
    from negotiation.params import resolve, DECLARED
    priors = {d['name']: d['prior'] for d in DECLARED}
    params = resolve(lambda name, scope: {'value': .4 if name == 'negotiation_p_lo' else priors[name], 'version': 7}, {'site': 'ebay'})
    model = Logistic({'global': -100}, [0], params=params)
    assert model.predict(rows()[0]) == .4
    assert model.payload()['param_versions']['negotiation_p_lo'] == 7
    del params['values']['negotiation_p_lo']
    with pytest.raises(ValueError, match='missing negotiation_p_lo'):
        model.predict(rows()[0])


def test_shared_logistic_and_half_life():
    import json
    from pathlib import Path
    from negotiation.fit import half_life
    f = json.loads((Path(__file__).resolve().parents[2] / 'app/src/engines/negotiation/twins.json').read_text())
    for c in f['logistic']:
        assert Logistic(c['terms'], c['weights']).predict(c['row']) == pytest.approx(c['expected'], abs=1e-12)
    for c in f['decay']:
        assert half_life(c['days']) == pytest.approx(c['expected'], abs=1e-12)


@pytest.mark.parametrize('value', [0, 1])
def test_return_prior_requires_finite_log_odds(value):
    from negotiation.params import resolve, validate
    p = resolve()
    p['values']['negotiation_q_return'] = value
    with pytest.raises(ValueError, match='negotiation_q_return'):
        validate(p)
