# How credible our scorers are, and how we prove we beat the other tools

Written 2026-11-15 by the adaptation lead, for [Nate](../../product/words.md#2026-11-15-nate-how-credible-and-research-proven-are-our-scorers-real-time-against-2012-to-2013-and-proving-we-beat-the-other-tools): "assess how credible and research proven our scorers and such deterministic system we had in place were ... What would help us easily prove or exhibit outperfroming competitors and other tools in our depth of research, and how we aid people."

Labels: *sourced* (a file in this repo or a page fetched today says it, named in place), *inferred* (this lead's reading), *not found* (looked for, absent). Everything below the verdict is an *agent proposal* until Nate accepts it.

## The verdict

1. **The methods are credible on paper.** Nearly every scorer uses a method from the literature that fits its job: comparable sales with Kish effective sample, credibility blending toward a parent, split and adaptive conformal ranges, Kaplan-Meier with a cure model for time to sell, Fellegi-Sunter matching, hierarchical logistic for offers, Gamma-Poisson shrinkage for site comparison (*sourced*: the per-engine table of [the science audit](../plans/sweep/science-audit.md#per-engine-table), which checked each against its primary source). The choices match the literature; the audit still judges several not yet defensible as specified (the calibration gate, the time index, real-time gathering) and lists where the code departs from them, and those corrections are open.
2. **The proof on data is thin.** One scorer, valuation, has been run on real sales: one market (StockX), one kind (deadstock sneakers), 2017 to 2019 (*sourced*: [claims.md](../plans/backtest/claims.md), [packet 70](../../.agents/team/packets/team/70-engines-handoff.md)). By the engines lead's count 2 of 11 engine pieces have touched real data ([completion.md](../plans/finalization.md#13-what-works-kept-by-the-orchestrator)). Time to sell, offers, trust, identity, demand, platform comparison, ranking and the listing score have run only on constructed cases, scripted buyers or parity fixtures. So a reader can be told *how* each scorer decides, but for all of them except valuation, not *how often it is right*.
3. **On the one market we measured, the model the app serves loses to the simple lookup.** The comps engine the app serves is off by 6.25% at the median, against 3.25% for the item's last sale and 5.76% for its 90-day median, on 41,988 StockX sales of November 2018 to February 2019 (*sourced*: packet 70). The nightly Python model, which starts from the product's own recent sales, does match the last sale on March to October 2018, eight months nobody looked at while building it: 3.2% against 3.3%, and 97.5% within 20% against 89.4% for the 90-day median, a paired lift of +7.0 points (95% interval 5.7 to 8.3) on 35,862 items (*sourced*: claims.md). That model is not the one the app serves. **The most credible thing we have is not in the product yet.**
4. **Nothing is measured on today's market.** No answer we have served has been checked against what the item later sold for. The real-time loop that would let an observation move a weight works on 1 of 10 links, and that one is determinism: none of the nine links that carry data works (*sourced*: completion.md). Every number above is retrospective.

What this means for a public claim today: the only honest one is the StockX line in [claims.md](../plans/backtest/claims.md#the-strongest-honest-line-today), scoped to StockX deadstock sneakers and to the nightly model. Nothing about used goods, about other sites, or about the app as served can be claimed yet.

## How credibility is weighed

*Agent proposal*, the adaptation lead, for [Nate](../../product/words.md#2026-11-15-nate-how-credibility-should-be-weighed-and-the-value-we-bring-truly-defined): "how do you believe credibility should be weighed ... its important you assess that it's proven how we deliver things. That the value our system brings is truly defined."

**Credibility belongs to a claim, not to a method or a system.** A claim is a quantity, for a population (site, kind, basis level), at a time, against a baseline. "Our range holds 80%" is not a claim. "On eBay page reads of used apparel in November 2026, at the family basis level, 78 of 100 sales fell inside our 80% range" is. Each claim is weighed by the highest rung its evidence has reached, and is stated no higher.

| Rung | What the evidence is | What it proves | What it cannot prove |
|---|---|---|---|
| L0 | a primary source says this method suits data of this shape | that the choice is reasonable | anything about our results: the 294 papers Kapoor and Narayanan found had sound-looking methods too |
| L1 | the code recovers a known truth on a synthetic market | that the arithmetic is right | anything about any market |
| L2 | a frozen-as-of backtest on released real sales, scored once on a locked window | that the method works on that market, in that period | today; another site; our own sources |
| L3 | answers frozen before the outcome, on today's listings, scored when they resolve | that the product is right on today's market, for the cells measured | that it beats anyone else |
| L4 | L3, with named rivals asked the same day about the same items, scored paired | that we are more accurate than they are | that a person is better off |
| L5 | a randomised comparison on people's own listings: our plan against their own plan or the site's suggestion | that we caused the difference in money kept or days to sell | anything beyond the people and sites in it |

The rules for weighing:

1. **The literature is L0 and the prior, never the proof.** It tells us what a valid test looks like (a proper score, a paired test, a locked window) and how large an effect is plausible (Backus et al.'s 0.727, Genesove and Mayer's hazard slope). Those numbers start a `param`. They are never shown to a person as a fact about their item. A method carried from another domain (housing to resale) is a hypothesis until it reaches L2 or L3 in ours.
2. **A higher rung overrides a lower one.** When L3 disagrees with L2, L3 wins and L2 is recorded as not carrying to today. When a measure fails at L3 it is dropped, whatever its literature says.
3. **Nothing transfers between cells for free.** StockX sneakers do not vouch for used apparel on Poshmark. A thin cell may borrow from its parent, as the registry pools, but the claim then names the parent's evidence and the borrowing.
4. **Beat the strongest simple rule, not a straw man.** The bar is the best of last sale, the 90-day median, the site's own suggestion and the person's own first price, on the same items. A win over "no discount" or "one rate for everything" tests the code. It supports no claim.
5. **Report the share of the reachable gap we close,** not only the raw error: `skill = (S_base − S_ours) / (S_base − S_ceiling)`, where `S` is a proper score, `S_base` the strongest simple rule's and `S_ceiling` the market's own noise (repeat sales of the same thing: on StockX 99.7% within 20%, [claims.md](../plans/backtest/claims.md)). This is the forecasting literature's skill score (Murphy 1988; a method reference, not fetched). On StockX, against the 90-day median and taking "within 20%" as the score, the nightly model's skill is `(97.5 − 89.4) / (99.7 − 89.4) = 0.79` (*inferred* from claims.md's figures). It closed about four fifths of the gap to the market's own noise.
6. **Every figure carries its rung, its count and its interval**, and the rows we lose are published beside the rows we win ([benchmark.md](../benchmark.md) rule 5). C4 below enforces it.

Where we stand by these rules: valuation is at L2 on one market. Every other scorer is at L0 or L1. Nothing is at L3, L4 or L5.

## The value we bring, defined

Accuracy is not the value. A better price estimate is worth something only if it changes what the person does (the ask, the site, the offer they accept) and that change improves what they end up with. So value is defined on outcomes, against what the same person would have done without us.

For one item `i` of person `u`:

`ΔV_i = (k_i − k_i^cf) − c_u · (d_i − d_i^cf) − w_u · (h_i − h_i^cf) + ℓ_i`

| Symbol | Meaning | How it is measured |
|---|---|---|
| `k_i` | money kept: the sale price less the site's fees and the shipping the seller paid, in cents; 0 if unsold by the horizon | the person's own orders (P2) |
| `d_i` | days from listing to sale, censored at the horizon | the person's own listings |
| `h_i` | the person's hours: photographing, writing, crosslisting, answering, delisting | timed in the app; for the counterfactual, the person's own estimate (*asserted* by them) |
| `ℓ_i` | loss avoided: a scam blocked, a sale below the floor refused, a double sale prevented | trust and delist records, counted only where the threat is confirmed |
| `c_u` | what a day of waiting costs this person | their goal (quick, balanced, max return), read from `marketing_holding_cost_<goal>` (`app/src/engines/marketing/params.ts:6-8`), scoped per person |
| `w_u` | what an hour is worth to them | asked, never assumed |
| `·^cf` | the counterfactual: what this person would have done without our plan | **only a randomised comparison gives it (L5)**: on consenting people's items, a fair coin picks our plan or their own first plan (or the site's suggestion), both at or above the person's floor |

The headline value is the mean of `ΔV` over items with its 95% interval, with its parts beside it (money, days, hours, losses avoided) and the unsold share in each arm. Each engine's share comes from what it changes:

| Engine | The value it delivers | The outcome that shows it | Rung needed to claim it |
|---|---|---|---|
| valuation and the ladder | an ask that sells at or above the floor within the person's horizon, without leaving money behind | `k` and `d` against the person's own first price; the share sold in under 24 hours (a sign the ask was low) and the share unsold at the horizon (too high) | L5 for "more money", L3 for "accurate" |
| time to sell | a chance of sale the person can plan on | calibration on the panel and on their listings | L3 |
| marketing (which site, which plan) | the site where this item does best | `k` and `d` against a single-site plan | L5 |
| negotiation | more kept per accepted offer, without losing the buyer | keep per offer against accepting the first offer at or above the floor, by off-policy weighting on logged offers | L5, or L3 with a stated off-policy estimator |
| trust | scams stopped, honest buyers not lost | precision and recall on labelled threads | L3 |
| intelligence and search | answers other tools cannot give: sold prices across sites, sources per number, freshness | benchmark rows 1 to 6 and 9 | L4 |
| crosslisting and delist | hours saved, no double sale | `h` and the double-sale count against the person's manual routine | L3 for time, L4 against crosslisters |

What this asks of the build, as named fixes:

- **C5 (integration).** A value ledger per person: every plan we proposed, what the person chose, the outcome, and the arm it was in, written as `observation` rows. Test: an item's `ΔV` can be recomputed from the ledger alone.
- **C6 (marketing, with Nate's go per site).** The randomised comparison: on items whose owner opted in, a coin decides between our plan and their own first plan, both above the floor. It is never used below the floor or on an item the person marks urgent, and the person sees both plans. Test: the arm is recorded before the listing goes live, and an item can never be in both arms.

The choice of `c_u` and `w_u`, and whether people are asked to opt in to the comparison, are Nate's.

## Scorer by scorer

Grades: **method** (a primary source fits the use), **real data** (run on released or live sales, with the dataset named), **beats the baseline** (paired, on the same items, with an interval), **today** (checked on answers frozen before a current sale).

| Scorer | What it decides | Method | Real data | Beats the baseline | Today | The open fault that matters most |
|---|---|---|---|---|---|---|
| Valuation middle, served (`app/src/engines/valuation/comps.ts`) | the price | yes: comps, Kish, credibility blend | StockX 2019 | **no**: 6.25% against 3.25% last sale | no | the anchored middle and the per-family index and age rule are being built (`eng-valuation-2`); comps match on all title words, so never at variant level ([completion.md](../plans/finalization.md#13-what-works-kept-by-the-orchestrator)) |
| Valuation, nightly model (`jobs/valuation/market.py`) | the price | yes | StockX 2019, unseen months | **yes**: +7.0 points within 20% over the 90-day median; ties last sale | no | not served |
| Range (conformal, `check.ts`, `backtest.py`) | the low and high | yes: split and adaptive conformal | StockX 2019 | holds 84.3% for an 80% range (Wilson 84.0 to 84.7): inside the 75 to 85% band, but over-covering 80%, at a width of 27% of the price | no | the gate cannot be passed at the sizes named; no test-point mass in weighted conformal; dollar scale where errors are multiplicative (science audit corrections 3, 5, 6) |
| Thin basis (`n_eff`, `proof.ts`, `gather.ts`) | whether the basis is enough | yes: Kish | the served gate: not measured. The nightly model's declines were items the median got right only 63% of the time, against 89% overall (claims.md) | n/a | no | two formulas disagree; loose matches count like exact ones (science audit correction 2; real-time proof link 6) |
| Time to sell (D10) | chance of sale by a date | yes: Kaplan-Meier, cure model, IPCW | **none**: StockX has no unsold rows | not run | no | no current data with unsold listings yet; the live panel is the way ([adaptation.md §4](adaptation.md#4-how-each-is-proved-before-it-is-trusted)) |
| Offer accept (`negotiation`, `P_accept`) | accept, decline or counter | yes: hierarchical logistic, Thompson sampling | **none**: scripted buyers | not run | no | the simulator draws walk-away prices from accepted offers, so it favours aggressive policies; no off-policy estimator (science audit, negotiation row) |
| Trust | block, ask or warn | yes: Bayesian logistic, isotonic | none | not run | no | ECE bins not named; no labelled threads |
| Identity (`reconcile.ts`) | same product or not | yes: Fellegi-Sunter | none scored | not run | no | `model` alone becomes `exact`; every search row is unresolved (science audit; [optimization-gaps.md](../plans/optimization-gaps.md#accuracy)) |
| Demand forecast | price and demand ahead | yes: split conformal | none | not run | no | independence of terms unstated |
| Platform comparison | which site does best for a person | yes: Gamma-Poisson shrinkage | none | not run | no | needs a person's sales on two sites |
| Ranking and style | what to show | partly: logistic on impressions | none | not run | no | promotion scored on what the champion chose to show (position bias) |
| Claim gate (`app/src/edge/gate/claims.ts`) | whether a sentence is backed | rule check | 20 constructed drafts, 10 planted false, all held | n/a | no | constructed cases only |
| Capture photo score | which shots are good enough | rule check | Ben's 3 real garments | n/a | no | one run, not accuracy |

## What data can prove what

Nate: "Theres value to realtime vs 2012 to 2013." The two kinds of data prove different things, and only the second is about the market a person sells into.

| | Released history (StockX 2017-19; the eBay 2012-13 set, not run) | Live, today (answers frozen now, scored when the item sells) |
|---|---|---|
| What it proves | that the method is right: on rows with known outcomes, does the estimator beat simple rules, is its range calibrated, does handling unsold listings properly change the answer, does pooling a thin cell toward its parent help | that the product is right: today's prices, today's sites, the sources we can actually read, the item a person actually has |
| What it cannot prove | today's price levels; any site but the one recorded; our harness's coverage | anything soon: a listing takes days to weeks to sell, and the unsold ones must be counted too |
| Leakage risk | the main risk; the runner's frozen-as-of history and locked windows are the guard (*sourced*: claims.md) | none by construction, if the answer is frozen with its hash before the outcome |
| Terms | StockX released for analysis; NBER "cleared for public release by eBay.com" for research, so a method test, not the shipped model's weights (*sourced*: [jobs/valuation/data/README.md](../../jobs/valuation/data/README.md#the-nber-ebay-data)) | the site's own rules on reading, per [the inventory](adaptation.md#1-the-data-we-can-actually-read) |

Nate: "i dont like that you're still focused on such old data, unless it can hold some relevance" ([words](../../product/words.md#2026-11-15-nate-not-focused-on-old-data-unless-it-holds-relevance)). So released history is used for one thing only, the StockX runs that already exist as a method check, and the eBay 2012–13 set is not run; its published figures (Backus et al. 2020) serve only as starting values, labelled as eBay's ([adaptation.md §4](adaptation.md#4-how-each-is-proved-before-it-is-trusted)). Every new proof is on current data: the live panel, the person's own account, and the 2026 public-licence sets as level checks.

**Zillow is the model to copy for today** (*sourced*: [zillow.com/zestimate](https://www.zillow.com/zestimate/), read 2026-11-15, "Last refreshed 2026-11-08 · Monthly refresh"). It publishes a median error of 1.80% for homes on the market and 7.21% for homes off it, per metro, with the count of homes and the share within 5, 10 and 20%, refreshed monthly. Its method: "comparing the Zestimate shown before the home goes pending with the final recorded sale price". Two lessons:

- The number is the one shown *before* the outcome, scored against the outcome. That is the forecast duel this repo already designed ([benchmark.md](../benchmark.md) rule 1; [claims.md](../plans/backtest/claims.md), "The forecast duel"), and it is the only kind of number that can be about today.
- Zillow splits the figure by what the model could see. On the market it sees the asking price, and is four times more accurate. Our StockX figures are the on-market case: the product's own last sale is in view, which is why last sale is so hard to beat there. A person photographing an item they own is the off-market case. Our published figures must be split the same way: by `basis_level` (variant, product, family, kind, prior), never pooled into one flattering number (*inferred*).

## What would make the scorers credible

Each line is a standard a referee would hold us to, its source, and where we stand.

| Standard | Source | Where we stand |
|---|---|---|
| Score with a proper scoring rule, so the system cannot do better by bending its answer: the interval score for a range, pinball loss for a quantile, log loss or Brier for a chance of sale | Gneiting and Raftery (2007), "Strictly proper scoring rules, prediction, and estimation", JASA 102(477), [doi:10.1198/016214506000001437](https://doi.org/10.1198/016214506000001437): proposes "the intuitively appealing interval score ... that addresses width as well as coverage" (*sourced*, abstract and §6.2 read) | done for valuation's switch rule ([valuation.md §4](valuation.md#4-learning)); not yet for time to sell, offers or trust |
| Compare two forecasters on the same items with a test that allows any loss and correlated errors | Diebold and Mariano (1995), "Comparing predictive accuracy", JBES 13(3) 253-263, [doi:10.1080/07350015.1995.10524599](https://doi.org/10.1080/07350015.1995.10524599) (*sourced*, abstract) | done in kind: the paired by-product bootstrap in `experiment.py` serves the same purpose |
| Beat the simple rule before claiming anything, and rule out leakage first: in 17 fields, leakage made 294 papers look better than they were, and in one case study the complex models' advantage over old logistic regression disappeared once it was fixed | Kapoor and Narayanan (2023), "Leakage and the reproducibility crisis in machine-learning-based science", Patterns, [doi:10.1016/j.patter.2023.100804](https://doi.org/10.1016/j.patter.2023.100804) (*sourced*, abstract) | last sale and the 90-day median are the baselines; the runner refuses a second look at a locked window; the served engine does not yet beat them |
| Score the number shown before the outcome, on a random sample, regularly | Zillow's published method (above); the 2024 US interagency AVM rule requires quality-control standards that "ensure a high level of confidence in the estimates", "protect against the manipulation of data", "seek to avoid conflicts of interest", "require random sample testing and reviews" and comply with nondiscrimination laws, effective 2025-10-01 ([Federal Register 2024-16197](https://www.federalregister.gov/documents/2024/08/07/2024-16197/quality-control-standards-for-automated-valuation-models)) (*sourced*) | designed (the duel), not run |
| Report hit rate, the share within 10% and 20%, and the median error, beside the count | the AVM testing glossary in [risk-and-reconciliation.md](../../research/price/ben/risk-and-reconciliation.md) (*sourced* there) | done in the runner (`within_10`, `within_20`, `hit_rate`) |
| Know the ceiling: how close repeat sales of the same thing land to each other | claims.md: "On StockX the market itself is within 20% of a sale 99.7% of the time; we are at 97.5%" (*sourced*) | done for StockX only |
| Publish the rows we lose, the raw answers and the rerun command | [benchmark.md](../benchmark.md) rules 3 to 5 | designed |

**The rivals' own tests do not meet these standards.** FlipTip's test prices sales after they happened and chose its rule on the same tests; Underpriced compares itself with chat models after the sale, one of them with web search on (*sourced*: [published-price-tests-and-their-flaws.md](../../research/price/nate/published-price-tests-and-their-flaws.md), read in full 2026-11-14). FlipTip's figure on used eBay goods, a typical miss of $26 on $100 against $28 for the median of other sales of the same item, is the rough size of the problem on used goods. It divides by the sale price, on a different market, so our StockX number must never be set beside it as if they measured the same thing (*inferred*).

## How we can show we beat the other tools

Ranked by how soon each gives a number we could put in front of people, with what it needs. Each is a measure, not a claim, until it runs.

| # | Exhibit | What it shows | Needs | Owner |
|---|---|---|---|---|
| 1 | **Serve the model that wins.** Make the app's valuation the product-anchored model, or make `eng-valuation-2`'s comps engine beat last sale on the same items | that the number a person sees is the one that was proved | the engines lead's queue; integration's `valuate` seam | engines, integration |
| 2 | **The live panel**: every listing our searches return for the benchmark's items, read at first sight with our valuation frozen, re-read until it sells, ends or goes | today's time to sell by site and kind, and our valuation scored against what happened, without waiting for an account | the panel recorder (AD8 in [adaptation.md](adaptation.md#6-named-fixes-for-the-engines-that-should-consume-them)) | integration and orchestrator (recorder), adaptation (scoring) |
| 3 | **The live accuracy table, Zillow-style.** Every valuation we serve is frozen with its `basis_hash` and time before any outcome; when the listing resolves (sold, ended, gone) it is scored; the page shows, per site, kind and `basis_level`, the median error, the share within 10% and 20%, range coverage with its Wilson interval, the count, and the unsold share, refreshed monthly | that the product is right today, on the items people bring | the person's own listings and sales first (signed-in, one linked account, M6); public re-reads of other listings only where the site's rules allow, which is Nate's call (below) | integration (freeze and resolve), adaptation (scoring), Databricks (the table) |
| 4 | **The same-day duel against named tools** on the [benchmark's](../benchmark.md) fixed items: each tool's price captured the same day, before any sale, scored paired on the items both answered | that we are more accurate than FlipTip, Underpriced, Croissant, Terapeak and the rest on the same items | people running the rivals by hand (Nate's and Ben's); exhibit 3's resolver | orchestrator, integration |
| 5 | **Depth of research per answer**: sources per answer, the share of numbers that open to their evidence, sold prices from three or more sites, freshness | that we look further than any single-site tool | benchmark rows 1 to 4, 6 and 9, which the runner already measures | integration |
| 6 | **How we help a person**: what they kept and how fast it sold, against what the same person would have done (their own first price) and against the site's own suggestion | money and time, the claims people care about most | a person's own sales with their unsold listings; a randomized comparison where we choose between two price plans (pricing-modes.md says sold rows alone cannot show "more money") | adaptation, with Nate's go per site |

Exhibits 1 and 5 can be done with what exists; exhibit 2 needs the recorder. Exhibit 3 is the one that turns "we researched current market data" into a proved number about today, and it is mostly bookkeeping: freezing what we already compute and checking back.

## Named fixes this assessment adds

Each is sent to the orchestrator for the owning lead; none is edited here.

- **C1 (engines, integration).** Until the served valuation beats last sale on the StockX windows, the app shows last sale and the 90-day median beside our range with their counts, rather than a middle we know is worse. Test: on the backtest, the served middle's median error ≤ last sale's, else the card leads with last sale.
- **C2 (integration).** Freeze every served valuation (`basis_hash`, `param_versions`, time, site, kind, `basis_level`) to a `forecast` record before any outcome is known, and resolve it from still-up reads of the person's own listings. Test: a forecast written after its listing's sale date is refused.
- **C3 (engines).** Add time to sell and the offer discount as contestants in the runner, scored with log loss and the interval score, censored listings included through IPCW, so the panel's and the person's own rows can be scored there. Test: the self-test's synthetic market with known hazard is recovered within its interval.
- **C4 (everyone).** Every published accuracy figure carries its rung (L0 to L5), dataset, market, kind, `basis_level`, count and interval, and the on-market or off-market split. A figure pooled across basis levels is not published. Test: a check in `.agents/checks/` fails on an accuracy figure in `spec/` or `brand/` without a dataset and a count.

## Decisions that are Nate's

1. **Public re-reads to resolve the duel: decided.** [Nate](../../product/words.md#2026-11-15-nate-we-read-everything-the-poshmark-rule-is-only-about-share-like-and-repost): "We read everything." The panel re-reads the listings our searches return on every site, at each site's pace; on Poshmark, share, like and repost stay suggestions the person taps.

## Not found

- A published, prospective, third-party accuracy test of any resale pricing tool (*not found* here or in [published-price-tests-and-their-flaws.md](../../research/price/nate/published-price-tests-and-their-flaws.md)).
- Any measured effect of a marketplace's own seller levers (share, price drop, promotion) on time to sell (*not found* in [ranking-levers-per-site.md](../../research/list/nate/ranking-levers-per-site.md)).
