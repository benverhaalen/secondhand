import math

from valuation import market
from valuation import synthetic

TODAY = "2026-11-15T00:00:00Z"
ITEM = {"brand": "champion", "category": "t-shirt", "condition": "good", "era": "90s", "site": "ebay", "size": "l"}


def _log_effect(m, term):
    cols = m.hedonic.design.columns
    return float(m.hedonic.beta[cols.index(term)]) if term in cols else 0.0


def test_the_hedonic_model_recovers_what_each_attribute_is_worth():
    m = market.fit(synthetic.market())
    t = synthetic.TRUTH
    # Effects are relative to each feature's baseline level, so compare differences between two levels.
    for f, a, b in (("brand", "champion", "generic"), ("brand", "carhartt", "levis"), ("era", "90s", "modern"), ("condition", "fair", "good")):
        got = _log_effect(m, f"{f}={a}") - _log_effect(m, f"{f}={b}")
        assert abs(got - (t[f][a] - t[f][b])) < 0.08, (f, a, b, got)
    assert abs(_log_effect(m, "asking") - t["asking"]) < 0.06


def test_the_80_percent_range_holds_about_80_percent_of_the_next_sales_and_beats_the_category_median():
    bt = market.backtest(synthetic.market(n=3000, seed=11))
    assert 0.74 <= bt["coverage"] <= 0.88, bt
    assert bt["median_ape"] < bt["median_ape_category_median"], bt


def test_adjusted_comps_move_each_sale_to_the_target_by_the_fitted_premiums():
    m = market.fit(synthetic.market())
    sold = [r for r in m.rows if r["price_type"] == "sold"]
    comps = market.adjusted_comps(m.hedonic, ITEM, sold, today=TODAY, k=5)
    assert len(comps) == 5 and comps[0]["distance"] <= comps[-1]["distance"]
    for c in comps:
        r = next(x for x in sold if x["comp_id"] == c["comp_id"])
        want = r["price_cents"] * math.exp(m.hedonic.log_point(ITEM) - m.hedonic.log_point(r))
        assert abs(c["adjusted_cents"] - want) <= 1


def test_an_estimate_is_ordered_labelled_and_cites_its_comps():
    e = market.fit(synthetic.market()).estimate(ITEM, today=TODAY)
    assert e["q10_cents"] < e["q50_cents"] < e["q90_cents"]
    assert e["level"] in (1, 2) and e["comps"] and all(c["citation"] for c in e["comps"])
    assert e["liquidity"]["sell_through"] is not None and e["unseen"] == []


def test_a_thin_market_is_level_3_and_an_unknown_brand_is_named_not_hidden():
    rows = synthetic.market(n=40, seed=3)
    e = market.fit(rows).estimate({**ITEM, "brand": "never-seen"}, today=TODAY)
    assert e["level"] == 3
    assert "brand" in e["unseen"]


def test_conformal_widening_restores_coverage_when_the_newest_sales_got_noisier():
    import numpy as np
    from datetime import datetime
    rows = synthetic.market(n=3000, seed=5)
    rng = np.random.default_rng(1)
    end = datetime.fromisoformat(TODAY.replace("Z", "+00:00"))
    for r in rows:
        if (end - datetime.fromisoformat(r["at"].replace("Z", "+00:00"))).days < 150:
            r["price_cents"] = int(r["price_cents"] * math.exp(rng.normal(0, 0.45)))
    bt = market.backtest(rows)
    assert bt["coverage"] >= 0.72, bt
