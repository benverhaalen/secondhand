"""Nightly valuation fold (deploy/databricks.yml nightly_fits -> deploy/tasks/fold.py valuation -> main()).

On Databricks: reads sold and asking rows from `comp` joined to `product` (spec/product.md data model), fits the market
model (market.py), backtests it on the newest sales, and appends one challenger row to `valuation_fit` with its held-out
scores and fitted premiums. It never promotes: promotion is the param fold's call on a held-out win (jobs/param).
With no `comp` table yet it is skipped, not failed, and nothing is invented.

Locally: python jobs/valuation/fit.py --comps rows.json [--items items.json] --out result.json writes the backtest,
the premiums and the estimates. Both paths log through log/ (logs/valuation-fit-*.jsonl).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "jobs"))   # as on the bundle's sync root
sys.path.insert(0, str(ROOT / "log"))

from secondhand_log import create_log, file_sink  # noqa: E402
from valuation import market  # noqa: E402

CATALOG = os.environ.get("SECONDHAND_CATALOG", "workspace")
SCHEMA = os.environ.get("SECONDHAND_SCHEMA", "secondhand")

# comp + product to the flat row market.py reads. size and era live in product.spec (json) where identify found them.
ROWS_SQL = """
SELECT c.comp_id, c.site, c.price_cents, c.price_type, coalesce(c.sold_at, c.observed_at) AS at, c.condition,
       p.brand, p.category, get_json_object(p.spec, '$.size') AS size, get_json_object(p.spec, '$.era') AS era, c.url_ref AS url
