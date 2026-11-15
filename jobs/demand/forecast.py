"""Count and price forecasts (demand-and-trend §3 steps 4-5), written as `fc_` rows in the fixture's shape.

How it operates: the count forecast is the Gamma-Poisson predictive of the product's velocity posterior over
the horizon's exposure E = sum(season and event terms) x exp(beta_D x D) x release_effect, i.e. a negative
binomial with n = a, p = b / (b + E). Its p10 to p90 is widened around p50 by `k_cov`. The price forecast is
p50_now (the comps' median) times the age-curve step and the hype decay, with p10 to p90 from 500 seeded
bootstrap draws over the comps. Both carry the param versions that made them. Arithmetic only.
"""
from __future__ import annotations

import math

import numpy as np
from scipy.stats import nbinom

from demand.velocity import Velocity

MODEL_VERSION = "demand-fc-1"
DRAWS = 500


def _widen(p10: float, p50: float, p90: float, k: float) -> tuple[float, float, float]:
    return max(0.0, p50 - k * (p50 - p10)), p50, p50 + k * (p90 - p50)


def count_forecast(product: str, post: Velocity, *, weeks: list[float], D: float, params: dict,
                   basis_count: int, as_of: str, release_effect: float = 1.0) -> dict:
    exposure = sum(weeks) * math.exp(params["beta_D"] * D) * release_effect
    dist = nbinom(post.a, post.b / (post.b + exposure))
    lo, mid, hi = (float(dist.ppf(q)) for q in (0.1, 0.5, 0.9))
    p10, p50, p90 = _widen(lo, mid, hi, params["k_cov"])
    return {"id": f"fc_{product}_{as_of}_{len(weeks)}w", "subject": {"kind": "product", "id": product},
            "horizon_weeks": len(weeks), "metric": "sales_count", "p10": p10, "p50": p50, "p90": p90,
            "basis_count": basis_count, "param_versions": {k: params.get(f"{k}_version", 0) for k in ("beta_D", "k_cov")},
            "model_version": MODEL_VERSION, "as_of": as_of}


def price_comps(comps: list[dict]) -> list[int]:
    """Sold prices that state what the item sold for: a Best Offer accept hides its price, a bundle splits it."""
    return [c["price_cents"] for c in comps if not c.get("best_offer") and not c.get("bundle")]


def price_forecast(product: str, comps_cents: list[int], *, age_step: float, decay: float, params: dict,
                   as_of: str, seed: int, horizon_weeks: int = 4) -> dict:
    rng = np.random.default_rng(seed)
    arr = np.asarray(comps_cents, dtype=float)
    medians = np.median(rng.choice(arr, size=(DRAWS, arr.size)), axis=1) * age_step * decay
    p50 = float(np.median(arr)) * age_step * decay
    p10, _, p90 = _widen(float(np.quantile(medians, 0.1)), p50, float(np.quantile(medians, 0.9)), params["k_cov"])
    return {"id": f"fc_{product}_{as_of}_{horizon_weeks}w_price", "subject": {"kind": "product", "id": product},
            "horizon_weeks": horizon_weeks, "metric": "median_sold_price_cents", "p10": round(p10), "p50": round(p50),
            "p90": round(p90), "basis_count": int(arr.size), "param_versions": {"k_cov": params.get("k_cov_version", 0)},
            "model_version": MODEL_VERSION, "as_of": as_of}
