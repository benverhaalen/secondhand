"""An event's effect on demand, measured, not hand-set (Ben, 2026-11-15 08:09: "this might need some like rdd or something
research to give better reasoning"). Rate ratio of sales per listing-week, the item's group against a control group,
in a narrow window around the date, with placebo dates as the honesty check."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from demand.event_effect import Series, estimate  # noqa: E402


def flat(n, sold, exposure=100.0):
    return [(sold, exposure)] * n


def test_a_doubling_in_the_group_alone_reads_as_about_two():
    # 12 quiet weeks, the event, 4 weeks at twice the rate; the control (other teams' jerseys) stays flat.
    target = Series(flat(12, 20) + flat(4, 40))
    control = Series(flat(16, 30))
    r = estimate(target, control, event_week=12, window=4)
    assert 1.8 < r["effect"] < 2.2
    assert r["lo"] > 1.0
    assert r["verdict"] == "use"


def test_a_season_that_lifts_everyone_is_not_the_event():
    # October lifts every jersey 1.5x; the difference in differences takes it out.
    target = Series(flat(12, 20) + flat(4, 30))
    control = Series(flat(12, 30) + flat(4, 45))
    r = estimate(target, control, event_week=12, window=4)
    assert 0.85 < r["effect"] < 1.15
    assert r["verdict"] != "use"


def test_too_few_sales_abstains():
    target = Series(flat(12, 1) + flat(4, 3))
    control = Series(flat(16, 2))
    assert estimate(target, control, event_week=12, window=4)["verdict"] == "too_thin"


def test_a_jump_no_bigger_than_the_placebo_dates_is_not_used():
    # week-to-week swings as big as the "event" itself: the placebo dates show the same size of jump
    wobble = [(20, 100.0), (40, 100.0)] * 8
    r = estimate(Series(wobble), Series(flat(16, 30)), event_week=12, window=2)
    assert r["verdict"] in ("placebo_as_big", "too_thin", "no_effect")


def test_unlisted_weeks_count_as_unknown_not_as_zero_demand():
    target = Series(flat(10, 20) + [(0, 0.0), (0, 0.0)] + flat(4, 40))
    control = Series(flat(16, 30))
    r = estimate(target, control, event_week=12, window=4)
    assert 1.8 < r["effect"] < 2.2
