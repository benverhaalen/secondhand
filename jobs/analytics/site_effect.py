"""Fair site comparison, platform-analytics §3.5–10.

Exposure integrates D10 daily hazards only while a listing can sell. A competing
sale censors it; missing hazard stays unknown. Gamma and normal posteriors use
local seeded draws and D9 supplied by the caller, keeping fees outside learning.
"""
import math
import hashlib
import json
import random
from datetime import datetime
from statistics import mean

from scipy.stats import binomtest, gamma
from .funnel import sale_orders
from .money import cents, rounded
from .params import selected, value
from .guarded import guarded


def _at(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00'))


def exposure(listings, orders, hazards, now):
    listings = list({r['id']: r for r in listings}.values())
    by_id = {r['id']: r for r in listings}
    sales = {o['item_id']: o for o in sale_orders(orders)}
    rows = []
    for listing in listings:
        sale = sales.get(listing['item_id'])
        sold = bool(sale and sale.get('listing_id') == listing['id'])
        sale_listing = by_id.get(sale.get('listing_id')) if sale else None
        sale_at = sale.get('sold_at') if sale else None
        sale_at = sale_at or (sale_listing.get('ended_at') if sale_listing else None)
        start = _at(listing['posted_at'])
        end = min(_at(listing.get('ended_at') or now), _at(now))
        censored = bool(sale and not sold and (sale_at is None or _at(sale_at) <= end))
        if sale_at:
            end = min(end, _at(sale_at))
        days = max(0, (end - start).total_seconds() / 86400)
        hazard = hazards.get(listing['id'])
        if isinstance(hazard, list):
            # Each segment has its own ask's hazard and live UTC interval.
            E = sum(max(0, (min(end, _at(h['end'])) - max(start, _at(h['start']))).total_seconds() / 86400) * h['hazard'] for h in hazard)
        else:
            E = days * hazard if hazard is not None else None
        if E is not None and (not math.isfinite(E) or E < 0):
            raise ValueError('hazard must be nonnegative')
        rows.append(dict(listing_id=listing['id'], item_id=listing['item_id'], site=listing['site'], days=days,
                         E=E, sold=sold, censored=censored, unsold=not sold and not censored and bool(listing.get('ended_at')),
                         flags=['not_reported'] if E is None or (sale and sale_at is None) else []))
    return rows


def _finite(value, name, *, positive=False, nonnegative=False):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f'{name} must be finite')
    if positive and value <= 0 or nonnegative and value < 0:
        raise ValueError(f'{name} outside domain')
    return value


def sale_effect(O, E, m=None, guard=None, *, params=None):
    params = selected(params)
    m = value(params, 'sale_prior') if m is None else m
    guard = (value(params, 'effect_lo'), value(params, 'effect_hi')) if guard is None else guard
    _finite(O, 'O', nonnegative=True); _finite(E, 'E', nonnegative=True); _finite(m, 'm', positive=True)
    if not 0 < guard[0] <= guard[1] or not all(math.isfinite(g) for g in guard):
        raise ValueError('invalid effect guard')
    shape, rate = O + m, E + m
    tail = value(params, 'interval_tail')
    return dict(shape=shape, rate=rate, mean=max(guard[0], min(guard[1], shape / rate)),
                interval=tuple(float(v) for v in gamma.ppf([tail, 1-tail], shape, scale=1/rate)))


def sufficient(u):
    if isinstance(u, dict):
        total, n = u['u_sum'], u['n_eff']
    else:
        for v in u:
            _finite(v, 'u')
        total, n = math.fsum(u), len(u)
    _finite(total, 'u_sum'); _finite(n, 'n_eff', nonnegative=True)
    if n == 0 and total != 0:
        raise ValueError('u_sum requires positive n_eff')
    return total, n


def price_effect(u, sigma, m_g=None, *, params=None):
    params = selected(params)
    m_g = value(params, 'price_prior') if m_g is None else m_g
    _finite(sigma, 'sigma', nonnegative=True); _finite(m_g, 'm_g', positive=True)
    total, n = sufficient(u)
    return dict(mean=total / (n + m_g), se=sigma / math.sqrt(n + m_g), u_sum=total, n_eff=n)


def adjusted_probability(P, r):
    _finite(P, 'P', nonnegative=True); _finite(r, 'r', positive=True)
    if P > 1:
        raise ValueError('chance must be in [0, 1]')
    return 1 - (1 - P) ** r


