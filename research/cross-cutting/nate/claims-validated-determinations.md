# Which outside-world claims in spec/determinations and docs/how-it-works are true, outdated, unsupported or unreachable?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: cross-cutting.

Scope note: the brief says nine determinations files; the folder holds eight (money, listing-and-marketing, capture-shots, fields-by-kind, seeing-the-item, market-insight, managing-and-buyers, asking-and-intent). docs/how-it-works has ten pages plus README; only how-we-compare.md was read claim by claim. This is a partial pass: claims not listed below were not checked (see Not found).

## Counts

| Verdict | Count |
|---|---|
| TRUE | 21 |
| FALSE | 1 |
| OUTDATED | 0 |
| UNSUPPORTED (mis-cited or not backed by the source) | 2 |
| NOT REACHABLE / not checked | see Not found |

## Wrong or unbacked claims

| File and line | Claim as written | What the source says | Corrected sentence | Method depends on it? |
|---|---|---|---|---|
| spec/determinations/fields-by-kind.md:13-14 | Shopify taxonomy: 26 vertical files, 14,606 categories, 8,240 attributes, 74,820 values; T-Shirt has 22 attributes (*asserted*) | Release v2026-11 (published 2026-11-13) assets categories.en.json.gz and attributes.en.json.gz, plus data/attributes.yml and data/values.yml in https://github.com/Shopify/product-taxonomy (*observed*): 26 verticals, 64,292 category entries summed over the per-vertical JSON, 12,333 attributes, 127,383 values; T-Shirts (aa-1-13-8) carries 24 attributes. My own YAML category loop gave an inconsistent 3,860, so the category count carries a counting-method caveat. | "Shopify's taxonomy (release v2026-11) has 26 verticals, 12,333 attributes and 127,383 values; T-Shirts carries 24 attributes." | No for the counts. The spine choice rests on the structure, which matches. Check the fields-by-kind card that quotes the totals before reuse. |
| spec/determinations/market-insight.md:702 | A ranking set by payments is deceptive even with a disclosure, citing 16 CFR 255.0(f), 255.1 Example 3, 255.5 (*asserted*) | https://www.law.cornell.edu/cfr/text/16/255.1 (*observed*): Example 3 is a dermatologist who is a paid advisor endorsing an acne product with flawed study evidence; it says nothing about rankings. 255.0(f) (clear and conspicuous, "unavoidable" online) and 255.5 (disclose material connections) do support the disclosure half. No text in Part 255 as fetched says a payment-ordered ranking is deceptive despite a disclosure. | "Part 255.5 requires a clear and conspicuous disclosure of a material connection; 255.0(f) defines clear and conspicuous." Drop Example 3 and the 'deceptive even with a disclosure' clause, or cite a different source. | Yes, the card that sets 'ranking is never sold or paid' in market-insight.md near line 702 (name not rechecked). The no-paid-ranking rule is our own design and stands; only the legal basis is unbacked. |
| spec/determinations/listing-and-marketing.md:186 | Depop 1,000 characters (*observed*) | Depop's own help pages https://depophelp.zendesk.com/hc/en-gb/articles/360032716413-How-to-list-an-item and https://depophelp.zendesk.com/hc/en-gb/articles/360020435158-Tips-for-describing-your-item (*observed*) give four photos and one video in the app, eight photos on the web, five hashtags, and no description length. One secondary guide (sellura.io, 2026-11-03) says Depop publishes no limit. | "Depop allows five hashtags and publishes no description length; 1,000 characters is a working budget, not a stated limit." | Yes if a limit check in the listing-fields card enforces 1,000 as a hard limit. Treat as a soft budget. |

## TRUE claims checked

