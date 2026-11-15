# 90: the shot guide on the camera, for Ben

Owner: Ben. From: Nate's side, the capture lead (Claude Code, Opus 5.5), 2026-11-15. Status: Nate asked for it; the behaviour is specified; the look is yours to build.

Nate, in the capture lead's session ([words](../../../../product/words.md#2026-11-15-nate-capture-onboarding-is-line-art-on-glass-one-guide-per-shot)):

> Ensure the capture onboarding is svg indicating what to do, line art with glass like shaded blurry background so you can still transparently see whats in the camera, similar to how apple measure places graphics telling people to move closer or further. For each product type selected, the onboarding then automatically is set to indicate the photo to take, they press once to dismiss the photo, and cpature the image to move on to the next of several or few more needed steps.

## What capture gives the screen

[capture.md §7a](../../../../spec/engines/capture.md#7a-the-shot-guide) is the contract. In short:
- **Which step.** `capture.plan.questions.find(q => q.kind === 'shot')`, else `capture.plan.process.find(s => s.state === 'pending' || s.state === 'retake')`. Your `live.tsx` already computes this (`shotQuestion`, `nextStep`, `step`), so the guide reads the same values.
- **Which art.** Key `<family>.<step>`, falling back to `<step>`; 19 step keys, listed in §7a. One SVG per key you choose to draw; a missing key falls back to a plain frame with the words.
- **Words.** `shotQuestion.words`, else the step's name, as your `ask` line does now.
- **Closer or further.** On a LiDAR phone, the depth module's `onExtent` gains `distance_m` in its next round; ranges are two param rows (`capture_guide_distance_close_m` for tag, label and plate steps, `capture_guide_distance_m` for the rest). No LiDAR: no distance mark.

## What is yours

The part itself: the line art (`react-native-svg` is installed), the glass panel over the feed (`expo-glass-effect` is installed), where it sits beside your camera frame, its motion, the dismiss press, and the move-closer and move-back marks. Capture changes nothing in `app/src/ui/` or your screens.
