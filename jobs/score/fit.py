"""Nightly success-band fit from settled outcomes (score.md, 'The success score').

The score remains U_now/U_best. This fits its three band cut points and measured
sale rates, not a second set of axis weights absent from the specification.
"""
from __future__ import annotations

import hashlib
from itertools import combinations
import math

import numpy as np
from .params import resolve
from param.registry import complete_row


def validate(rows):
    for row in rows:
        if not row.get('may_model', True):
            raise ValueError('may_model false')
        if not math.isfinite(row['value']) or not 0 <= row['value'] <= 100:
            raise ValueError('score must be finite and within [0,100]')
        if row['sold'] not in (0, 1):
            raise ValueError('sold outcome must be binary')
    if len({r['outcome_id'] for r in rows}) != len(rows):
        raise ValueError('duplicate outcome')


def fit_bands(rows, min_band=None, params=None):
    validate(rows)
    params = params if params is not None else resolve()['values']
    min_band = params['score_min_band'] if min_band is None else min_band
    rows = [{**row, 'value': math.floor(row['value'] + .5)} for row in rows]  # Fixed: same integer half-up score as TypeScript.
    if not isinstance(min_band, (int, float)) or not math.isfinite(min_band) or min_band < 1 or int(min_band) != min_band:
        raise ValueError('min_band must be positive')
    values = sorted({r['value'] for r in rows})
    if len(values) < 4 or len(rows) < 4 * min_band:
        return None
    counts = np.array([sum(r['value'] == v for r in rows) for v in values])
    hits = np.array([sum(r['sold'] for r in rows if r['value'] == v) for v in values])
    nc, hc = np.r_[0, counts.cumsum()], np.r_[0, hits.cumsum()]
    winner, best = None, math.inf
    for splits in combinations(range(1, len(values)), 3):
        indices = (0, *splits, len(values))
        n = np.diff(nc[list(indices)])
        if (n < min_band).any():
            continue
        h = np.diff(hc[list(indices)])
        rates = h / n
        if not np.all(np.diff(rates) > 0):
            continue
        loss = float(np.sum(n * rates * (1 - rates)))
        if loss < best:
            best = loss
            winner = {'cuts': [(values[i - 1] + values[i]) / 2 for i in splits], 'rates': rates.tolist()}
    return winner


def errors(model, rows):
    validate(rows)
    cuts, rates = model['cuts'], model['rates']
    if len(cuts) != 3 or len(rates) != 4 or not all(0 <= c <= 100 for c in cuts) or not all(a < b for a, b in zip(cuts, cuts[1:])) or not all(0 <= p <= 1 for p in rates):
        raise ValueError('invalid score band model')
    return np.array([(rates[sum(math.floor(r['value'] + .5) >= c for c in cuts)] - r['sold']) ** 2 for r in rows])


def nightly(training, held_out, prior, store, scope, at, min_band=None, seed=0, log=None, read=None):
    resolved = resolve(read, scope)
    values, versions = resolved['values'], resolved['versions']
    min_band = values['score_min_band'] if min_band is None else min_band
    if not isinstance(min_band, (int, float)) or not math.isfinite(min_band) or min_band < 1 or int(min_band) != min_band:
        raise ValueError('min_band must be a positive integer')
    if scope.get('person') is not None and any(r.get('person') != scope['person'] for r in [*training, *held_out]):
        raise ValueError('outcome outside person scope')
    current = store.champion('score_bands', scope)
    champion = current['value_or_hyperparams'] if current else prior
    validate(training)
    validate(held_out)
    if not held_out:
        raise ValueError('held-out outcomes required')
    if {r['outcome_id'] for r in training} & {r['outcome_id'] for r in held_out}:
        raise ValueError('training/held-out overlap')
    if log:
        log.note('score.fit input', training_n=len(training), held_out_n=len(held_out), seed=seed)
    if len(training) < 4 * min_band:
        return {'state': 'prior', 'model': champion, 'param_versions': versions}
    candidate = fit_bands(training, min_band, values)
    if candidate is None:
        return {'state': 'kept', 'model': champion, 'reason': 'no separated bands', 'param_versions': versions}
    gains = errors(champion, held_out) - errors(candidate, held_out)
    rng = np.random.default_rng(seed)
    lower_bound = float(np.quantile(np.mean(rng.choice(gains, (int(values['score_bootstrap_n']), len(gains))), axis=1), values['score_bootstrap_alpha']))
    if lower_bound <= 0:
        return {'state': 'kept', 'model': champion, 'reason': 'lost held-out', 'param_versions': versions}
    score = -float(np.mean(errors(candidate, held_out)))
    fitted_hash = hashlib.sha256('\n'.join(sorted(r['outcome_id'] for r in training)).encode()).hexdigest()
    def publish(name, family, value, initial):
        history = store.history(name, scope)
        row = store.propose(complete_row({'name': name, 'scope': scope, 'family': family, 'value_or_hyperparams': value,
                             'prior': initial, 'n_eff': len(training), 'metric': 'negative_brier',
                             'held_out_score': score, 'fitted_on_ids_hash': fitted_hash}),
                            max((r['version'] for r in history), default=0))
        return store.promote(name, scope, row['version'], 0, at)
    # Registry scores must compare the same held-out cohort, rather than last night's easier or harder cohort.
    saved_score = current['held_out_score'] if current else None
    promoted = False
    try:
        if current:
            current['held_out_score'] = -float(np.mean(errors(champion, held_out)))
        promoted, reason = publish('score_bands', 'model_ref', candidate, prior)
    finally:
        if current and not promoted:
            current['held_out_score'] = saved_score
    if log:
        log.change('param', 'score_bands', 'champion' if promoted else 'challenger', reason=reason)
    return {'state': 'promoted' if promoted else 'kept', 'model': candidate if promoted else champion, 'gain_lb': lower_bound, 'param_versions': versions}
