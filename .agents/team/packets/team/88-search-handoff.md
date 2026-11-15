# 88: the search lead's handoff

Updated: November 15, 2026, about 13:05 UTC. Owner: Nate. Agent: Claude Code, the search lead (Opus), written at about two thirds of its context ([packet 55](55-team-leads-and-mac-workers.md#a-session-ends-before-it-fills)). For: the next search lead. Read with [finalization §3](../../../../spec/plans/finalization.md#3-search-and-the-sources-lead-search) (each row's state column is current) and the [run page](../../../../research/cross-cutting/nate/runs/public-client-live.md).

## 1. What is true on main

| Row | Commit | State, and the proof rerun by the lead (who wrote none of it) |
|---|---|---|
| SR1 | 87363be1 (`harness/compose.ts`), server lead's e167869b, fc523bcf then 8560d836 | `composeSources` gives createRuntime the anonymous clients when `BROWSER_USE_API_KEY` or a local Chrome (`SECONDHAND_CHROME`, then the default Windows path) exists, never under `node --test`. The route file `app/src/app/v1/search/index+api.ts` imports the runtime, because the dev server bundles each route alone; without it search had no harness and Depop and eBay answered `no_route` (that is what the phone showed). Observed on the dev server 12:55 UTC, signed out: Dupe 40, Depop 24, Poshmark 48, eBay 240, Mercari "needs your account". Benchmark: section 3 |
| SR2, SR5 | 0dab0e35 (merged 5477b7e7) | Done. Caller from the request; a visitor gets no Facebook stage; Mercari answers `needs_account` before any route check. Public reads share an unscoped route: ten visitors cost one eBay and one Depop read |
| SR3 | 0dab0e35 | Built. No eBay-to-Apify fallback; Facebook is read for a person after `answer.settled` and arrives as `answer.late`; `may_model: false` rows never reach `sameProduct`; caps count through `runtimePorts.apifyRuns`. Off until the server lead composes the kv-backed port and `apifyToken` (agreed: keys `apify_runs/person:<id>:<day>` and `apify_runs/day:<day>`). Tell them when to switch it on |
| SR4, SR6 | 53c8df78 (merged 041f7ffe) | Built. Settle clock from the job; queue time counts; the last caller of a shared read aborts it; one throw fails one source; `answer.late` for late arrivals; drops split (`sold`, `out_of_stock`, `duplicate`, `unreadable_card`, filters); `found = used + drops` on every frame (`checkSearchCounts`); other currencies; an empty query refused; every row carries `may_store` and Dupe's `keep_until` (SV2). Open: the abort into the browser read (worker `search-harness-2`) |
| SR7 | the public-client change, merged 5477b7e7 | Done. 32 eBay reads alone at 12:40 UTC: p50 2.40 s, p95 3.21 s, no refusal; `bench/reads.mjs` keeps the log. The 12:28 403 was one first response; it backed off as designed |
| SR8 | 4986dc7d (merged 06e40795) | Built. Seven classes per read, counted per site and day, logged without the query, shown in `GET /v1/sources/health` (`reads` appears only when there are counts until the example gains the field: round 3 item 8); a refusal or challenge pauses the site's reads 15 min doubling to 4 h. Depop 32 reads 12:29 UTC: 24 answered, 8 empty, none refused |
| SR9 | 9dbe635a (merged 06e40795) | Done. `node scripts/search-errors-check.mjs` prints []. `sellerOffer` in `spec/sites.mjs` got a JSDoc type so the three make_offer calls lost their cast |
| SR10 | 87363be1 and the server lead's e167869b | Built. No plain-fetch Depop or eBay client is left in runtime.ts; compose.test.ts shows the live flag never reaches a fetch |
| Dupe fixture | 7c5b7677 | The Dupe search fixture is hand-written in the recorded shape (asked before the history rewrite) |
| Logs | 8560d836 | answer.partial, settled and late log lines pass through `storable()`, so no Dupe row is written to the server's logs. `spec/events.json` still says those events carry "the whole answer": reword it to "the answer as it may be stored" |

## 2. Open branches and workers on the Mac

- `search-route-1` (worktree `~/dev/projects/secondhand-wt/search-route-1`), **round 3 running** (`gpt-6.1-sol`, high), brief in the shared notes folder as `search-route-1c.txt`: SR11 (`sources[]` and `group` 'platform' | 'osint'), Dupe's copies of listings read directly dropped as `read_directly` (that exact key: the app lead asked), `fill_until` on the job when a fill starts, `search-latency.test.ts`'s three failures, `reads: []` in the sources.health example. When it reports: read the diff, `git fetch origin && git merge origin/main` in the worktree (main moved: 8560d836 changed search.ts's two log lines and its imports, and the server lead's SV10 change edits `search.test.ts` resets and visitor fixtures; resolve there, never on Windows), rerun search, run, public, search-latency, search-route, runtime tests, push the ref to main, then message the app-wiring lead and the engines lead the commit.
- `search-harness-2`, **running**, brief `search-harness-2.txt` in the notes folder: the abort signal through `harness.call` into the browser read (counted `timed_out`, never a pause), `publicClients.warm(site)`, and eBay's in-page parse on large pages (23 of 29 reads fell back to the server parse with `zero_cards`). After it lands add `{ signal: o.signal }` as the fourth argument of `o.harness.call` in `intel/public/search.ts` `readSource` (the worker may not touch that file).

## 3. The benchmark (SR1's proof), runs of 12:54 and 12:57 UTC

Dev server on Windows (`.claude/launch.json` entry `search-bench`, port 8092, scratch `SECONDHAND_DATA_DIR`), `node bench/run.mjs --base http://localhost:8092`, nobody signed in. Run 1 (`bench/out/2026-11-15T12-54-50-009Z-ours`): coverage 20 of 20; first answer p50 1.19 s, p95 1.42 s; full answer p50 8.33 s, p95 10.06 s; sources an answer drew on, median 2 (clothes and shoes 3: Poshmark, Depop, eBay; furniture 1: eBay). Run 2 (`bench/out/2026-11-15T12-57-53-440Z-ours`, started at once after run 1): coverage 20 of 20; first answer p50 1.05 s, p95 1.27 s; full answer p50 3.71 s, p95 8.62 s; sources median 2.5. Run 2 drew on run 1's fresh shared reads (SR5), so its full answer is the warm case and run 1's is the cold one (*inferred*). Both runs' `raw/` folders and the scratch data folder are deleted (no Dupe link left; checked with grep), and the dev server is stopped.

Two things to find next, both in my files:
- The full answer's 8.3 s median is above the 5 s goal. Likely cause (*inferred*): the bench sends 20 searches about 9 s apart, eBay's pace is 6 a minute with a 10 s gap, and SR4 now counts queue time, so eBay's slot slides and some searches end eBay late or not at all (electronics-2 and three small-goods items have no eBay). Measure one search at a time, then decide whether eBay's 10 s gap (a param, `search_ebay_harness_min_gap_ms`) is the right prior.
- Dupe never appears in the bench's per-answer `sites[]`, though it answers on every search. Check how `bench/run.mjs` maps Dupe rows (it may count by `site` only, or by `source_site`) and say which in the bench README.

## 4. The queue, in order

1. Land round 3 and `search-harness-2` (section 2). Rerun the four tests the orchestrator found failing in a clean worktree at origin/main: the two "unsigned searches" in `search-latency.test.ts`, "cached-then-live refresh", and "Mercari linked search refuses another person and loads only the asking account" (settle with the server lead whether the last is his account-scoping change, fd545dcb, or our linked search; tell the orchestrator).
2. SR1's two benchmark findings (section 3), then rerun the benchmark twice; record on the bench README and the run page.
3. SR12 (engines lead's ask, Nate's word 2ec1c3c7, "google shopping pages reveal the price of ebay products, im sure treg has something"): Google Shopping through Serper as a source, group `osint`, `source_site` kept per row, `may_model: false` until a research note on Serper's and Google's terms says otherwise; asking prices, not sold. The cross-source benchmark measured it at 16 of 16, 592 rows, p50 1.09 s, $0.032 for 16 queries (`research/cross-cutting/nate/runs/cross-source-benchmark-2026-11-15.md`; its code is `scripts/bench/roi.mjs`). Key by presence only. Send the engines lead the row shape.
4. SR13, an agent proposal, research only (asked by the orchestrator on Nate's question): a device-side read lane, the phone loading a site's page in a web view on the person's own device and running `harness/listing-parser.ts` there. What it takes, what each site's terms say, what it changes for pace and refusals. A research note, not a build.
5. SR8's `reads` always present once round 3 lands; the eBay in-page parse fix measured live (32 reads alone, then beside the other lanes, since eBay took 7.97 s with five lanes at once).

## 5. Decisions made, one line each

- `composeSources` lives in `harness/compose.ts` and returns createRuntime's options; the dev server's singleton caches it on globalThis (server lead).
- An empty `BROWSER_USE_API_KEY` is not a key.
- The per-person Apify cap counts in the kv table, not a new table (Nate, "use whatever is easiest", c3a09a74).
- `answer.late` after `done`: the job stream stays open until `answer.late` or `fill_until`, capped by `job_fill_grace_s` 60 (server lead builds it; the phone already reads on).
- Dupe's call stays (its tool cannot leave sites out); only its copies of listings we read directly are dropped, its new rows kept (Nate, 06:55 Central).
- eBay is read in every buy search and lands last, the conversation answering from earlier frames (Nate, 06:40); our own page read is eBay's first lane, the paid actor behind it (Nate, "lets do our page read").
- Every non-platform source sits under "open source intelligence"; every Dupe row keeps "via Dupe.com" (Nate).

Waiting on Nate: one marketplace account linked through the live view; whether Apify rows may be counted in a measure.

## 6. What I got wrong

- I first put the runtime import inside `api/search.ts`; it replaced the tests' ports and broke 11 tests on main for about twenty minutes (fc523bcf to 8560d836). A side-effect import belongs in the route file, and a fix that touches module load order gets the whole test file rerun before the push.
- I miscounted the eBay fallbacks in the run page's first draft (corrected in 327e47b4). Count from the summary file, not by eye.
- My first SR3 proof wording asked for job `done` within the settled budget; that pushed the Facebook frame after `done`, which the stream then cut off. Ask for the answer to settle, and say what the stream does after.
