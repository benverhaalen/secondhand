# Photo engine: an imaging lead's read of spec/engines/photo.md

Researched 2026-11-14 by Nate's session `ex-ph` (Claude Code). Feature: studio, list. The view taken: a photo-ops lead who has run listing-image pipelines at a resale marketplace. Read in full: [spec/engines/photo.md](../../../spec/engines/photo.md), [photo-score.md](../../studio/ben/photo-score.md) with its [prototype](../../studio/ben/prototype/photo_score.py), and [platform-fit.json](../../list/ben/platforms/platform-fit.json). Web sources fetched today. Marks: *observed* (read at the source today), *asserted* (a source says it, not checked at the primary), *inferred* (my reasoning from the cited facts).

Nothing here was run. The machine limits on this pass allowed web reads and file reads only, so every threshold below is a starting value to be measured on the frozen fixture (spec §9), not a measured result.

## Short answer

The engine is sound on order, cap and gates. It misses five things that will bite in the first week:

1. **eBay bans watermarks "of any type"**, so any visible export tag is banned there. `export_mark` can only ever write metadata.
2. **Etsy's unedited photo cannot have its lighting changed.** Level 0 (white balance and exposure) is not "unedited" for Etsy. Etsy needs a raw-pixel version: crop and resize only.
3. **The AI tag has no stated value.** The rule should be: a photo the person took, at level 0, carries no DigitalSourceType at all. A model edit carries `compositeWithTrainedAlgorithmicMedia`. A full render carries `trainedAlgorithmicMedia`.
4. **The export has three silent failure modes**: a sideways photo (EXIF orientation dropped before it is applied), shifted colour (an iPhone Display P3 profile dropped without converting to sRGB), and personal data that sits in the pixels, not the EXIF.
5. **The near-duplicate rule (cosine above 0.95) has no model named and no scope.** It needs a cheap hash pre-filter and must run only inside a role bin, never across bins.

## (a) What the engine must determine, against §1's table

§1 lists six outputs. These are all the determinations a listing-photo pipeline makes. A tick means §1 covers it.

| # | Determination | In §1? | Note |
|---|---|---|---|
| 1 | Upright orientation of every frame | no | must happen first: hashes, masks and crops all assume it (see (b) 1) |
| 2 | The colour space of the working and the exported pixels | no | phones shoot Display P3; the sites show sRGB (see (b) 2) |
| 3 | Retake: is a frame too blurred, dark or blown to use at all | partly | the score has sharpness and clipping parts but no hard floor that sends the person back |
| 4 | The kept frames, near-duplicates dropped | yes | the method and scope are missing (see (b) 4) |
| 5 | The quality score | yes | fine as a ranker; it is not a gate |
| 6 | Cover gate per site | partly | eBay text and border is there; eBay watermark, Etsy unedited photo and Depop own-photo rules are not |
| 7 | Order and count per site | yes | |
| 8 | Crop and export size per site | yes | the minimum size per site (eBay 500 px longest side) is missing |
| 9 | Which pixel version each site gets | yes | needs a fourth version, `raw`, for Etsy |
| 10 | The provenance tag written into each exported file | partly | `export_mark` names the policy but not the value written or where |
| 11 | What is stripped from each exported file | partly | EXIF only; also XMP, IPTC, comments, maker notes, thumbnails, a vendor's C2PA manifest |
| 12 | Personal data in the pixels: faces in the background, mail with an address, a house number, a screen | no | a stripped file can still show where the person lives |
| 13 | Route on Generate | yes | |
| 14 | Gates on a render | yes | |
| 15 | File format and quality per export | no | JPEG quality and chroma subsampling decide whether fine flaws survive |

## (b) The best method for each, with sources

