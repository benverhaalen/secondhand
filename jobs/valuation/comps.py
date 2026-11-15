"""Deterministic twin of app/src/engines/valuation/comps.ts. Shared fixtures pin cents and evidence.
D1-D5 and valuation.md §3-4 own the arithmetic. resolve accepts the registry's read(name, scope).
"""
from __future__ import annotations
import bisect
import math
import json
from functools import lru_cache
from itertools import groupby
from datetime import datetime
from statistics import median

DAY = 86400  # Fixed seconds per UTC day.
DOLLAR = 100  # Fixed cents per dollar.
MAX_SAFE = 2**53 - 1  # JavaScript's exact integer domain, shared at the boundary.

DECLARED = [{'name': 'valuation_w_type_sold',
  'path': 'w_type.sold',
  'family': 'scalar',
  'prior': 1,
  'guard_lo': 0,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d1-comparable-set-and-weights'},
 {'name': 'valuation_w_type_best_offer',
  'path': 'w_type.best_offer',
  'family': 'scalar',
  'prior': 0.6,
  'guard_lo': 0,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d1-comparable-set-and-weights'},
 {'name': 'valuation_w_type_own_order',
  'path': 'w_type.own_order',
  'family': 'scalar',
  'prior': 1.2,
  'guard_lo': 0,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d1-comparable-set-and-weights'},
 {'name': 'valuation_w_match_variant',
  'path': 'w_match.variant',
  'family': 'scalar',
  'prior': 1,
  'guard_lo': 0,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d1-comparable-set-and-weights'},
 {'name': 'valuation_w_match_product',
  'path': 'w_match.product',
  'family': 'scalar',
  'prior': 0.5,
  'guard_lo': 0,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d1-comparable-set-and-weights'},
 {'name': 'valuation_w_match_family',
  'path': 'w_match.family',
  'family': 'scalar',
  'prior': 0.25,
  'guard_lo': 0,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d1-comparable-set-and-weights'},
 {'name': 'valuation_w_match_category',
  'path': 'w_match.category',
  'family': 'scalar',
  'prior': 0,
  'guard_lo': 0,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d1-comparable-set-and-weights'},
 {'name': 'valuation_w_extract_measured',
  'path': 'w_extract.measured',
  'family': 'scalar',
  'prior': 1,
  'guard_lo': 0,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d1-comparable-set-and-weights'},
 {'name': 'valuation_w_extract_label',
  'path': 'w_extract.label',
  'family': 'scalar',
  'prior': 1,
  'guard_lo': 0,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d1-comparable-set-and-weights'},
 {'name': 'valuation_w_extract_structured',
  'path': 'w_extract.structured',
  'family': 'scalar',
  'prior': 0.9,
  'guard_lo': 0,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d1-comparable-set-and-weights'},
 {'name': 'valuation_w_extract_inferred',
  'path': 'w_extract.inferred',
  'family': 'scalar',
  'prior': 0.7,
  'guard_lo': 0,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d1-comparable-set-and-weights'},
 {'name': 'valuation_half_life_days_default',
  'path': 'half_life_days.default',
  'family': 'scalar',
  'prior': 90,
  'guard_lo': 5e-324,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d1-comparable-set-and-weights'},
 {'name': 'valuation_half_life_days_fast',
  'path': 'half_life_days.fast',
  'family': 'scalar',
  'prior': 30,
  'guard_lo': 5e-324,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d1-comparable-set-and-weights'},
 {'name': 'valuation_max_age_days',
  'path': 'max_age_days',
  'family': 'scalar',
  'prior': 365,
  'guard_lo': 0,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d1-comparable-set-and-weights'},
 {'name': 'valuation_recent_days',
  'path': 'recent_days',
  'family': 'scalar',
  'prior': 90,
  'guard_lo': 0,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d1-comparable-set-and-weights'},
 {'name': 'valuation_min_recent',
  'path': 'min_recent',
  'family': 'scalar',
  'prior': 2,
  'guard_lo': 0,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d1-comparable-set-and-weights'},
 {'name': 'valuation_min_n_eff',
  'path': 'min_n_eff',
  'family': 'scalar',
  'prior': 6,
  'guard_lo': 0,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d1-comparable-set-and-weights'},
 {'name': 'valuation_outlier_k',
  'path': 'outlier_k',
  'family': 'scalar',
  'prior': 4.4478,
  'guard_lo': 0,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d1-comparable-set-and-weights'},
 {'name': 'valuation_adjustment_cut',
  'path': 'adjustment_cut',
  'family': 'scalar',
  'prior': 0.22314355131420976,
  'guard_lo': 5e-324,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d1-comparable-set-and-weights'},
 {'name': 'valuation_d_offer_cat',
  'path': 'd_offer_cat',
  'family': 'scalar',
  'prior': 0,
  'guard_lo': 0,
  'guard_hi': 0.9999999999999998,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d1-comparable-set-and-weights'},
 {'name': 'valuation_condition_ratios_new_with_tags',
  'path': 'condition_ratios.new_with_tags',
  'family': 'scalar',
  'prior': 1.35,
  'guard_lo': 5e-324,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d2-condition-variant-completeness-and-size-adjustment'},
 {'name': 'valuation_condition_ratios_new_without_tags',
  'path': 'condition_ratios.new_without_tags',
  'family': 'scalar',
  'prior': 1.2,
  'guard_lo': 5e-324,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d2-condition-variant-completeness-and-size-adjustment'},
 {'name': 'valuation_condition_ratios_excellent',
  'path': 'condition_ratios.excellent',
  'family': 'scalar',
  'prior': 1.1,
  'guard_lo': 5e-324,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d2-condition-variant-completeness-and-size-adjustment'},
 {'name': 'valuation_condition_ratios_good',
  'path': 'condition_ratios.good',
  'family': 'scalar',
  'prior': 1,
  'guard_lo': 5e-324,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d2-condition-variant-completeness-and-size-adjustment'},
 {'name': 'valuation_condition_ratios_fair',
  'path': 'condition_ratios.fair',
  'family': 'scalar',
  'prior': 0.75,
  'guard_lo': 5e-324,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d2-condition-variant-completeness-and-size-adjustment'},
 {'name': 'valuation_condition_ratios_for_parts',
  'path': 'condition_ratios.for_parts',
  'family': 'scalar',
  'prior': 0.35,
  'guard_lo': 5e-324,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d2-condition-variant-completeness-and-size-adjustment'},
 {'name': 'valuation_completeness_ratios_box_missing',
  'path': 'completeness_ratios.box_missing',
  'family': 'scalar',
  'prior': 0.9,
  'guard_lo': 5e-324,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d2-condition-variant-completeness-and-size-adjustment'},
 {'name': 'valuation_completeness_ratios_accessory_missing',
  'path': 'completeness_ratios.accessory_missing',
  'family': 'scalar',
  'prior': 0.85,
  'guard_lo': 5e-324,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d2-condition-variant-completeness-and-size-adjustment'},
 {'name': 'valuation_works_ratios_verified',
  'path': 'works_ratios.verified',
  'family': 'scalar',
  'prior': 1,
  'guard_lo': 5e-324,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d2-condition-variant-completeness-and-size-adjustment'},
 {'name': 'valuation_works_ratios_said',
  'path': 'works_ratios.said',
  'family': 'scalar',
  'prior': 0.92,
  'guard_lo': 5e-324,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d2-condition-variant-completeness-and-size-adjustment'},
 {'name': 'valuation_works_ratios_unknown',
  'path': 'works_ratios.unknown',
  'family': 'scalar',
  'prior': 0.8,
  'guard_lo': 5e-324,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d2-condition-variant-completeness-and-size-adjustment'},
 {'name': 'valuation_works_ratios_not working',
  'path': 'works_ratios.not working',
  'family': 'scalar',
  'prior': 0.35,
  'guard_lo': 5e-324,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d2-condition-variant-completeness-and-size-adjustment'},
 {'name': 'valuation_shrinkage_k',
  'path': 'shrinkage_k',
  'family': 'scalar',
  'prior': 50,
  'guard_lo': 0,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d2-condition-variant-completeness-and-size-adjustment'},
 {'name': 'valuation_min_parent_rows',
  'path': 'min_parent_rows',
  'family': 'scalar',
  'prior': 30,
  'guard_lo': 0,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d2-condition-variant-completeness-and-size-adjustment'},
 {'name': 'valuation_time_factor_min',
  'path': 'time_factor_min',
  'family': 'scalar',
  'prior': 0.8,
  'guard_lo': 5e-324,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d3-time-adjustment'},
 {'name': 'valuation_time_factor_max',
  'path': 'time_factor_max',
  'family': 'scalar',
  'prior': 1.25,
  'guard_lo': 5e-324,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d3-time-adjustment'},
 {'name': 'valuation_min_site_products',
  'path': 'min_site_products',
  'family': 'scalar',
  'prior': 20,
  'guard_lo': 0,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d4-translation-between-sites'},
 {'name': 'valuation_anchor_enabled',
  'path': 'anchor_enabled',
  'family': 'scalar',
  'prior': 1,
  'guard_lo': 0,
  'guard_hi': 1,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/engines/valuation.md#3-the-calculation'},
 {'name': 'valuation_anchor_k',
  'path': 'anchor_k',
  'family': 'scalar',
  'prior': 5,
  'guard_lo': 1,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'jobs/valuation/market.py#ANCHOR_K'},
 {'name': 'valuation_anchor_blend_k',
  'path': 'anchor_blend_k',
  'family': 'scalar',
  'prior': 6,
  'guard_lo': 0,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/engines/valuation.md#3-the-calculation'},
 {'name': 'valuation_index_enabled',
  'path': 'index_enabled',
  'family': 'scalar',
  'prior': 1,
  'guard_lo': 0,
  'guard_hi': 1,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/engines/valuation.md#4-learning'},
 {'name': 'valuation_index_half_life_days',
  'path': 'index_half_life_days',
  'family': 'scalar',
  'prior': 30,
  'guard_lo': 5e-324,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/engines/valuation.md#4-learning'},
 {'name': 'valuation_size_enabled',
  'path': 'size_enabled',
  'family': 'scalar',
  'prior': 1,
  'guard_lo': 0,
  'guard_hi': 1,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/engines/valuation.md#4-learning'},
 {'name': 'valuation_size_shrinkage_k',
  'path': 'size_shrinkage_k',
  'family': 'scalar',
  'prior': 20,
  'guard_lo': 0,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/engines/valuation.md#4-learning'},
 {'name': 'valuation_age_enabled',
  'path': 'age_enabled',
  'family': 'scalar',
  'prior': 1,
  'guard_lo': 0,
  'guard_hi': 1,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d1-comparable-set-and-weights'},
 {'name': 'valuation_blend_enabled',
  'path': 'blend_enabled',
  'family': 'scalar',
  'prior': 1,
  'guard_lo': 0,
  'guard_hi': 1,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/engines/valuation.md#3-the-calculation'},
 {'name': 'valuation_blend_k',
  'path': 'blend_k',
  'family': 'scalar',
  'prior': 6,
  'guard_lo': 0,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/engines/valuation.md#3-the-calculation'},
 {'name': 'valuation_dedupe_enabled',
  'path': 'dedupe_enabled',
  'family': 'scalar',
  'prior': 1,
  'guard_lo': 0,
  'guard_hi': 1,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/plans/sweep/data-science.md#ranked-improvements'},
 {'name': 'valuation_prior_log_spread',
  'path': 'prior_log_spread',
  'family': 'scalar',
  'prior': 0.22314355131420976,
  'guard_lo': 0,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/engines/valuation.md#3-the-calculation'},
 {'name': 'valuation_coverage_min',
  'path': 'coverage_min',
  'family': 'scalar',
  'prior': 0.75,
  'guard_lo': 0,
  'guard_hi': 1,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d6-range-calibration-and-display-state'},
 {'name': 'valuation_coverage_max',
  'path': 'coverage_max',
  'family': 'scalar',
  'prior': 0.85,
  'guard_lo': 0,
  'guard_hi': 1,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d6-range-calibration-and-display-state'},
 {'name': 'valuation_checked_min_n',
  'path': 'checked_min_n',
  'family': 'scalar',
  'prior': 30,
  'guard_lo': 0,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d6-range-calibration-and-display-state'},
 {'name': 'valuation_checked_wilson_min',
  'path': 'checked_wilson_min',
  'family': 'scalar',
  'prior': 0.7,
  'guard_lo': 0,
  'guard_hi': 1,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d6-range-calibration-and-display-state'},
 {'name': 'valuation_curve_min_events',
  'path': 'curve_min_events',
  'family': 'scalar',
  'prior': 30,
  'guard_lo': 0,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d10-chance-of-sale-within-a-period-at-a-price'},
 {'name': 'valuation_curve_max_error',
  'path': 'curve_max_error',
  'family': 'scalar',
  'prior': 0.05,
  'guard_lo': 0,
  'guard_hi': 1,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d10-chance-of-sale-within-a-period-at-a-price'},
 {'name': 'valuation_hot_days',
  'path': 'hot_days',
  'family': 'scalar',
  'prior': 1,
  'guard_lo': 0,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/determinations/money.md#d12-best-site-or-set-of-sites'},
 {'name': 'valuation_budget_ms',
  'path': 'budget_ms',
  'family': 'scalar',
  'prior': 10000,
  'guard_lo': 1,
  'scopes': ['kind', 'site', 'segment', 'person'],
  'source': 'spec/engines/valuation.md#5-speed'}]

def resolve(read=None, scope=None):
    values, versions = {}, {}
    for entry in DECLARED:
        r = read(entry['name'], scope or {}) if read else {'value': entry['prior'], 'version': 0}
        value = r['value']
        if not isinstance(value, (int, float)) or not math.isfinite(value) or value < entry.get('guard_lo', -math.inf) or value > entry.get('guard_hi', math.inf):
            raise ValueError(entry['name'])
        values[entry['name']], versions[entry['name']] = value, r['version']
    return {'values': values, 'versions': versions}


def from_resolved(resolved):
    out = {}
    for e in DECLARED:
        if e['name'] not in resolved['values']:
            raise ValueError('missing ' + e['name'])
        path = e['path'].split('.')
        if len(path) == 2:
            out.setdefault(path[0], {})[path[1]] = resolved['values'][e['name']]
        else:
            out[path[0]] = resolved['values'][e['name']]
    return {**out, 'category_speed': 'default', 'size_ratios': {}, 'family_half_life_days': {},
            'timeIndex': lambda at: 0, 'site_ratios': {}, 'parent_site_ratios': {}, 'param_versions': resolved['versions']}


DEFAULTS = from_resolved(resolve())
SWITCHES = ('anchor_enabled', 'index_enabled', 'size_enabled', 'age_enabled', 'blend_enabled', 'dedupe_enabled')
LEGACY = {**DEFAULTS, **dict.fromkeys(SWITCHES, 0)}
LEVELS = ('variant', 'product', 'family', 'category')


@lru_cache(maxsize=16384)
def ts(at):
    return datetime.fromisoformat(at.replace('Z', '+00:00')).timestamp() if 'T' in at else datetime.fromisoformat(at + 'T00:00:00+00:00').timestamp()


def money(value, field):
    if not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0 or value > MAX_SAFE or value != math.floor(value):
        raise ValueError(field + ' must be nonnegative safe integer cents')
    return int(value)


def rounded(value):
    return money(math.floor(value + .5), 'rounded_cents')


def canonical(rows, as_of, params=None):
    p = params or DEFAULTS
    for r in rows:
        money(r['price_cents'], 'price_cents')
    rows = [r for r in rows if ts(r['sold_at']) <= ts(as_of)]
    def order(r):
        return (-(r['kind'] in p['w_type']), -ts(r.get('observed_at') or r['sold_at']), r['comp_id'], r['price_cents'], r['site'])
    rows.sort(key=order)
    seen, out = set(), []
    for _, group in groupby(rows, order):
        tied = list(group)
        if len(tied) > 1:
            tied.sort(key=lambda r: json.dumps(sorted(r.items()), separators=(',', ':'), ensure_ascii=False))
        for r in tied:
            key = ('cluster', r['cluster_id']) if p['dedupe_enabled'] and r.get('cluster_id') else ('comp', r['comp_id'])
            if key not in seen:
                seen.add(key)
                out.append(r)
    return sorted(out, key=lambda r: (ts(r['sold_at']), r['comp_id']))


def weigh(rows, as_of, params=None):
    p, now, out = params or DEFAULTS, ts(as_of), []
    for c in canonical(rows, as_of, p):
        money(c['price_cents'], 'price_cents')
        age = (now - ts(c['sold_at'])) / DAY
        if c['kind'] not in p['w_type'] or age < 0 or age > p['max_age_days'] or not c['price_cents']:
            continue
        half = p['family_half_life_days'].get(c.get('family_id'), p['half_life_days'][p['category_speed']]) if p['age_enabled'] else p['half_life_days'][p['category_speed']]
        if not math.isfinite(half) or half <= 0:
            raise ValueError('half_life_days')
        prior = DEFAULTS['w_match'][c['level']]
        match = c['w_match'] * p['w_match'][c['level']] / prior if prior > 0 else c['w_match']
        extract = p['w_extract'][c['extraction_source']] if c.get('extraction_source') else c['w_extract']
        if not all(math.isfinite(v) and v >= 0 for v in (match, extract)):
            raise ValueError('comp weight')
        w_age, w_type = .5 ** (age / half), p['w_type'][c['kind']]
        w = w_type * match * w_age * extract
        if math.isfinite(w) and w > 0:
            out.append({**c, 'w_type': w_type, 'w_age': w_age, 'w': w, 'age_days': age})
    return out


def n_eff(weights):
    scale = max(weights, default=0)
    if scale == 0:
        return 0
    w = [v / scale for v in weights]
    return sum(w)**2 / sum(v*v for v in w)


def sufficient(rows, p):
    return n_eff([c['w'] for c in rows]) >= p['min_n_eff'] and sum(c['age_days'] <= p['recent_days'] for c in rows) >= p['min_recent']


def back_off(rows, params=None):
    p, selected = params or DEFAULTS, []
    for level in LEVELS:
        selected += [c for c in rows if c['level'] == level]
        if sufficient(selected, p) or level == 'category':
            return {'comps': selected, 'level': level, 'n_eff': n_eff([c['w'] for c in selected])}


def adjust_detail(c, target, time_index=None, params=None):
    p = params or DEFAULTS
    money(c['price_cents'], 'price_cents')
    source = p['condition_ratios'].get('for_parts' if c.get('works') == 'not working' else c['condition'], 0)
    dest = p['condition_ratios'].get('for_parts' if target.get('works') == 'not working' else target['condition'], 0)
    if source <= 0 or dest <= 0:
        raise ValueError('condition has no ratio')
    condition = dest / source
    a, b = p['size_ratios'].get(target.get('size'), 0), p['size_ratios'].get(c.get('size'), 0)
    size = a / b if a > 0 and b > 0 else 1
    drift = (time_index or p['timeIndex'])(c['sold_at'])
    time_factor = math.exp(min(math.log(p['time_factor_max']), max(math.log(p['time_factor_min']), drift)))
    offer = 1 - p['d_offer_cat'] if c['kind'] == 'best_offer' else 1
    def complete(flags):
        result = 1
        for key in flags:
            ratio = p['completeness_ratios'].get(key, 0)
            if ratio <= 0:
                raise ValueError('completeness ' + key)
            result *= ratio
        return result
    completeness = complete(target['completeness']) / complete(c['completeness']) if 'completeness' in c and 'completeness' in target else 1
    def works(value):
        ratio = 1 if value == 'not working' else p['works_ratios'].get(value, 0)
        if ratio <= 0:
            raise ValueError('works ' + value)
        return ratio
    function_ratio = works(target['works']) / works(c['works']) if c.get('works') and target.get('works') else 1
    features = [math.log(v) for v in (condition, size, completeness, function_ratio)]
    return {'adjusted_cents': rounded(c['price_cents'] * offer * condition * size * completeness * function_ratio * time_factor),
            'gross': sum(abs(v) for v in features) + abs(math.log(time_factor)), 'net': sum(features)}


def trim(rows, params=None):
    p, adjusted, dropped = params or DEFAULTS, [], []
    for c in rows:
        delta = c.get('gross', abs(math.log(c['adjusted_cents'] / c['price_cents'])) if c['adjusted_cents'] > 0 else math.inf)
        if c['adjusted_cents'] <= 0 or not math.isfinite(delta) or delta > p['adjustment_cut'] + 2**-52:
            dropped.append({'comp_id': c['comp_id'], 'reason': 'adjustment'})
        else:
            adjusted.append(c)
    if not adjusted:
        return {'kept': [], 'dropped': dropped}
    logs = [math.log(c['adjusted_cents']) for c in adjusted]
    center = median(logs)
    cap = max(p['outlier_k'] * median([abs(v - center) for v in logs]), p['adjustment_cut'])
    kept = []
    for c, v in zip(adjusted, logs):
        if abs(v - center) <= cap:
            kept.append(c)
        else:
            dropped.append({'comp_id': c['comp_id'], 'reason': 'outlier'})
    return {'kept': kept, 'dropped': dropped}


def weighted_quantile(values_cents, weights, q, params=None):
    if len(values_cents) != len(weights) or not math.isfinite(q) or not 0 <= q <= 1:
        raise ValueError('invalid weighted quantile')
    for v in values_cents:
        money(v, 'values_cents')
    if not all(math.isfinite(w) and w >= 0 for w in weights):
        raise ValueError('weight must be finite and nonnegative')
    rows = sorted([(v, w) for v, w in zip(values_cents, weights) if w > 0], key=lambda r: r[0])
    if not rows:
        return None
    threshold, cumulative = q * sum(w for _, w in rows), 0
    for value, w in rows:
        cumulative += w
        if cumulative >= threshold:
            return value
    return rows[-1][0]


def translate(cents, ratio, params=None):
    money(cents, 'q_cents')
    if not math.isfinite(ratio) or ratio <= 0:
        raise ValueError('site ratio must be positive')
    return rounded(cents * ratio)


def basis(rows, p):
    remaining, dropped = list(rows), []
    while True:
        selected = back_off(remaining, p)
        trimmed = trim(selected['comps'], p)
        dropped += trimmed['dropped']
        if not trimmed['dropped']:
            return {**selected, 'dropped': dropped}
        ids = {c['comp_id'] for c in trimmed['dropped']}
        remaining = [c for c in remaining if c['comp_id'] not in ids]


def extrapolated(rows):
    if rows and all(c.get('net', 0) > 1e-9 for c in rows):
        return 'up'
    if rows and all(c.get('net', 0) < -1e-9 for c in rows):
        return 'down'
    return None


def fit_history(candidates, as_of, params=None):
    p = params or DEFAULTS
    rows = [c for c in canonical(candidates, as_of, p) if c.get('may_model') and c.get('product_id') and c.get('family_id') and c['kind'] in p['w_type'] and c['price_cents'] > 0 and ts(c['sold_at']) < ts(as_of)]
    products, indices, sums = {}, {}, {}
    i = 0
    while i < len(rows):
        at, end = ts(rows[i]['sold_at']), i + 1
        while end < len(rows) and ts(rows[end]['sold_at']) == at:
            end += 1
        batch, centers = {}, {}
        for c in rows[i:end]:
            money(c['price_cents'], 'price_cents')
            pid = c['product_id']
            if pid not in centers:
                previous = [r for r in products.get(pid, []) if at - ts(r['sold_at']) <= p['recent_days'] * DAY]
                products[pid] = previous
                centers[pid] = median([r['price_cents'] for r in previous]) if previous else None
            if centers[pid] is not None:
                batch.setdefault(c['family_id'], []).append(math.log(c['price_cents'] / centers[pid]))
        for family, residuals in batch.items():
            old = sums.get(family)
            decay = .5 ** ((at - old[0]) / DAY / p['index_half_life_days']) if old else 0
            total = (old[1] if old else 0) * decay + sum(residuals)
            weight = (old[2] if old else 0) * decay + len(residuals)
            sums[family] = (at, total, weight)
            indices.setdefault(family, []).append((at, total / weight))
        for c in rows[i:end]:
            products.setdefault(c['product_id'], []).append(c)
        i = end
    weeks, sizes = {}, {}
    for c in rows:
        weeks.setdefault((c['family_id'], math.floor(ts(c['sold_at']) / DAY / 7)), []).append(c)
    for group in weeks.values():
        center = median([c['price_cents'] for c in group])
        for c in group:
            if c.get('size'):
                sizes.setdefault(c['family_id'], {}).setdefault(c['size'], []).append(math.log(c['price_cents'] / center))
    ratios = {f: {s: math.exp(median(v) * len(v) / (len(v) + p['size_shrinkage_k'])) for s, v in by.items()} for f, by in sizes.items()}
    def index(family, at):
        values = indices.get(family, [])
        i = bisect.bisect_left(values, (ts(at), -math.inf))
        return values[i - 1][1] if i else 0
    return {'index': index, 'size_ratios': ratios}


def comparables(target, candidates, as_of, params=None):
    p = {**(params or DEFAULTS)}
    if target.get('retail_cents') is not None:
        money(target['retail_cents'], 'retail_cents')
    if target.get('depreciation') is not None and not 0 < target['depreciation'] <= 1:
        raise ValueError('depreciation')
    fitted = fit_history(candidates, as_of, p) if p['index_enabled'] or p['size_enabled'] else None
    family = target.get('family_id') or next((c.get('family_id', '') for c in candidates if c['level'] in ('variant', 'product')), '')
    if p['size_enabled']:
        p['size_ratios'] = {**p['size_ratios'], **fitted['size_ratios'].get(family, {})}
    if p['index_enabled'] and family:
        p['timeIndex'] = lambda at: fitted['index'](family, as_of) - fitted['index'](family, at)
    weighted = []
    for c in weigh(candidates, as_of, p):
        detail = adjust_detail(c, target, p['timeIndex'], p)
        weighted.append({**c, **detail, 'w': c['w'] / (1 + detail['gross'] / p['adjustment_cut'])})
    pool = [c for c in weighted if c['site'] == target['site']] if target.get('site') else weighted
    ratio = None
    if target.get('site') and not sufficient(pool, p):
        own, parent = p['site_ratios'].get(target['site']), p['parent_site_ratios'].get(target['site'])
        ratio = own if own and own['n'] >= p['min_site_products'] else parent if parent and parent['n'] >= p['min_site_products'] else None
        if ratio or p['blend_enabled']:
            pool = weighted
    kept, dropped, log_range, basis_level = [], [], None, 'prior'
    legacy = not p['anchor_enabled'] and not p['blend_enabled']
    def logs(rows):
        return [math.log(weighted_quantile([c['adjusted_cents'] for c in rows], [c['w'] for c in rows], q)) for q in (.1, .5, .9)]
    if p['blend_enabled']:
        if target.get('kind') and target.get('retail_cents') and target.get('depreciation'):
            center = math.log(target['retail_cents'] * target['depreciation'])
            log_range = [center - p['prior_log_spread'], center, center + p['prior_log_spread']]
        if target.get('kind_band'):
            band = target['kind_band']
            for key in ('q10', 'q50', 'q90'):
                money(band[key], 'kind_band_cents')
            if not 0 < band['q10'] <= band['q50'] <= band['q90'] or not math.isfinite(band['n_eff']) or band['n_eff'] <= 0:
                raise ValueError('kind_band')
            band_logs = [math.log(band[q]) for q in ('q10', 'q50', 'q90')]
            log_range = [(band['n_eff'] * v + p['blend_k'] * log_range[i]) / (band['n_eff'] + p['blend_k']) for i, v in enumerate(band_logs)] if log_range else band_logs
            basis_level = 'kind'
        for level in reversed(LEVELS):
            local = trim([c for c in pool if c['level'] == level], p)
            dropped += local['dropped']
            if not local['kept']:
                continue
            n = n_eff([c['w'] for c in local['kept']])
            local_logs = logs(local['kept'])
            log_range = [(n * v + p['blend_k'] * log_range[i]) / (n + p['blend_k']) for i, v in enumerate(local_logs)] if log_range else local_logs
            basis_level = 'kind' if level == 'category' else level
            kept += local['kept']
    else:
        selected = basis(pool, p)
        kept, dropped = selected['comps'], selected['dropped']
        basis_level = ('kind' if kept[0]['level'] == 'category' else kept[0]['level']) if kept else 'prior'
        log_range = logs(kept) if kept else None
    if p['anchor_enabled'] and log_range:
        anchor = sorted([c for c in kept if c['level'] == 'variant' and 0 < c['age_days'] <= p['recent_days']], key=lambda c: (-ts(c['sold_at']), c['comp_id']))[:math.floor(p['anchor_k'])]
        if anchor:
            middle = median([math.log(c['adjusted_cents']) for c in anchor])
            delta = len(anchor) / (len(anchor) + p['anchor_blend_k']) * (middle - log_range[1])
            log_range = [v + delta for v in log_range]
            basis_level = 'variant'
    def quantile(i, factor):
        if log_range is None:
            return None
        if legacy:
            value = weighted_quantile([c['adjusted_cents'] for c in kept], [c['w'] for c in kept], (.1, .5, .9)[i])
            return rounded(translate(value, factor) / DOLLAR) * DOLLAR
        return rounded(math.exp(log_range[i]) * factor / DOLLAR) * DOLLAR
    if not legacy:
        kept.sort(key=lambda c: (ts(c['sold_at']), c['comp_id']))
    return {'comps': kept, 'n_eff': n_eff([c['w'] for c in kept]) if kept else target.get('kind_band', {}).get('n_eff', 0),
            'level': selected['level'] if legacy else ('category' if basis_level in ('kind', 'prior') else basis_level), 'basis_level': basis_level,
            'range': dict(zip(('q10', 'q50', 'q90'), [quantile(i, ratio[k] if ratio else 1) for i, k in enumerate(('q25', 'ratio', 'q75'))])),
            'dropped': dropped, 'extrapolated': extrapolated(kept), 'state': 'ok' if sufficient(kept, p) else 'too_few', 'param_versions': p['param_versions']}
