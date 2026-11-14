# Which technologies and data sources can identify an arbitrary used product (brand, model, variant, original retail listing and price) from photos and a scan, in parallel in the background, and how good is each?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: identify.

Evidence marks: *observed* = I opened the source and it says so. *asserted* = a source claims it without showing, or from memory. *inferred* = my reasoning. "Search highlight" means I saw the text in a search result excerpt and did not open the full page; that is weaker than observed and is labelled. Links I did not open are labelled unopened. Anything I did not see is in Not found.

Several fetch passes were summarised by tools that can drop exact values; where a number below matters, it is marked with how I got it.

## Relation to the existing notes

- Confirms: the Decisions API as a typed verifier with no rationale field, and `ai_decide` having no image input (`research/identify/ben/openai-decisions-api.md` lines 6-11 and 38). I did not re-test either (*asserted* here, carried over from that note).
- Confirms: the idea that image search alone never proves an exact match. Every image route below returns visually similar items or pages, not an identity (*inferred* from the route descriptions; the spec rule "Exact is never written from image search alone" is in `spec/features/identify.md`).
- Extends: Ben's note names SerpApi Google Lens and eBay `search_by_image` as sources. Below adds the status of the other image routes (several are retired or private-index only), the identifier routes (GTIN, RN, CA, cards), and the catalogue routes. None of these were costed in the earlier notes that I read.
- Contradicts: nothing found in the notes I read, but note the risk in Group 1 about Lens: it has no official API, so the existing dependence on a scraping vendor carries a litigation signal (Google v. SerpApi, below).

## Group 1. Reverse image and visual product search

