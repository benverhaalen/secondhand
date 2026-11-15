# Determinations: Market insight
Status: *agent proposal* for Ben and Nate. Written 2026-11-14.

Area: what anyone, including a person who never sells, can learn about a product, a brand, a category or a market from official stores and the five used markets (eBay, Facebook Marketplace, Depop, Poshmark, Mercari). Nate: "insights into industries markets, both with public sales data from official stores, and the metrics available on these second hand sites" and "see price changes, the ways industries evolve, products release and how hype is established, what fashion trends are out" ([words](../../product/words.md)). The feature pages are [market](../features/market.md), [insights](../features/insights.md), [buy](../features/buy.md), [watch](../features/watch.md), [score](../features/score.md) and [data](../features/data.md). The price of one item is [price](../features/price.md)'s; this file covers the product and the market around it.

## Shared terms

| Term | Meaning here |
|---|---|
| *t* | a starting value, to be tuned by the card's Check later |
| comp | one observation in Delta: `price_type` asking, sold or retail, with `evidence` and `rights` |
| sold-final | a sold comp whose price is the price paid (eBay sold, our own `order`) |
| sold-tag | a listing the site marks sold, showing the last asking price, not the accepted offer (Poshmark, Mercari, Depop) |
| ended | a listing that disappeared with no sold mark (all Facebook endings, removals). Never counted as sold |
| condition band | `new_tags`, `like_new`, `good`, `fair`, `parts`, read from the listing ([identify](../features/identify.md)) |
| guarded number | `{value or range, basis_count, as_of, citation_id, state, hide_reason}`; hide reasons `too_few`, `stale`, `mixed_types`, `source_gap`, plus `conflict` and `noise` proposed here |
| price | the item price the buyer paid, in cents, without shipping or tax; shipping is kept beside it when known |
| week | ISO week, UTC; all windows end at the last complete day |

Model steps (text or image to comparable facts) are named in each Method; everything else is plain code, so the same comps and versions give the same number. Every model output is cached by `(comp fingerprint, extractor_version)`, so a rerun reads the cache and does not call the model again.

## M1. Same product

**Determines**: which observations, retail and used, across all sites, describe the same catalogue `product` (brand, model, variant), and with what match label.

**Sources and weights**

