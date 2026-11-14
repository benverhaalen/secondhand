# What architecture should the "Exa search for market value" use, as of November 2026?
Researched 2026-11-14 by Ben (Claude Code agent, project thread "Research market-value pricing and appraisal"). Feature: price.

This is the recommendation that ties together [what-market-value-is.md](what-market-value-is.md), [sold-price-data.md](sold-price-data.md), [adjacent-valuation.md](adjacent-valuation.md), [garage-sale.md](../../appraise/ben/garage-sale.md) and [one-search-box.md](../../watch/ben/one-search-box.md). The whole design is **inferred**; the facts it rests on are marked in those notes. It is an agent proposal, not a decision.

## Summary

1. **Market value is a price-versus-time curve per channel, net of fees**, not one number. Show a range per channel, likely days to sell, and the comps behind it.
2. **Most pricing error is identity error.** The "things not super apparent" are finer-grained identity attributes (era, made-in, pressing, variant). Learn them per category from sold listings and ask the user to check the one that matters most.
3. **Comps beat models when you can show them.** Use a few close, recent, adjusted sales, written out, and refuse to price below a minimum, as MMR does.
4. **Sold data access is the binding constraint.** eBay's sold API is Limited Release with a 90-day window, and its licence may restrict price modelling. Depop, Poshmark, Mercari and Grailed have no public sold API.
5. **Exa is the wrong engine for comps and real-time appraisal, and the right shape for the interface.** Use it for long-tail research and daily digests.
6. **Price, appraise and search are one engine** reading one identity-resolved listing index.
7. **Photo → range → buy/skip is already a commodity** (FlipTip, Underpriced, FlipperScanner). Secondhand's edge is the targeted physical check, platform routing, and turning a purchase straight into a listing whose sale trains the engine.
8. **Name clash:** an open-source `secondhand-mcp` (secondhandmcp.com) already searches secondhand marketplaces.

## Pipeline

```
 sources                     index (Delta tables)                 engine                      surfaces
 ───────                     ────────────────────                 ──────                      ────────
 eBay Browse (active)   ┐    bronze: raw listing JSON + images
 eBay sold pages*       │      │
 Depop/Poshmark/Grailed │      ▼                                   1 identify (VLM + catalogue IDs)
   via Browser Use*     ├──► silver: one listing schema ───────►   2 retrieve comps (hybrid search)   ──► price slider
 Discogs, PriceCharting │      (status sold|active, price,          3 adjust (condition, drivers,     ──► appraise verdict
 Exa (long tail)        │       shipping, currency, sold_at,          time, channel)                  ──► search results
 our own sales ─────────┘       condition, defects[], drivers[],    4 aggregate to range per channel   ──► watch alerts
                                identity_id, embeddings)            5 pick next question (VOI)
                               gold: identity clusters,             6 abstain if too few comps
                                driver lexicon, adjustment factors
 * research-grade for the demo; check terms before production
```

### 1. Identify

- Resolve to a catalogue ID where one exists: UPC/GTIN, Discogs release, card number, sneaker style code, ISBN. Otherwise, to our own identity cluster.
- A vision model reads photos, labels and tags into the listing schema (brand, line, model, variant, size, measurements, condition aspects, defects, drivers). Return several candidates with probabilities; the user confirms (decided UX direction: never auto-commit an identity, in [direct-references.md](../../cross-cutting/ben/direct-references.md)).
- The same extractor runs on every crawled listing, so the user's item and the comps are described in the same vocabulary. This is what makes comps comparable.

### 2. Retrieve comps

- Hybrid retrieval: filter by category and hard attributes (identity cluster, size range), then rank by text-and-image embedding similarity and keyword match (keywords catch exact tokens like style codes and "Big E" that embeddings blur).
- Back off from fine to coarse identity until there are enough comps, as MMR falls back from trim. Each step widens the range.
- Weight by similarity and recency. Keep the shown set small (about 3 to 8, per the comp-count trade-off in [adjacent-valuation.md](adjacent-valuation.md)); use more in the background for the range.
- Drop junk (for parts, reproduction, lots, broken) and outliers, as PriceCharting does. Correct eBay Best Offer sales where the accepted price is known.

