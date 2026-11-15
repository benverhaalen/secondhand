# 71: Databricks handoff

**The one timed action that must not be lost: after 19:00 UTC today (1 PM Central), the guard alert moves from hourly to daily at 4 AM Central, deployed without force, and its schedule is read back (`databricks alerts-v2 list-alerts --profile Nate` shows `0 0 4 * * ?`, America/Chicago). Nate ruled it; it needs no further yes. The change is commit 3f76e334 on Mac branch `w/dbx-alert-1`: cherry-pick it, never merge the branch (it predates the history rewrite).**

Updated: 2026-11-15, 14:25 UTC, at the halt Nate called ("we need to stop agents from merging and working on top of eachother"). Owner: Nate. Agent: the fifth Databricks lead (Claude Code, Opus). **From now the orchestrator alone merges to main and runs the 19:00 deploy below.** Read with [packet 55](55-team-leads-and-mac-workers.md), [spec/plans/finalization.md §5](../../../../spec/plans/finalization.md) (rows DB0 to DB21, each with its state), [databricks/WORKS.md](../../../../databricks/WORKS.md) and [databricks/COVERAGE.md](../../../../databricks/COVERAGE.md).

## The guard alert change, after 19:00 UTC: exact steps for the orchestrator

Each hour it stays hourly costs about $0.60 to $1.54. Nate ruled the change; it needs no further yes. All commands on Windows with the `Nate` profile.

1. In a private worktree at current `origin/main`: `git fetch mac 'refs/heads/w/*:refs/remotes/mac/w/*'`, then `git cherry-pick 3f76e334` (from `mac/w/dbx-alert-1`; never merge that branch, it predates the history rewrite). It touched `databricks/sql/14_engine.sql`, `databricks/test_bundle.mjs`, `databricks/test_engine.mjs`, `deploy/resources/alerts.yml`. `test_bundle.mjs` has gained export and term-list blocks since, so a conflict there is likely: keep every test block from both sides.
2. `node --test --test-concurrency=1 databricks/test_bundle.mjs databricks/test_engine.mjs` must pass (at 13:40 on 0cee7916 it was 25 of 25).
3. Push to main, then from `deploy/` in the same worktree: `databricks bundle validate --strict --target dev --profile Nate` (13:40: OK), then `databricks bundle plan --target dev --profile Nate` and read every line. At 13:40 it was: create `jobs.load_observations`; update `alerts.guard_violations_alert`, `genie_spaces.market`, `jobs.governance_setup`; 0 to delete, 21 unchanged. Main has gained two jobs since, so expect also create `jobs.export_params` and `jobs.term_list` (neither has a schedule). **Stop if the plan deletes or recreates anything, or touches the dashboard or the pipeline.**
4. `node deploy/deploy.mjs deploy --target dev --profile Nate` (no `--force`).
5. Read back: `databricks alerts-v2 list-alerts --profile Nate` shows the guard alert's schedule `0 0 4 * * ?`, timezone America/Chicago. Write the read-back into this packet and `databricks/WORKS.md`.

A deploy creates and updates resources only; it runs no job and no SQL. The SQL each change carries runs later, in one warehouse session (item 2 of "Left").

## On main, with proof

| Row | Commit | Proof | On the workspace |
|---|---|---|---|
| DB1 governed fit | e1fe59a2 | `jobs/valuation/test_fit.py`, `databricks/test_guard.py` | no change needed until a source is product-cleared |
| DB2 honest purge | 5296f08d, a9b2439f | `deploy/tasks/test_purge.py` 48 | not deployed |
| DB3 observations loader | 8105cdcf | `databricks/tasks/test_load_observations.py` | not deployed (job created by the 19:00 deploy) |
| DB4 the export the server reads | 66777d1d, 34533628 (citation per row) | export and sale curve 39, export task 8, bundle 20; calibration time-split at 2019-01-01: Q_g 0.0123, holdout coverage 85.6% on 15,863 (development readings, recomputed by the lead) | not deployed; `export_params` never run there |
| DB5 Python suites in the gate | db01c98e, 12b2e1e2, 40095e0c | run by `.agents/check.mjs` | n/a |
| DB7 market functions, Genie summary rows | 4d904366, 7bb5ccc7 | `test_market.mjs` 22, `test_genie.mjs` 32 | not deployed |
| DB9 retail views | a16a3f88 | read back 13:29 UTC: `secondhand.retail.product` 952 rows, `.sales` 1,688,603, `.sales_price_forecast` 28 rows $290 to $314 inside the observed $256 to $960 | **live** (plain SQL, no deploy; the only workspace change today) |
| DB11 rights per live source, DB16 guard rules | 0bbee3f5 | guard, loader, log and backtest 358; Opus review, its four findings fixed | not run (`11_sources.sql`, `09_guard.sql`) |
| DB17 similar group, DB20 term list | f6617cac | term list 7, market 22, bundle 20; reviewed | not deployed / not run (`15_market.sql`, `03_measures.sql`) |
| DB21 Mercari columns | 40095e0c, 4cb07c1b | `test_bundle.mjs` | reload is Nate's call |

