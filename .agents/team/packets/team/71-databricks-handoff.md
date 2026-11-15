# 71: Databricks handoff at the stop

Updated: 2026-11-15, about 04:20 Central. Owner: Nate. Agent: the Databricks lead (Claude Code), ending at Nate's call. Read with [packet 55](55-team-leads-and-mac-workers.md), [spec/databricks-build.md](../../../../spec/databricks-build.md) and [databricks/DEMO.md](../../../../databricks/DEMO.md). **Judging is at 1 PM Central today.**

## Read this first: Nate rejected the dashboard

Nate: "So i hated the dashboard. Did you even consider standards. what documentation suggests ... Understand we are being judged." He is right. Here is how it went wrong, so it is not repeated:

- **Nobody looked at it.** A Codex worker wrote `databricks/dashboards/proof.lvdash.json` from the dashboard skill's widget reference. I tested that all 26 dataset queries run, deployed it, and never opened it in a browser or had it critiqued. A passing query is not a passing screen.
- **No story.** The skill's own first rule is "KPI on the top, a temporal graph, and we see something happen". The worker built seven pages, mostly tables of governance rows (policies, grants, lineage, audit), one tab per view. That is a database dump, not an argument.
- **It skipped the repo's standards.** `product/ui-constitution.md`, `brand/constitution.md`, `product/frontend-standard.md`, `product/copy.md`, the `ui-screen` and `writing` skills, and the design-critic seat apply to any surface a person reads, the dashboard included. None of them was used.
- **It skipped Databricks' own guidance.** The [AI/BI dashboard docs](https://docs.databricks.com/aws/en/dashboards/) favour few datasets, cross-filtering, metric views as the semantic layer (they work on this workspace, see §"Platform limits"), and a Genie link from the dashboard.

**How to rebuild it** (*agent proposal*, for the next session, before more SQL):

