"""Identity operating design (spec/engines/identity.md sections 3--5).

Reads: normalized comp/product facts, cached text/image similarities, scoped
champion param rows, and previously extracted lot parts. No network or model
call belongs in this arithmetic path. The caller blocks by code or kind and
retrieves at most 50 neighbours, then scores those independent pairs in parallel
with other ingest work. Fifty small comparisons are cheaper as one local batch
than as fifty remote tasks. Return the score, match label and contributing fields.

Capture's four retrieval rungs fan out upstream with their own deadlines. A fast
decision model routes kind specialists and selects a clarification slot upstream;
a language/vision model reads titles, labels and lot pieces once, caching extracted
facts by comp fingerprint and extractor version. Neither model decides an exact
join here. Rules apply M1 until learned m/u weights exist, then sum log2 evidence;
thresholds are read in the same score space as their champion weights. Raw learned
W is deliberately returned, not silently passed through an uncalibrated sigmoid.

Ingest: compare -> label -> cluster. Cluster uses non-stock photo distance plus
price/date, or seller hash plus text. Collapse once, retaining every site price.
Offer grouping and lot parsing run independently; lots stay out of single-product
ranges. An explicit pair rejection must survive transitive cluster edges.

Tap: in the caller's transaction, deduplicate label, block a rejected comp pair,
cap that person's training contribution, and update the appropriate Beta rows.
Nightly: disjoint training pairs -> EM -> training-only threshold calibration ->
challenger -> fixed held-out evaluation and seeded 1,000-resample paired bootstrap.
Promote only a significant F1 win with exact precision >= .95; keep versions for
atomic rollback. Person reads try that person, then the identical shared scope,
then the prior; never enumerate another person's values as a fallback.

Likely failures and named tests: stock imagery (identical_stock_photos), missing
thresholds (threshold_param_missing), transitive rejoin (blocked_pair), lot prices
(lot_of_three), size splits (size_variants), poisoning (poisoned_taps), regression
(worse_fold), tenant leakage (person_scope), and training leakage (training_leak).
Proof: python -m pytest jobs/identity. The bundled synthetic regression set is
explicitly not the real-item field validation requested by section 9.
"""

import math
import re
from identity.codes import gtin14
from identity.params import use
from identity.citation import citation
from identity.validation import unit

FIELDS = ("brand", "model", "variant", "gtin", "mpn", "size", "colour")


def read_param(rows, name, scope, prior):
    scopes = [dict(scope)]
    if "person" in scope:
        scopes.append({k: v for k, v in scope.items() if k != "person"})
    for candidate in scopes:
        matches = [r for r in rows if r["name"] == name
                   and r["scope"] == candidate and r["status"] == "champion"]
        if matches:
            return max(matches, key=lambda r: r["version"])["value_or_hyperparams"]
    return prior


def tokens(value):
    return frozenset(re.findall(r"[a-z0-9_]+", str(value).lower()))


def text_similarity(left, right):
    a, b = tokens(left), tokens(right)
    return len(a & b) / len(a | b) if a or b else 0.0


def compare_fields(left, right):
    fields = {}
    for name in FIELDS:
        a, b = left.get(name), right.get(name)
        if name == "gtin":
            ga, gb = gtin14(a), gtin14(b)
            fields[name] = None if a in (None, "") or b in (None, "") else bool(ga and gb and ga == gb)
        else:
            fields[name] = None if a in (None, "") or b in (None, "") else tokens(a) == tokens(b)
    return fields


def beta_mean(value, *, resolved=None):
    v = use(resolved)['values']
    a, b = value["alpha"], value["beta"]
    if any(isinstance(x, bool) or not isinstance(x, (int, float)) or not math.isfinite(x) or x <= 0 for x in (a, b)):
        raise ValueError("Beta counts must be finite and positive")
    # Normalize before adding: finite hyperparameters can otherwise overflow their sum.
    scale = max(a, b)
    mean = a / (a + b) if math.isfinite(a + b) else (a / scale) / (a / scale + b / scale)
    return min(v['identity_beta_hi'], max(v['identity_beta_lo'], mean))


