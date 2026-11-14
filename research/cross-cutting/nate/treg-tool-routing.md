# How is treg built, what does its catalogue offer for secondhand-goods data, and what should the marketplace harness adopt from its design?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: cross-cutting.

Evidence marks: *observed* (opened, URL or repo path given, source date given), *asserted* (source claims without showing), *inferred* (my reasoning), *not-found*. Catalogue numbers come from treg's unauthenticated JSON search (`https://treg.to/catalog/search?q=...`), fetched 2026-11-14; the static job pages show "live-verified" tags but no rates. Rates move daily, so every rate here expires within days.

Existing notes referred to: [openrouter-and-treg.md](../../price/ben/openrouter-and-treg.md) (Ben's earlier treg note), [comps-sources-live.md](../../price/ben/comps-sources-live.md), [platform-access.md](../../connect/nate/platform-access.md), [connect.md](../../../spec/features/connect.md), [list.md](../../../spec/features/list.md), [product.md](../../../spec/product.md) section 6.

## Answer in brief

- *observed* treg is one token (`X-Treg-Token`) in front of a catalogue of about 4,100 endpoints across about 127 providers, reachable by MCP (`https://treg.to/mcp/`), a CLI and skills, or plain HTTP `GET https://treg.to/call/<id>` (llms.txt, 2026-11-14).
- *observed* Depop, Poshmark, Mercari, Grailed, OfferUp, Vinted and StockX return zero results in the catalogue search (2026-11-14). Ben's note says the same for Poshmark, Mercari, Depop, Grailed, OfferUp (openrouter-and-treg.md, answer section) and I confirm it.
- *observed* Ben's note says treg lacks Facebook Marketplace; the catalogue lists seven endpoints for it, among them ScrapeCreators search at $0.00188 per call with ok_rate 0.9838 over 9,063 samples. I contradict that line.
- *observed* eBay has four endpoints (item detail, product, search); none shows a sold or completed filter, and there is no eBay seller endpoint.
- *observed* treg publishes measured ok_rate, hit_rate, p50, p95 and sample count per endpoint, which can seed a route table.

## 1. The request model

- *observed* A tool is named by an id such as `crawl4ai.ebay.product.detail` (provider.site.noun.verb). The agent flow is search, read, call: `treg catalog search "<job>"`, `treg catalog get <id>`, `treg call <id> --query k=v` or `--data '{...}'`; over MCP these are `catalog_search`, `catalog_get`, `call` (https://treg.to/llms.txt, 2026-11-14).
- *observed* Over HTTP a catalogue tool is `GET https://treg.to/call/<id>?key=value` with `X-Treg-Token`. A team token carries its team; a personal token also sends `X-Treg-Org`. Method, path, query and body reach the provider unchanged and the answer returns verbatim (llms.txt).
- *observed* Two kinds of id. Direct ids name one provider and do not fail over. Routed ids `treg.<capability>` (for example `treg.amazon.search.products`, `treg.google.keywords.trends`, `treg.people.email.find`) pick a provider, fall back on failure and bill only the answer returned (llms.txt; skill.md in the repo, scratchpad copy of https://treg.to/skill.md).
- *observed* Routed-call headers: `X-Treg-Route-Max-Cost`, `-Waterfall`, `-Complete`, `-Strict-Filters`, `-Prefer`, `-Quality`, `-Decisive`. The response body carries `_treg` with `served_by`, `tried` and `charged_micro` (skill.md).
- *observed* Pinning: `X-Treg-Route-Prefer` replaces every other ordering; calling a direct id pins one provider (route-rules.md, section "Where it applies").
- *observed* Errors and retries: a 4xx from the provider other than 429 is about the request, so fix it and do not retry on another provider; after a 429 or 5xx, try the next provider of the job. treg's own refusals say in the body what to do (llms.txt, Rules).
- *observed* Price before a call: `treg catalog get <id>` returns parameters, price, reliability and a ready call line (llms.txt). Cost after a call: `X-Treg-Cost-Micro` header, or `cost_usd` over MCP. `X-Treg-Route-Max-Cost` caps one call, not a loop (llms.txt).
- *observed* Prices are in micro-USD with three bases: `per_call`, `per_success`, `per_result` (docs/context/catalog.md in https://github.com/superdesigndev/treg). A repeat of an archived answer is priced at 10% and idempotency keys last 24 hours (docs/context archive notes, scratchpad grep).
- *observed* The README says there is no silent failover; skill.md and route-rules.md document routed waterfalls. *inferred* both hold: direct calls never fail over, routed `treg.*` calls do.

## 2. Success rate, speed and freshness: measured, stored, used

- *observed* Per call a `CallRecord` is written and folded into `EndpointDayStat`, one row per endpoint per UTC day. Published figures are ok_rate (2xx versus 5xx), hit_rate (the adapter's verdict that the answer held what was asked), p50 and p95 latency, last_ok_days and samples. ok_rate is null below a minimum-sample floor, `empty_is_failure` counts an empty answer as a miss, and treg's own refusals are excluded (docs/context/catalog.md, repo, 2026-11-14).
- *observed* Short-window health: a separate key-value store tracks the last minutes per child provider. It drops a failing treg-key child from the plan and moves a slow one behind the healthy ones of its credential tier; probe turns and child time bounds are set at twice p95 (catalog.md "Child guards"; route-rules.md "Where it applies").
- *observed* Route rules: a published provider order per call segment (`input_type`, `tld`, `domain_class`, contract-declared filters). Rules only reorder; every other candidate follows in the contract order. The most specific rule wins, then the earliest listed. A rule is used only when no `Prefer` header was sent, and the credential tier still sorts first (route-rules.md).
- *observed* Rules live under key `treg:route-rules:v1` in Redis as a versioned envelope (`version`, `config.enabled`, `rules[]`, at most 50 per capability, 200 in all, 32 KB). Workers refresh every 30 seconds (1 to 300) with a background read bounded at 200 ms; a plan never waits. A failed or invalid read keeps the last valid snapshot; `enabled:false` is the kill switch. Table `routeruleversion` holds every set with `review_status` (draft, approved, rejected) and `publish_status` (unpublished, pending, published, failed); a check constraint refuses publishing an unapproved version; revert saves an old config as a new version (route-rules.md "Publication contract", "Storage").
- *observed* Each routed call records `route_order` (`header`, `default`, `rule`, `quality`), `route_retry_order`, `route_rules_version` and `route_rule` in the event's `input_meta`; children join by `parent_ref` (route-rules.md "What each call records").
- *observed* Call events: off unless `TREG_CALL_EVENTS_URL` and an HMAC secret are set; emit is non-blocking with a bounded queue, batched POSTs, retries, drops; dedupe on `event_id`; one terminal event per async task; identifiers are HMAC-SHA256 pseudonyms; answer columns dropped for teams that opted out of the archive (call-events.md, scratchpad copy of docs/context/call-events.md).
- *observed* Freshness: the catalogue shows a cost "checked" date per endpoint (range 2026-07-28 to 2026-10-31 in what I sampled) and `last_ok_days`; I found no measured data-freshness figure for what an upstream returns (see Not found).
- *observed* Catalogue figures for the marketplaces I need are in section 4.

## 3. Credentials: held, injected, and the user's own key or account

- *observed* Credential ladder per call: the team's own tool, then a team key, then a free verified public route, then treg's own key billed to the prepaid balance. The team's own key always wins and is never billed. One exception: X through treg's own app is billed (llms.txt).
- *observed* The credential is injected server-side; no provider key reaches the agent's machine (llms.txt). Keys are write-only after registration, encrypted at rest with Fernet; tokens are stored as SHA-256 hashes (docs/context/auth-secrets.md, repo grep, 2026-11-14).
- *observed* A user's own OAuth account: hosted OAuth connections are registered as team tools and refreshed with an `ensure_fresh` step before a call (auth-secrets.md grep). Any call through a connected account is subject to that provider's terms (https://treg.to/terms section 05, effective 22 July 2026).
- *observed* Building treg into a product that bills its own users is allowed without a special agreement: tag each call with your customer ids, cap and invoice per customer from the ledger (llms.txt; https://treg.to/integrate.md, not read in full, unopened beyond the llms.txt summary).
- *inferred* Treg's own ladder is the structure the harness needs: the user's own account first (eBay OAuth, Depop OAuth), a paid public-data route second.

## 4. Catalogue coverage (searched 2026-11-14; price is per call unless marked)

Source for every row: `https://treg.to/catalog/search?q=<term>`, observed 2026-11-14. "no data" means the endpoint exists with no observed samples.

| Need | Endpoint (provider) | Price | ok_rate | p50 / p95 ms | n |
|---|---|---|---|---|---|
| eBay item detail (price, format, condition, stock, sold count, seller feedback, specifics, images) | `crawl4ai.ebay.product.detail` | $0.00135 per success | 0.9482 (hit 0.9998) | 7399 / 39393 | 20665 |
| eBay search (`_nkw`, `category_id`; `organic_results`) | `serpapi.x.ebay-search` | $0.015 per success | 0.7839 | 3341 / 47773 | 6077 |
| eBay product | `serpapi.x.ebay-product` | $0.015 | no data | | |
| eBay products | `brightdata.x.ebay-products` | $0.0015 per result | no data | | |
| FB Marketplace search (keyword, lat/lng) | `scrapecreators.x.v1-facebook-marketplace-search` | $0.00188 | 0.9838 | 2062 / 8877 | 9063 |
| FB Marketplace location search, item | `scrapecreators.x.v1-facebook-marketplace-location-search`, `-item` | $0.00188 each | no data | | |
| FB Marketplace item (returns sold status) | `crawl4ai.facebook.marketplace.item.detail` | $0.00135 per success | 0.9214 (hit 1.0) | 4538 / 28188 | 281 |
| FB Marketplace | `brightdata.x.facebook-marketplace` ; `anyapi.facebook.marketplace` ($0.002), `_item`, `_location_search` ($0.0012) | $0.0015 per result | no data | | |
| Amazon search | `treg.amazon.search.products` (routed, best of 2) | $0.01476 | 0.9992 | | 10291 |
| Amazon search (cheaper) | `crawl4ai.amazon.search.products` | $0.0135 | 0.9988 | 2003 / 8381 | |
| Amazon search | `serpapi.x.amazon-search` | $0.015 | 1.0 | 2628 | |
| Amazon search | `justoneapi.x.amazon-search-products-v1` | $0.01476 | 0.9999 | 4041 / 7971 | |
| Amazon search (bulk) | `dataforseo.x.merchant-amazon-products-live-advanced` | $0.0033 | 0.99 | 28363 / 81608 | 31843 |
| Amazon product detail | `treg.amazon.product.detail` (routed) $0.0148 ; `crawl4ai.amazon.product.detail` $0.00135 | | | | |
| Amazon reviews | `crawl4ai.amazon.product.reviews` | $0.00015 | | | |
| Amazon sellers | `dataforseo.x.merchant-amazon-sellers-live-advanced` ($0.0033, sellers by ASIN); `brightdata.x.amazon-sellers-info` ($0.0015 per result, by storefront URL) | | | | |
| Etsy listing search only | `crawl4ai.etsy.search.products` | $0.00015 per success | | | |
| Xianyu (Alibaba second-hand) item and search | `justoneapi.x.xianyu-get-item-detail-v1`, `-search-item-list-v1` | $0.02952 each | | | |
| Reverse image | `serper.google.serp.lens` | $0.003 | 1.0 | 2163 / 3961 | 11095 |
| Reverse image | `anyapi.google.lens` $0.00297 (ok 1.0, p50 8499, n 904); `serpapi.x.google-lens` $0.015 (ok 0.9948, p50 3414, n 2126); DataForSEO search-by-image post $0.0006 plus free task get (n 20, 114) | | | | |
| Shopping search | `serper.google.serp.shopping` | $0.002 | 0.994 | 1067 / 2195 | 58042 |
| Shopping search (cheap, poor) | `crawl4ai.google.serp.shopping` $0.00015 (ok 0.4737, n 57); `litescrape.google.serp.shopping` $0.00015 (ok 0.1557, n 238808); `litescrape.google.shopping.product` ok 0.5402 | | | | |
| Google Trends | `treg.google.keywords.trends` (routed, best of 2) | $0.0012 | 0.9901 | | 12755 |
| Google Trends | `dataforseo.x.keywords-data-dataforseo-trends-explore-live` $0.0012 (ok 0.985, p50 5399, p95 23916, n 18532); `serpapi.x.google-trends` $0.015 (ok 0.9994, p50 2414, n 14577); `dataforseo.x.keywords-data-google-trends-explore-live` $0.011; `...historical-keyword-data-live` $0.01212 | | | | |
| TikTok trend hashtags | `anyapi.tiktok.trending_hashtags` | $0.0012 | 0.9989 (hit 1.0) | 1018 | 4947 |
| TikTok ads trend hashtags | `tikhub.x.tiktok-ads-get-trends-hashtag-list` | $0.001 | 1.0 | | 436 |
| Reddit trending | `tikhub.x.reddit-app-fetch-trending-searches` $0.001; `anyapi.reddit.trending_posts` $0.0002 | | no data | | |
| Product page extraction | `diffbot.x.extract-product` | $0.001196 | 1.0 | | 65 |
| Find or verify an email (not inbox access) | `treg.people.email.find` (best of 32) $0.00095, ok 0.9501; `treg.people.email.verify` (best of 18) free line, ok 0.9715 | | | | |

Not in the catalogue (search total 0, 2026-11-14), all *observed*: Depop, Poshmark, Mercari, Grailed, OfferUp, Vinted, StockX; Outlook; barcode, UPC and GTIN lookup; Pinterest trends; Craigslist-type classifieds. For Gmail the search returned only the address-finder tools above. *not-found* inbox read as a catalogue item. *asserted* by llms.txt: a team can register its own API account or OAuth connection as a tool, which is how a Gmail connector would arrive; I did not test that.

*observed* Facebook has no per-seller listing endpoint in what I saw, and eBay has no seller endpoint; Amazon has two seller endpoints.

## 5. How an agent discovers tools, and what installing changes

- *observed* Three doors: MCP at `https://treg.to/mcp/` (bearer header or OAuth; tools `catalog_search`, `catalog_get`, `call`, `call_media`, `resources_list`, `balance`, `my_tools`, `catalog_request`, `feedback`, `review`); the CLI; and skills (llms.txt, 2026-11-14).
- *observed* A hosted assistant installs nothing and adds the MCP URL as a connector with OAuth consent where the human picks which team pays. A local coding agent runs `curl -fsSL https://treg.to/install.sh | sh`, `treg login`, `treg` (llms.txt).
- *observed* The installer puts the CLI and the treg skill into every agent it detects and names other skills without installing them; `treg skill bootstrap --skills <names>` installs more. The skill index is `https://treg.to/.well-known/skills/index.json` (returned 200, 3,432 bytes; I did not read it, unopened).
- *observed* `treg scan` lists local keys and CLIs that would be registered and sends nothing; `treg upload --select <names>` registers only the named ones (llms.txt).
- *observed* A sandboxed agent that cannot reach `https://treg.to` is told to stop and report the blocked host (llms.txt).
- *observed* When a search finds no tool (`verdict: none`), `treg catalog request "<need>"` files the need and steers what is added (llms.txt).
- *not-found* the exact files the installer writes on disk; llms.txt says "the CLI and the treg skill" without paths, and I did not run it.

## 6. Terms: retention, logging, stance on wrapped sources

- *observed* Terms, updated and effective 22 July 2026 (https://treg.to/terms): "Every call is logged: who, which tool, which method and path, the status code, and when. Team admins can see that log."
- *observed* Privacy, updated 19 October 2026, effective 22 July 2026 (https://treg.to/privacy): "We do not record request or response bodies." Kept per call: caller email, tool name, method, path, status code, timestamp. Audit records last while the owning team exists; stored answers (the archive) last while the team exists, can be deleted earlier on request, and a team admin can stop the storing; hosting logs follow the host's default window; no selling and no training.
- *observed* Archive: each provider or endpoint carries `cache: forbidden | transient | archive` with a licence quote, source URL and checked date; only the `data` kind is stored and the default is `transient` (docs/context archive notes, scratchpad grep). *inferred* the privacy line on bodies and the archive describe different layers: the call log keeps no bodies, the archive keeps answers for permitted endpoints and teams. The call-events stream can carry answer columns when its operator configures that (call-events.md).
- *observed* Stance on upstream sources: acceptable use (section 07) bars breaking "the terms, rate limits, or anti-abuse measures of any upstream API, including using treg to disguise the origin of automated traffic". Indemnity (section 13) covers claims that "calls you made violated an upstream provider's terms". The service is "AS IS"; liability is capped at the greater of 12 months of fees or US$100; Delaware law (terms page).
- *inferred* Scraped marketplace data (FB Marketplace, eBay detail via crawlers) sits with the caller for upstream terms. This connects to the eBay licence limits already read in comps-sources-live.md lines 21 to 30 (price modelling, copy and store, 6-hour age limit), which apply to eBay's own API content and not obviously to scraped pages; that note leaves the User Agreement unopened.

## 7. Maturity

- *observed* `gh api repos/superdesigndev/treg`, 2026-11-14: 8,014 stars, 741 forks, 317 open issues, Python, created 2026-07-15, last push 2026-11-14T21:56:48Z, licence field NOASSERTION.
- *observed* About 4,736 commits (last page of `per_page=1`); top contributor `stonexer` with 1,346 commits.
- *observed* Licence: Apache 2.0 plus an Additional Term barring a competing hosted service; the landing page says Apache 2.0 (LICENSE in repo; treg.to). *inferred* a harness that calls treg is not a competing hosted service, but I did not read the term's exact definition of "competing" closely enough to rule on it.
- *observed* Owner is the organisation `superdesigndev` ("Building tools for agents", created 2025-06-20, 9 public repos); llms.txt names a contact for volume terms. I sent nothing to it.
- *not-found* release count: the `gh api` output I kept was ambiguous, so I do not report one.
- *inferred* 8,000 stars in four months with a 4,700-commit history says fast churn; a route table keyed to treg ids needs to tolerate endpoints appearing and vanishing.

## Design: a route table for the marketplace harness (all of this is *inferred*)

### What treg's design teaches, in terms the harness can copy
1. Rate by day, not lifetime: one row per route per UTC day (ok, hit, p50, p95, n), with a floor below which the rate is null (treg's `EndpointDayStat`).
2. Two failure kinds: transport (5xx, 429) and verdict (answer empty or wrong). Treg counts an empty answer as failure; the route table should keep `ok` and `hit` apart.
3. A short-window guard on top of the daily rate: drop a failing route now, demote a slow one, whatever the daily figure says.
4. Rules only reorder, never delete a candidate, and never fall through on a 4xx other than 429.
5. Published versions with a review state and a kill switch; every call records which version and which rule ordered it.
6. Own-account routes sort before paid routes whatever the rate (credential tier first).

### Where the table lives on Databricks
- `route_table` in Lakebase (Postgres): the live row per `(site, verb, route_id)`, read by the harness at call time. Columns: `site`, `verb`, `route_id`, `kind` (`official_api`, `own_account`, `browser`, `treg_direct`, `treg_routed`, `other_vendor`), `unit_cost_micro`, `cost_basis` (`per_call`, `per_success`, `per_result`), `ok_7d`, `hit_7d`, `p50_ms`, `p95_ms`, `n_7d`, `short_ok` (last ~50 calls), `state` (`active`, `demoted`, `dropped`, `kill`), `last_ok_at`, `last_error_code`, `rules_version`, `seed_source` (`treg_catalog:<date>` or `measured`).
- `route_call` in Delta: one row per attempt, append-only, written by Lakeflow from the harness's events. Columns: `event_id` (dedupe key), `observation_id`, `site`, `verb`, `route_id`, `attempt_no`, `fell_back`, `ms`, `http_status`, `verdict` (`hit`, `empty`, `wrong`, `blocked`), `charged_micro`, `route_order` (`rule`, `default`, `header`), `rules_version`, `at`. Partition by day.
- `route_day_stat` in Delta: the fold of `route_call` per route per UTC day, as treg does; a Lakeflow job rewrites the Lakebase row from the last seven days every few minutes, and the short-window figures update on every call in Lakebase.
- `route_rule_version` in Lakebase: draft, approved, published, with the version number and a kill flag, copying treg's `routeruleversion`. The harness reads the published version with a bounded read and keeps its last valid snapshot on failure, the pattern in treg's route-rules.md.
- Seed: before any measured call exists, copy treg's published ok_rate, p50 and p95 into `seed_source = treg_catalog:<date>` rows (section 4), and replace them by measured values once `n` passes a floor.

### How it joins the evidence each observation records
- product.md records a `comp` with `source_route` and an `evidence` shape `{source_url, read_at, snapshot_ref, fingerprint, extractor_version, rights}` (product.md lines 59 and 103), and `candidate` rows carry `source_route` (line 101). list.md puts `route` (`api | replay | browser`) on job results and events (list.md line 165).
- Join key: `route_call.observation_id` equals the id of the `comp` or `attribute` the call produced; `route_call.route_id` equals `comp.source_route`. A price or comp can then be traced to the attempt chain that produced it: which routes failed first, the cost, `ms`, and `rules_version`.
- The user-facing `route` field widens from three values to the route_id kind plus id; the three-value field is still derivable from `kind`.
- connect.md's `account` entity already holds `route` (api or browser), `health`, `last_ok_at` and `last_error_code`; a user's own-account route reads those: `health` other than `ok` turns the own-account row for that user to `demoted` before the table's rates are consulted.
- Tenant isolation: `route_table` and `route_day_stat` hold no user data and are shared; `route_call` holds `user_id` through the observation and takes the same row-level security as the rest.

### Routing and fallback rules per site and verb
Order key, as treg: (1) the user's own-account route if `account.health = ok`; (2) the route with the best expected cost per hit, `unit_cost / (ok * hit)`, among routes with `state = active` and enough samples; (3) the rest in seed order. Fall back on 429, 5xx, timeout, or a verdict of `empty` when an empty answer is implausible for the query; never fall back on another 4xx; stop at a cost ceiling per observation and per batch (treg's `Route-Max-Cost` caps one call, not a loop). A route whose short-window ok falls under half its seven-day rate is `demoted`; two consecutive health-probe failures set `dropped`. Seed routes per cell, from section 4:

| Site, verb | Routes in seed order |
|---|---|
| eBay, active search | own eBay API (platform-access.md, eBay Browse); `serpapi.x.ebay-search` ($0.015, ok 0.78) |
| eBay, item detail | own eBay API; `crawl4ai.ebay.product.detail` ($0.00135) ; `brightdata.x.ebay-products` |
| eBay, sold | none in treg (no filter shown); comps-sources-live.md line 12 says the public sold search now needs login; use that note's routes |
| eBay, seller | none in treg; own account |
| Facebook, search | `scrapecreators.x.v1-facebook-marketplace-search` ($0.00188, ok 0.98); then the cloud browser (connect.md) |
| Facebook, item and sold status | `crawl4ai.facebook.marketplace.item.detail` ($0.00135, ok 0.92); `scrapecreators...-item`; browser |
| Depop, Poshmark, Mercari, Grailed, OfferUp, Vinted, StockX | none in treg; routes from comps-sources-live.md and platform-access.md; the table holds them with `kind = other_vendor` or `browser` |
| Amazon, search and detail | `crawl4ai.amazon.search.products` ($0.0135, ok 0.9988) or `treg.amazon.search.products` (routed); detail via `crawl4ai.amazon.product.detail` |
| Reverse image | `serper.google.serp.lens` ($0.003, ok 1.0); `anyapi.google.lens`; `serpapi.x.google-lens` |
| Shopping search | `serper.google.serp.shopping` ($0.002, ok 0.994); skip `litescrape` (ok 0.16) by rate, not by rule |
| Trends | `treg.google.keywords.trends` (routed); `anyapi.tiktok.trending_hashtags` |
| Barcode, product data | none in treg; `diffbot.x.extract-product` for a page URL only |
| Inbox | none in treg; own-account OAuth (platform-access.md, connect.md) |

*inferred* Whether to call treg's routed id or a direct id per row is a choice the table can record as two routes; routed hides the waterfall inside one call, so `fell_back` and `ms` would reflect treg's `_treg.tried` and `served_by`, which the harness should write to `route_call` as separate attempts.

### Treg endpoints worth calling directly for market data
Cost per thousand observations is price x 1,000, at the price shown (observed 2026-11-14); failed per-success calls are not billed, per-call ones are.

| Use | Endpoint | $ per 1,000 | ok_rate |
|---|---|---|---|
| FB Marketplace search | `scrapecreators.x.v1-facebook-marketplace-search` | 1.88 | 0.9838 |
| FB item and sold status | `crawl4ai.facebook.marketplace.item.detail` | 1.35 (per success) | 0.9214 |
| eBay item detail | `crawl4ai.ebay.product.detail` | 1.35 (per success) | 0.9482 |
| eBay search | `serpapi.x.ebay-search` | 15 (per success) | 0.7839 |
| Amazon search | `crawl4ai.amazon.search.products` | 13.5 | 0.9988 |
| Amazon detail | `crawl4ai.amazon.product.detail` | 1.35 | not read |
| Google Shopping | `serper.google.serp.shopping` | 2.0 | 0.994 |
| Reverse image | `serper.google.serp.lens` | 3.0 | 1.0 |
| Google Trends | `treg.google.keywords.trends` | 1.2 | 0.9901 |
| TikTok trending hashtags | `anyapi.tiktok.trending_hashtags` | 1.2 | 0.9989 |

## Contradictions with earlier notes
- openrouter-and-treg.md (answer section, and the line listing FB Marketplace as missing): treg carries FB Marketplace endpoints. Confirmed absent: Depop, Poshmark, Mercari, Grailed, OfferUp, and an eBay sold filter.
- That note's "4,100+ endpoints across 127 providers" matches llms.txt (2026-11-14); the catalogue page showed 115 platform slugs and about 127 providers.

## Not found
- A sold or completed-listings filter on any eBay endpoint; any eBay seller endpoint.
- Any treg endpoint for Depop, Poshmark, Mercari, Grailed, OfferUp, Vinted, StockX, Outlook, barcode, UPC or GTIN lookup, or inbox reading.
- A measured freshness figure (age of returned data) per endpoint; only a cost "checked" date and `last_ok_days`.
- Observed samples for most FB Marketplace item, location search, AnyAPI and BrightData endpoints, and for Reddit trending.
- The exact files install.sh writes; the repo release count; the full text of the integrate guide.
- Whether the Additional Term's "competing hosted service" covers a harness that calls treg.

## Searched / could not reach
- Reached: treg.to llms.txt, skill.md, terms, privacy, catalog pages, catalogue JSON search, the repo docs (route-rules.md, call-events.md, catalog.md, README, auth-secrets and archive greps), `gh api` repo metadata.
- Unopened: `https://treg.to/.well-known/skills/index.json`, `https://treg.to/integrate.md`, `https://treg.to/compare`, the tutorial pages.
- Catalogue rates are single-day snapshots; a narrow search term could miss an endpoint filed under another name.

## Sources fetched
- https://treg.to/llms.txt (2026-11-14)
- https://treg.to/skill.md (2026-11-14)
- https://treg.to/terms (updated 22 July 2026)
- https://treg.to/privacy (updated 19 October 2026)
- https://treg.to/catalog and https://treg.to/catalog/search?q=... (2026-11-14); job pages for ebay, amazon, etsy, xianyu, yahoo, facebook, walmart
- https://github.com/superdesigndev/treg: README.md, docs/context/route-rules.md, call-events.md, catalog.md, auth-secrets.md, archive notes; `gh api` repo, contributors and commit count (2026-11-14)
- Repo files: spec/product.md (section 6), spec/features/connect.md lines 1 to 120, spec/features/list.md, research/price/ben/openrouter-and-treg.md, research/price/ben/comps-sources-live.md, research/connect/nate/platform-access.md
