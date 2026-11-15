"""cap-4: the next view and the stop (spec/engines/capture.md §3 steps 4 and 5).

worth = importance x p(view fills the row) x value_at_stake; a process step that settles an unmet row is
always asked; any other view is asked when worth / cost passes the bar, cost in effort-minutes
(seconds x effort / 60). One instruction at a time; the highest ratio first.
"""
from __future__ import annotations

from typing import Any

IMPORTANCE = {"high": 3, "medium": 2, "low": 1}  # requirement fixture's importance_weight
COST_UNIT_S = 60.0
MAX_RETAKES = 2  # card 17: after two retakes on the same row the shot is kept with a flag


def candidates(rows: list[dict], unmet: list[str], kept_views: list[str], p_view_fills: dict, value_at_stake: dict,
               process_views: tuple[str, ...] = (), weights: dict = IMPORTANCE) -> list[dict[str, Any]]:
    out = []
    by_field = {r["field"]: r for r in rows}
    for field in unmet:
        r = by_field.get(field)
        if not r:
            continue
        for v in r["views_needed"]:
            if v in kept_views:
                continue
            worth = round(weights[r["priority"]] * p_view_fills.get(v, {}).get(field, 0.0) * value_at_stake.get(field, 0.0), 6)
            cost = max(r["seconds"] * r["effort"], 1) / COST_UNIT_S
            out.append({"view": v, "row_id": r["id"], "field": field, "worth": worth, "ratio": worth / cost,
                        "in_process": v in process_views})
    return out


def next_view(rows, unmet, kept_views, p_view_fills, value_at_stake, bar, process_views=(), retakes=None,
              done=False, weights=IMPORTANCE):
    """The one `missing_shot` to ask, or None when the session stops asking."""
    if done:
        return None
    retakes = retakes or {}
    best = None
    for c in candidates(rows, unmet, kept_views, p_view_fills, value_at_stake, process_views, weights):
        if retakes.get(c["row_id"], 0) >= MAX_RETAKES or c["worth"] <= 0:
            continue
        if not (c["in_process"] or c["ratio"] >= bar):
            continue
        key = (c["in_process"], c["ratio"])
        if best is None or key > (best["in_process"], best["ratio"]):
            best = c
    return best and {"view": best["view"], "row_id": best["row_id"], "worth": best["worth"]}


def stop(rows, unmet, kept_views, p_view_fills, value_at_stake, bar, process_views=(), retakes=None, done=False):
    """When nothing is left to ask: the rows a view could settle but did not, written not_visible."""
    if next_view(rows, unmet, kept_views, p_view_fills, value_at_stake, bar, process_views, retakes, done):
        return None
    view_rows = {r["field"] for r in rows if r["views_needed"]}
    return [{"field": f, "unknown_reason": "not_visible"} for f in unmet if f in view_rows]