def score_signals(fields, text_sim, image_sim, *, same_kind=True,
                  same_purpose=0.0, stock_photo=False, params=(), scope=None,
                  weights=None, thresholds=None, resolved=None):
    scope = scope or {}
    resolved = use(resolved, params, scope)
    v = resolved['values']
    for value in (text_sim, image_sim, same_purpose):
        if value is not None:
            unit(value, 'similarity')
    if any(x is not None and not isinstance(x, bool) for x in fields.values()):
        raise ValueError('compared fields must be boolean or missing')
    prefix = 'identity_t_' if weights is None else 'identity_w_t_'
    t = {'identity_t_' + k: v[prefix + k] for k in ('exact', 'model', 'comparable')}
    if thresholds is not None:
        t.update(thresholds)
    for name, value in t.items():
        if value is not None and (isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value)):
            raise ValueError(name + ' must be finite')
    observed = [v for k, v in fields.items() if v is not None and k not in {"text_sim", "image_sim"}]
    field_agree = sum(observed) / len(observed) if observed else 0.0
    if weights is None:
        score = v['identity_field_weight'] * field_agree + v['identity_text_weight'] * (text_sim or 0) + v['identity_image_weight'] * (image_sim or 0)
    else:
        score = 0.0
        for name, agrees in fields.items():
            if agrees is None:
                continue
            if name not in weights:
                raise KeyError("missing learned weight " + name)
            m, u = (beta_mean(weights[name][key], resolved=resolved) for key in ("m", "u"))
            score += math.log2(m / u if agrees else (1 - m) / (1 - u))
    anchor = (fields.get("gtin") is True or fields.get("mpn") is True or
              (fields.get("model") is True and fields.get("variant") is True))
    if fields.get("brand") is True and fields.get("model") is True and fields.get("variant") is False:
        label = "same_family_other_variant"
    elif t["identity_t_exact"] is not None and score >= t["identity_t_exact"] and anchor and not stock_photo:
        label = "exact"
    elif t["identity_t_model"] is not None and score >= t["identity_t_model"]:
        label = "likely_same_model"
    elif (same_kind and t["identity_t_comparable"] is not None
          and (same_purpose if weights is None else score) >= t["identity_t_comparable"]
          and (weights is None or same_purpose >= v['identity_purpose_min'])):
        label = "comparable"
    else:
        label = "unresolved"
    # Confidence is evidence support, not a calibrated identity probability.
    # IEEE binary64 exponent limit; this only prevents overflow, never changes a label.
    confidence = min(1., max(0., score)) if weights is None else 1 / (1 + 2 ** (-max(-1022, min(1022, score))))
    return {"score": score, "label": label, "fields": dict(fields),
            "basis_level": "prior" if weights is None else "learned", "rung": "prior" if weights is None else "learned",
            "confidence": confidence, "confidence_kind": "evidence_support",
            "citation": citation('identity_match', {'fields': fields, 'text_sim': text_sim, 'image_sim': image_sim,
                                                   'weights': weights, 'thresholds': t, 'same_kind': same_kind,
                                                   'same_purpose': same_purpose, 'stock_photo': stock_photo}, resolved)}


def score_pair(left, right, *, text_sim=None, image_sim=None, log=None, **options):
    fields = compare_fields(left, right)
    text_sim = text_similarity(left.get("title", ""), right.get("title", "")) if text_sim is None else text_sim
    # Bins are extracted upstream using a versioned bin boundary; no invented cutoff.
    for name in ("text_sim", "image_sim"):
        key = name + "_bin"
        if key in left and key in right:
            fields[name] = left[key] == right[key]
    options.setdefault("same_kind", left.get("kind") is not None and left.get("kind") == right.get("kind"))
    options.setdefault("stock_photo", bool(left.get("stock_photo") or right.get("stock_photo")))
    result = score_signals(fields, text_sim, image_sim, **options)
    result['invalid_gtin_count'] = sum(row.get('gtin') not in (None, '') and gtin14(row['gtin']) is None for row in (left, right))
    if log:
        log.note("identity.pair", invalid_gtin_count=result['invalid_gtin_count'], label=result["label"], score=result["score"], field_count=len(fields))
    return result
