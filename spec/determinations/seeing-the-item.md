# Determinations: seeing the item
Status: *agent proposal* for Ben and Nate. Written 2026-11-14.

Area: everything the system decides from a capture, from the first frame to the photos a listing uses. Owning features: [capture](../features/capture.md), [identify](../features/identify.md), [measure](../features/measure.md), [item card](../features/item-card.md), [studio](../features/studio.md). Value shapes (`attribute`, `evidence`, `requirement`, `claim_check`, guarded number) are the ones in [spec/product.md](../product.md); they are not repeated here.

Rules that hold on every card:

- **Certainty principle.** Identity, variant, size, measurements and visible condition are resolved and then stated as confirmed, never as a percentage. Authenticity, function, hidden condition and anything about price or buyers are stated as not settled.
- **Source order.** A `you_said` value is never overwritten by a model. The person sees three source words: measured, estimated, you said.
- **Determinism.** A model turns pixels or text into comparable facts. A model output used in arithmetic is stored with its `extractor_version`. Every decision after that is arithmetic over stored rows, so the same rows always give the same result. A model call that is repeated (for example the 3 pointing runs) uses temperature 0 and a fixed seed where the vendor offers one, and the median of the stored runs is used.
- **Starting values.** Every weight and threshold marked (start) is a starting value. It lives in the `thresholds` table and is refit on held-out labels, per [identify build plan](../../research/identify/ben/build-plan.md).

Marks: observed = read at the source; asserted = stated by a source not checked; inferred = my reasoning.

## 1. Item kind

**Determines**: which of the 13 kinds in [identity-schema-by-kind](../../research/item-card/nate/identity-schema-by-kind.md) the item is. The kind chooses the fields, views, condition scale and checks.

**Sources and weights**

| source | what it contributes | weight or rank | why that weight |
|---|---|---|---|
| person's tap or words | the kind | overrides | owner statement; never overwritten |
| decoded code (GTIN, ISBN) mapped to a catalogue category | kind via the category map | 1.0 (start) | an identifier, not a resemblance |
| cloud `capture_judge` classifier over all accepted frames | probability per kind | 0.6 (start) | sees every view and the label text |
| phone provisional (Apple Vision classes, plane, outline softness, LiDAR extent) | probability per kind | 0.3 (start) | one frame, coarse labels; kept for speed |

**Method**

1. Model step: each source returns `p_s(k)` over the 13 kinds. A code source returns 1 for its mapped kind and 0 for the rest.
2. Arithmetic: `S(k) = sum_s w_s * p_s(k) / sum_s w_s`, over the sources present.
3. Accept the top kind when `S(top) >= 0.60` and `S(top) - S(second) >= 0.20` (start).
4. Otherwise raise decision `category_unsure`, showing the top 2 or 3 kinds as chips plus "Something else".
5. The phone value drives framing and shot prompts only. It is replaced when step 3 runs in the cloud.

**Why this method**: a weighted vote with a margin rule is a calibrated way to combine sources of unequal reliability, and the margin stops near-ties from being decided silently (inferred). Mercari's engineers left the category to the user after experiments showed it balanced simplicity and accuracy, and a toy car was listed as a real car (observed (excerpt), [clarifying-inputs §1](../../research/identify/nate/clarifying-inputs.md)). The alternative is a single classifier call. It is cheaper, but it hides the cases a margin rule catches.

**When it is not shown**: no source has run, or the margin rule fails. The person then sees the kind question with chips. The capture keeps running with the generic shot list.

**How it is explained**: "Looks like a jacket." Tap opens the frames and the label text that decided it, plus "Change".

**Speed**: the phone estimate is ready in under a second. The cloud vote runs once at the `judging` state. The category map is kept ready in Lakebase.

**Check later**: build a confusion matrix on 300 hand-labelled captures spread over the 13 kinds. It is wrong if more than 1 in 50 accepted kinds is wrong, or if more than 1 in 5 items needs the question.

## 2. Whether a frame is a usable view

**Determines**: whether one frame counts as a usable view, and which view it is: front, back, label, sole, close-up and so on.

**Sources and weights**

| source | what it contributes | weight or rank | why that weight |
|---|---|---|---|
| sharpness: variance of the Laplacian inside the item mask | blur pass or fail | gate 1 | a blurred frame cannot settle any field |
| exposure: share of clipped pixels inside the mask | pass or fail | gate 2 | clipped regions hide flaws and colour |
| coverage: mask area / frame area | pass or fail | gate 3 | too small loses detail; too large cuts the outline |
| pose bin (phone orientation + outline match to the view template) | which view | gate 4 | views are defined geometrically |
| vision model through the Decisions API: "does this frame show <view>, and is the text legible?" | yes or no | gate 5, two passes needed | semantic check that arithmetic cannot do |
| glare score on the label region (specular blobs over OCR boxes) | pass or fail on label views | gate 6 | glare is the usual cause of an unread tag (inferred) |

**Method**

