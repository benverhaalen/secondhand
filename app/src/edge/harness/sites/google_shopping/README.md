# Google Shopping

Check: `node --test --test-concurrency=1 app/src/edge/harness/sites/google_shopping/adapter.test.ts`.

Search-only source `google_shopping`, group `osint`, lane `treg`. The server composes it when `TREG_TOKEN` is nonblank. Under `node --test`, composition requires an injected fetch. No token gives `no_route` before a pace slot. Visitors may search it; concurrent requests for the same query share the planner's in-flight read.

The adapter posts `{ q, gl: 'us' }` to treg's `serper.google.serp.shopping` endpoint. The request and response shape follow the lead's single observed call on 2026-11-15 at 13:40 UTC, supplied in the worker brief. Background: [treg routing](../../../../../../research/cross-cutting/nate/treg-tool-routing.md), [treg costs](../../../../../../research/price/ben/openrouter-and-treg.md). No live call was made for this implementation. The fixture is hand-written: invented titles, product ids, prices and links; it contains no vendor response.

Each row carries `attribution: 'Google Shopping'`, the lowercased merchant in `source_site`, and `may_store: false`, `may_model: false`. Prices are USD asking prices. Dollar strings become whole cents; an unreadable price, title or link drops the card and counts as `unreadable_card`. Fields other than title, link and price are optional. The id uses `productId`, otherwise a short SHA-256 of the link. A missing merchant becomes an empty `source_site`. Only eBay, Poshmark, Depop, Mercari, ThredUp and The RealReal get `secondhand: true`.

[Finalization SR12](../../../../../../spec/plans/finalization.md#3-search-and-the-sources-lead-search) keeps these rows out of model calls, fits, durable jobs, durable stream frames, server logs and the planner's freshness cache. Live answers retain them in process for display through the existing Dupe path. The rights gate excludes them before `sameProduct`; they remain `unresolved` and outside the identity basis.

Before each call, `spend.reserve(day, usd)` reserves the `search_shopping_cost_per_call_usd` prior ($0.002) against `search_shopping_usd_per_day` ($1.00, lower guard 0). Days use UTC. `memoryShoppingSpend()` is atomic within one process; the cap resets on restart and is separate in each process. A durable cap is deferred to the kv composition. Reservations use the prior; the actual header cost is logged, without reconciling the reservation. The request also sends `X-Treg-Route-Max-Cost: 0.005`.

Every outside call uses `log.call('tool', 'google_shopping.search', …)`. Its end line has `cost_usd`, `cost_estimated`, row count, result code or drop count, and elapsed milliseconds. `x-treg-cost-micro` supplies the cost; a missing or unusable header uses the estimated prior. Query text, token, response bodies and rows stay out of those lines. Transport errors use fixed messages because thrown text can contain request headers.

A 429 returns `rate_limited`; other 4xx/5xx return `blocked` in the adapter envelope and fail this source in the search answer. Malformed JSON or a missing shopping list returns `page_changed`. An aborted search passes its signal to fetch, returns `timed_out`, and the source counts as `timeout`. No failure retries automatically. A refused daily reservation gives outcome `blocked`, code `rate_limited` and the cap name as its reason, with no fetch.

The Google redirect link is returned unchanged. Its query string participates in listing identity so different redirects stay separate. Copies of eBay listings read directly are not deduplicated against Shopping: the redirect does not give us the destination listing identity.
