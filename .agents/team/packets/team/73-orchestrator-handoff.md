# 73: the orchestrator's handoff

Updated: November 15, 2026, about 10:15 UTC. Owner: Nate. Agent: Claude Code, the orchestrator for Nate's side (Fable), written before its context fills ([packet 55](55-team-leads-and-mac-workers.md#a-session-ends-before-it-fills)). For: the next orchestrator session, or Nate reading where things stand.

The orchestrator holds the whole backend for Nate: it starts and briefs the team leads, takes the problems that change what was imagined, owns the site harnesses and the cloud browser (`app/src/edge/harness/`, `app/src/edge/browser/`), and records what Nate says in [words](../../../../product/words.md). Read first: [packet 55](55-team-leads-and-mac-workers.md), [completion](../../../../spec/plans/completion.md), [where the backend is not optimized](../../../../spec/plans/optimization-gaps.md), then the lead handoffs below.

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
| A link cannot complete yet | `session-client.ts` `finishLink` | No adapter's signed-in read returns evidence of whose account it is, so `finishLink` answers `no_route` with `handoff` on Poshmark, Mercari and Depop instead of guessing; eBay has no link route at all (`PROFILES.ebay.login` is null) | Add one positive account signal per site adapter. The signed-in fixtures are synthetic, so the signal is confirmed on the first real link with Nate present in the live view. This is what stands between Nate signing in and any signed-in read |
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
