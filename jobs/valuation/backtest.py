"""Valuation backtest on frozen sold rows, with the leakage checks that refuse a leaky run.

Reads: frozen estimates (q10/q50/q90 as of a date, the comps they used) and sold rows
(comp pool and truth; prices already delivered-less-shipping). One pass per estimate:
resolve comps, check leakage, score coverage and q50 error against the sale whose
comp_id equals the estimate's item_id, and score two baselines from the same rows.
No model and no network: arithmetic only, deterministic.
"""
from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone

import numpy as np


class LeakageError(Exception):
    pass


BANDS = ("under_25", "25_to_100", "100_to_500", "over_500")


def _t(s: str) -> datetime:
    d = datetime.fromisoformat(s.replace("Z", "+00:00"))
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)  # naive reads as UTC


def _band(q50: float) -> str:
    return BANDS[0] if q50 < 2500 else BANDS[1] if q50 < 10000 else BANDS[2] if q50 <= 50000 else BANDS[3]


def _index(sold_rows):
    by_id: dict = {}
    for r in sold_rows:
        by_id.setdefault(r["comp_id"], []).append(r)
    return by_id


def check_leakage(estimates, sold_rows):
    """One entry per (item, route, comp) found. Unknown comp ids are not leakage here."""
    by_id = _index(sold_rows)
    out = []

    def add(e, route, comp_id):
        out.append({"item_id": e["item_id"], "route": route, "comp_id": comp_id})

    for e in estimates:
        item, as_of = e["item_id"], _t(e["as_of"])
        comps, fits = e.get("comp_ids") or [], e.get("fit_row_ids") or []
        targets = by_id.get(item, [])
        for cid in comps:
            if any(_t(r["sold_at"]) >= as_of for r in by_id.get(cid, [])):
                add(e, "future_comp", cid)
        for cid in comps + fits:
            if cid == item:
                add(e, "target_sale", cid)
            if any(not r.get("may_model", True) for r in by_id.get(cid, [])):
                add(e, "may_model", cid)
        for cid in fits:
            if any(_t(r["sold_at"]) >= as_of for r in by_id.get(cid, [])):
                add(e, "centred_index", cid)
        for r in targets[:1]:
            if r.get("priced_from_our_number"):
                add(e, "priced_from_our_number", item)
            if r.get("at_ask"):
                add(e, "at_ask", item)
        if len(targets) > 1:
            add(e, "duplicate_target", item)
        cluster = targets[0].get("cluster_id") if targets else None
        if cluster is not None:
            for cid in comps:
                if cid != item and any(r.get("cluster_id") == cluster for r in by_id.get(cid, [])):
                    add(e, "duplicate_target", cid)
    return out


def aci_step(alpha, covered, gamma=0.005, target=0.2):
    """D6 step 3: alpha moves by gamma*(target - err); err is 1 on a miss. Not clamped."""
    return alpha + gamma * (target - (0 if covered else 1))


def conformal_q(scores, weights, alpha):
    """Weighted quantile at level ceil((n+1)(1-alpha))/n; inf when the level passes 1."""
    if len(scores) == 0:
        raise ValueError("scores must not be empty")
    if len(scores) != len(weights):
        raise ValueError("scores and weights must be the same length")
    s, w = np.asarray(scores, float), np.asarray(weights, float)
    if not np.all(np.isfinite(s)):
        raise ValueError("scores must be finite")
    if not (np.all(np.isfinite(w)) and np.all(w > 0)):
        raise ValueError("weights must be positive and finite")
    n = len(s)
    level = math.ceil((n + 1) * (1 - alpha) - 1e-9) / n
    if level > 1:
        return math.inf
    order = np.argsort(s, kind="stable")
    cum = np.cumsum(w[order]) / w.sum()
    return float(s[order][np.argmax(cum >= level - 1e-12)])


def _wilson(hits, n, z=1.96):
    p = hits / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (max(0.0, c - h), min(1.0, c + h))


