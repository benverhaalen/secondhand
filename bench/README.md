# bench

The open benchmark's runner and scorer ([spec/benchmark.md](../spec/benchmark.md)). Owner: the integration lead.

| Command | Does |
|---|---|
| `node bench/run.mjs` | asks our `/v1` API (in process, through the same contract layer a phone hits) every question for every item in `spec/items/manifest.json`; writes `bench/out/<run_id>/records.jsonl` and the raw answers under `raw/` |
| `node bench/run.mjs --tool baseline` | one plain Poshmark search GET per item, using the existing reader to count cards; no harness or retries |
| `node bench/run.mjs --base <url>` | the same over HTTP against a running edge, as a visitor |
| `node bench/score.mjs bench/out/<run_id> --baseline bench/out/<baseline_run_id>` | score both runs together, tools alphabetical, with record paths relative to the primary run folder; both must use the same manifest bytes and item set |
| `node bench/score.mjs bench/out/<run_id>` | rows 1, 2, 3, 8 and 10 into `bench/out/<run_id>/results.json`, each number with "n of N", a Wilson 95% interval where it is a share, nearest-rank p50 and p95 for times (never an average), and the record lines behind it |
| `node --test --test-concurrency=1 bench/run.test.mjs` | runner checks, using injected reads without a server or browser |
| `node --test --test-concurrency=1 bench/score.test.mjs` | scorer checks, including old records and a separate baseline run |

## The record

One JSON object per line, one per answer. Fixed 2026-11-15; ours and every rival's are scored by the same code with no branch on the tool.

