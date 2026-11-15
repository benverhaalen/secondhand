# How do ThriftX, Dupe.com and the other cross-marketplace and similar-item finders work underneath, and how would we rebuild or beat them?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: watch.

Marks: *observed* (opened at the URL), *asserted* (vendor or third party says so, or snippet only), *inferred* (my reasoning, basis given). Where I lack a fetched page I say "snippet only". Product-level facts are in earlier notes and are not repeated: [buy-side products](buy-side-products-and-search-experience.md) (Dupe.com table lines 10-19, notes lines 29-37, arXiv 2601.11769 figures), [crosslister teardown](../../cross-cutting/nate/crosslister-teardown.md), [treg routing](../../cross-cutting/nate/treg-tool-routing.md) (Lens routes lines 71-72, 151), [Shopify catalog and agentic commerce](shopify-catalog-and-agentic-commerce.md). The brief names `spec/features/market-insight.md`; that file does not exist, so the nearest specs (`market.md`, `insights.md`) are used.

## 1. ThriftX

1. Inputs and coverage. Live search of six marketplaces on each query, no owned index. *Asserted*: ThriftX's own guide, https://www.thriftx.shop/guides/search-all-thrift-apps. Scraping goes through the ScrapingBee proxy API, ranking through OpenAI; *asserted* (ThriftX privacy page lists processors, https://www.thriftx.shop/privacy; terms https://www.thriftx.shop/terms). Freshness is as of the query, so it is only as old as the request. Coverage per query is whatever each site returns on page one (*inferred*: no index means no deeper recall).
2. Pipeline. Query goes to per-site scrapers in parallel, results are merged, an LLM ranks or filters. Search types are credit-metered: image 2 credits, AI Fast 4, Thinking 15 (*asserted*, ThriftX pricing and guide pages above). Cross-posted items are collapsed to the cheapest listing with an "Also listed on" note (*asserted*, same guide). The dedupe algorithm is not published; *inferred* from the cheapest-wins and note behaviour that it matches on title plus image, not on a product id.
3. Prices. Asking prices only. No sold history seen (*inferred*, none described in any ThriftX page I read). Cross-post collapse is the only price logic.
4. Shown and asked. Query text or photo; a results grid with source badge and the cheapest copy. Watches re-run daily, hourly for ThredUp and eBay on paid plans (*asserted*, guide). Fair use 50 searches a day (*asserted*, terms).
5. Money. Subscription plus credits. The vendor guide says marketplaces pay a small commission while the App Store listing says "No affiliate tricks"; the two disagree (*asserted*, both; I could not open the store page, snippet only).
6. Performance. Nothing published on latency or photo accuracy. Not found.
7. Weak points. *Inferred* from the design: every query costs a proxy call per site, so cost scales with use (hence credits); page-one-only recall; blocked or changed pages break a source silently; terms forbid scraping ThriftX itself (*observed*, terms page).
8. Rebuild and beat. Match: per-site fetchers behind a proxy, a ranking call, a cheapest-copy collapse. Beat: use official APIs where they exist (eBay Browse), keep our own index of what the app has already seen so repeat watches cost nothing, cluster by image embedding plus price band (see section 8), and add sold comps so "cheapest" is shown against "fair". All *inferred* from the spec hooks in `watch.md` and `data.md`.

## 2. Dupe.com

