# How accurately can a flat-laid garment's measurements (pit to pit, length, sleeve, waist, inseam) and a rigid item's dimensions be taken from phone photos, with and without LiDAR, and which commercial tools and open models report measured accuracy?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: measure.

Short form: published accuracy for garments is thin. The one error that reaches the ±1.3 cm primary budget with LiDAR is a 2022 peer-reviewed paper at 1.59% and 2.08% relative error; every non-LiDAR figure found is a vendor claim or an anecdote. No source found reports pit-to-pit, sleeve or inseam error separately for a phone-photo pipeline without LiDAR.

## What the existing notes already say (confirm, extend, contradict)

- Scale and points are separate problems: confirmed by every source below (build-plan.md line 12 [../ben/build-plan.md](../ben/build-plan.md)).
- Size AI "about 5 mm with LiDAR, about 9 mm without" is *asserted* in [measuring-garments.md](../ben/measuring-garments.md) line 10 and build-plan.md line 42, and spec measure.md line 118 repeats it as *asserted*. Extended: I opened the vendor pages again and found no test setup, sample size or reference method (section 1). Still a vendor claim; no independent validation found.
- build-plan.md line 41 (Luetzenburg, iPhone 12 Pro LiDAR, ±1 cm above 10 cm): not re-opened here; the rigid-item row below relies on it.
- build-plan.md line 63 (arXiv 2610.27199 Jetson benchmark, Middlebury AbsRel Depth Pro 12.0%, MoGe-2-L 19.2%, UniDepth V2-L 20.5%): not re-opened here, unopened this session. My indoor numbers in section 3 come from the model papers themselves and use different datasets, so they extend rather than repeat it.
- measuring-garments.md line 26 "Card scale is good enough for pit-to-pit and length" is *inferred* there. build-plan.md line 229 already changed this. Section 4 adds the only measured card or ArUco result I found for garments (a 10 cm ArUco marker, 6.36% mean error for tops before a correction network), which supports the build-plan's "never trusted without a cross-check".
- measuring-garments.md line 21 DeepFashion2 landmark claims were "from memory"; section 5 gives the paper's number.
- adaptive-capture.md section 4 (photo-only metric scale; [../../capture/nate/adaptive-capture.md](../../capture/nate/adaptive-capture.md) lines 34-38) says no 1 cm scale from monocular depth: confirmed by section 3 (best indoor AbsRel in the model papers is 6.8%).
- The budget ±1.3 cm primary and ±2 cm secondary (build-plan.md line 194) is the yardstick I compare against; "inferred" there.
- object-capture.md lines 8 and 11: depth-based metric scale, clothing excluded. Not tested here; I found no published Object Capture dimensional error.

## 1. Garment-measurement apps and SDKs: published error

- Size AI, *observed*, https://sizeai.co/guides/capture and https://sizeai.co/guides/garments (undated pages): the vendor states about 5 mm typical with LiDAR and about 9 mm without, longer measurements worse. No sample size, reference or protocol was on the pages. This is *asserted* by the vendor, not shown.
- Size AI independent validation: not found (search for a third-party or peer-reviewed test returned nothing).
- Apple Measure, *observed*, search snippet only from https://measuringtape.app/guides/can-i-use-my-phone-as-a-tape-measure/ (2026-10-21): the page says Apple publishes no accuracy figure and tabulates other people's tests: Borz et al., Forests 2022, 467 logs about 3 m, LiDAR iPhones, average error 1.8 and 1.5 cm; Lifehacker 2018, iPhone 8 Plus (no LiDAR), small items exact or within 1/2 in, larger objects up to 3 in off. These are the page's reports of other studies; I did not open those studies, so they are *asserted* secondhand.
- Apple Measure, *observed*, https://venturebeat.com/technology/apples-ios-12-measure-app-is-good-enough-ai-assisted-ar-really-good-enough (2018-06-08, old, iOS 12): a reviewer's objects measured off by 0.25 in at a thermostat (3.0 in) up to 8 in on a distant painting. Anecdote, dated.
- Apple Measure, *observed*, https://appleinsider.com/articles/18/06/11/hands-on-with-the-new-arkit-measure-app-in-ios-12 (2018-06-11): "usually falling within an eighth of an inch". Anecdote, dated; the two 2018 reviews disagree.
- TapeAR, Tailored, SmartSizer: no accuracy found beyond [measuring-garments.md](../ben/measuring-garments.md) lines 11 to 14.
- MeasureKit, Moon, other Tailor-style apps: no published accuracy found. Not found.

## 2. Body-measurement vendors (methods only)

