# 100: our state at 16:00 UTC, for Ben

Updated: November 15, 2026, 16:00 UTC by the machine clock. Owner: Ben. For: Ben. From: Nate's side (the orchestrator, Claude Code). Status: Nate asked "Send the packet to ben, as well as our state". Read after packet [99](99-where-the-app-stands-for-ben.md) (how to run it, what works, what it looks like) and [98](98-the-story-for-the-site-and-video.md) (the story).

## 1. Where we are in one paragraph

Main has every lead's finished work: search that settles without waiting for eBay, the chat with headings and tables checked row by row, capture of 14 families with real uploads and identify, valuation from real sold listings, the journey test over every route. The benchmarks are in [bench/RESULTS.md](../../../../bench/RESULTS.md). Nate said go at 16:00 UTC for the last fixes and a TestFlight build, so you and he can install it from the TestFlight app.

## 2. What stops TestFlight today, and the fix landing now

| Problem | Seen | Fix |
|---|---|---|
| Every launch on iOS shows an "Expo Head" system alert that returns after OK, so nothing can be used | Release build on the simulator, main 8dc0a690 | `<Head>` in `app/src/app/_layout.tsx` (from 2c9edb74) drives Apple Handoff on iOS; render it on the web only (w/app-test-fix-3) |
| Track item stays disabled after typing a maximum; a typed Brand is not saved by "Use this", so no capture reaches a draft | same build | `Blank` takes an opt-in `live` flag on 15 fields that submit with their own button (w/app-test-fix-2) |
| A refused upload's answer could be lost on the phone (TCP reset) | the live capture walk passed 2 of 5 | fixed on main (e4291715): 5 of 5 at 25 of 25 steps |

With both fixes, on the simulator in Release: sign-in yes, search yes, the four tabs yes (the session survives a kill), Track item yes, capture walked to the questions. The chat says "Couldn't answer that yet" only because that test server had no model key.

## 3. Decisions Nate made today that touch your work

- **Capture keeps what arrived.** Your d1006a17 (finish refuses a kept photo whose bytes never arrived) changes on Nate's word, "Yes, keep what arrived": finish saves the photos that did arrive, identify runs on them plus the tag text and codes, and refuses only with no evidence at all. The server lead rebuilds it on main next; the capture lead reviews.
- **Lens is wired.** Nate: "Yes, wire Lens". Identify gets a Lens step only when the server holds `TREG_TOKEN` and its public address, within the approved caps ($0.003 a capture, $0.10 a day). It spends only after Nate tops up treg.
- **The UI is final.** Nate: "The app ui is considered finalized". Fixes from here are behaviour, not look.

## 4. What the audits found (Sonnet reviewers, 15:50 UTC)

Being fixed now, before the build:
- The app: a server hiccup during a token refresh signed the person out; a keychain error could freeze sign-out; job-stream reconnects fired with no pause; a chat reopened after closing mid-search stayed "searching"; finish did nothing while photos were still uploading; Try again dropped the source choices.
- The server: deleting an account leaves the person's photos on disk; a signed-in account has no spend cap on the chat; capture and item ids restart at 1 after a restart, so a new capture can overwrite the same person's earlier item; JSON bodies have no size limit.

For App Review later: the reviewers need a working sign-in (a development code is refused in production), and `eas.json` needs the App Store Connect app id to submit without prompts.

## 5. What we need from you

1. Your yes, with Nate, on "keep what arrived" (section 3), since it changes your rule.
2. Your App Store Connect access is not needed for the build; if you want to be an internal tester, make sure you are on the team's App Store Connect users list.
3. Anything still failing for you after packet 99 §1, with the screen and what it said.
