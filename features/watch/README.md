# Watch and alerts

Status: idea. Owner: unassigned. Packet topic: `watch`.

Spec (agent proposal): [spec/features/watch.md](../../spec/features/watch.md).

## What and why
Describe a fuzzy want, answer a few tap questions, and get notified when a match appears or the price drops, using Exa search monitors. Also includes the share-sheet check for whether a listing is a good deal. Ben: [words](../../product/words.md#2026-11-14-tools-and-capture).

## How it works
Not designed yet. Keep the mechanism here once research picks one, together with the reference it came from and the job that reference does.

## Decided
- Alerts for the big marketplaces run on Firecrawl page monitors, the eBay Browse API and a Facebook search API, checked every 5 to 10 minutes; Exa covers the rest of the web. Ben, [decisions.md](../../product/decisions.md#2026-11-14-watch-alerts-run-on-firecrawl-the-ebay-api-and-a-facebook-search-api).

## Open
- How do Exa's monitors work, how fresh are they, and what do they cost?

## Research
All research for this feature: [research/watch/](../../research/watch/)
- Ben: [research/watch/ben/](../../research/watch/ben/)
- Nate: [research/watch/nate/](../../research/watch/nate/)
- Nate: [buyer-side-actions-and-affiliate.md](../../research/watch/nate/buyer-side-actions-and-affiliate.md). Which buyer actions an app can take through official APIs, under what terms, and which affiliate programmes pay; eBay has restricted watch and offer calls.
- Nate: [new-listing-detection.md](../../research/watch/nate/new-listing-detection.md). Fastest reliable ways to learn of a new matching listing on seven sites, with freshness and cost against Firecrawl change monitors.
- *Agent proposal:* the search box ranks listings by price against fair value for that identity and condition, using the pricing engine, with an own index plus live fan-out and cross-listing dedupe. [one-search-box.md](../../research/watch/ben/one-search-box.md)
- *Agent proposal:* site-by-site routes, paste-a-link parsing, Lens photo search, dedupe that discounts stock photos, deal score against p25 to p75, and a 10 to 15 minute watch loop on seen-ID sets with per-site deadlines and partial results. [fanout-and-watch-loop.md](../../research/watch/ben/fanout-and-watch-loop.md)
- Ben, tech stack: [exa-alerts.md](../../research/watch/ben/exa-alerts.md). Exa Monitors find new listings at most hourly; price thresholds are our code; marketplace coverage untested, eBay Browse API as fallback.
- Ben, Exa tested live: [exa-empirical.md](../../research/watch/ben/exa-empirical.md). Exa indexes Poshmark, Depop, Mercari, Grailed and OfferUp listings with prices but none of Facebook's, few eBay items, nothing under 7 days old, and many already sold; monitor price limits are words, not numbers. Good for comps and the long tail, not for hourly watches.
- *Agent proposal:* no Exa setting makes its monitors fresh (hourly at best, daily for Websets). A Firecrawl monitor on each site's newest-first page (every 5 minutes), the eBay Browse API and a paid Facebook search API can run the watch loop; Exa keeps the long tail. Untested. [monitor-alternatives.md](../../research/watch/ben/monitor-alternatives.md)
- Ben, harness from repos: [ai-harness-from-repos.md](../../research/cross-cutting/ben/ai-harness-from-repos.md#2-decision-questions-the-jev-lessons). *Agent proposal:* rules first, the model only on the uncertain listings, at most 20 per request, cached by want, listing and how much evidence was read (ai-marketplace-monitor, depop-scraper, pg-jev).
