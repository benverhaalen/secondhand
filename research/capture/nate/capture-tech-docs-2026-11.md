# What do the current Expo, Apple Object Capture, ARKit and Vision docs say that the capture plan depends on, as of November 2026?
Researched 2026-11-15 by Nate (Claude Code: capture lead Opus 5.5, retriever seat). Feature: capture.

Decision it feeds: the device inputs and fallbacks of [capture engine §11](../../../spec/engines/capture.md#11-the-deterministic-plan) (when a scan is offered, when a size counts as `measured`, which reads the phone can send). Builds on [adaptive-capture](adaptive-capture.md) and [object-capture](../../measure/ben/object-capture.md), which already hold ARKit depth size and accuracy, the Object Capture basics and the soft and reflective limits; those are not repeated.

All fetches 2026-11-15. Apple `.md` pages carry iOS availability headers and "Copyright 2026" but no page version. *observed*: read at the URL. *asserted*: the source says it without showing it, or memory. *inferred*: our reasoning.

## What changed against the draft

| Draft from memory | Finding |
|---|---|
| Object Capture may have reached iPhones without LiDAR in iOS 18 or 26 | Wrong. Still LiDAR only. Apple DTS: "'LiDAR capabilities' refers to both the camera and the SoC ... made it a requirement for contemporary RealityKit-based object capture" (*observed* via a fetch summary, https://developer.apple.com/forums/thread/769221, March 2025). WWDC24 10107: "Object Capture is available on iPad Pro 2021, iPhone 12 Pro, and the later models" (*observed*, https://developer.apple.com/videos/play/wwdc2024/10107/). No reversal found for iOS 26 (the WWDC25 updates page has no Object Capture entry, *observed*). So the 8-still ring without LiDAR stays. |
| LiDAR present means a scan works | Not enough. Reports of `ObjectCaptureSession` sensor errors on iPhone 17 Pro and Pro Max under iOS 26.4.x and 26.5, with iPhone 12 Pro working (*asserted*, search snippet of https://developer.apple.com/forums/thread/828928; the page hit a bot check). `isSupported` names no hardware criteria and a false value makes a session a runtime error (*observed*, https://developer.apple.com/documentation/realitykit/objectcapturesession/issupported.md). |
| The scan's bounding box gives a size in metres | Unconfirmed. `PhotogrammetrySession.Request.bounds` "returns a box the same size as the created model" (*observed*, .../photogrammetrysession/request/bounds.md); the units are not stated on that page or on `Result.bounds` (*not found*). |
| expo-camera gives no depth | Holds. SDK 58's CameraView has photo, video, barcode scanning (qr, pdf417, ean13, ean8, upc_a, upc_e, datamatrix, code39, code93, itf14, codabar, code128, aztec), `launchScanner` over DataScannerViewController on iOS 16+, and `exif` on `takePictureAsync`; no depth option was found (*observed*, https://docs.expo.dev/versions/latest/sdk/camera/). |
| No maintained RN or Expo module wraps ARKit depth or Object Capture | Holds for npm search (*observed*, five registry queries; ranking is weak, so not proof). react-native-vision-camera 5.2.4 (2026-10-29) has a `Depth` output from AVFoundation depth (*observed*, its `Depth.nitro.ts`), not ARKit; whether it is LiDAR depth or camera disparity was not read. |
| Vision reads UPC-A codes as such | Wrong. `BarcodeSymbology` in the Swift Vision API (iOS 18+) has no `upca` case: aztec, codabar, code128, code39, code93, dataMatrix, ean13, ean8, gs1DataBar, i2of5, itf14, microPDF417, microQR, msiPlessey, pdf417, qr, upce (*observed*, https://developer.apple.com/documentation/vision/barcodesymbology.md). UPC-A coming back as EAN-13 with a leading 0 is *asserted*. |
| Foundation Models could word questions on the phone | Holds, but only where Apple Intelligence is on: `SystemLanguageModel.default.availability` is `.unavailable(.deviceNotEligible / .appleIntelligenceNotEnabled / .modelNotReady)` otherwise (*observed*, https://developer.apple.com/documentation/foundationmodels/generating-content-and-performing-tasks-with-foundation-models.md). |

## Facts each part of the plan uses

- **LiDAR phones.** iPhone 17 Pro has the LiDAR Scanner (*observed*, https://support.apple.com/en-us/125090). iPhone Air, iPhone 17 and iPhone 16 do not (*observed*, their apple.com spec pages). iPhone 16e and the 12 Pro to 15 Pro pages were not read. *Inferred*: the current non-Pro line has no depth, so the asked and looked-up size path is the common path, not the edge.
- **Depth and mesh.** `supportsSceneReconstruction(_:)`: "Scene reconstruction requires a device with a LiDAR Scanner" (*observed*, https://developer.apple.com/documentation/arkit/arworldtrackingconfiguration/supportsscenereconstruction(_:).md). ARKit's new `trackingObjects` (iOS 27) tracks a known reference object; it is not a measurement API for an unknown item (*observed*, https://developer.apple.com/documentation/updates/arkit.md and .../trackingobjects.md).
- **Reading tags and codes on the phone.** `RecognizeTextRequest` (iOS 18+) with `recognitionLevel` fast or accurate and `recognitionLanguages`; `DetectBarcodesRequest` (iOS 18+); `RecognizeDocumentsRequest` (iOS 26+) returns structure, text and barcodes together (*observed*, developer.apple.com/documentation/vision/*.md).
- **Shot gates.** `CalculateImageAestheticsScoresRequest` (iOS 18+) gives `overallScore` and `isUtility`; `DetectLensSmudgeRequest` (iOS 26+, A14 or later) gives a `confidence` (*observed*, same pages).

## What the plan takes from this (*inferred*)

1. Two device inputs, not one: `has_lidar` (scene depth: `measured` ways run) and `object_capture` (`isSupported` and no session failure this capture: `scan` steps are offered). A LiDAR phone whose session fails gets the ring and still measures from depth. Sent to worker cap-plan-1 as a follow-up.
2. A size from the scan's bounds counts as `measured` only after a known-size box check on that build (open: a 30 cm box on the fixed set, recorded on the board). Until then the scan's size enters at confidence 0.79, under the 0.8 `min_conf`, so it is a proposal the person confirms.
3. The phone sends its own reads with each photo (`reads[]` on `POST /v1/captures/:id/photos`): text, codes and the gate results come from Vision on the device, so the plan reacts with no server model call. An EAN-13 starting with 0 is also tried as UPC-A by identify's code lookup (identity's area: passed to the orchestrator).
4. Native depth needs our own Expo module (Swift, a development build), as Ben decided ([decision](../../../product/decisions.md#2026-11-14-the-app-is-an-expo-app-with-a-native-swift-camera-module)); no library replaces it.
5. Question words stay fixed per field, so nothing waits on Foundation Models being available.

## Not found or not reached

Units of the bounds box; an Expo doc line on Expo Go and custom native modules (that it needs a development build is *asserted*); a maintained RN ARKit or Object Capture module on GitHub (no authenticated search); iPhone 16e and 12 Pro to 15 Pro spec pages; forum threads 828928 and 827216 in full; iOS 18 and 26 release notes.
