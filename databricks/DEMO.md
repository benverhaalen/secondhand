# A walk for a Databricks judge

Six steps, in the order a judge asks. Each is one click or one query, and each figure is read live from the workspace with its dataset and count beside it. This page holds the queries, not the numbers, so nothing public carries a figure Nate and Ben have not seen. The design behind each step is in [spec/databricks-build.md](../spec/databricks-build.md).

Open the dashboard **secondhand: proof** (Dashboards, `/Shared/secondhand`) and the Genie space **secondhand market**. Run any query below in the SQL editor on the Serverless Starter Warehouse.

Two rules hold on every step:
- **Backtest figures are history.** They come from public StockX sales of 2017 to 2019 and never stand for accuracy on live listings. Every such figure names its dataset.
- **Thin answers are refused.** A rate over fewer than 30 shown prices is blank, and Genie answers "too few: N sales" instead of a price.

## 1. What Databricks holds

Six public sold datasets land in a Unity Catalog volume. The Lakeflow pipeline `secondhand-market` takes them from bronze to silver with expectations that drop or stop bad rows. Every row carries its source's rights, and training reads only the rows a source allows. Dashboard: **The data** page.

```sql
SELECT source, bronze, dropped, kept, modelled FROM secondhand.measures.pipeline_funnel ORDER BY kept DESC;
```

Uses: Unity Catalog volumes and governed tags, Lakeflow Declarative Pipelines with expectations, Delta.

## 2. A price opened to its rows

Section 1 of the dashboard: pick a price, see the earlier sales it was made from, each linked to its page. The basis hash is recomputed in SQL from those rows and compared with the hash the engine stored.

```sql
SELECT * FROM secondhand.measures.why('<a shown number id>');
```

`equal = true` means the number rebuilds from exactly the rows it names. Unity Catalog lineage stops at tables and columns; this table function goes down to the rows and back up to the number.

Uses: a SQL table function, the metric view `measures.valuation_metrics`, AI/BI dashboard cross-filtering.

## 3. The benchmark

Each benchmark run lands as records, ours beside a plain-request baseline on the same items: per site, how many reads answered, rows per read, seconds for a cold and a warm read, and cents per answer, each with its count. Speed is a median and a 95th percentile, never an average.

```sql
SELECT * FROM secondhand.measures.bench_by_site ORDER BY run_id, tool, site;
SELECT * FROM secondhand.measures.bench_cost ORDER BY run_id, tool;
```

Then the backtest, on history: section 2 of the dashboard compares our price with the last sale and the 90-day median on the same held-out sales, by what the item sold for, and how often each range held the real price. Each run is an MLflow run under `/Shared/secondhand/valuation-backtest`.

Uses: Delta tables loaded by a bundle job, MLflow, metric views.

## 4. A weight that moved only on evidence

Section 4 of the dashboard. The comps half-life is a `param` row. Each month a challenger is fitted on the past and scored on the next month, and it replaces the one in force only when it wins by more than the noise. Delta's change data feed keeps every move.

```sql
SELECT month, action, version, value, diff, noise, reason FROM secondhand.measures.param_moves ORDER BY month, version;
```

Uses: Delta change data feed, MLflow.

## 5. Isolation against the owner

Section 5 of the dashboard. Two catalog ABAC policies driven by governed tags, `sh_owner_only` (row filter) and `sh_mask_handle` (column mask), hide each person's rows and mask buyer and seller handles, even from the workspace owner's own jobs. Maintenance passes only through a logged, time-boxed break-glass window, and the guard runs inside it so it sees every row.

```sql
SELECT * FROM secondhand.measures.policies_in_force;
SELECT * FROM secondhand.measures.guard_status;
```

The platform refuses CHECK constraints on a row-filtered table (`ROW_LEVEL_SECURITY_CHECK_CONSTRAINT_UNSUPPORTED`), so the rule "a shown number has a citation, a hidden one has a reason" is held by a check at the door, a failing job, and a SQL alert.

Uses: Unity Catalog ABAC, governed tags, SQL alerts.

## 6. Deletion

When a person asks to be deleted, `purge-user` removes their rows from every core table, rewrites the landing files that held them, and writes a tombstone so no loader writes them again. The daily vacuum job then removes the old Delta files once they are seven days old.

```sql
SELECT user_id, requested_at, purged_at, vacuum_due_at, vacuumed_at FROM secondhand.governance.erasure;
```

The demo runs it on a made-up person only. Never on a real one.

Uses: Delta MERGE and VACUUM, a bundle job with a parameter.

## Ask it

In Genie, ask "What is the median sold price among the earliest 10 StockX sales?" It answers "too few: 10 sales" instead of a price. Ask "How often was our price within 20 percent, by sale price band?" It reads the metric view.

Everything above deploys from one bundle: `node deploy/deploy.mjs deploy --target dev --profile Nate`.
