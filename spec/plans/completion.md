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

`node scripts/realtime-proof.mjs` walks the chain in ten links, calling the product's own functions on recorded pages, and marks each one. Today 1 of 10 works.

| # | Link | State | Evidence |
|---|---|---|---|
| 1 | A valuation with a thin basis says so | wrong | the answer has `n_eff` 1 and a range of one point, and drops the level and the `too_few` note it computed |
| 2 | The thin answer raises a gather request | built, not called | `gather` has no caller in the product; a shown thin fact answers "nothing to gather" |
| 3 | The search widens over more sources | built, not called | search reads 24 rows from two recorded sites, but gathering is given no search to run |
| 4 | Rows are matched to the same product | built, not called | all 24 relations stay unresolved, and match levels collapse to yes or no |
| 5 | Kept rows become `observation` rows with evidence | not built | the store has no observation table and nothing writes one |
| 6 | The basis is recomputed from the store | built, not called | called by hand, the effective sample goes from 1 to 2.97; in the product it stays 1; gathering and valuation compute it by different formulas |
| 7 | The same question gets a better-supported, cited answer | built, not called | the repeat answer is unchanged; the citation's ids resolve to no stored row |
| 8 | A weight that depends on the observations moves | built, not called | the learning function has no caller; called by hand it moves and forgets correctly |
| 9 | The next answer reads the moved weight | built, not called | valuation reads the defaults it was handed, not the registry |
| 10 | The same inputs give the same outputs | works | two fresh runs are byte-identical, with no network call attempted |

The proof's test asserts each state, so the day a link is wired the test fails and the record is updated. The scientific audit ([science-audit.md](sweep/science-audit.md)) traced the same path in the code and reached the same result.

Also true today, from the engines lead's count: the valuation route prices a fixed example item, not the person's item; comparables are matched on all title words, so there is never a variant-level match; and the listing date stands in for the sale date.

## What moves the number most

1. Wire the real-time loop, link by link, with the proof as the measure. It turns many built pieces into joined ones.
2. Fresh reviews: every Reviewed cell outside capture is no. Reviews alone would take the engines from 41% to about 66%.
3. One real marketplace account linked through the cloud browser's live view (Nate), which is the only way any signed-in read becomes real.
4. The composition root creating the watcher and the ledger-backed site service, which takes the demo path from 9 real joins of 20 to 14.
