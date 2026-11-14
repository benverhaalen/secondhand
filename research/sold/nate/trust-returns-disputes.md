# What happens after and around a sale on eBay, Facebook Marketplace, Depop, Poshmark and Mercari (returns, disputes, cancellations, fraud), and what must an app acting for the seller and helping a buyer know and never do?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: sold.

How to read the marks. Official help pages came back as search-engine highlight text, not as full page fetches (the eBay and Mercari sites block plain HTTP fetches), and none of them showed a "last updated" date. "Undated" means the page carried no date; the retrieval date is 2026-11-14. *observed* = the highlight text of that URL said so. *asserted* = a secondary source (blog, seller-tool vendor) or memory. *inferred* = my reasoning. "Unopened" = a URL I only saw listed.

## Existing notes: confirm, extend, contradict

- Confirms [missing-features.md](../../cross-cutting/ben/missing-features.md) line 30 (M14): Posh Authenticate applies at $500 USD / $700 CAD and up, *observed*, https://poshmark.com/posh_authenticate, undated. eBay Authenticity Guarantee is wider than the "sneakers, watches, bags, trading cards" in that line; see section 6.
- Extends line 12 (M1, "handling time 1 to 3 business days"): the deadlines that cost money are platform auto-cancels. Depop cancels an unshipped order after 10 days, Facebook after 7 calendar days, Mercari gives the seller a 3-day ship window (section 3).
- Extends line 14 (M3): each platform has a buyer claim window measured from a carrier delivery timestamp, 72 hours on Poshmark and Mercari (section 2).
- Extends line 36 (M20) and [messages-and-offers.md](../../messages/ben/messages-and-offers.md) lines 59 to 63 and 82 to 88 (scam predicates, "never alone" scam card): sources here give four named local scam patterns; one (shipping-label scam) rests on a single secondary source (section 8).
- Contradicts neither note. messages-and-offers.md line 82 ("offer above ask" as an overpayment signal) matches the overpayment pattern in section 8.

## 1. Returns: window and who pays

| Marketplace | Rule | Mark and source |
|---|---|---|
| eBay | Seller sets the return policy. If the seller offers no returns, the buyer must request a return for a not-as-described item within 3 calendar days of estimated or actual delivery. If the seller offers returns, the buyer requests within the seller's stated window. Event tickets: 30 calendar days after delivery or 7 days after the event, whichever is later. Seller must respond within 3 business days of the request, and eBay may accept the return on the seller's behalf. Seller refunds within 2 business days of receiving the return. Return shipping payer depends on the reason and the seller's stated policy (the highlight did not state it in full). | *observed*, https://www.ebay.com/help/policies/ebay-money-back-guarantee-policy/ebay-money-back-guarantee-policy?id=4210 , undated |
| Facebook Marketplace | Purchase Protection covers only shipped orders paid through Facebook checkout (not local pickup, not Messenger deals). Buyer reports to the seller first; seller gets 2 business days; then the buyer files with Meta. Reported figures conflict: 3 days from tracked delivery to report, and 7 or 45 days to file, depending on source. | *asserted* (secondary), https://www.fbresellersclub.com/blog/does-facebook-marketplace-have-seller-protection (2026-09-26) and https://smklog.com/lp/facebook-marketplace-shipping-protection (undated). Meta's own page was not opened. |
| Depop | Depop Protection refunds lost, damaged, wrong-size, wrong-colour, counterfeit, missing-in-bundle and significantly not as described items. It excludes smells, minor damage on second-hand or vintage items, and change of mind. Order must be paid through Depop Payments. Non-delivery claim within 30 days of purchase, raisable from day 5. | *observed*, https://depophelp.zendesk.com/hc/en-gb/articles/360001772468-How-do-I-get-a-refund and https://depophelp.zendesk.com/hc/en-gb/articles/4417835938577-Resolution-Centre-for-buyers , undated. These are en-gb pages. https://www.depop.com/returns/ (US) unopened. |
| Poshmark | Sales are final unless the item never ships or does not match the listing. Buyer has 72 hours after delivery to open a return case in-app (emailing support does not count). With no case in 3 days, payment auto-releases. Approved returns ship back within 5 days. Optional buyer-paid "Worry-Free Returns" add-on gives 7 days for fit or change of mind. | *observed* for 72 hours, 3 days, 5 days and the fit and change-of-mind exclusion: https://poshmark.com/Posh_protect , undated. *asserted* for the add-on's testing since 2026-01-30 (secondary). |
| Mercari | Buyer has 72 hours after carrier-confirmed delivery to report an item not as described. If the buyer rates the order or does not ask for a return in 72 hours, no return or refund. A return request must go through the Order Status or Rating page; a request elsewhere does not pause the transaction. The buyer drops the return at the carrier within 72 hours of receiving the label, with a carrier scan within 168 hours of approval, or the return may be voided and payment released to the seller. Buyer Protection fee is 3.6% of item price plus buyer-paid shipping and may not be refunded. | *observed*, https://www.mercari.com/us/help_center/topics/returns/policies/refunds-and-returns/ and https://www.mercari.com/us/help_center/article/235/ , undated. Fee also in https://www.mercari.com/us/help_center/article/169/ (seen via a fee-data page dated 2026-11-12). |

