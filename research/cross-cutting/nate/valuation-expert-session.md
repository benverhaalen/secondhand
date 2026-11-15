# What must the valuation engine determine, how should each be done, and what does spec/engines/valuation.md miss, from a resale pricing analyst's view?
Researched 2026-11-14 by Nate (Claude Code lead seat, Opus 5.5). Feature: cross-cutting (price, list, sold).

Task ex-va. Read against [valuation.md](../../../spec/engines/valuation.md) §1, §3, §4 and the price slider, and the money cards D1 to D15 in [money.md](../../../spec/determinations/money.md). The view is a pricing analyst at a resale marketplace who also resells full time: the question at every step is "would I trust this number with my own inventory, and would it hold up in a backtest review?"

Marks: *observed* = I opened the source in this session and it says so (URL given); *asserted* = from memory, a secondary page, or a source that states it without showing it; *inferred* = my own reasoning or arithmetic. Fee facts are taken from [fees-and-taxes.md](../../price/nate/fees-and-taxes.md) (observed there on 2026-11-14) and not re-fetched.

Draft answer from memory, before searching: the doc's comp-and-conformal core is right; the risks are comp normalisation (shipping terms, format, bundles), the slider asking for quantiles the model does not make, and the site rules on offers that cap list-price room. The searches did not change the draft. They added two facts: the Mercari 75% offer minimum and Poshmark sold prices being final order prices.

## (a) Everything that must be determined, item by item against §1

