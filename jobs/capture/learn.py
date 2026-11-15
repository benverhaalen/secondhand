"""cap-6: capture learning, fold, promote, rollback (spec/engines/capture.md §4).

Per event: conjugate Beta updates (confusion per suggested/confirmed family, kept apart per confirm mode;
follow-up outcomes per (type, fact); p(view fills) per (row, view)). Nightly: a fit on the items before the
last 30 days writes a challenger; it is scored only on the held-out last 30 days and promoted only past
30 items and a 1,000-draw bootstrap that beats the champion by more than its noise. Guard bands clamp it.
Rollback is the registry's one step. The fold is shared by the photo engine (jobs/photo/learn.py).
"""
from __future__ import annotations

import random
from typing import Any, Callable

HELD_OUT_DAYS = 30
MIN_ITEMS = 30
DRAWS = 1000
DAY = 86400.0

# name: (prior, guard_lo, guard_hi); spec/engines/capture.md §4 "The prior" and its guard bands
PRIORS = {
    "capture.swap_hi": (0.9, 0.8, 0.99),
    "capture.swap_lo": (0.1, 0.01, 0.2),
    "capture.follow_up_cap": (3, 3, 3),  # the ordinary cap never grows past 3 whatever the rates say
}
SECONDS_BAND = 0.5  # seconds per (type, step) stay within ±50% of the prior


def beta_update(rates: dict, key: Any, success: bool, prior: tuple[float, float] = (2.0, 2.0)) -> dict:
    a, b = rates.get(key, prior)
    return {**rates, key: (a + 1, b) if success else (a, b + 1)}


def observe(state: dict, event: dict) -> dict:
    """One outcome event into the per-event counts; returns a new state."""
    kind = event["kind"]
    if kind == "type_confirmed":  # never pool the two confirm modes (expert session)
        key = (event["confirm_mode"], event["suggested"], event["confirmed"])
        conf = dict(state.get("confusion", {}))
        conf[key] = conf.get(key, 0) + 1
        return {**state, "confusion": conf}
    if kind == "follow_up":
        key = (event["type"], event["fact"], event["outcome"])  # answered, preselect_kept, changed, ignored
        fu = dict(state.get("follow_up", {}))
        fu[key] = fu.get(key, 0) + 1
        return {**state, "follow_up": fu}
    if kind == "view_result":
        return {**state, "view_fills": beta_update(state.get("view_fills", {}), (event["row_id"], event["view"]), event["filled"])}
    raise ValueError(f"unknown event kind {kind}")


def bootstrap_gain(champ_loss: list[float], chall_loss: list[float], draws: int = DRAWS, seed: int = 0) -> tuple[float, float]:
    """Mean paired loss drop (champion minus challenger) and its bootstrap standard error."""
    diffs = [c - n for c, n in zip(champ_loss, chall_loss)]
    if not diffs:
        return 0.0, float("inf")
    rng = random.Random(seed)
    n = len(diffs)
    means = [sum(rng.choice(diffs) for _ in range(n)) / n for _ in range(draws)]
    mu = sum(means) / draws
    se = (sum((m - mu) ** 2 for m in means) / (draws - 1)) ** 0.5
    return sum(diffs) / n, se


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def fold(store, name: str, scope: dict, prior: float, guard: tuple[float, float], items: list[dict], now: float,
         fit: Callable[[list[dict]], float], loss: Callable[[float, dict], float], at: str,
         min_items: int = MIN_ITEMS, family: str = "scalar") -> dict[str, Any]:
    """items carry `t` (epoch seconds). Returns {status, value, reason}; status prior|kept|promoted."""
    champ = store.champion(name, scope)
    if champ is None:  # a new scope starts at the card's number with n_eff 0
        row = {"name": name, "scope": scope, "family": family, "value_or_hyperparams": prior, "prior": prior,
               "n_eff": 0, "held_out_score": 0.0, "guard_lo": guard[0], "guard_hi": guard[1]}
        v = store.propose(row, expect_version=0)["version"]
        store.promote(name, scope, v, noise=0.0, at=at)
        champ = store.champion(name, scope)
    cur = champ["value_or_hyperparams"]
    if len(items) < min_items:
        return {"status": "prior" if champ["n_eff"] == 0 else "kept", "value": cur, "reason": f"{len(items)} items < {min_items}"}
    held = [i for i in items if i["t"] >= now - HELD_OUT_DAYS * DAY]
    train = [i for i in items if i["t"] < now - HELD_OUT_DAYS * DAY]
    if not held or not train:
        return {"status": "kept", "value": cur, "reason": "no held-out or no train split"}
    value = clamp(fit(train), *guard)
    gain, se = bootstrap_gain([loss(cur, i) for i in held], [loss(value, i) for i in held])
    row = {"name": name, "scope": scope, "family": family, "value_or_hyperparams": value, "prior": prior,
           "n_eff": len(train), "held_out_score": champ["held_out_score"] + gain, "guard_lo": guard[0], "guard_hi": guard[1]}
    latest = max(r["version"] for r in store.history(name, scope))
    v = store.propose(row, expect_version=latest)["version"]
    ok, why = store.promote(name, scope, v, noise=2 * se, at=at)
    return {"status": "promoted" if ok else "kept", "value": value if ok else cur, "reason": why}


# The swap bound learned from the confusion of the judge: items carry p_other (the judge's top other family)
# and wrong_pick (whether the confirmed family differs from the pick).
def swap_loss(threshold: float, item: dict) -> float:
    return float((item["p_other"] >= threshold) != item["wrong_pick"])


def fit_swap_hi(train: list[dict]) -> float:
    grid = [round(0.8 + 0.01 * k, 2) for k in range(20)]
    return min(grid, key=lambda th: (sum(swap_loss(th, i) for i in train), -th))


def seconds_guard(prior_s: float) -> tuple[float, float]:
    return prior_s * (1 - SECONDS_BAND), prior_s * (1 + SECONDS_BAND)
