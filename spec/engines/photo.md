# Photo engine

*agent proposal*, the whole file. Written 2026-11-14.

Turns one capture into each site's photo set: which frames are kept, their order and crop per site, a quality score for every photo, and which retouch route runs when the person taps Generate. It joins four cards that already exist: [card 21](../determinations/seeing-the-item.md#21-which-frames-become-listing-photos-and-in-what-order) (the frame pool), [D8](../determinations/listing-and-marketing.md#d8-photo-choice-and-order) (the order, owned by list), [capture-shots card 8](../determinations/capture-shots.md#8-the-one-frame-and-each-sites-crop) (the crops) and [card 9](../determinations/capture-shots.md#9-which-retouch-route-runs-for-a-photo) (the route), with [studio](../features/studio.md#retouch-chosen-by-the-person) for the levels and the check. The engine's output is a per-site photo plan in a job result, so it works with any screen, and every mark decision sits in one export step, so it works whichever way the export tag is settled.

## 1. What it decides

| Output | Where it lands |
|---|---|
| The kept frames: one per role bin, near-duplicates dropped | `photo` rows with `role` ([product §3](../product.md#3-the-data-model)); the rest stay in the capture and are never listed |
| A quality score, 0 to 100, for every kept photo and every render, with its seven parts | a new `photo.quality` field `{score, parts{}, style, cover_ok}`; the cover pick and the extras order read it |
| The order and the count per site | `strategy.photo_order[]`, one row per site, extended with a crop and a reason per slot (the per-site photo plan below) |
| The crop per site and per slot | the plan's `crop {x, y, w, h}` and `export_px` |
| The retouch route per photo on Generate: level, number of candidates, cost and value | the `studio` job's result as `route_offers[]` |
| Which version each site gets, and its export mark | the plan's `version_id` and the export step's `export_mark` |

The per-site photo plan, one per site in the item's set:
`{site, slots: [{photo_id, version_id, slot, crop, export_px, reason}], dropped: [{photo_id, reason}], route_offers: [{photo_id, level, n, cost, value, reason}]}`. Reasons are codes (`cover_true_color`, `flaw_kept`, `over_cap`, `near_duplicate`, `light_already_even`, ...) that any screen turns into words.

## 2. Signals

| Signal | Row or source | Used for |
|---|---|---|
| Every captured frame with its bin (role), sharpness, exposure and coverage | capture, `photo` with `role` | the pool (card 21) |
| The item mask | BiRefNet on each kept photo, SAM 3 on edge failures ([card 22](../determinations/seeing-the-item.md#22-whether-a-touched-up-photo-is-faithful-to-its-original)) | fill, centring and background parts, the crop, the gates |
| Confirmed flaws with their boxes, the tag and label OCR text | item research, `photo` roles `flaw`, `tag`, `care_label` | the coverage set, protected boxes, the blocks |
| The coverage set for the kind | the `requirement` registry (front, back, label, each flaw, the measurement view) | D8 rank 1 |
| Per-site cap, cover ratio, cover size and preset level | [platform-fit.json](../../research/list/ben/platforms/platform-fit.json): eBay 24, Facebook 10, Depop 8, Poshmark 16, Mercari 12, OfferUp 10, Grailed 25 | truncation, crop, export size, the route ceiling |
| Cover rules | D8: eBay no text, border or stock photo on a used item's cover; Poshmark a 3:4 cover | the cover gate |
| The person's level and the Generate tap | retouch off by default; the level the person picks per site is the ceiling ([Nate](../../product/words.md#2026-11-14-nate-answers-to-the-first-ten-questions-for-ben)) | whether the route runs at all |
| Gate results per render | studio's check: block, rank numbers, `render_same_item` | pass rates per route and kind |
| The person's choice per render | `studio_approve`: `use_improved`, `use_real`, `redo`, `fix_texture` | accept rates per route and kind |
| Interest and sale per listing | `listing.interest {views?, watchers?, likes?}` through `read_stats` (job `poll_stats`), sale within 30 days | the score weights, the cover style share, the value of a score point |
| The provider's per-call price | read from the provider at run time (card 9) | the route's cost |
| The item price estimate | the fair range's p50 from price | the route's value |

## 3. The calculation

Steps marked **model** call a learned model; the rest are arithmetic or rules.

1. **The pool (arithmetic, one model).** Card 21's per-bin pick: `pick = 0.5 sharpness + 0.2 exposure + 0.2 coverage + 0.1 score`, each on 0 to 1; the best frame in each bin is kept. Two kept frames whose image embeddings (**model**) sit above 0.95 cosine are near-duplicates and the lower `pick` is dropped. Flaw close-ups are kept per confirmed flaw, never merged.
2. **The quality score (arithmetic, one model).** [Ben's photo-score](../../research/studio/ben/photo-score.md#the-score): seven parts on 0 to 1, weighted to 100 (exposure 20, contrast 15, sharpness 15, clipping 10, fill 15, centring 10, background 15), measured on the mask. A vision model (**model**) labels the cover style (flat, worn, hanger, plain background) and sets `cover_ok` false on text, a border or a stock look. Labels and close-ups are scored on sharpness, exposure and clipping only, since fill and centring mean nothing for a care label.
3. **The order per site (rules).** List owns the order, so D8 governs and card 21 supplies the pool:
   1. The cover: the true-colour real front at level 0 ([studio](../features/studio.md#photo-order-and-sites): the evidence photo is first on every site). With several real fronts, the one whose style holds the higher share in `W_s` for this site and kind wins when D8's rule allows (10 or more winners and a lead over the noise floor); otherwise the higher score. A cover with `cover_ok` false is never the cover on eBay.
   2. Chosen improved versions (`use = improved`), the front first, then 3D or spin renders on rigid items.
   3. The rest of the coverage set: back, label, measurement view, then each flaw.
   4. Extras, highest score first.
   5. Over the cap, drop extras from the lowest score, then improved versions other than the front, then coverage photos other than the label. The cover, the label and every major flaw always stay. When the major flaws alone exceed the cap, the minor flaws move into the description's flaw list and the plan says so (`flaw_in_text`).
   A photo with a chosen improved version appears once, as that version, except the front, which appears as both the evidence photo and its improved version.
4. **The crop (arithmetic).** Card 8's frame: 3:4 with the item inside the centred square. 1:1 sites get the square, Poshmark the full 3:4 frame, Grailed the 4:5 crop centred on the square. When the mask's box leaves the centred square, the square slides along the long side to contain the box with a 2% margin. When no square holds the box, the photo never pads (Ben's `crop_for()` rule): the plan marks `item_cut` and capture shows the retake hint "Step back a little". Labels and close-ups crop from the full-resolution still to the site's other ratio around the label or flaw box. Export size is the site's cover size from platform-fit when the source holds it, never upscaled; EXIF is stripped (`exif_stripped`).
5. **The route on Generate (arithmetic over learned rates).** Retouch is off by default and runs only on Generate. Level 0 runs for every photo at capture, with no model cost. Tag, care label, serial and flaw photos get no route above level 0. For each other photo, at each level `L` from 1 to the ceiling (the highest level the person picked on any site in the set; pressed is never a preset), and re-lay when the person asked for it:
   - `p_L` is the pass rate, a Beta per (route, kind); `n_L` is the smallest count with `1 - (1 - p_L)^n >= 0.8`, at most 4.
   - `cost_L = per-call price x n_L`.
   - `value_L = gain_L x weight x beta x price_estimate - cost_L`, where `gain_L` is the expected rise in the 0 to 1 score, `weight` is 1.0 for the cover and 0.3 for the rest, and `beta` is the learned value of a score point as a share of price (prior 1.0, which makes it card 9's formula).
   - The route with the highest positive value runs. With none positive, the offer is level 0 with "Light was already even".
   Each site then gets the highest passing version at or under its own ceiling, else level 0.
6. **The gates (rules over two models).** Studio's check, cheapest first. Blocks: a vanished flaw, changed tag OCR text, a changed protected box (logos, each flaw). Pixel equality after the same transform holds at level 0, and on paste-back inside the pasted region, by construction. Everything else ranks: ΔE00 at most 2.0, SSIM on the edge band, halo, background, and `render_same_item` (**model**) with a floor of 0.90 below which the render is dropped. Re-lay outside 5% of the measured width-to-length ratio is dropped. On a block: retry once, then repair by blending real pixels back for up to 2 rounds, then the photo is `kept_real`.
7. **Marks (rules).** `ai_marked` is true when a model drew pixels (levels 1 and 2, re-lay, renders) and false at level 0, which only changes white balance and exposure. A per-site export setting `export_mark` takes `none`, `site_required` (the tag a site requires, added where it requires one) or `retouched` (a tag on every `ai_marked` photo). It applies only in the export step that writes the file a site receives; nothing upstream reads it. The model vendor's own content credential is kept in the render record and never passed through to the exported file unless `export_mark` asks for a tag.

## 4. Learning

All values are `param` rows ([data](../features/data.md#real-time-weights-agent-proposal)), read through the 60 s cache.

| When | What updates | How |
|---|---|---|
| Per event | the pass rate `p` per (route, kind) on every gate result; the accept rate per (route, kind) on every `studio_approve` | conjugate Beta update in the outcome's transaction |
| Hourly | the cover style counts per (site, kind, style) from the `poll_stats` interest deltas | sums into `W_s`, D8's cover style share |
| Nightly, by `param_fold` | (a) the seven part weights: a logistic fit of sale within 30 days and a Poisson fit of views per day on the parts, with price over fair p50, site and kind as controls; (b) `gain_L` per (level, kind): the mean score rise of passed renders; (c) `beta` per kind: from D22 matched pairs, improved cover against real cover on the same item kind and price band | challengers, promoted below |

**The prior.** Ben's weights; card 9's gain starts (0.05 per level for the cover, 0.02 for others); `beta` 1.0; pass rate Beta(2, 2), which gives `n = 3` until rates arrive.

**Switching to learned values.** A challenger replaces its prior only after 30 items of the kind carry check numbers (card 9's count) and its backtest on the last 30 days beats the champion by more than the 1,000-draw bootstrap noise. Weights stay within ±50% of the prior and never go negative; `beta` stays within 0 to 3. A move over 2 SE raises an `anomaly`. A weight is `frozen` while a D22 test runs on its scope.

**Rollback.** One UPDATE sets the prior version back to `champion`.

## 5. Speed

| Step | Budget, p95 |
|---|---|
| Mask and quality score per photo | 300 ms on the worker |
| Pool, order and crops for every site at draft | under 50 ms |
| Route choice for an item on Generate | under 20 ms, before any model call |
| Gates per render | under 2 s |
| Export of one site's set | under 1 s per photo |

Level 0 finishes before the person reaches the draft, so a set with no retouch is ready with no wait; renders stream into the plan as they pass.

## 6. What the person sees

Any screen reads the per-site plan; these are its outputs, not a layout.

- Per site, the set in order with the crop applied, and one line built from the reasons, such as "8 photos for Depop, real front first, both marks kept".
- On eBay and Etsy, "One real photo stays first" ([studio](../features/studio.md#photo-order-and-sites)).
- A crop that would cut the item off shows the cut site and "Step back a little" at capture.
- On Generate, each photo's chosen level and the total model cost; a photo left at level 0 says "Light was already even"; tag, label and flaw photos show no level.
- On a block, which photo and why, then the real photo in its place.
- Dropped photos sit under the set with their reason, one tap to put one back, which moves the lowest extra out.

## 7. How it beats what exists

As strong as the evidence in [platform-fit](../../research/list/ben/platform-fit.md#photos-under-the-touch-up-rule), the [editing alternatives](../../research/studio/nate/editing-alternatives.md#1-photoroom-api) and the [suite map](../../research/cross-cutting/nate/shopify-suite-map.md).

| Rival | What it does | Ours |
|---|---|---|
| Photoroom (and Vendoo, which offers its background removal, *asserted*) | background removal and AI backgrounds per image, $0.02 to $0.10 a call (*observed*) | one capture becomes every site's set, ordered and cropped per site; a model runs only where the value beats the call price |
| eBay's AI scene backgrounds, Depop's background remover | an edit on one site's photos (*observed*) | one checked set for all seven sites, with a vanished flaw or a changed tag blocked before it is shown |
| Poshmark's automatic white cover background | replaced on web in Nov 2025, reverted within a day (*observed via a reseller note*) | the person picks the level; nothing changes a cover without them |
| Flyp's background remover and other crosslisters | one edit copied to every site (*asserted*) | per-site order, crop, cap and cover rule from one plan; flaws are kept when a cap bites |

No rival is recorded as keeping every flaw through a site's cap or proving that an edited photo still shows the same item; ours does both, measured by the proof below.

## 8. Protections

- A flaw photo, tag, care label or serial is never edited above level 0, and a vanished flaw is a hard block that is never shown.
- The cover on every site is a real photo the person took. A render never sizes the item.
- `ai_marked` is set by what drew the pixels, not by a screen or a setting; the export mark only adds tags, never removes `ai_marked`.
- Photos of a person (a worn style cover) are used only as listing photos; no facet, face or body trait is drawn from them.
- EXIF, including location, is stripped from every exported file.
- No model call happens without the Generate tap, and the cost shown before it is the cost charged.

## 9. Proof

The fixed set: 30 real items across clothing, shoes, bags and one rigid kind, each captured once on the team's own phones, with their confirmed flaws, tag text and the seven sites' caps, frozen as one table version. 100 edits with planted changes from card 22 ride on the same items.

| Test | Passes when |
|---|---|
| 1 Crops | no more than 2 of the 30 items lose part of the item in any 1:1 crop (card 8's bar is 1 in 10) |
| 2 Flaws through the cap | on Depop's 8, every major flaw of every item is in the set or, past the cap, in the flaw list |
| 3 Planted changes | all 100 planted vanished flaws and changed tag texts block; no level 0 output differs outside its transform |
| 4 Export mark | the same item exported under `none`, `site_required` and `retouched` differs only in the export step's bytes; `ai_marked` and the order are identical |
| 5 Route cost | no route runs where its value is negative on the fixture's prices; no photo of a protected role gets a route |
| 6 The result that counts | in D22 matched pairs on live listings, the engine's order and cover against the order as captured: views per day higher by a D23 posterior of at least 0.95 |
| 7 Speed | the budgets in section 5 on the fixed set |

## 10. Build tasks

Code under `jobs/photo/`, each task in the [task shape](../plans/README.md#2-the-task-shape) when planned; all build in parallel against the frozen fixture.

| Task | Owns | Depends on | Proves with |
|---|---|---|---|
| ph-1 Pool and quality score | `pool.py`, `score.py`, `test_score.py` | none | `python -m pytest jobs/photo/test_score.py` |
| ph-2 Order and truncation per site | `order.py`, `test_order.py` | ph-1 interface | `python -m pytest jobs/photo/test_order.py` |
| ph-3 Crops and export size | `crop.py`, `test_crop.py` | the mask fixture | `python -m pytest jobs/photo/test_crop.py` |
| ph-4 Route choice and pass rates | `route.py`, `test_route.py` | ph-1 interface | `python -m pytest jobs/photo/test_route.py` |
| ph-5 Gates, repair and marks at export | `gates.py`, `export.py`, `test_gates.py` | the planted-change fixture | `python -m pytest jobs/photo/test_gates.py` |
| ph-6 Learning: fold, promote, rollback | `learn.py`, `test_learn.py` | ph-1 and ph-4 interfaces | `python -m pytest jobs/photo/test_learn.py` |

## Worked example

All numbers are examples.

A wool coat with two marks, priced at a p50 of $120, going to Depop and Poshmark. Capture keeps 11 frames: front (two, flat and hanger), back, label, care label, measurement view, two flaw close-ups, three details. On Depop (cap 8) the order is the flat front (flat holds the higher style share on Depop for coats), back, label, measurement view, both flaws, then the two highest-scoring details at 71 and 66; the third detail at 58 and the hanger front drop with `over_cap` and `near_duplicate`. The line reads "8 photos for Depop, real front first, both marks kept". Poshmark (cap 16) takes all 10 that were not near-duplicates.

The person turns on light (level 1) and taps Generate. For the cover, `p = 0.5`, so `n = 3` (`1 - 0.5^3 = 0.875`), at $0.04 a call, `cost = $0.12`; `value = 0.05 x 1.0 x 1.0 x 120 - 0.12 = $5.88`, so it runs. For the back, `value = 0.02 x 0.3 x 1.0 x 120 - 0.12 = $0.60`, so it runs too. The label and both flaws get no route. One back candidate blocks because a lint patch over a mark vanished; the other two rank, and the best passes at ΔE00 1.1.
