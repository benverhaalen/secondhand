"""The backtest runner of spec/plans/backtest/plan.md: frozen estimates from swappable contestants, scored and sliced.

A contestant is anything with `fit(train_rows)` and `predict(item, as_of, history) -> {q10, q50, q90, shown, comp_ids}`.
The runner hands each one only rows from before the item's freeze date, so the real engine plugs in later and is scored
on the same frozen rows as the baselines. Rows follow the schema in FIELDS (plan.md §6 and decision 32); price_cents
is the item price without shipping, so buyer_shipping_cents is never in the truth (D6 step 3).

  python scripts/bench/backtest.py self-test                           the test of the test, on the synthetic market
  python scripts/bench/backtest.py backtest --rows R --test-from D [--test-to L] --out O
  python scripts/bench/backtest.py duel-record --live L --rows R --out duel.json
  python scripts/bench/backtest.py duel-score --duel duel.json --outcomes O --out O2
(The script prints the summary; this module logs it and writes --out.) Tuning runs use --test-to the lock date; the
locked month is one run with --test-from the lock date, scored once (decisions 3 and 4).
"""
from __future__ import annotations

import argparse
import bisect
import csv
import gzip
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

FIELDS = ("row_id", "source", "licence", "site", "url", "kind", "product_id", "family_id", "cluster_id", "brand",
          "category", "condition", "size", "era", "title", "photo_count", "seller_feedback", "price_type", "price_cents",
          "buyer_shipping_cents", "listed_at", "at", "best_offer", "views", "watchers", "may_model", "at_ask",
          "priced_from_our_number")
INTS = ("price_cents", "buyer_shipping_cents", "photo_count", "seller_feedback", "views", "watchers")
FLAGS = {"may_model": True, "at_ask": False, "priced_from_our_number": False}   # default when a source has no column
GAP = timedelta(days=7)          # money D6 step 1
WINDOW = timedelta(days=90)      # money D6 step 6: the 90-day sold median a seller looks up
SAME_WEEK = timedelta(days=3)    # plan decision 8: a 7-day window, 3 days either side of the sale
MIN_PEERS = 3                    # guess: a median of 1 or 2 peers is itself noisy and would understate the ceiling
MIN_CELL = 30                    # money D6 step 2 and plan decision 16: a smaller cell says "too few"
PRIMARY = "product_90d_median"   # plan decision 10: the headline is paired against the 90-day sold median
DAY = timedelta(days=1)
SEEDS = {"random_comps": 3, "bootstrap": 7, "sample": 5}   # logged in config, so a run can be replayed
DRAWS = 1000                     # guess: bootstrap draws for the lift interval


def ts(s: str) -> float:
    return market._t(s)


def _iso(t: float) -> str:
    return datetime.fromtimestamp(t, timezone.utc).isoformat().replace("+00:00", "Z")


def _flag(v, default):
    return default if v in ("", None) else str(v).lower() not in ("false", "0", "no")


def load(path: str) -> list[dict]:
    """CSV or JSONL in the FIELDS schema. Empty cells become None; flags take FLAGS' defaults."""
    opener = gzip.open if path.endswith(".gz") else open
    with opener(path, "rt", newline="") as f:
        raw = [json.loads(line) for line in f if line.strip()] if ".jsonl" in path else list(csv.DictReader(f))
    rows = []
    for r in raw:
        row = {k: (r.get(k) if r.get(k) not in ("", None) else None) for k in FIELDS}
        for k in INTS:
            row[k] = int(float(row[k])) if row[k] is not None else None
        for k, d in FLAGS.items():
            row[k] = _flag(r.get(k), d)
        rows.append(row)
    return rows


def from_synthetic(rows: list[dict]) -> list[dict]:
    """synthetic.market() rows in the FIELDS schema. A product is brand, category and era; nothing here is real."""
    return [{**{k: None for k in FIELDS}, **FLAGS, **r, "row_id": r["comp_id"], "source": "synthetic", "kind": r["category"],
             "product_id": f"{r['brand']}|{r['category']}|{r['era']}", "family_id": r["category"]} for r in rows]


def _usable(rows):
    """Rows any contestant may learn from: the source allows modelling (decision 32)."""
    return [r for r in rows if r.get("may_model", True)]


def _sold(rows):
    return [r for r in _usable(rows) if r["price_type"] == "sold" and (r.get("price_cents") or 0) > 0]


