"""Weekly counts and the Gamma velocity (spec/engines/demand-and-trend.md §3 steps 1-2).

How it operates: comps arrive already clustered by identity, so a cross-post is one sale (`weekly_counts`).
Each product's weeks, oldest first, fold into a conjugate Gamma(a, b) over its weekly sales rate:
a += w * sold, b += w * exposure * season, with w = 0.5 ** (age_weeks / 8) so data 8 weeks old counts half.
A week with zero exposure (not listed, not observed) is censored: w * 0 adds nothing to a or b, so a gap is never read as
zero demand. The prior is the kind's pooled Gamma (a `param` of family gamma, held at 2 weeks of weight),
so a product with no history reads as its kind. The range is the Gamma's p10 to p90. Pure arithmetic, one
pass, no model call: fast enough for the read path.
"""
from __future__ import annotations

from dataclasses import dataclass

from scipy.stats import gamma

HALF_LIFE_WEEKS = 8.0


@dataclass(frozen=True)
class Week:
    sold: int
    exposure: float  # listing-weeks observed; 0 means censored
    season: float = 1.0  # season_m for the week's month


@dataclass(frozen=True)
class Velocity:
    a: float
    b: float
    mean: float
    p10: float
    p90: float


def weekly_counts(comps: list[dict]) -> dict[tuple[str, str], int]:
    """Sold count per (product, week), one per identity cluster."""
    seen: dict[tuple[str, str], set[str]] = {}
    for c in comps:
        if c["sold"]:
            seen.setdefault((c["product"], c["week"]), set()).add(c["cluster_id"])
    return {k: len(v) for k, v in seen.items()}


def cap_engagement(values: list[float], q: float = 0.99) -> list[float]:
    """Cap watchers or likes at the kind's 99th percentile so one viral listing or a bot does not move a product."""
    if not values:
        return []
    s = sorted(values)
    cap = s[min(len(s) - 1, int(q * (len(s) - 1)))]
    return [min(v, cap) for v in values]


def velocity(weeks: list[Week], prior: dict) -> Velocity:
    """weeks oldest first; prior {"a", "b"} from the kind's gamma param."""
    a, b = prior["a"], prior["b"]
    last = len(weeks) - 1
    for i, wk in enumerate(weeks):
        w = 0.5 ** ((last - i) / HALF_LIFE_WEEKS)
        a += w * wk.sold
        b += w * wk.exposure * wk.season
    dist = gamma(a, scale=1.0 / b)
    return Velocity(a=a, b=b, mean=a / b, p10=float(dist.ppf(0.10)), p90=float(dist.ppf(0.90)))
