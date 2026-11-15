# 71: Databricks handoff at the stop

Updated: 2026-11-15, about 05:45 Central (11:45 UTC). Owner: Nate. Agent: the third Databricks lead (Claude Code), stopping as its context fills. Read with [packet 55](55-team-leads-and-mac-workers.md), [spec/databricks-build.md](../../../../spec/databricks-build.md) and [databricks/DEMO.md](../../../../databricks/DEMO.md). **Judging is at 1 PM Central today.**

## What the third lead did (commit 27c3a65c)

- **Two engines, always named.** The workspace backtest's "ours" (98.5% within 20% of 39,707) is the nightly market model (`jobs/valuation/market.py`), which the app does not serve. It is now labelled "Market model" in the metric view `measures.valuation_metrics` (recreated through the Statements API), the dashboard and Genie. The served engine is the new table `measures.engine_ablation` ([14_engine.sql](../../../../databricks/sql/14_engine.sql), run by hand with `node databricks/run-sql.mjs`), copied from the engines lead's ablation in [valuation.md §9](../../../../spec/engines/valuation.md#9-proof): served 96.0% against last sale 97.4% and 90-day median 89.1% on 41,988 StockX 2019 test sales, paired gap −1.0 points (−1.4 to −0.7) on 41,452. Its columns carry comments; `vs_last_sale_points` is a rate gap, not a price gap.
- **Dashboard section 2** has a second row, "The engine the app serves trails the last sale by about a point", with four tiles and their counts. The price picker and its default now say "market model $598". Headline tiles and chart series are mid grays (`#767676` and lighter) because Databricks gives custom Vega tiles no theme and the brand ink vanished on a dark console. Rendered and read in light and dark in the browser pane after deploy.
- **Genie** says `rebuilt_exactly` means the price rebuilds exactly from the sales it cites, never "verified" or "real". `engine_ablation` is attached. Answers are recorded in the repo at [databricks/genie-answers.md](../../../../databricks/genie-answers.md), rewritten by `node databricks/genie/ask.mjs` (eight questions, the five samples among them; a test checks that).
- **Deploys:** four `node deploy/deploy.mjs deploy --target dev --profile Nate`, none forced, each "0 created" with the dashboard or Genie space changed.
- **Messages sent:** the engines lead (Lead 3) was asked when a newer served-engine reading should replace the 11-15 row (no reply by the stop). The buying-conversation lead was sent the list of what it could call today (`why`, `why_summary`, `shown_prices`, `price_basis`, the metric view, `source_rights`, `model_clearance`, `pipeline_funnel`, `locks_in_force`, `policies_in_force`, `guard_status`, the bench views, the Genie conversation API); its one named fix has not arrived. The orchestrator was sent the two spend questions below.

## Waiting on Nate (sent through the orchestrator)

1. **The hourly guard alert.** Billing (`system.billing.usage`, records to 08:00 UTC) shows a lone query wakes the idle Small warehouse for 0.9 to 2.2 DBU at the list $0.70/DBU (`system.billing.list_prices`, us-west-oregon): $0.60 to $1.54 a run, up to about $37 a day hourly, about $1.50 daily. SQL total so far 7.34 DBU, $5.14. Recommendation: hourly until judging, then daily. The alert evaluated OK at 11:00 UTC (811 ms).
2. **MI4's Vector Search endpoint.** Standard is 4 DBU/hour (vendor pricing page) at $0.07/DBU, $0.28 an hour, about $6.70 a day while it exists; MI1 and MI3 have no rows, so it would index nothing. Recommendation: not before judging.

## What is true on the workspace (`--profile Nate`)

Trial workspace, $392 of $400 credit at the morning read. Warehouse `a2d6ba8cc4538aca` is **Small** (not 2X-Small), serverless, auto-stop 10 minutes; stopped by hand at 11:40 UTC. Dashboard "secondhand: proof" `01f1e0d8d8a413f7a6bfae4c54d93c5a`; Genie space `01f1e0d8d8d3161fa9590e55702c1b46`. All merged safety fixes are deployed.

**Two schedules spend credit:**
- The hourly guard alert: measured cost and the question to Nate are above.
- The daily vacuum at 4 AM. It is small.

nightly-fits stays PAUSED.

## Open, in order

1. **Genie's prose still varies run to run.** In the last recorded run the weight answer gives no dataset or month count, the earliest-10 answer omits the dataset, and question 2 left out the market model's figure (an earlier run gave it). The example SQL already returns `months_tested`, `priced_by` and both readings. Next: make each judge question's SQL return one summary row whose columns say dataset and count, then rerun `ask.mjs` and read every answer.
2. **The benchmark on the dashboard** once integration's run lands in `/Volumes/secondhand/raw/landing/bench/` (only the 09:24 and 09:26 UTC runs are there, which predate per-read fields): run `load_bench`, check `bench_by_site` and `bench_cost` against the run (no Dupe rows), add a section with counts.
3. **The buying conversation's named fix**, when it arrives from "Lead: the buying conversation and its tools": build exactly that.
4. **The served engine's newer reading.** The engines lead (11:50 UTC): keep the 11-15 row through judging; the engine merging now is the one that reading measured, and the V-AB1 rerun comes after judging with its commit and run id. Its condition: the row is a development reading, on no public page and not in the pitch until Nate and Ben have both seen it. The dashboard judges see and `databricks/genie-answers.md` (public repo) both carry it, as the orchestrator's brief asked; whether that stands is Nate's call, sent to the orchestrator.
5. **The live page** (Nate): no `live:` or `captured` rows yet; design in spec §8; the cadence spends credit, so it is his call.
6. **MI4**, only on Nate's yes (above). If it is not rendered and checked by noon, it is not shown and not listed.
7. Named fixes F1 to F7 in spec §10. F1 waits for engines' commit id.
8. `rebuilt` reads 42,399 of 42,405: six numbers do not rebuild. Not looked into.

## Branches and worktrees on the Mac

dbx-bench-2 and dbx-guard-3 are merged into main, with nothing outstanding. The older `dbx-*` worktrees can go.

## Learned the hard way

- **Git Bash turns `/api/...` into a Windows path.** `databricks api post /api/2.0/sql/statements` answers "Not Found" from Git Bash; prefix `MSYS_NO_PATHCONV=1`.
- **Custom Vega tiles are not themed.** No color renders black on the dark console; a fixed mid gray is the one value readable on both.
- **Genie follows "Start the answer with …" in usage guidance and a self-describing column** (`priced_by`) far better than a rule in the text instructions.
- **`node .agents/check.mjs` fails on Windows for reasons outside this area** (image-gen temp folders inside the home tree, the ui raw-colors check, `console.log` in older databricks scripts, a stale anchor in `spec/plans/sweep/databricks.md`). `databricks/test_bundle.mjs` "bronze CSV schema" fails on the working copy too; not from this change.

- **AI/BI counters truncate a format template** ("122.51K of…"). A headline figure with its count is a small Vega-Lite widget over a `stats` dataset with `value_label` and `sub_label` (see the generator pattern in `proof.lvdash.json`).
- **A chart scaled 0 to 100% hides a 98 against 97 difference.** Plot misses (1 minus the rate) so the axis still starts at zero.
- **Genie runs only its attached sources.** An unregistered table function fails with `UNSUPPORTED_FUNC_NAME`, and a view over `system.information_schema` fails with `INSUFFICIENT_PERMISSIONS`. Give it views and snapshot tables.
- **`bundle generate dashboard --resource` writes relative to the cwd** (it created `deploy/databricks/…`) and does not clear "modified remotely". Only `--force` does, and that is asked each time.
- **Python on Windows writes CRLF** when it opens a file with plain `open()`. Use `newline=''`, or tests that match `\n` fail on the working copy.
- **`LATERAL VIEW` must come after every join** in Spark SQL; explode in a subquery.
- **The Databricks console shows "Automated browser control detected"** when driven from the browser pane. Read and scroll only; Nate took over.
