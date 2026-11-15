"""cap-2 tests: the suggestion on the frames fixture (spec/engines/capture.md §9 tests 1 and 7)."""
import collections

import pytest
from capture import suggest as S
from capture.process import FAMILIES


@pytest.fixture
def items(load_fixture):
    return load_fixture("frames/items.json")["items"]


def test_the_fixture_and_the_code_share_the_14_families(load_fixture):
    assert tuple(load_fixture("frames/items.json")["families"]) == FAMILIES and len(FAMILIES) == 14


def test_every_item_gets_its_expected_preselect(items):
    for it in items:
        r = S.suggest(it["class_scores"])
        assert r["preselect"] == it["expected"]["preselect"], it["id"]
        assert sorted(r["order"]) == sorted(FAMILIES) and len(r["shown"]) == 5 and r["shown"] == r["order"][:5]
        assert r["suggested_type"] == r["order"][0]
        assert abs(sum(r["p"].values()) - 1) < 1e-9


def test_confirmed_first_on_27_of_30_and_wrongly_preselected_on_at_most_1(items):
    rs = [(it, S.suggest(it["class_scores"])) for it in items]
    assert sum(r["order"][0] == it["confirmed_family"] for it, r in rs) >= 27
    assert sum(r["preselect"] not in (None, it["confirmed_family"]) for it, r in rs) <= 1


def test_no_preselect_under_the_margin_or_the_floor():
    close = {f: 0.01 for f in FAMILIES} | {"shoes": 0.6, "bags": 0.45}  # lead 0.15
    assert S.suggest(close)["preselect"] is None
    low = {f: 0.6 / 13 for f in FAMILIES} | {"shoes": 0.4}  # lead 0.35 but top 0.4 under the floor
    assert S.suggest(low)["preselect"] is None


def test_auto_only_past_the_auto_bounds():
    base = {f: 0.0 for f in FAMILIES}
    assert S.suggest(base | {"shoes": 0.95, "bags": 0.05})["auto_accept"] is True
    assert S.suggest(base | {"shoes": 0.85, "bags": 0.15})["auto_accept"] is False  # under 0.9
    r = S.suggest(base | {"shoes": 0.92, "bags": 0.08})
    assert r["preselect"] == "shoes" and r["auto_accept"] is True
    # the lead bound alone: a raised auto_margin refuses a 0.9 lead
    assert S.suggest(base | {"shoes": 0.95, "bags": 0.05}, auto_margin=0.95)["auto_accept"] is False
    assert not S.suggest(base | {"shoes": 0.7, "bags": 0.3})["auto_accept"]  # preselected, under 0.9


def test_confirm_mode_is_auto_only_when_arm_auto_and_auto_accept():
    base = {f: 0.0 for f in FAMILIES} | {"shoes": 0.95, "bags": 0.05}
    assert S.suggest(base, arm="auto")["confirm_mode"] == "auto"
    assert S.suggest(base, arm="tap")["confirm_mode"] == "tap"
    assert S.suggest(base)["confirm_mode"] == "tap"
    unsure = {f: 1 / 14 for f in FAMILIES}
    assert S.suggest(unsure, arm="auto")["confirm_mode"] == "tap"


def test_assign_arm_is_stable_and_near_even():
    ids = [f"cap_{i}" for i in range(1000)]
    arms = [S.assign_arm(i) for i in ids]
    assert arms == [S.assign_arm(i) for i in ids]
    n = collections.Counter(arms)
    assert set(n) == {"tap", "auto"} and abs(n["auto"] - 500) <= 60


def test_the_person_prior_moves_a_close_call():
    s = {f: 0.0 for f in FAMILIES} | {"shoes": 0.5, "bags": 0.45, "other": 0.05}
    assert S.suggest(s)["order"][0] == "shoes"
    r = S.suggest(s, person_counts={"bags": 40})
    assert r["order"][0] == "bags"
    assert S.suggest(s, person_counts={})["order"] == S.suggest(s)["order"]


def test_temperature_flattens_and_sharpens():
    s = {f: 0.01 for f in FAMILIES} | {"shoes": 0.6}
    assert S.suggest(s, temperature=2.0)["p"]["shoes"] < S.suggest(s)["p"]["shoes"] < S.suggest(s, temperature=0.5)["p"]["shoes"]


def test_bad_input_fails_loudly():
    with pytest.raises(ValueError):
        S.suggest({"shoes": 1.0, "gadgets": 0.5})
    with pytest.raises(ValueError):
        S.suggest({"shoes": 1.0}, temperature=0)
    with pytest.raises(ValueError):
        S.suggest({f: 0.0 for f in FAMILIES})


def test_suggest_still_has_a_numeric_default_for_a_bound():
    import inspect
    for name in ("floor", "margin", "auto_top", "auto_margin"):
        assert inspect.signature(S.suggest).parameters[name].default is None, name


def test_a_prior_stated_in_two_files_suggestion_uses_process_params():
    import json
    from pathlib import Path
    from param.registry import MemoryStore
    priors = json.loads(Path(S.__file__).with_name("process.json").read_text())["params"]
    store = MemoryStore()
    S.suggest({"shoes": 1}, params=store)
    for name in ("capture_preselect_floor", "assist_preselect_margin", "capture_type_auto_floor", "capture_type_auto_margin"):
        assert store.read(name, {})["value"] == priors[name]


def test_promoted_floor_moves_a_preselect_between_old_and_new_bounds():
    from param.registry import MemoryStore
    store = MemoryStore()
    scores = {"shoes": .6, "bags": .3, "other": .1}
    assert S.suggest(scores, params=store)["preselect"] == "shoes"
    name = "capture_preselect_floor"
    prior = store.read(name, {})["value"]
    row = store.propose(dict(name=name, scope={}, family="scalar", prior=prior, value_or_hyperparams=.7,
                             n_eff=40, fitted_on_ids_hash="floor-fixture", metric="precision", held_out_score=1,
                             guard_lo=0, guard_hi=1), 0)
    assert store.promote(name, {}, row["version"], 0, "2026-11-15T00:00:00Z")[0]
    assert S.suggest(scores, params=store)["preselect"] is None
    assert S.suggest(scores)["preselect"] == "shoes"


@pytest.mark.parametrize("name,value,scores,key,expected", [
    ("assist_preselect_margin", .4, {"shoes": .6, "bags": .3, "other": .1}, "preselect", None),
    ("capture_type_auto_floor", .99, {"shoes": .95, "bags": .05}, "auto_accept", False),
    ("capture_type_auto_margin", .95, {"shoes": .95, "bags": .05}, "auto_accept", False),
])
def test_other_suggestion_bounds_read_promoted_rows(name, value, scores, key, expected):
    from param.registry import MemoryStore
    store = MemoryStore()
    assert S.suggest(scores, params=store)[key] != expected
    prior = store.read(name, {})["value"]
    row = store.propose(dict(name=name, scope={}, family="scalar", prior=prior, value_or_hyperparams=value,
                             n_eff=40, fitted_on_ids_hash="bound-fixture", metric="precision", held_out_score=1,
                             guard_lo=0, guard_hi=1), 0)
    assert store.promote(name, {}, row["version"], 0, "2026-11-15T00:00:00Z")[0]
    assert S.suggest(scores, params=store)[key] == expected
