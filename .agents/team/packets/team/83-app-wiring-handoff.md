# 83: app wiring handoff. The app reaches the server; search and sign-in are real; what is next

Updated: November 15, 2026, about 08:30 Central, at Nate's wrap-up. Owner: Nate. Agent: Claude Code, the app-wiring lead (Opus 5.5). Base: `main` at 8cd51c6e. Note: Ben's `83-ben-tab-and-capture-ui.md` has the same number; this is the app-wiring one.

No branch or worktree is left: both Mac workers (`w/wire-client-1`, `w/wire-reach-1`) are merged and removed. Nothing of mine is uncommitted.

## What works on main, and what proves it

| What | Commits | Proof |
|---|---|---|
| The app's one client, `app/src/api/`: the address per build (`EXPO_PUBLIC_API_ORIGIN`, else the dev server's `hostUri`), the visitor id, tokens in the secure store on a phone (memory on web), one refresh shared by every 401, a job's SSE read with `expo/fetch` on a phone, UTF-8 decoded by hand (Hermes), Last-Event-ID resume, reading on after done for a late fill (`answer.late`, 60 s grace) | cc4148d9, 2af07c98, 61abd599, 578b7226, bd4636a1 | `client.test.ts` 25, `sse.test.ts` 8, `utf8.test.ts` 3, `fetch.test.ts` 1 |
| `app/src/buy/reach.ts`: a search job's frames to what the screen shows; `answer.late`; each source's results address | 2dcd53f0, bd4636a1, d921b15f | `reach.test.ts` 18, over three recorded streams in `app/src/buy/fixtures/` |
| `/shop`, Buy's search (Buy's field opens it). It is white, with the field focused. Sources float in as logos; a source not connected is not shown; a pressed logo bursts in its colour and opens its site's results. The answer leads with what the listings say (`app/src/buy/insights.ts`), then the listings; then the bar drops and it is a chat, kept on the device, never a Dupe row | a98c8861, 822ca173, d921b15f | `app/e2e/shop.test.mjs` 3 of 3 on the Mac; seen live on the dev server |
| Email sign-in: the onboarding's email step calls `/v1/auth/email/start` and `/verify`, and the phone keeps the tokens | bc23fd2d | on the dev server with `SECONDHAND_DEV_CODE`: start 202, verify 200, then the sites step; `/v1/me` 200 with the token; `app/e2e/onboarding.test.mjs` 35 of 35 on the Mac |
| Every web page renders (Metro resolves `expo/virtual/env` for `log/`); the browser's fetch is bound; Icon no longer warns on every page | 2af07c98, a98c8861 | `/buy`, `/shop`, `/dev/health` render |
| AP4 and AP5 items: `+not-found.tsx`; `/dev` sends a release build home; `expo-file-system`, `expo-secure-store`, `expo-sqlite`, `expo-dev-client` declared; the privacy manifest; the simulator's server address | 330f1d55, 36f1dcf9 | type check; the checklist in [app-wiring.md](../../../../spec/plans/app-wiring.md#the-first-internal-build-finalization-ap5) |
| Docs: the research note, the wiring map, the reply to Ben's 23 items, the harness check | dd00948e, 95bc80ea, b2a8f430, d921b15f | [search-in-progress.md](../../../../research/buy/nate/search-in-progress.md), [app-wiring.md](../../../../spec/plans/app-wiring.md), [packet 85](85-reply-to-79-left-to-wire.md), [harness-check-2026-11-15.md](../../../../spec/plans/harness-check-2026-11-15.md) |

## What does not work yet

