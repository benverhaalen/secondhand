# jobs

The Python engine twins and their tests, one folder per area. The jobs in the Databricks bundle run these files; the TypeScript engines in `app/src/engines/` are the ones the app calls. Owner: Nate's side.

## What is here

| Folder | Purpose |
|---|---|
| `valuation/` | market value fit, experiments, synthetic market data |
| `identity/` | item identity: clusters, codes, groups, citations |
| `analytics/` | funnel and learning jobs, with `fixtures/` |
| `demand/` | demand direction, ensemble, event effects |
| `style/` | listing style: alternatives, edits, evidence |
| `capture/` | capture: item type, process, notes, suggestions; `process.json` |
| `photo/` | photo crops, gates, export |
| `studio/` | studio looks, measures, slide runs; `slides.json` |
| `trust/`, `negotiation/` | fits, params and simulations for trust and offers |
| `score/`, `person/`, `param/` | score fit, the per-person fold, the param registry |

`pytest.ini` uses `--import-mode=importlib` because `test_learn.py` exists in many folders.

`jobs/capture/follow_ups.py` and `next_view.py` are superseded by `app/src/engines/capture/plan.ts` (their own headers say so). They stay so their tests and the param priors they name remain readable; build nothing new on them. Retiring them is an open decision in the [repo organisation plan](../spec/plans/sweep/round-2/repo-organization.md).

## Tests

One file at a time, on the Mac: `./.venv/bin/python -m pytest jobs/capture/test_note.py -q`. These suites are not part of `node .agents/check.mjs`.

## Pairs with

[deploy/](../deploy/README.md) (the bundle syncs `../jobs`; `deploy/tasks/fold.py` runs an engine's fold) and [databricks/](../databricks/README.md). `jobs/capture` is also a Metro watch folder for the app (`app/metro.config.js`), so it does not move freely.
