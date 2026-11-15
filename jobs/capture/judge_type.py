"""cap-3: the type check (spec/engines/capture.md §3 step 3).

`capture_judge` (the model) gives p(family) on the first kept still; this is the rule on its scores. It
swaps only when another family is at least swap_hi and the pick under swap_lo, keeps every photo, and
returns only the new type's frames not yet taken. One bound crossed and not the other is category_unsure.
"""
from __future__ import annotations

from .process import FAMILIES, process_for

MIN_SWAP_HI = 0.8  # §4 guard band
EPS = 1e-9


def judge(picked: str, judge_scores: dict[str, float], photos: list[dict], swap_hi: float = 0.9,
          swap_lo: float = 0.1, has_lidar: bool = True, rigid: bool = False, kind: str | None = None) -> dict:
    if swap_hi < MIN_SWAP_HI:
        raise ValueError(f"swap_hi {swap_hi} is under the {MIN_SWAP_HI} guard")
    if picked not in FAMILIES:
        raise ValueError(f"not a kind family: {picked}")
    p_pick = judge_scores.get(picked, 0.0)
    ranked = sorted((f for f in FAMILIES if f != picked), key=lambda f: -judge_scores.get(f, 0.0))
    other = ranked[0]
    p_other = judge_scores.get(other, 0.0)
    hi, lo = p_other >= swap_hi - EPS, p_pick < swap_lo - EPS
    if hi and lo:
        action, type_, cands = "swap", other, [other, picked]
    else:
        action, type_ = ("category_unsure" if hi or lo else "keep"), picked
        top2 = sorted(FAMILIES, key=lambda f: -judge_scores.get(f, 0.0))[:2]
        cands = top2 if action == "category_unsure" else [picked, other]
    have = {p["role"] for p in photos}
    missing = [s for s in process_for(type_, has_lidar, rigid, kind) if s["role"] not in have]
    return {"action": action, "type": type_, "candidates": cands, "photos": [p["id"] for p in photos],
            "missing_shot": missing}
