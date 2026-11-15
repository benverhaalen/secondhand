# A walk for a Databricks judge

Six steps, in the order a judge asks. Each is one click or one query, and each figure is read live from the workspace with its dataset and count beside it. This page holds the queries, not the numbers, so nothing public carries a figure Nate and Ben have not seen. The design behind each step is in [spec/databricks-build.md](../spec/databricks-build.md).

Open the dashboard **secondhand: proof** (Dashboards, `/Shared/secondhand`) and the Genie space **secondhand market**. Run any query below in the SQL editor on the Serverless Starter Warehouse.

Two rules hold on every step:
- **Backtest figures are history.** They come from public StockX sales of 2017 to 2019 and never stand for accuracy on live listings. Every such figure names its dataset.
- **Thin answers are refused.** A rate over fewer than 30 shown prices is blank, and Genie answers "too few: N sales" instead of a price.
- **Two engines, always named.** The workspace backtest (the metric view, section 2's first row, Genie's "Market model") scores the nightly market model, which the app does not serve. The engine the app serves is `measures.engine_ablation`, the engines lead's development reading on the same kind of sales: it trails the last sale by about a point and beats the 90-day median. Never present the market model's figure as the app's accuracy.

## What Databricks gave us, and what we built on it

Every row names an object a judge can open. Where the platform stopped us, the last column says what we did instead.

| Feature | What Databricks gave us | What we built on it | How we extended it or worked around a limit |
|---|---|---|---|
| Unity Catalog: catalog, governed tags, ABAC policies (Catalog › `secondhand`) | One catalog with row filters and column masks set once as policies, driven by tags | `sh_owner_only` hides each person's rows; `sh_mask_handle` masks buyer and seller handles; `measures.policies_in_force` lists what holds | The filter hid other people's rows from the owner's own jobs, so maintenance passes only through a logged, time-boxed window (`governance.break_glass`), and the guard flags any window that was not logged |
| Lakeflow Declarative Pipeline (Jobs & Pipelines › `secondhand-market`) | Bronze to silver with expectations that drop or stop bad rows | Six public sold datasets, each row carrying its source's rights; models read only `market.comp_for_model` | A single-asterisk glob is refused in pipeline libraries, so the bundle names `**` |
| Bundle jobs (Jobs & Pipelines, names start "[dev") | Jobs, schedules and resources deployed from one repo | The guard, the param walk, the backtest, parity between our TypeScript and Python, the loaders, erasure and the daily vacuum | Serverless Python has no `__file__`, so every entrypoint takes `--root`; SQL file tasks split on every `;`, so compound SQL runs from Python tasks |
| Delta: change data feed, MERGE, VACUUM (Catalog › `secondhand.core.param`) | Every change to a row kept and readable; merges; physical deletion | `measures.param_history` shows every weight move; loaders MERGE and skip erased people; vacuum finishes a deletion | CHECK constraints are refused on a row-filtered table, so the rule "a shown number has a citation" is held by a check at the door, a failing guard job and a SQL alert |
| Table function (Catalog › `secondhand.measures.why`) | SQL functions that return rows | `why(id)` opens a shown price to the exact sales it rests on and rebuilds its hash | Unity Catalog lineage stops at tables and columns; this goes down to the rows and back up to the number |
| MLflow (Experiments › `/Shared/secondhand/valuation-backtest`, `/Shared/secondhand/param-walk`) | Tracked runs with parameters, metrics and the data read | Each backtest and each monthly weight test is a run | Time travel is refused on a view, so a run records the Delta version of the table under it |
| Metric view (Catalog › `secondhand.measures.valuation_metrics`) | Measures defined once, used by the dashboard and Genie | Accuracy of the nightly market model and its baselines by week, sale price and dataset; every rate blank under 30 prices, as the app does. The served engine sits beside it in `measures.engine_ablation` | The CLI drops indented YAML, so the view is created through the Statements API |
| AI/BI dashboard (Dashboards › `secondhand: proof`) | Charts, tables and filters over governed data, with Genie linked | The story page: a price opened to its sales, the market model and the served engine beside the usual guesses, prices held back, the weight, isolation, what is never automated | The counter truncates "98.5% of 39,707", so headline figures are a small Vega-Lite widget that shows the figure and its count |
| Genie (Genie › `secondhand market`) | Questions in plain words, answered with SQL over chosen tables | Five judge questions with example SQL over `measures.shown_prices`, `measures.price_basis` and the metric view; thin questions answer "too few: N sales" | Genie calls no unregistered table function and reads no view over system information schema, so the rows behind `why(id)` are the view `measures.price_basis`, and the catalog policies are the snapshot `measures.locks_in_force`, refreshed on every governance run |
| Volumes (Catalog › `secondhand.raw.landing`) | Files governed like tables | Benchmark runs and app logs land here, and loaders keep a reason for every rejected line | |
| SQL alert (Alerts › `guard_violations_alert`) | A query on a schedule that raises when it crosses a line | Fires when `measures.guard_status` shows any rule broken | |

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

`equal = true` (Genie's `rebuilt_exactly`) means the number rebuilds from exactly the rows it names. It says nothing about whether those sales are verified or current. Unity Catalog lineage stops at tables and columns; this table function goes down to the rows and back up to the number.

Uses: a SQL table function, the metric view `measures.valuation_metrics`, AI/BI dashboard cross-filtering.

## 3. The benchmark

Each benchmark run lands as records, ours beside a plain-request baseline on the same items: per site, how many reads answered, rows per read, seconds for a cold and a warm read, and cents per answer, each with its count. Speed is a median and a 95th percentile, never an average.

```sql
SELECT * FROM secondhand.measures.bench_by_site ORDER BY run_id, tool, site;
SELECT * FROM secondhand.measures.bench_cost ORDER BY run_id, tool;
```

Then the backtest, on history. Section 2 of the dashboard shows two readings, each named. Its first row is the workspace backtest of the nightly market model, which the app does not serve, against the last sale and the 90-day median on the same held-out sales; each run is an MLflow run under `/Shared/secondhand/valuation-backtest`. Its second row is the engine the app serves, from the engines lead's ablation ([spec/engines/valuation.md §9](../spec/engines/valuation.md#9-proof)): it trails the last sale by about a point, paired on the sales both priced.

```sql
SELECT label, served, data, sales, within_20, median_error, range_held, vs_last_sale_points, vs_last_sale_lo, vs_last_sale_hi, vs_last_sale_n, reading FROM secondhand.measures.engine_ablation;
```

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

In Genie, ask "What is the median sold price among the earliest 10 StockX sales?" It answers "too few: 10 sales" instead of a price. Ask "How did our price do against the last sale and the 90-day median on the same sales?" It gives both readings, names the market model and the served engine, and says the served engine trails the last sale by about a point. What Genie answered to each judge question, with its SQL, is in [genie-answers.md](genie-answers.md), rewritten by `node databricks/genie/ask.mjs`.

Everything above deploys from one bundle: `node deploy/deploy.mjs deploy --target dev --profile Nate`.
