# State of completion

Asked by Nate ([words](../../product/words.md#2026-11-15-nate-turn-on-the-captcha-solver-if-it-solves-problems-and-assess-completion-as-a-percent)): "assess the state of completion as a percent for the system". Counted on 2026-11-15 between 11:00 and 14:00 Central by each team lead on one rubric, and kept here by the orchestrator. It covers the backend; the screens are Ben's and are not counted.

## The rubric

Each area lists its pieces. Each piece gets four yes-or-no answers, and every yes names the command, commit or URL behind it:

- **Built**: the code exists and its own tests pass.
- **Joined**: it runs as part of the composed product, reachable from a route or the deployed bundle, not only on its own.
- **Real**: it has run on real data or against a real site, with the dataset named. Constructed states, recorded replies, examples and synthetic fixtures do not count.
- **Reviewed**: a fresh reader checked the diff and the board row is ticked.

An area's percent is its share of yes cells.

## The count

| Area | Pieces | Built | Joined | Real | Reviewed | Yes cells | Percent |
|---|---|---|---|---|---|---|---|
| Capture | 10 | 9 | 5 | 5 | 7 | 26 of 40 | 65% |
| Engines | 11 | 9 | 7 | 2 | 0 | 18 of 44 | 41% |
| API, events, search, bench | 16 | 11 | 8 | 6 | 0 | 25 of 64 | 39% |
| Databricks | 9 | 9 | 8 | 6 | 0 | 23 of 36 | 64% |
| **All four** | 46 | 38 | 26 | 19 | 7 | **90 of 184** | **49%** |

Read across: three quarters of the pieces are built and pass their tests, about a third are joined into the running product, a fifth have touched real data, and an eighth have been freshly reviewed. The site harnesses are the orchestrator's and are not in the table: public reads are proved live on Depop, Poshmark, Mercari and eBay, Dupe's licensed search is built, and no signed-in read or write has run on a real account.

Capture, recounted by the capture lead at the stop (2026-11-15, main at bc62e789): Built 9 (every piece but measure from depth, which needs the Swift module on a device). Joined 5: selection, field ladders and the question plan reach the person through the capture routes (fc43c5a0, bc62e789); the routes themselves; completeness through `listing/build.ts:86`. Not joined: close variants and studio asks (their inputs arrive only through `applyJobResult`, which no job runner calls yet), photo and identify (Python jobs with no runner). Real 5: selection, ladders, the plan and completeness on Ben's three real garments with a recorded vision read, and the photo score on their real pixels (`node scripts/capture-real.mjs`, `spec/items/capture-real/2026-11-15.json`, data captured, one run on three items, not accuracy). Reviewed 7: the six engine pieces and the routes (two fresh reviews; the second's isolation fault F9 fixed in 117d9311).

## Does the real-time loop run end to end?

No. Two independent checks on 2026-11-15 agree.

`node scripts/realtime-proof.mjs` walks ten links using recorded inputs, replays search through Poshmark's configured public-page lane, and checks the real valuation input with live sites unset; today 1 of 10 works.

| # | Link | State | Evidence |
|---|---|---|---|
| 1 | A valuation with a thin basis says so | wrong | the recorded answer has `n_eff` 1 and a 1900-cent point range; `check` drops comparables' `category` level and `too_few` state; the real input still uses the example item, with blocked sold searches when live sites are unset |
| 2 | The thin answer raises a gather request | built, not called | `gather` has no product caller; the guard shows the thin value with a `too_few` note, but gather requires hidden, so it returns `nothing_to_gather` with no request |
| 3 | The search widens over more sources | built, not called | a separate search reads 12 rows from recorded Poshmark HTML; five source rows are excluded with reasons; the shown thin probe records no steps; only a separate no-basis control records skipped step 6 |
| 4 | Rows are matched to the same product | built, not called | all 12 rows remain visible with unresolved relations, `identity.by=default`, `model_ok=false` and `product=null`; no recorded identity judgement was supplied |
| 5 | Kept rows become `observation` rows with evidence | not built | the store has no observation table and nothing writes one |
| 6 | The basis is recomputed from the store | built, not called | direct sold comps raise Kish `n_eff` from 1 to 2.965857903694928; the recorded route repeat stays 1; gather sums age weights (2.458508544085739); no observation-store projection feeds `check` |
| 7 | The same question gets a better-supported, cited answer | built, not called | the recorded route repeat is unchanged; hand-fed sold comps give 1100/1600/1900 cents, but all three citation basis ids lack observation rows |
| 8 | A weight that depends on the observations moves | built, not called | the learning function has no caller; called by hand it moves and forgets correctly |
| 9 | The next answer reads the moved weight | built, not called | the diagnostic contribution mean moves from 0.5 to 0.4 at version 2; the recorded valuation stays unchanged at supplied version 1, which the real input port still hardcodes |
| 10 | The same inputs give the same outputs | works | two fresh runs are byte-identical, with no network call attempted |

The proof's tests assert each state and pin the input-port source; a separate no-basis control preserves the 120-second deadline and skipped-step checks, and the earlier scientific audit ([science-audit.md](sweep/science-audit.md)) records the missing joins.

Also true today, from the engines lead's count: the valuation route prices a fixed example item, not the person's item; comparables are matched on all title words, so there is never a variant-level match; and the listing date stands in for the sale date.

## What moves the number most

1. Wire the real-time loop, link by link, with the proof as the measure. It turns many built pieces into joined ones.
2. Fresh reviews: every Reviewed cell outside capture is no. Reviews alone would take the engines from 41% to about 66%.
3. One real marketplace account linked through the cloud browser's live view (Nate), which is the only way any signed-in read becomes real.
4. The composition root creating the watcher and the ledger-backed site service, which takes the demo path from 9 real joins of 20 to 14.
