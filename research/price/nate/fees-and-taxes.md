# What does a US casual seller keep and owe on eBay, Facebook Marketplace, Depop, Poshmark and Mercari, as of November 2026?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: price.

Extends [valuation-engine.md](../ben/valuation-engine.md) (line 57 "Net per channel after fees and shipping" has no numbers; lines 101-110 `by_channel[{... net ...}]` need them) and [pricing-in-context.md](../ben/pricing-in-context.md) (no fee numbers). Confirms and extends [pitch-evidence.md](../../cross-cutting/ben/pitch-evidence.md) lines 25-27 and 32 (see "Against the Ben notes" below).

Marks: *observed* = I opened the page and it says so (URL, date given when the page has one); *asserted* = secondary source or source without method; *inferred* = my arithmetic or reasoning.

## 1. Fee table per marketplace

### eBay (US)
| Item | Value | Mark, source |
|---|---|---|
| Final value fee, most categories | 13.6% of total sale amount up to $7,500, then 2.35% above $7,500 | *observed*, [eBay selling fees](https://www.ebay.com/help/selling/fees-credits-invoices/selling-fees?id=4822), fetched 2026-11-14 (footer 2026) |
| Fee base | item + shipping + sales tax + handling | *observed*, same page |
| Per-order fee | $0.30 if order is $10.00 or less, $0.40 above. Bundles payment processing; the API shows no separate processing fee | *observed*, same page |
| Listing (insertion) fees | 250 free per month, then $0.35 each | *observed*, same page |
| Other categories | books, movies, music 15.3%; coins and paper money 13.25%; women's handbags 15% to $2,000 and 9% above | *asserted* (search snippet of the Spanish page; full table is on the page above, not re-read per category) |
| Promoted Listings General | ad rate 2% to 100% of the total sale amount incl. shipping and tax, charged only when a sale follows a click within 30 days | *observed* via search highlight, undated, [eBay help](https://www.ebay.com/help/selling/listings/listing-tips/promoted-listings?id=4164); API bidPercentage 1% to 100%, [dev docs](https://developer.ebay.com/api-docs/sell/static/marketing/promoted-listings.html) |
| Buyer-side fee | none found | not-found |
| Payout | fees deducted from proceeds; payout to checking account or debit card, on demand or daily/weekly/biweekly/monthly; funds available 1 to 2 business days after payment, credited 1 to 3 business days; monthly statements free | *observed*, [fees charged](https://www.ebay.com/help/selling/fees-credits-invoices/fees-selling-costs-charged?id=5297) and [Payments Terms of Use, effective 2026-10-14 new sellers, 2026-10-28 all](https://ir.ebaystatic.com/cr/v/c01/us-payments-terms-of-use-2026-10-14.pdf) |
| Instant payout fee | not found | not-found |
| Shipping label model | not found (pages id=4825, id=4132 timed out) | not-found |
| Local pickup | not found; the fee model above is for shipped orders | not-found |

### Mercari (US)
| Item | Value | Mark, source |
|---|---|---|
| Listing | free | *observed*, [Fees on Mercari](https://www.mercari.com/us/help_center/article/169/), fetched 2026-11-14; page undated, shipping table says "Effective 10/19/2026" |
| Selling fee | 10% of item price + buyer-paid shipping (since 2025-01-06) | *observed*, same page |
| Payment processing | no separate fee on new listings | *observed*, same page |
| Buyer fee | Buyer Protection 3.6% of item + buyer-paid shipping, paid by the buyer | *observed*, same page |
| Direct deposit | free, once per day, about 5 business days; $2 for a failed deposit | *observed*, same page |
| Instant Pay | $3 flat per cash-out, up to $600 per month, once per day, Visa or Mastercard debit | *observed*, [getting paid](https://www.mercari.com/us/help_center/topics/payouts/guides/getting-paid/) |
| Prepaid labels (from 10/19/2026) | USPS Ground Advantage 1 lb $7.99, 2 lb $13.09, 5 lb $15.99; UPS Ground 1 lb $9.79 | *observed*, Fees page |
| Not shippable nationally | furniture, bicycles, appliances, motorized items | *observed*, Fees page |
| Local pickup fees | not found | not-found |

### Depop (US)
| Item | Value | Mark, source |
|---|---|---|
| Selling fee | none in US, UK, Australia | *observed*, [Depop seller fees](https://www.depop.com/help/seller-fees-and-charges/) via Exa fetch, undated (contains "new listings from 23 March 2026") |
| Payment processing (Stripe) | 3.3% + $0.45 on item + shipping + applicable taxes | *observed*, same page |
| Boosting fee | 12% (US and UK) on new listings from 23 March 2026; base is item price excluding taxes, plus shipping if no Depop label | *observed*, same page |
| Refunds | all fees reverse | *observed*, same page |
| Buyer marketplace fee | up to 5% + $1 | *observed*, [Depop newsroom, 2024-07-15](https://news.depop.com/depop-removes-selling-fees-in-the-united-states-evolves-fee-structure/) |
| Payout and instant-transfer fees | not found | not-found |
| Conflict | the Partner API fees page says "Sellers will have to pay a transaction fee, and boosting fee when applicable" and points to the Help Centre; this reads as UK-oriented or stale against the US 0% selling fee | *observed* ([partnerapi.depop.com concepts/fees](https://partnerapi.depop.com/api-docs/concepts/fees/)); reading is *inferred* |

### Poshmark (US)
| Item | Value | Mark, source |
|---|---|---|
| Commission | under $15: flat $2.95; $15 or more: 20% (seller keeps 80%) | *observed*, [Poshmark support 297755057](https://support.poshmark.com/s/article/297755057?language=en_US) via Exa fetch, undated; same in article [398203111](https://support.poshmark.com/s/article/398203111?language=en_US) |
| Fee base | final order price excluding shipping and tax (Fee Policy v1.7, effective 2024-11-25) | *asserted* (quoted by sellerfeedesk.com, 2026-10-05) |
| Listing fee | none found | not-found |
| Buyer shipping | flat $6.49 USPS Ground Advantage label up to 5 lb since 2025-09-12 (was $8.27) | *observed*, [Poshmark blog 2025-09-08](https://blog.poshmark.com/2025/09/08/lower-shipping-starting-september-12th/) |
| Heavier items | seller pays upgrade $5.00 (5.1 to 10 lb) and $10.00 (10.1 to 15 lb), from 2026-02-13 | *observed*, [Poshmark blog 2026-02-13](https://blog.poshmark.com/2026/02/13/shipping-heavier-items-on-poshmark-is-now-simpler-and-cheaper/) |
| Priority Mail packaging | $5 USPS fee since 2025-10-12 | *observed*, Poshmark blog (as read earlier; page not re-fetched) |
| Seller shipping discounts | come out of seller earnings | *asserted* |
| Texas | from 2025-10-01 a "Texas Seller Fee Tax" deduction appears | *observed*, Poshmark support page above |
| Instant Transfer | $2 per payout | *asserted* (sellerfeedesk.com) |
| Buyer holiday promotion | buyers charged $0.99 from 2026-11-03; seller fees and shipping unaffected | *asserted* ([valueaddedresource.net, 2026-11-04](https://www.valueaddedresource.net/)); homepage link only, article URL unopened |

### Facebook Marketplace (US)
The official fee text could not be opened (checkout terms not fetchable). Everything below the first row is *asserted*.
| Item | Value | Mark, source |
|---|---|---|
| Official help | does not state the fee; says "we don't handle taxes for local pickup"; payouts held if sales reach a limit without a tax ID; 7 calendar days to ship | *observed*, [Facebook help 449101635835192](https://www.facebook.com/help/449101635835192) |
| Shipped checkout orders | 10% selling fee, $0.80 minimum; base item + shipping + applicable taxes | *asserted*: sellerfeedesk.com (2026-10-06), sellingfeetools.com (2026-11-02), underpriced.app (2026-04-16), sellersfees.com CSV (checked 2026-11-12) |
| Local pickup | no selling fee, no Purchase Protection | *asserted*, same sources |
| Payout timing | starts 15 days after marked shipped or 5 days after delivery confirmed, up to 20 days | *asserted* |
| Chargeback | $20 each | *asserted* |
| Older rate | 5% with $0.40 minimum until 2024-04-15 | *asserted* (valueaddedresource.net, 2024-03-24) |
| Labels | offered to select sellers (UPS, USPS) | *asserted* |

## 2. Worked examples

Assumptions (*inferred*): no sales tax in the price; the buyer pays shipping and the seller buys a label that costs the same, so shipping passes through and only the fee on it matters; shipping is $6 for the shirt and $10 for the jacket; no promotion, no boost; payout fees ignored; fee on shipping follows the base rules in section 1. "Keep" = item price minus marketplace fees, before cost basis.

| | eBay | Mercari | Poshmark | Depop | Facebook shipped | Facebook local |
|---|---|---|---|---|---|---|
| **$20 shirt, $6 ship.** Formula | 13.6% x 26 + 0.40 | 10% x 26 | 20% x 20 | 3.3% x 26 + 0.45 | max(10% x 26, 0.80) | 0 |
| Fee | $3.94 | $2.60 | $4.00 | $1.31 | $2.60 | $0 |
| Keep | $16.06 | $17.40 | $16.00 | $18.69 | $17.40 | $20.00 |
| **$150 jacket, $10 ship.** Fee | 13.6% x 160 + 0.40 = $22.16 | 10% x 160 = $16.00 | 20% x 150 = $30.00 | 3.3% x 160 + 0.45 = $5.73 | $16.00 | $0 |
| Keep | $127.84 | $134.00 | $120.00 | $144.27 | $134.00 | $150.00 |
| **$600 sofa, local pickup** | no local model found (if shipped, fee on $600 alone would be $82.00) | not allowed (furniture is not shippable) | not stated; the label tops out at 15 lb (*inferred*: sofa does not fit) | not stated; formula on $600 alone would be $20.25 | n/a | $0 fee, keep $600.00 |

Mercari note: the buyer separately pays 3.6% Buyer Protection ($0.94 on $26; $5.76 on $160), so the buyer's price is higher than the seller's list (*inferred* from the fee text). Poshmark note: the buyer's $6.49 label is outside the seller's fee base, and the label for the shirt would be $6.49 not $6.

## 3. Against the Ben notes
- [pitch-evidence.md](../../cross-cutting/ben/pitch-evidence.md) line 25 (eBay 13.6% + $0.30/$0.40): confirmed, *observed* on the same page. Line 26 (Depop 0%, buyer up to 5% + $1): confirmed.
- Line 27 (Poshmark $2.95 under $15 / 20%, Mercari 10%): now *observed* on official pages. Facebook 0% local, 10% shipped: still *asserted* only.
- Line 32 ($20 shirt: eBay $16.88, Depop about $18.90): extends. $16.88 holds only with no shipping in the base ($20 - $2.72 - $0.40). eBay charges 13.6% on shipping too, so with $6 buyer-paid shipping the keep is $16.06. Depop's $18.90 matches processing on $20 alone (3.3% x 20 + 0.45 = $1.11, keep $18.89); with $6 shipping in the base it is $18.69. The Depop processing rate (3.3% + $0.45) is now *observed*, no longer asserted.
- [valuation-engine.md](../ben/valuation-engine.md) line 57 and API line 105 `net`: the fee base differs per site (eBay item+shipping+tax; Depop item+shipping+tax for processing; Facebook item+shipping+tax; Mercari item+buyer shipping; Poshmark item only), so `net` needs shipping and tax as inputs, not only the price.

## 4. Taxes (US federal)

### 1099-K
- For tax year 2026, third-party settlement organisations must report when total gross payments for goods or services exceed $20,000 and there are more than 200 transactions for a payee. *observed*, IRS [Form 1099-K FAQs](https://www.irs.gov/newsroom/form-1099-k-faqs) (page updated 2026-04-03; Q1 and Q5 updated 2025-10-23; exact URL path as fetched in the earlier pass, text on disk in the scratchpad).
- Not meeting the threshold does not stop a form arriving: Q5 says "Not necessarily" (the federal threshold is not the only way a form is issued) and the same FAQ says a state may have a lower threshold. *observed*, same page.
- History: $20,000 and 200 transactions for 2023; $5,000 for 2024 under IRS Notice 2024-85 *observed* earlier; the American Rescue Plan $600 threshold never took effect and was superseded for 2025 onward by the 2025 tax law (OBBB, Public Law 119-21, section 70432, signed 2025-07-04, retroactive) *asserted for the section number, observed for the effect via the IRS FAQ*. A 2025 table at Credit Karma shows $20,000 and 200 *asserted*.
- A 1099-K is not required for tax to be owed on a gain. *observed* (IRS FAQ; TurboTax agrees, *asserted*).
- Platform handling: Poshmark's 1099-K reportedly counts gross sales including fees, refunds and cancelled orders (resellerindex.com, *asserted*). Mercari's Gross Sales Report helps track 1099-K status *observed* ([article 541](https://www.mercari.com/us/help_center/article/541/)).
- 1099-MISC base threshold rises to $2,000 for payments after 2025, indexed from 2027 (Pub 1099, quoted via secondary sources, *asserted*). That is a different form from the 1099-K.

### Gain, loss and basis on personal items
- A personal-use item sold at a loss: the loss is not deductible. A gain is taxable. *observed*, IRS [Publication 525 (2025)](https://www.irs.gov/publications/p525).
- Cost basis (what you paid, with adjustments) is how a gain is computed. *observed*, IRS Publication 551 (12/2025; not re-opened this pass, cited from the first pass).
- Items bought to resell are inventory of a business, a different treatment (*inferred*; I did not open an IRS page on the casual-versus-business line, see Not found).

### Sales tax
- Marketplace facilitator laws: Streamlined Sales Tax chart says many states require the facilitator to collect and remit above a threshold, most at $100,000, Texas at $500,000, some with a 200-transaction test (some since removed). *observed*, [SSTGB marketplace facilitator page](https://www.streamlinedsalestax.org/for-businesses/marketplace-facilitator), undated, entries updated 2026-11-02 for Nevada and Rhode Island. It carries "This is general guidance and is not legal advice".
- All states with a statewide sales tax have such laws. *asserted* ([NCSL white paper 2023](https://documents.ncsl.org/wwwncsl/State-Federal/NCSL-SALT-Remote-Work-Considerations-White-Paper-2023-v2.pdf), opened earlier; states may have changed).
- Mercari collects sales tax from buyers and remits it as facilitator, shown in the Gross Sales Report. *observed* (article 541). eBay's fee base includes sales tax *observed*; Depop's processing base includes applicable taxes *observed*; Poshmark credits the seller the price excluding taxes *asserted*.
- Facebook: no tax handling for local pickup, *observed* (Facebook help above). A cash sale of an item is outside every marketplace's collection and reporting (*inferred*).
- eBay's seller collected tax column exists in the Seller Hub Transaction report *asserted* (sellerfeedesk.com, read 2026-10-28).

### State 1099-K thresholds (conflicting sources)
All *asserted* (not opened at the state primary source this pass, except where noted); Mass.gov returned 403.
- $600: Massachusetts (830 CMR 62C.8.1), Virginia (Tax Bulletin 20-10; Virginia official page opened earlier, *observed*), DC, Montana.
- Vermont: $2,000 on the state page per a 2026-11-13 check; it was $600 under Act 73 of 2017; Stripe and Wave (2026-10-09) tables still show $600.
- Maryland: statute ties to IRC 6041(a), so $2,000 after 2025 per one check; Stripe and Wave tables still show $600.
- Illinois: more than $1,000 and 4 or more transactions (Pub 110). Arkansas $2,500. New Jersey $1,000 (platform pages only). Rhode Island $100 from tax year 2025 (Brillay 2026-09-08, ADV 2026-05).
- Sources disagree for Maryland and Vermont, so the table is not settled. Stripe's list: [docs.stripe.com/connect/1099-k](https://docs.stripe.com/connect/1099-k).

## 5. Do the marketplaces expose fees and payouts programmatically?
| Marketplace | Fees and payouts | Mark, source |
|---|---|---|
| eBay | Sell Finances API: payouts, transactions, fees; seller's own data only; no Team Access; charges for labels paid by PayPal unsupported. `GET https://apiz.ebay.com/sell/finances/v1/transaction` (getTransactions), date range defaults to 90 days, limit default 20. FeeTypeEnum values: FINAL_VALUE_FEE, FINAL_VALUE_FEE_FIXED_PER_ORDER, AD_FEE, PAYMENT_PROCESSING_FEE. Data appears with a lag; Notification API suggested | *observed*, [finances landing](https://developer.ebay.com/api-docs/sell/static/finances/finances-landing.html), [transaction-info](https://developer.ebay.com/api-docs/sell/static/finances/transaction-info.html), [FeeTypeEnum](https://developers.ebay.com/api-docs/sell/finances/types/api:FeeTypeEnum) |
| eBay export | Seller Hub Payments > Reports Transaction report has Final value fee, Other fees, Shipping label, Seller collected tax columns | *asserted* (sellerfeedesk.com) |
| Depop | Private Partner Selling API (contact Depop, no public access). Orders carry `buyer_pays_amount`, `seller_receives_amount`, `buyer_shipping_price`, `seller_fee_breakdown[{fee_type: PAYMENT_FEE or DEPOP_FEE, amount, currency}]`; scopes products_read, orders_read; webhooks | *observed* via Exa, [partnerapi.depop.com](https://partnerapi.depop.com/api-docs/) |
| Depop export | CSV from the website, Selling Hub > Stats > Download sales, up to 3 months at a time, desktop only; has Depop Payment, Buyer Marketplace, Selling and Boosting fees, shipping and taxes | *observed* via Exa, [Depop help](https://depophelp.zendesk.com/hc/en-gb/articles/360039263713-How-to-use-your-sales-download) |
| Mercari | No public listing API *asserted* (selldeck.io). Gross Sales Report on the web, 21 fields incl. Item Price, Buyer Shipping Fee, Seller Shipping Fee, Mercari Selling Fee, Payment Processing Fee, Shipping Adjustment Fee, Net Seller Proceeds, Sales Tax Charged to Buyer, Buyer Protection Charged to Buyer. No item cost, no tracking field, no file format stated | *observed* via Exa, [article 541](https://www.mercari.com/us/help_center/article/541/) |
| Poshmark | No public API *asserted* (selldeck.io). Sales Report CSV emailed from Order Activity or Seller Tools; columns Order Price, Seller Shipping Discount, Net Earnings, Texas Seller Fee Tax; no fee column | *asserted* (sellerfeedesk.com analyzer page, read 2026-10-28) |
| Facebook | no API or export found for fees or payouts | not-found |

## 6. Ledger fields and what an app may say about taxes

Everything in this section is *inferred*.

**"You keep" before listing** (one row per candidate channel):
channel; category (fee tiers differ, e.g. eBay books 15.3%); item price; buyer-paid shipping; seller-paid shipping or label cost; assumed sales tax (0 if none); fee-base rule used; selling fee (percent or flat, with the Poshmark under-$15 and Facebook $0.80 minimum branches); per-order fixed fee; payment processing fee; boost or promoted rate (eBay ad rate 2% to 100%, Depop 12%); buyer-side fee (shown, not deducted); payout method and payout fee (Mercari $3 Instant Pay, Poshmark $2 Instant Transfer); local-pickup flag; cost basis if known; estimated net; fee table version and source date (these change; Mercari shipping is dated 10/19/2026).

**"You kept" after sale** (from the API or export in section 5):
channel; order id; sold_at; item price; shipping charged and shipping paid; sales tax collected and who remitted it; each fee by type (eBay FeeTypeEnum, Depop `seller_fee_breakdown`, Mercari Gross Sales Report fee columns); refunds and fee reversals; chargeback fee; shipping adjustment; net proceeds reported; payout id, date and payout fee; cost basis and how it was entered; gain or loss; 1099-K received flag; gross amount counted on the 1099-K if the form arrived; source of each row (API, CSV, user typed) and an estimate-versus-actual difference.

**What an app may honestly say about taxes** (facts above, no advice):
- A US federal 1099-K is issued for 2026 over $20,000 and more than 200 transactions, and may still arrive below that; some states set lower numbers and sources disagree on which. Cite the IRS FAQ and its date.
- A sale of a personal item at a gain is taxable and at a loss is not deductible, whether or not a form arrives (Pub 525).
- Cost basis records reduce a gain (Pub 551).
- A marketplace may collect and remit sales tax from the buyer; the app can show what the platform reported. It cannot say what tax the seller owes.
- The app can show fees, proceeds, basis and a gain or loss figure labelled as a record, and offer a CSV export. It should not say a sale is or is not taxable for this user, whether they are a business, or what to file; those depend on facts it does not have (*inferred*).

## Not found
- Facebook official fee text, local-pickup and payout rules; any Facebook API or export.
- eBay: shipping label pricing, local pickup, instant payout fee, sales tax collection policy page, buyer-side fee, per-category table re-read from the page.
- Depop: payout and instant-transfer fees from an official page.
- Poshmark: official payout fee page and official fee base text (only a secondary quote); listing fees.
- Mercari: local pickup fees.
- State 1099-K thresholds from state primary sources (Mass.gov 403; Maryland page 404).
- IRS page on hobby versus business for casual resellers; the 1099-K history for 2025 read from a primary IRS page this pass.

## Sources fetched
- eBay selling fees (id=4822), fees charged (id=5297), Payments Terms of Use 2026-10-14, Promoted Listings (highlight only), eBay Finances API pages (landing, transaction-info, FeeTypeEnum).
- Mercari help articles 169, 541, and getting-paid page.
- Depop seller fees page, Depop newsroom 2024-07-15, partnerapi.depop.com (api-docs, concepts/fees), Depop sales download help.
- Poshmark support articles 297755057 and 398203111; Poshmark blog 2025-09-08 and 2026-02-13.
- Facebook help 449101635835192.
- IRS Form 1099-K FAQs, Notice 2024-85, Publication 525, Publication 551 (first pass), Pub 1099 (via secondary).
- Streamlined Sales Tax marketplace facilitator page, NCSL white paper.
- Secondary: sellerfeedesk.com, sellingfeetools.com, underpriced.app, sellersfees.com, selldeck.io, resellerindex.com, valueaddedresource.net, Stripe 1099-K docs, Wave, Brillay, Credit Karma, TurboTax.

## Searched / could not reach
Reached through the Exa fetch tool: Depop and Poshmark support pages. Blocked or failed: facebook.com/legal/checkout_terms, Mass.gov (403), eBay help pages id=4825 and id=4132 (timeout), a Maryland comptroller page (404), a Poshmark certificate error on direct fetch. Fees change monthly; every figure here is dated by its page, and several pages carry no date.
