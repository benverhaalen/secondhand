# Watch and alerts

Status: idea. Owner: unassigned. Packet topic: `watch`.

## What and why
Describe a fuzzy want, answer a few tap questions, and get notified when a match appears or the price drops, using Exa search monitors. Also includes the share-sheet check for whether a listing is a good deal. Ben: [words](../../product/words.md#2026-11-14-tools-and-capture).

## How it works
Not designed yet. Keep the mechanism here once research picks one, together with the reference it came from and the job that reference does.

## Decided
Nothing yet. Each entry here links to [decisions.md](../../product/decisions.md).

## Open
- How do Exa's monitors work, how fresh are they, and what do they cost?

## Research
All research for this feature: [research/watch/](../../research/watch/)
- Ben: [research/watch/ben/](../../research/watch/ben/)
- Nate: `research/watch/nate/` (none yet)
- *Agent proposal:* the search box ranks listings by price against fair value for that identity and condition, using the pricing engine, with an own index plus live fan-out and cross-listing dedupe. [one-search-box.md](../../research/watch/ben/one-search-box.md)
- *Agent proposal:* site-by-site routes, paste-a-link parsing, Lens photo search, dedupe that discounts stock photos, deal score against p25 to p75, and a 10 to 15 minute watch loop on seen-ID sets with per-site deadlines and partial results. [fanout-and-watch-loop.md](../../research/watch/ben/fanout-and-watch-loop.md)
- Ben, tech stack: [exa-alerts.md](../../research/watch/ben/exa-alerts.md). Exa Monitors find new listings at most hourly; price thresholds are our code; marketplace coverage untested, eBay Browse API as fallback.
- Ben, Exa tested live: [exa-empirical.md](../../research/watch/ben/exa-empirical.md). Exa indexes Poshmark, Depop, Mercari, Grailed and OfferUp listings with prices but none of Facebook's, few eBay items, nothing under 7 days old, and many already sold; monitor price limits are words, not numbers. Good for comps and the long tail, not for hourly watches.
