# What did the ad-dupe live run establish?
Researched 2026-11-15 by Nate (Claude). Feature: harness, source Dupe.com (search-only).

*Observed*: This is one run of `node app/src/edge/harness/sites/dupe/live.ts` against `https://mcp.dupe.com/mcp`, using the adapter in `app/src/edge/harness/sites/dupe/adapter.ts`. It sent no key and no account, and identified itself with the User-Agent `secondhand-client/0.1`. It made 3 searches, each a category-filtered or `all` query, paced at least 3000 ms apart over one MCP session. The ms below come from the log's `call.end` lines, and `node spec/log.mjs` reported "log follows the contract". This file is not a `scripts/runs.mjs` record.

| call | rows | dropped | secondhand | ms |
|---|---|---|---|---|
| initialize | - | - | - | 765 |
| notifications/initialized | - | - | - | 273 |
| tools/list (schema check passed) | - | - | - | 66 |
| search "patagonia better sweater", Fashion | 40 | 0 | 1 (eBay) | 2624 |
| search "herman miller sayl", Furniture | 40 | 0 | 0 | 3574 |
| search "nintendo switch oled", all | 40 | 0 | 0 | 1773 |

*Observed*: Earlier the same day, before the code, the probe made 7 specific item-level searches, each with a category (40 rows each, 1383 to 5414 ms). 120 of those 280 rows were flagged secondhand: Poshmark, Depop, eBay, Etsy and Chairish. The counts are in the [README](../../../../app/src/edge/harness/sites/dupe/README.md#probe-coverage-2026-11-15-8-searches-before-the-code-3-live-after). No 429, no rate-limit header, no challenge and no auth demand was seen in any of the 11 searches.

*Inferred*: How many secondhand rows come back depends on the query. Specific item-level queries (size, colour, model) returned 8 to 25 secondhand rows out of 40. The broad live queries returned 0 or 1, because new retail fills the top 40. So the search plan should send Dupe the specific item query, not a short one. The search's `secondhand` flag also misses Google Shopping eBay rows (they come back as "Ebay", `secondhand: false`), so a caller that filters on the flag loses some eBay listings.

*Inferred*: Three searches give timings, not a p95. A cold first search costs about 1.1 s of session setup on top of the search.
