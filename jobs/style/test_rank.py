"""rs-3: hard filters, bands, caps, referral invariance, reset, cache isolation."""
from datetime import datetime, timedelta
import pytest
from style.edits import PersonState, reset
from style.rank import score, within_bands, for_you, alert

NOW = datetime(2026, 11, 15)


def listing(i='x', **kw):
    return dict(dict(id=i, state='live', person='other', product_id=i, seller_ref_hash=i, fits=True, recalled=False,
                     label='exact', attrs=dict(brand='Patagonia', size='M'), delivered_cents=20, low=20, high=40,
                     quality=None, posted_at='2026-11-01', band=0), **kw)


def state():
    return PersonState('p', facets=[dict(name='brand',value='Patagonia',weight=.6,recipient=None,pinned=False,removed_at=None,count=3)])


def test_referral_attached_order_unchanged_and_cache_clean():
    rows = [listing(str(i), delivered_cents=20+i) for i in range(8)]
    s = state()
    a = for_you(s, rows, NOW, opted_in=True, signal_count=3)
    tagged = [dict(r, referral=100-i, commission=1000, placement=-i) for i,r in enumerate(rows)]
    s.stale = True
    assert for_you(s, tagged, NOW, opted_in=True, signal_count=3) == a
    assert all(set(r) == {'id','score','reason','source','cluster_id','product_id','seller_ref_hash'} for r in a)


def test_score_deal_quality_intent_and_hard_filters():
    s = state()
    assert score(listing(), s)['score'] == .6
    assert score(listing(delivered_cents=40,quality=dict(state='shown',value=100)),s)['score'] == pytest.approx(.36)
    assert score(listing(),s,intent=[dict(name='size',value='M',confidence=.5)])['score'] == 1.1
    for kw in (dict(state='sold'),dict(fits=False),dict(recalled=True),dict(person='p'),dict(label='similar')):
        assert score(listing(**kw), s) is None


def test_band_order_first_then_score_then_original_buy_ties():
    s = state()
    rows = [listing('a',band=1),listing('b',band=0,delivered_cents=40),listing('c',band=0),listing('d',band=0)]
    assert [r['id'] for r in within_bands(rows,s)] == ['c','d','b','a']


def test_shelf_product_and_seller_caps_opt_in_and_recipient_isolation():
    s = state()
    rows = [listing(str(i),product_id=str(i//4),seller_ref_hash=str(i//10)) for i in range(100)]
    shelf = for_you(s,rows,NOW,opted_in=True,signal_count=3)
    assert len(shelf) <= 40
    assert all(sum(x['product_id']==r['product_id'] for x in shelf)<=2 for r in shelf)
    assert all(sum(x['seller_ref_hash']==r['seller_ref_hash'] for x in shelf[j:j+20])<=3 for j in range(len(shelf)) for r in shelf[j:j+20])
    assert for_you(s,rows,NOW,opted_in=False,signal_count=3)==[]
    assert for_you(s,rows,NOW,opted_in=True,signal_count=2)==[]


def test_reset_clears_facets_and_cached_scores_alerts_spaced():
    s = state()
    for_you(s,[listing()],NOW,opted_in=True,signal_count=3)
    s.alert_bar = .5
    assert alert(s,listing(),NOW)
    assert not alert(s,listing('y',product_id='x'),NOW+timedelta(days=1))
    reset(s,NOW)
    assert s.facets == [] and s.shelf is None and s.alert_bar is None
    assert not alert(s,listing('z'),NOW)
