"""Offline proof only; synthetic fixtures cannot establish the §9 real-account claim."""
import math
from time import perf_counter

import numpy as np
from analytics.funnel import money_rows
from analytics.site_effect import compare, exposure, sale_effect


def fixed_set(listings, orders, manifest):
    money = money_rows(listings, orders)
    rows = exposure(listings, orders, {}, '2026-11-01T00:00:00Z')
    fields = ('sales', 'kept_cents', 'kept_unknown', 'days_to_sell')
    return dict(money={s: {k: r[k] for k in fields} for s, r in money.items()},
                censored=[r['listing_id'] for r in rows if r['censored']],
                missing_hazard_flagged=all(r['E'] is None and 'not_reported' in r['flags'] for r in rows),
                fixture_mode=manifest['mode'], real_proof='not usable yet',
                missing=['150 real ended listings', '40 real cross-listed items', '14 daily stats payloads per site',
                         'held-out last 30 days D10 predictions, fair prices and money lines', 'Posh Stats matched definitions'])


def simulated_mix(*, seed, runs=100):
    rng = np.random.default_rng(seed)
    coverage = raw_worse = 0
    for _ in range(runs):
        # Same planted site effect; different item-price mix changes D10 hazards.
        expensive = rng.exponential(1/.01, 400)
        cheap = rng.exponential(1/.04, 400)
        O = int(sum(expensive <= 30))
        E = float(np.minimum(expensive, 30).sum() * .01)
        interval = sale_effect(O, E)['interval']
        coverage += interval[0] <= 1 <= interval[1]
        raw_worse += O < sum(cheap <= 30)
    return dict(seed=seed, runs=runs, coverage=coverage, raw_ranks_expensive_worse=raw_worse, mode='synthetic')


def speed(*, seed, runs=20):
    sites = {s: dict(O=6, E=5, u=[0]*6, P=.4, fair_p50=60, market_mean=-.1, sigma=.2, ended=10, flags=[])
             for s in ('ebay','poshmark','depop','mercari','facebook')}
    times = []
    for i in range(runs):
        start = perf_counter()
        compare(sites, lambda site, price: .8*price, seed=seed+i)
        times.append((perf_counter()-start)*1000)
    return dict(p95_ms=sorted(times)[math.ceil(.95*len(times))-1], draws=1000, mode='synthetic')
