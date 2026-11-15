# app/

The secondhand app: Expo (SDK 58) with Expo Router, linked to the EAS project `secondhand`. One command runs all of its checks (types and tests):

```bash
npm run check
```

## Run it

1. Copy `.env.example` to `.env.local` and fill in the workspace address and the SQL warehouse id. Git ignores `.env.local`.
2. Sign in once with the Databricks CLI (`databricks auth login --host <workspace address>`). No token is written to a file: on a laptop the server routes ask the CLI for one.
3. Put the brand font files in `fonts/` at the repo root (or set `SECONDHAND_FONTS` to the folder that holds them). They are licensed and never committed. `npm start`, `npm run ios` and `npm run android` copy them into `assets/fonts/` first (`../scripts/fonts.mjs`); `npm run fonts` fails when one is missing. Without them the phone draws in San Francisco and looks nothing like the mocks.
4. `npm start`, then open the app in Expo Go, a simulator or the browser.

The first screen is a development placeholder. It calls `GET /v1/health` and shows whether Databricks answered.

## How it reaches Databricks

A Databricks App accepts only Databricks sign-in, so a phone cannot call one directly ([spec/product.md, section 6](../spec/product.md#6-systems)). The routes under `src/app/v1/` are the thin public edge that section proposes: they run on the server (Expo Router API routes, served by `expo start` in development), hold the workspace identity, and the app only ever calls them.

| File | What it is |
|---|---|
| `src/app/v1/health+api.ts` | `GET /v1/health`: runs one query on the SQL warehouse and answers `{ok, state, catalog, at}` |
| `src/edge/databricks.ts` | server only: gets a token and calls the workspace; every call goes through the shared logger in [log/](../log/README.md) |
| `src/health.ts` | the shape of the answer and its parser, shared by the route and the screen; tested in `src/health.test.ts` |

## On an iPhone

Two ways, both from a Mac checkout (November 15, 2026, Ben's iPhone 17 Pro, Xcode 26.3).

- **Expo Go, needs the Mac running.** `npx expo start --tunnel` (Node 22.13 or later), then scan the QR code with the iPhone Camera. A screen opens directly at `exp://<tunnel host>/--/item/it_stage/post?world=stage&flip=poshmark,mercari,facebook`.
- **Its own app, runs without the Mac.** A Release device build signed with Ben's free Apple team `P522C656U3` (profiles last 7 days, at most 3 developer apps on the phone at once):
  1. `npx expo prebuild --platform ios` with `ios.bundleIdentifier` set to `dev.ben.secondhand` for that run only. `ios/` is git-ignored. Undo the edits prebuild makes to `app.json` and the `ios`/`android` scripts in `package.json`.
  2. On Xcode 26.3, `node_modules/expo-modules-jsi/apple/Sources/ExpoModulesJSI/Runtime/Values/JavaScriptObject.swift` fails with "sending 'slot' risks causing data races" (line 946). Pass the pointer into the `JavaScriptActor.assumeIsolated` closure as `UInt(bitPattern: slot)` and rebuild it inside. Setting the package to Swift 5 mode breaks other files. A fresh `npm ci` undoes the patch.
  3. `xcodebuild -workspace ios/secondhand.xcworkspace -scheme secondhand -configuration Release -destination 'id=<device UDID>' -allowProvisioningUpdates DEVELOPMENT_TEAM=P522C656U3 CODE_SIGN_STYLE=Automatic build`
  4. `xcrun devicectl device install app --device <id> <secondhand.app>`. The first launch needs Settings → General → VPN & Device Management → Trust. Deep links use `secondhand://`.

### Keep the phone current

Run `node scripts/phone-loop.mjs --watch --now` from the repo on your Mac.
It builds current `origin/main` now, then watches for app changes every 60 seconds.
Later builds wait until pushes have stopped for 180 seconds.
The loop owns `~/secondhand-phone`; `--dir <path>` chooses another private clone.
It resets that clone, installs the Release app, captures screens and checks them.
If the phone is unavailable, it uses the simulator; connection failures get one retry.
Captures, checks, crash reports and logs go to `~/secondhand-phone-results/`; `latest` links to the last cycle.
Use `--once` (the default) to wait for one update, or `--now` to build once immediately.

## Not done yet

- Deployed edge: nothing is hosted. Builds use Nate's Expo account. The routes go on Databricks if possible, otherwise on Next.js beside the site; since a Databricks App accepts only Databricks sign-in, the Next.js site can be the edge in front of it either way, and the second workspace probe settles it ([Nate](../product/words.md#2026-11-14-nate-sale-emails-the-expo-account-where-routes-are-hosted-and-a-buy-page-shaped-by-your-style); *agent proposal*). A deployed edge needs `DATABRICKS_TOKEN` (a service identity) in its host's secrets and `origin` set for the `expo-router` plugin in `app.json`.
- The Databricks App and Lakebase behind the edge do not exist yet; `/v1/health` talks to the SQL warehouse directly.
- Full screen-state logging from [log/README.md](../log/README.md#wire-a-new-program) is not wired. Existing shared-log events and crash recording are persisted on the device.
- Checked in a browser against a real workspace. Run on an iPhone (see above). No EAS build has been made.
- Screens, tokens and the Swift camera module are Ben's side; none are here.

## Crashes

Open `secondhand://dev/crashes` to read recorded errors and breadcrumbs.
Run `node scripts/phone-crashes.mjs <device-id>` to collect phone and native reports.
See [log/README.md](../log/README.md#crashes) for storage, uploads and limitations.