1. Inputs and coverage. Image, product link or text. Scale "47M+ products and 70,000+ retailers" (*observed*, https://dupe.com/about, Oct 2026); an earlier source said 5,000+ retailers in 2025-09 (*asserted*, https://dupe.com/blog/finding-dupes-with-dupe-com). Sources are partner catalogs and affiliate feeds plus live scraping (*asserted*, same blog). Price refresh "on the order of hours" (*asserted*, https://dupe.com/faq).
2. Pipeline. Visual and attribute similarity, then ranking on similarity, price and commercial factors with a per-retailer cap (*asserted*, blog and FAQ). The embedding model and vector store are not named anywhere I read: not found. Published accuracy is the third-party arXiv paper in the earlier note (P@6 51.1 to 54.5 against Lens 31.4, Success@6 83.0 percent), not re-fetched here.
3. Prices. Dupes are "similar for less", so price is a ranking input and a headline, with saving shown. No sold or history logic seen (*inferred*, none in FAQ or blog).
4. Shown and asked. Upload or paste, ranked visual grid. Agent surface: MCP server https://mcp.dupe.com/mcp, UCP manifest at https://dupe.com/.well-known/ucp (version 2026-04-08), `agent.txt` and `llms.txt` (*observed*, fetched). Agent skill at https://dupe.com/.well-known/agent-skills/find-dupes/SKILL.md (*observed* in listing, content not read).
5. Money. Affiliate links (*asserted*, FAQ and blog).
6. Performance. See item 2; the 47M and 70,000 figures are the vendor's.
7. Weak points. Ignores material and build: the CTO blog calls dupes a "different maker" while the CEO says "same factories", and whether any material extractor exists is not found (*asserted*, two sources conflict). Retail catalogs mean new goods, so used-item recall is weak (*inferred* from catalog sources).
8. Rebuild and beat. Match: CLIP, SigLIP or fashion-clip image embeddings (open) in Qdrant or FAISS, plus attribute filters, plus a retailer cap in rerank. Beat: multi-vector (image plus title plus attributes) with reciprocal-rank fusion; Coupang found image and text matches complementary (*asserted*, https://medium.com/coupang-engineering/matching-duplicate-items-to-improve-catalog-quality-ca4abc827f94); Qdrant documents the pattern (*asserted*, https://qdrant.tech/e-commerce/). Add used-market sold comps, which a feed-based dupe finder lacks. *Inferred*.

## 3. Gem
Crawls once a day plus feeds and APIs, obeys robots.txt, Elasticsearch index, Puppeteer for JS-heavy sites; saved search sends an alert with an arrival estimate; scale quoted 45M, about 50M and 150M+ in different places (*asserted*, https://gem.app/about, https://gem.app/for-stores, and ThriftX's competitor guides https://www.thriftx.shop/guides/thriftx-vs-gem, which are biased). Money and price handling not found. Weak point: daily staleness (*inferred* from crawl cadence). Beat: event-driven new-listing checks, see [new-listing detection](new-listing-detection.md).

## 4. Phia, Beni, Encore, Croissant
- Phia: a price-position label (high, typical, fair) against "250M items across 40,000+ sites" (*asserted*, https://techcrunch.com/2026/01/27/phoebe-gates-and-sophia-kiannis-phia-raises-35m-to-make-shopping-fun-again/, https://www.forbes.com/sites/emmasandler/2025/04/24/phia-a-shopping-app-from-two-stanford-grads-launches-amid-resale-boom/, snippets only). The "patented" method: patent not found.
- Beni: browser extension that matches the item you view to 30 to 40+ resale sites, normalises sizing, uses Google Vision Product Search (*asserted*, https://techcrunch.com/2022/12/13/beni-secondhand-shopping/, https://startup.google.com/alumni/stories/beni/).
- Encore: GPT-4 plus a fine-tuned model that refines the query; 2 to 10 percent affiliate commission (*asserted*, https://techcrunch.com/2024/11/10/encore-is-an-ai-powered-search-engine-for-your-thrifting-needs/, https://www.wired.com/story/encore-ai-powered-search-vintage-secondhand-shopping/). Its "hundreds of sites" method: not found.
- Croissant: data lake of listing and sold prices, buyback pricing by brand, category, seasonality and materials (*asserted*, https://www.modernretail.co/marketing/how-croissant-is-trying-to-bring-more-retailers-into-the-resale-space/, https://croissant.com/faqs). Closest to a sold-price registry among these; B2B, not a consumer finder.

## 5. Lyst and ShopStyle
Lyst runs as a Comparison Shopping Service with about 1,500 feeds and 98M products, and ranking by commission bid (*asserted*, https://lystpartnersupporthelp.zendesk.com/hc/en-us/articles/16211009849884-HOW-DOES-CSS-WORK-ON-LYST, https://www.glossy.co/fashion/how-the-lvmh-backed-aggregator-lyst-does-business/). ShopStyle: affiliate network and catalog (*asserted*, https://medium.com/shopstyle-collective/what-is-shopstyle-collective-9167600dc27). Both are new-goods feeds; the lesson is the feed-plus-bid economics, not a used-item method.

## 6. Google Lens and Shopping Graph
Shopping Graph 50B+ listings, 2B+ refreshed per hour, fed by Merchant Center feeds plus crawl; Lens about 20B searches a month; "visual search fan-out" (*asserted*, Google statements via https://productrise.app/blog/google-shopping-graph-explained, secondary; the "60B" figure there is asserted only). Lens model internals not found. Programmatic access routes (Serper, AnyAPI, SerpAPI, DataForSEO) are priced in [treg routing](../../cross-cutting/nate/treg-tool-routing.md).

## 7. Alert and fan-out tools
GrailHound, Copit, SearchTempest, FlowMarket, Filtrs, Prowl, Swoopa, Flipify: live fan-out or saved-search polling with push alerts (*asserted*, https://grailhound.app/, https://copit.to/alternatives/copit-vs-grailhound, https://copit.to/alternatives/best-marketplace-alert-tools, https://www.searchtempest.com/; the Copit pages are a competitor's marketing). Methods inside each: not found beyond polling frequency claims. Coverage of Facebook Marketplace by these tools is not verified here.

## 8. Specialised registries, the open-source method
The pattern all of these share, *inferred*: a registry is a table of (source, route, cost, freshness, truth rate) plus a matching index. Our `data.md` Source registry and router already has `route_table`, `route_call`, `route_day_stat`, `route_truth`, `ranker_model`. Registry types the finders suggest: a product-cluster registry (image vector plus attributes plus price band, as in `watch.md` dedupe, target precision 0.95); a sold-comp registry (Croissant's data lake idea, `price.md`); a retailer or feed registry (Lyst CSS idea). Open parts: CLIP, SigLIP, fashion-clip embeddings; FAISS or Qdrant; pHash for near-identical photos; rembg for background removal; a human review queue for borderline pairs, as Coupang describes.

## Searched / could not reach
Not found: Dupe.com embedding model, vector store and similarity scale; ThriftX dedupe algorithm, photo-check method, accuracy and latency; Phia patent; Encore method; Lens internals; any Dupe.com material extractor; Gem and ThriftX money and price handling beyond the above; method detail for the alert tools. Not read: anything behind sign-in, app store pages (snippets only), most press pages (snippets only). Unopened or snippet-only: Phia, Beni, Encore, Croissant, Lyst, ShopStyle, Google, alert-tool links above.

## Table for the lead
| capability | who does it best and how (mark) | method to match | method to beat | needs | in our spec |
|---|---|---|---|---|---|
| Live cross-site search | ThriftX, scrape plus proxy plus LLM rank (asserted) | per-site fetchers, parallel, merge | official APIs first, own index of seen items, scrape as fallback | proxy, eBay Browse API, registry | partly: `data.md` router, `buy.md` fanout stage |
| Image to similar item | Dupe.com, visual plus attribute, 47M items (asserted) | CLIP or SigLIP embeddings in Qdrant | multi-vector with RRF, used-market sold comps | embeddings, vector store | `buy.md` `like` search via photo embedding; `market.md` lines 24, 43 |
| Cross-post dedupe | ThriftX cheapest-wins plus note (asserted) | title plus image match | image vector plus price band plus pHash, "Not the same" undo | pHash, vectors | `watch.md` (precision 0.95) |
| Price position | Phia label (asserted); Croissant sold data lake (asserted) | compare to asking set | sold comps with confidence and outlier trim | sold-price source | `price.md`, `score.md` |
| New-listing alerts | Gem daily crawl (asserted); ThriftX daily/hourly (asserted) | scheduled re-run | event-driven checks, per-source cadence by route stat | scheduler, `route_day_stat` | `watch.md`, `data.md` |
| Agent access | Dupe.com MCP, UCP, llms.txt (observed) | expose search as MCP tool | publish our registry as a tool | MCP server | not found in spec; check `data.md` |
| Feed economics | Lyst CSS, commission-bid ranking (asserted) | affiliate feed ingest | rank on fit first, disclose commission | feed accounts | see [affiliate note](buyer-side-actions-and-affiliate.md) |

## Sources fetched
Observed pages: https://dupe.com/about, https://dupe.com/agent.txt, https://dupe.com/llms.txt, https://www.thriftx.shop/terms, https://www.thriftx.shop/privacy. All other URLs above are search results, marked asserted.
