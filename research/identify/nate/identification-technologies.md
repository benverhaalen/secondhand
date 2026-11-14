# With Google's product search closed, which technologies can identify a used product from photos?

Researched 2026-11-14 by Nate (Claude Code retrievers with Exa, Sonnet 5.5). Feature: identify.

Marks: *observed* means the page was opened on 2026-11-14 and the value read from its bytes (page date given where the page shows one). *asserted* means a search snippet, a reseller, a blog or a vendor claim. *inferred* means reasoned from observed or asserted rows. Prices and terms expire; re-check before a spec cites them. Google, Microsoft and SerpApi status and the parallel plan are in [identification-stack.md](identification-stack.md) and are not repeated. The evidence order and match labels this note feeds are in [the identify spec](../../../spec/features/identify.md).

Citation pass: 24 claims opened at source, 7 changed after opening (marked "corrected" below), 9 could not be opened or did not show the claim (listed under "Searched / could not reach"). Everything not marked *observed* below was not opened and is *asserted*.

## Answer

Four kinds of technology can identify an arbitrary used product from photos without Google. (1) Visual search over a vendor's own index: eBay `search_by_image` (live eBay listings only, access terms not opened), Amazon image search through paid wrappers (about $0.001 to $0.002 per call at one wrapper), and Yandex through scraper APIs; none returns a catalogue record with a GTIN. (2) Frontier vision models with a hosted web search tool, at $5 to $14 per 1,000 searches plus tokens (observed for Anthropic, OpenAI, Gemini, xAI, Perplexity); no text-search agent API (Exa, Tavily, Brave and similar) documents an image as the query. (3) Open models that do one job each: SAM 3 for segmentation, SigLIP 2 and Marqo-Ecommerce for embeddings, PP-OCRv5 for reading text, all with licences observed at source. (4) Specialist identifiers for cards, watches, LEGO and a few others, priced per call; for most other kinds of item no photo-to-model service was found. Reference data is a licence question more than an availability question: eBay and Etsy forbid model training on their content, Shopify's catalogue forbids training and rehosting, Icecat open content forbids AI training, while ABO (CC BY 4.0) and Open Products Facts (ODbL) permit reuse with conditions.

## Table 1. Visual search with its own index

| Provider | In / out | Access and price | Limits | Mark and URL |
|---|---|---|---|---|
| eBay Browse `search_by_image` | In: base64 image, optional category and aspect filters. Out: ItemSummary of live eBay listings | Application token. Price, call limit and any extra terms: not found | Own index is eBay live listings only. License Agreement forbids storing or co-mingling eBay content and using it "to suggest or model prices"; listing info at most 6 hours old | Endpoint *asserted* (method page unreachable: timeout, then HTTP 403). Licence terms *observed*, https://developer.ebay.com/support/api-license-agreement |
| Apinoa Amazon image search | In: base64 JPEG, PNG or GIF. Out: about 48 Amazon products per page | $0.001 per call, $0.002 when it matches | 16 Amazon regions; scraped Amazon search (inferred); terms not opened | *asserted* https://apinoa.com/en/docs/api-reference/amazon/image-search |
| Scrapely Amazon image search | In: image_url, up to 10 URLs, or base64 up to 3.5 MB. Out: detected objects with boxes, ranked ASIN matches, about 20 products | About 10,000 images per credit | Amazon US only | *asserted* https://scrapelyserp.com/docs/amazon-image-search |
| Nexscope | In: imageUrl. Out: Amazon matches, optional Keepa fields | Bearer key; price not seen | 8 Amazon domains; also MCP | *asserted* https://www.nexscope.ai/api-docs/amazon-search-by-image |
| Product Search (RapidAPI) | In: image. Out: similarity, name, price, URL | Price not seen | Amazon and AliExpress | *asserted* https://rapidapi.com/productsearch-inc-productsearch-inc-default/api/product-search6 |
| Yandex via SearchApi.io | In: image url, crop. Out: visual_matches (title, link, source, thumbnail) | Price not seen; zero-retention enterprise option | Web pages and images, not a product record (inferred) | *asserted* https://www.searchapi.io/docs/yandex-reverse-image-api |
| Xona Shop Lens | In: image up to 5 MB. Out: Lens matches plus Shopping, Amazon, eBay comparison | Identify $0.02, Shop mode $0.04 | Google Lens reseller, so an excluded origin | *asserted* https://xona-agent.com/resources/shop-lens |
| 1688 `image.similar.offer.search` and resellers (HioBuy, Apify actor) | In: base64 up to 3 MB or url. Out: at most 10 offers | Enterprise verification; reseller price about $0.10 per search at one actor | Wholesale and Chinese market goods | *asserted* https://open.1688.com ; Apify actor dev00 |
| Trendtrack image search | In: image up to 10 MB. Out: Shopify stores or products, similarity 0.7 to 1 | 4 credits per row | Shopify store index | *asserted* https://docs.trendtrack.io |
| Vinted image search via ScrapeBadger | In: image. Out: Vinted listings | Price not seen | Scraper reseller; Mercari and Poshmark: not found | *asserted* https://scrapebadger.com/ecommerce-scraper-api |

