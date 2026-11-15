# The build, piece by piece

Status: *agent proposal* for Nate, written 2026-11-14 for the build that ends at 03:00 Central. It says which sessions the orchestrator launches, what each one owns and delivers, and how the pieces join. Tasks ready this minute are in [start-now.md](start-now.md); the full graph is `backend/plan.md` and `plan.json` when they land, with each task tagged by its stream.

Nate ([words](../../product/words.md#2026-11-14-nate-every-platform-gets-an-expert-team-codex-builds-beside-claude-and-a-fresh-orchestrator-launches-the-sessions)): "Every platform is understood, a small team of experts build each custom api / harness to drive the app actions with the authenticated sessions. The system for the mass swarm intelligence layers we need for additional insight and data for things outside what just the platforms tell us. Then understanding how to credibly weigh and realtime score everything, the databricks and such."

## How it is run

- **One orchestrator** (Fable 5.2) holds the clock, the canon and the end-to-end walk. It launches each stream below as its own session, merges nothing itself except the canon, and reports to Nate at each checkpoint.
- **Each stream is a session led by Opus or Fable.** The lead works out the design, writes the briefs and reviews. Its builders are Sonnet seats and Codex workers on GPT-6.1, sent in parallel.
- **Codex builds; it does not run in the product.** No model that drives the working product is a Codex model. Codex workers write code, do research and work out the calculations (how gathered information is weighed), stay on their task, and are reviewed by a Claude seat.
- **One writer per file.** Each stream owns its folders. `spec/product.md`, `spec/events.json`, `spec/lifecycle.mjs` and the Lakebase migrations are written only by the orchestrator, on a stream's request.
- **Everyone works on `main`** in small commits with `Rests-on:` and `Proved-by:` trailers, pulls before each push, and runs `node .agents/check.mjs` first.
- **The walk** (`node scripts/walk.mjs`) is rerun by the orchestrator after every merge. A stream that turns it red fixes that before anything else.

## The streams

| # | Stream | Lead | Owns | Delivers | Proves with |
|---|---|---|---|---|---|
| 0 | Orchestrator | Fable | the canon files, `scripts/walk.mjs`, `scripts/prove.mjs`, the board | wave 0 scaffolds and fixtures, the walk, the reporter, the checkpoint reports | `node scripts/walk.mjs` |
| 1 | Platform kernel | Opus | `app/src/edge/harness/*.ts` (not `sites/`) | the protocol envelope, sessions and leases, primitives, the release gate, the repair loop, route health, the hosted browser pool, the cookie-carrying request runner, the saved-password secret | `node --test app/src/edge/harness/` |
| 2 | Events and pipeline | Opus | `app/src/edge/events/`, `jobs/pipeline/` | the event intake and outbox, the snapshot differ, webhook receivers, watcher scheduling by tier, one job per event with the policy check in code | `node --test app/src/edge/events/` |
| 3 to 9 | One team per platform: eBay, Facebook, Depop, Poshmark, Mercari, OfferUp, Grailed | Opus each | `app/src/edge/harness/sites/<site>/` | that site's whole custom API, below | `node --test app/src/edge/harness/sites/<site>/` |
| 10 | Swarm intelligence | Fable or Opus | `app/src/engines/intelligence/`, `jobs/intelligence/` | the question protocols, the parallel source runner, extraction to schema, the gather request that widens when the basis is thin, the listing swarm, official stores and Amazon, product and seller reviews, the public search API and its MCP tools | the commands in [intelligence-api](../engines/intelligence-api.md) section 10 |
| 11 | Weighing and scoring: money | Opus, Codex-heavy | `app/src/engines/valuation/`, `negotiation/`, `marketing/`, `score/`, `jobs/valuation/`, `jobs/negotiation/` | valuation with the price slider, negotiation, the marketing engine's site plan, the success score | `node --test app/src/engines/` and `python -m pytest jobs/valuation jobs/negotiation` |
| 12 | Weighing and scoring: knowledge | Opus, Codex-heavy | `jobs/identity/`, `jobs/demand/`, `jobs/analytics/`, `jobs/style/`, `app/src/engines/trust/`, `jobs/trust/` | identity, demand and trend, platform analytics, recommendation and style, trust, learning the person | `python -m pytest jobs` |
| 13 | Databricks | Opus | `probes/workspace/`, `databricks/` (bundles, jobs, migrations requested through the orchestrator), `jobs/learning/` | the workspace checks, Lakebase tables, the `param` registry with versions, promote and rollback, the per-event updates and nightly refits, the proof layer (`observation`, `evidence`, `citation`, `claim_check`), deployment on the event workspace | `python probes/workspace/run.py` and the bundle's validate and deploy |
| 14 | Capture and photo | Opus | `app/src/engines/capture/`, `jobs/photo/` | the server side of capture by type (suggestion contract, per-type process and follow-up inputs as data, the free note reader) and the photo engine | `python -m pytest jobs/photo` and `node --test app/src/engines/capture/` |
| 15 | API and contract | Opus | `app/src/app/v1/`, `spec/examples/` | every `/v1` route over the engines, jobs with stage frames and found counts over SSE, the contract examples Ben's screens mock from | `node --test spec/examples.test.mjs` and `npm run check` in `app/` |
| 16 | Review and proof | Fable or Opus, fresh | nothing but review notes | a review of each stream's merges against its sources, the fixed real-item set, the mutation drills | `node scripts/evidence.mjs brief <commit>` per review |

Ben's side (screens, the camera module, the brand) is not a stream here. Stream 15 is the seam: his screens build against its examples from the first hour.

## What each platform team builds

A platform is finished when all of this works through that site's own adapter, with the person's signed-in session where the account is involved and the fastest public path where it is not ([protocol-and-adapters](../engines/protocol-and-adapters.md) 3.5 to 3.8). Every team starts with an operating design for its site, written before any code: what the site's own client reads and calls for each verb.

| Area | Verbs |
|---|---|
| Linking | sign in on the site's real login in a page we host and in the phone's web view; hold and renew the session; hand it from phone to our hosted browser |
| The whole market on that site, no login | search active listings, search sold listings where the site shows them, read one listing, read a seller's public shop, read reviews, the cheap "is it still up" check |
| The person's listings | create with every field the site has, edit, reprice, relist, delist, mark sold, read all listings with their counts |
| Offers | read, accept, decline, counter, send an offer to likers or watchers, the site's own auto-offer settings |
| Messages and notifications | read the inbox and the notification feed, send a message, mark read |
| Orders | read orders with the paid amount and buyer handle, shipping label where the site gives one |
| Stats | views, likes, saves, watchers and offers per listing, normalised by stage with [Ben's levers data](../../research/list/ben/levers/levers.json) |
| Watching | the normalised snapshot of feed, inbox, offers, orders and listings that the differ turns into events |
| Proof | a fixture per verb, a live run on a test account on Nate's go with the result read back, the mutation drill, the pace bench with its challenge rate |

Each team has a lead (Opus) and three kinds of seat: a recon seat that drives the site and records how its client works, builders (Sonnet and Codex) that write each command from the recon, and a fresh reviewer. A bot check is never solved or routed around: the job pauses and the person clears it.

## What joins the pieces

| Seam | Fixed by | Both sides build against |
|---|---|---|
| Platform teams and everyone else | stream 1, first hour | `harness.call(site, verb, args)` and the one envelope in `protocol.ts` |
| Events | stream 2, first hour | the `event` row and the snapshot shape |
| Engines and the API | stream 15, first hour | `spec/examples/` |
| Every engine and Databricks | stream 13, first hour | the `param`, `observation` and `citation` shapes in [product.md](../product.md) |
| Intelligence and the scoring streams | stream 10, first hour | the `answer` object and the question kinds |

The first hour of streams 1, 2, 10, 13 and 15 is therefore the interface, as types and a test with a fake behind it, pushed before the implementation. Every other stream builds against the fake and loses no time.

## Order

1. Minute zero: the orchestrator launches streams 1, 2, 10, 13 and 15 with "interface first", stream 16's expert sessions, and its own wave 0.
2. As soon as stream 1's envelope is pushed: all seven platform teams, and streams 11, 12 and 14, at once.
3. The walk passes on fixtures, then stays green while every stream fills in.
4. Deploy on the event workspace, one rehearsal, then tuning and live runs on Nate's go.

Open for Nate: whether all seven sites are built tonight or a named five; eBay's push as a sale trigger.