- 3DLOOK, *observed*, https://3dlook.ai/?p=44386 (published 2026-07-03, modified 2026-10-30): internal validation against expert pattern-maker manual measurements gives "typical absolute error generally in the 1.5-2.0 cm range" and "approximately 96-97%" accuracy; five repeated scans per participant gave scan-to-scan differences "typically less than 1 cm" for most measurements; a separate ISO 8559-1:2017 benchmark (3D scanner averages as reference) gave session-to-session repeatability of 0.40 cm. The page states no peer-reviewed publication specific to its accuracy exists, and that sample size and per-measurement results are not given. Population: ages 16 to 78, heights 150 to 220 cm, weights 38 to 210 kg. This is body, two photos, not garments.
- Bodygram: no published accuracy method found. Not found.

## 3. Monocular metric depth models, indoor absolute error

Observed from arXiv HTML. Zero-shot unless stated. AbsRel (ARel) is a percentage of true depth, so at 1 m, 6.8% is about 68 mm, against a 13 mm budget.

- UniDepthV2, *observed*, https://arxiv.org/abs/2502.20110 (HTML fetched 2026-11-14), Table I, zero-shot indoor, SUN RGB-D: UniDepthV2-Large δ1 96.4, ARel 6.8; Depth Pro δ1 83.1, ARel 13.3; Metric3Dv2 δ1 81.2, ARel 13.3 (needs ground-truth camera); UniDepth V1 δ1 94.3, ARel 10.4. On IBims-1, UniDepthV2-Large δ1 94.5, ARel 7.8; Depth Pro δ1 82.3, ARel 17.0 (column assignment read from flattened table text, inferred). TUM-RGBD row is ambiguous in the flattened table, not reported.
- UniDepthV2 Table V, NYU validation, models trained or fine-tuned on NYU (not zero-shot): UniDepthV2-Large ARel 4.68, Metric3Dv2 4.70, Depth Anything V2 5.60. Fine-tuned in-domain, still about 4.7%.
- MoGe-2, *observed*, https://arxiv.org/abs/2507.02546 (HTML fetched 2026-11-14), Table 2, averaged over 7 datasets, depth (relative error Rel d, lower better): UniDepth V2 21.3, Depth Pro 27.6, MoGe-2 ("Ours") 15.7; with GT camera, Metric3D V2 18.3, UniDepth V2 18.5, MoGe-2 13.6; point-map Rel p: MoGe-2 8.19, UniDepth V2 10.1, Depth Pro 13.7.
- Depth Anything V2 metric: in the UniDepthV2 table above, NYU fine-tuned ARel 5.60. A zero-shot Depth Anything V2 metric figure appears in MoGe-2 Table 2 only as Rel d 29.9 (the V2 row has no point-map entries). Its own paper (https://arxiv.org/abs/2406.09414, fetched) was downloaded but I did not extract a metric-depth table from it; the metric fine-tuned numbers there are not reported here.
- Apple Depth Pro: figures appear only inside the two papers above (competitor tables), not from Apple's own paper. Own paper unopened.
- Reading: the best zero-shot indoor ARel in these tables is 6.8% (SUN RGB-D) and 15.7 to 29.9 averaged across 7 datasets. *Inferred*: none gets a 1 cm scale at 1 m from depth alone, consistent with adaptive-capture.md section 4. These error values are for scene depth, not object length; scale from a plane would be a different error source.

## 4. Reference-object scale (card, A4, ArUco)

- Garment-measuring system with a 10 cm ArUco marker, *observed*, Kowaleczko et al., FedCSIS 2022 communication papers, https://annals-csis.org/Volume_32/drp/pdf/8.pdf (2022): pixel-to-cm ratio from a 10 cm ArUco marker measured by a human operator; reported mean percentage error 6.36% (SD 5.24) for tops and 4.56% (SD 3.30) for skirts before an error-correction neural network, reduced to 4.10% (3.30) and 4.20% (3.44) after; correction applied to 66.4% (tops) and 69.2% (skirts) of dimensions. The paper counts 76 of 900 pictures rejected. 6% of a 50 cm pit to pit is about 30 mm. This is a different pipeline to the build-plan's homography plus mask; it is the only measured ArUco garment figure found, and it contradicts any reading of marker scale as 1 cm good by itself.
- Credit card or A4 homography accuracy on flat items: no published mm figure found. build-plan.md lines 105 and 106 and FitTag (line 24) have the project's own numbers (card reject rule 3%, known-length error 17.7% to 2.3% median in synthetic tests, *observed* there, not re-opened).
- ChArUco accuracy: no flat-lay figure found. Not found.

## 5. ARKit plane detection scale error without LiDAR

- *observed*, https://stackoverflow.com/questions/76002801/non-lidar-device-accuracy-in-arkit (2023-04-13): a developer reports an iPhone 11 (no LiDAR) places nodes poorly on planes in a sample app, whereas Apple's Measure app does it correctly. Anecdote, no error number.
- measuringtape.app (2026-10-21): says tests on non-LiDAR phones show "up to a few percent in quick tests"; that is the site's own summary, *asserted*, and the site says it ran no test of its own.
- No peer-reviewed plane-scale or world-tracking error for non-LiDAR iPhones measured on a flat surface at about 1 m was found. build-plan.md line 104 (plane first, no LiDAR) therefore has no independent accuracy number behind it in what I opened. Not found.

## 6. Garment landmark datasets and keypoint accuracy

- DeepFashion2, *observed*, https://arxiv.org/abs/1901.07973 (PDF text fetched 2026-11-14, paper dated 2019): 801K clothing items, dense landmarks and masks; the baseline's landmark estimation reaches "AP of just 0.563", described in the paper as showing clothes landmark estimation "could be even more challenging than human pose estimation in COCO". AP is a keypoint-similarity score, not centimetres.
- Kim et al., Konkuk University, Appl. Sci. 12(10):5286, *observed*, https://www.mdpi.com/2076-3417/12/10/5286 (2022-05-23, fetched via Exa): keypoint model on 2D images plus LiDAR point cloud from a mobile device; "1.59% and 2.08% of the average relative error" in two environments. Percent of garment dimension, so on a 50 cm pit to pit about 8 mm and 10 mm (*inferred*).
- Paulauskaite-Taraseviciene et al., Appl. Sci. 12(9):4470, *observed*, https://www.mdpi.com/2076-3417/12/9/4470 (published 2022-04-28): UNet mask plus rule-based key points; "average 1.27 cm measurement error" for blazers, 0.747 cm for dresses, 1.012 cm for skirts. The abstract does not state how scale was set; not checked in the body.
- FitTag and GarmentIQ (HRNet on DeepFashion2): errors are in [build-plan.md](../ben/build-plan.md) lines 24 and 26, not repeated.
- FashionAI and other landmark sets: no keypoint accuracy extracted. Not found.

## 7. Rigid items

- Luetzenburg et al. iPhone 12 Pro LiDAR ±1 cm above 10 cm: *observed* by Ben in build-plan.md line 41 and Nate in adaptive-capture.md line 14; not re-opened.
- Hamilton-Fletcher et al., IEEE 2024: per the measuringtape.app page (secondhand, *asserted*), iPhone 13 Pro LiDAR distance to a door at 1 to 3 m averaged 0.5 to 1.4 cm error, worse toward image edges. Original unopened.
- Object Capture bounding-box error: not found.
- Non-LiDAR rigid dimensions from photos: only the monocular-depth tables in section 3 and the Size AI claim.

## Not found

- Independent validation of Size AI, TapeAR, Tailored, SmartSizer, MeasureKit, Moon.
- A published error for Bodygram, or 3DLOOK per-measurement values and sample size.
- A mm or percent error for card or A4 homography scale on flat-laid garments; any ChArUco figure.
- A peer-reviewed non-LiDAR ARKit plane or world-tracking scale error at garment distance.
- Pit-to-pit, sleeve or inseam error reported separately by any phone-photo pipeline.
- Depth Pro's own paper numbers; Depth Anything V2 metric table values; arXiv 2610.27199 re-check.
- Object Capture dimensional accuracy.
- FashionAI keypoint accuracy.

## Sources fetched

Fetched and read (observed): https://sizeai.co/guides/capture, https://sizeai.co/guides/garments, https://3dlook.ai/?p=44386, https://arxiv.org/abs/2502.20110, https://arxiv.org/abs/2507.02546, https://arxiv.org/abs/1901.07973 (PDF), https://annals-csis.org/Volume_32/drp/pdf/8.pdf, https://www.mdpi.com/2076-3417/12/9/4470 (Exa fetch, abstract only), https://www.mdpi.com/2076-3417/12/10/5286 (Exa fetch, abstract only).
Search snippets only (not opened in full): measuringtape.app guide, VentureBeat 2018, AppleInsider 2018, Stack Overflow 76002801, PMC10181530 (TrueDepth face distance, not used).
Opened but not used: https://arxiv.org/abs/2406.09414 (Depth Anything V2), https://arxiv.org/abs/2410.02073 and 2510.25760 (downloaded earlier, no figure extracted).
Unopened: the Borz Forests 2022, Hamilton-Fletcher IEEE 2024, Lifehacker 2018 studies as cited secondhand; arXiv 2610.27199.

## Searched / could not reach

Searched for third-party Size AI tests, Apple Measure studies, ARKit non-LiDAR plane scale papers, 3DLOOK and Bodygram published error, ArUco and ChArUco flat-lay mm error, MeasureKit and Moon claims: only vendor claims, snippets and anecdotes came back. The MDPI pages via curl returned about 400 bytes (blocked), so only Exa's abstract and introduction were read, not the results tables. A narrow search does not prove the missing items do not exist.
