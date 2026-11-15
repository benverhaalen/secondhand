# deploy

The Declarative Automation Bundle that puts the Databricks work on a workspace, and the script that is the one way to deploy it. Owner: Nate's side.

## What is here

| Path | Purpose |
|---|---|
| `databricks.yml` | the bundle: targets `dev` and `prod`, and the folders it syncs (`deploy`, `jobs`, `databricks`, `log`) |
| `resources/` | one file per piece, so two builders never edit the same file: `setup`, `governance`, `market` (the pipeline), `learning`, `bench`, `proof` |
| `deploy.mjs` | `validate` or `deploy` with `--target dev` or `prod`; `--profile` is required; scans every synced file for secrets first; a prod deploy needs `--go <slug>` |
| `tasks/` | tasks the bundle's jobs run: `fold.py` (an engine's nightly fold), `purge.py` (delete a person's rows) |

Run it: `node deploy/deploy.mjs validate --target dev --profile Nate`. On Nate's machine the profile is always `Nate`.

## Tests

- `node --test --test-concurrency=1 deploy/deploy.test.mjs`
- Python on the Mac: `./.venv/bin/python -m pytest deploy/tasks/test_purge.py -q`

Neither runs in `node .agents/check.mjs`.

## Pairs with

[databricks/](../databricks/README.md) (the SQL, pipeline and tasks the resources point at) and [jobs/](../jobs/README.md) (the Python the jobs run). The design is in [spec/databricks-build.md](../spec/databricks-build.md).