1. Arithmetic gates 1 to 3 run first, on the phone. They are cheap and they reject most bad frames.
2. Starting thresholds (start): Laplacian variance above the 20th percentile of accepted frames for that kind, clipped share at most 2%, coverage between 0.20 and 0.85.
3. Gate 4 assigns a pose bin.
4. Gate 5 runs only on frames that pass gates 1 to 4. A view is accepted after two passes on two different frames, as in talk mode in [capture](../features/capture.md).
5. On label views, gate 6 also applies.
6. Thresholds are refit so that false accepts stay at most 1 in 20 and false rejects at most 1 in 10 (Ben's capture bars).

**Why this method**: a cheap-first cascade spends model calls only on frames that could pass, which keeps the phone loop near 1 fps (inferred). The two-pass rule halves single-call noise without a fixed confidence threshold (inferred, from the decision-tree design in [decision-tree-capture](../../research/capture/ben/decision-tree-capture.md)). The alternative is a single learned quality score. It needs labelled data we do not have yet, and it cannot say why a frame failed.

**When it is not shown**: a frame that fails any gate is not counted. The person sees one retake line naming the gate ("Too dark", "Hold still", "Closer to the tag"). After 2 failed tries the view is marked `not_visible` and the capture moves on.

**How it is explained**: "Got the back." Tap shows the frame that was kept.

**Speed**: gates 1 to 4 run on the phone per frame. Gate 5 runs at about 1 fps on 768 px frames.

**Check later**: label 500 frames as usable or not. Measure false accepts and false rejects. It is wrong if either bar is missed after one refit.

## 3. What must still be captured, and when it is enough

**Determines**: which views, labels and measurements are still missing, in what order to ask for them, and when the capture can stop.

**Sources and weights**

| source | what it contributes | weight or rank | why that weight |
|---|---|---|---|
| per-kind `requirement` rows (from [identity-schema-by-kind](../../research/item-card/nate/identity-schema-by-kind.md)) | the list of fields, views and `obtained_by` | defines the set | the kind's buyer-relevant fields are researched per kind |
| `requirement_reorder` in [score](../features/score.md) | priority = how often the field changed the value or the sale | rank order once learned | the fields that move the outcome go first |
| starting priority before learning | identifier label > size label > front > back > flaw close-ups > completeness parts > secondary views | rank (start) | an identifier settles the most fields per shot ([identify](../features/identify.md) evidence ladder) |
| current attribute state | which rows are met | filter | do not ask for what is already settled |

**Method**

1. Arithmetic. A row is met when its field has a value with `confirmed = true`, or the view it needs was accepted ([card 2](#2-whether-a-frame-is-a-usable-view)), or it has a `you_said` value.
2. Rows with `obtained_by` of seen, label or measured are shot prompts. Rows with `obtained_by` asked go to [card 17](#17-which-question-to-ask-next-and-when-to-stop).
3. Next prompt = the unmet shot row with the highest priority. Ties go to the view the person is closest to now, using the pose bin, to save movement.
4. A row is marked unobtainable after 2 failed attempts (`unknown_reason = not_visible` or `not_read`).
5. The capture is enough when every shot row is met or unobtainable, or when the person taps Done. There is no shot cap.
6. Unmet rows are written as `value: null`, confidence 0, with their reason. They never become a guess.

**Why this method**: a requirement checklist ordered by measured value-of-information is the standard active-acquisition shape, and it keeps the stop rule explicit instead of a shot count (inferred). Photo count raised sale odds more than photo quality did (observed, [quality-and-value-classifiers §3](../../research/price/nate/quality-and-value-classifiers.md)). That argues against stopping early on a fixed count. The alternative is a fixed shot list per kind. It is simpler, but it asks for views already settled by a read label and misses the ones a flaw makes necessary.

**When it is not shown**: before the kind is accepted, the generic list (front, back, any label) is used. If the person taps Done early, the missing rows show on the item card as "Not captured", each with "Add a photo".

**How it is explained**: "One more: the size tag." Tap shows the list of what is done and what is left.

**Speed**: the requirement rows per kind are kept ready on the phone. Re-ranking after each accepted view is local arithmetic.

**Check later**: compare the field-change rate on items stopped by this rule with items given a fixed list. It is wrong if the fixed list gives fewer later edits for the same capture time. Bar: a tee captured in under 70 s.

## 4. Text and codes read from labels

**Determines**: the exact text, barcode, model plate, style code, RN number or serial read from a label, and whether each reading can be used.

**Sources and weights**

| source | what it contributes | weight or rank | why that weight |
|---|---|---|---|
| barcode decode (Vision) with checksum | GTIN, UPC, EAN, ISBN | rank 1 when the checksum passes | the check digit makes a misread detectable |
| Vision OCR on the phone | text lines with boxes | engine A | fast; runs per frame |
| PP-OCRv5 on CPU in the cloud | text lines with boxes | engine B | independent second reading |
| per-kind regex parsers (size grammar, composition %, RN, style code) | field values from text | arithmetic | a deterministic parse is checkable |
| vision model mapping text to field names when no regex matches | proposed field values | rank last | must quote a substring of the OCR text |

**Method**

1. Model step: both OCR engines read every accepted label frame.
2. Normalise each reading: uppercase, remove spaces, map O to 0 inside digit runs.
3. A string is read when both engines agree after normalisation, or one engine agrees across 2 frames.
4. A code is read when its checksum passes. GTIN mod-10 is arithmetic.
5. Regex parsers fill fields from read strings.
6. The model fallback may propose a field only if its value is a literal substring of a read string. Otherwise the field stays `not_read`.

**Why this method**: two independent readers that must agree turn an unknown per-engine error rate into a far lower joint one, provided their errors are not correlated (inferred). No OCR benchmark on labels or serial plates was found (observed not-found, [open-facts §row 12](../../research/capture/nate/open-facts-seeing-the-item.md)), so agreement is the only defensible gate today. The alternative is a vision-language model reading the label in one call. It can fill in plausible text that is not there, the hallucination failure Mercari reported (observed (excerpt), [clarifying-inputs §1](../../research/identify/nate/clarifying-inputs.md)).

**When it is not shown**: disagreement after 2 frames gives `unknown_reason = conflict` and a retake prompt for that label. If it still disagrees, the field goes to a question showing both readings as chips.

**How it is explained**: "Read from the tag." Tap shows the label crop with the read text boxed.

**Speed**: phone OCR runs live. Cloud OCR runs at `judging`. The regex tables per kind are kept ready.

**Check later**: hand-transcribe 400 label crops across kinds. It is wrong if more than 1 in 100 strings marked read differs from the hand transcription.

## 5. Brand

**Determines**: the brand of the item, or that it has no brand.

**Sources and weights**

| source | what it contributes | weight or rank | why that weight |
|---|---|---|---|
| person | brand or "No brand" | overrides | owner statement |
| code → catalogue product | brand | rank 1 | identifier |
| label read matched to the brand dictionary (exact or edit distance 1 on names of 5 or more characters) | brand | rank 2 | text on the object |
| confirmed candidate product ([card 9](#9-which-product-it-is-and-when-identity-is-confirmed)) | brand | rank 2 | brand follows from the product |
| logo detection or vision guess | brand | rank 3; never confirms alone | Mercari's silver laptop was tagged Apple (observed (excerpt), [clarifying-inputs §1](../../research/identify/nate/clarifying-inputs.md)) |

**Method**

1. Collect the brand values by rank.
2. Confirmed if any rank 1 or rank 2 value exists and no other rank 1 or rank 2 value conflicts with it.
3. Rank 3 alone, or a conflict, gives a question with chips: the rank 3 guess, up to 2 alternatives from the candidate set, "No brand" and "Other".

**Why this method**: an identifier or printed text is evidence of the brand. A logo resemblance is evidence of a look, and counterfeits copy the look (inferred). This is the evidence ladder of [identify](../features/identify.md) applied to one field. The alternative is to trust a vision model above some confidence. It fails on exactly the items where brand drives price.

**When it is not shown**: no rank 1 or rank 2 value. The person sees the brand question, never a guessed brand.

**How it is explained**: "Brand from the tag: Patagonia." Tap shows the tag crop or the catalogue entry.

**Speed**: the brand dictionary (eBay aspect values plus catalogue brands) is kept ready on the phone for fuzzy matching.

**Check later**: on 300 labelled items, measure brand precision when confirmed. It is wrong if it is below 99%, the untapped Confirmed bar in [identify](../features/identify.md).

## 6. Variant

**Determines**: which variant of a confirmed model the item is: colourway, edition, capacity, year or region.

**Sources and weights**

| source | what it contributes | weight or rank | why that weight |
|---|---|---|---|
| code → catalogue | variant, since a GTIN is usually per variant (asserted) | rank 1 | identifier |
| style code, model number or catalogue number from the label read | variant | rank 2 | printed identifier |
| seen attribute (colour from [card 8](#8-colour), capacity read off a screen, edition text) | splits variants on one aspect | rank 3 | an observation of the aspect itself |
| image retrieval label `same_family_other_variant` | flags that variants differ | rank 4; never decides | image similarity cannot split near-twins |

**Method**

1. Start with V = the variants of the confirmed model, from the catalogue.
2. Arithmetic: filter V by each rank 1 to 3 value.
3. If |V| = 1, confirmed.
4. If |V| > 1, the splitting aspect goes to [card 17](#17-which-question-to-ask-next-and-when-to-stop) and is chosen by information gain.
5. If |V| = 0, the values conflict. Set `unknown_reason = conflict` and show the values that disagree.

**Why this method**: filtering a known variant set by observed aspects is exact set arithmetic. The open part is which aspect to ask about, and that is an information-gain problem (observed (excerpt), arXiv 2502.04485 in [clarifying-inputs §3](../../research/identify/nate/clarifying-inputs.md)). The alternative is to let the image match choose the variant. It cannot separate colourways under phone lighting, or capacities that look the same.

**When it is not shown**: the model is not confirmed, or |V| > 1 after the question cap. The card then shows the model only, with "Variant not settled".

**How it is explained**: "The 256 GB one, from the box label." Tap shows the label and the variant list it was picked from.

**Speed**: the variant lists are fetched with the candidate at identify time (eBay `getProduct`, cached per product).

**Check later**: on 200 multi-variant items, measure variant precision when confirmed. It is wrong if it is below 98% (start).

## 7. Size

**Determines**: the size printed on the tag or set by the product, in the market's size system.

**Sources and weights**

| source | what it contributes | weight or rank | why that weight |
|---|---|---|---|
| person | size | overrides | owner statement |
| size label read ([card 4](#4-text-and-codes-read-from-labels)) | size string and system (US, EU, UK, alpha) | rank 1 | printed on the object |
| confirmed variant ([card 6](#6-variant)) | size where size is a variant (shoes by GTIN) | rank 1 | identifier |
| measurements ([card 10](#10-each-measurement)) | a consistency flag only | never sets size | tag size and body measurements differ by brand (asserted) |

**Method**

1. Rank 1 value present: convert it to each site's size system with the brand's conversion table if one exists, otherwise a generic table. Store the conversion source.
2. If the measurements fall outside the brand size chart range for that size by more than their ± ([card 11](#11-uncertainty-of-each-measurement)), show "Runs small" or "Runs large". The size itself is not changed.
3. No rank 1 value: ask with `size_picker`.

**Why this method**: buyers filter on the tag size, and marketplaces index it as an aspect, so the tag is the fact to state (inferred, [listing-fields-by-platform](../../research/list/nate/listing-fields-by-platform.md)). The alternative is to infer size from measurements. That states a guess as the size and breaks the certainty principle.

**When it is not shown**: the tag is missing or unread and the person has not answered. The card shows "Size not on the tag" with the measurements, and the question.

**How it is explained**: "Size M, from the tag." Tap shows the tag crop and any conversion used.

**Speed**: size grammars and conversion tables are kept ready.

**Check later**: on 300 items, compare the stated size with the tag read by hand. It is wrong if it is below 99% when confirmed.

## 8. Colour

**Determines**: the colour name a site's filter uses, and the maker's colourway name where one exists.

**Sources and weights**

| source | what it contributes | weight or rank | why that weight |
|---|---|---|---|
| person | colour | overrides | owner statement |
| confirmed variant's colourway | the maker's name | rank 1 for the name | identifier-backed |
| measured colour: CIELAB of mask pixels in the true-colour frame, white balance from a grey or white reference if one is in the frame | facet colour | rank 1 for the facet when a reference is present; rank 2 without | measurement; a reference removes the light colour |
| vision model colour word | facet colour | rank 3 | words for colour vary between models |

**Method**

1. Arithmetic: take the mask pixels of the sharpest true-colour front frame ([card 21](#21-which-frames-become-listing-photos-and-in-what-order)).
2. Run k-means with k = 3 in CIELAB, fixed seed. Keep the clusters with at least 20% share (start).
3. Map each kept cluster to the nearest named colour in the site's colour list by CIEDE2000.
4. Confirmed if a reference was present, or the measured facet agrees with the maker's colourway's facet.
5. If the nearest and second-nearest names are within ΔE00 of 5 (start), it goes to a chip question.

**Why this method**: CIEDE2000 is the CIE standard perceptual difference, and it is already the studio colour gate ([studio](../features/studio.md)). Using it in both places keeps "the colour shown" and "the colour stated" on one scale (inferred). The alternative is a model's colour word. It is not reproducible across model versions, and it drifts with scene lighting.

**When it is not shown**: no reference and no colourway match, and two names within ΔE00 5. The person sees two colour chips with the swatch.

**How it is explained**: "Navy, measured from the photo." Tap shows the swatch next to the photo.

**Speed**: on demand at `judging`. Each site's named-colour table is kept ready.

**Check later**: compare against colour names picked by 3 people on 200 items. It is wrong if the stated name is outside all 3 people's picks on more than 1 in 10.

## 9. Which product it is, and when identity is confirmed

**Determines**: the candidate set of catalogue products, the brand and model of the item, the match label (exact, likely_same_model, same_family_other_variant, comparable, unresolved), and whether identity counts as confirmed.

**Sources and weights**

| source | what it contributes | weight or rank | why that weight |
|---|---|---|---|
| decoded GTIN or model plate → catalogue | one product | rung 1 | identifier |
| catalogue text match on label text (style code, model number) | products | rung 2 | printed identifier, but can be partial |
| kind specialist (CardOS, WatchID, Brickognize, Numista, Discogs and so on) | products with their own score | rung 2 inside its kind | trained on the kind's catalogue |
| image search (eBay `search_by_image`, Lens) and embedding retrieval (SigLIP 2 or Marqo in pgvector) | products | rung 3; capped at likely_same_model | resemblance, not identity; SigLIP 2 SOP R@1 80.28 ([identify](../features/identify.md)) |
| vision model with web search | products | rung 4 | a model's guess; may invent |
| cross-check: re-embed each candidate's images against the item, and compare its text with the label read | same or different | veto | an independent second view of the match |

**Method**

1. Model steps: the five routes run in parallel. Timeouts are Lens 4 s and eBay 3 s, with an overall cap of 15 s.
2. Arithmetic: merge candidates by catalogue ID. Score `c = max over routes (r_route * s_route)`, with rung factors r = 1.0, 0.8, 0.5, 0.3 (start).
3. Conformal set (start): `C = {products with c >= q}`, with q calibrated on held-out labelled items so that the right product is in C 90% of the time (Merlin top-3 bar).
4. Label: exact needs rung 1 or 2 plus a cross-check of same. Rung 3 at most likely_same_model. A different variant of the same family gets same_family_other_variant.
5. Confirmed without a tap only if exact. Confirmed with a tap when the person picks a card.
6. |C| = 1 and not exact: one card, "Is it this?". |C| from 2 to 4: pick. |C| = 0 or more than 4: [card 17](#17-which-question-to-ask-next-and-when-to-stop) or "None of these".

**Why this method**: conformal sets beat fixed top-k sets at equal coverage in a pre-registered trial, and singleton sets gave the highest accuracy (observed (excerpt), Cresswell 2024, [clarifying-inputs §2](../../research/identify/nate/clarifying-inputs.md)). The rung cap follows the [identify](../features/identify.md) evidence ladder: an identifier is identity, a resemblance is not. The alternative is always showing a top-3. That asks needlessly when one answer is certain, and needless questions cut task success from 65% to 27% in arXiv 2504.16331 (observed (excerpt)).

**When it is not shown**: |C| = 0 after all routes, or every route timed out. The person sees "Not sure what this is yet", with the kind-level fields and one question.

**How it is explained**: "This is a Patagonia Better Sweater, from the label." Tap opens the evidence: the code or label crop, the matched catalogue photos side by side, and the routes that agreed.

**Speed**: embeddings of catalogue images are kept ready in pgvector. Routes run during capture, so the result is ready at `judged`. Plan target p50 9 s.

**Check later**: on 500 labelled items, measure coverage of C (bar 90%) and the precision of untapped Confirmed (bar 99%). It is wrong if untapped Confirmed falls below 99%.

## 10. Each measurement

**Determines**: each measurement of the item, per class: pit to pit and length for tops, waist and inseam for pants, and the class-specific ones for shoes, bags, rigid items, furniture and small items. It also determines which scale path it came from, and whether it is confirmed.

**Sources and weights**

| source | what it contributes | weight or rank | why that weight |
|---|---|---|---|
| card or marker of known size in the plane | scale | path 1 | 4.10 to 4.20% error (Kowaleczko 2022 in [garment-measurement-accuracy](../../research/measure/nate/garment-measurement-accuracy.md)) |
| LiDAR depth plus keypoints | metric points | path 1 for items 20 cm to 2 m on matte surfaces | 1.59 to 2.08% (Kim 2022, same note) |
| published length of the confirmed product ([card 9](#9-which-product-it-is-and-when-identity-is-confirmed)) | scale from one known span | path 2 | maker's spec, but sizes vary by production run (inferred) |
| ARKit plane | scale | path 3 | no published accuracy figure |
| monocular depth (UniDepthV2, MoGe-2) | cross-check only | never sets a value | ARel 6.8% and Rel 15.7, too loose ([measure](../features/measure.md)) |
| person's tape | value | overrides | owner statement |
| weight | not measured | none | weight is never read from photos |

**Method**

1. Model step: the point positions come from a geometric pass on the mask (rules per class, as in Paulauskaite-Taraseviciene 2022) plus a pointing model run 3 times. Each point is the median of the 3 runs.
2. Arithmetic: distance between the points in the metric plane for each available path.
3. The value is the reading of the best path present.
4. Confirmed when two paths agree within their combined tolerance ([card 11](#11-uncertainty-of-each-measurement)), or the person drags the points once and confirms.
5. Display rounds to 1/4 in or 0.5 cm.
6. Mirrors and glossy or dark surfaces: if the LiDAR `confidenceMap` is low on the endpoint pixels, LiDAR is dropped for that measurement.

**Why this method**: the two-path agreement rule turns two error-prone readings into one that can be stated, without claiming a probability. Landmark AP on DeepFashion2 is only 0.563, so a single model reading of the points is not enough (observed, [measure](../features/measure.md)). Apple states LiDAR confidence drops on reflective and absorbing surfaces, without numbers (observed, [open-facts row 3](../../research/capture/nate/open-facts-seeing-the-item.md)). The alternative is a single monocular-depth estimate. It is two to seven times looser than the budget of 1.3 cm on primary measurements.

**When it is not shown**: no scale path is available, or the paths disagree beyond their combined tolerance with no confirmation. The person sees "Measure with a card in the photo" or the drag-to-fix screen. A value is never shown without a scale.

**How it is explained**: "Pit to pit 21 in, measured with the card." Tap shows the photo with the two points and the line between them.

**Speed**: LiDAR and phone points are computed live. The pointing runs happen in the cloud at `judging`. The class rule tables are kept ready.

**Check later**: compare against tape on 200 items per class. Bar: the tape value is inside the shown tolerance at least 90% of the time. It is wrong if it falls below that.

## 11. Uncertainty of each measurement

**Determines**: the tolerance shown with each measurement, for example "within about 1 cm".

**Sources and weights**

| source | what it contributes | weight or rank | why that weight |
|---|---|---|---|
| our calibration rows: absolute error against tape, per path and class | empirical error | rank 1 once a path has 30 rows or more | measured on our own captures |
| published error per path ([card 10](#10-each-measurement) table) | prior error | rank 2, used only as a budget check | other datasets and devices |
| budget | ±1.3 cm primary, ±2 cm secondary; rigid items ±1 cm or 3% | cap | the measure spec's tolerance |

**Method**

1. Arithmetic: `e_path` = the 90th percentile of |error| over the calibration rows for that path and class.
2. One path: tolerance = `e_path`.
3. Two agreeing paths: tolerance = `sqrt(e_a^2 + e_b^2) / sqrt(2)` as a starting rule (*agent proposal*: it is the root of the mean of the two squared errors, which assumes the paths err independently and equally; no source gives it, so the calibration rows replace it once a pair of paths has 30 rows). Rounded up to the display step.
4. If the tolerance is above the budget, the value is shown as an estimate only, and the drag-to-fix screen is offered.

**Why this method**: a quantile of measured error is distribution-free and states exactly what the bar tests: the tape lands inside 90% of the time (inferred). The alternative is to quote the paper figures. They come from other cameras, fabrics and people, so they would not cover our captures.

**When it is not shown**: fewer than 30 calibration rows for that path and class, as the measure spec requires. The value is still stated when confirmed by agreement or the person. The tolerance line is replaced by "Measured, not yet checked against a tape".

**How it is explained**: "Within about 1 cm of a tape." Tap shows how many items were checked against a tape for this kind of measurement.

**Speed**: the percentiles are kept ready per path and class, and refreshed nightly.

**Check later**: hold out 100 new tape checks per class. It is wrong if fewer than 90% fall inside the stated tolerance.

## 12. Each flaw

**Determines**: each flaw: whether it is present, its type from the kind's flaw list, where it is (zone and image region), and its severity (minor, moderate or major).

**Sources and weights**

| source | what it contributes | weight or rank | why that weight |
|---|---|---|---|
| person | confirms or adds a flaw; may remove one only through the locked `identity_claim` | overrides | the seller is answerable for the disclosure ([trust-returns-disputes](../../research/sold/nate/trust-returns-disputes.md)) |
| vision model on close-ups and talk-mode pointing | candidate flaws with regions and type | proposer | finds candidates; is not trusted to clear the item |
| scale from [card 10](#10-each-measurement) | flaw size in cm | arithmetic | size is part of severity |
| zone map per kind (for example collar, front centre, toe box, corners, handles) | zone weight | arithmetic | buyers look at some zones first (asserted) |
| visible-from-a-distance test: is the flaw visible in the full-item frame at listing resolution | flag | caps condition at fair | rule in [identify](../features/identify.md) |

**Method**

1. Model step: propose candidates `{type, region, zone}` on every accepted frame. Merge proposals across frames whose regions overlap after pose alignment (IoU at least 0.3, start).
2. Arithmetic: severity points `P = z * s`.
   - z = 1, 2 or 3 by zone.
   - s = 1 for a flaw under 0.5 cm, 2 for 0.5 to 2 cm, 3 for over 2 cm, or for any hole, tear or stain.
   - Minor if P <= 2, moderate if P is 3 or 4, major if P >= 6 (start).
3. Every candidate becomes a `confirm_flaw` decision. It stays on the item unless the person says no, and "no" on a flaw is logged as a label.
4. Flaw photos are never edited ([card 22](#22-whether-a-touched-up-photo-is-faithful-to-its-original)).

**Why this method**: the model is used for recall and the person for the final say, because a missed flaw costs a return while an extra candidate costs one tap (inferred, from [trust-returns-disputes](../../research/sold/nate/trust-returns-disputes.md)). A zone-by-size grid is how graders' published scales describe wear: "slightly worn corners" against "tears at corners" (observed, Fashionphile in [identity-schema-by-kind](../../research/item-card/nate/identity-schema-by-kind.md)). The alternative is a learned severity regressor. It needs graded data we do not have, and it would not explain itself.

**When it is not shown**: a candidate whose region is under 16 px on the longest side at full resolution (start) is dropped as noise. A flaw the person declined is not listed, and its no is kept. The decision lock on removal stays.

**How it is explained**: "Small mark on the left cuff." Tap shows the close-up with the region outlined, and the full-item frame.

**Speed**: proposals run during capture on close-up frames. The merge runs at `judging`.

**Check later**: run 20 seeded flaws per test item set. The bar is 18 of 20 found. Have a grader assign severity to 200 flaws. It is wrong if fewer than 18 of 20 are found, or severity is more than one step off on over 1 in 10.

## 13. Condition on each axis

**Determines**: the condition grade on each of the kind's own axes: for example exterior, interior, corners and hardware for bags; sleeve and vinyl for records; book and jacket for books. Hidden aspects are marked "Not checked".

**Sources and weights**

| source | what it contributes | weight or rank | why that weight |
|---|---|---|---|
| confirmed flaws ([card 12](#12-each-flaw)) on that axis | deductions | arithmetic | visible condition is the flaws seen |
| tags seen attached in a frame | allows the "new with tags" top grade | gate | a claim of new needs the tag in view |
| person | worn or unworn, times used, original packaging sealed | sets the starting grade | owner knowledge that a photo cannot see |
| per-kind measured readings (battery health from a Settings screenshot, shutter count from EXIF where exposed) | axis value | rank 1 on that axis | read, not judged (observed: battery health is read from Settings, Swappa in [identity-schema-by-kind](../../research/item-card/nate/identity-schema-by-kind.md)) |

**Method**

1. Arithmetic, per axis, on an internal 0 to 10 scale.
2. Start = 10 if new with tags seen; 9 if the person said unworn; else 8.
3. Subtract: minor 1, moderate 2, major 4 per flaw (start).
4. Floor: one flaw visible from a distance caps the axis at 5, which maps to fair.
5. Axes with no frame covering them stay `null` with reason `not_visible`.

**Why this method**: storing condition on neutral axes and deriving each site's grade later keeps one truth and many views of it, as [item card](../features/item-card.md) already decides (observed). Additive deductions with floors are how published grading rules read: Goldmine and Fashionphile both define grades by the worst defects present (asserted, from the scale texts in [identity-schema-by-kind](../../research/item-card/nate/identity-schema-by-kind.md)). The alternative is to ask a model for an overall grade. That cannot be audited, and Mercari's experience suggests it would be overconfident (inferred).

**When it is not shown**: the person has not confirmed the flaw list. The axes then show "Waiting on your check of the marks". Hidden aspects always show "Not checked".

**How it is explained**: "Outside: very good, two small marks." Tap shows the marks on that axis.

**Speed**: arithmetic on confirm; nothing to keep ready beyond the axis tables.

**Check later**: compare against a professional grader on 200 items. It is wrong if more than 1 in 10 axes is more than one grade off.

## 14. Condition on each market's own scale

**Determines**: the condition value each site gets on its own scale: eBay's condition IDs and NWT/NWOT, Poshmark, Depop, Mercari, Facebook Marketplace, and for specialist kinds the Fashionphile seven, Goldmine, KEH, Swappa, TCGplayer, BrickLink.

**Sources and weights**

| source | what it contributes | weight or rank | why that weight |
|---|---|---|---|
| axis grades ([card 13](#13-condition-on-each-axis)) and flaws | inputs | all | the one stored truth |
| each site's grade definitions, encoded as predicates (for example "no visible wear", "tags attached", "minor signs of use") | the mapping | rule table | the site's own words decide its grade ([listing-fields-by-platform](../../research/list/nate/listing-fields-by-platform.md)) |
| site-specific facts (box present for shoes, battery health for phones) | predicate inputs | rule table | some scales grade completeness or a reading |

**Method**

1. Arithmetic: for each site, walk its grades from best to worst.
2. Pick the first grade whose every predicate holds for every axis and flaw.
3. A predicate on a `null` axis fails, so a hidden aspect never earns a top grade.
4. Vinyl and books keep two grades (sleeve and vinyl; book and jacket) where the site has two fields.

**Why this method**: a site's grade is a promise in that site's words. Choosing the best grade whose stated definition is fully met is the most honest mapping and is fully reproducible (inferred). The alternative is a learned mapping from past listings. It would copy sellers' grade inflation into ours.

**When it is not shown**: the site's definitions are not yet encoded (Poshmark, Depop and Mercari photo and grade pages were not reached: [open-facts rows 8 and 9](../../research/capture/nate/open-facts-seeing-the-item.md)), or the axes are not confirmed. The person picks the grade from the site's own list, with our axes shown beside it.

**How it is explained**: "eBay: Pre-owned, Excellent." Tap shows the site's definition and which mark kept it from the grade above.

**Speed**: the rule tables per site are kept ready. Mapping is instant.

**Check later**: compare against a grader on 200 items per site. Bar: within one grade on 90%. It is wrong below that, or if returns citing "not as described" are higher than the site average (data from [sold](../features/sold.md)).

## 15. Completeness

**Determines**: which of the kind's parts are present: box, papers, dust bag, charger, cables, manuals, strap, lens cap, all set pieces. Each part is present, absent or not checked.

**Sources and weights**

| source | what it contributes | weight or rank | why that weight |
|---|---|---|---|
| per-kind part list ([identity-schema-by-kind](../../research/item-card/nate/identity-schema-by-kind.md)) and the confirmed product's "in the box" list | the checklist | defines the set | what a complete one includes |
| part seen in an accepted frame (model detection, then the person confirms the group with `approve_groups`) | present | rank 1 | observed |
| person | present or absent | rank 1 | owner knowledge |
| set inventory for LEGO (BrickLink part list against the count seen) | present per piece group | rank 1 when counted; otherwise "not checked" | piece counts cannot be read from a pile (inferred) |

**Method**

1. Checklist = the kind list joined with the product list.
2. A part is present if seen and confirmed, or the person says so. It is absent if the person says so. Otherwise it is not checked.
3. "Complete" is stated only if every listed part is present.
4. Papers and serial cards: present means present. Whether the papers match the item is not checked ([card 19](#19-what-cannot-be-known-from-a-capture-and-what-is-said-instead)).

**Why this method**: completeness changes price for watches, bags and cameras, and only a seen or stated part is a fact (observed: "Comes With" sections at Fashionphile, and box and papers as a value field for watches, [identity-schema-by-kind](../../research/item-card/nate/identity-schema-by-kind.md)). The alternative is to infer absence from absence in the photos. That turns "not photographed" into "missing".

**When it is not shown**: no part list for the kind. Only what was seen is listed, and the line "Anything else included?" is shown.

**How it is explained**: "Box and dust bag included." Tap shows the frames with each part.

**Speed**: part lists are kept ready per kind and fetched per product with the candidate.

**Check later**: audit 100 items with a known inventory. It is wrong if any part is marked present that was not there, or if more than 1 in 10 parts present was left as not checked after the person answered.

## 16. Material

**Determines**: what the item is made of: composition percentages for textiles, and leather, metal, wood or plastic for hard goods.

**Sources and weights**

| source | what it contributes | weight or rank | why that weight |
|---|---|---|---|
| person | material | overrides | owner statement |
| care or composition label read ([card 4](#4-text-and-codes-read-from-labels)) | fibres and percentages | rank 1 | printed on the object |
| confirmed product spec | material | rank 2 | maker's data |
| vision model guess | material | rank 3; never confirms | look-alike materials (faux leather, plated metal) are a selling point of fakes (inferred) |

**Method**: take the first rank present. A percentage list must sum to 100 ± 1 (arithmetic), or it is `conflict`. Rank 3 alone becomes the default chip in a question, not a stated value.

**Why this method**: Poshmark's own upgrade uses the care tag for material (observed (excerpt), [clarifying-inputs §1](../../research/identify/nate/clarifying-inputs.md)). Texture alone cannot tell leather from a coated textile reliably (inferred). The alternative is to state the model's guess. That is a claim the item may disprove on arrival.

**When it is not shown**: no rank 1 or rank 2 value. The person sees "Material not on a tag" with a chip question.

**How it is explained**: "80% wool, 20% nylon, from the care tag." Tap shows the tag crop.

**Speed**: the composition grammar is kept ready. Parsing is instant.

**Check later**: hand-check 200 tags. It is wrong if it is below 99% when confirmed.

## 17. Which question to ask next, and when to stop

**Determines**: the next question for the person (which field, which input, which options), and when no more questions are asked.

**Sources and weights**

| source | what it contributes | weight or rank | why that weight |
|---|---|---|---|
| candidate set ([card 9](#9-which-product-it-is-and-when-identity-is-confirmed)) and variant set ([card 6](#6-variant)) | the hypotheses | defines entropy | what is still open |
| eBay Catalog `ASPECT_REFINEMENTS` counts | how each aspect value splits the hypotheses | arithmetic input | counts give EIG with no model (inferred, [clarifying-inputs §3](../../research/identify/nate/clarifying-inputs.md)) |
| unmet asked rows ([card 3](#3-what-must-still-be-captured-and-when-it-is-enough)), weighted by `requirement_reorder` | non-identity questions (function, smell, worn count) | value of the field | fields that move price first |
| effort per input | tap 1, chip 1, photo 2, type 3 | tiebreak | lower effort first |

**Method**

1. Arithmetic, for identity aspects: `EIG(a) = H(C) - sum_v p(v) H(C | a = v)`, where `p(v)` is the share of the candidates' weight that has value v.
2. For non-identity rows: `value(row) = reorder_weight(row)`, normalised to the same 0 to 1 scale as `EIG / log2(|C|)`.
3. Ask the argmax. Ties go to the lowest effort.
4. Stop when any of these holds:
   - the set is a singleton and the variant is settled;
   - the best normalised score is under 0.15 (start; *agent proposal*: below it a question removes under 15% of the open choices, too little to earn a tap; tune on the 200-item check);
   - 3 questions have been asked for this item (start; *agent proposal*: no source exists for a per-item cap, and the cited studies show that unneeded questions cut success, so the cap stays small until the 200-item check sets it);
   - the person refused, which ends that field without a re-ask.
5. Model step: an LLM writes the question's words only, from the chosen field and options. It cannot add or drop options.

**Why this method**: EIG-chosen questions beat zero-shot LLM questions in arXiv 2502.04485, and unneeded questions cut success from 65% to 27% in arXiv 2504.16331 (both observed (excerpt), [clarifying-inputs §3 and §4](../../research/identify/nate/clarifying-inputs.md)). So the choice of whether and what to ask is arithmetic and capped. The alternative is to let a model decide when to ask. Models both over-ask and under-ask in the cited studies.

**When it is not shown**: nothing passes the stop rule. No question appears, and the open fields show their unknown reason.

**How it is explained**: the question itself, for example "Which colour is the sole?" with photo chips. Tap on "Why" shows "This is the one thing that tells these two apart", with the two candidates.

**Speed**: refinement counts come back with the candidate search. EIG over at most a few dozen candidates is instant.

**Check later**: compare questions per item and confirmed accuracy, this rule against a model-chosen question, on 200 items. It is wrong if the model-chosen arm reaches the same accuracy with fewer questions.

## 18. Whether a fact may be stated as confirmed

**Determines**: for every fact the item card or a listing states, whether it may be stated as confirmed. Otherwise the statement is held for the person, or reworded as not settled.

**Sources and weights**

| source | what it contributes | weight or rank | why that weight |
|---|---|---|---|
| the attribute row: `source`, `confirmed`, evidence | the basis | gate | each card above sets `confirmed` |
| `claim_check` on generated text: each factual span matched to an attribute | pass, hold or abstain | gate | the text may say more than the rows |
| locked kinds (counterfeit, function, removing a flaw) | always `identity_claim` | block | not settled from a capture |

**Method**

1. Model step: split the generated listing text into factual spans, then map each span to the attribute it asserts.
2. Arithmetic:
   - pass if the attribute exists, is `confirmed`, and the span's value equals the stored value after normalisation;
   - hold if the attribute is unconfirmed or missing;
   - abstain if the span is not a factual claim (style words).
3. A hold becomes decision `unbacked_claim`, with options: remove, change to "you said", or reword as "Not checked".

**Why this method**: the certainty principle needs one gate that every stated fact passes, otherwise fluent text reintroduces guesses (inferred). The span-to-row match makes the gate checkable and repeatable. The alternative is to rely on the generator's prompt to "only state known facts". Mercari's built-in hallucination detection shows that is not enough (observed (excerpt), [clarifying-inputs §1](../../research/identify/nate/clarifying-inputs.md)).

**When it is not shown**: a held span is not published until the person resolves it.

**How it is explained**: "This line says 'never worn', but that is not something we saw." Tap shows the row, or the lack of one.

**Speed**: runs once per draft and again on each edit. The attribute rows are local.

**Check later**: seed 100 drafts with planted unbacked claims. It is wrong if more than 1 in 100 planted claims passes, or more than 1 in 20 true spans is held.

## 19. What cannot be known from a capture, and what is said instead

**Determines**: for each kind, which facts are not settled by a capture, and the exact wording used in their place.

**Sources and weights**

| source | what it contributes | weight or rank | why that weight |
|---|---|---|---|
| per-kind "cannot be known" lists ([identity-schema-by-kind](../../research/item-card/nate/identity-schema-by-kind.md)) | the set | defines | researched per kind |
| person's answers | "you said" values for function, smell, smoke, pets | stated as theirs | owner statement, labelled as such |
| readings the person provides (battery health screenshot, test video) | a measured value with evidence | rank 1 for that field | a reading, not a judgment |

| fact | what is said |
|---|---|
| authenticity | never "authentic". A date code or serial is "read from the item" only; it does not prove authenticity (observed, Fashionphile in [identity-schema-by-kind](../../research/item-card/nate/identity-schema-by-kind.md)). "Counterfeit" and "genuine" go to the locked `identity_claim`. |
| function (powers on, all keys work, shutter fires) | "You said it works" or "Not tested" |
| hidden condition (inside seams, internal parts, under the sole insert) | "Not checked" |
| smell, smoke, pets | "You said: smoke-free home" or nothing |
| battery health | the read value with its screenshot, or "Not checked" |
| weight | never from photos; "You said" or a scale photo read by [card 4](#4-text-and-codes-read-from-labels) |
| fit on a body | measurements only ([card 10](#10-each-measurement)) |
| age or era with no code | "Not dated" unless a code or the person dates it |
| papers matching the item | "Papers included", never "matching papers" unless the serials are read on both and equal |

**Method**: arithmetic lookup by kind. Each listed fact is stored with `source = you_said` or as unknown with reason `not_asked`. The wording comes from the table, never from a model.

**Why this method**: a fixed wording table makes the limit of what the photos show visible and identical every time (inferred). Buyers' "not as described" claims turn on exactly these facts (asserted, [trust-returns-disputes](../../research/sold/nate/trust-returns-disputes.md)). The alternative is to let a model write a disclaimer each time. That produces varied, hedged text, which [copy](../../product/copy.md) rules out.

**When it is not shown**: never hidden. These lines always appear when the fact matters for the kind.

**How it is explained**: "Not tested." Tap shows "Photos can't show this. Add a video or say what you know."

**Speed**: the table is kept ready per kind.

**Check later**: review 100 listings. It is wrong if any listing states one of these facts as confirmed without a reading.

## 20. Recall or safety flag

**Determines**: whether the item matches a product recall or a sale ban, which blocks `post`, and whether it can be cleared at all.

**Sources and weights**

| source | what it contributes | weight or rank | why that weight |
|---|---|---|---|
| CPSC recall data matched on the confirmed brand plus model number or GTIN (the CPSC publishes a recalls web service; asserted, endpoint not yet named in a note) | exact recall match | rank 1, blocks | selling a recalled product is illegal (observed, CPSC reseller guide in [identity-schema-by-kind](../../research/item-card/nate/identity-schema-by-kind.md)) |
| kind rules: drop-side cribs, cribs made before June 2011, children's products over lead limits, non-compliant painted furniture | ban by rule | rank 1, blocks | the guide says these must be destroyed or cannot be sold (observed, same) |
| date code or model plate read ([card 4](#4-text-and-codes-read-from-labels)) | manufacture date and model number | input | the recall scope is per model and date range |
| brand plus product name fuzzy match | possible recall | hold | names are reused across models |
| person | "recall repair done" with proof | lifts a hold only where the recall names a remedy | the recall notice defines the remedy |

**Method**

1. Arithmetic: normalise the model number. An exact match on brand plus model number (or GTIN), with the manufacture date inside the recall's range, blocks.
2. A name-only match holds, with the recall notice shown.
3. Kinds in the safety set (baby gear, children's products, small electricals, heaters, batteries and chargers, bikes, helmets, e-bikes) with no confirmed model number cannot be cleared. A model-plate photo is required ([card 3](#3-what-must-still-be-captured-and-when-it-is-enough) raises it to the top priority).
4. Any block stops `post` on every site.

**Why this method**: the law makes the seller responsible for not selling recalled products. A false clear is unlawful, while a false hold costs one photo, so the rule is asymmetric on purpose (observed for the law, inferred for the asymmetry). The alternative is a model reading the recall list. Identifier matching is exact and auditable; the model would add nothing but error.

**When it is not shown**: never hidden for safety-set kinds. Outside the safety set, the check runs silently and shows only on a match. "Not recalled" is never stated. The statement is "No recall found for model <number> on <date>".

**How it is explained**: "This model was recalled, so it can't be listed." Tap shows the recall notice, the matched model number and the photo it was read from.

**Speed**: the recall table is mirrored into Lakebase and refreshed daily. Matching is an indexed lookup.

**Check later**: replay 200 known recalled models with photos of their plates. It is wrong if any one passes. Measure false holds on 500 non-recalled items in the safety set.

## 21. Which frames become listing photos, and in what order

**Determines**: which captured frames are proposed as listing photos, and their order. The [list](../features/list.md) feature owns the final order per site.

**Sources and weights**

| source | what it contributes | weight or rank | why that weight |
|---|---|---|---|
| accepted frames ([card 2](#2-whether-a-frame-is-a-usable-view)), grouped by pose bin | the pool | defines | only usable views |
| per-bin pick: sharpness rank 0.5, exposure 0.2, coverage 0.2, photo score from [photo-score](../../research/studio/ben/photo-score.md) 0.1 (start) | best frame per bin | weighted sum of ranks | sharpness is the failure buyers see first (inferred) |
| studio renders that passed [card 22](#22-whether-a-touched-up-photo-is-faithful-to-its-original) | extra angles on rigid items only | after the real front | renders are never the only view |
| site rules: eBay 1 to 24 own images; Etsy requires an unedited real photo | caps and musts | constraint | observed, [studio](../features/studio.md) |
| photo count over photo quality | fill to the cap with distinct views | ordering principle | odds ratios for quality were only 1.17 to 1.25 ([quality-and-value-classifiers §3](../../research/price/nate/quality-and-value-classifiers.md)) |

**Method**

1. Arithmetic: per pose bin, rank the frames by the weighted rank sum and keep the top one.
2. Drop near-duplicates: embedding cosine above 0.95 (start).
3. Order:
   1. the real true-colour front;
   2. approved renders;
   3. the other real angles;
   4. labels and tags;
   5. completeness parts;
   6. flaw close-ups, never edited.
4. Truncate to each site's cap, always keeping every major-flaw photo ([card 12](#12-each-flaw)).

**Why this method**: buyers decide on the first photo, and a real first photo keeps the listing's first claim backed by the item (inferred). Flaw photos kept inside the cap protect the seller in disputes ([trust-returns-disputes](../../research/sold/nate/trust-returns-disputes.md)). The alternative is to rank all photos by an aesthetic score. That pushes flaw shots off the end, and photo count matters more than quality.

**When it is not shown**: no accepted front frame. A retake prompt for the front replaces the photo row.

**How it is explained**: "8 photos, front first, marks last." Tap shows the order with drag to change.

**Speed**: per-bin picks update as frames are accepted, so the set is ready at `judged`.

**Check later**: A/B the order on live listings through [list](../features/list.md). It is wrong if a render-first or aesthetic-first order wins on sale rate with no rise in returns.

## 22. Whether a touched-up photo is faithful to its original

**Determines**: whether an edited photo (background swap, relight, render) still shows the same item truthfully, which decides whether it may be used.

**Sources and weights**

| source | what it contributes | weight or rank | why that weight |
|---|---|---|---|
| item pixels inside the mask, original against edited after paste-back | byte equality | blocks | cut-out plus paste-back keeps item pixels byte for byte ([studio](../features/studio.md)) |
| OCR of tag and label regions, original against edited | text equality | blocks | changed text is a changed fact |
| protected boxes (logos, flaws) | unchanged | blocks | flaw photos are never touched; creases never relaxed |
| CIEDE2000 mean ΔE00 inside the mask (relit renders only) | colour drift | ranks; at most 2.0 (start) | about the threshold where people start to notice a difference (asserted) |
| structure (SSIM on the mask edge band), halo width, background cleanliness | edge quality | ranks | visible artefacts |
| `render_same_item` (embedding similarity of render against the original) | identity drift | ranks; at least 0.90 (start) | a render must not drift into a sibling product |

**Method**

1. Arithmetic: run the 3 blocking gates. Any failure means not faithful, and the edit is discarded.
2. Edits that pass are ranked by the sum of the normalised ranking gates.
3. Model steps: BiRefNet makes the mask, with SAM 3 for edge failures where it is served, and the embedding for `render_same_item`. Everything after is arithmetic.

**Why this method**: byte equality inside the mask turns "is it faithful" into a check that cannot be argued with for paste-back edits. The ranking gates are needed only for generated renders (inferred, [editing-alternatives](../../research/studio/nate/editing-alternatives.md)). The alternative is a judge model rating faithfulness. It cannot prove that no pixel of the item moved.

**When it is not shown**: any block failure, or a render below the `render_same_item` floor. The real masked frame is used instead.

**How it is explained**: "Background cleaned. The item is untouched." Tap shows a before and after slider.

**Speed**: gates run right after each edit. The OCR of the originals is reused from [card 4](#4-text-and-codes-read-from-labels).

**Check later**: test 100 edits with planted changes (a recoloured patch, altered tag text, a removed stain). It is wrong if any planted change passes the blocking gates.

## Summary of all determinations

| # | name | owning feature | main sources | method in five words | hide rule |
|---|---|---|---|---|---|
| 1 | [Item kind](#1-item-kind) | capture | code category, cloud judge, phone | weighted vote with margin rule | margin under 0.20: ask |
| 2 | [Usable view](#2-whether-a-frame-is-a-usable-view) | capture | sharpness, exposure, coverage, model | cheap gates then two passes | any gate fails: retake |
| 3 | [Still to capture, enough](#3-what-must-still-be-captured-and-when-it-is-enough) | capture | requirement rows, reorder weights | highest-value unmet row next | early Done: "Not captured" |
| 4 | [Label text and codes](#4-text-and-codes-read-from-labels) | identify | barcode, two OCR engines, regex | two readers must agree | disagree twice: question |
| 5 | [Brand](#5-brand) | item card | code, label, candidate, logo | identifier or text confirms brand | logo only: ask |
| 6 | [Variant](#6-variant) | identify | code, style code, seen aspect | filter variant set by facts | more than 1 left: question |
| 7 | [Size](#7-size) | item card | size tag, variant, person | tag read, then convert | no tag: ask |
| 8 | [Colour](#8-colour) | item card | colourway, CIELAB measure, reference | k-means, nearest name, CIEDE2000 | names within 5: chips |
| 9 | [Product and confirmation](#9-which-product-it-is-and-when-identity-is-confirmed) | identify | code, catalogue, specialists, image search | ladder plus conformal set, cross-check | empty set: question |
| 10 | [Each measurement](#10-each-measurement) | measure | card, LiDAR, spec length, plane | two paths agree or drag | no scale: no value |
| 11 | [Measurement uncertainty](#11-uncertainty-of-each-measurement) | measure | our tape checks | 90th percentile of error | under 30 checks: tolerance hidden |
| 12 | [Each flaw](#12-each-flaw) | item card | vision proposals, scale, zones | propose, grade, person confirms | under 16 px: dropped |
| 13 | [Condition per axis](#13-condition-on-each-axis) | item card | confirmed flaws, tags, person | start grade minus deductions | flaws unconfirmed: waiting |
| 14 | [Condition per market](#14-condition-on-each-markets-own-scale) | item card | axes, site definitions | best grade fully met | definitions missing: person picks |
| 15 | [Completeness](#15-completeness) | item card | part lists, seen parts, person | seen or said, else unchecked | no list: "anything else?" |
| 16 | [Material](#16-material) | item card | care tag, spec, person | first ranked source present | no tag: ask |
| 17 | [Next question, stop](#17-which-question-to-ask-next-and-when-to-stop) | identify | candidate set, aspect counts | information gain, capped at three | below 0.15: no question |
| 18 | [Confirmed-statement gate](#18-whether-a-fact-may-be-stated-as-confirmed) | item card | attribute rows, claim check | every span maps to row | held until resolved |
| 19 | [Cannot be known](#19-what-cannot-be-known-from-a-capture-and-what-is-said-instead) | item card | per-kind lists, person | fixed wording table per kind | never hidden |
| 20 | [Recall or safety](#20-recall-or-safety-flag) | item card | CPSC data, kind rules, plate | exact model match blocks post | safety kinds: never hidden |
| 21 | [Listing frames, order](#21-which-frames-become-listing-photos-and-in-what-order) | studio | accepted frames, site rules | best per bin, real first | no front: retake |
| 22 | [Touch-up faithful](#22-whether-a-touched-up-photo-is-faithful-to-its-original) | studio | mask pixels, OCR, protected boxes | byte equality then ranked gates | any block: use real |

## What cannot be determined credibly

| determination | why | what is done instead |
|---|---|---|
| authenticity | a capture records stamps and codes. It cannot check them against a maker's records, and fakes copy what is visible (observed, [identity-schema-by-kind](../../research/item-card/nate/identity-schema-by-kind.md)) | locked `identity_claim`; never "authentic" |
| function | photos do not run the item | "You said it works" or "Not tested" |
| hidden condition, smell, smoke | not visible | "Not checked" or "you said" |
| weight | no photo cue measures mass | person or a scale reading |
| material from the image alone | coated textiles and faux leather look like the real material (inferred) | label, spec or person ([card 16](#16-material)) |
| measurement tolerance on the ARKit-plane-only path | no published accuracy, and no calibration rows yet | value shown only when confirmed; tolerance hidden ([card 11](#11-uncertainty-of-each-measurement)) |
| LiDAR accuracy on dark, glossy or furry surfaces | Apple gives no numbers ([open-facts row 3](../../research/capture/nate/open-facts-seeing-the-item.md)) | LiDAR dropped when `confidenceMap` is low |
| OCR reliability as a number | no label or serial-plate benchmark found ([open-facts row 12](../../research/capture/nate/open-facts-seeing-the-item.md)) | two-engine agreement gate ([card 4](#4-text-and-codes-read-from-labels)) |
| Poshmark, Depop and Mercari condition and photo rules | pages not reached ([open-facts rows 8 and 9](../../research/capture/nate/open-facts-seeing-the-item.md)) | the person picks the site grade ([card 14](#14-condition-on-each-markets-own-scale)) |
| the per-item question cap of 3 | no source for a per-session budget ([clarifying-inputs, Not found](../../research/identify/nate/clarifying-inputs.md)) | starting value, refit on answer logs |

## What this area needs from other areas

| from | what | used by |
|---|---|---|
| [score](../features/score.md) and price | `requirement_reorder` weights: how often each field changed the value or the sale | [card 3](#3-what-must-still-be-captured-and-when-it-is-enough), [card 17](#17-which-question-to-ask-next-and-when-to-stop) |
| [list](../features/list.md) | each site's condition definitions as predicates, colour lists, size systems, photo caps and photo rules, especially for Poshmark, Depop, Mercari and Facebook | [card 8](#8-colour), [card 14](#14-condition-on-each-markets-own-scale), [card 21](#21-which-frames-become-listing-photos-and-in-what-order) |
| [data](../features/data.md) | the `thresholds` table with calibration splits; the nightly tape-error percentiles; a daily mirror of the CPSC recall data with the named source and endpoint | cards 1, 2, 9, 11, 20 |
| [sold](../features/sold.md) | return reasons and "not as described" claims linked back to the field and flaw they cite, as labels | cards 12, 13, 14, 18 |
| identify research | an OCR benchmark on labels and serial plates; eBay's own catalogue-match documentation; whether a GTIN is always per variant | cards 4, 6, 9 |
| [studio](../features/studio.md) | the photo-score values per frame, and a statement of which edits are paste-back and which are generated | cards 21, 22 |
