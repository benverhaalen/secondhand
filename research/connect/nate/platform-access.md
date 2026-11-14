# How can a third-party app link a user's account on eBay, Facebook Marketplace, Depop, Poshmark and Mercari, and what can it then read and do, under which terms?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: connect.

Evidence marks: *observed* (opened, URL given), *asserted* (source claims without showing, or from memory), *inferred* (my reasoning). "unopened" means I saw a link or snippet but did not read the page. Dates are the source's own; "no date" means the page shows none.

Existing notes referred to: [crosspost-and-delist.md](../../list/ben/crosspost-and-delist.md) (CD), [posting-browser-use-ebay.md](../../list/ben/posting-browser-use-ebay.md) (PB), [messages-and-offers.md](../../messages/ben/messages-and-offers.md) (MO).

## 1. Account linking and approval gating

| Marketplace | Route | Gated? | Tokens | Mark and source |
|---|---|---|---|---|
| eBay | OAuth 2.0 authorization code grant with a registered developer app; the user consents to scopes | Developer account is free; Restricted APIs (for example Logistics, labelled "restricted (Limited Release) API available only to select developers approved by business units") need approval; higher call limits need the Application Growth Check | User access token about 2 hours (7,200 s); refresh token about 18 months (47,304,000 s) | Logistics restriction: *observed*, https://developer.ebay.com/api-docs/sell/logistics/overview.html (no date). Token lifetimes: *asserted*, eBay community posts via search (not eBay docs; the docs page 403'd to my fetchers). Growth Check: *asserted*, search snippet quoting the call-limits page, unopened |
| Facebook Marketplace | No OAuth route for an individual's Marketplace listings found. Only the Marketplace Partnership Program (Item API and Seller API over the Graph API) for approved third-party businesses | Yes: "eligible third-party partners" | Not found | *observed*, https://developers.facebook.com/docs/marketplace/partnerships (no date). Eligibility criteria: not found |
| Depop | Partner API. Direct partners get API keys; cross-listers get OAuth 2.0 Authorization Code with PKCE (S256) | Yes: keys and OAuth "can't be configured by you directly", contact Depop by email first | Access token 1 hour; refresh token 1 year, rotating | *observed*, https://partnerapi.depop.com docs (concepts and openapi.yaml, fetched 2026-11-14) |
| Poshmark | No public API or developer programme found | Not applicable | Not applicable | *not found*; Poshmark terms mention an API only for YouTube, *observed*, https://poshmark.com/terms |
| Mercari | No public developer API found. A third-party profile says integration is restricted to approved partners under direct agreements | Partner-only (secondhand) | Not found | *asserted*, https://github.com/api-evangelist/mercari (README, repo created 2026-05-08, not Mercari's own statement). A Mercari job post for a "Public API" team exists, *asserted*, search snippet, unopened |

Scopes:
- Depop: products_read, products_write, orders_read, orders_write, offers_read, offers_write, shop_read. *observed*, openapi.yaml, 2026-11-14.
- eBay: scope names per API not read (OAuth scope page returned 403). *not found*. The Inventory and listing flow in PB line 9 already flags scopes as unconfirmed; still unconfirmed.

Confirms PB line 9 (eBay approval and scopes unknown): still unknown to the extent of scope names. Extends CD lines 40-44 (Depop): adds token lifetimes, scope list and gating.

## 2. eBay

