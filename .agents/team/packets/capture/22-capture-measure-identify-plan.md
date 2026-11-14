# 22 — Build plan for capture, measure and identify

Updated: November 14, 2026. Owner: Ben. Agent: Claude Code, project thread "Plan the build for capture and measuring". Branch: `main`, base `6b01181`. Status: plans written; app shell decided: Expo plus a Swift camera module (Ben, 21:05).

## Scope

Implementation plans, not code yet, for [capture](../../../../features/capture/), [measure](../../../../features/measure/) and [identify](../../../../features/identify/), and how they join: [seeing-the-item-pipeline.md](../../../../research/cross-cutting/ben/seeing-the-item-pipeline.md).

Ben's ask (project chat, 2026-11-14 20:41 UTC): "judges love human in the loop. i feel like creating dynamic and intelligent ui is really good where you have a huge range of set components." [Words](../../../../product/words.md#2026-11-14-human-in-the-loop-and-dynamic-ui).

## Affected interfaces

- **App shell.** The plans recommend a small Swift capture screen (one ARKit session) that uploads the photo plus camera data, then hands off to the web app. This assumes the React 19 web app and json-render catalog in [packet 4](../list/4-posting-messages-dynamic-ui-plan.md). Ben answered "app first, website if we have time" at 20:59 ([words](../../../../product/words.md#2026-11-14-app-first-website-if-time)). He then picked an Expo app with a Swift camera module at 21:05 ([decision](../../../../product/decisions.md#2026-11-14-the-app-is-an-expo-app-with-a-native-swift-camera-module)). Approval screens render with `@json-render/react-native`.
- **Component catalog** (packet 4) needs these entries for capture, measure and identify: shot review (keep or retake), flaw pins on a photo with yes or no, a measure overlay with draggable endpoints and a loupe, a measurement row with ± and source, candidate cards with photos for identity, a 6-level condition picker, a per-field confidence dot with a "why?" sheet. Accepted by packet 4's thread as catalog entries 41 to 47, section 6 of [build-plan-posting-messages-ui.md](../../../../research/cross-cutting/ben/build-plan-posting-messages-ui.md). MeasureOverlay is hand-built: the agent places it but can't change how it behaves.
- **Item and Photo primitives** gain per-field source and confidence, and Photo gains camera intrinsics and the floor plane. Field lists are in each note's "Data contract".
- **Comps for price**: verified identity matches feed [packet 21](../price/21-pricing-search-watch-plan.md).

## Demo mode

Ben, 21:08: build ideas instead of dropping them for production reasons. Object Capture, generated 3D for clothes (scaled to measured lengths), the 10 s spin, the constant-color shot and SerpApi Lens are all back in. See "Demo mode" in [seeing-the-item-pipeline.md](../../../../research/cross-cutting/ben/seeing-the-item-pipeline.md).

## Talk mode (added 21:40)

Ben asked at 21:22 for a live video capture you can talk to. Plan: [live-video-capture.md](../../../../research/capture/ben/live-video-capture.md). It adds a `LiveDirector` class to the Swift camera module, six model tools, new Item fields (transcript, heard facts with source "you said") and new catalog components for the Heard / Saw review screen (listed in the note's step 11). Flaws the model or seller mention go through the same yes or no chips. Ben decided at 21:33 that capture opens on the guided list and talk mode is one tap away ([decision](../../../../product/decisions.md#2026-11-14-capture-opens-on-the-guided-shot-list-talk-mode-is-one-tap-away)). Packet 4's thread added the six components as catalog entries 48 to 53; LiveHintPill, VoiceMark, CaptionLine and ModeSwitch are drawn by the capture screen straight from live events, never composed from a json-render spec.

## Talk mode reworked (22:45)

Ben redirected talk mode at 22:24 ([words](../../../../product/words.md#2026-11-14-video-capture-as-a-decision-tree)): a decision tree run through the Decisions API with set spoken lines, no live language model. Plan: [decision-tree-capture.md](../../../../research/capture/ben/decision-tree-capture.md). The runner is TypeScript in the Expo app; trees are JSON served by the backend; every tick is logged to Databricks. `LiveDirector` keeps only the frame tap and audio. The catalog components for talk mode are unchanged. It uses the question-wording rules in [ai-harness-from-repos.md](../../../../research/cross-cutting/ben/ai-harness-from-repos.md) section 2.

## Next action

Day one, first hour: measure Decisions latency on images, Gemini flaw recall and tape-measure error on 10 real garments, and Object Capture on the demo phone.
