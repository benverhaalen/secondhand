# Recommendation and style engine

*agent proposal*, the whole file. Written 2026-11-14.

One `style_profile` per person ([product §3](../product.md#3-the-data-model)), learned from what they sell, keep, save, follow and buy ([Nate](../../product/words.md#2026-11-14-nate-sale-emails-the-expo-account-where-routes-are-hosted-and-a-buy-page-shaped-by-your-style)), and the rankings it drives: the For you shelf and the order inside a delivered-total band on [Buy](../features/buy.md#your-style-profile), the alerts on new matches, cheaper alternatives, and "what to sell now" among the person's own items. It starts from [M18](../determinations/market-insight.md#m18-which-listings-to-recommend-to-a-person), [M17](../determinations/market-insight.md#m17-a-cheaper-equivalent-of-similar-quality-and-material) and [asking-and-intent card 10](../determinations/asking-and-intent.md#10-the-buyers-purpose-slots-and-what-is-inferred-before-asking). Every trait is visible and editable, and a referral never changes any order.

## 1. What it decides

| Output | Where it lands |
|---|---|
| The facets of the profile: name (brand, category, size, colour, era, price_band), value, weight, `from`, count, and for whom | the profile screen and every "why this" line ([insights](../features/insights.md) shows the same profile) |
| The For you shelf: up to 40 live listings, at most 2 per product, with a reason each | Buy, Today |
| The order inside a delivered-total band of a search | Buy and [Market](../features/market.md) results (the band order itself is buy's and stays first) |
| New-match alerts: a listing that scores above the person's alert bar | a batch notice timed by [managing 20](../determinations/managing-and-buyers.md#20-what-to-notify-now-in-a-batch-or-not-at-all), the `match` row with source `for_you` |
| Cheaper alternatives: M17 equivalents filtered and ordered for this person | "Similar for less" on Buy, and `replace_after_sale` |
| What to sell now: the person's `owned` items ordered by what waiting would cost against how much they still fit the person | a shelf on Sell; each card opens the item with "Sell this" |

## 2. Signals

| Signal | Row | Start weight (taste; size) | From |
|---|---|---|---|
| A want | `want` | 1.0; 1.0 | M18 |
| You said on an intent slot | intent slot with `you_said` | 1.0, final; 1.0 | card 10 |
| A save | `match` saved | 0.8; 0.6 | new; between a want and a follow |
| A follow | follow | 0.6; 0 | M18 |
| A purchase | `order` kind purchase, `item.cost.source` purchase | 0.5; 0.8 | M18 (taste), card 10 (size) |
| An owned item kept | `item` owned, not listed, older than 90 days | 0.4; 0.8 | M18 (taste), card 10 (size) |
| An item sold | `item` sold | 0.2; 0.4 | new: it once suited them, and they let it go |
| "Not for me" on a card | `match` dismissed | -1.0 on that cluster, -0.3 on its brand | M18 |
| Passed over: shown 10 times in For you without a tap | impression log | multiplies that facet's weight by its posterior (section 4) | new |
| Demand and forecasts on owned items | [demand-and-trend](demand-and-trend.md) `fc_` rows | what to sell now | engine |
| Similarity facets and the top 20 neighbours | M17's kept-ready table | cheaper alternatives | M17 |

Each event's contribution decays by card 10's rule, halved per year of age. An event names its recipient when the intent slot "for whom" is filled ("for my son"), and its facets go to that recipient's sub-profile, never the person's own.

## 3. The calculation

1. **Facet extraction** (a model). Brand, category, size, colour, era and price_band come from the item's or listing's attributes, read once by the extractor with its version. Nothing is inferred from a photo of the person.
2. **Affinity** (arithmetic). For facet value `v`: `a_v = sum over events of w_source x 0.5^(age in years)`; the shown weight is `a_v / (a_v + 2)` (the 2 a `param`, pulling thin facets toward 0). A facet is shown and used once it has 3 events from at least 2 days; the count and the strongest source are its reason.
3. **Size** (arithmetic). Per category and recipient, the size distribution over events by the size weights; the mode becomes the size facet when its share is at least 0.7 and it has 3 events. A measured fit from [watch](../features/watch.md) overrides a label size.
4. **Edits** (rules). An edited facet has `from` edited, a `pinned` weight that learning never changes, and the person's value. A removed facet gets `removed_at`; only events after it count toward its return, and it returns only with 3 new events, saying so ("back because you saved 3 since 2 Nov") with one tap to remove it again. A reset sets `removed_at` on every facet.
5. **Listing score** (arithmetic, M18 extended). Hard filters as M18: live, fits, not the person's own, not recalled, the match label `exact` or `likely_same_model` when a product is set. Then `score = (sum of matching facet weights + sum of matching intent slots x their confidence - not-for-me penalties) x deal x q`, where `deal` is M18's 1.0 to 0.5 by the delivered total's place in the fair range and `q` is 0.8 to 1.2 by the [score](../features/score.md#axes) quality axis (1.0 when hidden).
6. **Within-band order** (arithmetic). Search results keep buy's delivered-total band order; inside a band they sort by `score`, then buy's own tie-breaks.
7. **Alerts** (rules). A new listing alerts when its `score` is above the person's alert bar, set at their For you shelf's 90th-percentile score, and passes [M19](../determinations/market-insight.md#m19-when-a-followed-product-has-moved-enough-to-tell-its-follower)'s spacing for its product.
8. **Cheaper alternatives** (arithmetic over M17). M17's equivalents of the target, filtered by the person's size and removed facets, ordered by `similarity x (1 + facet match)`; M17's bars (similarity at least 0.75, p50 at most 0.75 of the target's) stay.
9. **What to sell now** (arithmetic). For each owned item with a shown 12-week price forecast: `drop = 1 - p50_forecast_12w / p50_now`, `fit_now` = its facet weights' mean in today's profile against the same at its purchase, capped at 1. `sell_now = max(drop, 0) x (1.5 - fit_now)`, so an item losing value and drifting from the person's taste comes first. Items whose forecast is hidden are left out, and the count is shown.
10. **Learned ranker** (a model, challenger). A logistic regression on For you impressions, predicting a save or a tap from the per-source match sums, `deal`, `q`, the match label and M17 similarity. Referral, commission and placement fields are not in its feature list. It replaces step 5's weighted sum only through promotion (section 4).

## 4. Learning

The machinery is the shared [real-time weights](../features/data.md#real-time-weights-agent-proposal); the source weights are `param` rows scoped per kind, and each person's facets are recomputed from events, so a profile is reproducible.

- **Prior**: section 2's start weights; the shrinkage 2; the size share 0.7.
- **Per event**: an event writes its facet contribution in the same transaction and marks that person's For you cache stale; a "not for me" also drops that cluster from every cached shelf of theirs at once.
- **Passed over**: per person and facet, a Beta(1, 1) on tap rate over impressions; after 10 impressions the facet's weight is multiplied by the posterior mean over the pooled mean, between 0.5 and 1.0, and the reason says "you passed on 10 of these". It never removes a facet; only the person does.
- **Hourly**: shelves marked stale are rebuilt; alert candidates are scored for people with new matching listings.
- **Nightly** (`param_fold`, pooled over opted-in people):
  - The source weights are refit as the coefficients of the logistic regression in step 10, scaled to M18's want weight of 1.0, and written as challengers.
  - The full learned ranker is fitted as a second challenger.
  - The size rule is scored against new `you_said` sizes.
- **Switching**: a challenger is promoted when, on the last 14 days of impressions held out, its NDCG at 10 on saves beats the champion by more than the 1,000-draw bootstrap noise, with at least 2,000 impressions and 100 saves in the kind. Below that the kind reads the pooled parent, and below that the start weights.
- **Guards**: a source weight stays within ±50% of its start, keeps its sign, and a want stays the largest; a move over 2 SE raises an `anomaly`.
- **Rollback**: one UPDATE restores the previous champion; a person's profile reruns from events in under a second.

## 5. Speed

| Moment | Budget | Kept warm | On the event |
|---|---|---|---|
| An event | facet update under 50 ms | the person's facet rows | in the event's transaction |
| Opening For you | under 200 ms | the cached shelf (new, a `for_you` cache row per person and recipient, Lakebase) | rebuilt in the background if stale |
| A search's within-band order | under 30 ms for 200 results | the person's facets | arithmetic only |
| Profile screen | under 150 ms | facet rows | read only |
| Nightly fold | under 15 minutes | Delta impression rollups | `param_fold` |

## 6. What the person sees

- The profile, as a list: "Size M in jackets, from 6 items", "Arc'teryx, from 4 saves and 1 purchase", "For your son: size 10 shoes, from 3 orders". Each has edit and remove; the list ends with Reset.
- On each For you card and each "Similar for less" card, one short reason: "Your size, your brand, $40 under fair".
- "What to sell now": "This coat: likely $20 to $30 less by March, and you have not bought this brand in a year." The card opens the item.
- An alert: "A North Face Nuptse in your size, $60 under fair." It opens the listing.
- A trait that came back says why, with remove one tap away.

## 7. How it beats what exists

As strong as [analytics §5](../../research/data/nate/analytics-and-recommendations.md#5-recommendations-how-marketplaces-personalise-and-cold-start) and [parity](../parity.md#cross-marketplace-search-and-similar-item-finders) record.

| Rival | What it does | Ours |
|---|---|---|
| Each marketplace's own feed (eBay, Depop, Poshmark, Mercari) | personalises from purchases and engagement inside its own site, falling back to popular items at cold start (*asserted*) | one profile across all five sites and official retail, with every trait shown and editable |
| eBay Promoted Listings and other paid placement | paid listings sit in results, labelled sponsored | payment is never a feature, and a test proves the order is the same with referral fields on or off |
| Dupe finders, ThriftX | similar by look, or the cheapest copy | M17's facet match on material and build, filtered by the person's size and taste |
| Crosslisters | no buyer side | the same profile also says which owned items to sell now |

No rival is recorded as showing why an item is recommended or letting the person remove a trait; ours does both on every card.

## 8. Protections

- For you is opt in; size and taste are personal data, shown and editable in You ([§8](../product.md#8-cross-cutting-requirements)), deleted with the account.
- Referral, commission and placement fields never reach the scorer, the ranker or the cache; the order is fixed before a referral link is attached, as buy requires.
- No facet is drawn from a photo of a person, a message's content, or anything sensitive (health, religion, body beyond the size of items they own); a recipient's sizes stay in that recipient's sub-profile.
- A removed trait is never relearned without new events the person can see, and its return says so.
- At most 3 rows from one seller in any 20, as buy sets, so one bulk seller cannot fill a shelf.
- The engine never acts: "what to sell now" and alerts open a screen; any listing or offer follows its own decision.

## 9. Proof

The fixed set: 600 real live listings captured once across the five sites (120 each) with their attributes and fair ranges, and 20 real histories from the team's own accounts (wants, saves, purchases, owned and sold items), frozen as one table version. For each history the last 20% of saves are held out.

| Test | Passes when |
|---|---|
| 1 Referral invariance | the order of every shelf and search is byte-identical with referral fields absent, zero and randomised |
| 2 Removal | after removing a trait and replaying 50 events with no new matching event, the trait is absent; 3 new events bring it back with its reason |
| 3 Edit | a pinned weight is unchanged after a full nightly fold |
| 4 Held-out saves (the result that counts) | the profile order puts held-out saves higher than a popular-in-category order, NDCG at 10 better by a bootstrap 90% interval above 0 |
| 5 Size | size facets match the held-out `you_said` sizes at 0.853 or better, card 10's bar |
| 6 What to sell now | on the fixed demand snapshot, items with a successor release in 12 weeks rank above unchanged ones in every history |
| 7 Speed | For you under 200 ms at p95 |

## 10. Build tasks

Code under `jobs/style/`, each task in the [task shape](../plans/README.md#2-the-task-shape) when planned; all build in parallel against the frozen fixture.

| Task | Owns | Depends on | Proves with |
|---|---|---|---|
| rs-1 Events to facets: affinity, size, recipients | `facets.py`, `test_facets.py` | none | `python -m pytest jobs/style/test_facets.py` |
| rs-2 Edit, remove, return and reset | `edits.py`, `test_edits.py` | rs-1 interface | `python -m pytest jobs/style/test_edits.py` |
| rs-3 Listing score, within-band order, alerts and the shelf cache | `rank.py`, `test_rank.py` | rs-1 interface | `python -m pytest jobs/style/test_rank.py` |
| rs-4 Cheaper alternatives and what to sell now | `alternatives.py`, `sell_now.py`, `test_sell_now.py` | rs-1 interface, the demand `fc_` fixture | `python -m pytest jobs/style/test_sell_now.py` |
| rs-5 Learning: passed over, nightly refit, promote, rollback | `learn.py`, `test_learn.py` | rs-3 interface | `python -m pytest jobs/style/test_learn.py` |
| rs-6 The fixed set, referral invariance and held-out saves | `proof/`, `test_proof.py` | rs-1 to rs-5 | `python -m pytest jobs/style/test_proof.py` |

## Worked example

All numbers are examples.

A person bought 1 Patagonia fleece last year, owns 3 Patagonia items kept over 90 days, and saved 2 this month. `a = 0.5 x 0.5 + 3 x 0.4 x 0.8 + 2 x 0.8 = 0.25 + 0.96 + 1.6 = 2.81`; weight `2.81 / 4.81 = 0.58`. The reason reads "Patagonia, from 2 saves and 4 items". Size M in jackets holds 5 of 6 weighted events, a share of 0.83, so it shows.

A Patagonia Retro-X in M on Depop: facets 0.58 (brand) + 0.71 (size) + 0.35 (category), deal 0.9 (low in the fair range), `q` 1.1: `score = 1.64 x 0.9 x 1.1 = 1.62`, over the person's alert bar of 1.4, so it goes into the next batch notice.

What to sell now: their 3-year-old Canada Goose parka has a 12-week forecast p50 of $300 against $340 now, `drop = 0.12`; they have not saved or bought the brand since, `fit_now = 0.3`; `sell_now = 0.12 x 1.2 = 0.14`, the highest of their items, so it leads the shelf.
