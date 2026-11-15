"""A synthetic resale market with known premiums, for testing the market model and for demos that say so.

Nothing here is real data. Every row carries source="synthetic". The truth (each attribute's premium, the asking
markup, the trend and the noise) is returned beside the rows so a test can check the model recovers it.
"""
from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone

import numpy as np

TRUTH = {
    "category": {"t-shirt": 22.0, "jeans": 30.0, "hoodie": 34.0, "jacket": 55.0, "shorts": 18.0},   # baseline dollars
    "brand": {"generic": 0.0, "champion": 0.18, "levis": 0.25, "carhartt": 0.45, "nike": 0.20, "patagonia": 0.40},
    "condition": {"good": 0.0, "excellent": 0.10, "new_with_tags": 0.30, "fair": -0.30},
    "era": {"modern": 0.0, "90s": 0.35, "y2k": 0.15},
    "site": {"ebay": 0.0, "depop": 0.05, "poshmark": -0.05, "mercari": -0.08},
    "asking": 0.15,             # live asks sit above what sells
    "trend_per_year": 0.06,
    "sigma": {"t-shirt": 0.25, "jeans": 0.30, "hoodie": 0.28, "jacket": 0.40, "shorts": 0.25},
}


def market(n: int = 2000, seed: int = 7, end: str = "2026-11-15T00:00:00Z", days: int = 365) -> list[dict]:
    rng = np.random.default_rng(seed)
    t_end = datetime.fromisoformat(end.replace("Z", "+00:00")).astimezone(timezone.utc)
    pick = lambda d, p=None: list(d)[rng.choice(len(d), p=p)]
    rows = []
    for i in range(n):
        cat, brand, cond, era, site = pick(TRUTH["category"]), pick(TRUTH["brand"]), pick(TRUTH["condition"], [0.45, 0.3, 0.1, 0.15]), pick(TRUTH["era"], [0.6, 0.25, 0.15]), pick(TRUTH["site"])
        age = float(rng.uniform(0, days))
        asking = rng.random() < 0.3
        logp = (math.log(TRUTH["category"][cat]) + TRUTH["brand"][brand] + TRUTH["condition"][cond] + TRUTH["era"][era]
                + TRUTH["site"][site] + (TRUTH["asking"] if asking else 0.0) - TRUTH["trend_per_year"] * age / 365
                + rng.normal(0, TRUTH["sigma"][cat]))
        rows.append({"comp_id": f"syn-{i}", "source": "synthetic", "price_type": "asking" if asking else "sold",
                     "at": (t_end - timedelta(days=0 if asking else age)).isoformat().replace("+00:00", "Z"),
                     "price_cents": int(round(math.exp(logp) * 100)), "category": cat, "brand": brand, "condition": cond,
                     "era": era, "site": site, "size": pick(["s", "m", "l", "xl"])})
    return rows
