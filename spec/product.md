# secondhand: the shared product model

Status: draft. Written 2026-11-14. Every line is *agent proposal* unless it links a decision in [decisions.md](../product/decisions.md) or [vision.md](../product/vision.md) Decided. Every feature spec in [features/](features/) builds on this page: it uses these names, states, action kinds and contract rules, and writes anything missing under its own "Needs from the shared model".

## 1. What it is for

| | |
|---|---|
| Who | Someone clearing their own things, who also buys used; resellers can use it but do not shape the design ([decisions](../product/decisions.md#2026-11-14-the-first-person-we-build-for-is-someone-clearing-their-own-things)). |
| The hassle today | Photographing, measuring, looking up what it is and what it sold for, writing a listing per site, answering the same questions, haggling, keeping five sites in sync, delisting after a sale, arranging pickups, chasing returns. A $20 item rarely earns back that time, so it sits in a closet. |
| What they stop doing | Scan the item once and get one measured record of it. Pick a selling plan. The app lists it, answers buyers inside the limits they set, takes it down everywhere when it sells, and books the pickup inside their hours. |
| What they control | The limits: lowest price, ship or pickup, pickup hours, saved spot, buy ceiling. Anything outside them waits as a card in Today. Address, payment, refunds and a price below the lowest are always theirs ([decisions](../product/decisions.md#2026-11-14-buyers-are-handled-inside-limits-you-set-then-it-learns)). |
| What they know | What an item is worth on each site, from real sales with dates; why the agent did each thing (the "why?" timeline); what they earned and could earn. |
| How the two sides feed each other | One engine identifies and values an item whether you own it or want it ([decisions](../product/decisions.md#2026-11-14-selling-comes-first-buying-is-a-full-side)). Every sale and every watched listing becomes a comp. A bought item becomes "Sell this" with its cost known. What you sell tells Buy your sizes and taste. |
| What it is not | No storefront and no payments: buyers pay on the marketplace (Nate's proposal, vision.md Proposed). |

## 2. The map

Tabs follow the decided bar: Today · Sell · ＋ · Buy · You ([decisions](../product/decisions.md#2026-11-14-the-bottom-bar-is-today--sell----buy--you)). An entity listed here has its owner table in that feature; others read it.

| Slug | Where the person meets it | Owns | Spec |
|---|---|---|---|
| today | Today | `decision` (the open-decisions query and cards) | [features/today.md](features/today.md) |
| connect | First launch, You > Accounts | `user`, `account` | [features/connect.md](features/connect.md) |
| item-card | The item screen, from Sell | `item`, `attribute` | [features/item-card.md](features/item-card.md) |
| capture | ＋ Sell this, the camera | `capture`, `photo` | [features/capture.md](features/capture.md) |
| measure | Inside capture | writes `attribute` (source `measured`) | [features/measure.md](features/measure.md) |
| identify | Inside capture, after the scan | `product` | [features/identify.md](features/identify.md) |
| studio | The item screen, photos | writes `photo` (role studio, real photos kept) | [features/studio.md](features/studio.md) |
| price | The item screen, price and plan | `comp`, `valuation`, `strategy` | [features/price.md](features/price.md) |
| appraise | ＋ What's it worth, Buy camera and link field | no table: a `valuation` for an item or an outside listing | [features/appraise.md](features/appraise.md) |
| list | Sell, the drafting area | `listing` | [features/list.md](features/list.md) |
| replay | Not seen: under list and messages | `recording` (new, §3) | [features/replay.md](features/replay.md) |
| sold | Sell's Sold shelf, Today ship-by cards | `order`, `appointment` | [features/sold.md](features/sold.md) |
| messages | The chat icon with a count | `conversation`, `message`, `offer` | [features/messages.md](features/messages.md) |
| watch | Buy: New matches, Watching | `want`, `match` | [features/watch.md](features/watch.md) |
| data | You > By site, the "why?" timeline | `job`, `event`, `rule`, `limits` | [features/data.md](features/data.md) |
| buy (proposed) | Buy: search, For you, Bought | no table: `order` with kind purchase, `offer` outgoing, `match` saved | [features/buy.md](features/buy.md) |
| insights (proposed) | You: earned, could earn, goals | `goal`; ledger numbers are derived | [features/insights.md](features/insights.md) |

`rule` and `limits` sit with data because Today, messages, sold, price and buy all enforce them; You > Automation and You > Pickups are their screens.

## 3. The data model

Every row carries `id` (prefixed), `user_id`, `created_at`, `updated_at` and `version` (integer, bumped on each write; §7). Storage: L is Lakebase (Postgres, operational truth, synced to Delta), D is Delta, V is a Unity Catalog volume.

| Entity | Key fields (type) | Owner | Store | Readers | Primitive |
|---|---|---|---|---|---|
| `user` | email_ref (hash), locale, currency, timezone, disclosure_pref | connect | L | all | none (identity) |
| `account` | site (enum), route (`api`, `browser`, `search_only`), health (`ok`, `expiring`, `broken`, `paused`), capabilities (§6 table, per site), linked_at, token_ref (vault key, never the token) | connect | L | list, messages, sold, watch, buy | Account (configuration) |
| `item` | state (§4), product_id?, title, category, cost_cents?, origin (`capture`, `purchase`, `folder`), kept_reason? | item-card | L | all | **Item** |
| `product` | brand, model, variant, gtin?, mpn?, category, spec (json), embedding_ref | identify | L, mirrored to D | identify, price, watch, appraise | new: one catalogue identity many items and comps resolve to, so a sale of one item prices the next |
| `capture` | item_id?, mode (`shots`, `scan`, `talk`), coverage (json), depth_ref?, pose_ref?, masks_ref?, read_text_ref?, kept_raw (bool) | capture | L, files V | measure, identify, studio | part of Item: one session, so the item picks the mode |
| `photo` | capture_id, role (`front`, `back`, `tag`, `fabric`, `flaw`, `spin`, `studio`), file_ref, parent_photo_ids[], exif_stripped (bool) | capture | L, files V | studio, list, identify | part of Item |
| `attribute` | item_id, name, value (json), unit?, source (`measured`, `label`, `inferred`, `spec`, `you_said`, `marketplace`), confidence (0..1), evidence[] (photo or comp ids), method, at, confirmed (bool) | item-card | L | all | part of Item; a row per fact so each carries provenance. A `you_said` row is never overwritten by a model |
| `job` | kind, item_id?, stages[] {name, state, started_at, ended_at}, state, result?, error?, trace_id | data | L | all | **Job** |
| `comp` | product_id?, site, price_cents, currency, price_type (`asking`, `sold`, `retail`), observed_at, sold_at?, condition, url_ref, rights_note, source_route | price | D | price, appraise, watch, insights | **Comp** |
| `valuation` | item_id or match_id, per_site[] {site, low, high, basis_count, as_of, dates}, drivers[], most_to_pay?, job_id | price | L (current), D (history) | item-card, appraise, list, buy, today | **Valuation** |
| `strategy` | item_id, objective (`quick`, `balanced`, `max_return`), price_path[] {at, price_cents}, lowest_price_cents, always_accept_cents?, sites[], handover (`ship`, `pickup`, `either`), follow_ups[], suggested (bool), chosen_at | price | L | list, messages, sold | new: the plan the user picks from a few, so markdowns and counters follow one written path ([fees-and-taxes.md](../research/price/nate/fees-and-taxes.md) for net) |
| `listing` | item_id, site, state (`LISTING_STATES`), price_cents, url, external_ids[] {id, from, to}, sku, interest {views?, watchers?, likes?}, posted_at | list | L | all | **Listing** |
| `conversation` | listing_id or match_id, site, counterpart_ref (hash), intent, last_at, unread | messages | L | today, sold | **Conversation** |
| `message` | conversation_id, direction, text_ref (body held encrypted, never logged), sent_by (`user`, `auto`, `site`), at | messages | L | messages | part of Conversation |
| `offer` | conversation_id or listing_id, direction (`in`, `out`), amount_cents, state (`open`, `countered`, `accepted`, `declined`, `expired`), expires_at | messages | L | price, sold, buy | part of Conversation; its own row because offers have states and limits act on them |
| `order` | kind (`sale`, `purchase`), item_id, listing_id?, site, state (§4), price_cents, fees_cents, shipping_cents, payout_cents?, claim_window_ends?, external_order_id | sold | L | insights, today, buy | new: the money and handover the Ledger entry is derived from |
| `decision` | kind (§5), item_id?, options[] {id, label, signature}, suggested, deadline, why, state (`open`, `answered`, `expired`, `superseded`), answered {option_id, edited, ms_on_card}? | today | L | all | **Decision** |
| `rule` | kind, scope (`all` or item_id), mode (`auto`, `ask`, `never`), promoted_at?, unedited_approvals (int) | data | L | all executors | **Rule** |
| `limits` | per item: lowest_price_cents, always_accept_cents?; per user: handover, pickup_windows[], saved_spot_ref, ask_every_time (bool), buy_ceiling_cents? | data | L | messages, sold, price, buy | part of Rule |
| `want` | text, product_id?, fit (attributes), ceiling_cents?, sites[], schedule {every_min}, alert (`available`, `under`) | watch | L | buy, today | **Want** (with Watch) |
| `match` | want_id?, source (`want`, `search`, `for_you`), site, url, price_cents, seen_at, saved (bool), valuation_id? | watch | L, history D | buy, today, price | part of Want |
| `appointment` | order_id, kind (`pickup`, `ship_by`), window {start, end}, place_ref, calendar_ref?, state (`proposed`, `booked`, `done`, `missed`, `cancelled`) | sold | L | today, messages | **Appointment** |
| `goal` | month, target_cents, target_sales?, progress (derived) | insights | L | today, you | new: Nate's monthly goal (vision.md Proposed) |
| `event` | item_id?, actor (`user`, `auto`, `site`), action, observed_at, effective_at, operation_id, trace_id, undo_of? | data | D, written through the logger | data, insights, today | the one log ([5-logging.md](../.agents/team/packets/team/5-logging.md)) |
| `recording` | site, task, steps_ref, recorded_at, last_ok_at, fail_count | replay | L, files V | list, messages, sold | new, *added by this page*: a site action recorded once in a browser harness and replayed as a fast path; it has no other home |

Ledger numbers (earned, fees, kept, could earn) are queries over `order`, `event`, `strategy` and `valuation`, never stored ([primitives.md](../product/primitives.md)). `action_log` is `event where action is an item.action`.

## 4. The item's life

`LISTING_STATES` in [lifecycle.mjs](lifecycle.mjs) stays the source for one listing on one site; this page does not change that file. The item state is stored; the Sell pill is derived: Researching is `researching`, Review is `review`, Offer $X is an open `offer` decision, Ship by is an open `ship_by` appointment, Slow is `stale`, then [itemPill](lifecycle.mjs) for Failed, Sold and Live. This mapping is new; [spec/README.md](README.md) notes those four pills are not modeled yet.

### Item

| From | To | Trigger | Actor |
|---|---|---|---|
| (new) | capturing | ＋ Sell this, or Bought it, or a folder drop | user |
| capturing | researching | capture finished | user |
| researching | review | research job arrived | auto |
| researching | failed | a research stage failed | auto |
| failed | researching | retry | user |
| review | live | first listing reaches `live` | site |
| live | stale | total time offered passes the strategy's patience with interest below plan | auto |
| stale | live | markdown, relist or new site | auto or user |
| live, stale | sold | `buyerPays` on any listing | site |
| live, stale | unsold | strategy reaches its lowest price and ends, or the user ends it | auto or user |
| any before sold | kept | withdrawn, donated or gifted | user |
| sold | handed_over | order reaches `delivered` or `handed_over` | site or user |
| handed_over | done | order reaches `released` | site |
| handed_over, done | returned | return received | site |
| handed_over | disputed | order reaches `dispute_open` | site |
| disputed | done or returned | ruling | site |
| returned, unsold | review | relist chosen | user |

### Listing additions (*agent proposal*, to model in lifecycle.mjs as a build task)

| Action | From | To | Actor | Note |
|---|---|---|---|---|
| offerIn | live | live | site | opens an `offer` |
| counter | live | live | auto inside limits, else user | never below `lowest_price_cents` |
| acceptOffer | live | live (sale pending) | auto at or above `always_accept_cents` ([decisions](../product/decisions.md#2026-11-14-always-accept-is-offered-at-listing-and-only-unedited-approvals-count)), else user | site then sends `buyerPays` |
| declineOffer | live | live | auto when a counter at the lowest price is refused | |
| offerToWatchers | live | live | auto inside limits | eBay, Depop only (§6) |
| bookPickup | sale | sale | auto inside `pickup_windows` at `saved_spot` | `pickupTime` leaves `NEVER_ALONE` only here ([decisions](../product/decisions.md#2026-11-14-the-agent-books-pickups-inside-your-hours)); outside windows or with ask_every_time it stays `confirmPickup` by the user |
| relist | delisted | posting | user, auto if promoted | appends a new external id; never on Poshmark (delete-and-repost is banned, §6) |

Approval counting must track unedited approvals; `decision.answer` in [events.json](events.json) already carries `edited`.

### Order (sale and purchase)

| From | To | Trigger | Actor |
|---|---|---|---|
| (new) | paid | site reports payment | site |
| (new) | pickup_booked | local cash deal booked; payment happens at handover | auto or user |
| paid | to_ship or pickup_booked | handover chosen by strategy or buyer | auto |
| to_ship | shipped | tracking scanned | site |
| shipped | delivered | carrier | site |
| pickup_booked | handed_over | the user taps Handed over | user |
| delivered, handed_over | claim_window | at once; length per site | auto |
| claim_window | released | window ends, payout | site |
| paid, to_ship, pickup_booked | cancelled | buyer or seller cancels | site or user |
| claim_window | return_open | buyer requests a return | site |
| claim_window, return_open | dispute_open | buyer escalates | site |
| return_open, dispute_open | refunded | the user approves, or the site rules | user or site |
| return_open, dispute_open | released | declined or ruled for the seller | site |

A purchase order (buy side) starts at `paid` only after the person completes the purchase on the site, a locked action; on `released` it offers "Sell this" with `cost_cents` set. Returns and disputes follow [trust-returns-disputes.md](../research/sold/nate/trust-returns-disputes.md).

## 5. Who may act

Modes are `auto`, `ask`, `never`; `never` is what [events.json](events.json) calls `never_alone`. The policy check is plain code that runs before any executor ([decisions](../product/decisions.md#2026-11-14-automation-runs-in-tiers-that-learn)). Promotion: 3 unedited approvals of the same kind (and item, for per-item kinds) offer "Always do this".

| Kind | Default | Auto when | Promotable |
|---|---|---|---|
| answer_fact (availability, size, measurements) | auto | the answer uses only confirmed attributes | n/a |
| reply_other | ask | never auto by default | yes |
| counter_offer | auto | counter at or above the lowest price, on the strategy path | yes |
| accept_offer | auto | offer at or above "Always accept $X" | yes, per item |
| decline_offer | auto | offer below the lowest price, answered with a counter at it | yes |
| offer_to_watchers | auto | price at or above the lowest price | yes |
| markdown | auto | new price above the lowest price, on the path | yes |
| first_post | ask | n/a | yes, subject to the automation question (§9) |
| edit_listing | ask | n/a | yes |
| relist | ask | n/a | yes, not on Poshmark |
| delist_after_sale | auto | always; paced on Poshmark | n/a |
| book_pickup | auto | inside the windows at the saved spot | no: outside the windows it is locked |
| buy_label | ask | n/a | yes |
| cancel_sale | ask | n/a | no |
| save_match (save, like or cart on the site) | auto | site allows it (not Poshmark likes) | n/a |
| buy_offer (an offer to a seller) | ask | Nate proposes auto under the buy ceiling; Ben has not answered | Open (§9) |
| share_address | never | locked | no |
| pickup_time outside windows | never | locked | no |
| payment, refund | never | locked | no |
| move_off_site | never | locked; the agent may refuse a buyer's request to go off the site | no |
| price_below_lowest | never | locked ([decisions](../product/decisions.md#2026-11-14-a-price-below-your-floor-always-asks)) | no |
| complete_purchase | never | locked | no |

Every outward action carries an `operation_id` (its idempotency key), is confirmed by reading the site back, and is undone where the site allows. A reconcile job compares our state with each site on a schedule.

## 6. Systems

### Databricks pieces

The decision is Databricks for the whole backend with a hybrid fallback after 2 hours ([decisions](../product/decisions.md#2026-11-14-databricks-runs-the-whole-backend-with-a-hybrid-fallback)). Facts below come from [databricks-platform.md](../research/data/nate/databricks-platform.md), observed in docs unless marked.

| Piece | Job here | Fact and limit | Risk | Test first |
|---|---|---|---|---|
| Apps (FastAPI) | the `/v1` API, policy check, executors' front | Node 22 and Python 3.11; external callers need an `/api/` route, CAN USE and an OAuth bearer; SIGTERM gives 15 s; 100 apps per workspace; timeout and SSE undocumented | phone and webhooks may not reach it; a forum report says unauthenticated calls get a 302 (asserted) | federated token from the phone; unauthenticated webhook; SSE and long requests through the proxy |
| Lakebase | operational truth, pgvector 0.8 | GA, PG 17; scale to zero (60 s to 7 d), wake of a few hundred ms, pools and prepared statements lost; OAuth tokens 1 h, checked at login, not with PgBouncer; 0.5 CU allows 105 connections; LISTEN/NOTIFY lost on scale to zero | cold wake drops pools; RLS keys on a Databricks identity | wake with a pool; RLS with one service principal |
| Synced tables, CDF | Lakebase to Delta for analysis | Continuous sync 15 s minimum, about 150 rows/s/CU; CDF from PG to Delta is Public Preview | lag on By site numbers | sync and CDF latency |
| Volumes | capture files | Files API PUT up to 5 GiB; no presigned URLs | phone upload needs a proxy or a token | signed or proxied upload |
| Delta | comps, events, labels, traces, evaluation sets | Unity Catalog governed | none known | row filters per user |
| Lakeflow jobs | polling orders, inboxes, watches; reconcile | scheduled, table-update and file-arrival triggers; one active run per job | a slow run delays the next | watch every 5 to 10 minutes ([decisions](../product/decisions.md#2026-11-14-watch-alerts-run-on-firecrawl-the-ebay-api-and-a-facebook-search-api)) under load |
| Agent Bricks or a custom agent on Apps | investigate, draft listings, read messages, propose decisions | DurableAgentServer for background work; memory on Lakebase; Knowledge Assistant and Supervisor are Legacy, Supervisor API end of life 2026-09-30 | do not build on Legacy pieces | one agent run end to end with a trace |
| Unity Gateway | every model call | GA with budgets, fallbacks, guardrails; Opus and Haiku 5.5 listed; Seedream not listed; no rate limits documented | studio provider outside the gateway | model availability on our workspace |
| AI Search | product and comp retrieval, similar items | no image embeddings; hybrid returns at most 200; dimension up to 4096 | image vectors are self-managed | pgvector or Delta vectors for photos |
| MLflow 3 | a trace per job, the "why?" timeline, labels | traces in UC Delta; 200 traces/s ingestion; a trace over 25 MB unreadable; `log_feedback` takes HUMAN, LLM_JUDGE, CODE; prompt registry Beta | big image payloads in traces | trace volume at real load |
| Genie | questions over items and sales | per the decision | scoping to one user | a user-scoped space |
| Free Edition (if that is the workspace) | n/a | 3 apps that stop after 24 h, 1 Lakebase project, 5 concurrent tasks, no Direct Vector Access, non-commercial | fails a product that runs all day | which edition we have |

### Front door (Open, §9)

| Option | How | Holds if | Cost |
|---|---|---|---|
| A. Thin public edge | A small public service signs users in, receives marketplace webhooks, issues upload targets, and forwards to the Apps API with a service identity and the user id | Apps cannot take a phone token or an unauthenticated webhook | one more service, holding no data |
| B. Apps direct | The phone sends a federated token (RFC 8693, about 1 h, no refresh token); webhooks hit `/api/` | the tests above pass, including a webhook without Databricks auth | none, if it works |

Webhooks likely need the edge either way, because sites do not send a Databricks token. If Lakebase or Apps fails the 2 hour test, the hybrid fallback moves the app and its database off Databricks and keeps comps, valuation, traces, evaluation and Genie on it.

### Tenant isolation

- The API acts as one service principal. Every table carries `user_id`. Every transaction runs `SET LOCAL app.user_id`, and row security policies compare `user_id` with that setting, so a missed `where` still returns nothing (inferred; test it, since Lakebase RLS keys on `current_user`).
- Delta tables get Unity Catalog row filters on `user_id`; Genie runs over those filtered views.
- Volume paths are `captures/<user_id>/<capture_id>/`, written only by the API.
- Agents receive the user's rows through the API, never a database connection.

### Secrets and marketplace sessions

| Thing | Where it lives | Who reads it |
|---|---|---|
| eBay OAuth refresh token (about 18 months, asserted) | server vault (a Databricks secret scope), referenced by `account.token_ref` | the eBay adapter only |
| Depop OAuth (1 h access, 1 yr rotating refresh), when granted | server vault | the Depop adapter only |
| Browser sessions for sites without an API | the cloud browser's saved profile; the user signs in inside it, we never see or store the password ([decisions](../product/decisions.md#2026-11-14-each-marketplace-gets-its-own-harness-run-on-browser-use-cloud)) | the harness for that site |
| The app's own session | device Keychain | the phone |
| Passwords | never held (the eBay licence also bans storing user IDs and passwords) | nobody |

Tension: Keychain `WhenUnlockedThisDeviceOnly` cannot be read while the phone is locked, but agents run on the server at any hour. Holding marketplace sessions server-side resolves it and raises the stakes of the vault ([privacy-and-data.md](../research/cross-cutting/nate/privacy-and-data.md)). Tokens and cookies never enter a prompt or a log.

### Adapters

One adapter per site behind one internal API: `post, edit, delist, read_listing, list_orders, read_inbox, send_message, list_offers, respond_offer, offer_watchers, search, read_sold`. Each returns a capability table; a missing capability falls back to the cloud browser, then a one-tap handoff. Every site gets a harness, and an official API is used where it is faster or more reliable ([decisions](../product/decisions.md#2026-11-14-its-a-demo-so-build-it)). Facts are from [platform-access.md](../research/connect/nate/platform-access.md), observed unless marked.

| Site | Route | Post, edit, delist | Orders | Messages | Offers | Search, sold data | Rule that bites |
|---|---|---|---|---|---|---|---|
| eBay | API plus harness | Inventory and Offer APIs (unique SKU; relist makes a new item id); end by withdrawOffer or EndItem (asserted) | Fulfillment plus Notification topics | Message API, Trading member messages | GetBestOffers, RespondToBestOffer; offers to watchers through Negotiation | Browse; Marketplace Insights restricted | User Agreement bans LLM bots and buy-for-me agents ordering without human review (effective 2026-06-28 on the live page; Ben's note says 2026-02-20); API licence bans AI training on eBay content, Restricted API output in non-eBay AI without consent, and auto-repricing against other sites; must handle account deletion notices |
| Facebook Marketplace | cloud browser in the US | browser | browser | browser | none found | ScrapeCreators for search (decision) | partner API is EU and EEA only and links out; Meta's Automated Data Collection Terms ban automated collection without written permission |
| Depop | partner API if granted, else browser | products CRUD, mark as sold | orders plus webhooks | none in the API | send offer to likers; no list-offers | likes and bag counts | partner access gated (email first); API terms ban scraping unless authorised; 200 per 10 s create limit |
| Poshmark | browser | browser, paced | browser | browser | browser | browser | ToS bans automated collection; guidelines ban automation, including delete-and-repost, likes, shares and follows; mass suspensions in Nov 2025, lifted within 24 h (asserted) |
| Mercari | browser | browser | browser | browser | browser | browser | no public API (asserted); bots and scrapers banned; may suspend and hold funds; in Ben's set, Open for Nate |
| OfferUp, Grailed | search only | n/a | n/a | n/a | n/a | Firecrawl monitor, Exa, our scrapers, Apify fallback | search and price only ([vision](../product/vision.md)); not in Nate's research |

### Model allocation

Image judgements and text judgements are separate parts of the harness, and the provider for each stays open ([decisions](../product/decisions.md#2026-11-14-image-decisions-and-text-decisions-are-separate-and-the-provider-for-each-stays-open)). Each starts where the [typed judgements decision](../product/decisions.md#2026-11-14-typed-judgements-run-on-both-the-decisions-api-and-jev-and-our-labels-pick) puts it, and labels from taps pick what stays.

| Side | Judgement | Starts on | Note |
|---|---|---|---|
| Image | shot accepted, view missing, defect present, tag readable | OpenAI Decisions API | typed yes, no or score |
| Image | masks, read text, depth and pose | specialist vision models | outputs are `capture` refs |
| Image | identity by look | self-managed image vectors | AI Search has no image embeddings |
| Image | studio relight | Seedream 5.5 | not on the gateway; real photos always kept |
| Image | talk mode | a live video model | shares the shot list ([decisions](../product/decisions.md#2026-11-14-capture-opens-on-the-guided-shot-list-talk-mode-is-one-tap-away)) |
| Text | buyer message intent, scam risk, does a listing match a want | Jev beside a Decisions API run | Jev untested here; labels pick |
| Text | investigate an item | Claude Opus 5.5 | through the gateway |
| Text | listing copy, reply drafts | Claude Sonnet 5.5 | in the seller's voice |
| Text | routing, short classification | Claude Haiku 5.5 | |
| Code | money, units, limits, permissions, state changes, fees | plain code | never a model |

## 7. Contract conventions

The frame's shapes are binding: ids `it_`, `ls_`, `job_`, `dec_`, `ord_`, `want_` (this page adds `cap_`, `ph_`, `att_`, `pr_`, `cmp_`, `val_`, `st_`, `cv_`, `msg_`, `of_`, `ru_`, `mt_`, `ap_`, `gl_`, `ev_`, `rec_`, `acc_`); money `{amount_cents, currency}`; ISO 8601 UTC times; provenance `{value, unit?, source, confidence, evidence[], confirmed}`; range `{low, high, basis_count, as_of, per_site}`, worded per [copy.md](../product/copy.md).

### Requests

| Rule | Shape |
|---|---|
| Auth | `Authorization: Bearer <token>` from the front door (§6). The API derives `user_id`; a client never sends it. |
| Idempotency | `Idempotency-Key` on every POST that creates or acts. The same key and body return the stored response for 24 h; the same key with a different body is `409 idempotency_mismatch`. Outward site actions use the key as `operation_id`. |
| Versions | Every resource has `version`. A write sends it; a stale one is `409 stale` with the current resource. |
| Pagination | `?cursor=&limit=` (limit at most 100). Response `{data: [...], next_cursor}`; `null` when done. Order is newest first unless named. |
| Tracing | `X-Request-Id` in and out; responses include `trace_id` where a job ran. |

### Resources

| Endpoint | Does |
|---|---|
| `POST /v1/captures`, `POST /v1/captures/:id/photos`, `POST /v1/captures/:id/finish` | open a session, get upload targets, finish (returns a research `job`) |
| `GET /v1/items`, `GET /v1/items/:id` | items by state; the full item card with attributes, valuation, strategy, listings, open decisions |
| `PATCH /v1/items/:id/attributes/:name` | the person corrects a fact; stored as `you_said`, confirmed |
| `POST /v1/valuations` | value an item or an outside listing or photo (appraise); returns a `job` |
| `POST /v1/items/:id/strategy` | pick a strategy and set limits |
| `POST /v1/items/:id/listings` | post to sites; returns a `job`; the first post opens a decision unless promoted |
| `GET /v1/decisions?state=open`, `POST /v1/decisions/:id/act` | Today; answer one |
| `GET /v1/conversations`, `GET /v1/conversations/:id/messages`, `POST /v1/conversations/:id/messages` | messages; a person's own reply |
| `GET /v1/orders`, `GET /v1/appointments`, `POST /v1/orders/:id/handed-over` | sales, purchases, pickups and ship-by |
| `GET`, `PUT /v1/limits`; `GET /v1/rules`; `POST /v1/rules/:kind/promote`; `DELETE /v1/rules/:id` | You > Automation and You > Pickups |
| `GET /v1/items/:id/events`, `POST /v1/events/:id/undo` | the "why?" timeline; undo |
| `POST /v1/wants`, `GET /v1/wants/:id/matches`, `POST /v1/matches/:id/save`, `GET /v1/search?q=` | Buy |
| `POST /v1/accounts`, `GET /v1/accounts` | connect a site (returns an OAuth URL or a browser sign-in session); health |
| `GET /v1/insights`, `PUT /v1/goals/:month` | You numbers, By site, goals |
| `GET /v1/stream` | one SSE stream per signed-in user: `decision.open`, `item.state`, `message.new`, `job.stage` |

### Jobs and the event stream

A long call returns `202` with `{id, kind, stages:[{name, state, started_at, ended_at}], result?}` at once. `GET /v1/jobs/:id/events` streams SSE frames `event: stage | result | error`, each with an `id` so `Last-Event-ID` resumes; a heartbeat comment every 15 s. `GET /v1/jobs/:id` returns the same shape for polling, every 2 s. Stage states are `started, running, arrived, failed` ([frontend-standard.md](../product/frontend-standard.md)); [events.json](events.json) `job.state` uses `queued, running, done, failed`. Proposal: the stream sends stage states, the log keeps job states, and the API maps them (Open, §9). SSE through the Apps proxy is untested, so polling must always work.

### Decisions and the act endpoint

`POST /v1/decisions/:id/act` takes `{option_id, signature, version, edit?}`. The signature is an HMAC over decision id, option id, version and user, valid 15 minutes. It returns `{decision, event_id, job?}`. An `edit` marks the answer edited, so it does not count toward promotion. A decision whose item or offer changed returns `409 stale` with its replacement. The policy check reruns on act, so a signed option cannot outlive a lowered limit.

### Errors

`{code, message, failed_step, retry}`, with `retry` as `{by: "auto" | "user" | "none", after_s?}`. `message` is for logs; the app words failures per [copy.md](../product/copy.md).

| HTTP | code | When |
|---|---|---|
| 400 | `invalid` | bad shape |
| 401 | `unauthenticated` | no or expired token |
| 403 | `locked` | a `never` kind attempted without the person's tap |
| 404 | `not_found` | not this user's, or gone |
| 409 | `stale`, `idempotency_mismatch` | version or key conflict |
| 422 | `outside_limits` | an action the policy check refused |
| 429 | `rate_limited` | ours or a site's; `after_s` set |
| 502 | `site_failed` | the site refused or did not read back |
| 503 | `waking` | Lakebase or a job is starting; retry by auto |

## 8. Cross-cutting requirements

| Area | Requirement |
|---|---|
| Logging | One logger in [log/](../log/README.md); [events.json](events.json) is the contract; a new event goes into it and `log/example.mjs` first; the Swift module sends events to JS; logs carry ids, never message text, addresses, tokens or payment details ([5-logging.md](../.agents/team/packets/team/5-logging.md)). |
| Data classes | Highest: marketplace tokens and cookies. High: home address, raw room photos and scans (deleted after cutouts unless kept), buyer name and address (short cache, deleted when the order closes or on an eBay deletion notice), buyer message text. Medium: saved spot, pickup hours, buyer reference hash, traces (short retention, scanned for text). Low: prices, item facts. Listing photos have EXIF stripped; raw GPS stays on the device ([privacy-and-data.md](../research/cross-cutting/nate/privacy-and-data.md) §12). |
| Personal inference | An inferred size or taste is personal data: shown in You and editable ([analytics-and-recommendations.md](../research/data/nate/analytics-and-recommendations.md)). |
| Disclosure | California's bot disclosure law (asserted) and buyer trust both point to disclosure; a seller is liable for the agent's promises (Air Canada ruling, asserted). The choice is Open (§9). Agents never promise anything a limit does not allow. |
| Safety screening | Before any reply: buyer and page text is data, never instruction; off-site payment, overpayment, code and label requests are flagged as scam risk and become decisions; listings are screened for each site's prohibited items; studio edits may clean up, never hide wear, change colour or add accessories. |
| Evaluation | A real-item set of household things across clothes, shoes, electronics, furniture and small goods, each with a tape measure, the tag read by hand, and its eventual sale price. Measured: identify exact-match rate; measurement error in cm per attribute; share of sold prices inside the shown range; time from ＋ to live; edit rate on drafts and replies; Jev against the Decisions API on labelled messages; delist delay after a sale; reconcile mismatches per day; any auto action outside limits (the bar is zero). Model self-confidence is never the measure. |
| Honest analytics | "Based on N sales from <dates>"; "Asking prices of N live listings"; "N people are watching"; "Sold N days after you listed it". Under about 6 sales, show the sales, not a range. Asking sits above sold, and sold-only data has survivorship bias. Sites that hide sold data give only listings we saw disappear, which undercounts. Never sum sites as if complete. Own-listing views only where the site gives them (eBay). Closed marketplaces have no search volume; proxies are watchers, likes, sell-through (defined on screen) and in-app saved searches. |

## 9. Open for Ben and Nate

| Question | Ben | Nate | Recommendation (*agent proposal*) | Depends on it |
|---|---|---|---|---|
| Posting and acting through a cloud browser can get accounts banned (Poshmark, Mercari, eBay rules in §6). Automatic, or one tap? | harness per site on Browser Use cloud ([decisions](../product/decisions.md#2026-11-14-each-marketplace-gets-its-own-harness-run-on-browser-use-cloud)) | "we build one" where a site has none ([words](../product/words.md#2026-11-14-nate-frameworks-and-goals)) | opt-in per site with the rule shown; one tap is the default on Poshmark and Mercari | list, messages, replay, sold |
| Studio photos and honesty | not answered | not answered | always keep the real photos alongside | studio, list |
| Is Mercari in? | in the set ([words](../product/words.md#2026-11-14-platforms)) | "ebay, depop, poshmark, fb marketplace" ([words](../product/words.md#2026-11-14-nate-vision)) | keep it, as browser only, with its rule shown | adapters, connect |
| Tell buyers an assistant is answering? | not answered | not answered | natural voice, a short note on the first automatic message, honest if asked ([handled-by-default.md](../research/messages/nate/handled-by-default.md)) | messages, legal exposure |
| The front door | not answered | not answered | test option B on the real workspace; keep A ready | everything that calls the API |
| Demo or whole product | "it's a demo, so build it" ([words](../product/words.md#2026-11-14-demo-not-production)) | design the whole product ([words](../product/words.md#2026-11-14-nate-frameworks-and-goals)) | each spec designs the whole and carries a demo path line you mark | every feature spec |
| Expo or native | Expo with a Swift camera module ([decisions](../product/decisions.md#2026-11-14-the-app-is-an-expo-app-with-a-native-swift-camera-module)) | research imagined "apple native" | Expo stands as decided unless the camera module test fails | capture, measure |
| Capture: shot list first, or the item picks the mode? | guided first, tap to talk | joint: the item picks | open on the shot list; a rigid item offers the scan from there; talk mode one tap away | capture, measure |
| Buy-side offers under a ceiling: is an agent-sent offer "completing a purchase"? An eBay Best Offer binds the buyer (asserted), and eBay bans buy-for-me agents without human review | not answered | auto under a ceiling ([words](../product/words.md#2026-11-14-nate-store-and-buying)) | ask by default; auto only where the site's rules allow it | buy, watch |
| Nate's proposals not yet answered by Ben: private store, For you and save-sync, cloud browser, monthly goals | not answered | proposed (vision.md Proposed) | keep them in the specs as proposals | buy, insights, connect |
| How price may use eBay data, given the licence bans AI use of Restricted API output and auto-repricing against other sites | not answered | not answered | keep eBay data out of cross-site repricing; use it for eBay prices and display | price, appraise |
| Job state names: stream and log differ (§7) | logging owner | not answered | stream stage states, log job states, map in one place | data, every job |
| Where marketplace sessions live (Keychain or server) | not answered | not answered | server vault and cloud browser profile, with the stakes stated | connect, security |
| How does secondhand earn (a fee, a subscription, a referral, paid data)? | not answered | not answered | none: this is your call | pricing screens, data use, terms |
