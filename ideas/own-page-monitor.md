# Our own page monitor

Raised by Ben, 23:03: "see if theres any way to create our own firecrawl monitor for our product. this is something that could be out of scope for the hackathon. but it could be something to get into the repo." ([words](../product/words.md#2026-11-14-our-own-monitor-and-a-packet-for-nate)).

**Waits on:** watch alerts working on the bought services.

## What it is

A monitor we run ourselves: load each marketplace's newest-first search page every few minutes, compare it with the listings already seen, and send a webhook for anything new. It would do the job of Firecrawl's Monitor without that product.

## Why it is later

Ben chose bought services for the demo: Firecrawl monitors, the eBay Browse API and a Facebook search API, with our own scrapers as the fallback ([decision](../product/decisions.md#2026-11-14-watch-alerts-run-on-firecrawl-the-ebay-api-and-a-facebook-search-api)).

## What already exists

- The watch loop on seen-ID sets, site by site: [fanout-and-watch-loop.md](../research/watch/ben/fanout-and-watch-loop.md#the-watch-loop).
- Calling Firecrawl's scrape through Treg on our own 5-minute job: [openrouter-and-treg.md](../research/price/ben/openrouter-and-treg.md#treg).
- The services it would replace: [monitor-alternatives.md](../research/watch/ben/monitor-alternatives.md).
- The "Plan the build for pricing, search and watch" thread is designing it now. Its design goes here.