| Source | Contributes | Rank or weight | Why |
|---|---|---|---|
| GTIN, UPC, maker SKU or style code read from label, listing field or retail page | exact identity | rank 1, decides alone | an identifier is assigned by the maker to one variant ([identification](../../research/identify/nate/identification-technologies.md#table-5-reference-data-and-its-licences), *observed*) |
| Catalogue entry (KicksDB, Icecat, Open Products Facts, Shopify Global Catalog) | variant attributes and aliases | rank 2 | curated, but licences and coverage vary per row (*observed*, same table) |
| Structured listing fields (brand, model, size, colour) | candidate filter | 0.30 of the text score *t* | sellers pick from fixed lists, so fewer typos, though the wrong value is often picked (*inferred*) |
| Title and description text, model-read into facts | brand, model, variant terms | 0.50 *t* | carries the model name most often; the model is needed to normalise wording |
| Image embedding similarity | look | 0.20 *t*, never decides alone | photos tell family well and variant badly; a stock photo is no evidence ([watch](../features/watch.md)) |
| Person's tap on a chip, "Not the same" | label | overrides all for that pair | a human label is ground truth for the pair and trains the threshold |

**Method**
1. Model step: extract `{brand, model, variant terms, size, colour, codes[]}` from title, fields and text; extract codes from photos (OCR of labels).
2. Arithmetic: if any code normalises (check digit valid) to a catalogue code, label `exact` and stop.
3. Block candidates by brand and category; compute `s = 0.30 * field_agree + 0.50 * text_sim + 0.20 * image_sim`, where `text_sim` is token-set Jaccard on normalised model and variant terms, `image_sim` is cosine of the stored embedding, both on fixed model versions.
4. Label with the canon set `exact`, `likely_same_model`, `same_family_other_variant`, `comparable`, `unresolved`. The thresholds, the rungs and the cross-check that confirms `exact` are owned by [seeing-the-item card 9](seeing-the-item.md#9-which-product-it-is-and-when-identity-is-confirmed); this card does not restate them.
5. How a product-level match differs from card 9: card 9 identifies one capture the person holds; here strangers' listings are pooled, so blocking and the weighted score above rank the candidates before card 9's thresholds apply, and one wrong merge moves a whole page, not one item. Market numbers use `exact` and `likely_same_model` only. `same_family_other_variant` feeds family-level numbers; `comparable` feeds only [M17](#m17-a-cheaper-equivalent-of-similar-quality-and-material) and [M24](#m24-same-purpose-match); `unresolved` feeds nothing.

**Why this method**: Record linkage practice blocks first, then scores pairs, and keeps a deterministic identifier above any similarity (*asserted*, the Fellegi and Sunter framing, not fetched this session). A learned end-to-end matcher is the alternative; it would beat the weighted score once there are labels, but it cannot show its reasons, and the label flow here creates the training set for it (*inferred*). Unsure pairs stay apart, because one wrong merge poisons every number on two product pages (*inferred*, [watch](../features/watch.md)).

**When it is not shown**: a product page needs one `exact` or 3 `likely_same_model` observations; below that the search shows candidate chips. A `same_family_other_variant` result never enters this product's numbers.

**How it is explained**: "Matched by the style code on the label" or "Same model by name and photo; tap if it is not". Tap opens the codes, the matching words and the photos side by side.

**Speed**: kept ready: the catalogue code index and image embeddings in AI Search; per comp, its extracted facts. On demand: the pair score for a new search, under 100 ms after retrieval.

**Check later**: 200 hand-labelled cross-site pairs per category. Wrong if precision of `likely_same_model` is below 0.95, or recall of `exact` below 0.9 where a code was visible.

## M2. Retail price and release date

**Determines**: what the product cost new at launch, what it costs new now, and the day it first went on sale. Money reads these as `launch_retail` and `price_new_today` in [D7](money.md#d7-original-retail-price), which links here.

**Sources and weights**

| Source | Contributes | Rank | Why |
|---|---|---|---|
| Maker's own store page (official) | launch price, current price, availability | 1 | the maker sets the list price |
| Authorised retailer pages (Amazon first-party via Creators API, Best Buy, Nordstrom, Nike SNKRS) | price, in-stock date | 2 | sells new at the list price, but runs its own sales |
| Price trackers with history (Keepa list price and first-seen, KicksDB `retail_price`, `release_date`) | launch price and date when the maker page has changed | 3 | historical, second hand ([market-intelligence](../../research/data/nate/market-intelligence.md#3-product-release-and-catalogue-data-retail-price-release-date), *observed*) |
| Maker press release, release calendars | announced date and price | 4 | an announcement, not an observed sale |
| Person's entry | value | 5, `you_said` | unchecked |

**Method** (arithmetic after a model step that reads price, currency and availability off a page)
1. `launch_retail` = the highest regular (not marked sale) price seen at the best available rank in the first 30 days after `release_date`. EDITED defines "full price" as the highest price seen ([market-intelligence](../../research/data/nate/market-intelligence.md#4-measures-and-definitions), *observed*).
2. `release_date` = the earliest in-stock observation at rank 1 or 2; if none, rank 3; if none, the announced date at rank 4, labelled "announced".
3. `current_retail` = the latest rank 1 or 2 price within 7 days, with `on_sale = current < launch_retail`.
4. US dollars for US products; other regions kept separately, never converted into one launch price.
5. This card owns the name and the value `launch_retail`. [money.md D7](money.md#d7-original-retail-price) links here and uses this name, not `original_retail`.

**Why this method**: the premium, retention and depreciation cards all divide by launch retail, so it must be the list price and not a passing discount (*inferred*). Taking the lowest price seen is the competent alternative (what a buyer could have paid), but it moves with every sale event and would make retention look better than it was (*inferred*).

**When it is not shown**: hidden `conflict` when two rank-1 or rank-2 sources differ by more than 5% *t* with no sale mark; hidden `source_gap` when only rank 5 exists (shown as "you said"). Current retail is dated after 7 days and dropped after 30. The person sees "No store price found" and the closest family's retail, labelled.

**How it is explained**: "Sold new by Nike at $110 from 12 March 2026". Tap opens the store page snapshot, the date read and the other stores' prices.

**Speed**: kept ready: a `retail` row per product, refreshed daily for products with a follow or a live listing (Amazon cache allows offers 1 hour and other fields 1 day, *observed*). On demand: a retail search for a new product, streamed.

**Check later**: 100 products with a known maker list price. Wrong if `launch_retail` differs from it on more than 5%, or `release_date` is off by more than 3 days on more than 10%.

## M3. Used price per site over time

**Determines**: for each product, site, condition band and week, the range of prices people actually paid, as a series. The comp set, weights and minimum basis are [money D1](money.md#d1-comparable-set-and-weights)'s.

**Sources and weights** (per comp, multiplied)

| Source | Contributes | Weight | Why |
|---|---|---|---|
| Comp weight per sold comp | `w_type x w_match x w_age x w_extract` | as owned by [money.md D1](money.md#d1-comparable-set-and-weights), not restated here | one rule per quantity across the app, so a product page and an item's fair value never disagree on the same sales |
| ended (Facebook and removals) | nothing | 0 (D1) | disappearance is not a sale ([insights](../features/insights.md), *asserted*) |
| asking (live) | separate ask series | never mixed into sold | asks are not sales; mixing gives `mixed_types` |
| Duplicate cross-post | one item counted once | the cluster's sold-final copy wins | one physical item sold once |
| Accepted Best Offer amount (*agent proposal*) | replaces the struck list price of an eBay Best Offer sale | the sale then counts as a plain sold comp in D1 | eBay Product Research (Terapeak) shows the accepted amount but only to a signed-in seller (*observed (highlight)*, [teardown 1.8](../../research/data/nate/teardown-price-tools-and-registries.md#18-ebay-product-research-terapeak)); the app reads it through the person's own eBay seller session, the own-account route of the [data router](../features/data.md#source-registry-and-router-agent-proposal). 130point shows it too, how is not found (*asserted*, [1.2](../../research/data/nate/teardown-price-tools-and-registries.md#12-130point)) |

What differs from D1 for a product-level index, and why: there are no per-item adjustments (D2), because the page describes the product, not one item; there is no back off to the family, because a family number is shown as its own labelled number, not mixed in; and the range is weighted quantiles of the comps, not D5's model, because a person must be able to recount it from the listed sales (*inferred*).

**Method**
1. Model step: read condition band and the flags lot, bundle, for parts, box only, replica, from text and photos. Flagged comps leave the set.
2. Arithmetic: work on `x = ln(price)`. Drop comps with `|x - median(x)| > 3 * 1.4826 * MAD(x)` (Hampel rule) within (product, condition band, 90 days).
3. Weekly point = weighted quantiles q25, q50, q75 of the remaining comps sold in the 90 days up to that week, weight = D1's `w_i`, quantile taken as the smallest price whose cumulative weight reaches the share (inverse of the weighted step function, so it is exact and repeatable).
4. Store as `product_snapshot (product, site, band, day, n, n_eff, p25, p50, p75, table_version)`, where `n_eff = (sum w)^2 / sum w^2`.
5. Across sites (the product page's main range) = the same weighted quantiles over the pooled comps of all sites. Per-site rows appear beside it ([M23](#m23-where-it-is-cheaper-to-buy-and-better-to-sell)).
6. Accepted offers (*agent proposal*). Where the accepted Best Offer amount is read (row above), it is the sale price. Where it cannot be read, it is not guessed per sale: an eBay Best Offer sale when no signed-in eBay seller account is connected, and accepted offers on Poshmark, Mercari, Depop and the rest, which show no accepted amount to anyone (*inferred*, none found in the teardowns). Those keep [D1](money.md#d1-comparable-set-and-weights)'s weight and learned discount `d_offer,cat`; every read amount is also a training pair for that discount, so D1 learns from real offers, not only from list-to-sale gaps (Swappa's published 6 to 22% asking-to-sale gap is the public check, *observed (highlight)*, [1.9](../../research/data/nate/teardown-price-tools-and-registries.md#19-swappa)).
7. Change-only series (*agent proposal*). Besides the weekly snapshot, each (product, site, band) keeps a change-only series `price_point (product, site, band, at, value_cents | gap, definition_version)`: a row is written only when the value changes; `gap` is an explicit "no sale, no offer" marker, so a chart breaks the line instead of drawing across an empty stretch; prices are integer cents. A change of what the number means (say, adding shipping) bumps `definition_version` with its date, shown on the chart as a dated line. This is Keepa's storage: change-only pairs, -1 for no offer, integer minor units, and a dated definition change on 2026-02-23 (*observed (highlight)*, [1.6](../../research/data/nate/teardown-price-tools-and-registries.md#16-keepa)).

**Why this method**: weighted quantiles of recent sold comps are what working pricers use (sold comps, recent first) and need no model fit, so anyone can recompute them (*inferred*; Card Ladder and the tracker in [market-intelligence](../../research/data/nate/market-intelligence.md#6-uncertainty-thin-data-and-what-makes-people-return) never mix sold and asking, *observed*). The alternative is the calibrated quantile model [price](../features/price.md) runs for one item; that is right for an item with drivers, but a product page needs a number a person can check by counting sales (*inferred*).

**When it is not shown**: `too_few` by [D1's minimum basis](money.md#d1-comparable-set-and-weights) (today `n_eff < 6` or fewer than 2 sold in 90 days; D1 wins if it changes); `stale` when the newest comp is over 14 days old (dated) or 45 days (dropped); a week with no sale carries no point (a `gap` row). Publish gate (*agent proposal*, starting value): a market price is published only when its confidence `n_eff / (n_eff + 6) x (1 - spread)`, with `spread = (p75 - p25) / p50` capped at 1, is at least 0.5; below it the range shows as "rough" with its sales, and no single number is shown. WatchCharts publishes a price only above a threshold it calls market price confidence (*asserted*, [1.4](../../research/data/nate/teardown-price-tools-and-registries.md#14-watchcharts-watches)); ours states its formula. The person sees "Not enough sales yet" and the ask series, labelled "asking, not sold".

**How it is explained**: "Sold for $36 to $52 lately, from 41 sales in 90 days". Tap opens the sales list with date, site, price, condition and a link to each.

**Speed**: kept ready: the daily `product_snapshot` from a Lakeflow job, synced to Lakebase. On demand: none for a known product; a new product's first point is computed from its fan-out comps in under 1 s.

**Check later**: sale prices of the next 30 days per product. Wrong if fewer than 40% of them fall in p25 to p75 (expected 50%), or the across-site p50 error is worse than the last-sale alternative.

## M4. How many are for sale now

**Determines**: the number of distinct live listings of a product, per site and in total, as of a time.

**Sources and weights**

| Source | Contributes | Rank | Why |
|---|---|---|---|
| eBay Browse `total` | exact live count on eBay | 1 | the API's own count (*observed*, [analytics](../../research/data/nate/analytics-and-recommendations.md)) |
| Our search reads on the other sites (harness `search`, at most 200 results) | a lower bound | 2 | a capped page cannot count past its cap |
| Keepa `COUNT_NEW`, `COUNT_USED` | Amazon offer counts | 2 | a tracker's count ([market-intelligence](../../research/data/nate/market-intelligence.md#14-keepa-and-camelcamelcamel-amazon), *observed*) |
| Cluster dedupe ([M1](#m1-same-product), photo hash) | cross-posts | subtracts duplicates | one item listed on three sites is one item for sale |

**Method** (arithmetic): `live(site) = count of distinct clusters read live within 24 h`; `total = count of distinct clusters across sites`. A site whose read hit the cap is `at_least`. A site not read in 24 h is excluded and named.

**Why this method**: supply is a count of things, not of listings, so dedupe comes first (*inferred*). Summing each site's own count is the alternative, which overcounts by the cross-post rate (*inferred*).

**When it is not shown**: never summed as complete when a site failed; that site shows "not checked". Older than 24 h is dated; older than 7 days dropped.

**How it is explained**: "At least 23 for sale on 4 sites, checked 2 hours ago". Tap opens the listings and each site's time.

**Speed**: kept ready for followed products (daily read). On demand from the search fan-out.

**Check later**: hand count of live listings for 30 products. Wrong if the deduped total is off by more than 15%.

## M5. How many sold in a period

**Determines**: how many distinct items of a product sold in a window, per site.

**Sources and weights**

| Source | Contributes | Weight | Why |
|---|---|---|---|
| eBay Marketplace Insights (gated, 90 days) or eBay sold search | sold count | complete for eBay | the site's own record (*observed*, [insights](../features/insights.md)) |
| sold-tag on Poshmark, Mercari, Depop seen by our reads | sold count | lower bound | a sold listing we never saw is missing |
| Our own `order` rows | sold count | complete for our users | ours |
| Facebook | none | 0 | no sold mark exists (*observed*) |

**Method** (arithmetic): distinct clusters with `sold_at` in the window. Each site carries `completeness: full | lower_bound`. The total is "at least" whenever any part is a lower bound.

**Why this method**: a lower bound labelled as one stays true; an estimated full count would need the miss rate, which nobody publishes (*inferred*).

**When it is not shown**: under 3 in the window shows "fewer than 3"; a site never read in the window shows "not checked".

**How it is explained**: "At least 41 sold in 90 days, 30 of them on eBay". Tap opens the sold list.

**Speed**: kept ready in `product_snapshot.sold_count`.

**Check later**: for our users' sales, the share our reads saw. Wrong if the lower bound on Poshmark or Mercari misses more than half of known sales.

## M6. Sell-through

**Determines**: of the listings of a product that appeared in a period, the share that sold within 30 days.

**Sources and weights**: listings first seen by our reads, with their outcome ([M5](#m5-how-many-sold-in-a-period)); only sites where both new listings and sold marks are visible (eBay, Poshmark, Mercari, Depop). Facebook is excluded because its endings are not sales.

**Method** (arithmetic): cohort `C` = distinct clusters first seen from day -60 to day -31. `sell_through_30 = |{c in C: sold within 30 days of first seen}| / |C|`. Denominator stated: every listing that appeared in the cohort window, whether it later sold, ended or is still live. The `definition_version` names this formula.

**Why this method**: the two formulas in circulation, sold/(sold + active) and sold/active, depend on how old the live stock is and on when one counts ([market-intelligence](../../research/data/nate/market-intelligence.md#4-measures-and-definitions), *observed*). A cohort has a fixed denominator and matches the field's "sold within 30 days" figures (FlowLister, *observed* in [insights](../features/insights.md)), so it can be compared. The stock formula in [market](../features/market.md) and [score](../features/score.md) is the alternative; it is quicker on a young product, so it is kept only as the fallback in the first 60 days, labelled.

**When it is not shown**: `too_few` under 10 listings in the cohort; `source_gap` when fewer than 2 of the 4 sites were read through the whole window; never over 100%.

**How it is explained**: "Of 40 listed in September, 14 sold within a month". Tap opens the cohort and each listing's outcome.

**Speed**: kept ready weekly in `market_metric`.

**Check later**: compare with our users' own listings' 30-day outcome. Wrong if the two differ by more than 15 points in a category with 50 or more of ours.

## M7. Days to sell

**Determines**: how long a listing of the product usually takes to sell, as a range.

**Sources and weights**: listing date as the site shows it (rank 1) or our first-seen time (rank 2, later than the true start); outcome from [M5](#m5-how-many-sold-in-a-period). Ended and still-live listings are counted as not sold yet, not dropped.

**Method** (arithmetic): Kaplan-Meier survival over listings from the last 180 days, with delayed entry for listings first seen after their start, and censoring at end or now. Report the days by which 25%, 50% and 75% have sold. If the curve never reaches 50%, report "more than N days".

**Why this method**: the median of sold listings only drops the slow ones that never sold, so it understates (*inferred*; survival and cure models in [range-calibration](../../research/price/nate/range-calibration.md#5-days-to-sell-survival-and-time-to-event), *observed*). A cure model that also estimates the share that never sells is better for one item's plan and runs in [price](../features/price.md); a product page needs the plain curve.

**When it is not shown**: `too_few` under 5 sale events; more than half the basis on rank 2 dates is marked "from when we first saw them".

**How it is explained**: "Half sell within 9 days, most within 20". Tap opens the curve and the listings.

**Speed**: kept ready weekly per product and site.

**Check later**: next quarter's listings. Wrong if the share sold by the stated median day is outside 40% to 60%.

## M8. Demand and whether it is rising

**Determines**: how much people want a product now compared with its own recent past, from proxies, since search volume on closed marketplaces cannot be known.

**Sources and weights**

| Proxy | Contributes | Weight *t* | Why |
|---|---|---|---|
| Sold rate ([M5](#m5-how-many-sold-in-a-period)) | revealed demand | 0.40 | a purchase is the strongest signal of want (revealed over stated preference, *asserted*) |
| Turnover, sold per live listing | demand against supply | 0.20 | rising sales can be only rising supply |
| Watchers per live listing (eBay `watchCount`, Depop likes) | intent before purchase | 0.15 | reported by the site, but cheap to give (*observed* fields, [analytics](../../research/data/nate/analytics-and-recommendations.md#3-what-cannot-be-known-and-the-proxy)) |
| Google Trends API, consistently scaled | search interest outside the marketplaces | 0.15 | open-web interest, comparable over time in the alpha API (*observed*, [market-intelligence](../../research/data/nate/market-intelligence.md#23-search-and-social-signals)) |
| Offers and messages on our users' listings | direct buyer contact | 0.10 | true but a small sample |

**Method** (arithmetic): for each proxy `k`, `r_k = ln((recent_28d + 1) / (base_28d_avg + 1))`, where the base is the average 28-day level over the prior 112 days. `D = sum w_k r_k / sum w_k` over proxies present. Rising when `D >= 0.15` *t* (about 16%) and the sold rate alone passes the noise test of [M15](#m15-what-is-trending-and-how-a-trend-is-told-from-noise), on 2 weekly reads running. Falling is symmetric.

**Why this method**: each proxy is measured against the product's own baseline, so scales that differ (counts, likes, a search index) can be combined (*inferred*). Lyst weighs Desire, Demand and Discovery with weights it does not publish ([market-intelligence](../../research/data/nate/market-intelligence.md#21-lyst-index), *observed*); here the weights are stated and tuned. A single proxy (sold count) is the alternative; it lags, while watchers and search lead it (*inferred*).

**When it is not shown**: `too_few` when the sold rate has under 5 in either window; a proxy with no data drops out and the sentence names what was used; hidden when only one proxy is present.

**How it is explained**: "More people want this than a month ago: more sales, more watchers". Tap opens each signal's before and after.

**Speed**: kept ready weekly; Google Trends read weekly per followed product.

**Check later**: does a rising D precede a rise in sold rate over the next 28 days? Wrong if rising products' next sold rate is no higher than flat ones'.

## M9. Hype: resale premium from release, and its decay

**Determines**: how far above retail a product resold at release, how fast that premium fades, and where it settles.

**Sources and weights**: launch retail from [M2](#m2-retail-price-and-release-date); weekly used p50 of `new_tags` and `like_new` from [M3](#m3-used-price-per-site-over-time) (sold only); restocks from rank 1 and 2 stores. StockX's own premium is not used (its terms bar display, *observed*).

**Method** (arithmetic)
1. `premium(w) = p50(w) / launch_retail - 1` for each week `w` since release.
2. Fit `premium(w) = P_inf + (P_0 - P_inf) * exp(-lambda * w)` by weighted least squares, weight `sqrt(n_w)`, with a fixed grid of starting values and the best fit kept, so it is repeatable.
3. Report `P_0` (the first two weeks' measured premium), the weeks for the premium to halve (`ln 2 / lambda`) and `P_inf`.
4. A restock splits the series: the fit restarts after it and the jump is reported.

**Why this method**: the Duke thesis on StockX found a hype variable that decays at 5% a step to near zero in about 90 days, days since release lowering the premium and restocks lowering it ([market-intelligence](../../research/data/nate/market-intelligence.md#25-academic-work), *observed*); an exponential decay to a floor is the simplest curve with that shape. A regression on hype drivers (tweets, collaboration) is the alternative; it explains why, but needs data we cannot keep and a model per category (*inferred*).

**When it is not shown**: no launch retail; fewer than 4 weekly points with at least 3 sales each; fit with weighted R2 under 0.5 *t* shows the points with no curve. Products released more than 2 years before our data starts show premium only, no decay.

**How it is explained**: "Resold at 80% over the store price in its first two weeks; that halved in about 5 weeks and has held near 20%". Tap opens the weekly points and the curve.

**Speed**: kept ready, refit weekly for products under 1 year old.

**Check later**: fit on weeks 1 to 8, predict weeks 9 to 16. Wrong if the curve's error is worse than carrying week 8 forward.

## M10. Depreciation by category and brand

**Determines**: the share of retail a typical product in a category (or a brand within it) keeps as it ages.

**Sources and weights**: every sold comp with a product that has launch retail ([M2](#m2-retail-price-and-release-date)), weighted as in [M3](#m3-used-price-per-site-over-time); Keepa used-price history and PriceCharting for categories with years of history (rank 2, marked "from a price tracker").

**Method** (arithmetic): a hedonic regression with product fixed effects, `ln(price_ij / retail_i) = a_i + f(age_ij) + c(band_ij) + m(month_ij) + e`, where `f` is a step function over age bins 0-3, 3-6, 6-12, 12-24, 24-48, 48+ months, `c` the condition bands and `m` calendar months. The category curve is `exp(f)` at band `good`, rebased to the youngest bin. Brand curves add a brand-by-age term and are reported only where they differ from the category by more than the noise ([M15](#m15-what-is-trending-and-how-a-trend-is-told-from-noise) method on bootstrap intervals).

**Why this method**: product fixed effects compare each product with itself as it ages, so a category whose young products are luxury and old ones are cheap does not fake a curve (*asserted*, the standard hedonic and repeat-sales logic used in housing and car price indices; not fetched this session). No standard depreciation curve for used consumer goods was found ([market-intelligence](../../research/data/nate/market-intelligence.md#4-measures-and-definitions), *observed*). A simple average of price over retail by age is the alternative and mixes product quality with age.

**When it is not shown**: fewer than 20 products with retail, or an age bin with under 30 sales (that bin is blank); a brand under 8 products is folded into its category.

**How it is explained**: "A typical pair of running shoes keeps about 45% of its store price after a year". Tap opens the curve, the bins and the products in it.

**Speed**: kept ready, refit monthly per category.

**Check later**: predict the next quarter's sale prices of products from their age alone. Wrong if the curve does no better than the category median.

## M11. Price retention of one product

**Determines**: how much of its store price a product keeps today, and whether that is better or worse than its category at the same age.

**Sources and weights**: used p50 across sites in band `good` from [M3](#m3-used-price-per-site-over-time); launch retail from [M2](#m2-retail-price-and-release-date); the category curve from [M10](#m10-depreciation-by-category-and-brand).

**Method** (arithmetic): `retention = p50_good / launch_retail`; `versus_category = retention / curve(age)`. Better when over 1.10, worse when under 0.90 *t*.

**Why this method**: comparing against the category at the same age separates "this product holds value" from "everything is young" (*inferred*). Retention against current retail is the alternative and is misleading when the store discounts.

**When it is not shown**: when M2 or M3 is hidden; versus-category hidden when M10 is.

**How it is explained**: "Keeps 72% of its store price after 8 months, more than most in its category". Tap opens both numbers and the curve.

**Speed**: computed on demand from ready parts.

**Check later**: do better-retaining products keep that edge 6 months later? Wrong if the ranking is no more stable than chance.

## M12. Seasonality

**Determines**: in which months a category's prices and sales are usually higher or lower than the year's average.

**Sources and weights**: rank 1, our sold counts and category index ([M14](#m14-a-category-price-index)) once 2 full years exist; rank 2, Keepa used price and Google Trends 5-year series for the category's head terms (*observed*, rolling 5-year window); rank 3, eBay sold data over at most 90 days is too short and is not used.

**Method** (arithmetic): ratio to a centred 12-month moving average, per calendar month, averaged over all years present, normalised so the 12 factors average 1 (the classical decomposition behind X-11, *asserted*). The seasonal effect is shown only when the range of factors is larger than twice the spread of the same month across years.

**Why this method**: it is transparent and needs no model; STL or X-13 is the alternative and handles a changing season better, but needs more years than we have (*inferred*).

**When it is not shown**: fewer than 24 months in the best source; season not larger than its noise, shown as "no clear season".

**How it is explained**: "Coats usually sell for about 15% more in November than in May". Tap opens the 12 months and the years used.

**Speed**: kept ready, recomputed monthly.

**Check later**: hold out the last year. Wrong if seasonal factors do not cut the error of a flat forecast.

## M13. A brand's or category's movement

**Determines**: whether a brand or category is going up or down in price and in sales over 30 and 90 days.

**Sources and weights**: price from a chained index of its products ([M14](#m14-a-category-price-index) method on a brand basket); sales from the share of the parent category's sold count ([M5](#m5-how-many-sold-in-a-period)); each product weighted by its sold value share over the prior 12 months.

**Method** (arithmetic): `price_move = index(t) / index(t - 30) - 1`; `share_move = share(last 30 days) / share(prior 90 days avg) - 1`. Rising or falling when the move exceeds the bootstrap 90% band of the index (products resampled, 500 draws, fixed seed).

**Why this method**: share of the parent's sales removes the tide that lifts every brand in December (*inferred*); price via a matched index removes mix (a brand selling more of its cheap line is not falling). The alternative is the change in average price, which is mostly mix.

**When it is not shown**: under 10 products or under 30 sales in either window; within the band, shown as "steady".

**How it is explained**: "Patagonia prices are up 6% in 90 days, and it is a growing share of jacket sales". Tap opens the products that moved most.

**Speed**: kept ready weekly.

**Check later**: does a rising label hold for the next 30 days more often than a coin flip? Wrong if under 55%.

## M14. A category price index

**Determines**: a reproducible number that tracks the price of a fixed set of products in a category over time.

**Sources and weights**: product weekly p50 from [M3](#m3-used-price-per-site-over-time), one condition band per product; basket weights from sold value share over the 12 months before the basket is set.

**Method** (arithmetic)
1. Basket: the products with at least 6 sales a quarter, frozen per `basket_version`, refreshed yearly.
2. Each week, price relative `R_i = p50_i(t) / p50_i(t-1)` for products with a point in both weeks.
3. Link `L(t) = prod R_i ^ (w_i / sum of w over products present)`, a weighted geometric mean (Jevons). Missing products take no part that week (implied imputation).
4. `index(t) = 1000 * prod L` from the base week. A change of source or basket starts a new `era` with a link week where both are computed.
5. Store `index_point (index_id, basket_version, day, value, era, citation_id)`.
6. Eligibility floor and review queue (*agent proposal*, starting values): a sale enters an index product's p50 only if its price is at least 20% of the product's 90-day p50 and its extraction confidence is at least 0.8; a sale that passes the floor but would move the product's weekly p50 by more than 15% on its own goes to `held_for_review` and stays out of the index until a reviewer accepts or drops it, or 14 days pass (then it enters with half weight). Card Ladder holds odd sales in a human review queue and sets an eligibility floor (*observed*), and PriceCharting sends outliers to a person (*observed*) ([teardown](../../research/data/nate/teardown-price-tools-and-registries.md#11-card-ladder-trading-cards)). The Hampel rule of M3 still runs first; the queue catches what passes it but is still odd.

**Why this method**: matched price relatives keep composition changes out of the index, and the geometric mean is what CPI elementary aggregates use (*asserted*, CPI manual, not fetched this session). Card Ladder's CL50 is the sum of last sales divided by 50, rebased to 1,000 ([market-intelligence](../../research/data/nate/market-intelligence.md#19-card-ladder-and-collectibles-indices), *observed*); it is simpler but lets one expensive item and one odd last sale move it, which the median and the geometric mean resist (*inferred*).

**When it is not shown**: a week with under 60% of basket weight present is hidden `too_few`; fewer than 10 products in the basket: no index.

**How it is explained**: "Sneaker index: 1,084, up 8.4% since January". Tap opens the basket, the weights and each era.

**Speed**: kept ready, one row a week; Genie and Delta Sharing read the same table.

**Check later**: recompute from a past table version. Wrong if any value differs; and wrong in design if a basket refresh moves the level by more than the week's own band.

## M15. What is trending, and how a trend is told from noise

**Determines**: which products and attributes (a colour, a cut, a material) are selling more, or less, than usual, and which of those changes are real.

**Sources and weights**: sold counts ([M5](#m5-how-many-sold-in-a-period)), rank 1; listing counts ([M4](#m4-how-many-are-for-sale-now)) to tell supply from demand, rank 2; attributes read by a model from listing text and photos; demand proxies ([M8](#m8-demand-and-whether-it-is-rising)) as a tie-break only.

**Method**
1. Model step: extract `{colour, silhouette or cut, material, pattern, era}` per comp, fixed extractor version.
2. Arithmetic, per product or attribute `i` in category `c`: `a` = sales in the last 28 days, `b` = sales in the prior 84 days. Under no change, `a` given `a + b` is binomial with `p0 = 28 / 112` times the category's own ratio of the two windows, so the category's tide is removed.
3. One-sided binomial test for rising and for falling; Benjamini-Hochberg across all `i` in the category at 5% false discoveries.
4. A trend is shown when it passes, the ratio `(a / 28) / (b / 84)` is at least 1.5 (or at most 0.67 for falling) *t*, and it held on 2 weekly reads running.
5. Ranking: by the ratio, top 10 risers and fallers per category.

**Why this method**: a count of sales is noisy at small numbers, and testing every product at once finds false risers unless the false discovery rate is controlled (*asserted*, Benjamini and Hochberg 1995, not fetched). No paper on trend detection from resale listings was found ([market-intelligence](../../research/data/nate/market-intelligence.md#25-academic-work), *observed*). The alternative is a 3-week against 12-week moving average gap (Trendalytics) or Bayesian change-point detection ([scoring](../../research/price/nate/scoring-and-ranker-inference.md#4-change-detection)); the moving average has no noise floor and change-points need longer series than most products have. Attention-driven rises tend to reverse ([market-intelligence](../../research/data/nate/market-intelligence.md#25-academic-work), *observed*), which is why two reads are required.

**When it is not shown**: under 5 sales in either window per cell; failing the test shows nothing (not "flat"). A riser whose listing count rose faster than its sales is labelled "more for sale", not "trending".

**How it is explained**: "Selling faster than usual: 34 sold in the last 4 weeks, about 15 in a usual 4 weeks". For a falling style: "Selling less than usual". Tap opens the weekly counts and the listings.

**Speed**: kept ready weekly for every category.

**Check later**: of products shown rising, the share whose sales stay above their base for the next 30 days. Wrong if under 60%; the market page's bar is 80%, which rests on Pinterest Predicts' own claim (*asserted*).

## M16. How new retail releases relate to used supply and price

**Determines**: what a new release or restock at retail does to the used price and supply of the same product and of the model it replaces.

**Sources and weights**: event dates from [M2](#m2-retail-price-and-release-date) (rank 1 store, rank 4 announcement); used p50 ([M3](#m3-used-price-per-site-over-time)) and live count ([M4](#m4-how-many-are-for-sale-now)) of the affected products; the category index ([M14](#m14-a-category-price-index)) as the control.

**Method** (arithmetic): event study per release `e`: `effect_e = ln(p50 after 28 days / p50 before 28 days) - ln(index after / index before)` for the predecessor model (same family, previous generation, from the catalogue); same for live count. Across past events in the category: the median effect and its range. The predecessor link is model-read from the catalogue and confirmed when two sources agree.

**Why this method**: subtracting the category's own move is a difference-in-differences, which removes the season and the market (*asserted*, standard event-study design). Before-and-after alone is the alternative and would credit a release with every November.

**When it is not shown**: under 5 past events in the category, the category line is hidden and only this event's raw before and after is shown, labelled "one release".

**How it is explained**: "When the new model came out, used prices of the old one fell 12% in four weeks; across 9 past releases, the usual fall was 8%". Tap opens each release.

**Speed**: kept ready per event; recomputed 28 days after each.

**Check later**: predict the next 5 releases' effects from the category median. Wrong if the sign is wrong more often than right.

## M17. A cheaper equivalent of similar quality and material

**Determines**: products that do the same job with similar material and build at a lower used price, and how similar they are.

**Sources and weights** (similarity, among products passing hard filters of same category and function)

| Facet | Contributes | Weight *t* | Why |
|---|---|---|---|
| Material composition (label, maker page), model-read | fibre or material shares | 0.35 | what the person asked for; a label is a stated fact |
| Build specs (weight, fabric gsm, stitching, sole, storage, chip) | construction | 0.25 | quality lives in build more than in look (*inferred*) |
| Revealed quality: retention versus category ([M11](#m11-price-retention-of-one-product)) and the [score](../features/score.md) quality axis | durability as buyers price it | 0.20 | used buyers pay for what lasts (*inferred*) |
| Fit and function attributes | same use | 0.15 | must replace the thing |
| Image embedding | look | 0.05 | look is not quality |

**Method**: model step reads composition and specs into fixed fields. Arithmetic: material similarity = 1 minus half the sum of absolute differences of shares; specs = mean of per-spec closeness (`1 - |a - b| / max(a, b)` for numbers, equality for classes); weighted sum. Equivalent when similarity is at least 0.75 *t* and used p50 is at most 0.75 of the target's. Ranked by similarity, then price.

**Why this method**: a weighted facet score can show which facet matched, which an image-only "looks like" search cannot; "dupe" engines that use look alone match colour and shape, not quality (*inferred*). A learned embedding over all facets is the alternative and needs labelled equivalents we do not have.

**When it is not shown**: when material or condition is unknown for either side (as in [buy](../features/buy.md)); either price hidden; similarity under the bar.

**How it is explained**: "Similar wool and weight, sells used for about half". Tap opens the facet-by-facet comparison.

**Speed**: kept ready: facets per product, and the top 20 neighbours per product refreshed weekly. On demand: the price filter.

**Check later**: 100 pairs judged by people who know the category. Wrong if fewer than 70% agree the pair is similar quality.

## M18. Which listings to recommend to a person

**Determines**: the For you shelf: live listings for a person, from their own items, sizes, brands, follows, wants and past purchases.

**Sources and weights**

| Signal | Weight *t* | Why |
|---|---|---|
| Want (`want`) | 1.0 | stated intent to buy |
| Follow | 0.6 | interest without intent ([market](../features/market.md)) |
| Past purchase's brand and category | 0.5 | revealed taste, but a bought need may be filled |
| Owned items' brands and sizes | 0.4 | taste and size, weaker for buying |
| "Not for me" on a card | -1.0 on that cluster, -0.3 on its brand | a direct no |

**Method** (arithmetic after model-read listing attributes): hard filters first: live, fits (measured fit or size, [watch](../features/watch.md)), not the person's own, not recalled, match label `exact` or `likely_same_model` where a product is set. `score = (sum of signal weights matching the listing) x deal(position of delivered total in the fair range: 1.0 at the bottom, 0.5 at the top)`. At most 2 cards per product, newest first on ties.

**Why this method**: marketplaces personalise from purchases and engagement and fall back on popular items at cold start ([analytics](../../research/data/nate/analytics-and-recommendations.md#5-recommendations-how-marketplaces-personalise-and-cold-start), *asserted*); stated weights let the card say why each listing is there. A learned ranker (two-tower or collaborative filtering) is the alternative and needs click data the opt-in shelf will produce.

**When it is not shown**: not opted in; fewer than 3 signals; no listing passes the filters.

**How it is explained**: "Your size M, from 6 items you own". Tap opens what was inferred, with one tap to reset.

**Speed**: kept ready nightly per opted-in person; refreshed on a new want.

**Check later**: save and click rate against search alone. Wrong if not higher after two weeks.

## M19. When a followed product has moved enough to tell its follower

**Determines**: whether a change in a followed product goes into the person's weekly digest.

**Sources and weights**: [M3](#m3-used-price-per-site-over-time) price; [M2](#m2-retail-price-and-release-date) releases and restocks; [M15](#m15-what-is-trending-and-how-a-trend-is-told-from-noise) riser list.

**Method** (arithmetic): tell when any holds:
1. Price: `|p50(last 14 days) / p50(prior 28 days) - 1| >= max(0.10, the bootstrap 90% band of that ratio)` with at least 10 sales in the last 14 days.
2. A release or restock at a rank 1 or 2 store.
3. In the category's top 10 risers 2 weekly reads running.
At most one mention per product per week; nothing moved, no digest.

**Why this method**: the 10% and 10-sales rule is [market](../features/market.md)'s; the added band stops a noisy product from passing on chance (*inferred*). Pushing every change is the alternative, and [insights](../features/insights.md) rules out price-fluctuation spam.

**When it is not shown**: any input hidden; quiet hours fold it into the digest.

**How it is explained**: "Down 14% in two weeks, from 22 sales". Tap opens the product page at its chart.

**Speed**: computed weekly from ready snapshots.

**Check later**: share of digest items the person opens. Wrong if mentions that pass the band are opened no more than those that would fail it.

## M20. Making an anonymous dataset safe to share

**Determines**: which cells of an aggregate table may be shown in public or shared through Delta Sharing, and the smallest group that may be shown.

**Sources and weights**: aggregate tables from M3 to M16; our users' own data (`order`, `item`) and public listings both count toward contributors.

**Method** (arithmetic, run before a share or a public chart)
1. No person ids, seller handles, listing urls or photos; product and category keys only.
2. A cell is kept when it has at least 10 distinct contributors (sellers or our users) *t*, not 10 rows.
3. Dominance: drop the cell when one contributor makes more than 50% of its count or value.
4. Complementary suppression: when a total and all but one of its parts are shown, drop the next-smallest part too, so no cell can be had by subtraction.
5. Counts rounded to the nearest 5; time no finer than a week for cells under 50.

**Why this method**: counting contributors and applying a dominance rule is the standard in statistical disclosure control for business tables (*asserted*, the threshold and dominance rules used by national statistics offices, not fetched). A rule that removes cells under 5 rows, which [market](../features/market.md) used before it adopted this card, still exposes a seller with 5 listings. Differential privacy is the alternative and is stronger, but its noise ruins small counts and breaks recomputation unless seeded (*inferred*).

**When it is not shown**: any cell failing 2 to 4 is removed from the share and shown as "too few to show".

**How it is explained**: "Groups with fewer than 10 sellers are not shown, to protect them". Tap opens the rule.

**Speed**: applied when the share table is written, weekly.

**Check later**: a re-identification attempt on a test share with known sellers. Wrong if any seller's sales can be recovered.

## M21. The citation attached to every published number

**Determines**: the record that lets anyone recompute a shown number exactly.

**Sources and weights**: Delta table versions, the metric's `definition_version`, the code version, the filters and the basis ids.

**Method** (arithmetic): `citation = {metric, filters, table_versions[], definition_version, code_version, computed_at, basis_ids[], basis_hash}`, where `basis_hash` is SHA-256 of the sorted basis ids and their prices. Recompute reads each table `VERSION AS OF` the stored version and must return the same value and hash.

**Why this method**: Delta time travel makes the inputs fixed (*observed*, [databricks platform](../../research/data/nate/databricks-platform.md)); a snapshot of the result alone is the alternative and proves nothing about how it was made. Rights tags on basis rows are kept so a recompute can refuse a use the source bars ([data](../features/data.md)).

**When it is not shown**: a number without a citation is never shown; a citation whose table version was vacuumed shows "can no longer be recomputed" and the date.

**How it is explained**: "From 41 sales, read up to 13 November". Tap opens the rows and a Recompute button.

**Speed**: written with the number; the recompute is on demand.

**Check later**: recompute a random 1% of shown numbers nightly. Wrong if any differs.

## M22. Price change over time for a product

**Determines**: whether a product's used price went up, down or held over 30, 90 and 365 days.

**Sources and weights**: [M3](#m3-used-price-per-site-over-time) weekly p50, across sites, one condition band.

**Method** (arithmetic): `change_k = p50(now) / p50(now - k days) - 1`; "held" when inside the bootstrap 90% band of the two points (comps resampled, 500 draws, fixed seed). Chart states as in [market](../features/market.md): none under 3 points, young under 30 days.

**Why this method**: comparing two medians with a band says whether the change is bigger than the sales behind it can support (*inferred*). The last sale against the first is the alternative and swings on one odd sale.

**When it is not shown**: either end hidden in M3.

**How it is explained**: "Up about 12% since August, from 60 sales". Tap opens the chart.

**Speed**: computed on demand from ready snapshots.

**Check later**: are "held" products still within 5% after 30 days more often than "up" products? Wrong if not.

## M23. Where it is cheaper to buy and better to sell

**Determines**: which site usually has the lowest used price for a product, and which leaves a seller the most after fees.

**Sources and weights**: per-site [M3](#m3-used-price-per-site-over-time) p50 (sold only); per-site fees and shipping from [price](../features/price.md); [M7](#m7-days-to-sell) per site.

**Method** (arithmetic): buy side, `site_ratio = p50_site / p50_all`; seller side, `net_site = p50_site - fee_site(p50_site) - shipping_site`. Ranked; a gap counts only when the two sites' p25 to p75 ranges do not overlap.

**Why this method**: buyers and sellers face the same price differently, net of fees; reporting both from one series keeps them consistent (*inferred*). Comparing asking prices across sites is the alternative, and asks are not sales.

**When it is not shown**: fewer than 2 sites with a shown M3; overlapping ranges show "about the same everywhere".

**How it is explained**: "Usually sells for less on Mercari; sellers keep most on Depop". Tap opens each site's range and fees.

**Speed**: computed on demand.

**Check later**: our users' sales by site against the prediction. Wrong if the predicted best net site is wrong more often than the second.

## The better official option (M24 to M29)

*agent proposal*. From Nate's "a suite like shopify, and the better official option" ([words](../../product/words.md)). Beside any used listing, in the app or pasted from any site, the app shows the best new, official refurbished or brand resale option for the same purpose and says which is the better buy for this person. The person's purpose and constraints arrive as purpose slots defined in `spec/determinations/asking-and-intent.md` and gathered by `spec/features/assist.md`; these cards read the slots by the names [card 10](asking-and-intent.md#10-the-buyers-purpose-slots-and-what-is-inferred-before-asking) gives them (`use`, `for_whom`, `budget`, `size`, `compatibility[]`, `deadline`, `condition_tolerance`), plus `keep_for`, which card 10 must add, and do not decide what to ask. The evidence is [buyer-intent and official alternatives](../../research/watch/nate/buyer-intent-and-official-alternatives.md), [Shopify catalog and agentic commerce](../../research/watch/nate/shopify-catalog-and-agentic-commerce.md) and [buy-side products and search](../../research/watch/nate/buy-side-products-and-search-experience.md).

A referral never enters any of M24 to M29: the inputs below list every source, and `referral_tag`, commission and promoted placement are not among them.

## M24. Same-purpose match

**Determines**: for a used listing or a `product`, the official offers that serve the same purpose, each with a `relation`: `same_product` (the same product, new or official refurbished), `successor` (the next generation of it) or `functional_equivalent` (another product that does the same job for this person).

**Sources and weights**

| Source | Contributes | Rank or weight | Why |
|---|---|---|---|
| Identity of the used side, [M1](#m1-same-product) | the product and its label | `same_product` needs `exact` or `likely_same_model` | a relation built on an unsure identity misleads twice |
| Shopify Global Catalog over MCP: `lookup_catalog` by barcode or id, `search_catalog` with `catalog.like` by image or id | official offers grouped by Universal Product ID, `list_price`, `condition` new or secondhand | rank 1 for offers where it has them | one call returns many merchants' offers of one product (*observed*, [Shopify note 1.2 to 1.3](../../research/watch/nate/shopify-catalog-and-agentic-commerce.md#12-data-model-observed-global-catalog-docs-and-the-ucp-variant-schema)) |
| Klarna Agentic Product API (approved partners) | offers with `shippingCost`, `stockStatus`, `deliveryTime` | rank 1 where approved | delivered price and stock in the offer itself (*observed*, [same note 5](../../research/watch/nate/shopify-catalog-and-agentic-commerce.md#5-klarna-agentic-product-protocol-and-search-and-compare)) |
| Maker stores and authorised retailers as in [M2](#m2-retail-price-and-release-date) (Amazon Creators API, Best Buy, the maker's page) | new offers | rank 2 | same ranks as retail price |
| Official refurbished programmes (Apple Certified Refurbished, eBay Refurbished, Back Market, Amazon Renewed, Google Refurbished) | refurbished offers with grade and warranty | rank 2 | the maker or a graded refurbisher stands behind them ([buyer-intent note 3](../../research/watch/nate/buyer-intent-and-official-alternatives.md#3-how-do-official-refurbished-and-brand-resale-programs-define-official-alternative)) |
| Brand resale (Patagonia Worn Wear, Lululemon Like New, Levi's SecondHand, Trove and Archive storefronts) | brand-owned used offers | rank 2 | used stock the brand stands behind, terms differ by brand (*asserted*, same section) |
| Catalogue family link (predecessor and successor), the same link [M16](#m16-how-new-retail-releases-relate-to-used-supply-and-price) uses | `successor` | confirmed when 2 sources agree | no open dataset maps a model to its successor (*observed* absence, [buyer-intent note 5](../../research/watch/nate/buyer-intent-and-official-alternatives.md#5-how-are-successors-and-equivalents-found)) |
| [M17](#m17-a-cheaper-equivalent-of-similar-quality-and-material) facet similarity, run against new-retail products | `functional_equivalent` | similarity at least 0.75 *t* | same facets and weights as M17; no price filter here |
| Purpose slots | hard filters on every relation | each set slot must hold | the catalogs carry no purpose field (*observed* absence, [Shopify note 1.2](../../research/watch/nate/shopify-catalog-and-agentic-commerce.md#12-data-model-observed-global-catalog-docs-and-the-ucp-variant-schema)) |

**Method**
1. Arithmetic: `same_product` = catalogue lookup by GTIN, Universal Product ID, maker SKU or style code of the M1 product; new and refurbished offers both qualify.
2. Arithmetic: `successor` = the family link's next generation, released or announced, kept when 2 sources agree.
3. Model step: read the candidate's typed attributes (fit, capacity, size, compatibility, material) for the purpose slots. Arithmetic: M17's facet score; a set slot whose attribute is unknown on the candidate fails it.
4. Arithmetic: per relation, rank by delivered price ([M26](#m26-delivered-price)); show at most one offer per relation and condition, best first; the others sit behind "other stores".

**Why this method**: an identifier first, a two-source family link second and a facet score last keeps each relation as checkable as its evidence allows (*inferred*). The alternative is image nearest neighbour across the catalogue (`catalog.like` alone); it finds things that look alike, which is the look-alike weakness the buy-side note records for Dupe.com ([buy-side note 8](../../research/watch/nate/buy-side-products-and-search-experience.md#8-design-what-an-intuitive-unified-search-and-shopping-experience-takes-from-these-inferred)), so it is used for recall in step 3, never to decide.

**When it is not shown**: `same_product` hidden unless M1 is `exact` or `likely_same_model`; `successor` hidden on one source; `functional_equivalent` hidden when the purpose slots its category needs are unset (`spec/determinations/asking-and-intent.md` decides whether to ask); an offer older than its source's cache limit is refetched or dropped (Shopify: price 10 minutes, no standing copy, *observed* terms). The person sees the used listing alone with "No official option found".

**How it is explained**: "Same product, new from the maker" or "Its newer model" or "Does the same job: same capacity, fits the same mounts". Tap opens the identity evidence, the family link's two sources, or the facet table.

**Speed**: kept ready: the family links and facets per product. On demand: the offer lookups, in parallel, streamed as they arrive, first official offer under 2 s *t*. Shopify offers are never stored past their cache limit (`rights.may_store` false, `ttl` 10 minutes).

**Check later**: 200 used listings with a person's judgement of the right official option. Wrong if the shown `same_product` is wrong on more than 2%, or people judge the `functional_equivalent` not fit for the stated purpose on more than 20%.

## M25. One condition scale

**Determines**: one condition scale across the five marketplaces, official refurbished programmes, brand resale and new retail, so one filter spans every offer: `new`, `refurbished`, `like_new`, `good`, `fair`, `parts`, in that order, plus who stands behind it (`seller_kind`: `maker`, `authorised_retailer`, `official_refurbisher`, `graded_refurbisher`, `brand_resale`, `marketplace_seller`).

**Sources and weights**

| Source | Maps to | Why |
|---|---|---|
| Each marketplace's own grade | the inverse of [seeing-the-item card 14](seeing-the-item.md#14-condition-on-each-markets-own-scale), which owns the per-market tables | one table per market, read both ways |
| Our reading of the photos and text (the condition band, [identify](../features/identify.md)) | `like_new` to `parts` | the seller's grade is a claim |
| Google, OpenAI feed and schema.org `condition` new, refurbished, used | `new`, `refurbished`, used read from text | the three values agree by design (*observed*, [Shopify note 7](../../research/watch/nate/shopify-catalog-and-agentic-commerce.md#7-open-standards)) |
| Shopify `condition` new or secondhand | `new`; secondhand read from text, never `refurbished` alone | refurbished is not mapped by Shopify (*not found*, [note 1.4](../../research/watch/nate/shopify-catalog-and-agentic-commerce.md#14-new-versus-used-access-cost-limits-observed-unless-marked)) |
| Apple Certified Refurbished, eBay Certified Refurbished, Back Market Certified Renewed | `refurbished`, `official_refurbisher` | maker or authorised refurbisher with maker parts ([buyer-intent note 3](../../research/watch/nate/buyer-intent-and-official-alternatives.md#3-how-do-official-refurbished-and-brand-resale-programs-define-official-alternative)) |
| eBay refurbished Excellent, Very Good, Good; Amazon Renewed Premium, Excellent, Good, Acceptable; Back Market Excellent, Good, Fair | `refurbished`, `graded_refurbisher`, with grade `like_new`, `good`, `fair` *t* (Premium and Excellent to `like_new`) | graded by third parties; the grade words differ by programme (*inferred* map) |
| Brand resale grades (Lululemon excellent, great, good) | `like_new`, `good`, `good` *t*, `brand_resale` | brand-graded used, not refurbished |

**Method** (arithmetic after the condition band's model step): map the source grade by table; where the seller's grade and our reading differ, the offer takes the lower and says both. The condition band `new_tags` maps to `new`, and `new` from a `marketplace_seller` stays `new`; the warranty row ([M29](#m29-new-against-used-verdict)) carries the difference.

**Why this method**: the order puts what a buyer can count on first, and `seller_kind` keeps "who stands behind it" apart from wear, which the three kinds of official programme need (*inferred*, [buyer-intent note 3](../../research/watch/nate/buyer-intent-and-official-alternatives.md#3-how-do-official-refurbished-and-brand-resale-programs-define-official-alternative)). The alternative is the three-value new, refurbished, used of the feeds; it cannot tell a scuffed item from a mint one.

**When it is not shown**: an unknown source grade with no reading leaves the offer `unknown`, shown in every filter with "condition not stated"; a grade map row marked *t* that people dispute is shown with the source's own words beside it.

**How it is explained**: "Refurbished by Apple" or "Good: light wear, seller says Excellent". Tap opens the source's grade words and our reading.

**Speed**: a lookup table, kept ready.

**Check later**: 300 offers across programmes and sites graded by people. Wrong if more than 10% land two or more steps from the people's grade.

## M26. Delivered price

**Determines**: what an offer costs to the person's door, with when it arrives, whether it is in stock, and where it ships from and to.

**Sources and weights**

| Part | Source, by rank | Why |
|---|---|---|
| Item price | the offer itself (Shopify `price` in minor units, Klarna `price`, the listing) | the price shown by the seller |
| Shipping | Klarna `shippingCost`; the listing's shipping field; the site's shipping rule from [price](../features/price.md); local pickup 0 with the distance | a total without shipping is not real ([Shopify note 9](../../research/watch/nate/shopify-catalog-and-agentic-commerce.md#9-feature-table), "so cheaper is real") |
| Tax estimate | the destination's combined rate from the rate tables states publish (base rate plus local rates where the state publishes them), always labelled "estimated tax", applied where the seller or the marketplace collects; no paid tax service, by Nate's answer ([words](../../product/words.md), "2026-11-14 nate the search engine is an api, no feeds, no tax service, tags on retouched photos") | a flat rate is wrong across states; no flat 7% |
| Delivery window | Klarna `deliveryTime {minDays, maxDays}`; the site's estimated delivery; handling days plus carrier transit by zone | the offer's own estimate first |
| Stock | `in_stock`, `out_of_stock`, `preorder`, `backorder`, `collect_in_store`, `unknown` (Klarna's values); a marketplace listing's state from [watch](../features/watch.md) | Shopify external `available` does not reflect stock, so it maps to `unknown` (*observed*, [note 1.4](../../research/watch/nate/shopify-catalog-and-agentic-commerce.md#14-new-versus-used-access-cost-limits-observed-unless-marked)) |
| Ships from and to | seller location, Shopify `ships_from` and `ships_to`, Klarna `international` | filters, and the delivery estimate |

**Method** (arithmetic after a model step that reads shipping and handling from listing text when no field exists): `delivered_cents = price + shipping + tax`, with `tax = rate x (price + shipping where shipping is taxed)`. A part known only as a range makes the total a range. Offers ranked by delivered price; an offer with unknown shipping is ranked at its price plus the category's median shipping and marked.

**Why this method**: the buyer compares totals at the door; ranking by item price favours offers that hide cost in shipping (*inferred*). The alternative, item price only, is what most aggregators show.

**When it is not shown**: no item price (Shopify external offers may lack one, *observed*) shows "price at the store"; unknown shipping shows "plus shipping" instead of a total; a price past its source's cache limit is refetched before any buy tap.

**How it is explained**: "$412 to your door by Thursday: $389, $0 shipping, about $23 estimated tax". Tap opens each part and its source.

**Speed**: on demand per offer, under 300 ms after the offer arrives; tax rates cached per destination for a day *t*.

**Check later**: 100 completed purchases with receipts. Wrong if the delivered total is off by more than 5% on more than 10%, or delivery is later than the window on more than 20%.

## M27. Value it will keep

**Determines**: the share of today's used price a product is expected to keep after the person's horizon (1, 2 or 3 years, or `keep_for`), with a range, and whether a successor is announced.

**Sources and weights**: the category curve of [M10](#m10-depreciation-by-category-and-brand); the product's edge over its category from [M11](#m11-price-retention-of-one-product); the release effect of [M16](#m16-how-new-retail-releases-relate-to-used-supply-and-price) when a `successor` (M24) is announced or released; Swappa's completed-sale retention by model age as a rank-2 prior for phones, tablets, watches and laptops until M10 has 2 years of our own data (*asserted*, highlights, a marketplace's own figures, [buyer-intent note 4](../../research/watch/nate/buyer-intent-and-official-alternatives.md#4-decision-factors-with-numbers)).

**Method** (arithmetic)
1. `R(h) = curve(a + h) / curve(a) x k`, where `a` is the product's age, `curve` M10's, and `k = 1 + (versus_category - 1) x n / (n + 30)` *t* (M11's edge, shrunk toward the category by its `n` sales).
2. If a successor is announced and not yet released, apply M16's category median effect once at its expected date; if released within 12 months, the curve already carries it.
3. Range: 500 bootstrap draws of the M10 fit and `n`, fixed seed; report p25 and p75.

**Why this method**: a forward value is the past curve read from the product's age, so it needs no new model and inherits M10's checks (*inferred*). The alternative is a forecast model per category; it needs years of history we do not have yet. Swappa's figures blend grades and carriers by its own note (*asserted*), so they are a prior, not the answer.

**When it is not shown**: M10 hidden for the category; the horizon reaches past the oldest age bin with data (never extrapolated); `too_wide` when p75 - p25 exceeds 0.5 *t*. The successor flag shows on its own even when the value is hidden.

**How it is explained**: "Likely worth 55% to 65% of today's price in 2 years; a newer model was announced in October". Tap opens the curve, the product's edge and the announcement.

**Speed**: on demand from ready curves.

**Check later**: forecasts made 12 months earlier against today's M3. Wrong if fewer than 40% fall inside p25 to p75.

## M28. Net cost of ownership

**Determines**: what an option costs the person over their horizon: delivered price minus what it should sell for later, with its range.

**Sources and weights**: delivered price ([M26](#m26-delivered-price)); today's used p50 of the product in the condition it will likely be in, from [M3](#m3-used-price-per-site-over-time) (band `good` *t*); `R(h)` from [M27](#m27-value-it-will-keep); the cost of selling it later at the best net site from [M23](#m23-where-it-is-cheaper-to-buy-and-better-to-sell) (fees and shipping from [price](../features/price.md)); a repair cost only where a typed source states it (a maker's battery service price) and the item's state calls for it within the horizon. Horizon: the `keep_for` slot, which [asking-and-intent card 10](asking-and-intent.md#10-the-buyers-purpose-slots-and-what-is-inferred-before-asking) defines; without it, 2 years for electronics and 1 year for other categories *t*.

**Method** (arithmetic): `resale(h) = p50_good x R(h) - selling_cost(p50_good x R(h))`; `NCO(h) = delivered - resale(h) + repair(h)`. The range takes M26's range, M3's p25 and p75 and M27's range together, low with low and high with high. Warranty and returns are not turned into money here; they are rows in [M29](#m29-new-against-used-verdict). No vendor publishes this formula (*not found*, [buyer-intent note 4](../../research/watch/nate/buyer-intent-and-official-alternatives.md#4-decision-factors-with-numbers)).

**Why this method**: it is the simple ownership sum the buyer-intent note sets out (purchase plus shipping plus repair minus exit value, *inferred*), every term already a shown number, so the person can check it. The alternative is price alone, which hides that a new item that holds value can cost less to own than a used one that does not.

**When it is not shown**: resale hidden (M3 or M27 hidden) shows the delivered price only, with "can't tell what it would sell for later"; `too_wide` when the range is wider than the delivered price.

**How it is explained**: "Costs about $140 to $190 to own for 2 years: $412 now, sells for about $250 later". Tap opens each term.

**Speed**: on demand, under 100 ms from ready parts.

**Check later**: our users who resell an item bought through the app. Wrong if the realised cost falls outside the range on more than half.

## M29. New against used verdict

**Determines**: for a used listing and its best official option (M24), which is the better buy for this person, or that it is a close call, and the row-by-row comparison behind it: delivered price, condition, warranty and return rights, authenticity risk, recall status, delivery time, value kept and net cost.

**Sources and weights**

| Input | Source | Use |
|---|---|---|
| Net cost of each option | [M28](#m28-net-cost-of-ownership) | the money comparison |
| Most a buyer should pay for the used item, and its deal verdict | [money.md D17](money.md#d17-most-a-buyer-should-pay), [D18](money.md#d18-good-deal-verdict-on-a-listing) | a used item over D17 cannot win |
| Warranty and return rights | the programme's terms (Apple 1 year; eBay Certified 2 years; eBay other refurbished grades 1 year; Back Market 1 year; Lululemon Like New none; peer listings none stated, [buyer-intent note 4](../../research/watch/nate/buyer-intent-and-official-alternatives.md#4-decision-factors-with-numbers)); the marketplace's buyer protection from [buy](../features/buy.md) | rows, and the risk cost below |
| Authenticity risk | the authenticity and seller signals of [score](../features/score.md) | a gate when high, else a row |
| Recall status | [seeing-the-item card 20](seeing-the-item.md#20-recall-or-safety-flag), on both options | a gate |
| Delivery window, condition | [M26](#m26-delivered-price), [M25](#m25-one-condition-scale) | `deadline` and `condition_tolerance` gates, rows |
| Risk cost of the used option | `delivered x p_problem x (1 - cover)`, `p_problem` 5% electronics, 3% other *t*, `cover` 1 with returns or protection, 0 without | money a buyer loses on average to a bad used item |

**Method** (arithmetic)
1. Gates: an option with an open recall and no remedy, one that misses the `deadline` slot at its latest delivery day, falls below `condition_tolerance`, or fails a `compatibility[]` entry, or a used item with high authenticity risk or a price over D17, is out; if one option is out, the other is the verdict.
2. `gap = (NCO_used + risk_used) - NCO_official`, as a range.
3. `used_better` when the whole gap range is below `-max(5% of the official delivered price, $10)` *t*; `official_better` when it is above `+max(...)`; else `close_call`, naming the row that differs most.
4. A referral, commission or promoted placement is not an input. The verdict is computed by code that has no access to referral fields, and a check runs it with and without them and requires the same result.

**Why this method**: gates first, because no saving makes a recalled or late item the better buy; then money over the person's horizon, because that is what they pay; a band, so a near tie is called a near tie (*inferred*). The alternative is a weighted score over all rows; it hides the trade-off in a weight the person cannot see.

**When it is not shown**: no official option (M24 hidden); either NCO hidden (the rows still show, without a verdict); `functional_equivalent` with the purpose slots unset; the person has not said they are buying for themselves when the verdict would turn on `keep_for` (the default horizon is then named in the sentence).

**How it is explained**: "The new one is the better buy for you: about $40 more now, but a year of warranty and it keeps more of its value". Tap opens the rows. A link that earns a referral carries, next to it and visible without a tap, "We may earn a referral fee. It never changes the order or the verdict." That a referral never changes the order is our own design choice (*agent proposal*), not an FTC rule. The FTC Endorsement Guides require a material connection to be disclosed clearly and conspicuously, which online means unavoidable, not behind a "more" link (16 CFR 255.0(f), 255.5, *observed*, [claims validated](../../research/cross-cutting/nate/claims-validated-determinations.md); [buy-side note 6](../../research/watch/nate/buy-side-products-and-search-experience.md#6-referral-and-affiliate-programmes)).

**Speed**: on demand from ready parts and the streamed offers, under 200 ms after the last part.

**Check later**: people who took the verdict and people who did not, 6 months on, asked whether they would choose the same. Wrong if regret is no lower among those who followed it.

## All determinations

| # | Name | Owning feature | Main sources | Method in five words | Hide rule |
|---|---|---|---|---|---|
| M1 | Same product | identify, market | codes, catalogue, text, image | identifier first, then weighted similarity | 1 exact or 3 likely |
| M2 | Retail price and release date | market | maker store, retailers, Keepa, KicksDB | ranked sources, highest regular price | rank conflict over 5%; current over 30 days |
| M3 | Used price per site | market | comps weighted per money.md D1 | weighted quantiles of sold comps | D1 minimum basis; 45 days old |
| M4 | For sale now | market | eBay total, search reads, Keepa | deduped clusters, capped lower bound | site unread; 7 days old |
| M5 | Sold in a period | market, insights | eBay sold, sold tags, orders | distinct sold clusters, lower bound | under 3 |
| M6 | Sell-through | market, score | listing cohort, outcomes | 30-day cohort share sold | under 10 in cohort |
| M7 | Days to sell | market, insights | listing dates, outcomes | survival curve with censoring | under 5 sales |
| M8 | Demand and rising | market | sold rate, turnover, watchers, Trends | weighted log ratios to baseline | under 5 sold; one proxy |
| M9 | Hype and decay | market | retail, early sold p50 | exponential decay fit to premium | no retail; under 4 weeks |
| M10 | Depreciation curve | market | sold with retail, Keepa | fixed-effects hedonic age curve | under 20 products |
| M11 | Price retention | market | M3, M2, M10 | used median over launch retail | M2 or M3 hidden |
| M12 | Seasonality | market | our index, Keepa, Trends | ratio to moving average | under 24 months; no clear season |
| M13 | Brand or category movement | market | brand index, sales share | matched index and share change | under 10 products or 30 sales |
| M14 | Category price index | market, data | product weekly medians | chained weighted geometric mean | under 60% of weight |
| M15 | Trending and noise | market | sold counts, attributes | binomial test, false discoveries controlled | under 5 per cell; 2 reads |
| M16 | Release effect | market | releases, M3, M4, index | event study against category | under 5 past events |
| M17 | Cheaper equivalent | buy, market | material, build, retention | weighted facet similarity, price filter | material or condition unknown |
| M18 | For you | buy | wants, follows, purchases, sizes | stated weights times deal position | not opted in; under 3 signals |
| M19 | Follow moved enough | market, watch | M3, M2, M15 | 10% and band, 10 sales | any input hidden |
| M20 | Safe to share | data, market | aggregate tables | contributors, dominance, complementary suppression | under 10 contributors; one over 50% |
| M21 | Citation | data | table versions, basis ids | time-travel recompute with hash | no citation, never shown |
| M22 | Price change | market | M3 | two medians with a band | either end hidden |
| M23 | Cheaper to buy, better to sell | market, price | per-site M3, fees | per-site medians net of fees | under 2 sites; ranges overlap |
| M24 | Same-purpose match | buy, market | M1, Shopify catalog, Klarna, retailers, programmes, family link, M17 | identifier, family link, facet score | identity unsure; one source; slots unset |
| M25 | One condition scale | buy, market | site grades, programme grades, our reading | table map, lower wins | no grade and no reading |
| M26 | Delivered price | buy, market | offer, shipping, tax rate, delivery | price plus shipping plus tax | no price; shipping unknown |
| M27 | Value it will keep | buy, market | M10, M11, M16, Swappa prior | age curve read forward | M10 hidden; past data; too wide |
| M28 | Net cost of ownership | buy, market | M26, M3, M27, M23 | delivered minus resale later | resale hidden; too wide |
| M29 | New against used verdict | buy, market | M28, D17, D18, warranty, score, recall | gates, then gap band | no option; cost hidden |

## What cannot be made credibly

| Determination | Why |
|---|---|
| True search volume or views on the five marketplaces | no site publishes them for others' listings ([analytics](../../research/data/nate/analytics-and-recommendations.md#3-what-cannot-be-known-and-the-proxy), *asserted*); M8 uses proxies and says so |
| Full sold counts on Facebook | Facebook has no sold mark; an ended listing may have sold, been given away or been removed |
| Full sold counts on Poshmark, Mercari, Depop | only the sales our reads saw; shown as "at least" |
| The accepted price behind a sold-tag, outside eBay with a seller session | the site shows the last ask; weighted per money.md D1, never corrected to a guessed value (M3 step 6) |
| StockX and GOAT prices and premiums on our pages | the terms bar commercial use and display (*observed*, [market-intelligence](../../research/data/nate/market-intelligence.md#5-rights-and-limits)); recorded as a fact, used nowhere person-facing |
| Seasonality and depreciation from our own data before 2 years | too short; M10 and M12 lean on Keepa and Trends until then, labelled |
| A hype forecast for an unreleased product | no sales exist; a thesis-level model with an R-squared of about 0.65 on resale premium ([claims validated](../../research/cross-cutting/nate/claims-validated-papers-and-docs.md)) ([market-intelligence](../../research/data/nate/market-intelligence.md#25-academic-work), *observed*) is not a number to show |
| Why a trend happened | the counts say that, not why; no source ties a rise to a cause |
| Authenticity and hidden condition in any market number | not known from a listing; the condition band is what the seller showed |

## What I need from other areas

| From | Need |
|---|---|
| identify | the condition bands, and the flags lot, bundle, parts, box only, replica on every comp (labels and thresholds are now card 9's) |
| price | per-site fee functions and shipping defaults for M23 and M26, read by M3 through money.md D1 |
| score | the authenticity risk level M29 gates on, as one field |
| assist | card 10 of `spec/determinations/asking-and-intent.md` adds a `keep_for` slot (how long the person means to keep it, in months), read by M27, M28 and M29; the other slots are read by card 10's names |
| data | the own-account eBay seller route that reads the accepted Best Offer amount (M3), and `price_point` and `held_for_review` rows (M3, M14) |
| data | `retail_offer` rows {product_id, relation, seller_kind, condition, price_cents, shipping_cents, tax_cents, delivery_min_days, delivery_max_days, stock, ships_from, ships_to, warranty_months, returns_days, source, fetched_at, rights} with Shopify rows never stored past 10 minutes |
| everyone | the states' published tax rate tables loaded for M26, and the Shopify Catalog and Klarna partner access M24 reads |
| data | `comp.first_seen_at`, `comp.listed_at_source`, `comp.ended_at` and `ended_reason (sold, ended)`, cluster ids on comps, a `release_event` table (product, store, kind release or restock, date, source rank), and `basis_hash` on `citation` |
| data | a product family link (predecessor and successor) in the catalogue, for M16 |
| identify, studio | material composition and build specs as typed attributes with evidence, for M17 |
| watch | the measured fit reference used by M18 |
| everyone | the Trends and Keepa read budgets (calls per day) the jobs above may spend |

## What its parameters learn from (*agent proposal*)

Every learned number on this page is a `param` row whose written value is the prior. It updates from three sources, each written as an `observation` with evidence and a weight for how sure the outcome is: every listing the protocol reads on a site and what changed when it was read again (a price or rank change, a sold mark, a disappearance counted as a probable sale by age and the site's sell-through); what platforms and industries publish, gathered by the information engines; and our own users' outcomes, the most exact rows, which calibrate the rest. Learning does not wait for our users. How rows update, promote, guard and roll back is in [product §6](../product.md#real-time-weights-agent-proposal).
