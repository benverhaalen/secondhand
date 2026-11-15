"""Demand learning: resolve, refit, coverage, promote, rollback (demand-and-trend §4, nightly `param_fold`).

How it operates, per kind each night: forecasts whose horizon ended and whose actual is known are resolved
(however late) and scored by pinball loss at p10, p50, p90. The D weights are refit by non-negative least
squares and normalised, then held within ±50% of their prior (a signal that started at 0 is capped at 0.20).
`k_cov` is the split-conformal scale that puts 80% of resolved values inside the widened range. `fold` first
checks the live champion against the resolved coverage floor and rolls back if it fails. Otherwise a challenger is
promoted only with at least 300 resolved product-windows, coverage held, and a paired 1,000-draw bootstrap
win on pinball loss. Every promoted row carries its held-out score through jobs/param.
"""
from __future__ import annotations

from dataclasses import dataclass, replace

import numpy as np
from scipy.optimize import nnls

from param.registry import MemoryStore, complete_row

from datetime import date, timedelta
from demand.params import resolved as resolved_params, DECLARED, validate_value
from hashlib import sha256
import json
from demand.validation import number, finite


@dataclass(frozen=True)
class Forecast:
    id: str
    product: str
    horizon_end: str  # ISO date
    p10: float
    p50: float
    p90: float
    resolved_value: float | None = None
    horizon_weeks: int = 4
    metric: str = 'sales_count'


def _validate(f):
    for name in ('p10', 'p50', 'p90'):
        finite(getattr(f, name), name)
    if not f.p10 <= f.p50 <= f.p90:
        raise ValueError('forecast interval: unordered endpoints')
    if f.resolved_value is not None:
        finite(f.resolved_value, 'resolved_value')
    number(f.horizon_weeks, 'horizon_weeks', positive=True, integer=True)


def _key(f):
    return (f.product, f.horizon_end, f.horizon_weeks, f.metric)



def pinball(f: Forecast, y: float) -> float:
    _validate(f)
    finite(y, 'actual')
    return sum(max(q * (y - v), (q - 1) * (y - v)) for q, v in ((0.1, f.p10), (0.5, f.p50), (0.9, f.p90))) / 3


def resolve(forecasts: list[Forecast], actuals: dict[str, float], today: str) -> list[Forecast]:
    for f in forecasts:
        _validate(f)
    products = [f.product for f in forecasts]
    out = []
    for f in forecasts:
        key = f.id if f.id in actuals else _key(f)
        # A legacy product key is unambiguous only for one forecast window.
        if key not in actuals and f.product in actuals:
            if products.count(f.product) != 1:
                raise ValueError('actuals: ambiguous product forecast windows')
            key = f.product
        if f.horizon_end <= today and key in actuals:
            finite(actuals[key], 'actual')
            out.append(replace(f, resolved_value=actuals[key]))
    return out


def coverage(resolved: list[Forecast], k: float) -> float:
    number(k, 'k_cov')
    for f in resolved:
        _validate(f)
        if f.resolved_value is None:
            raise ValueError('coverage: unresolved forecast')
    inside = [f.p50 - k * (f.p50 - f.p10) <= f.resolved_value <= f.p50 + k * (f.p90 - f.p50) for f in resolved]
    return float(np.mean(inside)) if inside else 0.0


def k_cov(resolved: list[Forecast], *, params=None) -> float:
    """Scale on the p10-p90 half-widths so COVERAGE_TARGET of the last 200 resolved fall inside."""
    v = resolved_params(params)['values']
    last = sorted(resolved, key=lambda f: (f.horizon_end, _key(f), f.id))[-int(v['demand_calibration_window']):]
    if not last:
        raise ValueError('k_cov: empty calibration basis')
    coverage(last, 1)
    need = []
    for f in last:
        if f.resolved_value < f.p50:
            width, error = f.p50 - f.p10, f.p50 - f.resolved_value
        else:
            width, error = f.p90 - f.p50, f.resolved_value - f.p50
        if width == 0 and error > 0:
            raise ValueError('k_cov: unsupported zero-width interval')
        need.append(error / width if width else 0.)
    return float(np.quantile(need, v['demand_coverage_target']))


def refit_weights(r: dict[str, np.ndarray], y: np.ndarray) -> dict[str, float]:
    names = sorted(r)
    if not names or not len(y):
        raise ValueError('refit_weights: empty basis')
    if not np.isfinite(y).all() or any(len(r[k]) != len(y) or not np.isfinite(r[k]).all() for k in names):
        raise ValueError('refit_weights: invalid aligned observations')
    w, _ = nnls(np.column_stack([r[k] for k in names]), y)
    total = w.sum()
    if total <= 0:
        raise ValueError('refit_weights: no positive fitted weight')
    return {k: float(v / total) for k, v in zip(names, w)}


