# Round 6 brand decision boards: lineage

Made 2026-11-14 from [brief.md](brief.md) with the [image-gen skill](../../../.agents/skills/image-gen/SKILL.md). Nothing here is approved; Ben picks. All images are generated. Logos, prices and names in them are not real data.

## Tool

Astra is the Codex model `gpt-6-astra` on Ben's subscription (listed in `~/.codex/models_cache.json`; the configured default is `gpt-6.1-sol`, so every call passes `-m gpt-6-astra`). Codex CLI 0.169.0. Every call ran outside Claude Code's sandbox, because inside it Codex cannot reach chatgpt.com.

```
codex exec --ephemeral --skip-git-repo-check -s workspace-write -m gpt-6-astra -C <board folder> "<prompt>" -i <input> ...
```

The orchestration and stitch scripts were run from a scratch folder and are not committed; every prompt they sent is saved as `rounds/<board>/r<n>/gen-prompt.txt` and `critic-prompt.txt`.

## The loop, as run

1. **Generate.** One Astra run per board per round. Round 1 makes the leaning option as the base, then edits the base into each other option with only the decision changed. The prompt gives the job, the decision and its options, the files to read (`brand/constitution.md`, `brand/tokens.css`, `brand/ledger.md`, `product/ui-constitution.md`), the inputs, the numbers ($45, $38, $31.40), the phone scale, and the brief's fail list. It leaves composition, layout and content to Astra.
2. **Critique.** A separate Astra run in a fresh folder that never sees the brief or the generator prompt. It gets only the option images and the paths of `brand/constitution.md` (Part IV and Article 13), `product/ui-constitution.md` and `brand/ledger.md`, and writes `critique.json` with each failure tied to a rule and a place.
3. **Fix.** The next generator run gets the critique and the failing images, and edits only those. Passing images are left alone.
4. **Stop** at no failures, at two rounds in a row with no new finding, or after round 4. The critic rewords its findings each round, so "no new finding" never triggered and every board ran 4 rounds.
5. **Best round.** When a board still failed, the board is stitched from the round with the fewest findings (ties go to the later round), not from the last round.
6. **Stitch.** A Python/Pillow script puts the options side by side with a letter and the option name underneath, nothing else. D4 and D5 have sub-decisions, so their boards have one row per sub-decision; each row's A is the same leaning base image.

Round images in `rounds/` are JPEG (quality 85) copies of the PNGs, to keep the repo small. The boards are PNG.

Two earlier starts were stopped and are not kept: the first before D6 and the new D2 and D5 options landed on main; the second after round 1, because a 1024x1536 canvas cannot be a 390 x 844 screen. From the third start on, each UI option draws the screen at 390:844 inside the canvas (1 point = 1.82 px), and each UX option at 1 point = 1.21 px.

## Inputs per board

References are not committed. Each call attaches at most five images:

- `ref-12`: `~/Downloads/inspiration photos/design/ref-12.jpg` (the sky to lime field)
- `ref-docket`: `~/Downloads/inspiration photos/some more references/jpg(12)` (Docket: color as category)
- `ref-sana`: `~/Downloads/inspiration photos/some more references/jpg(17)` (Sana: logos on mixed cards)
- `usage-app`: `brand/explore/round-5/showcase/usage-app.png`
- `brand`: brand sheet: `brand/explore/round-5/inputs/swatch.png` above `type.png`, stacked into one image
- `items`: item sheet: `assets/demo-items/` carhartt-jacket, nike-dunks, brass-lamp, kindle side by side
- `logos`: logo sheet: the five `assets/platforms/*.svg` in their brand colors, rendered with QuickLook, each with its name in gray underneath

| Board | Attached |
|---|---|
| D1 | `ref-docket`, `usage-app`, `brand`, `items`, `logos` |
| D2 | `ref-12`, `usage-app`, `brand`, `items`, `logos` |
| D3 | `ref-12`, `usage-app`, `brand`, `items`, `logos` |
| D4 | `ref-sana`, `usage-app`, `brand`, `items`, `logos` |
| D5 | `ref-12`, `usage-app`, `brand`, `items`, `logos` |
| D6 | `ref-12`, `usage-app`, `brand`, `items`, `logos` |

No other images in the inspiration folder were used.

## Boards, rounds and what still fails

Every board still fails the critic on something. "Findings" counts the critic's failures plus its across-option notes.

### d1-ui: [boards/d1-ui.png](boards/d1-ui.png)

State colors. Rounds: 4 (findings per round: r1: 6, r2: 5, r3: 6, r4: 6). Stitched from round 2. Still wrong in that round ([critique](rounds/d1-ui/r2/critique.json)):