### 3. Adjust

- Per comp: `adjusted = sold_price × condition_factor × Π driver_factors × time_factor`, with each factor learned per category from paired sales and a hedonic model over listing text. Write each adjustment out for the user.
- Drop a comp whose total adjustment exceeds about 25% of its price (real-estate heuristic).
- Channel: compute per channel from that channel's comps when there are enough; otherwise translate from another channel with a learned channel ratio for the category, and widen the range.

### 4. Aggregate

- Weighted quantiles of adjusted comps per channel (p25, p50, p75) and a days-to-sell estimate from sold dates and active-listing counts.
- Net per channel after fees and shipping. The slider (speed vs price) reads a point on this curve.
- Confidence from the effective number of comps, their spread, and unresolved drivers.

### 5. Next question

- For each unresolved driver or condition aspect, estimate how much the range would move between its possible answers. Ask the top one as a one-tap card ("Does the label say Made in USA?"). Stop when the decision (list price, buy or skip) would not change.

### 6. Abstain

- Below a minimum number of usable comps (MMR's rule is 6 in a year and 2 in 90 days per trim), show "not enough sales to price this" with the nearest coarser band, and offer Deep research.

### Deep research (long tail)

An agent with web search (Exa), Browser Use and the marketplace connectors looks for identity clues and comps for items the index cannot price (a maker's mark, an obscure band tee). It writes what it finds back into the index with sources, so the next lookup is fast. This runs in the background and is budget-capped.

## Where Databricks fits (for [data](../../../features/data/))

Inferred, and to be reconciled with the Databricks research in research/data/ben/ (another thread):

- Bronze, silver and gold listing tables in Delta, with sold history as the core asset.
- Vector search over listing embeddings with hybrid keyword matching for comp retrieval. Databricks announced hybrid search GA for Mosaic AI Vector Search, and its docs now appear under an "AI Search" path (unopened; seen only in search result titles and URLs, verify).
- Batch jobs that learn the value-driver lexicon, condition factors and channel ratios per category, and that backtest the engine (see below).
- Model serving for the valuation endpoint; the vision extraction can call an external model.

## Evaluation

Holding out real sold listings and predicting their price from the rest is the obvious test, and it is cheap to run on Databricks:

- Metric per category: median absolute percentage error, and the share of true sold prices inside the shown range (target: the range's stated coverage, e.g. 7 in 10 like MMR).
- Report abstention rate alongside error, so the engine cannot look good by refusing hard items.
- Once secondhand has its own sales, compare predicted vs actual on those, which is the honest number.

## Hackathon cut (agent proposal)

Ben's words say not to trim feature scope ([words](../../../product/words.md#2026-11-14-scope)). This cut narrows **data**, not features: every surface works, on a few categories where identity is tractable and comps are plentiful.

1. Pick 3 categories: vintage tees (label and era drivers, Depop vs eBay differences), video games or records (catalogue IDs and a price API), and one local category such as furniture (Facebook asking prices, transport).
2. Seed the index with a few thousand sold and active listings per category, fetched once; label it research-grade.
3. Hand-write the first value-driver lexicon per category from those listings, then show the learned version if time allows.
4. Run the engine end to end: identify → comps → adjust → range per channel → one question → buy/skip or list.
5. Backtest on held-out sold listings and put the error on a slide.

## API shape

```
POST /value
  photos[], text?, answers{}?, mode: sell | appraise | search_result, location?
→ identity: candidates[{id, label, p}]
  by_channel: [{channel, p25, p50, p75, days_to_sell, net, n_comps}]
  comps: [{url, channel, sold_at, price, shipping, condition, adjustments[{reason, amount}]}]
  drivers: [{name, state: present|absent|unknown, effect}]
  next_question?: {text, options[]}
  confidence: low | medium | high, abstained: bool, reason?
```

The same response powers the price slider, the appraisal verdict (with `max_pay` added in appraise mode) and the "typically $45–60 sold" badge on search results.

## Open questions for Ben

- Is a research-grade scraped dataset acceptable for the demo, given platform terms? (Recommended: yes for the demo, clearly labelled, with licensed or partner data named as the production path.)
- Which 3 categories should the demo focus on?