def _wmedian(vals, weights):
    o = np.argsort(vals, kind="stable")
    v, cum = np.asarray(vals, float)[o], np.cumsum(np.asarray(weights, float)[o])
    return float(v[np.argmax(cum >= cum[-1] / 2)])


def _med(xs):
    return float(np.median(xs)) if xs else None


def _summary(group, band, items, n_est, lo, hi, min_n):
    """items: scored dicts {hit, err, wm, fam}; baselines are error or None."""
    scored, hits = len(items), sum(i["hit"] for i in items)
    err = _med([i["err"] for i in items])
    base = {k: _med([i[k] for i in items if i[k] is not None]) for k in ("wm", "fam")}
    cov = hits / scored if scored else None
    wil = _wilson(hits, scored) if scored else None
    checked = scored >= min_n and wil[0] >= 0.70
    best = [b for b in base.values() if b is not None]
    passes = checked and lo <= cov <= hi and (not best or err <= min(best))
    return {
        "group": group, "price_band": band, "n": n_est, "scored": scored,
        "not_checked_yet": n_est - scored, "coverage": cov, "wilson_95": wil,
        "q50_median_error": err, "passes": bool(passes),
        "state": "checked" if checked else "not_checked_yet",
        "share_shown": hits * 10 // scored / 10 if checked else None,
    }, base


def run_backtest(estimates, sold_rows, *, coverage_lo=0.75, coverage_hi=0.85, min_n=30):
    leaks = check_leakage(estimates, sold_rows)
    if leaks:
        raise LeakageError("; ".join(f"{v['route']}: item {v['item_id']} comp {v['comp_id']}" for v in leaks))
    by_id = _index(sold_rows)
    cells: dict = {}
    n_by: dict = {}
    for e in estimates:
        key = (e["group"], _band(e["q50"]))
        n_by[key] = n_by.get(key, 0) + 1
        cell = cells.setdefault(key, [])
        comps = e.get("comp_ids") or []
        for cid in comps:
            if cid not in by_id:
                raise ValueError(f"comp {cid} of item {e['item_id']} is not in the sold rows")
        if not comps:
            continue  # counted not_checked_yet through n_est - scored
        if e["item_id"] not in by_id:
            raise ValueError(f"item {e['item_id']} has no sold row to score against")
        truth = by_id[e["item_id"]][0]
        y, as_of = truth["price_cents"], _t(e["as_of"])
        rows = [r for c in comps for r in by_id[c]]
        wm = abs(_wmedian([r["price_cents"] for r in rows], [r.get("w", 1) for r in rows]) - y) / y
        pool = [r["price_cents"] for r in sold_rows
                if r["family_id"] == truth["family_id"] and r.get("may_model", True)
                and as_of - timedelta(days=90) <= _t(r["sold_at"]) < as_of]
        fam = abs(float(np.median(pool)) - y) / y if pool else None
        cell.append({"hit": e["q10"] <= y <= e["q90"], "err": abs(e["q50"] - y) / y, "wm": wm, "fam": fam})
    keys = sorted(cells, key=lambda k: (k[0], BANDS.index(k[1])))
    out_cells, base_cells = [], {"wm": [], "fam": []}
    for k in keys:
        s, b = _summary(k[0], k[1], cells[k], n_by[k], coverage_lo, coverage_hi, min_n)
        out_cells.append(s)
        for name in b:
            base_cells[name].append({"group": k[0], "price_band": k[1], "q50_median_error": b[name]})
    allitems = [i for k in keys for i in cells[k]]
    overall, ob = _summary(None, None, allitems, len(estimates), coverage_lo, coverage_hi, min_n)
    del overall["group"], overall["price_band"]
    names = {"wm": "weighted_median", "fam": "family_90_day_median"}
    baselines = {names[n]: {"overall": {"q50_median_error": ob[n]}, "cells": base_cells[n]} for n in names}
    return {"cells": out_cells, "overall": overall, "baselines": baselines}
