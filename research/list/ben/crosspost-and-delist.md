# How will secondhand post to and delist from each marketplace, and survive a failed delist?
Researched 2026-11-14 by Ben (Claude Code). Feature: list.

Question: platform by platform, which route posts, revises and delists an item, how we learn of a sale, and what happens when a delist is slow or fails and a second buyer pays. Feeds the build plan ([packet 4](../../../.agents/team/packets/list/4-posting-messages-dynamic-ui-plan.md)) and `spec/lifecycle.mjs`.

## Draft from memory, and what changed

Draft: eBay is the only official API (Inventory API, `withdrawOffer` to end, Platform Notifications for sales). Everything else goes through Browser Use, polled for sales. Incumbents use Chrome extensions and poll every few minutes.

Changed after searching:
1. **Depop has an official partner API** with OAuth for crosslisters, delete and mark-as-sold endpoints, and order webhooks. Vendoo moved Depop onto it in July 2026 *observed*. So "only eBay has an official listing API" in [decisions.md](../../../product/decisions.md) is out of date. Access needs an email to Depop first *observed*.
2. **eBay has a REST `ORDER_CONFIRMATION` topic** (Notification API 1.6.6, 2025-12-01) carrying `orderId` and `listingId` *observed*. No need for the old Trading Platform Notifications.
3. **eBay listings already show on Facebook Marketplace** (shipped listings, checkout on eBay, no seller action) *observed*. A separate Facebook post is only needed for local pickup.
4. **Poshmark retired its Excessive Listing Removal policy on 2026-07-23** *observed*, so deleting after a sale elsewhere no longer risks that penalty. The risk that remains is the cancellation rate, when a second buyer pays and we must cancel.
5. **Browser Use V4 has no run webhooks**. Completion is read from `eventsUrl`. Human approval means stopping at a checkpoint and continuing with a follow-up run on the same `sessionId` *observed*.

## Per-platform routes

