"""Section 9 regression bars; synthetic provenance is not a real-item claim."""
from copy import deepcopy
import json
from pathlib import Path
import pytest
from identity.proof import load_fixed_set, prove, assert_bars, validate_leaks
from identity.learn import apply_label
from identity.test_learn import FakeStore


def test_first_fixture_is_the_worked_example():
    fixture = json.loads((Path(__file__).parent / "proof/00_worked_example.json").read_text())
    from identity.pair import score_pair
    from identity.cluster import cluster_comps
    assert score_pair(fixture["comp"], fixture["product"], text_sim=.72, image_sim=.88)["label"] == "likely_same_model"
    assert len(cluster_comps(fixture["cross_posts"])) == 1


def test_fixed_set_sizes_and_provenance():
    fixed, training = load_fixed_set()
    assert fixed["provenance"]["type"] == "synthetic_regression"
    assert len(fixed["captures"]) == 500
    assert len(fixed["pairs"]) == 1200
    assert {kind: sum(p["kind"] == kind for p in fixed["pairs"]) for kind in fixed["kinds"]} == {kind: 200 for kind in fixed["kinds"]}
    assert len(fixed["cross_posts"]) == len(fixed["near_misses"]) == 100
    assert len(fixed["lots"]) == 50
    validate_leaks(training, fixed)


def test_training_leak_fails_even_for_relabelled_pair_id():
    fixed, training = load_fixed_set()
    leaked = deepcopy(training)
    leaked[0]["item_ids"][0] = fixed["pairs"][0]["item_ids"][0]
    with pytest.raises(ValueError, match="training leak"):
        validate_leaks(leaked, fixed)


def test_section_nine_numbers_on_fixed_regression_set():
    fixed, training = load_fixed_set()
    report = prove(fixed, training)
    assert_bars(report)


def test_precision_drop_fails_instead_of_passing_on_recall():
    fixed, training = load_fixed_set()
    report = prove(fixed, training, measure_speed=False)
    report["precision"] = .949
    with pytest.raises(AssertionError, match="exact precision"):
        assert_bars(report)


def test_fifty_not_the_same_taps_lower_merges_without_precision_loss():
    fixed, training = load_fixed_set()
    before = prove(fixed, training, measure_speed=False)
    store = FakeStore()
    for i, row in enumerate(fixed["near_misses"][:50]):
        a, b = row["comps"]
        apply_label(store, {"id": f"lb_replay_{i}", "person": f"person_{i}", "kind": "apparel",
                           "value": "Not the same", "comp_ids": [a["id"], b["id"]],
                           "fields": {"brand": True, "model": True}}, cap_per_person=5)
    after = prove(fixed, training, blocked_pairs=store.blocked_pairs, measure_speed=False)
    assert after["near_misses_merged"] < before["near_misses_merged"]
    assert after["precision"] == before["precision"]
