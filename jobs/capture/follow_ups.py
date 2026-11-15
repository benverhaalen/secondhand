"""Superseded 2026-11-15 by the deterministic plan in app/src/engines/capture/plan.ts (spec/engines/capture.md §11): the routes run that engine; build nothing new on this file. Kept so its tests and the param priors it names stay readable.

cap-5: the follow-up inputs (spec/engines/capture.md §3 step 6, spec/features/capture.md follow-up table).

Empty facts whose ladder ends in `asked` or `lookup`, condition first, then importance x (1 - p(preselect
is right)). At most 3 ordinary inputs; a field the type's process needs gets its own input past the cap
(Nate, Open 7). A fact a kept frame settles, or one already asked, is never asked. `function` is never
preselected: whether an item works is only the person's statement.
`find` (the person wants one like it) asks no condition or wear: the thing in the frame is not theirs to grade
(capture.purpose, research/cross-cutting/nate/capture-expert-session.md, agent proposal).
"""
from __future__ import annotations

from typing import Any

from capture.next_view import IMPORTANCE

CAP = 3
PURPOSES = ("sell", "appraise", "find")  # capture.purpose


def follow_ups(rows: list[dict], facts: dict[str, dict], asked: set[str] | frozenset = frozenset(),
               process_fields: set[str] | frozenset = frozenset(), weights: dict = IMPORTANCE,
               purpose: str = "sell") -> list[dict[str, Any]]:
    if purpose not in PURPOSES:
        raise ValueError(f"capture purpose {purpose}")
    cand = [r for r in rows
            if not (purpose == "find" and r.get("role") == "condition")
            and facts.get(r["field"], {}).get("state") == "empty" and r["field"] not in asked
            and any(rung["rung"] in ("asked", "lookup") for rung in r["fill_ladder"])]

    def score(r):
        return weights[r["priority"]] * (1 - facts[r["field"]].get("p_preselect_right", 0.0))

    cand.sort(key=lambda r: (r.get("role") != "condition", -score(r)))
    ordinary = [r for r in cand if r["field"] not in process_fields][:CAP]
    extra = [r for r in cand if r["field"] in process_fields]
    chosen = sorted(ordinary + extra, key=cand.index)
    return [{"field": r["field"], "row_id": r["id"],
             "preselect": None if r.get("role") == "function" else facts[r["field"]].get("preselect")}
            for r in chosen]