No independent accuracy or coverage test was found for any row.

## Table 2. Web-connected vision models and agent search

| Provider | In / out | Access and price | Limits and terms | Mark and URL |
|---|---|---|---|---|
| Anthropic `web_search` | In: text and images in Messages. Out: cited results | $10 per 1,000 searches plus tokens | ZDR eligible; dynamic filtering not ZDR eligible. The page does not say whether an image can accompany the search, only that the model forms the queries (inferred). Examples use `claude-opus-5-5` | *observed* https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool |
| OpenAI Responses `web_search` | In: text and images. Out: cited answer; `search_content_types` of `["image","text"]` with `image_settings` returns image results from a text query | $10.00 per 1,000 calls plus search content tokens at model rates ("Web search (incl. images)") | Search by image is not offered; image results come from a text query. Retention and ZDR terms *asserted* | *observed* https://developers.openai.com/api/docs/pricing , https://developers.openai.com/api/docs/guides/tools-web-search |
| Gemini grounding with Google Search | In: text and images. Out: grounded answer with citations | 5,000 free search requests per month shared across Gemini 3 and newer, then $14 per 1,000; 1,500 requests per day cap per project; Gemini 2.5 and older $35 per 1,000 prompts (*asserted*) | Terms: "You may not use the Services to develop models that compete with the Services"; unpaid tier content may be read by human reviewers. 30-day storage of grounded prompts *asserted* | *observed* https://ai.google.dev/gemini-api/docs/pricing , https://ai.google.dev/gemini-api/docs/google-search , https://ai.google.dev/gemini-api/terms |
| xAI `web_search` | In: text, images; `enable_image_understanding`, `enable_image_search`. Out: cited answer | $5 per 1,000 calls | `view_image` works only on images found by search, not on images you pass (*asserted*); photo terms: not found | Price *observed* https://docs.x.ai/developers/tools/web-search |
| Perplexity Agent API | In: text and images. Out: answer | `web_search` $0.0025 per call ($2.50 per 1,000), Fast $0.001, image search $0.0025 | Search API is text only (*asserted*); photo terms: not found | *observed* https://docs.perplexity.ai/docs/getting-started/pricing |
| Exa, Tavily, Brave, Firecrawl, Parallel, Linkup, You.com | In: text query. Out: pages, some image links | Exa $4 to $12 per 1,000; Tavily $0.008 per credit; Brave $5 per 1,000; Parallel image search $1 to $5 per 1,000; Linkup $0.005 to $0.006 per search | None documents an image as the query (not-found, not disproved) | *asserted* https://docs.tavily.com/documentation/api-credits , https://www.firecrawl.dev/pricing , https://www.linkup.so/pricing |
| SerpApi, Serper, SearchThisImage | In: image. Out: reverse image matches | SerpApi Starter $25 for 1,000; Serper $1 per 1,000 | Google Lens origin for the first two (see the earlier note) | *asserted* |

Published evidence on model plus search: Pix2Fact Gemini-3.1-Pro 18.4% without search and 42.4% with it; VisBrowse-Bench Claude-4.6-Opus 47.6%; MMSearch-Plus best 36.0%; a few-shot visual RAG classifier 86.8% against ResNet50 84.4%. All *asserted* (arXiv 2602.00593, 2603.16289, CVPRW 2025). No benchmark for identifying a resale item from a photo with web search was found.

## Table 3. Open models by job

