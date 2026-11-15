"""The backtest runner of spec/plans/backtest/plan.md: frozen estimates from swappable contestants, scored and sliced.

A contestant is anything with `fit(train_rows)` and `predict(item, as_of, history) -> {q10, q50, q90, shown, comp_ids}`.
The runner hands each one only rows from before the item's freeze date, so the real engine plugs in later and is scored
on the same frozen rows as the baselines. Rows follow the schema in FIELDS (plan.md §6 and decision 32).

  python jobs/valuation/experiment.py self-test                       the test of the test, on the synthetic market
  python jobs/valuation/experiment.py backtest --rows R --test-from D --out O
  python jobs/valuation/experiment.py duel-record --live L --rows R --out duel.json
  python jobs/valuation/experiment.py duel-score --duel duel.json --outcomes O --out O2
"""
from __future__ import annotations

import argparse
import bisect
import csv
import hashlib
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "jobs"))
sys.path.insert(0, str(ROOT / "log"))

from secondhand_log import create_log, file_sink  # noqa: E402
from valuation import market  # noqa: E402
from valuation.backtest import BANDS, LeakageError, _band, _wilson, check_leakage  # noqa: E402

FIELDS = ("row_id", "source", "licence", "site", "url", "kind", "product_id", "family_id", "brand", "category",
          "condition", "size", "era", "title", "photo_count", "seller_feedback", "price_type", "price_cents",
          "buyer_shipping_cents", "listed_at", "at", "best_offer", "views", "watchers", "may_model")
INTS = ("price_cents", "buyer_shipping_cents", "photo_count", "seller_feedback", "views", "watchers")
GAP = timedelta(days=7)          # money D6 step 1
WINDOW = timedelta(days=90)      # money D6 step 6: the 90-day sold median a seller looks up
SAME_WEEK = timedelta(days=3)    # plan decision 8: the ceiling compares sales within a week of each other
MIN_PEERS = 3                    # guess: a median of 1 or 2 peers is itself noisy and would understate the ceiling
PRIMARY = "product_90d_median"   # plan decision 10: the headline is paired against the eBay-style median
DAY = timedelta(days=1)


def ts(s: str) -> float:
    return market._t(s)


def _iso(t: float) -> str:
    return datetime.fromtimestamp(t, timezone.utc).isoformat().replace("+00:00", "Z")


def load(path: str) -> list[dict]:
    """CSV or JSONL in the FIELDS schema. Empty cells become None; may_model defaults to true."""
    with open(path, newline="") as f:
        raw = [json.loads(line) for line in f if line.strip()] if path.endswith(".jsonl") else list(csv.DictReader(f))
    rows = []
    for r in raw:
        row = {k: (r.get(k) if r.get(k) not in ("", None) else None) for k in FIELDS}
        for k in INTS:
            row[k] = int(float(row[k])) if row[k] is not None else None
        row["may_model"] = str(row["may_model"]).lower() not in ("false", "0", "no")
        rows.append(row)
    return rows


def from_synthetic(rows: list[dict]) -> list[dict]:
    """synthetic.market() rows in the FIELDS schema. A product is brand, category and era; nothing here is real."""
    return [{**{k: None for k in FIELDS}, **r, "row_id": r["comp_id"], "source": "synthetic", "kind": r["category"],
             "product_id": f"{r['brand']}|{r['category']}|{r['era']}", "family_id": r["category"], "may_model": True}
            for r in rows]


def _sold(rows):
    return [r for r in rows if r["price_type"] == "sold" and (r.get("price_cents") or 0) > 0 and r.get("may_model", True)]


def freeze_of(row: dict) -> tuple[str, str]:
    """D6 step 1: the day before the listing went live; without a listing date, the day before the sale, and said so."""
    if row.get("listed_at"):
        return _iso(ts(row["listed_at"]) - DAY.total_seconds()), "listed"
    return _iso(ts(row["at"]) - DAY.total_seconds()), "sale_date_proxy"


# Contestants ---------------------------------------------------------------------------------------------------------

def _range(prices, ids):
    p = np.asarray(prices, float)
    return {"q10": float(np.quantile(p, 0.1)), "q50": float(np.median(p)), "q90": float(np.quantile(p, 0.9)),
            "shown": True, "comp_ids": ids}


