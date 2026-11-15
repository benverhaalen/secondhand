"""PARKED, 2026-11-15 08:31: Ben took hot items and seasons out of scope ("i dont care about hot items and seasons anymore.
stop that."). No job runs this and no plan or pitch claims it; it stays only so the record in product/words.md resolves.

How much one dated event moved demand for a group of items, measured from sales instead of hand-set.

Why this design. An event (a team wins the World Series, move-out week, the first cold week) is a date, so the
tempting design is a regression discontinuity in time: compare the weeks just before with the weeks just after.
Hausman and Rapson (2018, NBER w23602) show that design is biased when the series has its own trend, season or
autocorrelation, and that it is really an event study. So it is run as one, with the two fixes they point to:
  1. a control group on the same calendar weeks (other teams' jerseys for a Brewers win), so a season that lifts
     everything cancels out: a difference in differences of log sales rates;
  2. placebo dates in the quiet weeks before the event, the same estimator run where nothing happened, so a jump no
     bigger than ordinary week-to-week noise is not called an effect.
The window is narrow (default 4 weeks a side) so slow drift has little room. The unit is sales per listing-week, never
raw sales, because more listings after a win would otherwise read as more demand. A week with no exposure is unknown,
not zero demand (the same rule as velocity.py).

Interval: with sale counts a, b (group before, after) and c, d (control before, after), log(effect) has variance
about 1/a + 1/b + 1/c + 1/d (Poisson counts, the standard rate-ratio approximation). The 80% interval is
exp(log effect +/- 1.2816 * sd), matching the p10 to p90 the rest of demand/ reports.

Verdicts: use (interval excludes 1 and the effect is larger than every placebo), no_effect (interval includes 1),
placebo_as_big (a placebo date moved as much), too_thin (fewer than MIN_SALES in any of the four cells).
The output's `effect` is what events.Event.effect takes. Arithmetic only, no model call.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from demand.validation import number

MIN_SALES = 8  # per cell; below this the 1/a terms make the interval wider than any decision it could change
Z80 = 1.2816


@dataclass(frozen=True)
class Series:
    weeks: list[tuple[int, float]]  # (sold, listing-weeks of exposure), oldest first; exposure 0 = not observed


def _rate(s: Series, lo: int, hi: int) -> tuple[int, float]:
    sold = exp = 0.0
    for n, e in s.weeks[max(0, lo):hi]:
        if e > 0:
            sold += n
            exp += e
    return int(sold), exp


def _did(target: Series, control: Series, at: int, window: int):
    a, ea = _rate(target, at - window, at)
    b, eb = _rate(target, at, at + window)
    c, ec = _rate(control, at - window, at)
    d, ed = _rate(control, at, at + window)
    if min(a, b, c, d) < MIN_SALES or min(ea, eb, ec, ed) <= 0:
        return None, (a, b, c, d)
    log_eff = math.log((b / eb) / (a / ea)) - math.log((d / ed) / (c / ec))
    sd = math.sqrt(1 / a + 1 / b + 1 / c + 1 / d)
    return (log_eff, sd), (a, b, c, d)


def estimate(target: Series, control: Series, event_week: int, window: int = 4) -> dict:
    number(event_week, 'event_week', integer=True)
    number(window, 'window', positive=True, integer=True)
    for series in (target, control):
        if event_week < window or event_week + window > len(series.weeks):
            raise ValueError('event_week: incomplete observation window')
        for sold, exposure in series.weeks:
            number(sold, 'sold', integer=True)
            number(exposure, 'exposure')
    est, counts = _did(target, control, event_week, window)
    if est is None:
        return {"verdict": "too_thin", "counts": counts, "window": window}
    log_eff, sd = est
    lo, hi = math.exp(log_eff - Z80 * sd), math.exp(log_eff + Z80 * sd)
    # placebo dates: every date in the quiet weeks before the event whose window ends before the event's window opens
    placebos = []
    for p in range(window, event_week - window + 1):
        pe, _ = _did(target, control, p, window)
        if pe is not None:
            placebos.append(abs(pe[0]))
    out = {"effect": round(math.exp(log_eff), 3), "lo": round(lo, 3), "hi": round(hi, 3), "counts": counts,
           "window": window, "placebos": len(placebos),
           "largest_placebo": round(math.exp(max(placebos)), 3) if placebos else None}
    if lo <= 1.0 <= hi:
        out["verdict"] = "no_effect"
    elif placebos and max(placebos) >= abs(log_eff):
        out["verdict"] = "placebo_as_big"
    else:
        out["verdict"] = "use"
    return out
