# 73: the orchestrator's handoff

Updated: November 15, 2026, about 10:15 UTC. Owner: Nate. Agent: Claude Code, the orchestrator for Nate's side (Fable), written before its context fills ([packet 55](55-team-leads-and-mac-workers.md#a-session-ends-before-it-fills)). For: the next orchestrator session, or Nate reading where things stand.

The orchestrator holds the whole backend for Nate: it starts and briefs the team leads, takes the problems that change what was imagined, owns the site harnesses and the cloud browser (`app/src/edge/harness/`, `app/src/edge/browser/`), and records what Nate says in [words](../../../../product/words.md). Read first: [packet 55](55-team-leads-and-mac-workers.md), [completion](../../../../spec/plans/completion.md), [where the backend is not optimized](../../../../spec/plans/optimization-gaps.md), then the lead handoffs below.

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
