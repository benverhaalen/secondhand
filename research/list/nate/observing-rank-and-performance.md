# As of November 2026, how can a system measure from the outside which listings a marketplace puts at the top for a product, why, and how similar listings perform, and turn that into honest choices for one listing's title, photos, attributes, price and timing?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: list.

Evidence marks: *observed* (I opened the source; URL and the source's date given), *asserted* (the source claims without showing, or from memory), *inferred* (my reasoning). "Unopened" means I saw a link or snippet only. "Search highlight" means the text came from a search result excerpt, not a full page read.

Existing notes this extends (cited by file and line):
- [comps-sources-live.md](../../price/ben/comps-sources-live.md) lines 13, 24-29, 32: eBay licence clauses and what they mean.
- [platform-access.md](../../connect/nate/platform-access.md) line 46: AI-training and arbitrage clauses.
- [analytics-and-recommendations.md](../../data/nate/analytics-and-recommendations.md) lines 11, 31, 32, 96, 97: Product research, sell-through formula, survivorship.
- [fanout-and-watch-loop.md](../../watch/ben/fanout-and-watch-loop.md) lines 34-41: fields each site's search returns.
- [platform-levers.md](platform-levers.md) lines 35, 55, 60, 104: stated ranking and visibility rules per site.
- [listing-fields-by-platform.md](listing-fields-by-platform.md): listing fields (not re-read in this run; named as the sibling note only).

## 1. Existing tools and how they work

| Tool | What it measures | Stated method | Mark and source |
|---|---|---|---|
| eBay Product Research (formerly Terapeak) | Last 3 years of sales: sales trend, average sold price, sold range, average shipping and free-shipping share, sell-through, number of sellers, selling format, accepted Best Offer prices | A listing or sale must match the keywords exactly to be included. Completed-listings search covers 90 days. Sell-through only for searches of items sold 90 days ago or less. eBay publishes no denominator or formula. | *Observed* (Exa highlight, undated): https://www.ebay.com/help/selling/selling-tools/product-research?id=4853. Sell-through "percentage of similar items sold during a specific period": *observed*, https://www.ebay.co.uk/sellercentre/news/2024-october/product-research-tool (2024-10). No formula: *asserted* by https://www.sellergrowthtools.com (2026-08-20, secondary). This confirms [analytics-and-recommendations.md](../../data/nate/analytics-and-recommendations.md) line 31 and sits beside its line 32 (a community formula, unopened). |
| eBay Seller Hub Listing Quality report | Per category (10 with most live listings): impressions, clicks, conversion funnel, with recommendations (for example fill 7 item specifics, offer order-size discounts, handling time 1 day) | Recommendations "based on information about what 10% most successful sellers are doing"; 31-day benchmark window, refresh every 24 hours, changes take two days to show. The "10% most successful" is not defined. | *Observed* (undated, a reseller's help page quoting eBay): https://export.ebay.com/en/growth/promotion-strategies/listing-quality-report/. Treat the method as *asserted* (second-hand wording of eBay's report). |
| eBay announcements on listing quality | Titles max 80 characters, first about 60 always visible; "L@@k"-style symbols can "cut CTR by up to 4x"; "Sellers who provide at least 7 attributes perform over 2x better than those with 1" | No method shown for either number | *Observed that eBay says it*, *asserted as evidence*: https://community.ebay.com/forum/announcements-57928/topic/list-smarter-sell-more-this-holiday-season-8587/ (2025-11-12). |
| eBay Browse API (the sort and Best Match) | Active listings only. Sorts: `price`, `-price`, `distance`, `newlyListed` (by `itemOriginDate`), `endingSoonest`. "If no sort parameter is submitted, the result set is sorted by 'Best Match'". | There is no `bestMatch` value, so an observer cannot request Best Match explicitly; it is only what you get with no `sort`. Summary fields include `priorityListing`, `topRatedBuyingExperience`, `unitPrice`, `itemCreationDate`, `itemEndDate`, `watchCount`, `estimatedSoldQuantity`, `qualifiedPrograms`. Some fields are Limited Release for select partners. A `priorityListing` filter exists but is not supported for every marketplace or sort. | *Observed*, https://developer.ebay.com/develop/api/buy/browse_api.md (the markdown mirror; the HTML reference returned 403 to curl; page undated). |
| ZIK Analytics | "Live sold listings data", 9 eBay marketplaces; seller metrics default 30 days; sell-through defined as "sales vs active listings"; claims "ZIK tracks 95% of eBay sellers"; category reports from "proprietary eBay data" over a rolling 30 days | No collection method stated | Vendor claims, *asserted*: https://www.zikanalytics.com/ebay/product-research, https://help.zikanalytics.com/en/articles/11603180-mastering-ebay-competitor-research-with-zik-analytics (2026-08-13), https://www.zikanalytics.com/reports/ebay. The sell-through definition differs from eBay's and from the community formula: *inferred*, three definitions are in use. |
| Algopix | Sales estimates, pricing, competition, profit by keyword, UPC or ASIN | None found | *Asserted* from a competitor's page (ZIK blog, 2026-06-05, unopened as a primary). Method *not found*. |
| eRank (Etsy) | Keyword searches, clicks, CTR for the past 12 months; Keyword Tool analyses the top 100 listings for a keyword; Rank Checker; Spotted on Etsy; competitor sales estimates | Rank Checker shows rank "without promoted listings or Etsy's context-specific ranking (personalization)". Spotted on Etsy uses "random Etsy searches" that find listings in the first 100. Sales are estimated. | *Observed*: https://help.erank.com/features/ and https://help.erank.com/blog/use-erank-to-find-tags-for-your-etsy-listings/ (2025-04-29). A ListifyAI blog (2026-04-28, secondary) says eRank's volumes are third-party estimates: *asserted*. |
| Marmalead (Etsy) | Per keyword: Searches, Engagement (clicks), Competition (listing count) | Engagement is a composite score; one comparison calls it a black box | *Observed* that the three columns exist: https://blog.marmalead.com/keyword-nets-for-etsy-seo/ (2025-05-21). Black box: *asserted*, tagrankr (2026-06-23, secondary). |
| Marketplace Pulse | Marketplace-level seller and listing data, including an eBay seller rank "based on the number of positive reviews received during the last 30 days" | "Proprietary software parses raw data from web-scraping and APIs" | *Observed*: https://www.marketplacepulse.com/data and https://www.marketplacepulse.com/about (undated). |
| Keepa (Amazon-centred, with eBay price series) | Price history types include 28 `EBAY_NEW_SHIPPING`, 29 `EBAY_USED_SHIPPING`, 2 `USED`, 3 `SALES` (rank) | Entries are appended only when a value changes (event series, not regular samples). Before 2026-02-23 prices are the lowest listing price; from then, lowest landing price including shipping. Keepa warns: "eBay listings often have incorrect information... Use eBay price history information with caution". | *Observed*: https://keepa.com/api-docs/product-object.html. |
| Poshmark seller analytics | Listing-level impressions, clicks, likes, seller offers, buyer offers, days listed; Posh Stats (ship time, cancellation rate) visible only to the seller; My Inventory Report (listing date, days listed, likes history, lowest price); My Sales Report | Own-listing counts from Poshmark's own data | *Observed*: https://blog.poshmark.com/2026/04/06/sellerupdatesapril6/ (2026-04-06). Inventory and Sales Reports: *asserted* from a 2026-01-25 guide (unopened as primary). Poshmark's claim that an offer to likers or a price drop "increase your chance of making a sale by 80-90%" is *asserted* (no method). Offer to Likers needs a price drop of at least 10% (same guide, *asserted*). Third-party: SellerInsight imports the Sales Report (*asserted*). |
| Depop shop tools | Vendex Chrome extension takes daily snapshots of own-listing views, likes and clicks and detects sold or removed items | Snapshot-based, runs in the seller's browser | *Observed* that the listing exists (Chrome Web Store, undated). Depop's own terms ban browser extensions that access the platform, see section 6. |

What the tools share (*inferred* from the table): only the platform's own report (Seller Hub, Poshmark, Depop shop stats) has impressions and conversion, and it is limited to the seller's own listings. Every third-party tool is built from scraping or an API plus estimation, and only eRank, Keepa and Marketplace Pulse say anything about method. Etsy tools are the only ones that state how they handle ads and personalisation, which is why they are the closest published design for rank observation.

## 2. What a search results page exposes, per site

The eBay row is *observed* from the Browse reference above plus the existing note. Other rows are the existing note's *observed* field lists, restated against the eight things the brief names. "Not read" means the fanout code does not map it, so I cannot say the page lacks it.

| Field | eBay (Browse API) | Facebook Marketplace | Depop | Poshmark | Mercari | OfferUp |
|---|---|---|---|---|---|---|
| Position | Order of results; offset up to 9,999 | Order in GraphQL result | Order, cursor paging | Order in HTML | Order, XHR paging | Order |
| Price | `price`, `unitPrice` | `listing_price.formatted_amount` | price amount, `is_reduced` | Price by regex | `price` | `price` |
| Shipping | `shippingOptions.shippingCost` | Not read | shipping amount | Not mapped | `shipping` | Detail call only |
| Promoted flag | `priorityListing` field (Limited Release to some partners) | Meta says boosted listings and ads sit outside its ranking AI; flag not read | Not found | Not found | Not found | Not found |
| Likes or watchers | `watchCount` (needs App Check per Ben's note) | Not read | `like_count` | Likes: not mapped from cards | Not found | Not found |
| Sold flag | Active only in Browse; `estimatedSoldQuantity` | `is_sold`, `is_pending`, `is_live` | `status` ONSALE, SOLD, RESERVED | Not mapped | `status` | Not found |
| Listing age | `itemCreationDate`, `itemOriginDate` (added April 2025) | Not read | Detail page only | Not mapped | Timestamps (asserted by browse.sh) | Detail call only |
| Seller rating | `seller.feedbackScore`, `topRatedBuyingExperience` | Seller name only | Slug prefix only | Not mapped | `seller` | Detail call only |
| Photo count | `image`, `additionalImages` | `primary_listing_photo` (one) | `pictures[]` | One image from cards | images | One image |

Sources: [fanout-and-watch-loop.md](../../watch/ben/fanout-and-watch-loop.md) lines 36-41 (*observed* there, from code and browse.sh), [comps-sources-live.md](../../price/ben/comps-sources-live.md) line 38 (eBay field list, `watchCount` needs App Check), eBay Browse mirror above for `priorityListing` (lines 571 and 1410 of the mirror) and the 2025 `itemOriginDate`. Meta's statement about ranking: [platform-levers.md](platform-levers.md) line 35, *observed* there from https://transparency.meta.com/features/explaining-ranking/fb-marketplace/ (2026-09-30).

What this changes (*inferred*): only eBay has a documented promoted field and a documented age field in search results. For the other four sites, a rank snapshot can record position and price, but cannot separate paid from organic placement unless the page marks it, and I did not find a page that does. Depop's `is_reduced` and `like_count` are the only engagement signals exposed without a detail call.

## 3. Inference methods

Mark for this section: the method descriptions are *asserted* from general knowledge and from paper titles (OpenAlex results, titles only, not read) unless a source is given. Which method fits which site is *inferred*.

1. **Rank-feature correlation.** Capture the top N for one query, record features (price, photo count, title words, age, seller score), and compare top-ranked with lower-ranked. It shows what top listings look like, not what causes ranking. Used by eRank's Keyword Tool (top 100, *observed* above).
2. **Surrogate learning-to-rank.** Fit a model that predicts the platform's observed order from features, then read feature weights. It only reproduces the order; it does not recover the platform's real model. The surrogate also inherits any bias in the observed order. Related literature on bias in learned rankers (titles only, unopened): "Handling Position Bias for Unbiased Learning to Rank in Hotels Search" (2020, https://arxiv.org/abs/2002.12528); "Correcting for Selection Bias in Learning-to-rank Systems" (2020, https://doi.org/10.1145/3366423.3380255); "Unbiased Learning to Rank: Online or Offline?" (2021, https://doi.org/10.1145/3439861); "Towards Disentangling Relevance and Bias in Unbiased Learning to Rank" (2023, https://doi.org/10.1145/3580305.3599914); "A Survey on E-Commerce Learning to Rank" (2023).
3. **Matched-pair or matched-listing comparison.** Pair near-identical listings that differ in one lever (free shipping, Best Offer on) and compare outcomes. Used on eBay data: Hu, Dowd and Bouchard (2022) found Best Offer raised sale probability by 3.17% and found the method "prone to endogeneity with longer time windows, causing a downward bias". *Observed* in the abstract, https://ideas.repec.org/a/taf/apeclt/v29y2022i3p261-266.html. Einav and co-authors used matched listings on eBay (http://web.stanford.edu/~jdlevin/Papers/Experiments.pdf, undated, search highlight).
4. **Query-level sampling.** Run a fixed set of queries on a schedule from a fixed place and treat each snapshot as one draw. eRank's "random Etsy searches" is a published example (*observed*, above). This is the only method that fits the data an outsider can get; the others are analysis on top of it (*inferred*).

## 4. Statistical traps

| Trap | What goes wrong | How it shows up per site | How SEO research handles it | Mark |
|---|---|---|---|---|
| Promoted placements | Paid items sit in organic slots, so "top listing" is not "top by relevance" | eBay exposes `priorityListing` in Browse; other sites show no flag I found | eRank's Rank Checker shows rank "without promoted listings" (*observed*, above). Method for removing them is not published. | *Observed* for eBay field and eRank; *not found* elsewhere |
| Personalisation and location | Two people see different orders for the same query. Meta says its ranking uses recency, relevance to activity, saves, shares, hides, location, category, condition, price. Depop's feed uses the last 300 views and ranks 600. | A logged-out request from one place gives one possible order, not the order | Rank checkers use a fixed location and signed-out state and exclude personalisation (eRank, *observed*) | Meta: *observed* ([platform-levers.md](platform-levers.md) line 35). Depop: *observed earlier* per [platform-levers.md](platform-levers.md) line 60. |
| Position bias | Top slots get more clicks because they are top, so engagement counts (likes, watchers) at the top overstate quality | Likes and watchers on page 1 are confounded with exposure | The unbiased-learning-to-rank papers above treat it as a propensity to click by position (titles only, unopened) | *Asserted* (literature titles) |
| Survivorship | Sold-only data drops listings that never sold; "winning" listings are the ones that remain visible or sold | Sold flags vanish on Facebook; eBay Browse is active only | Sell-through as a correction, with a disclosed denominator | Confirms [analytics-and-recommendations.md](../../data/nate/analytics-and-recommendations.md) lines 96 and 97; extends: there are at least three sell-through definitions (eBay unstated, ZIK "sales vs active listings", community formula), *observed* above |
| Selection on price | Cheap items sell fast, so cheap looks like "winning", but sellers who price low may also be those with weak photos or low demand items | Price is the strongest feature in a Japanese flea-market model alongside shipping method and likes (*observed*, https://ojs.bonviewpress.com/index.php/jdsis/article/download/4073/1348/55239, search highlight, undated) | Compare within a price band, or model price as the outcome | *Inferred* for the fix |
| Small samples | A product with 12 live listings gives a median with a wide interval | See section 9: for n = 30 the 95% interval for the median spans about rank 10 to rank 21 of the sorted prices | Report an interval, not a point | *Inferred* (binomial order statistics, normal approximation) |
| Confounded seller quality | Top rank follows seller history (feedback, top-rated, shop age), not the listing | eBay gives `feedbackScore`, `topRatedBuyingExperience`; other sites give little | Control for domain authority in SEO studies | Field list *observed*; control method *asserted* |
| Listing age and relist | Newer items are favoured in some ranks and get fewer sold flags yet | eBay `newlyListed` sort exists; Depop advises refreshing stale listings (*observed* in [platform-levers.md](platform-levers.md) line 55) | n/a | *Observed* for eBay sort and Depop advice |
| Observer effect and rate limits | Heavy polling gets blocked and the blocked pages are then missing data | Poshmark 403s are "the main operational risk" for its sold-comps actor (*observed* in [comps-sources-live.md](../../price/ben/comps-sources-live.md) line 67) | n/a | *Observed* |
| Platform-claim inflation | "7 attributes performs 2x better" may be selection, since careful sellers fill more fields | eBay and Poshmark numbers carry no method | n/a | *Observed* that eBay and Poshmark say so; the selection explanation is *inferred* |

## 5. A/B testing own listings across relists, and its limits

- What the sites say. Poshmark's community guidelines name "deleting and reposting content" as automation it does not allow (*observed*, https://poshmark.com/community_guidelines, undated, search highlight). Depop's blog advises refreshing stale listings with new photos, description or price ([platform-levers.md](platform-levers.md) line 55, *observed* there, 2026-04-01). Poshmark's Offer to Likers needs at least a 10% price drop (*asserted*, guide of 2026-01-25). Whether a relist resets age, likes or rank on any site: *not found* in a primary source.
- Matched listings degrade over time. The only published check I found says the matched-listings method is biased downward with longer windows (Hu, Dowd, Bouchard, 2022, *observed* above).
- Limits (*inferred*):
  1. One listing is one observation. A single before and after relist cannot separate the lever from season, a competitor's price move, or a changed sale cycle.
  2. A relist loses likes, watchers and age, and returns the item to buyers who already ignored it. This carries over into the second arm.
  3. Sites that bar automated delete-and-repost make high-frequency relisting a terms issue (Poshmark above; Depop terms ban "bots or other third party software", section 6).
  4. A valid test needs many items. With a person's many similar items, randomise which item gets which title or photo order, and compare within matched pairs. Even then, one person's closet gives tens of items, so only large effects are visible.
  5. Switchback (alternate the lever by day for the same listing) fits price and title changes, but a listing's rank and watcher state move after each edit.
- *Observed* published experiments on eBay are old and mostly auctions: shipping and handling (https://doi.org/10.2202/1538-0637.1429, 2006), seller reputation (https://doi.org/10.1007/s10683-006-4309-2, 2006), Pokemon card reserve prices (2001). Titles only; they are weak evidence for used fixed-price goods.

## 6. Licence and terms limits per site

eBay API License Agreement (https://developer.ebay.com/join/api-license-agreement, full text via Exa fetch 2026-11-14, undated). All *observed*:
- Restricted activities include any use "which may... undermine eBay's business interests". Listed examples include displaying eBay Content on the performance of an eBay Service relative to a third-party service (sales volume, velocity); using eBay Content "either alone or in combination with third-party information, to suggest or model prices for items listed on eBay Site"; and seller arbitrage, including automatically repricing eBay listings in response to other sites' price changes.
- A section on "Prohibited Use and Derivation of Information" requires eBay's prior written permission to use or display eBay Content in a way that enables derivation of seller performance data, including promoted listings and ad placements, and "Conversion, completion or success rates". This bears directly on any snapshot field that infers who is promoted or what converts.
- Age: item listing information no more than 6 hours old, other content no more than 24 hours old.
- Restricted APIs: no ingestion into non-eBay AI, no training of algorithms or AI that benefit third parties, no bulk download or distribution, raw or aggregated.
- New relative to the existing notes: a pricing-tool section (referred to in the text as Section 8.5) under which eBay may consent in writing to use of Restricted APIs data "to develop pricing tools"; resulting "eBay Enhanced Tools" carry conditions, including FTC deceptive-pricing compliance and a representation that scraped data has not circumvented third-party rights. This extends [comps-sources-live.md](../../price/ben/comps-sources-live.md) line 32, which said a partner agreement or a licensed reseller is needed: there is a named route to ask for consent.
- Numbering difference, *observed*: the rendered text numbers the sales-volume, price-modelling and arbitrage items as 4, 5 and 6 under the restricted activities list. [comps-sources-live.md](../../price/ben/comps-sources-live.md) lines 24-26 cite them as §9 items 5, 6 and 7. The wording is identical; I confirm the clauses and cannot say which numbering is the current one. The AI-training and arbitrage clauses confirm [platform-access.md](../../connect/nate/platform-access.md) line 46.
- Scraping eBay's HTML: a 2021 guide (webscrapingapi.com, unopened as a primary) says the User Agreement bans robots, spiders and scrapers and robots.txt disallows `/sch/`: *asserted*.

Other sites (all *observed* in search highlights this run; I did not fetch full pages):
- Mercari US, Prohibited Conduct: bars "any robot, spambot, spider, crawler, scraper or other automated means or interface not provided by us to access the Service or to extract data" (https://www.mercari.com/us/help_center/topics/account/policies/prohibited-conduct/, undated). Mercari platform terms also bar "monitoring, gathering, copying, or distributing the Platform by using any robot... or manual process" and using the Platform to train machine learning or AI systems (https://static.jp.mercari.com/global/en/tos_platform, undated; that is the Mercari global page, so whether it governs the US service: not checked).
- Poshmark Terms (effective 2024-10-03, https://www.poshmark.com/terms): "copy, scrape, harvest, crawl or use any technology, software or automated systems to collect any information or data for the Service". Community Guidelines bar unauthorised programs and automation, naming deleting and reposting (https://poshmark.com/community_guidelines).
- Depop Terms (US): bar mining data, scraping or crawling, and bots or third-party software, and bar "any robot, spider, scraper, data mining tools... or other automated means" without express permission; third-party cross-listing is allowed under three conditions (https://depophelp.zendesk.com/hc/en-gb/articles/360001773148-Terms-of-Service). The page headline says "effective from 1 January 2027" and a secondary page (reva.run, 2026-09-13) says "2 September 2026"; I could not reconcile the dates. Depop API terms (Selling API, https://partnerapi.depop.com/api-docs/terms/): no automated systems or browser extensions to access or analyse listings, shops or profiles without written authorisation (item 11); no use of the API to collect content for analytics, machine learning or AI training (item 12); pricing-suggestion data may not be used to make recommendations to others (item 13).
- Meta (Facebook Marketplace) and OfferUp terms: *not found*; not fetched.

What this changes (*inferred*): every site except Facebook and OfferUp (not read) has a stated clause against collecting result pages by automated means, and eBay's API licence separately limits modelling, aggregation and performance derivation. A snapshot design must name which collection route each site's rows come from, since the clause differs by route (API against page).

## 7. Published evidence for used goods

All of these are associations in observational data unless stated. None isolates a cause.

| Lever | Finding | Mark and source |
|---|---|---|
| Photo count | On a second-hand clothing platform (Tise, 2023 data), each extra image raised the likelihood of sale: coefficients 0.070 (sweaters), 0.052 (pants), 0.049 full sample, all p<0.01 | *Observed in search highlight*, https://lrossi95.github.io/papers/paper3/ (2024-12-16, working paper, not peer reviewed as far as I could see) |
| Photo count, older | Photo count linked to winning bid price in 47 eBay Motors auctions (2004) and to bids, bidders and sale probability in 80,000 eBay Motors auctions (2006 data, 2024 thesis) | *Observed in search highlight*: http://aisel.aisnet.org/amcis2004/292 and https://academicworks.cuny.edu/hc_sas_etds/1177. Cars, auctions, so weak for used fixed-price goods. |
| First photo, quality | Predicted image quality associated with sale: odds ratio 1.17 for shoes, 1.25 for handbags (eBay, May 2018 sample, 66,000 sold and 66,000 unsold shoe listings, balanced). View count was a better predictor of sales than image quality. | *Observed in search highlight*, https://arxiv.org/html/1811.10648 (2018-11-26). The sample was down-sampled to equal sold and unsold, so the baseline sale rate is not recoverable. |
| First photo, content | Catalogue images raised sale for tops (0.365) and jackets (0.234); real-person images helped dresses (0.352) and hurt sweaters (-0.124) and pants (-0.137) | *Observed in search highlight*, Tise paper above |
| Actual versus stock photo | Actual product photos and higher seller reputation gave more bidding and higher final prices in 217 completed eBay auctions | *Observed in search highlight*, https://research.vu.nl/en/publications/the-effects-of-product-photographs-and-reputation-systems-on-cons/ (2017) |
| Shipping offer | Free shipping linked to a 14% higher sale likelihood relative to $1 shipping, and to higher revenue given a sale, in about 15,600 eBay iPad 2 listings (2011 to 2012); predicted sale probability 0.870 at free against 0.837 at $10 | *Observed in search highlight*, https://ecommons.cornell.edu/bitstreams/efb61544-501e-414c-8a9b-da8ab4e7db0d/download (2015 dissertation). Auctions and new items; the 14% is as the thesis words it. |
| Shipping, field and matched | Bidders internalise only 70 to 80% of the shipping fee; free shipping adds about $2.50 revenue | *Observed in search highlight*, http://web.stanford.edu/~jdlevin/Papers/Experiments.pdf (undated) |
| Offers enabled | Best Offer on raised sale probability by 3.17% with no change to price (eBay auctions, matched listings, 2022); eBay claims 5% | *Observed*, abstract at https://ideas.repec.org/a/taf/apeclt/v29y2022i3p261-266.html. The abstract itself warns of downward bias in longer windows. |
| Price | In a gradient-boosted model on a Japanese flea-market, shipping method, price, condition and like count were the most important features; items at the very low end tended to remain listed, sale probability exceeded 50% above JPY 1,000 and peaked beyond JPY 2,000 for fast-fashion tops | *Observed in search highlight*, https://ojs.bonviewpress.com/index.php/jdsis/article/download/4073/1348/55239 (undated). One brand and one category. |
| Title keywords | Platform advice only: eBay's 80 characters, first about 60 visible, symbols can cut CTR up to 4x; attributes filled | *Asserted* (eBay, 2025-11-12, above). No independent study found. |
| Price relative to median of live competitors | No published study found that tests price relative to the live median for used goods | *Not found* |
| Day and time of listing | No published study found | *Not found* |

Reading of the table (*inferred*): photo count and free shipping have the most support, and both are from observational data in categories that differ from a person's own item. The direction for photo count agrees across clothes and cars; the size does not transfer.

## 8. How SEO research handles the same traps

Only partly sourced. The *observed* part is the eRank design above: fixed Rank Checker with no ads or personalisation, top-100 sampling, random searches. That the SEO industry uses fixed-location, signed-out rank checks and CTR-by-position curves is *asserted* from general knowledge; I did not open a source in this run. The unbiased learning-to-rank papers in section 3 give the formal treatment of position bias (titles only, unopened).

## 9. Snapshot design: "what is winning for this product right now" (all *inferred*)

Everything in this section is design reasoning from the sources above. None of it is sourced as a thing a site publishes.

**Unit.** One query per product (built from brand, model, size, condition), per site, per run. The snapshot is the list of the first N results, where N is the number the route returns without paging more than 3 times.

**Fields per result row, per site (what the route exposes, section 2):**
- All sites: site, query, run time, position, listing id, title, price, shipping price if present, photo count if present, first-photo URL, condition, seller handle.
- eBay: `priorityListing`, `itemCreationDate`, `itemOriginDate`, `feedbackScore`, `topRatedBuyingExperience`, `watchCount` if the app has it.
- Depop: `like_count`, `is_reduced`, `status`.
- Facebook: `is_sold`, `is_pending`, `is_live`.
- Poshmark, Mercari, OfferUp: what each route returns; likes, age and seller need a second call on some.
- A `fetched_via` column (API, public page, user's own session) because the terms differ by route (section 6), and `observed_at` per row because eBay content must not be shown older than 6 hours.
- eBay `priorityListing` stays out of any display of "who converts" given the derivation clause (section 6). Whether to store it for exclusion only is an operator and eBay-consent question.

**Cadence.**
- On demand when the person opens the item (a snapshot older than the site's age limit is stale: 6 hours for eBay item data).
- Background re-snapshots once or twice a day for items the person has live, so a trend is possible and a vanished listing can be read as sold, removed or hidden.
- Sold detection comes from a listing disappearing between snapshots, and sites differ: Facebook removes sold items, Depop and Facebook show a sold flag, eBay Browse shows active only. The disappearance rate is the unit, not "sold".

**Sample size.** Counted in live listings in the first page or pages:
- To say a median price: at n = 30 the 95% interval covers roughly the 10th to 21st sorted price; at n = 100 roughly the 40th to 60th. Below 20, show the range and the count, not a median.
- To say "top-ranked listings differ from the rest" on a yes-or-no feature (free shipping, 5 or more photos): to see a 60% against 40% difference with 80% power and 5% significance takes about 100 listings in each group, so about 200 for one query. One product on one site seldom has that many, so pooled evidence across several similar queries or snapshot days is needed, or the comparison is labelled a guess.
- For a trend over time: at least 3 snapshots on different days.

**Comparisons shown to the person, in plain words.**
- "The 10 listings shown first for this item: 7 offer free shipping. Of all 48 we saw, 22 do." (a count of the top group against the whole)
- "Your price is $34. Of the 31 listings live now, 19 are cheaper and 12 are dearer. The middle price is $38, and with this few listings it could be anywhere from $32 to $44."
- "Listings that vanished since last week had a middle price of $29. We cannot tell if they sold, were removed or were hidden."
- "Your first photo is on a plain background. 6 of the first 10 results show the item worn." (a plain description, not a claim it sells more)
- "Items with 6 or more photos make up 8 of the first 10, and 24 of 40 overall. Reports from other studies link more photos with more sales, but this is a different category."
- Always the count, the date and the site beside the sentence. No percentages without a count.

**Rule for when a pattern is strong enough to act on.** A pattern is shown as "worth acting on" only when all of these hold:
1. At least the sample size above for that comparison on that site.
2. The same direction in at least two snapshots taken on different days.
3. The gap is larger than the interval (for a median, the person's own value falls outside the interval).
4. It survives a within-band check (compare among similar prices, or among listings with the same promoted flag state) and is not explained by one seller who owns many of the top slots.
5. The action is reversible (an edit, not a relist that loses likes and age).
6. Where eBay is the source, the display respects the licence clauses in section 6.
Anything short of this is shown as "a pattern we saw", with the count.

**What must be labelled a guess.**
- Any claim of cause ("this ranks higher because of the title").
- Any ranking weight from a surrogate model.
- Any sell-through number (the denominator differs by tool and eBay does not publish it).
- Any "sold" count where the sold flag is inferred from disappearance.
- Any statement about position that mixes paid and unpaid results, or any site where no promoted flag is available.
- Any number from a platform's own claim (7 attributes, 4x CTR, 80 to 90% sale chance).
- Any timing advice (day or time of listing): no study found.
- Any price advice on Depop, Poshmark, Mercari, Facebook or OfferUp from the photo and shipping studies above, which are from eBay, Tise and a Japanese site.

## Not found
- Primary documentation of how any of the five target sites ranks search results, except Meta's transparency page ([platform-levers.md](platform-levers.md) line 35) and the Browse API's statement that Best Match is the default.
- A promoted or sponsored flag in Depop, Poshmark, Mercari, Facebook and OfferUp results.
- Whether a relist resets age, likes or search rank on eBay, Depop, Poshmark, Mercari, Facebook or OfferUp.
- Published evidence, for used goods, on day and time of listing, and on price relative to the median of live competitors.
- Independent evidence on title keywords for used goods.
- Algopix's method; ZIK's collection method; eBay's sell-through formula.
- Meta and OfferUp scraping terms; Etsy API terms.
- A published SEO method for removing personalisation beyond eRank's statement.

## Sources fetched
Opened in full or as text (*observed*):
- eBay Browse API markdown mirror, https://developer.ebay.com/develop/api/buy/browse_api.md (sort section lines 281-320 of the mirror; `priorityListing` at lines 571 and 1410).
- eBay API License Agreement, https://developer.ebay.com/join/api-license-agreement (Exa text).
- https://developer.ebay.com/develop/guides-v2/inventory-discovery-and-refresh-guide.md and https://serpapi.com/ebay-sort-options.
- https://www.ebay.co.uk/sellercentre/news/2024-october/product-research-tool; https://community.ebay.com/forum/announcements-57928/topic/list-smarter-sell-more-this-holiday-season-8587/.
- https://keepa.com/api-docs/product-object.html; https://help.erank.com/features/; https://blog.marmalead.com/keyword-nets-for-etsy-seo/; https://www.marketplacepulse.com/data and /about; https://blog.poshmark.com/2026/04/06/sellerupdatesapril6/.
- The six existing notes listed at the top (the first four read; fanout lines 34-41 and platform-levers grep hits only).

Seen as search highlights only (page not fetched in full):
- https://www.ebay.com/help/selling/selling-tools/product-research?id=4853; https://export.ebay.com/en/growth/promotion-strategies/listing-quality-report/; ZIK pages; https://lrossi95.github.io/papers/paper3/; https://arxiv.org/html/1811.10648; https://ecommons.cornell.edu/bitstreams/efb61544-501e-414c-8a9b-da8ab4e7db0d/download; http://web.stanford.edu/~jdlevin/Papers/Experiments.pdf; https://ideas.repec.org/a/taf/apeclt/v29y2022i3p261-266.html; https://academicworks.cuny.edu/hc_sas_etds/1177; http://aisel.aisnet.org/amcis2004/292; https://research.vu.nl/en/publications/the-effects-of-product-photographs-and-reputation-systems-on-cons/; https://ojs.bonviewpress.com/index.php/jdsis/article/download/4073/1348/55239; Mercari, Poshmark and Depop terms pages named in section 6; https://partnerapi.depop.com/api-docs/terms/; https://reva.run/site/blog/operations/marketplace-automation-rules/ (secondary).

Unopened (named, not read): OpenAlex-listed papers in section 3 (titles and DOIs only); webscrapingapi.com guide (2021); dashvue.co.uk (2026-07-06); sellergrowthtools.com (2026-08-20); ListifyAI (2026-04-28); tagrankr (2026-06-23); Vendex Chrome Web Store page; SellerInsight.

### Searched / could not reach
- eBay Browse reference HTML returned 403 to curl; the markdown mirror and an Exa fetch were used instead.
- The licence page returned a stub to curl; Exa text was used.
- OpenAlex search for marketplace audit methods returned nothing relevant; the used-goods listing-photo query partly failed to print (an encoding error in my script), so I used Exa search instead.
- I did not search for: Etsy API terms, Meta or OfferUp terms, Algopix method pages, or SEO rank-tracking vendor method pages. These stay unknown, not absent.
- A narrow search does not prove that a study, a flag or a terms clause does not exist.
