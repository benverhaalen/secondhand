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

THRESHOLDS = {"identity_t_exact": .85, "identity_t_model": .70,
              "identity_t_comparable": .50}
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
    return frozenset(re.findall(r"\w+", str(value).casefold()))


def text_similarity(left, right):
    a, b = tokens(left), tokens(right)
    return len(a & b) / len(a | b) if a or b else 0.0


def compare_fields(left, right):
    fields = {}
    for name in FIELDS:
        a, b = left.get(name), right.get(name)
        fields[name] = None if a in (None, "") or b in (None, "") else tokens(a) == tokens(b)
    return fields


def beta_mean(value):
    a, b = value["a"], value["b"]
    if a <= 0 or b <= 0:
        raise ValueError("Beta counts must be positive")
    return min(.98, max(.02, a / (a + b)))


def score_signals(fields, text_sim, image_sim, *, same_kind=True,
                  same_purpose=0.0, stock_photo=False, params=(), scope=None,
                  weights=None, thresholds=None):
    scope = scope or {}
    for value in (text_sim, image_sim, same_purpose):
        if value is not None and (not math.isfinite(value) or not 0 <= value <= 1):
            raise ValueError("similarity must be finite and in [0, 1]")
    t = {name: read_param(params, name, scope, prior) for name, prior in THRESHOLDS.items()}
    if thresholds:
        t.update(thresholds)
    observed = [v for k, v in fields.items() if v is not None and k not in {"text_sim", "image_sim"}]
    field_agree = sum(observed) / len(observed) if observed else 0.0
    if weights is None:
        score = .30 * field_agree + .50 * (text_sim or 0) + .20 * (image_sim or 0)
    else:
        score = 0.0
        for name, agrees in fields.items():
            if agrees is None or name not in weights:
                continue
            m, u = (beta_mean(weights[name][key]) for key in ("m", "u"))
            score += math.log2(m / u if agrees else (1 - m) / (1 - u))
    anchor = (fields.get("gtin") is True or fields.get("mpn") is True or
              (fields.get("model") is True and fields.get("variant") is True))
    if fields.get("brand") is True and fields.get("model") is True and fields.get("variant") is False:
        label = "same_family_other_variant"
    elif t["identity_t_exact"] is not None and score >= t["identity_t_exact"] and anchor and not stock_photo:
        label = "exact"
    elif score >= t["identity_t_model"]:
        label = "likely_same_model"
    elif same_kind and same_purpose >= t["identity_t_comparable"]:
        label = "comparable"
    else:
        label = "unresolved"
    return {"score": score, "label": label, "fields": dict(fields)}


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
    if log:
        log.note("identity.pair", label=result["label"], score=result["score"], field_count=len(fields))
    return result
