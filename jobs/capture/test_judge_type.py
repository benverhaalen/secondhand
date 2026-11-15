"""cap-3 tests: the type check (spec/engines/capture.md §3 step 3, §9 test 3)."""
import pytest
from capture import judge_type as J
from capture.process import FAMILIES, process_for


def scores(top, p_top, **rest):
    s = {f: (1 - p_top) / 13 for f in FAMILIES}
    s[top] = p_top
    return s | rest


PHOTOS = [{"id": "p1", "role": "front"}, {"id": "p2", "role": "back"}]


def test_every_fixture_item_swaps_or_not_as_expected(load_fixture):
    # the judge's stand-in on the fixture: it sees the confirmed family at 0.95
    for it in load_fixture("frames/items.json")["items"]:
        pick = it["expected"]["user_pick"]
        r = J.judge(pick, scores(it["confirmed_family"], 0.95), PHOTOS)
        assert (r["action"] == "swap") == it["expected"]["swap"], it["id"]
        assert r["type"] == (it["confirmed_family"] if it["expected"]["swap"] else pick)
        if not it["expected"]["swap"]:
            assert r["action"] == "keep"


def test_a_right_pick_never_swaps():
    for f in FAMILIES:
        assert J.judge(f, scores(f, 0.97), PHOTOS)["action"] == "keep"


def test_swap_keeps_every_photo_and_asks_only_the_new_types_missing_frames():
    r = J.judge("apparel", scores("bags", 0.95), PHOTOS, has_lidar=True)
    assert r["action"] == "swap" and r["type"] == "bags"
    assert r["photos"] == ["p1", "p2"]
    assert [s["step"] for s in r["missing_shot"]] == [s["step"] for s in process_for("bags", True)]  # no spin, no inside yet
    have = PHOTOS + [{"id": "p3", "role": "spin"}]
    r = J.judge("apparel", scores("bags", 0.95), have)
    assert [s["role"] for s in r["missing_shot"]] == ["inside"] and r["photos"] == ["p1", "p2", "p3"]


def test_the_missing_frames_follow_the_phone_without_lidar():
    r = J.judge("apparel", scores("bags", 0.95), PHOTOS, has_lidar=False)
    assert r["missing_shot"][0]["step"] == "ring" and r["missing_shot"][0]["needs_lidar"] is False


def test_between_the_bounds_lists_the_two_families_highest_first():
    s = scores("bags", 0.6, shoes=0.3)  # another family high but under 0.9, picked in between
    r = J.judge("apparel", s, PHOTOS)
    assert r["action"] == "category_unsure" and r["candidates"] == ["bags", "shoes"]
    assert r["type"] == "apparel" and r["photos"] == ["p1", "p2"]
    s = scores("bags", 0.95) | {"apparel": 0.3}  # other over 0.9, picked over 0.1: not a swap
    r = J.judge("apparel", s, PHOTOS)
    assert r["action"] == "category_unsure" and r["candidates"] == ["bags", "apparel"]


def test_bounds_are_inclusive_at_the_edge():
    s = {f: 0.0 for f in FAMILIES} | {"bags": 0.9, "apparel": 0.09, "shoes": 0.01}
    assert J.judge("apparel", s, PHOTOS)["action"] == "swap"


def test_swap_bound_never_under_0_8():
    with pytest.raises(ValueError):
        J.judge("apparel", scores("bags", 0.95), PHOTOS, swap_hi=0.79)
    assert J.judge("apparel", scores("bags", 0.85), PHOTOS, swap_hi=0.8)["action"] == "swap"


def test_unknown_family_is_refused():
    with pytest.raises(ValueError):
        J.judge("gadgets", scores("bags", 0.95), PHOTOS)
