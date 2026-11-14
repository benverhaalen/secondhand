# Which buyer-side actions (watch or like, cart, buyer offer, message a seller, purchase history) can a third-party app do for a consenting buyer through an official API, under what terms, and which programmes pay for sending buyers to listings?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: buy (filed under watch because research folders must match a features/ slug).

Evidence marks: *observed* (opened, URL and date given), *asserted*, *inferred*. Dates are the page's own date where it has one; eBay developer pages carry only a 2026 copyright or schema version, so they are dated "2026, undated".

## 0. Where this confirms, extends or contradicts existing notes

- Contradicts [spec/features/buy.md](../../../spec/features/buy.md) line 125 ("no official API in our research" for like, watch, cart, buyer offers, purchase history) for eBay only: eBay has official calls for watchlist, bids, buyer best offers and buyer history (section 1). Each is restricted (approval, closed to new applicants, or 60-day window). For the other six sites the line stands (sections 3 and 4).
- Extends buy.md lines 15, 16, 142, 144: Save-also-watches maps to Trading `AddToWatchList`; Ask or Offer by agent maps to `PlaceOffer` (closed) or Offer API (auctions only); import past purchases maps to `GetMyeBayBuying` (60 days); affiliate not picked, programme facts are in section 5.
- Confirms [research/connect/nate/platform-access.md](../../connect/nate/platform-access.md) lines 45-47 (eBay bans automated means) and extends it with the 2026 wording naming buy-for-me agents (section 2). Confirms lines 58 and 69 (Facebook, Meta Automated Data Collection Terms), lines 109 and 116-118 (Poshmark no API, bans automation incl. liking), lines 127-128 (Mercari no public API). Extends line 19 and 85-87 (Depop scopes are seller-side; no buyer scope seen).
- Confirms [research/price/ben/comps-sources-live.md](../../price/ben/comps-sources-live.md) lines 40 and 159 (Limited Release marking on eBay APIs) and extends it to the Buy Order, Offer and Feed APIs.
- [research/sold/nate/trust-returns-disputes.md](../../sold/nate/trust-returns-disputes.md), [research/data/nate/analytics-and-recommendations.md](../../data/nate/analytics-and-recommendations.md) (line 129 watchCount) and [research/watch/ben/one-search-box.md](../../watch/ben/one-search-box.md): grepped for buyer-side API, affiliate and watchlist content; nothing contradicted. I did not read them in full.

## 1. eBay: what exists, per action

