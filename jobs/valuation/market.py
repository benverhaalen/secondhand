"""Market pricing for any product: a hedonic model, calibrated quantiles, adjusted comps and liquidity, from `comp` rows.

Agent proposal (research/price/ben/pricing-in-context.md, spec/features/price.md "Range", money D1, D3, D5).
Treats a used item like an illiquid asset priced off its market:

1. Hedonic regression on SOLD rows only (money D5: "Live asks enter only as a cap"). log(price) = b0 + one effect per
   attribute level (brand, category, condition, size, era, site) + a time trend, by ridge least squares.
   exp(effect) - 1 is what that attribute is worth against the feature's most common level, with a 90% interval.
2. Quantiles. q10/q50/q90 come from the residual quantiles of the item's category (Mondrian); below MIN_GROUP rows the
   whole market stands in, because comp rows carry no parent category yet (price.md wants the parent).
3. Conformal calibration. Fit on the older sold rows, score the newest CALIB share at their own dates, and widen each
   category's band by the finite-sample quantile of its misses (range-calibration.md §2). The estimate is scored the
   same way, at the date it is asked for, so the band is calibrated on the predictor it serves.
4. Adjusted comps (D1). The nearest sold comps, each moved to the item AND to today by the fitted premiums and trend:
   adjusted = sold x exp(f(item, today) - f(comp, its date)), the appraiser's grid with learned adjustments.
5. Liquidity. Sell-through, days to sell from the queue of competing asks, the ask-to-sold spread, and the ask cap.
6. Shown or not (D5, spec/databricks.md §4.5). `too_few` under 6 similar sales in 12 months or 2 in 90 days;
   `too_wide` when high - low > q50. A hidden range still returns its comps. Ranges round to whole dollars.
   Level: 1 five or more exact sold matches in 90 days; 2 similar sales enough to show; 3 the model alone.

numpy only, deterministic: the nightly Databricks job (deploy/tasks/fold.py -> jobs/valuation/fit.py) and a laptop
give the same answer on the same rows. Money is integer cents at the edges; the model works in log dollars.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone

import numpy as np

from valuation.backtest import conformal_q

FEATURES = ("brand", "category", "condition", "size", "era", "site")
MIN_LEVEL = 3          # guess: a level seen fewer times gets no effect of its own and prices as the baseline
MIN_GROUP = 10         # Mondrian groups below this use the whole market (1/alpha at 80%, range-calibration.md)
CALIB = 0.25           # guess: newest share of sold rows held out to calibrate
RIDGE = 1.0            # guess: shrinks rare levels toward the baseline
ALPHA = 0.20           # an 80% range (money D5)
EXACT_L1 = 5           # guess
SIMILAR = 2            # guess: a comp differing in at most this many of brand, category, condition, size, era is similar
MIN_12M, MIN_90D = 6, 2   # spec/databricks.md §4.5: abstain under 6 sales in 12 months, or 2 in 90 days
DAY = 86400.0


def _t(s: str) -> float:
    d = datetime.fromisoformat(s.replace("Z", "+00:00"))
    return (d if d.tzinfo else d.replace(tzinfo=timezone.utc)).timestamp()


def _level(row: dict, f: str) -> str:
    # "Levi's" and "levis", "T-Shirt" and "t-shirt" are one level.
    v = re.sub(r"[^a-z0-9]+", "", str(row.get(f) or "").lower())
    return v or "unknown"


def _dollars(cents: float) -> int:
    return int(round(cents / 100.0)) * 100


@dataclass
class Design:
    levels: dict[str, list[str]]        # per feature: the fitted levels; levels[f][0] is the baseline
    t0: float                           # time origin (seconds) for the trend
    columns: list[str] = field(default_factory=list)

    @staticmethod
    def build(rows: list[dict]) -> "Design":
        levels = {}
        for f in FEATURES:
            counts: dict[str, int] = {}
            for r in rows:
                counts[_level(r, f)] = counts.get(_level(r, f), 0) + 1
            kept = sorted((k for k, n in counts.items() if n >= MIN_LEVEL), key=lambda k: (-counts[k], k))
            levels[f] = kept or ["unknown"]
        d = Design(levels, max(_t(r["at"]) for r in rows))
        d.columns = ["intercept", "days"] + [f"{f}={v}" for f in FEATURES for v in levels[f][1:]]
        return d

    def row(self, r: dict, at: str) -> np.ndarray:
        x = np.zeros(len(self.columns))
        x[0] = 1.0
        x[1] = (_t(at) - self.t0) / DAY
        for f in FEATURES:
            v = _level(r, f)
            if v in self.levels[f][1:]:
                x[self.columns.index(f"{f}={v}")] = 1.0
        return x


@dataclass
class Hedonic:
    design: Design
    beta: np.ndarray
    se: np.ndarray
    resid: np.ndarray
    groups: list[str]

    @staticmethod
    def fit(sold: list[dict], ridge: float = RIDGE) -> "Hedonic":
        d = Design.build(sold)
        X = np.vstack([d.row(r, r["at"]) for r in sold])
        y = np.log(np.array([r["price_cents"] for r in sold], float) / 100.0)
        P = ridge * np.eye(X.shape[1])
        P[0, 0] = 0.0                      # never shrink the intercept
        A = X.T @ X + P
        beta = np.linalg.solve(A, X.T @ y)
        resid = y - X @ beta
        sigma2 = float(resid @ resid / max(1, len(y) - X.shape[1]))
        Ainv = np.linalg.inv(A)
        se = np.sqrt(np.clip(np.diag(Ainv @ (X.T @ X) @ Ainv) * sigma2, 0, None))
        return Hedonic(d, beta, se, resid, [_level(r, "category") for r in sold])

    def log_point(self, item: dict, at: str) -> float:
        """log dollars of a sale of `item` on date `at`."""
        return float(self.design.row(item, at) @ self.beta)

    def premiums(self) -> list[dict]:
        out = []
        for i, c in enumerate(self.design.columns[1:], start=1):
            b, s = float(self.beta[i]), float(self.se[i])
            per = "per day" if c == "days" else "vs " + self.design.levels[c.split("=")[0]][0]
            out.append({"term": c, "premium": math.expm1(b), "low": math.expm1(b - 1.645 * s), "high": math.expm1(b + 1.645 * s), "relative_to": per})
        return out


def _q(a, q: float) -> float:
    return float(np.quantile(np.asarray(a, float), q)) if len(a) else 0.0


def _bands(h: Hedonic, alpha: float) -> dict[str, tuple[float, float, float]]:
    """Per category (and "*"): residual (q_lo, median, q_hi) in log space."""
    out = {"*": (_q(h.resid, alpha / 2), _q(h.resid, 0.5), _q(h.resid, 1 - alpha / 2))}
    groups = np.array(h.groups)
    for g in set(h.groups):
        r = h.resid[groups == g]
        if len(r) >= MIN_GROUP:
            out[g] = (_q(r, alpha / 2), _q(r, 0.5), _q(r, 1 - alpha / 2))
    return out


def _similar(a: dict, b: dict) -> int:
    return sum(_level(a, f) != _level(b, f) for f in ("brand", "category", "condition", "size", "era"))


@dataclass
class Model:
    hedonic: Hedonic
    band: dict[str, tuple[float, float, float]]
    widen: dict[str, float]
    sold: list[dict]
    asks: list[dict]

    def interval(self, item: dict, at: str) -> tuple[float, float, float]:
        """(q10, q50, q90) in cents for a sale of `item` on `at`."""
        mu = self.hedonic.log_point(item, at)
        g = _level(item, "category")
        lo, mid, hi = self.band.get(g, self.band["*"])
        w = self.widen.get(g, self.widen["*"])
        return math.exp(mu + lo - w) * 100, math.exp(mu + mid) * 100, math.exp(mu + hi + w) * 100

    def estimate(self, item: dict, *, today: str, k: int = 5) -> dict:
        q10, q50, q90 = self.interval(item, today)
        now = _t(today)
        age = lambda r: (now - _t(r["at"])) / DAY
        similar = [r for r in self.sold if _similar(r, item) <= SIMILAR and 0 <= age(r)]
        n_12m, n_90d = sum(age(r) <= 365 for r in similar), sum(age(r) <= 90 for r in similar)
        exact = [r for r in similar if _similar(r, item) == 0 and age(r) <= 90 and _level(r, "size") == _level(item, "size")]
        lo, mid, hi = _dollars(q10), _dollars(q50), _dollars(q90)
        # Ask cap (D5 step 3): new with tags can't be worth more than the cheapest live ask for the same thing.
        caps = [r["price_cents"] for r in self.asks if _similar(r, item) == 0] if _level(item, "condition") == "newwithtags" else []
        if caps:
            hi = min(hi, _dollars(min(caps)))
        hidden = "too_few" if n_12m < MIN_12M or n_90d < MIN_90D else "too_wide" if hi - lo > mid else None
        unseen = [f for f in ("brand", "category") if _level(item, f) not in self.hedonic.design.levels[f]]
        return {
            "low_cents": lo, "median_cents": mid, "high_cents": hi, "shown": hidden is None, "hidden": hidden,
            "level": 1 if len(exact) >= EXACT_L1 else 2 if hidden is None else 3,
            "similar_12m": n_12m, "similar_90d": n_90d, "exact_90d": len(exact),
            "comps": adjusted_comps(self.hedonic, item, self.sold, today=today, k=k),
            "liquidity": liquidity(self.sold + self.asks, item, today=today),
            "unseen": unseen,      # a brand or category the model has no rows for prices at its baseline: say so
            "drivers": [p for p in self.hedonic.premiums() if p["term"] in {f"{f}={_level(item, f)}" for f in FEATURES}],
        }


def adjusted_comps(h: Hedonic, item: dict, sold: list[dict], *, today: str, k: int = 5) -> list[dict]:
    """The k nearest sold comps, each moved to the item and to today: price x exp(f(item, today) - f(comp, its date))."""
    target = h.log_point(item, today)
    scored = []
    for r in sold:
        dist = _similar(r, item) + abs(_t(today) - _t(r["at"])) / DAY / 365
        scored.append((dist, r, r["price_cents"] * math.exp(target - h.log_point(r, r["at"]))))
    scored.sort(key=lambda s: (s[0], s[1].get("comp_id", "")))
    return [{"comp_id": r.get("comp_id"), "site": r.get("site"), "sold_at": r["at"][:10], "price_cents": r["price_cents"],
             "adjusted_cents": int(round(adj)), "distance": round(d, 2), "citation": r.get("url") or r.get("comp_id")}
            for d, r, adj in scored[:k]]


def liquidity(rows: list[dict], item: dict, *, today: str, window_days: int = 90) -> dict:
    """Segment = same brand and category. Sell-through and days to sell from the queue of live asks."""
    seg = [r for r in rows if _level(r, "brand") == _level(item, "brand") and _level(r, "category") == _level(item, "category")]
    now = _t(today)
    sold = [r for r in seg if r.get("price_type") == "sold" and 0 <= (now - _t(r["at"])) / DAY <= window_days]
    asks = [r for r in seg if r.get("price_type") == "asking"]
    per_day = len(sold) / window_days
    sold_med = _q([r["price_cents"] for r in sold], 0.5) if sold else None
    ask_med = _q([r["price_cents"] for r in asks], 0.5) if asks else None
    return {
        "sold_in_window": len(sold), "live_asks": len(asks), "window_days": window_days,
        "sell_through": round(len(sold) / (len(sold) + len(asks)), 3) if sold or asks else None,
        "days_to_sell": round(len(asks) / per_day, 1) if per_day > 0 else None,
        "ask_to_sold_spread": round(ask_med / sold_med - 1, 3) if sold_med and ask_med else None,
    }


def fit(rows: list[dict], alpha: float = ALPHA, calib: float = CALIB) -> Model:
    """Sold rows train; asks only cap and measure liquidity. The newest `calib` share of sold rows calibrates a model
    fitted on the rest; the served model is refitted on all sold rows and keeps the widening learned out of sample."""
    rows = [r for r in rows if r.get("price_cents", 0) > 0 and r.get("at")]
    sold = sorted((r for r in rows if r.get("price_type") == "sold"), key=lambda r: _t(r["at"]))
    asks = [r for r in rows if r.get("price_type") == "asking"]
    n_cal = int(len(sold) * calib) if len(sold) >= 2 * MIN_GROUP else 0
    train, cal = sold[: len(sold) - n_cal], sold[len(sold) - n_cal:]
    widen: dict[str, float] = {"*": 0.0}
    if cal:
        h = Hedonic.fit(train)
        probe = Model(h, _bands(h, alpha), {"*": 0.0}, train, asks)
        scores: dict[str, list[float]] = {}
        for r in cal:
            lo, _, hi = probe.interval(r, r["at"])
            y = r["price_cents"]
            s = max(math.log(lo / y), math.log(y / hi))
            scores.setdefault(_level(r, "category"), []).append(s)
            scores.setdefault("*", []).append(s)
        for g, s in scores.items():
            if g == "*" or len(s) >= MIN_GROUP:
                widen[g] = max(0.0, conformal_q(s, np.ones(len(s)), alpha))
    full = Hedonic.fit(sold)
    return Model(full, _bands(full, alpha), widen, sold, asks)


def backtest(rows: list[dict], test_share: float = 0.2, alpha: float = ALPHA) -> dict:
    """Time-ordered holdout: fit (with its own calibration) on the past, score the newest sold rows at their dates.
    Baseline: the category's median sold price in the training rows (what most price tools show)."""
    sold = sorted((r for r in rows if r.get("price_type") == "sold"), key=lambda r: _t(r["at"]))
    n = max(1, int(len(sold) * test_share))
    test, cut = sold[-n:], _t(sold[-n]["at"])
    past = [r for r in rows if _t(r["at"]) < cut]
    m = fit(past, alpha)
    base: dict[str, list[float]] = {}
    for r in m.sold:
        base.setdefault(_level(r, "category"), []).append(r["price_cents"])
    inside, ape, ape_base = 0, [], []
    for r in test:
        lo, mid, hi = m.interval(r, r["at"])
        y = r["price_cents"]
        inside += lo <= y <= hi
        ape.append(abs(mid - y) / y)
        ape_base.append(abs(float(np.median(base.get(_level(r, "category")) or [y]) - y) / y))
    return {"n_train": len(m.sold), "n_test": len(test), "coverage": inside / len(test), "target_coverage": 1 - alpha,
            "median_ape": float(np.median(ape)), "median_ape_category_median": float(np.median(ape_base))}
