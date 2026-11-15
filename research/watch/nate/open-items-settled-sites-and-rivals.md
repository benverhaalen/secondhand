# What is ThriftX built from, and which open items from today's notes can be settled from the vendors' own pages?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: watch.

Marks: *observed* (the page or file was fetched on 2026-11-14 and says so), *asserted* (the source claims it without showing, or only a third party says it), *inferred* (reasoning, basis given). Everything was read signed out, from public pages. Nothing was bypassed, no private endpoint was called and no parameter was made up. Verdicts: settled, check (one named page or probe), measure (only the built product can answer), owner (Ben or Nate decides). This note extends [the Dupe note](dupe-observed-in-browser.md) and [the search teardown](teardown-search-and-similar-finders.md).

## The answer

ThriftX has no public API and no client calls: the site is a static Vercel page, and the back end is named only in its privacy policy (Firebase Auth, Google Cloud Run and Cloud SQL, OpenAI for ranking, ScrapingBee as a scraping proxy, Upstash Redis for cache and rate limits, and the eBay Browse API). That is the same method our spec uses for fan-out, with two differences: ours reads sold prices and the person's own accounts, and ours alerts by the hour. Of the 25 open items below, 13 are settled, 7 are one check, 4 are measurements and 1 is the owner's.

## ThriftX: what was observed

| What | Where it shows | Mark |
|---|---|---|
| iOS app only, by Emote LLC, launched July 2026; the website is marketing, guides and legal pages | thriftx.shop home, footer, support page | *observed* |
| Static site on Vercel; no fetch or XHR calls to an API host from the pages | response headers, page source | *observed* |
| Fan-out to six marketplaces; results grouped, with "Also listed on" for the same item cheapest first; AI photo check of a listing against the query | home page, guides, support page | *observed* (claims) |
| Back-end services: Firebase Auth, Google Cloud Run and Cloud SQL, OpenAI (ranking), ScrapingBee, Upstash Redis, the eBay Browse API | privacy policy | *observed* |
| Watches re-run daily for every user; hourly ThredUp and eBay checks on paid plans; support says "We rotate through marketplaces every 15 minutes" | pricing and support pages | *observed* (claims) |
| Credits: photo search 2, AI Fast 4, Thinking 15; standard search free, 50 a day | pricing page | *observed* |
| `llms.txt` exists; `agent.txt` returned 404; sitemap and robots are public | the files | *observed* |

## ThriftX: what follows from it

| Deduction | Basis | Mark |
|---|---|---|
| A query becomes one call per marketplace: the eBay Browse API for eBay, a proxy-fetched page or feed for the others | Browse API and ScrapingBee are the only two data services named | *inferred* |
| Ranking and the photo check are LLM calls, billed to the person as credits | OpenAI named; credits priced per mode | *inferred* |
| Dedupe is by title and image match, done after the fetch | "Also listed on" plus a vision model; no catalog id is mentioned | *inferred* |
| A watch is a stored query on a scheduler, not a push feed; "every 15 minutes" is the site rotation, not the per-watch rate | daily versus hourly plan text against the support line | *inferred* |

## What we take

| Their part | Ours, and where | Same or better |
|---|---|---|
| Fan-out to marketplaces through proxies and one official API | the source registry and router ([data](../../../spec/features/data.md)), eBay Browse as one route | better: each route is measured and falls back; theirs is one proxy |
| Cross-site dedupe by title and image | product cluster, price band and photo hash ([watch](../../../spec/features/watch.md)) | same method, better key: a product id first |
| Watches daily, hourly on paid plans | Lakeflow schedule, "within the hour" ([watch](../../../spec/features/watch.md)) | better for free users; same as the paid tier |
| Credits for AI modes | no meter on the person's search ([buy](../../../spec/features/buy.md)) | different: we do not charge per search |
| One result list with "also on" | one result per offer, grouped under the product ([buy](../../../spec/features/buy.md), [market](../../../spec/features/market.md)) | better: sold prices and fair range sit beside the offers |

## Gem and Phia (brief)

