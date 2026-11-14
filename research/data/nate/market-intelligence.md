# How do products that show a consumer product's price history, hype curve and rising trends work, where does their data come from, and what could an app offer honestly to someone who neither sells nor buys?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: data.

Marks: *observed* = page text read through a search or fetch tool on 2026-11-14 (URL given; "undated" when the page shows no date). Many official pages returned HTTP 403 or a JavaScript shell to curl, so the text was read through Exa highlights. *asserted* = a third party says so (scraper docs, blogs, vendor claims). *inferred* = my reasoning. Terms change monthly; every term below is as of 2026-11-14.

## How this relates to the earlier notes

- Extends [observing-rank-and-performance.md](../../list/nate/observing-rank-and-performance.md) line 92 (eBay may not be used to show sales volume or velocity against a third-party service, or to "suggest or model prices") and line 178 (no sell-through number, because the denominator differs by tool). Section 4 here confirms the second point: two formulas are in circulation, and the eBay restriction in line 92 applies to a velocity or price view built from eBay content.
- Extends [identification-technologies.md](../../identify/nate/identification-technologies.md) Table 5 (lines 83-94), which lists reference data and licences but has no price-history or release-date source. Group 1 and 3 here add StockX, PriceCharting history, Keepa, Amazon, WatchCharts, KicksDB and Card Ladder. It confirms line 68 (WatchCharts 1 request per second per key, now *observed*, section 1.8) and adds that WatchCharts' distribution licence forbids public aggregation and caps shown history at 1 year.
- Extends [comps-sources-live.md](../../price/ben/comps-sources-live.md) and [quality-and-value-classifiers.md](../../price/nate/quality-and-value-classifiers.md) by looking at new-price and release-price sources rather than used comps. I did not re-read them for this note beyond headings, so no line-level contradiction is claimed.
- Extends [analytics-and-recommendations.md](analytics-and-recommendations.md) (sell-through formula, survivorship at lines 31, 32, 96, 97 as cited by the observing note) with the trend-detection and hype-decay methods in group 2.
- Extends [buy.md](../../../spec/features/buy.md): line 13 lists "price history" in the Valuation card and line 15 says Save goes to Watching; neither says where price history comes from. Section 7 here separates a follow from a want. Contradiction to flag: buy.md line 15 treats Save as a want (Watching shelf, optionally liked on the site); in StockX, Lyst and Google the "track" action is a lower-commitment signal than a purchase intent (section 7).
- Extends [insights.md](../../../spec/features/insights.md): it already carries a Source / Wording / Hidden-when table (lines 1-47, 119-130 per my earlier read). The closing design below adds rows for the product page and trends view, using the same three columns; it does not copy the existing rows.

## 1. Price-history products and their data

### 1.1 StockX
- Data terms, section 27 "Access to Data", terms dated 2 July 2026: Platform Data (transactions, pricing, market trends) may not be used "for any commercial purpose, including without limitation, resale, redistribution, or incorporation into any third-party product or service, without StockX's prior written consent". Robots, scrapers, "benchmarking, competitive analysis" and public display of content are barred; "You" includes bots, APIs and AI agents. *observed* https://stockx.com/terms (2026-07-02)
- StockX says it "may make Historical Data available" and does not guarantee its accuracy. *observed* same page.
- Developer API: account needed, review 5-7 business days, OAuth2, no test environment; the reference is seller-oriented (listings, orders, catalog, market data per variant). *observed* https://developer.stockx.com/portal/faqs (undated). Whether it licenses showing history to the public: not found.
- Page fields (what a visitor sees): lowestAsk, highestBid, askCount, lastSale, last 90 days {averagePrice, rangeLow, rangeHigh, salesCount}, annual {averagePrice, salesCount, annualLow, annualHigh, pricePremium, volatility}. *asserted* https://apify.com/autofacts/stockx-scraper (third-party scraper docs, undated).
- Chart: about 100 sampled points; premium is computed over the year; no sales-history endpoint. *asserted* https://dev.to/viktorhendelmann/how-to-scrape-stockx-with-nodejs-product-search-size-level-bids-and-asks-price-history-and-a-1iph (2026-11-09).
- "Price premium" is the percentage over original retail. *observed* https://doi.org/10.5281/zenodo.7824782 (Nazzi, 2023-05-02), which uses it as the dependent variable.

