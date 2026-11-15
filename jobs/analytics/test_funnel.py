"""pa-2: money is nullable, stage definitions survive, physical items count once."""
import pytest
from analytics.funnel import listing_funnel, metric, money_rows, sale_orders


def test_fixture_kept_and_speed(load_fixture):
    result = money_rows(load_fixture('orders/listings.json'), load_fixture('orders/orders.json'))
    expected = load_fixture('orders/expected.json')
    for site, values in expected['per_site'].items():
        assert all(result[site][key] == value for key, value in values.items()), site
    assert result['poshmark']['flags'] == ['estimated', 'not_reported']


def test_missing_field_is_flagged_not_zero():
    row = listing_funnel([dict(listing_id='l', item_id='i', site='ebay', day='2026-09-01',
        stages={'exposure': None, 'interest': 4}, terms={}, flags=['not_reported'])])
    assert row['stages']['exposure'] is None
    assert 'not_reported' in row['flags']
    assert row['stages']['interest'] == 4


def test_gauges_are_latest_not_summed_and_reset_days_dropped():
    base = dict(listing_id='l', item_id='i', site='ebay', terms={}, flags=[])
    rows = [{**base, 'day': '2026-09-01', 'stages': {'attention': 10, 'interest': 3}},
            {**base, 'day': '2026-09-02', 'stages': {'attention': 20, 'interest': 4}}]
    assert listing_funnel(rows)['stages'] == {'attention': 30, 'interest': 4}
    rows[1]['flags'] = ['counter_reset']
    assert listing_funnel(rows)['stages']['attention'] == 10


def test_cross_listed_item_counted_once(load_fixture):
    orders = load_fixture('orders/orders.json')
    assert len(sale_orders(orders + [dict(orders[0], id='duplicate')])) == 6
    rows = [dict(item_id='i', site=s, value=1, flags=[]) for s in ('ebay', 'poshmark')]
    assert metric(rows, 'sales')['value'] == 1
    with pytest.raises(ValueError, match='definition'):
        metric(rows, 'views')


def test_share_of_asking_needs_six_pairs():
    listings = [dict(id=f'l{i}', item_id=f'i{i}', site='ebay', posted_at='2026-09-01', ended_at='2026-09-03', price_cents=100) for i in range(6)]
    orders = [dict(id=f'o{i}', listing_id=f'l{i}', item_id=f'i{i}', site='ebay', kind='sale', state='delivered', price_cents=80, payout_cents=80, lines=[]) for i in range(6)]
    assert money_rows(listings, orders)['ebay']['share_of_asking'] == .8
    assert money_rows(listings, orders[:5])['ebay']['share_of_asking'] is None


def test_metric_views_preserve_person_scope():
    from pathlib import Path
    sql=Path(__file__).with_name('views.sql').read_text()
    assert 'PARTITION BY user_id, item_id' in sql
    assert 'GROUP BY user_id, site' in sql
    assert 'SELECT user_id, listing_id' in sql


def test_per_site_stage_definitions_and_furthest_stage():
    from analytics.funnel import site_funnels
    base=dict(site='ebay',day='2026-09-01',terms=dict(attention=dict(site_term='views',definition='listing page views')),flags=[])
    rows=[dict(base,listing_id='a',item_id='i',stages=dict(attention=2)),dict(base,listing_id='b',item_id='j',stages=dict(attention=3))]
    assert listing_funnel(rows[:1])['furthest_stage']=='attention'
    result=site_funnels(rows)
    assert result['ebay']['stages']['attention']==5
    assert result['ebay']['terms']==base['terms']


def test_speed_starts_at_first_post_even_after_relist():
    listings=[dict(id='old',item_id='i',site='ebay',posted_at='2026-09-01',ended_at='2026-09-03'),dict(id='new',item_id='i',site='ebay',posted_at='2026-09-05',ended_at='2026-09-10')]
    order=dict(id='o',item_id='i',listing_id='new',site='ebay',kind='sale',state='delivered',price_cents=100,payout_cents=100,lines=[])
    assert money_rows(listings,[order])['ebay']['days_to_sell']==[9]
