"""Scoped priors for platform analytics; spec/engines/platform-analytics §3–4."""
import math

_SOURCE = 'spec/engines/platform-analytics.md'
_SPECS = [
    ('sale_prior', 5, '#3-the-calculation'),
    ('price_prior', 5, '#3-the-calculation'),
    ('effect_lo', .33, '#4-learning'), ('effect_hi', 3, '#4-learning'),
    ('draws', 1000, '#3-the-calculation'), ('verdict_bar', .9, '#3-the-calculation'),
    ('cross_alpha', .1, '#3-the-calculation'), ('cross_days', 7, '#3-the-calculation'),
    ('exploration_cap', .2, '#4-learning'), ('half_life_days', 90, '#4-learning'),
    ('promotion_min_ended', 300, '#4-learning'), ('holdout_days', 30, '#4-learning'),
    ('interval_tail', .05, '#9-proof'), ('anomaly_se', 2, '#4-learning'),
    ('gap_rate', .1, '#3-the-calculation'),
    ('share_pairs', 6, 'spec/determinations/money.md#d23-sell-through-and-share-of-asking'),
    ('pool_weight', 6, 'spec/engines/valuation.md#3-the-calculation'),
]
DECLARED = [dict(name='platform_analytics_' + name, family='scalar', prior=prior,
                 guard_lo=0, scopes=['kind', 'site', 'segment', 'person'],
                 source=_SOURCE + anchor if anchor.startswith('#') else anchor)
            for name, prior, anchor in _SPECS]


def resolve(read=None, scope=None):
    values, versions = {}, {}
    for entry in DECLARED:
        row = read(entry['name'], scope or {}) if read else dict(value=entry['prior'], version=0)
        value = row['value']
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
            raise ValueError(entry['name'] + ' must be finite and positive')
        values[entry['name']], versions[entry['name']] = value, row['version']
    return selected(dict(values=values, versions=versions))


def value(params, name):
    return params['values']['platform_analytics_' + name]


def selected(params=None):
    if params is None:
        return resolve()
    for entry in DECLARED:
        params['values'][entry['name']]
        params['versions'][entry['name']]
    for name, val in params['values'].items():
        if isinstance(val, bool) or not isinstance(val, (int, float)) or not math.isfinite(val) or val <= 0:
            raise ValueError(name + ' must be finite and positive')
    for name in ('draws', 'promotion_min_ended', 'share_pairs'):
        if not isinstance(value(params, name), int):
            raise ValueError(name + ' must be an integer')
    for name in ('verdict_bar', 'cross_alpha', 'exploration_cap', 'gap_rate'):
        if value(params, name) > 1:
            raise ValueError(name + ' must be at most one')
    if value(params, 'interval_tail') >= .5:
        raise ValueError('interval_tail must be less than one half')
    if value(params, 'effect_lo') > value(params, 'effect_hi'):
        raise ValueError('effect guard is inverted')
    return params