### 1.2 GOAT
- Visible: last sale per size, lowest ask, highest offer, a basic trend graph without individual sales; no sales volume. *asserted* https://sneakerping.com/sneaker-price-history (2026-01-15, a competing tracker).
- Third-party providers expose GOAT release date, retail price, per-size lowest price, last sold price and highest offer. *asserted* https://crawlora.net/platforms/goat (undated, mentions 2026-10-30).
- GOAT terms and API: not found (no page opened).

### 1.3 Sneaker data resellers (how trackers get StockX and GOAT data)
- KicksDB: "Data is collected daily from StockX, GOAT, Flight Club, Kickscrew, Stadium Goods and multiple Shopify stores"; standard API cached and refreshed every 24 hours at most; fields include release_date, retail_price, SKU, GTIN/EAN, price and sales history; real-time API paid only. *observed* https://api.kicks.dev/docs and https://docs.kicks.dev/guides (both undated).
- A tracker states that StockX and GOAT prices "reach us through third-party data providers", with schedules "from every hour to once a day", "alerts arrive hours after a price moves", and that history is built from completed sales because the all-sizes ask floor "drifts down after a release even when real prices hold steady". *observed* https://sneakerping.com/methodology (2026-10-12).
- Another tracker collects once a week, keeps every week, hides pages with n below 5, flags n 5-9 as low confidence (page hidden from search engines), 10-29 medium, 30+ high, never mixes SOLD and ASK, and marks stale data "OLD DATA" with its date, dropping it after two weeks. *observed* https://www.aiplannermail.com/methodology/ (undated). This is a working honest-wording model.
- Whether these resellers hold a licence from StockX or GOAT: not found. *inferred*: StockX's section 27 bars redistribution without written consent, so a downstream app carries that risk.

### 1.4 Keepa and CamelCamelCamel (Amazon)
- Keepa history: an entry is appended only when a value changes; -1 means no offer; entries before 2026-02-23 use listing price and from that date landing price (listing plus shipping); COUNT_NEW_FBA and COUNT_NEW_FBM added March 2026. Index list includes AMAZON 0, NEW 1, USED 2, SALES rank 3, LISTPRICE 4, COUNT_NEW 11, COUNT_USED 12, EBAY_NEW_SHIPPING 28, EBAY_USED_SHIPPING 29, TRADE_IN 30. *observed* https://keepa.com/api-docs/product-object.html (undated, changelog dates inside).
- Offers data updates irregularly; a product is auto-refreshed if older than about 1 hour; token bucket costs: product 1, search 10, deals 5, bestsellers 50; unused tokens expire after 60 minutes; tracking notifications deleted after 24 hours. *observed* https://keepa.com/api-docs/ (undated).
- Keepa terms on storing or showing its data: not found.
- CamelCamelCamel: tracks three price types (Amazon, third-party new, third-party used) with high, low, average; email alerts need only an email address; wishlist import; RSS. *observed* https://camelcamelcamel.com/features (undated). About 6 million products across 9 locales, tracked products checked more often, database populated by searches and extension users. *observed* https://camelcamelcamel.com/blog/how-our-price-checking-system-works/ (2011-12-21, old). A 2019 podcast says data came from Amazon's affiliate Product Advertising API, which now returns only the lowest-price offer, with requests prioritised by user interest. *asserted* https://softwareengineeringdaily.com/wp-content/uploads/2019/05/SED837-CamelCamelCamel.pdf (2019).
- Amazon's own rules: PA-API 5 deprecated (returns 403 AccessDenied), replaced by the Creators API (OAuth 2.0, OffersV2). *observed* https://affiliate-program.amazon.com/creatorsapi/docs/en-us/paapiv5-deprecation (undated). Cache TTL: Offers 1 hour, BrowseNodeInfo 1 hour, other fields 1 day; customer information not cached; sales should be directed to Amazon. *observed* https://affiliate-program.amazon.com/creatorsapi/docs/en-us/concepts/best-programming-practices (undated). Secondary reading: prices may be shown only if Amazon serves them, non-image content stored 24 hours, API access needs 10 qualifying sales in 30 days. *asserted* https://devdome.com/blog/amazon-price-display-rules-affiliates/ (2026-08-16). A price tracker lost its affiliate account for showing prices older than 24 hours. *asserted* https://johnathanward.com/building-a-business-around-a-3rd-party-api/ (2016-03-25).
- *inferred*: Amazon's licence allows a stored series only for 1 hour to 1 day, so a multi-month Amazon price history cannot come from the affiliate API; CamelCamelCamel and Keepa hold theirs by their own collection.

