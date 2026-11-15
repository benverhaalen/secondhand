"""The capture ladder and its conformal set (identity §3.A; card 9 of seeing-the-item).

How it operates: the four rungs (1 GTIN or plate, 2 catalogue text or kind specialist, 3 image vector,
4 vision model with search) fan out in parallel under card 9's deadlines; each returns hits with its own
similarity s. A candidate scores c = max over rungs of r x s, r = 1.0, 0.8, 0.5, 0.3. Split conformal
(Angelopoulos and Bates, per the identity expert session): a confirmed capture adds 1 - c_true to the kind's
window, and a capture whose true product was not among the candidates adds 1, so coverage is not overstated.
q_hat is the window's finite-sample (1 - alpha) quantile; the set is C = {c >= 1 - q_hat}. |C| = 1 asks
"Is it this?", 2 to 4 is a pick, 0 or over 4 goes to card 17's next question. A product found by rung 3 alone
(or rung 4) is at most `likely_same_model`; `exact` needs rung 1 or 2 or the person's confirm.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

RUNG_R = {1: 1.0, 2: 0.8, 3: 0.5, 4: 0.3}
CODE_RUNGS = {1, 2}
MAX_PICK = 4


@dataclass(frozen=True)
class Hit:
    rung: int
    product: str
    s: float


def candidates(hits: list[Hit]) -> dict[str, tuple[float, frozenset[int]]]:
    """product -> (c, rungs that found it)."""
    out: dict[str, tuple[float, frozenset[int]]] = {}
    for h in hits:
        c, rungs = out.get(h.product, (0.0, frozenset()))
        out[h.product] = (max(c, RUNG_R[h.rung] * h.s), rungs | {h.rung})
    return out


def nonconformity(c_true: float | None) -> float:
    return 1.0 if c_true is None else 1.0 - c_true


def calibrate(window: list[float], alpha: float) -> float:
    """Finite-sample split-conformal quantile; an empty or tiny window gives the widest set."""
    n = len(window)
    k = math.ceil((n + 1) * (1 - alpha))
    return 1.0 if k > n else sorted(window)[k - 1]


def conformal_set(cands: dict[str, tuple[float, frozenset[int]]], q_hat: float) -> list[str]:
    return sorted((p for p, (c, _) in cands.items() if c >= 1 - q_hat), key=lambda p: -cands[p][0])


def action(c_set: list[str]) -> str:
    if len(c_set) == 1:
        return "confirm"
    return "pick" if 2 <= len(c_set) <= MAX_PICK else "ask"


def label(product: str, cands: dict[str, tuple[float, frozenset[int]]], confirmed: bool) -> str:
    if confirmed or cands[product][1] & CODE_RUNGS:
        return "exact"
    return "likely_same_model"
