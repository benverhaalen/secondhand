# Determinations: money
Status: *agent proposal* for Ben and Nate. Written 2026-11-14.

What the system works out about money: what a thing is worth, what the seller keeps, how fast it sells, where and at what price to list it, how to answer offers, what to pay, and how far the person is toward their goal. Specs: [price](../features/price.md), [appraise](../features/appraise.md), [score](../features/score.md), [insights](../features/insights.md), [sold](../features/sold.md), [market](../features/market.md). Every number here is a starting value to tune unless marked as a fact read from a source. Money is integer cents. Marks: *observed* (source opened), *asserted* (snippet, memory or vendor claim), *inferred* (reasoning).

Two rules hold for every card:
- **Same inputs, same result.** Model outputs (extracted facts, embeddings) are stored with `extractor_version` and reused; everything after extraction is plain code with fixed seeds.
- **Guarded numbers.** Each output is `{value | range, basis_count, as_of, citation_id, state, hide_reason}` ([price.md](../features/price.md)). Hidden numbers say why and what would show them.

## Determinations

| # | Determination | Owner |
|---|---|---|
| D1 | [Comparable set and weights](#d1-comparable-set-and-weights) | price |
| D2 | [Condition variant completeness and size adjustment](#d2-condition-variant-completeness-and-size-adjustment) | price |
| D3 | [Time adjustment](#d3-time-adjustment) | price |
| D4 | [Site translation](#d4-site-translation) | price |
| D5 | [Fair value range overall and per site](#d5-fair-value-range-overall-and-per-site) | price |
| D6 | [Range calibration and display state](#d6-range-calibration-and-display-state) | price |
| D7 | [Original retail price](#d7-original-retail-price) | price, market |
| D8 | [Shipping cost and fit per site](#d8-shipping-cost-and-fit-per-site) | price |
| D9 | [What you keep per site](#d9-what-you-keep-per-site) | price, sold |
| D10 | [Chance of sale within a period at a price](#d10-chance-of-sale-within-a-period-at-a-price) | price, score |
| D11 | [Time to sell range](#d11-time-to-sell-range) | price |
| D12 | [Best site or set of sites](#d12-best-site-or-set-of-sites) | price |
| D13 | [Listing price](#d13-listing-price) | price |
| D14 | [Floor and always accept](#d14-floor-and-always-accept) | price |
| D15 | [Markdown path stale and relist](#d15-markdown-path-stale-and-relist) | price |
| D16 | [Offer response](#d16-offer-response) | price, sold |
| D17 | [Most a buyer should pay](#d17-most-a-buyer-should-pay) | appraise |
| D18 | [Good deal verdict on a listing](#d18-good-deal-verdict-on-a-listing) | appraise, buy |
| D19 | [Sell trade in donate or keep](#d19-sell-trade-in-donate-or-keep) | appraise |
| D20 | [Cost basis and gain or loss](#d20-cost-basis-and-gain-or-loss) | insights |
| D21 | [Goal progress](#d21-goal-progress) | insights |
| D22 | [Could earn across live items](#d22-could-earn-across-live-items) | insights |
| D23 | [Sell-through and share of asking](#d23-sell-through-and-share-of-asking) | market, score |
| D26 | [Year-end tax summary](#d26-year-end-tax-summary) | sold, insights |
| D27 | [Profit by group](#d27-profit-by-group) | insights |
| D28 | [Sell-down estimate](#d28-sell-down-estimate) | insights |
| D29 | [Profit and loss for a period](#d29-profit-and-loss-for-a-period) | insights, sold |
| D30 | [Slow movers and ABC ranking](#d30-slow-movers-and-abc-ranking) | insights, price |
| D31 | [Own-listing cohorts by listing month](#d31-own-listing-cohorts-by-listing-month) | insights |
| D32 | [Anomaly in a person's own figures](#d32-anomaly-in-a-persons-own-figures) | insights |
| D33 | [Promotion return](#d33-promotion-return) | insights, list |

---

## D1 Comparable set and weights

**Determines**: which observed listings stand in for this item, and how much each counts.

**Sources and weights**

Weight of comp i: `w_i = w_type x w_match x w_age x w_extract x w_adj`. All numbers are starting values to tune on the D6 backtest.

| Source | Contributes | Weight | Why that weight |
|---|---|---|---|
| Sold, price known (eBay sold, Mercari sold, Depop sold, our own orders) | a price someone paid | w_type 1.0 | a sale is the market clearing; asks are not sales ([what-market-value-is.md](../../research/price/ben/what-market-value-is.md), *observed* MMR uses transactions only) |
| Our own completed orders | a sale with known condition, fees and days | w_type 1.2 | condition is measured by us, not read from a stranger's text; "our own outcomes are the moat" ([sold-price-data.md](../../research/price/ben/sold-price-data.md)) |
| eBay Best Offer accepted, amount unknown | an upper bound on the sale | w_type 0.6, price x (1 - d_offer,cat) | the shown price overstates the sale; vendor claim of 20 to 40% inflation is *asserted* ([comps-sources-live.md](../../research/price/ben/comps-sources-live.md)); d_offer,cat is learned where the accepted amount is known. When the amount is read through the person's eBay seller session ([market-insight M3](market-insight.md#m3-used-price-per-site-over-time), *agent proposal*), the row is a plain sold row at the read amount and also trains d_offer,cat |
| Live ask | an upper bound and the queue a new listing joins | w_type 0 for value; used for the cap in D5 and rank in D10 | an ask says what one seller hopes; it is evidence of supply, not of value |
| Ended unsold | a price that did not clear | w_type 0 for value; censored row in D10 | survivorship: dropping it biases speed ([range-calibration.md](../../research/price/nate/range-calibration.md) section 5, *observed* Opendoor) |
| Retail price (D7) | an anchor for new-with-tags | never a comp | retail is a different channel ([adjacent-valuation.md](../../research/price/ben/adjacent-valuation.md), *observed* MMR keeps channels apart) |

| Match level (from identify) | w_match |
|---|---|
| Same `product_id`, same variant | 1.0 |
| Same product, other variant (colourway, edition, storage size) | 0.5 |
| Same family (line or model group) | 0.25 |
| "Visually similar unverified" | 0, excluded |

| Age of the observation | w_age |
|---|---|
| Default | `0.5 ^ (age_days / 90)` |
| Fast categories (sneakers, trading cards, consumer electronics) | `0.5 ^ (age_days / 30)` |
| Cut-off | older than 365 days excluded |

| Extraction source of the comp's condition and variant | w_extract |
|---|---|
| measured or label (read code, tag) | 1.0 |
| marketplace structured field | 0.9 |
| inferred from photo or text by a model | 0.7 |

| How much the comp had to be adjusted (D2, D3) | w_adj |
|---|---|
| Gross adjustment `G_i` = the sum of `|ln factor|` over every D2 and D3 adjustment, each counted as a positive number (the Best Offer correction fixes the sold price and is not counted) | `1 / (1 + G_i / ln 1.25)`: 1 for an exact match, 0.5 at the step 4 cap (*agent proposal*, starting form) |

Appraisers give the most weight to the sales that needed the least adjustment, and count gross adjustment (the sum of absolute adjustments), because two large adjustments that cancel still mean a weak match: "A sale with small gross and net adjustments usually deserves more weight than one with a 35% gross adjustment package" (*observed*, [risk-and-reconciliation.md](../../research/price/ben/risk-and-reconciliation.md); Ben approved applying it, [words](../../product/words.md#2026-11-15-adjacent-appraisal-risk-and-why-this-price)). The divisor is scaled to our own cap so the weight spans 1 to 0.5 over the comps we keep; an unscaled `1 / (1 + G_i)` would move a kept comp by at most 18% (*inferred*). The backtest in Check later decides whether it stays.

**One rule per quantity** (*agent proposal*; this card owns these four, and [market-insight.md](market-insight.md), [data.md](../features/data.md) and [price.md](../features/price.md) link here):
- Site weight: every site's sold row weighs w_type 1.0 (eBay, Mercari, Depop alike); our own orders 1.2. A site whose sold price is less certain is handled by w_extract and the Best Offer row, not by a lower site weight.
- Sold against ask: an ask weighs 0 for value; it enters only the D5 cap and D10.
- Recency: half-life 90 days, 30 in fast categories, cut at 365 days (the w_age table). A product-level index that needs a different half-life says why where it is defined.
- Minimum basis to show a sold range: `n_eff >= 6` and at least 2 sold in 90 days. A plain count of 5 sales elsewhere is replaced by this rule.

**Method**
1. Retrieve candidates (model step: the embedding and the comp-text extractor, Claude Haiku 5.5 per [price.md](../features/price.md)). Filter by category and hard attributes, then rank by keyword plus embedding match ([valuation-engine.md](../../research/price/ben/valuation-engine.md) section 2).
2. Drop junk (arithmetic on extracted flags): for parts, broken (unless the item is), lot, reproduction, the item's own listing, and duplicates or relists of one item by `fingerprint`.
3. Blend, never a threshold: start at the exact level. The step 4 adjustments are computed first, so `w_adj` is known here; the drop in step 4 still applies. Each quantile on log price blends the level with the next coarser one by `n_eff / (n_eff + k)`, where `n_eff = (sum w)^2 / sum w^2` and `k` is a `param` (prior 6). The order, the blend and when a number hides are written once, in [valuation §3 "The fallback order"](../engines/valuation.md#3-the-calculation); this card does not restate them.
4. Adjust each comp with [D2](#d2-condition-variant-completeness-and-size-adjustment) and [D3](#d3-time-adjustment). Drop a comp whose gross adjustment `G_i` exceeds ln(1.25). The cap is on gross, not net, so offsetting adjustments cannot hide a poor match (the mortgage-appraisal guide of 25% gross, [adjacent-valuation.md](../../research/price/ben/adjacent-valuation.md); starting value).
5. Drop outliers: `|ln adjusted - median ln adjusted| > 3 x 1.4826 x MAD`.
6. Shown set: the top 3 to 8 by `w_i`. The full set feeds D5.
7. Bracketing (arithmetic): over every kept comp, sum its D2 adjustments only (condition, variant, completeness, size). The D3 time adjustment moves every comp the same way, so it is left out. If every comp moved up (all worse than this item), mark the set `extrapolated: up`; if every one moved down, `extrapolated: down`. The item then lies outside what the sales show, and D5 widens that side ([D5](#d5-fair-value-range-overall-and-per-site) step 3). Appraisers require the value to sit "within the range of the adjusted sales price of the comparables" (*observed*, [risk-and-reconciliation.md](../../research/price/ben/risk-and-reconciliation.md)); applying that to the item's features rather than its final value is our reading (*inferred*).

**Why this method**: it is the appraiser's sales-comparison approach: close, recent, adjusted sales, written out. MMR does the same with recency weighting and an abstain rule (*observed*, [adjacent-valuation.md](../../research/price/ben/adjacent-valuation.md)). The usual alternative is a pure regression over all listings, which is harder to explain to the person and gives no shown evidence. Here the regression comes later (D5) and uses these comps as features (*inferred*). Exponential decay is chosen over a hard 90-day window so that one old sale does not count as much as a new one at the window's edge (*inferred*).

**When it is not shown**: at the family level with `n_eff < 6`, or with fewer than 2 sold in 90 days, the basis is thin. A thin basis first starts a `gather_request` to the intelligence engine ([intelligence-api §3.5](../engines/intelligence-api.md#35-gathering-more)), which widens the search as a background job. Only if gathering still leaves it thin is the result `too_few`: the person then sees "Not enough sales to price this yet" and the nearest coarser band labelled as such, plus Deep research.

**How it is explained**: "Based on 14 sales, last 90 days." Tap: each comp with its photo, site, date, sold or asking, the adjustments written out, and its weight shown as "counts a lot", "counts some" or "counts a little". The first line under the price is one reconciliation sentence: which sales counted most and why, for example "Most weight on the 3 that needed the least adjustment ($44, $47, $50)". When the set is `extrapolated: up`: "Few sales were this good; the top of the range is less sure." The weights are shown so the price can be recomputed from them (appraisers write weights out so "a reviewer can replicate your steps", *observed*, [risk-and-reconciliation.md](../../research/price/ben/risk-and-reconciliation.md)).

**Speed**: candidate sets and weights are kept ready per `product_id` and refreshed when new comps land. Only the person's own item adjustments run on demand.

**Check later**: in the backtest of [D6](#d6-range-calibration-and-display-state), on the same frozen estimates and cells, compare the median error of D5's q50 with match weights against equal weights (*agent proposal*). The weights are wrong if equal weights do as well or better overall, or in most reported cells.

## D2 Condition variant completeness and size adjustment

**Determines**: how much to raise or lower each comp's price for its differences from this item.

**Sources and weights**

| Source | Contributes | Rank | Why |
|---|---|---|---|
| Paired sales: same product, two conditions, within 60 days | a direct ratio | 1 | it holds everything else fixed |
| Hedonic fit per category: `ln price ~ product fixed effect + condition + variant + completeness + size + site + month` on sold comps | a coefficient per difference | 2 | standard practice for a hedonic price ([what-market-value-is.md](../../research/price/ben/what-market-value-is.md), *observed* MMR adjusts for condition grade) |
| Parent-category fit | a fallback coefficient | 3 | more data, less specific |
| Starting priors (no fit yet) | below | 4 | placeholders, to be replaced |

Starting condition priors relative to Good. These are *asserted* placeholders, to be overwritten by the fit: new with tags 1.35, new without tags 1.20, excellent 1.10, good 1.00, fair 0.75, for parts 0.35. Completeness priors: original box missing 0.90 for sneakers and electronics, and a missing charger or accessory 0.85. Function priors for electronics and appliances, as the attribute `works`: `verified` (the power-on clip or the screen-on shot) 1.00, `said` (the person says so) 0.92, `unknown` 0.80, `not working` priced as for parts. Pawn shops lower offers for items that don't work or are incomplete (*asserted*, a shop's own figures, direction only, [risk-and-reconciliation.md](../../research/price/ben/risk-and-reconciliation.md)); these are placeholders for the paired-sales fit like the rest. Size: no prior; it comes from the fit only, because it varies by category and gender.

**Method** (arithmetic after extraction)
1. Model step: the extractor gives condition grade, variant, completeness flags and size for the item and for every comp, in one schema.
2. For each attribute a with a difference: `beta_a = (n_a x beta_cat + k x beta_parent) / (n_a + k)`, with k = 50 sold rows (shrinkage). Below 30 rows in the parent too, use the prior.
3. `factor = exp(sum over differing a of (beta_a(item value) - beta_a(comp value)))`.
4. `adjusted = sold x factor x time_factor` (D3). Each step is written out: "+10% for better condition".
5. Exposed per field (*agent proposal*): for every `requirement` field of the item's kind, D2 publishes its `beta_a` per value with `n_a` and the rank it came from (paired, category, parent, prior), versioned with the nightly fit. The `requirement_fold` challenger reads these as the value effect of each field ([fields-by-kind](fields-by-kind.md)); D2 does not rank fields itself.

**Why this method**: shrinking a category estimate toward its parent is the empirical-Bayes answer to thin categories (*inferred*). It keeps one sparse category from producing a wild factor. The alternative is a fixed condition table for everything. It is simpler, but condition premiums differ by category (new-with-tags matters more in fashion than in tools), so a learned factor with a shrinkage fallback is better (*inferred*). The 25% gross cap in D1 limits damage from a wrong factor (*asserted* real-estate heuristic in [valuation-engine.md](../../research/price/ben/valuation-engine.md)).

**When it is not shown**: a comp needing more than 25% gross adjustment (D1 step 4) is dropped. If the item's own condition is unresolved, the range is computed for each candidate grade and the next-question card asks for it ([valuation-engine.md](../../research/price/ben/valuation-engine.md) section 5).

**How it is explained**: "This one sold for $40; yours has its box, so we count it as $44." Tap: the factor and the number of paired sales behind it.

**Speed**: coefficients are kept ready per category and refit nightly. The item factors are arithmetic.

**Check later**: measure out-of-sample residuals by condition grade. The factor is wrong if residuals for one grade are biased beyond 5% in the backtest.

## D3 Time adjustment

**Determines**: how much to move an older sale's price to today's market.

**Sources and weights**

| Source | Contributes | Rank | Why |
|---|---|---|---|
| Repeat sales (same item fingerprint sold twice) | the price change of an unchanged item | 1 | holds quality fixed (*observed* Case-Shiller method, [pricing-in-context.md](../../research/price/ben/pricing-in-context.md)) |
| Month effects from the D2 hedonic fit | the category index | 2 | uses all sales |
| None (fewer than 30 pairs and 200 sales) | factor 1, rely on D1 decay | 3 | no evidence, no adjustment |

**Method**: `I_cat(m)` is a monthly index, smoothed with a 3-month centred mean. `time_factor = I_cat(now) / I_cat(month of sale)`, capped at 0.8 to 1.25. Where [M12](market-insight.md#m12-seasonality) shows a season or a dated event for the category, the factor is also moved to the expected sale date (today plus the D11 median time to sale): `x S_cat(expected sale date) / S_cat(today)`, inside the same cap (*agent proposal*, [seasons-events-and-a-fair-backtest.md](../../research/price/ben/seasons-events-and-a-fair-backtest.md)). The trend axis in [score.md](../features/score.md) reads the 30-day drift of the same index.

**Why this method**: hype and season move resale prices, so an old comp needs moving forward rather than only down-weighting (*inferred*). A repeat-sales index is the published way to separate price change from quality mix (*observed* Case-Shiller). The alternative, a time feature inside the quantile model, would work but cannot be written out per comp.

**When it is not shown**: with under 30 repeat pairs and under 200 sales in the category, the factor is 1 and is not written on the comp.

**How it is explained**: "Prices for this kind of thing are up 6% since March." Tap: the index line by month and the number of sales behind each point.

**Speed**: the index is kept ready per category and updated nightly.

**Check later**: compare backtest MdAPE with and without the index on comps older than 60 days. The index is wrong if it does not lower the error.

## D4 Site translation

**Determines**: what a sale on one site implies on another site when that site has too few of its own sales.

**Sources and weights**

| Source | Contributes | Rank | Why |
|---|---|---|---|
| The site's own comps, `n_eff >= 6` | direct | 1 | channels price differently (*observed* MMR wholesale vs retail, [adjacent-valuation.md](../../research/price/ben/adjacent-valuation.md)) |
| Ratio `r_{s,cat} = median over products sold on both sites within 90 days of adjusted_s / adjusted_ref` | a translated price | 2 | same product, two channels |
| Parent-category ratio | fallback | 3 | more data |

**Method**: `adjusted_s = adjusted_ref x r_{s,cat}`. The range widens by the interquartile spread of the ratio: `low x r_q25` and `high x r_q75`. A translated range is labelled "estimated from other sites".

**Why this method**: buyers on Depop and on eBay are different crowds, so a single pooled price would hide a real difference (*inferred*). The ratio method is the transparent version of the site feature that the D5 model also uses, and it gives a number when the model has no site data.

**When it is not shown**: with fewer than 20 products sold on both sites in the parent category, the site has no range. It shows "Not enough sales on Depop yet".

**How it is explained**: "Few sales on Depop; similar things sell there for about 10% more than on eBay." Tap: the ratio and the products behind it.

**Speed**: ratios are kept ready per category and site pair, refreshed weekly.

**Check later**: for products that later sell on the target site, the translated range should hold its stated share. It is wrong if coverage there is 10 points under the direct ranges.

## D5 Fair value range overall and per site

**Determines**: the price range a sale of this item is expected to land in, overall and on each site.

**Sources and weights**: the adjusted comps of [D1](#d1-comparable-set-and-weights), weighted as there. Features: weighted quantiles p10, p50 and p90 of the adjusted comps, `n_eff`, site, category, condition, price-to-median ratio, and the D3 index. Live asks enter only as a cap.

**Method**
1. Model step (a trained tabular model, deterministic at inference): LightGBM quantile heads q10, q50 and q90 with a site feature ([price.md](../features/price.md)). Per site, set site = s. Overall, set site missing (the model's missing branch learns the pooled answer).
2. Conformal step, arithmetic: [D6](#d6-range-calibration-and-display-state) widens or narrows by `Q_g`, a log ratio, so the step is the same for a $20 item and a $2,000 one: `low = q10 / exp(Q_g)`, `high = q90 × exp(Q_g)`, each rounded half-up to whole cents (*agent proposal*, the engines lead, 2026-11-15; built in `app/src/engines/valuation/check.ts` and `aci.ts`, measured in [valuation.md §9](../engines/valuation.md#development-reading-the-ablation-of-2026-11-15)).
3. Bracketing: when D1 marks the set `extrapolated: up`, raise `high` by the parent group's `Q_g` and label that side "less sure"; `extrapolated: down` widens `low` the same way (*agent proposal*, starting rule, checked in D6 by the coverage of extrapolated sets alone).
4. Ask cap: when the item is new with tags, `high <= min(lowest live ask for the same product and condition, retail D7 price new today)`. A buyer can buy the same thing for that. The cap applies after the widening.
5. Before the model is trained (cold start): weighted quantiles p10 and p90 of the adjusted comps, widened by the parent's `Q_g` and by step 3, with state "not checked yet".
6. Round to whole dollars; net ranges come from [D9](#d9-what-you-keep-per-site).

**Why this method**: weighted quantiles of comps describe the spread of comps, not the error of a prediction for a new item. The one public tool measured at 75.3% of 81 in a range meant to hold 8 in 10, and its own earlier range from "measured spread" held "about half" (*observed*, [range-calibration.md](../../research/price/nate/range-calibration.md) section 6). Quantile heads plus conformal correction give stated coverage with ranges that adapt to how hard an item is (*observed* CQR, arXiv 1905.03222). The alternative, an LLM estimate, measured $30 to $43 typical miss on $100 (*observed* via the same page) and cannot state coverage. Both figures are the vendor's own, and its method is not sound, so they show the failure, not a bar ([published-price-tests-and-their-flaws.md](../../research/price/nate/published-price-tests-and-their-flaws.md)).

**When it is not shown**: only when no level of the fallback order can state it ([valuation §3](../engines/valuation.md#3-the-calculation)). `too_few` and `too_wide` are notes on a shown range, never reasons to hide it. `too_wide` means `high - low > q50`, one definition used everywhere (the proof layer is given q50 where it is known, and the midpoint only where no middle exists). The person sees the range with its basis level named, the comps, and Deep research.

**How it is explained**: "Most sell for $32 to $48 on eBay, based on 14 sales, last 90 days." Tap: the comps (D1), then how often ranges like this held (D6).

**Speed**: comp features are kept ready per product; inference is under 100 ms ([build-plan.md](../../research/price/ben/build-plan.md)).

**Check later**: the backtest in [D6](#d6-range-calibration-and-display-state), per family and price band, with its starting pass rule (*agent proposal*). The range is wrong if, in any reported cell, the median error of q50 is worse than the better of the two baselines (median of recent sold comps, last sale of the same product) or coverage of the 80% range falls outside 75% to 85%. No vendor figure is the bar ([published-price-tests-and-their-flaws.md](../../research/price/nate/published-price-tests-and-their-flaws.md)).

## D6 Range calibration and display state

**Determines**: how we know a range stated to hold 8 in 10 sales does hold 8 in 10, and which label it carries.

**Sources and weights**

| Source | Contributes | Rank | Why |
|---|---|---|---|
| Held-out sales from the window just before now, same Mondrian group (category) | conformity scores | 1 | a per-group guarantee needs per-group scores (*observed* MAPIE conditional page) |
| Parent group | fallback scores when the group has under 10 | 2 | a quantile needs about 1/alpha points to exist (*inferred*, [range-calibration.md](../../research/price/nate/range-calibration.md) section 2) |
| Sales arriving after issue | miss or hit, for ACI | live | drift correction (*observed* arXiv 2106.00170) |
| Recent residuals over older ones | weighting | weight `0.5^(age/90 days)` | drift breaks exchangeability (*observed* arXiv 2202.13415) |

**Method** (arithmetic)
1. Score per calibration sale, on the log scale: `E_i = max(ln(q10_i / y_i), ln(y_i / q90_i))` (scale-free; the additive form in cents let a dear item's misses widen a cheap item's range).
2. `Q_g` = the weighted `ceil((n_g + 1)(1 - alpha_g)) / n_g` quantile of the group's scores. alpha starts at 0.2 (crepes `MondrianCategorizer`).
3. ACI per group: `alpha_{t+1} = alpha_t + 0.005 x (0.2 - err_t)`, where `err_t` is 1 when a sale fell outside the range issued for it.
4. Backtest coverage per group: rolling origin by month, a 7-day gap, comps limited to before each test sale, and the tested item and its relists removed (the leakage list in [range-calibration.md](../../research/price/nate/range-calibration.md) section 7). Report coverage with a Wilson 95% interval.
5. Sales at exactly the seller's ask are scored separately, since a sale cannot exceed its ask (*observed* Underpriced AI method). The headline uses sales where the price was not set from our number.
6. State. **Checked**: Wilson lower bound of 70% or more at n of 30 or more. **Not checked yet**: the parent's range, drawn wider and labelled. **Hidden**: rules of D5.
7. The share shown is the measured coverage rounded down to the nearest tenth: a checked group at 83% says "8 in 10".

**Why this method**: conformal methods are the only published procedure that turns quantiles into a range with a finite-sample coverage statement. Plain quantile networks under-cover (*observed* arXiv 1905.03222). Mondrian grouping fixes the per-category failure seen at 20 to 70% per category on the vendor page (*observed*; vendor-run, method not sound, [published-price-tests-and-their-flaws.md](../../research/price/nate/published-price-tests-and-their-flaws.md)), and ACI keeps long-run coverage under drift (*observed*). The alternative is trusting the model's quantiles as given, and that is the failure the vendor reported.

**When it is not shown**: the stated share is never shown for a not-checked group. That group says "not checked yet for this kind of thing" ([price.md](../features/price.md)).

**How it is explained**: "Ranges like this held 8 in 10 sales last quarter." Tap: per-category hits and misses with counts, and the date of the last check.

**Speed**: `Q_g` and `alpha_g` are kept ready per group and updated as sales land; the person-facing step is one addition.

**Check later**: our own backtest, the one test every price check in this file uses (*agent proposal*). No vendor's published figure is the bar: their tests are not sound ([published-price-tests-and-their-flaws.md](../../research/price/nate/published-price-tests-and-their-flaws.md)).
1. Prospective rolling origin on held-out sales: for each test month, train on sales before it, leave a 7-day gap, and freeze each estimate (q10, q50, q90) as of the day before the test sale's listing went live, using only comps sold before that day. The tested item and its relists are removed (leakage routes 1 to 6, [range-calibration.md](../../research/price/nate/range-calibration.md) section 7).
2. Stratified by family and by price band of the frozen q50 (starting bands: under $25, $25 to $100, $100 to $500, over $500). A cell with fewer than 30 test sales states no result; it is reported as "too few" with its count.
3. Truth, stated per site in the report: the accepted price where we can read it, else the sold price. eBay: the sold price, with Best Offer sales at the accepted amount where read through the person's session ([M3](market-insight.md#m3-used-price-per-site-over-time)), otherwise left out and counted. Mercari and Depop: the sold price. Our own orders on any site: the accepted price from the order or payout. Shipping charged to the buyer is taken off; cancelled and returned sales are removed.
4. Accuracy report, in the terms lenders use for valuation models (*observed* definitions, [risk-and-reconciliation.md](../../research/price/ben/risk-and-reconciliation.md)), per cell: **hit rate** (the share of test items that got a shown range rather than `too_few` or `too_wide`), **PPE10** and **PPE20** (the share whose q50 is within 10% and 20% of the sale), **median absolute percentage error**, and **the share off by more than 30%**, because PPE10 "does not capture" the far misses. The same five numbers are computed on every real sale we see, and published per category on the site with their n. Card 18 of [managing-and-buyers](managing-and-buyers.md#18-whether-an-action-kind-has-earned-auto) reads PPE20 from the item's cell (family × price band).
5. Unsold listings are not dropped. Each one that ends or goes stale in the test month enters through the time-to-sale model ([D10](#d10-chance-of-sale-within-a-period-at-a-price)) as a sale censored at its last ask, and the report states how many there were per cell.
6. Report per cell and overall: coverage of the 80% range with a Wilson 95% interval, and the distribution of absolute percentage error of q50 against the truth (p25, median, p75, p90), next to three baselines on the same sales: the median of the product's sold comps in the 90 days before the frozen date, the last sale of the same product before that date, and seasonal naive (the product's median in the same calendar month a year earlier, where one exists). Each baseline gets a skill line, `1 - our median error / its median error`, because a seller's real alternative is one of these (*agent proposal*, [seasons-events-and-a-fair-backtest.md](../../research/price/ben/seasons-events-and-a-fair-backtest.md)).
7. Sales at exactly the seller's ask are reported separately in step 6 and are not in the headline.
8. Two populations, always side by side. **Listed with us**: sales of items listed through us, scored only where the sale price was not simply our suggested ask (the person set their own price, or a buyer's offer was accepted); a sale at our ask partly measures our own anchor, so it stays in step 7. **From a photo**: sales on any site of items not listed through us, priced from that listing's photos and title as of the day it went live. Zillow publishes 1.80% on-market against 7.21% off-market on one page (*observed*, [seasons-events-and-a-fair-backtest.md](../../research/price/ben/seasons-events-and-a-fair-backtest.md)), and its on-market figure carries the same anchoring, because the list price feeds the estimate; so we state ours next to the number. The listed case leads because it is the one the product is built for; the other is never hidden (*agent proposal*).
9. Frozen first: the cells, baselines, metrics and pass bar are committed before a run, every month of the test period is reported, and each run is repeated with the D3 season and event term set to 1, so the calendar's own share of the accuracy is stated. The M12 factors, and the rule that keeps or drops an event, are refit only on data before each frozen date; choosing events on the full history would leak the answer (*agent proposal*; Ben asked for a test that is "flattering but truthful", [words](../../product/words.md#2026-11-15-a-backtest-that-flatters-truthfully-seasons-and-waves-and-merge-to-main)).

Pass, as starting values to fix after the first run: in every reported cell and overall, coverage is between 75% and 85%, and the median error of q50 is no worse than the best of the three baselines; seasonal naive is compared only on the sales where it exists, with ours on the same subset and its n shown. The headline skill per cell is against the best baseline in that cell. Seasonal naive carries a year of depreciation ([M10](market-insight.md#m10-depreciation-by-category-and-brand)), so it is the weakest of the three and never the headline alone. The range is wrong if any reported cell fails either, two months running.

## D7 Original retail price

**Determines**: what the item cost new when it was sold, and what it costs new today if it is still sold.

**Sources and weights**: one card owns them, [market-insight M2](market-insight.md#m2-retail-price-and-release-date). Money reads its two values, `launch_retail` and `price_new_today`, under those names. Two notes from this card go to M2's owner: archived pages (Wayback) for discontinued items, and Serper `google.serp.shopping` for price new today ([openrouter-and-treg.md](../../research/price/ben/openrouter-and-treg.md)).

**Method**: M2's. Price uses `launch_retail` as the new-with-tags anchor and `price_new_today` in the D5 cap. A model only extracts the price and identifier from the page text.

**Why this method**: retail anchors new-with-tags pricing and the D5 cap, and people ask "what did it cost?". An identifier match is used over an image match because it is an identifier (*inferred*). The alternative, the first search result, often returns a resale or a different variant.

**When it is not shown**: when no identifier-matched page exists (vintage, unbranded, handmade), or the only source is a GTIN database with no page. The person sees no retail line; nothing is guessed.

**How it is explained**: "It cost $120 new in 2023 at the brand's store." Tap: the page, the date read, and the archived copy.

**Speed**: retail is kept ready per `product_id` once found, and rechecked monthly for price new today.

**Check later**: compare against brand-published price lists where they exist. The method is wrong if more than 1 in 20 matched prices are for a different variant.

## D8 Shipping cost and fit per site

**Determines**: what shipping costs on each site, who pays it, and whether the item can ship at all.

**Sources and weights**

| Source | Contributes | Rank | Why |
|---|---|---|---|
| Measured weight and dimensions ([measure](../features/measure.md)) | package size | 1 | measured beats estimated |
| Category default package (a shirt is about 0.5 lb in a poly mailer) | fallback size | 2 | *asserted*, to tune from our labels |
| Site label rates (Poshmark flat label $6.49, *observed* in [fees-and-taxes.md](../../research/price/nate/fees-and-taxes.md); eBay, Mercari and Depop label tables) | cost | 1 | the price actually charged |
| Carrier limits | fit | rule | USPS Ground Advantage 70 lb and 130 in length plus girth (*asserted*, to confirm at usps.com) |

**Method**: `package = item dims + padding (1 in each side) + packaging weight`. `ship_cost_s = rate_s(weight, dims, zone = median zone 5)`. The strategy sets who pays: `seller_shipping_s` is `ship_cost_s` when the seller offers free shipping, else 0. Fit: over the carrier limit, the site is greyed with "too big to ship" and only Facebook local remains.

**Why this method**: shipping can be a large share of a small sale's keep, so a measured package beats a flat guess (*inferred*). The alternative, a flat category guess, is used only as the fallback.

**When it is not shown**: with no size measured and no category default, the line says "add size to see shipping".

**How it is explained**: "Shipping about $8, the buyer pays." Tap: the package size, the source of the size, and the rate table date.

**Speed**: rate tables are kept ready and refreshed weekly; the lookup is arithmetic.

**Check later**: compare predicted against actual label cost on our orders. It is wrong if the median miss is over $1.50.

## D9 What you keep per site

**Determines**: what lands with the seller from a sale on each site after that site's real fee base, shipping and tax.

**Sources and weights**: the fee table row `{site, fee_pct, fixed_cents, base, min_cents, valid_from, source_note}` per site, from official pages (*observed* rows in [fees-and-taxes.md](../../research/price/nate/fees-and-taxes.md)):

| Site | Fee | Base |
|---|---|---|
| eBay | 13.6% to $7,500, then 2.35%, plus $0.30 at $10 or less or $0.40 above | item + shipping + sales tax |
| Depop | 0% selling, processing 3.3% + $0.45 | item + shipping + tax |
| Poshmark | $2.95 under $15, else 20% | item only |
| Mercari | 10% | item + buyer shipping |
| Facebook shipped | 10%, $0.80 minimum (*asserted*) | item + shipping + tax |
| Facebook local | 0 | none |

**Method** (arithmetic, cents)
1. `base_s = price + (shipping if base includes it) + (tax if base includes it)`.
2. `tax = price x tax_rate`. tax_rate is a starting 7%, later the sales-weighted destination rate from our orders (unsourced placeholder: no source gives 7%).
3. `fee_s = max(min_cents, fee_pct x base_s) + fixed_cents` (with eBay's tiers).
4. `keep_s = price - fee_s - seller_shipping_s (D8) - boost_s - processing_s`.
5. A net range applies the same function to the D5 low and high.
6. Worked example, *observed* arithmetic from the note: a $20 shirt with $6 buyer-paid shipping keeps $16.06 on eBay and $18.69 on Depop.
7. From a target keep to a list price per site: solve step 4 for the price. Ben's shortcut multipliers, "Depop target / 0.85, Poshmark target / 0.85, Mercari target x 1.18, eBay target x 1.10" ([packet list/31](../../.agents/team/packets/list/31-platform-fit.md), *asserted*), are the check on that solve: the formula is the calculation, and where the two differ by more than a site price ending the difference is listed under Check later, not hidden.

**Why this method**: sites charge on different bases, so the same price gives a different keep: 13.6% of item plus shipping plus tax is not 13.6% of the price (*observed*). The alternative, a flat percent per site, gave Ben's $16.88, which holds only with no shipping in the base (*observed* in the note).

**When it is not shown**: a fee row older than 30 days flags the keep as "fees may have changed" ([price.md](../features/price.md)). The keep is hidden when the D5 range is hidden; the fee is still shown for a typed price.

**How it is explained**: "You keep about $16 on eBay." Tap: price, fee and what it is charged on, shipping, and the fee page with its date.

**Speed**: fee tables are kept ready; the keep is arithmetic in the client.

**Check later**: compare predicted keep against payout reports per order ([sold.md](../features/sold.md)). It is wrong if any site's median difference exceeds $0.25.

## D10 Chance of sale within a period at a price

**Determines**: the chance this item sells within T days at price p on site s.

**Sources and weights**

| Source | Contributes | Rank | Why |
|---|---|---|---|
| Price ratio `p / median adjusted sold`, shrunk by count | the main driver | 1 | relative price is the strongest published predictor ([quality-and-value-classifiers.md](../../research/price/nate/quality-and-value-classifiers.md)) |
| Rank of p among live asks for the same product | the queue | 2 | buyers sort by price ([pricing-in-context.md](../../research/price/ben/pricing-in-context.md)) |
| Photo count, photo quality, title form | the listing | 3 | image quality odds ratio 1.17 to 1.25 ([score.md](../features/score.md)) |
| Category, site, month | base hazard | 3 | |
| Ended unsold and still-live listings | censored rows | required | dropping them biases speed (*observed* Opendoor) |

**Method**
1. Model step (a fitted statistical model, deterministic): a finite-horizon mixture cure model gives `P_model(sold by T | x)` (*observed* method, arXiv 2605.07087 on Mercari data).
2. Baseline, arithmetic: Kaplan-Meier `P_KM(T)` within the group and price-ratio bin (bins 0.8, 0.9, 1.0, 1.1, 1.2).
3. Blend: `P = lambda x P_KM + (1 - lambda) x P_model`, with `lambda = n/(n + 20)` when the bin has 10 or more comps, else 0.
4. Recalibrate per horizon (7, 30, 90) with isotonic regression on held-out data, censoring handled by inverse-probability weights.

**Why this method**: a cure model allows that some items never sell at a price, which a plain hazard model does not (*observed*, arXiv 2605.07087). The finite horizon matches the plan objectives of 7, 30 and 90 days. The alternative is a binary classifier per horizon, and it throws away the timing inside the window (*inferred*).

**When it is not shown**: with under 30 sale events in the group, or a calibration error over 5 points in the bin. The person sees "Not enough sales to say how fast".

**How it is explained**: "About 6 in 10 like this sell within a month at $40." Tap: the price-speed curve, the comps, and how often our odds held.

**Speed**: model coefficients and the KM tables are kept ready per group; the curve for 10 to 20 rungs is computed on demand in under 50 ms.

**Check later**: predicted P(sold by d) is calibrated within 5 points, and AUC is 0.6 or more at one week ([score.md](../features/score.md)). It is wrong if a calibration bin is off by more than 5 points over a quarter.

## D11 Time to sell range

**Determines**: how many days a sale is likely to take at a price.

**Sources and weights**: the curve `S(t | p)` of [D10](#d10-chance-of-sale-within-a-period-at-a-price).

**Method** (arithmetic): `t25`, `t50` and `t75` are the days where `P(sold by t)` reaches 0.25, 0.50 and 0.75, read within 90 days. The range shown is t25 to t75. If `P(sold by 90) < 0.5`, no time is shown; the person sees "fewer than half sell within 3 months at this price".

**Why this method**: quantiles of a survival curve include unsold items, while "average days of the ones that sold" counts only winners (*observed* bias, Opendoor, in [range-calibration.md](../../research/price/nate/range-calibration.md)). The alternative, the median days of sold comps, is shorter than reality whenever many items never sell.

**When it is not shown**: as for D10.

**How it is explained**: "Most sell in about 9 days at this price." Tap: the curve, with the price slider.

**Speed**: read from the D10 curve.

**Check later**: the share of our listings sold between t25 and t75 should be near 50%. It is wrong if it is outside 40 to 60% over 100 listings.

## D12 Best site or set of sites

**Determines**: which site or sites to list the item on.

**Sources and weights**: `E_s` (expected keep of the plan on site s, [D15](#d15-markdown-path-stale-and-relist)), D8 fit, category rules (Poshmark items from $500 go to Posh Authenticate, [sold.md](../features/sold.md)), and the cost of cancelling a double sale (Mercari up to 5% to $25; eBay a defect; Poshmark counts toward its 3% rate, [sold.md](../features/sold.md)).

**Method** (arithmetic)
1. Eligible sites: fit (D8), category allowed, the person has an account.
2. Rank by `E_s(T = 30)`.
3. Add sites greedily: add site j while `gain_j = (1 - P_set) x P_j x keep_j - P_double_j x cancel_cost_j > 0`, where `P_set = 1 - prod over chosen of (1 - P_i)` assumes independence. `P_double_j` is the chance that adding j causes two sales: a sale on the chosen set followed by a buyer on j inside j's delist window, or a sale on j followed by a buyer on a chosen site inside that site's window: `P_double_j ≈ P_set x (1 - exp(-W_j / m_j)) + P_j x sum over chosen i of (1 - exp(-W_i / m_i))`, where `W` is a site's detection plus delist budget in minutes (about 4 by design, [sold](../features/sold.md)) and `m` the expected minutes to sale on that site at the plan price (D11). The earlier fixed 0.01 overstated the risk for an item that takes weeks (about 0.01% per site) and understated it for one that sells within hours (about 3% per site) ([risk-and-reconciliation.md](../../research/price/ben/risk-and-reconciliation.md), *inferred*).
4. Hot items: when the median time to sale on the best site (D11) is under 24 hours, list on that site alone and run this card again after 24 hours unsold. Double-sale risk sits almost entirely in these items, the way correlated losses sit in a few insurance events (*inferred*; Ben approved, [words](../../product/words.md#2026-11-15-adjacent-appraisal-risk-and-why-this-price)).
5. Ties go to the site with the higher P.

**Why this method**: each extra site adds buyers but also double-sale risk and work. The greedy marginal rule stops when the next site does not pay (*inferred*). The alternative, listing everywhere, ignores cancellation penalties that count against seller standing.

**When it is not shown**: if every site's E is hidden, no best site is chosen. The person sees the sites side by side without a pick.

**How it is explained**: "Best on eBay and Mercari: you keep the most and it sells fastest there." Tap: E and P per site, and why each greyed site was left out.

**Speed**: computed on demand from kept-ready D10 and D9 outputs.

**Check later**: run a holdout of items listed on the pick only versus all eligible sites. The pick is wrong if all-sites gives higher realised keep per item after cancellation costs.

## D13 Listing price

**Determines**: the price to list at on each chosen site.

**Sources and weights**: the ladder of [D15](#d15-markdown-path-stale-and-relist), its start rung, and the expected offer discount `d_{s,cat}` = the median of `(ask - sold) / ask` where both are known on that site and category (eBay Best Offer with the amount known, Mercari price history, our own offers).

**Method** (arithmetic)
1. `start = argmax over rungs p of P(sold within T | p) x keep_s(p)` ([price.md](../features/price.md) step 3).
2. On offer-norm sites (eBay Best Offer, Poshmark, Mercari): `list = start / (1 - d_{s,cat})`, capped at the D5 high.
3. Round to the site's price ending (the price ending most common among that site's sold comps in the category).

4. Comparison with Ben's fixed multipliers (*agent proposal*; [packet 31](../../.agents/team/packets/list/31-platform-fit.md), "Price"). At a $40 target payout, fee on the item price only, buyer pays shipping, no offer room added:

| Site | Formula output: price that keeps $40 | Ben's multiplier | Ben's price |
|---|---|---|---|
| eBay | $46.76 (`(40 + 0.40) / (1 - 0.136)`) | target x 1.10 | $44.00 |
| Depop | $41.83 (`(40 + 0.45) / (1 - 0.033)`; 0% selling fee) | target / 0.85 | $47.06 |
| Poshmark | $50.00 (`40 / (1 - 0.20)`) | target / 0.85 | $47.06 |
| Mercari | $44.44 (`40 / (1 - 0.10)`) | target x 1.18 | $47.20 |

They differ because the formula follows each site's fee rows (D9) and the learned offer discount `d_{s,cat}` (step 2), so it moves with price and category (Poshmark's $2.95 under $15, eBay's fixed fee, a shipping base) and carries no offer room until `d` is learned; Ben's multipliers are one fixed number per site that mixes fee and offer room (*inferred*). Which one sets the list price is open question J10 in [open-questions.md](../open-questions.md); this card does not decide it.

**Why this method**: on offer-heavy sites the list price is an opening ask and buyers expect room, so listing at the target loses the margin to the first offer (*inferred*). The discount is learned per site, not assumed. The alternative, list at q50, ignores speed and fees.

**When it is not shown**: when D5 or D10 is hidden, no price is suggested. The person types one and sees D9 for it.

**How it is explained**: "List at $45: you keep the most for a sale within a month." Then the trade-off in one line: "At $45 about 55% sell within 30 days; at $60 about 20%" (two rungs of the ladder). When the risk is real, a downside line follows: "If it sells slowly, the worst 1 in 10 outcomes leave you about $22." Tap: the ladder with P and keep per rung, and the markdown path (D15).

The downside line is the plan's **expected shortfall**: the average keep over the worst 10% of outcomes by day T, counting an unsold item at the value of its best non-sale route (D19), from the same D10 curve and the D15 markdown path. It is shown only when it is below 70% of the expected keep (starting value; *asserted* method from quant finance, [risk-and-reconciliation.md](../../research/price/ben/risk-and-reconciliation.md); Ben approved, [words](../../product/words.md#2026-11-15-adjacent-appraisal-risk-and-why-this-price)).

**Speed**: on demand from kept-ready inputs.

**Check later**: realised keep per item at the suggested price versus the person's own price on matched items. It is wrong if the person's own prices earn more on average over 100 listings.

## D14 Floor and always accept

**Determines**: the lowest price the system will sell at without asking, and the offer level accepted at once.

**Sources and weights**: ladder rungs (D15), cost basis (D20, if given), target profit (0 for casual sellers, [appraise.md](../features/appraise.md)), and the best non-sale route (D19).

**Method** (arithmetic)
1. `floor_s = max(lowest rung reached, cost + user.target_profit_cents if set, best non-sale route keep)`. This is the one place the formula is written; [price.md](../features/price.md) and [listing-and-marketing.md](listing-and-marketing.md) link here.
2. `always_accept_s` = the lowest rung p with `keep_s(p) >= E_k` (the expected keep of continuing the plan), and never below the floor.
3. Offered at listing as "Always accept $X or more". Only unedited approvals count for autonomy.

**Why this method**: a sure sale now is worth taking when it pays at least the expected value of waiting, so the always-accept line is where those meet (*inferred*). The floor stops a sale below what another route pays. The alternative, a fixed percent off the list price, ignores how fast the item sells.

**When it is not shown**: with no ladder (D5 or D10 hidden), the person sets both by hand. A sale under the floor always asks (`price_below_floor`).

**How it is explained**: "We'll accept $38 or more right away; we won't go under $30 without asking you." Tap: the plan's expected keep and the route that sets the floor.

**Speed**: on demand.

**Check later**: compare realised keep on accepted-at-once offers against plan E. It is wrong if items that declined offers above always-accept later sold for less on average.

## D15 Markdown path stale and relist

**Determines**: the price steps over time, when an item counts as stale, and when to relist instead of cutting the price.

**Sources and weights**: `C_s` (D1 on site s), D10 curves, interest (watchers, likes, offers), the trend axis (D3 drift), and the site's freshness levers ([price.md](../features/price.md)).

**Method** (arithmetic)
1. Ladder `L_s`: from p10 to p90 of adjusted `C_s` in 5-point percentile steps, rounded to site endings. The trend axis scales the ladder by its 30-day drift.
2. Each rung's P comes from D10; the next rung follows after the rung's t50 (D11).
3. `E_k = sum over steps of P(sale in step) x keep_s(step price)`. Horizons: 7, 30 or 90 days.
4. Stale: no sale by the plan's median days, and interest below `C_s` median at the same age.
5. At stale: if the current price is at or below the p50 of `C_s`, relist (price is not the problem: visibility is). Otherwise move to the next rung, but never below the floor (D14).
6. Stale at each age (*agent proposal*). `m` is the plan's median days to sell (D11 t50). Every step stays inside the person's `limits` (`floor_cents`, `ask_every_time`) and the `rule` state of its decision kind; a step outside them becomes an ask, never an action. The multiples are starting values to tune on the check below.

| Age | Step | Decision kind |
|---|---|---|
| m | step 5: relist or the next rung, plus the site's own levers ([listing-and-marketing.md D26](listing-and-marketing.md#d26-engagement-levers-the-agent-runs-on-its-own)) | `relist` or `markdown` |
| 1.5 m | an offer to watchers or likers at or above `always_accept_s` where the site has one | `offer_to_watchers` |
| 2 m | add the next site in D12's set that the item is not on | `first_post` |
| 3 m, or the path reached the floor | ask: end, bundle, trade in or donate, with D19's keep for each route | `price_below_floor` when the best route is a sale under the floor; otherwise an end the person confirms, `end_unsold` ([product §5](../product.md)) |

Poshmark relist is never promotable ([price.md](../features/price.md)), so on Poshmark the age m step always asks.

The three plans (quick, balanced, max_return) differ only in start rung and horizon (steps 1 and 3). Their steps are the age table above, not fixed day drops. Older fixed paths (quick: 10% drops on days 3 and 5; balanced: 7% on days 10 and 20; max_return: 5% on day 21 and a relist on day 45) in [list.md](../features/list.md) and [selling runs itself](../../docs/how-it-works/selling-runs-itself.md) are superseded by this card.

**Why this method**: a markdown that follows the price-speed curve lowers price only when time has shown the higher rung failed (*inferred*). The relist rule separates a pricing problem from a visibility problem, using interest relative to comparable listings of the same age. The alternative, a fixed 10% weekly cut, gives away margin on items that were only buried.

**When it is not shown**: with no ladder, there is no automatic markdown; the person is reminded at day 14 with the comps.

**How it is explained**: "No sale in 12 days and fewer views than similar listings; dropping to $40." Tap: the ladder, the interest comparison and the next step.

**Speed**: the `check_due` job runs each live item when its `next_check_at` is due ([managing-and-buyers.md card 15](managing-and-buyers.md#15-when-to-check-again)); nothing runs on demand.

**Check later**: run an A/B on relist versus markdown at stale when the price is at or below p50. The rule is wrong if markdown sells sooner at equal or better keep.

## D16 Offer response

**Determines**: whether to accept, counter or decline an offer, judged on what the seller keeps.

**Sources and weights**: the offer amount o and its terms (shipping discount, bundle), D9 for keep, D14 lines, and the continuation value `V` = expected keep of the remaining plan from the current rung and age.

**Method** (arithmetic on keep, not on price)
1. If `keep(o) >= keep(always_accept)`: accept (auto inside limits).
2. If `keep(floor) <= keep(o) < keep(always_accept)`: accept if `keep(o) >= V`; else counter at `c`, chosen by the [negotiation engine](../engines/negotiation.md#3-the-calculation), never below the floor. Its starting prior and first champion is the midpoint `round_to_ending(max(floor, (o + current price) / 2))` (*agent proposal*, from the split-the-difference norm, *asserted*); the learned policy replaces it per (site, category) only when it passes the engine's [switch rule](../engines/negotiation.md#4-learning).
3. If `keep(o) < keep(floor)`: the offer is never auto-accepted. It becomes an ask (`price_below_floor`, [product/decisions.md](../../product/decisions.md)) that proposes the counter `c` of rule 2; the person decides. Going below the floor always asks.
4. A bundle offer is judged on the summed keep against the summed V.

**Why this method**: the same $5 off costs more on Poshmark (fee on item) than its face value once fees and shipping are in, so comparing price alone misjudges offers (*inferred* from D9). Comparing against the value of waiting is the optimal-stopping rule (*inferred*). The alternative is site tools that accept at a fixed floor (eBay auto-decline, Depop auto-respond, *observed* in [price.md](../features/price.md)); they cannot see V.

**When it is not shown**: with no V (D10 hidden), only rules 1 and 3 run, with the person's own lines. [Managing and buyers card 7](managing-and-buyers.md#7-how-to-answer-an-offer) must use the same counter rule.

**How it is explained**: "Offer $35: you'd keep $28, less than waiting is likely to bring; we countered at $40." Tap: keep at the offer, at the counter, and the plan's expected keep.

**Speed**: on demand within 1 s of the offer event.

**Check later**: compare declined or countered offers against the final sale keep for that item. It is wrong if more than half of countered items later sell for less than the declined offer's keep.

## D17 Most a buyer should pay

**Determines**: the most a reseller or a careful buyer should pay to come out at their target.

**Sources and weights**: `P(identity)` (identify), `P(condition)` (capture), `P(authentic)` (needed from authenticate), the D9 keep at the best site at the D5 p25, hassle, and risk margin.

**Method** (arithmetic): `max_pay = P(identity) x P(condition) x P(authentic) x keep(best site, p25) - hassle - risk_margin - target_profit` ([appraise.md](../features/appraise.md)).
- `hassle` = the person's set value per hour x the estimated minutes to list and ship. It is 0 if not set.
- `risk_margin` = the category return-or-dispute rate x the average loss per return, from our orders, with a starting 3% of keep.
- The one check offered is the one that moves max_pay most (value of information), at most 3.
- Verdicts: Buy (price at or under max_pay), Offer (price above max_pay but within 15% above it, offer max_pay), Skip, Unsure (a probability under 0.7). A recall hit forces Skip.

**Why this method**: expected resale keep at a conservative quantile, discounted by the chance the item is not what it seems, is the expected-value rule for buying under uncertainty (*inferred*). It uses the p25, not the p50, because the buyer bears the downside. The alternative, a fixed percent of value (the "pay a third" flipper rule, *asserted*), ignores fees and risk per item.

**When it is not shown**: when the item does not pass the qualified-to-price gate or D5 is hidden. The person sees "Can't price this yet" and the check that would help.

**How it is explained**: "Pay up to $22 to come out ahead." Tap: the resale range, the keep, each deduction, and the checks.

**Speed**: on demand in a garage-sale setting, under 2 s after identify ([garage-sale.md](../../research/appraise/ben/garage-sale.md)).

**Check later**: items bought at or under max_pay resell at a profit at least 8 times in 10 ([appraise.md](../features/appraise.md)). It is wrong if they fall short over 50 buys.

## D18 Good deal verdict on a listing

**Determines**: whether a listing's price, delivered, is low, typical or high for that item.

**Sources and weights**: delivered total `a = price + shipping + tax + buyer fees` (Mercari 3.6% Buyer Protection, *observed* in [fees-and-taxes.md](../../research/price/nate/fees-and-taxes.md)); the D5 overall range turned into delivered totals; the equivalents ranking in [appraise.md](../features/appraise.md).

**Method** (arithmetic)

| Condition | Label |
|---|---|
| `a < p5` delivered | "Unusually low, check it" (scam or wrong item risk) |
| `p5 <= a <= p25` | "Low for this" |
| `p25 < a <= p75` | "Typical" |
| `a > p75` | "High for this" |

For resellers, the verdict is Buy when `a <= max_pay` (D17).

**Why this method**: comparing the delivered price with the same quantiles the seller side uses keeps the two sides consistent (*inferred*). The alternative, comparing against the item's own ask history, says nothing about the market. Phia shows a high, typical or fair label against a large set of listings (*asserted*, [teardown](../../research/watch/nate/teardown-search-and-similar-finders.md#4-phia-beni-encore-croissant)); this label is against sold, delivered prices with a stated range, and on a catalog `product` it is the same label against that product's [M3](market-insight.md#m3-used-price-per-site-over-time) range in the listing's condition band (*agent proposal*, [parity](../parity.md#cross-marketplace-search-and-similar-item-finders)).

**When it is not shown**: when D5 is hidden for that product and condition. The person sees the comps without a label.

**How it is explained**: "Low for this: similar ones sold for $40 to $60 delivered." Tap: the comps and the delivered total broken down.

**Speed**: kept-ready D5 per product; the label is arithmetic per listing during a Watch scan.

**Check later**: the share of "Low for this" listings that sell within 3 days should be higher than for "Typical". It is wrong if it is not.

## D19 Sell trade in donate or keep

**Determines**: which route gets the most from an item: sell, trade in, donate or keep.

**Sources and weights**

| Route | Value | Source |
|---|---|---|
| Sell | plan `E_k` minus hassle (D17) | D15 |
| Trade in | best buy-back quote, locked about 48 h | buy-back sites ([appraise.md](../features/appraise.md)) |
| Donate | fair market value from sold comps (D5 p50), shown as a value, not cash | D5; Form 8283 needed over $500 |
| Keep | no money | always offered |

**Method** (arithmetic): recommend `argmax(sell, trade_in)` on cash. Donate is suggested when both are under $5, or when the sell P(30) is under 0.1. The FlowLister figure that items under $15 sell within 30 days 8.6% of the time ([insights.md](../features/insights.md)) is the prior for that case. The app never says what a donation is worth in tax.

**Why this method**: a sure trade-in can beat a riskier sale once time and fees count (*inferred*). Donation value is not cash unless the person itemizes, which we do not know. The alternative, always recommending a sale, ignores that most low-value items do not sell (Kijiji 2016: 60.1% donated, 21.6% resold, [appraise.md](../features/appraise.md)).

**When it is not shown**: when sell and trade-in are both hidden, no route is picked; all four are listed.

**How it is explained**: "Trade it in: $85 now beats about $90 in a few weeks after fees." Tap: each route's value and source.

**Speed**: buy-back quotes are fetched on demand and cached 24 h; the rest is kept ready.

**Check later**: track realised outcomes of items that followed versus ignored the pick. It is wrong if ignored picks realise more on average.

## D20 Cost basis and gain or loss

**Determines**: what the seller paid for an item and whether a sale made or lost money.

**Sources and weights**

| Source | Rank | Why |
|---|---|---|
| Our Buy order (price, fees, tax, shipping paid) | 1 | a record |
| The person's own figure (`you_said`) | 2 | only they know |
| A model estimate | never | a guessed basis would misstate gain |

**Method** (arithmetic): `basis = purchase price + buyer fees + tax paid + inbound shipping`. `gain = keep paid out (D9, actual) - basis - selling costs not in keep (supplies, labels bought separately)`. It is asked only in Fees and records (Ben: never ask; Nate: it reduces taxable gain; [insights.md](../features/insights.md)). The app never says whether a sale is taxable.

**Why this method**: gain needs a real basis, so an estimate would invent profit (*inferred*). The alternative, assuming zero basis, overstates gain.

**When it is not shown**: with no basis, the gain is not shown; the keep is.

**How it is explained**: "You made $14 on this one." Tap: the payout, the basis and its source.

**Speed**: arithmetic per order.

**Check later**: reconcile against the person's records where they export them. It is wrong if any order's gain differs from the export by more than $0.01.

## D21 Goal progress

**Determines**: how far the person is toward their monthly goal, counting only money paid out.

**Sources and weights**: order payout events in state kept (paid out) only ([insights.md](../features/insights.md)); refunds; the goal record.

**Method** (arithmetic): `progress = sum of paid-out keep in the goal window - refunds in the window`, divided by the target. "On its way" (paid, available) is shown apart and never added. Pace = `progress / days elapsed x days in period`, shown from day 7.

**Why this method**: only paid-out money is the person's; counting accepted or in-transit sales overstates progress and has to be walked back on a refund (*inferred*, and the spec's rule). The alternative, counting sales at "sold", is what most dashboards do and is why their totals drop.

**When it is not shown**: with no goal set, the total kept is shown without a bar. Pace is hidden in the first 6 days.

**How it is explained**: "$240 of $400 kept this month." Tap: each payout with its date and site; the money still on its way.

**Speed**: kept ready from payout events.

**Check later**: compare against bank payouts. It is wrong if any month differs from the sites' payout reports.

## D22 Could earn across live items

**Determines**: the range of money the live items could bring in.

**Sources and weights**: per live item, D10 `P_i(T)` and D9 keep quantiles.

**Method** (arithmetic, fixed seed): 10,000 draws. In each draw, each item sells with chance `P_i(30)` at a keep drawn from its calibrated range. Report the p10 to p90 of the summed keep. Items with hidden ranges are left out and counted.

**Why this method**: adding each item's low end gives a total far too low, because the 10th percentile of a sum is not the sum of the 10th percentiles (*inferred*). Simulation assumes independence, which is close for unrelated items. The alternative, the sum of list prices, ignores that many items do not sell.

**When it is not shown**: with no item that has a shown range. "3 items not counted" is stated when some are left out.

**How it is explained**: "Could earn $180 to $320 in the next month." Tap: the items, each with its chance and keep.

**Speed**: nightly, and on any listing change.

**Check later**: realised 30-day keep should fall inside the range 8 times in 10 across months and people. It is wrong if it falls under 7 in 10.

## D22a Worth of what you own

**Determines**: the range the person's owned and live items are worth together, and its change over 7 days ([insights](../features/insights.md)).

**Sources and weights**: per item, the [D5](#d5-fair-value-range-overall-and-per-site) `valuation` range; items below [D1](#d1-comparable-set-and-weights)'s basis are left out and counted.

**Method** (arithmetic, fixed seed, *agent proposal*): the D22 simulation with every item counted as held (no sale chance): the p10 to p90 of the summed fair values, and the same sum on the valuations of 7 days before. The change is the difference of the two midpoints.

**When it is not shown**: with no item that has a shown range. "3 not valued yet" is stated when some are left out.

**How it is explained**: "Your things are worth $A to $B, up $C this week." Tap: the items and each one's change.

**Speed**: nightly, and when a valuation changes.

**Check later**: the realised keep of items sold within 30 days should fall inside their summed range 8 times in 10. It is wrong if under 7 in 10.

## D23 Sell-through and share of asking

**Determines**: how readily a kind of item sells, and how close sales land to asks, as market facts.

**Sources and weights**: sold and live counts per product or category per site in a window; ask and sold pairs where both are known.

**Method** (arithmetic): sell-through is [market-insight M6](market-insight.md#m6-sell-through)'s method and name (30-day cohort); this card does not restate it. `share_of_asking = median(sold / final ask)` over pairs, with 6 or more pairs needed ([insights.md](../features/insights.md)). For one person's own listings the same M6 definition runs over their listings only: the denominator is items they listed in the window, an item posted to several sites counts once (one `item`, not one per `listing`), a delist after a sale on another site is not counted unsold, and the minimum basis is M6's own count, not D1's comps. By listing month it is [D31](#d31-own-listing-cohorts-by-listing-month).

**Why this method**: these are the two figures resale sellers already read (*asserted*). Both are counts, so they can be checked by anyone. The alternative, raw sold counts, hides how much supply competes.

**When it is not shown**: below M6's own minimum count for sell-through, or fewer than 6 ask and sold pairs for `share_of_asking` (the method above; D1's comp basis does not apply), or panel coverage stale (`panel_stale`).

**How it is explained**: "About 4 in 10 listed ones sold in the last 3 months." Tap: the counts and their dates.

**Speed**: kept ready per category and site, nightly.

**Check later**: compare our counts against a site's own figure where one is published. It is wrong if they differ by more than 10 points.

## D26 Year-end tax summary

*agent proposal*. D24 and D25 are not used in this file.

**Determines**: for one calendar year, what the person sold, what each site took, what reached them, and what they paid for the items where they told us, laid out so they or their preparer can file. It never says what is taxable (see Cannot be made credibly).

**Sources and weights**: no weights; every line is a record.

| Source | Contributes | Rank | Why |
|---|---|---|---|
| Our `order` rows: `price_cents`, `fees_cents`, `shipping_cents`, `payout_cents` ([sold.md](../features/sold.md)) | gross, fees, shipping, paid out | 1 | the record of each sale |
| Site payout reports read back by `reconcile` ([connect.md](../features/connect.md#read-back-and-reconcile)) | the site's own figures | 1 | where they differ from ours, the site's figure is shown and the difference listed |
| Refunds, returns and cancels from `refund` and `return_claim` decisions | money given back | 1 | lowers the year's gross |
| Cost basis (D20) | what the item cost | 2 | only where recorded or `you_said`; never estimated |
| Labels and supplies bought through the app ([managing-and-buyers.md card 10](managing-and-buyers.md#10-which-label-and-box)) | selling costs outside the keep | 1 | a record |
| The site's own 1099-K, when the person adds it | the reported gross | check | sites report gross, not keep; the summary shows the bridge between them (*asserted*: the federal reporting threshold changed in 2025 and is to be confirmed at irs.gov before shipping) |

**Method** (arithmetic, cents, per site and in total): `gross = sum price_cents + shipping_cents charged to buyers`; `minus refunds`; `fees = sum fees_cents`; `paid_out = sum payout_cents`; `basis = sum D20 basis on orders that have one`; `gain = paid_out - basis - outside selling costs`, only over orders with a basis, and the count of orders without one stated. The year is the payout date's year, with the sale date shown beside it. Exports as CSV and PDF through `export_user` ([data.md](../features/data.md)).

**Why this method**: a preparer needs gross, fees and basis apart, and the site's 1099-K shows gross only, so a person who reads only that form can overstate what they made (*inferred*). The alternative, the sites' own year-end pages, splits the year across sites and leaves out basis (*inferred*).

**When it is not shown**: with no sale in the year. Gain is left out for orders without a basis, and the line says how many.

**How it is explained**: "2026: sold $3,120, sites took $410, $2,710 reached you; you told us what you paid for 31 of 44." Tap: each order, and the bridge from each site's gross to what reached the person.

**Speed**: kept ready from order and payout events; the export runs on request.

**Check later**: compare each site's yearly total with its 1099-K or payout report. It is wrong if any site's gross differs by more than $1.

## D27 Profit by group

*agent proposal*, asked for by the insights lead ([insights.md](../features/insights.md)).

**Determines**: per group (category, brand or site), over a window, how much was kept and how much was made after cost.

**Sources and weights**: `order` money lines (D9 actual keep), `item.cost` as D20's basis, the item's category and brand from identify. No weights.

**Method** (arithmetic): per group, `kept = sum payout_cents`, `made = sum` of [D20](#d20-cost-basis-and-gain-or-loss) gain over orders with a known cost, plus the count of orders, the count with a cost, and the median days to sell. Categories are the D1 family level so they match the comps.

**Why this method**: it answers "what is worth my time to source, and where to sell it", from records only (*inferred*). The alternative, profit from list prices, counts sales that never happened.

**When it is not shown**: a group with no item of known cost shows `kept` only. The count of orders left out of `made` is always shown. A group with fewer than 3 orders in the window is folded into "Other" (a starting value).

**How it is explained**: "Sneakers: $640 kept, $310 made over cost, 9 sales." Tap: the orders.

**Speed**: kept ready from order events.

**Check later**: the sum over categories equals D21's total kept for the same window, to the cent.

## D28 Sell-down estimate

*agent proposal*, asked for by the insights lead.

**Determines**: how long the person's live items will take to sell down, and what they will have kept by then.

**Sources and weights**: per live item, D10 `P_i(t)` over days and D9 keep; the person's planned D15 steps.

**Method** (arithmetic, fixed seed): the [D22](#d22-could-earn-across-live-items) simulation run over days instead of one 30-day window. Report the day by which half, and by which 90%, of the counted items have sold, each as a p10 to p90 range, and the summed keep at those days. Items with hidden ranges are left out and counted.

**Why this method**: it reuses D22's draws, so the two numbers can never disagree (*inferred*). The alternative, the average days to sell times the item count, ignores that a few slow items set the tail.

**When it is not shown**: when over half the live value has D10 hidden ([insights.md](../features/insights.md)). A 90% day past 180 days is shown as "over 6 months".

**How it is explained**: "Half sold in about 3 to 5 weeks, most by 3 months." Tap: the items, slowest first.

**Speed**: nightly with D22, and on any listing change.

**Check later**: realised half-sold days should fall inside the range 8 times in 10. It is wrong under 7 in 10.

## D29 Profit and loss for a period

*agent proposal*, asked for by the insights lead.

**Determines**: for any period, every money line in and out, and what is left.

**Sources and weights**: `order` money lines (fee by type, shipping, tax, refund, payout, promotion spend), `item.cost`, labels and supplies bought in the app. Each line carries its `source` (`site_report`, `computed` by D9, or `estimated`). No weights.

**Method** (arithmetic, cents): `sales - refunds - fees (by type) - seller shipping - promotion spend - cost of items sold (D20, known cost only) - supplies = result`. Lines from [D9](#d9-what-you-keep-per-site) and [D20](#d20-cost-basis-and-gain-or-loss). [D26](#d26-year-end-tax-summary) is this card over one calendar year plus the bridge to each site's 1099-K. The export is a CSV of every line with its `source`, labelled a record, never tax advice.

**Why this method**: the standard income statement order, so a preparer reads it without a key (*inferred*). The alternative, payouts only, hides what the sites took.

**When it is not shown**: never hidden; a line whose source is `estimated` is marked. With no sale in the period, it says so.

**How it is explained**: "October: $820 in sales, $112 in fees, $64 shipping, $290 for the items; $354 left." Tap: each line and its source.

**Speed**: kept ready from order events; the export runs on request.

**Check later**: the period's payouts equal the sum of the sites' payout reports. It is wrong if they differ by more than $1.

## D30 Slow movers and ABC ranking

*agent proposal*, asked for by the insights lead.

**Determines**: which live items are least likely to sell soon, and which items make most of the person's money.

**Sources and weights**: live `listing`, `valuation`, [D10](#d10-chance-of-sale-within-a-period-at-a-price) `P_i(30)`, days listed against [market M7](market-insight.md#m7-days-to-sell); D9 keep.

**Method** (arithmetic): slow movers are ordered by `P_i(30)` lowest first (30 days is a starting window). ABC: rank live items by expected keep `P_i(30) x keep_i` (D9 at the list price); A is the items that make up the first 80% of the total, B the next 15%, C the last 5% (starting values, the usual Pareto split).

**Why this method**: the chance of sale already folds in price and interest, so it ranks better than days listed alone (*inferred*). ABC is the split retailers use to spend attention where the money is (*asserted*).

**When it is not shown**: an item with D10 hidden is listed apart as "can't tell yet", never ranked.

**How it is explained**: "These 6 are least likely to sell this month." Tap: each item's chance, days listed and the move D15 would make.

**Speed**: nightly with D22, and on any listing change.

**Check later**: of items ranked in the slowest tenth, fewer should sell in 30 days than of any other tenth. It is wrong if the slowest tenth outsells the next.

## D31 Own-listing cohorts by listing month

*agent proposal*, asked for by the insights lead.

**Determines**: for the items a person listed in each month, how they sold over time.

**Sources and weights**: the person's own `listing` and `order` rows. No weights.

**Method** (arithmetic): [market M6](market-insight.md#m6-sell-through)'s cohort definition, applied to the person's own listings grouped by month first listed: share sold by day 7, 30, 60 and 90, the [D23](#d23-sell-through-and-share-of-asking) share of asking, and total kept.

**Why this method**: a cohort keeps a slow month from being hidden by a busy one (*inferred*). The alternative, a running sell-through, mixes old stock with new.

**When it is not shown**: a cohort below M6's minimum.

**How it is explained**: "Of what you listed in March, 6 in 10 sold within a month." Tap: the items.

**Speed**: kept ready from listing and order events.

**Check later**: each cohort's sold count equals the person's orders for those items.

## D32 Anomaly in a person's own figures

*agent proposal*, asked for by the insights lead.

**Determines**: when the person's sales pace, fees, refunds or payout timing move outside their own usual band. Traffic per site is [listing D24](listing-and-marketing.md#d24-whether-a-site-changed-its-ranking)'s.

**Sources and weights**: the person's daily series from D21, D9 and order events.

**Method** (arithmetic): for each series, the expected band is the trailing 8-week median plus or minus 3 x 1.4826 x MAD for the same weekday (D1's outlier rule applied to time). A figure outside it on 2 days running is an anomaly. A fee share above the D9 prediction by more than $0.25 a sale (D9's own check) is one at once. A payout later than the site's stated schedule is one at once. Values are starting values.

**Why this method**: median and MAD hold up with a few sales a week, where a mean and standard deviation swing on one big sale (*inferred*).

**When it is not shown**: with under 8 weeks of history, or when the figure itself is hidden. It is a notice, never a decision ([insights.md](../features/insights.md)).

**How it is explained**: "Fees on Depop ran $1.10 a sale higher than expected this week." Tap: the series and the band.

**Speed**: daily.

**Check later**: of anomalies raised, the share the person opens and acts on. It is wrong if under 1 in 5 over a quarter.

## D33 Promotion return

*agent proposal*, asked for by the insights lead.

**Determines**: whether money spent promoting a listing came back.

**Sources and weights**: spend per listing (eBay Promoted Listings, Depop Boost, Etsy Ads), the funnel, `order`; the lift from [listing D23](listing-and-marketing.md#d23-whether-a-change-helped) and the break-even in [listing D18](listing-and-marketing.md#d18-promoted-listing).

**Method** (arithmetic): `return = (lift in P of sale x keep_s at the sale price) - spend`, with the lift and its range from listing D23 against matched unpromoted listings, and `keep_s` from D9 with the promotion fee in `boost_s`. Summed per site and period.

**Why this method**: a promoted sale might have happened anyway, so return counts only the lift over matched listings (*inferred*). The alternative, revenue from promoted sales over spend, credits the promotion with every sale.

**When it is not shown**: when listing D23 cannot tell the lift from noise: "too early to tell".

**How it is explained**: "Promoting on eBay cost $14 this month and brought about $20 to $35 more." Tap: the matched listings.

**Speed**: nightly.

**Check later**: compare against an eBay holdout where the person allows one. It is wrong if the holdout lift falls outside our range.

---

## Summary table

| Determination | Owner | Main sources | Method in five words | Hide rule |
|---|---|---|---|---|
| D1 Comparable set | price | sold comps, our orders | weighted backed-off adjusted sales | n_eff under 6 or 2 in 90 days |
| D2 Adjustments | price | paired sales, hedonic fit | shrunk log-linear category factors | comp over 25% adjusted dropped |
| D3 Time | price | repeat sales | repeat-sales monthly category index | under 30 pairs: factor 1 |
| D4 Site translation | price | cross-site same products | median cross-site price ratio | under 20 shared products |
| D5 Fair value range | price | D1 to D4 | quantile model plus conformal | too_few, too_wide |
| D6 Calibration | price | held-out sales | Mondrian CQR with ACI tracker | not checked: parent, labelled |
| D7 Original retail | price, market | market-insight M2 | M2's method, read as `launch_retail` and `price_new_today` | M2's hide rule |
| D8 Shipping | price | measure, rate tables | package size times site rates | no size, no default |
| D9 You keep | price, sold | official fee pages | fee on site's real base | fee row over 30 days flagged |
| D10 Chance of sale | price, score | sold and censored listings | cure model blended with KM | under 30 events or 5-point error |
| D11 Time to sell | price | D10 | survival curve quartile days | as D10; under half by 90 days |
| D12 Best sites | price | D9, D10, cancel costs | greedy marginal expected keep | all E hidden |
| D13 Listing price | price | ladder, offer discount | argmax P times keep | D5 or D10 hidden |
| D14 Floor, always accept | price | ladder, basis, routes | keep meets value of waiting | no ladder: person sets |
| D15 Markdown, relist | price | C_s, interest | step after rung median days | no ladder: reminder |
| D16 Offer response | price, sold | offer, D9, D14 | compare keep with waiting value | no V: rules 1 and 3 only |
| D17 Max pay | appraise | D5, D9, identity, authenticity | discounted p25 keep minus costs | gate failed or D5 hidden |
| D18 Good deal | appraise, buy | delivered total, D5 | delivered price against quantiles | D5 hidden |
| D19 Route | appraise | D15, buy-back quotes, D5 | highest cash route, donate low | sell and trade-in hidden |
| D20 Basis and gain | insights | Buy orders, you said | payout minus recorded basis | no basis given |
| D21 Goal progress | insights | payout events | sum paid-out keep only | no goal: total only |
| D22 Could earn | insights | D9, D10 per item | simulate sum of live items | no item with a range |
| D23 Sell-through, share of asking | market, score | M6, ask and sold pairs | M6's cohort; median sold over ask | D1 rule or panel stale |
| D26 Tax summary | sold, insights | orders, payouts, D20 | sums per site, gross to keep | no sale in the year |
| D27 Profit by group | insights | orders, D20 | kept and made per category, brand, site | no known cost: kept only |
| D28 Sell-down | insights | D10, D9, D22 draws | D22 simulation over days | over half live value with D10 hidden |
| D29 Profit and loss | insights, sold | orders, D9, D20, spend | income statement lines | never; estimates marked |
| D30 Slow movers, ABC | insights, price | D10, D9, M7 | lowest P(30); 80/15/5 split | D10 hidden |
| D31 Own cohorts | insights | own listings, orders | M6 by listing month | below M6 minimum |
| D32 Own anomaly | insights | D21, D9, orders | median and MAD band | under 8 weeks |
| D33 Promotion return | insights, list | spend, listing D23, D18 | lift x keep minus spend | lift is noise |

## Cannot be made credibly

| Determination | Why |
|---|---|
| Facebook Marketplace sale prices and days to sell | listings vanish without a sold flag or price; a delisting is not a sale. Only our own orders give Facebook numbers, so D4 translation is the only route |
| Poshmark days to sell from public data | no public final-sale dates (*asserted*, [range-calibration.md](../../research/price/nate/range-calibration.md)); only our own listings give it |
| The accepted price of an eBay Best Offer sale, when not exposed (no eBay seller session connected) | only a learned discount (D1), never the real figure |
| A stated coverage for categories with too few held-out sales | the range is still shown. "Checked" is stated only where an equivalence test passes: coverage inside 80% ± 5 points by a two one-sided test at 5%, Holm-corrected across the cells reported together. The old rule (a Wilson lower bound of 70% and coverage inside 75 to 85%) could not be passed by any cell of 30 to 38 sales and passed a truly calibrated cell about 13% of the time at 39 (science audit, 2026-11-15) |
| Taxable gain, and the cash value of a donation | needs the person's tax situation; the app never says a sale is taxable ([insights.md](../features/insights.md)) |
| Original retail for vintage, unbranded and handmade items | no identifier and no dated official page |
| Authenticity-adjusted value for high-value fashion from photos alone | P(authentic) from photos is not established; D17 uses it, so max_pay there stays Unsure without a check |

## Needs from other areas

| From | What |
|---|---|
| identify | `product_id`, variant, match level and its probability, in the D1 levels |
| capture and studio | condition grade, completeness flags, defects with `attribute.source`; photo quality score |
| measure | weight and dimensions for D8 |
| authenticate or trust | `P(authentic)` per item with its basis, for D17 |
| data and watch | comps with evidence, `state`, `days_listed`, `search_position`, sold dates and live asks; the same extractor run on comps and items; nightly jobs for kept-ready tables |
| list | per-site price endings, offer-norm flags, freshness levers (relist effects), and the delist timing for D12 |
| sold | offer events, payout reports with fee lines, refunds and cancellation costs, for D9, D16, D21 |
| buy | delivered totals for listings, and Buy orders for D20 |
| appraise | buy-back quote sources and their lock terms, for D19 |
| market | the job that collects Serper shopping results and Keepa, named in [market.md](../features/market.md), for M2 and D7 |

## Open

- Trading-card pricing: graded cards price by grade and population, which D2's condition factors do not model; whether they get their own card is for Ben and Nate.
- Ben's multipliers against the D9 solve (step 7): which one wins where they differ.

## What its parameters learn from (*agent proposal*)

Every learned number on this page is a `param` row whose written value is the prior. It updates from three sources, each written as an `observation` with evidence and a weight for how sure the outcome is: every listing the protocol reads on a site and what changed when it was read again (a price or rank change, a sold mark, a disappearance, which is never a sale in a price or a comp ([M3](market-insight.md#m3-used-price-per-site-over-time)) and enters only the D10 hazard, as a fractional sale weighted by `P(sold | vanished, site, kind, age)`, learned on the sites that show sold marks (eBay, Mercari, Poshmark) and held at 0 on Facebook until a hand-checked sample sets it; *agent proposal*, the engines lead, 2026-11-15); what platforms and industries publish, gathered by the information engines; and our own users' outcomes, the most exact rows, which calibrate the rest. Learning does not wait for our users. How rows update, promote, guard and roll back is in [product §6](../product.md#real-time-weights-agent-proposal).
