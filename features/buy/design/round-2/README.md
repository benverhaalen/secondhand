# Buy, round two: composed in code over photos

Built the way Ben asked on 2026-11-15 at 03:24 ("piece them together yourself"): HTML from [brand/tokens.css](../../../../brand/tokens.css) and round 11's parts ([screens.css](../../../../brand/explore/round-11/mock/screens.css)), with the generated demo photos in [assets/demo-items/](../../../../assets/demo-items/README.md). It keeps what [the round-one merge](../round-1/merge.md) keeps: one field for words or a link with the camera inside it; the shelves New finds, Watching and Bought; the new match as the one card on the field, with a large photo, the site's logo, a two-word read, the asking price and the fair range both delivered; one quiet line that the search is running. The news is said once, by the card on the field. No browsing feed.

Open [buy.html](../../../../brand/explore/camera-buy/buy/buy.html) (`?s=match` or `?s=none`). The source sits beside round 11's kit in `brand/explore/camera-buy/`; the type needs `fonts.local.css` beside it, which is not in git.

| Render | Shows |
|---|---|
| [renders/buy-match.png](renders/buy-match.png) | A new match |
| [renders/buy-none.png](renders/buy-none.png) | Nothing found yet, still searching |

Rendered at 390 by 844, device scale 3, with PP Neue Montreal 500 and Clofie 600 loaded (`document.fonts` and `document.fonts.check`). Prices, ranges and sites are made up. *Agent proposal* until Ben picks.

## This pass

- **Weight 500** throughout (`--w-text`), Ben at 03:45.
- **The current tab** shows a pill behind its icon, Ben at 03:45. Round 11's kit has no such part, so [buy.css](../../../../brand/explore/camera-buy/buy/buy.css) draws it from tokens (`--gray`, `--r-pill`, `--s-1`, `--s-4`); it belongs in screens.css. The icon stays a line drawing, which ends the kit's fill of the first path that made the Buy magnifier a solid blob. Every tab keeps the pill's room so the labels stay on one line.
- **The wash**, Ben at 03:22: stronger, an accent, ending at the search field's lower edge, and the page under it white, not tinted. No newer wash token was on main, so buy.css sets the two stops from `--sky` and `--mint` and restates `--wash` so it reads them. Today should take the same values from tokens.css so the two match; that file is the other thread's.
- **The match card's actions**: View listing grows to fill the row, with a light Watch and More beside it, the way the kit's cards set their buttons. One action alone failed the judge's L9.
- **The read**: "Fair price" now sits 8 above the name (parts of one thing, per the kit's separators), with its check at the tag icon size (`--tag-icon`).

## Values that are not tokens, and why

At the top of buy.css, one line each: the search field's height (56, one tall control), the match photo's height (180, the largest thing in its card), the shelf tile (108, three fit between the margins), and the wash's two stops and height (built from tokens; the height is the status bar, nav, a gap and the field, added up).

## Contrast, measured on the render

Each text's color, blended where it is translucent, against the darkest and the lightest pixel behind it, read from the same frame rendered with every text and icon hidden. Under 4.5:1 would fail; nothing does.

| Text | Ground | Against darkest | Against lightest |
|---|---|---|---|
| Fair price, Carhartt Detroit jacket, $62, $55 to $70 (ink) | the field | 12.77 at least | 13.03 at least |
| Asking, delivered (ink-2) | the field | 5.31 | 5.36 |
| Fair range, delivered (ink-2) | the field | 5.35 | 5.43 |
| View listing (white) | the black pill | 19.80 | 19.80 |
| secondhand, 9:41 (ink) | the wash | 16.27 | 17.03 |
| Find an item or paste a link, Searching (ink-2) | white under the wash | 20.20 | 6.31 |

## Judge pass

`node scripts/ui-rules.mjs judge app`, read against both frames by a reviewer who did not build it:

- **L9**, fixed: the match card offered one action; it now has View listing, Watch and More.
- **L29** fails on purpose: the rule still says the chosen tab is a filled icon with no pill. Ben chose the pill at 03:45, so the rule is behind.
- **L5**: the rule wants the second action as an outline; round 11 made it a light fill (R33). The kit and the rule disagree; this follows the kit.
- **U3**: a decision card wants a tag with a word and an icon above its title. "Fair price" has a word and an icon but is not a tag, because no state color means "fair". *Taste call*.
- Passed in both frames: L4 (every item has its photo, the match's is the largest), L26 and G5 (the field on one thing), L40 (photos keep their 1 px edge), B2 (a photo first), B24 (every number has its label), D2, L16 (shelves are tiles, not boxed rows).

## What the checkers flag

`node scripts/brand-check.mjs brand/explore/camera-buy/buy/buy.html --medium app`: 37 errors.

- **B13**, 21 of them: text at weight 500. The checker still expects 400; Ben decided 500 and tokens.css has `--w-text: 500`. The checker is behind.
- **B4 and B5** on the wash: restating `--wash` with stronger stops reads as a second, hand-built gradient. It goes away when the stronger wash lands in tokens.css.
- **B31**: View listing and Watch are one kind of button at two widths. Round 11's own sale screen raises the same.
- **From the kit**, also raised on round 11's own mock: the wordmark's place (B3), the message count (U1, B17) and the field's drift written by hand (B5).

`node scripts/copy-lint.mjs` on every string: clean.
