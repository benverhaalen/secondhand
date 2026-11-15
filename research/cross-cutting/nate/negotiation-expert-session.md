# What must the negotiation engine determine, how should each be done, and what does spec/engines/negotiation.md miss, from a full-time reseller's and a bargaining researcher's view?
Researched 2026-11-14 by Nate (Claude Code lead seat, Opus 5.5). Feature: cross-cutting (sold, list, appraise).

Task ex-ng. Read against [negotiation.md](../../../spec/engines/negotiation.md) §1, §3 and §4, and the money cards D14, D16 and D17 in [money.md](../../../spec/determinations/money.md). The view combines two people:
- a reseller answering hundreds of offers a week on eBay, Poshmark, Depop and Mercari, who knows each site's buttons and timers;
- a negotiation researcher, who asks whether each model choice matches the field evidence on online bargaining.

Marks: *observed* = I opened the source in this session and it says so (URL given); *asserted* = from memory, a secondary page, or a source that states it without showing it; *inferred* = my own reasoning or arithmetic. Every site rule below was read on the site's own help page on 2026-11-14, except where marked.

Draft answer from memory, before searching: the argmax-of-expected-keep frame is right. The weak points are a prior built from an agent concession tactic instead of field data, the missing per-site rules, and a switch rule too small to detect the gains it measures. The searches confirmed the draft and changed two things:
- a public dataset of 25 million eBay bargaining threads exists to fit the prior;
- eBay's accepted offer does not secure the item until payment.

## The site rules the engine must obey (observed)

