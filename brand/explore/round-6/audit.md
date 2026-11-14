# Brand foundation audit, 2026-11-14

A workflow of four reviewers (consistency, type, color, checkability) read the constitution, tokens and cards. A separate skeptic checked each finding against the files and couldn't refute any of the 49. The plan below is the synthesis, kept as the record.

**Applied** in the same commit as this file: sections 1 to 7, with three changes:
- Lime means money: sold, paid and the amount you keep. Mint is live only. That is one meaning per color, which is what the plan was after.
- Tab badges stay a marigold dot with no number. Ben called the "3 need you" counter meaningless.
- Ben's 21 and 36 replace 22 and 34 in the app. He chose them, so they stand.

**Not applied yet:** section 8, the gaps in the check scripts. Each change needs a failing test first.

**Ben's questions** are now boards rather than text questions. Q1 is D6. Q2 and Q7 are D5. Q6 is D2. Q3 and Q5 are covered by D5 and D6. Q8 (dark mode) is out of scope for now (ledger A4).

---

# Brand foundation fix plan

Commit rule: anything that changes a value goes in `constitution.md`, `tokens.css` and `coder-card.md` together, in one commit (Part V.3). New values are *agent proposals* until Ben picks them in the kit.

---

## 1. brand/image-card.md

**1.1 High. The card still describes the round-1 flower brand.** Merges consistency-01, type-07, color-image-card-wrong-palette, checkability-image-card-stale.
- Edit: delete `brand/image-card.md`. The new `image-gen` skill (`.agents/skills/image-gen/SKILL.md:13`) already gives the image model `brand/constitution.md` and `brand/tokens.css`. The card is a second copy of the brand, and it is stale. Deleting it follows "subtract before you add" and "one fact in one place", and poteto-mode-review :176 and :218 recommend the same.
- `brand/README.md` line 11: `` - `image-card.md`: what the image model is given `` -> remove the line. Add under the superseded list: `` - `image-card.md`: round 1 image brief, removed; the image-gen skill passes constitution.md and tokens.css ``.
- If someone wants the card kept instead, rebuild it from round-5 `inputs/prompts.md` line 15, but describe the field as a "textured mesh of sky, mint and lime", not "sky-to-lime gradient". Attach round-5 `swatch.png`, `type.png` and `true-today@2x.png`. State the sizes 13/15/18/22/34 and one 50, 48 pt buttons and 20 pt margins. Mark the faces as proposals. Open the card with "Short form of constitution.md; the constitution wins."
- Leave `anti-pillars.md` and `codes.md` alone. Both are already marked Superseded.

---

## 2. brand/constitution.md

**2.1 High. The web text sizes are mislabelled as Ben's spec, mix his 390 and 1440 values, and can't be checked.** Merges consistency-02, type-05, checkability-ben-spec-and-means, and parts (b) of checkability-rules-fail and type-04.
- Part III, "Text sizes", Website cell: `15 / 17 / 22 / 36 / 58 / 86 (Ben's Marist spec, fluid)` -> `Display, Ben's Marist spec, 390 → 1440, clamp() between: hero 50 → 86.5; section 36 → 58.3; feature 21 → 24.9. Text: 15 and 18 at every width (agent proposal).`
- B14 Check: `Computed font sizes ⊆ the medium's set` -> `App, post, video, deck: computed sizes ⊆ the medium's set at the default text size. Web: at 390 and 1440 wide, each display size equals its endpoint; text sizes ⊆ {15, 18}.`
- Art. 6 Display role, Job: `The wordmark, one heading per view, one big number per view` -> `The wordmark; in the app and posts one heading per view; on the web Ben's three tiers (hero, section, feature)`. The money part of this cell is settled in Needs Ben Q1.

**2.2 High. Marist Book is weight 350, but the weight check only allows 400 and 500, so Book can't pass.** From type-01.
- Rule 6.1: `Regular (or Book) for everything; Medium only for button labels and the selected tab.` -> `Display face: Book (350) and its italic only. Text face: 400, and 500 only for button labels and the selected tab.`
- B13 Check: `Computed \`font-weight\` values ⊆ {400, 500}; 500 only on buttons and the selected tab` -> `Computed \`font-weight\` values ⊆ {350, 400, 500}; 350 only in the display face; 500 only on buttons and the selected tab`. Change Runs to `Script (set only); Look (per face)` until the per-face logic exists.
- Art. 6 Display role, Hard requirements: `a Book or Regular weight that holds at 28 to 50 px` -> `a Book weight that holds at 21 to 86 px`.

