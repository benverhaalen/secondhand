# Guided capture

Status: idea. Owner: unassigned. Packet topic: `capture`.

## What and why
The app walks the seller through each shot: the whole item, the back, the tag, close-ups and defects. The seller never has to think about what to shoot. Ben: [words](../../product/words.md#2026-11-14-tools-and-capture).

## How it works
Draft, revised after Ben's direction ([words](../../product/words.md#2026-11-14-shots-serve-both)). There is one shot list, and every shot serves both the listing and the image model. There are no separate reference shots.

| Shot | For buyers | For the image model |
|---|---|---|
| Front, back | Listing photos | Main views |
| Tag | Size and brand | Exact fabric color |
| Fabric close-up | Texture | Texture kept when relighting |
| Flaws | Disclosure | Constraints it must preserve |
| Spin (10 s walk-around) | 360 view | Shape from every side |

Then [measure](../measure/). The item lies on a white sheet from the first shot, so every image carries a white-balance reference. The list is chosen per item type, and shots capture automatically once they are sharp.

## Decided
- The app is built with Expo, with the camera, ARKit scale and live checks in one Swift module. Ben, 21:05 ([decision](../../product/decisions.md#2026-11-14-the-app-is-an-expo-app-with-a-native-swift-camera-module)).

## Open
- Should Apple Object Capture (a 3D model from photos) feed measure and studio? Ben asked for it to be researched: [words](../../product/words.md#2026-11-14-pavlo-and-appraise).
- Does the shot list come from presets per category, or is it chosen live from the first photo?

## Research
All research for this feature: [research/capture/](../../research/capture/)
- Ben: [research/capture/ben/](../../research/capture/ben/)
- Nate: `research/capture/nate/` (none yet)
- Ben, tech stack: [guided-shot-list.md](../../research/capture/ben/guided-shot-list.md). Per-category shot list with live checks before each shot counts; defects proposed by the model and confirmed by the user.
- Ben, build plan: [build-plan.md](../../research/capture/ben/build-plan.md). One ARKit session with live checks and auto-shutter; one Decisions call per shot; Gemini proposes flaw boxes, the person confirms each; folder drop groups photos into items. Joined with measure and identify in [seeing-the-item-pipeline.md](../../research/cross-cutting/ben/seeing-the-item-pipeline.md).
- Ben, build plan: [live-video-capture.md](../../research/capture/ben/live-video-capture.md). Talk mode ([Ben's words](../../product/words.md#2026-11-14-live-video-you-can-talk-to)): a live voice and video session directs the same shot list. The model asks for a better look, takes the stills itself through tools, and saves what the seller says as "you said" facts; a Heard / Saw screen is the approval. Gemini 3.8 Live first, OpenAI Realtime as backup. *Agent proposal.*
