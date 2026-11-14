# As of November 2026, which seller-side and buyer-side levers do eBay, Facebook Marketplace, Depop, Poshmark, Mercari, OfferUp and Grailed offer that software acting for a user could pull, and what does each site already automate?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: list.

Marks: *observed* = I opened the page and it says so (URL and the page's date, or "undated"). *asserted* = a third party, a search snippet, or memory. *inferred* = my reasoning. Ben's per-site notes already cover most selling mechanics for six sites; this note does not repeat them (see [ebay](../ben/platforms/ebay.md), [facebook-marketplace](../ben/platforms/facebook-marketplace.md), [poshmark](../ben/platforms/poshmark.md), [mercari](../ben/platforms/mercari.md), [grailed](../ben/platforms/grailed.md), [offerup](../ben/platforms/offerup.md)). It adds Depop in full, buyer levers, each site's AI, exports, API exposure, and the closing table.

## Corrections and extensions to existing notes

- Contradicts [depop-plus-lessons.md](../../cross-cutting/ben/depop-plus-lessons.md) line 24 ("offers expire in 24h"): Depop's Send Offer page says the buyer has 14 days, and Make Offer says the seller has 14 days. *Observed*, https://depophelp.zendesk.com/hc/en-gb/articles/15495796917777-Send-Offer (undated); Make Offer seen as a search snippet only (*asserted*), https://depophelp.zendesk.com/hc/en-gb/articles/4412315779345-Make-Offer (undated). The "40%+ of sales through offers" figure on the same line is Ben's own note; I found no Depop source for it (not found).
- Extends [platform-access.md](../../connect/nate/platform-access.md) lines 14 and 75 (Depop Partner API): the API docs have a boosting concept page, so product-level and shop-level boosting are exposed. *Observed in an earlier run*, https://partnerapi.depop.com/api-docs/concepts/boosting/ (undated). The endpoint list in that file does not mention boosting.
- Confirms [handled-by-default.md](../../messages/nate/handled-by-default.md) lines 16 and 18: Depop auto-respond exists on the help site as a per-listing lowest price. *Asserted (search snippet)*, https://depophelp.zendesk.com/hc/en-gb/articles/42789384303761-Auto-respond-to-offers (undated): at or above the floor is accepted, below it gets a counter at the floor, replies within 60 seconds.
- Extends [crosslister-teardown.md](../../cross-cutting/nate/crosslister-teardown.md) section 3 on AI: adds eBay camera-first listing (2026-11-11) and the Mercari, Poshmark and OfferUp details below.

## eBay

Selling levers. Best Offer with auto-accept and auto-decline, seller offers, Promoted Listings, combined shipping, auctions and local pickup are in [ebay.md](../ben/platforms/ebay.md) sections 9 to 12; confirmed, not repeated.
- Scheduled and draft listings: up to 5,000 drafts or scheduled listings (250 via mobile), 50 templates. *Observed*, https://export.ebay.com/en/services-tools/seller-hub/ (undated).
- Bulk edit by upload: Reports tab uploads can add, revise, relist and end listings. *Observed*, same URL. Uploads usually process in under 15 minutes and reports reach back 90 days (*asserted*, inglisting blog, 2026-08-15, unopened).
- Offers in Messaging: negotiation happens in the message thread. *Observed*, https://www.ebayinc.com/stories/news/ebay-launches-seller-tools-to-save-time-boost-profits-and-build-trust/ (2025-08-12).
- Relist and sell similar, sale events, markdown manager, auto-relist: not found as pages this run. Visibility statements: Ben's file lists Best Match factors; I added nothing from eBay engineers.

Buyer levers. Best Offer, watch list, saved searches and combined shipping are in Ben's file. Saved-search and watch-list limits: not found. Authenticity Guarantee and Money Back Guarantee pages: not found. The orders report has an "Authenticity verification programme" column (*observed*, https://www.ebay.co.uk/help/default/default/seller-hub?id=4095, undated).

Site AI:
- AI messaging assistant: opt-in, drafts from the listing description and order details, "Responses are not sent automatically"; the seller reviews, edits or dismisses. *Observed*, 2025-08-12 URL above.
- Camera-first "magical listing" identifies the item and fills details; "Nothing goes live without your approval"; over 10 million unique sellers have used the AI features, over 800,000 listings a day; consumer sellers in AU, FR, DE, IT, UK, US. *Observed*, https://www.ebayinc.com/stories/news/ebay-makes-selling-easier-with-a-new-camera-first-experience/ (2026-11-11). Corroborated by https://www.digitalcommerce360.com/2026/11/11/ebay-visual-identification-magical-listing-tool/ (2026-11-11).
- Bulk-via-AI creation where item specifics need review (*asserted*, Frooition blog, 2026-02-20).

Export: Orders report as CSV with buyer email, "Sold via promoted listings", status and tracking columns; scheduled reports. *Observed*, https://www.ebay.co.uk/help/default/default/seller-hub?id=4095 and https://export.ebay.com/en/services-tools/seller-hub/ (both undated).

API: OAuth plus Inventory, Negotiation, Message, Analytics, Fulfillment (see [platform-access.md](../../connect/nate/platform-access.md)). The AI drafting and camera-first flows: no API page found.

## Facebook Marketplace

Renew, price drop, boost and the shipping fee are in [facebook-marketplace.md](../ben/platforms/facebook-marketplace.md); no offer object on local listings (same file).
- Meta says an AI system ranks about 1,000 candidates using recency, relevance to activity, saves, shares, hides, location, category, condition and price; boosted listings and ads sit outside that ranking AI. *Observed*, https://transparency.meta.com/features/explaining-ranking/fb-marketplace/ (updated 2026-09-30).
- Auto-reply to "Is this still available?": the seller turns it on, previews and edits it (*asserted*, https://www.brainvire.com/blog/complete-guide-to-facebook-marketplace/, 2026, secondary; Ben's file cites Meta's 2026-03-12 post).
- Meta AI drafts a listing from photos and suggests a price (*asserted*, same Brainvire page). Older Meta post: autosuggested category and price (*observed*, https://ai.meta.com/blog/under-the-hood-facebook-marketplace-powered-by-artificial-intelligence/, undated, old).
- Bundles, vacation mode, scheduled listings, auctions, shop sections, free-shipping thresholds, auto-accept: not found.

Buyer levers: saved searches with "Notify Me" alerts. No published limit, and reports of unreliable alerts, are third-party only (*asserted*: Spottable, CarSnipe 2026-02-19, DealFlip 2026-07-14, a developers.facebook.com thread; none opened in full). Collections, a friend in seller chat (test), upfront total cost (*asserted*, https://www.phonearena.com/news/my-love-hate-relationship-with-facebook-marketplace-might-be-over-because-of-these-new-features_id175716, 2025-11-13). Purchase Protection page: not found.

Export: Download Your Information for Marketplace data: not found.

API: the Marketplace Partnership Program is EU/EEA and partner-only ([platform-access.md](../../connect/nate/platform-access.md), observed there). No lever above is exposed to others.

## Depop

From Depop's help site unless stated. Depop has no Ben platform file.
- Boosted Listings: per listing or Boost Shop; fee 12% UK/US, 8% AU, charged only if the buyer interacted and bought within 28 days; extra placement in search and Suggested for you; unboosting one item while Boost Shop is on turns Boost Shop off. *Asserted (earlier run, search highlights only)*, https://depophelp.zendesk.com/hc/en-gb/articles/10110299060753-Boosted-Listings (undated). Eligibility: Depop Balance active or 28 days after account creation; a "view" is a boosted tile seen; no boosting fee on Depop Shipping labels. *Observed earlier*, https://depophelp.zendesk.com/hc/en-gb/articles/9253129255569-Boosted-Listings-Policy (undated). Boosting fee applies to new listings from 2026-03-23; no selling fee in UK/US/AU; US payment processing 3.3% + $0.45; *observed earlier*, https://depophelp.zendesk.com/hc/en-gb/articles/360001791127-Seller-fees-and-charges (undated). API: yes, product and shop level.
- Send Offer (offer to likers): to one or all likers; only buyers in the seller's country; one active offer per buyer, not editable until it expires; unavailable on multi-size listings; the buyer has 14 days; excludes shipping; others can still buy at the original price. *Observed*, https://depophelp.zendesk.com/hc/en-gb/articles/15495796917777-Send-Offer (undated). API: `POST /api/v1/products/{sku}/offer/` (*observed* in [platform-access.md](../../connect/nate/platform-access.md), 2026-11-14).
- Auto-respond to offers: floor price per listing; at or above is accepted, below gets a counter at the floor; replies within 60 seconds; page claims a 100% response rate. *Asserted (snippet)*, URL in the corrections section. API: `auto_negotiate_offer_price` per-listing field (per [handled-by-default.md](../../messages/nate/handled-by-default.md) line 18, not re-opened by me); no endpoint for answering offers by hand ([platform-access.md](../../connect/nate/platform-access.md)).
- Make Offer (buyer): the seller has 14 days to accept, decline or counter; after acceptance the buyer has 14 days to buy; one active offer per item; a seller can accept several, then first come, first served; no offers across countries. *Asserted (snippet)*, Make Offer URL above.
- Discounts: bulk action 5% to 95% off; a new discount replaces the old; buyers see the original price beside the new one; shipping discount of $2, $3, $4 or free, US iOS only. *Observed*, https://depophelp.zendesk.com/hc/en-gb/articles/360033415634-Discounts (undated). Depop's blog says the Discount tool adds a search-result icon (*observed*, https://www.depop.com/blog/grow-your-shop/, 2026-04-01).
- Bundles: percentage off for 2 or more items, shipping-based bundles, custom bundle by message; a shop banner appears automatically. *Observed earlier*, https://depophelp.zendesk.com/hc/en-gb/articles/360017585774-Bundles (undated).
- Bump or share: not found. Depop's blog advises refreshing stale listings with new photos, description or price (*observed*, 2026-04-01 blog). Price-drop notice to likers: not found.
- Relist: "Repop" is a buyer tool that relists a past purchase with fields auto-filled; single items only; usual fees. *Observed*, https://depophelp.zendesk.com/hc/en-gb/articles/12803766422289-Repop (undated). Seller sell-similar: not found.
- Vacation Mode: pauses purchases for 7 days and turns off by itself; banner shown; bag-adds blocked; shop and boosted listings still appear in search; likes, messages, edits still work; sold orders must still ship. *Observed*, https://depophelp.zendesk.com/hc/en-gb/articles/12267530258833-Vacation-Mode (undated).
- Scheduled listings: Selling Hub web > Drafts > Schedule, with bulk scheduling; not announced by Depop. *Asserted*, https://restitched.substack.com/p/depop-now-allows-you-to-schedule (2026-06-01). Drafts, bulk edit, CSV and desktop listing, app-only templates, Ready-to-post toggle (*asserted*, snippet of https://depophelp.zendesk.com/hc/en-gb/articles/8608273715217-Listing-on-web). API: products CRUD ([platform-access.md](../../connect/nate/platform-access.md)); a scheduling endpoint: not found.
- Auction vs fixed price, free-shipping threshold, local pickup, shop sections, closet clear-outs: not found.
- Visibility statements: Depop's personalised feed uses the last 300 views and ranks 600 (*observed earlier*, Depop product release Jan 2025, URL not kept); its blog advises consistent posting, filling all attributes and refreshing stale listings (*observed*, 2026-04-01); Boost Shop claims a 25% sell-through increase (Depop's own claim, June 2025 release, *observed earlier*). A seller's belief that daily listing is favoured is opinion (*asserted*, the Substack above).

Buyer levers: likes; Make Offer; saved searches, up to 10, opt-in weekly push, cannot be edited, cover new items worldwide (*asserted*, snippet of https://depophelp.zendesk.com/hc/en-gb/articles/360019648117-Saved-Searches). Authentication service and buyer protection page: not found.

Site AI: one-photo AI listing with use, adjust or remove (*observed earlier*, Depop newsroom, 2024-09-12); Photoroom editing (June 2025 release); pricing inspiration strategies Likely to sell, Balanced, Less likely (*asserted*, salelinx, 2026-10-24) with API `POST /api/v1/pricing/inspiration/` ([platform-access.md](../../connect/nate/platform-access.md)). Selling API for professional sellers and Responsible AI Principles announced 2026-01-11 (*observed earlier*, Depop newsroom).

Export: Sales download CSV, web only (Selling Hub > Stats > Download sales), up to 3 months per file; date, buyer username, item description, quantity, pricing, fees (Depop Payment, Buyer Marketplace, Selling, Boosting), shipping. *Observed*, https://depophelp.zendesk.com/hc/en-gb/articles/360039263713-How-to-use-your-sales-download (undated). API: orders, insights (`likes_count`, `bag_count`) and webhooks including `product.like` ([platform-access.md](../../connect/nate/platform-access.md)).

## Poshmark

Offer to Likers, Smart Sell, Closet Clear Out, bundles, sharing and Promoted Closet are in [poshmark.md](../ben/platforms/poshmark.md). Added or checked here:
- Offer to Likers: at least 10% off, choose a shipping discount, goes to all likers, expires in 24 hours, must be 10% below the lowest offer in the last 90 days. *Observed*, https://blog.poshmark.com/2026/01/25/your-complete-guide-to-poshmarks-features-tools/ (2026-01-25). Confirms Ben's file.
- Inactive Listings: no action in 60 days (bundling, commenting, offering, editing); "Active listings will be prioritized in search and browsing". *Observed*, https://blog.poshmark.com/2026/04/06/sellerupdatesapril6/ (2026-04-06). A stated visibility rule.
- Posh Stats: average ship time (90 days), cancellation rate, returns; listing metrics: impressions, clicks, likes, seller offers, buyer offers, days listed. Same page. Share and follow notifications are being reorganised (same page).
- Bulk Sharing removed Nov 2025 and restored about 2025-12-15, per [crosslister-teardown.md](../../cross-cutting/nate/crosslister-teardown.md) section 3 (not re-opened).
- Vacation mode and scheduled listings: not found.

Buyer levers: likes; offers; bundles; Posh Authenticate for items at $500 (US) or C$700 and above, free, routed automatically; if not approved the order is cancelled and refunded and the item cannot be relisted; 1 to 3 business days; Posh Protect covers all orders. *Observed*, https://poshmark.com/posh_authenticate (undated) and the 2026-04-06 post. The same post says saved searches will be made easier to find. Saved-search limits and alert details: not found.

Site AI: Smart List AI turns photos into listing details, the seller reviews before publishing, 82% of beta testers said it saved time (*observed*, https://blog.poshmark.com/2025/01/30/introducing-smart-list-ai/, 2025-01-30). Title and description regenerate after a manual correction (*observed*, https://blog.poshmark.com/smart-list-ai-101/, 2024-07-23). Smart Sell: [handled-by-default.md](../../messages/nate/handled-by-default.md) line 16.

Export: My Sales Report (every sale); My Inventory Report emailed, with listing date, days listed, SKU, likes, cost price, lowest and current price, private fields (*observed*, 2026-01-25 post); 1099-K downloadable (*observed*, 2026-04-06 post).

API: none public ([platform-access.md](../../connect/nate/platform-access.md)). Every lever is app or site only.

## Mercari

Offers, Offer to Likers, Promote 5%, Time-limited Sale, Smart Offers discontinued 2024-11-04 and help article 2514 visibility signals are in [mercari.md](../ben/platforms/mercari.md). Added:
- Smart Pricing: the seller names a start price and a floor; the price is lowered gradually "based on market demand". *Observed*, https://www.mercari.com/us/help_center/topics/account/guides/how-it-works/ (undated).
- Listing rules: price $1 to $2,000; up to $5,000 for authentication-eligible designer shoes, handbags and wallets; $2,000 to $5,000 needs ID verification; drafts; seller-chosen free shipping; "The more accurate a listing is, the higher it will appear in search results." *Observed*, https://www.mercari.com/us/help_center/topics/listing/guides/creating-a-listing/ (undated). A stated visibility rule.
- Bundles, vacation mode, scheduled listings, auctions, shop sections: see Ben's file; not otherwise found.

Buyer levers: Buyer Protection fee 3.6% on item price plus buyer-paid shipping; payment held until delivery and rating; 72 hours to report not as described; auto-release to the seller if no rating within 72 hours of delivery; free return label if the claim is approved, return must ship within 3 days. *Observed*, https://www.mercari.com/us/help_center/article/235/ (undated). Mercari auto-rates 5 stars after the buyer's 3 days; ship within 3 business days (*observed*, selling guide URL above). Saved searches: *asserted* only, via the DealHunter blog (2025-10-16, third party, unopened), no limits stated. Authentication page: not found.

Site AI: AI Assistant suggests improvements for unsold listings (*observed*, https://about.mercari.com/en/press/news/articles/20231017_mercariaiassist/, 2023-10-24); AI Listing Support uses GPT-4o mini for category, title and description (*observed*, https://openai.com/index/mercari/, undated); photo, then category, then AI fills item info and sets a price, the seller checks (*observed*, https://careers.mercari.com/en/mercan/articles/49558/, 2025-02-26).

Export: Gross Sales Report on the website, custom dates; Item ID, sold, canceled and completed dates, title, status, ship-to/from state, price, shipping fees, selling fee, processing fee, net proceeds, sales tax, buyer protection charged, 1099-K link. *Observed*, https://www.mercari.com/us/help_center/article/541/ (undated).

API: none public ([platform-access.md](../../connect/nate/platform-access.md)).

## OfferUp

Mechanics are in [offerup.md](../ben/platforms/offerup.md); this adds dated primary pages.
- Promote: 1 Day or 3 Days (combinable), or Promote Plus subscription of 30 days or more; promoted spots rotate among sellers; Promotion Results dashboard; no cancellation; refunds case by case, Apple users via Apple. *Observed*, https://help.offerup.com/hc/en-us/articles/360031994412-Promote-your-items (updated 2025-05-16). Extends the low-confidence Promote entry in Ben's file. Promote Plus price: not found.
- Listing: up to 12 photos and 1 video; app-only AI buttons suggest title and description from photos, the web form has none; "For the first 30 minutes, your listing will be visible to Premium users only." *Observed*, https://help.offerup.com/hc/en-us/articles/360031987592-Post-an-item-to-sell (updated 2026-09-15). The Premium-first window is a stated visibility rule; I did not see it in Ben's file.
- "try editing your listing before dropping the price" (*observed*, https://help.offerup.com/hc/en-us/articles/360032334651-How-to-create-a-great-listing, undated).
- US only; paid features: Promotions, additional listings, Premium, job and service listings; some app-only; no fees on in-person transactions (*observed*, https://help.offerup.com/hc/en-us/articles/360031989092-What-is-OfferUp, undated).
- Auto price drops, bundles, bump, vacation mode, scheduling, shop sections: not found.

Buyer levers: search alerts and similar-item alerts under Account > Search Alerts (*observed*, https://help.offerup.com/hc/en-us/articles/360031995332-Get-notified-about-items-you-want, updated 2025-04-10). Offers are non-binding inbox messages (Ben's file). Purchase protection and authentication pages: not found.

Site AI: the app suggestion buttons above. Export: not found. API: not found.

## Grailed

Mechanics are in [grailed.md](../ben/platforms/grailed.md). Confirmed from Grailed's own guide, https://howtosell.grailed.com/ (undated):
- A price drop of 10% or more moves the listing to the top and notifies favoriters; bump every 7 days, then a 10% drop is needed after a month; seller offers go to the last 100 favoriters.
- Smart Pricing: "automatically price drop your listings by 10% at the best time every week until it hits your pre-set floor price", chosen at listing creation.
- Vacation Mode: listings are labelled, messaging continues, purchases are not shipped until the seller returns.
- Funds released within 3 days of delivery; listing tags; Price Comparison button.
- Orders auto-cancel and refund if no tracking is added within 7 calendar days (*observed*, https://support.grailed.com/hc/en-us/articles/30298256163725-How-can-I-buy-safely, undated).

Buyer levers: notifications for saved searches and price drops, follow designers and sellers (*observed*, https://apps.apple.com/us/app/grailed-buy-sell-fashion/id1061302787, 2025-09-28). Purchase Protection covers authenticity that cannot be verified, material difference, wrong item (*observed*, https://www.grailed.com/trust/purchase-protection, undated). Grailed Verified badge, machine learning plus human moderation (*observed*, https://www.grailed.com/trust, undated). Buyer offers under 60% of the list price are not accepted, offers are non-binding, the buyer has 24 hours after acceptance (*observed but old*, https://www.grailed.com/drycleanonly/how-to-buy-on-grailed, 2020-01-20; may have changed). Saved-search limit: not found.

Site AI: not found. Export: not found. API: not found.

## Closing table (*inferred*)

"Conflict" cites a site rule. "None found" means I found no stated rule, not that none exists. The automation rules for eBay, Poshmark, Mercari, Depop and Meta come from [platform-access.md](../../connect/nate/platform-access.md) and [crosslister-teardown.md](../../cross-cutting/nate/crosslister-teardown.md) (observed there, not re-opened by me).

| Lever | Sites that have it | What an agent could do | Conflict with a stated rule if automatic |
|---|---|---|---|
| Offer to likers or watchers | eBay (seller offers), Depop, Poshmark, Mercari, Grailed | Prepare or send offers inside each site's floor (Poshmark 10%, eBay 5%, Mercari 10%) | Poshmark: Community Guidelines ban unauthorised automation (platform-access.md). Depop: API route exists, partner-gated, one offer per buyer. eBay, Mercari, Grailed: only in-app flows documented |
| Auto accept, decline or counter | eBay, Depop, Poshmark (Smart Sell), Meta (auto-reply, not price) | Set the floor the site's own tool uses | None for the site's tool. eBay User Agreement bans agents acting without human review (crosslister-teardown.md), so an outside agent differs |
| Auto price drop or smart pricing | Mercari, Grailed, Poshmark (Smart Sell), FB (manual) | Set start and floor in the native tool, or edit price on a schedule | Mercari: none found. Grailed: a 10% drop is the bump trigger, so scheduled drops use that route. Poshmark: automation ban |
| Boost or promote | eBay, FB, Depop, Poshmark, Mercari, OfferUp | Set rate or budget, read results | Depop API terms ban metric manipulation. Spending money is the operator's call |
| Share, bump, refresh | Poshmark, Grailed, FB (Renew) | Trigger a renew or bump | Poshmark bans automated sharing and delete-and-repost. Mercari signal 4 favours edits over relists |
| Relist or sell similar | eBay, FB, Mercari, Poshmark | Clone a listing | Poshmark delete-and-repost ban and Excessive Listing Removal (crosslister-teardown.md) |
| Bundles and discounts | Depop, Poshmark, eBay (combined shipping) | Set a discount percentage in range | None found (Depop range 5% to 95%, observed) |
| Sales events, time-limited sale | eBay, Poshmark, Mercari | Schedule an event | None found |
| Vacation mode | Depop, Grailed | Switch on before a trip | None found; Depop still requires shipping sold orders |
| Scheduled listings | eBay, Depop (asserted) | Queue a draft | None found |
| AI listing from photo | eBay, Depop, Mercari, Poshmark, FB, OfferUp (app) | Draft a listing for review | eBay: "Nothing goes live without your approval" (2026-11-11); Poshmark: seller reviews before publishing. eBay Developer API License bans AI training on eBay content |
| Saved searches and alerts | All seven; Depop max 10 | Watch for matches | Meta Automated Data Collection Terms need written permission; Depop API terms ban scraping |
| Buy on a user's behalf | eBay, others | Place orders | eBay User Agreement bans buy-for-me agents placing orders without human review |
| Sales export | eBay, Depop, Poshmark, Mercari | Read data into the app | None stated against manual download; Depop web-only, Mercari website, Poshmark emailed |

## Not found

- Depop: buyer protection, authentication, price-drop notices to likers, seller sell-similar, bump, local pickup, free-shipping thresholds, a Depop source for the "40%+ of sales" figure.
- eBay: Authenticity Guarantee and Money Back Guarantee pages, saved-search and watch-list limits, markdown manager, sale-event page, auto-relist.
- Facebook: Meta help pages for saved searches, Purchase Protection and Download Your Information.
- Mercari: own saved-search page, authentication page.
- Grailed and OfferUp: any export, API, or (OfferUp) purchase-protection page; Grailed saved-search limit.
- Poshmark: vacation mode, scheduled listings, saved-search limits.
- Outcome data for any site-run automation.

## Sources fetched

Opened in full this session: Depop help pages (Send Offer, Discounts, Vacation Mode, Repop, sales download); Poshmark blog posts 2026-01-25, 2026-04-06, 2025-01-30 and posh_authenticate; Mercari help articles 235, 541, the selling guide and Creating a Listing; Grailed howtosell, trust and purchase-protection pages; the OfferUp help articles listed above; the Meta transparency page; eBay Inc. news pages 2025-08-12 and 2026-11-11.
Search snippets only: Depop Make Offer, Auto-respond, Saved Searches, Listing on web; eBay Seller Hub pages; Brainvire, PhoneArena, DealHunter, Spottable, CarSnipe, DealFlip, Frooition, inglisting.
Earlier runs, not re-opened: Depop Boosted Listings, Policy, Seller fees, Bundles, blog, newsroom and release pages.

## Searched / could not reach

eBay developer pages and the Mercari Terms URL returned 403 in earlier runs. The Poshmark Smart List AI support article returned only a CSS shell. Searches for Meta help, eBay buyer-protection and Grailed export pages returned nothing usable. An empty result does not show the feature is absent.
