"""Market pricing for any product: a hedonic model, calibrated quantiles, adjusted comps and liquidity, from `comp` rows.

Agent proposal (research/price/ben/pricing-in-context.md, spec/features/price.md "Range", spec/databricks.md data path).
Treats a used item like an illiquid asset priced off its market:

1. Hedonic regression. log(price) = b0 + one effect per attribute level (brand, category, condition, size, era, site)
   + an asking-price premium + a time trend, fitted by ridge least squares. exp(effect) - 1 is what that attribute is
   worth relative to the most common level, with a standard error, so "Champion adds 18%" is a fitted, cited number.
2. Quantiles. The model's residuals give the spread around its point; q10/q50/q90 come from the residual quantiles of
   the item's category (Mondrian), with the whole market as the fallback below MIN_GROUP rows.
3. Conformal calibration (CQR). Fit on the older rows, score the newest CALIB share, and widen each category's band by
   the finite-sample quantile of its misses, so an 80% range holds about 80% of the next sales (range-calibration.md).
4. Adjusted comps. The nearest sold comps, each moved to the target with the fitted premiums (the appraiser's grid,
   with learned adjustments instead of guessed ones), shown with their citations.
5. Liquidity. Sell-through, days to sell from the queue of competing asks, and the ask-to-sold spread of the segment.
6. Level. 1: five or more exact sold matches in 90 days; 2: enough adjusted similar sales; 3: model only.

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
MIN_LEVEL = 3          # a level seen fewer times is pooled into "other" (no effect is fitted from one or two sales)
MIN_GROUP = 10         # Mondrian groups below this fall back to the whole market (1/alpha at 80%, range-calibration.md)
CALIB = 0.25           # newest share of sold rows held out to calibrate
RIDGE = 1.0            # shrinks rare levels toward the baseline
ALPHA = 0.20           # an 80% range
EXACT_L1 = 5
N_EFF_L2 = 6           # spec/databricks.md: abstain under 6 sales in 12 months
DAY = 86400.0


def _t(s: str) -> float:
    d = datetime.fromisoformat(s.replace("Z", "+00:00"))
    return (d if d.tzinfo else d.replace(tzinfo=timezone.utc)).timestamp()


def _level(row: dict, f: str) -> str:
    # "Levi's" and "levis", "T-Shirt" and "t-shirt" are one level.
    v = re.sub(r"[^a-z0-9]+", "", str(row.get(f) or "").lower())
    return v or "unknown"


@dataclass
class Design:
    levels: dict[str, list[str]]        # per feature: the fitted levels; levels[f][0] is the baseline
    t0: float                           # time origin (seconds) for the trend, in days from here
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
        t0 = max(_t(r["at"]) for r in rows)
        d = Design(levels, t0)
        d.columns = ["intercept", "asking", "days"] + [f"{f}={v}" for f in FEATURES for v in levels[f][1:]]
        return d

    def row(self, r: dict, *, asking: bool | None = None) -> np.ndarray:
        x = np.zeros(len(self.columns))
        x[0] = 1.0
        x[1] = float(r.get("price_type") == "asking") if asking is None else float(asking)
        x[2] = (_t(r["at"]) - self.t0) / DAY if r.get("at") else 0.0
        for f in FEATURES:
            v = _level(r, f)
            if v in self.levels[f][1:]:
                x[self.columns.index(f"{f}={v}")] = 1.0
        return x

    def matrix(self, rows: list[dict]) -> np.ndarray:
        return np.vstack([self.row(r) for r in rows])


@dataclass
class Hedonic:
    design: Design
    beta: np.ndarray
    se: np.ndarray
    sigma: float
    resid: np.ndarray
    groups: list[str]

    @staticmethod
    def fit(rows: list[dict], ridge: float = RIDGE) -> "Hedonic":
        d = Design.build(rows)
        X = d.matrix(rows)
        y = np.log(np.array([r["price_cents"] for r in rows], float) / 100.0)
        P = ridge * np.eye(X.shape[1])
        P[0, 0] = 0.0                      # never shrink the intercept
        A = X.T @ X + P
        beta = np.linalg.solve(A, X.T @ y)
        resid = y - X @ beta
        dof = max(1, len(y) - X.shape[1])
        sigma = float(np.sqrt(resid @ resid / dof))
        Ainv = np.linalg.inv(A)
        se = np.sqrt(np.clip(np.diag(Ainv @ (X.T @ X) @ Ainv) * sigma**2, 0, None))
        return Hedonic(d, beta, se, sigma, resid, [_level(r, "category") for r in rows])

    def log_point(self, item: dict, at: str | None = None) -> float:
        # The price of a sale today (asking premium off), unless a date is given.
        r = {**item, "at": at} if at else {**item, "at": None}
        x = self.design.row(r, asking=False)
        return float(x @ self.beta)

    def premiums(self) -> list[dict]:
        out = []
        for i, c in enumerate(self.design.columns):
            if c == "intercept":
                continue
            b, s = float(self.beta[i]), float(self.se[i])
            per = "per day" if c == "days" else "vs " + (self.design.levels[c.split("=")[0]][0] if "=" in c else "a sale")
            out.append({"term": c, "premium": math.expm1(b), "low": math.expm1(b - 1.645 * s), "high": math.expm1(b + 1.645 * s), "relative_to": per})
        return out


def _q(a: np.ndarray, q: float) -> float:
    return float(np.quantile(a, q)) if len(a) else 0.0


@dataclass
class Model:
    hedonic: Hedonic
    band: dict[str, tuple[float, float, float]]   # per category (and "*"): residual (q_lo, median, q_hi) in log space
    widen: dict[str, float]                   # per category (and "*"): the conformal widening in log space
    rows: list[dict]
    calib_coverage: float
    n_train: int
    n_calib: int

    def _key(self, d: dict, item: dict) -> str:
        g = _level(item, "category")
        return g if g in d else "*"

    def estimate(self, item: dict, *, today: str, k: int = 5) -> dict:
        h = self.hedonic
        mu = h.log_point(item)
        lo, mid, hi = self.band[self._key(self.band, item)]
        w = self.widen[self._key(self.widen, item)]
        q10, q50, q90 = math.exp(mu + lo - w), math.exp(mu + mid), math.exp(mu + hi + w)
        sold = [r for r in self.rows if r.get("price_type") == "sold"]
        comps = adjusted_comps(h, item, sold, today=today, k=k)
        liq = liquidity(self.rows, item, today=today)
        exact = [r for r in sold if all(_level(r, f) == _level(item, f) for f in ("brand", "category", "condition", "size"))
                 and (_t(today) - _t(r["at"])) / DAY <= 90]
        n_eff = len([c for c in comps if c["distance"] <= 2])
        level = 1 if len(exact) >= EXACT_L1 else 2 if n_eff >= N_EFF_L2 or len(sold) >= 50 else 3
        unseen = [f for f in ("brand", "category") if _level(item, f) not in h.design.levels[f]]
        return {
            "q10_cents": int(round(q10 * 100)), "q50_cents": int(round(q50 * 100)), "q90_cents": int(round(q90 * 100)),
            "level": level, "exact_sold_90d": len(exact), "comps": comps, "liquidity": liq,
            "unseen": unseen,      # a brand or category the model has no rows for: priced at its baseline, so say so
            "drivers": [p for p in h.premiums() if p["term"] in {f"{f}={_level(item, f)}" for f in FEATURES}],
        }


def adjusted_comps(h: Hedonic, item: dict, sold: list[dict], *, today: str, k: int = 5) -> list[dict]:
    """The k nearest sold comps, each moved to the target by the fitted premiums: price x exp(f(target) - f(comp))."""
    target = h.log_point(item)
    scored = []
    for r in sold:
        dist = sum(_level(r, f) != _level(item, f) for f in ("brand", "category", "condition", "size", "era")) + \
            (_t(today) - _t(r["at"])) / DAY / 365
        adj = r["price_cents"] * math.exp(target - h.log_point(r))
        scored.append((dist, r, adj))
    scored.sort(key=lambda s: (s[0], s[1].get("comp_id", "")))
    return [{"comp_id": r.get("comp_id"), "site": r.get("site"), "sold_at": r["at"][:10], "price_cents": r["price_cents"],
             "adjusted_cents": int(round(adj)), "distance": round(d, 2), "citation": r.get("url") or r.get("comp_id")}
            for d, r, adj in scored[:k]]


def liquidity(rows: list[dict], item: dict, *, today: str, window_days: int = 90) -> dict:
    """Segment = same brand and category. Sell-through and days to sell from the queue of live asks."""
    seg = [r for r in rows if _level(r, "brand") == _level(item, "brand") and _level(r, "category") == _level(item, "category")]
    now = _t(today)
    sold = [r for r in seg if r.get("price_type") == "sold" and (now - _t(r["at"])) / DAY <= window_days]
    asks = [r for r in seg if r.get("price_type") == "asking"]
    per_day = len(sold) / window_days
    sold_med = _q(np.array([r["price_cents"] for r in sold], float), 0.5) if sold else None
    ask_med = _q(np.array([r["price_cents"] for r in asks], float), 0.5) if asks else None
    return {
        "sold_in_window": len(sold), "live_asks": len(asks), "window_days": window_days,
        "sell_through": round(len(sold) / (len(sold) + len(asks)), 3) if sold or asks else None,
        "days_to_sell": round(len(asks) / per_day, 1) if per_day > 0 else None,
        "ask_to_sold_spread": round(ask_med / sold_med - 1, 3) if sold_med and ask_med else None,
    }


def _bands(h: Hedonic, alpha: float) -> dict[str, tuple[float, float, float]]:
    out = {"*": (_q(h.resid, alpha / 2), _q(h.resid, 0.5), _q(h.resid, 1 - alpha / 2))}
    groups = np.array(h.groups)
    for g in set(h.groups):
        r = h.resid[groups == g]
        if len(r) >= MIN_GROUP:
            out[g] = (_q(r, alpha / 2), _q(r, 0.5), _q(r, 1 - alpha / 2))
    return out


def fit(rows: list[dict], alpha: float = ALPHA, calib: float = CALIB) -> Model:
    """Fit on all but the newest `calib` share of sold rows (asks always train), calibrate on those, then refit on
    everything for the point and bands while keeping the widening learned out of sample."""
    rows = [r for r in rows if r.get("price_cents", 0) > 0 and r.get("at")]
    sold = sorted((r for r in rows if r.get("price_type") == "sold"), key=lambda r: _t(r["at"]))
    n_cal = int(len(sold) * calib) if len(sold) >= 2 * MIN_GROUP else 0
    cal = sold[len(sold) - n_cal:] if n_cal else []
    held = {id(r) for r in cal}
    train = [r for r in rows if id(r) not in held]
    h = Hedonic.fit(train)
    bands = _bands(h, alpha)
    widen: dict[str, float] = {"*": 0.0}
    covered = 0
    if cal:
        scores: dict[str, list[float]] = {}
        for r in cal:
            g = _level(r, "category")
            lo, _, hi = bands.get(g, bands["*"])
            mu = h.log_point(r, at=r["at"])
            y = math.log(r["price_cents"] / 100)
            s = max(mu + lo - y, y - (mu + hi))
            scores.setdefault(g, []).append(s)
            scores.setdefault("*", []).append(s)
        for g, s in scores.items():
            if g == "*" or len(s) >= MIN_GROUP:
                widen[g] = max(0.0, conformal_q(s, np.ones(len(s)), alpha))
        for r in cal:
            g = _level(r, "category")
            lo, _, hi = bands.get(g, bands["*"])
            w = widen.get(g, widen["*"])
            mu = h.log_point(r, at=r["at"])
            y = math.log(r["price_cents"] / 100)
            covered += (mu + lo - w) <= y <= (mu + hi + w)
    full = Hedonic.fit(rows)
    return Model(full, _bands(full, alpha), widen, rows, covered / len(cal) if cal else float("nan"), len(train), len(cal))


def backtest(rows: list[dict], test_share: float = 0.2, alpha: float = ALPHA) -> dict:
    """Time-ordered holdout: fit (with its own calibration) on the past, score the newest sold rows.
    Baseline: the category's median sold price in the training rows (what most price tools show)."""
    sold = sorted((r for r in rows if r.get("price_type") == "sold"), key=lambda r: _t(r["at"]))
    n = max(1, int(len(sold) * test_share))
    test, cut = sold[-n:], _t(sold[-n]["at"])
    past = [r for r in rows if _t(r["at"]) < cut]
    m = fit(past, alpha)
    base: dict[str, list[float]] = {}
    for r in past:
        if r.get("price_type") == "sold":
            base.setdefault(_level(r, "category"), []).append(r["price_cents"])
    inside, ape, ape_base = 0, [], []
    for r in test:
        e = m.estimate(r, today=r["at"])
        y = r["price_cents"]
        inside += e["q10_cents"] <= y <= e["q90_cents"]
        ape.append(abs(e["q50_cents"] - y) / y)
        b = base.get(_level(r, "category")) or [y]
        ape_base.append(abs(float(np.median(b)) - y) / y)
    return {"n_train": len(past), "n_test": len(test), "coverage": inside / len(test), "target_coverage": 1 - alpha,
            "median_ape": float(np.median(ape)), "median_ape_category_median": float(np.median(ape_base)),
            "calib_coverage": m.calib_coverage}
