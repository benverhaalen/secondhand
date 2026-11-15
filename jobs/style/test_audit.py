"""Regression cases for recommendation-and-style audit R1–R8."""
from datetime import datetime, timedelta
import math
import pytest
from style.facets import Event, compute
from style.edits import PersonState
from style.rank import score, within_bands, for_you, alert
from style.alternatives import alternatives
from style.sell_now import sell_now
from style.learn import ndcg
from style.test_rank import listing, state

NOW = datetime(2026, 11, 15)


def test_sold_history_uses_spec_weights_and_cites_exact_events():
    events = [Event(str(i), 'p', 'sold', NOW-timedelta(days=i), dict(brand='A', category='coat', size='M')) for i in range(3)]
    result = compute(events, NOW)
    brand = next(f for f in result.facets if f['name']=='brand')
    assert brand['a'] == pytest.approx(sum(.2*.5**(i/365) for i in range(3)))
    assert brand['citation']['basis_ids'] == ['0','1','2']
    assert brand['guarded']['weight']['state'] == 'shown'


@pytest.mark.parametrize('field,value', [('delivered_cents', x) for x in [-1,0,1.5,math.nan,math.inf,2**53]] + [('low',-1),('low',1.5),('low',math.nan),('high',math.inf),('high',10)])
def test_invalid_money_and_ranges_refused(field, value):
    with pytest.raises(ValueError, match=field if field!='high' else 'high|range'):
        score(listing(**{field:value}),state())


def test_nonfinite_quality_is_hidden_multiplier():
    assert score(listing(quality=dict(state='shown',value=math.nan)),state())['score'] == score(listing(),state())['score']


def test_future_events_excluded_and_equal_time_replay_stable():
    events=[Event(str(i),'p','save',NOW-timedelta(days=i),dict(brand='A')) for i in range(3)]
    future=Event('future','p','not_for_me',NOW+timedelta(seconds=1),dict(brand='A'))
    assert compute(events+[future],NOW).as_dict()==compute(events,NOW).as_dict()
    tied=[Event('b','p','purchase',NOW,dict(brand='A')),Event('a','p','save',NOW,dict(brand='A'))]
    assert compute(tied,NOW).as_dict()==compute(reversed(tied),NOW).as_dict()


def test_brand_size_basis_uses_only_defining_brand():
    events=[Event('a'+str(i),'p','save',NOW-timedelta(days=i),dict(brand='A',category='coat',size='M')) for i in range(3)]
    events += [Event('b'+str(i),'p','purchase',NOW-timedelta(days=i),dict(brand='B',category='coat',size='L')) for i in range(4)]
    f=next(f for f in compute(events,NOW).facets if f['name']=='size' and f.get('brand')=='A')
    assert f['from']=='saved'
    assert f['citation']['basis_ids']==['a0','a1','a2']


def test_removed_size_does_not_filter_alternatives_and_numbers_cited():
    s=PersonState('p',facets=[dict(name='size',value='S',recipient=None,removed_at=NOW)])
    target=dict(category='coat',function='warm',material='wool',condition='good',p50=100)
    row=dict(id='a',category='coat',function='warm',material='wool',condition='good',p50=70,similarity=.8,attrs=dict(size='M'))
    result=alternatives(target,[row],s,as_of=NOW)[0]
    assert result['guarded']['p50']['value']==70
    assert result['citation']['basis_ids']


@pytest.mark.parametrize('field,value',[('p50_now',-1),('p50_now',math.nan),('p50_now',1.5),('p50',-1),('p50',math.inf)])
def test_sell_now_refuses_impossible_money(field,value):
    item=dict(id='i',person='p',state='owned',product_id='x',attrs=dict(brand='A'),p50_now=100)
    fc=dict(id='fc',subject=dict(kind='product',id='x'),metric='median_sold_price_cents',horizon_weeks=12,p50=80,state='shown',as_of='2026-11-01')
    (item if field=='p50_now' else fc)[field]=value
    with pytest.raises(ValueError,match=field):
        sell_now([item],[fc],PersonState('p'),{},NOW)


