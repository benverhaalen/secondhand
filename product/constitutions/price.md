# The pricing and backtest constitution

What number a seller sees, how sure we let it be, and how we prove the method works. The method is in [spec/features/price.md](../../spec/features/price.md) and [spec/determinations/money.md](../../spec/determinations/money.md). The backtest design is in [spec/plans/backtest/plan.md](../../spec/plans/backtest/plan.md) and its write-up in [paper.md](../../spec/plans/backtest/paper.md), and the data in [sold-datasets.md](../../research/price/ben/sold-datasets.md). Reasons and numbers follow [evidence.md](evidence.md). *Agent proposal.* The backtest rules retire after judging; the pricing rules stay.

## The problem

A seller wants three answers: what will I actually get, how soon, and why should I believe you. Market value isn't one number. It moves with the site, the fees, the condition, the season and how badly the person wants the thing gone, and the same jacket is worth different amounts on eBay and Depop ([18:36](../words.md#2026-11-14-pavlo-and-appraise)). Today most sellers look up the sold median on eBay and list at that. Half of items are worth more than the median of their kind, so pricing there leaves money on the table for those sellers, and the other half sit unsold, which costs them time. We also have no sales of our own to point to ([07:15](../words.md#2026-11-15-proof-without-sales)). So the job is to give, for each site, what the seller will take home, a range that is only as narrow as the evidence allows, and a plain reason for it. Then we prove on real past sales that pricing this way gets sellers more money than listing at the median.

**Success, checkably:** on held-out real sales, a seller who listed at our price would have taken home more money on average than one who listed at the median, and we can say how much, how we measured it, and what it assumes. We also say which side we miss on, and a seller can read why a price is what it is before seeing a number.

## Ends

| End | Test | Why it matters to the seller |
|---|---|---|
| More money than the median | The headline below, measured by the backtest | Money is what they came for |
| The number is honest about itself | A range that claims to hold most sales does hold that share on held-out data | If the range lies, so does every "you get" built on it |
| The seller can follow the reason | The reason comes in words first, with the comparable sales one tap away | A price they can't question is one they can't trust or adjust |
| Anyone can check the proof | One plain sentence, the data-science measures, then the paper | A judge, a teammate and a skeptic each need a different depth |

## The headline: more money than the median

Ben's statistic ([08:59](../words.md#2026-11-15-every-why-explained-numbers-that-help-and-a-statistic-we-can-defend)) is "whatever percent more money compared to just taking the median". The measurement belongs to the backtest and benchmark thread, and the result lives in [plan.md](../../spec/plans/backtest/plan.md) and [paper.md](../../spec/plans/backtest/paper.md). This page doesn't restate it. It only holds the rules for how the result may be said.

- **It is a money number, in the seller's units.** It replaces the earlier headline "7 in 10 within 20% of the sale". *Why:* the share within 20% tells a seller how often we were close, not whether they gained anything, so it can't answer the only question they have ([E2, E3](evidence.md)). Accuracy shares stay in the paper as diagnostics.
- **StockX alone can't support it.** StockX records only completed sales, so we never see the asks that went unfilled. A price above the market looks like a loss of nothing when it really means the item didn't sell. So a revenue comparison on StockX alone flatters whichever method prices high. *Why it matters:* claiming more money from data that hides the cost of overpricing is the exact mistake a sharp judge will catch ([E5](evidence.md)). The expected-revenue number needs a set with unsold listings, which is NBER's eBay set through Nate (packet 64). StockX can still show that our price sits closer to the sale than the median.
- **It must beat the median shaded down by the best fixed amount, not only the median.** *Why:* if the method only lists everything a bit under the median, it sells more often and looks like a gain without knowing anything about the item. Only beating the best fixed shade shows the method knows which items are worth more ([E5](evidence.md)).
- **It is said with what it assumes and where it holds.** Which items and dates, and that it is a replay of past sales, not live listings. *Why:* the gap between a replay and a live market is the first thing a skeptic will raise, so saying it first keeps the number standing ([E6](evidence.md)).

## Rules

