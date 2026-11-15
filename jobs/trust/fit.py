"""Nightly trust calibration fit (spec/engines/trust.md §4 calibration, §7 fit).

Input: resolved threads as (z, y): z = b + s, the score on the logit scale; y = 1 if the seller marked it a scam.
A fit writes a challenger `trust_calib` row (family model_ref) with its HELD-OUT score and is promoted only when it beats the
champion by more than the noise (jobs/param/registry.py). It never promotes on train. Rows are scoped: a person's fit
(scope has `person`) is written under that person and read by no one else.
Platt below SWITCH_N resolved threads, isotonic at or above it.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

from trust.params import resolve, value, prior_read
SWITCH_N = resolve()['values']['trust_isotonic_n']
NAME = "trust_calib"
URI = "jobs/trust/fit.py"


def _sig(z: float) -> float:
    if not math.isfinite(z):
        raise ValueError('z')
    return 1.0 / (1.0 + math.exp(-max(-50.0, min(50.0, z))))  # Fixed sigmoid contract: clip before exp in both twins.


def split(rows: list[tuple[float, int]], values=None) -> tuple[list[tuple[float, int]], list[tuple[float, int]]]:
    """Deterministic: every 4th resolved thread is held out. The fit never sees it."""
    validate_rows(rows)
    every = value(values if values is not None else resolve()['values'], 'trust_holdout_every')
    if int(every) != every or every < 2: raise ValueError('trust_holdout_every')
    train = [r for i, r in enumerate(rows) if i % every != every - 1]
    held = [r for i, r in enumerate(rows) if i % every == every - 1]
    return train, held


def platt(rows: list[tuple[float, int]], values=None, weights=None) -> dict:
    """sigmoid(a z + b) by Newton steps with a light ridge toward a=1, b=0 so a tiny group stays tame."""
    validate_rows(rows)
    if not rows: raise ValueError('training labels required')
    params = values if values is not None else resolve()['values']
    weights = sample_weights(rows, weights)
    a, b, lam = 1.0, 0.0, value(params, 'trust_fit_ridge')
    for _ in range(int(value(params, 'trust_fit_steps'))):
        ga = gb = haa = hab = hbb = 0.0
        for (z, y), wt in zip(rows,weights):
            p = _sig(a * z + b)
            w = wt * p * (1 - p)
            ga += wt * (p - y) * z; gb += wt * (p - y)
            haa += w * z * z; hab += w * z; hbb += w
        ga += lam * (a - 1.0); haa += lam; hbb += lam
        det = haa * hbb - hab * hab
        if abs(det) < value(params, 'trust_fit_det_min'):
            break
        da, db = (hbb * ga - hab * gb) / det, (haa * gb - hab * ga) / det
        a -= da; b -= db
        if abs(da) + abs(db) < value(params, 'trust_fit_tolerance'):
            break
    return {"kind": "platt", "a": a, "b": b}


def isotonic(rows: list[tuple[float, int]], weights=None) -> dict:
    """Pool-adjacent-violators on the sorted scores: knots xs (left edge of each block) and non-decreasing ys."""
    validate_rows(rows)
    if not rows: raise ValueError('training labels required')
    grouped = {}
    for (z, y), wt in zip(rows,sample_weights(rows,weights)):
        if not wt: continue
        sy, n = grouped.get(z, (0., 0))
        grouped[z] = (sy + wt*y, n + wt)
    pts = sorted((z, sy, n) for z, (sy, n) in grouped.items())
    blocks: list[list[float]] = []  # [sum_y, count, left_x]
    for z, sy, n in pts:
        blocks.append([sy, n, z])
        while len(blocks) > 1 and blocks[-2][0] / blocks[-2][1] > blocks[-1][0] / blocks[-1][1]:
            s, c, _ = blocks.pop()
            blocks[-1][0] += s; blocks[-1][1] += c
    return {"kind": "isotonic", "xs": [bl[2] for bl in blocks], "ys": [bl[0] / bl[1] for bl in blocks]}


def sample_weights(rows, weights=None):
    if weights is None: return [1.]*len(rows)
    if len(weights) != len(rows) or any(not math.isfinite(w) or w < 0 for w in weights): raise ValueError('label weights')
    if not sum(weights): raise ValueError('held-out/training support required')
    return weights


def split_weights(weights, values):
    every = value(values,'trust_holdout_every')
    return ([w for i,w in enumerate(weights) if i % every != every-1],
            [w for i,w in enumerate(weights) if i % every == every-1])


def validate_rows(rows):
    if any(not math.isfinite(z) or y not in (0, 1) for z, y in rows):
        raise ValueError('finite z and binary label required')


def predict(cal: dict, z: float) -> float:
    if not math.isfinite(z): raise ValueError('z')
    if cal.get('kind') == 'none': return _sig(z)
    if cal.get('kind') == 'platt':
        if any(k not in cal or not math.isfinite(cal[k]) for k in ('a', 'b')):
            raise ValueError('platt coefficients')
        return _sig(cal['a'] * z + cal['b'])
    xs, ys = cal.get('xs', []), cal.get('ys', [])
    if cal.get('kind') != 'isotonic' or not xs or len(xs) != len(ys):
        raise ValueError('isotonic knots')
    if (any(not math.isfinite(x) for x in xs) or any(not math.isfinite(y) or not 0 <= y <= 1 for y in ys)
        or any(a > b for a,b in zip(xs, xs[1:])) or any(a > b for a,b in zip(ys, ys[1:]))):
        raise ValueError('isotonic knots')
    y = ys[0]
    for x, v in zip(xs, ys):
        if x <= z: y = v
    return y


def brier(cal: dict, rows: list[tuple[float, int]], weights=None) -> float:
    validate_rows(rows)
    if not rows: raise ValueError('held-out labels required')
    weights = sample_weights(rows,weights)
    return sum(w*(predict(cal,z)-y)**2 for (z,y),w in zip(rows,weights))/sum(weights)


def ece(cal: dict, rows: list[tuple[float, int]], bins: int | None = None, weights=None) -> float:
    validate_rows(rows)
    if bins is None: bins = int(resolve()['values']['trust_ece_bins'])
    if bins < 1: raise ValueError('bins')
    if not rows: raise ValueError('held-out labels required')
    out = [[0.0, 0.0, 0] for _ in range(bins)]
    weights = sample_weights(rows,weights)
    for (z, y), wt in zip(rows,weights):
        p = predict(cal, z)
        k = min(bins - 1, int(p * bins))
        out[k][0] += wt*p; out[k][1] += wt*y; out[k][2] += wt
    return sum(abs(sp - sy) for sp, sy, n in out if n) / sum(weights)


@dataclass
class FitResult:
    kind: str
    version: int
    held_out_score: float   # negative Brier on held-out threads only (higher is better)
    promoted: bool
    why: str


def fit(store, rows: list[tuple[float, int]], at: str, person: str | None = None, site: str | None = None, noise: float = 0.0, read=prior_read, basis_ids=None, score_model_version=0, scope=None, weights=None) -> FitResult:
    scope = {**(scope or {}), **{k: v for k, v in (("site", site), ("person", person)) if v is not None}}
    resolved = resolve(read, scope)
    values = resolved['values']
    weights = sample_weights(rows,weights)
    supported = [i for i,w in enumerate(weights) if w > 0]
    if basis_ids is not None: basis_ids = [basis_ids[i] for i in supported]
    rows, weights = [rows[i] for i in supported], [weights[i] for i in supported]
    train, held = split(rows, values)
    train_w, held_w = split_weights(weights,values)
    if not train or not held: raise ValueError('training and held-out labels required')
    cal = platt(train, values,train_w) if len(rows) < value(values, 'trust_isotonic_n') else isotonic(train,train_w)
    score = -brier(cal, held, held_w)  # scored on held-out, never on train
    payload = {"uri": URI, "version": 0, **cal, "n": len(rows), "positives": sum(y for _, y in rows), "ece": ece(cal, held, int(value(values, "trust_ece_bins")),held_w), "param_versions": resolved["versions"]}
    if basis_ids is not None:
        if len(basis_ids) != len(rows) or len(set(basis_ids)) != len(basis_ids): raise ValueError('basis_ids')
        payload['basis_ids'] = sorted(basis_ids)
    payload['score_model_version'] = score_model_version
    latest = max((r["version"] for r in store.history(NAME, scope)), default=0)
    payload["version"] = latest + 1
    ch = store.propose({"name": NAME, "scope": scope, "family": "model_ref", "value_or_hyperparams": payload, "prior": None,
                        "fitted_on_ids_hash": None, "n_eff": len(rows), "metric": "neg_brier_heldout", "held_out_score": score,
                        "guard_lo": None, "guard_hi": None}, latest)
    ok, why = store.promote(NAME, scope, ch["version"], noise, at)
    return FitResult(cal["kind"], ch["version"], score, ok, why)


def watch(store, live: list[tuple[float, int]], at: str, person: str | None = None, site: str | None = None, tol: float | None = None) -> bool:
    """Rollback: the champion scored on fresh threads. If it is worse than the score it was promoted on by more than tol, restore the
    previous promoted version. Returns True when it rolled back."""
    scope = {k: v for k, v in (("site", site), ("person", person)) if v is not None}
    if tol is None: tol = resolve()['values']['trust_watch_tolerance']
    cur = store.champion(NAME, scope)
    if cur is None or not live:
        return False
    v = cur["value_or_hyperparams"]
    cal = {k: v[k] for k in ("kind", "a", "b", "xs", "ys") if k in v}
    if -brier(cal, live) < cur["held_out_score"] - tol:
        try:
            store.rollback(NAME, scope, at)
        except ValueError:
            return False
        return True
    return False


def _write(store, name, scope, family, payload, score, n, at, prior=None, promote=False, noise=0, metric='neg_decision_cost_share_heldout'):
    latest = max((r['version'] for r in store.history(name, scope)), default=0)
    row = store.propose(dict(name=name, scope=scope, family=family, value_or_hyperparams=payload,
        prior=prior, fitted_on_ids_hash=None, n_eff=n, metric=metric, held_out_score=score,
        guard_lo=None, guard_hi=None), latest)
    ok = store.promote(name, scope, row['version'], noise, at)[0] if promote else False
    return row['version'], ok


def fit_signals(store, rows, at, prior_weights, *, scope=None, read=prior_read, name='trust_weights'):
    """Weighted L2 logistic challenger; time holdout and paired decision-cost switch.

    Each row names its subject_id, resolved_at, signals, binary value and label weight.
    Hard predicates are not predictors or actions here, so the fold cannot alter hard rules.
    """
    from datetime import datetime
    import random
    scope = scope or {}
    resolved = resolve(read, scope)
    p = resolved['values']
    now = datetime.fromisoformat(at.replace('Z','+00:00'))
    train, held = [], []
    ids = set()
    for row in sorted(rows, key=lambda r:(r['resolved_at'],r['subject_id'])):
        age = (now-datetime.fromisoformat(row['resolved_at'].replace('Z','+00:00'))).total_seconds()/86400  # Fixed seconds per day.
        if row['subject_id'] in ids: raise ValueError('duplicate subject_id')
        ids.add(row['subject_id'])
        if age < 0 or row['value'] not in (0,1) or not math.isfinite(row['weight']) or row['weight'] < 0:
            raise ValueError('resolved label')
        if any(not math.isfinite(v) or v < 0 for v in row['signals'].values()): raise ValueError('signals')
        weighted = dict(row, decay_weight=row['weight'] * .5 ** (age/value(p,'trust_half_life_days')))
        (held if age <= value(p,'trust_holdout_days') else train).append(weighted)
    if not train or not held or not sum(r['decay_weight'] for r in train) or not sum(r['decay_weight'] for r in held):
        raise ValueError('training and held-out labels required')
    names = sorted(prior_weights)
    weights = dict(prior_weights)
    b = value(p,'trust_b')
    ridge = 1/value(p,'trust_prior_sd')**2
    for _ in range(int(value(p,'trust_fit_steps'))):
        max_step = 0.
        for key in [None]+names:
            grad = hess = 0.
            for r in train:
                x = 1. if key is None else r['signals'].get(key,0.)
                prob = _sig(b+sum(weights[k]*r['signals'].get(k,0.) for k in names))
                w = r['decay_weight']
                grad += w*(prob-r['value'])*x
                hess += w*prob*(1-prob)*x*x
            prior = value(p,'trust_b') if key is None else prior_weights[key]
            old = b if key is None else weights[key]
            step = (grad+ridge*(old-prior))/(hess+ridge)
            new = old-step
            if key is not None:
                pos = sum(r['decay_weight'] for r in train if r['signals'].get(key,0) and r['value'])
                neg = sum(r['decay_weight'] for r in train if r['signals'].get(key,0) and not r['value'])
                if min(pos,neg) < value(p,'trust_weight_support'):
                    band = abs(prior)*value(p,'trust_weight_band')
                    new = max(prior-band,min(prior+band,new))
                if prior*new < 0 and pos+neg < value(p,'trust_weight_reverse_support'): new = 0.
                weights[key] = new
            else: b = new
            max_step = max(max_step,abs(new-old))
        if max_step < value(p,'trust_fit_tolerance'): break
    champion = store.champion(name,scope)
    old = champion['value_or_hyperparams'] if champion else dict(weights=prior_weights,b=value(p,'trust_b'))
    def evaluate(model,r):
        from trust.money import cents, half_up
        loss = max(cents(r.get('loss_cents',value(p,'trust_loss_min_cents')),'loss_cents'),cents(value(p,'trust_loss_min_cents'),'trust_loss_min_cents'))
        friction = half_up(cents(value(p,'trust_c_tap_cents'),'trust_c_tap_cents')+value(p,'trust_delta')*loss)
        prob = _sig(model['b']+sum(model['weights'][k]*r['signals'].get(k,0.) for k in names))
        ask = prob*loss*(1-value(p,'trust_m_ask')) >= (1-prob)*friction
        cost = r['value']*loss*(value(p,'trust_m_ask') if ask else 1)+(1-r['value'])*friction*ask
        return cost, ask
    model = dict(weights=weights,b=b,uri=URI,param_versions=resolved['versions'])
    gains = [(evaluate(old,r)[0]-evaluate(model,r)[0])*r['decay_weight'] for r in held]
    rng = random.Random(value(p,'trust_fit_seed'))
    draws = sorted(sum(gains[rng.randrange(len(gains))] for _ in gains)/len(gains) for _ in range(int(value(p,'trust_bootstrap_n'))))
    lower = draws[int(value(p,'trust_bootstrap_tail')*(len(draws)-1))]
    positive_weight = sum(r['weight']*r['value'] for r in held)
    def recall(m):
        return sum(r['weight']*r['value']*evaluate(m,r)[1] for r in held)/positive_weight if positive_weight else 0
    allowed = positive_weight >= value(p,'trust_switch_positive_weight') and lower > 0 and recall(model) >= recall(old)
    loss_basis = sum(max(r.get('loss_cents',value(p,'trust_loss_min_cents')),value(p,'trust_loss_min_cents'))*r['decay_weight'] for r in held)
    score = -sum(evaluate(model,r)[0]*r['decay_weight'] for r in held)/loss_basis
    version, promoted = _write(store,name,scope,'model_ref',model,score,len(rows),at,promote=allowed)
    return dict(weights=weights,b=b,version=version,promoted=promoted,train_ids=[r['subject_id'] for r in train],held_ids=[r['subject_id'] for r in held],train_weight=sum(r['decay_weight'] for r in train),held_positive_weight=positive_weight,bootstrap_gain_lower_share=lower*len(held)/loss_basis)


def fit_thresholds(store, rows, at, *, scope=None, read=prior_read):
    """Highest predicate threshold meeting the specified recall on labelled/seeded examples."""
    scope = scope or {}
    p = resolve(read,scope)['values']
    grouped = {}
    for row in rows:
        c = row['confidence']
        if not math.isfinite(c) or not 0 <= c <= 1 or row['value'] not in (0,1): raise ValueError('predicate label')
        grouped.setdefault(row['signal'],[]).append(row)
    out = {}
    for signal, examples in sorted(grouped.items()):
        positives = sorted(r['confidence'] for r in examples if r['value'])
        if not positives: raise ValueError('positive predicate labels required')
        threshold = positives[0]
        for candidate in positives:
            if sum(c >= candidate for c in positives)/len(positives) >= value(p,'trust_predicate_recall'): threshold = candidate
        recall = sum(c >= threshold for c in positives)/len(positives)
        prior = value(p,'trust_predicate_code_start' if signal == 'asks_code' else 'trust_predicate_start')
        name = f'trust_thr.{signal}'
        current = store.champion(name,scope)
        noise = 0.
        allowed = current is None
        if current:
            previous = current['value_or_hyperparams']
            old_recall = sum(c >= previous for c in positives)/len(positives)
            old_fp = sum(r['confidence'] >= previous and not r['value'] for r in examples)
            new_fp = sum(r['confidence'] >= threshold and not r['value'] for r in examples)
            allowed = old_recall < value(p,'trust_predicate_recall') or (recall >= old_recall and new_fp < old_fp)
            # Compare on today's examples; rebase the registry's stored historical score only after this gate.
            noise = math.nextafter(recall-current['held_out_score'], -math.inf)
        version, promoted = _write(store,name,scope,'scalar',threshold,recall,len(examples),at,prior=prior,promote=allowed,noise=noise,metric='predicate_recall')
        out[signal] = dict(threshold=threshold,recall=recall,version=version,promoted=promoted)
    return out


def fold(store, labels, predicates, at, prior_weights, *, scope=None, read=prior_read):
    """One nightly entry point: scoped weight challenger, champion calibration, predicate thresholds."""
    scope = scope or {}
    weights = fit_signals(store, labels, at, prior_weights, scope=scope, read=read)
    current = store.champion('trust_weights',scope)
    model = current['value_or_hyperparams'] if current else dict(weights=prior_weights,b=value(resolve(read,scope)['values'],'trust_b'))
    by_id = {r['subject_id']: r for r in labels}
    basis = [by_id[i] for i in weights['held_ids']]
    scores = [(model['b']+sum(w*r['signals'].get(k,0) for k,w in model['weights'].items()),r['value']) for r in basis]
    calibration = fit(store,scores,at,person=scope.get('person'),site=scope.get('site'),read=read,
        basis_ids=weights['held_ids'],score_model_version=current['version'] if current else 0,scope=scope,weights=[r['weight'] for r in basis])
    thresholds = fit_thresholds(store,predicates,at,scope=scope,read=read)
    return dict(weights=weights,calibration=calibration,thresholds=thresholds)
