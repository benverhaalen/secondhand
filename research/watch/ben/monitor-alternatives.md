# Is there a better monitor than Exa's for catching fresh marketplace listings?
Researched 2026-11-14 by Ben (Claude Code agent, thread "Plan the build for pricing, search and watch"). Feature: watch.

Ben: "see if there are any better exa monitors" (project chat, 21:25 UTC). The live test in [exa-empirical.md](exa-empirical.md) showed Exa's monitors miss fresh eBay and Poshmark listings and return no Facebook pages. This note asks two things: can Exa be set up to do better, and does another service do the job. Nothing here was run; every row is the vendor's own page read today, so each needs a smoke test.

## Draft answer before searching, and whether it changed

Draft: no hosted monitor covers marketplaces within minutes, so we poll each site ourselves. It changed. A page-watching monitor pointed at each site's newest-first search page does the polling for us, and a paid Facebook Marketplace search API fills the Facebook gap.

## Can Exa itself do better?

No setting fixes it *(inferred from the rows below)*.

| Exa feature | What the docs say | Evidence |
|---|---|---|
| Search monitors (the feature in Ben's link) | "The minimum interval is one hour", and a run "may be delayed by up to 30 minutes". `search` takes a query, `numResults`, domains and `contents`; "No other Search options are accepted", so no live-crawl or date option | observed, [monitors guide](https://exa.ai/docs/reference/monitors-api-guide) |
| Websets monitors | A cron schedule that "must trigger at most once per day". Finds new items for a list; a `refresh` run type exists but is not described | observed, [create a monitor](https://exa.ai/docs/websets/api/monitors/create-a-monitor.md) |

The limit is Exa's index, which held marketplace pages 18 days old at best in our test *(observed, [exa-empirical.md](exa-empirical.md))*. A monitor can only return what the index has.

## Other services

| Service | What it is | Fastest check | Fits our need? | Evidence |
|---|---|---|---|---|
| **Firecrawl Monitor** | Watches a URL on a schedule, "diffs every check against the last", extracts a JSON schema from the page on every check, sends signed webhooks (`monitor.page`), retries failed deliveries | "As often as every 5 minutes" | **Yes, as the watch loop.** Point one monitor at each site's newest-first search URL for a want (Poshmark `sort_by=added_desc`, Mercari `sortBy=created_time`, eBay `_sop=10`, and so on) with a schema of `{id, title, price, url}`. It fetches the live page, so freshness is the check interval, not an index | observed, [firecrawl.dev/monitor](https://www.firecrawl.dev/monitor). Whether it gets past each marketplace's bot checks is untested |
| **eBay Browse API** | Official search with `sort=newlyListed` and `itemCreationDate` | our own poll, every few minutes within 5,000 calls a day | **Yes, for eBay.** Free and the most reliable route | observed, eBay docs via [fanout-and-watch-loop.md](fanout-and-watch-loop.md) |
| **ScrapeCreators Facebook Marketplace API** | `GET api.scrapecreators.com/v1/facebook/marketplace/search` and an item lookup, JSON, one credit per call; 25,000 credits for $47 | our own poll | **Yes, for Facebook**, the site Exa can't see at all. It returns data and sends no alerts, so we poll it | observed, [ScrapeCreators blog](https://scrapecreators.com/blog/facebook-marketplace-alerts), written by the vendor |
| Apify actors on a schedule | A Facebook actor with Discord alerts, "no login required"; schedule plus webhook on any actor | Apify's scheduler, about a minute | Yes, as the fallback per site. Latency adds run start time | observed, [raidr-api actor](https://apify.com/raidr-api/facebook-marketplace-scraper) (15 monthly users) |
| Parallel Monitor API | Same idea as Exa's: a query, an index, events by webhook, domain filter | "1h" is the shortest value shown | No better than Exa on the evidence; nothing says it crawls live | observed, [docs.parallel.ai/monitor-api](https://docs.parallel.ai/monitor-api) |
| eBay Feed API | Hourly feed files per category | hourly | No: "(Limited Release) API available only to select developers" | observed, [eBay Feed overview](https://developer.ebay.com/api-docs/buy/feed/overview.html) |
| Flipify, Swoopa, Outpost and similar apps | Consumer alert apps. Flipify "monitors Mercari every minute" and Facebook every minute on its $10 plan; Swoopa states a 47-second average alert speed | 1 minute or less | **Not usable in our app**: push and SMS only, no API or webhook on their pages. They are proof that minute-level alerts on these sites are possible, and they are the bar | observed (their own pages; speeds asserted), [Flipify](https://www.flipifyapp.com/mercari-alerts), [Swoopa](https://getswoopa.com/), [Outpost comparison](https://outpostalerts.com/blog/best-facebook-marketplace-alert-apps) |

## Recommendation (agent proposal)

Buy the watch loop instead of writing seven scrapers:

1. **Poshmark, Mercari, Depop, Grailed, OfferUp:** one Firecrawl monitor per want and site on the newest-first search URL, every 5 minutes, webhook to our backend.
2. **eBay:** the Browse API, polled every 5 minutes.
3. **Facebook:** the ScrapeCreators search API, polled every 5 to 10 minutes.
4. **Everything else on the web:** one open-web Exa monitor per want, hourly, which is the job it did well in the test.
5. Our code keeps what no service does: the price cap, the match score, the seen set, one alert per item, and the re-fetch before alerting ([fanout-and-watch-loop.md](fanout-and-watch-loop.md#the-watch-loop)).

That makes the promise "within 10 minutes" in place of "within the hour". Our own adapters and Apify actors stay as the fallback for any site Firecrawl can't load.

**Check first (about 30 minutes):** create one Firecrawl monitor on a Poshmark newest-first URL and one on eBay's, list a test item, and time the webhook. Call ScrapeCreators once for a Madison search. Both need keys Ben doesn't have yet.

## Limits

I searched for monitoring and alert APIs, read eight vendor pages, and ran none of them. Firecrawl's page does not say it handles marketplace bot checks. I did not look at Bright Data, Oxylabs or Browser Use scheduled tasks, which could do the same job as Firecrawl. Speeds quoted for the consumer apps are their own claims.
