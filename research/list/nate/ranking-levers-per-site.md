Owner: Nate. Written 2026-11-15 by a retriever seat. Status: reference.

# Ranking levers per site
Researched 2026-11-15 by Nate. Feature: list.

## Question and what it decides

Question: on eBay, Poshmark, Depop, Mercari and Facebook Marketplace, what do the sites' own public pages say about how a listing gets seen: the buyer sort options and default, the free seller lever, the paid lever and its cost, and the markdown and offer tools?

It decides which lever the marketing engine uses per site, and at what cost. Ranking beliefs (why a lever works) are in [ranking-algorithms.md](ranking-algorithms.md) and are not repeated here. Ben's notes are at `../ben/platforms/<site>.md`.

Marks: observed = read at the URL on 2026-11-15 (page text or search highlight of that page); asserted = a company or third party claims it, not seen on a primary page; inferred = my reasoning. Third-party pages are pointers only. No recommendations here.

## What changed

| Site | Draft answer | Result | Corrected value |
|---|---|---|---|
| Poshmark | Sorts Just Shared, Just In, Price Drop, Relevance, price | Not confirmed | No primary sort list found |
| Poshmark | Default sort | Unresolved | Sources conflict (Just Shared vs Just In vs relevance); all third-party |
| Poshmark | Sharing moves a listing up in Just Shared | Not confirmed | No primary page found |
| Poshmark | Offer to Likers needs 10% plus shipping discount | Held for 10%; shipping unresolved | 10% below buyer's lowest offer in last 90 days (or current price if first offer). The same Poshmark page says the shipping discount is both "optional" and "included"; see table |
| Poshmark | Price-drop minimum | Held, with detail | Likers notified at 10% or more; final price at least $10; at least 10% below lowest historical price |
| Poshmark | Paid closet promotion | Held | "Promoted Closet": weekly budget, cost per click, auction; no published per-click price |
| Depop | Boosted Listings 8 to 12% on sale only | Changed | 12% UK and US (new listings from 23 March 2026); 8% Australia; charged only on a sale within 28 days of a view, click or like of the boosted tile |
| Depop | Sorts Relevance, Popular, Newest | Not confirmed | Depop's page names "sort by relevance" and price/listing-age sorts; "Popular" not seen on a primary page |
| Depop | Offers to likers | Held | "Send Offer"; expiry 14 days per Depop's help page |
| eBay | Default sort Best Match | Held | Observed on id=4166 and id=4006 |
| eBay | Promoted Listings Standard = ad rate on sale only | Held | Now called "General" strategy; ad rate 2% to 100% of total sale amount, on a sale within 30 days of a click |
| eBay | Promoted Listings Advanced = cost per click | Changed | Current name is "Priority" strategy (cost per click, second-price auction) |
| eBay | Best Offer and offers to watchers | Held | Offers to interested buyers at least 5% below Buy It Now price; valid 96 hours |
| eBay | Automatic price reduction setting | Not found | No primary page found |
| Mercari | Default Best Match | Not confirmed | No primary page found |
| Mercari | No paid placement | Held | Help 347 describes only free tools; no paid promotion seen |
| Mercari | Promote = min percent drop | Held | 5% or more, once per item per 24 hours |
| Mercari | Smart Pricing lowers to a floor | Held | Name unchanged; price and floor price; schedule unpublished |
| Mercari | Offers to likers | Held | 10% or more, up to 50 most recent likers, valid 24 hours, once per item per 72 hours |
| Facebook | Ranking on Meta's transparency page | Held | Fetched; boosted listings and ads are outside the AI ranking |
| Facebook | Boost Listing is a paid ad | Held | Primary Meta help page not fetched; cost is budget and duration; a "Cost per Sale" variant is reported by one third party only |
| Facebook | Renew and price drops exist | Not confirmed | Primary page not fetched; third parties only |

## eBay

