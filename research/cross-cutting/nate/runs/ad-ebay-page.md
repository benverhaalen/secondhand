# Does eBay serve its public pages to the harness?
Researched 2026-11-15 by Nate (Claude). Feature: harness, site eBay, page lane.

Yes, to a Browser Use Cloud browser that intercepts nothing. Search, one listing, the still-listed check and the storefront all load. A plain request is refused. Sold listings need the person's sign-in. The lane exists by Nate's decision of 2026-11-15, "read ebay pages anyway" (`product/words.md`), and the official API replaces it the day keys exist.

*Observed*: The first browser run (`recon.ts`, US proxy, `solveCaptchas: false`, images, media and fonts blocked with `page.route`) connected in 519 ms. Every page came back as 403, 1,892 bytes, titled "Error Page | eBay": "SORRY Something went wrong on our end", with a reference id. That covered search (504 ms), sold search (394 ms), zero-result search (356 ms) and `/itm/100000000001` (317 ms; a 404 was expected). It is not a captcha: the `CHALLENGE` regex did not match. This is the record of what interception does on eBay.

*Observed*: A plain request (curl with a Chrome 142 User-Agent, `Accept: text/html`, `Accept-Language: en-US`) got 403 for search and for sold search. Each reply was 1,739 bytes and took about 110 ms. It was not tried again.

*Observed*: The second recon run used the same browser with nothing intercepted. It connected in 665 ms and loaded these pages one at a time, with no challenge:

| Page | Status | ms |
|---|---|---|
| search `/sch/i.html?_nkw=levis+501+jeans` | 200 | 4,565 |
| sold search (`&LH_Sold=1&LH_Complete=1`) | "Sign in or Register" page | 3,155 |
| zero-result search | 200, "No exact matches found" then "Results matching fewer words" | 3,149 |
| one listing `/itm/<id>` | 200, JSON-LD Product | 4,127 |
| `/itm/100000000001` | 404 | 3,436 |
| `/str/<name>` (wrong path for this seller) | "this user was not found" | 2,297 |
| home page | 200 | 3,047 |
| the same search typed into the home page box | 200, 79 items | 4,037 |
| `/usr/<name>` storefront | 200 | 4,920 |

*Observed*: The direct URL and the search box both work. The direct URL is one load where the box takes two, so the lane uses the direct URL.

*Observed*: The page lane ran live once (`live-page.ts`, one browser, nothing intercepted, 5 s between loads, 6 loads). It connected in 462 ms. The times below are the page load alone, with the pauses taken out:

| Verb | Result | ms |
|---|---|---|
| `ebay.search.page` on ebay.com | 60 rows, USD | 4,468 |
| `ebay.search.page`, sold, no session | `auth_expired`, `do: relink`, no load | 0 |
| `readItemPage` | 1 row, USD | about 4,280 |
| `stillUpPage` | `live` | about 3,490 |
| `ebay.read_storefront.page` | rating, reviews, sold, followers, member since | about 3,290 |
| `ebay.search.page` on ebay.co.uk, `_salic=1&LH_LocatedIn=1` | 60 rows, GBP, `converted: true` | about 4,060 |
| one ebay.co.uk item page `/itm/<id>` | 200, JSON-LD `priceCurrency` GBP, a "US $" amount also shown | about 3,590 |

For the regional row, ebay.com was answered as its error page inside the script, so the fallback ran and no ebay.com load was spent. The regional measurements are in `research/cross-cutting/nate/runs/ebay-when-it-serves.md`, "eBay's regional sites".

*Observed*: Page loads in this session: 2 terms documents, 2 plain requests, 4 intercepted browser loads, 9 recon loads and 6 live loads.

*Observed*: The terms, all read 2026-11-15.
- [robots.txt](https://www.ebay.com/robots.txt), version `v30.2_COM_August_2026`. The `User-agent: *` group has `Disallow: /sch/`, `Disallow: /sch/i.html?_nkw=`, `Disallow: /sch/i.html?*_nkw=*&` and `Disallow: /*_kw`. Plain `/itm/<id>`, `/str/<name>` and `/usr/<name>` are not disallowed.
- The robots.txt header says: "The use of robots or other automated means to access the eBay site without the express permission of eBay is strictly prohibited", "Automated scraping, buy-for-me agents, LLM-driven bots, … is strictly prohibited", and "Approved enterprise integrations must use our official API and comply with our API License Agreement".
- The [User Agreement](https://www.ebay.com/help/policies/member-behaviour-policies/user-agreement?id=4259) ("effective as of June 28, 2026") says you may not "use any robot, spider, scraper, data mining tools, data gathering and extraction tools, or other automated means (including, without limitation buy-for-me agents, LLM-driven bots, or any end-to-end flow that attempts to place orders without human review) to access our Services for any purpose, except with the prior express permission of eBay".

*Inferred*: eBay's edge refuses clients that look automated. A plain request and a browser that drops images both look automated, and a full page load does not. A refusal is the error page, not a challenge, so the lane counts it as `blocked`.

*Inferred*: A regional price is eBay's conversion, not the seller's price. The lane returns it in its own currency with `converted: true` and never as US cents. The US price for that id comes from its listing read on ebay.com. The "US $" text on the ebay.co.uk item page was seen but not parsed: only one page was checked and it was not recorded.

Still open:
- Registering `ebayPageAdapters` after `ebayAdapters` in `app/src/edge/api/runtime.ts`.
- The sold-search parser, which can only be tested once a signed-in page can be recorded.
- The eBay keyset, which is the real path. Its setup steps are in `app/src/edge/harness/sites/ebay/README.md`.