NOT_SHOWN = {"q10": None, "q50": None, "q90": None, "shown": False, "comp_ids": []}


class ProductMedian:
    """The sold median of the same product over the 90 days before the freeze date: what a seller looks up today."""
    name = PRIMARY

    def fit(self, train):
        pass

    def predict(self, item, as_of, history):
        lo = ts(as_of) - WINDOW.total_seconds()
        rs = [r for r in history if r["product_id"] == item["product_id"] and ts(r["at"]) >= lo]
        return _range([r["price_cents"] for r in rs], [r["row_id"] for r in rs]) if rs else dict(NOT_SHOWN)


class LastSale:
    name = "last_sale"

    def fit(self, train):
        pass

    def predict(self, item, as_of, history):
        rs = [r for r in history if r["product_id"] == item["product_id"]]
        if not rs:
            return dict(NOT_SHOWN)
        r = max(rs, key=lambda r: ts(r["at"]))
        return {"q10": r["price_cents"], "q50": r["price_cents"], "q90": r["price_cents"], "shown": True, "comp_ids": [r["row_id"]]}


class Model:
    """The Python market model (market.py), fitted once per test month on rows before the month minus the gap."""
    name = "model"

    def fit(self, train):
        self.m = market.fit(train) if len(_sold(train)) >= 2 * market.MIN_GROUP else None

    def predict(self, item, as_of, history):
        if self.m is None:
            return dict(NOT_SHOWN)
        e = self.m.estimate(item, today=as_of)
        return {"q10": e["low_cents"], "q50": e["median_cents"], "q90": e["high_cents"], "shown": e["shown"], "comp_ids": []}


class Oracle:
    """Plan decision 23: reads the true price. Must score 100%; if it does not, the scorer is broken."""
    name = "oracle"

    def fit(self, train):
        pass

    def predict(self, item, as_of, history):
        y = item["price_cents"]
        return {"q10": y, "q50": y, "q90": y, "shown": True, "comp_ids": []}


class RandomComps:
    """Plan decision 23: the median of 5 random earlier sales of anything. Must not beat the product median."""
    name = "random_comps"

    def __init__(self, seed=7):
        self.rng = np.random.default_rng(seed)

    def fit(self, train):
        pass

    def predict(self, item, as_of, history):
        if len(history) < 5:
            return dict(NOT_SHOWN)
        picks = [history[i] for i in self.rng.choice(len(history), 5, replace=False)]
        return _range([r["price_cents"] for r in picks], [r["row_id"] for r in picks])


# Running -------------------------------------------------------------------------------------------------------------

def run(rows: list[dict], contestants: list, *, test_from: str, log=None) -> list[dict]:
    """One frozen estimate per (test sale, contestant). Test sales are those whose freeze date is on or after test_from."""
    sold = sorted(_sold(rows), key=lambda r: ts(r["at"]))
    times = [ts(r["at"]) for r in sold]
    tests = sorted(((freeze_of(r), r) for r in sold if ts(freeze_of(r)[0]) >= ts(test_from)), key=lambda x: ts(x[0][0]))
    out, month = [], None
    for (as_of, basis), item in tests:
        m = as_of[:7]
        if m != month:
            month = m
            cutoff = ts(f"{m}-01T00:00:00Z") - GAP.total_seconds()
            train = [r for r in rows if ts(r["at"]) < cutoff]
            for c in contestants:
                c.fit(train)
            if log:
                log.stage("experiment", "fit", month=m, train_rows=len(train))
        history = sold[: bisect.bisect_left(times, ts(as_of))]
        for c in contestants:
            out.append({"contestant": c.name, "item_id": item["row_id"], "as_of": as_of, "freeze_basis": basis,
                        **c.predict(item, as_of, history)})
    return out


# Scoring -------------------------------------------------------------------------------------------------------------

