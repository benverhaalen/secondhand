Status: *agent proposal*, a second-round audit asked for by Nate on 2026-11-15; nothing here is decided.

# How the repo is organised, and the order to tidy it

Read-only audit of `C:\dev\secondhand` (public GitHub repo, two founders, many agent sessions on `main`). Nothing was moved, edited or run; `node .agents/check.mjs` was not run. Counts come from `git ls-files`. A claim marked *unverified* is an inference, not a read.

Two of the brief's assumptions do not hold: `spec/plans/sql/` does not exist (the SQL is in `databricks/sql` and `databricks/pipelines/market`), and `scripts/out/`, `bench/out/` and `demos/` are not on disk now (runs create them, and `.gitignore` does not cover them).

## 1. Tree map

Total tracked: about 459 MB. Root files: README.md, LICENSE, CLAUDE.md, AGENTS.md, .gitignore, .gitattributes. There is no root package.json.

| Path | Files | Holds | Who writes it | README or index matches? |
|---|---|---|---|---|
| `brand/` | 1226 (1215 in `explore/`) | Brand constitution, tokens, explorations; 226 MB | Ben | README exists; `explore/` is round-by-round PNG boards (round-6 75.6 MB, round-7 64.3 MB, round-2 29.1 MB, web-home 28.9 MB) |
| `app/` | 795 (654 `src`, 60 `assets`, 45 `e2e`, 24 `behavior`) | Expo app, in-app edge server (`src/edge`), API routes (`src/app/v1`), engines (`src/engines`) | Screens Ben, routes and edge Nate | `app/README.md` has "Run it" but says "The first screen is a development placeholder", which is stale for 654 source files |
| `research/` | 656 | `research/<slug>/<person>/`: studio 342, cross-cutting 146, today 29, list 27, price 25, watch 24, data 23, capture 11, sold 7, identify 5 | Each person and their agents | README exists; 126 MB, mostly studio (92.5 MB) |
| `spec/` | 353 | Canon, engines, determinations, fixtures (248), plans (19), features (20), examples (13), items (2) | Agents propose; Ben and Nate decide | `spec/README.md` table is sound but omits `databricks/`, `bench/`, `deploy/`, `spec/items/` |
| `features/` | 304 | One page per feature; `features/app` is 254 files incl. `renders/` (247 files, 68 MB) | Whoever owns the feature | README exists; about 20 folders hold 1 file each |
| `jobs/` | 172 | Python jobs by area (valuation 25, identity 23, analytics 20, demand 19, style 17, capture 15, photo 14, studio 13, trust 8, negotiation 7) with their tests | Nate's side | No README |
| `.agents/` | 146 | `team` 53 (packets), `vendor` 43, `checks` 28, `skills` 12; coordination, check runner | Agents | `.agents/team/README.md` indexes about 10 of 53 packets |
| `scripts/` | 65 | `bench` 26, `demo` 9, `walk-fixtures` 1, lint and codegen scripts | Agents | No README |
| `databricks/` | 47 | `tasks` 13, `sql` 10, `pipelines` 6, `parity` 6, `run-sql.mjs`, loaders | Nate | No README |
| `assets/` | 42 | `demo-items` 30, `platforms` 12 | Agents | READMEs in `demo-items` and `platforms` |
| `product/` | 41 | Vision, decisions, words (1766 lines, append only), pitch and demo docs | Ben owns; most pitch docs are agent proposals | No folder README; root README lists 18 of them |
| `deploy/` | 12 | `databricks.yml`, `resources/*.yml`, `deploy.mjs`, `tasks/` | Nate | No README |
| `bench/` | 12 | Open-benchmark runner and scorer, 6 fixtures, tests | Nate | README exists; `bench/out/` not ignored |
| `docs/` | 11 | `how-it-works/` explainers | Agents | README exists |
| `db/` | 10 | Lakebase migrations and `migrate.mjs` | Nate | README exists and has run and test commands |
| `probes/` | 9 | `workspace/` one-off Databricks probes (T0-1) | Nate | No README |
| `ideas/` | 9 | After-launch ideas | Both | README exists |
| `log/` | 8 | The logger (106 imports from the app) | Agents | README exists |
| `.github/` | 5 | `check.yml`, `studio-touchup.yml`, `web-boards.yml`, `web-scenes.yml`, `web-wall.yml` | Agents | n/a |
| `.claude/` | 2 | `settings.json`, skills symlink | Agents | n/a |

