# The build, piece by piece

Status: *agent proposal* except linked decisions. Streams below describe ownership, not simultaneous sessions. Progress: [board.md](board.md); task contracts: [backend/plan.json](backend/plan.json). [Packet 49](../../.agents/team/packets/team/49-handoff-to-the-mac-session.md) replaced the thirteen-session build after crashes.

## How it is run

[Nate asked for fewer parallel builds](../../product/words.md#2026-11-14-nate-store-auth-through-browser-use-build-fewer-things-at-once-focus-on-the-browser-harnesses) and [Claude orchestration with Codex on the Mac](../../product/words.md#2026-11-15-nate-the-mac-as-extra-compute-claude-driving-here-and-codex-there-and-no-more-crashes). *Agent proposal* for the working arrangement:

- One orchestrator holds the canon, milestones and walk. Codex workers on the Mac use their own worktrees; Claude builders and fresh reviewers work beside them. One writer per checkout and owned path.
- A worker changes only its assigned files and runs its task check, one test file at a time. The lead reruns those checks, reviews the diff and commits the worker's explicit files. Workers do not commit or push.
- The lead integrates working pieces on `main`, runs the full repo check once before pushing, and keeps the walk green. A worker never runs the full check or a wave of tests.
- Canon changes (`spec/product.md`, events, lifecycle and migrations) go through the lead. Builders use the shared types and examples rather than inventing names.
- Follow [the milestones](board.md#milestones-the-order-of-the-build-since-2300-central-2026-11-14) one at a time, each with a real cloud run and fresh review ([Nate](../../product/words.md#2026-11-14-nate-browser-use-on-cloud-tested-the-way-production-runs-with-milestones-that-are-finalised-as-they-are-hit)). Increase concurrency only after measuring capacity.

## The streams

| # | Stream | Lead | Owns | Delivers | Proves with |
|---|---|---|---|---|---|
| 0 | Orchestrator | Fable | the canon files, `scripts/walk.mjs`, `scripts/prove.mjs`, the board | wave 0 scaffolds and fixtures, the walk, the reporter, the checkpoint reports | `node scripts/walk.mjs` |
| 1 | Platform kernel | Opus | `app/src/edge/harness/*.ts` (not `sites/`) | the protocol envelope, sessions and leases, primitives, the release gate, the repair loop, route health, the Browser Use Cloud pool behind `Launcher`, stored auth behind `account.token_ref` | `node --test app/src/edge/harness/` |
| 2 | Events and pipeline | Opus | `app/src/edge/events/`, `jobs/pipeline/` | the event intake and outbox, the snapshot differ, webhook receivers, watcher scheduling by tier, one job per event with the policy check in code | `node --test app/src/edge/events/` |
| 3 to 7 | One team per platform: eBay, Facebook Marketplace, Depop, Poshmark, Mercari. Numbers 8 and 9 are unused: OfferUp and Grailed are a [future idea](../../ideas/post-to-grailed-and-offerup.md) ([Nate](../../product/words.md#2026-11-14-nate-five-sites-offerup-and-grailed-are-a-future-idea-and-ebays-push-only-if-it-beats-our-harness)) | Opus each | `app/src/edge/harness/sites/<site>/` | that site's whole custom API, below | `node --test app/src/edge/harness/sites/<site>/` |
| 10 | Swarm intelligence | Fable or Opus | `app/src/engines/intelligence/`, `jobs/intelligence/` | the question protocols, the parallel source runner, extraction to schema, the gather request that widens when the basis is thin, the listing swarm, official stores and Amazon, product and seller reviews, the public search API and its MCP tools | the commands in [intelligence-api](../engines/intelligence-api.md) section 10 |
| 11 | Weighing and scoring: money | Opus, Codex-heavy | `app/src/engines/valuation/`, `negotiation/`, `marketing/`, `score/`, `jobs/valuation/`, `jobs/negotiation/` | valuation with the price slider, negotiation, the marketing engine's site plan, the success score | `node --test app/src/engines/` and `python -m pytest jobs/valuation jobs/negotiation` |
| 12 | Weighing and scoring: knowledge | Opus, Codex-heavy | `jobs/identity/`, `jobs/demand/`, `jobs/analytics/`, `jobs/style/`, `app/src/engines/trust/`, `jobs/trust/` | identity, demand and trend, platform analytics, recommendation and style, trust, learning the person | `python -m pytest jobs` |
| 13 | Databricks | Opus | `probes/workspace/`, `databricks/` (bundles, jobs, migrations requested through the orchestrator), `jobs/learning/` | the workspace checks, Lakebase tables, the `param` registry with versions, promote and rollback, the per-event updates and nightly refits, the proof layer (`observation`, `evidence`, `citation`, `claim_check`), deployment on the event workspace | `python probes/workspace/run.py` and the bundle's validate and deploy |
| 14 | Capture and photo | Opus | `app/src/engines/capture/`, `jobs/photo/` | the server side of capture by type (suggestion contract, per-type process and follow-up inputs as data, the free note reader) and the photo engine | `python -m pytest jobs/photo` and `node --test app/src/engines/capture/` |
| 15 | API and contract | Opus | `app/src/app/v1/`, `spec/examples/` | every `/v1` route over the engines, jobs with stage frames and found counts over SSE, the contract examples Ben's screens mock from | `node --test spec/examples.test.mjs` and `npm run check` in `app/` |
| 16 | Review, test and fix | Fable or Opus, fresh, driving Codex sessions | review notes; a fix goes through the owning stream | a continuous sweep while the build goes on ([Nate](../../product/words.md#2026-11-14-nate-codex-sessions-review-test-and-fix-while-the-build-goes-on)): rerun every proving command and the walk on `main`, review each stream's merges against its sources, fix what is red; the fixed real-item set; the mutation drills | `node scripts/evidence.mjs brief <commit>` per review |

Ben's side (screens, the camera module, the brand) is not a stream here. Stream 15 is the seam: his screens build against its examples from the first hour.

## What each platform team builds

A platform is finished when all of this works through that site's own adapter, with the person's signed-in session where the account is involved and the fastest public path where it is not ([protocol-and-adapters](../engines/protocol-and-adapters.md) 3.5 to 3.8). Each site starts with recon of its own structure ([Nate](../../product/words.md#2026-11-14-nate-each-harness-is-built-from-what-it-understands-of-the-site-as-documented-endpoints-such-as-write-listing)): official APIs where offered, then the measured lanes in the engine, with in-page data calls before controls.

| Area | Verbs |
|---|---|
| Linking | OAuth for eBay; elsewhere the person signs in through the cloud live view; save per-account auth behind `account.token_ref`; pause for a login wall or challenge |
| The whole market on that site, no login | search active listings, search sold listings where the site shows them, read one listing, read a seller's public shop, read reviews, the cheap "is it still up" check |
| The person's listings | create with every field the site has, edit, reprice, relist, delist, mark sold, read all listings with their counts |
| Offers | read, accept, decline, counter, send an offer to likers or watchers, the site's own auto-offer settings |
| Messages and notifications | read the inbox and the notification feed, send a message, mark read |
| Orders | read orders with the paid amount and buyer handle, shipping label where the site gives one |
| Stats | `read_storefront` to `storefront_snapshot`, plus per-listing figures, missing fields named; normalised by stage with [Ben's levers data](../../research/list/ben/levers/levers.json) |
| Watching | the normalised snapshot of feed, inbox, offers, orders and listings that the differ turns into events |
| Proof | a fixture per verb; public live reads; all writes dry until Nate's go per site, then acted once and read back; never replayed; mutation and pace checks |

The lead assigns recon, building and fresh review within measured capacity. A bot check is never solved or routed around: the job pauses and the person clears it.

## What joins the pieces

| Seam | Fixed by | Both sides build against |
|---|---|---|
| Platform teams and everyone else | stream 1, first hour | `harness.call(site, verb, args)` and the one envelope in `protocol.ts` |
| Events | stream 2, first hour | the `event` row and the snapshot shape |
| Engines and the API | stream 15, first hour | `spec/examples/` |
| Every engine and Databricks | stream 13, first hour | the `param`, `observation` and `citation` shapes in [product.md](../product.md) |
| Intelligence and the scoring streams | stream 10, first hour | the `answer` object and the question kinds |

The shared types and fixtures define these seams; the lead integrates implementations after their task checks and review.

## Order

Use the board's milestones: cloud read, stored sign-in, linked-only guards, profiles and manifests, then Depop and the other sites one at a time. Finish with the real-item walk, API wiring and deployment. This replaces launching all site teams together.

The [five-site decision](../../product/words.md#2026-11-14-nate-five-sites-offerup-and-grailed-are-a-future-idea-and-ebays-push-only-if-it-beats-our-harness) keeps eBay push only if it beats the watcher. [Nate's later API decision](../../product/words.md#2026-11-15-nate-official-apis-where-they-exist-the-browser-design-as-specced-ranking-systems-accounted-for-databricks-perfected) uses official developer APIs where available; eBay's API is not relegated to last fallback.
