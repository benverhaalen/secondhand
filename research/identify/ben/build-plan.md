# How do we actually build identify for the demo: photos in, an exact identity and condition the seller confirms in one tap?
Researched 2026-11-14 by Ben (Claude Code). Feature: identify.

Builds on [openai-decisions-api.md](openai-decisions-api.md) and corrects it where noted. Evidence marks: *observed* (I opened the source), *asserted* (the source claims it, or memory), *inferred* (my reasoning). Everything recommended here is an *agent proposal*.

## 1. The question and Ben's goal

Identify answers "what is this thing": category, brand, line and model, size, color, material, era, condition and defects. Ben asked for "the openai decision api for image decisions", for "the user has to do no thinking at all", and on 2026-11-14 at 20:41 said "judges love human in the loop" and asked for "dynamic and intelligent ui ... where you have a huge range of set components" ([words](../../../product/words.md#2026-11-14-tools-and-capture)).

What this means for identify (inferred):
- The seller never types an identity. They see a filled card and either accept it or tap a better option.
- Every field shows where it came from (seen in the photo, read from the tag, matched online, you said) and how sure we are. That is the "Seeing the item" representation in [.agents/thinking.md](../../../.agents/thinking.md).
- The Decisions API is the judge, not the generator. It cannot invent "Carhartt Detroit J97"; it can tell us, with a probability, which of five candidates the photos show.

## 2. Seeded research log

Method: Ben's RDD and IAE, with looped seeded investigation. Each loop picked seeds for a quality cue, inspected each one, and revised a frontier.

### Loop 1. Is the Decisions note still true?

| Seed | Quality cue | What the inspection changed |
|---|---|---|
| Decisions guide, developers.openai.com/api/docs/guides/decisions | primary docs | **GA now.** "The Decisions API is now generally available"; 400 questions per request, up from 200 in beta. Images may be inline base64 data URLs **or public http(s) URLs**; `file_id` is not supported. No rationale field. OpenAI recommends thresholds from labelled examples and an "other" choice sent to review [observed]. |
| API reference, `POST /decisions` (create) | primary schema | `questions` 1 to 400; `choice` has 2 to **255** choices (confirms the third-party number); `score` 2 to 10 `levels`; question `instructions` can be an array of text, image and JSON parts; image `detail` is `low`, `high`, `auto`, `original`; `input_json` up to 256 KiB; response `answers[]` with `probability` (predicate), `choice`+`probabilities`+`confidence` (choice), `score`+per-level `probabilities`+`confidence` (score), or `refusal`; `prompt_cache_key` up to 64 chars [observed]. |
| OpenAI changelog | dated primary | Decisions beta Oct 6 2026, **GA Oct 22 2026** with `gpt-6-luna`. GPT-6 Sol and Luna Sep 22; an image-encoding bug that "degraded image understanding" in Sol and Luna was fixed Sep 25. **GPT-6.1 Terra** launched Oct 26 "for visual reasoning" [observed]. |
| letsdatascience.com beta article | dated secondary, conflicts with docs | In beta: "inline image data, not hosted image URLs", max 128 image parts per request [observed in the article]. The GA docs now allow URLs. The 128-image cap is not in the GA reference; treat it as possibly still true [inferred]. |
| orcarouter.ai Decisions write-up | practitioner numbers | OpenAI's stated ~150 ms per decision vs ~1.6 s through the normal API; Every's test: median 0.35 s per passage; no calibration data published; no rate limits published; requests over 272k input tokens are repriced, which many large images could cross [observed in the article; numbers asserted by their sources]. |
| Databricks external models docs | primary docs, contrary lead | Model Serving external models support only `llm/v1/completions`, `llm/v1/chat`, `llm/v1/embeddings` [observed]. **So `/v1/decisions` cannot go through Databricks Model Serving or Unity Gateway as a served endpoint** [inferred]. |

Corrections to [openai-decisions-api.md](openai-decisions-api.md): it is GA, not beta; public URLs now work (base64 still safest, see 4.2); 255 choices is confirmed from the reference itself; model is still `gpt-6-luna`, the only supported one [all observed].

Frontier after loop 1:
- Changed: Decisions is the verifier; it needs candidates from somewhere else.
- New lead: GPT-6.1 Terra is described by OpenAI as suited to "matching product photos to catalog entries" [observed, model page]. Candidate generator.
- Next: how do real listing tools get identity, and where do they fail?
- Bound: 4 platforms, failure traces first.
- Counter-lead: maybe visual search alone (no VLM) gives exact identity better.

### Loop 2. How do the platforms identify items, and where do they break?

| Seed | Quality cue | What it showed | Changed |
|---|---|---|---|
| valueaddedresource.net, eBay magical listing revisited (Feb/Mar 2026) | failure trace | A sea-turtle mousepad became "ceramic decorative plaque", then "fridge magnet"; wrong title and item specifics followed from the wrong identity; when it can't identify, the seller gets "the standard listing form to fill out manually"; eBay says it uses "advanced models and our product knowledge graph" [observed] | The fallback must never be a blank form. Below threshold we show candidates, not nothing. |
| digitalcommerce360, eBay visual identification (Nov 11 2026) | dated primary-ish | Photo, AI fills the listing, seller reviews then publishes; 6 countries; "50% reduction in the total steps needed to list" in UK tests [observed] | Review-then-publish is table stakes; our difference is per-field confidence and one-tap correction. |
| valueaddedresource.net, Poshmark Smart List AI | hands-on test | Up to 16 photos; extracts type, brand, size, color, material; **missed a size visible on the tag**; couldn't tell men's from women's shoes [observed] | Size must come from tag OCR, not from the VLM's overall read. Department (men/women) is its own question. |
| valueaddedresource.net, Mercari image listing beta (2023) | hands-on test | Hydro Flask identified from the branded side; the other side gave generic "bottle" and a different category; items without text or logos got generic results [observed] | Identity depends on visible text and logos. Run identify on all views together, and ask for the logo or tag side. |
| Depop AI listing (Business Insider via AOL, Dec 2024) | dated secondary | One photo fills category, subcategory, color, brand; built in-house [observed] | Category, color and brand are the commodity floor. |
| eBay condition IDs (developer.ebay.com) | primary | 2990 `PRE_OWNED_EXCELLENT` and 3010 `PRE_OWNED_FAIR` are "only available in apparel categories"; 3000 shows as "Pre-owned - Good" [observed] | Score levels for condition designed to map onto these. |
| FTC RN database; nostos.pages.dev Carhartt guide | neglected lead, domain text | FTC has a public, searchable RN database (no API found) [observed]. Carhartt date codes are "[Month][Year]" on the care tag; union label + Made in USA means older; alpha sizing points to J97 and later [observed, guide] | The care tag is the richest identity evidence for clothing: style code, RN, date code, country, size. OCR it as a first-class step. |

Frontier after loop 2:
- Changed: the tag shot and multi-view input matter more than model choice.
- New lead: visual search (Lens, eBay image search) for the exact model.
- Next: inspect visual search implementations and their failure traces.
- Counter-lead: for rigid items with a barcode, a catalog ID beats any of this.

### Loop 3. Visual search: what can actually take an image?

| Seed | Quality cue | What it showed | Changed |
|---|---|---|---|
| SerpApi Google Lens API docs | primary docs | `url` or `image_id` (upload via their Image API); `type` = `all`, `exact_matches`, `visual_matches` (Products type discontinued); `visual_matches` carry title, link, source, thumbnail, sometimes `price`; sample `total_time_taken` 2.75 s [observed] | Best web-wide exact-match source. Returns asking prices too, which seeds pricing. |
| indiehackers.com, eBay `search_by_image` post (Apr 2026) | practitioner | Base64 image; visual search found more listings (46 vs 18) but the price range widened from $62–80 to $39–330 [observed] | eBay image search gives eBay listings with item specifics, but noisy. Verify each with a Decisions `same_product` predicate before treating it as a comp. |
| community.ebay.com, searchByImage error 12000 (Nov 2024) | failure trace | Intermittent internal error 12000; support's working example used production `api.ebay.com`, `EBAY_US`, base64 image [observed] | Use production, retry once, fall back to text search with the candidate title. |
| Exa image-search demo "how it works"; Exa search guide | primary | Exa `/search` takes a **text** query; images come from result pages; types `lite` ~300 ms, `auto` ~1 s, `deep` 4–15 s; `outputSchema` for JSON; `includeDomains` [observed] | Exa cannot take a photo. It runs **after** candidate generation, with the candidate's text, restricted to resale domains. |
| Google Cloud Vision `WEB_DETECTION` docs | primary | `webEntities`, `bestGuessLabels`, `fullMatchingImages`, `pagesWithMatchingImages`, `visuallySimilarImages`; no deprecation notice [observed] | Official fallback if SerpApi fails; weaker for shopping (asserted). |
| Gemini image understanding docs | primary | Example model `gemini-4-hydrogen`; `box_2d` as `[ymin, xmin, ymax, xmax]` scaled to 0–1000; segmentation masks; JSON schema output with images [observed] | Defect boxes come from Gemini. The OpenAI docs I read mention no boxes. |
| Apple `RecognizeTextRequest` docs | primary | iOS 18+, Swift `RecognizeTextRequest` returning `RecognizedTextObservation` (location and text), `recognitionLevel`, `customWords` [observed] | On-device tag OCR is available if the app is native; `customWords` can carry brand names. |

Frontier after loop 3:
- Changed: the pipeline order is VLM candidates and visual search in parallel, then Exa by text, then Decisions verification.
- New lead: Decisions can localize coarsely: tile a photo into a 3x3 grid and ask one `defect_present` predicate per tile in the same request [inferred]. Calibrated, cheap, no box model needed for the demo.
- Next: condition vocabularies and how score levels map.
- Counter-lead: GPT-6.1 Terra alone with structured outputs might be good enough and Decisions adds a call. Kept: Decisions earns its place because it gives per-option probabilities to threshold on, which structured outputs don't [inferred; logprob support on Terra not checked].

### Loop 4. Condition vocabularies

| Seed | What it showed |
|---|---|
| Mercari help article 39 | New, Like New, Good, Fair, Poor with definitions; "Like New" = "New Without Tags, NWOT" [observed] |
| valueaddedresource.net, Poshmark condition update (Nov 14 2025) | New condition options appeared; sellers mention "like new", "good", "fair" [observed]; the full list is not in the article |
| underpriced.app condition translator | Cross-platform table including Depop "Brand new", "Used - Excellent", "Used - Good", "Used - Fair", "Used - Poor" [observed on that page; the platforms' own lists for Poshmark and Depop asserted] |

Changed: one 6-level internal scale that maps cleanly to every platform (section 4.6).

## 3. What exists

| Reference | Job | What we take | What we change | Evidence |
|---|---|---|---|---|
| OpenAI Decisions API (`gpt-6-luna`) | implementation mechanism | Typed predicate/choice/score answers with probabilities; images inside each question; 400 questions per call | Use it to verify candidates and grade, never to generate names | observed |
| GPT-6.1 Terra (`gpt-6.1-terra`) | implementation mechanism | Structured outputs over several photos; "matching product photos to catalog entries" | Ask for top 5 identity candidates with search queries, not one answer | observed (model page); quality asserted |
| SerpApi Google Lens | implementation mechanism | `visual_matches` and `exact_matches` with titles, links, prices | Feed titles back to Terra to name the model; verify matches with Decisions | observed |
| eBay Browse `search_by_image` | implementation mechanism, evidence for pricing | eBay listings, item specifics, asking prices | Filter by Decisions `same_product` before use as comps | observed (endpoint, practitioner); schema page did not render |
| Exa `/search` with `outputSchema` | implementation mechanism | Text search over resale domains, JSON out | Runs after candidates; also used by price and watch | observed |
| Gemini (`gemini-4-hydrogen`) boxes | implementation mechanism | `box_2d` defect boxes | Only for the defect overlay; Decisions confirms each | observed |
| Apple Vision `RecognizeTextRequest` | implementation mechanism | On-device tag OCR with locations | Only if the app is native; server OCR via Terra otherwise | observed |
| eBay magical listing | counterexample | Review before publish | Never fall back to a blank form; per-field confidence | observed |
| Poshmark Smart List, Mercari, Depop | evidence of failure modes | Multi-photo input; category/brand/color as baseline | Tag OCR for size; department as its own question | observed |
| Merlin Bird ID | interaction | Short list of photo suggestions, "This is my bird!", and a browse-all path when none match | Candidate cards with our photo next to the match photo; "None of these" opens search | observed (eBird support article) |
| StockX verification | weak preference signal | A database of known failure features, ML risk scoring, humans decide | Authentication is out of scope; only a "check this" flag for high-value brands | observed |
| FTC RN database | neglected lead | RN on the care tag names the maker | Demo: Exa or a lookup only when brand is unreadable | observed (database exists; no API) |

## 4. The build plan

### 4.0 The shape

```
 phone                         backend (Databricks App, FastAPI)                       outside
 ─────                         ──────────────────────────────────                     ───────
 shot 1 (whole item) ─────▶ A. quick read (Terra, low effort) ─▶ category, color ─▶ card starts filling
 tag shot ──OCR on device─▶ B. tag parse (text + tag photo)  ─▶ brand, size, style code, RN, country
 last shot ───────────────▶ C. candidates (Terra, all photos + tag text + Lens/eBay titles)
                             ├─ C1. SerpApi Google Lens (front + tag crop)     ──▶ visual matches
                             └─ C2. eBay search_by_image (front)               ──▶ eBay listings
                           D. verify (Decisions, one call, ~30-60 questions)   ──▶ probabilities
                           E. condition and defects (Decisions score + tiles; Gemini boxes)
                           F. thresholds ─▶ fields: filled / confirm / ask
                           G. card with Decision primitives ─▶ seller taps ─▶ labels in Delta
                           H. Exa + verified matches ─▶ comps handed to price
 every step: MLflow span + Delta row
```

Steps A and B run **while the seller is still shooting**, so the card is already half filled when the last shot lands [inferred]. This is how we hit the latency target.

### 4.1 Step A: quick read on the first shot

- Stack: OpenAI Responses API, `gpt-6.1-terra`, `reasoning.effort: "low"`, structured outputs (`text.format` JSON schema, `strict: true`) [observed: parameters exist]. In parallel, one Decisions call with the capture checks from [the capture note](../../capture/ben/guided-shot-list.md) (`whole_item_visible`, `in_focus`) and `category` as a choice.
- Input: the front photo, downscaled to 1536 px long side, base64.
- Output: `category` (Decisions choice), `color_primary`, `department` guess, and which shot list to use next (the capture note's per-category list).
- Runs: backend.
- Human moment: none yet. The card's first row appears ("Jacket · Brown") with a soft shimmer on fields still coming.
- Failure: category `other` or confidence below 0.6 → the next screen shows category chips (the capture flow already asks for this).

### 4.2 Step B: tag read

- Stack: native app: Apple Vision `RecognizeTextRequest`, `recognitionLevel = .accurate`, `customWords` = a list of ~500 resale brands [observed API; brand list is ours]. Web app: skip on-device OCR; Terra reads the tag photo directly.
- Then Terra (structured outputs) parses OCR text plus the tag photo into: `brand`, `size_label`, `size_system` (US, EU, alpha, waist x inseam), `style_code`, `rn_number`, `ca_number`, `country_of_origin`, `materials` with percentages, `date_code`, `care`.
- Why both OCR and the photo: OCR gives exact characters, the model gives structure and catches logos [inferred]. Poshmark missed a size printed on the tag [observed], which is the failure this step exists for.
- Human moment: none. Fields read from the tag carry the source "read from the tag" and a tiny tag thumbnail.
- Failure: no legible text → Decisions predicate `label_legible` below 0.7 → retake prompt with the tag outline (capture owns the prompt).

### 4.3 Step C: candidate generation (after the last shot)

Three sources in parallel, then one merge.

| Source | Call | Input | Output | Timeout |
|---|---|---|---|---|
| C1 SerpApi Google Lens | `engine=google_lens`, `type=all`, `url` = signed URL of the front photo (or `image_id` via their Image API) | front photo; second call with the tag crop if brand is unknown | `visual_matches[]` title, link, source, price, thumbnail; `exact_matches` | 4 s |
| C2 eBay Browse | `POST /buy/browse/v1/item_summary/search_by_image`, production, `X-EBAY-C-MARKETPLACE-ID: EBAY_US`, body `{ "image": "<base64>" }`, `category_ids` from step A | front photo | `itemSummaries[]` title, price, image, itemId (item specifics via `getItem` for the top 5) | 3 s, one retry, then text search |
| C3 Terra merge | Responses API, `gpt-6.1-terra`, `effort: "medium"`, structured outputs | all photos (front, back, tag, details), tag fields from B, top 15 titles from C1 and C2 | up to 5 identity candidates, each with `brand`, `line`, `model`, `style_code`, `era`, `reference_image_urls` (from C1/C2), `search_query` | 8 s |

The C3 schema (abbreviated):

```json
{
  "candidates": [{
    "brand": "Carhartt",
    "line": "Detroit Jacket",
    "model": "J97",
    "style_code": "J97 BRN",
    "era": "1990s-2000s",
    "department": "men",
    "evidence": ["tag: J97", "blanket lining", "corduroy collar"],
    "reference_images": ["https://i.ebayimg.com/..."],
    "search_query": "Carhartt Detroit jacket J97 brown blanket lined"
  }],
  "unknown_fields": ["era"]
}
```

Why this order: the VLM alone guesses well at category and brand but invents exact models; Lens and eBay find real listings but their titles are noisy. Feeding the listing titles into the VLM, then verifying, uses each for what it is good at [inferred from loops 2 and 3].

Failure cases:
- Lens and eBay both return nothing (plain, unbranded item): C3 returns generic candidates ("unbranded brown canvas work jacket"); identity stays at category level and the card says so by leaving model empty with the source "not found".
- Barcode visible (books, electronics, games): *agent proposal* for rigid items: read the barcode (Apple Vision `DetectBarcodesRequest` on device, or Terra on the photo), look up by GTIN with eBay Browse `gtin` filter; a catalog ID skips C1 to C3 [inferred; `gtin` filter asserted from memory].

### 4.4 Step D: verification with Decisions

One `POST /v1/decisions` with `model: "gpt-6-luna"`. `input` carries all item photos (base64 data URLs, `detail: "high"`; tag photo `detail: "original"`) plus the tag fields as `input_json`. Each candidate's reference image goes inside its own question's `instructions` [observed: allowed]. Base64 rather than URLs: works across beta and GA behavior and avoids the API failing to fetch an eBay or signed URL [inferred].

Keep the shared `input` identical across the D and E calls for one item and set `prompt_cache_key` to the item id, so the photos are cached [observed: caching rules; benefit inferred].

**Clothing question set (example: a brown work jacket)**

```json
{
  "model": "gpt-6-luna",
  "prompt_cache_key": "item_8f2c",
  "input": [{ "role": "user", "content": [
    { "type": "input_text", "text": "Photos of one secondhand item for sale. Photo 1 front, 2 back, 3 tag, 4 detail. Tag text read by OCR is in the JSON." },
    { "type": "input_image", "image_url": "data:image/jpeg;base64,...", "detail": "high" },
    { "type": "input_image", "image_url": "data:image/jpeg;base64,...", "detail": "high" },
    { "type": "input_image", "image_url": "data:image/jpeg;base64,...", "detail": "original" },
    { "type": "input_image", "image_url": "data:image/jpeg;base64,...", "detail": "high" },
    { "type": "input_json", "data": { "tag": { "brand": "Carhartt", "size_label": "L", "style_code": "J97 BRN", "rn": "14806", "country": "Mexico" } } }
  ]}],
  "questions": [
    { "type": "choice", "name": "identity",
      "instructions": "Which candidate is this exact item? Use the tag, construction, collar, lining and hardware. Pick other if none fits.",
      "choices": [
        { "value": "carhartt_detroit_j97", "description": "Carhartt Detroit Jacket J97, blanket lined, corduroy collar" },
        { "value": "carhartt_active_j130", "description": "Carhartt Active Jacket J130, hooded, thermal lined" },
        { "value": "carhartt_chore_c001", "description": "Carhartt Chore Coat C001, blanket lined, no waist band" },
        { "value": "carhartt_wip_detroit", "description": "Carhartt WIP Detroit Jacket, modern European line" },
        { "value": "other", "description": "None of these" } ] },
    { "type": "predicate", "name": "same_as_candidate_1",
      "instructions": [ { "type": "input_text", "text": "Is the item in the photos the same product (same model, not just same brand) as this listing photo?" },
                        { "type": "input_image", "image_url": "data:image/jpeg;base64,<candidate 1 reference>" } ] },
    { "type": "predicate", "name": "same_as_candidate_2", "instructions": ["...same, candidate 2 image..."] },
    { "type": "predicate", "name": "brand_visible", "instructions": "Is a brand name or logo clearly visible on the item or tag?" },
    { "type": "choice", "name": "department",
      "choices": [ {"value": "men"}, {"value": "women"}, {"value": "unisex"}, {"value": "kids"}, {"value": "unknown"} ],
      "instructions": "Which department is this garment cut and labelled for?" },
    { "type": "choice", "name": "size_label", "instructions": "Which size is printed on the tag?",
      "choices": [ {"value": "XS"}, {"value": "S"}, {"value": "M"}, {"value": "L"}, {"value": "XL"}, {"value": "XXL"}, {"value": "other"} ] },
    { "type": "predicate", "name": "size_tag_matches_ocr", "instructions": "Does the size printed on the tag read L?" },
    { "type": "choice", "name": "color_primary", "instructions": "Main color of the outer fabric under neutral light.",
      "choices": [ {"value": "brown"}, {"value": "tan"}, {"value": "black"}, {"value": "green"}, {"value": "navy"}, {"value": "gray"}, {"value": "other"} ] },
    { "type": "choice", "name": "material_outer", "instructions": "Outer fabric",
      "choices": [ {"value": "cotton duck canvas"}, {"value": "denim"}, {"value": "nylon"}, {"value": "wool"}, {"value": "leather"}, {"value": "polyester"}, {"value": "other"} ] },
    { "type": "choice", "name": "era", "instructions": "Era, from tag style, country and construction.",
      "choices": [ {"value": "before 1990"}, {"value": "1990s"}, {"value": "2000s"}, {"value": "2010s"}, {"value": "2020s"}, {"value": "unknown"} ] },
    { "type": "predicate", "name": "made_in_usa_union_label", "instructions": "Is there a union label or Made in USA on the tag?" },
    { "type": "score", "name": "condition",
      "instructions": "Overall condition for resale, from all photos.",
      "levels": [
        { "label": "poor", "description": "Heavy wear, holes or damage that affects use; for parts or repair" },
        { "label": "fair", "description": "Well used; several visible flaws or heavy fading" },
        { "label": "good", "description": "Gently used; light wear, small flaws" },
        { "label": "excellent", "description": "Little to no sign of wear, no tags" },
        { "label": "new_no_tags", "description": "Unworn, no tags attached" },
        { "label": "new_with_tags", "description": "Unworn with the original retail tags attached" } ] },
    { "type": "predicate", "name": "retail_tags_attached", "instructions": "Are original retail hang tags attached?" },
    { "type": "predicate", "name": "is_counterfeit_risk", "instructions": "Do the logo, tag font or stitching look inconsistent with genuine items of this brand?" }
  ]
}
```

That is 15 questions; with one `same_as_candidate_k` per candidate (5) the call holds about 20. Defect questions go in call E, because "send separate requests when a later decision depends on an earlier answer" [observed, guide] and defect questions depend on the category.

**Rigid item question set (example: a stand mixer)**

```json
{
  "model": "gpt-6-luna",
  "questions": [
    { "type": "choice", "name": "identity", "instructions": "Which candidate is this exact product? Use the badge, model plate and shape. Pick other if none fits.",
      "choices": [
        { "value": "kitchenaid_artisan_ksm150", "description": "KitchenAid Artisan 5 qt tilt-head KSM150" },
        { "value": "kitchenaid_classic_k45ss", "description": "KitchenAid Classic 4.5 qt tilt-head K45SS" },
        { "value": "kitchenaid_pro_bowl_lift", "description": "KitchenAid Professional bowl-lift 5 or 6 qt" },
        { "value": "other", "description": "None of these" } ] },
    { "type": "predicate", "name": "same_as_candidate_1", "instructions": ["...reference image..."] },
    { "type": "predicate", "name": "model_plate_legible", "instructions": "Is a model or serial plate readable in any photo?" },
    { "type": "predicate", "name": "all_parts_present", "instructions": "Are the bowl, beater, dough hook and whisk all visible?" },
    { "type": "choice", "name": "color_name", "instructions": "Manufacturer color name closest to the body color",
      "choices": [ {"value": "Empire Red"}, {"value": "Onyx Black"}, {"value": "White"}, {"value": "Silver"}, {"value": "Pistachio"}, {"value": "other"} ] },
    { "type": "predicate", "name": "powered_on_shown", "instructions": "Does any photo show the item powered on or working?" },
    { "type": "score", "name": "cosmetic_condition", "levels": [
        { "label": "parts_only", "description": "Broken, missing major parts, or damage that stops use" },
        { "label": "heavy_wear", "description": "Chips, dents, rust or heavy scratches" },
        { "label": "light_wear", "description": "Light scratches or scuffs, normal use" },
        { "label": "like_new", "description": "No visible wear" },
        { "label": "new_sealed", "description": "In original sealed packaging" } ],
      "instructions": "Cosmetic condition from all photos" },
    { "type": "predicate", "name": "original_box_present", "instructions": "Is the original retail box in any photo?" }
  ]
}
```

For rigid items "working" is never decided from photos: `powered_on_shown` only decides whether we ask the seller "Does it work?" as a yes/no chip [inferred].

### 4.5 Step E: condition and defects

- Defect localization, demo version: crop each main photo into a 3x3 grid (9 tiles, slight overlap), and ask in one Decisions call per photo: `defect_present_tile_k` (predicate) and, for tiles above 0.4, a second call with `defect_type` (choice: stain, hole, tear, pilling, fading, missing button, broken zipper, scratch, dent, chip, other) and `defect_severity` (score: barely visible, visible up close, visible from a distance, affects use) [inferred design; question types observed].
- Defect boxes for the overlay: `gemini-4-hydrogen` with a JSON schema returning `box_2d` per defect, converted from 0–1000 to pixels [observed format]. A box is drawn only where its tile's `defect_present` ≥ 0.4, so two independent models agree before we draw [inferred].
- Each confirmed defect asks capture for a close-up (capture owns that prompt), and the close-up is graded with `defect_severity` again.
- Condition shown is the step D `condition` score, capped by defects: any defect with severity "visible from a distance" caps condition at `fair` unless the seller overrides [inferred rule].

### 4.6 Condition levels and platform mapping

Internal scale = the six `condition` levels in 4.4. Mapping *agent proposal*:

| Internal level | eBay apparel `conditionId` | eBay non-apparel | Poshmark | Depop | Mercari |
|---|---|---|---|---|---|
| new_with_tags | 1000 `NEW` ("New with tags") | 1000 | New With Tags | Brand new | New |
| new_no_tags | 1500 `NEW_OTHER` ("New without tags") | 1500 | Like New (NWOT if shown) | Brand new, say "no tags" | Like New |
| new with a defect (any new level plus a confirmed defect) | 1750 `NEW_WITH_DEFECTS` | 1750 | Good | Brand new, flaw in description | Good |
| excellent | 2990 `PRE_OWNED_EXCELLENT` | 2750 or 4000 by category | Like New | Used - Excellent | Like New |
| good | 3000 ("Pre-owned - Good") | 3000 / 5000 by category | Good | Used - Good | Good |
| fair | 3010 `PRE_OWNED_FAIR` | 6000 | Fair | Used - Fair | Fair |
| poor | 3010 plus flaws in description, or 7000 if not wearable | 7000 | not listed; suggest donate | Used - Poor | Poor |

Evidence: eBay IDs and the apparel-only rule for 2990/3010 observed (developer.ebay.com); Mercari observed (help article 39); Poshmark and Depop labels asserted (third-party table and seller comments). Check each site's live dropdown when the list adapters are built. Category-specific eBay IDs come from `getItemConditionPolicies` [observed: that is where IDs come from].

How score levels map to the UI: the score answer has a probability per level. Default = argmax. If the top two adjacent levels are within 0.15 of each other, the slider rests between them and asks the seller to pick one of the two [inferred]. **When in doubt, grade down**: if argmax and the next lower level are close, preselect the lower one, because buyers punish overstated condition more than understated [inferred; the translator page gives the same advice, observed].

### 4.7 Step F: thresholds and what the UI shows

Starting thresholds for the demo, recomputed from labels (section 6). *agent proposal*.

| Band | Rule (choice questions) | Rule (predicates) | UI | Tier |
|---|---|---|---|---|
| **Filled** | `confidence` ≥ 0.90 and top minus second ≥ 0.40 | p ≥ 0.90 or ≤ 0.10 | Field shows the value with a solid source dot. Editable with a tap, never interrupts | Auto |
| **Confirm** | 0.60 ≤ confidence < 0.90 | 0.25 < p < 0.90 | Value preselected, with the 2–3 runners-up as chips beside it; the card's "Looks right" button covers all confirm fields at once | Ask (one tap) |
| **Ask** | confidence < 0.60, or `other` wins, or a refusal | — | No preselection; candidate cards with photos (identity) or chips (other fields). "None of these" opens search | Ask |
| **Never alone** | `is_counterfeit_risk` ≥ 0.3 on a brand on the high-value list | — | A plain flag: "Check this is genuine" with what looked off; we never write "authentic" | Never alone |

Identity has an extra rule: accept candidate k automatically only when `identity` picks k with confidence ≥ 0.90 **and** `same_as_candidate_k` ≥ 0.85 **and** every other `same_as_candidate_j` ≤ 0.5 [inferred]. Two independent questions must agree.

Tag-read fields (size, materials) follow the predicate rule on `size_tag_matches_ocr`: if OCR and the Decisions read disagree, the field drops to Confirm.

### 4.8 Step G: the human moment (generative UI from a fixed component set)

The backend does not write UI. It returns a list of **Decision primitives**, and each names one component from a fixed, designed set. The app renders whatever comes back. This is the "huge range of set components" Ben asked for [inferred reading of his words].

| Component | When the agent picks it | What it shows | Familiar from |
|---|---|---|---|
| `field_row` | Filled band | Label, value, source dot, tag thumbnail if read from the tag | iOS Settings rows |
| `chip_choice` | Confirm or Ask for a small closed set (size, color, department, era) | Preselected chip plus 2–3 runners-up, "Other" opens the full list | Depop and Vinted listing forms |
| `candidate_cards` | Ask or Confirm on identity | Up to 4 cards: our front photo beside the match photo, name, where found (eBay, Lens), one-line differences ("hooded vs collar"); "None of these" | Merlin's suggestions and "This is my bird!" |
| `condition_slider` | Always for condition | 5–6 stops with the platform words under them; the model's probability as a faint bar above each stop | Mercari's condition picker, as a slider |
| `defect_pins` | Any defect above threshold | The photo with pins on boxes; each pin: keep / not a flaw | Photo tagging in Instagram |
| `yes_no` | Questions photos can't answer (does it work, smoke-free) | Two buttons | Every app |
| `genuine_flag` | Never-alone band | A neutral warning row with what looked off | eBay's authenticity guarantee notes |
| `why_sheet` | Long-press any field | The question, the probability bars, the photo region, the model and time: built from the MLflow trace | iOS "Why am I seeing this" sheets |

The card's single primary action is "Looks right" (accepts all Filled and Confirm values). Copy is minimal per [copy.md](../../../product/copy.md); the strings above are placeholders for the `ui-screen` skill to finish.

**What happens when the seller corrects:**
1. The corrected field gets source `you_said` and confidence 1.0, and it is never overwritten by a later run [inferred].
2. A row is written to `secondhand.identify.labels`: item id, question name, model answer and probabilities, human answer, photo ids, trace id.
3. Fields downstream of the corrected one re-run: correcting identity re-runs C3 with the seller's choice pinned and re-runs H (comps). Correcting category re-picks the shot list.
4. If the seller chose "None of these" and typed a name, that text becomes a new candidate and D runs once more with it, so the label is checked against the photos too [inferred].
5. Corrections count toward the tier rules: a question whose Filled answers were never corrected over N items can widen its Filled band (section 6).

### 4.9 Step H: identity to comparable listings (seeds pricing)

- Verified C1 and C2 results (`same_as_candidate` ≥ 0.85 for the accepted identity) become Comps with `kind: asking`, `source: lens | ebay_image`, price, url, date seen.
- Exa `/search`, `type: "auto"`, `query` = the accepted candidate's `search_query` plus size, `includeDomains`: ebay.com, poshmark.com, depop.com, mercari.com, grailed.com; `outputSchema` object with `title`, `price`, `sold` (bool), `size`, `condition`, `url` (10 properties max) [observed limits].
- These go to the price feature's sold and asking split ([sold-price-data.md](../../price/ben/sold-price-data.md)). Identify's job ends at "here are N verified matches for this exact identity" [inferred boundary].

### 4.10 Where it runs and how fast

- **Runs in the backend**, as a Databricks App (FastAPI) that Agent Bricks' runtime orchestrates as durable steps. OpenAI Responses and Decisions are called directly with the OpenAI Python SDK from that code, with the key in a Unity Catalog secret [inferred]. Reason: Model Serving external models support only chat, completions and embeddings task types [observed], so `/v1/decisions` cannot be a served endpoint. Terra could go through Unity Gateway (GPT-6 models listed there, per [databricks.md](../../data/ben/databricks.md)) but one client for both is simpler; decide at setup.
- Every step is an MLflow span (`mlflow.start_span`) with inputs, the Decisions answers, thresholds and band; the trace id is stored on the Item so the `why_sheet` can read it [inferred design over observed MLflow tracing].
- The app reads the card from Lakebase; steps write there as they finish, and the app streams fields in (server-sent events from the App) [inferred].

Latency budget from the last shot to a filled card *agent proposal*:

| Step | Runs | Budget | Basis |
|---|---|---|---|
| Upload last photo (1536 px JPEG, ~400 KB) | phone to App | 0.7 s | inferred |
| C1 Lens, C2 eBay image (parallel) | backend | 3 s | SerpApi sample 2.75 s observed; eBay asserted |
| C3 Terra merge | backend | 4 s | asserted (Terra "fast"; no published latency) |
| D Decisions verify (~20 questions, cached photos) | backend | 1 s | vendor ~150 ms, Every median 0.35 s per passage, asserted |
| E defects (runs alongside C) | backend | in parallel | inferred |
| Render | app | 0.3 s | inferred |
| **Total to filled card** | | **~9 s p50, 15 s hard cap** | inferred |

Category, color, brand, size and materials are on the card **before** the last shot (steps A and B ran during capture), so the seller sees the card filling the whole time; only identity and condition arrive in the last ~9 s. At the 15 s cap, whatever is not verified shows in the Ask band rather than spinning [inferred]. Measure the real numbers on day one and replace this table.

### 4.11 App platform, from identify's angle

Identify itself runs on the server and works the same for native or web. Native adds on-device tag OCR (no upload wait, live "tag readable" while aiming) and barcode reading, about 2 hours of Swift with `RecognizeTextRequest` and `DetectBarcodesRequest` [inferred estimate]. If the team goes native for LiDAR and Object Capture anyway, take it; identify alone does not justify native. A web app sends the tag photo to Terra and loses about 1 s [inferred].

## 5. Data contract

Every field written by identify is a triple `{value, source, confidence}` plus `evidence` (photo ids and an optional box) and `trace_id`. Sources: `seen` (model read the photo), `read_from_tag` (OCR plus parse), `matched` (verified against an outside listing), `you_said`, `not_found`.

| Primitive.field | Example | Source | Confidence from |
|---|---|---|---|
| Item.identity.category | jacket | seen | Decisions `category` confidence |
| Item.identity.department | men | seen | Decisions `department` |
| Item.identity.brand | Carhartt | read_from_tag | `brand_visible` p and OCR match |
| Item.identity.line | Detroit Jacket | matched | `identity` confidence × `same_as_candidate` |
| Item.identity.model | J97 | read_from_tag or matched | as above |
| Item.identity.style_code | J97 BRN | read_from_tag | OCR string; confirm predicate |
| Item.identity.size_label / size_system | L / alpha | read_from_tag | `size_label` choice and `size_tag_matches_ocr` |
| Item.identity.color_primary | brown | seen | `color_primary` |
| Item.identity.materials | [{cotton, 100}] | read_from_tag | OCR; `material_outer` as cross-check |
| Item.identity.era | 1990s | seen | `era` (often Confirm or Ask) |
| Item.identity.country | Mexico | read_from_tag | OCR |
| Item.identity.rn | 14806 | read_from_tag | OCR |
| Item.identity.gtin | 883049... | read_from_tag (barcode) | barcode checksum |
| Item.condition.level | good | seen | `condition` score; `probabilities` kept |
| Item.condition.platform_ids | {ebay: 3000, mercari: "Good", ...} | derived | from level via 4.6 |
| Item.flaws[] | {type: stain, severity: visible up close, photo, box_2d, tile_p} | seen | tile predicate and severity score |
| Item.flags.genuine_check | true | seen | `is_counterfeit_risk` |
| Item.identity.matches[] | {url, source, price, same_p} | matched | `same_as_candidate` |
| Photo.ocr_text, Photo.ocr_boxes | "RN 14806 ..." | read_from_tag | Apple Vision or Terra |
| Photo.role_check | {label_legible: 0.93} | seen | capture checks |
| Job (kind identify) | stages A..H with state, started, ended, ms | system | — |
| Decision (kind identify) | {fields in Confirm/Ask, options, suggested, why: question names + probabilities} | system | thresholds |

Delta tables (Unity Catalog `secondhand.identify`): `runs` (one row per step per item with model, latency, tokens), `answers` (one row per Decisions answer with all probabilities), `labels` (one row per human confirmation or correction), and `thresholds` (per question, version, band edges, computed from). Photos stay in the `secondhand.raw.photos` volume [inferred, consistent with [databricks.md](../../data/ben/databricks.md)].

## 6. How to prove it works before the demo

**Labelled set** *agent proposal*:
- 40 real items from the team's closets and desks: 28 clothing (mix of branded, vintage, unbranded, with and without tags), 12 rigid (electronics, kitchen, books, games). Ground truth written by the owner from the tag and memory before running the pipeline.
- 150 eBay sold or active listings with filled item specifics (brand, size, color, condition ID) as a cheap, noisy second set: their photos in, their specifics as labels. Noise is the seller's own error, so report it separately [inferred].

**Per-field measures:**

| Field | Measure | Demo bar |
|---|---|---|
| category, department, color, material | top-1 accuracy; accuracy within the Filled band; share of fields in Filled | Filled-band accuracy ≥ 95% |
| brand, size (tag-read) | exact match | ≥ 95% when the tag is legible |
| identity (line + model) | exact match at Filled; top-4 recall in candidate cards | top-4 recall ≥ 80% on branded items |
| condition | mean absolute error in levels; within one level | within one ≥ 90% |
| defects | per-photo recall of seller-marked defects; false pins per item | recall ≥ 80%, ≤ 1 false pin per item |
| calibration | reliability plot and expected calibration error per question | shown in the "why?" screen |
| latency | p50 and p90 last shot to filled card | p50 ≤ 9 s |

**How many labels is defensible:** with 40 items, a 90% accuracy has a 95% Wilson interval of roughly 77% to 96%; with 100 items, roughly 83% to 94% [inferred calculation]. So for the pitch: "40 real items, per field, with intervals" is honest; "it's 97% accurate" from 40 items is not. Pool the eBay set for calibration plots, keep the 40 real items for the headline numbers.

**Threshold recompute (Databricks):** a scheduled job reads `answers` joined to `labels`, and for each question picks the lowest Filled threshold where Filled-band accuracy is ≥ 95% with at least 20 labelled answers above it; until then the default from 4.7 stays. Writes a new row to `thresholds`, logged as an MLflow run with the reliability plot as an artifact [inferred design over observed MLflow features]. In the demo, correct one field live and show the label land and the counter tick: "Size: 41 confirmed, 0 corrected".

## 7. Decisions for Ben

1. **What does the seller see first after the last shot?**
   - A. The filled card, with Confirm fields highlighted and one "Looks right" button. *Recommended*: matches "no thinking" and still shows the human in the loop.
   - B. A question at a time (Is this a Carhartt J97? Yes / No), then the card.
   - C. Only the fields we're unsure about; the rest is hidden until listing.
2. **How much of the confidence do we show?**
   - A. A small dot per field (filled, confirm, ask) and numbers only in the "why?" sheet. *Recommended*: show, don't say.
   - B. Percentages on every field.
   - C. Nothing visible; only the questions.
3. **Which items does the demo identify well?**
   - A. Clothing deep (tag, model, era, condition) plus one rigid category with barcodes. *Recommended*: clothing is where measuring and Seedream already focus.
   - B. Clothing only.
   - C. Anything at a garage sale, shallower everywhere.
4. **Do we use Google Lens results through SerpApi?** It works through a third party reading Google's results, which is a terms-of-service gray area for a product [asserted, from memory].
   - A. Yes for the demo, labelled as such, with eBay image search and Exa as the official paths. *Recommended*: it is the strongest exact-match source.
   - B. No; eBay image search, Cloud Vision web detection and Exa only.

Technical choices I made (not for Ben): Terra for candidates and tag parsing; Decisions for verification and condition; Gemini only for defect boxes; base64 images; OpenAI called directly from the Databricks App; SerpApi plus eBay image search in parallel; Exa after candidates.

**Tool swaps from Ben's choices:** none. The Decisions API stays, as the judge. It is paired with a generator because it cannot produce names. Exa stays, but it takes text only, so it moves after candidate generation.

## 8. Limits

- Searched: OpenAI Decisions guide, API reference and changelog; OpenAI model pages for GPT-6 Sol and GPT-6.1 Terra; Databricks external models docs; SerpApi Google Lens docs; Google Cloud Vision web detection docs; Gemini image understanding docs; Apple Vision `RecognizeTextRequest`; Exa search guide and image-search demo; eBay condition IDs; eBay Browse method list; Mercari condition help; secondary write-ups on eBay, Poshmark, Mercari, Depop, Vinted AI listing; StockX authentication page; Merlin via eBird support; FTC RN database page.
- Could not reach: openai.com/index/decisions-api and the towardsdatascience Decisions guide (fetch errors); the eBay `search_by_image` schema page (rendered without parameters; base64 `image` field is from a practitioner post and eBay support's example as quoted in the forum); Poshmark's and Depop's own condition lists; Vinted's own AI listing docs; Whatnot's authentication process (not searched in depth).
- Not measured: any latency or accuracy number for Terra, Decisions on images, Lens or eBay image search on our items. Every number in 4.10 and 6 is a starting assumption until day one's run.
- Unknown: Decisions rate limits and whether the beta cap of 128 images per request still holds at GA; whether Terra exposes logprobs; whether Gemini `gemini-4-hydrogen` is the right current model name for production (it is the name in Google's examples).
