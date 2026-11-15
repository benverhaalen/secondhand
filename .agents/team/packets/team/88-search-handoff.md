# 88: the search lead's handoff

Updated: November 15, 2026, about 14:05 UTC. Owner: Nate. Agent: Claude Code, the second search lead (Opus), written at about two thirds of its context ([packet 55](55-team-leads-and-mac-workers.md#a-session-ends-before-it-fills)). For: the next search lead. Read with [finalization §3](../../../../spec/plans/finalization.md#3-search-and-the-sources-lead-search) (each row's state column is current) and the three run pages of today: [every source live](../../../../research/cross-cutting/nate/runs/every-source-live-2026-11-15.md), [harness coverage by job](../../../../research/cross-cutting/nate/runs/harness-coverage-2026-11-15.md), [search backend validation](../../../../research/cross-cutting/nate/runs/search-backend-validation-2026-11-15.md).

Nate, 13:40 UTC: "ben will handle sign in proof, we are focusing on validating the full backend, chekcing and ensuring everything works" ([words](../../../../product/words.md#2026-11-15-nate-ben-handles-the-sign-in-proof-we-validate-the-full-backend)). So nothing signed in is ours to prove now. Validate and fix the signed-out search backend.

## 1. What is true on main

| What | Commit | Proof, rerun by the lead (who wrote none of it) |
|---|---|---|
| SR1 to SR10 as in finalization §3 | see the rows | unchanged from the first lead's handoff |
| Round 3 (SR11): `sources` filter, `group` on every source, stage and searched entry, Dupe `read_directly` (fixture identity only), `fill_until` on a Facebook fill, `reads` always in health | merge a32b6bc1 | search 89/89, latency 4/4, sources 9/9 on Windows after the merge |
| `search-harness-2`: the abort reaches the browser read (as the 4th argument of `harness.call`), eBay parses the cards already in the page | merged in a32b6bc1 | harness suites all pass; live, no `zero_cards` fallback in 6 reads, eBay reads 1.5 to 3.1 s |
| Mercari linked-search test (the orchestrator's 4th failing test): `linked.ts` called `byId` without the person | 4a0f7370 | linked 2/2. The server lead was told |
| A source with no route answers `no_route` before any account check (Mercari signed out now says `no_route`, not "needs your account": linking would not help while no route exists) | 4a0f7370 | the app-walks lead was told |
| SR12 Google Shopping through treg: source `google_shopping`, lane `treg`, composed only when `TREG_TOKEN` is set; every call logged with `cost_usd` from `x-treg-cost-micro`; cap `search_shopping_usd_per_day` 1.00, in memory (resets on restart); rows `may_store: false`, `may_model: false`, credit "Google Shopping"; an "eBay - seller" row is `source_site: 'ebay'` | merge eb201bac | adapter 10/10, search 98/98, compose 11/11; live through the server at 13:56 UTC: 32, 40 and 37 rows, 1.2 to 2.3 s, $0.002 a call logged. The engines lead has the row shape |
| SR13 the device lane: terms, robots rules, pace and refusals | 42fc28ff | done as research ([note, SR13 section](../../../../research/cross-cutting/nate/reading-on-the-persons-device.md#sr13-terms-robots-pace-and-refusals-for-the-device-lane)). Agent proposal: not a way to gain pace or get past refusals |
| Nate's harness table (search, pricing rows, monitor, manage, analytics per site) | dd091716 | signed out, search and pricing rows are live on five sites; every monitor, manage and analytics verb is built and fixture-tested on four marketplaces and waits on a linked account (Ben's now); every write runs dry |

## 2. Open workers on the Mac (both started about 14:00 UTC from origin/main at ac7c90a4)

- **`search-late-1`** (`gpt-6.1-sol`, high; brief `search-late-1.txt` in the shared notes folder). eBay `lands_late`: at the settle deadline eBay is not aborted. It keeps its pace slot for `search_late_window_ms` (prior 30 s), arrives as `answer.late`, the job's result keeps its rows, and `fill_until` is set to the later of eBay's cutoff and a Facebook fill's. Why: the benchmark at 13:42 and 13:48 UTC had eBay time out in 14 and 12 of 20 searches, full p50 10.0 s, though each read that ran took 1.5 s. The queue is eBay's shared 10 s gap, and `api/search.ts` aborts every pending read at the settle. Owned: `api/search.ts`, its two tests, one field and one param in `intel/public/sources.ts`.
- **`search-health-1`** (`gpt-6.1-sol`, medium; brief `search-health-1.txt`). `GET /v1/sources/health` answers every signed-in person from live state: one row per source with `composed`, `success`, `paused_until`, `checked_at`, plus `reads` as now. Today it answers 404 for anyone but the example user, because it goes through `exampleHandler`. Owned: `api/sources.ts`, its test, the `sources.health` example in `spec/examples/buy.json`, one export `sourceComposed` in `intel/public/search.ts`. Round 1 came back at 14:10 UTC: 11 of 12 passed. `checked_at` had no source (the read ledger keeps no last-read time), and `success` was always the router's 0.9 prior (nothing in production feeds that router). **Round 2 is running** (`AGAIN=1`, brief `/tmp/brief-search-health-2.txt` on the Mac): it drops both fields and their tests, so a row is `{ source_id, route_id, site, group, lane, composed, paused_until }`. A shown health number must come from evidence. Its worktree is still uncommitted.

To land each: read `WORKER_REPORT.md` and the diff against its brief. Commit the owned paths in the worktree, then `git fetch origin && git merge origin/main` there and resolve any conflict on the Mac. Rerun its done checks plus `node scripts/search-errors-check.mjs` (must print `[]`) and `tsc`. Then on Windows: `git fetch mac 'refs/heads/w/<name>:refs/remotes/mac/w/<name>'`, `git merge mac/w/<name>`, rerun the main test file, update the finalization row and push. The two touch different files. A patch written to the Mac through a heredoc once put a backspace character in place of a regex `\b` (found with `od -c`): write patch scripts with `String.fromCharCode` or check them with `od`.

## 3. The queue, in order

1. Land the two workers (section 2). Then rerun the benchmark twice (`.claude/launch.json` entry `search-live`, port 8094, carries a development sign-in code, then `node bench/run.mjs --base http://localhost:8094` and `node bench/score.mjs <dir>`). The bar: eBay present in every search, as live or late. Then rerun the route check (the script is described in the validation page, section 2; health must answer 200). Delete `bench/out/<run>/raw/` and the scratch data folder afterwards.
2. **Mercari route.** `harness/compose.ts` routes only Depop and eBay, so Mercari answers `no_route`, although its adapter read 100 rows live signed out ([ad-mercari](../../../../research/cross-cutting/nate/runs/ad-mercari.md)). Compose a public Mercari client like Depop's (headed, at its 20 a minute, 3 s pace, backing off on a challenge). Mercari's robots.txt does not disallow `/search/`.
3. **Dupe's copies of listings read directly** (Nate: dropped, new ones kept). Dupe gives only `dupe.com/redirect/...` links, and its robots file disallows `/redirect`, so do not resolve them. Match on site, price and normalized title together: Dupe's `source_site` against our read's site, equal `price_cents`, and equal normalized title. Count matches as `read_directly`. Brief it with the false-match tests named (same price, different item; same title, different price).
4. **The app's two asks**: every searched entry's `url` is the site's own results page (`searchUrl(site, query, 'search')`), and the phone keeps a shortcut copy until then. Depop titles and photos are on main (4a3734ee), and the parent session fixed the dropped `image_url` itself.
5. **Google Shopping rows are not judged** (`may_model: false` skips the same-product filter), so all 37 "west elm sofa" rows show, while Poshmark kept 1 of 48. Whether to judge Shopping rows for display only is Nate's call; ask him.
6. Move the Shopping cap to the kv port when the server lead composes `apifyRuns` there (the shortcut comment in `harness/compose.ts`).
7. The eBay in-page parse measured at 32 reads alone, then beside the other lanes (SR7's "Next").

## 4. Decisions made, one line each

- No route answers before the account check: linking cannot help a source this server cannot read (4a0f7370).
- Google Shopping is visitor-usable (a public read). One call is shared by concurrent askers only, never cached across searches (`may_store: false`). Its cost is the header's, its cap in memory.
- eBay lands last and late rather than being cut at the settle (brief `search-late-1`; Nate's ruling that eBay is read in every buy search).
- The health route is the same for every person and holds nothing personal.
- The device lane is research only; on terms it is the same act as the server's read (SR13).

Waiting on Nate: whether Google Shopping rows are judged for display; whether eBay's and Poshmark's robots rules (both disallow their search paths) change which signed-out reads we make (he ruled "lets do our page read" for eBay).

## 5. What I got wrong

- My first edit to `sourceUnavailable` put the account check back ahead of the route check. That was wrong once no Mercari route exists, and the worker's order was right. Read the worker's reason before reversing it.
- My first route probe polled a job every 250 ms and used up the visitor's request bucket (`rate_limited`). Poll once a second, and use a new visitor per search.
- A server started by `preview_start` does not see Windows user-level variables (`TREG_TOKEN`). For a live Shopping run, start a second server from PowerShell with the variable read by presence (validation page, section 3), and stop it after. Its runtime log goes to stdout, not stderr.