**1. Orientation.** Apply the EXIF orientation to the pixels before anything else, then drop the tag. A 90-degree turn moves a 64-bit perceptual hash by 29 to 34 bits, the same as an unrelated photo, so a sideways frame never dedupes and never crops right *observed* ([sxz.io measurement](https://sxz.io/perceptual-hashing-duplicate-images-python-tutorial/)). The usual call is `PIL.ImageOps.exif_transpose(img)` *asserted* ([mojoauth guide](https://mojoauth.com/security-guides/phash-in-python)).

**2. Colour space.** Pillow writes an ICC profile into a JPEG only when one is passed; without it "the image will be saved with no profile attached" *observed* ([Pillow 13.0 formats](https://pillow.readthedocs.io/en/stable/handbook/image-file-formats.html)). So a Display P3 photo saved bare is read as sRGB and its colours shift *inferred*. Convert to sRGB once at ingest (Pillow `ImageCms`), work in sRGB, and export with no profile or an sRGB one. This matters for the item's true colour, which the cover rule depends on *inferred*.

**3. Retake floor (blur, exposure, clipping).** The cheap standard is the variance of the Laplacian (Pech-Pacheco et al., ICPR 2000): a 3x3 Laplacian, then the variance; below a threshold is blurry *observed* ([PyImageSearch](https://pyimagesearch.com/2015/09/07/blur-detection-with-opencv/)). The usual 100 is dataset-dependent and "quite subjective" *observed* (same page); an OpenCV forum answer says it works best to guide toward a maximum, less well as pass or fail *observed* ([OpenCV forum](https://forum.opencv.org/t/scoring-the-clarity-of-an-image/16268)). The method for us *inferred*:
- measure on the item mask, on a grey image resized to 1080 px long side (the prototype already does both, [photo_score.py](../../studio/ben/prototype/photo_score.py) `measure()`), so the number does not move with phone resolution;
- relative rule inside a capture: drop a frame whose variance is under 0.5 times the best frame in its bin;
- absolute floor: start at 100 on the 1080 px grey image, then set it from the fixture as the value that separates frames the team calls blurred;
- runs in numpy alone: a 3x3 convolution is four shifted array adds; no GPU, no OpenCV needed.
No-reference IQA models (BRISQUE, NIQE, MUSIQ) cost a model and add little over this for "is it in focus" on a phone photo *inferred*; keep them out of the hot path.

**4. Near-duplicates.** Two steps, both inside one role bin *inferred*:
- **Hash first.** dHash (64-bit, grey resize to 9x8, compare neighbours) is pure Pillow and numpy. pHash keeps the low 8x8 DCT block of a 32x32 grey image *observed* ([mojoauth](https://mojoauth.com/security-guides/phash-in-python)). Thresholds in the sources: "around 10 of 64 bits is a common starting point" *asserted* (mojoauth); 6 bits is conservative and real variants topped out at 12 bits while unrelated images sat at 28 to 37 *observed* ([sxz.io](https://sxz.io/perceptual-hashing-duplicate-images-python-tutorial/)); pHash.org gives T=22 for distorted copies of the same image *observed* ([pHash design](https://phash.org/docs/design.html)). Use Hamming 10 or under on 64-bit dHash as "same shot".
- **Then the embedding, for different shots of the same view.** A hash catches burst frames and re-saves, not a second angle. For those, keep §3's embedding cosine, but name the model and calibrate the cut on the fixture: a cosine cut is a property of one model, not a constant *inferred*.
- **Never across bins.** A flat-lay front and back of one garment on one floor share their coarse light and dark layout, which is what a hash and a whole-image embedding measure, so a cross-bin dedupe can drop the back *inferred*. Card 21 already keeps one frame per bin; the dedupe only chooses within the bin.

**5. Cover gate per site.** The rules read today:
- eBay bans "Photos with added borders", "Photos with added text, artwork or marketing material", "Watermarks of any type, including those used for ownership attributions", stock photos for used items, and photos that "don't accurately represent the item"; photos "must be at least 500 pixels on the longest side" *observed* ([eBay picture policy](https://www.ebay.com/help/policies/listing-policies/picture-policy?id=4370)). These apply to every photo, not only the cover *observed* (same page).
- Etsy: a listing "must include at least one unedited photo of the actual item against a real background"; an unedited photo may be cropped, resized, watermarked or re-formatted, not via AI tools, and its lighting may not be adjusted; it need not be first; proactive enforcement is planned for early 2027 *observed* ([Etsy seller handbook](https://www.etsy.com/seller-handbook/article/1522733284810), [Etsy announcement](https://community.etsy.com/forum/announcements-290/topic/updated-nov-6-important-updates-to-ai-on-etsy-190573/)). Etsy suggests noting AI edits in the description *observed* (handbook).
- Depop: "Only use photos taken by yourself" *observed* ([Depop help](https://depophelp.zendesk.com/hc/en-gb/articles/360026574274-What-are-stock-images)); its selling safety guidance names AI-generated images as not allowed *asserted* ([Photomop summary](https://photomop.com/marketplace/depop); Depop page not opened).
- Poshmark: no rule naming AI found; a general "don't mislead" rule *asserted* ([VendyStudio](https://www.vendystudio.com/blog/ai-photos-for-reselling-poshmark-depop-mercari)); its feed shows the cover 3:4 since a March 2026 redesign *asserted* ([Movapix](https://movapix.com/app/blog/ebay-poshmark-listing-photos-ai-what-helps-what-gets-flagged.html)).
Method: text and border detection stays with the vision label in §3.2; add a deterministic border check (a uniform band along any edge after crop) since the engine itself is the likeliest source of a border *inferred*.

**6. Crop: pad or never pad.** eBay bans added borders *observed* (above), and a solid fill band to reach 1:1 is an added border *inferred*. Outpainting the missing background is a model drawing pixels, which makes the photo `ai_marked` and so unfit for a cover that must be real *inferred* (spec §8). So never pad holds, on every site, and `item_cut` with "Step back a little" is the right answer. The one safe exception: none found.

**7. Provenance tag: what is written, and where.**
- The IPTC vocabulary: `digitalCapture` ("captured from a real-life source using a digital camera"), `computationalCapture` (multi-frame merging including phone HDR, "non-generative AI"), `humanEdits` (non-generative tools), `algorithmicallyEnhanced` ("Modification or correction by algorithm without changing the main content ... such as sharpening or applying noise reduction"), `compositeWithTrainedAlgorithmicMedia` ("Edited using Generative AI ... such as with inpainting or outpainting") *observed* ([IPTC DigitalSourceType](https://cv.iptc.org/newscodes/digitalsourcetype/)); `trainedAlgorithmicMedia` is the value for wholly generated media *observed* ([C2PA guidance 2.4](https://spec.c2pa.org/specifications/specifications/2.4/guidance/Guidance.html)).
- In C2PA, every manifest starts with `c2pa.created` or `c2pa.opened`; a generative inpaint is recorded as `c2pa.edited` with `digitalSourceType` set to the composite value *observed* (C2PA guidance; [CAI docs](https://opensource.contentauthenticity.org/docs/manifest/writing/assertions-actions.md)).
- Meta reads "C2PA and IPTC" metadata for its "AI info" label *asserted* by Meta via [TechCrunch](https://techcrunch.com/2024/07/01/meta-changes-its-label-from-made-with-ai-to-ai-info-to-indicate-use-of-ai-in-photos/); AI-edited content gets the label behind a menu, AI-generated content keeps it in view *asserted* ([The Verge](https://www.theverge.com/2024/9/12/24242998/facebook-instagram-ai-label-update-edited-content)).
- One tag reader ranks `algorithmicallyEnhanced` as "Usually" labelled AI *asserted* ([c2pa.design](https://c2pa.design/blog/digital-source-type)), which is why level 0 should write nothing rather than that value *inferred*.

The rule, *inferred* from the above:

| What drew the pixels | `ai_marked` | DigitalSourceType written when `export_mark` asks | Etsy "unedited"? |
|---|---|---|---|
| `raw`: the person's photo, crop and resize only | false | none | yes |
| level 0: white balance and exposure, no model | false | none | no (lighting changed) |
| level 1, level 2, re-lay, paste-back | true | `compositeWithTrainedAlgorithmicMedia` | no |
| 3D, spin, or any whole render | true | `trainedAlgorithmicMedia` | no |

"None" means no DigitalSourceType at all, not `digitalCapture`: an unsigned `digitalCapture` claim is a statement we cannot prove and Meta and others do not need it *inferred*. Where: an XMP packet in the JPEG (IPTC Extension `DigitalSourceType`, property name per the [IPTC user guide](https://www.iptc.org/std/photometadata/documentation/userguide/), *inferred*, section not read on this pass), or a C2PA manifest signed by us. Pillow's JPEG save options list `exif`, `icc_profile` and `comment` but no `xmp` *observed* (Pillow 13.0 page), so writing XMP into a JPEG needs a small APP1 writer or the c2pa SDK *inferred*.

**8. Stripping.** Pillow writes EXIF to a JPEG only when `exif=` is passed *observed* (Pillow 13.0 page). So the safe export is: decode, transpose, convert to sRGB, crop, resize, then save a new JPEG passing nothing but quality and subsampling, and add only the tag row 7 calls for *inferred*. That also drops GPS, maker notes, the embedded thumbnail (which can hold the uncropped photo) and any vendor C2PA manifest *inferred*. The test reads the output bytes and fails on any APP1 Exif, GPS or JUMBF segment *inferred*.

**9. Personal data in the pixels.** A face in a mirror, an address on mail, a house number or a screen in the background survives every metadata strip *inferred*. The item mask already exists; flag text or a face outside the mask with the same vision call that labels `cover_ok`, and offer the person a retake or a crop. Never blur it with a model on a real photo, since that makes it `ai_marked` *inferred*.

**10. File format.** JPEG at quality 90 to 92 with 4:4:4 subsampling for flaw and label close-ups keeps small text and thread detail; 4:2:0 halves colour resolution *inferred* (Pillow exposes `quality` and `subsampling`, *observed*, Pillow 13.0 page). Never upscale (spec §3.4 already says so); refuse a site whose minimum the source cannot meet (eBay 500 px longest side).

**11. Change detection for gates.** §3.6's ΔE00, edge-band SSIM and OCR diff are the standard trio; keep them. One addition: compute the ΔE on the item mask after the level-0 transform is applied to both, so a white-balance fix is not read as a colour change *inferred* (the prototype's `truthful()` already normalises light before the chroma check).

## (c) What the doc misses, in one place

- eBay's watermark ban makes a visible export tag illegal there; §3.7's `site_required` and `retouched` must be metadata only.
- Etsy needs the `raw` version, and Etsy is named in spec §6 but is not in platform-fit.json, so there is no cap, ratio or rule row for it.
- §3.7 never says which value is written. Level 0 must write none, since it is the person's photo.
- §3.4 strips EXIF only; XMP, maker notes, the thumbnail and a vendor manifest are not named, and orientation and colour space are not handled before the strip.
- No retake floor for blur; §3.1's `pick` ranks frames but a bin whose best frame is blurred still ships it.
- The near-duplicate cosine has no model and no bin scope.
- Pixels can hold personal data that EXIF stripping does not reach.

## Diff against spec/engines/photo.md

- §1, add a row: the export version per site is one of `raw`, `level0`, `improved`, `render`; Etsy's set must hold one `raw`. *agent proposal*
- §1, add a row: `retake {photo_id, reason}` for frames under the blur, exposure or clipping floor, so capture can ask before the draft. *agent proposal*
- §2, add Etsy to the per-site table, and add eBay's 500 px minimum and "no watermark of any type" to the cover rules row. *agent proposal*
- §3.0 (new first step): apply EXIF orientation, convert to sRGB, then mask. *agent proposal*
- §3.1: near-duplicates only inside a bin; 64-bit dHash Hamming 10 or under is the same shot; then the embedding cosine with its model named and its cut set from the fixture. *agent proposal*
- §3.1: blur floor is Laplacian variance on the masked grey image at 1080 px; drop under 0.5 times the bin's best, and under an absolute floor that starts at 100 and is set from the fixture. *agent proposal*
- §3.4: keep never-pad and cite eBay's border ban as the reason; add a check that no exported crop has a uniform edge band. *agent proposal*
- §3.4: export writes a fresh JPEG with no EXIF, XMP, comment, thumbnail or C2PA segment, quality 90, 4:4:4 for label and flaw photos; refuse a site whose minimum the source cannot meet. *agent proposal*
- §3.7: `export_mark` never draws on pixels. Values written: none for `raw` and level 0; `compositeWithTrainedAlgorithmicMedia` for model edits; `trainedAlgorithmicMedia` for renders; in XMP, or a C2PA manifest we sign. On Etsy, an `ai_marked` photo in the set adds a line to the description. *agent proposal*
- §8: add "personal data outside the item mask (a face, an address, a screen) is flagged for a retake or a crop, never blurred by a model". *agent proposal*
- §9, add test 8: every exported file's bytes hold no Exif, GPS, XMP other than our tag, or JUMBF segment, and are upright and sRGB. *agent proposal*

## Changes to tasks' accepts and breaks

- **ph-1 Pool and score.** Accepts: frames upright and sRGB (from the new step 0). Adds: the blur floor and `retake`; dHash pre-filter; dedupe scoped to the bin. Breaks if: a front and back of one item ever dedupe; a rotated copy of a frame survives as a separate frame.
- **ph-2 Order.** Accepts: the version per photo. Adds: Etsy's set always holds one `raw` photo. Breaks if: Etsy's set has no `raw`; a site gets a photo under its minimum size.
- **ph-3 Crops.** Adds: the uniform-edge-band check; never pad on every site. Breaks if: any exported crop has a fill band; any crop is upscaled.
- **ph-4 Route.** No change to the maths. Adds: a `raw` photo is never routed. Breaks if: the Etsy `raw` photo is the input to any model call.
- **ph-5 Gates and export.** Adds: the fresh-JPEG export, the DigitalSourceType table, metadata-only marks. Breaks if: a level 0 or `raw` file carries any DigitalSourceType; an `ai_marked` file under `retouched` lacks one; any visible mark is drawn; any Exif, GPS or JUMBF segment remains (test 8).
- **ph-6 Learning.** Adds: the blur floor and the dedupe cut are `param` rows fitted on the fixture, with the same promote and rollback. Breaks if: either moves without a backtest.

## Limits

- No code ran; every number is a start value for the fixture.
- Depop's AI-image line and Poshmark's 3:4 feed come from secondary pages.
- The XMP property name for DigitalSourceType was not read at the IPTC section itself.
- Whether eBay, Depop or Poshmark read C2PA or IPTC tags at all is not published anywhere found.