- eBay general fee 13.6% to $7,500, then 2.35%, plus $0.30 at $10 or less or $0.40 above (money.md ~298-315): https://www.ebay.com/help/selling/fees-credits-invoices/selling-fees?id=4822 (*observed*). Caveat: category rates differ (books and media 15.3%, women's handbags 15% up to $2,000, jewelry and watches 15%, some collectibles 13.25%); the fee base includes shipping, handling and sales tax.
- Depop: no selling fee in UK, US, AUS; US processing 3.3% + $0.45 on item + shipping + taxes: https://depophelp.zendesk.com/hc/en-gb/articles/360001791127-Seller-fees-and-charges (*observed*). Boosting 12% on new listings from 2026-03-23.
- Poshmark $2.95 under $15, else 20%, on item price: https://poshmark.com/posh_guide/get_started_on_poshmark (*observed*).
- Poshmark buyer label $6.49 (money.md:279): secondary only (fee-math.com 2026-10-22, tallyvane.com 2026-11-05); primary page not opened, so *asserted*.
- Mercari 10% on item + buyer-paid shipping: https://www.mercari.com/us/help_center/article/169/ (updated 2026-10-23, *observed* via search extract).
- Facebook shipped 10%, $0.80 minimum: secondary only (sellerfeedesk.com 2026-10-06, numford.com, sellingfeetools.com); Meta page unopened. Sources word the minimum two ways (per order, per item). *Asserted*, as the doc marks it.
- Worked example (money.md): $20 shirt, $6 shipping, keeps $16.06 on eBay and $18.69 on Depop. Arithmetic checked: eBay 26 x 13.6% = 3.536 + 0.40, 26 - 3.936 - 6 = 16.06; Depop 26 x 3.3% = 0.858 + 0.45, 26 - 1.308 - 6 = 18.69. Sales tax excluded. (*inferred* from the fee pages above.)
- USPS Ground Advantage 70 lb and 130 in length plus girth (money.md:280): https://www.usps.com/ship/ground-advantage.htm and https://faq.usps.com/articles/Knowledge/Parcel-Size-Weight-Fee-Standards/ (*observed*).
- 1099-K (money.md:675, which defers the figure to irs.gov): the platform threshold is more than $20,000 and more than 200 transactions (reinstated retroactively by the 2025 tax law): https://www.irs.gov/businesses/understanding-your-form-1099-k and https://www.irs.gov/newsroom/form-1099-k-faqs-general-information (*observed*). The doc states no figure, so it is not wrong; the "to be confirmed" note can now be closed.
- Country of origin label at the inside centre of the neck (capture-shots.md:21): 16 CFR 303.15(b), https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-303/section-303.15 (*observed*). The doc cites "16 CFR 303"; the section is 303.15(b).
- 16 CFR 255.0(f) and 255.5 support the disclosure wording: https://www.law.cornell.edu/cfr/text/16/255.1 and sibling pages (*observed*).
- eBay titles up to 80 characters; first ~60 always visible: https://community.ebay.com/forum/announcements-57928/topic/list-smarter-sell-more-this-holiday-season-8587/ (2025-11-12, *observed*) and https://www.ebay.com/sellercenter/listings/create-listings (*observed*).
- eBay "at least 7 attributes perform over 2x better than those with 1" (listing-and-marketing.md:229): same 2025-11-12 announcement (*observed*). Same page: better item specifics "up to 4x more traffic".
- Depop five hashtags: https://depophelp.zendesk.com/hc/en-gb/articles/360032716413-How-to-list-an-item (*observed*). Depop has no title field (description's first line does the job, per the Tips page).
- Patents exist with these titles (Google Patents, all 200): US9672554B2 (score for ordering item listings), US9412127B2 (assessing quality of an item listing), US8370336B2 (demand metrics for ordering listings), US8977629B2 (image-based popularity prediction) (*observed*). What each patent says in listing-and-marketing.md:371-374 was not checked line by line.
- Tise Number of Images coefficient 0.049 (listing-and-marketing.md:280): the paper's table column 1 (*observed*); other columns run 0.039 to 0.070, with 0.070 for sweaters and 0.052 for pants in the abstract. Per-category caveat applies.
- Hu, Dowd, Bouchard 2022: Best Offer raised sale probability 3.17% (abstract, *observed*).
- Shopify condition attribute ids 2360, 2680, 1857, 8587 (fields-by-kind.md) match attributes.en.json (*observed*).
- arXiv papers cited in the docs: 13 ids matched to titles and headline figures (2504.16331, 2607.01530, 2404.10774, 1811.10648 and nine others, *observed*). Caveat: the "65% to 27%" figure is real but is code-generation pass@1 for the Okanagan system, so quoting it for another domain needs the domain stated.