def _metrics(pairs):
    """pairs: (y, estimate). Closeness three ways, which side we miss on, the tail, the range, and how often we priced."""
    n = len(pairs)
    shown = [(y, e) for y, e in pairs if e["shown"]]
    if not shown:
        return {"n": n, "priced": 0, "hit_rate": 0.0 if n else None}
    y = np.array([p[0] for p in shown], float)
    q50 = np.array([p[1]["q50"] for p in shown], float)
    err = (q50 - y) / y
    hits = sum(e["q10"] <= v <= e["q90"] for v, e in shown)
    return {
        "n": n, "priced": len(shown), "hit_rate": round(len(shown) / n, 4),
        "within_10": round(float(np.mean(abs(err) <= 0.10)), 4), "within_20": round(float(np.mean(abs(err) <= 0.20)), 4),
        "median_pct_off": round(float(np.median(abs(err))), 4), "median_dollars_off": round(float(np.median(abs(q50 - y))) / 100, 2),
        "bias": round(float(np.median(err)), 4), "sold_above_our_middle": round(float(np.mean(y > q50)), 4),
        "off_by_over_30": round(float(np.mean(abs(err) > 0.30)), 4),
        "coverage": round(hits / len(shown), 4), "coverage_wilson_95": [round(v, 4) for v in _wilson(hits, len(shown))],
    }


def _lift(a, b, products, *, seed=7, draws=1000):
    """Paired within-20% lift of a over b on items both priced; 95% interval by resampling products (decision 16)."""
    keys = sorted(set(products))
    idx = {k: i for i, k in enumerate(keys)}
    diff, cnt = np.zeros(len(keys)), np.zeros(len(keys))
    for da, db, p in zip(a, b, products):
        diff[idx[p]] += da - db
        cnt[idx[p]] += 1
    if not cnt.sum():
        return None
    rng = np.random.default_rng(seed)
    pick = rng.integers(0, len(keys), size=(draws, len(keys)))
    boot = diff[pick].sum(1) / np.maximum(cnt[pick].sum(1), 1)
    return {"diff": round(float(diff.sum() / cnt.sum()), 4), "lo": round(float(np.quantile(boot, 0.025)), 4),
            "hi": round(float(np.quantile(boot, 0.975)), 4), "n_items": int(cnt.sum()), "n_products": len(keys)}


def _ceiling(tests, sold):
    """Decision 8: each test sale against the leave-one-out median of the same product and condition within the same week."""
    by = {}
    for r in sold:
        by.setdefault((r["product_id"], r.get("condition")), []).append(r)
    within, n = 0, 0
    for r in tests:
        peers = [p["price_cents"] for p in by.get((r["product_id"], r.get("condition")), [])
                 if p["row_id"] != r["row_id"] and abs(ts(p["at"]) - ts(r["at"])) <= SAME_WEEK.total_seconds()]
        if len(peers) >= MIN_PEERS:
            n += 1
            within += abs(np.median(peers) - r["price_cents"]) / r["price_cents"] <= 0.20
    return {"n": n, "within_20": round(within / n, 4) if n >= 30 else None, "min_peers": MIN_PEERS}


def _slices(pairs, items):
    out = {}
    for dim in ("kind", "condition", "site"):
        groups = {}
        for (y, e), it in zip(pairs, items):
            groups.setdefault(str(it.get(dim)), []).append((y, e))
        out[dim] = {k: _metrics(v) for k, v in sorted(groups.items())}
    bands = {}
    for y, e in pairs:
        bands.setdefault(_band(e["q50"]) if e["shown"] else "not_priced", []).append((y, e))
    out["price_band_of_our_middle"] = {k: _metrics(bands[k]) for k in (*BANDS, "not_priced") if k in bands}
    return out


def sentence(lift, coverage) -> str:
    """The pre-written conclusion for the primary claim (plan.md §8)."""
    if lift is None or lift["n_items"] < 30:
        return "too few to say"
    if lift["lo"] > 0:
        return "within 20% of the sale price more often than the 90-day sold median"
    if lift["hi"] < 0:
        return "the 90-day sold median beat us on these sales"
    if coverage is not None and 0.75 <= coverage <= 0.85:
        return "as accurate as the 90-day sold median, with a range that held and an honest 'not sure'"
    return "as accurate as the 90-day sold median; our ranges are not yet calibrated"