- **Gem.** Behind an AWS WAF challenge (HTTP 202, empty body, `x-amzn-waf-action: challenge`) on 2026-11-14. Not bypassed, so nothing about its pages is *observed*. The only reading of its cadence is ThriftX's guides, which say it crawls daily (*asserted*), matching [watch](../../../spec/features/watch.md) row "Cadence against the finders".
- **Phia.** Next.js on Vercel. Apollo GraphQL at `/v2/graphql` and an outbound `/redirect` route, both disallowed in robots (not called). Firebase, PostHog, Statsig, Mixpanel, Sentry, reCAPTCHA Enterprise, OneLink and a Chrome extension are named in the page. Sitemaps list products, brands, editorials and deals. `llms.txt` returned 404. All *observed*. Its shape (a catalog behind GraphQL, an extension, deal pages) matches what [the Dupe note](dupe-observed-in-browser.md) saw.

## The 25 open items

| # | Item | Verdict | Evidence, deduction or exact check | Corrects |
|---|---|---|---|---|
| 1 | treg success rate per route | measure | Call events carry `async_outcome` (success, failure, billed_failure) and `error_class`, segmented by input type and domain class (treg repo `docs/context/architecture/`, *observed*). Measure: success over 7 days per segment. A segment under the router's floor moves to our own route. | [data](../../../spec/features/data.md) "Source registry and router" (treg published no figure: kept) |
| 2 | treg speed | measure | Same events carry duration; child health demotes a slow provider (catalog.md "Child guards", *observed*). Measure p95 per segment against the latency ceiling. | none |
| 3 | Does a treg rule keep a failing provider | settled | route-rules.md: "A rule orders; it does not keep a failing provider in the plan" (*observed*, repo file). | confirms [data](../../../spec/features/data.md) "rules only reorder" |
| 4 | Dupe search response shape | settled | UCP `catalog_search` returns `{ucp, products[], pagination, messages[]}`; refinement passes the returned `hash` back with `is_refinement: true` (`/.well-known/ucp` and SKILL.md, *observed*). | answers "Not checked" in [the Dupe note](dupe-observed-in-browser.md) |
| 5 | Dupe ranking fields | check | Not in any public file. Read `https://ucp.dev/2026-04-08/schemas/shopping/types/product.json`, then one anonymous `search_products_by_text` call on `mcp.dupe.com/mcp` (documented anonymous, free). | none |
| 6 | Dupe agent access | settled | Streamable-http MCP at `https://mcp.dupe.com/mcp`; anonymous tools `search_products_by_url`, `_by_image`, `_by_text`, `search_catalog`, `lookup_catalog`; `get_product_details` and `get_product` need a key (server card, *observed*). | teardown row "Agent access: not found" |
| 7 | Dupe price freshness | settled | Retailer feeds "refreshed on the order of hours" (Dupe's own file, *observed*). | none |
| 8 | Accepted Best Offer price on eBay | settled | Terapeak sold price includes accepted-offer results, about 3 years of sold data (eBay help id 4853, *observed* via Exa, Chinese text). | [market](../../../spec/features/market.md) if it lists this as unknown |
| 9 | How 130 Point gets accepted-offer amounts | check | About page names the sites searched, not the method. Search one known accepted-offer eBay sale on 130point.com and compare to the listing's offer history. | none |
| 10 | Terapeak window | settled | 3 years sold; ended-listing search 90 days; sell-through for searches of 90 days or less; Sourcing Insights needs a Basic Store or higher (*observed*, same page). | none |
| 11 | Facebook title limit | settled | Three surfaces, not three values. Partner catalog: "Character limit: 200" (Meta Item API docs, *observed*) and "200, but we recommend a maximum of 65" (Catalog Fields, *observed*). Consumer form: about 99, a warning at 100 (Sellura, 2026, *asserted*). 150 has no source. | [listing-and-marketing](../../../spec/determinations/listing-and-marketing.md) line 791 "99, 100 or 150" |
| 12 | eBay title limit 80 | check | Only third parties say 80 (*asserted*); help pages sit behind a bot wall. Type 81 characters in the eBay sell form and read the counter. | none |
| 13 | Poshmark title limit 80 | check | A seller blog quotes "Poshmark help center lists 80 characters max" (*asserted*). Type 81 in the Poshmark listing form. | none |
| 14 | Mercari title limit 80 | check | Third parties, 80 with about 40 to 50 shown on mobile (*asserted*); help page returned 403. Type 81 in the Mercari form. | none |
| 15 | Vendoo plans and features | settled | Starter $14.99, Growth $29.99, Pro $59.99 monthly ($12.49, $24.99, $49.99 yearly); all have unlimited items, auto delist and analytics; Growth adds AI listing enhancement and bulk actions; Pro adds auto offers and sharing (vendoo.co/pricing, *observed* via Exa). `/features` is a 404. | [crosslister teardown](../../cross-cutting/nate/crosslister-teardown.md) if it gives other prices |
| 16 | List Perfectly plans and auto delist | settled | Simple $29, Business $49, Pro $69, Pro Plus $99+; Auto Delist is not on Simple (pricing page matrix, *observed*). | none |
| 17 | Nifty pricing | settled | Automation $39.99 ($25 for Poshmark or eBay only), Bundle Plus $69.99 (pricing page, *observed*). | none |
| 18 | Delist latency of crosslisters | measure | No vendor page states it. List one item on two sites through the tool, sell one, time the other's removal. A median over a few minutes keeps the "sold elsewhere" alert design; hours changes it to a pull on our own route. | [crosslister teardown](../../cross-cutting/nate/crosslister-teardown.md) |
| 19 | Firecrawl monitor cadence | settled | A monitor takes a cron schedule (example `*/30 * * * *`), reports `estimatedCreditsPerMonth` (example 2880) and `retentionDays` (docs, *observed*). | none |
| 20 | Visualping cadence | settled | Plans check as often as every 60, 15, 5 and 2 minutes (150 to 10,000 checks a month; pricing page, *observed*). | [new-listing-detection](new-listing-detection.md) if it names another floor |
| 21 | Shopify Global Catalog | settled | Endpoint `https://catalog.shopify.com/api/ucp/mcp`; a Storefront Catalog is scoped to one merchant; both implement UCP Catalog (shopify.dev/docs/agents/catalog, *observed*). | none |
| 22 | eBay saved-search notices and reads | check | Help page returned "Something went wrong". Open eBay Help "Saving searches" in a browser and make one saved search with email on. | none |
| 23 | EPN rate card | check | Bot wall ("Pardon Our Interruption"). Open the eBay Partner Network rate-card page signed in as a partner. | none |
| 24 | ThriftX dedupe and photo-check accuracy | measure | No vendor figure. Run 50 real queries on both and count wrong merges and missed merges. Below 0.95 precision ([watch](../../../spec/features/watch.md)) changes the dedupe key. | [teardown](teardown-search-and-similar-finders.md) "precision 0.95" |
| 25 | A browser extension that checks a listing on any site | owner | Dupe and Phia both ship one; it is the natural surface for "the better official option". Recommendation: Nate decides; the data it needs already exists. | [the Dupe note](dupe-observed-in-browser.md) "open" row |

## Not found

- ThriftX: no `agent.txt`, no public API, no client-side API host.
- Gem: not reachable (WAF challenge); no first-hand page.
- Phia: no `llms.txt`.
- Dupe: ranking fields and affiliate link format; `auth.md` was not read.
- eBay, Poshmark, Mercari and Facebook help pages for title limits: bot walls, 403 or CSS-only. eBay saved-search and EPN pages: blocked.
- Vendoo `/features`: 404. Delist latency: stated by no crosslister.
- 130 Point's method for accepted offers.

## Sources fetched

- https://www.thriftx.shop (home, support, pricing, guides, privacy, sitemap, robots, llms.txt) and its `agent.txt` (404)
- https://www.phia.com (page, robots, sitemaps) and `/llms.txt` (404)
- https://www.dupe.com `/.well-known/ucp`, `ai-catalog.json`, `api-catalog`, SKILL.md and the server card for https://mcp.dupe.com/mcp
- https://ucp.dev/2026-04-08 UCP OpenRPC
- https://github.com/superdesigndev/treg `docs/context/architecture/` (route-rules.md, catalog.md)
- https://www.ebay.com/help id 4853 (Terapeak) via Exa
- https://130point.com about page via Exa
- Meta Item API and Catalog Fields docs (Facebook title limits)
- https://www.vendoo.co/pricing; https://listperfectly.com pricing; https://www.nifty.ai pricing
- Firecrawl change-tracking and Monitor docs; https://visualping.io/pricing
- https://shopify.dev/docs/agents/catalog
- Third parties for title limits: glammlist.com, quicklistai.org, vendoo blog, merchyak, Sellura
- Blocked or empty: gem.app, Facebook help, eBay help (title, saved searches), EPN rate card, Mercari help, Poshmark help, Flyp