| Field | Meaning |
|---|---|
| `run_id`, `tool` | the run and who answered (`secondhand`, or the rival's slug under `bench/rivals/<tool>/`) |
| `item_id`, `manifest_sha256` | the item, and the hash of the manifest bytes at run time: a record whose hash differs is refused |
| `question` | `search`, `product`, `value` or `delist` |
| `asked_at`, `first_at`, `full_at` | ISO UTC: asked, first results, done (null when it never came) |
| `time_source` | `job` when times come from job stages; `poll` when measured by the runner because stage times are unavailable, or for direct answers |
| `ok`, `error` | no answer is a result: `ok: false` with the reason (`no_query`, `needs_user`, `timeout`, a §7 error code) |
| `sites[]` | the marketplaces the answer drew on |
| `facts[]` | `{kind, count}` for the twelve kinds of row 2: `sold_prices, live_listings, official_price, discounts, product_reviews, seller_reviews, demand_trend, time_to_sell, fees_per_site, you_keep, same_item_elsewhere, price_history` |
| `numbers[]` | `{name, value_cents, citation_id, evidence[]}`: row 3 counts the share with a citation or evidence |
| `reads[]` | `{site, lane, ms, outcome, rows, warm}` from `searched[]`; lanes are `plain`, `cloud_browser`, `own_browser`, `official`, `mcp`; the first read of a site in a run is cold (`warm: false`), later reads warm; repeated job snapshots count once |
| `cost` | `{browser_s, proxy_bytes, model_calls, cents}`; missing usage and unknown rates stay null; rates and source lines live in [costs.mjs](costs.mjs), with cloud time billed by started minute per read |
| `cited_facts` | count of `numbers[]` with a citation or evidence |
| `lane` | `plain` on baseline records; per-site lanes are in `reads[]` |
| `range` | `{low_cents, high_cents, as_of}` or null |
| `delist[]` | `{site, sold_at, ended_at}` for question `delist`, else null |
| `raw_ref` | the saved raw answer, relative to the run folder |

The added fields are optional when reading old records. The runner maps source lanes `public_page` to `plain` and `harness` to `cloud_browser`. Browser seconds come from browser-lane read times; proxy bytes and model calls require usage in the response’s `cost` object and otherwise remain null. An approximate account-day cost or a token price does not supply a per-read or per-call rate.

The baseline fetch is injected as `run({tool: 'baseline', fetch})`; tests use [the recorded Poshmark page](fixtures/run/poshmark.html), copied unchanged from `spec/fixtures/pages/poshmark.html`. Redirects are recorded without following them so each item makes at most one request. Missing queries produce `no_query` without a request.

## Speed rows

All are under row `8`, per tool, with nearest-rank p50 and p95, counts, samples and record references. `--baseline` adds a separately recorded run through the same scoring code.

| Row | Meaning |
|---|---|
| `first`, `full` | seconds from request to first marketplace results and to the full answer, including missing-time counts |
| `seconds_per_cited_fact` | full-answer seconds divided by `cited_facts`; zero-fact answers and missing measurements are listed separately |
| `reads_by_lane[]` | read seconds grouped by site and lane |
| `cold_warm[]` | read seconds per site for cold and warm reads |
| `cost` | cents per answer; null or absent costs are counted and listed under `unknown` |

A sale is used for row 7 only if it is dated after the record's `asked_at` (`saleUsable` in `score.mjs`).

## Runs

| Date | Items | Result | Why |
|---|---|---|---|
| 2026-11-15 | 10 (the skeleton manifest) | row 1 coverage 0 of 10 (Wilson 95% 0 to 0.28) | every item has no `query` yet; the item set is a row in [waiting.md](../spec/plans/waiting.md) |
| 2026-11-15 | 20 market items (`--set market`), in process | row 1 coverage 0 of 20 (Wilson 95% 0 to 0.16); 20 of 40 answers empty, 20 `needs_user` (valuation asks a signed-in user); row 2: 0 kinds; row 3: no numbers | the baseline before streaming search: `POST /v1/search` still reads one stub page seeded for one query (int-search-1 replaces it); command `node bench/run.mjs && node bench/score.mjs bench/out/<run_id>` |
| 2026-11-15 09:10 UTC | 20 market items, in process, real public lanes from the Mac | row 1 still 0 of 20; per item the sources answered: Poshmark a hit (48 rows for `m-clothes-2`), Depop 403 with a block marker on a plain request, Mercari blocked (needs the person's linked account), Facebook `page_changed` (title and price missing); every Poshmark row was then dropped as `unresolved`; row 8 full answer p50 2.0 s, p95 4.0 s | the search dropped rows the identity model could not judge (no model key on that machine): fixed in int-search-1 to keep and label them; Depop's public search needs the harness's browser lane |
| 2026-11-15 09:19 UTC | 20 market items, in process, real public lanes from the Mac, main at 8a7704ae | row 1 coverage 19 of 20 (Wilson 95% 0.76 to 0.99), answers drawing on 1 site (median); row 2: 1 kind of fact per item (live listings); row 3: 912 of 912 numbers carry evidence (each listing's URL); row 8 first answer p50 2.0 s, full answer p50 2.0 s and p95 4.0 s | Poshmark answers on a plain request; Depop moves to its harness lane, Mercari needs the person's account, Facebook and eBay are not built yet. Times are only as fine as the runner's 2 s poll of `GET /v1/jobs/:id`: the next runner reads the job's own frame times |
| 2026-11-15 09:23 UTC, with the plain-request baseline at 09:24 | 20 market items each, main at 896a4d68 | ours: row 1 coverage 15 of 20 (Wilson 95% 0.53 to 0.89); first answer p50 2.0 s, p95 12.0 s; full answer p50 2.0 s, p95 4.0 s; per-site read inside the search: Poshmark p50 0.99 s, p95 2.05 s (plain), Depop 0.58 s to a block, Facebook 0.86 s to page_changed, Mercari blocked at once (needs the person's account). Baseline (one plain GET of Poshmark search, cards counted): 17 of 20 (0.64 to 0.95), 0.67 s p50, 0.86 s p95 | the baseline beats us on both rows today. Why: our Poshmark reader returns page_changed on 5 items whose page the baseline counted cards from (strict reader), and our times are rounded up to the runner's 2 s poll (being changed to the job's own stage times). Cost per answer: unknown (only the cloud-browser rate is written down, product/numbers.md:78) |
| 2026-11-15 09:26 UTC | 20 market items, in process, real lanes, times from the job's own stage clocks (`time_source: job`) | row 1 coverage 19 of 20 (Wilson 95% 0.76 to 0.99), Poshmark only; row 8 first answer p50 0.79 s, p95 2.08 s; full answer p50 2.07 s, p95 2.88 s | the 09:23 first-answer p50 of 2.0 s was the runner's poll. Coverage moves between runs (15 to 19 of 20) with how often Poshmark's page trips its strict reader. The plain baseline at 09:24 answered first at 0.67 s p50 |
| 2026-11-15 09:31 UTC | 20 market items, in process, real lanes, job clocks, main with the reader keeping whole cards (c0e639f4) | row 1 coverage 14 of 20 (Wilson 95% 0.48 to 0.85), Poshmark only; row 8 first answer p50 1.54 s, p95 3.34 s; full p50 2.27 s, p95 3.34 s | Poshmark answered a hit on 14 items and on 5 a page with no listing card at all (id, title, price and url all missing), which the reader calls page_changed: the items change from run to run (m-small_goods-2 hit here, missed at 09:23), so Poshmark is intermittently serving a page without listings, not a new layout. Coverage now swings 14 to 19 of 20 across four runs on that alone |
