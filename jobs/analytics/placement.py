"""D12 marginal keep with analytics feedback; exploration only adds (§3.11–12).

A caller supplies posterior-adjusted means and one posterior draw. Count distinct
items, including the proposed addition, before adding exploration. Experiments
are a separate explicit join decision, never implied by analytics consent.
"""


def pick(sites, p_double=.01):
    flags = {s: sorted(set(r.get('flags', []) + (['not_reported'] if r.get('P') is None or r.get('keep') is None else []))) for s, r in sites.items()}
    eligible = {s: r for s, r in sites.items() if r.get('eligible', True) and r.get('P') is not None and r.get('keep') is not None}
    ordered = sorted(eligible, key=lambda s: (-eligible[s]['P'] * eligible[s]['keep'], -eligible[s]['P'], s))
    remaining, chosen = 1., []
    for s in ordered:
        r = eligible[s]
        if remaining * r['P'] * r['keep'] - p_double * r['cancel_cost'] > 0:
            chosen.append(s)
            remaining *= 1 - r['P']
    return dict(sites=chosen, flags=flags)


def placement(means, draw, *, item_id, listed_item_ids, exploration_item_ids, cap=.2, p_double=.01, log=None):
    result = pick(means, p_double)
    extra = [s for s in pick(draw, p_double)['sites'] if s not in result['sites'] and s in means and means[s].get('eligible', True) and means[s].get('P') is not None and means[s].get('keep') is not None]
    items, explored = set(listed_item_ids) | {item_id}, set(exploration_item_ids)
    allowed = len(explored | {item_id}) / len(items) < cap
    result['exploration'] = extra if allowed else []
    result['sites'] += result['exploration']
    if log:
        log.note('analytics.placement', item_id=item_id, sites=result['sites'], exploration=result['exploration'])
    return result


def holdout(*, experiments_consent, decision, floor, asks, arm, eligible, mean_pick):
    if not experiments_consent or not decision or decision.get('kind') != 'join_experiment' or decision.get('option') != 'join':
        return None
    if arm not in ('pick', 'all'):
        raise ValueError('site_set arm must be pick or all')
    sites = list(eligible if arm == 'all' else mean_pick)
    if any(s not in eligible or asks.get(s) is None or asks[s] < floor for s in sites):
        return None
    return dict(factor='site_set', arm=arm, sites=sites)
