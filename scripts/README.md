# scripts

Command-line tools run from the repo root: lint and codegen, the app's render checks, demo recorders, benchmarks. Each script's header comment says how to call it.

## Scripts

| Script | Does |
|---|---|
| `copy-lint.mjs`, `listing-lint.mjs` | copy lint for words in the app; one listing draft built and checked for one marketplace |
| `tokens-to-ts.mjs`, `icons-to-ts.mjs`, `media-css.mjs` | write `tokens.generated.ts`, `icons.generated.ts` and `brand/media.css` |
| `ui-rules.mjs`, `ui-states.mjs` | the UI rule set and the edge states the UI knows |
| `brand-check.mjs` | checks a rendered page or deck against the brand |
| `app-check.mjs`, `app-gallery.mjs`, `app-demo.mjs` | per-screen render checks into `features/app/renders/`, the gallery page, a flow recorded as a video |
| `demo.mjs`, `demo/` | records the app on sample data; `demo/` holds the eBay, want, alert and stage-watch demos |
| `walk.mjs`, `walk-fixtures/` | the fixture walk, no network |
| `prove.mjs`, `runs.mjs`, `evidence.mjs` | run a plan task's check, trace an observed run from logs, list what the spec and research settle for a feature |
| `crosslist.mjs`, `capture-real.mjs`, `capture_real_score.py` | cross-list a Depop shop; map and score real captures |
| `font-tnum.py` | give a font tabular figures |
| `mac-worker.sh` | start one Codex build worker in its own worktree |
| `bench/` | backtest, gate, photo, seasons, cadence, hands-on and roi benchmarks; `out/` holds run results |

## Imported by the app

`app/metro.config.js` lists `../scripts` as a Metro watch folder, so these paths are pinned. Do not move them without changing the config and the `bundle` check together.

- `copy-lint.mjs` and `listing-lint.mjs`: imported by `app/src/engines/capture/` and `app/src/engines/listing/` (`listing/build.ts` imports `buildTitle` and `lint`).
- `brand-check.mjs`: imported by `app/e2e/behavior.mjs`.
- `tokens-to-ts.mjs` and `icons-to-ts.mjs`: write generated files in `app/src/ui/`; the repo check fails when they differ.

## Tests

One file at a time: `node --test --test-concurrency=1 scripts/walk.test.mjs`. The check runs `scripts/*.test.mjs`. Python: `./.venv/bin/python -m pytest <file> -q` on the Mac.

## Pairs with

`.agents/checks/` (the checks these scripts feed), `app/e2e/`, and `bench/` for the open benchmark.
