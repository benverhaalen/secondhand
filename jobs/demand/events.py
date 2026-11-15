"""Season and event terms for the demand forecast (demand-and-trend §2 release calendars, §3 step 4).

`season_m` per calendar month is a learned `param` (1.0 is flat); an event (a holiday, a release) multiplies
the weeks it covers. Releases enter here as an event term, never as part of D.
"""
from __future__ import annotations

from dataclasses import dataclass
from demand.validation import number
from datetime import date, timedelta


@dataclass(frozen=True)
class Event:
    name: str
    start: str  # ISO date of the first affected day
    weeks: int
    effect: float  # multiplier on the weeks it covers


def season_terms(start: str, horizon_weeks: int, season_m: dict[int, float], events: list[Event]) -> list[float]:
    """One multiplier per forecast week starting at `start`."""
    number(horizon_weeks, 'horizon_weeks', positive=True, integer=True)
    for month, factor in season_m.items():
        number(month, 'month', positive=True, integer=True)
        if month > 12:
            raise ValueError('month: outside calendar')
        number(factor, 'season', positive=True)
    for event in events:
        number(event.weeks, 'event.weeks', positive=True, integer=True)
        number(event.effect, 'event.effect', positive=True)
        date.fromisoformat(event.start)
    d0 = date.fromisoformat(start)
    out = []
    for w in range(horizon_weeks):
        lo, hi = d0 + timedelta(weeks=w), d0 + timedelta(weeks=w + 1)
        m = season_m[lo.month]
        for e in events:
            es = date.fromisoformat(e.start)
            if es < hi and lo < es + timedelta(weeks=e.weeks):
                m *= e.effect
        out.append(m)
    return out
