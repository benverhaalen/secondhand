# How does the app make a photo grow into its page, feel alive under a thumb, mark a sale, and load before the tap?
Researched 2026-11-15 by Ben (Claude Code agent, UI thread, with one fetch agent reading the docs). Feature: cross-cutting.

Ben, [round 7](../../../product/words.md#2026-11-15-round-7-picks): "the picture enlarges and a really really great animation goes and it all feels cohesive", "buttons should feel alive, pressable as much as possible", "the animation should have the gradient encompass the whole ui", "super interested in researching predictive ui loading", and "use the logging skill when actually doing ui tests about latency".

The app is Expo SDK 58 with expo-router, Reanimated 4.7 and Gesture Handler 3.3 ([app/package.json](../../../app/package.json)). Every fact below is *observed* on the linked page on 2026-11-15 unless marked. Nothing here has been run on a phone. Each "use" line is an *agent proposal*.

## What designers call these

| Ben's words | The term | The rule behind it |
|---|---|---|
| The photo enlarges into the next page | Shared element transition, or a zoom transition on iOS; "spatial continuity" | Show where a thing came from so the person never loses it. Use it when the same object is on both screens |
| Buttons feel alive | Press feedback, direct manipulation | Respond the moment the finger lands, not when it lifts. Springs, so a second touch mid-motion carries on from where it is ([the two iOS points](https://www.tiktok.com/@justinbuilds.mov/video/7700425886859873550), Emil's Apple design skill) |
| The dopamine moment | Peak moment (peak-end rule), multimodal feedback | One rare moment gets motion, haptics and sound together. Everything else stays quiet so this one is felt |
| Loads before I press | Predictive prefetch, optimistic UI | Start the work on the earliest honest signal and show the result at once |

## What to build with

| Need | Use | Source | Limits |
|---|---|---|---|
| Photo grows into its page | `Link.AppleZoom` around the tile and `Link.AppleZoomTarget` on the item page | [Expo Router zoom transition](https://docs.expo.dev/router/advanced/zoom-transition.md) | Alpha. iOS 18 and later. Stack navigator only. The page advises against headers and reports about a 1 second delay on open and dismiss |
| The same, if zoom's delay shows in the demo | Reanimated `sharedTransitionTag` behind the `ENABLE_SHARED_ELEMENT_TRANSITIONS` flag | [Reanimated shared element transitions](https://docs.swmansion.com/react-native-reanimated/docs/shared-element-transitions/overview/) | Experimental, "not recommended for production use yet". Native stack only, no tabs, needs a development build |
| Press feedback | `Pressable` `onPressIn` and `onPressOut` driving a Reanimated `withSpring` scale | [Pressable](https://reactnative.dev/docs/pressable), [withSpring](https://docs.swmansion.com/react-native-reanimated/docs/animations/withSpring/) | None stated |
| Haptics | `expo-haptics`: `selectionAsync` for a pick, `impactAsync` (Light to Heavy, Rigid, Soft) for a press that commits, `notificationAsync` (Success, Warning, Error) for an outcome | [expo-haptics](https://docs.expo.dev/versions/latest/sdk/haptics.md) | iOS plays nothing in Low Power Mode, with the camera active, or when the person turned haptics off. So a haptic never carries information alone |
| The sale sound | `expo-audio`: `useAudioPlayer`, preloaded at module scope, mixed with other audio | [expo-audio](https://docs.expo.dev/versions/latest/sdk/audio.md) | The preload detail was read through a page summary |
| The gradient, ambient and across the screen | `expo-mesh-gradient` (`MeshGradientView`, SwiftUI's mesh) with its points moved by Reanimated; Skia shaders if that can't animate | [expo-mesh-gradient](https://docs.expo.dev/versions/latest/sdk/mesh-gradient.md), [Skia shaders](https://shopify.github.io/react-native-skia/docs/shaders/overview/) | Neither page documents animating it or which thread it runs on. *Inferred* that it works; test first |
| Pinch to change grid density | `Gesture.Pinch()`, reading `scale` when it ends; the steps are in [grid.ts](../../../app/src/sell/grid.ts) | [Gesture Handler pinch](https://docs.swmansion.com/react-native-gesture-handler/docs/legacy-gestures/pinch-gesture) | Read on the legacy-API page. Animating a list's column count was not checked |
| Load before the tap | `prefetch` on `Link`, and `router.prefetch()` from `onPressIn` | [Link](https://docs.expo.dev/versions/latest/sdk/router/link.md) | The docs don't say what is fetched. Data needs its own fetch on press-in |

Open source for the harder motion: Reanimated and Gesture Handler (already installed), Skia for shaders, and Emil's `animate-expo` skill in Ben's harness for the order of decisions.

## Can an iPhone sense a finger before it touches?

No. Apple's own page says of the hover recognizer: "On iOS, this class doesn't recognize gestures." It works with a pointer on iPad and Mac ([UIHoverGestureRecognizer](https://developer.apple.com/documentation/uikit/uihovergesturerecognizer.md)). The earliest signal on a phone is the finger landing, which comes before the tap counts. So:

1. **On press-in**, start the next screen's fetch. A tap is press-in then release, so this buys the length of the press.
2. **When a tile scrolls into view**, prefetch its item page. This is what ForesightJS does on touch devices too.
3. **On the tap**, show the new screen at once with what is already known (the photo, title and price from the tile) and fill in the rest. This is the "started" moment in [frontend-standard §4](../../../product/frontend-standard.md#4-states-every-screen-must-design).
4. **On the website**, ForesightJS predicts the pointer's target and prefetches before the hover ([note](../../../ideas/website.md)).

## Measuring it

`node spec/log.mjs <log file>` now prints `tap_to_show`: for every tap, the time until the next thing shown, with the median, the 95th percentile, the five slowest taps by screen and control, and how many taps showed nothing. That is the number to hill-climb. It needs the app to call `log.input` on each tap and `log.show` on each screen state, which is not wired yet ([app/README.md](../../../app/README.md)).

A target is Ben's call. For reference, the frontend standard already treats 100 to 150 ms as the length of touch feedback.

## Limits

- Nothing was run. Zoom's delay, the mesh gradient's motion and pinch on a long grid each need a test on a phone before a screen depends on them.
- The Expo index and two pages were partly read through summaries. FlashList, Skia threading and the Reanimated 4.7 release notes were not opened.
