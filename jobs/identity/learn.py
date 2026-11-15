"""Transactional label updates and versioned challenger fitting.

Store contract: rows (param rows), labels (id -> event), blocked_pairs (unordered
comp-id pairs), and transaction() providing atomicity across all three. No live
store is invented here: tests supply the fake until jobs/param owns persistence.
cap_per_person is supplied by the caller, not a guessed product-wide limit.
Training, calibration and held-out rows carry stable item_ids for leakage checks.
"""
from copy import deepcopy
from datetime import datetime
from statistics import NormalDist
from identity.params import use
from hashlib import sha256
import json
import math
import random

from identity.pair import beta_mean, read_param, score_signals
from param.registry import complete_row

POSITIVE = {"confirm", "merge_items"}
NEGATIVE = {"Not it", "Not the same"}


def param_row(name, scope, family, value, prior, version, *, status="champion", ids=(), resolved=None):
    v = use(resolved)["values"]
    return complete_row({"name": name, "scope": dict(scope), "family": family,
            "value_or_hyperparams": deepcopy(value), "prior": deepcopy(prior),
            "version": version, "fitted_on_ids_hash": sha256(json.dumps(sorted(ids)).encode()).hexdigest(),
            "n_eff": len(ids), "metric": "f1" if family == "model_ref" else "beta_mean",
            "held_out_score": None, "guard_lo": v["identity_beta_lo"] if family == "beta" else None,
            "guard_hi": v["identity_beta_hi"] if family == "beta" else None,
            "status": status, "frozen": False, "promoted_at": None})


def _champion(rows, name, scope):
    matches = [r for r in rows if r["name"] == name and r["scope"] == scope and r["status"] == "champion"]
    return max(matches, key=lambda r: r["version"], default=None)


def _next_version(rows, name, scope):
    return 1 + max((r["version"] for r in rows if r["name"] == name and r["scope"] == scope), default=0)


def _prior(field, population, resolved=None):
    return deepcopy(use(resolved)['values'][f'identity_{population}_{field}'])


def apply_label(store, event, *, cap_per_person, scope=None, log=None, resolved=None):
    resolved = use(resolved, store.rows, scope or {"kind": event["kind"]})
    if cap_per_person < 1:
        raise ValueError("cap_per_person must be positive")
    if event["value"] not in POSITIVE | NEGATIVE:
        raise ValueError("unknown identity label")
    if any(v is not None and not isinstance(v, bool) for v in event["fields"].values()):
        raise ValueError("compared field must be boolean or missing")
    scope = dict(scope or {"kind": event["kind"]})
    if scope.get("person", event["person"]) != event["person"] or scope.get("kind") != event["kind"]:
        raise ValueError("label scope mismatch")
    with store.transaction():
        if event["id"] in store.labels:
            return False
        count = sum(e["person"] == event["person"] and e["kind"] == event["kind"] and e["learned"]
                    for e in store.labels.values())
        learned = count < cap_per_person
        store.labels[event["id"]] = {**deepcopy(event), "learned": learned}
        if event["value"] == "Not the same":
            if len(event["comp_ids"]) != 2:
                raise ValueError("Not the same requires two comp ids")
            store.blocked_pairs.add(frozenset(event["comp_ids"]))
        if learned:
            population = "m" if event["value"] in POSITIVE else "u"
            for field, agrees in event["fields"].items():
                if agrees is None:
                    continue
                name = f"identity_{population}_{field}"
                old = _champion(store.rows, name, scope)
                if old and old["frozen"]:
                    continue
                prior = _prior(field, population, resolved)
                value = deepcopy(read_param(store.rows, name, scope, prior))
                before = beta_mean(value, resolved=resolved)
                total = value["alpha"] + value["beta"]
                se = math.sqrt(before * (1 - before) / (total + 1))
                value["alpha" if agrees else "beta"] += 1
                mean = beta_mean(value, resolved=resolved)
                # Preserve concentration while enforcing the spec's mean guard.
                total = value["alpha"] + value["beta"]
                value = {"alpha": mean * total, "beta": (1 - mean) * total}
                row = param_row(name, scope, "beta", value, prior,
                                _next_version(store.rows, name, scope), ids=[event["id"]], resolved=resolved)
                row["n_eff"] = (old["n_eff"] if old else 0) + 1
                if old:
                    old["status"] = "retired"
                store.rows.append(row)
                if log and abs(mean - before) > resolved["values"]["identity_anomaly_se"] * se:
                    log.note("identity.anomaly", name=name, version=row["version"])
        if log:
            log.note("identity.label", learned=learned, field_count=len(event["fields"]))
    return learned