def guard_weights(w: dict[str, float], prior: dict[str, float], *, params=None) -> dict[str, float]:
    """Project onto the bounded simplex, preserving both the guards and unit sum."""
    v = resolved_params(params)['values']
    if not w or set(w) != set(prior):
        raise ValueError('weights: mismatched names')
    for k in w:
        number(w[k], k + '.weight')
        number(prior[k], k + '.prior')
    band, cap = v['demand_weight_band'], v['demand_zero_start_cap']
    lo = {k: prior[k] * (1 - band) for k in w}
    hi = {k: prior[k] * (1 + band) if prior[k] else cap for k in w}
    if sum(lo.values()) > 1 or sum(hi.values()) < 1 or min(lo.values()) < 0:
        raise ValueError('weights: infeasible guards')
    left, right = min(w[k] - hi[k] for k in w), max(w[k] - lo[k] for k in w)
    # Bisection to floating-point precision; this is a numerical solver limit.
    for _ in range(100):
        mid = (left + right) / 2
        total = sum(min(hi[k], max(lo[k], w[k] - mid)) for k in w)
        if total > 1:
            left = mid
        else:
            right = mid
    return {k: min(hi[k], max(lo[k], w[k] - (left + right) / 2)) for k in sorted(w)}


def _paired_win(champ: list[Forecast], chall: list[Forecast], seed: int = 0, *, params=None) -> tuple[bool, float]:
    """Compare the same unique resolved product-window, horizon and metric."""
    v = resolved_params(params)['values']
    by = {_key(f): f for f in champ}
    other = {_key(f): f for f in chall}
    if not by or len(by) != len(champ) or len(other) != len(chall) or by.keys() != other.keys():
        raise ValueError('paired forecasts: empty, duplicate or mismatched windows')
    for key in by:
        _validate(by[key])
        _validate(other[key])
        if by[key].resolved_value is None or by[key].resolved_value != other[key].resolved_value:
            raise ValueError('paired forecasts: mismatched truth')
    keys = sorted(by)
    d = np.array([pinball(by[k], by[k].resolved_value) - pinball(other[k], other[k].resolved_value) for k in keys])
    rng = np.random.default_rng(seed)
    means = rng.choice(d, size=(int(v['demand_switch_draws']), d.size)).mean(axis=1)
    return bool(np.quantile(means, v['demand_alpha']) > 0), float(-np.mean([pinball(other[k], other[k].resolved_value) for k in keys]))


def fold(store: MemoryStore, name: str, scope: dict, *, champion: list[Forecast], challenger: list[Forecast],
         value: float, at: str, params=None) -> tuple[bool, str]:
    v = resolved_params(params)['values']
    number(value, 'value')
    declaration = next((d for d in DECLARED if d['name'] == name), None)
    if declaration is None:
        raise ValueError('name: undeclared demand parameter')
    validate_value(name, value)
    if value < declaration.get('guard_lo', 0) or value > declaration.get('guard_hi', float('inf')):
        raise ValueError('value: outside declared guards')
    cutoff = date.fromisoformat(at[:10]) - timedelta(weeks=v['demand_holdout_weeks'])
    champion = [f for f in champion if cutoff < date.fromisoformat(f.horizon_end) <= date.fromisoformat(at[:10])]
    challenger = [f for f in challenger if cutoff < date.fromisoformat(f.horizon_end) <= date.fromisoformat(at[:10])]
    # Freeze and validate the paired holdout before inspecting coverage or writing any row.
    won, score = _paired_win(champion, challenger, params=params)
    live = store.champion(name, scope)
    if live and coverage(champion, 1.0) < v['demand_coverage_floor']:
        store.rollback(name, scope, at)
        return False, f"coverage fell to {coverage(champion, 1.0):.2f}: rolled back"
    if len(challenger) < int(v['demand_min_resolved']):
        return False, f"{len(challenger)} resolved, needs {int(v['demand_min_resolved'])}"
    if coverage(challenger, 1.0) < v['demand_coverage_floor']:
        return False, "challenger coverage below floor"
    if not won:
        return False, "lost held-out"
    latest = max((r["version"] for r in store.history(name, scope)), default=0)
    row = store.propose(complete_row({"name": name, "scope": scope, "family": "scalar", "value_or_hyperparams": value,
                         "prior": declaration['prior'], "fitted_on_ids_hash": sha256(json.dumps(
                             sorted((_key(f), f.resolved_value) for f in challenger)).encode()).hexdigest(), "n_eff": len(challenger), "metric": "pinball",
                         "held_out_score": score, "guard_lo": declaration.get("guard_lo"), "guard_hi": declaration.get("guard_hi")}), expect_version=latest)
    # the paired bootstrap above already decided; the stored scores come from different resolved sets
    return store.promote(name, scope, row["version"], noise=float("-inf"), at=at)
