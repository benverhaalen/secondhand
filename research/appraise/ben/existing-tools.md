# Who already appraises, prices or searches across secondhand markets, and what do they leave open?
Researched 2026-11-14 by Ben (Claude Code agent, project thread "Research market-value pricing and appraisal"). Feature: appraise.

Who already prices, appraises, or searches across secondhand markets, and what each one leaves open. Pricing UX of eBay, Mercari, Facebook Marketplace and StockX is in [direct-references.md](../../cross-cutting/ben/direct-references.md) (Flow 4) and is not repeated here.

## Photo-to-value appraisal apps (closed source)

| Tool | Inputs | Outputs | Data | Speed and price | Evidence |
|---|---|---|---|---|---|
| **FlipTip** | Photo, 3-photo multi-scan, batch, barcode, live AR "Treasure Radar" | Low–high value, "Real completed sales" with dates, expected sale price, "The most to pay", profit after fees, sell-speed score, "Worth it" / "Skip", fake flags; "Sale X-Ray" values a whole estate sale from photos | "real sales on 12+ marketplaces"; eBay completed sales where eBay operates | "30–70 seconds"; free 3 scans/day, $9.99 to $39.99/mo | observed (fliptip.ai); speed and accuracy asserted. A blind test page exists at fliptip.ai/accuracy (not opened) |
| **Underpriced** | Photo on the shelf, barcode, listing screenshot, or typed name | Resale estimate, fees, shipping, net profit, ROI, buy or skip, per platform | eBay sold and active; blog claims eBay, Poshmark and Mercari with "automatic failover" | 5 free checks; $9.99 to $24.99/mo; "isn't a certified appraisal" | observed (Play listing); blog claims asserted (founder-written) |
| **FlipperScanner** | Photo, image URL, multi-item photo | Low / mid / high, confidence level, link to eBay sold | "recent eBay sold listings" only | "10-20 seconds" for multiple items; free 5/day, $19.95 to $149/mo | observed (flipperscanner.com); site stats show "0" placeholders |
| **Flipper Vintage** | Typed name, photo of the tag, or a spreadsheet/PDF list | Value, how fast it sells, best place to list, how sure | "300M+ real sold resale listings" across eBay, Depop, Grailed, Poshmark, Mercari, Vinted, Vestiaire, StockX | Single lookups "instantly"; US data only; "no sell-through claim" | asserted (ChannelX trade write-up, July 2026) |
| AtticHunt, Value AI, Price Snap, Valuify | Photo scanners | Value estimates | Unknown | — | unopened (store listings) |
| eBay app, Google Lens, Facebook Meta AI | Photo to listing or shopping results | eBay: price recommendation from recent sold; Lens: "price across retailers"; FB: local listed prices | Own platform | — | observed (in [direct-references.md](../../cross-cutting/ben/direct-references.md)) |

**Read (inferred):** the "photo → range → buy/skip → profit" loop is already a commodity. All of these are mostly eBay-sold-driven, single-shot, and stop at the verdict. None that I saw (a) asks the targeted physical check that resolves a hidden driver, (b) carries the appraisal into a cross-listed listing after purchase, or (c) learns from the user's actual sale outcomes. That is where secondhand can differ.

Agent proposal: see [garage-sale.md](garage-sale.md) for how.

## Cross-market search (the "Amazon search box")

