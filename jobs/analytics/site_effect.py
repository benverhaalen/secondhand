"""Fair site comparison, platform-analytics §3.5–10.

Exposure integrates D10 daily hazards only while a listing can sell. A competing
sale censors it; missing hazard stays unknown. Gamma and normal posteriors use
local seeded draws and D9 supplied by the caller, keeping fees outside learning.
"""
import math
import random
from datetime import datetime
from statistics import mean

from scipy.stats import binomtest, gamma
from .funnel import sale_orders


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
        if E is not None and E < 0:
            raise ValueError('hazard must be nonnegative')
        rows.append(dict(listing_id=listing['id'], item_id=listing['item_id'], site=listing['site'], days=days,
                         E=E, sold=sold, censored=censored, unsold=not sold and not censored and bool(listing.get('ended_at')),
                         flags=['not_reported'] if E is None or (sale and sale_at is None) else []))
    return rows


def sale_effect(O, E, m=5, guard=(.33, 3)):
    if O < 0 or E < 0 or m <= 0:
        raise ValueError('sales, exposure nonnegative and prior positive required')
    shape, rate = O + m, E + m
    return dict(shape=shape, rate=rate, mean=max(guard[0], min(guard[1], shape / rate)),
                interval=tuple(float(v) for v in gamma.ppf([.05, .95], shape, scale=1/rate)))


def price_effect(u, sigma, m_g=5):
    if sigma < 0 or m_g <= 0:
        raise ValueError('spread nonnegative and prior positive required')
    return dict(mean=sum(u) / (len(u) + m_g), se=sigma / math.sqrt(len(u) + m_g))


def adjusted_probability(P, r):
    if not 0 <= P <= 1:
        raise ValueError('chance must be in [0, 1]')
    return 1 - (1 - P) ** r


def compare(sites, keep, *, seed, draws=1000, m=5, m_g=5, verdict_bar=.9, min_ended=5, guard=(.33, 3), log=None):
    rng = random.Random(seed)
    values, output = {}, {}
    for site, row in sorted(sites.items()):
        if any(row.get(k) is None for k in ('O', 'E', 'P', 'fair_p50', 'market_mean', 'sigma')):
            output[site] = dict(flags=sorted(set(row.get('flags', []) + ['not_reported'])), P_best=None)
            continue
        sale = sale_effect(row['O'], row['E'], m, guard)
        price = price_effect(row['u'], row['sigma'], m_g)
        values[site] = [adjusted_probability(row['P'], max(guard[0], min(guard[1], rng.gammavariate(sale['shape'], 1/sale['rate'])))) *
                        keep(site, row['fair_p50'] * math.exp(row['market_mean'] + rng.gauss(price['mean'], price['se']))) for _ in range(draws)]
        P = adjusted_probability(row['P'], sale['mean'])
        output[site] = dict(sale=sale, price=price, P=P,
                            keep=keep(site, row['fair_p50'] * math.exp(row['market_mean'] + price['mean'])),
                            flags=row.get('flags', []), value=mean(values[site]))
    for site in values:
        output[site]['P_best'] = sum(values[site][i] == max(v[i] for v in values.values()) for i in range(draws)) / draws
    best = max(values, key=lambda s: output[s]['P_best']) if values else None
    verdict = best if best and output[best]['P_best'] >= verdict_bar and sites[best]['ended'] >= min_ended else 'too close to call'
    if log:
        log.note('analytics.compare', seed=seed, draws=draws, verdict=verdict)
    return dict(sites=output, verdict=verdict)


def cross_listed(pairs, predicted_best, alpha=.1):
    winners = [p['winner'] for p in pairs if p['days'] >= 7 and p.get('winner')]
    wins = sum(w == predicted_best for w in winners)
    p = binomtest(wins, len(winners), alternative='less').pvalue if winners else 1
    return dict(wins=wins, count=len(winners), p=float(p), anomaly=p < alpha)
