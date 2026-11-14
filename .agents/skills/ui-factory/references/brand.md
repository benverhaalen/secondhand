# Stage 1. Brand

Open when: full size and the project has no `brand/` folder, or he asks to change the brand. At light size with no brand, read only "Intake 1" (the scan) and the coder card form.

His words that fix the process: "i give reference images and maybe some thoughts and we iterate till i have a brand i like with examples of how the brand would be used". What the brand must be: "token efficient, deterministic, and easily generalizable without making all ui's bland and generic and drab". Run `record search brand` (and the project name) first and quote what he said before any taste call.

## Intake

1. Existing UI. Run `scripts/token_scan.mjs --url <each main page> --viewport <the width it is used at most>` on the running app (or `--source <dir>` when it cannot run). It writes candidate tokens marked unconfirmed and `guesses.md`, "what the scan had to guess" (Kite's report). Show each guess to him as a button pair (keep, drop). A missing design document does not make a working app greenfield (his method): inspect the current interface, keep its essential behaviours and content, and record where a redesign departs.
2. No UI. He drops reference images, sites or video. Give each one a row of one-tap job buttons: layout, feel, density, color and type, motion, avoid. This is the old skill's "what to borrow or avoid from each", asked without typing. Record per reference whether it is a requirement or a weak preference signal. Never copy a whole interface.
3. Thin references, or he asks: a helper researches references at the root source ("Find great references -> find them at the root source"). For each: why it is good, where it came from, and whether it is a shipped product screen or a marketing image ("Because its big and widely used it doesnt mean its good as a reference"). He approves them in the same iteration. Prefer inspected shipped products over AI concept galleries (ui-continuity.md).
4. Sites are opened only with the Playwright scripts here (bundled Chromium, fresh temporary profile). Never his Chrome profile or cookies, never Browser Use. Video goes through `scripts/video_frames.py`.

## Iteration (his first regular stop)

1. Images are brand showcases, not screens: a style tile (type, color, surfaces and a few components on one board, deliberately not a layout), an element collage of components, and usage examples (the brand on a card, a dense table, an empty state, a marketing header). Make them as in `directions.md` "Making images".
2. He reacts by picking, pointing at a region (a screenshot with a dragged box), or dropping another image. Every pick has "neither" and "close, but" buttons.
3. A vague word from him ("cleaner") gets a few translations as buttons, each with its design term once (`input-and-terms.md`).
4. In the same round, sample the image model with no brand and show its distinct defaults so he can mark each "keep" or "never". He can skip this. It feeds the anti-pillars.
5. Repeat until he says he likes it. No approval by silence or elapsed time. "Surprise me" delegates taste; record that he said it.
6. His direction pick happens here, once, from these showcases (his click "Direction early, from images", a weak signal). Later per-screen directions are chosen by the critique and shown in the end message, where he can overrule them.

## The `brand/` folder: one source, two views

Source:
1. `codes.md`: a few signature assets with exact values and a boundary clause each ("this color pair as the dominant ground, never as body text").
2. `tokens.css` (CSS variables; modes as sets of values under `[data-theme=...]`, never new colors), exported as `tokens.json` (DTCG) and `DESIGN.md`. Lint the DESIGN.md with `npx @google/design.md lint DESIGN.md` when Node is present. The DESIGN.md keeps the eight sections of the old constitution: purpose and audience; decision history (which reference supplied which property, approved and rejected images, owner and date); principles as observable rules with a compliant and an off-direction example; visual language; interaction language including every state and reduced motion; content language; implementation contract (where tokens live, shared components, rules for new components, how exceptions are recorded); evidence (screenshots tied to viewport and state, open uncertainty). Write decisions, not adjectives, and mark selected versus provisional.
3. `anti-pillars.md`: each banned default paired with what to reach for instead, because banning one default moves output to the next likeliest one. Include his never-marks from Iteration 4.
4. `expression.md`: a short table of how loud the brand may be on a tool screen, a reading screen and a marketing page (Impeccable's surface modes). A website for an existing app keeps the codes and changes the expression level.
5. `examples/`: the approved showcase images, each with its job. `corrections.md`: each rule with his quoted words, its reason (marked as the agent's reading when inferred), and whether a check exists.
6. `rules/`: an index (`rules/INDEX.md`) of one file per rule group, each opening with one line saying when it applies ("For marketing pages."). Open only the ones that fit the task (Kite's index).

Image card (`image-card.md`, what the image model is given):
1. The palette as a swatch image with color names, not hex alone, since text-to-image models handle hex badly.
2. One style board or component sheet, with its job stated.
3. The signature assets described in words.
4. A short avoid list written as what to do instead.
5. Font and icon identity as words and a real rendered sample, never a claim that the image will match a font.

Coder card (`coder-card.md`, what the coding agent reads before any UI edit):
1. First line: the precedence line (his direct decisions, then the brand codes, then the approved image for composition and hierarchy, then the code as it stands, then agent inference). A rule that conflicts with the code is fixed in one place, not overridden by a second rule.
2. Read `tokens.css` first; write `var(--name)` only (Kite's system-first read). `scripts/membership_check.py` enforces it.
3. The component list it may place, and the pattern rules (`build.md`).
4. The signature moves with their allowed ranges.
5. His font and icon defaults, Geist Sans and Hugeicons Stroke Rounded, unless the brand says otherwise (`~/.claude/skills/reference-driven-development/references/ui-continuity.md`, "UI font and icon defaults"). Verify the real font file loads.
6. Interactive controls come from the Vercel UI SDK (`vercel-ui-sdk.md`).

## Kite mechanisms

Copied: read the system first and write variables, never raw values; an index of rules with one first line each, opened only when the task fits; one rule, one place (a correction rewrites the wrong line, never adds an overriding one); look before done (render, see the screenshot, fix, then say done); place components, never redraw them, and offer to make a component once the same part appears on three frames (Kite's number); brand ingestion with a guess report; modes as sets of variable values.

Not copied: the hosted canvas and its comment threads, the MCP server, the account. Kite has no check that rejects off-brand values (kite-teardown.md:9), so staying on brand here comes from `membership_check.py` and the check stage, not from Kite. Kite's token savings are single vendor-run tests.

## Evidence against (keep in view)

No test of any brand definition on agent-made UI exists (brand-definition.md:145). Defaults are stubborn: with an aesthetics block Claude still converged on Space Grotesk (brand-definition.md:116). OpenAI says its image model may struggle to keep brand elements consistent (ui-image-context.md:13), so the brand may not hold across directions; the check stage catches drift in code, not in images.
