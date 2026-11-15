# Which services and data providers sit on eBay's API or other marketplaces' data and expose it through a published interface, and what are they licensed to give us?
Researched 2026-11-15 by Nate (Claude Sonnet 5.5, retrieval seat). Feature: data.

Decision it feeds: Nate's idea that aggregators or eBay-API resellers can "lend features proven we can piggy back on and drive to empower all engines". Nate decides each source himself on terms ("I dont want to violate tos or introduce problems to the users"). This note returns evidence and does not recommend.

Marks: observed = read on the provider's own page this run; asserted = a provider or third party says so, or from memory; inferred = my reasoning. Fetching was public pages only: no sign-ups, keys or paid calls. Blocked pages are recorded and not worked around.

## Draft from memory (before searching)
- eBay's Finding and Shopping APIs are gone; Browse API gives active listings only; sold data lives in Marketplace Insights, which is restricted; Terapeak has no API.
- eBay's API licence bars price modelling and ML training.
- Sold comps in practice come from scraping (Apify actors, SerpApi) or from price guides (PriceCharting, WatchCharts, Card Ladder) whose terms bar redistribution.
- Identity: UPCitemdb, Barcode Lookup, GS1, Icecat. Safety: CPSC and NHTSA free.

## What changed
- Draft held on eBay (restricted sold data, no Terapeak API, Finding/Shopping decommissioned).
- New: eBay ships an official read-only MCP server and agent skills (see 1).
- New: SerpApi's eBay engine has dropped sold and completed filters (observed), so SerpApi no longer serves sold comps. Sold comps now come only from Apify-style actors.
- New: the eBay licence has a route to pricing tools: Restricted APIs data may be used "to develop pricing tools, only upon receiving eBay's express prior written consent" (observed). My draft said only "barred".
- New: PriceCharting's API page says "Data can and should be cached/stored" but "licensed for internal use only", and its terms bar use in "any software, application, or system that is accessible to third parties" (observed).
- New: Bright Data sells eBay (173.2M+ records), Poshmark (47M+) and Mercari (12.6M+) datasets from "publicly available online sources", from $250 per 100K records (observed).