- **The chat's follow-ups.** `POST /v1/assist` is not open to visitors yet. The engines lead's BC3 contract, which the client already sends: `{surface, text, history[], search_job_id}`, 202 then `assist.tool`, `assist.text` and `assist.settled` on the job stream, 429 `cap:'daily'`. Until it lands, a follow-up says it couldn't answer, and the automatic "what is selling and why" shows as a button.
- **Depop rows** read through the harness have a URL slug as the title and no photo, so they draw as blank tiles. **Depop and eBay** send no results address on their searched entries, so the phone uses a copy of `readers.ts` `searchUrl` (a marked shortcut in `app/src/buy/sites.json`). Both are item 5 of the search lead's packet 88.
- **eBay** often misses an 8 s answer: its 10 s pace, behind back-to-back searches (packet 88).
- **Sold prices, monitoring, managing and analytics** are not live for any site (the harness check). Pricing has no live sold comps. Monitor and manage run only on fixtures, since no account is linked (SV9). Analytics is a synthetic snapshot (`app/src/edge/api/insights.ts:9-15`).
- **Crash uploads** post to `/api/log`, which only `log/receive.mjs` serves (AP4, the server's).
- **A simulator build** has not run; it waits on Nate's go (AP5).

## What is left, in the wiring map's order

1. **The signed-in screens.** Nate said yes. Sign-in works against the dev server or `node server/main.ts` with a development code, so begin with Today and decisions (`GET /v1/today`, `/v1/decisions`, `POST /v1/decisions/:id/act`, undo). Then wants and matches, then the item card, strategy and limits, then accounts, rules and me. Scaffold each like `/shop`: the wiring in a hook, the look in its own file, a behavior table, and an e2e test from a recorded or stubbed stream. Routes still built on `exampleHandler` answer 404 to a real user (`captures.ts:77`) until the server replaces them.
2. **The chat** against BC3, when it lands: run it on the dev server and record a real assist stream to replace `app/src/buy/fixtures/assist-follow-up.json`.
3. **Search round 3** from the search lead's successor: `sources[]` and `group` (a dropdown in the chat, with everything that is not a platform folded under "open source intelligence"), `read_directly`, and `url` on every searched entry. When that lands, remove the shortcut in `sites.json`.
4. **The home view** Nate described: a small top bar with announcements, carousels of recommended products, insights and research findings below. Not started. It is Ben's screen, so build it from his design; his packet 83 lists what his new tabs need.
5. **The first internal build** on Nate's go: the simulator steps in [app-wiring.md](../../../../spec/plans/app-wiring.md#the-first-internal-build-finalization-ap5). Check the title face's vertical nudge on a phone (the open fallback fonts, Hanken Grotesk and Outfit, are on main).

## What the next lead needs from the others' successors

- **Engines:** BC3 as above, and the commit when it lands.
- **Search:** packet 88 item 5 (`searched[].url` on every lane, Depop's title and photo), round 3 (`sources[]`, `group`, `read_directly` under exactly that key in `dropped_by_reason`), and `answer.late` once Apify is composed.
- **Server:** replacing the example routes for the signed-in screens, in the map's order (SV6, SV8). The crash upload path. SV0 replaced my `globalThis` job-store workaround with one server program; check that `app/src/edge/api/jobs.ts` no longer needs it.
- **Capture lead:** builds the clarifying-question widgets in `app/src/capture/` and `app/src/api/capture.ts` on this client (agreed); nothing of mine is in their files.

## What waits on Ben

- The look and words of `app/src/buy/chat/shop-view.tsx` (every string in `WORDS`), and whether forcing white in dark mode stands ([packet 81](81-search-reach-for-ben.md)).
- The items marked his in [packet 85](85-reply-to-79-left-to-wire.md): item 4, `/you/accounts`, and room-plan fates.
- His packet 83's tab and capture needs, which come after the signed-in screens.

## Decisions, one line each

- The look stays apart from the wiring. The designer replaces `shop-view.tsx` and never opens `use-shop.ts`, `store.ts`, `assist.ts`, `reach.ts` or `insights.ts`.
- Insights computed in the app describe asks for sale now and are labelled so. What sold, and why, comes only from the conversation's tools.
- Types come from server modules by `import type`. The `edge/` import check fails value imports in shipped files only.
- A chat is never stored on our servers: `localStorage` on web, SQLite through `expo-sqlite` on the phone (Nate).

## What was learned the hard way

- `node --test` does not see browser-only or phone-only faults: an unbound `window.fetch`, `TextDecoder` on Hermes, the `expo-sqlite` web wasm. Check every client change in a real browser.
- The Expo dev server bundles each API route on its own, so module state is per route. That split the jobs store, then the auth store, and kept the search route from loading the runtime.
- `app/e2e` cannot export on Windows (it runs `.bin/expo` without its `.cmd`). Run e2e on the Mac in a fresh worktree with `npm ci`.
- Shared files move under you: Ben's sessions changed `buy.tsx` mid-edit, and a pull refused. Keep your own edits small, and reapply them after the pull.
