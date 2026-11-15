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
| Built, not called | `jobs/capture/suggest.py` (the type suggestion's arithmetic: a person's prior and card 7's preselect rule), `judge_type.py` (the swap rule on `capture_judge`'s scores; only the fixture walk, `scripts/walk.mjs`, calls it), `learn.py` (Beta updates, fold, promote, rollback), `note.py` (the free note read into facts), `app/src/engines/capture/facts.ts` (`fact.found` frames) | Each passes its own tests. None has a caller. The routes take the phone's suggestion as given, and nothing learns yet. |
| Not built | the Swift capture module (depth, scan, on-device reads and gates); `capture_judge`; the job runner's call to `applyJobResult` | Section 7 has the phone's contract; the runner call belongs to integration. |

The record of what is built, joined, real and reviewed is capture's row in [completion](../plans/completion.md): 26 of 40 cells at the stop.

## 2. The plan

### Selection by type and size

`select.ts`.

1. **Family.** `capture.type` when the person picked it or a swap set it. Failing that, the phone's suggestion, when it passes card 7's margin ([asking-and-intent card 7](../determinations/asking-and-intent.md#7-which-option-is-preselected-and-when-none-is)): top at least `capture_preselect_floor`, lead at least `assist_preselect_margin`. The suggestion is used for the process only. Failing both, the family is `other` with `fallback: type_unsure`, and the type is the first question.
2. **Dimension class.** Start from `family_class`, then apply size. A rigid item whose longest side is `capture_large_cm` or more is `large_bulky`. A `medium_hard` item under `capture_small_cm` is `small_hard`. For `other`:
   - rigid, at least `capture_large_cm`: `large_bulky`;
   - rigid, at least `capture_small_cm`, or rigid with no size given: `medium_hard`;
   - rigid and smaller: `small_hard`;
   - not rigid, or not known to be rigid: `soft_goods`.

   Two or more pieces wrap the class in `set_bundle`; `inner_class` keeps the class inside it.
3. **Process.** `processFor` gives the shot list. A scan becomes the 8-still ring when `object_capture` is false. A `small_hard` or `soft_goods` item gets the `front_still` step instead of a scan. A bundle starts with the `group` step, then the family's list once per piece, keyed `tag.1`, `tag.2` and so on.
4. **Fields.** The `root` rows, then the family's, then the kind's (`electronics.phones`), then the kind's parts (`components`, section 2), then the class's `dimensions` row. A later row replaces an earlier one with the same name. In a bundle, rows marked `per_piece` repeat per piece as `size_label.1`, `size_label.2`, the way `flaw.<n>` is named, and `lot_count` is added.

| Class | Default families | Dimensions, in ladder order | Condition checks | Weight tier |
|---|---|---|---|---|
| `flat_garment` | apparel | pit to pit, length: measured on the front still, else asked | stains, holes, pilling, fading, print cracking | under 1 lb |
| `footwear` | shoes | none (the size is the label) | sole wear, creasing, heel drag, scuffs | 1 to 3 lb |
| `bag` | bags | width, height, depth: lookup, measured, asked | corner wear, handle darkening, hardware scratches, lining stains | 1 to 3 lb |
| `small_hard` | jewellery_watches, phones, laptops, media, cards_collectibles | none (the matched product's spec) | scratches, dents, cracks | under 1 lb |
| `medium_hard` | electronics, lighting_home, appliances_tools, toys_lego | width, height, depth: lookup, measured, asked | scratches, dents, missing parts | 3 to 10 lb |
| `large_bulky` | furniture, bikes_sports, baby_gear | width, depth, height: lookup, measured, asked; required on every site | stains, scratches, tears, loose joints | over 10 lb |
| `soft_goods` | other, when not rigid | width, height: asked | stains, holes, fading | under 1 lb |
| `set_bundle` | any family, with two or more pieces | the family's, per piece | the family's | the family's |

### A field row

`process.json` `fields`.

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

### Dimensions and close variants

`fields.ts`.

A dimension is a field like any other. Its ladder order is `lookup`, then `measured`, then `asked`. Nate (2026-11-15): "Its only sensible to first rely on the published dimensions, if it was reliably identified, now too tables can be similar with a slight variation, but our system is built accurate enough to assess what certainty it is in each and intelligent generate ui inputs to clarify". No `derived` dimension rule exists: a guess is not a rule.

Identify can return close variants of one product, `state.variants.dimensions = [{label, value, p}]`, for example two tables from one line in two sizes. The plan tries these in order:
1. A variant at or past the lookup `min_conf` is known. Nothing is asked.
2. Otherwise a depth reading that itself passes the measured `min_conf`, and matches exactly one variant on every part, settles it silently. A part matches when it is within `max(capture_dims_match_cm, capture_dims_match_pct × value)`. The fact keeps the variant's published values at the reading's confidence.
3. Otherwise, one `pick_one` between the variants, none proposed. "Something else" opens a typed or taped measurement: offered, never demanded.

Until settled, the field is `waiting` while a step or lookup can still fill it, and `missing` after. Either way the reading shows as its value.

### The parts of one item

*Agent proposal*, from Nate (2026-11-15): "for technology, a userful thing when its being captured and identified, is for the system to perhaps determine the value of its individual pieces. like a desktop computer can have the system understand the ram, of course if its a custom build, I imagine that will be a clarifying question" ([words](../../product/words.md#2026-11-15-nate-technology-is-valued-by-its-parts-too-and-a-custom-build-is-a-clarifying-question)), and "we can parse and build things to be deterministicially or code driven". Not built yet: fix F17, with its tests in section 8. A fresh seat reviewed it against the code (`cap-parts-review-1.md` in the session notes), and this text carries its corrections.

**A part is not a piece.** Pieces are separate items sold together (`pieces`, `set_bundle`, `size_label.2`). Parts are inside one item: a desktop's graphics card, its memory. A part row is never `per_piece`. A camera body and its lens are pieces, never parts, because each is sold and identified on its own.

**The kinds.** A kind is a key `<family>.<kind>` of `process.json`. A capture's `kind` is valid when its key is in `types`, `fields` or `components` for the capture's family.

| Kind | Process and class | Parts, in ask order | Asked when unread |
|---|---|---|---|
| `electronics.desktops` (new) | the family's (scan, model_plate) and `medium_hard`, by fallback | graphics, processor, memory, storage, power_supply, board, case | graphics, processor, memory, storage |
| `electronics.laptops` (new) | about_screenshot, front_screen_on, back; `small_hard` (its own `types` and `family_class` rows) | memory, storage: the parts a person can swap | none, an exception to the ladder below: memory and storage are read from the about screenshot or looked up by model, and the soldered processor and graphics are the model's attributes |
| `electronics.phones` (`phones_laptops` renamed, since laptops leave it) | unchanged | none | |

The same block would serve, with rows only, a games console's internal storage or a bike's groupset, wheels and fork.

**Where the kind comes from** (F17). Before this, no route set `kind`, so `phones_laptops` was reached only by the walks. Now:
- the phone's suggestion `{family, p, second_p, kind?}` at open;
- a type pick, `PATCH {type, kind?}`; a type change without `kind` clears it;
- an identify result with `action: confirm`, whose first member's `kind` is used when the capture has none and the member's `family` is the capture's.

**The table holds parts as data.** `process.json` gains `components`, keyed by kind: `{read?: <step>, after?: [field], parts: [<field row>]}`. `read` is a step row like a process step plus its `words`: the desktop's is `{step: system_info, kind: series, role: screenshot, needs_lidar: false, seconds: 15, words: "Photo of the system information screen"}`, offered as below. When `read` names a step already in the kind's process (the laptop's `about_screenshot`), there is no offer: that photo's text is parsed when it is kept. `after` lists field names of the kind. A part's row has its bare name in `field`. `select.ts` appends it after the kind's rows as `part.<name>`, with `rank` its 1-based place in the list. The list order is the ask order, from the part that moves the price most. `validateTable` reads a kind's process as `types[<kind>]`, falling back to the family's, as `processFor` already does, so a kind with no `types` row of its own loads. It checks three things about `components`: each key is a kind; each part's label view is a step of the kind's process or its `read` step; `after` names fields of the kind. No part is named in code. The twin `process.py` needs no change, because it reads `types` and `components` does not touch them. The rename does touch `jobs/capture/test_process.py` (its phones test) and `walks.ts` (walk D's input), and walk D's output stays byte-identical. No param row is stored under the old scope, because nothing learns yet (F7), so nothing migrates. The laptop's `fields` rows are copies of the phones' rows without `carrier_lock`: they are the laptop's own facts, and they may diverge.

**A part row** is an ordinary field row, so the known rule, the six states, the cap and the site form apply unchanged:
- its `min_conf` params are `capture_min_conf.part.<name>.<way>`, scoped `{kind: <family>.<kind>}` like a kind's own row (section 3), so `fields.ts` looks the part up in `components` as well as `fields`;
- `type` and `values` or `unit`: graphics, processor, board and case are `text`; memory and storage are `enum` in GB over the sizes listed in the row; power_supply is a `number` in W;
- `ways`: `lookup` (min_conf 0.9), then `label` on the read step (min_conf 0.9), then `asked` for the parts that move the price. The others have no `asked` way, so unread they are `unobtainable` and never asked. A phone module that has not passed the fixed set sends confidence 0 (section 7), so its part reads are proposals, asked to confirm under the cap;
- `confirm: auto`, `required: []`, `recommended: "all"`: a part changes the value on every site, not one site's form;
- `labels`: the words a system screen prints before the value ("Processor", "Chip", "Installed RAM", "Memory", "Graphics Card", "Graphics", "Storage").

Reading a part's own sticker (a memory stick's label) needs a step of its own and is not in this design.

**`custom_build`** is a desktop row: `bool`, ways `lookup` (min_conf 0.9) then `asked`, `confirm: auto`, `required: []`, `recommended: "all"` (like a part, it is there for the value), `ask` `yes_no` "Custom build?", and `shapes: true`. The desktop's `model` row gains a first way `{way: derived, when: custom_build, value: "Custom build", min_conf: 0.9}`. While `custom_build` is known true, that value is the model's fact ahead of any read or lookup. A custom build has no model, and a plate on its case names the case.

**The ladder** (the dimension ladder again):
1. **A prebuilt identified by its model.** Identify's confirm names the product with `components` (`{<part>: value}`) from its published specification. Each value that fits its part row becomes a `lookup` fact at the member's `c`; at or past the part's lookup `min_conf` it is known, and under it the part is a proposal, asked to confirm under the cap. One that does not fit is dropped with a logged part name and reason, as phone reads are (F10). `custom_build` becomes a `lookup` fact `false` at `c`. When `c` passes the bar, nothing about parts is asked.
2. **Otherwise one question, "Custom build?".** A no leaves the model to be asked (eBay requires it), and the model's lookup can still fill the parts.
3. **Then the parts wait for the build and the read.** For a kind with `after`, a part that is not known stays `waiting` until every `after` field is known or refused and no lookup is running. Then the plan offers the `read` step once: a `shot` with reason `add`, `field` the step's name, and the step's own `words` ("Photo of the system information screen"). The person may take it or skip it (section 6). A desktop sold without a screen loses only the offer. Until the offer is kept or skipped, the parts stay `waiting`.
4. **Only an unread part that moves the price is asked**, in the kind's order, under the cap. A part the person cannot name is refused, like any field.

**Order and cap.** `custom_build` sorts with `type` and `lot_count`, and the parts by their `rank` ([the order](#the-questions)). The offer is not a field row: while shown it takes one optional slot, and once kept or skipped it takes none. Take a custom desktop with eBay and Facebook linked, no screen, and its colour seen on the scan. Its optional questions are `custom_build`, then the offer, then after the skip `part.graphics` and `part.processor`, because the answered build used one of the three slots. Required fields (`condition`, `function`, and `model` on the "no" path) are asked as always, outside the cap.

**The parser** (`parts.ts`, `readParts(lines, rows, slack)`, pure). The phone sends the read step's recognized text as `text: [{line, confidence}]` (section 7). For each part row, the first line whose first word or words equal one of its `labels` gives the value from the rest of the line. Labels match whole words, so "Processors" is not "Processor". The value is read by the row's type:
- `text`: trademark marks (`(R)`, `(TM)`, `®`, `™`), the words "CPU" and "Processor", and a trailing clock speed (`@ 2.90GHz`, `2.90 GHz`) are cut. "Intel(R) Core(TM) i7-10700 CPU @ 2.90GHz 2.90 GHz" becomes "Intel Core i7-10700".
- a size in GB: the number with its unit after the last " of " when the line has one ("123 GB used of 476 GB" reads 476), else the first. TB counts 1000 GB. Windows prints sizes in binary units under the name GB, and macOS prints decimal ones, so the reading is tried both as printed and times 1.073741824. The value is the listed size nearest to either try by ratio, kept only when that ratio is within `capture_part_size_slack` of 1. Windows' 476.9 for a 512 GB drive is 512.06 binary, so it reads 512; 465.7 is 500.04, so it reads 500; macOS's 500.07 reads 500; Windows' 1.82 TB is 2001, so it reads 2000; 300 is 1.17 from 256 and is dropped, and asked. (Found by worker cap-parts-1: the earlier "smallest listed size at or above" rule read 476.9 as 500.)
- a number in W: the number before "W".

Each read is `{field: part.<name>, value, source: label, confidence: the line's}`. A part that no line matches is not read. That is not `not_read`, because no gate failed. The lines are never stored or logged, because the same screen shows the device name and product ID; only the parsed values are kept.

**Each part carries its own confidence and source**, as every fact does. For a part, what the item shows outranks the published specification (section 6), because a prebuilt may have been upgraded. Finish writes known parts to the item's attributes under the same names, with evidence `ref` `<capture>/<step>` (F4's path). The value of the parts is the engines lead's ([packet 77](../../.agents/team/packets/team/77-parts-contract-for-engines.md)).

### The questions

`plan.ts`.

```
{ id: "q_<capture_id>_<field or step>", field, fields?, kind, options: [{value, label?, proposed}], other,
  unit?, units?, parts?, shot?: {step, reason (retake | add), for?: studio, zone?, flaw_kind?},
  why (required | confirm | value | only_you_know), required_by: [target],
  unlocks: {required, ready_after: [target]}, words, answer: {method, path} }
```

**Which fields get a question.** A field gets one when it is `proposed`, or `missing` with an `asked` way. A field whose next way is a view gets a `shot` instead:
- a kept view that returned `not_read` gets a retake;
- a view outside the process is added only when a linked site requires the field and asking is not one of its ways (a tap is cheaper than a shot), or when it is a kind's `read` offer (the parts of one item, above).

**Never asked:**
- a field that is `known`, `waiting` or `refused`;
- condition when the purpose is `find`;
- a field no linked site requires or recommends.

While shots are pending, only `type`, `lot_count` and retakes of kept shots are asked; the read offer and the parts wait too. A known value that a site's form rejects is asked again, with no proposal.

**Kind and options.** A field with fixed `values` is a pick over them. Free text is only for a field with neither values nor candidates.

**Order.** A total sort, in key order:
1. `type`, then `lot_count`, then any row with `shapes: true` (`custom_build`), because their answers change which fields exist;
2. `unlocks.required`, descending;
3. `ready_after` count, descending;
4. recommended (site, field) pairs settled, descending;
5. `rank` ascending: a kind's read offer at 0, its parts by their place in the list, every row without a rank after all ranked rows (no existing walk has a rank, so their output does not move);
6. effort, ascending (`capture_effort_<kind>`);
7. the field name.

**Cap.** A field a linked site requires is asked until it is known or refused (Nate: every needed field gets its own select, [words](../../product/words.md#2026-11-14-nate-each-type-gets-its-own-select-for-every-field-its-process-needs)). Other questions stop at `capture_question_cap` per item. The count includes this plan's rows that are already answered, confirmed or refused.

**Status.** `shooting` while a process step is not kept, then `asking` while any question remains, then `done`.

**Words.** Fixed per field in `ask.words`, and linted by `scripts/copy-lint.mjs` in `table.test.ts`. No model writes a question. If one ever rewords one, the field, kind and options stay as planned, and the result passes the same lint.

### Studio asks

`plan.ts` and `select.ts`.

The studio's `manifest.json` `plan.asks` (from `jobs/studio/plan.py` `_ask()`) join this plan. They are not a list beside it ([packet 72](../../.agents/team/packets/studio/72-capture-asks-studio-once.md)):
- They count only after the person taps Generate (`PATCH {generate: true}`). Retouch is off unless they ask ([Nate](../../product/words.md#2026-11-14-nate-the-best-way-to-take-every-photo-tags-delayed-retouch-chosen-by-the-person)).
- Then `studio` is one more target after the linked sites.
- It needs `dimensions` by the same ladder as any site, plus the parts its kind names in `slides.json`. A `measure` ask is that dimensions question.
- Every other ask becomes a `shot` with `for: studio` and the ask's own words. These are never capped.

With Generate off, every walk's output is identical (`walk.test.ts`).

### Ready per site

`complete.ts`.

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

Every bound is a `param` row read through `app/src/engines/param` with the prior below. The priors are the `params` block of `jobs/capture/process.json`, read by `table.ts` `bound()` and by `jobs/capture/suggest.py`, so each number is written once; `capture_label_sharp_min` is declared in `captures.ts`.

| Param | Prior | Where it comes from |
|---|---|---|
| `capture_preselect_floor`, `assist_preselect_margin` | 0.5, 0.2 | [asking-and-intent card 7](../determinations/asking-and-intent.md#7-which-option-is-preselected-and-when-none-is) |
| `capture_type_auto_floor`, `capture_type_auto_margin` | 0.9, 0.5 | `jobs/capture/suggest.py` auto-accept |
| `capture_auto_accept` | 0.95 | *agent proposal*: the bar a non-type proposal must clear before it is accepted without a tap |
| `capture_small_cm`, `capture_large_cm` | 10, 120 | [capture-shots card 1](../determinations/capture-shots.md#1-which-plan-an-item-gets): 10 cm; 120 cm is an *agent proposal* |
| `capture_max_retakes` | 2 | [seeing-the-item card 3](../determinations/seeing-the-item.md#3-what-must-still-be-captured-and-when-it-is-enough) |
| `capture_question_cap` | 3 | card 17 |
| `capture_dims_match_cm`, `capture_dims_match_pct` | 2, 0.03 | *agent proposal*, from LiDAR's ±1 cm on objects over 10 cm ([adaptive-capture §1](../../research/capture/nate/adaptive-capture.md#1-depth-sensor-facts-arkit-scene-depth)) |
| `capture_effort_yes_no`, `_pick_one`, `_pick_many`, `_number_with_unit`, `_text`, `_shot` | 1, 1, 2, 3, 3, 4 | card 17's effort tiebreak |
| `capture_lookup_wait_s` | 15 | *agent proposal*: how long the plan holds a lookup field before asking it (F18); to be measured against identify's real time to answer |
| `capture_label_sharp_min` | 0.5 | *agent proposal*, on `score.py`'s 0 to 1 sharpness part |
| `capture_part_size_slack` | 0.1 | *agent proposal*: once binary and decimal units are both tried, a real drive reads within 1% of its listed size, and the next listed size is at least 2.4% away (500 and 512); 0.1 drops a reading off by more than a size step only where sizes are far apart (the parser, section 2) |

The confidence each ladder rung needs (`min_conf`) is a column of the versioned `requirement` row in `process.json`. Rows default to 0.9 for `label` and `lookup` and 0.8 for `seen` and `measured`; each row's own value is in the table. Each is read as the param `capture_min_conf.<field>.<way>` (`table.ts` `minConf()`), with the row's value as its prior and the scope `{kind: <family>}`, or `{kind: <family>.<kind>}` for a kind's own row, so a promoted row moves the known rule for that family alone. Bundle pieces (`size_label.2`) read their base field's param.

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
6. **To refresh after a background read:** `GET /v1/captures/:id`. When `plan.status` is `asking` and `plan.questions` is empty, a lookup is still running (F18): show that the item is being looked up and GET again; the wait ends within `capture_lookup_wait_s`.

The screen never decides what to ask or when to stop. Layout, motion and the words around a question are Ben's.

**What the questions read: `intent`.** Packet 92 asked whether the questions read `purpose` or `intent`. They read `intent` (`sell`, `worth`, `track`, `find`; Ben's four jobs, packet 80), and `purpose` becomes the engine's own input derived from it: `sell` gives `sell`, `worth` gives `appraise`, `find` gives `find`, and `track` gives `find`, since tracking an item needs what identifies it (brand, model, size) and never its condition or listing fields, which is the question set `find` already asks. A capture opened with `intent` alone is valid; one that sends both and they disagree is 400; `purpose` alone keeps working until the app stops sending it. *agent proposal*; built in the route join.

**The question block, shared with the buying chat.** Nate ([via the orchestrator](../../.agents/team/packets/team/92-reply-to-80-four-jobs-storage.md)): "I think we can add those clarifying question widgest to the intelligent ui too." So a clarifying question has one shape and one drawn part wherever it appears. The shape is `Ask`, exported from `app/src/engines/capture/plan.ts`:

`{id, field, kind ('pick_one'|'pick_many'|'number_with_unit'|'yes_no'|'text'), words, options: [{value, label?, proposed, rests_on?}], other, max_length?, unit?, units?, parts?, why, answer: {method, path}}`

- Capture's `Question` is `Ask` plus what only capture has: `shot`, `fields`, `required_by`, `unlocks`. A chat answer emits `Ask` with no capture field.
- `proposed: true` on at most one option of a `pick_one` (any number of a `pick_many`) means the system is fairly sure: the drawn part preselects it, and `rests_on` says why in a few words ("RN 14806 on the tag").
- The answer is `{answer: {field, value}}` sent with `answer.method` to `answer.path` (capture: `PATCH /v1/captures/:id` with `version`; the chat: the conversation route the engines lead names). The value is what the person picked: an option's `value`, an array of them, a boolean, a trimmed string, or for `number_with_unit` a bare number, or an object of `parts` when `parts` is set.
- The drawn part is one part in `app/src/ui/parts/` (Ben's), taking an `Ask` and `onAnswer(value)`; capture's sheet and the chat both use it. Its first version is the `Answer` in Ben's `app/src/capture/live.tsx`, which already draws every kind.

**What ends the demo.** The first TestFlight build is the demo. The capture screen stops being the demo when it calls steps 1 to 5 against the live API instead of rendering `spec/examples/captures.json`. It also needs the phone to send real `device` flags and `reads[]` (section 7). Until then every capture in the build is the example capture.

## 5. Results from the jobs

`captures.ts` `applyJobResult`.

`applyJobResult(user_id, capture_id, result)` validates a whole result before applying any of it. Results for another person's capture, or an unknown one, are `not_found`.

| `kind` | Shape (from) | Effect |
|---|---|---|
| `identify` | `{action, set: [{product_id, family, kind?, brand?, model?, c, label?, dimensions?, components?}]}` (`jobs/identity/ladder.py` `action()` and the conformal set) | Sets the suggestion when the phone gave none, the brand and model candidates, the brand as a `lookup` fact at `c` when the action is confirm with one product (never over a `you_said` or confirmed brand; added with F18 so a settled identify ends the brand question), and the dimension variants, or a dimensions fact when the action is confirm with one product. With confirm, `kind` sets the capture's kind when none is set, and `components` (`{<part>: value}`, checked against the kind's part rows) become `lookup` part facts and `custom_build` false (F17). Sets `lookups: done`. |
| `studio_plan` | `{plan: {kind, asks}}` (`manifest.json`) | Studio asks, held until Generate. |
| `photo_score` | `{photos: [{key, role, score, parts}]}` (`jobs/photo/score.py` `score()`) | A tag, care label or screenshot photo whose `parts.sharpness` is under `capture_label_sharp_min` becomes a `not_read` read on its step, so the plan asks a retake. |

The job runner calls this function when a job ends. That call is the integration lead's, and it is not built.

### The identify job

Written 2026-11-15 by the fourth capture lead for Nate's flow ([words](../../product/words.md#2026-11-15-nate-the-camera-takes-each-types-shots-then-the-system-processes-then-the-generative-ui-asks-with-prefilled-selects)): the person finishes the type's shots, "the system processes what it can", and the questions open with "prepopulated selects ... when there are certain possible matches". Every line is *agent proposal* unless it links a decision. The routes and their order come from [identify](../features/identify.md#the-routes); the price and terms of each are in [identify from photos](../../research/identify/nate/identify-from-photos-2026-11.md).

**When it runs.** Once per capture, when the last process step is kept (the plan leaves `shooting`), and again when a retake of a `tag`, `care_label` or `size_label` step is kept. One job row of kind `identify` per run, readable at `GET /v1/jobs/:id` with one stage per rung. Its end calls `applyJobResult`. A run that ends after finish is refused as stale (F13).

**What goes in.** From the capture row only: `type` or the suggestion's family, `kind`, and each kept photo's `{key, role, text?: [{line, confidence}], codes?: [{symbology, payload}], file_ref?}`. `text` and `codes` are the phone's Vision reads (section 7); a `tag`, `care_label` or `size_label` photo carries `text` the same way a `read` step does. Without them the OCR and barcode ports read the stored bytes; with neither, the text rungs abstain.

**The rungs.** Each rung abstains when it has nothing, and a later rung runs only for what the earlier ones left open. Scores are the ladder's (`jobs/identity/ladder.py`, `identity_rung_<n>`, priors 1.0, 0.8, 0.5, 0.3), so the TypeScript twin and the Python ladder give one answer (`jobs/identity/twin-parity.json`).

| Rung | Reads | By | s |
|---|---|---|---|
| 1, a code | a GTIN, UPC, EAN or ISBN from `codes`, normalized by `gtin14`'s rule | code; the catalogue port turns it into a product (none composed by default, so it abstains) | 1 on a catalogue hit |
| 2, the tag | the text lines of the tag, care label or size label | code: an RN or CA number in a committed table, the brand lexicon (longest word-bounded match, case-insensitive), a style code on the brand's line, the size token, fibre percentages, "Made in", a colour code from a fixed table | 1 for an RN or CA hit, 0.9 for a whole-word lexicon hit; a match inside a longer run of letters is no match |
| 3, visual search | the front photo's bytes | the visual port (eBay `searchByImage` first if its access and terms hold: both were unreachable on 2026-11-15, [identify from photos §2](../../research/identify/nate/identify-from-photos-2026-11.md#2-visual-search); a paid Lens or Web Detection route only on Nate's yes); each hit's title runs through rung 2's brand parser | the share of the top hits that name the brand, weighted by rank |
| 4, a model | the front and tag photos | a vision model through the model port, only when rungs 1 to 3 leave the family or the brand open; its answer is checked against a schema and the table's values before use. Off by default: a paid call needs Nate's yes, and tests replay a recorded answer | the model's own share, capped by the rung |

**What comes out.** A candidate is a brand, and a brand with a model when a style code or a code hit names one: `product_id` is `brand:<slug>` or `brand:<slug>/model:<slug>`. `c` is the ladder's, the set is the ladder's conformal set (`c >= identity_q_kind`, prior 0.6) and the action is the ladder's (`confirm`, `pick`, `ask`). So a tag read alone can confirm a brand (0.8 ≥ 0.6), visual search alone can only propose one (0.5), and a model only adds options. The result is section 5's `identify` shape plus three fields:
- `others`: the candidates below the set's bar, in the same member shape, highest `c` first, at most `identity_max_pick`. They become options, never a confirmed fact, so a visual-search brand still opens the brand question as an option.
- `facts: [{field, value, source: label, confidence, rule, ref}]` for what rung 2 read (size, fibre, origin, colour, style code), each with the rule that read it and the photo key. These merge through the same source order as a phone read (section 6), so a `you_said` value is never replaced.
- `rests_on` on each set member: one plain line per rung that found it ("RN 14806 on the tag", "6 of 10 similar listings").

The plan then needs no change: `candidates.brand` and `candidates.model` become the options of the brand and model questions, and a proposed fact is the preselected option (section 2, the questions).

**The paid visual rung: treg's Lens.** Nate set treg up for this ([words](../../product/words.md#2026-11-15-nate-set-up-treg-for-the-tools-identification-needs-an-open-font-for-every-system)). `serper.google.serp.lens` costs $0.003 a call, an empty answer included ([identify from photos, treg](../../research/identify/nate/identify-from-photos-2026-11.md#treg-as-one-route-beside-the-free-ones)). Three rules hold for it, each *agent proposal*:
1. **What leaves us.** Lens takes a publicly fetchable image address, so the photo reaches Google through two vendors (treg, then Serper). Only the front photo is sent, as a crop of the item, re-encoded so only pixels remain (no EXIF, XMP or depth), at a single-use signed address on our own server that expires after `identify_lens_url_ttl_s` (prior 120 s) and is refused after the first fetch. It runs only when the tag, label and barcode rungs abstain (rung 3's gate). Whether a person's photo may go to Google at all is Nate's, below.
2. **What it may spend.** Every paid call goes through one spend port that logs `{tool, capture_id, cost_micro}` from the `X-Treg-Cost-Micro` response header and refuses a call past `identify_spend_cap_capture_micro` (prior 3,000, one Lens call) per capture or `identify_spend_cap_day_micro` (prior 100,000, $0.10) per day for the whole team. No loop calls a paid tool without a stated total. Tests replay recorded answers; a live call is one at a time and only on Nate's yes. The team balance was $1.00 on 2026-11-15.
3. **What we keep.** Only our own candidate (`brand:<slug>`, `c`, `rests_on` such as "3 of 5 similar pages name Carhartt"). The answer's titles, links and thumbnails are used inside the run and dropped. Serper's and DataForSEO's terms were not read; until they are, nothing more is kept.

**Decided by Nate** ([words](../../product/words.md#2026-11-15-nate-yes-to-google-lens-through-treg-as-designed)), asked "May a seller's photo go to Google Lens through treg, as designed?": "yes". The three rules above are the design he said yes to. Still his: whether to top up the balance before the fixed-set run (20 items at one Lens call each is $0.06).

**Where results may not go.** eBay's terms keep its content to eBay listings ([platform access](../../research/connect/nate/platform-access.md)): a visual hit's title and image are used inside the run and never stored; only our own candidate (`brand:<slug>`, `c`, `rests_on`) is kept. Photos sent to a route are crops of the item ([identify, facts to know](../features/identify.md#facts-to-know)).

**Measure.** On the three real garments in `spec/items/capture-real/` with their recorded tag reads: the brand question opens with the right brand proposed on all three, by rung 2 alone (Carhartt by RN 14806 and the lexicon, Russell Athletic and Fruit of the Loom by the lexicon), and questions per item fall from 6 and 7 (section 10) by at least the brand and fabric. Then the fixed set of 20 in [the benchmark](../benchmark.md), once Nate's real items exist.

### Listing classification

*agent proposal*, 2026-11-15, for Nate's "intelligent listing classification" ([words](../../product/words.md#2026-11-15-nate-get-identification-listing-classification-and-the-generative-clarifying-ui-built)). Code: `app/src/engines/listing/classify.ts` (to build).

`classify(item, sites, ports)` takes the item the capture wrote (kind, department, the garment or product type, brand, model and every attribute with its source and confidence) and returns, per linked site:
- `category`: the site's category for the item (eBay a leaf id; Depop department and product type; Poshmark department, category and subcategory; Mercari its three levels; Facebook its form category), with `status` and `rests_on`;
- `fields`: one row per field the site's form takes for that category, `{field, site_name, required, status, value?, source?}`.

`status` is `known`, `proposed` or `missing`, decided by capture's own rule (`fields.ts` field state and `missingFor`, so a field is never known in one place and proposed in another): `known` when capture's state is known; `proposed` when a value exists below its rung's `min_conf`, or a category came only from the static table or a model; `missing` otherwise.

Where the category comes from, in order: (1) eBay's Taxonomy API `getCategorySuggestions` on the item's title words when the eBay port is composed, then `getItemAspectsForCategory` read through `aspects.ts` `aspectRows`; (2) a committed table, `app/src/engines/listing/categories.json`, from our kind and department to each site's category, each row with its source (Ben's [item attributes by site](../../research/capture/ben/item-attributes-by-site.md)) and a mark. A kind with no row gives `category: missing` for that site, never a guess. eBay's content stays on eBay rows (`aspects.ts` header).

A required field that is `missing` or `proposed` and that capture's table has no row for (an eBay aspect such as `ebay:Inseam`) becomes one more question in the plan: `pick_one` over the aspect's `allowed` values when eBay gives them (`SELECTION_ONLY`), else `text`, with eBay's own name as its words. It is asked only for a linked site that requires it, and counts toward the cap like any optional question unless the site requires it.

### How a question is ordered by what it narrows

Nate asked for questions that pin down "what it is" ([words](../../product/words.md#2026-11-15-nate-the-camera-takes-each-types-shots-then-the-system-processes-then-the-generative-ui-asks-with-prefilled-selects)). The identify job writes, beside `candidates`, each option's score and what it rests on (`state.candidate_detail[field][value] = {c, rests_on}`). The plan adds one order key after key 1 (the shaping fields): the entropy, in bits, of the field's candidate scores normalized to sum to 1 (`-Σ p log2 p`), descending. A field with no scored candidates has 0, so every existing walk keeps its order (`walk.test.ts`). Each option carries `rests_on` from the same map, so a screen can say why it is preselected. Agreement with [identify's design](../features/identify.md#design-choices) (expected information gain over the candidate set): with one answer collapsing the set to one value, the expected gain of asking a field is its entropy.

## 6. The capture row

The Store shape the routes' map already holds, agreed with the integration lead:
`{id (cap_), user_id, item_id, version, created_at, updated_at, data (captured, or example for the seed), status (framing, shooting, uploading, judged), mode, state (the engine's State), photos, replacements, phone_suggestion, studio_plan?}`.

The plan is derived and never stored. A `photo` row follows canon's `photo` row, plus `key`, `content_type`, `bytes`, `depth_ref?`, `pose_ref?` and `reads[]`.

Rules the routes enforce:
- Each person sees only their own captures.
- A finished capture refuses photos and PATCH, and its version does not move.
- An answer must be one of the plan's current questions and must fit its row; otherwise 422.
- A refusal names one of the plan's current questions. A `shot` question may be refused only when it is a kind's `read` offer; the step's name goes into `refused`. A retake or a process step cannot be refused.
- A `not_read` read never replaces a fact. A real read replaces one only from the same or a higher source (`seen` < `label` < `measured` < `lookup`). A `you_said` value is never replaced.
- A part (`part.<name>`) is the exception: a `label` read replaces a `lookup` part, and identify writes a part only where none is held or the held one is `lookup` (the parts of one item, section 2).
- Device flags default to false.

## 7. What the phone sends (the Swift capture module's contract)

The native module (Swift, in the Expo development build; Ben's [decision](../../product/decisions.md#2026-11-14-the-app-is-an-expo-app-with-a-native-swift-camera-module)) is not built, because only a device can run it. The plan already consumes this contract. The facts behind it are in [capture tech docs](../../research/capture/nate/capture-tech-docs-2026-11.md).

**Once per capture.** `device {has_lidar, object_capture}`:
- `has_lidar` is `ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth)`.
- `object_capture` is `ObjectCaptureSession.isSupported`. It turns false for the rest of the capture when a session fails; iPhone 17 Pro sessions fail on iOS 26.4 and 26.5.

The phone also sends the first frame's suggestion `{family, p, second_p, kind?}` and its size `{extent_cm, extent_conf, rigid}`.

**Per kept photo.** `{role, step, key, content_type, bytes, depth_ref?, pose_ref?, reads[]}`:
- `depth_ref` points to the frame's ARKit depth and confidence maps. It is never sent for a room frame.
- A photo of a `read` step (section 2, the parts of one item) also carries `text: [{line, confidence}]`, Vision's recognized lines in reading order. The route parses them into part reads and keeps none of the lines.
- Each read is `{field, value, source (seen, label, measured), confidence}`, or `{field, value: null, unknown_reason: not_read}` when a gate failed on a view meant to read that field.
- Text and codes come from Vision's `RecognizeTextRequest` and `DetectBarcodesRequest`. An EAN-13 with a leading 0 is also sent as UPC-A.
- The gates are sharpness, exposure, coverage, glare on the label region, `CalculateImageAestheticsScoresRequest.isUtility` and, on iOS 26, `DetectLensSmudgeRequest`.

**Per scan.** `{scan_ok, extent_cm {width, depth, height}, extent_conf, frames}`. Apple's bounds page states no unit, so `extent_conf` stays under `min_conf` until the known-size box check passes.

**Confidences** are the phone's calibrated values. A module version that has not passed the fixed set sends 0, so every read is a proposal.

## 7a. The shot guide

Nate ([words](../../product/words.md#2026-11-15-nate-capture-onboarding-is-line-art-on-glass-one-guide-per-shot)): line art on a glass background that still shows the camera, like Apple's Measure telling people to move closer or further; set by the item's type to the photo to take; one press dismisses it, the shutter takes the photo and moves to the next step. The look is Ben's (`app/src/ui/`); what follows is what the guide shows and when, *agent proposal* where not quoted.

- **Which guide.** The plan's next shot: the first `shot` question, else the first process step still `pending` or `retake`. So the type, and the steps its process row lists (`jobs/capture/process.json` `types`), set the guide with no screen logic. The art is chosen by `<family>.<step>` with `<step>` as the fallback (an apparel `front` is a laid-flat garment; a furniture `front` is a chair seen from the front). There are 19 step keys today: front, back, tag, scan, size_label, soles, inside_tab, back_or_stamp, model_plate, about_screenshot, front_screen_on, base, front_cover, back_barcode, box_or_set_front, rating_plate, serial, model_date_label, group.
- **What it shows.** The step's line art and the plan's words for it (the shot question's `words`, else the step's name) on a glass panel over the live feed, so the item stays visible through it. A retake shows the same art with the retake's reason.
- **When it goes.** It appears by itself when a step becomes the next one. One press anywhere on it dismisses it, leaving the frame. The shutter takes the photo; once the photo is kept, the next step's guide appears. A step the person refuses (a `read` offer) shows no guide again.
- **Closer or further.** Only on a phone with LiDAR, from the depth module's distance to the item at the frame's centre (`distance_m` on its `onExtent` event, added in the module's next round). Outside the step's range the guide shows a move-closer or move-back mark and the words, like Measure. Ranges are two param rows: `capture_guide_distance_close_m` (prior 0.10 to 0.35) for the reading steps (tag, size_label, inside_tab, model_plate, rating_plate, serial, model_date_label, back_barcode, back_or_stamp), `capture_guide_distance_m` (prior 0.30 to 1.20) for the rest. Without LiDAR no distance mark is drawn: the guide never guesses one.

## 8. What is wrong: named fixes and their tests

Fixed. Each was found by a fresh review and has a regression test:

| Fix | Test |
|---|---|
| F23: identify's brand replaced a stronger label brand, and a running capture with no `lookups_at` waited forever | `captures.test.ts` 139 pass: a known label brand at 0.96 survives an identify at 0.8; a 0.5 label or a `not_read` brand takes the lookup; no `lookups_at` counts as past the wait (cap-fix-2) |
| F18, F19: lookups never ended without a job runner, so lookup fields were never asked and `done` came with a required field missing; with no target nothing was asked | `captures.test.ts` 135, `plan.test.ts` 46, walk counts unchanged (cap-fix-1, merge 09e4bbb1) |
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
| A capture opened without `item_id` took the seeded user's item | `captures.test.ts`, a second person's open gets an item of its own |
| F1: `min_conf` lived on table rows, not `param` rows | `fields.test.ts`, a promoted champion raises one field's bound and the fact is no longer known; with no rows every walk is unchanged (cap-param-1, b7413cc4) |
| F2: `suggest.py` repeated card 7's bounds as defaults | `test_suggest.py`, a row for `capture_preselect_floor` moves the preselect (cap-param-1) |
| F4: facts stayed on the capture | `captures.test.ts`: finish writes each known fact (not `type` or `lot_count`) to the person's item in one store transaction before the capture is judged, with evidence `ref` `<capture>/<step>`; a `you_said` or confirmed attribute is never overwritten; a missing item row is created with `data: captured`; a second person's item never changes (cap-route-2, 6870dc38) |
| F13: job results wrote to a finished capture, and `photo_score` trusted an unkept key | `captures.test.ts`, both refused and the capture unchanged (6870dc38) |
| F10, F11, F12, F14: phone reads were not checked against their row; open ignored the size and a scan its extent; colour's limit lived in the route; studio asks were checked loosely | `captures.test.ts` 128 pass: a read that fails its row is dropped with a logged field and reason; open with 130 cm rigid selects `large_bulky`; a scan at `extent_conf` 0 stays proposed and a failed scan turns `object_capture` off; lists read `row.max`; each ask type's fields and a measure's name are enforced (cap-route-2 round 2, d521628e) |
| F15: `state.change` lacked `was` and repeated | `captures.test.ts`, the captured log passes `spec/log.mjs` `checkLog`, every event has `was` (null on open), none repeats a state (6870dc38) |

Open:

| Fix | What is wrong | The test that will prove it |
|---|---|---|
| F3 | The first real run asked 6 and 7 questions where constructed walks ask 3, because the recorded read has no confidences | With the phone's calibrated reads, the real tee asks no more than the constructed tee (`node scripts/capture-real.mjs`) |
| F5 | The routes keep captures in memory only | Swapped onto the Store `capture` and `photo` tables (integration); a restart keeps an open capture |
| F6 | No job runner calls `applyJobResult` | An identify job's result changes the next GET's plan |
| F7 | `suggest.py`, `judge_type.py`, `learn.py` and `note.py` pass their tests but no product path calls them (the fixture walk, `scripts/walk.mjs`, calls `judge_type.py`) | Each has a caller, or the page retires it |
| F8 | `http.ts` request logs lack `req` and `route` (integration's file) | A full HTTP run passes `spec/log.mjs` |
| F10 | The phone's `reads[]` are not checked against the field row: a read of colour 42 is stored, though PATCH would refuse it | A read that fails its row's type or values is dropped with a logged reason, and the plan is unchanged (`captures.test.ts`) |
| F11 | Open ignores the size `{extent_cm, extent_conf, rigid}` from section 7, and drops a scan's `{scan_ok, extent_cm}` and `depth_ref` | Open with a 130 cm rigid lamp selects `large_bulky`; a scan's extent becomes a measured proposal under `min_conf` |
| F12 | The colour maximum of 2 is written in the route. The table side is done: list rows carry `max` and `table.ts` validates it (cap-param-1) | The route reads `row.max` and no longer names colour (cap-route-2 round 2) |
| F16 | `GET /v1/items/:id` shows each captured attribute with its source and evidence, but `items.ts:29` reads every attribute's confidence as 0 and `items.ts:70` drops the field (integration's file, found by cap-route-2) | The item card shows the confidence the capture recorded |
| F17 | No route sets a capture's `kind`, so `electronics.phones_laptops` is reached only by the walks; and an item's parts are not captured (section 2, the parts of one item) | `walk.test.ts`, each walk run twice with identical output, the nine existing walks' counts unchanged and walk D's output byte-identical after the rename: a prebuilt desktop identified with its components asks no part and not `custom_build`; a custom desktop (eBay, Facebook) with its colour seen and no screen asks, outside the required fields, exactly `custom_build`, the offer, then after the skip `part.graphics` and `part.processor`; with the screen read at 0.95 it asks no part; a custom build derives `model` "Custom build" and never asks it; a laptop reads memory and storage from its about screenshot and asks no part. `parts.test.ts`: constructed Windows 11 and macOS screen lines parse to the expected parts; 476.9 GB reads 512, 1.82 TB reads 2000, 300 GB is dropped; "Processors" does not match "Processor"; no output holds a device name or product ID line. `captures.test.ts`: `kind` is accepted only for its family and cleared by a type change; a label part replaces a lookup part and identify does not overwrite a label part; a skipped offer is never offered again and a retake cannot be refused; the lines are in no stored row and no log; two people's captures stay apart |
| F20 | `recall_flag` is read by `complete.ts` but nothing sets it, so a recalled item is never blocked, contrary to section 11 | A product on a recall list makes every site not ready (`complete.test.ts` with a planted recall), from the job that knows recalls (owner to be named) |
| F21 | Photo upload URLs are placeholders (`https://uploads.example/...`, `captures.ts:361`), so no photo bytes are kept anywhere, and `photo_score` and studio have nothing real to read | An upload to the returned URL is stored, and the key is readable by the scoring job (integration's storage; packet 75) |
| F22 | `POST /v1/captures/:id/talk` is an example handler (`captures.ts:421`), so talk mode does not exist, and `note.py` has no caller (F7) | A spoken or typed note becomes facts with `source: you_said` evidence, through the plan's own checks |
| F14 | Studio asks are checked loosely: a `measure` ask without its name, or a `flaw` without its zone, is accepted | Each ask type's required fields enforced at `applyJobResult` |

The seeded example user's first open replaces the example row. That is by design, so the contract examples stay the engine's output, and `captures.test.ts` asserts it.

## 9. What comes next, in order, each with its measure

0. **Nate's flow, end to end** ([words](../../product/words.md#2026-11-15-nate-the-camera-takes-each-types-shots-then-the-system-processes-then-the-generative-ui-asks-with-prefilled-selects)): the camera takes each type's shots as the process tells the person; the person finishes; the system processes what it can; then the question widgets ask what is left, with selects prefilled where the system is sure. The plan already orders shots before questions (section 2, "While shots are pending") and fills options and `proposed` from `candidates` (section 5). What is missing is what fills those candidates: no visual search route is built (`grep` finds no eBay `search_by_image`, Lens, Web Detection or treg call in `app/src` or `jobs/`), and no job runner carries a result to `applyJobResult` (F6). The routes and their order are in [identify](../features/identify.md) (five visual routes, Lens through SerpApi or treg as one route among them, [treg tool routing](../../research/cross-cutting/nate/treg-tool-routing.md)). Measure: on the fixed set, the share of items whose brand and type questions open with the right option proposed, and questions per item against today's walks.
1. **Ben's screen on the routes** (section 4). Measure: one real item captured on a phone from the first photo to `done`, with the questions recorded beside the walk's counts.
2. **The Swift module** (section 7), on a LiDAR iPhone. Measure: the fixed set's 30 items, the share of `label` reads correct at the confidence they claim, and the known-size box within 1 cm.
3. **F5** (F4 is done): captures survive a restart. Measure: a reloaded store returns the same capture; then F16, the item card shows the confidence each captured fact carries.
4. **F6**: identify feeds the plan. Measure: on the fixed set, how many questions identify removes per item (variants settled, brands and models proposed).
5. **Learning on the params F1 and F2 made** (done: the bounds are param rows): `learn.py` gets its caller (F7). Measure: a planted shift in answer rates promotes a challenger only past 30 items and the bootstrap, and the rollback restores the prior. This is the old proof 8, kept.
6. **The extra-shot bar** from the old design: a view outside the process asked when its worth in money over its cost in seconds passes a bar ([capture-shots cards 2 and 3](../determinations/capture-shots.md#2-what-a-shot-is-worth)). It is not built; today an extra view is asked only for a required field that asking cannot settle. Measure: each asked extra view changed a field on at least 25 of the fixed set's 30 items.

## 10. Proof today

Every command was rerun on the Mac on 2026-11-15.

| What | Command | Result |
|---|---|---|
| The engine | `node --test --test-concurrency=1 app/src/engines/capture/<f>.test.ts`, for table, select, fields, complete, plan, walk and process | 135 tests pass (merge b600bd23, Mac, 2026-11-15; 121 before F1) |
| Questions to done | `walk.test.ts` diagnostics, `capture.questions` | T-shirt 3 (2 with auto confirm), sneakers 4, handbag 5, phone 5, chair 2, bundle of three 9, close-variant table 1 with depth and 2 without |
| Same input, same output | each walk run twice in `walk.test.ts` | identical |
| Plan speed | `captures.test.ts`, "capture plan speed" | p50 0.097 ms, p95 0.282 ms over 52 states; budget 100 ms |
| The routes | `node --test --test-concurrency=1 app/src/edge/api/captures.test.ts`, plus `spec/examples.test.mjs` and `routes.test.ts` | 128, 9 and 6 pass (d521628e; 89 before F4, F10 to F15) |
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
