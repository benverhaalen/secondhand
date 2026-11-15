# 70: the engines and buying-conversation handoff

Updated: 2026-11-15, about 13:30 UTC, by the second engines lead of the finalization pass ([finalization §4](../../../../spec/plans/finalization.md#4-engines-and-the-buying-conversation-lead-engines)). Owner: Nate. Read this, [packet 55](55-team-leads-and-mac-workers.md) and [valuation.md](../../../../spec/engines/valuation.md) before touching `app/src/engines/` (except `capture/` and `listing/`), `app/src/edge/assist/`, `bench/assist/`, `app/src/edge/api/valuations.ts`, `scores.ts`, `assist.ts`, or `app/src/edge/intel/gather.ts`, `learn.ts`, `classify.ts`, `answer.ts`, `protocols.ts`.

Briefs for every branch below are on the Mac at `/tmp/brief-<name>.txt` (and `-r2`, `-r3`, `-r4` for later rounds). `/tmp` can be cleared: the copies in the shared notes folder's sibling note `engines-lead-2-state.md` name them, and the briefs themselves are in that session's scratchpad.

## True on main

- **EN1, the improved valuation** (squash 5d7f61f1, merge 9d0f91f2). The ablation on 41,988 StockX sales reproduced; see [valuation.md §9](../../../../spec/engines/valuation.md#development-reading-the-ablation-of-2026-11-15).
- **SV6 and EN6's first item: `POST /v1/valuations` prices the person's own item at the request's time through `valuate`.** Branch `w/eng-route-1` at 77a3164a. It reached main inside 3f569d92, a hooks commit by another session that took up my merge while it was in progress in the shared checkout, so that commit's message does not describe it. My §4 row update is 18b216e0, whose "merge:" message describes the route but holds only the row edit. Nothing to undo.
  - What it does: a person's item from their store (another person's, a missing or deleted item is 404, read nothing); `as_of` = the request's time, so a comp an hour old is kept and a future one is not; the result is the valuation plus `range_state` and `gather`; an engine or port fault is `unavailable` with "The valuation could not be finished."; the observation port is a stand-in until SV7 (reads nothing, a write logs `valuation.observations.not_composed`); written rows carry `use_scope 'hackathon_demo'`, `may_share false`, `may_model` from the comp; every dropped row is counted in `valuation.observations.dropped`; an unknown grade logs `valuation.condition_unknown`.
  - Proof: `valuations.test.ts` 51 of 51 in ten runs (five with `SECONDHAND_LIVE_SITES=ebay,mercari`, five unset); two fresh Opus reviews (round 1 fix first, round 2 merge); gate on main 52468f9d plus the branch: 3,944 tests, the same 16 failures as main alone (capture process, Mercari linked search, the walk, search latency, ten renders), tsc clean. `realtime-proof.mjs` stays 2 of 10: link 1 is now earned from the route path where before it was written by hand.
  - The server and app-wiring leads were archived when I tried to tell them: their successors read this line.
- **The rest of EN6** (merge 79a27944 of `w/eng-en6-1` at 0f92bb03): an uncited retail prior is left out instead of hiding the range, and `comparables` returns the `retail_weight` it applied; a positive quantile never rounds below 100 cents and both languages round half up; `valuation_sales_tax_rate` 0.0753 (Tax Foundation 2026 midyear, *asserted* from a search summary, not opened); the sale `as_of` reaches the stale-fee flag; tests reach `last_sale` and `assertParams`. A fresh Opus review said merge. Gate on main 810fd78a plus the branch: one new failure, the Today card whose keep moved 6 cents with the tax rate ($97.33 to $97.27), updated in 0f92bb03. Its four follow-ups are the first queue item.
- **Spec:** [valuation.md §2 "In Databricks' terms"](../../../../spec/engines/valuation.md#in-databricks-terms) (aaecb0b3): the engine as a target sales curve moved by named signals, and which signals a served valuation reads today (history and timing only). The data lead points `databricks/RETAIL.md`'s pricing row at that table, so the signals are stated once. Change a row of that table in the same commit as the code that makes it true.
- Baseline gate on main 52468f9d (Mac, clean worktree `eng-gate-base`): 3,910 tests, 16 failures, none in this area; tsc 0 errors. The gate script is `/tmp/eng-gate.sh <name> <main commit> <branch>...` on the Mac.

## Running on the Mac (judge them first)

None of these is merged. For each: read `WORKER_REPORT.md`, rerun its checks, commit explicit paths on its branch, a fresh review (an Opus seat for anything that changes a figure a person sees), merge `origin/main` into it on the Mac, run the gate script on main plus the branch, then land by `git merge` (never by copying files; packet 55). Watch the shared index: `git diff --cached --name-only` before every commit.

| Worktree, branch | Holds | State at the handoff | Done when |
|---|---|---|---|
| `eng-assist-1`, `w/eng-assist-1` (r3 committed 3cd73bdc, main merged a9e685c1) | BC1, BC2: the runner's call shape and `--dry` (25 of 25 answered), the cost cap, four tools a round, low or medium effort, the number gate before any text streams | **Round 4 running** (brief `-r4`). A fresh Opus review of r3 confirmed every r2 hole closed, then found more ways a made-up price passes: "400 US dollars", "85-120 dollars", "$400k", full-width and Arabic-Indic digits, a zero-width space, "CA$400", and a reported provider cost of 0 that switches the cap off. Three rounds of adding spellings each left new ones, so r4 changes the rule: Unicode normalization first; a sentence-level rule (in a sentence with any currency cue, every number is money unless explained as a date, a model number, a measure or a count); counts never backed by id or url fields; the cap at the larger of the reported and the computed cost. The reviewer's adversarial list is the r4 test list | r4's checks pass; the same reviewer's questions rechecked by a fresh Opus seat with planted cases inside the good range; `.gitignore` gains `bench/assist/out/`; land; BC1 and BC2 rows set |
| `eng-en3-1`, `w/eng-en3-1` (r1 committed 9fc3cd26) | EN3: `app/src/engines/param/export.ts`, the reader of the DB4 export (lazy, keeps the last good file, drops bad rows alone, `hackathon_demo` only when `SECONDHAND_USE_SCOPES` has it); `valuate` takes the exported calibration while our own group is under `valuation_conformal_parent_min` | **Round 2 running**: the sale curve. The worker stopped at r1 because the export has p at 7, 30 and 90 days per ratio bin and `path.ts` needs p at any day and price. My rule (*agent proposal*, to write into valuation.md when it lands): ratio = price / q50; linear between bins, clamped at the ends; piecewise linear in days through (0,0), (7,p7), (30,p30), (90,p90), flat after 90; `t` solved on the segment, the row's t25/t50/t75 for a price-blind row | Its checks; review; land; then wire `fittedReader` into `valuations.ts`'s ctx (my file) with `SECONDHAND_PARAMS_EXPORT`, and EN3's proof: a served valuation with a checked state and a chance of sale that is not null |
| `eng-en7-1`, `w/eng-en7-1` | EN7's scorer: `market-score.ts` (scoreEvent, MarketScore per {site, kind} with Wilson intervals, decayed copy, paired gaps), `freezeBasis` leakage guard, a parity fixture with `experiment.py`, `scripts/market-replay.mjs` over the ablation's estimates | Running (r1) | Its replay matches the ablation's all-on row within 0.05 points; review; land. Then storage (packet 71's `measures.market_score` table, and the registry), `GET /v1/scores?subject_type=market`, and live scoring in the valuation path |
| `eng-tools-1`, `w/eng-tools-1` | BC3's tools (`tools.ts`), from a fresh Opus review of origin/main's tools: Genie per person through `forUser` (today `ask_genie` runs one shared space under the service token: not served, because `POST /v1/assist` on main is still a stub, but it must not be served as it is); summaries only over returned rows, each with its id; `value_item` as one `valuate` call; the real caller and person to the sources; market functions person-only; no vendor text; `search_market` answers from the first `answer.partial` and sends later frames to `deps.onLate` as new result ids | Running (r1) | Its checks; review; land |

Data on the Mac: `~/secondhand-data/measures/engine_all_on-2026-11-15.jsonl` (the served engine's estimates, 41,988 lines) and `~/secondhand-data/measures/ablate-en1-predictions-2026-11-15.jsonl` (every contestant's estimates, copied out of `/tmp/ablate-en1/` so it survives). Tell the data lead if either moves.

## The queue, in order (after the branches above)

0. **EN6 round 2** in worktree `eng-en6-1` (`AGAIN=1`): (1) a parity case with a fractional `retail_weight` (cited retail prior, a kind band, rows at two levels, a recent variant anchor), since every case today has weight 0 or 1; (2) the new-with-tags retail cap (check.ts:90) still applies with no `retail_citation`: gate it on the citation; (3) the 100-cent floor again after calibration (check.ts:108: q10 100 with Q_g 1.0 gives 37 cents); (4) drop the `log.error` fallback for a logger without `note` (check.ts:83).
1. **BC3, the route.** `converse.ts` takes `onLate` (after r4 lands): each late frame becomes a new result id, gated like the first; then `POST /v1/assist` in the shape agreed with the app-wiring lead (below), a two-person test, the $5 daily visitor cap. A visitor's photo is still 422 (Nate's open question).
2. **EN2, the loop**, link by link in `scripts/realtime-proof.mjs` order: link 2, the route runs `gather` when `valuate` returns a need (`valuations.ts`); links 3 and 4, gather's steps call search through its handler; links 5 and 6 need SV7 (packet 86's `srv-obs-1`); link 7, citations resolve to stored rows (`memoryProof` needs a durable store); link 8, `updateContribution` from the valuation route; link 9, `cutOrder` and `contributionMean` read in gather's order. Each link updates its test in the same commit.
3. **`may_model` at write time** in `app/src/engines/valuation/sold.ts`: true for Apify rows whose site is not eBay, false for every eBay row (agreed below), with a test.
4. **EN7's rest** (above), then **EN4**: land `w/eng-ad9-1` (fcde0de4) with the search lead's two lines in `search.ts` sent as a diff; serve the brand measure from the exported `brand_premium` (the EN3 reader already validates it); `path.ts bestSites` as the twin of `placement.py pick()`. EN5 follows capture's parts parser.
5. **BC4**: the first scored run on Windows, low then medium effort, each run's cost recorded before the next.

