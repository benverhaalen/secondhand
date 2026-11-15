# 54 — For Nate: what the app UI now needs from the API and data

Updated: November 15, 2026, 07:20 UTC. Owner: Ben. For: Nate. Agent: Claude Code (project thread "Roll the UI system out everywhere"). Branch: main at 478a59d. Status: open; each row is a request, not a change to your code.

## Why you're getting this

Ben, 07:14: "ensure all information is continually added to the repo and that nate gets packets that he might need". The app pages were rebuilt from Ben's notes at 06:19 and 07:12 ([words.md](../../../../product/words.md#2026-11-15-notes-on-the-first-gallery-today-must-explain-itself-you-is-a-dashboard-the-camera-frames-the-listing-photo), [07:12](../../../../product/words.md#2026-11-15-the-lower-tiers-pile-and-fan-out-and-the-top-of-today-always-shows-a-flattering-number)). The pages read the demo worlds today (`app/src/demo/`). These are the fields they will need from the real API.

## 1. Today's top line: a ladder, not one kind

Ben 07:12 wants the top of Today to always show the most flattering true number. `app/src/edge/api/today.ts` has `Headline.kind` as `kept_since_last_open | next_setup_step`. The UI will pick the first rung that has something, in this order:

| Rung | kind (proposed) | value it needs | Example the UI draws |
|---|---|---|---|
| a | `kept_since_last_open` (exists) | amount_cents, sold item ids with photo and site | "$97.33 since yesterday", photos of what sold |
| b | `kept_this_period` | amount_cents, count, period (`week` or `month`) | "$212 this month, 5 sold" |
| c | `could_bring` | live listing count, net cents low and high across sites (after fees) | "Your 6 listings could bring about $480" |
| d | `interest_since_last_open` | views, likes, watchers, saves since last open (sum over live listings, per site where the site shows it) | "38 people saw your listings since yesterday" |
| e | `next_setup_step` (exists) | as now | no number: "See what your things are worth" with the camera |

Rules the UI holds: never fake a number or round up, and always name the window. `lastOpen` is still per process (`today.ts` line 15); the rungs a and d need `user.last_open_at` stored. Rung d reads `read_stats` rollups (spec/data-use.md, "Views, likes, watchers, saves, bags"); eBay shows no likes (`storefront.test.ts`).

Either send all rungs and let the UI choose, or choose on the server. Choosing on the server keeps the choice in one place, so the agent proposal is a single `headline` picked by this order, with its `kind`.

## 2. Other fields the rebuilt pages read

- **Money wording.** The UI says "You get $X" for what reaches the person after fees, never "You keep" (Ben 06:19). The field names (`you_keep_cents`) can stay; only shown words changed. `spec/notifications.md` sale and offer bodies now read "You get".
- **Possible scam.** Today's risk card is labelled "Possible scam" (was "Careful"). Same decision kind; only the word changed.
- **A way back to the site.** Every card's More menu has "Open on the site", which needs the listing URL per site on every decision and item. Ben also wants the site's own screenshot where the person verifies something (a pickup time, a listing's state): a stored screenshot URL with its time, from the watcher that read it, would let Pickup and Item show it.
- **Sell's shelves** fold; the fold state is per device, so no API field is needed.
- **You as a dashboard** (being built now): sales and money per week and month, listings live with their views and likes, and what live listings could bring. Same sources as rungs b to d above.
- **Settings defaults** (Ben 05:47): App defaults and Permission defaults on You, Settings. They need a per-user preferences store (default sites, default ship method, notification kinds, permissions granted). The page reads `app/src/you/` demo data now.

## 3. On main, for your attention

- `app/src/edge/api/jobs.test.ts` (3 tests: the stream, the heartbeat, every jobs example endpoint), `app/src/edge/data/data.test.ts` and `app/src/engines/param/sql.test.ts` fail in `node .agents/check.mjs` on main as of 07:00. UI work did not touch them.
- `expo-camera` was added to `app/package.json`; run `npm install` in `app/` after pulling.

## Evidence

- Today's ladder dispatch and renders: features/app/renders/today/
- The UI's current reading of the top: `app/src/today/cards.ts` `top()`
- Ben's choices on the decision cards are in this thread's history; the dark-mode field change lands with the brand thread's checker change.
