# Is there an open-source project that already gathers live product listings across the secondhand sites, or a market-research tool we could run ourselves?
Researched 2026-11-15 by Nate (Claude Code retriever, Sonnet 5.5; filed by the orchestrator). Feature: data.

Decision it feeds: what stands behind our own readers if the cloud-browser harness stops working (Nate: "we at least need to be able to gather mass swarm intelligence on products"), and which free research tools the buying conversation could call. Tests applied: at least 1,000 stars and pushed since 2026-05-15, hosted by us, no paid service in the core.

## The answer

- **No project does the job.** No repository with 1,000 stars or more reads eBay, Poshmark, Depop, Mercari, Facebook Marketplace, Vinted or Etsy (*sourced*, GitHub search 2026-11-15). The largest marketplace-specific ones are small, archived, or samples for a paid service.
- **What passes both tests is generic.** Crawlers (Crawlee in TypeScript, Crawl4AI, Scrapling), price and change trackers (changedetection.io, PriceBuddy) and research tools. Each still needs our per-site reading code, so none replaces the harness; Crawlee is the closest to what we already built.
- **Free search for the conversation exists.** SearXNG (self-hosted metasearch, JSON, no key) is the one that fits "basic internet search" behind the buying conversation without a paid search key (*inferred* fit; not run here).
- **Nothing here was installed or run.** README claims are their authors'; no tool was tested against a marketplace.

The evidence, as the retriever returned it, follows unchanged.


Date fetched: 2026-11-15. Stars, pushed_at, licence, language, archived, latest release: `sourced` from `gh api repos/<owner>/<name>` and `.../releases/latest` on 2026-11-15 (star counts move daily). Tests: stars >= 1,000 and pushed_at >= 2026-05-15. README statements are the author's claims, not proof the tool works today. Raw candidate list (312 repos passing both tests across all queries): `...\scratchpad\cand.txt`; per-repo meta/README copies in `...\scratchpad\rd\`.

Headline finding (`sourced`, near-miss searches below): no repository with >= 1,000 stars exists for eBay, Poshmark, Depop, Mercari, Facebook Marketplace, Vinted or Etsy scraping. The biggest hits are 761 (Discount-Bandit), 557 (oxylabs/ebay-scraper), 482 (oxylabs/depop-scraper), 410 (archived FB scraper). Marketplace coverage at >= 1,000 stars exists only as generic crawlers or as examples tied to a paid scraping API.

## (a1) Kept: commerce / price / product-data tools

| Repo | Stars | Pushed | Licence | Lang | Latest release | Covers | How it fetches | Paid dependency in core? | Called from Node |
|---|---|---|---|---|---|---|---|---|---|
| jez500/pricebuddy | 1,511 | 2026-10-24 | GPL-3.0 | PHP | v1.0.57 (2026-10-24) | any product URL: price, stock, history; "marketplace listings" claimed | CSS/selector scraping on schedule; optional AI repair | No. Optional BYO OpenAI/Anthropic/Gemini/Ollama (off by default) | Docker web app; no documented REST API seen (not-found); would need DB read or browser-extension/CLI |
| dgtlmoon/changedetection.io | 35,818 | 2026-11-14 | Apache-2.0 | Python | 0.70.3 (2026-11-09) | any URL; "Re-stock & Price detection" for product pages | plain HTTP or Playwright/Chrome; proxy per watch | No. Hosted $8.99/mo is optional add-on | Docker service with REST API (HTTP) |
| scrapfly/scrapfly-scrapers | 1,130 | 2026-11-15 | NOASSERTION | Python | none | example scrapers: Amazon, eBay, Etsy, Shopify stores, Airbnb and ~80 more | Scrapfly paid API (`SCRAPFLY_KEY`) | YES: requires Scrapfly key | Reference only (selectors/JSON paths); code is Python |
| openfoodfacts/openfoodfacts-server | 1,209 | 2026-11-15 | AGPL-3.0 | HTML (Perl) | v2.121.0 (2026-11-10) | open food product database (barcodes, attributes), crowd-updated | n/a: it is the data source/server; public API and data dumps | No | HTTP API |
| dimthink/PriceAI | 5,507 | 2026-09-28 | NOASSERTION | TypeScript | v1.3.0 (2026-06-29) | price comparison of AI-subscription reseller channels (Chinese) | not verified (not read) | not verified | TypeScript |
| bytedoger/awesome-OpenPrice | 1,116 | 2026-08-27 | NOASSERTION | TypeScript | none | AI-subscription price aggregation | not verified | not verified | TypeScript |
| filtalgo/Filtmall-Shopping-Skill | 1,185 | 2026-11-10 | Apache-2.0 | Python | v2.1.2 | "agent-native shopping", same-product comparison; skill front-end to Filtmall | not verified; likely calls the vendor's service (inferred) | probably (inferred) | n/a |
| orangecoding/fredy | 1,634 | 2026-11-15 | Apache-2.0 | JavaScript | 31.1.0 | real-estate listing monitor (not product); shows the Node pattern | scraping, notifier | not verified | Node native |
| gosom/google-maps-scraper | 8,093 | 2026-11-15 | MIT | Go | v1.18.3 | Google Maps business listings (not products) | headless browser | No | CLI/Docker/REST |