def score(estimates: list[dict], rows: list[dict], *, primary: str = PRIMARY) -> dict:
    sold = _sold(rows)
    by_id = {r["row_id"]: r for r in sold}
    leaks = check_leakage([{**e, "comp_ids": e.get("comp_ids") or []} for e in estimates if e.get("comp_ids")],
                          [{"comp_id": r["row_id"], "sold_at": r["at"], "may_model": r.get("may_model", True)} for r in sold])
    if leaks:
        raise LeakageError("; ".join(f"{v['route']}: item {v['item_id']} comp {v['comp_id']}" for v in leaks))
    by_c = {}
    for e in estimates:
        by_c.setdefault(e["contestant"], {})[e["item_id"]] = e
    base = by_c.get(primary, {})
    report = {"contestants": {}}
    for name, ests in by_c.items():
        items = [by_id[i] for i in ests]
        pairs = [(it["price_cents"], ests[it["row_id"]]) for it in items]
        ok = lambda e, y: e["shown"] and abs(e["q50"] - y) / y <= 0.20
        both = [(it, ests[it["row_id"]], base[it["row_id"]]) for it in items if it["row_id"] in base
                and ests[it["row_id"]]["shown"] and base[it["row_id"]]["shown"]]
        lift = _lift([ok(e, it["price_cents"]) for it, e, _ in both], [ok(b, it["price_cents"]) for it, _, b in both],
                     [it["product_id"] for it, _, _ in both]) if name != primary else None
        declined = [(it["price_cents"], base[it["row_id"]]) for it in items if not ests[it["row_id"]]["shown"] and it["row_id"] in base]
        priced = [(it["price_cents"], base[it["row_id"]]) for it in items if ests[it["row_id"]]["shown"] and it["row_id"] in base]
        overall = _metrics(pairs)
        report["contestants"][name] = {
            "overall": overall, "lift_vs_primary": lift, "slices": _slices(pairs, items),
            "primary_on_items_we_declined": _metrics(declined) if declined else None,
            "primary_on_items_we_priced": _metrics(priced) if priced else None,
            "freeze_from_sale_date": sum(e["freeze_basis"] == "sale_date_proxy" for e in ests.values()),
        }
    tests = [by_id[i] for i in base] or [by_id[i] for i in next(iter(by_c.values()), {})]
    report["ceiling"] = _ceiling(tests, sold)
    if "model" in report["contestants"]:
        m = report["contestants"]["model"]
        report["sentence"] = sentence(m["lift_vs_primary"], m["overall"].get("coverage"))
    return report


# The duel (plan.md §7) -----------------------------------------------------------------------------------------------

def record_duel(live: list[dict], history: list[dict], contestants: list, *, recorded_at: str) -> dict:
    """Freeze every contestant's answer for live listings now; the hash is the pre-registration."""
    past = sorted((r for r in _sold(history) if ts(r["at"]) < ts(recorded_at)), key=lambda r: ts(r["at"]))
    for c in contestants:
        c.fit([r for r in history if ts(r["at"]) < ts(recorded_at)])
    entries = [{"row_id": r["row_id"], "url": r.get("url"), "product_id": r.get("product_id"), "kind": r.get("kind"),
                "condition": r.get("condition"), "site": r.get("site"), "ask_cents": r.get("price_cents"),
                "estimates": {c.name: c.predict(r, recorded_at, past) for c in contestants}} for r in live]
    body = json.dumps({"recorded_at": recorded_at, "entries": entries}, sort_keys=True)
    return {"recorded_at": recorded_at, "entries": entries, "sha256": hashlib.sha256(body.encode()).hexdigest()}


