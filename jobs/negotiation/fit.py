"""negotiation.md §3–4: pooled logistic, Laplace event updates and held-out version gate."""
from __future__ import annotations

from dataclasses import dataclass, field
import hashlib
import math

import numpy as np
from scipy.optimize import minimize
from scipy.special import expit
from .params import resolve, validate as validate_params
from param.registry import complete_row


def keys(row):
    return ['global', f"site:{row['site']}", f"category:{row['category']}", f"cell:{row['site']}:{row['category']}"]


def validate_features(rows, dimension):
    if not rows:
        raise ValueError('empty outcomes')
    for row in rows:
        if not row.get('may_model', True):
            raise ValueError('may_model false')
        x = np.asarray(row['features'], float)
        if x.shape != (dimension,) or not np.isfinite(x).all():
            raise ValueError('features must be finite and match model')


def validate(rows, dimension, label):
    validate_features(rows, dimension)
    for row in rows:
        if row.get(label) not in (0, 1):
            raise ValueError(f'{label} must be binary')


@dataclass
class Logistic:
    terms: dict
    weights: list
    prior_terms: dict | None = None
    prior_weights: list | None = None
    precision: dict = field(default_factory=dict)
    params: dict = field(default_factory=resolve)
    label: str = 'accepted'

    def predict(self, row):
        validate_features([row], len(self.weights))
        validate_params(self.params)
        z = sum(self.terms.get(k, 0) for k in keys(row)) + np.dot(self.weights, row['features'])
        return float(np.clip(expit(z), self.params['values']['negotiation_p_lo'], self.params['values']['negotiation_p_hi']))

    def payload(self):
        return {'terms': self.terms, 'weights': self.weights, 'precision': self.precision, 'label': self.label, 'param_versions': self.params['versions']}


def bounds(prior, params=None):
    params = resolve() if params is None else params
    validate_params(params)
    pv = params['values']
    p_lo, p_hi = pv['negotiation_p_lo'], pv['negotiation_p_hi']
    logit_width = (math.log(p_hi / (1 - p_hi)) - math.log(p_lo / (1 - p_lo))) / 2
    width = max(abs(prior) * pv['negotiation_prior_guard_share'], logit_width)
    return prior - width, prior + width


def fit(rows, prior, label='accepted', pooling=None, params=None):
    params = prior.params if params is None else params
    validate_params(params)
    pooling = params['values']['negotiation_pooling'] if pooling is None else pooling
    if not math.isfinite(pooling) or pooling < 0:
        raise ValueError('pooling')
    validate(rows, len(prior.weights), label)
    levels = sorted(set(k for r in rows for k in keys(r)))
    x = np.array([[float(k in keys(r)) for k in levels] + r['features'] for r in rows])
    y = np.array([r[label] for r in rows])
    center = np.array([prior.terms.get(k, 0) for k in levels] + prior.weights)
    def objective(w):
        z = x @ w
        delta = w - center
        return (np.logaddexp(0, z) - y * z).sum() + pooling * np.dot(delta, delta) / 2
    def gradient(w):
        return x.T @ (expit(x @ w) - y) + pooling * (w - center)
    guards = [bounds(v, params) for v in center]
    result = minimize(objective, center, jac=gradient, bounds=guards, method='L-BFGS-B')
    if not result.success:
        raise RuntimeError(f'logistic fit failed: {result.message}')
    return Logistic(dict(zip(levels, result.x[:len(levels)].tolist())), result.x[len(levels):].tolist(), params=params, label=label)


def online_update(model, row, days=0):
    validate([row], len(model.weights), model.label)
    validate_params(model.params)
    if not math.isfinite(days) or days < 0:
        raise ValueError('days must be nonnegative')
    priors = model.prior_terms if model.prior_terms is not None else dict(model.terms)
    pw = model.prior_weights if model.prior_weights is not None else list(model.weights)
    p = model.predict(row)
    decay = half_life(days, model.params)
    precision = dict(model.precision)
    def update(name, value, prior, feature):
        # Laplace's diagonal precision accumulates information; each event's influence is capped before the update.
        feature = float(np.clip(feature, -1, 1))
        information = max(1., precision.get(name, 1.) * decay)
        precision[name] = information + p * (1 - p) * feature * feature
        estimate = prior + decay * (value - prior) + (row[model.label] - p) * feature / precision[name]
        lo, hi = bounds(prior, model.params)
        return float(np.clip(estimate, lo, hi))
    terms = {k: update(k, v, priors[k], float(k in keys(row))) for k, v in model.terms.items()}
    weights = [update(f'w:{i}', w, pw[i], row['features'][i]) for i, w in enumerate(model.weights)]
    return Logistic(terms, weights, priors, pw, precision, model.params, model.label)


