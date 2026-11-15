# How do Firecrawl, crawl4ai, browser-use and jev-ultrafast serve our own intelligence API, and what do we take from each?
Researched 2026-11-14 by Nate (Claude Code, Opus 5.5). Feature: data.

Asked in Nate's [words](../../../product/words.md#2026-11-14-nate-our-own-intelligence-api-from-four-repos). Each repo was read at the source through the GitHub API on 2026-11-14; paths below are inside each repo at its default branch on that date. The design this feeds is [the intelligence API engine](../../../spec/engines/intelligence-api.md).

## Answer

None of the four is an intelligence API. Each is one layer of one, and each is the best open layer we found for its job (*inferred*):

| Layer | Best taken from | What we take |
|---|---|---|
| Fetch | Firecrawl | the hedged engine waterfall, the index-first read with a max age, the negative cache, the product transformer's "null is not a failure" contract |
| Extraction | crawl4ai | a schema written once by a model, validated and refined against the page, then run with no model; the CSS, XPath and regex strategies |
| Stopping and coverage | crawl4ai | the adaptive crawler's confidence, saturation and gain rule |
| Politeness and freshness | crawl4ai | the per-domain rate limiter with backoff on 429 and 503; ETag and Last-Modified validation; the layered block detector |
| Signed-in and hard pages | browser-use | the code-as-action loop with per-cell deadlines, the delivery check, the judge with `gotchas`, cloud profiles per site |
| Small typed decisions | jev-ultrafast | code builds the choices, the model returns a validated distribution, code confirms; one request carries every head |

What none of them has, and we build: a typed catalogue of question kinds with a protocol per kind, a guarded number that hides until a basis is met, a gather-more loop when it is not, a measured registry of routes with `right_90d`, and per-kind time budgets (*inferred* from reading all four).

## 1. Firecrawl

