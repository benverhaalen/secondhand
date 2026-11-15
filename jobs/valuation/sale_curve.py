"""Price-blind sale timing from events and right-censored listings."""
from __future__ import annotations

import hashlib
import math
from collections import defaultdict
from datetime import date, datetime, timezone

DAYS = (7, 30, 90)


def kaplan_meier(observations):
    """Return (day, survival) steps, including censor-only exit days."""
    exits = defaultdict(lambda: [0, 0])
    for duration, event in observations:
        if duration < 0:
            raise ValueError('negative listing duration')
        exits[duration][0 if event else 1] += 1
    at_risk = sum(sum(counts) for counts in exits.values())
    survival, curve = 1.0, []
    for day, (events, censors) in sorted(exits.items()):
        # Censors tied with events remain in the event's risk set.
        survival *= (at_risk - events) / at_risk
        curve.append((day, survival))
        at_risk -= events + censors
    return curve


def probabilities(curve, days=DAYS):
    result = []
    for day in days:
        if not curve or day > curve[-1][0]:
            result.append(None)
            continue
        survival = 1.0
        for at, value in curve:
            if at > day:
                break
            survival = value
        result.append(1 - survival)
    return result


def quantiles(curve, levels=(.25, .5, .75)):
    return [next((day for day, survival in curve
                  if 1 - survival >= level or math.isclose(1 - survival, level, rel_tol=0, abs_tol=1e-12)), None)
            for level in levels]


def split(rows):
    fit, held_out = [], []
    for row in sorted(rows, key=lambda r: r['row_id']):
        half = int(hashlib.sha256(row['row_id'].encode()).hexdigest(), 16) % 2
        (fit if half == 0 else held_out).append(row)
    return fit, held_out


def _timestamp(value):
    if isinstance(value, datetime):
        dt = value
    elif isinstance(value, date):
        dt = datetime.combine(value, datetime.min.time())
    else:
        dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
    return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).timestamp()


def _observations(rows):
    observations = []
    for row in rows:
        days = (_timestamp(row['at']) - _timestamp(row['listed_at'])) / 86400
        if days < 0:
            raise ValueError(f"negative duration for listing {row['row_id']}")
        observations.append((days, row['price_type'] == 'sold'))
    return observations


def calibration_error(rows):
    halves = [probabilities(kaplan_meier(_observations(half))) for half in split(rows)]
    gaps = [abs(fit - held_out) for fit, held_out in zip(*halves) if fit is not None and held_out is not None]
    return max(gaps) if gaps else None


def fit_group(rows):
    rows = list(rows)
    observations = _observations(rows)
    n_events = sum(event for _, event in observations)
    if n_events < 30:
        return None
    error = calibration_error(rows)
    if error is None:
        return None
    curve = kaplan_meier(observations)
    return {'reference': 'median_adjusted_sold', 'days': list(DAYS),
            'bins': [{'ratio': 1.0, 'p': probabilities(curve)}], 't': quantiles(curve),
            'n_events': n_events, 'calibration_error': error, 'price_blind': True,
            'fitted_on': 'dataset:nber_ebay_bo', 'use_scope': 'hackathon_demo'}
