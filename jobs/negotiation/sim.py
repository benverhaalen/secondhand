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

import math
import numpy as np
from .ending import round_to_ending, money
from .params import resolve, validate

TYPES = ("fair", "lowballer", "haggler", "committed", "ghost")


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


def draw_buyers(n, ask_cents, accepted_ratios, seed=0, types=TYPES, params=None):
    """n buyers; walk-away = ask x a ratio sampled from real accepted amounts, shaded per type."""
    params = resolve() if params is None else params
    validate(params)
    money(ask_cents, 'ask_cents')
    rule = params['values']['money_ending']
    rng = np.random.default_rng(seed)
    ratios = np.asarray(accepted_ratios, dtype=float)
    if ratios.ndim != 1 or not ratios.size or not np.isfinite(ratios).all() or (ratios <= 0).any():
        raise ValueError('accepted_ratios')
    if not types or any(kind not in TYPES for kind in types):
        raise ValueError('buyer types')
    pv = params['values']
    out = []
    for i in range(n):
        kind = types[i % len(types)]
        r = float(rng.choice(ratios)) * pv[f'negotiation_buyer_{kind}_shade']
        out.append(Buyer(kind, round_to_ending(math.floor(ask_cents * min(r, 1.0) + .5), rule, 0, ask_cents), pv[f'negotiation_buyer_{kind}_open_share'], pv[f'negotiation_buyer_{kind}_concede_share']))
    return out


def _check(answer, offer_cents, thread):
    """The protection: nothing the policy sends lies under the floor; nothing under it is auto accepted."""
    kind, amount = answer["kind"], answer.get("amount_cents")
    if amount is not None:
        money(amount, "amount_cents")
    if kind == "counter_offer" and not answer.get("ask") and amount is not None and amount < thread.floor_cents:
        raise FloorViolation(f"counter {amount} under floor {thread.floor_cents}")
    if kind == "counter_offer" and amount is not None and amount > thread.ask_cents:
        raise FloorViolation(f"counter {amount} over ask {thread.ask_cents}")
    if kind == "accept_offer" and offer_cents < thread.floor_cents:
        raise FloorViolation(f"auto accept of {offer_cents} under floor {thread.floor_cents}")


def run_thread(policy, thread, params=None):
    """Play one thread to its end. policy(state) -> {kind, amount_cents, ask?}."""
    params = resolve() if params is None else params
    validate(params)
    for name in ('ask_cents', 'floor_cents', 'always_accept_cents'):
        money(getattr(thread, name), name)
    if thread.floor_cents > thread.ask_cents:
        raise ValueError('floor_cents above ask_cents')
    b = thread.buyer
    money(b.walk_away_cents, 'walk_away_cents')
    if not all(math.isfinite(v) and 0 <= v <= 1 for v in (b.open_ratio, b.concede)):
        raise ValueError('buyer ratios')
    rule = params['values']['money_ending']
    offer = round_to_ending(math.floor(thread.ask_cents * b.open_ratio + .5), rule, 1, thread.ask_cents)
    if offer is None:
        raise ValueError('no opening ending')
    for rnd in range(1, int(params['values']['negotiation_max_rounds']) + 1):
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
        nxt = round_to_ending(math.floor(offer + b.concede * (b.walk_away_cents - offer) + .5), rule, 1, thread.ask_cents)
        if nxt is None:
            raise ValueError('no concession ending')
        if nxt <= offer or answer["kind"] == "decline_offer" and b.kind == "lowballer":
            thread.outcome = "walked"
            return thread
        offer = nxt
    thread.outcome = "walked"
    return thread


def run(policy, buyers, *, ask_cents, floor_cents, always_accept_cents, keep, v_wait_cents=0, params=None):
    """Realised keep per thread: keep(final) on a sale, v_wait otherwise (the item stays on the plan)."""
    money(v_wait_cents, 'v_wait_cents')
    threads = [run_thread(policy, Thread(ask_cents, floor_cents, always_accept_cents, b), params) for b in buyers]
    keeps = np.array([money(keep(t.final_cents), 'keep') if t.final_cents is not None else v_wait_cents for t in threads], dtype=float)
    return {"threads": threads, "keep_per_thread": keeps, "mean_keep": int(np.floor(keeps.mean() + .5)) if len(keeps) else 0}


def compare(champion_keeps, challenger_keeps, *, n_boot=None, seed=0, params=None, draws=None):
    """Paired gain of the challenger per thread, with its bootstrap 95% lower bound."""
    params = resolve() if params is None else params
    validate(params)
    a, b = np.asarray(champion_keeps, dtype=float), np.asarray(challenger_keeps, dtype=float)
    if a.ndim != 1 or a.size == 0 or a.shape != b.shape or not np.isfinite(a).all() or not np.isfinite(b).all():
        raise ValueError('paired outcomes must be nonempty, equal and finite')
    for values in (a, b):
        for value in values:
            money(float(value), 'paired keep')
    d = b - a
    n_boot = params['values']['negotiation_bootstrap_n'] if n_boot is None else n_boot
    if not isinstance(n_boot, int) or n_boot < 1:
        raise ValueError('n_boot')
    rng = np.random.default_rng(seed)
    if draws is None:
        boots = rng.choice(d, size=(n_boot, len(d)), replace=True).mean(axis=1)
    else:
        u = np.asarray(draws, float)
        if u.ndim != 2 or u.shape[1] != len(d) or not u.size or not np.isfinite(u).all() or (u < 0).any() or (u >= 1).any():
            raise ValueError('draws must be paired uniform samples')
        boots = d[np.floor(u * len(d)).astype(int)].mean(axis=1)
    return {"mean_gain": int(np.floor(d.mean() + .5)), "lower_95": int(np.floor(np.quantile(boots, params['values']['negotiation_bootstrap_tail']) + .5)), "n": int(len(d))}
