# The join map


Status: kept by the integration lead; *agent proposal*. Rebuilt 2026-11-15 from the code on `main` (`GET /v1/routes`, the imports of `app/src/edge/api/*.ts`, `JOB_FOR` in `app/src/edge/events/ports.ts`, the harness verbs in `spec/product.md` §6). The other leads and the orchestrator work from it; change a row when its join changes, in the same commit.

States: **real** (answers from an engine through the real route and store), **example** (the route answers from `spec/examples/`; the reason is in `exampleReasons` in [routes.ts](../../app/src/edge/api/routes.ts)), **missing** (nothing joins the two sides yet). Owner names who closes a missing join: engines lead, capture lead, Databricks lead, the orchestrator (harness verbs and canon), integration (this lead).

## The demo path, link by link

One item from the camera to the sale, the way the person meets it. A link marked missing here blocks the demo.

| # | Link | From → to | State | Owner, and what closes it |
|---|---|---|---|---|
| 1 | Capture opens | `POST /v1/captures` → the capture plan engine | real (fc43c5a0); capture rows live in a memory map in `captures.ts` until the Store has a `capture` table | integration: fix J4; the capture lead then moves `captureRows` onto the Store |
| 2 | Photos and finish | `POST /v1/captures/:id/photos`, `/finish` → identify and photo_score jobs | real routes; no job runner calls `applyJobResult` | integration: fix J5 ([packet 75](../../.agents/team/packets/team/75-capture-needs-from-integration.md) §2) |
| 3 | Identify | finish → `jobs/identity/ladder.py` → item `product_id` | missing in the API (real in the walk, Python) | integration: fix J5 runs the ladder as a job and applies its result |
| 4 | Value | `POST /v1/valuations` → `valuation/check.ts` | example input: the route prices the fixed example item `it_7c2m`, never the person's own item; live sold reads only when `SECONDHAND_LIVE_SITES` names the site (12cdacb3) | integration with the engines lead: fix J1 |
| 5 | Item card | `GET /v1/items/:id` → `card/card.ts` | real over Store item rows | – |
| 6 | Strategy and limits | `POST /v1/items/:id/strategy` → `limits` row | real on the Store (79e20adc); the limits port does not pass the listing's own price | integration: fix J9 |
| 7 | Draft | `listing/build.ts` (buildAll) | real in the walk, no route | integration: `POST /v1/items/:id/listings` builds through it |
| 8 | Post to linked sites | `POST /v1/items/:id/listings` → `edge/post/post.ts` → `harness.call(site,'post')` | example | integration: wire the route to createPoster, forced dry unless the site is in `SECONDHAND_LIVE_SITES` |
| 9 | Linked accounts | `POST`/`GET /v1/accounts` → Accounts | real: account rows on the Store (a97e78f1); `byId` searches every person's accounts; the signed-in client and profile registry are on main (2535ab10) but not composed | integration: fixes J3 and J11 |
| 10 | Background watch | scheduler → sweep → differ → intake → pipeline | joined: `runtime.watcher`, ticked by `node scripts/watch.mjs` (67f34a6e); never run on a live account | a live signed-in sweep waits on one account Nate links |
| 11 | Offer becomes a decision | `offer.received` → `negotiation/choose.ts` decide → policy → `answer_offer` or a decision | joined: inside the limits, a like never writes (eaf24e42); pAccept is the engine's documented midpoint | engines lead: a production pAccept |
| 12 | Message | `message.received` → `send_message` job → `gate/gate.ts` claim_check → decision | real in the pipeline; `conversations.ts:83` sends `offer_cents: 0` when no offer parsed | integration: fix J2 |
| 13 | Decision answered | `POST /v1/decisions/:id/act` → policy rerun → job | real; a `delete_after_sale` decision has no action | integration: fix J8 |
| 14 | Sale confirmed | `listing.sold` → `poll_orders` → `sold/sold.ts` confirm → order | joined: orders as Store rows, the order and its delists in one transaction (a4d2ea61) | – |
| 15 | Delist elsewhere | confirm → `delist/delist.ts` fanOut → `end` per site | joined: each delist carries the confirmed order id; a dry end is stage `planned` and asks the person (edb2c40d) | – |
| 16 | Expired sign-in | `auth_expired` → `stale.ts` markStale → `relink` decision → resume | joined: pauses the account with one relink decision; a bot check raises one site_warning (eaf24e42) | – |
| 17 | Numbers shown | `GET /v1/scores`, `/insights`, `/today` → proof layer citations | real; a citation's basis ids resolve to no stored row | integration: fix J1 stores the rows they name |
| 18 | Survives a restart | every row above | real for every Store table when `SECONDHAND_DATA_DIR` is set (de71199); capture rows and auth sessions are still process memory | integration: fixes J2 and J4 |
| 19 | Marketing suggestions with a handoff | marketing engine → a listing's `market_standing.fix` → the app opens the site for the person's tap | missing (the marketing engine reaches no route) | engines lead for the suggestion; integration carries it on the listing and `GET /v1/scores` |
| 20 | Streaming search | `POST /v1/search` → 202 job → one `runPlan` target per source row → `job.stage` and `answer.partial` per source | real: Dupe, Poshmark, Depop through the harness, eBay through the harness at 6 a minute, each source paced, a page with no listing card is `unknown` and never retried (5d56f159); nothing it reads is kept | integration: fix J1 stores what it reads |

