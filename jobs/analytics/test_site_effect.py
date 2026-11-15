"""pa-3: exposure stops at a cross-site sale; posteriors shrink and draws replay."""
import math
import pytest
from analytics.site_effect import exposure, sale_effect, price_effect, compare, cross_listed


def test_cross_listed_item_censored_not_unsold(load_fixture):
    listings = load_fixture('orders/listings.json')
    rows = exposure(listings, load_fixture('orders/orders.json'), {r['id']: .1 for r in listings}, '2026-09-15T00:00:00Z')
    censored = [r for r in rows if r['censored']]
    assert [r['listing_id'] for r in censored] == ['ls_fx2e']
    assert censored[0]['days'] == 3 and not censored[0]['sold'] and not censored[0]['unsold']
    assert sum(r['sold'] for r in rows) == 6
    assert sum(r['sold'] for r in exposure(listings + [listings[0]], load_fixture('orders/orders.json'), {r['id']: .1 for r in listings}, '2026-09-15T00:00:00Z')) == 6


def test_missing_hazard_is_flagged_never_zero(load_fixture):
    rows = exposure(load_fixture('orders/listings.json'), load_fixture('orders/orders.json'), {}, '2026-09-15T00:00:00Z')
    assert all(r['E'] is None and 'not_reported' in r['flags'] for r in rows)


def test_worked_posterior_and_no_data_prior():
    assert sale_effect(6, 5)['mean'] == 1.1
    assert sale_effect(4, 2.5)['mean'] == 1.2
    assert sale_effect(0, 0)['mean'] == 1
    p = price_effect([math.log(1.1)] * 5, sigma=.2)
    assert p['mean'] == pytest.approx(math.log(1.1) / 2)
    assert p['se'] == pytest.approx(.2 / math.sqrt(10))
    with pytest.raises(ValueError):
        sale_effect(1, -1)


def test_value_draws_seeded_verdict_blends_ended_basis():
    sites = dict(ebay=dict(O=100, E=10, u=[.1]*100, P=.7, fair_p50=60, market_mean=0, sigma=.05, ended=4, flags=[]),
                 poshmark=dict(O=1, E=50, u=[-.1], P=.1, fair_p50=60, market_mean=0, sigma=.05, ended=50, flags=['late']))
    a = compare(sites, lambda site, price: math.floor(price * .8 + .5), seed=3)
    assert a == compare(sites, lambda site, price: math.floor(price * .8 + .5), seed=3)
    assert a['verdict'] == 'ebay'
    assert a['sites']['ebay']['basis_level'] == 'kind'
    assert a['sites']['poshmark']['flags'] == ['late']
    sites['ebay']['ended'] = 5
    assert compare(sites, lambda site, price: math.floor(price * .8 + .5), seed=3)['verdict'] == 'ebay'


def test_sign_check_requires_seven_days_overlap():
    pairs = [dict(days=7, winner='poshmark')] * 10
    assert cross_listed(pairs, 'ebay')['anomaly']
    assert not cross_listed([dict(days=6, winner='poshmark')]*10, 'ebay')['anomaly']