**2.3 High. The ink-2 gray fails 4.5:1 contrast, and B6 fails the brand's own primary button.** Merges color-ink2-fails-aa, checkability-ink2-contrast, consistency-09, color-b6-flags-the-black-pill.
- Art. 5, Ink second row: `Black 55% | \`rgb(10 10 10 / .55)\` | … | Gray hex values; anything under 13 px at this level` -> `Black 65% | \`rgb(10 10 10 / .65)\` | Secondary text on page and gray only | Gray hex values; any field, state or category fill; anything under 13 px`.
- Rule 6.6: `A heading may have a second phrase at black 55% or in the display italic. 22 px and up only.` -> `A heading may have a second phrase at black 65% (on page or gray) or in the display italic (in black on any fill). 22 px and up only.`
- Rule 5.1: `Every non-black color is a fill behind black text. Black on every field color passes 9:1.` -> `Every field, state and category color is a fill behind black text (each passes 9:1). Brick takes white text.`
- B6: `Black text on field and color (Art. 5.1) | Every text node over a non-white fill is black or white-on-brick only; contrast ≥ 4.5:1` -> `Text contrast (Art. 5.1) | Every text node ≥ 4.5:1 with its ground (≥ 3:1 at 24 px and up). On field, state and category fills, text is --ink only. White text only on the black pill (C4) and brick.`

**2.4 High. Several rules fail output that follows the constitution.** Merges checkability-rules-fail (a, d, e), consistency-10, type-03 (wordmark part).
- B17 Check: `Every margin, padding and gap ∈ {0, 4, … 64}` -> `Every gap inside a component ∈ {0, 4, 8, 12, 16, 20, 24, 32, 48, 64}; canvas margins and safe areas come from Part III`.
- Rule 9.1: delete `Inner radius is outer radius minus the padding, never larger.`
- B19 Check: `except photos and buttons` -> `except photos, buttons, state pills and the C6 band`.
- Part III, Wordmark row: `Nav bar, centered, 20 to 22 px` -> `Nav bar, centered, 22 px`. Website: `Header left; footer large` -> `Header left, 22 px; footer, 86.5 px at 1440`. Under the table, add: `The wordmark is a code with its own size per medium; B14 does not apply to it.`

**2.5 High. The field and the money highlight vanish when they overlap.** From color-state-and-highlight-vanish-on-field.
- C6 boundary: `one highlight per view;` -> `one highlight per view, never inside the field (on the field, mark the amount by size or the display italic);`
- C2: after `never behind long text.` add `State pills on the field use the white page as their fill, with a black label.`
- B12: add `the highlight is not inside the field element`.

**2.6 High. Primary action counts disagree across the docs.** From consistency-07. The constitution side stays as it is (C4 and B10 are right). The edits are in sections 5 and 6.

**2.7 High. The language rules break in non-Latin scripts.** Merges checkability-japanese-spanish and type-10.
- Rule 7.5: `Alignment is on one left edge per column.` -> `Alignment is on one start edge per column (left in left-to-right scripts, right in right-to-left; use logical properties).`
- Rule 6.3: add `Devanagari, Thai and Arabic: leading at least 1.2 at every size.`
- Rule 12.4: `Headlines under 8 words` -> `Headlines under 8 words (16 characters in Chinese, Japanese and Korean; agent proposal)`. Apply the same to Part III "Longest text" and rule 11.3 (`0.3 s per word` -> `0.3 s per word, or per 2 characters in CJK`).
- Banned list: `More than two families in one output.` -> `More than two families in one output, not counting the wordmark or a Noto fallback for a script the text face lacks.`
- Art. 6 Text row: `wide script coverage` -> `coverage: [fill from the font's cmap]`. Add the same line for Marist.