Latency figures are *inferred* unless marked. "Replay" = the replay layer (details in the project's shared folder): Browser Use explores once, later runs call the site's own web endpoints, and on drift we fall back to Browser Use.

| | eBay | Depop | Poshmark | Mercari | Facebook Marketplace |
|---|---|---|---|---|---|
| **Route** | Official API only | Partner API (apply today); Browser Use and replay until granted | Replay, Browser Use fallback | Replay, Browser Use fallback | Rides eBay for shipped items. Local: Browser Use draft, user taps Publish |
| **Post** | Listing API `createListing` with `VALIDATE` dry run, then publish *observed* ([prior note](posting-browser-use-ebay.md)). Or Inventory `createOffer` → `publishOffer` | `POST /api/v1/products/` or `PUT /products/by-sku/{sku}/`, pictures as URLs (1 to 8) *observed* | Browser Use fills form, stops before Post, user approves | Same | Same; Marketplace has no individual-seller API *observed* (Partnerships is for "eligible third-party partners") |
| **Revise price** | `updateListing` (Listing API) or `updateOffer` (Inventory) *observed* (migration guide) | `PATCH /products/by-product-id/{id}/` *observed* | Replay edit | Replay edit | Browser Use edit |
| **Delist** | `endListing`, or `POST /offer/{offerId}/withdraw`, which "ends the listing"; the offer can be published again *observed*. Inventory-made listings must stay on the Inventory API *observed* | `DELETE /products/by-sku/{sku}/` or `mark-as-sold` *observed* | Delete listing (replay). Open offers can block it (below) | Delete or deactivate (replay) | Mark sold or delete (Browser Use) |
| **Sale signal** | Notification API `ORDER_CONFIRMATION` webhook *observed*; poll Fulfillment `getOrders` every 60 s as backstop *asserted* | `v1:order.new` webhook, "best-effort" delivery, signed `X-Depop-Signature` *observed*; poll orders as backstop | No push. Sale email (Gmail push) plus a sold-list poll every 1-2 min through replay *inferred* | Same as Poshmark | No payment on platform for local. "Sold" is a handoff the user confirms; dibs in Messenger |
| **Detect latency** | seconds *asserted*; ≤60 s with poll | seconds when delivered; ≤60 s with poll | ~10-30 s (email push) or ≤2 min (poll) | same | n/a (user taps) |
| **Delist latency** | ~1 s | ~1 s | ~1-3 s replay; 1-4 min Browser Use *asserted* | same | 1-4 min Browser Use |
| **Rate limits** | per-app call limits *asserted* | create/update 200 per 10 s; others 6,000/min per seller; 30,000/min per app *observed* | unknown; pace 1 action per 2-5 s *inferred* | unknown; Nifty notes API posts sometimes create two listings *observed* | unknown; highest bot detection *asserted* |
| **Ban risk** | Low on the API. Browser automation on eBay breaks the User Agreement (below) | Low on the API | Medium: third-party tools linked to Nov 2025 removals *observed*; 3% cancel rate *asserted* | Medium; third-party tool rules unclear *asserted* | High for automation *asserted*; keep the user's tap on Publish |

### eBay details
- Pick one listing API per item and stay on it: "Listings that were created through the Inventory API must continue to use the Inventory API for all operations" *observed* ([migration guide](https://developer.ebay.com/develop/guides/modern-apis-migration-guide.md)). Listing API maps AddItem→`createListing`, ReviseItem→`updateListing`, EndItem→`endListing` *observed*. Listing API sandbox is not confirmed; the Inventory API has one *asserted*. **Recommend the Inventory API for the demo if the Listing API sandbox fails in the first hour** *inferred*.
- A sold single-unit Inventory listing can stay "Active" at quantity 0 with an out-of-stock banner instead of Sold *observed* ([community thread](https://community.ebay.com/t5/RESTful-Sell-APIs-Account/Items-not-being-marked-sold/m-p/34422999)). Read sales from orders, not listing status.
- eBay may mark an item sold before payment (Best Offer accepted, immediate payment off, non-US buyers) *observed* ([Vendoo help](https://help.vendoo.co/en/articles/8833508-why-aren-t-my-sales-being-detected)). Require immediate payment on our listings so "sold" means paid *inferred*.
- Scopes: `sell.inventory`, `sell.account` (policies), `sell.fulfillment` (orders), `commerce.notification.subscription` *asserted*. Consent: authorization-code grant, user token with refresh token *asserted*. Webhook destination is verified by a challenge, and messages are signed *asserted*.
- **User Agreement (posted 2026-01-20, effective 2026-02-20 for existing users):** prohibits "any robot, spider, scraper… or other automated means (including, without limitation buy-for-me agents, LLM-driven bots, or any end-to-end flow that attempts to place orders without human review) to access our Services for any purpose, except with the prior express permission of eBay" *asserted* (quoted by [Value Added Resource](https://www.valueaddedresource.net/ebay-bans-ai-agents-updates-arbitration-user-agreement-feb-2026/); the eBay page I opened still showed the 2021 version). The "orders without human review" part is about buying. "Automated means" covers any agent, including a seller's. API access is the permission. So eBay is API-only, never Browser Use *inferred*.

### Depop details
- Two auth modes: per-shop API keys, or "OAuth 2.0: For third-party applications (such as cross-listing tools)", where the seller approves scopes *observed*. Scopes include `products_read/write`, `orders_read/write`, `offers_read/write` and `shop_read` *observed*. Neither mode is self-serve: "you will need to contact us first" *observed*.
- Webhooks: `v1:order.new`, `v1:order.update`, `v1:order.refund`, `v1:product.update` and more, with self-serve configuration since Aug 2026 *observed*. "Delivered on a best-effort basis… Reconcile periodically" *observed*. The order id is stable per purchase, so it works as a dedupe key *observed*.
- Staging has `POST /products/by-sku/{sku}/purchase/`, a fake purchase *observed*. **Use it to stage a double sale in the demo** *inferred*.
- Depop's 2026 terms accept crosslisting tools, but the seller must remove the item once it sells elsewhere and refund if it sold twice *asserted* ([List Perfectly summary](https://listperfectly.com/?p=11465)).

### Poshmark details
- Excessive Listing Removal policy retired 2026-07-23. Crosslisters had said removals after outside sales "resulted in automated warnings, listing restrictions and suspensions" *observed* ([VAR](https://www.valueaddedresource.net/poshmark-scraps-excessive-listing-removal/)). The decided "paced on Poshmark" still costs little, so keep it.
- Cancellation policy: "Repeated unshipped or cancelled orders will negatively affect your standing" *observed*. A 3% seller-cancel rate over 90 days, a 24-hour freeze and then a 14-day suspension *asserted* ([List Perfectly](https://listperfectly.com/selling/poshmark-suspension-2026/)). The "6-day suspension" in our earlier notes was not found.
- **An open offer can block the delist.** Vendoo edits the listing's size to void the offer, retries, then shows a red warning *observed* ([Vendoo help](https://help.vendoo.co/en/articles/8047348-sale-detection-auto-delist)).
- Nov 2025: mass listing removals and temporary restrictions, with Poshmark pointing to "sellers who use third-party services" *observed* ([VAR](https://valueaddedresource.net/poshmark-listings-deleted-account-suspension/)).

### Browser Use Cloud V4 (for posting, and for delists the replay layer can't do)
- `POST /api/v4/runs` with `task`, `outputSchema`, `sessionId`, `workspaceId`, `keepAlive` (120-14400 s), `secretBindings` (per-domain), `opVaultId`, `judge`, `maxCostUsd`, and `browserSettings.{profileId, proxyCountryCode (default us), record, networkPolicyId}`. The response has `id`, `status` (queued/dispatching/running/completed/failed/cancelled), `sessionId` and `eventsUrl` *observed* ([create run](https://docs.browser-use.com/cloud/api-v4/runs/create-run.md)).
- **No webhook or callback field on V4.** The webhooks page covers V2/V3 only *observed*. Poll `eventsUrl` or the run status from a durable step.
- **Human approval:** run 1 fills the form and stops (`keepAlive` 900). The app shows `live_view_url` from the `browser.ready` event, view-only with `readOnly=true`. On the tap, run 2 with the same `sessionId` presses Post *observed* ([HITL](https://docs.browser-use.com/cloud/agent/human-in-the-loop.md), [live preview](https://docs.browser-use.com/cloud/browser/live-preview.md)). The live URL is a credential: anyone with it can drive the browser *observed*. A busy session returns 409 *observed*.
- Files: workspace uploads are restored under `uploads/`, 50 MiB per file *observed*. Recording: `record: true` gives an MP4 after the browser stops *observed*. Profiles carry cookies; Profile Sync copies them from local Chrome *observed* (prior note).

## How incumbents detect sales and delist

| Tool | Mechanism | Speed | Evidence |
|---|---|---|---|
| Vendoo | Scans every 10 min from the user's open browser tab. Depop (Jul 2026) and Mercari (Apr 2026, testing) moved to direct server integrations | 10 min; "real time" on Depop | *observed* ([help](https://help.vendoo.co/en/articles/8047348-sale-detection-auto-delist), [Depop post](https://blog.vendoo.co/new-depop-api-integration), [Apr 2026](https://blog.vendoo.co/vendoo-product-update-for-april-2026)). Apr 2026 fixed items "incorrectly marked as 'Delisted' while still active" *observed* |
| Crosslist | Cloud for eBay, Depop, Etsy and US Facebook; extension for Poshmark, Mercari, Grailed | "usually… within 15 minutes" | *observed* ([docs](https://docs.crosslist.com/knowledge-base/sales/autodelist)) |
| List Perfectly | Extension on a device that must stay on | setting shown at 2 min | *observed* ([post](https://listperfectly.com/selling/list-perfectly-auto-delist-the-fastest-most-reliable-solution-for-resellers/)) |
| PrimeLister | Auto Sync marks sold "once a day"; Facebook "coming soon" | daily | *observed* ([docs](https://docs.primelister.com/features/cross-lister-tool/auto-delisting)) |
| Flyp, OneShop | not opened | | unreached |

Takeaway *inferred*: incumbents' race window is 2 min to a day, and most need the user's computer awake. Server-side push detection plus API and replay delists can bring it under a minute. That gap is a claim we can measure and show (below).

## The sold → delist pipeline

1. **Signal in.** Webhook (eBay `ORDER_CONFIRMATION`, Depop `v1:order.new`), email push, or poll. Verify the signature, write `sale_events(site, external_order_id)` with a unique key, return 2xx in under 1 s. Duplicates are no-ops. Both eBay and Browser Use warn of duplicate deliveries *observed*.
2. **Confirm paid.** Read the order back (`getOrders`, Depop `GET orders`, sold page via replay). Only a paid order fires `buyerPays`. Unpaid "sold" goes to a hold state (gap G1).
3. **Claim the sale.** One Lakebase transaction: if `item.sale` is null, set it to this listing (`buyerPays`). Otherwise open `refund:i` (a second sale).
4. **Fan out delists in parallel**, one durable job per other live listing, idempotency key `delist:{item}:{site}`. Cancel any in-flight post or revise job for the item first (gap G5). eBay and Depop delist through the API. Poshmark and Mercari go through replay, Browser Use on drift. Poshmark is paced to one action per 2-5 s per account, and only across items: one item's delist never waits *inferred*. Facebook: queue a Browser Use mark-sold, and tell anyone holding dibs.
5. **Verify.** A delist counts only after a read-back shows the listing gone or not buyable (eBay `getOffer`/`getItem`, Depop `GET product` returns 404 or sold, replay GET, or a logged-out page fetch). This is `delistOk` (gap G2).
6. **Retry with backoff.** 5 s, 15 s, 45 s, 2 min, then hand off to Browser Use. Known blockers get their own fix: a Poshmark open offer means void the offer, then delete. An expired login opens a reconnect Decision (gap G6).
7. **Failure stays visible.** After the budget runs out, or 3 min with the listing still buyable, the listing goes to `delistFailed` and the item tile turns red Failed. Its card offers "Try again", "Open on Poshmark" and "Mark unavailable", with a live view link.
8. **Second buyer paid.** `refund:i` is Never alone (payment). The card names both buyers and the cost of each choice: cancelling on Poshmark counts toward the cancel rate, cancelling on eBay risks a defect *asserted*. The user picks which sale to keep (gap G7). The cancel and refund run through the API where one exists (Depop refunds *observed*).
9. **Reconcile** every 5 min: list each site's live listings and diff them against Lakebase. Anything live that should be delisted re-enters step 4. This catches missed best-effort webhooks *observed* (Depop says to do this).

**Race window** = detect(selling site) + delist(other site) + read-back *inferred*:

| Sold on → still up on | eBay | Depop | Poshmark | Mercari |
|---|---|---|---|---|
| eBay (webhook) | | ~3 s | ~5 s replay / ~3 min BU | same |
| Depop (webhook) | ~3 s | | ~5 s / ~3 min | same |
| Poshmark (email/poll) | 15 s-2 min | 15 s-2 min | | 15 s-2 min (+3 min BU) |
| Mercari (email/poll) | same | same | same | |

Benchmarks: Crosslist ≤15 min, Vendoo 10 min, PrimeLister a day *observed*. Log the delist latency as the metric `sold_to_all_down_ms`.

## Edge cases → lifecycle.mjs

| # | Case | What happens | Covered by | Gap |
|---|---|---|---|---|
| E1 | Delist fails, second buyer pays | `delistFailed` stays buyable, `buyerPays` opens `refund:i` | "one kept sale", "failures are visible" | none |
| E2 | Delist slow, second buyer pays mid-delist | `delisting` is not BUYABLE in the spec, but it is on the real site | none | **G2**: `delisting` must be buyable until a read-back confirms |
| E3 | Delist API says OK, listing still live (Vendoo bug) | spec trusts `delistOk` | none | **G2**: add `delistUnverified` (buyable), and `delistOk` only from a read-back |
| E4 | Sale signal missed (best-effort webhook) | nothing fires until reconcile | `settles` assumes instant detection | **G3**: model `paid` but undetected; reconcile action |
| E5 | eBay "sold" before payment / Poshmark offer accepted / FB "pending" | spec has only paid | dibs covers FB only | **G1**: `committed` hold state; delist or pause others? Ben's call |
| E6 | Post times out but actually landed (BU timeout, Mercari double post) | `postFail` then `retry` makes a second live copy | none | **G4**: `postUnknown`; reconcile before retry; dedupe by our SKU in the listing |
| E7 | Markdown or revise in flight when the sale lands; a late Browser Use edit can re-list | `markdown` checks `sale` only at start | none | **G5**: per-site revise jobs cancelled on sale |
| E8 | Login expired or 2FA prompt on delist | auto `retryDelist` loops | "failures are visible" | **G6**: `needsReauth` Decision, user-only, no auto retry |
| E9 | Two buyers pay almost at once | first detected becomes `sale` | "one kept sale" | **G7**: user picks which to keep (cancel cost differs) |
| E10 | Buyer cancels or returns on the sold site | spec has no way back | none | **G8**: `saleCancelled` → relist others (eBay re-publish offer, Depop restock *observed*) |
| E11 | Poshmark open offer blocks the delist | treated as a generic fail | "failures are visible" | handled in the adapter: void offer, retry |
| E12 | Pacing delays a Poshmark delist | window grows | none | adapter rule: delists jump ahead of shares and posts |
| E13 | Duplicate webhook or poll double-counts a sale | unique `(site, order_id)` | n/a | none if keyed |
| E14 | Facebook dibs holder loses to a paid sale | `dibsLost` | "dibs holder told when outbid" | none |
| E15 | Account warned or suspended mid-run | jobs fail | failures visible | **G9**: per-site health on You > Accounts; stop automation on that site |

## On Databricks (decided stack)

- **Apps**: the API, plus webhook routes `/hooks/ebay` (challenge GET and signed POST) and `/hooks/depop`. **Check first**: Apps sit behind Databricks OAuth, and a 2024-25 thread says outside callers couldn't reach them *observed* ([forum](https://community.databricks.com/t5/administration-architecture/authentication-for-databricks-apps/m-p/111919)). eBay can't send a Databricks token. If it fails, put a tiny relay in front (an edge function that verifies the signature and inserts into Lakebase). This is the decided hybrid fallback *inferred*.
- **Lakebase tables**: `listings(item_id, site, external_id, api_route, state, version)`, `jobs(id, kind post|revise|delist|verify|reconcile, site, state, attempt, next_at, idem_key unique, run_id)`, `sale_events(site, external_order_id unique, paid, raw_ref)` and `receipts(job_id, before, after, readback)`. State changes are row-versioned updates, so two workers can't both claim a sale.
- **Agent Bricks / AgentKit durable execution**: workflow `on_sale(item)` with one step per site, plus sleep and retry. It survives restarts while a Browser Use run takes minutes *asserted* ([databricks note](../../data/ben/databricks.md)).
- **MLflow**: one trace per job, with spans `detect`, `claim`, `delist.call`, `delist.readback` and `decision`. The trace id goes in each `item.action` log line (spec/README logging).
- **Jobs**: `reconcile` every 5 min. A Delta view of `sold_to_all_down_ms` p50/p95 per site feeds the You > By site card and the pitch.

## References

| Ref | Job | Keep | Change | Check |
|---|---|---|---|---|
| [Depop partner API](https://partnerapi.depop.com/api-docs/) (webhooks, rate limits, changelog) | mechanism | OAuth for crosslisters, `order.new`, delete, staging purchase | apply for access today; Browser Use until granted | staging purchase fires our webhook |
| [eBay Notification release notes](https://developer.ebay.com/api-docs/commerce/notification/release-notes.html), [ORDER_CONFIRMATION schema](https://developer.ebay.com/api-docs/master/commerce/notification/asyncapi/order_confirmation.yaml) | mechanism | REST sale webhook with `listingId` | backstop poll | sandbox purchase fires within 60 s |
| [eBay migration guide](https://developer.ebay.com/develop/guides/modern-apis-migration-guide.md) | mechanism | one API per listing; `endListing` | | revise and end the same test listing |
| [Browser Use V4 docs](https://docs.browser-use.com/llms.txt) | mechanism, interaction | checkpoint + follow-up run, read-only live view, record | poll, no webhooks | a run stops before Post, 2nd run posts |
| Vendoo / Crosslist / List Perfectly / PrimeLister docs | evidence (benchmarks) | read-back, offer-void trick, red warning | server-side, not "computer must be on" | our p95 beats 2 min |
| VAR Poshmark and eBay articles | evidence (rules) | removal policy retired, cancel risk, UA clause | re-check the primary pages before pitch | open poshmark.com policy page |
| [eBay × Facebook](https://www.ebay.com/sellercenter/news/2025-april/facebook-marketplace) | mechanism | shipped eBay listing = Facebook reach | separate Facebook post only for local | find our sandbox item on FB (prod only) |

## What I searched and couldn't reach

- Raw HTML of eBay, Depop and Browser Use docs through curl: proxy-blocked. I read them through a fetch summarizer, so wording is quoted from its excerpts.
- eBay's live User Agreement page showed the 2021 text. The 2026 clause is from secondary quotes.
- Mercari terms page (fetch error), Poshmark terms, Flyp and OneShop mechanics, Facebook Partnerships eligibility, eBay Listing API sandbox status, Depop webhook retry policy and order endpoint paths, and eBay webhook latency in numbers. None of this proves absence.

## Seed frontier log

- **Loop 1** (seeds: eBay inventory docs, Depop "partner API", eBay UA news). Changed: Depop has an API. Next: Depop webhooks and auth. Contrary lead: is it closed to new partners? (yes: email first).
- **Loop 2** (seeds: eBay Notification release notes, migration guide, Vendoo/Crosslist/LP/PrimeLister help). Changed: REST `ORDER_CONFIRMATION`; Inventory listings locked to Inventory; incumbents 2 min to a day. Next: Poshmark penalties. Contrary: the "6-day suspension" claim (not found).
- **Loop 3** (seeds: VAR Poshmark policy, Browser Use V4 run, HITL and webhooks pages, Databricks Apps networking). Changed: removal policy retired; no V4 webhooks; Apps ingress doubtful. Stop: further searches stopped changing routes.
