# Round 7 brand decision boards: lineage

Made 2026-11-14 from [brief.md](brief.md) with the [image-gen skill](../../../.agents/skills/image-gen/SKILL.md). Ben's words for this round: [round 6 picks](../../../product/words.md#2026-11-14-round-6-picks). Nothing here is approved. All screens are generated; logos are the real square site icons in [assets/platforms/square/](../../../assets/platforms/square/); prices and names are demo data.

## Tool and inputs

Codex CLI 0.169.0 with `-m gpt-6-astra` (Astra) on Ben's subscription, run outside Claude Code's sandbox (inside it Codex cannot reach chatgpt.com):

```
codex exec --ephemeral --skip-git-repo-check -s workspace-write -m gpt-6-astra -C <option folder> "<prompt>" -i <input> ...
```

Inputs, made by script before any image call:
- `inputs/type-A.png` to `type-D.png`: each R1 option's real fonts rendered with headless Chrome (fresh temporary profile) at 2x: Marist Book (ABC Marist trial), Neue Montreal Regular and Medium, SF Pro (`/System/Library/Fonts/SFNS.ttf`), Clofie SemiBold (1001fonts). Font files are not committed. The R1 board shows these four sheets as a strip under the screens, because the image model does not draw typefaces faithfully.
- `inputs/colors.png`: `brand/tokens.css` rendered as swatches (the field without lines, the family, the state fills, the dark page).
- `inputs/logos-square.png`: the five site icons, sources in [assets/platforms/square/README.md](../../../assets/platforms/square/README.md).
- Base screens: round 6 images Ben picked from: `rounds/d2-ui/r3/opt-A` (Today), `rounds/d1-ui/r2/opt-A` (Sell), `rounds/d6-ui/r4/opt-A` (sold moment), all under `../round-6/`.
- Grain references for R4 (not committed): `~/Downloads/inspiration photos/inspirations 2/Home _ X.jpg` (Alex Cristache's grainy gradient panels) and `inspirations 2/jpg(8)` (the blurred orange gradient moodboard).
- Demo item photos: `assets/demo-items/` as one sheet.

Each call attached at most five images: the base (or, for an option, the board's base image), the R1 type sheet where it applies, the color sheet, the logo sheet, and the item sheet or the two grain references. Every prompt is saved as `gen-prompt.txt` beside its round images.

## The loop, as run

1. All 14 boards started at once. Per board: the leaning option as the base, then every other option at the same time, each an edit of the base.
2. One critic per board in a fresh folder: only the option images, `brand/constitution.md`, `brand/ledger.md` and the brief's "How to judge" list.
3. Each failing option regenerated once, all at the same time. Then stitched (A, B, C and the name, nothing else) and pushed to main straight away.
4. After the push, a second critic run on the fixed images, for this record only.

Rounds are in `rounds/<board>/r1` and `r2` (JPEG quality 85 copies, prompts, critiques).

## Timing

Every Codex call was logged with its board, option, round, role, start, end and how many calls were running when it started (`calls.jsonl` in the scratch folder; summarized here).

- Calls: 110. Refused: 0. Retried: 0. Time lost to refusals: 0 s.
- Most calls running at once: 28, with no refusal. The limit was set to 40.
- Base images: 17 calls, median 102 s, range 84 to 162 s.
- Option edits: 29 calls, median 76 s, range 54 to 297 s.
- Fixes: 34 calls, median 78 s, range 59 to 210 s.
- Critiques: 30 calls, median 52 s, range 38 to 138 s.
- Wall time, first call to last: 16:54:46 to 17:13:59 (19.2 min), including the R8 and R10 redos and the record-only second critiques.

| Board | Start | Pushed | Minutes to push | Calls | Fixed in round 2 |
|---|---|---|---|---|---|
| r1-ui | 16:54:46 | 17:00:17 | 5.5 | 10 | A, B, C, D |
| r10-ui | 16:54:46 | 16:59:15 | 4.5 | 10 | A |
| r2-ui | 16:54:46 | 16:58:20 | 3.6 | 4 | none |
| r3-ui | 16:54:46 | 16:58:25 | 3.7 | 4 | none |
| r4-ui | 16:54:46 | 17:01:15 | 6.5 | 8 | A, B, C |
| r5-ui | 16:54:46 | 17:00:33 | 5.8 | 8 | A, C, B |
| r5-ux | 16:54:46 | 17:00:09 | 5.4 | 8 | A, B, C |
| r6-ui | 16:54:46 | 17:00:02 | 5.3 | 8 | A, B, C |
| r7-ui | 16:54:46 | 17:00:07 | 5.3 | 8 | A, B, C |
| r7-ux | 16:54:46 | 16:59:02 | 4.3 | 4 | none |
| r8-ui | 16:54:46 | 16:58:49 | 4.0 | 4 | none |
| r8-ux | 16:54:46 | 17:01:07 | 6.4 | 9 | A, B |
| r9-ui | 16:54:46 | 16:59:52 | 5.1 | 8 | A, B, C |
| r9-ux | 16:54:46 | 17:00:50 | 6.1 | 8 | A, B, C |
| r10-ui (redo) | 17:01:50 | 17:07:13 | 5.4 | 6 | A, B |
| r8-ui (redo) | 17:01:50 | 17:13:04 | 11.2 | 6 | A, B |
| r8-ux (redo) | 17:01:50 | 17:11:59 | 10.1 | 6 | A, B |

Per call (seconds):

| Board | Option | Round | Role | Start | Seconds | Running at start |
|---|---|---|---|---|---|---|
| r2-ui | A | 1 | generator (base) | 16:54:46 | 88 | 1 |
| r1-ui | A | 1 | generator (base) | 16:54:46 | 88 | 2 |
| r3-ui | B | 1 | generator (base) | 16:54:46 | 105 | 3 |
| r4-ui | A | 1 | generator (base) | 16:54:46 | 86 | 4 |
| r6-ui | B | 1 | generator (base) | 16:54:46 | 135 | 5 |
| r7-ux | A | 1 | generator (base) | 16:54:46 | 136 | 6 |
| r5-ui | B | 1 | generator (base) | 16:54:46 | 92 | 7 |
| r7-ui | A | 1 | generator (base) | 16:54:46 | 113 | 8 |
| r5-ux | B | 1 | generator (base) | 16:54:46 | 102 | 9 |
| r8-ux | A | 1 | generator (base) | 16:54:46 | 101 | 10 |
| r8-ui | A | 1 | generator (base) | 16:54:46 | 105 | 11 |
| r9-ui | A | 1 | generator (base) | 16:54:46 | 88 | 12 |
| r9-ux | A | 1 | generator (base) | 16:54:46 | 107 | 13 |
| r10-ui | A | 1 | generator (base) | 16:54:46 | 84 | 14 |
| r10-ui | B | 1 | generator (option) | 16:56:10 | 67 | 14 |
| r4-ui | C | 1 | generator (option) | 16:56:12 | 76 | 14 |
| r4-ui | B | 1 | generator (option) | 16:56:12 | 119 | 15 |
| r9-ui | B | 1 | generator (option) | 16:56:14 | 94 | 15 |
| r9-ui | C | 1 | generator (option) | 16:56:14 | 76 | 16 |
| r2-ui | C | 1 | generator (option) | 16:56:14 | 80 | 16 |
| r2-ui | B | 1 | generator (option) | 16:56:14 | 75 | 17 |
| r1-ui | D | 1 | generator (option) | 16:56:15 | 94 | 17 |
| r1-ui | C | 1 | generator (option) | 16:56:15 | 89 | 18 |
| r1-ui | B | 1 | generator (option) | 16:56:15 | 80 | 19 |
| r5-ui | A | 1 | generator (option) | 16:56:18 | 107 | 19 |
| r5-ui | C | 1 | generator (option) | 16:56:18 | 84 | 20 |
| r8-ux | B | 1 | generator (option) | 16:56:27 | 142 | 20 |
| r5-ux | A | 1 | generator (option) | 16:56:28 | 75 | 20 |
| r5-ux | C | 1 | generator (option) | 16:56:28 | 80 | 21 |
| r8-ui | B | 1 | generator (option) | 16:56:31 | 86 | 21 |
| r3-ui | A | 1 | generator (option) | 16:56:31 | 72 | 21 |
| r3-ui | C | 1 | generator (option) | 16:56:31 | 73 | 22 |
| r9-ux | C | 1 | generator (option) | 16:56:33 | 66 | 22 |
| r9-ux | B | 1 | generator (option) | 16:56:33 | 68 | 23 |
| r7-ui | B | 1 | generator (option) | 16:56:39 | 69 | 23 |
| r7-ui | C | 1 | generator (option) | 16:56:39 | 54 | 24 |
| r6-ui | A | 1 | generator (option) | 16:57:01 | 65 | 24 |
| r6-ui | C | 1 | generator (option) | 16:57:01 | 62 | 25 |
| r7-ux | B | 1 | generator (option) | 16:57:02 | 65 | 25 |
| r7-ux | C | 1 | generator (option) | 16:57:02 | 75 | 26 |
| r10-ui | all | 1 | critic | 16:57:17 | 44 | 26 |
| r2-ui | all | 1 | critic | 16:57:34 | 43 | 22 |
| r9-ux | all | 1 | critic | 16:57:41 | 44 | 20 |
| r3-ui | all | 1 | critic | 16:57:44 | 38 | 16 |
| r9-ui | all | 1 | critic | 16:57:48 | 43 | 16 |
| r5-ux | all | 1 | critic | 16:57:48 | 47 | 16 |
| r1-ui | all | 1 | critic | 16:57:49 | 47 | 15 |
| r7-ui | all | 1 | critic | 16:57:49 | 48 | 16 |
| r8-ui | all | 1 | critic | 16:57:57 | 49 | 16 |
| r10-ui | A | 2 | generator (fix) | 16:58:01 | 68 | 16 |
| r5-ui | all | 1 | critic | 16:58:05 | 64 | 15 |
| r6-ui | all | 1 | critic | 16:58:06 | 43 | 15 |
| r4-ui | all | 1 | critic | 16:58:11 | 54 | 14 |
| r7-ux | all | 1 | critic | 16:58:17 | 40 | 14 |
| r9-ux | B | 2 | generator (fix) | 16:58:25 | 78 | 12 |
| r9-ux | C | 2 | generator (fix) | 16:58:25 | 141 | 13 |
| r9-ux | A | 2 | generator (fix) | 16:58:25 | 79 | 14 |
| r9-ui | A | 2 | generator (fix) | 16:58:31 | 68 | 14 |
| r9-ui | C | 2 | generator (fix) | 16:58:31 | 77 | 15 |
| r9-ui | B | 2 | generator (fix) | 16:58:31 | 76 | 16 |
| r5-ux | A | 2 | generator (fix) | 16:58:35 | 72 | 16 |
| r5-ux | B | 2 | generator (fix) | 16:58:35 | 90 | 17 |
| r5-ux | C | 2 | generator (fix) | 16:58:35 | 83 | 18 |
| r1-ui | A | 2 | generator (fix) | 16:58:35 | 83 | 18 |
| r1-ui | B | 2 | generator (fix) | 16:58:35 | 96 | 19 |
| r1-ui | D | 2 | generator (fix) | 16:58:35 | 70 | 20 |
| r1-ui | C | 2 | generator (fix) | 16:58:35 | 67 | 21 |
| r7-ui | B | 2 | generator (fix) | 16:58:37 | 74 | 21 |
| r7-ui | C | 2 | generator (fix) | 16:58:37 | 87 | 22 |
| r7-ui | A | 2 | generator (fix) | 16:58:37 | 81 | 23 |
| r6-ui | A | 2 | generator (fix) | 16:58:49 | 59 | 22 |
| r6-ui | B | 2 | generator (fix) | 16:58:49 | 66 | 23 |
| r6-ui | C | 2 | generator (fix) | 16:58:49 | 69 | 24 |
| r8-ux | all | 1 | critic | 16:58:49 | 46 | 24 |
| r4-ui | C | 2 | generator (fix) | 16:59:05 | 79 | 23 |
| r4-ui | A | 2 | generator (fix) | 16:59:05 | 79 | 24 |
| r4-ui | B | 2 | generator (fix) | 16:59:05 | 127 | 25 |
| r5-ui | B | 2 | generator (fix) | 16:59:08 | 69 | 25 |
| r5-ui | A | 2 | generator (fix) | 16:59:08 | 82 | 26 |
| r5-ui | C | 2 | generator (fix) | 16:59:08 | 73 | 27 |
| r10-ui | all | 2 | critic | 16:59:33 | 39 | 27 |
| r8-ux | A | 2 | generator (fix) | 16:59:35 | 90 | 27 |
| r8-ux | B | 2 | generator (fix) | 16:59:35 | 77 | 28 |
| r9-ui | all | 2 | critic | 17:00:00 | 54 | 14 |
| r6-ui | all | 2 | critic | 17:00:10 | 71 | 13 |
| r7-ui | all | 2 | critic | 17:00:21 | 64 | 11 |
| r5-ux | all | 2 | critic | 17:00:32 | 79 | 8 |
| r1-ui | all | 2 | critic | 17:00:42 | 83 | 9 |
| r5-ui | all | 2 | critic | 17:00:52 | 69 | 8 |
| r9-ux | all | 2 | critic | 17:01:03 | 53 | 8 |
| r8-ux | all | 2 | critic | 17:01:16 | 52 | 7 |
| r4-ui | all | 2 | critic | 17:01:25 | 69 | 6 |
| r8-ui | A | 1 | generator (base) | 17:01:50 | 140 | 1 |
| r8-ux | A | 1 | generator (base) | 17:01:50 | 162 | 2 |
| r10-ui | A | 1 | generator (base) | 17:01:50 | 98 | 3 |
| r10-ui | B | 1 | generator (option) | 17:03:28 | 74 | 3 |
| r8-ui | B | 1 | generator (option) | 17:04:11 | 297 | 3 |
| r8-ux | B | 1 | generator (option) | 17:04:33 | 150 | 3 |
| r10-ui | all | 1 | critic | 17:04:42 | 68 | 3 |
| r10-ui | A | 2 | generator (fix) | 17:05:51 | 73 | 3 |
| r10-ui | B | 2 | generator (fix) | 17:05:51 | 66 | 4 |
| r8-ux | all | 1 | critic | 17:07:03 | 84 | 3 |
| r10-ui | all | 2 | critic | 17:07:49 | 138 | 3 |
| r8-ux | A | 2 | generator (fix) | 17:08:27 | 170 | 3 |
| r8-ux | B | 2 | generator (fix) | 17:08:27 | 210 | 4 |
| r8-ui | all | 1 | critic | 17:09:08 | 91 | 4 |
| r8-ui | A | 2 | generator (fix) | 17:10:39 | 144 | 3 |
| r8-ui | B | 2 | generator (fix) | 17:10:39 | 107 | 4 |
| r8-ux | all | 2 | critic | 17:12:17 | 56 | 3 |
| r8-ui | all | 2 | critic | 17:13:14 | 45 | 1 |

## Redos

Asked for after the first push: R8 showed six items in both options, so the change was invisible; R10 drew the lime band through white digits. R8 now shows two Sell screens per option (3 items and 9 items); R10 puts the amount you keep on a full-height lime block with black digits, because text on any color stays black in dark mode. The redos replaced `boards/r8-ui.png`, `r8-ux.png`, `r10-ui.png` and their `rounds/` folders; the first versions are in git history.

## What still fails

From the critic run on each board's final images, plus my own look at the boards.

### r1-ui: [boards/r1-ui.png](boards/r1-ui.png)

- My look: The four generated screens look almost the same; the type strip under them is what shows the choice.
- opt-A.png: A adds a marigold background behind the hand; B, C and D show the hand directly on the gradient. This changes the state treatment as well as the typeface.
- opt-A.png: At board size, the text faces read as the same choice. The shared serif heading provides no distinction; the conspicuous difference is the unrelated hand background. These boards do not clearly demonstrate Neue Montreal versus SF Pro.
- opt-B.png: The marigold background behind the hand in A is absent here. This changes the state treatment as well as the typeface.
- opt-B.png: At board size, the text faces read as the same choice. The shared serif heading provides no distinction; the conspicuous difference is the unrelated hand background. These boards do not clearly demonstrate Neue Montreal versus SF Pro.
- opt-C.png: The marigold background behind the hand in A is absent here. This changes the state treatment as well as the typeface.
- opt-D.png: The marigold background behind the hand in A is absent here. This changes the state treatment as well as the typeface.
- across opt-A.png, opt-B.png: The intended body-type difference is not discernible at board size.
- across opt-A.png, opt-B.png, opt-C.png, opt-D.png: The hand background changes between A and B/C/D, so the comparison does not isolate R1. Keep the state treatment constant. C and D visibly change the heading; those heading changes are permitted by the explicit R1 options.

### r10-ui: [boards/r10-ui.png](boards/r10-ui.png) (redo)

- My look: In both options the black "Print label" pill almost disappears on the near-black page. The filled button needs a dark-mode treatment (white pill, or the deep step), which no option shows.
- opt-A.png: The gradient reads as bright cyan to lemon yellow rather than the color sheet’s softer sky to lime.
- opt-A.png: The fill reads as fluorescent yellow-green, visibly more saturated than the color sheet’s soft lime Sold fill.
- opt-B.png: The fill remains fluorescent yellow-green, visibly more saturated than the color sheet’s soft lime Sold fill.

### r2-ui: [boards/r2-ui.png](boards/r2-ui.png)

- The critic found nothing.

### r3-ui: [boards/r3-ui.png](boards/r3-ui.png)

- The critic found nothing.

### r4-ui: [boards/r4-ui.png](boards/r4-ui.png)

- opt-C.png: C changes the color placement as well as removing grain: the upper-right corner becomes sky blue instead of the lime-green in A and B, and the left edge becomes more vivid blue. This prevents an isolated comparison of grain.
- across opt-A.png, opt-B.png, opt-C.png: The fine, coarse and smooth textures are distinguishable at board size, but C also changes the gradient color distribution. Keep the same underlying gradient across all three options.

### r5-ui: [boards/r5-ui.png](boards/r5-ui.png)

- opt-A.png: The supplied site icon has a red circle containing the white mark. This version replaces the circle with a solid red square.
- opt-A.png: The field is visibly brighter and more electric than the muted sky and mint in inputs/colors.png.
- opt-B.png: The field shifts toward bright cyan and luminous yellow-lime compared with the softer sky-to-lime color sheet.
- opt-C.png: The mint-to-lime field becomes visibly luminous yellow-green rather than the subdued lime endpoint in the color sheet.
- across opt-A.png, opt-B.png, opt-C.png: The platform icon changes independently of R5: A uses a solid red square, while B and C use the circular site mark on a white square. Keep the supplied site icon consistent so only gradient placement varies.

### r5-ux: [boards/r5-ux.png](boards/r5-ux.png)

- The critic found nothing.

### r6-ui: [boards/r6-ui.png](boards/r6-ui.png)

- My look: Option C drew the Depop icon round instead of square, a difference besides the decision.
- opt-C.png: The platform mark is a red circle inside a faint outlined square rather than the square site icon. The enclosing square does not restore the required logo.
- opt-C.png: C changes the square red platform icon to a circular red mark while removing the lime band. Logo shape is outside decision R6.
- across opt-A.png, opt-B.png, opt-C.png: The lime-band choices are distinguishable at board size, but C also changes the platform logo. Keep the same square site icon in all three to isolate R6.

### r7-ui: [boards/r7-ui.png](boards/r7-ui.png)

- opt-A.png: Shipping is a more saturated cyan-blue than the soft sky fill on the color sheet; Sold is a more saturated yellow-lime than the sheet’s muted lime.
- opt-A.png: A has a pale yellow fill, while B and C have a visibly stronger orange fill. The state fill changes alongside the selected-tab treatment.
- opt-B.png: Shipping is a more saturated cyan-blue than the soft sky fill on the color sheet; Sold is a more saturated yellow-lime than the sheet’s muted lime.
- opt-B.png: A has a pale yellow fill, while B and C have a visibly stronger orange fill. The state fill changes alongside the selected-tab treatment.
- opt-C.png: Shipping is a more saturated cyan-blue than the soft sky fill on the color sheet; Sold is a more saturated yellow-lime than the sheet’s muted lime.
- opt-C.png: A has a pale yellow fill, while B and C have a visibly stronger orange fill. The state fill changes alongside the selected-tab treatment.
- across opt-A.png, opt-B.png, opt-C.png: The selected-tab treatments are distinguishable, but the Needs you fill also changes: pale yellow in A versus stronger orange in B and C. Keep that fill identical for an isolated R7 comparison.

### r7-ux: [boards/r7-ux.png](boards/r7-ux.png)

- The critic found nothing.

### r8-ui: [boards/r8-ui.png](boards/r8-ui.png) (redo)

- My look: The 9-item screens of A and B look nearly the same; the difference shows mainly in the 3-item screens.
- opt-A.png: The airy treatment also changes the photos to nearly square frames, showing substantially more of each item than option B's shallow landscape crops. Photo framing changes alongside spacing, so the comparison does not isolate R8.
- opt-B.png: The fixed-spacing treatment also uses shallow landscape photos instead of option A's nearly square frames. The jacket and lamp are substantially more cropped, introducing a photo-framing choice into the spacing comparison.
- across opt-A.png, opt-B.png: The options are visibly distinguishable, but the three-item screens change photo aspect ratio and crop as well as spacing. Keep photo framing consistent between options so R8 can be judged on spacing alone.

### r8-ux: [boards/r8-ux.png](boards/r8-ux.png) (redo)

- opt-A.png: A uses shallow landscape photos and places each platform icon beside the item text. B uses much taller, nearly square photos and puts the platform icon on a separate line above the title. The comparison changes photo framing and card structure as well as spacing.
- opt-B.png: The three-item screen changes to nearly square photos and platform icons above titles, while the nine-item screen retains shallow photos and icons beside titles. These changes also distinguish B from A, so this does not isolate the same-spacing option.
- across opt-A.png, opt-B.png: The options are distinguishable at board size, but photo aspect ratio and platform-icon placement change alongside spacing. Keep photo framing and card structure the same across both boards so R8 compares only spacing.

### r9-ui: [boards/r9-ui.png](boards/r9-ui.png)

- The critic found nothing.

### r9-ux: [boards/r9-ux.png](boards/r9-ux.png)

- opt-A.png: The offer gradient has a stronger yellow-lime right edge than B and C; R9 changes only the notice card.
- opt-B.png: The offer gradient has a greener, less yellow right edge than A and C; R9 changes only the notice card.
- opt-C.png: The offer gradient is paler than A and has a more yellow right edge than B; R9 changes only the notice card.
- across opt-A.png, opt-B.png, opt-C.png: The hairline, gray and sky-tint notices are distinguishable, but the offer gradient also visibly changes across the boards, including the notice-dismissed screens. Keep that gradient identical so the comparison isolates R9.

## R10 redo through the runner

Made after the timing above, with [run.mjs](../../../.agents/skills/image-gen/run.mjs) and [r10-dark-button.plan.json](r10-dark-button.plan.json): the filled button on the dark page becomes a white pill. All numbers were measured on Ben's Mac (M3, 8 cores, 16 GB) unless marked.

Codex's fixed cost, from a call that only replies "ok":

| Codex home | Tokens | Seconds | Ben's hooks ran |
|---|---|---|---|
| Default | 9,030 | 6.9 | yes |
| Clean: only a link to the sign-in | 4,089 | 4.5 | no |
| Default with project docs off | 9,030 | 6.2 | yes |

Starting 24 one-line calls under the clean home:

| How they started | Most at once | Load at its peak | Memory at its peak | Median seconds per call |
|---|---|---|---|---|
| All in the same second | 24 | 54.4 | 3.2 GB | 99 |
| Two every 2 seconds, 75 seconds after the first run | 8 | 22.1 | 1.4 GB | 8 |

The second run began on load left by the first (guessed), so it was held back more than a quiet Mac would be.

The image run: 3 calls (A, B, critic), then one fix round of 3. Median 48 and 56 seconds per call. Tokens: A 25,009 and 32,168, B 22,450 and 24,955, critic 18,348 and 20,844. The Mac was at load 66 from other work when it began, so that version of the runner made the calls one at a time; the runner now slows down under load instead of stopping.

What still fails on [boards/r10-ui.png](boards/r10-ui.png), from the second critic: the jacket photo differs slightly between A and B, because each was an edit of its own earlier image, not of one base. A's gradient is brighter than the color sheet.
