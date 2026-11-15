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
| 2 | **Rolling origin by month with a 7-day gap, every month reported, as D6 steps 1 and 9 say.** Inside the tuning window only, weekly origins may be used to have more of them (*proposed D6 addition*) | Random k-fold; one split | Random folds use next month's prices to price this month's item. One split is one month's luck |
| 3 | **A locked final month**, scored once. Tuning and the conformal calibration use only rows before the lock date | Reusing the tuning windows as proof | A window looked at during tuning is no longer a test |
| 4 | **Each estimate frozen as of the day before the item was listed** (D6 step 1). For a locked item listed before the lock date, the freeze is the lock date, so its settings, calibration and comps all predate it | Freezing as of the sale date; freezing a locked item at its own listing date | The seller needs the price before listing. Freezing a locked item listed earlier at its listing date would hand it settings tuned on sales after that date (found in review) |
| 5 | **One unit per physical item**: relists and cross-lists count once, by cluster | One row per listing | The same item on 3 sites would count 3 times and look 3 times as certain |
| 6 | **Truth is the sold price less buyer shipping** (D6 step 3). eBay Best Offer sales with a hidden price are left out and counted | The shown price | eBay shows the ask struck through, not the accepted amount ([sold-price-data.md](../../../research/price/ben/sold-price-data.md)) |

### What it is compared with

| # | Decision | Beat | Why |
|---|---|---|---|
| 7 | **Baselines as D6 step 6 fixes them** (the 90-day sold median of the same product, the last sale, seasonal naive), plus the family 90-day median backtest.py already scores. The pass rule is against the best baseline per cell (D6). A sensitivity line also gives the eBay median its best window, tuned on the same origins as ours | A vendor or profit-scanner estimate; a baseline tuned as the headline | A vendor cannot be asked what it would have said on a past date, so it belongs in the live test. The 90-day median is what a seller actually looks up, so it stays fixed; the tuned variant answers the [benchmark checklist](../../../.agents/vendor/poteto/skills/benchmark-checklist/SKILL.md)'s "was it tuned?" without changing what the headline compares with |
| 8 | **The ceiling, measured on the same test sales:** each sale's distance from the leave-one-out median of the same product, condition and week, scored as PPE20, with a bootstrap interval | Quoting the 11% from 2009 eBay | Ours is current and per kind. It turns "70%" into "70% of a possible 90%". Leave-one-out against a median, not pairwise differences, which would inflate the spread by about √2 |
| 9 | **The seller's own guess** as a baseline, in the hands-on test only ([numbers.md](../../../product/numbers.md)) | Leaving people out | It is the comparison a seller cares about most, but only a live test can collect it |

### What is measured

| # | Decision | Beat | Why |
|---|---|---|---|
| 10 | **Headline: share within 20% of the sale (PPE20), paired against the eBay sold median on the same items** (the comparison a seller understands; the pass rule still uses the best baseline per cell, D6), with the share off by more than 30% beside it | Share within 10%; median % error; mean % error; R² | With 11% market noise a perfect model is within 10% only 63% of the time, so a 10% headline fails a perfect model. Mean % error blows up on cheap items. R² is high for any model that knows a phone costs more than a T-shirt, so it is flattering and empty. PPE20 is the lender standard and plain English |
| 11 | **Two skill lines.** D6's `1 - our median error / baseline median error` per baseline, and a ceiling skill: the share of the PPE20 gap between the best baseline and the measured ceiling that we close, with a bootstrap interval, shown only when that gap is 10 points or more | Raw lift only | "+12 points" means little. D6's line says how much less we miss than the seller's alternative; the ceiling line says how close to perfect. With a small gap the ratio is unstable, so it is not shown then |
| 12 | **Range coverage of the 80% range** per cell, with a Wilson 95% interval, target 75 to 85% (D6) | Width alone | Coverage is the promise; width is shown beside it so a wide, useless range cannot pass |
| 13 | **Hit rate and the value of abstaining:** the share we price, and the baseline's error on the items we declined | Hit rate alone | Abstaining looks like failure unless you show the baseline was badly wrong on those exact items. This is the statistic that shows the system knows when it does not know |
| 14 | **Time to sell, on all listings, sold or not:** P(sold by 7, 30 and 90 days) calibrated within 5 points and AUC 0.6 or more at one week (D10); the share of listings that sold between t25 and t75 is 40 to 60% over 100 listings (D11); Brier score against the Kaplan-Meier baseline. Listings still live are censored rows; items are followed for 90 days after the window, so speed results come later than price results; rows with no listing date are left out and counted | Days-to-sell error on sold items only | Counting only the sold items flatters speed, because the unsold never finish (Opendoor, via [range-calibration.md](../../../research/price/nate/range-calibration.md)) |