def test_unidentified_products_have_independent_alert_spacing():
    s=state(); s.stale=False; s.alert_bar=0
    assert alert(s,listing('a',product_id=None),NOW)
    assert alert(s,listing('b',product_id=None),NOW)
    assert not alert(s,listing('a',product_id=None),NOW)


def test_band_and_ndcg_ties_use_stable_identifiers():
    rows=[listing('z'),listing('a')]
    assert [r['id'] for r in within_bands(rows,state())]==['a','z']
    assert ndcg([1,0],[1,1],ids=['z','a'])==ndcg([0,1],[1,1],ids=['a','z'])


def test_count_gates_blend_with_shared_prior():
    shared=[dict(name='brand',value='A',weight=.8,recipient=None,count=10,**{'from':'saved'})]
    cold=compute([],NOW,shared_facets=shared).facets[0]
    warm=compute([Event('a','p','save',NOW,dict(brand='A'))],NOW,shared_facets=shared).facets[0]
    assert cold['weight']==.8 and warm['weight']<.8
    assert warm['basis_level']=='person'
    assert for_you(PersonState('new'),[listing()],NOW,opted_in=True,signal_count=0)


def test_declared_params_are_read_and_missing_resolved_values_refused():
    from style.params import DECLARED, resolve
    reads=[]
    def read(name,scope):
        reads.append((name,scope))
        d=next(d for d in DECLARED if d['name']==name)
        return dict(value=d['prior'],version=7)
    p=resolve(read,dict(kind='coat'))
    assert len(reads)==len(DECLARED)
    assert all(d['source'].startswith('spec/') and d['scopes'] for d in DECLARED)
    events=[Event(str(i),'p','sold',NOW-timedelta(days=i),dict(brand='A')) for i in range(3)]
    assert set(compute(events,NOW,params=p).facets[0]['citation']['param_versions'].values())=={7}
    p['values'].pop('style_sold_taste')
    with pytest.raises(KeyError,match='style_sold_taste'):
        compute(events,NOW,params=p)


def test_thin_size_and_taste_blend_instead_of_claiming_full_confidence():
    event=Event('a','p','save',NOW,dict(brand='A',category='coat',size='M'))
    facets=compute([event],NOW).facets
    size=next(f for f in facets if f['name']=='size')
    assert 0<size['weight']<.5
    more=compute([event,Event('b','p','save',NOW,dict(brand='A',category='coat',size='M'))],NOW).facets
    assert next(f for f in more if f['name']=='size')['weight']>size['weight']


def test_resolved_values_change_each_calculation_and_proof_versions():
    from style.params import resolve
    p=resolve(); p['values']['style_deal_low']=.7
    assert score(listing(),state(),params=p)['score']==pytest.approx(.42)
    p['values']['style_product_cap']=1
    shelf=for_you(state(),[listing('a',product_id='x'),listing('b',product_id='x')],NOW,opted_in=True,signal_count=3,params=p)
    assert len(shelf)==1
    p['values']['style_sold_taste']=.3
    ev=Event('sold','p','sold',NOW,dict(brand='A'))
    assert compute([ev],NOW,params=p).facets[0]['a']==.3


def test_sell_now_guards_combined_basis_and_breaks_forecast_ties_by_id():
    item=dict(id='i',person='p',state='owned',product_id='x',attrs=dict(brand='A'),p50_now=100)
    fc=dict(id='a',subject=dict(kind='product',id='x'),metric='median_sold_price_cents',horizon_weeks=12,p50=80,state='shown',as_of='2026-11-01')
    old=dict(name='brand',value='A',weight=1,recipient=None)
    rows=[fc,dict(fc,id='z',p50=70)]
    a=sell_now([item],rows,PersonState('p'),{'i':[old]},NOW)
    assert a==sell_now([item],reversed(rows),PersonState('p'),{'i':[old]},NOW)
    result=a['items'][0]
    assert result['forecast_id']=='z'
    assert result['citation']['basis_ids']==['i','z']
    assert result['guarded']['fit_now']['state']=='shown'


