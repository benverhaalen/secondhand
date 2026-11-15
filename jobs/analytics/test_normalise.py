"""pa-1 breaks: impressions are not views, blank is not zero, reset, Pacific day, relist, missing field, cross-list once."""
import copy
import json
import pathlib

import pytest

from analytics.normalise import FLAGS, distinct_items, normalise

FX = pathlib.Path(__file__).parent / "fixtures" / "stats"


def reads(site):
    return json.loads((FX / f"{site}.json").read_text())["reads"]


def by_day(rows):
    return {r["day"]: r for r in rows}


def test_flags_are_a_closed_list():
    assert "not_yet_processed" in FLAGS and "counter_reset" in FLAGS
    for site in ("ebay", "poshmark", "depop", "mercari", "facebook"):
        for r in normalise(reads(site)):
            assert set(r["flags"]) <= set(FLAGS)


def test_mercari_views_are_exposure_never_views():
    rows = by_day(normalise(reads("mercari")))
    r = rows["2026-09-02"]
    assert r["stages"]["exposure"] == 120 and r["stages"]["attention"] == 6
    t = r["terms"]["exposure"]
    assert t["site_term"] == "views" and t["definition"] == "impressions"


def test_blank_before_daily_update_is_not_zero():
    r = by_day(normalise(reads("mercari")))["2026-09-03"]
    assert r["stages"]["exposure"] is None and "not_yet_processed" in r["flags"]


def test_counter_reset_drops_the_day_and_resets_baseline():
    rs = reads("poshmark")
    rs[2]["payload"]["impressions"] = 20  # fell from 410
    rs[2]["payload"]["clicks"] = 2
    r = by_day(normalise(rs))["2026-09-03"]
    assert "counter_reset" in r["flags"] and r["stages"]["exposure"] is None
    rs.append(copy.deepcopy(rs[2]))
    rs[3]["read_at"] = "2026-09-04T12:00:00Z"
    rs[3]["payload"]["impressions"] = 50
    assert by_day(normalise(rs))["2026-09-04"]["stages"]["exposure"] == 30


def test_first_read_of_old_listing_is_left_truncated():
    r = by_day(normalise(reads("poshmark")))
    assert "left_truncated" in r["2026-09-01"]["flags"] and r["2026-09-01"]["stages"]["exposure"] is None
    assert r["2026-09-02"]["stages"]["exposure"] == 110
    assert {"definition_undocumented", "harness_read"} <= set(r["2026-09-02"]["flags"])


def test_ebay_day_is_pacific_with_its_utc_window():
    r = by_day(normalise(reads("ebay")))["2026-09-02"]
    assert r["window_utc"] == ("2026-09-02T07:00:00Z", "2026-09-03T07:00:00Z")
    assert "timezone" in r["flags"] and "not_in_view_possible" in r["flags"]
    assert r["stages"]["exposure"] == 120 and r["stages"]["attention"] == 9
    # a UTC site keeps the UTC day
    assert by_day(normalise(reads("mercari")))["2026-09-01"]["window_utc"][0] == "2026-09-01T00:00:00Z"


def test_relist_starts_a_new_baseline_and_counts_one_item():
    rs = reads("poshmark")
    relist = copy.deepcopy(rs[1:])
    for x in relist:
        x["listing_id"] = "ls_p1b"
        x["payload"]["impressions"] -= 400
        x["payload"]["clicks"] -= 30
    rows = normalise(rs + relist)
    assert not any("counter_reset" in r["flags"] for r in rows)
    assert len({r["listing_id"] for r in rows}) == 2 and distinct_items(rows) == 1


def test_missing_field_is_flagged_not_zero():
    rs = reads("ebay")
    del rs[1]["payload"]["metrics"]["watchers"]
    r = by_day(normalise(rs))["2026-09-02"]
    assert r["stages"]["interest"] is None and "not_reported" in r["flags"]


def test_cross_listed_item_counted_once():
    rows = normalise(reads("ebay") + reads("mercari") + reads("depop"))
    assert len({r["site"] for r in rows}) == 3
    assert distinct_items(rows, same_item={"item_a": "x", "item_d": "x", "item_c": "x"}) == 1


def test_depop_boosted_and_facebook_self_reported():
    d = by_day(normalise(reads("depop")))
    assert d["2026-09-03"]["boosted"] and "boosted" in d["2026-09-03"]["flags"]
    assert d["2026-09-03"]["stages"]["exposure"] == 40 + 200 and not d["2026-09-02"]["boosted"]
    f = by_day(normalise(reads("facebook")))
    assert "self_reported" in f["2026-09-02"]["flags"] and f["2026-09-03"]["stages"]["outcome"] == 1


def test_unknown_site_is_refused():
    with pytest.raises(ValueError):
        normalise([{"site": "etsy", "listing_id": "x", "item_id": "y", "posted_at": "2026-09-01T00:00:00Z", "read_at": "2026-09-01T00:00:00Z", "route": "api", "payload": {}}])
