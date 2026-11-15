# Does eBay serve its public pages to the harness?
Researched 2026-11-15 by Nate (Claude). Feature: harness, site eBay, page lane.

No. Every public page we asked for came back as 403, both from a plain request and from a Browser Use Cloud browser, so the page lane was not built. The lane exists by Nate's decision of 2026-11-15, "read ebay pages anyway" (`product/words.md`), and the official API replaces it the day keys exist.

*Observed*: A plain request (curl with a Chrome 142 User-Agent, `Accept: text/html`, `Accept-Language: en-US`) got 403 for `https://www.ebay.com/sch/i.html?_nkw=levis+501` and for the same URL with `&LH_Sold=1&LH_Complete=1`. Each reply was 1,739 bytes and took about 110 ms. So a plain request is not served.

*Observed*: `node --no-warnings app/src/edge/harness/sites/ebay/recon.ts <scratch-dir>` ran one Browser Use Cloud browser (US proxy, 2-minute timeout, `solveCaptchas: false`, images, media and fonts blocked). It connected in 519 ms. Then, in order:

| Page | Status | Bytes | ms |
|---|---|---|---|
| search | 403 | 1,892 | 504 |
| sold search | 403 | 1,892 | 394 |
| zero-result search | 403 | 1,892 | 356 |
| `/itm/100000000001` (expected 404) | 403 | 1,892 | 317 |

The browser was stopped 2,578 ms after the start. No search page loaded, so no item id was found, and the listing, ended-listing and storefront pages were never visited.

*Observed*: Every 403 was the same page, titled "Error Page | eBay": "SORRY Something went wrong on our end", with a reference id. It is not a captcha and not a challenge (the `CHALLENGE` regex did not match). We did not retry, change the browser or proxy, or click anything.

*Observed*: Page loads for the whole session: 2 terms documents (robots.txt and the User Agreement), 2 plain marketplace requests and 4 browser loads, 8 in total, against a budget of about 20.

*Observed*: The terms, all read 2026-11-15.
- [robots.txt](https://www.ebay.com/robots.txt), version `v30.2_COM_August_2026`. The `User-agent: *` group has `Disallow: /sch/`, `Disallow: /sch/i.html?_nkw=`, `Disallow: /sch/i.html?*_nkw=*&` and `Disallow: /*_kw`. Plain `/itm/<id>`, `/str/<name>` and `/usr/<name>` are not disallowed.
- The robots.txt header says: "The use of robots or other automated means to access the eBay site without the express permission of eBay is strictly prohibited", "Automated scraping, buy-for-me agents, LLM-driven bots, … is strictly prohibited", and "Approved enterprise integrations must use our official API and comply with our API License Agreement".
- The [User Agreement](https://www.ebay.com/help/policies/member-behaviour-policies/user-agreement?id=4259) ("effective as of June 28, 2026") says you may not "use any robot, spider, scraper, data mining tools, data gathering and extraction tools, or other automated means (including, without limitation buy-for-me agents, LLM-driven bots, or any end-to-end flow that attempts to place orders without human review) to access our Services for any purpose, except with the prior express permission of eBay".

*Inferred*: The 403 comes from eBay's edge and is aimed at automated clients or datacenter and proxy addresses, not at the pages themselves. Both of our clients were refused, including on `/itm/`, which robots.txt allows. A person's own browser was not tried.

*Observed*: The kernel now moves to the next route on `no_route` (commit cec06fba, test in `app/src/edge/harness/protocol.test.ts`). A page route can therefore sit behind the API route once one can be built.

Still open:
- Whether to build the page lane on some other access. That is Nate's call: getting around this 403 means routing around a block.
- The eBay keyset, which is the real path. Its setup steps are in `app/src/edge/harness/sites/ebay/README.md`.
