# Platform analytics engine

*agent proposal*, the whole file. Written 2026-11-14.

Nate asked for "analytics per platform, tracking and giving data on which storefront is doing the best", and for engines that "weigh to calculate claims more effectively than the rest" ([words](../../product/words.md#2026-11-14-nate-analytics-per-platform-engines-that-out-calculate-the-rest-a-parallel-build-plan-and-validated-claims)). This engine reads each site's stats through `read_stats`, builds the funnel per listing and per site, measures what the person keeps and how fast each site sells, compares sites fairly for the items actually listed on each, and feeds the result into where the next item goes ([money D12](../determinations/money.md#d12-best-site-or-set-of-sites)). It extends the [analytics suite](../features/insights.md#analytics-suite-agent-proposal) and Ben's By site ([decision](../../product/decisions.md#2026-11-14-the-you-tab-leads-with-numbers-and-a-by-site-comparison)); every figure is a [guarded number](../features/insights.md#each-guarded-number).

## 1. What it decides

| Output | Where it lands |
|---|---|
| The stats of each listing per day, in the stages the site defines (new name `listing_stat`, a typed view over `observation` kind `stats`, like `comp` and `rank_observation` in [product §3](../product.md#3-the-data-model)) | the funnel, [listing D15](../determinations/listing-and-marketing.md#d15-interest-against-plan) |
| The funnel per listing and per site: impressions, views, likes or watchers, offers, sale, each with the site's own definition | the item card's Per site, You's By site |
| Per site, from the person's own sales: kept per sold item, days to sell, sell-through ([M6](../determinations/market-insight.md#m6-sell-through)) and share of asking ([money D23](../determinations/money.md#d23-sell-through-and-share-of-asking)) | By site, raw and labelled as raw |
| The fair comparison: each site's effect for this person on the chance of sale and on the price reached, per category, with intervals, as `param` rows `site_effect.sale` and `site_effect.price` scoped site, category and person | By site's "Best for you", and D12 |
| The verdict per category: a best site, or "too close to call" | By site, the Sell plan's reason line |
| The adjusted `P_j` and `keep_j` that D12 reads, and an add-only exploration site | the Sell plan |
| The site's own figure beside ours, and a flag when they disagree | By site, seller reliability ([managing 17](../determinations/managing-and-buyers.md#17-whether-an-account-is-healthy-or-at-risk)) |
| Promotion return per site | [money D33](../determinations/money.md#d33-promotion-return) reads the funnel from here |

## 2. Signals

| Signal | Row | Per site | Evidence |
|---|---|---|---|
| Listing stats | `read_stats` in `poll_stats` ([product §4 job kinds](../product.md#job-kinds)), written as `observation` kind `stats` | eBay `getTrafficReport` by LISTING and DAY: impressions (search, store, total), views by source, click-through, sales conversion; Poshmark listing details: impressions, clicks, likes, seller and buyer offers, days listed; Depop: likes_count, bag_count, boosted clicks and impressions while boosted; Mercari: views and likes from the listing page; Facebook: nothing | eBay and Poshmark *observed*, Depop and Mercari *asserted* ([Shopify and seller analytics §2](../../research/data/nate/shopify-analytics-and-seller-analytics.md#2-used-goods-marketplaces-what-the-seller-sees)) |
| Our own interest | `offer`, `message` | every site we read, with "since you linked" | ours |
| Outcomes | `order` money lines (sale, fees by type, shipping, promotion spend, refund, payout), `listing` events (posted, revised, price change, ended) | all | ours |
| The item and its price | `item` category, brand, condition; `valuation` fair range per site at each ask | all | [money D5](../determinations/money.md#d5-fair-value-range-overall-and-per-site) |
| The market's expectation | D10's chance of sale per site at the ask, fitted on every listing the protocol reads ([real-time weights](../product.md#real-time-weights-agent-proposal)) | all | [money D10](../determinations/money.md#d10-chance-of-sale-within-a-period-at-a-price) |
| The site's own seller figures | Posh Stats (ship time, cancellation rate, returns, 90 days), eBay sales conversion, Depop shop stats | as published | *observed* (§2 of the same note) |
| Ranking changes | `notice` `ranker_changed` | all panels | [listing D24](../determinations/listing-and-marketing.md#d24-whether-a-site-changed-its-ranking) |
| Tests | `experiment`, `arm` | consenting people | [listing D22](../determinations/listing-and-marketing.md#d22-test-design-for-a-change) |

## 3. The calculation

1. **Normalise** (rules). Each site's payload maps to the stages it defines, and the row keeps the site's own name and definition (Poshmark "clicks" stay clicks, never relabelled as views). A stage the site does not report is null, shown "not reported by <site>", never zero. Cumulative counters become daily deltas; a counter that goes down is a site reset, recorded, and that day is dropped. Depop's boosted counts are marked boosted-only.
2. **Funnel per listing** (arithmetic). Stage totals to date, per-day rates, the furthest stage reached, days listed. Interest against plan stays D15's.
3. **Funnel per site** (arithmetic). Sums over the person's listings on one site. Across sites only stages with one definition are set side by side: our offers, our messages, sales. Views and likes from different sites sit in their own columns and are never added.
4. **Kept and speed per site** (arithmetic). Kept per sold item = payout less the label we paid and the promotion spend on that listing, from the money lines ([D9](../determinations/money.md#d9-what-you-keep-per-site) for any line not yet reported, marked estimated). Days to sell = first post on that site to the sale ([D11](../determinations/money.md#d11-time-to-sell-range), [M7](../determinations/market-insight.md#m7-days-to-sell)). Sell-through and share of asking are D23's, an item counted once however many sites it was on. This is the raw By site row.
5. **Exposure, censored** (arithmetic). Each listing contributes the days it was live on that site, ending at its sale, its end, or a sale of the same item on another site (censored there, never counted unsold, as D23 already rules). `E_s` = the sum over the person's listings on site s of D10's cumulative hazard over those days at each day's ask. `O_s` = the sales on s.
6. **Sale effect** (a model: Gamma-Poisson shrinkage on observed over expected). `r_s ~ Gamma(O_s + m, E_s + m)` per category, mean `(O_s + m) / (E_s + m)`; `m` starts at 5. Because `E_s` already holds the item, its price against fair and the site's market rate, `r_s` is how this person's listings on s do against what the market predicts for those same items. The chance of sale in 30 days on s becomes `P'_s = 1 - (1 - P_s)^(r_s)` (proportional hazards).
7. **Price effect** (a model: normal-normal shrinkage). Per sold item `u = log(sold price / fair p50)` less the market's mean of the same on that site and category. `g_s = n x mean(u) / (n + m_g)`, SE `sigma / sqrt(n + m_g)`, `m_g` starts at 5, `sigma` the pooled spread. The expected price on s is `fair p50 x exp(market mean_s + g_s)`, and `keep_s` is D9 at that price, so fees stay fixed arithmetic.
8. **Value per listed item** (arithmetic, 1,000 seeded draws). For the person's reference item in the category (the median fair p50 of their items there): `V_s = P'_s(30) x keep_s`, drawn from both posteriors. `P(best_s)` = the share of draws in which s has the highest `V`.
9. **Verdict** (rules). "Best for you" when `P(best) >= 0.9` and the site has at least 5 of the person's ended listings in the category; else "too close to call", naming the sites within reach. Both thresholds are `param` rows.
10. **Cross-listed check** (arithmetic). For items live on two sites at once for 7 days or more, count which site sold first. These pairs share every control by construction; a sign test against the model's direction at below 0.1 raises an `anomaly` for review.
11. **Feedback to D12** (arithmetic plus Thompson sampling). D12 reads `P'_j` and `keep_j` from steps 6 and 7. One posterior draw per item runs D12's greedy rule again; a site this draw adds that the mean pick left out is an exploration site, added only, never replacing a site the mean pick chose, and only while the person's share of items with an exploration site is under 0.2.
12. **Holdout** (rules). D12's check later (pick only against every eligible site) runs as an `experiment` with factor `site_set`, only for people with `experiments_consent` and through a `join_experiment` decision, inside their price floor; D23 gives its verdict.
13. **Beside the site's own figure** (rules). Where a site publishes a figure we also compute, both are shown with both definitions; a gap over 10 points opens a data-quality flag on our count, D23's check later made standing.

## 4. Learning

The machinery is the shared [real-time weights](../features/data.md#real-time-weights-agent-proposal).

- **Prior**: no site effect (`r_s = 1`, `g_s = 0`), so a new person gets D10 and D5 as the market has them; `m = 5`, `m_g = 5`, verdict 0.9, exploration share 0.2.
- **Per event**: a sale adds 1 to `O_s` and its `u` to the price effect; a sale, end or cross-site sale adds the listing's hazard to `E_s`; all in the order's or listing's transaction. Half-life of old evidence 90 days, a `param` row; longer than the shared default of about 30 days because one person ends a few listings a month.
- **Hourly**: new `stats` observations fold into the funnel rollups; cross-listed pairs update.
- **Nightly** (`param_fold`): `m` and `m_g` per category are refit by maximising the marginal likelihood across consenting people (aggregates above D1's basis, eBay rows never, per the open line in [product §9](../product.md#9-open-for-ben-and-nate)); the calibration of `P'_s` is scored on the last 30 days of ended listings.
- **Switching**: a challenger `m` replaces the champion when its log loss on the last 30 days of ended listings beats the champion by more than the 1,000-draw bootstrap noise, with at least 300 ended listings in the category; below that the category reads its parent (all categories), and below that the prior.
- **Guards**: `r_s` stays within 0.33 to 3; a move over 2 SE raises an `anomaly`; a `ranker_changed` notice hides that site's view-based stages from comparison until it clears, while sales still count.
- **Rollback**: one UPDATE restores the previous `m`; a person's `O_s`, `E_s` and `u` recompute from orders and listing events in seconds.

## 5. Speed

| Moment | Budget | Kept warm | On the event |
|---|---|---|---|
| `poll_stats` per person and site | once a day, paced by the route; eBay one report call for all listings | the last delta per listing | append `observation` |
| A sale or end | effect update under 20 ms | `O_s`, `E_s`, price sums per scope | in the transaction |
| Item card funnel | under 150 ms | the listing's rollup | read only |
| By site with the verdict | under 300 ms, 1,000 draws | person scope rows | arithmetic |
| D12 reading the effect | under 20 ms | the 60 s `param` cache | arithmetic |
| Nightly fold | under 20 minutes | Delta rollups | `param_fold` |

## 6. What the person sees

- By site, one row per site: "Kept $412 from 9 sales", "Sold in 6 to 14 days", "At 88% of asking". Below the rows: "Best for you for jackets: Poshmark" or "Jackets: Poshmark and eBay too close to call". The tap shows the counts, "compared on the same kinds of item at the same prices", and the items that were on both ("7 jackets were on both: 4 sold on Poshmark first, 2 on eBay").
- The item card per site: "Poshmark: 312 impressions, 41 clicks, 9 likes, 2 offers. eBay: 120 views, 3 watchers. Facebook: not reported by Facebook; 4 messages we saw."
- Beside the site's figure: "Posh Stats: ships in 1.8 days. We saw 1.9 days over 11 orders."
- On the Sell plan: "Adding Depop: your jackets have sold there 2 in 3 times." An exploration site says so: "Also trying Mercari: too few of your sales there to know yet."
- Below 5 ended listings on a site: the raw row only, and "too few sales to compare yet".

## 7. How it beats what exists

As strong as [Shopify and seller analytics](../../research/data/nate/shopify-analytics-and-seller-analytics.md) §2 (sites, mostly *observed*) and [§3](../../research/data/nate/shopify-analytics-and-seller-analytics.md#3-crosslisters-and-resale-bookkeeping) (crosslisters, all *asserted*, their pages unopened) record, with [parity](../parity.md#analytics).

| Rival | What it does | Ours |
|---|---|---|
| eBay Seller Hub traffic report | impressions, views by source, click-through, conversion, eBay only (*observed*) | the same beside every other site, with kept and speed |
| eBay Product research (Terapeak) | the market's eBay sales, sell-through, prices (*observed*) | the person's own results per site, against what the market predicts for their items |
| Poshmark listing details and Posh Stats | per-listing impressions, clicks, likes, offers; ship time, cancels, returns (*observed*) | shown beside ours, with both definitions |
| Depop shop stats | sales, potential earnings; visibility stats only while boosted (*observed*) | likes and bag counts every day, boosted days marked |
| Etsy Stats | the nearest to Shopify, for one shop (*observed*) | across sites, redefined for one-of-a-kind items |
| Vendoo, Nifty, List Perfectly, Resylr | profit, revenue and breakdown by marketplace (*asserted*) | the breakdown, and a comparison that controls for what was listed where |
| Shopify analytics | sessions, conversion, order value for many units of one SKU (*observed*) | each metric carried over, redefined or dropped per the [suite table](../features/insights.md#analytics-suite-agent-proposal) |

No rival is recorded as controlling for the mix of items on each site, censoring a cross-listed item when it sells elsewhere, or feeding the comparison into where the next item is listed. A by-site claim here is said only when it clears `P(best) >= 0.9`, and opens to the items it rests on.

## 8. Protections

- Stages are never summed across sites whose definitions differ; an unreported stage is never zero.
- Comparisons use only the person's own sales, as [insights](../features/insights.md#design-choices-agent-proposal) set; pooled values shape the prior and are never shown as other sellers' figures.
- Pooling is opt-in aggregates above D1's basis; eBay rows are never pooled.
- Exploration only adds a site, is capped, and says so; a holdout needs consent and a `join_experiment` decision, inside the floor.
- `poll_stats` follows each site's route and pacing in [harnesses](../product.md#harnesses); an adapter version bump sets `frozen` on that site's rows.
- Fees, the floor and never relisting on Poshmark stay fixed; the engine changes no listing, it informs D12, whose plan the person approves.
- Estimated money lines are shown marked; notices follow [managing 20](../determinations/managing-and-buyers.md#20-what-to-notify-now-in-a-batch-or-not-at-all).

## 9. Proof

The fixed set: the team's own accounts, frozen as one table version: 150 real ended listings across eBay, Poshmark, Depop, Mercari and Facebook, 40 of them cross-listed, with their orders and money lines, and one captured `read_stats` payload per site per day for 14 days. Each test runs in a day.

| Test | Passes when |
|---|---|
| 1 Normalise | every site fixture maps to its stages with its definition; unreported stages are null; a counter reset drops the day |
| 2 Never summed | the cross-site metric view refuses a sum of views or likes across sites |
| 3 Censoring | an item sold on one site leaves its other listings censored, absent from unsold and from `O` |
| 4 Mix control (the result that counts) | on 100 seeded simulations where one site gets the expensive items and sells slower only because of price, the raw row ranks it worse and the fair comparison's 90% interval covers the planted effect in at least 85; on the fixed set, `P'_s` beats D10 alone on log loss for the held-out last 30 days, a bootstrap 90% interval above 0 |
| 5 Feedback | a planted effect moves D12's pick; exploration never removes a mean-pick site and stays under its cap |
| 6 Beside | our ship time and cancel rate match Posh Stats on the team's accounts within 10 points |
| 7 Speed | By site under 300 ms at p95 |

## 10. Build tasks

Code under `jobs/analytics/`, each task in the [task shape](../plans/README.md#2-the-task-shape) when planned; all build in parallel against the frozen fixture.

| Task | Owns | Depends on | Proves with |
|---|---|---|---|
| pa-1 Normalise each site's `read_stats` payload into `listing_stat` | `normalise.py`, `fixtures/stats/`, `test_normalise.py` | none | `python -m pytest jobs/analytics/test_normalise.py` |
| pa-2 Funnel per listing and per site, kept and speed, the metric views | `funnel.py`, `views.sql`, `test_funnel.py` | pa-1 interface | `python -m pytest jobs/analytics/test_funnel.py` |
| pa-3 Exposure with censoring, sale and price effects, value draws, verdict, cross-listed check | `site_effect.py`, `test_site_effect.py` | the frozen order fixture | `python -m pytest jobs/analytics/test_site_effect.py` |
| pa-4 Feedback to D12, add-only exploration, the `site_set` holdout | `placement.py`, `test_placement.py` | pa-3 interface | `python -m pytest jobs/analytics/test_placement.py` |
| pa-5 Beside the site's figure, data-quality flag, anomaly hooks | `beside.py`, `test_beside.py` | pa-1 interface | `python -m pytest jobs/analytics/test_beside.py` |
| pa-6 Learning: per-event updates, nightly refit, promote, rollback, guards | `learn.py`, `test_learn.py` | pa-3 interface | `python -m pytest jobs/analytics/test_learn.py` |
| pa-7 The fixed set and the simulated mix set | `proof/`, `test_proof.py` | pa-1 to pa-6 | `python -m pytest jobs/analytics/test_proof.py` |

## Worked example

All numbers are examples.

A person listed 10 jackets on eBay and 10 on Poshmark over three months. Raw: eBay sold 6, Poshmark 4, so the raw row makes eBay look better. But their eBay jackets were asked at 0.9 of fair and the Poshmark ones at 1.15, so D10 expected fewer Poshmark sales: `E_eBay = 5.0`, `E_Posh = 2.5` after censoring the 3 that sold on the other site.

Sale effect with `m = 5`: eBay `(6 + 5) / (5 + 5) = 1.10`; Poshmark `(4 + 5) / (2.5 + 5) = 1.20`. For the next jacket D10 gives `P_eBay = 0.45` and `P_Posh = 0.40` at 30 days, so `P'_eBay = 1 - 0.55^1.10 = 0.48` and `P'_Posh = 1 - 0.60^1.20 = 0.46`.

Price effect on a $60 reference jacket: Poshmark's market mean of log sold over fair is -0.10 and this person's `g = +0.03`, so about $56 and `keep = $44.70` by D9; eBay's market mean is -0.15 and `g = 0`, so about $52 and `keep = $41.00`. `V_Posh = 0.46 x 44.70 = $20.6`, `V_eBay = 0.48 x 41.00 = $19.7`.

Over 1,000 draws Poshmark is best in 61%, under 0.9, so By site says "Jackets: Poshmark and eBay too close to call", and D12 keeps both because each adds gain. Of the 7 jackets that were on both, 4 sold on Poshmark first and 2 on eBay, in line with the model, so no flag.
