# Where can sold and asking prices come from, and what does each source allow?
Researched 2026-11-14 by Ben (Claude Code agent, project thread "Research market-value pricing and appraisal"). Feature: price.

The model is the easy part. Getting **sold** prices, with dates, condition and enough attributes to match identity, is the hard part. Asking prices are cheap and plentiful but biased upward and include items that never sell.

## Sold vs asking

- **Sold** prices are what the market paid. They are the ground truth for value. Most platforms hide them or show them only to logged-in users.
- **Asking** prices show supply and the current competition. Facebook Marketplace's suggested price is "based on similar items listed in your area", i.e. asking, not sold (observed, about.fb.com, March 2026, via [direct-references.md](../../cross-cutting/ben/direct-references.md)).
- **eBay "sold" can hide the real price.** When a Best Offer is accepted, eBay search shows the original asking price struck through, not the accepted amount (asserted, from memory; the eBay community threads "Best Offer Accepted sold comps displaying weird" and "Why don't Sold comps for accepted offers..." are unopened). Third-party tools such as 130point exist to recover these. Comps that ignore this overstate value on Best Offer listings (inferred).

Rule (inferred): price from sold comps, use asking listings for liquidity (how much competition) and for the search box, and always label which is which.

## Sources

| Source | What it gives | Access | Limits and risks | Evidence |
|---|---|---|---|---|
| **eBay Marketplace Insights API** | Sold items by keyword, GTIN, category or product: "sales history of eBay items that have been sold up to 90 days in the past" | "(Limited Release) API available only to select developers approved by business units"; categories must be whitelisted per partner | 90-day window; approval is not likely in hackathon time | observed, developer.ebay.com MI overview |
| **eBay Browse API** | Active listings, search by keyword, filters, and search by image | Free developer account; a 2026 blog says 5,000 calls/day | Active only, "does not return sold listings". Production use of Buy APIs is Limited Release for many | observed (apiserpent.com blog, Oct 2026, a competing vendor; eBay community reply quoted there) |
| eBay Finding API (`findCompletedItems`) | Was the old free route to completed items | Gone | Decommissioned Feb 5 2025, per an eBay forum post quoted in the blog above | asserted (the blog quotes an eBay forum post; forum post unopened) |
| **eBay API licence** | — | — | The same blog reads licence §9.5 as restricting use of eBay content "to suggest or model prices", and §8.1.3 as requiring listing data no more than six hours old. **Read the licence itself before building on eBay data in production.** | asserted (blog's reading), not verified |
| eBay Terapeak (Product Research in Seller Hub) | Up to three years of sold data with sell-through and averages | Free for sellers, in Seller Hub, no API | Manual; good for building the value-driver lexicon by hand for a few categories | observed (Prowl guide on owlandtwigvintage.com mentions "three years"); other details asserted from memory |
| **130point** | eBay sold search, last 90 days "as per eBay's available sales history", up to 10,000 results, search operators | Free website | Whether Best Offer amounts are included is not stated on the page | observed (130point.com/sales) |
| **WorthPoint** | "approximately 1 billion historical sales records" from auction houses and online marketplaces; Price Guide back to 2006 | Paid subscription | Antiques, art, collectibles; site gives two different counts (1B records vs 610M items) | observed (worthpoint.com) |
| **PriceCharting / SportsCardsPro** | Video games (Loose, CIB, New, Graded), cards by grade, "sales-volume" per year; method uses recent, median, average and age-weighted prices, removes outliers and junk keywords | Paid API, 1 call per second, "licensed for internal use only", current values only | Prices exclude shipping; no history via API | observed (pricecharting.com methodology and price-guide pages) |
| **Discogs** | Records: marketplace and release database; `/marketplace/price_suggestions/{release_id}` with a personal token | Free API with token | Whether suggestions are per condition grade was not confirmed from Discogs' own docs (from memory: yes, keyed by grade) | observed (endpoint path, in an R wrapper on rdrr.io); per-grade is asserted from memory |
| Reverb Price Guide | Music gear, transaction-based (asserted, from memory) | Unclear | Page did not load (redirect) | asserted (from memory) |
| StockX / GOAT | Sneakers and streetwear last sale, bids/asks | No public API (asserted, from memory) | Deadstock focus; scraping blocked | asserted (from memory) |
| **Depop, Poshmark, Mercari, Grailed, Vinted** | Sold items are visible on the sites to varying degrees | No public sold APIs; many Apify actors advertise "sold" scraping for Poshmark and Depop | ToS risk, rotating auth (GrailSearch author: "their auth tokens rotate"), page changes | unopened (Apify actor titles); observed (dev.to GrailSearch post) |
| Facebook Marketplace | Local asking prices; secondhand-mcp has a `showSold` flag for Facebook only | Logged-out search page, may break | "May break if Facebook changes their frontend" | observed (github.com/jlsookiki/secondhand-mcp) |
| **Exa** `/search` and Websets | Web search with domain filters and JSON `outputSchema`; Websets build verified lists with enrichments and daily monitors | Paid | No marketplace or product category; sold data behind logins is not addressed; Websets small sets "finish in minutes"; monitors "at most once per day" | observed (exa.ai docs) |
| Our own users | Every listing the app creates, what it sold for, how long it took, which channel | Ours | Small at first; the only source with true condition and true outcome | inferred |

## What this means

Inferred.

1. **For the hackathon**, comps will come from (a) eBay sold search pages fetched by an agent or scraper, (b) category APIs where they exist (Discogs, PriceCharting), (c) Depop/Poshmark/Grailed pages fetched through Browser Use or similar. Label the demo honestly as research-grade data.
2. **For a product**, the licence and access questions decide the architecture. The likely durable paths are a data partnership or licensed provider for eBay sold data, category APIs, and our own outcome data. Flipper Vintage says it has "a database of 300M+ real sold resale listings" across eBay, Depop, Grailed, Poshmark, Mercari, Vinted, Vestiaire and StockX (asserted, channelx.world, July 2026), so third-party sold data at that scale exists to license or compete with.
3. **Our own outcomes are the moat.** Every sale through secondhand gives a fully labelled example: confirmed identity, structured defects, channel, list price, sold price, days to sell. No scraper gets the condition truth. Log all of it from day one (inferred).
4. **Shipping must be normalised.** PriceCharting excludes shipping; eBay comps mix free and paid shipping; Depop and Poshmark have their own norms. Compare total buyer cost and seller net, never the headline price (inferred; consistent with [psychology.md](../../cross-cutting/ben/psychology.md) §"normalize price-with-shipping").
