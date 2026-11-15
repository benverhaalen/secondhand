# What each sold dataset can prove about our methods, how to sample it, what it costs, and how the logs make it improve us

Status: *agent proposal* for Ben and Nate. Written 2026-11-15 by the sold-data thread. It sits beside [plan.md](plan.md), which the benchmark thread owns, and does not change its decisions. It says which of them each dataset can test. Data: [sold-datasets.md](../../../research/price/ben/sold-datasets.md). Rows: [jobs/valuation/data/](../../../jobs/valuation/data/README.md).

Ben, 08:19: "ok consider the nber thing too. using those datasets and using an experiment design considering what each have what conclusions about our methodologies would you be able to make. how would you sample. factor in the cost of the backtest. how would use it to maybe improve - think of the logging principles applied to this".

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
| **Kaggle Mercari** (1,481,661 sold, 2017) | H, F and brand across items | "From the title, brand, category and condition alone, we price within X% (RMSLE Y, beside the 2018 winner's 0.3875)." It's the outside-graded number | anything over time (no dates); comps (no product id). A random split leaks near-duplicates: 31% of rows share a normalised title with another row (*observed*, our count) |
| **Grailed 2021** (103,537 sold) | H for apparel, I (photo count, feedback) | exploratory only; `may_model` is false, and how to treat it waits on Ben's card | the same as Mercari, plus the terms problem |
| **2026 small sets** (3,710 rows) | level check | "Today's prices in these keywords sit where the old data's trend would put them, or don't" | anything statistical; scrapes, so `may_model` is false |

Across all five, the backtest **cannot** show that our price earns a seller more money. A sold row shows one price and never the other price's outcome. That is decision 24's live test.

## 3. How to sample

**The unit is a test sale, frozen the day before it was listed. The cluster is the product.** Sales of one product are correlated, so every interval is a bootstrap over products, not rows (decision 7's paired bootstrap already resamples products).

**NBER, two-stage and stratified.**

1. Strata: kind × price band × **thickness**, where thickness is the product's sales in the 90 days before the freeze (0, 1 to 4, 5 to 29, 30 or more). Thickness is the axis on which A, B and D differ, so it must be crossed with everything else, not left to chance.
2. First stage: draw products within each stratum. Second stage: draw at most 10 test sales per product. Hot products would otherwise dominate. With 10 per product and a within-product correlation of 0.1 the design effect is 1.9; with 30 it's 3.9 (*inferred*, 1 + (m - 1)ρ, with ρ a guess to replace with the measured value from the first run).
3. Oversample thin strata (they hold the abstain question), and weight by inverse sampling probability for any population number. Report both weighted and per-stratum results.
4. Keep every unsold listing of a sampled product, for G. Without them the speed test is biased toward the fast sellers.
5. Time: weekly rolling origins over May 2012 to April 2013 for tuning, and May 2013 as the locked window, scored once (decisions 2 and 3). Leave-one-kind-out (decision 22) is a second, independent holdout. If we have to look at the locked month twice, a kind we never tuned on is still fresh.

**How many.** For the paired PPE20 comparison against the product median, a McNemar test at 5% and 80% power needs n ≈ 7.85 × p_disagree / Δ² pairs (*inferred*, the standard approximation). With 30% of pairs disagreeing:

| Lift to detect | Pairs per kind | × design effect 1.9 |
|---|---|---|
| 10 points | 236 | 450 |
| 5 points | 942 | 1,790 |
| 3 points | 2,617 | 4,970 |

So **2,000 test sales per kind in the tuning windows and 1,200 per kind in the locked month**. In the locked month that detects about 6 points per kind and about 2 points pooled over 8 kinds (9,600 sales). Altogether that's about 26,000 test sales drawn from roughly 5 to 10M history rows (*inferred*: the sampled products' histories): a sample, not the 98M.

**StockX:** all of it (it's small). Tune on Sept 2017 to Oct 2018, lock Dec 2018 to Feb 13, 2019, and skip Nov 2018 as a gap. Two models are 50% of the sales, so also report per model.

**Mercari:** split by group, not by row. Group rows by normalised title and brand, put whole groups in train or test, and stratify the 10% test split by kind. A random row split would put the same listing on both sides.

## 4. What it costs

| Cost | Size | How to keep it down |
|---|---|---|
| Compute, the runner as it is | *Observed*: the full StockX run from 2018-11-01 (about 41k test sales × 4 contestants) ran past 23 CPU minutes without finishing. The baselines rescan the whole history for every test sale, so cost grows with tests × history | Index the history by product once and bisect by date. The baselines then cost a lookup per test sale, which the benchmark thread did: the full StockX run (41,988 test sales) now takes about 4 minutes (*observed*, plan.md §9). The model refits once per month, which is already cheap |
| Compute, NBER | The load and sample run in Spark on Nate's workspace. The runner then sees about 26k test sales and their products' histories: single-node work after the indexing fix | Sample in Spark, never ship 98M rows to Python |
| Money | The four current contestants make no model calls, so a run costs only compute. A contestant that calls a model (pricing from a photo or a title through an LLM) costs calls × price: 2,000 items is 2,000 calls per run per setting | Run a paid contestant only on the locked sample and a fixed tuning subsample, and cache its answers by (item, as_of, prompt hash), so a rerun costs nothing |
| People | Nate: about an hour to pull NBER. Ben: a minute to read the Kaggle rules | |
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

## 6. Order of work

1. Done: the runner indexes history by product, and the full StockX run is in plan.md §9. The last sale was within 20% 97% of the time, the 90-day median 89%, and `market.py` 68%, because it ignores product identity. That's the first finding: when the product is known, comps must outrank the attribute model (A over B), so the model needs a product-level term or a blend with comps before NBER.
2. Nate pulls NBER (packet 64). Then: the thickness strata, the two-stage sample, the four planted cases, and the tuning windows only.
3. The Mercari grouped split and the from-a-title contestant.
4. Pre-register (decision 25) and score the NBER locked month once. Then leave-one-kind-out.
