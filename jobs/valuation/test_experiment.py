"""The experiment runner (spec/plans/backtest/plan.md): the test of the test first (decision 23), then the scores."""
import json

import pytest

from valuation import experiment, synthetic
from valuation.backtest import LeakageError

TEST_FROM = "2026-08-01T00:00:00Z"


@pytest.fixture(scope="module")
def rows():
    return experiment.from_synthetic(synthetic.market(n=1500, seed=11))


@pytest.fixture(scope="module")
def report(rows):
    contestants = [experiment.Oracle(), experiment.RandomComps(), experiment.ProductMedian(), experiment.LastSale(),
                   experiment.Model()]
    return experiment.score(experiment.run(rows, contestants, test_from=TEST_FROM), rows)


def _row(i, **kw):
    return {**{k: None for k in experiment.FIELDS}, **experiment.FLAGS, "row_id": f"r{i}", "product_id": "p",
            "condition": "good", "price_type": "sold", "price_cents": 10000, "at": "2026-10-02T00:00:00Z", **kw}


def _est(q50, q10=None, q90=None):
    return {"q10": q10 or q50, "q50": q50, "q90": q90 or q50, "shown": True}


def test_an_oracle_that_reads_the_answer_scores_full_marks(report):
    o = report["contestants"]["oracle"]["overall"]
    assert o["n"] > 100 and o["within_20"] == 1.0 and o["coverage"] == 1.0 and o["hit_rate"] == 1.0


def test_random_comps_do_not_beat_the_product_median(report):
    rand = report["contestants"]["random_comps"]["overall"]["within_20"]
    base = report["contestants"]["product_90d_median"]["overall"]["within_20"]
    assert rand < base


def test_a_contestant_only_ever_learns_from_rows_before_its_freeze_date_and_allowed_to_model(rows):
    rows = [{**r, "may_model": i % 3 != 0} for i, r in enumerate(rows)]
    seen = []

    class Spy(experiment.ProductMedian):
        name = "spy"

        def fit(self, train):
            seen.append(("fit", max(experiment.ts(r["at"]) for r in train), all(r["may_model"] for r in train)))

        def predict(self, item, as_of, history):
            rs = history.product(item["product_id"])
            seen.append(("predict", max((experiment.ts(r["at"]) for r in rs), default=0) < experiment.ts(as_of)
                         and history.latest_at() < experiment.ts(as_of), all(r["may_model"] for r in rs)))
            fits = [s for s in seen if s[0] == "fit"]
            assert fits[-1][1] < experiment.ts(as_of)
            return super().predict(item, as_of, history)

    experiment.run(rows, [Spy()], test_from=TEST_FROM)
    assert seen and all(s[2] for s in seen) and all(s[1] for s in seen if s[0] == "predict")


def test_an_estimate_built_on_a_later_sale_is_refused(rows):
    sold = [r for r in rows if r["price_type"] == "sold"]
    early, late = sold[0], max(sold, key=lambda r: r["at"])
    bad = {"contestant": "cheat", "item_id": early["row_id"], "as_of": early["at"], "q10": 1, "q50": 2, "q90": 3,
           "shown": True, "comp_ids": [late["row_id"]]}
    with pytest.raises(LeakageError):
        experiment.score([bad], rows)


def test_metrics_measure_closeness_the_side_we_miss_on_and_the_range():
    pairs = [(100, _est(110, 90, 130)), (100, _est(130, 120, 140)), (100, _est(105, 95, 115)), (100, _est(85, 80, 99))]
    m = experiment._metrics(pairs)
    assert m["within_10"] == 0.5 and m["within_20"] == 0.75 and m["off_by_over_30"] == 0.0
    assert m["bias"] == pytest.approx(0.075) and m["median_pct_off"] == pytest.approx(0.125)   # signed against absolute
    assert m["sold_above_our_middle"] == 0.25 and m["coverage"] == 0.5
    assert experiment._metrics(pairs, min_n=30)["too_few"]


def test_the_lift_interval_resamples_products_and_the_sentence_reads_the_interval():
    a = [1, 1, 1, 0] * 10 + [0] * 40
    b = [0, 1, 0, 0] * 10 + [0] * 40
    lift = experiment._lift(a, b, [f"p{i % 20}" for i in range(80)])
    assert lift["lo"] < lift["diff"] < lift["hi"] and lift["n_products"] == 20
    mixed = {"diff": 0.05, "lo": -0.02, "hi": 0.12, "n_items": 200}
    assert "as accurate as" in experiment.sentence(mixed, 0.7, 0.65, 0.8)
    assert "against" in experiment.sentence({**mixed, "lo": 0.01}, 0.7, 0.65, 0.8)
    assert "too few" in experiment.sentence({**mixed, "n_items": 10}, 0.7, 0.65, 0.8)


