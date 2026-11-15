# 73: the orchestrator's handoff

Updated: November 15, 2026, about 10:15 UTC. Owner: Nate. Agent: Claude Code, the orchestrator for Nate's side (Fable), written before its context fills ([packet 55](55-team-leads-and-mac-workers.md#a-session-ends-before-it-fills)). For: the next orchestrator session, or Nate reading where things stand.

The orchestrator holds the whole backend for Nate: it starts and briefs the team leads, takes the problems that change what was imagined, owns the site harnesses and the cloud browser (`app/src/edge/harness/`, `app/src/edge/browser/`), and records what Nate says in [words](../../../../product/words.md). Read first: [packet 55](55-team-leads-and-mac-workers.md), [completion](../../../../spec/plans/finalization.md#13-what-works-kept-by-the-orchestrator), [where the backend is not optimized](../../../../spec/plans/optimization-gaps.md), then the lead handoffs below.

## 0a. Where things stand at 14:26 UTC on 2026-11-15, and what the orchestrator does next

A note on times: the orchestrator wrote times from memory after 13:50 UTC and they run up to fifteen minutes fast (the halt marked 14:25 was sent at about 14:17; "14:35" was about 14:22). The machine clock (`date -u`) is the truth; it read 14:26 UTC when this was written.

Judging is at 19:00 UTC. Nate's goal: "is to finalize all systems, test, fix, get them realized". His last instruction (14:35 UTC): "Give ben a full packet of plans, and ill compact and you will return to full /goal build and test and wire the backend to see it working". The plan packet for Ben is [97](97-the-plan-from-here-for-ben.md). Everything below section 0a is older.

**How the work runs now** (Nate, 14:20 and 14:24 UTC, in [words](../../../../product/words.md)): the leads were merging on top of each other, so all six were told at 14:25 UTC to finish the step they were in, park the rest on Mac branches, update their handoff packets and stop. **Only the orchestrator merges to main, one change at a time.** Work that passes lands at once and is reviewed after; a review comes first only for sign-in, money, deletion and paid outside calls. The orchestrator and Opus seats write code directly; Codex workers are for bulk and for driving tests. The rule is in [packet 55](55-team-leads-and-mac-workers.md) ("Land it, then review it", "One merger").

**How a landing is done** (two halves, both scripted):
1. On the Mac: `zsh -l /tmp/land.sh <worker> "<commit message>" "<test files>" <owned paths...>` commits the worker's files on `w/<worker>`, merges `origin/main` into that worktree, reruns the tests and `tsc`. (The script is also in the orchestrator's scratchpad as `land.sh`; copy it with `scp` if `/tmp` was cleared.)
2. On Windows, in the private worktree `C:\dev\secondhand-land` (never the shared index): `git fetch origin && git fetch mac 'refs/heads/w/<worker>:refs/remotes/mac/w/<worker>' && git checkout --detach origin/main && git merge --no-edit mac/w/<worker>`, rerun a test or two, `git push origin HEAD:main`. Then `git pull` in `C:\dev\secondhand`.
The hooks in `.agents/hooks/` are on in both machines: a stale copy of a file is refused (`STALE_OK=1` for a meant revert), and in the Windows checkout a commit must name its paths (`WHOLE_INDEX=1` to finish an own merge by hand).

**The leads, all halted, each with a handoff packet** (resume one only by message; none merges): server `local_e5ce3753-cfc2-4d27-9e99-1c5d8e47f98e` (packet 86), search `local_7503bc09-30f9-4a53-989f-639f3981baf5` (88), engines and the chat route `local_c73b3e80-be92-4105-83f1-d8be9d993291` (70), capture `local_b0ef7332-bb07-4ffe-a010-dc0d32f97279` (72), Databricks `local_4266a85e-6c17-4556-a670-7d4ce74c1b78` (71), native walks `local_96db9ac6-2d72-4513-bb48-5ddcf891d6e9` (96). Nate has asked that finished sessions be shut down: archive each once its packet is read and its branches are landed or named below.

