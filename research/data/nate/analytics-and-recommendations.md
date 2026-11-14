# Which demand and performance signals about a secondhand product can be obtained as of November 2026, from where, what may an app honestly claim from them, and how should a person's own listings and profile drive what they are recommended to buy?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: data.

Evidence marks: *observed* = I opened the source and it says so (URL and the source's own date given where the page shows one; "no date on page" otherwise). *asserted* = a search snippet, vendor claim or memory; I did not see the primary text. *inferred* = my reasoning. "Unopened" = I saw the URL only in a search result. Today is 2026-11-14; anything below that depends on prices, plan limits or access gates can change within months.

## 0. How this note relates to the existing notes

| Existing note | Relation | Detail |
|---|---|---|
| `../../price/ben/comps-sources-live.md` line 38 (Browse API, active only) | Confirms and extends | *Observed* (eBay Browse API markdown mirror, fetched 2026-11-14, no date on page): the item response also carries `watchCount` (gated by App Check) and `estimatedSoldQuantity`, which is a per-listing sold count for multi-quantity listings, not a market sold count. Ben's table lists title, price, bids, condition; these two are the demand-side fields. |
| `../../price/ben/comps-sources-live.md` line 51 and `../../price/ben/sold-price-data.md` line 22 (Terapeak, 3 years, no API) | Confirms, extends | The tool is now called "Product research". Sell-through is defined, with conflicting formulas (section 1.2). |
| `../../price/ben/comps-sources-live.md` line 111 (Facebook sold listings vanish within days) | Confirms, extends | Consequence for counts: any "sold" number for Facebook is only what the app itself saw disappear, not a market figure (section 3). |
| `../../price/ben/comps-sources-live.md` line 137 (Memo23 StockX actor: `salesLast72Hours`, `last90DaysSalesCount`) | Confirms | Same fields; I add that StockX's own developer programme is approval-gated (asserted, section 1.8). |
| `../../price/ben/comps-sources-live.md` line 159 and `../../price/ben/sold-price-data.md` line 21 (licence section) | Possible conflict, not resolved | Line 159 says the restriction is "§9 item 6" and that the blog's "§9.5" is wrong; line 21 repeats the blog's "§9.5". I did not re-open the licence text in this run, so I cannot say which numbering is current. What both agree on: eBay licence terms restrict using eBay content to model or suggest prices and to compare performance across services. That bears on every "your listing vs the market" and "this channel vs that one" number below. |
| `../../price/ben/what-market-value-is.md` line 31 (liquidity: sell-through, days to sell) and line 89 (say "not enough sales" rather than guess) | Confirms, extends | Section 4 gives numeric floors that exist in the wild (MMR 6 sales in a year or 2 in 90 days, per Ben) and states there is no published universal minimum. |
| `../../watch/ben/one-search-box.md` line 42 (hybrid index of active and sold) and `../../watch/ben/fanout-and-watch-loop.md` line 38 (Depop `webapi` search) | Extends | Active counts come free from a search; sold counts only from sources in section 1. Depop `like_count` is in Ben's note; section 2 adds what the seller sees. |

I did not find a place where this note contradicts Ben's notes on a fact, other than the licence section numbering above.

## 1. Where each signal can come from

### 1.1 eBay APIs

- **Browse API.** *Observed* (https://developer.ebay.com/develop/api/buy/browse_api.md, fetched 2026-11-14, no date on page): item search returns active listings only; item detail includes `watchCount` (App Check restricted) and `estimatedSoldQuantity`; `getItems` (bulk) is partner-only. Free developer account; 5,000 calls a day per Ben (comps-sources-live.md line 159, observed there). Freshness: live.
- **Marketplace Insights API (sold items, 90 days).** *Asserted* (search snippet; the `.md` mirror returned 404) and per Ben (comps-sources-live.md line 159) "Limited Release", needing eBay approval. I could not open the terms.
- **Sell Analytics API, traffic report.** *Observed* (https://developer.ebay.com/develop/api/sell/analytics_api.md and https://developer.ebay.com/develop/guides/analytics-and-reporting-guide.md, fetched 2026-11-14, no date): the seller's own data only (OAuth user token): impressions, page views, click-through rate, sales conversion rate, by listing and by traffic source; up to 90 days per request, about 2 years of history. No watcher count, message count or offer count metric in this report. *Inferred*: watchers per own listing come from the Browse `watchCount` (App Check) or the Trading API, which I did not open.
- **Licence.** See section 0 (not re-opened).

### 1.2 Terapeak / Product research

- *Observed* (https://www.ebay.co.uk/sellercentre/news/2024-october/product-research-tool, fetched 2026-11-14, page published October 2024): "With the new sell-through rate metric, you'll be able to see the percentage of similar items sold during a specific period of time." Actual sold price includes the accepted price on Best Offer listings. Available to sellers in Seller Hub who have made at least one sale, desktop and app. No API.
- *Asserted* (eBay Community post, https://community.ebay.com/t5/Selling/How-to-interpret-sell-through-rate-on-Product-Research-Terapeak/td-p/34854843, unopened, snippet only): the formula is Sold / (Sold + Unsold + Active), capped at 100%. A different guide variant is sold / active, which can exceed 100%. So "sell-through rate" has at least two definitions in circulation; an app must state which it uses.
- *Asserted*: a 2021 Practical Ecommerce article says the rate is not shown for a one-year view. Unverified for three years.
- Freshness: sold history up to three years (Ben, comps-sources-live.md line 51).

### 1.3 eBay sold-item search, and the other marketplaces' sold filters

- eBay sold and completed search on the website: per Ben, 90 days when signed in (comps-sources-live.md line 43). Not re-opened.
- Poshmark, Depop, Mercari sold filters: covered in Ben's notes (comps-sources-live.md around lines 100-140); I did not re-test them.
- Facebook: sold listings vanish within days (comps-sources-live.md line 111).

### 1.4 Google Trends

- *Observed* (https://developers.google.com/search/apis/trends, fetched 2026-11-14): the Trends API is an alpha with gated access; data is "consistently scaled", not the 0-100 relative index of the website, and covers a 5-year window. No pricing published. Search interest is a Google-wide proxy for demand for a product name, not marketplace search volume. *Inferred*: consistent scaling allows comparing two products to each other, which the 0-100 index per query does not.

### 1.5 Google Shopping / Merchant data and retailer pages

- *Observed* (https://developers.google.com/merchant/api/guides/products/overview, page "Last updated 2026-10-26 UTC"): the Merchant API manages the merchant's own product data. *Inferred*: it is a write-your-own-catalogue interface, not a way to read another merchant's prices. I did not find a public competitor-price feed there. Price benchmark / best-sellers reports exist for merchants with accounts (asserted from memory, unopened).
- Retailer product pages and schema.org `Product`/`Offer` markup give the original retail price and the GTIN where the retailer publishes it. *Asserted*, not opened in this run; Ben's notes cover identification.

### 1.6 UPC / GTIN databases

- *Asserted* (search snippet on UPCitemdb docs, https://www.upcitemdb.com/wp/docs/main/plan, unopened): free plan 100 requests a day per IP, 6 lookups a minute; paid DEV plan $99 a month for 20,000 lookups a day. Docs disagree with each other on the search cap (20 vs 40 a day).
- *Asserted* (GS1 factsheet, https://gs1.org/sites/default/files/docs/gepir/GEPIR_Factsheet.pdf, unopened): GEPIR was replaced by "Verified by GS1" at the end of 2023. A GTIN identifies the brand owner and a product, but gives no price.
- Open Food Facts / Open Products Facts: open licence data (asserted), food and household coverage only.
- Frame: a GTIN tells the app what the thing is. It carries no demand signal.

### 1.7 Keepa-style trackers

- *Asserted* (RevenueGeeks, "updated July 2026", https://revenuegeeks.com/software/keepa/api, unopened): Keepa API €49 a month for 20 tokens a minute, up to €11,099 a month for 10,000 tokens a minute; tokens expire after 60 minutes. I could not verify against keepa.com (the page is a JS shell; fetched 2026-11-14, 9 KB, no prices). Keepa tracks Amazon new and marketplace-seller prices and sales rank: an original-retail and new-price history signal, not a used-goods sold signal.

### 1.8 StockX, GOAT, Grailed, The RealReal, WorthPoint, PriceCharting

- **StockX.** *Asserted* (apievangelist.com, https://providers.apievangelist.com/providers/stockx/, unopened): an approval-gated Developer Program with a public API v2 (catalogue, live bids and asks, seller listings). Most online StockX data comes from unofficial wrappers or Apify actors (Ben, comps-sources-live.md line 137). Whether last-sale is exposed officially: not found.
- **GOAT:** no official partner API found. **Grailed:** a provider directory says there is no public API (asserted, https://providers.apievangelist.com/providers/grailed/, unopened). **The RealReal, WorthPoint:** WorthPoint returned 403 to a direct fetch (2026-11-14); no API terms found for either.
- **PriceCharting.** *Observed* (https://pricecharting.com/api-documentation, fetched 2026-11-14, no date on page): "API's are a premium tool. You must have a paid subscription to access the API"; each subscription has a 40-character token; "All data gathered from the API or CSV must be purged after your subscription has ended." The page mentions a sales-volume field. *Inferred*: the purge clause rules out keeping a derived history after cancelling.

### 1.9 Scraped-data vendors

- Apify actors and similar sell scraped listings for Poshmark, Mercari, Depop, StockX, Grailed (search results 2026-11-14, e.g. https://apify.com/logiover/poshmark-scraper, unopened). *Inferred*: they return public page data, so they inherit each site's limits (sold hidden, counts missing) and each site's terms on scraping apply to the app. Ben's notes (comps-sources-live.md lines 130-140) already tabulate fields; I add no new vendor.

## 2. Own-listing interest stats, per marketplace

| Marketplace | What the seller sees for their own listing | Via API? | Mark and source |
|---|---|---|---|
| eBay | Impressions, views, click-through, conversion, by source, 90-day windows; watchers; offers in Seller Hub | Yes for traffic report (Sell Analytics, OAuth); watchers via Browse `watchCount` gated by App Check | *Observed* 1.1 above |
| Etsy | `views` (tabulated once a day, active listings only, not real time) and `num_favorers` on the listing object | Yes, Etsy Open API v3 | *Observed*: https://www.etsy.com/openapi/generated/oas/3.0.0.json fetched 2026-11-14 (no date on page); field text quoted: "The number of times the listing has been viewed. This value is tabulated once per day and only for active listings, so the value is not real-time." |
| Poshmark | "Listing Metrics": impressions, clicks, likes, seller offers, buyer offers, days listed on the listing details page | No public API found | *Asserted* (search result snippet of a Poshmark blog post; undated; unopened body). *Observed* separately (https://blog.poshmark.com/understanding-your-performance-metrics, published 2024-05-14): Promoted Closet dashboard defines Clicks, Listings Sold (within 28 days of a promoted click), Sales, Spend, CPC, CTR = clicks / impressions, CVR = listings sold / clicks. Those are ad metrics, paid. |
| Depop | View counts clearly documented for boosted listings; likes visible; Shop stats | No public API for sellers | *Asserted*; Depop help pages returned 403. Ben notes `like_count` in the public `webapi` (fanout-and-watch-loop.md line 38). |
| Mercari | Likes appear visible to sellers per third-party writing; no official help page on seller view counts found | No | *Asserted* (search, 2026-11-14); not found officially |
| Vinted | Not researched at primary level; not found | No public API found | not-found |
| Facebook Marketplace | Seller insights not confirmed; sold listings vanish | No | not-found (see Ben, line 111) |

*Inferred* design consequence: only eBay and Etsy offer a documented route to own-listing numbers. For Poshmark, Depop and Mercari the figures live in the app and would have to be entered or read from the app's own session; messages and offers per listing have no documented API on any marketplace I checked. Time to sell is derivable from the app's own listing and sold events, whichever marketplace.

## 3. What cannot be known, and the proxy

- True search volume on closed marketplaces (eBay, Poshmark, Depop, Mercari, Facebook): *not found* as a published figure for any. eBay's traffic report gives impressions and views of the seller's own listings only (observed, 1.1). *Inferred*, and common practice: the proxies are (a) Google Trends interest for the product name (1.4); (b) watcher or like counts on live listings (`watchCount`, `like_count`); (c) the ratio of sold to active in a window (sell-through); (d) search suggestions and saved-search counts inside the app's own user base.
- Sold counts where sold listings are hidden (Facebook; Poshmark and Mercari sold filters unavailable or unofficial to an API): *inferred* the only available count is of listings the app itself saw go from active to gone. That undercounts, because a listing can vanish by deletion or by sale, and cannot be told apart without the sold flag.
- eBay `estimatedSoldQuantity` counts sales of one multi-quantity listing (observed, Browse docs); it is not a market count.

## 4. Statistical honesty

- **Minimum sample for a range.** *Not found*: no marketplace publishes a minimum for its price range. The only floor seen is Ben's note: MMR needs 6 sales in a year or 2 in 90 days (what-market-value-is.md line 31 and comps-sources-live.md; not re-opened here). *Inferred*: with fewer than about 6 comps a percentile range is not meaningful; show the individual sales. I found no source for 6 as a statistical rule; treat as a product floor, not a theorem.
- **Asking versus sold bias.** *Inferred*, and consistent with Ben (what-market-value-is.md line 89): active listings include overpriced items that never sell, so asking medians sit above sold medians. Best-Offer listings show the accepted price on eBay's Product research (observed, 1.2) but the listed price in search.
- **Survivorship.** Sold-only data excludes items that did not sell; a median of sold prices says nothing about how long or how many failed to sell. Sell-through is the correction, but it has two formulas (1.2).
- **Sell-through definitions** to disclose: window length; whether active listings are in the denominator; whether cap is 100%.
- **How others word uncertainty.**
  - Zillow: *asserted* (search result, Zillow's page returned 403 to me, 2026-11-14): it publishes a nationwide median error, 1.83% on-market and 7.01% off-market on a table "last updated July 28, 2025"; it says a Zestimate is not an appraisal. Accuracy varies by area.
  - Terapeak: no error band is shown; the wording is "similar items sold during a specific period of time" (observed, 1.2).
  - Kelley Blue Book: the page returned 403 (2026-11-14); not found.
  - *Inferred*: the Zillow model (a published median error, a statement of what it is not, a local-data caveat) is the only one of the three with a stated error figure.
- OpenAlex (keyless, 2026-11-14) returned no usable paper on asking-versus-transaction price bias in marketplaces: a narrow search, not proof none exists.

## 5. Recommendations: how marketplaces personalise, and cold start

- **eBay.** *Observed in snippet only* (search 2026-11-14; arXiv https://arxiv.org/pdf/2102.06156, and posts on https://innovation.ebayinc.com/, all unopened): item embeddings from content features (title, image, aspects), user embeddings from onsite activity; a two-tower retrieval with nearest-neighbour search; an initial A/B test surface-rate gain of about 6% (paper abstract). The cold-start framing: millions of new items a day, so content features carry new listings.
- **Mercari.** *Asserted* (unopened pages, https://engineering.mercari.com/en/blog/entry/20221004-attempt-to-improve-item-recommendation-accuracy-using-item2vec, https://engineering.mercari.com/en/blog/entry/20230612-cf-similar-item, https://engineering.mercari.com/en/blog/entry/20241104-similar-looks-recommendation-via-vision-language-model): item2vec, collaborative filtering plus a vector search engine, fine-tuned SigLIP image embeddings for "similar looks", a contextual bandit for home-screen layout.
- **Etsy.** *Asserted* (unopened, https://codeascraft.com/2020/10/29/bringing-personalized-search-to-etsy/, https://arxiv.org/pdf/2306.04833v1.pdf): listings represented by tf-idf, interaction embeddings and graph embeddings; a unified embedding retrieval model; "style" embeddings (KDD 2019).
- **Vinted.** *Asserted* (search snippet of Vinted help page https://www.vinted.com/help/31, 403 to me): the feed uses categories, sizes and followed brands the user sets; with personalisation off, listings are recommended only on item data and size. Engineering posts on dense retrieval and autocomplete exist (unopened).
- **Depop.** *Asserted* (https://www.depop.com/blog/depop-product-release-jan-2025/, unopened): a personalised feed "tailored to user size, style and preferences"; job postings list cold-start users and listings as active problems. No Depop engineering post on the method found.
- **Poshmark.** No engineering post found.
- **Cold start from the seller's own listings** (*inferred*, from the above): a new user with listings already has (a) sizes, from the size field of their listings and what they have sold in; (b) brands; (c) a price band from their asking prices and sold prices; (d) category and style, from image and title embeddings, as eBay and Mercari embed listings. Peer systems differ: Vinted asks the user to state sizes and brands; eBay and Mercari infer from behaviour. *Inferred caution*: what a person sells is not what they buy; it signals taste and the sizes of the people they own clothes for (often themselves, sometimes a family member), and it is the wrong signal for sizes if the closet is being cleared because it no longer fits.
- **Measured-fit matching.** *Asserted* (Zalando corporate page https://corporate.zalando.com/en/node/10416, search snippet, unopened): body-measurement size recommendations from July 2023; a RecSys 2019 paper on deep learning for size and fit (OpenAlex DOI https://doi.org/10.1145/3298689.3347006); a 2023 paper on size and fit for cold-start customers (https://doi.org/10.5121/ijci.2023.120102). *Inferred*: for secondhand clothes there is one item per size, so matching measured garment dimensions (chest, waist, length) against stated body or against a garment the person owns and likes is possible; brand size labels vary, which is the stated obstacle in the fashion literature.
- **Risks** (*inferred* unless noted):
  - Recommending someone their own item: exclude any listing whose seller account is the user's, and listings that match the user's own listings by image or GTIN (Ben's cross-listing matching in fanout-and-watch-loop.md line 88 applies).
  - Filter bubbles: a recommender trained on what a person lists and views narrows over time; Mercari's use of a bandit for layout is a published mitigation (asserted).
  - Privacy of inferred sizes: sizes and body measurements are personal data in many jurisdictions; an inferred size should be shown to the user and editable, and not shared with sellers. Vinted's help page states sizes are user-set and personalisation can be turned off (asserted).

## 6. Closing table (*inferred*)

Each row is the number the product wants to show. Best source is the best I found as of 2026-11-14. "Hide when" is the condition under which showing it would not be honest.

| Number | Best source (URL, date checked) | Honest wording | Hide when |
|---|---|---|---|
| Original retail listing and price | Retailer page or schema.org `Offer`; GTIN lookup to find the product (https://www.upcitemdb.com/wp/docs/main/plan, asserted, 2026-11-14) | "Listed by <retailer> at <price> on <date>" with link | No retailer page matched by GTIN or title; the page is older than the retail price date the app can show |
| Competing secondhand prices per marketplace | eBay Browse (active, https://developer.ebay.com/develop/api/buy/browse_api.md, 2026-11-14); others via own search (Ben) | "Asking prices of N live listings, lowest X, median Y" | Fewer than about 6 comps; asking prices on a marketplace with no sold data presented as sold |
| How many have sold | eBay Marketplace Insights (gated, 90 days, asserted) or Product research (manual, 3 years, no API; https://www.ebay.co.uk/sellercentre/news/2024-october/product-research-tool, 2024-10); StockX actor fields (Ben) | "N sold on eBay in the last 90 days" naming the marketplace and window | Only multi-quantity `estimatedSoldQuantity`; Facebook; any marketplace where sold is hidden; licence not satisfied |
| How many buyers are interested | eBay `watchCount` (App Check, Browse docs 2026-11-14); likes on Depop (Ben) | "N people are watching the live listings" (watchers on competing listings, not searchers) | App Check not granted; counts only on a handful of listings |
| How many are searching | Google Trends API alpha (https://developers.google.com/search/apis/trends, 2026-11-14) | "Google search interest for <name> is higher / lower than <name2> over 5 years" | No access to the alpha; the name is ambiguous; the product has no distinct search term |
| How many for sale now | Browse `total` plus own searches on other marketplaces | "N live listings found on <marketplaces searched> as of <time>" | A marketplace was not reachable in this run; do not sum across marketplaces as if complete |
| Top performing similar listings | Listings that sold fastest or at the highest percentage of asking, from sold data; eBay Browse `watchCount` for live ones | "Similar listings with the most watchers" or "that sold within N days" | Sold dates not available; sample under about 6; marketplace licence forbids cross-service performance comparison (section 0) |
| Own listing: views | eBay Sell Analytics traffic report (2026-11-14); Etsy `views` (once a day, active only) | "Views as reported by <marketplace>, updated <time>" | Poshmark, Depop, Mercari, Facebook, Vinted: no API found; show only if the seller enters it |
| Own listing: likes or watchers | Etsy `num_favorers`; eBay `watchCount`; Poshmark and Depop in-app only | "<N> likes on <marketplace>" | No API route on that marketplace |
| Own listing: messages | None found on any marketplace | n/a | Always, unless the app itself receives the messages (Ben's messages feature) |
| Own listing: offers | Poshmark in-app only (asserted); eBay Best Offer in Seller Hub | "N offers received" | No documented API route; do not infer from sold price |
| Time to sell | The app's own listing and sold events | "Sold N days after you listed it" | The listing was created outside the app and no list date is known |
| Sell-through rate | Product research (observed 2024-10, formula unclear) or own calculation | "Of N similar items, M sold in the last 90 days" and state the denominator | Window, denominator or formula not known; value over 100% |
| Price range (low, typical, high) | Sold comps | "Based on N sales from <dates>" | N below the floor; sold data absent |

## Not found

- Marketplace Insights terms (the `.md` mirror 404ed): wording and approval criteria not seen first-hand.
- Official seller-stat help pages for Poshmark Listing Metrics, Depop, Mercari, Vinted, Facebook: all unopened or 403.
- StockX developer terms and any `lastSale` field; GOAT, Grailed, The RealReal and WorthPoint APIs.
- Kelley Blue Book wording (403); Zillow's own page (403), only a snippet.
- Etsy API terms on storing or displaying data (not found).
- Eight of the engineering posts in section 5 were not opened; only snippets.
- A published minimum sample for a marketplace price range; a Poshmark engineering post.
- eBay licence text re-check (numbering conflict in Ben's notes).

## Sources fetched

| Source | URL | Date |
|---|---|---|
| eBay Browse API (md mirror) | https://developer.ebay.com/develop/api/buy/browse_api.md | fetched 2026-11-14, no date on page |
| eBay Sell Analytics API (md) | https://developer.ebay.com/develop/api/sell/analytics_api.md | fetched 2026-11-14, no date |
| eBay analytics guide (md) | https://developer.ebay.com/develop/guides/analytics-and-reporting-guide.md | fetched 2026-11-14, no date |
| eBay UK Seller Centre, Product research tool | https://www.ebay.co.uk/sellercentre/news/2024-october/product-research-tool | page dated 2024-10 |
| Google Trends API | https://developers.google.com/search/apis/trends | fetched 2026-11-14 |
| Google Merchant API products overview | https://developers.google.com/merchant/api/guides/products/overview | Last updated 2026-10-26 |
| Etsy Open API v3 OpenAPI file | https://www.etsy.com/openapi/generated/oas/3.0.0.json | fetched 2026-11-14, no date |
| Poshmark Promoted Closet metrics | https://blog.poshmark.com/understanding-your-performance-metrics | 2024-05-14 |
| PriceCharting API documentation | https://pricecharting.com/api-documentation | fetched 2026-11-14, no date |
| Keepa site | https://www.keepa.com/ | fetched 2026-11-14, JS shell, no prices |
| Existing notes in `../../price/ben/` and `../../watch/ben/` | relative paths in section 0 | repo at commit 7dc8f30 |

Searched but only snippets seen (not opened): Zillow, UPCitemdb, GS1, RevenueGeeks, apievangelist, eBay community, Vinted help, Depop blog, Mercari and Etsy engineering posts, Zalando, arXiv papers, OpenAlex.

## Searched / could not reach

- 403 or JS shell: eBay help pages, Depop help, Vinted help, Zillow, Kelley Blue Book, WorthPoint, Poshmark blog Listing Metrics post body, Mercari help.
- Etsy docs site returned a redirect; used the OpenAPI JSON instead (the Etsy GitHub path 404ed).
- OpenAlex searches for sell-through definitions, asking-versus-sold bias and size recommendations; only size and fit returned relevant works.
- A narrow search does not prove something does not exist; every "not found" above is a limit of this run.
