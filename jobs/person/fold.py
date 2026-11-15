"""Learning the person: the nightly fold (spec/features/score.md "Learning the person"; open question J26).

How it operates, per person each night: the person's own trait events (the same five traits as
app/src/engines/person/person.ts) are split by time, the newest 25% held out. The challenger is the Beta
posterior from the prior and the training events; its held-out score is the negative mean log loss on the
held-out events. It is proposed through jobs/param and promoted only when it beats the live champion's
held-out score on the same events, else the champion is kept (a worse fold never lands). A person with no
events keeps reading the prior. Every row is scoped to that one person; nothing shared is written.
"""
from __future__ import annotations

import math

from param.registry import MemoryStore

PRIORS = {  # market-wide starting values, the same as person.ts
    "person_posture": {"alpha": 2, "beta": 2},
    "person_suggestion_take": {"alpha": 3, "beta": 1},
    "person_policy_agree": {"alpha": 3, "beta": 1},
    "person_ship_on_time": {"alpha": 3.6, "beta": 0.4},
    "person_keep_share": {"alpha": 1, "beta": 3},
}
HOLD_OUT = 0.25
MIN_EVENTS = 8
NOISE = 0.01


def _mean(ab: dict) -> float:
    return ab["alpha"] / (ab["alpha"] + ab["beta"])


def _log_loss(p: float, ys: list[float]) -> float:
    p = min(max(p, 1e-6), 1 - 1e-6)
    return -sum(y * math.log(p) + (1 - y) * math.log(1 - p) for y in ys) / len(ys)


def read(store: MemoryStore, person: str, trait: str) -> dict:
    row = store.champion(trait, {"person": person})
    return row["value_or_hyperparams"] if row else PRIORS[trait]


def fold_person(store: MemoryStore, person: str, events: list[dict], at: str) -> dict:
    others = {e["person"] for e in events} - {person}
    if others:
        raise ValueError(f"fold for {person} was handed events of {sorted(others)}")
    out = {}
    for trait in PRIORS:
        ev = sorted((e for e in events if e["trait"] == trait), key=lambda e: e["at"])
        if len(ev) < MIN_EVENTS:
            continue
        cut = int(len(ev) * (1 - HOLD_OUT))
        train, held = [e["success"] for e in ev[:cut]], [e["success"] for e in ev[cut:]]
        prior = PRIORS[trait]
        post = {"alpha": prior["alpha"] + sum(train), "beta": prior["beta"] + len(train) - sum(train)}
        scope = {"person": person}
        live = store.champion(trait, scope)
        live_score = -_log_loss(_mean(live["value_or_hyperparams"] if live else prior), held)
        score = -_log_loss(_mean(post), held)
        if score - live_score <= NOISE:
            out[trait] = (False, f"lost held-out: {score:.3f} against {live_score:.3f}")
            continue
        latest = max((r["version"] for r in store.history(trait, scope)), default=0)
        row = store.propose({"name": trait, "scope": scope, "family": "beta", "value_or_hyperparams": post,
                             "prior": prior, "fitted_on_ids_hash": None, "n_eff": len(train), "metric": "log_loss",
                             "held_out_score": score, "guard_lo": 0, "guard_hi": 1}, expect_version=latest)
        # the comparison above used the same held-out events for both; stored scores may come from older sets
        out[trait] = store.promote(trait, scope, row["version"], noise=float("-inf"), at=at)
    return out
