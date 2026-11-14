# Measure

Status: idea. Owner: unassigned. Packet topic: `measure`.

## What and why
Real dimensions from LiDAR, Apple's measuring tools and similar apps, and garment measurements for clothes. Ben: "for clothes measuring the mechanism is measuring more than anything" ([words](../../product/words.md#2026-11-14-tools-and-capture)).

## How it works
Not designed yet. Keep the mechanism here once research picks one, together with the reference it came from and the job that reference does.

## Decided
- The app is built with Expo, with the camera, ARKit scale and live checks in one Swift module. Ben, 21:05 ([decision](../../product/decisions.md#2026-11-14-the-app-is-an-expo-app-with-a-native-swift-camera-module)).

## Open
- Which existing apps or open-source projects already measure garments from photos, and how accurate are they?

## Research
All research for this feature: [research/measure/](../../research/measure/)
- Ben: [research/measure/ben/](../../research/measure/ben/)
- Nate: `research/measure/nate/` (none yet)
- Ben, tech stack: [measuring-garments.md](../../research/measure/ben/measuring-garments.md). Scale from LiDAR or a credit card, points from the garment mask plus a vision model, user drags to confirm; Size AI already claims about 5 mm with LiDAR.
- Ben, tech stack: [object-capture.md](../../research/measure/ben/object-capture.md). Apple Object Capture gives metric 3D for rigid items (shoes, bags, electronics) but not clothes.
- Ben, build plan: [build-plan.md](../../research/measure/ben/build-plan.md). Scale from the ARKit floor plane (LiDAR cross-checks, card on web); mask from Vision plus SAM 3.1; points from geometry plus Gemini; Decisions checks each line; the person drags endpoints and taps "Looks right". Object Capture is a stretch goal.
