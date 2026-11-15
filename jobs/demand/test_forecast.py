"""dt-3: count and price forecasts with event and season terms (demand-and-trend §3 steps 4-5)."""
from demand.events import Event, season_terms
from demand.forecast import count_forecast, price_forecast
from demand.velocity import Velocity, velocity

POST = velocity([], {"a": 8.0, "b": 4.0})  # 2 a week
FLAT = {m: 1.0 for m in range(1, 13)}
PARAMS = {"beta_D": 0.5, "k_cov": 1.0}
FC_FIELDS = {"id", "subject", "horizon_weeks", "metric", "p10", "p50", "p90", "basis_count", "param_versions",
             "model_version", "as_of"}


def test_forecast_row_has_the_fc_shape_and_an_interval():
    row = count_forecast("product_fx2", POST, weeks=season_terms("2026-11-02", 4, FLAT, []), D=0.0, params=PARAMS,
                         basis_count=24, as_of="2026-11-01")
    assert set(row) >= FC_FIELDS and row["metric"] == "sales_count"
    assert row["p10"] < row["p50"] < row["p90"]
    assert 6 <= row["p50"] <= 9  # 2 a week for 4 weeks


def test_holiday_raises_the_season_term():
    bf = [Event(name="black_friday", start="2026-11-23", weeks=1, effect=2.0)]
    plain = season_terms("2026-11-16", 4, FLAT, [])
    holiday = season_terms("2026-11-16", 4, FLAT, bf)
    assert sum(holiday) > sum(plain)
    a = count_forecast("p", POST, weeks=plain, D=0.0, params=PARAMS, basis_count=24, as_of="2026-11-15")
    b = count_forecast("p", POST, weeks=holiday, D=0.0, params=PARAMS, basis_count=24, as_of="2026-11-15")
    assert b["p50"] > a["p50"]


def test_no_history_reads_the_prior_with_a_wide_interval():
    prior_only = count_forecast("p", velocity([], {"a": 2.0, "b": 1.0}), weeks=[1.0] * 4, D=0.0, params=PARAMS,
                                basis_count=0, as_of="2026-11-01")
    sure = count_forecast("p", Velocity(a=200.0, b=100.0, mean=2.0, p10=0, p90=0), weeks=[1.0] * 4, D=0.0,
                          params=PARAMS, basis_count=400, as_of="2026-11-01")
    assert (prior_only["p90"] - prior_only["p10"]) > (sure["p90"] - sure["p10"])


def test_rising_D_and_k_cov_move_the_forecast():
    base = count_forecast("p", POST, weeks=[1.0] * 4, D=0.0, params=PARAMS, basis_count=24, as_of="t")
    up = count_forecast("p", POST, weeks=[1.0] * 4, D=0.6, params=PARAMS, basis_count=24, as_of="t")
    wide = count_forecast("p", POST, weeks=[1.0] * 4, D=0.0, params={**PARAMS, "k_cov": 2.0}, basis_count=24, as_of="t")
    assert up["p50"] > base["p50"]
    assert (wide["p90"] - wide["p10"]) > (base["p90"] - base["p10"])


def test_price_forecast_has_a_seeded_bootstrap_interval():
    comps = [4000 + 50 * i for i in range(-10, 11)]
    a = price_forecast("p", comps, age_step=0.95, decay=1.0, params=PARAMS, as_of="t", seed=1)
    b = price_forecast("p", comps, age_step=0.95, decay=1.0, params=PARAMS, as_of="t", seed=1)
    assert a == b and a["metric"] == "median_sold_price_cents"
    assert a["p10"] < a["p50"] < a["p90"] and abs(a["p50"] - 3800) < 60
