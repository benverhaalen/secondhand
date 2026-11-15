# 96: the app's native walks, halted

Updated: November 15, 2026, about 14:40 UTC. Owner: Nate. Agent: Claude Code, the native-walks lead (Opus 5.5), started by the orchestrator. Halted on Nate's words: "watch the testing, lets stop for now or halt at a good point", then, through the orchestrator, "we need to stop agents from merging and working on top of eachother". Nothing of mine is staged or open in `C:\dev\secondhand`. From now on only the orchestrator merges to main.

## On main, with commits

| What | Commit |
|---|---|
| One command builds the app in Release for the iOS simulator and installs it: `zsh scripts/ios-sim.sh <worktree name> [api origin]` | 1efd2b40 |
| The walk driver, nine walks, the server, rebuild and timing scripts, and an idb shim: [app/e2e/sim](../../../../app/e2e/sim/README.md) | 1efd2b40 |
| `/shop` opens with its bar ready to type on iOS (it blurred back into a button during the push) | 34536298, merged 66302138 |
| The walk table, the timings and how they were taken: [finalization §6](../../../../spec/plans/finalization.md#the-native-walks-2026-11-15-the-apps-native-walks-lead) | a59e79a3, d76d3c68, 8c9951ed |
| Nate's instructions, verbatim, in [words](../../../../product/words.md#2026-11-15-nate-systems-working-before-the-look) | 6211c819 |

Decided: `app/ios/` stays generated and git-ignored (`app/.gitignore:42`, `app/README.md:34`). `app.json` and its plugins are the source.

## Mac branches (glados, `~/dev/projects/secondhand-wt/`)

| Branch | Holds | Passes? | State |
|---|---|---|---|
| `w/app-fix-1` | 574de53f: `Blank` passes each keystroke up, email and code keyboards, a sign-out helper | its own test 7 of 7 and `client.test.ts` 25 of 25 (worker's report, not rerun by me) | **parked, not for main**: Ben's ac133f38 replaced the sign-in and settings screens it fixed; no failing walk stands behind it |
| `w/app-fix-2` | the `/shop` focus fix | proved on the simulator | merged (66302138) |
| `w/app-sim-tools` | the tooling | walks ran | merged (1efd2b40) |
| `w/app-sim-2` | the build in use (79503d33). `app/package.json` is edited by prebuild; never commit it | — | build worktree, nothing to merge |
| `w/app-sim-1` | the first build at 8f878066 | — | stale, remove |
| `w/app-e2e-1` | the web e2e rerun at 5d06fbe0 | see below | test run, nothing to merge |

## Build and open the app in the simulator

On glados, once: the device `sh-walk-17pro` exists and is booted (its id in `/tmp/sh-sim-udid`), and `idb_companion` runs through `zsh app/e2e/sim/companion.sh`. Then:

```bash
zsh scripts/ios-sim.sh app-sim-3
```

This cuts the worktree at `origin/main` and builds and installs the app against `http://localhost:8790`. Add `https://<host>` for the hosted server. Then `zsh app/e2e/sim/server.sh app-sim-3` starts the server (`NODE_ENV=development`, scratch data, the dev code) and `xcrun simctl launch $(cat /tmp/sh-sim-udid) com.bnvg.secondhand` opens the app. Xcode 27.2 on glados has not finished its first launch (CoreSimulator 1051 against 1174), so the build uses the generic simulator destination; `sudo xcodebuild -runFirstLaunch` (Nate's password) fixes it and lets Maestro 2.12.1, installed today, run.

## Each walk step, at 79503d33 (+ 66302138), signed in by the dev code

| Step | Result | What I saw |
|---|---|---|
| A1 Fresh install | passed | opens on "welcome to secondhand", one email field |
| A2 Email and code | passed | "check your email", then "connect your services"; server `email/start` 202, `verify` 200 |
| A3 Link eBay: live window, 2FA, complete | **failing** | every row "Unavailable · Service sign-in is not configured yet."; Link does nothing. Needs `BROWSER_USE_API_KEY` on the server (Nate) |
| A4 First photo step, Not now | passed | Today with three empty sections |
| B1 Buy, open `/shop` | passed after 66302138 | the bar is an input at once, typing lands with no second tap |
| B2 Search, first source | passed | the query and the source logos (Dupe, Poshmark) |
| B3 Settled results | passed, two sources | "From 88 listings for sale now", Dupe 40, Poshmark 48. eBay and Depop `no_route`: my server had no browser composed |
| B4 Chat follow-up | **failing** | "What's selling and why" stays a button; `POST /v1/assist` 404 (engines lead) |
| B5 Open a listing | passed | leaves for Safari through dupe.com's redirect page (kept: Dupe's terms require its links) |
| C Signed-in tabs | passed | Today, Sell, Buy, You (Dashboard, Settings) and New load; every request 2xx except assist |
| D Kill and reopen | passed | Today, still signed in |
| E Sign out and back in | passed | `auth/signout` 204; sign-in after relaunch; back to Today |
| F Sell: camera, Choose photos, picker, photo sent | **failing after the photo** | "could not continue. Photo uploads are not connected yet". My build predates eaec5743, the upload join (capture lead) |

Screenshots and step reports: on glados in `~/sh-walks/` (`run1` at 8f878066; `run2*` and `run3` at 79503d33; `review/` with a Codex reviewer's REVIEW.md, which confirmed the screens and corrected one timing).

## Timings (Release, the same simulator, the server on the same Mac; idb polling, good to about 0.3 s)

| Measure | Samples | Result |
|---|---|---|
| Cold start, signed in, launch to Today | 7 | median 1541 ms (1508 to 1559) |
| Cold start, fresh install, launch to sign-in | 2 | 1441 and 1501 ms |
| Search, Return to first source on screen | 10 | median 288 ms |
| Search, Return to the settled answer (Dupe and Poshmark) | 5 | median 3755 ms (3377 to 5688) |
| Requests for a cold launch, signed in | 1 | 10, each once (the doubling on web is the development double-run) |

Web e2e at 5d06fbe0 (`app-e2e-1`, `/tmp/app-e2e-1.out`), still running at the halt: 928 pass, 128 fail. Failures cluster in `(tabs)/buy` 32, `today` 28, `sell` 25, `want` 11, `shell` 11, and they look like the demo-world behaviour tables that ac133f38 replaced. Not yet split into stale tests and real faults.

## Next, in order (when the orchestrator says resume)

1. Rebuild at current main (`zsh scripts/ios-sim.sh app-sim-3`), with `SECONDHAND_PUBLIC_ORIGIN=http://localhost:8790` on the server (the upload address is built from it), and rerun walks A to F.
2. Walk F with uploads (eaec5743). Report to the capture lead whether `PUT /v1/uploads/:id` answers 415 for a library pick (iOS can hand HEIC; `live.tsx:93` labels it JPEG) and whether identify runs after it. GPS is stripped on the server (uploads.test.ts); stripping on the phone too is Ben's call (his packet 89).
3. Search at current main (a32b6bc1): check the server logs "search clients composed" with a browser, and whether eBay and Depop land. Never point the Mac's Chrome at them again: both answered `blocked` from glados on 2026-11-15.
4. Wire search round 3 in the phone (search lead's message, a32b6bc1): fold `group: 'osint'` sources (Dupe, Facebook, later Google Shopping) under one line; `POST /v1/search` takes optional `sources: string[]` (ids or `'osint'`; unknown or empty is 400); show Mercari's `outcome: 'failed', error_code: 'no_route'` as unavailable, never as "link your account". Then remove the `sites.json` shortcut once every searched entry carries `url` (search queue).
5. The chat walk (tap `shop-ask-why`, type a follow-up) when the engines lead lands `POST /v1/assist`.
6. The hosted walks: secondhand-api.fly.dev runs 9c8eab08 but stops five minutes after each start (a Fly trial until Nate adds a card), and email sign-in answers 503 until a Resend key is set. Walk there when the server lead says it stays up. Then the connect walk (Link, the live window, 2FA, complete) needs `BROWSER_USE_API_KEY` there.
7. Ben's look findings are with the orchestrator and wait, on Nate's word ("dont focus on ui as much...").

## Left running on glados

The walk server (pid in `/tmp/sh-walk-server.pid`; stop with `kill $(cat /tmp/sh-walk-server.pid)`), `idb_companion` (gRPC 10882), the booted simulator, and the e2e run. No Codex worker of mine is running.

## Learned the hard way

- Build from current `origin/main`: three leads' fixes (ac133f38, eaec5743, a32b6bc1) landed while my build ran, and a worker brief was written against screens that no longer existed.
- `idb ui text` with a whole string drops keys in a controlled field: type one key at a time. A substring match found "Don't Allow" for "Allow": match system buttons exactly.
- Restarting the walk server wipes its data, so the phone is signed out afterwards. That is correct behaviour, though it looks like a failure.
- The server log writes each request twice (`server.http` and `edge.api`): count one source.