## Not found

- Not opened at primary, so left unverified: Einav 0.75 (listing-and-marketing.md:318); Facebook Meta fee page; Poshmark $6.49 label page; patent content claims (371-374); conformal "singleton sets" claim.
- Not checked: Depop 5% to 95% offer range (572) and news.depop.com 2024-01-09 Sundays and Mondays (459); minimum discounts Poshmark 10%, eBay 5%, Mercari 10% (532); Poshmark 80 to 90% (516); Poshmark share policy and Vendoo 33% (729, 738); Mercari/Poshmark/Facebook 80/80/99 title limits (156, only eBay checked); eBay one video and Etsy 3 to 15 s (capture-shots.md:328); 95% within 5 cm versus 60% (327); LiDAR plus or minus 1 cm (355); Apple Object Capture (168, the doc quotes Apple's input guidance; Apple page not opened); Kowaleczko 4.10 to 4.20% and Kim 1.59 to 2.08% (seeing-the-item.md:308); UniDepthV2 ARel 6.8% and MoGe-2 Rel 15.7 (312); DeepFashion2 landmark AP 0.563 (325); recall law (636); Duke StockX 65 to 70% (market-insight.md:752); cert number at most 30 characters and Google taxonomy 5,595 (fields-by-kind.md:19, 112); Pinterest Predicts 80%; cache lifetimes.
- Not checked: every rival figure in docs/how-it-works/how-we-compare.md (Vendoo 10-minute poll, Nifty $39.99, Meta AI on Marketplace 2026-03-12, eBay buy-for-me agent bar 2026-02-20, Rufus 60%, Phia 350M items and $35M, Encore $3, Card Ladder 100M+, eBay Price Guide 24 hours, WatchCharts $39, Shopify Catalog 1B+, Google blog 2026-05-19, Shopify 200+ reports, Poshmark analytics 2026-04-06, Depop dashboard 2025-06-25, treg.to 4,100 endpoints and 127 providers, 28.2% of 100 scenarios, Muse incident, eBay API sold filter dropped 2026-09-28) and the other nine docs pages.
- Blocked: the eBay fee page is JavaScript-rendered via curl (read through an Exa fetch instead); eCFR versioner API returned 406 (Cornell LII used); Poshmark support, Mercari and Facebook help pages gave crawl errors, so those fees rest on search extracts from the primary domain or secondary sites.

## Sources fetched

- https://www.ebay.com/help/selling/fees-credits-invoices/selling-fees?id=4822
- https://community.ebay.com/forum/announcements-57928/topic/list-smarter-sell-more-this-holiday-season-8587/
- https://www.ebay.com/sellercenter/listings/create-listings
- https://depophelp.zendesk.com/hc/en-gb/articles/360001791127-Seller-fees-and-charges
- https://depophelp.zendesk.com/hc/en-gb/articles/360032716413-How-to-list-an-item
- https://depophelp.zendesk.com/hc/en-gb/articles/360020435158-Tips-for-describing-your-item
- https://poshmark.com/posh_guide/get_started_on_poshmark
- https://www.mercari.com/us/help_center/article/169/
- https://www.usps.com/ship/ground-advantage.htm
- https://faq.usps.com/articles/Knowledge/Parcel-Size-Weight-Fee-Standards/
- https://www.irs.gov/businesses/understanding-your-form-1099-k
- https://www.irs.gov/newsroom/form-1099-k-faqs-general-information
- https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-303/section-303.15
- https://www.law.cornell.edu/cfr/text/16/255.1
- https://github.com/Shopify/product-taxonomy (release v2026-11 assets)
- Google Patents pages for US9672554B2, US9412127B2, US8370336B2, US8977629B2
- arXiv: 2504.16331, 2607.01530, 2404.10774, 1811.10648 and nine more
- Tise and Hu, Dowd, Bouchard papers (full text)
- Secondary only: fee-math.com, tallyvane.com, payoutprism.com, sellerfeedesk.com, numford.com, sellingfeetools.com, sellura.io
