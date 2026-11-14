# How does one appraisal run, step by step, and how do we know it's right?
Researched 2026-11-14 by Ben (Claude Code agent, thread "Plan the build for pricing, search and watch"). Feature: appraise.

This note turns [garage-sale.md](garage-sale.md), [valuation-engine.md](../../price/ben/valuation-engine.md), [what-market-value-is.md](../../price/ben/what-market-value-is.md), [pricing-in-context.md](../../price/ben/pricing-in-context.md) and [openai-decisions-api.md](../../identify/ben/openai-decisions-api.md) into one run a builder can follow: what is called, in what order, how long it may take, where the person decides, and how we test it. The pipeline is an *agent proposal*. Facts it rests on are marked *observed* (I opened the source and it says so), *asserted* (the source claims it without showing it, or from memory) or *inferred* (my reasoning). Model behaviour claims carry the model name and the date of the source.

Ben's principles applied throughout: human in the loop is the feature, not a fallback; the UI is built from a fixed set of components and the run decides which to show; API cost does not matter for the demo ([words](../../../product/words.md)).

## What changed from the draft

My draft from memory was: Decisions API reads the photo, Lens finds the item, eBay sold comps price it, one question card, verdict. Six findings changed it.

1. **There is a public benchmark to beat, and it says identity is the bottleneck.** FlipTip's blind test (99 eBay sales, updated 2026-11-14) got the exact model on 57% of photos and brand plus line on 79%. Its range held the real sale 68% of the time (target 70%), with a typical miss of $26 on a $100 sale. When it was unsure (82% of photos) it asked the user to confirm, and the right model was among its choices only 55% of the time (observed, [fliptip.ai/accuracy](https://fliptip.ai/accuracy), vendor-published, not independently checked). So the identity confirm step needs a "none of these, show me the label" path that works, not just a list of candidates.
2. **Even perfect identity misses by about a quarter.** In the same test, the median of the other recent sales of the exact same item missed by $28 on $100 (observed, same page). Sold prices for one identity are that noisy. We should show a range and a max pay with margin, never a point price, and judge ourselves on range coverage and decision quality, not on point error.
3. **FlipTip already asks for "the extra photo that would settle it" and re-prices on a tap; Underpriced already asks "Is it one of these?"** (observed, [fliptip.ai](https://fliptip.ai), [underpricedai.com](https://underpricedai.com/help/what-you-get-with-every-scan)). Asking for a photo is not our edge. Asking for a *physical check a photo cannot show* (does it turn on, smell, count the pieces, is it a reproduction) plus the per-channel net, a live haggle card and "Bought it" into a listing is.
4. **The Decisions model is weak at reading text.** `gpt-6-luna`, the only Decisions model, scores 59.8% on Roboflow's OCR eval (rank 36 of 53) and 87.5% on identification (observed, [Roboflow playground](https://playground.roboflow.com/models/openai/gpt-6-luna), Nov 2026). So Decisions judges; it does not read labels. A strong vision model extracts the label text first, and Decisions answers typed questions over the photo plus that text.
5. **Frontier vision calls take 8 to 13 seconds, so the Glance tier cannot be one.** On Roboflow's evals the top models take 7.6 to 13.4 s per sample, and the only model under 4 s with an OCR score is Gemini 3.5 Flash-Lite at 3.92 s and 65.8% OCR (observed, [Roboflow evals](https://playground.roboflow.com/evals), [OCR arena](https://playground.roboflow.com/arena/ocr), Nov 2026). Glance must come from the Decisions call (vendor claim about 150 ms) and cached category bands; identity streams in during Check.
6. **Google Lens "products" is gone; Exa has no image search.** SerpApi says "Google has discontinued the Products search type in Google Lens"; `visual_matches` remains and some results carry price, condition and in_stock (observed, [serpapi.com/google-lens-api](https://serpapi.com/google-lens-api)). Exa's search page lists no image input or product category (observed, partial read, [exa.ai/docs/reference/search.md](https://exa.ai/docs/reference/search.md)). So candidates come from Lens and eBay image search, and Exa only runs once there is a text identity.

## The run at a glance

```
CAPTURE ─► GLANCE (≤2 s) ─► IDENTIFY (Check, streams 3–10 s) ─► [YOU: confirm identity]
   │                                                             │
   │                                                             ▼
   │                         COMPS ─► ADJUST ─► RANGE PER CHANNEL ─► NEXT QUESTION ─► [YOU: answer / skip]
   │                                                             │        ▲ loop until the verdict stops changing
   │                                                             ▼        │
   │                                       MAX PAY ─► VERDICT ─► [YOU: haggle live, Bought it at $X]
   │                                                             │
   └────────── DEEP (background, minutes): Exa + agent ─► notify ─► Item draft (capture, price, list)
```

Every arrow is a Job ([primitives.md](../../../product/primitives.md)) with a visible state, traced in MLflow on Databricks so the item's "why?" timeline shows each step ([decisions.md](../../../product/decisions.md)). Every box in brackets is a human checkpoint.

## Step by step

Latency budgets are *agent proposals* derived from the measured numbers above. "p50" means what we design for; the run streams, so the screen never waits for the slowest call.

### 0. Capture

- **Input:** one to three photos (whole item, then label or maker's mark if the Glance asks), or a pasted listing URL, or a typed name.
- **Model/API:** none on the critical path. The client downsizes to about 1024 px and uploads once to Databricks (Volumes or object storage) so every later call gets a URL, and sends base64 inline to the calls that start before the upload ends. Decisions accepts "inline base64 data URLs or publicly accessible HTTP or HTTPS URLs" and not `file_id` (observed, [Decisions guide](https://developers.openai.com/api/docs/guides/decisions)). eBay `search_by_image` takes a base64 string (observed, [Browse API overview](https://developer.ebay.com/api-docs/buy/static/api-browse.html)). SerpApi Lens needs a public URL or a two-step upload that returns an `image_id` (observed, [serpapi.com/google-lens-api](https://serpapi.com/google-lens-api)).
- **Pasted link:** fetch the listing (eBay Browse `getItem` for eBay; Browser Use or the secondhand-mcp scrapers for Depop, Poshmark, Facebook, as in [existing-tools.md](existing-tools.md)) and treat its photos and title as the capture. The listing's own asking price becomes `asking` (inferred).
- **Output:**
  ```json
  {"capture_id":"c_123","photos":[{"url":"…","role":"whole|label|mark|defect"}],"source":"camera|link|text","asking":{"amount":20,"currency":"USD","from":"seller_said|listing"},"location":{"lat":43.07,"lng":-89.40},"online":true}
  ```

### 1. Glance (budget p50 1.5 s, hard stop 2 s)

- **Model/API:** one Decisions call, `gpt-6-luna`, with the whole-item photo and these questions: `category` (choice over our demo categories plus `other`), `photo_usable` (predicate: whole item visible, in focus, lit), `has_readable_label_region` (predicate), `is_multiple_items` (predicate), `likely_branded_luxury` (predicate, gates the authenticity path). OpenAI claims Decisions answers "about 10x faster than the Responses API" (observed, guide); a third party reports the vendor figure as "on the order of 150 milliseconds" against about 1.6 s through the regular API, unreproduced (asserted, [OrcaRouter, Oct 2026](https://www.orcarouter.ai/blog/openai-decisions-api-gpt-6-luna)). **Measure this with images on day one**; if it is over 1.5 s, Glance falls back to the category band alone.
- **Price band:** a cached table on the client: category → p25 to p75 of sold prices from the index, refreshed nightly from Databricks gold tables. Works with no signal (inferred).
- **Output:**
  ```json
  {"category":{"choice":"vintage_tee","confidence":0.82,"probabilities":[…]},"photo_usable":0.91,"label_region":0.34,"multiple":0.05,"luxury":0.02,"band":{"low":8,"high":25,"basis":"category"}}
  ```
- **What the person sees:** the photo with a category chip and a band ("usually $8–25"), and, if `label_region < 0.5` for a category where the label matters, a single prompt to shoot the label. If `photo_usable < 0.7`, a retake prompt (threshold from [openai-decisions-api.md](../../identify/ben/openai-decisions-api.md), to be recalibrated).

### 2. Identify (Check tier, streams; first candidates by 4 s, settled by 8 s)

Three calls fire in parallel the moment the photo exists:

| Call | What it returns | Latency evidence |
|---|---|---|
| **Vision extractor** on all photos: brand, line, model, label text verbatim, RN number, made-in, care-label type, era cues, size, visible defects, and `unknown` for anything not visible | the listing schema of [valuation-engine.md](../../price/ben/valuation-engine.md) | Frontier VLMs 7.6 to 13.4 s per sample on Roboflow (observed). Recommend **Gemini 4 Carbon** here: best OCR on that board, 87.2% at 8.71 s, ahead of the best GPT-6 at 81.9% (observed, Nov 2026). Ben named no vision model, so this is the one place a non-named model is proposed |
| **Google Lens via SerpApi**, `type=visual_matches`, `country=us` | titles, links, sources, thumbnails, sometimes `price`, `condition`, `in_stock`, `exact_matches` flag | SerpApi dashboard shows 6.96 s average response across its engines, Lens not separated (observed, [api-metrics](https://serpapi.com/google-lens-api/api-metrics)) |
| **eBay Browse `search_by_image`** | active eBay listings that look like it, with prices | No latency found. One developer report of persistent "image data is empty, is not Base64 encoded" errors in sandbox, unresolved (observed, [eBay community](https://community.ebay.com/t5/Traditional-APIs-Search/Problem-with-Image-Search-API-Requests/m-p/35127945)). Test in production on day one |

Then a **resolver** (a Responses call with structured output, or plain code for catalogue IDs) merges them into ranked identity candidates, each pointing to its evidence: "label reads LEVI STRAUSS & CO, RN 15763" or "Lens exact match on 3 sellers". It resolves to a catalogue ID where one exists (UPC, Discogs release, style code, PriceCharting product), otherwise to our identity cluster. A **Decisions call** then scores each candidate: `candidate_matches_photo` (predicate per candidate, with the candidate's reference image inside the question instructions, which the API allows) and `is_reproduction_or_fake` (predicate), plus a `choice` over the candidates and `none_of_these`.

Two rules from the evidence:

- **Never write `absent` for a driver the model did not see.** VLMs are poor at telling when an attribute cannot be judged: 34.1% F1 on "not applicable or not visible" against 70.8% when the attribute is visible, across GPT-5 and Gemini 2.5 tiers (observed, [arXiv 2601.15711](https://arxiv.org/abs/2601.15711), Jan 2026; older models than ours). A driver is `present` only with pointed evidence, otherwise `unknown`, and unknown drivers are what the next-question step asks about (inferred).
- **Name a model only when there is proof.** FlipTip's stated rule is the same: it "names the exact model only when it can point at the proof" (observed, fliptip.ai). Each candidate carries `evidence[]`; no evidence, no exact model.

- **Output:**
  ```json
  {"candidates":[{"id":"levis_501_usa_80s","label":"Levi's 501, Made in USA, 1980s","p":0.58,"level":"cluster","evidence":[{"kind":"label_text","text":"MADE IN U.S.A."},{"kind":"lens_match","url":"…","price":85}]},{"id":"levis_501_modern","label":"Levi's 501, 2000s+","p":0.31,"evidence":[…]}],"none_p":0.11,"repro_p":0.04,"drivers":[{"name":"made_in_usa","state":"present","evidence":"label_text"},{"name":"big_e","state":"unknown"}],"defects":[{"type":"hole","where":"left knee","severity":0.3,"photo":"…"}]}
  ```

### 3. Human checkpoint: confirm identity

Always shown, never auto-committed (already the UX direction in [valuation-engine.md](../../price/ben/valuation-engine.md)). The person sees up to three candidate tiles, each with a reference photo and the one piece of evidence that separates it ("Made in USA label"), plus "None of these", which opens a type-it field and a "shoot the label" button. If the top candidate's probability is above a calibrated threshold, it is preselected and the run continues while the card stays tappable; tapping another candidate re-prices without a new photo, as FlipTip does (observed). Each choice is logged as a label for calibration (inferred).

### 4. Comps retrieval (budget p50 1.5 s after identity)

- **Model/API:** Databricks Vector Search (hybrid keyword plus embedding) over the silver listing table, filtered by category and identity cluster, as in [valuation-engine.md](../../price/ben/valuation-engine.md). Text comps from the index; Lens and eBay image results from step 2 are added as **asking** observations, never as sold (Lens prices are mostly retail or asking; inferred from the fields it returns). Back off from fine to coarse identity until there are enough comps, widening the range at each step.
- **Junk filter:** a batched Decisions call over comp titles and thumbnails: `is_for_parts`, `is_lot`, `is_reproduction`, `same_variant_as_target` (predicates). Batch these at index time where possible, since one request takes up to 400 questions (observed, guide). PriceCharting drops "For Parts" and "Reproduction" by keyword (observed in [what-market-value-is.md](../../price/ben/what-market-value-is.md)); MMR excludes salvage, lemon and similar invalid transactions before pricing (observed, [Manheim MMR help](https://site.manheim.com/?p=388)).
- **Output:** `comps[]` with `{url, channel, status: sold|active, price, shipping, sold_at, condition, drivers, similarity}`.

### 5. Adjust (code, under 100 ms)

Plain code, no model, so every number is explainable: `adjusted = price × condition_factor × Π driver_factor × time_factor`, each factor learned per category ([valuation-engine.md](../../price/ben/valuation-engine.md)). Each comp keeps its `adjustments[{reason, amount}]` so the comps strip can show them. Outliers are removed and marked, as MMR does: it removes outliers "based on sale price, mileage, and condition" and keeps them visible with an asterisk (observed, Manheim). Drop a comp whose adjustments exceed about 25% of its price (real-estate heuristic, asserted in the earlier note).

### 6. Range per channel (code, under 100 ms)

Weighted quantiles of adjusted sold comps per channel, net of fees and shipping or pickup, with days-to-sell from the synthetic order book in [pricing-in-context.md](../../price/ben/pricing-in-context.md). Copy MMR's contract exactly where it transfers:

- **The range is stated as a coverage:** MMR's range reflects "the probability that 70% of sales with similar attributes will fall within the range" (observed, Manheim). FlipTip aims for about 70% too, and Underpriced says about 8 in 10 (observed). We state 70% and test it (section "How we know it's right").
- **Abstain below a floor:** MMR needs at least 6 transactions in the past year and 2 in the past 90 days for a trim; below that it may show a related-trim estimate with a "Small Sample Size" icon, or hide the range (observed, Manheim). Our starting rule (*agent proposal*): a channel gets a range with 6 or more effective sold comps in 12 months and 2 in 90 days; otherwise it shows the coarser band with a small-sample mark, or "not enough sales" and a Deep research offer.
- **Label the level:** 1 (identical item has a live market, e.g. Discogs, PriceCharting), 2 (adjusted similar sales), 3 (model or research guess), from [pricing-in-context.md](../../price/ben/pricing-in-context.md).

### 7. Next question by value of information (budget 1 s)

- **Model/API:** code computes, for each `unknown` driver and condition aspect, the change in the buy/skip decision between its possible answers (not the change in price; a big price swing that does not flip the decision is not worth asking). The top one is phrased from the per-category driver lexicon (written once by a model, reviewed by us), not generated live. A Decisions predicate can pre-fill a likely answer from the photo ("Made in USA visible: 0.62") so the card offers it as the default.
- **Stop rule:** stop when no unresolved question can flip the verdict, or after three questions, or when the person taps "Skip" (inferred).
- **Questions a photo cannot answer are the edge:** "Plug it in: does it turn on?", "Smell it: smoke or mildew?", "Count the pieces", "Is the zipper marked YKK or Talon?". FlipTip asks for photos only (observed); none of the apps checked asks for a non-photo check (observed absence on their pages; a narrow search does not prove none does).

### 8. Max pay (code)

From [garage-sale.md](garage-sale.md):

```
max_pay = P(identity right) × P(condition as judged) × P(authentic) × net(best channel, realistic days)
          − hassle(size, channel) − risk_margin(range width) − target_profit(user setting)
```

- `net` uses the **p25** of the best channel, not p50, because a quarter of sales of the exact item fall below it and the typical miss for perfect identity is about 28% (observed, FlipTip benchmark above; the choice of p25 is inferred).
- `P(authentic)` comes from the category's fake rate when we cannot verify. Entrupy reports 34.85% of apparel, 11.1% of footwear and 8.1% of luxury authentications "unidentified", and over 70% for some streetwear brands such as Fear of God Essentials (95.75%) and Nike apparel (73.33%) (observed, [Entrupy State of the Fake 2026](https://www.entrupy.com/report/state-of-the-fake-report-2026/); these are items sent for authentication, a biased sample). For those brands, max pay is computed **as if fake** unless the person completes a verification check, and the card says what would raise it (inferred).
- **Output:**
  ```json
  {"max_pay":18,"fair_offer":12,"walk_away_above":18,"best_channel":"depop","net_p25":34,"days":12,"profit_at_asking":9,"basis":{"p_identity":0.86,"p_condition":0.9,"p_authentic":1.0,"hassle":3,"target_profit":10}}
  ```

### 9. Verdict and live haggle

- **Verdict:** `buy` (asking ≤ fair offer), `offer` (fair offer < asking ≤ max pay, with the number to say), `skip` (asking > max pay), or `unsure` (abstained, or identity unconfirmed). The verdict is a function of numbers already on screen; no model writes it (inferred).
- **Seller haggling live:** a number pad card ("They said $15") re-runs only steps 8 and 9, under 100 ms, offline. It shows profit at that price on the best channel. No scripts to pressure the seller ([garage-sale.md](garage-sale.md)).

### 10. Human checkpoint: "Bought it"

"Bought it for $X" is a Never-alone-style tap that cannot be automated ([decisions.md](../../../product/decisions.md) tiers). It creates an **Item** with the confirmed identity, drivers with their source (*you said*, *seen in photo*), defect photos, comps and purchase cost, in the Researching state, and queues capture, measure and price. eBay's own visual identification, launched 2026-11-11 in six countries, goes photo → AI-filled draft → seller reviews and publishes, with no candidate step described and no price in that flow (observed, [Digital Commerce 360](https://www.digitalcommerce360.com/2026/11/11/ebay-visual-identification-magical-listing-tool/)). Judges will know that pattern, so our draft should arrive already priced per channel and carrying the appraisal's evidence, which eBay's does not (inferred).

### 11. Deep (background, minutes)

Runs when the person taps it, or automatically when the run abstained or the level is 3. An Agent Bricks agent uses Exa (`deep` for research; `deep-lite` has "a consistent 4-second latency", observed, Exa docs) on the confirmed text identity, plus Browser Use on marketplace sold pages, to find maker, era and sold comps. Results are written back to the index with sources and the person gets a notification and an updated Valuation. Exa cannot take the photo (observed above), so Deep starts from the confirmed identity or the label text.

## Latency per tier

| Tier | Budget (*agent proposal*) | Critical path | Measured basis |
|---|---|---|---|
| Glance | ≤ 2 s | Decisions call + cached band | Decisions ~150 ms vendor claim (asserted); band is local |
| Check | first candidates ≤ 4 s, verdict ≤ 10 s | max(vision extractor ~9 s, Lens ~7 s, eBay image) → resolver ~1 s → comps 1.5 s → code | Roboflow and SerpApi numbers (observed). FlipTip is 30–70 s (observed); FlipperScanner 10–20 s (asserted) |
| Deep | minutes, notify | Exa deep + agent browsing | none measured |

Inferred consequence: Check fits 10 s only if the vision call and Lens run in parallel and the resolver starts on whichever arrives first. If the vision call alone exceeds 10 s on garage photos, the fallback is Gemini 3.5 Flash-Lite (3.92 s, observed) for the first pass with the strong model refining in the background.

## Human checkpoints, all of them

| # | When | What the person sees | What they can do | What it teaches us |
|---|---|---|---|---|
| H1 | Glance, bad photo or label needed | Photo with one prompt | Retake, shoot label, or continue | threshold for `photo_usable` |
| H2 | Identity (always) | Up to 3 candidate tiles with the separating evidence | Pick, "None of these" and type, shoot label | identity calibration, resolver errors |
| H3 | Next question (0 to 3 times) | One question card with a pre-filled likely answer | Answer, "Can't check", Skip | driver priors per category |
| H4 | Authenticity (branded, high fake rate) | "Pay as if fake: $4. Check the stitching on the tag to raise it" | Do the check, accept fake price, skip | fake priors |
| H5 | Haggle | Number pad and profit at that price | Enter seller's number | price elasticity at garage sales |
| H6 | Bought it | Amount field prefilled with the asking or last offer | Confirm price, or "Didn't buy" | the purchase cost; later the sale closes the label |
| H7 | Range override | Comps strip with each adjustment | Remove a comp ("not the same"), which re-prices | comp-matching errors |

Every H answer is an evaluation label stored with the inputs and probabilities in a Delta table, which is the Databricks learning loop already decided ([decisions.md](../../../product/decisions.md)).

## The component catalog

The run never generates free UI. Google's free-form generative UI writes a fresh HTML page per prompt and "can sometimes take a minute or more" (observed, [Google Research, 2025-11-18](https://research.google/blog/generative-ui-a-rich-custom-visual-interactive-user-experience-for-any-prompt/)), which is far over budget. The pattern that fits is a **fixed catalog the agent selects from**: A2UI v0.9 has the client declare a catalog, the agent "picks the best match", messages are `createSurface`, `updateComponents`, `updateDataModel`, the client sends `action` back, and "Nothing executable crosses the boundary" (observed, [CopilotKit on A2UI v0.9, 2026-04-17](https://copilotkit.ai/blog/a2ui-whats-new-in-google-generative-ui-spec)). The AI SDK equivalent is typed tool parts (`tool-${toolName}`) rendered as React components with `output-available` and `output-error` states (observed, [ai-sdk.dev](https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces.md)).

*Agent proposal:* use the AI SDK tool-part mechanism with an A2UI-style catalog of our own components. Code decides which components are **mandatory** (a price is never shown without the comps strip; a verdict never without max pay); the model chooses among the **optional** ones and fills them. The choice itself can be a Decisions `choice` question over the catalog, which gives a probability we can threshold and log.

| Component | Shows | Shown when | Action back |
|---|---|---|---|
| `retake_prompt` | Photo with the problem outlined | `photo_usable` low | retake |
| `shoot_this` | Silhouette of where to point (label, base, runout) | label or mark would resolve identity | capture |
| `identity_picker` | Up to 3 tiles + None | always after Identify | pick, type |
| `question_card` | One question, 2 to 4 answers, pre-filled default | VOI says it can flip the verdict | answer, skip |
| `range_bar` | Per-channel band with the asking price as a marker | range exists | tap channel |
| `channel_strip` | Site logos with net and days | 2+ channels priced | tap for comps |
| `comps_strip` | 3 to 8 sold photos with price, date, adjustment chips | always with a price | remove comp |
| `max_pay_meter` | Asking vs fair offer vs walk-away | asking known | edit asking |
| `verdict_badge` | Buy, Offer $X, Skip, Unsure | after max pay | none |
| `haggle_pad` | Number pad, profit at that price | verdict is Offer | enter number |
| `authenticity_check` | Which detail to check, with a reference photo | P(fake) prior high | do check |
| `abstain_card` | "Not enough sales", coarser band, Deep button | below comp floor | start Deep |
| `bulk_table` | Boxes over a table photo, each with a band | `multiple` high | tap one |
| `defect_chip` | Defect photo with its price effect | defect found | confirm, dismiss |
| `deep_progress` | Job state and when to expect it | Deep running | cancel |
| `bought_it` | Price field and button | always at the end | confirm |

Copy for every component goes through [copy.md](../../../product/copy.md) and the UI constitution: no statistics notation on screen, the comps strip shows photos and dates, not "n=41" ([ui-constitution.md](../../../product/ui-constitution.md)).

## Failure and edge cases

| Case | Detection | Behaviour |
|---|---|---|
| Wrong identity | Person picks another candidate or None; later the sold price falls outside the range | Re-price on tap; resolver error logged for that category (inferred) |
| Reproduction or fake | `is_reproduction_or_fake` predicate; category fake prior; "reproduction" in comp titles | Max pay as if fake; `authenticity_check`; never Buy verdict on a high-fake brand without the check |
| No comps | Below the 6/12-month and 2/90-day floor | `abstain_card` with coarser band, level 3 label, Deep; recommend auction for valuable level-3 items ([pricing-in-context.md](../../price/ben/pricing-in-context.md)) |
| Bundle or lot | `multiple` predicate | `bulk_table`: value each, sum, and price the lot from lot comps when they exist (inferred) |
| No brand | Vision extractor finds no brand | Identity is a cluster (category, material, era cues, maker's mark); range widens; ask for the base or label |
| Bad light | `photo_usable` low | `retake_prompt` with the specific fix (flash, step back) |
| No signal | `online:false` | Glance and haggle run on the cached band and the on-device lexicon; Check queues and notifies later; the person can still tap Bought it at the asking price |
| Haggling live | Person enters a number | Only steps 8 and 9 rerun, locally |
| Pasted listing is stale or already sold | Fetch status | Show "sold" with that price as a comp instead |
| Seller's item is recalled or banned on platforms | Category list check | Flag before Bought it ([garage-sale.md](garage-sale.md)) |
| Prices are elastic only in the model's head | Seller reports of AI pricing failing on rare items, e.g. "an inflated price of about 10 times what it was actually worth" when there were no sold comps (observed, [eBay community thread](https://community.ebay.com/forum/selling-57920/topic/venting-about-ais-limitations-in-selling-practices-161158/?focus_post=214105), undated posts) | No model ever produces a price without comps; that is what the abstain rule is for |

## How we know it's right

Three layers, all *agent proposals*:

1. **A labelled set from the team's own items (before the demo).** 40 to 60 things the team owns or buys at real garage and thrift sales, across the three demo categories. For each: photos taken in bad conditions (driveway light), the true identity checked by hand, the driver answers, and, where possible, a real sale. This scores identity (top-1, top-3, and the rate at which "None of these" was the right answer), driver detection (precision when it says `present`, since `absent` is never asserted), and calibrates every Decisions threshold. 30 labelled items was the earlier minimum ([openai-decisions-api.md](../../identify/ben/openai-decisions-api.md)).
2. **A backtest on held-out sold listings, using FlipTip's protocol so the numbers compare.** Take recent sold listings per category, give the engine only the first photo with title and price hidden, remove that sale from the comps, exclude Best Offer sales (observed as FlipTip's method). Report per category: exact-identity rate, brand-and-line rate, median absolute percentage error, share within 20%, **share of true prices inside the stated 70% range**, and the "perfect identity" baseline (median of other sales of the same item). FlipTip's figures to beat: 57%, 79%, $26 per $100, 39%, 68%, and a $28 baseline (observed). Our claim to judges is honest only if we show our coverage next to the baseline.
3. **Abstention and decision quality.** Report abstention rate next to error, so refusing hard items cannot make us look good ([valuation-engine.md](../../price/ben/valuation-engine.md)). Score the verdict, not just the price: on the held-out set, simulate an asking price and count buys that would have lost money after fees (false buys) and skips that would have made the target profit (missed buys). And measure the questions: how often did the answer flip the verdict, and did the flipped verdict match the true sale? A question that never flips anything is dropped from the lexicon.

Then, live: every Bought it that later sells closes a label (predicted range vs actual, days). That is the number on the pitch slide once it exists, and the Databricks evaluation story.

## References and what we take (RDD transfer contracts)

| Reference | Job | Keep | Change | Check |
|---|---|---|---|---|
| OpenAI Decisions guide | implementation mechanism | Typed predicate/choice/score; base64 or URL images; up to 400 questions; `other` routed to review | Do not use for label OCR (luna 59.8% OCR) | Latency with images on our photos; whether `confidence` is calibrated |
| FlipTip site and accuracy page | evidence, interaction | Proof-before-model rule; tap to re-price; blind-test protocol; 70% range | 30–70 s becomes ≤10 s via streaming; add non-photo checks and per-channel net | Our numbers on the same protocol |
| Underpriced scan page | interaction | "Is it one of these?" with real listings; "None of these, say what it is" | Show sold, not active, as candidates' prices | none |
| Manheim MMR help | evidence, mechanism | 70% coverage range; 6/yr + 2/90-day floor; small-sample icon; outliers removed but shown; invalid transactions excluded | Trim fallback becomes identity back-off | Coverage on backtest |
| SerpApi Google Lens | mechanism | `visual_matches` with price, condition, exact flag | Treat prices as asking; Products type is gone | Lens latency alone; match quality on vintage |
| eBay Browse `search_by_image` | mechanism | Base64 image to active listings | Active only, never sold | Works in production |
| Roboflow Vision Evals | evidence | Model choice by OCR and latency | Their tasks are not garage photos | Rerun top 3 on our labelled set |
| arXiv 2601.15711 | evidence | VLMs cannot tell "not visible" well | Older models | Our driver precision |
| Entrupy State of the Fake 2026 | evidence | Fake priors per category and brand | Biased sample (items sent for checking) | none for demo |
| A2UI v0.9, AI SDK tool parts, Google generative UI | implementation mechanism, visual direction | Catalog plus data model plus actions; nothing executable | Free-form generation is too slow for us | Component choice logged and reviewed |
| eBay visual ID (Nov 2026) | evidence of the pattern judges know | Photo to draft to review | Our draft is priced and carries evidence | none |

## Limits

- eBay's `search_by_image` reference page did not render its schema; the request body (`{"image": base64}`) comes from a developer's post and the overview. Its production access terms were not confirmed.
- Lens latency is SerpApi's all-engine average, not Lens alone. No absolute Decisions latency with images was found; the 150 ms figure is a vendor claim relayed by a third party. A third-party article (Oct 2026) called Decisions "limited preview" while OpenAI's guide now says "generally available"; the guide is newer and primary.
- Roboflow's latencies are per sample on their eval prompts and settings, not on our requests.
- FlipTip's accuracy page is vendor-published and covers US eBay only.
- I did not find a published accuracy study of AI dating of vintage labels; practitioner pages found were marketing.
- FlipperScanner's and the eBay app's current flows were not opened this session.

## Frontier log

**Loop 1.** Seeds: Decisions guide (primary docs), SerpApi Lens docs (inspectable API), eBay `search_by_image` (primary docs), MMR help (dense rules with conditions). Changed: Decisions is GA and takes URL or base64, which settles the open conflict in [openai-decisions-api.md](../../identify/ben/openai-decisions-api.md); Lens Products type is discontinued; MMR's floor and 70% range confirmed. New lead: a vendor blind test that would set our evaluation protocol. Contrary lead kept: eBay image search may not work (sandbox errors).

**Loop 2.** Seeds: FlipTip page and accuracy test (concrete numbers with method), Underpriced scan help, eBay Nov 2026 launch, A2UI v0.9 and AI SDK, Google generative UI blog. Changed: the targeted photo request is not unique; perfect identity still misses about 28%; free-form generative UI is a minute or more, so a fixed catalog is required. New lead: model latency, because Glance under 2 s looked impossible with a VLM.

**Loop 3.** Seeds: Roboflow evals (measured latency and OCR per model), OrcaRouter on Decisions (latency claim, a counter-source on GA), SerpApi metrics, Exa search reference, arXiv attribute-labelling paper (failure mode with conditions). Changed: luna is weak at OCR so a separate extractor reads labels; Glance must be Decisions plus cached bands; drivers default to unknown. Neglected lead kept: on-device models (Mage-VL 4B at 1.17 s, Gemma 4 E2B at 3.6 s, observed on Roboflow) could make Glance and offline better, but none has an OCR score yet.

**Loop 4.** Seeds against the draft: seller complaints about AI pricing (practitioner failure traces), Entrupy fake rates (base rates), the "not real clothes" essay (AI photo trust). Changed: max pay must price fakes in by default for high-fake brands, and no price without comps. The essay confirmed photos must stay real but did not change the run.

**Open frontier (next actions, each bounded to an hour on day one):** time a Decisions call with one image from the venue network; time Gemini 4 Carbon and Flash-Lite on five garage photos; send one production `search_by_image` request; run Lens on five vintage items and count exact matches; build the 40-item labelled set. Unresolved: whether Decisions `confidence` is calibrated, and Lens-only latency.
