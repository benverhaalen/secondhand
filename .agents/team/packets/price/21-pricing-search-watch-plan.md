# 21 — Build plan for pricing, cross-market search and watch alerts

Updated: November 14, 2026, 21:40 UTC. Owner: Ben. Agent: Claude Code, project thread "Plan the build for pricing, search and watch". Branch: `main`, base `05b447e`. Status: plan written, waiting on Ben.

## Scope

An implementation plan, not code yet, for three features that share one engine: [price](../../../../features/price/), [appraise](../../../../features/appraise/) and [watch](../../../../features/watch/). It covers the valuation engine, sold-comps sources, cross-market search, Exa alerts, the garage-sale appraisal run, data flow, failure cases and the human approval points.

[Ben's words](../../../../product/words.md#2026-11-14-human-in-the-loop-and-dynamic-ui) for this pass (project chat, 2026-11-14 20:41 UTC): "judges love human in the loop. i feel like creating dynamic and intelligent ui is really good where you have a huge range of set components." and "for this whole project i dont care about api costs for the time being its all demos." and "if i gave you the name of a tool assume thats the one in use unless you find a better one."

## Affected interfaces

- The `POST /value` response shape in [valuation-engine.md](../../../../research/price/ben/valuation-engine.md) may change. Anything rendering a Valuation (Sell drafts, Buy matches, the camera's "What's it worth") depends on it.
- The Comp, Valuation and Want primitives in [primitives.md](../../../../product/primitives.md).

## Done

The plan is [research/price/ben/build-plan.md](../../../../research/price/ben/build-plan.md). It is an *agent proposal*; nothing in it is decided. What other workstreams should know:

- `POST /value` keeps its shape and gains `level`, `price_basis` per comp, and `max_pay` in appraise mode.
- The `comp` table schema is in the plan's Data model section. Read it before fixing a Comp or Valuation schema.
- eBay data is used everywhere in the demo, in the price engine and in the mixed search grid. The licence limits are noted for production only, per Ben's [demo, not production](../../../../product/words.md#2026-11-14-demo-not-production). eBay sold prices come from three paid routes run at once.
- Exa was tested live: stale on the big marketplaces and no Facebook pages. Watches poll each site themselves; Exa covers the long tail.

## Waiting on Ben

Four choices listed under "Decisions for Ben" in the plan: which paid sold-data services to sign up for, a second vision model for labels, the three demo categories, and Exa's role.
