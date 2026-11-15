"""cap-1: the per-type capture process as data (spec/engines/capture.md §1, §3 step 2).

process.json is the one table; the phone and the jobs both read it. `process_for` returns the
`capture.process[]` steps {step, kind, role, needs_lidar, seconds} for a picked type.
"""
from __future__ import annotations

import copy
import json
from functools import lru_cache
from pathlib import Path
from typing import Any

TABLE = Path(__file__).with_name("process.json")

# spec/product.md "kind family" and photo.role, the one lists
FAMILIES = ("apparel", "shoes", "bags", "jewellery_watches", "furniture", "lighting_home", "electronics",
            "appliances_tools", "media", "cards_collectibles", "toys_lego", "bikes_sports", "baby_gear", "other")
KINDS = ("instant", "series", "scan")
ROLES = ("front", "back", "tag", "care_label", "fabric", "detail", "side", "inside", "sole", "flaw", "spin",
         "screenshot", "studio")
STEP_FIELDS = ("step", "kind", "role", "needs_lidar", "seconds")
WHEN = ("rigid", "not_rigid")


def validate(table: dict[str, Any]) -> dict[str, Any]:
    types = table.get("types")
    if not isinstance(types, dict):
        raise ValueError("process table has no types")
    for fam in FAMILIES:
        if fam not in types:
            raise ValueError(f"no process for family {fam}")
    for name, steps in types.items():
        if name.split(".", 1)[0] not in FAMILIES:
            raise ValueError(f"{name} is not a kind family")
        if not steps:
            raise ValueError(f"{name} has an empty process")
        for s in steps:
            for f in STEP_FIELDS:
                if f not in s:
                    raise ValueError(f"{name} step {s.get('step')} missing {f}")
            if s["kind"] not in KINDS:
                raise ValueError(f"{name} step {s['step']} kind {s['kind']}")
            if s["role"] not in ROLES:
                raise ValueError(f"{name} step {s['step']} role {s['role']}")
            if s.get("when") not in (None, *WHEN):
                raise ValueError(f"{name} step {s['step']} when {s['when']}")
    return table


@lru_cache(maxsize=1)
def _table() -> dict[str, Any]:
    return validate(json.loads(TABLE.read_text(encoding="utf-8")))


def load() -> dict[str, Any]:
    return copy.deepcopy(_table())


def process_for(type_: str | None, has_lidar: bool, rigid: bool = False, kind: str | None = None) -> list[dict[str, Any]]:
    """Steps for a picked type. Unknown or missing type -> other's process. Without LiDAR every
    scan becomes the 8-still ring and its measured rows go to lookup (capture-shots, no LiDAR)."""
    t = _table()
    types = t["types"]
    fam = type_ if type_ in FAMILIES else "other"
    steps = types.get(f"{fam}.{kind}") if kind else None
    steps = steps or types[fam]
    out = []
    for s in steps:
        if s.get("when") == "rigid" and not rigid or s.get("when") == "not_rigid" and rigid:
            continue
        step = {f: s[f] for f in STEP_FIELDS}
        if step["kind"] == "scan" and not has_lidar:
            step = {"step": "ring", "seconds": s["seconds"], **t["no_lidar"]}
        out.append(step)
    return out
