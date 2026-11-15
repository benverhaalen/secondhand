"""rs-5: passed-over floor, pinned facets, held-out-only learning and rollback."""
from datetime import datetime, timedelta
import pytest
from style.edits import PersonState, reset
from style.learn import impression, dismiss, fit_ranker, predict, guarded_weights, nightly, ndcg
from param.registry import MemoryStore

NOW=datetime(2026,11,15)


def test_passed_over_retries_not_compounded_pinned_and_reset():
    s=PersonState('p',facets=[dict(name='brand',value='A',weight=.8,recipient=None,pinned=False),dict(name='size',value='M',weight=.7,recipient=None,pinned=True)])
    for i in range(10):
        impression(s,str(i),dict(brand='A',size='M'),tapped=False,pooled_mean=.5)
    assert s.facets[0]['weight']==.4 and s.facets[1]['weight']==.7
    impression(s,'9',dict(brand='A'),tapped=False,pooled_mean=.5)
    assert s.facets[0]['weight']==.4
    reset(s,NOW)
    assert s.facets==[] and not s.passed and not s.seen


def test_dismiss_drops_cluster_from_every_recipient_cache():
    s=PersonState('p',shelf=[dict(recipient=None,shelf=[dict(id='a',cluster_id='c'),dict(id='b',cluster_id='d')]),dict(recipient='child',shelf=[dict(id='x',cluster_id='c')])])
    dismiss(s,'c')
    assert s.stale and [r['id'] for r in s.shelf[0]['shelf']]==['b'] and s.shelf[1]['shelf']==[]


def test_fit_ignores_referral_weights_sign_and_want_largest():
    rows=[dict(features=dict(want=i%2,deal=.5,q=1),saved=i%2,tapped=0) for i in range(100)]
    a=fit_ranker(rows)
    b=fit_ranker([dict(r,referral=999,commission=999,placement=999) for r in rows])
    assert a==b
    assert predict(a,dict(want=1,deal=.5,q=1))>predict(a,dict(want=0,deal=.5,q=1))
    w=guarded_weights(dict(want=1,save=99,follow=-99,not_for_me=99))
    assert w['want']==1 and .4<=w['save']<=1 and w['follow']>0 and w['not_for_me']<0


def test_ndcg_and_nightly_gate_bad_model_then_rollback(log_lines):
    log,_=log_lines
    assert ndcg([1,0],[1,0])==1 and ndcg([1,0],[0,1])<1
    store=MemoryStore()
    train=[dict(consent=True,id='t'+str(i),at=NOW-timedelta(days=20),features=dict(deal=i%2,q=1),saved=i%2,tapped=0) for i in range(100)]
    held=[dict(consent=True,id=str(i),query_id=str(i//10),at=NOW-timedelta(days=1),features=dict(deal=i%2,q=1),saved=i%2,tapped=0,champion=1-i%2) for i in range(2000)]
    kw=dict(store=store,rows=train+held,now=NOW,scope={'kind':'coat'},seed=1,log=log)
    assert nightly(**{**kw,'rows':train+held[:1999]})['fallback']=='parent'
    result=nightly(**kw)
    assert result['promoted']
    assert store.champion('style.ranker',{'kind':'coat'})['n_eff']==100
    bad=[dict(r,features=dict(deal=1-r['saved'],q=1),champion=r['saved']) for r in held]
    assert not nightly(**{**kw,'rows':train+bad})['promoted']
    # A second first-champion round trip exercises the registry rollback contract.
    cur=store.champion('style.ranker',{'kind':'coat'})
    ch=store.propose(dict(cur,held_out_score=cur['held_out_score']+.01),cur['version']+1)
    assert store.promote('style.ranker',{'kind':'coat'},ch['version'],0,'2026-11-16')[0]
    assert store.rollback('style.ranker',{'kind':'coat'},'2026-11-17')['version']==1


def test_source_weights_do_not_inherit_the_logistic_rankers_win():
    train=[dict(id='t'+str(i),consent=True,at=NOW-timedelta(days=20),features=dict(deal=i%2,q=1),saved=i%2,tapped=0) for i in range(100)]
    held=[dict(id=str(i),consent=True,query_id=str(i//10),at=NOW-timedelta(days=1),features=dict(deal=i%2,q=1),saved=i%2,tapped=0,champion=0) for i in range(2000)]
    store=MemoryStore()
    result=nightly(store,train+held,NOW,{},seed=2)
    assert result['promoted']
    assert store.champion('style.source_weights',{}) is None


def test_promoted_source_weights_feed_existing_facet_compute():
    from style.facets import Event, compute
    def features(i):
        return dict(want=1-i%2,save=1.1*(i%2),deal=1,q=1)
    train=[dict(id='t'+str(i),consent=True,at=NOW-timedelta(days=20),features=features(i),saved=i%2,tapped=0) for i in range(100)]
    held=[dict(id=str(i),consent=True,query_id=str(i//10),at=NOW-timedelta(days=1),features=features(i),saved=i%2,tapped=0) for i in range(2000)]
    store=MemoryStore()
    assert nightly(store,train+held,NOW,{},seed=2)['source_weights_promoted']
    weights=store.champion('style.source_weights',{})['value_or_hyperparams']
    events=[Event(str(i),'p','save',NOW-timedelta(days=i+1),dict(brand='A')) for i in range(3)]
    assert compute(events,NOW,weights=weights).facets
