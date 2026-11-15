# Does a pre-listing price for a used item beat the eBay sold median? A pre-registered test

Status: draft methods, written 2026-11-15 before any data was collected. **No results yet.** Every number in the results section stays empty until the run. The design and the reason for each choice are in [plan.md](plan.md).

## Abstract

*To be written after the run.* It will state, in this order: how often our price landed within 20% of the sale, against the eBay sold median on the same items; median dollars off; whether our 80% ranges held; how often we declined to price and how wrong the baseline was on those items; whether our odds of selling within 7 and 30 days were calibrated; and what the test does not show.

## 1. Question

A person about to list a used item wants three things: the price it will sell for, how long it will take, and whether to trust the answer. Today they look up recent sold listings on eBay. We test whether our estimate, made the day before listing from only what was known then, is closer to the final sale price than that lookup, whether our stated ranges hold as often as we say, and whether our odds of a sale are calibrated.

## 2. Claims fixed before the run

1. Our middle price is within 20% of the sale more often than the eBay 90-day sold median on the same items (paired; null: lift ≤ 0; by-product bootstrap; Holm across the claims).
2. Our 80% range holds between 75% and 85% of sales overall and in each kind ([money D6](../../determinations/money.md#d6-range-calibration-and-display-state)).
3. On the items we decline to price, the baseline's error is larger than on the items we price.
4. P(sold by 7 and 30 days) is calibrated within 5 points ([D10](../../determinations/money.md#d10-chance-of-sale-within-a-period-at-a-price)).
5. On a kind left out of tuning, claim 1 still holds.

The commit hash of this file before the run is printed in the results.

## 3. Data, and the terms it is used under

- **Forecast duel:** live listings across six kinds, recorded with our estimate and the baseline before the outcome exists, then re-read after 1, 7 and 30 days.
- **Sold rows:** hand-collected sold listings, for research only, once the site terms are read ([plan decision 32](plan.md)). No rows from eBay's API, whose licence bars using its content to model prices.
- **Public benchmark:** the Kaggle Mercari Price Suggestion Challenge data, for the text-only case.
- **Truth:** sold price less buyer shipping; hidden Best Offer prices left out and counted; relists and cross-lists counted once.

## 4. Method

- **No look-ahead:** each estimate uses only rows sold before its freeze date; the harness refuses a run that breaks this ([backtest.py](../../../jobs/valuation/backtest.py)).
- **Time order:** monthly rolling origins with a 7-day gap for tuning; one locked month scored once.
- **Baselines:** the 90-day sold median of the same product, the last sale, seasonal naive, the family median.
- **Measures:** share within 20% and 10%, median % and dollars off, signed bias, share off by more than 30%, range coverage, hit rate, the measured ceiling; for speed, calibration, AUC and Brier score, with unsold listings censored.
- **Intervals:** Wilson for proportions; bootstrap resampling products, not sales.
- **Slices:** kind, price band, condition and site, with "too few" under 30 sales.

## 5. Checks on the test itself

A planted leak is refused. An oracle that reads the true price scores 100%. An oracle using the median of identical same-week sales reproduces the ceiling. Shuffled comps score no better than the baseline.

## 6. Results

*Not run.*

## 7. What this does not show

- That our recommended price earns sellers more money: each sale shows one price only. A paired live test is needed, and a small one is reported as a pilot.
- How we do on items whose identity is unclear, beyond the hard bucket's hit rate.
- Anything about sites or kinds not in the data.

## 8. Reproduce

The command, the data manifest and its hash will be listed here with the results.