def fit_em(rows, initial, *, iterations=None, tolerance=None, resolved=None):
    """Bernoulli Fellegi-Sunter EM. Labels never enter the E or M steps."""
    resolved = use(resolved)
    v = resolved['values']
    iterations = int(v['identity_em_iterations']) if iterations is None else iterations
    tolerance = v['identity_em_tolerance'] if tolerance is None else tolerance
    fields = sorted({f for r in rows for f, v in r["fields"].items() if v is not None})
    weights = {f: deepcopy(initial.get(f, {p: _prior(f, p, resolved) for p in ("m", "u")})) for f in fields}
    match_prior = v["identity_match_prior"]
    for _ in range(iterations):
        counts = {f: {p: _prior(f, p, resolved) for p in ("m", "u")} for f in fields}
        probabilities = []
        for row in rows:
            odds = math.log(match_prior / (1 - match_prior))
            for field, agrees in row["fields"].items():
                if agrees is None:
                    continue
                m, u = (beta_mean(weights[field][p], resolved=resolved) for p in ("m", "u"))
                odds += math.log(m / u if agrees else (1 - m) / (1 - u))
            # Stable logistic identity; no clipping or tunable saturation threshold.
            e = math.exp(-abs(odds))
            probability = 1 / (1 + e) if odds >= 0 else e / (1 + e)
            probabilities.append(probability)
            for field, agrees in row["fields"].items():
                if agrees is not None:
                    key = "alpha" if agrees else "beta"
                    counts[field]["m"][key] += probability
                    counts[field]["u"][key] += 1 - probability
        change = 0.
        for field in fields:
            for p in ("m", "u"):
                mean = beta_mean(counts[field][p], resolved=resolved)
                change = max(change, abs(mean - beta_mean(weights[field][p], resolved=resolved)))
                n = sum(counts[field][p].values())
                counts[field][p] = {"alpha": mean * n, "beta": (1 - mean) * n}
        weights = counts
        if probabilities:
            match_prior = min(v["identity_beta_hi"], max(v["identity_beta_lo"], sum(probabilities) / len(probabilities)))
        if change < tolerance:
            break
    return weights


def predict(row, model, *, resolved=None):
    return score_signals(row["fields"], row.get("text_sim"), row.get("image_sim"),
                         same_kind=row.get("same_kind", True), same_purpose=row.get("same_purpose", 0),
                         stock_photo=row.get("stock_photo", False), weights=model.get("weights"),
                         thresholds=model.get("thresholds"), resolved=resolved)["label"] == "exact"


def evaluate(rows, model, *, resolved=None):
    outcomes = [(bool(r["match"]), predict(r, model, resolved=resolved)) for r in rows]
    return metrics(outcomes), outcomes


def metrics(outcomes):
    tp = sum(a and b for a, b in outcomes)
    fp = sum(not a and b for a, b in outcomes)
    fn = sum(a and not b for a, b in outcomes)
    precision = tp / (tp + fp) if tp + fp else 0.
    recall = tp / (tp + fn) if tp + fn else 0.
    return {"precision": precision, "recall": recall,
            "f1": 2 * tp / (2 * tp + fp + fn) if 2 * tp + fp + fn else 0.}


def bootstrap_noise(champion, challenger, *, seed=0, resamples=None, resolved=None):
    v = use(resolved)["values"]
    resamples = int(v["identity_bootstrap_resamples"]) if resamples is None else resamples
    if not champion or len(champion) != len(challenger):
        raise ValueError("held-out pairs required for paired bootstrap")
    rng = random.Random(seed)
    delta = metrics(challenger)["f1"] - metrics(champion)["f1"]
    differences = []
    for _ in range(resamples):
        indices = [rng.randrange(len(champion)) for _ in champion]
        sample_delta = metrics([challenger[i] for i in indices])["f1"] - metrics([champion[i] for i in indices])["f1"]
        differences.append(abs(sample_delta - delta))
    return sorted(differences)[math.ceil(v["identity_confidence_level"] * resamples) - 1]


def assert_disjoint(training, heldout):
    def ids(rows):
        result = set()
        for row in rows:
            if not row.get("item_ids"):
                raise ValueError("stable item_ids required for training leak check")
            result.add(row["id"])
            result.update(row["item_ids"])
        return result
    if ids(training) & ids(heldout):
        raise ValueError("training leak: held-out pair or item appeared in training")