**2.8 High. The checks can't be run on images or video frames.** From checkability-raster-outputs.
- Part IV preamble: after `Brand feel always goes to Ben.` add `For a raster with no source file, each Script row that reads the DOM runs as a Look on the render at true size. Rows that need source (B13, B15, B22, B27) are marked n/a in the result.`

**2.9 Medium. State colors have two meanings each.** Merges consistency-05 and color-one-color-many-meanings. copy.md is the recorded decision, so it wins on "paid".
- Art. 5, Lime row Use: `C2, the money highlight (C6), the state "sold"` stays. Mint row: `C2, the state "live"` -> `C2, the states "live" and "paid"`.
- Category row: `Marigold, coral, lilac | \`#F9C76F\`, \`#EF956E\`, \`#B08DF1\`` -> `Coral, lilac | \`#EF956E\`, \`#B08DF1\``. Add a third category only from a sampled jpg(12) value. Add a separate row: `State | Marigold | \`#F9C76F\` | The state "needs you" | Category`.
- Brick row Use: `Failed, the count of things that need you` -> `Failed; and the system count badge on a tab icon (the familiar iOS badge, the one named exception)`.
- Rule 5.3: `Mint is live, lime is sold or paid, marigold needs you, brick failed, gray ended.` -> `Mint is live or paid, lime is sold, marigold needs you, brick failed, gray ended. The red count badge on a tab icon is the one exception (Jakob's law).`
- Art. 3, jpg(12) Take: `(lime, marigold, coral, lilac, cyan)` -> `(coral, lilac)`.

**2.10 Medium. Rule 6.3 and 6.4 credit numbers to Ben that aren't his.** Merges consistency-03, type-08, checkability-ben-spec.
- Rule 6.3: `1.33 at 13 to 18 px, 1.15 at 22 px, 1.05 at 34 px, 0.95 at 50 px and up (Ben's Marist spec).` -> `13/18, 15/20 and 18/24 for text (agent proposal); 1.10 for feature headings, 1.05 for section headings, 0.95 at 50 and up (Ben's Marist ratios: 21/23.1, 36/37.8, 50/47.5).`
- Rule 6.4: `−0.01em at 18 and 22; −0.015em at 34; −0.02em at 50 and up.` -> `−0.01em at 18 to 36 (Ben: −0.2px at 21, −0.01em at 36); −0.02em at 50 and up (Ben).`
- Rule 6.2: add `The app scale keeps 22 and 34 instead of Ben's 21 and 36 at 390: [reason or align, see Needs Ben Q4].`

**2.11 Medium. Inputs have no size, and nothing handles the user's text size.** Merges type-03, type-06, type-12. After rule 6.7, add a role table (agent proposal):

| Role | Size | Face, weight | Ink |
|---|---|---|---|
| Caption, timestamp, tab label, badge | 13 | text 400 | ink-2 (badge: white on brick) |
| Body, list row, price in a row, card title | 15 | text 400 | ink |
| Button label | 15 | text 500 | white on the pill |
| Headline in a card or sheet; input text | 18 | text 400 | ink |
| Wordmark | 22 | display 350 | ink |
| Feature heading | 22 (or 21) | display 350 | ink |
| Screen heading, one per view | 34 (or 36) | display 350 | ink |
| Peak moment | 50 | see Needs Ben Q1 | ink |

- Add rule 6.8: `Sizes scale with the user's text setting (iOS Dynamic Type: 13 footnote, 15 subheadline, 18 body, 22 title2, 34 largeTitle). The steps above are the default-size values. On the web the root uses \`font: -apple-system-body\`. Line heights are unitless.`

**2.12 Medium. "View" is never defined, so B4 and B8 give different answers.** From color-view-and-field-checks-unmeasurable.
- Part III, Canvas row: append `A view is one viewport at one scroll position, one slide, or one frame.`
- B8: add `alpha black (ink-2, rule) counts as black`.

**2.13 Medium. Three Look checks can't be decided by one agent.** From checkability-look-checks-undecidable.
- B1: `Reason ledger has zero blanks` -> `Reason ledger has zero blanks and no reason listed in Art. 1.2`.
- B2: append `(except outputs whose job is brand recognition, E1)`.
- B25: append `An axis matches when a fresh agent would call the two the same choice.`

