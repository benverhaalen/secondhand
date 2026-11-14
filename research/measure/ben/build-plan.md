# How do we actually build measuring for the demo: garments from one flat-lay shot, rigid items in 3D, with a human approving every number?
Researched 2026-11-14 by Ben (Claude Code). Feature: measure.

Builds on [measuring-garments.md](measuring-garments.md) and [object-capture.md](object-capture.md). Where this note changes their conclusions, it says so under "What changed from the earlier notes". Everything here is an *agent proposal* until Ben or Nate decides.

## 1. The question and Ben's goal

Ben: "for clothes measuring the mechanism is measuring more than anything"; "anything with lidar or apple measuring apps"; Apple Object Capture; "the user has to do no thinking at all"; "judges love human in the loop"; "dynamic and intelligent ui ... where you have a huge range of set components" ([words](../../../product/words.md#2026-11-14-tools-and-capture)).

So the job is: from the shots the capture step already takes, produce every measurement a reseller lists, each with a source and a confidence, show them as lines on the photo, let the person fix any line with a drag, and record "looks right" as the approval. For rigid items, produce L × W × H (and a 3D model when it works). The thinking.md type is **Seeing the item**: how wrong is it, how often, and does the user see when it's unsure.

Measurement splits into two independent problems, and every product below solves them separately [inferred, confirmed by every reference inspected]:
- **Scale**: millimetres per pixel on the garment's plane.
- **Points**: where the armpit, shoulder seam, hem, crotch and cuff are.

## 2. Seeded research log

Method: RDD loop with seeded, adaptive investigation (`it-already-exists/skills/reference-driven-development/references/research-improvement.md`). Each loop picks seeds by a quality cue, inspects each, and rewrites the frontier.

### Loop 1. Seed cue: inspectable code that measures garments end to end

| Seed | Cue | What inspection showed | What it changed |
|---|---|---|---|
| FitTag, github.com/Mohib314159/FitTag (MIT, last commit 2026-10-10) | Full code, a validation harness, and its own published failures | Cloned and read `core/measure.py`, `core/calibrate.py`, `BUTTON_FREE.md`, `CV_EVIDENCE.md`, `docs/data/sweep.json` [observed]. Landmarks come from the mask's row-by-row width profile: armpit = first row below the sleeve span where width drops to about body width; pit-to-pit = width just below it; crotch = first row where the silhouette splits into two legs and stays split; "No model emits a number" [observed, `core/measure.py` docstring]. Synthetic sweep: 4-marker mat gives max error 0.3 to 0.8 cm up to 30° tilt; **bank card only gives max errors of 27 cm (8° tilt) and 35 cm (22° tilt)**; one A4 sheet is erratic (62 cm at 5°, 1.3 cm at 12°, not found at 20°); dark or mid-grey floors under dark jeans give 6 to 7 cm inseam errors [observed, my summary of `docs/data/sweep.json`]. Unanchored monocular metric depth (Depth Anything V2 Small indoor): median landmark error 48% with assumed intrinsics, 17.7% with known intrinsics; one known garment length cut it to 2.3% median [observed, `BUTTON_FREE.md`]. Two real-garment photos with an A5 reference agreed within 0.1 to 2.7 cm [observed, `docs/data/real.json`; repeatability, not accuracy]. | The mask-profile geometry is a working, MIT-licensed starting point we can port. **Card-only scale is weaker than the earlier note assumed.** Inspecting the card cases, the large errors are mostly the garment-finding and framing step (hip and thigh stayed within 1.4 to 4.5 cm while waist and leg opening failed), so the card corner-to-scale step is not the only cause [observed numbers, inferred cause]. Either way, a card alone is not enough evidence to show a number without a human check. |
| dimsum, github.com/stephenbeale/dimsum (no licence file, last commit 2026-11-10) | Live product, single readable file, a VLM placing measurement lines | Read `index.html` [observed]. Six garment templates (coat, shirt, knit, trousers, skirt, dress), each measurement with default endpoints as image fractions and a one-line "how" (for example pit to pit: "Straight across the chest, armpit seam to armpit seam"). "Auto place" sends one photo to `claude-opus-5-5` with a JSON schema and asks for both endpoints per measurement as [x, y] fractions, plus the longest edge of a card, A4, Letter or 30 cm ruler if one is visible. Then: "Check each dot before you save." Typed tape values always win. | Confirms the human-approval pattern (VLM proposes, person drags, typed value wins) and gives us a measurement vocabulary per category. **No licence, so we take the idea and the vocabulary, not the code.** |
| GarmentIQ, github.com/lygitdata/garmentiq (MIT, last commit 2026-09-11; ETH Zurich preprint May 2025) | Paper plus pip package plus measured errors | Read the README, `garment_classes.py`, an instruction JSON and the paper [observed]. Pipeline: tinyViT classifier (95.76% on 9 classes), BiRefNet mask, HRNet trained on DeepFashion2 for predefined landmarks, then custom landmarks by casting rays to the mask edge. Now supports SAM 1/2/3 with text prompts. **No physical scale at all**: errors are reported as ratios, under about 0.06 for tops but up to 0.821 for skirt hip/waist, on 10 hand-annotated images per class [observed, paper]. | A trained-landmark challenger that needs no training from us. Kept as a second opinion, not the primary (it needs a GPU-ish Python service and its weakest classes are the ones where a VLM reasons better about "hip"). |

**Frontier after loop 1**
- Changed: points can be geometric from the mask (FitTag) plus a model for the semantic points (dimsum, GarmentIQ); scale is the weak link.
- New lead: a scale source that does not rely on a tiny reference object at the edge of the frame.
- Next action: read Apple's primary docs for ARKit depth, planes and high-res frames; check LiDAR accuracy in a paper.
- Bound: primary docs and one peer-reviewed accuracy study.
- Counter-lead: monocular metric depth (no hardware, works on the web). FitTag's evidence is against it; check a 2026 benchmark before discarding.

### Loop 2. Seed cue: primary platform docs and model READMEs

| Seed | Cue | What inspection showed | What it changed |
|---|---|---|---|
| Apple `ARDepthData` | Primary doc | `depthMap` is distance from the camera plane **in metres**; `confidenceMap` filters low-accuracy pixels; exposed via `ARWorldTrackingConfiguration` with the `.sceneDepth` frame semantic [observed, developer.apple.com/documentation/arkit/ardepthdata]. | Units settled. |
| Apple `ARSession.captureHighResolutionFrame` | Primary doc | iOS 16+. Returns an `ARFrame` with a "high quality, high resolution `capturedImage`", and "ARKit populates the frame's properties other than pixel data, including pose information, anchors" [observed]. | We can get a full-resolution photo **and** the camera pose, intrinsics and detected planes in one shot. That makes the floor plane the scale source on every ARKit iPhone, LiDAR or not [inferred]. |
| Luetzenburg et al., Sci. Reports 2021, iPhone 12 Pro LiDAR | Peer-reviewed, measured | "absolute accuracy of ± 1 cm" for objects above 10 cm side length; precision falls below 10 cm; range up to 5 m [observed, PMC8593014]. | For a garment plane at about 1 m, ±1 cm in distance is about ±1% in scale, about 7 mm on a 70 cm length, and a plane fit over thousands of depth pixels averages much of it out [inferred]. LiDAR is a refinement over the ARKit plane, not a requirement. |
| Size AI capture guide | Product's own instructions | LiDAR about 5 mm typical, non-LiDAR about 9 mm, longer measurements worse, no test setup given; shoot from 0.9 to 1.4 m, straight down, two level circles that merge with a haptic tap, distance readout green/orange [observed, sizeai.co/guides/capture]. | Gives our capture gate (distance and level) and a claimed target to beat. |
| SAM 3 / 3.1 README | Primary repo | SAM 3.1 released 2026-03-27; 848M params; text-prompt API `processor.set_text_prompt(state, prompt=...)` returns masks, boxes, scores; needs CUDA 12.6+, PyTorch 2.7+; `facebook/sam3` and `facebook/sam3.1` on Hugging Face, gated; SAM License [observed]. GarmentIQ already wraps it [observed]. | Server-side mask with a text prompt ("t-shirt") is ready to use. Needs a GPU host. |
| Apple `VNGenerateForegroundInstanceMaskRequest` | Primary doc | iOS 17+, returns instance masks of foreground objects [observed]. | On-device mask for free on the native path. |
| Gemini robotics-ER spatial docs, Gemini image docs | Primary doc | Pointing returns `[{"point": [y, x], "label": ...}]` normalised to 0 to 1000, with model `gemini-robotics-er-2-preview`; no accuracy claims [observed]. General image docs use `gemini-3.8-flash` for boxes and segmentation polygons, also 0 to 1000 [observed]. | A VLM that natively points exists via API. |
| MolmoPoint (Ai2, 2026-03-18) | Open weights, benchmarked | MolmoPoint-8B: 70.7% PointBench, 89.2 F1 PixMo-Points; open; no comparison against Gemini, GPT or Claude [observed, allenai.org/blog/molmopoint]. | An open pointing model exists, but it would need hosting; not worth it for a 24 h demo when cost doesn't matter [inferred]. |

**Frontier after loop 2**
- Changed: native scale = **ARKit floor plane + camera intrinsics** (works on any ARKit iPhone), with LiDAR depth as a check and refinement. The earlier note had LiDAR first and the card second.
- New lead: Object Capture's real behaviour on current phones; whether monocular depth is now good enough for the web path.
- Next action: look for failure traces (forums) and an independent 2026 depth benchmark.
- Bound: Apple forums, one benchmark, the SAM 3D paper.
- Counter-lead: skip 3D entirely and do rigid items from one LiDAR frame.

### Loop 3. Seed cue: failure traces, independent benchmarks, practitioner phrasing

| Seed | Cue | What inspection showed | What it changed |
|---|---|---|---|
| Apple forum thread 828928 | Concrete failure trace | Object Capture fails on iPhone 17 Pro / Pro Max under iOS 26.4.2 and 26.5 (`sensorFailed` at scan start or auto-capture never fires; offline reconstruction ends with `cv3dapi 4004` "No SfM map found"); the same code and images work on an iPhone 12 Pro. Reply only says file a Feedback report [observed]. | **Demo risk if the demo phone is a 17 Pro.** Test Object Capture on the actual demo phone in the first hour; keep a fallback. |
| Apple forum thread 840946 (DTS answer, Aug 2026) | Apple engineer answer | Depth in samples is "for recovering metric scale"; no public API to feed a point cloud in; camera transforms can't be set on constructed samples; **on iOS only `reduced` detail** [observed]. | Object Capture output is metric when captured with depth. Units still not stated in docs; we verify on a known box. |
| WWDC23 10191 notes | Session notes | On-device reconstruction "may take a few minutes"; iOS 17+, LiDAR, A14+ [observed, wwdcnotes]. | Budget 2 to 5 minutes per item in the demo; run it while the person does something else [inferred]. |
| SAM 3D paper (arXiv 2511.16624) | Primary paper | Predicts shape, rotation, translation and scale "in normalized camera coordinates"; an optional pointmap (for example from iPhone LiDAR) can condition it; no metric claim [observed]. | Single-image-to-3D gives shape, not size. TRELLIS and Hunyuan3D likewise output normalised meshes [asserted, from memory]. Not a measuring tool. |
| "Which Depth Estimator for Jetson AGX Orin? A 2026 Benchmark" (arXiv 2610.27199, 2026-10-19) | Independent, current, raw vs oracle-scaled numbers | Raw metric AbsRel on Middlebury indoor: Depth Pro 12.0%, Depth Anything 3 Metric-Large 12.3%, MoGe-2-L 19.2%, UniDepth V2-L 20.5%, Depth Anything V2 metric 30 to 33%. With per-image oracle scale: 3.8 to 9% [observed]. | **Monocular metric depth is 12% off at best**, which is 8 cm on a 70 cm length. It never produces a listed number alone. It can still check the card (a 10% disagreement flags a bad card). |
| Vendoo measurement templates; eBay size guidance | How sellers phrase it | Templates say "Approximate Measurements:", "Pit to Pit Approx.", "Shoulder to Hem Approx.", "Across Shoulders", "Arm Length from Armpit", waist/inseam/rise/hips for pants, L/W/H plus "Drop" and "Strap Length" for bags, boots: heel height, shaft height, shaft circumference, opening [observed]. eBay recommends inseam for jeans and pants; bust, waist and length for dresses; waist, inseam, chest or length for pre-owned and vintage, in the description or optional item specifics [observed, pages.ebay.com/listing-sizes]. | Output wording and the per-category measurement set (section 4, step 6). |

**Frontier after loop 3 (where research stops)**
- Changed: Object Capture becomes the stretch path for rigid items, with a one-frame LiDAR box as the reliable path; monocular depth is a cross-check only; single-image-to-3D is out for measuring.
- Open, next probe if time: (a) run GarmentIQ's HRNet on 10 of our own photos to see if it beats the VLM on shoulder points; (b) time Object Capture on the demo phone; (c) check whether iPhone Safari exposes WebXR `immersive-ar` in iOS 26 (found only 2022 evidence that it was experimental and for external devices, roadtovr.com; a June 2026 article mentions only visionOS).
- Retained, not used: MolmoPoint (open pointing, needs hosting), ArUco 4-marker mat (most accurate in FitTag's sweep, but asks the person to print something), RoomPlan (furniture only), GarmentIQ matting module.

## 3. What exists, and what we take

| Reference | Job | What we take | What we change | Evidence |
|---|---|---|---|---|
| FitTag `core/measure.py` | Implementation mechanism | Width-profile landmarks for tops and bottoms; tolerance per measurement (1.0 cm primary, 1.5 cm secondary); refusing to show centimetres when scale fails ("proportions only") | Add a VLM for shoulder seam, sleeve top and crotch; add dresses, skirts, outerwear; scale from ARKit plane | observed, MIT |
| FitTag sweep and button-free study | Evidence | Card-only and monocular scale are weak; contrast with the floor matters | Our test set is real garments with tape truth, not synthetic | observed |
| dimsum | Interaction, vocabulary | Templates with default endpoints and a "how" line; VLM places endpoints; "check each dot"; typed value wins; export of photos with lines drawn | Our UI is a fixed component set filled by the backend; no code copied (no licence) | observed |
| GarmentIQ | Mechanism (challenger) | DeepFashion2 HRNet landmarks plus ray-to-mask derivation; SAM 3 text-prompt wrapper | Second opinion only; we add metric scale | observed, MIT |
| Size AI | Interaction, target | Level circles that merge with a haptic, distance readout, 0.9 to 1.4 m; "about 5 mm" as the bar | We show confidence per measurement; they don't publish test setups | observed claims |
| Apple ARKit (`captureHighResolutionFrame`, planes, `sceneDepth`) | Mechanism | Metric plane, intrinsics and full-res photo in one frame | n/a | observed docs |
| Apple Vision foreground mask | Mechanism | On-device garment mask, also used live for "whole item in frame" | n/a | observed doc |
| SAM 3.1 | Mechanism | Server mask from a text prompt; agreement with the on-device mask is a confidence signal | Needs GPU hosting | observed README |
| Gemini robotics-ER 2 pointing | Mechanism | Named points as [y, x] in 0 to 1000 | Snap each point to the mask edge; run 3 times, spread = uncertainty | observed docs; accuracy unmeasured |
| OpenAI Decisions API (Ben's pick for image decisions) | Mechanism, checker | Predicates on the overlay image: "both endpoints sit on the armpit seams" | It does not output points, so it judges lines instead of placing them | see [openai-decisions-api.md](../../identify/ben/openai-decisions-api.md) |
| Apple Object Capture | Mechanism (stretch) | Guided walk-around, metric `.bounds`, USDZ, and the captured frames as real reference angles for Seedream | Gate on the demo phone first | observed docs and forum |
| Depth Pro / Depth Anything 3 / MoGe-2 | Evidence, cross-check | Disagreement check for card scale on the web path | Never a listed number alone | observed benchmark |
| Vendoo templates, eBay size guidance | Weak preference, phrasing | "Approx." wording and per-category sets | Add ± and the source | observed |

## 4. The build plan

The pipeline runs as one Job (`kind: measure`) per Item, triggered when the capture step saves the measurement shot. Backend is a Python service (FastAPI on Databricks Apps, per the cross-cutting stack); each step writes an MLflow trace span so the "why?" panel can show it.

### Step 0. Capture gate (owned by capture; measure's requirements)
Sent to the capture agent on 2026-11-14 and summarised here.
- One flat-lay shot per garment, top-down from 0.9 to 1.4 m, garment filling at least 60% of the frame, plain contrasting background (white sheet preferred; FitTag lost 6 to 7 cm on dark floors under dark jeans [observed]).
- Native: `ARWorldTrackingConfiguration` with `planeDetection = .horizontal`, plus `.sceneDepth` when `supportsFrameSemantics(.sceneDepth)`; shutter enabled only once a horizontal plane under the garment is tracked and pitch/roll are within 8°; capture with `captureHighResolutionFrame` and save image, `camera.intrinsics`, `camera.transform`, the plane anchor's transform, and `sceneDepth.depthMap` + `confidenceMap`.
- Web: card (ID-1, 85.60 × 53.98 mm) beside the garment at its vertical middle, on the long side, 5 to 10 cm from the edge, not on a fold; pitch/roll within 3° from `DeviceOrientationEvent`; full-resolution JPEG with EXIF.
- No second shot needed for measuring.

### Step 1. Scale (mm per pixel on the garment plane)

| Path | Stack | How | Confidence signal |
|---|---|---|---|
| **A. Native, any ARKit iPhone (primary)** | Swift, ARKit (iOS 16+) | For each image point, unproject through the intrinsics (scaled to the high-res image size) and intersect the ray with the floor plane: this gives metric 3D points directly and corrects tilt with no homography guesswork. Plane offset by garment thickness is negligible (a few mm) [inferred]. | Plane tracked and stable for 1 s; if LiDAR, fit a plane to `sceneDepth` points with high confidence around the garment and compare to the ARKit plane distance: disagreement over 2% lowers confidence. |
| **B. Card in frame (web primary, native cross-check)** | Backend: OpenCV 4.10 `findContours` + `approxPolyDP` on the card region, with the VLM giving a rough card box first (dimsum pattern) | Four card corners give a homography to millimetres; reject if the fitted aspect differs from 1.586 by more than 3% or the card is under 150 px long. Use scale only near the garment's centre line. | Aspect error, card size in pixels, tilt reported by the phone. A Depth Pro estimate that disagrees by more than 15% flags the card as possibly misdetected. |
| **C. One known length (fallback)** | UI only | The person types one tape measurement (or the tagged inseam for jeans), and every other line rescales. FitTag's simulations show this cuts error from 17.7% to 2.3% median [observed, synthetic]. | Shown as "from your measurement". |
| **D. Nothing** | n/a | Show proportions only and ask for C. Never a centimetre number from monocular depth alone. | n/a |

Native also runs path B when a card is visible; agreement between A and B within 2% gives "high" scale confidence.

### Step 2. Garment mask
- Native: `VNGenerateForegroundInstanceMaskRequest` (iOS 17+) on device, sent up with the photo.
- Backend: SAM 3.1 (`facebook/sam3.1`, text prompt from identify's category, for example "jeans") on a GPU host. Options, cheapest to set up first: a Databricks GPU model-serving endpoint, or a hosted SAM 3 endpoint (fal or Replicate offer SAM models [asserted, not checked today]). Fallback: BiRefNet (as GarmentIQ uses) or a plain threshold against the white sheet.
- Confidence: IoU between the two masks. Below 0.9 → mask uncertain, show the outline for the person to confirm.
- Edge cases: garment touches the frame edge → retake; two garments → largest component plus ask; card or hand overlapping the garment → subtract the card's quad.

### Step 3. Points
1. **Geometric pass** (port of FitTag's width profile, MIT): length, pit-to-pit, hem, waist, hip, inseam, thigh, leg opening, from the mask alone.
2. **VLM pass** for semantic points that the silhouette can't see: shoulder seams, sleeve top, collar-seam centre back, crotch seam, front rise top. Model: `gemini-robotics-er-2-preview` pointing, prompt lists named points with a one-line "how" per point (dimsum's vocabulary), output `[y, x]` 0 to 1000. Run 3 times; the spread is the uncertainty. Snap each point to the nearest mask-edge pixel where the point is defined on the edge (armpits, cuffs, hem corners).
3. **Agreement**: where both passes produce the same measurement (pit-to-pit, length, inseam), disagreement over 1.5 cm lowers confidence and highlights the line.
4. **Challenger, only if loop-3 probe (a) says so**: GarmentIQ HRNet landmarks as a third vote.

Fails on: inside-out or folded sleeves, hoods, dresses with no clear waist, wrap skirts. These come back as "low" and the person places the points.

### Step 4. Checker (Decisions API)
Draw each proposed line on the photo, then ask the OpenAI Decisions API one predicate per line, for example `pit_to_pit_endpoints_on_armpit_seams`, `length_starts_at_collar_seam`, plus `garment_lies_flat` and `card_flat_and_unoccluded`. Probability under 0.7 marks that line for review. This uses Ben's chosen tool for what it does well (judging an image), and keeps the worker from grading itself (cross-cutting principle "the worker never decides it is done").

### Step 5. Human approval (the moment judges see)
The backend returns a **MeasureSheet** spec filled from a fixed component library (server-driven UI; the app never generates layout):

| Component | Shows | Why it's there |
|---|---|---|
| `MeasureOverlay` | The real photo, each measurement as a line with two round handles; low-confidence lines in the attention color, the rest neutral | Fixing a line is a drag, the same pattern as Polycam, Size AI and dimsum |
| `Loupe` | A magnified circle above the finger while dragging | The finger covers the point otherwise (FitTag and dimsum both have one) |
| `MeasureRow` | Name, value in the person's unit, "± 0.5 in", and a source chip: *measured*, *estimated*, *you said* | thinking.md's per-field source |
| `ScaleBadge` | "Scale: floor (LiDAR)" / "card" / "your measurement" / "none" | The one thing that makes every number wrong at once |
| `FitsLikeChip` | "Fits like M (Uniqlo chart)" | Section 7, decision 3 |
| `RetakeCard` | Shown instead of numbers when scale or mask failed | Never a confident wrong number |
| `LooksRightButton` | One primary action | The approval record |

Behaviour: dragging a handle recomputes that value live on device (scale and plane are already known; on native, the ray-plane math is local). Lines the checker flagged are visited first, one at a time, like a review queue; untouched high-confidence lines need no action. Tapping "Looks right" writes a Decision record with every endpoint before and after, so each drag is a label for calibrating thresholds later (Databricks loop). Native: SwiftUI `Canvas` + `DragGesture`. Web: an SVG overlay with pointer events (no library needed; react-konva only if the team already uses it).

### Step 6. Output text and fields
Per category, the set resellers list (from Vendoo templates, eBay guidance, dimsum and Size AI):

| Category | Measurements |
|---|---|
| T-shirt, shirt, knitwear | pit to pit, length (collar seam at back to hem), shoulders, sleeve (shoulder seam to cuff), hem |
| Coat, jacket, blazer | the above plus sleeve from armpit, waist |
| Jeans, trousers, shorts | waist (flat, doubled in text), inseam, front rise, hip, thigh, leg opening, outseam |
| Skirt | waist, hip, length, hem |
| Dress, jumpsuit | pit to pit, waist, hip, length (shoulder to hem); jumpsuit adds inseam and rise |
| Shoes | outsole length and width from the box or LiDAR (insole length can't be seen from outside; the tag size is the source) |
| Bags | L × W × H, plus drop and strap length via the two-tap tool |
| Rigid items | L × W × H, for listing text and shipping box |

Text: "Approx. measurements, laid flat: Pit to pit 20 in · Length 28 in · Sleeve 8 in" (Vendoo's "Approx." wording). The ± stays in the app and the buyer-facing filter; the listing gets rounded values to the nearest ¼ in (or 0.5 cm).

### Step 7. Rigid items

| Path | Stack | Output | Gate |
|---|---|---|---|
| **One-frame box (primary)** | ARKit LiDAR `sceneDepth` + Vision foreground mask on one high-res frame | Masked depth points above the floor plane → oriented bounding box (PCA on the floor-plane projection for L and W, max height above the plane for H) | LiDAR phone; item smaller than about 1 m |
| **Object Capture (stretch)** | Apple's "Scanning objects using Object Capture" sample, `ObjectCaptureSession` → on-device `PhotogrammetrySession` with `.modelFile(detail: .reduced)` and `.bounds` | USDZ, metric bounds, and the captured frames | Works on the demo phone (forum bug on 17 Pro, iOS 26.x); 2 to 5 min reconstruction |
| **Two-tap (fallback)** | ARKit raycast to the plane or to `sceneDepth`, Apple Measure style | Any single length (bag drop, strap, heel height) | Always available on native |
| **RoomPlan** | `CapturedRoom.Object.dimensions` | Furniture only | Out of demo scope |

**Feeding Seedream**: use the real frames Object Capture already took (or the shot list's angles) as reference images, not a generated 3D model. They are real photos of the item from known angles, which is what the fidelity gate in [seedream-relighting.md](../../studio/ben/seedream-relighting.md) compares against. A USDZ can also render clean turntable angles, but those are textures baked from the same photos, so they add nothing the frames don't have [inferred]. Single-image-to-3D (TRELLIS, Hunyuan3D, SAM 3D Objects) is not used: no metric scale [observed for SAM 3D, asserted for the others], and invented geometry would mislead a buyer.

### Step 8. Platform, from measure's side
- **Lost on web**: ARKit plane scale, LiDAR, the on-device mask, Object Capture, the one-frame box and two-tap. Web keeps card scale, the VLM points, the checker and the whole approval UI. iPhone Safari WebXR `immersive-ar` was not confirmed for iOS 26 [limit].
- **24 h recommendation (agent proposal)**: a hybrid. One small SwiftUI app with two screens, "Measure garment" (ARKit flat-lay capture) and "Measure object" (one-frame box, Object Capture if time), which uploads the frame plus the ARKit metadata to the backend and then opens the rest of the product (the web app) in a `WKWebView` or hands off to it. Everything after the shutter, including the approval overlay, is web, so it is built once. Estimated cost: about 4 to 6 hours for one Swift-capable person for the garment screen, plus 2 to 3 for the box, plus 1 to test Object Capture on the demo phone [inferred]. If nobody ships Swift, the web path still demos end to end with a card; it just loses the "LiDAR" moment.

## 5. Data contract

Written by the measure Job. Every value carries `source` and `confidence`.

| Primitive | Field | Type | Source values | Confidence |
|---|---|---|---|---|
| Item | `measurements[]` | `{key, value_mm, display, plus_minus_mm, source, confidence, endpoints_px: [[x,y],[x,y]], photo_id, method}` | `measured` (plane, LiDAR, card), `estimated` (proportions + one known length, monocular check), `you_said` (typed or dragged) | `high` / `medium` / `low` from the rules below |
| Item | `scale` | `{method: "arkit_plane" \| "lidar_plane" \| "card" \| "known_length" \| "none", mm_per_px, cross_check_pct}` | measured | high if two methods agree within 2% |
| Item | `dimensions` (rigid) | `{l_mm, w_mm, h_mm, method: "lidar_box" \| "object_capture" \| "two_tap", model_usdz?}` | measured | from method and point count |
| Item | `fits_like` | `{size, chart_source, chart_url}` | estimated | medium at best |
| Item | `measure_approval` | `{decision_id, approved_at, edits: n}` | you_said | n/a |
| Photo | `measure_meta` | `{intrinsics, camera_transform, plane_transform, depth_ref, card_quad, tilt_deg, distance_m}` | measured | n/a |
| Photo | `mask_ref`, `mask_iou` | file ref, float | measured | IoU itself |
| Job | `kind: measure`, `state`, `steps[]` | per step: name, duration, model id and version, MLflow trace id | system | n/a |
| Decision | `kind: measure_review` | lines flagged, before/after endpoints, checker probabilities | system then you_said | n/a |

Confidence rule (agent proposal, to calibrate on the labelled set): `high` = scale high **and** geometric/VLM agree within 1 cm **and** checker ≥ 0.85; `low` = any of: scale from one method only with a warning, VLM spread over 2 cm, checker under 0.7, mask IoU under 0.9; otherwise `medium`. `plus_minus_mm` starts as FitTag's tolerances (10 mm primary, 15 mm secondary) multiplied by 1.0 / 1.5 / 2.5 for high / medium / low, then is replaced by the measured error from section 6.

## 6. How to prove it works before the demo

**Error budget.** A listing needs each primary measurement (pit to pit, length, waist, inseam) within ±1.3 cm (½ in) and each secondary one (shoulder, sleeve, rise, thigh, leg opening) within ±2 cm. Reasoning: sellers round to ½ in, two people with a tape differ by about that much, and adjacent sizes differ by roughly 2.5 cm of flat chest, so a ±1.3 cm error keeps a "fits like" call on the right size [inferred]. Size AI's "about 5 mm" with LiDAR [asserted] is the stretch target.

**Labelled set, about 10 items, 90 minutes.**
- 7 garments: 2 tees, 1 button shirt, 1 knit, 2 jeans/trousers, 1 dress or jacket; mix light and dark. Plus 3 rigid: a shoebox, a bag, one electronic item.
- Truth: two people tape-measure each field independently, following the "how" line for each; truth = mean; record their disagreement (the floor for any claim).
- Captures: each garment twice on the native path (one LiDAR phone, one non-LiDAR if available), once on the web path with a card. Rigid items: one-frame box and Object Capture.
- Log a CSV row per item × capture × field: truth, auto value, final value after drags, source, confidence, edits, seconds to "looks right".

**Report per field**: median and max absolute error before edits, share within budget before and after edits, how many drags, refusal rate (shown "retake" or "proportions only"), and whether `low` confidence actually marks the worst errors (the calibration check). Pass for the demo: ≥80% of primary fields within budget before edits on the native path, 100% after edits, and no `high` field outside budget. Rigid items: L, W, H within ±1 cm or 3%, whichever is larger.

Put the CSV and the script that computes the table in the repo when the app exists (proposed `data/measure-eval/`; not created by this note).

## 7. Decisions for Ben

1. **Platform for measuring** (direction, costs build time)
   - A. Web only, card for scale. Cheapest; no LiDAR or Object Capture moment.
   - B. **Hybrid: a small native SwiftUI capture app for measuring, the rest web** (recommended). Gets the ARKit/LiDAR moment and keeps one approval UI.
   - C. Full native app. Best capture, but every other screen is built in Swift.
   - Recommendation: B, if someone on the team can write Swift for about 6 hours; otherwise A.
2. **Does the person need a card or a sheet?** (taste: how much the person must do)
   - A. Native: nothing extra; web: a card. (recommended)
   - B. Always ask for a card, even on native, for a visible cross-check.
   - C. A printed 4-marker mat (most accurate in FitTag's tests) for power sellers.
3. **"Fits like" scope** (scope)
   - A. Measurements only, no size claim.
   - B. **"Fits like M" against the item's own brand chart for the demo items only** (recommended): about 10 hand-picked charts in a JSON file, shown as *estimated*.
   - C. General size mapping across brands, which is a research project of its own.
4. **Object Capture in the demo** (scope)
   - A. **Show it only if it works on the demo phone in the first hour; otherwise the one-frame box** (recommended).
   - B. Make it a centrepiece (a 3D model on the listing).
   - C. Leave rigid items out.

Technical choices made here (not for Ben): SAM 3.1 + Vision mask, Gemini robotics-ER pointing with a Decisions API checker, FitTag-style geometry, ARKit plane scale, the confidence rule, and the component set.

## 8. What changed from the earlier notes
- [measuring-garments.md](measuring-garments.md) put LiDAR first and the card second and said the card is "good enough for pit-to-pit and length". Changed: **ARKit plane first (no LiDAR needed), LiDAR as a check, card for the web path only, and never trusted without a cross-check or a human look**, because of FitTag's card results. It said no public end-to-end garment pipeline existed: FitTag (Oct 2026) and GarmentIQ (2025, SAM 3 support Sep 2026) do.
- [object-capture.md](object-capture.md) left reconstruction time and units open: about a few minutes on device [observed, WWDC23 notes], `reduced` detail only on iOS [observed, Apple DTS], metric when captured with depth [observed, DTS], units still to test. New: a reported failure on iPhone 17 Pro under iOS 26.x, so Object Capture moves to stretch with a LiDAR one-frame box as the reliable path. Single-image 3D models were checked: no metric scale.

## 9. Limits
- Searched: GitHub (garment measurement, flat lay, reference object), arXiv, Apple developer docs and forums, Gemini and SAM docs, Ai2 blog, an Oct 2026 depth benchmark, Size AI's guide, Vendoo and eBay seller guidance. Cloned and read FitTag, dimsum and GarmentIQ.
- Not reached or not done: TapeAR, Tailored and SmartSizer were not re-checked beyond the earlier note; no app was run on a phone; no VLM pointing accuracy was measured (no published garment-point benchmark found); hosted SAM 3 endpoints and Databricks GPU serving availability were not checked; WebXR on iOS 26 Safari not confirmed; Object Capture `.bounds` units not confirmed in docs; brand size chart sources not researched; FitTag's numbers are synthetic, not real garments; DeepFashion2 RTMPose/ViTPose fine-tunes not inspected (GarmentIQ's HRNet stands in for that class).
- A narrow search does not prove nothing better exists, in particular for closed apps that publish no method.