### 1.5 PriceCharting
- Terms (© 2007-2026): Price Data is PriceCharting's property; it may be referenced externally with citation and a visible hyperlink; internal use needs a Legendary subscription; Price Data "cannot be used in any software, application, or system that is accessible to third parties... or the general public, without express written permission". *observed* https://www.pricecharting.com/page/terms-of-service
- API: "Historic prices and historic sales are not supported"; 1 call per second; CSV once every 10 minutes (generated every 24 hours); data purged after the subscription ends; fields include sales-volume (yearly units sold), upc, tcg-id, prices in cents. *observed* https://www.pricecharting.com/api-documentation (undated). The purge clause is already in earlier notes; the public-access bar and "no history" are new here.

### 1.6 Google Shopping price insights and Chrome price tracking
- Price insights say whether a price is low, typical or high and how it changed in recent months; the typical price is based on "sellers across the web"; US only; "This feature doesn't predict how a price may change in the future"; a "30-day low" badge uses total price (item, discount, shipping). *observed* https://support.google.com/faqs/answer/10675605 (undated)
- Chrome price tracking: Australia, Canada, India, Japan, US; needs a signed-in Google account, tab and history sync and "Make searches and browsing better"; on by default for trackable products saved to the Shopping list folder; tracking works without email opt-in. *observed* https://support.google.com/chrome/answer/11625545 (undated)
- Secondary: no custom thresholds, coverage varies, email only and can lag. *asserted* https://www.botbro.io/blog/google-price-tracker (2026-08-13)

### 1.7 Honey and Capital One Shopping
- Honey: Price History on Amazon over 30, 60, 90 or 120 days; Droplist alerts when a price falls below a chosen amount, with a duration and minimum discount; reminders before expiry; "Honey cannot guarantee that a certain price continues to be available." *observed* https://help.joinhoney.com/article/46-can-i-use-this-on-amazon, https://help.joinhoney.com/article/220-how-do-i-use-droplist-on-the-honey-smart-shopping-assistant, https://help.joinhoney.com/article/94-why-did-my-droplist-item-increase-in-price (all undated)
- Droplist tracked prices exclude shipping, tax and handling; litigation over Honey's affiliate behaviour survived dismissal on 2026-06-22 (allegations only). *asserted* https://www.bestmoney.com/financial-advisor/learn-more/price-tracker-apps-browser-extensions (2026-11-11)
- Capital One Shopping: price-drop notifications for items "you've viewed"; comparison includes shipping and membership pricing; a price-history chart is not described. *observed* https://www.capitalone.com/learn-grow/money-management/capital-one-shopping/ (2026-03-12)

### 1.8 WatchCharts (watches)
- API: Level 1 current market price and limited history; Level 2 adds retail prices, appraisals, historical listings; metered credits; 1 request per second per key; pay-as-you-go $199/month ($99 annual), Level 1 $600/month, Level 2 $1,000/month; standard licence is internal use. *observed* https://watchcharts.com/api (undated)
- Licence (updated 2026-04-29): three licences (internal, distribution, resale). Distribution: public aggregation such as building an index is not permitted (private per-user collection tracking is acceptable); only the latest dataset version, 24-hour delay allowed, older versions erased; no manipulating data points unless white-label; no more than 1 year of history shown; attribution next to charts; erase at termination; non-compete; price surcharge 50% (attributed) or 100% (white label). *observed* https://watchcharts.com/api/license (2026-04-29)

### 1.9 Card Ladder and collectibles indices
- CL50 is the sum of the current values of 50 cards divided by 50 (like the early Dow), normalised to start at 1,000; a card's current value is the price it most recently sold at, or the average if several sold that day; "not designed to represent the market trend of the sports card hobby as a whole". *observed* https://cardladder.zendesk.com/hc/en-us/articles/11943112663063-What-is-the-CL50 (undated)
- Ladder cards are a team-verified subset of Sales History, which holds all sales; verified sales are marked with a green check. *observed* https://cardladder.zendesk.com/hc/en-us/articles/11943075474071-What-is-the-difference-between-Ladder-and-Sales-History (undated)
- Industry page: covers online marketplaces for card singles; excludes retail sites and social marketplaces unless verified; coverage "eras" (2010-2021 lacks most eBay fixed price and best offer sales; Dec 2021-Dec 2023 includes most; 2024 onward more tracking), each shown with a coloured dot. *observed* https://cardladder.zendesk.com/hc/en-us/articles/21053788523671-What-is-the-Industry-Page (undated). The idea of labelling a series where the data source changed is reusable.
- Co-founder: 28 million sales since 2004 from 15 marketplaces. *asserted* https://boardroom.tv/card-ladder-chris-mcgill-q-and-a/ (2022-02-26)
- A third-party API wraps Card Ladder (card values by grade, per-day sales history, 40 indexes, a nightly list of sales excluded as suspicious). *asserted* https://reefapi.com/docs/cardladder (undated); Card Ladder's own licence for this: not found.

