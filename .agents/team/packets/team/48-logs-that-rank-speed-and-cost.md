# 48: Logs that rank speed and cost

Updated: November 15, 2026. Owner: Ben. Agent: Claude Code, project thread "Set up logging of everything". Branch: `main`. Status: the timing line, the ranking report and the timed repo check are on `main` and tested. Nate's code is not changed; the gaps in it are listed below for Nate's agent. Source: Ben, 04:36: "ensure that logging is doing well on everything and logging can effectively create ways to hillclimb speed and efficiency if need be across both me and nate's work; the whole repo".

## What changed
- A new event, `timing` (`name`, `ok`, `ms`), for work that stays inside a process: a check, a test file, a build step, a pure engine on a hot path. JS: `log.timed('engine.score', () => score(x))`, which keeps sync code sync and awaits a promise. Python: `log.timed('photo.crop', fn)` and `await log.atimed(...)`. A throw is logged at level error and rethrown.
- `node log/climb.mjs logs/*.jsonl` ranks every logged piece of work (calls and timing lines) by total time, then the time failures threw away, then cost and tokens, then jobs split into the wait before they ran and the run, then agent runs with the cost of their calls. How to run a climb is in [log/README.md](../../../../log/README.md#hill-climb).
- `node .agents/check.mjs` now writes `logs/check-<id>.jsonl`: one timing line per check and per test file (its tests, failures and slowest test). CI keeps that file as the `check-timings` artifact for 30 days.
- image-gen logs each job's `queued` line (so its wait shows), the token count of each Codex call, and a failed or skipped job with its error, which the checker used to reject.

## What the first report shows
On one local run of the check (93 s wall): `.agents/checks/render.test.mjs` is 79% of all test time (141 browser tests, 91 s, run one after another), the image-gen tests are 12% (one timeout test alone takes 6 s), and every check together is under 1 s. So the one win worth a climb on the check is the render tests. No program logs cost yet, so the cost section is empty.

## For Nate's agent
Nothing here blocks you. These are the places in your code where the log cannot rank or explain a run yet; take them when you next touch each file. The calls are in [log/README.md](../../../../log/README.md#use-it).
- **Python jobs** (`jobs/*`, `deploy/tasks/fold.py`, `deploy/tasks/purge.py`, `probes/workspace/*.py`): none starts a log. One `create_log` per process, `log.job` for its states, `log.call` around each outside call (`purge.py` and `browser_task.py` make them), and `log.timed` around the steps you want to speed up.
- **Python tests are not run by `node .agents/check.mjs`**, and this machine has no pytest, so a broken job test does not block a push. Say whether they should run there.
- **Calls with no `log.call` around them** (the check warns): `app/src/app/index.tsx`, `app/src/edge/harness/cookie/cookie.ts`, `app/src/edge/harness/repair.ts`.
- **Prints the check rejects**: `app/src/edge/intel/extract-live.ts` (lines 49 to 61), `app/src/edge/sold/run.ts` (10, 20), `db/migrate.mjs` (46).
- **Own randomness**: `app/src/edge/events/ports.ts` uses its own random; use `log.random()` so a run replays.
- **Edge folders with no logging yet**: `assist`, `buy`, `gate`, `orders`, `replay`, `today`, `watch`. The Expo screens in `app/src/app` log no `ui.show` or `user.input`, so tap-to-screen time cannot be measured (step A in the README).
- **Model calls**: put `model`, `tokens_in`, `tokens_out` and `cost_usd` in each model call's describe function, or the cost section stays empty.

## Also on main, not from this change
The check fails on main before this change: `spec/fixtures` "hash pinned" and `spec/sites.test.mjs` "no product code carries its own copy of an offer clock" fail, `app/src/edge/intel/jev.test.ts` holds what the secrets check reads as an OpenAI key, `app/src/engines/trust/hard.ts` and `signals.ts` import from `edge/`, several `research/*/nate/` notes lack the research header, and two vendored skill links are broken. `app/src/edge/data/data.test.ts` and `app/src/engines/param/sql.test.ts` need `@electric-sql/pglite` installed.

## Next action
Nate's agent wires the Python jobs to the logger and adds `log.timed` around the steps it wants faster; whoever owns the render tests runs a climb on them with `node log/climb.mjs` as the measure.