def compare(sites, keep, *, seed, draws=None, m=None, m_g=None, verdict_bar=None, min_ended=None, guard=None, log=None, params=None):
    params = selected(params)
    draws = value(params, 'draws') if draws is None else draws
    if isinstance(draws, bool) or not isinstance(draws, int) or draws <= 0:
        raise ValueError('draws must be a positive integer')
    m = value(params, 'sale_prior') if m is None else m
    m_g = value(params, 'price_prior') if m_g is None else m_g
    verdict_bar = value(params, 'verdict_bar') if verdict_bar is None else verdict_bar
    guard = (value(params, 'effect_lo'), value(params, 'effect_hi')) if guard is None else guard
    k = value(params, 'pool_weight')
    rng = random.Random(seed)
    values, output = {}, {}
    for site, row in sorted(sites.items()):
        if any(row.get(key) is None for key in ('O', 'E', 'P', 'fair_p50', 'market_mean', 'sigma')):
            output[site] = dict(flags=sorted(set(row.get('flags', []) + ['not_reported'])), P_best=None,
                                metrics={'P_best': guarded('P_best', None, [], versions=params['versions'])})
            continue
        cents(row['fair_p50'], 'fair_p50')
        _finite(row['market_mean'], 'market_mean')
        local_sale = sale_effect(row['O'], row['E'], m, guard, params=params)
        local_price = price_effect(row.get('u', row), row['sigma'], m_g, params=params)
        overall = row.get('overall')
        n = row.get('ended', local_price['n_eff'])
        _finite(n, 'ended', nonnegative=True)
        weight = n / (n + k)
        sale, price = local_sale, local_price
        if overall:
            parent_sale = sale_effect(overall['O'], overall['E'], m, guard, params=params)
            parent_price = price_effect(overall.get('u', overall), overall['sigma'], m_g, params=params)
            # Blend sufficient statistics, so posterior means and draws use the same pool.
            sale = sale_effect(weight*row['O'] + (1-weight)*overall['O'],
                               weight*row['E'] + (1-weight)*overall['E'], m, guard, params=params)
            stats = dict(u_sum=weight*local_price['u_sum'] + (1-weight)*parent_price['u_sum'],
                         n_eff=weight*local_price['n_eff'] + (1-weight)*parent_price['n_eff'])
            price = price_effect(stats, math.sqrt(weight*row['sigma']**2 + (1-weight)*overall['sigma']**2), m_g, params=params)
        def kept(log_effect):
            try:
                modeled = row['fair_p50'] * math.exp(row['market_mean'] + log_effect)
            except OverflowError as error:
                raise ValueError('modeled price outside safe cents') from error
            return cents(keep(site, rounded(modeled, 'price_cents')), 'keep')
        values[site] = [adjusted_probability(row['P'], max(guard[0], min(guard[1], rng.gammavariate(sale['shape'], 1/sale['rate'])))) *
                        kept(rng.gauss(price['mean'], price['se'])) for _ in range(draws)]
        output[site] = dict(sale=sale, price=price, P=adjusted_probability(row['P'], sale['mean']),
                            keep=kept(price['mean']), flags=row.get('flags', []), value=mean(values[site]),
                            basis_level='kind' if n else 'site' if overall else 'prior', blend_weight=weight)
    wins = {s: 0. for s in values}
    for i in range(draws):
        maximum = max((v[i] for v in values.values()), default=None)
        tied = [s for s in values if values[s][i] == maximum]
        for s in tied:
            wins[s] += 1 / len(tied)
    def evidence(site):
        row = sites[site]
        rows = row.get('basis', []) + row.get('overall', {}).get('basis', [])
        by_id = {}
        for evidence_row in rows:
            identity = evidence_row.get('id')
            if identity in by_id and by_id[identity] != evidence_row:
                raise ValueError('conflicting comparison evidence id')
            by_id[identity] = evidence_row
        return list(by_id.values())
    all_basis = {}
    for site in values:
        for evidence_row in evidence(site):
            identity = evidence_row.get('id')
            if identity in all_basis and all_basis[identity] != evidence_row:
                raise ValueError('conflicting comparison evidence id')
            all_basis[identity] = evidence_row
    input_hash = hashlib.sha256(json.dumps(sites, sort_keys=True, allow_nan=False).encode()).hexdigest()
    settings = dict(seed=seed, draws=draws, m=m, m_g=m_g, guard=guard, input_hash=input_hash)
    for site in values:
        row = sites[site]
        out = output[site]
        out['P_best'] = wins[site] / draws
        basis = evidence(site)
        complete = all(sites[s].get('basis') and (not sites[s].get('overall') or sites[s]['overall'].get('basis')) for s in values)
        own_complete = bool(row.get('basis')) and (not row.get('overall') or bool(row['overall'].get('basis')))
        out['metrics'] = {name: guarded(name, amount, list(all_basis.values()) if name == 'P_best' else basis,
                                       versions=params['versions'], filters=dict(site=site, **settings), unit=unit,
                                       missing=not (complete if name == 'P_best' else own_complete))
                          for name, amount, unit in [('P_best', out['P_best'], 'probability'), ('P', out['P'], 'probability'),
                                                     ('keep', out['keep'], 'cents'), ('value', out['value'], 'expected_cents'),
                                                     ('sale_effect', out['sale']['mean'], 'hazard_ratio'),
                                                     ('sale_interval', out['sale']['interval'], 'hazard_ratio'),
                                                     ('price_effect', out['price']['mean'], 'log_ratio'),
                                                     ('price_se', out['price']['se'], 'log_ratio')]}
    best = max(values, key=lambda s: output[s]['P_best']) if values else None
    verdict = best if best and output[best]['P_best'] >= verdict_bar else 'too close to call'
    if log:
        log.note('analytics.compare', seed=seed, draws=draws, verdict=verdict)
    return dict(sites=output, verdict=verdict)


def cross_listed(pairs, predicted_best, alpha=None, *, params=None):
    params = selected(params)
    alpha = value(params, 'cross_alpha') if alpha is None else alpha
    winners = [p['winner'] for p in pairs if p['days'] >= value(params, 'cross_days') and p.get('winner')]
    wins = sum(w == predicted_best for w in winners)
    p = binomtest(wins, len(winners), alternative='less').pvalue if winners else 1
    return dict(wins=wins, count=len(winners), p=float(p), anomaly=p < alpha)