def test_the_ceiling_is_how_close_identical_same_week_sales_are_to_each_other():
    tight = [_row(i, price_cents=10000 + (i % 5) * 100, at=f"2026-10-0{1 + i % 3}T00:00:00Z") for i in range(40)]
    assert experiment._ceiling(tight, tight)["within_20"] == 1.0
    skewed = [_row(i, price_cents=30000 if i % 3 == 0 else 10000) for i in range(42)]   # a mean would be pulled up, a median is not
    assert experiment._ceiling(skewed, skewed)["within_20"] == pytest.approx(28 / 42, abs=0.01)
    assert experiment._ceiling(tight[:10], tight[:10])["too_few"]


def test_hidden_best_offers_and_sales_at_our_ask_are_left_out_and_counted():
    rows = [_row(i) for i in range(5)] + [_row(9, best_offer="hidden"), _row(8, at_ask=True)]
    tests, left = experiment._tests(rows, "2026-09-01T00:00:00Z", None)
    assert len(tests) == 5 and left == {"best_offer_hidden": 1, "at_our_ask_or_number": 1}


def test_the_duel_scores_only_sales_after_it_was_recorded_and_counts_every_state(rows):
    history = [r for r in rows if r["at"] < "2026-10-01"]
    live = [{**r, "price_type": "asking"} for r in rows if r["price_type"] == "sold" and r["at"] >= "2026-10-01"][:40]
    duel = experiment.record_duel(live, history, [experiment.ProductMedian()], recorded_at="2026-10-01T00:00:00Z")
    assert duel["entries"][0]["item"]["brand"] and len(duel["sha256"]) == 64
    ids = [r["row_id"] for r in live]
    outcomes = [{"row_id": ids[0], "state": "sold", "price_cents": 1000, "at": "2026-09-30T00:00:00Z"},
                {"row_id": ids[1], "state": "ended", "price_cents": None, "at": "2026-10-20T00:00:00Z"},
                {"row_id": "not-in-duel", "state": "sold", "price_cents": 1, "at": "2026-10-05T00:00:00Z"}]
    outcomes += [{"row_id": r["row_id"], "state": "sold", "price_cents": r["price_cents"], "at": r["at"]} for r in live[2:30]]
    out = experiment.score_duel(duel, outcomes)
    assert (out["resolved"], out["refused_sold_before_record"], out["ended_unsold"], out["still_live"]) == (28, 1, 1, 10)
    duel["entries"][0]["ask_cents"] += 1
    with pytest.raises(ValueError):
        experiment.score_duel(duel, outcomes)


def test_the_report_carries_every_number_the_page_shows(report):
    m = report["contestants"]["model"]
    for k in ("within_10", "within_20", "median_pct_off", "median_dollars_off", "bias", "off_by_over_30", "coverage",
              "median_range_width"):
        assert m["overall"][k] is not None, k
    assert set(m["slices"]) == {"kind", "condition", "site", "month", "price_band_of_our_middle"}
    assert report["sentence"].startswith("On ")


def test_the_ledger_refuses_a_second_look_at_the_locked_month_and_scores_replay_from_the_log(rows, tmp_path):
    import csv
    path, book = tmp_path / "rows.csv", str(tmp_path / "ledger.jsonl")
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    args = ["backtest", "--rows", str(path), "--ledger", book, "--sample", "60"]
    experiment.main(args + ["--test-from", "2026-07-01T00:00:00Z", "--test-to", "2026-09-01T00:00:00Z"])
    with pytest.raises(ValueError, match="already"):
        experiment.main(args + ["--test-from", "2026-08-01T00:00:00Z", "--locked"])      # tuning already saw August
    _, brief = experiment.main(args + ["--test-from", "2026-09-01T00:00:00Z", "--locked"])
    with pytest.raises(ValueError, match="already"):
        experiment.main(args + ["--test-from", "2026-10-01T00:00:00Z"])                  # a look inside the locked window
    _, again = experiment.main(args + ["--test-from", "2026-10-01T00:00:00Z", "--deviation", "scorer bug fixed"])
    book_lines = [json.loads(x) for x in open(book)]
    assert [x["locked"] for x in book_lines] == [False, True, False] and book_lines[-1]["deviation"] == "scorer bug fixed"
    assert book_lines[0]["settings"]["model"]["ANCHOR_K"] == 5 and len(book_lines[0]["rows_sha256"]) == 64
    _, replay = experiment.main(["rescore", "--log", brief["log"], "--rows", str(path)])
    assert replay["contestants"] == brief["contestants"]