## Waiting on Nate

- Whether a visitor's photo may reach the conversation model before the identify step strips it to attributes. Until then a visitor's image is 422.
- Any real-time market score (EN7) or backtest figure on a public page or in the pitch needs both Nate and Ben to have seen it first.
- The visitor turn cap `ASSIST_TURN_MAX_USD` 0.25 is an *agent proposal*; the daily cap of $5 is his.
- The sale-curve rule above and the 100-cent floor are *agent proposals*.

## Agreed with other leads

- **Server lead (SV7):**
  - `readObservations` purpose `show` = may_show and not expired, which valuation reads;
  - purpose `model` = may_model true at both levels and not expired, which fits read;
  - the writer refuses rows whose `may_store` is not true;
  - SV6 is mine, and it is on main (above). One marked line in `valuations.ts` is where the real functions plug in.
  - SV7 had not landed at this handoff. Its brief is `srv-obs-1` (packet 86).
- **Data lead (DB4):** the export shape is in the shared note `eng-en3-export-shape.md`; the export is on Mac branch `w/dbx-export-1`, unmerged. Packet 71 adds `measures.market_score` per {site, kind} for EN7.
- **`use_scope` on every route or search write is `hackathon_demo`** unless the source's `source_rights` row says `product`; no source says so today. `product` means cleared for a shipped model, and would let a demo-only row into `comp_for_product` and `core.param` (data lead, 2026-11-15).
- **`may_model` is set once, at write time**: Apify rows whose source site is not eBay get true; every eBay row, direct or through Apify, gets false (data-use.md:105). The loader, the views and every fit read only `may_model`.
- **App-wiring lead:** `POST /v1/assist`, auth visitor:
  - request `{surface:'buy', text ≤ 2000, history? ≤ 10 turns {role, text ≤ 4000}, search_job_id?, image? (person only), item_id?/want_id?/capture_id? (person only)}`;
  - it answers `202 {id, kind:'assist', state:'running', stages, stream}`;
  - events `assist.tool` (no input), `assist.text {delta}` (gated sentences), `assist.settled` (calls without input, cut sentences emptied), `job.state`;
  - `503 unavailable` when there is no key, `429 rate_limited` with `extra.cap: 'daily'` at the $5 visitor cap, `422` for bad input.

  Their client already sends this.