## (a2) Kept: general crawling / extraction frameworks used for product data

| Repo | Stars | Pushed | Licence | Lang | Latest release | Fetch | Paid in core? | From Node |
|---|---|---|---|---|---|---|---|---|
| apify/crawlee | 26,451 | 2026-11-15 | Apache-2.0 | TypeScript | v3.18.2 (2026-09-29) | HTTP + Playwright/Puppeteer, proxy rotation, fingerprinting | No (Apify cloud optional; proxies BYO) | Native library |
| scrapy/scrapy | 65,410 | 2026-11-13 | BSD-3 | Python | 2.20.0 (2026-11-06) | HTTP; JS via scrapy-playwright (1,469 stars, pushed after cutoff) | No | subprocess / HTTP wrapper |
| D4Vinci/Scrapling | 103,144 | 2026-11-14 | BSD-3 | Python | v0.5.1 (2026-11-04) | HTTP, stealth browsers, Cloudflare Turnstile handling | No (README lists paid proxy/solver sponsors) | subprocess; has MCP/CLI claims (README) |
| unclecode/crawl4ai | 87,378 | 2026-11-13 | Apache-2.0 | Python | v0.9.5 (2026-10-14) | Playwright browser -> Markdown/JSON, LLM extraction | No for library/Docker. Cloud API is paid add-on (1,000 free credits/month; "plans from $10") | Docker server HTTP |
| firecrawl/firecrawl | 201,906 | 2026-11-15 | AGPL-3.0 | TypeScript | v2.11.0 (2026-06-19) | scrape/crawl/search API | Self-host exists, but README says some features (Alexandria, 400+ providers; "Firecrawl Cloud") are not in the self-hosted server; proxies/anti-bot are cloud features per README | Native TS SDK / HTTP |
| getmaxun/maxun | 18,442 | 2026-11-09 | AGPL-3.0 | TypeScript | v0.1.0 (2026-10-25) | no-code robot recording in browser; turns site into API | No (README full of proxy sponsor ads) | HTTP API |
| browserbase/stagehand | 26,056 | 2026-11-14 | MIT | TypeScript | server-v3/v3.7.7 | Playwright + LLM; defaults to Browserbase cloud (inferred from vendor) | needs LLM key; cloud browser optional | Native |
| ScrapeGraphAI/Scrapegraph-ai | 32,787 | 2026-10-06 | MIT | Python | v2.3.1 | LLM-driven extraction | LLM key (or local) | subprocess |
| NaiboWang/EasySpider | 44,797 | 2026-11-07 | AGPL-3.0 | JavaScript | v0.6.5 | visual no-code browser crawler | No | CLI |
| any4ai/AnyCrawl | 3,541 | 2026-11-12 | MIT | TypeScript | v1.2.1 | crawler/scraper API to LLM-ready | No (hosted option exists) | HTTP/Node |
| spider-rs/spider | 2,849 | 2026-11-06 | MIT | Rust | v2.53.9 | HTTP crawler, Node bindings exist (not verified) | No (spider.cloud hosted) | Node bindings (unverified) |
| gocolly/colly | 25,599 | 2026-10-16 | Apache-2.0 | Go | v2.2.0 (2025-03-27) | HTTP | No | subprocess |
| bda-research/node-crawler | 6,798 | 2026-06-18 | MIT | TypeScript | v2.1.1 | HTTP + cheerio | No | Native |
| coder-hxl/x-crawl | 1,889 | 2026-11-14 | MIT | TypeScript | v10.1.0 (2025-04-06) | HTTP/browser | No | Native |
| watercrawl/WaterCrawl | 2,243 | 2026-08-17 | NOASSERTION | TypeScript | v0.12.3 | self-hostable LLM-ready crawler | No (hosted option) | HTTP |
| germondai/trawl | 1,176 | 2026-11-15 | AGPL-3.0 | TypeScript | v1.11.1 | self-hosted engine "bypasses any JS challenge" (own words; unverified) | not verified | HTTP |
| fastcrw/crw | 1,259 | 2026-11-15 | AGPL-3.0 | Rust | v0.44.3 | Firecrawl/Tavily alternative | not verified (hosted fastcrw.com) | HTTP |
| Anakin-Inc/anakin | 3,862 | 2026-08-18 | AGPL-3.0 | Go | v0.1.1 | web-scraping API | not verified | HTTP |
| apache/nutch | 3,311 | 2026-11-11 | Apache-2.0 | Java | none (API) | large-scale HTTP crawler | No | subprocess |
| Kaliiiiiiiiii-Vinyzu/patchright | 5,194 | 2026-11-13 | Apache-2.0 | TypeScript | v1.64.1 (2026-10-15) | patched Playwright (undetected) | No | Native drop-in for Playwright |
| daijro/camoufox | 13,305 | 2026-11-15 | MPL-2.0 | C (Firefox) | v158.0.1-beta.41 | anti-detect Firefox | No | Playwright-compatible (README claim) |
| lexiforest/curl_cffi | 6,871 | 2026-10-27 | MIT | Python | v0.17.0 | TLS-impersonating HTTP client | No | Python only |

