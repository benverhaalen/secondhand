import math
from datetime import datetime

import numpy as np
import pytest

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
    assert abs(_log_effect(m, "days") * 365 - t["trend_per_year"]) < 0.04   # older sales were cheaper


def test_live_asks_never_train_the_model():
    rows = synthetic.market()
    with_asks = market.fit(rows)
    sold_only = market.fit([r for r in rows if r["price_type"] == "sold"])
    assert np.allclose(with_asks.hedonic.beta, sold_only.hedonic.beta)


def test_the_80_percent_range_holds_75_to_85_percent_of_the_next_sales_and_beats_the_category_median():
    bt = market.backtest(synthetic.market(n=3000, seed=11))
    assert 0.75 <= bt["coverage"] <= 0.85, bt          # money D5 "Check later"
    assert bt["median_ape"] < bt["median_ape_category_median"], bt


def test_conformal_widening_restores_coverage_when_the_newest_sales_got_noisier():
    rows = synthetic.market(n=3000, seed=5)
    rng = np.random.default_rng(1)
    end = datetime.fromisoformat(TODAY.replace("Z", "+00:00"))
    for r in rows:
        if (end - datetime.fromisoformat(r["at"].replace("Z", "+00:00"))).days < 150:
            r["price_cents"] = int(r["price_cents"] * math.exp(rng.normal(0, 0.45)))
    assert market.backtest(rows)["coverage"] >= 0.72


def test_comps_are_moved_to_the_item_and_to_today():
    m = market.fit(synthetic.market())
    comps = market.adjusted_comps(m.hedonic, ITEM, m.sold, today=TODAY, k=5)
    assert len(comps) == 5 and comps[0]["distance"] <= comps[-1]["distance"]
    for c in comps:
        r = next(x for x in m.sold if x["comp_id"] == c["comp_id"])
        want = r["price_cents"] * math.exp(m.hedonic.log_point(ITEM, TODAY) - m.hedonic.log_point(r, r["at"]))
        assert abs(c["adjusted_cents"] - want) <= 1
    # The same sale a year older adjusts up by the fitted trend, not by nothing.
    old = {**ITEM, "at": "2025-11-15T00:00:00Z", "price_cents": 4000, "comp_id": "old"}
    new = {**ITEM, "at": TODAY, "price_cents": 4000, "comp_id": "new"}
    a = {c["comp_id"]: c["adjusted_cents"] for c in market.adjusted_comps(m.hedonic, ITEM, [old, new], today=TODAY)}
    assert a["old"] > a["new"]


def test_an_estimate_is_ordered_in_whole_dollars_labelled_and_cites_its_comps():
    e = market.fit(synthetic.market()).estimate(ITEM, today=TODAY)
    assert e["low_cents"] < e["median_cents"] < e["high_cents"]
    assert all(e[k] % 100 == 0 for k in ("low_cents", "median_cents", "high_cents"))
    assert e["shown"] and e["level"] in (1, 2) and all(c["citation"] for c in e["comps"])
    assert e["liquidity"]["sell_through"] is not None and e["unseen"] == []


def test_a_thin_market_is_hidden_as_too_few_and_an_unknown_brand_is_named():
    e = market.fit(synthetic.market(n=40, seed=3)).estimate({**ITEM, "brand": "never-seen"}, today=TODAY)
    assert (e["shown"], e["hidden"], e["level"]) == (False, "too_few", 3)
    assert "brand" in e["unseen"] and e["comps"]


def test_a_range_wider_than_its_median_is_hidden_as_too_wide():
    rows = synthetic.market(n=2000, seed=2)
    rng = np.random.default_rng(4)
    for r in rows:
        r["price_cents"] = int(r["price_cents"] * math.exp(rng.normal(0, 0.9)))
    e = market.fit(rows).estimate(ITEM, today=TODAY)
    assert e["high_cents"] - e["low_cents"] > e["median_cents"]
    assert (e["shown"], e["hidden"]) == (False, "too_wide")


def _with_products(rows, n_products=40, spread=0.5, seed=3):
    """Each row becomes one of n products whose own premium the attributes cannot see, like two shoes of one brand."""
    rng = np.random.default_rng(seed)
    effect = rng.normal(0, spread, n_products)
    out = []
    for r in rows:
        p = int(rng.integers(n_products))
        out.append({**r, "product_id": f"p{p}", "price_cents": int(r["price_cents"] * math.exp(effect[p]))})
    return out


def test_the_middle_starts_from_the_products_own_recent_sales_when_the_attributes_miss_it():
    rows = _with_products(synthetic.market(n=3000, seed=11))
    anchored = market.backtest(rows)
    blind = market.backtest([{k: v for k, v in r.items() if k != "product_id"} for r in rows])
    # Sale noise here is ~0.3 in logs, so the best anchored middle is off by about 0.67 x 0.3 x sqrt(1 + 1/5) = 0.22;
    # blind to a 0.5 product spread it is off by about 0.67 x sqrt(0.3^2 + 0.5^2) = 0.39 at best.
    assert anchored["median_ape"] < 0.25 and anchored["median_ape"] < 0.7 * blind["median_ape"], (anchored, blind)
    assert 0.75 <= anchored["coverage"] <= 0.85, anchored        # the anchored range is calibrated on its own errors


def test_an_anchor_uses_only_the_products_sales_before_the_date_and_the_caller_can_hand_them_in():
    rows = _with_products(synthetic.market(n=3000, seed=11))
    m = market.fit(rows)
    item = next(r for r in reversed(m.sold) if r.get("product_id") == "p0")
    later = {**item, "at": "2030-01-01T00:00:00Z", "price_cents": item["price_cents"] * 50}
    own = m.interval(item, item["at"])
    assert own != m.interval({**item, "product_id": None}, item["at"])
    assert own == pytest.approx(m.interval(item, item["at"], recent=[r for r in m.sold if r.get("product_id") == "p0"] + [later]))
    assert m.interval(item, item["at"], recent=[]) == m.interval({**item, "product_id": None}, item["at"])
