# 87: the LiDAR measuring module, for Ben

Owner: Ben. From: Nate's side, the capture lead (Claude Code, Opus 5.5), 2026-11-15. Status: built and compiled on the Mac, on branch `w/cap-depth-1` (bcbff73c), merging to main after its review. Nothing on any screen uses it; when and where a screen does is your call.

Nate chose to build this before any TestFlight build ([words](../../../../product/words.md#2026-11-15-nate-build-the-lidar-module-before-a-testflight-build)). The orchestrator set three conditions, and they hold: it changes no screen, navigation or dependency; it does nothing on web, Android or a phone without LiDAR; and nobody installs a build but Nate.

## What was added

`app/modules/capture-depth/`, a local Expo module (Swift, Expo Modules API, SDK 58), autolinked from `app/modules/`:
- `capabilities()` returns `{has_lidar, object_capture}`: what the capture's `device` field sends ([capture engine §7](../../../../spec/engines/capture.md#7-what-the-phone-sends-the-swift-capture-modules-contract)). On web, Android or Expo Go it returns both false.
- `<CaptureDepthView onExtent onError />` runs ARKit scene depth only while it is mounted and sends about twice a second `{extent_cm: {width, depth, height}, extent_conf: 0, rigid: true, frames}` for the item in the middle of the frame. `extent_conf` stays 0 until a known 30 cm box measures within 1 cm on Nate's phone, so every size it gives is a proposal the person confirms.
- How a screen calls it, with an example, is in the module's `README.md`, section "Ben owns the decision to use it".

## What the build needs

- A new development client: native code changed, so Expo Go and the current dev client cannot run it.
- A camera permission string (`NSCameraUsageDescription`), set through expo-camera's `cameraPermission` option in `app.json`. The module changes no config. Without the string the view sends `missing_camera_usage_description` and does not ask for the camera.
- `arkit` is not added to the required device capabilities, so phones without LiDAR still install the app.

## Your decisions

1. Whether and where a capture screen mounts the view, and what the person sees while it measures. The capture plan already reads the size it sends.
2. Whether you want a dev screen that opens a capture and posts the measured size. Nothing like it was added.

Proved on the Mac: 9 geometry tests in SwiftPM (a box 30 × 20 × 10 cm, also rotated, within 0.5 cm; noise below the confidence bar ignored; an empty frame gives nothing; the same points give the same box), the web and Android fallback test, the type check, and an unsigned `xcodebuild` for a generic iPhone (BUILD SUCCEEDED, the module compiled). Not proved: anything on a phone.
