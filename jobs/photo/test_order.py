"""ph-2: order and truncation per site."""
from photo import order


def ph(pid, role="detail", score=50, use="real", **kw):
    return {"photo_id": pid, "role": role, "score": score, "use": use, "version_id": f"v-{pid}", "cover_ok": True, **kw}


def ids(plan):
    return [s["photo_id"] for s in plan["slots"]]


def fit(cap):
    return {"platforms": {"s": {"photos": {"max": cap}}, "ebay": {"photos": {"max": cap}}}}


def test_site_limit_4_keeps_best_4_with_cover_first():
    photos = [ph("f", "front", 70)] + [ph(f"d{i}", score=10 * i) for i in range(1, 7)]
    p = order.plan("s", photos, fit(4))
    assert ids(p) == ["f", "d6", "d5", "d4"]
    assert p["slots"][0]["reason"] == "cover_true_color"
    assert {"photo_id": "d1", "reason": "over_cap"} in p["dropped"]


def test_several_real_fronts_higher_score_is_cover():
    p = order.plan("s", [ph("a", "front", 40), ph("b", "front", 80)], fit(8))
    assert ids(p)[0] == "b"


def test_no_front_hero_chosen_and_never_a_protected_role():
    p = order.plan("s", [ph("t", "tag", 99), ph("d", "detail", 60), ph("e", "detail", 70)], fit(8))
    assert p["slots"][0] == {"photo_id": "e", "version_id": "v-e", "slot": 1, "reason": "hero_chosen"}


def test_ebay_cover_ok_false_is_not_the_cover():
    photos = [ph("f", "front", 90, cover_ok=False), ph("g", "front", 50)]
    assert ids(order.plan("ebay", photos, fit(8)))[0] == "g"
    assert ids(order.plan("s", photos, fit(8)))[0] == "f"  # only ebay gates it


def test_major_flaws_survive_the_cap_and_minors_go_to_text():
    photos = [ph("f", "front", 70), ph("t", "tag", 5), ph("M1", "flaw", 1, severity="major"),
              ph("M2", "flaw", 1, severity="major"), ph("m1", "flaw", 90, severity="minor"), ph("d", score=99)]
    p = order.plan("s", photos, fit(4))
    assert set(ids(p)) == {"f", "t", "M1", "M2"}
    assert p["flaw_in_text"] == ["m1"]


def test_improved_front_appears_twice_other_improved_replaces_original():
    photos = [ph("f", "front", 70), ph("f2", "front", 70, use="improved", improved_of="f"),
              ph("b", "back", 50), ph("b2", "back", 55, use="improved", improved_of="b")]
    p = order.plan("s", photos, fit(8))
    assert ids(p) == ["f", "f2", "b2"]


def test_cap_drops_improved_non_front_before_coverage_but_keeps_improved_front():
    photos = [ph("f", "front", 70), ph("f2", "front", 70, use="improved", improved_of="f"),
              ph("t", "tag", 5), ph("d", "detail", 60, use="improved", improved_of="x")]
    p = order.plan("s", photos, fit(3))
    assert ids(p) == ["f", "f2", "t"]


def test_depop_cap_8_read_from_platform_fit():
    photos = [ph("f", "front", 99)] + [ph(f"d{i}", score=i) for i in range(12)]
    assert len(order.plan("depop", photos)["slots"]) == 8


def test_slots_numbered_from_one():
    p = order.plan("s", [ph("f", "front"), ph("d")], fit(8))
    assert [s["slot"] for s in p["slots"]] == [1, 2]


def test_majors_past_a_hard_cap_go_to_the_flaw_list_cover_and_tag_stay():
    fit = {"platforms": {"x": {"photos": {"max": 3}}}}
    photos = [{"photo_id": "f", "role": "front", "score": 80, "use": "real", "version_id": "v", "cover_ok": True},
              {"photo_id": "t", "role": "tag", "score": 70, "use": "real", "version_id": "v", "cover_ok": True}]
    photos += [{"photo_id": f"m{i}", "role": "flaw", "severity": "major", "score": 50 + i, "use": "real",
                "version_id": "v", "cover_ok": True} for i in range(3)]
    plan = order.plan("x", photos, fit)
    ids = [s["photo_id"] for s in plan["slots"]]
    assert len(ids) == 3 and ids[0] == "f" and "t" in ids
    assert len(plan["flaw_in_text"]) == 2
