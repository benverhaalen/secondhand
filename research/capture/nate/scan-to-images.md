# As of November 2026, how can a LiDAR scan or an Apple Object Capture 3D model of a used item be turned into a set of images good enough for a marketplace listing and for identification, and how does that compare with using the captured photographs themselves?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: capture.

Evidence marks: *observed* (opened, URL given, date where the page shows one), *asserted* (source claims or search excerpt only, or from memory), *inferred* (my reasoning). Apple doc pages show "Copyright 2026 Apple Inc." and no per-page date. Many web items below are search excerpts, not full pages; they are marked *asserted* and "unopened" where so.

## (a) What Object Capture and PhotogrammetrySession hand back

- The app owns the image folder: `ObjectCaptureSession.start(imagesDirectory:configuration:)` takes a directory, and at `.completed` the app can use the images locally or move them to a Mac. *observed*, https://developer.apple.com/documentation/realitykit/objectcapturesession.md (Apple, 2026 copyright).
- A `PhotogrammetrySample` carries `image` (CVPixelBuffer), `metadata`, `depthDataMap`, `depthConfidenceMap`, `gravity`, `objectMask`, `boundingBox`, `captureTime`, `orientation`, `scanPassID`, `camera`. *observed*, https://developer.apple.com/documentation/realitykit/photogrammetrysample.md. `init(contentsOf:)` loads one from a file.
- `camera` holds `intrinsics` (3x3), `transform` (4x4 camera to world, comparable only between samples with the same session id) and `calibrationData`. *observed*, https://developer.apple.com/documentation/realitykit/photogrammetrysample/camera-swift.struct.md.
- WWDC24 session 10107 (2024-06-12): "The most important is the RGB image data, but there can also be a depth map for recovering metric scale, a gravity vector for uprighting, a metadata dictionary of extra information, and of course an optional object mask". *observed*, https://developer.apple.com/wwdc24/10107/.
- Detail levels on iOS 17+; only `.reduced` is available on iOS. *observed*, https://developer.apple.com/documentation/realitykit/photogrammetrysession/request/detail.md.

| Level | Triangles | Approx size | Texture | Maps |
|---|---|---|---|---|
| preview | <25k | 5 MB | 1024x1024 | diffuse, normal, AO |
| reduced (the only iPhone level) | <50k | 10 MB | 2048x2048 | diffuse, normal, AO |
| medium | <100k | 30 MB | 4096x4096 | diffuse, normal, AO |
| full | <250k | 100 MB | 8192x8192 | diffuse, normal, AO, roughness, displacement |
| raw | <30M | n/a | 8192x8192 | diffuse only, not for AR |

- Output formats: USDZ or an OBJ folder. *observed*, https://developer.apple.com/documentation/realitykit/modelfile(url:detail:geometry:).md.
- *inferred*: because the session writes the real frames, each with depth, gravity, intrinsics and a camera-to-world pose, the real frames and any render of the model can be put in one coordinate frame. That makes a "same viewpoint" comparison between a render and a real frame possible without extra estimation.
- *inferred*: on iPhone the captured frames are the highest-resolution output; the model is capped at 2048 px texture.
- Object Capture crash on iPhone 17 Pro with iOS 26.4.2 and 26.5 is already recorded in [spec/features/capture.md](../../../spec/features/capture.md) (line 107 at time of reading); not re-tested here.

## (b) Rendering fixed viewpoints from a USDZ or mesh

On device
- `RealityRenderer`: "A renderer that displays a RealityKit scene in an existing Metal workflow", iOS 18.0+. *observed*, https://developer.apple.com/documentation/realitykit/realityrenderer.md. That it can write a still to a texture without a view was not confirmed (the `updateAndDraw(into:)` page returned 404).
- `ARView.snapshot(saveToHDR:completion:)`: "Takes a screenshot." *observed*, https://developer.apple.com/documentation/realitykit/arview/snapshot(savetohdr:completion:).md. It needs an on-screen view.
- SceneKit and Model I/O offscreen rendering: *not found* in this pass. Whether SceneKit is deprecated: unconfirmed, no claim made.
- Lighting and background are set by the renderer, not the model. *inferred*: the baked diffuse texture keeps the capture lighting (shadows and colour cast), so a render has that lighting plus the new one.

In the cloud
- Blender headless: `-b/--background` "Run in background (often used for UI-less rendering)"; `-f/--render-frame <frame>` renders a frame and saves it; the order with `--render-output` matters. *observed*, https://docs.blender.org/manual/en/latest/advanced/command_line/arguments.html.
- Three.js and Filament offscreen docs: not searched (see Not found).
- *inferred*: a cloud render needs the USDZ uploaded to the Unity Catalog volume, which [spec/features/capture.md](../../../spec/features/capture.md) lines 62-64 already store.

