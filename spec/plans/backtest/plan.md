# The backtest: prove the price and speed estimates work, and tune them without overfitting

Status: *agent proposal* for Ben and Nate. Written 2026-11-15. Method: RDD with IAE (find who already solved each part and take the mechanism). Evidence: [what-predicts-price-and-speed.md](../../../research/price/ben/what-predicts-price-and-speed.md) and the pitch thread's [seasons-events-and-a-fair-backtest.md](../../../research/price/ben/seasons-events-and-a-fair-backtest.md), whose changes to D6 and M12 are already on main and are reconciled here, not repeated. Harness: [jobs/valuation/backtest.py](../../../jobs/valuation/backtest.py). Method rules it builds on: [money D6, D10, D11](../../determinations/money.md#d6-range-calibration-and-display-state), [M12](../../determinations/market-insight.md#m12-seasonality), [demand-and-trend §9](../../engines/demand-and-trend.md#9-proof).

## 1. The problem as an expert sees it

Ben's ask ([07:27](../../../product/words.md)): one backtest that proves the system works now and is also the harness we tune on without overfitting, across categories and dimensions, with statistics that show people what they cannot see for themselves.

What a skeptical judge or seller does not know, and the test must answer:

1. Is the number right? Compared with what they would do today, which is the eBay Sold filter.
2. Is the range honest? When we say 8 in 10, does 8 in 10 happen?
3. Does it know when it does not know?
4. Does it work on my stuff, which it was not tuned on?
5. Is the time to sell real?
6. Was the test itself fair, or did the builders grade their own homework?

What makes used-goods pricing hard, and so what the design must handle (*inferred* from the evidence note):

- **Market noise.** Identical items resell about 11% apart in the same month (Einav et al. 2015). No model beats that, so every score needs the ceiling beside it.
- **Identity.** Most error comes from not knowing exactly what the item is. The main test uses products with clear identity so it measures pricing, and a separate hard bucket measures the rest.
- **Thin data.** Many products have few sales. That is why we abstain and pool across products, and the test has to reward abstaining when it was right.
- **Drift.** Prices move with season, hype and fees. Random splits leak the future, so splits follow time.
- **Selection.** We see one price per sale and nothing for the unsold. Unsold listings are censored rows, never dropped, and the money claim needs a live test (decision 24).

## 2. Decisions

Each one names what it beat. Already settled in [D6](../../determinations/money.md#d6-range-calibration-and-display-state) and used as is: rolling origin with a 7-day gap and frozen estimates (step 1), cells of at least 30 (step 2), the truth rule (step 3), the lender report (step 4), censored unsold rows (step 5), three baselines with a skill line each (step 6), sales at our own ask kept out of the headline (step 7), listed-with-us and from-a-photo side by side (step 8), and the frozen run repeated with the calendar off (step 9). The decisions below add to those; where one restates a D6 step it says so.

Who already solved each part (IAE): lenders test valuation models with hit rate and PPE10/PPE20 ([risk-and-reconciliation.md](../../../research/price/ben/risk-and-reconciliation.md)); Zillow publishes on-market and off-market error side by side; the M competitions set the rule that a method must beat simple baselines on rolling origins; Einav et al. used matched listings for causal claims on eBay; conformal prediction gives ranges with a coverage statement ([range-calibration.md](../../../research/price/nate/range-calibration.md)).

### How the data is split

| # | Decision | Beat | Why |
|---|---|---|---|
| 1 | **One harness, two jobs, kept apart by time.** Early windows tune; one locked window at the end proves | Separate tuning and proving code | Same scoring code means the proof is exactly what we tuned against, and the time order means the proof saw nothing during tuning |
| 2 | **Rolling origin, weekly, with a 7-day gap** before each origin (D6) | Random k-fold; one split | Random folds use next month's prices to price this month's item. One split is one week's luck |
| 3 | **A locked final window** (the last 15 of 90 days, or the last month of a longer pull), scored once | Reusing the tuning windows as proof | A window looked at during tuning is no longer a test |
| 4 | **Each estimate frozen as of the day before the item was listed**, from rows sold before that day only | Freezing as of the sale date | The seller needs the price before listing; the sale date leaks the listing period |
| 5 | **One unit per physical item**: relists and cross-lists count once, by cluster | One row per listing | The same item on 3 sites would count 3 times and look 3 times as certain |
| 6 | **Truth is the sold price less buyer shipping.** eBay Best Offer sales with a hidden price are left out and counted | The shown price | eBay shows the ask struck through, not the accepted amount ([sold-price-data.md](../../../research/price/ben/sold-price-data.md)) |

### What it is compared with

| # | Decision | Beat | Why |
|---|---|---|---|
| 7 | **Baselines, each given the same rows and its own best setting:** D6 step 6's three (the eBay-style 90-day sold median of the same product, the last sale, seasonal naive), plus the family 90-day median that backtest.py already scores. Adds: each baseline gets its own best window, tuned on the same tuning origins as ours | A vendor or profit-scanner estimate | A vendor cannot be asked what it would have said on a past date, so it cannot be backtested. It belongs in the live test. An untuned baseline is a rigged comparison (Poteto's [benchmark checklist](../../../.agents/vendor/poteto/skills/benchmark-checklist/SKILL.md), question 2) |
| 8 | **The ceiling, measured from our own rows:** the spread between identical products in the same condition sold in the same week | Quoting the 11% from 2009 eBay | Ours is current and per kind. It turns "73%" into "73% of a possible 90%" |
| 9 | **The seller's own guess** as a baseline, in the hands-on test only ([numbers.md](../../../product/numbers.md)) | Leaving people out | It is the comparison a seller cares about most, but only a live test can collect it |