## 2. Disputes and case timelines

- eBay, item not received: seller must respond with tracking, a delivery update or a refund within 3 business days of the report date; eBay may close the case automatically once tracking shows delivery. A 21 business day figure appears in the same table (my highlight cut off the row, so what it governs is unknown). *observed*, eBay MBG policy URL above, undated.
- eBay, buyer cancel request: up to 30 calendar days after the order, or until shipped or collected in person; seller must respond within 3 calendar days or a paid-order request closes and an unpaid order auto-cancels. *observed*, https://www.ebay.com/help/policies/member-behavior-policies/order-cancellation-policy?id=5298 , undated. The Post-Order API guide (https://developer.ebay.com/api-docs/user-guides/static/post-order-user-guide/post-order-cancellations.html, unopened beyond a highlight) says three business days. Source disagreement, unresolved.
- eBay transaction defects: a defect is added when a seller cancels for out of stock, or when eBay steps in on a Resolution Center case and the seller is found responsible. Defect rate is the share of transactions with a defect. Automated removal of defects for reasons outside the seller's control can take up to 72 hours before a review can be requested. *observed*, https://www.ebay.com/help/selling/selling-seller-performance/appeal-defect?id=4871 and https://www.ebay.com/help/policies/selling-policies/seller-standards-policy?id=4347 , undated.
- Depop: on a Depop Payments order the seller has 48 hours to respond to a non-delivery issue; with no response Depop refunds the buyer; the buyer can escalate to support. *observed*, Resolution Centre URL above.
- Poshmark: buyer case within 72 hours; Poshmark verifies, sends a return label, refunds. Qualifying reasons are a closed list of five: undisclosed damage, incorrect or missing item, not as described, not authentic, order never shipped or received. *observed*, https://poshmark.com/Posh_protect , undated. The page gives the deadline as 72 hours in one place and 3 days in another; I did not resolve whether they are the same instant.
- Mercari: the transaction auto-completes 72 hours after carrier-confirmed delivery; a return request pauses it. If an item is damaged in a return, the seller must contact Mercari within 24 hours of receipt and before the transaction is cancelled. *observed*, refunds-and-returns URL above.
- Facebook: seller has up to 2 business days to respond, then the buyer files with Meta; Meta refunds from the seller's earnings for not received, not as described, damaged, or unauthorized. *asserted*, fbresellersclub (2026-09-26) and smklog (undated).

## 3. Seller protection and cancellations

