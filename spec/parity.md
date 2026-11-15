# Parity with the tools that exist

Each row names a capability, the tool that does it best and how, with the mark its research note gives, and what we do instead. Every "ours" cell is an *agent proposal*; numbers in it are starting values. Status reads: in the spec (it was there before this pass), added in this pass, or not adopted (with the reason).

Notes read: [search and similar finders](../research/watch/nate/teardown-search-and-similar-finders.md#table-for-the-lead), [price tools and registries](../research/data/nate/teardown-price-tools-and-registries.md#4-the-leads-table), [crosslisters](../research/cross-cutting/nate/crosslister-teardown.md#5-capability-by-tool), [catalogs and agent shopping](../research/watch/nate/shopify-catalog-and-agentic-commerce.md), [seller analytics](../research/data/nate/shopify-analytics-and-seller-analytics.md#3-crosslisters-and-resale-bookkeeping).

## Cross-marketplace search and similar-item finders

| Capability | Who does it and how (mark) | Ours: adopt or better, and why | Spec file and card | Status |
|---|---|---|---|---|
| Live cross-site search | ThriftX: scrape, proxy, LLM rank (*asserted*, [§1](../research/watch/nate/teardown-search-and-similar-finders.md#1-thriftx)) | better: official APIs first, our own index of items seen, scraping only as a fallback, through one router | [buy](features/buy.md#design-choices), [data router](features/data.md#source-registry-and-router-agent-proposal) | in the spec |
| Image to similar item | Dupe.com: visual plus attribute match over 47M items (*asserted*, [§2](../research/watch/nate/teardown-search-and-similar-finders.md#2-dupecom)) | adopt, and add used-market sold comps to each result | [buy](features/buy.md#design-choices) `like` search | in the spec |
| What Dupe.com is built from | A chat agent in front of a catalog search, an affiliate layer and an evidence pipeline, seen signed out in a browser; it also ships a browser extension with a side panel that reads baskets and purchases (*observed*, *inferred* for what the extension is for; [dupe-observed-in-browser](../research/watch/nate/dupe-observed-in-browser.md)) | adopt the parts already in the spec (chat, search, affiliate, evidence); its agent surface is a public MCP server with anonymous search tools ([settled note, rows 4 and 6](../research/watch/nate/open-items-settled-sites-and-rivals.md), *observed*) | [buy](features/buy.md#design-choices) | in the spec |
| What ThriftX is built from | An iOS app over a static site; Firebase Auth, Cloud Run and Cloud SQL, OpenAI for ranking, ScrapingBee as a scraping proxy, the eBay Browse API; dedupe by title and image after the fetch (*observed* from its privacy policy, *inferred* for dedupe; [settled note](../research/watch/nate/open-items-settled-sites-and-rivals.md)) | better: the same fan-out method, with sold prices, a product id as the dedupe key and our own index of items seen | [buy](features/buy.md#design-choices), [watch](features/watch.md#design-choices) | in the spec |
| A browser extension that checks a listing on any site | Dupe and Phia both ship one (*observed*, [settled note, row 25](../research/watch/nate/open-items-settled-sites-and-rivals.md)) | open: the data it needs already exists; Nate decides | none yet | open |
| Cross-post dedupe | ThriftX: cheapest wins, with a note (*asserted*) | better: image vector, price band and pHash, "Not the same" undo, "also on" | [watch](features/watch.md#design-choices) | in the spec |
| Result order | ThriftX collapse; Dupe caps rows per retailer (*asserted*) | adopt both in one ORDER statement: place in the guarded fair range, then match, then quality; at most 3 rows per seller in any 20; a referral never changes order | [buy](features/buy.md#design-choices) Ranking, [market](features/market.md#design-choices) Listing order | added in this pass |
| Price position | Phia label (*asserted*); Croissant sold-data lake (*asserted*) ([§4](../research/watch/nate/teardown-search-and-similar-finders.md#4-phia-beni-encore-croissant)) | better: sold comps with confidence and an outlier trim, on catalog products too | [money D18](determinations/money.md#d18-good-deal-verdict-on-a-listing) | in the spec; catalog products added in this pass |
| New-listing cadence | Gem daily (*asserted*, [§3](../research/watch/nate/teardown-search-and-similar-finders.md#3-gem)); ThriftX daily, hourly for ThredUp and eBay on paid plans (*asserted*) | better: events first, a `next_check_at` floor of 5 to 60 min on every plan, seen listings never fetched again | [watch](features/watch.md#design-choices) Cadence against the finders | added in this pass |

## Price and market-data tools

| Capability | Who does it and how (mark) | Ours: adopt or better, and why | Spec file and card | Status |
|---|---|---|---|---|
| Fixed-basket index with an eligibility floor and review | Card Ladder (*observed*) | adopt the floor and a `held_for_review` queue; better: each point recomputable from its citation | [M14](determinations/market-insight.md#m14-a-category-price-index) | added in this pass (floor, review); index in the spec |
| Sale outlier handling | PriceCharting keyword rules and flags (*observed*) | better: MAD cut on log adjusted price | [money D1](determinations/money.md#d1-comparable-set-and-weights) | in the spec |
| Real accepted Best Offer price | Terapeak, 130point (*observed (highlight)* and *asserted*) | adopt: read it through the person's own eBay seller session; learn the discount where it is hidden | [M3](determinations/market-insight.md#m3-used-price-per-site-over-time), [money D1](determinations/money.md#d1-comparable-set-and-weights) | added in this pass |
| Thin sales fall back to asking prices | WatchCharts (*observed (highlight)*) | adopt with per-source weights | [money D1](determinations/money.md#d1-comparable-set-and-weights) | in the spec |
| Publish gate on data quality | WatchCharts market price confidence (*asserted*) | adopt: no published point below confidence 0.5, with named hide states | [M3](determinations/market-insight.md#m3-used-price-per-site-over-time) | added in this pass |
| Change-only history | Keepa (*observed (highlight)*) | adopt: a `price_point` row only on change, plus eras for definition changes | [M3](determinations/market-insight.md#m3-used-price-per-site-over-time) | added in this pass |
| Sell-through | Terapeak 90-day cohort (*observed (highlight)*) | adopt as a listing cohort with a hide rule | [M6](determinations/market-insight.md#m6-sell-through) | in the spec |
| Price alert from history | camelcamelcamel (*observed (highlight)*) | adopt: follow, plus a weekly digest | [market](features/market.md#design-choices) `notify_follow` | in the spec |
| Tax in a delivered price | a paid tax service (our earlier draft, no rival claim) | a labelled estimate from the states' published rate tables | [M26](determinations/market-insight.md#m26-delivered-price), [market](features/market.md) | not adopted: Nate, no paid tax service ([words](../product/words.md#2026-11-14-nate-the-search-engine-is-an-api-no-feeds-no-tax-service-tags-on-retouched-photos)); estimate added in this pass |

## Registries and routers

| Capability | Who does it and how (mark) | Ours: adopt or better, and why | Spec file and card | Status |
|---|---|---|---|---|
| Measured provider health | RapidAPI latency and service level, treg per-platform stats (*observed (highlight)*) | better: add `hit` and `right_90d` | [data router](features/data.md#source-registry-and-router-agent-proposal) | in the spec |
| Own-marketplace ground truth | Swappa (*observed (highlight)*) | our own sales feed `route_truth` | [data router](features/data.md#source-registry-and-router-agent-proposal) | in the spec |
| Traffic split with exploration | OpenRouter weighted by price, uptime, latency (*observed*) | better: weight by cost per useful result, 5% exploration | [data router](features/data.md#source-registry-and-router-agent-proposal) | added in this pass |
| Per-call cost ceiling and ledger | treg headers (*observed (highlight)*) | adopt, plus a latency ceiling, `call_id` recovery, no charge on a provider error | [data router](features/data.md#source-registry-and-router-agent-proposal) | added in this pass |
| Registry entry schema | MCP `server.json` (*observed*); Smithery score (*asserted*) | adopt the schema (input, output, auth kinds); better: a measured score, not a documentation score | [data router](features/data.md#source-registry-and-router-agent-proposal) | added in this pass |
| Packaged fetchers, pay per result | Apify (*observed*) | adopt pay per result as the cost unit; `no_route` when nothing fits | [data router](features/data.md#source-registry-and-router-agent-proposal) | added in this pass |
| Unified commerce schema | API2Cart, Rutter (*observed (highlight)*) | harness verbs per site, comp schema in price | [connect](features/connect.md), [price](features/price.md) | in the spec |

## Crosslisting and selling tools

| Capability | Who does it and how (mark) | Ours: adopt or better, and why | Spec file and card | Status |
|---|---|---|---|---|
| Sale detection | Vendoo polls every 10 min (*observed*); List Perfectly alerts on higher tiers (*observed*) | better: events plus a sold-page poll, under 2 min p95 | [connect](features/connect.md) | in the spec |
| Delist on a sale | List Perfectly on Pro Plus only (*observed*); disputed elsewhere ([§4](../research/cross-cutting/nate/crosslister-teardown.md#4-documented-failures-by-class)) | better: automatic for everyone, confirmed by a read-back, `failed_delist` card | [list](features/list.md) | in the spec |
| Bulk edits | crosslisters' bulk relist and offers (*asserted*) | better: a preview with what is left out | [list](features/list.md) | in the spec |
| A verb a site lacks | not covered by the tools (*inferred* gap) | a one-tap handoff that opens the site | [connect](features/connect.md) | in the spec |
| Sharing and offers to likers | Nifty offers to likers (*asserted*); Poshmark native Bulk Share | adopt at the pace the engine finds best | [list](features/list.md#how-each-sites-listing-is-built-from-its-plan), [listing D26](determinations/listing-and-marketing.md#d26-engagement-levers-the-agent-runs-on-its-own) | added in this pass |
| Account risk from automation | Poshmark pulled and restored Bulk Sharing (note, May to Dec 2025) | shown on every automated action, per site; automation on real accounts may stay out of the demonstration | [list](features/list.md#how-each-sites-listing-is-built-from-its-plan), [connect](features/connect.md) | added in this pass |

## Catalogs and agent shopping

| Capability | Who does it and how (mark) | Ours: adopt or better, and why | Spec file and card | Status |
|---|---|---|---|---|
| Official new and refurbished offers | Shopify Global Catalog (*observed*, [note §1](../research/watch/nate/shopify-catalog-and-agentic-commerce.md#1-shopify)) | adopt, read on demand; better: beside each used listing with delivered price and value kept | [M24 to M29](determinations/market-insight.md#the-better-official-option-m24-to-m29), [market](features/market.md#design-choices) | in the spec |
| Search for agents | Dupe.com MCP, llms.txt, UCP (*observed*) | adopt: a public search API with MCP tools search, product, compare, history, trends; keys and rate limits at the edge | [buy](features/buy.md#design-choices), [market](features/market.md#design-choices) | added in this pass |
| Feeds of people's listings to assistants | merchant product feeds (*observed*, [note](../research/watch/nate/shopify-catalog-and-agentic-commerce.md)) | none: the API serves search only | [buy](features/buy.md#design-choices) | not adopted: Nate, secondhand is not a storefront ([words](../product/words.md#2026-11-14-nate-the-search-engine-is-an-api-no-feeds-no-tax-service-tags-on-retouched-photos)) |
| Commission-bid ranking | Lyst (*asserted*, [§5](../research/watch/nate/teardown-search-and-similar-finders.md#5-lyst-and-shopstyle)) | none: a referral is attached after the order is fixed | [buy](features/buy.md#design-choices) | not adopted: rank on fit |

## Analytics

| Capability | Who does it and how (mark) | Ours: adopt or better, and why | Spec file and card | Status |
|---|---|---|---|---|
| Profit by site, category and brand | Vendoo, Nifty, Resylr (*asserted*) | adopt over items whose cost is known; store metrics redefined for one-of-a-kind items | [insights](features/insights.md#analytics-suite-agent-proposal) | in the spec |
| Store metrics | Shopify analytics (*observed*, vendor pages) | each metric carried over, redefined or dropped | [insights](features/insights.md#analytics-suite-agent-proposal) | in the spec |
| Goal tracking | OneShop (*asserted*) | a monthly goal counting Kept, no celebration | [insights](features/insights.md) `goal` | in the spec |