- opt-A.png: Visible grain/mottling extends across the neutral UI and controls. This is outside a brand field, the only surface where the constitution allows texture.
- opt-A.png: The state hues retain the correct meanings, but their rendering drifts from the specified palette: the marigold is orange, the mint is a more saturated turquoise, the lime is brighter yellow-green, and the sky is a more saturated cyan. D1 changes fill versus dot treatment, not the underlying color values.
- opt-B.png: Visible grain/mottling extends across the neutral UI and controls. This is outside a brand field, the only surface where the constitution allows texture.
- opt-B.png: The state hues retain the correct meanings, but their rendering drifts from the specified palette: the marigold is orange, the mint is a more saturated turquoise, the lime is brighter yellow-green, and the sky is a more saturated cyan. D1 changes fill versus dot treatment, not the underlying color values.
- across opt-A.png, opt-B.png: Beyond the state-pill treatment, B shifts the Nike Dunks title and its money line slightly upward and the lower photo row slightly upward. These are small positioning differences, not content changes. Photos, wording, amounts, platform marks, offer actions and navigation otherwise appear unchanged.

### d1-ux: [boards/d1-ux.png](boards/d1-ux.png)

State colors. Rounds: 4 (findings per round: r1: 14, r2: 10, r3: 9, r4: 7). Stitched from round 4. Still wrong in that round ([critique](rounds/d1-ux/r4/critique.json)):

- opt-A.png: The field reads as a smooth two-color gradient without visible grain or fine mesh lines. It does not carry the required texture. This is a specific C2 failure; this single tell alone does not establish an Article 13 cluster.
- opt-A.png: The wordmark is oversized for the specified 21 px app role. Normalizing the approximately 470 px phone width to 390 px leaves roughly 26 px of visible letter height alone, before font ascenders/descenders and line height. It reads closer to a 30 px setting than 21 px. This is a visual size failure; font identity and weight cannot be established from the raster.
- opt-A.png: The button is a rounded rectangle with long straight vertical sides, rather than a pill. Its approximately 50 px height has corners around 16 px, visibly short of the half-height radius required for a pill.
- opt-B.png: The wordmark is oversized for the specified 21 px app role. Normalizing the approximately 470 px phone width to 390 px leaves roughly 26 px of visible letter height alone, before font ascenders/descenders and line height. It reads closer to a 30 px setting than 21 px. This is a visual size failure; font identity and weight cannot be established from the raster.
- opt-B.png: The button is a rounded rectangle with long straight vertical sides, rather than a pill. Its approximately 50 px height has corners around 16 px, visibly short of the half-height radius required for a pill.
- across opt-A.png, opt-B.png: Left phone offer field: A is smooth; B adds clearly visible curved mesh lines and changes the color blend. Texture belongs to brand/ledger.md D5, not D1, so the state-pill comparison also varies an unrelated open decision.
- across opt-A.png, opt-B.png: Right phone money highlight: B is brighter and greener than A, although this is the amount highlight, not a state pill. Median RGB in the same clear band patch (x1090–1110, y637–654) is (229,234,77) in A and (220,245,63) in B. The D1 comparison changes the money treatment as well.

### d2-ui: [boards/d2-ui.png](boards/d2-ui.png)

Typefaces. Rounds: 4 (findings per round: r1: 17, r2: 19, r3: 11, r4: 21). Stitched from round 3. Still wrong in that round ([critique](rounds/d2-ui/r3/critique.json)):

- opt-A.png: The phone canvas is approximately 744 pixels wide by 1536 high. At 390 wide that is approximately 805 high, rather than the required 844. This board does not supply the required true-scale phone view.
- opt-A.png: Visible paper-like grain and mottling extend outside the gradient field. Texture is permitted only on the field.
- opt-B.png: The phone canvas is approximately 748 pixels wide by 1536 high. At 390 wide that is approximately 801 high, rather than the required 844. This board does not supply the required true-scale phone view.
- opt-B.png: Visible paper-like grain and mottling extend outside the gradient field. Texture is permitted only on the field.
- opt-B.png: The field reads as a smooth color blend, with no distinct grain or mesh-line treatment at phone viewing size. The visible line texture in A and C is absent. This fails the field-texture requirement; the flat-gradient tell alone does not establish an Article 13 cluster.
- opt-C.png: The phone canvas is approximately 743 pixels wide by 1536 high. At 390 wide that is approximately 806 high, rather than the required 844. This board does not supply the required true-scale phone view.
- opt-C.png: Visible paper-like grain and mottling extend outside the gradient field. Texture is permitted only on the field.
- across opt-A.png, opt-B.png, opt-C.png: brand/constitution.md Article 14.4 and brand/ledger.md D2: the options do not isolate typefaces. B removes the visible curved line texture from the offer field; A and C retain it. Texture is the separate open decision D5.
- across opt-A.png, opt-B.png, opt-C.png: The surrounding presentation ground changes: A and B have cool blue-gray gutters; C has warmer neutral-gray gutters. The white phone boundaries and content positions also shift slightly. Neither change belongs to D2.
- across opt-A.png, opt-B.png, opt-C.png: The item photography is not held exactly constant. C changes small details of the jacket folds and shoe laces/crop compared with A and B. These changes are unrelated to typefaces.
- across opt-A.png, opt-B.png, opt-C.png: The lime band below $31.40 is shorter in B than in A and C. This may follow the changed text metrics, but it changes the visible amount of color as well as the typography.