1. Write the story first, one page and one line per beat: a price you can open to its rows (`measures.why`), how good the price is against its baselines on the same sales, a weight that changed only on evidence, isolation that holds against the owner, and what was never automated.
2. Spend at most one screen per beat. Counters with sparklines go on top, then one chart that shows the change. Tables only where a judge clicks into rows. One or two pages, not seven.
3. Back the measures with a metric view (`databricks-metric-views` skill), guarded the same way the app guards (null below n), and link the Genie space through `uiSettings.genieSpace`.
4. Render it in a browser, critique it with the design-critic seat against `ui-constitution.md` and `brand/constitution.md`, and show Nate a screenshot before deploying.
5. Draw it from the same views as the graphics in `product/graphics/` (spec/benchmark.md's last table), so the page and the workspace show the same picture.

**Deploy is blocked on the dashboard.** The deployed copy was opened in the UI at 09:59 UTC, and the UI saved `applyModeEnabled: false`; nothing else differs. `databricks bundle deploy` now refuses without `--force`. I did not force it: Nate has not said yes. The next session either gets Nate's yes to force or rewrites the dashboard and runs `databricks bundle generate dashboard` first. **Until then the latest safety fixes on main are not on the workspace** (see "Merged on main, not deployed").

## What is true on the workspace (`--profile Nate`)

The workspace is the **Databricks free trial**, not Free Edition (Nate, 2026-11-15, the Manage Trial bar shows $392 of $400 left). It was created 2026-11-13 23:14 UTC, so the 14-day trial ends about 2026-11-27 (computed; Manage Trial shows the date). Nate: this is the workspace the judges see. `spec/databricks-build.md` §1 still says Free Edition: fix it.

| What | Id or path | Shows it |
|---|---|---|
| Catalog `secondhand`: schemas `raw`, `market`, `core`, `governance`, `measures` | `databricks schemas list secondhand --profile Nate` | |
| Pipeline `secondhand-market` (SQL, serverless, bronze to silver, expectations) | `24e14a35-8b11-42b2-a6e4-ab7607a346fc` | `SELECT * FROM secondhand.measures.pipeline_funnel` |
| Bundle jobs (dev target; names start "[dev …]") | setup 29275069233023, governance-setup 963792536143648, learning-setup 260605618329371, measures-setup 186961731484218, bench-setup 371232820503746, valuation-backtest 210416107141249, param-walk 1106949072766421, recompute 4404473617820, parity 722412594723705, load-logs 922550105639464, load-bench 864523395304079, market-refresh 447093186316657, nightly-fits 468607748103095, purge-user 76885658231152 | `databricks jobs list --profile Nate` |
| Dashboard "secondhand: proof" (rejected, see above) | `01f1e0d8d8a413f7a6bfae4c54d93c5a` | `databricks bundle summary --target dev --profile Nate` |
| Genie space "secondhand market" (no question asked of it yet) | `01f1e0d8d8d3161fa9590e55702c1b46` | same |
| MLflow experiments | `/Shared/secondhand/param-walk` and `/Shared/secondhand/valuation-backtest` (written by the jobs); the bundle also declares two dev-prefixed ones, 1729249032465830 and 1729249032465831, which the jobs only use once the merged experiment-parameter fix is deployed | |
| Warehouse | Serverless Starter Warehouse `a2d6ba8cc4538aca`, auto-stop 10 min | |

**State at the stop (04:25 Central):** nightly-fits is PAUSED on the workspace, set by `databricks jobs update` and in the bundle as 8f903df1. Every other job is unscheduled and runs on demand. The warehouse is STOPPED. There are 0 open break-glass windows and 0 wildcard mappings. nightly-fits must stay paused because `jobs/valuation/fit.py` still reads all of `market.comp`, including `may_model = false` rows (row in `spec/plans/waiting.md`, owner engines). The vacuum job is in the bundle and not yet deployed. No break-glass window is open (`SELECT * FROM secondhand.governance.break_glass WHERE ended_at IS NULL` returned none at the last run).

## What the runs showed (all labelled development measurements; nothing public until both founders see it)

- **Market data.** 1,688,864 bronze rows and 1,688,603 silver comps from 6 public sets (`SELECT * FROM secondhand.measures.pipeline_funnel`). Two use scopes, each with its licence line in `governance.source_rights` (merged, not deployed):
  - StockX 2019, 99,956 rows: no licence; "released for public analysis". Scope `hackathon_demo`.
  - Mercari Kaggle, 1,481,418 rows: Kaggle Specific Rules A allow competition use only. Ben, product/words.md 2026-11-15 09:09 UTC: "if its there lets use it its for a hackathon demo". Scope `hackathon_demo`.
  - Cleared for the demo backtest: 1,581,374 rows. Cleared for a model the product ships: 0 today (`market.comp_for_product`). Grailed, Goodwill, eBay CC0 and Mercari Apify are `may_model = false`.
- **Backtest** (job SUCCESS 2026-11-15 03:55 Central). StockX sneakers, test window from 2018-11-01, 41,988 held-out sales, every contestant on the same sales.
  - model: within 20% 98.46%, median error 3.29%, range coverage 78.26%.
  - last sale: 97.41%, 3.25%.
  - 90-day sold median: 89.1%, 5.76%.
  - It wrote 122,509 shown and 1,643 hidden guarded numbers, `data = 'dataset:stockx_2019'`.
  - Shows it: `SELECT * FROM secondhand.measures.backtest_headline`.
  - StockX is easy data (identical shoes sell within about 2% of each other), so pitch the method, not the percentages.
- **Recompute.** 42,399 of 42,405 citations rebuild their basis hash exactly from `market.comp`. The 6 that do not are example-set citations whose basis lives in `core.observation`, which the job does not read. `measures.why(id)` returns `equal = true` on real model and median numbers. Shows it: `SELECT count(*), count_if(equal) FROM secondhand.measures.recompute_check`.
- **Param walk** (SUCCESS 03:44 Central). The comps half-life over 14 StockX months:
  - The 90-day prior became champion in 2017-12. A 7-day challenger beat it by 0.22 points against a noise of 0.11 and was promoted.
  - Then 13 holds and 0 rollbacks.
  - `core.param` has the change data feed on: `SELECT * FROM secondhand.measures.param_history`.
  - Engines merged their rollback fix (91df3a93): a rollback is now honest to show, but none has happened on this data.
- **Parity.** 125 cases between `proof.ts` and `databricks/proof.py` pass on the Mac. The last workspace run (20 cases, old rule) passed. The run after the re-sync failed on a lone-surrogate case; that fix is merged and not yet rerun on the workspace.
- **Isolation and masks.**
  - Catalog ABAC policies `sh_owner_only` and `sh_mask_handle` on governed tags `sh_owner` and `sh_personal`.
  - Proved on the example set: 7 of 14 guarded numbers visible to Nate, handles shown as `m***`.
  - The operator's principal is mapped to `system` and `usr_backtest`, never to a person.
- **Policy sweep.** 480 answers from the real `policy.ts`. All 32 never-performed answers refuse (`measures.never_automated`), labelled `synthetic`.
- **Guard.** The governance job's `assert_true` passed with 0 violations at 03:18 Central. But that version ran under the row filter and could only see rows mapped to the operator. The fixed guard, which runs inside break-glass and sees every row, is merged and not deployed: rerun it before quoting zero.
- **Benchmark.** Loaded runs `2026-11-15T09-24-12-452Z-baseline` (20 records) and `…-ours` (21 of 40 loaded: the duplicate-name bug is fixed on main and not deployed). Baseline: 17 of 20 ok, p50 674 ms.

## Merged on main, not deployed (deploy blocked by the dashboard)

97f53a77 guard in break-glass with sweep and `captured`; loader MERGE and skips erased people. 0eff9c9e erasure: tombstone, log rewrite, map removal, daily vacuum, governance REVOKEs. The door guard, `source_rights`, `basis_level`, the alert and spec §11. The bench key fix. The experiment-name parameter. 8f903df1 nightly-fits PAUSED. After the deploy, run in order: `setup` (migration adds `basis_level` and `reason_closed`), `erasure_setup`, `governance_setup` (why, constraints, sources, guard), `parity`, `load_bench`, `load_logs`. Then read `measures.guard_status`.

## Branches and worktrees on the Mac (`~/dev/projects/secondhand-wt/`)

All `dbx-*` worktrees (bench-1, dash-1, erase-1, genie-1, gov-1, gov-2, learn-1, live-1, market-1, proof-1, why-1) are merged into main, with nothing outstanding on their branches. They can be removed. No worker is running.

## The queue, in order (each needs a brief; owned files and done check)

1. **The dashboard, rebuilt as above.** Owns `databricks/dashboards/`, `databricks/sql/10_dashboard.sql`, a metric view file. Done: a rendered screenshot that Nate approves, then a deploy.
2. **Deploy, then the setup chain** listed above. Done: `measures.guard_status` violations_now = 0 from a break-glass run, and `parity_check` all equal.
3. **Ask the Genie space the 10 benchmark questions** and fix what it gets wrong (`databricks/genie/market.json`). Done: the two thin questions refuse with their count.
4. **`core.param.origin`** column (`event`, `fit`), through `migrate_data.py`, plus a guard rule listing other values (engines 0001_param_origin.sql). Done: `test_migrate_data.py` passes, and the column exists on the workspace.
5. **Mask or drop payload columns** that carry buyer or seller text (security audit #3, `01_tables.sql:23`).
6. **Secret scope ACL** (audit #4). The scope holds no secrets today; the only ACL is the owner's MANAGE.
7. **The served-fit rule**: no champion marked served may read anything but `comp_for_product`. Dropped from the last round as non-safety.
8. **The fallback-level view by week** once engines' `guard()` writes `basis_level`.
9. **Fix the build page:** trial not Free Edition; the §8 dashboard description; README for `databricks/`.

## Decisions made, one line each

- One catalog `secondhand`; the market data is pipeline-owned in `market`, the canon rows in `core`. Public comps carry no owner, so they are not `core.observation`.
- Isolation and masking as catalog ABAC policies on governed tags, not per-table ALTERs (works on this workspace).
- The guard is a view plus a door check, a failing job and an alert, because the platform refuses CHECK constraints on row-filtered tables.
- Maintenance passes the owner filter only through a logged, time-boxed break-glass ('*' mapping); the guard sweeps any unlogged one.
- Per-source use scope (`hackathon_demo` and `product`), agreed with the orchestrator.
- The param walk's noise is the 95th percentile of the centered paired bootstrap, 200 draws, seed 7.
- `DEMO.md` holds queries, not numbers, so nothing public carries an unreviewed figure.

## Waiting on Nate

- Yes or no to `--force` on the dashboard, or a redesign first.
- Unity Gateway service policies beta (optional; claim checks at the gateway).
- The `sh-probe` app and Lakebase project (delete or keep).
- Whether Mercari's competition data stays for the demo (today: yes, scope `hackathon_demo`).

## Platform limits met (exact errors, 2026-11-15)

- `[ROW_LEVEL_SECURITY_CHECK_CONSTRAINT_UNSUPPORTED] Creating CHECK constraint on table secondhand.core.guarded_number with row level security policies is not supported.`
- `[DELTA_NEW_NOT_NULL_VIOLATION] 53 rows in secondhand.core.observation violate the new NOT NULL constraint on data`: the owner filter hid other people's rows from the owner's own job.
- Serverless `spark_python_task` has no `__file__` (`NameError`); entrypoints take `--root ${workspace.file_path}`.
- SQL file tasks split on every `;`, so `BEGIN … END` fails (`PARSE_SYNTAX_ERROR … end of input`).
- `[UNSUPPORTED_FEATURE.TIME_TRAVEL] … Time travel on the relation secondhand.market.comp_for_model`: MLflow `load_delta` must point at the table, not the view.
- A lone surrogate cannot be written to a Delta string (`UnicodeEncodeError … surrogates not allowed`).
- The CLI's `aitools tools query` drops indented YAML, so metric views go through the Statements API (`MSYS_NO_PATHCONV=1 databricks api post /api/2.0/sql/statements`).
- Pipelines refuse a single-asterisk glob in libraries; use `**`.
- Bundle resource keys must be unique across types (an experiment and a job both named `param_walk` fail validation).

## What this session learned the hard way

- **Look at what a judge sees.** I verified queries and tests and never opened the dashboard. Any visual surface needs a render, a critique against the constitutions, and Nate's eye before deploy.
- **Check the workspace type from the UI or the account,** not from a feature count. "Looks like Free Edition" was wrong, and it shaped limits for a day.
- **The owner filter applies to the owner's own jobs.** Every maintenance job and the guard need the logged break-glass; a guard under the filter can pass while it is blind.
- **Two sessions fetching the Mac remote at once fail to lock refs.** Fetch one ref (`git fetch mac 'refs/heads/w/<name>:refs/remotes/mac/w/<name>'`) and check the merge landed before deploying.
- **`node -e` inside bash with backticks runs them as commands.** Use the Edit tool or a file for any text with backticks.
- **A brief must name a file's current owner.** Two workers editing `backtest.py` and `test_why.mjs` cost a round each.
- **The committed Mercari manifest lists `retail_cents` and `released_at` twice** (engines' refreeze 7da6cb5e). `databricks/test_bundle.mjs` fails on it today, and the next uploaded refreeze would break the bronze schema. Engines' fix.
