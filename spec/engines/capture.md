# Capture engine

Rewritten 2026-11-15 by the capture team lead, in the spec pass that Nate called ([words](../../product/words.md#2026-11-15-nate-wrap-the-leads-up-at-a-good-spot-then-spec-from-what-we-have)). The page says what the code does today, with file references. Where page and code disagree, it says which one is right. Product choices are marked *agent proposal*; the backend is Nate's to decide.

Nate's ask for this area: "deterministically selecting by product type and dimensions, all needed fields and information determined and ascertained, with the intelligent ui generating any needed clarifying questions" ([words](../../product/words.md#2026-11-15-nate-opus-team-leads-that-send-out-to-codex)).

What it decides, for one capture session:
- which process the person follows;
- which fields each linked site still needs;
- which question to ask next, as data a screen renders with no logic of its own;
- when to stop.

It does this with one pure function, `plan(state)`: the same state in gives the same plan out. No model runs inside it. Models write the facts it reads, as proposals with evidence. The flow it serves is Nate's ([words](../../product/words.md#2026-11-14-nate-finalised-the-intelligence-engine-the-listing-swarm-the-buying-engine-and-how-capture-works)): pick the type, follow its process, answer the least extra input.

## 1. What exists today

| Piece | Files | State on 2026-11-15 |
|---|---|---|
| The one table | `jobs/capture/process.json` (v2) | Holds the shot lists by family and kind (`types`, `no_lidar`), named steps (`steps`), dimension classes (`family_class`, `classes`) and field rows (`fields`, under `root` and per family). Validated by `table.test.ts`. |
| Table accessors and params | `app/src/engines/capture/table.ts` | Loads the table with a static JSON import, which the web export needs. Validates sites, views and words. Declares every bound in section 4. |
| Process per type | `app/src/engines/capture/process.ts`, twin `jobs/capture/process.py` | `processFor(type, objectCapture, {rigid, kind})`. The two give the same answers (`process.test.ts` checks every family). |
| Selection | `select.ts` | Family, class, process and expanded field rows (section 2). |
| Field state and site form | `fields.ts` | The known rule, the six field states, retakes, close variants, `formValue` per site (section 2). |
| Ready per site | `complete.ts` | `completeness()` for linked sites, plus `missingFor()`, which `app/src/engines/listing/build.ts:86` calls. So capture and listing share one check. |
| The question plan | `plan.ts` | Questions, their order, the cap and the status (section 2). |
| Walk fixtures | `walks.ts`, `walk.test.ts` | Nine walks from first photo to done, each run twice and compared. |
| The routes | `app/src/edge/api/captures.ts` | Open, photos, PATCH (type, answer, refuse, generate), finish and GET each answer from `plan()`. Captures are kept per person in an in-memory map shaped like the Store row (section 6). `applyJobResult()` takes job results. |
| Per-site condition values | `CONDITION` in `spec/sites.mjs` | Maps our condition scale to each site's values, with a mark per site. |
| Superseded, kept | `jobs/capture/follow_ups.py`, `next_view.py` | Their headers say `plan.ts` replaces them. Tests pass; nothing calls them. |
| Built, not called | `jobs/capture/suggest.py` (the type suggestion's arithmetic: a person's prior and card 7's preselect rule), `judge_type.py` (the swap rule on `capture_judge`'s scores), `learn.py` (Beta updates, fold, promote, rollback), `note.py` (the free note read into facts), `app/src/engines/capture/facts.ts` (`fact.found` frames) | Each passes its own tests. None has a caller. The routes take the phone's suggestion as given, and nothing learns yet. |
| Not built | the Swift capture module (depth, scan, on-device reads and gates); `capture_judge`; the job runner's call to `applyJobResult` | Section 7 has the phone's contract; the runner call belongs to integration. |

The record of what is built, joined, real and reviewed is capture's row in [completion](../plans/completion.md): 25 of 40 cells at the stop.

## 2. The plan

### Selection by type and size (`select.ts`)

1. **Family.** `capture.type` when the person picked it or a swap set it. Failing that, the phone's suggestion, when it passes card 7's margin ([asking-and-intent card 7](../determinations/asking-and-intent.md#7-which-option-is-preselected-and-when-none-is)): top at least `capture_preselect_floor`, lead at least `assist_preselect_margin`. The suggestion is used for the process only. Failing both, the family is `other` with `fallback: type_unsure`, and the type is the first question.
2. **Dimension class.** Start from `family_class`, then apply size. A rigid item whose longest side is `capture_large_cm` or more is `large_bulky`. A `medium_hard` item under `capture_small_cm` is `small_hard`. For `other`:
   - rigid, at least `capture_large_cm`: `large_bulky`;
   - rigid, at least `capture_small_cm`, or rigid with no size given: `medium_hard`;
   - rigid and smaller: `small_hard`;
   - not rigid, or not known to be rigid: `soft_goods`.

   Two or more pieces wrap the class in `set_bundle`; `inner_class` keeps the class inside it.
3. **Process.** `processFor` gives the shot list. A scan becomes the 8-still ring when `object_capture` is false. A `small_hard` or `soft_goods` item gets the `front_still` step instead of a scan. A bundle starts with the `group` step, then the family's list once per piece, keyed `tag.1`, `tag.2` and so on.
4. **Fields.** The `root` rows, then the family's, then the kind's (`electronics.phones_laptops`), then the class's `dimensions` row. A later row replaces an earlier one with the same name. In a bundle, rows marked `per_piece` repeat per piece as `size_label.1`, `size_label.2`, the way `flaw.<n>` is named, and `lot_count` is added.

| Class | Default families | Dimensions, in ladder order | Condition checks | Weight tier |
|---|---|---|---|---|
| `flat_garment` | apparel | pit to pit, length: measured on the front still, else asked | stains, holes, pilling, fading, print cracking | under 1 lb |
| `footwear` | shoes | none (the size is the label) | sole wear, creasing, heel drag, scuffs | 1 to 3 lb |
| `bag` | bags | width, height, depth: lookup, measured, asked | corner wear, handle darkening, hardware scratches, lining stains | 1 to 3 lb |
| `small_hard` | jewellery_watches, phones and laptops, media, cards_collectibles | none (the matched product's spec) | scratches, dents, cracks | under 1 lb |
| `medium_hard` | electronics, lighting_home, appliances_tools, toys_lego | width, height, depth: lookup, measured, asked | scratches, dents, missing parts | 3 to 10 lb |
| `large_bulky` | furniture, bikes_sports, baby_gear | width, depth, height: lookup, measured, asked; required on every site | stains, scratches, tears, loose joints | over 10 lb |
| `soft_goods` | other, when not rigid | width, height: asked | stains, holes, fading | under 1 lb |
| `set_bundle` | any family, with two or more pieces | the family's, per piece | the family's | the family's |

### A field row (`process.json` `fields`)

| Column | Meaning |
|---|---|
| `field`, `type`, `unit` or `values` | As the `requirement` row ([product §3](../product.md#3-the-data-model)). |
| `ways[]` | The ordered ways a value can come: `seen` (a kept view), `label` (text or a code on the item), `measured` (depth), `derived` (from the class weight or the profile), `lookup` (the matched product), `asked`. Each names its `view` or source and its `min_conf`. |
| `confirm` | `auto`: a value at or past `min_conf` is known. `tap`: a value is a proposal until the person taps it, unless `capture.confirm_mode` is `auto` and the value is at or past `capture_auto_accept`; then it is accepted and marked `auto_accepted`. For `type` the bounds are `capture_type_auto_floor` and `capture_type_auto_margin` instead. `always`: only the person settles it. Condition, function and anything that bears on authenticity are `always`; size and accessories are `tap`. |
| `required`, `recommended` | The sites that need the field to post, and the sites it helps. Sites the person has not linked are ignored. |
| `site_names` | The site's own field name and `max_length`, where they differ from ours. |
| `ask` | The question's kind, its fixed options and its words. |
| `per_piece` | The row repeats per piece in a bundle. |

**Known** (`fields.ts` `known`). A `you_said` or confirmed value is always known. Otherwise the value must pass the field's `confirm` rule above.

**The six states** (`fieldState`). Each field is in exactly one:
- `known`;
- `proposed`: a value the person has not settled;
- `waiting`: a step not yet kept, or a lookup still running, can fill it;
- `missing`: only asking is left;
- `unobtainable`: no way is left, and asking is not one of its ways;
- `refused`.

The item card shows the same six.

**Ways that do not run.** `measured` ways are skipped when `has_lidar` is false. When a scan became the ring, a way whose view is `scan` reads the ring instead. A kept view that returned `not_read` gives a retake, up to `capture_max_retakes`; after that the next way runs.

**Site form** (`formValue`). An enum maps through the site's table (`CONDITION` for condition). Text is cut to the site's `max_length` on a word boundary. A value with no place on a site is `invalid` there, which counts as missing for that site.

### Dimensions and close variants (`fields.ts`)

A dimension is a field like any other. Its ladder order is `lookup`, then `measured`, then `asked`. Nate (2026-11-15): "Its only sensible to first rely on the published dimensions, if it was reliably identified, now too tables can be similar with a slight variation, but our system is built accurate enough to assess what certainty it is in each and intelligent generate ui inputs to clarify". No `derived` dimension rule exists: a guess is not a rule.

Identify can return close variants of one product, `state.variants.dimensions = [{label, value, p}]`, for example two tables from one line in two sizes. The plan tries these in order:
1. A variant at or past the lookup `min_conf` is known. Nothing is asked.
2. Otherwise a depth reading that itself passes the measured `min_conf`, and matches exactly one variant on every part, settles it silently. A part matches when it is within `max(capture_dims_match_cm, capture_dims_match_pct × value)`. The fact keeps the variant's published values at the reading's confidence.
3. Otherwise, one `pick_one` between the variants, none proposed. "Something else" opens a typed or taped measurement: offered, never demanded.

Until settled, the field is `waiting` while a step or lookup can still fill it, and `missing` after. Either way the reading shows as its value.

### The questions (`plan.ts`)

```
{ id: "q_<capture_id>_<field or step>", field, fields?, kind, options: [{value, label?, proposed}], other,
  unit?, units?, parts?, shot?: {step, reason (retake | add), for?: studio, zone?, flaw_kind?},
  why (required | confirm | value | only_you_know), required_by: [target],
  unlocks: {required, ready_after: [target]}, words, answer: {method, path} }
```

**Which fields get a question.** A field gets one when it is `proposed`, or `missing` with an `asked` way. A field whose next way is a view gets a `shot` instead:
- a kept view that returned `not_read` gets a retake;
- a view outside the process is added only when a linked site requires the field and asking is not one of its ways (a tap is cheaper than a shot).

**Never asked:**
- a field that is `known`, `waiting` or `refused`;
- condition when the purpose is `find`;
- a field no linked site requires or recommends.

While shots are pending, only `type`, `lot_count` and retakes of kept shots are asked. A known value that a site's form rejects is asked again, with no proposal.

**Kind and options.** A field with fixed `values` is a pick over them. Free text is only for a field with neither values nor candidates.

**Order.** A total sort, in key order:
1. `type`, then `lot_count`, because their answers change which fields exist;
2. `unlocks.required`, descending;
3. `ready_after` count, descending;
4. recommended (site, field) pairs settled, descending;
5. effort, ascending (`capture_effort_<kind>`);
6. the field name.

**Cap.** A field a linked site requires is asked until it is known or refused (Nate: every needed field gets its own select, [words](../../product/words.md#2026-11-14-nate-each-type-gets-its-own-select-for-every-field-its-process-needs)). Other questions stop at `capture_question_cap` per item. The count includes this plan's rows that are already answered, confirmed or refused.

**Status.** `shooting` while a process step is not kept, then `asking` while any question remains, then `done`.

**Words.** Fixed per field in `ask.words`, and linted by `scripts/copy-lint.mjs` in `table.test.ts`. No model writes a question. If one ever rewords one, the field, kind and options stay as planned, and the result passes the same lint.

### Studio asks (`plan.ts`, `select.ts`)

The studio's `manifest.json` `plan.asks` (from `jobs/studio/plan.py` `_ask()`) join this plan. They are not a list beside it ([packet 72](../../.agents/team/packets/studio/72-capture-asks-studio-once.md)):
- They count only after the person taps Generate (`PATCH {generate: true}`). Retouch is off unless they ask ([Nate](../../product/words.md#2026-11-14-nate-the-best-way-to-take-every-photo-tags-delayed-retouch-chosen-by-the-person)).
- Then `studio` is one more target after the linked sites.
- It needs `dimensions` by the same ladder as any site, plus the parts its kind names in `slides.json`. A `measure` ask is that dimensions question.
- Every other ask becomes a `shot` with `for: studio` and the ask's own words. These are never capped.

With Generate off, every walk's output is identical (`walk.test.ts`).

### Ready per site (`complete.ts`)

`completeness()` returns `{ready, missing: [{field, state}]}` for each linked site. A field is missing when it is not `known`, or its value fails `formValue` for that site. A recalled item is never ready.

`missingFor()` is the same check, called from `listing/build.ts`. For a site capture holds no form for (`offerup`, `grailed`), the missing list is the fields every site requires that are not yet known.

### Where a fact came from

Every evidence row carries `data`:
- `captured`: the person's own camera, the phone's reads and what they said;
- `live:<site>`: a value read from a marketplace;
- `dataset:<name>`: a value from a catalogue behind a lookup;
- `example`: the seeded walks.

A `lookup` value does not depend on which lane fetched the page ([where a read runs](protocol-and-adapters.md)).

## 3. Thresholds

Every bound is a `param` row read through `app/src/engines/param` with the prior below. The priors in the first block are declared in `table.ts` `PRIORS`; `capture_label_sharp_min` is declared in `captures.ts`.

| Param | Prior | Where it comes from |
|---|---|---|
| `capture_preselect_floor`, `assist_preselect_margin` | 0.5, 0.2 | [asking-and-intent card 7](../determinations/asking-and-intent.md#7-which-option-is-preselected-and-when-none-is) |
| `capture_type_auto_floor`, `capture_type_auto_margin` | 0.9, 0.5 | `jobs/capture/suggest.py` auto-accept |
| `capture_auto_accept` | 0.95 | *agent proposal*: the bar a non-type proposal must clear before it is accepted without a tap |
| `capture_small_cm`, `capture_large_cm` | 10, 120 | [capture-shots card 1](../determinations/capture-shots.md#1-which-plan-an-item-gets): 10 cm; 120 cm is an *agent proposal* |
| `capture_max_retakes` | 2 | [seeing-the-item card 17](../determinations/seeing-the-item.md#17-which-question-to-ask-next-and-when-to-stop) |
| `capture_question_cap` | 3 | card 17 |
| `capture_dims_match_cm`, `capture_dims_match_pct` | 2, 0.03 | *agent proposal*, from LiDAR's ±1 cm on objects over 10 cm ([adaptive-capture §1](../../research/capture/nate/adaptive-capture.md#1-depth-sensor-facts-arkit-scene-depth)) |
| `capture_effort_yes_no`, `_pick_one`, `_pick_many`, `_number_with_unit`, `_text`, `_shot` | 1, 1, 2, 3, 3, 4 | card 17's effort tiebreak |
| `capture_label_sharp_min` | 0.5 | *agent proposal*, on `score.py`'s 0 to 1 sharpness part |

The confidence each ladder rung needs (`min_conf`) is a column of the versioned `requirement` row in `process.json`. Rows default to 0.9 for `label` and `lookup` and 0.8 for `seen` and `measured`; each row's own value is in the table. They are not yet `param` rows: see fix F1.

## 4. What Ben's screen calls

This is the whole contract, in order. Each response returns the capture with `plan`, and the screen reads only `plan`.

1. **The camera opens.** `POST /v1/captures {mode, purpose, device: {has_lidar, object_capture}, suggestion?, extent_cm?, rigid?, pieces?, item_id?}`.
2. **Each shot is kept.** `POST /v1/captures/:id/photos {photos: [{role, step, key, content_type, bytes, reads[]}]}`, then the upload to the returned URL. Show the step whose `plan.process[].state` is `pending` or `retake`.
3. **Render `plan.questions[0]`** with the widget its `kind` names:

   | `kind` | Widget |
   |---|---|
   | `pick_one` | `OptionList` or `ChoiceChips` |
   | `pick_many` | `MultiChips` |
   | `number_with_unit` | `NumberWithUnit`, or Nate's drag grid when `parts` is set |
   | `yes_no` | `YesNo` |
   | `text` | `InlineBlank` |
   | `shot` | the camera on `shot.step`, with `words` |

   Condition uses `ConditionPicker`. `other: true` adds "Something else". The option with `proposed: true` is preselected.
4. **Send `answer`.** `PATCH /v1/captures/:id` with one of `{version, type}`, `{version, answer: {field, value}}`, `{version, refuse: field}` or `{version, generate: true}`. A shot answer is the next `POST .../photos`. Read the new plan.
5. **When `plan.status` is `done`, or the person taps Done:** `POST /v1/captures/:id/finish {version}`. `plan.complete` says, per site, ready or what is missing.
6. **To refresh after a background read:** `GET /v1/captures/:id`.

The screen never decides what to ask or when to stop. Layout, motion and the words around a question are Ben's.

**What ends the demo.** The first TestFlight build is the demo. The capture screen stops being the demo when it calls steps 1 to 5 against the live API instead of rendering `spec/examples/captures.json`. It also needs the phone to send real `device` flags and `reads[]` (section 7). Until then every capture in the build is the example capture.

## 5. Results from the jobs (`captures.ts` `applyJobResult`)

`applyJobResult(user_id, capture_id, result)` validates a whole result before applying any of it. Results for another person's capture, or an unknown one, are `not_found`.

| `kind` | Shape (from) | Effect |
|---|---|---|
| `identify` | `{action, set: [{product_id, family, brand?, model?, c, label?, dimensions?}]}` (`jobs/identity/ladder.py` `action()` and the conformal set) | Sets the suggestion when the phone gave none, the brand and model candidates, and the dimension variants, or a dimensions fact when the action is confirm with one product. Sets `lookups: done`. |
| `studio_plan` | `{plan: {kind, asks}}` (`manifest.json`) | Studio asks, held until Generate. |
| `photo_score` | `{photos: [{key, role, score, parts}]}` (`jobs/photo/score.py` `score()`) | A tag, care label or screenshot photo whose `parts.sharpness` is under `capture_label_sharp_min` becomes a `not_read` read on its step, so the plan asks a retake. |

The job runner calls this function when a job ends. That call is the integration lead's, and it is not built.

## 6. The capture row

The Store shape the routes' map already holds, agreed with the integration lead:
`{id (cap_), user_id, item_id, version, created_at, updated_at, data (captured, or example for the seed), status (framing, shooting, uploading, judged), mode, state (the engine's State), photos, replacements, phone_suggestion, studio_plan?}`.

The plan is derived and never stored. A `photo` row follows canon's `photo` row, plus `key`, `content_type`, `bytes`, `depth_ref?`, `pose_ref?` and `reads[]`.

Rules the routes enforce:
- Each person sees only their own captures.
- A finished capture refuses photos and PATCH, and its version does not move.
- An answer must be one of the plan's current questions and must fit its row; otherwise 422.
- A `not_read` read never replaces a fact. A real read replaces one only from the same or a higher source (`seen` < `label` < `measured`). A `you_said` value is never replaced.
- Device flags default to false.

## 7. What the phone sends (the Swift capture module's contract)

The native module (Swift, in the Expo development build; Ben's [decision](../../product/decisions.md#2026-11-14-the-app-is-an-expo-app-with-a-native-swift-camera-module)) is not built, because only a device can run it. The plan already consumes this contract. The facts behind it are in [capture tech docs](../../research/capture/nate/capture-tech-docs-2026-11.md).

**Once per capture.** `device {has_lidar, object_capture}`:
- `has_lidar` is `ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth)`.
- `object_capture` is `ObjectCaptureSession.isSupported`. It turns false for the rest of the capture when a session fails; iPhone 17 Pro sessions fail on iOS 26.4 and 26.5.

The phone also sends the first frame's suggestion `{family, p, second_p}` and its size `{extent_cm, extent_conf, rigid}`.

**Per kept photo.** `{role, step, key, content_type, bytes, depth_ref?, pose_ref?, reads[]}`:
- `depth_ref` points to the frame's ARKit depth and confidence maps. It is never sent for a room frame.
- Each read is `{field, value, source (seen, label, measured), confidence}`, or `{field, value: null, unknown_reason: not_read}` when a gate failed on a view meant to read that field.
- Text and codes come from Vision's `RecognizeTextRequest` and `DetectBarcodesRequest`. An EAN-13 with a leading 0 is also sent as UPC-A.
- The gates are sharpness, exposure, coverage, glare on the label region, `CalculateImageAestheticsScoresRequest.isUtility` and, on iOS 26, `DetectLensSmudgeRequest`.

**Per scan.** `{scan_ok, extent_cm {width, depth, height}, extent_conf, frames}`. Apple's bounds page states no unit, so `extent_conf` stays under `min_conf` until the known-size box check passes.

**Confidences** are the phone's calibrated values. A module version that has not passed the fixed set sends 0, so every read is a proposal.

## 8. What is wrong: named fixes and their tests

Fixed. Each was found by a fresh review and has a regression test:

| Fix | Test |
|---|---|
| Furniture brand could not be asked when Depop was linked | `plan.test.ts`, furniture on Depop asks brand |
| The cap missed tap-confirmed answers | `plan.test.ts`, a tapped colour leaves two optional questions |
| `missingFor` ignored a recall | `complete.test.ts`, recall agrees with `completeness` |
| `tag.1` matched `tag.11` | `plan.test.ts`, twelve-piece bundle |
| Unsettled variants showed `missing` and dropped the reading | `fields.test.ts`, waiting with the reading as value |
| A weak reading settled a variant at confidence 1 | `fields.test.ts`, 0.5 asks, 0.85 settles at 0.85 |
| A failed re-read wiped a good read | `captures.test.ts`, label M then `not_read` keeps M |
| `lot_count` 99 and empty lists were accepted | `captures.test.ts`, 422 per field type |
| Device flags assumed LiDAR and a working scan | `captures.test.ts`, defaults false |
| Every capture shared one id, so one person could reach another's | `captures.test.ts`, two people cannot see or change each other's |
| The engine did not type-check | `cd app && npx tsc --noEmit -p .` prints nothing for capture or listing |

Open:

| Fix | What is wrong | The test that will prove it |
|---|---|---|
| F1 | `min_conf` lives on table rows, not `param` rows, so it cannot be learned or rolled back like the other bounds | Each rung's `min_conf` is read as `capture_min_conf` scoped by {kind, field, rung}, with the row's value as its prior; a promoted row moves the known rule in `fields.test.ts` |
| F2 | `suggest.py` repeats card 7's bounds as function defaults | `suggest.py` reads the same params; a test changes the param and the preselect moves |
| F3 | The first real run asked 6 and 7 questions where constructed walks ask 3, because the recorded read has no confidences | With the phone's calibrated reads, the real tee asks no more than the constructed tee (`node scripts/capture-real.mjs`) |
| F4 | Facts stay on the capture; nothing writes them to the item's `attribute` rows at finish | `POST .../finish` writes each known fact as an attribute with `data: captured` evidence; `GET /v1/items/:id` shows them |
| F5 | The routes keep captures in memory only | Swapped onto the Store `capture` and `photo` tables (integration); a restart keeps an open capture |
| F6 | No job runner calls `applyJobResult` | An identify job's result changes the next GET's plan |
| F7 | `suggest.py`, `judge_type.py`, `learn.py` and `note.py` pass their tests but nothing calls them | Each has a caller, or the page retires it |
| F8 | `http.ts` request logs lack `req` and `route` (integration's file) | A full HTTP run passes `spec/log.mjs` |
| F9 | A capture opened without `item_id` took the seeded user's item `it_7c2m` (the second fresh review's high finding, an isolation fault) | Being finished as cap-join-1 round 3: a second person's open gets an item of its own; their PATCH and finish return it |
| F10 | The phone's `reads[]` are not checked against the field row: a read of colour 42 is stored, though PATCH would refuse it | A read that fails its row's type or values is dropped with a logged reason, and the plan is unchanged (`captures.test.ts`) |
| F11 | Open ignores the size `{extent_cm, extent_conf, rigid}` from section 7, and drops a scan's `{scan_ok, extent_cm}` and `depth_ref` | Open with a 130 cm rigid lamp selects `large_bulky`; a scan's extent becomes a measured proposal under `min_conf` |
| F12 | The colour maximum of 2 is written in the route, not in the table | A `max` column on list rows in `process.json`; the route reads it |
| F13 | `applyJobResult` writes to a finished capture, and `photo_score` trusts a key that was never kept | Both refused like PATCH after finish; an unkept key is `invalid` |
| F14 | Studio asks are checked loosely: a `measure` ask without its name, or a `flaw` without its zone, is accepted | Each ask type's required fields enforced at `applyJobResult` |
| F15 | `state.change` events lack `was` (spec/events.json) and fire when the status did not move | The log contract test checks `was` and that no event repeats a state |

The seeded example user's first open replaces the example row. That is by design, so the contract examples stay the engine's output, and `captures.test.ts` asserts it.

## 9. What comes next, in order, each with its measure

1. **Ben's screen on the routes** (section 4). Measure: one real item captured on a phone from the first photo to `done`, with the questions recorded beside the walk's counts.
2. **The Swift module** (section 7), on a LiDAR iPhone. Measure: the fixed set's 30 items, the share of `label` reads correct at the confidence they claim, and the known-size box within 1 cm.
3. **F4 and F5**: facts reach the item card, and captures survive a restart. Measure: the item card shows every captured fact with its evidence.
4. **F6**: identify feeds the plan. Measure: on the fixed set, how many questions identify removes per item (variants settled, brands and models proposed).
5. **F1 and F2**: thresholds become learnable, and `learn.py` gets its caller (F7). Measure: a planted shift in answer rates promotes a challenger only past 30 items and the bootstrap, and the rollback restores the prior. This is the old proof 8, kept.
6. **The extra-shot bar** from the old design: a view outside the process asked when its worth in money over its cost in seconds passes a bar ([capture-shots cards 2 and 3](../determinations/capture-shots.md#2-what-a-shot-is-worth)). It is not built; today an extra view is asked only for a required field that asking cannot settle. Measure: each asked extra view changed a field on at least 25 of the fixed set's 30 items.

## 10. Proof today

Every command was rerun on the Mac on 2026-11-15.

| What | Command | Result |
|---|---|---|
| The engine | `node --test --test-concurrency=1 app/src/engines/capture/<f>.test.ts`, for table, select, fields, complete, plan, walk and process | 121 tests pass |
| Questions to done | `walk.test.ts` diagnostics, `capture.questions` | T-shirt 3 (2 with auto confirm), sneakers 4, handbag 5, phone 5, chair 2, bundle of three 9, close-variant table 1 with depth and 2 without |
| Same input, same output | each walk run twice in `walk.test.ts` | identical |
| Plan speed | `captures.test.ts`, "capture plan speed" | p50 0.097 ms, p95 0.282 ms over 52 states; budget 100 ms |
| The routes | `node --test --test-concurrency=1 app/src/edge/api/captures.test.ts`, plus `spec/examples.test.mjs` and `routes.test.ts` | 89, 9 and 6 pass |
| One real run | `node scripts/capture-real.mjs` (`spec/items/capture-real/2026-11-15.json`) | Ben's three real garments: photos scored 69 to 77, tag photos 90 and 94; tee 6 questions, pants 7, hoodie waiting on a back photo. `data: captured`; one run on three items, not accuracy. |

**Speed budgets.** These are from the old design and are not measured on a device:
- the suggestion from the first frame, under 300 ms on the phone;
- the per-frame gates, under 50 ms;
- the process returned by `POST /v1/captures`, under 200 ms;
- the next question after each shot, under 100 ms. Only the plan's part of this is measured, above.

## 11. Protections

- Whether an item works is only the person's statement. `function` is `confirm: always`, with no proposal.
- Raw room frames never leave the phone unmasked. No room mesh is kept, and EXIF is stripped before upload ([capture privacy](../features/capture.md#systems-underneath)).
- A type change keeps every photo. The plan reads kept keys by name.
- Logs carry field names, never answer values (`captures.test.ts` checks the log contract).
- A recalled item is never ready on any site.

## 12. How it compares

Rivals' AI listing tools turn photos into a title, a category and a description. Mercari's photo-to-listing still needs much seller input in a review ([crosslister-teardown §3](../../research/cross-cutting/nate/crosslister-teardown.md#3-marketplace-native-tools)). Ours differs in three ways:
- It asks for the frames that settle each linked site's required fields.
- It asks the least extra input, in a fixed order.
- It stops when every linked site is ready.

No resale app's capture guidance was found (*not-found*, [adaptive-capture §5](../../research/capture/nate/adaptive-capture.md#5-guidance-in-shipping-apps)).