def freeze_of(row: dict) -> tuple[str, str]:
    """D6 step 1: the day before the listing went live; without a listing date, the day before the sale, and said so."""
    if row.get("listed_at"):
        return _iso(ts(row["listed_at"]) - DAY.total_seconds()), "listed"
    return _iso(ts(row["at"]) - DAY.total_seconds()), "sale_date_proxy"


# History: what a contestant may see -------------------------------------------------------------------------------

class History:
    """Usable sales strictly before one freeze date, minus the item's own cluster. Lookups by product are a bisect on
    an index built once, so a run over 100,000 sales does not rescan every sale for every item."""

    def __init__(self, index, cut, cluster=None):
        self.index, self.cut, self.cluster = index, cut, cluster

    def _ok(self, rs):
        return [r for r in rs if not self.cluster or r.get("cluster_id") != self.cluster]

    def product(self, pid):
        rows, times = self.index["by_product"].get(pid, ([], []))
        return self._ok(rows[: bisect.bisect_left(times, self.cut)])

    def __len__(self):
        return bisect.bisect_left(self.index["times"], self.cut)

    def sample(self, rng, k):
        return self._ok([self.index["sold"][i] for i in rng.choice(len(self), k, replace=False)])

    def latest_at(self):
        return self.index["times"][len(self) - 1] if len(self) else 0.0


def index_of(rows):
    sold = sorted(_sold(rows), key=lambda r: ts(r["at"]))
    by = {}
    for r in sold:
        rs, tt = by.setdefault(r["product_id"], ([], []))
        rs.append(r)
        tt.append(ts(r["at"]))
    return {"sold": sold, "times": [ts(r["at"]) for r in sold], "by_product": by}


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
        rs = [r for r in history.product(item["product_id"]) if ts(r["at"]) >= lo]
        return _range([r["price_cents"] for r in rs], [r["row_id"] for r in rs]) if rs else dict(NOT_SHOWN)


class LastSale:
    name = "last_sale"

    def fit(self, train):
        pass

    def predict(self, item, as_of, history):
        rs = history.product(item["product_id"])
        if not rs:
            return dict(NOT_SHOWN)
        r = rs[-1]
        return {"q10": r["price_cents"], "q50": r["price_cents"], "q90": r["price_cents"], "shown": True, "comp_ids": [r["row_id"]]}


class Model:
    """The Python market model (market.py), fitted once per test month on rows before the month minus the gap.
    Its range is market's calibrated interval; it abstains on market's own counts (fewer than MIN_12M sales of the
    product in 12 months or MIN_90D in 90 days), read from the product index rather than market.estimate's full scan,
    which is too slow for 100,000 test sales. Its middle starts from the product's own last sales in the frozen history
    (market's anchor), and those sales are its comp_ids, so the leak check covers them."""
    name = "model"

    def fit(self, train):
        self.m = market.fit(train) if len(_sold(train)) >= 2 * market.MIN_GROUP else None

    def predict(self, item, as_of, history):
        if self.m is None:
            return dict(NOT_SHOWN)
        now, rs = ts(as_of), history.product(item["product_id"])
        used = [r for r in rs if 0 < now - ts(r["at"]) <= market.ANCHOR_DAYS * 86400][-market.ANCHOR_K:] if self.m.anchor else []
        q10, q50, q90 = self.m.interval(item, as_of, recent=used)
        n12 = sum(now - ts(r["at"]) <= 365 * 86400 for r in rs)
        n90 = sum(now - ts(r["at"]) <= 90 * 86400 for r in rs)
        shown = n12 >= market.MIN_12M and n90 >= market.MIN_90D and q90 - q10 <= q50
        return {"q10": q10, "q50": q50, "q90": q90, "shown": shown, "comp_ids": [r["row_id"] for r in used]}


class Oracle:
    """Plan decision 23: reads the true price. Must score 100%; if it does not, the scorer is broken."""
    name = "oracle"

    def fit(self, train):
        pass

    def predict(self, item, as_of, history):
        y = item["price_cents"]
        return {"q10": y, "q50": y, "q90": y, "shown": True, "comp_ids": []}