**2.14 Low. Two color values cite sources that have no row, and some colors have no job.** From color-sources-without-jobs.
- Ground row: `(sampled, ref-12 and ref-15)` -> `(sampled, ref-12)`.
- Brick row: `(sampled, Taskello)` -> `(sampled, Amigo, Home_X)`. Alternatively, add Art. 3 rows for ref-15 and Taskello.
- Field Sky row: give `#4EBAF7` the job `deep corner of the field mesh`. The new field token in 3.1 uses it.
- Art. 5: add `Light appearance only; tokens declare \`color-scheme: light\`.` This is from color-dark-mode-unaddressed. Scope goes to Ben only if dark mode is wanted.

**2.15 Medium. One rule for text over photos and footage.** From checkability-silent-media.
- Rule 5.1: append `Text over a photo or footage sits on the field or a white caption bar, in black; never white with a shadow.` B6 measures against the pixels behind the text.

---

## 3. brand/tokens.css

**3.1 High. The field token is not the field the docs describe.** Merges consistency-06, color-field-token, checkability-field-token, color-field-texture-invisible.
- `--field-lines: repeating-radial-gradient(circle at 115% -30%, #ffffff00 0 9px, #ffffffb3 9px 10px);` -> `--field-lines: repeating-radial-gradient(circle at 115% -30%, #ffffff00 0 9px, #ffffff99 9px 10px);` (alpha .60 now baked in; the final value is picked in the kit).
- Delete `--field-lines-opacity: .55;`.
- `--field: linear-gradient(160deg, var(--sky) 0%, #C9E6D8 50%, var(--lime) 100%);` -> `--field: var(--field-lines), radial-gradient(at 0% 0%, var(--sky-deep), transparent 55%), radial-gradient(at 30% 100%, var(--mint), transparent 60%), radial-gradient(at 100% 100%, var(--lime), transparent 65%), var(--sky);` Positions are provisional until sampled from ref-12.
- Add `--field-peach: radial-gradient(at 100% 0%, var(--peach), transparent 30%);`, an optional corner layer.
- Remove the raw `#C9E6D8`.

**3.2 High. Contrast, weight and fallback fonts.** Merges color-ink2, type-01, type-09.
- `--ink-2: rgb(10 10 10 / .55); /* secondary text, second phrase; 13px and up */` -> `--ink-2: rgb(10 10 10 / .65); /* secondary text on page and gray only; 13px and up */`
- `--w-regular: 400; --w-medium: 500;` -> `--w-display: 350; --w-regular: 400; --w-medium: 500;`
- `--font-display: "Marist", Georgia, serif; /* wordmark, one heading, one peak number */` -> `--font-display: "Marist", var(--font-text); /* wordmark and headings; uncovered scripts fall to the text face */`
- `--font-text: "Geist", -apple-system, system-ui, sans-serif;` -> `--font-text: "Geist", "Noto Sans", "Noto Sans JP", "Noto Sans Arabic", "Noto Sans Devanagari", -apple-system, sans-serif;`. This drops `system-ui`, which can resolve to an Inter-derived face. Add `@font-face` sources for Geist.
- In `:root`, add `color-scheme: light;`.

**3.3 Medium. Line heights and tracking don't match Ben or the constitution.** Merges consistency-03, type-08, type-06. Line heights become unitless:
- `--lh-13: 18px` -> `1.385`; `--lh-15: 20px` -> `1.333`; `--lh-18: 24px` -> `1.333`
- `--lh-22: 26px` -> `1.1`; `--lh-34: 36px` -> `1.05`; `--lh-50: 48px` -> `.95`
- `--tr-34: -0.015em` -> `-0.01em`; add `--tr-18: -0.01em`.
- Add web tokens: `--t-hero: clamp(50px, 36.44px + 3.476vw, 86.5px); --t-section: clamp(36px, 27.72px + 2.124vw, 58.3px); --t-feature: clamp(21px, 19.55px + 0.371vw, 24.9px);`
- Add role aliases, for example `--t-input: var(--t-18); --t-caption: var(--t-13); --t-wordmark: var(--t-22);`, so B14 still sees the same set.
- Header line 2: `Every value here matches brand/constitution.md` stays, and becomes true once this commit lands.

---

## 4. brand/coder-card.md

