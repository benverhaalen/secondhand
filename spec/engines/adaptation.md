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

`s` site; `k` kind of item (the canon `kind`), with `f` a family inside it; `u` a person; a listing `i` has asking price `a_i`, listed date `L_i`, age `t` in days since `L_i`, first read by us at age `t0_i`; `m̂_i` our valuation's q50 for the item, frozen at the listing's first read; price position `x_i = ln(a_i / m̂_i)`; age bands `j ∈ {0–1, 2–3, 4–7, 8–14, 15–30, 31–60, 61–90, 91+}` days, band `j` covering ages `[start_j, end_j)`.

How the measures live in the registry (*sourced*: `app/src/engines/param/param.ts`): rows are scoped by `kind`, `site`, `segment`, `person`, `state`, and evidence forgets with a 30-day half-life. **Beta and Gamma rows** update on each observation (`observe`) and pool toward the parent scope on read (`readPooled`, κ = the learnable `POOL_KAPPA`, prior 20). **Model rows** (a fitted coefficient) do neither: they are refitted nightly and promoted on a held-out win. Age and price-position cells go into `segment` as `age:<band>` or `pos:<band>`; the parent of a segment cell is the same site and kind without it. Valuation's ±50% guard does not fit these rows (it would hold a prior of 0 at 0 forever), so each A row states its own guard below.

### The first ten