| lever | free or paid | what it costs | the rule (minimums, limits, cooldowns) | source URL and date | mark |
|---|---|---|---|---|---|
| Default buyer sort: Best Match | free | none | "When buyers search on eBay, the default order of results is called Best Match." Factors: match to search terms, popularity, price, listing quality, completeness, listing terms (returns, handling time), seller track record. Buyers can also sort, e.g. lowest price first | https://www.ebay.com/help/selling/listings/listing-tips/optimising-listings-best-match?id=4166 ; https://www.ebay.com/help/buying/search-tips/search-tips?id=4006 (2026-11-15) | observed |
| Full list of buyer sort options | n/a | n/a | not read on a primary page | | not-found |
| Promoted Listings General (called Standard until April 2024) | paid, on sale only | ad rate chosen by seller, 2% to 100% of total sale amount (item price, shipping, taxes, fees) | Charged only if the item sells within 30 days of a click on the ad. Dynamic ad rate follows eBay's daily suggestion; Fixed does not change. A click includes watchlist, cart, quick view. Listing in one General campaign at a time. Seller must be Above Standard or Top Rated with enough activity | https://www.ebay.com/help/selling/listings/promoted-listings-overview/promoted-listings-standard?id=4164 ; https://www.ebay.com/help/selling/listings/promoted-listings-overview?id=5295 (2026-11-15) | observed |
| Suggested ad rates | n/a | n/a | URL for eBay's suggested rates | https://www.ebay.com/help/selling/ebay-advertising/promoted-listings/suggested-ad-rates?id=5839 (seen in search results, not read in full) | asserted |
| Promoted Listings Priority | paid, per click | cost per click set by a second-price auction | Paid for valid clicks whether or not it sells. Cost depends on listing quality, keyword relevance, bid, competition and a reserve price. Keyword targeting. A listing may be in multiple Priority campaigns. No fixed price published | https://www.ebay.com/help/selling/listings/promoted-listings-overview?id=5295 (2026-11-15) | observed |
| Best Offer (buyers offer) | free to enable | final value fee applies on sale | Seller has 24 hours to respond; offer expires after 24 hours or when listing ends. Counteroffers expire after 96 hours. Buyers up to 3 offers per item in most categories; max 5 counteroffers each. Auto-accept and auto-decline thresholds exist; they do not run during a Discounts Manager sale. Not available in some categories | https://www.ebay.com/help/selling/listings/selling-buy-now/adding-best-offer-listing?id=4144 (2026-11-15) | observed |
| Offers to interested buyers (watchers, cart) | free | final value fee on sale | At least 5% below Buy It Now price (a 2023 community post said tiered 5%/3%/2%; the current page says 5%). Sent to the 30 most recent interested buyers; valid 96 hours; further batches of up to 30 every 48 hours; shipping excluded; cart items must be in cart at least 2 days. Automated offers can be switched on and pause if price falls below the offer. Store subscribers: rule-based offers for up to 150 days | same id=4144 page (2026-11-15); Seller Center: https://www.ebay.com/sellercenter/growth/seller-hub-discounts/offers-to-buyers-best-offer | observed (page); the 2023 tiers are asserted |
| Automatic price reduction | n/a | n/a | not found on a primary page | | not-found |
| Relist, renew | free or fee | insertion fee when relisted | First 250 listings per month free, then $0.35 each; a manual relist is charged again (insertion fee or counted as zero-insertion listing). Fixed price listings are Good 'Til Cancelled and renew monthly; each renewal counts as an insertion. Auction auto-relist up to 8 times, free except vehicles (UK-style help page, id=4147; the page says auto-relist only for new and occasional sellers) | https://www.ebay.com/help/selling/listings/creating-managing-listings/relisting-items?id=4147 ; https://www.ebay.com/help/selling/fees-credits-invoices/selling-fees?id=4822 (2026-11-15) | observed |
| Edit/revise limits | n/a | n/a | not found | | not-found |
| Fee table | | most categories 13.6% of total sale amount up to $7,500, then 2.35% above; per-order fee $0.30 (order $10.00 or less) or $0.40 (over $10.00); Books, Magazines, Movies, TV, Music 15.3%; Women's Bags & Handbags 15% up to $2,000 and 9% above. Total sale amount includes shipping, handling and sales tax. Clothing rate not captured | https://www.ebay.com/help/selling/fees-credits-invoices/selling-fees?id=4822 (2026-11-15, fetch partial) | observed |

