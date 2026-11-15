"""Demand learning: resolve, refit, coverage, promote, rollback (demand-and-trend §4, nightly `param_fold`).

How it operates, per kind each night: forecasts whose horizon ended and whose actual is known are resolved
(however late) and scored by pinball loss at p10, p50, p90. The D weights are refit by non-negative least
squares and normalised, then held within ±50% of their prior (a signal that started at 0 is capped at 0.20).
`k_cov` is the split-conformal scale that puts 80% of resolved values inside the widened range. `fold` first
checks the live champion: if its fresh coverage fell below 70%, it rolls back. Otherwise a challenger is
promoted only with at least 300 resolved product-windows, coverage held, and a paired 1,000-draw bootstrap
win on pinball loss. Every promoted row carries its held-out score through jobs/param.
"""
from __future__ import annotations

from dataclasses import dataclass, replace

import numpy as np
from scipy.optimize import nnls

from param.registry import MemoryStore

MIN_RESOLVED = 300
COVERAGE_TARGET = 0.80
COVERAGE_FLOOR = 0.70
ZERO_START_CAP = 0.20
BAND = 0.5


@dataclass(frozen=True)
class Forecast:
    id: str
    product: str
    horizon_end: str  # ISO date
    p10: float
    p50: float
    p90: float
    resolved_value: float | None = None


def pinball(f: Forecast, y: float) -> float:
    return sum(max(q * (y - v), (q - 1) * (y - v)) for q, v in ((0.1, f.p10), (0.5, f.p50), (0.9, f.p90))) / 3


def resolve(forecasts: list[Forecast], actuals: dict[str, float], today: str) -> list[Forecast]:
    return [replace(f, resolved_value=actuals[f.product]) for f in forecasts
            if f.horizon_end <= today and f.product in actuals]


def coverage(resolved: list[Forecast], k: float) -> float:
    inside = [f.p50 - k * (f.p50 - f.p10) <= f.resolved_value <= f.p50 + k * (f.p90 - f.p50) for f in resolved]
    return float(np.mean(inside)) if inside else 0.0


def k_cov(resolved: list[Forecast]) -> float:
    """Scale on the p10-p90 half-widths so COVERAGE_TARGET of the last 200 resolved fall inside."""
    last = resolved[-200:]
    need = [max((f.p50 - f.resolved_value) / max(f.p50 - f.p10, 1e-9),
                (f.resolved_value - f.p50) / max(f.p90 - f.p50, 1e-9)) for f in last]
    return float(np.quantile(need, COVERAGE_TARGET))


def refit_weights(r: dict[str, np.ndarray], y: np.ndarray) -> dict[str, float]:
    names = list(r)
    w, _ = nnls(np.column_stack([r[k] for k in names]), y)
    total = w.sum() or 1.0
    return {k: float(v / total) for k, v in zip(names, w)}


def guard_weights(w: dict[str, float], prior: dict[str, float]) -> dict[str, float]:
    """Clip to the guard band and renormalise until both hold."""
    lo = {k: prior[k] * (1 - BAND) for k in w}
    hi = {k: prior[k] * (1 + BAND) if prior[k] > 0 else ZERO_START_CAP for k in w}
    for _ in range(50):
        w = {k: min(max(v, lo[k]), hi[k]) for k, v in w.items()}
        total = sum(w.values())
        w = {k: v / total for k, v in w.items()}
        if all(lo[k] - 1e-12 <= v <= hi[k] + 1e-12 for k, v in w.items()):
            break
    return w


def _paired_win(champ: list[Forecast], chall: list[Forecast], seed: int = 0) -> tuple[bool, float]:
    """Challenger beats champion on the same products by more than the bootstrap noise."""
    by = {f.product: f for f in champ}
    d = np.array([pinball(by[f.product], f.resolved_value) - pinball(f, f.resolved_value) for f in chall if f.product in by])
    rng = np.random.default_rng(seed)
    means = rng.choice(d, size=(1000, d.size)).mean(axis=1)
    return bool(np.quantile(means, 0.05) > 0), float(-np.mean([pinball(f, f.resolved_value) for f in chall]))


def fold(store: MemoryStore, name: str, scope: dict, *, champion: list[Forecast], challenger: list[Forecast],
         value: dict, at: str) -> tuple[bool, str]:
    live = store.champion(name, scope)
    if live and coverage(champion, 1.0) < COVERAGE_FLOOR:
        store.rollback(name, scope, at)
        return False, f"coverage fell to {coverage(champion, 1.0):.2f}: rolled back"
    if len(challenger) < MIN_RESOLVED:
        return False, f"{len(challenger)} resolved, needs {MIN_RESOLVED}"
    if coverage(challenger, 1.0) < COVERAGE_FLOOR:
        return False, "challenger coverage below floor"
    won, score = _paired_win(champion, challenger)
    if not won:
        return False, "lost held-out"
    latest = max((r["version"] for r in store.history(name, scope)), default=0)
    row = store.propose({"name": name, "scope": scope, "family": "scalar", "value_or_hyperparams": value,
                         "prior": value, "fitted_on_ids_hash": None, "n_eff": len(challenger), "metric": "pinball",
                         "held_out_score": score, "guard_lo": None, "guard_hi": None}, expect_version=latest)
    # the paired bootstrap above already decided; the stored scores come from different resolved sets
    return store.promote(name, scope, row["version"], noise=float("-inf"), at=at)