| Marketplace | Seller protection conditions | Cancellation and penalties | Source |
|---|---|---|---|
| eBay | Protection against not-received claims and payment disputes needs tracking and, for orders of $750 or more total (item, shipping, tax), signature confirmation. A case may be decided against a party who does not use a tracked service that meets the requirements. | Seller may cancel an unpaid order after 4 calendar days. Seller cancel for "out of stock" counts as a transaction defect. Sellers on eBay's community forum say a wrong cancel reason is monitored (*asserted*, community.ebay.com threads, unopened beyond titles). | *observed*, https://www.ebay.com/help/policies/member-behavior-policies/signature-confirmation-policy?id=5154 , the MBG URL, and the order-cancellation URL above, all undated |
| Facebook | Shipped orders only, paid through Facebook checkout, Meta-issued prepaid label, US, item price $500 or less. A $20 chargeback fee per disputed order; sellers cannot dispute chargebacks. | Order auto-cancels if not handed to the carrier in 7 calendar days (one vendor says 3 days; conflict). Shipped-selling fee is 10% of the order with a $0.80 minimum. | *asserted*, https://www.fbresellersclub.com/blog/does-facebook-marketplace-have-seller-protection (2026-09-26) and https://www.underpriced.app/blog/facebook-marketplace-flipping-guide-2026 . Meta's Seller Protection Policy page not opened. |
| Depop | All must apply: sold with the BUY button, not on the prohibited list, shipped with the Depop label within 5 days of the transaction, lost or damaged in transit, sent to the address on the sales receipt, transaction value under a cap (cap text cut off). | Tracking must be added within 10 days of the sale or the order is cancelled and refunded (another source says 11 days; conflict). From 2026-10-28 the "Other" shipping method is unavailable for new listings. A non-Depop label loses seller protection and the order may auto-cancel and refund. | *observed*, https://depophelp.zendesk.com/hc/en-gb/articles/360001845367-Depop-Protection-for-sellers and https://depophelp.zendesk.com/hc/en-gb/articles/16523051318033-Shipping-on-Depop-US , undated |
| Poshmark | Prepaid label; the buyer must open a case in 72 hours, otherwise payment auto-releases. Offline or trade transactions are not covered. | Buyer cancel window of 3 hours from purchase per the Terms (*asserted*, secondary summary of https://poshmark.com/terms). One source says the buyer may cancel from day 8 if unshipped (*asserted*). No seller-cancel penalty found. | *observed* for coverage exclusions, https://poshmark.com/Posh_protect , undated |
| Mercari | If tracking has not updated in 30 days the seller may cancel and Mercari Shipping Protection pays earnings, up to $200 for Mercari prepaid-label orders or $20 for First Class envelope orders; this cancel does not count toward the cancelation rate. | A seller cancel after purchase may be charged 5% of item price, maximum $25. If a buyer asks to cancel before shipping, the seller still has the full 3-day ship window. | *observed*, https://www.mercari.com/us/help_center/topics/cancelation/guides/cancelations-for-sellers/ and https://www.mercari.com/tos/ , undated |

*inferred*: an item listed on two sites that sells on both is a seller-initiated cancel on one of them. The costs seen are an eBay transaction defect (if the reason is out of stock) and a Mercari fee of up to 5% (max $25). For Poshmark, Depop and Facebook I found no stated seller-cancel penalty.

## 4. Item not as described: listing accuracy and disclosed defects

- eBay: a return is covered when the item does not match the listing; images added to a return request must be relevant and comply with the Images, video and text policy; on strong signs of a counterfeit the buyer must cooperate on disposal and must not resell the item. *observed*, eBay MBG policy URL, undated.
- Depop: "significantly not as described" covers major wear or flaws not detailed in the listing; minor damage on second-hand or vintage items is excluded. *observed*, https://depophelp.zendesk.com/hc/en-gb/articles/360001772468-How-do-I-get-a-refund , undated. Depop's definition page (https://depophelp.zendesk.com/hc/en-gb/articles/360038455993-What-does-Depop-consider-significantly-not-as-described) unopened.
- Poshmark: "undisclosed damage" is a named qualifying reason (section 2). *observed*.
- Mercari: the item must be as described in the listing; 72-hour window. *observed*.
- *inferred*: on every site the claim is judged against the listing text and photos at sale time, so a defect named in the text or shown in a photo is the seller's evidence and an unnamed one is the buyer's. Photos edited or generated to look better than the item can turn a normal listing into a not-as-described case.

## 5. Photos and descriptions: edited, AI-generated, AI-written

- eBay: the Images, videos and text policy (https://www.ebay.com/help/policies/listing-policies/images-text-policy?id=4240, text unopened) is the rule that applies. A secondary 2026 summary says eBay has no published AI disclosure rule and allows AI-edited photos (its own tools offer AI backgrounds), but expects real photos of used, damaged or collectible goods. *asserted*, https://masonry.so/blog/ebay-ai-product-photos-rules , undated.
- Depop: stock-image guidance says to use only photos you took yourself (https://depophelp.zendesk.com/hc/en-gb/articles/360026574274-What-are-stock-images, highlight only). Secondary sources disagree on whether generated images are banned or unaddressed. *asserted*, https://catalogcut.com/blog/ai-model-photos-depop-poshmark-vinted .
- Poshmark, Mercari, Facebook: no official AI-photo or AI-description rule found. Poshmark's terms prohibit items that violate third-party rights (*observed*, https://poshmark.com/terms).
- One secondary source cites an EU transparency rule for synthetic content effective 2026-08-02 and says sources disagree on whether plain product photos are covered. *asserted*; relevance to US sellers not established.

## 6. Counterfeits and authentication

- eBay Authenticity Guarantee: eligible listings show a badge; eligibility is by category and a price floor. One highlight says select shoes "starting at $75"; I did not see the table for watches, jewelry, handbags or trading cards. *observed*, https://www.ebay.com/help/buying/buying-basics/authenticity-guarantee?id=4731 , undated. AG is not covered when the buyer used freight forwarding or mail redirection. *observed*, eBay MBG policy URL.
- Poshmark Posh Authenticate: free, automatic on eligible luxury items at $500 USD / $700 CAD and up; full refund if authenticity cannot be confirmed; Poshmark states brands are not affiliated with the service. *observed*, https://poshmark.com/posh_authenticate and https://poshmark.com/terms , undated.
- Mercari: counterfeit or inauthentic items are a return-related issue. A third-party authentication service is not confirmed here. *asserted*, https://www.purchy.ai/blog/mercari-return-policy-2026 .
- Depop: counterfeit items are covered by Depop Protection (*observed*). Facebook: no authentication programme found.

## 7. Prohibited and restricted items; off-platform deals

- Poshmark prohibits illegal items and items that violate third-party rights such as counterfeits, and incorporates its Prohibited Items Policy (https://poshmark.com/prohibited_items_policy, list unopened). *observed*, terms. Depop's and Mercari's lists were not read. Mercari charges the seller 100% of USPS costs for prohibited Media Mail contents (*observed*, article 169 via fee-data page dated 2026-11-12).
- Off-platform: Poshmark states Posh Protect "does not cover trades or transactions completed off of the Poshmark platform" and the parties bear all risk (*observed*, https://poshmark.com/Posh_protect). Depop Protection needs Depop Payments (*observed*). Facebook Purchase Protection excludes local pickup and Messenger deals (*asserted*). eBay has policies on offers to buy or sell outside eBay and on publishing contact information (https://www.ebay.com/help/policies/payment-policies/offers-buy-sell-outside-ebay-policy?id=4272 and https://www.ebay.com/help/policies/member-behaviour-policies/publishing-contact-information-policy?id=4373); text unopened.

## 8. Local pickup: scams, safe exchange, cash versus in-app

- Fake payment notification: a "buyer" claims a payment through a mobile app, often alleging overpayment and asking for a refund. *asserted*, https://www.securityhero.io/facebook-marketplace-scam/ and https://hard.fyi/scams/facebook-marketplace/ (2026-11-08).
- Overpayment by check: the seller deposits a check for more than the price and sends back the difference. *asserted*, same sources. The FTC page https://consumer.ftc.gov/articles/how-avoid-scam-when-you-sell-online appeared in search and was not opened.
- Verification code (Google Voice): the "buyer" sends a code to the seller's phone and asks it be read back; the code registers a Google Voice number in the seller's name. *asserted*, hard.fyi and https://www.omniwatch.com/blog/facebook-marketplace-scams/ .
- Shipping-label or "post it to me" scam: a buyer who found a local listing asks the seller to ship it. *asserted* by one source only (fbresellersclub, 2026-09-26); no official source found.
- Safe exchange: public place, daylight; many police departments run exchange zones; inspect before paying; cash for local sales; never read back a code. *asserted*, hard.fyi (2026-11-08). Police pages not found.
- Cash versus in-app: a local cash sale has no chargeback and no platform protection. eBay's guarantee reportedly covers local pickup paid through eBay, while Facebook Purchase Protection does not cover pickup (*asserted*, comparison-blog highlight).

## 9. Buyer protection per marketplace and what voids it

| Marketplace | Covers | Voided or excluded | Mark |
|---|---|---|---|
| eBay | Not received, not as described, paid in eBay checkout (sections 1 and 2) | Freight forwarder or mail redirection for AG. Trading cards, bullion, coins, paper money and not-working items are excluded from one covered path (the highlight does not say which). | *observed* |
| Facebook | Not received, damaged, not as described, unauthorized purchase | Local pickup, payment outside checkout, Messenger deals | *asserted* |
| Depop | Lost, damaged, counterfeit, significantly not as described | Smells, minor damage on second-hand items, payment outside Depop Payments | *observed* |
| Poshmark | Never shipped, not matching listing, not authentic | Fit, changed mind, off-platform trades, emailing support instead of opening a case. A secondary source says tapping "accept" on the order is instant and irreversible. | *observed* and *asserted* |
| Mercari | Not as described, reported within 72 hours; 3.6% fee | Rating the order, requests outside Order Status or Rating page, refused or independently returned items | *observed* |

## 10. States and deadlines an app would need (inferred)

*inferred* from sections 1 to 3:
- Order states: paid, awaiting shipment (ship-by clock), shipped with tracking, delivered (starts the buyer claim clock), claim window open, case or return open, return in transit, completed or released, cancelled (by whom), refunded.
- Clocks keyed to carrier events: eBay 3 business days seller response and 3 calendar days buyer-cancel response; Depop 48 hours response and 10 or 11 days to ship; Poshmark 72 hours claim and 5 days return ship; Mercari 72 hours, 168-hour scan, 3-day ship; Facebook 7 calendar days to carrier.
- Per-order facts: payment route (in-platform or not), label source, item price and order total (thresholds seen: Facebook $500, eBay signature $750, Posh Authenticate $500), signature confirmation present, delivery address matches the order, listing text and photos as published at sale time, whether a cross-listed copy is still live.

## 11. Actions that must stay with the person (inferred)

*inferred*: each item is a point where the sources show the action is irreversible, costs money or standing, or is a claim made under the person's name.
- Tapping accept on a Poshmark order; accepting a return, refund or case outcome on any site.
- Cancelling an order (eBay defect, Mercari fee) and choosing the cancel reason.
- Opening, answering or escalating a case (support email does not count on Poshmark and Mercari).
- A buyer rating a Mercari order or confirming receipt (it ends buyer protection).
- Stating condition and disclosed defects; publishing edited or generated photos.
- Anything that sends money, a code or an address: reading back a verification code, refunding an "overpayment", shipping to an address other than the order's.
- Moving a conversation or payment off the platform, which removes protection.

## Searched / could not reach

Tried: Exa searches and highlights for each marketplace's help pages; direct curl to eBay, Depop, Mercari, Facebook and FTC pages (bot wall, 403, 404 or 400), so only highlight text was read. No full page was reached for eBay, Mercari, Depop or Meta.

## Not found

- Official Meta Seller Protection Policy and Purchase Protection page text. Facebook figures are secondary and conflict (7 vs 45 days to file, 3 vs 7 days ship-by).
- Official AI-generated-photo or AI-description rules for Depop, Poshmark, Mercari and Facebook.
- Depop, Mercari and Poshmark prohibited-item lists; Mercari off-platform terms.
- Seller-cancel penalties on Poshmark, Depop and Facebook.
- Depop Protection value cap (text cut off); eBay Authenticity Guarantee full price-floor table.
- FTC page content (unopened), police safe-exchange guidance, an official source for the shipping-label scam.
- Last-updated dates for every official policy page.

## Sources fetched

Highlight text via search, retrieved 2026-11-14, undated unless noted:
- https://www.ebay.com/help/policies/ebay-money-back-guarantee-policy/ebay-money-back-guarantee-policy?id=4210
- https://www.ebay.com/help/policies/member-behavior-policies/order-cancellation-policy?id=5298
- https://www.ebay.com/help/policies/member-behavior-policies/signature-confirmation-policy?id=5154
- https://www.ebay.com/help/selling/selling-seller-performance/appeal-defect?id=4871
- https://www.ebay.com/help/buying/buying-basics/authenticity-guarantee?id=4731
- https://depophelp.zendesk.com/hc/en-gb/articles/360001772468-How-do-I-get-a-refund
- https://depophelp.zendesk.com/hc/en-gb/articles/4417835938577-Resolution-Centre-for-buyers
- https://depophelp.zendesk.com/hc/en-gb/articles/360001845367-Depop-Protection-for-sellers
- https://depophelp.zendesk.com/hc/en-gb/articles/16523051318033-Shipping-on-Depop-US
- https://poshmark.com/Posh_protect
- https://poshmark.com/posh_authenticate
- https://poshmark.com/terms
- https://www.mercari.com/us/help_center/article/235/
- https://www.mercari.com/us/help_center/topics/returns/policies/refunds-and-returns/
- https://www.mercari.com/us/help_center/topics/cancelation/guides/cancelations-for-sellers/
- Secondary: https://www.fbresellersclub.com/blog/does-facebook-marketplace-have-seller-protection (2026-09-26); https://hard.fyi/scams/facebook-marketplace/ (2026-11-08); https://smklog.com/lp/facebook-marketplace-shipping-protection; https://www.securityhero.io/facebook-marketplace-scam/; https://www.omniwatch.com/blog/facebook-marketplace-scams/; https://masonry.so/blog/ebay-ai-product-photos-rules; https://catalogcut.com/blog/ai-model-photos-depop-poshmark-vinted; https://www.purchy.ai/blog/mercari-return-policy-2026; https://www.underpriced.app/blog/facebook-marketplace-flipping-guide-2026
- Repo files read: research/cross-cutting/ben/missing-features.md, research/messages/ben/messages-and-offers.md
