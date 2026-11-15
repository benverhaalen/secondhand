import sys
from pathlib import Path
import pytest
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from param.registry import MemoryStore
from trust.fit import fit, predict, isotonic, brier

@pytest.mark.parametrize('rows', [[], [(0., 0)], [(0., 0)] * 3])
def test_empty_holdout_refuses_without_writing_champion(rows):
    store = MemoryStore()
    with pytest.raises(ValueError, match='held|training'):
        fit(store, rows, '2026-11-14T00:00:00Z')
    assert store.champion('trust_calib', {}) is None

@pytest.mark.parametrize('cal', [
    dict(kind='isotonic', xs=[], ys=[]),
    dict(kind='isotonic', xs=[1,0], ys=[.1,.5]),
    dict(kind='isotonic', xs=[0,1], ys=[.5,.1]),
    dict(kind='isotonic', xs=[0], ys=[1.1]),
    dict(kind='isotonic', xs=[float('nan')], ys=[.2]),
    dict(kind='platt', a=float('nan'), b=0),
])
def test_invalid_calibration_refuses(cal):
    with pytest.raises(ValueError): predict(cal, 0)

def test_tied_scores_are_pooled_before_isotonic_fit():
    cal = isotonic([(0,0),(0,1),(1,1)])
    assert predict(cal, 0) == .5

def test_empty_brier_is_not_perfect():
    with pytest.raises(ValueError): brier(dict(kind='platt', a=1, b=0), [])

def test_nightly_signal_fold_uses_weights_decay_temporal_holdout_and_prior_guards():
    from trust.fit import fit_signals
    rows = [dict(subject_id=f't{i}', resolved_at='2026-09-01T00:00:00Z' if i < 80 else '2026-11-10T00:00:00Z',
                 signals={'off_platform': i % 2}, value=i % 2, weight=.5) for i in range(160)]
    result = fit_signals(MemoryStore(), rows, '2026-11-15T00:00:00Z', {'off_platform': 2.})
    assert result['train_ids'] == sorted(f't{i}' for i in range(80))
    assert result['held_ids'] == sorted(f't{i}' for i in range(80,160))
    assert 1 <= result['weights']['off_platform'] <= 3
    assert result['train_weight'] < 40
    assert result['held_positive_weight'] == 20
    assert not result['promoted']  # fewer than thirty weighted positives

def test_predicate_threshold_fold_preserves_target_recall():
    from trust.fit import fit_thresholds
    rows = [dict(subject_id=f't{i}', signal='asks_code', confidence=i/100, value=1) for i in range(1,101)]
    out = fit_thresholds(MemoryStore(), rows, '2026-11-15T00:00:00Z')
    assert out['asks_code']['recall'] >= .95
    assert out['asks_code']['threshold'] <= .06

def test_fold_calibrates_only_champion_scores_and_publishes_predicate_thresholds():
    from trust.fit import fold
    rows = [dict(subject_id=f't{i}', resolved_at='2026-09-01T00:00:00Z' if i < 80 else '2026-11-10T00:00:00Z',
                 signals={'off_platform':i % 2}, value=i % 2, weight=1.) for i in range(160)]
    store = MemoryStore()
    result = fold(store, rows, [dict(subject_id='p',signal='asks_code',confidence=.3,value=1)], '2026-11-15T00:00:00Z', {'off_platform':2.})
    assert result['calibration'].version >= 1
    assert store.champion('trust_thr.asks_code',{}) is not None
    cal = store.champion('trust_calib',{})['value_or_hyperparams']
    assert set(cal['basis_ids']) == {f't{i}' for i in range(80,160)}
    assert result['weights']['held_ids'] == sorted(f't{i}' for i in range(80,160))

def test_predicate_fold_compares_champion_on_current_examples():
    from trust.fit import fit_thresholds
    store = MemoryStore()
    fit_thresholds(store, [dict(subject_id='a',signal='asks_code',confidence=.9,value=1)], '2026-11-14T00:00:00Z')
    result = fit_thresholds(store, [dict(subject_id='b',signal='asks_code',confidence=.1,value=1)], '2026-11-15T00:00:00Z')
    assert result['asks_code']['promoted']
    assert store.champion('trust_thr.asks_code',{})['value_or_hyperparams'] == .1

def test_money_half_up_and_safe_integer_boundaries():
    from trust.money import cents, half_up
    assert half_up(100.5) == 101
    for bad in [-1,.5,float('nan'),float('inf'),9007199254740992]:
        with pytest.raises(ValueError,match='price_cents'): cents(bad,'price_cents')

def test_isotonic_switch_is_a_scoped_registry_read():
    from trust.params import prior_read
    def read(name, scope):
        assert scope == {'site':'ebay'}
        return {'value':4,'version':7} if name == 'trust_isotonic_n' else prior_read(name, scope)
    store = MemoryStore()
    result = fit(store, [(0,0),(1,1),(2,1),(3,1)], '2026-11-15T00:00:00Z',site='ebay',read=read)
    assert result.kind == 'isotonic'
    assert store.champion('trust_calib',{'site':'ebay'})['value_or_hyperparams']['param_versions']['trust_isotonic_n'] == 7

@pytest.mark.parametrize('amount',[4503599627370497,9007199254740991])
def test_half_up_preserves_large_whole_safe_cents(amount):
    from trust.money import half_up
    assert half_up(amount) == amount

def test_zero_weight_scripts_never_count_in_calibration_gate():
    from trust.fit import fold
    rows = [dict(subject_id=f'old{i}',resolved_at='2026-09-01T00:00:00Z',signals={'off_platform':i%2},value=i%2,weight=1.) for i in range(40)]
    rows += [dict(subject_id=f'honest{i}',resolved_at='2026-11-10T00:00:00Z',signals={'off_platform':0},value=0,weight=1.) for i in range(4)]
    rows += [dict(subject_id=f'seed{i}',resolved_at='2026-11-10T00:00:00Z',signals={'off_platform':1},value=1,weight=0.) for i in range(320)]
    store = MemoryStore()
    fold(store,rows,[],'2026-11-15T00:00:00Z',{'off_platform':2.})
    cal = store.champion('trust_calib',{})['value_or_hyperparams']
    assert cal['n'] == 4 and cal['positives'] == 0
    assert set(cal['basis_ids']) == {f'honest{i}' for i in range(4)}

def test_all_zero_weight_holdout_refuses():
    from trust.fit import fit_signals
    rows = [dict(subject_id=f'old{i}',resolved_at='2026-09-01T00:00:00Z',signals={'off_platform':i%2},value=i%2,weight=1.) for i in range(4)]
    rows += [dict(subject_id='seed',resolved_at='2026-11-10T00:00:00Z',signals={'off_platform':1},value=1,weight=0.)]
    with pytest.raises(ValueError,match='held-out'):
        fit_signals(MemoryStore(),rows,'2026-11-15T00:00:00Z',{'off_platform':2.})

def test_isotonic_and_brier_preserve_fractional_label_weights():
    cal = isotonic([(0,0),(0,1)],weights=[.9,.1])
    assert predict(cal,0) == pytest.approx(.1)
    assert brier(cal,[(0,0),(0,1)],weights=[.9,.1]) == pytest.approx(.09)