| Rule | eBay | Poshmark | Mercari | Depop |
|---|---|---|---|---|
| Seller's time to answer a buyer offer | 24 h ([4144](https://www.ebay.com/help/selling/listings/selling-buy-now/adding-best-offer-listing?id=4144)) | 24 h ([offers_help](https://poshmark.com/offers_help)) | 24 h ([330](https://www.mercari.com/us/help_center/article/330/)) | 14 days ([Make Offer](https://depophelp.zendesk.com/hc/en-gb/articles/4412315779345-Make-Offer)) |
| Life of a seller counter | 96 h (4144) | 24 h | 24 h (330) | 14 days |
| Counter bounds | "lower than the Buy It Now price, but higher than the offer you received" (4144) | not stated | not stated | not stated |
| Rounds | 5 counteroffers each (4144); buyer up to 3 offers per item ([4019](https://www.ebay.com/help/buying/buy-now/making-best-offer?id=4019)) | not stated | not stated | one active offer per buyer per item |
| Minimum buyer offer | seller's auto-decline only | none stated | 75% of list; no minimum on bundles ([327](https://www.mercari.com/us/help_center/article/327/)) | none stated |
| Binding on accept | the item "will still be available to other buyers until you complete payment" unless autopay (4019) | "Offers are Binding... payment will be processed immediately" | "immediately charged" (327) | the buyer has 14 days to buy at the agreed price; others can still buy |
| Seller's offer to interested buyers | the 30 most recent watchers or cart holders, re-sent every 48 h, valid 96 h (4144); at least 5% under Buy It Now ([SaleLinx 2026-10-17](https://salelinx.com/blog/how-to-send-offers-ebay-vinted-depop), *asserted*, secondary) | at least 10% off with a seller-paid shipping discount; reaches a liker only if 10% below their lowest offer in 90 days; 24 h ([blog 2018-02-24](https://blog.poshmark.com/2018/02/24/new-feature-alert-offer-to-likers/)) | at least 10% below the "historically lowest price"; at most 50 likers; once per 72 h; 24 h; binding ([347](https://www.mercari.com/us/help_center/article/347/)) | to one or all likers in-country, 14 days ([Send Offer](https://depophelp.zendesk.com/hc/en-gb/articles/15495796917777-Send-Offer)); API auto-send 1 h after a like, at least 5% under list ([Selling API](https://partnerapi.depop.com/api-docs/how-to-guides/managing-offers/)) |
| Site automation | auto-accept and auto-decline, upper limit below Buy It Now, off during a sale event (4144) | Offer Automation for enterprise sellers: a "3-step tiered" counter down to a price floor ([Poshmark business help](https://poshmark-business-se.instantdocsbase.com/help/what-is-offer-automation)) | Smart Offers and Smart Pricing with a floor (347) | auto-respond: accept at or above the lowest price, else counter at it, "within 60 seconds" ([Auto-respond](https://depophelp.zendesk.com/hc/en-gb/articles/42789384303761-Auto-respond-to-offers)) |
| Blocks | none found | none found | no accepting, countering or sending offers past the 1099-K threshold without a verified W-9 (330) | none found |

## (a) Everything that must be determined, item by item against §1

| §1 output | Must determine | Covered by the doc? |
|---|---|---|
| Accept | `keep(o)` against `V_wait`; whether the accept secures the sale (payment) | partly: the chance of payment after accept is missing (§(c) 3) |
| Counter at an amount | `P_accept(c)`; the buyer's next offer if they counter (reciprocity); the site's counter bounds and round budget | partly: reciprocity, bounds and budget are missing (§(c) 1, 2, 4) |
| Decline | `V_wait`; the chance the buyer comes back higher | yes (`q_return`) |
| Wait | `P(higher offer before expiry)`; how long to wait on each site | partly: Depop's 14-day window makes "2 h before expiry" wrong (§(c) 5) |
| Offer to watchers or likers | the amount, the time, the audience; the site's minimum, cadence and ratchet; the cost of a shipping discount | partly: site rules and Poshmark's shipping discount are missing (§(c) 6) |
| Nudge | when, and whether at all | yes, as a rule |
| Buyer's opening offer | `P_seller_accept(o)`; the site minimum; the seller's likely counter; the offer budget | partly: the opener is one-shot, not planned over rounds (§(c) 8) |
| Answer to a seller's counter | the same argmax, under `max_pay` | yes |
| Every output's fields | add `propensity`, `site_rule_version`, `paid` | no (§(c) 9) |
| D14 lines | floor and always accept per site | yes; eBay requires auto-accept under Buy It Now (§(c) 10) |
| D16 rule 2 midpoint | the champion counter | wrong after round 1 (§(c) 1) |
| D17 `max_pay` | the buyer's ceiling | yes; the opener needs the rules above |

## (b) The best method for each, with primary sources

**What field data says about online bargaining.**
- Backus, Blake, Larsen and Tadelis, "Sequential Bargaining in the Field", QJE 135(3) 2020 ([doi 10.1093/qje/qjaa003](https://doi.org/10.1093/qje/qjaa003); [PDF](https://faculty.haas.berkeley.edu/stadelis/qjaa003.pdf); NBER w24306), all *observed*:
  - 88.4 million eBay Best Offer listings and 25.5 million threads;
  - "One-third of bargaining interactions end in immediate agreement";
  - concession is "reciprocal (and gradual)";
  - players prefer offers "that split the difference between the two most recent offers";
  - the average sale is 73% of list when bargaining happens, and almost 80% of listings never get an offer.
- The anonymised listings and threads are public at [NBER, Best Offer Sequential Bargaining](https://www.nber.org/research/data/best-offer-sequential-bargaining) (*observed*). The data is from 2012 to 2013, when each side had 3 offers with 48 h each, and today's rules differ (above). Its licence is "for research purposes" (*observed*), so using it to set a commercial prior needs a terms check before any fit (*inferred*).
- Keniston, Larsen, Li, Prescott, Silveira and Yu, International Economic Review 2024 ([doi 10.1111/iere.12719](https://doi.org/10.1111/iere.12719); NBER w29111), *observed*:
  - acceptance "jumps discontinuously at offers that lie halfway between the two most recent offers";
  - a split offer is accepted more often "than a slightly more generous offer";
  - a seller is "less likely to propose a 50-50 split" after an extremely low offer;
  - the split is between the two most recent offers, not private anchors such as the auto-accept price.
- Bargaining is costly at low prices. Under $50, buyers more often pay the ask, and sellers more often accept than haggle ([NBER Reporter 2020 no. 4](https://www.nber.org/reporter/2020number4/empirical-analysis-bargaining), *observed*).
- Round asks invite lower offers. Listings at $100 multiples get first offers 8 to 12% lower and are 15 to 25% more likely to sell (Backus, Blake and Tadelis, JPE 2019, [doi 10.1086/701699](https://www.journals.uchicago.edu/doi/full/10.1086/701699), *observed* abstract). Precise offers draw smaller counter-adjustments, and the effect carries to the final price (Mason et al. 2013, [doi 10.1016/j.jesp.2013.02.012](https://doi.org/10.1016/j.jesp.2013.02.012), *observed* PDF highlights).

**`P_accept` (§3 step 3).** A hierarchical logistic with partial pooling is right (*inferred*). Three changes to its features and prior:
- Add `is_split`: the counter lies within one site ending of the midpoint of the *two most recent offers*. Keniston et al. show a discontinuity at that point, which a smooth gap-ratio term cannot fit (*observed* finding; the feature is *inferred*).
- Add the price band (under $50, $50 to $200, over $200) and a precise-ending flag, both from the evidence above (*inferred*).
- Fit the prior on the NBER threads, by category and price band, with the rules of the day as features, if the licence allows. The current prior is the Faratin, Sierra and Jennings concession tactic `F(t) = k + (1 - k) t^(1/beta)` (Robotics and Autonomous Systems 24, 1998, *asserted*, not opened). That function describes how an agent *makes* concessions, not how a buyer *accepts* them, so it is a category error as an acceptance prior (*inferred*). If the licence bars the NBER data, fall back to a flat prior centred so that the split offer is accepted half the time, which keeps the midpoint champion as the doc intends (*inferred*).

**The buyer's next move (`V_after`).** Replace the single `q_return` with a model of the buyer's next offer given the counter: an ordered or beta regression of the buyer's next concession, as a share of the gap, on the counter's own concession. Backus et al. find reciprocal concession, so a counter that concedes more draws a bigger next step (*observed* finding; the model is *inferred*). Without it, the argmax undervalues moderate counters in round 1.

**`V_wait` and waiting (§3 steps 4 and 6).** Keep the D15-based value. Cap the wait per site at `min(expiry - 2 h, W_s)`, with `W_s` learned from the hour-to-response curve. On Depop, "2 h before expiry" is 13.9 days, and Depop sells auto-respond on replies "within 60 seconds" (*observed* vendor claim; the cap is *inferred*).

**Exploration and evaluation (§3 step 5, §4).** Thompson sampling inside the hard limits is right (*inferred*). For off-policy evaluation of later policies against the log, store each decision's propensity with the outcome: the probability the policy chose that amount. Doubly robust evaluation needs it (Dudík, Langford and Li, [arXiv 1103.4601](https://arxiv.org/abs/1103.4601), *asserted*, not opened). Under Thompson sampling the propensity is not closed-form; estimate it by resampling the posterior about 200 times at decision time and logging the share that picked the chosen amount (*inferred*).

**The switch rule's power (§4).** Use the worked example's own numbers. A $75 counter keeps $55.40 at P 0.30, otherwise $44.00, so the SD of keep per offer is 11.40 x sqrt(0.30 x 0.70) = $5.22. With 50 offers per arm, the SE of the difference is 5.22 x sqrt(2/50) = $1.04. A $0.48 true gain then has a 95% lower bound above 0 only about 7% of the time (P(Z > 1.96 - 0.46)). Detecting it at 80% power needs about 2(1.96 + 0.84)^2 x 5.22^2 / 0.48^2 ≈ 1,850 offers per arm per cell (*inferred* arithmetic).

The rule runs weekly over many cells, which is repeated peeking: with 100 cells and no true gain, about 2 or 3 cells switch by chance each week (*inferred*). Use one of these instead (*inferred*):
- a hierarchical estimate of the gain, pooled across cells, that switches on the posterior;
- an always-valid sequential test (confidence sequences, Howard et al., [arXiv 1810.08240](https://arxiv.org/abs/1810.08240), *asserted*, not opened).

**Offers to watchers (§3).** A Beta per hour-of-week bucket is 168 buckets per site. Pool it as day-part x weekday under a site prior, or it will not converge before the D15 rung moves (*inferred*). The amount must respect each site's minimum and ratchet (table above). Poshmark's required shipping discount is a cost in `keep` (*observed* rule; the cost is *inferred*).

**The buying side (D17, §3).** On eBay the buyer has 3 offers, and on Mercari no offer may go under 75% of list (*observed*). Plan the opener over rounds, not one shot. If the seller splits the difference, the expected price after one counter is about (o + L) / 2, so an opener aimed at a final target T is about 2T - L, floored at the site minimum. This sits inside the argmax as the prior for `P_seller_accept` (*inferred* from the split norm, *observed* above). On Poshmark and Mercari, an accepted offer charges at once, so the card's "binds the buyer" line is right there. On eBay, the obligation exists but the item stays available until paid (4019, *observed*), and on Depop the buyer then has 14 days to buy.

## (c) What the doc misses

1. **The midpoint is computed between the wrong numbers after round 1.** D16 rule 2 and the worked example use `(o + current price) / 2`. The norm is the two most recent offers (Keniston et al., *observed*). From round 2 that means the seller's last counter and the buyer's latest offer, not the list price. Using the list price overshoots and loses the acceptance jump (*inferred*).
2. **The candidate set breaks eBay's counter bounds.** Candidates are "every price... between `floor` and the current price". eBay requires a counter strictly above the offer and strictly below Buy It Now (*observed*). With floor 60 and offer 62, $60 is a candidate. It is dominated, and eBay rejects it. The limits are `(max(floor, o), ask)`, open at both ends on eBay (*inferred*). The rounding rule also never lets the exact midpoint ($71 in the example) be chosen, though the evidence favours it.
3. **Accept is not a sale on eBay or Depop.** `P_accept = 1` for accepting. On eBay without autopay, and on Depop, the buyer must still pay, and others can buy meanwhile (*observed*). `E[keep](accept)` needs `P_pay` per site, learned from `offer_outcome.paid`. An unpaid accept should return the item to the plan with its time spent (*inferred*).
4. **No round budget.** eBay allows 5 counters per side and 3 buyer offers per item (*observed*), and each round spends one. The argmax is one-step; at the last allowed round, the counter is take-it-or-leave-it and should be priced that way (*inferred*).
5. **Wait on Depop.** The rule "until 2 h before the offer's expiry" means 13.9 days on Depop and 22 h on the others (*inferred* from the *observed* timers). A reseller answers in minutes, and the speed claim is Depop's own selling point (*observed*).
6. **Offer to likers rules and cost.** The doc has one offer per D15 rung at the argmax amount. Each site's rules then bite (*observed*):
   - Poshmark requires 10% off plus a seller-paid shipping discount, and the 90-day per-liker ratchet means a second offer reaches no one unless it is a further 10% down.
   - Mercari's offer to likers must go 10% below the historically lowest price and can be sent once per 72 h, so each one permanently lowers the next.
   - eBay re-sends every 48 h to the next 30 buyers.

   The value of an offer to likers must subtract the room it burns, and the amount must sit at or above the site minimum (*inferred*).
7. **A site block is not an outcome type.** Mercari blocks accepting and countering for a seller past the 1099-K threshold without a W-9 (*observed*). The offer then expires. `offer_outcome.response` needs `blocked_by_site`, and auto mode must stop and ask (*inferred*).
8. **The buyer opener is myopic.** `argmax_o P(o) x (max_pay - o)` ignores the counter that follows. With the split norm, the right opener is lower and planned (above). It must also respect Mercari's 75% minimum, or the offer cannot be sent (*inferred*).
9. **The log lacks fields that evaluation and learning need.** `offer_outcome` has no `propensity`, `paid`, `site_rule_version`, `posture`, `is_split` or `last_two_offers`. Without the propensity, a new policy can only be judged by live A/B, which the power arithmetic above makes slow (*inferred*).
10. **D14 against eBay.** `always_accept` must be strictly under Buy It Now to be set as eBay's auto-accept. Automatic responses stop during a Discounts Manager sale event (*observed*), so a D26 sale lever silently turns off the floor guard on eBay's side, and the engine must answer those offers itself (*inferred*).
11. **The prior.** The Faratin curve is an agent's concession tactic, not an acceptance model (b). The doc marks it *inferred*, and the field data to replace it exists (*observed*).
12. **The switch rule cannot detect its own example's gain**, and it peeks weekly across many cells (b). This affects ng-5 directly.
13. **Rivals the parity table omits.** Poshmark's enterprise Offer Automation already runs a tiered 3-step counter to a floor, and asks sellers not to tell buyers it is automated. Depop's auto-respond counters at the floor itself, which shows every buyer the floor (*observed*). Both are the baseline the champion must beat, and "counter at the floor" is a weaker champion than the midpoint (*inferred*).
14. **Posture.** ng-5 reads `posture` from va-7, but §3 never says how. The slider's table gives "accept at once" at 0 and "counter high, concede slowly" at 1. The clean form is posture as a temperature on the counter: at 0 the candidate set shrinks to accept-or-split, and at 1 the split candidate is removed in round 1 (*inferred*).

## What I searched and could not reach

Searched (Exa, 2026-11-14): eBay, Poshmark, Mercari and Depop help pages on offers, counters, offers to likers and automation; the Depop Selling API; Backus et al. 2020 and 2019; Keniston et al. 2024; Mason et al. 2013; the NBER data page.

Not opened, and marked *asserted*: Faratin et al. 1998, Dudík et al. 2011, Howard et al., and eBay's 5% send-offer minimum (from a secondary page).

Not found: Poshmark's limits on counter rounds or a minimum offer; Depop's counter bounds; the NBER data's full licence text. A narrow search does not show these do not exist.

## Diff (proposed changes against spec/engines/negotiation.md; each is an agent proposal, none is applied)

- *agent proposal* §3 step 1 and step 2: bound counters to the open interval `(max(floor, offer), ask)` on eBay, and per site from a `site_rules` row. Add the exact two-most-recent-offers midpoint as a candidate even when it breaks the ending rule. Changes **ng-1** accepts (the limits property test adds "no counter at or below the offer, none at the ask on eBay") and breaks (add "floor under the offer").
- *agent proposal* D16 rule 2 and §3: compute the champion midpoint between the two most recent offers (in round 1, the list price and the offer; after that, the seller's last counter and the buyer's latest offer), and add `is_split` and the price band to the `P_accept` features. Changes **ng-1** accepts (a round-2 fixture), **ng-3** accepts (calibration reported for split and non-split counters apart) and **ng-5** accepts (the champion uses the round-aware midpoint).
- *agent proposal* §3 step 3: replace the Faratin concession curve as the `P_accept` prior with a prior fitted on the NBER eBay Best Offer threads, by category and price band, once its licence is confirmed. Otherwise use a flat prior centred on the split. Changes **ng-3** accepts (the prior's source and version are recorded) and **ng-4** accepts (scripted buyers' walk-away and concession draws come from the same threads, so the simulator is not fitted to our own champion).
- *agent proposal* §1 and `offer_outcome`: add `propensity`, `paid`, `blocked_by_site` as a response, `site_rule_version`, `posture`, `round_budget_left` and `last_two_offers`. Make `E[keep](accept)` use `P_pay` per site. Changes **ng-2** accepts (every row carries a propensity; an accept with no payment is recorded as unpaid, not as a sale) and breaks (add "accept never paid" and "site blocked the reply").
- *agent proposal* §4 switch rule: replace the per-cell bootstrap at 50 offers with a hierarchical pooled gain estimate, or an always-valid sequential test. State that the doc's example gain of $0.48 needs about 1,850 offers per arm per cell to detect. Changes **ng-5** accepts (no switch from weekly peeking; a fixture with 100 null cells switches at most the error rate) and breaks ("challenger loses" plus "null challenger in 100 cells").
- *agent proposal* §3 step 6: cap the wait per site at `min(expiry - 2 h, W_s)`, with `W_s` learned from response timing. Changes **ng-1** accepts (no wait longer than `W_s`; Depop fixture).
- *agent proposal* §3 offers to watchers: enforce each site's minimum, cadence, audience and ratchet. Count the room an offer to likers burns, and Poshmark's seller-paid shipping discount, in its keep. Pool send hours as day-part x weekday. Changes **ng-1** accepts (no watcher offer under the site minimum) and **ng-4** accepts (scripted likers respond to the offer amount and to the ratchet).
- *agent proposal* §3 the buying side: plan the opener over the buyer's offer budget, using the split norm as a prior (opener about `2T - L`), floored at the site minimum (Mercari 75%). Changes **ng-5** accepts (no Mercari opener under 75% of list; the opener still asks every time, J4).
- *agent proposal* §3: state how `posture` sets the policy: at 0, accept or one split counter; at 1, no split counter in round 1 and slower concession; with a precise-ending counter from 0.5 up. Changes **ng-5** accepts ("an offer contradicts the posture" becomes a testable table) and breaks ("posture quick").
- *agent proposal* §7: add Poshmark Offer Automation (tiered counters to a floor) and Depop auto-respond (counter at the floor) as named rivals, and make "counter at the floor" a baseline in the scripted-buyer runs next to the midpoint. Changes **ng-4** accepts (three policies scored: floor, midpoint, challenger).
