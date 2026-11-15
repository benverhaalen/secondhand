# What did the ad-mercari live runs establish?
Researched 2026-11-15 by Nate (Claude). Feature: harness, site Mercari.

*Observed*: A run of `node --no-warnings app/src/edge/harness/sites/mercari/live.ts` (query "carhartt hoodie"). It used one anonymous Browser Use Cloud browser through the kernel's `browserUseCloud` (timeout 2 min, stopped in a `finally`) and the adapter in `app/src/edge/harness/sites/mercari/adapter.ts`. Images, media and fonts were blocked. Each read waits 4 s after domcontentloaded for the page's GraphQL calls. Nothing signed in, and no challenge appeared. The seller is the seller of the first live search result; its id and username stayed in memory and were not printed. This file is not a `scripts/runs.mjs` record.

| read | count | ms (final run) | ms (run before) |
|---|---|---|---|
| connect | - | 459 | ~500 |
| search (`searchFacetQuery`) | 100 | 5406 | 5359 |
| search, sold (`itemStatuses=2`) | 100 | 5146 | 5123 |
| read one listing (`__NEXT_DATA__`) | 1 | 5801 | 5807 |
| still up | 1 | 5877 | 5982 |
| read_storefront | 1 (7 fields) | 5517 | 5606 |
| read_listings (first page) | 50 | 5161 | 5484 (14) |
| reviews (`initReviewsQuery`) | 50 | 5215 | page_changed |
| search with no hits | 0 (ok []) | 6149 | 5419 |
| terms page | - | 11189 | ~10800 |
| whole run, to stop | - | 56166 | ~55000 |

*Observed*: read_storefront returned followers, following, rating, review_count, sold_count, active_count and user_id.

*Observed*: In the run before, reviews failed as page_changed: the adapter expected the op named `user`, and the page's ops were `resolveUsername`, `cartPreviewQuery`, (unnamed), `initReviewsQuery`, (unnamed). The adapter and fixture now read `initReviewsQuery`.

*Observed*: `/us/tos/` answers a 404 page; the footer's Terms of Service link goes to `https://www.mercari.com/tos/`, whose text has no line on robots, scraping or automated means. The prohibited-conduct help page does (quoted in the harness README).

*Inferred*: Most of each read's time is the fixed 4 s wait; a wait for the named response would cut it. Two runs give timings, not a p95. Still unconfirmed: views as impressions, the sortBy value-to-label pairing, and whether a deleted item answers 404.
