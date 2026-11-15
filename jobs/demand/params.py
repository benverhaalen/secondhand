"""Scoped demand priors; resolve accepts the registry's read(name, scope) callable."""
from copy import deepcopy
from demand.validation import number

_SPEC = 'spec/engines/demand-and-trend.md'
_MARKET = 'spec/determinations/market-insight.md'
# The legacy coverage floor and record minimum lack spec priors; see WORKER_REPORT.md.
_ROWS = [
    ('half_life_weeks', 8., _SPEC + ':38#3-the-calculation'),
    ('engagement_quantile', .99, _SPEC + ':37#3-the-calculation'),
    ('beta_D', .5, _SPEC + ':49#4-learning'),
    ('k_cov', 1., _SPEC + ':49#4-learning'),
    ('forecast_move', .10, _SPEC + ':50#4-learning'),
    ('min_resolved', 300, _SPEC + ':57#4-learning'),
    ('coverage_target', .80, _SPEC + ':55#4-learning'),
    ('coverage_floor', .70, 'spec/engines/audit.md:268 (provisional legacy value; no spec prior)'),
    ('zero_start_cap', .20, _SPEC + ':58#4-learning'),
    ('weight_band', .50, _SPEC + ':58#4-learning'),
    ('calibration_window', 200, _SPEC + ':55#4-learning'),
    ('D_rise', .15, _MARKET + ':220#m8-demand-and-whether-it-is-rising'),
    ('ratio_rise', 1.5, _MARKET + ':362#m15-what-is-trending-and-how-a-trend-is-told-from-noise'),
    ('alpha', .05, _MARKET + ':361#m15-what-is-trending-and-how-a-trend-is-told-from-noise'),
    ('min_sold', 5, _MARKET + ':368#m15-what-is-trending-and-how-a-trend-is-told-from-noise'),
    ('bootstrap_draws', 500, _SPEC + ':41#3-the-calculation'),
    ('switch_draws', 1000, _SPEC + ':57#4-learning'),
    ('holdout_weeks', 12, _SPEC + ':57#4-learning'),
    ('proof_min_n_eff', 6, 'spec/product.md#the-proof-layer'),
    ('proof_max_age_days', 14, 'spec/product.md#the-proof-layer'),
    ('min_record', 20, 'spec/engines/audit.md:272 (provisional legacy value; no spec prior)'),
]
DECLARED = [dict(name='demand_' + key, family='scalar', prior=value,
                 guard_lo=0, scopes=['kind', 'site', 'segment', 'person'], source=source)
            for key, value, source in _ROWS]


_weight_band = next(d['prior'] for d in DECLARED if d['name'] == 'demand_weight_band')
_zero_cap = next(d['prior'] for d in DECLARED if d['name'] == 'demand_zero_start_cap')
for signal, prior in {'sold': .40, 'turnover': .20, 'watchers': .15, 'search': .15, 'offers': .10, 'open_web': 0.}.items():
    DECLARED.append(dict(name='demand_weight_' + signal, family='scalar', prior=prior,
                         guard_lo=prior * (1 - _weight_band), guard_hi=prior * (1 + _weight_band) if prior else _zero_cap,
                         scopes=['kind', 'site', 'segment', 'person'],
                         source=_SPEC + ':23#2-signals; :58#4-learning'))


def signal_weights(params=None):
    values = resolved(params)['values']
    return {entry['name'].removeprefix('demand_weight_'): values[entry['name']]
            for entry in DECLARED if entry['name'].startswith('demand_weight_') and entry['name'] != 'demand_weight_band'}


def validate_value(name, value):
    number(value, name, positive=not name.startswith('demand_weight_'))
    key = name.removeprefix('demand_')
    if key in {'engagement_quantile', 'forecast_move', 'coverage_target', 'coverage_floor', 'zero_start_cap', 'weight_band', 'alpha'} and value > 1:
        raise ValueError(name + ': must be <= 1')
    if key in {'min_resolved', 'calibration_window', 'min_sold', 'bootstrap_draws', 'switch_draws', 'holdout_weeks', 'min_record'}:
        number(value, name, positive=True, integer=True)


def resolve(read=None, scope=None):
    values, versions = {}, {}
    for entry in DECLARED:
        name = entry['name']
        row = read(name, scope or {}) if read else {'value': deepcopy(entry['prior']), 'version': 0}
        validate_value(name, row['value'])
        number(row['version'], name + '_version', integer=True)
        values[name], versions[name] = row['value'], row['version']
    return {'values': values, 'versions': versions}


def resolved(params=None):
    if params is None:
        return resolve()
    if 'values' in params:
        for entry in DECLARED:
            name = entry['name']
            validate_value(name, params['values'][name])
            number(params['versions'][name], name + '_version', integer=True)
        return params
    # Existing forecast callers supply these two values explicitly.
    out = resolve()
    for key in ('beta_D', 'k_cov'):
        if key in params:
            number(params[key], key, positive=True)
            out['values']['demand_' + key] = params[key]
            out['versions']['demand_' + key] = params.get(key + '_version', 0)
    if not {'beta_D', 'k_cov'} <= set(params) or not set(params) <= {'beta_D', 'k_cov', 'beta_D_version', 'k_cov_version'}:
        raise ValueError('params: expected resolved values and versions')
    return out
