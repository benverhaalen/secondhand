# How do the price-history tools and the tool registries work underneath, and what would match or beat them?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: data.

Scope: group one is price history and market data tools (Card Ladder, 130point, PriceCharting, WatchCharts, StockX, Keepa, camelcamelcamel, eBay Product Research, Swappa). Group two is registries and routers (treg, OpenRouter, Composio, Smithery, the official MCP registry, RapidAPI, Zapier, Pipedream, Apify, Rutter, API2Cart). Product-level features are in [buy-side products](../../watch/nate/buy-side-products-and-search-experience.md), [crosslister teardown](../../cross-cutting/nate/crosslister-teardown.md), [treg routing](../../cross-cutting/nate/treg-tool-routing.md) and [Shopify catalog](../../watch/nate/shopify-catalog-and-agentic-commerce.md); they are not repeated. Aggregated-search patterns (OpenBB, SearXNG, Jina) are in [port-aggregated-search](port-aggregated-search.md).

Mark key. *observed* = page opened in full this session (URL given). *observed (highlight)* = the text appeared in a search result excerpt of that URL, page not opened in full. *asserted* = a third party or vendor says so. *inferred* = my reasoning, from what is named.

## 1. Price history tools

### 1.1 Card Ladder (trading cards)
- Inputs: last sold prices from marketplaces and auctions; a human-reviewed holding area ("purgatory") for odd sales; an index computed as an average of last-sold prices with a divisor adjusted when cards enter or leave, and an eligibility floor for what counts. *observed* (Card Ladder help pages and the Slabnomics interview, fetched in the first window; exact page wording is in that session's transcript, not repeated here).
- Identity: a card is graded and certified (company and grade), so "same item" is a key, not a guess. *inferred* from the grade-keyed pages.
- Outliers and shill sales: the purgatory step sends flagged sales to a person before they enter a series. *observed*.
- Index: divisor method (as for a stock index), so a swap of members does not move the level. *observed*. Our [M14](../../../spec/determinations/market-insight.md) already chains a fixed basket and starts a new era on source change (*observed* in that file); that is the same idea with era links added.
- Weak point: coverage stops at graded cards; the method needs a certificate number to be strong. *inferred*.

### 1.2 130point
- Sources: it searches sold and live listings across eBay, Fanatics Collect, Goldin, MySlabs, Pristine Auctions, Heritage and others ("8+ marketplaces"). *observed (highlight)*, https://130point.com/about and homepage.
- Distinct feature: it shows the accepted Best Offer price that eBay hides. *asserted* by third-party blogs, https://ballcardgenius.com/blog/how-to-see-what-ebay-items-sold-for-at-best-offer/ (2023-08-26) and https://resellingrevealed.com/ebay-best-offer-accepted-price/ (2023-11-08). How it obtains the amount is not stated anywhere I read: *not found*. *inferred* options: the sold-item page loads the accepted offer on a click-through that eBay's own search page exposes to a visitor, or an API field. Not verified.
- Our spec: [money D1](../../../spec/determinations/money.md) weights a Best Offer sale with unknown amount at 0.6 and discounts it by a learned category rate; it has no route that reads the actual accepted amount. Terapeak (below) does show it.

### 1.3 PriceCharting (games, cards, comics)
- Keyword junk removal on listings, an outlier flag that goes to human review, a 90-day user report, and a methodology page. *observed* (methodology, FAQ and 2011 blog, fetched first window). Licence facts (no history in the API, purge when the subscription ends) are in [market.md](../../../spec/features/market.md) line 189 (*observed* there).
- Identity: product pages keyed per console and title, with a price per condition (loose, complete, new, graded). *asserted* from my own recall of the site, not re-opened here.

### 1.4 WatchCharts (watches)
- Daily, fully automated update. Market price is a weighted 30-day window of transactions, using the transaction price where known, otherwise the last asking price, adding unsold listings when thin. Condition is only new or used; box and papers, where sold, dealer or private are modelled. Separate Market, Dealer and Retail prices. A Limitations section admits asking-for-sale substitution and thin data on obscure watches. *observed (highlight)*, https://watchcharts.com/watches/about.
- Scale and gate: daily prices for 30,000+ of about 60,000 catalogued references, a publish threshold called market price confidence, a band of usual listed prices, listings tagged to catalog references, catalog semi-automated from brand sites. *asserted* in an interview, https://watchinsider.com/industry-matters-charting-success-in-the-secondary-market/ (2026-10-30), opened in highlight only.
- Critique: rolling-window overlap and asking-for-sale substitution. *asserted*, https://deadbeat.watch/articles/secondary-market-price-data/ (2026-08-24), highlight only. A trade piece (WatchPro, 2024-09-13) says both it and a rival scrape asking prices and approximate sold prices. *asserted*.
- Our spec: [market.md](../../../spec/features/market.md) line 190 records its licence (no public index, 1 year history, attribution).

### 1.5 StockX
- Per-size variants each with an order book. Fields seen in third-party scrapers: lowestAsk, highestBid, lastSale, salesLast72Hours, last90DaysAveragePrice, annualAveragePrice, volatility, pricePremium. The price-history chart returns about 100 sampled points, not every sale. *asserted* (https://reefapi.com/docs/stockx; https://apify.com/xyrelith-data/stockx-market-price-and-sales-history-finder; https://dev.to/viktorhendelmann/ 2026-11-09), highlights only. Official API `GET /v2/catalog/products/{productId}/market-data` is gated by approval and OAuth. *asserted* (same sources). StockX terms ban scraping; no StockX help page was opened: *not found*.
- Method note: a bid and ask book with an authenticated product (StockX verifies each pair) means "same item" is guaranteed by the operator, not matched by an algorithm. *inferred*.

### 1.6 Keepa
- Storage: a `csv` array indexed by price type (0 Amazon, 1 new, 2 used, 3 sales rank, 4 list price, onward through used sub-conditions, eBay lowest new and used at 28 and 29, listed types to 35). Entries are time, value pairs appended only when the value changes; time in Keepa minutes; -1 is "no offer"; prices in integer minor units. A stats object has avg30 to avg365, min, max and out-of-stock percentages. *observed (highlight)*, https://keepa.com/api-docs/product-object.html.
- Definition change: lowest landing price (listing plus shipping) from 2026-02-23. *observed (highlight)*, same page. The docs warn eBay listings often carry wrong product codes. *observed (highlight)*.
- Method note: change-only storage with an explicit "unavailable" value is what lets a chart show gaps honestly. *inferred*. [market.md](../../../spec/features/market.md) reads Keepa already (line 119).

### 1.7 camelcamelcamel
- Tracks Amazon, third-party new and third-party used prices; charts with high, low, average; email alerts at a threshold; browser extension; excludes shipping; "Good deal" flags from the series. *observed (highlight)*, https://camelcamelcamel.com/features. Funding by affiliate commission and daily chart updates: *asserted*, a 2026-03 blog, unverified.

### 1.8 eBay Product Research (Terapeak)
- Three years of sold data, includes the accepted Best Offer price, average and range of sold price, average shipping and free-shipping share, seller count, sell-through rate (for searches of items sold 90 days ago or less). Filters by MPN, UPC, EPID, EAN, ISBN, condition, format, category aspects. Keyword matching is exact. *observed (highlight)*, https://www.ebay.com/help/selling/selling-tools/product-research?id=4853. In the eBay app since 2024-05-07, *observed (highlight)*, https://innovation.ebayinc.com/stories/ebays-mobile-app-offers-a-goldmine-of-insights-for-sellers/.
- Access: seller account and sign-in; not readable without that. Our [money D1](../../../spec/determinations/money.md) and [M6](../../../spec/determinations/market-insight.md) define sell-through ourselves; whether the app can read this tool through the person's own session is the "own account" route in data.md (*inferred*).

### 1.9 Swappa
- Data is only from its own marketplace (listings and completed sales), not scraped; staff review each listing for IMEI, payoff, activation lock and working order; payment through PayPal or Stripe. Prices are split by carrier and storage and include the 3% buyer fee. Pages show average asking price, lowest price, average sale price per storage tier, recent sales, trade-in quotes, updated date. Sale price runs about 6 to 22% below asking across models. *observed (highlight)*, https://swappa.com/blog/iphone-pricing-data/ (2026-10-14), https://swappa.com/blog/used-electronics-resale-data/. https://swappa.com/prices lists "Prices Updated November 14, 2026" (*observed (highlight)*).
- Method note: operator-owned transactions give identity, condition and sale in one record; the published asking-to-sale gap is the cleanest public discount ratio found. *inferred*.

### 1.10 Other index-style used-goods products
Reverb price guide, Chrono24, TCGplayer market price, Discogs, sneaker indexes: not searched in this run. *not found* (not looked for). See [market-intelligence](market-intelligence.md) for the earlier teardown.

## 2. Registries and routers

### 2.1 treg beyond the earlier note
- Pricing: prepaid balance, metered per call at the provider's own rate, 0% markup stated in terms, first $1.00 free, no subscription; own keys not metered; calls stop at zero balance. *observed (highlight)*, https://treg.to/pricing.
- Docs: 178 documented operations, 4,100+ catalogued endpoints, `/call/<id>` proxy relaying the provider response verbatim with the credential injected server-side, `GET /catalog/search?q=`. Where several providers do the same job, `/catalog/platforms/{slug}` lists measured success rate, speed and price side by side; docs quote "treg compares, but it does not route between providers automatically and does not fail over". *observed (highlight)*, https://treg.to/docs. The [earlier note](../../cross-cutting/nate/treg-tool-routing.md) line 20 and 26 reconcile this: direct ids do not fail over, routed `treg.<capability>` ids do. This window did not open skill.md again; the reconciliation stands as that note's *inferred*.
- Headers and ledger: `X-Treg-Cost-Micro`, `X-Treg-Call-Id`, `X-Treg-Route-Max-Cost` (402 `route_max_cost` when exceeded), `X-Treg-Meta` (up to 5 key=value pairs for per-customer billing in an append-only ledger); `GET /calls/<id>/result` recovers a stored response; 4xx or 5xx from the provider costs nothing; idempotent replay costs 0; catalog rates carry source and last-checked time. *observed (highlight)*, https://treg.to/integrate.md (127 providers).
- Adding a missing capability: MCP tool `catalog_request` records a request; others are `catalog_search`, `catalog_get`, `catalog_call_read`, `catalog_call_write`, `balance`; daily cap and balance enforced before calls. *observed (highlight)*, https://treg.to/connectors/claude.
- Not found: how treg measures success rate (probe or live traffic), window length, or its provider-onboarding process.

### 2.2 OpenRouter
- Provider object per model, with price, throughput, latency and uptime. Default routing is weighted-random shares by price, with preferences `only`, `ignore`, `max_price`, `preferred_max_latency`, `require_parameters`, `data_collection`, `zdr`; a `models` list gives ordered fallbacks that fire on errors, rate limits, moderation or context limits. *observed* (routing and fallback docs, fetched first window).
- Cost: billed at the serving provider's price; the call response reports usage. *asserted* from recall.
- Method note: random shares spread traffic and keep every provider's measurements fresh; a pure "best first" order starves the others of data. *inferred*.

### 2.3 Official MCP registry
- Entry is a `server.json` with a reverse-DNS name; the namespace is verified (GitHub login or DNS) before publishing; the registry stores metadata and points to packages (npm, PyPI, OCI) or remote URLs, and does not host the code. *observed* (about page and `server.json` schema, fetched first window).
- Quality: no score, no health measure. *observed* by absence on those pages.

### 2.4 Smithery
- Publish by URL (streamable HTTP with OAuth) or a local MCPB bundle; a scan extracts tools, prompts, resources; the fallback is a static `/.well-known/mcp/server-card.json`; verification is a checklist in settings. *observed (highlight)*, https://smithery.mintlify.dev/docs/build/publish.
- Quality score out of 100: metadata 35, configuration UX 25, capability quality 40 (descriptions, outputSchema, annotations); "verified" is a staff bonus; registry API cached about 4 hours. *asserted*, https://tanod.dev/learn/how-mcp-directories-score-servers.html and a GitHub submission guide (highlights); a second source splits config scoring 10 + 15. The score is of the listing's documentation, not of whether calls return right answers. *inferred*.

### 2.5 Composio
- 1,743 toolkits; each has slug, tool count, trigger count, auth type (API_KEY, OAUTH2, DCR_OAUTH, NO_AUTH, BASIC) and whether Composio supplies a managed OAuth app. Tool slugs `{TOOLKIT}_{ACTION}` with input and output schemas. Auth config is a blueprint (method, scopes, credentials); a connected account binds credentials to a user id. *observed (highlight)*, https://docs.composio.dev/toolkits.
- Pricing: 100K calls a month free, then $0.0003 per call; meta tools free. *observed (highlight)*, https://composio.dev/pricing/platform.
- Method note: the user-bound connected account is what lets an agent act as one person; it is the data model for our "own account" route. *inferred*.

### 2.6 RapidAPI hub
- Listing metrics: Popularity (1 to 10, from requests and users), Average Latency (30 days), Service Level (30 days, percentage of 2xx against 5xx). Optional provider health check; the Rapid Runtime proxy tracks consumption, error rate, latency, logs kept up to 7 days. "40,000 APIs" in the datasheet. *observed (highlight)*, https://docs.rapidapi.com/docs/faqs.
- Weak point: Service Level counts 2xx against 5xx, so an empty 200 or a wrong answer counts as healthy. *inferred* from the definition; this is what data.md's `hit` and `right_90d` separate out.

### 2.7 Zapier and Pipedream
- Zapier: an integration declares one of five auth schemes (OAuth v2 preferred, API key, session, basic, digest) with a test call that runs on connect, automatic refresh of OAuth and session tokens; an integration is refused for publishing if an API key needs human contact. *observed*, https://docs.zapier.com/platform/build/auth (opened this session).
- Pipedream: a component is an ES module with required `key`, `version`, `name`, `description`, and `type` of `action` for actions; components are accepted into the registry through pull requests that pass lint checks; guidance favours narrowly scoped components. *observed (partial page)*, https://pipedream.com/docs/components/contributing/guidelines (opened this session, first part only).
- Not opened: Zapier's app definition schema for triggers, and Pipedream's props and `$.export` conventions. *not found* in this run.

### 2.8 Apify store
- Packaging: `.actor/actor.json` with `actorSpecification: 1`, name, version, buildTag, memory limits, dockerfile, readme, `input` and `output` schema files, `storages.dataset` schema, optional `webServerSchema` and `webServerMcpPath` (an Actor can serve MCP). *observed*, https://docs.apify.com/platform/actors/development/actor-definition/actor-json.
- Pricing: pay per event (events fired from the Actor code, such as one result) or pay per usage; Apify keeps 20%; for pay-per-event the developer's payout has platform usage cost deducted; agents can pay with a prepaid token without an account. *observed*, https://docs.apify.com/platform/actors/publishing/monetize.
- Quality telemetry: the developer's analytics show revenue, cost per 1,000 results, run success rate, user funnel; exportable as JSON. *observed*, same page. Public store ratings and run-success displays: *not opened*; the developer-side metric proves the platform measures run success.

### 2.9 Unified commerce APIs
- API2Cart: 80+ platforms, 100+ methods, 3,000+ clients, 50k+ connected stores, claims 99.98% uptime. Price by requests and stores: $300 a month (20,000 requests, 10 stores) to $1,000 (1,000,000 requests); extras for webhooks (+$100), batch API and delta sync, integration health dashboard with latency and error rates, error logs with root cause, mock responses, usage-based billing hooks. Entities: products, orders, categories, customers, basket, refunds, shipments. *observed (highlight)*, https://api2cart.com/price/ and https://api2cart.com/ (supported marketplaces include Amazon, eBay, Etsy, Walmart).
- Rutter: unified API built for B2B finance; commerce platforms include Amazon, eBay, Etsy, Shopify, Walmart, WooCommerce, Stripe, PayPal and others, each with an enum such as `EBAY`; free 30-day sandbox, then a quoted full-access plan. *observed (highlight)*, https://docs.rutter.com/supported-platforms and https://www.rutter.com/pricing. Neither lists Facebook Marketplace, Depop, Poshmark or Mercari in what I read: *not found* in the highlights seen.
- Method note: both give one schema per entity and a per-platform adapter; the weak point for resale is that eBay and Etsy are the only resale marketplaces among them and the schema is shop-oriented (orders, products), not comp-oriented (sold price, date, condition). *inferred*.

## 3. Method-by-method against our "Source registry and router" (data.md lines 92 to 104)

| Method | Who | Ours |
|---|---|---|
| Row per (site, need, route) with measured ok, hit, p50, p95, freshness, coverage, rights | treg (success, speed, price per platform), RapidAPI (latency, service level) | has it, richer: adds `hit_7d`, `right_90d`, freshness, rights |
| Weighted-random traffic shares | OpenRouter | lacks: ours orders deterministically; no exploration so a demoted route is only tested by `route_probe` |
| Per-call ceilings (`max_price`, `preferred_max_latency`, `X-Treg-Route-Max-Cost`) | OpenRouter, treg | partial: a cost ceiling per observation and per batch; no latency ceiling per call |
| Append-only cost ledger with customer tags | treg `X-Treg-Meta` | partial: `route_call` rows hold cost; per-person tagging is not named in the section |
| Recover a result by call id | treg | lacks (observations store evidence; no explicit replay by id) |
| Zero charge on provider 4xx and 5xx, free idempotent replay | treg | partial: unit cost is a basis on the route; billing for failures is not modelled |
| Truth check of answers against later facts | none seen | has: `route_truth`, `right_90d` |
| Hourly probe with a known query | none seen published; RapidAPI optional health check | has: `route_probe` |
| Request a missing capability | treg `catalog_request` | lacks as a named flow |
| Published quality score per entry | Smithery (asserted), RapidAPI | partial: health page shows measured numbers, not one score |
| Verified namespace | MCP registry | lacks (no outside publishers yet) |
| Per-user connected account | Composio | has in spirit: own-account route per [managing 16 and 17](../../../spec/determinations/managing-and-buyers.md) |
| Typed input and output schema per tool | Composio, Apify, MCP `server.json` | partial: fields "it returns" are listed; no formal schema file named |

## 4. The lead's table

| Capability | Who does it best and how (mark) | Method to match | Method to beat | What it needs | In our spec |
|---|---|---|---|---|---|
| Fixed-basket price index | Card Ladder, divisor and eligibility floor, human review of odd sales (*observed*) | divisor or chained basket, floor, review queue | era links, each point recomputable from its citation, bootstrap band | sold comps, Delta, dqx | yes: [market.md](../../../spec/features/market.md) line 67, [M14](../../../spec/determinations/market-insight.md) |
| Sale outlier handling | PriceCharting keyword junk plus flag to human (*observed*); Card Ladder purgatory | keyword rules, flag, review | MAD cut on log adjusted price plus learned flags | comps, review UI | yes: [money D1](../../../spec/determinations/money.md) step 5 (MAD) |
| Real accepted Best Offer price | Terapeak, 130point (*observed (highlight)* and *asserted*) | read it where a source shows it | learn the offer discount per category from known amounts, use it where hidden | own-account eBay route, comps | yes (learned `d_offer,cat`); direct read route not named |
| Sold prices thin: fall back to asking | WatchCharts, transaction else last ask, add unsold listings (*observed (highlight)*) | label source type per point | per-source weights, show asking-to-sale gap per category | listing history | yes: D1 source weights; gap table not named |
| Publish gate on data quality | WatchCharts "market price confidence" (*asserted*) | minimum sales and spread rule | hide states `too_few_sales`, `too_wide`, backtest-coverage check | backtest | yes: [price.md](../../../spec/features/price.md) lines 73 to 78 |
| Own-marketplace ground truth | Swappa (*observed (highlight)*) | n/a (needs a marketplace) | read our own sales, fed to `route_truth` | our sales | yes: data.md `route_truth` |
| Change-only history with a gap marker | Keepa (*observed (highlight)*) | store on change, -1 for none | same, plus eras for definition changes (Keepa's 2026-02-23 landing-price shift) | Delta | era in `index_point`; change-only storage not stated |
| Sell-through | Terapeak, 90-day cohort (*observed (highlight)*) | sold over (sold plus live) | M6 cohort with hide rule | comps | yes: [M6](../../../spec/determinations/market-insight.md), D23 |
| Price alert from history | camelcamelcamel (*observed (highlight)*) | threshold on series | follow plus weekly digest | history | yes: `notify_follow` in market.md line 119 |
| Measured provider health | RapidAPI latency and service level (*observed (highlight)*), treg per-platform stats (*observed (highlight)*) | probe and live rows | add `hit` and `right_90d` | Lakeflow, Delta | yes: data.md lines 96 to 104 |
| Traffic split with exploration | OpenRouter (*observed*) | weighted random by price, uptime, latency | cost per useful result as the weight, plus a small exploration share | router code | not in spec (deterministic order) |
| Per-call cost ceiling and ledger | treg headers (*observed (highlight)*) | header and ledger table | ceiling also on latency and batch | `route_call` | partial |
| Registry entry schema and listing score | MCP `server.json` (*observed*), Smithery (*asserted*) | JSON schema per route | schema plus measured score, not documentation score | Lakebase | partial |
| Apify-style packaged fetcher with input and output schemas and pay-per-result | Apify (*observed*) | `actor.json` shape for our fetchers | measure cost per 1,000 results per route (Apify shows it to developers only) | fetcher repo | not in spec as a packaging format |
| Unified commerce schema | API2Cart, Rutter (*observed (highlight)*) | one schema per entity | add comp-shaped entities (sold price, date, condition, rights) | adapters | partial: harness verbs cover sites; comp schema in price.md |

## Searched / could not reach
- Opened in full: Apify monetize and actor.json, Zapier auth, Pipedream guidelines (first part), Rutter docs home, API2Cart search results. Opened in full in the first window: OpenRouter, MCP registry, Card Ladder, PriceCharting.
- Search highlight only, pages not opened in full: 130point, WatchCharts, StockX third-party docs, Keepa, camelcamelcamel, Terapeak help, Swappa, treg pricing, docs, integrate.md, connectors, Composio, Smithery, RapidAPI.
- Not readable without sign-in: StockX official API and market-data, Terapeak product research, Rutter full pricing, Apify public store ratings.

## Not found
- How 130point obtains the accepted Best Offer amount.
- How treg measures success rate and speed, and its provider onboarding process.
- Any StockX help-centre page on price calculation.
- Zapier app definition schema; Pipedream props conventions.
- Used-goods index products beyond those named (Reverb, Chrono24, TCGplayer, Discogs, sneakers) were not searched.
- Facebook Marketplace, Depop, Poshmark or Mercari in Rutter or API2Cart lists.

## Sources fetched
- https://docs.apify.com/platform/actors/publishing/monetize
- https://docs.apify.com/platform/actors/development/actor-definition/actor-json
- https://docs.zapier.com/platform/build/auth
- https://pipedream.com/docs/components/contributing/guidelines
- https://docs.rutter.com/
- First window (opened in full): OpenRouter routing and fallbacks docs, official MCP registry about page and `server.json`, Card Ladder help pages and Slabnomics interview, PriceCharting methodology, FAQ, 2011 blog.
- Search highlights (unopened pages): https://api2cart.com/price/, https://api2cart.com/, https://docs.rutter.com/supported-platforms, https://www.rutter.com/pricing, https://130point.com/about, https://watchcharts.com/watches/about, https://keepa.com/api-docs/product-object.html, https://camelcamelcamel.com/features, https://www.ebay.com/help/selling/selling-tools/product-research?id=4853, https://swappa.com/blog/iphone-pricing-data/, https://treg.to/pricing, https://treg.to/docs, https://treg.to/integrate.md, https://treg.to/connectors/claude, https://docs.composio.dev/toolkits, https://composio.dev/pricing/platform, https://smithery.mintlify.dev/docs/build/publish, https://docs.rapidapi.com/docs/faqs
- Specs read: spec/features/data.md, price.md, market.md (grep), spec/determinations/money.md and market-insight.md (grep). buy.md, watch.md, score.md not opened.
