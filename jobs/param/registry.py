"""The param registry, Python side, for nightly fits (spec/product.md §3 `param`, §6 "Real-time weights").

Same row shape as app/src/engines/param/param.ts (row.json is the shared fixture). A fit writes a challenger with its
held-out score; it is promoted only when it beats the champion by more than the noise; rollback restores the previous version.
"""
from __future__ import annotations

import copy
import json
from dataclasses import dataclass, field

FIELDS = ("name", "scope", "family", "value_or_hyperparams", "prior", "version", "fitted_on_ids_hash", "n_eff", "metric",
          "held_out_score", "guard_lo", "guard_hi", "status", "frozen", "promoted_at")
FAMILIES = {"scalar", "beta", "normal", "gamma", "model_ref"}
SCOPE_KEYS = ("kind", "site", "segment", "state", "person")


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

    def _rows(self, name: str, scope: dict) -> list:
        return self.rows.setdefault((name, scope_key(scope)), [])

    def history(self, name: str, scope: dict) -> list:
        return copy.deepcopy(self._rows(name, scope))

    def champion(self, name: str, scope: dict) -> dict | None:
        return next((r for r in self._rows(name, scope) if r["status"] == "champion"), None)

    def propose(self, row: dict, expect_version: int) -> dict:
        if row.get("held_out_score") is None:
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

    def promote(self, name: str, scope: dict, version: int, noise: float, at: str) -> tuple[bool, str]:
        rows = self._rows(name, scope)
        ch = next((r for r in rows if r["version"] == version and r["status"] == "challenger"), None)
        if ch is None:
            return False, "no such challenger"
        cur = self.champion(name, scope)
        if cur and cur["frozen"]:
            return False, "frozen"
        if cur and cur["held_out_score"] is not None and ch["held_out_score"] - cur["held_out_score"] <= noise:
            return False, "lost held-out"
        if cur:
            cur["status"] = "retired"
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
