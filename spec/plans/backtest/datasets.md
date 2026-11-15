# What each sold dataset can prove about our methods, how to sample it, what it costs, and how the logs make it improve us

Status: *agent proposal* for Ben and Nate. Written 2026-11-15 by the sold-data thread. It sits beside [plan.md](plan.md), which the benchmark thread owns, and does not change its decisions. It says which of them each dataset can test. Data: [sold-datasets.md](../../../research/price/ben/sold-datasets.md). Rows: [jobs/valuation/data/](../../../jobs/valuation/data/README.md).

Ben, 08:19: "ok consider the nber thing too. using those datasets and using an experiment design considering what each have what conclusions about our methodologies would you be able to make. how would you sample. factor in the cost of the backtest. how would use it to maybe improve - think of the logging principles applied to this".

## 0. Each dataset's role, and when a fix found on it counts

Ben, 08:49: "you can selectively remove a bug. just ensure the same system generalizes." His project-evidence skill gives the rules this follows: "Do not modify evaluation criteria to flatter results. Correct grader defects transparently and rerun comparable baselines", and "Preserve failures, retries, interventions, exclusions, and rejected experiments."

| Role | What it means | Dataset |
|---|---|---|
| **Development** | Looked at as much as we like. A bug found here may be fixed | StockX Nov 2018 to Feb 2019 (the bug was found there); NBER May 2012 to March 2013; the 2026 CC0 and CC BY sets as level checks |
| **Confirmation** | Never looked at while building. Scored once, after the code is frozen, and logged in the run ledger | StockX March to October 2018 (done: the fix held, +7.0 points against +8.3 on the development months, [claims.md](claims.md)); the NBER May 2013 locked month; two NBER kinds left out of all tuning |
| **Graded by the future** | Our number is committed before the outcome exists, so nothing can leak | the forecast duel on live listings |
| **Outside benchmark** | A public set with a public leaderboard, so our number sits beside other people's | Kaggle Mercari, for the from-a-title test (H). Ben chose it for the demo at 09:09, knowing Kaggle's rules say competition use only |
| **Exploratory** | Shown as labelled side cells, never in a fit or a headline | Grailed and the other scrapes, depending on Ben's answer |

A fix found on a development set counts when four things hold:
1. It is one mechanism with no branch for a dataset or kind.
2. Every baseline reruns on the same rows.
3. The result from before the fix is kept beside the new one.
4. It holds on a confirmation set it never saw.

The StockX identity fix passed all four on time. It hasn't passed across markets yet. NBER is the test of that.

## 1. The methods under test

Nine things we claim, each a separate question. A dataset can answer a question only if it has the column the question turns on.

