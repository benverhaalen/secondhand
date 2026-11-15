# What can be built right now

Status: *agent proposal*, written 2026-11-14 about 21:00 Central for a build that ends at 03:00 ([Nate](../../product/words.md#2026-11-14-nate-the-entire-product-is-finished-by-3-am-with-leeway-to-7-am)). The full task graph is `spec/plans/backend/plan.md` and `plan.json` when they land; until then this page is enough to start. Every task below has no dependency on another unbuilt task, owns files nobody else owns, and has one command that proves it. All of them can run at the same time.

Each task's full statement is section 10 of its engine document, with the calculation in section 3 and the proof in section 9. Read those, then the [task shape](README.md#2-the-task-shape) and the [build skill](../../.agents/skills/build/SKILL.md). Commits carry `Rests-on:` and `Proved-by:` trailers ([packet 44](../../.agents/team/packets/team/44-research-reaches-code.md)).

## Say this in every build brief

> Before you write code, work out and write down how this will operate: what it reads, the steps of each action in the fewest moves, what runs in parallel, where a fast decision model decides and where a language model reads. The design is known to work; your job is to make it accurate and fast and useful today. No guess and check. List what is most likely to break it and write a test for each, so a failure names its cause. Write the failing test first. Take every name from spec/product.md. Finish with the proving command's output.

## First, in parallel with everything else (wave 0)

| Task | Owns | Proves with |
|---|---|---|
| T0-1 Workspace checks on the event workspace, including whether a headless browser runs on its compute | `probes/workspace/` | `python probes/workspace/run.py --report research/data/nate/workspace-checks.md` |
| T0-2 Contract examples for every `/v1` endpoint | `spec/examples/`, `spec/examples.test.mjs` | `node --test spec/examples.test.mjs` |
| T0-3 Real items with known answers, and the scorer | `spec/items/`, `spec/items.test.mjs` | `node --test spec/items.test.mjs` |
| S-1 Python scaffold: `jobs/` with pytest and one command for every Python test | `jobs/pyproject.toml`, `jobs/conftest.py`, `jobs/README.md` | `python -m pytest jobs -q` |
| S-2 Shared fixtures: the frozen market snapshot, the order fixture, the mask and planted-change fixtures | `jobs/fixtures/` | `python -m pytest jobs/fixtures -q` |
| S-3 The failure reporter that groups a red run by task with its likely cause | `scripts/prove.mjs`, `scripts/prove.test.mjs` | `node --test scripts/prove.test.mjs` |
| S-4 The end-to-end walk on fixtures: capture in, identified, valued, listed dry on one site, offer handled, sale seen, delisted everywhere; prints each stage with its counts | `scripts/walk.mjs`, `scripts/walk.test.mjs` | `node scripts/walk.mjs` (red until wave 1 lands; it is the target) |
| X-1 to X-11 Expert session per engine: what must be determined, the best way, what to consider, from a working professional's view | `research/<slug>/nate/expert-<engine>.md` | the note passes `node .agents/check.mjs` and lists changes for the engine's tasks |

## Our own protocol ([protocol-and-adapters](../engines/protocol-and-adapters.md))

| Task | Owns | Proves with |
|---|---|---|
| 1 The envelope, error codes, hints, manifest types | `app/src/edge/harness/protocol.ts`, `protocol.test.ts` | `node --test app/src/edge/harness/protocol.test.ts` |
| 2 Sessions: lease, pace, keep-alive, `needs_session` | `app/src/edge/harness/session.ts`, `session.test.ts` | `node --test app/src/edge/harness/session.test.ts` |
| 3 The primitives, with network redaction and the forbidden-control filter | `app/src/edge/harness/primitives.ts`, `primitives.test.ts` | `node --test app/src/edge/harness/primitives.test.ts` |
| E-1 The `event` intake: dedupe, one job per event, the outbox (3.6) | `app/src/edge/events/intake.ts`, `intake.test.ts` | `node --test app/src/edge/events/intake.test.ts` |
| E-2 The snapshot differ: two normalised snapshots in, events out (3.6) | `app/src/edge/events/diff.ts`, `diff.test.ts` | `node --test app/src/edge/events/diff.test.ts` |
| E-3 Webhook receivers with signature checks (eBay, as a trigger) | `app/src/edge/events/hooks.ts`, `hooks.test.ts` | `node --test app/src/edge/events/hooks.test.ts` |
| P-1 The saved-password secret: write-only from the app, readable by the sign-in job alone (3.7) | `app/src/edge/harness/secret.ts`, `secret.test.ts` | `node --test app/src/edge/harness/secret.test.ts` |
| D-1 Depop recon and the first commands, on fixtures, then a test account on Nate's go (3.7) | `app/src/edge/harness/sites/depop/` | `node --test app/src/edge/harness/sites/depop/` |

## Engines, tasks with no unbuilt dependency

| Engine | Tasks that start now | Proves with |
|---|---|---|
| [valuation](../engines/valuation.md) | 1 comps arithmetic; 2 keep and path; 3 backtest harness; 4 `family_band`; plus the price slider (`posture`) | `node --test app/src/engines/valuation/` and `python -m pytest jobs/valuation` |
| [negotiation](../engines/negotiation.md) | 1 limits and the argmax; 2 `offer_outcome`; 4 scripted-buyer harness | `node --test app/src/engines/negotiation/` and `python -m pytest jobs/negotiation/test_sim.py` |
| [trust](../engines/trust.md) | 2 `trust_signal`, `trust_label`, `script_print`, the Beta updates | `node --test app/src/engines/trust/labels.test.ts` |
| [identity](../engines/identity.md) | id-1 pair score; id-2 capture ladder; id-3 clusters; id-4 groups and lots | `python -m pytest jobs/identity` |
| [demand-and-trend](../engines/demand-and-trend.md) | dt-1 velocity; dt-2 direction; dt-5 research ensemble | `python -m pytest jobs/demand` |
| [photo](../engines/photo.md) | ph-1 pool and score; ph-3 crops; ph-5 gates and marks | `python -m pytest jobs/photo` |
| [platform-analytics](../engines/platform-analytics.md) | pa-1 normalise each site's stats (read [Ben's levers data](../../research/list/ben/levers/levers.json)); pa-3 site effect | `python -m pytest jobs/analytics` |
| [recommendation-and-style](../engines/recommendation-and-style.md) | rs-1 events to facets | `python -m pytest jobs/style/test_facets.py` |
| [intelligence-api](../engines/intelligence-api.md) | every task its section 10 marks as depending on none: the question protocols table, the parallel source runner, the extractor schemas, the gather request | the commands in its section 10 |
| [capture](../engines/capture.md) | every task its section 10 marks as depending on none: the type suggestion contract, the per-type process table as data, the follow-up inputs as data, the free note reader | the commands in its section 10 |
| [marketing engine](../marketing-engine.md) and [score](../features/score.md) | the site plan objective as a pure function; the success score (`U_now / U_best`) and its bands on fixtures | `node --test app/src/engines/marketing/` |

## Then

The second set (each engine's learning, fit and proof tasks, the adapters for the other four sites (eBay, Facebook Marketplace, Poshmark, Mercari), the `/v1` routes, deployment) starts as the tasks above finish; the dependencies are in each engine's section 10 and in the full plan. The walk (S-4) is rerun after every merge and is never left red.

## Clock

| By (Central) | What is true |
|---|---|
| 21:45 | everything in "First" is done or reporting |
| 23:30 | the protocol tasks pass and the walk passes on fixtures |
| 02:00 | every engine is built and proved |
| 03:00 | sites wired behind dry runs, deployed on the event workspace, one rehearsal |
| to 07:00 | tuning, live runs on Nate's go, Ben's screens joined to the API |
