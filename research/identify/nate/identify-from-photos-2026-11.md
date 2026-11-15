# How do we identify a secondhand item (brand, type, model) from photos, with evidence?

Researched 2026-11-15 by Nate (Claude Code retriever, Sonnet 5.5). Feature: identify.

Builds on, and does not repeat: [identification-technologies](identification-technologies.md), [identification-stack](identification-stack.md), [clarifying-inputs](clarifying-inputs.md), [build-plan](../ben/build-plan.md), [openai-decisions-api](../ben/openai-decisions-api.md), [treg-tool-routing](../../cross-cutting/nate/treg-tool-routing.md), [spec](../../../spec/features/identify.md). Marks: *observed* (read or ran, URL and date 2026-11-15 unless stated), *asserted*, *inferred*, *not-found*.

## Question and decision

- Question: for each option (code, visual search, local model, paid model), what does it return, how sure, how fast, what per call, and what terms?
- Decision it feeds: the route order and which paid calls Nate approves. No paid call was made and no key was used for this note.

## Draft from memory (before searching)

- D1: Code first: barcode decode, OCR of tags, FTC RN lookup returns the company, GTIN lookup returns the product.
- D2: Google Lens through SerpApi is the main visual route, about $0.015 a call; eBay searchByImage is open to any developer.
- D3: Apple Vision does barcodes and text on the Mac; Tesseract and PaddleOCR also run there.
- D4: RN 14806 is Carhartt.
- D5: Wikidata gives a usable brand lexicon of thousands.
- D6: Small VLMs are free on an M4 Max but weaker than paid ones; a paid read costs a few cents.

## What changed (draft beside finding)

| Draft | Finding | Mark |
|---|---|---|
| D2 Lens $0.015 | Serper Lens is $0.003/call, 5x cheaper than SerpApi $0.015, with 11224 samples at ok 1.0 | observed (treg) |
| D2 eBay searchByImage open | eBay's own page for the Catalog API says "Limited Release ... only to select developers approved by business units". The searchByImage page returned 403 | observed (Catalog); not-found (searchByImage terms) |
| D4 RN 14806 is Carhartt | Not checkable: the FTC RN page is a script-driven app with no API or bulk file on the page I fetched. Carhartt is not confirmed | not-found |
| D5 Wikidata thousands | 676 distinct fashion/clothing brand items; of 8 well-known brands tested only Zara was present | observed (query run) |
| D6 paid read a few cents | A one-photo read is a fraction of a cent on the cheapest models (table in section 4) | inferred from observed per-token prices |
| treg-tool-routing Lens numbers | Earlier note had Serper n 11095, p50 2163 and SerpApi n 2126, p50 3414. Current catalogue is fresher (below) | observed |
| D1 GTIN lookups plentiful | UPCitemdb free is 100 requests per day, no signup. Verified by GS1 page 403 | observed; not-found |
| D3 on-device | Apple Vision requests exist for macOS 15.0+; not confirmed on M4 Max by a run | observed (docs); inferred (M4 Max) |

## 1. Code first

| Route | Returns | Sure | Speed | Cost | Terms | Mark |
|---|---|---|---|---|---|---|
| Apple Vision DetectBarcodesRequest | Decoded barcode payload and symbology | Exact when it decodes; no accuracy figure published | Not-found | Free, on device | Apple SDK | observed: "A request that detects barcodes in an image", macOS 15.0+, iOS 18.0+ (developer.apple.com/tutorials/data/documentation/vision/detectbarcodesrequest.json) |
| Apple Vision RecognizeTextRequest | Text with boxes | Not-found | Not-found | Free, on device | Apple SDK | observed: macOS 15.0+, iOS 18.0+ (.../recognizetextrequest.json) |
| zxing-cpp, ZBar (server) | Decoded barcode | Not-found (no published rate) | Not-found | Free | zxing-cpp and ZBar licences: earlier GitHub check read for zxing-cpp; not re-listed here | asserted from summary of repo check; not re-verified in this note |
| Tesseract 5 | Text | Not-found on tag photos | Not-found | Free | Apache-2.0 (asserted) | asserted |
| PaddleOCR PP-OCRv5 | Text | See identification-technologies | Not-found | Free | Apache-2.0 | see earlier note |

