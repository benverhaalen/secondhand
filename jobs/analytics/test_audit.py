"""Regression checks for spec/engines/audit.md, Platform analytics."""
import copy
import json
import math
from pathlib import Path

import pytest
from analytics import funnel, learn, normalise, placement, site_effect, beside
from param.registry import MemoryStore


def site(**changes):
    return dict(O=0, E=0, u=[], sigma=0, P=1, fair_p50=101,
                market_mean=0, ended=0, basis=[dict(id='order', at='2026-09-01', source='orders')], **changes)


def test_leakage_requires_disjoint_past_training():
    held = [dict(id='h', at='2026-10-20', O=2, E=1, P=.4, y=1)]
    train = dict(id='t', at='2026-09-01', site='poshmark', consent=True, O=10, E=4, u=[], sigma=.2)
    for change in ({'id': 'h'}, {'at': '2026-10-02'}, {'at': None}):
        with pytest.raises(ValueError, match='train'):
            learn.nightly(MemoryStore(), [dict(train, **change)], held, '2026-11-01', {}, seed=1, min_ended=1)


def test_fold_price_contract_preserves_decayed_sample_weight():
    event = dict(id='e', item_id='i', listing_id='l', site='ebay', kind='sale', E=1, u=.4, at='2026-09-01')
    folded = learn.fold_events([event], '2026-11-30')['ebay']
    assert folded['n_eff'] == .5
    price = site_effect.price_effect(folded, .2)
    assert price['mean'] == pytest.approx(.2 / 5.5)


@pytest.mark.parametrize('bad', [float('nan'), float('inf'), -1])
def test_posterior_domains_refuse_bad_numbers(bad):
    with pytest.raises(ValueError):
        site_effect.sale_effect(bad, 1)
    with pytest.raises(ValueError):
        site_effect.adjusted_probability(.5, bad)
    if not math.isfinite(bad):
        with pytest.raises(ValueError):
            site_effect.price_effect([bad], .2)


def test_tied_draws_split_and_model_prices_are_integer_cents():
    seen = []
    def keep(s, price):
        seen.append(price)
        assert isinstance(price, int)
        return price
    out = site_effect.compare({'a': site(), 'b': site()}, keep, seed=1)
    assert out['sites']['a']['P_best'] == .5
    assert out['sites']['b']['P_best'] == .5
    assert seen
    with pytest.raises(ValueError, match='keep'):
        site_effect.compare({'a': site()}, lambda s, p: 1.5, seed=1)


def test_money_rounds_half_up_and_refuses_invalid_lines():
    orders = [dict(id=str(i), item_id=str(i), site='ebay', kind='sale', state='delivered',
                   payout_cents=v, lines=[]) for i, v in enumerate((100, 101))]
    assert funnel.money_rows([], orders)['ebay']['kept_per_sold_item_cents'] == 101
    for bad in (1.5, -1, math.nan, 2**53):
        with pytest.raises(ValueError, match='amount_cents'):
            funnel.money_rows([], [dict(orders[0], lines=[dict(kind='label', amount_cents=bad)])])


def test_sales_conflict_is_refused_in_both_input_orders():
    a = dict(id='a', item_id='i', site='ebay', kind='sale', state='delivered')
    b = dict(a, id='b', site='poshmark')
    for rows in ([a, b], [b, a]):
        with pytest.raises(ValueError, match='conflicting sale'):
            funnel.sale_orders(rows)


def test_daily_snapshots_deduplicate_and_sparse_days_stay_unknown():
    a = dict(id='a', listing_id='l', item_id='i', site='ebay', day='2026-09-01', stages={'attention': 10}, terms={}, flags=[])
    b = dict(a, id='b', day='2026-09-03')
    out = funnel.listing_funnel([a, a, b])
    assert out['stages']['attention'] == 20
    assert out['days'] == 3
    assert out['rates']['attention'] is None
    assert 'not_reported' in out['flags']


