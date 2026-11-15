# What do insurance, lending, iBuying, pawn shops and appraisal teach us about pricing accuracy, risk and explaining a price?
Researched 2026-11-15 by Ben (Claude Code agent, pitch thread "Frame the problems and beat competitors"). Feature: price.

Ben, 06:43 and 06:46 UTC: "think about insurance and other adjacent fields about how they appraise and see if based on our information there are any mechanisms to improve accuracy", and "ways to quantify the risk of everything we are doing ... reasons why we make decisions to price at whatever based on similar products and whats sold" ([words](../../../product/words.md#2026-11-15-adjacent-appraisal-risk-and-why-this-price)). Builds on [adjacent-valuation.md](adjacent-valuation.md) (cars, real estate comps, card grading, catalogues, Mercari) and does not repeat it. The market and competitor side of the same pass is in [market-and-competitors.md](../../../product/pitch/market.md).

Method: RDD with IAE (assume another field already solved it, take the mechanism). Marks: *observed* (opened, says so), *asserted* (a source claims it without showing, or from memory), *inferred* (my reasoning).

**Draft before searching:** "insurers price used items from market data; appraisers average their comps; double-sale risk is a fixed small number; account risk can be modelled as a ban probability." **What changed:** insurers mostly use new retail prices and depreciation tables, not used-market prices; appraisers explicitly reject averaging and weight by how little a comp was adjusted; double-sale risk depends on how fast the item sells, so it is concentrated in hot items; and a ban probability has no labels (card 17 already says so), so the usable form is a measured incident rate per site.

## References and their jobs

| Reference | Job | What it says | Mark | Take |
|---|---|---|---|---|
| [Clear Capital, AVM testing glossary](https://www.clearcapital.com/blog-avm-testing-glossary/) (2019, updated 2023) | implementation mechanism: how lenders test valuation models | Hit rate is "The number of benchmark addresses the AVM was able to predict on"; PPE10 is "The percentage of time the AVM is within 10 percent of the benchmark" and "does not capture or consider the AVM predictions that are very far from the benchmark"; median absolute error "hides the times the AVM was really far off"; FSD: "an FSD of 0.07 or 7 percent is a confidence score of 93 percent" | observed | Report hit rate, PPE10, PPE20, median error, and the share off by more than 30% (the tail PPE hides), per cell of the D6 backtest |
| [Claims Pages, Depreciation Guide (Personal Property)](https://www.claimspages.com/documents/depreciation-guide-personal-property/i777/) | evidence and a cold-start prior | "depreciation rates and expected lifespans"; each item has "an annual depreciation rate and expected years of service"; "Utilized by hundreds of insurance companies annually"; working items "should not be depreciated beyond 90% of their original value". The table itself is behind a sign-in | observed (page); table rows not read | A prior for M10 where we have too few sales, labelled as an insurer schedule |
| [Verisk XactContents pricing methodology](https://files.helpdocs.io/pxEGJf5YY0/other/1733939186850/2146-whitepaper-xact-contents-pricing-methodology.pdf) (2023) | evidence | Used "by eight of the top ten insurers in the United States"; prices are "Items that retailers are currently selling online", updated nightly; actual cash value from "built-in life expectancy information" plus age and use; no mention of used-market prices | observed | Insurers' actual cash value is a formula on new prices; our sold comps measure what the formula approximates |
| [United Policyholders, Depreciation Basics](https://uphelp.org/claim-guidance-publications/depreciation-basics/) (2026) | evidence | "there is no agreed-upon schedule or set standard"; adjusters use "their own personal views on the value of items plus guidelines"; quotes California 2695.9(f): depreciation "shall reflect a measurable difference in market value attributable to the condition and age" | observed | The California rule asks for exactly the number our comps measure: the market gap by condition and age |
| [Stanford GSB on Zillow Offers](https://gsb.stanford.edu/insights/flip-flop-why-zillows-algorithmic-home-buying-venture-imploded) (2021, on NBER w28252) | evidence of a failure | "Owners with lemons are more eager to sell to them, increasing its risk of overpaying"; intermediation "is only profitable in the most liquid and easy to value houses"; $569M in write-downs, about $30,000 per home | observed | Never make a guaranteed offer from our own estimate |
| [GEM Pawnbrokers](https://www.gempawnbrokers.com/blogs/news/how-pawn-shops-value-item-condition) (2025), [Chron](https://smallbusiness.chron.com/pawn-shops-determine-value-65950.html) | weak evidence | Complete, working items "often get offers of 60–70% of their resale value", damaged or incomplete "20–30%" (a shop's blog, figures inconsistent); value fine-tuned for "included packaging and accessories" | asserted / observed | Function and completeness move price; make "works" an adjustment learned by paired sales |
| [OpenExamPrep, reconciling the sales comparison approach](https://open-exam-prep.com/study-guides/real-estate-appraiser/sales-comparison-adjustments/sca-reconciliation) (Aug 2026) | implementation mechanism | "Gross adjustment: sum of the absolute values of individual adjustments"; "A sale with small gross and net adjustments usually deserves more weight than one with a 35% gross adjustment package"; blind averaging is "generally unacceptable as the sole method"; indications should bracket the conclusion | observed (a study guide) | Weight comps by gross adjustment; check bracketing |
| [McKissock, weighted mean](https://www.mckissock.com/?p=48967) | implementation mechanism | weights are explained and "total 100%" so "a reviewer can replicate your steps" | observed | Show the weights so the price can be recomputed |
| [Homium underwriting guide](https://underwriting.homium.io/underwriting-property/appraisal-requirements/adjustments-to-comparable-sales/appraisers-comments-and-indicated-value-in-the-sales-comparison-approach) | evidence | the value "must be within the range of the adjusted sales price of the comparables"; comments must "identify why the sale(s) were given the most weight" | observed | The one-sentence reconciliation |
| Expected shortfall, time decay, Kelly sizing, insurance frequency × severity, class rating, model-risk limits | mechanisms from quant finance, insurance and bank model governance | standard definitions | asserted (from memory, not fetched) | Expected shortfall for the downside line; frequency × severity for double sales; class rating (one loss rate pooled across everyone on a site and route) for account risk; model-risk limits for autonomy. Kelly and reserves don't fit our first person |

## What this changes in the spec (agent proposal, applied 2026-11-15 on Ben's "apply them")

| Mechanism | Card |
|---|---|
| Weight comps by gross adjustment; cap on gross, not net | [money D1](../../../spec/determinations/money.md#d1-comparable-set-and-weights) |
| Bracketing check and the reconciliation sentence | money D1 and [D5](../../../spec/determinations/money.md#d5-fair-value-range-overall-and-per-site) |
| Hit rate, PPE10, PPE20, median error and tail share in the backtest | [money D6](../../../spec/determinations/money.md#d6-range-calibration-and-display-state) |
| Double-sale chance from the item's own sale speed; hold extra sites for hot items | [money D12](../../../spec/determinations/money.md#d12-best-site-or-set-of-sites) |
| The downside line (expected shortfall) and the price-speed trade-off shown | [money D13](../../../spec/determinations/money.md#d13-listing-price) |
| "Works" as an adjustment | [money D2](../../../spec/determinations/money.md#d2-condition-variant-completeness-and-size-adjustment) |
| Measured incident rate per site and route across all users | [managing-and-buyers card 17](../../../spec/determinations/managing-and-buyers.md#17-whether-an-account-is-healthy-or-at-risk) |
| Autonomy gated by measured accuracy | [managing-and-buyers card 18](../../../spec/determinations/managing-and-buyers.md#18-whether-an-action-kind-has-earned-auto) |
| Insurer depreciation schedules as a labelled cold-start prior, and the gap to market | [market-insight M10](../../../spec/determinations/market-insight.md#m10-depreciation-by-category-and-brand) |
| No guaranteed offers from our own estimate | [appraise](../../../spec/features/appraise.md) |

## Double-sale arithmetic (*inferred*)

If buyers on site j arrive at a steady rate, the chance one pays inside a window of W minutes is about `1 - exp(-W / m_j)`, where `m_j` is the expected minutes to sale on j at that price. With W = 4 (D12's design budget: up to 2 minutes to see a sale, 2 to delist): an item that takes 20 days (28,800 min) gives about 0.01% per extra site; one that sells in about 2 hours gives about 3% per extra site, roughly 10% across three. Real arrivals cluster (an underpriced item draws several buyers at once), so the hot case is if anything worse. The fixed 0.01 in D12 overstates the risk for ordinary items and understates it for hot ones.

## Limits

- The Claims Pages table rows were not read (sign-in). Get them before using the prior.
- The pawn figures are a shop's blog and inconsistent; use them only as direction.
- The quant and insurance definitions are from memory, not fetched.
- No source measured how often crosslisted items double-sell; the arithmetic above is a model, to be replaced by our own counts.