**P1. The number is what reaches the person, per site.** Show "You get $X" after fees for every site the item might sell on, never only a gross market value. *Why:* fees run from nothing to about a fifth of the price depending on the site ([fees-and-taxes.md](../../research/price/nate/fees-and-taxes.md)), so the same sale price pays very differently. A gross number would send sellers to the site that pays them least ([05:05](../words.md#2026-11-15-edge-cases-from-a-mentor-site-audiences-two-kinds-of-photo-enhancement-and-measuring-it-all)).

**P2. Reasons in words first, numbers on request.** *Why:* a seller can't check or argue with "$38" alone. They can with "three of these sold last month, yours has a stain", and they need that to decide whether to override us ([06:53](../words.md#2026-11-15-cross-listing-prices-are-a-choice-the-reason-in-words-first)).

**P3. As sure as the data, no more.** When there are few comparable sales, or they disagree, the range widens or is hidden ([money D6](../../spec/determinations/money.md#d6-range-calibration-and-display-state)), and statistics notation never appears on screen ([UI Art. 5](../ui-constitution.md#article-5-show-dont-say-and-what-you-do-say-a-person-must-understand)). *Why:* a narrow range drawn from three sales looks certain and is wrong often. When it's wrong one way the seller loses money, and the other way they wait.

**P4. Borrow the logic of fields that price risk, but none of their jargon.** That means weighting the comparable sales that need the least adjusting, reconciling between methods, and stating the risk. *Why:* appraisers and lenders have spent decades learning which comparables mislead, and reusing their method saves us repeating those mistakes ([06:54](../words.md#2026-11-15-adjacent-appraisal-risk-and-why-this-price)). Their jargon would confuse a seller, so the logic shows only in the result ([pitch E4](../pitch-constitution.md#part-i-ends)).

**P5. The person's goal changes the price.** A minimum, a fire sale and "only if I get my number" are inputs to the price, not afterthoughts ([02:46](../words.md#2026-11-15-the-new-button-gradients-that-carry-state-seller-intents-onboarding-and-build-ready)). "Hot" is relative to the person and the item ([05:47](../words.md#2026-11-15-each-audience-databricks-depth-quant-pricing-hot-in-context-and-depop-import)), and each site's levers, like discounts and auto-accept, are part of the price ([00:12](../words.md#2026-11-15-pricing-levers-signals-and-hot-items)). *Why:* someone moving out on Friday and a collector holding out want different prices for the same jacket. One answer for both is wrong for at least one of them.

**P6. Say which side we miss on.** *Why:* pricing too low costs the seller money they never see, and pricing too high costs them days of waiting. Those are different losses, so a result that hides the direction hides which one they're paying ([07:38](../words.md#2026-11-15-as-close-as-possible-which-side-we-miss-on-and-a-paper-behind-each-number)).

**P7. The backtest proves and tunes, on separate data.** Tuning happens on a split the proof never sees, and the sales are ordered in time ([07:27](../words.md#2026-11-15-the-backtest-proves-it-works-now-and-is-where-we-tune-and-trends-reach-past-resale)). *Why:* a model tuned on the sales it's scored on learns those sales by heart and scores well on them, then does worse on the next seller's item. The proof would promise money that never arrives.

**P8. Flattering and truthful.** We pick conditions that show our strength and publish them with the result ([07:18](../words.md#2026-11-15-a-backtest-that-flatters-truthfully-seasons-and-waves-and-merge-to-main)). *Why:* see [E7](evidence.md). A result we would hide if it went the other way isn't a test.

**P9. Only data we may stand on.** Headline numbers rest only on data the marketplaces released or cleared for research. Third-party scrapes stay out until Ben decides, we make no applications to marketplaces yet ([08:15](../words.md#2026-11-15-no-applications-to-marketplaces-yet)), and we never use Ben's personal Depop. *Why:* if the data under a headline was taken against a site's terms, the number can't be shown, and the method is questioned with it.

**P10. Research the trends before running the test.** Seasons, waves, dates and donation cycles come first, and the app explains a seasonal swing in plain words ([07:18, 07:19, 07:28](../words.md#2026-11-15-the-backtest-proves-it-works-now-and-is-where-we-tune-and-trends-reach-past-resale)). *Why:* a coat priced on July sales and sold in November is priced low. If the model can't see the season it charges the seller for that, and if the app can't explain the swing the seller thinks the price is broken.

**P11. Pricing anything is the future, and it's labeled that way.** *Why:* quant pricing of any owned thing is where this scales ([05:47](../words.md#2026-11-15-each-audience-databricks-depth-quant-pricing-hot-in-context-and-depop-import), [06:01](../words.md#2026-11-15-show-the-magic-clips-basement-demos-faster-loops-and-the-intelligence-engine)). Claiming it before it's built would make a judge doubt the parts that are real.

## Open

- The money headline waits on NBER's eBay set (packet 64). Until then StockX can only show closeness to the sale, and we say so.
- Whether third-party scraped sold sets may appear in the backtest: the card in [Get sold-item data for the backtest](https://claude.ai/code/project/chan_01S64oRNV6rfAyD7NMnErjQP?thread=cmsg_01S64oRNV6rfAyD7NMnErjQPMErrFhJywTZFWMFjAKMACS) recommends side cells only.
- Kaggle's rules for the Mercari competition need Ben's login to read.