### 1.10 Release calendars and retail prices for sneakers and streetwear
- KicksDB indexes StockX, GOAT, SNKRS, Novelship and Kream with release_date, retail_price, SKU and barcodes. *observed* https://docs.kicks.dev/recipes/filters (undated)
- Nike's launch pages render from `api.nike.com/product_feed/threads/v2/`; `launchView.startEntryDate` is the drop time (not `commerceStartDate`); stock is a coarse level (HIGH, MEDIUM, LOW, OOS), never a count. The writer notes Nike publishes no documented developer API and its Terms of Use restrict automated access. *asserted* https://www.sparkproxy.io/blog/how-to-scrape-nike-product-data (2026-10-19)
- Sneaker release calendar sites' own terms: not found.

## 2. Trend and hype measurement

### 2.1 Lyst Index
- Quarterly; three dimensions (Desire, Demand, Discovery). Inputs: search momentum (on and off platform), wishlisting and purchase intent, full-price sell-through signals, concentration among the top 1,000 trending items, sell-out speed, social and editorial sentiment processed by AI. Recent signals weigh more; "We do not disclose the exact formula"; brands dependent on markdown traffic are ineligible; platform has "160 million shoppers", "27,000 brands". *observed* https://lystinsights.substack.com/p/unpacking-the-new-lyst-index-methodology (2026-04-29), https://www.lyst.com/the-lyst-index/ (undated)
- Demand reportedly includes clicks, views, likes, basket adds, wishlists and affiliate revenue. *asserted* https://www.highsnobiety.com/p/what-is-the-lyst-index-q3-2025/ (2025-11-05)

### 2.2 Resale reports
- thredUP 2026 report (2026-04-02): GlobalData models market size from consumer surveys, retailer tracking, official data, store observation and secondary sources; survey of 3,268 US adults (Jan-Feb 2026), survey of top 50 fashion retailers, internal data; global $393B by 2030. *observed* https://cf-assets-tup.thredup.com/resale_report/2026/ThredUp_Resale_Report_2026.pdf
- The RealReal 2026 report (2026-08-25): "50 million items sold", "44 million members"; vintage demand up 432% since 2020; saved searches up 650% for a designer-era phrase. After publication the company said the 432% is growth in GMV dollars though the glossary defines demand as search volume, and declined to give counts, starting values or thresholds, saying it used "appropriate thresholds" and excluded outliers. *observed* https://investor.therealreal.com/news/news-details/2026/THE-REALREALS-2026-RESALE-REPORT-REVEALS-RESALE-IS-BECOMING-FIRST-CHOICE-FOR-SHOPPERS/default.aspx (2026-08-25); the clarification *observed* https://wwd.com/sourcing-journal/industry-news/the-realreal-2026-resale-report-vintage-searches-1239148202/ (the search tool shows a 2019 date; the text refers to 2026).
- Depop 2026 report (2025-12-19): "proprietary Depop insights, platform search and sales data and cultural research"; spikes quoted in words, no counts or windows. *observed* https://news.depop.com/company-news/depop-unveils-2026-fashion-trends-report-the-edited-self/ ; 2025 edition was a joint project with EDITED, 2026 Depop alone, 43.5 million users. *asserted* https://wwd.com/sourcing-journal/industry-news/gen-z-fashion-depop-2026-trends-ed-hardy-1238860671/
- Vestiaire: the 2025 impact report is an environmental study (250,000 users surveyed, 13,400 responses, 250,000 transactions); no trend method found. *observed* https://assets.vestiairecollective.com/documents/impact_report_2025.pdf (undated)

