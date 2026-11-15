# eBay harness

eBay's own developer APIs behind the kernel `Adapter` (`../../protocol.ts`). Every verb is `route_kind: 'endpoint'`. Writes are dry by default. A dry write returns the exact documented request, with the token written as `<token from account.token_ref>`, and sends nothing. A non-dry write checks the link, then hands the person the eBay page. Sending writes is designed but not built.

Evidence, all read 2026-11-15. The developer.ebay.com HTML pages answered 403 to the fetcher. Paths, scopes and bodies come from eBay's published OpenAPI contracts for each API (linked from each API's overview at `https://developer.ebay.com/api-docs/<api>/static/overview.html`). Limits come from the [API call limits page](https://developer.ebay.com/develop/get-started/api-call-limits) as indexed that day.

Host: `https://api.ebay.com`. Sandbox: `https://api.sandbox.ebay.com`, set by `Client.env`. Identity uses `apiz.` (`apiz.sandbox.`). Consent uses `auth.ebay.com` (`auth.sandbox.ebay.com`).

| Verb | Design | API call | OAuth scope (`https://api.ebay.com/oauth/api_scope/…`) | Documented limit | Built | Evidence |
|---|---|---|---|---|---|---|
| search | Application token, rows with seller hashed | Browse `GET /buy/browse/v1/item_summary/search` (needs `q` or `category_ids`) | `api_scope` (client credentials) | 5,000/day | built, fixture | [Browse search](https://developer.ebay.com/api-docs/buy/browse/resources/item_summary/methods/search) |
| read item (`readItem`) | Legacy id through `get_item_by_legacy_id` | Browse `GET /buy/browse/v1/item/{id}` | `api_scope` | 5,000/day | built, fixture | [Browse getItemByLegacyId](https://developer.ebay.com/api-docs/buy/browse/resources/item/methods/getItemByLegacyId) |
| search `status:'sold'` | Only when `Client.insights` (approved); otherwise `no_route` with a handoff to the sold-filter search page | Marketplace Insights `GET /buy/marketplace_insights/v1_beta/item_sales/search` | `buy.marketplace.insights` | Limited Release, by approval | built, fixture (both paths) | [Insights overview](https://developer.ebay.com/api-docs/buy/marketplace-insights/static/overview.html) |
| read_storefront | Browse with `filter=sellers:{name}`, in one category (default 11450). Gives rating, review count and active count. Sold count, join date and gross come from the person's signed-in browser session: designed, not built tonight | Browse search | `api_scope` | 5,000/day | built, fixture | Browse search (above) |
| read_listings | Inventory items, then the offers for each SKU (`UNPUBLISHED` is draft; `ACTIVE` is live; `ENDED` with sold quantity is sold, otherwise ended) | Inventory `GET inventory_item`, `GET offer?sku=` | `sell.inventory` | 2,000,000/day | built, fixture | [Inventory getOffers](https://developer.ebay.com/api-docs/sell/inventory/resources/offer/methods/getOffers) |
| post | Three calls: put item, create offer (FIXED_PRICE, EBAY_US), publish. Floor enforced | Inventory `PUT inventory_item/{sku}`, `POST offer`, `POST offer/{offerId}/publish` | `sell.inventory` | 2,000,000/day; 250 revisions per listing per day | dry, fixture | [Inventory publishOffer](https://developer.ebay.com/api-docs/sell/inventory/resources/offer/methods/publishOffer) |
| revise | Price (and quantity) of a published offer. Floor enforced | Inventory `POST bulk_update_price_quantity` | `sell.inventory` | as above | dry, fixture | [bulkUpdatePriceQuantity](https://developer.ebay.com/api-docs/sell/inventory/resources/inventory_item/methods/bulkUpdatePriceQuantity) |
| end | Withdraw the offer | Inventory `POST offer/{id}/withdraw` | `sell.inventory` | as above | dry, fixture | [withdrawOffer](https://developer.ebay.com/api-docs/sell/inventory/resources/offer/methods/withdrawOffer) |
| relist | Publish the withdrawn offer again | Inventory `POST offer/{id}/publish` | `sell.inventory` | as above | dry, fixture | publishOffer (above) |
| read_offers | Best Offers received, buyer hashed. Trading errors arrive in HTTP 200 with `Ack Failure` | Trading `GetBestOffers` (`POST /ws/api.dll`, level 1349) | user token (`X-EBAY-API-IAF-TOKEN`) | 5,000/day | built, fixture | [GetBestOffers](https://developer.ebay.com/devzone/xml/docs/reference/ebay/GetBestOffers.html) |
| answer_offer | Accept, decline or counter. Refused once the 24 h buyer offer has expired (`spec/sites.mjs`). Floor enforced on accept and counter | Trading `RespondToBestOffer` | user token | 5,000/day | dry, fixture | [RespondToBestOffer](https://developer.ebay.com/devzone/xml/docs/reference/ebay/RespondToBestOffer.html) |
| make_offer | Seller offer to interested buyers, checked against `sellerOffer('ebay')`, 4 days. `readEligible` lists which listings qualify | Negotiation `POST send_offer_to_interested_buyers`, `GET find_eligible_items` | `sell.inventory` | not on the limits page | dry, fixture | [Negotiation overview](https://developer.ebay.com/api-docs/sell/negotiation/static/overview.html) |
| read_orders | One row per order: total, plus `item_cents` (the line item cost, which is the accepted offer amount when the sale came from an offer: inferred) | Fulfillment `GET /sell/fulfillment/v1/order` | `sell.fulfillment.readonly` | 100,000/day | built, fixture | [getOrders](https://developer.ebay.com/api-docs/sell/fulfillment/resources/order/methods/getOrders) |
| read_inbox | Who sent the latest message and when. No text or names are kept | Message `GET /commerce/message/v1/conversation`, Identity `GET /commerce/identity/v1/user/` | `commerce.message`, `commerce.identity.readonly` | not found; paced at 3/min | built, fixture | [Message API overview](https://developer.ebay.com/api-docs/commerce/message/static/overview.html) |
| send_message | Reply in an existing conversation only (`conversationId`), so no username appears in the plan | Message `POST /commerce/message/v1/send_message` | `commerce.message` | not found | dry, fixture | same |
| read_stats | Views, impressions and transactions per listing for the last 7 days (Pacific dates) | Analytics `GET /sell/analytics/v1/traffic_report` | `sell.analytics.readonly` | 5,000/day | built, fixture | [getTrafficReport](https://developer.ebay.com/api-docs/sell/analytics/resources/traffic_report/methods/getTrafficReport) |
| save | Add to the watchlist | Trading `AddToWatchList` | user token | 5,000/day | dry, fixture | [AddToWatchList](https://developer.ebay.com/devzone/xml/docs/reference/ebay/AddToWatchList.html) |
| promoted listings (`promotedProposal`) | A lever we propose; always a plan with no send path. `sell.marketing` is not requested at link time | Marketing `POST ad_campaign`, `bulk_create_ads_by_listing_id` | `sell.marketing` | not checked | proposal, fixture | [Marketing overview](https://developer.ebay.com/api-docs/sell/marketing/static/overview.html) |
| notifications | Signature verification and the challenge response live in `events/webhook.ts` (`handleEbayWebhook`). REST has no ITEM_SOLD topic, so a sale is seen through Fulfillment orders. `pushLatency` measures sale-to-event seconds against a poller, on a fixture | Notification API | `api_scope` | not checked | measurement built on a fixture; subscription designed | [Notification overview](https://developer.ebay.com/api-docs/commerce/notification/overview.html) |

**Errors**

| Response | Becomes |
|---|---|
| 401, 403, and Trading 931, 932, 16110 | `auth_expired`, relink |
| 429, and Trading 518, 21919144 | `rate_limited`, waiting `Retry-After` when sent, otherwise until midnight Pacific (the daily reset; *inferred*: eBay documents no Retry-After) |
| 400 or 409 with a documented error | `policy_refused`, kind `ebay_<errorId>:<parameter>`, with eBay's message |
| 404 | `not_found` |
| other 4xx and 5xx | `blocked` |

An empty result is ok and empty.

**OAuth.** An authorization code, then a refresh token. Kernel `connect/ebay.ts` holds them behind `account.token_ref` through the vault port. `consentUrl()` builds the sign-in page; `redirect_uri` is the RuName. An access token lasts 7,200 s and a refresh token about 18 months. Public reads use a client-credentials token, cached in memory only (`appTokenSource`). No token is logged, returned or put into a plan.

## What the API licence requires

- "Every eBay Developers Program application that is making API calls that use/store eBay user data must be subscribed to eBay marketplace account deletion/closure notifications" ([account deletion guide](https://developer.ebay.com/develop/guides/sell/marketplace-user-account-deletion), read 2026-11-15).
- "It is the responsibility of each developer to remove all user data associated with the eBay user specified in the … notification" (same page).
- "You will delete Personal Information when requested by eBay" ([API License Agreement, 2018-10-26 PDF](https://developer.ebay.com/cms/files/api_license_2018-10-26.pdf)).
- "When the eBay Content is no longer publicly available, you must delete it from your Application" (same PDF).

The current licence page was not fetched (it returned 403). Read it before production use. The harness keeps hashes, not buyer names, so a deletion notice has little to remove. The deletion subscription is still required before the first user call.

## Public pages: served to a browser that intercepts nothing (2026-11-15)

The page lane exists by Nate's decision of 2026-11-15, "read ebay pages anyway" (`product/words.md`), and the official API replaces it the day keys exist. `ebayPageAdapters(client)` gives `ebay.search.page` and `ebay.read_storefront.page` (route_kind `page`, 6 a minute). Register them after `ebayAdapters`, so the API serves when keyed and the page route serves otherwise. One listing and the still-listed check are `readItemPage` and `stillUpPage`. Prices are integer cents with their currency.

| Read | Route | Result, live 2026-11-15 | Load ms |
|---|---|---|---|
| search, ebay.com | `/sch/i.html?_nkw=` | 60 rows, USD | 4,468 |
| search, ebay.co.uk with `_salic=1&LH_LocatedIn=1` | fallback when ebay.com answers its error page | 60 rows, GBP, `converted: true` | about 4,060 |
| sold search | `needs_session` | `auth_expired`, `do: relink`, no page loaded | 0 |
| one listing | `/itm/<id>`, JSON-LD Product | 1 row, USD, with watchers | about 4,280 |
| still listed | `/itm/<id>` | `live`; a 404 is `gone` | about 3,490 |
| storefront | `/usr/<name>` | rating, reviews, sold, followers, member since | about 3,290 |

Times are the page load alone; the run waits 5 s between loads and 5 s more before a second host. Recorded, masked pages are in `fixtures/page-*.html` and the tests in `page.test.ts`. `recon.ts <out-dir> [query]` records them again, with the out-dir outside the repo, and they are masked before they become fixtures. The live check is `node --no-warnings app/src/edge/harness/sites/ebay/live-page.ts [query]` (about six loads). Run note: `research/cross-cutting/nate/runs/ad-ebay-page.md`.

- **Nothing is intercepted on eBay.** The first browser run blocked images, media and fonts with `page.route`, and every page came back as eBay's error page: 403, 1,892 B, titled "Error Page | eBay", "SORRY Something went wrong on our end". With nothing intercepted the same pages load. The blocking lived in the scripts, not in the kernel or pool, so `platform.ts` is unchanged.
- **A plain request is refused.** curl with a Chrome User-Agent got 403 (1,739 B, about 110 ms) on search and sold search. It was not tried again.
- **The direct URL beats the search box.** Typing the query into the home page box also works (79 items, 4,037 ms after a 3,047 ms home page), but the direct URL is one load, not two.
- **Sold listings need the person's sign-in on every host.** An anonymous sold search gets the "Sign in or Register" page on ebay.com, ebay.co.uk and ebay.ie. It is read as `auth_expired` with `do: relink`, never as zero results or `page_changed`. The sold parser is designed but untested, since no signed-in page can be recorded.
- **Zero results is an empty list.** eBay fills a no-match page with "Results matching fewer words"; everything after that marker is ignored.
- **Regional hosts are data** (`PAGE_HOSTS`): ebay.com first, then ebay.co.uk with eBay's US location filter. Search moves on only when a host answers the error page. Each row records its `host`, because the kernel's `Meta` has no host field. A regional price is in that host's currency with `converted: true`, never as US cents. A search row leaves the US price absent. That id's listing read on ebay.com gives the USD price. The ebay.co.uk item page has JSON-LD in GBP and also shows a "US $" amount, which is not parsed. The regional run is in `research/cross-cutting/nate/runs/ebay-when-it-serves.md`, "eBay's regional sites".
- A bot check or captcha is `blocked` with `do: pause_session` and ends the run. It is never solved: `solveCaptchas` stays false.

**Terms, all read 2026-11-15.**
- [robots.txt](https://www.ebay.com/robots.txt), version `v30.2_COM_August_2026`, `User-agent: *` group: `Disallow: /sch/`, `Disallow: /sch/i.html?_nkw=`, `Disallow: /sch/i.html?*_nkw=*&`, `Disallow: /*_kw`. Plain `/itm/<id>`, `/str/<name>` and `/usr/<name>` are not disallowed (only query variants such as `/itm/*_nkw`, `/itm/*_pgn=`, `/str/*_sacat`, `/usr/*/followers`).
- The robots.txt header: "The use of robots or other automated means to access the eBay site without the express permission of eBay is strictly prohibited", "Automated scraping, buy-for-me agents, LLM-driven bots, … is strictly prohibited", and "Approved enterprise integrations must use our official API and comply with our API License Agreement".
- [User Agreement](https://www.ebay.com/help/policies/member-behaviour-policies/user-agreement?id=4259), "effective as of June 28, 2026": you may not "use any robot, spider, scraper, data mining tools, data gathering and extraction tools, or other automated means (including, without limitation buy-for-me agents, LLM-driven bots, or any end-to-end flow that attempts to place orders without human review) to access our Services for any purpose, except with the prior express permission of eBay".

With no keyset an API read answers `no_route`. The kernel moves to the next route on `no_route` (`protocol.ts`), so the page route serves behind it.

## Nate's setup: keyset and RuName

1. Sign in at [developer.ebay.com](https://developer.ebay.com) and join the Developers Program.
2. Go to **Your Account → Application Keys**, then create a **Production** keyset (and a **Sandbox** keyset for trials). The Client ID and Client Secret go into the local environment as `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET`. Never paste them anywhere else.
3. Next to the Client ID, click **User Tokens**. Expand **Get a Token from eBay via Your Application**, then **Add eBay Redirect URL**. Confirm the legal contact info.
4. Set the display title, a privacy policy URL, and the accept URL (our `/v1/auth/link` callback) and decline URL. Save. The RuName shown is the `redirect_uri`. There is one RuName for Sandbox and one for Production.
5. Under **Alerts & Notifications**, subscribe to marketplace account deletion with our endpoint and verification token. eBay requires this before production user calls.
6. Optional: apply for Marketplace Insights (Limited Release) to enable sold data.

## Live read

```
node --no-warnings app/src/edge/harness/sites/ebay/live.ts "levis 501" [seller]
```

It runs search, sold search, one item and a storefront once each. It prints `{read, ok, count, ms, error?}` per line, and exits 2 when the keys are absent.

Test: `node --test --test-concurrency=1 app/src/edge/harness/sites/ebay/adapter.test.ts`
