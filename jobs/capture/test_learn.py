"""cap-6: capture learning, fold, promote, rollback (§9 test 8)."""
import random

import pytest

from capture.learn import (DAY, PRIORS, fit_swap_hi, fold, observe, seconds_guard, swap_loss)
from param.registry import MemoryStore

NOW = 1_800_000_000.0
NAME, SCOPE = "capture.swap_hi", {"kind": "apparel"}
PRIOR, LO, HI = PRIORS[NAME]


def _items(n, true_th, seed=1, days=90):
    rng = random.Random(seed)
    out = []
    for k in range(n):
        p = rng.random()
        out.append({"t": NOW - rng.random() * days * DAY, "p_other": p, "wrong_pick": p >= true_th})
    return out


def _fold(store, items, at="t1"):
    return fold(store, NAME, SCOPE, PRIOR, (LO, HI), items, NOW, fit_swap_hi, swap_loss, at)


def test_no_data_keeps_the_prior():
    s = MemoryStore()
    r = _fold(s, [])
    assert r["status"] == "prior" and r["value"] == PRIOR
    assert s.champion(NAME, SCOPE)["n_eff"] == 0


def test_planted_shift_promotes_only_past_30_items():
    s = MemoryStore()
    assert _fold(s, _items(29, 0.82))["status"] == "prior"
    r = _fold(s, _items(400, 0.82))
    assert r["status"] == "promoted" and abs(r["value"] - 0.82) <= 0.02


def test_promote_on_held_out_only_not_train():
    # train says 0.82, the last 30 days say the prior was right: the challenger must lose on held-out
    s = MemoryStore()
    rng = random.Random(3)
    items = []
    for _ in range(400):
        p, recent = rng.random(), rng.random() < 0.4
        t = NOW - (rng.random() * 29 if recent else 31 + rng.random() * 60) * DAY
        items.append({"t": t, "p_other": p, "wrong_pick": p >= (0.9 if recent else 0.82)})
    r = _fold(s, items)
    assert r["status"] == "kept" and r["value"] == PRIOR


def test_worse_model_rollback_restores_the_prior():
    s = MemoryStore()
    _fold(s, _items(400, 0.82))
    assert s.champion(NAME, SCOPE)["value_or_hyperparams"] != PRIOR
    back = s.rollback(NAME, SCOPE, at="t2")
    assert back["value_or_hyperparams"] == PRIOR and s.champion(NAME, SCOPE)["version"] == 1


def test_guard_band_swap_bound_never_under_0_8():
    s = MemoryStore()
    r = _fold(s, _items(400, 0.5))
    assert r["value"] >= 0.8


def test_seconds_guard_is_50_percent():
    assert seconds_guard(8) == (4.0, 12.0)


def test_follow_up_cap_never_learned_past_3():
    assert PRIORS["capture.follow_up_cap"] == (3, 3, 3)


def test_confirm_modes_never_pooled():
    st = {}
    st = observe(st, {"kind": "type_confirmed", "confirm_mode": "tap", "suggested": "apparel", "confirmed": "apparel"})
    st = observe(st, {"kind": "type_confirmed", "confirm_mode": "auto", "suggested": "apparel", "confirmed": "apparel"})
    assert st["confusion"] == {("tap", "apparel", "apparel"): 1, ("auto", "apparel", "apparel"): 1}


def test_view_fill_is_a_beta_update_from_2_2():
    st = observe({}, {"kind": "view_result", "row_id": "req_apparel_size_label", "view": "tag", "filled": True})
    assert st["view_fills"][("req_apparel_size_label", "tag")] == (3.0, 2.0)


def test_unknown_event_fails():
    with pytest.raises(ValueError):
        observe({}, {"kind": "mystery"})
