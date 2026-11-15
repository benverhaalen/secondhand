"""cap-1: every capture type has its steps as data (spec/engines/capture.md §3 step 2, §9 test 2)."""
import pytest

from capture import process as P

FAMILIES = ["apparel", "shoes", "bags", "jewellery_watches", "furniture", "lighting_home", "electronics",
            "appliances_tools", "media", "cards_collectibles", "toys_lego", "bikes_sports", "baby_gear", "other"]


def test_every_family_has_a_process():
    for f in FAMILIES:
        steps = P.process_for(f, has_lidar=True)
        assert steps, f
        for s in steps:
            assert set(s) == {"step", "kind", "role", "needs_lidar", "seconds"}, (f, s)


def test_apparel_is_front_back_tag():
    assert [s["step"] for s in P.process_for("apparel", has_lidar=True)] == ["front", "back", "tag"]


def test_unknown_type_gets_generic_process():
    assert P.process_for("spaceship", has_lidar=True) == P.process_for("other", has_lidar=True)
    assert P.process_for(None, has_lidar=False) == P.process_for("other", has_lidar=False)


def test_no_lidar_every_scan_becomes_8_still_ring():
    for f in FAMILIES:
        for s in P.process_for(f, has_lidar=False, rigid=True):
            assert s["kind"] != "scan" and not s["needs_lidar"], (f, s)
    shoes = P.process_for("shoes", has_lidar=False)
    assert shoes[0] == {"step": "ring", "kind": "series", "role": "side", "needs_lidar": False, "seconds": 30,
                        "frames": 8, "measured_to": "lookup"}
    assert [s["step"] for s in shoes[1:]] == ["size_label", "soles"]


def test_no_lidar_ring_shape():
    ring = P.process_for("furniture", has_lidar=False)[0]
    assert ring["step"] == "ring" and ring["kind"] == "series" and ring["frames"] == 8
    assert ring["measured_to"] == "lookup" and ring["needs_lidar"] is False


def test_other_and_toys_branch_on_rigid():
    assert [s["step"] for s in P.process_for("other", True, rigid=False)] == ["front", "back"]
    assert [s["step"] for s in P.process_for("other", True, rigid=True)] == ["front", "scan"]
    assert [s["step"] for s in P.process_for("toys_lego", True, rigid=True)] == ["scan"]
    assert [s["step"] for s in P.process_for("toys_lego", True, rigid=False)] == ["box_or_set_front"]


def test_kind_override_for_phones():
    steps = P.process_for("electronics", True, kind="phones_laptops")
    assert [s["role"] for s in steps] == ["screenshot", "front", "back"]
    assert P.process_for("electronics", True, kind="headphones") == P.process_for("electronics", True)


def test_step_missing_field_fails():
    step = {"step": "front", "kind": "instant", "role": "front", "seconds": 5}
    bad = {"version": 1, "no_lidar": {}, "types": {f: [step] for f in FAMILIES}}
    with pytest.raises(ValueError, match="needs_lidar"):
        P.validate(bad)


def test_bad_kind_or_role_fails():
    step = {"step": "x", "kind": "video", "role": "front", "needs_lidar": False, "seconds": 1}
    with pytest.raises(ValueError, match="kind"):
        P.validate({"version": 1, "no_lidar": {}, "types": {f: [step] for f in FAMILIES}})
    step = dict(step, kind="instant", role="selfie")
    with pytest.raises(ValueError, match="role"):
        P.validate({"version": 1, "no_lidar": {}, "types": {f: [step] for f in FAMILIES}})


def test_table_missing_a_family_fails():
    good = P.load()
    good = {**good, "types": {k: v for k, v in good["types"].items() if k != "media"}}
    with pytest.raises(ValueError, match="media"):
        P.validate(good)


def test_returned_steps_are_copies():
    a = P.process_for("apparel", True)
    a[0]["role"] = "flaw"
    assert P.process_for("apparel", True)[0]["role"] == "front"
