"""D, direction and the M15 test (demand-and-trend §3 step 3; market-insight M8 and M15).

How it operates, hourly per product with new events: each present proxy k gives
r_k = ln((recent_28d + 1) / (base_28d_avg + 1)); D = sum w_k r_k / sum w_k with weights from `param`.
A read is `rising` when D >= 0.15, the sold count passes M15's one-sided binomial test (category tide
removed: p0 is the category's own share of the 112 days that fell in the last 28) and the rate ratio
(a / 28) / (b / 84) >= 1.5. Listings that rose faster than sales make it `more_for_sale`, not rising.
`demand_rose` fires only on 2 rising reads running. Under 5 sales in either window is `too_few`; a single
proxy is `hidden`. Arithmetic only; Benjamini-Hochberg runs across all items of a category in `m15_test`.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

from scipy.stats import binom

D_RISE = 0.15  # M8, *t*: a param prior
RATIO_RISE = 1.5  # M15 step 4, *t*
ALPHA = 0.05
MIN_SOLD = 5
UNIFORM_SHARE = 28 / 112


@dataclass(frozen=True)
class Proxy:
    recent: float  # last 28 days
    base: float  # average 28-day level over the prior 112 days


@dataclass(frozen=True)
class Read:
    state: str  # rising, falling, steady, more_for_sale, too_few, hidden
    D: float | None
    p: float | None


def demand_index(proxies: dict[str, Proxy], weights: dict[str, float]) -> float:
    present = {k: v for k, v in proxies.items() if k in weights}
    num = sum(weights[k] * math.log((v.recent + 1) / (v.base + 1)) for k, v in present.items())
    return num / sum(weights[k] for k in present)


def _bh(ps: list[float]) -> list[float]:
    """Benjamini-Hochberg adjusted p-values, in input order."""
    n = len(ps)
    order = sorted(range(n), key=lambda i: ps[i])
    adj = [0.0] * n
    running = 1.0
    for rank in range(n, 0, -1):
        i = order[rank - 1]
        running = min(running, ps[i] * n / rank)
        adj[i] = running
    return adj


def m15_test(items: list[tuple[int, int]], category: tuple[int, int] | None = None, rising: bool = True) -> list[float]:
    """items: (a sales in last 28 days, b sales in prior 84). Returns BH-adjusted one-sided p per item."""
    p0 = category[0] / (category[0] + category[1]) if category and sum(category) else UNIFORM_SHARE
    raw = [float(binom.sf(a - 1, a + b, p0)) if rising else float(binom.cdf(a, a + b, p0)) for a, b in items]
    return _bh(raw)


def direction(proxies: dict[str, Proxy], weights: dict[str, float], *, sold_recent: int, sold_prior: int,
              listed_recent: int | None = None, listed_base: float | None = None,
              category: tuple[int, int] | None = None) -> Read:
    if sold_recent < MIN_SOLD or sold_prior < MIN_SOLD:
        return Read("too_few", None, None)
    if sum(1 for k in proxies if k in weights) < 2:
        return Read("hidden", None, None)
    d = demand_index(proxies, weights)
    ratio = (sold_recent / 28) / (sold_prior / 84)
    if d >= D_RISE and ratio >= RATIO_RISE:
        p = m15_test([(sold_recent, sold_prior)], category)[0]
        if p >= ALPHA:
            return Read("steady", d, p)
        if listed_recent is not None and listed_base is not None:
            supply = math.log((listed_recent + 1) / (listed_base + 1))
            if supply > math.log((sold_recent + 1) / (sold_prior / 3 + 1)):
                return Read("more_for_sale", d, p)
        return Read("rising", d, p)
    if d <= -D_RISE and ratio <= 1 / RATIO_RISE:
        p = m15_test([(sold_recent, sold_prior)], category, rising=False)[0]
        return Read("falling" if p < ALPHA else "steady", d, p)
    return Read("steady", d, None)


def trending(reads: list[Read]) -> str | None:
    """The notice M8's 2-read rule allows, from the newest reads."""
    if len(reads) >= 2 and all(r.state == "rising" for r in reads[-2:]):
        return "demand_rose"
    return None