## (a3) Kept: market-research / search-at-scale tools (owner follow-up)

"Keys needed" = what the README says is required for the core function. "Free substitute" = what the README says works instead.

| Repo | Stars | Pushed | Licence | Lang | Release | What it is | Outside keys needed | Free/self-hosted substitute | From Node |
|---|---|---|---|---|---|---|---|---|---|
| searxng/searxng | 39,568 | 2026-11-15 | AGPL-3.0 | Python | none (rolling) | self-hosted metasearch | none | is the substitute; engine `ebay` ships in settings.yml with `inactive: true` (sourced: settings.yml line 903-908); no "shopping" category found | HTTP JSON API |
| neon-mmd/websurfx | 1,232 | 2026-11-06 | AGPL-3.0 | Rust | v1.31.1 | searx-like metasearch | none stated | self | HTTP |
| deedy5/ddgs | 3,070 | 2026-10-23 | MIT | Python | v9.16.1 | metasearch library over Bing, Brave, DDG, Google, Yandex etc. | none | self (scrapes engines; blocking risk, inferred) | subprocess |
| karust/openserp | 1,582 | 2026-11-11 | MIT | Go | v0.8.19 | self-hosted SERP API (Google, Bing, Yandex, Baidu, DDG, Ecosia) via browser | "No API keys" | self; you pay compute and proxies | HTTP + Node MCP |
| ItzCrazyKns/Vane | 38,212 | 2026-09-01 | MIT | TypeScript | v1.12.2 | answer engine (Perplexity-like) | an LLM: local Ollama or cloud key | SearXNG bundled; Ollama local | HTTP (Next app) |
| miurla/morphic | 9,333 | 2026-11-13 | Apache-2.0 | TypeScript | v1.10.0 | AI search engine | at least one LLM provider key | SearXNG bundled in Docker Compose; Ollama listed | HTTP |
| LearningCircuit/local-deep-research | 9,585 | 2026-11-15 | MIT | Python | v2.0.0 | deep research on local LLM | LLM (Ollama local works) | SearXNG + Ollama | HTTP/subprocess |
| zilliztech/deep-searcher | 8,395 | 2026-09-22 | Apache-2.0 | Python | none | deep research over private data + web | `OPENAI_API_KEY` in quick start; FIRECRAWL key for web crawl option | other LLMs incl. Ollama listed | subprocess |
| u14app/deep-research | 4,686 | 2026-06-18 | MIT | JS | v0.11.0 | deep research UI | LLM key (Gemini free tier suggested) | SearXNG listed as search provider | HTTP/Node |
| AnotiaWang/deep-research-web-ui | 2,226 | 2026-11-12 | none stated | TypeScript | v1.3.0 | deep-research UI | LLM key; search provider | not verified | Node |
| bytedance/deer-flow | 85,357 | 2026-11-14 | MIT | Python | v2.2.0 | long-horizon research agent harness (agent framework; borderline) | LLM key (OpenAI-compatible) | any OpenAI-compatible incl. local | subprocess/HTTP |
| mvanhorn/last30days-skill | 67,706 | 2026-11-15 | MIT | Python | v3.39.0 | researches a topic across Reddit, HN, X, YouTube, TikTok etc. (agent skill) | Reddit/HN/Polymarket/GitHub "free, no API key"; X, YouTube, TikTok unlock via setup wizard (key/cookie not verified) | partial | subprocess |
| ScrapeCreators/social-media-research-skills | 6,487 | 2026-08-26 | MIT | Python | none | social research skills; homepage is the vendor scrapecreators.com | vendor API key (inferred from vendor) | not verified | subprocess |
| 666ghj/BettaFish | 42,707 | 2026-10-16 | GPL-2.0 | Python | v3.0.0 (2025-12-23) | multi-agent public-opinion analysis (Chinese social media) | OpenAI-compatible LLM keys | any compatible | subprocess |
| koala73/worldmonitor | 90,670 | 2026-11-15 | AGPL-3.0 | TypeScript | v2.11.8 | real-time news / markets / geopolitics dashboard; not product-specific | some feeds need credentials (.env.example) | README: Ollama, "no API keys required" for local AI | HTTP |
| firecrawl/open-scouts | 1,370 | 2026-11-13 | none | TypeScript | none | AI web-monitoring "scouts" | OpenAI, Firecrawl, Resend keys + Supabase | no (hard requirements per README) | Node |
| swirlai/swirl-search | 3,049 | 2026-11-14 | Apache-2.0 | Python | v4.5.0.7 | federated search across your data sources | optional OpenAI key for RAG | core works without | HTTP |
| eliasdabbas/advertools | 1,506 | 2026-06-30 | MIT | Python | none | SEO/marketing analytics: crawl, sitemaps, SERP, YouTube | Google/YouTube API keys for SERP/YouTube modules | crawler/sitemap parts keyless | subprocess |
| vladkens/twscrape | 2,965 | 2026-11-13 | MIT | Python | v0.21.0 | X/Twitter scraping with multi-account | X accounts needed | none | subprocess |
| FreshRSS/FreshRSS | 16,594 | 2026-11-14 | AGPL-3.0 | PHP | 1.30.4 | self-hosted news/feed aggregator | none | self | HTTP/GReader API |
| MarginaliaSearch/MarginaliaSearch | 2,239 | 2026-11-14 | NOASSERTION | Java | v24.10.0 (2024-10-14) | independent search index of text sites | none | self | HTTP |

