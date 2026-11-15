# The join map

Status: kept by the integration lead; *agent proposal*. Rebuilt 2026-11-15 from the code on `main` (`GET /v1/routes`, the imports of `app/src/edge/api/*.ts`, `JOB_FOR` in `app/src/edge/events/ports.ts`, the harness verbs in `spec/product.md` §6). The other leads and the orchestrator work from it; change a row when its join changes, in the same commit.

States: **real** (answers from an engine through the real route and store), **example** (the route answers from `spec/examples/`; the reason is in `exampleReasons` in [routes.ts](../../app/src/edge/api/routes.ts)), **missing** (nothing joins the two sides yet). Owner names who closes a missing join: engines lead, capture lead, Databricks lead, the orchestrator (harness verbs and canon), integration (this lead).

## The demo path, link by link

One item from the camera to the sale, the way the person meets it. A link marked missing here blocks the demo.

| # | Link | From → to | State | Owner, and what closes it |
|---|---|---|---|---|
| 1 | Capture opens | `POST /v1/captures` → `capture/process.ts` | example | capture lead: a capture-session service (session row, upload targets) |
| 2 | Photos and finish | `POST /v1/captures/:id/photos`, `/finish` → identify and valuate jobs | example | capture lead; integration joins the jobs it returns to the pipeline |
| 3 | Identify | finish → `jobs/identity/ladder.py` → item `product_id` | missing in the API (real in the walk, Python) | capture lead: the TS or job seam that writes the item row |
| 4 | Value | `POST /v1/valuations` → `valuation/check.ts` | real | – |
| 5 | Item card | `GET /v1/items/:id` → `card/card.ts` | real over an example-seeded map | integration: item rows on the Store port (int-store-1) |
| 6 | Strategy and limits | `POST /v1/items/:id/strategy` → `limits` row | example | integration: limits rows on the Store port, `negotiation/policy.ts` guard |
| 7 | Draft | `listing/build.ts` (buildAll) | real in the walk, no route | integration: `POST /v1/items/:id/listings` builds through it |
| 8 | Post to linked sites | `POST /v1/items/:id/listings` → `edge/post/post.ts` → `harness.call(site,'post')` | example (the reason in routes.ts is stale: post.ts exists) | integration: wire the route to createPoster, dry unless Nate's go per site |
| 9 | Linked accounts | `POST`/`GET /v1/accounts` → `browser/auth.ts` Accounts, `connect/signin.ts` | example | integration: account rows on the Store port behind `Accounts` |
| 10 | Background watch | scheduler → sweep → differ → intake → pipeline | missing (no `runSweep`) | integration: `events/watcher.ts` (int-watch-1) |
| 11 | Offer becomes a decision | `offer.received` → `negotiation/choose.ts` decide → policy → `answer_offer` or a decision | missing (the job had no decide) | integration (int-watch-1) |
| 12 | Message | `message.received` → `send_message` job → `gate/gate.ts` claim_check → decision | real in pipeline, `POST /v1/conversations/:id/messages` example | integration: the person's reply route through the gate |
| 13 | Decision answered | `POST /v1/decisions/:id/act` → policy rerun → job | real | – |
| 14 | Sale confirmed | `listing.sold` → `poll_orders` → `sold/sold.ts` confirm → order | real in the walk; orders live in a memory `orderBook` | integration: order rows on the Store port |
| 15 | Delist elsewhere | confirm → `delist/delist.ts` fanOut → `end` per site | real in the walk on the fake site; the delist job does not carry the site's listing id | integration (int-watch-1 task 3) |
| 16 | Expired sign-in | `auth_expired` → `stale.ts` markStale → `relink` decision → resume | real alone, not joined to sweeps | integration (int-watch-1) |
| 17 | Numbers shown | `GET /v1/scores`, `/insights`, `/today` → proof layer citations | real; `GET /v1/citations/:id` example | engines lead: basis ids on the default citation |
| 18 | Survives a restart | every row above | real for events, jobs, decisions and product rows when `SECONDHAND_DATA_DIR` is set (`fileStore`, de71199; `node --test app/src/edge/events/file-store.test.ts`, 8 pass, 2026-11-15); routes still keep items and orders in their own maps until int-runtime-1 | integration; Lakebase needs an async Store port (Databricks lead, through the orchestrator) |

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