### d2-ux: [boards/d2-ux.png](boards/d2-ux.png)

Typefaces. Rounds: 4 (findings per round: r1: 13, r2: 13, r3: 10, r4: 8). Stitched from round 4. Still wrong in that round ([critique](rounds/d2-ux/r4/critique.json)):

- opt-A.png: The large bright field is the dominant visual mass, ahead of the item photo and either money amount. The amounts remain ordinary lines within it. The field itself wins the squint test, whereas E1 requires the item or money to lead. This is a visual hierarchy judgment, not a contrast failure.
- opt-A.png: The content does not keep the specified 20 pt app margins. The left phone spans approximately x174–648 (474 px); its field spans x196–631, giving about 18 pt left and 14 pt right when normalized to 390 pt. The right phone similarly has about 16 pt left and 13 pt right. These are visibly unequal and are not the required 20 pt margins; small raster-edge uncertainty does not account for the right-side shortfall.
- opt-A.png: The field reads as a smooth gradient without discernible grain or mesh lines. C2 requires visible texture. This is one Article 13 tell, not by itself evidence of an AI-tell cluster.
- opt-B.png: The large bright field is the dominant visual mass, ahead of the item photo and either money amount. The amounts remain ordinary lines within it. The field itself wins the squint test, whereas E1 requires the item or money to lead. This is a visual hierarchy judgment, not a contrast failure.
- opt-B.png: The content does not keep the specified 20 pt app margins. The left phone spans approximately x174–648 (474 px); its field spans x196–631, giving about 18 pt left and 14 pt right when normalized to 390 pt. The right phone similarly has about 16 pt left and 13 pt right. These are visibly unequal and are not the required 20 pt margins; small raster-edge uncertainty does not account for the right-side shortfall.
- opt-C.png: The large bright field is the dominant visual mass, ahead of the item photo and either money amount. The amounts remain ordinary lines within it. The field itself wins the squint test, whereas E1 requires the item or money to lead. This is a visual hierarchy judgment, not a contrast failure.
- opt-C.png: The content does not keep the specified 20 pt app margins. The left phone spans approximately x174–648 (474 px); its field spans x196–631, giving about 18 pt left and 14 pt right when normalized to 390 pt. The right phone similarly has about 16 pt left and 13 pt right. These are visibly unequal and are not the required 20 pt margins; small raster-edge uncertainty does not account for the right-side shortfall.
- across opt-A.png, opt-B.png, opt-C.png: Field texture changes along with D2: A looks smooth, B has clearly visible fine curved/diagonal lines, and C has subtler lines. This changes the open D5 texture decision during a typeface comparison, contrary to brand/constitution.md Article 14.4 and brand/ledger.md introductory rule that options vary the named open decision. The stronger texture in B is especially visible above and to the right of the offer text.

### d3-ui: [boards/d3-ui.png](boards/d3-ui.png)

Spacing. Rounds: 4 (findings per round: r1: 15, r2: 13, r3: 10, r4: 9). Stitched from round 4. Still wrong in that round ([critique](rounds/d3-ui/r4/critique.json)):

- opt-A.png: The rules are pale blue rather than neutral black at 8%. Sampled separator pixels at x=600 are RGB (223,230,238) in A, (219,227,236) in B and (213,224,237) in C. Colored lines on white are prohibited; these are not logos, alerts or unread dots.
- opt-B.png: The rules are pale blue rather than neutral black at 8%. Sampled separator pixels at x=600 are RGB (223,230,238) in A, (219,227,236) in B and (213,224,237) in C. Colored lines on white are prohibited; these are not logos, alerts or unread dots.
- opt-C.png: The rules are pale blue rather than neutral black at 8%. Sampled separator pixels at x=600 are RGB (223,230,238) in A, (219,227,236) in B and (213,224,237) in C. Colored lines on white are prohibited; these are not logos, alerts or unread dots.
- opt-C.png: Related parts exceed the specified 4–12 pt internal spacing. With the 710-pixel-wide phone normalized to 390 pt, the jacket-to-offer gap is about 20 pt (image y=383–419), and the lamp-to-actions gap is about 16 pt (y=1166–1195). The controls become detached from the items they act on. D3 permits a density choice but does not suspend the internal-grouping rule.
- across opt-A.png, opt-B.png, opt-C.png: The product photographs change, not just their placement. The jacket folds and framing, shoe positions and floor detail, and lamp framing differ. This changes the content used to judge density. brand/ledger.md D3 and brand/constitution.md Article 14.4 call for options on the named spacing axis.
- across opt-A.png, opt-B.png, opt-C.png: The offer field changes texture: B has clearly visible diagonal lines, while A and C have a softer, less distinct texture. Field appearance belongs to ledger D5, not D3 (brand/constitution.md Article 14.4).
- across opt-A.png, opt-B.png, opt-C.png: The state fills vary: A has a more saturated turquoise Live pill and a brighter yellow Sold pill; B and C use quieter fills. The blue separator tint also differs. These are color changes, outside D3; state colors are governed by ledger A1 and constitution Article 5.
- across opt-A.png, opt-B.png, opt-C.png: A has a full-width horizontal boundary above the bottom navigation; B and C omit it. This changes the navigation surface treatment, not spacing (ledger D3; constitution Article 14.4).
- across opt-A.png, opt-B.png, opt-C.png: C moves the entire bottom navigation and home indicator upward compared with A and B, although the canvas and top system bar remain fixed. The system safe-area framing changes along with content density; it is governed by constitution Article 7.6 and Part III, rather than the D3 component-spacing choice.

