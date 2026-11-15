# 86: server core handoff

Updated: 2026-11-15, about 08:15 Central (13:15 UTC), at hand-off. Owner: Nate. Agent: Claude Code, the server-core lead (Opus 5.5), handing off at about half context per [packet 55](55-team-leads-and-mac-workers.md#a-session-ends-before-it-fills). Area: [finalization §2](../../../../spec/plans/finalization.md#2-server-core-lead-server), rows SV0 to SV10. Nothing was deployed, nothing was created on Fly, no secret was set anywhere.

## What is true on main

| What | Commit (merge on main) | Proved by |
|---|---|---|
| The Store is one SQLite file (`node:sqlite`) behind the same synchronous `Store`; `kv` for process state; `db.ts` opens one handle per path per process, `:memory:` under `node --test`, refuses production without `SECONDHAND_DATA_DIR`, a temp folder `secondhand-dev/` on a dev server. Decision and why: [server-store.md](../../../../spec/plans/server-store.md) | c19e8af6, review fixes fdff15a1 | `sqlite-store.test.ts` 28, `db.test.ts` 8, `kv.test.ts` 5 (two handles on one file, restart, rollback, claims, write-time validation) |
| `node server/main.ts`: one module graph for every `/v1` wrapper (an `@/` resolve hook), `/healthz`, 404/405 in the API shape, SSE streamed and cancelled, watcher and pipeline ticked (`SECONDHAND_TICK_S`), `recover()` at boot, SIGTERM closes | 9221b28a | `server/main.test.ts` 6, `routes.test.ts`, `node-http.test.ts`, `ticks.test.ts`; run as a process on the Mac |
| Account lookups by id only under their own person (harness gate, storefront sweep, watcher, pool, sign-in, post, handoff) | fd545dcb | the parked `w/int-byid-2`, landed; one refusal test per caller |
| Search sources from the search lead's `composeSources` once per process; no plain-fetch Depop or eBay client; `SECONDHAND_CHROME` | e167869b | `runtime.test.ts` 42 |
| Sign-in in the database; `SECONDHAND_DEV_CODE` (six digits, refused at import in production); no sender means `startEmail` answers 503 and writes nothing (`configureSender(fn)` is the seam); a replayed refresh token drops its family; a resend spends no attempt; email limits in `kv` | 1ce5c2a3 | `auth.test.ts` 27, `auth-store.test.ts` 13, `api/auth.test.ts` 16; on the built server: start 202, verify with the dev code, `/v1/me` 200, wrong code 401, token works after a restart, no code or address in the logs |
| Jobs and frames on disk; a listing row is persisted only when its own `may_store` is true and `keep_until` absent, null or future (`api/keep.ts`); `examplesServed()`; the example visitor job readable only while examples are served | dbbf817e | `jobs.test.ts` 31, `keep.test.ts` 5 |
| Dockerfile (node:24.10.0, non-root, `npm ci --omit=dev`), `.dockerignore` allowlist, `fly.toml` (one machine, `auto_stop_machines = "off"`, volume at `/data`, `Fly-Client-IP`, `/healthz`), `server/container-check.sh` | 3c1a924a | on the Mac: build, health, routes, a watch tick, SIGTERM exit 0, the database on the volume; the last step (refuse without `DECISION_SIGNING_KEY`) waits on srv-http-1 |
| Dupe's recorded row out of `spec/examples/jobs.json` | 78c8efde | the example tests |

Reviews: a fresh Opus review of the store, entry and account scoping found six faults, five fixed in fdff15a1 and verified closed by the same reviewer (F4, carrying `store.json`, not needed). A second fresh review of sign-in and jobs was running at handoff.

Verified independently: the orchestrator reran SV0, SV1's sign-in half and SV3 on Windows at 12:55 UTC (`node server/main.ts`, a scratch folder, the dev code: sign-in across routes, token, job stages and 13 frames across a restart, another visitor refused, nothing of Dupe's on disk), recorded in the spec's §12. Request state (SV1 rest, SV10 parts) landed at bab7994d: idempotency slot before the handler, signed visitor ids, decision key required and versions on the row, last open in `kv`, `requireProduction()` at boot. Seventeen older route tests still call `deps.idem.clear()` / `deps.visits.clear()`; a two-line seam in `http.ts` keeps them working (marked `shortcut:`); new tests call `resetRequestState()`, and a hand-made visitor id must become `visitorId()`.

