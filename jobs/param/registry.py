"""The param registry, Python side, for nightly fits (spec/product.md §3 `param`, §6 "Real-time weights").

Same row shape as app/src/engines/param/param.ts (row.json is the shared fixture). A fit writes a challenger with its
held-out score; it is promoted only when it beats the champion by more than the noise; rollback restores the previous version.
"""
from __future__ import annotations

import copy
import json
import math
from datetime import datetime, timezone
from dataclasses import dataclass, field

FIELDS = ("name", "scope", "family", "value_or_hyperparams", "prior", "version", "fitted_on_ids_hash", "n_eff", "metric",
          "held_out_score", "guard_lo", "guard_hi", "status", "frozen", "promoted_at")
FAMILIES = {"scalar", "beta", "normal", "gamma", "model_ref"}
SCOPE_KEYS = ("kind", "site", "segment", "state", "person")
FORGET_DAYS = 30
# spec/marketing-engine.md#35-update-rules
POOL_KAPPA = {"name": "param_pool_kappa", "family": "scalar", "prior": 20}


class Unknown(Exception):
    pass


def forget(days: float) -> float:
    return 0.5 ** (days / FORGET_DAYS)


def lineage(scope: dict) -> list[dict]:
    if "person" in scope:
        return [dict(scope), {k: v for k, v in scope.items() if k != "person"}]
    result, current = [dict(scope)], dict(scope)
    for key in reversed(SCOPE_KEYS):
        if key in current:
            current = {k: v for k, v in current.items() if k != key}
            result.append(current)
    return result


def _timestamp(at: str) -> float:
    dt = datetime.fromisoformat(at.replace("Z", "+00:00"))
    return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).timestamp()


def _elapsed(base: dict | None, at: str, days: float | None) -> float:
    if days is not None:
        return days
    # Out-of-order observations still apply, with zero decay.
    return max(0, (_timestamp(at) - _timestamp(base["promoted_at"])) / 86400) if base and base["promoted_at"] else 0


def _summary(family: str, value):
    if family == "beta":
        return value["alpha"] / (value["alpha"] + value["beta"])
    if family == "gamma":
        return value["shape"] / value["rate"]
    return None


class VersionConflict(Exception):
    pass


def scope_key(scope: dict) -> str:
    bad = set(scope) - set(SCOPE_KEYS)
    if bad:
        raise ValueError(f"unknown scope keys {sorted(bad)}")
    return json.dumps({k: scope[k] for k in SCOPE_KEYS if scope.get(k) is not None}, sort_keys=True)