### d3-ux: [boards/d3-ux.png](boards/d3-ux.png)

Spacing. Rounds: 4 (findings per round: r1: 17, r2: 17, r3: 13, r4: 12). Stitched from round 4. Still wrong in that round ([critique](rounds/d3-ux/r4/critique.json)):

- opt-A.png: The wordmark sits left of the screen's center. Its center is around x=319, while the center tab and home indicator establish the screen center around x=337. The right screen does not have the same offset.
- opt-A.png: Draft is rendered with black text. The decided Draft treatment requires gray text on a white pill with a hairline outline.
- opt-A.png: The connecting arrow emerges from the top edge of Counter, although the tap marker is on Accept $38. The board visually connects countering to a completed sale and payout, contradicting the action indicated by the tap marker.
- opt-B.png: The wordmark sits left of the screen's center. Its center is around x=319, while the center tab and home indicator establish the screen center around x=337. The right screen does not have the same offset.
- opt-B.png: Draft is rendered with black text. The decided Draft treatment requires gray text on a white pill with a hairline outline.
- opt-B.png: The connecting arrow emerges from the top edge of Counter, although the tap marker is on Accept $38. The board visually connects countering to a completed sale and payout, contradicting the action indicated by the tap marker.
- opt-C.png: The wordmark sits left of the screen's center. Its center is around x=319, while the center tab and home indicator establish the screen center around x=337. The right screen does not have the same offset.
- opt-C.png: Draft is rendered with black text. The decided Draft treatment requires gray text on a white pill with a hairline outline.
- opt-C.png: The connecting arrow emerges from the top edge of Counter, although the tap marker is on Accept $38. The board visually connects countering to a completed sale and payout, contradicting the action indicated by the tap marker.
- across opt-A.png, opt-B.png, opt-C.png: The offer field's texture changes: A is soft and cloudy with little visible linework; B has prominent curved mesh lines; C has much fainter lines. Texture belongs to ledger D5, not D3. This also changes the visual evidence for constitution B5 and Article 13's flat-gradient check.
- across opt-A.png, opt-B.png, opt-C.png: The item imagery is not held constant. C uses a closer jacket crop with a different visible arrangement of folds, and its Nike shoes appear substantially whiter than the gray shoes in A and B. Lamp framing also changes. These differences affect item prominence independently of spacing (constitution Article 14.4 requires variants on one named axis).
- across opt-A.png, opt-B.png, opt-C.png: The sale amount is visibly smaller in A than in B and C; its lime band also changes width. The peak amount's size and treatment are not the D3 spacing decision (ledger A3 and D6; constitution Article 14.4).

### d4-ui: [boards/d4-ui.png](boards/d4-ui.png)

Surfaces and small parts. Rounds: 4 (findings per round: r1: 24, r2: 18, r3: 12, r4: 24). Stitched from round 3. Still wrong in that round ([critique](rounds/d4-ui/r3/critique.json)):

