# Buy, round two: composed in code over photos

Built the way Ben asked on 2026-11-15 at 03:24 ("piece them together yourself"): HTML from [brand/tokens.css](../../../../brand/tokens.css) and round 11's parts ([screens.css](../../../../brand/explore/round-11/mock/screens.css)), with the generated demo photos in [assets/demo-items/](../../../../assets/demo-items/README.md). It keeps what [the round-one merge](../round-1/merge.md) keeps: one field for words or a link with the camera inside it; the shelves New finds, Watching and Bought; the new match as the one card on the field, with a large photo, the site's logo, a two-word read, the asking price and the fair range both delivered, and one action, View listing; one quiet line that the search is running. The news is said once, by the card on the field. No browsing feed.

Open [buy.html](../../../../brand/explore/camera-buy/buy/buy.html) (`?s=match` or `?s=none`). The source sits beside round 11's kit in `brand/explore/camera-buy/`; the type needs `fonts.local.css` beside it, which is not in git.

| Render | Shows |
|---|---|
| [renders/buy-match.png](renders/buy-match.png) | A new match |
| [renders/buy-none.png](renders/buy-none.png) | Nothing found yet, still searching |

Rendered at 390 by 844, device scale 3, with PP Neue Montreal 400 and 500 and Clofie 600 loaded (`document.fonts.check`). Prices, ranges and sites are made up. *Agent proposal* until Ben picks.

## What the checkers flag

`node scripts/brand-check.mjs brand/explore/camera-buy/buy/buy.html --medium app`: 13 errors, every one also raised on round 11's own mock (`brand/explore/round-11/mock/check.html`), so they belong to the kit, not this screen: the tinted page (B7), the wordmark's place and the wash under it (B3, B32), the message count (U1, B17) and the field's drift written by hand (B5).

Fixed here: the shelves first ran past the right margin (B17, B34) and their site badges read as a row of logos taller than the wordmark (B33); the tiles now fit three across with the logo on the price line, as on Sell. The shelf titles were bold by browser default; they are regular now.

Found in round 11's kit: a chosen tab fills its icon's first path, and the magnifier's first path is its handle, so a chosen Buy tab lost its lens. [buy.css](../../../../brand/explore/camera-buy/buy/buy.css) works around it; the fix belongs in screens.css.

`node scripts/copy-lint.mjs` on every string: clean.
