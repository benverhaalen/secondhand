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

## 11. The deterministic plan

*agent proposal*, written 2026-11-15 by the capture lead, for Nate's ask: "deterministically selecting by product type and dimensions, all needed fields and information determined and ascertained, with the intelligent ui generating any needed clarifying questions" ([words](../../product/words.md#2026-11-15-nate-opus-team-leads-that-send-out-to-codex)). It turns sections 1 to 3 into one pure function, `plan(state)`: given what is known about an item so far, it returns the process, the fields and their state, the next questions and, per linked site, ready or what is missing. Same state in, same plan out. No model runs inside it; models only write the facts it reads, as proposals with evidence. Section 3's worth and cost arithmetic (steps 4 and 6) stays the learned layer on top: it can only add an extra shot past the bar, never change what is required or the order below.

### The one table

`jobs/capture/process.json` (version 2) is the one table. It keeps `types` (the shot lists above) and adds:

| Part | Holds |
|---|---|
| `family_class` | each family's default dimension class |
| `classes` | per class: its measurements (one `dimensions` field with its parts, unit `cm`, and how it is taken), its condition checks (what the flaw pass looks for), its default shipping weight tier, and any fields the class adds |
| `fields` | per family, plus `root` for every item: the field rows below |

**Dimension classes.** Selection is by family and by size, because a scan, a tape and a lookup suit different sizes.

| Class | Families by default | Dimensions and how | Condition checks | Weight tier |
|---|---|---|---|---|
| `flat_garment` | apparel | pit to pit, length; depth on the front still laid flat, else asked | stains, holes, pilling, fading, print cracking | under 1 lb |
| `footwear` | shoes | none; the size is the label | sole wear, creasing, heel drag, scuffs | 1 to 3 lb |
| `bag` | bags | width, height, depth; from the scan, else the matched product, else asked | corner wear, handle darkening, hardware scratches, lining stains | 1 to 3 lb |
| `small_hard` | jewellery_watches, phones and laptops, media, cards_collectibles | none; the matched product's spec | scratches, dents, cracks | under 1 lb |
| `medium_hard` | electronics, lighting_home, appliances_tools, toys_lego | width, height, depth; scan, product, asked | scratches, dents, missing parts | 3 to 10 lb |
| `large_bulky` | furniture, bikes_sports, baby_gear | width, depth, height; scan, product, asked. Required on every site: nobody collects a sofa without them | stains, scratches, tears, loose joints | over 10 lb |
| `soft_goods` | other, when not rigid | width, height; asked | stains, holes, fading | under 1 lb |
| `set_bundle` | any family, when two or more pieces are in the frame | the family's, per piece | the family's | the family's |

**Selection** is `select(state)`, in this order:
1. **The family.** `capture.type` when the person picked it or `capture_judge` swapped it. Otherwise the phone's suggestion, used for the process only, when it passes card 7's margin (top at least 0.5, lead at least 0.2). Otherwise the fallback: family `other`, `fallback: type_unsure`, and the type is the first question.
2. **The class.** The family's default, then size: a rigid item whose longest side is 120 cm or more is `large_bulky`; a `medium_hard` item under 10 cm is `small_hard`. `other` takes its class from size: rigid and 120 cm or more `large_bulky`, rigid and 10 cm or more `medium_hard`, rigid and smaller `small_hard`, not rigid `soft_goods`. Two or more pieces wrap the result in `set_bundle`.
3. **The process.** The family's (or kind's) shot list as section 3 step 2 builds it today, with the no-LiDAR ring and capture-shots card 1 step 3 (soft, under 10 cm: stills, not a scan). The phone sends two flags, because LiDAR is not the same as a working scan ([capture tech docs](../../research/capture/nate/capture-tech-docs-2026-11.md)): `has_lidar` (scene depth, so `measured` ways run) and `object_capture` (`ObjectCaptureSession.isSupported` and no session failure in this capture, so `scan` steps are offered; iPhone 17 Pro sessions fail on iOS 26.4 and 26.5). A LiDAR phone without a working scan gets the ring and still measures from depth. A size from the scan's bounds is sent below `min_conf`, so the person confirms it, until a known-size box check on the fixed set passes (Apple's bounds page states no unit). A bundle starts with one `group` still of every piece together, then the family's list once per piece, piece by piece, each step keyed `tag.1`, `tag.2`.
4. **The fields.** `root`, then the family's rows, then the class's, with a family row replacing a root row of the same name. In a bundle every row marked `per_piece` becomes one field per piece (`size_label.1`, `size_label.2`, the way `flaw.<n>` is named), and `lot_count` is added.

Every bound here (0.5, 0.2, 10 cm, 120 cm), the 0.95 auto-accept and the cap below are `param` rows with those priors.

### A field row