Offer expiry: Best Offer 24 hours; counteroffer 96 hours; offers to interested buyers 96 hours.

## Poshmark

| lever | free or paid | what it costs | the rule (minimums, limits, cooldowns) | source URL and date | mark |
|---|---|---|---|---|---|
| Default buyer sort and sort list | n/a | n/a | No primary page found. Third-party claims conflict: one YouTube seller video says default moved from "Just Shared" to "Just In"; poshwatch.io says "Just shared" in one place and "relevance" in another | pointers only: https://poshwatch.io | not-found (primary); asserted (third party) |
| Share (closet, party, other closets) | free | none | Moves the listing in the sharing feed per sellers' accounts; a limit of about 10,000 shares per 24 hours is claimed by CLOSO via fluf.io only | secondary, not primary | asserted |
| Offer to Likers | free | shipping discount deducted from seller earnings, if used | Offer at least 10% below the lowest offer that buyer received in the last 90 days, or 10% below current price if first. Buyer has 24 hours. Buy Now orders do not qualify. A counteroffer removes the shipping discount. Same page says the shipping discount is "optional" ("A shipping discount is not required to send an offer") and also lists "Include a shipping discount that is deducted from your seller earnings" among the rules: unresolved | https://support.poshmark.com/s/article/831745541?language=en_US (2026-11-15) | observed |
| Price drop notifications | free | the price cut | Likers notified of drop of 10% or more; final minimum price at least $10; drop at least 10% below lowest historical price. Channels: newsfeed, push, email. Shipping discounts randomly assigned, last 6 hours | https://poshmark.com/price_drop_policy (2026-11-15) | observed |
| Closet Clear Out | free | the price cut | Periodic event; at least 10% below lowest historical price; 6-hour shipping discount (Poshmark blogs 2020-01-20, 2021-11-08). Day and shipping price details come from secondary sources only | https://blog.poshmark.com/2020/01/20/the-poshmark-merchandising-guide/ ; https://blog.poshmark.com/2021/11/08/5-ways-to-increase-your-closets-visibility-this-season/ | observed (rule); asserted (schedule) |
| Promoted Closet | paid | cost per click from a weekly budget set by seller; no fixed per-click price published | Auction; 7-day billing cycle; a click is a detail-page click, like or add to bundle; no refunds; budget changes at least 1 day before the next cycle; free first-week trial with budget set by closet size; placement in search and brand pages | https://poshmark.com/promoted-closet/terms ; https://poshmark.com/promoted-closet/learn (2026-11-15) | observed |
| Relist, edit limits | n/a | n/a | not found | | not-found |
| Fee table | | under $15 a flat $2.95; $15 or more 20% of listing price | Seen in highlight of the get-started page; no separate help-centre fee article identified | https://poshmark.com/posh_guide/get_started_on_poshmark (2026-11-15) | observed |

Offer expiry: Offer to Likers 24 hours. Share/renew/relist limit: share limit not found at a primary page.

## Depop