**4.1 High. Bring the card in line with the changes above,** in the same commit.
- Rule 5: `the textured sky, mint and lime gradient` -> `\`background: var(--field)\` (the token includes the lines; never rebuild it)`.
- Rule 6: `State fills: mint live, lime sold or paid, marigold needs you, brick failed, gray ended, sky new.` -> `State fills: mint live or paid, lime sold, marigold needs you, brick failed, gray ended, sky new. Every state pill carries a black label or a Hugeicon; color is never the only signal. On the field, pills are white.`
- Rule 7: append `The outline is \`--ink\` (\`--outline\`), not \`--rule\`.` Add `--outline: var(--ink)` to tokens. From color-ui-parts-below-3-to-1.
- Rule 8: `two weights (400; 500 only on buttons and the selected tab), sizes 13, 15, 18, 22, 34 and one 50 for a peak number.` -> `display 350; text 400, and 500 only on buttons and the selected tab. Sizes by role (constitution Art. 6 role table); inputs at 18.`
- Rule 9: `One lime highlight per view.` -> `One lime highlight per view, never inside the field.` The face part follows Needs Ben Q1.

---

## 5. product/copy.md

**5.1 Medium. Stale links, wrong values and all-caps labels.** Merges consistency-08, consistency-11, consistency-05, consistency-07.
- Line 18: `` `KEEP $36.40` under the price `` -> `` `You keep $36.40` under the price ``.
- Line 26: `` **Buttons:** one or two words, a verb. `Post`, `Counter $38`, `Retry`. `` -> `` **Buttons:** a verb, plus its object or amount when there is one: `Post`, `Counter $38`, `Post to 3 sites`. ``
- Line 32: `in plain words, never (see the brand [coder card](../brand/coder-card.md) rule 7).` -> `in plain words a person could say back, never as a sample size or stats term (brand [constitution](../brand/constitution.md) E3, Art. 12.2).`
- Line 59: `handled by the brand [anti-pillars](../brand/anti-pillars.md)` -> `handled by the brand [constitution, Article 13](../brand/constitution.md#article-13-not-ai-made)`.
- Line 68: `green for live or paid, red for failed, amber for needs you, grey for ended. A red badge with a count means "needs you" and nothing else.` -> `mint for live or paid, lime for sold, marigold for needs you, brick for failed, gray for ended. The red count badge on a tab icon means "needs you" and nothing else.`
- Line 71: `or to 65% black` stays unchanged once --ink-2 is .65 (3.2). Append `(\`var(--ink-2)\`)`.
- Line 72: `Accent color appears only on state pills, the primary action and alerts.` -> `Color appears only as state fills, the one field (C2), the one lime money highlight (C6) and the brick alert.`
- Line 73: `One primary button per screen or card` -> `One primary button per decision, at most one per card`.

---

## 6. product/frontend-standard.md and product/ui-constitution.md

**6.1 Medium. Make the primary-action count match the brand, and remove stale brand references.** Merges consistency-07, consistency-08, consistency-11.
- ui-constitution line 109: `Each screen has exactly one focal point and one primary action.` -> `Each screen has exactly one focal point; each decision on it has one primary action (brand C4).`
- ui-constitution line 19: `` Labels like `AUTO` `` -> `a plain "Automatic" label`.
- frontend-standard line 16: `Exactly one primary action.` -> `One primary action per decision.`
- Line 121: `Block: exactly one primary action, black and in thumb reach.` -> `Block: one primary action per decision (at most one per card), black and in thumb reach.`
- Line 131: `accent color appears only on state, the primary action and alerts. At most one yellow highlight and one price dot per screen (brand codes).` -> `color appears only as state fills, one field, one lime money highlight and the brick alert (brand constitution Art. 5, C2, C6).`
- Line 159: `Yellow is never text on white (1.40:1).` -> `Field, state and category colors are never text on white (brand Art. 5.1).`
- Line 94: `(brand anti-pillars)` -> `(brand C6)`.

---

## 7. brand/explore/round-5/review.md

