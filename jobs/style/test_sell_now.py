"""rs-4: M17 bars, removal, owned-only forecasts, no referral influence."""
from datetime import datetime
import pytest
from style.edits import PersonState, reset
from style.alternatives import alternatives
from style.sell_now import sell_now

NOW=datetime(2026,11,15)


def facet(brand, weight):
    return dict(name='brand',value=brand,weight=weight,recipient=None,removed_at=None)


def test_alternative_bars_removal_referral_and_reset():
    s=PersonState('p',facets=[facet('A',.5)])
    target=dict(category='coat',function='warm',material='wool',condition='good',p50=100)
    row=dict(id='a',category='coat',function='warm',material='wool',condition='good',p50=70,similarity=.8,attrs=dict(brand='A',size='M'))
    assert alternatives(target,[row],s)[0]['score']==pytest.approx(1.2)
    assert alternatives(target,[dict(row,referral=999)],s)==alternatives(target,[row],s)
    for patch in (dict(similarity=.74),dict(p50=76),dict(material=None),dict(condition=None),dict(category='shoe')):
        assert alternatives(target,[dict(row,**patch)],s)==[]
    s.removed[(None,'brand','A')]=NOW
    s.facets=[]
    assert alternatives(target,[row],s)==[]
    reset(s,NOW)
    assert s.facets==[] and alternatives(target,[row],s)[0]['score']==.8


def test_fc_fixture_only_shown_twelve_week_price_used(load_fixture):
    fc=load_fixture('fc/forecasts.json')
    s=PersonState('p',facets=[facet('A',.3)])
    item=dict(id='i',person='p',state='owned',product_id='product_fx2',attrs=dict(brand='A'),p50_now=5000)
    result=sell_now([item], [dict(f,state='shown') for f in fc],s,{'i':[facet('A',1)]},NOW)
    assert result['items'][0]['sell_now']==pytest.approx(.2*1.2)
    assert result['items'][0]['forecast_id']=='fc_fx10'
    assert sell_now([item], [dict(f,state='hidden') for f in fc],s,{'i':[facet('A',1)]},NOW)['hidden_count']==1


def test_successor_drop_first_referral_unchanged_and_not_owned_excluded():
    s=PersonState('p',facets=[facet('A',.5)])
    rows=[dict(id=str(i),person='p',state='owned',product_id=str(i),attrs=dict(brand='A'),p50_now=100) for i in range(3)]
    fc=[dict(id='fc_'+str(i),subject=dict(kind='product',id=str(i)),metric='median_sold_price_cents',horizon_weeks=12,p50=80 if i==0 else 100,state='shown',as_of='2026-11-01') for i in range(3)]
    purchase={r['id']:[facet('A',1)] for r in rows}
    a=sell_now(rows,fc,s,purchase,NOW)
    assert a['items'][0]['id']=='0'
    assert sell_now([dict(r,commission=999) for r in rows],fc,s,purchase,NOW)==a
    assert sell_now([dict(rows[0],state='sold')],fc,s,purchase,NOW)['items']==[]
    reset(s,NOW)
    assert s.facets==[]
    assert sell_now(rows,fc,s,purchase,NOW)['items'][0]['fit_now']==0


def test_returned_trait_allows_alternatives_after_three_new_events():
    from datetime import timedelta
    from style.edits import remove, fold
    from style.facets import Event
    s=PersonState('p')
    remove(s,'brand','A',NOW)
    events=[Event(str(i),'p','save',NOW+timedelta(days=i+1),dict(brand='A')) for i in range(3)]
    fold(s,events,NOW+timedelta(days=4))
    target=dict(category='coat',function='warm',material='wool',condition='good',p50=100)
    row=dict(id='a',category='coat',function='warm',material='wool',condition='good',p50=70,similarity=.8,attrs=dict(brand='A'))
    assert alternatives(target,[row],s)
