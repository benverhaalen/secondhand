# 86: server core handoff

Updated: 2026-11-15, about 08:30 Central. Owner: Nate. Agent: Claude Code, the server-core lead (Opus 5.5), handing off at about half context per [packet 55](55-team-leads-and-mac-workers.md#a-session-ends-before-it-fills). Area: [finalization §2](../../../../spec/plans/finalization.md#2-server-core-lead-server), rows SV0 to SV10. Nothing was deployed, nothing was created on Fly, no secret was set anywhere.

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

## On the Mac (`~/dev/projects/secondhand-wt/<name>`, branch `w/<name>`)

- **srv-http-1**, round 3 running: idempotency slot taken before the handler (409 `stale` on a concurrent duplicate), the visitor bucket in `kv`, server-signed visitor ids (`vis_` + 12 + 20 hex mac, matching the app's regex), decision key from `secret('decision')` and versions on the row, last open in `kv`, `secrets.ts` with `requireProduction()`, `'late'` in `Stage`, the entry calling `requireProduction()`, callers' test resets. The search lead allowed edits to the visitor fixtures and reset lines only in `search.test.ts`. Land it, rerun `server/main.test.ts` and `bash server/container-check.sh` on the Mac (Docker Desktop must be running: `open -a Docker`).
- **srv-proof-1**, running: `server/proof.test.ts`, the out-of-process proof of SV0, SV1 and SV3 (sign in through the routes on the built server, two routes write, restart, all holds). The worker sandbox refuses localhost; run it on the Mac yourself, then have a fresh reviewer rerun it over SSH: that closes SV0.
- `w/int-obs-1`: parked; take only `events/observations.ts` and its test from it (brief below), never its valuations, valuation-sold, search or proof hunks.

## Next, in order (every brief this lead wrote is in the shared notes folder `server-core-briefs/` (outside the repo); write fresh ones from these lines if it is gone)

1. Land srv-http-1 and srv-proof-1; mark SV0, SV1, SV3 on their proofs once a fresh reviewer reran them; SV5 done for the account part (the reviewer said so), the job read with dbbf817e after the second review.
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
