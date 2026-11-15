"""Nightly valuation fold (deploy/databricks.yml nightly_fits -> deploy/tasks/fold.py valuation -> main()).

On Databricks: reads product-cleared sold and asking rows joined to `product` (spec/product.md data model), fits the market
model (market.py), backtests it on the newest sales, and appends one challenger row to `valuation_fit` with its held-out
scores and fitted premiums. The D6 per-cell gate promotes held-out wins through jobs/param and persists the registry.
With no product-cleared rows it is skipped and writes no parameters.

Locally: python jobs/valuation/fit.py --comps rows.json [--items items.json] --out result.json writes the backtest,
the premiums and the estimates. Both paths log through log/ (logs/valuation-fit-*.jsonl).
"""
from __future__ import annotations

import argparse
import hashlib
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
from param.registry import MemoryStore, FIELDS, scope_key  # noqa: E402

CATALOG = os.environ.get("SECONDHAND_CATALOG", "workspace")
SCHEMA = os.environ.get("SECONDHAND_SCHEMA", "secondhand")
REGISTRY_TABLE = f"{CATALOG}.core.param"
COMPS_VIEW = f"{CATALOG}.market.comp_for_product"
PARAM_ADDITIONS = {"origin": "STRING", "previous_version": "INT", "keep": "STRING", "days_since_last": "DOUBLE"}

