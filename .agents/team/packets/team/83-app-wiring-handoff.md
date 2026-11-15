# 83: app wiring handoff. The phone app reaches the server, search first; what is next

Updated: November 15, 2026, about 07:45 Central. Owner: Nate. Agent: Claude Code, the app-wiring lead (Opus 5.5). Base: `main` at 36f1dcf9.

Finalization section 6, as marked there: AP1 done but the simulator run (61abd599); AP2 done; AP3 map and the reply to Ben done ([packet 85](85-reply-to-79-left-to-wire.md)), wiring continues screen by screen; AP4 partly done, crash upload path open (server lead); AP5 prepared, waits on Nate's host and his go for a build.

## What is true on main, and what proves it

| What | Commits | Proof |
|---|---|---|
| A search's job streams on the dev server. Expo bundles each API route on its own, so the job store was one per route; now there is one per process, on `globalThis` (`app/src/edge/api/jobs.ts`) | ed033820 | a real visitor search streamed all frames on `npm run web`, memory only |
| The client data layer `app/src/api/`: the address on web and device (`EXPO_PUBLIC_API_ORIGIN`, else the dev server's `hostUri`), the visitor id kept, a token seam, calls, and the SSE reader with Last-Event-ID resume and UTF-8 decoded by hand (Hermes has no TextDecoder) | cc4148d9, 2af07c98 | `node --test` on `client.test.ts` (18), `sse.test.ts` (8), `utf8.test.ts` (3), `fetch.test.ts` (1) |
| `app/src/buy/reach.ts`: a search job's frames to what the screen shows; every number is a frame's field | 2dcd53f0 | `reach.test.ts` (17), over three recorded streams in `app/src/buy/fixtures/` |
| `/shop`: Buy's field pressed opens a white takeover; each source comes in as its logo with its listings; then the answer, and the bar drops to a chat; chats are kept on the device (localStorage on web, `expo-sqlite` on the phone), never a Dupe row; a source not connected is not listed | a98c8861, 822ca173 | `app/e2e/shop.test.mjs` 3 of 3 on the Mac's web export; seen live on the dev server for levi 501, carhartt detroit jacket and nike dunk low |
| Every web page was blank (`expo/virtual/env` unresolved from `log/`); fixed in `app/metro.config.js` | 2af07c98 | `/buy`, `/search` and `/shop` render on the dev server |
| The research note and the wiring map | dd00948e, 95bc80ea | [search-in-progress.md](../../../../research/buy/nate/search-in-progress.md), [app-wiring.md](../../../../spec/plans/app-wiring.md) |

Nate's words for all of it are the 2026-11-15 entries in `product/words.md` from "search is the black bar" onward. Ben's part of it is [packet 81](81-search-reach-for-ben.md).

## Open, in the order to do it

1. **The chat's follow-ups need the server.** The engines lead builds `POST /v1/assist` for visitors as BC3, to the shape the client already sends (`history[]`, `search_job_id`; 429 `cap: 'daily'` shows its own line). Run the chat against it on the dev server when BC3 lands. Until then a follow-up says it couldn't answer. The client fold (`app/src/buy/chat/assist.ts`) is tested against a hand-written fixture.
2. **Poshmark is read twice**: directly, and through Dupe (`sources.ts:42` covers Poshmark), whose copies are then dropped as duplicates (17 of 40 for levi 501). Sent to lead-search.
3. **The home view** Nate described: a small top bar with announcements, carousels of recommended products, insights and research findings below. Not started. It is Ben's screen, so it should be built from his design. The data is `/v1/today` (needs a token), `/v1/trends` (visitor) and `/v1/insights` (example-gated).
4. **Sign-in**: wired by email (bc23fd2d). On a development server started with `SECONDHAND_DEV_CODE` (and `SECONDHAND_DATA_DIR`), the onboarding's email step signs in for real and the phone keeps the tokens. Until Nate picks an email sender, that development code is the only way in. Apple is out; Google needs its client ids. The signed-in screens come next in the map's order.
5. **The rest of the map's order**: Product and Listing reads, then Today and decisions, then wants and matches, each scaffolded the way `/shop` is (wiring hook, look file, behavior table, e2e from a recorded stream).

## Decisions, one line each

- The look stays apart from the wiring. Ben replaces `shop-view.tsx` without opening `use-shop.ts`, `store.ts`, `assist.ts` or `reach.ts`.
- Types come from server modules by `import type`. The `edge/` import check now fails only value imports in shipped files (`.agents/checks/secrets.mjs`, with a test).
- `/dev/search` and its plain look are deleted: Nate rejected them, and `/shop` replaces them.
- Agent proposals for Ben, not his decisions: forcing white with `<Theme scheme="light">` (Nate's words over the dark-mode rule), and the shop chats joining Buy's Recent.

## What went wrong or was learned

- `node --test` cannot see a browser-only failure: an unbound `window.fetch` and `TextDecoder` on Hermes both passed every test. Check a client in a real browser before calling it done.
- `expo-sqlite` breaks the web bundle (a wasm worker). Its `localStorage` install is loaded from a `.native.ts` file only.
- `app/e2e` cannot export on Windows: it runs `node_modules/.bin/expo` without its `.cmd` shim. Run e2e on the Mac in a fresh worktree with `npm ci`, since the Mac's shared `node_modules` lacks `@anthropic-ai/sdk` and `expo-sqlite`.
- One worker commit (2353a6c5) went to main without a `Rests-on:` trailer. Add the trailer when committing a worker's work on the Mac.