### 2.3 Search and social signals
- Google Trends API (alpha): rolling 5-year window, consistently scaled data (not 0-100 per query), alpha applicants only. *observed* https://developers.google.com/search/apis/trends (undated; saved copy in the research folder)
- Pinterest Predicts: volume and growth thresholds, two-year windows, searches normalised to remove seasonality, a trend score, a visual trendline check, "80% accuracy". *observed* https://business.pinterest.com/en-gb/blog/how-we-forecast-trends-pinterest-predicts/ (2022-12-07). A 2026 webinar claims 88% over six years *asserted* (YouTube transcript). The 2026 report measured search change Sept 2024 to Aug 2025, normalised English queries, year over year. *observed* https://fortune.com/2026/10/15/pinterest-predicts-2026-trends-accuracy-brooches-funhaus/ (2026-10-15), https://ppc.land/pinterest-unveils-21-consumer-trends-for-2026-advertising-campaigns/ (2025-12-09)
- TikTok Creative Center (through third-party docs): 7, 30 or 90 day windows, 27 countries, an apparel and accessories board; popularity curve daily, scaled to the window peak (peak day always 100); logged-out users see only the top few entries (3 per filter combination "verified live on 2026-10-18"). *asserted* https://socialtap.dev/docs/reference/tiktok/trending_hashtags/, https://crawlora.net/docs/tiktok/tiktok-creative-center-hashtags, https://apify.com/dami_studio/tiktok-creative-center-trends. TikTok's own help page: not obtained.

### 2.4 Commercial forecasters
- Heuritech: social panels (edgy, trendy, mainstream) over 16 regions from Instagram, RedNote and TikTok; computer vision extracts 2,000+ attributes; growth is year over year, magnitude is demand; claims "92%+ accuracy" up to 24 months ahead (vendor). *observed* https://heuritech.com/articles/forecast-market-demand-through-consumer-data/ (2023-09-21). Ensemble of 5 models scored by MAPE, MASE and SMAPE on a hidden-year backtest. *observed* https://heuritech.com/articles/forecasting-model-trend-prediction/ (2024-05-13). Raw series normalised for biases such as COVID. *asserted* https://medium.com/heuritech/is-fashion-predictable-9894d0861f1e (2024-11-13)
- EDITED: crawls retailer sites; fields include price, first price, full price (highest ever seen), advertised previous price ("EDITED may never have seen the option sold at this price"), stock and discount; full archive 12+ years. *observed* https://build.edited.com/data/dictionary and https://build.edited.com/the-data (both undated). The definition of "full price" as highest seen is useful: a reference price can be defined by what was observed, not claimed.
- Trendalytics: search data on 30,000 terms (Google Trends) plus crawled retailer inventory and price plus social. *asserted* https://zivschwartz.github.io/portfolio/capstone_trendalytics/ (2019-12-17, student project). A student defined trend start t0 by the gap between a 3-week and 12-week moving average and measured retailer lag.
- WGSN: no method page opened. Not found.

### 2.5 Academic work
- A Duke thesis on StockX sales 2016-2020 finds hype and scarcity significant for premium; a Twitter hype variable decays at 5% (about 90 days to near zero) chosen from 1-50%; days since release has a negative sign; restocks lower the premium; R2 0.649. *observed* https://sites.duke.edu/djepapers/files/2020/08/matreiber-dje.pdf (2020).
- A panel study on StockX returns and Google Search Volume finds more investor attention raises returns, with short-term reversal, "driven by attention-grabbing information rather than fundamental value". *observed* https://jurnal.unmer.ac.id/index.php/jkdp/article/view/4434 (undated).
- A Claremont thesis finds age, collaboration and model drive resale price. *observed* https://scholarship.claremont.edu/cmc_theses/2859/ (undated). An ASU thesis predicts profit-or-not at 65-70% accuracy from retail price, brand, gender and tweet counts. *observed* https://keep.lib.asu.edu/items/132957 (undated).
- These are theses and a low-visibility journal, not peer-reviewed benchmarks. The first two give the shape (decaying premium, attention-driven reversals); neither gives a threshold an app can reuse.
- Trend detection from listing data specifically: no paper found (OpenAlex not queried; see Not found).

## 3. Product-release and catalogue data (retail price, release date)
- Sneakers: KicksDB (above) carries release_date, retail_price, SKU, GTIN across StockX, GOAT, SNKRS, Novelship, Kream; downstream licence not shown. *observed* docs.kicks.dev. Nike's feed is undocumented. *asserted*.
- Watches: WatchCharts Level 2 adds retail prices. *observed* (1.8).
- Cards: PriceCharting gives only current prices and yearly units sold, upc and tcg-id. *observed* (1.5).
- General: Shopify Global Catalog, Open Products Facts, Icecat and Amazon Berkeley Objects licences are in [identification-technologies.md](../../identify/nate/identification-technologies.md) lines 91-94. None of these rows says whether they carry a first-retail price or release date; I did not check.
- Keeping the first retail price over time: a store sitting on a retailer page is covered by that retailer's terms. Not found for any retailer.
- *inferred*: a release date and original retail price are facts about a product, and a user or the app can record them with a citation to the maker's announcement; only the source of each row, not the fact, is licensed.

