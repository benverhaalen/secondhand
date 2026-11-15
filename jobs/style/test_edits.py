"""rs-2: edit, remove, return and reset on a person's profile state."""
from datetime import datetime, timedelta

from style.edits import PersonState, edit, fold, remove, reset
from style.facets import Event

NOW = datetime(2026, 11, 14)


def saves(n, start_days_ago, brand="Arcteryx", prefix="s"):
    return [Event(f"{prefix}{i}", "a", "save", NOW - timedelta(days=start_days_ago - i * 2), {"brand": brand}) for i in range(n)]


def brand(facets, value="Arcteryx"):
    return next((f for f in facets if f["name"] == "brand" and f["value"] == value), None)


def test_reset_clears_facets_passed_cache_and_bar_and_returns_to_prior():
    s = PersonState("a")
    fold(s, saves(4, 20), NOW)
    s.passed["listing1"] = 12
    s.seen.add("imp1")
    s.shelf = [{"id": "x"}]
    s.alert_bar = 1.7
    assert brand(s.facets)
    reset(s, NOW)
    assert (s.facets, s.passed, s.seen, s.shelf, s.alert_bar, s.edits) == ([], {}, set(), None, None, {})
    fold(s, saves(4, 20), NOW + timedelta(days=1))  # old events stay behind the reset
    assert s.facets == []
    fold(s, saves(4, 20, prefix="n") + [Event(f"late{i}", "a", "save", NOW + timedelta(days=2 + i * 2), {"brand": "Arcteryx"}) for i in range(3)], NOW + timedelta(days=9))
    assert brand(s.facets)  # only events after the reset count


def test_pinned_weight_survives_a_fold():
    s = PersonState("a")
    edit(s, "brand", "Arcteryx", weight=0.9)
    fold(s, saves(6, 20), NOW)
    f = brand(s.facets)
    assert f["weight"] == 0.9 and f["pinned"] and f["from"] == "edited"
    fold(s, saves(12, 30), NOW)
    assert brand(s.facets)["weight"] == 0.9


def test_edit_without_weight_keeps_current_weight_and_pins_it():
    s = PersonState("a")
    fold(s, saves(4, 20), NOW)
    w = brand(s.facets)["weight"]
    edit(s, "brand", "Arcteryx")
    fold(s, saves(12, 30), NOW)
    assert brand(s.facets)["weight"] == w and brand(s.facets)["pinned"]


def test_removed_facet_blends_only_new_events_and_says_why():
    s = PersonState("a")
    old = saves(4, 40)
    fold(s, old, NOW - timedelta(days=12))
    remove(s, "brand", "Arcteryx", NOW - timedelta(days=10))
    new2 = [Event(f"n{i}", "a", "save", NOW - timedelta(days=8 - i * 3), {"brand": "Arcteryx"}) for i in range(2)]
    fold(s, old + new2, NOW)
    assert brand(s.facets)["count"] == 2  # old events never count after remove
    weight2 = brand(s.facets)["weight"]
    new3 = new2 + [Event("n2", "a", "save", NOW - timedelta(days=1), {"brand": "Arcteryx"})]
    fold(s, old + new3, NOW)
    f = brand(s.facets)
    assert f and f["count"] == 3 and f["weight"] > weight2
    d = NOW - timedelta(days=10)
    assert f["back_because"] == f"back because you saved 3 since {d.day} {d:%b}"


def test_remove_again_after_return_is_one_tap():
    s = PersonState("a")
    fold(s, saves(4, 20), NOW)
    remove(s, "brand", "Arcteryx", NOW)
    fold(s, saves(4, 20), NOW)
    assert brand(s.facets) is None


def test_fold_and_reset_log_state_changes(log_lines):
    log, lines = log_lines
    s = PersonState("a")
    reset(s, NOW, log=log)
    changes = [l for l in lines if l["event"] == "state.change"]
    assert len(changes) == 1 and changes[0]["entity"] == "style_profile" and changes[0]["to"] == "reset"
