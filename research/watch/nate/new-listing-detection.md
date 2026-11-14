# What is the fastest reliable way to learn that a new listing matching a saved search has appeared on eBay, Facebook Marketplace, Depop, Poshmark, Mercari, OfferUp and Grailed, and how fresh and costly is each route compared with Firecrawl change monitors?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: watch.

Existing notes: [monitor-alternatives.md](../ben/monitor-alternatives.md), [fanout-and-watch-loop.md](../ben/fanout-and-watch-loop.md), [exa-empirical.md](../ben/exa-empirical.md), [exa-alerts.md](../ben/exa-alerts.md), [watch spec](../../../spec/features/watch.md). Line numbers below refer to those files as read today.

## 1. Each site's own saved-search alerts

| Site | What the platform says | Frequency stated | Evidence |
|---|---|---|---|
| eBay | "We'll send you email alerts when new items matching your search are listed"; email is the default "whenever new items match your search or if there are updates to your saved search". Push covers "Saved Searches"; channels are app, email, SMS. Android battery saver can delay push | None stated by eBay. Third parties call the email a daily digest (esnipe.app 2026-09-15, stock-watch.co.uk 2026-09-25, grailhound.app n/d) | *observed* for eBay help text: https://www.ebay.com/help/buying/search-tips/saved-searches?id=4051 (n/d) and https://www.ebay.com/help/account/changing-account-settings/push-notifications?id=4203 (n/d). Daily digest is *asserted* |
| Facebook Marketplace | Notify Me is created in the app, delivered through Facebook only; no email, webhook or API | Facebook's help publishes no timing (dibs.deals read the help pages 2026-09-22; dealhunter.io 2025-10-28) | *asserted* (vendor pages, unopened as Facebook's own text) |
| Poshmark | Up to 30 saved searches, app only; red dot for new results | Not stated in Poshmark's help (Snipio read it 2026-09-25) | *asserted*; support.poshmark.com rendered only "CSS Error", so not opened. GrailHound (n/d) says email and push default on |
| Mercari US | Setting "New items for your saved searches" under Buying, push and email on by default | None stated; copit.to 2026-06-16 says batched | *asserted*; help article /us/help_center/article/115/ snippet showed only generic settings |
| Depop | Up to 10 saved searches; "You'll get a weekly push notification for all your saved searches"; toggle "New results for saved search"; items worldwide; a saved search cannot be edited | Weekly | *observed*: https://depophelp.zendesk.com/hc/en-gb/articles/360019648117-Saved-Searches (n/d) |
| OfferUp | Bell icon on a search; alerts are broad ("iPhone 15" also notifies other models and accessories). In-app notifications cannot be turned off; email and push say alerts are "waiting in the app" | None stated. pouncify.com 2026-09-10 saw two digest emails in about three weeks | *observed*: https://help.offerup.com/hc/en-us/articles/360031995332-Get-notified-about-items-you-want and https://help.offerup.com/hc/en-us/articles/360032335191-About-notifications (both n/d). Digest cadence *asserted* |
| Grailed | App Store text (2019 snippet): "receive notifications for saved searches and price drops". GrailHound (n/d): email or app, daily or weekly | Daily or weekly | *asserted* only; no Grailed help page opened |