## (c) Gaussian splatting from phone capture

- Springer, Machine Vision and Applications, 2026-11-08: a 3DGS twin from a turntable video, 360 views rendered as training data. On the same rig the video's own masked frames beat the renders by 2.4 points at 10 shots and 6.7 points zero-shot, "because fine thread relief is not reproduced faithfully". In hand-held phone capture under different lighting, surface and viewpoints the order reversed: renders led by 11.7 points zero-shot. 18-part self-collected dataset, frozen DINOv2, industrial parts. *asserted* (search excerpt, unopened), https://link.springer.com/article/10.1007/s00138-026-01945-3.
- Scaniverse runs splat, LiDAR and photogrammetry modes on device without internet. Polycam blog (2026-10-12) lists exports OBJ, FBX, GLB, USDZ, LAS, PLY, SPZ. *asserted*, unopened.
- Niantic Spatial Capture: SPZ cuts file size by about 90%; meshes export to GLB or USDZ. *asserted*, unopened.
- Luma export formats conflict: one 2025-01-31 source says GLTF, OBJ, USDZ, SPLAT, PLY; a 2026-06-01 comparison says GLB, USD, OBJ, MP4. *asserted*, both unopened, unresolved.
- Earlier searches found accuracy papers (ICVR 2025) and a 2026 weakness report on hand-held objects (NVS-HO). *asserted*, unopened.
- *inferred*: a splat renders novel views of regions the camera covered; where coverage is thin it shows floaters and blur, not a clean image.

## (d) Novel-view synthesis and image-to-3D

- Know3D, arXiv 2603.22782: unseen regions in image-to-3D are "stochastic and difficult to control", with implausible geometry; compares Hunyuan3D-2.1, TRELLIS.2, TRELLIS, Step1X-3D, Hi3DGen, Direct3D-S2. *asserted*, excerpt.
- Sorceress blog, 2026-06-30: "Every image to 3D model generator in 2026 still hallucinates the back of the subject" from a single front view; features under about 1 cm at character scale are softened; only Tripo v3.1 of those benchmarked has a multi-view mode. *asserted*, excerpt.
- microsoft/TRELLIS issue 170 (2025-02-02): the model "can't tell from the picture where the front is and where the back is and makes it up". *asserted*, excerpt.
- Hwan Heo blog (2025-03-02): texture quality is not yet high for Hunyuan or TRELLIS; Hunyuan generates 6 views and back-projects. *asserted*, excerpt.
- *inferred*: any model that fills in a side nobody photographed produces content that is not the person's item. Against [spec/features/studio.md](../../../spec/features/studio.md) line 4 and the table at lines 17-24 ("Invent parts, accessories or completeness", "add a pose nobody photographed") this is the same prohibited class, whatever the model.

## (e) Choosing the best real frames

- iVS3D, arXiv 2110.11810: sharpness from Tenengrad or variance of the Laplacian compared with a window average; a blurred frame is swapped for a sharper neighbour; redundant frames dropped by optical flow; 1 fps sampling; redundancy filtering saved 8.1% of the time. *asserted*, excerpt.
- 3DGS PR 348: drop frames with Laplacian variance below mean minus one standard deviation; blurred frames can still help pose estimation, so filter after COLMAP. *asserted*, excerpt.
- Risto Ojala, 2025-01-06: the Laplacian threshold is scene dependent; take the sharpest frame per chunk of 10; sharpness mode rose from under 100 to about 200. *asserted*, excerpt.
- G-Frames (Zenodo, 2026-10-26): the smallest set of sharp frames that keeps a target overlap, via Lucas-Kanade optical flow. *asserted*, excerpt.
- TopShot: blur, motion and perceptual-hash duplicates, plus manual review. *asserted*, excerpt.
- *inferred*: Object Capture already gives each frame a pose, so viewpoint clustering (pick the sharpest frame per angular bin) needs no extra pose estimation. Apple's feedback states (`movingTooFast`, `objectTooClose` and others) are listed in [research/measure/ben/object-capture.md](../../measure/ben/object-capture.md) line 7.

## (f) Background removal and consistent backgrounds

