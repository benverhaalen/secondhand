# How do we actually build guided, dual-purpose capture for the demo?
Researched 2026-11-14 by Ben (Claude Code). Feature: capture.

Builds on [guided-shot-list.md](guided-shot-list.md) (the shot-list idea), [measuring-garments.md](../../measure/ben/measuring-garments.md), [object-capture.md](../../measure/ben/object-capture.md), [openai-decisions-api.md](../../identify/ben/openai-decisions-api.md) and [seedream-relighting.md](../../studio/ben/seedream-relighting.md). Where this note changes their conclusions it says so in **Changes to earlier notes**.

## 1. The question and Ben's goal

Goal, in Ben's words: "the app says take a big picture take a back picture take a tag picture take close up of this take pictures of defects etc. and its all super intuitive and the user has to do no thinking at all" ([words](../../../product/words.md#2026-11-14-tools-and-capture)). The shot list is dual-purpose: "not only be the shots to put on the listing but should be shots to inform the generative ai better about the product ... integrated into one thing" ([words](../../../product/words.md#2026-11-14-shots-serve-both)). Folder drop: "i could just drop a huge folder of photos too and it would do that too" ([words](../../../product/words.md#2026-11-14-function-map)). Today: "judges love human in the loop", "dynamic and intelligent ui ... where you have a huge range of set components", OpenAI Decisions API for image decisions, cost does not matter (brief, 20:41 UTC).

The question this note settles: for each step from "camera opens" to "the Item has a complete, checked set of photos", what exactly runs, where, with which library or model, what the person approves, and what happens when it goes wrong.

Problem type (per [.agents/thinking.md](../../../.agents/thinking.md)): **Seeing the item**. So every field below carries its source and a confidence, and the proof is a labelled set of real items with an error per field.

## 2. Seeded research log

Method: RDD with IAE (find what already does each piece) and looped seeded research (seeds chosen for a quality cue, inspected one at a time, frontier revised after each loop). Four loops; each changed a decision.

### Loop 1: who does "one instruction, auto capture" best, and what does the server judge return?

| Seed | Quality cue | What inspection showed | What it changed |
|---|---|---|---|
| OpenAI Decisions guide (developers.openai.com/api/docs/guides/decisions, and the `.md` version) | Primary docs | GA now. `POST /v1/decisions`, model `gpt-6-luna` only. Images as base64 data URLs **or public HTTPS URLs** (no `file_id`). Images may sit inside a question's `instructions`. 1 to 400 questions per request. **No regions or coordinates**. "For decisions that depend on an earlier answer, send separate requests." Use labelled examples for thresholds; add an `other` choice for review. *observed* | Resolves the earlier note's open conflict: URLs work, so we upload once and pass URLs. Chaining is explicit: shot 1 request, then a second request for the dependent shot list. Boxes must come from another model. |
| Firecrawl and DataCamp write-ups of Decisions latency | Practitioner numbers with dates | DevDay slide 150 ms (Sep 29, 2026); independent text benchmark median 268 ms (Oct 13, 2026); one playground predicate about 170 ms. **No published image latency.** DataCamp suggests `"detail": "high"` for images. *observed (secondary), asserted (their numbers)* | We cannot promise sub-second with images. Plan: measure p50/p95 with our own photos on day one; the UI never waits on it (it judges the previous shot while the next one is being framed). |
| Onfido design blog on glare detection | Failure trace across four design iterations | Post-shot pop-up, then red pulsing regions, then blue quadrants: users ignored or misread the visuals and followed the **text instruction** best. Testers wanted to be blocked only when glare covered **important details**. Glare photos fell from 2% to under 0.8%. *observed* | One short instruction beats overlays that paint the problem. Block only on checks that matter for that shot's role (tag legibility on a tag shot; not on a front shot). |
| Onfido engineering blog on live CV with OpenCV | Inspectable implementation | Frame sampled every 350 ms, YUV to BGRA, crop to ROI, C++ check returns a boolean, balloon animates in about 300 ms. *observed* | Throttle live checks to about 3 to 5 Hz on a downscaled ROI, not every frame. |
| Incode ID capture design guide | Primary vendor UX doc | Messages: "Move closer", "Avoid glare", "Show all corners"; checks in order framing, glare, blur, edges; auto-capture when met; manual shutter if auto-capture doesn't trigger in time. *observed* | Our gate order and the always-available manual shutter. |
| CCC First Look consumer guide (insurance, distant analogy) | Real shipped flow, PDF | Fixed overview list (4 corners), then "stand in front of the primary damage", then close-ups of the damaged area, optional 20 s video, optional extra photos. Outline only for the VIN scan. No retake step described. *observed* | Same structure as ours (fixed overview, then damage-driven close-ups). Contrary lead: a major insurer ships with **almost no gating**, so gating is not required for completion; it is our quality edge. |
| Solera Qapter guided capture sheet | Vendor sheet | "Vehicle mask" overlay generated from VIN or body shape; claims 3-minute process and 80% fewer physical inspections. *observed (claims asserted)* | Ghost outline per category is a known pattern; ours comes from the category choice. |