Mercari Japan is a different site: email twice a day, daily or every 3 days; push real time but only for 30 days after setup; up to 100 saved searches (https://help.jp.mercari.com/guide/articles/239/, n/d, *observed* via Exa snippet). It does not apply to Mercari US.

Forwarding to a third party: no official source examined says platform alert emails can or cannot be forwarded. *Inferred*: eBay and Mercari email goes to the account address, so an inbox rule could forward it. Facebook, Poshmark, Depop and OfferUp push is app-only, so not receivable. Digest and weekly timing makes the email route slower than polling (*inferred*).

Confirms [monitor-alternatives.md:31](../ben/monitor-alternatives.md) that no platform alert is an API; extends it with the Depop weekly figure and the eBay daily-digest reports.

## 2. eBay Browse API and Notification API

- Browse `item_summary/search`: `sort=newlyListed` and an `itemStartDate` range filter. *Asserted*: the Browse method page returned 403 to curl and the Exa fetch timed out, so this rests on Exa snippets of the filter reference. Note [fanout-and-watch-loop.md:173](../ben/fanout-and-watch-loop.md) names `itemCreationDate` as the field; I could not settle which name is current.
- Call limit: 5,000 calls a day is *asserted* second hand (apiserpent.com 2026-10-23, lotify.me 2026-09-14). The api-call-limits page returned 403. This matches [fanout-and-watch-loop.md:161](../ben/fanout-and-watch-loop.md), which already calls it second hand.
- Access: the Buy APIs need an Application Growth Check before Production use (developer.ebay.com get-started-on-a-buying-application, Exa highlights, *asserted*). This extends [monitor-alternatives.md:26](../ben/monitor-alternatives.md), which calls the route "Free and the most reliable" without this gate.
- Notification API: item-level topics are only ITEM_AVAILABILITY, ITEM_PRICE_REVISION and PRIORITY_LISTING_REVISION, limited to ePN partners (undated edp.ebay.com overview, Exa, *asserted*). No new-listing topic found. A push route for new items from eBay was therefore not found.
- Feed API is Limited Release ([monitor-alternatives.md:30](../ben/monitor-alternatives.md)); not re-checked.

## 3. Firecrawl monitor

- Minimum interval 5 minutes; no per-monitor fee; each check is billed as the underlying scrape; pricing effective 2026-09-04. *Observed* 2026-11-14: https://docs.firecrawl.dev/features/monitor and https://www.firecrawl.dev/pricing. Confirms [monitor-alternatives.md:25](../ben/monitor-alternatives.md).
- *Inferred*: one URL every 5 minutes is 8,640 checks a month. The free tier is 1,000 credits a month (*observed* on the pricing page), so one URL at 5 minutes exceeds it by that arithmetic if each check costs one credit. Bot-check success on each marketplace is untested ([monitor-alternatives.md:25](../ben/monitor-alternatives.md), L49).

## 4. Apify actors (per result, from the actor pages; freshness not stated)

| Site | Actor | Price | Notes |
|---|---|---|---|
| Facebook | apify/facebook-marketplace-scraper | from $2.60 per 1,000 listings; page also shows $6.20 per 1,000 on Free and $5 on Starter ($19 a month) | rating 3.7 from 28 reviews (ScrapeCreators blog, vendor-authored) |
| Mercari US | parseforge/mercari-scraper | from $11.99 per 1,000; $0.01599 per result | 1 monthly user |
| Mercari US | stealth_mode/mercari-product-search-scraper | from $1.00 per 1,000 | 6 total users |
| Poshmark | automation-lab | $0.001 per listing + $0.001 per run, platform usage extra at $0.25 per GB-hour | run success 66.7% |
| Poshmark | 123webdata | $5 per 1,000 | |
| Poshmark | yugenox | from $1.50 per 1,000, up to 5,000 per search, 100 per page, about 1 to 2 s a page | |
| Depop | epicscrapers | $1.20 per 1,000, proxy included | |
| Depop | h4sh | from $2.00 per 1,000 (page body says $5, inconsistent) | |
| Depop | abotapi | from $1.00 per 1,000 | |

All *observed* on Apify store pages via Exa 2026-11-14 (page dates n/d; Exa snippets, not full-page bytes). Mercari Japan-only actor piotrv1001 ($4.00 per 1,000) is not for US. Freshness equals the schedule interval plus run start time (*inferred*). Cost for repeated polling is per result returned, so a newest-first page of N items polled every 5 minutes costs about N x 8,640 results a month (*inferred*).

## 5. ScrapeCreators Facebook Marketplace endpoint

- `GET /v1/facebook/marketplace/search`, parameters `query`, `lat`, `lng`, `radius_km`, `min_price`, `max_price`, `sort_by` (`creation_time_descend` usually puts newest first on early pages but Facebook can insert newer listings on later pages), `date_listed`, `cursor`. Described as "unofficial". *Observed*: https://scrapecreators.com/facebookMarketplace-search-api (n/d).
- Price: 100 free credits; Freelance $47 for 25,000 credits ($1.88 per 1,000); Business $497 for 500,000 ($0.99 per 1,000); credits never expire; 1 credit per request for most endpoints. *Observed*: scrapecreators.com home page via Exa (n/d). The /pricing URL returned 404.
- One vendor-run call: HTTP 200, 24 listings, 1.32 s; `count=3` still returned 24; no hard rate limit, under 500 concurrent recommended (https://scrapecreators.com/blog/facebook-marketplace-api-tools, 2026-08-16, vendor-authored, *observed*).
- *Inferred*: 8,640 calls a month at a 5-minute poll is about $16.2 on Freelance. Confirms [monitor-alternatives.md:27](../ben/monitor-alternatives.md).

## 6. Facebook's delay before a listing is visible

- endless.page (n/d): "Facebook reviews new listings for a few minutes before anyone can see them". dibs.deals: of 6,658 new listings found 2026-09-28 to 2026-10-08, Facebook showed 9 in search before they were 6 minutes old; signed-out results changed about once an hour. All *asserted* vendor measurements. Consistent with the 7-minute figure in [fanout-and-watch-loop.md:129](../ben/fanout-and-watch-loop.md) and [watch spec L23](../../../spec/features/watch.md); the dibs.deals figures are a tighter source for it.
- dealscannerdealalerts.com 2026-10-24 says native alerts arrive hours late in its use (*asserted*).

## 7. changedetection.io, Browse AI, Visualping

- changedetection.io: $8.99 a month, up to 5,000 URLs, "Re-check times from 5~ minutes (per runner...)", one real Chrome browser included (changedetection.io home page, n/d, *observed* via Exa; a vendorclue page says the 5 minutes is per runner). TechRadar 2025-05-02 also says 5 minutes (*asserted*). /pricing returned 404.
- Browse AI and Visualping: minimum interval and price not obtained (see Not found).

## 8. Consumer alert apps' stated speed

No figure below comes from the vendor's own page in this run; all are secondary and *asserted*.
- Flipify: 10 minutes on Basic, 1 minute on Premium ([fanout-and-watch-loop.md:129](../ben/fanout-and-watch-loop.md)); [monitor-alternatives.md:31](../ben/monitor-alternatives.md) quotes the vendor as "every minute" on a $10 plan.
- Swoopa: 47-second average alert, tiers of 1 to 9 minutes (same two lines).
- Underpriced: no speed statement found.
- Facebook-specific scanners: trydealscanner.com 2026-11-08 tiers of 15 min, 5 min, 2 min, 1 min, 30 s; endless.page about 20-second checks, test catch at about 1 minute; carflipfinder.app every 60 seconds. All vendor claims, *asserted*.
- Competitors' 1 to 10 minute range is already in [watch spec L119](../../../spec/features/watch.md).

## 9. Comparison (all *inferred* from the sections above)

| Route | Best freshness | Cost shape |
|---|---|---|
| Platform alerts | eBay unstated (reports: daily); Depop weekly; others unstated | Free; not machine-readable |
| eBay Browse poll | poll interval | Free API; 5,000 a day asserted; Growth Check needed |
| Firecrawl monitor | 5 minutes | Scrape credits per check; 8,640 checks a month per URL |
| ScrapeCreators (Facebook) | poll interval, plus Facebook's review delay | about $1.88 per 1,000 calls |
| Apify actor on schedule | schedule plus run start | $1 to $12 per 1,000 results |
| changedetection.io | 5 minutes per runner | $8.99 a month flat for 5,000 URLs |

Does not change [exa-empirical.md](../ben/exa-empirical.md) or [exa-alerts.md](../ben/exa-alerts.md) (Exa monitor hourly minimum, [monitor-alternatives.md:16](../ben/monitor-alternatives.md)); I did not re-test Exa. [watch spec L53, L58](../../../spec/features/watch.md) (Firecrawl monitors, seen set) are consistent with all of the above.

## Not found
- Visualping and Browse AI minimum interval and price (pages were downloaded but not parsed; not re-fetched).
- Swoopa, Flipify and Underpriced alert-speed statements from their own pages.
- Grailed's official saved-search help page; Poshmark's own support page (render failed).
- eBay Browse method page and api-call-limits page bytes (both 403); the current name of the date field (`itemStartDate` vs `itemCreationDate`).
- Any eBay Notification API topic for new listings.
- Any source saying forwarding platform alert emails to a third party works or is blocked.
- Any measured freshness for Apify marketplace actors.
- Whether Firecrawl gets past Facebook, Mercari, Poshmark, Depop, OfferUp or Grailed bot checks.

## Sources fetched
Opened (text read) 2026-11-14: docs.firecrawl.dev/features/monitor; firecrawl.dev/pricing; the eBay saved-searches and push-notification help pages; depophelp.zendesk.com Saved Searches; help.offerup.com two articles; scrapecreators.com/facebookMarketplace-search-api; scrapecreators.com/blog/facebook-marketplace-api-tools. Read as Exa snippets only (not full page): Apify store pages, changedetection.io home, scrapecreators.com home, help.jp.mercari.com, eBay developer pages, edp.ebay.com, esnipe.app, stock-watch.co.uk, grailhound.app, copit.to, pouncify.com, dibs.deals, endless.page, trydealscanner.com, carflipfinder.app, dealhunter.io, dealscannerdealalerts.com, Snipio, dessence.ai, TechRadar. Existing notes read: the five listed above and the watch spec.

## Searched / could not reach
Tried: eBay developer docs (403), eBay api-call-limits (403), support.poshmark.com (CSS Error), changedetection.io/pricing and scrapecreators.com/pricing (404), Exa search for Underpriced (returned other vendors). Visualping and Browse AI were not parsed. A narrow search does not prove an absent route does not exist.
