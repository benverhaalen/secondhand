# The money statistic: how much more a seller gets than pricing at the median

Ben, 08:59 ([words](../../../product/words.md#2026-11-15-ben-every-number-and-decision-says-why-the-stockx-statistic-is-how-much-more-money-than-the-median)): "with stockx the idea is we get a percent where we get more money on average ... compared to just taking the median. creating a statistic and being able to defend it." This file is that statistic, its defense, and what each dataset can and cannot give it. Status: *agent proposal*. Marks: *observed* (run here), *asserted* (a source says it), *inferred* (reasoning).

## The claim, in the form we would say it

> "Sellers who list at our price earn **X% more within 30 days** than sellers who list at the 90-day sold median, on the same items (95% interval a to b, N listings)."

X is not known yet. It is earned on data that includes **unsold** listings (NBER eBay), then confirmed live (the forecast duel). StockX alone cannot give it, and the reason is the whole defense, so it comes first.

## Why StockX alone cannot give "X% more money"

A sold row shows one price and one buyer. It says a buyer paid $250. It cannot say whether a $280 ask would also have sold, or how long it would have sat (*inferred*; the same limit is in [datasets.md §2](datasets.md)). So on sold-only data:

- Pricing above the median always looks like more money if you assume every listing sells. That number would be a lie.
- What sold data does show honestly is each side of the mistake: how often a price sits **above what the buyer actually paid** (the listing might not sell), and how many dollars a price **under** what they paid leaves on the table (it would have sold, for less).

Those two, on StockX months the fix never saw (March to October 2018, 35,862 to 37,964 priced sales per contestant; *observed*, rescored from the run's log with `backtest.py rescore`):

| Listed at | Above what the buyer paid (might sit) | Left on the table per sale, when under | Typical miss (median, signed) |
|---|---|---|---|
| **Our price** (middle) | **49%** | $14.48 | 0.1% low |
| The 90-day sold median | 69% | $12.71 | 4.3% high |
| The last sale | 57% | $9.94 | 0.9% high |

What this lets us say (*inferred*): **the 90-day median prices hype sneakers about 4% too high, so 7 in 10 sellers using it would list above what the next buyer paid; ours is centred on the market, half above and half below.** It does not let us say "more money": the median leaves less on the table precisely because it overprices, and whether those overpriced listings sell, and when, is not in the data.

## How X is measured, on data with unsold listings

**Data.** NBER eBay listings, May 2012 to June 2013, sold and unsold, with list price, start and end dates (*asserted*, [datasets.md §2](datasets.md); needs Nate's Databricks, packet 64). The sampling is datasets.md §3: products in strata of kind, price band and thickness, at most 10 test listings per product, every unsold listing kept.

**Steps.**
1. For each test listing, freeze both prices as of the day before it went live: ours (the listing price for a "balanced" goal, money [D13](../../determinations/money.md#d13-listing-price)) and the 90-day sold median of the same product.
2. Fit the chance of sale within 30 days as a function of the ask relative to the frozen market value, `P30(ask / value | kind, price band)`, on the tuning months only, from listings that did and did not sell (money [D10](../../determinations/money.md#d10-chance-of-sale-within-a-period-at-a-price)). Check it first: on held-out months it must be calibrated within 5 points (paper claim 4). If it is not, stop: X cannot be computed honestly.
3. Expected money within 30 days for a price p: `p x P30(p / value) - fees(p)`, with each site's fees from [keep.ts](../../../app/src/engines/valuation/keep.ts). An unsold listing earns 0 in the window.
4. X = sum of expected money at our price / sum at the median price, minus 1, over the same listings.
5. Interval: bootstrap over products (not listings), refitting P30 inside each draw, 1,000 draws. Report X overall, per kind and per price band, with "too few" under 30.
6. Run it once on the locked month (May 2013), recorded in the ledger before it is read.

**Why the baseline is fair.** The 90-day sold median of the same product is what a seller sees today when they filter eBay to sold items; it is the number a person would actually use, not a straw man. Both prices get the same item, the same freeze date, the same fees and the same sale-chance curve. The median also wins whenever the market is flat and thick, so it can beat us; the backtest reports when it does.

**What would make it false**, each checked and reported, not assumed:
1. The sale-chance curve is wrong: P30 misses its held-out calibration by more than 5 points. Then X is not reported.
2. The curve mistakes quality for price: sellers who ask more may have better photos or ratings, which would make high asks look like they sell (*inferred*). Fit the curve within product, and with seller feedback and photo count as controls; report X with and without them. If X moves by more than half, say so.
3. A few expensive items carry X: report the median per-listing gain and X per price band beside the total.
4. The interval includes 0: then the sentence is "about as much money as the median, with a range and a 'not sure'", not "more".
5. The 30-day window hides a cost: report 7 and 60 days too. If the sign flips, the window is part of the claim.

## What it does not show, ever

- That **our users** earn more: they choose to use us, and a choice is not an experiment. That needs decision 24's live paired test.
- Anything about offers, bundles or relists inside the window.
- Anything about today's market until the forecast duel resolves; NBER is 2012 to 2013.

## Where each part comes from

| Part | Source | State |
|---|---|---|
| Which side we miss on, dollars left | StockX, `priced_above_the_sale` and `left_on_table_per_sale_dollars` in [experiment.py](../../../jobs/valuation/experiment.py) | *observed*, above |
| How price moves the chance of sale | eBay matched-listings research, to be read through Codex | not read yet |
| X | NBER May 2013, locked | needs the NBER rows |
| X today | the forecast duel | waits on Ben's card |