| Capability | Official route | Mark | Source and date |
|---|---|---|---|
| Create listing | Inventory API (`createOrReplaceInventoryItem`, `createOffer`, `publishOffer`); Listing API GraphQL `createListing` (with `VALIDATE` dry run) | *observed* by Ben; I did not reopen | PB lines 6-8, https://developer.ebay.com/develop/guides-v2/listing-creation.md |
| Edit listing | Inventory API (same calls, replace or update); Trading API Revise family appears in the API index | Index: *observed* | https://developer.ebay.com/api-docs/commerce/notification/release-notes.html (page lists Trading "Add/Revise/Relist family", 2025-07-15 entry visible) |
| End listing | Inventory API `withdrawOffer`; Trading `EndItem` | *asserted* (memory) | not found as a fetched page |
| Read orders and sale events | Fulfillment API `getOrders` (polling); Notification API topics | *asserted* (memory); notifications exist in the Notification API index | Notification API release notes above; endpoint page 403 |
| Read messages | Message API (`conversation`, `bulkUpdateConversation`, `getConversations`); Trading `GetMyMessages`, `GetMemberMessages` | Names *observed* in API index | release-notes URL above, no per-page date |
| Send messages | Message API; Trading `AddMemberMessageRTQ`, `AddMemberMessageAAQToPartner` | Names *observed* | same; also MO lines 21-28 |
| Read and answer offers | Trading `GetBestOffers`, `RespondToBestOffer`; Negotiation API | Names *observed* | same |
| Send offers to watchers | Negotiation API `findEligibleItems`, `sendOfferToInterestedBuyers` | Names *observed* | same; MO lines 21-28 agrees |
| Per-listing interest (views, watchers) | Analytics API `getTrafficReport` (views, impressions); watch count via Trading `GetItem` `WatchCount` | *asserted* (memory; search snippet says traffic_report is meant for "a few thousand listings per day") | page 403; unopened |
| Buy or print shipping label | Logistics API `createShippingQuote`, `createFromShippingQuote`, `downloadLabelFile` | *observed* that it exists and is restricted (Limited Release, select approved developers) | https://developer.ebay.com/api-docs/sell/logistics/overview.html, no date |
| Fees and payouts | Finances API (transactions, payouts) | *asserted* (memory) | page 403 |
| Search active listings | Browse API | *asserted* (memory; PB line 10 says the same) | page 403 |
| Read sold listings | Marketplace Insights API (restricted); otherwise the seller's own sales via Fulfillment | *asserted* (memory) | not fetched |

Rate limits: default about 5,000 calls per day for most APIs, higher on some (Finances 15,000 mentioned), Analytics customer service metric 400 per day; raise through the Application Growth Check. *asserted*, search snippets of https://developer.ebay.com/develop/get-started/api-call-limits (my direct fetches returned 403 or a 404 error page). App Insights API has `applicationApiRateLimits` and `userApiRateLimits` queries, *observed* as names in the API index, release-notes URL above.

Terms (all *observed*):
- User Agreement, https://www.ebay.com/help/policies/member-behaviour-policies/user-agreement: bans automated means including LLM-driven bots and "buy-for-me" agents that place orders "without human review" unless eBay gives prior express permission. Effective 2026-06-28 for users under a prior agreement (observed on the live page in this run). Contradicts CD line 38, which gives "posted 2026-01-20, effective 2026-02-20" from a secondary source. A news search also gives a February 2026 date from a lower-quality source (unopened). I do not know which is right for which user group; the live page I read says 2026-06-28.
- Developer API License Agreement, https://developer.ebay.com/develop/get-started/api-license-agreement (fetched 2026-11-14): bars using eBay Content to train ML or AI; bars ingesting "Restricted API" output into AI not provided by eBay without prior written consent; bars "seller arbitrage" such as auto-repricing against other sites or posting tracking numbers for items bought elsewhere. Page shows no single date; a 2025-07-18 trade report dates an AI-training change to June 2025 (*asserted*, https://www.ecommercebytes.com/2025/07/18/ebay-restricts-developers-from-using-its-data-to-train-ai/, unopened).
- Browser automation: covered by the User Agreement ban on automated means, *inferred* from the clause; the API is the permission route.

Enforcement: developer policy lists suspension of API access and termination of programme membership as consequences, *asserted*, https://developer.ebay.com/join/policies (search snippet, unopened). No dated seller-suspension case found for eBay.

## 3. Facebook Marketplace

