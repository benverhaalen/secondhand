# 81: Buy's search is now a white takeover that builds live, then turns into a chat. What it touched of yours

Updated: November 15, 2026, about 07:00 Central. Owner: Ben. For: Ben's redesign of the buy side. Agent: Claude Code, Nate's app-wiring lead. Base: `main` at b55df456. Status: on main; it runs on the dev server against the real `/v1/search`, and its e2e test passes on the Mac's web export (3 of 3).

Nate saw a plain wired scaffold and said what he wants instead. His words are verbatim in [product/words.md](../../../../product/words.md#2026-11-15-nate-search-is-the-black-bar-the-home-has-a-top-bar-and-carousels-and-a-focused-search-turns-white-while-the-answer-builds-and-each-source-animates-in), with [the chat](../../../../product/words.md#2026-11-15-nate-after-the-first-answer-the-bar-drops-to-the-bottom-and-it-becomes-a-chat-kept-on-the-device-not-on-our-servers) and [the ＋ keeps your choices](../../../../product/words.md#2026-11-15-nate-the--keeps-bens-own-choices) after it. He asked that it align with your components, so it is built only from `app/src/ui`, and every word sits in one `WORDS` object for you to rewrite.

## What a person sees

1. On Buy, pressing the search field opens `/shop`, which fades in white with the field focused. It is white with black type even in dark mode, because Nate asked for white. That overrides the system scheme with `<Theme scheme="light">`, which your README keeps for the parts sheet. It is your call whether that stands.
2. While the search runs, each source comes in as its logo (`SourceLane`), and the listings it found slide in beside it as 40 round photos when its frame lands. A source that failed or ran late stays, faded, and says why ("Not connected", "Too slow").
3. Once the search settles, where it looked folds into one line of logos and counts that opens again. The first ranked listing then shows large in a `Card` with your black `Pill` "View listing", the next ones on a `Rail` of your `Tile`s, then one line with the spread of asks. There is no "Where we looked" and no "For sale" heading.
4. The bar then drops to the bottom (`ChatFrame`, moved by transform), and every later ask is a turn of the buying conversation. Until `POST /v1/assist` answers a visitor (asked of the engines lead), a turn says it couldn't answer.
5. Close keeps the chat on the phone: the browser's localStorage on web, SQLite through `expo-sqlite` on iOS and Android, never on our servers, and never a Dupe row. Saved chats are listed in the empty takeover.

## What changed in your files, and why

| File | Change | Why |
|---|---|---|
| `app/src/app/(tabs)/buy.tsx` | `onOpen={() => router.push(href(w, '/shop'))}` on `buy-search` | pressing the field opens the takeover (Nate) |
| `app/src/ui/parts/search-field.tsx` | `focused` (opens typing; a submit clears and stays ready) and `onOpen` (a press opens elsewhere) | the takeover's bar, and Buy's field as its door |
| `app/src/ui/icon.tsx` | `accessible` is passed only when there is a label | `accessible={false}` reached the SVG on web and raised a React warning toast on every page |
| `app/src/ui/motion.ts` | `sourceIn`, `listingIn`, `barDrop`, each with its reason | M4: every motion is named |
| `app/src/ui/index.ts` | exports `ChatFrame`, `SourceLane`, `SourceMark` and `Rail` (new files in `parts/`) | the screen is built from parts only |
| `app/metro.config.js` | `resolver.nodeModulesPaths` set to `app/node_modules` | every web page was blank: `log/native.js` reads an `EXPO_PUBLIC_` variable, and from `log/` Metro could not find `expo/virtual/env` |

Not touched: `search.tsx` (its demo states and behavior table are as they were), New and its choices, Today. The ＋ keeps your choices, on Nate's word.

## What is yours to decide

- The look, motion and words of `app/src/buy/chat/shop-view.tsx`. The wiring is in `use-shop.ts`, `store.ts`, `assist.ts` and `app/src/buy/reach.ts`, and none of it needs to change for a new look.
- Whether `/search` (results) stays, now that `/shop` answers in place. Buy's field still submits to `/search` when someone types without pressing first.
- Your new Recent list on Buy and the saved shop chats are both "what I looked up". Showing the chats there would join them. The saved list is `load()` in `app/src/buy/chat/store.ts`.
- Nate also described the home view: a small top bar with announcements, carousels of recommended products, and insights and research findings below. Nothing is built for it yet. Packet 83 holds it as the next piece, from your design when you have one.

The four patterns behind the live view, and why they read as credible: [research/buy/nate/search-in-progress.md](../../../../research/buy/nate/search-in-progress.md).
