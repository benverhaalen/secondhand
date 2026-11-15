# Capture engine

*agent proposal*, the whole file. Written 2026-11-14.

Decides, for one capture session, which type the item is, which process the person follows, which extra view is worth asking for, when to stop, and which follow-up inputs remain. It follows Nate's flow ([words](../../product/words.md#2026-11-14-nate-finalised-the-intelligence-engine-the-listing-swarm-the-buying-engine-and-how-capture-works)) as specified in [capture](../features/capture.md#what-the-person-does-and-sees), against Ben's list-first decision, which stays open there ([Open 2](../features/capture.md#open-for-ben-and-nate)). It joins cards that already exist: [card 1](../determinations/seeing-the-item.md#1-item-kind) (the kind), [card 3](../determinations/seeing-the-item.md#3-what-must-still-be-captured-and-when-it-is-enough) (what is still needed), [card 17](../determinations/seeing-the-item.md#17-which-question-to-ask-next-and-when-to-stop) (the next question and the stop), [capture-shots](../determinations/capture-shots.md#default-plans-by-kind) (the plans, the worth and cost of a shot) and [asking-and-intent card 7](../determinations/asking-and-intent.md#7-which-option-is-preselected-and-when-none-is) (preselection). Names follow [product.md](../product.md); the depth model is [marketing-engine](../marketing-engine.md). The engine's outputs are fields on the `capture` row and `clarify` decisions, so any screen can show them and both openings in Open 2 run on the same engine.

## 1. What it decides

| Output | Where it lands |
|---|---|
| The suggested type, one of the 14 families, and whether it is preselected | `capture.suggested_type`; the picker order and the preselect flag in the `POST /v1/captures` response |
| The process for the picked type | `capture.process[]` `{step, kind (instant, series, scan), role, needs_lidar}`, from the type's plan in capture-shots, with the no-LiDAR substitution applied |
| The next view, or none | a `missing_shot` or `retake` decision with the unmet `requirement` row it settles |
| When the session stops asking | `coverage.needed[]` empty of view-settled rows, or the person's Done; the rest written `unknown_reason: not_visible` |
| A type swap | `PATCH /v1/captures/:id {type}` from `capture_judge` when it is sure, or `category_unsure` when it is not |
| The follow-up inputs, in order, at most 3 | `clarify` decisions with the widget, the options and the preselected value ([follow-up table](../features/capture.md#follow-up-inputs-by-type)) |

## 2. Signals

| Signal | Row or source | Used for |
|---|---|---|
| The first frame's class over the 14 families | Apple Vision classification on the phone, with plane (flat on a surface or standing), outline softness and LiDAR extent | the suggestion |
| The person's past picks and confirmed types | `capture.type` against the confirmed `item.category` | the suggestion's prior per person |
| The type's rows | `requirement` with `fill_ladder[]`, `views_needed[]`, `seconds`, `effort`, `importance`, priority | the process, the next view, the follow-ups |
| On-device gates per frame | sharpness, exposure, coverage, glare on the label region | auto-shutter, `retake` |
| Pose and depth | ARKit at 5 Hz, depth confidence | scan coverage, `measured` rows |
| Text and codes read | Vision OCR and barcode on the phone, PP-OCRv5 in the job | `label` rows met, lookups started |
| The early product match | identify's first-still candidates ([identity](identity.md)) | `lookup` rows met, the type check |
| The fair range for the item | valuation's p50 and its spread ([valuation](valuation.md)) | a view's worth in money |
| Answer rates per follow-up | `clarify` outcomes: answered, preselect kept, changed, ignored | the order of follow-ups |

## 3. The calculation

Steps marked **model** call a learned model; the rest are arithmetic or rules.

1. **The suggestion (one model, then arithmetic).** The phone's classifier (**model**) gives `p(family)` over the 14 families plus other. It is multiplied by the person's prior (a Dirichlet over their confirmed types, weight 5 items) and renormalised. The picker lists all 15, top 5 shown, in that order. The top family is preselected only when it leads the second by card 7's margin; otherwise nothing is.
2. **The process (rules).** The picked type's plan from capture-shots becomes `process[]`. On a phone without LiDAR each `scan` becomes the 8-still ring, and its `measured` rows move to `lookup`, then to a typed value. `other` starts `instant` front and adds a `scan` when the first frame shows a rigid item over 10 cm by LiDAR extent or plane.
3. **The type check (one model).** On the first kept still `capture_judge` (**model**) runs card 1 on the masked crop. If it names another family with probability at least 0.9 and the picked family under 0.1, it swaps the type, keeps every photo and raises the new type's missing frames. Between those bounds it raises `category_unsure` with the two families first. Otherwise the pick stands.
4. **The next view (arithmetic).** For each unmet row a view can settle: `worth = importance x p(view fills it) x value_at_stake`, where `value_at_stake` is the row's share of the fair range's spread ([capture-shots card 2](../determinations/capture-shots.md#2-what-a-shot-is-worth)). `cost = seconds x effort` ([card 4](../determinations/capture-shots.md#4-what-each-shot-costs-in-seconds)). Steps in `process[]` are always asked. A view outside it is asked when `worth / cost` passes [capture-shots card 3](../determinations/capture-shots.md#3-whether-an-extra-shot-is-asked)'s bar. The highest ratio goes first; one instruction at a time.
5. **The stop (rules).** Card 17: stop when no remaining view passes the bar, or after two retakes on the same row (the shot is kept with a flag), or on Done.
6. **The follow-ups (arithmetic over learned rates).** The `asked` rows of the type, plus any `lookup` row still empty, are ranked by `importance x (1 - p(preselect is right))`, with condition and wear always first as one step. At most 3 are sent. A fact that a kept frame settles is never asked. `function` is never preselected.

## 4. Learning

All values are `param` rows ([data](../features/data.md#real-time-weights-agent-proposal), [assessment](../assessment.md#real-time-weights)), read through the 60 s cache.

| When | What updates | How |
|---|---|---|
| Per event | the confusion counts per (suggested family, confirmed family); the follow-up rates per (type, fact): answered, preselect kept, changed, ignored; `p(view fills it)` per (row, view) | conjugate Beta update in the outcome's transaction |
| Nightly, by `param_fold` | `seconds` per (type, step) from shot timestamps; the swap thresholds from the confusion counts; the next-view bar from views that changed a field against views that did not | folded into a challenger version |

**The prior.** Classifier output as given; swap bounds 0.9 and 0.1; Beta(2, 2) for view fill rates; capture-shots' seconds and effort.

**Switching to learned values.** A challenger replaces the prior after 30 items of the type and a 1,000-draw bootstrap backtest on the last 30 days that beats the champion past the noise. Guard bands: the swap bound never under 0.8; `seconds` within ±50% of the prior; at most 3 follow-ups whatever the rates say.

**Rollback.** One UPDATE sets the prior version back to `champion`.

## 5. Speed

| Step | Budget, p95 |
|---|---|
| The suggestion from the first frame, on the phone | under 300 ms |
| Gates per frame, on the phone | under 50 ms, live |
| `process[]` returned by `POST /v1/captures`, or from the phone's copy offline | under 200 ms |
| The type check on the first kept still | under 3 s, while the person keeps shooting |
| The next view after each kept shot | under 100 ms on the phone |

Identify starts at the first kept still, so its candidates and questions arrive while the process runs.

## 6. What the person sees

Any screen reads the capture row and the decisions; these are its outputs, not a layout.

- The type picker over the camera: 15 options, the suggestion first, preselected only past the margin.
- The current step of `process[]`: its kind and role, such as "Tag".
- One instruction at a time, built from the unmet row.
- A swap: the new type and that the photos were kept.
- Follow-ups, one at a time, each with its preselected value and "Something else".
- The rows left unseen, listed on the item card.

## 7. How it beats what exists

Per [parity](../parity.md#crosslisting-and-selling-tools), which has no capture row; the comparison here is *inferred* from the rivals' recorded tools.

| Rival | What it does | Ours |
|---|---|---|
| Mercari's photo-to-listing AI | a listing from photos in "about 15 seconds" (a company claim); a review found it still needs much seller input ([crosslister-teardown §3](../../research/cross-cutting/nate/crosslister-teardown.md#3-marketplace-native-tools)) | the process asks for the frames that settle the fields (the tag for brand and size), so the follow-ups are at most 3 and preselected |
| Poshmark's Smart List AI | photo to title, description and category (*asserted*, same source) | the category is a one-tap pick checked by the judge; every fact is tied to its pixels |
| Crosslisters' AI listing rows | a Y or an add-on per tool ([§5](../../research/cross-cutting/nate/crosslister-teardown.md#5-capability-by-tool)) | capture guidance per type; no resale app's capture guidance was found (*not-found*, [adaptive-capture §5](../../research/capture/nate/adaptive-capture.md#5-guidance-in-shipping-apps)) |
| Polycam, Scaniverse, KIRI Engine | coverage loops and minimaps for 3D scans (*observed*, same source) | the same coverage feedback, used to settle listing fields and dimensions rather than to make a model |

## 8. Protections

- Whether an item works is only the person's statement; it is never inferred or preselected.
- Raw room frames never leave the phone unmasked; no room mesh is kept; EXIF is stripped before upload ([capture privacy](../features/capture.md#systems-underneath)).
- Generated photos are `ai_marked` by studio; the engine never marks a real frame.
- A recall `lookup` row on bikes_sports, baby_gear and toys_lego is always run and blocks `post` when it matches.
- A type swap keeps every photo; nothing the person took is dropped by the engine.

## 9. Proof

The fixed set: 30 real items across the 14 families, each captured once on a LiDAR and once on a non-LiDAR iPhone, with naive operators and the confirmed type and fields frozen as one table version.

| Test | Passes when |
|---|---|
| 1 Suggestion | the confirmed family is first on at least 27 of 30 and wrongly preselected on at most 1 |
| 2 Process per type | each family's `process[]` matches its capture-shots plan, and the no-LiDAR substitution holds for every `scan` |
| 3 Swap | on 10 items picked wrong on purpose, every swap keeps all photos and asks only the missing frames; no swap on a right pick |
| 4 Next view | no view outside the process is asked below the bar; each asked view changed a field on at least 25 of the 30 |
| 5 Follow-ups | at most 3 per item; none asks a fact a kept frame settles; `function` never preselected |
| 6 Time | a tee in under 70 s from the press to judged, the type pick included |
| 7 Both openings | list-first and type-pick timed on the same 30 items, scored blind; the result goes to Open 2 |
| 8 Learning | a planted shift in confusion counts promotes a challenger only past 30 items and the bootstrap; the rollback UPDATE restores the prior |

## 10. Build tasks

Phone code in the Swift capture module, job code under `jobs/capture/`, each task in the [task shape](../plans/README.md#2-the-task-shape) when planned; all build in parallel against the frozen fixture.

| Task | Owns | Depends on | Proves with |
|---|---|---|---|
| cap-1 Process table as data | `jobs/capture/process.py`, `process.json`, `test_process.py` | capture-shots plans | `python -m pytest jobs/capture/test_process.py` |
| cap-2 Suggestion and preselection | `jobs/capture/suggest.py`, `test_suggest.py` | the 30-item frame fixture | `python -m pytest jobs/capture/test_suggest.py` |
| cap-3 Type check and swap | `jobs/capture/judge_type.py`, `test_judge_type.py` | cap-1 interface | `python -m pytest jobs/capture/test_judge_type.py` |
| cap-4 Next view and stop | `jobs/capture/next_view.py`, `test_next_view.py` | cap-1 interface, the `requirement` fixture | `python -m pytest jobs/capture/test_next_view.py` |
| cap-5 Follow-ups | `jobs/capture/follow_ups.py`, `test_follow_ups.py` | the `requirement` fixture | `python -m pytest jobs/capture/test_follow_ups.py` |
| cap-6 Learning: fold, promote, rollback | `jobs/capture/learn.py`, `test_learn.py` | cap-2 and cap-5 interfaces | `python -m pytest jobs/capture/test_learn.py` |

The Swift module's runner of `process[]`, the tutorial flag and the on-device classifier are planned with the module; their check is test 1 and test 6 on the phones.

## Worked example

All numbers are examples.

A grey tee laid flat, on a LiDAR iPhone. The first frame gives apparel 0.86, bags 0.05, other 0.04; the margin is met, so apparel is preselected and one tap confirms. `process[]` is `series` front, back, tag. The tag still reads brand and size M; the front and back give colour and one small mark near the hem. The fabric close-up's worth over cost is 0.4 against a bar of 1.0, so it is not asked. The type check gives apparel 0.97, so no swap. One follow-up step: condition with the grade "good" preselected from the photos and the hem mark shown as a pin; the person confirms both. Total 52 s from the press to judged.
