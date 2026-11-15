# What predicts a used item's sale price and time to sell, and how do we prove our predictions work?
Researched 2026-11-15 by Ben (agent: Claude, claude-opus-5-5). Feature: price.

**Question.** Which trends (seasons, dates, spikes) and which signals we collect (photos, brand, condition, timing, views, likes, price history) are known to move sale price and time to sell, and how should the backtest be built so its result can be defended to judges and used to tune the model?

**Decision it feeds.** Which signals get weight in [money D5, D10, D11](../../../spec/determinations/money.md) and [M12](../../../spec/determinations/market-insight.md#m12-seasonality); the headline metric for the pitch; and the rows Ben or Nate collect so the existing harness ([jobs/valuation/backtest.py](../../../jobs/valuation/backtest.py)) can run.

**What already exists, so this note does not repeat it.** The leak-proof harness with two baselines is built ([backtest.py](../../../jobs/valuation/backtest.py)). The range method and the lender-style report (hit rate, PPE10, PPE20, median error, tail share) are settled in [D6](../../../spec/determinations/money.md#d6-range-calibration-and-display-state). Conformal ranges, ACI and the leakage list are in Nate's [range-calibration.md](../nate/range-calibration.md). The demand engine's proof set and season term are in [demand-and-trend §9](../../../spec/engines/demand-and-trend.md#9-proof). On Ben's "any rdd for this": yes, those notes are the existing research; nothing in the repo measured seasonality on real resale data yet. (If "rdd" meant regression discontinuity design: it is a good fit for thresholds such as round-number prices or eBay's Top Rated badge; *asserted* from memory that eBay studies have used it, not opened.)

## What changed

| Draft from memory | What the sources say | Changed? |
|---|---|---|
| Season moves resale *prices* a lot ("jackets sell for 18% more in October") | Season is documented in *volume*: US used-merchandise store sales run about 9% under the average month in January and February and about 8% over in March and October (section 1). No source found measures resale *price* by month. The closest price analog is used cars: March wholesale prices rise 3.5% on average since 2009 before adjustment | **Yes.** Say "more coats sell in October", not "coats sell for more", until our own rows show a price factor |
| More photos raise the price strongly | About +2% log price per extra photo on eBay Motors, with an instrument for causality (2009 paper, 2005-06 cars). Photo *quality* raises the odds of sale (1.17 to 1.25) but adds only about 1 point of prediction accuracy | Partly. Photos help the seller sell; they barely help us *predict* |
| Machine learning beats simple forecasts by a lot | In the M5 competition only 7.5% of teams beat the best simple benchmark; at item level a plain exponential smoothing model matched the LightGBM ensemble (RMSSE 0.713 against 0.717) | **Yes.** Pool across products and keep the simple model as the bar |
| Headline metric: share within 10% of the sale | Identical items sell with a 10 to 15% spread in the same month on eBay. With 11% spread a perfect model is within 10% only 63% of the time, and within 20% 93% of the time (section 4) | **Yes.** Headline is within 20%, with the market's own ceiling stated beside it |
| Views, likes and watchers are strong predictors | They are (view count is a strong predictor of sale in Ma et al.), but they exist only after listing, so using them to set a listing price is leakage | Yes. They update the odds after listing; they never enter the pre-listing price |

## 1. Seasons, dates and spikes

| Pattern | Size and source | Mark | What we do |
|---|---|---|---|
| Used-goods volume by month | US used-merchandise store sales, not seasonally adjusted, 2023-2025 (FRED MRTSSM45330USN, Census). Running M12's own method (ratio to a centred 12-month average) on those 36 months gives Jan 0.91, Feb 0.92, Mar 1.08, Apr 0.98, May 1.06, Jun 0.98, Jul 0.98, Aug 0.99, Sep 1.02, Oct 1.08, Nov 0.98, Dec 1.02. The range (0.17) is far above the year-to-year spread of each month (0.005 to 0.024), so it passes M12's show rule | values *observed* (agent read the FRED data page); factors *inferred* (my arithmetic, 24 months of ratios) | The prior for every kind's count factor until our own 24 months exist. Stores, not online resale |
| Used-goods prices by month | Not found for resale. Used cars: "The average increase in March since 2009 is 3.5%" (Manheim, April 2018); "used car sales peak just after the peak in tax refunds" (same page) | *observed* | M12 fits price and count factors separately and the explanation names which one moved |
| Weather and cold-weather clothing | Sales "can fluctuate 3% to 5% for every degree of temperature change" (Weather Trends International, quoted by Quartz, about Dec 2015); warm Nov-Dec 2015 cost US winter apparel an estimated $572M | *asserted* (consultancy figures in the press; retail, not resale) | A weather term for outerwear may earn weight in the nightly fit; starts at 0 |
| Category calendars (coats Oct-Dec, swimwear May-June, fitness January, toys December) | Seller blogs (Flipsail, Underpriced, 2026) state them without data; Underpriced itself says "Treat the patterns as hypotheses". One 16-seller Poshmark sample found Jan-Feb sales (420) matched Nov-Dec (425) | *asserted*; the 16-seller figure *observed* as reported | Use as the month list for event windows; never as a shown number |
| Holiday spikes on resale apps | Poshmark vintage up nearly 30% and toys up 50% year over year over Thanksgiving weekend 2022 (company-reported, Modern Retail); ThredUp called Q4 "traditionally slow for thrift" | *asserted* (relayed from the pitch thread's reading) | Holiday windows stay event terms ([events.py](../../../jobs/demand/events.py)) |
| Paydays and benefit dates | Benefit households' grocery spending falls more than 20% after the benefit week, 33.5% from week 1 to week 4; other households show "almost no decline" (Hastings and Washington, NBER w14578, 2008, Nevada 2006-08). A vendor's "spending increases 33% on payday" has no stated baseline (InMarket, 2024) | first *observed*, second *asserted* | A day-of-month term may earn weight; starts at 0. Grocery, not resale |
| Search interest leads sales | Google Trends categories in the first weeks of a month help predict that month's official sales for cars, homes, retail and travel (Varian and Choi, Google Research, April 2009). No effect size on the blog | *observed* (claim), size not reached | Keeps its 0.15 start weight in the demand engine; must hold it in the nightly fit |
| Death and news spikes | Hall of Fame players' cards rose 10.5% against complete sets within a year of death; "roughly one-quarter of that increase disappears" the following year (Matheson and Baade, 2003, 13 players). O.J. Simpson rookie card: $250 the day before his death, $2,289 after (cllct.com, one sale) | first *observed*, second *observed* anecdote | A spike says "sell now, it fades", never "wait". Spike sales enter normal comps only with a decay term (the [M9](../../../spec/determinations/market-insight.md#m9-hype-resale-premium-from-release-and-its-decay) shape) |
| Used-goods sales bottom out in January | "sales of used merchandise bottom out at the start of the year for reasons that escape us" (FRED blog, Dec 2017) | *observed* | Agrees with the factors above |

**How predictable is buying, overall?** Volume follows the calendar well (the store series repeats its shape three years running). At the single-item level the calendar is small next to price and identity: in M5 the winners' 22% gain over the benchmark at the top of the hierarchy shrank to 3.4% at the item level (Petropoulos et al., arXiv 2102.13209, v4 2023, from the agent's summary of the unread part). *Inferred:* season should move our *time to sell* more than our *price*, and the backtest tests exactly that (section 5, ablations).

## 1b. Buying new against buying used, and when supply arrives

Ben, 07:28: "not just secondhand but general buying trends ... supply and demand. donating times. when people donate vs buy new".

**New-goods stores peak in December; used-goods stores do not.** Same method as above (M12 on Census not-seasonally-adjusted sales, Jan 2023 to Aug 2026, read from FRED; re-run with `python3 scripts/bench/seasons.py`):

| Month | Used merchandise | Clothing | Electronics | Sporting, hobby, books | Furniture |
|---|---|---|---|---|---|
| Jan | 0.91 | 0.75 | 0.94 | 0.85 | 0.91 |
| Feb | 0.92 | 0.79 | 0.90 | 0.80 | 0.92 |
| Mar | **1.08** | 0.98 | 0.94 | 0.97 | 1.01 |
| May | 1.06 | 1.06 | 0.99 | 0.98 | 1.03 |
| Aug | 0.99 | 1.03 | 1.00 | 1.09 | 1.05 |
| Oct | **1.08** | 0.97 | 0.96 | 0.95 | 0.99 |
| Nov | 0.98 | 1.16 | 1.14 | 1.11 | 1.08 |
| Dec | 1.02 | **1.45** | **1.34** | **1.44** | 1.08 |

(values *observed* on FRED by the agent; factors *inferred*, my arithmetic; all five pass M12's show rule.)

- *Inferred:* December is when new wins. Clothing stores do 45% more than an average month; used stores do 2% more. Gift buying goes to new goods, so a used seller's share of spending is lowest in Nov-Dec and highest in Jan-Feb, March and October. For electronics, December gifts also create the January supply of replaced phones and consoles (*inferred*, not measured).
- Secondhand keeps growing against new: US secondhand apparel grew 14% in 2024, "5X faster than the broader retail clothing market"; 58% of US consumers bought secondhand apparel in 2024, a record; "To get better deals" is the top reason (ThredUp 2025 Resale Report, GlobalData survey of 3,034 adults, Jan-Feb 2025) (*observed*; a resale company's report). 49% say they cut back on cheap apparel because they can't resell it (*observed*, as reported by Retail Dive, Mar 2025).
- No source measured *when* people buy used instead of new; the store series above is the only monthly evidence.

**Supply: when goods are let go.** No source found has monthly donation volumes.
- Year-end: "donations go up so that way people can get credit on their taxes before the end of the year", and "an influx" after the holidays (Goodwill, quoted by KRIS 6, Dec 2020) (*asserted*, no figures). The Dec 31 deadline for a deduction is a rule (*observed*, Kiplinger, Dec 2025); from 2026 itemizers face a 0.5%-of-AGI floor on charitable deductions (*asserted*, Kiplinger's paraphrase).
- Spring: "We see a pretty substantial increase in donations this time of year" (Goodwill-Easter Seals Minnesota, WCCO, May 2024) (*asserted*, no figures).
- Moving: one moving company's 222,300 moves in 2024 had "about 37%" in May to August, January fewest (about 14,100) and May and August highest (about 21,300 each) (All My Sons, Feb 2025) (*observed*, one company). Storage reservations peaked in June 2025 at 13.7% of the year (SpareFoot, May 2026) (*observed*, method not described). A survey puts 52% of moves in "moving season" (HireAHelper, 2023) (*asserted*, unsourced).
- *Inferred:* supply waves (January clear-outs, spring cleaning, summer moves, year-end tax donations) and demand waves (March, October) do not line up. When supply peaks and demand does not, prices soften and items take longer. That is why M12 now fits new listings as well as sold counts and price (on main since the pitch thread's change): the ratio of sold to new listings per month is the supply-and-demand signal, and it is ours to measure. Furniture is the kind most tied to moves (Webinterpret found furniture about six times as seasonal as other eBay subcategories, via the pitch thread's note).

**What it means for the person** (*inferred*, to test): list gifts and electronics before mid-November, when new-goods buying hasn't yet swamped it; expect January to be slow to sell but rich to buy; furniture sells into the summer moves, and floods in after them.

## 2. Every signal we collect, and what is known about it

| Signal | Price | Time to sell or chance of sale | Source, date, mark | Weight it gets |
|---|---|---|---|---|
| Price against sold comps | Sets the price | The main driver: raising the start price lowers the chance of sale, on a convex curve (Einav, Kuchler, Levin, Sundaresan, AEJ Micro 2015, eBay 2009, 244,119 matched sets) | *observed* | Rank 1 in D10, as now |
| Exact product and variant | Identical items in the same month still vary by 10 to 15% (coefficient of variation 0.111, same paper, Table 2) | | *observed* | Sets the noise floor in section 4 |
| Condition | "Broken" in the text: about -13.7% log price; "Receipt" +13% (Lewis, eBay Motors, 2009 paper) | | *observed* from the agent's summary of the unread part, cars only | Condition stays a comp adjustment (D5); grade sizes for clothing not found |
| Photo count | +0.0198 log price per photo, N = 71,292; "9 to 10 photos ... approximately 1.75% higher" (Lewis) | +0.0025 on the chance of sale per photo (Lewis). A vendor study of 15M eBay listings puts the best count at 8 to 10, held by under 2% of listings (ChannelX, April 2016, correlational) | Lewis *observed* (summary part), vendor *asserted* | A listing term in D10, rank 3, as now |
| Photo quality | | Odds of sale 1.17 (shoes) and 1.25 (handbags); adds about 1 point to cross-validated accuracy over price, views and days listed (Ma et al., arXiv 1811.10648, eBay May 2018) | *observed* | Helps sell; small for prediction. Our photo fix is for the seller, not the model |
| Title words | Raw averages, no controls: "authentic" £34 vs "genuine" £21 (Kehoe and Gee, eBay UK, 2016) | | *asserted* (no controls) | Weak preference signal only |
| Round-number ask | Asks at multiples of $100 sold for 5 to 8% less | Offers came 6 to 11 days sooner; 3 to 5% more likely to sell (Backus, Blake, Tadelis, NBER 21285, 2015, 10.5M listings) | *observed* | A lever on the speed slider, and a feature in D10 |
| Best Offer | First offers average 61% of ask ([pricing-psychology.md](pricing-psychology.md)); 17% of threads close on the buyer's first offer (Backus and Tadelis, NBER Reporter, 2020) | | *observed* | eBay hides the accepted price: D6 step 3 truth rule |
| Shipping fee | Each extra $1 of shipping lowers the auction price only $0.82; free shipping over a small fee adds over $2 (Einav et al.) | | *observed* | Everything is scored on delivered price less shipping, as backtest.py already does |
| Seller reputation | 1% more negatives: about -0.11% price; positives: no significant effect (Lucking-Reiley et al., 1999 pennies). The price link is "at best, a rather weak connection" once clustered by seller | After the first negative, weekly sales growth drops from +7% to -7% (Cabral and Hortacsu, CEPR 4345, 2004) | first *observed*; Cabral price caveat from the agent's summary | A new account sells slower: a speed term, not a price term (*inferred*) |
| When the listing ends or goes up | Peak hours have "lower selling rates and prices" from crowding (Simonsohn, Management Science, abstract only); late-night endings slightly worse (Einav, summary) | | *observed* abstract; sizes not reached | Spread posts away from the crowded hour; no weight until measured |
| Views, watchers, likes | | Strong predictors of sale (Ma et al. controls) | *observed* | After listing only. Never a pre-listing input (leakage) |
| Price history on the listing | 67.3% of sold eBay listings had not changed price 23 days after the sale (inglisting, 2026 snapshot) | | *observed* as reported; vendor with a stated conflict | Markdown path (D15) is ours to test, not learned from others |
| Price band | | Share of live fixed-price listings selling within about a week: under $25 49%, $25-100 52%, $100-500 50%, $500-2,000 39%, over $2,000 26% (n = 39) (inglisting, Jul-Aug 2026) | *observed* as reported; electronics-heavy seeds | Price band is a cell in the report, as in D6 |
| Brand | Not measured in any source read; within-product identity already carries it | | not found | Through identity and comps |

**Time to sell is the thin part.** No source gives a clean effect of photos or text on days to sell. The one published time-to-sale model on a used-goods marketplace is the Mercari cure model D10 already uses (arXiv 2605.07087, via Nate's note).

## 3. What the test is for, and what it cannot prove

**Purpose.** One claim a judge can check: *before an item is listed, we say what it will sell for and how fast, and on real sales we were closer than what a seller can look up today, and our ranges held as often as we said.*

**What a sold-price backtest proves:** we know what things sell for, our ranges are honest, and we beat the lookup a seller would do. **What it cannot prove:** that *our recommended price* earns sellers more money. Each sold item shows one price only, so the other price's outcome is never seen (*inferred*). That needs a live test: the hands-on protocol in [numbers.md](../../../product/numbers.md), or matched listings, the method Einav et al. used (the same seller, the same item, different strategies). Say this out loud in the pitch; it is the question a careful judge asks.

## 4. Which metric proves it works

The debate, with the case against each:

| Metric | For | Against | Use |
|---|---|---|---|
| **Within 20% of the sale (PPE20)** | Plain words; the lender standard ([risk-and-reconciliation.md](risk-and-reconciliation.md)); fair to cheap and dear items alike | Ignores far misses | **Headline**, always beside the share off by more than 30% |
| Within 10% (PPE10) | Sounds strict | The market's own spread makes it unfair: with 11% spread, a perfect model is within 10% only 63% of the time (simulation, *inferred*) | Reported, not the headline |
| Median absolute % error | One number | Hides tails; floor about 7.5% under 11% spread | Reported |
| Mean absolute % error | Common | Blows up on cheap items; punishes high and low guesses unequally | Not used |
| R² of predicted against sold | Looks impressive | Flattering and empty: prices span $10 to $1,000, so knowing only the category scores high | **Never used.** This is the flattering-but-false trap |
| Coverage of the 80% range | Shows the range is honest, which is our real promise | Needs volume per cell | Second line, with a Wilson 95% interval (D6) |
| Lift over baselines on the same items | Answers "better than what?" | Needs paired tests | **Part of the headline**: against the eBay 90-day sold median (what a seller sees with the Sold filter), the last sale, and in the hands-on test the seller's own guess |
| Time to sell | The second half of the promise | Needs listing dates and unsold rows | Third line: P(sold by 7 and 30 days) calibrated within 5 points (D10); half of sales between t25 and t75 (D11); Brier score against the Kaplan-Meier baseline |
| Money kept by day 30 | The real goal | Not backtestable (section 3) | Live test only |

**The noise ceiling makes the headline defensible.** If identical items sell with 11% spread (Einav et al.), the best possible model reaches about 93% within 20% and 63% within 10%; at 15% spread, 82% and 50% (*inferred*, 1M-draw simulation of a log-normal spread, my arithmetic). So the pitch says: "Identical items resell about 11% apart in the same month. Within 20% is the market's own noise, and a perfect model would hit about 9 in 10." Then our number, then the baseline's.

**Recommended headline** (a decision for Ben, asked in the thread): *"On N real sales, priced using only what was known the day before each was listed: X% within 20% of the sale price, against Y% for the eBay sold median a seller would look up. Our 80% ranges held Z%."*

## 5. Tuning without fooling ourselves

1. **Write the pass lines first and commit them** before the final window is opened: the metrics above, D6's pass rule (coverage 75 to 85% in every reported cell, q50 no worse than the better baseline), and the windows below. The commit hash goes into the result.
2. **Time windows, in order**: monthly rolling origins with a 7-day gap for tuning (D6), then the conformal calibration, then a locked final month scored once; nothing used for a locked item postdates the lock date ([plan decisions 2 to 4](../../../spec/plans/backtest/plan.md)).
3. **What may be tuned:** the comp count k, the age half-life, the match weights, the shrinkage n/(n+20), and alpha. Few knobs, each with a start value from the spec. Report how many settings were tried, since picking the best of many flatters the result.
4. **Every signal earns its weight.** Each of season, photo count, photo quality, round-number ask, day of week and Google Trends is switched off and on over the tuning origins; it keeps weight only if it improves PPE20 or pinball loss by more than the paired bootstrap noise (1,000 draws). This is the demand engine's promotion rule ([§4](../../../spec/engines/demand-and-trend.md#4-learning)) applied to price. The ablation table goes in the result: it is the honest answer to "do seasons matter?"
5. **Leakage** is refused by [check_leakage](../../../jobs/valuation/backtest.py), plus three rules for scraped rows: the same item cross-listed or relisted counts once (by cluster), Best Offer sales with a hidden price are left out and counted, and post-listing signals (views, likes, watchers) never enter a price.
6. **Season gets its own test** (M12's check): fit factors on all but the last 12 months, and keep them only if they cut the error of a flat forecast on that year. Report price and count factors separately.

## 6. What to collect

**Sample size.** At 80% coverage a Wilson 95% interval is 63 to 91% at n = 30, 71 to 87% at n = 100, and 76 to 84% at n = 400. Detecting a 10-point gain in PPE20 over the baseline with a paired test needs about 155 to 310 items, depending on how often the two disagree (*inferred*, McNemar approximation). So: **at least 200 test sales per kind in the final window, from 20 or more products per kind, 1,200 overall,** plus the earlier windows. Sales of one product are not independent, so intervals resample products ([plan decision 16](../../../spec/plans/backtest/plan.md)).

**Kinds and products.** Products whose identity is unambiguous, so the test isolates pricing from recognition. Matches the demand engine's six kinds, plus one hard bucket:

| Kind | Seed examples (grow to 20 or more products per kind) | Why |
|---|---|---|
| Outerwear and apparel | Patagonia Better Sweater, Carhartt Detroit jacket, Levi's 501, Lululemon Define | The season test: coats against tees |
| Shoes | Nike Dunk Low, New Balance 550, Birkenstock Boston | Hype and release decay |
| Electronics | iPhone 13 128GB, Nintendo Switch OLED, AirPods Pro 2 | Liquid, many sales, successor launches |
| Cards and collectibles | PSA-graded cards of a few named players | Spikes |
| Toys and LEGO | 5 retired set numbers | December |
| Bags | Coach Tabby, Longchamp Le Pliage | Condition matters |
| Hard bucket | Unbranded vintage, one-off furniture | Should mostly abstain; reports hit rate honestly |

**Sites and period.** eBay sold, last 90 days (130point or the eBay Sold filter), is the main source because it shows the most sales. Mercari and Poshmark sold filters as a second channel for apparel, shoes and bags. Facebook shows no sold prices, so it is not in the price test. For seasons, 24 months or more per kind from Terapeak (3 years, in eBay Seller Hub; monthly sold count and average price, exported by hand for the six kinds). **Not Ben's personal Depop.**

**Conditions.** Record the listing's stated condition (new with tags, like new, good, fair, for parts). Report each grade as its own cell where n allows.

**Row fields** (one CSV, frozen and hashed; raw rows stay out of git, the manifest and hash go in): site, url, kind, product_id, family_id, variant, condition, title, photo_count, ask_cents, sold_cents, buyer_shipping_cents, best_offer (yes, no, hidden), listed_at where the page shows it, sold_at or ended_unsold_at, seller_feedback_count. Unsold ended listings are collected too: they are the censored rows D10 needs.

## 7. How it runs

One command once the rows exist: freeze estimates for each test sale as of the day before its listing went live, using only earlier rows, then `run_backtest(estimates, sold_rows)` from [backtest.py](../../../jobs/valuation/backtest.py), which refuses a leaky run and scores both baselines. Missing pieces, to build when Ben says go (he asked for the design, not the run): a CSV loader for the fields above, the estimate-freezing loop over `market.fit`, the ablation switch, and PPE20 and tail share in `_summary` beside the coverage it already reports.

## 8. Season lines a person reads

Flattering because they say when the seller wins; true because each names what moved and its basis.

- Only shown when M12 shows the season (factor range over twice its noise, 24 months or more).
- Name the thing that moved. Count: "More coats sell in October than any other month." Speed: "Coats like this sell about twice as fast in October as in July." Price only when the price factor passes: "Coats like this have sold for about 8% more in November."
- Tap shows the 12 months, the years and the count.
- A spike says go now: "Prices jumped this week. Spikes like this usually fade within months."
- A low month says what to do, not just that it is bad: "January is the slowest month for this. Listing now still works; expect it to take longer."

*Agent proposal:* M12's example line ("Coats usually sell for about 15% more in November than in May") is a price claim no source supports yet. Change it to a count or speed line until our rows show a price factor. Added to the price spec's Open section.

## References and their jobs

| Reference | Job | Take |
|---|---|---|
| Einav, Kuchler, Levin, Sundaresan, "Assessing Sale Strategies in Online Markets Using Matched Listings", AEJ Micro 7(2), 2015 ([PDF](https://web.stanford.edu/~leinav/pubs/AEJmicro2015.pdf)) | evidence and method | The 11% noise floor; the shipping fee result; matched listings as the live-test design. Good because it has fixed effects for item and seller on 7.7M listings |
| Lewis, "Asymmetric Information, Adverse Selection and Online Disclosure: The Case of eBay Motors", 2009 ([PDF](https://dash.harvard.edu/bitstream/handle/1/4724767/lewis_asymmetricinformation.pdf?sequence=2)) | evidence | Photo count effect with an instrument. Old and cars only |
| Ma et al., "Understanding Image Quality and Trust in Peer-to-Peer Marketplaces", arXiv 1811.10648, 2018 | evidence | Quality helps sale odds, barely helps prediction |
| Backus, Blake, Tadelis, NBER 21285 digest, 2015; Backus and Tadelis, NBER Reporter, 2020 | evidence | Round numbers trade price for speed; Best Offer mechanics |
| Lucking-Reiley et al., "Pennies from eBay", 2000; Cabral and Hortacsu, CEPR 4345, 2004 | evidence | Reputation hits speed more than price |
| Simonsohn, "eBay's Crowded Evenings", Management Science (abstract) | weak signal | Crowded hours sell worse; no size |
| FRED MRTSSM45330USN (Census), updated Oct 15, 2026; FRED blog, Dec 2017 | evidence | The only monthly used-goods series: the season prior |
| Manheim index pages (Cox, Apr 2018; Automotive Fleet, Apr 2022) | analog | A price season exists in used cars, about 3.5% in March |
| Quartz and Planalytics, about Dec 2015 | weak signal | Weather moves cold-weather apparel |
| Matheson and Baade, 2003; cllct.com | evidence and anecdote | Spikes are real and fade |
| Varian and Choi, Google Research blog, 2009 | mechanism | Search data as a nowcast |
| Hastings and Washington, NBER w14578, 2008; InMarket, 2024 | weak signal | Payday effects exist for constrained shoppers |
| Makridakis et al., M5 accuracy results, 2020 preprint; Petropoulos et al., arXiv 2102.13209 | method | Hard baselines, cross-learning, small item-level gains |
| inglisting eBay sold snapshot, Jul-Aug 2026 | evidence, with a stated conflict | Speed by price band; "no seasonal claim ... because the data cannot support one" |
| Flipsail, Underpriced (2026) | weak signal | Calendars only; their own caveats |
| Census Monthly Retail Trade via FRED: MRTSSM4481USN, MRTSSM442USN, MRTSSM443USN, MRTSSM451USN, MRTSSM45330USN (updated 2026-10-15) | evidence | New against used by month. Only the used-merchandise series is a candidate prior for our own season factors; the new-goods series are context, when buying new competes |
| ThredUp 2025 Resale Report (GlobalData, Mar 2025); Retail Dive, Mar 21 2025 | evidence, from an interested party | Secondhand gaining on new; price is the top reason |
| All My Sons (Feb 2025), SpareFoot (May 2026), HireAHelper (2023) | weak signal | When moves happen: a supply wave for furniture |
| KRIS 6 (Dec 2020), WCCO (May 2024), Kiplinger (Dec 2025) | weak signal | Donation timing claims, no volumes |
| Mercari engineering blog (2018-11-14); Sijun He (2018-03-02) | benchmark | A public test on sold Mercari items: winner RMSLE 0.3875 ([plan decision 31](../../../spec/plans/backtest/plan.md)) |

## Searched, and could not reach

- JPMorgan Chase Institute tax-refund spending report: the URL returned the topics listing, not the report.
- Swappa's condition and resale value page: fetch failed.
- Full text of Simonsohn (sizes), Einav Sections II.B to IV (duration and timing coefficients), and the M5 paper's later sections: the fetch truncated; figures from those parts are marked as summary above and must be checked before they go in the pitch.
- Any published monthly *price* series for online resale of clothing, shoes or furniture: none found. A narrow search; it may exist in Terapeak, which needs a seller login.
- Monthly donation volumes from Goodwill, Salvation Army or the IRS: none found; only quotes.
- The JPMorgan tax-refund report (failed twice); the pitch thread's note uses the NBER refund paper instead.
- No marketplace or FRED download works from the build container, so nothing here was run on real resale rows yet. The Census values were read through web pages and typed into `scripts/bench/seasons.py`.
