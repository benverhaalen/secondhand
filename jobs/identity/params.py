"""Identity priors; resolve through the registry's callable read(name, scope)."""
from copy import deepcopy
import math


def _entry(what, prior, source, lo=None, hi=None, family='scalar'):
    return {'name': 'identity_' + what, 'family': family, 'prior': prior,
            'guard_lo': lo, 'guard_hi': hi, 'scopes': ['kind', 'site', 'segment', 'person'],
            'source': 'spec/engines/identity.md#' + source}


DECLARED = [
    *[_entry('t_' + k, v, '3-the-calculation', 0, 1) for k, v in [('exact', .85), ('model', .70), ('comparable', .50)]],
    *[_entry('w_t_' + k, None, '4-learning') for k in ('exact', 'model', 'comparable')],
    *[_entry(k, v, '3-the-calculation', 0, 1) for k, v in [('field_weight', .30), ('text_weight', .50), ('image_weight', .20), ('seller_text', .8), ('price_tolerance', .15)]],
    _entry('phash_distance', 8, '3-the-calculation', 0, 64),
    _entry('date_days', 30, '3-the-calculation', 0),
    _entry('stock_sellers', 5, '3-the-calculation', 1),
    _entry('variant_blend', 3, '3-the-calculation', 0),
    _entry('retail_cache_seconds', 600, '3-the-calculation', 0),
    *[_entry('rung_' + str(k), v, '3-the-calculation', 0, 1) for k, v in [(1, 1.), (2, .8), (3, .5), (4, .3)]],
    _entry('max_pick', 4, '3-the-calculation', 1),
    _entry('beta_lo', .02, '4-learning', 0, 1),
    _entry('beta_hi', .98, '4-learning', 0, 1),
    _entry('q_kind', .6, '4-learning', 0, 1),
    _entry('purpose_min', .50, '3-the-calculation', 0, 1),
    _entry('anomaly_se', 2, '4-learning', 0),
    _entry('exact_precision', .95, '4-learning', 0, 1),
    _entry('bootstrap_resamples', 1000, '4-learning', 1),
    _entry('confidence_level', .95, '4-learning', 0, 1),
    _entry('odds_temperature', .10, '3-the-calculation', 0),
    _entry('odds_none_logit', .30, '3-the-calculation', 0, 1),
    _entry('odds_blend', 200, '4-learning', 0),
    _entry('odds_t_start', .01, '3-the-calculation', 0),
    _entry('odds_t_growth', 1.08, '3-the-calculation', 1),
    _entry('odds_t_count', 60, '3-the-calculation', 1),
    _entry('odds_b_step', .02, '3-the-calculation', 0),
    _entry('odds_b_count', 51, '3-the-calculation', 1),
    _entry('em_iterations', 50, '4-learning', 1),
    _entry('em_tolerance', 1e-8, '4-learning', 0),
    _entry('match_prior', .5, '4-learning', 0, 1),
    *[_entry(p + '_' + f, {'alpha': a, 'beta': b} if p == 'm' else {'alpha': b, 'beta': a}, '4-learning', family='beta')
      for f in ('brand', 'model', 'variant', 'gtin', 'mpn', 'size', 'colour', 'text_sim', 'image_sim')
      for p in ('m', 'u') for a, b in ([(4., 1.)] if f in {'text_sim', 'image_sim'} else [(9., 1.)])],
]


def resolve(read=None, scope=None):
    values, versions = {}, {}
    for entry in DECLARED:
        row = read(entry['name'], scope or {}) if read else {'value': deepcopy(entry['prior']), 'version': 0}
        value = row['value']
        if entry['family'] == 'scalar' and value is not None:
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
                raise ValueError(entry['name'] + ' must be finite')
            if (entry['guard_lo'] is not None and value < entry['guard_lo'] or
                    entry['guard_hi'] is not None and value > entry['guard_hi']):
                raise ValueError(entry['name'] + ' outside guard')
        if value is None and not entry['name'].startswith('identity_w_t_'):
            raise ValueError(entry['name'] + ' is missing')
        if entry['family'] == 'beta':
            if set(value) != {'alpha', 'beta'} or any(isinstance(v, bool) or not math.isfinite(v) or v <= 0 for v in value.values()):
                raise ValueError(entry['name'] + ' Beta counts must be finite and positive')
        if isinstance(row['version'], bool) or not isinstance(row['version'], int) or row['version'] < 0:
            raise ValueError(entry['name'] + ' version must be nonnegative integer')
        values[entry['name']], versions[entry['name']] = deepcopy(value), row['version']
    return {'values': values, 'versions': versions}


def from_rows(rows=(), scope=None):
    def read(name, selected):
        scopes = [selected]
        if 'person' in selected:
            scopes.append({k: v for k, v in selected.items() if k != 'person'})
        for candidate in scopes:
            matches = [r for r in rows if r['name'] == name and r['scope'] == candidate and r['status'] == 'champion']
            if matches:
                row = max(matches, key=lambda r: r['version'])
                return {'value': row['value_or_hyperparams'], 'version': row['version']}
        return {'value': deepcopy(next(e['prior'] for e in DECLARED if e['name'] == name)), 'version': 0}
    return resolve(read, scope)


def use(resolved=None, rows=(), scope=None):
    result = from_rows(rows, scope) if resolved is None else resolved
    # A partially resolved payload must never silently fall back to different versions.
    for entry in DECLARED:
        result['values'][entry['name']]
        result['versions'][entry['name']]
    return result
