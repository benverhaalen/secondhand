"""ph-6: photo learning promotes on held-out only, rolls back a worse model, keeps the prior with no data."""
import random

import pytest

from capture.learn import DAY
from param.registry import MemoryStore
from photo.learn import BETA_GUARD, fold_beta, fold_gain, observe, weight_guard

NOW = 1_800_000_000.0


def _renders(n, rise, seed=1, days=90, recent_rise=None):
    rng = random.Random(seed)
    out = []
    for _ in range(n):
        age = rng.random() * days
        r = recent_rise if (recent_rise is not None and age < 30) else rise
        out.append({"t": NOW - age * DAY, "passed": rng.random() < 0.7, "rise": max(0.0, rng.gauss(r, 0.01))})
    return out


def test_no_data_prior():
    s = MemoryStore()
    r = fold_gain(s, 1, "coat", "cover", [], NOW, "t1")
    assert r["status"] == "prior" and r["value"] == pytest.approx(0.05)


def test_promote_on_held_out_gain():
    s = MemoryStore()
    r = fold_gain(s, 1, "coat", "cover", _renders(300, 0.12), NOW, "t1")
    assert r["status"] == "promoted" and r["value"] == pytest.approx(0.12, abs=0.01)


def test_not_promote_on_train():
    s = MemoryStore()
    r = fold_gain(s, 1, "coat", "cover", _renders(300, 0.15, recent_rise=0.05), NOW, "t1")
    assert r["status"] == "kept" and r["value"] == pytest.approx(0.05)


def test_worse_model_rollback():
    s = MemoryStore()
    fold_gain(s, 1, "coat", "cover", _renders(300, 0.12), NOW, "t1")
    back = s.rollback("photo.gain.l1.cover", {"kind": "coat"}, at="t2")
    assert back["value_or_hyperparams"] == pytest.approx(0.05)


def test_beta_stays_in_0_to_3():
    s = MemoryStore()
    rng = random.Random(2)
    items = [{"t": NOW - rng.random() * 90 * DAY, "score_gap": 0.1, "price_gap": 0.9} for _ in range(100)]
    r = fold_beta(s, "coat", items, NOW, "t1")
    assert BETA_GUARD[0] <= r["value"] <= BETA_GUARD[1]


def test_weights_never_negative_and_within_half():
    assert weight_guard("exposure") == (10.0, 30.0)
    assert all(lo >= 0 for lo, _ in map(weight_guard, ["fill", "clipping"]))


def test_pass_and_accept_rates_are_beta_updates():
    r = observe({}, {"kind": "gate", "route": "level1", "item_kind": "coat", "passed": False})
    r = observe(r, {"kind": "studio_approve", "route": "level1", "item_kind": "coat", "choice": "use_real"})
    assert r["pass"][("level1", "coat")] == (2.0, 3.0) and r["accept"][("level1", "coat")] == (2.0, 3.0)