- Vision `VNGenerateForegroundInstanceMaskRequest`: iOS 17+, class-agnostic, soft mask at source resolution; `generateScaledMaskForImage`; apply with Core Image `blendWithMask`, which preserves HDR; Vision output is SDR. *asserted*, WWDC23 10176 notes via the WWDCNotes GitHub, unopened.
- SAM 3 (Meta, 2025-11-19): concept prompts (text, exemplars); LVIS zero-shot mask AP 48.8 against 38.5; 30 ms per image on an H200. *observed* page https://ai.meta.com/research/publications/sam-3-segment-anything-with-concepts/ for the release; the numbers are *asserted* from arXiv 2511.16719 excerpt.
- BiRefNet: named in [research/studio/ben/build-plan.md](../../studio/ben/build-plan.md) as a fallback; not searched here.
- Object Capture samples carry their own `objectMask` field (see (a)). *observed*.
- *inferred*: a mask can be used to place the item on a plain or consistent background in either a real frame or a render. For a real frame this is a background change, which Etsy treats as an AI edit on the unedited photo (see (i)) and which [spec/features/studio.md](../../../spec/features/studio.md) line 22 allows only as "cleanup inside the rule", keeping the surface and place.

## (g) What the 3D texture loses against a photo

- iPhone `.reduced` texture is 2048x2048 for the whole object atlas (see (a)). *observed*. *inferred*: the atlas is shared by all surfaces, so a label, tag or logo gets a fraction of those pixels, far below a single full-resolution frame.
- Hurst et al., PMC11637407 (2024-12-12): Object Capture models were within 1 mm in measurement accuracy; a scale covering most of the object was needed; 6 of 33 objects (18%) needed masking. Its table gives reduced as 25,000 polygons at 2048 and medium as 100,000 at 4096; Apple's page says reduced <50k, so the two differ. *asserted*, excerpt.
- Poly Haven dev log 18 (2023-10-12): photogrammetry of fabric or low-height surfaces gives a "lumpy mess" of imagined height. *asserted*, excerpt.
- Fibbl (2026-06-16): stitching and mesh weaves introduce errors in photogrammetry for e-commerce. *asserted*, excerpt.
- Karami et al. 2022: shiny and featureless surfaces give noisy results. ISPRS 2019: a 50 mm lens did not reconstruct the smallest details; the iPad camera was least accurate. *asserted*, excerpts.
- Apple's own limits: thin, reflective, transparent, translucent, single-colour smooth, and "soft, articulated, or bendable" objects are poor inputs. *observed* via [research/measure/ben/object-capture.md](../../measure/ben/object-capture.md) line 11, which cites Apple's capture page.

## (h) Identification on rendered views versus real photos

- Springer 2026 (see (c)): real masked frames beat renders on a fixed rig; the order reversed under changed hand-held conditions. *asserted*, excerpt. Parts, not used goods.
- TAMM (CVPR 2024): CLIP is trained on natural images; rendered or projected images "usually lack a realistic background and texture", a domain shift. *asserted*, excerpt.
- AI City 2022 track 4, arXiv 2207.05422: trained on synthetic renders of scanned products and tested on real video, F1 40%. *asserted*, excerpt. DiffCLIP and Point2Real describe the same gap, *asserted*.
- *not found*: any study of identifying a used consumer item from renders of a phone scan versus real photos of the same item.
- *inferred*: tag text, label print and logo reading depend on pixels, so the real frames (with the full-resolution sensor image) are the input for any OCR or logo match; a 2048 px atlas is not.

## (i) Marketplace rules on rendered, edited, AI images and on 3D, 360 or video

eBay
- Images policy: use your own images; "truthful, accurate"; pre-owned vehicles need images of the actual vehicle. *asserted*, excerpt of https://www.ebay.com/help/policies/listing-policies/images-videos-text-policy?id=4240 (unopened in full).
- Video: one per listing, .mp4 or .mov (the page contradicts itself on formats), 150 MB, about 1 minute; upload up to 1080p, output 240p to 720p; reviewed within 48 hours or up to 7 business days at peak; no YouTube links; no video on listings with variations. Videos are rejected for blur, distortion, links, contact info and personal information. *asserted*, excerpt of https://www.ebay.com/help/selling/listings/creating-managing-listings/add-video-to-listing?id=5272.
- A 3D or 360 spin media type for eBay: *not found*. An eBay Seller Centre AU page suggests "Capture full 360-degree views" for store videos only, *asserted*.

