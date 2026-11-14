# 22 — Build plan for capture, measure and identify

Updated: November 14, 2026. Owner: Ben. Agent: Claude Code, project thread "Plan the build for capture and measuring". Branch: `main`, base `6b01181`. Status: plans written; waiting on Ben for the app shell.

## Scope

Implementation plans, not code yet, for [capture](../../../../features/capture/), [measure](../../../../features/measure/) and [identify](../../../../features/identify/), and how they join: [seeing-the-item-pipeline.md](../../../../research/cross-cutting/ben/seeing-the-item-pipeline.md).

Ben's ask (project chat, 2026-11-14 20:41 UTC): "judges love human in the loop. i feel like creating dynamic and intelligent ui is really good where you have a huge range of set components." [Words](../../../../product/words.md#2026-11-14-human-in-the-loop-and-dynamic-ui).

## Affected interfaces

- **App shell.** The plans recommend a small Swift capture screen (one ARKit session) that uploads the photo plus camera data, then hands off to the web app. This assumes the React 19 web app and json-render catalog in [packet 4](../list/4-posting-messages-dynamic-ui-plan.md). Not decided: Ben picks.
- **Component catalog** (packet 4) needs these entries for capture, measure and identify: shot review (keep or retake), flaw pins on a photo with yes or no, a measure overlay with draggable endpoints and a loupe, a measurement row with ± and source, candidate cards with photos for identity, a 6-level condition picker, a per-field confidence dot with a "why?" sheet.
- **Item and Photo primitives** gain per-field source and confidence, and Photo gains camera intrinsics and the floor plane. Field lists are in each note's "Data contract".
- **Comps for price**: verified identity matches feed [packet 21](../price/21-pricing-search-watch-plan.md).

## Next action

Day one, first hour: measure Decisions latency on images, Gemini flaw recall and tape-measure error on 10 real garments, and Object Capture on the demo phone.
