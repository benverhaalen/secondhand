# bench

The open benchmark's runner and scorer ([spec/benchmark.md](../spec/benchmark.md)). Owner: the integration lead.

| Command | Does |
|---|---|
| `node bench/run.mjs` | asks our `/v1` API (in process, through the same contract layer a phone hits) every question for every item in `spec/items/manifest.json`; writes `bench/out/<run_id>/records.jsonl` and the raw answers under `raw/` |
| `node bench/run.mjs --base <url>` | the same over HTTP against a running edge, as a visitor |
| `node bench/score.mjs bench/out/<run_id>` | rows 1, 2, 3, 8 and 10 into `bench/out/<run_id>/results.json`, each number with "n of N", a Wilson 95% interval where it is a share, nearest-rank p50 and p95 for times (never an average), and the record lines behind it |
| `node --test bench/run.test.mjs bench/score.test.mjs` | the tests: 6 and 20 |

## The record

One JSON object per line, one per answer. Fixed 2026-11-15; ours and every rival's are scored by the same code with no branch on the tool.

| Field | Meaning |
|---|---|
| `run_id`, `tool` | the run and who answered (`secondhand`, or the rival's slug under `bench/rivals/<tool>/`) |
| `item_id`, `manifest_sha256` | the item, and the hash of the manifest bytes at run time: a record whose hash differs is refused |
| `question` | `search`, `product`, `value` or `delist` |
| `asked_at`, `first_at`, `full_at` | ISO UTC: asked, first results, done (null when it never came) |
| `ok`, `error` | no answer is a result: `ok: false` with the reason (`no_query`, `needs_user`, `timeout`, a §7 error code) |
| `sites[]` | the marketplaces the answer drew on |
| `facts[]` | `{kind, count}` for the twelve kinds of row 2: `sold_prices, live_listings, official_price, discounts, product_reviews, seller_reviews, demand_trend, time_to_sell, fees_per_site, you_keep, same_item_elsewhere, price_history` |
| `numbers[]` | `{name, value_cents, citation_id, evidence[]}`: row 3 counts the share with a citation or evidence |
| `range` | `{low_cents, high_cents, as_of}` or null |
| `delist[]` | `{site, sold_at, ended_at}` for question `delist`, else null |
| `raw_ref` | the saved raw answer, relative to the run folder |

A sale is used for row 7 only if it is dated after the record's `asked_at` (`saleUsable` in `score.mjs`).

## Runs

| Date | Items | Result | Why |
|---|---|---|---|
| 2026-11-15 | 10 (the skeleton manifest) | row 1 coverage 0 of 10 (Wilson 95% 0 to 0.28) | every item has no `query` yet; the item set is a row in [waiting.md](../spec/plans/waiting.md) |
