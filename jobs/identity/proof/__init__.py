"""Fixed synthetic regression evaluator; real-item validation remains external.

Run: python -m pytest jobs/identity/test_proof.py
Capture coverage checks recorded rung outputs, not id-2's retrieval implementation.
Lot identification checks recorded piece predictions, not a live vision model.
"""
from collections import Counter
import json
import math
from pathlib import Path
from time import perf_counter
from identity.cluster import cluster_comps
from identity.learn import assert_disjoint, evaluate
from identity.lots import lot_card, single_product_comps
from identity.pair import score_signals


def load_fixed_set():
    base = Path(__file__).parent
    return (json.loads((base / "held_out.json").read_text(encoding="utf-8")),
            json.loads((base / "training.json").read_text(encoding="utf-8")))


def validate_leaks(training, fixed):
    observations = []
    for collection in ("captures", "pairs", "cross_posts", "near_misses", "lots"):
        observations.extend(fixed[collection])
    assert_disjoint(training, observations)


def assert_bars(report):
    assert report["capture_coverage"] >= .90, "capture coverage below 90%"
    assert report["capture_singletons"] >= .50, "capture singleton share below half"
    assert report["precision"] >= .95, "exact precision below .95"
    assert report["recall"] >= .90, "exact recall below .90"
    assert report["cross_posts_joined"] >= 85, "true cross-post recall below 85/100"
    assert report["near_misses_merged"] <= 2, "stock-photo false merges exceed 2/100"
    assert report["pieces_identified"] >= .80, "lot piece identification below 80%"
    assert report["lot_prices_in_single_ranges"] == 0, "lot priced as one item"
    if report["p95_ms"] is not None:
        assert report["p95_ms"] < 100, "50-pair p95 exceeds 100 ms"


def prove(fixed, training, *, blocked_pairs=(), measure_speed=True):
    validate_leaks(training, fixed)
    covered = singletons = 0
    for row in fixed["captures"]:
        scores = {}
        for rung in row["rungs"]:
            candidate = rung["product_id"]
            score = (1., .8, .5, .3)[rung["rung"] - 1] * rung["similarity"]
            scores[candidate] = max(scores.get(candidate, 0), score)
        candidates = {p for p, score in scores.items() if score >= row["q_kind"]}
        covered += row["true_product_id"] in candidates
        singletons += len(candidates) == 1
    metrics, _ = evaluate(fixed["pairs"], {"weights": None, "thresholds": {}})
    joined = sum(len(cluster_comps(row["comps"], blocked_pairs=blocked_pairs)) == 1 for row in fixed["cross_posts"])
    merged = sum(len(cluster_comps(row["comps"], retail_phashes=row.get("retail_phashes", ()),
                                   blocked_pairs=blocked_pairs)) == 1 for row in fixed["near_misses"])
    identified = total = leaked_prices = 0
    for row in fixed["lots"]:
        card = lot_card(row["comp"], identified_parts=row["identified_parts"])
        truth, prediction = Counter(row["true_parts"]), Counter(card["lot_parts"])
        identified += sum((truth & prediction).values())
        total += sum(truth.values())
        leaked_prices += len(single_product_comps([card]))
    timings = []
    if measure_speed:
        batch = fixed["pairs"][:50]
        for _ in range(31):
            start = perf_counter()
            for r in batch:
                score_signals(r["fields"], r["text_sim"], r["image_sim"])
            timings.append((perf_counter() - start) * 1000)
        timings = timings[1:]
    return {**metrics, "capture_coverage": covered / len(fixed["captures"]),
            "capture_singletons": singletons / len(fixed["captures"]),
            "cross_posts_joined": joined, "near_misses_merged": merged,
            "pieces_identified": identified / total, "lot_prices_in_single_ranges": leaked_prices,
            "p95_ms": sorted(timings)[math.ceil(.95 * len(timings)) - 1] if timings else None}
