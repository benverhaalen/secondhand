# Review: the phone app (app/) and its capture flow, main as of 2026-11-15

Scope: area review of C:\dev\secondhand\app, not a diff. Read-only. Axis: structure, wiring, correctness. No visual-taste findings.
Docs evidence (fetched 2026-11-15 by a retriever, quotes and URLs): scratchpad/docs-evidence.md

Commands run
- `npx tsc --noEmit` in app/: exit 0, no output. The lead saw 2 errors in new.tsx. tsconfig includes the git-ignored generated typed-route types, so the result depends on whether `expo start` has generated them. A clean CI checkout can differ. Treat the typecheck as environment-dependent.
- No test, server, simulator, build or EAS command was run.

Verdict: fix first. As a design shell it is sound. It cannot talk to a server from a phone today, and three links go nowhere. Everything under section 1.A is by design not wired yet; section 1.B is faults that exist regardless of wiring.

---

## 1. Client bugs and structural faults, ranked

### A. Blocks any device build that talks to a server

A1. No API client, no base URL, no token store. Every `fetch` in the screens is a relative URL, which works only on web.
- app/src/app/dev/health.tsx:9 `fetch('/v1/health').then(r => r.json())` has no `r.ok` check and no base.
- app/src/app/want.tsx:55 `fetch('/v1/stage', { cache: 'no-store' })` is relative and sends no Authorization header.
- The one place that already reads an origin is ../log/native.js (`process.env.EXPO_PUBLIC_API_URL`), for crash upload. The app's own code never uses it.
- Failure: on an iPhone, `fetch('/v1/health')` rejects (invalid URL). Health shows nothing; want's live mode never leaves its first frame.
- Smallest fix: one `api.ts` (section 2).

