"""Seeded failure causes for the frozen-row valuation proof."""
from copy import deepcopy

import numpy as np
import pytest

from valuation.backtest import LeakageError, aci_step, check_leakage, conformal_q, run_backtest


def sold(comp_id="comp", **changes):
    return dict(comp_id=comp_id, product_id="product", family_id="family",
                site="mercari", sold_at="2026-01-01", price_cents=10000,
                may_model=True, priced_from_our_number=False, at_ask=False, **changes)


def estimate(item_id="target"):
    return dict(item_id=item_id, as_of="2026-02-01", q10=9000, q50=10000,
                q90=11000, group="family", comp_ids=["comp"], param_version="v1")


def frozen():
    return [estimate()], [sold(), {**sold("target"), "sold_at": "2026-02-10"}]


@pytest.mark.parametrize("route", [
    "future_comp", "target_sale", "may_model", "priced_from_our_number",
    "at_ask", "duplicate_target",
])
def test_seeded_leakage_names_its_cause_and_refuses_backtest(route):
    estimates, rows = frozen()
    if route == "future_comp":
        rows[0]["sold_at"] = estimates[0]["as_of"]
    elif route == "target_sale":
        estimates[0]["comp_ids"] = ["target"]
    elif route == "may_model":
        rows[0]["may_model"] = False
    elif route in ("priced_from_our_number", "at_ask"):
        rows[1][route] = True
    else:
        estimates[0]["comp_ids"] = ["target"]
        rows.append({**rows[1], "site": "depop"})
    violations = check_leakage(estimates, rows)
    assert any(v["item_id"] == "target" and v["route"] == route for v in violations), route
    with pytest.raises(LeakageError, match=route):
        run_backtest(estimates, rows)


def test_future_comp_uses_instants_not_iso_string_order():
    estimates, rows = frozen()
    estimates[0]["as_of"] = "2026-02-01T01:00:00+02:00"
    rows[0]["sold_at"] = "2026-01-31T23:30:00Z"
    assert check_leakage(estimates, rows)[0]["route"] == "future_comp"


def test_no_comps_is_counted_not_checked_yet():
    estimates, rows = frozen()
    estimates[0]["comp_ids"] = []
    result = run_backtest(estimates, rows)
    assert result["overall"]["n"] == 1
    assert result["overall"]["not_checked_yet"] == 1
    assert result["cells"][0]["state"] == "not_checked_yet"
    assert result["cells"][0]["coverage"] is None


def test_unknown_comp_is_an_input_error_not_silently_skipped():
    estimates, rows = frozen()
    estimates[0]["comp_ids"] = ["missing"]
    with pytest.raises(ValueError, match="missing"):
        run_backtest(estimates, rows)


def population(n=100, hits=80):
    estimates = []
    rows = [sold()]
    for i in range(n):
        e = estimate(f"target-{i}")
        e["q10"], e["q90"] = (10000, 10000) if i < hits else (11000, 12000)
        e["q50"] = 10000 if i < hits else 11000
        estimates.append(e)
        rows.append({**sold(e["item_id"]), "sold_at": "2026-02-10"})
    return estimates, rows


def test_coverage_is_inclusive_and_checked_share_rounds_down():
    estimates, rows = population(hits=83)
    result = run_backtest(estimates, rows)
    cell = result["cells"][0]
    assert cell["n"] == 100
    assert cell["coverage"] == .83
    assert cell["q50_median_error"] == 0
    assert cell["passes"] is True
    assert cell["state"] == "checked"
    assert cell["share_shown"] == .8
    assert .70 < cell["wilson_95"][0] < .83 < cell["wilson_95"][1]


def test_small_cell_never_claims_checked_even_with_perfect_coverage():
    estimates, rows = population(29, 29)
    cell = run_backtest(estimates, rows)["cells"][0]
    assert cell["state"] == "not_checked_yet"
    assert cell["passes"] is False
    assert cell["share_shown"] is None


@pytest.mark.parametrize("hits", [74, 86])
def test_out_of_band_coverage_fails(hits):
    estimates, rows = population(hits=hits)
    assert run_backtest(estimates, rows)["overall"]["passes"] is False