## 1. eBay's own programs
- Finding and Shopping APIs: "Both the Shopping API and Finding API were decommissioned in Q1. Former consumers of these APIs should consider the Browse API as the alternative for searching against eBay listings." (observed, https://developer.ebay.com/updates/newsletter/q1_2025). The Finding doc URL returned 404.
- Browse, Feed and Marketplace Insights: Limited Release, need approval; Marketplace Insights searches sold items by keyword, GTIN, ePID and category (asserted via search results and community posts: https://developer.ebay.com/develop/api/buy/marketplace_insights_api, https://community.ebay.com/forum/apis-feedback-comments-and-suggestions-57951/topic/marketplace-insights-api-sandbox-issues-6736/). The overview pages returned only a sign-in shell to me, so field names are not observed.
- Terapeak: no public API. A forum reply says "The terapeak api got rolled into ebay's" Marketplace Insights (observed snippet, https://community.ebay.com/t5/Traditional-APIs-Search/Accessing-Terapeak-Product-Research-Information/td-p/33827092). The Terapeak help page returned a bot-check shell.
- Catalog API: `GET /product/{epid}` and `GET /product_summary/search` return ePID, GTIN, MPN, aspects, images (observed, catalog.txt in scratchpad from developer.ebay.com Catalog docs). Taxonomy aspects give item specifics per category (page fetched; fields not re-read here, so asserted).
- eBay MCP: `@ebay/npm-public-api-mcp`, Apache-2.0, GET-only and read-only, OpenAPI-driven, needs Client ID and Secret, application or user tokens (observed, eBay Developers "AI Tools" page and package metadata). Agent skills are on the same page. It sits under the same licence as the API it wraps (inferred).
- Partner Network (EPN): affiliate links and Buy API access path; page fetched (https://partnernetwork.ebay.com/); no data-use terms read (asserted).
- eBay Open Source Program page is about code, not datasets (observed, https://opensource.ebay.com/). No eBay listing dataset found.
- 403 on: api-license-agreement under /join, analytics overview, api-call-limits, browse overview, api-deprecation-status. Licence text came from the developer.ebay.com copy (footer Sept 3, 2025).

### eBay API License Agreement clauses (observed; section numbers inferred from heading order and the in-text cross-reference "Section 8.5")
- 8.1 Public Display: "you may display such eBay Content within your Application to promote eBay and enable Your Users to search and browse listings", with (1) delete when no longer public and (2) "may not be co-mingled or combined with non-eBay Content".
- 8.2 Age: "Displayed item listing information may not be more than six (6) hours older than information displayed on the eBay Site, and other eBay Content must be no more than twenty-four (24) hours older".
- 8.3 Derivation: "You must have eBay's express prior written permission to use or display eBay Content in any way that enables derivation of ... Any site-wide statistics across eBay Sites or within any eBay Site".
- 8.4 Restricted APIs ("any eBay APIs that provide information about market trends, pricing strategies, sales volumes, user behavior"): may not "Ingest ... into any artificial intelligence model ... not provided by or licensed from eBay", may not "Electronically distribute via API the Restricted APIs data (either in raw or aggregated form)", may not share with anyone "who is not a mutual customer of you and eBay (for example, an eBay seller)". Then: "Developer is permitted to use, modify, create derivative works of, publicly display and host, and distribute data outputs of the Restricted APIs Data during the Term to develop pricing tools, only upon receiving eBay's express prior written consent."
- 8.5 eBay Enhanced Tools: if consent is given, eBay gets an irrevocable licence to the pricing tool and outputs; Developer warrants that "to the extent Developer uses scraped data in its pricing tools, Developer confirms that it has not and will not circumvent any third-party rights".
- 9 Restricted Activities, verbatim bullets: "Use eBay Content, either alone or in combination with third-party information, to suggest or model prices for items listed on eBay Site."; "Display eBay Content relating to the performance of any eBay Service relative to the performance of any third-party service (for example, sales volume, velocity, etc.)."; "Use eBay Content or Developer Tools to compete with eBay Services"; "Use eBay Content ... to train algorithms, conduct machine learning, develop synthetic data sets, train large learning models, and/or train artificial intelligence systems."; "Using Buyer Demand Data in any manner other than for the express purpose of constructing or editing a listing."; seller arbitrage barred (auto-repricing against other sites).
- Source: https://developer.ebay.com/ licence copy (scratchpad ebaylic.txt, lines 124-240).
- Inferred: clause 9 "suggest or model prices for items listed on eBay Site" reads as items listed on eBay; whether it reaches a valuation for a non-eBay listing is a legal reading for Nate, not settled here.

## 2. Sold-price and price-guide services
| Source | Data (own field names) | How it says it gets data | Interface | Price | Terms |
|---|---|---|---|---|---|
| PriceCharting | `id`, `product-name`, `console-name`, `loose-price`, `cib-price`, `new-price`, `release-date`; prices in pennies; lookup by `id`, `upc` or `q` | its own site data (no sentence found naming eBay as source; its tools list "eBay Lot Bot") | `GET https://www.pricecharting.com/api/product?t=<40-char token>&id=6910`; `/api/products` returns 20 matches; 1 call per second; CSV once per 10 min, regenerated every 24 h | "API's are a premium tool. You must have a paid subscription"; CSV only for Legendary tier; amount not read | see below |
- PriceCharting terms (observed, https://www.pricecharting.com/api-documentation): "The API and CSV only support current item values ... Historic prices and historic sales are not supported." "licensed for internal use only. Sharing our price data with a third party, or making it available within an application or service used by others, requires a commercial license and express written permission from us." "Data can and should be cached/stored on your servers." "All data gathered from the API or CSV must be purged after your subscription has ended." Terms page: "Price Data cannot be used in any software, application, or system that is accessible to third parties". Proven feature: UPC to price guide valuation (observed field set).
- Card Ladder: terms bar "Reproduce, duplicate, copy, sell, resell or otherwise exploit for any commercial purposes" and any "robot, spider ... scrape" (observed, https://www.cardladder.com terms). No public API found. Personal non-commercial use only.
- 130point, WorthPoint, WatchCharts: API and terms pages returned 403 to me (blocked, not worked around). A third-party listing says 130point has no documented public API (asserted, search result). WorthPoint API: nothing found.
- StockX: developer.stockx.com is a JS shell (nothing read); the docs URL 404. Not-found.
- Existing repo readings: `spec/features/market.md` lines 185-192 hold the earlier licence table for StockX, PriceCharting and WatchCharts (observed, repo).
- Keepa: keepa.com is a JS shell; GitHub README shows a Java framework "Provides methods that facilitate the work with price history data" (observed, https://raw.githubusercontent.com/keepacom/api_backend/master/README.md). Amazon only (asserted). Endpoint, price and terms not read.

## 3. Seller research tools
- ZIK Analytics: eBay product research, sales tracker, keyword tool, "Lock in from $12.40/mo" yearly promo (observed, https://www.zikanalytics.com/, 2026-11-15). No public API found. How it gets data: not stated on the page (not-found).
- Algopix: home page returned empty text; `/api` 404. Not-found. Title Builder, Mark Sight, SellerAmp: not fetched.

## 4. SERP, scraper and dataset vendors (collection from public pages unless noted)
- SerpApi eBay Search (`engine=ebay`): params `_nkw`, `ebay_domain`, `buying_format`, `LH_ItemCondition`, `_sasl`. "The Sold and Complete options are deprecated and no longer supported." (observed, https://serpapi.com/ebay-search-api). `organic_results[]` fields: `title`, `link`, `product_id`, `condition`, `price.from.raw/extracted`, `shipping`, `location`, `quantity_sold`, `extracted_quantity_sold`, `buying_format`, `seller.username`, `seller.reviews`, `seller.positive_feedback_in_percentage`, `thumbnail`. Separate `ebay_product` and seller engines exist. Price: Free $0 for 250 searches per month; Starter $25 for 1,000; 5,000, 15,000 and 30,000 tiers exist (observed, https://serpapi.com/pricing). Only successful searches count; cached ones are free. Terms: "U.S. Legal Shield ... up to $2 million in coverage for the scraping and parsing of search engine data, as long as your use of the data or service is not illegal", "assumes liability for the lawful collection of public search data ... but not for how that data is ultimately used" and not on Free, Starter or Developer plans (observed, https://serpapi.com/legal). That shield is SerpApi's liability, not eBay's licence for you. This is public-page collection that eBay's user agreement may bar (inferred; user agreement not read).
- Bright Data datasets: eBay "product ID, title, description, category and breadcrumbs, price and currency, condition, seller name, seller rating and review counts, and images"; "$250 for 100K records (approximately $0.0025 per record) for a one-time purchase"; subscriptions refresh; "collected exclusively from publicly available online sources" (observed, https://brightdata.com/products/datasets/ebay). Poshmark: brands, prices, categories, sellers (observed, .../poshmark). Mercari: listing, pricing, promotion, availability (observed, .../mercari). Sold prices not listed in the observed field text. Public-page collection.
- Apify actors (community, public-page scraping, "unofficial API"): `caffein.dev/ebay-sold-listings` returns `soldPrice`, `soldPriceMax`, `soldCurrency`, `endedAt` (date only), `isBestOfferAccepted`; "when isBestOfferAccepted is true, this is the asking price — the actual accepted offer is not disclosed by eBay" (observed, https://apify.com/caffein.dev/ebay-sold-listings). Other actors claim sell-through, UPC/MPN and 17 marketplaces (asserted, https://apify.com/dtrungtin/ebay-items-scraper listing). Pay per row; price not read. A search result noted one actor saying scraping may conflict with eBay's terms (asserted).
- Zyte: "From $0.06 per 1,000 successful responses" (observed, https://www.zyte.com/pricing/). Generic scraping, no eBay data product read.
- searchapi.io (docs 404; pricing page fetched, not read), Oxylabs eBay page 404, Countdown and Rainforest (traject.com URLs 404): not-found.
- Apify/Bright Data/SerpApi terms for end-user display of the scraped marketplace data: not found; the marketplace's own terms govern (inferred).

## 5. Resale-data companies
- ThredUp Resale-as-a-Service (https://www.thredup.com/raas), Trove (https://www.trove.com/): marketing pages for brand resale programmes; no data API found (observed absence in fetched text).
- Reflaunt, Archive, Vestiaire, The RealReal, Lyst, Phia, Croissant, Beni, Gem API: not fetched.

## 6. Catalog and identity
- UPCitemdb: `ean`, `title`, `upc`, `gtin`, `brand`, `lowest_recorded_price`, `currency` (USD, CAD, EUR, GBP, SEK); "Product and offers information from Amazon and eBay are not included in API response. eLID is served as a reference if the item was ever found on eBay." (observed, https://www.upcitemdb.com/wp/docs/main/development/responses/). Rate-limit and plan pages 404.
- Barcode Lookup: `Stores` array "Store Name, Price, Link, Currency" (observed, https://www.barcodelookup.com/api); key required; call plans not read.
- Icecat: Anubis bot check (blocked). GS1: 403. Google Merchant API: quickstart page fetched; price-insights not confirmed. Open Product Data: fetch failed. All not-found.

## 7. Recall and safety
- NHTSA vPIC API page loaded (https://vpic.nhtsa.dot.gov/api/, "Version: 4.10"); endpoints not read. CPSC (cpsc.gov and saferproducts.gov): 403 Access Denied. Not-found beyond that.

## 8. MCP directories
- Not searched beyond eBay's own MCP and Apify's MCP configuration banner (observed on Apify pages: "Configure your Apify MCP server with Actors and tools"). Dupe MCP (`https://mcp.dupe.com/mcp`): root fetch returned 404 this run; earlier session reading of its section 13 not re-verified, so asserted.

## Engine to source table
Mark key: [OK] = data via the marketplace's official programme or the provider's own data; [BARRED?] = public-page collection, which eBay's licence and user agreement may bar (inferred; Nate decides). Costs from observed pages.

| Engine | Source | Licensed for that use by own terms | Cost | Lets us show what we cannot today | Marketplace-terms mark |
|---|---|---|---|---|---|
| Valuation | PriceCharting API | No for display to users without commercial licence ("internal use only"); yes to cache | paid sub, amount not read; 1 call/s | UPC to current loose/CIB/new price, games, cards, Lego, Funko, coins | [OK] own data; no history |
| Valuation | eBay Marketplace Insights | Unclear: only after approval; 8.4 allows pricing tools "only upon receiving eBay's express prior written consent"; 9 bars price modelling | not stated | eBay sold by keyword, GTIN, ePID | [OK] official |
| Valuation | Apify eBay sold actors | No clause found either way; eBay 9 and 8.5 scraped-data warranty relevant | per row, price not read | sold price and date, accepted-offer flag (asking price only) | [BARRED?] |
| Demand and time to sell | SerpApi eBay search (`extracted_quantity_sold`) | Unclear; Legal Shield is SerpApi's liability only | $25/mo for 1,000 searches; $25 per 1,000 calls at Starter | per-listing "925+ sold" counts | [BARRED?] |
| Demand and time to sell | Bright Data eBay/Poshmark/Mercari datasets | Unclear; no end-user display clause read | $250 per 100K records ($2.50 per 1,000) | cross-marketplace listing prices | [BARRED?] |
| Demand and time to sell | Keepa | Not read | not read | Amazon price history | not read |
| Identity | eBay Catalog API | Unclear: needs approval; 8.1 display limits | not stated | ePID, GTIN, MPN, aspects | [OK] official |
| Identity | UPCitemdb | Not read (terms 404) | not read | GTIN to title, brand, lowest recorded price | [OK]; eBay/Amazon offers excluded by design |
| Identity | Barcode Lookup | Not read | not read | `Stores` price array | not read |
| Listing and marketing | eBay MCP / Taxonomy | Unclear: read-only, same licence; Buyer Demand Data only for "constructing or editing a listing" | not stated | item specifics, category aspects | [OK] |
| Listing and marketing | ZIK Analytics | No API found | from $12.40/mo | keyword and title tool (UI only) | not stated |
| Trust | SerpApi `seller.positive_feedback_in_percentage` | Unclear | as above | seller ratings | [BARRED?] |
| Trust | eBay Catalog / Browse seller fields | Unclear: 8.1 requires deletion when no longer public | not stated | seller feedback | [OK] |
| Buying-side search | eBay Browse API | Yes for display: 8.1 "search and browse listings", 6-hour age limit | free, approval-gated | live eBay listings | [OK] |
| Buying-side search | SerpApi (eBay, Google Shopping) | Unclear | $25/mo for 1,000 | eBay and shopping results without eBay approval | [BARRED?] |
| Buying-side search | Bright Data Poshmark/Mercari | Unclear | $2.50 per 1,000 records | Poshmark and Mercari listings | [BARRED?] |
| Benchmark rival comparison | eBay licence clause | No: 9 bars displaying eBay "sales volume, velocity" relative to a third-party service | n/a | n/a | [OK] constraint, not a source |
| Benchmark rival comparison | Bright Data or Apify (public listings) | Unclear | as above | rival price spreads | [BARRED?] |
| Recall check | NHTSA vPIC; CPSC | CPSC blocked; NHTSA not read | free (asserted) | recall flag | [OK] government |

## Not found
- eBay Marketplace Insights field names and Terapeak API (pages sign-in or bot-check shells).
- 130point, WorthPoint, WatchCharts, StockX, Keepa API pages and terms (403, 404 or JS shells).
- Algopix, Title Builder, Mark Sight, SellerAmp, searchapi.io docs, Oxylabs, Countdown, Rainforest, Icecat, GS1, Open Product Data, CPSC API, Google Merchant price insights, Reflaunt, Archive, Vestiaire, The RealReal, Lyst, Phia, Croissant, Beni, Gem API, MCP directories, Dupe MCP re-check.
- eBay API call limits (403); PriceCharting subscription price; Apify actor prices.
- Any marketplace's official statement that third parties may display its sold data from public collection. Only eBay's licence read; Poshmark, Mercari, Depop terms not read.

## Sources fetched
- https://developer.ebay.com/updates/newsletter/q1_2025
- eBay Developers licence copy, AI Tools, Catalog, Buy requirements pages (developer.ebay.com)
- https://community.ebay.com/t5/Traditional-APIs-Search/Accessing-Terapeak-Product-Research-Information/td-p/33827092
- https://www.pricecharting.com/api-documentation and PriceCharting terms
- https://www.cardladder.com terms
- https://www.zikanalytics.com/
- https://serpapi.com/ebay-search-api, /pricing, /legal
- https://brightdata.com/products/datasets/ebay, /poshmark, /mercari
- https://apify.com/caffein.dev/ebay-sold-listings, https://apify.com/dtrungtin/ebay-items-scraper, https://apify.com/vonsensey/ebay-scraper-api.md
- https://www.zyte.com/pricing/
- https://www.upcitemdb.com/wp/docs/main/development/responses/
- https://www.barcodelookup.com/api
- https://vpic.nhtsa.dot.gov/api/
- https://raw.githubusercontent.com/keepacom/api_backend/master/README.md
- https://opensource.ebay.com/, https://partnernetwork.ebay.com/
- https://www.thredup.com/raas, https://www.trove.com/
- WebSearch results (not fetched in full): eBay community Finding/Shopping decommission posts, Marketplace Insights posts.
