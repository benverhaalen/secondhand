# probes

One-off checks of the Databricks workspace, run before anything is built on it (plan task T0-1 in [spec/plans/backend/plan.json](../spec/plans/backend/plan.json)). Owner: Nate's side.

## What is here

| Path | Purpose |
|---|---|
| `workspace/run.py` | runs every probe in parallel, each with a timeout and a dated verdict (pass, fail or skipped), and writes a report |
| `workspace/browser_task.py`, `workspace/app/` | the probe that runs a browser task, and the small app it deploys |
| `workspace/prepare.mjs` | prepares the probe in a temporary folder without changing repository-relative module paths |
| `workspace/test_*.py`, `prepare.test.mjs` | tests for the above |

Run: `python probes/workspace/run.py --profile Nate --report research/data/nate/workspace-checks.md [--allow-create] [--only id,id]`. With no `--profile` every probe is skipped. Probes that create resources need `--allow-create`.

## Tests

- Python on the Mac: `./.venv/bin/python -m pytest probes/workspace/test_run.py -q`
- `node --test --test-concurrency=1 probes/workspace/prepare.test.mjs`

Neither runs in `node .agents/check.mjs`.

## Pairs with

[databricks/](../databricks/README.md). The findings are in [spec/databricks.md](../spec/databricks.md). Folding these probes into `databricks/` is an open decision in the [repo organisation plan](../spec/plans/sweep/round-2/repo-organization.md).
