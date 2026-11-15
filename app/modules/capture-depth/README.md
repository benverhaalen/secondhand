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

## How a screen calls it

Ben owns the decision to use it. Example for a screen under `app/src/app/`:

```tsx
import { capabilities, CaptureDepthView } from '../../modules/capture-depth';
import type { Extent } from '../../modules/capture-depth';

const device = await capabilities(); // send as the capture's device field; catch it if native rejects

// Render only while this screen is active; unmount before opening another camera.
// Retain the event data, not the React event object.
<CaptureDepthView
  style={{ flex: 1 }}
  onExtent={({ nativeEvent }: { nativeEvent: Extent }) => {
    // Save the latest proposal for the screen's confirmation step.
    // nativeEvent: { extent_cm, extent_conf: 0, rigid: true, frames }
  }}
  onStatus={({ nativeEvent }) => {
    // item_clipped: ask for the whole item inside the window before confirming size.
  }}
  onError={({ nativeEvent }) => {
    // Use nativeEvent.code to offer permission settings or a retry.
    // A remount starts a fresh session after a session failure.
  }}
/>
```

`capabilities()` returns a promise of `{has_lidar, object_capture}`. Object Capture is only a support check: this module creates no Object Capture session. Its flag is false before iOS 17, in the simulator and on Mac Catalyst. Native failures reject the promise: catch it at the screen and offer a retry. A native throw still rejects; false flags describe unsupported hardware.

Each `onExtent` is `{extent_cm: {width, depth, height}, extent_conf: 0, rigid: true, frames}`. Units are centimeters; width is the longer side on the plane, depth the shorter, and height is perpendicular to it. `frames` counts AR frames received during this view's lifetime, including frames without usable depth; it is not a count of fused measurements. Measurements use one frame at a time, at most twice per second. The delegate copies scalar samples and camera intrinsics, unlocks both buffers, and submits those values to a second serial queue. It retains no ARFrame, CVPixelBuffer or depth map for fitting. Frames arriving while work is outstanding are dropped before copying. Results from a paused, interrupted or replaced session generation are discarded, including an interruption that ends before fitting finishes. No extent is emitted for insufficient or clipped geometry.

The route's scan body additionally needs `scan_ok`. The screen must decide that from its scan workflow; receiving one extent is not proof of a completed scan. Preserve `extent_conf: 0`. The known-size device check in [capture §7](../../../spec/engines/capture.md#7-what-the-phone-sends-the-swift-capture-modules-contract) has not passed.

## Build and handoff to Ben

Owner: Nate. Lead: forward this section to Ben before merging. No screen integration is included; Ben decides when and where to mount the view.

- Expo autolinks local modules from `app/modules/`. The podspec compiles the three iOS files and the same geometry file tested by SwiftPM. It excludes tests and SwiftPM build products. The pod's deployment floor is iOS 15.1; Object Capture is separately guarded at iOS 17.
- The host app needs a nonempty `NSCameraUsageDescription` before camera use. Set it through the existing expo-camera plugin's `cameraPermission` or `ios.infoPlist` in the host app. This worker changes neither config. If missing, the view emits `missing_camera_usage_description` without requesting camera access.
- Leave `arkit` out of `UIRequiredDeviceCapabilities`; LiDAR is optional and checked at runtime. This module adds no required-device capability.
- Native changes need a new development client build. The lead runs `npx expo prebuild --platform ios` and the unsigned `xcodebuild` on the Mac. Those checks were deliberately left to the lead; see `WORKER_REPORT.md` for local results.
- Nate installs it himself: sign in to Xcode with his Apple ID on the Mac, plug in his LiDAR iPhone, then run `cd app && npx expo run:ios --device`. Choose his phone and complete signing in Xcode if requested. No agent installs a build, submits to EAS or changes signing.
- On the phone, exercise mount/unmount, background/foreground, denied camera permission and AR interruptions; then measure the known 30 cm box within 1 cm. Until that fixed-set check passes, measured size stays a proposal with confidence zero.

## Status events

`onStatus` receives `{state}` and the wrapper logs it through the app logger. The native view emits a status only when it changes, including transitions back to an earlier state.

| State | Meaning |
|---|---|
| `requesting_camera_permission` | Waiting for the camera permission response. |
| `unsupported` | This device has no scene depth; no session starts. |
| `running` | The session started, or a usable measurement followed a geometry warning. |
| `waiting_for_depth` | No depth/confidence pair is available yet. |
| `insufficient_geometry` | The frame cannot provide both a support plane and a connected item. |
| `item_clipped` | A cell in the selected cluster touches the sensor window border; this frame emits no extent. |
| `paused` | The view detached or the app left the foreground. |
| `interrupted` | ARKit interrupted the session. |
| `interruption_ended` | ARKit ended the interruption; waiting for another usable frame. |

Errors remain `onError {code}`: camera configuration/permission errors, invalid buffer formats or dimensions, and AR session failures. Capability failures reject their promise.

## Geometry and limits

Round 2 moves fitting off the delegate queue, bounds RANSAC work, refits the support plane, measures its noise, selects one connected item and reports clipping. The pure Swift package imports Foundation only. Its `samples(depth:depthStride:confidence:confidenceStride:width:height:isHigh:)` copies high-confidence pixels with independent byte strides and samples at `(x + 0.5, y + 0.5)`. The adapter checks buffer formats, matching dimensions and locks, and supplies ARKit's `.high` comparison. `DepthWindow` defines the central window once for both copying and fitting, including odd image sizes.