Not found in this group (`not-found`): any >= 1,000-star open-source "competitive price-intelligence dashboard" for retail; any maintained Google-Trends client (pytrends is archived, see excluded). Facts for items marked "not verified" were not read from their README.

## (b) Closest fit to "aggregate real-time product info from storefronts"

**1. changedetection.io** (35,818, 2026-11-14, Apache-2.0, Python, 0.70.3 on 2026-11-09). Quote: "Ideal for monitoring price changes, content edits, conditional changes" (README.md). Works on any URL; has a "Re-stock & Price detection for single product pages" mode that reads page meta-data (sourced, README). Fetch: HTTP or browser (Playwright/Chrome), "proxy per watch". Core free; hosted subscription ($8.99/mo) is optional. Run: Docker/Python with web UI and REST API, so callable from Node over HTTP. Rate limit/robots/ToS: README says nothing found on robots or ToS (not-found). Marketplace evidence: no marketplace is named. Open issues with "403" in title: 3; "not working": 1; "blocked": 0; "captcha": 0 (sourced via gh search/issues, not marketplace-specific).

**2. PriceBuddy** (1,511, 2026-10-24, GPL-3.0, PHP, v1.0.57 same day). Quote: "open source, self-hostable price tracker" (README.md). Tracks price, stock states, history, multiple listings of the same item "or multiple listings on the same marketplace" (README claim). Fetch: scheduled scraping with tunable selectors; optional BYO LLM to repair extraction. No paid dependency. Docker web app plus companion CLI and browser extension; no documented HTTP API found, so Node would read its database or drive the CLI (inferred). No robots/ToS/bot-detection text found in README. Open issues: "captcha" 1, "not working" 1, "blocked" 0, "403" 0. No marketplace-specific proof it works against eBay/Poshmark/etc.

