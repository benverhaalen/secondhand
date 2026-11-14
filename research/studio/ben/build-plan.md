# How do we build studio photos for the demo: Seedream relighting from several shots, true color, and a gate that stops any render that changes the item, with a human approving each one?
Researched 2026-11-14 by Ben (Claude Code). Feature: studio.

## Current rule: touch up only (Ben, 21:28 UTC)

Ben: "it shouldnt change the environment or lie. it should touch up" ([words](../../../product/words.md#2026-11-14-photos-touch-up-never-change-the-environment)).

**This replaces the scene presets and the restage.** Sections 0 to 0.2 and 4.3 below describe studio, garage and home scenes and new poses; they are kept as the record of what was tried and are no longer the plan. What stays, what goes (*agent proposal* for the details, Ben's rule for the direction):

| Before | Now |
|---|---|
| Studio, garage, home scene presets | **Gone.** The floor, wall or bed the person shot on stays |
| Restage in a new pose from all shots (hanger, pegboard) | **Gone.** It invents a view nobody photographed |
| In-place edit that keeps the frame | **This is the feature.** Same photo, better light and true color |
| Close-ups as extra references | Kept, so the model sees the true print, tag and color |
| Gate, masked repair, cloud job, loading stages, approval card | Kept. The gate gains one check: the background must still match the original |

**Touch-up levels**, each a tap on the approval card:

| Level | What changes | How |
|---|---|---|
| 0. True color | White balance and exposure only | Deterministic (`color.py`), no model. Always made first, always available |
| 1. Light | Even soft daylight, lifted shadows, neutral color | Seedream 5.5, prompt `light` in [touchup.py](prototype/touchup.py) |
| 2. Pressed | Level 1 plus storage creases relaxed and loose lint gone, as a steamer and lint roller would do | Seedream 5.5, prompt `pressed` |

Never touched at any level: the background, the item's shape and position, color beyond white balance, prints, tags, and every sign of wear, fading, stain or damage. Wrinkle relaxing is the one judgment call: it is what a seller does with a steamer before shooting, so it is offered, but as a separate level the person picks, and the confirmed-defect boxes are protected through it. Whether level 2 is in or out is Ben's call.

**Per platform.** Which level to default to on each site (and what not to do there) comes from the platform research in the posting thread; studio exposes the levels and the crop, and takes a per-platform default from that research.

**Run on Seedream 5.5.** [touchup.py](prototype/touchup.py) calls `bytedance-seed/seedream-5-5` through OpenRouter; the `studio touch-up test` workflow runs it on the three real items with the repo's key and commits the results to [renders/](renders/).

### First look at touch-ups (21:32 UTC, Seedream 5.0 Pro, not 5.5)

Seedream 5.5 has not run yet (see "Blocked" below), so the two prompts were tried on Seedream 5.0 Pro through Higgsfield as a stand-in. Four renders from Ben's real photos, scored against the originals (observed):

| Render | Framing kept | Color drift (limit 4.5) | Detail kept | Background kept |
|---|---|---|---|---|
| Marquette tee, light | 0.98 | 4.4 | 0.95 | 0.90 |
| Marquette tee, pressed | 0.98 | 5.9, over | 0.95 | 0.89 |
| Chico hoodie, light | 0.95 | 4.7, over | 0.94 | 0.94 |
| Carhartt pants, pressed | 0.98 | 4.2 | 0.95 | 0.92 |

By eye: the same concrete floor, the same framing and folds, prints and tags intact, brighter and more even light. Two faults: the tee comes out a little less saturated and the hoodie a little lighter and pinker, which is the color drift the table shows. "Pressed" barely relaxes the wrinkles, so on this model levels 1 and 2 look nearly the same. Color drift is the thing to fix: either push the item's color back to the level 0 photo after the render (deterministic, real color wins), or show the drift on the approval card. *Agent proposal:* do the first.

The gate now has the background check (`keep_background=True` in [gate.py](prototype/gate.py)).

**Blocked: the Seedream 5.5 run.** Three routes, all closed at 21:50 UTC (observed): every GitHub Actions job on the repo fails in about 3 seconds with no runner and no logs, including `check.yml`, so the repo's key cannot be used; Ben's Mac has no OpenRouter key; and this cloud environment cannot reach openrouter.ai. Any one of them opening is enough.

## 0. Revised after Ben's steer (21:11 and 21:13 UTC)

Ben: "dont focus on benchmarks that deny a small part. its a product demo" ([words](../../../product/words.md#2026-11-14-studio-is-a-demo-test-on-real-photos)); "this is a product demo ... we can also just build things" ([words](../../../product/words.md#2026-11-14-demo-not-production)); "if you think theres an api or multiple possibilties for it that would work better we are fine paying for api costs" ([words](../../../product/words.md#2026-11-14-paid-apis-are-fine)).

What this changes in the plan below (*agent proposal*):

1. **Build both routes, lead the demo with the impressive one.** The multi-photo restage (Ben's "reference-to-video" idea: all shots in, the item in any scene, on a hanger or a form) is a first-class feature, not an optional extra. In-place relighting stays as the fast, always-works option. Section 7's recommendation to default to in-place only is withdrawn.
2. **The gate ranks and explains; it does not block.** Its numbers pick the best candidate and light up the chips on the approval card ("logo kept", "scuff kept", "color close"). The person decides. Only a confirmed defect that vanished hides a candidate.
3. **Spend on candidates.** Per preset, run several in parallel and keep the best: Seedream 5.5 with two or three seeds, plus Nano Banana 2.1 on the same prompt. The gate scores them, the card shows the winner, and "Redo" swaps to the runner-up at once with no wait. This uses the gate as the picker, which is where it earns its place in a demo.
4. **The benchmark numbers in loops 1 and 2 are background, not a verdict.** They describe raw, single-shot edits of arbitrary products. Our setup differs: well-framed photos, several references, a keep-list in the prompt, several candidates and a picker. Loop 3 showed logos, labels and a scuff surviving in every in-place render.
5. **Test set: Ben's own listing photos** in `depop-plus/data/intake_photos/listings/` (100 items, 3 to 11 shots each, square 1080 px, flat on concrete, most with a tag close-up). They have no white card, so color is anchored on the tag or the concrete floor for these, and the card is for new captures only.

### 0.1 The studio agent: render, look, mask, fix, repeat (Ben, 21:14 UTC)

Ben: "codex and you have tooling to create like masks and such for images when edits need to be made maybe you could integrate it similar to how codex integrates image gen and editing well"; "send info and jobs to the cloud"; "since this is an agentic app i expect for you with the ui to be able to understand loading" ([words](../../../product/words.md#2026-11-14-studio-edit-loop-cloud-jobs-and-loading)).

Seedream has no mask input (loop 1), so the masks are ours, applied around the model the way Codex wraps image generation with its own image tools. One agent run per item (*agent proposal*):

| Step | Tool the agent calls | What it does |
|---|---|---|
| 1. Prepare | `segment`, `color_correct`, `protect` | Item mask, card or tag white balance, boxes for every logo, tag and confirmed defect |
| 2. Render | `seedream_edit` × candidates, `nano_banana_edit` | Several candidates per scene in parallel |
| 3. Look | `gate` | Scores each candidate and names the boxes that changed |
| 4. Fix with a mask | `repair` | Warps the real photo onto the render and blends the real pixels back into each flagged box through a feathered mask, matched to the render's light. Scene and light stay generated; the logo, tag or scuff is the real one |
| 5. Re-edit when a mask can't fix it | `seedream_edit` with a red box drawn on the reference and "change only the area in the red box" | For scene problems (odd shadow, stray prop), the prompt-side stand-in for a mask (loop 1) |
| 6. Look again | `gate` | At most two rounds, then show the best one |
| 7. Hand to the person | approval card | Chips show what was kept and what was repaired |

Step 4 is prototyped in [prototype/repair.py](prototype/repair.py). On the four seeded faults (jacket logo painted out, collar label painted out, toe scuff painted out, swoosh painted out) the loop went "reject" then "pass" after one repair each, and the crops show the real patch and the real scuff back in place [observed, ran it and looked]. It relies on the in-place render keeping the frame, which loop 3 measured at 0.93 to 0.99. For restaged renders (new pose) there is no frame to warp onto, so step 5 and more candidates do the work there.

**Cloud jobs.** The phone uploads the shots and gets a job id back at once. A worker (a Databricks job or a small Python service; the gate and repair need only OpenCV) runs the agent loop and writes each event to a job row. The app subscribes to the row.

**Loading the person can read.** Each event is a stage the draft shows as it happens, so the wait looks like work, not a spinner: the real photo appears first and is usable at once; then "color fixed" swaps in the corrected photo; each scene tile fills from a blurred placeholder to its first candidate (about 25 s), and a tile that is being repaired shows the flagged box pulsing before the fixed image replaces it. Stages: `uploaded`, `color_fixed`, `rendering(scene, n of m)`, `checking`, `repairing(box)`, `ready`, `failed(reason, real photo kept)`. Copy and motion go through the `ui-screen` skill before build.

### 0.2 Renders from Ben's real photos (21:18 UTC)

Three items from `depop-plus`, now in [assets/demo-items/real/](../../../assets/demo-items/real/README.md). Eight renders at 2K through Higgsfield: Seedream **5.0 Pro** (5.5 is not on Higgsfield) and Nano Banana 2.1, each with the main shot plus two or three close-ups as references. Every line below is *observed*: I looked at each image, and the numbers are from the gate.

| Item | Render | Model | What it looks like | Gate |
|---|---|---|---|---|
| Marquette tee | Studio, in place | Seedream | Same shirt, same folds, grey backdrop with a soft light band. Print and tag intact | frame 0.98, color 4.7, structure 0.94 |
| Marquette tee | On a hanger, from 4 shots | Seedream | The strongest image of the set. Print the right size and place, Fruit of the Loom tag readable in the collar, cotton still looks worn | new pose, not comparable |
| Marquette tee | On a hanger, from 4 shots | Nano Banana 2.1 | Good shirt, but the print is tilted and redrawn | n/a |
| Chico hoodie | Home, in place | Seedream | Oak floor and window light look real, lettering intact. The hoodie came out darker and more maroon than the faded crimson original | frame 0.91, color 7.8, structure 0.44 |
| Chico hoodie | On a hanger, from 3 shots | Seedream | Listing-ready. Lettering, faded STATE, pocket, hem tag and Russell neck tag all there; color close to the original | n/a |
| Chico hoodie | On a hanger, from 3 shots | Nano Banana 2.1 | Also listing-ready, slightly cleaner and less faded than the real one | n/a |
| Carhartt pants | Studio, in place | Seedream | Same pants on grey with a light band; fading kept. The source photo is sideways, so the render is too | frame 0.93, color 4.2, structure 0.81 |
| Carhartt pants | Hanging on a garage pegboard, from 3 shots | Seedream | The most convincing scene: fading, hammer loop, rivets and leg shape carried over | n/a |

What this changes:

- **The multi-photo restage works on real photos and is the demo's lead image.** Ben's idea holds up: with the close-ups as references the print, the tags and the fading carried into a new pose in four of five restages.
- **Seedream beat Nano Banana on the print** (tee), and tied on the hoodie. Running both and picking is worth it.
- **In-place renders kept the frame on real photos too** (0.91 to 0.98), so the masked repair applies.
- **Strong scene light shifts the item's color** (hoodie at home). Fix in the prompt ("soft, even light; the item's color must match image 1") and keep the color number as the picker between candidates.
- **Rotate sideways shots upright before rendering** (pants).
- The restage has no number yet. Next: score it by matching the print, tag and logo crops against the close-up references.

Builds on [seedream-relighting.md](seedream-relighting.md). Where this note changes it, it says so in section 3. Everything here is an *agent proposal* until Ben or Nate decides.

## 1. The question and Ben's goal

Ben: the photo "could be wrinkly, the lighting could be weird"; "the user can choose to light it in a studio, in a garage, in a house"; "use seedream 5.5"; "with all the array of images the model can create a super accurate conceptual representation of it. takes into account correcting color etc"; "kind of like how the video model thing where you give image references of a person and you can put it in any video" ([words](../../../product/words.md#2026-11-14-tools-and-capture)). Later: "judges love human in the loop", "dynamic and intelligent ui ... where you have a huge range of set components", and "if i gave you the name of a tool assume thats the one in use unless you find a better one" ([words](../../../product/words.md#2026-11-14-human-in-the-loop-and-dynamic-ui)).

So the job is to turn the guided capture shots into three scene photos (studio, garage, home) that look professionally lit but show exactly the item the buyer will receive: same color, logos, tag, stitching, wear and every defect. The person approves each render before it can go into a listing. The [thinking.md](../../../.agents/thinking.md) type is **Seeing the item**: how wrong is it, how often, and does the person see when the system is unsure.

The problem splits into three parts that fail independently [inferred]:
- **Color truth.** What color is the item really, given a phone's auto white balance and indoor light?
- **Scene generation.** New background and light, item untouched.
- **Verification.** Proving the item was untouched, per render, before a human looks.

## 2. Seeded research log

Method: RDD loop with seeded, adaptive investigation (`it-already-exists/skills/reference-driven-development/references/research-improvement.md`; failure families from `failure-families.md`; seeded-defect evaluators from `reconstruction-bottlenecks.md`). Two research agents ran loops 1 and 2 in parallel. I ran loop 3 (prototypes and real renders) myself. Labels: *observed* (primary page opened or code run), *asserted* (a source says it, or memory), *inferred* (my reasoning).

### Loop 1. Seed cue: primary API pages and model release notes for Seedream 5.5 and its rivals

| Seed | Cue | What inspection showed | What it changed |
|---|---|---|---|
| Comfy router doc for BytePlus `seedream-5-5-261028` | Primary parameter list | `image` takes a string or an array of up to 10 (URL or data URI); `size` is `1K`/`1.5K`/`2K` or `WxH`; `seed` from -1 to 2147483647; `guidance_scale` 1 to 10; `watermark` **defaults to true**; `response_format` `url` or `b64_json`; `sequential_image_generation` and `stream` are not supported on 5.5 [observed, docs.comfy.org/development/comfy-router/models/byteplus/seedream-5-5-261028/code]. The doc does not say 5.5 supports `guidance_scale` [observed]. | BytePlus is the only route found with a seed, which we need for reproducible retries. Always send `watermark: false` (eBay bans watermarks). |
| fal, Runware, WaveSpeed, EvoLink, OpenRouter pages for 5.5 | Primary host pages | None exposes a mask field or a seed; Runware gives `numberResults` 1 to 20, each with a different seed, and defaults to JPG at quality 95; OpenRouter `bytedance-seed/seedream-5-5` forwards to one provider, Seed, P50 23.91 s [observed]. | **No host offers a mask for Seedream 5.5** [observed on 5 hosts]. "Change only the background" can only be asked for in the prompt. Fallback host: OpenRouter, since it passes straight through to Seed. |
| ByteDance's 5.5 launch post | Vendor claim with numbers | Unedited regions preserved "at the pixel level"; text corruption 0.4% severe and 1.7% minor; no logo claim; no prompt set or sample size [asserted, seed.bytedance.com blog]. | Vendor numbers only. Plan as if we have to verify every render. |
| Segmind's 5.5 tests (2026-11-11) | Third-party failure traces | Frame darkens about 0.5 levels per edit round; the model sometimes changes more than asked (one shoe became a pair at a new angle); output a few pixels larger than the source; small-text letter errors [observed, blog.segmind.com]. | Branch every preset from the original, never chain edits. Resize the render to the source before comparing. |
| Masonry product-photo fidelity test (Aug to Oct 2026) | Side-by-side of 5 models on one product | Seedream 5 Pro made the bottle "taller and narrower, label scale shifted"; Nano Banana Pro and GPT Image 2 also changed proportions; **0 of 13 outputs approved as a factual primary image**; Nano Banana 2 was the most faithful [observed, masonry.so/blog/ai-product-photo-fidelity-test]. | Keep **Nano Banana 2.1** (`gemini-nano-banana-2.1`, up to 14 references, "object fidelity for up to 10 objects" [observed]) as the challenger model. |
| GPT Image 2.6 edit endpoint | Only mask-capable rival | Accepts a mask and a markup layer, not both together [asserted, third-party summaries]. | A third option if we ever need a true region-locked edit. Ben said not to use the ChatGPT model, so it stays deferred. |
| eBay picture policy | Marketplace rule | Bans "Photos that don't accurately represent the item", stock photos for used items, added borders, text and watermarks; 500 px minimum on the longest side [observed, ebay.com/help/policies/listing-policies/picture-policy?id=4370]. Etsy (announced 2026-10-22) requires "at least one unaltered photo of the actual item against a real background" [asserted, via ppc.land; Etsy's page not reached]. | The real photo always stays in the listing; renders never carry text or a badge burned into the pixels. The "styled" label lives in our app, not on the image. |

**Frontier after loop 1**
- Changed: no host can lock the item's pixels for Seedream 5.5, so fidelity has to come from the prompt, the composition and a gate.
- New lead: how often do strong editors change products, and how do others measure it?
- Next action: find benchmarks and metrics for product detail preservation.
- Bound: papers and vendor benchmarks from 2025 and 2026 that report how they count.
- Counter-lead: skip generation for the item entirely and composite the real cut-out.

### Loop 2. Seed cue: benchmarks with a stated counting method, and metric papers with contrary evidence

| Seed | Cue | What inspection showed | What it changed |
|---|---|---|---|
| Photoroom editing benchmark | 850 products, 3+ annotators, any flag fails | Best editing models kept product details intact only **28 to 29%** of the time. Failures: logo or text distortion 20.1%, missing or changed elements 12.5%, pattern change 11.4%, color shift 8.1%. Seedream not tested. Their VLM "Fidelity Layer" raised the pass rate only to 38.2% [observed, photoroom.com/blog/top-editing-image-models-maintain-product-details-only-28-of-the-time]. | **Most raw renders should be expected to fail an honest gate.** The pipeline's shape matters more than the gate's cleverness. |
| FlowFixer (Feb 2026) | Metric paper with contrary evidence | Detail preservation measured as the gain in keypoint matches between reference and output; CLIP-I and DINOv2 "barely move when fine detail is restored" [observed, alphaxiv 2602.21402]. | Don't gate on a global embedding score. **Count matched keypoints on the item instead.** |
| MaSC (May 2026) | Human-agreement numbers per metric | Global pooling is the weak point: Krippendorff α for CLIP-I 0.135, DINO-I about 0.31; masked per-patch max cosine on SigLIP2 reaches 0.471, close to GPT-4o at 0.499 [observed, alphaxiv 2605.22469]. | If we add a learned feature check, make it per patch inside the item mask. |
| ID-Sim (Apr 2026) | Trained on lighting edits as positives | DINOv3 plus LoRA; patch mAP 0.80 vs 0.41 for plain DINOv3 on DeepFashion2; no code found [observed]. | Deferred until code exists. |
| DISTS paper | Robustness numbers | SSIM collapses when misregistered (SRCC 0.17 under translation); DISTS tolerates mild distortion [observed, arxiv 2004.07728]. | Compare structure **after alignment**, on gradients, not raw pixels. |
| Garment-fidelity VLM judge (Aug 2026) | Fine-tuned judge, 7 dimensions incl. logo | About 76% balanced accuracy, better than GPT-5.5 and Gemini 3.1 on that task [observed, arxiv 2608.29804]. | A VLM judge alone misses real failures. It sits beside deterministic checks, and a person has the last word. |
| ProductConsistency (Jun 2026) | OCR-based text fidelity | OCR plus per-word character error rate on product text; strong editors still have non-zero CER [observed, arxiv 2606.19103]. | OCR diff on the tag shot is worth it; it does nothing for the swoosh or the Carhartt "C", which need a patch check. |
| kijai `DetailTransfer` node, IC-Light | Inspectable code for keeping source detail | Blurs both images and adds the source's high frequencies onto the relit target, with a mask [observed, comfy.icu/node/DetailTransfer]; IC-Light (Apache-2.0) relights a fixed foreground [observed, github.com/lllyasviel/IC-Light]. | A repair step exists if Seedream softens texture: add back the source's high frequencies inside the item mask, but only where alignment is confident. |
| Color constancy: W3C Image Capture implementation status | Primary status page | `whiteBalanceMode` and `colorTemperature` constraints are listed for Chrome on Android, ChromeOS, Windows and Mac; the Safari section is empty; the page says it was updated February 2023 [observed, github.com/w3c/mediacapture-image/blob/main/implementation-status.md]. | On an iPhone PWA we probably can't lock white balance across shots [asserted, the page is old]. So each shot is corrected on its own, from the card or from the item itself (section 4.1). Native iOS can lock it with `AVCaptureDevice.setWhiteBalanceModeLocked` [asserted, from memory]. |

**Frontier after loop 2**
- Changed: global similarity scores are out; aligned, per-region structure checks plus keypoint counts are in.
- New lead: does Seedream keep the framing when told to, so that alignment works at all?
- Next action: build the gate, seed it with known faults, then run it on real renders.
- Bound: three demo items, six real renders.
- Counter-lead: the composite route (real cut-out plus generated scene) needs no gate for the item at all.

### Loop 3. Seed cue: our own prototype, seeded with known faults, then real renders

Code: [prototype/](prototype/README.md). OpenCV only; `lab.py` matches scikit-image within 0.01 on 5000 random color pairs [observed, ran it].

**Seeded-fault test** (`seeded_faults.py`). Known-good "renders" are the demo photo with a new light color, a directional falloff, a new background, 3° rotation and 4% scale. Known-bad ones paint out a logo, a tag or a defect, shift the hue, or mirror the frame. The gate should pass the first kind and reject the second [observed, ran it]:

| Item | Benign relights | Logo or tag painted out | Defect painted out | Mirrored frame | Hue shift |
|---|---|---|---|---|---|
| Carhartt jacket | pass, pass | reject (patch 0.10), reject (label -0.01) | n/a | reject | reject (ΔE 9.8) |
| Nike Dunks | pass, pass | reject (swoosh 0.22) | reject (toe scuff 0.09) | reject | pass, correctly: the shift on grey leather is ΔE 1.8 |
| Levi's 501 | pass, pass | n/a | n/a | reject | reject at gate ΔE 5.7, though the true shift is ΔE 4.2: a false reject on the safe side |

16 of 17 as expected. Three corrections came out of this run, each from a failure [observed]:
1. GrabCut dropped the white logo patch from the item mask, so the patch was never checked. Fix: fill holes in the mask. Sibling risk: any white tag or print on a dark item.
2. A free per-channel light correction also "corrects" a real color change on a one-color item (a brown jacket turned olive looks like olive light). Fix: remove only the light the preset declares, plus one brightness scalar.
3. A mirrored pair of shoes matched 46% of keypoints. Fix: alignment needs 60% or more.

The white-card test recovered a synthetic cast exactly (ΔE 5.4 down to 0.0). That only proves the code: the cast was a pure per-channel gain, so recovery is exact by construction [observed, inferred].

**Real renders.** Seedream 5.5 is not on Higgsfield, so these used **Seedream 5.0 Pro** through Higgsfield at 1K. Six renders cost about 7.5 credits [observed]. Results from `run_real.py` [observed, ran it]:

| Render | Prompt style | Alignment | Color ΔE | Worst structure | Protected boxes | Gate |
|---|---|---|---|---|---|---|
| Jacket, studio | Edit in place (keep framing) | 0.994 | 5.3 | 0.85 | patch 0.99, label 0.99, pocket 0.99 | reject: color |
| Jacket, studio, `is_inpaint` | Same, inpaint flag | 0.993 | 4.3 | 0.94 | all 0.99+ | pass |
| Jacket, garage | Edit in place | 0.979 | 2.5 | 0.97 | all 0.99+ | pass |
| Jacket, on a hanger | Free restage from one reference | 0.66 | 6.8 | -0.22 | label 0.26 | reject: color, structure, label |
| Dunks, studio | Edit in place | 0.976 | 3.0 | 0.91 | scuff 0.99, swoosh 0.99 | pass |
| Dunks, home, warm window light | Edit in place | 0.931 | 11.1 | 0.81 | scuff 0.95, swoosh 0.95 | reject: color |

What I saw in side-by-side crops [observed, looked at them]:
- With "keep the item exactly where it is", Seedream 5.0 Pro **kept the framing almost to the pixel** (alignment 0.93 to 0.99). This is the most useful finding. It means an in-place render can be checked against its source, region by region.
- Logos, the collar label, the zip pocket, the swooshes, the perforations and the left-toe scuff all survived in every in-place render.
- The jacket studio render **added a speckled, crackled texture to the canvas** and made the patch whiter and its orange more saturated. The structure check passed it (0.85). The color check caught it (5.3). Texture exaggeration is a real failure the structure check does not see on its own [observed].
- The home render's warm light was much stronger than the cast I declared (1.10, 1.0, 0.85), so color failed for a light reason, not an item reason. **Declared light casts are guesses; the light has to be measured** (section 4.3) [observed failure, inferred fix].
- The hanger restage is a different photo of a plausible jacket: sleeves shorter, canvas cleaner. Its 0.66 alignment slipped over the 0.60 bar, but the structure and label checks rejected it [observed]. Free restaging cannot be verified this way.

**Frontier after loop 3**
- Changed: in-place editing makes verification possible. Free restaging from many references (Ben's "reference-to-video" idea) gives the most impressive images but cannot be checked against a source.
- Next action: rerun on Seedream 5.5 once we have a BytePlus or OpenRouter key; run the multi-reference prompt (front, back, tag, defect close-ups together).
- Unresolved: whether multi-reference input changes framing stability; the gate's thresholds on real garment photos (three items is a smoke test, not a calibration).
- Counter-lead kept: the composite route, as the fallback when the in-place render fails twice.

## 3. What changed from the earlier note

| Earlier ([seedream-relighting.md](seedream-relighting.md)) | Now | Why |
|---|---|---|
| One render per preset from all references, then a gate | **Two routes.** In place (default) edits the main shot and keeps its framing, so it can be verified. Restage (optional) builds a new view from all references and is labelled styled, with a person checking it against the originals | Loop 3: only in-place renders could be verified |
| Gate: Decisions predicates plus mean ΔE in the mask | Ordered deterministic checks (alignment, color, structure, each protected box, OCR on the tag), then Decisions predicates on paired crops, then the person | Loop 2: VLM judges top out around 76%; global scores miss details |
| Color: white balance from the card in the first shot | Card in the first shot, every later shot matched to it through the item's own pixels, and the scene's light measured from the render rather than declared | Safari can't lock white balance; loop 3 home-light failure |
| Host: OpenRouter or Runware | BytePlus ModelArk direct (seed, `watermark: false`, `b64_json`), OpenRouter fallback, Nano Banana 2.1 challenger | Loop 1: only BytePlus exposes a seed |

## 4. The system

### 4.1 Capture inputs (from the capture feature)

The studio step needs these from the guided shot list ([guided-shot-list.md](../../capture/ben/guided-shot-list.md)):
- **Main shot** with a **white card or sheet of paper** in frame. This is the color anchor and the frame every in-place render keeps.
- Back, tag, close-ups, and one close-up per defect the person confirmed. Each defect carries a box on the main shot (from the capture step's "possible stain, lower left" confirm).
- **Protected boxes**: logo and tag boxes come from identify (a Decisions or VLM pointing call: "box every logo, label and printed text"); defect boxes come from the person's confirmations. The person can add one by tapping.

### 4.2 Color truth (deterministic, before any model)

1. Find the card. On native iOS use Vision rectangle detection; on the web, a bright low-saturation quadrilateral near the frame edge, or the person taps it [inferred].
2. Gains in linear sRGB that make the card neutral, at a fixed brightness (`color.white_reference_gain`). Reject the shot if the card is clipped or too small, with a retake prompt.
3. Apply the gains to the main shot. For each later shot without a card, match the item's median color to the corrected main shot (`color.match_to_anchor`). Shots whose dominant material differs (a sole close-up) need the card in frame instead.
4. The corrected main shot is the **evidence photo**. It goes first in every listing, unchanged except for white balance, exposure and crop.

If there is no card: use the white tag as the neutral if the tag shot shows one (a white care label is close to neutral [asserted, not measured]); otherwise skip correction, mark color "not checked", and say so on the approval card.

### 4.3 Scene generation

**Route A, in place (default for every preset).** One Seedream call per preset, branched from the corrected main shot. References: image 1 is the corrected main shot (the frame to keep); images 2 to 6 are the back, tag and defect close-ups for identity. Prompt template, tested in loop 3 with one reference:

```
Edit image 1. Images 2 to {n} show the same {item} from other angles and up close.
Keep the {item} exactly where it is in image 1: same position, framing, folds and size.
Keep its color, {material} texture, every seam and stitch, {hardware}, {logos_and_labels},
and every mark: {defects}. Do not clean, smooth, sharpen or redraw any part of it.
Change only the surface and the light: {scene}.
{light}. Do not add props, text or people.
```

Slots are filled from identify and capture, so the keep-list names this item's actual features (loop 1: name what must not change, restate it in every call). Scene and light per preset:

| Preset | `{scene}` | `{light}` | Measured light check |
|---|---|---|---|
| Studio | a seamless light grey paper sweep | Neutral white light, large soft key from the upper left, gentle contact shadow | Must be neutral: the sweep's median chroma near zero |
| Garage | a clean sealed concrete floor | Cool daylight from an open garage door | Estimate the cast from the floor next to the item |
| Home | a light oak floor | Warm late-afternoon window light from the left | Estimate the cast from a gray-world over the floor |

The gate's color check divides out the **measured** cast of the render's own background, not a declared one (loop 3 home failure). Studio is the strictest and is the color reference for the listing.

Request settings: BytePlus `seedream-5-5-261028`, `size` the main shot's aspect at 2K, `seed` fixed per item (retry with seed + 1), `watermark: false`, `response_format: b64_json` [observed parameter names, loop 1]. Three presets run in parallel; P50 is about 24 s [observed on OpenRouter].

**Route B, restage (optional, labelled "styled").** Ben's reference-to-video idea: all shots as references, the item shown on a hanger, worn on a form, or from a new angle. Up to 10 references. It can't be aligned to a source, so its gate is: dense matching against each reference (enough inliers on the item, measured against the spread between two real photos of the same item), OCR diff on the tag, a Decisions predicate per protected feature on paired crops, and **always** a person. It never becomes the first photo in a listing.

**Repair, not regenerate, for texture drift.** When the structure check passes but the person or the color check flags softened or exaggerated texture, add back the source's high frequencies inside the item mask (DetailTransfer pattern), only where alignment inliers are dense. Then re-gate [inferred from loop 2 and loop 3].

**Fallback, composite.** After two failed in-place renders for a preset: cut out the real item (Seedream transparent mode is redrawn, so use a segmentation model such as SAM 3 or BiRefNet), generate only the empty scene, and composite with a soft shadow. Its item pixels are real, so only the edge and shadow need a look [inferred].

### 4.4 The fidelity gate

Order matters: cheap checks first, and anything the system can't verify goes to the person rather than passing.

| # | Check | Catches | Outcome | Cost |
|---|---|---|---|---|
| 0 | Resize render to source; segment the item on the source | Size drift (Segmind) | n/a | ms |
| 1 | Alignment: SIFT matches on the item, one RANSAC homography, inlier share ≥ 0.60 | Reframed, mirrored, restaged | Below bar: **unverifiable**, goes to Route B rules | about 0.3 s CPU [observed order of magnitude] |
| 2 | Color: CIEDE2000 median on the item after dividing out the measured scene cast and one brightness scalar; ≤ 4.5 | Color shift, contrast boost, whitened patches | Fail: reject and retry once | ms |
| 3 | Structure: gradient-field correlation per 32 px tile on the item; 5th percentile ≥ 0.55 | Seams or prints painted out, invented folds | Fail: reject; worst tiles drive the heatmap | about 0.5 s |
| 4 | Each protected box: same measure on the box, ≥ 0.60 | Logo, tag or defect removed | Fail on a defect box: **hard reject**, never retried silently | ms per box |
| 5 | OCR diff on the tag box (PP-OCRv5 or Apple Vision) | Changed letters on the label | Fail: reject | about 1 s |
| 6 | Decisions API predicates on paired crops: `render_same_item`, `render_preserves_defect_{i}`, `render_texture_unchanged`, `render_logo_unchanged` | Texture exaggeration, subtle logo redraw | Any below 0.85: flag for the person | 2 to 6 s |
| 7 | The person approves | Everything else | Only approved renders can be listed | n/a |

Thresholds are from three demo items and six real renders. Before the demo, recalibrate on 20 to 30 of the team's own items: score real photo A against real photo B of the same item to get the spread of honest variation, seed known faults (paint out a defect with Seedream itself) and set each bar for at least 95% recall on the faults (loop 2 calibration recipe) [inferred].

Every gate result and every human decision is a row in a Databricks Delta table (render id, preset, model, seed, each check's number, the person's choice). That table is how thresholds get re-set after the demo, and it is the honest answer to "how often does it get it wrong" ([Decisions note](../../identify/ben/openai-decisions-api.md#calibration-loop-also-a-databricks-story)).

### 4.5 What the person sees

One approval card per render, built from set components (see [ui-screen](../../../.agents/skills/ui-screen/SKILL.md) before building it; *agent proposal*):
- A before/after slider: the evidence photo against the render, aligned, since route A keeps the frame.
- A chip per protected box (logo, tag, each defect), green when kept, amber when the checks disagree. Tapping a chip zooms both crops side by side.
- When the gate flagged something, the worst tiles outlined on the render.
- Actions: **Use**, **Redo**, **Fix texture** (the detail-transfer repair), **Use real photo**. Long press on any spot: "this changed", which adds a protected box and redoes the render.

The listing order is fixed: evidence photo first, then the person's approved renders, then the real close-ups.

## 5. Build order for the hackathon

| Hours | Step | Done when |
|---|---|---|
| 0 to 1 | BytePlus key (or OpenRouter), one in-place Seedream 5.5 call from a script; rerun `run_real.py` on 5.5 renders | One 5.5 render passes or fails the gate for a reason we can see |
| 1 to 3 | Color step on the server: card detection, gains, match to anchor; evidence photo out | Same item shot under two lamps comes out within ΔE 3 of each other |
| 2 to 4 | Prompt templates filled from identify; 3 presets in parallel with fixed seeds | Three renders in under 40 s |
| 3 to 6 | Gate as a service: checks 1 to 4 from the prototype, measured scene cast, OCR on the tag | Seeded-fault test passes on 5 of our own items |
| 5 to 7 | Decisions predicates on paired crops; Delta table writes | Every render has a row |
| 6 to 9 | Approval card and listing order in the app | A person can approve, redo, or fall back to the real photo |
| 9 to 11 | Composite fallback and Route B (restage) | Two failures fall back without a dead end |
| 11 to 12 | Calibrate thresholds on the team's items | Bars written down with their recall |

## 6. Failure and edge cases

| Case | What goes wrong | Handling |
|---|---|---|
| Seedream reframes or adds a second shoe (Segmind) | Alignment fails | Unverifiable; retry once with seed + 1; then composite |
| Exaggerated texture (loop 3 jacket) | Structure passes, color fails or the person flags it | Fix texture repair, re-gate |
| Defect "cleaned" | Defect box score drops | Hard reject; never shown as an option |
| Warm or cool presets | Real light changes color; declared cast is wrong (loop 3) | Measure the cast from the render's background; studio is the color reference |
| No card in the main shot | No color anchor | Tag as neutral if white; otherwise "color not checked" on the card |
| Card clipped or in shadow | Bad gains | Reject the shot at capture with a retake prompt |
| Black or plain item (black hoodie) | Too few keypoints to align | Unverifiable; show the person the slider and ask; offer composite |
| Symmetric item or a pair | Mirror-swapped matches pass alignment | 0.60 inlier bar; structure check on the whole item catches a mirror [observed once, loop 3] |
| Repetitive weave (denim twill, duck canvas) | Wrong matches | RANSAC plus tile check; flag to the person if the tile map is noisy |
| White logo on a white item | Mask drops the logo; logo box empty | Fill mask holes; protected boxes come from identify, not the mask |
| Transparent or shiny items (glass, chrome) | Transparent mode returns opaque glass (Segmind); reflections change by design | Restrict to studio; mark color "not checked" on reflective areas |
| Small text on tags | Letter errors | OCR diff on the tag; the tag close-up always ships as a real photo |
| Rate limit or timeout (429s seen through Higgsfield in loop 3) | No render | Retry with backoff; the evidence photo is always ready first, so the listing never waits |
| Drift across retries | Darkening per round (Segmind) | Always branch from the corrected source, never from a previous render |
| Marketplace rules | Misrepresentation | Evidence photo first; no text or badges in pixels; renders only after a person approves |

## 7. Decision for Ben

Withdrawn. An earlier draft recommended in-place renders as the only default and restaging as an optional extra. After Ben's steer (section 0) both are built, and restaging leads the demo.

## 8. Searched, and what I couldn't reach

- Ran: the prototype, the seeded-fault test, six Seedream 5.0 Pro renders through Higgsfield, the gate on those renders.
- Couldn't run: Seedream 5.5 itself (no key here; Higgsfield lists only up to 5.0 Pro). The BytePlus docs pages render empty. Replicate doesn't list 5.5 [asserted].
- Not reached: SwitchLight, Claid, Pebblely, Flair, Picsart, Vinted; Depop, Poshmark, Mercari and Facebook policy pages on AI-edited photos; the primary Etsy post; X and Reddit threads.
- Three items and six renders are a smoke test. None of the thresholds is calibrated.
