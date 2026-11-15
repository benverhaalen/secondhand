# How credible our scorers are, and how we prove we beat the other tools

Written 2026-11-15 by the adaptation lead, for [Nate](../../product/words.md#2026-11-15-nate-how-credible-and-research-proven-are-our-scorers-real-time-against-2012-to-2013-and-proving-we-beat-the-other-tools): "assess how credible and research proven our scorers and such deterministic system we had in place were ... What would help us easily prove or exhibit outperfroming competitors and other tools in our depth of research, and how we aid people."

Labels: *sourced* (a file in this repo or a page fetched today says it, named in place), *inferred* (this lead's reading), *not found* (looked for, absent). Everything below the verdict is an *agent proposal* until Nate accepts it.

## The verdict

1. **The methods are credible on paper.** Nearly every scorer uses a method from the literature that fits its job: comparable sales with Kish effective sample, credibility blending toward a parent, split and adaptive conformal ranges, Kaplan-Meier with a cure model for time to sell, Fellegi-Sunter matching, hierarchical logistic for offers, Gamma-Poisson shrinkage for site comparison (*sourced*: the per-engine table of [the science audit](../plans/sweep/science-audit.md#per-engine-table), which checked each against its primary source). A referee would accept the choices. The audit also lists where the code departs from them, and those corrections are still open.
2. **The proof on data is thin.** One scorer, valuation, has been run on real sales: one market (StockX), one kind (deadstock sneakers), 2017 to 2019 (*sourced*: [claims.md](../plans/backtest/claims.md), [packet 70](../../.agents/team/packets/team/70-engines-handoff.md)). By the engines lead's count 2 of 11 engine pieces have touched real data ([completion.md](../plans/completion.md)). Time to sell, offers, trust, identity, demand, platform comparison, ranking and the listing score have run only on constructed cases, scripted buyers or parity fixtures. So a reader can be told *how* each scorer decides, but for all of them except valuation, not *how often it is right*.
3. **On the one market we measured, the model the app serves loses to the simple lookup.** The comps engine the app serves is off by 6.25% at the median, against 3.25% for the item's last sale and 5.76% for its 90-day median, on 41,988 StockX sales (*sourced*: packet 70). The nightly Python model, which starts from the product's own recent sales, does match the last sale on eight months nobody looked at while building it: 3.2% against 3.3%, and 97.5% within 20% against 89.4% for the 90-day median, a paired lift of +7.0 points (95% interval 5.7 to 8.3) on 35,862 items (*sourced*: claims.md). That model is not the one the app serves. **The most credible thing we have is not in the product yet.**
4. **Nothing is measured on today's market.** No answer we have served has been checked against what the item later sold for. The real-time loop that would let an observation move a weight runs on 1 of 10 links (*sourced*: completion.md). Every number above is retrospective.

What this means for a public claim today: the only honest one is the StockX line in [claims.md](../plans/backtest/claims.md#the-strongest-honest-line-today), scoped to StockX deadstock sneakers and to the nightly model. Nothing about used goods, about other sites, or about the app as served can be claimed yet.

## Scorer by scorer

Grades: **method** (a primary source fits the use), **real data** (run on released or live sales, with the dataset named), **beats the baseline** (paired, on the same items, with an interval), **today** (checked on answers frozen before a current sale).

| Scorer | What it decides | Method | Real data | Beats the baseline | Today | The open fault that matters most |
|---|---|---|---|---|---|---|
| Valuation middle, served (`app/src/engines/valuation/comps.ts`) | the price | yes: comps, Kish, credibility blend | StockX 2019 | **no**: 6.25% against 3.25% last sale | no | the anchored middle and the per-family index and age rule are being built (`eng-valuation-2`); comps match on all title words, so never at variant level ([completion.md](../plans/completion.md)) |
| Valuation, nightly model (`jobs/valuation/market.py`) | the price | yes | StockX 2019, unseen months | **yes**: +7.0 points within 20% over the 90-day median; ties last sale | no | not served |
| Range (conformal, `check.ts`, `backtest.py`) | the low and high | yes: split and adaptive conformal | StockX 2019 | holds 84.3% for an 80% range (Wilson 84.0 to 84.7), width 27% of the price | no | the gate cannot be passed at the sizes named; no test-point mass in weighted conformal; dollar scale where errors are multiplicative (science audit corrections 3, 5, 6) |
| Thin basis (`n_eff`, `proof.ts`, `gather.ts`) | whether the basis is enough | yes: Kish | StockX: the items it declined were ones the median got right only 63% of the time, against 89% overall | n/a | no | two formulas disagree; loose matches count like exact ones (science audit correction 2; real-time proof link 6) |
| Time to sell (D10) | chance of sale by a date | yes: Kaplan-Meier, cure model, IPCW | **none**: StockX has no unsold rows | not run | no | NBER, which has 60,772 unsold rows in the Mac's old subset, has not been run ([data-for-proof](#what-data-can-prove-what)) |
| Offer accept (`negotiation`, `P_accept`) | accept, decline or counter | yes: hierarchical logistic, Thompson sampling | **none**: scripted buyers | not run | no | the simulator draws walk-away prices from accepted offers, so it favours aggressive policies; no off-policy estimator (science audit, negotiation row) |
| Trust | block, ask or warn | yes: Bayesian logistic, isotonic | none | not run | no | ECE bins not named; no labelled threads |
| Identity (`reconcile.ts`) | same product or not | yes: Fellegi-Sunter | none scored | not run | no | `model` alone becomes `exact`; every search row is unresolved (science audit; [optimization-gaps.md](../plans/optimization-gaps.md#accuracy)) |
| Demand forecast | price and demand ahead | yes: split conformal | none | not run | no | independence of terms unstated |
| Platform comparison | which site does best for a person | yes: Gamma-Poisson shrinkage | none | not run | no | needs a person's sales on two sites |
| Ranking and style | what to show | partly: logistic on impressions | none | not run | no | promotion scored on what the champion chose to show (position bias) |
| Claim gate (`app/src/edge/gate/claims.ts`) | whether a sentence is backed | rule check | 20 constructed drafts, 10 planted false, all held | n/a | no | constructed cases only |
| Capture photo score | which shots are good enough | rule check | Ben's 3 real garments | n/a | no | one run, not accuracy |

## What data can prove what

Nate: "Theres value to realtime vs 2012 to 2013." Both kinds of data are needed, and they prove different things.

| | Released history (StockX 2017-19, NBER eBay 2012-13) | Live, today (answers frozen now, scored when the item sells) |
|---|---|---|
| What it proves | that the method is right: on rows with known outcomes, does the estimator beat simple rules, is its range calibrated, does handling unsold listings properly change the answer, does pooling a thin cell toward its parent help | that the product is right: today's prices, today's sites, the sources we can actually read, the item a person actually has |
| What it cannot prove | today's price levels; any site but the one recorded; our harness's coverage | anything soon: a listing takes days to weeks to sell, and the unsold ones must be counted too |
| Leakage risk | the main risk; the runner's frozen-as-of history and locked windows are the guard (*sourced*: claims.md) | none by construction, if the answer is frozen with its hash before the outcome |
| Terms | StockX released for analysis; NBER "cleared for public release by eBay.com" for research, so a method test, not the shipped model's weights (*sourced*: [jobs/valuation/data/README.md](../../jobs/valuation/data/README.md#the-nber-ebay-data)) | the site's own rules on reading, per [the inventory](adaptation.md#1-the-data-we-can-actually-read) |

The NBER set is the cheapest large step: used goods, many categories, unsold rows (censoring), list dates, Best Offer outcomes, views and watchers, already on the Mac with a tested reader (*sourced*: [packet 70](../../.agents/team/packets/team/70-engines-handoff.md), data README). It can earn the first claim about used goods and the first real test of time to sell and offer discounts. It can never earn a claim about today.

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

**The rivals' own tests do not meet these standards.** FlipTip's test prices sales after they happened and chose its rule on the same tests; Underpriced compares itself with chat models after the sale, one of them with web search on (*sourced*: [published-price-tests-and-their-flaws.md](../../research/price/nate/published-price-tests-and-their-flaws.md), read in full 2026-11-14). FlipTip's figure on used eBay goods, a typical miss of $26 on $100 against $28 for the median of other sales of the same item, is the rough size of the problem on used goods, about eight times our StockX miss. Our StockX number must never be set beside it as if they measured the same thing (*inferred*).

## How we can show we beat the other tools

Ranked by how soon each gives a number we could put in front of people, with what it needs. Each is a measure, not a claim, until it runs.

| # | Exhibit | What it shows | Needs | Owner |
|---|---|---|---|---|
| 1 | **Serve the model that wins.** Make the app's valuation the product-anchored model, or make `eng-valuation-2`'s comps engine beat last sale on the same items | that the number a person sees is the one that was proved | the engines lead's queue; integration's `valuate` seam | engines, integration |
| 2 | **NBER, locked May 2013, scored once** across eBay's categories: price, range, chance of sale in 7, 30 and 60 days, and the discount an offer takes | the first claim about used goods and the first test of time to sell and offers, against last sale, the median and a flat hazard | the 5% freeze on the Mac; the runner's time-to-sell contestant (not built); this lead's [measures](adaptation.md) | engines (runner), adaptation (measures) |
| 3 | **The live accuracy table, Zillow-style.** Every valuation we serve is frozen with its `basis_hash` and time before any outcome; when the listing resolves (sold, ended, gone) it is scored; the page shows, per site, kind and `basis_level`, the median error, the share within 10% and 20%, range coverage with its Wilson interval, the count, and the unsold share, refreshed monthly | that the product is right today, on the items people bring | the person's own listings and sales first (signed-in, one linked account, M6); public re-reads of other listings only where the site's rules allow, which is Nate's call (below) | integration (freeze and resolve), adaptation (scoring), Databricks (the table) |
| 4 | **The same-day duel against named tools** on the [benchmark's](../benchmark.md) fixed items: each tool's price captured the same day, before any sale, scored paired on the items both answered | that we are more accurate than FlipTip, Underpriced, Croissant, Terapeak and the rest on the same items | people running the rivals by hand (Nate's and Ben's); exhibit 3's resolver | orchestrator, integration |
| 5 | **Depth of research per answer**: sources per answer, the share of numbers that open to their evidence, sold prices from three or more sites, freshness | that we look further than any single-site tool | benchmark rows 1 to 4, 6 and 9, which the runner already measures | integration |
| 6 | **How we help a person**: what they kept and how fast it sold, against what the same person would have done (their own first price) and against the site's own suggestion | money and time, the claims people care about most | a person's own sales with their unsold listings; a randomized comparison where we choose between two price plans (pricing-modes.md says sold rows alone cannot show "more money") | adaptation, with Nate's go per site |

Exhibits 1, 2 and 5 can be done with what exists. Exhibit 3 is the one that turns "we researched current market data" into a proved number about today, and it is mostly bookkeeping: freezing what we already compute and checking back.

## Named fixes this assessment adds

Each is sent to the orchestrator for the owning lead; none is edited here.

- **C1 (engines, integration).** Until the served valuation beats last sale on the StockX windows, the app shows last sale and the 90-day median beside our range with their counts, rather than a middle we know is worse. Test: on the backtest, the served middle's median error ≤ last sale's, else the card leads with last sale.
- **C2 (integration).** Freeze every served valuation (`basis_hash`, `param_versions`, time, site, kind, `basis_level`) to a `forecast` record before any outcome is known, and resolve it from still-up reads of the person's own listings. Test: a forecast written after its listing's sale date is refused.
- **C3 (engines).** Add time to sell and the offer discount as contestants in the runner, scored with log loss and the interval score, censored listings included through IPCW. Test: the self-test's synthetic market with known hazard is recovered within its interval.
- **C4 (everyone).** Every published accuracy figure carries its dataset, market, kind, `basis_level`, count and interval, and the on-market or off-market split. A figure pooled across basis levels is not published. Test: a check in `.agents/checks/` fails on an accuracy figure in `spec/` or `brand/` without a dataset and a count.

## Decisions that are Nate's

1. **Public re-reads to resolve the duel.** Scoring answers on listings other than the person's own needs re-reading those listings until they sell. Poshmark's terms bar automated collection, Mercari is read only on the person's request, and eBay's page lane runs under Nate's ruling (*sourced*: [inventory](adaptation.md#1-the-data-we-can-actually-read)). Options: (a) the person's own listings and sales only, slower to fill but clean; (b) also re-read, at a stated pace, the listings a person's own search was shown, on eBay and Depop only; (c) wider. Recommendation: (a) now, (b) if Nate accepts the reading.
2. **Whether the NBER locked month may be run now.** Ben's earlier instruction held backtests until the backend is set up (*sourced*: data README). Nate since said "backtest as we build". Recommendation: run it as a development read, then lock.

## Not found

- A published, prospective, third-party accuracy test of any resale pricing tool (*not found* here or in [published-price-tests-and-their-flaws.md](../../research/price/nate/published-price-tests-and-their-flaws.md)).
- Any measured effect of a marketplace's own seller levers (share, price drop, promotion) on time to sell (*not found* in [ranking-levers-per-site.md](../../research/list/nate/ranking-levers-per-site.md)).
