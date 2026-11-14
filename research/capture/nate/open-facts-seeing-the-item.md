# Which facts about capturing and identifying an item were still unknown, and what do the sources say?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: capture.

Scope: twelve open facts taken from the "Not found" sections of [adaptive-capture.md](adaptive-capture.md), [scan-to-images.md](scan-to-images.md), [identification-stack.md](../../identify/nate/identification-stack.md) and [editing-alternatives.md](../../studio/nate/editing-alternatives.md). "observed" means I opened the URL and read its text; page dates are given where the page shows one. Wayback copies are labelled.

| # | Fact | Why it matters | Answer | Mark | URL and date |
|---|------|----------------|--------|------|--------------|
| 1 | eBay Browse `search_by_image`: request shape, limits, rate limit | Decides whether a photo can be sent straight to eBay as the query | POST with body `{"image": "<Base64 string>"}`; result set capped at 10,000 items; only FIXED_PRICE returned by default; OAuth scope `https://api.ebay.com/oauth/api_scope`; Browse limit 5000 calls per day. No image size limit and no per-call price stated in the spec or the call-limits page. Extends identification-stack.md:111 ("page errored"). | observed | OpenAPI JSON for Buy Browse v1.20.4 (eBay developer site, fetched with a browser user-agent); Wayback copies of the Browse overview (snapshot 2026-06-14) and API call limits (snapshot 2026-06-13). Live developer pages returned 403 to curl. |
| 2 | Object Capture: processing time, device floor, any iOS 26 change | Sets whether on-device reconstruction can sit inside a seller flow | Apple says "In just a few minutes, a USDZ model will be ready" (no per-object figure). Device: "iPhone 12 Pro, iPad Pro 2021, and the later models". Apple advises avoiding "reflective, transparent, or contain very thin structures". The RealityKit updates page has no Object Capture entry in its June 2025 section. Confirms adaptive-capture.md; closes its "time and WWDC25 change" gap only as "none listed on that page". | observed | WWDC23 session 10191 transcript page; WWDC24 session 10107 page; developer.apple.com RealityKit updates page (fetched 2026-11-14) |
| 3 | LiDAR error on dark, glossy, fabric surfaces | Decides whether depth can be trusted for measurement on those items | Apple states the limitation only qualitatively: "ARKit is less confident about the accuracy of the LiDAR Scanner's depth measurements for surfaces that are highly reflective, or that have high light absorption." ARKit exposes `confidenceMap` for this. No controlled number for fabric, fur or glossy plastic found. Two numbers from other sources: MDPI 2023, dark plates under 2% error at short range, 11% at 200 cm (highlight text only, paper blocked curl, so not read in full); Sensors and Materials 2025, steel workpiece under 1.1 mm (same limit). Does not close adaptive-capture.md:17 and :103. | observed (Apple doc); asserted (the two papers, via search highlights) | developer.apple.com ARKit scene depth doc (undated); papers as above, unopened in full |
| 4 | Can a hosted model's web search take an input photo as the query | Decides whether "find this item from a photo" can use a general model's search tool | OpenAI Responses `web_search` returns image results from a text query via `search_content_types` ["image","text"], `image_settings.max_results` and `caption`; results appear in `web_search_call.results[]`. The guide and changelog show no input-image-as-query. Gemini's Google Search grounding page (19 KB) contains no mention of an image query. Anthropic web search not checked. | observed (OpenAI guide and changelog, Gemini page); not-found (image as query) | OpenAI web search guide and changelog (markdown, fetched 2026-11-14; changelog entry dated Jun 5); https://ai.google.dev/gemini-api/docs/google-search (fetched 2026-11-14, undated) |
| 5 | Replicate price for a background-removal model | Per-image cost of GPU-free masking | lucataco/remove-bg: "approximately $0.00022 to run on Replicate, or 4545 runs per $1, but this varies depending on your inputs." Adds a price where editing-alternatives.md:95-98 found none for hosted masking. | observed | https://replicate.com/lucataco/remove-bg (page undated, fetched 2026-11-14) |
| 6 | fal BiRefNet price | Same | Page text shows "$0 per compute second", same artifact editing-alternatives.md:68 recorded. No usable price. | not-found | https://fal.ai/models/fal-ai/birefnet and /v2 (fetched, price field unrendered) |
| 7 | remove.bg dollar price per credit | Same | Pricing page is script-rendered; text fetch returned only the heading. API page code samples only; no dollar figure. | not-found | https://www.remove.bg/pricing, https://www.remove.bg/api (fetched; Wayback returned 429) |
| 8 | Poshmark photo rules on edited or AI images | Whether processed studio images are allowed | Poshmark support URL guessed returned 404 (curl) and an SSL error (Exa); Wayback 429. No rule text read. | not-found | https://support.poshmark.com/s/article/Listing-Photo-Guidelines |
| 9 | Depop and Mercari photo rules | Same | Depop help article returned 403 to curl and a navigation shell via Exa; Mercari help URL did not connect. No rule text read. | not-found | https://help.depop.com/hc/en-gb/articles/360001282454; https://help.mercari.com/s/article/Photo-Guidelines |
| 10 | Nike style-code location | Identifier for sneakers | Nike help URL tried returned a 5 KB page with no "style code" text. | not-found | https://www.nike.com/help/a/style-code |
| 11 | IKEA article-number location | Identifier for furniture | IKEA support URL returned 403 to curl. | not-found | https://www.ikea.com/us/en/customer-service/product-support/article-number/ |
| 12 | OCR accuracy on labels and serial plates | Whether text on a tag can be read reliably | Not attempted beyond the above; no benchmark opened. | not-found | none |

## What stays unknown
- Whether `search_by_image` has a per-image size cap, and its price or contract gating in production (the overview was only reachable through Wayback).
- LiDAR error for fabric, fur, leather and glossy plastic at object scale (rows 3).
- Whether Anthropic's or any vendor's search tool accepts an image as the query (row 4).
- Dollar prices for fal BiRefNet and remove.bg credits.
- Photo and edited-image rules for Poshmark, Depop, Mercari, Facebook Marketplace.
- Style-code, article-number and OCR facts (rows 10 to 12).

## Not found
Rows 6 to 12 returned no usable primary text; row 4's "image as query" and row 3's controlled numbers were searched and not found. An empty fetch is a fact about my route, not proof the page lacks the data.

## Sources fetched
- eBay Buy Browse OpenAPI JSON (v1.20.4); Wayback eBay Browse overview (2026-06-14) and call limits (2026-06-13).
- Apple: ObjectCaptureSession, capturing photographs for Object Capture, ARKit scene depth, RealityKit updates (`.md` via curl); WWDC23 10191 and WWDC24 10107 pages.
- OpenAI web search guide and changelog (markdown); Gemini Google Search grounding page.
- Replicate lucataco/remove-bg; fal birefnet pages; remove.bg pricing and API pages.
- Attempted and failed: Poshmark, Depop, Mercari, Nike, IKEA pages (see table).
