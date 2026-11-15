"""The experiment runner (spec/plans/backtest/plan.md): the test of the test first (decision 23), then the scores."""
import pytest

from valuation import experiment, synthetic
from valuation.backtest import LeakageError

TEST_FROM = "2026-08-01T00:00:00Z"


@pytest.fixture(scope="module")
def rows():
    return experiment.from_synthetic(synthetic.market(n=1500, seed=11))


@pytest.fixture(scope="module")
def report(rows):
    contestants = [experiment.Oracle(), experiment.RandomComps(seed=3), experiment.ProductMedian(), experiment.LastSale(),
                   experiment.Model()]
    ests = experiment.run(rows, contestants, test_from=TEST_FROM)
    return experiment.score(ests, rows)


def test_an_oracle_that_reads_the_answer_scores_full_marks(report):
    o = report["contestants"]["oracle"]["overall"]
    assert o["n"] > 100 and o["within_20"] == 1.0 and o["coverage"] == 1.0 and o["hit_rate"] == 1.0


def test_random_comps_do_not_beat_the_product_median(report):
    rand = report["contestants"]["random_comps"]["overall"]["within_20"]
    base = report["contestants"]["product_90d_median"]["overall"]["within_20"]
    assert rand < base


def test_a_contestant_only_ever_sees_rows_from_before_its_freeze_date(rows):
    seen = []

    class Spy(experiment.ProductMedian):
        name = "spy"

        def predict(self, item, as_of, history):
            seen.append(max((experiment.ts(r["at"]) for r in history), default=0) < experiment.ts(as_of))
            return super().predict(item, as_of, history)

    experiment.run(rows, [Spy()], test_from=TEST_FROM)
    assert seen and all(seen)


def test_an_estimate_built_on_a_later_sale_is_refused(rows):
    sold = [r for r in rows if r["price_type"] == "sold"]
    early, late = sold[0], max(sold, key=lambda r: r["at"])
    bad = {"contestant": "cheat", "item_id": early["row_id"], "as_of": early["at"], "q10": 1, "q50": 2, "q90": 3,
           "shown": True, "comp_ids": [late["row_id"]]}
    with pytest.raises(LeakageError):
        experiment.score([bad], rows)


def test_the_report_shows_closeness_bias_and_a_paired_lift_with_an_interval(report):
    m = report["contestants"]["model"]
    for k in ("within_10", "within_20", "median_pct_off", "median_dollars_off", "bias", "off_by_over_30", "coverage"):
        assert m["overall"][k] is not None, k
    lift = m["lift_vs_primary"]
    assert lift["lo"] <= lift["diff"] <= lift["hi"] and lift["n_products"] > 1
    assert report["ceiling"]["min_peers"] >= 3   # too few same-week peers on 1,500 synthetic rows: reported as None, not a number
    assert report["sentence"]


def test_the_duel_scores_only_sales_after_it_was_recorded(rows):
    history = [r for r in rows if r["at"] < "2026-10-01"]
    live = [{**r, "price_type": "asking"} for r in rows if r["price_type"] == "sold" and r["at"] >= "2026-10-01"][:40]
    duel = experiment.record_duel(live, history, [experiment.ProductMedian()], recorded_at="2026-10-01T00:00:00Z")
    assert len(duel["sha256"]) == 64
    before = {"row_id": live[0]["row_id"], "state": "sold", "price_cents": 1000, "at": "2026-09-30T00:00:00Z"}
    after = [{"row_id": r["row_id"], "state": "sold", "price_cents": r["price_cents"], "at": r["at"]} for r in live[1:]]
    out = experiment.score_duel(duel, [before, *after])
    assert out["resolved"] == len(after) and out["refused_sold_before_record"] == 1


def test_the_ceiling_is_how_close_identical_same_week_sales_are_to_each_other():
    tight = [{**{k: None for k in experiment.FIELDS}, "row_id": f"t{i}", "product_id": "p", "condition": "good",
              "price_type": "sold", "price_cents": 10000 + (i % 5) * 100, "at": f"2026-10-0{1 + i % 3}T00:00:00Z",
              "may_model": True} for i in range(40)]
    assert experiment._ceiling(tight, tight)["within_20"] == 1.0
    wide = [{**r, "price_cents": 10000 if i % 2 else 30000} for i, r in enumerate(tight)]
    assert experiment._ceiling(wide, wide)["within_20"] < 0.5
