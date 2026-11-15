# 55: team leads and Mac workers

Updated: November 15, 2026, about 02:30 Central. Owner: Nate. Agent: Claude Code, the build orchestrator. Status: four team-lead sessions run on the Windows machine, each sending build work to Codex workers on the Mac.

Nate asked for this ([words](../../../../product/words.md#2026-11-15-nate-opus-team-leads-that-send-out-to-codex)). This packet is the one place the working rules live; a lead's brief names its area and points here.

## The leads

| Lead | Holds | Does not touch |
|---|---|---|
| databricks | `databricks/`, `jobs/`, `spec/plans/sql/`, the Databricks parts of `spec/data.md` and `features/data/` | engine code in `app/src/engines/` |
| engines | `app/src/engines/`, `jobs/` engine twins, `spec/engines/*.md` except `capture.md` and `photo.md`, `spec/determinations/money.md`, `market-insight.md`, `listing-and-marketing.md`, `managing-and-buyers.md` | `app/src/edge/harness/`, `app/src/edge/browser/` |
| capture | `spec/engines/capture.md`, `photo.md`, `identity.md` (shared with engines: ask first), `spec/determinations/capture-shots.md`, `fields-by-kind.md`, `seeing-the-item.md`, `asking-and-intent.md`, the capture and identify code in `app/src/engines/` and `app/src/edge/api/` | Ben's screens in `app/src/app/` outside `v1/`, `app/src/ui/` |
| integration | `app/src/edge/api/`, `app/src/app/v1/`, `scripts/walk.mjs`, `spec/examples/`, `spec/plans/board.md`, the joins between engines, harness and Databricks | the inside of an engine: it sends the owning lead a message |

The orchestrator (the session that started the leads) holds the harnesses in `app/src/edge/harness/` and `app/src/edge/browser/`, `spec/product.md` canon changes, and anything Nate says. A change to a name or state in `spec/product.md` goes to the orchestrator as a message with the exact rows; a lead never edits canon on its own.

## What a lead does

1. Reads its area: the spec pages, the code, the tests, the board rows. Finds what is wrong, missing, built on made-up data, or not joined to its neighbours.
2. Decides the design itself and writes it into the spec page first (marked *agent proposal* where it is a product choice; taste, direction and scope go to Nate or Ben).
3. Writes a brief per piece of build work and sends it to a Codex worker on the Mac. The lead thinks and checks; Codex writes the code.
4. Reads the worker's diff against the brief, reruns its tests, sends back what fails, and merges only what passes.
5. Writes what is proved, and how, onto its rows of [the board](../../../../spec/plans/board.md). A row is ticked only after a fresh reader (a reviewer subagent that did not write it) has checked the diff.

Every calculation is deterministic: same inputs, same answer, integer cents for money, every tunable number a `param` row, every shown number guarded with a citation. A model fills a gap only where the spec says a model does, and its output is checked before use.

The system always answers, and what it weighs in real time is its strength ([Nate](../../../../product/words.md#2026-11-15-nate-the-system-always-prices-with-fallbacks-and-its-power-is-what-it-weighs-in-real-time)). Every number has an established fallback order and says which step it used; a threshold decides only whether the system acts without asking, never whether it answers; and a threshold is read against the evidence as it stands now, pooled from the parent scope where a scope is thin, not against a table that must fill up first. A design that makes the system wait on a fixed count is the wrong design here.

## Mac workers

The Mac is `ngarelik@glados` over Tailscale. Always `ssh -n -o BatchMode=yes ngarelik@glados '<command>'`.

| Step | Command |
|---|---|
| Put the brief on the Mac | `ssh -o BatchMode=yes ngarelik@glados 'cat > /tmp/brief-<name>.txt' < brief.txt` |
| Start a worker | `ssh -n ... 'zsh -lc "MODEL=<id> EFFORT=<effort> zsh ~/dev/projects/secondhand/scripts/mac-worker.sh <name> /tmp/brief-<name>.txt"'` (model and effort optional; see below) |
| See if it is done | `ssh -n ... '[ -f ~/dev/projects/secondhand-wt/<name>/WORKER_REPORT.md ] && echo done; pgrep -f "codex exec" \| wc -l'` |
| Commit its work (the worker never commits) | `ssh -n ... 'cd ~/dev/projects/secondhand-wt/<name> && git add <explicit paths> && git commit -q -m "<type(scope): plain words>"'` |
| Bring it to Windows | `git fetch -q mac 'refs/heads/w/*:refs/remotes/mac/w/*'` then `git merge mac/w/<name>` |

- A worker name is new each time and starts with the lead's name: `eng-valuation-1`, `dbx-dashboard-2`. The worktree is cut from `origin/main` after a fetch, so push before starting a worker that needs your latest commit. Nothing is run or written in the Mac's main checkout (`~/dev/projects/secondhand`): a long run, a download or a backtest goes in a worker's worktree, since a dirty main checkout is everyone's problem.
- Up to seven delegates per lead at once, Codex workers and Claude seats counted together, when the lead sees the need: Nate, "if waiting because of the limit each can have up to 7 concurrent", and "too much on one focus is crazy", so seven is for seven separate pieces, never seven on one. The script refuses to start a worker when 28 are running or when under a quarter of the Mac's memory is free. The Mac has 16 cores and 64 GB, measured 93% free with one worker running (2026-11-15 02:40 Central), so use it, without piling on: Nate, "careful not to overdoo it, we have alot of sessions running".
- The Mac also runs the heavy things: a long test file, a benchmark, a backtest, a Docker service a test needs. Run them in a worker's worktree over SSH, one per worktree, and bring back the numbers.
- Claude Code on the Mac is not signed in, so Claude seats run from the Windows sessions (below); only Codex and plain commands run on the Mac.
- The Mac cannot push to GitHub. Work reaches `origin` only through a Windows merge and push.
- A conflict is never resolved in the shared Windows checkout: an unfinished merge there stops every session from pulling or committing (it happened on 2026-11-15). Before bringing a branch to Windows, merge `origin/main` into it in its Mac worktree, resolve and rerun its tests there, and squash or reset only onto an explicit commit id, never onto `origin/main` by name, since another worker's fetch can move that ref under you. If a merge on Windows does conflict, `git merge --abort` at once and go back to the Mac.
- No key goes to the Mac in a brief, a file or a command line. A task that needs a key on the Mac goes to the orchestrator.
- A Databricks serverless `spark_python_task` runs its file with no `__file__` (measured 2026-11-15: NameError at import), so an entrypoint takes `--root`, passed in the bundle yml as `"${workspace.file_path}"`, and falls back to `Path(__file__)` only when `'__file__' in globals()`. A SQL file task splits on every `;`, so a `BEGIN…END` block fails there: run compound SQL from a Python task (found by the Databricks lead).
- A worker cannot run `git merge`: the sandbox blocks the worktree's git metadata (found 2026-11-15). Before a follow-up brief that needs current main, the lead merges `origin/main` into the worktree, then starts the follow-up with `AGAIN=1`.
- Every brief ends with "tsc reports no error in the files you own" (`cd app && npx tsc --noEmit -p .`, in the worktree on the Mac). `node --test` strips types and never sees a type error; the app's own check and any iOS build run `tsc` first.
- Codex's workspace-write sandbox keeps `.agents/` read-only, so a worker cannot create a file under `.agents/checks/` (found by the integration lead, 2026-11-15). A brief that needs one has the worker write it under `scripts/<piece>-staging/`; the lead moves it into `.agents/checks/` and adds its line to `check.mjs`.
- End every brief with the worker rules below, unchanged.

```
How to work:
- Read AGENTS.md and .agents/skills/build/SKILL.md first, then the documents this brief names. The files this brief says you own are the only files you create or change.
- Before code, work out how the thing operates and what is most likely to break it, and write a test for each break so a failure names its cause. Write the failing test first. Take every name from spec/product.md. Follow the patterns of the code already in the same folder; reuse what exists (the param registry in app/src/engines/param and jobs/param, the proof layer in app/src/engines/proof, the log in log/).
- Run only your own checks, one test file at a time: Python with ./.venv/bin/python -m pytest <file> -q ; TypeScript with node --test --test-concurrency=1 <file> . Never run scripts/prove.mjs with --wave or --tune, never run .agents/check.mjs, never start a server or a browser, never use the network.
- No secret, token or personal data in any file. No console.log in app code (log through log/). No `any` in TypeScript. No swallowed errors.
- Do not run git commit, push, checkout or any git command that writes; the lead commits your work.
- Do every task in the brief. If one truly cannot be done from the repo, say exactly what is missing and move to the next.
- When finished, write WORKER_REPORT.md in the folder root: one line per task with its check command and exit code, the files you created, and anything not done with the reason.
```

## Getting the most from a Codex worker

Nate: "Ensure the team leads are best utilizing codex, understand the proper models, efforts, and how to effectively prompt and configure for using such workers too" ([words](../../../../product/words.md#2026-11-15-nate-the-leads-use-codex-well)). The Mac runs codex-cli 0.169.0 with its own worker home (`~/.codex-worker`: no desktop plugins, default effort medium). The script takes the model and effort per worker: `MODEL=<id> EFFORT=<low|medium|high> zsh ~/dev/projects/secondhand/scripts/mac-worker.sh <name> <brief>`.

**Which model, at which effort.** The ids are the ones this Mac's Codex serves (its `models_cache.json`, read 2026-11-15).

| Piece | Model | Effort |
|---|---|---|
| A specified build: owned files, tests named, the pattern already in the folder. Most pieces | `gpt-6.1-sol` (the script's default) | medium |
| A build with design left inside it: an algorithm, money or state edges, several files that must agree | `gpt-6.1-sol` | high |
| A long piece run unattended where staying inside the brief decides it: many files, a refactor across an area, anything a worker might fake or wander on | `gpt-6-astra` | high |
| A straightforward build in volume: one more route like its neighbours, one more adapter verb, a twin of code that exists | `gpt-6.1-terra` | medium |
| Mechanical work: a rename, fixtures from a stated shape, a doc brought in line with code, lint fixes | `gpt-6-luna` | high |

The whole served list on 2026-11-15 (codex-cli 0.169.0, the newest release): `gpt-6.1-sol` ("latest workhorse", the 6.1 generation and our default), `gpt-6.1-terra` (the 6.1 Codex model, the balanced tier), `gpt-6-astra` (frontier; no 6.1 Astra is served), `gpt-6-luna` (fast and cheap; no 6.1 Luna is served), and the older `gpt-6-sol` and `gpt-5.6-*`, which nothing here should use. `gpt-6.1-terra` has not been measured on this repo: the first lead to use it records how its piece went (rounds to pass, minutes) on the board so the table can be corrected. The list changes; read it fresh with `ssh -n … 'grep -o "\"slug\": *\"[^\"]*\"" ~/.codex-worker/models_cache.json'` before trusting this table on another day.

Astra costs about five times Sol per token, so it is for the pieces that earn it. Efforts above high are not used without a measured gain; the script refuses them. If a model is refused, the worker's log (`/tmp/worker-<name>.log`) says so in its first lines: fall back to `gpt-6.1-sol`.

**How to write the brief.** A worker starts with nothing but the brief and the repo. It reads `AGENTS.md` and the skills itself, so do not paste them.

1. The outcome in one sentence, then what done looks like as commands with the exit code expected.
2. The files it owns (it changes nothing else) and the files it must read first, by path.
3. The facts it cannot look up: it has no network, so anything from a vendor's docs goes in with its source and version.
4. The failure modes to test, named, so the tests are written first and each failure says its cause. Name the edges you care about; do not ask for "full coverage".
5. What is out of scope, and what to do when blocked: say what is missing and move on, never invent data or loosen a test.
6. The worker rules above, unchanged, at the end.

One outcome per worker, sized to finish in about half an hour. A piece too big to state that way is two briefs. Say what and why and leave how to the worker where the folder already shows the pattern; spell out the design only where you have made a decision the worker could not know.

**How to judge what comes back.** A worker's report is a claim. Before merging: `git status` in its worktree against the owned list (anything else changed is sent back), read the diff, rerun its checks yourself, and look for the three ways a worker makes a check pass without doing the work: a test weakened or deleted, the thing under test replaced by a stand-in, a hard-coded answer. A fix to the same piece is a follow-up brief into the same worktree (`AGAIN=1 zsh … mac-worker.sh <same name> <new brief>`), which keeps its files and saves the worker rereading the area. Two failed rounds on one piece means the brief or the design is wrong: rethink it yourself, or bring in an Opus seat, before a third.

## The Windows checkout

Five sessions share `C:\dev\secondhand`. It crashed three times under thirteen, so:

- A lead edits only spec pages, briefs and board rows here, and merges worker branches. Code is written on the Mac.
- Commit with explicit paths the moment a piece passes, then `git pull --no-rebase` and `git push`. If `index.lock` is held, wait two seconds and try again. Never `git add -A`, never stash, reset, rebase or force-push.
- A merge needs a clean index: commit or leave alone your own edits first, and never touch another session's uncommitted files.
- One test file at a time (`node --test --test-concurrency=1 <file>`). Never `node .agents/check.mjs` and never `scripts/prove.mjs --wave` or `--tune` from a lead: the orchestrator runs the full check before a push that needs it. Heavy or long runs go to the Mac.
- A lead may hand work to Claude seats of its own (the Agent tool, in the lead's session): Sonnet 5.5 for a specified piece (a doc update, a brief, reading a diff against its brief, a lookup), another Opus 5.5 for a design question or a fresh review. They count toward the lead's seven, and they do not run tests or builds here: those go to the Mac. A lead starts no new sessions; there are four leads and that number stays.

## The documentation of what we build with

Nate: "remember to account for all documentation for relevant platforms, languages, frameworks, etc we develop with" ([words](../../../../product/words.md#2026-11-15-nate-account-for-the-documentation-of-everything-we-build-with)).

- Before designing or briefing a piece, the lead reads the current official documentation for what it touches, at the version in the repo, not from memory: Expo SDK 58 and Expo Router API routes, Metro, React Native, Node 24 (type stripping, the test runner), TypeScript, Python 3.12, Databricks (through the databricks skills and its docs), Browser Use Cloud ([our reference](../../../../research/cross-cutting/nate/browser-use-cloud.md)), `playwright-core` over CDP, OpenRouter, each marketplace's official API and help pages, Supabase or whatever store the spec names. Use the docs tools the session has (context7, the databricks docs skill, a fetch of the vendor's page).
- A Codex worker has no network, so the lead puts the facts the worker needs into the brief, each with its source URL and the version it applies to. A fact that will be needed again goes into a research note (skill `research-note`), not only the brief.
- A commit that follows a documented behaviour names the page in its `Rests-on:` trailer. Where the docs and the code disagree, the docs for our version win and the code is fixed.

## Tests, measurements and the record

- Test what can break and what a person would see break: one test per real failure mode, the edges of money and state, each join between two parts. Do not test the same thing at three levels, do not test a constant, and do not rerun a suite that did not change. A piece is done when its own checks pass and a fresh reader has read the diff, not when every test in the repo has run again.
- Every piece ends with a number someone can check: accuracy against real data, time to answer, cost per call, share of shown numbers with a citation, endpoints on engines against on examples. Record the number, the command that produced it and the date on the lead's rows of [the board](../../../../spec/plans/board.md) and in the spec or feature page it belongs to. A number that got better says what it was before.
- The benchmark these numbers feed is [spec/benchmark.md](../../../../spec/benchmark.md), ten rows measured on one fixed set of real items through our public API ([Nate](../../../../product/words.md#2026-11-15-nate-the-benchmark-measures-specbenchmarkmd)). A lead's measurement is taken in that benchmark's terms wherever a row covers it, so it can go straight onto the page, not a private timing of an inner function:

| Row of the benchmark | Lead |
|---|---|
| The runner and the scorer (`bench/run.mjs`, `bench/score.mjs`), and the first small run of ours: 20 items across five families | integration |
| 1 coverage, 2 breadth per answer, 3 sources shown, 8 speed to first and full answer (p50 and p95, never an average), 10 sale to delist | integration, from the runner's records |
| 7 price accuracy by family, with the range's width beside it | engines, from the backtest on real sold data |
| 4 sold prices across sites, 6 freshness, 9 thin evidence, and the speed and cost of each site's read path behind row 8 | the orchestrator, with the harnesses |
| The tables, the dashboard and the Genie space that show the run | databricks |

  The rivals' side (two people asking each tool by hand the same day) and which rivals are named are Nate's and Ben's.
- Docs change in the same commit as the thing they describe. A reader who opens the board should see what is proved without asking anyone.

## Problems

The orchestrator (Fable 5.2) oversees the four leads and answers to Nate. A lead solves the problems inside its area itself and says what it chose. It sends the orchestrator, at once and in one message, any problem that changes what was imagined: a feature that cannot work as the spec says, a site or platform limit that removes a capability, a measured result far from what the design assumed, two areas that cannot both be right, a cost or time that makes the plan unworkable. The message says what was found, the evidence, the options, and the lead's recommendation. The orchestrator rethinks it with the leads it touches and takes to Nate what is his to decide.

## Limits that hold for everyone

- Nothing goes public without Nate's say, asked each time. No secret in any brief, file, log or command line; a key is checked by presence only.
- Site work reads public pages and the person's own linked accounts through the harness; official APIs where a site offers one. No private app endpoints, no bot check solved or routed around.
- A task that acts on a live marketplace account runs dry and needs Nate's go per site.
- Never automated: sharing a home address, payment and refunds, moving a deal off the site, a price below the person's floor, completing a purchase.
- Databricks CLI always with `--profile Nate`. Creating a paid resource (a warehouse, an endpoint, an app) is asked first, through the orchestrator.
- Nate's and Ben's words go verbatim into `product/words.md`; a lead's own idea is marked *agent proposal*.

## Talking to each other

Nobody waits idle, and no worker ever waits. What one seat needs from another is a row in [who is waiting on what](../../../../spec/plans/waiting.md), with one owner and what the waiter builds meanwhile; read its five rules and keep your rows true.

A lead that needs something from another area sends the orchestrator one message naming the file, the change and why. A lead reports at the end of each piece: what is now true, the command that proves it, what is open.
