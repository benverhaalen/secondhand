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

## Speed that means something, and what the lakehouse adds

Nate ([words](../product/words.md#2026-11-15-nate-benchmark-numbers-that-mean-something-and-graphics-that-show-what-we-build-on-databricks)): "position how we can benchmark numbers that mean something how fast it is, start to imagine designs for graphics that also exhibit how we build on databricks leverage and really expand the potential of the platform". *Agent proposal*; how it is drawn is Ben's.

### What Browser Use's own pages do that we take

Read 2026-11-15: its [shopping benchmark](https://browser-use.com/benchmarks/consumer), the [eBay page](https://browser-use.com/benchmarks/consumer/sites/ebay) and its [showcase](https://browser-use.com/showcase).

| They do | Why it works | Ours |
|---|---|---|
| A stock baseline in the same table: their browser 95.8% of 500 sites, stock Chromium 5.0% | a number means something only beside what you would get without the product | every speed and coverage figure sits beside two baselines run on the same items the same day: a person doing it by hand with a stopwatch, and a single plain request with no harness |
| One page per site with a pass or fail per provider, dated | the reader checks the site they care about | one row per marketplace and per verb: proved live, proved on a recorded page, signed-in only, or refused, with the date and the run behind it |
| The task list, the results and the method as three files at fixed addresses | anyone can rerun or audit | `bench/out/<run_id>/records.jsonl`, `results.json`, the item manifest with its hash, and the method, published together |
| Recorded runs with the exact prompt and the clip's length ("39 recorded runs · exact prompts") | watching it happen is the proof | one search replayed against a clock: each marketplace's results landing on a timeline, from the records' own `first_at` and `full_at` |
| One number in the title ("Clear 100 Tetris Lines in 17s") | a claim a person can repeat | one sentence per run made only of counted things: marketplaces, listings, cited numbers, seconds |
| Their caveats on the page (self-graded rows, gaps in records) | it reads as measured, not sold | every figure carries its count, its interval and what was not run |

### The speed figures

Each is a row of the runner's records, reported as p50 and p95 with the count, never an average.

| Figure | What it is | Baseline beside it |
|---|---|---|
| Time to the first answer | from the request to the first marketplace's results on screen | a person opening the first site and typing the search |
| Time to the full answer | to the last marketplace, with what is still coming shown meanwhile | a person doing the same search on every site, by stopwatch |
| Seconds per cited fact | full-answer time over the number of facts that open to their evidence | the same for a rival's answer, where it shows sources at all |
| Per-site read time by lane | plain request, cloud browser, the person's own browser, an official interface | the same page loaded in an ordinary browser |
| Cold against warm | the first read after nothing was running, and a read on a session already open | none: it is our own cost of starting |
| Cost per answer | browser time, proxy bytes and model calls for one full answer, in cents | none stated by rivals; ours is published |
| Sale to delist | from a sale on one site to the listing being down on the others | a crosslister on its top plan |
| Capture: questions to done, and the time to plan them | how many questions a person is asked per kind of item, and the planner's time | a marketplace's own listing form: its count of required fields |

Measured so far, each on one machine and a handful of runs, so they are first readings and not yet benchmark rows: Depop search by plain request 1.8 s, one listing 0.78 s, a still-listed check 0.29 s; Poshmark search by cloud browser about 2.5 s; Mercari 5 to 6 s, 4 s of it a fixed wait we set; eBay search by cloud browser 9.6 s from a cold start, 4.2 s in a local browser; Dupe's published interface 1.4 to 5.4 s for 40 rows; the capture planner 0.10 ms at p50 and 0.29 ms at p95 over 47 states, asking 2 to 9 questions depending on the kind of item. The bench's own baseline is 0 of 20 items covered, recorded before the streaming search existed.

### What the lakehouse lets us show that a scraper cannot

Each is drawn from tables that already exist or are being built in Nate's workspace ([databricks build](databricks-build.md)); none needs a figure invented for it.

| Graphic | Shows | From |
|---|---|---|
| One number, opened | a price on screen, the citation under it, the sold listings under that, and the same number recomputed live from the table's own history | `measures.why(number_id)` over `core.guarded_number`, `core.citation`, `core.observation`, with Delta versions |
| The weight that learned | one tunable from its starting value: each observation that moved it, each promotion with its held-out score, a rollback, and the value served today | `core.param` history through change data feed |
| Which level answered | for every shown number, whether it came from the item's own comparables, the product, the family, the kind or the starting value, and that mix shifting toward the item's own as data arrives | `basis_level` on `core.guarded_number`, by week |
| The pipeline as a funnel with real counts | raw rows in, rows kept by each expectation, rows allowed into modelling: 207,203 in, 207,185 kept, 99,956 modelled (2026-11-15), and which sources are excluded and why | the `secondhand-market` pipeline's expectation results and `market.comp_for_model` |
| Ours beside the platform's | each safety rule in two columns: what Unity Catalog, lineage, row filters and masks give out of the box, and what our layer adds on top (a number's lineage down to its rows, a guard state as governed data, held-out promotion recorded like a model registry) | [the architect's table](plans/sweep/databricks.md) and the live policies |
| What was never done | every action the system refused or held, by rule: 480 policy answers checked, all 32 never-automated actions refused on every site | the policy sweep and `core.decision` |
| The benchmark, inside the workspace | a run's records landing as a table, the scorer's result beside it, and a question asked of it in plain words | `measures` tables for the bench, a dashboard and a Genie space |

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
