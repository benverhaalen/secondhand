"""dt-4: demand learning - resolve, refit, coverage, promote, rollback (demand-and-trend §4)."""
import numpy as np

from demand.learn import (Forecast, coverage, fold, guard_weights, k_cov, pinball, refit_weights, resolve)
from param.registry import MemoryStore

PRIOR_W = {"sold": 0.5, "watchers": 0.3, "search": 0.2, "open_web": 0.0}
SCOPE = {"kind": "apparel"}


def fc(i, p10, p50, p90, horizon_end="2026-11-01"):
    return Forecast(id=f"f{i}", product=f"p{i}", horizon_end=horizon_end, p10=p10, p50=p50, p90=p90)


def test_pinball_is_zero_on_a_perfect_median_and_grows_with_error():
    f = fc(0, 8, 10, 12)
    assert pinball(f, 10) < pinball(f, 14) < pinball(f, 20)


def test_fc_fixture_pinball_and_coverage(load_fixture):
    rows, exp = load_fixture("fc/forecasts.json"), load_fixture("fc/expected.json")
    fs = [Forecast(id=r["id"], product=r["id"], horizon_end=r["as_of"], p10=r["p10"], p50=r["p50"], p90=r["p90"])
          for r in rows]
    res = resolve(fs, {r["id"]: r["resolved_value"] for r in rows if r.get("resolved_value") is not None},
                  today=exp["now"][:10])
    assert sorted(f.id for f in res) == sorted(exp["resolved_ids"])
    assert {f.id: round(pinball(f, f.resolved_value), 2) for f in res} == exp["pinball_loss"]
    assert round(coverage(res, 1.0) * exp["coverage"]["of"]) == exp["coverage"]["inside"]


def test_late_resolve_is_scored_and_refit():
    rows = [fc(1, 8, 10, 12, horizon_end="2026-10-01")]
    resolved = resolve(rows, actuals={"p1": 11}, today="2026-11-14")
    assert resolved and resolved[0].resolved_value == 11  # resolved weeks after its horizon, still counted
    assert resolve(rows, actuals={}, today="2026-11-14") == []  # no actual yet: nothing scored


def test_refit_is_nonnegative_sums_to_one_and_respects_guards():
    rng = np.random.default_rng(1)
    r = {k: rng.normal(size=400) for k in PRIOR_W}
    y = 0.9 * r["sold"] + 0.1 * r["open_web"] + rng.normal(scale=0.05, size=400)
    w = guard_weights(refit_weights(r, y), PRIOR_W)
    assert all(v >= 0 for v in w.values()) and abs(sum(w.values()) - 1) < 1e-9
    assert w["open_web"] <= 0.20 + 1e-9  # started at 0: capped
    for k in ("sold", "watchers", "search"):
        assert PRIOR_W[k] * 0.5 - 1e-9 <= w[k] <= PRIOR_W[k] * 1.5 + 1e-9


def test_k_cov_brings_coverage_to_eighty_percent():
    rng = np.random.default_rng(2)
    rows = [fc(i, 9, 10, 11) for i in range(200)]
    actual = {f"p{i}": 10 + rng.normal(scale=3) for i in range(200)}  # intervals far too narrow
    res = resolve(rows, actual, today="2026-11-14")
    assert coverage(res, 1.0) < 0.5
    k = k_cov(res)
    assert 0.78 <= coverage(res, k) <= 0.82


def _hist(n, scale, seed):
    rng = np.random.default_rng(seed)
    rows = [fc(i, 10 - 1.28 * scale, 10, 10 + 1.28 * scale) for i in range(n)]
    return resolve(rows, {f"p{i}": 10 + rng.normal(scale=3) for i in range(n)}, today="2026-11-14")


def test_better_challenger_promoted_with_enough_resolved():
    store = MemoryStore()
    champ = _hist(400, 6.0, 3)  # wide, poorly placed
    chall = _hist(400, 3.0, 3)  # well calibrated
    ok, why = fold(store, "demand_weights", SCOPE, champion=champ, challenger=chall, value=PRIOR_W, at="t1")
    assert ok, why
    assert store.champion("demand_weights", SCOPE)["held_out_score"] is not None


def test_no_promote_below_300_resolved():
    store = MemoryStore()
    ok, why = fold(store, "demand_weights", SCOPE, champion=_hist(100, 6.0, 4), challenger=_hist(100, 3.0, 4),
                   value=PRIOR_W, at="t1")
    assert not ok and "300" in why


def test_coverage_drop_rolls_back():
    store = MemoryStore()
    assert fold(store, "demand_weights", SCOPE, champion=_hist(400, 9.0, 5), challenger=_hist(400, 6.0, 5),
                value=PRIOR_W, at="t1")[0]
    assert fold(store, "demand_weights", SCOPE, champion=_hist(400, 6.0, 5), challenger=_hist(400, 3.0, 5),
                value=PRIOR_W, at="t2")[0]
    # the champion's newly resolved forecasts fall outside their ranges far more than 20% of the time
    ok, why = fold(store, "demand_weights", SCOPE, champion=_hist(400, 0.3, 6), challenger=_hist(400, 0.3, 6),
                   value=PRIOR_W, at="t3")
    assert not ok and "coverage" in why
    assert store.champion("demand_weights", SCOPE)["promoted_at"] == "t3"  # the t1 version, restored at t3
    assert store.champion("demand_weights", SCOPE)["version"] == 1
