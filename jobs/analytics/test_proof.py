"""pa-7: synthetic fixture replay, mix simulation, and explicit real-data gaps."""
import math
from time import perf_counter
from analytics.proof.run import fixed_set, simulated_mix
from analytics.site_effect import compare


def test_fixed_fixture_cross_listing_and_missing_flags(load_fixture):
    result = fixed_set(load_fixture('orders/listings.json'), load_fixture('orders/orders.json'), load_fixture('orders/manifest.json'))
    assert result['censored'] == ['ls_fx2e']
    assert result['money'] == load_fixture('orders/expected.json')['per_site']
    assert result['real_proof'] == 'not usable yet'
    assert '150 real ended listings' in result['missing']
    assert result['missing_hazard_flagged']


def test_expensive_mix_raw_worse_but_adjusted_covers_planted_effect():
    result = simulated_mix(seed=21, runs=100)
    assert result['coverage'] >= 85
    assert result['raw_ranks_expensive_worse'] >= 85
    assert result == simulated_mix(seed=21, runs=100)


def test_by_site_draws_speed():
    sites = {s: dict(O=6, E=5, u=[0]*6, P=.4, fair_p50=60, market_mean=-.1, sigma=.2, ended=10, flags=[])
             for s in ('ebay', 'poshmark', 'depop', 'mercari', 'facebook')}
    times = []
    for i in range(20):
        start = perf_counter()
        compare(sites, lambda site, price: math.floor(.8*price + .5), seed=21+i, draws=1000)
        times.append((perf_counter()-start)*1000)
    assert sorted(times)[math.ceil(.95*len(times))-1] < 300
