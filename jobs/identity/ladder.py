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
from identity.params import use
from identity.validation import unit


CODE_RUNGS = {1, 2}  # Fixed identity rule: only code/catalogue rungs can anchor exact.


@dataclass(frozen=True)
class Hit:
    rung: int
    product: str
    s: float


def candidates(hits: list[Hit], *, resolved=None) -> dict[str, tuple[float, frozenset[int]]]:
    """product -> (c, rungs that found it)."""
    v = use(resolved)["values"]
    out: dict[str, tuple[float, frozenset[int]]] = {}
    for h in hits:
        if isinstance(h.rung, bool) or not isinstance(h.rung, int) or h.rung not in CODE_RUNGS | {3, 4}:
            raise ValueError('rung must be 1, 2, 3 or 4')
        unit(h.s, 'similarity')
        c, rungs = out.get(h.product, (0.0, frozenset()))
        out[h.product] = (max(c, v["identity_rung_" + str(h.rung)] * h.s), rungs | {h.rung})
    return out


def nonconformity(c_true: float | None) -> float:
    return 1.0 if c_true is None else 1.0 - unit(c_true, "c_true")


def calibrate(window: list[float], alpha: float) -> float:
    """Finite-sample split-conformal quantile; an empty or tiny window gives the widest set."""
    unit(alpha, 'alpha')
    if not 0 < alpha < 1:
        raise ValueError('alpha must be in (0, 1)')
    for value in window:
        unit(value, 'window')
    n = len(window)
    k = math.ceil((n + 1) * (1 - alpha))
    return 1.0 if k > n else sorted(window)[k - 1]


def conformal_set(cands: dict[str, tuple[float, frozenset[int]]], q_hat: float) -> list[str]:
    unit(q_hat, 'q_hat')
    _validate_candidates(cands)
    return sorted((p for p, (c, _) in cands.items() if c >= 1 - q_hat), key=lambda p: (-cands[p][0], p))


def action(c_set: list[str], *, resolved=None) -> str:
    v = use(resolved)["values"]
    if len(c_set) == 1:
        return "confirm"
    return "pick" if 2 <= len(c_set) <= v["identity_max_pick"] else "ask"


def label(product: str, cands: dict[str, tuple[float, frozenset[int]]], confirmed: bool) -> str:
    _validate_candidates(cands)
    if confirmed or cands[product][1] & CODE_RUNGS:
        return "exact"
    return "likely_same_model"


# Ladder scores are not probabilities. A fitted temperature and none-of-these
# logit turn them into odds; prior pseudo-captures blend at every label count.
_START = use()['values']
STARTING_ODDS = (_START['identity_odds_temperature'], _START['identity_odds_none_logit'])


def _validate_candidates(cands):
    for score, rungs in cands.values():
        unit(score, 'candidate similarity')
        if not rungs or any(isinstance(r, bool) or not isinstance(r, int) or r not in {1, 2, 3, 4} for r in rungs):
            raise ValueError('rung must be 1, 2, 3 or 4')


def _validate_odds(t, b):
    if isinstance(t, bool) or not isinstance(t, (float, int)) or not math.isfinite(t) or t <= 0:
        raise ValueError('temperature must be finite and positive')
    unit(b, 'none_logit')


def odds(cands: dict[str, tuple[float, frozenset[int]]], t: float, b: float) -> tuple[dict[str, float], float]:
    """product -> p, ranked best first, and p of none of these. Shift by the max logit so exp never overflows."""
    _validate_candidates(cands)
    _validate_odds(t, b)
    ranked = sorted(cands, key=lambda p: (-cands[p][0], p))
    scores = [cands[p][0] for p in ranked] + [b]
    top = max(scores)
    e = [math.exp((v - top) / t) for v in scores]
    total = sum(e)
    return {p: e[i] / total for i, p in enumerate(ranked)}, e[-1] / total


def _matrix(labels) -> tuple[np.ndarray, np.ndarray]:
    """Scores padded with -inf, one row per capture, and the column of its truth (the last column is none of these)."""
    k = max(len(c) for c, _ in labels)
    scores = np.full((len(labels), k), -np.inf)
    truth = np.full(len(labels), k)
    for i, (cands, t) in enumerate(labels):
        ranked = sorted(cands, key=lambda p: (-cands[p][0], p))
        scores[i, :len(ranked)] = [cands[p][0] for p in ranked]
        if t is not None:
            truth[i] = ranked.index(t) if t in ranked else k
    return scores, truth