| lever | free or paid | what it costs | the rule (minimums, limits, cooldowns) | source URL and date | mark |
|---|---|---|---|---|---|
| Buyer sort and default | free | none | Depop's ranking page says "sort by relevance", and sorting by price or listing age only considers relevance and seller location before sorting. "Popular" and "Newest" as a named list was not seen on a primary page. Boosted listings are ranked separately and sort does not change their order. Only Boosted Listings buy ranking; Top Seller status has no effect | https://depophelp.zendesk.com/hc/en-gb/articles/9422984899985-How-Depop-ranks-search-results-and-recommends-listings (2026-11-15) | observed (ranking); not-found (sort list, default) |
| Boosted Listings | paid, on sale only | 12% UK and US (new listings from 23 March 2026); 8% Australia | Charged only if the buyer viewed, clicked or liked the boosted tile and buys within 28 days. Base is item price excl. tax plus self-arranged shipping; Depop Shipping labels not charged. Refunded if the sale is refunded. Fee still applies if you unboost before the sale. Boost Shop covers the whole shop at the same rate. Eligible once Depop Balance activated or 28 days after account creation | https://depophelp.zendesk.com/hc/en-gb/articles/10110299060753-Boosted-Listings ; https://depophelp.zendesk.com/hc/en-gb/articles/9253129255569-Boosted-Listings-Policy (2026-11-15) | observed |
| Send Offer (to likers) | free | none | One or all likers, same country only, one active offer per buyer, not editable until expiry, not available on multi-size listings. Expires after 14 days. Offer price excludes shipping. Auto-respond and automatic offers exist | https://depophelp.zendesk.com/hc/en-gb/articles/15495796917777-Send-Offer (2026-11-15) | observed |
| Auto-send offer limits (API) | free | none | Partner API: auto-offer goes out 1 hour after a like or bag; at least 5% below listing price (API rule only) | https://partnerapi.depop.com/api-docs/how-to-guides/managing-offers/ (2026-11-15) | observed (API) |
| Buyer Make Offer | free | none | Seller has 14 days to respond; after acceptance buyer has 14 days to buy | https://depophelp.zendesk.com/hc/en-gb/articles/4412315779345-Make-Offer (2026-11-15) | observed |
| Refresh, relist, edit limits; markdown tool | n/a | n/a | not found | | not-found |
| Fee table | | No Depop selling fee in the UK, US, Australia. Payment processing: US 3.3% + $0.45, UK 2.9% + £0.30, Australia 2.6% + $0.30 AUD. 10% selling fee outside those countries | https://depophelp.zendesk.com/hc/en-gb/articles/360001791127-Seller-fees-and-charges (2026-11-15) | observed |

Offer expiry: 14 days (a secondary source says a 2024 announcement said 24 hours; not seen primary).

## Mercari

| lever | free or paid | what it costs | the rule (minimums, limits, cooldowns) | source URL and date | mark |
|---|---|---|---|---|---|
| Default buyer sort and sort list | n/a | n/a | not found on a primary page | | not-found |
| Promote | free | the price cut | Reduce price 5% or more; item boosted in search and all likers notified. Each item once per 24 hours. Re-promoting needs new price at least 5% below the historic low, never below $1. Permanent price drop. Smart Pricing or Smart Offers stop working if price goes below your set minimum | https://www.mercari.com/us/help_center/article/347/ (2026-11-15) | observed |
| Offer to Likers | free | the price cut | Reduce price 10% or more; to a maximum of 50 most recent likers; valid 24 hours; binding if accepted. New one must be at least 10% below historic low (not below $1); one per item per 72 hours. New likers can be auto-sent the last offer after a chosen delay | same id=347 page (2026-11-15) | observed |
| Time-limited Sale | free | the price cut | Items listed 7 or more days; discount lasts 3 days (72 hours); boosts in search, featured in "Deals", notifies interested buyers; price at least 10% below historic low | same id=347 page (2026-11-15) | observed |
| Smart Pricing | free | none | Set price and floor; Mercari gradually adjusts by market demand, never below the floor; schedule unpublished. Listing price range $1 to $2,000 ($5,000 authenticated) | https://www.mercari.com/us/help_center/topics/listing/guides/creating-a-listing/ (2026-11-15) | observed |
| Buyer offers | free | none | Buyers offer on an item or bundle; seller accepts, declines or counters; buyer has 24 hours to respond to a counteroffer. Expiry of a buyer's own offer not found | https://www.mercari.com/us/help_center/article/330/ (2026-11-15) | observed |
| Paid placement | n/a | none seen | No paid promotion appeared on id=347; a third party (Investomatica) claims a limit of 10 promoted items per 24 hours, contradicted by id=347 ("once per item per 24 hours") | | observed (absence on page); asserted (10/24h) |
| Edit and relist limits | n/a | n/a | Help 2514 (cited in [ranking-algorithms.md](ranking-algorithms.md)) favours genuine updates over delete-and-relist; no numeric limit found | https://www.mercari.com/help_center/article/2514/ | not-found (limit) |
| Fee table | | flat 10% selling fee on item price plus buyer-paid shipping from January 6, 2025; buyer pays 3.6% Buyer Protection; no payment processing fee; ACH free (one per day); Instant Pay $3 | Nearest primary FAQ; no dedicated table URL identified | https://www.mercari.com/us/help_center/article/2518/ (2026-11-15) | observed |

