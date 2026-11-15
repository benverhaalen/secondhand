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
          "held_out_score", "guard_lo", "guard_hi", "status", "frozen", "promoted_at", "origin", "previous_version", "keep", "days_since_last")
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
    scope_key(scope)
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
    return json.dumps({k: scope[k] for k in SCOPE_KEYS if scope.get(k) is not None}, separators=(",", ":"), ensure_ascii=False)


def _evidence(family, value, prior):
    if family not in {"beta", "gamma"}:
        return value
    return {k: value[k] - prior[k] for k in prior}


def _with_prior(family, value, prior, start, keep):
    if family not in {"beta", "gamma"}:
        return value
    return {k: start[k] * keep + prior[k] * (1 - keep) + (value[k] - (start[k] - prior[k]) * keep) for k in prior}


def _decay(row, as_of=None):
    if row is None or as_of is None:
        return row
    keep = forget(_elapsed(row, as_of, None))
    value = row["value_or_hyperparams"]
    if row["family"] in {"beta", "gamma"}:
        value = {k: value[k] * keep + p * (1 - keep) for k, p in row["prior"].items()}
    return {**row, "value_or_hyperparams": value, "n_eff": row["n_eff"] * keep}


def _clamped(row):
    value = row["value_or_hyperparams"]
    mean = _summary(row["family"], value)
    if mean is None:
        return value
    lo, hi = row.get("guard_lo"), row.get("guard_hi")
    bounded = max(lo if lo is not None else -math.inf, min(hi if hi is not None else math.inf, mean))
    if bounded == mean:
        return value
    if row["family"] == "beta":
        total = value["alpha"] + value["beta"]
        return {"alpha": bounded * total, "beta": (1 - bounded) * total}
    return {"shape": bounded * value["rate"], "rate": value["rate"]}


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

    def read(self, name: str, scope: dict, as_of: str | None = None) -> dict:
        d = self._decl(name)
        for i, parent in enumerate(lineage(scope)):
            c = _decay(self.champion(name, parent), as_of)
            if c:
                return {"value": copy.deepcopy(_clamped(c)), "version": c["version"], "n_eff": c["n_eff"],
                        "from": "row" if i == 0 else "parent", "scope": parent}
        return {"value": copy.deepcopy(d["prior"]), "version": 0, "n_eff": 0, "from": "prior", "scope": {}}

    def readPooled(self, name: str, scope: dict, as_of: str | None = None) -> dict:
        d = self._decl(name)
        if d["family"] not in {"beta", "gamma"}:
            return self.read(name, scope, as_of)
        kappa = self.read(POOL_KAPPA["name"], {}, as_of)["value"]
        rows = [_decay(self.champion(name, parent), as_of) for parent in lineage(scope)]
        mean = _summary(d["family"], d["prior"])
        for row in reversed(rows):
            if row:
                mean = (row["n_eff"] * _summary(d["family"], _clamped(row)) + kappa * mean) / (row["n_eff"] + kappa)
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
        inherited = next((self.champion(name, parent) for parent in lineage(scope)[1:] if self.champion(name, parent)), None)
        start = base["value_or_hyperparams"] if base else inherited["value_or_hyperparams"] if inherited else d["prior"]
        prior = base["prior"] if base else start
        keep = forget(_elapsed(base, at, days_since_last))
        # Explicit caller forgetting wins for this update: restoring full prior mass would pin recovery.
        next_value = step(copy.deepcopy(_evidence(d["family"], start, prior) if days_since_last is None else start), keep)
        if days_since_last is None:
            next_value["value"] = _with_prior(d["family"], next_value["value"], prior, start, keep)
        mean = _summary(d["family"], next_value["value"])
        lo = base.get("guard_lo") if base else None
        hi = base.get("guard_hi") if base else None
        lo = lo if lo is not None else d.get("guard_lo")
        hi = hi if hi is not None else d.get("guard_hi")
        anomaly = mean is not None and ((lo is not None and mean < lo) or (hi is not None and mean > hi))
        rows = self._rows(name, scope)
        if base:
            base["status"] = "retired"
        row = {"name": name, "scope": dict(scope), "family": d["family"], "value_or_hyperparams": copy.deepcopy(next_value["value"]),
               "prior": copy.deepcopy(prior), "origin": "event", "previous_version": base["version"] if base else None, "keep": keep, "days_since_last": days_since_last, "version": max((r["version"] for r in rows), default=0) + 1,
               "fitted_on_ids_hash": None, "n_eff": (base["n_eff"] if base else 0) * keep + next_value["weight"],
               "metric": d.get("metric"), "held_out_score": base["held_out_score"] if base else None,
               "guard_lo": lo, "guard_hi": hi, "status": "champion", "frozen": False, "promoted_at": at}
        rows.append(row)
        return {"applied": True, "reason": "clamped" if anomaly else "updated", **({"anomaly": True} if anomaly else {}), "read": self.read(name, scope)}

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
        new = {**{k: row.get(k) for k in FIELDS}, "version": latest + 1, "status": "challenger", "origin": "fit", "previous_version": None, "keep": None, "days_since_last": None, "frozen": False, "promoted_at": None}
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
        ch["previous_version"] = cur["version"] if cur else None
        ch["status"], ch["promoted_at"] = "champion", at
        return True, f"beat v{cur['version']}" if cur else "first champion"

    def rollback(self, name: str, scope: dict, at: str, keep_evidence: bool = False) -> dict:
        rows = self._rows(name, scope)
        cur = self.champion(name, scope)
        if cur is None:
            raise ValueError(f"{name} has no champion to roll back")
        by_version = {r["version"]: r for r in rows}
        events, prev = [], cur
        while prev:
            if prev is not cur and (cur["origin"] == "fit" or prev["origin"] == "fit"):
                break
            if prev["origin"] == "event":
                events.append(prev)
            prev = by_version.get(prev["previous_version"])
        if prev is None:
            raise ValueError(f"{name} has no earlier promoted fitted version")
        if cur["origin"] == "fit" or not keep_evidence:
            cur["status"] = "retired"
            prev["status"], prev["promoted_at"] = "champion", at
            return copy.deepcopy(prev)
        if cur["family"] not in {"beta", "gamma"}:
            raise ValueError("keep_evidence supports beta or gamma")
        value = copy.deepcopy(prev["value_or_hyperparams"])
        n_eff = prev["n_eff"]
        factor = forget(_elapsed(events[0], at, None)) if events else 1
        for row in events:
            if row["keep"] is None:
                raise ValueError("event history lacks decay metadata for keep_evidence")
            base = by_version.get(row["previous_version"])
            start = base["value_or_hyperparams"] if base else row["prior"]
            old = start if row["days_since_last"] is not None else _evidence(row["family"], start, row["prior"])
            next_value = row["value_or_hyperparams"] if row["days_since_last"] is not None else _evidence(row["family"], row["value_or_hyperparams"], row["prior"])
            value = {k: v + (next_value[k] - old[k] * row["keep"]) * factor for k, v in value.items()}
            n_eff += (row["n_eff"] - (base["n_eff"] if base else 0) * row["keep"]) * factor
            factor *= row["keep"]
        restored = {**copy.deepcopy(prev), "version": max(r["version"] for r in rows) + 1, "origin": "event", "status": "champion",
                    "previous_version": prev["version"], "keep": 1, "days_since_last": None, "value_or_hyperparams": value, "n_eff": n_eff, "promoted_at": at}
        cur["status"] = "retired"
        rows.append(restored)
        return copy.deepcopy(restored)
