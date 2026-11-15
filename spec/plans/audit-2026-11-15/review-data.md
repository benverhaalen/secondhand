# Data-platform review: Databricks bundle, SQL, jobs, migrations (main, read-only)

Coverage note: I read the bundle (databricks.yml and all of resources/*.yml), tasks/fold.py, tasks/purge.py, tasks/guard_job.py, databricks/guard.py, break_glass.py, sql 09/11/12 in full, parts of 01/02/04/13/14, pipelines/market/comp_for_model.sql, jobs/valuation/fit.py (lines 1-140), jobs/identity/test_learn.py, app/src/edge/databricks.ts. I did NOT read in full: sql 03, 05, 06, 07, 08, 10, the dashboard JSON, Genie JSON, loaders (migrate_data.py, load_*.py), bench/, the other engines' learn.py, db/migrations other than 0004 and 0001 lines. Findings below rest only on what I read; the unread area is not cleared.

## 1. Bugs, ranked by consequence

### B1 (high). The nightly fold writes the registry to the wrong schema. Unpausing it would not feed the app's param store.
deploy/databricks.yml:56 passes `"--schema", "${var.market_schema}"` (default `market`), and deploy/tasks/fold.py exports it as SECONDHAND_SCHEMA. jobs/valuation/fit.py:
- `SCHEMA = os.environ.get("SECONDHAND_SCHEMA", "secondhand")` then `registry_table = f"{CATALOG}.{SCHEMA}.param"` -> `secondhand.market.param`.
- The real registry is `secondhand.core.param` (databricks/sql/01_tables.sql:80; guarded by governance row filter and used by 04_learning.sql:78,124).
Failure: the first promotion writes `saveAsTable("secondhand.market.param")` (a new ungoverned table with no row filter, no tags, no owner column), while `measures.param_moves` and the guard read `core.param`. Same for `valuation_fit` (lands in market). Smallest fix: give fit.py (and each learn.py) a separate `CORE_SCHEMA = "core"` for registry writes; read comps from SCHEMA, write params to `core`.

### B2 (high). nightly_fits fits on rows it may not model on. The pause is the only guard.
databricks.yml:41-43 admits it. jobs/valuation/fit.py ROWS_SQL reads `{cat}.{sch}.comp`, not `comp_for_model` (the view at databricks/pipelines/market/comp_for_model.sql is just `WHERE may_model = true`, with no scope check, so a `hackathon_demo` row passes it into a shipped fit). Failure: the day someone unpauses, grailed/ebay/apify rows (may_model false) enter the fit; and even `comp_for_model` would admit `hackathon_demo` rows into a served param. Smallest fix: read `comp_for_product` for any job that writes `core.param` and `comp_for_model` only for the backtest job; change the `comp_for_model` view to also require `scope in ('hackathon_demo','product')`. Add a test that ROWS_SQL names no bare `comp`.

### B3 (medium). `fold.py` reports a green job when an engine is skipped or its import path is wrong.
deploy/tasks/fold.py: `run` returns a "skipped" state when the file or `main()` is missing, and puts `path.parent` on sys.path, not the repo `jobs/` root. fit.py compensates itself (`sys.path.insert(0, ROOT/"jobs")`), but an engine whose `learn.py` has `from valuation import market` without that line fails on the workspace and passes locally under conftest. Several engines have `learn.py`, the fold has 9 tasks and any `skipped` is indistinguishable from "ran". Smallest fix: make a skipped engine exit non-zero when the engine folder has a `learn.py`/`fit.py` but no `main`, and insert `ROOT/"jobs"` in `run`.

### B4 (medium). Guard alert has no recipient.
deploy/resources/alerts.yml: no `subscriptions`; `notify_on_ok: true`, hourly, UNPAUSED. On a trial workspace this burns a serverless warehouse run per hour (the lead already plans daily after judging) and notifies nobody. A judge who triggers a violation sees the dashboard turn red, not an email. Fix: add a `subscriptions: - user_name: <founder>` (an operator choice, not mine) or accept the dashboard as the only surface.

### B5 (medium). `guard_status` is empty until the guard job has run; the alert returns zero rows, state OK.
09_guard.sql `guard_status` reads the latest snapshot with `LIMIT 1`; `empty_result_state: OK`. Before the first guard run, or after the snapshot table is lost, the alert says "fine" with nothing checked. Fix: `empty_result_state: UNKNOWN`, or have the view return a row with `violations_now = NULL` and age.

### B6 (medium). 09_guard.sql is not safe to re-run by hand; only the job guards it.
Top of file: `ALTER TABLE ... ADD COLUMNS (reason_closed STRING)` fails the second time. guard_job.py handles this via `guard_setup_plan(..., reason_closed_exists=...)`, but `node databricks/run-sql.mjs databricks/sql/09_guard.sql` (the documented manual route) breaks on any second run. Fix: put the column in the CREATE TABLE (for fresh) and drop the ALTER from the file; keep the job's conditional add.

### B7 (medium). break_glass has no lease per grant.
databricks/break_glass.py: the `finally` deletes `principal_map WHERE principal = current_user() AND user_id='*'` and closes the audit row by principal. Two overlapping purges (purge_user has no `max_concurrent_runs` at databricks.yml:88-103, default 1 for jobs, but each run with a different `user_id` queues, so this is low) or a purge plus the guard run (guard_job.py `run_guard` also wraps in `break_glass`) by the same service principal can close each other's wildcard: guard finishes, deletes the wildcard under a purge in flight, purge's remaining `DELETE`s then run under the row filter and delete zero rows; the post-delete count check (purge.py:74-76) reads the same filtered view, counts 0, and the purge records "done" with rows left. Fix: take the purge's counts through the break_glass wildcard only after re-verifying `principal_map` still holds `'*'`, or give the audit row an id and the principal_map row `grant_id`. Set `max_concurrent_runs: 1` on purge_user explicitly and run guard from a different principal than purge.

### B8 (medium). Purge counts could read 0 for the wrong reason.
purge.py:74: `SELECT count(*) ... WHERE user_id = :user_id` is under the row filter. If the wildcard is absent (see B7), count is 0 by filter. Add a count asserted from `governance.principal_map` that the wildcard exists immediately before the counts, or read counts through `system.information_schema` / table `DESCRIBE DETAIL` numRecords before and after.

### B9 (low). purge: capture and log scrubs run after the tombstone but a failure after `principal_delete` leaves a half-erased user.
purge.py:77-85: principal_map is deleted (user can no longer be resolved) before `rewrite_logs` and `delete_captures`. If either raises, `erasure.purged_at` stays NULL (fine, honest) but the rerun's `principal_delete` is a no-op and the job can be rerun safely; also `files.download(...)` loads whole JSONL files in memory. Acceptable; flag only for volume size.

### B10 (low). Deletion keys on `user_id` only; JSONL scrub keys on `user`/`user_id` fields only.
purge.py:126. A log line whose owner is nested (e.g. `data.user_id`) survives. Cannot verify without the log schema; check log/ for nested ids.

### B11 (low, judge-visible). Hard-coded benchmark literals in 14_engine.sql.
databricks/sql/14_engine.sql:37: `('market_model', ..., 0.985, 0.792, 0.136 ...)` are typed constants, not computed. The audit page's "98.5% within 20%" rests on a literal in a VALUES list; the Genie answers will quote it as warehouse truth. Fix: label in the row comment, or read it from `measures.backtest_headline` with the run id.

### B12 (low). `observation` has no `may_model`/`use_scope` column.
01_tables.sql:10-28 has only `rights_mode`/`retention_class`; the rights tags (`may_store`, `may_model`, `may_show`, `may_share`, `ttl_days`) sit on `core.evidence` (01_tables.sql:42-45). The ruling "apify rows shown-only, `use_scope hackathon_demo`" has nowhere to live per row except `evidence`, and `evidence` has no `use_scope`. The `comp_for_product` view joins `market.comp` to `source_rights` by source, which is a source-level rule. A per-row `use_scope` is not representable. Pick one: derive the rule from `source_rights` by `evidence.source` (needs a source column on evidence) or add the column.

## 2. The three failing tests and two collection errors (causes confirmed by running one file each)

1. databricks/test_guard.py::test_every_source_has_explicit_demo_and_product_clearance_with_the_original_terms. Line 165: `assert len(sql.split(';')) == 5`. 11_sources.sql now ends with `CREATE OR REPLACE TABLE ...locks_in_force` (lines 68-72), so there are 5 statements and the file ends with `;\n`, giving 6 split pieces... pre-existing stale count; code correct. Fix: assert no `;` remains inside a string literal after stripping `chr(59)` (the behavior the message names) or expect 6.
2. deploy/tasks/test_purge.py::test_delete_failure_revokes_grant_and_closes_break_glass_without_done_decision. Line 44 `statements[0].startswith('INSERT INTO ...principal_map')`. break_glass.py (commit 97f53a77) now inserts the break_glass audit row first, then the principal_map wildcard. Stale test; code is the safer order (the grant is logged before it exists). Fix: expect `break_glass` first, `principal_map` second.
3. jobs/identity/test_learn.py::test_param_rows_have_exact_registry_shape. Ran it: `set(row) ^ set(template) == {keep, previous_version, origin, days_since_last}`; the template app/src/engines/param/row.json has these four, the Python `param_row` in jobs/identity/learn.py does not emit them. Real drift, not a stale test: the TS side added `origin`, `previous_version`, `keep`, `days_since_last` (commits 2dafb554 and 1695c7d9, "rollback ... restores the champion"), the Python rows were not updated. A Python-written row would fail the app's validator when read. Fix: add the four fields to `param_row` (`origin='fit'`, others None) and to every other engine's `param_row`; one shared helper in jobs/param would stop the next drift.
4. Collection error jobs/measures: tests do `from jobs.measures.attributes import record` (test_attributes.py:2, test_brand_premium.py:5, test_index_slice.py:3,4). jobs/conftest.py puts `ROOT/jobs` on sys.path, but the package `jobs` needs `ROOT` on it. Fix: add `sys.path.insert(0, str(ROOT))` to jobs/conftest.py (or change the imports to `from measures.attributes import ...`, matching the other engines). I confirmed the error by running `python -m pytest measures/test_index_slice.py`.
5. Collection error jobs/studio: `import cv2` at module top of bench_relay.py, check.py, measure.py, proof.py, slides_run.py. Fix: `collect_ignore = ["studio"]` in conftest unless cv2 is installed, or `pytest.importorskip("cv2")` at the top of each studio test.

## 3. Shortest path to the product really writing to and reading from the lakehouse

Facts: the app writes only `jobs.put({kind:'search'})` (search.ts:249) in Postgres; db/migrations/0001_base.sql:11 says Delta-only for observation; `core.observation` exists in Delta (01_tables.sql:10) but nothing writes it from the app; the app reads the workspace only in `GET /v1/health` (app/src/edge/databricks.ts, one SQL Statements call at 30s wait).

Smallest honest design (agent proposal):
1. Write path. In search.ts after the result is built, append one JSONL line per listing to a landing volume `/Volumes/secondhand/raw/landing/observations/<date>.jsonl` (Files API PUT, one file per search), not a SQL INSERT per row. Reasons: the Statement API INSERT cost is one warehouse-second per statement and a cold serverless warehouse takes 5-30s; the Files API has no warehouse cost; the log loader pattern already exists (`load_logs` job in proof.yml, JSONL volume -> MERGE) and purge already scrubs `/Volumes/.../landing/logs`, so erasure covers it by extending `rewrite_logs` to the new directory. Columns = observation columns above; `data = 'live:<site>'`, `user_id` the signed-in owner else the anonymous session owner, `rights_mode` = `own_scope`. Apify rows: `evidence` with `may_model=false, may_show=true, may_store=true`; Dupe rows are never written (the writer is a branch on source; test that it refuses).
2. Fold. One new bundle job `observation_load` (spark_python_task or SQL task with `COPY INTO`/Auto Loader) every few hours or on file arrival, MERGE into `core.observation` and `core.evidence`; guard door `guard_batch(spark, log, job, 'observation', rows)` already exists in databricks/guard.py. Cost: one serverless run (~1-3 min, a handful of DBUs) per run; trial credits make hourly unwise, daily is enough for a demo, plus on-demand `bundle run`.
3. Read path. Do not query the warehouse per valuation. Nightly (or after `observation_load`) a job exports `core.param` champion rows and the comps for the product to a JSON file in a volume (or Postgres `param` via the 0004_param.sql shape: the table and row.json already match, and valuations.ts hard-codes param_version 1 today). The app loads the file/param rows at boot and on a TTL (60 s), mirroring the existing `readParam` pattern. A warehouse round trip per request is ~1-5 s warm and 10-30 s cold; not acceptable for `/v1/valuations`.
4. Fold job. `nightly_fits` as bundled, after B1 and B2, valuation task only first (identity/negotiation next). Workspace cost: serverless environment spin-up ~1-2 min plus the fit; ~9 tasks in the DAG, run valuation alone for the demo.
5. Provable without the workspace: (a) the writer's JSONL line shape against observation columns and `guard.check('observation', rows)` (pure, tested in databricks/test_guard.py style); (b) the source branch (Apify marked, Dupe refused) as a unit test; (c) purge of a fixture JSONL through `rewrite_logs` with a fake `files` client (test_purge.py pattern); (d) param row shape against `row.json` (fixes failing test 3). Only the MERGE, the row filter and the fold itself need a run.

## 4. What a judge can be shown today, and the likeliest failure for each

- Dashboard "secondhand: proof" (resources/dashboard.yml, `embed_credentials: false`): the viewer needs `SELECT` on `secondhand.measures` and warehouse CAN_USE; a judge account without both sees empty widgets. Also the headline reads the nightly model, not the served engine (see B11); the page for the judges must say which one.
- Genie space (`genie.yml`, databricks/genie/market.json): the likeliest failure is a question outside the curated tables or on `locks_in_force` (a snapshot, stale between governance runs: 11_sources.sql:68-72). Stay with questions the sample list covers.
- Governance guard (09_guard.sql + guard_job.py): the violation demo needs a write that breaks a rule. The cleanest failure is `guard_status` returning no rows before the first run (B5); run the guard once beforehand. The 60-minute stale break_glass sweep and the unlogged wildcard sweep are both demonstrable.
- Lineage: Unity Catalog lineage only exists for tables written by jobs/pipelines in this workspace; tables created by SQL files show lineage only if the SQL read from other UC tables. The market pipeline (DLT) has lineage; `core.*` tables written by `migrate_data.py` may show a single node. Check in the UI before the demo.
- Erasure: `purge_user` with a seeded usr_ id. Likeliest failure: B7/B8 (count passes by filter) or the 7-day delayed VACUUM leaves the physical files for a week by design; say so. `delete_captures` needs the `raw/captures` volume to exist and the job principal to have volume write; `WorkspaceClient().files` on serverless needs the default auth, which the job gets. Check that `user_id` param default `""` makes a parameterless run fail fast (validate_user refuses it; good).

## 5. Python suite in the gate

Needed: (1) conftest ROOT on path (fixes `No module named 'jobs'`); (2) collect_ignore studio or importorskip cv2; (3) fix param_row drift (test 3) and the two stale databricks/deploy tests; (4) a `requirements.txt` install step (jobs/requirements.txt exists; confirm it lists numpy, scipy, lightgbm, pytest); (5) add to .agents/check.mjs a step `python -m pytest databricks deploy jobs -q` guarded by `python` presence (skip with a loud note if absent) and to .github/workflows/check.yml a `setup-python` + `pip install -r jobs/requirements.txt` step. After (1)-(3) the lead's count (304 passed) becomes all green; I did not run the full suite, only the three single files named above.

## 6. Solid, do not touch

- Erasure ordering in purge.py: tombstone first, DELETE, REORG PURGE, count, principal_map removal, then audit; `validate_user` regex; delayed VACUUM RETAIN 168 HOURS with `vacuum_due_at`.
- break_glass log-before-grant order and the guard's unlogged-wildcard and stale-grant sweeps (guard_job.py `sweep`).
- guard.py DATA_PATTERN (Java line-terminator handling) and the refusal persistence in `guard_batch`; the 11_sources.sql rights table with `chr(59)` handling; `comp_for_product` empty by design; `model_clearance` separating demo from product.
- app/src/edge/databricks.ts: server-only, token from env or CLI, no secret in files, logged via log.call.

## Commands run and exit codes
- `python -m pytest identity/test_learn.py -x -q` (in jobs/): exit 1, the shape failure above.
- `python -m pytest measures/test_index_slice.py -x -q` (in jobs/): exit 2, collection error above.
- Earlier in the session (before compaction): the two failing files under databricks/ and deploy/tasks/, failures as in section 2.
- A Python one-liner that built a FakeStore row to diff its keys against row.json; no workspace, CLI, job or SQL was run.

## Out of scope / pre-existing
- No workspace contact. packets/ and spec/plans/ not opened. All five failing/erroring items above pre-exist this review. Style not reviewed. Unread areas listed at the top.

## Verdict
Fix first: B1 and B2 (nightly fold misdirected and ungoverned) must land before nightly_fits is unpaused; the rest is demo-hygiene.