Frontier after loop 1:
- Changed: Decisions takes URLs; chaining is separate requests; boxes need another model; gates should be role-specific and say one thing.
- New lead: which model gives defect boxes; what runs on-device per frame.
- Next action: open Gemini detection docs, SAM 3, Apple Vision subject-lift latency. Bound: primary docs only.
- Contrary/neglected lead: insurers ship without gating; maybe gating annoys. Kept as a risk (cap retakes, manual shutter always on).
- Unresolved: Decisions image latency.

### Loop 2: on-device checks and region proposals

| Seed | Quality cue | What inspection showed | What it changed |
|---|---|---|---|
| Apple ML research "salient object segmentation" (the model behind subject lifting) | Primary paper-style post with numbers | Input resampled to 512x512, alpha matte 512x512, "typical execution time on an iPhone 14 is under 10 milliseconds". *observed* | `VNGenerateForegroundInstanceMaskRequest` (iOS 17+, *observed* availability) is fast enough for a throttled live check: subject count, subject bbox, fill ratio. |
| WWDC23 "Lift subjects" notes | Session notes | Class-agnostic; "resource intensive", run off the main thread; mask at input resolution for stills. *observed* | Run live at 512 px, full-res once on the kept still for the evidence cut-out. |
| Apple `DetectLensSmudgeRequest` | Primary docs | iOS 26+, A14+; returns smudge `confidence` 0 to 1; Apple's sample uses 0.9; note: motion blur can read as smudge, so run on a stable capture. *observed* | **Neglected lead adopted**: run once on the first kept still; if smudged, one prompt: "Wipe your lens". Cheap fix for the most common phone-photo failure. |
| Apple `isConstantColorSupported` (AVCapturePhotoOutput) | Primary docs | iOS 18+: estimates colors "under a standard light such as daylight (D65)" using flash; may take several seconds; poor in direct sun; gives a per-region `constantColorConfidenceMap`. *observed* | **Neglected lead, kept as a stretch**: a true-color tag/fabric shot for Seedream color fidelity. Not in the main path because it uses AVCapture, and measure needs ARKit on the same screen (loop 4). |
| Gemini image-understanding docs | Primary docs | Detection returns `box_2d` as `[ymin, xmin, ymax, xmax]` normalized to 0 to 1000; segmentation returns box, polygon mask and label; set thinking to minimal for segmentation; examples use `gemini-3.8-flash`. *observed* | Defect **proposals with boxes** come from Gemini 3.8 Flash with a JSON schema. |
| Roboflow SAM 3 docs | Primary hosted-API docs | Concept segmentation from text (up to 16 prompts) and visual segmentation from points or a box; endpoints `serverless.roboflow.com/sam3/concept_segment` and `/visual_segment`; 251 ms on one L4 self-hosted. *observed* | SAM 3 turns a Gemini box into a clean mask for the highlight overlay. Text-only "stain" concept search is **not** trusted as the proposer (defects are not well-bounded concepts; *inferred*, test it). |
| caniuse ImageCapture | Primary compatibility table | Safari iOS 27.1 to 27.2: not supported. *observed* | A PWA cannot take full-sensor stills from a live stream on iPhone; it gets video-resolution frames, or hands off to the system camera with no live checks. |
| MediaPipe tasks-vision README | Primary package doc | Image Segmenter, Interactive Segmenter, Object Detector exist for web; examples on images only. *observed* | Web fallback can do a subject mask, but no class-agnostic "lift the item" model; on a white sheet a luminance threshold is simpler (*inferred*). |
| VisionCamera V5 (Margelo blog, Apr 16, 2026; 5.2.1 released Jul 31, 2026) | Primary maintainer post | Rewritten on Nitro; frame processors on react-native-worklets with Reanimated SharedValues; `useDepthOutput` streams LiDAR/ToF depth; `capturePhoto()` returns in-memory photo. *observed* | Viable if we go Expo with an AVCapture-based camera. Superseded in loop 4 by ARKit for the main capture screen. |

Frontier after loop 2:
- Changed: native gives four checks for free (subject lift, rectangles, text, smudge); web cannot match. Boxes from Gemini, masks from SAM 3, calibrated yes/no from Decisions.
- New lead: one camera session for capture plus measure; and how the folder drop groups photos.
- Next action: ask measure-research what the measuring shot needs; inspect crosslister bulk-grouping tools. Bound: 3 products.
- Contrary/neglected lead: constant color (D65) as a better color truth than a white sheet; kept as stretch.
- Unresolved: whether ARKit and Vision on `ARFrame.capturedImage` run together smoothly at 5 Hz (believed yes, *inferred*; prototype first hour).