def test_normalise_scopes_baseline_and_refuses_ambiguous_timestamps():
    def read(s, at, value):
        return dict(site=s, listing_id='same', item_id='i', posted_at='2026-09-01T00:00:00Z', read_at=at,
                    route='harness', payload=dict(impressions=value, clicks=value, views=value, likes=1, offers=0))
    rows = [read(s, f'2026-09-0{day}T12:00:00Z', n) for s, n in [('poshmark', 100), ('mercari', 5)] for day in (1, 2)]
    assert all('counter_reset' not in r['flags'] for r in normalise.normalise(rows))
    a = rows[0]
    with pytest.raises(ValueError, match='ambiguous'):
        normalise.normalise([a, dict(a, payload=dict(a['payload'], impressions=101))])


def test_thin_evidence_is_shown_and_pooled_to_site_overall():
    local = site()
    local['overall'] = dict(O=20, E=5, u=[.2]*20, sigma=.2)
    out = site_effect.compare({'a': local}, lambda s, p: p, seed=1)['sites']['a']
    assert out['basis_level'] == 'site'
    assert out['sale']['mean'] > 1
    assert out['P_best'] == 1


def test_proof_outputs_guard_each_metric_and_cite_versions():
    out = site_effect.compare({'a': site()}, lambda s, p: p, seed=1)['sites']['a']
    assert out['metrics']['P_best']['state'] == 'shown'
    assert out['metrics']['keep']['citation']['param_versions']
    missing = site(); missing['E'] = None
    assert site_effect.compare({'a': missing}, lambda s, p: p, seed=1)['sites']['a']['metrics']['P_best']['state'] == 'hidden'
    money = funnel.money_rows([], [dict(id='a', item_id='i', site='ebay', kind='sale', state='delivered', payout_cents=None, lines=[])])['ebay']
    assert money['metrics']['kept_cents']['state'] == 'hidden'


def test_params_are_scoped_read_and_missing_values_throw():
    from analytics.params import DECLARED, resolve
    priors = {d['name']: d['prior'] for d in DECLARED}
    calls = []
    def read(name, scope):
        calls.append((name, scope))
        return dict(value=priors[name], version=7)
    resolved = resolve(read, {'site': 'a'})
    out = site_effect.compare({'a': site()}, lambda s, p: p, seed=1, params=resolved)
    assert calls and set(out['sites']['a']['metrics']['keep']['citation']['param_versions'].values()) == {7}
    with pytest.raises(KeyError):
        site_effect.compare({'a': site()}, lambda s, p: p, seed=1, params={'values': {}, 'versions': {}})


def test_beside_days_never_use_percentage_point_threshold():
    ours = dict(value=1, unit='days', definition='payment to ship', flags=[])
    other = dict(value=2, unit='days', definition='payment to ship')
    assert not beside.beside('a', ours, other)['data_quality']


def test_shared_d12_cases():
    path = Path(__file__).resolve().parents[2] / 'app/src/engines/valuation/fixtures/best-sites-parity.json'
    cases = json.loads(path.read_text())['cases']
    assert len(cases) >= 8
    for case in cases:
        assert placement.pick(case['sites'])['sites'] == case['expected'], case['name']


def test_uncited_comparison_is_hidden_and_input_basis_is_immutable():
    row = site()
    row.pop('basis', None)
    out = site_effect.compare({'a': row}, lambda s, p: p, seed=1)['sites']['a']
    assert out['metrics']['keep']['state'] == 'hidden'
    row['basis'] = [dict(id='observation', at='2026-09-01', source='orders')]
    result = site_effect.compare({'a': row}, lambda s, p: p, seed=1)['sites']['a']
    assert result['metrics']['keep']['state'] == 'shown'
    before = copy.deepcopy(result['metrics']['keep']['citation'])
    row['basis'][0]['id'] = 'changed'
    assert before == result['metrics']['keep']['citation']


def test_multiple_raw_reads_in_one_day_keep_full_cumulative_delta():
    base = dict(site='poshmark', listing_id='l', item_id='i', posted_at='2026-09-01T00:00:00Z', route='harness')
    reads = [dict(base, id=str(i), read_at=f'2026-09-01T{hour}:00:00Z',
                  payload=dict(impressions=n, clicks=n, likes=0, offers=0))
             for i, (hour, n) in enumerate([('10', 10), ('12', 15)])]
    out = funnel.listing_funnel(normalise.normalise(reads))
    assert out['stages']['exposure'] == 15