def _wilson_lower(successes, n, confidence):
    if not n:
        return 0.
    z, p = NormalDist().inv_cdf((1 + confidence) / 2), successes / n
    return (p + z*z/(2*n) - z*math.sqrt(p*(1-p)/n + z*z/(4*n*n))) / (1+z*z/n)


def calibrate_exact(rows, weights, *, resolved=None):
    resolved = use(resolved)
    scored = [(score_signals(r['fields'], r.get('text_sim'), r.get('image_sim'), weights=weights, resolved=resolved)['score'], r)
              for r in rows if 'match' in r]
    for threshold in sorted({score for score, _ in scored}):
        model = {'weights': weights, 'thresholds': {'identity_t_exact': threshold}}
        accepted = [r for _, r in scored if predict(r, model, resolved=resolved)]
        if _wilson_lower(sum(bool(r['match']) for r in accepted), len(accepted), resolved['values']['identity_confidence_level']) >= resolved['values']['identity_exact_precision']:
            return threshold
    return None


def calibrate_thresholds(rows, weights, *, resolved=None):
    """Fit all label thresholds on the learned W, using training labels only."""
    resolved = use(resolved)
    exact = calibrate_exact(rows, weights, resolved=resolved)
    scored = [(score_signals(r['fields'], r.get('text_sim'), r.get('image_sim'), weights=weights, resolved=resolved)['score'], r)
              for r in rows if 'match' in r]
    choices = sorted({score for score, _ in scored})

    def fitted(target):
        return max(choices, key=lambda t: (metrics([(target(row), score >= t) for score, row in scored])['f1'], t)) if choices else None

    model = fitted(lambda r: bool(r['match']))
    comparable = fitted(lambda r: bool(r['match']) or
                        (r.get('same_kind', True) and r.get('same_purpose', 0) >= resolved['values']['identity_purpose_min']))
    return {'identity_t_exact': exact, 'identity_t_model': model, 'identity_t_comparable': comparable}


def _timestamp(at):
    if at is None:
        raise ValueError('at timestamp must be explicit')
    parsed = datetime.fromisoformat(at.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        raise ValueError('at timestamp must include timezone')
    return at


def nightly_fold(store, kind, training, heldout, *, seed=0, log=None, at=None, resolved=None):
    if not training or not heldout:
        raise ValueError("training and held-out pairs required")
    assert_disjoint(training, heldout)
    if any(r["kind"] != kind for r in list(training) + list(heldout)):
        raise ValueError("fold kind mismatch")
    resolved = use(resolved, store.rows, {"kind": kind})
    scope, name = {"kind": kind}, "identity_weights"
    with store.transaction():
        old = _champion(store.rows, name, scope)
        champion = deepcopy(old["value_or_hyperparams"]) if old else {"weights": None, "thresholds": {}}
        weights = fit_em(training, champion.get("weights") or {}, resolved=resolved)
        challenger = {"weights": weights, "thresholds": calibrate_thresholds(training, weights, resolved=resolved)}
        score, outcomes = evaluate(heldout, challenger, resolved=resolved)
        old_score, old_outcomes = evaluate(heldout, champion, resolved=resolved)
        noise = bootstrap_noise(old_outcomes, outcomes, seed=seed, resolved=resolved)
        row = param_row(name, scope, "model_ref", challenger, champion,
                        _next_version(store.rows, name, scope), status="challenger", ids=[r["id"] for r in training], resolved=resolved)
        row["held_out_score"] = {**score, "champion_f1": old_score["f1"], "bootstrap_noise": noise,
                                 "held_out_ids_hash": sha256(json.dumps(sorted(r["id"] for r in heldout)).encode()).hexdigest()}
        if (not (old and old["frozen"]) and score["precision"] >= resolved["values"]["identity_exact_precision"]
                and score["f1"] - old_score["f1"] > noise):
            if old:
                old["status"] = "retired"
            row["status"] = "champion"
            row["promoted_at"] = _timestamp(at)
        store.rows.append(row)
        if log:
            log.note("identity.param_fold", version=row["version"], status=row["status"], **score)
        return row


def rollback(store, kind, version, *, log=None, at=None):
    _timestamp(at)
    scope, name = {"kind": kind}, "identity_weights"
    with store.transaction():
        target = next((r for r in store.rows if r["name"] == name and r["scope"] == scope and r["version"] == version), None)
        if target is None:
            raise ValueError("unknown rollback version")
        for row in store.rows:
            if row["name"] == name and row["scope"] == scope and row["status"] == "champion":
                row["status"] = "retired"
        target["status"] = "champion"
        target["promoted_at"] = _timestamp(at)
        if log:
            log.note("identity.rollback", version=version)
        return target
