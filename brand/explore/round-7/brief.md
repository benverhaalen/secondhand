# Round 7 brief: boards from Ben's round 6 picks

Run with the [image-gen skill](../../../.agents/skills/image-gen/SKILL.md): the Codex CLI with Astra (`-m gpt-6-astra`), on Ben's Mac. Ben's words for this round: [round 6 picks](../../../product/words.md#2026-11-14-round-6-picks). He said the last round "took forever" and to "parallelize this way more", so speed is part of the job.

## The job

One UI board for each open decision R1 to R10 in [ledger.md](../../ledger.md): the options in use, side by side, differing only in that decision. A UX board as well for R5, R7, R8 and R9, where what the person does differs. Everything in the ledger's Locked and Decided rows is fixed on every board.

## Speed

- Start every board at once. Run as many Codex calls at a time as the machine and the subscription take; back off only when a call is refused.
- Per board: make the base once, then make all the other options at the same time as edits of that base.
- Two rounds at most. Stitch and commit each board the moment it is done, so it can be shown while the rest finish.
- Send one note when half the boards are in and one when all are.

## Inputs to make first (scripts, not the image model)

1. **True type sheets.** For R1, render each option's real fonts to a PNG with headless Chrome: the wordmark, a 36 heading, an 18 headline, 15 body, 13 caption, a button and "$31.40". Marist, Neue Montreal and Clofie are on this Mac; the system face is SF Pro. Attach the option's sheet to its generation, and put the four sheets in a strip at the bottom of the R1 board, because the image model does not draw typefaces faithfully.
2. **Square logos.** Download each marketplace's own site icon (apple-touch-icon, or the largest favicon) for eBay, Depop, Poshmark, Mercari and Facebook Marketplace. Save them as 1:1 PNGs in `assets/platforms/square/` with a README row for each source URL. Use them on every board.
3. **Color sheet.** Render `brand/tokens.css` as swatches: the field at its real colors, the family (tint, fill, deep for each hue), the state fills and the dark mode page. Attach it wherever color is judged.
4. **Grain references.** Look through `~/Downloads/inspiration photos` for Ben's references with grainy gradients and attach the closest two to R4. Name them in lineage.md. Don't commit them.

Also attach `brand/explore/round-6/boards/` crops where they help as a base: Ben picked from those screens.

## The loop, per board

1. Base, then the options in parallel.
2. One critic run in a fresh folder that sees only the images, `brand/constitution.md`, `brand/ledger.md` and the list under "How to judge".
3. Regenerate only what failed, once. Then stitch with a script: A, B, C and the option's name underneath, nothing else.

## How to judge

Fail an option only for these. Do not fail it for measurements a few points off.
- The options can't be told apart at board size, or they differ in something besides the decision.
- A locked row is broken: a platform named in words, a logo that isn't the square site icon, the wordmark not centered or not Marist, an item without its photo, lines on the gradient, a state without its icon.
- The gradient or a state fill is visibly brighter or more saturated than the color sheet. Round 6 drew the gradient near cyan and yellow; it is soft sky to lime.
- Words nobody wrote, or numbers that differ from: listed at $45, offered $38, you keep $31.40.
- Text too small to read at phone size, or misspelled.
- R3 only: the tag's word and icon must stay readable over a light photo and a dark one.
- R10 only: the dark screen must still read as the same brand next to the light one.

## Output

`brand/explore/round-7/boards/r1-ui.png` to `r10-ui.png`, and `r5-ux.png`, `r7-ux.png`, `r8-ux.png`, `r9-ux.png`. `rounds/` and `lineage.md` as in round 6. Push to `main` after each board; run `node .agents/check.mjs` first. Never commit reference images or font files.
