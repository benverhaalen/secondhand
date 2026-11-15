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

import numpy as np

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


# The odds beside each candidate. c is a ladder score, not a probability, so it is never shown as one. Temperature
# scaling (Guo et al. 2017, "On Calibration of Modern Neural Networks") with one more logit for "none of these" turns the
# scores into odds: p_i = exp(c_i / t) / (exp(b / t) + sum_j exp(c_j / t)). t and b are fitted per kind by maximum
# likelihood on the captures people confirmed (a tap on a candidate, or "none of these"), so a shown 70% is right about
# 70% of the time on that kind. Under MIN_LABELS confirmed captures the starting values hold; they are a guess, picked so
# a 0.1 lead in c is about e to 1 and an image-only match (c at most 0.5) can still lead "none of these"; they are
# replaced by the first fit.
STARTING_ODDS = (0.10, 0.30)
MIN_LABELS = 200
_T_GRID = [round(0.01 * 1.08 ** k, 5) for k in range(60)]
_B_GRID = [round(0.02 * k, 2) for k in range(51)]


def odds(cands: dict[str, tuple[float, frozenset[int]]], t: float, b: float) -> tuple[dict[str, float], float]:
    """product -> p, ranked best first, and p of none of these. Shift by the max logit so exp never overflows."""
    ranked = sorted(cands, key=lambda p: -cands[p][0])
    z = [cands[p][0] / t for p in ranked] + [b / t]
    top = max(z)
    e = [math.exp(v - top) for v in z]
    total = sum(e)
    return {p: e[i] / total for i, p in enumerate(ranked)}, e[-1] / total


def _matrix(labels) -> tuple[np.ndarray, np.ndarray]:
    """Scores padded with -inf, one row per capture, and the column of its truth (the last column is none of these)."""
    k = max(len(c) for c, _ in labels)
    scores = np.full((len(labels), k), -np.inf)
    truth = np.full(len(labels), k)
    for i, (cands, t) in enumerate(labels):
        ranked = sorted(cands, key=lambda p: -cands[p][0])
        scores[i, :len(ranked)] = [cands[p][0] for p in ranked]
        if t is not None:
            truth[i] = ranked.index(t) if t in ranked else -1
    return scores, truth


def _nll(scores: np.ndarray, truth: np.ndarray, t: float, b: float) -> float:
    z = np.concatenate([scores / t, np.full((len(scores), 1), b / t)], axis=1)
    top = z.max(axis=1, keepdims=True)
    log_total = np.log(np.exp(z - top).sum(axis=1)) + top[:, 0]
    seen = truth >= 0  # a truth the ladder never found has p 0 under any t and b, so it cannot move the fit
    return float((log_total[seen] - z[seen, truth[seen]]).sum())


def fit_odds(labels: list[tuple[dict, str | None]]) -> tuple[float, float, int]:
    """(t, b, n) by grid search on the negative log likelihood; truth None means the person said none of these."""
    n = len(labels)
    if n < MIN_LABELS:
        return (*STARTING_ODDS, n)
    scores, truth = _matrix(labels)
    t, b = min(((t, b) for t in _T_GRID for b in _B_GRID), key=lambda tb: _nll(scores, truth, *tb))
    return t, b, n


def expected_calibration_error(labels, t: float, b: float, bins: int = 10) -> float:
    """How far the top candidate's shown odds sit from how often it was right, weighted by bin size."""
    rows = []
    for cands, truth in labels:
        p, _ = odds(cands, t, b)
        top = next(iter(p))
        rows.append((p[top], top == truth))
    err = 0.0
    for k in range(bins):
        inside = [(q, ok) for q, ok in rows if k / bins <= q < (k + 1) / bins or (k == bins - 1 and q == 1.0)]
        if inside:
            err += len(inside) / len(rows) * abs(sum(q for q, _ in inside) / len(inside) - sum(ok for _, ok in inside) / len(inside))
    return err