### What is measured

| # | Decision | Beat | Why |
|---|---|---|---|
| 10 | **Headline: share within 20% of the sale (PPE20), paired against the eBay sold median on the same items,** with the share off by more than 30% beside it | Share within 10%; median % error; mean % error; R² | With 11% market noise a perfect model is within 10% only 63% of the time, so a 10% headline fails a perfect model. Mean % error blows up on cheap items. R² is high for any model that knows a phone costs more than a T-shirt, so it is flattering and empty. PPE20 is the lender standard and plain English |
| 11 | **Two skill lines.** D6's `1 - our median error / baseline median error` per baseline, and a ceiling skill: the share of the PPE20 gap between the best baseline and the measured ceiling that we close | Raw lift only | "+12 points" means little. D6's line says how much less we miss than the seller's alternative; the ceiling line says how close to perfect, which does not depend on how noisy the kind is, so it compares across categories |
| 12 | **Range coverage of the 80% range** per cell, with a Wilson 95% interval, target 75 to 85% (D6) | Width alone | Coverage is the promise; width is shown beside it so a wide, useless range cannot pass |
| 13 | **Hit rate and the value of abstaining:** the share we price, and the baseline's error on the items we declined | Hit rate alone | Abstaining looks like failure unless you show the baseline was badly wrong on those exact items. This is the statistic that shows the system knows when it does not know |
| 14 | **Time to sell:** P(sold by 7 and 30 days) calibrated within 5 points (D10); half of sales inside the t25 to t75 range (D11); Brier score against the Kaplan-Meier baseline. Unsold rows censored | Days-to-sell error on sold items only | Counting only the sold items flatters speed, because the unsold never finish (Opendoor, via [range-calibration.md](../../../research/price/nate/range-calibration.md)) |

### Dimensions and tuning across categories

