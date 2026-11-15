# Why does the app look nothing like the mocks Ben approved, and what keeps it from happening again?
Researched 2026-11-15 by Ben (Claude Code, thread "Roll the UI system out everywhere"). Feature: cross-cutting (UI and brand).

Ben, [09:30 to 09:47](../../../product/words.md#2026-11-15-the-app-looks-nothing-like-the-mocks-hierarchy-spacing-what-stacks-and-what-has-color): the app on his phone "looks so so ai slop", "lacks hierarchy", "why do some things stack. why do some have color", and the HTML mocks he approved did not. This note says where the two differ, why, and what now holds the difference. The running list of breaks is [features/app/breaks.md](../../../features/app/breaks.md).

Marks: *observed* (measured, or his words), *inferred* (our reading).

## What he approved, and what in it he liked

| Mock | His words | What made it work *(inferred from two or more of his notes)* |
|---|---|---|
| Today, light and dark, round 11 ([render](../../today/ben/today-v3-light-dark.png), [code](../../../brand/explore/round-11/mock/index.html)) | "i like that dark mode a lot", "the spacing i like", "whatever principles you used to tell if something should exist or not ... were stellar" *(observed, [02:18](../../../product/words.md#2026-11-15-dark-mode-approved-the-size-system-everywhere-clickability-money-and-countdowns-color-blind-checks))* | Every element had to earn its place, so the screen held two levels: the money, then three cards. One card of color. Six buttons. Separation by tone, not lines |
| The receipt, round 10 | "i like the B. the receipt thing", "not doing too much" *(observed, [round 10](../../../product/words.md#2026-11-15-round-10-picks))* | One number first; the sum opens on a tap |
| The sky to lime gradient, round 7 | "as a gradient pattern and feel rather than the exact colors" *(observed)* | Color as a soft accent at the top, not spread over the page |
| Sell, the gallery at 06:19 | "the sell one seems very organized and it's very easy to see like needs you in progress" *(observed)* | Headers at 18 over tiles titled at 15: each level one step from the next |

## Measured: the approved Today against the app's Today

Both rendered in Chromium at 390 by 844 with the real faces loaded (PP Neue Montreal 500, Clofie 600), on 2026-11-15 at 09:36. *(observed)*

| | Approved mock | App | |
|---|---|---|---|
| Card: tag, title, money line, buttons | 13, 18, 15, 15 at 0, 19, 47, 93 from the tag | 13, 18, 15, 15 at 0, 23, 51, 93 | the same |
| Lines between the nav and the first card | 2 (the amount, its line) | 5 (Since yesterday, the amount at 50, a photo strip with its line, "Needs you now 4", "Due first, today at 3 pm") | drifted |
| First card's top on a phone | 205 | 368 | drifted |
| Section header style | none | 18 in ink, the same as every card title | drifted |
| Buttons on the first screen | 6 | 9, with three on every card | drifted |
| Tags in the first tier | Offer, Sold, Live: three colors that tell the cards apart | four of one yellow with one hand icon, under a header that says the same thing | drifted |
| Card titles | short names ("Carhartt Detroit jacket") | the sites' listing titles, cut mid-word | drifted |

The kit held: every part matches the mock. What drifted is the page the parts are arranged in. *(inferred from the table)*

## Why

1. **The phone was never checked.** *(observed)* Every check ran on the web build. On the phone the faces were missing on a fresh checkout and the text fell back to San Francisco; You crashed on `Intl.PluralRules`, which Hermes lacks; and the top was cut off, because expo-router hands the web zero safe-area insets, so no render ever had a status bar. Each is fixed and logged in [breaks.md](../../../features/app/breaks.md).
2. **Every check judged a part, none a page.** *(observed)* The rules held sizes, contrast, corners, states and copy. A page whose every part passes can still have five lines before its first act and a header styled like its items. That is what Ben saw. *(inferred)*
3. **Every note was built by adding.** *(observed in the commits)* "A flattering number" became a photo strip and a label; the tiers became headers; the deadline became a line of its own; the pile, a fourth tier. Each addition passed. Nothing re-ran the step that made the mock good: cut what does not earn its place. *(inferred)*
4. **The demo data has a different shape from the mock's.** *(observed)* The mock had three items with short names. The typical world has twelve, titled as the sites title them. A layout tuned on three items was stretched over twelve by adding sections instead of by ranking and folding. *(inferred)*
5. **Several builders composed pages from the same kit with no shared page rule.** *(inferred)* The kit fixed what a card looks like; nothing fixed how many levels a page has, what stacks and what sits in a row, or when color is earned, so each builder chose.

## What an expert does, and where each now lives

| Principle | Source | Where it is held |
|---|---|---|
| Hierarchy comes from de-emphasizing the secondary, not from emphasizing everything; with one weight, size, ink and space are the levers | Refactoring UI, "Hierarchy is everything" *(asserted)*; [Art. 6.1](../../../brand/constitution.md#article-6-type) | Art. 7.11, check U10 |
| A page has few levels, and a section header is styled by what it heads: quiet labels over heavy items (iOS grouped lists), large headers over shelves of small tiles (App Store, Music) | Apple Human Interface Guidelines, Lists and tables *(asserted)* | Art. 7.11, check U10 |
| Content first: what needs the person is visible without scrolling or reading | Apple HIG, Layout *(asserted)*; the approved mock *(observed)* | Art. 7.12, check U11 |
| Progressive disclosure: show the decision in front of the person; the rest waits behind a tap | Nielsen Norman Group, Progressive disclosure *(asserted)*; [Art. 7.10](../../../brand/constitution.md#article-7-space-and-layout) | Art. 7.13, check U12 |
| Color is a signal; two neighbors in one color mean one thing | Refactoring UI, color *(asserted)*; Ben, 02:18 *(observed)* | Art. 7.14, check U13 |
| Names a person reads fit their slot | Ben, 06:19, "keep the lot" unclear *(observed)* | Art. 7.15, check U14 |
| Respect the safe areas; judge on the device | Apple HIG, Layout *(asserted)* | Art. 7.16, check U9; the phone thread's native captures |
| On React Native, use only what the device engine has (Hermes has no `Intl.PluralRules`); load fonts from a known path and fail the build when they are missing | React Native and Hermes docs *(asserted)*; the phone audit *(observed)* | `.agents/checks/hermes.mjs`, `scripts/fonts.mjs --check` |

## What a builder does differently from now

- Run `node scripts/app-check.mjs <route>`: U9 to U14 now fail a page that is composed badly, with the phone's insets.
- After adding anything for a note, run the cut: for each element on the first screen, what does the person lose without it. If the answer is "nothing new", it goes, or it opens from a line already there.
- Compare the page with the approved mock for its kind before showing Ben, not only with the rules.

## Limits

- The measurements are from the web build with phone insets, not from the phone. The phone thread's native captures (`features/app/native/`) are the check on that.
- The expert sources are cited from memory of their published guidance, marked asserted; none was re-read for this note.
