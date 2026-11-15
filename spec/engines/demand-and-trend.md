# Demand and trend engine

*agent proposal*, the whole file. Written 2026-11-14.

How much people want a product, a family, an attribute or a category now, which way that is moving, and what is likely over the next weeks, always as a range. It gathers the market cards [M8](../determinations/market-insight.md#m8-demand-and-whether-it-is-rising) to [M16](../determinations/market-insight.md#m16-how-new-retail-releases-relate-to-used-supply-and-price) into one engine with one learning loop, and adds the forecast those cards do not make. The research behind it is [market intelligence](../../research/data/nate/market-intelligence.md#23-search-and-social-signals) and [port, swarm and forecasting](../../research/data/nate/port-swarm-and-forecasting.md#sub-question-2-forecasting-with-language-models).

## 1. What it decides

| Output | Subject | Consumed by |
|---|---|---|
| Sold velocity: sales per week with a p10 to p90 range, per site and across sites | product, family, attribute, category | price ([money D10](../determinations/money.md#d10-chance-of-sale-within-a-period-at-a-price), [D11](../determinations/money.md#d11-time-to-sell-range)), platform-analytics (the expected rate a site is judged against) |
| Demand index `D` and direction: rising, falling, steady or hidden | product, attribute, category | market, the marketing engine ([listing D16](../determinations/listing-and-marketing.md#d16-next-move-on-a-live-listing)), recommendation-and-style ("what to sell now") |
| Forecast for 4, 8 and 12 weeks: sales count and median sold price, each p10, p50, p90 | product, family, category | price (sell now or wait, [money D15](../determinations/money.md#d15-markdown-path-stale-and-relist)), research, the score's trend axis ([score](../features/score.md)) |
| Event effects: a coming release, restock or season, with its expected effect and range | product and its `predecessor_id` | price, alerts, research |
| Alerts on owned and followed items | the `demand_rose` and `value_moved` notices, timed by [managing 20](../determinations/managing-and-buyers.md#20-what-to-notify-now-in-a-batch-or-not-at-all) under the [M19](../determinations/market-insight.md#m19-when-a-followed-product-has-moved-enough-to-tell-its-follower) gate | the person |

Every output is a guarded number written as a `score` row on the trend axis or a `forecast` row (new, prefix `fc_`: subject, horizon_weeks, metric, p10, p50, p90, basis_count, param_versions, model_version, as_of, resolved_value?), so a forecast is later scored against what happened.

## 2. Signals

| Signal | Source | Freshness | Start weight in `D` |
|---|---|---|---|
| Sold count, one per `cluster_id`, lots counted in the family only | `comp` rows with `price_type` sold, from `market_refresh` and `search` ([M5](../determinations/market-insight.md#m5-how-many-sold-in-a-period)) | per refresh; daily for followed products | 0.40 |
| Turnover: sold per live listing | sold count over `product_snapshot.listed_count` ([M4](../determinations/market-insight.md#m4-how-many-are-for-sale-now)) | daily | 0.20 |
| Watchers, likes, views, offers on market listings | comp fields where a site exposes them (eBay `watchCount`, Depop likes) | per refresh | 0.15 |
| Search interest | Google Trends API, consistently scaled | weekly per followed product | 0.15 |
| Offers and messages on our people's listings | `offer` and `message` counts, pooled as counts only | per event | 0.10 |
| Early open-web signals: Pinterest and TikTok trend boards, forum and social mentions found by the search route | the [source router](../features/data.md#source-registry-and-router-agent-proposal), read weekly per category | weekly | 0 until it earns weight (section 4) |
| Release calendars and successors | [M2](../determinations/market-insight.md#m2-retail-price-and-release-date) dates, `retail_offer` restocks, `product.predecessor_id`; sneaker calendars per [market intelligence 1.10](../../research/data/nate/market-intelligence.md#110-release-calendars-and-retail-prices-for-sneakers-and-streetwear) | daily | an event term, not part of `D` |
| Seasonality | [M12](../determinations/market-insight.md#m12-seasonality) factors per category | monthly | a multiplier, not part of `D` |
| Age and hype | [M9](../determinations/market-insight.md#m9-hype-resale-premium-from-release-and-its-decay) decay, [M10](../determinations/market-insight.md#m10-depreciation-by-category-and-brand) curves, [M11](../determinations/market-insight.md#m11-price-retention-of-one-product) | weekly, monthly | price forecast terms |

A signal from a site whose adapter version changed in the last 7 days is read but frozen (section 4).

## 3. The calculation

1. **Counts** (arithmetic). Weekly counts per product and site from the comps, deduplicated by `cluster_id` from [identity](identity.md). Watchers and likes per listing are capped at the kind's 99th percentile, so one viral listing or a bot does not move a product.
2. **Velocity** (a statistical model, conjugate). Weekly sales of product `p` are Poisson with rate `lambda_p x season_m`. The rate's prior is Gamma(`a_kind`, `b_kind`), the kind's pooled rate held at 2 weeks of weight, read through the parent scope when the kind is thin. Each week's sales `n` over exposure `t` give Gamma(`a + n`, `b + t`), with weekly forgetting so data 8 weeks old counts half. The range is the Gamma's p10 and p90; a count forecast is the Gamma-Poisson (negative binomial) predictive.
3. **Direction** (arithmetic and a test). `D` is M8's `sum w_k r_k / sum w_k` over present signals, weights from `param`. Rising needs M8's rule (`D >= 0.15` and M15's test on the sold count, on 2 weekly reads). Attributes and categories use [M15](../determinations/market-insight.md#m15-what-is-trending-and-how-a-trend-is-told-from-noise) directly, with the category tide removed and Benjamini-Hochberg at 5%. A riser whose listings rose faster than its sales is "more for sale", not rising.
4. **Count forecast** (arithmetic over the model). For horizon `h` weeks: the negative binomial with mean `lambda_p x sum of season_m over the weeks x exp(beta_D x D) x release_effect`, where `beta_D` is a learned `param` (start 0.5) and `release_effect` is the category's [M16](../determinations/market-insight.md#m16-how-new-retail-releases-relate-to-used-supply-and-price) median for a predecessor whose successor lands inside the horizon, else 1. Its p10 to p90 is widened by the kind's coverage factor `k_cov` (section 4).
5. **Price forecast** (arithmetic). `p50_now` from [M3](../determinations/market-insight.md#m3-used-price-per-site-over-time) at band `good`, times the M10 curve step from today's age to the horizon's age, times the M9 decay to the horizon for products in their first two years where M9 fitted, times M16's price effect when a successor lands. The range comes from 500 seeded bootstrap draws over the comps and each term's own range.
6. **Classical challenger** (a model). Where a product or category has 104 weeks or more, `ai_forecast` fits the weekly series with its bounds. It is a challenger in the nightly backtest and replaces step 4 for that scope only when it wins (section 4).
7. **Language-model ensemble** (a model, research only). For a research question with a yes or no answer and a date ("Will used p50 of this model be under $200 by June?"), the forecasting-tools loop runs 5 independent gateway calls, each reading the cited comps and series from Delta, and aggregates by the geometric mean of log odds. It is shown only as a range across the 5 with its own track record (Brier score and count of resolved questions) beside the arithmetic answer, and it never feeds price or alerts. The evidence is that such a crowd matches a human crowd (Brier 0.20 against 0.19) and trails experts, so it is a second opinion, never the number.

## 4. Learning

The machinery is the shared [real-time weights](../features/data.md#real-time-weights-agent-proposal).

- **Prior**: the `D` weights are M8's card values; the Gamma prior is the kind's pooled rate; `beta_D` 0.5 and `k_cov` 1.0 are start values; a new signal (the open-web row) starts at weight 0.
- **Per event**: a sold comp adds 1 to its product's Gamma `a` in the transaction that writes the comp; an offer or a message on a person's listing updates that product's offer count. A new forecast row is written only when its p50 moves by more than 10% (start), so readers see a stable number.
- **Hourly**: products with new events since the last hour get `D` and direction recomputed from `product_snapshot`; that is when `demand_rose` can fire, still behind M8's 2-read rule.
- **Nightly** (`param_fold`, per kind):
  - Each forecast whose horizon ended is resolved: `resolved_value` is written and scored by pinball loss at p10, p50 and p90.
  - The `D` weights are refit as non-negative least squares of the next 28 days' `ln` sold-rate change on the `r_k`, normalised to sum to 1, and written as a challenger. A signal at weight 0 earns weight only through this fit.
  - `k_cov` is set so the last 200 resolved forecasts have 80% inside p10 to p90 (a split-conformal scale).
  - The `ai_forecast` challenger and step 4 are backtested on the same resolved set.
- **Switching**: a challenger is promoted when its pinball loss on the last 12 weeks of resolved forecasts beats the champion's by more than the 1,000-draw bootstrap noise, and the kind has at least 300 resolved product-windows; below that the kind reads its family's champion.
- **Guards**: weights stay within ±50% of their prior except a signal that started at 0, which is capped at 0.20; a move over 2 SE raises an `anomaly`; an adapter version bump sets `frozen` on that site's watcher and like rows until its fixtures pass.
- **Rollback**: one UPDATE restores the previous champion; forecasts carry `param_versions`, so every shown range names what made it.

## 5. Speed

| Moment | Budget | Kept warm | On the event |
|---|---|---|---|
| A sold comp arrives | Gamma update under 50 ms | the `param` cache | in the comp's transaction |
| A product page or an item card | velocity, direction and the 4-week forecast in under 300 ms | `product_snapshot` rows and the latest `fc_` rows in Lakebase | read only |
| A research question | first cited finding in 3 s, complete in 20 s ([information engines](../product.md#information-engines-agent-proposal)) | the snapshots | the ensemble, when asked, runs as a job and lands within the 20 s or is shown as "still working" |
| Nightly fold per kind | under 10 minutes | Delta rollups | `param_fold` |

## 6. What the person sees

- On a product or item: "Selling faster than usual: 34 in the last 4 weeks, about 15 in a usual 4." Tap opens each signal's before and after.
- A forecast is always a range in words: "Likely 8 to 14 sell in the next 4 weeks" and "Likely $60 to $75 by March". Never a single number, never a percentage chance.
- A coming event: "The new model comes out on 3 March. The old one usually drops 5% to 12% in the 4 weeks after."
- On an owned item, a `demand_rose` notice: "More people want your jacket than a month ago." It names its basis and opens the item.
- Hidden states use the guarded number's reasons: "Not enough sales yet" for `too_few`, nothing for a failed trend test.
- In research, the language-model answer sits under the arithmetic one as "5 runs said 30% to 45%; this method's record: 41 questions, Brier 0.18".

## 7. How it beats what exists

As strong as [parity](../parity.md#price-and-market-data-tools), its [price-tool teardown](../../research/data/nate/teardown-price-tools-and-registries.md#4-the-leads-table) and market intelligence record.

| Rival | What it does | Ours |
|---|---|---|
| Terapeak | eBay sold history and sell-through, looking back | every site's sold comps once per cluster, with a forward range and its measured coverage |
| PriceCharting, Card Ladder, WatchCharts | price history and indexes for one kind | the same index logic ([M14](../determinations/market-insight.md#m14-a-category-price-index)) across kinds, plus velocity, events and a scored forecast |
| Keepa, camelcamelcamel | Amazon price history and drop alerts | used marketplaces, and alerts gated by M19 and the noise test, not by any drop |
| Lyst Index | quarterly brand rankings from weights it does not publish | stated weights that refit nightly and are shown on tap, per product, weekly |
| Pinterest Predicts, TikTok Creative Center | trend boards from search and posts | read as signals; they enter `D` only when the nightly fit shows they lead sales |
| LLM forecasting bots | a crowd of model runs | used for research questions only, beside arithmetic, with its own track record shown |

Whether any rival scores its forecasts against outcomes is not recorded; ours does by design (test 2), so the claim is our coverage, not their failure.

## 8. Protections

- A simulated or model-run number is never shown as fact, and never feeds price or alerts.
- A forecast is always a range with its basis count; hidden reasons follow the guarded number.
- Offers and messages from our people's listings enter only as counts pooled over at least 5 people per cell, per [M20](../determinations/market-insight.md#m20-making-an-anonymous-dataset-safe-to-share); no buyer or seller is identifiable.
- Watchers and likes are capped per listing, and relists count once by cluster, so one seller cannot manufacture a trend.
- Notices follow managing 20's batching and never commit anything; a change to a live price still goes through the strategy and its floor.

## 9. Proof

The fixed set, frozen as one `product_snapshot` table version: 300 real products, 50 in each of apparel, shoes, electronics, cards_collectibles, toys_lego and bags, each with at least 2 years of sold comps, and the 20 most recent successor releases among them.

| Test | Passes when |
|---|---|
| 1 Backtest of the 4-week count forecast from 26 weekly origins | pinball loss beats carrying the last 4 weeks forward by at least 10% (the result that counts) |
| 2 Coverage | 75% to 85% of realised counts and prices fall inside p10 to p90 |
| 3 Direction (M8's own check) | products labelled rising have a higher next-28-day sold rate than steady ones, by a bootstrap 90% interval above 0 |
| 4 Releases (M16's check) | the sign of the predecessor's price move is right on at least 14 of 20 |
| 5 Learning | refitting weights on the first 18 months and scoring the last 6 does not lose to M8's card weights |
| 6 Speed | the product read path under 300 ms at p95 |

## Open from the audit (checked 2026-11-15)

Each row of the Demand and trend section of [audit.md](audit.md) was checked against the code. 30 of 35 are closed. 3 are open and 2 are unclear because the module is parked. Worst first.

| # | What is wrong | Where (file:line today) | Fix | Test that proves it |
|---|---|---|---|---|
| DM-A1 | The calculators take a params dict, but no production caller reads the promoted `demand_beta_D`, `demand_k_cov` or weights from the registry, so the nightly fold changes nothing a forecast uses. | `jobs/demand/forecast.py:50` (also `direction.py`, `velocity.py`); `jobs/demand/params.py` has `resolve(read)` with no caller | Build params through `resolve(read)` at the product's scope in every caller. | Promote `beta_D` 0.8 for kind K. `count_forecast` for K uses exp(0.8 x D) and lists the new `beta_D` version. Another kind still uses 0.5. |
| DM-A2 | The product's velocity posterior is not stored. `velocity()` is a weekly batch function. A new sold comp updates nothing. | `jobs/demand/velocity.py:68` | Apply each new clustered sold comp as a Gamma observation on the product's param, with its exposure. | Product prior Gamma(2,1), one sale in a week with exposure 1: the stored posterior is shape 3, rate 2. The same cluster id again leaves it unchanged. |
| DM-A3 | Every call emits a forecast. The p50-change gate (`demand_forecast_move`, 0.10) is declared and never read. | `jobs/demand/forecast.py:54`; `params.py` | Persist a new forecast only when p50 moved by the configured share of the last stored p50. | Last p50 100, new 105: not written. New 111: written. The first forecast is always written. |
| DM-A4 | Unclear, module parked by Ben on 2026-11-15. `estimate` returns verdict `use` when there are no placebo windows, and does not enforce the 24-month history gate. `MIN_SALES = 8` is a literal. | `jobs/demand/event_effect.py:90`, `:32` | Return `too_thin` when there are zero placebos and when less than 24 months of calendar history exist. Move `MIN_SALES` to a declared param. Do this only if the module is revived. | A series with `event_week` equal to `window` (no placebo room) returns `too_thin`, not `use`. 23 months of history returns `too_thin`. |

## 10. Build tasks

Code under `jobs/demand/`, each task in the [task shape](../plans/README.md#2-the-task-shape) when planned; all build in parallel against the frozen snapshot fixture.

| Task | Owns | Depends on | Proves with |
|---|---|---|---|
| dt-1 Weekly counts and the Gamma velocity | `velocity.py`, `test_velocity.py` | none | `python -m pytest jobs/demand/test_velocity.py` |
| dt-2 `D`, direction and the M15 test | `direction.py`, `test_direction.py` | none | `python -m pytest jobs/demand/test_direction.py` |
| dt-3 Count and price forecasts with event and season terms | `forecast.py`, `events.py`, `test_forecast.py` | dt-1 interface | `python -m pytest jobs/demand/test_forecast.py` |
| dt-4 Learning: resolve, refit, coverage, promote, rollback | `learn.py`, `test_learn.py` | dt-3 interface | `python -m pytest jobs/demand/test_learn.py` |
| dt-5 Research ensemble on the gateway, with its track record | `ensemble.py`, `test_ensemble.py` | none (gateway mocked) | `python -m pytest jobs/demand/test_ensemble.py` |
| dt-6 The fixed set and the backtest | `proof/`, `test_proof.py` | dt-1 to dt-4 | `python -m pytest jobs/demand/test_proof.py` |

## Worked example

All numbers are examples.

A person owns an unworn pair of last year's trail shoes. Over the last 12 weeks the product sold 24 times across eBay, Depop and Mercari after cluster dedupe; the kind's prior is Gamma(4, 2). With forgetting, the posterior is about Gamma(22, 10), so velocity is 2.2 a week, p10 1.6 and p90 2.8.

Signals against the 112-day base: sold `r` = 0.25, turnover 0.10, watchers 0.30, search 0.20, offers 0.00. `D = (0.40 x 0.25 + 0.20 x 0.10 + 0.15 x 0.30 + 0.15 x 0.20 + 0.10 x 0) / 1.0 = 0.195`. That is over 0.15; M15's test passes on the sold count for the second weekly read, so it is rising and `demand_rose` fires on the person's owned pair.

The successor releases in 5 weeks; the category's M16 median for predecessors is minus 8% on price (range minus 3% to minus 14%). The 8-week price forecast is `$92 x 0.98 (age) x 0.92 (release) = $83`, range $74 to $90. Price reads this and proposes listing now: "Likely $74 to $90 after the new model is out in 5 weeks; about $92 now."
