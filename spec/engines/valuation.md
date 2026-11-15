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

A row with `may_model: false` (eBay rows, per [data use](../data-use.md)) can be shown and cited as a comp. It is never used to fit a weight, a model or a calibration score.

## 3. The calculation

| Step | Card | Model or arithmetic |
|---|---|---|
| 1. Retrieve candidates: product id match, then embedding nearest neighbours on image and title within the category | D1 | model (the embedding index; deterministic at query) |
| 2. Extract the variant, condition, size and defects of each candidate | D1 | model (Claude Haiku, structured output, evidence span per field; `w_extract` 0.7 for its fields) |
| 3. Weight: `w = w_type x w_match x w_age x w_extract`; drop junk; back off one level while `n_eff < 6` | D1 | arithmetic, with learned values (§4) |
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

**When nothing qualifies:** the states in the cards stand: `too_few`, `too_wide`, D4's "Not enough sales on Depop yet", and D10's "Not enough sales to say how fast". Each still shows the comps found and their count.

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

**The switch rule.** A nightly challenger replaces the champion when all three hold on the D6 backtest over the last three months:
- every reported cell passes D6, with coverage between 75% and 85%;
- overall q50 median error improves by at least 1 percentage point;
- no cell's q50 median error gets worse by more than 2 points.

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

The fixed set: 100 real items, frozen with their sale prices and dates, spread over the price bands and over eBay, Poshmark, Depop, Mercari and Facebook, kept out of every fit.

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
