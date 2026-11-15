# databricks

What runs on the lakehouse: the Unity Catalog SQL, the market pipeline, the job tasks and the checks that keep the TypeScript engines and their Python twins equal. Owner: Nate's side. The build design is [spec/databricks-build.md](../spec/databricks-build.md); the why is [spec/databricks.md](../spec/databricks.md).

## What is here

| Path | Holds |
|---|---|
| `sql/` | Unity Catalog SQL in order, `00_layout.sql` to `09_guard.sql`: layout, tables, governance, measures, learning, audit, bench, why, constraints, the money guard |
| `pipelines/market/` | the market pipeline, one SQL file per table (`sold_raw`, `comp`, `comp_daily`, `comp_for_model`, `product`, `source_manifest`) |
| `tasks/` | the Python tasks the jobs call (`load_logs`, `load_bench`, `migrate_data`, `param_walk`, `recompute`, `backtest`, `parity_job`), each with a `test_*.py` |
| `parity/` | one calculation in two languages: `fixtures/proof.json`, `proof.ts-out.json` (written by `write-ts-out.mjs`), `parity.py`, `test_parity.py` |
| `load/load.mjs` | loads the proof story into `secondhand.core` through the product code |
| `proof.py`, `break_glass.py`, `tags.mjs`, `policy-sweep.mjs` | the Python twin of `proof.ts`, audited cross-user access, governed tags, the policy sweep |
| `run-sql.mjs` | runs `.sql` files statement by statement |
| `test_*.mjs`, `test_proof.py`, `policy-sweep.test.mjs` | the tests for the files above |

## The other four places Databricks work lives

- [deploy/](../deploy/README.md): the bundle (`databricks.yml`, `resources/*.yml`) and `deploy.mjs`, the one way it reaches a workspace. It syncs `deploy`, `jobs`, `databricks` and `log`.
- [jobs/](../jobs/README.md): the Python engine twins that the jobs run (`jobs/<engine>/learn.py` and `fit.py`).
- [probes/workspace/](../probes/README.md): one-off probes that check the workspace before anything is built on it.
- [db/](../db/README.md): Lakebase (Postgres) migrations, a different system from the lakehouse.

The app's client for the workspace is `app/src/edge/databricks.ts`.

## Commands

The CLI is always used with `--profile Nate` on Nate's machine. `deploy.mjs` refuses to run without `--profile`; `run-sql.mjs` has the profile written into the script (making it a flag is an open decision in the [repo organisation plan](../spec/plans/sweep/round-2/repo-organization.md)).

| Do | Command |
|---|---|
| Validate the bundle | `node deploy/deploy.mjs validate --target dev --profile Nate` |
| Deploy to the rehearsal target | `node deploy/deploy.mjs deploy --target dev --profile Nate` |
| Deploy to prod | needs Nate's go: add `--go <words.md heading slug>`; without it the deploy is refused |
| Governed tags, before `02_governance.sql` | `node databricks/tags.mjs` |
| Run SQL files in order | `node databricks/run-sql.mjs databricks/sql/01_tables.sql ...` |
| Load the proof story | `node databricks/load/load.mjs` |
| Policy sweep | `node databricks/policy-sweep.mjs` |

Tests, one file at a time. Node: `node --test --test-concurrency=1 databricks/policy-sweep.test.mjs` (the same for `test_bundle.mjs`, `test_governance.mjs` and `test_why.mjs`). Python on the Mac: `./.venv/bin/python -m pytest databricks/parity/test_parity.py -q` (the same for `databricks/test_proof.py` and each `databricks/tasks/test_*.py`). None of these run in `node .agents/check.mjs`.