- opt-base.png: The decided state fills have drifted. Sold is a brighter yellow-green and Live a brighter turquoise than the specified lime #E6EA6A and mint #88DCB9. Representative interior pixel medians are #DAEC6D and #80E9C5. D4 opens the shape and enclosure, not the A1 state colors.
- opt-cards-B.png: The decided state fills have drifted. Sold is a brighter yellow-green and Live a brighter turquoise than the specified lime #E6EA6A and mint #88DCB9. Representative interior pixel medians are #D5EF67 and #64EBC7. D4 opens the shape and enclosure, not the A1 state colors.
- opt-cards-B.png: The field becomes a filled panel inside a bordered card. It is an additional container around the buttons, not one of B19’s exceptions for photos, buttons, state pills or money highlights. The hairline card option does not itself fail; this nested panel does.
- opt-marks-B.png: The decided state fills have drifted. Sold is a brighter yellow-green and Live a brighter turquoise than the specified lime #E6EA6A and mint #88DCB9. Representative interior pixel medians are #D6EC64 and #76E9C2. D4 opens the shape and enclosure, not the A1 state colors.
- opt-state-B.png: The decided state fills have drifted. Sold is a brighter yellow-green and Live a brighter turquoise than the specified lime #E6EA6A and mint #88DCB9. Representative interior pixel medians are #D3FB45 and #38F5BD. D4 opens the shape and enclosure, not the A1 state colors.
- opt-state-B.png: At phone scale the field reads as a smooth gradient; the visible mesh carried by the base image has disappeared. The required perceptible grain or mesh is missing. Texture is a D5 choice and was not the axis opened here.
- opt-state-C.png: The decided state fills have drifted. Sold is a brighter yellow-green and Live a brighter turquoise than the specified lime #E6EA6A and mint #88DCB9. Representative interior pixel medians are #D8F960 and #77EFD1. D4 opens the shape and enclosure, not the A1 state colors.
- across opt-base.png, opt-cards-B.png, opt-marks-B.png, opt-state-B.png, opt-state-C.png: State hue and saturation vary as well as state shape. The Dot and Corner tag versions are especially fluorescent compared with the base. This changes the decided A1 palette during a D4 comparison.
- across opt-base.png, opt-cards-B.png, opt-state-B.png, opt-state-C.png: The offer field changes independently of the named option: the base has clear crossing mesh lines, Hairline cards and Corner tag have weaker texture, and Dot reads smooth. The lime end also becomes brighter. These are D5 texture/palette differences.
- across opt-base.png, opt-cards-B.png: The product images are not held fixed. The shoes change in their crop, proportions and visible arrangement; the lamp photo also changes its framing. These changes affect the item-led comparison independently of the new card outlines.
- across opt-base.png, opt-cards-B.png: Content spacing changes within the lower items. The Nike image starts around y=665 rather than y=659, and the lamp around y=1019 rather than y=1006, while their action rows stay almost at the original heights. Card internal padding is also visibly inconsistent: the first card has much more space above its photo than the other two. This is more than adding outlines to otherwise fixed rows (brand/ledger.md D3 remains separate). Coordinates refer to the supplied 1024 x 1536 images.
- across opt-base.png, opt-state-B.png, opt-state-C.png: The bottom navigation shifts upward: its top divider is around y=1378 in the base, y=1375 in Dot, and y=1371 in Corner tag. The icons, labels and home indicator move with it. State shape does not require this shell change.

### d4-ux: [boards/d4-ux.png](boards/d4-ux.png)

Surfaces and small parts. Rounds: 4 (findings per round: r1: 20, r2: 16, r3: 26, r4: 20). Stitched from round 2. Still wrong in that round ([critique](rounds/d4-ux/r2/critique.json)):

