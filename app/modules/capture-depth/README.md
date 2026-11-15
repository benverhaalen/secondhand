# Capture depth

Local checks, from the repository root (run in order):

```sh
(cd app/modules/capture-depth/geometry && swift test)
node --test --test-concurrency=1 app/modules/capture-depth/index.test.ts
(cd app && npx --no-install tsc --noEmit -p .)
```

In a restricted worker, SwiftPM may lack access to its default compiler caches or its nested sandbox. The equivalent geometry run used here is:

```sh
(cd app/modules/capture-depth/geometry && CLANG_MODULE_CACHE_PATH=/tmp/capture-depth-clang SWIFTPM_MODULECACHE_OVERRIDE=/tmp/capture-depth-swift swift test --disable-sandbox)
```

An optional iOS Expo module. It reports LiDAR scene depth and Object Capture support, and provides a camera preview that measures the visible item above a support plane. Importing it or querying capabilities never starts the camera. Mounting the view starts one AR session after camera permission; detaching it or backgrounding the app pauses that session. It resumes when mounted and active again. The wrapper routes capability calls, session states, frame counts and errors through the existing app logger. It does not log depth pixels or images.

`expo-module.config.json` lists only `apple`. Android, web, Expo Go and builds without the module receive false capabilities and a view that renders nothing. On iPhones without scene depth, the native view starts no camera session. No existing screen imports this module.

## Call it from a screen

Ben owns the decision to use it. Example for a screen under `app/src/app/`:

```tsx
import { capabilities, CaptureDepthView } from '../../modules/capture-depth';
import type { Extent } from '../../modules/capture-depth';

const device = await capabilities(); // send as the capture's device field

// Render only while this screen is active; unmount before opening another camera.
// Retain the event data, not the React event object.
<CaptureDepthView
  style={{ flex: 1 }}
  onExtent={({ nativeEvent }: { nativeEvent: Extent }) => {
    // Save the latest proposal for the screen's confirmation step.
    // nativeEvent: { extent_cm, extent_conf: 0, rigid: true, frames }
  }}
  onError={({ nativeEvent }) => {
    // Use nativeEvent.code to offer permission settings or a retry.
    // A remount starts a fresh session after a session failure.
  }}
/>
```

`capabilities()` returns a promise of `{has_lidar, object_capture}`. Object Capture is only a support check: this module creates no Object Capture session. Its flag is false before iOS 17, in the simulator and on Mac Catalyst. Native failures reject the promise, so an error cannot masquerade as unsupported hardware.

Each `onExtent` is `{extent_cm: {width, depth, height}, extent_conf: 0, rigid: true, frames}`. Units are centimeters; width is the longer side on the plane, depth the shorter, and height is perpendicular to it. `frames` counts AR frames received during this view's lifetime, including frames without usable depth; it is not a count of fused measurements. Measurements use one frame at a time, at most twice per second. No extent is emitted when a frame lacks enough usable geometry.

The route's scan body additionally needs `scan_ok`. The screen must decide that from its scan workflow; receiving one extent is not proof of a completed scan. Preserve `extent_conf: 0`. The known-size device check in [capture §7](../../../spec/engines/capture.md#7-what-the-phone-sends-the-swift-capture-modules-contract) has not passed.

## Build and handoff to Ben

Owner: Nate. Lead: forward this section to Ben before merging. No screen integration is included; Ben decides when and where to mount the view.

- Expo autolinks local modules from `app/modules/`. The podspec compiles the three iOS files and the same geometry file tested by SwiftPM. It excludes tests and SwiftPM build products. The pod's deployment floor is iOS 15.1; Object Capture is separately guarded at iOS 17.
- The host app needs a nonempty `NSCameraUsageDescription` before camera use. Set it through the existing expo-camera plugin's `cameraPermission` or `ios.infoPlist` in the host app. This worker changes neither config. If missing, the view emits `missing_camera_usage_description` without requesting camera access.
- Leave `arkit` out of `UIRequiredDeviceCapabilities`; LiDAR is optional and checked at runtime. This module adds no required-device capability.
- Native changes need a new development client build. The lead runs `npx expo prebuild --platform ios` and the unsigned `xcodebuild` on the Mac. Those checks were deliberately left to the lead; see `WORKER_REPORT.md` for local results.
- Nate installs it himself: sign in to Xcode with his Apple ID on the Mac, plug in his LiDAR iPhone, then run `cd app && npx expo run:ios --device`. Choose his phone and complete signing in Xcode if requested. No agent installs a build, submits to EAS or changes signing.
- On the phone, exercise mount/unmount, background/foreground, denied camera permission and AR interruptions; then measure the known 30 cm box within 1 cm. Until that fixed-set check passes, measured size stays a proposal with confidence zero.

## Geometry and limits

The pure Swift package imports Foundation only. Input samples carry pixel coordinates, metric depth and a Boolean high-confidence flag. The native adapter obtains that flag by comparing `ARConfidenceLevel` to `.high`, reads both buffers' dimensions and row strides, and never assumes a depth-map size.

`scaleIntrinsics` independently scales focal lengths and principal points from camera image resolution into depth-map resolution. Unprojection uses positive camera-space Z. The support plane is fit in that same space, without `ARCamera.transform` or world coordinates. A fixed seed makes RANSAC repeatable for identical ordered samples. The convex hull of above-plane points yields a minimum-area rectangle; the largest plane distance yields height.

Agent proposal, uncalibrated fitting choices: use the central 70% of each sensor-image dimension, at least 12 support and 12 item points, 384 RANSAC trials, a 3 mm plane tolerance and a 5 mm above-plane margin. Reject a candidate if more than 2% of points lie below it. Choose the eligible plane with most inliers, breaking ties by residual. These values live together in the geometry file; they do not establish measurement confidence.

The preview fills the view; its aspect crop can differ from the central sensor region. Keep the whole item and visible support near the center. No overlay or screen layout is included. Missing edges can underestimate a box; clutter can enlarge it. Too little visible support, reflective surfaces, concave objects, support viewed edge-on or another eligible plane can defeat the fit. There is no object segmentation, gravity alignment, multi-frame fusion or real-device accuracy claim. Synthetic tests cover ideal points, rotation, camera tilt, confidence rejection, degenerate input and repeatability.

Evidence: [Expo/ARKit note, sections 1 to 5](../../../research/capture/nate/expo-module-arkit-depth-2026-11.md), [capture contract §7](../../../spec/engines/capture.md#7-what-the-phone-sends-the-swift-capture-modules-contract), [handoff conditions](../../../.agents/team/packets/team/72-capture-handoff.md#the-lidar-module-brief-row-5-for-whoever-picks-capture-up). Intrinsics scaling is inferred in that note and tested here. Device accuracy and the camera/world transform are not assumed.