## On Mac branches, not on main

- `w/dbx-alert-1` (3f76e334): the alert change above. Tests pass. Held for 19:00 by Nate's ruling.
- `w/dbx-audit-1`: DB19 (the rights audit covers live observation bases and flags a frozen dataset in a current-price metric, additive to the views the dashboard reads). Brief `brief-dbx-audit-1.txt` in the orchestrator's notes. The worker was still running at 14:25; when it reports, the lead commits its files on the branch and leaves it there.
- Every other `dbx-*` branch is merged (`dbx-export-1`, `dbx-terms-1`, `dbx-rights-1`) or obsolete.

## Left, in order

1. The 19:00 alert deploy above (orchestrator).
2. One warehouse session with `node databricks/run-sql.mjs`, before any break-glass job runs: `ALTER TABLE secondhand.governance.principal_map ADD COLUMNS (grant_id STRING ...)` (or the setup job's `data` task), then `11_sources.sql`, `14_engine.sql`, `15_market.sql`, `15_market_check.sql` (must print nothing and drop its scratch schema), `03_measures.sql`. **Before `09_guard.sql`, count what the new DB16 rules would flag on stored rows**, so the daily alert does not fire on old rows unseen. Stop the warehouse after.
3. Rerun `node databricks/genie/ask.mjs` and read all eight answers.
4. The six citations that do not rebuild: `SELECT citation_id, metric, missing_ids FROM secondhand.measures.recompute_check WHERE NOT equal`.
5. Run `export_params` once and read `/Volumes/secondhand/raw/export/params/latest.json` back; send the engines lead the file (their EN3 reader on `w/eng-en3-1` needs `citation`, now present).
6. Read the day's spend from `system.billing.usage`; record it here and in WORKS.md.
7. Ask Nate, with the cost of one run each: DB8 (nightly fits), DB21 (Mercari reload), landing NBER in the lakehouse, a daily schedule for the guard task (the alert's staleness rule emails daily until the guard runs daily), DB12's sweep schedule, DB15.
8. DB3's first real load once the server's writer lands lines (the fixture now matches the rights rows: 73644e78); DB18, DB14 and DB13 wait on stored observations and the engines lead.
9. The DB7 EXECUTE grant for a separate API principal; the engines lead's `measures.market_score` (not designed).
10. Rights, settled: Apify is Facebook Marketplace only and those rows may fit; eBay comes through treg and our own pages and never fits ([Nate, 13:40 UTC](../../../../product/words.md#2026-11-15-nate-apify-for-facebook-marketplace-only-ebay-through-treg-and-our-own-pages)). The server and search leads confirmed their writers follow it.

## Spent

- 12:47 to 12:52 UTC: one warehouse session for the read-only proof (12 dashboard datasets, guard status, recompute check, eight Genie questions), stopped by hand. Estimated $0.60 to $1.54 (0.9 to 2.2 DBU at $0.70, the 11:00 UTC measurement); billed figure to read after judging.
- 13:23 to 13:29 UTC: one warehouse session for DB9 (dry runs, four statements, the read-back, three forecast fits of about 17 s), stopped by hand at 13:29. About 6 minutes, est. $0.70 to $1.85 at the same rate; billed figure after judging.
- The hourly guard alert keeps running until the DB0 deploy (Nate's ruling).

## Decided, one line each

- A fit that writes `core.param` reads only `comp_for_product` (row `may_model` and source `may_model_scope = 'product'`); demo-cleared fits are exported with `use_scope: hackathon_demo` and never written to `core.param`.
- Public reads land with `user_id` null (a shared row under the row filter); no user or session key may be on a landed line.
- The alert notifies `${workspace.current_user.userName}` (the deployer) so no address is written in the repo; `empty_result_state: TRIGGERED` (the schema advises against UNKNOWN).
- Calibration is exported only from the served engine's estimates; the market model's ranges would calibrate the wrong engine.

## Learned the hard way

- `git status` showed two files modified with no diff: stale index stat entries. `git update-index --refresh` cleared them; nothing to decide.
- Python on Windows reads files as cp1252: four `databricks/` tests fail there and pass on the Mac. `PYTHONUTF8=1` fixes it for the gate (the Databricks runtime is UTF-8 anyway).
- `os.getloadavg` does not exist on Windows.
- The dashboard's datasets name tables unqualified and carry their own catalog and schema; run them through the Statements API with `catalog` and `schema` set, not `aitools tools query`.
- Earlier lessons (Git Bash path conversion, unthemed Vega tiles, Genie follows "Start the answer with", the CRLF trap, LATERAL VIEW order) stay true; see this packet's history.
