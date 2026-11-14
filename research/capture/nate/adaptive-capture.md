# What does the evidence say about one adaptive capture session compared with a fixed guided shot list, on iPhones with and without LiDAR, as of November 2026?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: capture.

Evidence marks: *observed* (opened, source says so; URL and date given), *asserted* (source claims without showing, or from memory), *inferred* (my reasoning). Search-highlight text from Exa counts as observed only for the page it names; pages I did not open in full say so. No recommendations are made here.

## 1. Depth sensor facts (ARKit scene depth)

- *observed* Apple docs (fetched with curl, undated pages): `ARFrame.sceneDepth` gives `ARDepthData` with `depthMap` (metres from the camera plane) and `confidenceMap` of `ARConfidenceLevel` low/medium/high; iOS 14+; needs `ARWorldTrackingConfiguration` with the `.sceneDepth` frame semantic, gated by `supportsFrameSemantics`. https://developer.apple.com/documentation/arkit/arframe/scenedepth , .../ardepthdata , .../arconfidencelevel
- *observed* Apple's sample page says ARKit's depth map holds "precise, low-resolution depth values" and the sample enlarges it with a guided filter; its colour ramp is sized to 2.5 m. https://developer.apple.com/documentation/arkit/displaying-a-point-cloud-using-scene-depth . It gives no pixel size or range.
- *observed* Depth map is 256 x 192 at up to 60 Hz: MDPI Sensors 23(18):7832, 2023-09-12 (https://www.mdpi.com/1424-8220/23/18/7832); Rerun ARKitScenes write-up, undated, same size plus a confidence map of the same size and a 1.2 cm baseline (https://rerun.io/blog/arkitscenes-slam); PMC12526706, 2025-10-04 (iPhone 14 Pro, ~49,000 points per frame).
- *observed* The depth map is fused with the RGB image: in darkness the plate outline was less accurate and the high-variance area wider (MDPI 7832, 2023-09-12). So "LiDAR works in the dark" holds for returns, not for edges.
- *observed* Range and noise: "up to 5 m, practically most accurate 20 cm to 2 m"; static surface at 0.25 m gave mean 250.18 mm, range 3 mm (https://www.structuresmmm.org/measurement/lidar, undated). A civil-survey slide deck concludes iPhone 13 Pro is "reliable to a single centimeter" (FIG 2022, https://www.fig.net/resources/proceedings/fig_proceedings/fig2022/ppt/ts03g/TS03G_zaczek-peplinska_kowalska_11458_ppt.pdf, 2022).
- *observed* Errors grow with distance and with change of movement direction (PMC12526706, 2025-10-04, scene scale: vertical RMSE 0.16 m with control points every 20 m; not object scale).
- *observed* Small objects: LiDAR "absolute accuracy of +/- 1 cm" for side length above 10 cm (Luetzenburg et al., PMC page fetched this session; already cited in measure/build-plan.md lines 40-42).
- *observed* Mirrors and glass: the phone measured the room reflected in a mirror and reported 1.6 m where the wall was 1.1 m; a confident wrong return, while the laser scanner returned a void (Rerun, undated). The confidence map is therefore not a reliable flag for mirrors (*inferred*: the Rerun text does not say what the confidence value was for those pixels).
- *observed* Surface-material sensitivity "to changes in material reflectivity" and 20 cm errors on stone-metal composites (PMC12526706, 2025-10-04).
- Not found: a controlled study of iPhone LiDAR error on black fabric, fur, fleece, leather, or glossy plastic at object scale (see Not found).

## 2. Object Capture (ObjectCaptureSession, PhotogrammetrySession)

- *observed* `ObjectCaptureSession` is iOS 17+; `Configuration` has `checkpointDirectory` and `isOverCaptureEnabled` (Apple docs, curl, undated): https://developer.apple.com/documentation/realitykit/objectcapturesession and .../objectcapturesession/configuration-swift.struct
- Feedback states, LiDAR requirement, `.reduced` detail on iPhone and the "avoid thin, reflective, transparent, soft or bendable" list are already in measure/ben/object-capture.md lines 6-11 (confirmed, not repeated).
- *observed* KIRI Engine ships its own on-device Object Capture with "Object Mode" (needs a full 360 degrees, masks the background) and "Area Mode" (objects you cannot circle); a point-cloud minimap shows coverage; "processes locally on supported iPhone and iPad Pro"; transparent, mirror and reflective surfaces "harder to capture accurately" (https://www.kiriengine.app/blog/iphone-lidar-object-capture-guide, 2026-06-19). This is a third-party confirmation that Area Mode exists as a shipped feature.
- *asserted* (via earlier WebFetch summary of WWDC24 10107, not re-fetched) Area Mode and the checkpoint API came in iOS 18. Marked unverified.
- *not-found* WWDC25 or iOS 26 changes to the Object Capture API; reconstruction time on iPhone; the iPhone 17 Pro failure thread is only as quoted in measure/ben/build-plan.md lines 59-61 and cross-cutting note line 28.
- *observed* Reconstruction on the phone is an Apple pipeline; its internal coverage test is not exposed except through `Feedback` and the dial (docs above). *Inferred*: an app that wants its own coverage decision must compute it from poses, so it cannot reuse Apple's dial except by hosting `ObjectCaptureView`.

## 3. Masks, text, furniture

- *observed* `VNGenerateForegroundInstanceMaskRequest` is iOS 17.0+ (Apple docs, curl, undated): https://developer.apple.com/documentation/vision/vngenerateforegroundinstancemaskrequest
- *observed* RoomPlan `CapturedRoom` is iOS 16.0+ (https://developer.apple.com/documentation/roomplan/capturedroom, undated); it needs LiDAR. Measure's note already calls RoomPlan furniture only (measure/ben/build-plan.md Step 7). *not-found*: object category list and accuracy for furniture below room scale.
- `DetectLensSmudgeRequest` (iOS 26+) is *asserted* from the earlier session; not re-opened.

## 4. Photo-only metric scale (no LiDAR)

- *observed* Depth Pro (Apple, ICLR 2025, arXiv v of 2025-04-21): zero-shot metric depth without camera intrinsics, 2.25 MP in 0.3 s on a V100; headline metric-accuracy measure is delta-1 within 25 percent (a loose threshold); "limited in dealing with translucent surfaces and volumetric scattering" (https://arxiv.org/html/2410.02073 ; https://proceedings.iclr.cc/paper_files/paper/2025/hash/bc8b2058fd96978a4146f18298cb2d39-Abstract-Conference.html). *Inferred*: a 25 percent depth tolerance does not give a 1 cm object size; the paper reports no object-scale centimetre error.
- ARKit plane scale, Depth Anything and MoGe/UniDepth numbers are already in measure/ben/build-plan.md lines 40-42 and 63 (not repeated). Where a photo-only path matters, those numbers are the ones to use.
- *inferred*: on a non-LiDAR iPhone, ARKit visual-inertial tracking still gives poses and a floor plane in metres; scene depth is absent (`supportsFrameSemantics(.sceneDepth)` false, Apple docs above), so the depth channel in the session is empty and any "depth coverage" signal has to come from pose and mask alone.

## 5. Guidance in shipping apps

- *observed* Polycam Object Mode: planning questions, base outline loop 3-5 ft away at 15-30 degree steps, a mid ring about 1 ft away, then detail shots; 70-75% overlap; "20 photos is the minimum ... a starting point" (https://learn.poly.cam/hc/en-us/articles/27425185907348-How-to-Use-Object-Mode, undated). Photo-mode guidance is a fixed three-ring shot plan; a haptic buzz marks each automatic photo (https://learn.poly.cam/hc/en-us/articles/48336423303572-How-to-3D-Scan-Mechanical-Parts, undated).
- *observed* Scaniverse: live meshing feedback, patchy or wobbly mesh means slow down and re-aim at scanned features; "Focus on coverage, not duration"; avoid mirrors and glass; orbit pattern for objects (https://www.nianticspatial.com/docs/scaniverse/techniques/, undated).
- *observed* KIRI Engine photo scan: top, middle, lower orbits, 70% overlap, avoid shiny, reflective, transparent objects; for 3DGS orbit inward and keep the object still (https://www.kiriengine.app/tutorial/why-is-my-photo-scan-bad and .../why-is-my-3dgs-scan-bad, 2025-01-21).
- *not-found* Apple Measure's and any resale app's (Depop, Poshmark, Mercari, eBay) capture guidance for 3D or coverage. Not searched beyond the brief's list.
- *Inferred*: shipping apps combine a fixed pattern (rings, orbit) with a live signal (haptic, point-cloud minimap, mesh patchiness); none found documents asking for a single extra view on demand.

## 6. Next-best-view and coverage on a phone

- *observed* AR head-mounted guided acquisition, N=10: about 95% of the scene within 5 cm of ground truth with guidance versus 60% without; 10 of 10 guided models had over 50% within 1 cm versus 3 of 10 unguided; guided sessions took far longer and more images, with alignment in depth (Z) unclear (Andersen, Villano, Popescu, ISMAR/TVCG 2019, https://www.cs.purdue.edu/xrlab/assets/pdf/popescuARGuidance3DAcquisition_ISMAR2019.pdf). The failure of the unguided group was missing the transitions between sides.
- *observed* XR-supported scan versus unsupported, rating scales: ease 4.56 vs 2.94, confidence of covering all areas 4.38 vs 2.13, efficiency 4.19 vs 2.63 (SciTePress 2025, https://www.scitepress.org/Papers/2025/132598/132598.pdf; number of participants not in the highlight; page opened only as highlight text).
- *observed* "User-in-the-loop" error-peaking visualisation: less invasive, less disappointment, fewer views, but longer sessions and learning (Yasunaga, Saito, Mori, arXiv 2506.21009, 2025-06-26, https://arxiv.org/html/2506.21009).
- *observed* IntelliCap on-device redesign: coverage stripes from a TSDF weight atlas, depth from ARCore with TSDF fallback, YOLOv8s every seventh frame; 4-person study: strong sphere accuracy, moderate on coverage speed and quality; users wanted a cue for which unscanned region to visit next (Renganathan, Univ. Stuttgart thesis, 2026, https://doi.org/10.18419/opus-18678).
- *observed* Interactive vs automatic NBV: users get complete scans with a simple interface and perform on par with automated NBV (CAD journal 10(2), 2013, https://cad-journal.net/files/vol_10/CAD_10(2)_2013_279-291.pdf; reflections excluded from the study).
- *observed* A hobby coverage score from camera poses around an object centre: sweep 75% vs casual lap 14%, synthetic full sphere ~98% (https://pixelleddimensions.com/projects/phone-coverage-guide, undated; one author, two real captures).
- *Inferred*: pose-only coverage (view directions on a sphere) is cheap enough for 5 Hz on the phone; "would settle something" needs a model of what is uncertain (mask boundary, tag, flaw), which none of these sources tests.
- *not-found*: a published head-to-head of adaptive on-demand prompts versus a fixed step-by-step photo list for consumer objects with completion time and error; the AR guidance studies above compare guidance versus none, not adaptive versus fixed.

## 7. Gaussian splatting on phones

- *observed* KIRI documents a 3DGS scan mode with orbit-inward capture and a static object (2025-01-21, URL above). Polycam and Luma 3DGS docs were not opened. *not-found*: metric accuracy of phone Gaussian splats on objects.

## 8. Hosting ARKit in an Expo app

- *observed* Expo's native-view tutorial and native-module tutorial both build on `ExpoView` in Swift (https://docs.expo.dev/modules/native-view-tutorial/ and .../native-module-tutorial/, fetched as raw HTML 2026-11-14; ExpoView appears 7 times). *Inferred*: an ARKit session, ARView or ObjectCaptureView subclassing `ExpoView` fits the pattern; this needs a development build, not Expo Go, which I did not check on the page. Not tested.

## 9. Per-item-class table (*inferred* throughout)

Signals: LiDAR depth (L), depth confidence (C), pose/ARKit scale (P), Vision mask (M), Object Capture (OC), photo overlap/blur checks (B). "OK" means no source shows a failure; "weak" means a source shows or implies degradation; "no" means a source names the class as a limitation.

| Class | L | C | P | M | OC | Why (sources) |
|---|---|---|---|---|---|---|
| Flat garments on a sheet | weak | weak | OK | OK | no | 256x192 map, items near floor level; Apple lists soft/bendable as a limit; mask on contrast background |
| Shoes and bags | OK for >10 cm | weak on black or glossy | OK | OK | OK for rigid parts, weak on shiny leather | Luetzenburg 1 cm; reflectivity sensitivity (PMC12526706) |
| Rigid small objects (under 10 cm) | no | weak | OK | OK | weak | below Luetzenburg's 10 cm bound; macro focus 20 cm (Polycam) |
| Furniture | OK | OK at 1 to 2 m; falls past 2 m | OK | weak (large, cluttered) | OK for small, Area Mode for large | range note (Structures MMM); KIRI Area Mode |
| Electronics (screens, glossy plastic) | weak | weak | OK | OK | weak | screens act as mirrors (Rerun); KIRI list |
| Reflective or transparent (glass, chrome, mirrors) | no | not reliable | OK | weak | no | Rerun mirror 1.6 m vs 1.1 m; Depth Pro translucency limit; Scaniverse and KIRI avoid-lists |

Without LiDAR: L and C are absent in every row; OC is unavailable (iPhone LiDAR requirement, object-capture.md line 6); P and M remain.

## 10. Test protocol (*inferred*) to decide adaptive session versus fixed shot list

1. Items: 30, five per class in the table, each with a tape-measured L x W x H (or flat-lay lengths for garments) and a hand-labelled list of flaws and tag text.
2. Devices: one LiDAR iPhone Pro and one non-LiDAR iPhone, same iOS version; record the version.
3. Arms, each item on each device: (A) fixed shot list from capture/ben/build-plan.md Step 3 presets; (B) adaptive session: free walk-around at 5 Hz coverage with at most 2 prompts for one more view, prompt only if the missing view changes a field's band.
4. Operators: two people not on the build team, who have never used the app; order counterbalanced; same lighting condition per item.
5. Log per run: wall time to done, photo count, prompts issued and accepted, retakes, depth-confidence fraction on the mask, pose coverage fraction, abandoned runs.
6. Outcomes, scored blind: dimension error vs tape (cm and percent), flaw recall and precision, tag-read success, mask IoU against a hand mask, filled-card correctness, and the person's NASA-TLX-style effort rating.
7. Stopping rule: report per class, per device. Cells with fewer than 5 items are shown but not pooled. Compare paired differences with a sign test; the 2019 AR study used paired t-tests on 10 people, so n is small and the effect sizes matter more than p.
8. Include one deliberately failing set (mirror, black fleece, glass) to see whether the confidence map or pose coverage flags it.

## Where this confirms, extends or contradicts the existing notes

- Confirms measure/ben/object-capture.md line 11 (reflective, transparent, soft excluded): KIRI (2026-06-19) and Scaniverse state the same, and Rerun shows a confident wrong return on a mirror.
- Extends object-capture.md line 12 (WWDC25/26 not found): still not found; KIRI's Area Mode confirms the iOS 18 feature shipped in a third-party app.
- Extends capture/ben/build-plan.md open items (lines 86-90) and Step 1 table (lines 119-137): depth is 256x192, so a live "depth confidence" gate is on a map much coarser than the 5 Hz photo gates; fusion with RGB makes dark scenes degrade depth edges.
- Contradicts nothing in cross-cutting/ben/seeing-the-item-pipeline.md lines 37-51 (demo mode); the table in section 9 is the per-class view of the "Object Capture in the demo" row.
- Adds: no source tested adaptive prompts against a fixed list; the existing notes' fixed shot list rests on Polycam/KIRI guidance (ring patterns, 70% overlap) which is itself fixed.

## Not found

- Controlled LiDAR error on fabric, fur, black or glossy objects at 10 cm to 2 m.
- Object Capture reconstruction time on iPhone; any WWDC25 or iOS 26 API change.
- Head-to-head user research of adaptive prompts versus step-by-step lists with completion time and error.
- Capture guidance of Apple Measure and resale apps.
- Metric accuracy of phone Gaussian splats on objects.
- Depth Pro or Depth Anything centimetre error at object scale (only delta-1 at 25%).
- RoomPlan furniture dimension accuracy.

## Searched / could not reach

- WebFetch on developer.apple.com and PMC returned empty or a browser-check page; Apple `.md` pages via curl worked; two Apple paths returned stubs and were not retried.
- OpenAlex keyless search returned results but I read only titles; free-form-versus-guided queries returned unrelated hits (knee brace, UAV review). Treat as no hit, not as proof none exists.
- Luma, Polycam 3DGS and Apple Measure docs not opened; WWDC24 10107 not re-fetched; Expo page not read beyond the grep.

## Sources fetched

- Apple docs (curl, undated): arframe/scenedepth, ardepthdata, arconfidencelevel, arworldtrackingconfiguration, objectcapturesession and its Configuration, displaying-a-point-cloud-using-scene-depth, vngenerateforegroundinstancemaskrequest, roomplan capturedroom (version line only).
- https://pmc.ncbi.nlm.nih.gov/articles/PMC12526706/ (2025-10-04), https://www.mdpi.com/1424-8220/23/18/7832 (2023-09-12), https://rerun.io/blog/arkitscenes-slam, https://www.structuresmmm.org/measurement/lidar, FIG 2022 slide deck (search highlight).
- https://arxiv.org/html/2410.02073 and ICLR 2025 abstract page (search highlight).
- https://www.cs.purdue.edu/xrlab/assets/pdf/popescuARGuidance3DAcquisition_ISMAR2019.pdf, https://www.scitepress.org/Papers/2025/132598/132598.pdf, https://arxiv.org/html/2506.21009, https://doi.org/10.18419/opus-18678, cad-journal.net 10(2) 2013, pixelleddimensions.com (all search highlights).
- Polycam help centre (two articles), Scaniverse techniques page, KIRI Engine (three pages) (search highlights).
- https://docs.expo.dev/modules/native-view-tutorial/ and .../native-module-tutorial/ (curl, grepped).
