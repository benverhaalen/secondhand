import pytest
from param.registry import MemoryStore
from score.fit import nightly, fit_bands

PRIOR = {'cuts': [25, 50, 75], 'rates': [.1, .3, .6, .9]}


def outcomes(prefix='train', invert=False):
    rows = []
    for band, value in enumerate([10, 20, 30, 40]):
        for i in range(40):
            sold = int(i < [0, 10, 30, 40][band])
            rows.append({'outcome_id': f'{prefix}:{band}:{i}', 'value': value,
                         'sold': 1 - sold if invert else sold, 'may_model': True})
    return rows


def test_few_outcomes_keep_prior_without_registry_write():
    store = MemoryStore()
    out = nightly(outcomes()[:4], outcomes('held'), PRIOR, store, {}, '2026-11-15')
    assert out['state'] == 'prior' and out['model'] == PRIOR
    assert store.history('score_bands', {}) == []


def test_worse_weights_kept_on_held_out_loss():
    # A training cohort with a shifted score relation must not overwrite the better held-out prior.
    training = [{**r, 'value': r['value'] * 2} for r in outcomes()]
    held = [{**r, 'value': r['value'] * 2} for r in outcomes('held')]
    prior = fit_bands(training, min_band=20)
    shifted = [{**r, 'value': r['value'] / 2} for r in training]
    out = nightly(shifted, held, prior, MemoryStore(), {}, '2026-11-15')
    assert out['state'] == 'kept' and out['model'] == prior


def test_nightly_band_fit_promotes_only_held_out_win():
    store = MemoryStore()
    out = nightly(outcomes(), outcomes('held'), PRIOR, store, {}, '2026-11-15')
    assert out['state'] == 'promoted'
    assert out['model']['cuts'] == [15., 25., 35.]
    assert out['model']['rates'] == [0., .25, .75, 1.]
    assert store.champion('score_bands', {})['n_eff'] == 160
    assert store.champion('score_bands', {})['value_or_hyperparams']['cuts'] == out['model']['cuts']


def test_no_monotone_separation_does_not_invent_bands():
    assert fit_bands([{**r, 'sold': 0} for r in outcomes()], min_band=20) is None


def test_training_overlap_forbidden_rows_and_nonfinite_score_fail():
    with pytest.raises(ValueError, match='overlap'):
        nightly(outcomes(), outcomes(), PRIOR, MemoryStore(), {}, '2026-11-15')
    with pytest.raises(ValueError, match='may_model'):
        fit_bands([{**r, 'may_model': False} for r in outcomes()])
    with pytest.raises(ValueError, match='score'):
        fit_bands([{**r, 'value': float('nan')} for r in outcomes()])


def test_frozen_model_does_not_partially_promote_cuts():
    store = MemoryStore()
    row = store.propose({'name': 'score_bands', 'scope': {}, 'family': 'model_ref',
                         'value_or_hyperparams': PRIOR, 'held_out_score': -1}, 0)
    store.promote('score_bands', {}, row['version'], 0, '2026-11-14')
    store.champion('score_bands', {})['frozen'] = True
    before = dict(store.champion('score_bands', {}))
    out = nightly(outcomes(), outcomes('held'), PRIOR, store, {}, '2026-11-15')
    assert out['state'] == 'kept'
    assert store.champion('score_bands', {}) == before
