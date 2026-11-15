# 69: integration handoff

Updated: November 15, 2026, about 11:20 Central. Owner: Nate. Agent: Claude Code, the third integration lead (Opus), ending on Nate's word: "Lets wrap up models as they stand when finished on whats currently happening. End all extra sessions and ill archive. We'll review through all of the project ... we assess what works, what doesnt, whats left" (10:00, through the orchestrator). Nothing was deployed, hosted or deleted on the way out.

The area: `app/src/edge/api/`, `app/src/app/v1/`, `app/src/edge/events/`, `app/src/edge/intel/`, `scripts/walk.mjs`, `scripts/watch.mjs`, `bench/`, `spec/examples/`, the joins in [joins.md](../../../../spec/plans/joins.md). The buying-conversation lead owns `app/src/edge/api/assist.ts`, `buy.ts`, `genie.ts` and their tests, and `web/`. Rows older than today are in the second lead's packet: `git show 1107a97a:.agents/team/packets/team/69-integration-handoff.md`.

## What works on main today

Each line with the command or commit that proves it. Test counts are from a run on the merged branch, one file at a time.

- A signed-out search answers 202 at once and streams each source as it lands; a source with no composed route answers `no_route` at once and takes no pace slot, so the full answer arrives within 150 ms of the slowest source that can run, measured on stubs of known delay: `node --test --test-concurrency=1 app/src/edge/api/search-latency.test.ts` (4), `search.test.ts` (49). Merge of `w/int-search-2` on 2026-11-15.
- Search is joined to the runtime: `runtime.ts` sets search's harness, accounts and `routed(site)`; seeded example jobs no longer enter the background queue: `app/src/edge/api/runtime.test.ts` (35), `scripts/watch.test.mjs` (8 on the Mac, 7 on Windows where the SIGTERM test skips).
- `createRuntime({ publicClients })` takes the orchestrator's cloud-browser client for Depop and eBay reads; writes stay forced dry unless the site is in `SECONDHAND_LIVE_SITES`; close is called once: `runtime.test.ts`.
- Facebook and the eBay fallback through Apify exist with caps (10 runs a searcher a day, 200 a process a day, $0.005 a row, all params) and keep `via`, `actor`, `may_model: false`, `use_scope`: `app/src/edge/intel/public/search.test.ts` (17). Dormant: the module-level runtime passes no Apify token, because Apify is never in the path an answer waits on (Nate, 08:25).
- J2, limits: visitor limit bounded and keyed by the host's client address (`SECONDHAND_PEER_HEADER`) else the visitor id; email codes 5 an address and 20 an IP an hour; no raw email in a log; 503 `unavailable` after the first request, keeping its details: `app/src/edge/api/http.test.ts` (20), `auth.test.ts` (14), `me.test.ts` (19). 12a24f33, a0121f60.
- J3 part 1, isolation in the composed runtime: every request-reachable account lookup is scoped to its person; the watcher gets a system-only lookup: `runtime.test.ts`, `accounts.test.ts` (37), `watcher.test.ts` (68). 12a24f33.
- The bench keeps nothing of Dupe: only counts, timings and outcome reach any file or the upload: `node --test --test-concurrency=1 bench/run.test.mjs` (21). 941ab7fc. The workspace volume `/Volumes/secondhand/raw/landing/bench/` holds two runs with 0 Dupe rows (checked with `databricks fs cat`, profile Nate).
- The real-time proof runs: 13 of 13, 1 of 10 links working: `node --test --test-concurrency=1 scripts/realtime-proof.test.mjs`.
- Docs: the hosting brief [spec/plans/hosting.md](../../../../spec/plans/hosting.md) (ece1c263), packet 76 for Ben (the device path), J13 and MI3 (the `public` observation scope, 368f274e).
- Main's check in this area: no test in `app/src/edge/`, `bench/` or `scripts/` fails. The repo check (`node .agents/check.mjs`) fails on files outside this area: `.agents/checks/checks.test.mjs` (1, the UI raw-colors test), `.agents/skills/image-gen/run.test.mjs` (8), and about 180 broken links and research headers in others' docs.

## What does not work, or is not joined

- What a person would see: every product search shows a failed `site:facebook` stage (`no_route`), because the Facebook row is on and no Apify port is composed. Turn the row off until the fill exists, or hide dormant sources in the stage list (a product call): `app/src/edge/intel/public/sources.ts`.
- Depop and eBay answer `no_route` for a signed-out person: `publicClients` is not yet composed in `runtime.ts` (no `BROWSER_USE_API_KEY` path), so a signed-out search still gets 2 sources (Dupe, Poshmark).
- Nothing a search reads is kept, and the valuation route prices only from a live read: J1 is parked on `w/int-obs-1` (below), so proof link 5 is still `not built` on main.
- J3 part 2 is parked on `w/int-byid-2`: on main, `browser/auth.ts` `memoryAccounts.byId(id)` still finds any person's account when called without a person, and `pool.ts`, `signin.ts`, `schedule.ts`, `watcher.ts`, `post.ts`, `handoff.ts`, `storefront.ts` and `harness/protocol.ts:125` call it with one argument. The composed runtime is safe (its own scoped lookup); standalone uses are not.
- `createRuntime` seeds the example user unconditionally: no public URL until a switch exists.
- Nothing is hosted: the phone reaches the API only from a dev client on the same network. A visitor cannot price a thing (`POST /v1/valuations` needs a sign-in).
- No bench rerun since `2026-11-15T10-24-39-853Z-ours` (full answer p50 9.99 s): per Nate, none until the latency fixes were proven; they now are, in `search-latency.test.ts`.
- Two of three Mercari linked-search tests and three storefront tests fail on `w/int-byid-2` once merged with main (not on main).
- 21 files on the Mac hold Dupe rows: `int-bench-3/bench/out/2026-11-15T09-41-21-325Z-ours/raw/*.json` and its `results.json`; deleting them waits on Nate's yes.

