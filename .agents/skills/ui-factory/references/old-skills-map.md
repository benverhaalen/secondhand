# Where each function of the old skills went

Open when: checking that nothing was lost, or when someone asks where an old rule lives.

## `visual-direction-to-ui` (Codex skill, retired into this one)

| Function | Now |
|---|---|
| Framing: audience, central task, default entry, one complete journey | `screen-frame.md` items 1 and 6 |
| Inspect existing product, keep essential behaviour and content, record departures | `brand.md` Intake 1 |
| References: ask what to borrow or avoid from each; offer to find them; no copying a whole interface; job per reference; requirement versus weak signal | `brand.md` Intake 2 and 3 |
| Materially different directions for the same journey; number by uncertainty; readable large images; no shrunken boards or false crops | `directions.md` |
| Image generation inside Codex (native tool) and outside (ask Codex); never substitute imagined images; report when generation is unavailable | `directions.md` "Making images" (now `codex exec`, not `codex --yolo`) |
| Revise unusable images before showing; lettering is not copy | `directions.md` "Image hygiene", "What is kept" |
| Show alternatives with feeling, reference property and tradeoff; ask keep, combine, reject, refine | `brand.md` Iteration; `critique-loop.md` Combine; end message |
| Wait for an explicit human taste decision; no approval by silence; "surprise me" recorded | SKILL.md stops; `brand.md` Iteration 5 |
| Refine and lock; decision record (approved, rejected, exceptions, open questions, reference map, journeys covered) | `brand/DESIGN.md` decision history; `brand.md` |
| Do not ask him to decide every radius | `brand.md` (agent sets values from the approved direction) |
| `DESIGN.md` constitution, eight sections, source-of-truth order | `brand.md` source item 2 and the precedence line (order changed to v3's: his decisions, brand codes, approved image, code, inference) |
| Walk one screen image to tokens; new visual category returns to him | `build.md` Order; SKILL.md stops (a fix that changes an approved choice) |
| Implement from the image with image-to-code; one journey first; every state | `build.md` |
| Compare screenshot with image at matching viewport and state | `check.md` Compare |
| Audit matrix (visual match, system consistency, journey, responsive and accessibility, motion, copy) | `check.md` and `whole-app.md` |
| Material drift corrected; conflict with an approved choice returns as a comparison | `check.md`; `corrections.md` item 6 |
| Review lenses: Emil's skills, `apple-design` only for Apple-native briefs, `emil-design-eng` as polish lens; "do not claim a skill ran" | Vendored in `.agents/vendor/emil/`, named per stage in `build.md` and `check.md`; end message item 6 |
| Handoff packet; proposed, selected, implemented, verified | `end-message.md` |
| Stop at the requested stage | SKILL.md |

Not carried over, and why:
- `references/review-lenses.md` links to Jakub Krehel's skills (`better-interface`, `interface-review`, `better-typography`, `better-colors`, `better-layout`, `better-accessibility`, `better-writing`). They are carried over as optional audit lenses in `check.md` (links only, not vendored, read on the stated conditions).
- `agents/openai.yaml` (a display name and short description for Codex's UI); the new skill's description replaces it.
- `codex --yolo` for images: replaced by `codex exec -s workspace-write`, which is the form tested on 2026-11-13 and does not bypass the sandbox.
- The 2 to 4 direction count: replaced by "by uncertainty" with Emil's three as a starting point, per v3.

## His method modules (stay in `reference-driven-development`, not copied, not edited)

- `~/.claude/skills/reference-driven-development/references/ui-continuity.md`: font and icon defaults (coder card, image card); competence and character contracts and task-family conventions (`screen-frame.md` 3); measured anchors and attaching real pixels (`directions.md`, `build.md`); image lineage, comparison contract and fresh critics without the favoured answer (`critique-loop.md`, `check.md`).
- `~/.claude/skills/reference-driven-development/references/image-ideation-example.md`: images discover direction; no fixed number of generations; hypotheses not evidence; do not merge every feature; sharpen the situation instead of prescribing the screen; change the generation operation when he reports over-prescription (`directions.md`, `critique-loop.md`).

## The three kept image skills (backup copies, not restored)

Source folder: `~/.local/share/harness-reset-backup/2026-11-12/codex/skills/`. No licence file was found in them, so their rules are restated in my words with the section named.
- `image-to-code-skill`: deep analysis (sections 8, 9), extraction of text, type, spacing, components, color (21 to 25), copy discipline and anti-drift (26, 27), missing-detail order (28), do-not-crop and fresh regeneration (5, 6, 7): `build.md`, `directions.md`. Not used: the combinatorial variation engine, hero rules, section packs, the fixed media frame and the slop word lists as ideation input, since they prescribe layout and he said layout "should be up to inference" (v3's call, his to strike).
- `imagegen-frontend-web` and `imagegen-frontend-mobile`: readability (mobile 29, web background-image harmony and mobile-implied fidelity), safe areas (mobile 13), anti-clutter and anti-nesting (mobile 15, web graphic restraint), image-behind-text (mobile 18): `directions.md` readability rules. Not used: the one-image-per-section output rule, the style variation engines (replaced by the named structural axis), the default phone mockup frame (dropped for ideation), category biases.