def score_duel(duel: dict, outcomes: list[dict]) -> dict:
    """Outcomes: {row_id, state: sold|live|ended, price_cents, at}. A sale dated before the record is refused, not scored."""
    rec = ts(duel["recorded_at"])
    last = {}
    for o in sorted(outcomes, key=lambda o: ts(o["at"])):
        last[o["row_id"]] = o
    refused = sum(o["state"] == "sold" and ts(o["at"]) <= rec for o in last.values())
    sold = {k: o for k, o in last.items() if o["state"] == "sold" and ts(o["at"]) > rec}
    by_name = {}
    for e in duel["entries"]:
        if e["row_id"] in sold:
            for name, est in e["estimates"].items():
                by_name.setdefault(name, []).append((sold[e["row_id"]]["price_cents"], est))
    return {"recorded_at": duel["recorded_at"], "sha256": duel["sha256"], "entries": len(duel["entries"]),
            "resolved": len(sold), "refused_sold_before_record": refused,
            "ended_unsold": sum(o["state"] == "ended" for o in last.values()),
            "still_live": len(duel["entries"]) - len(sold) - refused - sum(o["state"] == "ended" for o in last.values()),
            "contestants": {k: _metrics(v) for k, v in by_name.items()}}


# Command line --------------------------------------------------------------------------------------------------------

def _log(kind):
    (ROOT / "logs").mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    return create_log(src="job.valuation.experiment", build=os.environ.get("SECONDHAND_BUILD", "dev"),
                      sink=file_sink(str(ROOT / "logs" / f"experiment-{kind}-{stamp}.jsonl")), config={"kind": kind})


def self_test(log) -> dict:
    """Decision 23 on the synthetic market, whose truth is known. Exit code 1 if the test of the test fails."""
    from valuation import synthetic
    rows = from_synthetic(synthetic.market(n=1500, seed=11))
    ests = run(rows, [Oracle(), RandomComps(seed=3), ProductMedian(), LastSale(), Model()], test_from="2026-08-01T00:00:00Z", log=log)
    rep = score(ests, rows)
    c = rep["contestants"]
    try:
        score([{"contestant": "cheat", "item_id": ests[0]["item_id"], "as_of": ests[0]["as_of"], "q10": 1, "q50": 2, "q90": 3,
                "shown": True, "comp_ids": [max(_sold(rows), key=lambda r: ts(r["at"]))["row_id"]]}], rows)
        leak_refused = False
    except LeakageError:
        leak_refused = True
    checks = {"oracle_scores_100": c["oracle"]["overall"]["within_20"] == 1.0,
              "random_comps_lose_to_product_median": c["random_comps"]["overall"]["within_20"] < c[PRIMARY]["overall"]["within_20"],
              "planted_leak_refused": leak_refused}
    return {"data": "synthetic, not real", "checks": checks, "report": rep}


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["self-test", "backtest", "duel-record", "duel-score"])
    ap.add_argument("--rows")
    ap.add_argument("--live")
    ap.add_argument("--duel")
    ap.add_argument("--outcomes")
    ap.add_argument("--test-from")
    ap.add_argument("--recorded-at", default=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"))
    ap.add_argument("--out")
    a = ap.parse_args(argv)
    log = _log(a.cmd)
    log.job("experiment", a.cmd, "running")
    standard = [ProductMedian(), LastSale(), Model()]
    if a.cmd == "self-test":
        out = self_test(log)
    elif a.cmd == "backtest":
        rows = load(a.rows)
        out = score(run(rows, standard, test_from=a.test_from, log=log), rows)
    elif a.cmd == "duel-record":
        out = record_duel(load(a.live), load(a.rows), standard, recorded_at=a.recorded_at)
    else:
        with open(a.outcomes) as f:
            outcomes = [json.loads(line) for line in f if line.strip()] if a.outcomes.endswith(".jsonl") else list(csv.DictReader(f))
        for o in outcomes:
            o["price_cents"] = int(float(o["price_cents"])) if o.get("price_cents") else None
        out = score_duel(json.load(open(a.duel)), outcomes)
    if a.out:
        Path(a.out).parent.mkdir(parents=True, exist_ok=True)
        Path(a.out).write_text(json.dumps(out, indent=1) + "\n")
    ok = all(out["checks"].values()) if a.cmd == "self-test" else True
    log.job("experiment", a.cmd, "done" if ok else "failed")
    brief = {k: v for k, v in out.items() if k not in ("report", "entries")}
    if a.cmd == "self-test":
        brief["overall"] = {k: v["overall"] for k, v in out["report"]["contestants"].items()}
        brief["ceiling"], brief["sentence"] = out["report"]["ceiling"], out["report"].get("sentence")
    print(json.dumps(brief, indent=1))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