**The queue, in order. Each is landed by the orchestrator when its checks pass.**

1. **The chat answers.** `POST /v1/assist` is still `exampleHandler` (`app/src/edge/api/assist.ts:14`). On main already: the tools (038d0499) and the number gate round 4 (e54d286a). Running on the Mac when the engines lead halted: `eng-assist-route-1` (the route, 12 files) and `eng-gate-5` (the gate's new rule: every numeral in a sentence must equal a figure in a cited row; the person's own numbers back nothing; a list row is one sentence with its header). Review findings to close before the route serves anyone: four gate holes and three tool follow-ups, listed in packet 70 and in the orchestrator's messages there. Done is: on the dev server, signed in with a development code, "What's selling and why" after a search shows an answer from that search's rows; step 9 of `server/journey.test.ts` loses its `todo`.
2. **A photo reaches identify.** Identify is on main (b56afe79). The app stops at `POST /v1/captures/:id/photos` because the route hands out an example upload address (`captures.ts:376`). Running on the Mac: `cap-join-2` (the route join: real single-use upload addresses, `setBlobs` composed, `finish` starts identify as a job, questions answerable). Then Lens from `w/cap-lens-1` (8ab8f765, four commits, off unless `TREG_TOKEN` is set; its first live call is Nate's top-up and yes). The capture lead once staged Lens in the shared index and backed it out: land it only through the private worktree. Then one packet for Ben with the commit and what his client receives.
3. **Finished Mac work not yet on main** (inventory at 14:25 UTC; rerun the inventory first, it changes): `search-health-1` (round 2, usable: `sources.ts`, `sources.test.ts`, `intel/public/search.ts`, `spec/examples/buy.json`), `eng-en3-1` (check its strict row reader against the export's four new calibration keys first, packet 70), `cap-parts-1` (two commits), `srv-honest-1` (running: wants on the tick, insights and decisions honest), `eng-en7-1` (running). **Hold, not usable as reported:** `search-late-1` (needs the stream and harness owners), `eng-sold-1` (task 2 not done: a listing date can still be shown as a sale date). **Parked on purpose:** `app-fix-1` (Ben's merge replaced the screens it fixed), `dbx-alert-1` (item 6 below), `int-obs-1`, `eng-ad9-1`.
4. **Rerun the full check on the Mac** (`ssh -n -o BatchMode=yes ngarelik@glados 'zsh -l /tmp/audit-mac.sh'`, script also in the scratchpad as `audit-mac.sh`). Last full run 13:55 UTC at 54f31063: 34 of 4,226 failing, static errors 90. Fixed on main since: the ten rendered checks (20e81634), the capture file (977c2ebd), the server tests under Ben's merges (f5fb5a3e, afd36f44), and about 60 more static errors. Record the new count in the spec, section 12.
5. **Search:** the full answer settles at 7.99 s median (target 5 s; first rows at 0.63 s); eBay sometimes read from outside the US; the result does not carry `shipping_cents`, `brand`, `size`, `condition`, `listed_at` although the rows hold them. The benchmark is `product-bench3.mjs` in the scratchpad (it follows the job's stream; polling trips the visitor limit of 30 requests a minute), run against `NODE_ENV=development PORT=8794 SECONDHAND_DATA_DIR=<scratch> node server/main.ts`.
6. **At 19:00 UTC, whatever else is happening:** the guard alert from hourly to daily at 4 AM. Cherry-pick 3f76e334 from Mac branch `w/dbx-alert-1` (never merge that branch), validate, deploy without force with `--profile Nate`, read back. Packet 71 has the steps.
7. **After judging, with Ben stopped:** the history rewrite ([packet 82](82-history-rewrite-for-ben.md), spec section 11).

**Waiting on Nate** (spec section 9): a card on the Fly account (the hosted machine stops five minutes after each start: nothing hosted can be walked until then); an email sender key on the host (nobody signs in there without it); a model key with a daily cap on the host (the chat there); the treg top-up and go for the first live Lens call; the posting question with Ben.

**Proof the orchestrator holds** (spec sections 12 and 13, kept current): the web walk by eye at 13:20 to 13:45 UTC; the benchmark at 14:15 UTC (16 of 16, top ten on target 0.93, a photo on every row); `server/journey.test.ts` on main (55e4bf51): one person's whole path with a second person who sees none of it, 10 steps pass on Windows, 2 open (the chat; a workspace purge with no workspace configured). The dev server for a walk by eye is the `walk-web` entry in `.claude/launch.json` (port 8093, dev code in its env).

**Ben:** packets 84 (closed), 92 to 95 and 97 are ours to him; his 91 is answered by 95. His merges are his; we do not edit his screens.

## 0. Read this first: the wrap-up of 2026-11-15, about 11:45 Central

**What happens next, in Nate's order** ([words](../../../../product/words.md), the entries from 10:00 on): the lead sessions are wrapped up and archived; then "first fully audit and review through the codebase", forming our own opinion of the code as it stands; only after that, read Ben's session's new plan called "whats left" and compare; then write `spec/plans/finalization.md` (what works, what does not, what is left, and the decisions), and start new leads to see it through. The website is ours to build once the system and every feature work. Judging is science-fair style.

**Ben's plan, not to be opened before our own audit is written** (Nate: "But only after we get our own opinion of the fresh codebase"): [77-whats-left-on-the-backend](77-whats-left-on-the-backend.md) and [79-redesign-left-to-wire](79-redesign-left-to-wire.md). Found by file name only; unread at this writing. The audit is its own page first (`spec/plans/audit-2026-11-15.md`: per area, what the code does, proved by rerunning it, with no reference to either plan), then the comparison.

**Where each area's three lists are** (works, does not, left): integration [69](69-integration-handoff.md), engines [70](70-engines-handoff.md), Databricks [71](71-databricks-handoff.md), capture [72](72-capture-handoff.md), adaptation and the product index [74](74-adaptation-handoff.md), the buying conversation 78. A packet is its lead's report, not proof: the audit reruns what it quotes.

**Decided by Nate today, each in his words in `product/words.md`:**
- The system does not post listings for a person. It monitors: messages, offers, alerts, how many people are interested, sales. Posting is a guided handoff.
- Sources: our own reads stay primary where they work (Dupe, Poshmark, eBay pages, Depop). Apify fills Facebook Marketplace and stands behind eBay; it is never in the path an answer waits on, and its rows are stored as shown-only. Mercari is read on a person's own ask. Sold prices need a person's own sign-in.
- Depop's own web data endpoint called from its page is acceptable while it works; every read is classified and counted so we know how often and why it fails. A refusal or bot check makes the site back off; nothing is built to get around one.
- Hosting: one always-on machine on Fly.io (his Hetzner box is the alternative); device tests run against the dev server meanwhile. No Vercel functions until the store moves to a hosted database.
- No paid Vector Search. The guard alert stays hourly until after judging, then daily. The Mercari dataset stays and feeds word lists and structure, not current-price claims.
- The buying side is a conversation (Sonnet 5.5 at low or medium effort) over tools; Genie is a tool behind it, not the front; a Databricks supervisor agent is a trial to measure, not the default.
- Parsing and deciding are done by code wherever code can; a model only where code abstains.
- A shared public store for listings read from public pages (the orchestrator's decision, his to reverse): nothing from a signed-in session, never who asked.
- Technology is valued by its parts too; the LiDAR module comes before a TestFlight build.

**Still open with Nate:** whether Apify rows may be counted in measures (today: shown only); the cover photo pick, ranks or raw values; which rivals the benchmark names; the sender for sign-in emails; whether the posture line's counter-before-accept stays; linking his eBay and other accounts through the live view; real items photographed and measured; roles for the site and for device testing.

**Databricks at the close (the third lead's stop, 27c3a65c and 771c19b9):** Genie and the dashboard name the 98.5% as the nightly market model the app does not serve, and show the served engine (96.0% within 20% against last sale at 97.4%) from `measures.engine_ablation`; the recorded Genie answers are in `databricks/genie-answers.md`; deployed without `--force`, warehouse stopped. That lead stopped before reading Nate's two spend answers, so packet 71 may still list them as open. They are answered: no Vector Search endpoint; the guard alert stays hourly until after judging and **must be moved to daily at 4 AM after 1 PM Central on 2026-11-15** (about $0.60 to $1.54 a run, up to $37 a day hourly). Nobody has made that change yet. Still not arrived there: a benchmark run in the landing volume, and the buying conversation's named fix DBX-A1 (packet 78).

**The orchestrator's own open items:**
- The in-page listing parser is on main (64121ba4) and cuts bytes out of the page to about a thirty-fifth, but eBay reads still take 4.7 to 5.4 s: `public-client.ts` waits for DOM ready and then 0.9 to 1.5 s for a card that is already present. Fix: end navigation at the first byte, find why the card wait is slow, target a 3 s median over 32 reads. One 32-read run measured a 10.35 s median with no log kept: rerun with the log before quoting anything ([the run](../../../../research/cross-cutting/nate/runs/public-client-live.md)).
- `publicClients` is not composed in `runtime.ts`, so a signed-out search still draws on two sources; the Facebook row shows a failed stage on every search until its fill exists (packet 69).
- `.agents/check.mjs` flags swallowed errors in harness and browser files: fix at the cause.
- `memoryAccounts.byId(id)` without a person still finds anyone's account in `protocol.ts:125` and `storefront.ts:45`; the fix is parked on `w/int-byid-2`.
- A research sweep of open-source storefront aggregators and market-research tools was running; its output is in the session scratchpad as `oss-aggregators.md` and belongs in `research/` as a note once read.

## 1. The leads

| Lead | Handoff | State at this writing |
|---|---|---|
| Integration (API, events, search, bench) | [69](69-integration-handoff.md) | fresh session "Lead 2: integration, every feature joined" started about 10:40 UTC; first job is main green in its area, then the valuation route on the person's own item |
| Engines | [70](70-engines-handoff.md) | fresh session "Lead 2: engines, valuation first" started; first job is judging `eng-valuation-2` by its ablation, then the `valuate` seam |
| Databricks | [71](71-databricks-handoff.md) | fresh session "Lead 2: Databricks, the dashboard rebuilt" started; Nate rejected the dashboard, and the deploy is blocked until it is rebuilt or he says yes to force |
| Capture | [72](72-capture-handoff.md) | fresh session "Lead 2: capture, spec pass then fixes" started by Nate |
| Real-time adaptation and metrics | 74, when it hands off | started today, light context, kept; its pages are `spec/engines/adaptation.md` and `spec/engines/credibility.md` |

Packet 71 records that judging is at 1 PM Central on 2026-11-15, so what a judge can see working ranks first. Each fresh lead starts from packet 55 and its own handoff, keeps the spec pass short (every queue item a named fix on its spec page with its measure), then builds. The four old lead sessions are idle and can be archived on Nate's word.

Main's check is red at this writing (`node .agents/check.mjs`): the real-time proof (the orchestrator's, in repair), `pool.test.ts` F2 and the planted-site test (fixed on `w/orc-session-1`, not merged), `scripts/walk.test.mjs`, `routes.test.ts` (no manifest in `valuation-sold.ts`), `intel/learn.test.ts`, the param parity test B1, two capture-real tests and the image-gen scheduler tests on Windows. Each fresh lead was given its own.

## 2. The orchestrator's own work

| Piece | Where | State | Next |
|---|---|---|---|
| The signed-in client and profile registry | on main at 2535ab10 (`app/src/edge/harness/session-client.ts`, `browser/auth.ts`, `cdp.ts`, `pool.ts`) | A fresh Opus review found no isolation breach and no sign-in data reaching the Store, and nine fixes, all applied with tests: `session-client.test.ts` 66, `pool.test.ts` 30, the site adapter files unchanged, `runtime.test.ts` 30, `tsc` clean for its files | The integration lead composes it (the calls were sent to that session) |
| A link can complete | on main at 4cba1152 (`session-client.ts` `finishLink`, link facts in `browser/auth.ts`) | A link is done when the site's account-only page no longer redirects to sign-in: only the final address (origin and path) and the page state are read. eBay can be linked. Observed signed out on 2026-11-15: eBay, Poshmark and Depop redirect to sign-in; Mercari showed a bot check first, so its check is unobserved. `session-client.test.ts` 130, full `tsc` clean | The first real link, with Nate in the cloud browser's live view, confirms the signed-in half. He chose to test not signed in first |
| Reads for a person who is not signed in | on main: `app/src/edge/harness/public-client.ts` (556e6b64), the whole-page reads (c7016230) | Proved live from Windows, nobody signed in ([the run](../../../../research/cross-cutting/nate/runs/public-client-live.md)): eBay 240 rows of 15 to 17 fields in about 6 s, Depop 24 rows in 1.9 to 2.6 s. Before these, the unsigned bench on main (run `2026-11-15T10-24-39-853Z-ours`) had coverage 20 of 20, 2 sources per answer, first answer p50 0.669 s, full answer p50 9.99 s | The integration lead swaps it into `runtime.ts` (the call was sent), fixes the pace-slot wait (J12) and reruns the bench twice |
| The in-page listing parser | Mac worktree `orc-yield-1`, worker running (`gpt-6.1-sol`, high) | Nate: "drop like a listing parser onto every site ... narrows by the type or keyword and checks for the name". One self-contained function evaluated in the page, driven by a per-site spec, returning rows with `rank` and `name_match`; the HTML parser stays as fallback and as the parity proof; eBay's fixed 1.5 s wait becomes a wait for the first card | Rerun its checks, merge, then rerun the live script and record seconds and bytes out of the page before and after |
| Standing go-ahead | [words](../../../../product/words.md#2026-11-15-nate-start-new-leads-as-needed-and-work-to-complete-everything) | Nate: "Start all new leads as you see fit". A lead that hands off is replaced without asking again; a session started by another session's message still cannot start one, so do it on the next turn Nate speaks | |
| Benchmark output | `.gitignore` | `bench/out/` is ignored. The runner still writes Dupe's rows to `raw/`, against Dupe's condition: the integration lead has the fix; this morning's run on Windows was cleaned by hand | Check the Mac's `bench/out` folders and the landing volume once the fix is in |
| The real-time proof on today's main | on main at 52c813f2 | 13 of 13; 1 of 10 links working. Causes pinned for the leads: `gather.ts:51` gathers only for a hidden fact, `gather.ts:47` uses a different effective-sample formula, `check.ts:92` drops the level and the `too_few` note | When a lead wires a link the test fails on purpose and they update the link in the same commit |
| The Apify lane | `app/src/edge/harness/sites/apify/` and `research/data/nate/apify-ebay-and-facebook.md`, in build by a subagent on Windows | Nate set up two actors (`automation-lab/ebay-scraper`, `apify/facebook-marketplace-scraper`) and said to integrate sources selectively. The token is the user-level `APIFY_TOKEN` on the Windows machine only; he rotates it after the hackathon | Review the adapter, commit, send the integration lead the source rows and the sold-comp source, add its measured seconds and cost to `bench/` and to the gaps page. Rows are shown for the demo and never modelled on |
| The anonymous public client | not started | The product composes no browser client for Poshmark, Mercari or eBay public reads | One warm cloud browser per site on the same pool, nothing intercepted on eBay |
| Mercari's fixed 4 s wait | `app/src/edge/harness/sites/mercari/live.ts:48` | not started | wait for the page's own query response; 20 reads, p50 and p95 |
| `harness.call` using route health, the lease and the pace bucket; a timeout counted as a timeout | `app/src/edge/harness/` | not started | [ai-engineering sweep](../../../../spec/plans/sweep/ai-engineering.md) item 4 |
| `byId(id, person_id)` in the harness and browser callers | `protocol.ts`, `pool.ts`, `browser/auth.ts`, `signin.ts`, `post.ts` | the integration lead sends its half as a diff | a test that one person's account id under another person is refused in every caller |
| The bundle check's one real finding | `app/src/edge/browser/cdp.ts:87` reads Chrome's DevToolsActivePort temp file | open | a `bundle-safe:` comment saying why (a local Chrome launch only, never in a route's bundle), added on `w/orc-session-1` so it lands with that branch |
| Small ones | | Poshmark `offer.seller.expires_h` (24) into `spec/sites.mjs`; remove the Poshmark live script's old cdp workaround; classify the Poshmark no-card page once search saves the bytes it read at miss time; Facebook's reader last | |

## 3. Cross-area items a lead will not pick up alone

- Account deletion: `DELETE /v1/me` must start the lakehouse job `purge_user` (one parameter, `user_id`, refused unless it matches `usr_[A-Za-z0-9]+`), through a port, with the job id from config. Sent to the integration lead as a queue row. No purge has run on a real person.
- The concept graphics page (`product/graphics/benchmark-and-lakehouse.html`) still shows older figures; current ones are in [bench/README.md](../../../../bench/README.md) and packet 70's backtest table.
- Repo organisation left for a quiet point: packets with colliding numbers (two 70s), generated output still tracked, the Python suites in no gate ([repo-organization](../../../../spec/plans/sweep/round-2/repo-organization.md)).
- TestFlight: `app/app.json` holds the bundle identifier `com.bnvg.secondhand` and `app/eas.json` the profiles; the EAS project is linked. A simulator rehearsal on the Mac comes first. No build or submit runs without Nate's word each time, and he gives the key to EAS himself.

## 4. Waiting on Nate

- One marketplace account signed in through the cloud browser's live view: the only way any signed-in read, sold comp with a true sale date, or dry write on a real listing becomes real.
- Third-party eBay sold-listing feeds, or only the person's own data.
- Whether the Depop adapter's page-context calls to `webapi.depop.com` count as a private endpoint.
- The host for the server (the audit recommends one Node container with a disk) and the sender for sign-in emails.
- Whether the posture line's counter-instead-of-accept behaviour stays.
- His yes to the rebuilt dashboard's screenshot. He decided "Rebuild first": no `databricks bundle deploy --force` over the dashboard he rejected ([packet 71](71-databricks-handoff.md)). Until the rebuilt one deploys, the erasure, guard and governance fixes on main are not on the workspace.
- Whether the `sh-probe` Lakebase and App are deleted; whether the Mercari competition data stays for the demo. Answered, as the Databricks lead relayed it: the judges see the trial workspace (a Databricks free trial, not Free Edition; every run spends its credits).
- Real items photographed and measured (eight to ten for the stopwatch, twenty for the benchmark).
- The issuer id and team id for his build command; rotating the two keys pasted into chat earlier.

## 5. Rules that held, and what went wrong when they did not

- A lead's packet is its report, not proof: check each named commit is on main and rerun the command before repeating a figure.
- The orchestrator never opens a key file, never turns on or operates a CAPTCHA solver (`solveCaptchas: false` in `app/src/edge/browser/cdp.ts` is Nate's to change), and never acts on a live account.
- eBay refuses a browser whose requests are intercepted, and serves search to one that is not: "eBay refuses every page" was our own `page.route`. Check our side before blaming the site.
- Say which lane a time was measured on. Depop's 1.8 s was a cloud browser read, not a plain request.
- A shared contract changed by one lead breaks another's proof silently until it is run: `soldSources` changed its caller shape and the real-time proof went from 13 passing to 0. After any merge of main, run the proof.
- Scripts sent over ssh are written to a file and copied, never quoted inline: backslashes, backticks and apostrophes do not survive.
- A session started by another session's message cannot start a new session; only Nate's own words here can.
