"""Demand fixed set and backtest (demand-and-trend §9 tests 1 and 2).

The fixed set is synthetic and seeded: 60 products in 6 kinds, 104 weeks each, Poisson sales with a monthly
season, a share that rise or stop selling, and censored weeks with nothing live. It stands in for the frozen
`product_snapshot` version of 300 real products until that table exists on the workspace.
shortcut: synthetic set, swap `fixed_set()` for the snapshot read once the event workspace holds it.

The backtest walks 26 weekly origins. At each origin it reads only weeks before the origin (`history`, which
refuses anything later), builds the velocity posterior, forecasts the next 4 weeks and scores pinball loss
against carrying the last 4 weeks forward, plus p10 to p90 coverage.
"""
from __future__ import annotations

import numpy as np

from demand.forecast import count_forecast
from demand.learn import Forecast, pinball
from demand.velocity import Week, velocity

KINDS = ("apparel", "shoes", "electronics", "cards_collectibles", "toys_lego", "bags")
WEEKS, HORIZON, ORIGINS = 104, 4, 26
PARAMS = {"beta_D": 0.5, "k_cov": 1.0}


def fixed_set(seed: int = 15) -> list[dict]:
    rng = np.random.default_rng(seed)
    season = 1 + 0.3 * np.sin(2 * np.pi * np.arange(WEEKS) / 52)
    out = []
    for i in range(60):
        base = rng.gamma(2.0, 1.5)
        shape = rng.choice(["steady", "rising", "stopped"], p=[0.7, 0.15, 0.15])
        trend = np.ones(WEEKS)
        if shape == "rising":
            trend = np.linspace(1, 2.5, WEEKS)
        elif shape == "stopped":
            trend[rng.integers(60, 90):] = 0.02
        live = rng.random(WEEKS) > 0.05  # some weeks nothing is live: censored
        sold = rng.poisson(base * season * trend) * live
        out.append({"product": f"p{i}", "kind": KINDS[i % 6], "shape": str(shape), "sold": sold.tolist(),
                    "exposure": live.astype(float).tolist(), "season": season.tolist()})
    return out


def history(p: dict, origin: int) -> list[Week]:
    if origin > WEEKS - HORIZON:
        raise ValueError("origin leaves no horizon to score")
    return [Week(sold=p["sold"][w], exposure=p["exposure"][w], season=p["season"][w]) for w in range(origin)]


def kind_prior(products: list[dict], kind: str, origin: int) -> dict:
    """The kind's pooled rate at 2 weeks of weight, from weeks before the origin only."""
    sold = sum(sum(p["sold"][:origin]) for p in products if p["kind"] == kind)
    exp = sum(sum(p["exposure"][:origin]) for p in products if p["kind"] == kind)
    return {"a": 2.0 * sold / max(exp, 1.0), "b": 2.0}


def run(products: list[dict]) -> dict:
    ours, naive, inside, n = 0.0, 0.0, 0, 0
    for origin in range(WEEKS - HORIZON - ORIGINS + 1, WEEKS - HORIZON + 1):
        for p in products:
            post = velocity(history(p, origin), kind_prior(products, p["kind"], origin))
            row = count_forecast(p["product"], post, weeks=p["season"][origin:origin + HORIZON], D=0.0, params=PARAMS,
                                 basis_count=origin, as_of=str(origin))
            y = sum(p["sold"][origin:origin + HORIZON])
            f = Forecast(id=row["id"], product=p["product"], horizon_end=str(origin + HORIZON),
                         p10=row["p10"], p50=row["p50"], p90=row["p90"])
            last = float(sum(p["sold"][origin - HORIZON:origin]))
            ours += pinball(f, y)
            naive += pinball(Forecast(id="", product="", horizon_end="", p10=last, p50=last, p90=last), y)
            inside += row["p10"] <= y <= row["p90"]
            n += 1
    return {"pinball": ours / n, "naive_pinball": naive / n, "gain": 1 - ours / naive, "coverage": inside / n, "n": n}
