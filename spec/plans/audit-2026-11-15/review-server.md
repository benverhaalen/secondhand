# Server review: secondhand /v1 on main (2026-11-15)

This review is read-only. Nothing in it was run against a server. "Verified" means read in source. "Inferred" means it follows from source I read plus the Expo loading behaviour described below. "Unverified" means I did not read it.

## How Expo loads the server (verified in node_modules)

- **Dev (`expo start`):** each request evaluates each route bundle fresh, with `cache:false`. See getStaticRenderFunctions.js L163-186 and the "TODO: Cache the evaluated function" note at MetroBundlerDevServer.js L1379-1388. The evaluation runs in the same Node realm (`mod._compile`, @expo/require-utils/build/load.js L265). So `globalThis` survives between requests, but every module-level `const x = new Map()` / `memoryStore()` is new on each request.
- **Production (`expo export` then expo-server's node/express adapter):** each route file is its own self-contained bundle, loaded once with `require` (expo-server node.js L62-70). Module state persists within one route, but **each route bundle has its own copy of every module**. `globalThis` is the only thing they share.
- **Only one piece of state uses `globalThis`:** the job store, at app/src/edge/api/jobs.ts:166-169 (`shared.__secondhandJobs ??= ...`). Every other store is per bundle in production and per request in dev.

## 1. Bugs and security faults, ranked by consequence

### B1 (critical): signed-in sessions do not reach any other route. Sign-in cannot work in dev or in production.
- **Where:** app/src/edge/auth.ts:249 `export const store = memoryStore();` and auth.ts:250-251, which binds `deps.verify = auth.verifyAccess`. The verifier is set on the `deps` object at app/src/edge/api/http.ts:49-50 (`verify: async () => null`).
- **Failure in production:**
  1. POST /v1/auth/email/verify (one bundle) mints a session in that bundle's memoryStore.
  2. GET /v1/me (another bundle) has its own auth.ts copy, with an empty store.
  3. `deps.verify` returns null, and http.ts:128 throws `unauthenticated`.
  4. Result: every `auth: 'user'` route returns 401.
- **Failure in dev:** the code written by email/start (auth.ts:213, into the module store) is gone by the time email/verify runs. So verify can never succeed, even once a sender exists.
- **Smallest fix:** put the auth store on `globalThis`, the way jobs.ts:168 does (`globalThis.__secondhandAuth ??= memoryStore()`). The real fix is the single server entry in section 2 plus an on-disk table.

### B2 (critical): with `SECONDHAND_DATA_DIR` set, route bundles overwrite each other's data
- **Where:**
  - app/src/edge/api/store.ts:7, which picks `fileStore(...)` per bundle.
  - app/src/edge/events/file-store.ts:41, `const memory = memoryStore(load(path));`, which loads once.
  - file-store.ts:44-48, which rewrites the whole file from that bundle's memory on every write.
- **Failure:**
  1. The items bundle loads store.json at t0.
  2. The accounts bundle writes an account and saves.
  3. The items bundle then writes an item. It saves its t0 copy plus the item, which **deletes the account row**.
  4. Reads come only from memory (file-store.ts:56-57), so each bundle also serves stale data.
  5. In dev, every request reloads from the file, so this mostly works there. That hides the bug until the server is hosted.
- **Smallest fix:** `globalThis.__secondhandStore ??= ...` in store.ts:7. The proper fix is SQLite (or Postgres) with per-row writes, not a whole-file rewrite.

### B3 (high): example rows are written into the real store at every boot
- **Where:**
  - app/src/edge/api/runtime.ts:72 calls `seedExamples(st)`. It writes items, accounts, limits and decisions for `usr_8f2k` (runtime.ts:30-61).
  - jobs.ts:113-120 seeds example jobs.
  - captures.ts:127, conversations.ts:21 and orders.ts:10 do the same in their own modules.
- **Failure:**
  - A hosted store.json fills up with fixture rows.
  - If any real identity ever maps to `usr_8f2k`, that person sees fixture data and can act on it.
  - Every boot re-seeds.
- **Fix:** gate seeding on an env flag (for example `SECONDHAND_EXAMPLES=1`) that is off in hosting.

### B4 (high): any visitor can read the example visitor's jobs and take over seeded job ids
- **Where:**
  - jobs.ts:25 `row.user_id === who || (row.user_id === EXAMPLE_VISITOR && who.startsWith('vis_'))`
  - jobs.ts:31: start() lets a `vis_` caller take over a job id seeded for EXAMPLE_VISITOR.
- **Failure:** today it exposes fixture data only. But any row ever written with `user_id = vis_example01` becomes readable by every visitor. search.ts guards against that id ("use a new visitor session"), but other writers do not.
- **Fix:** delete the EXAMPLE_VISITOR clause in production (it goes away with B3's flag).

### B5 (high): the visitor identity is chosen by the client, so it can be claimed and the rate limit bypassed
- **Where:**
  - http.ts:131 `visitor_id = given && /^vis_[a-z0-9]{8,32}$/.test(given) ? given : id('vis_');`
  - http.ts:133 `visit(deps.connectingAddress(req) ?? visitor_id);`
- **Failure (claiming):** a visitor's jobs are keyed by this id (jobs.ts:126). Anyone who learns another visitor's X-Visitor-Id can read that visitor's search jobs and event streams. The id is echoed in a response header (http.ts:150), so it leaks through logs and proxies.
- **Failure (rate limit):** without `SECONDHAND_PEER_HEADER` (http.ts:47, :58), changing the header resets the 30-per-minute bucket. That means unlimited searches, each of which fans out to marketplaces.
- **Fix:**
  - Issue the visitor id from the server as an HMAC-signed value (`vis_<rand>.<mac>`) and reject unsigned ones.
  - Require `SECONDHAND_PEER_HEADER` at boot in production (`Fly-Client-IP` on Fly).

### B6 (high): idempotency does not stop concurrent duplicates
- **Where:** http.ts:139-148. The key is checked at :139, but `deps.idem.set` runs only after `await handler(...)` (:144-147).
- **Failure:** a double-tap on POST /v1/orders, /v1/accounts or /v1/items/:id/sell sends two requests with the same key. Both miss the cache and both run.
- **Also:**
  - Results with status ≥500 are not stored (:145), so a retry after a timeout runs the job again.
  - The map is per request in dev, so there is no idempotency at all there.
  - In production it is per bundle. That is fine only because the slot key includes the endpoint (:138).
- **Fix:** before the handler runs, store an in-flight marker (or a promise) under the slot, and replay it or return 409 for a concurrent duplicate.

### B7 (high): the decision signing key is random per bundle, so acting on a decision fails
- **Where:**
  - app/src/edge/api/decisions.ts:21 `const KEY = process.env.DECISION_SIGNING_KEY || randomBytes(32).toString('hex');`
  - Tokens are signed at :28 (GET /v1/decisions) and checked at :34 (POST /v1/decisions/:id/act).
  - `versions` is a per-module Map (:23), changed at :119.
- **Failure:** in production, GET and act are different bundles with different keys, so every act fails its MAC check. In dev, every request gets a new key. Versions also reset, so stale-act protection is per bundle.
- **Fix:** make `DECISION_SIGNING_KEY` required at boot in production, and move the version onto the row (the db-1 note at :23).

### B8 (medium): refresh tokens have no reuse detection
- **Where:** auth.ts:221-226. `takeSession` rotates the token, but a replayed refresh token does not revoke its family.
- **Failure:** an attacker who steals a refresh token and uses it first keeps the session for 30 days. The real user's next refresh just fails, and nothing is revoked.
- **Fix:** store a `family_id` and `used` flag on each session. If a used token is presented again, drop the whole family.

### B9 (medium): requesting a resend burns a verification attempt
- **Where:** auth.ts:213. startEmail calls `tryCode` for the resend check, and tryCode increments attempts (auth.ts:70).
- **Failure:** a person who taps "resend" a few times locks themselves out of their own code.
- **Fix:** read the code's state without incrementing.

### B10 (medium): accounts are linked by email
- **Where:** auth.ts:188. The identity lookup falls back to `email_hash`.
- **Failure:** if any provider ever returns an email that isn't verified, signing in with it gets you that person's account.
- **Fix:** link by email only when the provider sets `email_verified: true`. Check Apple's private-relay case. (Unverified: whether the JWT claims check already does this.)

### B11 (medium): auth rate limits are per bundle and per address only
- **Where:** app/src/edge/api/auth.ts:14 (Maps at module level) and :20 (without the peer header, only the per-address limit of 5 per hour at :7 applies).
- **Failure:**
  - In production, start and verify each count separately.
  - In dev, the limits reset on every request.
  - Without the peer header there is no per-IP limit at all. One machine can request codes for any number of addresses.
- **Fix:** move the limits onto `globalThis`, or into the store, and require the peer header (as in B5).

### B12 (medium): push tokens are stored raw on the user row
- **Where:** app/src/edge/api/me.ts:67 `next_.push_token_ref = b.push_token; ... // shortcut: the token is kept as-is`.
- GET /v1/me drops it from the response (me.ts:51), but export does not: `redactRefs` matches keys ending in `token_ref`, which covers `push_token_ref`. Unverified whether exportUser includes auth-store users at all.
- **Risk:** the raw token sits in the store and in any store.json backup.
- **Fix:** put it in the vault, as the comment already says.

### B13 (medium): marketplace sign-ins live in memory and vanish on restart
- **Where:**
  - runtime.ts:74 `const vault = memoryVault();`
  - connect/signin.ts:20 sessions Map
  - connect/ebay.ts:20 `access` Map
- **Failure:** after a deploy or a crash, every linked account still says it is linked, but its `token_ref` points to nothing. In production, POST /v1/accounts and the import routes are different bundles, so the vault written in one is not visible in the other.
- **Fix:** an encrypted on-disk vault (with a libsodium key from env) on `globalThis` or behind the single server entry.

### B14 (low): GET /v1/jobs 404s when the visitor id changes
- **Where:** jobs.ts:25 together with http.ts:131.
- **What the lead saw:** POST /v1/search then GET /v1/jobs/:id returned 404. Two possible causes:
  - The GET did not resend the X-Visitor-Id the POST returned, so http.ts:131 minted a new id and the owner check failed.
  - The run came before ed033820, which moved jobs to `globalThis`.
- **Client rule:** echo X-Visitor-Id from the first response on every later call.
- **Repeated `session.start` in logs:** this comes from `createLog` at http.ts:51, which runs every time a bundle is evaluated (log/index.js:165). It happens on every request in dev, and once per route bundle in production. It is noise, not a bug.

### B15 (low): list endpoints have no limit cap
- **Where:** runtime.ts:342 `Number(ctx.query.get('limit') ?? 100)`.
- Unverified whether pagination() in captures.ts caps it before this point.

## 2. What must change to run on one always-on Node machine with a disk (Fly.io)

1. **A single server entry.** This one removes B1, B2, B7, B11 and B13 together.
   - Add `app/server.ts` (Hono on node, or Express). It imports every edge `handlers`/`routeHandlers` map **once** and mounts each one with `route(endpoint, handler, opts)` from http.ts.
   - That gives one module graph, one store, one auth store, one vault, one key.
   - `routes.ts` already lists the manifest; drive the mounting from that list.
   - Keep the `+api.ts` files for dev only, or delete them. Don't host through `expo export`'s per-route bundles.
   - The interim alternative is to put every store on `globalThis`: auth.ts:249, store.ts:7, http.ts:54-55, api/auth.ts:14, runtime.ts:74, decisions.ts:21-23 and the module Maps in captures, market, orders, genie (`citationOwners`, genie.ts:44), today (`lastOpen`) and conversations.
2. **State to move to disk.** Use one SQLite file on a Fly volume (`/data/secondhand.db`). Mount it and set `SECONDHAND_DATA_DIR=/data`.
   - Store rows, events, jobs, decisions: replace the whole-file rewrite in file-store.ts:44-48.
   - Auth: users, sessions, codes, identities (the auth.ts memoryStore).
   - Idempotency slots (http.ts:54).
   - The vault, encrypted (runtime.ts:74, connect/signin.ts:20, ebay.ts:20).
   - Decision versions (decisions.ts:23).
   - Follows, orders and capture rows that live in module Maps today.
3. **What starts at boot.**
   - runtime.ts:301-307 returns `runOnce` for the watcher (runtime.ts:227) and the pipeline (runtime.ts:264), and `createRuntime(store)` at runtime.ts:311 passes no options. Nothing calls either one.
   - The server entry must start a `setInterval` (or the scheduler in events/schedule.ts) that ticks the watcher, the pipeline and the job claims (runtime.ts:207).
   - It must reset leases on boot (file-store.ts:33 already sets running jobs back to queued).
   - It must stop the timers on SIGTERM so Fly's deploys drain cleanly.
   - Run exactly one machine (`fly scale count 1`). Claims are in-process (`claims` Map, file-store.ts:52).
4. **Fixes to make before boot:**
   - runtime.ts:135 `createRequire(join(process.cwd(), 'app/package.json'))` assumes the working directory is the repo root. Set the Docker WORKDIR to match, or resolve the path from `import.meta`.
   - Turn off example seeding (B3).
   - Wire a real `sendCode`. auth.ts:247 `logSend` is an empty function, so **no email code is ever sent**. Use Resend, Postmark or SES.
5. **Environment variable names.**
   - Required in production:
     - `SECONDHAND_DATA_DIR`
     - `SECONDHAND_PEER_HEADER` (Fly-Client-IP)
     - `DECISION_SIGNING_KEY`
     - `APPLE_CLIENT_IDS` and `GOOGLE_CLIENT_IDS`: without them every provider token is rejected (auth.ts:97).
     - An email-sender key (new; name to choose).
     - A vault encryption key (new).
   - Feature flags: `SECONDHAND_LIVE_SITES` (runtime.ts:90; without it, adapters return `no_route` and writes are forced to dry runs, runtime.ts:115-126, :160-162), `SECONDHAND_CHROME_PATH`, `SECONDHAND_PLAYWRIGHT`, `STAGE_ALERTS`.
   - Vendors: `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `APIFY_TOKEN`, `BROWSER_USE_API_KEY`, `OPENROUTER_API_KEY`, `DATABRICKS_HOST`, `DATABRICKS_WAREHOUSE_ID`, `DATABRICKS_TOKEN`.
   - The server should fail at boot if any required name is missing, rather than fall back to a random key or a memory store.

## 3. Every /v1 route, in one of four states

The four states:
- **A: real and per person.** Reads and writes scoped to ctx.user_id or visitor.
- **B: real, but needs something that isn't composed yet.**
- **C: example data only.** `exampleHandler` at captures.ts:78 returns 404 "no example data for this user" for anyone who isn't `usr_8f2k`, unless the example is marked visitor. Visitor examples answer only the example ids.
- **D: throws, or cannot complete.**

**Overriding problem:** in production as bundled today, B1 turns every user-mode route into a 401. The states below assume B1 is fixed.

| Route | State | Handler line / reason |
|---|---|---|
| POST /v1/auth/apple, /google | B | auth.ts:65-66; needs APPLE_/GOOGLE_CLIENT_IDS (auth.ts:97) |
| POST /v1/auth/email/start, /verify | D | auth.ts:67-68; `logSend` sends nothing (auth.ts:247); in dev the code is lost between requests (B1) |
| POST /v1/auth/refresh, /signout | A | auth.ts:69-70 (B8 reuse gap) |
| POST /v1/auth/link/apple, /google, /email | B | auth.ts:71-73; same provider/sender needs |
| GET, PATCH /v1/me; GET, PATCH /v1/me/style | A | me.ts:159-164 |
| POST /v1/me/export | A | me.ts:127-133 |
| DELETE /v1/me | D | me.ts:43, 95; without a workspace port the job is created `paused: workspace_port_not_configured` and never finishes. Store rows and sessions are deleted (me.ts:86, :93) |
| POST, GET /v1/accounts | B | accounts.ts:39, 55; the connect result is the example seed with a new id (accounts.ts:42-50). The real sign-in flow and the vault are not wired (B13) |
| GET /v1/accounts/:id/import-preview, POST /v1/accounts/:id/import | B | accounts.ts:56, 65; harness `read_listings` returns `no_route` without LIVE_SITES; import queues a job that no worker ticks (section 2.3) |
| DELETE /v1/accounts/:id | A | accounts.ts:75, owner-checked via owned(); the unlink job is never processed |
| GET /v1/items/:id, PATCH /v1/items/:id, POST /v1/items/:id/strategy | A | items.ts:64, 76, 114 (engine) |
| GET /v1/items | C | items.ts:54 is `fromEngine(exampleHandler(...))`, and items.json has no visitor example, so **a real person's library list returns 404** |
| PATCH /v1/items/:id/attributes/:name, GET /v1/items/:id/plan-choices, POST /v1/items/:id/sell, POST /v1/items/:id/listings | C | items.ts:101, 133, 113, 132 |
| POST /v1/captures, GET/PATCH /v1/captures/:id, POST /:id/photos, POST /:id/finish | A, unverified | captures.ts:313-405 captureHandler (captures.ts:161 not read in depth); module-level captureRows (captures.ts:127) |
| POST /v1/captures/:id/talk | C | captures.ts:434 |
| POST /v1/search | B | search.ts:240; visitor; runs, but sources return `no_route` without SECONDHAND_LIVE_SITES or the browser (the lead's run: 4 of 6 no_route); the caller is always 'person' (search.ts:247) |
| GET /v1/jobs/:id, /events | A | jobs.ts:172-173, globalThis (B4, B14) |
| GET /v1/stream | A | jobs.ts:174 |
| GET /v1/decisions | A | decisions.ts:126 |
| POST /v1/decisions/:id/act | D in production | decisions.ts:127; MAC fails across bundles without DECISION_SIGNING_KEY (B7) |
| GET /v1/events, POST /v1/events/:id/undo | A | events.ts:46-47 |
| GET /v1/today | A | today.ts:39; `lastOpen` is a module Map |
| GET, PUT /v1/limits; GET, POST /v1/rules; DELETE /v1/rules/:id | A | rules.ts:42-90 |
| POST, GET /v1/wants; GET, PATCH /v1/wants/:id; GET /:id/matches; POST /v1/matches/:id/act | A | wants.ts:46-78, scoped through `st.get('want', ctx.user_id!, ...)` (wants.ts:39); match results need the watcher, which never ticks |
| POST /v1/assist | C | assist.ts:14 |
| POST /v1/compare, GET /v1/out | C (visitor) | buy.ts:25, 34 |
| GET /v1/conversations, GET /:id/messages | C | conversations.ts:102, 108 |
| POST /v1/conversations/:id/messages | unverified | conversations.ts:114; the account is fixed to usr_8f2k (conversations.ts:71) |
| POST /v1/genie | C | genie.ts:72; it returns null for anyone but usr_8f2k (genie.ts:22, 40) |
| GET /v1/insights | C | insights.ts:18; the port throws for anyone but usr_8f2k (insights.ts:15) |
| PUT /v1/goals/:month | C | insights.ts:28 |
| GET /v1/products/:id, /history, GET /v1/trends, GET /v1/index/:id | C (visitor) | market.ts:19-22 |
| POST, GET /v1/follows; PATCH, DELETE /v1/follows/:id | C | market.ts:23-46; module-level followRows seeded for usr_8f2k (market.ts:10) |
| GET, POST /v1/orders; GET /v1/appointments; POST /:id/handed-over, /:id/ship; POST /v1/orders/labels; GET /v1/orders/pick-list | C | orders.ts:13-28 |
| GET /v1/records | C | records.ts:6 |
| GET /v1/scores, /v1/scores/:id/basis, /v1/sites/:site/ranker, /v1/experiments; POST /v1/experiments/consent | C | scores.ts:30-46 |
| GET /v1/citations/:id | unverified | scores.ts:21, 44; the scoring port is fixed to usr_8f2k (scores.ts:15) |
| GET /v1/sources/health | C | sources.ts:19 |
| POST /v1/valuations | C | valuations.ts:27 |
| GET /v1/routes, GET /v1 | A (static) | routes.ts:30 |

**Count:** about 40 endpoints are A or B, and about 40 are C. Everything a person uses to sell (library list, orders, follows, insights, valuations, conversations) is C.

## 4. Solid parts to leave alone

- **http.ts route():**
  - Strips user_id from body and query (:117, :123).
  - The one error shape (:23-30).
  - X-Request-Id.
  - Visitor-bucket eviction with a cap (:86-102).
- **Auth primitives:**
  - SHA-256-hashed sessions, 1h access / 30d refresh rotation, 6-digit codes with attempt counting.
  - RS256 JWKS verification for Apple and Google.
  - These need persistence and B8, B9 and B10, not a rewrite.
- **Ownership checks:**
  - `owned()` (runtime.ts:313-317) is owner-scoped and checks for deleted rows.
  - runtime.ts:157-159 enforces account ownership on harness calls.
  - runtime.ts:160-162 forces dry runs unless the site is live.
  - byId requires person_id (runtime.ts:84).
  - Account routes all go through owned().
- **me.ts:**
  - PATCH has an allowlist of fields with optimistic versioning and a 409 that carries the current value (me.ts:16-20, 69-75).
  - DELETE removes vault refs and sessions and reports a vault failure honestly (me.ts:85-101).
- **The file-store** validates its state on load and requeues running jobs (file-store.ts:13-38). Keep the validation when it moves to SQLite.
- **The job store on `globalThis`** (jobs.ts:166-169) is the right pattern for now.

## Commands run

- Greps over app/src/app/v1 and app/src/edge/api (exit 0).
- No tests run, no server started.
- The gate results (3,355 tests, 9 failures; 2 tsc errors in app/src/app/new.tsx) come from the lead's brief. They are pre-existing and outside this axis.

## Not read (unverified)

- events/watcher.ts, pipeline.ts and schedule.ts in depth.
- gate/.
- notify/.
- store/store.ts.
- The body of connect/depop-import.
- The body of captureHandler.
- The pagination() cap.
- Whether exportUser includes auth-store users.
- Whether the Apple/Google verify checks `email_verified`.