## 4. Measures and definitions

| Measure | Definition found | Needs sold data? | Mark and source |
| --- | --- | --- | --- |
| Resale premium | Percentage over original retail; StockX computes it on an annual basis | Yes (average of sales); asks overstate | *observed* Nazzi; *asserted* scraper docs (1.1) |
| Price retention / depreciation | Theses model days since release as negative; hype decays about 5% per day-step of a tweet-weighted series (~90 days) | Yes | *observed* Duke thesis (2.5). No standard retention curve found |
| Sell-through | Two formulas in circulation, sold/(sold+unsold+active) and sold/active; the denominator is not published by eBay | Yes, plus active count | *observed* [observing-rank](../../list/nate/observing-rank-and-performance.md) line 178 |
| Days to sell | Not defined by any price-history product opened; Lyst uses "sell-out speed" without a formula | Yes, needs listing-to-sale pairs | *observed* Lyst (2.1) |
| Listing velocity | New listings per window; EDITED "new-in counts"; Keepa COUNT_NEW series | No, for listing counts | *observed* EDITED, Keepa |
| Share of search | Not defined by Google Trends API; a normalised index relative to a window | No | *observed* Google (2.3). Standard share-of-search definition: not found |
| Sales count over a window | StockX last 90 days salesCount; PriceCharting yearly units | Yes | *asserted*, *observed* |
| Index level | Sum of current values divided by count, rebased to 1,000; current value is last sale | Yes | *observed* Card Ladder (1.9) |

Weakness shared across sources: a value scaled to its own peak (TikTok, Google Trends per query) cannot compare two products; the two-year Pinterest threshold and Lyst's undisclosed weights cannot be reproduced. *inferred*.

## 5. Rights and limits

| Source | Store a series? | Show publicly? | Mark and source |
| --- | --- | --- | --- |
| StockX | Not without written consent | No ("public display", "incorporation into any third-party product") | *observed* terms 2026-07-02 |
| PriceCharting | Only for internal use on a subscription; purged at end | No, unless written permission; citation with link allowed for "referencing" | *observed* |
| WatchCharts | Latest version only; older erased; 24-hour delay allowed | Yes under a distribution licence; 1 year max; attribution; no public index | *observed* 2026-04-29 |
| Amazon (Creators API) | Offers 1 hour, other fields 1 day | Only what Amazon serves, timestamped | *observed* (undated), *asserted* secondary |
| eBay | At most 6 hours; no co-mingling; no use to model prices | See [observing-rank](../../list/nate/observing-rank-and-performance.md) lines 92 and [identification-technologies.md](../../identify/nate/identification-technologies.md) line 89 | *observed* in earlier notes, not re-opened |
| Keepa | Terms not found | Not found | not-found |
| Google Trends API | Alpha, applicants only | Not found | *observed* page, terms not found |
| Card Ladder | Terms not found | Not found | not-found |
| App's own user data | Yes, with privacy terms | Aggregates, subject to a threshold | *inferred* |

