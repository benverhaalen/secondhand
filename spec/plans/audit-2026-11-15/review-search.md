# Review: how the server finds listings, signed out (main, app/src/edge)

Scope: code as it stands, read-only. Read in full or in the relevant ranges: api/search.ts, api/runtime.ts, api/jobs.ts, api/store.ts, intel/run.ts, intel/public/{search,sources,readers}.ts, intel/protocols.ts (listings_matching), harness/public-client.ts, browser/cdp.ts, harness/sites/ebay/adapter.ts (L574-738), depop adapter (search path). NOT read in depth: harness/session-client.ts, the link flow, intel/{reconcile,swarm,answer}.ts, most adapters, browser/pool.ts, apify/dupe adapters beyond their rights fields. No test was run, no server started, no marketplace called.
All paths below are under C:\dev\secondhand\app\src\edge\.

## 1. Bugs and ruling breaches, ranked by consequence

### 1.1 Composition gap: depop and ebay can never answer on the server as composed
Evidence: api/runtime.ts L311 `export const runtime = createRuntime(store);` passes no options. `publicClients(` has no caller outside its definition (harness/public-client.ts L45) and its test (public-client.test.ts L113). With no options:
- L124-126 replaces every depop/ebay read with `fail('no_route', ... live reads are unavailable)` unless `SECONDHAND_LIVE_SITES` lists the site or `options.publicClients` is set.
- L169-171 `routed` returns false for depop and ebay, so `sourceUnavailable` (intel/public/search.ts L55) answers `no_route` "no live route composed". This is exactly the lead's 11:42 observation.
- Facebook: L172 `apify: options.apifyToken ? createApify(...) : undefined`, and no code passes `apifyToken` (APIFY_TOKEN is read only in apify/live.ts).
- Mercari: `routed` is true only with `SECONDHAND_LIVE_SITES=mercari` (L127, L171).

What createRuntime must be given, per source, signed out:
| Source | Needs | Env names |
|---|---|---|
| Poshmark | nothing (public_page lane) | none |
| Dupe | nothing (mcp lane) | none |
| Depop | `options.publicClients.depop` (browser page client) | a launcher: `BROWSER_USE_API_KEY` (cloud) or `SECONDHAND_CHROME` / local Chrome path (cdp.ts L144-147) |
| eBay | `options.publicClients.ebay` | same launcher |
| Mercari | no signed-out lane at all (`needs_ask: true`, linked browser only) | `SECONDHAND_LIVE_SITES=mercari`, `SECONDHAND_CHROME_PATH` (runtime.ts L132) plus a linked account |
| Facebook | `apifyToken` | `APIFY_TOKEN` (conflicts with ruling, see 1.3) |

Smallest fix: `createRuntime(store, log, { publicClients: publicClients({ launcher: cdpLauncher(pw, sourceFromEnv(process.env, scratch)), log }) })`, and call `runtime.close()` on shutdown (L174 already supports it). Cheaper stopgap: `SECONDHAND_LIVE_SITES=depop,ebay` flips `routed` to true with the plain-`fetch` clients at L92-114, but a bare fetch of eBay will meet a bot wall, and the Depop JSON client targets webapi.depop.com (see 1.9).
Related: two env names for one idea, `SECONDHAND_CHROME` (browser/cdp.ts L146) vs `SECONDHAND_CHROME_PATH` (api/runtime.ts L132). Set one and the other path stays dark.

### 1.2 Mercari reports `no_route` to a visitor instead of `needs_account`
Evidence: intel/public/search.ts L55 `!sourceRouted` -> `no_route` comes before L56-61 `needs_ask` -> `needs_account`. api/search.ts L249 hard-codes `caller = 'person'`, so `sourcesFor` lets `needs_ask`/`person_only` sources through for a visitor.
Scenario: a signed-out visitor sees "no live route composed" for Mercari, which reads as a server fault, when the true state is "link an account".
Fix: test `needs_ask` before the route check, or hide the source from visitors.

### 1.3 Apify is in the path an answer waits on, and `may_model:false` rows reach the model (founder ruling)
Evidence: api/search.ts L249 `const caller: Caller = 'person', sources = sourcesFor(caller, ports.sources);` (a visitor is treated as a person). Consequences:
- Facebook (`person_only`, lane apify) runs for visitors, inside the per-source route deadline.
- L168 `const fallback = unavailable?.searched.error_code === 'no_route' && site === 'ebay' && caller === 'person' && opts.apify;` plus intel/public/search.ts L101-105 runs `readApify` as an eBay fallback inside the same wait. runtime.ts L310 says Apify is "composed again only as a background fill"; search.ts does not honour that.
- `candidates()` (L57-62) hands every row, Apify included, to `sameProduct` (L187) with no `may_model` check, against the rule "its rows are `may_model: false`".
- The spend cap is process memory (`apifyDay`, `apifyRuns`, `apifyPeople` in intel/public/search.ts L67-93; prior `search_apify_runs_per_day` 200, about $10/day, comment "a visitor id can be rotated"). A restart resets it, and a rotated visitor id gets a fresh per-person allowance. (A $5 cap mentioned elsewhere: I did not verify it.)
Fix: `caller = ctx.user_id ? 'person' : 'background'` so visitors never get person_only sources; move Apify to a post-settle background fill; drop `may_model === false` rows from `candidates()`.
Today this is dormant because no token is composed (1.1). Wiring `apifyToken` without this fix breaks the ruling on day one.

