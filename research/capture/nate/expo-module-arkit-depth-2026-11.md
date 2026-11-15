# What do the current Expo and ARKit docs say that a local Swift Expo module reading LiDAR depth depends on, as of November 2026?
Researched 2026-11-15 by Nate (Claude Code: capture lead, retriever seat). Feature: capture.

Decision it feeds: the build of the local native module (Swift, development build) that the capture plan needs for depth, per [capture-tech-docs-2026-11](capture-tech-docs-2026-11.md) item 4. That note holds Object Capture LiDAR-only, `ObjectCaptureSession.isSupported`, Vision text and barcode requests and which iPhones have LiDAR; none of it is repeated here.

All fetches 2026-11-15. Expo pages were read as `.md` bytes from docs.expo.dev; Apple pages as `.md` from developer.apple.com/documentation (they carry "Copyright 2026", no page version). *observed*: read at the URL today. *asserted*: the source says it without showing it, or memory. *inferred*: our reasoning. Quotes are kept short; the rest is paraphrase.

Repo facts the module meets (from the brief): Expo SDK `expo ~58.0.25`, react-native 0.88.1, no native module yet, no `ios/` folder. The docs' latest version resolved to v58.0.0 (*observed*).

## 1. Local module: create, layout, autolinking, build

**Create.** `npx create-expo-module@latest --local`, run in the directory holding package.json (yarn, pnpm, bun equivalents exist). It prompts for local module name, native module name, platforms and feature examples (*observed*, https://docs.expo.dev/modules/get-started.md, https://docs.expo.dev/more/create-expo-module.md; modification date July 27, 2026).
Flags (*observed*, create-expo-module.md):
- `--local`: skips installing module dependencies, makes no example app.
- `--platform`: `android`, `apple`, `web`. For local modules the prompt preselects from the app config `platforms`; non-interactive uses all platforms unless the flag is given.
- `--features`, `--full-example` (same as `--features all`).
- `--barrel`: only with `--local`; generates `index.ts`. Without it a local module has no barrel and imports point at the module's `src` files.
- `--source`: a local template directory. `--no-example`: standalone only.
Output goes to `modules/` by default, or to `expo.autolinking.nativeModulesDir` if set (*observed*).

**Layout.** get-started.md shows `modules/my-module/{android, ios, src, expo-module.config.json, index.ts}` (*observed*).

**Generated template content** (*inferred* to match what the CLI writes; *observed* in the npm tarball https://registry.npmjs.org/expo-module-template-local/-/expo-module-template-local-0.7.10.tgz, the template the CLI downloads):
- Files: `expo-module.config.json`, `index.ts`, `ios/<Module>.swift`, `ios/<Name>.podspec`, `ios/<View>.swift`, `src/<Module>.ts`, `src/<Module>.web.ts`, `src/<Name>.types.ts`, `src/<View>.tsx`, `src/<View>.web.tsx`, plus android files.
- `expo-module.config.json`: `{"platforms":["apple","android","web"],"apple":{"modules":["<ModuleName>"]},"android":{"modules":["<package>.<ModuleName>"]}}`.
- Podspec: `s.platforms = { :ios => '15.1', :tvos => '15.1' }`, `s.source = { git: '' }`, `s.static_framework = true`, `s.dependency 'ExpoModulesCore'`, `s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }`, `s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"`, `s.homepage = 'https://docs.expo.dev/modules/'`. ARKit depth needs iOS 14+, which the 15.1 floor covers (*inferred*).
- `src/<Module>.ts`: declares `class X extends NativeModule<XEvents>` and `export default requireNativeModule<X>('<name>')`, both imported from `'expo'`.
- `src/<Module>.web.ts`: `registerWebModule(X, 'X')` from `'expo'`.
- `index.ts`: re-exports the default from `./src/<Module>` and the types; its comment says the `.web.ts` file is picked on web.
- Swift module skeleton: `import ExpoModulesCore`, `public class X: Module { public func definition() -> ModuleDefinition { Name("..."); Function(...); AsyncFunction(...); Events(...) } }`.

**Autolinking** (*observed*, https://docs.expo.dev/modules/autolinking.md):
- Resolution order: react-native.config.js roots, `searchPaths`, local modules in `nativeModulesDir` (default `./modules/`), then dependency resolution.
- Config lives under `expo.autolinking` in package.json, with per-platform overrides `ios`, `android`, `apple`.
- Before SDK 54, `searchPaths` defaulted to node_modules directories and `exclude` applied only to Expo modules.
- `expo-module.config.json` (https://docs.expo.dev/modules/module-config.md, *observed*): `platforms` takes `android`, `apple` (or `ios`/`macos`/`tvos`), `web`, `devtools`; `apple.modules` lists Swift module class names; `appDelegateSubscribers` exists too.

**Build.** (*observed*, get-started.md and https://docs.expo.dev/guides/local-app-development.md)
- No `ios/` dir: `npx expo prebuild --clean` creates it. Existing `ios/`: `npx pod-install` after adding native files or changing `expo-module.config.json`.
- `xed ios` opens Xcode; the module shows under Pods > Development Pods.
- `npx expo run:ios` runs prebuild first if native dirs are missing; `--device` picks a physical device; `run:ios` makes a debug build and starts the dev server.
- Any native change needs a native rebuild. `expo-dev-client` plus a debug build is a development build.
- ARKit depth needs a physical LiDAR device (*inferred* from section 4: the simulator has no LiDAR).

**SDK 58 change.** *not-found*: no doc line on a SDK 58-specific change to local modules. The local flow is called the recommended one (*observed*).

## 2. Swift DSL and JS import, absent-safe on web and Android

Source: https://docs.expo.dev/modules/module-api.md (*observed*) unless stated.
- `Name("X")` sets the JS name.
- `Function("f") { ... }` is synchronous, on the JS thread.
- `AsyncFunction("f") { (a: String) in return a }` returns a Promise and runs off the JS thread by default. A second form takes a trailing `promise: Promise` and waits for `promise.resolve` or `promise.reject`. Max 8 arguments including the promise. `.runOnQueue(.main)` changes the queue.
- `Events("onX", ...)` declares events; `self.sendEvent("onX", [String: Any?])` emits on iOS.
- `OnStartObserving { }` and `OnStopObserving { }` fire as JS listeners attach and detach, with an optional event-name scope.
- `OnCreate` runs right after module init (use instead of the class initializer). `OnDestroy` runs before deallocation (use instead of a destructor). Also `OnAppEntersForeground`, `OnAppEntersBackground`, `OnAppBecomesActive`, `OnAppContextDestroys`.
- Views: `View(MyView.self) { Prop("x") { (view: MyView, v: T) in }; Events(...); AsyncFunction(...) }`. View `AsyncFunction`s run on the UI thread by default. `ExpoView` extends RCTView; `required init(appContext: AppContext? = nil)` cannot change parameters. A view fires an event through an `EventDispatcher` property (`let onLoad = EventDispatcher()`, call `onLoad([...])`; template, *observed*).
- JS side (https://docs.expo.dev/versions/latest/sdk/expo.md, *observed*):
  - `requireNativeModule(name)` returns the module host object.
  - `requireOptionalNativeModule(name)` returns the module or `null` when it is not found.
  - `requireNativeView(moduleName, viewName?)` is a drop-in for `requireNativeComponent`.
  - Modules are event emitters: `addListener` on the module, or the `useEvent` and `useEventListener` hooks from `'expo'`.
- The native-view tutorial (https://docs.expo.dev/modules/native-view-tutorial.md) still shows `requireNativeViewManager` from `expo-modules-core`; the template uses `requireNativeView` from `'expo'` (*observed*, both).

**Absent-safe on web and Android.** What is documented: the `platforms` array in `expo-module.config.json` controls which platforms link the module; the template ships `<Module>.web.ts` using `registerWebModule`; `requireOptionalNativeModule` returns null if absent (*observed*). There is no docs paragraph that says "absent-safe". The pattern of a `.web.ts`/`.android.ts` file or `requireOptionalNativeModule` plus a null check, so that `isSupported()` returns false off iOS, is *inferred*. Whether the template's Android class is needed when `platforms` lists only `apple` is not stated (*not-found*); with `platforms: ["apple"]` the module is not linked on Android, so `requireNativeModule` would throw there (*inferred*).

## 3. Info.plist keys, and ARKit optional rather than required

- `ios.infoPlist` in app config is a "Dictionary of arbitrary configuration" merged into Info.plist, applied before other Expo config, with no validation (*observed*, https://docs.expo.dev/versions/latest/config/app.md).
- `NSCameraUsageDescription`: Apple says it is required if the app uses APIs that access the camera; iOS 7+ (*observed*, https://developer.apple.com/documentation/bundleresources/information-property-list/nscamerausagedescription.md). That ARKit's camera feed falls under it is *inferred*; the page does not name ARKit.
- expo-camera's plugin option `cameraPermission` sets `NSCameraUsageDescription`, with localized values through the locale files (*observed*, https://docs.expo.dev/versions/latest/sdk/camera.md). Setting it directly in `ios.infoPlist` is *inferred* to work from the app.md text.
- `UIRequiredDeviceCapabilities` (*observed*, https://developer.apple.com/documentation/bundleresources/information-property-list/uirequireddevicecapabilities.md), paraphrased:
  - The App Store blocks installs on devices lacking a listed capability.
  - Omitting a value means the app does not require it.
  - Apple's advice: list only features the app absolutely requires; if the app can avoid the code paths, leave the key out.
  - Updates may keep or relax requirements, not add.
- https://developer.apple.com/support/required-device-capabilities/ (*observed*, HTML with embedded JSON): the `arkit` string is in iPhone lists including non-LiDAR phones (iPhone 17, iPhone Air seen). So `arkit` is not a LiDAR test. No `lidar` capability string was seen (*not-found*).
- *Inferred*: leaving `arkit` out of `UIRequiredDeviceCapabilities` keeps the app installable on every phone; the LiDAR test is runtime (`supportsFrameSemantics(.sceneDepth)`, section 4).
- *not-found*: an Expo app-config key for required device capabilities (grep of app.md for "requiredDevice" and "arkit" found none; use `ios.infoPlist`). What Expo's prebuild template writes for `UIRequiredDeviceCapabilities` was not read; `arm64` is *asserted* from memory.

## 4. ARKit scene depth: API facts

All *observed* at https://developer.apple.com/documentation/arkit/<path>.md unless marked.

**Support and enabling.**
- `ARConfiguration.supportsFrameSemantics(_:)` is `class func supportsFrameSemantics(_ frameSemantics: ARConfiguration.FrameSemantics) -> Bool` (path `arconfiguration/supportsframesemantics(_:)`). Called on `ARWorldTrackingConfiguration` with `.sceneDepth` it is true on devices with the LiDAR depth buffer. Do not call it on the `ARConfiguration` superclass.
- `FrameSemantics.sceneDepth` (iOS 14+): LiDAR distance, fills `ARFrame.sceneDepth`, matching that frame's `capturedImage`; LiDAR devices only. `FrameSemantics.smoothedSceneDepth` (iOS 14+): averaged across frames to cut flicker; fills `ARFrame.smoothedSceneDepth`.
- `ARFrame.sceneDepth: ARDepthData?` is nil unless the semantic is set on `configuration.frameSemantics`. The ARDepthData page says the depth is exposed through `ARWorldTrackingConfiguration` and updated every frame.

**ARDepthData** (`ardepthdata`):
- `depthMap: CVPixelBuffer`: "estimated distance from the device to its environment, in meters". Each pixel is the distance from the camera plane (not the ray length) of a region of `capturedImage` (page text: "from the plane of the camera"). Format `kCVPixelFormatType_DepthFloat32` (Metal `r32Float`).
- `confidenceMap: CVPixelBuffer?`: one `ARConfidenceLevel` raw value per depth pixel; `kCVPixelFormatType_OneComponent8` (Metal `r8Uint`). Low confidence arises on reflective or light-absorbing surfaces.
- `ARConfidenceLevel`: cases low, medium, high; `init?(rawValue: Int)`. The numeric raw values are not on the pages read; 0, 1, 2 is *asserted* from memory.
- Sendable and Hashable (conformance list).

**Camera and intrinsics.**
- `ARCamera.intrinsics: simd_float3x3`: pinhole K. `fx`, `fy` are focal lengths in pixels; `ox`, `oy` are the principal-point offset from the top-left of the image, in pixels. Column-major, so `K[0][0]=fx`, `K[1][1]=fy`, `K[2][0]=ox`, `K[2][1]=oy` (layout is the sample's use, section 5).
- `ARCamera.imageResolution: CGSize`: size of the `capturedImage` buffer in the sensor's native orientation.
- `ARFrame.capturedImage`: planar YCbCr, full-range BT.601.
- `ARFrame.camera.transform` is the camera-to-world pose (*asserted*, memory; the page was not read for this).

**Depth size and scaling.**
- The depth map's pixel size (256x192 on LiDAR iPhones) is not on any Apple page fetched (*not-found*; 256x192 is *asserted* from memory). The repo notes [adaptive-capture](adaptive-capture.md) and [object-capture](../../measure/ben/object-capture.md) are said to hold the ARKit depth size; they were not re-read here.
- The documentation read does not say how the depth map and the image map to each other beyond "every pixel in the depthMap maps to a region of the visible scene".
- Intrinsics are for the `imageResolution` frame. Using them against depth-map pixel coordinates needs the intrinsics scaled by depthWidth/imageWidth (fx, ox) and depthHeight/imageHeight (fy, oy). That scaling is *inferred*, not documented. See the sample's behavior in section 5.

**Raycast** (*observed*):
- `ARFrame.raycastQuery(from:allowing:alignment:)`: a normalized 0..1 point, origin top-left, of the view/image.
- `ARSession.raycast(_:) -> [ARRaycastResult]`, nearest first, empty on no hit. `ARRaycastQuery(origin:direction:allowing:alignment:)`. Targets are planes or estimated planes (surface hits, not the depth map).

**Session delegate** (*observed*, https://developer.apple.com/documentation/arkit/arsessiondelegate/session(_:didupdate:)-9v2kw.md and arsessiondelegate.md):
- `optional func session(_ session: ARSession, didUpdate frame: ARFrame)`: gives the newly captured frame. `ARSessionDelegate` inherits `ARSessionObserver`; also `didAdd`/`didRemove` anchor callbacks.
- Delegate and the NSObject requirement: protocol inherits NSObjectProtocol, so the delegate is an NSObject subclass (*observed*, relationships list).
- In Expo, running the session inside a `Module` with an NSObject helper holding `ARSession` is *inferred*; no Expo page covers ARKit.

**iOS 26 and 27 changes** (https://developer.apple.com/documentation/updates/arkit.md, *observed*): the June 2026 (iOS 27 era) iOS items are `ARSession.viewRotationAngle` and orientation-independent variants on `ARCamera` and `ARFrame`, `ARSession.viewLayer`, `ARFrame.metadataObjects`, `ARWorldTrackingConfiguration.trackingObjects`, and face-tracking environment textures. The June 2025 (iOS 26 era) entries are visionOS, Mac and general items with no iOS depth entry. No change to `sceneDepth`, `ARDepthData` or `supportsFrameSemantics` is listed for either year (*observed* by absence on that page). The orientation-independent `ARCamera`/`ARFrame` variants' names were not opened (*not-found*).

## 5. Apple point-cloud sample and its formula

Source: https://developer.apple.com/documentation/arkit/displaying-a-point-cloud-using-scene-depth.md, "Displaying a point cloud using scene depth", sample "Depth Cloud" (*observed*). The old URL `arkit/visualizing_a_point_cloud_using_scene_depth` 404s. It cites WWDC20 session 10611, https://developer.apple.com/wwdc20/10611/ (not read).

- Support check: `ARWorldTrackingConfiguration.supportsFrameSemantics([.sceneDepth, .smoothedSceneDepth])`.
- Run: `let config = ARWorldTrackingConfiguration(); config.frameSemantics = [.sceneDepth, .smoothedSceneDepth]; arSession.run(config)`.
- Per frame in `session(_:didUpdate:)`: checks `frame.sceneDepth != nil && frame.smoothedSceneDepth != nil`, then keeps `.depthMap` of each.
- Unprojection in the Metal vertex shader, `pos` being the depth-texture pixel coordinate, `cameraIntrinsics` the 3x3 K:

```
float xrw = ((int)pos.x - cameraIntrinsics[2][0]) * depth / cameraIntrinsics[0][0];
float yrw = ((int)pos.y - cameraIntrinsics[2][1]) * depth / cameraIntrinsics[1][1];
float4 xyzw = { xrw, yrw, depth, 1.f };
```

  That is X = (u - ox) * Z / fx, Y = (v - oy) * Z / fy, Z = depth, in the camera frame (camera axes as ARKit gives them; the sample later multiplies by a view matrix).
- The sample feeds depth-map pixel coordinates straight into the intrinsics as shown. Whether the Swift code that fills `cameraIntrinsics` scales it beforehand was not seen (*not-found*; open).
- Color lookup uses normalized coordinates: `out.coor = {pos.x/(w-1), pos.y/(h-1)}` (*observed*), so depth-to-image correspondence is by normalized position.
- The sample filters by `confidenceMap`, discards fragments with `depth < 1.0f` in its fragment shader, and uses `MPSImageGuidedFilter` to upsample the depth. It builds a view matrix as projection * rotation * translation * orientation (sample-specific).
- "Creating a fog effect using scene depth" is linked from the page and was not read.

## Not found

- Any Expo doc line on SDK 58-specific changes to local modules.
- A docs paragraph on absent-safe modules for web and Android (only the pieces in section 2).
- Depth map pixel size on any Apple page; the scaling rule between depth and image resolution; whether the sample scales intrinsics in Swift.
- Direct Apple pages that 404'd: `arcamera/unprojectpoint(...)`, `arcamera/projectionmatrix(for:viewportsize:znear:zfar:)`, `arworldtrackingconfiguration/supportsframesemantics(_:)`, `arconfiguration/framesemantics` (struct root), `uikit/uirequireddevicecapabilities`, `arsessionobserver/session(_:didupdate:)-2`.
- A `lidar` string in UIRequiredDeviceCapabilities; an Expo config key for required capabilities; the numeric `ARConfidenceLevel` raw values; the names of the orientation-independent ARCamera and ARFrame variants (iOS 27 era).
- Expo's prebuild default for `UIRequiredDeviceCapabilities`.
- Pages fetched but not read in detail: `arcamera` and `arframe/smoothedscenedepth` (only `smoothedSceneDepth` text from the FrameSemantics page is used).

## Sources fetched

Expo (all 2026-11-15, `.md` variants):
- https://docs.expo.dev/modules/get-started.md
- https://docs.expo.dev/more/create-expo-module.md
- https://docs.expo.dev/modules/autolinking.md
- https://docs.expo.dev/modules/module-config.md
- https://docs.expo.dev/modules/module-api.md
- https://docs.expo.dev/modules/native-view-tutorial.md
- https://docs.expo.dev/guides/local-app-development.md
- https://docs.expo.dev/versions/latest/sdk/expo.md
- https://docs.expo.dev/versions/latest/sdk/camera.md
- https://docs.expo.dev/versions/latest/config/app.md
- https://registry.npmjs.org/expo-module-template-local/-/expo-module-template-local-0.7.10.tgz

Apple:
- https://developer.apple.com/documentation/arkit/arconfiguration/supportsframesemantics(_:).md
- https://developer.apple.com/documentation/arkit/ardepthdata.md and its `depthmap`, `confidencemap` pages
- https://developer.apple.com/documentation/arkit/arconfidencelevel.md
- https://developer.apple.com/documentation/arkit/arcamera.md (intrinsics, imageResolution)
- https://developer.apple.com/documentation/arkit/arframe.md (sceneDepth, capturedImage, raycastQuery)
- https://developer.apple.com/documentation/arkit/arsession.md (raycast)
- https://developer.apple.com/documentation/arkit/arsessiondelegate.md and `.../arsessiondelegate/session(_:didupdate:)-9v2kw.md`
- https://developer.apple.com/documentation/arkit/displaying-a-point-cloud-using-scene-depth.md
- https://developer.apple.com/documentation/updates/arkit.md
- https://developer.apple.com/documentation/bundleresources/information-property-list/nscamerausagedescription.md
- https://developer.apple.com/documentation/bundleresources/information-property-list/uirequireddevicecapabilities.md
- https://developer.apple.com/support/required-device-capabilities/