class RandomComps:
    """Plan decision 23's shuffled comps: the median of 5 random earlier sales of anything. Must lose to the product median."""
    name = "random_comps"

    def __init__(self, seed=SEEDS["random_comps"]):
        self.rng = np.random.default_rng(seed)

    def fit(self, train):
        pass

    def predict(self, item, as_of, history):
        if len(history) < 5:
            return dict(NOT_SHOWN)
        picks = history.sample(self.rng, 5)
        return _range([r["price_cents"] for r in picks], [r["row_id"] for r in picks])


# Running -------------------------------------------------------------------------------------------------------------

def _tests(rows, test_from, test_to):
    """Sales in [test_from, test_to), each frozen the day before listing, but never before test_from (decision 4).
    Left out and counted: hidden Best Offer prices (decision 6), and sales at our ask or priced from our number, which
    D6 step 7 reports apart from the headline."""
    lo, hi = ts(test_from), ts(test_to) if test_to else float("inf")
    sold = [r for r in _sold(rows) if lo <= ts(r["at"]) < hi]
    left_out = {"best_offer_hidden": [r for r in sold if r.get("best_offer") == "hidden"],
                "at_our_ask_or_number": [r for r in sold if r.get("at_ask") or r.get("priced_from_our_number")]}
    skip = {r["row_id"] for rs in left_out.values() for r in rs}
    out = []
    for r in sold:
        if r["row_id"] in skip:
            continue
        as_of, basis = freeze_of(r)
        if ts(as_of) < lo:
            as_of, basis = test_from, basis + "_clamped_to_test_from"
        out.append((as_of, basis, r))
    return sorted(out, key=lambda x: ts(x[0])), {k: len(v) for k, v in left_out.items()}


def run(rows: list[dict], contestants: list, *, test_from: str, test_to: str | None = None, sample: int | None = None,
        log=None) -> list[dict]:
    """One frozen estimate per (test sale, contestant). Each contestant is fitted per freeze month on usable rows
    before the month minus the gap, and predicts from usable sales strictly before the freeze date."""
    index = index_of(rows)
    tests, left_out = _tests(rows, test_from, test_to)
    if sample and len(tests) > sample:
        keep = set(np.random.default_rng(SEEDS["sample"]).choice(len(tests), sample, replace=False).tolist())
        tests = [t for i, t in enumerate(tests) if i in keep]
    if log:
        log.stage("experiment", "tests", n=len(tests), left_out=left_out)
    out, month = [], None
    for as_of, basis, item in tests:
        if as_of[:7] != month:
            month = as_of[:7]
            cutoff = ts(f"{month}-01T00:00:00Z") - GAP.total_seconds()
            train = [r for r in _usable(rows) if ts(r["at"]) < cutoff]
            for c in contestants:
                c.fit(train)
            if log:
                log.stage("experiment", "fit", month=month, train_rows=len(train))
        history = History(index, ts(as_of), item.get("cluster_id"))   # an item's own relists are never its comps (decision 5)
        for c in contestants:
            out.append({"contestant": c.name, "item_id": item["row_id"], "as_of": as_of, "freeze_basis": basis,
                        **c.predict(item, as_of, history)})
    return out


# Scoring -------------------------------------------------------------------------------------------------------------

def _metrics(pairs, min_n=1):
    """pairs: (y, estimate). Closeness three ways, which side we miss on, the tail, the range and its width, and how
    often we priced. Under min_n priced, only the counts and "too few"."""
    n = len(pairs)
    shown = [(y, e) for y, e in pairs if e["shown"]]
    head = {"n": n, "priced": len(shown), "hit_rate": round(len(shown) / n, 4) if n else None}
    if len(shown) < max(min_n, 1):
        return {**head, "too_few": True}
    y = np.array([p[0] for p in shown], float)
    q50 = np.array([p[1]["q50"] for p in shown], float)
    width = np.array([(p[1]["q90"] - p[1]["q10"]) / p[1]["q50"] for p in shown], float)
    err = (q50 - y) / y
    hits = sum(e["q10"] <= v <= e["q90"] for v, e in shown)
    return {
        **head,
        "within_10": round(float(np.mean(abs(err) <= 0.10)), 4), "within_20": round(float(np.mean(abs(err) <= 0.20)), 4),
        "median_pct_off": round(float(np.median(abs(err))), 4), "median_dollars_off": round(float(np.median(abs(q50 - y))) / 100, 2),
        "bias": round(float(np.median(err)), 4), "sold_above_our_middle": round(float(np.mean(y > q50)), 4),
        "off_by_over_30": round(float(np.mean(abs(err) > 0.30)), 4),
        "coverage": round(hits / len(shown), 4), "coverage_wilson_95": [round(v, 4) for v in _wilson(hits, len(shown))],
        "median_range_width": round(float(np.median(width)), 4),
    }