### 1.4 Dupe and Apify rows are stored in the shared Store (rulings: Dupe rows never stored; keep_until)
Evidence: api/search.ts L156, L224, L228 `jobs.update(job.id, { result })` with the full ranked offers. api/store.ts L7: with `SECONDHAND_DATA_DIR` set the Store is a `store.json` file. api/jobs.ts L88-98 `prune` deletes only in-memory frames and the `assistJobs` map; it never deletes the Store row. Dupe README L20: "A caller may show the rows, but should not keep them past keep_until."
Scenario: a visitor searches; rows carrying `commercial_link` and `keep_until` (Dupe) and `via:'apify'` (Apify, `may_model:false`, `use_scope:hackathon_demo`) sit in store.json indefinitely and are served again by GET /v1/jobs/:id.
Fix: strip rows with `commercial_link` or `via === 'apify'` from the persisted `result` (keep counts), or delete the job row when `prune` expires it, or hold the result in memory only for those rows.

### 1.5 `settled` can stall far past `settled_ms` when a source is queued
Evidence: intel/run.ts L171 the settle timer starts only after every target has started; the per-target deadline (L129) also starts when the slot starts, not when queued. `atPace` (L47-63) queues each `site|lane`; eBay prior is 6/min with a 10 s gap (sources.ts), and public-client.ts serializes reads per site in one lane.
Scenario: two visitors search within 10 s. The second visitor's eBay target waits for the pace gap and for the first visitor's read, so its settle timer has not even started. The protocol budget (`listings_matching` first_ms 3000, settled_ms 10000) is not enforced end to end.
Fix: arm the settle timer from the start of `runPlan`, not after the last target starts; count queue time in each target's deadline.

### 1.6 Late reads are never cancelled, so a timed-out eBay read keeps its lane
Evidence: intel/run.ts L76 `const shared = new AbortController();` is never aborted. public-client.ts: one slot per site, reads chained on `lane.tail`, and the 30 s `timeoutMs` timer (L107) includes queue time.
Scenario: a hedge or deadline fires, the answer moves on, but the browser read continues; the next visitor's eBay read waits behind it and can time out having never run.
Fix: abort `shared` (or a per-target controller) at deadline and settle, and pass the signal into the page read.

### 1.7 Every visitor costs a browser read: the scoped route defeats single-flight
Evidence: api/search.ts L170 `scopedRoute` is per-user for harness and apify lanes; L180 `cache: source.lane !== 'mcp' && source.lane !== 'apify' && !(site === 'ebay' && opts.apify)`. intel/run.ts `callRoute` (L67-93) single-flights and caches `hit`/`empty` only by route key.
Scenario: ten visitors typing "levi 501" get ten eBay page reads, serialized at 10 s apart. The signed-out eBay read has no per-person data, so the scope is pure cost.
Fix: use the unscoped route for `session: 'public'` adapters (eBay search page, Depop search page).

### 1.8 One throw fails the whole job; late arrivals dropped silently
Evidence: api/search.ts L213-222 `Promise.all` over sources where `sourceUnavailable` and `runPlan` sit outside the per-source catch (L190-196); the outer catch (L229-235) marks the whole job failed. `land()` returns silently at L148 when the job is no longer running, with no log line.
Scenario: a throw from one source's plan fails an answer that Poshmark and Dupe had already filled; a source that answers after settle disappears with no trace for the audit.
Fix: move the per-source try/catch to wrap the whole per-source body; log in `land()` when it discards.

### 1.9 Counts are not fully honest
- `unavailable_or_duplicate` (api/search.ts L87) merges sold, out-of-stock and duplicates; L128-129 re-adds `duplicates` on top. A reader of the page cannot tell which.
- `results_found` excludes `unreadable_card` drops (L66, L68), so "found" is not what the site returned.
- Non-USD rows (api/search.ts L37-49): appended after all USD rows regardless of price or match, unsorted, `delivered_cents: o.price_cents` with `shipping_estimated: true`. The `max_delivered_cents` cap (L89) applies only to `inDollars` rows, so a cap filter does not apply to them.
- Regional dedupe key is `site:listing_id` only, so Dupe's copy of a Poshmark/eBay item and the native row are not recognised as the same in the non-USD list.
Fix: separate drop reasons in the result (`sold`, `out_of_stock`, `duplicate`, `unreadable`), sort the regional list, apply the cap to converted-estimate rows or say it does not.

