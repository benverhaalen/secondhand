# 70: the engines and buying-conversation handoff

Updated: 2026-11-15, about 14:50 UTC, by the third engines lead of the finalization pass ([finalization §4](../../../../spec/plans/finalization.md#4-engines-and-the-buying-conversation-lead-engines)), halted on Nate's word: "we need to stop agents from merging and working on top of eachother. ensure they halt at good poitns and we full focus on developing and carving out the needed fixes". Owner: Nate. From the halt, the orchestrator is the only one who merges to main. Read this, [packet 55](55-team-leads-and-mac-workers.md) and [valuation.md](../../../../spec/engines/valuation.md) before touching `app/src/engines/` (except `capture/` and `listing/`), `app/src/edge/assist/`, `bench/assist/`, `app/src/edge/api/valuations.ts`, `assist.ts`, `scores.ts`, or `app/src/edge/intel/`.

Every brief named below is in the shared notes folder as `brief-<worker>[-rN].txt` and on the Mac at `/tmp/brief-<worker>[-rN].txt`.

## True on main

| Commit | What | Proof |
|---|---|---|
| e54d286a, 038d0499 (orchestrator) | BC1, BC2 round 4 (the gate's normalisation; the cost cap at the larger of provider and token cost). BC3's tools: Genie per person, cited summaries, one valuate call, search follows a job's frames | converse 202, tools 77, bench runner 10, tsc clean |
| 5314d834 | **`POST /v1/assist` is the real route** (w/eng-assist-route-1 r1):<br>- visitors and people<br>- `202 {id, kind:'assist', state:'running', stages, stream}`<br>- events `assist.tool`, `assist.text`, `assist.settled`, `job.state`<br>- seeded from the caller's own `search_job_id`; 404 for anyone else's<br>- late search frames as new result ids<br>- a $5 visitor day pool: `assist_visitor_daily_cents` 500, with `assist_turn_max_usd` 0.25 reserved per turn<br>- `503 unavailable`, reason `not_configured`, with no model key | One Opus review before landing: no path from one person to another's data, no text around the gate. assist 27, run-turn 9, converse 205, tools 80, http 35, routes 6, tsc 0, in a clean Mac worktree at origin/main b302ef23 |
| 5314d834 | EN3 r1 to r3: `fittedReader` (param/export.ts) and the sale curve in valuate. It reads all 8 rows of the real DB4 export shape once rows carry `citation` (the data lead fixed the export, 34533628) | export 35, valuate 41, check 59, realtime 4 |
| 5314d834 | EN7 r1 and r2: `market-score.ts`, `freezeBasis`, parity, `scripts/market-replay.mjs`. The replay equals the ablation's all-on row: 3.89% median error, 96.0% within 20%, 86.0% held, width 22.7%, last sale -1.0 points on 41,452. It proves scorer parity only, not prequential freezing | market-score 27, Python parity 4 |
| 5314d834 | sold.ts r1: `Comp.dated_by` ('sold' or 'listed'); `may_model` set at write time (Apify and not eBay true, everything else false) | sold 6, comps 40, valuations 51 |
| d0890a16 | `market_store`'s tool schema had a top-level `anyOf`, so the model API refused every turn with a 400. Only the live run found it | tools 80, with a test that no tool schema has oneOf, allOf or anyOf at the top |
| 1a761cf6 | Route r2:<br>- the settled answer keeps every round's text<br>- rows carry `may_store`; a may_store-false row is in no store or log<br>- the search listener ends on a terminal job.state or at `assist_search_wait_ms` 30000; late fills reach the chat until then<br>- opaque Genie ids<br>- fresh tool deps per turn; two concurrent turns keep their identities<br>- a failed turn releases its visitor reservation<br>- the route imports the runtime | assist 30, run-turn 10, converse 207, tools 100, routes 6, tsc 0 |
| f361db0b | `scripts/realtime-proof.mjs` runs again. 56e985fd made the store refuse to open without a data dir or vault key outside development; the proof now states development and uses a fresh temp store | 2 of 10, unchanged |
| b2508319 | §4 rows EN3, EN7, BC1, BC2, BC3 | |

**The chat on the dev server (14:29 UTC, before r2).** Signed in with a dev code, I searched for "carhartt detroit jacket". The chat's own follow-up answered from the search's rows ("26 listings across 3 sites: Depop (9), Poshmark (13) and Dupe (4)") in 18 s, for $0.17, with the gate checking 3 and cutting 0.

The dev server needs `OPENROUTER_API_KEY` or `ANTHROPIC_API_KEY` in its env. This Windows machine has one; the hosted server has none and refuses with 503.

Seen on screen and not fixed yet (route r3 fixes them):
- raw `**` markdown;
- reason codes in the prose ("not_connected", "invalid input");
- the seed holds 26 capped rows while the screen says "From 84 listings".

## On the Mac, not merged

Their workers may finish. For each that reports: read the report, check `git status` against its owned files, commit them on its branch, merge `origin/main` in the worktree, and rerun its checks there. Leave it for the orchestrator to land.

| Worktree, branch | Brief | State at the halt |
|---|---|---|
| `eng-assist-route-1`, `w/eng-assist-route-1` | `-r3` | **Running.** r1 and r2 are on main. r3 is the clarifying-question block:<br>- `Ask` imported from `app/src/engines/capture/plan.ts`, in the capture.md §4 shape<br>- an `ask_person` tool handled inside converse, giving `{type:'ask', ask}` blocks with id `q_<job>_<field>` and labels through the gate<br>- the answer comes back as `POST /v1/assist` with `answer: {ask_id, field, value}`: 404, 409 or 422 when it doesn't fit; `replaces` supersedes an older ask<br>- plain text with no markdown; no reason codes or tool names in the prose (a check after `checkedDraft`)<br>- the seed's counts taken from the search's totals<br><br>**Before r3 lands, the app must accept `{type:'ask'}` blocks** in `block()` in `app/src/buy/chat/assist.ts`. Otherwise a settled frame that holds an ask is skipped whole. Sent to the orchestrator at 14:15 UTC |
| `eng-gate-5`, `w/eng-gate-5` | `brief-eng-gate-5` | **Running.** The orchestrator's gate rule (*agent proposal*): after normalisation, every numeral and number word in a sentence must equal a figure of a result the sentence cites. A list item or table row goes with its header line, the person's numbers back nothing, and there are no cue, year or "explained" exemptions.<br><br>It owns only the gate functions in converse.ts (`sentences` through `checkedDraft`), so it merges beside route r3.<br><br>Acceptance: its own tests, plus the 20 planted cases in `eng-gate-review-planted.test.ts` in the notes folder (18 of 20 leaked on r4). Run them in its worktree before it lands |
| `eng-sold-1`, `w/eng-sold-1` | `-r2` | **Committed at 3419a3ae with main merged; checks pass** (sold 7, check 61, valuate 41, valuations 52, tsc 0). Not landed. Ben's packet 91 item 6:<br>- a listed-dated comp's observation has `sold_at` null and `listed_at` kept<br>- `last_sale` is chosen only among sale-dated comps<br>- the proof shows `listed_at` and `dated_by` for a listed-dated comp<br><br>Left: the stored `payload.sold_at` still holds the listing-date age clock. Nulling it needs `observationPort.read` / `isComp` in valuations.ts to rebuild the age clock from `listed_at` |
| `eng-loop-1`, `w/eng-loop-1` | `brief-eng-loop-1` | **Running.** EN2, the loop from the valuation route:<br>- links 5 and 6: compose SV7 (`events/observations.ts`) in valuations.ts<br>- link 2: gather on a GatherNeed<br>- links 3 and 4: gather's search through its handler, and sameProduct<br>- link 7: citations to stored rows<br>- link 8: updateContribution<br>- link 9: contributionMean and cutOrder in gather's order<br>- a two-person test<br><br>Done is `node scripts/realtime-proof.mjs` above 2 of 10, with each link earned |
| `eng-assist-review-1` (detached) | | A reviewer's scratch worktree. Remove it: `git worktree remove --force ~/dev/projects/secondhand-wt/eng-assist-review-1` |

## Next, in order (once the orchestrator resumes this area)

1. Land route r3 once the app accepts ask blocks, then the gate rewrite. Then check on the dev server:
   - the answer has no `**` and no reason code;
   - its counts match the screen;
   - a size-ambiguous question shows one Ask with a proposed option.

   Then the app-walks lead reruns the chat walk on the simulator. Its server needs a model key, which the orchestrator arranges.
2. `eng-loop-1`: land the links it earned, rerun the proof, and set the EN2 row.
3. Wire `fittedReader` into valuations.ts's ctx with `SECONDHAND_PARAMS_EXPORT`. EN3's proof is a served valuation with a checked state and a chance of sale that is not null.
4. EN7: move its two params to the valuation param registry. Then storage (`measures.market_score`), `GET /v1/scores?subject_type=market`, and live scoring in the valuation path.
5. EN6 round 2, the four follow-ups:
   - a parity case with a fractional `retail_weight`;
   - the new-with-tags cap gated on a citation;
   - the 100-cent floor applied after calibration;
   - no `log.error` fallback.
6. EN4: land `w/eng-ad9-1` (fcde0de4) with the search lead's two lines. Then BC4: the first scored run, at low effort then medium, with each run's cost recorded before the next.

## Waiting on Nate

- The gate's new rule cuts more ("about 2 weeks" with nothing cited). It is the orchestrator's call, marked *agent proposal*.
- These are *agent proposals*: the sale-curve rule, the 100-cent floor, the visitor turn cap of 0.25, and late fills reaching the chat until the job ends. The $5 visitor day cap is his.
- Market scores go on a public page only after Ben and Nate have seen them, with Nate's yes for that page.

## Learned the hard way

- Only a live run proves the chat. 400 tests passed while the model API refused every turn over one schema keyword. Run the dev server, signed in, before calling a model route done.
- A reviewer given the worker's claims and a planted list finds what the worker's own tests miss: 18 of 20 planted prices got through round 4's gate. The orchestrator changed the rule rather than adding more spellings.
- Hardening in another area can break a proof script with no test catching it (56e985fd and the real-time proof). Run the proof after any server-wide change.
- Land through a private worktree (`C:\dev\secondhand-land-engines`, detached at origin/main), never the shared index. Another session's staged files there stop a merge.
- Run one real sample through a data contract's reader before landing it. The export lacked `citation`, and some `t` values were past 90 or null; either one dropped every row.
