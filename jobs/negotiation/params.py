"""Scoped priors; read(name, scope) returns value and version (negotiation.md §4)."""
import math

_SOURCE = 'spec/engines/negotiation.md#4-learning'
_PRIORS = {
    'p_lo': (.02, 0, 1), 'p_hi': (.98, 0, 1), 'half_life_days': (30, 1, None),
    'prior_guard_share': (.5, 0, None), 'calibration_n': (30, 1, None),
    'calibration_error': (.05, 0, 1), 'q_return': (.2, 0, 1),
    'pooling': (1., 0, None), 'bootstrap_n': (2000, 1, None), 'bootstrap_tail': (.025, 0, .5),
    'max_rounds': (4, 1, None),
}
_BUYERS = {
    'fair': (1., .85, .3), 'lowballer': (.85, .5, .3), 'haggler': (.97, .7, .5),
    'committed': (1.02, .9, .3), 'ghost': (1., .8, .3),
}
for kind, (shade, opening, concession) in _BUYERS.items():
    _PRIORS[f'buyer_{kind}_shade'] = (shade, 0, None)
    _PRIORS[f'buyer_{kind}_open_share'] = (opening, 0, 1)
    _PRIORS[f'buyer_{kind}_concede_share'] = (concession, 0, 1)
DECLARED = [dict(name=f'negotiation_{name}', family='scalar', prior=prior, guard_lo=lo,
                 **({'guard_hi': hi} if hi is not None else {}),
                 scopes=['kind', 'site', 'segment', 'person'], source=_SOURCE + (
                     ' (agent proposal numerical budget)' if name.startswith('buyer_') or name in ('pooling', 'bootstrap_n', 'max_rounds') else ''))
            for name, (prior, lo, hi) in _PRIORS.items()]
DECLARED += [dict(name='money_ending', family='model_ref', prior={'above_cents': 2000, 'digits': [5, 8]},
                  scopes=['kind', 'site', 'segment', 'person'], source='spec/engines/negotiation.md#3-the-calculation')]


def resolve(read=None, scope=None):
    if read is None:
        priors = {d['name']: d['prior'] for d in DECLARED}
        read = lambda name, scope: {'value': priors[name], 'version': 0}
    result = {'values': {}, 'versions': {}}
    for d in DECLARED:
        row = read(d['name'], scope or {})
        result['values'][d['name']] = row['value']
        result['versions'][d['name']] = row['version']
    validate(result)
    return result


def validate(params):
    for d in DECLARED:
        name = d['name']
        if name not in params['values'] or name not in params['versions']:
            raise ValueError(f'missing {name}')
        v, version = params['values'][name], params['versions'][name]
        if not isinstance(version, int) or version < 0:
            raise ValueError(f'{name} version')
        if d['family'] == 'scalar' and (not math.isfinite(v) or v < d['guard_lo'] or v > d.get('guard_hi', math.inf)):
            raise ValueError(name)
    if not 0 < params['values']['negotiation_q_return'] < 1:
        raise ValueError('negotiation_q_return must have finite log odds')
    if not 0 < params['values']['negotiation_p_lo'] < params['values']['negotiation_p_hi'] < 1:
        raise ValueError('negotiation probability bounds')
    for name in ('bootstrap_n', 'max_rounds', 'calibration_n'):
        v = params['values'][f'negotiation_{name}']
        if int(v) != v:
            raise ValueError(f'negotiation_{name}')
