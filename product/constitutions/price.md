# The pricing and backtest constitution

What number a seller sees, how sure we let it be, and how we prove the method works. The method is in [spec/features/price.md](../../spec/features/price.md) and [spec/determinations/money.md](../../spec/determinations/money.md); the backtest design is [spec/plans/backtest/plan.md](../../spec/plans/backtest/plan.md) and its write-up [paper.md](../../spec/plans/backtest/paper.md); the data is [sold-datasets.md](../../research/price/ben/sold-datasets.md). *Agent proposal*; the backtest rules retire after judging, the pricing rules stay.

## The problem

A seller wants three answers: what will I actually get, how soon, and why should I believe you. Market value is not one number. It moves by site, fees, condition, season and how badly the person wants the thing gone, and the same jacket is worth different amounts on eBay and Depop ([18:36](../words.md#2026-11-14-pavlo-and-appraise)). A price you can't question isn't worth trusting, and a precise number on thin data is a lie. And in a 24-hour hackathon we have no sales of our own to point to ([07:15](../words.md#2026-11-15-proof-without-sales)). So the job is a per-site "You get" with an honest range and its reason in plain words, that narrows only when the evidence does, plus a backtest on held-out real sold items that is both flattering and true, and is also where we tune the model without fooling ourselves.

**Success, checkably:** on held-out sold items, our price is closer to the real sale than the naive baselines and at least one competitor's method, reported with the side we miss on; the range contains the sale about as often as it claims to; and a seller can read why a price is what it is without seeing a number first.

## Ends

| End | Test |
|---|---|
| The seller trusts the number | The reason is in words; the comparables are one tap away |
| The number is honest about itself | Stated coverage of the range matches measured coverage on held-out data |
| The method beats the obvious | Lower error than the baselines in [plan §2](../../spec/plans/backtest/plan.md#what-it-is-compared-with), per category |
| Anyone can follow the proof | Three layers: one plain number, the data-science number, the paper |

## Rules

**P1. The number is what reaches the person, per site.** "You get $X" after fees, on every site it might sell on; never a gross "market value" alone. *Why:* the payout and the rake differ by site ([05:05](../words.md#2026-11-15-edge-cases-from-a-mentor-site-audiences-two-kinds-of-photo-enhancement-and-measuring-it-all)); one money form app-wide.

**P2. Reasons in words first, numbers on request.** *Why:* "the user should in plain language be able to understand the reasoning and can then see numbers if need be" ([06:53](../words.md#2026-11-15-cross-listing-prices-are-a-choice-the-reason-in-words-first)).

**P3. Sure only as far as the data goes.** Thin or conflicting comparables widen or hide the range ([money D6](../../spec/determinations/money.md#d6-range-calibration-and-display-state)); never statistics notation on screen ([UI Art. 5](../ui-constitution.md#article-5-show-dont-say-and-what-you-do-say-a-person-must-understand)).

**P4. Borrow the logic of fields that price risk, say none of their words.** Weighted comparable sales with the least-adjusted comparables, reconciliation between methods, and a stated risk. *Why:* "i like these apply them to the logic or the plans of logic of how the entire product should work" ([06:54](../words.md#2026-11-15-adjacent-appraisal-risk-and-why-this-price)); the judge hears it implicitly ([pitch E4](../pitch-constitution.md#part-i-ends)).

**P5. The person's goal changes the price.** A minimum, a fire sale, "only if I get my number" are inputs, not afterthoughts ([02:46](../words.md#2026-11-15-the-new-button-gradients-that-carry-state-seller-intents-onboarding-and-build-ready)). "Hot" is relative to the person and the item ([05:47](../words.md#2026-11-15-each-audience-databricks-depth-quant-pricing-hot-in-context-and-depop-import)); each site's levers (discounts, auto-accept) are part of the price, not separate ([00:12](../words.md#2026-11-15-pricing-levers-signals-and-hot-items)).

**P6. Aim as close as possible, and say which side we miss on.** Pricing under costs the seller money; pricing over costs them time. Report both and the direction ([07:38](../words.md#2026-11-15-as-close-as-possible-which-side-we-miss-on-and-a-paper-behind-each-number)).

**P7. The backtest has two jobs and keeps them apart.** It proves the system works now, and it is where we tune, on a split the proof never sees ([07:27](../words.md#2026-11-15-the-backtest-proves-it-works-now-and-is-where-we-tune-and-trends-reach-past-resale): "tune our model without overfitting"). Time-ordered, held out, many categories, several outcomes: money, time to sell, speed.

**P8. Flattering and truthful.** We choose conditions that show our strength and publish them with the result ([07:18](../words.md#2026-11-15-a-backtest-that-flatters-truthfully-seasons-and-waves-and-merge-to-main)). A result we wouldn't show if it went the other way isn't a test.

**P9. Data we may stand on.** Headline numbers rest only on data the marketplaces released or cleared for research; third-party scrapes stay out of published numbers until Ben decides; no applications to marketplaces yet ([08:15](../words.md#2026-11-15-no-applications-to-marketplaces-yet)); never Ben's personal Depop.

**P10. Research the trends before running the test.** Seasons, waves, dates, donation cycles and buying outside resale come first ([07:19, 07:28](../words.md#2026-11-15-the-backtest-proves-it-works-now-and-is-where-we-tune-and-trends-reach-past-resale)), and the app explains a seasonal swing to the person in plain words ([07:18](../words.md#2026-11-15-a-backtest-that-flatters-truthfully-seasons-and-waves-and-merge-to-main)).

**P11. Pricing anything is the future, labeled as such.** Quant methods to price any owned thing against the market are pitched as where it scales, built only where real ([05:47](../words.md#2026-11-15-each-audience-databricks-depth-quant-pricing-hot-in-context-and-depop-import), [06:01](../words.md#2026-11-15-show-the-magic-clips-basement-demos-faster-loops-and-the-intelligence-engine)).

## Open

- Whether third-party scraped sold sets may appear in the backtest: the card in [Get sold-item data for the backtest](https://claude.ai/code/project/chan_01S64oRNV6rfAyD7NMnErjQP?thread=cmsg_01S64oRNV6rfAyD7NMnErjQPMErrFhJywTZFWMFjAKMACS) recommends side cells only.
- Kaggle's Mercari competition rules need Ben's login to read.
- NBER's eBay set needs Nate's Databricks (packet 64). The runner's first smoke run on StockX is slow and unfinished.
