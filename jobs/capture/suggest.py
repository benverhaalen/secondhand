"""cap-2: the type suggestion (spec/engines/capture.md §3 step 1; spec/features/capture.md Open 2).

The phone's classifier is the model; this is the arithmetic after it: temperature, the person's Dirichlet
prior, renormalise, then card 7's preselect rule and the auto-accept bounds. Both ways of confirming run:
assign_arm splits sessions 50/50 so tap and auto can be compared on the same items.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from param.registry import MemoryStore

from .process import FAMILIES

PRIORS = json.loads(Path(__file__).with_name("process.json").read_text())["params"]

EPS = 1e-9  # a score of exactly 0.5 must not fall under the floor by rounding


def assign_arm(capture_id: str) -> str:
    return "tap" if hashlib.sha256(capture_id.encode()).digest()[0] % 2 == 0 else "auto"


def suggest(class_scores: dict[str, float], person_counts: dict[str, float] | None = None, prior_weight: float = 5,
            floor: float | None = None, margin: float | None = None, auto_top: float | None = None, auto_margin: float | None = None,
            temperature: float = 1.0, arm: str | None = None, params: MemoryStore | None = None) -> dict:
    store = params if params is not None else MemoryStore()

    def bound(name: str) -> float:
        store.declare({"name": name, "family": "scalar", "prior": PRIORS[name]})
        return store.read(name, {})["value"]

    floor = bound("capture_preselect_floor") if floor is None else floor
    margin = bound("assist_preselect_margin") if margin is None else margin
    auto_top = bound("capture_type_auto_floor") if auto_top is None else auto_top
    auto_margin = bound("capture_type_auto_margin") if auto_margin is None else auto_margin
    if temperature <= 0:
        raise ValueError("temperature must be positive")
    for d in (class_scores, person_counts or {}):
        bad = [k for k in d if k not in FAMILIES]
        if bad:
            raise ValueError(f"not a kind family: {bad}")
    raw = [max(float(class_scores.get(f, 0.0)), 0.0) ** (1 / temperature) for f in FAMILIES]
    counts = [float((person_counts or {}).get(f, 0.0)) for f in FAMILIES]
    total = sum(counts)
    prior = [(c / total * prior_weight if total else 0.0) + 1 for c in counts]
    post = [r * w for r, w in zip(raw, prior)]
    z = sum(post)
    if z <= 0:
        raise ValueError("class_scores are all zero")
    p = {f: v / z for f, v in zip(FAMILIES, post)}
    order = sorted(FAMILIES, key=lambda f: (-p[f], FAMILIES.index(f)))
    top, lead = p[order[0]], p[order[0]] - p[order[1]]
    preselect = order[0] if top >= floor - EPS and lead >= margin - EPS else None
    auto = preselect is not None and top >= auto_top - EPS and lead >= auto_margin - EPS
    return {"order": order, "shown": order[:5], "suggested_type": order[0], "preselect": preselect,
            "auto_accept": auto, "confirm_mode": "auto" if arm == "auto" and auto else "tap", "p": p}