**3. Crawlee** (26,451, 2026-11-15, Apache-2.0, TypeScript, v3.18.2 on 2026-09-29). Quote: "A web scraping and browser automation library" (README.md). Native Node/TS, matches the team's stack: HTTP and Playwright/Puppeteer crawlers, proxy rotation, session management, fingerprinting (README: "fly under the radar of modern bot protections"). Free; Apify platform optional; proxies are BYO. Issues titled blocked/captcha/403/not working: 0 each. No marketplace presets; you write per-site extractors.

**4. Scrapling** (103,144, 2026-11-14, BSD-3, Python, v0.5.1 on 2026-11-04). Quote from description: "The BEST Web Scraping framework" (repo description; marketing). Fetch: HTTP, stealth browsers, Cloudflare Turnstile handling (README). Core free; README advertises paid proxy/anti-bot token/CAPTCHA sponsors as add-ons. Python only from Node (subprocess). Issues for blocked/captcha/403/not working: 0 each. No marketplace evidence.

**5. Crawl4AI** (87,378, 2026-11-13, Apache-2.0, Python, v0.9.5 on 2026-10-14). Quote: "home to the Apache-2.0 crawler that powers Crawl4AI Cloud" (README.md). Playwright-based crawl to Markdown/JSON, run via Docker with HTTP API (Node-callable). Core free; Cloud is paid (free 1,000 credits/mo; "plans from $10"). Open "blocked" issue: 1; others 0.

**6. Firecrawl** (201,906, 2026-11-15, AGPL-3.0, TypeScript, v2.11.0 on 2026-06-19). Quote: "Supercharge your AI agents with data from the web and beyond" (repo description). Native TS SDK. Self-hosting is documented but README says its proxy/anti-bot ("We handle the hard stuff: Rotating proxies") and "Alexandria" providers are Firecrawl Cloud features and the self-hosted server does not include Alexandria. Cloud needs an API key. "blocked" issues: 1. Note the latest release is dated 2026-06-19 though repo pushed 2026-11-15.

**7. scrapfly-scrapers** (1,130, 2026-11-15, NOASSERTION, Python). Quote: "educational example scrapers for popular web scraping targets" (README.md). Contains eBay, Amazon, Etsy, Shopify-store (products.json, collections) and many more scrapers with per-scraper CI status badges (README claim). Every example uses the paid Scrapfly API (`SCRAPFLY_KEY`) for fetching and block bypass; the field paths are reusable as reference only. Issues: 0 open for all four terms (0 open issues total).

**8. SearXNG** (39,568, 2026-11-15, AGPL-3.0, Python). Self-hosted metasearch, JSON API, no key. The only shopping-related engine found in settings.yml is `ebay`, marked `inactive: true` by default (sourced: raw settings.yml). Useful as the free search substrate for the research tools in (a3).

## (c) Excluded (failing one test) and not-kept notable

All numbers from the API on 2026-11-15 (search results or repo fetch).
- Cybrarist/Discount-Bandit: 761 stars (pushed 2026-10-26). Self-hosted price tracker for Amazon, eBay, Walmart, AliExpress (name-matched; features not read). Fails stars.
- clucraft/PriceGhost: 1,145 stars, pushed 2026-02-03. Fails date.
- techwithtim/Price-Tracking-Web-Scraper: 1,293 stars, pushed 2024-10-17. Fails date.
- GeneralMills/pytrends: 3,729 stars, archived true, pushed 2024-08-10. Fails date (archived).
- oxylabs/ebay-scraper 557 (2025-08-28); oxylabs/depop-scraper 482 (2026-04-02); oxylabs/etsy-scraper 136; oxylabs repos are samples for a paid vendor API. Fail stars (and date).
- passivebot/facebook-marketplace-scraper: 410 stars, archived, pushed 2024-04-29. Fails both.
- Gertje823/Vinted-Scraper 149 (2024-08-18); Giglium/vinted_scraper 107 (2026-11-05). Fail stars.
- sudheer-ranga/aliexpress-product-scraper 331 (2026-05-08); DanielWTE/ebay-kleinanzeigen-api 260; Crinibus/scraper 251 (2025-01-29); pajaydev/ebay-node-api 138. Fail stars.
- Poshmark: best hit jmausolf/poshmark_sharing 120 (2022-06-21). Depop: oxylabs 482. Mercari: no scraper in top 8 (top hits are unrelated company repos, e.g. mercari/production-readiness-checklist 949, 2021-11-22). Fail stars.
- Archived/dated but famous: none else checked.

## (d) Not found

