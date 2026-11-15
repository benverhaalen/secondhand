"""pa-4: mean picks survive exploration; floor and experiment consent hold."""
from analytics.placement import pick, placement, holdout


def test_effect_moves_pick_and_missing_field_flagged():
    sites = dict(ebay=dict(P=.5, keep=100, cancel_cost=0), poshmark=dict(P=.2, keep=100, cancel_cost=4000))
    assert pick(sites)['sites'] == ['ebay']
    sites['poshmark']['P'] = .99
    assert pick(sites)['sites'][0] == 'poshmark'
    sites['poshmark']['P'] = None
    assert pick(sites)['flags']['poshmark'] == ['not_reported']


def test_cross_listed_item_counted_once_and_exploration_add_only():
    sites = dict(ebay=dict(P=.5, keep=100, cancel_cost=0), mercari=dict(P=.01, keep=100, cancel_cost=500))
    draw = dict(sites, mercari=dict(P=.9, keep=100, cancel_cost=500))
    out = placement(sites, draw, item_id='new', listed_item_ids=['a']*10 + ['b','c','d','e'], exploration_item_ids=[])
    assert out['sites'] == ['ebay','mercari'] and out['exploration'] == ['mercari']
    assert placement(sites, draw, item_id='new', listed_item_ids=['a','b','c','d'], exploration_item_ids=[])['exploration'] == []
    assert placement(sites, draw, item_id='new', listed_item_ids=list('abcdefghij'), exploration_item_ids=['a','b'])['exploration'] == []


def test_holdout_needs_consent_decision_and_floor():
    kw = dict(experiments_consent=True, decision=dict(kind='join_experiment', option='join'), floor=50, asks={'ebay':60}, arm='all', eligible=['ebay'], mean_pick=['ebay'])
    assert holdout(**kw)['factor'] == 'site_set'
    for change in (dict(experiments_consent=False), dict(decision=None), dict(floor=70)):
        assert holdout(**{**kw, **change}) is None