| Tool | Coverage | How it gets data | Notable | Evidence |
|---|---|---|---|---|
| **Phia** | New and secondhand prices; at launch "more than 40,000 shopping sites"; later "indexed more than 350 million items across 5,000 brand partners", 640,000+ downloads | Not described beyond a "patented model"; partnerships with The RealReal, Vestiaire, ThredUp, Poshmark, eBay | Labels price "high, typical or fair"; tracks "how much secondhand value an item will retain"; fashion focus | observed (digitalcommerce360, Apr 2025; glossy.co, Dec 2025); figures asserted |
| **everygrail** | 24 sites incl. Grailed, Depop, Vestiaire, eBay, StockX, Vinted, Poshmark, Mercari JP, Bunjang | Not stated | "cheapest first, in your currency, with a price meter and a scam check on every listing"; photo search | observed (everygrail.com) |
| **Gem** | eBay, Etsy, Poshmark, Mercari, The RealReal, Vestiaire, indie shops | Aggregated feed | Free with alerts | observed (Owl and Twig guide, written by Prowl's maker) |
| **Prowl** | 24 marketplaces | Sends the search to each site; live listings from ShopGoodwill, eBay, Etsy, Chairish | "Price Check" opens eBay sold (90 days); does not appraise or alert | observed (same guide, self-described) |
| SearchTempest, Swoopa, Flipify | Facebook, Craigslist, eBay, OfferUp, Vinted, Mercari | Local fan-out | Swoopa $47 to $352/mo; deal-hunting for flippers | observed (same guide) |
| **Encore** | Poshmark, The RealReal, Grailed, Etsy, eBay | LLM search over typed queries | Affiliate revenue; 50,000 searches/month (Nov 2024) | observed (TechCrunch, Nov 2024; may be out of date) |
| **secondhand-mcp** (open source, MIT) | Facebook Marketplace (no auth), eBay (Browse API), Depop and Poshmark (headless Chrome, puppeteer) | Official API + scraping | MCP tool for Claude and others; "Depop ... ~5s per search"; hosted at secondhandmcp.com. **Same name as our project.** | observed (github.com/jlsookiki/secondhand-mcp) |
| **GrailSearch** (dev.to write-up) | eBay, Vinted, Depop, Grailed, Vestiaire, Poshmark | eBay Browse API; Vinted "reverse-engineered their internal endpoints"; others API and scraping | Fans out in parallel and merges; no dedupe described; readers reported 404s in Aug 2026 | observed (dev.to, updated 2026-11-11) |

The Owl and Twig guide (Prowl's maker, so interested) says: "Nobody has built one search box that reaches every place vintage gets listed." It splits tools into those that "collect listings into their own feed" and those that "send your search to each site" (observed). That split is the core architecture choice in [one-search-box.md](../../watch/ben/one-search-box.md).

**Read (inferred):** none of these joins search to valuation. They sort by price ("cheapest first") or show a price meter, but a cheap item in worse condition, or a different variant, is not a deal. Ranking by *price relative to fair value for that exact identity and condition* is the gap. Phia comes closest (high/typical/fair) and is fashion-only and buyer-only.

## Category price guides (closed, data-backed)

PriceCharting (games, cards), Discogs (records), WorthPoint (antiques and collectibles), Reverb Price Guide (music gear), StockX (sneakers), Card Ladder and Collectr (cards; Collectr's portfolio and alerts are in [adjacent-references.md](../../cross-cutting/ben/adjacent-references.md)). Details are in [sold-price-data.md](../../price/ben/sold-price-data.md). These win in their category because identity is solved by a catalogue ID (UPC, release ID, card number). The lesson for us: **where a catalogue exists, resolve to its ID first and use its prices; where none exists (most clothing, furniture, kitchenware), we have to build identity ourselves.**

## Open source and public research

| Item | What it is | Use for us | Evidence |
|---|---|---|---|
| Mercari Price Suggestion Challenge (Kaggle, 2017–18) | 1.4M+ US Mercari listings (asserted, from memory) with name, condition, category, brand, shipping, description; winner RMSLE 0.3875 with a small MLP over sparse text features under kernel-time limits | A public training set and baseline for text-to-price; shows text features carry most of the signal. Mercari says the winner did not transfer to Japanese data | observed (engineering.mercari.com, 2018); dataset size asserted from memory |
| secondhand-mcp, GrailSearch | Scrapers and fan-out search | Starting connectors for Depop, Poshmark, Facebook | observed |
| eBay SDKs (`ebay-api` npm and others) | Browse API clients | Active listings and image search | unopened |
| Apify actors for Depop, Poshmark, Discogs, PriceCharting | Paid hosted scrapers | Fast way to get sold data for a demo; check ToS | unopened |
| Ximilar, cardgrade.io and similar | Card pre-grading APIs (commercial) | Pattern for per-aspect condition scoring | observed (ximilar.com) |
| Hedonic and comp-selection literature | Real estate valuation | Method for comps and adjustments ([adjacent-valuation.md](../../price/ben/adjacent-valuation.md)) | observed |

No open-source general secondhand valuation engine turned up in these searches. That is consistent with the data being the hard part (inferred).