## Named fixes, in build order

The queue of [packet 69](../../.agents/team/packets/team/69-integration-handoff.md#3-the-queue-in-order), each one a fix with the measure that says it worked. J0, main green in this area, landed in d81792a8 and 137d9ec8.

| Fix | What is wrong now | The fix | Measure |
|---|---|---|---|
| J1 | The valuation prices an example item; nothing a search reads is kept; a thin answer raises no gather (real-time links 2, 3, 5 and 7) | The route reads the person's own item from the Store and calls `valuate(item, ctx)`, the engines lead's seam. `observation` becomes a Store table; evidence is the shape inside it ([canon §2](../product.md)), not a table of its own. One writer, `app/src/edge/events/observations.ts`, used by search, gather and valuation, under the asking person's `user_id`. Dupe rows are never written, because they are licensed for the request only. When a `gather` comes back, `runPlan` runs as the widening step and its finds go through the same writer | `node scripts/realtime-proof.mjs` shows links 2, 3, 5 and 7 working; `valuations.test.ts` prices a person's own item, and a second person cannot price it |
| J2 | The visitor limit is keyed by something the client can rotate, and its map is unbounded; email codes have no limit per address or per IP; a raw email reaches a log line; auth sessions and idempotency keys are process memory; a cold start and a busy process both answer 503 `waking`; `conversations.ts:83` sends `offer_cents: 0` when no offer parsed | Each fixed at its cause in `http.ts`, `auth.ts` and `conversations.ts`; sessions and idempotency keys move onto the Store | `http.test.ts`, `auth.test.ts`, `conversations.test.ts`; a logged HTTP run passes `node spec/log.mjs` |
| J3 | `byId(id)` in `runtime.ts` searches every person's accounts: an isolation hole | `byId(id, person_id)` in every caller; the harness and browser callers go to the orchestrator as a diff | an account id used under another person is refused in every caller |
| J4 | Captures and photos are lost on restart | `capture` and `photo` added to `TABLES` | a capture reloaded from its dump returns the same `GET /v1/captures/:id`; a second person's dump holds none of it |
| J5 | No job runner calls `applyJobResult` | The runtime's engines run identify and photo_score and apply their results. An `invalid`, `not_found` or `stale` result is the job's failure and is never retried | packet 75 §2's two done checks |
| J6 | `DELETE /v1/me` queues a `delete_user` job that nothing runs | A port runs the Databricks `purge_user` job (one parameter, `user_id`, with the job id taken from config). The run id goes on the erasure decision. The delete reports done only when the Store rows are gone and the run was accepted | with a fake port, a refused run fails the delete and an accepted run returns its id |
| J7 | Background work can read Mercari | A source-row field says who may trigger a source; only a search the person typed reads Mercari | a background run makes zero Mercari reads |
| J8 | Answering `delete_after_sale` does nothing | A handoff that opens the listing on the site, and an end job once the site is live | the answer returns the site URL |
| J9 | Each offer is decided against the snapshot price | The limits port passes the listing's own price | a two-site item decides each offer against its own listing price |
| J10 | First answer p50 is 0.87 s, against 0.67 s for one plain request | Find the time spent in job creation and the first frame; stream the first source's rows as they parse | bench row 8: first-answer p50 at or under the baseline, at the product's pace |
| J11 | The signed-in client and profile registry are on main but not composed; old account rows carry no `profile_id` | `runtime.ts` builds the session client over the Store's `account` table. Old rows with no `profile_id` are left in place, marked `stale` with reason `relink`, and get one relink decision each; they are never deleted and never guessed | `runtime.test.ts`: an old row raises one relink decision, and a new link holds a `profile_id` |
| J12 | Full answer p50 9.99 s against first answer 0.669 s (unsigned bench run 2026-11-15T10-24-39-853Z-ours): likely the eBay pace slot (10 s gap, from 5d56f159) taken before a route that answers `no_route`, since eBay and Depop are not live in the composed product; not yet measured | A source with no composed live route reports `no_route` without taking a pace slot; land it with the `publicClients` swap | a stage with no route settles in under 100 ms; bench full-answer p50 near first-answer p50 |

## By feature

Routes come from the feature's spec page (`spec/features/<slug>.md`) checked against §7. "Not in §7" marks a route the feature page names that canon does not have; those go to the orchestrator.

| Feature | Routes (state) | Engines behind | Harness verbs | Events emits / consumes | Stores | Join |
|---|---|---|---|---|---|---|
| capture | `POST /v1/captures`, `/photos`, `PATCH /v1/captures/:id`, `/finish`, `/talk` (example); `PATCH /v1/items/:id/attributes/:name` (real) | `engines/capture/process.ts`, `facts.ts`; `jobs/capture/*` | none | emits identify, valuate jobs | capture, photo, attribute | example: capture lead |
| identify | `POST /v1/captures/:id/finish` (example), `GET /v1/jobs/:id` (real) | `jobs/identity/ladder.py` | `search` (match) | `fact.found` frames; item state | item.product_id, attribute | missing in API: capture lead |
| measure | `PATCH /v1/items/:id/attributes/:name` (real) | `engines/capture/facts.ts` | none | attribute.unpinned | attribute | real |
| studio | `GET /v1/jobs/:id/events` (real) | none in TS | none | `studio.*` (not in events.json) | photo | missing: capture lead (studio job) |
| item-card | `GET /v1/items`, `/:id` (real over example seed), `PATCH /v1/items/:id` (example) | `edge/card/card.ts` | none | state.change | item, attribute, photo, listing | example seed: integration (store rows) |
| price | `POST /v1/valuations` (real), `POST /v1/items/:id/strategy` (example), `GET /v1/items/:id/plan-choices` (real over example) | `valuation/check.ts`, `comps.ts`, `path.ts`, `keep.ts` | `search` (comps) | value_moved | valuation, strategy, limits | strategy example: integration; comp inputs: engines lead |
| appraise | `POST /v1/valuations` (real); `GET /v1/valuations/:id` not in §7 | `valuation/check.ts` | `search` | none | valuation | real; the extra route goes to the orchestrator |
| list | `POST /v1/items/:id/listings`, `/strategy` (example), `GET /v1/scores` (real) | `listing/build.ts`, `crosslist.ts`, `edge/post/post.ts`, `gate/gate.ts` | `post`, `read_listings` (read-back) | app.list → `post` job | listing, claim_check | example: integration |
| connect | `/v1/auth/*`, `GET`/`PATCH /v1/me` (real); `/v1/accounts*` (example) | `edge/auth.ts`, `connect/signin.ts`, `browser/auth.ts` | sign-in live view; `read_listings`, `read_orders` (import) | account_stale, account_relinked | account (token_ref only) | accounts example: integration |
| watch (Buy wants) | `/v1/wants*`, `POST /v1/matches/:id/act` (example) | `edge/watch/watch.ts` watchRun | `search`, `save` | `watch.ran`, `match.found`, `match.alerted` (not in JOB_FOR) | want, match | example: integration (want rows + a `watch_run` engine) |
| buy | `POST /v1/search`, `/compare` (real), `GET /v1/products/:id`, `/history`, `/trends` (example), `POST /v1/orders` (example) | `edge/buy/buy.ts`, `intel/public/search.ts` | `search`, `make_offer` | `buy_offer` decision | order (purchase) | products example: engines lead (catalog projection) |
| market | `GET /v1/products/:id`, `/history`, `/trends`, `/index/:id` (example), `GET /v1/out`, `POST /v1/genie` (real) | `edge/market/market.ts`, `genie/genie.ts` | `search` | none | product, comps (Delta) | example: Databricks lead (comp rows), engines lead (trend reader) |
| messages | `GET /v1/conversations`, `/messages` (real), `POST /v1/conversations/:id/messages` (example) | `edge/messages/messages.ts`, `negotiation/policy.ts`, `gate/gate.ts` | `read_inbox`, `send_message` | message.received → `send_message` job | conversation, message | reply example: integration |
| sold | `GET /v1/orders` (real), `/pick-list`, `/:id/ship`, `/labels`, `/:id/handed-over` (example); `GET /v1/orders/:id` not in §7 | `sold/sold.ts`, `delist/delist.ts`, `orders/orders.ts` | `read_orders`, `end` | listing.sold → `poll_orders` → `app.delist` | order (memory orderBook) | real in walk; storage: integration |
| today | `GET /v1/today`, `/decisions`, `POST /v1/decisions/:id/act`, `/events/:id/undo` (real); `/v1/rules` (example) | `edge/today/today.ts`, `events/policy.ts` | via jobs | decision.open/answer/close | decision, rule, limits | rules example: integration |
| score | `GET /v1/scores` (real), `/scores/:id/basis`, `/sites/:site/ranker`, `/experiments*` (example) | `engines/score/score.ts`, `param` | `read_stats` | score.change | score | basis example: engines lead |
| insights | `GET /v1/insights` (real), `PUT /v1/goals/:month`, `GET /v1/records` (example) | `edge/insights/insights.ts`, `orders.ledger` | `read_stats`, `read_storefront` | none | goal, order | goals and records: engines lead (goal write, tax report) |
| assist | `POST /v1/assist` (real), `/v1/jobs/:id*` (real) | `edge/assist/assist.ts`, `intel/answer.ts` | through search | `assist.*` (not in events.json) | intent | real |
| data | `GET /v1/sources/health`, `/events`, `POST /v1/me/export`, `DELETE /v1/me` (real), `GET /v1/citations/:id` (example); `GET /v1/me/data`, `POST /v1/ask` not in §7 | `engines/proof/proof.ts`, `param`, `harness/health.ts` | `route_probe` | every event | event, param, citation | citations example: engines lead |
| replay | `GET /v1/sessions/` not in §7 | `edge/replay/replay.ts` | the recorded recipe | recorded, drift, fallback | recording | outside the demo path |
| app | the screens (Ben) | – | – | – | – | reads `GET /v1/routes` to know what is real |

## Cross-engine notes for the engines lead

(none found yet; each goes to the orchestrator as a message, and is listed here with its date.)
