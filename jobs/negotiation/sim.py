"""Scripted buyers for the negotiation engine (negotiation.md section 9, task ng-4).

How it runs: each buyer has a type, a walk-away price and an opening ratio. A thread alternates: the buyer
offers, the policy under test answers (accept, counter, decline, or ask), the buyer accepts a counter at or under
its walk-away, else concedes toward it, else walks. A ghost never answers, so the offer expires. Walk-away prices
are drawn from a sample of real accepted amounts (accepted Best Offer amounts and our accepted counters) as ratios
of the ask, so the buyers are as tough as the market was. Every policy answer is checked against the floor before
the buyer sees it: an amount under the floor, or an auto accept of an offer under the floor, is a violation and
the run fails. The result per policy is realised keep per thread; compare() gives the challenger's mean gain
over the champion with a bootstrap 95% lower bound, the number the switch rule reads.
Pure Python and numpy, seeded, deterministic.
"""
from dataclasses import dataclass, field

import numpy as np

TYPES = ("fair", "lowballer", "haggler", "committed", "ghost")
MAX_ROUNDS = 4


@dataclass
class Buyer:
    kind: str
    walk_away_cents: int
    open_ratio: float
    concede: float  # share of the gap to walk-away given up per round


@dataclass
class Thread:
    ask_cents: int
    floor_cents: int
    always_accept_cents: int
    buyer: Buyer
    rounds: list = field(default_factory=list)
    outcome: str = "open"  # accepted, walked, expired, asked
    final_cents: int | None = None


class FloorViolation(AssertionError):
    pass


def draw_buyers(n, ask_cents, accepted_ratios, seed=0, types=TYPES):
    """n buyers; walk-away = ask x a ratio sampled from real accepted amounts, shaded per type."""
    rng = np.random.default_rng(seed)
    ratios = np.asarray(accepted_ratios, dtype=float)
    shade = {"fair": 1.0, "lowballer": 0.85, "haggler": 0.97, "committed": 1.02, "ghost": 1.0}
    opens = {"fair": 0.85, "lowballer": 0.5, "haggler": 0.7, "committed": 0.9, "ghost": 0.8}
    out = []
    for i in range(n):
        kind = types[i % len(types)]
        r = float(rng.choice(ratios)) * shade[kind]
        out.append(Buyer(kind, int(round(ask_cents * min(r, 1.0))), opens[kind], 0.5 if kind == "haggler" else 0.3))
    return out


def _check(answer, offer_cents, thread):
    """The protection: nothing the policy sends lies under the floor; nothing under it is auto accepted."""
    kind, amount = answer["kind"], answer.get("amount_cents")
    if kind == "counter_offer" and not answer.get("ask") and amount is not None and amount < thread.floor_cents:
        raise FloorViolation(f"counter {amount} under floor {thread.floor_cents}")
    if kind == "counter_offer" and amount is not None and amount > thread.ask_cents:
        raise FloorViolation(f"counter {amount} over ask {thread.ask_cents}")
    if kind == "accept_offer" and offer_cents < thread.floor_cents:
        raise FloorViolation(f"auto accept of {offer_cents} under floor {thread.floor_cents}")


def run_thread(policy, thread):
    """Play one thread to its end. policy(state) -> {kind, amount_cents, ask?}."""
    b = thread.buyer
    offer = int(round(thread.ask_cents * b.open_ratio / 100.0)) * 100
    for rnd in range(1, MAX_ROUNDS + 1):
        state = {"round": rnd, "offer_cents": offer, "ask_cents": thread.ask_cents, "floor_cents": thread.floor_cents,
                 "always_accept_cents": thread.always_accept_cents}
        answer = policy(state)
        _check(answer, offer, thread)
        thread.rounds.append((offer, answer["kind"], answer.get("amount_cents")))
        if answer["kind"] == "accept_offer":
            thread.outcome, thread.final_cents = "accepted", offer
            return thread
        if answer["kind"] in ("price_below_floor", "trust_block") or answer.get("ask"):
            thread.outcome = "asked"  # the person decides; the sim does not play the person
            return thread
        if b.kind == "ghost":
            thread.outcome = "expired"
            return thread
        counter = answer.get("amount_cents")
        if answer["kind"] == "counter_offer" and counter is not None and counter <= b.walk_away_cents:
            thread.outcome, thread.final_cents = "accepted", counter
            return thread
        nxt = int(offer + b.concede * (b.walk_away_cents - offer))
        if nxt <= offer or answer["kind"] == "decline_offer" and b.kind == "lowballer":
            thread.outcome = "walked"
            return thread
        offer = nxt
    thread.outcome = "walked"
    return thread


def run(policy, buyers, *, ask_cents, floor_cents, always_accept_cents, keep, v_wait_cents=0):
    """Realised keep per thread: keep(final) on a sale, v_wait otherwise (the item stays on the plan)."""
    threads = [run_thread(policy, Thread(ask_cents, floor_cents, always_accept_cents, b)) for b in buyers]
    keeps = np.array([keep(t.final_cents) if t.final_cents is not None else v_wait_cents for t in threads], dtype=float)
    return {"threads": threads, "keep_per_thread": keeps, "mean_keep": float(keeps.mean()) if len(keeps) else 0.0}


def compare(champion_keeps, challenger_keeps, *, n_boot=2000, seed=0):
    """Paired gain of the challenger per thread, with its bootstrap 95% lower bound."""
    d = np.asarray(challenger_keeps, dtype=float) - np.asarray(champion_keeps, dtype=float)
    rng = np.random.default_rng(seed)
    boots = rng.choice(d, size=(n_boot, len(d)), replace=True).mean(axis=1)
    return {"mean_gain": float(d.mean()), "lower_95": float(np.percentile(boots, 2.5)), "n": int(len(d))}