def log_loss(model, rows, label='accepted'):
    validate(rows, len(model.weights), label)
    return float(np.mean([-r[label] * math.log(model.predict(r)) - (1 - r[label]) * math.log(1 - model.predict(r)) for r in rows]))


def calibration_error(model, rows, label='accepted'):
    validate(rows, len(model.weights), label)
    bins = [[] for _ in range(10)]
    for row in rows:
        p = model.predict(row)
        bins[min(9, int(p * 10))].append((p, row[label]))
    errors = [abs(np.mean([p for p, _ in b]) - np.mean([y for _, y in b])) for b in bins if len(b) >= model.params['values']['negotiation_calibration_n']]
    return float(max(errors)) if errors else math.inf


def nightly(training, held_out, champion, store, scope, at, log=None):
    if scope.get('person') is not None and any(r.get('person') != scope['person'] for r in [*training, *held_out]):
        raise ValueError('outcome outside person scope')
    if not held_out:
        raise ValueError('held-out outcomes required')
    training_ids = {r['outcome_id'] for r in training}
    held_ids = {r['outcome_id'] for r in held_out}
    if training_ids & held_ids:
        raise ValueError('training/held-out overlap')
    if len(training_ids) != len(training) or len(held_ids) != len(held_out):
        raise ValueError('duplicate outcomes')
    if log:
        log.note('negotiation.fit input', training_n=len(training), held_out_n=len(held_out))
    pv = champion.params['values']
    candidate = fit(training, champion)
    q_return = fit(training, Logistic({'global': math.log(pv['negotiation_q_return'] / (1 - pv['negotiation_q_return']))}, [0.] * len(champion.weights), params=champion.params, label='returned'), 'returned')
    loss = log_loss(candidate, held_out)
    if loss >= log_loss(champion, held_out) or calibration_error(candidate, held_out) > pv['negotiation_calibration_error']:
        return {'state': 'kept', 'model': champion, 'q_return': q_return}
    def publish(name, model, score):
        history = store.history(name, scope)
        row = store.propose(complete_row({'name': name, 'scope': scope, 'family': 'model_ref',
                             'value_or_hyperparams': model.payload(), 'prior': champion.payload(),
                             'held_out_score': -score, 'metric': 'negative_log_loss',
                             'n_eff': len(training), 'fitted_on_ids_hash': hashlib.sha256('\n'.join(sorted(training_ids)).encode()).hexdigest()}),
                            max((r['version'] for r in history), default=0))
        return store.promote(name, scope, row['version'], 0, at)
    promoted, reason = publish('P_accept', candidate, loss)
    return_prior = Logistic({'global': math.log(pv['negotiation_q_return'] / (1 - pv['negotiation_q_return']))}, [0.] * len(champion.weights), params=champion.params, label='returned')
    if log_loss(q_return, held_out, 'returned') < log_loss(return_prior, held_out, 'returned') and calibration_error(q_return, held_out, 'returned') <= pv['negotiation_calibration_error']:
        publish('q_return', q_return, log_loss(q_return, held_out, 'returned'))
    if log:
        log.change('param', 'P_accept', 'champion' if promoted else 'challenger', reason=reason)
    return {'state': 'promoted' if promoted else 'kept', 'model': candidate if promoted else champion, 'q_return': q_return}


def half_life(days, params=None):
    params = resolve() if params is None else params
    validate_params(params)
    if not math.isfinite(days) or days < 0:
        raise ValueError('days')
    return math.exp(-math.log(2) * days / params['values']['negotiation_half_life_days'])
