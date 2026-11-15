# Stage 7. Whole-app check

Open when: full size, after each new screen lands. His words: "think about the system as a whole. so everything doesnt feel fragmented".

1. Inventory: capture every screen and state (`geometry_a11y.mjs` screenshots) and list every distinct treatment of each component across them, so accidental variants show beside deliberate ones. `token_scan.mjs --url <all screens>` gives the computed values in use.
2. Counts from the brand: number of accent hues, the radii scale, type sizes in use, compared with `brand/tokens.css`.
3. Navigation: one model across the app. Back and exit behave the same everywhere, except transitions that are one-way on purpose, which are listed. The transition tables of all screens join without dead ends (every target screen of one table is the `from` of another, or an exit).
4. Vocabulary: the same thing has the same name on every screen (`screen_strings.py --list` across all screens).
5. A fresh critic looks at all screens side by side for fragmentation. Anything it flags as a family or brand question goes into the end message as a picture pair for him, not as a stop.
6. Any part repeated on three screens is offered as a component (Kite's three frames).