def _lift(a, b, products, *, seed=SEEDS["bootstrap"], draws=DRAWS):
    """Paired within-20% lift of a over b on items both priced; 95% interval by resampling products (decision 16)."""
    keys = sorted(set(products))
    idx = {k: i for i, k in enumerate(keys)}
    diff, cnt = np.zeros(len(keys)), np.zeros(len(keys))
    for da, db, p in zip(a, b, products):
        diff[idx[p]] += da - db
        cnt[idx[p]] += 1
    if not cnt.sum():
        return None
    pick = np.random.default_rng(seed).integers(0, len(keys), size=(draws, len(keys)))
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
    if n < MIN_CELL:
        return {"n": n, "within_20": None, "too_few": True, "min_peers": MIN_PEERS}
    return {"n": n, "within_20": round(within / n, 4), "wilson_95": [round(v, 4) for v in _wilson(within, n)], "min_peers": MIN_PEERS}


def _slices(pairs, items, as_ofs):
    out = {}
    keys = {"kind": lambda it, a: it.get("kind"), "condition": lambda it, a: it.get("condition"),
            "site": lambda it, a: it.get("site"), "month": lambda it, a: a[:7]}
    for dim, key in keys.items():
        groups = {}
        for p, it, a in zip(pairs, items, as_ofs):
            groups.setdefault(str(key(it, a)), []).append(p)
        out[dim] = {k: _metrics(v, MIN_CELL) for k, v in sorted(groups.items())}
    bands = {}
    for y, e in pairs:
        bands.setdefault(_band(e["q50"]) if e["shown"] else "not_priced", []).append((y, e))
    out["price_band_of_our_middle"] = {k: _metrics(bands[k], MIN_CELL) for k in (*BANDS, "not_priced") if k in bands}
    return out


def sentence(lift, ours, theirs, coverage) -> str:
    """The pre-written conclusion for the primary claim (plan.md §8), keyed on the interval, never the point estimate."""
    if lift is None or lift["n_items"] < MIN_CELL:
        return f"{0 if lift is None else lift['n_items']} sales scored so far; too few to say"
    n, x, y = lift["n_items"], round(100 * ours), round(100 * theirs)
    if lift["lo"] > 0:
        return f"On {n} sales, within 20% of the sale price {x}% of the time, against {y}% for the 90-day sold median"
    if lift["hi"] < 0:
        return f"On {n} sales, the 90-day sold median beat us: {y}% within 20% against our {x}%"
    if coverage is not None and 0.75 <= coverage <= 0.85:
        return f"On {n} sales, as accurate as the 90-day sold median ({x}% against {y}% within 20%), with a range that held {round(100 * coverage)}% of the time"
    return f"On {n} sales, as accurate as the 90-day sold median ({x}% against {y}% within 20%); our ranges are not yet calibrated"


def _check_leaks(estimates, sold):
    """backtest.check_leakage over every route it knows: future comps, the target itself, may_model, sales at our ask
    or priced from our number, and relists by cluster (decision 5, D6 steps 1 and 7)."""
    leaks = check_leakage([{**e, "comp_ids": e.get("comp_ids") or []} for e in estimates],
                          [{"comp_id": r["row_id"], "sold_at": r["at"], "may_model": r.get("may_model", True),
                            "cluster_id": r.get("cluster_id"), "at_ask": r.get("at_ask"),
                            "priced_from_our_number": r.get("priced_from_our_number")} for r in sold])
    if leaks:
        raise LeakageError("; ".join(f"{v['route']}: item {v['item_id']} comp {v['comp_id']}" for v in leaks))


