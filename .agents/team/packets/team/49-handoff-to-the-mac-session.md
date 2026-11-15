# 49: handoff to the Mac session

Updated: November 14, 2026, about 23:15 Central. Owner: Nate. Agent: Claude Code, the build orchestrator that took over from [packet 45](45-handoff-to-the-build-session.md). Branch: `main`, everything pushed. Status: the kernel is built on browser-use browsers and proved on local Chrome and fakes; nothing has run on Browser Use Cloud yet. Everything here is an *agent proposal* unless it links Nate's words.

This is for the session that continues the build on Nate's Mac Studio (M4 Max, 64 GB) over SSH. Ben reads "What changed for Ben".

## Why the build moved

The Windows machine (31 GB) crashed three times. Each time, thirteen sessions with their own seats, Codex workers, language servers and test runs were writing one checkout at once. Nate, after the second and third ([words](../../../../product/words.md#2026-11-14-nate-store-auth-through-browser-use-build-fewer-things-at-once-focus-on-the-browser-harnesses)): "lets cut down how many we build in parallel, focus on just the browser harnesses".

## How to run it from here

| Rule | Why |
|---|---|
| One writer in a checkout. A second session gets its own git worktree, or waits | thirteen sessions in one checkout lost uncommitted edits in a merge twice and fought over `index.lock` |
| Commit the moment a piece passes, with explicit paths, then pull and push | a crash kept only what was committed |
| One milestone at a time, in the order on [the board](../../../../spec/plans/board.md#milestones-the-order-of-the-build-since-2300-central-2026-11-14); each ends with a recorded real run before the next starts | Nate: "establishes and finalizes milestones being hit" ([words](../../../../product/words.md#2026-11-14-nate-browser-use-on-cloud-tested-the-way-production-runs-with-milestones-that-are-finalised-as-they-are-hit)) |
| At most two seats and two cloud browsers at once until the Mac has shown what it holds; measure before widening | no crash has been diagnosed past "too many processes" |
| Run one test file at a time (`node --test --test-concurrency=1 <file>`); the full `node .agents/check.mjs` once, by the lead, before a push | every stream running the full check at once was part of the pile-up |
| A gap is pushed past, not written around: a 403 to a plain fetch means open the page in a real browser and record it | seats wrote synthetic fixtures for eBay, Facebook and Mercari and stopped ([words](../../../../product/words.md#2026-11-14-nate-store-auth-through-browser-use-build-fewer-things-at-once-focus-on-the-browser-harnesses)) |

## Set up the Mac

1. Clone `main`. `npm ci` in `app/`. Python 3.12 with `pytest`. Playwright's Chromium for the local browser tests.
2. Nate sets two keys in the Mac's environment himself; neither is ever written to a file, a brief or a log, and both are checked by presence only: `OPENROUTER_API_KEY` (jev, in `app/src/edge/intel/jev.ts`) and `BROWSER_USE_API_KEY` (cloud browsers). Both were pasted into a chat on the Windows machine, so Nate should rotate them after the event.
3. `databricks auth login --profile Nate` if the workspace is needed; the profile is Nate's own workspace ([checks](../../../../research/data/nate/workspace-checks.md)).
4. Read, in this order: this packet, [the board](../../../../spec/plans/board.md), [the Browser Use Cloud reference](../../../../research/cross-cutting/nate/browser-use-cloud.md), `app/src/edge/browser/OPERATING.md`, `app/src/edge/harness/OPERATING.md`, `app/src/edge/harness/ENDPOINTS.md`.

## What Nate settled since packet 45

Each is quoted in [words.md](../../../../product/words.md) under 2026-11-14.

| Settled | Where it is built or written |
|---|---|
| The browser layer is browser-use on Browser Use Cloud, with sign-in stored per linked account; this replaces "we host every browser ourselves" for the build and the demo | `app/src/edge/browser/cdp.ts`, `auth.ts`; the layer sits behind one `Launcher` port so own hosting or the phone's web view can replace it |
| Each harness is built from what recon learns of that site's own structure, not from one template, and is exposed as documented endpoints such as `/write-listing` | `app/src/edge/harness/platform.ts`, `endpoints.ts`, `ENDPOINTS.md` (generated; a test fails on drift) |
| The kernel covers platform specifics and each linked storefront's own analytics | `platform.ts`, `storefront.ts`, the `storefront_snapshot` row in [product.md](../../../../spec/product.md) |
| Per person, only what they linked runs | `linked.ts`; a planted unlinked account gets zero launches, sweeps and jobs |
| Harnesses are not held back by a site refusing a plain fetch | a refused fetch escalates to a browser session |
| The Databricks profile is `Nate` | [workspace checks](../../../../research/data/nate/workspace-checks.md): only open models on the gateway, no Lakebase project, no Apps, no secret scope; creating probe resources waits for Nate's go in the session that runs them |
| Searches combine public no-login fetches with signed-in actions | the three lanes below |

## The design the next session builds

**Three lanes, all started at once for a search.** (1) A plain server fetch, no browser, no login: `app/src/edge/intel/fetch.ts`, already a hedged waterfall. (2) An anonymous cloud browser with images, media and fonts blocked, only where lane 1 is refused or lacks a field. (3) The account's own cloud browser and profile, only for what the account adds and for every write. Inside lane 3, call the site's own JSON endpoints from within the open page (`page.evaluate(fetch)`) before driving the page, and use plain requests with the stored cookies where the site accepts them. The manifest's per-field `needs_session` decides whether lane 3 joins a search. Route order per site and verb is set from measured time to first row, time per lane, bytes and browser-seconds.

**Cost rules from the reference.** $0.06 per browser-hour, billed by the started minute, the whole timeout charged up front and refunded on stop; the managed proxy at $5 per GB is the larger cost. So: one browser per account lease, shared by all its verbs; `timeout` always passed and sized to the job; stop in a `finally`; a sweep that stops any browser we hold no lease for; our own cap of 10 concurrent (the account allows 50); block heavy resources on reads; record browser-seconds and bytes in every run trace. Nate's account has auto recharge on, so an unstopped browser charges his card.

**Depop and Mercari refuse a headless browser, not automation** (`research/cross-cutting/nate/runs/bp-1.md`, run 2): the same Chrome in a real window gets the real page. Their profiles carry `headed: true`. Whether a cloud browser presents as headed is the first thing M1 shows.

**Proxies.** Nate first asked for regular rotation to a new proxy on Facebook, then dropped it: "I actualyl dont think we need to proxy" ([words](../../../../product/words.md#2026-11-14-nate-we-do-not-need-our-own-proxy-rotation)). So there is no proxy rotation and no custom proxy of ours. A cloud browser is created with the vendor's own default routing (`proxyCountryCode`, default `us`) and the account's saved profile, and a linked account keeps the same profile and country for as long as it stays linked. The setting is data in the platform profile, so a site can differ. Still to measure, because the vendor's managed proxy is $5 per GB against $0.20 direct: which public reads work with `proxyCountryCode: null`. No challenge solver is switched on (`solveCaptchas` is sent as false): a challenge pauses the session and the person clears it in the live view.

## What is on main, and how far it is proved

"Passes" means the stream's own tests exit 0; the orchestrator reran the ones marked *rerun*. Nothing below has had the fresh review the board requires, so no box is ticked.

| Area | State |
|---|---|
| Kernel: protocol, sessions, primitives, release gate, repair, route health, browser pool on browser-use, stored sign-in, platform profiles, endpoints, storefront, linked-only | passes, *rerun* (pool 14, platform and protocol 25, endpoints 3, storefront 4, linked 2). Cloud source proved against a fake only |
| Events and pipeline (15 tasks), the sale-to-delist test | passes by the stream's report (101 tests); its storefront sweep is not yet called from the watcher tick |
| Intelligence: `answer`, jev client, fetch, protocols, extract, gather, reconcile, learn, swarm, public readers, market, Genie route | passes, public and market and Genie *rerun* (14, 17, 8) |
| Money: comps, keep and path, family band, slider arithmetic, negotiation choose, offer outcome, scripted buyers | passes by the stream's report |
| Knowledge: identity (46 pytest, *rerun*), trust fit (6, *rerun*), no-show and recall matching | demand, analytics beyond normalise, and style are not built |
| Capture and photo: every task | passes by the stream's report (156 pytest, 11 TS) |
| API: contract examples (*rerun*, 9), http layer, sign-in, me, jobs SSE, today, decisions, events | passes, sign-in and me and jobs *rerun* (33 and 22) |
| Databricks: param registry, proof layer, probe script, workspace checks on `Nate` | passes by the stream's report; migrations (`db/`) started |
| Fixtures, real-item manifest and scorer, `prove.mjs`, `runs.mjs`, the pytest scaffold | passes, *rerun* |
| Site harnesses (`app/src/edge/harness/sites/`) | not on main. The five teams were stopped by the second crash within minutes of starting |
| The walk (`scripts/walk.mjs`) | not written |

Lost in a crash and not rebuilt: the phone-to-hosted hand-off (`ho-1`), the hosted sign-in page (`si-1`), the saved password secret (`pw-1`), eBay OAuth linking (`cn-1`). Not started: `hp-7`, `hp-8`, `hp-9`.

## Next, in order

1. **M1**: one cloud browser created, reached over CDP, one public Depop search read with no model in the loop, count, time, bytes and cost recorded with `node scripts/runs.mjs`, the browser stopped. It also answers: cold start time, whether the cloud browser passes where headless Chrome was refused, and the real price per minute.
2. **M2**: a sign-in saved in a cloud profile and in our vault, loaded into a new cloud browser, shown to survive. Nate signs in himself through the live view.
3. The lanes and the cost guards, with their numbers.
4. **M5 to M7** on Depop, then the other four sites one at a time.
5. Wire the storefront sweep into the watcher; write the walk; swap the API's example answers for engines.

## Protections that still hold

Those in [packet 45](45-handoff-to-the-build-session.md#protections-that-hold-whatever-else-changes), unchanged, plus: every write verb runs dry until Nate says go for that site; no sign-in is made without Nate; the live view link is a credential and goes only to that person's session.

## What changed for Ben

- The contract examples you asked for in packet 47 are on main in `spec/examples/` with their rows in [product.md](../../../../spec/product.md), and stream 15 replied in packet 47. `GET /v1/routes` tells your client which endpoints answer from an engine and which from an example; today nearly all answer from examples.
- Sign-in routes exist behind an in-memory store. Better Auth on Lakebase is not wired: the workspace has no Lakebase project.
- Running people's linked accounts through hosted browsers is against the sites' terms and can get an account suspended. That belongs in onboarding copy and in the pitch.
- Poshmark's minimum price ($15 in one of your notes, $3 in the other) is still not settled; the Poshmark team did not get to it.

## Opening prompt for the Mac session

> You are the orchestrator for Nate's side of secondhand, continuing on his Mac. Read `.agents/team/packets/team/49-handoff-to-the-mac-session.md` first and follow its "How to run it from here" table exactly: one writer per checkout, one milestone at a time, commit as each piece passes. Check `OPENROUTER_API_KEY` and `BROWSER_USE_API_KEY` by presence. Then run milestone M1 from `spec/plans/board.md` on Browser Use Cloud and report its numbers to Nate before starting M2. Record everything Nate says in `product/words.md` verbatim.