### Loop 3: folder drop and generative UI

| Seed | Quality cue | What inspection showed | What it changed |
|---|---|---|---|
| FlowLister FlowDrop page | Inspectable mechanism, honest limits | Orders photos by filename (capture order) and "groups consecutive shots of the same item"; grouping accuracy "unmeasured"; review is optional (move, split, drop a group); up to about 1 GB per drop. *observed* | **Temporal contiguity is the main signal**; visual similarity only decides boundaries. Review is a grid with move/split/merge. |
| Crosslist AI bulk create docs | Primary product doc | AI groups by "what it detects in each one"; review screen with Move, Remove, drag between listings, "Add listing", first image becomes cover. *observed* | The review actions set; cover = our `front` role. |
| List Perfectly Bundle Mode (Nov 2, 2026) | Primary product post | The **reseller** builds the groups; AI only writes listings; can add missed photos to a bundle later. *observed* | Contrary lead: the most-used crosslister still trusts humans to group. So grouping is always shown for one-tap confirmation, never silent. |
| Vercel json-render README | Inspectable code, primary | `defineCatalog` with zod props per component, declared `actions`, streaming SpecStream, renderers for React and **React Native**, not SwiftUI. *observed* | The "huge range of set components" maps to a json-render catalog; the agent emits a spec, our components render it. Picks Expo/React over pure SwiftUI for the approval screens. |
| A2UI spec v1.0 (updated Jun 8, 2026) | Primary spec | Catalog of components and functions; agent-to-renderer `createSurface`, `updateComponents`, `updateDataModel`; renderer-to-agent `action`. *observed* | Same model as json-render, protocol-level. We use json-render (fewer moving parts in 24 h) and keep A2UI message names as our event names so we could switch. |
| Depop "listing from one photo"; Mercari image listing beta; eBay magical listing visual ID (in the earlier note) | Shipped products | Depop fills description, category, colour, brand from one photo; seller uses, edits or removes. Mercari 2023 beta: worked from the front, generic from the back, misidentified a plush. *observed* | One-photo identification is table stakes and fails on weak angles. Our shot 1 must be the most informative angle (front, whole item), and identity uses all shots once captured. |

Frontier after loop 3:
- Changed: folder drop = time order plus similarity boundaries plus a confirm grid. Approval screens are json-render components chosen by the agent.
- New lead: measure's exact needs from the flat shot.
- Next action: incorporate measure-research's reply. Bound: one exchange.
- Contrary lead: List Perfectly leaves grouping to humans; ours proposes and asks.

### Loop 4: one camera session for capture and measure (from measure-research)

