# A walk for a Databricks judge

Ten minutes, in order. Every figure is read live from the workspace. This page holds the queries, not the numbers. The design behind each step is in [spec/databricks-build.md](../spec/databricks-build.md).

Run the queries in the SQL editor on the Serverless Starter Warehouse. `node databricks/live.mjs` prints the same figures in one go.

## 1. The data and its rights

Six public sold datasets land in a volume, then the `secondhand-market` pipeline moves them from bronze to silver, with expectations that drop or stop bad rows.

```sql
SELECT * FROM secondhand.measures.pipeline_funnel ORDER BY bronze DESC;
```

Every row carries its source's rights. Training reads only rows cleared for it, and each source says whether it is cleared for the demo backtest or for a model the product ships:

```sql
SELECT source, may_model, may_model_scope, ttl_hours, clause, clause_url FROM secondhand.governance.source_rights;
SELECT * FROM secondhand.measures.model_clearance;
```

The platform's tags label tables and columns. This table says what each source may be used for, row by row, and the fits read only the view built on it.

## 2. One price, opened to its rows

Pick any shown number from the backtest and open it. The hash of its basis is recomputed in SQL and compared with the hash the engine stored:

```sql
SELECT id, metric, value_cents FROM secondhand.core.guarded_number
WHERE data = 'dataset:stockx_2019' AND state = 'shown' LIMIT 5;

SELECT * FROM secondhand.measures.why('<an id from above>');
```

`equal = true` means the number can be rebuilt from exactly the rows it names. Unity Catalog lineage stops at tables and columns; this goes down to the rows and back up to the number.

## 3. How good the price is, and against what

The backtest freezes each estimate before the sale and scores every contestant on the same held-out sales, the baselines included:

```sql
SELECT * FROM secondhand.measures.headline_latest;
SELECT * FROM secondhand.measures.valuation_accuracy WHERE NOT too_few;
```

Read the `claim` column aloud as written: it names the dataset, the families and the dates. It is not today's market. Each run is also an MLflow run, under the experiments in `/Shared/secondhand/`, and records the exact Delta version it read.

## 4. A weight that changes only on evidence

The comps half-life is a `param` row. Each month a challenger is fitted on the past and scored on the next month. It is promoted only when it wins by more than the noise, and the change feed keeps every move:

```sql
SELECT * FROM secondhand.measures.param_moves ORDER BY month, action;
SELECT * FROM secondhand.measures.param_history ORDER BY _commit_version;
```

## 5. Isolation and masking that hold against the owner

Two Unity Catalog ABAC policies sit on the `secondhand` catalog and are driven by governed tags: `sh_owner_only` (row filter) and `sh_mask_handle` (column mask):

```sql
SELECT * FROM secondhand.measures.policies_in_force;
SELECT seller_handle FROM secondhand.core.observation WHERE seller_handle IS NOT NULL LIMIT 3;
SELECT secondhand.governance.owner_only('usr_ben');
```

The filter hides other people's rows even from the workspace owner's own jobs. Maintenance therefore goes through a logged, time-boxed break-glass window:

```sql
SELECT * FROM secondhand.measures.break_glass_windows;
SELECT * FROM secondhand.measures.governance_grants;
```

## 6. The guard, and a platform limit we met

The platform refuses CHECK constraints on a row-filtered table (`ROW_LEVEL_SECURITY_CHECK_CONSTRAINT_UNSUPPORTED`). So the rule "a shown number has a citation, a hidden one has a reason" is enforced three ways: by a check at the door before each write, by a nightly job that fails on any violation, and by an hourly SQL alert.

```sql
SELECT * FROM secondhand.measures.guard_status;
SELECT * FROM secondhand.measures.guard_violations;
```

## 7. What the system never did

The real policy code answered every action on every site. Nothing marked never-automated was allowed:

```sql
SELECT policy_mode, data, sum(count) FROM secondhand.measures.decisions_by_policy GROUP BY ALL;
SELECT count(*) AS answers, count_if(allow) AS allowed FROM secondhand.measures.never_automated;
```

## 8. The same code in two languages

The proof layer exists in TypeScript in the app and in Python in the jobs. A parity job runs both against one fixture set on the workspace:

```sql
SELECT count(*) AS cases, count_if(equal) AS equal FROM secondhand.measures.parity_check;
```

## 9. The benchmark, inside the lakehouse

Each benchmark run lands as records, side by side with a plain-request baseline. Speed is shown as p50 and p95, never as an average:

```sql
SELECT * FROM secondhand.measures.bench_coverage ORDER BY run_id, tool;
SELECT * FROM secondhand.measures.bench_speed ORDER BY run_id, tool;
```

## 10. Ask it

The dashboard "secondhand: proof" and the Genie space "secondhand market" are bundle resources. In Genie, ask a thin question (the median price of a brand with a handful of sales). It answers "too few: N sales" instead of a number.

Everything above deploys from one bundle: `node deploy/deploy.mjs deploy --target dev --profile Nate`.