AGPL-3.0, 201830 stars on 2026-11-14 (*observed*, https://github.com/firecrawl/firecrawl).

- **Hedged waterfall.** `apps/api/src/scraper/scrapeURL/index.ts` lines 900 to 1000: engines run in order; when one passes its "max reasonable time" plus a delay, the next starts in parallel, `Promise.race` takes the first good result, and the losers are stopped. The whole scrape has a 300000 ms ceiling (*observed*, source date 2026-11-14).
- **Engine order and the index first.** `engines/index.ts`: the index engine has quality 1000 and is tried first; then wikipedia, fire-engine, playwright, fetch, pdf by feature fit (*observed*).
- **Index max age and negative cache.** `engines/index/index.ts` near line 262: a default `maxAge` of 2 days, and a cached "this URL failed" so a known-bad page is not refetched (*observed*).
- **Search fallback.** fire-engine, else SearXNG, else DuckDuckGo; 5 results and a 5000 ms timeout by default (*observed*, the API's search code).
- **Transformers.** deterministicJson (211 lines), product (93 lines), diff (246 lines), llmExtract and a prompt-injection guard (*observed*, `apps/api/src/scraper/scrapeURL/transformers/`).
- **"Not a product" is a value.** `transformers/product.ts` lines 74 to 87: the contract is `{product: Product | null}`; null means the page is not a product, while a malformed body is a service failure (*observed*). This is the rule our "not found" follows: a typed, evidenced state, never an error.
- **Self-host.** The open default runs Playwright and plain fetch; fire-engine (stealth and TLS client) is the hosted part (*observed*, the self-host docs in the repo).

AGPL means a modified Firecrawl served over a network must publish its source; running it unmodified as a separate service is a route like any other (*inferred* from the licence text). We port the patterns into our own fetch layer and keep Firecrawl itself as a measured route.

## 2. crawl4ai

Apache-2.0, 87361 stars (*observed*, https://github.com/unclecode/crawl4ai).

- **Strategies.** `crawl4ai/extraction_strategy.py`: JsonCss, JsonXPath, JsonLxml, Regex, LLMExtractionStrategy, Cosine (*observed*).
- **Schema once, model once.** `generate_schema(html | url, schema_type CSS | XPATH, query, target_json_example, validate=True, max_refinements=3)` at lines 1692 to 1720: a model writes a CSS or XPath schema, it is run against the page and refined up to three times, and later pages of the same template extract with no model (*observed*).
- **Adaptive stopping.** `crawl4ai/adaptive_crawler.py`, `AdaptiveConfig` at line 154: confidence_threshold 0.7, max_pages 20, top_k_links 3, min_gain_threshold 0.1, saturation_threshold 0.8, consistency_threshold 0.7; confidence weights coverage 0.4, consistency 0.3, saturation 0.3; link score relevance 0.5, novelty 0.3, authority 0.2 (*observed*). `should_stop` at line 527 stops on confidence, max pages, no links left, or saturation (*observed*). `_calculate_saturation` at line 396 is 1 minus the recent rate of new terms over the initial rate (*observed*).
- **Cache modes and validation.** `cache_context.py`: ENABLED, DISABLED, READ_ONLY, WRITE_ONLY, BYPASS. `cache_validator.py`: FRESH, STALE, UNKNOWN, ERROR, where ERROR falls back to the cache; it sends If-None-Match and If-Modified-Since and expects a 304, then compares a fingerprint of about 5 KB of head meta tags (*observed*).
- **Dispatch.** `async_dispatcher.py`: a per-domain `RateLimiter` with base_delay (1.0, 3.0), max_delay 60 and retry codes [429, 503]; a memory-adaptive dispatcher with a priority queue and anti-starvation; a semaphore dispatcher (*observed*).
- **Block detection.** `antibot_detector.py`: any 403 or 503 with HTML is blocked; tier 1 structural markers (an Akamai "Reference #"), tier 2 generic terms on short pages, tier 3 empty shells. Its comment: "false positives are cheap (the fallback mechanism rescues them), false negatives are catastrophic" (*observed*).
- **Seeding.** `async_url_seeder.py` scores sitemap and head metadata with BM25 before any page is crawled (*observed*).
- **Server.** `deploy/docker/` has a crawler pool, governor, LLM broker, MCP bridge, egress proxy, jobs, webhooks and a work queue (*observed*, file names only).

## 3. browser-use

MIT, 121039 stars (*observed*, https://github.com/browser-use/browser-use).

- **Code as action.** `loop.py` line 168: the agent's main tool runs Python in a persistent REPL with CDP helpers; each cell has a deadline, a cell never runs into the delivery turn, and the fast mode gets 10 s of grace (*observed*).
- **Delivery check.** `check_delivery` at `loop.py` line 245 repairs once when the structured result is a placeholder or empty; its comment records a model sending `finish({"authors": []})` while 34 authors sat in the REPL (*observed*). Completion is checked by code, as in jev-ultrafast.
- **Agent shape.** `agent/service.py` line 220: `Agent(task, llm, browser, output_model_schema, sensitive_data, mode, web_search, judge=True, judge_context)`; the default LLM is the vendor's fast model and the default browser is its cloud (*observed*).
- **Judge.** `judge.py` line 53: success, failure_reason, description, prompt_injection_detected, bot_block_or_captcha_detected, and up to 5 `gotchas` for the next run (*observed*).
- **Search.** `search.py`: one hosted search per call with a `charge_usd` per search (*observed*).
- **Accessibility tree.** `ax.py`, 868 lines of helpers (*observed*).
- **Cloud profiles.** The cloud sessions doc: `profile_id` and `proxy_country_code`; a profile keeps cookies, localStorage and passwords, one per user or per site; `sessions.stop()` saves state; refresh profiles older than 7 days; keep one proxy country per profile (*observed*, docs in the repo, source date 2026-11-14).

## 4. jev-ultrafast

MIT (*observed*, https://github.com/browser-use/jev-ultrafast).

- **Choices built by code.** `jev_ultrafast/model.py` lines 48 to 78: one index per observed element, each operation with its own valid targets (*observed*).
- **One request, every head.** Lines 81 to 148: one request asks the operation and a target head per operation; only the head for the chosen operation is used (*observed*); `design.md` says this "avoids serial operation-then-target calls" (*observed*).
- **Validation.** Lines 30 to 45: the choice must be in the set, probabilities must cover exactly the set, be finite in [0, 1], sum to 1 within 0.02, and the chosen one must be the maximum, or nothing runs (*observed*).
- **Text only where text is needed.** Lines 160 to 198: a small LLM writes a field value as JSON with exactly one `text` key, at most 2000 characters, or nothing is typed (*observed*).
- **Bounds and done.** `design.md`: 60 actions, 120 decisions, 250 candidates per run; "Independent checks, rather than the model's DONE choice, determine whether the demonstrated task succeeded" (*observed*).
- **Speed.** `performance.md`: 7.073 s against 9.450 s on its comparison, a median decision latency of 178 ms, p=0.25 (*observed*). The difference is not significant at that p (*inferred*), so we budget from our own traces.

## 5. Where this sits against the prior notes

- Confirms [port-web-intake-and-browsers.md](port-web-intake-and-browsers.md) line 28 (Firecrawl AGPL, about 201.8k stars) and line 27 (crawl4ai Apache-2.0) (*observed*).
- Extends line 59 of the same note, which calls Firecrawl the heaviest port: we port its patterns into our fetch layer and keep the service as a route, so its weight is not ours (*inferred*).
- Extends line 56 (browser-use as the browser layer) with the code-as-action loop, the delivery check and the judge, none of which that note describes (*observed* above).
- Leaves line 67 open: whether Firecrawl's monitors are in the open core. The open repo has a `diff` transformer for change tracking (*observed*); the monitor scheduler was not found in it (*inferred*).
- Confirms [ai-harness-from-repos.md](../../cross-cutting/ben/ai-harness-from-repos.md) line 28: jev-ultrafast `model.py:30-78` still builds and validates the candidate list as cited (*observed*, reread 2026-11-14).
- Confirms the batch rule at line 53 of that note (1 to 20 rows per request) as the batch size we give same-product and keep-or-drop decisions (*inferred*).
- Extends [data.md](../../../spec/features/data.md) line 94 (one registry, two layers): the browser agent is not a third layer; it is the primitive the site protocol's adapters already call, and the open-web engine calls it through the same protocol for a page that needs it (*inferred*).
- Extends data.md line 100 (the router orders own adapter, fetch engine, official API): inside the fetch engine the order is index, then plain fetch, then rendered fetch, then the browser agent, hedged in Firecrawl's way (*inferred*).
- Extends data.md line 113 (outside routes): Firecrawl and crawl4ai stay listed; our own fetch layer is built from their patterns and measured against them (*inferred*).
- Extends [product.md](../../../spec/product.md) line 542 ("Built on Firecrawl ... treg"): the engine is built on our own planner, fetch and extraction, with Firecrawl and treg as routes in the registry. This matches Nate's [words](../../../product/words.md#2026-11-14-nate-our-own-protocol-official-apis-last) (*inferred*).
- Contradicts nothing in the prior notes found here.

## Searched / could not reach

Searched: the four repos' trees and the files cited above, through the GitHub API, 2026-11-14. Could not reach: Firecrawl's fire-engine (closed, hosted); the browser-use cloud's server code (closed); jev's model weights and training data (hosted by TypeSafe); a measured latency for any of the four on our own sites (none exists yet, so every budget in the engine spec is a starting value until our traces replace it).
