# Can we build our own page monitor in place of Firecrawl's, and what would it take?
Researched 2026-11-14 by Ben (Claude Code agent, thread "Plan the build for pricing, search and watch"). Feature: watch.

Ben: "see if theres any way to create our own firecrawl monitor for our product. this is something that could be out of scope for the hackathon. but it could be something to get into the repo." (thread, 23:03 UTC).

## Answer

Yes, and the core of it is now in the repo: [page-monitor/monitor.mjs](page-monitor/monitor.mjs), about 200 lines with no dependencies, with 13 passing tests in [page-monitor/monitor.test.mjs](page-monitor/monitor.test.mjs) *(observed: `node --test research/watch/ben/page-monitor/monitor.test.mjs`)*. It has never fetched a real marketplace page: this machine can't reach any, so the tests run on made-up pages. The hard part of a monitor is not in this file. It is getting the page past each site's bot checks, and that part we can keep buying.

## What a page monitor is

Firecrawl's Monitor does five things *(observed, [firecrawl.dev/monitor](https://www.firecrawl.dev/monitor), read for [monitor-alternatives.md](monitor-alternatives.md))*. Four of them are plain code. One is the business.

| Part | What it does | Hard? | Ours |
|---|---|---|---|
| Schedule | Check each page every N minutes | No | `tick()`: runs what is due; one site's monitors in turn, different sites in parallel |
| **Fetch** | **Get the live page past bot checks, with a real browser and good proxies where needed** | **Yes. This is what Firecrawl, Bright Data and Apify sell** | Passed in as a function: plain `fetch`, a scraper through Treg (`tregFetch`, not run), or a browser. Swap it per site without touching the rest |
| Extract | Turn the page into rows | Medium: breaks when a site changes its markup | `extractListings`: schema.org JSON-LD first (title, price, sold), then each site's listing-link pattern with the price that follows it |
| Diff | Compare with the last check | No, but the rules matter | `diff`: see below |
| Deliver | Signed webhook, retried | No | HMAC-SHA256 over time and body; retries after 1, 5 and 15 minutes, then set aside |

## Why ours can be better for this product than a general one

A general monitor diffs text. Ours diffs listings, so it can carry the rules the watch feature needs ([fanout-and-watch-loop.md § The watch loop](fanout-and-watch-loop.md#the-watch-loop)). Each is a test:

| Rule | Why |
|---|---|
| "New" means an id never seen before | Depop, Poshmark and OfferUp search rows carry no creation date *(observed there)* |
| The first check sends nothing | Otherwise a new watch fires dozens of alerts |
| With a price cap, alert when a listing first comes under it, once | A text diff would fire on every price change |
| With no cap, a drop means 10% under the lowest price seen, on items of $10 or more | Poshmark's own price-drop rule *(observed there)* |
| "Gone" waits for two checks in a row | A listing can fall off one page and return; Depop "reserved" items come back *(observed there)* |
| An empty page after a full one is treated as a failure, not as everything selling | A changed page or a soft block looks exactly like this |
| A bot wall is detected by its title and reported as `monitor.behind` after two misses, then `monitor.recovered` | The app can show "behind" on that site, which [spec/features/watch.md](../../../spec/features/watch.md) asks for |
| It refuses an interval under a minute | So a bug can't hammer a site |

## References and what we take

| Reference | Job | Keep | Change | Evidence |
|---|---|---|---|---|
| Firecrawl Monitor | The product we are copying | Schedule, diff against the last snapshot, JSON per check, signed webhook, the 1, 5, 15 minute retries | Diff listings, not text | observed, firecrawl.dev/monitor |
| Firecrawl's open-source repo | A fetch layer we could host ourselves | Its scrape service, if we ever want no vendor | AGPL licence: fine to run, read before we change and ship it | asserted, from memory; not opened today |
| changedetection.io | A mature open-source monitor | Its restock and price detection reads the page's own product metadata before any selector, which is why `extractListings` tries JSON-LD first | We need many listings per page; it tracks one product per page | asserted, from memory; not opened today |
| Stripe-style webhook signatures (Exa's `Exa-Signature` uses the same idea) | Delivery | Time plus body under HMAC, with a tolerance window against replays | Header named `secondhand-signature` | Exa's observed in [exa-empirical.md](exa-empirical.md); Stripe's from memory |
| camelcamelcamel | Scheduling | Check watched things more often than unwatched | We only check what someone watches | observed in [fanout-and-watch-loop.md](fanout-and-watch-loop.md) |
| The Exa live test | Evidence about extraction | Poshmark, Mercari, Grailed and OfferUp pages carried readable prices; JSON-LD gave the true sold state where Exa's summary got it wrong | Depop renders price in the browser, so it needs a browser fetch | observed, [exa-empirical.md §7](exa-empirical.md) |

## How it fits what Ben decided

The decision stands: Firecrawl, the eBay API and a Facebook API run the watches ([decisions.md](../../../product/decisions.md#2026-11-14-watch-alerts-run-on-firecrawl-the-ebay-api-and-a-facebook-search-api)). This prototype does not replace it. *Agent proposal:*

1. **For the demo,** use whichever is working first. Our monitor with Firecrawl's scrape as its fetch function (through Treg) gives the same result as Firecrawl Monitor and needs one fewer account.
2. **After the hackathon,** this is the piece worth owning. The watch rules, the seen sets and the price history are the product; the fetch is a commodity we can buy from three vendors and switch between per site.

## What is not built

- **No real page has been through it.** The per-site link patterns are the ones the Exa test matched on real URLs, but the price-after-link guess is untested on real markup. First job with network: save one newest-first page per site as a fixture and make the tests pass on them.
- **Facebook and Depop** render in the browser, so plain fetch will return a page with no listings. They need a browser fetch function or the paid APIs.
- **The schedule is a function, not a service.** Something has to call `tick()` every 30 seconds: a Lakeflow job per [spec/features/watch.md](../../../spec/features/watch.md), or a small Node process.
- **Storage** is a JSON file or memory. In the product, monitors and seen sets go in Lakebase.
- **Logging** goes through the repo logger when one is passed in (`log.call('http', ...)`), per [log/README.md](../../../log/README.md). The run loop that would create that logger isn't written.
- **Matching and dedupe** (is this the item the person wants, is it the same jacket as on eBay) stay in the watch loop, not here. The monitor only says what changed on a page.
- It lives under `research/` as a prototype, so `node .agents/check.mjs` does not run its tests. Moving it into the product is a task for the watch plan in `spec/plans/`.

## Limits

I read Firecrawl's product page, not its code. The two open-source references are from memory and marked so. The tests prove the rules above on synthetic pages; they prove nothing about any marketplace's real markup or bot checks.