- Whether Tesseract, PaddleOCR or Vision run on an M4 Max 64 GB: *not-found* (no run made, no vendor claim read). Vision on macOS is *inferred* to work because it is an OS framework.
- Barcode rule: a decoded GTIN is the top rung of the spec's ladder (spec/features/identify.md).

### FTC RN database

- Query path: a web search page at rn.ftc.gov. The fetched page is a script shell (page text was only "Page Not Found / No additional information"; ftc.gov pages returned 404 to curl). *observed* 2026-11-15 (https://rn.ftc.gov/).
- API or bulk download: *not-found* on the pages fetched.
- Terms of use: *not-found*.
- RN 14806 belonging to Carhartt, Inc.: *not-found*. Only seller listing titles say so, which is *asserted*. Nate must treat the expectation as unconfirmed.

### Canada CA numbers

- Public web form at ised-isde.canada.ca/app/cb/can/public/srchFrm.html; returns at most 100 records; searches issued and cancelled numbers; no API or bulk file found. *observed* (competition-bureau.canada.ca CA identification number tips-searching page).
- Fee on the registration side: $100. *observed* (same site).

### GTIN lookups

| Source | Returns | Cost | Limit / terms | Mark |
|---|---|---|---|---|
| Open Products Facts / Open Food Facts | Product record by barcode | Free | ODbL database licence (page text "Open Database License"); API pages fetched | observed (world.openfoodfacts.org/terms-of-use) |
| UPCitemdb FREE | Product by UPC | Free tier: no signup | 100 combined requests per day, 6 lookups per minute, 2 UPCs per request. The plan page says 20 searches per day, the rate-limits page says 40: they disagree | observed (upcitemdb.com/wp/docs/main/development/plan/ and /api-rate-limits/) |
| UPCitemdb DEV, PRO | Same | Dollar price not on pages fetched | DEV 20,000 lookups and 2,000 searches per day; PRO 150,000 and 20,000. Earlier note's $99-$699 stays *asserted* | observed limits; price *not-found* |
| Verified by GS1 | Brand owner of a GTIN | Earlier note: free, 30 per day (asserted) | Page returned 403 | not-found (re-check) |
| eBay Catalog getProduct by GTIN | Product record | Not-found | "Limited Release" to select developers approved by business units; contact eBay support for production access | observed (developer.ebay.com/api-docs/commerce/catalog/resources/product/methods/getProduct) |

- treg has no barcode, gtin, ocr or vision endpoint: 0 results for each query. *observed* (treg.to/catalog/search).

### Brand lexicon from Wikidata

- Query run against https://query.wikidata.org/sparql on 2026-11-15:
  `SELECT DISTINCT ?b ?l WHERE { { ?b wdt:P31/wdt:P279* wd:Q1618899 } UNION { ?b wdt:P31/wdt:P279* wd:Q133459332 } ?b rdfs:label ?l FILTER(LANG(?l)="en") } LIMIT 5000`
- Result: 680 rows, 676 distinct items. Q1618899 (fashion label) alone is 677; Q133459332 (clothing brand) alone is 70. *observed*.
- Coverage: of Carhartt, Nike, Patagonia, Levi's, L.L.Bean, Adidas, Coach, Zara only Zara matched by label. *observed*. So this is a thin lexicon, not a full brand list.
- The brand class Q431289 filtered by industry property returned 0. *observed*.
- Licence: Wikidata is CC0 (asserted from memory, not re-read).

## 2. Visual search

| Route | Returns | Speed (treg p50/p95 ms) | Cost per call | Terms | Mark |
|---|---|---|---|---|---|
| serper.google.serp.lens | Lens matches | 2165 / 3962, n 11224, ok 1.0 | $0.003 per_call (3 credits), checked 2026-09-24 | Serper terms not read | observed (treg.to/catalog/search?q=lens) |
| anyapi.google.lens | Lens matches | no observed data | $0.00297 per_success, checked 2026-09-11 | not read | observed |
| serpapi.x.google-lens | Lens matches | 3397 / 9041, n 2456, ok 0.9955 | $0.015 per_success, checked 2026-07-28 | not read | observed |
| dataforseo.x.serp-google-search-by-image-task-post | Task id (async) | 809 / 1666, n 20 | $0.0006 per_call, checked 2026-07-28 | not read | observed |
| dataforseo.x.serp-google-search-by-image-task-get-advanced | Result of that task | 723 / 22957, n 114, ok 1.0 | $0.0 free | not read | observed |
| serper.google.serp.images | Image search by text | 1003 / 2054, n 63725 | $0.002 | not read | observed |
| serper.google.serp.shopping | Shopping by text | 1030 / 2147, n 69668, ok 0.9948 | $0.002 | not read | observed |
| serpapi.x.yahoo-images / bing-images / yandex-images | Image search | yahoo 1403 / 2159, n 28; others none | $0.015 each | not read | observed |
| bravesearch.web.search.images | Image search | none | $0.005, checked 2026-10-30 | not read | observed |

- "How sure": no published accuracy for any Lens route; the spec rule is that image search alone never writes an Exact. *not-found* (accuracy).
- Chaining: DataForSEO is two calls (post then get), so $0.0006 plus free, about 1.5 s wall (809 + 723 p50). *inferred* from the rows.
- SerpApi pricing page fetched (serpapi.com/pricing); plan figures are in the file in the scratchpad, not copied here. Per-call price above is treg's.
- Google v. SerpApi: dismissal on 2026-11-09 stays *asserted* from the earlier note; I did not re-open a court source.
- eBay Browse searchByImage: docs page 403; the Catalog sibling carries a "Limited Release" label. Whether searchByImage carries the same gate: *not-found*. eBay licence limits (no storing, co-mingling, price modelling, ML training): see earlier notes; licence page 403 this run.
- Google Cloud Vision: Web Detection $3.50 per 1,000 images (cloud.google.com/vision/pricing, *observed* in the sweep; also in the earlier note). Logo Detection price: read on the same page in the sweep; not re-copied here, so check the page before relying on it.
- Bing Visual Search: Microsoft Learn overview page fetched; retirement of Bing Search APIs on 2025-08-11 is in the earlier note. A Visual Search replacement: *not-found*.
- Other official product-recognition APIs: Google Vision Product Search is in maintenance per the earlier note. Nothing else found. A limited search; this does not show none exists.


### treg, as one route beside the free ones

Nate set treg up for the tools identify needs ([words](../../../product/words.md#2026-11-15-nate-set-up-treg-for-the-tools-identification-needs-an-open-font-for-every-system)): "For the things it requries the tooling for like google lens and such". So treg is treg.to, a paid catalogue billed per call to his team's prepaid balance. The token is a user-level variable on the Windows machine only, checked by presence (*observed* present, 2026-11-15).

| Job | treg endpoint | Price | Reliability | Mark |
|---|---|---|---|---|
| Google Lens, reverse image search | `serper.google.serp.lens`, POST `{url, gl, hl}`; the image must be a publicly fetchable JPG or PNG address | $0.003 a call, an empty answer included (3 credits, checked 2026-09-24) | 11,224 samples, 100% working, p50 2.2 s | *observed*, catalogue search 2026-11-15 |
| Lens, cheaper and async | `dataforseo.x.serp-google-search-by-image-task-post`, then task-get | $0.0006 post, get free | no samples | *observed* |
| Lens through SerpApi | `serpapi.x.google-lens` | $0.015 a success | 2,456 samples, 99.6% | *observed* |
| Google Shopping search | `serper.google.serp.shopping` | $0.002 a call | | *observed* via the orchestrator, 2026-11-15 12:55 UTC |
| OCR, barcode, UPC lookup, product recognition | none: catalogue searches for "ocr", "barcode", "upc lookup" and "product recognition" return 0 results | | | *observed*, 2026-11-15 |

The team balance was $1.00 on 2026-11-15 (*observed* by the orchestrator). So the code rungs (tag text, RN, lexicon, barcode) stay ours and free, and treg is the visual rung only.

## 3. Open source on an M4 Max 64 GB

| Model | Licence | Size / Ollama | Published | Mark |
|---|---|---|---|---|
| Marqo-FashionSigLIP | Apache-2.0, updated 2026-02-18 | n/a | Text-to-image Recall@1 0.121 vs ViT-B-16-SigLIP-webli 0.111; category-to-product P@1 0.758. Model card, vendor-run, 6 fashion datasets | observed (huggingface.co/Marqo/marqo-fashionSigLIP README) |
| Marqo-FashionCLIP | Apache-2.0, 2024-10-12 | n/a | not read | observed (HF API) |
| SigLIP 2 base | Apache-2.0 | n/a | Earlier note: SOP R@1 80.28, vendor-run | observed licence |
| OpenCLIP | not-found this run | | not-found | not-found |
| Qwen3-VL 8B Instruct | Apache-2.0 | Ollama library page exists | accuracy not read | observed |
| Gemma 4 | Ollama library page exists; sizes seen 7.5 GB and 9.5 GB | | not read | observed (ollama.com/library/gemma4) |
| Qwen3.5 | Ollama page exists; sizes seen 1.3 GB and 7.6 GB | | not read | observed |
| Florence-2 large | MIT | n/a | not read | observed (HF API) |
| Moondream2 | Apache-2.0, updated 2026-09-23 | Ollama page exists | not read | observed |

- Logo-detection models: *not-found* (none verified this run).
- Published speed on Apple silicon (tokens/s or images/s on M4 Max): *not-found*. Nothing read from a vendor; no local run made.
- That these fit and run in 64 GB: *inferred* from file sizes of 1.3 to 9.5 GB, not from a run.
- Ollama and MLX are the two runners. The MLX VLM repo is Blaizzy/mlx-vlm (ml-explore/mlx-vlm is 404). *observed*.

## 4. Paid vision-model reads as fallback

Source: https://openrouter.ai/api/v1/models, listing data fetched 2026-11-15, 470 models, 325 take image input. Prices per token as the listing gives them; per 1M tokens below.

| Model id | Input per 1M | Output per 1M | Image field |
|---|---|---|---|
| google/gemini-2.5-flash-lite | $0.10 | $0.40 | $0.10 per 1M |
| qwen/qwen3-vl-30b-a3b-instruct | $0.15 | $0.60 | none listed |
| google/gemini-3.5-flash-lite | $0.30 | $2.50 | $0.30 per 1M |
| openai/gpt-5.4-nano | $0.20 | $1.25 | none listed |
| anthropic/claude-haiku-5.5 | $0.10 | $0.50 | none listed |
| google/gemma-4-26b-a4b-it | $0.0675 | $0.225 | none listed |

- Free variants listed at $0: google/gemma-4-26b-a4b-it:free and gemma-4-31b-it:free. Free-tier terms and limits: *not-found*.
- Direct Google: Gemini 3.5 Flash-Lite $0.30 input (text/image/video), $2.50 output per 1M; free tier exists. *observed* (ai.google.dev/gemini-api/docs/pricing). Matches OpenRouter.
- Direct OpenAI: pricing page 403. *not-found*.
- Dollars per photo: depends on image token count, which I did not read from a vendor page. *not-found*. The statement "a fraction of a cent" is *inferred*: at $0.10 to $0.30 per 1M input, 1,000 image tokens cost $0.0001 to $0.0003, plus output.
- Accuracy of any of these on resale items: *not-found*.
- Storing and training terms for each vendor: *not-found*, not read.

## 5. Route order (inferred)

1. Code first: barcode and tag text on device (free, can start now); GTIN lookup via Open Products Facts and UPCitemdb free (free, can start now, under the daily caps above).
2. Visual search: Serper Lens at $0.003 on a photo, DataForSEO two-step at $0.0006 as the cheaper async option (both paid; see below).
3. A model only where code abstains: local Qwen3-VL or Gemma 4 via Ollama or MLX first (free), then a paid read.
- Lead's note (*inferred*, capture lead, 2026-11-15): eBay Browse searchByImage stays the first visual route to try because it is official and has no per-call price, but only after its docs and licence are read (403 this run) and the eBay app keys are present; until then the visual rung abstains.
4. Inferred, not tested here: none of these routes is measured for accuracy on our items; the spec rule (no Exact from image search alone) holds.

Free and can start now: Apple Vision barcode and text, zxing-cpp, ZBar, Tesseract, PP-OCRv5, Open Products Facts, UPCitemdb FREE (100 per day), Wikidata lexicon (676 items, thin), local models via Ollama or MLX.

### Nate's decision (paid options)

| Option | Price | What it buys | Source |
|---|---|---|---|
| Serper Lens | $0.003 per call | Lens matches, p50 2.2 s | treg, checked 2026-09-24 |
| anyapi Lens | $0.00297 per success | Lens matches, no speed data | treg, checked 2026-09-11 |
| SerpApi Lens | $0.015 per success | Lens matches, p50 3.4 s | treg, checked 2026-07-28 |
| DataForSEO search-by-image | $0.0006 post + $0.0 get | Async image search | treg, checked 2026-07-28 |
| Google Cloud Vision Web Detection | $3.50 per 1,000 images | Web entities and matching pages | cloud.google.com/vision/pricing |
| UPCitemdb DEV/PRO | not-found | More than 100 lookups per day | upcitemdb plan page (limits only) |
| Gemini 3.5 Flash-Lite read | $0.30 / $2.50 per 1M tokens | Model read of photo | ai.google.dev, OpenRouter |
| Gemini 2.5 Flash-Lite read | $0.10 / $0.40 per 1M tokens | Same, cheaper | OpenRouter listing |
| Qwen3-VL 30B A3B read | $0.15 / $0.60 per 1M | Same | OpenRouter listing |
| Per-photo dollar cost of any model read | not-found | | |

### Open question: treg

Answered: Nate set up treg.to himself on 2026-11-15 (section 2, treg). Still open: what each provider's terms let us keep from an answer (Serper's and DataForSEO's terms were not read).

## Not found

- RN 14806 owner, FTC RN API, bulk file or terms.
- eBay searchByImage terms and limits (403); eBay API licence page (403); Verified by GS1 page (403); OpenAI pricing (403).
- Whether eBay getProduct by GTIN is open beyond approved partners (page says Limited Release).
- Published accuracy for any Lens route; Apple-silicon speeds for any model; OpenCLIP numbers; logo-detection models; barcode and OCR runs on an M4 Max.
- Dollar prices for UPCitemdb paid plans; per-photo token cost for any model.
- Google v. SerpApi primary court source.

## Sources fetched

All 2026-11-15 unless noted.
- https://treg.to/catalog/search (queries for lens, image, barcode, gtin, ocr, vision)
- https://rn.ftc.gov/ and FTC RN page via WebFetch
- https://competition-bureau.canada.ca/contact-competition-bureau-canada/ca-identification-number and /en/ca-identification-number/tips-searching; https://ised-isde.canada.ca/app/cb/can/public/srchFrm.html
- https://query.wikidata.org/sparql; https://www.wikidata.org/w/api.php
- https://developer.apple.com/tutorials/data/documentation/vision/detectbarcodesrequest.json and recognizetextrequest.json
- https://world.openfoodfacts.org/terms-of-use; https://world.openproductsfacts.org/data
- https://www.upcitemdb.com/wp/docs/main/development/plan/ and /api-rate-limits/
- https://developer.ebay.com/api-docs/commerce/catalog/resources/product/methods/getProduct
- https://serpapi.com/pricing; https://cloud.google.com/vision/pricing
- https://learn.microsoft.com/en-us/bing/search-apis/bing-visual-search/overview
- https://huggingface.co/api/models/ (Marqo, SigLIP 2, Qwen3-VL, Florence-2, Moondream) and Marqo-FashionSigLIP README
- https://ollama.com/library/ (qwen3-vl, gemma4, moondream, qwen3.5, qwen3.6)
- https://openrouter.ai/api/v1/models
- https://ai.google.dev/gemini-api/docs/pricing
- GitHub API (repo licences, Blaizzy/mlx-vlm); npm registry (zxing-wasm)
- Unreachable: eBay searchByImage docs, eBay API licence, Verified by GS1, OpenAI pricing (403); eBay OpenAPI JSON (empty body).
