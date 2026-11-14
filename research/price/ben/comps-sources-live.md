# Where do sold comps and active listings actually come from, platform by platform, this weekend?
Researched 2026-11-14 by Ben (Claude Code agent, thread "Plan the build for pricing, search and watch"). Feature: price.

This extends and corrects [sold-price-data.md](sold-price-data.md), [valuation-engine.md](valuation-engine.md), [one-search-box.md](../../watch/ben/one-search-box.md) and [existing-tools.md](../../appraise/ben/existing-tools.md). Method: looped seeded research (five loops, frontier log at the end). API cost is ignored on purpose (demo). ToS risk is stated, not used to refuse. Every claim is marked *observed* (opened the source), *asserted* (source claims it, or memory) or *inferred* (my reasoning). Prices per 1,000 results are the actor page's headline rate on 2026-11-14 and move often.

## The draft I started from, and what changed

Draft (from the earlier notes): "eBay sold comes from scraping the public sold search (LH_Sold) or SerpApi's sold filter; 130point recovers Best Offer prices; the licence may restrict price modelling."

What changed:

1. **eBay's public sold search is now behind a login.** Three independent vendors say so, with dates: SerpApi's changelog (week of Sep 28 to Oct 4, 2026) says "eBay now requires a login to view sold and completed listings" and that `show_only=Sold` and `Complete` "now return an error" (observed, [serpapi.com changelog](https://serpapi.com/blog/serpapi-weekly-changelog-sep-28-oct-04-2026.md); release note "Deprecate Sold and Completed filters", Sep 28 2026, observed, [release notes](https://serpapi.com/ebay-search-api/release-notes)). OpenWebNinja dates the redirect to 22 July 2026 "and applies to every marketplace" (observed, [openwebninja.com](https://www.openwebninja.com/blog/how-to-get-ebay-sold-and-completed-listings)). SoldComps' changelog: Jul 25 2026 "gating sold-listing search results behind a login wall for a portion of traffic", Aug 24 2026 "blocking ... on mobile starting August 18" (observed, [sold-comps.com/changelog](https://sold-comps.com/changelog)). One Apify actor already removed its sold mode: "eBay now requires a signed-in account to view sold and completed listings" (observed, [unfenced-group/ebay-scraper](https://apify.com/unfenced-group/ebay-scraper)). No eBay announcement was found (observed absence in these sources; my search was narrow). **The SerpApi route in the brief is dead.**
2. **The licence is stricter than the blog's reading, and it is about eBay listings specifically.** §9 item 6 bars using eBay Content "either alone or in combination with third-party information, to suggest or model prices for items listed on eBay Sites" (observed). §8.1(b) bars co-mingling eBay Content with non-eBay content in a public display (observed). Both clash directly with the cross-market price slider and the one search box if the eBay data comes from the API. Quotes below.
3. **Best Offer recovery is contested, and 130point says nothing about it.** One vendor (SoldComps) claims accepted amounts via `hydrateBoa`; the most-used Apify eBay sold actor says eBay "does not disclose the accepted offer" and only flags `isBestOfferAccepted`. OpenWebNinja agrees with the actor. Details in the eBay section.
4. **Depop keyword search is the hard one, not Poshmark.** Poshmark and Mercari expose sold items to logged-out search; Grailed exposes sold prices through its Algolia search; Depop's search API returns 403/410 to server-side callers and Depop actors give a sold flag but no sold price or date.

## eBay

### What eBay's own API licence says (read from the text itself)

Source: eBay API License Agreement, last updated June 26, 2023 (observed, [developer.ebay.com/join/api-license-agreement](https://developer.ebay.com/join/api-license-agreement); section numbers are partly lost in the page's formatting, so they are my reading of the order).

- §9 lead-in: "For example, you will not, and you will not facilitate or enable others to:" (observed)
- §9 item 5: "Display eBay Content relating to the performance of any eBay Service relative to the performance of any third-party service (for example, sales volume, velocity, etc.)." (observed)
- §9 item 6: "Use eBay Content, either alone or in combination with third-party information, to suggest or model prices for items listed on eBay Sites." (observed)
- §9 item 7: "Use eBay Services to promote or engage in seller arbitrage (for example, automatically repricing eBay listings in response to price changes on competitor sites ...)." (observed)
- §8.1(b) Public Display: "eBay Content in a Public Display may not be co-mingled or combined with non-eBay Content. For example, all eBay Content in a Public Display must be visually isolated from third-party listings or other non-eBay information." (observed)
- §8.1(c) Age: "Displayed item listing information may not be more than six (6) hours older than information displayed on the eBay Site, and other eBay Content must be no more than twenty-four (24) hours older ... If your displayed item listing is not as current as the listing on the eBay Site, you will disclose on your Application how much older your displayed item listing is." (observed)
- §9 item 8 bars to "copy, store or modify eBay Content"; §3.1(b) allows "limited intermediate copies ... only as necessary to perform an activity permitted" (observed).
- The licence says nothing about scraping (observed absence). Scraped pages fall under eBay's User Agreement instead, which I did not open this loop (unopened).

What it means (inferred): for API-sourced eBay data, (a) suggesting a price for an item the user will list on eBay is exactly what item 6 names; (b) showing "eBay sells faster than Depop" is item 5; (c) a merged search grid with eBay cards next to Depop cards is §8.1(b); (d) cached eBay listings older than 6 hours need an age label. For the demo this is a stated risk. For a product, eBay data in the price engine needs a partner agreement or a licensed reseller of sold data, and eBay cards in search need their own visually separate group.

### eBay routes

| Route | Sold or active | Fields | Latency | Cost | Freshness | ToS risk | Evidence |
|---|---|---|---|---|---|---|---|
| **Browse API** `GET /buy/browse/v1/item_summary/search` | Active only | title, price, currentBidPrice, bidCount, buyingOptions, condition, conditionId, shippingOptions.shippingCost, itemCreationDate, itemEndDate, seller (username, feedback), itemLocation, image, epid, categories, watchCount (needs App Check). Max 200 per page, 10,000 per query; FIXED_PRICE only unless `buyingOptions` filter set | About 1 s (asserted, from memory) | Free; 5,000 calls/day for all Browse methods | Live | Licence §9.6 and §8.1(b) above. "Buy APIs require an additional license"; production use "intended for eBay partners only", via EPN application (observed). In practice a fresh keyset gets Browse search (asserted: secondhand-mcp ships with only client credentials) | observed, [search method](https://developer.ebay.com/api-docs/buy/browse/resources/item_summary/methods/search), [call limits](https://developer.ebay.com/develop/get-started/api-call-limits), [buy requirements](https://developer.ebay.com/api-docs/buy/static/buy-requirements.html) |
| **Browse API** `POST /item_summary/search_by_image` | Active only | Same itemSummary shape; body takes a Base64 image | Not stated | Free, same quota | Live | Same | observed (endpoint listed on the Browse overview); Base64 body and "free with your existing OAuth token" asserted by an April 2026 Indie Hackers post whose "tripled accuracy" title is not backed by any metric in the post ([indiehackers](https://www.indiehackers.com/post/i-found-an-ebay-api-endpoint-that-tripled-my-pricing-accuracy-overnight-d9f1acc5db)). Release status (experimental or not) not found |
| **Marketplace Insights API** `item_sales/search` | Sold, 90 days | Sales history (field names not confirmed; the method page redirected to a sign-in page) | n/a | n/a | 90 days | "(Limited Release) API available only to select developers approved by business units"; categories approved per partner | observed, [MI overview](https://developer.ebay.com/api-docs/buy/marketplace-insights/static/overview.html). Not reachable this weekend (inferred). Vendors say "restricted and not open to new users" (asserted, Scavio) |
| Finding API `findCompletedItems` | Was sold | n/a | n/a | n/a | n/a | Deprecated 2024-01-04, decommissioned 2025-02-05 | observed (community post by user "shipscript", not eBay staff, [thread](https://community.ebay.com/t5/Traditional-APIs-Search/Alert-Finding-API-and-Shopping-API-to-be-decommissioned-in-2025/m-p/34517184)) |
| **Public sold search page** (`LH_Sold=1&LH_Complete=1`) logged out | Sold | n/a | n/a | n/a | n/a | Redirects to signin.ebay.com since Jul to Aug 2026 | observed (three vendors, see above); I could not test it, the shell has no internet |
| **Same page, signed in** (our own browser agent or scraper with an eBay session cookie) | Sold, 90 days | Title, sold price (asking price on Best Offer sales), sold date (date only), shipping, condition, format, item ID, image | One page per query, seconds (inferred) | Free | 90 days | eBay User Agreement bars automated access (asserted, unopened); risks the account (inferred) | observed that it works signed in (openwebninja: "Browsing sold listings in your own browser still works"). SoldComps accepts an `X-eBay-Cookies` header to forward your session (observed) |
| **SerpApi eBay engine** | Active only now | `price.raw/extracted`, `condition`, `shipping` (text), `buying_format`, `quantity_sold` (count on multi-quantity listings), seller, watchers; `_ipg` 60/120/240 | 0.95 to 3.18 s in examples | Plan-based; cached 1 h results free | Live | Low for us (SerpApi carries scraping risk) | observed: "The `Sold` and `Complete` options are deprecated and no longer supported" ([serpapi.com/ebay-search-api](https://serpapi.com/ebay-search-api)); page header showed "API uptime 88.532%" (observed) |
| **Apify `caffein.dev/ebay-sold-listings`** | Sold, 1 to 90 days | itemId, url, epid, title, category, condition, conditionId, endedAt (date only), soldPrice, soldPriceMax, buyItNowPrice, soldCurrency, totalPrice, listingType, **isBestOfferAccepted**, bidCount, shippingPrice, shippingType, images, seller fields, scrapedAt. Input: keywords (1 to 6), daysToScrape, count, categoryId, ebaySite (8), condition, aspectFilter, exactMatch | Actor run, tens of seconds (inferred) | From $2.50 per 1k | Modified 2026-11-11; 4.8K users, 923 monthly active | Scraping; the actor page does not say how it passes the login wall (observed absence) | observed, [apify.com/caffein.dev/ebay-sold-listings](https://apify.com/caffein.dev/ebay-sold-listings). That it still returns sold rows after the wall is inferred from the 2-day-old update and active users, not tested |
| **SoldComps API** (sold-comps.com) | Sold (eBay; also Poshmark sold) | price, soldPrice, soldPriceMax, buyItNowPrice, endedAt (date only), best-offer hydration (`hydrateBoa`: "soldPrice updated to the actual accepted offer amount"), currentPrice for active; 60/120/240 per page | Not stated | $3 per 1,000 requests; free 100/month | Live scrape | Vendor scrapes; "shipped a workaround that bypasses the login wall" | observed (vendor changelog). BOA accuracy asserted by the vendor and contradicted by others (below) |
| **CompsAPI** | Sold (eBay) | `/v1/sold`, `/v1/comps` (stats plus ten newest); rows: title, price, best_offer, last_sold, format, shipping_cost, url | Not stated | Free 100/month, paid from $9 | "up to three years of sales history" | Vendor; source of 3-year data not explained | observed ([jentic listing](https://jentic.com/apis/compsapi.com/compsapi.md)); fields from the author's own dev.to post (asserted, self-interested) |
| **Underpriced API** | Sold (eBay US or UK) and photo pricing | `GET /api/v1/sold-comps?q=` → count, summary, recent[title, price, soldDate, url, condition, saleType, bids, shipping, location, itemId]; `POST /api/v1/price` with `image_url` → price estimate, low, high, fast/market/patient list prices, net after eBay fees, worthIt | Not stated | Free 100 lookups/day; 2 cents per sold-comps search | Live | Vendor | observed ([underpricedai.com/developers](https://underpricedai.com/developers)) |
| OpenWebNinja Real-Time eBay Data API | Sold and active | `accepts_offers` without a cookie; `best_offer_accepted` with a cookie; price on BOA sales is asking | Not stated | Not opened | Live | Vendor | observed (vendor blog). Pricing unopened |
| **130point** | Sold, eBay only, 90 days | Up to 10,000 results over 100 pages | Website | Free | 90 days | No API | observed ([130point.com/sales](https://130point.com/sales/)): page says nothing about Best Offer, login changes or an API |
| Terapeak (Seller Hub) | Sold, up to 3 years | Averages, sell-through | Manual | Free for sellers | 3 years | No API or export; daily caps reported | asserted (dev.to post, Oct 2026; earlier note) |

### Best Offer accepted price: what is actually known

- eBay search results show the asking price on a Best Offer sale (asserted by OpenWebNinja: "eBay does not publish the accepted amount"; asserted by caffein.dev: "`soldPrice` shows the asking price for BOA sales").
- SoldComps says the opposite since Sep 5 and Oct 6, 2026: accepted amount via `hydrateBoa` and on `/v1/item/{itemId}` (observed claim, unverified).
- 130point's page does not mention Best Offer (observed). hobbyDB's help page says "130point.com provides another way to see accepted Best Offer prices" (observed, undated, [hobbyDB](https://help.hobbydb.com/support/solutions/articles/36000343715-adding-ebay-best-offer-price-points)). A 2021 forum thread shows 130point breaking when eBay moved the field it read from page source (observed, [elitefourum](https://www.elitefourum.com/t/130point-not-working/32232)), so the method is a page-source field, not an API (inferred).
- SerpApi exposes only a "accepts offers" format filter, no accepted price (observed).
- Practical rule (inferred): flag `isBestOfferAccepted` rows, down-weight them or apply a per-category discount learned from the rows where SoldComps returns an accepted amount, and show "sold via offer, price may be lower" on the comp. The CompsAPI author's "20 to 40 percent" inflation figure is a vendor claim (asserted).

## Poshmark

Sold items are public: logged-out search can filter to `availability=sold_out` (observed, kulqiz actor reads "Poshmark's search response directly ... filtered to `availability=sold_out`").

| Route | Sold or active | Fields | Latency | Cost | Freshness | ToS risk | Evidence |
|---|---|---|---|---|---|---|---|
| **Apify `kulqiz/poshmark-sold-comps`** | Sold (default) | soldPrice (= listing price at sale), soldDateObserved, originalRetailPrice, size, brand, condition, category, daysToSell, images; plus per-search aggregate (median, p25, p75, median days to sell, suggested list price). Input: searchQueries, brand, department, category, sizes, conditions, soldOnly, maxItems | About 48 comps per request, no browser | From $1.50 per 1k | v0.5.5, tested Sep 2026; 6 users | Scraping; "Poshmark's 403 blocking is the main operational risk" | observed ([apify](https://apify.com/kulqiz/poshmark-sold-comps.md)) |
| Apify `solidcode/poshmark-scraper` | Sold or available | soldPrice, soldAt, status, originalPrice, size, brand, conditionLabel, listedAt, daysToSell | n/a | From $2.00 per 1k | Undated; 6 users | Scraping | observed ([apify](https://apify.com/solidcode/poshmark-scraper.md)) |
| SoldComps API | Sold | Up to 48 per page | n/a | $3 per 1k requests | Live | Vendor | observed (changelog, Aug 9 2026) |
| secondhand-mcp `poshmark.ts` | Active only | Calls `https://poshmark.com/search` (query, type=listings, sort_by, condition, department, category_v2, brand[], size[], color[]) and `/listing/<id>` via puppeteer, up to 8 retries with IP rotation; parses id, title, price, url, image; description and seller from detail. No sold, size, brand or original price | Seconds | Free | Live | Scraping | observed ([raw source](https://raw.githubusercontent.com/jlsookiki/secondhand-mcp/main/src/marketplaces/poshmark.ts)) |

Note (asserted by the actor): Poshmark has no separate final amount, so sold price is the last listed price; accepted offers are invisible.

## Mercari (US)

Sold items are public: the search "Sold" facet groups status 2 (trading) and 3 (sold_out) (observed, devilscrapes FAQ).

| Route | Sold or active | Fields | Latency | Cost | Freshness | ToS risk | Evidence |
|---|---|---|---|---|---|---|---|
| **Apify `devilscrapes/mercari-sold-listings`** | Sold (`soldOnly`, `soldWithinDays` 1 to 365) | item_id, title, price, original_price, status, sold, condition, brand, category, shipping_payer, photos; with `includeDetails`: sold_date ("a last-status-change proxy, not a guaranteed sale instant"), listing_date, seller | One extra request per row for dates | From $2.20 per 1k | Mercari purges sold items older than about a year; 45.2% of runs succeeded | Reads server-rendered pages, US residential proxy default | observed ([apify](https://apify.com/devilscrapes/mercari-sold-listings.md)) |
| Apify `crawlerbros/mercari-poshmark-depop-scraper` | Mercari sold via `itemStatus`; Poshmark and Depop active only | price, originalPrice, brand, condition, sizes, status, created/updated | Mercari search uses headless Chromium (slow) | From $3.00 per 1k | 2 users | "Mercari's API is gated" | observed ([apify](https://apify.com/crawlerbros/mercari-poshmark-depop-scraper.md)) |
| Kaggle Mercari Price Suggestion data (2018) | Listings with price | name, condition, category, brand, shipping, description | Offline | Free | 2018 | Kaggle terms | earlier note (observed); useful only to backtest |

Low success rate on the only sold-focused actor is a demo risk (inferred). Pre-fetch Mercari before the demo.

## Depop

Sold items show on seller shop pages; keyword search for sold is not available to server-side callers (observed: bovi says "Depop's search API returns HTTP 410"; secondhand-mcp says `webapi.depop.com` "now returns 403 to server-side requests").

| Route | Sold or active | Fields | Latency | Cost | Freshness | ToS risk | Evidence |
|---|---|---|---|---|---|---|---|
| Apify `khadinakbar/depop-scraper` | Active with `isSold` flag | Keyword `search` mode; tries the public search API, falls back to a browser page. `isSold` ("sold or unavailable"); no sold price or date | Browser fallback, slow | From $5.00 per 1k | Modified 2026-10-19; 18 users | Scraping | observed ([apify](https://apify.com/khadinakbar/depop-scraper)) |
| Apify `bovi/depop-scraper` | Sold per seller (`includeSold`) | price (listing price), `sold` boolean, brand, size, category, likes; no keyword search, no condition, no dates | n/a | $2.50 per 1k sold | 1 user, 0.0% success shown | Scraping | observed ([apify](https://apify.com/bovi/depop-scraper.md)) |
| secondhand-mcp `depop.ts` | Active only | `https://www.depop.com/search/?q=` and `/products/<slug>/` via puppeteer; price from card text regex; no size, brand or sold | About 5 s | Free | Live | Scraping | observed ([raw source](https://raw.githubusercontent.com/jlsookiki/secondhand-mcp/main/src/marketplaces/depop.ts)) |

Inferred: Depop sold comps by keyword are not reliably available this weekend. Use Depop for active listings and for crosslisting; price Depop with a channel ratio learned from Poshmark and Grailed sold rows in the same category, and widen the range (as [valuation-engine.md](valuation-engine.md) step 3 already allows).

## Grailed (search and price only)

Sold prices are exposed through Grailed's own Algolia search backend (observed, two actors say so).

| Route | Sold or active | Fields | Latency | Cost | Freshness | ToS risk | Evidence |
|---|---|---|---|---|---|---|---|
| **Apify `jongoose/grailed-scraper`** | Sold via `sort` (Sold items, sold price high/low) | "sold price, sold date ... and price-drop history" (field names not shown) | Fast (Algolia JSON, datacenter proxy enough) | From $2.20 per 1k | 9 users | Public Algolia key (inferred), still scraping | observed ([apify](https://apify.com/jongoose/grailed-scraper.md)) |
| Apify `bovi/grailed-listings` | Sold and active | sold_price (final), sold flag, price_drops, size, designers, condition, created_at; **no sold date** | Fast | From $3.88 per 1k | Sample row 2026-11-01; 6 users | Same | observed ([apify](https://apify.com/bovi/grailed-listings.md)) |

Inferred: calling Grailed's Algolia index directly from our server is the fastest sold route of any platform, if the app ID and search key can be read from grailed.com's page source. Not verified (lead left open).

## Facebook Marketplace

Facebook shows asking prices; sold listings disappear within days (observed, unseenuser: "most sold listings are removed within days"). There is no sold price, only "this listing is now marked sold" at its last asking price (inferred).

| Route | Sold or active | Fields | Latency | Cost | Freshness | ToS risk | Evidence |
|---|---|---|---|---|---|---|---|
| **secondhand-mcp `facebook/`** | Active; `showSold` keeps rows with `is_sold`/`is_pending` | POST `https://www.facebook.com/api/graphql/` with form `variables` + `doc_id`, no cookies, Chrome UA; falls back to the logged-out HTML search page when GraphQL is gated. Parses id, `listing_price.formatted_amount`, primary photo, seller name, city/state; drops `[SOLD]` titles | Fast (single HTTP) | Free | Live | Meta terms bar automated collection (asserted, unopened); "doc_id values may need updating" | observed ([transport.ts](https://raw.githubusercontent.com/jlsookiki/secondhand-mcp/main/src/marketplaces/facebook/transport.ts), [parse.ts](https://raw.githubusercontent.com/jlsookiki/secondhand-mcp/main/src/marketplaces/facebook/parse.ts)) |
| Apify `unseenuser/fb-marketplace` | Active (`is_sold` flag) | price, strikethrough_price (original before markdown), is_sold, city, state; with details: creation_time, days_on_market, lat/long. Input: queries, city or lat/long, radiusKm, price, condition, dateListed, availability, monitorMode | n/a | $3.50 per 1k (from $2.00) | 31 users, 100% success | Scraping | observed ([apify](https://apify.com/unseenuser/fb-marketplace.md)) |
| Apify `memo23/facebook-marketplace-status-check` | Status of listings we already track | status ACTIVE/SOLD/PENDING/INACTIVE/REMOVED, price, createdAt, checkedAt | n/a | $0.30 per 1k checks | 31 users, 99% success | Scraping | observed ([apify](https://apify.com/memo23/facebook-marketplace-status-check.md)) |

Inferred: a "sold-ish" local comp can be built by watching listings ourselves: record price and first-seen, re-check with the status actor, and treat ACTIVE to SOLD within N days at last price as an upper-bound sale. This doubles as the watch feature's price-drop feed (strikethrough_price is already a drop signal).

## OfferUp (search and price only)

No sold data found in any route (observed absence on the actor pages I opened).

| Route | Sold or active | Fields | Latency | Cost | Freshness | ToS risk | Evidence |
|---|---|---|---|---|---|---|---|
| Apify `crowdpull/offerup-scraper` | Active | price, isFirmPrice, locationName, condition; postDate only with includeDetails. Input: searchQuery, location or lat/long, radiusMiles, price, condition, sortBy, delivery | About 50 per request via "OfferUp's internal GraphQL API" | From $2.50 per 1k | 68 users, 100% success | Scraping; residential proxies recommended | observed ([apify](https://apify.com/crowdpull/offerup-scraper.md)) |

## Category APIs

| Route | Sold or active | Fields | Latency | Cost | Freshness | ToS risk | Evidence |
|---|---|---|---|---|---|---|---|
| **Discogs** price suggestions (records) | Model price **per grade** | Keyed by "Mint (M)", "Near Mint (NM or M-)", "Very Good Plus (VG+)" ... "Poor (P)", each `{currency, value}`. Needs auth and "the user needs to have filled out their seller settings" | API call | Free; 60/min authenticated | Current | Official API | observed ([discogs.com/developers](https://www.discogs.com/developers)). Corrects the earlier note: per-grade is now confirmed |
| Discogs marketplace stats | Active | lowest_price, num_for_sale, blocked_from_sale | API | Free | Live | Official | observed (same) |
| **PriceCharting** `/api/product`, `/api/products` | Model price from sales | loose-price, cib-price, new-price, graded-price, box-only, manual-only, condition-9..22 (graded cards/comics), retail buy/sell, sales-volume; pennies; lookup by id, upc or q | 1 call/s | Paid subscription | Current only; "Historic prices and historic sales are not supported" | "licensed for internal use only"; showing it in an app others use needs a commercial license | observed ([api docs](https://www.pricecharting.com/api-documentation)) |
| StockX official API (StockX Developers) | Bid/ask on your own variants | Catalog and selling endpoints with market data (lowest ask, highest bid per variant) | API | Free with approval | Live | "Geared toward established high-volume sellers" (2023) | observed ([StockX press, 2023](https://stockx.com/about/en-ca/stockx-expands-access-to-suite-of-seller-tools-helping-more-customers-grow-their-businesses)); methods from the unofficial SDK [cyberoby/stockx.py](https://github.com/cyberoby/stockx.py) (observed). Approval this weekend unlikely (inferred) |
| Apify `memo23/stockx-search-scraper` | Market data | lowestAsk, highestBid, lastSale (no date), salesLast72Hours, last90DaysSalesCount; no per-size | n/a | From $2.00 per 1k | 21 users | Scraping | observed ([apify](https://apify.com/memo23/stockx-search-scraper.md)) |
| GOAT | n/a | n/a | n/a | n/a | n/a | n/a | not researched this loop (lead left open) |
| Flipper Vintage (300M+ sold listings) | Sold, many platforms | n/a | n/a | n/a | n/a | n/a | No API found (observed absence in one search; ChannelX July 2026 write-up is the only source, asserted) |

## Recommended demo source stack (agent proposal)

Inferred from everything above. Priority order, with the fallback for each. Pre-fetch a seed set for the three demo categories on Saturday, store it in the index with `source`, `fetched_at` and `price_basis` (sold, sold-at-list, ask, model), and hit live routes only for the user's own query on stage.

1. **eBay active and photo search: Browse API** (`search` and `search_by_image`). Free, official, 5,000/day. Fallback: SerpApi eBay engine (active only). Label eBay results as a separate group in search (§8.1(b)) and stamp age if cached over 6 hours (§8.1(c)).
2. **eBay sold: Apify `caffein.dev/ebay-sold-listings`** for the seed set (most used, updated 2 days ago, has `isBestOfferAccepted`, shipping and date). Fallback A: SoldComps API (also tries BOA amounts). Fallback B: Underpriced `sold-comps` (100 free a day, includes photo pricing to compare against ours). Fallback C: our own signed-in browser agent on the sold page, with a throwaway account. Run a 5-minute smoke test of A and the actor tonight, since the login wall moved under several vendors this summer.
3. **Poshmark sold: Apify `kulqiz/poshmark-sold-comps`** (it already returns p25, p50, p75 and days to sell, which is our response shape). Fallback: `solidcode/poshmark-scraper`, then SoldComps.
4. **Grailed sold: Apify `jongoose/grailed-scraper`**, or Grailed's Algolia index directly if the key is visible. Fallback: `bovi/grailed-listings` (no dates).
5. **Mercari sold: Apify `devilscrapes/mercari-sold-listings`** with `includeDetails` for dates, pre-fetched only (45% run success). Fallback: `crawlerbros` multi-site actor.
6. **Category anchors:** Discogs per-grade suggestions for records (free, official, condition-aware, a strong on-stage moment); PriceCharting for games if someone pays for a month.
7. **Active fan-out for search and watch:** secondhand-mcp's Facebook GraphQL path (free, fast), Apify `crowdpull/offerup-scraper`, `khadinakbar/depop-scraper` (search with `isSold`), Browse API. Watch: re-check tracked items with `memo23/facebook-marketplace-status-check` and diff prices.
8. **Depop pricing:** no sold source; translate from Poshmark and Grailed sold with a category channel ratio and a wider range, labelled.

What to say on stage (inferred): "Comps are real sold listings from eBay, Poshmark, Mercari and Grailed, pulled through research-grade scrapers; production uses licensed data." The licence clauses above make the API-only eBay route a worse production story than it looked.

## Frontier log

**Loop 1. Seed: the eBay API License Agreement text** (cue: primary legal text the earlier note only had second-hand).
- Changed: §9 item 6 is narrower and sharper than the blog's "§9.5" ("for items listed on eBay Sites"); found §9 item 5 (cross-service performance) and §8.1(b) (no co-mingling) which hit the one search box and channel comparison directly; §8.1(c) allows stale data with disclosure. Browse is 5,000/day; MI is still Limited Release; Finding API decommission confirmed by a community post.
- Next lead: does any route still give eBay sold without the API? Contrary lead: SerpApi docs.

**Loop 2. Seed: SerpApi's eBay engine docs page** (cue: a vendor's parameter list is concrete and dated).
- Changed: `show_only=Sold/Complete` "deprecated and no longer supported". Followed to the changelog: "eBay now requires a login". Searched against it and found three more independent vendors (SoldComps, OpenWebNinja, Scavio) and an Apify actor that removed sold mode. The draft's eBay sold route was wrong.
- Next lead: which actors still return sold; who recovers Best Offer. Contrary lead: 130point's own page and a practitioner thread on it breaking.

**Loop 3. Seed: Apify actor input/output pages** (cue: inspectable schemas with field names, user counts and update dates).
- Changed: caffein.dev's eBay actor is current and flags `isBestOfferAccepted` but says eBay hides the amount; SoldComps claims the amount; 130point's page is silent; a 2021 thread shows 130point reads a page-source field. Poshmark, Mercari and Grailed have sold routes with dates or proxies; Depop and OfferUp do not.
- Next lead: secondhand-mcp's actual code paths. Contrary lead: whether Depop exposes sold at all.

**Loop 4. Seed: secondhand-mcp source files** (cue: running code beats READMEs).
- Changed: Depop and Poshmark modules are DOM scrapers of public pages with no sold support; Depop's JSON API is 403 to servers; Facebook uses unauthenticated GraphQL plus an HTML fallback and only flags `is_sold`. The ebay module is Browse search and getItem only. Confirms secondhand-mcp is an active-listing connector, not a comps source.
- Leads left open: `ebay/filters.js` and `facebook/queries.js` (doc_id values) not opened; the GitHub tree page was blocked by robots.

**Loop 5. Seed: category API docs (Discogs, PriceCharting) and StockX's own developer announcement** (cue: official docs with response examples).
- Changed: Discogs suggestions are confirmed per grade; PriceCharting is current-only and "internal use only"; StockX's official API is for established sellers; no Flipper Vintage API found.
- Leads left open: GOAT routes; Grailed Algolia app ID and key; eBay User Agreement text on automated access; Mercari's own `v2/entities:search` endpoint (asserted from memory, not opened); whether caffein.dev's actor really returns sold rows after the wall (needs a live run); OpenWebNinja and CompsAPI pricing; Exa's price-alert monitor (Ben's X link) as a watch source was out of scope here.

## Limits

I could not run any route (no shell internet), so every "works" is the vendor's or actor page's claim on 2026-11-14. Apify user counts and success rates are snapshots. Search was narrow per platform; other actors and vendors exist. The licence section numbers are inferred from the page order.