@dataclass
class MemoryStore:
    """In-memory store behind the same interface the Lakebase store will have; tests and fits run against it."""
    rows: dict = field(default_factory=dict)
    _declared: dict = field(default_factory=lambda: {POOL_KAPPA["name"]: copy.deepcopy(POOL_KAPPA)})

    def declare(self, declaration: dict) -> None:
        self._declared[declaration["name"]] = copy.deepcopy(declaration)

    def _decl(self, name: str) -> dict:
        if name not in self._declared:
            raise Unknown(f"param {name} is not declared")
        return self._declared[name]

    def read(self, name: str, scope: dict) -> dict:
        d = self._decl(name)
        for i, parent in enumerate(lineage(scope)):
            c = self.champion(name, parent)
            if c:
                return {"value": copy.deepcopy(c["value_or_hyperparams"]), "version": c["version"], "n_eff": c["n_eff"],
                        "from": "row" if i == 0 else "parent", "scope": parent}
        return {"value": copy.deepcopy(d["prior"]), "version": 0, "n_eff": 0, "from": "prior", "scope": {}}

    def readPooled(self, name: str, scope: dict) -> dict:
        d = self._decl(name)
        if d["family"] not in {"beta", "gamma"}:
            return self.read(name, scope)
        kappa = self.read(POOL_KAPPA["name"], {})["value"]
        rows = [self.champion(name, parent) for parent in lineage(scope)]
        mean = _summary(d["family"], d["prior"])
        for row in reversed(rows):
            if row:
                mean = (row["n_eff"] * _summary(d["family"], row["value_or_hyperparams"]) + kappa * mean) / (row["n_eff"] + kappa)
        return {"mean": mean, "n_eff": next((row["n_eff"] for row in rows if row), 0),
                "versions": [row["version"] for row in rows if row]}

    def freeze(self, name: str, scope: dict, on: bool) -> None:
        for row in self._rows(name, scope):
            row["frozen"] = on

    def observe(self, name: str, scope: dict, outcome: dict, at: str) -> dict:
        d = self._decl(name)
        weight = outcome["weight"]
        if d["family"] == "beta" and "success" in outcome:
            def step(v, keep):
                return {"value": {"alpha": v["alpha"] * keep + weight * outcome["success"],
                                  "beta": v["beta"] * keep + weight * (1 - outcome["success"])}, "weight": weight}
        elif d["family"] == "gamma" and "count" in outcome and "exposure" in outcome:
            def step(v, keep):
                return {"value": {"shape": v["shape"] * keep + weight * outcome["count"],
                                  "rate": v["rate"] * keep + weight * outcome["exposure"]}, "weight": weight}
        else:
            raise ValueError(f"observe supports beta success or gamma count/exposure; {name} is {d['family']}")
        return self.apply(name, scope, step, at, outcome.get("days_since_last"))

    def apply(self, name: str, scope: dict, step, at: str, days_since_last: float | None = None) -> dict:
        d = self._decl(name)
        base = self.champion(name, scope)
        if base and base["frozen"]:
            return {"applied": False, "reason": "frozen", "read": self.read(name, scope)}
        start = base["value_or_hyperparams"] if base else self.read(name, scope)["value"]
        keep = forget(_elapsed(base, at, days_since_last))
        next_value = step(copy.deepcopy(start), keep)
        mean = _summary(d["family"], next_value["value"])
        lo = base.get("guard_lo") if base else None
        hi = base.get("guard_hi") if base else None
        lo = lo if lo is not None else d.get("guard_lo")
        hi = hi if hi is not None else d.get("guard_hi")
        if mean is not None and ((lo is not None and mean < lo) or (hi is not None and mean > hi)):
            return {"applied": False, "reason": "guard", "read": self.read(name, scope)}
        rows = self._rows(name, scope)
        if base:
            base["status"] = "retired"
        row = {"name": name, "scope": dict(scope), "family": d["family"], "value_or_hyperparams": copy.deepcopy(next_value["value"]),
               "prior": copy.deepcopy(d["prior"]), "version": max((r["version"] for r in rows), default=0) + 1,
               "fitted_on_ids_hash": None, "n_eff": (base["n_eff"] if base else 0) * keep + next_value["weight"],
               "metric": d.get("metric"), "held_out_score": base["held_out_score"] if base else None,
               "guard_lo": lo, "guard_hi": hi, "status": "champion", "frozen": False, "promoted_at": at}
        rows.append(row)
        return {"applied": True, "reason": "updated", "read": self.read(name, scope)}

    def _rows(self, name: str, scope: dict) -> list:
        return self.rows.setdefault((name, scope_key(scope)), [])

    def history(self, name: str, scope: dict) -> list:
        return copy.deepcopy(self._rows(name, scope))

    def champion(self, name: str, scope: dict) -> dict | None:
        return next((r for r in self._rows(name, scope) if r["status"] == "champion"), None)

    def propose(self, row: dict, expect_version: int) -> dict:
        if row.get("held_out_score") is None or math.isnan(row["held_out_score"]):
            raise ValueError(f"a fit wrote {row.get('name')} without its held-out score")
        if row.get("family") not in FAMILIES:
            raise ValueError(f"family {row.get('family')!r} is not one of {sorted(FAMILIES)}")
        rows = self._rows(row["name"], row["scope"])
        latest = max((r["version"] for r in rows), default=0)
        if latest != expect_version:
            raise VersionConflict(f"{row['name']} is at v{latest}, fit expected v{expect_version}")
        new = {**{k: row.get(k) for k in FIELDS}, "version": latest + 1, "status": "challenger", "frozen": False, "promoted_at": None}
        rows.append(new)
        return copy.deepcopy(new)

    def promote(self, name: str, scope: dict, version: int, noise: float, at: str, champion_score=None) -> tuple[bool, str]:
        rows = self._rows(name, scope)
        ch = next((r for r in rows if r["version"] == version and r["status"] == "challenger"), None)
        if ch is None:
            return False, "no such challenger"
        cur = self.champion(name, scope)
        if cur and cur["frozen"]:
            return False, "frozen"
        score = champion_score if champion_score is not None else cur["held_out_score"] if cur else None
        if cur and score is not None and ch["held_out_score"] - score <= noise:
            return False, "lost held-out"
        if cur:
            cur["status"] = "retired"
            if champion_score is not None:
                cur["held_out_score"] = champion_score
        ch["status"], ch["promoted_at"] = "champion", at
        return True, f"beat v{cur['version']}" if cur else "first champion"

    def rollback(self, name: str, scope: dict, at: str) -> dict:
        rows = self._rows(name, scope)
        cur = self.champion(name, scope)
        if cur is None:
            raise ValueError(f"{name} has no champion to roll back")
        prev = max((r for r in rows if r["version"] < cur["version"] and r["promoted_at"]), key=lambda r: r["version"], default=None)
        if prev is None:
            raise ValueError(f"{name} has no earlier promoted version")
        cur["status"] = "retired"
        prev["status"], prev["promoted_at"] = "champion", at
        return copy.deepcopy(prev)
