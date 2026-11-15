# The build board

Status: the one place progress is tracked for the build that ends at 03:00 Central on 2026-11-15. *Agent proposal* until Nate accepts it. What each stream is: [workstreams.md](workstreams.md). What can start this minute: [start-now.md](start-now.md). The global spec: [spec/README.md](../README.md) and the repo [README](../../README.md).

## How to use it

- A box is ticked only by the orchestrator, only when the item's proving command exits 0 on `main` and a seat that did not write it has reviewed it. The tick line gains the commit: `- [x] ... (abc1234)`.
- A stream that starts an item writes its session name after it: `- [ ] ... (stream 5, building)`. One commit per change to this file: `chore(board): ...`, pulled and pushed at once.
- A blocked item gets `BLOCKED:` and the question, and the question goes to Nate the same minute.
- New work found while building is added here as a new box under its stream before it is started. Nothing is built that is not on this board.
- At each checkpoint the orchestrator posts the counts to Nate: done, building, not started, blocked, per stream.

## Where it stands (checked on the Mac, 2026-11-15 about 00:45 Central)

Every task's own check in `spec/plans/backend/plan.json` was run with `node scripts/prove.mjs --wave N --jobs 3`. "Passes" means the check exits 0; no task has had the fresh review a tick needs, so nothing below is ticked. The 24 tuning tasks (`tn*`) are not counted: they are run by hand after the walk exists.

| Wave | Passes its check | Not built (its test file does not exist) |
|---|---|---|
| 0 | 30 of 30 | none |
| 1 | 40 of 46 | `ho-1` `si-1` `ls-2` `rt-captures` `wk-1` `ad-depop` |
| 2 | 58 of 104 | analytics `pa-2` to `pa-7`; style `rs-3` to `rs-6`; valuation `va-5` `va-6`; negotiation `ng-3` `ng-5`; trust `tr-6`; marketing `mk-1` `mk-2`; score `ss-1` `ss-2`; the four site adapters `ad-ebay` `ad-facebook` `ad-poshmark` `ad-mercari`; features `msg-1` `st-1` `ap-1` `ins-1` `me-1` `ic-1` `rk-1`; routes `rt-market` `rt-sources` `rt-items` `rt-valuations` `rt-conversations` `rt-orders` `rt-records` `rt-rules` `rt-wants` `rt-buy` `rt-assist` `rt-search` `rt-genie` `rt-scores` `rt-accounts` `rt-insights` |
| 3 | 1 of 6 | the five live site runs `lv-*`; these wait on the adapters and on Nate's go per site |

Two plan entries, `rt-scores:` and `rt-out:`, are malformed copies and are not counted. The walk (`node scripts/walk.mjs`) was written at about 01:50 Central on the 15th and exits 0 on both machines: twelve stages, ten on real code and two on fakes (`post` and `answer_offer`, which wait on a site adapter), one item sold on Poshmark and delisted on eBay and Depop. It is not yet reviewed against its accepts, so `wk-1` and the 23:30 checkpoint are not ticked.

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

## Checkpoints (Central)

- [ ] 21:45 wave 0 done; interfaces of streams 1, 2, 10, 13, 15 pushed
- [ ] 23:30 the protocol runs and the walk passes on fixtures
- [ ] 02:00 every engine built and proved
- [ ] 03:00 five sites wired behind dry runs, deployed on the event workspace, one rehearsal
- [ ] by 07:00 tuning done, live runs on Nate's go, Ben's screens joined to the API

## 0 Orchestrator

Session: the orchestrator; fixtures, the reporter and run traces are with three seats, building since 21:45. The Python scaffold and the event catalogue are pushed and wait for review.

- [ ] T0-2 contract examples for every `/v1` endpoint: `node --test spec/examples.test.mjs`
- [ ] T0-3 real items with known answers and the scorer: `node --test spec/items.test.mjs`
- [ ] S-1 Python scaffold: `python -m pytest jobs -q`
- [ ] S-2 shared fixtures: `python -m pytest jobs/fixtures -q`
- [ ] S-3 failure reporter: `node --test scripts/prove.test.mjs`
- [ ] S-4 the end-to-end walk on fixtures: `node scripts/walk.mjs`
- [ ] the four intelligence log events added to `spec/events.json` and `log/example.mjs` together: `node --test spec/log.test.mjs`
- [ ] every new name a stream asks for is in `spec/product.md` before its code merges

## 1 Platform kernel

Session: s1-kernel, building since 21:40.

- [ ] interface first: `harness.call(site, verb, args)`, the envelope, error codes, hints, with a fake site behind it
- [ ] sessions: lease, pace, keep-alive, `needs_session` per verb and field
- [ ] primitives with network redaction and the forbidden-control filter
- [ ] release gate: fixture test, field gate, canary, rollback
- [ ] repair loop with the ten-mutation drill
- [ ] route health and order as `param` rows
- [ ] hosted browser pool on our own compute, one steady address and profile per account
- [ ] cookie-carrying request runner (no browser)
- [ ] saved-password secret: write-only from the app, readable by the sign-in job alone, every other identity refused
- [ ] session hand-off from the phone's web view to the hosted browser, with the one re-verify prompt
- [ ] all of it: `node --test app/src/edge/harness/`

## 2 Events and pipeline

Session: s2-events, building since 21:40.

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

Not started: the five teams launch when stream 1 pushes the envelope.

One block per site. Every line is that site's own adapter, proved on a fixture and then on a test account on Nate's go.

