# What did the ad-poshmark live runs establish?
Researched 2026-11-15 by Nate (Claude). Feature: harness, site Poshmark.

*Observed*: This is a run of `node --no-warnings app/src/edge/harness/sites/poshmark/live.ts` (query "levis 501"). It used one anonymous Browser Use Cloud browser (timeout 2 min, stopped in a `finally`) and the adapter in `app/src/edge/harness/sites/poshmark/adapter.ts`. Images, media and fonts were blocked. Nothing signed in, and no challenge appeared. The closet is the seller of the first search result. Its handle stayed in memory and was not printed. This file is not a `scripts/runs.mjs` record.

| read | count | ms (final run) | ms (run before, same code bar logging) |
|---|---|---|---|
| connect | - | 459 | 477 |
| search (page state) | 48 | 2481 | 2415 |
| search, sold (`availability=sold_out`) | 48 | 1782 | 2024 |
| search, sorted (`sort_by=added_desc`) | 48 | 2755 | 1777 |
| read one listing | 1 | 1736 | 1402 |
| still up | 1 | 1321 | 1151 |
| comments | 0 | 1444 | 1268 |
| read_storefront (closet aggregates) | 1 | 1396 | 1547 |
| read_listings (closet, active and sold) | 46 | 2484 | 1919 |
| reviews (love notes) | no_route, by design | 0 | 0 |
| search with no hits | 0 (ok []) | 1362 | 1485 |
| whole run, to stop | - | 18982 | 16824 |

*Observed*: read_storefront returned followers, following, review_count, sold_count, active_count, sold_display, vacation and last_active_at.

*Observed*: Two blockers came up on the way, and the runs before them failed:
1. **The Browser Use create reply now gives `cdpUrl` as `https:`**, with keys agentSessionId, browserCost, cdpUrl, extensions, finishedAt, id, liveUrl, metadata, proxyCost, proxyUsedMb, recordingUrl, startedAt, status and timeoutAt. `app/src/edge/browser/cdp.ts` `parseBrowser` accepts only `ws:` and `wss:`, so it threw "invalid browser create reply" before any page loaded. That also explains the failed create during recon. `live.ts` resolves the https endpoint to its websocket through `/json/version`, marked as a shortcut, until the kernel accepts https.
2. **`page.content()` after domcontentloaded no longer holds `window.__INITIAL_STATE__`** (status 200, 0.7 to 0.9 MB, no state). The navigation response body holds it (2.4 to 4.4 MB). `live.ts` reads the response body.

*Observed*: In one earlier run, the sorted search hit a 30 s navigation timeout once. In total, the live runs used 6 cloud browsers and a shape probe used 1. Six were stopped. One was created but never stopped: in the run where `parseBrowser` threw, `open()` had no browser handle to stop, so that browser ran until its 2 min timeout. One run was refused by the 4 GB free-memory guard (4.0 GB free).

*Inferred*: Two runs give timings, not a p95. read_listings reads only the first page of each status.

*Not run*: The signed-in verbs (read_inbox, read_offers, read_orders, read_stats), all eight writes and `share` need a linked account, and none is linked. Their tests run on synthetic fixtures marked as such. The sources for the policy facts are in `app/src/edge/harness/sites/poshmark/README.md`.
