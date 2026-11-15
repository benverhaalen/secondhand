"""dt-1: weekly counts and the Gamma velocity (spec/engines/demand-and-trend.md §3 steps 1-2)."""
from demand.velocity import Week, cap_engagement, velocity, weekly_counts

PRIOR = {"a": 2.0, "b": 2.0}  # kind's pooled rate 1/week held at 2 weeks of weight


def weeks(counts):
    return [Week(sold=n, exposure=1.0) for n in counts]


def test_one_sale_gives_a_wide_interval():
    one = velocity(weeks([1]), PRIOR)
    many = velocity(weeks([1] * 26), PRIOR)
    assert one.p10 < one.mean < one.p90
    # forgetting caps the effective sample near 11 weeks, so 26 weeks narrow it by about 2x, not more
    assert (one.p90 - one.p10) > 1.5 * (many.p90 - many.p10)


def test_gap_weeks_are_censored_not_zero_demand():
    # weeks with no exposure (not listed, not observed) carry no information
    seen = velocity(weeks([3, 3, 3, 3]), PRIOR)
    gappy = velocity(weeks([3, 3]) + [Week(sold=0, exposure=0.0)] * 6 + weeks([3, 3]), PRIOR)
    zeros = velocity(weeks([3, 3, 0, 0, 0, 0, 0, 0, 3, 3]), PRIOR)
    assert abs(gappy.mean - seen.mean) < 0.35
    assert zeros.mean < gappy.mean - 0.5


def test_eight_week_old_data_counts_half():
    v = velocity(weeks([4] + [0] * 8), {"a": 1e-9, "b": 1e-9})
    old = velocity(weeks([4]), {"a": 1e-9, "b": 1e-9})
    # the 4 sold nine weeks back weigh 0.5^(8/8)=half of a fresh week, against 8 fresher empty weeks
    assert v.a < old.a and abs(v.a / old.a - 0.5) < 1e-6


def test_a_capped_read_is_a_lower_bound():
    v = velocity(weeks([3, 3]) + [Week(sold=240, exposure=1.0, capped=True)], PRIOR)
    assert v.lower_bound and not velocity(weeks([3, 3]), PRIOR).lower_bound


def test_zero_live_listings_and_an_adapter_down_are_censored():
    # no listing live (exposure 0) for two weeks is not two weeks of zero demand
    assert velocity(weeks([4, 4]) + [Week(sold=0, exposure=0.0)] * 2, PRIOR).mean > velocity(weeks([4, 4, 0, 0]), PRIOR).mean


def test_no_history_is_the_prior():
    v = velocity([], PRIOR)
    assert v.a == PRIOR["a"] and v.b == PRIOR["b"] and abs(v.mean - 1.0) < 1e-9


def test_season_scales_exposure():
    flat = velocity(weeks([4, 4]), PRIOR)
    peak = velocity([Week(sold=4, exposure=1.0, season=2.0)] * 2, PRIOR)
    assert peak.mean < flat.mean  # 4 sales in a 2x season week is a lower base rate


def test_counts_deduplicate_by_cluster_and_cap_engagement():
    comps = [
        {"product": "p", "site": "ebay", "week": "2026-W44", "cluster_id": "c1", "sold": True},
        {"product": "p", "site": "poshmark", "week": "2026-W44", "cluster_id": "c1", "sold": True},  # cross-post
        {"product": "p", "site": "ebay", "week": "2026-W44", "cluster_id": "c2", "sold": True},
        {"product": "p", "site": "ebay", "week": "2026-W44", "cluster_id": "c3", "sold": False},
    ]
    assert weekly_counts(comps) == {("p", "2026-W44"): 2}
    capped = cap_engagement([1] * 99 + [10_000])
    assert max(capped) < 10_000