- opt-base.png: The board does not provide a 390 × 844 pt screen anchor. The depicted screens are visibly too wide for their height: the navigation spans roughly 540 image pixels while the full screen height is roughly 1000. Scaling that width to 390 gives a height of roughly 720, not 844. Consequently this board cannot establish the required true-size density, type sizes or spacing.
- opt-base.png: The large empty vertical gap between a title and its own platform mark exceeds the separation between neighboring item rows. Internal elements are farther apart than separate items, reversing the required grouping hierarchy. This persists with the outlined cards and with the added status text in the Dot option.
- opt-cards-B.png: The board does not provide a 390 × 844 pt screen anchor. The depicted screens are visibly too wide for their height: the navigation spans roughly 540 image pixels while the full screen height is roughly 1000. Scaling that width to 390 gives a height of roughly 720, not 844. Consequently this board cannot establish the required true-size density, type sizes or spacing.
- opt-cards-B.png: The large empty vertical gap between a title and its own platform mark exceeds the separation between neighboring item rows. Internal elements are farther apart than separate items, reversing the required grouping hierarchy. This persists with the outlined cards and with the added status text in the Dot option.
- opt-cards-B.png: The cards variant also replaces the faint field lines with a much stronger, denser, curved mesh. Field texture is D5, not the card-surface choice in D4; the added texture makes this an uncontrolled comparison.
- opt-marks-B.png: The board does not provide a 390 × 844 pt screen anchor. The depicted screens are visibly too wide for their height: the navigation spans roughly 540 image pixels while the full screen height is roughly 1000. Scaling that width to 390 gives a height of roughly 720, not 844. Consequently this board cannot establish the required true-size density, type sizes or spacing.
- opt-marks-B.png: The large empty vertical gap between a title and its own platform mark exceeds the separation between neighboring item rows. Internal elements are farther apart than separate items, reversing the required grouping hierarchy. This persists with the outlined cards and with the added status text in the Dot option.
- opt-state-B.png: The board does not provide a 390 × 844 pt screen anchor. The depicted screens are visibly too wide for their height: the navigation spans roughly 540 image pixels while the full screen height is roughly 1000. Scaling that width to 390 gives a height of roughly 720, not 844. Consequently this board cannot establish the required true-size density, type sizes or spacing.
- opt-state-B.png: The large empty vertical gap between a title and its own platform mark exceeds the separation between neighboring item rows. Internal elements are farther apart than separate items, reversing the required grouping hierarchy. This persists with the outlined cards and with the added status text in the Dot option.
- opt-state-C.png: The board does not provide a 390 × 844 pt screen anchor. The depicted screens are visibly too wide for their height: the navigation spans roughly 540 image pixels while the full screen height is roughly 1000. Scaling that width to 390 gives a height of roughly 720, not 844. Consequently this board cannot establish the required true-size density, type sizes or spacing.
- opt-state-C.png: The large empty vertical gap between a title and its own platform mark exceeds the separation between neighboring item rows. Internal elements are farther apart than separate items, reversing the required grouping hierarchy. This persists with the outlined cards and with the added status text in the Dot option.
- across opt-base.png, opt-cards-B.png: Beyond adding card outlines, Hairline cards changes the left field from faint diagonal lines to dense curved mesh lines, makes its right edge wider, and gives it a straight vertical left edge beside the jacket. The lower item titles shift left, the inter-row spacing changes, and the bottom-navigation rule extends farther sideways. These also change field treatment and D3 spacing.
- across opt-base.png, opt-marks-B.png: Beyond enclosing platform marks, In a bubble cuts a white notch into the offer field around the Depop mark. The eBay wordmarks are smaller and move upward within their rows. On the sold view, “You keep” is larger, lighter and higher. The field silhouette, logo scale/position and text styling therefore change along with the enclosure.
- across opt-base.png, opt-state-B.png: Dot adds Live and Shipping as text beneath the lower item titles and adds Sold beneath the jacket title, while Offer is conveyed by the existing offer text. This is a supporting layout/content change to the state treatment, not a photo-marker-only swap. The supporting words do mean that the colored dots are not the only state indication.
- across opt-base.png, opt-state-C.png: Corner tag also moves “You keep” upward and changes its gap above the sale amount. That sale-text spacing is unrelated to replacing photo pills with corner tags.
- across opt-base.png, opt-cards-B.png, opt-marks-B.png, opt-state-B.png, opt-state-C.png: Review scope: these are Today screens, so ledger L12’s Sell-grid requirement is not a failure here. The visible More controls satisfy the presence of a third action; their menu contents cannot be verified from this board. Article 13 does not establish an AI-tell cluster merely from the authorized pills, cards or bubbles. B25’s side-by-side default comparison was not supplied. Source-only checks B13, B15, B22 and B27 are not applicable to these raster images; exact font, token and logo-asset compliance is not certified.

### d5-ui: [boards/d5-ui.png](boards/d5-ui.png)

The field. Rounds: 4 (findings per round: r1: 17, r2: 20, r3: 17, r4: 26). Stitched from round 3. Still wrong in that round ([critique](rounds/d5-ui/r3/critique.json)):

