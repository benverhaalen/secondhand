# Photo engine

Rewritten 2026-11-15 by the capture team lead, in the spec pass that Nate called ([words](../../product/words.md#2026-11-15-nate-wrap-the-leads-up-at-a-good-spot-then-spec-from-what-we-have)). The page says what the code does today, with file references. Where page and code disagree, it says which one is right. Product choices are marked *agent proposal*.

The engine turns one capture into each site's photo set: which frames are kept, their order and crop per site, a quality score for every photo, and which retouch route runs when the person taps Generate. It joins four cards: [card 21](../determinations/seeing-the-item.md#21-which-frames-become-listing-photos-and-in-what-order) (the frame pool), [D8](../determinations/listing-and-marketing.md#d8-photo-choice-and-order) (the order, owned by list), [capture-shots card 8](../determinations/capture-shots.md#8-the-one-frame-and-each-sites-crop) (the crops) and [card 9](../determinations/capture-shots.md#9-which-retouch-route-runs-for-a-photo) (the route), with [studio](../features/studio.md#retouch-chosen-by-the-person) for the levels and the check.

The code is a set of pure functions in `jobs/photo/`. Nothing under `app/` calls them (section 1).

## 1. What exists today

| Piece | Files | State on 2026-11-15 |
|---|---|---|
| Frame pool: blur floor, per-bin pick, near-duplicates | `pool.py` `keep()`, `dhash()` | Built. `test_score.py` passes. |
| Quality score, seven parts | `score.py` `score()`, `parts()`, `laplacian_var()` | Built. Run on Ben's three garments by `scripts/capture-real.mjs` with no masks. |
| Order and cap per site | `order.py` `plan()` | Built. Reads the cap from `research/list/ben/platforms/platform-fit.json`. `test_order.py` passes. |
| Crop and export size per site | `crop.py` `crop_for()` | Built. `test_crop.py` passes on the frozen mask fixture (9 cases). |
| Route choice and pass rates | `route.py` `offers()`, `update()`, `n_for()` | Built. `test_route.py` passes. |
| Gates, repair | `gates.py` `check()`, `run()`, `level0()`, `rank()`, `paste_back()` | Built for flaw, tag text and protected boxes. The rank numbers are not (P8). `test_gates.py` passes. |
| Marks at export | `export.py` `export()`, `ai_marked()` | Built. `test_gates.py` covers it. |
| Learning | `learn.py` `observe()`, `fold_gain()`, `fold_beta()`, guards | Built for pass and accept rates, gain and beta. Not built: the part-weight fit and the style counts (P10). Uses the fold in `jobs/capture/learn.py`. `test_learn.py` passes. |
| The mask | none | No code produces an item mask. `score()` and `crop_for()` take one as an argument (P2). |
| The caller | none | No route or job runner under `app/` calls any of it. A `photo_score` job result is read by `applyJobResult` in `app/src/edge/api/captures.ts` ([capture §5](capture.md#5-results-from-the-jobs)), and no runner sends one (P1). |
| The per-site plan | none | `order.plan()` returns slots, drops and `flaw_in_text`. Nothing joins the crop, the export size or the route offers into the plan shape in section 2 (P9). |

## 2. What it decides

| Output | Where it lands | State |
|---|---|---|
| The kept frames, one per role bin, near-duplicates dropped | `pool.keep()` returns `{kept, dropped, retake}` | Built. |
| A quality score 0 to 100 with its seven parts | `score.score()` returns `{score, parts}` | Built. `style` and `cover_ok` are not computed (P3). |
| The order and count per site | `order.plan()` slots with `photo_id`, `version_id`, `slot`, `reason` | Built. |
| The crop per site | `crop.crop_for()` returns `{crop, export_px, item_cut}` | Built, not joined to the plan. |
| The route per photo on Generate | `route.offers()` returns one `{photo_id, level, n, cost, value, reason}` per photo | Built, not joined to the plan. |
| The gate result per render | `gates.run()` returns `{status, image, attempts, reasons}` | Built. |
| The export mark | `export.export()` returns bytes and `{ai_marked, export_tag, exif_stripped, size}` | Built. |

The target plan, one per site, is `{site, slots: [{photo_id, version_id, slot, crop, export_px, reason}], dropped: [{photo_id, reason}], flaw_in_text, route_offers: [...]}`. Reasons are codes (`cover_true_color`, `hero_chosen`, `improved_chosen`, `coverage`, `flaw_kept`, `extra`, `over_cap`, `near_duplicate`, `lower_pick`, `blurred`, `replaced_by_improved`, `light_already_even`, `protected_role`, `best_value`) that any screen turns into words. The codes are the ones in the code; the earlier page's `cover_true_color` and `flaw_kept` stand.

Inputs come from capture ([capture §5](capture.md#5-results-from-the-jobs)), item research (confirmed flaws with boxes and severity, tag text), `platform-fit.json` (per-site cap, cover ratio, cover pixels: eBay 24, Facebook 10, Depop 8, Poshmark 16, Mercari 12, OfferUp 10, Grailed 25), and the person's Generate tap and level.

## 3. The calculation

For each step: does the code do it, and where.

1. **The pool.** Built in `pool.keep()`.
   - Bin is `role`. A `flaw` frame bins by `flaw_id`, so two flaws never merge (`test_two_flaw_ids_both_kept_even_if_look_alike`).
   - A frame is dropped as `blurred`, and its id goes to `retake`, when its Laplacian variance is under `photo_blur_ratio` times the best in its bin, or under `photo_blur_floor`. A lone blurred frame is still dropped (`test_below_floor_blurred_even_when_alone`). The page did not have this rule; the code is right, and it sends the person back to retake ([photo-expert-session §3](../../research/cross-cutting/nate/photo-expert-session.md)).
   - The pick is `0.5 sharpness + 0.2 exposure + 0.2 coverage + 0.1 score/100`. The code sums the raw weighted values, not ranks; card 21 says "weighted sum of ranks", so card or code changes. One winner per bin; the rest are `near_duplicate` or `lower_pick`.
   - A near-duplicate is a dHash Hamming distance of at most `photo_dup_bits`, or an embedding cosine above `photo_dup_cos`. The hash is not in the page; it is the cheap first test ([photo-expert-session §3.1](../../research/cross-cutting/nate/photo-expert-session.md)).
   - Duplicates are tested inside a bin only (`test_dedupe_never_crosses_bins`). The old page said "two kept frames" anywhere; the code is right, because a front and a back that look alike are two coverage photos.
   - Not in the code: the embedding model, the dHash and `lap_var` inputs are supplied by the caller. `dhash()` exists. Nothing computes the embedding.
2. **The quality score.** Built in `score.score()`.
   - Seven parts on 0 to 1, weighted 20, 15, 15, 10, 15, 10, 15 (`WEIGHTS`), summed to a rounded integer. Matches [Ben's photo-score](../../research/studio/ben/photo-score.md#the-score).
   - Measured on the mask when one is given. With no mask, fill, centring and background are 0.5, so they carry no signal (observed on the real run: item photos 69 to 77).
   - `tag`, `care_label`, `flaw`, `fabric` and `screenshot` score on sharpness, exposure and clipping only (`LABEL_ROLES`). Matches the page.
   - Not built: the vision model that labels the cover style and sets `cover_ok` (P3). `order.plan()` reads `cover_ok` and `score` from its input.
3. **The order per site.** Built in `order.plan()`; D8 governs. Where it differs from the old page, the code is right unless marked.

   | Step | Code |
   |---|---|
   | Cover | The real front with the highest score; eBay skips `cover_ok` false. With no front, the highest-scoring unprotected real photo (`hero_chosen`). Not built: the style share `W_s` tie-break (P3). |
   | Improved versions | Next, the front's first, then by score. A photo with an improved version appears once, as that version (`replaced_by_improved`), except the cover. |
   | Coverage | One each of `back`, `tag`, `care_label`, best score. Not built: the measurement view (P7). |
   | Flaws | Major first, then by score. |
   | Extras | Highest score first. |
   | Over the cap | Drop in order: extras, improved, `care_label`, `back`, minor flaws, major flaws; lowest score first within a tier. The cover, the improved front and the tag never drop. A dropped flaw goes to `flaw_in_text`. |

   The old page said every major flaw always stays and only minors move to the description. The code treats the site cap as hard: past it, majors move to the flaw list too (`test_majors_past_a_hard_cap_go_to_the_flaw_list_cover_and_tag_stay`). The code is right, because a site will not accept photos past its cap. [Proof test 2](#9-proof-today) is worded to match.
4. **The crop.** Built in `crop.crop_for()`.
   - 3:4 frame with the item inside the centred square. 1:1 sites get the square, Poshmark the full 3:4 frame, Grailed the 4:5 crop centred on the square. The square slides along the long side to hold the mask box plus `photo_crop_margin`.
   - It never pads. When no square holds the box it returns `item_cut: true` and `export_px: None`. Matches the page.
   - Export size is the smaller of the site's cover width and the crop width, never upscaled. eBay also needs a longest side of `photo_min_px_ebay`, else `export_px: None`.
   - Not built: the retake hint "Step back a little" from `item_cut` (nothing reads the flag); label and close-up crops around the label or flaw box (P7); the Poshmark branch always reports `item_cut: false` (P6). EXIF is stripped in `export.py`, not here.
5. **The route.** Built in `route.offers()`.
   - Levels 1 to `min(ceiling, 2)`. Level 0 for tag, care label, flaw, screenshot, serial and `use == raw`, with reason `protected_role`.
   - `n` is the smallest count with `1 - (1 - p)^n >= photo_route_target`, at most `photo_route_n_max`.
   - `value = gain x weight x beta x price_estimate - price_per_call x n`, weight 1.0 for the cover and 0.3 for the rest. Matches the page and the worked example below. The highest positive value wins; none positive gives level 0, `light_already_even`.
   - `p` is the Beta mean from `rates`, prior Beta(2, 2). Not in the page: a route with 1 to 4 trials (fewer than `photo_explore_trials`) is tried at mean plus one standard deviation, and a route with none gets the plain mean (so the bare prior keeps `n = 3`), so a demoted route does not starve (`test_route_that_fails_is_demoted_for_the_untried_one`, `test_new_route_is_explored_with_mean_plus_sd`). The code is right; it is the usual exploration bonus.
   - Not built: re-lay (levels 3 and up are not offered); the ceiling across sites (the caller passes one number); the per-site pick of the highest passing version at or under its ceiling; the provider price (a caller argument). P9.
6. **The gates.** Built in `gates.check()` and `run()`, cheapest first.
   - Blocks, in order: `size_changed`, `flaw_vanished` (a flaw box keeps under `photo_flaw_keep` of its dark pixels), `protected_box_changed` (any pixel differs), `tag_text_changed` (an injected reader).
   - On a block: render again once, then paste the real pixels back into every flaw, protected and tag box for up to `photo_repair_rounds`, then `kept_real`.
   - Level 0 is exact by construction: `level0()` is a per-channel gain, and `differs_outside_transform()` checks it.
   - `rank()` drops a render under `photo_same_item_floor`. It takes `delta_e` and does nothing with it. Not built: ΔE00 at most 2.0, SSIM on the edge band, halo, background, and the re-lay ratio check (P8).
   - A flaw counts only if it is dark (`photo_flaw_dark_max`). That fits the planted fixture and no real stain or fade (P8).
7. **Marks.** Built in `export.export()`. `ai_marked` is true when a model drew pixels (`DREW`: levels 1 and 2, re-lay, paste-back, render, spin, generated) and false for `raw` and `level0`. `export_mark` takes `none`, `site_required` or `retouched` and only adds an IPTC `DigitalSourceType` XMP tag. The JPEG is saved fresh, so EXIF, GPS and any vendor credential are gone. Matches the page. A `paste_back` photo is marked, which is right: a model drew most of it.

## 4. Thresholds

Every constant in `jobs/photo/` is a Python constant today. None is a `param` row. Fix P4 turns each into one, with the prior below as its value, so it can be learned and rolled back like capture's. The names are *agent proposal*.

| Param (proposed) | Prior and where it lives now | Where it comes from |
|---|---|---|
| `photo_pick_w` | 0.5, 0.2, 0.2, 0.1 in `pool._pick` | Card 21 |
| `photo_dup_cos` | 0.95 in `pool._dup` | Card 21 |
| `photo_dup_bits` | 10 in `pool._dup` | [photo-expert-session §3.1](../../research/cross-cutting/nate/photo-expert-session.md): "around 10 of 64 bits is a common starting point" (*asserted* there); to be set from the fixture |
| `photo_blur_ratio` | 0.5, a default of `pool.keep` | Same session §3: *agent proposal* |
| `photo_blur_floor` | 100.0, a default of `pool.keep` | The usual 100, dataset-dependent (*observed* there); the session says set it from the fixture, and compute it on a 1080 px grey image. The code takes `lap_var` from the caller at whatever size (P5) |
| `photo_sharp_k` | 300.0 in `score.SHARP_K` | The code comment: calibrated on synthetic cell texture (var 1000 and over scores above 0.95; a 3 px blur scores under 0.1). Not calibrated on phone photos (P5) |
| `photo_weight_<part>` | 20, 15, 15, 10, 15, 10, 15 in `score.WEIGHTS` and `learn.PART_WEIGHTS` (two copies, P4) | Ben's photo-score, *agent proposal* |
| `photo_exposure_target`, `photo_contrast_full`, `photo_clip_lo`, `_hi`, `_k`, `photo_fill_full`, `photo_bg_full` | 0.5 mean, 0.25 std, 3 and 252, 5, 0.5 mask share, 0.25 std, in `score.parts` | The part bands of Ben's photo-score (*agent proposal* there); the code does not cite them |
| `photo_neutral` | 0.5 in `score.parts` | Code choice: unknown parts are neutral |
| `capture_label_sharp_min` | 0.5, a real param, in `captures.ts` | [capture §3](capture.md#3-thresholds) |
| `photo_crop_margin` | 0.02, a default of `crop_for` | Card 8 |
| `photo_min_px_ebay` | 500 in `crop.MIN_PX` | The code comment says ebay.md states it; `platform-fit.json` has no pixel minimum. Source not checked |
| `photo_route_target`, `photo_route_n_max` | 0.8, 4 in `route.n_for` | Card 9 |
| `photo_rate_prior` | Beta(2, 2) in `route.PRIOR` and the fold | Card 9: gives `n = 3` |
| `photo_explore_trials` | 5 in `route.EXPLORE_BELOW` | Code choice, *agent proposal*; assumes the prior is (2, 2) |
| `photo_gain_cover`, `photo_gain_other` | 0.05, 0.02 per level in `route.offers` and `learn.GAIN_PRIOR` (two copies, P4) | Card 9 |
| `photo_route_weight_other` | 0.3 in `route.offers` | Card 9 |
| `photo_beta` | 1.0 in `route.offers` and `learn.BETA_PRIOR`, guard 0 to 3 | Card 9 |
| `photo_level_max` | 2 in `route.offers` | Code choice: re-lay is not built |
| `photo_flaw_dark_max` | 45 in `gates.FLAW_DARK_MAX` | The planted fixture (`spec/fixtures/planted/cases.json`), not real flaws (P8) |
| `photo_flaw_keep` | 0.5 in `gates.FLAW_KEEP` | Code choice |
| `photo_same_item_floor` | 0.90 in `gates.SAME_ITEM_FLOOR` | The earlier page; no source recorded, *agent proposal* |
| `photo_repair_rounds` | 2 in `gates.REPAIR_ROUNDS` | The earlier page; no source recorded, *agent proposal* |
| `photo_delta_e_max` | 2.0, not in the code | The earlier page; no source recorded, *agent proposal* (P8) |
| `photo_jpeg_quality` | 90, subsampling 0 for tag, label, flaw and screenshot roles, else 2, in `export.export` | Code choice |
| `photo_weight_band` | 0.5 in `learn.WEIGHT_BAND` | The page's ±50% guard |
| `photo_promote_items` | 30, `MIN_ITEMS` in `jobs/capture/learn.py` | Card 9's count; shared with capture |

## 5. Learning and speed

Built: `learn.observe()` updates pass and accept rates per (route, kind) as Beta from Beta(2, 2); `fold_gain()` and `fold_beta()` run the shared fold, which promotes a challenger only on held-out days and rolls back on a worse one. `weight_guard()` and `gain_guard()` bound each value. `test_learn.py` covers each.

Not built: the nightly logistic and Poisson fit of the seven part weights, and the hourly cover-style counts that feed `W_s` (P10). Nothing calls the fold.

Speed budgets, p95: mask and score per photo 300 ms on the worker; pool, order and crops for every site at draft under 50 ms; route choice for an item under 20 ms; gates per render under 2 s; export of one photo under 1 s. None is measured (P11).

## 6. What the person sees

Any screen reads the per-site plan. Outputs, not a layout:
- per site, the set in order with the crop applied, and one line built from the reasons ("8 photos for Depop, real front first, both marks kept");
- on eBay and Etsy, "One real photo stays first" ([studio](../features/studio.md#photo-order-and-sites));
- a crop that would cut the item shows "Step back a little" at capture;
- on Generate, each photo's level and the total model cost; "Light was already even" at level 0; no level on tag, label or flaw photos;
- on a block, which photo and why, then the real photo; dropped photos under the set with their reason, one tap to put one back.

## 7. What is wrong: named fixes and their tests

| Fix | What is wrong | The test that will prove it |
|---|---|---|
| P1 | Nothing calls `jobs/photo`, and no runner sends `photo_score` to `applyJobResult` | A capture with a blurred tag photo gets a retake in the next GET's plan, from a runner that ran `score()` on the stored photo |
| P2 | No code produces the item mask, so fill, centring and background sit at 0.5 and crops cannot run | `score()` on Ben's three garments with a mask moves those three parts off 0.5, and `crop_for` returns a crop for each site (`node scripts/capture-real.mjs`) |
| P3 | The cover style label, `cover_ok` and the `W_s` share are not built; `order.plan()` takes `cover_ok` as given and picks the cover by score only | A photo with text on it gets `cover_ok` false and is never the eBay cover; with 10 or more winners and a lead past the noise floor, the higher-share style wins over a higher score |
| P4 | Every constant is a Python constant; three of them are copied (weights, gain, beta) between `score`/`route` and `learn.py`; the `photo_` names are not registered | Each constant is read as a param with the prior above; changing `photo_blur_floor` flips a frame in `pool.keep`; one copy of each prior remains |
| P5 | `SHARP_K` and the blur floor come from synthetic images, and the blur floor is meant for a 1080 px grey image while `laplacian_var` runs at native size | On 30 real label photos Ben marks sharp or blurred, `capture_label_sharp_min` separates them with at most 2 wrong |
| P6 | `crop_for` always reports `item_cut: false` for Poshmark's 3:4 frame, even when the mask leaves the frame | A mask wider than the 3:4 frame gives `item_cut: true` (`test_crop.py`) |
| P7 | The measurement view is not in the coverage set; labels and close-ups are not cropped around their box; `item_cut` has no retake hint | A `measurement` photo takes a coverage slot ahead of extras (`test_order.py`); a label crop contains its box |
| P8 | The gates catch only dark flaws; ΔE00, SSIM, halo, background and the re-lay ratio are not built; `rank()` ignores `delta_e` | A planted pale stain that vanishes blocks; a render with ΔE00 over `photo_delta_e_max` ranks below one under it (`test_gates.py`) |
| P9 | The per-site plan in section 2 is never assembled: crop, export size and route offers are separate calls, and the per-site highest passing version is not chosen | One function returns the full plan for a site, and its `crop` and `export_px` equal `crop_for`'s |
| P10 | The part-weight fit and the style counts are not built | A planted shift in sales moves a weight only past `photo_promote_items` and inside the ±50% band, and the rollback restores the prior |
| P11 | No speed budget is measured | The budgets in section 5 on the fixed set, recorded in a log |
| P12 | When the cover, tags and improved front alone exceed a site's cap, `plan()` returns more slots than the cap | A cap of 2 with a cover, a tag and an improved front returns at most 2 slots, with the rest in `flaw_in_text` or `dropped` (`test_order.py`) |

## 8. What comes next, in order, each with its measure

1. **P2, the mask.** Measure: on the three real garments, the three mask-dependent parts move off 0.5 and no site crop reports `item_cut` wrongly, checked by Ben's eye.
2. **P1, a runner and P5, calibration.** Measure: on 30 real label photos, at most 2 sharp-versus-blurred calls wrong at the chosen floor, and a blurred tag photo triggers a retake end to end.
3. **P9, the plan, with P6, P7, P12.** Measure: on the 30 fixed items, no more than 2 lose part of the item in any 1:1 crop (card 8's bar is 1 in 10), and every major flaw is in the set or the flaw list on Depop's 8.
4. **P3, cover style and `cover_ok`.** Measure: on 30 real covers, the label agrees with Ben's call on at least 27, and no eBay cover has text.
5. **P8, real gates.** Measure: all planted changes block, now including pale flaws; no clean edit blocks.
6. **P4 and P10, params and learning.** Measure: a planted shift promotes a challenger only past 30 items and the bootstrap noise, and the rollback restores the prior.
7. **Live proof.** Measure: in D22 matched pairs on live listings, views per day higher with the engine's order and cover, by a D23 posterior of at least 0.95. This needs listings and is not before the earlier steps.

## 9. Proof today

| What | Command or source | Result |
|---|---|---|
| The six jobs | `./.venv/bin/python -m pytest jobs/photo/test_<f>.py -q`, for score, order, crop, route, gates and learn, run on the Mac on 2026-11-15 | All six files pass |
| Crops (test 1) | `test_crop.py` on 9 mask cases in `spec/fixtures/mask/cases.json` | Passes. These are fixture masks, not real items |
| Flaws through the cap (test 2) | `test_order.py`, major flaws past a hard cap | Passes on built-in cases, not on 30 real items |
| Planted changes (test 3) | `test_gates.py` on `spec/fixtures/planted/cases.json`: 100 planted changes, 10 clean, 15 level 0 cases on synthetic images | Passes. The flaws are dark discs, so this does not show real flaws block |
| Export mark (test 4) | `test_gates.py`, `test_export_mark_changes_only_bytes_not_order_or_marks` | Passes |
| Route cost (test 5) | `test_route.py`, protected roles and negative value | Passes |
| One real run | `node scripts/capture-real.mjs` (`spec/items/capture-real/2026-11-15.json`), Ben's three garments, no masks | Item photos scored 69 to 77, tag photos 90, 70 and 94. One run on three items, not accuracy |
| The live result and speed (tests 6 and 7) | none | Not run |

## 10. Protections

- A flaw photo, tag, care label or serial is never edited above level 0 (`route.PROTECTED`); a vanished flaw is a hard block that is never shown.
- The cover is a real photo the person took; a render never sizes the item.
- `ai_marked` is set by what drew the pixels; the export mark only adds tags.
- Photos of a person are used only as listing photos.
- EXIF, including location, is stripped from every exported file (`export.py`).
- No model call happens without the Generate tap, and the cost shown is the cost charged.

## 11. Rivals

[Photoroom, eBay and Depop's own editors, Poshmark's cover background and the crosslisters](../../research/studio/nate/editing-alternatives.md#1-photoroom-api) edit one photo for one site. No rival is recorded as keeping every flaw through a site's cap or proving that an edited photo still shows the same item. Ours aims at both, and the proof for both is the planted fixture today and the live pairs later (section 8).

## Worked example

All numbers are examples.

A wool coat with two marks, priced at a p50 of $120, going to Depop and Poshmark. Capture keeps 11 frames: front (two, flat and hanger), back, label, care label, measurement view, two flaw close-ups, three details. The pool drops the hanger front first, as `near_duplicate` of the flat front (same bin), so 10 frames reach `order.plan()`. On Depop (cap 8) the order is the flat front, back, label, care label (coverage, right after back and label), both flaws, then the two highest-scoring extras. The extras are the three details at 71, 66 and 58 and the measurement view at 50 (today it is an extra, P7); the 58 detail and the measurement view drop with `over_cap`. That is 8 slots. Poshmark (cap 16) takes all 10.

The person turns on light (level 1) and taps Generate. For the cover, `p = 0.5`, so `n = 3` (`1 - 0.5^3 = 0.875`), at $0.04 a call, `cost = $0.12`; `value = 0.05 x 1.0 x 1.0 x 120 - 0.12 = $5.88`, so it runs. For the back, `value = 0.02 x 0.3 x 1.0 x 120 - 0.12 = $0.60`, so it runs too. The label and both flaws get no route. One back candidate blocks because a patch over a mark vanished; the other two rank, and the best passes at ΔE00 1.1.
