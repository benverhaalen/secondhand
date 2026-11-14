# Round 6 brief: brand decision boards

Run with the [image-gen skill](../../../.agents/skills/image-gen/SKILL.md): the Codex CLI with Astra, on Ben's Mac. This brief gives the job, the inputs, the loop and the judging. It does not say what the images contain.

## The job

Ben picks the brand by looking, not reading ([his words](../../../product/words.md#2026-11-14-brand-decision-boards)). For each open decision in [ledger.md](../../ledger.md) (D1 to D6), make two boards:

- **UI board.** The options in use, side by side, so the only thing that differs between them is the decision. Spacing, components and color as they would really look in the app.
- **UX board.** The same options seen as experience: what a person notices first, where the thumb goes, what each state tells them, how it reads in motion from one state to the next. Annotated, like a designer's markup, with as few words as possible.

Everything in the Locked and Decided rows of the ledger is fixed in every option. Don't reopen it.

## Inputs

Attach with `-i` (at most 5 per call; choose the ones that serve the board):
- Ben's references for what he approved. The sky to lime gradient comes from `~/Downloads/inspiration photos/design/ref-12.jpg`. Logos on mixed cards come from `some more references/jpg(17)`. Color as category comes from `some more references/jpg(12)`. Look through `~/Downloads/inspiration photos` for other images that are close to these (buttons, gradients, cards) and use them where they help. Name each one you used in lineage.md. Don't commit them.
- `brand/explore/round-5/showcase/usage-app.png`, the closest image so far. It isn't approved.
- `brand/explore/round-5/inputs/swatch.png` and `type.png` for exact colors and type.
- Real item photos from `assets/demo-items/`. Real platform logos from `assets/platforms/`.

Read `brand/constitution.md`, `brand/tokens.css`, `brand/ledger.md` and `product/ui-constitution.md` before the first image.

## The loop, per board

1. **Base.** Make the board's base with the leaning option (the ledger's Leaning column).
2. **Options.** Make every other option by editing the base with only the decision changed, so the options are comparable. Keep the photos, words and numbers identical.
3. **Critique.** Start a separate Codex run that never sees this brief or your prompts. Give it only the images, `brand/constitution.md` (Part IV checks and Article 13), `product/ui-constitution.md` and `ledger.md`. Ask it to judge as a senior product designer would in a review, with every failure tied to a rule and a place in the image.
4. **Fix.** Regenerate only what failed. Don't touch what passed.
5. **Stop** when two critique rounds in a row find nothing new, or after four rounds. If a board still fails, keep the best one and list what is still wrong.
6. **Stitch.** Use a script, not the image model, to put the options side by side in one image per board. Label them A, B and C, with the option's name in a few words underneath. Add nothing else.

## How to judge

A board fails if any of these is true:
- Anything differs between options besides the decision being shown.
- A locked or decided ledger row is broken (for example, a platform named in words, the wordmark not centered, an item without its photo, or only two actions on a decision).
- It contains words nobody wrote: taglines, headlines or labels made up to fill space. The only text allowed is item names, prices, short state words and button labels a person would say.
- Numbers don't match across boards. Use these everywhere: listed at $45, offered $38, you keep $31.40.
- It isn't true phone scale (390 points wide). Text you can't read at phone size, or buttons that look 1.5 times too big, both fail.
- A logo is wrong or generic, for example Facebook drawn as a store icon.
- It shows any Article 13 tell, or anything from the never list in `brand/explore/round-5/review.md`.
- Text is misspelled or garbled.

## Output

Write everything to `brand/explore/round-6/`:
- `boards/d1-ui.png`, `boards/d1-ux.png`, and the same for d2 to d6
- `rounds/`, holding each round's images and critiques
- `lineage.md`: the commands, the references used, the rounds, and what still fails

Commit and push to `main`. Never commit reference images or font files.
