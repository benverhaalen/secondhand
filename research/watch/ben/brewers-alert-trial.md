# Does the buy alert really fire for a Brewers jersey, and why Poshmark?
Researched 2026-11-15 by Ben (Claude Code agent; live reads from Ben's Mac, signed out, through Remote Control). Feature: watch.

Ben, 08:09: "say if i wanted a brewers jersey because im a big brewers fan and we just won the world series if one actually fits my criteria that it will actually happen" ([words](../../../product/words.md#2026-11-15-quantify-every-feature-with-why-the-review-step-and-roi), item 6, and "is there a reason you are using poshmark for polling. specifically compared."). The want under test is [scripts/demo/wants/brewers-jersey.json](../../../scripts/demo/wants/brewers-jersey.json): a men's Brewers jersey, size L or XL, $60 or less, still for sale. L, XL and $60 stand in for Ben's own size and price.

## Answer so far

- **A fitting jersey does come along.** Poshmark's newest-first "brewers jersey" search held 48 listings spanning 99.6 hours, about 11.6 a day; 8 of the 48 fit the want, about 1.9 a day *(observed, one read at 08:12 UTC)*. So on an ordinary day a fan waits about half a day for a match, and the alert has something real to fire on.
- **Before today the watcher would have fired for the wrong things.** `stage-watch.mjs` checked only the price. Of those 48 results, 40 don't fit: tees and polos, women's and kids' cuts, other teams, a bobblehead, a pet jersey, Giannis "Brewers" basketball giveaways *(observed)*. A $60 cap alone passes most of them. Fixed: `--want` now judges each listing on Poshmark's own department, category ("Jerseys"), size and price, first on the search card and again on the listing's own page ([want.mjs](../../../scripts/demo/want.mjs), 22 tests).
- **Whether it fires, how fast and how often it misses** is what the two-hour timed run measures. It is waiting on Ben's go-ahead, because it reads a path Poshmark's robots.txt disallows (below). *Results: pending.*
- **Why Poshmark:** from a home connection it is the only one of the six sites that answers a plain signed-out read, and its page carries the listing's publish time, so the delay is measured by Poshmark's clock *(observed)*. It is not the defensible product route: its terms ban automated collection and its robots.txt disallows `/search`. eBay's Browse API is the only sanctioned newest-first search with a creation date (*agent proposal:* the product's watch source, once keys exist).

## 1. What answers a signed-out read, from Ben's Mac

One request each with a desktop Chrome user agent, 08:12 UTC *(observed)*:

| Site | Search page | robots.txt, `User-agent: *` | Sanctioned search route |
|---|---|---|---|
| Poshmark | 200 in 0.70 s, 48 listings with structured price, size, department, category, stock and publish time | `Disallow: /search`, `Disallow: /listings`; `/listing/<slug>` pages allowed | none public |
| eBay | 403 | `Disallow: /sch/`, `Disallow: /sch/i.html?_nkw=`; `/itm/` allowed | Browse API |
| Etsy | 403 (DataDome "enable JS") | `Disallow: /search?*q=` | Open API v3, after Etsy approves the app's purpose |
| Grailed | 200, but an app shell: listings load from Algolia in the browser | `Disallow: /search`; `/shop` allowed | none public |
| Mercari | 403 ("Forbidden") | robots.txt itself 403 | none |
| Depop | 403 | robots.txt itself 403 | Partner API, private, seller tools only |

No 403 was worked around. ntfy.sh answered 200 in 0.13 s.

## 2. API access and terms, from each site's own pages

Read 2026-11-15; quotes verbatim *(observed)* unless marked.

| Site | Search API | Limits | Terms on automated access |
|---|---|---|---|
| eBay | Browse `item_summary/search`: "Listing date (sort=newlyListed)"; up to 200 a page; the response carries `itemCreationDate`, "The date and time when the item listing was created." ([method page](https://developer.ebay.com/api-docs/buy/browse/resources/item_summary/methods/search)) | "5000 API calls per day"; "Buy APIs require an additional license."; more "after completing our Application Growth Check" ([limits](https://developer.ebay.com/develop/get-started/api-call-limits), [growth check](https://developer.ebay.com/api-docs/static/gs_request-an-application-growth.html)) | User Agreement bans "any robot, spider, scraper, data mining tools ... or other automated means" without permission ([agreement](https://www.ebay.com/help/policies/member-behaviour-policies/user-agreement?id=4259)); the API is the permitted route |
| Etsy | Open API v3; the reference page is rendered in the browser and returned nothing, so `sort_on=created` on `findAllListingsActive` is *unverified* | per-app limits shown in the developer portal; the docs show only example values | "You may receive access to the Etsy API only after Etsy's approval of your Application Purpose"; "You will not display listing content more than six (6) hours older"; bans "automated systems or browser extensions to access, analyze, or scrape the Etsy Site" ([API terms](https://www.etsy.com/legal/api)) |
| Poshmark | none | none | bans "copy, scrape, harvest, crawl or use any technology, software or automated systems to collect any information" ([terms §4(b)](https://poshmark.com/terms)) |
| Grailed | none public (Algolia key inside the page) | none | bans "any robot, spider, scraper, crawler, data mining tools" ([terms](https://www.grailed.com/about/terms)) |
| Depop | "This API is currently private and is not available to the general public." Seller inventory, orders and offers; no search of others' listings ([partner API](https://partnerapi.depop.com/api-docs/)) | n/a | robots.txt unreadable (403); never Ben's personal Depop ([05:54](../../../product/words.md#2026-11-15-stop-using-my-personal-depop)) |
| Mercari | none | n/a | the terms page failed to load; not read |

## 3. Which site for the alert

Latency is the poll interval plus the site's own delay from "listed" to "shows in search", plus about 1 s to read the search and the listing.

| Site | Latency we can reach | Volume for "brewers jersey" | Verdict |
|---|---|---|---|
| Poshmark | poll interval + index delay (*being measured*); 0.7 s a read | 11.6 a day, 1.9 a day fit *(observed)* | **Demo**: the only one we can measure and run tonight; say it reads Poshmark's public page |
| eBay | poll interval + index delay (unmeasured). 5,000 calls a day is one read every 17 s for a single want around the clock, so the product shares one read across everyone watching the same search *(inferred)* | not measured; no keys | **Product** watch source *(agent proposal)*: the one sanctioned newest-first search with a creation date, and its links can carry eBay Partner Network tracking |
| Etsy | at best the poll interval; content may be up to 6 h old by its terms | not measured; licensed MLB jerseys there are mostly vintage *(inferred)* | second API source for vintage, after approval |
| Grailed | Algolia would be fast, but only by lifting a key from the page against its terms | not measured | out |
| Mercari | none without a browser | not measured | out |
| Depop | none: search 403, its own saved searches push weekly ([new-listing-detection §1](../nate/new-listing-detection.md#1-each-sites-own-saved-search-alerts)) | not measured | out |

## 4. What Poshmark's page carries

`window.__INITIAL_STATE__` holds search cards at `$_search.gridData.data[]` and a listing at `$_listing_details.listingDetails` *(observed)*. Fields read: `price_amount.val` (a string), `inventory.status`, `inventory.size_quantities[].size_obj.display`, `catalog.department_obj.display`, `catalog.category_feature_objs[0].display`, `first_published_at`, `title`. Two traps *(observed)*:
- A boys' XXL has `size_obj.id` "XXLB" but displays "XXL", so only the department keeps a kid's jersey out.
- One listing's title says 2XL while its size field says XL. The field decides the match; the alert card should show both so a person checks before buying (*agent proposal*, the human-in-the-loop step).

The newest-first order held for 46 of 47 neighbouring pairs, so the watcher compares the whole page against what it has seen and never stops at the first known listing *(observed)*. The listing id's first 8 hex digits are its creation time; `first_published_at` can be later when a draft waits, so the found-after time now starts at the publish time.

## 5. The timed run (pending Ben's go-ahead)

[scripts/demo/alert-trial.mjs](../../../scripts/demo/alert-trial.mjs): "brewers jersey" plus two busier searches ("mlb jersey", "jersey") so the delay has enough samples, each read every 15 s for 120 minutes, about 1,400 reads; each new Brewers listing's own page read once; ntfy timed from post to a subscriber. It reports, per search: seconds from Poshmark's publish time to our first sight (p50, p90, max, and a lower bound from the read before), listings published in the window that we never saw (from a re-read of two pages after the window), listings that resurfaced with an old id, how many the old price-only rule would have pinged that don't fit, and how many the want rule pings.