### 1.10 Empty or unusable query is accepted
Evidence: L243-244 accept any of `photo_id`, `like`, `assist_job_id` as sufficient input, but L112 reads only `text ?? url`, so the query is `''`. Depop `search` then answers `missing_input` ("search needs q", depop adapter L107) and Poshmark/Dupe get an empty string.
Fix: refuse at the boundary when `text` and `url` are both missing, or resolve the photo/like input before planning.

### 1.11 Depop JSON path reaches a private app endpoint if the live flag is used (ruling: no private app endpoints)
Evidence: api/runtime.ts L100-103 `fetch(API + path, ...)` with `API = 'https://webapi.depop.com'` (depop adapter L16, `/presentation/api/v1`); depop adapter L127 and L189 call `c.json(...)`. The search verb itself is a page read (`c.doc(url)` of `www/search/?q=`, L110-111), so search is clean; the item-by-slug and listings-read paths are not. Setting `SECONDHAND_LIVE_SITES=depop` as the quick fix in 1.1 would activate them. I did not trace whether the search flow ever calls those verbs; confirm before enabling.

### 1.12 `ms.first` stays null with no rows; no global cut
Evidence: api/search.ts L155 sets `ms.first` only when a source lands rows; L178 passes `settled_ms: remaining` per source. With every source empty or failed the result has no `first` and nothing above the per-source deadline caps the whole search.

### 1.13 Swallowed errors with no log (the repo gate's list, spot-verified)
browser/cdp.ts L33, L45, L46 (cleanup catches) and L94 (comment-marked "not written yet" retry). harness/public-client.ts L193 records `metrics.fallback = 'evaluation'` (a partial trace, not a log). The rest of the gate's harness/sites findings I did not individually verify.

### 1.14 Pace lease released at start, not end
Evidence: intel/run.ts L61 `if (lane !== 'mcp') release();` before the call, `state.last` set at start (L47-63). The gap is start to start; a slow read overlaps the next. For eBay the public-client lane masks this, for Poshmark the 3 s gap does not.

## 2. Speed: where an eBay read's seconds go
Path (harness/public-client.ts, harness/sites/ebay/adapter.ts): slot checkout (cold: cloud browser create or local Chrome + `connectOverCDP`, bounded at 30 s, cdp.ts L29) -> `goto` domcontentloaded of a `_ipg=240` page (about 4 MB) -> `waitForSelector` cards (1500 ms) -> state `evaluate` -> parse `evaluate` over 240 cards -> shape check -> if the shape fails, `server()` fallback (`page.content()` plus a node-side regex parse). On an "Error Page" the second host (ebay.co.uk) is tried after `HOST_PAUSE_MS = 5000` plus a second load.
Changes that get toward the page's own 2.5 s, none involving request interception (ruling):
1. Prewarm the eBay slot at boot and keep it warm (idle retire is 120 s; the first visitor otherwise pays the whole cold start).
2. Ask for fewer rows for the first answer (`_ipg` near 60) and fetch the full 240 in the background; page weight and the parse scale with rows.
3. Merge the state and parse evaluates into one round trip.
4. Share one read across visitors (1.7), so only the first search pays.
5. Treat the 5 s second-host pause as a background retry, not part of the first answer.
I measured nothing live (not allowed); the split above is from the code path, so rank 1 and 2 by first measuring with the existing timing metrics in public-client.ts.

## 3. What a signed-in person gains that code already supports, versus scaffold
Supported by code:
- Mercari linked search: runtime.ts L127-143, behind `SECONDHAND_LIVE_SITES=mercari`, `SECONDHAND_CHROME_PATH` and a linked account, via the pool with per-person scope.
- eBay sold search: the page route rejects sold without `c.signed_in` (adapter `searchPage`), so signed-in is the only way to get it; Depop sold is "not public" (depop adapter L109) with a handoff url.
- Facebook: reachable for a person only through Apify (no signed-in session involved).
Scaffold only: eBay API adapters need a keyset (no env composed; `app_token: async () => undefined`, runtime.ts L122), eBay and other marketplace writes are dry plans (L160-163 forces `dry: true` unless the site is live), `harness/session-client.ts` and the link flow I did not review, so I cannot say a signed-in session is wired end to end. Ruling check: `scopedAccounts` and the per-person `personScope` keep a person's session off shared routes, but 1.4 is the way a signed-in result could reach the shared Store; confirm `result` for signed-in jobs is not stored beyond the owner's job row.

## 4. Solid; leave alone
- `callRoute` single-flight and cache of only `hit`/`empty` (a failure is never cached).
- `judge`/`CHALLENGE` back-off with `pause_session`, with no bypass built in.
- The `isListingResult` shape check with server-side parse fallback; `searchRows`/`cardParts`.
- `publicClients` per-site lane serialization and idle retire.
- `sourcesFor` gating and `sourceUnavailable` reasons (apart from 1.2 ordering).
- `readApify` reserves the run before the outside call.
- `sitePlan` per-source catch with `ctx.log.error`.
- eBay writes as dry plans; Dupe `keep_until` and `attribution` on each row.
