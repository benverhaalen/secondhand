# How would one search box across every secondhand market work, and how does it share the pricing engine?
Researched 2026-11-14 by Ben (Claude Code agent, project thread "Research market-value pricing and appraisal"). Feature: watch.

Ben: "use it as like an amazon search box for anything across all second hand markets" ([words](../../../product/words.md#2026-11-14-search-box)). The tools that already try this are in [existing-tools.md](../../appraise/ben/existing-tools.md) under "Cross-market search". Exa monitors and alerts are researched in another thread and are not repeated here.

## Why it is the same engine as pricing

Inferred. A search result is a listing. A good result is a listing whose price is low **relative to its fair value for that exact identity and condition**. Fair value is what [price](../../../features/price/) and [appraise](../../../features/appraise/) compute. So all three read one index of identity-resolved listings, sold and active:

| Use | Reads | Writes |
|---|---|---|
| Price (sell) | Sold comps for my item | My listing, later its sale |
| Appraise (buy, in person) | Sold comps for the item in front of me | Purchase cost, later the sale |
| Search (buy, online) | Active listings matching my want, each scored against sold comps | Saved wants, clicks, purchases |

Every listing the search crawls is also a future comp once it sells. Search feeds pricing.

## What "Amazon-like" requires that marketplaces don't give

Amazon works because every offer attaches to one catalogue product (ASIN) and is comparable. Secondhand listings have no shared catalogue, inconsistent titles, mixed currencies and shipping, and the same physical item cross-listed on several sites. To feel like one store:

1. **Query understanding.** "Brewers jersey under $40 that fits like a large" becomes identity constraints (team, item type, era if any), attribute constraints (size by measurement, condition floor), and a price cap. Ask one tap question when the query is ambiguous (home or away? authentic or replica?).
2. **Identity resolution on every listing.** Extract brand, model, variant, size, condition and drivers from title, item specifics and photos into one schema. Without this, ranking and dedupe are guesswork.
3. **Dedupe cross-listings.** Resellers crosslist (Vendoo, List Perfectly exist for this; observed in [direct-references.md](../../cross-cutting/ben/direct-references.md)), so one jacket appears on eBay, Poshmark and Depop. Cluster by image similarity plus seller and title, then show one card with "on 3 sites, cheapest total on Poshmark".
4. **Normalise the price.** Total to the buyer including shipping, tax where known, in the user's currency; for local items, distance. everygrail already shows "cheapest first, in your currency" (observed).
5. **Rank by deal, not by price.** Score = fair value (from comps for that identity and condition) minus total price, adjusted for fit to the want and seller trust. Show "$32 · typically $45–60 sold" on each card. Phia's "high, typical or fair" is the closest existing pattern (observed, digitalcommerce360).
6. **Fit for clothing.** Filter by measured dimensions, not tag size, using [measure](../../../features/measure/).
7. **Freshness.** Good secondhand deals go fast. Cached results need a "checked 2 min ago" stamp and a re-check before the user commits.

## Feed vs fan-out

The Owl and Twig guide splits existing tools into ones that "collect listings into their own feed" and ones that "send your search to each site" (observed; written by Prowl's maker).

| | Own index (feed) | Live fan-out |
|---|---|---|
| Speed | Fast, rankable, dedupable | As slow as the slowest site (Depop ~5 s per search in secondhand-mcp, observed) |
| Freshness | Stale between crawls | Live |
| Coverage | Only what you crawled | Whatever each site's search returns |
| Pricing link | Every row can be valued in advance | Value on the fly |
| Blocking risk | Crawling at scale is what gets blocked | Per-query, lower volume |

Proposal (inferred): **hybrid**. Keep an index of active and sold listings for the categories the app focuses on, refreshed continuously, and fan out live to each site for the user's query at the same time. Merge, dedupe, score, and show index results first while live results stream in. Write live results back into the index. This also gives the monitor feature a cheap way to detect "new since last check".

## Where Exa fits

Observed (exa.ai docs): `/search` has `includeDomains`, JSON `outputSchema` (adds "about 2 seconds"), and no product or marketplace category; Websets are verified entity lists that "finish in minutes" with monitors that run "at most once per day".

Inferred: Exa is a good fallback for the long tail (small vintage shops, Etsy-like sites, collector forums that the index does not cover) and for daily "anything new like this" digests. It is not the primary engine for an interactive, price-ranked search over the big marketplaces. The interface shape is worth copying: a natural-language query, a few verified criteria, and structured fields per result.

## Limits

I did not test any marketplace's search API or scraper. Coverage, block rates and terms of service per site need a hands-on check, ideally in the tool-research thread.