# comp + product to the flat row market.py reads. size and era live in product.spec (json) where identify found them.
ROWS_SQL = f"""
SELECT c.comp_id, c.product_id, c.site, c.price_cents, c.price_type, coalesce(c.sold_at, c.observed_at) AS at, c.condition,
       p.brand, p.category, p.family_id, get_json_object(p.spec, '$.size') AS size, get_json_object(p.spec, '$.era') AS era, c.url_ref AS url
FROM {COMPS_VIEW} c LEFT JOIN {CATALOG}.market.product p ON c.product_id = p.product_id
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
    table = COMPS_VIEW
    if not log.call("db", "table_exists", {"table": table}, lambda: spark.catalog.tableExists(table)):
        log.job(job, "fit", "done", skipped=f"no {table} table yet")
        return {"state": "skipped", "why": f"no {table} table yet"}
    rows = log.call("db", "read_comps", {"table": table}, lambda: [r.asDict() for r in spark.sql(ROWS_SQL).collect()],
                    describe=lambda rs: {"rows": len(rs)})
    if not rows:
        why = "no rows cleared for a shipped model"
        log.job(job, "fit", "done", skipped=why)
        return {"state": "skipped", "why": why}
    for r in rows:
        r["at"] = r["at"].isoformat() if hasattr(r["at"], "isoformat") else r["at"]
    if sum(r.get("price_type") == "sold" for r in rows) < 2 * market.MIN_GROUP:
        log.job(job, "fit", "done", skipped=f"{len(rows)} comp rows, too few sold")
        return {"state": "skipped", "why": f"{len(rows)} comp rows, too few sold to fit and backtest"}
    out = run(rows)
    store = MemoryStore()
    exists = log.call("db", "param_exists", {"table": REGISTRY_TABLE}, lambda: spark.catalog.tableExists(REGISTRY_TABLE))
    if exists:
        history = log.call("db", "read_valuation_param", {"table": REGISTRY_TABLE},
                           lambda: [r.asDict() for r in spark.sql(f"SELECT * FROM {REGISTRY_TABLE} WHERE name = 'valuation'").collect()],
                           describe=lambda rs: {"rows": len(rs)})
        for r in history:
            r = {**dict.fromkeys(PARAM_ADDITIONS), **r}
            for key in ("scope", "value_or_hyperparams", "prior", "keep"):
                if isinstance(r.get(key), str):
                    r[key] = json.loads(r[key])
            store.rows.setdefault((r["name"], scope_key(r["scope"])), []).append(r)
    promotion = log.timed("valuation.switch", lambda: nightly(rows, store, {}, datetime.now(timezone.utc).isoformat()))
    if promotion["promoted"]:
        records = store.history("valuation", {})
        column_types = {k: "STRING" for k in FIELDS}
        column_types.update(version="INT", previous_version="INT", frozen="BOOLEAN",
                            **{k: "DOUBLE" for k in ("n_eff", "held_out_score", "guard_lo", "guard_hi", "days_since_last")})
        encoded = []
        for record in records:
            row = {k: record[k] for k in FIELDS}
            row["scope"] = scope_key(record["scope"])
            identity = json.dumps([row["name"], row["scope"], row["version"]], separators=(",", ":"))
            row["id"] = "par_" + hashlib.sha256(identity.encode()).hexdigest()[:24]
            for key in ("value_or_hyperparams", "prior", "keep"):
                row[key] = json.dumps(row[key])
            for key, dtype in column_types.items():
                if dtype == "DOUBLE" and row[key] is not None:
                    row[key] = float(row[key])
            if isinstance(row["promoted_at"], datetime):
                row["promoted_at"] = row["promoted_at"].isoformat()
            encoded.append(row)
        schema = "id STRING, " + ", ".join(f"{k} {dtype}" for k, dtype in column_types.items())
        columns = ("id", "user_id", "created_at", "updated_at", *FIELDS, "moved_by")
        values = {k: f"s.{k}" for k in columns}
        values.update(user_id="NULL", created_at="current_timestamp()", updated_at="current_timestamp()",
                      promoted_at="CAST(s.promoted_at AS TIMESTAMP)", moved_by="'promote nightly_fits valuation'")

        def migrate_registry():
            existing = spark.table(REGISTRY_TABLE).columns
            missing = [f"{k} {dtype}" for k, dtype in PARAM_ADDITIONS.items() if k not in existing]
            if missing:
                spark.sql(f"ALTER TABLE {REGISTRY_TABLE} ADD COLUMNS ({', '.join(missing)})")

        log.call("db", "migrate_valuation_param", {"table": REGISTRY_TABLE}, migrate_registry)

        def save_registry():
            frame = spark.createDataFrame(encoded, schema=schema)
            frame.createOrReplaceTempView("valuation_param_update")
            updates = ", ".join(f"t.{k} = {values[k]}" for k in columns)
            spark.sql(f"""MERGE INTO {REGISTRY_TABLE} t USING valuation_param_update s
                ON t.name = s.name AND t.scope = s.scope AND t.version = s.version
                WHEN MATCHED THEN UPDATE SET {updates}
                WHEN NOT MATCHED THEN INSERT ({', '.join(columns)}) VALUES ({', '.join(values[k] for k in columns)})""")

        log.call("db", "write_valuation_param", {"table": REGISTRY_TABLE}, save_registry)
        log.change("param", "valuation", "champion", reason=promotion["reason"])
    fit_row = {"fitted_at": datetime.now(timezone.utc).isoformat(), "role": "challenger", "n_rows": out["n_rows"],
               "coverage": out["backtest"]["coverage"], "median_ape": out["backtest"]["median_ape"],
               "median_ape_baseline": out["backtest"]["median_ape_category_median"], "premiums": json.dumps(out["premiums"])}
    log.call("db", "append_valuation_fit", {"table": f"{CATALOG}.{SCHEMA}.valuation_fit"},
             lambda: spark.createDataFrame([fit_row]).write.mode("append").saveAsTable(f"{CATALOG}.{SCHEMA}.valuation_fit"))
    log.job(job, "fit", "done", **out["backtest"])
    return {"state": "ran", "backtest": out["backtest"], "n_rows": out["n_rows"], "promotion": promotion}


def model_payload(model):
    h = model.hedonic
    return {"design": {"levels": h.design.levels, "t0": h.design.t0, "columns": h.design.columns},
            "beta": h.beta.tolist(), "se": h.se.tolist(), "resid": h.resid.tolist(), "groups": h.groups,
            "band": model.band, "widen": model.widen, "sold": model.sold, "asks": model.asks, "anchor": model.anchor}


def load_model(payload):
    import numpy as np
    design = market.Design(**payload["design"])
    h = market.Hedonic(design, np.array(payload["beta"]), np.array(payload["se"]), np.array(payload["resid"]), payload["groups"])
    return market.Model(h, payload["band"], payload["widen"], payload["sold"], payload["asks"], payload.get("anchor"))


def held_out_report(model, training, held_out):
    import numpy as np
    from valuation.backtest import run_backtest
    pool = [{**r, "sold_at": r["at"], "family_id": r.get("family_id") or r["category"]}
            for r in training + held_out if r["price_type"] == "sold"]
    estimates = []
    for r in held_out:
        if model:
            lo, mid, hi = model.interval(r, r["at"])
            comps = market.adjusted_comps(model.hedonic, r, model.sold, today=r["at"], k=20)
            ids = [c["comp_id"] for c in comps]
            fits = [c["comp_id"] for c in model.sold]
        else:
            comps = [c for c in training if c["price_type"] == "sold" and c["category"] == r["category"]]
            if not comps:
                comps = [c for c in training if c["price_type"] == "sold"]
            lo = mid = hi = float(np.median([c["price_cents"] for c in comps]))
            ids, fits = [c["comp_id"] for c in comps], []
        estimates.append({"item_id": r["comp_id"], "as_of": r["at"], "group": r["category"],
                          "q10": lo, "q50": mid, "q90": hi, "comp_ids": ids, "fit_row_ids": fits})
    return run_backtest(estimates, pool)


def nightly(rows, store, scope, at):
    if scope.get("person") is not None and any(r.get("person") != scope["person"] for r in rows):
        raise ValueError("comp outside person scope")
    if any(not r.get("may_model", True) for r in rows):
        raise ValueError("may_model false")
    if len({r["comp_id"] for r in rows}) != len(rows):
        raise ValueError("duplicate comp")
    # Keep the last three months independent of both the fit and its internal conformal calibration.
    end = min(market._t(at), max(market._t(r["at"]) for r in rows))
    cutoff = end - 90 * market.DAY
    training = [r for r in rows if market._t(r["at"]) < cutoff]
    held = [r for r in rows if r["price_type"] == "sold" and cutoff <= market._t(r["at"]) <= end]
    if not held or sum(r["price_type"] == "sold" for r in training) < 2 * market.MIN_GROUP:
        return {"promoted": False, "reason": "kept: insufficient held-out basis"}
    model = market.fit(training)
    current = store.champion("valuation", scope)
    champion = load_model(current["value_or_hyperparams"]) if current else None
    if champion and any(market._t(r["at"]) >= cutoff for r in champion.sold + champion.asks):
        raise ValueError("champion training/held-out overlap")
    old = held_out_report(champion, training, held)
    fresh = held_out_report(model, training, held)
    promoted, reason = publish(store, scope, model_payload(model), old, fresh, at, n_eff=len(model.sold))
    return {"promoted": promoted, "reason": reason, "report": fresh,
            "held_out_from": datetime.fromtimestamp(cutoff, timezone.utc).isoformat()}


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


def publish(store, scope, model_ref, champion, challenger, at, n_eff=0):
    allowed, reason = switch_rule(champion, challenger)
    if not allowed:
        return False, reason
    history = store.history("valuation", scope)
    row = store.propose({"name": "valuation", "scope": scope, "family": "model_ref",
                         "value_or_hyperparams": model_ref, "prior": None, "n_eff": n_eff,
                         "held_out_score": -challenger["overall"]["q50_median_error"],
                         "metric": "negative_q50_median_error"}, max((r["version"] for r in history), default=0))
    current = store.champion("valuation", scope)
    saved_score = current["held_out_score"] if current else None
    promoted = False
    try:
        if current:
            current["held_out_score"] = -champion["overall"]["q50_median_error"]
        promoted, reason = store.promote("valuation", scope, row["version"], 0, at)
        return promoted, reason
    finally:
        if current and not promoted:
            current["held_out_score"] = saved_score


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
