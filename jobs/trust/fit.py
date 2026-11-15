"""Nightly trust calibration fit (spec/engines/trust.md §4 calibration, §7 fit).

Input: resolved threads as (z, y): z = b + s, the score on the logit scale; y = 1 if the seller marked it a scam.
A fit writes a challenger `trust_calib` row (family model_ref) with its HELD-OUT score and is promoted only when it beats the
champion by more than the noise (jobs/param/registry.py). It never promotes on train. Rows are scoped: a person's fit
(scope has `person`) is written under that person and read by no one else.
Platt below SWITCH_N resolved threads, isotonic at or above it.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

SWITCH_N = 1000
NAME = "trust_calib"
URI = "jobs/trust/fit.py"


def _sig(z: float) -> float:
    return 1.0 / (1.0 + math.exp(-max(-50.0, min(50.0, z))))


def split(rows: list[tuple[float, int]]) -> tuple[list[tuple[float, int]], list[tuple[float, int]]]:
    """Deterministic: every 4th resolved thread is held out. The fit never sees it."""
    train = [r for i, r in enumerate(rows) if i % 4 != 3]
    held = [r for i, r in enumerate(rows) if i % 4 == 3]
    return train, held


def platt(rows: list[tuple[float, int]]) -> dict:
    """sigmoid(a z + b) by Newton steps with a light ridge toward a=1, b=0 so a tiny group stays tame."""
    a, b, lam = 1.0, 0.0, 1e-2
    for _ in range(40):
        ga = gb = haa = hab = hbb = 0.0
        for z, y in rows:
            p = _sig(a * z + b)
            w = p * (1 - p)
            ga += (p - y) * z; gb += p - y
            haa += w * z * z; hab += w * z; hbb += w
        ga += lam * (a - 1.0); haa += lam; hbb += lam
        det = haa * hbb - hab * hab
        if abs(det) < 1e-12:
            break
        da, db = (hbb * ga - hab * gb) / det, (haa * gb - hab * ga) / det
        a -= da; b -= db
        if abs(da) + abs(db) < 1e-9:
            break
    return {"kind": "platt", "a": a, "b": b}


def isotonic(rows: list[tuple[float, int]]) -> dict:
    """Pool-adjacent-violators on the sorted scores: knots xs (left edge of each block) and non-decreasing ys."""
    pts = sorted(rows)
    blocks: list[list[float]] = []  # [sum_y, count, left_x]
    for z, y in pts:
        blocks.append([float(y), 1.0, z])
        while len(blocks) > 1 and blocks[-2][0] / blocks[-2][1] > blocks[-1][0] / blocks[-1][1]:
            s, c, _ = blocks.pop()
            blocks[-1][0] += s; blocks[-1][1] += c
    return {"kind": "isotonic", "xs": [bl[2] for bl in blocks], "ys": [bl[0] / bl[1] for bl in blocks]}


def predict(cal: dict, z: float) -> float:
    if cal["kind"] == "platt":
        return _sig(cal["a"] * z + cal["b"])
    y = cal["ys"][0]
    for x, v in zip(cal["xs"], cal["ys"]):  # same step lookup as decide.ts
        if x <= z:
            y = v
    return y


def brier(cal: dict, rows: list[tuple[float, int]]) -> float:
    return sum((predict(cal, z) - y) ** 2 for z, y in rows) / max(1, len(rows))


def ece(cal: dict, rows: list[tuple[float, int]], bins: int = 10) -> float:
    if not rows:
        return 1.0
    out = [[0.0, 0.0, 0] for _ in range(bins)]
    for z, y in rows:
        p = predict(cal, z)
        k = min(bins - 1, int(p * bins))
        out[k][0] += p; out[k][1] += y; out[k][2] += 1
    return sum(abs(sp - sy) for sp, sy, n in out if n) / len(rows)


@dataclass
class FitResult:
    kind: str
    version: int
    held_out_score: float   # negative Brier on held-out threads only (higher is better)
    promoted: bool
    why: str


def fit(store, rows: list[tuple[float, int]], at: str, person: str | None = None, site: str | None = None, noise: float = 0.0) -> FitResult:
    scope = {k: v for k, v in (("site", site), ("person", person)) if v is not None}
    train, held = split(rows)
    cal = platt(train) if len(rows) < SWITCH_N else isotonic(train)
    score = -brier(cal, held)  # scored on held-out, never on train
    value = {"uri": URI, "version": 0, **cal, "n": len(rows), "positives": sum(y for _, y in rows), "ece": ece(cal, held)}
    latest = max((r["version"] for r in store.history(NAME, scope)), default=0)
    value["version"] = latest + 1
    ch = store.propose({"name": NAME, "scope": scope, "family": "model_ref", "value_or_hyperparams": value, "prior": None,
                        "fitted_on_ids_hash": None, "n_eff": len(rows), "metric": "neg_brier_heldout", "held_out_score": score,
                        "guard_lo": None, "guard_hi": None}, latest)
    ok, why = store.promote(NAME, scope, ch["version"], noise, at)
    return FitResult(cal["kind"], ch["version"], score, ok, why)


def watch(store, live: list[tuple[float, int]], at: str, person: str | None = None, site: str | None = None, tol: float = 0.05) -> bool:
    """Rollback: the champion scored on fresh threads. If it is worse than the score it was promoted on by more than tol, restore the
    previous promoted version. Returns True when it rolled back."""
    scope = {k: v for k, v in (("site", site), ("person", person)) if v is not None}
    cur = store.champion(NAME, scope)
    if cur is None or not live:
        return False
    v = cur["value_or_hyperparams"]
    cal = {k: v[k] for k in ("kind", "a", "b", "xs", "ys") if k in v}
    if -brier(cal, live) < cur["held_out_score"] - tol:
        try:
            store.rollback(NAME, scope, at)
        except ValueError:
            return False
        return True
    return False