Etsy
- At least one unedited photo of the actual item on a real background, not necessarily first; videos do not replace it. If you crop, resize or watermark that photo, "make sure you're not using AI-powered tools" or it may be flagged as AI-edited. Prohibited: hiding flaws, changing colour, texture or condition. Other images may use AI tools if the product stays accurate, including cleaning or replacing the background. *asserted*, excerpt of https://www.etsy.com/legal/policy/listing-image-requirements/253962679005.
- Videos: up to 2, 3 to 15 s, no audio, 100 MB, minimum 500 px, aspect ratio written as 2:1 or 1:2. *asserted*, excerpt of https://help.etsy.com/hc/en-us/articles/360053206073-How-to-Add-Listing-Videos.
- This sharpens [spec/features/studio.md](../../../spec/features/studio.md) line 87 ("one unaltered photo of the real item on a real background", marked asserted, unopened): in the excerpt the unedited photo is also barred from AI-powered crop, resize or watermark tools.

Depop, Poshmark, Mercari, Facebook
- Depop: sources conflict on whether its guidance names AI images (Photomop says yes; Vendy Studio says no platform names AI). Unresolved, both secondary.
- Poshmark and Depop primary quotes: not obtained.
- Mercari Japan: an earlier excerpt looked primary; exact wording was not re-confirmed, so no quote is given.
- Facebook Marketplace: not searched.

## (j) Shipped examples

- Shopify Help Center: 3D models GLB or USDZ, up to 500 MB; over 15 MB they are optimised; GLB and USDZ versions are both produced; theme support needed; images up to 5000x5000 px, 25 MP, 20 MB. *asserted*, excerpt of https://help.shopify.com/en/manual/products/product-media/product-media-types.
- A Shopify expert page cites a GLB of about 4 MB, at most 15 MB, with a review checklist: does the model match the photos, are scuffs, logos and text legible. *asserted*, excerpt, unopened.
- Amazon Seller Central forum (2024-10-29 and 2025-05-22): GLB or GLTF with accurate dimensions; models that do not accurately depict the product "may be rejected"; upload is for the registered brand owner only; review about 2 to 3 weeks; the Seller app scans on iOS; View in 3D replaces legacy View 360; exceptions include TVs, rugs, carpets, wall art, headphones. *asserted*, community posts, not Amazon policy pages.
- Amazon 360 spin (forum post 2020-03-15): 24, 48 or 72 images (post says 5-degree steps), elevation 10 to 30 degrees, square PNG 1500 to 2500 px, background removed; "photo realistic renderings from 3D models" accepted; only Amazon uploads. *asserted*, old and a forum post.
- Maverickframe (2026-07-31, secondary): Amazon limit 200,000 triangles, 2K to 4K textures. *asserted*.
- Polycam help: free plan exports GLTF only; paid adds OBJ, FBX, GLTF, DAE, STL, USDZ; images from LiDAR Space mode are accessible only on the original device with Developer Mode; photogrammetry and Gaussian splat modes exist. *asserted*, excerpt of https://learn.poly.cam/hc/en-us/articles/27756102599572-What-File-Types-Can-Polycam-Export.
- *inferred*: every shipped commerce use found is seller-side brand 3D or a model shown beside photos (Shopify, Amazon); none found is a used-goods marketplace listing built from a phone scan.
- IKEA Kreativ and car-listing spin tools: not searched.

## Real frames versus renders by item class (*inferred*)

Classes follow [research/capture/nate/adaptive-capture.md](adaptive-capture.md) section 9 and the table in [research/measure/ben/object-capture.md](../../measure/ben/object-capture.md) lines 16-21.

| Class | Object Capture input fit | Listing images | Why |
|---|---|---|---|
| Flat garments | Poor (soft, bendable) | Real frames | Weave, print and seams are lost or invented in a mesh; renders would not apply |
| Shoes and bags | Good if rigid | Both: real frames for the listing, renders as an added angle only if checks pass | Sole wear and stitching sit under the 2048 px atlas; the real frames carry them |
| Rigid small items | Good | Both | Bounding box helps size; tags and printed text need real frames |
| Furniture | Good for shape, large for the atlas | Both | Texture per area is lower than for small items |
| Electronics | Good, but screens and glossy parts are reflective | Real frames for screens, ports, labels; renders optional for shape | Reflective and text regions fail in meshes |
| Reflective or transparent (glass, chrome) | Poor | Real frames | Apple lists these as poor input; LiDAR is unreliable on glass and mirrors |

## Checks that stop a render from misrepresenting the item (*inferred*, built on the studio table)

