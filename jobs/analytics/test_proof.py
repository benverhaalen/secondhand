"""pa-7: synthetic fixture replay, mix simulation, and explicit real-data gaps."""
from analytics.proof.run import fixed_set, simulated_mix, speed


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
    result = speed(seed=21, runs=20)
    assert result['p95_ms'] < 300
    assert result['draws'] == 1000