| Route | Input | Returns | Cost / latency | Terms and status | Item kinds | Evidence |
|---|---|---|---|---|---|---|
| Google Lens | image URL or upload | visual matches, product cards with shop links and prices | no official API (*observed* absence: no Google API page for it was found) | via a scraper only | broad: clothing, goods, electronics | *observed* absence; see SerpApi row |
| SerpApi Google Lens | image URL | visual matches, products | paid plans; table saved at `scratchpad/f/serppricing.md` (plans table observed); per-search price not restated here to avoid a misquote. Legal Shield tier exists (*observed*) | Google sued SerpApi; the amended complaint was dismissed 2026-11-09 with 21 days to amend (*asserted*, news and docket summaries; primary order not opened) | broad | https://serpapi.com/pricing (*observed*, 2026-11) |
| Google Cloud Vision Product Search | image + your own product set | nearest products from a catalogue you upload | n/a | in maintenance mode (*observed*, Google docs page saved as `visionps.html`) | only items in your own catalogue | https://cloud.google.com/vision/product-search/docs |
| Vertex AI Vision incl. Vision Warehouse | n/a | n/a | n/a | deprecated 2026-06-15, end of life 2026-09-30 (*asserted*, third-party tracker with dates; Google's own notice not seen) | n/a | saved as `visiondep.html` |
| Google Cloud Vision Web Detection | image | web entities, pages with matching images, similar images | $3.50 per 1,000 images (*observed*, Google pricing page) | live | broad, weak on exact product | https://cloud.google.com/vision/pricing |
| Bing Visual Search / Search APIs | image | similar products | n/a | Bing Search APIs retired 2025-08-11 (*observed*, Microsoft page, saved as `bingretire.html`). A Windows Report headline implies 2026; Microsoft's page governs | n/a | https://learn.microsoft.com/en-us/lifecycle/announcements/bing-search-api-retirement (URL as I recall it; the saved page is the evidence) |
| eBay Browse `searchByImage` | base64 image | eBay listings that look similar, with price, condition, item id | within Browse API call limits (limits not retrieved) | production use needs an application keyset and eBay licence acceptance (*asserted*); the details page errored to curl and timed out in fetch, so the field list is from search highlights of developer.ebay.com/develop/api/buy/browse_api.md and the Inventory Discovery guide (*observed as search highlight; page not fully opened*) | anything sold on eBay, which is wide for used goods | developer.ebay.com |
| eBay Catalog API | keyword, GTIN, MPN, or image-based `search` | catalogue product records (EPID, title, aspects, images) | free within limits (*asserted*) | page saved as `ebaycat.html` and not grepped; treat details as unopened | strongest for electronics, books, media, cards | developer.ebay.com/api-docs/commerce/catalog |
| TinEye MatchEngine | image | matches in a private index you supply | enterprise pricing (unopened) | private-index product, not a web-wide search for third parties (*observed* on the saved `tineye.html` page, read lightly) | only items you indexed | https://tineye.com |
| Amazon PA-API / Creators API | keyword, ASIN | product data | n/a | PA-API deprecated; Creators API has no image search (*asserted*, Amazon developer pages as seen in the earlier window) | n/a | unopened this window |
| simlir general image-to-product API | image | product matches | unopened | a vendor claim only (*asserted*) | unknown | unopened |
| Pumice (Lens re-ranker) | Lens results | re-ranked matches | unopened | vendor claim only (*asserted*) | unknown | unopened |
| Catalogue-bound vendors: Syte, Pixyle, nyris, BIRSE, Athena XAI, visualAI discoverGPT | image + a retailer catalogue they host | matches inside that catalogue | sales-led | they identify only items in a catalogue loaded into them (*asserted*, vendor pages) | retail fashion, parts | unopened except as search highlights |
| Pixyle clothing label-recognition endpoint | photo of care or brand label | extracted label data | unopened | vendor claim (*asserted*) | clothing | unopened |
| Pinterest Lens, Yandex Images | image | similar images | n/a | no public product API found | n/a | Not found |

Quality figures I did get (Group 4 repeats the embedding ones): nyris and Cat2Real benchmarks report embedding retrieval over product catalogues; details in Group 4.

## Group 2. Identifier routes

| Route | Input | Returns | Cost / limits | Terms | Item kinds | Evidence |
|---|---|---|---|---|---|---|
| GS1 US Database lookup | GTIN from barcode | company name, brand, product description | free, 30 searches per day (*observed*, GS1 US page) | consumer lookup, not bulk | items sold in US retail with a barcode | https://www.gs1us.org (page as seen in earlier window) |
| Commercial barcode APIs (UPCitemdb, Barcode Lookup, Go-UPC and similar) | UPC/EAN | title, brand, images, sometimes price | priced per call or per tier (*observed* in the earlier window; exact tiers not restated here) | per-vendor | retail goods with a barcode; weak on vintage and handmade | vendor pages, earlier window |
| eBay Catalog by GTIN | GTIN | EPID record | see Group 1 | eBay licence | as above | see Group 1 |
| FTC RN (Registered Identification Number) | RN from a US textile label | the registered business name | free web lookup | the FTC page returned only a stub to curl; RN facts come from secondary pages (apparelsearch, gradethread) (*asserted*) | US-made or US-sold textile, clothing | secondary pages |
| Canada CA number | CA number on a label | registrant | free | the Competition Bureau's own page (*observed*) | Canadian textile | Competition Bureau page |
| Brand style / SKU codes on tags | printed code | brand-specific; needs a brand site or a Google search | depends | no general lookup found | clothing, shoes | Not found as a general API |
| Electronics serial / model conventions (Apple, Samsung, others) | label or settings screen | model, year, spec | n/a | brand pages | electronics | not retrieved; Not found |
| IKEA article numbers, furniture maker marks | tag text | product page | n/a | n/a | furniture | not retrieved; Not found |
| ISBN | barcode | bibliographic record | n/a | n/a | books | not retrieved here (carry-over knowledge only, *asserted*) |
| Trading-card scan APIs | card photo | card id, set, edition, price | priced per scan (seen in earlier window; not restated) | vendor | cards | earlier window |

## Group 3. Catalogue and retail sources

| Source | Input | Returns | Notes | Evidence |
|---|---|---|---|---|
| eBay Catalog API | see above | product records | needs eBay app keys | *observed as highlight* |
| schema.org Product / Google Merchant feeds | a brand or retailer page URL | name, brand, GTIN, price, images as structured data | works only after you already have a candidate page; parse with ordinary HTML fetch | *asserted*; not retrieved this window |
| Brand sites, archived copies (Wayback Machine availability API) | candidate URL | an old retail page and price | useful for the original retail price of discontinued items | *asserted*; API not tested here |
| Price history (Keepa, PriceCharting) | ASIN, card id | historical price | vendor terms apply | *asserted*; not opened |

## Group 4. Models

| Model or method | What it does | Reported quality | Evidence |
|---|---|---|---|
| General VLMs (GPT, Gemini, Claude families) | read a photo and propose brand and model | reported accuracy varies widely by item type; studies found good category and colour, weaker exact model or variant (the earlier window collected the VLM studies; individual figures are not restated here, so I do not quote any) | *asserted* here; study pages were seen in the earlier window |
| Embeddings for product retrieval (nyris, Cat2Real benchmarks) | image vectors against a catalogue | benchmarks exist; they score retrieval inside a fixed catalogue, not open-world used goods | *observed as highlight* |
| Roboflow Visual Identification benchmark | fine-grained instance identification | exists as a benchmark | *observed as highlight* |
| OCR (Apple Vision, cloud OCR) | read tags, model plates, serials | no head-to-head OCR benchmark found | Not found |
| Decisions API (`gpt-6-luna`) | typed yes/no, choice, score with probabilities | see `research/identify/ben/openai-decisions-api.md` lines 6-11 | *asserted* (carried over) |

## Group 5. Search engines for agents

| Engine | Use | Cost / latency | Evidence |
|---|---|---|---|
| Exa | text search over candidates, page fetch | pricing and latency figures were collected in the earlier window and are not restated | seen in earlier window |
| Brave, Tavily, Perplexity-style APIs, SerpApi Google | same job; prices and latencies differ | not restated | seen in earlier window |

I give no numbers in this group because I could not re-verify them after the context compaction. Re-fetch before relying on any.

## Group 6. How shipped products do it

| Product | What is published | Evidence |
|---|---|---|
| eBay Magical Listing | listings generated from photos; failure reports from sellers describe wrong item details | *observed as highlight* |
| Poshmark Smart List AI | photo-to-listing drafting | *observed as highlight* |
| Others (Vinted, Mercari, StockX, GOAT, Google Lens accuracy reports) | no published accuracy found | Not found |

## Parallel plan and how routes disagree (all *inferred*)

Fire at once from one capture, because none needs another's output:
1. Text and code reading: OCR of the tag, label, model plate and barcode region.
2. Image search: Lens via SerpApi, eBay `searchByImage`, Web Detection.
3. VLM candidate proposal (brand, model, category guess).
4. Barcode decode, if a barcode is in frame.

Wait on a result:
- GTIN lookups (GS1, barcode APIs, eBay Catalog) wait on step 4 or on an OCR digit string.
- RN and CA lookups wait on OCR of the label.
- eBay Catalog keyword search, Exa, and schema.org or Wayback page fetches wait on a candidate (from the VLM, OCR or image search).
- Price history waits on a confirmed id (EPID, ASIN, card id).
- The Decisions verifier waits on the candidate plus its reference image.

Disagreement: rank by how directly the evidence ties to the physical object. A decoded GTIN or a legible model plate outranks catalogue matches, which outrank image-search matches, which outrank a VLM guess. This matches the spec's evidence order. When two code-based routes name different products, or the top image matches and the code disagree, the label should stay below exact and the person confirms. When only image routes agree, the label stays at "likely same model" at most.

## Not found

- An official Google Lens API; any Pinterest Lens or Yandex product API.
- A TinEye web-wide search API usable by a third party.
- A general lookup for brand style codes, IKEA article numbers, furniture maker marks, or Apple and Samsung serial conventions.
- A primary Google notice for the Vision Warehouse retirement.
- eBay Browse API rate limits and licence terms (page errored).
- Accuracy reports for Google Lens, Vinted, Mercari, StockX, GOAT.
- An OCR benchmark on tags and plates.
- Exact per-call prices for the barcode APIs, Exa and other agent search APIs after compaction (not restated; re-fetch).

## Sources fetched

Saved under `scratchpad/f/` in the session scratchpad: `visionps.html`, `visiondep.html`, `bingretire.html` (observed); `serppricing.md` (observed); `serplens.html`, `ebaycat.html`, `tineye.html` (read lightly or not grepped); `ebayimg.html` (error page, unusable); `rn.html` (stub). Exa searches covered eBay API, barcode and GS1, FTC RN and CA, embedding benchmarks, cards, shipped products, agent search engines, VLM accuracy; their results are *observed as highlight*. Repo files read: `research/identify/ben/build-plan.md`, `research/identify/ben/openai-decisions-api.md`, `research/cross-cutting/ben/seeing-the-item-pipeline.md`, `research/cross-cutting/ben/ai-harness-from-repos.md`, `research/cross-cutting/nate/research-session-digest.md`, `spec/features/identify.md`.

## Searched / could not reach

Reached: Google, Microsoft and SerpApi pages above; the Competition Bureau page; Exa search. Could not reach or did not open: the eBay `searchByImage` reference (error page and fetch timeout), the FTC RN page (stub), Google's own deprecation notice, Amazon developer pages this window, vendor pages for simlir, Pumice, Syte, Pixyle, nyris. Not searched at all after the context break: Pinterest and Yandex APIs beyond a first look, ISBN sources, IKEA lookup, serial conventions, Icecat, Wayback API tests, Keepa and PriceCharting terms, OCR benchmarks. A narrow search does not prove these do not exist.
