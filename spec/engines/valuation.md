# Valuation engine

*agent proposal* (the whole file). Canon names in [product.md](../product.md) win. This engine joins the money cards [D1](../determinations/money.md#d1-comparable-set-and-weights) to [D12](../determinations/money.md#d12-best-site-or-set-of-sites) into one build, and makes the [D6](../determinations/money.md#d6-range-calibration-and-display-state) backtest the test it runs every night. The cards hold the formulas; this file says how they run as one engine, what learns, and how fast. Where a card and this file differ, the card's arithmetic stands and this file's learning rule sets the card's numbers.

## 1. What it decides

One `valuation` object per (item, as_of), a name the canon lacks:

```
valuation {
  product_id, variant, condition, as_of,
  fast:      { low, high, basis: family | category, n, state: rough },
  comps:     [ { comp_id, site, sold_at, price, adjusted, w, w_type, w_match, w_age, w_extract, citation } ]  (top 3 to 8 shown, all kept),
  n_eff,
  range:     { q10, q50, q90, state: checked | not_checked_yet | hidden, hide_reason, share_shown, group },
  per_site:  [ { site, q10, q50, q90, translated: bool, keep_q10, keep_q50, keep_q90,
                 p_sale: { d7, d30, d90 }, days: { t25, t50, t75 } } ],
  best_sites: [ site ],
  price_path: { start, list, floor, always_accept, ladder: [ { price, p_sale, keep, t50 } ] },
  param_version
}
```

It decides:
- which sales count as comps, and how much each counts (D1);
- the condition and size adjustment (D2), the time adjustment (D3) and the translation between sites (D4);
- the range and its state, overall and per site (D5, D6);
- what the person keeps (D9);
- the chance of sale and the time to sell at each price (D10, D11);
- the best set of sites (D12);
- the price path ([D13](../determinations/money.md#d13-listing-price) to [D15](../determinations/money.md#d15-markdown-path-stale-and-relist)), consumed by [negotiation](negotiation.md).

It makes no outward call to a site. Every read goes through [protocol and adapters](protocol-and-adapters.md) and the [source router](../features/data.md#source-registry-and-router-agent-proposal).

## 2. Signals

| Input | Source | Freshness |
|---|---|---|
| The item: product id, variant, condition, size, defects | the item card ([seeing the item](../determinations/seeing-the-item.md)) | per event |
| Sold rows | the person's own `read_orders`; sold search through our adapters; Firecrawl and treg reads; licensed feeds, each with its `rights` tags ([databricks](../databricks.md)) | warm per product family; a fresh pull on the Check |
| Accepted Best Offer amounts | the person's own eBay seller session ([M3](../determinations/market-insight.md#m3-used-price-per-site-over-time)) | per sync |
| Live asks and ended unsold listings | `search` and `read_listings` | hourly per family |
| The top listings for the product on each secondhand site: the first page in the site's own order, with price, condition, age, likes or watchers, and whether offers are on | `search` through our adapters, gathered by the [intelligence engine](intelligence-api.md) | on the Check, then hourly per family |
| Every official listing: the brand's own store, retailers and Amazon, with the current price, the list price and stock | `retail_offer` rows ([D7](../determinations/money.md#d7-original-retail-price)) | on the Check, then daily |
| Discounts from credible sources: a sale price or code published by the brand, an authorised retailer or a source the registry rates credible, with its end date | the intelligence engine, each as an `observation` with its source | on the Check, then daily while the listing is up |
| Retail now and then | [D7](../determinations/money.md#d7-original-retail-price) | daily |
| Shipping and fit | [D8](../determinations/money.md#d8-shipping-cost-and-fit-per-site) | per item |
| Fee rows | [D9](../determinations/money.md#d9-what-you-keep-per-site) | daily, flagged after 30 days |
| Listing quality | photo count, quality and title form ([score](../features/score.md)) | per listing |
| Outcomes | every sale, end and stale event on our own listings, with the valuation frozen at listing time | per event |

A row with `may_model: false` (eBay API rows and Apify rows, per [data use](../data-use.md)) can be shown, cited and priced from as a comp in a shown range ([Nate](../../product/words.md#2026-11-15-nate-rows-that-may-not-be-modelled-on-may-price-a-shown-range): "they can, they are verified real data"). It is never used to fit a weight, a model or a calibration score, except Apify rows, which may fit the nightly models ([Nate](../../product/words.md#2026-11-15-nate-apify-rows-may-fit-the-models-real-time-scores-per-market-on-each-platform-extremely-accurate), "Yes, Apify too"). eBay content, including eBay rows read through an Apify actor, stays out of every fit under eBay's terms.

## 3. The calculation

| Step | Card | Model or arithmetic |
|---|---|---|
| 1. Retrieve candidates: product id match, then embedding nearest neighbours on image and title within the category | D1 | model (the embedding index; deterministic at query) |
| 2. Extract the variant, condition, size and defects of each candidate | D1 | model (Claude Haiku, structured output, evidence span per field; `w_extract` 0.7 for its fields) |
| 3. Weight: `w = w_type x w_match x w_age x w_extract`; drop junk; blend down the fallback order by `n_eff / (n_eff + k)` (§3 "The fallback order") | D1 | arithmetic, with learned values (§4) |
| 4. Adjust for condition and size, then for time | D2, D3 | arithmetic, with learned values |
| 5. Drop comps beyond `ln 1.25` of their adjustment, and outliers past `3 x 1.4826 x MAD` on log price | D1 | arithmetic |
| 6. Quantiles q10, q50, q90, overall and per site | D5 | model (LightGBM quantile heads); before it is trained, weighted quantiles of the comps |
| 7. Translate to a site with too few sales of its own | D4 | arithmetic over ratios |
| 8. Conformal widening, the state and the share shown | D6 | arithmetic |
| 9. Ask cap for new with tags; round | D5 | rule |
| 10. Keep per site | D9 | arithmetic in cents |
| 11. Chance of sale at each rung; days to sell | D10, D11 | model (mixture cure plus Kaplan-Meier blend, isotonic per horizon); days are read off the curve |
| 12. Best sites | D12 | arithmetic (the greedy marginal rule) |
| 13. Start, list, floor, always accept, ladder | D13 to D15 | arithmetic |

**The fast first answer.** Before step 1 returns, the engine answers from the warm table `family_band` (a name the canon lacks): per (product family or category, condition), the weighted p10 and p90 of adjusted sold prices over 90 days, its count, and its date. It is refreshed when a sale lands in the family. The person sees it as a rough band within 2 s. When the full object is ready, the band is replaced in place by the range, which marks what changed. A family with fewer than 20 sales falls back to the category. A category with fewer than 20 shows no band; it says "Pricing this..." until the Check.

**The fallback order: a price is always given** (*agent proposal*, the engines lead, 2026-11-15, from [Nate](../../product/words.md#2026-11-15-nate-the-system-always-prices-with-fallbacks-and-its-power-is-what-it-weighs-in-real-time): "of course the system must price and have established fallbacks, but the power of the system relies on things being realtime determined and weighed by how the system was designed"). The engine answers from the most specific level its evidence supports and names the level it used, as `basis_level`:

| Step | `basis_level` | The middle and range come from | The range widens by |
|---|---|---|---|
| 1 | `variant` | the item's own variant's comps | `Q_g` of its group |
| 2 | `product` | the product's comps, adjusted for variant (D2) | `Q_g` of the product-level group |
| 3 | `family` | the family's comps, adjusted (D2) | `Q_g` of the family-level group |
| 4 | `kind` | the kind's pooled sold distribution, condition-adjusted: `family_band` at the category level, at any count | the kind's measured miss at this level |
| 5 | `prior` | D7's retail price times the [M10](../determinations/market-insight.md#m10-depreciation-by-category-and-brand) depreciation step for the kind and age, where a retail price is known | the prior's own stated spread, a `param` per kind |

The steps are a blend, not a ladder of thresholds. At every level, each quantile on log price is `(n_eff × local + k × parent) / (n_eff + k)`, with the parent being the next step down. `k` is a `param` per kind (prior 6, D1's old threshold), refitted nightly by empirical Bayes on the between-level variance, so one more comp moves the answer by its weight's share and never by the gap between levels. The width at each step comes from that step's measured misses, so a thin item reads wider. It never reads as hidden.

The guard hides a number only when even step 5 cannot be stated honestly: no kind is known, or the kind has no sold rows and no retail price. Then the card says "Pricing this..." and runs Deep research. `too_wide` no longer hides. It shows the range with its basis level and count. A bar such as auto-pricing's PPE20 decides only whether the system acts without asking, never whether it prices. It is read on the pooled posterior of the cell's live outcomes (`readPooled`, κ = 20, price band to kind and site, then kind, then all), so a thin cell takes its parent's standing at the weight its own evidence earns. D6's cell minimum of 30 applies to what the backtest report prints as a cell, not to what the live system may do.

D4's "Not enough sales on Depop yet" and D10's "Not enough sales to say how fast" become the same ladder for that site and for the curve. The translated or parent answer is shown with its level named.

## 4. Learning

The written numbers in D1 to D15 are the priors ([real-time weights](../product.md#real-time-weights-agent-proposal)). Every learned value is a row in the param table with a champion and a challenger, guarded to ±50% of its prior and to [0.02, 0.98] for a probability.

| What learns | When | Algorithm | Prior |
|---|---|---|---|
| `alpha_g` and `Q_g` per group | per sale on our listings | the ACI step and the weighted conformal quantile in D6 | alpha 0.2 |
| D10 Kaplan-Meier tables | per sale, end or stale event | append and recount | the parent group |
| D3 index | per sale | an exponentially weighted index per family with a 30-day half-life | 0 drift |
| D1 weights: `w_type` for Best Offer and own orders, the `w_match` levels, the `w_age` half-life per category speed, `w_extract`, the offer discount `d_offer,cat` | nightly | coordinate descent on the D6 objective: minimise the out-of-sample pinball loss of q10, q50 and q90 on the last 90 days of frozen estimates, each weight inside its guard | the D1 numbers |
| D2 condition and size ratios | nightly | the median log ratio over pairs of the same product sold in two conditions, shrunk to the prior with weight `n/(n+20)` | the D2 numbers |
| LightGBM quantile heads | nightly | retrain on the rolling window, with the D6 backtest as the gate | last night's model |
| D10 cure model and isotonic maps | nightly | refit with censored rows | last night's model |
| D4 site ratios | weekly | recount products sold on both sites | the parent category |
| D13 discount `d_s,cat` | nightly | the median of `(ask - sold) / ask` on known pairs | 0 |

**The switch rule.** A nightly challenger replaces the champion when all four hold on the D6 backtest over the last three months (*agent proposal*, the engines lead, 2026-11-15, from the [data-science sweep](../plans/sweep/data-science.md) items 5 and 6; it replaces a rule that a challenger could win by hiding more items, that a calibrated cell failed by chance, and that compared with zero noise):
- the score is the weighted interval score of the 80% range plus the pinball loss at q50 (Gneiting and Raftery 2007; Bracher et al. 2021), on log price, and an item a contestant hides is charged the best baseline's score on that item;
- the by-product paired bootstrap 95% lower bound of the challenger's gain is above 0;
- its hit rate (the share it shows) is not lower than the champion's by more than 2 points;
- no cell's coverage has a Wilson 95% interval lying wholly outside 75% to 85%.

The winner is chosen by refitting both specifications on the training window, and the winner is then refitted on all rows to serve, so the served model has seen the newest quarter. Both fits are logged.

**Rollback.** One UPDATE of `param_version` restores the champion. It fires on its own when, for a group with 30 or more sales in the trailing 30 days, live coverage leaves 75% to 85%, or the q50 error moves 2 SE past its trailing mean. The anomaly check from [real-time weights](../product.md#real-time-weights-agent-proposal) applies to every per-event update.

## 5. Speed

| Moment | Budget | Kept warm |
|---|---|---|
| The rough band | under 2 s (canon) | `family_band` per family and condition |
| The Check, full object | under 10 s (canon) | the embedding index; comp features per product; `Q_g`, `alpha_g`; KM tables; the cure model; fee rows |
| Model inference, steps 6 and 11 | under 100 ms for q10 to q90; under 50 ms for 10 to 20 rungs (D5, D10) | the models in memory |
| A recompute after a sale lands | at most once a minute per product (canon) | debounced per product |
| The keep for a typed price | in the client | the fee rows |

The budget for the Check goes mostly to steps 1 and 2. Comps already extracted for the product are reused; only new rows go to the extractor, in one batched call.

## 6. What the person sees

Examples of the lines on the price card:
- "Most sell for $40 to $61 on eBay, based on 8 sales from Aug 20 to Nov 10."
- "Ranges like this held 8 in 10 sales last quarter."
- "You keep about $32."
- "About 6 in 10 sell within a month at $48."

A tap opens the comps, each with its weight in words ("same model, used, 3 weeks ago"), its link, and the reason any was dropped. The canon phrasing, "Based on N sales from <dates>", is the count line on every number. A not-checked range is drawn wider and says so. A hidden range shows the comps and Deep research.

The person can:
- remove a comp ("Not the same"). This recomputes at once, and the removal is a labelled `w_match` row for the nightly fit;
- add a sale they know of, which carries `w_extract` 0.7 until checked;
- type their own price, and see the keep and the chance of sale for it;
- choose a plan (quick, balanced, max_return; D15);
- drag the price slider, described below.

### The price slider (agent proposal, from [Nate](../../product/words.md#2026-11-14-nate-pricing-weighs-every-platforms-top-listings-official-listings-and-credible-discounts-with-a-slider-and-a-free-note))

Nate: "with a range of lowball to hard to negoitate the user can use a slider to select their preference."

One value, `posture`, from 0 (priced to go: the lowest price a careful buyer would still think fair) to 1 (hard to negotiate: the top of what the market has paid, held firm). The three plans are three marked points on it (quick 0.15, balanced 0.5, max_return 0.85), so the plan choice and the slider are the same control.

| What `posture` sets | At 0 | At 1 |
|---|---|---|
| The suggested ask | the q20 of the sold range, and under the cheapest comparable top listing on that site | the q85, capped by live asks and by the cheapest official price after credible discounts |
| The room left for offers | none: the ask is the price | the learned offer discount for the site and category |
| The [negotiation](negotiation.md) policy | accept at or above the floor at once | counter high, concede slowly, decline low offers without a counter |
| Markdown over time | early and steep | late and shallow |

As the slider moves, the card shows for that point: the ask per site, what the person keeps, the chance of sale within 30 days and the expected days, each from the same curves the plans use, so the person sees the trade and not only a number. The sold prices are drawn on the slider's own track: each recent sale as a tick at its price, with the count and dates beside it, so the person sees what sold prices say about the point they are choosing ([Nate](../../product/words.md#2026-11-14-nate-show-what-sold-prices-say-and-expert-research-sessions-that-first-name-what-must-be-determined): "its probably also helpful to see what sold prices say"). How it is drawn is Ben's. The floor is never crossed at any setting.

How the new signals enter: sold comps still set the value (asks never do). The top listings place the ask among what a buyer sees today on that site. An official price after a credible discount is a ceiling: a used item is not suggested above what the new one costs now, unless the new one is out of stock, and the card says which. A discount that ends raises the ceiling again on its end date, as a `value_moved` notice.

`posture` is stored on the listing (`param` rows learn nothing from it; it is a preference). The slider opens at the middle, 0.5, as the suggested option ([Nate](../../product/words.md#2026-11-14-nate-the-price-slider-defaults-to-the-middle); Ben's agreement not recorded).

## 7. How it beats what exists

| Rival ([parity](../parity.md)) | What it does (mark) | Ours |
|---|---|---|
| The one public tool with a published test ([range-calibration](../../research/price/nate/range-calibration.md) §6) | 75.3% of 81 in a range meant to hold 8 in 10; its own earlier ranges held about half (*observed*; vendor-run, method not sound per [published tests and their flaws](../../research/price/nate/published-price-tests-and-their-flaws.md)) | a stated share only where our own backtest checked it, per group, with counts |
| Phia price label, Croissant sold-data lake ([teardown §4](../../research/watch/nate/teardown-search-and-similar-finders.md#4-phia-beni-encore-croissant), *asserted*) | a label on a listing | sold comps with weights, a calibrated range, a keep per site and a chance of sale |
| PriceCharting outlier rules (*observed*) | keyword rules and flags | the MAD cut on log adjusted price, plus "Not the same" as a learned label |
| Terapeak and 130point accepted Best Offer (*observed (highlight)* and *asserted*) | the real accepted price | the same, read through the person's own session, and the hidden discount learned |
| WatchCharts thin-sales fallback to asks (*observed (highlight)*) | asks stand in for sales | asks cap the range and rank the queue; they never set the value |
| Card Ladder index floor (*observed*) | an eligibility floor and review | `n_eff >= 6` and the D6 states per item |
| An LLM asked for a price (*observed* typical miss of $30 to $43 on $100, via the same vendor page) | one number with no coverage | the model only retrieves and extracts; every price is arithmetic or a checked model |

## 8. Protections

- Retail is never a comp, and live asks never set the value (D1).
- A number is never shown without its count and dates, and never as checked without passing D6.
- `may_model: false` rows never train anything; `rights` are enforced at the read ([databricks](../databricks.md)).
- Text from a listing reaches the extractor as data. Its output is fields with evidence spans; a field without a span is dropped.
- Sales at the seller's ask are scored apart (D6 step 5), and sales priced from our own number are left out of the headline. So the engine never grades itself on its own advice.
- A recalled product gets no price path ([recall card](../determinations/seeing-the-item.md#20-recall-or-safety-flag); [trust](trust.md)).
- No person's data leaves their account in a comp. Pooled rows carry no seller or buyer identity.

## 9. Proof

| Test | Runnable in a day as | Passes when |
|---|---|---|
| The D6 backtest | the six steps in [D6](../determinations/money.md#d6-range-calibration-and-display-state) on a frozen extract of sold rows, by family and price band | every reported cell has coverage between 75% and 85%, and q50 median error no worse than the better baseline |
| Weights against equal weights (the D1 check) | the same backtest with every `w = 1` | the learned weights win on pinball loss overall |
| D10 calibration | held-out listings, with censoring | AUC of at least 0.6 at one week, and calibration within 5 points per bin |
| The rough band | the last 1,000 Checks | the band contains the Check's q50 at least 90% of the time |
| Leakage | the six routes in [range-calibration](../../research/price/nate/range-calibration.md) §7, each seeded into a fixture | each seeded leak is caught by its assertion |
| Determinism | the same inputs and `param_version`, run twice | identical objects to the cent |
| Keep | 50 real payouts per site against D9 | median difference at most $0.25 (the D9 check) |

The result that counts: coverage and q50 median error per cell against the two baselines, with counts and dates, published to the person as "Ranges like this held 8 in 10".

### The backtest on released sold data, and what it may claim

*agent proposal*, the engines lead, 2026-11-15. This is the run behind the [benchmark's](../benchmark.md) row 7. The engine itself is scored: a Python twin of `comps.ts` (`jobs/valuation/comps.py`, parity-tested against the TypeScript on `app/src/engines/valuation/fixtures/comps-parity.json`), as the contestants `engine_comps` (the D5 weighted quantiles) and `engine_comps_conformal` (widened by each group's `Q_g` from earlier months' misses, as D6 and `check.ts` do), in [jobs/valuation/experiment.py](../../jobs/valuation/experiment.py), beside the 90-day product median a seller looks up.

The rows are data the marketplaces released themselves. The terms of the sites' own sold pages bar collecting them in bulk ([sold-datasets.md](../../research/price/ben/sold-datasets.md); Poshmark §4(b), eBay §3 and §10), so no sold page is read to build a test or training set.

| Dataset | What it is | What a number from it may claim |
|---|---|---|
| `dataset:stockx_2019` | 99,956 StockX sales of Off-White x Nike and Yeezy 350, 2017-09-01 to 2019-02-13, new only | pricing deadstock sneakers in 2017 to 2019; the noise floor, since identical pairs in a week sold a median 1.7% apart |
| `dataset:nber_ebay_bo` | eBay Best Offer listings, sold and unsold, 2012-05 to 2013-06, across eBay's categories (Backus, Blake, Larsen and Tadelis 2020, QJE; research use) | pricing used goods on eBay in 2012 to 2013, by category and condition |

Every result names its dataset, the date range of its sales and the families it covers. No sentence built on these says "accuracy on today's market". Families with no released data at all (Depop, Poshmark, Mercari and Facebook sales; furniture; one-off and unbranded items) are listed in the result as a gap, not left out.

Two current sources fill the gap later, both inside the rules. One is the person's own sales read through their linked accounts, frozen before the sale through the `duel-record` and `duel-score` commands in the runner. The other is eBay's official APIs once developer keys exist ([waiting](../plans/waiting.md)), with the API licence's bar on modelling prices respected: such rows are scored against, never fitted on.

### Development reading: the ablation of 2026-11-15

A development reading on `dataset:stockx_2019`, not for a public page or the pitch until Nate and Ben have both seen it. Test sales of 2018-11-01 to 2019-02-13, **41,988 sales**, every contestant on the same items, all basis levels pooled (variant, product and family; this dataset has no kind or prior rows), calibration from 2018-09-01 (10,671 sales). Run on the Mac by `PYTHONPATH=jobs ./.venv/bin/python -m valuation.ablate --rows <stockx rows> --calibrate-from 2018-09-01 --test-from 2018-11-01` (`jobs/valuation/ablate.py`, branch `w/eng-valuation-2`, 2,368 s). Input SHA-256 `02fe1413…028cf` (decompressed). Each lettered row is that one change alone on the engine before; "all" is every change on. Within 20% is PPE20; range holds is the share of sales inside the conformal-widened 80% range, with its Wilson 95% interval; width is the median range width over the middle.

| Contestant | Priced | Median error | Within 20% | Range holds | Width |
|---|---|---|---|---|---|
| engine before (served at the stop) | 99.1% | 6.25% | 87.1% | 85.7% | 27.7% |
| A: the anchor (the variant's last K sales, time-adjusted) | 99.1% | 4.48% | 91.6% | 87.8% | 21.8% |
| B: a per-family D3 index | 99.1% | 6.22% | 91.0% | 90.5% | 31.9% |
| C: fitted size ratios | 99.0% | 6.25% | 87.3% | 85.9% | 27.7% |
| D: the age half-life per family (30 or 90 days, chosen on calibration sales) | 99.2% | 5.33% | 92.5% | 84.7% | 24.5% |
| E: the fallback blend (§3) | 100% | 6.32% | 87.6% | 84.7% | 28.7% |
| F: one unit per physical item | 99.1% | 6.25% | 87.1% | 85.7% | 27.7% |
| **all on** | **100%** | **3.89%** | **96.0%** | **86.0% (85.6 to 86.3)** | **22.7%** |
| last sale | 98.7% | 3.25% | 97.4% | 79.8% | 14.5% |
| product 90-day median | 98.5% | 5.76% | 89.1% | 82.7% | 27.2% |
| market model, product-anchored (`market.py`) | 94.6% | 3.29% | 98.5% | 79.2% | 13.6% |

Paired on the items both priced, by product-blocked bootstrap: all-on against last sale, within 20% −1.0 points (95% −1.4 to −0.7), median error 3.85% against 3.25% on 41,452 items; against the 90-day median, +7.4 points (5.7 to 9.0), 3.83% against 5.76% on 41,350.

What it says. The anchor bought most of the gain, the per-family half-life the next. The index widened the range without moving the middle. Size ratios and one unit per item did nothing here: the dataset's product id includes the size, and nothing is cross-posted. The blend's effect is that every item is priced. The all-on engine beats the 90-day median a seller looks up and still trails last sale by a point, so the answer carries the last sale beside the range (the adaptation lead's C1, [credibility.md](credibility.md)). The range over-covers: 86.0% against the 80% it states, with its Wilson interval wholly above 85%, so D6's cell rule would not call it checked. That is a named fix below, not a reason to hold the merge; the engine before over-covered as much.

Named fixes from this reading, each judged by a rerun of the same command on the same items:
- **V-AB1, the range over-covers.** Measure: overall coverage inside 75% to 85% with its Wilson interval, width at most 22.7%. Likely cause: the calibration groups pool scores across basis levels, and the anchor's tighter middle is widened by misses from before it existed; group by basis level as well (science audit (a)) and recalibrate on the anchored engine's own misses.
- **V-AB2, close the last point to last sale.** Measure: paired within-20% difference against last sale with its lower bound above 0. Candidates in order: the anchor's K and its weight `k_anchor` refitted per family, then blending the product-anchored market model as a contestant level.

The fixed set: 100 real items, frozen with their sale prices and dates, spread over the price bands and over eBay, Poshmark, Depop, Mercari and Facebook, kept out of every fit.

Rerun on 2026-11-15 after EN1 landed (5d7f61f1): the same command on the same input reproduced every row above to the digit. It ran 2,404 s and kept the last-sale gap at −1.0 points (−1.4 to −0.7) on 41,452.

### Real-time market scores

Nate asked for this ([words](../../product/words.md#2026-11-15-nate-apify-rows-may-fit-the-models-real-time-scores-per-market-on-each-platform-extremely-accurate)): "realtime score metrics generated and assigned to each market within a specific platfrom", extremely accurate, to show depth and credibility. *Agent proposal* for the design below; it is not built yet.

**A market** is one platform and one kind of item (`site × kind`, for example Depop × jacket). A family or brand cell under it is reported only when it has its own events.

**A scored event** is a sold row the system reads for the first time, on any site. It is scored before it can enter any basis (prequential scoring, so the score never sees its own answer):
1. Freeze: run `valuate` for that product at `as_of` = the row's sale time minus one second, from observations strictly older than the sale. The row itself, its listing cluster (switch F) and anything read after it are excluded.
2. Record: the frozen q10, q50 and q90, the sale price, the basis level and the citation. Then compute the absolute percent error |q50 − price| / price, whether the price is within 20% of q50, whether the price falls inside [q10, q90], and the width (q90 − q10) / q50.
3. Score the two baselines on the same event: the product's last sale before the event, and its 90-day median. The comparison is always paired.
4. Then add the row to observations as usual.
Each comp_id is scored once. A row with no sale date (a listing date standing in) is not scored, and the market counts it as `unscored_no_sale_date`. Scoring is not fitting, so every sold row is scored, whatever its `may_model`. eBay and Dupe rows included: eBay's terms bar fitting, not measuring, and a Dupe row's score is kept as an aggregate only.

**Per market** (a `market_score` row in the registry, scope `{site, kind}`), updated on each event in the same transaction:
- `n` events;
- the within-20% rate with its Wilson 95% interval;
- the median absolute percent error over a rolling window, with a bootstrap interval nightly;
- range coverage (the share inside [q10, q90]) against the 80% stated, with its Wilson interval;
- median width;
- the paired gaps against last sale and the 90-day median, each with an interval;
- the share of events priced;
- the newest event time.
A decayed copy (half-life `market_score_half_life_days`, prior 30) shows the market now. The undecayed copy shows it over all time. Every figure carries its `n` and its interval.

**State**: `checked` when n ≥ 30 and both Wilson intervals are known. Below that the score is still shown, with its n, as `not_checked_yet`, because the system always answers. A threshold never hides it.

**Served**: `GET /v1/scores?subject_type=market&site=&kind=` returns each figure with a citation that resolves to the scored events (the event ids, never the raw rows of a source that forbids storing). The dashboard and Genie read the same rows. No figure goes on a public page or the pitch until Nate and Ben have both seen it.

**Proof**:
- The scorer is the ablation's scorer, so it is defined once: the Python `ablate.py` metrics and the TypeScript scorer share a parity fixture.
- A replay of the StockX 2019 test window, run event by event through the online scorer, gives the same within-20%, median error and coverage as the ablation's "all on" row, within rounding.
- A test that an event's own row, its cluster, or a later row never enters its frozen basis.

## 10. Build tasks

The paths are proposed. Tasks 1, 2, 3 and 4 run in parallel; 5 needs 1 to 4; 6 needs 5.

| # | Task | Owned files | Depends on | Proof command |
|---|---|---|---|---|
| 1 | D1 to D4 arithmetic: weights, back-off, adjustment, outliers, translation | `app/src/engines/valuation/comps.ts`, `comps.test.ts` | none | `node --test app/src/engines/valuation/comps.test.ts` (the worked example below as a fixture) |
| 2 | D9 keep in cents, and D12 to D15 | `app/src/engines/valuation/keep.ts`, `path.ts`, `keep.test.ts` | none | `node --test app/src/engines/valuation/keep.test.ts` |
| 3 | The backtest harness with the leakage fixtures | `jobs/valuation/backtest.py`, `jobs/valuation/test_backtest.py` | none | `python -m pytest jobs/valuation/test_backtest.py` |
| 4 | `family_band`, kept warm on sale events | `app/src/engines/valuation/fast.ts`, `fast.test.ts` | none | `node --test app/src/engines/valuation/fast.test.ts` |
| 5 | Nightly fits: LightGBM heads, the cure model, conformal, the D1 weight fit; the switch rule | `jobs/valuation/fit.py`, `jobs/valuation/test_fit.py` | 1, 2, 3, 4 | `python -m pytest jobs/valuation/test_fit.py` |
| 6 | The `valuation` object assembled in the Check, with the 10 s budget | `app/src/engines/valuation/check.ts`, `check.test.ts` | 5 | `node --test app/src/engines/valuation/check.test.ts` |

## Worked example

All numbers here are examples.

**The first pass.** A used jacket. Six comps from the same variant:

| Price | 42 | 45 | 48 | 50 | 55 | 60 |
|---|---|---|---|---|---|---|
| w | 0.9 | 0.7 | 1.0 | 0.8 | 0.6 | 0.5 |

`Σw = 4.5`, `Σw² = 3.55`, so `n_eff = 20.25 / 3.55 = 5.70`. That is under 6, so the engine backs off to the family.

**After back-off.** Two family comps join at 46 and 52, each with `w = 0.25`. Now `Σw = 5.0`, `Σw² = 3.675` and `n_eff = 6.80`, which passes.

**The range.** The weighted median is 48: the cumulative weight reaches 2.5 at that comp. Say the model gives q10 43, q50 48 and q90 58, and the group's `Q_g` is 3. The range is then 40 to 61, which is not too wide (21 < 48). The group is checked at 83%, so the share shown is "8 in 10".

**On eBay.** Free shipping costs the seller $9. The fee is taken on the item price only, for this example, so keep(48) = 0.864 x 48 - 0.40 - 9 = $32.07. D10 gives a 0.62 chance of sale within 30 days at $48, and t25, t50 and t75 of 4, 11 and 26 days. The person reads "Most sell for $40 to $61, based on 8 sales" and "You keep about $32".