`scaleIntrinsics` independently scales focal lengths and principal points from camera image resolution into depth-map resolution. Unprojection uses positive camera-space Z. The support plane is fit in that same space, without `ARCamera.transform` or world coordinates. RANSAC uses a fixed seed and a fixed stride `ceil(pointCount / maximumRANSACPoints)`. Only plane fitting is subsampled; cluster selection, clipping and dimensions use the full accepted point set.

Candidates rank by initial consensus size, then residual. Each candidate is refit by total least squares (the smallest covariance eigenvector) on its inliers. A second fit expands consensus to 9 mm so the initial 3 mm cutoff does not truncate the noise estimate. Identical initial consensus sets share one refit. The final inlier RMS residual, with three fitted degrees of freedom removed, supplies sigma. Both the above-plane margin and below-plane rejection distance are `max(5 mm, 3 × sigma)`. A candidate with too many points beneath that distance is rejected, so a dominant box top cannot become the table.

Above-plane points are projected onto two support-plane axes and binned into a 1 cm grid. Eight-connected components select the cluster whose occupied cells contain the window-centre ray's intersection with the support plane, or the nearest cluster when the centre is empty. Ties follow input order. Detached clutter is excluded; touching clutter remains part of the item. Before trimming, each selected cell is projected back to pixels at its points' heights. A cell touching the window boundary returns `.clipped`; the native view emits `item_clipped` instead of `onExtent`.

The cluster's 99th-percentile distance from its centroid trims the hull input. Its minimum-area rectangle sets width and depth. Height starts with the cluster's 98th-percentile plane distance. A raw percentile on a flat surface with 3 mm Gaussian noise overestimates height by about 6 mm, exceeding the requested 5 mm synthetic tolerance. Round 2 therefore subtracts the Gaussian 98th-percentile bias using an item-top noise estimate. That estimate is the median absolute deviation around the median of distances within three initial/noise sigmas below the raw height, divided by 0.6744897502. A quiet item above noisy support receives almost no correction; the separate support sigma still governs plane separation. Noisy rectangle edges also trim their outer 0.5% after orientation fitting. These are *agent proposal* noise corrections, beyond the requested raw percentiles, and assume a roughly planar, Gaussian-noisy item top.

Fitting constants live in `DepthGeometry.swift`; the scheduling interval lives in `DepthSession.swift`. These are uncalibrated choices and establish no measurement confidence:

| Constant | Value | Why |
|---|---|---|
| Window inset | 15% each edge | Keep the central 70% of each sensor dimension. |
| `minimumPoints` | 12 each for support/item | Require more than a few pixels. |
| `maximumRANSACPoints` | 3000 | Bound fitting work in Debug. |
| `ransacTrials` | 384 | Find minority support beneath a dominant box top. |
| `planeTolerance` | 3 mm | Initial consensus around noisy depth. |
| `minimumMargin`, `noiseMultiples` | 5 mm, 3 sigma | Exclude table noise above and below by the same measured margin. |
| `maximumBelowFraction` | 2% | Reject a top with support beneath it. |
| `cellSize` | 1 cm | Separate detached clutter using 8-connectivity. |
| `heightPercentile`, `heightNoiseQuantile` | 98%, 2.0537489106 item-top sigma | Resist flying pixels and correct Gaussian percentile bias. |
| `gaussianMedianDeviation` | 0.6744897502 | Convert item-top median absolute deviation to Gaussian sigma. |
| `radiusPercentile` | 99% | Remove isolated in-plane extremes before the hull. |
| `edgeTailFraction` | 0.5% per edge when sigma > 5 mm / 3 | Limit noisy edge extremes. |
| `measurementInterval` | 0.5 s | Copy and emit at most twice per second. |

All nine round-1 Swift tests and their assertions remain. Their top grid now has at most 7.5 mm spacing so it is connected under the new 1 cm grid. The original fixture now supports fixed-seed Box-Muller depth noise. New tests exercise 3 mm Gaussian noise flat, tilted and rotated 30 degrees; an independent ray/box fixture; flying pixels; touching and detached 5 cm sticks; nearest-cluster selection; clipping without an exact border pixel; padded buffer rows; status deduplication; heterogeneous support/item noise; and the actual worker's queue, busy-frame and interruption-invalidation behavior. Both timed cases (ray/box and a dominant top) use exactly 24,000 synthetic points and print monotonic elapsed time, asserting less than 0.25 seconds and each side within 0.5 cm. This is a local test-build check, not a phone performance claim. Dense ray fixtures separate geometric accuracy from finite pixel spacing; sparse sampling can still miss physical edges.

Only a phone can establish ARKit frame delivery under sustained load, actual buffer confidence/noise, permission and session lifecycle behavior, preview-to-sensor alignment, thermal performance and real measurement accuracy. The preview's aspect crop can differ from the central sensor region. Keep the whole item and visible support near the centre. No overlay or screen layout is included. Too little support, reflective surfaces, depth holes that disconnect the item, concave objects, an edge-on support or another eligible plane can defeat the fit. A hand or stick touching the item enlarges the cluster, as the test records. Gaussian percentile corrections can underestimate an irregular top. There is no semantic segmentation, gravity alignment or multi-frame fusion. Preserve confidence zero until the known-size phone check passes.

Evidence: [Expo/ARKit note, sections 1 to 5](../../../research/capture/nate/expo-module-arkit-depth-2026-11.md), [capture contract §7](../../../spec/engines/capture.md#7-what-the-phone-sends-the-swift-capture-modules-contract), [handoff conditions](../../../.agents/team/packets/team/72-capture-handoff.md#the-lidar-module-brief-row-5-for-whoever-picks-capture-up). Intrinsics scaling is inferred in that note and tested here. Device accuracy and the camera/world transform are not assumed.