| §1 item | Card | Must determine (analyst's list) | Covered by the doc? |
|---|---|---|---|
| Which sales count as comps, and how much | D1 | identity match level; sale format (fixed price, auction, accepted offer, bundle); whether the price shown is the transaction price; shipping terms of the comp; returns and cancels; duplicates and relists | partly: format, shipping terms, bundles and returns are missing (§(c) 1 to 4) |
| Condition and size adjustment | D2 | condition grade on one scale across sites; completeness; size premium by category and gender | yes, with shrinkage |
| Time adjustment | D3 | trend and season, apart from mix change | partly: the centred mean cannot be computed for "now" (§(c) 6) |
| Site translation | D4 | per-site price level for the same product | yes |
| Range and its state, overall and per site | D5, D6 | calibrated q10/q50/q90; display state; share shown | yes for the 80% band; the slider needs other quantiles (§(c) 7) |
| What the person keeps | D9 | fee on the right base, the shipping the seller pays, promotion fees, tax in base, rounding | the arithmetic is right; the worked example does not follow it (§(c) 5) |
| Chance of sale and days | D10, D11 | price-speed curve with censoring | yes |
| Best set of sites | D12 | marginal gain against double-sale cost | yes |
| Price path | D13 to D15 | start, list, floor, always accept, ladder, stale, relist | yes, but each site's offer rules cap the offer room (§(c) 8) |
| Not in §1, but an analyst must determine it | none | the seller's own price level: account reputation and listing quality move what *this* person gets against the pooled comps | no (§(c) 9) |
| Not in §1 | none | the price ending of the ask, which signals how firm it is | D13 rounds to the commonest ending; the signal is not modelled (§(c) 10) |

## (b) The best method for each, with primary sources

**Comps and weights (D1).** The sales-comparison approach with an effective-count back-off is the right method. It is what appraisers and the auto wholesale index do (*asserted*, already cited in D1). Keep it. Three source facts change how comps are read:
- Poshmark sold prices are the transaction price: "The price of the sold listing will reflect the amount of the final order price" ([poshmark.com/offers_help](https://poshmark.com/offers_help), *observed*). So the D1 Best Offer haircut (`w_type 0.6`, `x (1 - d_offer)`) is an eBay-only correction, and Poshmark rows are plain sold rows (*inferred*).
- eBay Product research returns the accepted Best Offer price over 3 years; the completed-listings search covers only 90 days ([open-facts-money-and-markets.md](../../price/nate/open-facts-money-and-markets.md) row 7, *observed* there). The comp reader should prefer Product research through the person's session (the M3 route) wherever the person has a seller account (*inferred*).
- eBay rows carry `may_model: false` (doc §2). The weight fit, the D2 ratios and the conformal scores then learn only from Mercari, Depop, Poshmark and the person's own orders. In eBay-heavy categories (cards, electronics) the learned weights will rest on thin non-eBay data, and §4 should say what prior holds there (*inferred*).

**Condition and size (D2).** Use paired sales first, then a hedonic log-price fit shrunk to the parent as `n/(n+k)`. This is empirical Bayes, and it is right (*inferred*). One change: fit the condition coefficients per site, since sites' condition vocabularies differ (Poshmark "NWT", eBay "Pre-owned", Mercari "Like new"). Map them to one scale before the fit, and keep the map as a versioned table (*inferred*).

**Time (D3).** Keep the repeat-sales and hedonic month index, which is the Case-Shiller logic (*asserted*, cited in D3). At the current month, use a one-sided smoother: an exponentially weighted index, which §4 already names with a 30-day half-life. A centred 3-month mean needs next month's sales (*inferred*). Season and trend should be separate terms, so that a coat's October rise is not extrapolated into a trend (*inferred*).

**Range and calibration (D5, D6).** Quantile heads plus conformal correction is the right method:
- CQR, Romano et al., [arXiv 1905.03222](https://arxiv.org/abs/1905.03222) (*asserted*, cited in D5);
- ACI for drift, Gibbs and Candès, [arXiv 2106.00170](https://arxiv.org/abs/2106.00170) (*asserted*);
- weighted conformal beyond exchangeability, Barber et al., [arXiv 2202.13415](https://arxiv.org/abs/2202.13415) (*asserted*).

For any quantile other than the 80% band, use a conformal predictive system, which gives a calibrated distribution and so any percentile. crepes, already named in D6, ships `ConformalPredictiveSystem` with Mondrian bins and `predict_percentiles` / `predict_cpds` ([crepes API](https://crepes.readthedocs.io/en/stable/crepes.html), [v0.8.0 release](https://github.com/henrikbostrom/crepes/releases/tag/v0.8.0), *observed*). That is the method for the slider's q20 and q85 (§(c) 7).

**Keep (D9).** Arithmetic in integer cents on each site's own base. The fee rows are *observed* in [fees-and-taxes.md](../../price/nate/fees-and-taxes.md):
- eBay: 13.6% of item + shipping + tax, plus $0.30 or $0.40;
- Mercari: 10% of item + buyer shipping;
- Depop: 0% selling fee, 3.3% + $0.45 processing, and a 12% boosting fee on boosted sales;
- Poshmark: $2.95 under $15, else 20% of the order price excluding shipping and tax.

The rounding rule per site (half-up or banker's, per line or per order) is not written anywhere. It is the va-2 break "fee rounding", and it must be one named function (*inferred*).

**Chance of sale and days (D10, D11).** A mixture cure model with a Kaplan-Meier blend and isotonic recalibration is right, and keeping unsold rows as censored is the step most tools skip (*asserted*, Opendoor cited in D10). Add the queue features the analyst watches:
- the count of live competing asks for the same product on the site;
- the ask's rank among them.

D10 has the rank (rank 2 in its source table). The count, which measures saturation, is missing (*inferred*).

**Best sites (D12).** The greedy marginal rule is right (*inferred*). The independence assumption in `P_set` overstates the gain, because sites draw on overlapping buyers. Damp it with a learned correlation when there are enough double-listed items (*inferred*).

**Price path (D13 to D15).** Arithmetic over the D10 curve is right. Each site's own offer rules bound the offer room `d_{s,cat}`. All of these are *observed* on 2026-11-14:
- Mercari: "The minimum offer amount is set at 75% of the listing price" ([Mercari 327](https://www.mercari.com/us/help_center/article/327/)).
- Mercari: an Offer to Likers must be "at least 10% lower than the historically lowest price", goes to at most 50 recent likers, can be sent once every 72 h and lasts 24 h. Promote is a permanent cut of 5% or more, once per 24 h ([Mercari 347](https://www.mercari.com/us/help_center/article/347/)).
- Poshmark: an Offer to Likers must be at least 10% below the listing price and include a seller-paid shipping discount. A liker receives it only if it is 10% below the lowest offer they got in the last 90 days ([Poshmark blog 2018-02-24](https://blog.poshmark.com/2018/02/24/new-feature-alert-offer-to-likers/)).
- eBay: auto-accept must be below Buy It Now, and automatic responses do not run during a Discounts Manager sale event ([eBay help 4144](https://www.ebay.com/help/selling/listings/selling-buy-now/adding-best-offer-listing?id=4144)).
- Depop: an automatic offer must be at least 5% under the listing price ([Depop Selling API](https://partnerapi.depop.com/api-docs/how-to-guides/managing-offers/)).

**Price endings.** On eBay, listings at multiples of $100 "receive offers that are 8–12 percent lower but are 15–25 percent more likely to sell" (Backus, Blake and Tadelis, JPE 127(4) 2019, [doi 10.1086/701699](https://www.journals.uchicago.edu/doi/full/10.1086/701699), *observed* abstract). Precise first offers draw smaller counter-adjustments (Mason et al. 2013, [doi 10.1016/j.jesp.2013.02.012](https://doi.org/10.1016/j.jesp.2013.02.012), *observed* abstract). So the ending is a posture lever: round when priced to go, precise when held firm (*inferred*). The effect was measured at $100 multiples, so its size at $40 is unknown (*inferred*).

**Bargaining cost by price.** On eBay, buyers under $50 more often pay the ask, and sellers more often accept than haggle ([NBER Reporter 2020 no. 4](https://www.nber.org/reporter/2020number4/empirical-analysis-bargaining), *observed*). The offer room `d_{s,cat}` should be learned per price band, not only per category (*inferred*).

**Seller-specific level.** On eBay, an established seller identity earned about 8% more than new identities selling the same goods (Resnick, Zeckhauser, Swanson and Lockwood, Experimental Economics 9(2) 2006, *asserted* from memory; not opened). A per-account residual, shrunk to 0 by the person's own sale count, is the standard random-effect fix (*inferred*).

## (c) What the doc misses

1. **Shipping terms of a comp.** A $48 free-shipping sale and a $40 + $8 sale are the same delivered price, but D6 step 3 takes buyer-paid shipping off and so scores them as 40 and 48. D1 never normalises comps for shipping. Comps and truth should both be the delivered price less the shipping the item's own plan would charge, stated per site (*inferred*). This is the largest error source in low-price apparel, where shipping runs to 15 to 30% of the price: a $6.49 Poshmark label on a $25 item is 26% (*inferred* from the *observed* label rate in fees-and-taxes.md).
2. **Sale format.** Auction sales, Buy It Now at the ask, and accepted offers come from different mechanisms. A sale at the ask is a lower bound on what the buyer would pay; an auction that started low is a draw from bidders on the day. D1's `w_type` has no format level, and D6 step 5 separates at-ask sales only in the score, not in the comp weight (*inferred*). Einav, Farronato, Levin and Sundaresan (JPE 2018, "Auctions versus Posted Prices in Online Markets", *asserted*, not opened) is the source to read for the format effect.
3. **Bundles.** Mercari bundle offers have "no minimum offer amount" ([Mercari 327](https://www.mercari.com/us/help_center/article/327/), *observed*), and Poshmark bundles are common. A bundle sale is not an item price. D1 drops "lot" but not multi-item bundle orders (*inferred*).
4. **Returns and cancels in comps.** D6 removes them from the truth; D1 does not remove them from the comps (*inferred*).
5. **The worked example breaks D9's own rule.** valuation.md computes keep(48) = 0.864 x 48 - 0.40 - 9 = $32.07, "fee on the item price only, for this example". D9 says eBay's base is item + shipping + sales tax, with tax at the 7% placeholder. With free shipping the base is 48 + 3.36 = 51.36, the fee is 6.98 + 0.40, and keep is $31.62, or $31.61 if the fee rounds up (*inferred* arithmetic). The gap is $0.45, above D9's own $0.25 check. va-1 accepts "the worked example... matches to the cent", so the fixture will encode the wrong keep unless the example is fixed.
6. **The D3 centred mean at "now".** `I_cat(now)` from a 3-month centred mean needs month + 1. Computed at issue time, it either leaks future sales into the backtest or is undefined. §4's exponentially weighted index is the right estimator, and the card and engine disagree (*inferred*). The va-3 leakage fixtures should seed this case.
7. **The slider asks for quantiles nobody computes.** Posture 0 uses q20 and posture 1 uses q85, but D5 makes only q10, q50 and q90, and D6 calibrates only the 80% band. Between the three marked points, the mapping from `posture` to a quantile is not stated: linear in the quantile, or linear in price? Proposal: take the quantile from a Mondrian conformal predictive system (crepes, above), with `quantile(posture) = 0.20 + 0.65 x posture`, so quick (0.15) asks at about q30, balanced at about q52 and max_return (0.85) at about q75 (*inferred*). Then check each point's calibration in the D6 backtest the way the band is checked.
8. **Site offer rules bound the room the slider adds.** At posture 1, "the room left for offers" is the learned discount. On Mercari a buyer cannot offer under 75% of the list, so `d` is capped at 0.25 there. An Offer to Likers on Mercari ratchets the "historically lowest price", so each one spends future room. On Poshmark, an Offer to Likers must also carry a seller-paid shipping discount, which comes out of the keep. D13 step 2 and the D15 table (the offer to watchers at 1.5 m) ignore all three (*inferred* from the *observed* rules above).
9. **The person's own price level.** The doc prices the item as the pooled comps' seller would sell it. A new account with no feedback gets less, and a power seller with good photos gets more (Resnick 2006, *asserted*). Listing quality enters D10 (speed) but not D5 (price). A per-account residual, learned nightly and shrunk to 0, belongs in D5's features or as a post-hoc offset (*inferred*).
10. **Price endings as a posture signal.** D13 rounds to the commonest ending among sold comps. The evidence says the ending tells buyers how firm the ask is (Backus et al. 2019, Mason et al. 2013, *observed* abstracts). The ending should come from `posture`, not from the comps' habit (*inferred*).
11. **Slider edges.** At posture 0 the ask is "under the cheapest comparable top listing", and that listing can be under the floor. The doc says the floor wins, but not what the card says then (the person cannot be cheapest above their floor). At posture 1, the ceiling is "the cheapest official price after credible discounts", but a used item is rarely worth the new price. A ceiling at 1.0 x new is loose, and the useful cap is the D2 condition ratio x the new price (*inferred*). va-7's break "credible discount lowers ceiling" should cover both.
12. **Saturation.** The count of live asks for the same product (supply against the sale rate) is an analyst's first look, and it is not a D10 feature (*inferred*).
13. **Promotion cost in the path.** Depop's 12% boost fee and eBay's ad rate both enter D9 as `boost_s`. But D15 never chooses whether to promote, so the plan's E_k ignores the trade of a fee for speed (*inferred*; fee facts *observed* in fees-and-taxes.md).

## What I searched and could not reach

Searched (Exa, 2026-11-14): the eBay, Poshmark, Mercari and Depop help pages on offers and offers to likers; crepes docs; Backus et al. 2019; Mason et al. 2013; the NBER Reporter piece. Not opened: Einav et al. 2018 and Resnick et al. 2006, both from memory and marked *asserted*. Not found: whether Mercari and Depop sold pages show the accepted-offer price or the list price; Mercari's Smart Pricing algorithm. A narrow search does not show these are unpublished.

## Diff (proposed changes against spec/engines/valuation.md; each is an agent proposal, none is applied)

- *agent proposal* §3 step 3 and D1: normalise every comp to delivered price less the plan's own shipping, per site, and use the same rule for the D6 truth. Changes **va-1** accepts (a fixture with a free-shipping and a buyer-paid comp at the same delivered price gives equal adjusted prices) and **va-3** accepts (the truth rule matches the comp rule).
- *agent proposal* Worked example: recompute keep(48) under D9's base (item + shipping + tax), giving $31.62 under half-up rounding, or state that the example's fee rule is not D9's. Changes **va-1** accepts ("matches to the cent" then means D9's arithmetic) and **va-2** breaks ("fee rounding" names the rounding function and its fixture).
- *agent proposal* The price slider: make the ask at `posture` the conformal-predictive-system percentile `0.20 + 0.65 x posture` (Mondrian crepes CPS), and check each marked point's calibration in the backtest. Changes **va-7** accepts (an ask at any point comes from one calibrated percentile function), **va-5** accepts (the nightly fit makes the CPS next to the CQR band) and **va-3** accepts (coverage reported at q30, q52 and q75 as well as the 80% band).
- *agent proposal* §2 and §3 step 13: add a `site_rules` row per site (min offer share, offer-to-likers minimum and ratchet, cadence, expiry, shipping-discount requirement, auto-response exclusions). Cap `d_{s,cat}` at `1 - min_offer_share`. Have D15 count the ratchet an offer to likers spends. Changes **va-2** accepts (Mercari list never above `start / 0.75`; a fixture with an offer to likers lowers the next allowed one) and **va-7** breaks (add "Mercari at posture 1").
- *agent proposal* D3 and §4: use the one-sided exponentially weighted index at issue time and drop the centred mean for the current month. Changes **va-3** accepts (a seeded "next-month index" leak is caught) and **va-1** breaks (add "index uses a future month").
- *agent proposal* D1 `w_type`: add a format level (fixed price at ask, fixed price below ask, accepted offer, auction, bundle). Treat a bundle as no item comp, and a sale at the ask as a lower bound, weighted apart. Changes **va-1** accepts and breaks (add "a bundle sale").
- *agent proposal* D5 features and §4: add a per-account price residual, shrunk to 0 by the person's own sale count, and the listing-quality score. Changes **va-5** accepts (a residual learned only from the person's own orders, inside the ±50% guard) and **va-6** accepts (the object carries the offset with its basis).
- *agent proposal* D13 step 3: choose the price ending from `posture` (round under 0.5, precise at 0.5 and above, as a starting rule to test), not from the comps' most common ending. Changes **va-7** accepts and **va-2** accepts.
- *agent proposal* The price slider: at posture 1 the ceiling is `min(official after credible discount x D2 condition ratio, q90)`, out of stock excepted. When the cheapest top listing is under the floor, the card says the ask is held at the floor. Changes **va-7** accepts and breaks ("credible discount lowers ceiling", plus "cheapest listing under the floor").
- *agent proposal* §2: name the training gap from `may_model: false` on eBay rows, and the prior that holds where non-eBay data is thin (the written D1 numbers, with no fit, flagged per category). Changes **va-5** accepts (no weight fit in a cell whose non-eBay `n` is under its minimum).
- *agent proposal* D10 features: add the count of live same-product asks on the site (saturation) next to the rank. Changes **va-5** accepts (the cure model's feature list).
