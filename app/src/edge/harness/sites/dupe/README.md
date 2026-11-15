# Dupe.com: a search-only source

Dupe.com is a shopping search that returns new and secondhand listings from many shops for one query. Behind it is Google Shopping and Bing results, served through searchapi.io. It publishes an MCP server at `https://mcp.dupe.com/mcp` that needs no key, account or OAuth ([agent.txt](https://dupe.com/agent.txt), updated 2026-11-11). This module uses that server and nothing else. It never touches Dupe's web pages or `api.dupe.com`.

Route: `dupe.search.api`. Only `search` has a route. Every other verb answers `no_route` with the reason "search-only".

Dupe is not a `Site`. Adding it to `SITES` would ripple through 49 `Record<Site, …>` files, so this module stands on its own. Its blocked hint is `{ do: 'pause_session', site: 'dupe' }`, and every other hint uses the protocol's shape.

## The licence

From [dupe.com/legal/terms](https://dupe.com/legal/terms), §13, read 2026-11-15: "we grant you a limited, revocable, non-exclusive, non-transferable license to call our developer interfaces to search our catalog and display results to your end users." §14 bars scraping.

## Dupe's conditions, and where each is enforced

| Condition (terms §13 unless noted) | Enforced by | Test |
|---|---|---|
| Keep links and their tracking parameters as returned | `toRow` copies `link` byte for byte and accepts only `https://dupe.com/…` links | "rows carry the link exactly as Dupe gave it" |
| Disclose that the links are commercially compensated | every row has `commercial_link: true` | the same row-shape test |
| Attribute results to Dupe.com | every row has `attribution: 'Dupe.com'` | the same row-shape test |
| Do not store results longer than permitted | No period is published, so `keep_until` is the request time, on each row and on the result. A caller may show the rows, but should not keep them past `keep_until`. agent.txt says "cache what you retrieve; prices refresh on the order of hours", and the terms win over that until Dupe states a period. | "keep_until is the request time" |
| Respect the rate limits they publish or apply | None is published. Our own pace is conservative: one search at a time, starts at least `MIN_GAP_MS` = 3000 ms apart (at most 20 a minute), with one session reused. A 429 or 503 becomes `rate_limited` and honours Retry-After. | "searches run one at a time…", "429 is rate_limited…" |
| Identify the agent honestly (agent.txt) | User-Agent `secondhand-client/0.1`, which is generic and carries no contact details | "speaks MCP…" |
| Show the price and the retailer, and say prices are indicative (agent.txt). Do not present results as independent verification. | Every row carries `price_cents`, `currency` and `source_site`. The disclaimer is the screen's job. | (row shape) |

## Errors

| Dupe does | We answer |
|---|---|
| 429 or 503 | `rate_limited`, `after_s` taken from Retry-After (seconds or an HTTP date; 60 if absent) |
| 401, or 403 with `www-authenticate` | `no_route`, handoff to dupe.com. The server is published as keyless, so a credential demand is a change for Nate to decide on. |
| any other status ≥ 400, an HTML page, or a tool error that refuses | `blocked` |
| a 404 on the session | one re-initialize, then `blocked` |
| the search tool's input schema changes, it disappears, it rejects our arguments, or the reply does not parse | `page_changed`, `missing: ['search_products_by_text']` |
| a missing or blank `q`, or an unknown category | `policy_refused`, `missing_input`, with nothing sent |

A row whose price is not a safe whole number of cents (`extracted_value` missing, a string, 12.345 or 1e17), or that has no title, link, source or currency, is dropped and counted in `dropped`.

The log holds one `http` call per request, with the method and category and, for each search, the row and drop counts. It never holds the query text.

## Probe coverage (2026-11-15, 8 searches before the code, 3 live after)

The probe made 7 specific, item-level searches, each with a category. Each returned 40 rows, 280 in total, and 120 of them were flagged secondhand:

| Query (category) | ms | Secondhand rows | Sources |
|---|---|---|---|
| levi's 501 original fit jeans 32x32 medium wash (Fashion) | 2874 | 25 | Poshmark 12, Depop 7, eBay 6 |
| nike air force 1 '07 white mens 10 (Fashion) | 2193 | 14 | eBay 9, Poshmark 5 |
| herman miller aeron size b graphite (Furniture) | 5414 | 22 | eBay 20, Chairish 2 |
| iphone 13 128gb midnight unlocked (Electronics) | 1383 | 9 | eBay 8, Poshmark 1 |
| carhartt detroit jacket j97 brown large (Fashion) | 3699 | 17 | Etsy 9, eBay 4, Poshmark 3, Depop 1 |
| lululemon align high rise pant 25 black size 6 (Fashion) | 2953 | 25 | eBay 21, Poshmark 4 |
| kitchenaid artisan 5 quart stand mixer empire red (Electronics) | 1431 | 8 | eBay 8 |

The eighth search sent a bad argument on purpose, to record the validation error. No 429 and no rate-limit headers were seen, and no Mercari row appeared. The Google Shopping rows named "Ebay" come back with `secondhand: false`, so Dupe's flag undercounts eBay. We keep the flag as given.

`fixtures/` holds the trimmed recordings: `initialize.sse`, `tools-list.sse` (the search tool's schema in full) and `search.sse` (6 of the 40 levi's 501 rows).

Run: `node --test --test-concurrency=1 app/src/edge/harness/sites/dupe/adapter.test.ts`. The live run is `node app/src/edge/harness/sites/dupe/live.ts`, and its timings are in [ad-dupe.md](../../../../../../research/cross-cutting/nate/runs/ad-dupe.md).

Not built: Dupe's URL and image search tools, and `get_product_details`.
