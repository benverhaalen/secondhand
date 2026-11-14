# Round 5 showcases: review

Stage 1 brand iteration (ui-factory). Six images in [showcase/](showcase/), made from [inputs/prompts.md](inputs/prompts.md); how each was made is in [showcase/lineage.md](showcase/lineage.md). This page is the agent's read against [../../constitution.md](../../constitution.md). Nothing here is approved. Ben picks and marks; his words go to `brand/corrections.md`.

## Read, image by image

| Image | What holds (constitution code) | What drifts (rule broken) |
|---|---|---|
| usage-app.png | Strongest. Centered wordmark (C1), field on the top card only (C2), photos lead (C3), black pill with the amount, outline second, ··· (C4), real-looking logos (C5), lime band on what you keep (C6). | Titles read as medium weight (Art. 6, two weights). A stray red icon. The lime band is thin. The suggested reply runs long (Art. 12). |
| style-tile.png | Coherent palette and type pairing. Field, pills and state fills match tokens.css. | The card sits in a gray box (Art. 7, no box in a box). "Sold on Depop" written as a word instead of the logo (C5). Facebook shown as a generic store icon. |
| element-collage.png | Cards with photo, plain headline, context line, one black pill. The "Sold, you keep $31.40" field banner with Marist italic is the best single use of the field so far. State pills match the state table. | Invented taglines: "Your next move, made simple." and "One photo. Five marketplaces." (Art. 12, Art. 13). Serif card titles where the app uses the text face (Art. 6). Generic tab labels Home, Listings, Activity, You. Left-aligned wordmark is fine for a collage. |
| usage-post.png | Photo leads at full width, field frame, Depop mark, "you keep" in Marist italic with the lime highlight (C6). The strongest non-app piece. | Field lines barely show (C2 texture). The jacket lost its Carhartt patch (Art. 8, the item has to be the item). $38.70 here vs $31.40 elsewhere for the same jacket. |
| usage-web.png | The field as a hero ground, the black pill, the phone card reusing the app card. | Invented headline "One photo. Sold everywhere." (Art. 12). Facebook as a generic store icon (C5). A photo strip with no job (Art. 1). Left wordmark is acceptable on web (C1 covers the app nav). |
| default.png | The no-brand control, made with no references or brand inputs. It shows what an image model reaches for when told nothing. | See the never list below. |

## Never candidates from default.png (for Ben to mark keep or never)

1. An invented name ("Swaply").
2. Purple plus forest green on lavender and cream.
3. Poppins with Lora.
4. Spaced uppercase labels ("THE AI RESALE APP FOR…").
5. A handwritten script tagline.
6. Torn paper edges, sparkle and burst marks.
7. Stock photo of a smiling student with a laptop.
8. "Used" badges and heart buttons on item cards.
9. A generic icon row and an arrows-to-boxes flow diagram.

Every one of these already maps to an Article 13 tell. Ben's marks decide whether they become hard rules in `brand/rules/`.

## Next round changes (agent proposal, after Ben reacts)

- No taglines or headlines the brief did not give. Give the exact copy, or ask for none.
- Titles at regular weight; the text face for app titles, Marist only for display.
- Logos, never platform names in words; Facebook as its f mark.
- Stronger field lines on the post; one set of numbers across all images ($45 sold, $38 offer, $31.40 kept).
- No box around a card. Keep the Carhartt patch (attach the demo photo, not a description).