### Dimensions and tuning across categories

| # | Decision | Beat | Why |
|---|---|---|---|
| 15 | **One run writes a cube:** kind × price band × condition × site × window × model variant, each cell with n, PPE20, coverage, median error, tail share and hit rate | Separate scripts per question | One run, one set of frozen rows, every slice from the same estimates, so slices cannot disagree because they were run differently |
| 16 | **A cell under 30 sales reports "too few" and its count**, not a number. **Intervals are by product, not by sale:** the bootstrap resamples products, because sales of one product share comps and are not independent | Showing every cell; item-level intervals | A 9-for-10 on 10 sales has a Wilson interval of 60 to 98%. Item-level intervals would be too narrow when a kind has few products (found in review) |
| 17 | **Primary claims named before the run:** overall, each of the 6 kinds, and D6's family × price-band cells, which carry D6's pass rule. The null for a lift claim is "paired PPE20 lift ≤ 0"; the 7 headline claims use Holm. Condition, site and other slices are exploratory, with Benjamini-Hochberg at 10% over cells that do not overlap | Looking for the best slice afterwards | With 100 cells, 5 will look great by chance |
| 18 | **Global settings first; a kind gets its own setting only if it beats the global one on the tuning windows by more than the paired bootstrap noise, with 300 or more sales** | Tuning each category freely | Free tuning of thin categories fits their noise. This is the demand engine's promotion rule ([§4](../../engines/demand-and-trend.md#4-learning)) |
| 19 | **Few knobs, listed, and the number of settings tried is reported:** comp count, age half-life, match weights, shrinkage, alpha | An open search | Picking the best of many settings flatters the result; the count lets a reader discount it |
| 20 | **The overfit meter:** report the tuning-window score next to the locked-window score | Reporting the locked score alone | A big drop between them is overfitting, shown, not hidden |
| 21 | **Ablations by leave-one-out and add-one**, paired bootstrap on the same items: season, condition adjustment, photo count, photo quality, round-number ask, site, Google Trends | Adding signals one after another | The order of a sequential ladder changes each step's credit. A signal that does not beat noise gets weight 0 |
| 22 | **Leave-one-kind-out:** retune the global settings on 5 kinds, then score the 6th; report the difference from the in-sample score with its interval | Scoring only kinds we tuned on | This is the "it works on your stuff" claim, the one a downloader cares about. The held-out kind still has clear identity, so it says nothing about the hard bucket |

### Testing the test

