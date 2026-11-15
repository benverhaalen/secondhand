# 71: Databricks handoff at the stop

Updated: 2026-11-15, about 05:20 Central (system clock). Owner: Nate. Agent: the second Databricks lead (Claude Code), stopping as its context fills. Read with [packet 55](55-team-leads-and-mac-workers.md), [spec/databricks-build.md](../../../../spec/databricks-build.md) and [databricks/DEMO.md](../../../../databricks/DEMO.md). **Judging is at 1 PM Central today.**

## What changed in this session

- **The dashboard was rebuilt and deployed.** Nate rejected the first one ("So i hated the dashboard... Understand we are being judged"). The rebuild is one story page and a data page: a price opened to its sales; ours against the last sale and the 90-day median on the same sales (misses by sale price, ranges that held); prices held back; the weight that moved once; isolation; what is never automated. Every figure shows its count. It was rendered and read in a browser on a review copy (`/Shared/secondhand-review`, id `01f1e0dd560b1bfabf59977d292e05e1`) before deploy. Nate saw it: "thats a good test dashboard, but we will develop our dashboard to respond to realtime data from across sites and what we scan for our internal testing". He then said "Yes, deploy now", and, asked about the flag, "Yes, use --force". The deploy ran with `--force` and overwrote the UI edits on the old one (title "secondhand: Accuracy", `applyModeEnabled`).
- **The metric view** `measures.valuation_metrics` ([13_metrics.sql](../../../../databricks/sql/13_metrics.sql)) holds the price measures, null under 30 shown, by who priced it, week, sale price band, kind and dataset. It was created through the Statements API.
- **Setup chain run after the deploy.** `setup`, `erasure_setup` and `governance_setup` ran, the last twice. `parity` passed 125 of 125. `load_bench` and `load_logs` ran (559 lines, 481 decisions, 0 rejected).
- **The guard.** The first break-glass run found 124,152 violations, every backtest number missing `basis_level`. Commit 6e798a6c backfills it with the writer's own rule. After the rerun, `measures.guard_status` shows **0 violations** (checked 10:49 UTC). 0 open break-glass windows, 0 wildcard mappings.
- **Genie.** Run 1 got 6 of 10 right; it now answers all of them. The thin questions refuse with their count, including "too few: 0 sales" for a Yeezy on Depop. Five judge questions are the space's sample questions. Genie calls no unregistered table function and reads no view over system information schema. So the rows behind `why(id)` are the view `measures.price_basis`, and the policies are the snapshot table `measures.locks_in_force`, refreshed by `governance_setup`. Recorded answers: the side-session notes file `dbx-genie-judge-answers.md` (kept out of the repo because it holds development figures).
- **Benchmark.** `bench_read`, cost columns on `bench_record`, and the views `bench_by_site` and `bench_cost` are live (worker dbx-bench-2). `bench_setup` migrates the columns first. The two runs loaded so far predate per-read fields, so the views fill when integration uploads today's run to `/Volumes/secondhand/raw/landing/bench/` and `load_bench` runs.
- **DEMO.md** is the judge's walk in six steps plus a table of what Databricks gave us, what we built on it and how we worked around each limit.
- **The build page** says free trial, not Free Edition, describes the new dashboard, and lists named fixes F1 to F7 (§10).

## What is true on the workspace (`--profile Nate`)

Trial workspace, $392 of $400 credit at the morning read. Warehouse `a2d6ba8cc4538aca` is **Small** (not 2X-Small), serverless, auto-stop 10 minutes. Dashboard "secondhand: proof" `01f1e0d8d8a413f7a6bfae4c54d93c5a`; Genie space `01f1e0d8d8d3161fa9590e55702c1b46`. All merged safety fixes are deployed.

**Two schedules spend credit:**
- The hourly guard alert. Each run wakes the Small warehouse for at least its 10-minute auto-stop window, about 2 DBU, $1.40 at an assumed $0.70 per DBU, so about $34 a day (an estimate, not read from the bill). Recommendation: keep it hourly until judging, then daily. That is Nate's call.
- The daily vacuum at 4 AM. It is small.

nightly-fits stays PAUSED.

## Open, in order

1. **The live page** (Nate, above). The workspace holds no `live:` or `captured` rows yet. The design is in spec §8. It needs the logs to land on a cadence, and the cadence spends credit, so it is Nate's call.
2. **The benchmark on the dashboard** once integration's run lands: a section over `bench_by_site` and `bench_cost`.
3. **MI4** (the product index on the lakehouse, `spec/engines/market-index.md`). It depends on MI1 (stored rows with rights) and MI3 (the attribute record), and neither has rows yet. Its Delta Sync index needs a **Vector Search endpoint, a paid resource: ask Nate first.** If it is not rendered and checked by noon, it is not shown and not listed.
4. Named fixes F1 to F7 in spec §10. F1 now carries engines' four-column param contract and waits for their commit id.
5. The design-critic pass on the deployed page never ran: Nate stopped the browser capture and saw the page himself.

## Branches and worktrees on the Mac

dbx-bench-2 and dbx-guard-3 are merged into main, with nothing outstanding. The older `dbx-*` worktrees can go.

## Learned the hard way

- **AI/BI counters truncate a format template** ("122.51K of…"). A headline figure with its count is a small Vega-Lite widget over a `stats` dataset with `value_label` and `sub_label` (see the generator pattern in `proof.lvdash.json`).
- **A chart scaled 0 to 100% hides a 98 against 97 difference.** Plot misses (1 minus the rate) so the axis still starts at zero.
- **Genie runs only its attached sources.** An unregistered table function fails with `UNSUPPORTED_FUNC_NAME`, and a view over `system.information_schema` fails with `INSUFFICIENT_PERMISSIONS`. Give it views and snapshot tables.
- **`bundle generate dashboard --resource` writes relative to the cwd** (it created `deploy/databricks/…`) and does not clear "modified remotely". Only `--force` does, and that is asked each time.
- **Python on Windows writes CRLF** when it opens a file with plain `open()`. Use `newline=''`, or tests that match `\n` fail on the working copy.
- **`LATERAL VIEW` must come after every join** in Spark SQL; explode in a subquery.
- **The Databricks console shows "Automated browser control detected"** when driven from the browser pane. Read and scroll only; Nate took over.
