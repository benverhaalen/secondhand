"""The fake store is the only store here; rows match param/row.json exactly."""
from contextlib import contextmanager
from copy import deepcopy
import json
from pathlib import Path
import pytest
from identity.learn import apply_label, nightly_fold, rollback, param_row, fit_em, evaluate, bootstrap_noise
from identity.pair import read_param


class FakeStore:
    def __init__(self):
        self.rows, self.labels, self.blocked_pairs = [], {}, set()

    @contextmanager
    def transaction(self):
        snapshot = deepcopy((self.rows, self.labels, self.blocked_pairs))
        try:
            yield self
        except Exception:
            self.rows, self.labels, self.blocked_pairs = snapshot
            raise


def label(id="lb_1", person="me", **changes):
    return {"id": id, "person": person, "kind": "apparel", "value": "Not the same",
            "comp_ids": ["cmp_a", "cmp_b"], "fields": {"brand": True, "model": False}, **changes}


def pair(id, positive, agrees=None):
    return {"id": id, "item_ids": [id + "alpha", id + "beta"], "match": positive,
            "kind": "apparel", "fields": {"mpn": positive if agrees is None else agrees},
            "text_sim": 1.0 if positive else 0.0, "image_sim": 1.0 if positive else 0.0}


def heldout():
    return [pair("held_" + str(i), i < 100) for i in range(200)]


def training():
    return [pair("train_" + str(i), i < 100) for i in range(200)]


def test_not_the_same_updates_beta_in_the_event_and_deduplicates():
    store = FakeStore()
    assert apply_label(store, label(), cap_per_person=5)
    assert read_param(store.rows, "identity_u_brand", {"kind": "apparel"}, None) == {"alpha": 2., "beta": 9.}
    assert read_param(store.rows, "identity_u_model", {"kind": "apparel"}, None) == {"alpha": 1., "beta": 10.}
    assert frozenset(("cmp_a", "cmp_b")) in store.blocked_pairs
    assert not apply_label(store, label(), cap_per_person=5)
    assert len(store.rows) == 2


def test_poisoned_taps_are_capped_per_person_not_globally():
    store = FakeStore()
    for i in range(20):
        apply_label(store, label(str(i)), cap_per_person=3)
    row = read_param(store.rows, "identity_u_brand", {"kind": "apparel"}, None)
    assert row == {"alpha": 4., "beta": 9.}
    assert apply_label(store, label("other", "other"), cap_per_person=3)
    assert read_param(store.rows, "identity_u_brand", {"kind": "apparel"}, None)["alpha"] == 5


def test_param_rows_have_exact_registry_shape():
    store = FakeStore()
    apply_label(store, label(), cap_per_person=3)
    template = json.loads((Path(__file__).resolve().parents[2] / "app/src/engines/param/row.json").read_text())
    assert all(set(row) == set(template) for row in store.rows)


def test_person_scope_falls_back_to_shared_never_other_person():
    store = FakeStore()
    store.rows.append(param_row("x", {"kind": "bags", "person": "other"}, "scalar", .1, .85, 1))
    assert read_param(store.rows, "x", {"kind": "bags", "person": "me"}, .85) == .85
    store.rows.append(param_row("x", {"kind": "bags"}, "scalar", .8, .85, 1))
    assert read_param(store.rows, "x", {"kind": "bags", "person": "me"}, .85) == .8


def test_worse_fold_stays_challenger_and_rollback_restores_version():
    store = FakeStore()
    prior = {"weights": None, "thresholds": {"identity_t_exact": .85}}
    store.rows.append(param_row("identity_weights", {"kind": "apparel"}, "model_ref", prior, prior, 1))
    challenger = nightly_fold(store, "apparel", training(), heldout(), seed=9, at="2026-11-15T00:00:00Z")
    assert challenger["status"] == "challenger"  # champion is already perfect; ties do not promote
    assert challenger["held_out_score"]["f1"] <= 1
    assert read_param(store.rows, "identity_weights", {"kind": "apparel"}, None) == prior
    # Simulate an earlier promotion, then use the public rollback operation.
    store.rows[0]["status"] = "retired"
    challenger["status"] = "champion"
    rollback(store, "apparel", 1, at="2026-11-15T00:00:00Z")
    assert store.rows[0]["status"] == "champion"
    assert challenger["status"] == "retired"


def test_held_out_win_promotes_and_records_score():
    store = FakeStore()
    bad = {"weights": None, "thresholds": {"identity_t_exact": 2}}
    store.rows.append(param_row("identity_weights", {"kind": "apparel"}, "model_ref", bad, bad, 1))
    challenger = nightly_fold(store, "apparel", training(), heldout(), seed=7, at="2026-11-15T00:00:00Z")
    assert challenger["status"] == "champion"
    assert challenger["held_out_score"]["precision"] >= .95
    assert challenger["held_out_score"]["f1"] > 0
    assert store.rows[0]["status"] == "retired"


def test_training_leak_by_entity_even_with_different_pair_id_fails():
    leaked = pair("different_pair", True)
    leaked["item_ids"] = training()[0]["item_ids"]
    with pytest.raises(ValueError, match="training leak"):
        nightly_fold(FakeStore(), "apparel", training(), [leaked])


def test_em_ignores_training_labels_and_retains_probability_guards():
    rows = training()
    a = fit_em(rows, {})
    b = fit_em([{**r, "match": not r["match"]} for r in rows], {})
    assert a == b
    for field in a.values():
        for beta in field.values():
            mean = beta["alpha"] / (beta["alpha"] + beta["beta"])
            assert .02 <= mean <= .98


def test_frozen_beta_row_does_not_move_and_move_raises_anomaly(log_lines):
    log, lines = log_lines
    store = FakeStore()
    row = param_row("identity_u_brand", {"kind": "apparel"}, "beta", {"alpha": 1., "beta": 9.}, {"alpha": 1., "beta": 9.}, 1)
    row["frozen"] = True
    store.rows.append(row)
    apply_label(store, label(), cap_per_person=3, log=log)
    assert row["value_or_hyperparams"] == {"alpha": 1., "beta": 9.}
    assert any(line["event"] == "note" for line in lines)


def test_transaction_failure_leaves_no_partial_label():
    store = FakeStore()
    with pytest.raises(ValueError, match="field"):
        apply_label(store, label(fields={"brand": "not a boolean"}), cap_per_person=3)
    assert store.labels == {} and store.rows == [] and not store.blocked_pairs
