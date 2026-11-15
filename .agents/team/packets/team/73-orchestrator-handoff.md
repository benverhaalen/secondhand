# 73: the orchestrator's handoff

Updated: November 15, 2026, about 10:15 UTC. Owner: Nate. Agent: Claude Code, the orchestrator for Nate's side (Fable), written before its context fills ([packet 55](55-team-leads-and-mac-workers.md#a-session-ends-before-it-fills)). For: the next orchestrator session, or Nate reading where things stand.

The orchestrator holds the whole backend for Nate: it starts and briefs the team leads, takes the problems that change what was imagined, owns the site harnesses and the cloud browser (`app/src/edge/harness/`, `app/src/edge/browser/`), and records what Nate says in [words](../../../../product/words.md). Read first: [packet 55](55-team-leads-and-mac-workers.md), [completion](../../../../spec/plans/completion.md), [where the backend is not optimized](../../../../spec/plans/optimization-gaps.md), then the lead handoffs below.

## 1. The leads

| Lead | Handoff | State at this writing |
|---|---|---|
| Integration (API, events, search, bench) | [69](69-integration-handoff.md) | old session finishing its packet; six placeholders in it were still unfilled |
| Engines | [70](70-engines-handoff.md) | packet complete; two workers still running (`eng-valuation-1` round three, `eng-valuation-2`) |
| Databricks | 71, not yet written | finishing four safety pieces (`dbx-gov-2`, `dbx-erase-1`, `dbx-bench-1`, `dbx-learn-1`), then its packet |
| Capture | [72](72-capture-handoff.md) | old session ended; a fresh one is proposed, not started |
| Real-time adaptation and metrics | 74, when it hands off | started today; its page will be `spec/engines/adaptation.md` |

Each fresh lead starts from packet 55 and its own handoff, does the spec pass first (every queue item a named fix on its spec page with its measure), then builds. A fresh session is started only on Nate's word in the orchestrator's own conversation.

## 2. The orchestrator's own work

| Piece | Where | State | Next |
|---|---|---|---|
| The signed-in client and profile registry | Mac worktree `orc-session-1`, branch `w/orc-session-1`, commit 4c7e00a3, merged with main at 86766d20 | Tests pass after merging main: `session-client.test.ts` 25, `pool.test.ts` 29, `cleanup.test.ts` 1, the four site adapter files unchanged, `runtime.test.ts` 30; `tsc` clean for `edge/harness` and `edge/browser`. A fresh Opus review of the diff was running | Apply the review's findings, merge to main, then send the integration lead the composition (the worker's report in the worktree has the exact calls; the Store table is `account`) |
| Known gaps in that piece | same | eBay has no link route (`startLink('ebay')` answers `no_route`: its page client has no account check and `PROFILES.ebay.login` is null); account rows with no `profile_id` are refused, not migrated | an eBay sign-in check on the page lane; a migration decision for old rows (integration's) |
| The real-time proof on today's main | Mac worktree `orc-realtime-1`, uncommitted | The sold source was fitted to `soldSources`' new contract (10 of 13 pass). The last three are tripwires: `valuation.ports.read` changed, and the direct gather probe now returns nothing. A worker (`gpt-6.1-sol`, high) was reading the cause | Read its `WORKER_REPORT.md`, rerun `node --test --test-concurrency=1 scripts/realtime-proof.test.mjs`, commit, merge, and update the ten-link table in completion if a link changed. Main's proof is red until this lands |
| The anonymous public client | not started | The product composes no browser client for Poshmark, Mercari or eBay public reads | One warm cloud browser per site on the same pool, nothing intercepted on eBay |
| Mercari's fixed 4 s wait | `app/src/edge/harness/sites/mercari/live.ts:48` | not started | wait for the page's own query response; 20 reads, p50 and p95 |
| `harness.call` using route health, the lease and the pace bucket; a timeout counted as a timeout | `app/src/edge/harness/` | not started | [ai-engineering sweep](../../../../spec/plans/sweep/ai-engineering.md) item 4 |
| `byId(id, person_id)` in the harness and browser callers | `protocol.ts`, `pool.ts`, `browser/auth.ts`, `signin.ts`, `post.ts` | the integration lead sends its half as a diff | a test that one person's account id under another person is refused in every caller |
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
- Which workspace the judges see; whether the `sh-probe` Lakebase and App are deleted; whether the Mercari competition data stays for the demo.
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
