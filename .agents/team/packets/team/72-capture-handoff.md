# 72: capture handoff

Updated: November 15, 2026, night Central. Owner: Nate. Agent: Claude Code, the third capture team lead (Opus 5.5), ending at about half its context ([packet 55](55-team-leads-and-mac-workers.md#a-session-ends-before-it-fills)). Status: row 7's spec (the parts of one item, F17) is reviewed and on main (c7ea4676); its engine half is building on the Mac in worker `cap-parts-1`; its routes brief is written; the LiDAR module (row 5) leads next, by Nate's choice, and is not started; Nate called the wrap-up, so section 0 is the place to start.

The design is [spec/engines/capture.md](../../../../spec/engines/capture.md). Read it first: section 1 says what exists, section 8 lists the fixed and open fixes, and section 9 is the order to build in.

## 0. Where capture stands at the wrap-up (2026-11-15, Nate's word to wrap up)

Nate ([words](../../../../product/words.md#2026-11-15-nate-wrap-up-the-sessions-review-the-whole-project-then-the-presentation)): "we assess what works, what doesnt, whats left".

**Works on main today**
- The plan engine: type, class, process, field ladders, questions, order, cap, done. `node --test --test-concurrency=1 app/src/engines/capture/<f>.test.ts` for table, select, fields, complete, plan, walk and process: 135 pass (Mac, b600bd23).
- Questions to done: T-shirt 3, sneakers 4, handbag 5, phone 5, chair 2, bundle of three 9, close-variant table 1 with depth and 2 without. These are `walk.test.ts` diagnostics, and each walk runs twice with identical output.
- The capture routes (open, photos with checked reads and scan extent, PATCH, finish writing facts to the item, GET, job results): `node --test --test-concurrency=1 app/src/edge/api/captures.test.ts` 128 pass, `spec/examples.test.mjs` 9, `routes.test.ts` 6, `items.test.ts` 69 (d521628e).
- Every capture prior is one param row: `./.venv/bin/python -m pytest jobs/capture/test_suggest.py -q` 16 pass (b7413cc4).
- The real-photo run on Windows: `node --test --test-concurrency=1 scripts/capture-real.test.mjs` 10 pass (a3c4a8cc).
- The design for the parts of one item (F17), reviewed twice, and packet 77 for engines (c7ea4676).

**Does not work, or is not joined**
- The capture screen calls no route: `app/src/app/camera.tsx` plays scripted steps. This is Ben's screen.
- The app has no LiDAR, ARKit or Object Capture code, so `device`, `reads[]` and scan extents never come from a phone.
- Parts (F17) are not on main. The engine half is parked on `w/cap-parts-1` at 09f42821, with 3 parser tests red (section 2); the routes half is unbuilt (`brief-cap-parts-2.txt`). The four canon rows the orchestrator approved wait on that branch: they land in the commit that merges it (`canon-rows.md` in the notes folder, with item 3 reworded so that `custom_build` is an attribute with source, confidence and evidence).
- Captures live in memory only (F5, waits on integration's tables), and no job runner calls `applyJobResult` (F6).
- `suggest.py`, `judge_type.py`, `learn.py` and `note.py` have no product caller (F7), so nothing learns.
- The item card shows every captured confidence as 0 (F16, integration's `items.ts`).
- The first real run asked 6 and 7 questions where the walks ask 3 (F3), because the recorded reads carry no confidences.
- A scan's size stays a proposal (`extent_conf` 0) until the box check passes.
- Found by audit after the wrap-up, now F18 to F22 in capture.md section 8: lookups never finish without a job runner, so lookup fields are never asked and `done` can come with a required field missing (F18, the most serious); no linked site means no questions at all, appraise included (F19); nothing sets `recall_flag` (F20); photo uploads go to a placeholder URL (F21); talk mode is an example handler (F22).
- `node .agents/check.mjs` flags `captures.ts:29` as a swallowed error; the fix is in brief 2.

**Left, in order** (who can test it)
1. The LiDAR module, brief below. The Mac can compile it and test its geometry; only Nate's LiDAR iPhone proves it.
2. Land `cap-parts-1`, then brief 2 in the same worktree, then the canon rows, in one merge. The Mac tests all of it. Before merging, grep the whole repo for `phones_laptops` (`jobs/`, `spec/items/`, `spec/examples/`, `databricks/`) and leave no reader of the old id.
3. The box check (row 6): a known 30 cm box measured within 1 cm. This needs a person and the device.
4. F5, when integration's `capture` and `photo` tables exist. The Mac tests it.
5. F7, the learning callers. The Mac tests it.
6. Identity's code rung calls `gtin14`. This is engines' file.
7. Photo fixes P1 to P12, after Nate's cover-pick answer. The Mac tests them.
8. Ben's screen on the routes, which ends the demo capture. Ben, on a device.

### The LiDAR module brief (row 5, for whoever picks capture up)

Nate chose "Build the module first" ([words](../../../../product/words.md#2026-11-15-nate-build-the-lidar-module-before-a-testflight-build)). The orchestrator's three conditions hold:
- **Self-contained.** It adds a capability and changes no existing screen, navigation or dependency version. The app builds and runs exactly as before when the module is unused, on a phone with no LiDAR and on web.
- **Ben gets one packet before it merges.** It says what was added, what the build needs (the camera permission string, the dev client rebuild) and how a screen calls it. Ben decides when a screen uses it.
- **No session installs anything.** No EAS build or submit and no device install. Send the orchestrator the exact steps Nate does himself: on the Mac, sign in to Xcode with his Apple ID, plug in the phone, run `npx expo run:ios --device` in the app. The Mac has Xcode 27.2 and no signing identity.

Facts for the brief: `research/capture/nate/expo-module-arkit-depth-2026-11.md` (written by a retriever this session: check it is committed and read its *asserted* lines before trusting them) and `capture-tech-docs-2026-11.md`. The worker has no network, so these go into the brief with their URLs.

The outcome, as one worker on `gpt-6.1-sol` at high:
- A local Expo module, `app/modules/capture-depth/` (Swift, Expo Modules API, SDK 58), made the documented way for a local module.
- `capabilities()` returns `{has_lidar, object_capture}`: `has_lidar` is `ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth)` and `object_capture` is `ObjectCaptureSession.isSupported`.
- A native view that runs an `ARSession` with scene depth and emits `onExtent {extent_cm {width, depth, height}, extent_conf: 0, rigid, frames}` for the framed item. The method: use the high-confidence depth pixels in the centre region, unproject them with the intrinsics scaled to the depth map, find the support plane, keep the points above it, and take the box on the plane's axes.
- The JS side uses `requireOptionalNativeModule`. On web, on Android and without the module, it returns `{has_lidar: false, object_capture: false}` and no view, so the routes' defaults (false) hold.
- The geometry lives in a pure Swift file with no ARKit import, so the Mac can test it with synthetic points. Tests: a 30 × 20 × 10 cm box on a plane gives those sides within 0.5 cm; noise below the confidence bar is ignored; an empty frame gives no extent; the same points twice give the same box.
- `extent_conf` is sent as 0 until row 6 passes (capture.md §7).

Done: the module's Swift tests pass on the Mac; `cd app && npx tsc --noEmit -p .` is clean for the module; `npx expo prebuild --platform ios` and an `xcodebuild` for a generic iOS device compile with no signing. The app's existing tests and screens are unchanged. A dev-only screen that opens a capture and posts the scan is Ben's call: ask him in the packet, and do not add it before he answers.

## 1. What is true on main

| What | Commit | Proved with (Mac, 2026-11-15, after merging main) |
|---|---|---|
| The plan engine: one table by family and dimension class, field ladders and the known rule, close variants, the question plan, one completeness check shared with listing (`listing/build.ts:86`), studio asks after Generate | 91162d28, 9ee694bc | `node --test --test-concurrency=1 app/src/engines/capture/<f>.test.ts` for table, select, fields, complete, plan, walk and process: 135 pass. `cd app && npx tsc --noEmit -p . \| grep -E "engines/capture\|edge/api/captures"` prints nothing. |
| F1 and F2: every capture prior lives once, in the `params` block of `jobs/capture/process.json`. Each rung's `min_conf` is the param `capture_min_conf.<field>.<way>`, scoped by family. `suggest.py` reads the same params; colour's list `max` is a table column | b7413cc4 | `fields.test.ts` (a promoted row moves the known rule), `./.venv/bin/python -m pytest jobs/capture/test_suggest.py -q` 16 pass. Walk outputs unchanged. |
| The capture routes, with F10 to F14 (d521628e: reads checked against their row, open's size and a scan's extent, list limits from the table, studio ask fields), F4 (finish writes known facts to the person's item in one store transaction, then judges), F13 (a finished capture refuses job results, an unkept photo key is invalid) and F15 (`state.change` carries `was` and fires only on a move) | 6870dc38, merged b600bd23 | `node --test --test-concurrency=1 app/src/edge/api/captures.test.ts` 128 pass, `spec/examples.test.mjs` 9, `routes.test.ts` 6, `items.test.ts` 69. |
| Questions to done per item type | same | `walk.test.ts` diagnostics: T-shirt 3 (2 with auto confirm), sneakers 4, handbag 5, phone 5, chair 2, bundle of three 9, close-variant table 1 with depth and 2 without. Each walk runs twice with identical output. |
| The spec pass: the drafts of `photo.md`, capture's section of `identity.md` and the four determinations pages, reviewed by a fresh Opus seat against the code. All 14 findings were fixed: a wrong worked example, the question order restated wrongly, UPC-A shown as open though `jobs/identity/codes.py` joins it, and duplicate rules cut to links. capture.md headings now carry no code, because `.agents/checks/links.mjs` slugs inline code to dashes. | 8dda4b3a | The links check on the changed pages reports no errors. The review is in the session notes folder as `cap-spec-review-1.md`. |
| `scripts/capture-real.mjs` runs on Windows: Python is found where there is no `.venv`. Its test writes to a temp file, so the dated record no longer changes on every check, and live scores are compared within the PIL decode difference (1e-3) | 052119fe, a3c4a8cc | `node --test --test-concurrency=1 scripts/capture-real.test.mjs` 10 pass on Windows and the Mac. |
| Packet 75 for integration: F5 Store tables, F6 runner calls, studio plans reaching the capture, F16 item card confidence | 8bdb3c49 and later | Queued as item 4b in [packet 69](69-integration-handoff.md). |

| Row 7's design: the parts of one item (F17). Kinds `electronics.desktops`, `electronics.laptops`, `electronics.phones` (renamed from `phones_laptops`); `components` in the table; `custom_build` with a derived model; a read offer (`system_info`) the person may skip; the parser; label over lookup for parts. Reviewed twice by a fresh Opus seat against the code: 11 findings, then 10, all folded in | c7ea4676 | The review is `cap-parts-review-1.md` in the session notes folder (`side-session-notes/local_4b3a0b4d-...`). Links check clean. |
| Packet 77 to the engines lead: what a part attribute holds and what capture guarantees (row 8) | c7ea4676 | Nothing to run. |

Completion: capture's row in [completion](../../../../spec/plans/completion.md) is still 26 of 40. F4 does not move a cell; the joins wait on the job runner (F6).

`node .agents/check.mjs` on Windows at b600bd23 failed only outside capture: `.agents/skills/image-gen/run.test.mjs` refuses a temp folder under the user's home (8 tests), and "no product code carries its own copy of an offer clock". Neither is capture's.

## 2. Open branches and worktrees on the Mac

**Parked:** `cap-parts-1` at 09f42821 (branch `w/cap-parts-1`, committed in its Mac worktree, nothing uncommitted). Row 7's engine half is built. Passing, per the worker: table 23, select 21, fields 40, plan 51, walk 15, complete 10, process 4, `test_process.py` 11, `tsc` clean. The nine existing walk counts are unchanged; the new walks count prebuilt desktop 2, custom desktop without a screen 6, with a screen 4, laptop 3. `parts.test.ts`: 16 pass and 3 fail, because the spec's old size rule read Windows' 476.9 as 500. The spec now has the binary-or-decimal rule (section 2, the parser). Walk D's plan differs from before only in `kind: phones` (its questions are byte-identical; the test pins a hash of the rest). To land it, in this order:
1. A follow-up brief, `AGAIN=1` into the same worktree, to implement the new size rule until the 3 tests pass.
2. Rerun every file yourself, then a fresh reviewer on the diff.
3. Merge `origin/main` there, then brief 2 (`brief-cap-parts-2.txt`).
4. Grep the repo for `phones_laptops`, then land with the four canon rows in one commit.
None of this has been read by a lead yet: the numbers above are the worker's claim.


| Worktree (`~/dev/projects/secondhand-wt/`) | Holds | State |
|---|---|---|
| `cap-route-2` | F4, F13, F15 (6870dc38, merged b600bd23), then F10, F11, F12 route side and F14 (d521628e) | Merged. `captures.test.ts` 128 pass, examples 9, items 69, routes 6, tsc clean. It can be removed. |
| `cap-param-1` | F1, F2, F12 table side | Merged through cap-route-2. It can be removed. |
| `cap-join-1`, `cap-plan-1`, `cap-real-1`, `cap-routes-1` | Merged earlier | They can be removed. |

## 3. The queue, in order

| # | Item | Owned files | Done when |
|---|---|---|---|
| 1 | When integration says the `capture` and `photo` tables exist (F5, packet 75): swap `captureRows` onto `runtime.store`, and keep `depth_ref` and `pose_ref` on the photo row (round 2 leaves a `shortcut:` comment for this) | `captures.ts`, its test | A reloaded store returns the same GET body. A second person's dump holds none of the first's rows. |
| 2 | F7: give `learn.py` a caller on the params F1 made, or retire it, and the same for `note.py` | `jobs/capture/learn.py`, `note.py`, and the caller | A planted shift in answer rates promotes a challenger only past 30 items and the bootstrap, and the rollback restores the prior. |
| 3 | Identity's code rung calls `gtin14` (found by the review: only `pair.py` does). This is the engines lead's file: send them the line. | `jobs/identity/ladder.py` (engines) | A UPC-A item scanned as EAN-13 `0…` reaches the same product through the ladder. |
| 4 | Waits on the cover-pick decision, which the orchestrator put to Nate (2026-11-15; capture recommends ranks, because raw parts sit on different scales). Photo engine fixes P1 to P12 in [photo.md](../../../../spec/engines/photo.md). Card 21's "weighted sum of ranks" against `pool.py`'s raw values needs a decision first. | `jobs/photo/*` | Each named test in photo.md passes. |
| 5 | **Next, by Nate's choice** ([words](../../../../product/words.md#2026-11-15-nate-build-the-lidar-module-before-a-testflight-build): "Build the module first", before any TestFlight build). The orchestrator's conditions (2026-11-15): a self-contained Expo module (Swift, Expo Modules API, SDK 58) that adds a capability and changes no existing screen, navigation or dependency version, so the app builds and runs as before when it is unused, on a phone with no LiDAR and on web; it reports `has_lidar` and `object_capture` and a depth extent with sceneDepth's confidence; `extent_conf` is sent as 0 until row 6 passes. Before it merges, Ben gets one packet: what was added, what the build needs (permission strings, the dev client rebuild), how a screen calls it; he decides when a screen uses it. No EAS build or submit and no device install by any session: send the orchestrator the exact steps Nate does in Xcode (he signs in with his Apple ID on the Mac and plugs in his phone; the Mac has Xcode 27.2 and no signing identity). Facts for the brief: `research/capture/nate/expo-module-arkit-depth-2026-11.md` (a retriever wrote it this session; check it is committed) and `capture-tech-docs-2026-11.md`. The app has no LiDAR code today; `app/src/app/camera.tsx` plays scripted steps and calls no route (lead 2's check). The phone's depth and scan module against capture.md §7 | the Swift module (Ben's decision); only a device proves it | On a LiDAR iPhone, `device` flags, calibrated `reads[]` and a scan's extent arrive, and the real tee asks no more than 3 (F3). |
| 6 | The box check for scan size | a fixed-set record beside `spec/items/capture-real/` | A known 30 cm box measures within 1 cm. Until then a scan's `extent_conf` stays 0. |
| 7 | Parts of one item (F17): specified and reviewed at c7ea4676 ([capture engine, the parts of one item](../../../../spec/engines/capture.md#the-parts-of-one-item)). Engine half in worker `cap-parts-1` (section 2); routes half in `brief-cap-parts-2.txt`. Canon rows were sent to the orchestrator (`canon-rows.md` in the notes folder); do not edit canon. The question waiting on identity: its confirm should carry `kind` and `components` from the published specification (packet 77); until then a prebuilt desktop is asked "Custom build?" | `jobs/capture/process.json`, `test_process.py`, `table.ts`, `select.ts`, `fields.ts`, `plan.ts`, `parts.ts`, `walks.ts` and their tests; then `captures.ts` and its test | Section 8's F17 row: every named test passes, the nine existing walk counts are unchanged, each new walk runs twice with identical output |
| 8 | The value of the parts: the engines lead's, sent as [packet 77](77-parts-contract-for-engines.md). Capture does not edit `app/src/engines/valuation/` | engines | packet 77's done line |

Items 5 and 6 wait on a device. Also read [adaptation's](../../../../spec/engines/adaptation.md) fixes AD9 to AD12: AD10 asks capture to read material and construction from the label, or ask once, only in kinds whose attribute record needs them.

## 4. Decisions made, and why

- **A desktop's system-information photo is an offer, not a process step.** Many towers are sold without a screen, so a required step would leave the capture `shooting` forever. The offer comes once the build is settled; a skip is a refused step.
- **Laptops get their own kind; phones keep theirs, renamed.** A phone has no parts; a laptop's swappable parts are memory and storage. The soldered processor and graphics are the model's attributes.
- **A part's label read beats the published specification.** A prebuilt may have been upgraded. Every other field keeps the old rank.
- **The screen's text lines are parsed on the server and never kept.** One versioned parser, with no app release needed to fix it. The same screen shows the device name and product ID.
- **The kind reaches the routes** through the suggestion, the type pick and identify's confirm. Before this, `phones_laptops` was reachable only in fixtures (F17).

- **Rung confidences are named per field and way, scoped by family.** The registry's `Scope` has no field key, and one declared param has one prior. `capture_min_conf.<field>.<way>` keeps each row's own prior, and `{kind: family}` lets it learn per family.
- **Every capture prior is in one place, `process.json` `params`.** TypeScript and Python both read it, because suggest.py had repeated card 7's numbers.
- **Finish writes every known fact except `type` and `lot_count`.** Those two shape the capture, not the item. The capture's attributes merge through `mergeAttribute`, so an attribute the person confirmed or said is never overwritten by a read. The item write comes first, and the capture is judged only if it succeeds.
- **A missing item row is created at finish** with `origin: capture`, `data: captured`, like the import job's row.
- **No job writes after finish** (F13). An identify result that arrives late is refused as stale, and the runner logs it as the job's failure reason (packet 75).
- **Engine headings carry no inline code.** The links check and GitHub slug code differently, so a heading without code is the one anchor both accept.
- Unchanged from the first lead: no tape requirement (published dimensions when identity is sure, then depth or a scan, then one question); close variants are asked once; while shots are pending only type, piece count and retakes are asked; a field no linked site needs is never asked.

## 5. Waiting on Nate or Ben

- Card 21 says the cover pick is a weighted sum of ranks, and `jobs/photo/pool.py` sums raw values. Which one is right is a product call. photo.md now says the code sums raw values.
- The same three as before: Ben's capture screen calling the routes; real items with tape measurements and later sold prices; a LiDAR iPhone running the Swift module.

## 6. What this session learned the hard way

- **Two review rounds on a spec were worth it.** The first draft could not run: no route set `kind`; the read offer had no path in `fieldState` and could not be refused; the gate on the parts did not exist; `validateTable` threw on a kind with no `types` row. Each was cheap to fix in prose and costly in a worker round.
- **`node .agents/check.mjs` on Windows still fails outside capture** (the image-gen temp-folder tests, and swallowed-error flags in harness and browser files). The only capture flag is `captures.ts:29`, which brief 2 fixes.

- **A test that writes a tracked file dirties every checkout that runs the check.** It only looked deterministic because it ran on one machine. Point a CLI test's output at a temp path.
- **The two capture-real tests passed only because of their order.** The first rewrote the record that the second compared against exactly. Compare a cross-platform float within a stated tolerance.
- **A repo-wide find-and-replace reaches files you do not own.** Mine touched canon (`spec/product.md`), and I reverted it there. Scope a relink to your own files, then send the owner the rest. Canon still links to `capture.md#11-the-deterministic-plan`, which no longer exists. That is for the orchestrator.
- **A pull while another session commits can fail halfway** and suggest `git reset --hard`. Do not run it. Read `git log --graph` and `git status` first; here the other session's merge had completed, and nothing was lost.
- **A worker's own "fresh review" is still the author's.** The lead reads the diff against the brief before merging.
