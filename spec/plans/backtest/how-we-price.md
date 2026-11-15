# How we price, what it reads, and where "within 20%" and "8 in 10" come from

Written 2026-11-15 for Ben's 08:54 questions. Every statement is marked: *observed* (read in the code or the spec at the link, or run), *asserted* (a source says it without showing it), *inferred* (reasoning). The depreciation research ran through Codex: [depreciation-and-market-proxies.md](../../../research/price/ben/depreciation-and-market-proxies.md). Its finding: no published coefficient can be plugged in; each proxy has to be measured on our own rows, and the runner now keeps `retail_cents` and `released_at` so it can be.

## 1. The two numbers: 20 and 80, and where "7 in 10" came from

"7 in 10 within 20%" is the first line of the page in [plan.md §3](plan.md#3-the-statistics-that-convince): "7 in 10 of our prices landed within 20% of what the item sold for. The eBay sold median ... got 5 in 10." **The 7 and the 5 are placeholders** written before any run, to fix the sentence's shape (*observed*, plan.md says so beside it). They are not a target or a rule. The real numbers replace them: today 97 to 98 in 100 on StockX against 89 to 90 for the median (§9 and [claims.md](claims.md)). The 20 and the 80 are real choices:

| Number | What it is | Where it came from | Why that number |
|---|---|---|---|
| **Within 20%** | The share of sales whose middle price (q50) was within 20% of what it sold for. Lenders call it PPE20 | Money [D6 step 4](../../determinations/money.md#d6-range-calibration-and-display-state), which takes the terms lenders use to grade automated home valuations (*observed* in the spec; the lender definitions are in [risk-and-reconciliation.md](../../../research/price/ben/risk-and-reconciliation.md)) | Two identical items sold the same week differ by about 11% in log price on used goods (*inferred* from the plan's noise ceiling, [plan.md §3](plan.md)). At that noise a perfect model is within 20% about 93% of the time and within 10% only about 63%. 20% is the tightest line a perfect model nearly always clears, so a miss there is our error, not the market's. We report 10% beside it |
| **80% range, held 75 to 85% of the time** | The low-to-high range is meant to hold 8 sales in 10. A backtest passes when 75% to 85% of sales land inside it | Money [D5](../../determinations/money.md#d5-fair-value-range-overall-and-per-site) (alpha 0.2) and D6's pass rule (*observed*) | 80% is wide enough to be useful and narrow enough to mean something; 95% ranges on used goods are wider than the price itself (*inferred*). The 5-point band is the tolerance for sampling noise at a few hundred sales. Too low means we overpromise; too high means the range is wider than it needs to be. The fix in [plan.md §6](plan.md) proposes failing only when the Wilson interval lies wholly outside 75 to 85% (*agent proposal*, not decided) |

The one-public-tool comparison that motivated the range rule: a vendor's 80% range held 75.3% of 81 sales, and its earlier "measured spread" held about half (*observed* in D5's "Why", from [range-calibration.md](../../../research/price/nate/range-calibration.md) §6).

## 2. The pricing logic, step by step

*Observed:* [Pricing modes](pricing-modes.md) compares each objective, its numeric rationale, the current toggle display and the tests that wait for the backend.

There are two engines. The one the app serves is the comps engine; the Python model is the nightly challenger it is checked against.

**The comps engine** ([app/src/engines/valuation/comps.ts](../../../app/src/engines/valuation/comps.ts), money D1 to D5, *observed*):

1. **Gather sold comps** for the item's product. Asks and unsold listings never set the value; they only cap the high end and feed the chance of sale (D1).
2. **Weigh each comp**: type (a sale 1.0, our own order 1.2, an eBay Best Offer 0.6), match (same variant 1.0, same product 0.5, same family 0.25), age (half-life 90 days, 30 for fast kinds like sneakers; nothing older than a year), and how its condition was read (measured 1.0, a site field 0.9, a model's guess 0.7).
3. **Back off** from variant to product to family to category until there are at least 2 sales in 90 days and an effective count of 6.
4. **Adjust each comp to the item** (D2): condition (new with tags 1.35, excellent 1.10, good 1.00, fair 0.75, for parts 0.35, starting values the fit replaces), missing box or accessory, size. **Move it to today** (D3) by the category's price index, capped at 0.8 to 1.25. A comp adjusted by more than 25% in total is dropped; the rest are weighted down by how much they were adjusted.
5. **Trim outliers** at 3 scaled MADs of log price.
6. **Range**: weighted 10th, 50th and 90th percentiles of the adjusted comps, widened by the category's conformal correction Q_g (D6), capped for new-with-tags at the cheapest live ask and today's retail price (D5). Rounded to whole dollars.
7. **Say so, or don't**: the range is shown as "checked" only when the category's backtest coverage is 75 to 85%; "too few" and "too wide" (high minus low above the middle) are hidden with the comps still shown.

**The nightly challenger** ([jobs/valuation/market.py](../../../jobs/valuation/market.py), *observed*): a hedonic regression of log price on brand, category, condition, size, era, site and a time trend; since today, its middle starts from the product's own last 5 sales in 90 days, shrunk toward the attribute model by how far products sit from it (empirical Bayes); then category quantiles and a conformal widening. This is the model the StockX backtest scored ([plan.md §9](plan.md)). The comps engine has not been backtested yet: it plugs into the runner as one more contestant, and that is the next build step (*inferred*).

## 3. What it reads at pricing time, as built today

*Observed* in the code on 2026-11-15:

| Source | What we read | Recency | State today |
|---|---|---|---|
| Mercari ([adapter](../../../app/src/edge/harness/sites/mercari/README.md)) | Sold search (`itemStatuses=2`), 100 rows a page; fields as in the adapter | Live | Built and proven live |
| Poshmark ([adapter](../../../app/src/edge/harness/sites/poshmark/README.md)) | Sold search (`availability=sold_out`), 48 rows a page | Live | Built; sold route documented |
| eBay ([adapter](../../../app/src/edge/harness/sites/ebay/README.md)) | Active listings through the Browse API; sold only through Marketplace Insights, which needs eBay's approval, else a hand-off to the sold-filter page | Live | Active built on fixtures; sold blocked on approval. eBay's public pages answer our cloud browser with 403 |
| Depop ([adapter](../../../app/src/edge/harness/sites/depop/README.md)) | Active search only; no sold route answers without a session | Live | Sold not available |
| Retail ([M2](../../determinations/market-insight.md#m2-retail-price-and-release-date)) | Launch retail and price new today, by identifier | Rechecked monthly | Designed |
| The `comp` table on Databricks ([fit.py](../../../jobs/valuation/fit.py)) | Every stored sold and asking comp with product, brand, category, size, era, site | Nightly | The nightly fit reads it |

**The gap, and where it stands** (*observed*): `POST /v1/valuations` ([valuations.ts](../../../app/src/edge/api/valuations.ts)) called the engine with no comps. It now passes Mercari and Poshmark sold-search sources ([sold.ts](../../../app/src/engines/valuation/sold.ts)), but the runtime harness has no route for either site yet, so they add nothing and the app still shows the family band. Registering the two adapters, plus condition, size and a sale date on search rows, is asked of the harness side in [packet 69](../../../.agents/team/packets/price/69-live-sold-comps-into-the-valuation.md).

## 4. Is there a proxy for depreciation?

Yes, five, and four are in the design (*observed* in money.md; effect sizes and their limits are in the Codex note):

1. **Condition grade** (D2): the biggest one for used goods. Priors from new-with-tags 1.35 to fair 0.75, replaced by paired sales of the same product in two conditions within 60 days, then by the hedonic fit.
2. **Time**: comps decay with a 90-day half-life (30 for fast kinds), and D3 moves old sales to today's level with a category index. For hype goods the market itself depreciates the product after release; the StockX run showed this as January to February prices falling 10 to 16% below the model's single trend before the product anchor fixed it (*observed*, [plan.md §9](plan.md)).
3. **Original retail and time since release** (D7, M2): the ratio of resale to retail and the months since release. StockX rows carry both (`retail_cents`, `released_at`); our own items will once M2 reads them. Not yet a feature in either engine (*observed*).
4. **Listing age** (D10, D15): a listing that sits loses chance of sale, and the markdown path lowers the ask. This depreciates the ask, not the item, and it is measured from our own listings once they exist.
5. **The market at that moment**: `market.liquidity()` already computes sell-through, live asks, days to sell and the ask-to-sold spread for the item's brand and category, but they are shown to the seller only and do not move the price (*observed*). Whether they predict the sale beyond recent sold comps is question (d) of the Codex research.

**Could a small dataset mimic the live market better than StockX?** Yes, and it is the [forecast duel](plan.md#the-forecast-duel-the-cheapest-clean-test-and-it-compares-competitors) (*inferred*). StockX is deadstock sneakers in one liquid market, where the last sale is already within 20% 97% of the time. The duel records a few hundred live used listings with our estimate and the baseline frozen before the outcome exists, with the live supply, ask spread and listing age at that moment, then reads the sale. It has every proxy above at the moment of sale, it cannot leak, and a few hundred resolved sales detect a lift of about 8 points (*inferred*; the power table is in [datasets.md](datasets.md)). Its cost is waiting: most used listings take weeks to sell.
