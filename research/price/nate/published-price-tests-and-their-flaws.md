# How were the published price-accuracy tests done, and can we rely on them?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: price.

Nate asked for this: "dont trust those tests for prices. Explain and save how they were done, but they defintiely werent done the right way." ([words.md](../../../product/words.md#2026-11-14-nate-do-not-trust-the-published-price-tests-and-we-replicate-thriftx-and-dupe-ourselves))

Two vendors publish accuracy tests that our notes quote: FlipTip ([fliptip.ai/accuracy](https://fliptip.ai/accuracy), page dated "Updated November 14, 2026") and Underpriced AI ([underpricedai.com/accuracy](https://underpricedai.com/accuracy), full numbers dated November 10, 2026, competitor table dated November 15, 2026). I opened both pages and read them in full on 2026-11-14. Everything below marked *observed* comes from those two pages unless another URL is given.

**The short answer.** Neither test can serve as a bar for us. Both are run by the vendor on its own product. Neither defines its sample by price band. Neither deals with shipping, returns or unsold items. FlipTip re-prices its old tests with a rule chosen on those same tests. Underpriced's comparison against ChatGPT, Gemini and Perplexity runs after the sale, with web search on for one of them. The well-known "about 28%" is FlipTip's *baseline* (the median of other sales of the same item, $28 on $100), not FlipTip's own result, and the page does not say whether those other sales came before or after the tested sale (*observed*; the leakage risk is *inferred*).

**One correction to our own notes.** The comparison of an app against ChatGPT, Gemini and Perplexity is on Underpriced's page, not FlipTip's (*observed*). [price.md line 146](../../../spec/features/price.md) puts "FlipTip $28 on $100; ChatGPT $33, Gemini $30, Perplexity $43" in one cell, which reads as one test. They are two vendors' tests with different denominators (see below). FlipTip's page only links a blog post titled "Can ChatGPT Tell You What an Item Is Worth?" (unopened).

## 1. FlipTip's blind test

### How it was done

- **Who ran it.** FlipTip, which sells the photo-to-price app being tested, with paid plans from $9.99 to $39.99 a month (*observed*, [existing-tools.md line 10](../../appraise/ben/existing-tools.md)). No outside party is named (*observed*).
- **How items were chosen, and how many.** "99 real eBay sales tested in the last 30 days · since November 12, 2026" (*observed*). The two parts of that line disagree, and the test list on the same page shows tests dated October 28 (*observed*), so the window is unclear (*inferred*). Items come from FlipTip's own "value guides" plus "everyday brand clothing people scan most"; for each item they pull the most recent completed eBay.com sales and "pick sales of that exact item at random" (*observed*). Collectibles are excluded (*observed*). The page admits the mix "leans to known models" (*observed*).
- **Categories and price bands.** Four groups, tested in turn to keep them about equal: Electronics and games 23, Tools 23, Clothing, shoes and accessories 28, Home and kitchen 25 (*observed*). No price bands are defined or reported (*observed*).
- **What counted as the true price.** The eBay sold price of that completed listing. Best Offer sales are left out (*observed*). Shipping, cancelled sales and returns are not mentioned (*observed absence*).
- **Before or after the sale.** After. The sale is picked from completed listings and the scanner is run on its photo later (*observed*). The tested sale is removed from its own comps and from the comparison photos (*observed*). Other sales of the same item that happened after the tested one are not said to be removed (*observed absence*).
- **Rule changes and re-pricing.** The pricing rule changed on 19 October (old median-only method $37 on $100, new combined rule $29, on 131 tests) and again on 24 October (*observed*). "Every test on this page is priced the way the app prices today ... from the sales its own scan found at the time, combined with today's rule", and "The rule was chosen on the tests up to 19 October; the tests since then are the independent check" (*observed*). So the headline mixes tests used to choose the rule with tests that were not (*inferred*).
- **Identity and condition.** Identity is judged against the eBay listing title: exact model 57%, brand and line 79%, counted over 128 photos, not 99 (*observed*). Re-runs of newer scanner versions on old photos count toward identification only (*observed*). Condition is not verified (*observed absence*).
- **How error was computed.** The miss is the gap as a share of the *sale price*; "typical miss" is the median (*observed*). Results: $26 on $100; 39% within 20%; 68% inside a range that "aims to hold about 70%", whose width is "set from earlier tests and checked on newer ones"; the lean (high or low) is reported (*observed*). Split by identification: exact model 57 tests, $25, 74% in range, 10% high; less specific 22 tests, $33, 64%; wrong item 20 tests, $35, 55% (*observed*). 85% of tests used sold prices plus AI and the rest AI only; 2 failed scans were dropped (*observed*). "Nothing is cherry-picked" (*asserted* by the vendor).
- **The baseline.** For 98 sales, the "median of all the other recent sales of the exact same item" missed by $28 on $100, with 39% within 20% (*observed*). This is the source of the 28% in our notes.
- **What the competitors were given.** No competitor is tested on this page (*observed*).
- **Not stated.** Shipping, cancellations, returns, unsold items, condition checks, price bands, a pre-registered sample size, any outside review. The page lists its own limits: listing photos are clearer than store photos, and the mix leans to known models (*observed*). The per-test list links each eBay sale, so the test is partly rerunnable by hand (*observed*).

### Against the checklist

| Line | FlipTip |
|---|---|
| Run by someone with no stake in the result | not met (vendor tests its own product) |
| Sample defined in advance, large enough per category and price band | not met (about 25 per group, no bands; window stated two ways) |
| Estimate made strictly before the outcome, no leakage | not met (run after the sale; old tests re-priced with a rule chosen on them; later sales not said to be removed from comps or baseline) |
| Truth is the accepted price net of shipping, cancelled and returned sales removed | not met for shipping (not stated); Best Offer excluded rather than read; cancellations and returns not stated |
| Unsold items handled | not met (only sold listings are sampled) |
| Identity and condition verified | partly: identity against the listing title only; condition not stated |
| Error as a distribution, with coverage of any range | partly: median, share within 20%, coverage of a 70% range and lean; no quantiles or interval on coverage |
| Simple baselines included (median of recent comps, last sale) | partly: median of other sales of the same item; no last sale; timing of the comps not stated |
| Repeated over time | partly: rolling 30-day page, but rules change mid-window and old tests are re-priced |
| Data and method published | partly: method in prose and per-test links; no downloadable data or code |

## 2. Underpriced AI's weekly grade

### How it was done

- **Who ran it.** Underpriced AI, on its own product (*observed*). "It is written by the weekly report, not by us" (*asserted*).
- **How items were chosen, and how many.** "551 real sales checked, last 90 days", recomputed every Tuesday (*observed*). "A sale counts when you mark an item sold and enter the price, or when a listing published through us sells on eBay" (*observed*). So the sample is the users who come back and report, and the truth is partly typed in by the seller (*inferred*).
- **Categories and price bands.** Ten named categories; those under 8 sales are folded into the totals (*observed*). Sales, typical gap, share inside the range: Clothing 78, 48%, 50%; Electronics 36, 43%, 50%; Collectibles 26, 44%, 50%; Accessories 13, 35%, 46.2%; Pottery and Glass 10, 56%, 20%; Toys 10, 69%, 40%; Shoes 10, 50%, 70%; Jewelry 10, 44%, 40%; Antiques 10, 37%, 60%; Home and Garden 9, 40%, 44.4% (*observed*). Every lean cell reads "Too few to say"; lean needs 15 uncapped sales (*observed*). The pricing step uses calibration "per category and per price band", but no result is reported by price band (*observed*).
- **What counted as the true price.** "The price the item actually fetched", as reported by the seller or read from an eBay sale of a listing they published (*observed*). Shipping, returns and cancellations are not mentioned (*observed absence*).
- **Before or after the sale.** Before, for Underpriced's own number: "Our number is the one the seller saw at scan time" (*observed*). This is the one prospective element in either test.
- **Anchoring.** 312 sales listed within 2% of the estimate are graded separately (3% gap, "Flattering by construction"); the headline is 45% on the 236 sales where the seller chose their own price (*observed*). Even those 236 are capped by the seller's ask: "A listing cannot sell above its asking price" (*observed*). On the 16 sales no ask could cap, the estimate ran 30% high at the median (*observed*).
- **Identity and condition.** Condition is graded from the photo (*observed*). Identity is not checked against anything outside the scan (*observed absence*).
- **How error was computed.** The gap is a share of the *estimate*, not the sale price; the typical gap is the median (*observed*). Half of sales of a "$100" item land between $55 and $145 (*observed*). Coverage: 75.3% of 81 sales priced since the 14 September rebuild landed in a range meant to hold 8 in 10; 48.3% across all 236 self-priced sales; 71.9% across every sale; the old range "held about half" (*observed*).
- **What the competitors were given.** "Each week the new sales get their first photo sent to other models with no hints and no sold data" (*observed*). That happens after the sale (*inferred* from "the new sales"). Perplexity ran with "web search on" (*observed*) and so could find the sold listing itself (*inferred*). On a $100 item: Underpriced $33 on 78 sales; its own model without sold data $33; Perplexity $43 against Underpriced's $33 on the same 77; Gemini $30 against $25 on only 9; ChatGPT $33 against $33 on 76 (*observed*). A model that gave no number is left out of its own count (*observed*).
- **Not stated.** Shipping, returns, unsold items, how seller-typed prices are checked, any price-band result, any outside review. No data is published, so the test cannot be rerun (*observed absence*).

### Against the checklist

| Line | Underpriced AI |
|---|---|
| Run by someone with no stake in the result | not met |
| Sample defined in advance, large enough per category and price band | not met (self-selected reporters; 9 to 78 per category; no bands) |
| Estimate made strictly before the outcome, no leakage | met for its own number; not met for the competitors (asked after the sale, one with web search) |
| Truth is the accepted price net of shipping, cancelled and returned sales removed | not met (seller-typed or eBay price; shipping and returns not stated); Best Offer discounted, not read |
| Unsold items handled | not met (only reported sales) |
| Identity and condition verified | not met (condition from the photo only) |
| Error as a distribution, with coverage of any range | partly: median, interquartile spread, coverage per category; no interval on coverage |
| Simple baselines included (median of recent comps, last sale) | not met (the comparisons are other models, not comps) |
| Repeated over time | met: weekly, with a dated change log (Sep 3, 8, 9, 10, 11, 14, 18, 25, Oct 28) |
| Data and method published | partly: method in prose; no data |

## 3. Why the two sets of numbers do not compare

- FlipTip divides by the sale price, Underpriced by its own estimate (*observed*). The same dollar miss gives different percentages (*inferred*).
- FlipTip samples sales of known models from eBay at random; Underpriced takes whatever its users report (*observed*). The populations differ (*inferred*).
- FlipTip's $28 baseline is the spread of other sales of the same item, which is a property of the market, not of any app (*inferred*). It shows that a single number cannot be precise; it does not set a bar for a range.

## 4. Where this note sits against our other notes

- **Confirms** [range-calibration.md lines 69 to 72](range-calibration.md): the Underpriced figures (75.3% of 81, 45% on 236, the competitor table) match the page.
- **Extends** [range-calibration.md line 76](range-calibration.md): the FlipTip row there is "observed there, not re-opened". It is now opened, and it carries no comparison with ChatGPT, Gemini or Perplexity.
- **Corrects** [range-calibration.md line 91](range-calibration.md): it cites build-plan line 203 for FlipTip's method; the text is at [build-plan.md line 205](../ben/build-plan.md).
- **Contradicts** the use of 28% as an established bar in [build-plan.md line 25](../ben/build-plan.md), [appraisal-run.md lines 118, 210 and 244](../../appraise/ben/appraisal-run.md) and [packet 21 line 32](../../../.agents/team/packets/price/21-pricing-search-watch-plan.md). Those lines mark it *observed, vendor-published*, which is accurate about the page, but the method behind it is not sound enough to be a pass mark.
- **Agrees with** [range-calibration.md lines 93 to 99](range-calibration.md): the leakage routes and the rolling-origin procedure there are what both vendor tests lack.

## 5. What can be taken from each test

From FlipTip: a protocol idea worth copying (first photo only, title and price hidden, the tested sale removed from its comps, per-sale links so anyone can check), and a rough sense that sales of the same identified item spread widely, so a range is needed. Its $26, 57%, 68% and $28 are not a target, because the rule was tuned on the same tests, the comps' timing is not stated, and there is no price band or unsold handling. From Underpriced: the most useful design points are grading only on its own number as shown at scan time, keeping anchored sales out of the headline, and reading high or low only from sales no ask could cap; a dated weekly change log is also worth copying. Its 75.3% of 81 is one coverage figure on a small, self-reported sample, and its comparison with general models is after the fact and leaky. Our own bar is set by our own backtest, with the pass rule in [money.md D6](../../../spec/determinations/money.md#d6-range-calibration-and-display-state) (*agent proposal*).

## Searched / could not reach

- fliptip.ai/accuracy: opened, read in full (HTTP 200).
- underpricedai.com/accuracy: opened, read in full (HTTP 200).
- FlipTip blog post "Can ChatGPT Tell You What an Item Is Worth?": unopened.
- Any independent, third-party test of photo-to-price apps on resale items: none found in this pass.
- Any downloadable dataset or code behind either test: none found on either page.
- Whether FlipTip's baseline comps were restricted to sales before the tested sale: not stated on the page; not reachable without asking the vendor.
