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
from dataclasses import dataclass, replace, field
from demand.publication import publication

from scipy.stats import binom

from demand.params import resolved, signal_weights
from demand.validation import number, finite, probability

UNIFORM_SHARE = 28 / 112  # Fixed M15 observation windows, in days.


@dataclass(frozen=True)
class Proxy:
    recent: float  # last 28 days
    base: float  # average 28-day level over the prior 112 days


@dataclass(frozen=True)
class Read:
    state: str  # rising, falling, steady, more_for_sale, too_few, hidden
    D: float | None
    p: float | None
    week: str | None = None
    guarded: dict = field(default_factory=lambda: {'state': 'hidden', 'hide_reason': 'source_gap', 'basis_count': 0})
    citation: dict | None = None


@dataclass(frozen=True)
class _CategoryP:
    value: float


def demand_index(proxies: dict[str, Proxy], weights: dict[str, float] | None = None, *, params=None) -> float:
    weights = signal_weights(params) if weights is None else weights
    for k, proxy in proxies.items():
        number(proxy.recent, k + '.recent')
        number(proxy.base, k + '.base')
    for k, weight in weights.items():
        number(weight, k + '.weight')
    present = {k: v for k, v in proxies.items() if k in weights}
    num = sum(weights[k] * math.log((v.recent + 1) / (v.base + 1)) for k, v in present.items())
    total = sum(weights[k] for k in present)
    number(total, 'total_weight', positive=True)
    return finite(num / total, 'D')


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
    for a, b in items + ([category] if category is not None else []):
        number(a, 'sold_recent', integer=True)
        number(b, 'sold_prior', integer=True)
    p0 = category[0] / (category[0] + category[1]) if category and sum(category) else UNIFORM_SHARE
    raw = [float(binom.sf(a - 1, a + b, p0)) if rising else float(binom.cdf(a, a + b, p0)) for a, b in items]
    return _bh(raw)


def direction(proxies: dict[str, Proxy], weights: dict[str, float] | None = None, *, sold_recent: int, sold_prior: int,
              listed_recent: int | None = None, listed_base: float | None = None,
              category: tuple[int, int] | None = None, adjusted_p: _CategoryP | None = None,
              week: str | None = None, params=None) -> Read:
    v = resolved(params)['values']
    weights = signal_weights(params) if weights is None else weights
    number(sold_recent, 'sold_recent', integer=True)
    number(sold_prior, 'sold_prior', integer=True)
    demand_index(proxies, weights)
    if listed_recent is not None:
        number(listed_recent, 'listed_recent', integer=True)
    if listed_base is not None:
        number(listed_base, 'listed_base')
    if adjusted_p is not None:
        if not isinstance(adjusted_p, _CategoryP):
            raise ValueError('adjusted_p: category batch evidence required')
        probability(adjusted_p.value, 'adjusted_p')
    if sold_recent < v['demand_min_sold'] or sold_prior < v['demand_min_sold']:
        return Read("too_few", None, None, week)
    if sum(1 for k in proxies if k in weights) < 2:
        return Read("hidden", None, None, week)
    if adjusted_p is None:
        return Read('hidden', None, None, week)
    d = demand_index(proxies, weights)
    ratio = (sold_recent / 28) / (sold_prior / 84)
    if d >= v['demand_D_rise'] and ratio >= v['demand_ratio_rise']:
        p = adjusted_p.value
        if p >= v['demand_alpha']:
            return Read("steady", d, p, week)
        if listed_recent is not None and listed_base is not None:
            supply = math.log((listed_recent + 1) / (listed_base + 1))
            if supply > math.log((sold_recent + 1) / (sold_prior / 3 + 1)):
                return Read("more_for_sale", d, p, week)
        return Read("rising", d, p, week)
    if d <= -v['demand_D_rise'] and ratio <= 1 / v['demand_ratio_rise']:
        p = adjusted_p.value
        return Read("falling" if p < v['demand_alpha'] else "steady", d, p, week)
    return Read("steady", d, None, week)


def trending(reads: list[Read]) -> str | None:
    """The notice M8's 2-read rule allows, from the newest reads."""
    from datetime import date
    if len(reads) < 2 or not reads[-1].week or not reads[-2].week:
        return None
    if (date.fromisoformat(reads[-1].week) - date.fromisoformat(reads[-2].week)).days != 7:
        return None
    if all(r.state == "rising" for r in reads[-2:]):
        return "demand_rose"
    return None


def category_directions(candidates: list[dict], weights: dict | None = None, *, category=None, week=None, params=None, basis=None, as_of=None):
    """One BH family across every candidate, using its preselected one-sided alternative."""
    items = [(c['sold_recent'], c['sold_prior']) for c in candidates]
    for a, b in items + ([category] if category is not None else []):
        number(a, 'sold_recent', integer=True)
        number(b, 'sold_prior', integer=True)
    p0 = category[0] / sum(category) if category and sum(category) else UNIFORM_SHARE
    raw = [float(binom.sf(a - 1, a + b, p0) if a * 3 >= b else binom.cdf(a, a + b, p0))
           for a, b in items]
    adjusted = _bh(raw)
    if basis is not None and len(basis) != len(candidates):
        raise ValueError('basis: one list per category candidate required')
    out = []
    for i, (candidate, p) in enumerate(zip(candidates, adjusted)):
        read = direction(**candidate, weights=weights, adjusted_p=_CategoryP(p), week=week, params=params)
        proof = publication(read.D, metric='demand_direction', basis=basis[i] if basis else None,
                            as_of=as_of or week, params=params,
                            filters={'sold_recent': candidate['sold_recent'], 'sold_prior': candidate['sold_prior'], 'adjusted_p': p})
        out.append(replace(read, **proof))
    return out