- Which sources let you store and show a time series: WatchCharts (bounded) is the only one opened with a written path. *observed*.
- The eBay position is unchanged from the earlier notes: no stored history beyond 6 hours and no use to model prices. A series derived from eBay content is on the restricted side. Marketplace Insights is gated and 90 days (already in the earlier notes).
- What cannot be known: the price a person paid (only list and ask prices are public on most sites), stock levels (Nike gives only a coarse level), sales on channels no tool sees (Card Ladder excludes card shows and retail), returns and cancelled sales, shipping and tax in a tracked price (Honey excludes them; Google's 30-day low includes them). *observed*, *inferred*.

## 6. Uncertainty, thin data and what makes people return
- Sample-size labels: the weekly tracker shows n on every price and hides below 5, labels 5-9 low, 10-29 medium, 30+ high (1.3). Zillow's median error as a wording model is in the earlier notes. *observed*.
- Coverage varies by product (Google). *asserted*. The Card Ladder data-era dots show a series whose source changed. *observed*.
- A stale series is dated and dropped after two weeks (1.3). *observed*. Honey says it cannot guarantee a price will continue. *observed*.
- Reasons people come back, as stated by the products: alerts when a price falls (Honey, Google, Capital One, CamelCamelCamel, SneakerPing), saved searches with alerts (The RealReal), collection value and gain or loss (StockX), digests (Lyst Index quarterly, thredUP annual). *observed* for features; no retention numbers found for any.
- Alert channel: CamelCamelCamel needs only email; Google tracking can work without email opt-in; a tracker offers SMS or Discord. *observed*. Alert lag of hours is stated by the sneaker tracker. *observed*.
- A tracker advises checking the 30-day history before setting an alert target, because a target below the recent low never fires. *asserted* https://sneakerping.com/how-to-track-sneaker-prices (2026-02-06).

## 7. Saved-interest features (follow vs want)
- StockX launched Collections (what you own, with gain or loss per pair from the price you paid) and Cop List (what you want to buy, to "watch prices to determine the best time to buy"), as two lists. *observed* https://stockx.com/news/en-us/campless-collections-a-k-a-sneaker-portfolios/ (2015-09-17, old). Portfolio items need not be owned. *asserted* https://www.alphr.com/add-item-stockx/ (2020-08-18). The unofficial SDK separates `add_product_to_follow` (a size id) from `add_product_to_portfolio` (purchase price, condition, date). *asserted* https://pypi.org/project/stockx-py-sdk/ (undated). Current StockX help pages for Follow and Portfolio: not found.
- Lyst wishlists and alerts: wishlisting is a Lyst Index input as "wishlisting and purchase intent" (2.1). Lyst's own wishlist help page: not found.
- Pinterest boards: a board is an interest signal feeding the Trends tool; the tool's own description not obtained. Not found.
- Google: Chrome tracking works on a Shopping list folder and is on by default for products saved to it (1.6); Search "track price" is a separate action. *observed*.
- Honey Droplist: item plus threshold plus duration plus minimum discount; the user's price is explicit. *observed* (1.7).
- The RealReal: saved searches with alerts, saved-search growth is published as a trend signal. *observed* (2.2).
- *inferred*: across these products, "follow" is a watch with no stated price (StockX follow, Chrome tracking), "want" has a target price and a deadline (Honey Droplist, Cop List), and "own" has a purchase price (StockX Collections). Only StockX separates all three.

## Closing design (*inferred*; built from data an app may keep)

Data an app may keep, by the sources above: its own users' items and snapshots (the app's own data), a user's own sold prices, WatchCharts-licensed data within its limits (if licensed), citations to public release and retail facts, and its own periodic observations of listing counts where the platform's terms allow. eBay content is kept at most 6 hours (earlier notes), StockX and PriceCharting data not at all.

### Product page (someone who neither sells nor buys)