### 3 eBay
- [ ] operating design written: what the site's client reads and calls per verb
- [ ] link (OAuth and a harness session), hold and renew
- [ ] public: search active, search sold, read a listing, a seller's shop, reviews, the "still up" check
- [ ] listings: create with every field, edit, reprice, relist, delist, mark sold, read all with counts
- [ ] offers: read, accept, decline, counter, send to watchers, auto-offer settings
- [ ] messages and notifications: read inbox and feed, send, mark read
- [ ] orders, with the accepted Best Offer amount
- [ ] stats per listing, normalised by stage
- [ ] the watch snapshot
- [ ] push against watcher measured; push kept as a trigger only if faster
- [ ] fixtures, mutation drill, pace bench: `node --test app/src/edge/harness/sites/ebay/`

### 4 Facebook Marketplace
- [ ] operating design written
- [ ] link, hold and renew
- [ ] public: search active, read a listing, a seller's profile, the "still up" check
- [ ] listings: create, edit, reprice, relist, delist, mark sold, read all with counts
- [ ] messages and notifications: read, send, mark read; cash at pickup is not an off-site signal
- [ ] stats: views, clicks, threads, saves, shares
- [ ] the watch snapshot
- [ ] fixtures, mutation drill, pace bench: `node --test app/src/edge/harness/sites/facebook/`

### 5 Depop
- [ ] operating design written (recon settles whether sold status is public)
- [ ] link, hold and renew (no partner access)
- [ ] public: search active, read a listing, a shop, reviews, the "still up" check
- [ ] listings: create, edit, reprice, relist, delist, mark sold, read all with counts
- [ ] offers: read, respond, send to likers, auto-respond set to always-accept and never the floor; offers last 24 h
- [ ] messages and notifications: read, send, mark read
- [ ] orders and stats
- [ ] the watch snapshot
- [ ] fixtures, mutation drill, pace bench: `node --test app/src/edge/harness/sites/depop/`

### 6 Poshmark
- [ ] operating design written
- [ ] link, hold and renew
- [ ] public: search active, search sold, read a listing, a closet, the "still up" check from the page's availability data
- [ ] listings: create, edit, reprice, relist, delist, mark sold, read all with counts
- [ ] offers: read, respond, offer to likers (10% rule), Smart Sell settings
- [ ] comments, messages and notifications: read, send
- [ ] orders and stats
- [ ] the watch snapshot
- [ ] fixtures, mutation drill, pace bench: `node --test app/src/edge/harness/sites/poshmark/`

### 7 Mercari
- [ ] operating design written
- [ ] link, hold and renew
- [ ] public: search active, search sold, read a listing, a seller, the "still up" check from the page's sold-out data
- [ ] listings: create, edit, reprice, relist, delist, mark sold, read all with counts
- [ ] offers: read, respond, offer to likers, Promote
- [ ] messages and notifications: read, send
- [ ] orders and stats (views are impressions)
- [ ] the watch snapshot
- [ ] fixtures, mutation drill, pace bench: `node --test app/src/edge/harness/sites/mercari/`

## 10 Swarm intelligence

Session: s10-intel, building since 21:40.

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

Session: s11-money, building since 21:40.

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

## 12 Scoring: knowledge

Session: s12-knowledge, building since 21:40.

- [ ] identity id-1 to id-6
- [ ] demand and trend dt-1 to dt-6
- [ ] platform analytics pa-1 to pa-7, reading Ben's levers data
- [ ] recommendation and style rs-1 to rs-6
- [ ] trust 1 to 6
- [ ] learning the person: `param` rows scoped to the person, visible and resettable, never leaking to another person
- [ ] all of it: `python -m pytest jobs` and `node --test app/src/engines/trust/`

## 13 Databricks

Session: s13-databricks, building since 21:40.

- [ ] T0-1 the workspace checks on the event workspace, including whether a headless browser runs on its compute
- [ ] interface first: the `param`, `observation`, `evidence`, `citation` shapes with an in-memory fake
- [ ] Lakebase tables and migrations for the canon
- [ ] the `param` registry: versions, promote on a backtest win, rollback
- [ ] per-event updates in the transaction that records the outcome
- [ ] nightly refits as jobs, champion and challenger
- [ ] the proof layer: guarded numbers, `claim_check`, `rights` tags
- [ ] the secret scope for sessions and saved passwords
- [ ] jobs for watchers, gathers and refits, with their triggers
- [ ] deployed on the event workspace; the edge reaches it

## 14 Capture and photo

Session: s14-capture, building since 21:40.

- [ ] the type suggestion contract and both ways of confirming it (tap, and skip when confident)
- [ ] the per-type process table as data: instant, series, scan
- [ ] the follow-up inputs as data, one input per field a type needs
- [ ] the free note reader: confirms, marks a contradiction, adds; never re-asks; address, phone and payment never reach a listing
- [ ] photo ph-1 to ph-6
- [ ] proof per [capture](../engines/capture.md) sections 9 and 10: `python -m pytest jobs/photo` and `node --test app/src/engines/capture/`

## 15 API and contract

Session: s15-api (owns T0-2 and app sign-in), building since 21:40.

- [ ] interface first: `spec/examples/` for every endpoint, pushed for Ben's screens
- [ ] `/v1` routes over each engine as it lands
- [ ] jobs with stage frames and found counts over SSE
- [ ] `/v1/search`, `/v1/assist`, `/v1/out`
- [ ] `PATCH /v1/captures/:id`, `PATCH /v1/me`, accounts and linking
- [ ] `npm run check` in `app/`

## 16 Review, test and fix

Not started: launches with the first merges. Each stream lead runs its own engines' expert sessions (X-1 to X-11).

- [ ] X-1 to X-11 expert session per engine, findings folded into its tasks
- [ ] a fresh review of every stream's merges, with `node scripts/evidence.mjs brief`
- [ ] Codex sessions sweeping continuously: rerun every proving command and the walk on `main`, review what merged, and fix what is red through the owning stream
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