## Does not work (found by the orchestrator's gate at 041f7ffe, 13:00 UTC; not yet diagnosed)

- `scripts/walk.test.mjs`: "one fixture item runs all fifteen stages and finishes sold once with delists planned elsewhere" and "a watch prefix reports its completed nested sale without claiming the whole walk finished". `scripts/walk.mjs` builds its own `fileStore` in a temp folder (walk.mjs:68) while the modules it drives now use the SQLite default store from `api/store.ts`, so the walk's file store and the runtime's store are probably two stores: start there (make the walk pass its store into what it drives, or run it on a `sqliteStore` over the temp folder).
- "Mercari linked search refuses another person and loads only the asking account" (in `app/src/edge/api/search.test.ts`, the search lead's file): likely SV5 meeting `harness/sites/mercari/linked.ts:8`, which calls `accounts.byId(args.account_id)` with no person and now gets undefined from `memoryAccounts`; the fix is one argument there (`byId(id, args.person_id)`), in the search lead's file: settle with them. `search.test.ts` also fails 11 on clean main for search's own changes (seen at 44591128).
- `search-latency.test.ts` fails 3 on main (the search lead is fixing it).
- Security gates open when `NODE_ENV` is unset (item 1a below): fly.toml and the Dockerfile set `production`, so the hosted path is safe; a hand-run host is not.

## Agreements with other leads (each confirmed by message, 2026-11-15)

- Search: `composeSources({ env, log, now, store })` in `app/src/edge/harness/compose.ts` (theirs), called once per process by the `runtime` singleton (done); no plain-fetch site clients, `SECONDHAND_CHROME` (done); rows carry `may_store` and `keep_until` (theirs, next round); `fill_until` on a search job keeps its stream open until `answer.late` (mine, jobs round 2); Apify caps as `kv` counters behind `apifyRuns.reserve` (mine); the search lead was asked to log `storable(answer)` in search.ts.
- Engines: SV6 is theirs (EN6), and `valuate(item, ctx)` is on main (EN1, 9d0f91f2) with an `ObservationPort { read(q), write(rows, meta) }` whose one marked line waits for SV7. Observation reads: `show` (valuation) drops rows whose `keep_until` passed; `model` (fits) also needs `may_model` true at both levels; `use_scope` carried, not read. Nate changed the Apify rule since ("Yes, Apify too": Apify rows may fit models, eBay content stays out); the engines lead asked the data lead how to set `may_model` for Apify rows, so the reader stays as agreed and only the rows' flag changes.
- Data: the DB3 landing line shape (notes folder); a re-upload is safe, a landed file is never rewritten.
- Capture: the `Blobs` port and `PUT /v1/uploads/:id` (item 5 below), with `onUploaded`, GPS and face-region metadata stripped, type from the magic number, 25 MB; the identify job may run in-process for now with its row through `jobsOn`.
- Buying conversation: `buy.test.ts` uses `visitorId()`; it waits for the hosted origin to set `SECONDHAND_API_ORIGIN` on Vercel.
- The orchestrator: a subagent is building Ben's packet 80 (`capture.intent`, `GET`/`DELETE /v1/lookups`, a want keeping `product_id` and `capture_id`) and will touch `wants.ts` and a store declaration; the orchestrator merges it.

## The shared development database

With no `SECONDHAND_DATA_DIR`, every dev server on a machine shares `secondhand-dev/secondhand.db` in the temp folder; another session held it open at 12:35 UTC. Do not delete it while a dev server runs. For a benchmark or a persistence test, set a scratch `SECONDHAND_DATA_DIR` and delete it after.

## On the Mac (`~/dev/projects/secondhand-wt/<name>`, branch `w/<name>`)

Merged to main, worktrees removable: srv-store-1, srv-entry-1, int-byid-2, srv-runtime-1, srv-auth-1, srv-jobs-1, srv-host-1, srv-fix-1, srv-proof-1, srv-http-1, srv-restore-1.

**Running at hand-off, unmerged** (started 13:35 UTC from main at ff56bbda, gpt-6.1-sol high, on Nate's "fix everything to be fast"): **srv-fix-2** (the NODE_ENV gates, keep.ts failing closed, the email lockout, the per-code generator, vendor error text), **srv-vault-1** (encrypted vault, the examples gate in the runtime, push tokens), **srv-obs-1** (SV7). Their files do not overlap. For each: read WORKER_REPORT.md, rerun its checks, merge main in its worktree, push it to main, then a fresh Opus reviewer (sign-in, the vault and observations are all the reviewed kind). Briefs in `server-core-briefs/`; srv-obs-1 has an addendum on how `may_model` is set.

**A regression, fixed:** 8560d836 (the search lead's) also committed stale copies of 18 server files (http, decisions, today, kv, ports, server/main, five tests; it deleted secrets.ts), undoing SV10. Restored at ff56bbda, keeping that commit's search.ts and route changes; on the Mac search 71, http 26, decisions 8, server/main 8, proof 1 pass. Watch for it again: compare a commit's `--stat` with what it claims.

- **srv-http-1**, round 3 running: idempotency slot taken before the handler (409 `stale` on a concurrent duplicate), the visitor bucket in `kv`, server-signed visitor ids (`vis_` + 12 + 20 hex mac, matching the app's regex), decision key from `secret('decision')` and versions on the row, last open in `kv`, `secrets.ts` with `requireProduction()`, `'late'` in `Stage`, the entry calling `requireProduction()`, callers' test resets. The search lead allowed edits to the visitor fixtures and reset lines only in `search.test.ts`. Land it, rerun `server/main.test.ts` and `bash server/container-check.sh` on the Mac (Docker Desktop must be running: `open -a Docker`).
- **srv-proof-1**: landed (ff31ae39); a fresh reviewer reran it on the Mac (exit 0) and marked SV0 done, SV1's sign-in half done, SV3 done against its proof (8e359f7b).
- `w/int-obs-1`: parked; take only `events/observations.ts` and its test from it (brief below), never its valuations, valuation-sold, search or proof hunks.

## Next, in order (every brief this lead wrote is in the shared notes folder `server-core-briefs/` (outside the repo); write fresh ones from these lines if it is gone)

1. Done: srv-http-1 landed (bab7994d); on the Mac at that commit `server/main.test.ts` 8, `server/proof.test.ts` 1, `server/host.test.ts` 11, `http.test.ts` 26, `decisions.test.ts` 8 pass, and `bash server/container-check.sh` passes every step including the refusal without `DECISION_SIGNING_KEY`. Still to do: a fresh reviewer on bab7994d (idempotency, visitor ids, signing key are security), and an independent rerun of the container check to mark SV4 done.
1a. **srv-fix-2** (brief written, `server-core-briefs/brief-srv-fix-2.txt`; start after srv-http-1): the second fresh review (of 1ce5c2a3 and dbbf817e) found gates open when `NODE_ENV` is unset. The development code must need `NODE_ENV=development`; `examplesServed()` must default off unless development or test; `keep.ts` must treat any object with `site`, `may_store` or `keep_until` as a row; no email lockout when no sender exists; the code generator chosen per code; a vendor's error text never logged. Also from it: `prune` reads every job and frame inside a write transaction after each search (move it to a timer and select only expiring rows), and the SV2 proof has no end-to-end "after a finished search" test yet. The search lead was asked to log `storable(answer)` instead of the whole answer in search.ts (its `answer.*` log events carry Dupe rows into the host's logs).
2. **srv-vault-1** (after srv-http-1, it extends `secrets.ts`): `store/vault.ts` AES-256-GCM vault in SQLite with the ref as AAD, `SECONDHAND_VAULT_KEY` in production; `createRuntime` takes `options.vault`; seeding only when `examplesServed()`; push tokens into the vault under `push/<user_id>` (B12, me.ts).
3. **srv-obs-1** (SV7, after srv-http-1, it touches `ports.ts`): the writer refuses any row whose `may_store` is not true (Dupe as a second guard), requires top-level `may_store`, `may_model`, `use_scope`, `keep_until`, `channel` agreeing with `rights`, refuses seller handles and places finer than a city; reader `show` drops expired rows, `model` also needs `may_model` true at both levels; `use_scope` carried, never filtered; `PUBLIC = 'sys_public'` rows survive `deleteUser`. Agreed with the engines lead (valuation reads `show`, fits read `model`) and the data lead.
4. The Databricks landing (after SV7): one `<job_id>.jsonl` per finished search to `/Volumes/secondhand/raw/landing/observations/<date>/`, the shape in the notes folder; never rewrite a landed file (new lines go in `<job_id>-2.jsonl`); keys by presence, else a local outbox sent on the next tick.
5. **Blobs** (agreed with the capture lead): `store/blobs.ts` `target/read/remove/onUploaded`, `PUT /v1/uploads/:id` signed and single-use, 25 MB, type from the magic number, GPS and face-region metadata stripped before the write. `route()` reads every body as text, so the upload route needs a raw-body option in `http.ts`.
6. Jobs round 2: keep a job's stream open after `done` while `fill_until` (set by search) is in the future, closing on `answer.late`, capped by a param `job_fill_grace_s` (prior 60). Apify caps as `kv` counters `apify_runs/person:<id>:<day>` and `apify_runs/day:<day>` behind the search lead's `apifyRuns.reserve` port, composed with `apifyToken` when the search lead says SR3 is ready.
7. SV8 (every example route reads the Store or says `not_built`; follow the app-wiring map, AP3), SV9 (needs Nate's linked account), the rest of SV10 (link by email only when `email_verified`, B10).
8. Hosting: when the container check passes in full, ask Nate (each step his): create the Fly app and volume, set the secrets by name, deploy. Then send the origin to the buying-conversation lead, who sets `SECONDHAND_API_ORIGIN` on Vercel (Nate said yes to that). `flyctl` is installed and signed in on Windows (`%USERPROFILE%\.fly\bin\flyctl.exe`).

## Decisions, one line each

- SQLite through `node:sqlite`, not Postgres or Lakebase now: the `Store` port is synchronous and forty callers use it so ([server-store.md](../../../../spec/plans/server-store.md)).
- Simple state goes in the `rows` table or `kv`, no schema per feature (Nate, [words](../../../../product/words.md#2026-11-15-nate-the-easiest-store-for-the-simple-state)).
- The tick log is a `note` with `msg: 'watch.tick'`, and the dev code's log a `note` with `msg: 'auth.dev_code'`, so no new event names were needed in `spec/events.json`.
- SV6 is the engines lead's (EN6), on the SV7 port.

## Waiting on Nate

The email sender's vendor (none composed; `configureSender` is ready). Each Fly step. A marketplace account linked for SV9.

## Learned the hard way

- A Codex worker's sandbox refuses localhost listeners: any test that opens a port is the lead's to run on the Mac.
- `origin/main` moves every few minutes: land by merging main in the Mac worktree, then pushing the branch straight to `main` from Windows (`git push origin mac/w/<name>:refs/heads/main`) in a short retry loop; never merge in the shared Windows checkout, which holds other sessions' uncommitted files.
- Never put backticks inside a double-quoted shell string: on 2026-11-15 one ran `node server/main.ts` on Windows and pasted log lines (with a local path) into finalization.md (48988617, fixed in 1ed63e8e; flagged for the history rewrite). Write text through a file.
- A dev server with no `SECONDHAND_DATA_DIR` now shares `secondhand-dev/secondhand.db` in the temp folder with every dev server on the machine; another session held it open, so do not delete it.
- `search-latency.test.ts` failed 3 on main for search's own changes; the search lead is fixing it.

**Last note (13:45 UTC):** the search lead's own restore (eaa2d679) and mine (ff56bbda) agree: on main the 18 files equal 125a56bb and `store/secrets.ts` is present. The search lead saw `server/main.test.ts` fail one test ("one Node server shares sign-in state, rows and streams across route wrappers") in their run; on the Mac at ff56bbda it passed 8 of 8. Rerun it on the Mac at current main first; if it fails only on Windows, suspect a port or a shared temp database held by a running dev server.
