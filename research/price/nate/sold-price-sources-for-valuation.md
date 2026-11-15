# Where can the app get eBay-grade sold prices for valuation, on terms that let it show a derived price to the user?

Researched 2026-11-15 by Nate (Claude Sonnet 5.5 retrieval seat). Feature: price.

Decision it feeds: which sold-price sources the valuation feature builds on first. Nate: "we need valuation, that is critical. Find a workaround, understand where other platforms utilize the api and have all ebay data so we can just harness onto that."

Marks: *observed* = read on the provider's own page or docs today (some via Exa text of that page, flagged); *asserted* = the source says it without showing it, or it is a third party's or vendor wrapper's claim; *inferred* = my reasoning. Public pages and docs only. No sign-ups, keys or paid calls. Blocked pages are recorded, not worked around.

## Draft from memory

eBay has no sold-data API for outsiders (Finding API retired, Browse API active only). Sold data reaches apps through Terapeak (own account), scrapers, and WorthPoint/130point. Category APIs (Discogs, BrickLink, Reverb, PriceCharting) give sold or price-guide data. Scraping eBay for pricing is against the terms.

## What changed

- The draft was right that no open eBay sold API exists. Marketplace Insights exists, but is Limited Release, 90 days (*observed*). Terapeak has no API or export of research results (CompsAPI, *asserted*, third party).
- The draft was wrong on a larger set of third-party sold-comps APIs: Apify actors from about $1 to $3.50 per 1,000 results, CompsAPI, SoldComps, CompSniper and Countdown API all return eBay sold price with date (*observed* on vendor pages, vendor self-description). Their legal footing is the open question, not their existence.
- The draft was wrong on eBay's licence: it names price modelling directly, so a licensed eBay API route for valuation is closed by clause, not just by access.
- Discogs forbids using its marketplace data commercially and shows no sold history in public endpoints. The draft assumed it was usable.
- PriceCharting's terms bar use in any app accessible to third parties without written permission. The draft assumed API use was fine.
- Tension to flag: webscraping.cc (*asserted*) says the public Sold Items filter renders without login. The repo's own runs ([ebay-when-it-serves](../../cross-cutting/nate/runs/ebay-when-it-serves.md), *observed* 2026-11-15) and CompsAPI's test (17 Oct 2026) say sold search is behind sign-in.

## D. Law and licence (first, since it gates the rest)