- **Search lead:** frames in-process through `jobs.listen` and `framesAfter` (the shared note `eng-bc3-search-frames.md`); `group` ('platform' | 'osint') per source is coming; Google Shopping through treg was asked of them, with `may_model` false until a research note on Serper's and Google's terms.

## Learned the hard way

- A worker's "all pass" covers only the cases its tests build. Ask for the adversarial case inside the good range. On the number gate, three rounds of adding spellings each left new ones; the fix was a rule that treats an unexplained number in a money sentence as money.
- A test that runs the real sold sources reads `SECONDHAND_LIVE_SITES` and the clock, so it passes or fails by machine (3 of 31 once on the Mac). Stub the sources and pin `deps.now` in every route test.
- The shared Windows checkout: another session's commit can take up your merge in progress. Make the merge and its commit in one command, or check `git log -1 --format=%P` after.
- The `Rests-on:` checker splits references on commas and spaces; it needs a `#heading` on any page with several sections.
- A Codex worker cannot be steered mid-run. When a ruling changes the brief, let it finish and fix the line after (as with `use_scope` on the route), or stop it (`pkill -f "codex exec.*<worktree> "`) and restart with `AGAIN=1`.
- Text held per round keeps the gate whole, but the first words arrive at the end of a model round. Revisit with BC3's late frames.
