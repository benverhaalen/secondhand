# What would a staff engineer who has run price and web-data systems say about the intelligence API engine?
Researched 2026-11-14 by Nate (Claude Code, Sonnet 5.5). Feature: data.

This is an expert session. The speaker is a persona, "Mara", a staff engineer who has built price-intelligence and web-extraction systems of the Keepa, Terapeak, Firecrawl, crawl4ai and Zyte kind. Mara is not a real person and has no real record; her views are (*inferred*) from the sources below, not quotes. The design under review is [the intelligence API engine](../../../spec/engines/intelligence-api.md) (sections 1, 3 and 5) and [product.md](../../../spec/product.md) section 1. Tags: *observed* means the byte source was read on 2026-11-14 or a search result quoted it; *asserted* means a source says it but we did not read the primary; *inferred* means our reasoning.

## Answer

The engine's shape is right: typed questions, all targets at once, a guard that hides a weak number (*inferred*). Mara's three worries. First, section 1 decides how to get an answer but not what the number means: sold price, currency, shipping, condition and survivorship are left out. Second, the cited sold-price sources mostly are not open to us. Third, several numbers (0.85 classify, 2 x p95 deadline, 90-day half-life, pHash) are starting guesses with no stated way to tune them (*inferred*).

The user is "someone clearing their own things who also buys used" (product.md section 1), so the number drives a price on a real listing. A wrong number costs the seller money, which matters more than speed (*inferred*).

## (a) Everything to determine

Checked against section 1 of the engine doc, which lists seven decisions.

1. **Which kind the question is.** Covered. Also needed: what to do when the question is two kinds at once ("what is it worth and where do I list it"). Not in section 1 (*inferred*).
2. **Which targets to call, with deadline and budget.** Covered. Also needed: a per-source allowance (is this source legal and licensed to call at all), and a cap on total spend per question across hedges (*inferred*).
3. **What each page says.** Covered by the extraction ladder. Also needed: what the price on the page means. A listed price, a sold price, a best-offer-accepted price and an auction end price are four things (*inferred*).
4. **Which results are the same product, and which to keep.** Covered. Also needed: condition grade, size or variant, lot or bundle, "for parts", and a fake or replica flag. Same model is not the same item (*inferred*).
5. **How disagreeing sources are reconciled.** Covered. Also needed: one currency, one region, and shipping in or out, before any comparison (*inferred*).
6. **When the answer is settled.** Covered by the gather loop. Also needed: a stated error bar and what "settled" means for the seller, not only for n_eff (*inferred*).
7. **Whether a hidden number becomes a `gather_request`.** Covered.

What section 1 misses entirely (*inferred*):

- **Sold truth.** Which sources have real sold prices, and which only have asking prices. The two must never be mixed in one median without a label.
- **Currency, region, tax and shipping normalisation.**
- **Survivorship.** Sold comps only show items that sold. Items that sat unsold at a high price are invisible, so a median of sold prices is biased upward for slow items.
- **Rights per source.** Terms of service, robots rules, API licence, and whether a stored price may be shown.
- **Block state per source.** A page that returned a bot wall is not "no data".
- **Retry budget.** How many retries, across all targets, before the question stops.
- **Cold start.** What a new template or a new source returns before any learning exists.
- **Poisoning.** One bad scrape (a wrong price cached under a shared key) served to many users.
- **Answer age.** How old the answer may be when served from cache, per kind.

## (b) The best method for each