| # | Decision | Beat | Why |
|---|---|---|---|
| 15 | **One run writes a cube:** kind × price band × condition × site × window × model variant, each cell with n, PPE20, coverage, median error, tail share and hit rate | Separate scripts per question | One run, one set of frozen rows, every slice from the same estimates, so slices cannot disagree because they were run differently |
| 16 | **A cell under 30 sales reports "too few" and its count**, not a number | Showing every cell | A 9-for-10 on 10 sales has a Wilson interval of 60 to 98% |
| 17 | **Primary claims named before the run:** overall, and each of the 6 kinds. Every other cell is exploratory, with Benjamini-Hochberg at 10% | Looking for the best slice afterwards | With 100 cells, 5 will look great by chance |
| 18 | **Global settings first; a kind gets its own setting only if it beats the global one on the tuning windows by more than the paired bootstrap noise, with 300 or more sales** | Tuning each category freely | Free tuning of thin categories fits their noise. This is the demand engine's promotion rule ([§4](../../engines/demand-and-trend.md#4-learning)) |
| 19 | **Few knobs, listed, and the number of settings tried is reported:** comp count, age half-life, match weights, shrinkage, alpha | An open search | Picking the best of many settings flatters the result; the count lets a reader discount it |
| 20 | **The overfit meter:** report the tuning-window score next to the locked-window score | Reporting the locked score alone | A big drop between them is overfitting, shown, not hidden |
| 21 | **Ablations by leave-one-out and add-one**, paired bootstrap on the same items: season, condition adjustment, photo count, photo quality, round-number ask, site, Google Trends | Adding signals one after another | The order of a sequential ladder changes each step's credit. A signal that does not beat noise gets weight 0 |
| 22 | **Leave-one-kind-out:** tune on 5 kinds with global settings, score the 6th | Scoring only kinds we tuned on | This is the "it works on your stuff" claim, the one a downloader cares about |

### Testing the test

| # | Decision | Beat | Why |
|---|---|---|---|
| 23 | **Four planted cases, run before the real one:** a planted leak must be refused (check_leakage already raises); an oracle that reads the true price must hit the ceiling and 100% coverage; a model with shuffled comps must score no better than the baseline; season factors fit on shuffled months must show no gain in the ablation | Trusting a harness never seen to fail | The same idea as the race check's mutant in [bench.mjs](../../../scripts/bench/bench.mjs): a test that cannot fail proves nothing |
| 24 | **The money claim is a live test, not a backtest:** matched listings (the same seller and item, our price against theirs, as Einav et al. did) or the hands-on protocol | Claiming a backtest shows we earn more | A sold row shows one price. The other price's outcome is never seen |
| 25 | **Pre-registered** (D6 step 9, made concrete): this plan, the pass lines (D6's, plus decision 10's lift being above zero with a paired 95% bootstrap interval) and the window dates are committed before the locked window is opened; the commit hash is printed in the result; any change after is logged as a deviation | Deciding what counts after seeing results | The single strongest answer to "did you grade your own homework" |
| 26 | **Every cell is printed, losses included**, and the hard bucket (unbranded, one-off, furniture) is reported for its hit rate | A highlights page | Showing where we lose is what makes the wins believable |

### Season, spikes and interesting outputs

