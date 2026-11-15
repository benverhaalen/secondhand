# The build board

Status: the one place progress is tracked for the cloud build. *Agent proposal* until Nate accepts it. What each stream is: [workstreams.md](workstreams.md). What can start this minute: [start-now.md](start-now.md). The global spec: [spec/README.md](../README.md) and the repo [README](../../README.md). How every feature joins every other one, and which joins are real, example or missing: [joins.md](joins.md).

## How to use it

- A box is ticked only by the orchestrator, only when the item's proving command exits 0 on `main` and a seat that did not write it has reviewed it. The tick line gains the commit: `- [x] ... (abc1234)`.
- The lead assigns owned files to workers in separate worktrees, reruns their task checks and commits their files after review. Workers run one test file at a time; the lead runs the full check before pushing.
- A blocked item gets `BLOCKED:` and the question, and the question goes to Nate the same minute.
- New work found while building is added here as a new box under its stream before it is started. Nothing is built that is not on this board.
- At each checkpoint the orchestrator posts the counts to Nate: done, building, not started, blocked, per stream.

## Milestones (the order of the build since 23:00 Central, 2026-11-14)

Set by [Nate](../../product/words.md#2026-11-14-nate-browser-use-on-cloud-tested-the-way-production-runs-with-milestones-that-are-finalised-as-they-are-hit) after two crashes: one thing at a time, each proved on Browser Use Cloud the way production runs it, and finalised before the next starts. A milestone is ticked only when its real run is recorded under `research/cross-cutting/nate/runs/` and a seat that did not write it has reviewed it. The stream boxes below are the detail; this list is the order. *Agent proposal* for the list itself.

- [ ] M1 a cloud browser session: created, reached over CDP, one public Depop search read with no model in the loop, count and timing recorded, the browser stopped.
- [ ] M2 stored sign-in: one account's storage state saved behind `account.token_ref`, loaded into a new cloud browser, shown to survive a restart
- [ ] M3 linked accounts only: a planted unlinked site gives zero launches and zero jobs
- [ ] M4 platform profiles as data, and the endpoint list with its docs generated from the manifests (`/write-listing` is `post`)
- [ ] M5 Depop, every public read verb live on cloud; every write verb dry; `read_storefront`
- [ ] M6 one real account linked by Nate in the hosted browser: signed-in reads, a `storefront_snapshot` stored
- [ ] M7 write a listing: dry, then live on Nate's go, read back, then delisted
- [ ] M8 Poshmark, Mercari, eBay, Facebook Marketplace, one at a time through M5 to M7
- [ ] M9 the walk end to end on real pieces, the `/v1` routes answering from engines, deployed

## 0 Orchestrator

One orchestrator, Codex workers on the Mac in their own worktrees, Claude builders and reviewers beside it ([Nate](../../product/words.md#2026-11-15-nate-the-mac-as-extra-compute-claude-driving-here-and-codex-there-and-no-more-crashes); [packet 49](../../.agents/team/packets/team/49-handoff-to-the-mac-session.md)). Streams are ownership groups, not concurrent sessions.

- [ ] T0-2 contract examples for every `/v1` endpoint: `node --test spec/examples.test.mjs`
- [ ] T0-3 real items with known answers and the scorer: `node --test spec/items.test.mjs`
- [ ] S-1 Python scaffold: `python -m pytest jobs -q`
- [ ] S-2 shared fixtures: `python -m pytest jobs/fixtures -q`
- [ ] S-3 failure reporter: `node --test scripts/prove.test.mjs`
- [ ] S-4 the end-to-end walk on fixtures: `node scripts/walk.mjs`
- [ ] the four intelligence log events added to `spec/events.json` and `log/example.mjs` together: `node --test spec/log.test.mjs`
- [ ] every new name a stream asks for is in `spec/product.md` before its code merges

## 1 Platform kernel


- [ ] interface first: `harness.call(site, verb, args)`, the envelope, error codes, hints, with a fake site behind it
- [ ] sessions: lease, pace, keep-alive, `needs_session` per verb and field
- [ ] primitives with network redaction and the forbidden-control filter
- [ ] release gate: fixture test, field gate, canary, rollback
- [ ] repair loop with the ten-mutation drill
- [ ] route health and order as `param` rows
- [ ] Browser Use Cloud pool behind `Launcher`, one browser per account lease; timeout on create, stop on every path, no proxy rotation
- [ ] cookie-carrying request runner (no browser)
- [ ] stored session behind `account.token_ref`, loaded at lease start and saved after success; no credentials in logs
- [ ] person-driven cloud live-view sign-in; challenge and login wall pause; later phone transport behind the same port
- [ ] all of it: `node --test app/src/edge/harness/`

## 2 Events and pipeline


- [ ] interface first: the `event` row and the snapshot shape, with a fake source
- [ ] event intake with dedupe and one job per event
- [ ] the outbox on every `/v1` write
- [ ] snapshot differ: two snapshots in, events out
- [ ] webhook receiver with signature check (eBay), as a trigger only
- [ ] watcher scheduling by tier, cadence as `param` rows
- [ ] the live-channel listener for hot windows
- [ ] `account_stale`: jobs pause and resume, none dropped
- [ ] the policy check in code on every job (`auto`, `ask`, `never`)
- [ ] all of it: `node --test app/src/edge/events/`

## 3 to 7 Platform teams

Build one site at a time through M5 to M7, starting with Depop. Route and cost rules live in [protocol §§3.5 to 3.8](../engines/protocol-and-adapters.md#35-starting-routes-site-by-verb).

One block per site. Recon its own data calls before page driving; use official APIs where offered ([Nate](../../product/words.md#2026-11-15-nate-official-apis-where-they-exist-the-browser-design-as-specced-ranking-systems-accounted-for-databricks-perfected)). Every write stays dry until Nate's go per site, then acts once and reads back; never replay. Account work launches and schedules only linked sites. Boxes remain unticked. Public measurements: [M1](../../research/cross-cutting/nate/runs/m1.md).

### 3 eBay
- [ ] operating design: developer APIs with OAuth; browser only for capabilities not offered by the API
- [ ] link by OAuth, refresh tokens; cloud profile only where a browser is needed
- [ ] public: Browse API for active search after the signed-out browser returned 403; prove sold, listing, shop, reviews and status routes separately
- [ ] listings: create with every field, edit, reprice, relist, delist, mark sold, read all with counts
- [ ] offers: read, accept, decline, counter, send to watchers, auto-offer settings
- [ ] messages and notifications: read inbox and feed, send, mark read
- [ ] orders, with the accepted Best Offer amount
- [ ] stats per listing, normalised by stage
- [ ] `read_storefront` and the watch snapshot, linked accounts only
- [ ] push against watcher measured; push kept as a trigger only if faster
- [ ] fixtures, mutation drill, pace bench: `node --test app/src/edge/harness/sites/ebay/`

### 4 Facebook Marketplace
- [ ] operating design written
- [ ] link once through the cloud live view; store auth per account, pause on expiry
- [ ] public: measure plain request, then anonymous cloud browser; search, listing, profile and still-up routes need live proof
- [ ] listings: create, edit, reprice, relist, delist, mark sold, read all with counts
- [ ] messages and notifications: read, send, mark read; cash at pickup is not an off-site signal
- [ ] stats: views, clicks, threads, saves, shares
- [ ] `read_storefront` and the watch snapshot, linked accounts only
- [ ] fixtures, mutation drill, pace bench: `node --test app/src/edge/harness/sites/facebook/`

### 5 Depop
- [ ] operating design from cloud recon: in-page data calls and Next flight; sold status public per listing and shop, no public sold search
- [ ] link once through the cloud live view; store auth per account, pause on expiry (no partner access)
- [ ] public: search, listing, shop listings, reviews, still-up and `read_storefront`; live runs recorded in [ad-depop](../../research/cross-cutting/nate/runs/ad-depop.md), signed-in verbs still need live recon
- [ ] listings: create, edit, reprice, relist, delist, mark sold, read all with counts
- [ ] offers: read, respond, send to likers, auto-respond set to always-accept and never the floor; offers last 24 h
- [ ] messages and notifications: read, send, mark read
- [ ] orders and stats
- [ ] `read_storefront` and the watch snapshot, linked accounts only
- [ ] fixtures, mutation drill, pace bench: `node --test app/src/edge/harness/sites/depop/`

### 6 Poshmark
- [ ] operating design written
- [ ] link once through the cloud live view; store auth per account, pause on expiry
- [ ] public: cloud search read 48 rows without login ([M1](../../research/cross-cutting/nate/runs/m1.md)); prove sold, listing, closet and availability reads
- [ ] listings: create, edit, reprice, relist, delist, mark sold, read all with counts
- [ ] offers: read, respond, offer to likers (10% rule), site auto-offer settings
- [ ] comments, messages and notifications: read, send
- [ ] orders and stats
- [ ] `read_storefront` and the watch snapshot, linked accounts only
- [ ] fixtures, mutation drill, pace bench: `node --test app/src/edge/harness/sites/poshmark/`

### 7 Mercari
- [ ] operating design written
- [ ] link once through the cloud live view; store auth per account, pause on expiry
- [ ] public: cloud search read 30 rows on rerun ([M1](../../research/cross-cutting/nate/runs/m1.md)); prove sold, listing, seller and sold-out reads; headed profile for local recon
- [ ] listings: create, edit, reprice, relist, delist, mark sold, read all with counts
- [ ] offers: read, respond, offer to likers, Promote
- [ ] messages and notifications: read, send
- [ ] orders and stats (views are impressions)
- [ ] `read_storefront` and the watch snapshot, linked accounts only
- [ ] fixtures, mutation drill, pace bench: `node --test app/src/edge/harness/sites/mercari/`

## 10 Swarm intelligence


- [ ] interface first: the `answer` object and the question kinds, with a fake behind it
- [ ] question protocols as data: per kind, every target and its deadline
- [ ] the parallel source runner: all targets at once, first answer from the fastest
- [ ] fetch and render (the Firecrawl and crawl4ai patterns)
- [ ] extraction to schema, with a fast decision model for typed choices and a language model only for text
- [ ] driving a page where a read needs it (the browser-use pattern)
- [ ] the gather request: a thin basis widens the search in six steps before anything is hidden
- [ ] the listing swarm: identity, sold history, each site's winners, title and field terms, photo rules, fees, demand, risk
- [ ] the buying engine: five marketplaces, official brand and retailer stores, Amazon; availability, variant, delivered price, delivery time
- [ ] product reviews and seller reviews, each with sources
- [ ] credible discounts with their end dates
- [ ] a person's own analytics answered from our tables first
- [ ] learning: source order, deadlines and extractors from what reaches the final answer
- [ ] the public search API and its MCP tools
- [ ] proof per [intelligence-api](../engines/intelligence-api.md) sections 9 and 10

## 11 Scoring: money


- [ ] valuation 1: comps arithmetic
- [ ] valuation 2: keep in cents, and the path
- [ ] valuation 3: the backtest harness with the leakage fixtures
- [ ] valuation 4: the fast band, kept warm on sale events
- [ ] valuation 5: nightly fits and the switch rule
- [ ] valuation 6: the valuation object inside the 10 s budget
- [ ] new signals in: each site's top listings, official listings, credible discounts
- [ ] the price slider: ask per site, keep, chance of sale and days at any point; opens at the middle; sold prices on its track; floor never crossed
- [ ] negotiation 1 to 5: limits and argmax, `offer_outcome`, the fit, the scripted-buyer harness, champion and challenger; reads the slider and Ben's levers data
- [ ] marketing engine: the site plan objective, the bandit with consent, markdown rules per site
- [ ] the success score: `U_now / U_best`, four bands as `param` rows, the best next change with its points, the storefront roll-up
- [ ] proof: higher bands sell more often on the fixed set
- [ ] all of it: `node --test app/src/engines/` and `python -m pytest jobs/valuation jobs/negotiation`

Engines lead's record, 2026-11-15. Nothing here is ticked until a fresh reviewer has read the diff.
- Audit: [spec/engines/audit.md](../engines/audit.md) holds 384 defects across 13 engines, against 8 rules (deterministic, whole cents, no hard-coded tunable, guarded and cited, twins agree, real time, one name and unit, edges). Fix workers per engine; this list grows as each merges.
- Valuation accuracy on released data, `dataset:stockx_2019` (new deadstock sneakers, sales of 2019-01-01 to 2019-02-13), the served engine `engine_comps`: 16,193 sales, 99.9% priced, median error 5.6%, within 20% 93.8%, median range width 15.5%, coverage of q10 to q90 62.2% (Wilson 61.4 to 62.9) against 80%. Open fault: the raw range is too narrow; the conformal step needs its calibration window (in flight). Command: `python3 scripts/bench/backtest.py backtest --rows <stockx csv> --test-from 2019-01-01 --contestants engine_comps,engine_comps_conformal --cells C` on fe4e2bf. Not comparable with the product-anchored model's 98% (a different contestant and window); both go into one run on the same items.
- Twins proved equal on shared fixtures: comps D1 to D5, 18 cases (`node --test app/src/engines/valuation/comps.parity.test.ts`, `pytest jobs/valuation/test_comps_parity.py`); the param registry, 17 cases (`node --test app/src/engines/param/parity.test.ts`, `pytest jobs/param`); the trust sigmoid, Platt and isotonic (`calibration.parity.test.ts`, `jobs/trust/test_calibration_parity.py`).
- Real time: both param stores forget at one 30-day half-life, computed from timestamps when the caller passes none (before: the Lakebase store used a 21-day half-life, and person and trust weights never forgot). Command: `node --test app/src/engines/param/sql.test.ts`.
- Defects found and closed: the claim check passed a negated claim as backed ("not wool, real cashmere" against wool). Fixed in 2889bab8: 20 drafts, 10 planted false claims all held, 10 clean all passed (`node --test app/src/edge/gate/claims.test.ts`). Limit: a false value outside fields-by-kind's lists is held as unbacked, not labelled contradicted. Trust mixed cents and dollars in its loss (100 times wrong), closed in 610edcec. Two citations of different metrics shared an id, closed in 764e1b1. Champion offers were accepted under a firm posture, closed in 1d59b81. Rollback undid one observation instead of restoring the fitted champion: found in review, fix in flight.

## 12 Scoring: knowledge


- [ ] identity id-1 to id-6
- [ ] demand and trend dt-1 to dt-6
- [ ] platform analytics pa-1 to pa-7, reading Ben's levers data
- [ ] recommendation and style rs-1 to rs-6
- [ ] trust 1 to 6
- [ ] learning the person: `param` rows scoped to the person, visible and resettable, never leaking to another person
- [ ] all of it: `python -m pytest jobs` and `node --test app/src/engines/trust/`

## 13 Databricks

Design and what is proved: [databricks-build.md](../databricks-build.md#9-what-is-proved). Every number below was read on Nate's workspace (`--profile Nate`) on 2026-11-15. Boxes stay unticked until a fresh reviewer has read the diffs.

- [ ] T0-1 workspace checks on the event workspace; browsers use Browser Use Cloud
- [ ] interface first: the `param`, `observation`, `evidence`, `citation` shapes with an in-memory fake
- [ ] Lakebase tables and migrations for the canon
- [ ] the `param` registry: versions, promote on a backtest win, rollback
- [ ] per-event updates in the transaction that records the outcome
- [ ] nightly refits as jobs, champion and challenger: deployed as `secondhand-nightly-fits`, at most 4 tasks at once (Free Edition allows 5); its first run waits on the `--root` fix (serverless runs a task file with no `__file__`)
- [ ] the proof layer: guarded numbers, `claim_check`, `rights` tags. Python twin of proof.ts: 20 of 20 parity cases equal (`python -m pytest databricks/parity/test_parity.py`). Isolation by the catalog ABAC policy `sh_owner_only`: 7 of the example loader's 14 guarded numbers visible to Nate, all `usr_nate` (`SELECT user_id, count(*) FROM secondhand.core.guarded_number GROUP BY 1`). Handles masked by `sh_mask_handle` (`m***`). Policy sweep over `check()`: 480 answers, all 32 never-performed answers refused (`node databricks/policy-sweep.mjs`)
- [ ] the market layer: pipeline `secondhand-market` holds 1,688,603 comps from 6 public sold sets (bronze 1,688,864; 261 dropped by expectations), 1,581,374 cleared for modelling (StockX and Mercari Kaggle), update f5f78337 (`SELECT source, count(*) FROM secondhand.market.comp GROUP BY source`)
- [ ] the secret scope for sessions and saved passwords: bound to the bundle (`databricks bundle deployment bind vault secondhand --target dev --profile Nate`)
- [ ] jobs for watchers, gathers and refits, with their triggers
- [ ] deployed on the event workspace; the edge reaches it. On Nate's workspace: bundle deployed, target dev; setup job SUCCESS (`node deploy/deploy.mjs deploy --target dev --profile Nate`)

## 14 Capture and photo


- [ ] the type suggestion contract and both ways of confirming it (tap, and skip when confident)
- [ ] the per-type process table as data: instant, series, scan
- [ ] the follow-up inputs as data, one input per field a type needs
- [x] the deterministic plan ([capture engine §11](../engines/capture.md#11-the-deterministic-plan)): one table by family and dimension class, field states, per-site form, one completeness check, the question planner. Proved 2026-11-15 (merge 929926f1): 86 engine tests pass and six item types (T-shirt, sneakers, handbag, phone, chair from an unsure first frame, a bundle of three) walk from first photo to done, run twice with identical output, `node --test --test-concurrency=1 app/src/engines/capture/walk.test.ts`. Questions to done (printed by the walk, `capture.questions`): T-shirt 3 (2 with auto confirm), sneakers 4, handbag 5 (one refused), phone 5, chair 2, bundle of three 9; a table with two close size variants 1 when a depth reading picks the variant, 2 without depth (condition, then one pick between the two sizes). Round 3 (0c92f237, 103 tests) adds the variants and studio asks. Plan speed p50 0.103 ms, p95 0.285 ms over 47 states (budget 100 ms), measured by cap-routes-1. Two fresh reviews (rounds 1 and 2; rounds 3 and 4) and their fixes (rounds 4 and 5) are merged: 122 tests pass, `node --test --test-concurrency=1 app/src/engines/capture/<f>.test.ts` for table, select, fields, complete, plan, walk and process (2026-11-15). The routes wait on four integration edits (waiting.md)
- [ ] the free note reader: confirms, marks a contradiction, adds; never re-asks; address, phone and payment never reach a listing
- [ ] photo ph-1 to ph-6
- [ ] proof per [capture](../engines/capture.md) sections 9 and 10: `python -m pytest jobs/photo` and `node --test app/src/engines/capture/`

## 15 API and contract

Integration lead's rows. The joins are in [joins.md](joins.md); what waits on whom is in [waiting.md](waiting.md).

### Where it stands (integration, rerun 2026-11-15 on the Mac unless marked)

| Measure | Number | Before | Command | Commit |
|---|---|---|---|---|
| `/v1` endpoints answering from examples | 24 of 86 | 43 of 86 this morning | `node -e` over `manifest` in `app/src/edge/api/routes.ts` (count `source: 'example'`); `node --test app/src/edge/api/routes.test.ts` keeps each reason true | a97e78f1 |
| Restart survival | events, jobs, decisions, product rows and the write ledger reload from `SECONDHAND_DATA_DIR`; a running job reloads queued; a started write stays started | all in memory | `node --test app/src/edge/events/file-store.test.ts` (12 pass), `app/src/edge/api/runtime.test.ts` (10 pass, two child processes) | fda50f8, a97e78f1 |
| The week in the background | 7 simulated days, 10080 ticks: 3124 / 2475 / 403 sweeps for Depop / Poshmark / eBay, 0 calls for the unlinked Facebook, one offer answered by rule as a Depop dry plan, two offers become decisions, one relink, one sale ends Poshmark and eBay and never Depop; same counts when the store reloads on day 4 | no join existed | `node --test app/src/edge/events/watcher.test.ts` | 12f2db3; reviewer found two high breaks (a like reaching `answer_offer`, a sale pause lost after a crash): fixes in int-watch-2, rows not ticked |
| The walk | 15 stages, 11 real, 4 fake each naming its owner (capture: shot scoring; Poshmark and eBay adapters: scripted routes); `post` and `answer_offer` real on Depop dry plans | 12 stages, 3 fake by label | `node scripts/walk.mjs` on the Mac and on Windows (both total ok); `node --test scripts/walk.test.mjs` (14 pass) | b68fcc7 |
| Benchmark, 20 market items | ours: row 1 coverage 15 to 19 of 20 across three runs, Poshmark only; row 3: every number carries evidence (912 of 912 at 09:19); row 8 on the job's own clocks: first answer p50 0.79 s, p95 2.08 s, full p50 2.07 s, p95 2.88 s (09:26). Baseline, one plain Poshmark request: 17 of 20, 0.67 s p50 (09:24): the baseline wins today | 0 of 20 (stub search, ecece93) | `node bench/run.mjs`, `node bench/run.mjs --tool baseline`, `node bench/score.mjs <run> --baseline <run>`, runs in bench/README.md | 7aaae96b |
| Route code safe for Metro's server bundle | 3 findings on main today, all FALSE: top-level await at app/src/edge/harness/sites/depop/adapter.ts 127, 154 and 189. The check's brace scanner reads the { in a return type such as Promise<{ ok: true; ... }> as the body. Do not edit the adapter to quiet it: int-bundle-2 replaces the scanner with the TypeScript parser | 0 findings (03e5993) before the accounts import route reached the adapter | `.agents/checks/bundle.mjs` inside `node .agents/check.mjs`; `node --test .agents/checks/bundle.test.mjs` (7 pass) | 03e5993 |

| Defects found by fresh review and closed | reviewer 1 (int-review-watch-store.md): a like reaching answer_offer with no amount, a sale pause lost after a crash, after_s NaN, no tenant check on the account, an unlinked job stalling, put replacing another person's row: all closed (eaf24e42, fda50f8). Reviewer 2 (int-review-2.md): HIGH, a delist after a sale gated by the negotiation price rule, so a sale below the floor or on an item with no limits would leave other listings live (a double sale): OPEN, fix in int-watch-2 | | the reviews in the shared notes folder | |

Open in the next round: streaming search on the real lanes (int-search-1), the watcher fixes and the hazard cadence (int-watch-2), item responses leaking the store's `data` field (one contract test red, int-runtime-2), then the bench rerun after search.

- [ ] interface first: `spec/examples/` for every endpoint, pushed for Ben's screens
- [ ] `/v1` routes over each engine as it lands
- [ ] jobs with stage frames and found counts over SSE
- [ ] `/v1/search`, `/v1/assist`, `/v1/out`
- [ ] `PATCH /v1/captures/:id`, `PATCH /v1/me`, accounts and linking
- [ ] `npm run check` in `app/`

## 16 Review, test and fix

Fresh review follows each working piece. Each stream lead runs its own engines' expert sessions (X-1 to X-11).

- [ ] X-1 to X-11 expert session per engine, findings folded into its tasks
- [ ] a fresh review of every stream's merges, with `node scripts/evidence.mjs brief`
- [ ] assigned reviewers rerun the piece's proving commands one file at a time, review against sources, and return fixes to the owner
- [ ] the real-item set scored per field
- [ ] one full rehearsal of the path on the event workspace with real counts

## 17 Open benchmark

Asked by Nate ([packet 53](../../.agents/team/packets/team/53-open-benchmark.md), [spec](../benchmark.md)). Starts after the public search API exists.

- [ ] the runner: `bench/run.mjs`
- [ ] the scorer: `bench/score.mjs`
- [ ] the rivals' records: `bench/rivals/`
- [ ] the results file the website reads: `bench/out/results.json`

## Blocked

(none)