def score(estimates: list[dict], rows: list[dict], *, primary: str = PRIMARY) -> dict:
    sold = [r for r in rows if r["price_type"] == "sold" and (r.get("price_cents") or 0) > 0]
    _check_leaks(estimates, sold)
    by_id = {r["row_id"]: r for r in sold}
    by_c = {}
    for e in estimates:
        by_c.setdefault(e["contestant"], {})[e["item_id"]] = e
    base = by_c.get(primary, {})
    ok = lambda e, y: e["shown"] and abs(e["q50"] - y) / y <= 0.20
    report = {"contestants": {}}
    for name, ests in by_c.items():
        items = [by_id[i] for i in ests]
        pairs = [(it["price_cents"], ests[it["row_id"]]) for it in items]
        both = [(it, ests[it["row_id"]], base[it["row_id"]]) for it in items if it["row_id"] in base
                and ests[it["row_id"]]["shown"] and base[it["row_id"]]["shown"]]
        a = [ok(e, it["price_cents"]) for it, e, _ in both]
        b = [ok(x, it["price_cents"]) for it, _, x in both]
        lift = _lift(a, b, [it["product_id"] for it, _, _ in both]) if name != primary else None
        declined = [(it["price_cents"], base[it["row_id"]]) for it in items if not ests[it["row_id"]]["shown"] and it["row_id"] in base]
        priced = [(it["price_cents"], base[it["row_id"]]) for it in items if ests[it["row_id"]]["shown"] and it["row_id"] in base]
        overall = _metrics(pairs)
        report["contestants"][name] = {
            "overall": overall, "lift_vs_primary": lift,
            "within_20_on_shared_items": {"ours": float(np.mean(a)) if a else None, "primary": float(np.mean(b)) if b else None},
            "slices": _slices(pairs, items, [ests[it["row_id"]]["as_of"] for it in items]),
            "primary_on_items_we_declined": _metrics(declined, MIN_CELL),
            "primary_on_items_we_priced": _metrics(priced, MIN_CELL),
            "freeze_basis": {k: sum(e["freeze_basis"] == k for e in ests.values()) for k in sorted({e["freeze_basis"] for e in ests.values()})},
        }
    tests = [by_id[i] for i in (base or next(iter(by_c.values()), {}))]
    report["ceiling"] = _ceiling(tests, sold)
    if "model" in report["contestants"]:
        m = report["contestants"]["model"]
        s = m["within_20_on_shared_items"]
        report["sentence"] = sentence(m["lift_vs_primary"], s["ours"] or 0, s["primary"] or 0, m["overall"].get("coverage"))
    return report


# The duel (plan.md §7) -----------------------------------------------------------------------------------------------

def _duel_hash(recorded_at, entries):
    return hashlib.sha256(json.dumps({"recorded_at": recorded_at, "entries": entries}, sort_keys=True).encode()).hexdigest()


def record_duel(live: list[dict], history: list[dict], contestants: list, *, recorded_at: str) -> dict:
    """Freeze every contestant's answer for live listings now, with each listing's inputs, so a later engine can be
    scored on the same listings (plan.md §8). The hash is the pre-registration."""
    usable = [r for r in _usable(history) if ts(r["at"]) < ts(recorded_at)]
    past = History(index_of(usable), ts(recorded_at))
    for c in contestants:
        c.fit(usable)
    entries = [{"row_id": r["row_id"], "item": {k: r.get(k) for k in FIELDS if k != "price_type"},
                "ask_cents": r.get("price_cents"), "estimates": {c.name: c.predict(r, recorded_at, past) for c in contestants}}
               for r in live]
    return {"recorded_at": recorded_at, "entries": entries, "sha256": _duel_hash(recorded_at, entries)}


def score_duel(duel: dict, outcomes: list[dict]) -> dict:
    """Outcomes: {row_id, state: sold|live|ended, price_cents, at}, the latest per listing wins. Refuses a duel whose
    hash does not match; a sale dated on or before the record is refused, not scored; outcomes for other rows are ignored."""
    if _duel_hash(duel["recorded_at"], duel["entries"]) != duel["sha256"]:
        raise ValueError("the duel file changed after it was recorded")
    rec, ids = ts(duel["recorded_at"]), {e["row_id"] for e in duel["entries"]}
    last = {}
    for o in sorted((o for o in outcomes if o["row_id"] in ids), key=lambda o: ts(o["at"])):
        last[o["row_id"]] = o
    refused = {k for k, o in last.items() if o["state"] == "sold" and ts(o["at"]) <= rec}
    sold = {k: o for k, o in last.items() if o["state"] == "sold" and k not in refused}
    ended = {k for k, o in last.items() if o["state"] == "ended"}
    by_name = {}
    for e in duel["entries"]:
        if e["row_id"] in sold:
            for name, est in e["estimates"].items():
                by_name.setdefault(name, []).append((sold[e["row_id"]]["price_cents"], est))
    return {"recorded_at": duel["recorded_at"], "sha256": duel["sha256"], "entries": len(ids), "resolved": len(sold),
            "refused_sold_before_record": len(refused), "ended_unsold": len(ended),
            "still_live": len(ids) - len(sold) - len(refused) - len(ended),
            "contestants": {k: _metrics(v) for k, v in by_name.items()}}