## Branches parked on the Mac

Each is committed in `~/dev/projects/secondhand-wt/<name>` on `w/<name>`; nothing uncommitted.

- `w/int-obs-1` (67ac0f7e): J1 phase A, the observation, capture and photo tables, one validated append-only writer, search and sold reads writing through it, own-item valuation; round 3 scoped warm comps by person, product or query and purpose, kept live comps on a write failure, priced the example item only for the example user, made writes cancel-safe. Still needs: one `search.test.ts` fixture whose query differs from its item title (align the fixture's query, not the assertion); MI1's rights per source checked against [market-index.md §1](../../../../spec/engines/market-index.md#1-what-may-be-kept-per-source); a merge of main (`search.ts` changed under it); the proof's link 5 moved on its evidence; a fresh review of rounds 2 and 3. Worker reports: `/tmp/int-obs-1-r*-report.md` on the Mac.
- `w/int-byid-2` (2b5a21d6, main merged): J3 part 2, agreed with the orchestrator as one change across its browser and harness files. Still needs, from its fresh review: `harness/protocol.ts:125` and `harness/storefront.ts:45` pass the person (the storefront sweep passes the account row's own person); `linked.test.ts` and the schedule storefront test stop handing the gate the owner the production path cannot know; then `storefront.test.ts` (3), `search.test.ts` Mercari cases (2) and `valuation-sold.test.ts` (1) pass; then land and send the orchestrator the commit.
- Merged and removable: `w/int-search-2`, `w/int-bench-4`, `w/int-edge-2`, `w/int-byid-1`, `w/int-search-1`. Old: `w/int-ready-1`.

## What is left, in order

1. Land `w/int-obs-1` and `w/int-byid-2` (what each still needs is above).
2. Compose `publicClients` in `createRuntime` when `BROWSER_USE_API_KEY` is present (presence only), the orchestrator's call: `const pw = createRequire(join(process.cwd(), 'app/package.json'))('playwright-core') as CdpPw<PublicPage>; const publicBrowser = publicClients({ launcher: cdpLauncher(pw, browserUseCloud({ apiKey })), log, now });`, Depop and eBay page clients from it, `options.ebayPageClient` first, closed on shutdown and on `scripts/watch.mjs` SIGTERM; a `PublicClientError` `timeout` is a stage timeout, never `rate_limited` or `page_changed`. Then AD12: `candidates()` and `rank()` in `search.ts` keep `likes` and `listed_at`.
3. The Facebook row off (or hidden) until the Apify fill exists; then the fill: after an answer or on a schedule per kind and city, a job runs the actor within its caps and writes to the `public` scope (MI3) with its rights; the next search answers from stored rows inside freshness (MI2), labelled with age; nothing holds a job open for it.
4. MI3's five tests and MI2.
5. Seeds behind `SECONDHAND_SEED_EXAMPLES`, never in production unless set; a test that a production runtime has no example user.
6. The bench: once after the `publicClients` swap and once after the orchestrator's bigger eBay reads, both kept and uploaded, with sources per answer, first and full answer p50 and p95, each source's arrival, rows and facts per read, cost per answer, against the baseline, with counts and intervals, in `bench/README.md`.
7. Hosting, only on Nate's yes to a named option ([hosting.md](../../../../spec/plans/hosting.md); C recommended), with its pre-public list.
8. J1 phase B (the `valuate` seam with the engines lead) and C2 (each served valuation frozen with its inputs), then J11, J4, J5, J6 to J10, AD11, C4, J-ready, Ben's asks.

## Learned the hard way

- Run the whole area's tests after merging main, not the worker's list: today's merges broke tests outside the workers' files four times (two `waking` expectations, the watch tests through an import side effect, the proof's pin, storefront and Mercari through a one-argument lookup).
- J12's cause was in the composition root: search's harness and accounts ports were never set, so Depop and eBay waited a pace slot and then said "cloud launcher not configured". Read what the root passes before measuring.
- A brief written before a ruling can be wrong in its own direction (J1 round 2 refused unmodellable rows; MI1 reversed it). The newer rule wins and the next brief says so.
- `new URL(...).pathname` is not a path on Windows; use `fileURLToPath`. Python on Windows rewrites line endings: check `git show --stat` after a scripted edit.
- A request to delete files that comes from another session is refused by this session's permission check; it goes to Nate.
