# Adaptation: measures that make each engine fit the site and the kind of item

Status: *agent proposal*, the adaptation lead, 2026-11-15, from [Nate](../../product/words.md#2026-11-15-nate-where-are-we-not-optimized-an-expert-lead-for-real-time-adaptation-the-bundle-identifier-and-sessions-end-before-they-fill): "fit the realtime adapt to each specific platform product type engines, taking into account the data we can gather and calculate things against, combining things to create metrics, all researched and credibly proven". How credible the engines are today, and how we show it, is in [credibility.md](credibility.md); this page is the measures.

A measure here is a number the system computes from fields it can read, that an engine reads to change its answer for a site and a kind of item. Each one has: a definition, the fields it needs, an estimator suited to sparse, censored and mixed data, how it updates in real time as a `param` ([real-time weights](../product.md#real-time-weights-agent-proposal)), what it changes, and how it is proved. A measure is trusted only after its test on data passes; until then it is registered with status `proposed` and no engine reads it.

Labels: *sourced* (a repo file or a page read today says it), *inferred* (this lead's reading), *not found*.

## 1. The data we can actually read

The full table, per site, verb and field with the line that extracts each, is [readable-fields-by-site.md](../../research/list/nate/readable-fields-by-site.md) (*sourced* from the adapters in `app/src/edge/harness/sites/`, 2026-11-15). The summary that the measures stand on:

| Field | eBay | Poshmark | Mercari | Depop | Dupe |
|---|---|---|---|---|---|
| Asking price | live (page) | live | live | live | live |
| Live or sold state, now | live (page still-up) | live | live | live | no |
| Sold search | sign-in only (page); API needs Limited Release | live, `sold_out` | live | none (`no_route`) | no |
| Sold price as its own field | API only (Insights, fixture) | no: the sold row shows the price at sale | no: same | no | no |
| Sale date | API only (fixture) | no | no | no | no |
| Listed date | API (fixture); not on page search | live | live | live (one listing) | no |
| Likes or watchers, public | watchers on the item page (live) | likes, comments, shares (live) | likes (live) | likes (live) | no |
| Views, impressions | sign-in API, 7-day window (fixture) | sign-in, not extracted | sign-in, not extracted | sign-in, not extracted | no |
| Offers | sign-in API (fixture) | sign-in (guessed path) | sign-in (guessed op) | sign-in (guessed path) | no |
| Own orders with price | sign-in API (fixture) | sign-in (guessed) | sign-in (guessed) | sign-in (guessed) | no |
| Condition, size, brand | not on page search | live | live | brand only | no |
| Seller sold count, rating | live (storefront page) | sold count (live) | live | live | no |
| Shipping price | no | no | no | one listing (live) | no |
| Rank, promoted mark, photo count, category, price-drop history | **not extracted on any site** | | | | |

What the terms let us do (*sourced*, quoted in the full table): eBay's API licence bars using its content "to suggest or model prices", so eBay API rows never train a weight; eBay page reads run under Nate's ruling; Poshmark's terms bar automated collection and share, like and repost are only suggested; Mercari is read only on a person's own request; Dupe may be displayed.

Four facts shape everything below (*inferred* from the table):

1. **No public read gives a sale date.** A time to sell can still be measured: a listing read live at time `t0` with listed date `L`, and read again sold at `t1`, sold at an age between `t0 − L` and `t1 − L`. That is an interval-censored, left-truncated observation, a standard case in survival analysis. The person's own listings, read at the watcher's cadence, give this cleanly.
2. **A public "sold" price on Poshmark, Mercari and Depop is the last asking price, not what the buyer paid.** On eBay's Best Offer data, bargained sales close at 0.727 of the list price on average (*sourced*: Backus, Blake, Larsen and Tadelis 2020, Table I, read by the retriever, [measures-literature.md](../../research/price/nate/measures-literature.md) §1). A comp from those sites overstates the sale by whatever an accepted offer took off.
3. **Engagement is public but differs by site:** Poshmark likes, Mercari likes, Depop likes, eBay watchers. One weight for "watchers or likes" across sites, as demand uses today (0.15, `jobs/demand/params.py`), treats them as the same thing.
4. **Rank and promoted marks are not extracted anywhere**, so no measure of a lever's lift on rank can be built yet; it would need the parser first.

## 2. The measures

### Notation

`s` site; `k` kind of item (the canon `kind`), with `f` a family inside it; `u` a person; a listing `i` has asking price `a_i`, listed date `L_i`, age `t` in days since `L_i`; `m̂_i` the valuation's q50 for the item at listing time; price position `x_i = ln(a_i / m̂_i)`; age bands `j ∈ {0–1, 2–3, 4–7, 8–14, 15–30, 31–60, 61–90, 91+}` days, band `j` of length `ℓ_j`.

Every measure below is a `param` row (or a value derived from rows) with scope keys `kind`, `site`, `segment`, `person`, `state`. Reads pool toward the parent scope with κ = 20 and evidence forgets with a 30-day half-life, as the registry does today (*sourced*: `app/src/engines/param/param.ts`, packet 70). Where a measure needs age or price-position cells, they go into `segment` as `age:<band>` or `pos:<band>`, and the parent of a segment cell is the same site and kind without it.

### The first ten

| # | Measure | Definition | Fields it needs | Estimator, and why it suits the data | In real time | Prior | Changes | Proof |
|---|---|---|---|---|---|---|---|---|
| A1 | **Sale hazard by site, kind and age** | `λ_{s,k,j}`: sales per listing-day at risk in age band `j`. `P(sold by T) = 1 − exp(−Σ_j λ_j · min(ℓ_j, (T − start_j)⁺))` | listed date, sold or live state over time; censored: still live, ended, gone | Piecewise-constant hazard (discrete-time survival; Allison 1982). Unsold listings add days at risk and no event, so censoring is used, not dropped. Interval-censored sales split their event over the bands they could have fallen in, in proportion to exposure (a one-step EM, Turnbull's idea) | Gamma rows: each listing-day at risk adds to `b`, each sale to `a` | the parent cell; at the top, Gamma(1, 30): one sale a month | valuation D10/D11 (chance of sale at each rung, days to sell); marketing (which site); recommendation (sell now) | NBER, V1 below |
| A2 | **Price-position effect** | `β_{s,k}` in `λ_{s,k,j}(x) = λ_{s,k,j} · exp(β_{s,k} · x)` | A1's fields plus `m̂` at listing | Poisson regression with log exposure as offset, pooled across sites within a kind (partial pooling; Gelman and Hill 2007), fitted nightly | model row, refitted nightly, promoted on held-out log loss | housing magnitude: a 10% gap cuts the weekly sale hazard 3 to 6% (Genesove and Mayer 2001, abstract), so `β ≈ −0.45`, wide | valuation's ladder (the price slider's chance of sale); marketing's start price | NBER, V1, catalog-linked items only (they have a reference price) |
| A3 | **Offer share** | `π_{s,k,j}`: share of sales in age band `j` closed by an offer | sold rows with "sold through Best Offer"; on other sites the person's own orders against their ask | Beta-binomial per cell, pooled | Beta rows: a sale through an offer adds to `α`, any other sale to `β` | about 0.2 to 0.45 by category; at the top Beta(3, 7) (*inferred* from Backus: about 80% of listings get no offer, 45% of threads agree) | negotiation (expect offers, set the ask above target); valuation (the keep shown) | NBER, V2 |
| A4 | **Offer discount** | `δ_{s,k,j} = E[p_sold / a | sold by offer, band j]` | sold price and the ask at sale | Beta with fractional outcomes: a sale with ratio `r` adds `r` to `α` and `1 − r` to `β`; its mean is the pooled mean ratio. Robust enough at small n and bounded in (0, 1] | Beta rows, per sale | 0.727 mean, Beta(7.3, 2.7) (Backus et al. 2020, Table I: bargained price over list) | negotiation's counter and accept (P_accept's anchor); valuation D13 `d_s,cat`, which today is the median of `(ask − sold)/ask` with prior 0 | NBER, V2 |
| A5 | **Ask-to-sale gap for public sold rows** | `g_{s,k} = 1 − π_{s,k} · (1 − δ_{s,k})`: the expected ratio of what the buyer paid to the price a public sold row shows | A3 and A4 on that site, from the person's own orders | derived, no estimator of its own | derived on read | eBay's `π`, `δ` at the kind level until the site has its own | valuation: a Poshmark, Mercari or Depop sold comp is multiplied by `g` before it enters the basis | on a person's own sales, when linked; until then on NBER as `ask × g` against the true sale |
| A6 | **Expected keep per listing** | `K_{s,k}(a) = P(sold by T | a) · a · g_{s,k} − fee_s(a · g_{s,k})`, the money in hand by `T` per listing at ask `a` | A1, A2, A5 and the fee rows | derived | derived on read | none | marketing's site plan and the ladder; the person sees "what you keep" per site with its chance | V1 and V2 together, scored on realised keep |
| A7 | **Engagement value per site** | `γ_{s,k}`: hazard ratio per unit of `ln(1 + e/t)`, `e` the likes (watchers on eBay) at age `t` | engagement read at two or more times on the same listing | Time-varying covariate in A1's Poisson model, per site, pooled within kind | model row, nightly | 0 (no effect) until proved | demand's engagement weight becomes per site; the watcher's stale step | **no released data can test it**: NBER watchers are totals at the end of a listing, which a long listing inflates. Proved only on the person's own listings read over time |
| A8 | **Family price index and the age of a comparable** | `I_f(τ)` repeat-sales log index; `h_f`, the half-life of a comp's weight | sold price and date, product id | Repeat sales (Bailey, Muth and Nourse 1963; Case and Shiller 1989), one-sided for live use (science audit correction 9) | per sale | 0 drift; `h_f` 90 days | valuation D3 and `w_age` | **owned by the engines lead** (`eng-valuation-2`, ablation on StockX). This page registers it. NBER's catalog-linked items could add a test on electronics, where prices fall fast |
| A9 | **Photo count effect** | `ρ_{s,k}`: hazard ratio per added photo, in bands 1, 2–3, 4–6, 7+ | photo count | covariate in A1 | model row | 1 (no effect) | photo engine (how many shots to ask for, per site and kind) | NBER, V1 ablation. Backus et al. report more photos bring a faster first offer (Fig. VII) |
| A10 | **Seller history effect** | `η_{s,k}`: hazard ratio for a seller with under 10 past sales, against one with more | seller's sold count or feedback count | covariate in A1 | model row | 1 | platform analytics (what a new account on a site can expect); the person's first weeks on a new site | NBER, V1 ablation, feedback count at listing |

### Registered and not proposed for trust now

| Measure | Why not now | What would change it |
|---|---|---|
| Site translation ratio (valuation D4) | no released set has the same products sold on two sites | identity-matched products in the person's own sales on two sites |
| Lever lift: a price drop, a Poshmark share, a promoted slot | our own action changes what we observe; only a randomised choice gives the effect (de Wit and van der Klaauw find a list-price cut raises the sale rate 83% on housing, a competing-risks model; *sourced* by the retriever, excerpt). No site's own page states a measured effect (*sourced*: ranking-levers note) | a randomised plan on the person's own listings, with Nate's go per site, scored by inverse propensity (Horvitz-Thompson; Dudík, Langford and Li 2011) |
| Seasonality by kind | NBER covers 13 months, one cycle: a season cannot be told from a trend | two years of the person's own and gathered sales; until then the prior is no seasonal effect |
| Rank or promoted position effect | rank and promoted marks are not extracted by any adapter | the parser first (a harness change, the orchestrator's) |

## 3. The research behind each

Every source, with what it used and what it shows, is in [measures-literature.md](../../research/price/nate/measures-literature.md), marked READ, excerpt or abstract. What each measure rests on, and how far:

| Measure | Rests on | How far it supports our use |
|---|---|---|
| A1 | Allison (1982), discrete-time event histories; Kaplan and Meier (1958); Turnbull (1976) for interval-censored data (method reference, not fetched) | Established method. The interval-censored split is our own simplification of Turnbull's estimator, *inferred* to be adequate when reads are a few days apart; untested |
| A2 | Genesove and Mayer (2001), list price and sale hazard on Boston condos (abstract only); Carrillo (2012) treats withdrawn listings as censored (excerpt) | The form is established for housing; that it carries to resale goods is our hypothesis, which V1 tests |
| A3, A4 | Backus et al. (2020), 88.4M eBay Best Offer listings: bargained price 0.727 of list, about 80% of listings get no offer, 45% of threads agree, 0.70 collectibles against 0.79 electronics (read by the retriever; Table II partly garbled) | Strong for eBay 2012–13. For other sites it is only a prior until the person's own offers arrive |
| A5, A6 | our own composition of A1 to A4 with the fee rows | **our own and unproven** |
| A7 | Yuan et al. (SIGIR 2011): sale prediction rose from 64% at listing to 80% with demand observations added (excerpt) | shows engagement is informative; says nothing per site. Our per-site claim is unproven |
| A8 | Bailey, Muth and Nourse (1963); Case and Shiller (1989) | established; the engines lead's test decides |
| A9, A10 | Backus et al. (2020) on photos; housing and eBay papers on seller reputation not yet read | association only: a seller who adds photos may differ in other ways |
| Pooling, forgetting | Efron and Morris (1975): James-Stein cut total squared error from 17.56 to 5.01 on 18 batters (excerpt); West and Harrison (1997) on discounting; Garivier and Moulines (2011) on discounted bandits (abstract) | established |

## 4. How each is proved before it is trusted

The rules from [credibility.md](credibility.md#what-would-make-the-scorers-credible): a proper score, a paired comparison on the same items, the simple rule as the bar, counts and intervals by cell, the locked window scored once.

**V1: time to sell on NBER.** Listings started 2012-06-01 to 2013-02-28 train; listings started 2013-03-01 to 2013-04-15 are tested, observed to 2013-06-30, so every test listing has at least 75 days of follow-up or an end. Outcome: sold within 7, 30 and 60 days. Unsold, ended listings are censored at their end; the score uses inverse-probability-of-censoring weights. Contestants, each on the same test listings:

| Contestant | What it is |
|---|---|
| B0 | one hazard for all of eBay |
| B1 | Kaplan-Meier per meta category, no pooling |
| A1 | pooled hazard per category and age band |
| A1+A2 | with price position, catalog-linked listings only |
| A1+A2+A9+A10 | with photos and seller history |

Score: log loss and Brier at each horizon, calibration in deciles of predicted chance, per category, with the by-category paired bootstrap 95% interval of each gain over B0 and B1. **A measure earns its place when its interval of gain over the contestant without it lies above zero in the pooled result and in at least half the categories with 500 or more test listings.** One that does not is dropped and recorded as dropped here.

**V2: offers on NBER.** Sold test listings, same windows. Predict the sale price from the ask: `a` (no discount), `a × δ` global, `a × (1 − π(1 − δ))` per category, and the same per category and age band pooled. Score: median absolute log error, and log loss of "sold by offer" for `π`. Same paired intervals, same bar.

**Limits stated in advance.** NBER is eBay in 2012–13: it proves the estimators and which cells matter, not today's levels, and its rows never set a shipped weight ([data README](../../jobs/valuation/data/README.md#the-nber-ebay-data)). The live proof of each measure is its calibration on the person's own listings once one account is linked: the same score, on answers frozen before the outcome ([credibility.md](credibility.md#how-we-can-show-we-beat-the-other-tools), exhibit 3).

## 5. What gets built, once the proofs pass

Nothing below starts until V1 and V2 have run and this page has had a fresh review (packet 55, the spec pass).

1. **A measures registry as data**, `spec/measures.mjs`: one row per measure with `name`, `definition`, `fields`, `scope`, `prior`, `estimator`, `consumers`, `status` (`proposed`, `proved`, `dropped`, with the run that decided it). A check fails when an engine reads a measure whose status is not `proved`.
2. **The computation**, `app/src/engines/measures/` with its Python twin in `jobs/measures/` and one shared parity fixture: A1's exposure and event bookkeeping (including the interval-censored split), A3 and A4's fractional Beta updates, A5 and A6 as pure functions of the rows. Each exposed through a port (`measures.read(name, scope)`) so an engine never imports the harness or the store.
3. **The NBER reader for V1 and V2**, `jobs/measures/nber.py`, which reads the raw file on the Mac with the columns the frozen rows lack (the ask on sold listings, `bin_rev`), never seller or buyer ids, reusing the product-hash sampling of `jobs/valuation/data/freeze.py` without changing it.

## 6. Named fixes for the engines that should consume them

Sent to the orchestrator for each owning lead; this page does not edit their code.

| Fix | Engine | Change | Test |
|---|---|---|---|
| AD1 | valuation | a sold comp from Poshmark, Mercari or Depop enters the basis at `price × g_{s,k}` (A5), not at its shown price; `price_type` `sold_at_ask` names such a row | a Poshmark sold comp at $100 with `g` 0.93 enters at $93; an eBay Insights sold row is unchanged |
| AD2 | valuation | D10's chance of sale reads A1 and A2 by site and kind instead of one curve per group | the ladder's chance at a rung changes when only `site` changes |
| AD3 | demand | the engagement signal is per site (A7): likes on Poshmark, Mercari and Depop and watchers on eBay are separate rows, each at weight 0 until A7 is proved | demand's answer is unchanged by likes until A7's row is `proved` |
| AD4 | negotiation | `P_accept`'s anchor and the counter read A3 and A4 at `(site, kind, age band)`; D13 `d_s,cat` becomes A4 | two offers on the same item listed 3 and 45 days read different anchors |
| AD5 | marketing | the site plan ranks sites by A6 (expected keep by `T`) | an item with the same price on two sites is planned for the site with the higher `K` |
| AD6 | platform analytics | expected sales for a new account read A10 | a seller with 2 past sales gets a lower expected count than one with 50, same item |
| AD7 | harness (orchestrator) | extract photo count, category, rank and the promoted mark where the page shows them | a recorded search page yields rank 1 to n and the promoted flag |

## 7. What is proved first

In order, each with what it needs:

1. **V2 (offers)**: the smallest run and the most direct gain, since every Poshmark, Mercari and Depop comp is affected by A5. Needs `jobs/measures/nber.py` on the Mac.
2. **V1 with A1 against B0 and B1**: whether pooling a hazard by category and age beats a flat or unpooled one.
3. **A2, A9, A10 as ablations on V1.**
4. **A7 and the live calibration of A1 to A6**: wait on one linked account (M6).

## Not found

- A published measured effect of any marketplace lever on time to sell (ranking-levers note).
- An eBay watcher-count or Poshmark-likes effect size in the literature (measures-literature.md, "Not found").
- Whether NBER's `anon_bo_threads.csv.gz` (offer sequences) is on the Mac: only `anon_bo_lists` is recorded there (packet 70).