| Model | In / out | Licence and cost | Numbers | Mark and URL |
|---|---|---|---|---|
| SAM 3 | In: image and a concept phrase or exemplar. Out: masks and instance ids | Custom "SAM License", last updated 2025-11-19: non-exclusive, worldwide, royalty-free; barred end uses include military and warfare. Corrected from "terms unverified". 30 ms per image on an H200 (*asserted*) | Zero-shot LVIS mask AP 48.8 vs prior best 38.5 (stated in the paper's introduction; corrected, the arXiv abstract carries no AP figure and 48.5 is a different table cell). Revised 2026-03-28 | *observed* https://raw.githubusercontent.com/facebookresearch/sam3/main/LICENSE , https://arxiv.org/abs/2511.16719 |
| Grounding DINO, OWLv2, Florence-2 | Image and text prompt to boxes | Apache-2.0, Apache-2.0, MIT (*asserted*); YOLO-World GPL-3.0 or AGPL-3.0 (*asserted*) | Zero-shot detectors F1 0.319 to 0.548 vs fine-tuned YOLO 0.845 to 0.866 in one mining test | *asserted* PMC13568132 |
| SigLIP 2 | Image or text to embedding | Apache-2.0 (corrected from "licence not shown") | SOP R@1 80.28 in a vendor-run test (nyris); ImageNet zero-shot 85.0 (g/16) *asserted* | *observed* https://huggingface.co/google/siglip2-so400m-patch14-384 |
| Marqo-Ecommerce-B and L | Image or text to embedding (768d and 1024d) | Apache-2.0 on the L card (corrected from "not shown") | Card claims 20.5% nDCG@10 gain over ViT-SO400M-14-SigLIP on its own benchmark; Marqo-authored, text-to-image focus | *observed* https://huggingface.co/Marqo/marqo-ecommerce-embeddings-L |
| DINOv3, DINOv2, Jina CLIP v2 | Image to embedding | DINOv3 gated; DINOv2 conflicting reports; Jina CLIP v2 weights non-commercial CC-BY-NC-SA-4.0 | SOP R@1 66.61 (DINOv3), 56.34 (DINOv2) | *asserted* arXiv 2412.08802 |
| PP-OCRv5 | Image to text with boxes | Apache-2.0 repository licence; 5M parameters, runs on phone or CPU | Weighted accuracy 80.1% vs 53.0% for v4 (matches the snippet); handwritten English 49.4 and printed English 87.5 *asserted* | *observed* https://arxiv.org/abs/2603.24373 (2026-03-25), https://github.com/PaddlePaddle/PaddleOCR |
| VLMs as OCR | Image to text | Hosted | OCRBench v2 EN: Gemini 3 Pro Preview 63.4, Claude Sonnet 5 59.2; no benchmark on tags, labels, serial plates or curved text | *asserted* 99franklin.github.io/ocrbench_v2 |
| AiPIC garment tag reader | Tag photo to size, composition, brand, origin, care | Commercial service | Size 92.93%, composition 90.23%, brand 77.1%, origin 81.27%, care symbols 86.75%, on about 1,000 records | *asserted*; the site was opened but the figures were not found in its text (research.aiodp.eu, 2025-08-21) |
| FashionLOGO and logo datasets | Crop to brand | Research | Open Brands R@1 98.55; out-of-domain drop about 22 points R@5 | *asserted* arXiv 2308.09012 |

## Table 4. Specialist identifiers by kind of item

Every accuracy figure here is a vendor claim; no independent accuracy measurement was found for any row.

| Kind | Provider | In / out | Access and price | Mark and URL |
|---|---|---|---|---|
| Trading cards | CardOS Vision | In: image_url or base64, JPEG, PNG or WebP up to 10 MB, one card. Out: ranked candidates, game, language, slab grade and cert | 5 credits per identification, refunded on error | *observed* https://business.getcardos.com/docs/vision/identify-url |
| Trading cards | Card Hedge, CardSight, Scrydex, Ximilar, tcgapi.dev, CardVault, GIBL | Photo to card, some read slabs | tcgapi.dev x402 $0.02 per photo; others plan-gated | *asserted* https://tcgapi.dev/api/identify/ |
| Watches | FindWatch | In: photo (`/identify`). Out: identification | Credit 1 = $0.01; packs from $10. Identify 5 credits enhanced, 2 fast, so $0.05 or $0.02 per identification | *observed* https://findwatch.com/developer |
| Watches | WatchID, WatchPatrol | Photo to model, top matches, price | Key by contact; price not seen | *asserted* https://www.watchpatrol.net/integrations/ |
| Watches | WatchCharts | Reference in, not photo | 1 request per second per key | *asserted* https://watchcharts.com/api |
| LEGO | Brickognize | Photo to part, set or minifig | Site claims 125k catalogue, 98.5% accuracy, 0.7 s (vendor); free access from a third-party README | *asserted*; page needs JavaScript, so claims were not re-read |
| LEGO | Rebrickable, BrickLink | Id in, catalogue and price guide out | Key; BrickLink OAuth with seller key | *asserted* |
| Luxury bags | Vaultik, WatchID bag mode, Trendful | Photo to item identification and authenticity | Vaultik tokens: 15 for a full assessment, 8 for a quick one | *asserted* https://vaultik.com/api/handbag-watch-authentication |
| Sneakers | Barcodes.gg, KicksDB, scrapers of StockX and GOAT | Code or SKU in; photo identification not found | Barcodes.gg from EUR 19 per month | *asserted* https://barcodes.gg/sneaker-price-api |
| Books | ISBNdb, Open Library, Google Books | ISBN in; cover photo not found | ISBNdb $14.99 to $99.99 per month | *asserted* https://isbndb.com/isbn-database |
| Vinyl, CD, games | Discogs, MusicBrainz, PriceCharting, IGDB | Id or barcode in; photo not found | PriceCharting paid, token on a subscription | PriceCharting access *observed* https://www.pricecharting.com/api-documentation ; others *asserted* |
| Coins, stamps | Numista, Vardera, Ximilar | Coin image identification (Numista, Vardera) | Prices not seen | *asserted* https://en.numista.com/api/ |
| Furniture | HomeDesigns.ai Furniture Finder, Ximilar Home Decor | Photo to retail matches; Ximilar needs your own collection | Prices not seen | *asserted* |
| Electronics | Techfleet Atlas, TAC and IMEI lookups | Model number, IMEI or serial in; photo not found | Atlas decode free, records CC-BY-4.0 | *asserted* https://devicedatabase.org/developers |
| Clothing | Lykdat, Ximilar Fashion Tagging, Size AI, FTC RN lookup | Tag or garment photo to attributes, not an exact product | Size AI on device | *asserted* https://sizeai.co/label-scanner |
| Appliances and tools | ApplianceIQ, GoZero | Nameplate photo OCR; multi-image analysis | ApplianceIQ $0.05 per call | *asserted* https://www.appliance-iq.com/developers |
| Wine | InVintory, API4AI, FastCork | Label photo to wine | InVintory by contact | *asserted* https://invintory.com/api/ |
| Bikes | Bike Index, BikeReport | Serial in; photo not found | Bike Index OAuth2 | *asserted* https://bikeindex.org/documentation/api_v3 |

## Table 5. Reference data and its licences

Licence terms below concern storing, indexing, training and showing. They are readings of the text, not legal advice.

| Source | Contents | Access and price | Licence on storing, indexing, training, showing | Mark and URL |
|---|---|---|---|---|
| eBay API License Agreement (covers Browse, Catalog, search_by_image) | Live listings | Developer account | Listing info at most 6 hours old; no co-mingling with non-eBay content; content may not be sold, copied or stored; not to be used to "suggest or model prices"; no use to "train algorithms, conduct machine learning, develop synthetic data sets, train large learning models, and/or train artificial intelligence systems" | *observed* https://developer.ebay.com/support/api-license-agreement |
| Etsy Open API | Listings | Approved key | No ML or AI training without written authorization; no cache beyond need (*asserted*) | *asserted*; page returned HTTP 403, https://www.etsy.com/legal/api/ |
| Shopify Global Catalog | Cross-merchant products clustered by Universal Product ID, text and image queries, secondhand flag | MCP, no key for the agent profile | Images only with their merchant's listing; "No use for training purposes"; no aggregating, rehosting, redistributing, reselling or bulk export; no systematic or automated collection; images cached up to 24 hours | *observed* https://shopify.dev/docs/agents/catalog |
| Amazon Berkeley Objects | 147,702 listings, 398,212 images, 8,222 spins, 7,953 3D models; no price, no GTIN | Free on AWS S3 | Creative Commons Attribution 4.0 (changed from CC BY-NC in 2023); static | *observed* https://registry.opendata.aws/amazon-berkeley-objects/ |
| Open Products Facts, Open Food Facts family | Product name, brand, barcode, images | Free dumps, nightly | Database under ODbL (share-alike); contents under Database Contents License; images under CC BY-SA | *observed* https://world.openproductsfacts.org/terms-of-use |
| Icecat | Open: 600+ brands, 2M+ datasheets; Full: 40,000+ brands | Open free with whitelist; Full paid | Open: show "Specs Icecat", no AI training (*asserted*) | *asserted*; licence page returned HTTP 403 |
| Amazon Reviews 2023, WDC, DeepFashion | Frozen 2023 metadata; schema.org corpus; fashion pairs | Free | WDC research only; DeepFashion non-commercial; maintainers of Reviews 2023 decline to state a licence | *asserted* |
| Marqo GS-10M | 9.81M scraped Google Shopping rows | Free on Hugging Face | Card says Apache-2.0 while the content is scraped (third-party rights not cleared, inferred) | *asserted* |
| Barcode lookups (UPCitemdb, Barcode Lookup, Go-UPC, EAN-Search, GS1) | Barcode to product | UPCitemdb free 100 per day, $99 to $699 per month; Go-UPC from $74.95 per month | Storage terms not fetched | *asserted* https://barcodereport.com/blog/post/best-barcode-lookup-apis-2026 |
| Keepa, PriceCharting | Amazon price series; current game and card prices | Keepa from about EUR 49 per month; PriceCharting paid | Not fetched | *asserted* |
| Scraped-data vendors (Bright Data, Oxylabs, Apify, Zyte) | Product datasets and scraper APIs | Bright Data datasets from $250 per 100K records; scraper API $0.75 to $1.50 per 1K | Bright Data licence page opened; its dataset licence text was not found in the extracted page | Prices *asserted*; case law *asserted* (Meta v. Bright Data, N.D. Cal. 2024-01-23, summary judgment for Bright Data on contract; Amazon v. Perplexity injunction vacated, secondary) |

## How they fit (inferred)

This section is reasoning from the rows above; it is not tested.

**Fire at once from one capture.** The routes that need only pixels can start together: object detection and crop (SAM 3 or a detector), an embedding of each crop (SigLIP 2 or Marqo), a vision-model call with a search tool (Anthropic, OpenAI, Gemini, xAI or Perplexity), a visual-search call (eBay `search_by_image` if access is granted, an Amazon wrapper, Yandex), and a text read (PP-OCRv5, or a VLM) on any label or plate frame.

**Wait on a read label or code.** Anything keyed by a code (barcode APIs, ISBN, IMEI or TAC lookups, style codes, appliance model numbers, watch references, sneaker SKUs, LEGO set numbers) waits for the OCR or decode result. The spec already ranks a decoded GTIN or legible model plate above image-search matches.

**Which kinds go to a specialist.** Cards and slabs (CardOS and peers), watches (FindWatch, WatchID, WatchPatrol), LEGO (Brickognize), and luxury bags (Vaultik) have photo-to-item services. Coins have Numista and Vardera. For books, vinyl, sneakers, electronics, bikes, tools and clothing the specialist services take a code or serial, so they follow the label read.

**Checking candidates against the photos.** Candidates from different routes can be re-embedded with the same model as the photo and compared, with the text read and a vision-model comparison as further checks. The published agent patterns do this in code, not in the model (SnapIntel median and outlier rejection, CariBarang schema validation with one retry; both *asserted*). The spec's rule that "exact" is never written from image search alone applies to every row in Table 1.

**Where a confirmed item feeds our own index.** Licences set what can be kept. eBay, Etsy and Shopify results cannot be stored for training or index building under the terms read above, and eBay content may not be co-mingled. A confirmed item the user photographed, with its decoded GTIN or model, is the user's own capture; ABO (CC BY 4.0) and Open Products Facts (ODbL, share-alike) are data that may be loaded with attribution and the share-alike condition.

**Cost per identification, where a price is known (inferred arithmetic from observed rates, tokens excluded).**

| Route | Per call |
|---|---|
| Anthropic web search, one search | $0.01 |
| OpenAI web search, one call | $0.01 |
| Gemini 3 grounding, one query, after the free 5,000 per month | $0.014 |
| xAI web search | $0.005 |
| Perplexity web_search, standard or Fast | $0.0025 or $0.001 |
| FindWatch identify, enhanced or fast | $0.05 or $0.02 |
| CardOS Vision | 5 credits; credit price not seen |
| Apinoa Amazon image search | $0.001, or $0.002 on a match (asserted) |
| Measured end-to-end OpenAI answer with one search | about $0.058 (third party, 2026-10-04, asserted) |
| eBay `search_by_image`, SAM 3, SigLIP 2, Marqo, PP-OCRv5 | no per-call fee found; model cost is your own compute |

Latency: Parallel image search about 1 to 3 s and Linkup search 1 to 3 s (*asserted*); end-to-end latency for a model plus search identification was not found.

## Kinds of item with no good route

Found no photo-to-model service for: sneakers, books, vinyl and CD, bikes, power tools, art, and used furniture by make and model. For clothing, services return categories and attributes, not an exact product, and the only tag-reading numbers are the AiPIC figures (brand 77.1%). Antiques have no dedicated lookup. Handwriting scored 49.4 on PP-OCRv5. No benchmark measures reading of tags, serial plates or curved text. No independent accuracy test exists for any specialist row.

## Searched / could not reach

- eBay `search_by_image` method page: Exa fetch timed out twice; curl to developer.ebay.com returned HTTP 403 for the method page, the Browse overview and `/join/api-license-agreement`. Price, rate limit and any `search_by_image` specific terms remain unread. The licence at `/support/api-license-agreement` did open.
- Etsy API legal page: HTTP 403. Icecat licence page: HTTP 403. Both stay *asserted*.
- AiPIC site opened; the garment figures were not in the extracted text, so they stay *asserted*.
- Brickognize page needs JavaScript; its claims were seen earlier through Exa only.
- Bright Data licence page opened; no dataset reuse clause was found in the extracted text.
- Anthropic web search page: silent on images inside the search query.
- Mistral web search and photo terms; xAI and Perplexity terms on user photos.
- Terms of the Amazon and Yandex wrappers, and of the 1688 resellers, were not opened.

## Not found

- eBay `search_by_image` price, limits and access conditions.
- A first-party Amazon, Mercari, Poshmark, Depop, Vinted, Etsy, Naver or Pinterest image-to-product endpoint.
- Any text-search agent API documenting an image as the query; a Lens-like search by image in the Gemini API.
- An independent accuracy test of any visual-search service or specialist identifier.
- A benchmark for resale-item identification with web search; a benchmark for tag, label or plate reading.
- Photo identification for sneakers, books, vinyl, bikes, tools, art and used furniture by model.
- End-to-end latency per identification for any model-plus-search route.
- A court ruling on whether embeddings of scraped images fall under copyright or contract.

## Sources fetched

Opened on 2026-11-14 with curl or the Exa fetch (all HTTP 200 unless noted):
- https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
- https://developers.openai.com/api/docs/guides/tools-web-search
- https://developers.openai.com/api/docs/pricing
- https://ai.google.dev/gemini-api/docs/pricing
- https://ai.google.dev/gemini-api/docs/google-search
- https://ai.google.dev/gemini-api/terms
- https://docs.x.ai/developers/pricing and https://docs.x.ai/developers/tools/web-search
- https://docs.perplexity.ai/docs/getting-started/pricing
- https://developer.ebay.com/support/api-license-agreement
- https://raw.githubusercontent.com/facebookresearch/sam3/main/LICENSE
- https://arxiv.org/abs/2511.16719 and https://arxiv.org/html/2511.16719
- https://huggingface.co/google/siglip2-so400m-patch14-384
- https://huggingface.co/Marqo/marqo-ecommerce-embeddings-L
- https://arxiv.org/abs/2603.24373 and https://arxiv.org/html/2603.24373
- https://raw.githubusercontent.com/PaddlePaddle/PaddleOCR/main/LICENSE
- https://registry.opendata.aws/amazon-berkeley-objects/
- https://world.openproductsfacts.org/terms-of-use
- https://shopify.dev/docs/agents/catalog
- https://findwatch.com/developer
- https://business.getcardos.com/docs/vision/identify-url
- https://www.pricecharting.com/api-documentation
- https://research.aiodp.eu/ , https://brickognize.com/ , https://brightdata.com/license (opened, claim not found in text)
- HTTP 403: https://developer.ebay.com/join/api-license-agreement, the eBay searchByImage method page, https://www.etsy.com/legal/api/, the Icecat open-licence pages
- Earlier Exa fetches of Apinoa, Scrapely, Nexscope, SearchApi.io, Xona, Pinterest and Baidu pages, and search highlights for all *asserted* rows; see the dated notes beside each row. Related plans: [platform-access](../../connect/nate/platform-access.md), [analytics and recommendations](../../data/nate/analytics-and-recommendations.md), [build plan](../ben/build-plan.md).