- eBay API License Agreement, https://developer.ebay.com/support/api-license-agreement (*observed*):
  - "“eBay Content” means all of the information, data, content, images, and other material stored by and retrieved from eBay. eBay Content does not include information that you lawfully obtain independent of eBay."
  - Section 9 opens: "you may not use or access (nor facilitate or enable others to use or access) eBay Services, including the Developer Tools, in any way which may, directly or indirectly, undermine eBay’s business interests without eBay’s prior written consent."
  - Item 5: "Use eBay Content, either alone or in combination with third-party information, to suggest or model prices for items listed on eBay Site."
  - Also barred: sell, store, copy or modify eBay Content (7); train algorithms or AI (10); Buyer Demand Data only for constructing or editing a listing (18). "Restricted APIs" (market trends, pricing strategies, sales volumes) go to select developers.
  - The 2017 PDF (https://developer.ebay.com/cms/files/api_license_2017-05-25_final.pdf) has an older definition ("information that you obtain independent of eBay") and the same price-modelling sentence at 9.6.
- eBay User Agreement (effective 2026-06-28, fetched earlier today, *observed*): "use any robot, spider, scraper, data mining tools, data gathering and extraction tools, or other automated means (including, without limitation buy-for-me agents, LLM-driven bots, or any end-to-end flow that attempts to place orders without human review) to access our Services for any purpose, except with the prior express permission of eBay;". Third-party product data may be used "solely in your eBay listings ... not to create any derivative works".
- robots.txt disallows `/sch/` (repo note, *observed*). Nate ruled "read ebay pages anyway".
- Terapeak / Seller Hub terms restricting use of research results: not found.
- Does the licence reach a person's own signed-in view, own export, or a third party's licensed guide? *Inferred*, eBay does not say:
  - The licence binds use of the Developer Tools and eBay Content "retrieved from eBay" through them. A person reading their own Seller Hub or exporting their own orders is not a Developer Tools use. The User Agreement's automated-access sentence still applies to anything our code does inside their session.
  - A third party's licensed guide (WorthPoint states it is "an official licensee of eBay") is not eBay Content we retrieve, but whether we may display a price derived from it is set by that vendor's terms, not eBay's.
  - Scraper vendors say they collect public pages and leave the legal use to the buyer (below). That puts the eBay User Agreement and the price-modelling clause back on us. *Inferred*.

## A. Own-account tools

| Tool | Finding | Mark |
|---|---|---|
| eBay Product research (Terapeak) | Free to sellers with Seller Hub access. Last 3 years of sales; completed listings last 90 days only. Fields: sales trends, average sale price, sold price range, average shipping, free-shipping share, sell-through, sellers, format, accepted Best Offer price. Filters MPN, UPC, EPID, EAN, ISBN, price, format, condition, location, marketplace. https://www.ebay.com/help/selling/selling-tools/product-research?id=4853 (read via Exa text of the page, eBay help blocks curl). No API or export (CompsAPI, *asserted*). | observed / asserted |
| eBay Sold items filter | `LH_Sold=1&LH_Complete=1`; "Sign in or Register" wall with no items on ebay.com, .co.uk and .ie; ebay.de 403 once (repo note). Window about 90 days. Accepted Best Offer shows as crossed-out ask. | observed |
| eBay listing-form guidance | "based on similar items recently sold (fees excluded)"; price-guarantee range from similar sold within 90 days; sports-card price guide covers 2 years, daily, median sold, range, Best Offer prices. https://www.ebay.com/help/selling/selling/pricing-items?id=4133. "Sell one like this" detail: not found. | observed |
| eBay own-sales export | Orders report CSV: Item Number, Item Title, Quantity, Sold For, Shipping And Handling, Total Price, Sale Date and others; also Transaction and Sales and selling costs reports. https://www.ebay.com/help/selling/selling-tools/seller-hub?id=4095 , .../seller-hub-reports?id=4096. Own sales only. | observed |
| Depop | Price tool: suggested range and "a list of similar items that have sold previously" (ML). https://depophelp.zendesk.com/hc/en-gb/articles/8579600880529-How-to-price-your-item . Partner Selling API pricing-inspiration: "predicted selling price range alongside real market data from similar sold items on Depop", UK and US only, no luxury brands, partner access. https://partnerapi.depop.com/api-docs/concepts/pricing-inspiration/ . Own sales download: CSV, up to 3 months at a time. https://depophelp.zendesk.com/hc/en-gb/articles/360039263713 | observed |
| Mercari | Gross Sales Report: Item ID, Sold Date, Item Price ("The final selling price"), fees, Net Seller Proceeds. https://www.mercari.com/us/help_center/article/541/ . "Check out similar sold listings to see what your item might sell for." https://www.mercari.com/us/help_center/topics/account/guides/how-it-works/ . Definition of "similar sold": not found. | observed |
| Poshmark | Sales Report (Order Price, Net Earnings, bundles, offers), reached via Seller Tools > Insights or web Order Activity; per smartbills.io 2026-10-22 and Lifehacker 2025-08-05, third parties. Poshmark's own help pages and any price suggestion or sold filter: not fetched / not confirmed. | asserted |

Inferred: all of group A is the person's own data or screens. None gives our server a sold-price feed; each is reached through the person's session or export.

## B. Licensed price-guide APIs

| Provider | Endpoint / auth | What price derives from | Limits, price | Terms on display, caching, deriving |
|---|---|---|---|---|
| eBay Marketplace Insights | `/buy/marketplace-insights/v1_beta/item_sales/search` (q, epid, gtin, category_ids). https://developer.ebay.com/api-docs/buy/api-insights.html | eBay sales, last 90 days. "(Limited Release)" | Approved partners only | API licence: price modelling barred (above). observed |
| Discogs | `GET /marketplace/stats/{release_id}` returns `lowest_price{currency,value}`, `num_for_sale`; `/marketplace/price_suggestions/{id}` needs auth and seller settings. https://www.discogs.com/developers (Exa text) | Current asking only; suggestions from seller grades | Rate limit not captured; site 403 to curl | Terms (https://support.discogs.com/hc/en-us/articles/360009334593): Marketplace Data includes "pricing suggestions ... and sales history". "You may not: Transfer Restricted Data to any third party. Use Restricted Data for any commercial purposes." "You may not display in any format or to any audience the Content if it is more than six (6) hours older". observed (Exa text) |
| Reverb | Price guide is public, no token, per reverb-python client (third party, https://github.com/ggiill/reverb-python). Wrappers (Crawlora, Anysite) report monthly average sale price, sold transactions with `sold_at`, conditions, 6 months to 2 years. Official API needs token for account endpoints. | Reverb sold transactions (wrappers, asserted) | Wrappers 1 to 3 credits/request. Reverb's own limits and terms sentence: not captured | Reverb price-guide terms: not found |
| BrickLink | `GET /items/{type}/{no}/price?guide_type=sold|stock` with new_or_used, country_code, region, currency_code. `price_detail[]` last 6 months: quantity, unit_price, `date_ordered`. Example `{"item":{"no":"7644-1","type":"SET"},"new_or_used":"N","currency_code":"USD","min_price":"96.0440","avg_price":"162.3401","unit_quantity":298,...}`. https://static.bricklink.com/alpha/default/api_wiki.html (static copy, date uncertain) | Sold orders (6 months) | Auth and terms not captured (v3 page was a shell) | not found |
| BrickEconomy | REST `x-apikey`, https://www.brickeconomy.com/api/v1/, 100 requests/day, "aligned with the Premium membership's license terms". Set fields `current_value_new/used`, `price_events_new` (11 months); `salesledger` is the user's own sales. https://www.brickeconomy.com/api-reference | Estimated value, not documented as sold transactions | 100/day | Premium licence text not captured. observed (fields) |
| Rebrickable | https://rebrickable.com/api/ needs key; no pricing data seen | n/a | | not found |
| TCGplayer | "We are no longer granting new API access at this time." https://docs.tcgplayer.com/docs/getting-started . TCGCSV mirror and resellers of `/sales` are third parties | Market price / sales | Closed to new users | observed (closure) |
| Scryfall | Free, no key; prices are TCGplayer's, updated daily; about 2 to 10 requests/second (secondary source). Own terms page only grepped | Market price, not sold | | not fully read. asserted |
| pokemontcg.io | https://dev.pokemontcg.io/terms: "Price data is for informational purposes only... Absolutely no guarantees". Deprecated to Scrydex (from $29/month) per TCGAPIs blog (third party). 20,000/day keyed, 1,000 without | TCGplayer and Cardmarket market prices | | observed (terms line) |
| PriceCharting | API current prices, 1 call/second. Terms: "Price data may be referenced on external websites provided that: PriceCharting is clearly cited as the source, and a visible hyperlink to PriceCharting is included". "Price Data can be used for your Internal Business Purposes if you maintain a valid and current Legendary subscription... not for external display or redistribution." "Price Data cannot be used in any software, application, or system that is accessible to third parties, including customers, clients, or the general public, without express written permission." `/subscribe` 404 | Sales prices (eBay-derived per earlier repo notes, not re-confirmed today) | | observed |
| Keepa | https://keepa.com/api-docs/ : Amazon only; token bucket, 1 token/product, unused tokens expire after 60 minutes; `csv` price history, `monthlySold` ("an Amazon-published bracket rather than an exact sales estimate"). Prices and terms not captured | Amazon listing prices, not sold | | not captured |
| StockX | Developer application reviewed in 5 to 7 business days; catalog, selling, order APIs; market data is bid/ask (api-evangelist, third party). https://developer.stockx.com/portal/getting-started ; terms not fetched | Bids/asks | | not fetched |
| GOAT | No official API found. KicksAPI (third party, from EUR 59/month) returns `asking_price` with `observed_at` | Asking | | not found |
| WatchCharts | https://watchcharts.com/api , `/api/license` (updated 2026-04-29). Base https://api.watchcharts.com/v3/ (`/search/watch`, `/watch/info`), `x-api-key`. Pay as you go $199/month (500 free credits, 2,500 credits for $200), Level 1 $600, Level 2 $1,000. Professional membership needed. 1 request/second. Level 1 current price and limited history; Level 2 retail, appraisals, historical listings. Sold vs asking not stated | Market price from listings (not stated as sold) | Above | "Showing WatchCharts data on your own website or app needs a distribution license". "Distribution: Data and derived results may be incorporated into the licensee’s products and services for use by end users, but may not be sublicensed, resold, or redistributed to third parties, nor offered as part of any paid or subscription-based product or service." Also attribution or white label, no more than 1 year history shown, erase on termination, non-compete. Distribution surcharge 50% with attribution, 100% white label. observed |
| Chrono24 | Nothing found | | | not found |
| Card Ladder | Free: Price Guide and Daily Sales Recap. Pro $20/month or $200/year: all-time Sales History. https://www.cardladder.com/pricing . No public API (Gradedco, third party, checked 2026-10-19). Card Hedge (separate, from $49/month) and ReefAPI wrapper (`last_sold_price`, per-day history, about $2 per 1,000 calls) are third parties | Sold sales (sources not stated on page read) | | Terms not fetched |
| Market Movers / Sports Card Investor | $9.99, $24.99, $49.99/month; "tens of millions of sales comps dating back to 2001". https://www.marketmoversapp.com/ . No public API seen | Sold comps | | Terms not fetched |
| GoCollect | Pro $9/month. Enterprise "Customized API access", custom price. "We gather the sales from the various online auction houses". https://gocollect.com/pricing | Sold at auction houses | | Terms not fetched |
| Swappa | Per Scraperly (third party, June 2026): no free API; paid data product at swappa.com/data-services with pricing, sales history, popularity from reported transactions, contact-gated; Terms prohibit automated access. Swappa's own page not fetched. Apify actor abotapi/swappa-com (third-party scraper) returns `salesHistory`, `soldPriceMin/Avg/Max` | Reported transactions | Not listed | not fetched. asserted |
| Back Market | Official API for registered sellers only (listings, orders, BackBox); no sold data (AgentBuyPhone, API.SH, third party). https://api.backmarket.dev/ | Asking | | |
| Gazelle, SellCell | No public API (AgentBuyPhone index, third party). Gazelle buy-side asking prices only (ReefAPI wrapper) | Asking / payout offers | | |
| ISBNdb | From $14.99/month. Price information only on Pro $99.99 and Enterprise $299.99 (Bookscouter blog 2024, third party); asking prices. 1/second default, 3 Premium, 5 Pro (ISBNdb blog 2026-01-22). https://isbndb.com/isbn-database | Retailer asking | | not fetched |
| Bookscouter | Blog says its API gives vendor buyback prices, real time and historical. API page not fetched | Buyback offers | | not fetched |
| Chairish, 1stDibs, LiveAuctioneers, Invaluable, KBB/Edmunds | Nothing fetched | | | not found |

## C. Services holding eBay sold history

| Service | Finding | Mark |
|---|---|---|
| WorthPoint | "more than 610 million items ... beginning in 2006" (https://www.worthpoint.com/data-partners); about one billion historical prices (https://www.worthpoint.com/page/about). "We are an official licensee of eBay and many of the leading auction houses." "Our licenses permit our members to use completed sales results and images displayed on the Worthopedia solely for research purposes." (https://www.worthpoint.com/about-item-removal). Terms: 7-lookup or 7-day trial then monthly (https://www.worthpoint.com/page/terms-use). No API or data-buyer programme found. Plan prices not fetched | observed (Exa text of the pages) |
| 130point | Via ReefAPI wrapper (https://reefapi.com/130point-api, captured Nov 8 2026, third party): eBay, Fanatics Collect/PWCC, Goldin, Heritage, Pristine, MySlabs, Card Hobby; max 200 sales/search; `sold_price`, `list_price`, `best_offer_discount_pct`, `sold_at`; "130point publishes the amount that was accepted." Cards only. 130point's own explanation of its source: not found | asserted |
| eBay partners | Marketplace Insights (above). Names of approved partners: not found | |
| Algopix | Free with limits or $29/month; estimates and expected selling price (ZIK blog, third party). 3dsellers: such tools "may use eBay APIs, their own data collection or estimates". Algopix's own page not fetched | asserted |
| ZIK Analytics | Average price over 7, 14, 21, 30 days, sold counts and history; says "No guessing, no scraping"; "pulls verified eBay sales data directly from live eBay listings". $39.9/month (ZIK blog 2026-06-05). No API found. https://www.zikanalytics.com/solutions/ebay-price-tracker | observed (claims) |
| Mark Sight | Free with limits or $12.95 (ZIK blog, third party). Own page not fetched | asserted |
| Flipwise, Nifty, Vendoo, List Perfectly | Listed only as crosslisters in a roundup (Lilach Bullock, 2026-10-23); no price-data product seen; own pages not fetched | not found |
| PriceCharting | See B. Whether its prices are eBay-derived was not re-confirmed from its own page today | |
| Countdown API (Traject Data) | eBay search params `sold_items`, `completed_items`; fields `ended.date.raw`, `price.value`, `quantity_sold`, `offer.end_date.utc`. https://docs.trajectdata.com/countdownapi/ebay-product-data-api/reference/csv-fields . Price and terms not fetched | observed (fields) |
| CompsAPI | Up to 240 rows/request, up to 1,095 days, free key 100 requests/month, accepted Best Offer amount. https://compsapi.com/does-ebay-have-a-sold-listings-api | observed (vendor page) |
| SoldComps, sold-comps.com, CompSniper, Trawl, Soldgraph, Resellbot | DEV post 2026-11-14 by a vendor (https://dev.to/soldcomps/ebay-sold-listings-api-in-2026-replacements-for-findcompleteditems-compared-3pa9): SoldComps free 2,000 credits/month, 90 days, MCP; CompSniper up to 3 years, free 100/month, $29 plan; Soldgraph from $9.99/month. Self-interested; display terms not checked | asserted |

Scrapers (all say they read public pages; none documents a licence from eBay):

| Vendor | Price | Sold with date documented | Source and indemnity statement |
|---|---|---|---|
| Apify epicscrapers/ebay-sold-listings-api | from $2.00 per 1,000 ($3.50 free plan), 17 marketplaces | yes: `soldPrice`, `soldAt` (day, 00:00 UTC), `bestOfferAccepted` | "The actor collects publicly visible sold-listing data and no buyer data... You are responsible for how you use the data, including eBay's terms and laws such as GDPR." Accepted Best Offer: "eBay doesn't publish it ... The actor doesn't guess it". No indemnity |
| Apify crawloop/ebay-sold-listings-scraper | from $2.50 per 1,000 | sold listings | "Unofficial tool — not affiliated with ... eBay Inc... Data is read from publicly accessible pages only. No login." No indemnity |
| Apify parsebird | $3.40 per 1,000 ($2.40 Gold) | sold | cites hiQ v. LinkedIn; no indemnity |
| Apify originalvi | from $1.00 per 1,000, about 90 days, about 10,000 cap | sold | none seen |
| Apify datasteady | from $1.49 per 1,000 | sold | none seen |
| Bright Data | $1.50 per 1,000 records pay as you go, 5,000 free/month, Scale $499/month for 384,000 records (https://brightdata.com/products/web-scraper/ebay); datasets by purchase or subscription, "completed sales data" claimed in its blog, dataset page not fetched | not confirmed on the product page | "Only publicly available data. ISO 27001 certified, SOC 2 controls, GDPR & CCPA compliant." No indemnity found |
| Oxylabs | Plans $15, $100, $500/month (https://oxylabs.io/products/web-api/scrape/ecommerce/ebay) | no sold-field documentation seen | "collecting eBay data is considered to be legal as long as you follow all the applicable rules and regulations ... we still recommend seeking professional legal advice". No indemnity found |

All observed on vendor pages today, except as marked. Inferred: scraper vendors push the eBay User Agreement and price-modelling risk to the buyer.

Other facts: the Best Offer problem. eBay shows the original ask on accepted Best Offers (webscraping.cc, *asserted*), which biases comps upward unless the source recovers the accepted amount (Terapeak and 130point do; Apify's epicscrapers says it does not).

## What was searched and not reached

eBay help pages block curl (read through Exa text). Discogs 403 (Cloudflare) to curl. BrickLink v3 and Keepa home returned shells. PriceCharting `/subscribe` 404. Prior-note facts reused, not re-fetched: Dupe MCP asking prices; NBER Best Offer data (2012-13) research-only; SerpApi dropped its sold filter.

## Not found

- Terapeak / Seller Hub terms limiting use of research results.
- eBay "Sell one like this" description.
- Any statement from eBay on whether a person's own view or export falls outside the API licence (inferred only).
- Any indemnity statement from any scraper vendor.
- Chrono24, Chairish, 1stDibs, LiveAuctioneers, Invaluable, KBB/Edmunds: nothing fetched.
- Poshmark's own help pages for Sales Report, price suggestion, sold filter.
- Mercari's definition of "similar sold".
- Reverb, BrickLink, Keepa, BrickEconomy terms sentences on display or deriving; Reverb rate limit; Discogs rate limit.
- Swappa's own data-services page and price; WorthPoint plan prices; 130point's own source statement; Algopix, Mark Sight, Flipwise, Nifty, Vendoo, List Perfectly own pages; Countdown price and terms; Bright Data dataset page; Card Ladder, Market Movers, GoCollect, StockX terms.
- Any API for WorthPoint, Terapeak, Card Ladder, Market Movers.

## Sources fetched

eBay API licence and 2017 PDF; eBay Marketplace Insights doc; eBay help (Product research, pricing items, Seller Hub, reports; via Exa); eBay User Agreement; repo note ebay-when-it-serves; WorthPoint (data-partners, about, about-item-removal, terms); Depop help and Partner API; Mercari help (article 541, how-it-works); Discogs developers and API terms (Exa text); BrickLink static wiki; BrickEconomy API reference; WatchCharts API and licence; StockX developer portal; Card Ladder pricing; Market Movers; GoCollect pricing; ISBNdb; Keepa docs; TCGplayer docs; pokemontcg.io terms; PriceCharting terms and API; ZIK pages; Countdown API docs; Bright Data and Oxylabs eBay pages; Apify actor pages (epicscrapers, crawloop, parsebird, originalvi, datasteady); CompsAPI; DEV soldcomps post; third parties (webscraping.cc, ReefAPI, Crawlora, Anysite, reverb-python, KicksAPI, Scraperly, AgentBuyPhone, API.SH, smartbills.io, Lifehacker, Gradedco, TCGAPIs blog, Bookscouter blog, ZIK blog, Lilach Bullock).

## Sold-price sources for valuation

Licensed column: yes / no / unclear, with the clause.

| Source | Categories | Sold or asking | Sale dates | Freshness and history | How reached | Cost | Licensed to show our user a derived price | Verdict |
|---|---|---|---|---|---|---|---|---|
| eBay Product research (Terapeak) | All eBay | Sold | Date range filter; accepted Best Offer shown | 3 years; completed 90 days | Person's own signed-in session | Free to sellers | Unclear: API licence does not cover own view (inferred); User Agreement bars automated access | Best eBay sold source; a person reads it, no feed |
| eBay Seller Hub orders export | Person's own sales | Sold | Sale Date | Own history, 1 to 90 days per pull (third party) | Person's export | Free | Yes for their own data (inferred) | Own comps only |
| eBay sold filter | All eBay | Sold | Listing end dates | About 90 days | Person's own signed-in session | Free | Unclear: User Agreement automated-access sentence | Needs sign-in |
| Marketplace Insights | All eBay | Sold | Yes | 90 days | Our API call, limited release | Not listed | No: licence item 5 | Closed |
| Depop price tool, sales download | Depop | Sold (similar) / own | Download has dates | 3 months/pull | Own session; export | Free; Partner API by programme | Unclear | Own and in-app only |
| Mercari Gross Sales Report | Own Mercari sales | Sold | Sold Date | Own history | Person's export | Free | Yes for own data (inferred) | Own comps only |
| Poshmark Sales Report | Own Poshmark sales | Sold | Yes (third party) | Date range | Person's export | Free | Yes for own data (inferred) | Own comps only |
| WorthPoint | Antiques, collectibles, art, cards, broad eBay history | Sold | Yes | 2006 on, 610M to 1B prices | Person's own subscription session (no API found) | Subscription, price not fetched | No for our display: "solely for research purposes" | Deepest eBay-licensed history; no feed |
| 130point | Cards | Sold, accepted Best Offer | `sold_at` | Max 200 per search | Wrapper API (third party) or its site | About $2 per 1,000 via wrapper (asserted) | Unclear: 130point's terms not read | Strong for cards if terms permit |
| Apify / CompsAPI / SoldComps / Countdown / Bright Data | eBay all | Sold | `soldAt` and similar | 90 days to 3 years | Our call to a scraper | $1 to $3.50 per 1,000; free tiers | Unclear to no: scrapes public pages, eBay User Agreement and price-modelling clause fall on us | Cheapest data; legal risk is ours |
| BrickLink price guide | LEGO | Sold (`guide_type=sold`) | `date_ordered` | 6 months | Our API call with key | Not captured | Unclear: terms not captured | Best-documented sold API |
| Reverb price guide | Music gear | Sold (wrappers) | `sold_at` | 6 months to 2 years | Public endpoint / wrappers | Wrapper credits | Unclear: Reverb terms not found | Verify terms |
| WatchCharts | Watches | Not stated | Limited history | 1 year displayable | Our API call | $199 to $1,000/month plus 50 to 100% distribution surcharge | Yes with distribution licence: "Data and derived results may be incorporated into the licensee’s products and services for use by end users" (not in paid or subscription product) | Clear terms but bars paid product |
| Card Ladder | Cards | Sold | Yes | All-time on Pro | Person's own subscription | $20/month | Unclear: no API, terms not fetched | Person's tool |
| Market Movers | Cards | Sold comps | Yes | Back to 2001 | Person's own subscription | $9.99 to $49.99/month | Unclear | Person's tool |
| GoCollect | Comics | Sold | Not stated | Not stated | Enterprise API by contract | Custom | Unclear | Contract route |
| Swappa data-services | Phones, electronics | Sold (reported) | Yes (asserted) | Not stated | Contact-gated purchase | Not listed | Unclear | Ask |
| PriceCharting | Games, cards, media | Sales-derived | Not stated | Current only | Our API | Legendary subscription | No: "cannot be used in any software, application, or system that is accessible to third parties ... without express written permission" | Needs written permission |
| Discogs | Records | Asking (public); sales history restricted | No | Current | Our API | Free | No: "Use Restricted Data for any commercial purposes" | Closed for commerce |
| BrickEconomy | LEGO | Estimated value | Events 11 months | 100 requests/day | Our API with key | Premium | Unclear: "aligned with the Premium membership's license terms" | Estimate, not sold |

Not usable for sold valuation (asking or closed): Scryfall, pokemontcg.io, TCGplayer (no new access), Keepa, StockX, GOAT, Back Market, Gazelle, SellCell, ISBNdb, Bookscouter.

## Three combinations to build first

1. Person's own eBay session plus own exports. Terapeak Product research and Sold filter read in the person's signed-in session, their Seller Hub orders export, and Mercari, Poshmark and Depop exports. Reason: it is the only route to eBay sold data with accepted Best Offer and 3-year history that eBay itself provides, and own exports are the person's data. Risk: the API-licence carve-out is inferred, and the User Agreement bars automated access. Terapeak's own terms were not found.
2. Category sold APIs with documented sale dates. BrickLink `guide_type=sold` (LEGO), Reverb price guide (music gear), WatchCharts under a distribution licence (watches), Swappa data-services (phones). Reason: each documents sold or transaction prices per item with dates, and WatchCharts is the only one whose licence clause lets us show derived results to end users. Others need their terms read first.
3. Cards and collectibles: 130point (accepted Best Offer, `sold_at`, multi-house), Card Ladder or Market Movers for the person's own tools, WorthPoint for deep history. Reason: the card sold data sits in licensed or consumer tools with dated sold prices. Terms for deriving a price are unclear for each, and a scraper feed of eBay sold (Apify, CompsAPI) is the cheapest fallback but puts eBay's User Agreement and price-modelling clause on us.
