"""Count and price forecasts (demand-and-trend §3 steps 4-5), written as `fc_` rows in the fixture's shape.

How it operates: the count forecast is the Gamma-Poisson predictive of the product's velocity posterior over
the horizon's exposure E = sum(season and event terms) x exp(beta_D x D) x release_effect, i.e. a negative
binomial with n = shape, p = rate / (rate + E). Its p10 to p90 is widened around p50 by `k_cov`. The price forecast is
p50_now (the comps' median) times the age-curve step and the hype decay, with p10 to p90 from 500 seeded
bootstrap draws over the comps. Both carry the param versions that made them. Arithmetic only.
"""
from __future__ import annotations

import math

import numpy as np
from scipy.stats import nbinom

from demand.velocity import Velocity
from demand.publication import publication

MODEL_VERSION = "demand-fc-1"
from demand.params import resolved
from demand.validation import number, money, finite


def _widen(p10: float, p50: float, p90: float, k: float) -> tuple[float, float, float]:
    for field, value in [('p10', p10), ('p50', p50), ('p90', p90), ('k_cov', k)]:
        number(value, field)
    if not p10 <= p50 <= p90:
        raise ValueError('forecast interval: unordered endpoints')
    out = max(0.0, p50 - k * (p50 - p10)), p50, p50 + k * (p90 - p50)
    for value in out:
        number(value, 'forecast interval')
    return out


def count_forecast(product: str, post: Velocity, *, weeks: list[float], D: float, params: dict | None = None,
                   basis_count: int, as_of: str, release_effect: float = 1.0, basis=None) -> dict:
    params = resolved(params)
    v = params['values']
    number(post.shape, 'shape', positive=True)
    number(post.rate, 'rate', positive=True)
    number(basis_count, 'basis_count', integer=True)
    if basis is not None and basis_count != len(basis):
        raise ValueError('basis_count: does not match basis rows')
    finite(D, 'D')
    number(release_effect, 'release_effect', positive=True)
    if not weeks:
        raise ValueError('weeks: empty horizon')
    for term in weeks:
        number(term, 'season', positive=True)
    exposure = sum(weeks) * math.exp(v["demand_beta_D"] * D) * release_effect
    dist = nbinom(post.shape, post.rate / (post.rate + exposure))
    lo, mid, hi = (float(dist.ppf(q)) for q in (0.1, 0.5, 0.9))
    p10, p50, p90 = _widen(lo, mid, hi, params["values"]["demand_k_cov"])
    row = {"id": f"fc_{product}_{as_of}_{len(weeks)}w", "subject": {"kind": "product", "id": product},
            "horizon_weeks": len(weeks), "metric": "sales_count", "p10": p10, "p50": p50, "p90": p90,
            "basis_count": basis_count, "param_versions": params["versions"],
            "model_version": MODEL_VERSION, "as_of": as_of}
    row.update(publication({'lo': p10, 'hi': p90}, metric=row['metric'], basis=basis,
                           as_of=as_of, params=params,
                           filters={'subject': product, 'horizon_weeks': row['horizon_weeks'],
                                    'shape': post.shape, 'rate': post.rate, 'season_terms': weeks,
                                    'D': D, 'release_effect': release_effect}))
    return row


def price_comps(comps: list[dict]) -> list[int]:
    """Sold prices that state what the item sold for: a Best Offer accept hides its price, a bundle splits it."""
    for c in comps:
        money(c['price_cents'])
    return [c["price_cents"] for c in comps if not c.get("best_offer") and not c.get("bundle")]


def price_forecast(product: str, comps_cents: list[int], *, age_step: float, decay: float, params: dict | None = None,
                   as_of: str, seed: int, horizon_weeks: int = 4, basis=None) -> dict:
    params = resolved(params)
    if not comps_cents:
        raise ValueError('price_cents: empty basis')
    for cents in comps_cents:
        money(cents)
    if basis is not None and sorted(row.get('price_cents', -1) for row in basis) != sorted(comps_cents):
        raise ValueError('basis: price observations do not match comps_cents')
    number(age_step, 'age_step', positive=True)
    number(decay, 'decay', positive=True)
    number(horizon_weeks, 'horizon_weeks', positive=True, integer=True)
    rng = np.random.default_rng(seed)
    arr = np.asarray(comps_cents, dtype=float)
    medians = np.median(rng.choice(arr, size=(int(params["values"]["demand_bootstrap_draws"]), arr.size)), axis=1) * age_step * decay
    p50 = float(np.median(arr)) * age_step * decay
    p10, _, p90 = _widen(float(np.quantile(medians, 0.1)), p50, float(np.quantile(medians, 0.9)), params["values"]["demand_k_cov"])
    p10, p50, p90 = [math.floor(x + 0.5) for x in (p10, p50, p90)]
    for cents in (p10, p50, p90):
        money(cents)
    row = {"id": f"fc_{product}_{as_of}_{horizon_weeks}w_price", "subject": {"kind": "product", "id": product},
            "horizon_weeks": horizon_weeks, "metric": "median_sold_price_cents", "p10": p10, "p50": p50,
            "p90": p90, "basis_count": int(arr.size), "param_versions": params["versions"],
            "model_version": MODEL_VERSION, "as_of": as_of}
    row.update(publication({'lo': p10, 'hi': p90}, metric=row['metric'], basis=basis,
                           as_of=as_of, params=params,
                           filters={'subject': product, 'horizon_weeks': row['horizon_weeks'],
                                    'age_step': age_step, 'decay': decay, 'seed': seed}))
    return row
