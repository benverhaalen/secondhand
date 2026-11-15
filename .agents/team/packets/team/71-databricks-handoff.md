# 71: Databricks handoff at the stop

Updated: 2026-11-15, about 05:45 Central (11:45 UTC). Owner: Nate. Agent: the third Databricks lead (Claude Code), stopping as its context fills. Read with [packet 55](55-team-leads-and-mac-workers.md), [spec/databricks-build.md](../../../../spec/databricks-build.md) and [databricks/DEMO.md](../../../../databricks/DEMO.md). **Judging is at 1 PM Central today.**

## What the third lead did (commit 27c3a65c)

- **Two engines, always named.** The workspace backtest's "ours" (98.5% within 20% of 39,707) is the nightly market model (`jobs/valuation/market.py`), which the app does not serve. It is now labelled "Market model" in the metric view `measures.valuation_metrics` (recreated through the Statements API), the dashboard and Genie. The served engine is the new table `measures.engine_ablation` ([14_engine.sql](../../../../databricks/sql/14_engine.sql), run by hand with `node databricks/run-sql.mjs`), copied from the engines lead's ablation in [valuation.md §9](../../../../spec/engines/valuation.md#9-proof): served 96.0% against last sale 97.4% and 90-day median 89.1% on 41,988 StockX 2019 test sales, paired gap −1.0 points (−1.4 to −0.7) on 41,452. Its columns carry comments; `vs_last_sale_points` is a rate gap, not a price gap.
- **Dashboard section 2** has a second row, "The engine the app serves trails the last sale by about a point", with four tiles and their counts. The price picker and its default now say "market model $598". Headline tiles and chart series are mid grays (`#767676` and lighter) because Databricks gives custom Vega tiles no theme and the brand ink vanished on a dark console. Rendered and read in light and dark in the browser pane after deploy.
- **Genie** says `rebuilt_exactly` means the price rebuilds exactly from the sales it cites, never "verified" or "real". `engine_ablation` is attached. Answers are recorded in the repo at [databricks/genie-answers.md](../../../../databricks/genie-answers.md), rewritten by `node databricks/genie/ask.mjs` (eight questions, the five samples among them; a test checks that).
- **Deploys:** four `node deploy/deploy.mjs deploy --target dev --profile Nate`, none forced, each "0 created" with the dashboard or Genie space changed.
- **Messages sent:** the engines lead (Lead 3) was asked when a newer served-engine reading should replace the 11-15 row (no reply by the stop). The buying-conversation lead was sent the list of what it could call today (`why`, `why_summary`, `shown_prices`, `price_basis`, the metric view, `source_rights`, `model_clearance`, `pipeline_funnel`, `locks_in_force`, `policies_in_force`, `guard_status`, the bench views, the Genie conversation API); its one named fix has not arrived. The orchestrator was sent the two spend questions below.

## Nate's answers (product/words.md, 10:45 Central, through the orchestrator)

- **Guard alert:** "it should be hourly until after judging". Measured: a lone query wakes the idle Small warehouse for 0.9 to 2.2 DBU at the list $0.70/DBU (`system.billing.usage`, `system.billing.list_prices`, us-west-oregon), $0.60 to $1.54 a run, up to about $37 a day hourly, about $1.50 daily. SQL total to 08:00 UTC: 7.34 DBU, $5.14.
- **Vector Search:** "Lets not do paid vector search". A Standard endpoint would be 4 DBU/hour at $0.07, about $6.70 a day. Not built: MI4 keeps its tables and drops the index; the product index ranks inside a group by code.
- **Mercari:** "Lets utilize mercari data the best way we can". `mercari_kaggle` (1,481,418 rows kept) stays. It is from 2018: it feeds word lists and structure, never a current-price claim.

## What is true on the workspace (`--profile Nate`)

Trial workspace, $392 of $400 credit at the morning read. Warehouse `a2d6ba8cc4538aca` is **Small** (not 2X-Small), serverless, auto-stop 10 minutes; stopped by hand at 11:40 UTC. Dashboard "secondhand: proof" `01f1e0d8d8a413f7a6bfae4c54d93c5a`; Genie space `01f1e0d8d8d3161fa9590e55702c1b46`. All merged safety fixes are deployed.

**Two schedules spend credit:**
- The hourly guard alert: measured cost and the question to Nate are above.
- The daily vacuum at 4 AM. It is small.

nightly-fits stays PAUSED.

## Works on the workspace today (checked 2026-11-15, 11:28 UTC)

- `measures.guard_status`: violations_now 0, refusals_last_7_days 0, last_checked_at 10:49:53 UTC. `measures.break_glass_windows`: 0 of 7 open.
- Alert `[dev rrenderrdev] secondhand guard violations` (id 1221157057554426): hourly, ACTIVE, evaluated OK at 11:00 UTC.
- Dashboard "secondhand: proof" `01f1e0d8d8a413f7a6bfae4c54d93c5a`: both pages render in light and dark with every figure and its count; section 2 names the market model and the served engine (commit 27c3a65c).
- Genie space `01f1e0d8d8d3161fa9590e55702c1b46`: all eight judge questions COMPLETED in `databricks/genie-answers.md` (`node databricks/genie/ask.mjs`); thin questions refuse with "too few: N sales".
- `measures.engine_ablation` (`databricks/sql/14_engine.sql`), the metric view `measures.valuation_metrics` (`13_metrics.sql`), `measures.why` / `why_summary`, `price_basis`, `shown_prices`, `source_rights`, `pipeline_funnel`, `locks_in_force`, `param_moves`.
- Warehouse `a2d6ba8cc4538aca` stopped by hand after the last check; auto-stop 10 minutes.

## Does not work, or is not joined

- `measures.bench_by_site` and `bench_cost` are empty: the two runs in `/Volumes/secondhand/raw/landing/bench/` (09:24 and 09:26 UTC) predate per-read fields, and no newer run landed.
- Genie's prose varies run to run: in the last recorded run the weight answer names no dataset or month count, the earliest-10 answer omits the dataset, and question 2 left out the market model's figure.
- `rebuilt` on the dashboard reads 42,399 of 42,405 (`measures.recompute_check`): six numbers do not rebuild. Not looked into.
- The served-engine row is a development reading: the engines lead says it goes on no public page and not in the pitch until Nate and Ben have both seen it. The dashboard judges see and `databricks/genie-answers.md` in the public repo carry it, as the orchestrator's brief asked; whether that stands is Nate's call.
- No `live:` or `captured` rows exist, so the live page (spec §8) has nothing to show.
- `databricks/test_bundle.mjs` "bronze CSV schema matches every frozen manifest column" fails on the Windows working copy; `node .agents/check.mjs` fails on Windows on files outside this change (image-gen temp folders, the ui raw-colors check, `console.log` in older databricks scripts, a stale anchor in `spec/plans/sweep/databricks.md`).

## Left, in order

1. **After 1 PM Central today, move the guard alert to daily at 4 AM** (Nate): in `deploy/resources/alerts.yml` set `quartz_cron_schedule: "0 0 4 * * ?"`, then `node deploy/deploy.mjs deploy --target dev --profile Nate` (no force), and check `databricks alerts-v2 list-alerts --profile Nate`.
2. **DBX-A1**, the buying conversation's named fix (`.agents/team/packets/team/78-buying-conversation-handoff.md#dbx-a1`): a `market.listing_obs` view, a `market.coverage` view and five functions (asks, term_trend, top_terms, sell_through, coverage_now), each returning n and as_of with a null figure under `market_min_n`. Not started.
3. The benchmark on the dashboard when integration's run lands: `load_bench`, check `bench_by_site` and `bench_cost` against the run (no Dupe rows), a section with counts.
4. Genie's summary rows: make each judge question's SQL return one row whose columns say dataset and count, rerun `ask.mjs`, read every answer.
5. The served engine's newer reading (V-AB1) after judging, from the engines lead's commit and run id: rerun the same command, replace the rows in `14_engine.sql`, rerun it and `ask.mjs`.
6. The six numbers that do not rebuild (`measures.recompute_check`).
7. The live page (Nate's call on cadence), named fixes F1 to F7 in spec §10 (F1 waits for engines' commit id). MI4 without an index, per Nate.

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