| # | Decision | Beat | Why |
|---|---|---|---|
| 23 | **Four planted cases, run before the real one:** a planted leak must be refused (check_leakage already raises); an oracle that reads the true price must score 100% PPE20 and 100% coverage; an oracle that uses the median of same-week identical sales must reproduce the ceiling; a model with shuffled comps must score no better than the baseline; season factors fit on shuffled months must show no gain in the ablation | Trusting a harness never seen to fail | The same idea as the race check's mutant in [bench.mjs](../../../scripts/bench/bench.mjs): a test that cannot fail proves nothing |
| 24 | **The money claim is a live test, not a backtest:** matched listings (the same seller and item, our price against theirs, as Einav et al. did) or the hands-on protocol | Claiming a backtest shows we earn more | A sold row shows one price. The other price's outcome is never seen |
| 25 | **Pre-registered** (D6 step 9, made concrete): this plan, the pass lines (D6's, plus decision 10's lift being above zero with a by-product paired 95% bootstrap interval, plus decision 32's change if Ben takes it) and the window dates are committed before the locked window is opened; the commit hash is printed in the result; any change after is logged as a deviation | Deciding what counts after seeing results | The single strongest answer to "did you grade your own homework" |
| 26 | **Every cell is printed, losses included**, and the hard bucket (unbranded, one-off, furniture) is reported for its hit rate | A highlights page | Showing where we lose is what makes the wins believable |

### Season, spikes and interesting outputs

| # | Decision | Beat | Why |
|---|---|---|---|
| 27 | **Season gets its own test on 24 months or more**, from M12's sources (Keepa used price and Google Trends now, our own rows later); adding Terapeak and the Census used-merchandise series as sources is a *proposed M12 change*. Fit on all but the last year, keep only if it beats a flat forecast on that year; count and price factors separately (M12's check). Inside the cube, the season ablation uses factors refit as of each frozen date; the dated-event ablation waits for 24 months of our own data (M12) | Testing season from 90 days of sold rows | 90 days cannot contain a year's cycle, and factors fit on the whole history leak the answer |
| 28 | **An interesting pattern from the cube is a lead, not a claim.** First RDD with IAE: find who already studied it (round-number asks: Backus et al.; photos: Lewis; reputation: Cabral and Hortacsu). Then a quasi-experiment on our rows: a discontinuity at a threshold (asks just under and just over $100, free-shipping lines), an event study around a release or news spike, or matched listings. It counts only if it repeats in the next window | Reporting a pattern found by looking | The cube will throw up chance patterns (decision 17); an outside study plus a repeat is what turns one into a finding |

### Size and data

