# Check log

Every `brand-check` failure on `deck.html` and `post.html`, in order, and what changed. `brand/constitution.md`, `brand/media.json` and `scripts/brand-check.mjs` were edited by someone else between run 1 and run 2 (01:42 to 01:46 UTC): C1 gained "the kit", C2 the frozen frame, C5 the logo row, Part IV gained B32 and B33.

## Run 1

| File | Message | Change |
|---|---|---|
| deck | `ERROR B17 view 1 "secondhand" runs into the 96 px top margin of a deck (Part III)` | The element box sat exactly on the margin (top 96, height 70.4). The checker measures the glyph box, which is taller than the token line height 1.1. Added `padding-block` of 8 to the wordmark and the display heading. False alarm, see report. |
| deck | `ERROR B17 view 6 "secondhand" runs into the 96 px top margin` | Same change. |
| deck | `ERROR B17 view 6 "Your second hand. Done in seconds." runs into the 96 px bottom margin` | Same change (line height 1.125). |
| deck | `ERROR B12 view 2 "$3" is an amount with nothing beside it saying what it is` | The row read "Consignment" and "$3" under a label "What you keep from a $20 shirt". Changed the cell to "You keep $3" and the label to "Selling a $20 shirt" to stay at 14 words. |
| post | `ERROR B17 view 1 to 4 "secondhand" runs into the 72 px bottom margin of a post` (four errors) | Same cause. Added `padding-block` of 12 to the wordmark. |

Not reported in run 1, found by looking at the screenshot: deck view 4 was broken by my own CSS (a class lost to `section[data-view]` on specificity). The photo rendered 1728 px square, ran off the bottom of the canvas and through the margin, and the heading touched it with no gap. The checker said nothing. Render kept as `deck-4-first-run-passed-checker.png`. Fixed with `section.how`.

Other changes made by eye after run 1, with no checker message: the label and rows on deck 2 grouped at the bottom; deck 4 steps grouped at the bottom; post 2 cut to the one amount; the eBay logo cropped with `object-fit: cover` because its file is a wordmark inside a square with air above and below.

## Run 2

| File | Message | Change |
|---|---|---|
| deck | `brand checks ok` | None. |
| post | `ERROR B33 view 3 a logo is 72 px tall: none is taller than the wordmark's type, 40 px on a post (C5)` (printed as `warn` a minute later, after the checker changed again) | Logos from 72 to 40. |

## Run 3

Both files: `brand checks ok`, exit 0. Deck color share by view: 100% 0% 0% 0% 99% 0%. Post: 0% 0% 0% 98%.

## Probe

`probe.html` holds six views I believe are off-brand. Run as a deck, the checker caught: digits in the display face, a display heading on two lines, two display headings (all A7), 19 and 20 words (B30), and warned on "eBay" as a word (B11). It passed: a photo running off the canvas, centered multi-line text, a 12-word headline, a heading with a gray subtitle over three equal outlined cards, and a tagline set directly under the wordmark. It also passed `<div><p>title</p><p>$38</p></div>` while failing the same picture written as `<li><p>Consignment</p><p><span>$3</span></p></li>`.
