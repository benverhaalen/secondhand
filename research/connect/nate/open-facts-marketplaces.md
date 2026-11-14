# Which marketplace facts were still unknown or in conflict, and what do the sources say?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: connect.

Scope: fifteen open facts or conflicts taken from the Not found and conflict notes in `platform-access.md`, `trust-returns-disputes.md` and `shipping-and-pickup.md` (same research tree), each tried at the primary source. Marks: *observed* = I opened the source and it says so; *asserted* = a secondary source says it and I did not see the primary; *inferred* = my reasoning; *not-found*. Facebook's own help and policy pages could not be opened by any instrument, so every Facebook row is *asserted* at best. Page dates are given where the page showed one; otherwise the fetch date 2026-11-14 is the date of observation.

| # | Fact | Why it matters | Answer | Mark | URL and date |
|---|------|----------------|--------|------|--------------|
| 1 | Date eBay's agent / automated-means rule took effect (conflict: 2026-02-20 vs 2026-06-28) | Decides whether connect may act as an agent for a seller | Both dates are real and name different amendments. The live User Agreement says the current version is effective June 28, 2026 for users who agreed to a prior version, and that the previous amendment was effective for all users on February 20, 2026. The Section 3 clause (automated means, buy-for-me agents, LLM-driven bots) is on the live page. Whether that clause was already in the 20 Feb text is not confirmed (the March 2026 Wayback snapshot returned 429). Notes citing 2026-02-20 (`cross-cutting/ben/pitch-evidence.md:52`, `list/ben/crosspost-and-delist.md:38`, `messages/nate/handled-by-default.md:14`) describe the earlier amendment. | observed (dates); clause-in-Feb text: not-found | eBay User Agreement page, via Exa fetch, 2026-11-14 (URL not retained in this note; see Not found) |
| 2 | eBay API default call limits | Sizes sync and polling | Default per day: Account 25,000; Analytics customer_service_metric 400, seller_standards_profile and traffic_report 100 each; Feed 100,000; Finances 15,000; Fulfillment Order resource 100,000, payment dispute methods 250,000; Inventory 2 million; Logistics 2.5 million; Marketing Promotion 100,000, Ads 10,000; Metadata 5,000; Browse 5,000 (all except getItems); Identity 5,000; Trading API 5,000. The page says higher limits come via the Application Growth Check. It also lists a video resource at 5,000 per day and a POST user-level limit of 50 requests per 5 seconds (context of that line not read). Snapshot is 2026-06-13, not live. | observed (snapshot) | https://web.archive.org/web/20260613114739id_/https://developer.ebay.com/develop/get-started/api-call-limits , snapshot 2026-06-13, read 2026-11-14 |
| 3 | eBay OAuth token lifetimes | Refresh and re-consent design | The archived OAuth guide page came back truncated (4,342 characters) and the lifetime figures are not in it. | not-found | https://web.archive.org/web/20260316180115id_/https://developer.ebay.com/api-docs/static/oauth-tokens.html , 2026-03-16 snapshot |
| 4 | Facebook Marketplace selling fee on shipped orders | Price and net-payout maths | Secondary sources say 10% with a $0.80 minimum per order, and the fee applies to the shipping charge too. Not seen on a Meta page. | asserted | https://socialappfix.com/facebook/marketplace-shipping-payouts/ (2026-10-31); https://www.listing-forge.com/blog/facebook-marketplace-shipping (2026-01-27) |
| 5 | Facebook seller ship deadline / auto-cancel days (conflict: 3 vs 7) | Sets reminder and warning timers | Not settled at the source. The 2026-10-31 secondary page says Meta's seller pages give 7 calendar days to ship and mark shipped, while a separate canceled-orders page says three days to make a prepaid label or mark shipped. It also says a buyer cancel request not accepted or fulfilled in 7 days auto-cancels. Both numbers may be true for different steps (inferred). | asserted | https://socialappfix.com/facebook/marketplace-shipping-payouts/ (2026-10-31); https://www.lilachbullock.com/does-facebook-marketplace-ship/ (2026-10-23) |
| 6 | Facebook buyer-protection claim window (conflict: 7 vs 45 days) | Sets how long a sold order stays at risk | Nothing found on any page I could read. | not-found | Meta pages could not be opened (see Searched) |
| 7 | Facebook seller-cancel penalty | Sets whether cancel actions need a warning | Secondary: cancelling may affect shipping performance. A 2022 blog says cancellation rate over 10% leads to a 60-day shipping suspension; that is old and unconfirmed. goatlabels says Meta's Seller Protection Policy mentions a temporary shipping restriction for a pattern of cancels or late shipments (page shows no date; I did not open the Meta policy). | asserted | https://socialappfix.com/facebook/marketplace-shipping-payouts/ (2026-10-31); https://tools.oneshop.com/blog/facebook-cancellations-and-refunds (2022-03-29); https://goatlabels.io/shipping-labels-for-facebook-marketplace (read 2026-11-10 per page) |
| 8 | Depop unshipped-order auto-cancel days (conflict: 5 vs 10) | Sets reminder timers | 10 days from purchase. The 5 days in the earlier notes is the Depop Protection label window (row 9). Settled. | observed | Depop help "Shipping on Depop - US", Exa fetch 2026-11-14 (zendesk help centre; exact URL not retained, see Not found) |
| 9 | Depop Protection seller conditions and cap | Sets what seller must do and the loss ceiling | Label window 5 days; cap $300 (GBP 250, AUD 450) including shipping and tax. | observed | Depop help "Depop Protection for sellers", Exa fetch 2026-11-14 |
| 10 | Depop seller-cancel penalty | Cancel flow warning | Not found on the pages read. | not-found | as row 9 |
| 11 | Poshmark cancel rules | Cancel flow and authenticity path | Buyer may cancel within 3 hours; the Terms carry an authenticity-cancel rule. A seller-cancel penalty figure was not found. | observed (terms); penalty not-found | https://poshmark.com/terms , curl 2026-11-14 |
| 12 | Mercari seller cancel | Cancel flow and reminders | Seller must respond to a cancel request within 24 hours; an order with no tracking for 15 days is cancelled; frequent cancelations may result in a warning or account limitation. | observed | Mercari help pages, curl 2026-11-14 (cancel and shipping articles; exact article URLs not retained) |
| 13 | Poshmark and Mercari title, description and photo limits | Field validation in list | Not found. The Poshmark support article and a Mercari local-pickup article timed out or errored on fetch. | not-found | see Searched |
| 14 | Mercari local pickup (conflict between notes) | Whether pickup orders exist | Not settled; the Mercari article could not be opened (CRAWL_UNKNOWN_ERROR). | not-found | https://help.mercari.com/guide/articles/local-pickup (guessed URL, unopened) |
| 15 | Which sites send which notification emails; seller own-listing stats; buyer-address visibility | Detection and watch design | Not attempted at the source in this run. | not-found | none |

