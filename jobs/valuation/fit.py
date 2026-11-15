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