- opt-base.png: The visible app viewport has a 728:1536 aspect ratio. At 390 px wide it is approximately 823 px tall, not the required 844. These boards do not provide the required 390 × 844 true-scale anchor.
- opt-base.png: The main outer inset is about 31 image pixels, or 17 px at a 390 px app width, rather than the specified 20 px. This affects all options, independently of field placement or texture.
- opt-base.png: The labels begin around x=210 while the action row begins around x=179. These sibling sections of the same transaction have different start edges without a separate column. The other options move the labels to the action rail.
- opt-where-B.png: The visible app viewport has a 728:1536 aspect ratio. At 390 px wide it is approximately 823 px tall, not the required 844. These boards do not provide the required 390 × 844 true-scale anchor.
- opt-where-B.png: The main outer inset is about 31 image pixels, or 17 px at a 390 px app width, rather than the specified 20 px. This affects all options, independently of field placement or texture.
- opt-where-C.png: The visible app viewport has a 728:1536 aspect ratio. At 390 px wide it is approximately 823 px tall, not the required 844. These boards do not provide the required 390 × 844 true-scale anchor.
- opt-where-C.png: The main outer inset is about 31 image pixels, or 17 px at a 390 px app width, rather than the specified 20 px. This affects all options, independently of field placement or texture.
- opt-texture-B.png: The visible app viewport has a 728:1536 aspect ratio. At 390 px wide it is approximately 823 px tall, not the required 844. These boards do not provide the required 390 × 844 true-scale anchor.
- opt-texture-B.png: The main outer inset is about 31 image pixels, or 17 px at a 390 px app width, rather than the specified 20 px. This affects all options, independently of field placement or texture.
- opt-texture-C.png: The visible app viewport has a 728:1536 aspect ratio. At 390 px wide it is approximately 823 px tall, not the required 844. These boards do not provide the required 390 × 844 true-scale anchor.
- opt-texture-C.png: The main outer inset is about 31 image pixels, or 17 px at a 390 px app width, rather than the specified 20 px. This affects all options, independently of field placement or texture.
- opt-texture-C.png: The high-contrast repeated lines run directly through both text areas and become a competing foreground pattern. The field asks for attention independently of the money it is meant to support; the amount remains readable, but the texture fails the calm, subordinate role.
- across opt-base.png, opt-where-B.png, opt-where-C.png, opt-texture-B.png, opt-texture-C.png: The jacket photograph is not held fixed: fold details, collar shape, highlights and the floor change between renders. This is unrelated to D5 and weakens a controlled comparison of the field.
- across opt-base.png, opt-where-B.png, opt-where-C.png, opt-texture-B.png, opt-texture-C.png: In opt-base.png, Listed at, Offered and Ship by Tuesday begin around x=210. In the other four images they begin around x=179. The price values and action row stay approximately fixed. This changes alignment independently of D5.
- across opt-base.png, opt-where-B.png, opt-where-C.png: The payout text moves from approximately x=221 in the base to x=194 in both placement variants; the amount also varies slightly in width. Field placement is therefore accompanied by changed text inset and typography geometry.
- across opt-base.png, opt-where-C.png: Whole moment also makes the gradient substantially paler and fades it toward white. The comparison changes color strength as well as coverage. Its greater-than-one-third coverage is the explicit ledger D5 proposal, so it is not counted as a failure of the existing ceiling.
- across opt-base.png, opt-texture-B.png, opt-texture-C.png: Strong lines changes the gradient itself toward brighter cyan and more saturated yellow-green, in addition to changing line density and contrast. Medium lines also shifts the curve placement. The texture comparison does not hold the underlying color field fixed.

### d5-ux: [boards/d5-ux.png](boards/d5-ux.png)

The field. Rounds: 4 (findings per round: r1: 27, r2: 29, r3: 27, r4: 13). Stitched from round 4. Still wrong in that round ([critique](rounds/d5-ux/r4/critique.json)):

- opt-base.png: The Live fill is a brighter, yellower green than the decided mint. This is visible in every option; sampled interior pixels in the left pills are around RGB (134–145, 231–242, 157–169), rather than (136, 220, 185). D5 does not reopen state colors.
- opt-where-B.png: The Live fill is a brighter, yellower green than the decided mint. This is visible in every option; sampled interior pixels in the left pills are around RGB (134–145, 231–242, 157–169), rather than (136, 220, 185). D5 does not reopen state colors.
- opt-where-B.png: The field extends behind the jacket photo, with only a narrow white frame separating them. The top-card options cut the field away from the photo area; this option instead puts the photo within the color event. The D5 header-band option does not explicitly waive the photo separation rule.
- opt-where-C.png: The Live fill is a brighter, yellower green than the decided mint. This is visible in every option; sampled interior pixels in the left pills are around RGB (134–145, 231–242, 157–169), rather than (136, 220, 185). D5 does not reopen state colors.
- opt-where-C.png: The large bright ground becomes the dominant visual mass and carries equal color emphasis behind the sold jacket, the live shoes and the draft lamp. It dilutes the focus on the sold item and the amount kept. Exceeding one-third coverage is explicitly part of D5, so the coverage itself is not counted as a failure.
- opt-where-C.png: The field surrounds and runs behind the jacket photo rather than moving away from it; the white photo frame does not create the cutaway used in the left phone.
- opt-texture-B.png: The Live fill is a brighter, yellower green than the decided mint. This is visible in every option; sampled interior pixels in the left pills are around RGB (134–145, 231–242, 157–169), rather than (136, 220, 185). D5 does not reopen state colors.
- opt-texture-C.png: The Live fill is a brighter, yellower green than the decided mint. This is visible in every option; sampled interior pixels in the left pills are around RGB (134–145, 231–242, 157–169), rather than (136, 220, 185). D5 does not reopen state colors.
- across opt-base.png, opt-where-B.png, opt-where-C.png, opt-texture-B.png, opt-texture-C.png: Unrelated to D5, the Live pills change green hue and width across options. The left pill is especially vivid in Header band; the texture options also change its color. These are state-color and component changes, not field placement or texture.
- across opt-base.png, opt-where-B.png, opt-where-C.png: The jacket photo crop and white surround change with placement. In Header band and the right Whole moment phone, the jacket has a rounded white frame on all sides; in the base it meets a larger white cutaway above and to its left. Some of that follows field placement, but the photo framing also changes, so placement is not isolated.
- across opt-base.png, opt-texture-B.png, opt-texture-C.png: The texture comparisons also change the field color balance, photo/cutaway edges and Live-pill color. Strong lines has a flatter, sharper white shelf under the jacket photo, most visible on the right phone, compared with the more rounded transition in Medium lines. Those changes are outside the texture-strength decision.
- across opt-texture-B.png, opt-texture-C.png: Medium and Strong are not clearly separated in visible line strength at the supplied scale. Both use prominent white arcs in the same corners; arc placement and count vary more clearly than thickness or contrast. The labels imply a strength comparison that the boards do not clearly show.
- across opt-base.png, opt-where-B.png, opt-where-C.png, opt-texture-B.png, opt-texture-C.png: Review limits: these are raster boards. B13, B15, B22 and B27 are not applicable under Part IV because they require source. Hidden More actions, target behavior and content provenance cannot be verified here. Article 13 was checked for visible tell clusters; no separate cluster failure is established. B25 has no supplied no-brand comparison, so its matching-axis threshold is not verified. Today is selected, so the lower item rows are not a violation of the Sell-grid requirement L12. White offer/Sold pills on the field follow C2 and are not state-color failures.

