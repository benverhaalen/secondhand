# How do we measure clothes and items accurately from a phone?
Researched 2026-11-14 by Ben (Claude Code). Feature: measure.

Ben: "for clothes measuring the mechanism is measuring more than anything." Measurement is two separate problems: **scale** (how many mm per pixel) and **points** (where the shoulder seam, hem, cuff are). Every product below solves them separately.

## What exists

| Reference | Scale | Points | Accuracy | Tag |
|---|---|---|---|---|
| Size AI (iOS) | iPhone LiDAR depth map; non-LiDAR path from iPhone 11, method unstated | On-device keypoint model, garment type from silhouette; up to 12 measurements (pants) | about 5 mm with LiDAR, about 9 mm without; long measurements worse | asserted, https://sizeai.co/guides/capture , https://sizeai.co/guides/garments |
| TapeAR (iOS) | Requires LiDAR (iPhone 12 Pro+) | "Apple LiDAR and Visual Intelligence"; length, sleeve, rise, inseam, hip, waist, pit-to-pit | none stated | observed, https://apps.apple.com/us/app/tapear-ai-measure-bg-remover/id6761725268 |
| Tailored | Credit card or printed dot card | User-adjustable points, up to 6 per photo | 2.7 stars | observed (in `secondhand-concept/research/direct-references.md`) |
| Apple Measure | ARKit world tracking | User taps endpoints | n/a | prior knowledge |
| SmartSizer | — | AI points | reviewers saw up to 8 in variance | observed (direct-references.md) |

Size AI also has label OCR (brand, size, fabric %, care, RN number) and background cut-out, so it is the closest existing product to our capture step [asserted].

## Building blocks

- **Apple:** `ARFrame.sceneDepth` / `smoothedSceneDepth` via `ARWorldTrackingConfiguration.frameSemantics` (LiDAR only, check `supportsFrameSemantics(.sceneDepth)`); `VNDetectRectanglesRequest` to find a card; `VNRecognizeTextRequest` for labels; RoomPlan for furniture; Object Capture for photogrammetry [asserted, from memory, from memory].
- **Open source points:** DeepFashion2 (13 categories, landmarks and masks), FashionAI keypoints (24 points, 5 categories), fine-tunable with RTMPose/ViTPose; SAM 2 or BiRefNet for the garment mask [asserted, from memory, from memory]. No public end-to-end "keypoints + scale card" garment pipeline was found [observed absence, not proof].
- **Monocular depth for non-LiDAR phones:** Depth Anything V2, Apple Depth Pro [asserted, from memory].

## Recommended architecture

1. **Scale.** Prefer LiDAR depth at the garment plane when the native screen exists. Otherwise an ID-1 card (85.60 × 53.98 mm) in the flat-lay shot, found by rectangle detection; fit a homography so a slightly tilted phone is corrected [inferred]. Card scale is good enough for pit-to-pit and length, and works on every phone.
2. **Points.** For a hackathon, skip training: segment the garment (SAM 2 / BiRefNet), then derive most measurements geometrically from the mask (widest row near the armpits = pit-to-pit, top-to-bottom extent = length) and ask a vision model only for the ambiguous points (shoulder seams, crotch). This is faster to ship than a keypoint model and easier to explain [inferred].
3. **Human confirms.** Show arrows on the photo with draggable endpoints (Polycam/Size AI pattern). Measurements recompute live. The user tapping "looks right" is the approval; that record is stored with the listing.
4. **Honest output.** Phrase like eBay sellers do: "Tagged M; pit-to-pit 20 in (±½ in)". Store tagged size, measured values and confidence as separate fields.
5. **Non-garments.** Boxes and furniture: card or LiDAR for the bounding box; Apple Measure-style two-tap fallback.

## Why this beats existing tools (the pitch)

Existing apps stop at a number. We carry the measurement into the decision: "fits like S" against the brand's size chart, into the listing text, and into the buyer alert ("pit-to-pit 19–21 in"). Measurements become a searchable field nobody else on Poshmark or Depop has [inferred].

## Risks

- Wrinkles shrink measurements; the capture step asks to smooth and the confirm step catches it.
- Card occluded or on a fold gives wrong scale; reject when the card's aspect ratio is off by more than a few percent.
