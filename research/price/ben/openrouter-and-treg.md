# Can OpenRouter and Treg replace the pile of separate API keys in the pricing, search and watch plan?
Researched 2026-11-14 by Ben (Claude Code agent, thread "Plan the build for pricing, search and watch"). Feature: price.

Ben: "are you able to use openrouter for it. also investigate treg if you havent already." (thread, 22:25 UTC). The [build plan](build-plan.md) needed keys for OpenAI, a vision model, SerpApi, Apify, SoldComps, Underpriced, Firecrawl, ScrapeCreators, eBay and Exa. Nothing here was called: this machine can't reach either service, so every row is the vendor's page read today.

## Answer

- **OpenRouter: yes, for every model call in the plan.** One key covers the Decisions model, the label-reading vision model and Seedream. *(observed on its model pages)*
- **Treg: yes, for about half the data calls.** It is "OpenRouter for agent tools and data, pay per call": one key, 4,100+ endpoints across 127 providers, the provider's rate with no markup *(observed, treg.to)*. It covers Google Lens, eBay search and item detail, Firecrawl scraping, Exa search and page-change monitors. It does not list Facebook Marketplace, Poshmark, Mercari, Depop, Grailed or OfferUp, any sold-listings search, Firecrawl's Monitor product, or Exa's monitors *(observed absence in the catalog pages read; a narrow read does not prove they are missing)*.
- So the key list drops from ten to five: **OpenRouter, Treg, Apify, eBay developer, Exa** (Exa's exists already), plus ScrapeCreators for Facebook unless Treg turns out to carry its Marketplace endpoint.

## OpenRouter

| Plan step | OpenRouter route | Evidence |
|---|---|---|
| Glance, junk filter, component choice (typed judgements) | `openai/gpt-6-luna-decisions`, $0.10 per 1M input tokens, output free, P50 latency 0.18 s. It "runs on the OpenRouter Decisions API rather than the OpenAI-compatible chat endpoint". Question types are yes/no, choice and score; `state` holds text, JSON or images | observed, [model page](https://openrouter.ai/openai/gpt-6-luna-decisions-20261006) |
| Reading labels and tags | `google/gemini-4-carbon` ($2 in, $10 out per 1M) or the cheaper, faster `google/gemini-4-hydrogen` ($1.50, $7.50); both take images | observed, openrouter.ai/models |
| A second opinion on a judgement | Other decision models on the same API: `google/gemini-decision-1` (reads images), `heygen/heygen-decision-1`, two free Perplexity ones | observed, same listing; partial list |
| Studio renders (another thread) | `bytedance-seed/seedream-5-5`, from $0.02 an image, P50 about 24 s | observed, [model page](https://openrouter.ai/bytedance-seed/seedream-5-5) |

Three differences from calling OpenAI directly, each to check in the first call:

1. **200 questions per request**, where OpenAI's own guide says 400 *(observed on the model page; the 400 is in [openai-decisions-api.md](../../identify/ben/openai-decisions-api.md))*. Batch the comp junk filter in 200s.
2. **Images must be base64.** A third-party client's README says "OpenRouter does not fetch URLs" *(asserted, [llm-openrouter-decisions](https://github.com/aborruso/llm-openrouter-decisions))*. The phone already sends base64 for Glance, so nothing changes there.
3. **The request path and field names** did not render in what I could read; the guide page failed to load. Read `openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-request.md` before writing the client.

The 0.18 s P50 is good news for the 1.5 s Glance budget in [appraisal-run.md](../../appraise/ben/appraisal-run.md), though it is not stated whether that figure includes image inputs.

## Treg

How it works *(observed, treg.to docs and llms.txt)*: `POST https://treg.to/call/<endpoint id>` with the provider's own params and one `X-Treg-Token` header; also a CLI and an MCP server. Prepaid balance, $1 free, cost per call returned in a header, and a per-call cost cap header. Monitors and long jobs exist only as provider endpoints; Treg itself has no scheduler or webhooks.

| Plan need | Treg endpoint | Price | Covers it? |
|---|---|---|---|
| Photo to identity (Google Lens) | `serper.google.serp.lens` | $0.003 a call | Yes, and cheaper than SerpApi. Needs a public image URL |
| eBay active search | `serpapi.x.ebay-search` | $0.015 | Yes, as a fallback to the free Browse API |
| eBay listing detail, with a `sold` field | `crawl4ai.ebay.product.detail`, `brightdata.x.ebay-products` | $0.00135, $0.0015 | Yes: reads a pasted eBay link and rechecks watched items, which Exa could not do |
| Scrape any page (newest-first search pages, pasted links) | `firecrawl.web.scrape`, `crawl4ai.web.scrape`, `brightdata.web.scrape.structured` | $0.005, $0.00025, $0.0015 | Yes |
| Watch a page for changes | `crawl4ai.watch.create` and `.changes`, `scrapegraphai.web.monitor.create` (scheduled, webhook configurable) | free on a watch budget; $0.004 to $0.024 | Yes, as a stand-in for Firecrawl Monitor |
| Open-web search | `exa.web.search` and variants, `firecrawl.web.search` | $0.004 to $0.012 | Yes; Exa's monitors are not listed |
| Google Shopping prices for new items | `serper.google.serp.shopping` | $0.002 | Yes, as a retail anchor |
| eBay **sold** search | none seen | | No: Apify, SoldComps or Underpriced directly |
| Poshmark, Mercari, Grailed sold; Depop, OfferUp search | none seen | | No: Apify directly, or scrape their pages through Treg's scrapers |
| Facebook Marketplace search | none seen (its Facebook endpoints are public pages and posts) | | No: ScrapeCreators directly |
| Discogs, PriceCharting | none seen | | No |

**What this does to the decided watch loop.** Ben chose Firecrawl, the eBay API and a Facebook API ([decision](../../../product/decisions.md#2026-11-14-watch-alerts-run-on-firecrawl-the-ebay-api-and-a-facebook-search-api)). Treg carries Firecrawl's scrape but not its Monitor. *Agent proposal:* keep the decision and reach it through Treg: our own 5-minute job calls `firecrawl.web.scrape` on each newest-first page, with `crawl4ai.watch` as the hosted alternative. The result is the same and it needs no Firecrawl account. If the Monitor's diffing turns out to matter, add a Firecrawl key later.

**Risks** *(asserted, [eesel review](https://www.eesel.ai/blog/treg-review))*: early access with "no uptime commitment and no support commitment"; the agent must pick the provider and there is no automatic failover in the docs; calls fail with 402 on an empty balance. For a demo, that means topping up the balance beforehand and keeping one direct key (Apify) as the fallback.

## Limits

I read the catalog index and the eBay, web and Google category pages, not all 4,100 endpoints. Run `treg catalog search marketplace` and `treg catalog search sold` with a key before treating a "No" above as final. No call was made to either service.
