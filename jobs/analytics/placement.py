"""D12 marginal keep with analytics feedback; exploration only adds (§3.11–12).

A caller supplies posterior-adjusted means and one posterior draw. Count distinct
items, including the proposed addition, before adding exploration. Experiments
are a separate explicit join decision, never implied by analytics consent.
"""


import math
from .money import cents
from .params import selected, value


def _number(number, field, *, positive=False):
    if not isinstance(number, (int, float)) or isinstance(number, bool) or not math.isfinite(number) or (positive and number <= 0):
        raise ValueError(f'{field} outside domain')
    return number


def pick(sites, p_double=None, *, params=None):
    """D12 twin of valuation/path.ts bestSites; shared best-sites-parity.json.

    E ranks plans; P breaks ties, then site name makes complete ties deterministic.
    Unknown risk cannot justify an extra site with a cancellation cost.
    """
    selected(params)  # Validate the resolved contract even on an empty selection.
    flags, eligible = {}, {}
    for site, row in sites.items():
        flags[site] = sorted(set(row.get('flags', [])))
        if not row.get('eligible', True):
            continue
        if row.get('P') is None or row.get('keep') is None:
            flags[site] = sorted(set(flags[site]) | {'not_reported'})
            continue
        P = _number(row['P'], 'P')
        if not 0 <= P <= 1:
            raise ValueError('P outside [0, 1]')
        cents(row['keep'], 'keep'); cents(row.get('cancel_cost', 0), 'cancel_cost')
        E = row.get('E', P * row['keep'])
        if E is None:
            flags[site] = sorted(set(flags[site]) | {'not_reported'})
            continue
        _number(E, 'E')
        eligible[site] = dict(row, E=E)
    ordered = sorted(eligible, key=lambda s: (-eligible[s]['E'], -eligible[s]['P'], s))
    remaining, chosen = 1., []
    if p_double is not None and not 0 <= _number(p_double, 'p_double') <= 1:
        raise ValueError('p_double outside [0, 1]')
    for site in ordered:
        row = eligible[site]
        risk = 0.
        if chosen and row.get('cancel_cost', 0):
            if p_double is not None:
                risk = p_double  # Compatibility for callers explicitly supplying measured risk.
            elif all(eligible[s].get('m_minutes') is not None and eligible[s].get('W_minutes') is not None for s in [site, *chosen]):
                def window(s):
                    r = eligible[s]
                    m = _number(r['m_minutes'], 'm_minutes', positive=True)
                    W = _number(r['W_minutes'], 'W_minutes')
                    if W < 0:
                        raise ValueError('W_minutes must be nonnegative')
                    return -math.expm1(-W/m)
                risk = (1-remaining)*window(site) + row['P']*sum(window(s) for s in chosen)
            else:
                flags[site] = sorted(set(flags[site]) | {'not_reported'})
                continue
        gain = remaining * row['P'] * row['keep'] - risk * row.get('cancel_cost', 0)
        if gain > 0 and row['E'] > 0:
            chosen.append(site)
            remaining *= 1-row['P']
            # Fixed D12 protocol interval: 24 hours, expressed in minutes.
            if len(chosen) == 1 and row.get('t50_minutes') is not None and _number(row['t50_minutes'], 't50_minutes', positive=True) < 24*60:
                break
    return dict(sites=chosen, flags=flags)


def placement(means, draw, *, item_id, listed_item_ids, exploration_item_ids, cap=None, p_double=None, log=None, params=None):
    params = selected(params)
    cap = value(params, 'exploration_cap') if cap is None else cap
    result = pick(means, p_double, params=params)
    extra = [s for s in pick(draw, p_double, params=params)['sites'] if s not in result['sites'] and s in means and means[s].get('eligible', True) and means[s].get('P') is not None and means[s].get('keep') is not None]
    items, explored = set(listed_item_ids) | {item_id}, set(exploration_item_ids)
    hot = bool(result['sites']) and means[result['sites'][0]].get('t50_minutes', math.inf) < 24*60
    allowed = not hot and len(explored | {item_id}) / len(items) < cap
    result['exploration'] = extra if allowed else []
    result['sites'] += result['exploration']
    if log:
        log.note('analytics.placement', item_id=item_id, sites=result['sites'], exploration=result['exploration'])
    return result


def holdout(*, experiments_consent, decision, floor, asks, arm, eligible, mean_pick):
    cents(floor, 'floor')
    for amount in asks.values():
        if amount is not None:
            cents(amount, 'asks')
    if not experiments_consent or not decision or decision.get('kind') != 'join_experiment' or decision.get('option') != 'join':
        return None
    if arm not in ('pick', 'all'):
        raise ValueError('site_set arm must be pick or all')
    sites = list(eligible if arm == 'all' else mean_pick)
    if any(s not in eligible or asks.get(s) is None or asks[s] < floor for s in sites):
        return None
    return dict(factor='site_set', arm=arm, sites=sites)
