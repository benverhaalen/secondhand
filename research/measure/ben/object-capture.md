# Where does Apple Object Capture fit for 3D and dimensions?
Researched 2026-11-14 by Ben (Claude Code). Feature: measure.

## What it is (observed, Apple docs)

- RealityKit photogrammetry: `ObjectCaptureSession` + `ObjectCaptureView` for guided capture on device, `PhotogrammetrySession` to reconstruct. iOS/iPadOS 17+; on iPhone needs **LiDAR** (iPhone 12 Pro and later Pro models, iPad Pro 2021+), A14 or later. Gate with `ObjectCaptureSession.isSupported` [https://developer.apple.com/documentation/realitykit/objectcapturesession.md, https://developer.apple.com/wwdc24/10107/].
- **Guided capture is built in.** States `initializing → ready → detecting → capturing → finishing → completed`. Live `Feedback`: `environmentLowLight`, `environmentTooDark`, `movingTooFast`, `objectNotDetected`, `objectTooClose`, `objectTooFar`, `outOfFieldOfView`, `objectNotFlippable`, `overCapturing`. A capture dial fills as the user circles; `beginNewScanPassAfterFlip()` scans the underside [https://developer.apple.com/documentation/realitykit/objectcapturesession/feedback-swift.enum.md].
- **Metric scale:** "If your source images contain depth data, RealityKit uses it to calculate the real-world size of the scanned object" [https://developer.apple.com/documentation/realitykit/capturing-photographs-for-realitykit-object-capture.md]. A `.bounds` request returns a `BoundingBox` "the same size as the created model"; `orientedBounds` also exists [https://developer.apple.com/documentation/realitykit/photogrammetrysession/request.md]. Units are not stated; test on a known-size box [inferred].
- **Output:** USDZ (or OBJ). On iPhone only `.reduced` detail (<50K triangles, about 10 MB); a Mac goes up to `.full`/`.raw` [https://developer.apple.com/documentation/realitykit/photogrammetrysession/request/detail.md].
- **Reconstruction time** on iPhone vs Mac: not published. Measure it.
- **Limitations:** avoid thin, reflective, transparent or translucent objects, single-color smooth surfaces, and "Soft, articulated, or bendable" objects [capturing-photographs page]. **That rules out loose clothing.** Wanted overlap 50–70% between shots; diffuse light.
- WWDC25/26 updates were not found in what I read.

## Where it fits secondhand

| Item type | Use Object Capture? | Why |
|---|---|---|
| Clothing (flat) | No | Soft and deformable; use flat-lay measurement (`research/measure/ben/measuring-garments.md`). |
| Shoes, bags, hats on a stand | Yes | Rigid enough; a 3D view shows sole wear and shape better than 6 photos. |
| Electronics, collectibles, small furniture, lamps | Yes | Bounding box gives L×W×H for listings and shipping estimates. |
| Glass, chrome, glossy items | Poorly | Reflective/transparent; fall back to photos + card scale. |

## Recommended design

1. **Reuse Apple's guidance as our capture UX for rigid items.** Its feedback states are exactly the "user does no thinking" flow from `research/capture/ben/guided-shot-list.md`; our shot list switches to "walk around it" mode when the category is rigid.
2. **Outputs used three ways:** (a) metric `bounds` → listing dimensions and a shipping-box suggestion; (b) the captured frames (with depth) → Seedream references from every angle, which is the closest thing to the "conceptual representation" Ben described; (c) the USDZ → an interactive 3D view on the listing page or in the app. Viewing USDZ in a web page (AR Quick Look on Safari, `<model-viewer>` with a GLB conversion) was not verified today.
3. **Garage-sale angle (hand off to the pricing thread):** a 30-second walk-around gives dimensions and a full set of angles in one gesture, which is the input an appraisal needs.

## Cost to build

Native Swift only; no web equivalent of the guided UI. Apple's "Scanning objects using Object Capture" sample app is the starting point [https://developer.apple.com/documentation/realitykit/scanning-objects-using-object-capture.md]. For a 24-hour build, ship it only if the native capture screen from `research/capture/ben/guided-shot-list.md` already exists; otherwise it's a stretch goal [inferred].

## Not verified today

Web or cross-platform alternatives (Polycam, Luma, KIRI Engine, gaussian splatting, single-image-to-3D models like TRELLIS and Hunyuan3D) and whether any give metric scale. Worth one pass if the team goes web-only.
