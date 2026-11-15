"""Weekly counts and the Gamma velocity (spec/engines/demand-and-trend.md §3 steps 1-2).

How it operates: comps arrive already clustered by identity, so a cross-post is one sale (`weekly_counts`).
Each product's weeks, oldest first, fold into a conjugate Gamma(shape, rate) over its weekly sales rate:
shape += w * sold, rate += w * exposure * season, with w = 0.5 ** (age_weeks / 8) so data 8 weeks old counts half.
A week with zero exposure (not listed, not observed) is censored: w * 0 adds nothing to shape or rate, so a gap is never read as
zero demand. The prior is the kind's pooled Gamma (a `param` of family gamma, held at 2 weeks of weight),
so a product with no history reads as its kind. The range is the Gamma's p10 to p90. Pure arithmetic, one
pass, no model call: fast enough for the read path.
"""
from __future__ import annotations

from dataclasses import dataclass

from scipy.stats import gamma

from demand.params import resolved
from demand.validation import number, probability


@dataclass(frozen=True)
class Week:
    sold: int
    exposure: float  # listing-weeks observed; 0 means censored
    season: float = 1.0  # season_m for the week's month
    capped: bool = False  # the read hit the site's result cap: sold is a lower bound


@dataclass(frozen=True)
class Velocity:
    shape: float
    rate: float
    mean: float
    p10: float
    p90: float
    lower_bound: bool = False
    censored_weeks: int = 0



def weekly_counts(comps: list[dict]) -> dict[tuple[str, str], int]:
    """Sold count per (product, week), one per identity cluster."""
    seen: dict[tuple[str, str], set[str]] = {}
    for c in comps:
        if not isinstance(c['sold'], bool):
            raise ValueError('sold: must be boolean')
        for field in ('product', 'week', 'cluster_id'):
            if not isinstance(c[field], str) or not c[field]:
                raise ValueError(field + ': missing identity')
        if c["sold"]:
            seen.setdefault((c["product"], c["week"]), set()).add(c["cluster_id"])
    return {k: len(v) for k, v in seen.items()}


def cap_engagement(values: list[float], q: float | None = None, *, params=None) -> list[float]:
    """Cap watchers or likes at the kind's 99th percentile so one viral listing or a bot does not move a product."""
    q = resolved(params)['values']['demand_engagement_quantile'] if q is None else q
    probability(q, 'q')
    for value in values:
        number(value, 'engagement')
    if not values:
        return []
    s = sorted(values)
    cap = s[min(len(s) - 1, int(q * (len(s) - 1)))]
    return [min(v, cap) for v in values]


def velocity(weeks: list[Week], prior: dict, *, params=None) -> Velocity:
    """Weeks oldest first, canonical Gamma shape/rate. Zero exposure is censored."""
    values = resolved(params)['values']
    # Compatibility with the unowned proof harness's pre-registry prior payload.
    if set(prior) == {'a', 'b'}:
        prior = {'shape': prior['a'], 'rate': prior['b']}
    shape = number(prior['shape'], 'shape', positive=True)
    rate = number(prior['rate'], 'rate', positive=True)
    censored = 0
    for i, wk in enumerate(weeks):
        number(wk.sold, 'sold', integer=True)
        number(wk.exposure, 'exposure')
        number(wk.season, 'season', positive=True)
        if wk.exposure == 0:
            censored += 1
            continue
        w = 0.5 ** ((len(weeks) - 1 - i) / values['demand_half_life_weeks'])
        shape += w * wk.sold
        rate += w * wk.exposure * wk.season
    number(shape, 'shape', positive=True)
    number(rate, 'rate', positive=True)
    mean = number(shape / rate, 'velocity.mean', positive=True)
    dist = gamma(shape, scale=1.0 / rate)
    p10 = number(float(dist.ppf(.1)), 'velocity.p10')
    p90 = number(float(dist.ppf(.9)), 'velocity.p90')
    return Velocity(shape=shape, rate=rate, mean=mean, p10=p10,
                    p90=p90, censored_weeks=censored,
                    lower_bound=any(wk.capped and wk.exposure > 0 for wk in weeks))