Root `README.md` (39 lines) lists `product/` docs, `features/`, `spec/`, `docs/`, `app/`, `ideas/`, `research/`, `log/`, `AGENTS.md`, `.agents/`. It omits `brand/`, `bench/`, `databricks/`, `deploy/`, `db/`, `jobs/`, `probes/`, `scripts/`, `assets/` and has no run instructions.

## 2. Wrong place, or two places

- **Databricks in five folders.** `databricks/` (SQL, pipelines, tasks, parity), `deploy/` (bundle and resources), `jobs/` (Python, with its own `pytest.ini`), `probes/workspace`, `db/` (Lakebase migrations, a different system from the lakehouse), plus `app/src/edge/databricks.ts` and docs in `spec/databricks.md`, `spec/databricks-build.md`, `spec/plans/sweep/databricks.md`. The split follows the deploy mechanism, so it is defensible, but no index says so. A README in `databricks/` that names the other four is cheaper than moving anything.
- **Benchmarks in six places.** `bench/` (runner and scorer), `scripts/bench/` (26 files: backtest, gate, photo, seasons, roi), `spec/items/` (manifest, score, one capture), `spec/benchmark.md`, `spec/plans/backtest/` (7 md), `databricks/parity` with `databricks/sql/06_bench.sql` and `deploy/resources/bench.yml`. `bench/` and `scripts/bench/` are the real duplication of purpose.
- **Two copies of the demo items.** `assets/demo-items` (30 files) and `app/assets/demo-items` (9 files, 9 names in common). Each has a README.
- **Two copies of "how we price".** `docs/how-it-works/how-we-price.md` and `spec/plans/backtest/how-we-price.md`.
- **Pitch.** `product/pitch.md` plus a one-file `product/pitch/market.md`.
- **Feature knowledge in four places.** `features/<slug>/`, `spec/features/`, `product/features*.md`, `spec/coverage.md`. The roles are documented; leave them.
- **Site code, not a duplicate.** `app/src/edge/harness/sites/<site>/` (adapter, fixtures, live, recon) and `app/src/edge/intel/public/` (readers, search, sources) are different layers, but the names collide in conversation.
- **Code under `scripts/` or `research/` that the app imports.** `app/metro.config.js` `watchFolders` are `../log`, `../spec`, `../jobs/capture`, `../research/list/ben/platforms`, `../scripts`. The app also imports `research/list/ben/levers/levers.json` and `jobs/studio/slides.json`, which no watch folder covers (*unverified* whether Metro resolves them another way). It references `jobs/capture/process.json`, `scripts/listing-lint.mjs`, `scripts/copy-lint.mjs`, `research/list/ben/platforms/{platform-fit.json, fit.mjs}`, `spec/examples/*.json`, `spec/sites.mjs`, `spec/log.mjs`, `spec/lifecycle.mjs`. Generated headers name `scripts/icons-to-ts.mjs` and `scripts/tokens-to-ts.mjs`. These pin the paths of `scripts/`, `research/list/ben/platforms/`, `jobs/capture/`, `jobs/studio/`, `spec/` and `log/`: do not move them without changing the config and the bundle check together.
- **Fixtures in five places.** `spec/fixtures` (248), `app/src/fixtures` (68), `bench/fixtures` (6), `jobs/analytics/fixtures` (5), `databricks/parity/fixtures` (1), plus `app/src/edge/harness/fixtures` and per-site fixtures. Different readers; leave alone.

## 3. Dead, superseded, orphaned, generated