FROM {cat}.{sch}.comp c LEFT JOIN {cat}.{sch}.product p ON c.product_id = p.product_id
WHERE c.price_type IN ('sold', 'asking') AND c.price_cents > 0 AND size(coalesce(c.lot_parts, array())) = 0
"""


def run(rows: list[dict], items: list[dict] | None = None, today: str | None = None) -> dict:
    today = today or datetime.now(timezone.utc).isoformat()
    m = market.fit(rows)
    return {
        "n_rows": len(rows), "n_sold": sum(r.get("price_type") == "sold" for r in rows),
        "backtest": market.backtest(rows),
        "premiums": m.hedonic.premiums(),
        "estimates": [{"item": it, **m.estimate(it, today=today)} for it in (items or [])],
    }


def _log():
    (ROOT / "logs").mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    return create_log(src="job.valuation.fit", build=os.environ.get("SECONDHAND_BUILD", "dev"),
                      sink=file_sink(str(ROOT / "logs" / f"valuation-fit-{stamp}.jsonl")), config={"alpha": market.ALPHA, "calib": market.CALIB})


def main() -> dict:
    from pyspark.sql import SparkSession  # only on Databricks

    log = _log()
    job = f"valuation_fit_{datetime.now(timezone.utc):%Y%m%d}"
    log.job(job, "fit", "running")
    spark = SparkSession.getActiveSession() or SparkSession.builder.getOrCreate()
    table = f"{CATALOG}.{SCHEMA}.comp"
    if not log.call("db", "table_exists", {"table": table}, lambda: spark.catalog.tableExists(table)):
        log.job(job, "fit", "done", skipped=f"no {table} table yet")
        return {"state": "skipped", "why": f"no {table} table yet"}
    rows = log.call("db", "read_comps", {"table": table}, lambda: [r.asDict() for r in spark.sql(ROWS_SQL.format(cat=CATALOG, sch=SCHEMA)).collect()],
                    describe=lambda rs: {"rows": len(rs)})
    for r in rows:
        r["at"] = r["at"].isoformat() if hasattr(r["at"], "isoformat") else r["at"]
    if sum(r.get("price_type") == "sold" for r in rows) < 2 * market.MIN_GROUP:
        log.job(job, "fit", "done", skipped=f"{len(rows)} comp rows, too few sold")
        return {"state": "skipped", "why": f"{len(rows)} comp rows, too few sold to fit and backtest"}
    out = run(rows)
    fit_row = {"fitted_at": datetime.now(timezone.utc).isoformat(), "role": "challenger", "n_rows": out["n_rows"],
               "coverage": out["backtest"]["coverage"], "median_ape": out["backtest"]["median_ape"],
               "median_ape_baseline": out["backtest"]["median_ape_category_median"], "premiums": json.dumps(out["premiums"])}
    log.call("db", "append_valuation_fit", {"table": f"{CATALOG}.{SCHEMA}.valuation_fit"},
             lambda: spark.createDataFrame([fit_row]).write.mode("append").saveAsTable(f"{CATALOG}.{SCHEMA}.valuation_fit"))
    log.job(job, "fit", "done", **out["backtest"])
    return {"state": "ran", "backtest": out["backtest"], "n_rows": out["n_rows"]}


def switch_rule(champion: dict, challenger: dict) -> tuple[bool, str]:
    cells = challenger["cells"]
    if not cells or any(not c["passes"] or not 0.75 <= c["coverage"] <= 0.85 for c in cells):
        return False, "fail: coverage"
    old = {(c["group"], c["price_band"]): c for c in champion["cells"]}
    fresh = {(c["group"], c["price_band"]): c for c in cells}
    if not old.keys() <= fresh.keys():
        return False, "kept: missing cell"
    if any(fresh[k]["q50_median_error"] - c["q50_median_error"] > 0.02 + 1e-12 for k, c in old.items()):
        return False, "kept: cell regression"
    gain = champion["overall"]["q50_median_error"] - challenger["overall"]["q50_median_error"]
    return (True, "held-out win") if gain >= 0.01 - 1e-12 else (False, "kept: median error")


def publish(store, scope, model_ref, champion, challenger, at):
    allowed, reason = switch_rule(champion, challenger)
    if not allowed:
        return False, reason
    history = store.history("valuation", scope)
    row = store.propose({"name": "valuation", "scope": scope, "family": "model_ref",
                         "value_or_hyperparams": model_ref, "prior": None,
                         "held_out_score": -challenger["overall"]["q50_median_error"],
                         "metric": "negative_q50_median_error"}, max((r["version"] for r in history), default=0))
    return store.promote("valuation", scope, row["version"], 0, at)


def fit_quantiles(rows):
    if not rows or any(not r.get("may_model", True) for r in rows):
        raise ValueError("empty fit or may_model false")
    from lightgbm import LGBMRegressor
    x = [r["features"] for r in rows]
    y = [r["price_cents"] for r in rows]
    return {q: LGBMRegressor(objective="quantile", alpha=q, random_state=0,
                             n_jobs=1, verbosity=-1).fit(x, y) for q in (0.1, 0.5, 0.9)}


def calibrate(quantiles, truth, weights, alpha=0.2):
    import numpy as np
    from valuation.backtest import conformal_q
    q = np.asarray(quantiles, float)
    y = np.asarray(truth, float)
    return conformal_q(np.maximum(q[:, 0] - y, y - q[:, 2]), weights, alpha)


class CureModel:
    def __init__(self, weights, rate):
        self.weights, self.rate = weights, rate

    def probability(self, features, days):
        import numpy as np
        from scipy.special import expit
        return float(expit(np.dot(features, self.weights)) * -np.expm1(-self.rate * days))


def fit_cure(features, days, sold):
    import numpy as np
    from scipy.optimize import minimize
    from scipy.special import expit
    x, t, event = np.asarray(features, float), np.asarray(days, float), np.asarray(sold, float)
    if x.ndim != 2 or len(x) != len(t) or len(t) != len(event) or not len(t):
        raise ValueError("cure rows must align")
    if not np.isfinite(x).all() or not np.isfinite(t).all() or (t < 0).any() or not np.isin(event, [0, 1]).all():
        raise ValueError("invalid censored rows")
    def loss(theta):
        susceptible, rate = expit(x @ theta[:-1]), np.exp(theta[-1])
        survival = np.exp(-rate * t)
        likelihood = np.where(event == 1, susceptible * rate * survival, 1 - susceptible + susceptible * survival)
        return -np.log(np.maximum(likelihood, 1e-300)).sum() + .5 * np.dot(theta[:-1], theta[:-1])
    result = minimize(loss, np.r_[np.zeros(x.shape[1]), np.log(1 / max(t.mean(), 1))], method="L-BFGS-B")
    if not result.success:
        raise RuntimeError(f"cure fit failed: {result.message}")
    return CureModel(result.x[:-1], float(np.exp(result.x[-1])))


def fit_weights(priors, held_out_loss):
    # D1 guards surround the priors; coordinate search evaluates the D6 pinball objective supplied by the backtest.
    weights = dict(priors)
    for _ in range(3):
        for name, prior in priors.items():
            candidates = [prior * (0.5 + i / 20) for i in range(21)]
            weights[name] = min(candidates, key=lambda value: held_out_loss({**weights, name: value}))
    return weights


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--comps", required=True)
    ap.add_argument("--items")
    ap.add_argument("--today")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    log = _log()
    comps = json.loads(Path(a.comps).read_text())
    items = json.loads(Path(a.items).read_text()) if a.items else None
    out = log.timed("valuation.fit", lambda: run(comps, items, a.today), rows=len(comps))
    log.job("valuation_fit_local", "fit", "done", **out["backtest"])
    Path(a.out).write_text(json.dumps(out, indent=1, default=str))