### d6-ui: [boards/d6-ui.png](boards/d6-ui.png)

The peak amount on a sale. Rounds: 4 (findings per round: r1: 13, r2: 15, r3: 18, r4: 6). Stitched from round 4. Still wrong in that round ([critique](rounds/d6-ui/r4/critique.json)):

- opt-A.png: A visible fine grain/mottled texture covers the white page outside the sky-to-lime field. Texture is explicitly confined to the field.
- opt-B.png: A visible fine grain/mottled texture covers the white page outside the sky-to-lime field. Texture is explicitly confined to the field.
- opt-B.png: The listing title is visibly heavier than its supporting text and than the same title in A and C. This introduces weight-based hierarchy on a listing title, where the rules require regular text and reserve medium for buttons and the selected tab. This is a visual finding, not a claim about the numeric font weight; source-dependent check B13 is not applicable to these raster images.
- opt-C.png: A visible fine grain/mottled texture covers the white page outside the sky-to-lime field. Texture is explicitly confined to the field.
- across opt-A.png, opt-B.png, opt-C.png: Beyond D6, B makes the jacket title visibly heavier; A and C retain the lighter title. This violates the one-axis comparison required by brand/constitution.md Article 14.4. The amount face and lime-band changes themselves are authorized by ledger row D6.
- across opt-A.png, opt-B.png, opt-C.png: Fine raster/grain differences also occur outside the amount, including above and below it; pixel comparison confirms the files are not identical outside D6. No other substantive change in copy, layout, photo composition, controls or navigation is apparent. Exact font identity, computed weights, icon provenance and locale implementation cannot be established from the images (Part IV: B13, B15, B22 and B27 are not applicable).

### d6-ux: [boards/d6-ux.png](boards/d6-ux.png)

The peak amount on a sale. Rounds: 4 (findings per round: r1: 7, r2: 10, r3: 19, r4: 14). Stitched from round 1. Still wrong in that round ([critique](rounds/d6-ux/r1/critique.json)):

- opt-A.png: The depicted transition makes printing a label appear to put the parcel on its way. No handoff or shipment event is shown between those states. As an annotated experience board, it communicates a misleading consequence for the action.
- opt-A.png: At a screen width of 390, the visible amount glyphs are roughly 55–60 px tall, already taller than the specified 50 px type size. The peak amount is oversized in all three options. This is a raster-scale observation; exact font metrics cannot be verified without source.
- opt-B.png: The depicted transition makes printing a label appear to put the parcel on its way. No handoff or shipment event is shown between those states. As an annotated experience board, it communicates a misleading consequence for the action.
- opt-B.png: At a screen width of 390, the visible amount glyphs are roughly 55–60 px tall, already taller than the specified 50 px type size. The peak amount is oversized in all three options. This is a raster-scale observation; exact font metrics cannot be verified without source.
- opt-C.png: The depicted transition makes printing a label appear to put the parcel on its way. No handoff or shipment event is shown between those states. As an annotated experience board, it communicates a misleading consequence for the action.
- opt-C.png: At a screen width of 390, the visible amount glyphs are roughly 55–60 px tall, already taller than the specified 50 px type size. The peak amount is oversized in all three options. This is a raster-scale observation; exact font metrics cannot be verified without source.
- across opt-A.png, opt-B.png, opt-C.png: Small raster variations occur outside the two peak-amount regions, including text edges, photo texture and the field. A full pixel comparison confirms the boards are not identical outside D6. Visual inspection finds no material change to wording, action set, photo subject, annotation paths or layout; the meaningful variation remains the amount face and lime band.

