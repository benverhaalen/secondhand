# 4 — Build plan for pricing, cross-market search and watch alerts

Updated: November 14, 2026, 20:55 UTC. Owner: Ben. Agent: Claude Code, project thread "Plan the build for pricing, search and watch". Branch: `main`, base `05b447e`. Status: in progress.

## Scope

An implementation plan, not code yet, for three features that share one engine: [price](../../../../features/price/), [appraise](../../../../features/appraise/) and [watch](../../../../features/watch/). It covers the valuation engine, sold-comps sources, cross-market search, Exa alerts, the garage-sale appraisal run, data flow, failure cases and the human approval points.

[Ben's words](../../../../product/words.md#2026-11-14-human-in-the-loop-and-dynamic-ui) for this pass (project chat, 2026-11-14 20:41 UTC): "judges love human in the loop. i feel like creating dynamic and intelligent ui is really good where you have a huge range of set components." and "for this whole project i dont care about api costs for the time being its all demos." and "if i gave you the name of a tool assume thats the one in use unless you find a better one."

## Affected interfaces

- The `POST /value` response shape in [valuation-engine.md](../../../../research/price/ben/valuation-engine.md) may change. Anything rendering a Valuation (Sell drafts, Buy matches, the camera's "What's it worth") depends on it.
- The Comp, Valuation and Want primitives in [primitives.md](../../../../product/primitives.md).

## Under way

- Exa tested live on Ben's Mac (this cloud machine can't reach api.exa.ai): marketplace coverage, freshness, sold pages, and the price-alert feature Ben linked. Result lands as `research/watch/ben/exa-empirical.md`.
- Sold-comps routes per platform: `research/price/ben/comps-sources-live.md`.
- Cross-market fan-out and the watch loop: `research/watch/ben/fanout-and-watch-loop.md`.
- One appraisal run step by step: `research/appraise/ben/appraisal-run.md`.
- Then the plan itself under `research/price/ben/`.

## Next action

If you are building Buy, Sell drafts or the data tables, read the plan before fixing a schema for Comp or Valuation. Tell Ben if your work already assumes a shape.