def _nll(scores: np.ndarray, truth: np.ndarray, t: float, b: float) -> float:
    z = np.concatenate([scores / t, np.full((len(scores), 1), b / t)], axis=1)
    top = z.max(axis=1, keepdims=True)
    log_total = np.log(np.exp(z - top).sum(axis=1)) + top[:, 0]
    return float((log_total - z[np.arange(len(truth)), truth]).sum())


def fit_odds(labels: list[tuple[dict, str | None]], *, resolved=None) -> tuple[float, float, int]:
    """Fit odds, blending thin evidence with the declared prior at every count."""
    v = use(resolved)['values']
    start = v['identity_odds_temperature'], v['identity_odds_none_logit']
    _validate_odds(*start)
    for cands, truth in labels:
        _validate_candidates(cands)
        if truth is not None and not isinstance(truth, str):
            raise ValueError('truth must be a product id or None')
    n = len(labels)
    if not n:
        return (*start, n)
    scores, truth = _matrix(labels)
    ts = [v['identity_odds_t_start'] * v['identity_odds_t_growth'] ** k for k in range(int(v['identity_odds_t_count']))]
    bs = [v['identity_odds_b_step'] * k for k in range(int(v['identity_odds_b_count']))]
    prior_logits = np.concatenate([scores / start[0], np.full((n, 1), start[1] / start[0])], axis=1)
    prior_logits -= prior_logits.max(axis=1, keepdims=True)
    prior_p = np.exp(prior_logits)
    prior_p /= prior_p.sum(axis=1, keepdims=True)

    def loss(t, b):
        logits = np.concatenate([scores / t, np.full((n, 1), b / t)], axis=1)
        top = logits.max(axis=1, keepdims=True)
        log_p = logits - top - np.log(np.exp(logits - top).sum(axis=1, keepdims=True))
        # Prior pseudo-captures have weight k against n observed captures;
        # zero-probability padded cells add zero to cross entropy.
        log_p = np.where(prior_p > 0, log_p, 0.)
        prior_loss = -float((prior_p * log_p).sum()) / n
        return _nll(scores, truth, t, b) + v['identity_odds_blend'] * prior_loss

    t, b = min(((t, b) for t in ts for b in bs), key=lambda tb: loss(*tb))
    return t, b, n


def expected_calibration_error(labels, t: float, b: float, bins: int = 10) -> float:
    """How far the top candidate's shown odds sit from how often it was right, weighted by bin size."""
    _validate_odds(t, b)
    if isinstance(bins, bool) or not isinstance(bins, int) or bins < 1:
        raise ValueError('bins must be a positive integer')
    rows = []
    for cands, truth in labels:
        if truth is not None and not isinstance(truth, str):
            raise ValueError('truth must be a product id or None')
        p, _ = odds(cands, t, b)
        if p:
            top = next(iter(p))
            rows.append((p[top], top == truth))
        else:
            rows.append((1., truth is None))
    err = 0.0
    for k in range(bins):
        inside = [(q, ok) for q, ok in rows if k / bins <= q < (k + 1) / bins or (k == bins - 1 and q == 1.0)]
        if inside:
            err += len(inside) / len(rows) * abs(sum(q for q, _ in inside) / len(inside) - sum(ok for _, ok in inside) / len(inside))
    return err


def answer(hits: list[Hit], *, resolved=None, t=None, b=None, q_hat=None):
    """Capture answer, including thin-evidence candidates and their named rung."""
    from identity.citation import citation
    resolved = use(resolved)
    v = resolved['values']
    cands = candidates(hits, resolved=resolved)
    t = v['identity_odds_temperature'] if t is None else t
    b = v['identity_odds_none_logit'] if b is None else b
    q_hat = 1 - v['identity_q_kind'] if q_hat is None else q_hat
    probabilities, p_none = odds(cands, t, b)
    rows = []
    for product, confidence in probabilities.items():
        best = min((h for h in hits if h.product == product),
                   key=lambda h: (-v['identity_rung_' + str(h.rung)] * h.s, h.rung))
        rows.append({'product_id': product, 'score': cands[product][0], 'rung': best.rung,
                     'confidence': confidence, 'label': label(product, cands, False)})
    selection = conformal_set(cands, q_hat)
    return {'candidates': rows, 'conformal_set': selection, 'action': action(selection, resolved=resolved),
            'rung': rows[0]['rung'] if rows else 'prior', 'confidence': rows[0]['confidence'] if rows else p_none,
            'none_confidence': p_none,
            'citation': citation('capture_identity', {'hits': [vars(h) for h in hits], 't': t, 'b': b, 'q_hat': q_hat}, resolved)}