def test_shared_prior_cannot_restore_removed_facet_without_new_events():
    from style.edits import remove, fold
    s=PersonState('p')
    remove(s,'brand','A',NOW)
    shared=[dict(name='brand',value='A',weight=.8,recipient=None,count=8,**{'from':'saved'})]
    assert fold(s,[],NOW,shared_facets=shared)==[]


def test_cache_rebuild_replaces_old_recipient_entry():
    s=state()
    for_you(s,[listing('a')],NOW,opted_in=True,signal_count=0,recipient='son')
    for_you(s,[listing('b')],NOW,opted_in=True,signal_count=1,recipient='son')
    caches=[c for c in s.shelf if c['recipient']=='son']
    assert len(caches)==1 and caches[0]['shelf'][0]['id']=='b'


def test_same_size_in_distinct_categories_remains_two_facets_after_fold():
    from style.edits import fold
    events=[Event('coat','p','save',NOW,dict(category='coat',size='M')),Event('trousers','p','save',NOW,dict(category='trousers',size='M'))]
    expected={'coat','trousers'}
    assert {f['category'] for f in compute(events,NOW).facets if f['name']=='size'}==expected
    assert {f['category'] for f in fold(PersonState('p'),events,NOW) if f['name']=='size'}==expected


def test_passed_over_number_and_guarded_citation_agree():
    from style.learn import impression
    s=PersonState('p',facets=compute([Event('a','p','save',NOW,dict(brand='A'))],NOW).facets)
    for i in range(10):
        impression(s,str(i),dict(brand='A'),tapped=False,pooled_mean=.5)
    f=s.facets[0]
    assert f['weight']==f['guarded']['weight']['value']==f['citation']['values']['weight']


def test_equal_source_contributions_choose_same_reason_after_permutation():
    es=[Event('a','p','want',NOW,dict(brand='A')),Event('b','p','purchase',NOW,dict(brand='A'))]
    weights={'want':(1.,1.),'purchase':(1.,1.)}
    a=compute(es,NOW,weights=weights).facets[0]
    b=compute(reversed(es),NOW,weights=weights).facets[0]
    assert a==b and a['from']=='bought'


def test_alternative_invalid_similarity_and_money_refused():
    target=dict(category='coat',function='warm',material='wool',condition='good',p50=100)
    row=dict(id='a',category='coat',function='warm',material='wool',condition='good',p50=70,similarity=.8,attrs={})
    for field,value in [('p50',1.5),('p50',-1),('similarity',math.nan),('similarity',1.1)]:
        with pytest.raises(ValueError,match=field):
            alternatives(target,[dict(row,**{field:value})],PersonState('p'))


def test_invalid_param_reads_refuse_before_calculation():
    from style.params import DECLARED, resolve
    for name,value in [('style_half_life_days',0),('style_alert_quantile',2),('style_tap_prior',dict(alpha=0,beta=1)),('style_seller_window',2.5)]:
        def read(key,scope):
            return dict(value=value if key==name else next(d['prior'] for d in DECLARED if d['name']==key),version=1)
        with pytest.raises(ValueError,match=name):
            resolve(read,{})


def test_shared_facet_count_matches_guard_and_future_relisting_is_not_past_evidence():
    shared=[dict(name='brand',value='A',weight=.8,recipient=None,count=8,**{'from':'saved'})]
    f=compute([],NOW,shared_facets=shared).facets[0]
    assert f['count']==f['guarded']['count']['value']
    e=Event('a','p','purchase',NOW,dict(brand='A'),listed_at=NOW+timedelta(days=1))
    assert compute([e],NOW).facets
