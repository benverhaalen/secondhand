# The open benchmark

Status: *agent proposal* for Nate and Ben, written 2026-11-15. Asked by [Nate](../product/words.md#2026-11-15-nate-benchmark-our-intelligence-engines-against-the-others-in-the-open): "I want to find things to benchmark our intelligence engines against, things to really show on our website how we are more reliable, accurate, and credible than these other systems ... the swath of data that even paid enterprise sources don't."

No public benchmark exists for secondhand intelligence in anything we researched ([parity](parity.md)); the one published test is a vendor's and is not sound ([published price tests and their flaws](../research/price/nate/published-price-tests-and-their-flaws.md)). So we run our own, in the open, against named tools, and publish the items, the date, the method and every raw answer.

## The rules

1. One fixed set of real items, chosen before any tool is run and never changed after: the [real-item set](items/manifest.json), grown to 200 across the product families, half of them with a known later sale.
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
| 5 | Exact match | of the top ten results, the share that are the same product and variant, judged by two people against the item's known identity | ThriftX, Dupe.com |
| 6 | Freshness | the age of the newest data point in the answer | Gem, Terapeak, Keepa |
| 7 | Price accuracy | for the 100 items with a known later sale, the share of sale prices inside the stated range, with the range's width beside it; by family | every tool that states a price or range |
| 8 | Speed | seconds to the first answer and to the full answer, median and p95 | ThriftX, Dupe.com |
| 9 | Thin evidence | for the 20 rarest items, whether the tool returns nothing, a guess with no basis, or more evidence after a wider search | all |
| 10 | Sale to delist | seconds from a sale on one site to the listing being down on the others, on test listings | Vendoo, List Perfectly |

Rows 1 to 6, 8 and 9 measure the data itself. Row 7 is accuracy and is one row of ten on purpose.

## How it is built

| Part | Owns | Proves with |
|---|---|---|
| The runner: one command that asks our public API every question for every item and writes one record per answer | `bench/run.mjs`, `bench/run.test.mjs` | `node --test bench/run.test.mjs` |
| The scorer: the ten measures from the records, with the item count behind each | `bench/score.mjs`, `bench/score.test.mjs` | `node --test bench/score.test.mjs` (a planted record set with known scores) |
| The rivals' record: for each tool, the same items asked by hand or through its own public interface, saved in the same record shape with its evidence | `bench/rivals/<tool>/` | the scorer runs on it unchanged |
| The published page's data: one JSON file the website reads, with every number linked to its records | `bench/out/results.json` | the scorer writes it; a test fails if a number has no record behind it |

Likely to break it, each with its test: an item swapped after a run (the manifest hash is in every record); a rival's answer scored by a different rule than ours (one scorer, no tool-specific branch); a number with no saved evidence (refused by the scorer); a sale price that the tool could have seen (the sale date must be after the answer's time).

## What may not be claimed

- Anything about a paid enterprise data provider until the same items have been run through one.
- That a rival "cannot" do something we only failed to find in its interface: the row says "no answer in this run".
- A ranking of tools overall. Each row stands alone.

## Open for Nate and Ben

- Which rivals are named on the website, and whether they are named at all or shown as "Tool A".
- Whether a paid plan of any rival is bought for the run.
- Who the two judges for row 5 are.
