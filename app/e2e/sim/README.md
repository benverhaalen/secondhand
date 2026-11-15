# app/e2e/sim: whole user paths on the iOS simulator

A person's walk through the real app, built in Release on the Mac and run against `node server/main.ts`. Every step taps by `testID` (React Native's `accessibilityIdentifier`), waits on what the screen says, and keeps a screenshot with the accessibility tree beside it. A walk passes when a person has looked at its screenshots, not only when the driver exits 0.

## Once per Mac

- Xcode with an iOS simulator runtime, and a device for the walks:
  `xcrun simctl create sh-walk-17pro com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro com.apple.CoreSimulator.SimRuntime.iOS-26-4 > /tmp/sh-sim-udid && xcrun simctl boot $(cat /tmp/sh-sim-udid)`
- `idb` for taps, typing and the accessibility tree: `brew install facebook/fb/idb-companion` and `pipx install fb-idb --python python3.12` (fb-idb fails on Python 3.14: "There is no current event loop").
- Xcode 27 moved `SimulatorKit.framework` to `Contents/SharedFrameworks`, where `idb_companion` does not look. Until idb catches up, run the companion against a shadow developer folder: `zsh app/e2e/sim/companion.sh` (leave it running). It prints the gRPC port and keeps running; `idb connect localhost <port>` once.
- On glados (2026-11-15), Xcode 27.2's first-launch packages were not installed (CoreSimulator 1051 against 1174), so `xcodebuild` cannot target a simulator device and `expo run:ios` and Maestro both fail with "Unable to find a device". The build below avoids that by building for the generic simulator destination and installing with `simctl`. `sudo xcodebuild -runFirstLaunch` fixes it for good, and that needs an admin password.

## Build and run

```bash
zsh scripts/ios-sim.sh <worktree name> [api origin]
```

This cuts a worktree at `origin/main` (if it is missing), runs `npm ci`, `expo prebuild`, `pod install` and a Release `xcodebuild` for the simulator with `EXPO_PUBLIC_API_ORIGIN` baked in (default `http://localhost:8790`), then installs the app on the walk device. `app/ios/` is generated and git-ignored, never committed: `app.json` and its plugins are the source.

The server for the walks is `node server/main.ts` with `NODE_ENV=development` (otherwise it asks for the production keys), a scratch `SECONDHAND_DATA_DIR`, `SECONDHAND_DEV_CODE` and `PORT=8790`; `server.sh` starts it so. Restarting it wipes its data, so the phone is signed out after: run `a-first-open` again. `rebuild.sh` rebuilds a worktree after an edit in about 25 s.

```bash
zsh app/e2e/sim/server.sh <worktree name>
zsh app/e2e/sim/walk.sh ~/sh-walks/run1 allow a-first-open a2-finish-onboarding b-search c-tabs d-kill-reopen f-sell-capture e-signout-in
zsh app/e2e/sim/timing.sh
```

| Walk | Path |
|---|---|
| `a-first-open.json`, then `a2-finish-onboarding.json` | A fresh install, sign-in by email code, connect services (Link on eBay), first photo step, Today |
| `b-search.json` (`Q=`) | Buy, the search field, `/shop`, the reach view, settled results, the chat, a listing |
| `c-tabs.json` | Today, Sell, Buy, You, Settings, New, signed in |
| `d-kill-reopen.json` | The app killed and reopened: it opens signed in |
| `e-signout-in.json` | Sign out, still out after a relaunch, sign in again |
| `f-sell-capture.json` | New, Sell, the camera (the simulator has none), Choose photos |

The driver's steps are documented at the top of `drive.mjs`. A failing step writes `FAIL-<n>.png` and `.json`; `report.json` holds every step's time and the marks a timing is read from.

## Timings

Read from `report.json` marks. `first_screen - launch` is cold start: `simctl launch` until the first screen's element is in the accessibility tree. `first_frame - tap_search` and `settled - tap_search` time a search from the Return key to the first source on screen, and to the settled answer ("for sale now"). The tree is read by polling `idb ui describe-all`, which takes about 250 to 300 ms a read, so each number is accurate to about 0.3 s.