def test_hot_mean_plan_cannot_gain_exploration_site():
    a = dict(P=.8, keep=100, cancel_cost=0, E=80, t50_minutes=60)
    b = dict(P=.7, keep=100, cancel_cost=0, E=70)
    result = placement.placement({'a': a, 'b': b}, {'a': dict(a, E=1), 'b': dict(b, E=90)},
                                 item_id='new', listed_item_ids=list('abcdefghij'), exploration_item_ids=[])
    assert result['sites'] == ['a']


def test_duplicate_observation_id_cannot_change_payload_or_day():
    a = dict(id='same', site='ebay', listing_id='l', item_id='i', day='2026-09-01', stages={'attention': 2}, terms={}, flags=[])
    with pytest.raises(ValueError, match='observation id'):
        funnel.listing_funnel([a, dict(a, day='2026-09-02')])


def test_param_overrides_change_calculations_and_invalid_domains_refuse():
    from analytics.params import resolve
    params = resolve()
    params['values']['platform_analytics_sale_prior'] = 20
    assert site_effect.sale_effect(6, 5, params=params)['mean'] == pytest.approx(26/25)
    params['values']['platform_analytics_price_prior'] = 20
    assert site_effect.price_effect([1], .2, params=params)['mean'] == pytest.approx(1/21)
    params['values']['platform_analytics_half_life_days'] = 45
    event = dict(id='e', item_id='i', listing_id='l', site='ebay', kind='sale', E=1, u=.4, at='2026-09-01')
    assert learn.fold_events([event], '2026-11-30', params=params)['ebay']['n_eff'] == .25
    for key, bad in [('interval_tail', 1), ('draws', 1.5), ('exploration_cap', 2)]:
        wrong = resolve()
        wrong['values']['platform_analytics_' + key] = bad
        with pytest.raises(ValueError):
            site_effect.compare({'a': site()}, lambda s, p: p, seed=1, params=wrong)
    with pytest.raises(KeyError):
        placement.pick({}, params={'values': {}, 'versions': {}})


def test_money_proof_tracks_listing_basis_and_hides_incomplete_speed():
    orders = [dict(id='o', item_id='i', site='ebay', listing_id='l', kind='sale', state='delivered',
                   payout_cents=100, price_cents=100, sold_at='2026-09-03', lines=[])]
    listings = [dict(id='l', item_id='i', site='ebay', posted_at='2026-09-01', ended_at='2026-09-03', price_cents=100)]
    out = funnel.money_rows(listings, orders)['ebay']
    ids = out['metrics']['days_to_sell']['citation']['basis_ids']
    assert 'l' in ids and 'o' in ids
    assert out['metrics']['sales']['unit'] == 'count'
    incomplete = funnel.money_rows([], orders)['ebay']['metrics']['days_to_sell']
    assert incomplete['state'] == 'hidden'


def test_malformed_evidence_date_is_not_shown():
    row = site()
    row['basis'] = [dict(id='o', at='not-a-date')]
    out = site_effect.compare({'a': row}, lambda s, p: p, seed=1)['sites']['a']
    assert out['metrics']['keep']['state'] == 'hidden'


def test_best_probability_cites_competitors_and_draw_configuration():
    a, b = site(), site()
    b['basis'] = [dict(id='b-order', at='2026-09-02', source='orders')]
    first = site_effect.compare({'a': a, 'b': b}, lambda s, p: p, seed=1)
    cite = first['sites']['a']['metrics']['P_best']['citation']
    assert 'b-order' in cite['basis_ids']
    b['P'] = 0
    second = site_effect.compare({'a': a, 'b': b}, lambda s, p: p, seed=1)
    assert cite['id'] != second['sites']['a']['metrics']['P_best']['citation']['id']
    third = site_effect.compare({'a': a, 'b': b}, lambda s, p: p, seed=2, draws=10)
    assert third['sites']['a']['metrics']['P_best']['citation']['filters']['seed'] == 2
    assert third['sites']['a']['metrics']['P_best']['citation']['filters']['draws'] == 10


def test_rates_require_each_days_stage_not_just_a_row():
    a = dict(site='ebay', listing_id='l', item_id='i', day='2026-09-01', stages={'attention': 2}, terms={}, flags=[])
    b = dict(a, day='2026-09-02', stages={'attention': None}, flags=['not_reported'])
    assert funnel.listing_funnel([a, b])['rates']['attention'] is None
