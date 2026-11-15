# 96: the app's native walks, at Nate's stop

Updated: November 15, 2026, about 14:25 UTC. Owner: Nate. Agent: Claude Code, the native-walks lead (Opus 5.5), started by the orchestrator. Stopped on Nate's word: "watch the testing, lets stop for now or halt at a good point".

## What is true on main

| What | Commit | Proof |
|---|---|---|
| The app builds in Release for the iOS simulator and installs, from one command on the Mac: `zsh scripts/ios-sim.sh <worktree name> [api origin]` | 1efd2b40 | built and walked at 79503d33 on glados (iPhone 17 Pro, iOS 26.4) |
| A driver and nine walks in [app/e2e/sim](../../../../app/e2e/sim/README.md): idb taps by `testID`, a screenshot and accessibility tree per step, the timings | 1efd2b40 | every walk ran to the end at 79503d33 + 66302138 |
| `/shop` opens with its bar ready to type on iOS (it blurred back into a button during the push) | 34536298, merged 66302138 | walk `b-search`, no second tap; a red-then-green check by the worker |
| The walk table, the timings and how they were taken, with an owner on every failing row | a59e79a3, d76d3c68, and the commit after this packet | [finalization §6](../../../../spec/plans/finalization.md#the-native-walks-2026-11-15-the-apps-native-walks-lead) |
| Nate's two instructions, verbatim | 6211c819 | [words](../../../../product/words.md#2026-11-15-nate-systems-working-before-the-look) |

Decided: `app/ios/` stays generated and git-ignored (`app/.gitignore:42`, `app/README.md:34`); `app.json` and its plugins are the source.

## The Mac (glados), as left

- Simulator device `sh-walk-17pro`, booted, its id in `/tmp/sh-sim-udid`. The app installed is the Release build of `w/app-sim-2` (79503d33 plus the `/shop` fix), pointed at `http://localhost:8790`.
- The walk server is running from `~/dev/projects/secondhand-wt/app-sim-2`: pid in `/tmp/sh-walk-server.pid`, log `/tmp/sh-walk-server.log`, scratch data `/tmp/sh-walk-data`, dev code in `/tmp/sh-walk-devcode` (a development code, never a key). Stop it with `kill $(cat /tmp/sh-walk-server.pid)`.
- `idb_companion` is running against the shim in `~/xcode-shim` (gRPC port 10882). Installed today: Maestro 2.12.1 (brew, mobile-dev-inc tap; unusable until Xcode's first launch is finished), fb-idb reinstalled on Python 3.12.
- Xcode 27.2's first-launch packages are missing (CoreSimulator 1051 against 1174), so `xcodebuild` cannot target a simulator device. The build avoids it with the generic destination. `sudo xcodebuild -runFirstLaunch` (an admin password, Nate's) fixes it for good and lets Maestro run.
- Worktrees: `app-sim-1` (the first build at 8f878066, stale: remove), `app-sim-2` (the build in use; `app/package.json` there is edited by prebuild, never commit it), `app-sim-tools` (merged), `app-fix-2` (merged), `app-e2e-1` (the web e2e run below), and `app-fix-1`: **parked, not merged**. It fixed the old sign-in's field commit, keyboard and sign-out, and Ben's ac133f38 replaced that whole screen first; its one still-valid change (a `Blank` passes each keystroke up) has no failing walk behind it.
- Screenshots and reports: `~/sh-walks/` (run1 at 8f878066; run2*, run3 at 79503d33; `timing-0803`, `timing-0806`; `review/` with the Codex reviewer's REVIEW.md).

## Running at the stop

- The web e2e suites at 5d06fbe0 in `app-e2e-1`: `node --test "app/e2e/*.test.mjs"`, output `/tmp/app-e2e-1.out`, summary in `/tmp/app-e2e-1.log` when it ends. Interim at 14:20 UTC: 787 pass, 114 fail, most of the failures in Buy, Sell and New, whose demo-world tables Ben's ac133f38 replaced. Read the final counts and split them into stale tests (Ben's tables) and real faults before trusting either number.

## Failing systems, each with its owner (told by message)

1. The chat: `POST /v1/assist` is an example handler and answers 404 to every real person. Engines lead, packet 70's first item (`brief-eng-assist-route-1` is out).
2. Capture stops after the first photo: "Photo uploads are not connected yet" (`/v1/captures` 201, `/photos` 201). Capture lead and server lead (Blobs). Also: the picker hands the app photos with their location; check GPS is stripped before upload.
3. eBay and Depop answer `no_route` on a server with no browser. With the Mac's Chrome both answered `blocked`, so local reads stopped for good. They answer only through hosted Browser Use. Search lead.
4. Connect: the live sign-in window (Ben's `account/services.tsx`, `edge/connect/hosted.ts`) needs `BROWSER_USE_API_KEY` on the hosted server. Nate.
5. A recovered `sweep` job fails `no_engine: sweep` at every server start (`edge/events/pipeline.ts:257`, job `job_sw1`). Server lead: found by the Codex audit, not yet sent.
6. Search quality: Dupe rows open dupe.com's redirect page, and a lookalike can rank in the first rows. Search lead.

## Next, in order

1. When the server lead names the hosted address: `zsh scripts/ios-sim.sh app-sim-hosted https://<host>`, then the walks with `zsh app/e2e/sim/walk.sh`. Sign-in there needs an email sender (`RESEND_API_KEY`, Nate's) or a development code on that host, which is Nate's call. Then the connect walk: Link, the live window, 2FA inside it, `complete`.
2. Rerun walk B's chat (tap `shop-ask-why`, type a follow-up) when the assist route lands, and walk F when uploads land.
3. Ben's look findings from the screenshots are with the orchestrator and wait, on Nate's word ("dont focus on ui as much...").

## Learned the hard way

- Read `origin/main` before building: Ben's ac133f38 landed while the first build ran, and a worker brief was written against screens that no longer existed.
- `idb ui text` with a whole string drops keys in a controlled field; type one key at a time. A label match by substring found "Don't Allow" for "Allow": match system buttons exactly.
- A walk server restart wipes its data, so the phone is signed out after. That is right, and it looks like a failure.
- The server log writes each request twice (`server.http` and `edge.api`); count one source.
