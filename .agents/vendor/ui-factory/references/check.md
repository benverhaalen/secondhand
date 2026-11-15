# Stage 6. Check, per screen

Open when: any size, after a screen is built or changed. At light size run the scripted checks on the changed screens only, and the image compare only when an approved image exists for that screen. The door check steps 1 and 2 run before Stage 5 starts (full size).

## Emil skill files to read before this stage runs

Always (both sizes): `~/.local/share/harness/vendor/emil/break-ui/SKILL.md` and `~/.local/share/harness/vendor/emil/break-ui/CATALOG.md`.
When the screen has any motion: `~/.local/share/harness/vendor/emil/review-animations/SKILL.md` and `STANDARDS.md`, `~/.local/share/harness/vendor/emil/animation-performance/SKILL.md`, `~/.local/share/harness/vendor/emil/remove-animations/SKILL.md`, and `~/.local/share/harness/vendor/emil/improve-animations/SKILL.md` (+ `AUDIT.md`, `PLAN-TEMPLATE.md`) when the motion problems span more than this screen.
As in the build stage, their greetings, stops and count caps do not apply; record each file read in the run notes. break-ui's "report before fixing, then stop" becomes: findings that are design decisions (truncate or wrap, what an empty field shows) go to the end message as proposed; plain breaks are fixed and rechecked.

## Compare with the approved image

1. `node scripts/shot_pair.mjs --url <screen> --viewport <the image's CSS viewport> --approved <image> [--setup state.mjs] [--scale 2]` captures the built screen at the same viewport and state and writes `pair.png` (and `diff.png` when sizes match).
2. A fresh helper with both pictures (not the builder) classes each mismatch as an intended adaptation, a substitution, or drift, checking pane ratios and alignment, type shape, weight, size and wrapping, control geometry, spacing and asset treatment separately (ui-continuity.md comparison contract). Drift is fixed; the other two are recorded. Models believe their recreation of an image succeeded when it did not (Impeccable), which is why the builder does not judge its own match.
3. The pixel diff proves only "same as approved"; use it for regressions, not for "right".
4. When the generated image itself departed from his references, do not code that departure and call the transfer a success.

## The UX door check

His words: "it would ask a new agent on each screen as if it was an expert ui ux person what would happen if i clicked x button ... would write deterministic code to check that behavior exactly - because agents work way better when working with code".
1. Before the build, a fresh helper gets the direction image, the four lines and the state list, and answers per control as an expert designer: what happens on click, where back goes, what each state shows, and why. Its answers become the table `checks/<screen>.transitions.json` (form: `node scripts/transitions.mjs --example`). Deliberately one-way transitions (a sent payment, a deleted item) are marked `"one_way": true`.
2. A second helper, not the builder, turns the table into checks: `node scripts/transitions.mjs --table <file> --emit tests/<screen>.transitions.spec.ts` for the project's suite, or `--table <file> --base <url>` to run directly. Each row runs in a fresh page and is screenshotted.
3. A third pass walks the running build from the normal entry point without reading the source: the happy path, the skip-everything path and the bad-input path. It counts steps against the minimum, back-tracks, dead ends and points that needed inside knowledge. Agents complete flows better than first-time users, so a smooth walk does not show learnability (ux-structure-verification.md:82).
4. Emil's `break-ui`: a worst-case data set at the data boundary behind a dev-only toggle (Demo, Worst case, Empty, One, Huge), with values from `CATALOG.md`; every state rendered and captured with `geometry_a11y.mjs` (each state is a URL such as `?data=worst`, or a `--setup` module). A state not captured is not verified.
5. When build and table disagree, the main agent decides whether the code or the answer is wrong and says which. The builder cannot edit the table or the checks (the `build` hook that refuses those edits is untested). Findings are hypotheses tied to a capture; "zero found" is reported as zero found, not as passing.
When a flow has several states and events that can arrive out of order, Part 4's offer of an explicit state machine with a model check applies, on his yes.

## Scripted checks

1. Membership: `python3 -I scripts/membership_check.py --tokens brand/tokens.css [--waivers brand/waivers.txt] src` (colors, sizes, radii, spacing, durations from tokens; Tailwind arbitrary values). In the page, `token_scan.mjs` on the built screen shows computed values that slipped through. A waiver is a visible line with a reason, never a silent skip.
2. Controls: `python3 -I scripts/sdk_controls.py --project . src` lists interactive controls and flags any not from the Vercel UI SDK without a written reason, using `control-sources.md`.
3. Geometry at each viewport and state: `node scripts/geometry_a11y.mjs --url ... --viewport ... [--viewport ...]` for overflow, offscreen, clipping, truncation, overlap, covered controls, small targets.
4. Accessibility: the same run applies axe-core with the `wcag22aa` tag (its target-size rule ships off); install `axe-core` in the project if the script says it is missing. Plus the SDK's `checkPattern` for its components, and a keyboard-only run of each main task.
5. Brand presence and default absence: each signature asset in `brand/codes.md` appears on the screen where it should; the patterns in `brand/anti-pillars.md` do not.
6. Words on screen: first `python3 -I scripts/screen_strings.py --source src --list` (and `--text-file` from `geometry_a11y.mjs --dump-text` for runtime text) and ask of each string "should this exist?", deleting copy with no job; then run it without `--list` for the writing skill's product-surface lint.

The kept test exception applies here too: a check whose setup would cost far more than the change it guards is skipped with a stated reason and a real run shown, and goes on the unfinished list. It never applies to the door-check table or to accessibility checks on a main task (that limit is a proposal in v3, not his rule).

## What scripts can and cannot prove

Can: allowed values, presence of named things, geometry, listed accessibility rules, and that the app follows the transition table on the paths it runs. Cannot: that the table is right, that a token is in the right place, that the screen looks good, that a new component feels like its family, or that a first-time user can learn it. Those go to a fresh critic, and brand feel to him. Vision models are weak exactly where geometry checks are exact: F1 22.19% on text overflow and 33.75% on overlap (UI-Lens, ui-deterministic-verification.md:33).

## AI tells

Words: the writing skill covers "words inside an app or website". Visuals: the named tells (a purple accent, Inter, glassmorphism, icon-topped feature cards, nested boxes, filler pills) are mostly practitioner claims, and banning one moves output to the next likeliest default. Handle them as anti-pillars paired with an alternative in the brand file, and flag listed patterns as questions, not failures. A cluster of tells counts; one hit does not.

## Optional audit lenses (carried over from visual-direction-to-ui)

These are Jakub Krehel's public skills. They are not vendored and not installed; read the linked file when the condition holds, and record in the run file which lens was applied, to which artifact, what it found, and whether the change was adopted, rejected, or returned to him as a taste decision. Do not claim a lens ran if its file was not read.
- A broad final review across UI, layout, type, color, writing and accessibility, when he asks for a polish pass or the scripted checks pass and the screen still reads as generic: choose one of https://github.com/jakubkrehel/skills/blob/main/skills/better-interface/SKILL.md or https://github.com/jakubkrehel/skills/blob/main/skills/interface-review/SKILL.md, then focus on observed failures.
- A specialist lens only when it matches a real question or audit finding: `better-typography`, `better-colors`, `better-layout`, `better-accessibility`, `better-writing` under the same repository path.
Emil's vendored skills and the scripts come first; these lenses add a second view and their findings are hypotheses like any critic's.

## Loop

Fix, recheck, and stop on two rounds with no progress (`critique-loop.md`). The `build` done-gate stops after 3 failed rounds, his number.