Measure-research replied with five changes to the measuring shot (FitTag synthetic sweep at github.com/Mohib314159/FitTag `docs/data/sweep.json`: card-only scale errors of 22 to 35 cm at 8 to 22 degrees of tilt versus about 0.5 cm with four corner markers; *asserted* by measure-research, not opened by me):
1. Card beside the garment at its vertical middle, on the long side, 5 to 10 cm from the edge, never near a corner.
2. Tilt gate at most 3 degrees on the card-only (web) path; at most 8 degrees on native, because the ARKit plane gives a full homography.
3. Distance 0.9 to 1.4 m (Size AI's guide), garment fills at least 60% of the frame, keep the full-resolution still (12 MP or more).
4. Native: `ARWorldTrackingConfiguration` with horizontal `planeDetection` (plus `.sceneDepth` on LiDAR) and `ARSession.captureHighResolutionFrame`; save intrinsics, camera transform, the floor `ARPlaneAnchor` transform, depth and confidence map. ARKit's plane gives metric scale even without LiDAR, so the card becomes a cross-check.
5. No second measuring shot. Contrasting plain background matters (dark jeans on a grey floor jumped to 6 to 7 cm error); prefer a white sheet.

What it changed: **the native capture screen is ARKit-based, not AVCapture/VisionCamera-based.** Vision requests run on `ARFrame.capturedImage`; stills come from `captureHighResolutionFrame`. One session serves every shot, so every photo carries pose and plane, which also helps Seedream and the "spin". Constant color (AVCapture) stays a stretch on a separate tag shot.

Final frontier (what remains open):
- Decisions latency with images: measure on day one.
- ARKit + Vision at 5 Hz on an older non-Pro iPhone: prototype in hour 1.
- Gemini 3.8 Flash defect recall on real garments (stains, pilling, holes): measure on the labelled set.
- Contrary lead kept: insurers ship with almost no gating; if testers find gating slow, relax to soft warnings except on the tag and measuring shots.

## 3. What exists

| Reference | Job | What we take | What we change | Evidence |
|---|---|---|---|---|
| Size AI capture guide | Interaction | Shutter gated on live checks: level, distance 0.9 to 1.4 m, light, contrast; haptic tap on alignment | Our gates are per shot role, and the measuring shot is one of six, not the whole flow | observed (earlier note), https://sizeai.co/guides/capture |
| Apple ObjectCaptureView feedback states | Interaction, mechanism | Ready/detecting/capturing states; feedback like `objectTooClose`, `movingTooFast`, `environmentTooDark`; capture dial | Used as-is for rigid items (walk-around mode); our flat flow copies its vocabulary | observed (object-capture.md) |
| Onfido / Incode ID capture | Interaction, failure evidence | One short instruction, ordered checks, auto-capture, manual fallback; block only on what matters | Item photos have no fixed template, so the "template" is the category's ghost outline | observed |
| CCC First Look, Solera Qapter | Structure (distant analogy) | Fixed overview shots, then damage-driven close-ups; silhouette mask from the identified model | Damage is proposed by the model and confirmed by the person, not found by the person | observed |
| Depop / Mercari / eBay one-photo listing | Evidence of table stakes and failure modes | Shot 1 = the most informative view | We identify from every shot, and we ask when unsure | observed |
| OpenAI Decisions API | Mechanism | Typed, thresholdable yes/no, choice, score per shot | Combined with a box model, since it has no regions | observed |
| Gemini 3.8 Flash detection | Mechanism | Defect boxes with labels, 0 to 1000 coords | Never trusted alone: each box is re-judged by Decisions and confirmed by the person | observed (docs); recall untested |
| SAM 3 (Roboflow hosted) | Mechanism | Box-prompted mask for a crisp highlight | Not used as the proposer | observed (docs) |
| Apple Vision: subject lift, rectangles, text, smudge | Mechanism | Live checks on device | Throttled to about 5 Hz at 512 px | observed (availability, latency); rectangles/text from memory, asserted |
| Apple constant color | Mechanism (stretch) | D65 color estimate with confidence map | Optional tag/fabric shot only | observed |
| FlowDrop, Crosslist, List Perfectly | Interaction, mechanism | Capture-order grouping, move/split/merge review, add-missed-photos | We also find **missing roles** and ask for those shots | observed |
| json-render, A2UI | Mechanism | Fixed catalog, agent fills it, actions back to the agent | Our catalog is the brand's components; copy rules apply to every string | observed |

## 4. The build plan

*Agent proposal.* Platform assumption for this plan: **Expo app (SDK 58, React Native 0.88, observed) with one local Swift module, `CaptureKit`**, plus a web build of the same React components for the folder drop on a laptop. The platform choice itself is Decision 1 for Ben (section 7); the steps below say what changes on each option.

### Step 0. Session start (device)
- Stack: `CaptureKit` (Swift, Expo Modules API) hosting an `ARSCNView`/`ARView` with `ARWorldTrackingConfiguration`, `planeDetection = .horizontal`, `frameSemantics += .sceneDepth` when `supportsFrameSemantics(.sceneDepth)`. Rigid items switch to `ObjectCaptureView` (iOS 17+, LiDAR Pro phones, `ObjectCaptureSession.isSupported`).
- Input: none. Output: a `capture_session` with device model, LiDAR yes/no, iOS version.
- Human moment: none. First screen shows the camera with one line: "Lay it flat on a white sheet". A ghost outline of a generic top appears until category is known.
- Edge: no plane found after 5 s: "Point at the floor" (ARKit tracking state). No camera permission: system prompt, then a plain explanation and the folder-drop option.

### Step 1. Live gates per frame (device)
Run on every 6th ARFrame (about 5 Hz at 30 fps), on a 512 px downscale of the center ROI, off the main thread; results drive one instruction and the shutter.

| Gate | How | Pass condition (start values, calibrate on the labelled set) | Instruction when failing |
|---|---|---|---|
| Tracking | `ARCamera.trackingState == .normal` | normal | "Move slowly" |
| Tilt (flat shots) | camera transform vs floor plane normal | ≤ 8° native; ≤ 3° web (measure-research) | level bubble, "Hold flat" |
| Distance | ray to plane, or LiDAR depth at center | 0.9 to 1.4 m for the measuring shot | "Step back" / "Move closer" |
| Subject | `VNGenerateForegroundInstanceMaskRequest` | exactly 1 instance; bbox inside frame with 3% margin; fill ≥ 60% on the measuring shot | "Fit it all in", "One item at a time" |
| Blur | variance of Laplacian on the gray 512 px ROI (vImage convolution) | above a per-device threshold set from the first 2 s of a still scene (start: 100) | "Hold still" |
| Exposure | luma histogram (vImage): mean and % clipped | mean 0.3 to 0.75, clipped < 2% | "Too dark", "Too bright" |
| Card (measuring shot) | `VNDetectRectanglesRequest`, aspect 0.60 to 0.66, min size 0.04 | found, not near a corner, aspect within 3% after homography | "Put a card beside it" (skippable on native) |
| Tag legible (tag shot) | `VNRecognizeTextRequest` `.fast` on the subject ROI | ≥ 3 words with confidence ≥ 0.5 | "Move closer to the tag" |
| Stability | ARKit camera velocity and all gates passing for 10 consecutive checks (about 2 s at 5 Hz, tune to 0.6 s) | stable | none: auto-shutter |

- Auto-shutter: `ARSession.captureHighResolutionFrame` when all role gates pass; light haptic and the thumbnail flies into the shot strip ([frontend standard](../../../product/frontend-standard.md)). A manual shutter is always visible; a manual shot is marked `gates_passed=false`.
- Gate order follows Incode: framing, light, blur, then role checks. Only the first failing instruction is shown.
- After the first kept still: `DetectLensSmudgeRequest` (iOS 26+) once; confidence ≥ 0.9 gives "Wipe your lens".
- Web fallback (PWA option): `getUserMedia({video:{facingMode:'environment', width:{ideal:3840}}})`, OpenCV.js 4.x for Laplacian and `cv.findContours` for the card, `DeviceOrientationEvent.requestPermission()` for tilt, luminance threshold on the white sheet for the subject. Stills are video frames (ImageCapture unsupported on iOS Safari, observed), so measure accuracy drops (*inferred*).

### Step 2. Upload and per-shot judgement (backend)
- Stack: the kept still (HEIC to JPEG q90 full-res) plus a 1536 px copy uploads to a Databricks Unity Catalog Volume, served by the Databricks App through a short-lived signed HTTPS URL that Decisions can fetch (URLs are supported, observed). Fallback: base64 of the 1536 px copy.
- One Decisions request per shot, with role-specific questions:

| Role | Questions (type) | Threshold to retake (start; calibrate) |
|---|---|---|
| front, back | `whole_item_visible` (predicate), `item_flat_and_smooth` (predicate), `one_item_only` (predicate) | < 0.7 |
| tag | `label_text_legible` (predicate), `size_visible` (predicate), `brand_visible` (predicate) | legible < 0.7 |
| fabric | `texture_in_focus` (predicate), `fills_frame_with_fabric` (predicate) | < 0.7 |
| defect close-up | `shows_the_flagged_flaw` (predicate, flagged crop image inside instructions), `defect_severity` (score, 4 levels: barely visible, minor, noticeable, major) | shows < 0.6 |
| any | `photo_usable_for_listing` (predicate) | < 0.5 |

- Latency: target under 1 s; the UI is already on the next shot, so a failure arrives as a badge on that slot's thumbnail ("retake"), not a modal. Measure p50/p95 on day one.
- Every request and answer is logged as an MLflow trace span with the image URL, question set version and probabilities (the "why?" panel).

### Step 3. Shot 1 picks the rest of the list (backend, chained)
- Shot 1 is always "the whole thing, front, flat or standing".
- Request A (on shot 1): `category` choice over `top, pants, dress, skirt, outerwear, shoes, bag, hat, electronics, small_rigid, furniture, other`; `is_rigid` predicate; `is_flat_layable` predicate.
- Request B (separate, per the docs' dependent-decision guidance) only when confidence < 0.6 or the top two are close: shown to the person as category chips (ChoiceChips), top 3 plus "Something else".
- The answer selects a preset list (below). Lists are presets, not generated: predictable, testable, and the dual-purpose mapping is fixed per role. This answers the open question on the feature page: **presets per category, chosen live from the first photo**.
- Rigid and `ObjectCaptureSession.isSupported`: switch to walk-around mode. Rigid without LiDAR: four-sides list (front, back, left, right, top, bottom label).

| Category | Shots after shot 1 (cap 6 for clothing, defects extra) |
|---|---|
| top, dress, outerwear | back flat; tag (brand/size); care label (fiber %); fabric close-up; then each confirmed flaw |
| pants, skirt | back flat; waist tag; care label; fabric close-up; then flaws |
| shoes | both sides; soles together; insole/tongue label; heel back; box if any; then flaws |
| bag | back; inside; label/serial; corners/base; hardware close-up; then flaws |
| electronics, small rigid | walk-around (Object Capture) or 4 sides; serial/model label; ports/screen on; then flaws |
| furniture | walk-around or 3 angles; label/maker mark; a tape or card for scale; then flaws |

### Step 4. Defect proposals with regions (backend)
- After front and back are kept: Gemini 3.8 Flash with thinking minimal, JSON schema `[{label: enum(stain, hole, tear, pilling, fading, missing_button, broken_zip, scuff, crack, other), box_2d, note}]`, prompt names the category. *Box proposer.*
- Each box is cropped (box plus 25% margin) and judged by Decisions: `crop_shows_real_flaw` predicate (with the full photo as context), `defect_severity` score. Keep boxes with probability ≥ 0.4 (earlier note's threshold), cap 5 per item.
- SAM 3 visual segment with the box gives a mask for the highlight.
- Human moment: **PhotoWithRegions + DefectChips**: each flaw is a soft outline on the photo with a chip "Stain?" and two actions, ✓ and ✕; plus "Add a flaw" (tap the photo to drop a point). Confirmed flaws append a close-up shot to the list with a ghost box guiding the person to it. Dismissed flaws are stored as negative labels.
- Edge: model finds nothing: still show "Add a flaw" (the earlier note's guard); model over-flags print patterns as stains: dismiss is one tap and trains the threshold.

### Step 5. Color and scale references (device then backend)
- White balance: the white sheet under the item is the reference. Backend takes sheet pixels (subject mask inverted, luma in the top 30% but unclipped), computes per-channel gains, applies to every shot of the session (Seedream note's step 1). Source recorded as `sheet`.
- White items: the sheet gives no contrast, so the instruction becomes "Use a dark floor and put a sheet of paper beside it"; the paper is the WB patch.
- Scale: native uses the ARKit plane (and LiDAR depth if present); the card, if found, is a cross-check. Web uses the card (or, *inferred and untested*, a US Letter or A4 sheet, whose larger size may detect more reliably; for measure to test).
- Stretch: one constant-color tag/fabric shot on supported phones (iOS 18+, flash), used as Seedream's color truth when its confidence map is high over the item.

### Step 6. Shot review and finishing (device, approval)
- Each kept shot shows in the shot strip. A clean shot (all gates and Decisions above threshold) is kept automatically with an undo for 3 s. A flagged shot shows **ShotReview**: the photo, one line naming the failing check ("Tag is blurry"), and Keep anyway / Retake. Two retakes, then it accepts with a flag so nobody gets stuck.
- When the list is done: **ItemSummary** card with the shot strip, category, confirmed flaws and missing items as empty slots; one primary action, Done.

### Step 7. Folder drop (backend, approval)
1. Ingest: files from the iOS share sheet / Files picker (native) or drag-and-drop (web). Read EXIF `DateTimeOriginal` (fallback: file order), GPS ignored.
2. Embed: SigLIP 2 image embeddings (served on Databricks Model Serving; or OpenAI/Gemini embeddings if setup stalls) on a 512 px copy.
3. Group: sort by time; start a new group when time gap > 120 s **or** cosine similarity to the running group centroid < 0.75 (start values; calibrate). Then one Decisions call per boundary: `same_item` predicate with the two neighbouring photos; merge if ≥ 0.6. Non-adjacent near-duplicates are suggested merges, not automatic.
4. Assign roles: per photo, Decisions `role` choice over `front, back, tag, care_label, fabric, flaw, detail, side, inside, sole, not_this_item, unusable`.
5. Gaps: compare each group's roles to its category's preset list; missing roles become a **MissingShots** card per item ("Needs: tag, back") with a camera button that opens Step 1 straight on that role.
6. Human moment: **GroupGrid**: rows of items, photos as tiles; actions move, split, merge, remove; first tile = cover = front. One tap "Looks right" approves the grouping (FlowDrop/Crosslist pattern, with List Perfectly's lesson that humans still own grouping).
- Edge: 300+ photos: process in batches of 50 with a Job progress bar; screenshots and receipts go to `unusable`; two identical items (pair of the same tee in two colours) can wrongly merge, which the grid exposes.

### Step 8. Generative UI component catalog (both)
*Agent proposal.* The agent never writes UI. It emits a json-render spec (`@json-render/core` catalog with zod props; `@json-render/react-native` and `@json-render/react` renderers) using only these components, all drawn from the brand system and checked by `ui-screen`:

| Component | When the agent uses it | Props (short) | Actions back to the agent |
|---|---|---|---|
| ShotPrompt | Every shot | role, ghost outline id, instruction (≤ 4 words) | `skip_shot` |
| GateHint | Live failing gate | gate, instruction | none |
| ShotStrip | Always during capture | slots with role, state (empty, ok, flagged) | `open_slot` |
| ShotReview | A shot is flagged | photo, failing question, probability | `keep`, `retake` |
| ChoiceChips | Category or role unsure | options with probabilities, other | `choose` |
| PhotoWithRegions | Flaws proposed | photo, regions with masks | `confirm_flaw`, `dismiss_flaw`, `add_flaw` |
| MissingShots | Folder drop or skipped shots | item, missing roles | `capture_role` |
| GroupGrid | Folder drop | groups of photo ids | `move`, `split`, `merge`, `remove`, `approve_groups` |
| WhyBar | Any judgement on tap | question, probability | none |
| ItemSummary | List complete | shots, category, flaws | `done` |

Agent choice rule: a component appears only when a Decision needs the person (a threshold missed, a flaw proposed, a group boundary); otherwise the flow continues without a screen. That keeps "no thinking" and still shows the human moments judges look for. Copy goes through [copy.md](../../../product/copy.md) and `node scripts/copy-lint.mjs`.

### Dual purpose: what each shot gives each consumer

| Shot | Listing | Seedream 5.5 (≤ 10 refs) | Measure | Identify / condition |
|---|---|---|---|---|
| Front flat on white sheet | Cover photo | Image 1 (main view), WB source | **The measuring shot**: plane/card scale, full-res, tilt-gated | Category, brand cues |
| Back flat | Photo 2 | Second view | Cross-check length | Back flaws |
| Tag | Size and brand photo | Logo and text fidelity | Tagged size (stored apart from measured) | Brand, size, RN |
| Care label | Optional photo | Exact fabric color (constant color stretch) | none | Fiber %, care |
| Fabric close-up | Texture photo | Texture to keep when relighting | none | Material |
| Each flaw close-up | Disclosure photos, never edited | Constraints it must preserve; also used by the fidelity gate | none | Severity |
| Walk-around (rigid) | 360 view | Angles from every side | Object Capture bounds | Shape, wear |

Seedream reference selection: front, back, tag, fabric, up to 5 flaw close-ups, then sides, white-balanced copies, max 10 (observed limit in the Seedream note).

## 5. Data contract

Fields capture writes; every field has a source and a confidence (per thinking.md).

| Primitive.field | Value | Source | Confidence |
|---|---|---|---|
| Photo.role | front, back, tag, care_label, fabric, flaw, side, inside, sole, walkaround, other | `prompted` (live capture) or `decisions` (folder drop) or `you_said` (moved in GroupGrid) | 1.0 when prompted; Decisions `confidence` otherwise |
| Photo.raw_uri, Photo.preview_uri | Volume paths | device | n/a |
| Photo.wb_uri, Photo.mask_uri | corrected copy, item mask | backend (sheet gains; Vision or SAM 3 mask) | gains residual on the sheet |
| Photo.capture_meta | intrinsics, camera transform, plane anchor, depth+confidence map uri, device, iOS, lidar, constant_color | ARKit / AVFoundation | n/a (raw) |
| Photo.gates | blur_var, luma_mean, clip_pct, tilt_deg, distance_m, subject_count, fill, card_found, text_conf, smudge_conf, gates_passed | device (`measured`) | raw values |
| Photo.judgement | request id, question set version, `{name: probability}` | Decisions (`estimated`) | the probabilities |
| Photo.human | kept_auto, kept_anyway, retakes, at | `you_said` | 1.0 |
| Item.category | enum | Decisions choice or chips | `confidence`; 1.0 when chosen |
| Item.shot_list | preset id and version, completed roles, skipped roles | system | n/a |
| Item.flaws[] | label, photo_id, box (0 to 1 normalized), mask_uri, proposer_prob (Gemini has none: null), decisions_prob, severity score, human (confirmed, dismissed, added), closeup_photo_id | Gemini + Decisions (`estimated`), person (`you_said`) | decisions_prob; 1.0 once confirmed |
| Item.white_ref | sheet, paper, constant_color; gains | backend (`measured`) | residual chroma of the patch |
| Item.scale_ref | arkit_plane, lidar, card, paper | device (`measured`) | handed to measure |
| Job (kind `capture_judge`, `defect_propose`, `folder_group`) | state, progress | system | n/a |
| Decision (kind `retake`, `category_unsure`, `confirm_flaw`, `missing_shot`, `approve_groups`) | options, suggested option, why (question + probability) | Jobs | per the Decision primitive |

Every human answer (keep anyway, retake, flaw ✓/✕, chip choice, group move) is written as a label row next to the model's probabilities in Delta, which is the calibration loop in the Decisions note.

## 6. How to prove it works before the demo

- Labelled set: 30 real items from Ben's and Nate's closets (10 tops, 5 pants, 3 outerwear, 4 shoes, 3 bags, 5 rigid). For each: true category, known flaws drawn as boxes, tag text, plus 2 deliberately bad shots per role (blur, dark, cropped).
- Per-field error to report:
  - Gate accuracy: false rejects (good shots blocked) under 10%, false accepts (bad shots passed) under 5%, per gate.
  - Decisions per question: ROC on the labelled shots; set thresholds at the point where false accepts are under 5%.
  - Category: top-1 accuracy, and how often chips were needed.
  - Flaws: recall and precision at IoU ≥ 0.3 against hand boxes, after Decisions filtering; target recall ≥ 0.7 (anything missed is caught by "Add a flaw").
  - Folder drop: shuffle-free dump of all 30 items' photos (about 200): pairwise grouping F1 ≥ 0.9; missing-role detection accuracy.
  - Latency: Decisions p50/p95 with images; Gemini box call p50; time from shot 1 to Done (target under 90 s for a top).
- Run the whole set as a script against the backend and save the table into this folder as a follow-up note.

## 7. Decisions for Ben

1. **App platform** (direction; cross-cutting, also raised by measure and studio)
   - A. Expo (SDK 58) app with one Swift module for capture, measure and Object Capture; json-render for approval screens; same components on web for the laptop folder drop. Cost: needs a Mac with Xcode and a dev build; about 3 to 4 h to stand up the Swift module and bridge (*inferred*). **Recommended**: native camera quality plus fast UI iteration plus a web fallback.
   - B. Fully native SwiftUI. Best camera, no bridge, but the generative UI catalog must be hand-built in SwiftUI (json-render has no SwiftUI renderer, observed) and there is no web fallback.
   - C. PWA only. Fastest start and judges can open a link; loses ARKit scale, LiDAR, Object Capture, subject lift and full-res stills (measure becomes card-only with a 3° tilt gate).
2. **How much the person approves per shot** (taste)
   - A. Clean shots keep automatically with a 3 s undo; only flagged shots ask Keep/Retake. **Recommended**: "no thinking" for the common case, visible human moments where it matters.
   - B. Every shot asks Keep/Retake (IKEA Kreativ style). More visible human-in-the-loop, slower.
   - C. Never ask; flags only appear on the summary.
3. **Flaw disclosure** (taste and trust)
   - A. Every proposed flaw needs ✓ or ✕ before the listing can go out. **Recommended**: honest listings and a clear human moment.
   - B. Proposed flaws default to included; the person removes wrong ones.
4. **Shot count for clothing** (scope)
   - A. Cap at 6 plus flaws (front, back, tag, care, fabric, plus one). **Recommended.**
   - B. Add the 10 s spin for clothing too (the feature page lists it), for Seedream angles. Costs about 15 s per item.

## 8. Changes to earlier notes

- [guided-shot-list.md](guided-shot-list.md) recommended a PWA main flow. This note recommends native capture inside Expo, because measure now depends on ARKit plane scale on the same session (measure-research, loop 4) and because iOS Safari has no ImageCapture (observed).
- The Decisions note's open conflict on image URLs is resolved: public HTTPS URLs and base64 both work (observed).
- The earlier "defect_present per region" question assumed Decisions could localize; it can't. Regions now come from Gemini 3.8 Flash boxes, judged per crop by Decisions.
- The feature page's open question "presets or chosen live" is answered: presets per category, chosen live from shot 1 (*agent proposal*).
- The tag shot is not the white-balance reference (earlier note): the sheet under the item is; the tag shot gets the optional constant-color capture instead.

## 9. Limits

- Searched and opened: OpenAI Decisions guide (HTML and md), Firecrawl and DataCamp Decisions write-ups, Onfido design and engineering blogs, Incode ID capture guide, CCC First Look PDF, Solera Qapter sheet, Depop and Mercari AI listing posts, Apple docs (`DetectLensSmudgeRequest`, `VNGenerateForegroundInstanceMaskRequest`, `isConstantColorSupported`), Apple ML research salient segmentation, WWDC23 notes, Gemini image-understanding docs, Roboflow SAM 3 docs, caniuse ImageCapture, MediaPipe tasks-vision README, Margelo VisionCamera V5 post, VisionCamera 5.2.1 release, Expo SDK 58 changelog, FlowDrop, Crosslist bulk create, List Perfectly Bundle Mode, json-render README, A2UI v1.0 spec (first 100k characters).
- Could not read: the towardsdatascience Decisions guide (fetch failed). Not opened: Persona and Jumio docs, Genius Scan SDK, VNDocumentCameraViewController docs, Google Lens, IKEA Kreativ (relied on the repo's earlier note), Tractable's own docs, dermatology capture apps, the FitTag repo (measure-research's citation).
- From memory, not re-checked today: `VNDetectRectanglesRequest` and `VNRecognizeTextRequest` parameters, Laplacian variance as the blur metric and its starting threshold, ARKit `captureHighResolutionFrame`, SigLIP 2 availability on Databricks Model Serving, OpenCV.js version.
- No published latency for Decisions with images; no measured defect recall for Gemini on garments. Both are day-one measurements in section 6.