### 1. Fetch waterfall with a hedge
Firecrawl runs engines in order and starts the next one in parallel when one passes its "max reasonable time"; `Promise.race` takes the first good result; there is a 300000 ms fallback (*observed*, `apps/api/src/scraper/scrapeURL/index.ts` lines 918, 958, 988, https://github.com/firecrawl/firecrawl/blob/main/apps/api/src/scraper/scrapeURL/index.ts). The same file imports `WaterfallNextEngineSignal`, `EngineSnipedError` and `NoEnginesLeftError`, so "next engine", "beaten by another" and "none left" are separate named outcomes (*observed*). The engine doc should copy that: three outcomes, not one "failed".

### 2. Hedging and its cost
Dean and Barroso define a hedged request as sending a second request after a short delay and cancelling the rest once one answers. They say to defer the second request until the first has been outstanding longer than the 95th-percentile expected latency for that class, which "limits the additional load to approximately 5%" (*observed*, https://cacm.acm.org/research/the-tail-at-scale/). The same page says naive hedging "typically add[s] unacceptable additional load". Two points for us (*inferred*):
- Their threshold is p95 of the class. The doc's `2 x route p95` is a deadline to give up, not a hedge trigger; it should say which of the two it means. At 2 x p95 a hedge fires about never.
- The paper's setting is replicas of the same data that we own. A second request to a third-party site is a second hit on a rate-limited host. Hedging between different sites (route A slow, try route B) is safe; hedging the same host is not.

### 3. Single flight
One in-flight call per key, others wait for its result. The Go package `golang.org/x/sync/singleflight` is the usual reference (*asserted*, https://pkg.go.dev/golang.org/x/sync/singleflight, not fetched). The doc's key is (route_id, normalized query). Mara's rule: the key must also hold the freshness class, or a "give me stale is fine" caller can hand a result to a "must be fresh" caller (*inferred*). A failed shared call must not be cached as the answer for the callers who joined late.

### 4. Per-domain rate limiting
crawl4ai's `RateLimiter` has `base_delay=(1.0, 3.0)`, `max_delay=60.0`, `max_retries=3`, `rate_limit_codes` [429, 503], and keeps state per `urlparse(url).netloc` (*observed*, https://github.com/unclecode/crawl4ai/blob/main/crawl4ai/async_dispatcher.py). Keying by host (netloc) means two routes on one host share a limit. The doc's limiter is "per domain"; it should say per host and say whether it honours `Retry-After` (*inferred*; crawl4ai's code we read keys on the status code only).

### 5. Extraction ladder
- **JSON-LD first.** Product with Offer carries price, currency and availability, and Google documents `priceValidUntil` and Offer fields (*observed*, https://developers.google.com/search/docs/appearance/structured-data/product-snippet). Caveat: marketplace pages often publish the asking price, not the sold price (*inferred*).
- **Schema written once by a model.** crawl4ai `generate_schema(html, schema_type="CSS", query, target_json_example, llm_config, url, validate=True, max_refinements=3)` (*observed*, `crawl4ai/extraction_strategy.py` line 1692). It validates against the page and refines up to three times. That is the doc's step 3.
- **Regenerate trigger.** The doc says regenerate at a missing-field rate above 0.2 over 50 pages. crawl4ai has no such rule in what we read (*observed*: none found in the file). So 0.2 and 50 are the doc's own numbers (*inferred*). Mara would add a canary page per template and compare on fields that must exist (price, title), not all fields.

### 6. Gather-more and stopping
crawl4ai's adaptive crawler uses `confidence_threshold=0.7`, `min_gain_threshold=0.1`, `saturation_threshold=0.8`; confidence = 0.4 coverage + 0.3 consistency + 0.3 saturation; saturation is 1 minus the recent new-term rate over the initial rate (*observed*, https://github.com/unclecode/crawl4ai/blob/main/crawl4ai/adaptive_crawler.py lines 156 to 164, 324, 396 to 410, 527 to 543). It measures whether new pages add new words. It does not measure whether new listings move a price. Our doc stops on "n_eff >= 6 and at least 2 sold in 90 days, or saturation, or 120 s". The doc's "saturation" must be defined for prices: for example, the median moved less than a set share over the last k added comps (*inferred*). Do not borrow crawl4ai's term-based version.

### 7. Where sold prices come from
- eBay Browse API returns active listings only (*asserted*, https://developer.ebay.com/api-docs/buy/browse/overview.html via search, not fetched in full).
- eBay Marketplace Insights, `GET /item_sales/search`, is a "Limited Release" for approved developers, with a 90-day sales history (*observed* in a search result of https://developer.ebay.com/api-docs/buy/marketplace-insights/resources/methods).
- The Buy APIs sit behind an Application Growth Check (*observed* in a search result of https://developer.ebay.com/develop/get-started/get-started-on-a-buying-application).
- The older Finding API `findCompletedItems` is reported decommissioned in February 2025 (*asserted*, secondary pages only: compsniper.com and ebaysoldlistingsapi.com; no eBay primary page read).
- Poshmark, Mercari and Depop: no public sold API found (*not-found*; see Not found).
So the doc's `sold_90d` cannot assume an official sold feed. Sold evidence will mostly be scraped sold pages, the user's own sales, and contributions (*inferred*). That makes rights (a)(2) above a real gate.

### 8. Same-photo de-duplication
pHash is a 64-bit hash compared by Hamming distance. The original pHash page says a threshold of T=22 separates the same source image from unlike ones on its corpus (*observed*, https://phash.org/docs/design.html). Another measurement gives a 95%-of-copies threshold of at most 7 of 64 bits on photographs and at most 17 on synthetic images, and says "the threshold belongs to the collection" (*observed*, https://gudoshnikovn.github.io/libphash/theory/comparing/). Blog rules of thumb run from 6 to 15 (*asserted*, https://www.mikeperham.com/2010/05/21/detecting-duplicate-images-with-phashion/ says 15; go-phash says 6). The spread is the point: the doc gives no number, and none is safe without labelled pairs from our own sites. Product photos on white backgrounds are the hard case, where a loose threshold merges two different items (*inferred*). Mara's rule: pHash proposes, and a second cue (seller, price, title) must agree, as the doc already half says. Do not let pHash alone merge two sellers' items.

### 9. Learning from outcomes
A Beta-Bernoulli bandit keeps (alpha, beta) pseudo-counts per arm, adds the success or failure to the chosen arm only, and Thompson sampling draws theta from Beta(alpha, beta) and picks the highest draw (*observed*, https://arxiv.org/pdf/1707.02038, section 3). Starting at alpha = beta = 1 gives a uniform prior (*observed*, same page). For us: the arm is a route, a reward is "its answer matched later truth". Two cautions (*inferred*): the reward must be known (a sale price arrives days later, so updates are late and sparse); and the method assumes a fixed success rate, while sites change, so the counts need decay.

### 10. Small typed decisions by a model
The doc's Jev step (same-product, keep or drop, 20 per request, 400 ms budget). The 0.85 top probability and 0.5 lead for classify are the doc's own (*inferred*). The repo note on jev-ultrafast records that its decision validation requires a sum within 0.02 (*observed*, [intelligence-api-from-four-repos.md](../../data/nate/intelligence-api-from-four-repos.md) section 4). Whether 0.85 is right is an empirical question: label 200 real questions, plot accept rate against error rate, and choose from the plot (*inferred*).

## (c) What the doc misses

Gaps, risks and wrong assumptions, most serious first (*inferred* unless marked).

1. **No definition of "sold".** The central number is a price the seller can expect, yet the doc does not say which price kinds count (sale, accepted offer, auction end, asking). Without it the guard cannot say `mixed_types` correctly.
2. **Sold feeds are mostly closed** (section (b) 7). The doc's example protocols lean on sold in 90 days. If the real supply is thin, the guard will hide most numbers and the user sees an empty screen. The product needs a graceful "asking-price range, labelled as asking" answer for that case.
3. **Survivorship and asking-price bias.** Asking prices run above sale prices; sold comps hide unsold items. A stored ratio of sale to asking per category, learned from the user's own sales, would correct this. The doc has `w_age` but no such term.
4. **`w_age` half-life 90 days, cut at 365.** One half-life for every category is wrong: a phone loses value in weeks, a hand tool in years. The half-life must be per kind or per category and tuned (*inferred*).
5. **The 2 x p95 deadline** reads as a give-up bound, not a hedge trigger (section (b) 2). Two different numbers are being called one thing.
6. **Hedging on one host doubles load** and can trip the rate limit or a block for everyone (section (b) 2, 4).
7. **Bot blocks look like empty results.** crawl4ai marks any 403 or 503 with HTML as blocked, and says "false positives are cheap ... false negatives are catastrophic" (*observed*, via [the four-repos note](../../data/nate/intelligence-api-from-four-repos.md) section 2, source `antibot_detector.py`). The doc has no block state, so a wall could be counted as "no listings" and push the guard to `too_few`.
8. **Rights and licence.** Firecrawl is AGPL-3.0 (*observed*, same note, section 1). A modified copy served over a network must publish its source. Running it unmodified as a separate route is the doc's plan, which is fine, but it must stay unmodified. Scraping a marketplace may break its terms; the doc has no per-source "allowed" flag.
9. **Cache poisoning.** One wrong price, cached under the single-flight key and shared, reaches every user. Needs a validity check before write (price within a band of the median for that product) and a way to purge by route and time.
10. **Contribution Betas are under-specified.** What is a "success" for a contribution, how late can it arrive, what is the prior, is there decay, and can one user vote many times? Without those the learning step cannot be built or tested (section (b) 9).
11. **pHash threshold missing** (section (b) 8).
12. **Cold start.** A new site or template has no p95, no Beta, no schema. The doc should say what a new route's first 50 calls use: a wide prior, a forced model extraction, and a lower weight in reconcile.
13. **Currency and region.** Not in section 1; every cross-border comp needs a rate and a date.
14. **Stop rule uses crawl4ai's word "saturation" but not its meaning** (section (b) 6).
15. **Timing numbers have no source.** The 400 ms Jev budget and 120 s gather deadline are the doc's own. The four-repos note says the jev speed gain was not significant at p=0.25 (*observed*, section 4), so the 400 ms should be treated as a target until our own traces exist.
16. **Two kinds at once and ambiguous questions** have no defined handling (section (a) 1).
17. **Privacy.** The user's own item photos and sales feed learning; the doc should say what leaves the device and what is kept (*inferred*; the product has no storefront and no payments, so the data is personal).

## Questions for the operator (not decided here)

- Which sold sources can we legally and practically reach on day one? That sets how often a number will be hidden.
- Is an "asking-price range" an acceptable answer when sold data is thin?
- Is the seller-facing number a median, a range, or a floor?

## Doc changes proposed (the diff list)

These are proposed changes to `spec/engines/intelligence-api.md`. The doc itself is not edited.

- Section 1: add decisions for "which price kind this number is" (sale, accepted offer, auction end, asking), "currency, region and shipping basis", and "which sources are allowed for this question". *agent proposal*
- Section 1: add a block state per target (ok, blocked, empty) separate from "no results", so a bot wall never counts toward `too_few`. *agent proposal*
- Section 3 and 5: split the deadline into two named values, a hedge trigger (route p95, per class) and a give-up bound; today `2 x route p95` stands for both. *agent proposal*
- Section 5: hedge only across different hosts; never send a second request to the same host while the first is in flight. Cap hedges as a share of calls (the paper's p95 rule gives about 5%). *agent proposal*
- Section 3: define the single-flight key as (route_id, normalized query, freshness class), and say a failed shared call is not stored as an answer. *agent proposal*
- Section 3.5: define "saturation" for prices (the median moved less than a set share over the last k added comps) and say it is not crawl4ai's new-term rate. *agent proposal*
- Section 3.3: state a pHash threshold as a measured value from labelled pairs per site, with pHash alone never merging two sellers' items. Start the labelled set at a few hundred pairs. *agent proposal*
- Section 3.3: make `w_age` half-life per kind or category, not one 90 days; keep the 365-day cut as a default only. *agent proposal*
- Section 4: specify the contribution Beta: arm, success meaning, prior (1, 1), late-arriving rewards, decay, one vote per user per item. *agent proposal*
- Section 3.1: add a sold-source availability table (eBay Marketplace Insights is limited release; Finding API reported gone since February 2025; no public sold API found for Poshmark, Mercari, Depop) and an "asking-only, labelled" fallback answer. *agent proposal*
- Section 8: add a per-source rights flag, keep Firecrawl unmodified as a separate route (AGPL-3.0), and validate a price against a band before it enters a shared cache. *agent proposal*
- Section 3.2: add a canary page per template and a cold-start rule (wide prior, forced model extraction, low reconcile weight) for the first 50 calls of a new route. *agent proposal*
- Section 9: add a calibration run for the 0.85 / 0.5 classify gate and the 400 ms Jev budget, from labelled real questions, before they are treated as fixed. *agent proposal*

## Not found

- A primary eBay page confirming the Finding API `findCompletedItems` shutdown in February 2025. Only secondary pages said so.
- Any public sold-price API for Poshmark, Mercari or Depop. No page found; absence is not proof.
- A primary page for Go `singleflight` fetched as bytes (named, not read).
- Any published description of how Keepa or Terapeak compute or correct their numbers. Not searched to a primary source; the persona's views on them are not claimed from them.
- A pHash threshold validated on second-hand product photos. Sources give corpus-specific values only.
- crawl4ai or Firecrawl code that regenerates a template at a 0.2 missing-field rate over 50 pages. None found in the files read.

## Sources fetched

- https://github.com/firecrawl/firecrawl/blob/main/apps/api/src/scraper/scrapeURL/index.ts (read as raw bytes, 2026-11-14)
- https://github.com/unclecode/crawl4ai/blob/main/crawl4ai/async_dispatcher.py (raw bytes)
- https://github.com/unclecode/crawl4ai/blob/main/crawl4ai/extraction_strategy.py (raw bytes, line 1692)
- https://github.com/unclecode/crawl4ai/blob/main/crawl4ai/adaptive_crawler.py (raw bytes)
- https://developers.google.com/search/docs/appearance/structured-data/product-snippet (fetched)
- https://cacm.acm.org/research/the-tail-at-scale/ (search result with the paper text quoted)
- https://phash.org/docs/design.html and https://gudoshnikovn.github.io/libphash/theory/comparing/ (search results with text quoted)
- https://arxiv.org/pdf/1707.02038 (search result with section 3 quoted)
- https://developer.ebay.com/api-docs/buy/marketplace-insights/resources/methods and https://developer.ebay.com/develop/get-started/get-started-on-a-buying-application (search results only)
- Repo files: spec/engines/intelligence-api.md, spec/product.md, research/data/nate/intelligence-api-from-four-repos.md, scripts/prove.mjs
