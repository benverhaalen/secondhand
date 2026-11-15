"""ph-6: photo learning, fold, promote, rollback (spec/engines/photo.md §4).

Per event: pass rate and accept rate per (route, kind), conjugate Beta from Beta(2, 2). Nightly: gain per
(level, kind) as the mean score rise of passed renders, and `beta` (the value of a score point) per kind,
each fit on the items before the last 30 days and promoted only on the held-out days, through the same fold
capture uses. Guards: weights within ±50% of the prior and never negative; beta in 0..3. A weight frozen
while a D22 test runs is never promoted (the registry refuses).
"""
from __future__ import annotations

from capture.learn import beta_update, clamp, fold  # one fold for every engine that learns this way

PART_WEIGHTS = {"exposure": 20, "contrast": 15, "sharpness": 15, "clipping": 10, "fill": 15, "centring": 10, "background": 15}
GAIN_PRIOR = {"cover": 0.05, "other": 0.02}  # per level, card 9
BETA_PRIOR, BETA_GUARD = 1.0, (0.0, 3.0)
WEIGHT_BAND = 0.5


def observe(rates: dict, event: dict) -> dict:
    if event["kind"] == "gate":
        return {**rates, "pass": beta_update(rates.get("pass", {}), (event["route"], event["item_kind"]), event["passed"])}
    if event["kind"] == "studio_approve":
        took = event["choice"] == "use_improved"
        return {**rates, "accept": beta_update(rates.get("accept", {}), (event["route"], event["item_kind"]), took)}
    raise ValueError(f"unknown event kind {event['kind']}")


def weight_guard(part: str) -> tuple[float, float]:
    w = PART_WEIGHTS[part]
    return max(0.0, w * (1 - WEIGHT_BAND)), w * (1 + WEIGHT_BAND)


def gain_guard(slot: str) -> tuple[float, float]:
    g = GAIN_PRIOR[slot]
    return 0.0, g * 4


def _mean_rise(items: list[dict]) -> float:
    passed = [i["rise"] for i in items if i["passed"]]
    return sum(passed) / len(passed) if passed else 0.0


def _sq(value: float, item: dict) -> float:
    return (item["rise"] - value) ** 2 if item["passed"] else 0.0


def fold_gain(store, level: int, item_kind: str, slot: str, items: list[dict], now: float, at: str) -> dict:
    """items: {t, passed, rise (score rise 0..1 of the render over its source)}."""
    name, scope = f"photo.gain.l{level}.{slot}", {"kind": item_kind}
    return fold(store, name, scope, GAIN_PRIOR[slot] * level, gain_guard(slot), items, now, _mean_rise, _sq, at)


def fold_beta(store, item_kind: str, items: list[dict], now: float, at: str) -> dict:
    """items from D22 matched pairs: {t, score_gap (improved minus real cover, 0..1), price_gap (share of price)}."""
    def fit(train):
        num = sum(i["score_gap"] * i["price_gap"] for i in train)
        den = sum(i["score_gap"] ** 2 for i in train) or 1.0
        return clamp(num / den, *BETA_GUARD)

    def loss(b, i):
        return (i["price_gap"] - b * i["score_gap"]) ** 2

    return fold(store, "photo.beta", {"kind": item_kind}, BETA_PRIOR, BETA_GUARD, items, now, fit, loss, at)