Reuse the checks at [spec/features/studio.md](../../../spec/features/studio.md) lines 66-79 and add render-specific ones:
1. Coverage: every surface in the render was seen by at least one real frame; a face with no frame is not rendered (no hallucinated side).
2. Pose agreement: the render, placed at the pose of a real frame, matches that frame (alignment and per-tile structure checks).
3. Colour: CIEDE2000 against the real frame, as in the studio table.
4. Protected boxes: each logo, tag and flaw box the person confirmed is present in the render at legible size; a vanished flaw is a hard reject (studio line 79).
5. Text legibility: OCR on the render against OCR on the real frame; letters differ means reject.
6. Resolution: the render's effective pixels over any protected box are not below the box's pixels in the real frame.
7. Provenance: a render carries a stored label (in the record, never in the pixels) and is never the only photo of the item.
8. Reference photo kept: at least one untouched real frame stays in every listing (Etsy's rule, (i)).

## Where this confirms, extends or contradicts existing notes

- Extends [research/measure/ben/object-capture.md](../../measure/ben/object-capture.md) lines 26 and 33-35: those left the captured-frames-as-references idea, USDZ web view and the 3DGS and image-to-3D alternatives unverified; this note supplies Apple's per-frame data (a), detail table (a), splat and image-to-3D evidence (c, d).
- Confirms the same note's line 11 (soft and reflective objects are poor inputs), with extra sources in (g).
- Extends [research/capture/nate/adaptive-capture.md](adaptive-capture.md) (depth at 256x192, section 9 classes): adds what the frames carry and the real-versus-render split by class.
- Extends [research/capture/ben/live-video-capture.md](../ben/live-video-capture.md): its after-pass cuts frames from video (`from_video`); (e) lists the sharpness and key-frame methods that apply to that cut.
- Confirms [spec/features/capture.md](../../../spec/features/capture.md) lines 62-64 and 130 (Object Capture on device, USDZ stored, LiDAR needed).
- Extends [spec/features/studio.md](../../../spec/features/studio.md) lines 81-88: fills Etsy (excerpt, not the full page) and notes that eBay, Etsy and Amazon all require accuracy; Depop, Poshmark, Mercari and Facebook stay open.
- Contradicts nothing found, except a detail: studio line 87 omits that Etsy bars AI tools on the unedited photo even for crop, resize or watermark.
- Differs from [research/studio/ben/build-plan.md](../../studio/ben/build-plan.md) only in scope: that note covers edit models on a real photo; this one covers renders from a model. Its Photoroom 28 to 29% figure concerns edit models, not renders, and should not be applied to renders without a test.

## Searched / could not reach

Searched with Exa web search and Apple docs by curl: Apple RealityKit pages, WWDC23 and WWDC24 pages, the Blender manual, eBay, Etsy, Shopify, Amazon forum, Polycam and Meta SAM 3 pages, and arXiv, Springer and PMC excerpts. WebFetch returned empty pages for developer.apple.com, so curl on `.md` URLs was used. Not reached or only excerpted: full text of the eBay, Etsy and Shopify pages (search excerpts), Depop and Poshmark primary rules, Facebook Marketplace rules.

## Not found

- Offscreen still rendering with SceneKit, Model I/O, Three.js and Filament: not searched; RealityRenderer still output unconfirmed.
- Object Capture reconstruction time on iPhone: not published in what was read.
- WWDC25 and WWDC26 Object Capture changes: not found (same as [object-capture.md](../../measure/ben/object-capture.md) line 12).
- Identification accuracy on renders of phone scans of used items versus real photos: no study found.
- Facebook Marketplace, Poshmark and Depop primary rules on edited, AI or 3D images; Depop AI wording conflicts between secondary sources.
- IKEA Kreativ and car-listing spin tools: not searched.
- eBay, Etsy, Poshmark, Depop, Mercari, Facebook support for 3D model upload: no sign found for any of them; absence in the search is not proof.
- BiRefNet performance: not searched.

## Sources fetched

Opened by curl, observed:
- https://developer.apple.com/documentation/realitykit/objectcapturesession.md
- https://developer.apple.com/documentation/realitykit/photogrammetrysample.md
- https://developer.apple.com/documentation/realitykit/photogrammetrysample/camera-swift.struct.md
- https://developer.apple.com/documentation/realitykit/photogrammetrysession/request/detail.md
- https://developer.apple.com/documentation/realitykit/modelfile(url:detail:geometry:).md
- https://developer.apple.com/documentation/realitykit/realityrenderer.md
- https://developer.apple.com/documentation/realitykit/arview/snapshot(savetohdr:completion:).md
- https://developer.apple.com/wwdc24/10107/
- https://docs.blender.org/manual/en/latest/advanced/command_line/arguments.html
- https://ai.meta.com/research/publications/sam-3-segment-anything-with-concepts/

Seen as search excerpts only (unopened in full): the Springer, arXiv, PMC, eBay, Etsy, Shopify, Polycam, Amazon forum, Poly Haven, Fibbl, Sorceress, TRELLIS issue 170, iVS3D, G-Frames and other pages named above.
