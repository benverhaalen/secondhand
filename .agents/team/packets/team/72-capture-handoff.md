# 72: capture handoff

Updated: November 15, 2026, evening Central. Owner: Nate. Agent: Claude Code, the second capture team lead (Opus 5.5), ending before its context fills ([packet 55](55-team-leads-and-mac-workers.md#a-session-ends-before-it-fills)). Status: the spec pass is reviewed and on main; F1, F2, F4, F13 and F15 are merged; F10, F11, F12 (route side) and F14 are worker `cap-route-2` round 2 (section 2).

The design is [spec/engines/capture.md](../../../../spec/engines/capture.md). Read it first: section 1 says what exists, section 8 lists the fixed and open fixes, and section 9 is the order to build in.

## 1. What is true on main

| What | Commit | Proved with (Mac, 2026-11-15, after merging main) |
|---|---|---|
| The plan engine: one table by family and dimension class, field ladders and the known rule, close variants, the question plan, one completeness check shared with listing (`listing/build.ts:86`), studio asks after Generate | 91162d28, 9ee694bc | `node --test --test-concurrency=1 app/src/engines/capture/<f>.test.ts` for table, select, fields, complete, plan, walk and process: 135 pass. `cd app && npx tsc --noEmit -p . \| grep -E "engines/capture\|edge/api/captures"` prints nothing. |
| F1 and F2: every capture prior lives once, in the `params` block of `jobs/capture/process.json`. Each rung's `min_conf` is the param `capture_min_conf.<field>.<way>`, scoped by family. `suggest.py` reads the same params; colour's list `max` is a table column | b7413cc4 | `fields.test.ts` (a promoted row moves the known rule), `./.venv/bin/python -m pytest jobs/capture/test_suggest.py -q` 16 pass. Walk outputs unchanged. |
| The capture routes, with F4 (finish writes known facts to the person's item in one store transaction, then judges), F13 (a finished capture refuses job results, an unkept photo key is invalid) and F15 (`state.change` carries `was` and fires only on a move) | 6870dc38, merged b600bd23 | `node --test --test-concurrency=1 app/src/edge/api/captures.test.ts` 108 pass, `spec/examples.test.mjs` 9, `routes.test.ts` 6, `items.test.ts` 69. |
| Questions to done per item type | same | `walk.test.ts` diagnostics: T-shirt 3 (2 with auto confirm), sneakers 4, handbag 5, phone 5, chair 2, bundle of three 9, close-variant table 1 with depth and 2 without. Each walk runs twice with identical output. |
| The spec pass: the drafts of `photo.md`, capture's section of `identity.md` and the four determinations pages, reviewed by a fresh Opus seat against the code. All 14 findings were fixed: a wrong worked example, the question order restated wrongly, UPC-A shown as open though `jobs/identity/codes.py` joins it, and duplicate rules cut to links. capture.md headings now carry no code, because `.agents/checks/links.mjs` slugs inline code to dashes. | 8dda4b3a | The links check on the changed pages reports no errors. The review is in the session notes folder as `cap-spec-review-1.md`. |
| `scripts/capture-real.mjs` runs on Windows: Python is found where there is no `.venv`. Its test writes to a temp file, so the dated record no longer changes on every check, and live scores are compared within the PIL decode difference (1e-3) | 052119fe, a3c4a8cc | `node --test --test-concurrency=1 scripts/capture-real.test.mjs` 10 pass on Windows and the Mac. |
| Packet 75 for integration: F5 Store tables, F6 runner calls, studio plans reaching the capture, F16 item card confidence | 8bdb3c49 and later | Queued as item 4b in [packet 69](69-integration-handoff.md). |

Completion: capture's row in [completion](../../../../spec/plans/completion.md) is still 26 of 40. F4 does not move a cell; the joins wait on the job runner (F6).

`node .agents/check.mjs` on Windows at b600bd23 failed only outside capture: `.agents/skills/image-gen/run.test.mjs` refuses a temp folder under the user's home (8 tests), and "no product code carries its own copy of an offer clock". Neither is capture's.

## 2. Open branches and worktrees on the Mac

| Worktree (`~/dev/projects/secondhand-wt/`) | Holds | State |
|---|---|---|
| `cap-route-2` | Round 1 (F4, F13, F15) merged as b600bd23. Round 2 is F10 (reads checked against the row), F11 (open's size and a scan's extent), F12 route side (`row.max`) and F14 (studio ask fields). Brief: `/tmp/brief-cap-route-2b.txt` on the Mac. | Running at the stop, or done and unread. Read `WORKER_REPORT.md` ("Round 2"), diff against the brief, commit, merge `origin/main` there, rerun captures, examples and tsc, merge to Windows. |
| `cap-param-1` | F1, F2, F12 table side | Merged through cap-route-2. It can be removed. |
| `cap-join-1`, `cap-plan-1`, `cap-real-1`, `cap-routes-1` | Merged earlier | They can be removed. |

## 3. The queue, in order

| # | Item | Owned files | Done when |
|---|---|---|---|
| 1 | Land `cap-route-2` round 2, then move F10, F11, F12 and F14 to Fixed in capture.md §8 | `captures.ts`, its test | Each named test in §8 passes; tsc clean for `edge/api/captures`. |
| 2 | When integration says the `capture` and `photo` tables exist (F5, packet 75): swap `captureRows` onto `runtime.store`, and keep `depth_ref` and `pose_ref` on the photo row (round 2 leaves a `shortcut:` comment for this) | `captures.ts`, its test | A reloaded store returns the same GET body. A second person's dump holds none of the first's rows. |
| 3 | F7: give `learn.py` a caller on the params F1 made, or retire it, and the same for `note.py` | `jobs/capture/learn.py`, `note.py`, and the caller | A planted shift in answer rates promotes a challenger only past 30 items and the bootstrap, and the rollback restores the prior. |
| 4 | Identity's code rung calls `gtin14` (found by the review: only `pair.py` does). This is the engines lead's file: send them the line. | `jobs/identity/ladder.py` (engines) | A UPC-A item scanned as EAN-13 `0…` reaches the same product through the ladder. |
| 5 | Photo engine fixes P1 to P12 in [photo.md](../../../../spec/engines/photo.md). Card 21's "weighted sum of ranks" against `pool.py`'s raw values needs a decision first. | `jobs/photo/*` | Each named test in photo.md passes. |
| 6 | The phone's depth and scan module against capture.md §7 | the Swift module (Ben's decision); only a device proves it | On a LiDAR iPhone, `device` flags, calibrated `reads[]` and a scan's extent arrive, and the real tee asks no more than 3 (F3). |
| 7 | The box check for scan size | a fixed-set record beside `spec/items/capture-real/` | A known 30 cm box measures within 1 cm. Until then a scan's `extent_conf` stays 0. |

Items 6 and 7 wait on a device.

## 4. Decisions made, and why

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

- **A test that writes a tracked file dirties every checkout that runs the check.** It only looked deterministic because it ran on one machine. Point a CLI test's output at a temp path.
- **The two capture-real tests passed only because of their order.** The first rewrote the record that the second compared against exactly. Compare a cross-platform float within a stated tolerance.
- **A repo-wide find-and-replace reaches files you do not own.** Mine touched canon (`spec/product.md`), and I reverted it there. Scope a relink to your own files, then send the owner the rest. Canon still links to `capture.md#11-the-deterministic-plan`, which no longer exists. That is for the orchestrator.
- **A pull while another session commits can fail halfway** and suggest `git reset --hard`. Do not run it. Read `git log --graph` and `git status` first; here the other session's merge had completed, and nothing was lost.
- **A worker's own "fresh review" is still the author's.** The lead reads the diff against the brief before merging.