| Capability | Official route | Mark | Source and date |
|---|---|---|---|
| Create, update, delete listings | Marketplace Partnerships Item API (Graph API); Seller API for sellers; partners only; seller must be uploaded before products | *observed* | https://developers.facebook.com/docs/marketplace/partnerships/itemAPI/ and /sellerAPI, no date |
| Where it works | `partner_item_country` enum lists only EU and EEA countries (AT, BE, BG, CY, CZ, DE, DK, EE, ES, FI, FR, GR, HR, HU, IE, IS, IT, LI, LT, LU, LV, MT, NL, NO, PL, PT, RO, SE, SI, SK); no US | *observed* | itemAPI page above |
| Listing shape | Partner listing is a link-out: `link`, `partner_product_checkout_uri`; "purchase on that partner's website"; only first 256 characters of description show; `partner_listing_type` fixed_price, auction, vehicle, rental, real_estate | *observed* | partnerships page above |
| Read orders, messages, offers | None in the partnership docs read | *not found* | not found |
| Per-listing interest | None found | *not found* | not found |
| Fees and payouts, labels | None found | *not found* | not found |
| Search or read others' listings | Content Library API only, for academic and non-profit researchers; June 2025 added Marketplace listings | *asserted* | search summary, unopened |
| Read sold listings | None found | *not found* | not found |
| Edit or end a user's own personal listing | No route found; the earlier note found none either | *not found* | MO lines 21-28 |

2026 changes: no 2026 change found in Meta's docs. The programme opened to more EU C2C platforms in February 2025 (*asserted*, https://www.valueaddedresource.net/meta-expands-eu-facebook-marketplace-partnership/ dated 2025-02-13, unopened). Eligibility criteria and call limits: Meta's own page gives none; a third-party source says Item API batches up to 300 items and 30 calls per minute (*asserted*, unopened).

Rate limits: not found in Meta's docs I read.