A2. Crash upload targets a path that is not in the app's server. ../log/crash.js:39 posts to `${url}/api/log`. The receiver is ../log/receive.mjs:11 (path `/api/log`, a separate node receiver), and the app's routes are all under /v1 (src/app/v1/**). Nothing under src/app/api exists. Failure: crashes recorded on device stay queued in the file and never upload unless that receiver runs behind the same origin. Fix: either serve `/api/log` from the same host, or point the recorder at a dedicated origin env var.

A3. Capture is a rehearsal. src/app/camera.tsx:
- :131 `lens.current?.takePictureAsync({ skipProcessing: true })` discards the result. Per Expo docs `skipProcessing` "does not respect EXIF orientation" and may give wrong-orientation images (https://docs.expo.dev/versions/latest/sdk/camera/). When the file is kept it will be sideways on some devices. Drop `skipProcessing` or keep it and rotate by EXIF.
- :135 `judge.current = setTimeout(...)` stands in for a judging job; facts come from the demo table (`step.finds.filter(scannedBy(lidar))`, :58).
- :158-159 the library path `launchImageLibraryAsync({ allowsMultipleSelection: true })` then `router.replace('/sell')`: the picked `r.assets` are dropped.
- :73 `const lidar = params.lidar !== '0'`: LiDAR is a URL flag, never a device check. On a non-LiDAR phone the flow claims measured sizes it cannot take.
- The offline queue and `online` are demo state (`drawn !== 'offline'`), not NetInfo, and the queue is not persisted. App killed while "Waiting for signal" loses the photos.
- Failure scenario: a person shoots 6 photos on a plane; nothing was saved or queued; the item page shows demo facts.

### B. Faults that exist without wiring

B1. Three dead routes, hidden by `as Href` casts, so typedRoutes cannot catch them.
- app/src/app/(tabs)/index.tsx:283 `go('/you/automation')`
- app/src/app/(tabs)/sell.tsx:243 `router.push('/you/pause' as Href)`
- app/src/app/messages/index.tsx:112 `router.push('/you/messages' as Href)`
- src/you/state.ts:59-70 PAGES has payouts, insights, records, connections, rules, log, notifications, defaults, permissions, settings. The three targets are absent, so they land on the "Not found" view at src/app/you/[page].tsx:19-27, which has no exit but the system back.
- Fix: add the pages or point the links at existing ones; remove the casts so `tsc` fails on the next dead link. app/src/app/new.tsx:47,55 and camera.tsx:237,261 carry the same casts. `camera.tsx:261` also builds `/item/${held?.id ?? ''}` which resolves to `/item/` when `held` is null.

B2. Persistence that silently does nothing on iOS. src/app/(tabs)/sell.tsx:41,46 `globalThis.localStorage?.getItem/setItem` inside try/catch. On native `localStorage` is undefined, so the optional chaining no-ops and the person's folded shelves reset every launch. Fix: `@react-native-async-storage/async-storage` or expo-sqlite `kv-store`; keep localStorage branch for web.

B3. No `+not-found`, no per-route `ErrorBoundary`. `ls src/app/+not-found.tsx` fails. Expo Router docs: "Native apps don't have a server so there are technically no 404s... you can also customize it", and a route can "export a nested ErrorBoundary" (https://docs.expo.dev/router/error-handling/). The only crash UI is the root CrashBoundary (src/log/boundary.tsx): a bare "Something went wrong" with a Try again that resets state and re-renders the same tree, so a deterministic render error loops. Fix: add `+not-found.tsx` with a way home; export `ErrorBoundary` from camera and the item page; make Try again navigate home after a second failure.

B4. Un-virtualized lists. grep finds no FlatList, FlashList or SectionList in src. src/ui/layout.tsx:44 renders every screen as one ScrollView over `Children.toArray(children)`. Sell shelves, messages, records and activity will mount every row. With demo worlds (flipper = dense) it is acceptable; with a real account of hundreds of items on a phone it janks and memory grows. Fix: FlashList (or FlatList) for the shelf, messages and records bodies once the data is live; leave short screens alone. React Compiler does not change this.

B5. Keyboard handling is thin. KeyboardAvoidingView appears only in ui/chips.tsx and ui/loop.tsx. The ScrollView has no `keyboardShouldPersistTaps` or `automaticallyAdjustKeyboardInsets`. Fields in the new and want sheets and camera chips can sit under the keyboard, and a tap with the keyboard open is eaten first. Not exercised here; confirm on a device or simulator.

B6. Dev screens ship in production. src/app/dev/health.tsx, crashes.tsx and parts.tsx have no `__DEV__` guard (grep for `__DEV__` under src/app/dev: none). `ui/log.ts` hardcodes `build: 'dev'`, so every TestFlight log says dev. Fix: guard or `Redirect` when `!__DEV__`; set build from `Constants` or an env var.

B7. src/you/records.tsx:24 CSV export is web-only (`document.createElement('a')`, `URL.createObjectURL`). On native it sets `saved` and logs, so the screen says "Downloaded" when nothing happened. Fix: expo-file-system plus expo-sharing on native, or hide the control.

B8. expo-file-system is imported by src/log/boundary.tsx (`import { File, Paths } from 'expo-file-system'`) but not declared in app/package.json; it is present only as a transitive dependency of expo. Declare it with `npx expo install expo-file-system`, or a lockfile change can drop it.

B9. src/app/_layout.tsx returns null until fonts load: a blank frame on launch with no splash hold. Fix: keep the splash up (`expo-splash-screen` is already a plugin) until fonts are ready.

B10. Minor accessibility: src/ui/parts/overlays.tsx:27 the sheet scrim is a View with `accessibilityRole="button"` and `onStartShouldSetResponder`, not a Pressable, so it has no focus state and no hit-test guarantees; a Press would match the rest of the app.

Not findings: tab bar uses `expo-router/js-tabs` with a custom bar (consistent with Press and the web build); lists of tabs behave. `Press` already gives 44-pt slop, role and label.

---

## 2. The wiring plan

Order: foundation first, then the screens that read, then the ones that write.

1. `src/api/client.ts` (new, one file): `base = process.env.EXPO_PUBLIC_API_URL` (dot notation, or Expo will not inline it: https://docs.expo.dev/guides/environment-variables/), `request(path, init)` that adds `Authorization: Bearer`, parses the response with the contract's zod shape (house rule: parse at the boundary), maps the server error shape, sends an Idempotency-Key on writes (http.ts supports idempotency keys), and on 401 takes one refresh (edge/auth.ts: refresh is one-use, so serialize concurrent refreshes with a single in-flight promise or a second caller will 401 and drop the family).
2. Tokens: expo-secure-store (https://docs.expo.dev/versions/latest/sdk/securestore/), "Included in Expo Go", Keychain generic password. Store the refresh token there; hold access in memory. Use `keychainAccessible: AFTER_FIRST_UNLOCK` if background upload is wanted; default is WHEN_UNLOCKED. Values persist across reinstall with the same bundle ID, so clear on first launch after install or on sign-out. Expo does not enforce a size limit; tokens are small.
3. Data layer: keep `useScreen()` (src/demo/screen.ts) as the fallback. Add `useData(name)` beside it that returns `{ w, state }` in the same shape: when `?world=` or `?state=` is present, or no session exists, return the demo world as today; otherwise read the server (TanStack Query is the usual choice; a hand-rolled `useSyncExternalStore` cache is the smaller one). Screens change one import. States loading, failed and offline already exist in `SCREEN_STATES` and are drawn by every page, so a real fetch only has to set them. Demo worlds and app-check keep passing because the URL flag still wins.
4. Offline: add `@react-native-community/netinfo` (or expo-network) and replace `drawn !== 'offline'` in camera.tsx with the real state; persist the capture queue (files in `Paths.document` via expo-file-system plus a JSON index).
5. Event stream. Expo's docs show `expo/fetch` streaming: "`expo/fetch` streams response bodies through `response.body.getReader()`", with an `Accept: text/event-stream` example, and on iOS and Android it is the global `fetch` (https://docs.expo.dev/versions/latest/sdk/expo/). TextDecoder is built into Hermes from SDK 58 and RN 0.88, and the global ReadableStream is "available on all platforms". A global `EventSource` is not documented in Expo or React Native, so do not rely on it. The server stream (src/edge/api/jobs.ts:128,152) emits `text/event-stream` with integer ids and honours `Last-Event-ID`, so a 30-line reader (`getReader`, `TextDecoder`, split on blank line, remember last id, reconnect with the header) is enough. This also lets you send the Authorization header, which a browser EventSource cannot. Note route registration at src/app/v1/jobs/[id]/events+api.ts uses `auth: 'visitor'`: confirm the job id is the only secret before you rely on it from a phone.
6. Screens in order: sign-in (edge/auth.ts) and `/v1/me`; today and items (reads); search (POST /v1/search then /v1/jobs/:id/events); item page and decisions; the camera flow last because it needs the native module and uploads; messages, orders, records, rules after.
7. Config: put `EXPO_PUBLIC_API_URL` in `eas.json` per profile (`build.<profile>.env`; docs say the key is for values you "would commit to your git repository", which a public base URL is: https://docs.expo.dev/eas/json/). It is inlined at build time and visible in plain text in the app. The docs example uses a non-public name, so verify with one dev build that the inlined value arrives.

The founders' rule (monitor and guide, never post for the person) leaves the data layer unchanged; posting stays a handoff screen with no write call.

---

## 3. Capture and measurement

What it takes to make the camera real (server side is largely there: src/edge/api/captures.ts has POST /v1/captures, GET and PATCH :id, POST :id/photos, POST :id/finish, POST :id/talk):
1. POST /v1/captures at flow start; PATCH when the mode changes.
2. Per shot: POST /v1/captures/:id/photos with `{role, step, content_type (heic|jpeg|png), bytes, key?, reads?, scan?, depth_ref?, pose_ref?}`. The reply carries an `upload` object. Today it is an example URL (captures.ts:342 reads `example('captures.photos')`; `uploads.example`), and :341 says `depth_ref and pose_ref are validated but not stored`. So the upload target, the byte PUT and photo storage are not built on the server. Needs a real signed URL before the phone can send bytes.
3. Phone PUTs the file to that URL (expo-file-system `File`, or `fetch` with the file as body), retries from the persisted queue, then marks the photo uploaded.
4. Judging: replace camera.tsx:135 `setTimeout` with the job stream (section 2.5); the stage text and finds come from frames.
5. POST :id/finish, then route to the item (guard `held?.id`).

LiDAR measurement of one household item or garment. The server already takes a `scan` per photo: tests show `{scan_ok, extent_cm:{width,depth,height}, extent_conf, frames}` (captures.test.ts:1132); `scan_ok:false` sets `object_capture=false`. The native module's output should be exactly that shape.

| | ARKit scene depth | RoomPlan | Object Capture |
|---|---|---|---|
| API | `ARWorldTrackingConfiguration` with `frameSemantics = .sceneDepth`; `ARDepthData` in meters per pixel | `RoomCaptureSession` | `ObjectCaptureSession` + `ObjectCaptureView`, `PhotogrammetrySession` |
| iOS | 14+ | 16+ | 17+ (on-device processing) |
| Device | LiDAR only (check `supportsFrameSemantics`) | LiDAR only (`isSupported`) | LiDAR devices (WWDC23 says iPhone 12 Pro and later) |
| Output | depth map plus camera pose per frame; you compute the extent | room walls, doors, furniture boxes | USDZ model; `Request.bounds` "returns a box the same size as the created model" |
| Fit for one item | yes, quick | no: scoped to "an interior room" | yes for rigid 3D items; slow (a capture orbit plus processing) |
| Expo | local Expo module (`npx create-expo-module@latest --local`) | same | same |
| Expo Go | no | no | no |

Sources: ARKit https://developer.apple.com/documentation/arkit/arconfiguration/framesemantics-swift.struct/scenedepth ("ARKit supports scene depth only on LiDAR-capable devices") and https://developer.apple.com/documentation/arkit/ardepthdata; RoomPlan https://developer.apple.com/documentation/roomplan/roomcapturesession and https://developer.apple.com/documentation/roomplan; Object Capture https://developer.apple.com/documentation/realitykit/objectcapturesession, https://developer.apple.com/documentation/realitykit/photogrammetrysession, https://developer.apple.com/documentation/realitykit/creating-3d-objects-from-photographs, https://developer.apple.com/videos/play/wwdc2023/10191/. Expo: dev builds https://docs.expo.dev/develop/development-builds/introduction/, Expo Go limits https://docs.expo.dev/develop/development-builds/faq/ ("comes with a fixed set of native libraries built in"), local module https://docs.expo.dev/more/create-expo-module/. Not confirmed in the docs I could fetch: an Apple device list for scene depth, a room-size limit for RoomPlan, and an object size range for Object Capture.

Straight answer, my judgment: build ARKit scene depth first. It is the only one of the three that returns a measurement in seconds, it is one small module (an AR session, a depth read and a raycast), and a flat-laid garment or a boxed item is measured by the person tapping two edges or the module fitting a box to the segmented depth region. Output goes straight into `extent_cm`. RoomPlan is the wrong tool and should not be built. Object Capture is a second module for rigid 3D goods (shoes, small appliances) where a size from a model is wanted; it asks for a slow orbit and a processing step, and soft garments are a poor fit for photogrammetry (my expectation, not an Apple statement). Both need a development build, a LiDAR iPhone, and `NSCameraUsageDescription` (already set by the expo-camera plugin). Before building, test depth accuracy on five real items against a tape; set `extent_conf` from that, because the contract has a confidence field and a low value is the honest output. The module must also report `supportsFrameSemantics == false` so camera.tsx:73 can replace the URL flag with a real check. The founders' order is LiDAR before TestFlight; since the module forces a development client anyway, `expo-dev-client` is added in the same step.

---

## 4. TestFlight readiness (no EAS command run)

Present and fine: bundleIdentifier com.bnvg.secondhand; eas.projectId; `ios.config.usesNonExemptEncryption: false`. That placement is the documented one (https://docs.expo.dev/versions/latest/config/app/: it "sets `ITSAppUsesNonExemptEncryption` in the standalone ipa's Info.plist"); I first suspected it was wrong and it is not. Camera permission string via the expo-camera plugin; `supportsTablet: false`; `appVersionSource: remote` with production `autoIncrement`.

Gaps:
1. `expo-dev-client` is not in package.json, but eas.json `development` sets `developmentClient: true`; docs: "the project must have `expo-dev-client` installed and configured" (https://docs.expo.dev/eas/json/). That profile will not produce a working client. Required for the LiDAR module anyway.
2. `submit.production` is `{}`: no `ascAppId`. Needed for non-interactive `eas submit`.
3. No `env` in any eas.json profile: no `EXPO_PUBLIC_API_URL`, so a device build has no server (section 2.7). The app config uses `web.output: "server"` and +api routes, so an API host must exist and be reachable over HTTPS (App Transport Security blocks plain http on a device).
4. No `ios.privacyManifests`. Expo documents the key (https://docs.expo.dev/guides/apple-privacy/) and says required-reason APIs "include accessing UserDefaults, file timestamp, system boot time, disk space, and active keyboard" and that Apple "does not correctly parse all the PrivacyInfo files included by static CocoaPods dependencies". The app writes files (expo-file-system, crash store) and will add AsyncStorage/SecureStore, so declare file-timestamp and UserDefaults reasons; Apple emails if one is missing. Expo's exact category list for a typical app was not confirmed; follow the email or check the first upload.
5. expo-image-picker plugin sets only `photosPermission`. If it is used for the camera as well, add `cameraPermission`; if photos are ever saved back, add `NSPhotoLibraryAddUsageDescription`. expo-camera `recordAudioAndroid: false` is Android; no microphone string is needed if audio is never requested.
6. Native modules to declare: expo-secure-store, expo-file-system, netinfo, the LiDAR module (needs ARKit; do not add `UIRequiredDeviceCapabilities: arkit` globally or non-LiDAR phones lose the app; check at runtime).
7. No `ios.buildNumber` (remote versioning covers it) and no `runtimeVersion`/`updates` config; fine for a first internal build, needed before OTA.
8. Icon `./assets/expo.icon` is an Icon Composer bundle (assets/expo.icon/icon.json present); confirm it is the product icon and not the template one. `icon.png` fallback also.
9. Associated domains and the `secondhand` scheme: the scheme exists; if sign-in by email link is used (v1/auth/link), universal links need `ios.associatedDomains` and an apple-app-site-association file on the API host.
10. Apple sign-in is dropped by decision; confirm the app has no Sign in with Apple entitlement and that Google or email sign-in alone meets App Store guideline 4.8 for third-party login (offering email or an equivalent privacy-preserving login is the usual way). Decision is the founders'; flagged, not decided.
11. Add `@types`-level check: `npx expo-doctor` before the first build (not run).

---

## 5. What can be tested with nobody present

On the Mac (or CI), no phone:
- Web export plus Playwright: `npx expo export --platform web`, then `node scripts/app-check.mjs --dark --sheet` and `node --test "app/e2e/*.test.mjs"` (CI does exactly this at .github/workflows/check.yml:67-72). Covers navigation, states (`?state=`, `?world=`), copy, layout, Press behavior and the logs. It cannot see native-only code: safe areas, haptics, keyboard, the camera, file paths, SecureStore.
- Unit: `node .agents/check.mjs` (src/**/*.test.ts, engines and edge). Server contract tests (captures, auth, jobs) run in node.
- iOS simulator: Maestro flows (app/e2e/maestro, 18) and app/e2e/native (project.yml, Tests/, run.mjs) can drive a simulator build (`preview-sim` profile) for navigation, keyboard overlap, the dead-route links, the sell persistence fix and token storage. The simulator has no LiDAR and a fake camera, so the camera, depth and Object Capture cannot be exercised there.
- Add a Playwright or Maestro check that every `router.push/replace` target resolves (a route-table test; the dead links in B1 would have failed it). app/e2e/native/routes.test.mjs exists; confirm whether it covers `as Href` targets.

