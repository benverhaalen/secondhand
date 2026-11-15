# 86: server core handoff

Updated: 2026-11-15, about 10:20 Central (16:20 UTC), at the TestFlight hold, by the second server-core lead; first written about 13:15 UTC. Owner: Nate. Agent: Claude Code, the server-core lead (Opus 5.5), handing off at about half context per [packet 55](55-team-leads-and-mac-workers.md#a-session-ends-before-it-fills). Area: [finalization §2](../../../../spec/plans/finalization.md#2-server-core-lead-server), rows SV0 to SV10. Nothing was deployed, nothing was created on Fly, no secret was set anywhere.

## Now, 2026-11-15 about 16:20 UTC (second server-core lead, at the TestFlight hold; read this first)

**Hosted.** Fly `secondhand-api` runs release v7 (deployed by the capture lead), whose code main covers from 61ee012f. **From now only the orchestrator deploys to Fly.** The account is a free trial (Nate confirmed): the machine stops 5 minutes after each start until a card is added; then `%USERPROFILE%\.fly\bin\flyctl.exe machine start 8e170ec76731d8 -a secondhand-api`. Live by IP 66.241.124.170 (the campus resolver answers NXDOMAIN): `/healthz` 200 in about 50 ms, `/v1/routes` 401, a bad upload token 404, email start 503 (no sender), search composed with the Browser Use cloud browser. OPENROUTER_API_KEY is set with no daily cap on the Jev call each anonymous search makes; Nate redeployed knowing that ("Yes, redeploy").

**Fixed since the halt section below, all on main:** the five red gate tests (example jobs seeded at import; 29b0fdd8); the journey over every route with a second person locked out, idempotency for PUT/PATCH/DELETE, no example taste facets for a new person, opt-in `JOURNEY_TIMINGS` (via w/srv-final); the photo route in the uploads handlers and routes example; the Fly v3 boot crash ("Cannot find module 'playwright-core'"): it is a runtime dependency now and composition survives a missing browser library (b43f5718, proved by booting the image in Docker with a browser key).

**Benchmark.** Five journey runs, 1,515 requests over all 100 routes: p50 0.7 ms, p95 1.9 ms, max 15.1 ms; 41 routes work end to end, 20 answer `unavailable` honestly, 23 were probed only for refusals, 15 are other leads' and still serve examples (market, compare, out, POST accounts, genie, items sell and listings, captures talk). Table: `side-session-notes/.../server-route-timings-2026-11-15.md`.

**Capture, decided and not built.** Nate, to "Should a capture save and identify with whatever photos arrived?": "Yes, keep what arrived" (this changes Ben's d1006a17 rule; the orchestrator's last relay still said Ben's rule stands, so settle it with Ben). Not built: rebuild on main after w/cap-final, changing the one test the capture lead named, then rerun `node scripts/capture-e2e.mjs`; brief in `server-core-briefs/capture-keep-what-arrived.md`. The old branch `w/srv-capture-fallback` is not to be landed.

**Why photos may not arrive, for the TestFlight build:** the upload address is `SECONDHAND_PUBLIC_ORIGIN` or `http://localhost:<PORT>` (uploads.ts `photos()`), so a physical phone against a dev server PUTs to itself (set on Fly, so a build pointed at Fly is fine); library picks label any non-PNG as image/jpeg (`capture/live.tsx:111`), so a HEIC is refused 415.

**Next, after the hold:** srv-fix-4 (vault and SV7 review fixes, the rights rule); a daily Jev cap (the search lead's files) and a per-person chat cap; the email faults before Resend; CORS if the site calls Fly directly; a body size cap before auth; SV8 for the 15 routes above with their owners.

## Redeploy of current main to Fly, prepared and not run (2026-11-15, about 16:00 UTC)

Nothing below has been run. Each step is Nate's yes, asked each time. Fly runs an old image (main 9c8eab08); the machine stops five minutes after each start until a card is on the Fly account.

**The exact steps, from the clean deploy worktree (never the shared checkout):**

```
cd C:\dev\secondhand-deploy
git fetch origin
git checkout --detach origin/main
git log --oneline -1
%USERPROFILE%\.fly\bin\flyctl.exe deploy --remote-only --ha=false -a secondhand-api
%USERPROFILE%\.fly\bin\flyctl.exe machine start 8e170ec76731d8 -a secondhand-api
```

Before it: `bash server/container-check.sh` on the Mac in a worktree at the same commit (every step ok), and `server/journey.test.ts` green there. After it, probe from the Mac (the campus resolver answers NXDOMAIN for fly.dev): `/healthz` 200, `/v1/routes` 401, `PUT /v1/uploads/abc` 404, `POST /v1/auth/email/start` 503 until a sender exists. The deploy carries the new `fly.toml` env: `SECONDHAND_PUBLIC_ORIGIN`, `APPLE_CLIENT_IDS`, `GOOGLE_CLIENT_IDS` (iOS and Web), `SECONDHAND_WEB_ORIGINS` (asecondhand.app, www., secondhand-eight.vercel.app).

**What each key set on Fly turns on in main today, and what must be fixed first** (from `side-session-notes/.../deploy-security-review-1.md`, rechecked against main):

| Key | Turns on | Fault named for it | State on main | Before the machine runs with it |
|---|---|---|---|---|
| `OPENROUTER_API_KEY` | The identity reconciler in every visitor search (`intel/jev.ts`, paid per call), and the buying chat's model (`assist/converse.ts` `clientFromEnv`, signed-in only) | Review item 2: anonymous visitors reach a paid call with only the 30-a-minute per-address bucket; no per-day or global cap | Still open: no Jev daily cap on main | **Must fix:** a global per-day cap on Jev calls (a `searchParams` row like `search_apify_runs_per_day`, counted in `kv`), and a per-person daily cap on the chat. The key is already set, so even starting the old image exposes this |
| `BROWSER_USE_API_KEY` | Cloud browser reads for public eBay and Depop pages (`harness/compose.ts` `browserUseCloud`), on every search, visitors included | Not in the review (it predates the composition) | No daily cap found | **Should fix:** a per-day session cap counted in `kv`, as for Apify |
| `TREG_TOKEN` | Google Shopping reads through treg (`createShopping`), capped by `search_shopping_usd_per_day` (prior $1.00) | Not in the review | Capped, but the counter is in memory (`memoryShoppingSpend`, marked `shortcut:`): a restart resets the day's spend | Move the counter to `kv` (the server core's part of SR3) |
| `APIFY_TOKEN` | Nothing in the server today: `composeSources` returns no `apifyToken` until Apify runs only as a background fill (SR3) | Capped by `search_apify_runs_per_day` (prior 200) once composed | Not read by the server | Compose `apifyRuns.reserve` in `kv` when the search lead says SR3 is ready |

**Open for any public run, whatever the keys:** review item 4, `http.ts:173` reads any JSON body with `req.text()` before auth with no size cap (one stranger can exhaust the 512 MB machine); item 1, a resend resets the email guess count (dormant until `RESEND_API_KEY` is set); items 3 and 5, `/v1/health` and `/v1/stage` are bare routes (health is harmless until `DATABRICKS_HOST` is set). Never set `SECONDHAND_EXAMPLES=1` on Fly.

## At the halt, 2026-11-15 about 15:30 UTC (the second server-core lead; read this first)

Nate halted all leads ("we need to stop agents from merging and working on top of eachother"). From now the orchestrator alone merges to main, from the branches below.

**On main from this lead, each rerun on the Mac on a tree merged with main:**

| What | Commit on main |
|---|---|
| Production refusals hold unless `NODE_ENV=development` is stated (`development(env)` in `store/db.ts`); keep.ts fails closed | 56e985fd |
| Frames whose root names a site are stored with their rows (fix of the review's HIGH) | 4a72e9e9 |
| Encrypted vault, push tokens in it | 5177d340, 28567664 |
| SV7 observation writer and reads | 03a7737f, 7139cedc |
| Pipeline passes the job's person to the harness; Depop shop page without `page_info` is the last page (walk 7/7, watcher week green) | e8981d9f |
| Photo store composed; captured photos get real single-use upload targets; `fly.toml` public origin and Apple ids | eaec5743 |
| `fly.toml`: `GOOGLE_CLIENT_IDS` (iOS and Web clients, project secondhand-514813), `SECONDHAND_WEB_ORIGINS` (asecondhand.app, www., secondhand-eight.vercel.app) | 2875b02a, 9d9887d1, 2c53871b |
| Ben's onboarding merge: the twenty red server tests fixed (packet 95) | f5fb5a3e (merged 675eef3e) |
| A search stream stays open after done while `fill_until` is ahead (late eBay and Facebook), param `job_fill_grace_s` 60 | caf18957 (merged f68ef90a) |
| Landing fixture: line 1 Facebook through Apify, line 2 brand never modelled | 73644e78 |
| Boot recovery leaves the seeded example jobs alone (no `no_engine: sweep` at boot) | 8d34eee5 |

**The twenty red server tests after Ben's merge: all fixed** at f5fb5a3e, rerun on the Mac after merging main (accounts 38, conversations 29, items 70, orders 40, routes 6, runtime 47, watch 8, realtime-proof 13, spec/examples 9, search 98, uploads 30; tsc clean): accounts.import (contract example and reconnect replay), accounts.import_preview, accounts.unlink, an import job creates live rows once, import preview labels the stored fallback, offline linked preview reports no_route, a successful empty live preview replaces cached rows, live site provenance on harness listing reads, conversations.list (example and wrong user), conversations.messages, items.list (example and wrong user), orders.list (example and wrong user), order reads use orderBook records, the two orders fee tests, the three routes.test.ts tests, "3: the configured recorded source...", "one --once runs jobs enqueued by the import and unlink routes". None left red. The whole 4,226 gate was not rerun by this lead.

**On Mac branches, not on main:**
- `w/srv-honest-1`, **ready to land**: committed a9363123, main merged into it at ce501973; on that tree wants, insights, decisions, runtime, watcher, http, spec/examples and server/main all exit 0 on the Mac and tsc is clean. Branch on Windows after `git fetch mac 'refs/heads/w/*:refs/remotes/mac/w/*'`: `mac/w/srv-honest-1`. It holds Ben's packet 91 items 10 (compose `runWant` on the tick), 7 (insights: example only to the example person, `not_built` for a real one), 4 (decision act refuses an unmapped kind, row unchanged). Files: wants, insights, decisions, runtime and their tests. Insights and an unmapped decision act answer 503 `unavailable`; background want watches skip Facebook and Mercari (no background source for them yet; listed as `behind`). Brief: `server-core-briefs/brief-srv-honest-1.txt` in the notes folder.
- Every other `srv-*` worktree of this lead is merged and removable.

**Half done:** nothing open in the shared checkout. Google sign-in: server side set up; no client code on main or any pushed branch fetches a Google ID token (Nate says Ben has a button, presumably unpushed). Email: Ben's Resend sender needs `RESEND_API_KEY` (secret) and `SECONDHAND_EMAIL_FROM`; fix the two email faults first.

**Next, in order:**
1. Land `w/srv-honest-1` (the orchestrator).
2. Brief srv-fix-4 (vault and SV7 review fixes, the Databricks rights rule item h) from `server-core-briefs/brief-srv-fix-4.txt`.
3. A fresh reviewer on e8981d9f, eaec5743, caf18957, f5fb5a3e (none reviewed yet).
4. The email faults (a resend resets the guess count; no per-address limit on auth-none routes), then Resend.
5. CORS headers for the three site origins if the site calls the Fly origin directly; `req.text()` with no size cap before auth.
6. SV8 for the rest of the example-backed routes (appointments.list, orders.pick_list and others, in the app-wiring map's order); wire the observation writer (engines port, search landing, then the Databricks landing).

**Hosted.** Last deploy: main 9c8eab08 at about 13:49 UTC (later commits not deployed; the Google ids and web origins need a redeploy). The machine stops 5 minutes after each start until Nate adds a card on the Fly account. Start it with:

```
%USERPROFILE%\.fly\bin\flyctl.exe machine start 8e170ec76731d8 -a secondhand-api
```

Redeploy (Nate's yes each time) from the clean worktree `C:\dev\secondhand-deploy`: `git checkout --detach origin/main`, then `flyctl deploy --remote-only --ha=false -a secondhand-api`. The campus DNS answers NXDOMAIN for the fly.dev name; probe by IP 66.241.124.170 or from another resolver.

## At 14:00 UTC, the second server-core lead (read this first; the sections below are the first lead's and still hold unless this says otherwise)

**On main, each rerun on the Mac by this lead (tests one file at a time, `tsc` clean):**

| What | Commit on main | Proved by |
|---|---|---|
| Every production refusal holds unless `NODE_ENV=development` is stated: no data folder means no database, keys required, boot lists what is missing, no examples, the development code ignored with a note. One rule, `development(env)` in `store/db.ts`, used by db, secrets, examplesServed; a test that states production in the runner keeps the refusals. Plus srv-fix-2: keep.ts fails closed, no email lockout without a sender, code generator per code, no vendor text in logs | 56e985fd (on main 29058664) | db 2 suites, secrets, auth, api/auth, keep, jobs, server/main, server/proof all exit 0. Fresh Opus review: one HIGH regression (frames stored as null), fixed below |
| A frame whose root names its site is stored with its rows (the root is a row only by its own `may_store`/`keep_until`); sender error names kept only as plain words; crash receiver needs development | 4a72e9e9 | keep.test and a new jobs.test read an `answer.partial` back from SQLite after a restart; both failed on the old code |
| Encrypted vault (`store/vault.ts`, AES-256-GCM, ref as AAD, versions, tombstones); push tokens in it under `push/<user_id>`; examples seeded only where served; `SECONDHAND_VAULT_KEY` in the boot check | 5177d340, 28567664 (on main b7b24f65) | vault 7, secrets, runtime 46, me 24, accounts, search, watcher, server/main |
| SV7 observation writer and its two reads (`events/observations.ts`, table `observation`); proof link 5 says it exists and nothing calls it yet | 03a7737f, 7139cedc (on main fcec6e91) | observations 92 across memory and SQLite stores, sqlite-store, ports, me, realtime-proof |
| The pipeline passes the job's person on every harness call (since d042963f every post, delist and offer answer was refused as "not linked"); a Depop shop reply with no `page_info` is the last page (ac133f38 had broken the watcher's week) | e8981d9f | `scripts/walk.test.mjs` 7 of 7 (all fifteen stages), watcher, pipeline, depop adapter |
| Photos: one photo store per server beside the database; `PUT /v1/uploads/:id` uses it; `POST /v1/captures/:id/photos` gives a captured row a real single-use target (example rows keep the example address). `fly.toml` sets `SECONDHAND_PUBLIC_ORIGIN` and `APPLE_CLIENT_IDS = com.bnvg.secondhand` (public identifiers) | eaec5743 (on main 9c8eab08) | captures, uploads, http, server/main; `bash server/container-check.sh` on the Mac at 9c8eab08, every step ok |

**Hosted.** Redeployed main 9c8eab08 to `secondhand-api` at about 13:49 UTC on Nate's "Fix the server to be up". Probed by IP from the Mac (this network's DNS answers NXDOMAIN for the fly.dev name): `/healthz` 200 in 54 ms, `/v1/routes` 401, a bad upload token 404 (the route is composed), email start 503 "no email sender is configured". **The machine stops after 5 minutes: the Fly account is a trial** ("Trial machine stopping. To run for longer than 5m0s, add a credit card"). Only Nate can add the card; after it, `flyctl machine start 8e170ec76731d8 -a secondhand-api`.

**Sign-in on the hosted server today:** none works yet. Email: Ben's `connect/email.ts` sends through Resend when `RESEND_API_KEY` (a secret) and `SECONDHAND_EMAIL_FROM` (an address on a domain verified in Resend) are set; fix the review's two email faults first (a resend resets the guess count; no per-address limit on auth-none routes). Apple: `APPLE_CLIENT_IDS` is now set; the app needs its Apple button wired. Google: the server verifies Google ID tokens against `GOOGLE_CLIENT_IDS` (comma list); Nate made Cloud project `secondhand-514813`; he creates the iOS client (bundle `com.bnvg.secondhand`) and a Web client in Google Auth Platform, then the ids go into `fly.toml` and a redeploy. The app has no Google sign-in client code yet (Ben's or the app-wiring lead's).

**Open, in order:**
1. The fresh review of the vault and SV7 (14:00 UTC) said fix first: (a) a PATCH /v1/me in flight can write a push token back after DELETE (tombstone version accepted by compareAndPut; the user row is never marked deleted); (b) the Dupe guard is `site === 'dupe'` only: compare case-insensitively and refuse `data`, `payload.source` or `payload.attribution` naming Dupe; (c) a rewrite with stricter rights is skipped because the id omits rights and `keep_until`; (d) private fields slip the key regexes (values unchecked; `postcode`, `location`, `email`, `phone`, `owner`; `query` stored in PUBLIC); (e) DELETE failing midway strands vault entries; (f) legacy raw push tokens used as refs; (g) `JSON.parse` outside the vault's try. (h) From the Databricks lead on Nate's word (product/words.md, ac92ad02): the writer refuses `may_model` true for eBay by any route, allows it only for Facebook Marketplace via Apify (`use_scope` hackathon_demo), and refuses an Apify row for any other site; `load_observations` (DB11) refuses the same lines. Brief: `server-core-briefs/brief-srv-fix-4.txt` in the notes folder. Nothing calls the observation writer yet, so (b) to (d) are not live.
2. Wire the observation writer: the engines lead's `ObservationPort` default (one marked line) and search's landing; then the Databricks landing (item 4 of the first lead's list).
3. SV8 in the order of `spec/plans/app-wiring.md`; the email faults above; the review's "should fix" (`req.text()` reads any body before auth with no size cap); the rest of SV10.
4. A fresh reviewer for e8981d9f and eaec5743 (photos are the reviewed kind). Not yet run.

**Mac worktrees of this lead:** srv-fix-2, srv-vault-1, srv-obs-1, srv-fix-3, srv-walk-1, all merged to main; removable.

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

## Hosted, 2026-11-15 13:27 UTC (by the capture lead, on Nate's "Yes, Fly now")

- **Origin:** `https://secondhand-api.fly.dev` (app `secondhand-api`, personal org, region `ord`, one machine `8e170ec76731d8`, volume `secondhand_data` 1 GB encrypted with daily snapshots). Deployed from a clean worktree of main at 8f878066 (`C:\dev\secondhand-deploy`, `flyctl deploy --remote-only --ha=false`), never from the shared checkout.
- **Before it:** `bash server/container-check.sh` passed every step on the Mac at a6c0ae78 (build, /healthz, 401 on /v1/routes, watch tick, SIGTERM 0, db on /data, refusal without `DECISION_SIGNING_KEY`). A fresh Opus security review said deploy, no must-fix for this configuration (`side-session-notes/.../deploy-security-review-1.md`).
- **After it:** `/healthz` 200 in 0.14 s, `/v1/routes` and `/v1/today` 401 `unauthenticated`, `/v1/stage` 200. Fly's check passes.
- **Secrets set by name only:** `DECISION_SIGNING_KEY`, `SECONDHAND_VISITOR_KEY`, `SECONDHAND_VAULT_KEY` (random 32 bytes each, through stdin; nobody holds a copy, so a rotation is a fresh `fly secrets import`). No vendor key is set.
- **Must fix before turning each on** (from the review): an email sender (a resend resets the guess count and auth 'none' routes have no address limit: about 10 guesses a minute per email); `OPENROUTER_API_KEY` (visitor search reaches a paid model with no daily cap); `DATABRICKS_HOST` with a warehouse (`/v1/health` runs a query on every unauthenticated call). Never set `SECONDHAND_EXAMPLES=1` on Fly. Should fix: `req.text()` reads any body before auth with no size cap on a 512 MB machine.
- **Waiting:** the photo store (`w/cap-blobs-1`, 6dcdb099, in review) and capture's route join, then a redeploy; `SECONDHAND_API_ORIGIN` on the site's Vercel project (Nate said yes to that earlier).
