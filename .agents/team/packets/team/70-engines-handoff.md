# 70: the engines and buying-conversation handoff

Updated: 2026-11-15, about 08:30 Central, by the engines lead of the finalization pass ([finalization §4](../../../../spec/plans/finalization.md#4-engines-and-the-buying-conversation-lead-engines)). Owner: Nate. Read this, [packet 55](55-team-leads-and-mac-workers.md) and [valuation.md](../../../../spec/engines/valuation.md) before touching `app/src/engines/` (except `capture/` and `listing/`), `app/src/edge/assist/`, `bench/assist/`, `app/src/edge/api/valuations.ts`, `scores.ts`, `assist.ts`, or `app/src/edge/intel/gather.ts`, `learn.ts`, `classify.ts`, `answer.ts`, `protocols.ts`.

## True on main

- **EN1, the improved valuation, landed:** squash commit 5d7f61f1, merged at 9d0f91f2. It is the four commits of `w/eng-valuation-2` after three fresh Opus reviews (scratchpad review-en1.md, rounds 1 and 3). What it does:
  - the log-ratio calibration;
  - coverage measured from our own sales, so a range can reach `checked`;
  - a thin basis never reads `checked`;
  - a curve without evidence still prices and says `curve_checked: false`, top level included;
  - a family band shows its ends and no median;
  - an uncitable row is dropped and logged instead of failing the answer;
  - a store fault keeps the valuation (`persisted: false`, `warm_unavailable`);
  - `valuate(item, ctx)` is the one entry.
  
  Proof, rerun on the Mac on the landing tree:
  - `realtime.test.ts` 4 of 4, `check` 53, `valuate` 21, `comps` 32, parity 28 in TS and 19 in Python, `aci` 15, `tools` 64, `valuations` 17, `realtime-proof.test.mjs` 13; `tsc` clean.
  - The ablation rerun on the same 41,988 StockX sales (input SHA-256 02fe1413, 2,404 s) reproduces [valuation.md §9](../../../../spec/engines/valuation.md#development-reading-the-ablation-of-2026-11-15) to the digit.
  - The full gate on the tree had no new error from this branch. Its 234 errors are main's existing debt: harness and browser logging, render and app-check tests without browsers.
- The Dupe fixture is scrubbed: 6d34186a, the six recorded Dupe rows in `assist/fixtures/tools/search.json` replaced by hand-written ones.
- **Nate's rulings today**, each verbatim in [words](../../../../product/words.md):
  - rows with `may_model` false (eBay API, Apify) may price and be cited in a shown range: "they can, they are verified real data";
  - Apify rows may fit the models: "Yes, Apify too". It replaced "no keep fits clean", given minutes earlier;
  - real-time scores per market on each platform, extremely accurate;
  - in a buying conversation eBay lands last, with answers already coming in (relayed by the search lead).
  
  eBay content, including eBay rows read through Apify, stays out of fits under eBay's terms. That is my reading, not overruled.
- Spec: [valuation.md §9 "Real-time market scores"](../../../../spec/engines/valuation.md#real-time-market-scores) (the design, *agent proposal*, row EN7), and §2 rights (5a74d725).

## Running on the Mac at the wrap-up, about 13:00 UTC (judge them first)

Both workers were still running when Nate called the wrap-up, so their latest edits are uncommitted in the worktrees. When a worktree has `WORKER_REPORT.md`, read it, rerun its checks, commit the explicit paths on its branch, and only then review. Nothing on either branch is merged. The Mac's shared `app/node_modules` was rebuilt from main's lockfile at 12:54 UTC and now holds `@anthropic-ai/sdk`.

Open review findings:
- `w/eng-assist-1`: from review round 2 (scratchpad `review-bc2.md`), round 3 targets all of them, and none is verified fixed:
  - hole B: "400 euros", "400 pounds", "400 EUR", "a 400-dollar jacket" and "50 cents" read as counts, so a count or the person's own number backs a price;
  - A: "8-10", "2-3 days", "MA-1" and "COVID-19" read as negatives and cut good sentences;
  - C: model numbers like A1466 and PS5 cut good sentences;
  - a round with no token fields and no cost is priced at 0;
  - number words: "Kennedy half dollar" and "100 percent sure" are cut;
  - "Nov 15, 2026" is cut.
- `w/eng-route-1`: no review yet.

The ablation finished, and its result is in "True on main". Its outputs are on the Mac at `/tmp/ablate-en1/` (out.json, out.predictions.jsonl, out.log.jsonl). /tmp may be cleared, so the served engine's estimates were also copied, in the data lead's columns, to `~/secondhand-data/measures/engine_all_on-2026-11-15.jsonl` (41,988 lines, SHA-256 03acc610…). Tell the data lead if that file moves.

## Waiting on Nate

- Whether eBay rows read through an Apify actor may fit the models. Today they may not, by my reading of eBay's terms ([data use](../../../../spec/data-use.md)).
- Whether a visitor's photo may reach the conversation model before the identify step can strip it to attributes. Until then a visitor's image gets 422.
- Any real-time market score (EN7) or backtest figure on a public page or in the pitch needs both Nate and Ben to have seen it first.
- The visitor turn cap `ASSIST_TURN_MAX_USD` 0.25 is an *agent proposal*. The daily cap of $5 is his.

## Branches

| Worktree, branch | Holds | Done when |
|---|---|---|
| `eng-assist-1`, `w/eng-assist-1` (commits 2f553fff, 36ca64f2; round 3 uncommitted, brief `/tmp/brief-eng-assist-1-r3.txt`) | BC1 and BC2: the runner's real call shape and `--dry`; a cost cap a turn; four tools a round; low or medium effort only; text emitted only after the gate, round by round; money and pct backed only by cited rows; the person's text backs only counts and dates; fixed failure codes; cut sentences never in an event | Round 3 closes the reviewer's hole B (euros, pounds, EUR, GBP, cents and "400-dollar" read as counts) and A, C and the minors. Then: rerun `converse.test.ts` and the dry run, commit, a third look by the same reviewer (scratchpad `review-bc2.md` has rounds 1 and 2), squash onto origin/main with `Rests-on:` refs separated by commas (the checker splits on commas and spaces, not `;`), add `bench/assist/out/` to `.gitignore`, merge, set BC1 and BC2 in finalization §4 |
| `eng-route-1`, `w/eng-route-1` (from 9d0f91f2, brief `/tmp/brief-eng-route-1.txt`) | SV6 and EN6's first item: `POST /v1/valuations` prices the person's own item at the request's time through `valuate`. Its observation port is a stand-in that logs skipped writes until the server lead's `observations.ts` lands, read with purpose `show`. An engine fault is `unavailable` with a fixed message; `range_state`; proof link 1 becomes works | Its checks, then a fresh Opus review (money a person sees), then a squash merge. Tell the server lead and the app-wiring lead the commit |

Mac facts learned: the shared `app/node_modules` is stale (it lacks `@anthropic-ai/sdk` and `expo-secure-store`), so a worktree that runs `tsc` needs its own `npm ci`, done by the lead before the worker starts. The worktree for the gate is `eng-land-1` or `eng-land-2` (both landed; remove them).

## The queue, in order

1. Land `eng-assist-1` and `eng-route-1` (above).
2. **EN6, the rest of the engines review**, plus the round-3 latent items:
   - a retail prior without its citation hides a blended range (check.ts, `noCitation`); have `comparables` return the blend weight it applied instead of `retailWeight` copying it;
   - tests that reach the last-sale fallback and `assertParams`;
   - the whole-dollar rounding in comps.ts and its Python twin together (S5: a low end of 0 drops a learning event);
   - the tax rate's source (keep.ts);
   - a sale `as_of` so the stale-fee flag fires.
3. **EN2, the loop**, link by link in `scripts/realtime-proof.mjs` order. Link 1 comes with the route. Then:
   - link 2: the route runs `gather` when `valuate` returns a need;
   - links 3 and 4: gather steps call the search through its handler;
   - links 5 and 6: SV7's writer and reader;
   - link 7: citations resolve to stored rows, since `memoryProof` needs a durable store;
   - link 8: `updateContribution` from the valuation route, for the sources that contributed comps;
   - link 9: `cutOrder` and `contributionMean` read in gather's step order.
   
   Each link updates its test in the same commit.
4. **EN3**, the reader of the DB4 export, against a fixture of the agreed shape. The shape is in the shared notes `eng-en3-export-shape.md`:
   - param rows `valuation_calibration`, `valuation_sale_curve` and `brand_premium` in `row.json`'s shape;
   - the file `/Volumes/secondhand/raw/export/params/latest.json`, read at boot and every 10 minutes, keeping the last good file;
   - `hackathon_demo` rows used only when `SECONDHAND_USE_SCOPES` includes it.
5. **EN7, the real-time market scores** (Nate's ask, design in valuation.md §9). Score each sold row prequentially before it enters a basis, keep a `market_score` row per `{site, kind}`, and serve it on `GET /v1/scores?subject_type=market`. The proofs are a StockX replay matching the ablation's all-on row, and the leakage test.
6. **EN4**:
   - land `w/eng-ad9-1` (fcde0de4) with the search lead's two lines in `search.ts` (`similar_other_brand` in `matchOrder`, `relation: 'similar'` in `rank()`), sent as a diff;
   - serve the brand measure from `brand_premium`;
   - make `path.ts bestSites` the twin of `placement.py pick()` (AD5, brief restated in the older version of this packet).
   
   EN5, the value of parts, follows capture's parts parser.
7. **BC3**: a fresh review of `tools.ts`, then:
   - `value_item` calls `valuate`, one call behind both the money and what is visible;
   - `search_market` reads the search job as a stream (the contract is in the shared notes `eng-bc3-search-frames.md`): it answers from the first `answer.partial` frames, and later frames become new result ids;
   - `POST /v1/assist`, in the shape agreed with the app-wiring lead (below), with a two-person test and the daily visitor cap.
8. **Vocabulary** (orchestrator, for the Databricks judges at 19:00 UTC). When writing or revising `spec/engines/valuation.md` and `spec/engines/adaptation.md`, use Databricks' own terms where they name the same thing: a target sales curve as the baseline, adjusted in real time by named signals (demand, competition, customer sensitivity, timing, season and outside events, digital behavior, history). The mapping is in [databricks-retail-solutions.md](../../../../research/data/nate/databricks-retail-solutions.md). On 2026-11-15 a served valuation read only history live, and timing only as age decay. The data lead has the list for `databricks/RETAIL.md`.
9. **BC4**: the first scored run on Windows, low then medium effort (`OPENROUTER_API_KEY` is set there), recording each run's cost before the second starts.

## Agreed with other leads

- **Server lead (SV7):**
  - `readObservations` purpose `show` = may_show and not expired, which valuation reads;
  - purpose `model` = may_model true at both levels and not expired, which fits read;
  - the writer refuses rows whose `may_store` is not true;
  - SV6 is mine.
- **Data lead (DB4):** the export shape above. On the Apify rule's effect on DB1, I asked which way to set `may_model` for Apify rows; the answer is pending.
- **App-wiring lead:** `POST /v1/assist`, auth visitor:
  - request `{surface:'buy', text ≤ 2000, history? ≤ 10 turns {role, text ≤ 4000}, search_job_id?, image? (person only), item_id?/want_id?/capture_id? (person only)}`;
  - it answers `202 {id, kind:'assist', state:'running', stages, stream}`;
  - events `assist.tool` (no input), `assist.text {delta}` (gated sentences), `assist.settled` (calls without input, cut sentences emptied), `job.state`;
  - `503 unavailable` when there is no key, `429 rate_limited` with `extra.cap: 'daily'` at the $5 visitor cap, `422` for bad input.
  
  Their client already sends this.
- **Search lead:**
  - frames in-process through `jobs.listen` and `framesAfter`; `group` ('platform' | 'osint') per source is coming;
  - Google Shopping through treg was asked of them as a source, with `may_model` false until a research note on Serper's and Google's terms.

## Learned the hard way

- A worker's "all pass" covers only the cases its tests build. Round 2's citation-isolation test passed because its bad rows were outliers. Ask for the adversarial case inside the good range.
- The `Rests-on:` checker splits references on commas and spaces. A `;` becomes part of the anchor and fails the gate. It also needs a `#heading` on any page with several sections. 41834691 went out without one; it is pushed, so it was left as it is.
- A Codex worker cannot be steered mid-run. When a ruling changes the brief, stop it (`pkill -f "codex exec.*<worktree> "`), edit the brief, and restart with `AGAIN=1` and a note about the partial edits. That cost five minutes this session.
- Text held per round keeps the gate whole, but the first words arrive at the end of a model round, not a sentence at a time. Revisit when BC3 streams search frames.