**7.1 Medium. The review sends Ben's words to files that don't exist and overstates its coverage claim.** Merges consistency-12 (paths), checkability-art13-misses-default.
- Line 3: `his words go to \`brand/corrections.md\`` -> `his words go to [product/words.md](../../../product/words.md)`.
- Line 28: `Every one of these already maps to an Article 13 tell. Ben's marks decide whether they become hard rules in \`brand/rules/\`.` -> `Some map to Article 13. Some are covered elsewhere: cream (Art. 5), taglines (12.3), invented names (12.6), uppercase (6.5), texture (9.3). Script type, marker swipes, torn paper, flow diagrams and a serif-italic accent have no rule yet. Ben's marks decide which become Part IV checks.`
- Lines 11–12: `"you keep" in Marist italic with the lime highlight (C6)` -> `"you keep" label in Marist italic; the figure follows C6`. Revise again after Needs Ben Q1.

---

## 8. .agents/checks/ (brand.mjs, ui.mjs, scripts/copy-lint.mjs)

**8.1 Medium. The checks miss the type rules most likely to be broken.** Merges type-13, checkability-enforcement-gaps, checkability-japanese-spanish. Each change needs a failing fixture in `checks.test.mjs`.
- brand.mjs line 4: `const UI = /\.(tsx|jsx|ts|js|css|scss|html|vue|svelte)$/;` -> add `|swift`.
- brand.mjs line 32 weight regex: also catch `bold|bolder|semibold|heavy`, the `font:` shorthand weight (`font:\s*(\d{3})`), and SwiftUI `.bold()` and `.fontWeight(`. Treat any match outside the B13 set as an error.
- ui.mjs line 8 `strings()`: change `[A-Za-z]` -> `\p{L}` with the `u` flag.
- copy-lint.mjs line 26 S1: `/!(?=\s|$|["'<])/g` -> `/[!！](?=\s|$|["'<])/gu`.
- ui.mjs line 22: make S1 an error as well as O13. Today's run has 0 S1 hits, so this costs nothing.
- constitution Part IV: change the Runs cell of every unscripted row (B3, B4, B9–B12, B14, B16, B18, B19, B21, B22, B26–B28) to `Script (not yet)`. Write the B14 check only after 2.1 and 2.11 have redefined it.

---

## Needs Ben

1. **Which face and size does the one big money number use on a sale screen?** Recommended: the text face at 50 with tabular figures. That keeps C6 and B12 intact and leaves Marist for the wordmark and headings. Then edit C6 to `…at the same size as the text around them or one step up; the one peak amount per view may be 50 (app) or up to 200 (post, deck)`. Remove `one big number per view` from the Display role and `one peak number` from the tokens comment. (consistency-04, type-02, checkability-money-face-size)
2. **Can the field cover a whole post panel, end card or web hero, past the one-third color limit?** Recommended: yes. Add a "Field coverage" row to Part III (app ≤ 1/3; web hero up to the first viewport; post panel, end card and title slide may be one full field) and have B8 read its limit from that row. (color-field-coverage-contradiction, checkability-rules-fail c)
3. **You said you're not fully set on black and white. Should one Art. 14.4 variant be field-led?** Recommended: yes. Quote your 19:22 "white as the main color" and 20:17 "not fully set" next to rules 5.1 and 5.2 and the Page row, mark them as agent proposals, and include one field-led variant (field as the app's top band or the web page ground) in the next round. (consistency-12)
4. **At 390 px, should the app use your 21 and 36 for headings instead of 22 and 34?** Recommended: yes, if Marist is the display face. 21 and 36 also pass the 15% step rule, and nothing in the files explains departing from your numbers. (type-04)
5. **The lime money band and the italic second phrase look like the AI default's highlighter swipe and italic accent. Keep them?** Recommended: keep both, but test them against default.png in the next round with one variant that marks money by size alone. (checkability-art13-misses-default)
6. **Should Geist be compared against the plain iPhone system font (SF Pro)?** Recommended: yes. Add the row to the kit. Geist's real argument is that it looks the same on web, posts and video (E4), not that it "feels native". (type-11)
7. **How visible should the field lines be?** Recommended: pick in the kit from three alphas (.45, .60, .75) shown at the lime end. B5 then checks that measured line-to-ground contrast. (color-field-texture-invisible)
8. **Is dark mode in scope?** Recommended: no, light only for now. That needs no work from you unless you want dark. (color-dark-mode-unaddressed)