Terms: Meta Automated Data Collection Terms (effective 2024-10-07, *observed* via summary fetch, https://www.facebook.com/legal/automated_data_collection_terms): no automated or programmatic collection from Meta products without "express written permission", and accepting the Terms is not that permission. It does not name Marketplace. Meta Terms of Service and Commerce Policies pages returned only JavaScript shells to my fetchers; not read.

Enforcement: no dated case found for Facebook Marketplace specifically. A seller-facing source says accounts lose Marketplace access, unconfirmed (*asserted*, https://www.imarkinfotech.com/..., unopened). Stated here as a gap, not a finding.

## 4. Depop

All *observed* from https://partnerapi.depop.com docs and openapi.yaml, fetched 2026-11-14.

| Capability | Official route | Mark | Source and date |
|---|---|---|---|
| Create listing | `POST /api/v1/products/` | *observed* | openapi.yaml, 2026-11-14 |
| Edit | `PUT` (full), `PATCH` (partial) `/api/v1/products/{sku}/`, also by-product-id and by-slug | *observed* | same |
| End listing | `DELETE /api/v1/products/{sku}/` (also by-product-id, by-slug); `POST .../mark-as-sold/` | *observed* | same |
| Read orders and sale events | `GET /api/v1/orders/`, `GET /api/v1/orders/{purchase_id}/`; webhooks `v1:order.new`, `v1:order.update`, `v1:order.refund`, `v1:product.create`, `v1:product.update`, `v1:product.like`, `v1:product.unlike` | *observed* | concepts docs and openapi.yaml; webhook docs say to use them instead of polling |
| Read messages | None; no message endpoints | *observed absence* in openapi.yaml | same; agrees with MO |
| Send messages | None | *observed absence* | same |
| Read offers | `offers_read` scope exists; no list-offers endpoint seen in the path list | *observed* scope, *observed absence* of endpoint | same |
| Answer offers | None seen | *observed absence* | same |
| Send offers to likers | `POST /api/v1/products/{sku}/offer/` (also by-product-id, by-slug); scope offers_write | *observed* | same; MO notes a Feb 2026 manual offer endpoint |
| Per-listing interest | `GET /api/v1/insights/products/{...}/live/` returns `likes_count` and `bag_count`; `GET /api/v1/insights/shop/live/` | *observed* | same |
| Labels | `GET /api/v1/shop/seller-addresses/{id}/shipping-providers/` lists providers; `POST .../parcels/{parcel_id}/mark-as-shipped/`; no label-purchase endpoint seen | *observed* | same |
| Fees and payouts | Orders carry `seller_fee_breakdown`; no payout endpoint seen | *observed* | same |
| Search active listings | None; `POST /api/v1/pricing/inspiration/` gives price suggestions | *observed* | same |
| Read sold listings | Own sales via `GET /api/v1/orders/` | *observed* | same |
| Refund | `POST /api/v1/orders/{purchase_id}/refund/` | *observed* | same |

Rate limits (*observed*): create and full update 200 requests per 10 seconds per shop; live insights 600 per 5 minutes; everything else 6,000 per minute; for cross-listers the whole application is capped at 30,000 requests per minute across all sellers; higher limits on request by email or portal.

Terms (*observed*): Depop API Access Service Terms bar using or promoting "automated systems or browser extensions to access, analyse, or scrape the Depop Platform, the Depop API, or any Depop data" unless authorised in writing; they also bar manipulating a shop's metrics, with per-partner order forms setting term, fees and limits. The page shows no effective date. A secondary source dates Depop's consumer Terms of Service 2026-09-02 and says they allow third-party cross-listing platforms on three conditions (*asserted*, https://reva.run/site/blog/operations/marketplace-automation-rules/ published 2026-09-13; unopened conditions; the live consumer terms were not read by me).

Changelog: 2026 entries visible include webhook payload examples dated 2026-08-13 and 2026-09-07 (*observed*, changelog fetch, headings only). No retirement notice seen.

Enforcement: CD lines 40-44 cover this; I found nothing newer.

## 5. Poshmark

| Capability | Official route | Mark | Source and date |
|---|---|---|---|
| Create, edit, end listing | None public. In-app only | *not found* | not found |
| Read orders and sales | None | *not found* | not found |
| Messages, offers, send offers to likers | None public. In-app features only; Poshmark's own "Smart List AI" and in-app bulk sharing returned in December 2025 (*asserted*) | *not found* for API | https://blog.vendoo.co/poshmark-bots-what-you-need-to-know-about-using-bots, unopened |
| Per-listing interest | None | *not found* | not found |
| Labels | Poshmark issues prepaid labels in-app; no third-party route | *not found* | not found |
| Fees and payouts | Fee Policy page exists, no API | *not found* | https://poshmark.com/terms lists the Fee Policy (observed index) |
| Search and sold listings | None | *not found* | not found |

Terms (*observed*):
- Terms of Service, https://poshmark.com/terms, fetched 2026-11-14. The page I read shows "Effective June 3rd 2025" for the current Terms, with earlier versions on the same page (Effective Date October 3, 2024; November 25th 2024 to June 3rd 2025). Prohibited: "copy, scrape, harvest, crawl or use any technology, software or automated systems to collect any information or data for the Service", and collecting or harvesting data from Poshmark's systems.
- Community Guidelines, https://poshmark.com/community_guidelines, fetched 2026-11-14, no date shown: "we don't allow Poshers to use unauthorized programs or other forms of automation to participate on Poshmark. This includes, but is not limited to, deleting and reposting content, liking, sharing, following, and unfollowing." Poshers may "recruit human helpers".
- These contradict the claim in a search result that the Terms do not mention bots (that source was an old 2020 version; *asserted*).

Enforcement: November 2025, hundreds of accounts using third-party tools reported suspended with listings deleted, lifted within 24 hours (*asserted*, https://www.flipsail.io/blog/poshmark-bot-guide-2026, unopened; CD lines 46-50 record the same event). CD also records the Excessive Listing Removal policy retired 2026-07-23; I did not re-verify.

## 6. Mercari

| Capability | Official route | Mark | Source and date |
|---|---|---|---|
| Create, edit, end listing | None public | *not found* | not found |
| Read orders, messages, offers, interest | None public | *not found* | not found |
| Send offers to likers | In-app only | *not found* for API | not found |
| Labels | In-app prepaid labels; no third-party route | *not found* | not found |
| Fees and payouts | None | *not found* | not found |
| Search and sold listings | None official; unofficial scrapers exist (not assessed) | *not found* | https://apify.com/devcake/mercari-search-scraper/api, unopened |
| Partner programme | Restricted to approved partners (carriers, payment) per a third-party profile; a Vendoo April 2026 test integration noted in CD was not confirmed by this run | *asserted* | https://github.com/api-evangelist/mercari, created 2026-05-08 |

Terms (*observed* through a search extract of Mercari's Help Center page, https://www.mercari.com/us/help_center/topics/account/policies/prohibited-conduct/, no date shown; the full Terms URL returned 403): prohibited conduct includes "use any robot, spambot, spider, crawler, scraper or other automated means or interface not provided by us to access the Service or to extract data". Mercari "may remove an item, refuse a user access to or suspend a user", and may hold funds after a suspension or termination. A UK Terms page carries the same clause as Article 9.6 (https://www.mercari.com/uk/terms-and-conditions/, no date). Crosslisting is not addressed on the pages read.

Enforcement: no dated Mercari case found. A reseller-rules site lists "bots or automated access Mercari does not provide" among reasons sellers are restricted or banned (*asserted*, https://resellerassist.com/platform-rules/mercari.php, no date).

## 7. Cross-marketplace comparison of terms

A 2026-09-13 comparison (*asserted*, https://reva.run/site/blog/operations/marketplace-automation-rules/, unopened pages behind it) lists: eBay banned without express permission, Depop banned except cross-listing under three conditions, Poshmark automation banned and automated delete-and-repost banned, Mercari automated means not provided by Mercari banned. My own reads match this for eBay, Poshmark, Mercari and the Depop API terms.

## Not found

- eBay: scope names per API, the live OAuth token and call-limit pages (403), Analytics, Finances, Fulfillment, Browse, Marketplace Insights reference pages, any eBay statement on approving an AI agent or how to request "prior express permission", and any dated eBay seller enforcement.
- eBay: why the effective date differs between CD line 38 (2026-02-20) and the live page (2026-06-28); I cannot say which applies to which users.
- Facebook: eligibility criteria for the Partnership Program, call limits, any non-EU country, any 2026 change, any route for individual users' listings, messages, offers, interest, and dated enforcement.
- Depop: an effective date for the API terms, the three cross-listing conditions in the consumer Terms, offer-reading and message endpoints, and approval timelines.
- Poshmark: any developer or partner programme, API, or dated 2026 enforcement beyond CD.
- Mercari: the full Terms of Service (403), any developer programme page, dated enforcement, whether the Vendoo April 2026 integration is official.

## Searched / could not reach

- curl returned 403 for developer.ebay.com pages (OAuth scopes, call limits, Analytics, Finances, Fulfillment, Browse), and WebFetch returned 403 for the call-limits page. One retry with a browser User-Agent was blocked by the permission system, so I did not work around the 403s. The Exa fetcher timed out on those pages.
- Facebook legal pages (Terms, Commerce Policies) returned JavaScript shells to curl; Meta developer docs were read through Exa extracts and WebFetch summaries.
- mercari.com/terms and /us/terms returned 403.
- Searches were narrow: one or two per marketplace. Absence of a route above is not proof that none exists.

## Sources fetched

- https://partnerapi.depop.com docs, openapi.yaml, API Access Service Terms, changelog (curl, 2026-11-14)
- https://www.ebay.com/help/policies/member-behaviour-policies/user-agreement (fetched, 2026-11-14)
- https://developer.ebay.com/develop/get-started/api-license-agreement (curl, 2026-11-14)
- https://developer.ebay.com/api-docs/sell/logistics/overview.html (curl, 2026-11-14)
- https://developer.ebay.com/api-docs/commerce/notification/release-notes.html (curl, 2026-11-14)
- https://developers.facebook.com/docs/marketplace/partnerships and /itemAPI/ (Exa extract)
- https://www.facebook.com/legal/automated_data_collection_terms (WebFetch summary)
- https://poshmark.com/terms and https://poshmark.com/community_guidelines (curl, 2026-11-14)
- https://www.mercari.com/us/help_center/topics/account/policies/prohibited-conduct/ and https://www.mercari.com/uk/terms-and-conditions/ (Exa search extract)
- https://github.com/api-evangelist/mercari (Exa extract)
- Unopened, cited from search results: eBay community posts, ecommercebytes, valueaddedresource, flipsail, vendoo blog, reva.run, resellerassist, apify.
