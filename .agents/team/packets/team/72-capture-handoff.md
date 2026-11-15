# 72: capture handoff

Updated: November 15, 2026, late afternoon Central. Owner: Nate. Agent: Claude Code, the capture team lead (Opus 5.5), ending before its context fills ([packet 55](55-team-leads-and-mac-workers.md#a-session-ends-before-it-fills)). Status: the plan engine, the capture routes and the isolation fix F9 are on main; two spec drafts were in flight at the stop (section 2).

The design is [spec/engines/capture.md](../../../../spec/engines/capture.md), rewritten from the code in this session's spec pass (1ef09528). It is the page to read first: section 1 says what exists, section 8 lists named fixes F1 to F15, and section 9 is the order to build in.

## 1. What is true on main

| What | Commit | Proved with (rerun on the Mac, 2026-11-15) |
|---|---|---|
| The plan engine: one table by family and dimension class, field ladders and the known rule, close variants, the question plan, one completeness check shared with listing, studio asks after Generate | 91162d28 (rounds 1 to 5), 9ee694bc (round 6: tsc clean, `missingFor` takes any listing site) | `node --test --test-concurrency=1 app/src/engines/capture/<f>.test.ts` for table, select, fields, complete, plan, walk and process: 121 pass. `cd app && npx tsc --noEmit -p . \| grep -E "engines/(capture\|listing)"` prints nothing. |
| Questions to done, per item type | same | `walk.test.ts` diagnostics (`capture.questions`): T-shirt 3 (2 with auto confirm), sneakers 4, handbag 5, phone 5, chair from an unsure first frame 2, bundle of three 9, table with two close size variants 1 with depth and 2 without. Each walk is run twice, with identical output. |
| The capture routes: open, photos with the phone's reads, PATCH (type, answer, refuse, generate), finish and GET, all returning `plan`; captures kept per person; `applyJobResult` for identify, studio_plan and photo_score | fc43c5a0 (with the integration lead's edits), bc62e789 | `node --test --test-concurrency=1 app/src/edge/api/captures.test.ts`: 89 pass. `spec/examples.test.mjs` 9 pass, `routes.test.ts` 6 pass. tsc is clean for `edge/api/captures`. |
| The planner's timing | bc62e789 | "capture plan speed" in `captures.test.ts`: p50 0.097 ms, p95 0.282 ms over 52 states. Budget 100 ms. This is the synchronous planner only, not the device or HTTP. |
| One real run on three garments | 2900538b | `node scripts/capture-real.mjs` writes `spec/items/capture-real/2026-11-15.json`, labelled `data: captured`, one run on three items, not accuracy. Ben's real tee, hoodie and work pants: photo scores 69 to 77 (tag photos 90 and 94, no masks). Questions: tee 6, pants 7 (4 required by the linked sites, plus the optional ones capped at 3). The hoodie waits on a back photo its set lacks. |
| Listing uses capture's check | engines lead | `app/src/engines/listing/build.ts:86` calls `missingFor`. |
| Research behind the device facts | 702a157 | [capture-tech-docs-2026-11](../../../../research/capture/nate/capture-tech-docs-2026-11.md): Object Capture still needs LiDAR; a LiDAR phone can still fail a scan; expo-camera gives no depth; Vision reads UPC-A as EAN-13. |

Completion at the stop: capture's row in [completion](../../../../spec/plans/completion.md) is 26 of 40. The routes' board row is ticked now that F9 is merged.

## 2. Open branches and worktrees on the Mac

| Worktree (`~/dev/projects/secondhand-wt/`) | Holds | State |
|---|---|---|
| `cap-join-1` | Round 3: fix F9 (a capture opened without `item_id` took the seeded user's item) | Merged as 117d9311 (8e4443f4). `captures.test.ts` 95 pass, examples 9, tsc clean. `routes.test.ts` fails 1 of 6 on `valuation-sold.ts: missing module manifest`, another area's new route on main, not this change. |
| `cap-plan-1`, `cap-real-1`, `cap-routes-1` | Merged | Nothing open. They can be removed. |

Two Sonnet drafts were being written in the Windows checkout at the stop. They are not reviewed:
- `spec/engines/photo.md` rewritten from the code, plus a "Capture's side" section in `spec/engines/identity.md`. The identity page is shared with the engines lead; only that section is capture's.
- "**Built:**" lines and duplicate-rule cuts in the four determinations pages: `capture-shots.md`, `fields-by-kind.md`, `seeing-the-item.md` and `asking-and-intent.md`.

If they were committed, their commit says "draft, unreviewed". The fresh session's first spec step is an Opus review of them against the code.

## 3. The queue, in order

| # | Item | Owned files | Done when |
|---|---|---|---|
| 1 | The spec pass, finished: an Opus review of the drafts in section 2, then fixes | the four determinations pages, `photo.md`, capture's section of `identity.md` | Each card the code implements says where. No rule is stated on two pages. The reviewer finds no claim about code that the code contradicts. |
| 2 | Studio's asks joined through the route. The plan and `applyJobResult` take them, but no job puts a studio job's `manifest.json` `plan` into a capture. | integration's job runner (their file) calling `applyJobResult(user, capture, {kind: "studio_plan", plan})` | After `PATCH {generate: true}`, a studio run's flaw ask appears as a shot in the next GET's plan. |
| 3 | F4: write known facts to the item's `attribute` rows at finish, with evidence `data: captured` | `captures.ts`, its test; it reads the items port through `app/src/edge/api/items.ts` (integration owns that file) | `GET /v1/items/:id` after finish shows every known fact with its source and evidence. A second person's item is never written. |
| 4 | F5 and F6, the integration lead's: the Store tables `capture` and `photo` (shape in capture.md §6), and the job runner's call to `applyJobResult` for identify and photo_score | `app/src/edge/events/ports.ts` TABLES, the file store, the runner | A restart keeps an open capture. An identify job's result changes the next GET's plan. |
| 5 | F10 to F15 (capture.md §8): check the phone's reads against the row, read open's size fields, a `max` column on list rows, no job writes after finish, studio ask fields enforced, `was` on `state.change` | `captures.ts`, `process.json`, `table.ts` and their tests | Each named test in capture.md §8 passes. |
| 6 | F1 and F2: the per-rung `min_conf` as `capture_min_conf` params with the row values as priors, and `suggest.py` reading the same params | `fields.ts`, `table.ts`, `jobs/capture/suggest.py` and tests | A promoted param moves the known rule. Changing the param moves suggest.py's preselect. |
| 7 | The phone's depth and scan module against capture.md §7 | the Swift module in the Expo development build (Ben's decision); only a device can prove it | On a LiDAR iPhone: `device` flags, `reads[]` with calibrated confidences, and a scan's extent arrive. The real tee then asks no more than the constructed tee's 3 (F3). |
| 8 | The box check for scan size | a fixed-set record beside `spec/items/capture-real/` | A known 30 cm box measures within 1 cm on the scan path. Until then a scan's size stays a proposal below `min_conf`. |

## 4. Decisions made, and why

- **No tape requirement.** A dimension follows the ladder: published dimensions first when identity is sure, then depth or a scan, then asking. This was Nate's correction of a misread of Ben's studio ask.
- **Close variants are asked once.** One variant at 0.9 or more is used. Otherwise a depth reading that clears its own `min_conf` and matches exactly one variant settles it silently. Otherwise there is one pick between the variants, with a typed measurement offered, never demanded.
- **Facts from a read enter at the confidence the read recorded.** The studio's recorded read has none, so in the real run every read fact was a proposal at 0. That is why the real items ask more than the constructed walks, and calibrated phone reads are the fix (F3).
- **While shots are pending, only type, piece count and retakes are asked.** A later frame can still settle or change the rest.
- **A field no linked site requires or recommends is never asked.** Required fields are never capped; the others stop at 3 (`capture_question_cap`).
- **Two device flags, not one.** LiDAR is not a working scan: iPhone 17 Pro sessions fail on iOS 26.4 and 26.5.
- **Answers go through `PATCH /v1/captures/:id`,** so the next plan comes back with each answer. The item card's later corrections stay `PATCH /v1/items/:id/attributes/:name`.
- **Studio's asks join the one plan after Generate.** The person is asked once, and a dimension capture already holds is never asked again ([packet 72 for Ben](../studio/72-capture-asks-studio-once.md)).
- **No Python twin of the plan.** The routes run the TypeScript engine and no job plans a capture. `jobs/capture/follow_ups.py` and `next_view.py` say in their headers that they are superseded.

## 5. Waiting on Nate or Ben

- Ben: the capture screen calling the routes, per capture.md §4. Until it does, every capture in the TestFlight demo is the example capture.
- Nate and Ben: real items photographed with tape measurements, and later the price each sold for. Eight to ten are needed for the stopwatch, twenty for the benchmark.
- A LiDAR iPhone running the Swift capture module, and the known-size box check on it.

## 6. What this session learned the hard way

- **My expected walk sequences broke my own rules in four places.** These were size as text, questions asked while shooting, a field no linked site uses, and furniture brand. The worker followed the rules and reported where they disagreed with the expectations. Derive expectations from the rule text by hand before briefing, and treat a worker's "the expectation contradicts the rule" as a finding about the spec.
- **An in-memory store shared across people.** The first routes kept every capture under one id behind the example user gate. A second fallback leaked the seeded user's item into other people's captures (F9). Each was caught only by a fresh review. Every route that holds state gets a two-person test before it merges.
- **A worker was cut from a stale base.** An `AGAIN=1` round runs on its worktree's old base. Bring the worktree up to `origin/main` first, or the check it is asked to pass may not exist there.
- **A worker hard-coded a Mac-only path** (`./.venv/bin/python`) into a test that runs on Windows. Diff every file a worker touched outside its owned list.
- **A Python slice in the wrong direction duplicated a spec section.** Splice text between two anchors only after asserting their order.
- **Briefs need tsc as a done check, not only `node --test`,** because type stripping hides type errors. Every brief now ends with "tsc reports no error in the files you own".
