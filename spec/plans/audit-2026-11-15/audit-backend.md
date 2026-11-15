# Backend audit, main @ 128f42f8 (2026-11-15). Read-only. Labels: observed (path:line read) / inferred / not-found.
Paths are under C:\dev\secondhand\app\src\edge\ unless they start with app/src/app.
Working tree had uncommitted changes to databricks/sql/10_dashboard.sql and databricks/test_bundle.mjs only (not backend).

## A. Routes
Count: `git ls-files app/src/app/v1 | wc -l` = 76 files (observed); an earlier Glob listed 77 (inferred: a non-git/untracked file; the full list is in scratchpad\routes.txt, whose line numbers are not file lines).
Every route file wraps a handler from edge/api/*.ts with `route('METHOD /v1/path', fn, {auth?})` (api/http.ts:104-150); mode default 'user' (http.ts:106). health+api.ts and stage+api.ts are not wrapped in route().
Legend: ENG = engine-backed, scoped by ctx.user_id; EX = serves spec/examples JSON (api/captures.ts:73-98 exampleHandler; L78 refuses any user other than usr_8f2k unless visitor-auth: `throw new ApiError('not_found','no example data for this user','read')`).
Tests: each handler file has a sibling *.test.ts in edge/api/ (accounts, assist, auth, buy, captures, conversations, decisions, events, genie, http, insights, items, jobs, market, me, orders, records, routes, rules, runtime, scores, search, search-latency, sources, today, valuation-sold, valuations, wants). Test bodies not opened (not-found: no per-route coverage check). No test found for health+api or stage+api.

| Route(s) | Handler file | Reads/writes | Fixed/demo data |
|---|---|---|---|
| POST,GET /v1/accounts; DELETE /v1/accounts/:id; POST /:id/import; GET /:id/import-preview | api/accounts.ts | store `account` table; harness read_listings (accounts.ts:17-36, falls back to stored rows on no_route/policy_refused); import queues job (accounts.ts:9-15) | POST seeds from `accounts.connect.depop/ebay` example (accounts.ts:39-54); job id from example (accounts.ts:12) |
| GET /v1/appointments | api/orders.ts | example | EX |
| POST /v1/assist | api/assist.ts | none | `ports.intel.ask` returns empty; `llm` throws 'no stored writer answer' (assist.ts:9-12); reference only it_7c2m, want_3ss, cap_3n9q (L14) |
| POST auth/apple, google, email/start, email/verify, refresh, signout (auth 'none'); auth/link/apple, google, email | api/auth.ts | edge/auth.ts in-memory store | rate-limit Maps auth.ts:14 |
| POST /captures, POST/GET/PATCH /captures/:id, POST /:id/photos, /finish; POST /:id/talk | api/captures.ts | in-process captureRows Map (captures.ts:108); finish writes item to runtime.store | upload url `https://uploads.example/v/${id}?sig=example` (L361); /talk is exampleHandler (L421); photos `shortcut:` L339 depth_ref/pose_ref not stored |
| GET /citations/:id | api/scores.ts | geniePorts.proof.citation + citationOwners | else example citation (scores.ts:21-27,44) |
| POST /compare; GET /out (visitor) | api/buy.ts | none persistent | offers from `compare` example (buy.ts:10-16), title 'Carhartt Detroit Jacket J97' (L12), programme 'example' (L14), verdict keyed on `mt_77` (L16,19), clicks array in memory (L20-22) |
| GET /conversations; GET,POST /conversations/:id/messages | api/conversations.ts | store `conversation` scoped (L28-70), gate() check L41-49, ingests app.message event, 202+job | seeded usr_8f2k/acc_depop (L18-23,71); read_messages returns example (L75); draft/save_draft throw (L88-89); send_message throws 'no live message transport' (L90); answer_offer throws (L91); ask 9500 / floor 7000 (L84); GET list/messages are EX (L102-113) |
| GET /decisions; POST /decisions/:id/act | api/decisions.ts | store.decisions({user_id}) (L72-76); ingest event+job for kinds in ACTION_FOR (L85-89,91-123) | signing key random per process if DECISION_SIGNING_KEY unset (L21); versions Map L23 |
| GET /events; POST /events/:id/undo | api/events.ts | store.events({user_id}) (L17-43) | ENG |
| GET /experiments; POST /experiments/consent; GET /scores/:id/basis; GET /sites/:site/ranker | api/scores.ts | none | EX (scores.ts:43,45,46) |
| GET,POST /follows; DELETE,PATCH /follows/:id | api/market.ts | followRows Map (market.ts:10) | seeded for usr_8f2k |
| POST /genie | api/genie.ts | snapshots Map L18, citationOwners L44 | forUser returns null unless user === 'usr_8f2k' (L22), stubbed fetch host 'https://genie.memory'; no connection -> example, then ApiError 'waking' (L52) |
| PUT /goals/:month; GET /insights | api/insights.ts | none | "Synthetic aggregate snapshot from the contract" (insights.ts:11-14); read throws not_found unless usr_8f2k (L15); PUT is plain EX (L28) |
| GET /index/:id; GET /products/:id; /products/:id/history; /trends (visitor) | api/market.ts | none | plain exampleHandler (market.ts:19-22) |
| GET /items; GET,PATCH /items/:id; PATCH /items/:id/attributes/:name; POST /items/:id/listings, /sell, /strategy; GET /items/:id/plan-choices | api/items.ts | runtime.store scoped (items.ts:23,35); PATCH may emit app.reprice | GET /items = example overlaid with store rows (L54); attributes PATCH (L101) EX; /sell (L113) EX; /listings (L132) EX; plan-choices throws not_found unless id equals example choices.item_id (L52,133); /strategy ENG over limits (L114) |
| GET /jobs/:id; GET /jobs/:id/events (visitor); GET /stream | api/jobs.ts | job rows in shared store; in-process frame log | seeded example jobs (jobs.ts:167) |
| GET,PUT /limits; GET,POST /rules; DELETE /rules/:id | api/rules.ts | runtime.store scoped (rules.ts:18,30,36,57,91) | `if (ctx.body.from_decision_id === 'dec_lb1') template = structuredClone(example('rules.promote').response)` (L74) |
| POST /matches/:id/act; POST,GET /wants; GET,PATCH /wants/:id; GET /wants/:id/matches | api/wants.ts | store scoped by ctx.user_id (L39,79-80); Idempotency-Key on want row (L48-55) | seedWants for owner 'usr_8f2k' (L10,13-23); runWant (L93) has no non-test caller so matches come only from seeds |
| GET,PATCH,DELETE /me; POST /me/export; GET,PATCH /me/style | api/me.ts | auth store (getUser L33-36); insertJob (L37-47) | DELETE job is paused 'workspace_port_not_configured' because makeMeHandlers(...) at L156 passes no workspace (inferred from L43,156); push token kept raw in user row (L67 shortcut) |
| GET,POST /orders; POST /orders/labels, /orders/:id/ship, /handed-over; GET /orders/pick-list | api/orders.ts | orderBook seeded from `orders.list` example for usr_8f2k (orders.ts:9-10) | GET orders = example filtered by user; all POSTs and pick-list plain EX (L23-28); reference(match_id,['mt_77']) |
| GET /records | api/records.ts | none | EX; reference(tax_year,['2026']) |
| GET /routes | api/routes.ts | aggregates manifests of 23 modules (L3-25,30); `notBuilt = {}` L27 | |
| GET /scores | api/scores.ts | successScore engine | read throws not_found unless usr_8f2k and subject ls_e81; fixed as_of '2026-11-15T00:00:00Z', floor 7000 (L14-19,30) |
| POST /search (visitor) | api/search.ts | see E | |
| GET /sources/health | api/sources.ts | memoryStore params (L10); router seeded from example (ebay only) | only site=ebay and need=sold or none accepted (L19) |
| GET /today | api/today.ts | store scoped (L17-36); lastOpen Map L15 | headlinePort `{get: () => null}` L13; notices [] L29 |
| POST /valuations | api/valuations.ts | see F | |
| GET /health | health+api.ts -> databricks.ts health() | SQL statements call only if DATABRICKS_HOST and DATABRICKS_WAREHOUSE_ID set; else `{ok:false,state:'NOT_CONFIGURED'}` (databricks.ts:21) | 200 or 503 by h.ok |
| GET /stage | stage+api.ts | reads file `process.env.STAGE_ALERTS ?? '../logs/stage-alerts.json'`; `{"alerts":[]}` on ENOENT | |

## B. Runtime composition (api/runtime.ts, 344 lines)
- Composed at L311 `export const runtime = createRuntime(store);` with NO options: publicClients, apifyToken, ebayPageClient, adapters all undefined (observed). createRuntime other caller: api/items.ts:47 (test helper resetItems).
- publicClients: defined harness/public-client.ts:45; sessionClient: harness/session-client.ts:64. No non-test caller found (not-found, `git grep` over non-test files).
- Store: api/store.ts L1-7: `SECONDHAND_DATA_DIR` set -> `fileStore(join(dir,'store.json'))` (events/file-store.ts; rewrites whole file per write, file-store.ts:43), else `memoryStore()`. L2 `// shortcut: file-backed until the async Lakebase port lands.` No database store exists in code read.
- Vault: L73-74 `memoryVault()` ("session state is process-local until the Databricks secret-scope AuthVault joins").
- Accounts: L75-89; `byId(id)` without person_id returns undefined (L84); scopedAccounts uses personScope (L87); systemAccounts.byId is id-only (L89), used by the watcher (L227).
- SECONDHAND_LIVE_SITES: L90, L127; valuations.ts:19.
- Depop client L92-105: publicClients.depop, else offline client throwing 'offline Depop client cannot fetch' unless depop live (then plain fetch).
- eBay page client L106-114: publicClients.ebay; else if ebay live, options.ebayPageClient or plain fetch; else throws 'site session transport is not composed'.
- L115-117 shortcut: browser profiles and eBay credentials have no runtime transport.
- Adapters L118-126: depop, poshmark, mercari ({page: unavailable}), ebay (app_token undefined, user_token {ok:false}, send unavailable), ebayPage. Non-write adapters replaced by a stub returning `fail('no_route', '<site> live reads are unavailable')` unless depop/ebay live or publicClients given (L124). Write verbs keep real adapter; harness.call forces writes `dry:true` when site not live (L160-163).
- Mercari L127-143: Playwright CDP pool; env SECONDHAND_CHROME_PATH (L132); profile root `join(SECONDHAND_DATA_DIR ?? tmpdir(), 'secondhand-linked-browsers')` (L134); throws 'Mercari live reads are disabled' / 'Mercari needs SECONDHAND_CHROME_PATH for its linked browser'. liveMercari from env L127.
- `routed` L169-171: depop/ebay only if liveSites.has(site) or publicClients; mercari only if liveMercari; else false.
- Apify lane L172: `apify: options.apifyToken ? createApify(...) : undefined` -> undefined as composed (inferred, no token option passed). Apify env APIFY_TOKEN read only in harness/sites/apify/live.ts:11 (script). L310 comment: Apify never in the path an answer waits on.
- Databricks: databricks.ts:10-21 (DATABRICKS_HOST, DATABRICKS_WAREHOUSE_ID, DATABRICKS_TOKEN or `databricks auth token --host` via execFile); used only by health+api.ts. Not a data store.
- Genie: genie/genie.ts `genieFromEnv` L20, `genie()` L35; no non-test caller of genieFromEnv; api/genie.ts uses stub fetch for usr_8f2k only.
- Assist model: assist/converse.ts:43-48 `clientFromEnv` (OPENROUTER_API_KEY, model 'anthropic/claude-sonnet-5.5'); api/assist.ts passes a throwing llm. assist/tools.ts:10 imports createDupe. intel/jev.ts:28 and intel/extract-live.ts:13 read OPENROUTER_API_KEY (sameProduct `jevAsk` used in search.ts:185).
- Notify: notify/notify.ts:23 `createNotifier`; no non-test caller found.
- Scheduler/watcher/job runner: createWatcher at runtime.ts:227 (created, returned, not started); pipeline L264, `runtime.pipeline.runOnce(limit)` wrapper L301-305 (claimJobs(limit, worker, false)). `git grep` over non-test files for runOnce/tick/start/poll callers found only runtime.ts:304, watcher.ts:396 (internal), events/fixtures/week.ts:115,181 (fixture). So nothing starts them (inferred). Pipeline engine stubs: pAccept returns NaN (L249-250 shortcut), unlink returns {unlinked:true} (L270), site handle shortcut L254-255, claimJobs predicate shortcut L207.
- Env var names read in non-test edge code: SECONDHAND_LIVE_SITES, SECONDHAND_DATA_DIR (runtime.ts:134, store.ts:7), SECONDHAND_CHROME_PATH (runtime.ts:132), SECONDHAND_PLAYWRIGHT (browser/playwright.ts:15), SECONDHAND_PEER_HEADER (http.ts:47), DECISION_SIGNING_KEY (decisions.ts:21), STAGE_ALERTS (stage+api.ts), DATABRICKS_HOST/WAREHOUSE_ID/TOKEN (databricks.ts), OPENROUTER_API_KEY, BROWSER_USE_API_KEY (cloud-read.ts, live scripts), EBAY_CLIENT_ID/SECRET (ebay/live.ts script), APIFY_TOKEN (apify/live.ts script), BUILD_SHA, APPDATA, CLOUD_READ_DUMP; auth audiences via `process.env[name]` (edge/auth.ts:97). Values never read.

## C. In-process state (lost on restart unless noted); `git grep` sweep saved in scratchpad\c.txt
- edge/auth.ts:51-53 users, ids, sessions, codes, styles Maps: all accounts, sessions and codes lost. L249 `store = memoryStore()`.
- api/auth.ts:14 addresses/ips rate-limit Maps; L61 shortcut: lost on restart.
- api/http.ts:54 `idem` Map, :55 `visits` Map (idempotency + visitor rate limit; L53 shortcut). :43 `params = memoryStore()`.
- api/runtime.ts:73-74 memoryVault; :175-178 memoryLeases/memoryParams; :186-199 AccountSnapshots Map (persisted to watch_snapshot in the store); :145 services Map; :201 watcherKinds set.
- api/store.ts: memoryStore lost entirely; fileStore keeps store.json under SECONDHAND_DATA_DIR (survives restart).
- api/captures.ts:108 captureRows Map, :109 captureNumber, :110 exampleOpened.
- api/decisions.ts:23 versions Map; :21 signing key random per process (open decisions' signatures invalid after restart if env unset).
- api/genie.ts:18 snapshots, :44 citationOwners. api/market.ts:10 followRows. api/today.ts:15 lastOpen. api/conversations.ts:73 texts Map (+ memoryMessageStore L72). api/buy.ts:16 verdicts Map, clicks array.
- api/jobs.ts:18-22 claimedSeedIds, assistJobs, ended, log (SSE frames), ears; job rows themselves live in the Store.
- api/search.ts:21 pendingSearches, :23 reading Map. Search frames/jobs: in jobs (above).
- intel/public/search.ts:64-66 apifyPeople/apifyRuns (shortcut: Apify run caps reset on restart).
- events/ports.ts:133 claims, :280 held leases, :117 `let n` counter; events/schedule.ts:44-45 due/paused (restored from `saved`); events/watcher.ts:94-96 stale/posted/slugs.
- browser/pool.ts:37 accounts slots; browser/auth.ts:43-44 secrets and versions Maps (vault); browser/playwright.ts:22 shared browser; harness/public-client.ts:50-51; harness/health.ts:37-38; harness/service.ts:16 inflight; connect/signin.ts:20 sessions; connect/ebay.ts:20 access tokens ("in memory only"); harness/handoff/handoff.ts:22.
- setInterval (non-test): api/jobs.ts:145 SSE heartbeat; connect/signin.ts:101; events/ports.ts:302 lease renew; harness/handoff/handoff.ts:96; harness/session.ts:63.

## D. Harness per site (harness/sites/*). "route_kind" shown; lane = how composed runtime reaches it.
- depop (adapter.ts manifests L336-352): search (public, page), read_listings (public, endpoint), read_storefront (public, page), read_inbox/read_offers/read_orders/read_stats (signed_in, endpoint, version 0.1.0), plus PAGE_CONTROLS write verbs (signed_in, page, L352). Reachable from composed runtime: adapter composed (runtime.ts:19,118-126) but replaced by a no_route stub unless SECONDHAND_LIVE_SITES includes depop; write verbs dry-run unless live. Also imported by events/watcher.ts:6 (toWatchSnapshot) and events/fixtures/week.ts:11. Scripts: live.ts, recon.ts.
- poshmark (adapter.ts L343-360): search, read_listings, read_storefront (public, page); read_inbox/offers/orders/stats (signed_in, endpoint); PAGE_CONTROLS writes. Composed via poshmarkAdapters (runtime.ts:21) but stubbed no_route (not in the live set check at L124, only depop/ebay) ; search answers through intel/public/readers.ts:3 (public_page lane) with plain fetch, no harness. Scripts: live.ts (uses CDP browser), recon.ts.
- mercari (adapter.ts L335-351): search, read_listings, read_storefront (public, page); inbox/offers/orders/stats (signed_in, page); PAGE_CONTROLS writes. linked.ts exports linkedSearch (L5), readSearchPage; used by runtime.ts:7,127-143 (person-only, needs linked account, needs SECONDHAND_CHROME_PATH + live). Otherwise stub.
- ebay (adapter.ts L654-689): search (public), read_storefront (public), read_listings, read_offers, read_orders, read_inbox, read_stats (signed_in), WRITES verbs (L673), page variants search/read_storefront with route_kind 'page', per_minute 6 (L689). Reachable only if ebay in SECONDHAND_LIVE_SITES (runtime.ts:106-124); signed_in verbs need credentials not composed (app_token undefined, user_token {ok:false}). live-page.ts, live.ts, recon.ts are scripts.
- dupe (adapter.ts): createDupe at intel/public/search.ts:16 (module level, plain fetch default dupe/adapter.ts:120); reachable with no env as source 'dupe' (search.ts:113-121). Also assist/tools.ts:10. MIN_GAP_MS used in intel/public/sources.ts:3.
- apify (adapter.ts): lane ebay/facebook search only; other verbs return `fail('no_route', ...)` (L146-148); one run per actor at a time (L141-142). createApify called only in runtime.ts:172 when options.apifyToken given -> not composed. Types imported by intel/public/search.ts:14.
- Other harness: browser/cdp.ts, pool.ts, playwright.ts, cloud-read.ts, auth.ts (browser/); harness/ files protocol, service, health, primitives, session, session-client, public-client, handoff, recon, repair, release, reconcile, storefront etc. Only protocol/service/createHarness/createSiteService and the adapters are on the composed path (runtime.ts:145-150); session-client, public-client, handoff have no non-test caller found.

## E. POST /v1/search (api/search.ts, intel/public/*)
- Entry L237-256: validation L241-243; L245 rejects visitor id 'vis_example01'; L247 `caller: Caller = 'person'` (always, even visitor auth); `sources = sourcesFor(caller, ports.sources)`; L249 jobs.put({kind:'search', state:'running', stages}); L253 search() in background with .catch log; L255 returns 202 with stream `/v1/jobs/${job.id}/events`.
- search() L109-235: `Promise.all(sources.map(...))` (L212) = parallel. Deadline `opts.deadline_ms + startup - spent` (L172-173; startup search_browser_start_ms only for depop with a harness); cached result triggers second live read freshness 0 (L215-219); sameProduct via jevAsk (L185, needs OPENROUTER_API_KEY); L131 `product: null`. Stage states running/arrived/late/failed. Writes: in-process jobs/frames plus job rows in shared Store. No other Store writes observed.
- SOURCES (intel/public/sources.ts:41-48, all on:true): dupe (mcp), depop (harness), poshmark (public_page), mercari (harness, needs_ask), facebook (apify, person_only), ebay (harness). sourcesFor drops needs_ask/person_only rows unless caller 'person' (L50-51) -> person caller keeps all six.
- Availability gate intel/public/search.ts:42-62: noRoute -> outcome 'failed', error_code 'no_route', reason 'no live route composed'; 'needs_account' ("needs the person's account") if needs_ask (or sold on ebay) and no linked account. Routing L47-48: apify needs o.apify; harness needs o.harness && o.routed(site); public_page always. eBay may fall back to Apify only if caller person and o.apify (L101-105; search.ts:166).
- As composed with no env (inferred): dupe ANSWERS (plain fetch); poshmark ANSWERS (public page fetch); depop no_route; ebay no_route (no Apify fallback since apify undefined); facebook no_route (apify undefined); mercari needs_account unless linked account, and routed only if liveMercari (CHROME_PATH + live). Listed but cannot answer as composed: depop, ebay, facebook, (mercari unless live + linked).

## F. POST /v1/valuations (api/valuations.ts, 46 lines)
- ports.read (L12-25): null if ctx.body.url (L14); otherwise `example('items.get')` (L15) -> prices that fixed example item regardless of item_id/capture_id; the handler only checks reference(item_id,['it_7c2m']) and reference(capture_id,['cap_3n9q']).
- Engine: soldSources(soldSearch(...), ['mercari','poshmark'], {query: item.title.split(',')[0], condition:'good', ...}) (L18-20) then engines/valuation/check.ts `check({...input, log})` (L28-44); jobs.start/finish; error marks job failed.
- Hardcoded (L21-23): condition 'good', floor_cents 0, objective 'balanced', param_version 1, warm_comps [], sites [mercari, poshmark], fast {low, high, n, as_of from example valuation.range, basis 'family', state 'rough'}. url body returns seed body, job 'queued', no check (L42).
- soldSearch (api/valuation-sold.ts:5-13): returns `{rows:[], outcome:'blocked', reason:'live reads are disabled'}` unless site in live_sites (L7); live_sites from SECONDHAND_LIVE_SITES (valuations.ts:19). So with env unset sold comps are empty.

## G. Identity and isolation
- Token -> user: api/http.ts:125-128 Bearer -> deps.verify (default `async () => null`, L50); edge/auth.ts:238-241 verifyAccess(sha(token)) -> session kind 'access' unexpired -> user_id; wired at auth.ts:251 `deps.verify = auth.verifyAccess` (module import `import '@/edge/auth'` in each +api.ts). Mode user and no user_id -> unauthenticated (http.ts:128). Query user_id deleted (L117); body user_id stripped (L84). Sessions in memory (auth.ts:51-53); sendCode is a no-op logger (auth.ts:246-250).
- Visitor: id from X-Visitor-Id header if /^vis_[a-z0-9]{8,32}$/ else generated (http.ts:129-133); L132 shortcut: client can rotate it; limit visitorPerMinute 30 (L56).
- Lookups by id without person id: runtime.ts:89 systemAccounts.byId (watcher); browser/auth.ts:62 and :40 `byId(account_id)` (used browser/pool.ts:106,172 and connect/signin.ts:91); events/ports.ts:102,211 `getJob(id)` (callers: runtime.ts:219, accounts.ts:12, search.ts:146,215,221, events/pipeline.ts, outbox.ts, delist.ts:44, file-store.ts:63); api/jobs.ts:21 readJob (assistJobs.get(id) ?? st.getJob(id)) is unscoped but the public getter api/jobs.ts:67 filters through `owns(row, who)` (L25); `owns` lets any vis_* visitor read EXAMPLE_VISITOR's job (jobs.ts:24-25 shortcut); api/jobs.ts:28 `owner(id)` returns user_id of any job; api/decisions.ts:24 versionOf(id) by id only; auth.ts:57 getUser(id). Scoped: runtime.ts:84/87 (person required), store.get(table, user_id, id) (events/ports.ts:92), connect/signin.ts:27 owned(person,id).
- Genie, insights, scores, conversations, wants seeds all keyed to the literal 'usr_8f2k' (runtime.ts:30 EXAMPLE_USER).

## H. Empty or error-ignoring catches (non-test, harness/ and browser/); full catch list in scratchpad\h.txt
| path:line | what | reason comment? |
|---|---|---|
| browser/cdp.ts:33 | `browser.close().catch(() => undefined)` in cleanup before rethrow | no |
| browser/cdp.ts:45 | `...send('Browser.close')).catch(() => undefined)` | L44 comment explains why Browser.close is called, not why error ignored |
| browser/cdp.ts:46 | `browser.close().catch(() => undefined)` | no |
| browser/cdp.ts:94 | `catch { /* not written yet */ }` | yes |
| harness/session-client.ts:123 | `.catch(() => { responseFailed = true; })` | flag set, no comment |
| harness/session-client.ts:246 | `.catch(() => o.log.error('session.expire', new Error('expired browser stop failed')))` | logs generic error, drops cause |
| harness/session-client.ts:195, 249 | `catch { o.log.error(... generic Error) }` | drops cause; no comment |
| harness/session-client.ts:75, 110 | `catch { throw new Error(...) }` | no |
| harness/sites/ebay/adapter.ts:51 | `await res.json().catch(() => undefined)` | no |
| harness/sites/poshmark/live.ts:52 | `res?.text().catch(() => '')` | L51 comment is about the HTML source |
| harness/sites/apify/adapter.ts:84 | `catch { /* a non-JSON error body: th...` | yes |
| harness/sites/depop/adapter.ts:63 | `catch { /* not this one */ }` | yes |
| harness/sites/dupe/adapter.ts:61 | `catch { continue; /* a data line tha...` | yes |
| harness/sites/ebay/live.ts:22 | `catch { /* XML or empty stays a string */ }` | yes |
| harness/sites/mercari/live.ts:35 | `catch { /* not json */ }` | yes |
| harness/sites/mercari/adapter.ts:83 | `catch { return undefined; }` | no |
| harness/sites/poshmark/adapter.ts:55 | `catch { return; }` | no |
| harness/primitives.ts:46, 56 | `catch { return '[redacted]'; }` | no |
| harness/primitives.ts:66, 83 | `catch {` fallback branches | no |
| harness/handoff/handoff.ts:27, 71, 118 | `catch { throw/log generic }` | L72 comment explains vendor text is dropped |
| harness/public-client.ts:193 | `catch {` sets fallback 'evaluation' | yes (L194) |
| browser/pool.ts:186 | `catch {` evict slot, log generic | no |
Other catches in the list log the error (`log.error(..., e)`) or rethrow; see h.txt.

## I. Unfinished-marker counts (non-test files under app/src/edge/)
- TODO: 0. FIXME: 0. "stub": 0 matches for `\bstub` (observed; case-insensitive git grep). "not implemented": 0 in .ts (the one hit, browser/OPERATING.md:58, is the word "unpublished"; ignore). `shortcut:`: 40 lines incl. one README (harness/sites/poshmark/README.md:82), 39 in code/comments.
- Note: runtime.ts replaces adapters with a function returning no_route "live reads are unavailable" (runtime.ts:124) - a stub in behaviour though not named.
- Occurrences (path:line, quote shortened): api/captures.ts:339 "depth_ref and pose_ref are validated but not stored"; api/jobs.ts:24 "seeded example visitor job is open to any visitor"; api/me.ts:67 "token is kept as-is in the user row"; api/runtime.ts:73,115,207,249,254 (see B); api/store.ts:2 "file-backed until the async Lakebase port lands"; api/auth.ts:61 "process memory until the Store has auth_session; lost on restart"; api/decisions.ts:23 "DecisionRow has no version yet", :104 "an answer with no outward step writes no event row until stream 2 adds an answer kind"; api/http.ts:53 "process memory until the Store has http_idempotency", :132 "a visitor id is rotatable by the client"; api/today.ts:15 "per process; moves to user.last_open_at in Lakebase with db-1"; browser/playwright.ts:5 "no package.json entry yet ... add playwright to app devDependencies"; buy/buy.ts:28 "verdict compares delivered totals within 5%; M29's full verdict ... replaces it"; events/file-store.ts:43 "rewrites the whole file per write"; genie/genie.ts:29 "tables are the names after FROM/JOIN, not a parsed plan"; harness/session.ts:151 "hours are UTC"; depop/adapter.ts:141 first page of 24 only, :187 deleted listing unverified; ebay/adapter.ts:190 one category, :416 ended states not observed, :462 first 100 inventory items, :507 one row per order; mercari/adapter.ts:21 label mapping unconfirmed, :128 first page only, :176 deleted item not observed; poshmark/adapter.ts:58 only available/sold_out observed, :131 first page only, :171 deleted unverified; poshmark/live.ts:24 cdpUrl https vs ws/wss; harness/storefront.ts:33 nullable column; intel/extract-html.ts:4 no pseudo-classes; intel/fetch.ts:223 one browser per process at a time; intel/public/search.ts:64 Apify counts in memory; intel/swarm.ts:82 tax on price+shipping everywhere; intel/public/sources.ts:32 "Agent proposal: Central-time demo prior".

## Not found
- Any non-test caller of publicClients(), sessionClient(), createNotifier, genieFromEnv, runWant, runtime.pipeline.runOnce, watcher.tick; any scheduler starting the watcher or pipeline (grep over non-test files, edge/).
- A database-backed Store (only memoryStore and fileStore seen).
- Test coverage for health+api and stage+api; per-route test contents were not opened.
- Whether Expo's runtime loads edge/auth via the per-route `import '@/edge/auth'` at server start order (inferred from the imports only).
- Per-verb "lane" field in manifests: manifests carry session and route_kind, not a lane; lane exists only on SOURCES rows.
- 76 vs 77 route-file count discrepancy not resolved.

## Sources fetched
All local, read-only: edge/api/{runtime,http,search,valuations,valuation-sold,captures,accounts,assist,auth,buy,conversations,decisions,events,genie,insights,items,jobs,market,me,orders,records,routes,rules,scores,sources,store,today,wants,examples}.ts; edge/auth.ts; edge/databricks.ts; edge/gate/gate.ts; edge/browser/auth.ts; edge/intel/public/{search,sources}.ts; harness adapter files via git grep; app/src/app/v1/** (Glob, git ls-files); git grep sweeps (saved in scratchpad c.txt, h.txt, i.txt). Not opened: .agents/team/packets/, spec/plans/.
