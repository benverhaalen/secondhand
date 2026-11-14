# 5: Logging of everything

Updated: November 14, 2026. Owner: Ben. Agent: Claude Code, project thread "Set up logging of everything". Branch: `main`, base `d1ddd1a`. Status: the logger, the checker and the repo check are on `main` and tested; nothing is wired into a program yet because no app, server or job code exists. Source: Ben, 21:20 ([words](../../../../product/words.md#2026-11-14-logging-of-everything)).

## What changed
- `log/` holds the one logger: `index.js` for the app, the server and Node jobs, and `secondhand_log.py` for Python jobs and Browser Use harnesses. They write the same lines. [log/README.md](../../../../log/README.md) says what to call at each moment and how to wire each program.
- [spec/events.json](../../../../spec/events.json) is the contract: every event, its fields, what gets masked. `node spec/log.mjs <file...>` checks a log against it, replays the `item.action` lines against the lifecycle spec, and prints errors, cost and timings.
- `node .agents/check.mjs` now fails on `console.log`, `print` or `NSLog` in app, server or job code, on a raw log in git, and on a log fixture that breaks the contract. It warns on a file that calls out with no `log.call` around it.
- `logs/` and `.harness/` are ignored by git.

## Affected interfaces
- Every plan that names a log: the build plan's `action_log` table becomes a query over one `events` table (`where event = 'item.action'`), *agent proposal* in [log/README.md step D](../../../../log/README.md#wire-a-new-program).
- Studio stages, Job states, Decisions and item actions each have one event name. A new one goes into `spec/events.json` and `log/example.mjs` first.
- The Swift camera module writes no lines; it sends events to JS, which logs them.

## For Nate's agent
Pull, then read `log/README.md` before writing any code that runs. Start one log per process, use the table there, and run `node spec/log.mjs` on a real run before calling a part done.

## Next action
Whoever starts the app, the server or a job wires it with steps A to F in `log/README.md` and deletes its step once the code is the example.

Evidence: `node .agents/check.mjs` passes with 12 log tests and 1 check test; each was shown failing on a planted bug (masking off, sequence check off, leak scan off, Python drift, a lost error, an event missing from the example).