Offer expiry: Offer to Likers 24 hours; counteroffer response 24 hours.

## Facebook Marketplace

| lever | free or paid | what it costs | the rule (minimums, limits, cooldowns) | source URL and date | mark |
|---|---|---|---|---|---|
| Ranking of the feed | free | none | Meta's system card (updated Sep 30, 2026): inventory gathered by recency and relevance; around 1,000 listings sent to scoring; signals include location, category, condition, price; listings put in order by predicted-value score. "Your Marketplace feed might also include boosted listings and advertisements. That content is not powered by the AI we describe." Option to browse in a non-personalized way | https://transparency.meta.com/features/explaining-ranking/fb-marketplace/ (2026-11-15) | observed |
| Buyer sort and default | n/a | n/a | not on the system card text read | | not-found |
| Boost Listing | paid | budget and duration chosen by seller; roughly $5/day minimum in the US (LeadsBridge), varies by currency; paid whether or not it sells | Turns the listing into an ad shown in Feed, search and Marketplace (Shopify). Local boosts reach adults within 40 miles (Shopify, 2024). A "Cost per Sale" boost (ad rate 15% to 30%, 30 days or until sold, 7-day attribution) is reported by Value Added Resource, 2026-10-12; undocumented by Meta | https://leadsbridge.com/blog/how-to-boost-facebook-marketplace/ ; https://www.shopify.com/blog/sell-on-facebook | asserted |
| Renew | free | none | Not available for every listing type (e.g. shipped); reported available after about 7 days. Meta's own wording not seen. fluf.io says listings do not expire at 7 or 30 days and that renewing or editing resets a two-year inactivity deletion window (also asserted) | https://leadsbridge.com/blog/how-to-boost-facebook-marketplace/ ; https://fluf.io/crosslisting/squarespace-to-facebook-marketplace/ | asserted |
| Price drop notice and offers (expiry) | n/a | n/a | not found at a Meta page | | not-found |
| Fee table | | Local pickup: no fee. Shipped orders through checkout: 10% of total transaction value (item, shipping, tax), minimum $0.80, since April 15, 2024 (earlier 5%, minimum $0.40) | g2rocket cites "Meta's Onsite Checkout Payments Features Terms and Conditions"; that document was not fetched | https://g2rocket.com/does-facebook-marketplace-charge-fees/ | asserted |

## Cross-site

| site | default buyer sort | free lever that moves a listing most, by the site's own account | paid model |
|---|---|---|---|
| eBay | Best Match (observed) | not stated by eBay; its page says only to follow best listing practice. Offers to interested buyers is the free tool it documents | Promoted Listings General (percent of sale, on sale only, 2% to 100%) and Priority (cost per click) |
| Poshmark | not found at primary | not found at primary; price drop at 10% or more notifies likers (observed) | Promoted Closet: weekly budget, cost per click, auction |
| Depop | relevance ("sort by relevance") per ranking page; named default not seen | not stated; Depop says only Boosted Listings buy ranking | Boosted Listings: 12% (UK, US) or 8% (Australia) on sale only |
| Mercari | not found | Promote: 5% or more price drop boosts in search and notifies likers (observed) | none seen |
| Facebook Marketplace | personalized score order; no named default sort seen | not stated by Meta | Boost Listing: budget and duration ad, paid regardless of sale (asserted) |