| # | Measure | Definition | Fields it needs | Estimator, and why it suits the data | Row and guard | Prior | Changes | Proof (§4) |
|---|---|---|---|---|---|---|---|---|
| A1 | **Sale hazard by site, kind and age** | `λ_{s,k,j}`: sales per listing-day at risk in band `j`. For a live listing of age `t0`, `P(sold by t0 + T given live at t0) = 1 − exp(−∫_{t0}^{t0+T} λ(t) dt)`, the integral summing `λ_j` over the days of each band in the window | listed date; live, sold, ended or gone at each read | Piecewise-exponential survival (Holford 1980), the continuous-time cousin of the discrete-time model (Allison 1982). Exposure starts at our first read, which handles listings we only meet part-way (left truncation). Unsold listings add days at risk and no event, so they are counted, not dropped. A sale seen between two reads is split over the bands it could fall in, weighted by `λ_j` times exposure (one EM step, Turnbull's idea) | Gamma (`shape` += sales, `rate` += days at risk); guard `λ ∈ [1/3650, 1]` per day | the parent cell; at the top Gamma(1, 30), one sale a month | valuation D10 and D11; marketing (which site); recommendation (sell now) | P1 |
| A2 | **Price-position effect** | `β_{s,k}` in `λ_{s,k,j}(x) = λ_{s,k,j} · exp(β_{s,k} · x)`, with `x` read from our valuation as frozen at first read, never a later price | A1's fields plus `m̂` at first read | Poisson regression with log exposure as offset, partially pooled across sites within a kind (Gelman and Hill 2007) | model row, nightly; guard `β ∈ [−5, 1]` | `−0.45`, wide (sd 0.5): by analogy only to Genesove and Mayer (2001), whose gap is the seller's loss exposure on housing, not ask against market (*inferred*) | valuation's ladder (the chance at each rung); marketing's start price | P1 |
| A3 | **Offer share** | `π_{s,k,j}`: the share of sales in band `j` closed by an accepted offer | the person's own orders with their offers | Beta-binomial per cell, pooled | Beta; guard `[0.01, 0.99]` | Beta(1.5, 3.5), a weak guess: Backus et al. give per-listing and per-thread rates (about 80% of listings get no offer; 45% of threads agree), which do not convert to a share of sales without the sale rate (*inferred*) | negotiation; valuation's keep | P2 |
| A4 | **Offer discount** | `δ_{s,k,j} = E[p_sold / a given a sale by offer in band j]`, `a` the last ask we read | the person's own orders and offers | Beta with fractional outcomes: a sale with ratio `r = min(1, p/a)` adds `r` to `α` and `1 − r` to `β`; the ratio is clamped at observe, since `observe` does not check it (param.ts) | Beta; guard `[0.3, 1]` | Beta(7.3, 2.7), mean 0.727: bargained price over list on eBay Best Offer, 2012–13 (Backus et al. 2020, Table I), a published figure used as a starting value, labelled as eBay's | negotiation's counter and anchor | P2 |
| A5 | **Ask-to-sale gap for public sold rows** | `g_{s,k} = 1 − π_{s,k} · (1 − δ_{s,k})`: the expected ratio of what the buyer paid to the price a public sold row shows, assuming sales not by offer close at the ask | A3, A4 | derived. At the priors, `g = 1 − 0.3 × 0.273 = 0.918` | derived on read | from the priors until the site has its own A3 and A4 | valuation: a Poshmark, Mercari or Depop sold comp enters the basis at `price × g` (AD1). D4's site ratios are then computed on corrected prices, so the gap is not counted twice | P2. That eBay's offer behaviour carries to other sites is *inferred* and untested until P2 |
| A6 | **Expected keep per listing** | `K_{s,k}(a, T) = P(sold by T given a) · (a · g − fee_s(a · g)) − listing_fee_s`: the money in hand by `T`, net of fees, with the sale fee charged only on a sale | A1, A2, A5, the fee rows (money D9) | derived | derived on read | none | marketing's site plan and the ladder; "what you keep" per site with its chance. Example: `P` 0.2, $100 ask, `g` 1, 13% fee, no listing fee: `K` = $17.40 | scored on P2's realised keep |
| A7 | **Engagement value per site** | `γ_{s,k}`: the log hazard ratio per unit of `ln(1 + e / max(t, 1))`, `e` the likes (watchers on eBay) read at age `t` | likes or watchers at two or more reads of the same listing | time-varying covariate in A2's Poisson model, per site, pooled within kind | model row, nightly; guard `[−1, 2]` | 0 | demand's engagement signal per site (AD3); the watcher's stale step | P1 only: no other data has likes over time |
| A8 | **Family price index and the age of a comparable** | `I_f(τ)` repeat-sales log index; `h_f`, the half-life of a comp's weight | sold price and date, product id | repeat sales (Bailey, Muth and Nourse 1963; Case and Shiller 1989), one-sided for live use (science audit correction 9) | per sale | 0 drift; `h_f` 90 days | valuation D3 and `w_age` | **owned by the engines lead** (`eng-valuation-2`). Registered here; its proof is theirs |
| A9 | **Photo count effect** | `ρ_{s,k}`: log hazard ratio per photo band (1, 2–3, 4–6, 7+) | photo count | covariate in A2's model | model row; guard `[−1, 1]` | 0 | photo engine (how many shots per site and kind) | P1, once photo count is extracted (AD7): **no adapter reads it today** |
| A10 | **Seller history effect** | `η_{s,k}`: log hazard ratio for a seller with under 10 past sales | the seller's sold count (storefront, live on all four sites) | covariate in A2's model | model row; guard `[−2, 1]` | 0 | platform analytics: what a new account on a site can expect | P1 |

### Registered and not proposed for trust now

| Measure | Why not now | What would change it |
|---|---|---|
| Site translation ratio (valuation D4) | no current data with the same product sold on two sites | identity-matched products in P1 and P2 |
| Lever lift: a price drop, a Poshmark share, a promoted slot | our own action changes what we observe, so only a randomised choice gives the effect; no site states a measured effect (*sourced*: ranking-levers note). A price drop is visible in P1 as a lower ask on re-read, but who drops and when is the seller's choice, so P1 shows association only | a randomised plan on the person's own listings, with Nate's go per site, scored by inverse propensity (Horvitz-Thompson; Dudík, Langford and Li 2011) |
| Seasonality by kind | needs at least two years of current data to tell a season from a trend | P1 and P2 over time; until then no seasonal effect |
| Rank or promoted position effect | rank and promoted marks are not extracted by any adapter | AD7 first |

## 3. The research behind each

Every source, with what it used and what it shows, is in [measures-literature.md](../../research/price/nate/measures-literature.md), marked READ, excerpt or abstract.

| Measure | Rests on | How far it supports our use |
|---|---|---|
| A1 | Holford (1980) piecewise-exponential model and Allison (1982) discrete-time event histories (excerpt); Kaplan and Meier (1958); Turnbull (1976) for interval-censored data (method reference, not fetched) | established methods. The one-step interval split is our own simplification of Turnbull's estimator, *inferred* adequate when reads are a few days apart; P1's synthetic test checks it |
| A2 | Genesove and Mayer (2001), list price and sale hazard on Boston condos (abstract only); Carrillo (2012) treats withdrawn listings as censored (excerpt) | the form is established for housing; that it carries to resale goods is our hypothesis, which P1 tests |
| A3, A4 | Backus et al. (2020), 88.4M eBay Best Offer listings, 2012–13: bargained price 0.727 of list, about 80% of listings get no offer, 45% of threads agree, 0.70 collectibles against 0.79 electronics (read by the retriever; Table II partly garbled) | a published figure used as a starting value, nothing more; today's levels come only from P2 |
| A5, A6 | our own composition of A1 to A4 with the fee rows | **our own and unproven** |
| A7 | Yuan et al. (SIGIR 2011): sale prediction rose from 64% at listing to 80% with demand observations added (excerpt) | shows engagement is informative; says nothing per site. Our per-site claim is unproven |
| A8 | Bailey, Muth and Nourse (1963); Case and Shiller (1989) | established; the engines lead's test decides |
| A9, A10 | Backus et al. (2020): more photos, a faster first offer (Fig. VII) | association only: a seller who adds photos may differ in other ways |
| Pooling, forgetting | Efron and Morris (1975): James-Stein cut total squared error from 17.56 to 5.01 on 18 batters (excerpt); West and Harrison (1997) on discounting; Garivier and Moulines (2011) on discounted bandits (abstract) | established |

## 4. How each is proved before it is trusted

On today's market, not on old data ([Nate](../../product/words.md#2026-11-15-nate-not-focused-on-old-data-unless-it-holds-relevance): "i dont like that you're still focused on such old data, unless it can hold some relevance"). The 2012–13 eBay set is not run. Its one use is Backus et al.'s published figures as starting values for A3 and A4, labelled as eBay's, which the person's own offers replace as they arrive. That the code computes each measure correctly is proved on synthetic markets with known answers, as the backtest runner's self-test already does for valuation. That the measure is *right* is proved only on the three current sources below. The rules are those of [credibility.md](credibility.md#what-would-make-the-scorers-credible): a proper score, a paired comparison on the same listings, the simple rule as the bar, counts and intervals by cell.

**S0: the code, on synthetic markets.** Each estimator recovers a known truth within its interval: a two-kind market with hazards 0.02 and 0.10 a day; interval-censored sales from reads 1 to 7 days apart; listings first met part-way through their life; a competing "ended unsold" risk; offers that take exactly 20% on half of sales. A listing still live at the end of observation is censored there, never dropped. This proves the arithmetic, not the market.

**P1: the live panel (needs Nate's decision on which sites, [credibility.md](credibility.md#decisions-that-are-nates)).** Every listing the product's own searches return for the [benchmark's](../benchmark.md) fixed items enters the panel at its first read, with its ask, listed date, likes or watchers, the seller's sold count, and our valuation frozen at that moment. It is re-read with the site's still-up read every two to three days, at the site's pace, until it is sold, ended or gone, or 60 days pass. What it gives today: A1 by site, kind and age; A2; A7, the only source with likes over time; A10; the price drops sellers make; and, as a by-product, a score of our own valuation against what happened (credibility exhibit 3). What it cannot give: the price a buyer paid on Poshmark, Mercari or Depop (only the last ask), so not A3 or A4.

- *Design.* Listings entering in the first two weeks fit; listings entering in weeks three and four are tested, with follow-up to day 60 of the panel. Contestants on the same test listings: B0, one hazard for every site; B1, per site and kind, unpooled; A1, pooled by site, kind and age; then A1 with A2, A7 and A10 added one at a time.
- *Primary score:* log loss of "sold within 14 days of first read", weighted by the inverse probability of censoring. Brier, the 30-day horizon once follow-up allows, and a 10-bin calibration table are reported beside it. Valuation's D10 bar (AUC of at least 0.6, calibration within 5 points; [valuation.md §9](valuation.md#9-proof)) is reported too, since AD2 replaces D10's curve only if A1 meets it.
- *Ending is a competing risk.* A seller who ends a listing that looks unlikely to sell makes ending depend on the hazard. So both are reported: the net chance assuming the person keeps it listed (ending censored, which overstates the chance when ending is informative), and the observable cumulative incidence of sale with ending as a competing event (Aalen-Johansen). A listing that vanishes without a sold mark is censored at its last live read; valuation's D10 counts it as a fractional sale instead, and one rule for both is a named fix (AD2).
- *Pass bar.* The by-product paired bootstrap 95% lower bound of the gain in the primary score over the contestant without the measure is above 0 pooled, and no site with 200 or more test listings is worse after Holm's correction. A measure that fails is dropped and recorded here.
- *Size.* To read `P(sold within 14 days)` to about ±0.07 in a cell takes about 150 to 200 listings (*inferred*, binomial). Four sites and five families at 200 each is 4,000 listings and about 40,000 reads over 30 days; two sites, about half that.

**P2: the person's own account (waits on M6, one linked account).** Their listings, offers and orders give the true sale price beside the ask: A3, A4 and A5 per site, and A6's realised keep. Scored the same way, on answers frozen before each outcome.

**P3: the 2026 public-licence sets as level checks.** `ebay_comps_cc0` (570 sold, August to September 2026), `mercari_apify_ccby` (462, October 2026) and `goodwill_cc0` (2,678 hammer prices) are current, but their `may_model` is false (*sourced*: [datasets.md](../plans/backtest/datasets.md), the data-for-proof sweep). They may check a level, such as whether a family's sold prices sit where A5 and the valuation say, and never set a weight.

## 5. What gets built, once the proofs pass

Nothing below starts until this page has had a fresh review (packet 55, the spec pass) and S0's tests are written first.

1. **A measures registry as data**, `spec/measures.mjs`: one row per measure with `name`, `definition`, `fields`, `scope`, `row` (Beta, Gamma, model, derived), `prior`, `guard`, `estimator`, `consumers`, `status` (`proposed`, `proved`, `dropped`, with the run that decided it). A check fails when an engine reads a measure whose status is not `proved`.
2. **The computation**, `app/src/engines/measures/` with its Python twin in `jobs/measures/` and one shared parity fixture: A1's exposure and event bookkeeping (interval split, left truncation, censoring at the end of observation), A3 and A4's fractional Beta updates with the clamp, A5 and A6 as pure functions of the rows. Each read through a port (`measures.read(name, scope)`) so an engine never imports the harness or the store.
3. **The panel's scorer**, `jobs/measures/panel.py`, reading the panel's `observation` rows and printing P1's table. The panel's recorder (first read, re-reads at pace) belongs to the watcher and harness, so it is a named fix (AD8), not built here.

## 6. Named fixes for the engines that should consume them

Sent to the orchestrator for each owning lead; this page does not edit their code. Each lands only after its measure is `proved`.

| Fix | Engine | Change | Test |
|---|---|---|---|
| AD1 | valuation | a sold comp from Poshmark, Mercari or Depop enters the basis at `price × g_{s,k}` (A5), not at its shown price; `price_type` `sold_at_ask` names such a row; D4's ratios are computed on corrected prices | a Poshmark sold comp at $100 with `g` 0.918 enters at $91.80; an eBay Insights sold row is unchanged |
| AD2 | valuation | D10's chance of sale reads A1 and A2 by site and kind, conditional on the listing's current age, if A1 meets D10's bar in P1; one rule for a vanished listing in both | the ladder's chance at a rung changes when only `site` changes; a 20-day-old listing reads a different chance from a new one |
| AD3 | demand | the engagement signal becomes one row per site (likes on Poshmark, Mercari and Depop, watchers on eBay), each starting at today's 0.15 (`jobs/demand/params.py`), moved by A7 once proved. Whether to start lower is the demand owner's call | two sites with the same likes count give different engagement weights once A7 differs |
| AD4 | negotiation | the counter and `P_accept`'s anchor read A3 and A4 at `(site, kind, age band)`; D13's `d_s,cat`, a median of `(ask − sold)/ask` over all sales, becomes `1 − g_{s,k}` (A5), not A4 | two offers on the same item listed 3 and 45 days read different anchors |
| AD5 | marketing | the site plan ranks sites by A6 | an item with the same price on two sites is planned for the site with the higher `K` |
| AD6 | platform analytics | expected sales for a new account read A10 | a seller with 2 past sales gets a lower expected count than one with 50, same item |
| AD7 | harness (orchestrator) | extract photo count, category, rank and the promoted mark where the page shows them | a recorded search page yields rank 1 to n and the promoted flag |
| AD8 | watcher and harness (integration, orchestrator) | the panel recorder: every listing a product search returns is stored as an `observation` at first read with our frozen valuation, and re-read with still-up at the site's pace until it resolves | a listing read live then sold yields one interval-censored sale with both read times |

## 7. What is proved first

1. **S0** for A1, A3, A4, A5 and A6: the synthetic markets above, written as failing tests first. Needs nothing but the repo.
2. **P1**, once Nate decides which sites may be re-read and AD8 lands: A1 against B0 and B1, then A2, A7 and A10 one at a time.
3. **P2**, once one account is linked: A3, A4, A5, A6.

## Not found

- A published measured effect of any marketplace lever on time to sell (ranking-levers note).
- An eBay watcher-count or Poshmark-likes effect size in the literature (measures-literature.md, "Not found").
- Whether an eBay item page shows the accepted Best Offer price to the public (the page read extracts price, state and watchers only).