- Any maintained open-source aggregator covering secondhand marketplaces (eBay, Poshmark, Depop, Mercari, FB Marketplace, Vinted) together at >= 1,000 stars: none. Largest marketplace-specific results are under 800 stars (see (c)).
- Any >= 1,000-star repository specifically for Poshmark, Depop, Mercari or Facebook Marketplace: none, even with no date filter.
- Any >= 1,000-star Shopify-storefront scraper (best: ndgigliotti/shopify-spy 123); the Shopify scraper known to exist is inside scrapfly-scrapers (paid API).
- Any open-source continuously updated product knowledge graph beyond Open Food Facts (food only) found by the queries run.
- SearXNG shopping category: none found; only the inactive `ebay` engine.
- Documentation of robots.txt/ToS stance in the READMEs of changedetection.io, PriceBuddy, Crawlee, Scrapling, Crawl4AI (grep found none beyond gosom/google-maps-scraper's "Unauthorized scraping may violate terms of service").
- Any README of kept repos stating "unmaintained/deprecated/moved" for the project itself (grep over 57 READMEs): none for the project; DeerFlow 2.0 README says it is a rewrite sharing no code with v1.
- I did not install or run anything, so "works against marketplaces today" is untested for every repo; only README claims, issue counts and release dates are evidenced.

## (e) Queries run (GitHub search/repositories API, `sort=stars`, each with `pushed:>=2026-05-15`; stars filter `stars:>=1000` on all)

Batch 1 (50): topic:price-tracker; topic:ecommerce-scraper; topic:web-scraping; topic:crawler; topic:price-comparison; topic:scraping; topic:web-crawler; topic:price-monitoring; topic:amazon-scraper; topic:ebay; "topic:marketplace scraper"; "topic:shopify scraper"; topic:metasearch; topic:changedetection; "topic:headless-browser crawler"; "topic:llm crawler"; ecommerce scraper; product scraper; price tracker; price comparison; ebay scraper; poshmark; depop; mercari; facebook marketplace scraper; vinted; etsy scraper; amazon scraper; shopify scraper; web scraping framework; crawler framework; LLM-ready crawler; metasearch engine shopping; website change monitor; open product dataset; product knowledge graph; GTIN barcode product database; open food facts; walmart scraper; aliexpress scraper; craigslist scraper; marketplace aggregator listings; sneaker resell; camelcamelcamel keepa alternative; topic:web-scraper; topic:scrapy; topic:playwright scraping; topic:price-scraper; topic:deals; topic:shopping.
Batch 2 (follow-up, 20): market research; competitive intelligence; competitor price monitoring; deep research open source; topic:deep-research; topic:metasearch-engine; topic:searxng; answer engine perplexity open source; topic:market-research; topic:osint; google trends; social listening reddit scraper; review scraper; topic:web-search; "topic:search-engine self-hosted"; news aggregator self-hosted; trend analysis demand forecasting; topic:competitor-analysis; topic:firecrawl; rag web search.
Batch 3 (near-miss, no pushed/stars filter, top 8 by stars): ebay scraper; ebay api client; poshmark; depop; mercari; facebook marketplace scraper; vinted scraper; etsy scraper; amazon price tracker; price tracker; shopify scraper; ecommerce scraper; product price comparison; pytrends google trends; marketplace listings scraper; craigslist scraper; walmart scraper; aliexpress scraper; price monitor; reseller sneaker bot.
Other calls: `gh api repos/<r>`, `repos/<r>/releases/latest`, `repos/<r>/readme` for 57 repos; `search/issues?q=repo:<r> is:issue is:open "<kw>" in:title` for kw in blocked, captcha, 403, "not working" on 9 repos; curl of searxng settings.yml.
Method caveat: the first batch hit GitHub's search rate limit partway (HTTP 403), so batch 1 was rerun with retries (page 1, 100 results); the candidate list is the union of both runs, which covers every query at least once. A search returns at most the top results by stars, so a >= 1,000-star repository ranked below 100 for a query could be missed. Several kept entries (PriceAI, awesome-OpenPrice, Filtmall, trawl, crw, Anakin, WaterCrawl, fredy) were not read in depth: marked "not verified".

## Sources fetched
- GitHub REST API (`gh api`) on 2026-11-15: search/repositories, search/issues, repos/<owner>/<name>, /releases/latest, /readme for the repos named above.
- https://raw.githubusercontent.com/searxng/searxng/master/searx/settings.yml (ebay engine, `inactive: true`).