- `jobs/capture/follow_ups.py` and `jobs/capture/next_view.py`: docstring says "Superseded 2026-11-15 by the deterministic plan in app/src/engines/capture/plan.ts ... Kept so its tests and the param priors it names stay readable." The bundle still syncs `../jobs`. Candidate to retire (a decision).
- Tracked generated output:
  - `scripts/bench/out/` (14 files: `backtest-stockx*.json`, `bench-sites-4.json`, `bench.json`, `gate-*.jpg`, `gate.json`, `ledger.jsonl`, `photo.json`, `seasons.json`, `experiment-self-test.json`).
  - `databricks/parity/proof.ts-out.json` (written by `write-ts-out.mjs`).
  - `brand/explore/web-home/*/out/` (66 tracked files: png, mp4, `audit.json`); the ignore rule covers only `out/*.html`.
  - `features/app/renders/` (68 MB, 187 png, 3 mp4), written by `scripts/app-check.mjs`, read by `scripts/app-gallery.mjs`, regenerated by CI.
  - `app/src/ui/icons.generated.ts` and `tokens.generated.ts` are intended to be tracked.
- `.gitignore` lacks `bench/out/`, `scripts/out/`, `demos/out/` (`scripts/demo.mjs` writes `demos/out/<name>.mp4`).
- `.claude/context/` is untracked, but I did not find what ignores it (*unverified*; `.git/info/exclude` is the default). A fresh clone on another machine could add compaction files to `git status`.
- Untracked now: `product/graphics/` (README.md, `benchmark-and-lakehouse.html`).
- `research/studio/ben/slides/runs/*` holds about 2 MB jpg outputs of image models.
- Packets that look closable:
  - `team/7-spec-databricks-not-pushed` says "open until the file lands"; `spec/databricks.md` exists (691 lines) and `.agents/awaited.json` is `[]`.
  - `team/2-repo-layout` still says "proposed to Ben, waiting on his OK".
  - `team/1` and `team/3` are setup packets.
  - Packets on the `claude/project-thread-*` branches (draft PRs #8, #9, #10) are not verified.
- `spec/plans/README.md` Tasks T0-1 to T0-4 reference `.agents/checks/plans.mjs` and `plans.test.mjs`, which are not tracked, and its §3 board table is empty.

## 4. Naming and numbering

Packet numbers 43, 44, 54, 55, 56 and 68 each appear more than once (53 packets; numbers in use 1-7, 21, 22, 30-32, 40-45, 47-57, 60-62, 64-72):

| N | Packets |
|---|---|
| 43 | `price/43-platform-levers-and-signals`, `team/43-design-work-for-ben` |
| 44 | `sold/44-cheap-sale-detection`, `team/44-research-reaches-code` |
| 54 | `price/54-least-adjusted-comps-and-risk`, `team/54-hard-calls-index`, `today/54-ui-needs-from-the-data-side` |
| 55 | `list/55-posting-failures-fees-and-grades`, `studio/55-slides-backend-for-nate`, `team/55-team-leads-and-mac-workers`, `today/55-web-export-breaks-on-the-harness` |
| 56 | `sold/56-offers-backups-disputes-and-fresh-reads`, `studio/56-measure-proof-for-nate` |
| 68 | `price/68-valuation-files-are-being-rebuilt`, `watch/68-demo-on-the-harness` |

`.agents/team-sync.mjs` (line 29) throws "Duplicate packet IDs" on repeats and `.agents/team/README.md` says IDs must be unique, so either the sync is failing or it is not run on this tree (*unverified which*). The README indexes about 10 of 53 packets. Only a few packets use an explicit "Status: pushed/done"; there is no uniform status line.

Other naming:
- `spec/plans/` mixes plan docs, a `plan.json`, `board.md`, `waiting.md` (merge=union), `ben-asks.md`; "plans" here means build plans, which differs from the `.agents/` packets.
- `scripts/bench/` vs `bench/`; `harness/sites` vs `intel/public`; `deploy/tasks` vs `databricks/tasks`; `probes/` vs `databricks/` - names do not say which system is meant.
- `databricks/test_bundle.mjs`, `test_governance.mjs`, `test_why.mjs` use `test_*` naming, which neither the `.test.mjs` pattern nor pytest-style names in the check cover.
- Links: a Node sample over 15 key docs found 0 broken relative links; the `links` check already enforces this.

## 5. Newcomer docs

- The root README is a table of `product/` docs and does not match the tree (omissions in §1). It has no "run it" section.
- One place for how to run: only `app/README.md` (copy `.env.example`, `databricks auth login`, `npm start`; on an iPhone; not done yet). `app/e2e/README.md` and `db/README.md` cover their own folders. Nothing covers the server, the Python tests, `scripts/walk.mjs` (documented only in packets 49 and 55, `board.md`, `start-now.md`), the Databricks bundle (`deploy/deploy.mjs`, only in specs), or benchmarks.
- `spec/plans/finalization.md#13-what-works-kept-by-the-orchestrator` has 2 ticked and 151 unticked boxes, last changed 2026-11-15; ticks happen only after an orchestrator review, so it does not read as status for a build that has merged many engines. `start-now.md` was last changed 2026-11-14.
- Folders with no README: `jobs/`, `databricks/`, `deploy/`, `probes/`, `scripts/`, `product/`, `spec/features`, `spec/determinations`, `spec/fixtures`, `.agents/checks`.
- `databricks/run-sql.mjs` hard-codes `--profile Nate`, and `deploy/databricks.yml` comments mention it, so a second person following it hits the wrong profile.

## 6. Tests and checks

`.agents/check.mjs` runs: layout, links, provenance, research, secrets, ui, brand, vague, logging, code, parts, picks, motion, rules, rests, states, evidence, waysout, bundle, and the tests matching `^(\.agents|scripts|spec)/.*\.test\.mjs$` and `^app/src/.*\.test\.ts$` (158 `*.test.ts(x)` files under `app/src`).

Test files the check does not run:

| Folder | Files |
|---|---|
| `app/e2e` | 20 (CI runs them in `check.yml` with `node --test "app/e2e/*.test.mjs"`) |
| `jobs/*` (identity 8, demand 8, style 7, capture 7, analytics 7, valuation 6, photo 6, trust 4, studio 3, negotiation 3, score 1, person 1, param 1, `test_scaffold.py`) | about 70 Python tests |
| `databricks/tasks` | 6 |
| `databricks` (`test_proof.py`, `policy-sweep.test.mjs`, `parity` 1, `test_bundle.mjs`, `test_governance.mjs`, `test_why.mjs`) | 6 |
| `probes/workspace` | 3 |
| `research/list` 2, `research/watch` 1, `research/sold` 1 | 4 |
| `deploy/tasks` 1, `deploy/deploy.test.mjs` 1, `db/migrate.test.mjs` 1, `bench/score.test.mjs` 1, `bench/run.test.mjs` 1 | 5 |

Of the workflows, only `studio-touchup.yml` runs a `jobs/` suite (studio). The other Python suites and the Databricks, db, bench and deploy tests appear to run in no automatic place (*unverified* beyond the workflows read).

Critical paths with tests: `edge/auth.test.ts`, `edge/api/auth.test.ts`, `edge/orders/orders.test.ts`, `edge/api/orders.test.ts`, `edge/post/post.test.ts`, `harness/session.test.ts`, `harness/author/author.test.ts`, `engines/money/ending.test.ts` and `ending.parity.test.ts`. No same-named test turned up for `app/src/edge/browser/auth.ts`, `engines/money/params.ts`, `engines/{listing,marketing,score,trust}/money.ts`, `engines/valuation/posture.ts` (*unverified* whether other tests cover them). The money guard is SQL (`databricks/sql/09_guard.sql`); its test lives in the unrun group.

Redundancy: `bench/` and `scripts/bench/` both hold scorers; two how-we-price docs; two demo-items folders.

## 7. Public-repo risks

- **Size.** About 459 MB tracked. Largest single files are 4 to 9 MB PNG boards in `brand/explore/round-6` and `round-7`. 17 mp4 files. Cloning cost and history growth are the main risk; rewriting history would be a decision for Nate and Ben.
- **Third-party content without a recorded licence.** `.agents/vendor/ui-factory/` (9 files) has no LICENSE or SOURCE.md in its folder; `emil/SOURCE.md` says it was copied unchanged into the ui-factory skill. `emil` (27 files) and `poteto` (7 files) have both. Research notes quote fetched sources (not audited here). `assets/demo-items` states its images are AI-generated stand-ins. The terms of the image models behind `research/studio` outputs are not recorded (*unverified*).
- **Secrets and personal data by name.** None found. No `.env`, pem, key, har or storage-state file is tracked. See the end of the handback for names that looked relevant. The profile name `Nate` in `databricks/run-sql.mjs` and `deploy/databricks.yml` comments is a handle, not a secret.
- Fonts are ignored and none are tracked. There is a root LICENSE.

## The plan

Who agrees: Ben owns `product/`, `brand/`, `features/`, screens under `app/src/app/` outside `v1/`, and `app/src/ui/`. Nate's side owns the backend, `spec/`, `databricks/`, `jobs/`. Rule docs under `.agents/` follow `.agents/thinking.md` §4.

### Group A: Safe now (additive or isolated; no other branch's files move)

1. **Renumber the colliding packets.** Keep the oldest of each number; renumber the others to 73 and up (`team/55-team-leads-and-mac-workers` may stay). Update inbound links (`grep -r "<old name>"` across `.agents`, `spec`, `product`, `research`) and run the `links` check. Who: Nate for team packets; each packet's Owner for the others. Risk: a branch with a packet that links to the old name will break on merge; the packet's own number is the only thing that changes.
2. **Mark the closed packets.** Packet 7 `Status: done` (spec/databricks.md exists); packet 2 gets a status line stating what happened to the proposal. Who: Nate and Ben for packet 2; whoever wrote 7. Risk: none; text only.
3. **Add the missing ignores to `.gitignore`:** `bench/out/`, `scripts/out/`, `demos/out/`, `.claude/context/`, and `brand/explore/web-home/boards/*/out/` as a whole rather than `*.html` only (after step 9 below). Who: Nate. Risk: ignoring a path that is already tracked does nothing until step 8; no effect on existing files.
4. **Write READMEs for `databricks/`, `jobs/`, `deploy/`, `scripts/`, `probes/`**, each short: what it holds, how to run it, which other folders belong to the same system (the five-way Databricks map in §2). New files only. Who: Nate. Risk: none.
5. **Extend the root README** with rows for `brand/`, `bench/`, `databricks/`, `deploy/`, `db/`, `jobs/`, `probes/`, `scripts/`, `assets/`, and a "run it" section that links to `app/README.md`, `db/README.md` and the new READMEs. Root README is shared; Ben agrees. Risk: none.
6. **Fix `app/README.md`**: remove the "development placeholder" line; add the commands for the server, the tests, `scripts/walk.mjs` and the check. Screens text is Ben's; commands are Nate's. Risk: none.
7. **Add the missing paths to `spec/README.md`** (`databricks/`, `deploy/`, `bench/`, `spec/items/`) and name the two "where to start" intros as one. Who: Nate. Risk: none.

### Group B: At a quiet point (touches tracked files that other branches edit)

Check these branches first: `w/int-bench-3`, `w/eng-style-1`, `w/eng-demand-1`, `w/eng-identity-1`, `w/eng-mkt-1` (recent Mac merges), the three `claude/project-thread-*` branches behind draft PRs #8, #9 and #10, and any open Codex worker. `git worktree list` showed only the main checkout here, so the Mac worktrees are not visible from this machine. Run `git branch -a --no-merged main` and `git diff main...<branch> --stat` on each for paths named below.

8. **Stop tracking generated output** with `git rm --cached`: `scripts/bench/out/` (or move it to `bench/out/` with a README that says how it is produced), `databricks/parity/proof.ts-out.json` if `write-ts-out.mjs` can regenerate it in CI, and the 66 files under `brand/explore/web-home/*/out/`. Before: confirm nothing reads them (`grep -r "bench/out\|proof.ts-out\|web-home/.*out/"`). Who: Nate for scripts and databricks; Ben for `brand/`. Risk: a doc or the `evidence` or `bundle` check may read a tracked output; a merge from a branch that edits those files will show a delete-modify conflict.
9. **Run the unrun suites in CI.** Add a job to `.github/workflows/` that runs `pytest jobs databricks/tasks databricks/test_proof.py probes`, `node --test` for `db`, `deploy`, `bench`, `databricks/*.test.mjs` and the three `databricks/test_*.mjs`, and `research/**/*.test.*`. Or extend `check.mjs`'s test pattern; first rename the three `test_*.mjs` to `.test.mjs`. Who: Nate. Risk: suites that were never run in CI will fail on first run (some need `pg`, PGlite or a Databricks profile); start in a separate non-blocking job.
10. **Merge the benchmark docs under one index.** Choose a single entry (`bench/README.md`) that links `scripts/bench/`, `spec/items/`, `spec/benchmark.md`, `spec/plans/backtest/`, `databricks/parity` and `deploy/resources/bench.yml`. Do not move code. If `scripts/bench/` is to merge into `bench/`, that is a code move: update `scripts/bench/*` imports, `product/roi.md` (which names `node scripts/bench/roi.mjs`), `README.md` row, `check.mjs` test patterns, and the bundle check. Who: Nate. Risk: the roi command and any packet naming `scripts/bench/` break.
11. **Resolve the two copies of how-we-price and the two demo-items folders.** Keep `docs/how-it-works/how-we-price.md` as the people-facing page and make `spec/plans/backtest/how-we-price.md` a pointer, or the reverse; check `app/src` imports of `app/assets/demo-items` before deleting either. Who: Nate for docs, Ben for `app/assets` if screens read it. Risk: app import breaks.
12. **Add the uncovered `watchFolders`** in `app/metro.config.js` for `research/list/ben/levers/` and `jobs/studio/` if Metro does not already resolve them (verify with a web export, which is what `check.yml` runs), and make the `bundle` check name them. Who: Nate. Risk: a Metro config change affects every web and native build.
13. **Re-index the packets.** Regenerate the `.agents/team/README.md` table from the 53 packets (or have `team-sync.mjs` print it), with a status column. Follow `.agents/thinking.md` §4. Do this after step 1.
14. **Make the board readable as status.** Add a top-of-file summary to `spec/plans/finalization.md#13-what-works-kept-by-the-orchestrator` (built, in progress, not started, counted by script) while leaving the checkboxes alone; the tick policy is Group C. Remove or create the missing `.agents/checks/plans.mjs` named in `spec/plans/README.md`. Who: Nate. Risk: another session is editing the board; do it in one commit.

### Group C: Needs a decision

15. **Slim the heavy folders** (Ben and Nate): `brand/explore` (226 MB, mostly rounds 2, 6, 7 and web-home), `research/studio` (92.5 MB), `features/app/renders` (68 MB, regenerated by CI). Options: keep the final picks and move the rest to a release asset, Git LFS or an archive repo; stop tracking `renders/` and publish them from CI; or accept the size. Rewriting history is irreversible on a public repo and is the operator's call.
16. **Retire the superseded capture jobs** `jobs/capture/follow_ups.py` and `next_view.py` and their tests, or keep them as noted. Nate. Check the `jobs` bundle sync and the param priors they name.
17. **Policy for ticking `board.md`** (Nate and Ben): keep ticks behind an orchestrator review, or let CI tick from proving commands.
18. **Should the app depend on `scripts/*-lint.mjs` and `research/list/ben/platforms/fit.mjs` through Metro watch folders**, or should they move into `app/` (and `app/src/engines`)? Moving gives a self-contained app and a smaller watch list, at the cost of a large import rewrite and the bundle check. Nate for engines, Ben if UI lint scripts.
19. **Licence and source records** for `.agents/vendor/ui-factory` and a line for the AI-generated images (`assets/demo-items`, `research/studio`): add `LICENSE` and `SOURCE.md` if the source is known, or remove the folder if not. Ben and Nate.
20. **The Databricks profile.** `--profile Nate` is hard-coded in `databricks/run-sql.mjs`; make it read an env var or a flag. Nate. Small, but it changes how the other founder runs the file.
21. **Fold or keep `probes/workspace`** (T0-1 probes, 2026-11-15): archive into `databricks/` once their findings are in `spec/databricks.md`. Nate.

### Leave alone

- The feature slug convention (`features/<slug>`, `research/<slug>`, packet topic) and `.agents/checks/layout.mjs`.
- The roles of `features/` vs `spec/features/` vs `research/`.
- `app/src/edge/harness/sites` vs `intel/public` (different layers).
- `spec/fixtures` (248 files read by tests), `app/src/fixtures`, `bench/fixtures`.
- `.agents/vendor/emil` and `poteto` (licences and sources are recorded).
- The `log/` module and its 106 imports; `spec/log.mjs`, `spec/lifecycle.mjs`, `spec/sites.mjs`.
- `.gitattributes` `merge=union` for `product/words.md` and `spec/plans/finalization.md#13-what-works-kept-by-the-orchestrator`.
- The `app/src/app/v1/out/` route (a route named "out", not output).
- `db/` (own README, own tests, separate system).

## Ten most confusing things today

1. Six packet numbers appear two to four times, and `team-sync.mjs` is written to throw on that.
2. The root README lists 18 `product/` docs and nine folders of code are missing, with no run instructions.
3. Databricks work is in `databricks/`, `deploy/`, `jobs/`, `probes/`, `db/` and the app, with no map.
4. Benchmarks are in `bench/`, `scripts/bench/`, `spec/items/`, `spec/benchmark.md`, `spec/plans/backtest/` and Databricks parity.
5. `check.mjs` passing does not mean the Python, Databricks, db, bench and deploy tests pass; they are not in it.
6. The app reaches into `scripts/`, `research/list/ben/platforms/`, `jobs/capture/` and `spec/` through Metro, so those folders cannot move freely.
7. `spec/plans/finalization.md#13-what-works-kept-by-the-orchestrator` shows 2 of 153 boxes done after a build that merged many engines.
8. `assets/demo-items` and `app/assets/demo-items`, and two `how-we-price.md` files, are near-duplicates.
9. 459 MB is tracked, with generated outputs (`features/app/renders`, `brand/explore/web-home/*/out`, `scripts/bench/out`) among it.
10. `app/README.md` says the first screen is a placeholder, and it is the only run guide.

## Names that looked like secrets or personal data (path only, none read for values)

- `app/.env.example` (example file; values not read).
- `.agents/checks/secrets.mjs` (the checker).
- `app/src/edge/harness/cookie/cookie.ts`, `cookie.test.ts`, `OPERATING.md` (code and notes about cookies).
- `databricks/run-sql.mjs` and `deploy/databricks.yml` (a personal profile handle in a flag and comments).
- Design tokens, not credentials: `brand/tokens.css`, `app/src/ui/tokens.generated.ts`, `scripts/tokens-to-ts.mjs`, `research/cross-cutting/ben/brand-thread-files/today-v3/token-block.txt`, `brand/explore/system-audit/breaker/*tokens*.app.html`.

## What was checked

Commands run: read-only `git ls-files`, `git worktree list`, `git log`, `git check-ignore`, `grep`, `du`-style size counts, and a Node link sample. Exit codes were not recorded as receipts because no check, test or build was run, as instructed. Out of scope: reading file contents of binaries, the other axis of review, and any move.