| # | Decision | Beat | Why |
|---|---|---|---|
| 29 | **200 or more sales per kind in the locked month, from 20 or more products per kind; 1,200 overall** | A round 100; a few products per kind | At 200 independent sales, an 80% coverage reads 74 to 85%, and a 10-point PPE20 gain needs about 155 to 310 paired items (*inferred*, McNemar). Sales of one product are correlated, so the effective n is lower and the number of products matters as much as the number of sales |
| 30 | **Six kinds with clear identity plus a hard bucket; eBay sold as the main source, Mercari and Poshmark as second channels; conditions recorded as stated.** Product list, fields and sites: [the note §6](../../../research/price/ben/what-predicts-price-and-speed.md#6-what-to-collect). Not Ben's personal Depop | Scraping everything | Clear identity isolates pricing; the hard bucket shows the rest honestly |

### Where the rows come from

| # | Decision | Beat | Why |
|---|---|---|---|
| 32 | **The source of every row, and the terms over it, are stated in the result.** Rows from eBay's API fall under its licence, which bars using eBay content "to suggest or model prices for items listed on eBay Sites" (§9 item 6, *observed* in [comps-sources-live.md](../../../research/price/ben/comps-sources-live.md)), so API rows are not used to fit or score our prices. eBay sold search now needs a login; signed-in or scraped rows fall under eBay's User Agreement, which nobody has read yet. Mercari's and Poshmark's terms and the Kaggle data's competition rules are unread too. **Until someone reads them, the backtest uses: our own people's sales (with consent), and hand-collected rows for research only, kept out of the product.** A decision for Ben | Pulling rows from whatever is reachable | A credible test cannot rest on data we may not be allowed to use; the pitch thread raised it |

### A public benchmark we can run before collecting anything

| # | Decision | Beat | Why |
|---|---|---|---|
| 31 | **Score our cold case on the Mercari Price Suggestion Challenge data** (Kaggle, 2017-18): "the product data of items sold through our US app" (Mercari engineering blog, 2018-11-14), with name, description, category, brand and condition. Metric RMSLE; the first-place kernel is listed at 0.3875 (its link text says CV), 2,384 teams entered (Sijun He, 2018). Random split, text only, no photos. Report our RMSLE beside the leaderboard, and our PPE20 on the same rows | Waiting for our own rows before showing any number | It already exists (IAE): a public, outside-graded test on real sold Mercari items. It has no dates and no comps, so it tests only the from-a-photo-and-title case (D6 step 8), not the comp engine. Whether the data can still be downloaded, and whether every price is a sold price, is not confirmed (*asserted* from the blog's wording) |

## 3. The statistics that convince

The page a judge sees, in this order. Each has its n and interval.

1. **"7 in 10 of our prices landed within 20% of what the item sold for. The eBay sold median, the number a seller looks up today, got 5 in 10. On the same 1,200 sales."** (Decisions 7, 10; every number in this list is a placeholder until the run.)
2. **"Identical items resell about 11% apart, so a perfect model scores about 9 in 10. We close half the gap."** (8, 11)
3. **"When we said 8 in 10 would land in the range, 79% did."** (12)
4. **"On the items we declined to price, the eBay median was off by more than 30% almost half the time."** (13)
5. **"Kinds it was never tuned on scored about as well as the ones it was"**, with the difference and its interval. (22)
6. **"Half the listings sold inside the time we gave"**, counting the unsold. (14)
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

## 5. The runner, built

[jobs/valuation/experiment.py](../../../jobs/valuation/experiment.py), tested by `python3 -m pytest jobs/valuation/test_experiment.py` (run from the repo root or `jobs/`).

| Command | Does |
|---|---|
| `python3 scripts/bench/backtest.py self-test` | Decision 23 on the synthetic market: the oracle scores 100%, random comps lose to the product median, a planted leak is refused. Exit code 1 if any fails |
| `python3 scripts/bench/backtest.py backtest --rows R --test-from D --out O` | Freezes every contestant per test sale (the day before listing, or before the sale when no listing date, counted), refits per month with the 7-day gap, and writes the report: closeness three ways, bias, tail, coverage with Wilson, hit rate, the baseline on items we declined, the paired within-20% lift with a by-product interval, slices by kind, condition, site and price band, the ceiling, and the pre-written sentence |
| `python3 scripts/bench/backtest.py duel-record --live L --rows R --out duel.json` | Freezes every contestant's answer for live listings, with a sha256 of the file |
| `python3 scripts/bench/backtest.py duel-score --duel duel.json --outcomes O` | Scores only sales dated after the record; counts refused, ended and still live |

Rows follow `FIELDS` in the runner (the schema sent to the sold-data thread). Contestants today: the 90-day product median (primary), the last sale, the Python market model, and the two controls. The real engine plugs in as one more class with `fit` and `predict`.

Not built yet: the family median and seasonal naive baselines, leave-one-kind-out, ablation switches, Holm and Benjamini-Hochberg, speed odds in the duel, and a loader for the Kaggle text-only test.

A fresh review of the runner (2026-11-15) found it trained on rows whose terms bar modelling, skipped the relist and our-ask leakage routes, miscounted duel states, printed numbers for cells under 30, ignored hidden Best Offer sales, had no locked-window freeze, did not check the duel's hash, and had six behaviours its tests would not catch. All fixed: `may_model` filters every fit and history, `cluster_id` keeps relists out of an item's comps, sales at our ask and hidden Best Offers are left out and counted, `--test-to` and the clamp to `--test-from` give the tuning runs and the locked month, the duel stores each listing's inputs and refuses a changed file, and each of the six was broken on purpose and now fails a test. Still guesses: `MIN_PEERS` 3, 1,000 bootstrap draws, 5 random comps.

## 6. Fresh review, 2026-11-15

A reviewer that had not written the plan checked it against D6, D10, D11, M12, backtest.py and the notes. Fixed from its findings: the locked window's freeze date (4), censored live listings and the follow-up for speed (14), by-product intervals and products per kind (16, 29), D11's all-listings share (14), the four D6 conflicts (2, 7, 10, 17), the oracle cases (23), season refit per frozen date and M12's sources (27), retuning for leave-one-kind-out (22), the null and Holm (17), the ceiling's definition and its gap rule (8, 11), the Kaggle wording (31), D10's AUC and 90-day horizon (14), and the new-goods series no longer called a prior.

**Proposed D6 change, not applied** (for Ben or Nate): D6's pass rule fails a range that truly covers 80% too often. At n = 200 a cell lands outside 75 to 85% about 6% of the time by chance, and one of overall plus 6 kinds about 37% of the time; at n = 30, about half the time. Likewise "Checked" (Wilson lower bound 70% or more) needs about 77 sales at a true 80% (reviewer's exact binomial arithmetic). Proposal: a cell fails only when its Wilson interval lies wholly outside 75 to 85%, and the report states the chance of a false fail.

## 7. Every outcome a seller cares about, and the cheapest test for each

Ben, 07:38: "wouldn't we want as close as possible? also pricing below vs above ... time, money, speed ... how do you design an experiment to test all of those ... digestable ... a link to a more in depth explanation ... compare to competitors ... not need to solve a crazy problem to get the data ... probabilities and those more data science or cs type numbers however also get numbers anyone could do".

### As close as possible, and which side we miss on

- **Closeness is shown three ways on every page:** median % off, median dollars off ("about $5 on a $60 item"), and the share within 20%. Within 20% says *how often* we are close, median error says *how close*, and the ceiling says how close anyone can get. Each answers a different doubt, so all three are shown.
- **Which side we miss on is reported, because the two misses cost different things.** Pricing too low loses money; pricing too high loses time, and sometimes the sale. So every page also shows the signed median error (bias) and the share of sales above and below our middle price.
- **The value estimate and the listing price are graded differently.** The middle price (q50) is a forecast and should miss evenly on both sides, so it is graded on closeness and bias. The *listing price* is a choice set by the person's goal: "sell fast" lists near the low end of the range, "most money" near the high end. It is graded with the matching asymmetric loss, the pinball loss at that quantile, which charges a miss on the costly side more (*inferred*; pinball loss is the standard quantile score, *asserted* from memory). That is how "below versus above" enters the math instead of a slogan.

### The outcomes, and how each is tested without a hard data problem

| Outcome a seller feels | Number anyone can check | Data-science number | Cheapest honest test | What it supports, and what it does not |
|---|---|---|---|---|
| Price is right | median $ off; share within 20% | PPE20 with a by-product interval; MdAPE; bias; ceiling skill | Sold-rows backtest (decisions 1 to 22) and the forecast duel below | That we know what things sell for. Not that our price earns more |
| Range is honest | "8 in 10 landed in the range" | coverage with a Wilson interval per cell | Same | That the range can be trusted. Not that it is narrow (width shown beside it) |
| Knows when it doesn't know | share we price; how wrong the eBay median was on the rest | hit rate; baseline error on abstained items | Same | That holding back is earned. Not coverage of the hard bucket |
| Sells fast enough | "half sold within the days we gave" | P(sold by 7, 30, 90) calibration; AUC; Brier | The forecast duel (live listings followed forward) | That our speed odds are calibrated. Not that our price makes it faster |
| Money kept | dollars kept per site after fees | exact arithmetic, no model | `node scripts/bench/bench.mjs` (the keep engine on fixed prices, already run) | Which site keeps more at a given price, exactly. Not that the item sells there |
| Not left on the table | "sellers who sold within a day were priced X% under our range" | share of sub-day sales below our q10, with interval | Sold rows with listing dates | Likely underpricing (a sale within a day at a low ask is evidence, *inferred*). Not proof for any one item |
| Seller's time | minutes to list on N sites, ours against by hand | median and range over sessions | The stopwatch session ([numbers.md](../../../product/numbers.md)) | Effort saved for the people timed. Not for everyone |
| Sell-through and money in a month | items sold and dollars kept in 30 days | difference with an interval | Small paired live test: items stratified by kind, randomly assigned to our price or the seller's own | A pilot result with its interval. With 20 to 40 items it will not reach significance, and we say so |
| Never sold twice | "0 of N interleavings sold one item twice" | exhaustive model check | `bench.mjs` race check (already run) | The rules are safe. Not the site adapters' speed |
| Photo is truthful | "the gate caught every planted lie" | catch rate on planted edits | `scripts/bench/gate.py` (already run) | The gate's sensitivity on our test set. Not on every photo |

### The forecast duel: the cheapest clean test, and it compares competitors

**Today, write down our price and odds for live listings other people have posted, then score them when they sell.** For each of a few hundred live listings across the six kinds: record its ask, our q10/q50/q90, P(sold by 7 days), and the eBay sold median as of today, plus each competitor tool's suggested price where one can be asked for the same item. Commit the file (its hash is the pre-registration). Re-check each listing's url after 1, 7 and 30 days: sold price, or still live.

- Why it is the right test: every number is frozen before the outcome exists, so leakage is impossible by construction; it needs no history and no sales of our own; and it is the only fair way to compare a competitor, because a tool can be asked *now* but not about a past date.
- What it costs: reading pages a second time. In a 24-hour event only the fast sellers resolve, so the demo shows "resolved so far, n = …" and the rest resolve after.
- Bias to state: the first items to sell are the cheap or underpriced ones; the duel reports the share resolved and scores the rest when they land.

### How it is shown: three layers

1. **One sentence in the seller's terms**: "On a $60 jacket, the eBay sold median you'd look up misses by about $11. We miss by about $5, and we tell you when we can't say." (placeholders)
2. **The numbers card**: median $ and % off, within 20%, bias, range held, share priced, speed calibration, each with n and an interval, and the eBay median and any competitor on the same items.
3. **The paper**: [paper.md](paper.md), written like a short methods paper, with the pre-registration hash, the data and its terms, the one command that reproduces every number, every cell including losses, and what each result does not show.

### Easiest ways to get sold data, ranked

| Source | Effort | What it gives | Terms | Use |
|---|---|---|---|---|
| **The forecast duel** (live listings, re-read later) | low: read pages twice | prospective price and speed outcomes, competitor comparison | the site's terms for reading listings, unread | **First choice.** The cleanest test |
| Kaggle Mercari price challenge | lowest: one download | about 1.48M sold Mercari items, text only, no dates (*asserted* size) | the competition's data rules, unread | Model benchmark tonight (decision 31) |
| Terapeak, by hand, about 200 items in the demo kinds | medium: a seller login, an hour | eBay sold prices and dates, up to 3 years | eBay content; the User Agreement is unread, and the API licence bars price modelling (§9 item 6) | Research only, kept out of the product, once someone reads the terms |
| Mercari and Poshmark sold filters, by hand | medium | sold prices on those sites | unread | Second channel for apparel, shoes and bags |
| Our own people's sales | grows with use | the truest rows: condition, fees, days | ours, with consent | The long-run test |
| Ben's own Depop export | low | his past sales | his consent; he asked us earlier to stop using his Depop, so only if he offers it | Only on his word |
| eBay API | - | - | the licence bars price modelling | **Not used** |

## 8. What we can claim at each scale, and what runs in parallel

Ben, 07:45: "compare the claims we can make at each scale and see if there is any way to do things in parallel where we can get more data ... with whatever data we get in each situation how do you test it then and what results would you be able to conclude ... the backend is not finished yet but we need to have an experiment designed and ready to run".

### How sure each scale lets us be

95% intervals, at a true within-20% rate of 70% and a true range coverage of 80%. "Smallest lift we can see" is the gain over the eBay median that the paired test detects 8 times in 10, assuming 30% of pairs disagree. Correlated sales (about 10 per product, *assumed* within-product correlation 0.1) roughly halve the effective n; the second figure includes that (*inferred*, my arithmetic).

| Sales scored | Within 20% reads | Range coverage reads | Smallest lift we can see | Per kind (of 6) |
|---|---|---|---|---|
| 30 | 52 to 83% (45 to 87%) | 63 to 90% | 27 points | none |
| 100 | 60 to 78% (57 to 81%) | 71 to 87% | 15 (21) points | none |
| 300 | 65 to 75% (62 to 77%) | 75 to 84% | 9 (12) points | 56 to 81% each: exploratory |
| 1,000 | 67 to 73% (66 to 74%) | 77 to 82% | 5 (7) points | 63 to 76% each: claimable |
| 3,000 | 68 to 72% | 79 to 81% | 3 (4) points | 66 to 74% each |
| about 1.48 million (Kaggle) | ±0.1 point | not applicable | under 1 point | yes |

Speed odds calibrated within 5 points need about 385 resolved listings per probability bin, so speed calibration is claimable only at the 7- and 30-day reads of a large duel; before that it is shown as raw counts.

### The scales, what each tests, and what it lets us say

| Scale | Data | Ready when | Test | We can say | We cannot say |
|---|---|---|---|---|---|
| **S0. Now, no data** | a synthetic market with known premiums ([synthetic.py](../../../jobs/valuation/synthetic.py)), plus the deterministic benches | now; needs no backend | the harness's own checks (decision 23) and whether the model recovers the planted premiums | "The test catches leaks, a cheating oracle scores 100%, random comps score no better than the baseline; never sold twice; fees exact; the photo gate catches planted lies" | Anything about accuracy on real items |
| **S1. Tonight, Kaggle Mercari** | about 1.48M sold items (*asserted* from memory), text and category only, random split | one download | our hedonic model (it uses brand, category and condition, which the data has) against the category median and the public leaderboard | "On about 1.5M real Mercari sales, text-only pricing scores RMSLE X against a winning 0.39": a tight number on a public test | The comp engine, time order, photos, speed |
| **S2. Tonight, hand-collected sold rows** | about 300 sold rows, 6 people × 1 kind × 50 | an hour each, in parallel | the full backtest (decisions 1 to 22) with our engine or, until it is ready, the Python model in [market.py](../../../jobs/valuation/market.py) | Overall within-20%, $ off, bias, coverage, hit rate, and a lift if it is 9 to 12 points or more | Per-kind claims; small lifts; speed |
| **S3. By the demo, the duel** | about 300 live listings recorded tonight, perhaps 20 to 60 sold by the demo | re-read once before the demo | prospective scoring of everything frozen tonight, including any competitor's price | "We wrote these down before they sold; here are the first N": a direction, honestly small | A lift under about 25 points; any speed claim |
| **S4. 7 and 30 days, the duel** | perhaps half the 300 sold in a week (the eBay snapshot found about 50% of live fixed-price listings sold within roughly a week, *observed* as reported) | after the event | the same, plus speed odds against outcomes | Price claims at about ±7 points; speed in 2 or 3 bins | Fine speed calibration |
| **S5. A weekend or a scraper** | 1,000 to 3,000 sold rows | after the event, once terms are read | the full cube, leave-one-kind-out, ceiling skill | Per-kind claims; lifts of 5 points; "works on kinds it was not tuned on" | Money and sell-through |
| **S6. Our own users** | real listings and sales | months | everything, plus the paired live test | Money kept, sell-through, time saved | — |

### What runs in parallel

- **One collection pass feeds three tests.** For each kind, a collector saves 50 sold listings (the S2 backtest) and 50 live ones (the S3 duel); the same rows seed the season series later. Six kinds, six people, one hour.
- **The duel records inputs, not just our answer.** Each live listing is saved with its title, photos link, ask and timestamp now. Any engine version can be scored on it later, prospectively, as long as that version's commit is older than the listing's sale and duel outcomes are never used for tuning. So the unfinished backend does not block starting the duel tonight.
- **Contestants are interchangeable.** The runner takes any function `(rows before the freeze, item, freeze date) → q10, q50, q90, shown`. Today the contestants are the baselines and the Python model; the real engine plugs in when it is done, scored on the same frozen rows.
- **S0 and S1 need no one.** They run on a laptop while people collect.

### What each result lets us conclude, written before the run

| Result on the primary claim (paired within-20% lift over the eBay median) | The sentence we may use |
|---|---|
| Interval above 0 | "On N real sales, we were within 20% of the sale price more often than the eBay sold median: X% against Y%." |
| Interval includes 0, coverage passes | "As accurate as the eBay sold median, and unlike it, a range that held Z% of the time and a clear 'not sure' when the data is thin." |
| Interval below 0 | "The eBay sold median beat us on these N sales." Shown, with the cells where we lost, and no accuracy claim made |
| Coverage outside 75 to 85% | "Our ranges are not yet calibrated" and no range claim |
| Too few resolved | "N resolved so far; too few to say", with the count and the date of the next read |