| # | Method | What it claims | The column it needs |
|---|---|---|---|
| A | Comp pricing (the product's recent sold median, adjusted comps) | knowing the exact product prices it | product id, sale date |
| B | Hedonic model (`market.py`) | attributes and a trend price an item when comps are thin | attributes, date |
| C | Range calibration (conformal, per kind) | "8 in 10 land in the range" holds | many dated sales per kind |
| D | Abstaining (`too_few`, `too_wide`) | holding back is earned | thin and thick products side by side |
| E | Time adjustment (trend, release decay, M16) | moving a comp to today helps | dates over months, release dates |
| F | Condition premiums | the condition step is the right size | condition within one product |
| G | Speed: P(sold by 7 and 30 days), and price against speed (the slider) | listing lower sells faster by a predictable amount | listed date, end date, **unsold listings** |
| H | Pricing from a title alone (the cold case) | a title and photos price an unknown item | title, description, brand |
| I | Listing signals (photos, feedback, round asks, Best Offer) | these move price or speed | photo count, feedback, ask, accepted offer |

## 2. What each dataset can prove, and what it cannot

| Dataset | Can test | Strongest conclusion it allows | Cannot test, and why |
|---|---|---|---|
| **NBER eBay** (98M listings, 2012-05 to 2013-06, sold and unsold) | A, B, C, D, F, G, I, and leave-one-kind-out | "On used goods across eBay's categories, our price beat the 90-day sold median on the same items, the range held, and abstaining was earned." It's also our only test of speed and of the slider, because it keeps the unsold listings and both dates | today's price levels (13 years old); seasons (13 months is under the 24 that decision 27 needs); anything visual (titles and photos are anonymised); Depop and Poshmark behaviour. Selection: every row was a Best Offer listing |
| **StockX 2019** (99,956 sales, 2017-09 to 2019-02) | A, C, E, and the size premium in B | "Under fast drift (hype fading after release), moving comps to today beats a stale median, and the range still holds." Its sampling is a fixed random share per colorway per day (StockX's note), so its volumes are unbiased over time | condition (all new); identity (sku given); abstaining (dense); speed (no listings). It's easy mode: identical pairs sold a median 1.7% apart in the same week, so every method looks good. It's the noise floor, never the headline |
| **Kaggle Mercari** (1,481,661 sold, 2017) | H, F and brand across items | "From the title, brand, category and condition alone, we price within X% (RMSLE Y, beside the 2018 winner's 0.3875)." Used on Ben's call; Kaggle's rules say competition use only | anything over time (no dates); comps (no product id) |
| **Grailed 2021** (103,537 sold) | H for apparel, I (photo count, feedback) | exploratory only; `may_model` is false, and how to treat it waits on Ben's card | the same as Mercari, plus the terms problem |
| **2026 small sets** (3,710 rows) | level check | "Today's prices in these keywords sit where the old data's trend would put them, or don't" | anything statistical; scrapes, so `may_model` is false |

Across all five, the backtest **cannot** show that our price earns a seller more money. A sold row shows one price and never the other price's outcome. That is decision 24's live test.

## 3. How to sample

Ben, 09:09: "make whatever numbers you come up with have a reason. a specific reason why you chose those bounds. dont run backtests anymore but just plan out how you would do them exactly and get everything set up for now. wait until the whole backend is all setup." So nothing below is run yet. Each number has its reason in the last column, and a number that is a guess says what replaces it.

**The unit is a test sale, frozen the day before it was listed. The cluster is the product.** Sales of one product share its errors, so every interval is a bootstrap over products, not rows (decision 7's paired bootstrap already resamples products).

### NBER: a fixed-share product sample, then strata

| Step | Number | Reason |
|---|---|---|
| Keep a share of products, with all their listings | **5%** of products, by `sha256(product_id)` (`freeze.py --share=0.05`) | Whole histories are kept, so comps and speed work unchanged, and the same share always picks the same products. 5% of 98M is about 5M listings: about 1 GB of rows, which fits one machine. The locked month then holds about 377k sampled listings (98M ÷ 13 months × 5%). A kind with 3% of them and 40% selling has about 4,500 sales, over 3 times the 1,200 needed below. The 3% and 40% are guesses; the manifest's `by_kind` replaces them. If any kind falls under 1,200 locked sales, rerun at 10% and log it as a deviation |
| Strata: thickness | **0, 1 to 4, 5 to 29, 30 or more** of the product's sales in the 90 days before the freeze | Each bound is where our code changes behaviour. 0: no anchor, so the attribute model prices alone. 1 to 4: an anchor shorter than `ANCHOR_K` = 5, and below Level 1's `EXACT_L1` = 5. 5 to 29: a full anchor, but under decision 16's 30. 30 or more: reportable as its own cell. A random draw would bury the thin strata, which hold the abstain question (D) |
| Strata: price | the runner's bands: **under $25, $25 to $100, $100 to $500, over $500** | The same bands `backtest.py` slices by, so a stratum and a reported cell are the same thing |
| Strata: kind | the plan's **6 kinds plus the hard bucket** = 7 | Decision 30 |
| Test sales per product | **at most 10** | Clustering costs a design effect of 1 + (m − 1)ρ. Capping m at 10 keeps it under 2 for any within-product correlation ρ up to 0.11, so clustering never costs more than doubling the sample. ρ is not measured yet. The first tuning run measures it, and if it's above 0.11 the cap becomes 1 + 1/ρ |
| Unsold listings | **all of them**, for sampled products | Speed (G) is biased toward fast sellers without them (D10) |
| Weights | inverse sampling probability | Oversampled thin strata must not inflate a population number. Report weighted and per stratum |

**Time.** Tune on weekly rolling origins from May 2012 to April 2013, with decision 2's 7-day gap, and lock **May 2013**: the last full month, since the data ends June 1, 2013 (decision 3: "the last month of a longer pull"). Decision 22's leave-one-kind-out runs on the tuning months, with global settings fitted on the other 6 kinds.

**How many.** The paired comparison against the product median is a McNemar test. At 5% two-sided and 80% power it needs n ≈ 7.85 × p_d / Δ² pairs, where p_d is the share of pairs on which the two methods disagree (the standard approximation, *inferred*).

| Number | Value | Reason |
|---|---|---|
| α, power | 5%, 80% | Decision 25's pass line is a 95% interval; 80% is the convention a reviewer expects, and anything lower would be the first thing questioned |
| p_d | **0.30** | No NBER run exists yet. If both methods are within 20% about 60% of the time on used goods, and their hits correlate at 0.4, they disagree on 1.2 − 2(0.36 + 0.4 × 0.24) = 0.29 of pairs. On StockX, where both sit near the ceiling, p_d is at least the 8.3-point gap, and lower than on used goods. The first tuning run replaces it |
| Effect the locked month must detect | **7 points** | The fix's measured lift on StockX months nobody looked at was +7.0 points (claims.md). A confirmation test should be able to see that effect again on used goods |
| Locked test sales per kind | **1,200** | 7.85 × 0.30 × 1.9 ÷ 0.07² = 913 pairs. Divided by 0.93, because the model priced 93% of items on StockX's unseen months and only both-priced pairs count, that's 982. 1,200 leaves room for p_d up to 0.37 |
| Tuning test sales per kind | **2,000** | Tuning compares settings that differ by less, about 5 points: 7.85 × 0.30 × 1.9 ÷ 0.05² = 1,790, rounded up |
| Pooled | 7 × 1,200 = 8,400 locked | Detects about 2 points overall: √(7.85 × 0.30 × 1.9 ÷ 8,400) ≈ 0.023 |

### StockX: done, as a development and confirmation pair

The benchmark thread split it by when it was looked at, not by a rule set beforehand. The months that exposed the bug (Nov 2018 to Feb 2019) are development. March to October 2018, never examined while building, are confirmation. The fix held there (claims.md). Two models make up 50% of sales, so results are also reported per model.

### Mercari (Kaggle): the from-a-title benchmark, on Ben's call

Ben, 09:09: "so there is no public way to access mercari data? if its there lets use it its for a hackathon demo". It is public, in three GitHub mirrors of Kaggle's original file. Kaggle's rules say "only for the purposes of the Competition", and `rows.py` records both facts in the licence column.

| Step | Number | Reason |
|---|---|---|
| Split | grouped by normalised title + brand, **90 / 10** | 31% of rows share a normalised title with another row, so a row split puts the same listing on both sides. With 10%, every kind with 12,000 or more rows gets 1,200 or more test items, the same per-kind size as NBER's locked month. Smaller kinds are reported with their n under decision 16 |
| Metric | RMSLE, and within 20% | RMSLE is the leaderboard's metric, so it sits beside the winner's 0.3875. Within 20% is our headline metric, so it matches every other page |
| Caveat that must travel with the number | "Kaggle's 2017 Mercari data; the 0.3875 was cross-validation on a different test set" | Our split isn't Kaggle's private test set, so the number is beside the leaderboard, not on it |

## 4. What it costs

| Cost | Size | How to keep it down |
|---|---|---|
| Compute, the runner as it is | *Observed*: the full StockX run from 2018-11-01 (about 41k test sales × 4 contestants) ran past 23 CPU minutes without finishing. The baselines rescan the whole history for every test sale, so cost grows with tests × history | Index the history by product once and bisect by date. The baselines then cost a lookup per test sale, which the benchmark thread did: the full StockX run (41,988 test sales) now takes about 4 minutes (*observed*, plan.md §9). The model refits once per month, which is already cheap |
| Compute, NBER | The load and sample run in Spark on Nate's workspace. The runner then sees about 26k test sales and their products' histories: single-node work after the indexing fix | Sample in Spark, never ship 98M rows to Python |
| Money | The four current contestants make no model calls, so a run costs only compute. A contestant that calls a model (pricing from a photo or a title through an LLM) costs calls × price: 2,000 items is 2,000 calls per run per setting | Run a paid contestant only on the locked sample and a fixed tuning subsample, and cache its answers by (item, as_of, prompt hash), so a rerun costs nothing |
| People | Nate: about an hour to pull NBER (*asserted*: a 4.45 GB download and a Spark load) | |
| **The locked window** | It is spent the first time it's scored, and every setting tried on the tuning windows discounts the result (decision 19) | Log every look and every setting. Keep leave-one-kind-out as a second unspent test |

## 5. How it makes us better: the logging rules applied to the backtest

The repo's logging rule ([log/README.md](../../../log/README.md)) is that from the log alone you could replay what the person saw. Applied here, **from the log alone you could replay every estimate and every score.**

1. **Every estimate is a logged event, not a row in a results file.** For each (test sale, contestant): the item's row id, `as_of`, the freeze basis, the data manifest's sha256, the code commit, the contestant's settings and seed, q10/q50/q90, shown or abstained and why, and the comp ids it used. Scores are then a pure function of the log. A new metric next week reruns over the log, not the model.
2. **Every run writes one ledger line:** the run id, the windows touched, whether the locked window was opened, how many settings have been tried so far, and the result's hash. The runner refuses to score the locked window twice unless the second run is logged as a deviation. That makes "did you grade your own homework" a query.
3. **The error log is the to-do list.** Join each estimate to its row, then rank slices by total error (kind × thickness × condition × price band). The biggest slice is the next hypothesis. Change one setting, rerun on the tuning windows only, and keep it only if the paired bootstrap beats noise. That's the [hillclimb](../../../.agents/skills/hillclimb/SKILL.md) loop with this log as its harness, and decision 18's rule for a kind getting its own setting.
4. **Comp ids make the comps learnable.** Because each estimate logs which sales it used, dropping one comp at a time shows which comps hurt. Old, other-condition and lot comps then get their match weights from data instead of guesses (`SIMILAR`, `EXACT_L1` and the age half-life are marked guesses in `market.py`).
5. **Misses feed calibration.** Logged misses per kind are exactly the scores split-conformal needs. The range widening that the backtest measures is the widening the product applies (C), so it's tested and used in one step.
6. **Cost is logged beside accuracy.** Wall time and rows scanned per contestant per month go into the same log, so `node log/climb.mjs` ranks the slowest step. The first entry it would rank is the baseline rescan above.
7. **One scorer for the past and the present.** The forecast duel and live production estimates log in this same shape. A backtest on 2013 eBay and a duel on tonight's listings are then scored by the same code, and the gap between them measures how far the old data transfers. Our own users' sales, logged this way from the first one, become the next backtest's data.
8. **Planted cases are logged runs too** (decision 23): the leak that must be refused, the oracle that must hit the ceiling, and the shuffled comps that must lose. A harness change that stops them failing shows up as a changed result hash.

## 6. Order of work, once the backend is set up

Nothing runs until Ben says the backend is ready (09:09).

1. Done: the identity fix, found on StockX's development months and confirmed on its unseen months (claims.md).
2. Nate pulls NBER (packet 64) and freezes it with `--share=0.05`. Check the manifest's `by_kind` against the 1,200 locked sales per kind.
3. Pre-register before any NBER estimate (decision 25): commit this section, the seeds and the window dates, so the ledger can show the commit came first.
4. NBER tuning months: the four planted cases first, then measure ρ and p_d and correct the cap and sizes above if they differ, logged. Then the tuning runs and leave-one-kind-out.
5. Mercari: the grouped split and a from-a-title contestant, scored once on the 10%.
6. Score the NBER locked month once.