| Number | Best source | Honest wording | Hidden when |
| --- | --- | --- | --- |
| Release date, original retail price | Maker or retailer announcement, cited, or a licensed catalogue | "Launched [date] at [price] (source)" | No cited source |
| Price now, new | A retailer feed the app is licensed for, cited and timestamped | "New: $X at [store], as of [time]" | Older than the source's TTL (Amazon 1 hour, 1 day) |
| Price now, used | Live listings, shown not stored (eBay 6 hours) | "N listed, from $X to $Y, as of [time]. Asking prices, not sales." | Fewer than 6 listings (the earlier note's floor) |
| Sold range | The app's own users' sold records, or Terapeak-style user-supplied data | "Sold for $X to $Y (n sales, [window])" | n below 5 (the weekly tracker's floor) |
| Price history | The app's own snapshots (min. 3 on different days, [observing-rank](../../list/nate/observing-rank-and-performance.md) line 156); WatchCharts if licensed (max 1 year, attributed) | "Seen since [first date]: [low] to [high]. We started watching on [date]." | Under 3 snapshots, or a series from a source whose terms bar showing it |
| Premium over retail | Median sold price over retail price, both cited | "Used sells for about N% [over/under] the launch price (n sales)" | No sold data, or no retail price |
| Change since release | Premium at day 30, 90, 365 | "Premium was N% at 30 days, N% now" | Under 3 points |
| How many are out there | Own count of live listings per source | "N listed across [sources], as of [time]" | A source failed (say which) |
| Sell-through | Needs sold plus active from the same source | "Of N listed, M sold in 90 days (by [formula])" | Any denominator missing; eBay does not publish it |

Notes: add a source change marker where the data source changed, like Card Ladder's eras; separate asks from sales in the chart (never mix, as SoldSignal does); state when a price excludes shipping and tax.

### Trends view

| Number | Best source | Honest wording | Hidden when |
| --- | --- | --- | --- |
| Rising searches | The app's own search counts, normalised against the app's own total, with seasonality removed (Pinterest approach) | "Searched N% more in this app than a year ago" (own users only) | Under a set count of searchers (a k-anonymity floor) or under 2 years of history |
| Saved-interest growth | Count of follows per product, de-duplicated by account | "N more people follow this than last month" | Under the floor above |
| New listings velocity | The app's own observations | "N new listings this week, was M" | Source unavailable |
| Public search interest | Google Trends API (alpha, if approved), consistently scaled | "Public search interest, scaled across items" | No access |
| Retailer/maker publication | Cited reports (Lyst, thredUP, Pinterest) as links, not as numbers re-derived | "Lyst's [quarter] list says X (their method undisclosed)" | Source older than a year |

Notes: show windows and the source's own method statement; never call a normalised rank a sales count; flag that the app's own users are not a sample of the market. Hype decay can be shown as time since release only for items that have a cited release date.

### The record a follow needs (*inferred*)
- `follow_id`, `account_id`, `product_id` (resolved identity, or a free-text query if unresolved), `variant` (size, condition, or null).
- `kind`: `follow` (no price), `want` (target price, deadline), `own` (price paid, date, condition). Separates the three StockX separates.
- `target_price`, `currency`, `price_basis` (item only, with shipping, with tax), `alert_until`, `min_change`.
- `channel` (in-app, push, email) and `opt_in_at` per channel.
- `created_at`, `source` (search, scan, paste, list), `first_seen_price` and `first_seen_at` (so "since you followed" is possible), `last_notified_at`, `last_value_shown`, `muted_at`.
- `resolved_confidence` of the product match, so an alert is not sent on a weak match.
- A follow is not a purchase intent signal for ads or public counts unless the person opts in; public counts only above a floor.

## Not found
- StockX Follow and Portfolio current help pages; GOAT terms and API terms; Keepa's storage and display terms; CamelCamelCamel terms (403); Card Ladder licence terms; release-calendar site terms; any retailer's terms on storing first retail price.
- Lyst wishlist help page; Pinterest Trends tool method and board signals; TikTok Creative Center's own help page; WGSN method; Vestiaire trend method; EDITED and Trendalytics own method pages beyond the data dictionary.
- Any peer-reviewed paper on trend detection from resale listing data; a standard depreciation curve for consumer goods; a standard share-of-search formula; retention numbers for follow or alert features.
- Whether KicksDB or any reseller holds a licence from StockX or GOAT.
- OpenAlex was not queried (time); the academic part rests on Exa results only.

## Sources fetched
All through Exa search or fetch on 2026-11-14 unless noted; text read from highlights, not whole pages.
- Official or first-party: stockx.com/terms; developer.stockx.com/portal/faqs; pricecharting.com terms and api-documentation; keepa.com/api-docs and product-object; camelcamelcamel.com features and 2011 blog; watchcharts.com/api and /api/license; Amazon Creators API pages (2); support.google.com FAQ and Chrome pages; help.joinhoney.com (3); capitalone.com; developers.google.com/search/apis/trends; Lyst Index and Lyst Insights Substack; thredUP report PDF; The RealReal press release; Depop newsroom; Vestiaire impact report; Pinterest business blog; heuritech.com (2 articles); build.edited.com (2 pages); cardladder.zendesk.com (3 articles); api.kicks.dev and docs.kicks.dev; stockx.com/news 2015.
- Secondary or third-party (labelled *asserted*): dev.to StockX scraping; apify actors; softwareengineeringdaily PDF; devdome; johnathanward.com; botbro.io; bestmoney.com; highsnobiety; WWD (2); fortune.com; ppc.land; socialtap.dev; crawlora.net (2); medium Heuritech; zivschwartz.github.io; boardroom.tv; reefapi.com; sneakerping.com (3); aiplannermail.com; sparkproxy.io; alphr.com; pypi stockx-py-sdk; Duke, Claremont, ASU theses and the unmer journal article; Zenodo Nazzi.

### Searched / could not reach
- curl returned 403 or a JavaScript shell for StockX, CamelCamelCamel, GOAT, WatchCharts, Card Ladder, Lyst, Keepa, Pinterest and TikTok; the Exa highlights stood in. A narrow search does not show that pages elsewhere on those sites are absent.
- Unopened: Vestiaire trend report, WGSN, Lyst quarterly pages beyond the method post, Pinterest Trends tool page, TikTok help centre, sneaker release calendars' terms.
- Not re-read in this run: [comps-sources-live.md](../../price/ben/comps-sources-live.md) and [quality-and-value-classifiers.md](../../price/nate/quality-and-value-classifiers.md) body text; the insights.md line numbers are from an earlier read.