| # | Decision | Beat | Why |
|---|---|---|---|
| 27 | **Season gets its own test on 24 months or more** (Terapeak per kind, FRED as the prior): fit on all but the last year, keep only if it beats a flat forecast on that year; count and price factors separately (M12's check) | Testing season inside 90 days of sold rows | 90 days cannot contain a year's cycle |
| 28 | **An interesting pattern from the cube is a lead, not a claim.** First RDD with IAE: find who already studied it (round-number asks: Backus et al.; photos: Lewis; reputation: Cabral and Hortacsu). Then a quasi-experiment on our rows: a discontinuity at a threshold (asks just under and just over $100, free-shipping lines), an event study around a release or news spike, or matched listings. It counts only if it repeats in the next window | Reporting a pattern found by looking | The cube will throw up chance patterns (decision 17); an outside study plus a repeat is what turns one into a finding |

### Size and data

| # | Decision | Beat | Why |
|---|---|---|---|
| 29 | **200 or more sales per kind in the locked window, 1,200 overall** | A round 100 | At 200, an 80% coverage reads 74 to 85%; a 10-point PPE20 gain over the baseline needs about 155 to 310 paired items (*inferred*, McNemar) |
| 30 | **Six kinds with clear identity plus a hard bucket; eBay sold as the main source, Mercari and Poshmark as second channels; conditions recorded as stated.** Product list, fields and sites: [the note §6](../../../research/price/ben/what-predicts-price-and-speed.md#6-what-to-collect). Not Ben's personal Depop | Scraping everything | Clear identity isolates pricing; the hard bucket shows the rest honestly |

### A public benchmark we can run before collecting anything

| # | Decision | Beat | Why |
|---|---|---|---|
| 31 | **Score our cold case on the Mercari Price Suggestion Challenge data** (Kaggle, 2017-18): "the product data of items sold through our US app" (Mercari engineering blog, 2018-11-14), with name, description, category, brand and condition. Metric RMSLE; the winner scored 0.3875 in cross-validation, 2,384 teams entered (Sijun He, 2018). Report our RMSLE beside the leaderboard, and our PPE20 on the same rows | Waiting for our own rows before showing any number | It already exists (IAE): a public, outside-graded test on real sold Mercari items. It has no dates and no comps, so it tests only the from-a-photo-and-title case (D6 step 8), not the comp engine. Whether the data can still be downloaded, and whether every price is a sold price, is not confirmed (*asserted* from the blog's wording) |

## 3. The statistics that convince

The page a judge sees, in this order. Each has its n and interval.

1. **"7 in 10 of our prices landed within 20% of what the item sold for. The eBay sold median, the number a seller looks up today, got 5 in 10. On the same 1,200 sales."** (Decisions 7, 10; numbers are placeholders until the run.)
2. **"Identical items resell about 11% apart, so a perfect model scores about 9 in 10. We close 60% of the gap."** (8, 11)
3. **"When we said 8 in 10 would land in the range, 79% did."** (12)
4. **"On the items we declined to price, the eBay median was off by more than 30% almost half the time."** (13)
5. **"Kinds it was never tuned on scored within 3 points of the ones it was."** (22)
6. **"Half the items sold inside the time we gave."** (14)
7. **"We wrote the rules down before we looked, scored the final month once, and the test catches a planted cheat."** (23, 25)

## 4. Critique of the coordinator's draft

Kept: rolling time splits, a locked holdout, lift over baselines, PPE10 and PPE20, range coverage, abstention, slices with intervals, ablations, pre-registration, showing losses.

Changed:
- The profit-scanner baseline moves to the live test, because it cannot be asked about a past date (7).
- PPE10 is reported but not the headline, because of the noise ceiling (10).
- "Coverage" meant two things; abstention is now "hit rate", and its value is shown with the baseline's error on declined items (13).
- The sequential ablation ladder becomes leave-one-out and add-one (21).
- Season cannot be a slice of 90 days of sales; it gets its own 2-year test (27).
- Many slices need a primary list and a false-discovery control (17), and per-category tuning needs a promotion rule (18).
- Added: the ceiling (8), the ceiling skill (11), leave-one-kind-out (22), testing the test (23), and the overfit meter (20).

Reconciled with the pitch thread's D6 and M12 changes: their seasonal naive baseline, error-ratio skill, two populations, frozen run and calendar-off run are kept as written. Their dated events (M12) enter this test as one more ablation (21), with event choice refit before each frozen date as their step 9 requires. One difference: their M12 example line is a price claim, and the evidence found so far is for counts, not prices ([what-predicts-price-and-speed.md §8](../../../research/price/ben/what-predicts-price-and-speed.md#8-season-lines-a-person-reads)).

## 5. Build tasks, when Ben says go

| Task | Owns | Proves with |
|---|---|---|
| bt-1 Row loader for the CSV fields in the note §6, with the cluster dedupe and truth rules | `jobs/valuation/rows.py`, test | `python -m pytest jobs/valuation/test_rows.py` |
| bt-2 Estimate freezing over `market.fit` per origin, with the baselines tuned the same way | `jobs/valuation/freeze.py`, test | planted leak refused; oracle hits ceiling |
| bt-3 The cube: PPE20, tail share, skill score, hit rate and abstain value in `_summary`, Benjamini-Hochberg on exploratory cells | `backtest.py`, `test_backtest.py` | `python -m pytest jobs/valuation/test_backtest.py` |
| bt-4 Ablations, leave-one-kind-out and the four planted cases | `jobs/valuation/ablate.py`, test | shuffled comps no better than baseline |
| bt-5 The one command and the one-page result, logged through `log/` | `scripts/bench/backtest.mjs` or `.py` | `node spec/log.mjs` on its log |