## What stays unknown
Rows 3, 6, 10, 13, 14, 15 are unanswered. Rows 4, 5, 7 rest on secondary sources and Facebook's own pages are unread. Row 1 clause-in-February text is unconfirmed.

## Not found
- eBay token lifetimes (row 3), the eBay User Agreement and Depop help URLs as exact strings (I recorded the pages, not their URLs, before the context reset; they can be re-fetched by title).
- Facebook official fee, shipping, auto-cancel, protection pages.
- Poshmark and Mercari listing limits, Mercari local pickup, notification emails, listing stats, address visibility.

## Searched / could not reach
- facebook.com/help/449101635835192, facebook.com/policies_center/commerce, facebook.com/legal/merchant_policies: SOURCE_NOT_AVAILABLE via Exa; curl returned a JavaScript shell only.
- developer.ebay.com live pages: 403 via curl, CRAWL_TIMEOUT via Exa; the Wayback `id_` form with `--compressed` worked for the limits page only.
- Wayback snapshot 20260302044925 of the User Agreement: 429.
- support.poshmark.com listing guidelines: CRAWL_SSL_ERROR. help.mercari.com local-pickup (guessed URL): CRAWL_UNKNOWN_ERROR.
- eBay authorization-code grant page via Wayback: 404.

## Sources fetched
- https://web.archive.org/web/20260613114739id_/https://developer.ebay.com/develop/get-started/api-call-limits (opened)
- https://web.archive.org/web/20260316180115id_/https://developer.ebay.com/api-docs/static/oauth-tokens.html (opened, truncated)
- https://poshmark.com/terms (opened)
- eBay User Agreement, Depop zendesk help pages (two), Mercari help pages (cancel, shipping) (opened; URLs not retained)
- Secondary, opened as search highlights only: socialappfix.com, lilachbullock.com, listing-forge.com, goatlabels.io, tools.oneshop.com, valueaddedresource.net
