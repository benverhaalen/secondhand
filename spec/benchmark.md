# The open benchmark

Status: *agent proposal* for Nate and Ben, written 2026-11-15. Asked by [Nate](../product/words.md#2026-11-15-nate-benchmark-our-intelligence-engines-against-the-others-in-the-open): "I want to find things to benchmark our intelligence engines against, things to really show on our website how we are more reliable, accurate, and credible than these other systems ... the swath of data that even paid enterprise sources don't."

No public benchmark exists for secondhand intelligence in anything we researched ([parity](parity.md)); the one published test is a vendor's and is not sound ([published price tests and their flaws](../research/price/nate/published-price-tests-and-their-flaws.md)). So we run our own, in the open, against named tools, and publish the items, the date, the method and every raw answer.

## In one paragraph

We take 200 real secondhand items, ask every tool the same questions about each on the same day, save every raw answer, and score ten things: how many items get an answer, how much comes back per answer, whether the numbers show their sources, sold prices across sites, exact matches, freshness, price accuracy, speed, what happens when evidence is thin, and how fast a sale delists everywhere. The website shows each as an amount with its count, lists the tools alphabetically, shows the rows we lose, and links every figure to its records and to the command that reruns it.

## The tools and what each does

From [parity](parity.md) and the teardowns it cites ([search and similar-item finders](../research/watch/nate/teardown-search-and-similar-finders.md), [price tools and registries](../research/data/nate/teardown-price-tools-and-registries.md), [Dupe.com observed](../research/watch/nate/dupe-observed-in-browser.md), [seller analytics](../research/data/nate/shopify-analytics-and-seller-analytics.md)). The marks there apply: much of this is what a tool says of itself (*asserted*), not something we ran. The benchmark is what turns each line into an observed result.

| Tool | What it is | What it does | What it does not do, as recorded | Rows it is run on |
|---|---|---|---|---|
| ThriftX | an iOS app, not a repo; no open source found | live search across six secondhand marketplaces, cheapest copy first, duplicates collapsed | no sold prices, no valuation, no selling side | 1, 2, 3, 5, 8, 9 |
| Dupe.com | a site, extension and chat agent over a large retail catalog | finds similar new items from a photo, link or chat; published research method with sources per claim | used market lightly; no sold prices | 1, 2, 3, 5, 8, 9 |
| Phia | a shopping app and extension | a price label on a listing | no sources per number | 2, 3, 7 |
| Croissant | a resale-value tool with a sold-price data set | a resale value for an item | method not published | 2, 3, 7 |
| Gem | a search and alert tool for vintage and secondhand | daily alerts for new listings | one check a day | 1, 6 |
| Terapeak (eBay Product Research) | eBay's own seller research | eBay sold history, sell-through, accepted offer prices | eBay only; looks back only | 2, 4, 6, 7 |
| 130point | a sold-price lookup | accepted Best Offer prices on eBay | eBay only | 4, 7 |
| PriceCharting, Card Ladder, WatchCharts | price guides for games, cards and watches | price history and an index for one kind of item | one kind each | 2, 6, 7 on their own kind |
| Keepa, camelcamelcamel | Amazon price trackers | price history and drop alerts | Amazon only, new goods | 2, 6 |
| Vendoo, List Perfectly, Nifty, Flyp | crosslisting tools for sellers | crosslist, detect a sale, delist, bulk offers, profit by site | no valuation with evidence; no market data | 10, and 2 for what they return |
| Shopify catalog and analytics | a product catalog across merchants and store metrics | one product across stores; sessions, conversion, order value | new goods, one store | 2 |
| Lyst | a fashion search site | brand rankings | weights not published | 2 |

A paid data provider is not in this table because none has been run or read closely; adding one is an open question below.

## What we expect to show, and what would prove us wrong

These are predictions written before any run, so the page cannot be fitted to the result.

| Row | We expect | We are wrong if |
|---|---|---|
| 1 Coverage | an answer for more of the 200 than any one tool, because we read five marketplaces, official stores and Amazon | a single-site tool answers more items than we do |
| 2 Breadth | eight or more of the twelve kinds of fact per item, against at most three from any other tool | another tool returns six or more |
| 3 Sources | every number opens to its evidence | any number of ours has none behind it: that is a build fault and blocks the page |
| 4 Sold across sites | sold prices from three or more marketplaces for most apparel and electronics | Depop shows no sold state publicly and it drags the share under half |
| 5 Exact match | higher than a cheapest-first or looks-alike ranking, since exact is never decided from the image alone | the judges mark a look-alike tool as more exact |
| 6 Freshness | minutes, against a day or more | our warm cache serves older data than a rival's live fetch |
| 7 Price accuracy | the stated share of sales inside the range, per family, checked by our backtest | a family lands well under its stated share: we widen the range or hide the number there |
| 8 Speed | a first answer in about a second and a full one inside ten | a live-scrape tool is faster to a full answer |
| 9 Thin evidence | more evidence after a wider search, on the 20 rarest items | we return nothing where a rival returns a sourced answer |
| 10 Sale to delist | under two minutes at the 95th percentile | a crosslister on its top plan is faster |

## The rules

1. One fixed set of real items, chosen before any tool is run and never changed after: the [real-item set](items/manifest.json), grown to 200 across the product families. For price accuracy the listings are live ones picked before any sale is known: whatever sells afterwards is scored and the unsold are reported, since an item whose sale is already known is leakage and one picked because it sold is survivorship ([data-science sweep, item 11](plans/sweep/data-science.md)).
2. Each tool is used the way a normal person uses it, signed out or on its free plan unless the row says otherwise, on the same day as ours. A tool that does not cover a question scores "no answer", which is a result, not an exclusion.
3. Every raw answer is saved with a screenshot or the response and its time. A number is claimed on the website only if the run that produced it is in the published record.
4. Our own answers come from the same public API anyone can call, not from an internal path.
5. Where we lose a row, the row is published as lost.

## What is measured

| # | Dimension | The measure | Run against |
|---|---|---|---|
| 1 | Coverage | of 200 items, the share that get any answer, and the number of sites the answer draws on | ThriftX, Terapeak, Dupe.com |
| 2 | Breadth per answer | how many of these twelve kinds of fact come back for one item: sold prices, live listings, the official price, credible discounts, product reviews, seller reviews, demand trend, time to sell, fees per site, what you keep, the same item on other sites, a price history | every tool in [parity](parity.md) |
| 3 | Sources shown | the share of numbers in an answer that open to the listings or pages behind them | all |
| 4 | Sold prices across sites | the share of items with sold prices from three or more marketplaces | Terapeak, 130point |
| 5 | Exact match | of the top ten results, the share that are the same product and variant, judged by two people against the item's known identity, who do not see which tool gave the result; their agreement is printed beside the row and a third person settles a disagreement | ThriftX, Dupe.com |
| 6 | Freshness | the age of the newest data point in the answer | Gem, Terapeak, Keepa |
| 7 | Price accuracy | for the items that sell after the answers: every tool that states a price is scored on the absolute percent error of its middle price, paired on the items both answered; a tool that states a range is also scored on the share of sale prices inside it with the range's width beside it; by family. The item count and its interval are stated with every figure: at 20 items an 80% share reads anywhere from 58 to 92% ([data-science sweep, item 11](plans/sweep/data-science.md)) | every tool that states a price or range |
| 8 | Speed | seconds to the first answer and to the full answer, median and p95 | ThriftX, Dupe.com |
| 9 | Thin evidence | for the 20 rarest items, whether the tool returns nothing, a guess with no basis, or more evidence after a wider search | all |
| 10 | Sale to delist | seconds from a sale on one site to the listing being down on the others, on test listings | Vendoo, List Perfectly |

Rows 1 to 6, 8 and 9 measure the data itself. Row 7 is accuracy and is one row of ten on purpose.

## How it is shown

Nate ([words](../product/words.md#2026-11-15-nate-show-the-benchmark-as-amounts-not-tables-of-checks-and-crosses)): "we want amount of items compared graphically shown, amount of time, price, accuracy or capability could be the x's and checkmarks." A check or a cross is used only where the fact is yes or no (a capability); everything that is an amount is drawn as an amount with its count. How it is drawn is Ben's; what each view must carry is below.

What public benchmarks of this kind show today (*observed* on each page through search highlights, 2026-11-15; nothing rerun by us):

| Page | What it shows | What we take |
|---|---|---|
| [Openbenchmarks web search](https://openbenchmarks.com/web-search) | per vendor: accuracy, cost per 1,000 correct answers, latency, on 300 fixed questions; open harness and dataset; vendors listed alphabetically; the answer-reading model and the judge held constant | cost per correct answer as one figure; the item count in the headline; alphabetical order, not ours first |
| [Scrapingbench, as reported by Context.dev](https://www.context.dev/blog/scrapingbench-web-scraping-api-benchmark-results) | tasks done as "38 of 40", a 95% interval beside every rate, cost per finished task, median time; run by a third party | counts as "n of N" with an interval, never a bare percentage |
| [Firecrawl benchmarks](https://www.firecrawl.dev/benchmarks) | coverage, extraction F1, recall, P95 latency on 1,000 URLs in ten categories; scored against human answers, not a model; dated and changelogged; its own numbers included | a result per category; a dated changelog; human-labelled truth |
| [fastCRW](https://fastcrw.com/benchmarks) | truth-recall on a rival's own public dataset; p50, p90 and p99 instead of an average; one script to rerun | percentiles, never an average; a rerun command on the page |
| [SerpKite](https://serpkite.com/benchmarks) | median latency, success as "60 of 60", list prices; raw per-request data published monthly | the raw record of every request downloadable |
| [Nimble](https://llms.nimbleway.com/performance-slas-and-scale) | a factsheet where every figure links to its source, and the categories where rivals win are published | every figure links to its records; lost rows shown |
| [Parallel](https://github.com/parallel-web/parallel-llms-txt/blob/f6b31ffe/public/index.md) | accuracy against cost as a scatter, one point per system | the two-axis view below |

None of these is about secondhand goods; they are the nearest public practice. None shows breadth of data per answer, which is our strongest row.

The views:

| View | Draws | Must carry |
|---|---|---|
| The headline | three figures: items compared, sites covered per answer, sale prices that landed in range | the count behind each ("200 items", "132 of 200") and the run date |
| Coverage | one bar per tool: items answered out of 200, as a filled count, with the sites drawn on | "n of 200" on the bar and its interval |
| Breadth | for one item, the twelve kinds of fact as a row of cells per tool, each cell filled with the number of data points returned (0 leaves it empty) | the count in each cell: this is the "swath of data" picture, and it is an amount, not a tick |
| Accuracy against speed | a scatter: share of sale prices in range against seconds to a full answer, one point per tool, the point sized by coverage | tools with no price answer sit on the axis, labelled "no answer" |
| Accuracy by family | small bars per product family with the item count under each | never a family with fewer than ten items |
| Time | p50 and p95 seconds to first and full answer as two marks on one line per tool | no average |
| Freshness | the age of the newest data point per tool on a time line | the run time as the zero |
| Sources | the share of numbers that open to their evidence, as a filled bar, and the page itself opens every one of ours | a live example: tap a number, see its listings |
| Capabilities | the only table with checks and crosses: the yes-or-no facts (sells and buys, sold prices, offers handled, delists on sale, shows sources) | a cross reads "not in this run", with the date |
| Price | what a person pays for each tool per month, as plain figures | list prices with the date checked |

Every view links to the raw records and the rerun command, lists tools alphabetically, shows the rows we lose, and states the date and item count in its own caption.

## How it is built

| Part | Owns | Proves with |
|---|---|---|
| The runner: one command that asks our public API every question for every item and writes one record per answer | `bench/run.mjs`, `bench/run.test.mjs` | `node --test bench/run.test.mjs` |
| The scorer: the ten measures from the records, with the item count behind each | `bench/score.mjs`, `bench/score.test.mjs` | `node --test bench/score.test.mjs` (a planted record set with known scores) |
| The rivals' record: for each tool, the same items asked by hand or through its own public interface, saved in the same record shape with its evidence | `bench/rivals/<tool>/` | the scorer runs on it unchanged |
| The published page's data: one JSON file the website reads, with every number linked to its records | `bench/out/results.json` | the scorer writes it; a test fails if a number has no record behind it |

Likely to break it, each with its test: an item swapped after a run (the manifest hash is in every record); a rival's answer scored by a different rule than ours (one scorer, no tool-specific branch); a number with no saved evidence (refused by the scorer); a sale price that the tool could have seen (the sale date must be after the answer's time).

## Running it

1. Freeze the item set: the manifest's hash goes in every record.
2. Run ours through the public API with the runner, once, with the time recorded.
3. The same day, two people ask each tool about each item the way a normal person would, and save the answer and a screenshot into that tool's record. A tool with a public interface is asked through it.
4. Publish the hash of the answers file before any sale. Then wait for the sales: an item is scored for row 7 only against a sale dated after the answers, and the items that did not sell are counted and reported.
5. Run the scorer. It writes the results file and refuses any number without a record.
6. Publish the page, the records, the manifest and the rerun command together. A rerun is dated and added to a changelog; an old run is never overwritten.

The first run is small on purpose: 20 items across five families against three tools, to prove the runner, the record shape and the scorer before the 200.

## What may not be claimed

- Anything about a paid enterprise data provider until the same items have been run through one.
- That a rival "cannot" do something we only failed to find in its interface: the row says "no answer in this run".
- A ranking of tools overall. Each row stands alone.

## Open for Nate and Ben

- Which rivals are named on the website, and whether they are named at all or shown as "Tool A".
- Whether a paid plan of any rival is bought for the run.
- Who the two judges for row 5 are.
- Whether a paid data provider is run, and which.
- Whether the item set's photos are published with it or only their descriptions.