| Column | Meaning |
|---|---|
| `field`, `type`, `unit` or `values` | as the `requirement` row ([product §3](../product.md#3-the-data-model)) |
| `ways[]` | the ordered ways it gets a value: `photo` (a kept view), `label` (text or a code on the item), `measured` (depth), `derived` (from the type, the class or the profile), `lookup` (the matched product), `asked`. Each way names its `view` or source and the confidence it needs (`min_conf`) |
| `confirm` | `auto`: a value past `min_conf` is known. `tap`: a model's value is a proposal until the person taps it, except that with `capture.confirm_mode = auto` a value at 0.95 or more is accepted and marked `auto_accepted`; for `type` the bound is the suggestion's own auto-accept (top at least 0.9, lead at least 0.5, [suggest.py](../../jobs/capture/suggest.py)). `always`: only the person settles it, whatever the mode. Condition, function and anything that bears on authenticity are `always`; size and accessories are `tap` |
| `required`, `recommended` | the sites that need it to post, and those it helps. A site not linked is ignored |
| `site_names` | per site: the form's name and `max_length` where it differs. Condition values map per site through `CONDITION` in [spec/sites.mjs](../sites.mjs) |
| `ask` | the question: its kind, its options when they are fixed, and its words |
| `per_piece` | the row repeats per piece in a bundle |

**When a field is known** (`known(row, fact, confirm_mode)`): a `you_said` value or a confirmed one always is; under `confirm: always` nothing else is; under `tap` only an auto-accepted value is; under `auto` a value at or past its way's `min_conf` is. A field's state is then one of `known`, `proposed` (a value the person has not settled), `waiting` (a process step not yet kept, or a lookup still running, can fill it), `missing` (only asking is left), `unobtainable` (no way left, and asking is not one of its ways), or `refused`.

**Per-site form.** `formValue(row, site, value)` maps an enum through the site's table, shortens text to the site's `max_length` on a word boundary (as `buildListing` does), and says `invalid` when a value has no place on that site. An invalid value counts as missing for that site.

### The questions

A question is data the UI renders with no logic of its own:

```
{ id, field, kind, options: [{value, proposed}], other, unit?, units?, parts?, shot?: {step, frame?, reason},
  why, required_by: [site], unlocks: {required, ready_after: [site]}, words, answer: {method, path} }
```

- `kind` is one of `pick_one`, `pick_many`, `number_with_unit` (with `parts` for dimensions, Nate's drag grid), `yes_no`, `text`, `shot` (a retake or one more view). `other: true` adds "Something else" with a text box.
- `proposed` marks the option the photos or a lookup gave. Never on `confirm: always` fields with no photo evidence (function), and never when card 7's margin fails.
- `why` is a code the screen turns into words: `required` (a linked site needs it), `confirm` (a proposal to settle), `value` (it changes the price or the match), `only_you_know`.
- `unlocks.required` counts the linked (site, required field) pairs it settles; `ready_after` lists the sites that become ready if it is answered and nothing else changes.
- `answer` is the call that answers it: `PATCH /v1/captures/:id` with `{version, type}`, `{version, answer: {field, value}}` or `{version, refuse: field}`, which writes the attribute as `you_said` with owner evidence and returns the next plan; `POST /v1/captures/:id/photos` for a shot. A later correction on the item card stays `PATCH /v1/items/:id/attributes/:name`.
- `words` come from the row's `ask` text, fixed per field and checked by `scripts/copy-lint.mjs` in the table's test. An eBay aspect with no row ([aspects.ts](../../app/src/engines/listing/aspects.ts)) gets `"<Aspect name>?"`. No model writes a question; if one ever rewrites `words`, the field, kind and options stay as planned and the result passes the same lint.

**Which questions, in which order.** A field gets a question when it is `proposed`, or `missing` with `asked` among its ways, or when its next way is a view: a kept view that failed to read it gets a `shot` retake (at most 2, card 17), and a view outside the process gets a `shot` only when a linked site requires the field. Never asked: a `known` or `waiting` field, a `refused` one, condition when the purpose is `find`, and a field no linked site requires or recommends. While shots are still pending, only the type, the piece count and a retake of a kept shot are asked; the rest waits, because a later frame can still settle or change it. A known value that a linked site's form rejects (`formValue` says `invalid`) is asked again with no proposal. A field with fixed `values` is a pick over them; free text is only for a field with neither values nor candidates. The order is a total sort:
1. `type`, then `lot_count`: their answers change which fields exist;
2. `unlocks.required`, most first;
3. `ready_after`, most sites first;
4. the recommended (site, field) pairs it settles, most first;
5. effort, least first: `yes_no` and `pick_one` 1, `pick_many` 2, `number_with_unit` and `text` 3, `shot` 4;
6. the field name.

**The cap.** A field a linked site requires is always asked until it is known or refused (Nate: every needed field gets its own select, [words](../../product/words.md#2026-11-14-nate-each-type-gets-its-own-select-for-every-field-its-process-needs)). Questions for fields no linked site requires stop at 3 per item, counting those of this plan already answered or refused; `capture_question_cap` is a `param` row with prior 3.

**The stop.** `status` is `shooting` while a process step is not kept, `asking` while a question remains, and `done` when none does. At `done` every field not known keeps its state as the reason the item card shows.

**Where a fact came from.** Every `evidence` row the plan's facts rest on carries `data` ([product §3](../product.md#3-the-data-model)): `captured` for the person's own camera, the phone's reads of those frames and what they said in this capture; `live:<site>` only for a value read from a marketplace; `dataset:<name>` for a catalogue or released set behind a `lookup`; `example` for the seeded walks. A `captured` fact is real and is never counted as a site observation.

### Studio asks

The studio's plan ([jobs/studio/plan.py](../../jobs/studio/plan.py) `plan()`, run by `slides_run.py:run_item`) says what it still needs to make an item's slides: asks of type `cover`, `back`, `tag`, `graphic` (with a zone), `flaw` (with its kind and zone) and `measure` (with the measurement's name). They are one more source of questions, with the same contract and the same order, not a list beside it (read from `manifest.json` `plan.asks`, which keeps each ask's type and fields; Ben, [studio/55](../../.agents/team/packets/studio/55-slides-backend-for-nate.md)):
- They count only after the person taps Generate (`state.studio.requested`); retouch is off unless they ask ([Nate](../../product/words.md#2026-11-14-nate-the-best-way-to-take-every-photo-tags-delayed-retouch-chosen-by-the-person)).
- Then `studio` is one more target beside the linked sites, in `completeness` and in `unlocks`. It requires `dimensions` from a tape reading, meaning `measured` or `you_said`, never a lookup: "can only ai beautify if you have dimensions" (Ben, studio/55). A render's shape is checked against the tape within 8% (`BAND` in [jobs/studio/check.py](../../jobs/studio/check.py)); product/features-proof.md #3 says 20%, and Ben has been asked which holds. The code's 8% stands until he answers.
- A `measure` ask is the `dimensions` question. Every other ask is a `shot` question with `reason: add`, `for: studio`, its `words` the ask's own text, and the zone or flaw kind carried in `shot`. Because the person asked for Generate, these count as required for the studio target and are never capped.
- `ai_marked` from the manifest goes onto the item's photo rows, not into the plan (integration's join).

### Ready per site

`completeness(rows, facts, sites, confirm_mode)` returns, for each linked site, `{ready, missing: [{field, state}]}` over the fields that site requires, using `known` and `formValue`. The planner computes `unlocks` with it, and the listing step must use the same function in place of its own check in `buildListing`, so capture and listing cannot disagree. A recalled item is never ready, whatever its fields.

### What Ben's screens get

Every capture route returns `plan` beside the capture (a `GET /v1/captures/:id` for a refresh after a background read is asked of the orchestrator): `{family, kind, dimension_class, fallback, process[] (each step with its state: pending, kept, retake), checks[], fields[] (field, state, value, source, required_by, recommended_by), questions[], complete {site: {ready, missing[]}}, status}`. A screen shows the current step, renders `questions[0]` with the widget its `kind` names, sends `answer`, and reads the next plan; it never decides what to ask or when to stop. The layout, the words around the question, the motion and the drag grid stay Ben's.

### Build and proof

| Task | Owns | Proves with |
|---|---|---|
| cap-7 The table, selection, known, form and completeness | `jobs/capture/process.json` v2, `app/src/engines/capture/table.ts`, `select.ts`, `fields.ts`, `complete.ts` and their tests; `CONDITION` in `spec/sites.mjs` | `node --test app/src/engines/capture/select.test.ts` and the same for `fields`, `complete` |
| cap-8 The question planner and the walk | `app/src/engines/capture/plan.ts`, `plan.test.ts`, `walk.test.ts` | `node --test app/src/engines/capture/walk.test.ts`: six types (a T-shirt, sneakers, a handbag, a phone, a chair, a bundle of three) from the first photo to `done`, asserting the class, the process, each question in order and the stop, run twice with identical output |
| cap-9 The routes | `app/src/edge/api/captures.ts` and its test, `spec/examples/captures.json` | `node --test app/src/edge/api/captures.test.ts` |

## Worked example

All numbers are examples.

A grey tee laid flat, on a LiDAR iPhone. The first frame gives apparel 0.86, bags 0.05, other 0.04; the margin is met, so apparel is preselected and one tap confirms. `process[]` is `series` front, back, tag. The tag still reads brand and size M; the front and back give colour and one small mark near the hem. The fabric close-up's worth over cost is 0.4 against a bar of 1.0, so it is not asked. The type check gives apparel 0.97, so no swap. One follow-up step: condition with the grade "good" preselected from the photos and the hem mark shown as a pin; the person confirms both. Total 52 s from the press to judged.