Needs a person with a LiDAR iPhone: real camera orientation and file output, scene-depth accuracy against a tape, Object Capture, upload on cellular and the offline queue under airplane mode, permission prompts wording, keyboard and safe areas on a real notch, haptics, TestFlight install and push.

---

## 6. Solid, leave alone

- ui/press.tsx: 44-pt hit slop, role, label, focus ring, press-retention, reduced motion, tap logging.
- The crash recorder design (../log/native.js, ../log/crash.js): global ErrorUtils handler, Hermes rejection tracker, file persistence, acknowledged upload. Only its endpoint (A2) needs attention.
- The demo worlds, `useScreen()` and the eight screen states: they are the test fixture and the loading/failed/offline UI; keep them as the fallback.
- engines/capture and the captures contract with its tests (captures.test.ts), and the typed `isHealth` guard that parses at the boundary.
- Timer cleanup in camera.tsx and want.tsx (stop flag, clearTimeout), haptics guarded to non-web, expo-image with alt text, the camera parts' labels, live regions and progress roles.

## Out of scope and pre-existing
- Out of scope: visual design, the two embargoed files, EAS commands, server hardening beyond the points above.
- Pre-existing: all findings above exist on main. The typecheck result (0 here, 2 reported by the lead) is environment-dependent, not a regression I can attribute.