Buy APIs gate (*observed*, https://developer.ebay.com/api-docs/buy/static/buy-requirements.html, 2026 copyright, undated):
- "Many of the Buy APIs are a (Limited Release). The use of eBay's Buy APIs in production is intended for eBay partners only. You must apply for production access through the eBay Partner Network." Acceptance depends on the proposed business model, with no guarantee.
- Process: join EPN, submit the Buy API Application with mocks and data flows, EPN replies within 10 business days, then a Developer Support ticket with the EPN approval, a compliance review, contracts, then access.
- Contracts: User Agreement, API License Agreement, EPN Agreement, Buy-specific contracts, possible MNDAs. Affiliate tracking details are required for revenue share.
- Sandbox is open to any developer account except `guest_checkout_session` and `checkout_session`, which need approval.
- Guest checkout UX rules: FIXED_PRICE items only, no sorting, domestic delivery only, eBay logo and images, User Agreement link in the footer, total shown with import charges, buyer email and addresses collected.

| Action | eBay call | Status and terms |
|---|---|---|
| Search and read items | Browse API (application token) | `getItems` marked Limited Release, "select Partners" (*observed*, https://developer.ebay.com/develop/api/buy/browse_api.md, 2026, undated). Search was not marked Limited Release on the page I read. Item fields include `bidCount`, `currentBidPrice`, `itemAffiliateWebUrl`, `uniqueBidderCount`. |
| Watch | Trading `AddToWatchList` (user token) | Adds active items by ItemID, returns `WatchListCount` and `WatchListMaximum` (sample 300). No approval note on the page (*observed*, https://developer.ebay.com/Devzone/XML/docs/Reference/eBay/AddToWatchList.html, schema 1489, 2026). |
| Bid | Offer API `placeProxyBid`, `getBidding` (user token) | "available only to select developers approved by business units". Auctions only (*observed*, https://developer.ebay.com/develop/api/buy/offer_api.md, 2026, undated). |
| Buyer Best Offer, buy now | Trading `PlaceOffer` | "eBay is no longer accepting new applications for the PlaceOffer feature. New partners can apply to use the Offer API." Automatic or scheduled use is prohibited; the user must take an explicit action before each call and the app must get confirmation before each call; sniping named; at most one call per minute in the last three minutes of an auction; `EndUserIP` required; a BotBlock (CAPTCHA) handle required (*observed*, https://developer.ebay.com/Devzone/XML/docs/Reference/eBay/PlaceOffer.html, 2026, undated). The Offer API page I read lists no Best Offer method (*observed*, same offer_api.md). |
| Cart and checkout | Order API guest (app token, "Checkout with eBay" widget, `apix.ebay.com/buy/order/v2`) and member (user token, `.../v1`; PCI DSS if the app supplies card data) | Both Limited Release (*observed*, https://developer.ebay.com/api-docs/buy/static/api-order.html, 2026, undated). No cart object seen; checkout is per session. |
| Purchase history | Trading `GetMyeBayBuying` | Returns WatchList, BidList, BestOfferList, WonList, LostList and `BuyingSummary`; `DurationInDays` 0-60 on Watch, Bid, Won, Lost lists (*observed*, https://developer.ebay.com/Devzone/XML/docs/Reference/eBay/GetMyeBayBuying.html, 2026, undated). 60-day cap is *inferred* from that range. Order API `getPurchaseOrder` returns payment status and tracking for orders the app placed (*observed*, api-order.html). |
| Messages to seller | not found as an official buyer API | *not-found* in what I opened. |
| Feed | Feed API | Limited Release; feed types CURATED_ITEM_FEED, PRODUCT_FEED, PROMOTION, PROMOTION_V2; item feed files need EPN membership (*observed*, https://developer.ebay.com/api-docs/buy/static/api-feed.html and buy-requirements.html, 2026, undated). |

Buy APIs marketplace support: searchByImage only US, DE, UK, AU (*observed*, https://developer.ebay.com/api-docs/buy/static/ref-marketplace-supported.html, 2026, undated).

Not opened: eBay Fulfillment API as a buyer history source. *Asserted* from memory that it is seller-side only; unverified. Whether Trading calls are scheduled for retirement: not found.

## 2. User agreements on agents acting for buyers

- eBay: Section 3 bans "any robot, spider, scraper, data mining tools, data gathering and extraction tools, or other automated means (including, without limitation buy-for-me agents, LLM-driven bots, or any end-to-end flow that attempts to place orders without human review) to access our Services for any purpose, except with the prior express permission of eBay" (*observed*, https://www.ebay.com/help/policies/member-behaviour-policies/user-agreement?id=4259, effective 2026-06-28 for existing users, fetched via Exa). Participation in the Buy API programme is the contractual route to permission (inferred; the page does not say so).
- Depop: the Terms (help-centre page, page says effective 2 September 2026 per a secondary source, https://reva.run/site/blog/operations/marketplace-automation-rules/, 2026-09-13) ban "mine data, scrape or crawl the Service ... or use any bots or other third-party software", and "any robot, spider, scraper ... or other automated means (including, without limitation, buy-for-me agents, LLM-driven bots, or any end-to-end flow that attempts to place orders without human review) ... except with the prior express permission of Depop" (*observed*, https://depophelp.zendesk.com/hc/en-gb/articles/360001773148-Terms-of-Service, undated). Cross-listing platforms are explicitly allowed under three conditions. Depop API Access Terms bar automated systems or browser extensions accessing Depop data, and AI or ML use of API content, unless authorised in writing (*observed*, https://partnerapi.depop.com/api-docs/terms/, undated).
- Grailed: Terms section 12 ban robots, AI and LLM systems accessing data, and "purchasing agents, automated bidding or buying tools, AI-powered assistants, or any system that submits offers, makes purchases, or completes checkout without direct human initiation and review of each transaction"; third-party apps and extensions need prior written consent (*observed*, https://www.grailed.com/about/terms, undated).
- Poshmark: Terms ban "any technology, software or automated systems to collect any information or data"; Community Guidelines ban "unauthorized programs or other forms of automation", naming liking, sharing, following (*observed*, https://www.poshmark.com/terms and https://poshmark.com/community_guidelines, undated). Human helpers are allowed by the guidelines.
- Mercari US: Prohibited Conduct bans "any robot, spambot, spider, crawler, scraper or other automated means or interface not provided by us to access the Service or to extract data" (*observed*, https://www.mercari.com/us/help_center/topics/account/policies/prohibited-conduct/, undated). Buyer-agent wording not seen.
- OfferUp: Terms section 7 bans "third-party applications that interact with the OfferUp Services without OfferUp's prior written consent" and automated means (harvesting bot, script, scraper) "not provided by OfferUp" (*observed*, https://offerup.com/terms, undated).
- Facebook: Meta Automated Data Collection Terms ban automated collection without express written permission (see platform-access.md line 69; not re-opened here).

## 3. Buyer-side official API, non-eBay

- Facebook Marketplace: the official surface is the Marketplace Partner Item and Seller APIs for partners to upload listings (`POST /v20.0/{product-catalog-id}/items_batch`, 30 calls per minute) (*observed*, https://developers.facebook.com/docs/marketplace/partnerships/itemAPI/, undated). No buyer-side watch, offer, message or history endpoint in what I opened. A vendor blog says none exists (*asserted*, https://scalebrowser.net/blog/facebook-marketplace-api). Confirms platform-access.md line 58.
- Depop: official Selling/Partner API with seller scopes (platform-access.md line 19); no buyer scope found.
- Poshmark, Mercari: no public API (platform-access.md 109, 127-128); not re-searched for a 2026 change beyond the terms above.
- OfferUp, Grailed: no developer API page found.

## 4. What buyer-side actions remain without an official route

Like or follow, cart, buyer offers, seller messages and purchase history on Facebook, Depop, Poshmark, Mercari, OfferUp, Grailed: no official API found (*not-found*; an unreached page is not proof of absence).

## 5. Affiliate and partner programmes

eBay Partner Network:
- *Observed* (https://partnernetwork.ebay.com/our-program/rate-card, undated): commission is a percentage of GMB by category, per-transaction caps, paid once per qualifying transaction. Qualifying: Buy It Now purchase within 24 hours of the click; auction bid within 24 hours and won within 10 days; Best Offer submitted within 24 hours and accepted. Charity and special promotional items may earn low or no commission. The page defers to the Network Agreement (not read).
- Used items: no separate used-item rate found; rates are by category (*not-found* for a used distinction).
- Rates (*asserted*, a blog reading the card, https://earningmoneyonline.co.uk/articles/ebay-partner-network-uk-what-it-pays.html, 2026-09-05): Fashion 4%; Home and garden, Collectables, Lifestyle, Media, Vehicle parts 3%; Business and industrial 2.5%; Cameras, phones, TV, consoles 2%; Computers and tablets 1.5%; Motors 4%; most caps $550; card dated 24 August 2020. Another page said "1% to 6%" and "up to 4%" (https://partnernetwork.ebay.com/solutions/step-1-understanding-cookies-commissions-and-getting-paid, https://www.ebay.com/sellercenter/growth/ebay-partner-network, both seen in search highlights only, unopened).
- `PlaceOffer` commissions need the call made to the item's listing site; an unapproved commission-generating app breaches the EPN Agreement (*observed*, PlaceOffer page above).

Others:
- Poshmark: "Posh Affiliate", campaign-based rewards paid as Poshmark credit to Ambassadors or influencers with 5,000+ followers (*observed*, https://blog.poshmark.com/posh-affiliate/, 2019-05-13). Percentages "1% to 5%" and 24-hour last-click come from aggregators only (*asserted*, https://referralrocket.io/affiliate-program/poshmark_AF). No open network programme found.
- Mercari: Japan "Mercari Ambassador" pays 2% in points, cap 1,000 points per item and 3,000 per buyer per month, 24-hour window (*observed*, https://jp-news.mercari.com/info/35870, 2024-03-04). US programme: only aggregator listings on Sovrn and similar networks, no official page (*asserted*, https://linkmydeals.com/affiliate-programs/info/mercari.com/).
- Depop: aggregators list Skimlinks, Awin and other campaigns (0-7%, 5% UK) (*asserted*, https://linkmydeals.com/affiliate-programs/info/depop.com/, https://app.hienergy.ai/a/depop-limited-us-15060f0d-e59d-4f45-bdf8-fa8c413be52e); two other sources say no public open programme (*asserted*, https://www.magentheme.com/depop-affiliate-program-review-is-it-worth-it/, 2025-11-26; https://www.getvendo.com/b/depop-marketplace-affiliate-program-2, 2023-10-20). Conflicting; no official page opened.
- Grailed: programme on Impact at 2% (*asserted*, https://app.hienergy.ai/a/338377), or FlexOffers 8.8% new customers and 0.8% others with 15-day cookie (*asserted*, https://www.flexoffers.com/affiliate-programs/grailed-affiliate-program/, updated 2025-02-03). Grailed's own FAQ page https://www.grailed.com/drycleanonly/grailed-affiliate-program-faq: unopened. Rates conflict across sources.
- OfferUp: no consumer affiliate programme found; only a Business Referral Program with a $100 invoice credit for Business Advertising customers (*asserted*, https://www.getvendo.com/b/offerup-marketplace-affiliate-program, 2023-10-15).
- Facebook Marketplace: no affiliate programme found.

## Not found

- Official buyer-side message API on any of the seven sites.
- A used-item-specific EPN rate; the EPN Network Agreement text; the official rate-card PDF.
- eBay Buy API approval terms for AI agents specifically (the User Agreement requires "prior express permission"; no agent-specific route seen).
- Facebook, Poshmark, Mercari US official affiliate programme pages; OfferUp and Facebook affiliate.
- Whether Fulfillment covers buyer purchases; Trading API retirement date; eBay versioning page defining Limited Release (403).

## Searched / could not reach

Searched: eBay developer docs (Buy requirements, Order, Offer, Browse, Feed, marketplace support, Trading AddToWatchList, PlaceOffer, GetMyeBayBuying), EPN rate card, eBay User Agreement via Exa, Poshmark, Mercari, OfferUp, Grailed, Depop terms and API terms, Meta Marketplace partner docs, affiliate aggregators.
Could not reach: eBay Offer overview, develop/api index and versioning pages (403); Order and Feed `.md` mirrors (404); ebay.com pages by curl (bot challenge); Poshmark support Posh Affiliate article (script error); Grailed affiliate FAQ and Mercari US official programme (unopened). A narrow search does not prove absence.

## Sources fetched

eBay developer pages listed in section 1; https://www.ebay.com/help/policies/member-behaviour-policies/user-agreement?id=4259; https://partnernetwork.ebay.com/our-program/rate-card; https://depophelp.zendesk.com/hc/en-gb/articles/360001773148-Terms-of-Service; https://partnerapi.depop.com/api-docs/terms/; https://www.grailed.com/about/terms; https://www.poshmark.com/terms; https://poshmark.com/community_guidelines; https://www.mercari.com/us/help_center/topics/account/policies/prohibited-conduct/; https://offerup.com/terms; https://developers.facebook.com/docs/marketplace/partnerships/itemAPI/; https://blog.poshmark.com/posh-affiliate/; https://jp-news.mercari.com/info/35870. Search-highlight only (not opened in full): aggregator pages cited as asserted above.