## Not found

- Poshmark: primary sort list and default; primary share limit; relist/edit limits; a help-centre fee article.
- Poshmark: whether the Offer to Likers shipping discount is required (the page contradicts itself).
- Depop: primary sort list and default (Popular, Newest unconfirmed); refresh/relist/edit limits; any markdown tool.
- eBay: full buyer sort list; automatic price reduction setting; revise/edit limits; clothing final value fee rate; Priority per-click price (auction); the id=4101 offers page timed out.
- Mercari: default sort and sort list; numeric edit/relist limits; a dedicated fee table URL; expiry of a buyer's own offer.
- Facebook: Meta help pages for Boost, Renew, price drops, offers and the offer expiry; buyer sort options and default; the fee terms document; the Facebook help URL tried (help/1889067784738765) returned SOURCE_NOT_AVAILABLE.
- Closet Clear Out schedule and shipping price from a Poshmark page.

## Sources fetched

All fetched 2026-11-15 (page text or search highlight of that page).

- https://transparency.meta.com/features/explaining-ranking/fb-marketplace/
- https://www.ebay.com/help/selling/listings/listing-tips/optimising-listings-best-match?id=4166
- https://www.ebay.com/help/buying/search-tips/search-tips?id=4006
- https://www.ebay.com/help/selling/listings/promoted-listings-overview?id=5295
- https://www.ebay.com/help/selling/listings/promoted-listings-overview/promoted-listings-standard?id=4164
- https://www.ebay.com/help/selling/listings/selling-buy-now/adding-best-offer-listing?id=4144
- https://www.ebay.com/help/selling/fees-credits-invoices/selling-fees?id=4822
- https://www.ebay.com/help/selling/listings/creating-managing-listings/relisting-items?id=4147
- https://www.ebay.com/help/selling/listings/selecting-listing-duration?id=4652
- https://support.poshmark.com/s/article/831745541?language=en_US
- https://poshmark.com/price_drop_policy
- https://poshmark.com/promoted-closet/terms ; https://poshmark.com/promoted-closet/learn
- https://poshmark.com/posh_guide/get_started_on_poshmark
- https://blog.poshmark.com/2020/01/20/the-poshmark-merchandising-guide/ ; https://blog.poshmark.com/2021/11/08/5-ways-to-increase-your-closets-visibility-this-season/
- https://depophelp.zendesk.com/hc/en-gb/articles/10110299060753-Boosted-Listings
- https://depophelp.zendesk.com/hc/en-gb/articles/9253129255569-Boosted-Listings-Policy
- https://depophelp.zendesk.com/hc/en-gb/articles/360001791127-Seller-fees-and-charges
- https://depophelp.zendesk.com/hc/en-gb/articles/9422984899985-How-Depop-ranks-search-results-and-recommends-listings
- https://depophelp.zendesk.com/hc/en-gb/articles/15495796917777-Send-Offer
- https://depophelp.zendesk.com/hc/en-gb/articles/4412315779345-Make-Offer
- https://partnerapi.depop.com/api-docs/how-to-guides/managing-offers/
- https://www.mercari.com/us/help_center/article/347/ ; /330/ ; /2518/
- https://www.mercari.com/us/help_center/topics/listing/guides/creating-a-listing/
- Third-party pointers (asserted only): leadsbridge.com, shopify.com/blog/sell-on-facebook, g2rocket.com, fluf.io, poshwatch.io, Value Added Resource.
