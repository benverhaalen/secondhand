"""pa-6: replay-safe updates, decay, opted-in fitting, holdout gate and rollback."""
from analytics.learn import fold_events, fit_priors, nightly, guard_effect
from param.registry import MemoryStore


def test_cross_listed_item_counts_once_missing_hazard_flagged():
    e = dict(id='e', item_id='i', listing_id='l', site='ebay', kind='sale', E=.5, u=.1, at='2026-09-01')
    out = fold_events([e, e, dict(e, id='retry')], '2026-09-01')
    assert out['ebay']['O'] == 1 and out['ebay']['E'] == .5
    missing = fold_events([dict(e, E=None)], '2026-09-01')['ebay']
    assert 'not_reported' in missing['flags'] and missing['E'] is None
    assert fold_events([e], '2026-11-30')['ebay']['O'] == .5


def test_prior_refit_excludes_ebay_and_unconsenting():
    rows = [dict(site='poshmark', consent=True, O=10, E=4, u=[.1,.2], sigma=.3)] * 10
    fit = fit_priors(rows)
    assert fit['basis_count'] == 10 and fit['m'] > 0 and fit['m_g'] > 0
    assert fit_priors(rows + [dict(rows[0], site='ebay', O=999), dict(rows[0], consent=False, O=999)]) == fit


def test_nightly_gate_bad_challenger_and_rollback(log_lines):
    log, lines = log_lines
    store = MemoryStore()
    train = [dict(id=str(i), site='poshmark', consent=True, O=10, E=4, u=[.1], sigma=.2) for i in range(10)]
    held = [dict(id=str(i), at='2026-10-20', O=2, E=1, P=.4, y=1) for i in range(300)]
    kw = dict(store=store, train=train, held=held, at='2026-11-01', scope={'kind':'jackets'}, seed=7, log=log)
    assert nightly(**{**kw, 'held':held[:299]})['fallback'] == 'parent'
    a = nightly(**kw)
    assert a['promoted']
    bad = [dict(r, y=0) for r in held]
    assert not nightly(**{**kw, 'held':bad})['promoted']
    better = [dict(r, O=3) for r in held]
    stronger = [dict(r, O=20, E=1) for r in train]
    assert nightly(**{**kw, 'held':better, 'train':stronger})['promoted']
    assert store.rollback('site_effect.prior', {'kind':'jackets'}, '2026-11-02')['version'] == 1
    assert any(r['event'] == 'state.change' for r in lines)


def test_guard_clamps_and_two_se_anomaly():
    assert guard_effect(10, 1, .2)['value'] == 3
    assert guard_effect(10, 1, .2)['anomaly']
    assert guard_effect(.01, 1, 2)['value'] == .33


def test_unrelated_supplied_predictions_cannot_promote_a_fit():
    train=[dict(id='t',site='poshmark',consent=True,O=10,E=4,u=[],sigma=.2)]*10
    held=[dict(id=str(i),at='2026-10-20',O=0,E=0,P=.4,y=1,champion=.01,challenger=.99) for i in range(300)]
    assert not nightly(MemoryStore(),train,held,'2026-11-01',{},seed=1)['promoted']


def test_training_hash_uses_training_ids():
    import hashlib
    train=[dict(id='train_only',site='poshmark',consent=True,O=10,E=4,u=[],sigma=.2)]
    held=[dict(id=str(i),at='2026-10-20',O=2,E=1,P=.4,y=1,champion=.01,challenger=.99) for i in range(300)]
    store=MemoryStore()
    nightly(store,train,held,'2026-11-01',{},seed=1)
    assert store.history('site_effect.prior',{})[0]['fitted_on_ids_hash']==hashlib.sha256(b'train_only').hexdigest()