# Command line --------------------------------------------------------------------------------------------------------

def _log(kind, config):
    (ROOT / "logs").mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    return create_log(src="job.valuation.experiment", build=os.environ.get("SECONDHAND_BUILD", "dev"),
                      sink=file_sink(str(ROOT / "logs" / f"experiment-{kind}-{stamp}.jsonl")),
                      config={"kind": kind, "seeds": SEEDS, "draws": DRAWS, **config})


def self_test(log) -> dict:
    """Decision 23 on the synthetic market, whose truth is known. Exit code 1 if the test of the test fails."""
    from valuation import synthetic
    rows = from_synthetic(synthetic.market(n=1500, seed=11))
    ests = run(rows, [Oracle(), RandomComps(), ProductMedian(), LastSale(), Model()], test_from="2026-08-01T00:00:00Z", log=log)
    rep = score(ests, rows)
    c = rep["contestants"]
    try:
        score([{"contestant": "cheat", "item_id": ests[0]["item_id"], "as_of": ests[0]["as_of"], "q10": 1, "q50": 2, "q90": 3,
                "shown": True, "comp_ids": [max(_sold(rows), key=lambda r: ts(r["at"]))["row_id"]]}], rows)
        leak_refused = False
    except LeakageError:
        leak_refused = True
    o = c["oracle"]["overall"]
    checks = {"oracle_scores_100": o["within_20"] == 1.0 and o["coverage"] == 1.0,
              "random_comps_lose_to_product_median": c["random_comps"]["overall"]["within_20"] < c[PRIMARY]["overall"]["within_20"],
              "planted_leak_refused": leak_refused}
    return {"data": "synthetic, not real", "checks": checks, "report": rep}


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["self-test", "backtest", "duel-record", "duel-score"])
    for k in ("--rows", "--live", "--duel", "--outcomes", "--test-from", "--test-to", "--out"):
        ap.add_argument(k)
    ap.add_argument("--sample", type=int, help="score a seeded random sample of this many test sales")
    ap.add_argument("--recorded-at", default=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"))
    a = ap.parse_args(argv)
    log = _log(a.cmd, {k: v for k, v in vars(a).items() if k != "cmd" and v})
    log.job("experiment", a.cmd, "running")
    standard = [ProductMedian(), LastSale(), Model()]
    try:
        if a.cmd == "self-test":
            out = self_test(log)
        elif a.cmd == "backtest":
            rows = load(a.rows)
            out = score(run(rows, standard, test_from=a.test_from, test_to=a.test_to, sample=a.sample, log=log), rows)
        elif a.cmd == "duel-record":
            out = record_duel(load(a.live), load(a.rows), standard, recorded_at=a.recorded_at)
        else:
            with open(a.outcomes, newline="") as f:
                outcomes = [json.loads(line) for line in f if line.strip()] if a.outcomes.endswith(".jsonl") else list(csv.DictReader(f))
            for o in outcomes:
                o["price_cents"] = int(float(o["price_cents"])) if o.get("price_cents") else None
            out = score_duel(json.loads(Path(a.duel).read_text()), outcomes)
    except (LeakageError, ValueError) as e:
        log.error("experiment." + a.cmd, e)
        log.job("experiment", a.cmd, "failed")
        raise
    if a.out:
        Path(a.out).parent.mkdir(parents=True, exist_ok=True)
        Path(a.out).write_text(json.dumps(out, indent=1) + "\n")
    ok = all(out["checks"].values()) if a.cmd == "self-test" else True
    brief = {k: v for k, v in out.items() if k not in ("report", "entries")}
    if a.cmd == "self-test":
        brief["overall"] = {k: v["overall"] for k, v in out["report"]["contestants"].items()}
        brief["ceiling"], brief["sentence"] = out["report"]["ceiling"], out["report"].get("sentence")
    log.job("experiment", a.cmd, "done" if ok else "failed", summary=brief)
    return (0 if ok else 1), brief


if __name__ == "__main__":
    sys.exit(main()[0])
