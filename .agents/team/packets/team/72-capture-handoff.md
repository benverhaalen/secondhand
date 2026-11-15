# 72: capture handoff

Updated: November 15, 2026, night Central. Owner: Nate. Agent: Claude Code, the third capture team lead (Opus 5.5), ending at about half its context ([packet 55](55-team-leads-and-mac-workers.md#a-session-ends-before-it-fills)). Status: row 7's spec (the parts of one item, F17) is reviewed and on main (c7ea4676); its engine half is building on the Mac in worker `cap-parts-1`; its routes brief is written; the LiDAR module (row 5) now leads, by Nate's choice.

The design is [spec/engines/capture.md](../../../../spec/engines/capture.md). Read it first: section 1 says what exists, section 8 lists the fixed and open fixes, and section 9 is the order to build in.

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

**Open now:** `cap-parts-1`, started 2026-11-15 night, `gpt-6.1-sol` at high, brief `/tmp/brief-cap-parts-1.txt` (copy `brief-cap-parts-1.txt` in the session notes folder (`side-session-notes/local_4b3a0b4d-...`)). It holds row 7's engine half: table, select, fields, plan, `parts.ts`, walks, the rename. Not yet read or merged. To finish it: read `WORKER_REPORT.md`, `git status` against the owned list, the diff against the brief and the spec, rerun each test file and `tsc` yourself, and check that the nine existing walk counts did not move. Then send `brief-cap-parts-2.txt` (the routes half, which also fixes the `captures.ts:29` swallowed error that `.agents/check.mjs` flags) into the same worktree with `AGAIN=1`, after merging `origin/main` into it. A fresh reviewer reads the whole diff before the merge to Windows.


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
