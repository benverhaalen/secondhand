# Marketing engine

*agent proposal*: this whole file. Nothing here is Decided until Ben or Nate moves it.

The marketing engine decides, for one item on each of the five sites, whether to list there and exactly how: price and floor, title, attributes and category, photos, shipping, timing, promotion, and the moves it keeps making after the listing is live. It is a determined calculation in plain code over data collected now, with every weight a learned `param`. Nate asked for it in these words: "we in real time based on similar listings, determine the best marketing strategy for each platform, that is a determined calculation and feature" and "It needs to be fast, credible and dynamic, yet transparent" ([words](../product/words.md#2026-11-14-nate-the-best-strategy-per-platform-computed)); "The engine should be built to weigh things in real time, not hardcode in methodologies" ([words](../product/words.md#2026-11-14-nate-how-the-marketing-engine-is-powered-and-weights-in-real-time)); and "all should be specced in full" ([words](../product/words.md#2026-11-14-nate-spec-in-full-how-marketing-strategies-are-weighed-in-real-time-and-how-collected-data-is-used)).

This file joins pieces that already have their own cards and links to them rather than restating them: [listing-and-marketing.md](determinations/listing-and-marketing.md) (D1 to D26), [money.md](determinations/money.md), [market-insight.md](determinations/market-insight.md), [score.md](features/score.md), the real-time weight rules in [assessment.md](assessment.md#real-time-weights), and the canon rows in [product.md](product.md) (`strategy`, `score`, `ranker_model`, `experiment`, `rank_observation`, `param`). How the collected data feeds it is in [data-use.md](data-use.md).

## 1. The decision: one `site_plan` per site

The engine writes one object per item per site. It is the canon `strategy` row plus the fields marked *new*, which go to product.md §3 as a build task.

```ts
type Site = 'ebay' | 'facebook' | 'depop' | 'poshmark' | 'mercari'

type SitePlan = {
  item_id: string
  site: Site
  verdict: 'list' | 'skip'                       // new
  skip_reason?: 'site_bars_category' | 'recall_or_legal_flag' | 'not_connected'
              | 'fit_avoid' | 'negative_value'   // new
  objective: 'quick' | 'balanced' | 'max_return'
  price: {
    start_cents: number
    floor_cents: number                          // the person's limit wins over the engine's
    path: { at: string; price_cents: number }[]  // price_path[] in canon
    horizon_days: 7 | 30 | 90
  }
  title: { text: string; slots: { slot: string; term: string; share_w: number }[]; form: string }
  attributes: { name: string; value: string; source: 'fact' | 'evidence' | 'asked' }[]
  category_id: string                            // new
  photos: { order: string[]; cover_id: string; cover_style: string }
  shipping: {                                    // new
    mode: 'buyer_pays' | 'free' | 'pickup' | 'either'
    ship_cents: number
    price_includes_ship: boolean
  }
  list_at: string                                // now, or a peak inside 72 h
  promotion: { on: boolean; rate?: number; lift_lb?: number } // new
  standing: {
    offers_to_likers: { on: boolean; discount: number; cooldown_days: number }
    price_steps: 'path'                          // follows price.path
    refresh: { on: boolean; interval_days?: number }
    relist: { allowed: boolean }                 // false on Poshmark, always
    bundle: { on: boolean; max_discount: number }
  }
  scores: {                                      // new: the winning candidate's numbers
    e_net_cents: number
    p_sale: { d7: number; d30: number; d90: number }
    tts_days: [number, number]
    position: [number, number]
    utility_cents: number
  }
  alternatives: { candidate_id: string; objective: string; e_net_cents: number;
                  p_sale_d30: number; tts_days: [number, number] }[] // new
  comp_set: { ids: string[]; as_of: string; fingerprint: string }
  citation_id: string
  param_versions: Record<string, number>         // new, also carried in the citation
  preselected: boolean
  chosen_at?: string
}
```

Where each field comes from:

| Field | Card that computes it |
|---|---|
| verdict | [D1 platform fit](determinations/listing-and-marketing.md#d1-platform-fit) plus the site's category rules and recall flags (fixed, never learned) |
| price.start, path, horizon | [D3 best plan per site](determinations/listing-and-marketing.md#d3-best-plan-per-site), [money D13](determinations/money.md#d13-listing-price), [money D15](determinations/money.md#d15-markdown-path-stale-and-relist), [D20](determinations/listing-and-marketing.md#d20-price-drop-route) |
| price.floor | [money D14](determinations/money.md#d14-floor-and-always-accept) and the person's `limits` |
| title | [D4](determinations/listing-and-marketing.md#d4-title-per-site) |
| attributes, category | [D6](determinations/listing-and-marketing.md#d6-attributes-per-site), [D7](determinations/listing-and-marketing.md#d7-category-placement) |
| photos | [D8](determinations/listing-and-marketing.md#d8-photo-choice-and-order) |
| shipping | [D9](determinations/listing-and-marketing.md#d9-shipping-offer) |
| list_at | [D14](determinations/listing-and-marketing.md#d14-when-to-post) |
| promotion | [D18](determinations/listing-and-marketing.md#d18-promoted-listing), [money D33](determinations/money.md#d33-promotion-return) |
| standing moves | [D16](determinations/listing-and-marketing.md#d16-next-move-on-a-live-listing), [D17](determinations/listing-and-marketing.md#d17-offer-to-likers-or-watchers), [D19](determinations/listing-and-marketing.md#d19-bundle-discount), [D21](determinations/listing-and-marketing.md#d21-edit-refresh-or-relist), [D26](determinations/listing-and-marketing.md#d26-engagement-levers-the-agent-runs-on-its-own) |
| scores | [money D9](determinations/money.md#d9-what-you-keep-per-site), [D10](determinations/money.md#d10-chance-of-sale-within-a-period-at-a-price), [D11](determinations/money.md#d11-time-to-sell-range), [D13 visibility](determinations/listing-and-marketing.md#d13-predicted-visibility-per-site) |

Every move after posting is a decision kind from product.md §5: `markdown` on the path above the floor runs on auto, `price_below_floor` asks, `offer_to_watchers` covers the offer to likers, `relist` never runs on Poshmark, `promote_spend` and `join_experiment` always ask. **Test:** a unit test builds a plan for every site from a fixture and asserts the object validates, every standing move maps to a decision kind, and no path rung is below `floor_cents`.

## 2. The signals

Freshness tiers: **hot** means read on the event itself; **warm** means served from a cache or standing index no older than the stated age; **cold** means refit nightly or slower. Every read goes through `harness.call(site, verb, args)` or an information engine, and writes an `observation` and a `route_call` ([product.md](product.md), the harness protocol and information engines in §6).

### Similar listings now

| Signal | Source | Freshness | How it enters |
|---|---|---|---|
| Rank (position for the item's queries) | `search` verb on each site, ordered results saved as `rank_observation` | warm, 60 s for a plan; `observe_rank` daily per category | [D12](determinations/listing-and-marketing.md#d12-stand-in-ranker-factors) Plackett-Luce fit; [D13](determinations/listing-and-marketing.md#d13-predicted-visibility-per-site) position range; [D2](determinations/listing-and-marketing.md#d2-winners-on-a-site) top 10 organic |
| Price | `search` (active and sold filters), information engine standing index | warm, standing index refreshed by `market_refresh` hourly for products with a live item | [money D1](determinations/money.md#d1-comparable-set-and-weights) comp weights, [D5](determinations/money.md#d5-fair-value-range-overall-and-per-site) range, D3 rungs from p10 to p90 |
| Age | listing date from `search` or the page | warm | censoring in [money D10](determinations/money.md#d10-chance-of-sale-within-a-period-at-a-price); the pooled interest curve by age in [D15](determinations/listing-and-marketing.md#d15-interest-against-plan) |
| Photos (count, cover style) | page read by the fetch engine, cover style tagged by the vision model, cached by photo hash | warm | [D8](determinations/listing-and-marketing.md#d8-photo-choice-and-order) cover style share among winners |
| Title terms | `search` results | warm | `share_W` and `share_C` in [D4](determinations/listing-and-marketing.md#d4-title-per-site) |
| Attributes | page read | warm | fill rate among winners in [D6](determinations/listing-and-marketing.md#d6-attributes-per-site); a quality factor in D12 |
| Seller standing | page read (feedback, ratings, badges) | warm, 7 days | a control factor in D12, so a top seller's rank is not credited to their title; one row per seller in D2 |
| Promoted | the site's promoted marker on the result | warm | excluded from W_s in D2; promoted against organic pairs feed D18 lift |

### Demand

| Signal | Source | Freshness | How it enters |
|---|---|---|---|
| Views, watchers | `read_stats`: eBay views and watchers, Mercari views, Facebook views | hot on `poll_stats`, scheduled by `next_check_at` ([check again](determinations/managing-and-buyers.md#15-when-to-check-again)) | interest against plan in D15; a Gamma-Poisson update of the listing's view rate (§3.5) |
| Likes, saves, bags | `read_stats`: Depop likes and bags, Poshmark likes, Mercari likes, Facebook saves | hot | D15; the likers count that gates [D17](determinations/listing-and-marketing.md#d17-offer-to-likers-or-watchers) |
| Offers | `read_offers` | hot, minutes while one is pending | [answering an offer](determinations/managing-and-buyers.md#7-how-to-answer-an-offer), [money D16](determinations/money.md#d16-offer-response); the offer-accept Beta per site and price band |
| Messages | `read_inbox` | hot | rule 1 of D16 hands the listing to messages; question topics are counted per product |
| Search interest | information engines (site search suggestions, trend series) | warm, daily | [M8 demand](determinations/market-insight.md#m8-demand-and-whether-it-is-rising); the `suggest` term in D4 |
| Sold velocity | `search` with sold filters where the site shows them, plus the standing index | warm, hourly | [M6 sell-through](determinations/market-insight.md#m6-sell-through), [M7 days to sell](determinations/market-insight.md#m7-days-to-sell), the hazard in money D10 |

### The item

| Signal | Source | Freshness | How it enters |
|---|---|---|---|
| Facts (brand, model, size, material) | [identify](features/identify.md), [capture](features/capture.md), the person's answers | hot when confirmed | comp matching in money D1; title slots in D4; attributes in D6 |
| Evidence (photos, scans, measurements) | [capture](features/capture.md), [studio](features/studio.md), [measure](features/measure.md) | hot | the photo set D8 orders; [D5](determinations/listing-and-marketing.md#d5-description-and-the-facts-it-must-state) facts the description must state |
| Quality (condition, completeness, listing quality) | [money D2](determinations/money.md#d2-condition-variant-completeness-and-size-adjustment), [D10 listing quality](determinations/listing-and-marketing.md#d10-listing-quality-and-its-fixes) | hot | the condition adjustment on price; the quality factor in D12. Condition, size and authenticity come from the person or evidence, never inferred |

### The person

| Signal | Source | Freshness | How it enters |
|---|---|---|---|
| Limits | the `limits` row, set in price | hot | hard constraints: floor, auto bounds, sites allowed |
| Speed against price | the chosen objective and goal, plus every time they pick another strategy | hot | the holding cost `c` in the objective (§3.3), learned per person |
| Past results | their own `sale_receipt`, unsold and returned outcomes | hot on the outcome | a per-person scope on sale-rate and offer-accept params, pooled toward the site scope by n_eff |

### What the site says it rewards

| Signal | Source | Freshness | How it enters |
|---|---|---|---|
| Published ranking guidance, seller help pages, fee and promotion rules | information engines on the open web, filed as research notes | cold, checked weekly; a diff raises a site change review | [D11](determinations/listing-and-marketing.md#d11-what-each-ranking-is-believed-to-reward) beliefs are the priors on D12 factors; fees and minimums are fixed inputs to money D9 |

## 3. The calculation

### 3.1 Candidate generation

For each connected site that passes the fixed gate (site allows the category, no recall or legal flag), the engine splits the plan into two parts that it can search separately, because presentation changes the chance of sale only through visibility:

- **Money candidates.** Objective in {quick, balanced, max_return} × horizon T in {7, 30, 90} × start rung from p10 to p90 of the site range in 5-point steps (17 rungs) × shipping mode allowed on the site. At most 3 × 3 × 17 × 3 = 459 candidates per site, each scored with the D10 curve in under 50 ms for its rungs.
- **Presentation candidates.** Up to 3 title forms from the D4 templates, up to 2 cover choices from D8, the D6 attribute fill (one answer: fill every attribute the facts support), the D7 category (one answer: the category the winners sit in). Each is scored by predicted visibility from D13.

The best presentation is chosen first, by visibility; its visibility multiplier then enters every money candidate.

### 3.2 Scoring each candidate

For candidate k on site s:

- `net_s(p)`: what the person keeps at price p after fees and shipping, from [money D9](determinations/money.md#d9-what-you-keep-per-site).
- `P_D10(sale in step i | p)`: the chance of sale in each step of the path, from [money D10](determinations/money.md#d10-chance-of-sale-within-a-period-at-a-price) (the Kaplan-Meier and cure-model blend).
- **Visibility.** `m_k = (views at position range of k / views at the comp median position) ^ vis_exponent`, clamped to the guard band [0.5, 2]. The adjusted chance of sale is `P_k(step i) = 1 − (1 − P_D10(step i))^{m_k}`, a proportional-hazards shift.
- **Expected net.** `E_k = Σ_i P_k(sale in step i) × net_s(price_i)`, as in D3.
- **Time.** `TTS_k` from [money D11](determinations/money.md#d11-time-to-sell-range); `D_k = E[min(time to sale, T)]` from the same survival curve.

### 3.3 The objective

```
U_k = E_k − c_o × D_k
best_s = argmax_k U_k   subject to   price_i ≥ floor for every rung,
                                     P_k(T) ≥ p_min_o,
                                     the person's limits
ties: higher P_k(T), then lower start (D3)
```

`c_o` is the person's holding cost in cents per day for objective o. Priors: max_return 0; balanced 0.2% of the fair-value midpoint per day; quick 1% of the midpoint per day. `p_min_o` priors: quick 0.6 at T = 7, balanced 0.4 at T = 30, max_return 0. The engine abstains on price under D3's sales minimum (6 sales in 12 months or 2 in 90 days) and shows the range state money D6 sets.

**Verdict per site.** List on s when the site passes the gate, D1 fit is not "avoid", and `U_best_s > 0`. Because an item sells once, the five plans are computed independently and each site shows its own best plan; the item card shows the chance it sells somewhere, `1 − Π_s (1 − P_s(T))`, with the sites' P read from each plan.

### 3.4 Weights are params

Every number above that is not a fee, a site minimum, a legal rule or a definition is a `param` row with the written value as its prior and `n_eff` 0 at a new scope ([product.md](product.md) `param`).

| param | Prior | Scope | Card |
|---|---|---|---|
| comp weights | money D1 | site, segment | [money D1](determinations/money.md#d1-comparable-set-and-weights) |
| `winners_sold_weight`, `winners_rank_weight` | 1.0, 0.5 | site | D2 |
| `title_w_share`, `title_w_suggest`, `title_w_comp` | 0.5, 0.3, 0.2 | site | D4 |
| `free_ship_uplift` | 0.75 | site, segment | D9 |
| `km_blend_k` | 20 (`λ = n/(n+20)`) | site | money D10 |
| `vis_exponent` | 0.5 | site, category | §3.2 |
| `holding_cost_balanced`, `holding_cost_quick` | 0.002, 0.01 of midpoint per day | person | §3.3 |
| `p_min_quick`, `p_min_balanced` | 0.6, 0.4 | person | §3.3 |
| `offer_discount_extra` | 0 above the site minimum | site, segment | D17 |
| `promo_lift` | 1.0 (no lift) | site, category | D18 |
| `interest_behind_pct`, `interest_behind_checks` | 25th percentile, 2 checks | site | D15 |
| `lever_min_moves` | 300 | site | D16 |
| `offer_accept` (Beta) | Beta(2, 2) | site, price band, person | managing 7 |
| `sale_rate` (Gamma) | from M6 at the site scope | site, segment, person | §3.5 |

Fixed and never learned: fees, site minimum offer discounts (eBay 5%, Poshmark 10%, Mercari 10%), title and photo limits, locked actions, recall and legal flags, the floor the person set, never relisting on Poshmark, and never inferring condition, size or authenticity ([assessment.md](assessment.md#real-time-weights)). Readers fetch params through a 60 s cache. **Test:** a check scans the engine code for numeric literals in scoring paths and fails on any that is not a fixed rule listed here.

### 3.5 Update rules

**Per event, in the same transaction as the outcome.** Each update applies a forgetting factor `γ = 0.5^(Δt / 30 days)` to the old counts first, then pools toward the parent scope: the value a reader sees is `(n_eff × local + κ × parent) / (n_eff + κ)` with `κ = 20`.

- Offer answered: `offer_accept` at (site, price band, person) `α ← γα + accepted`, `β ← γβ + declined`.
- Listing-day exposure and sale: `sale_rate ~ Gamma(a, b)` at (site, segment), `a ← γa + sales`, `b ← γb + listing_days`. The posterior mean shifts the D10 hazard by the ratio of the local to the comp-derived rate.
- `read_stats` result: the listing's view rate `Gamma(a_v, b_v)`, `a_v += views`, `b_v += hours`; the result is compared against the pooled band to set D15's ahead, on plan or behind.
- Bandit arm outcome: `arm` Beta for the variation, `α += success`, `β += failure` (§3.6).
- Strategy picked by the person: a revealed-preference update of `c`. If they choose candidate j over the preselected k, the engine records the bound `c ≥ (E_k − E_j)/(D_k − D_j)` when `D_j < D_k` (or `≤` the other way) and moves the person's `c` to the midpoint of the interval those bounds leave, inside the guard band [0, 3% of midpoint per day].

**Hourly.** `market_refresh` reads new comps for every product with a live item; a changed comp fingerprint re-plans that item (§3.7). D15 bands are recomputed from the pooled curve. Drift alerts fire when a param's live mean moves more than 2 SE from its champion.

**Nightly.** `param_fold` refits comp weights, the isotonic recalibration per horizon in money D10, conformal intervals, and the D12 ranker on that day's `rank_observation` rows (`fit_ranker`). Each refit is written as a challenger and promoted only when its held-out backtest beats the champion by more than the bootstrap noise; rollback is one UPDATE of the alias ([assessment.md](assessment.md#real-time-weights)). Weekly: the ranker on sales, sell-through and time-to-sell, pooled promotion lift.

### 3.6 Variations as a bandit, with consent

A person who accepts `join_experiment` (always asked, never auto) lets the engine vary presentation on their listings: title form, cover photo, shipping mode, list time. Thompson sampling picks an arm per new listing from the `arm` Betas; success is a sale within T, or interest at or above the 50th percentile at day 7 for listings still live. Price is never an arm below the floor, and the start price may vary by at most one rung. The bandit state lives in the Online Feature Store on Lakebase ([score.md](features/score.md)). [D22](determinations/listing-and-marketing.md#d22-test-design-for-a-change) designs the test and [D23](determinations/listing-and-marketing.md#d23-whether-a-change-helped) decides whether it helped; a winning arm updates the site's prior through the nightly fold.

### 3.7 Re-planning

Each trigger sets `next_check_at` to now for the affected items and runs the same calculation with warm inputs.

| Trigger | Detected by | What happens |
|---|---|---|
| A similar item sells | a new sold comp changes the item's comp fingerprint | recompute the range, D10 curve and best plan. If `U_new` beats the live plan's `U` by more than the conformal noise, propose the change: a lower price on the path and above the floor is a `markdown` on auto; anything else is an `agent_revision` decision |
| A rank drop | `observe_rank` places the listing below its D13 position range on 2 consecutive checks | run D16 in order: a fix of weight 2 or more becomes a D21 edit, a due drop goes to D20, an offer to likers to D17 |
| A site change | [D24](determinations/listing-and-marketing.md#d24-whether-a-site-changed-its-ranking) raises the change flag | set `frozen` on that site's params, use D11 beliefs and the last champions, pause bandits there, schedule an `observe_rank` burst, re-plan every live listing on that site; unfreeze when the refit ranker's backtest is stable again |
| Interest behind | D15 | D16 next move |
| The person changes limits or picks a strategy | `POST /v1/items/:id/strategy` | re-plan inside the chosen objective |
| Fees or rules change | the weekly D11 source diff | fixed inputs updated, every plan on that site re-scored |

**Test:** inject a sold comp into a fixture comp set and assert the plan is re-scored, the stream emits `score.change`, and a lower price above the floor produces a `markdown` decision with no person step.

## 4. Speed

Nate: "Im sure there are way more intuitive and genius ways to design out things to account for speed, while also maintaining the accuracy and focus realtime calculations give us" ([words](../product/words.md#2026-11-14-nate-speed-with-real-time-accuracy-and-score-what-to-build-and-test-first)). The design keeps the slow work warm and computes only the argmax on the event.

| Step | Budget (p95) |
|---|---|
| First plan for all five sites, from confirmed identity | 3 s, from the standing index, with the template title |
| Joined title (Sonnet joins, Haiku checks, cached by fingerprint) | 2 s more, swapped in place |
| Complete plan with fresh site searches | 20 s, the information engines' completion deadline |
| Re-plan on an event | 1 s |
| `GET /v1/scores` and the plan read | 1 s on a warm store, no fit or fetch on the path |

**Kept warm per product:** comp set ids and fingerprint, the D10 curve inputs per site, W_s winners with their title terms, cover styles and attribute fill, the fair-value range, the citation.
**Kept warm per site:** the `ranker_model`, D11 beliefs, the fee table, the hourly views curve for D14, the pooled D15 bands, params through the 60 s cache.
**Computed on the event:** candidate scoring, the argmax, the difference against the live plan, and the decision it produces.

**Test:** a load test runs 20 confirmed items through the first plan and 100 injected events through re-plan, and reads the p95 from the MLflow traces against the table.

## 5. Transparency

Every number on the plan carries a `citation` with `param_versions` ([M21](determinations/market-insight.md#m21-the-citation-attached-to-every-published-number)). The UI shows the work as it arrives, as Nate described: "pop ups displaying findings, like 1000 similar products found, prices weighed" ([words](../product/words.md#2026-11-14-nate-the-ui-shows-the-work-animation-and-findings-as-they-arrive)).

- **Why this title.** Each slot with its term and its count among winners ("Better Sweater: 19 of 22 winners"), the suggestion it matches, and the winner count. Under 10 winners the title says it came from the template and the item's facts.
- **Why $54 on eBay.** The fair-value range and the comp count behind it, sold in the last 90 days, the chance of sale in 30 days, what the person keeps after fees, and the weights used ("Mercari sales weighted 1.0, fitted on 214 sales, v37"). The basis opens through `GET /v1/scores/:id/basis` and `GET /v1/citations/:id`.
- **Picking another.** The plan lists the best candidate for each other objective with its expected net, chance of sale and time to sell. Choosing one calls `POST /v1/items/:id/strategy {site, candidate_id | objective, limits?}`. The chosen plan replaces the preselected one (`preselected` false, `chosen_at` set), the draft or live listing is revised through the decision kinds in §1, the revealed-preference update moves the person's `c` (§3.5), and re-planning stays inside the objective they picked.

**Test:** a check walks every number on a rendered plan and fails if any lacks a citation that recomputes it.

## 6. Cold start

Day one runs on: D11 published beliefs as the D12 factor priors, Ben's fit matrix as D1, every card's written number as its param prior, comps from the standing index and site search, and plans from comps alone. The abstain rules of D3, money D6 and D10 decide what is shown.

**The switch rule.** For every param at every scope, the value used is the pooled posterior of §3.5, so the data's share of the value is `n_eff / (n_eff + κ)`. A scope's fitted champion replaces the prior in the fold only when `n_eff ≥ κ` and its held-out backtest beats the prior beyond the bootstrap noise. For ranking factors the order of evidence is fixed: D11 published beliefs, then D2 observed winners once a site and category has 10 or more winners, then the D12 learned ranker once its factor interval excludes no effect, then D23 experiment results, which override all three for the factor they tested.

## 7. Proof tests

Each runs in a day on real pages through the harness and the information engines.

| Test | How | The result that counts |
|---|---|---|
| Plan speed | 20 real items, first plan on all five sites | p95 ≤ 3 s for the first plan, ≤ 20 s complete, in MLflow traces |
| Comp fidelity | 20 items, top 10 comps per site shown to a person | at least 8 of 10 judged the same product and condition band |
| Price backtest | 50 items sold in the last 30 days on eBay, Mercari and Poshmark sold pages; plan from comps dated before each sale | the sold price falls inside the fair-value range at the range's stated coverage, within 5 points |
| Title recall | the engine's title for 30 items typed as the query on each site | the item's own product appears in the top 20 results for at least 27 of 30 |
| Rank noise floor | the same 20 queries run 3 times an hour apart | Kendall tau between runs; the measured value becomes `noise_floor` on the `ranker_model` |
| Recompute | 20 plan numbers recomputed from their citations | 20 exact matches |
| Re-plan | a sold comp injected for a live test item | the plan changes and `score.change` streams within 1 s |
| Update rules | a fixed sequence of offer outcomes through the Beta update with forgetting | the posterior equals the closed form to the cent |

## 8. Worked example

*Every number in this section is an example.* A used Patagonia Better Sweater quarter-zip, men's M, gray, good condition with light pilling on one cuff, 9 photos. The person picked balanced. Two sites shown.

**eBay.** 142 active comps, 38 sold in 90 days, fair value $44 to $62. Fees 13.25% plus $0.40, buyer pays $8.50 shipping.

| Candidate (T = 30) | Path | P(sale) per step | Net per step | E_k | D_k | U_k |
|---|---|---|---|---|---|---|
| Start $54 | $54, $49 day 10, $45 day 20 | 0.38, 0.20, 0.13 | $46.44, $42.11, $38.64 | $31.09 | 14 days | $29.61 |
| Start $59 | $59, $54 day 10, $49 day 20 | 0.25, 0.20, 0.14 | $50.78, $46.44, $42.11 | $27.88 | 18 days | $25.97 |

With `c_balanced` at 0.2% of the $53 midpoint ($0.106 a day), $54 wins. Floor $42 from the person's limit. Free shipping would list at $54 + 0.75 × $8.50 = $60.38; W_s shows free shipping among 10 of 22 winners, not a lead at p < 0.05, so buyer pays. Title: "Patagonia Better Sweater 1/4 Zip Fleece Jacket Mens M Gray" ("Better Sweater" in 19 of 22 winners, "1/4 Zip" in 15). Cover: flat lay (14 of 22 winners); then front, back, the cuff pilling, tag, extras by quality. Timing: 260 pooled listings, a Sunday 19:00 peak 56 hours out beats posting now by 7% against 5% week-to-week noise, so `list_at` is Sunday. Promotion: at a 3% rate it pays when lift exceeds 1 / (1 − 0.03 × 54 / 46.44) = 1.036; the lift's lower bound is 1.02, so it is off. Standing: offer to watchers at $51 (5% minimum) on the first watcher after day 3, with a 7-day cooldown, path drops on auto above $42.

**Poshmark.** 96 active comps, 21 sold in 90 days. Fee 20%, buyer pays a flat shipping label. Best balanced start $58, floor $42, P(sale in 30 days) 0.55, expected net $24.10 after the offers the accept Beta predicts. Same title words cut to the site's form, square cover crop. 140 pooled listings is under the 200 D14 needs, so it lists now. Standing: offer to likers at min(next rung $52, $58 × 0.9 = $52.20) = $52, no relist ever, a bundle discount up to 1 − $42/$58 = 27.6% for a buyer who likes two items, clamped to the site range.

**A re-plan.** On day 6 a similar sweater sells on eBay for $47. The comp fingerprint changes, the eBay range moves to $42 to $60, the new best start is $51, and its U beats the live plan by more than the noise. $51 is on the path and above $42, so the engine runs a `markdown` on auto and the item card shows "1 new sale weighed, price now $51".