def test_baselines_are_computed_from_frozen_rows_and_better_one_gates_pass():
    estimates, rows = population()
    for e in estimates:
        e["q50"] = 10500
    result = run_backtest(estimates, rows)
    assert result["baselines"]["weighted_median"]["overall"]["q50_median_error"] == 0
    assert result["baselines"]["family_90_day_median"]["overall"]["q50_median_error"] == 0
    assert result["overall"]["q50_median_error"] == .05
    assert result["overall"]["passes"] is False


def test_baseline_weights_and_90_day_cutoff_exclude_future_and_other_families():
    estimates, rows = frozen()
    rows[0].update(price_cents=5000, w=1)
    rows += [{**sold("heavy"), "price_cents": 15000, "w": 9},
             {**sold("old"), "sold_at": "2025-01-01", "price_cents": 99000},
             {**sold("other"), "family_id": "other", "price_cents": 99000},
             {**sold("future"), "sold_at": "2026-02-05", "price_cents": 99000}]
    estimates[0]["comp_ids"].append("heavy")
    baselines = run_backtest(estimates, rows)["baselines"]
    assert baselines["weighted_median"]["overall"]["q50_median_error"] == .5
    assert baselines["family_90_day_median"]["overall"]["q50_median_error"] == 0


def test_same_product_is_not_same_physical_item_but_cluster_relist_is():
    estimates, rows = frozen()
    assert check_leakage(estimates, rows) == []
    for row in rows:
        row["cluster_id"] = "same-item"
    assert any(v["route"] == "duplicate_target" for v in check_leakage(estimates, rows))


def test_cells_use_frozen_q50_price_bands_and_group():
    estimates, rows = population(4, 4)
    for e, price in zip(estimates, [2499, 2500, 10000, 50001]):
        e.update(q10=price, q50=price, q90=price)
    result = run_backtest(estimates, rows)
    assert {c["price_band"] for c in result["cells"]} == {
        "under_25", "25_to_100", "100_to_500", "over_500"}


def test_determinism_and_inputs_remain_frozen():
    estimates, rows = population()
    before = deepcopy((estimates, rows))
    assert run_backtest(estimates, rows) == run_backtest(estimates, rows)
    assert (estimates, rows) == before


def test_aci_uses_miss_indicator_and_d6_sign_without_clamping():
    assert aci_step(.2, True) == pytest.approx(.201)
    assert aci_step(.2, False) == pytest.approx(.196)
    assert aci_step(0, False) == pytest.approx(-.004)


def test_conformal_quantile_uses_finite_sample_rank_and_weights():
    assert conformal_q([1, 2, 3, 4, 5], [1]*5, .2) == 5
    assert conformal_q([1, 2, 3, 4, 5], [100, 1, 1, 1, 1], .4) == 1
    assert np.isinf(conformal_q([1, 2], [1, 1], .2))
    assert conformal_q([-3, -2, -1, 0, 1], [1]*5, .5) == -1


@pytest.mark.parametrize("scores,weights", [([], []), ([1], [0]), ([1], [-1]),
                                                   ([1, 2], [1]), ([float('nan')], [1])])
def test_invalid_conformal_inputs_name_the_error(scores, weights):
    with pytest.raises(ValueError, match="scores|weights"):
        conformal_q(scores, weights, .2)


def test_empty_input_is_not_a_success():
    result = run_backtest([], [])
    assert result["cells"] == []
    assert result["overall"]["passes"] is False
    assert result["overall"]["state"] == "not_checked_yet"


def test_fit_rows_after_as_of_are_a_centred_index_leak_and_may_model_applies():
    estimates, rows = frozen()
    estimates[0]["fit_row_ids"] = ["target"]
    routes = {v["route"] for v in check_leakage(estimates, rows)}
    assert {"centred_index", "target_sale"} <= routes
    estimates[0]["fit_row_ids"] = ["comp"]
    rows[0]["may_model"] = False
    assert {v["route"] for v in check_leakage(estimates, rows)} == {"may_model"}
