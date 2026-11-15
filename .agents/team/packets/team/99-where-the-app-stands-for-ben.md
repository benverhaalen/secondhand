# 99: where the app stands, how to run it, and what it looks like now

Updated: November 15, 2026, 15:38 UTC by the machine clock. Owner: Ben. For: Ben. From: Nate's side (the orchestrator, Claude Code). Status: the state of main for you, after Nate's "send packet to ben with insight into what it currently looks like" ([words](../../../../product/words.md#2026-11-15-nate-merge-everything-to-complete-and-working-then-a-packet-for-ben-on-how-it-looks)). Read with packet [98](98-the-story-for-the-site-and-video.md) (the story, and today's changes in your screens).

## 1. Run it (this is most likely why nothing worked)

The server reads its settings from `app/.env.local`, and the example listed only Databricks. Every variable is now in [`app/.env.example`](../../../../app/.env.example) with what it turns on. Three are enough for everything local:

```
NODE_ENV=development
SECONDHAND_DEV_CODE=<any six digits: the code every email sign-in accepts>
SECONDHAND_DATA_DIR=<a folder, so accounts and captures survive a restart>
```

Add `OPENROUTER_API_KEY` (or `ANTHROPIC_API_KEY`) for the chat and `BROWSER_USE_API_KEY` for eBay. Then `git pull`, `cd app`, `npm run web` (or `npm start` for a phone on the same network). Sign in with any email and the dev code. A store build (TestFlight) talks to `https://secondhand-api.fly.dev`, which stays up only once Nate adds a card on Fly.

## 2. What works, measured

The full table, with where each figure was measured, is [finalization §13](../../../../spec/plans/finalization.md#13-what-works-kept-by-the-orchestrator). In short:

| Area | State |
|---|---|
| Sign-in, the four tabs, Messages | Work; a second person sees none of the first person's data (the journey test walks every route) |
| Search | Works across sources; first rows in 0.6 s; the answer no longer waits for eBay |
| The chat | Answers from the search's own rows; every figure must match a listing it found (20 of 20 planted false prices held); the app draws its headings, lists and tables |
| Capture | All 14 families open, take their type and ask their own shots; uploads from an iPhone fixed; identify proposes the brand from the tag |
| Valuation | Capture to a priced range in 3.6 s from real sold listings; an item it cannot identify is not priced |
| iOS | The iOS bundle builds, expo-doctor 20 of 20; the Release walk on the simulator is running |

Development readings, not for a public page until you and Nate have both seen them.

## 3. What it looks like now

- **Shop:** the field takes the page; the sources float in as their logos with their counts; a pressed logo fills the screen in the site's colour, opens the site, and folds back after five seconds or when the person returns. The summary card (most ask, middle, by site), the top three rows, "More for sale" tiles, then the chat's answer with headings and tables. On the web the rows no longer draw over each other.
- **Capture:** "1 of 2", a left-set heading ("What are you selling?" / "appraising?" / "looking for?"), fourteen bordered buttons with an icon each that pop in one after another; then the camera. Each shot starts with a white line drawing of what to frame and a phone outline sweeping across it, Measure-style, with the shot's name and one line; after four seconds it fades and the name sits at the top. Without camera access, one bordered card in the middle: the camera icon, "Use your camera", Allow camera full width, Choose photos under it.
- **Brand:** template headings now follow your Article 6 (the text face); the wordmark test reads `role="wordmark"`.

## 4. In your files today

Listed with commits in packet 98 §5. Added since: `app/src/capture/shots.ts` (the families and every shot's words, one place to change copy), the family-aware coach (a shirt only for clothing), and `brand/templates/layouts.css` line 16.

## 5. Your rule that broke the capture tests

Your d1006a17 (finish refuses a kept photo whose bytes never arrived) is right, and stays. It turned 17 capture tests and the live walk's finish check red, because they finished without uploading and expected the item in `researching` rather than `review`. The capture lead is updating them to upload first and to expect `review`; they land as soon as they pass.

## 6. What we need from you

1. Tell us if anything still fails after section 1, with the screen and what it said.
2. Your look at the capture type page and the coach drawings: change any word in `app/src/capture/shots.ts`.
3. Packet 98 §6 (the site's wording, the video, which figures go public).
