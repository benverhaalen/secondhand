# Stage 5. Build

Open when: any size, before writing UI code. The build itself runs inside the `build` skill's feature playbook (builder, done statement, failing check first, worktree, landing); this file adds the UI steps, it does not run a second build.

## Emil skill files to read before this stage runs

Always (both sizes): `~/.local/share/harness/vendor/emil/emil-design-eng/SKILL.md`.
When the screen has motion, a transition or a gesture: `~/.local/share/harness/vendor/emil/animate/SKILL.md` (+ `RECIPES.md`), `~/.local/share/harness/vendor/emil/choreograph/SKILL.md` (+ `RECIPES.md`) when several elements move together, `~/.local/share/harness/vendor/emil/gestures/SKILL.md` when anything is dragged, swiped, flung or held, `~/.local/share/harness/vendor/emil/animation-vocabulary/SKILL.md` to name motion (also used for teaching terms), and `~/.local/share/harness/vendor/emil/find-animation-opportunities/SKILL.md` as the filter on what may animate.
When the target is a web app used on a phone: `~/.local/share/harness/vendor/emil/mobile-native/SKILL.md`.
Only in an Expo or React Native project: `~/.local/share/harness/vendor/emil/animate-expo/SKILL.md` (+ `RECIPES.md`). Only in a Swift project: `~/.local/share/harness/vendor/emil/write-swift/SKILL.md`.
Only when the brief asks for an Apple-native feel: `~/.local/share/harness/vendor/emil/apple-design/SKILL.md`.
Only when the project uses Sonner: `~/.local/share/harness/vendor/emil/ask-sonner/SKILL.md` (+ `API.md`).
Before choosing any library: `control-sources.md` (the SDK where it covers the need, Emil's `pick-ui-library` pick where it does not; Ben: "where ui sdk doesnt cover use emil's"). Read `~/.local/share/harness/vendor/emil/pick-ui-library/SKILL.md` whenever a row sends you to Emil's pick. It never overrides the SDK for a need the SDK covers, including its base-ui pick for primitives.
Shared references, open when a value is needed: `~/.local/share/harness/vendor/emil/ui-cheatsheet.md`, `~/.local/share/harness/vendor/emil/performance-cheatsheet.md`.

How to use a vendored Emil file here: use its method, standards and values. Its "Initial Response" greeting, its invocation tables and its "stop and wait for the user" points do not apply; the factory's stop list in SKILL.md decides when to stop. Count caps inside them (for example at most 5 variants, 5 to 7 suggestions) are not applied, since Ben set no caps; his own number is only the done check's 3 failed rounds. Record in the run notes (`brand/screens/<screen>.run.md`) each Emil file read and at which stage. Do not claim a skill ran if its file was not read.

## Before the builder starts

1. The door check's transition table and its click-through checks are written by two other agents (`check.md`, door check steps 1 and 2) and are not the builder's to edit.
2. The builder gets: the merged approved image (attached as an image), `brand/coder-card.md`, the four lines and state list, the transition table and its checks, and the real font and icon files.
3. It writes the failing check first, as Part 4 says, with his kept exception ("Keep the exception"): when a fast check would cost far more than the change (a one-word label, a spacing token), it skips it, says why in one line, shows a real run of the screen, and lists the missing check as unfinished.

## Image to code (the build path; "imagetocode skill is what my ui flow was initially based upon")

From `image-to-code` (backup copy at `~/.local/share/harness-reset-backup/2026-11-12/codex/skills/image-to-code-skill/`, sections 8, 9, 21 to 28; restated, no licence file was found):
1. Deep reading before code. Treat the image as a specification, not a mood. Inspect and write down: what the section is and what leads; readable text; type relationships (size, weight, line count, wrapping, tracking, display versus body contrast); spacing relationships (headline to subhead, text to button, card gaps, gutters, section rhythm); buttons and components (shape, radius, fill or outline, hierarchy, padding, borders, shadows, dividers); colors (background, panels, accents, text hierarchy, borders, shadow mood); grid and alignment; repeated motifs. Write what is still unclear.
2. Extraction. Use readable text as starting copy (then the strings pass in `check.md` decides what stays). Map each extracted value to an existing token; a value with no token is a brand question, not a raw value in code. The goal is faithful spacing logic, not pixel OCR.
3. Missing detail, in this order: keep the visible design language; keep layout and spacing logic; keep the component family; keep mood and polish; generate a closer standalone detail image of the same design; regenerate the section fresh; only then choose the most buildable faithful version. Do not fill gaps with generic defaults.
4. Anti-drift. Do not "improve" it into a generic layout: no default templates, no distinctive sections flattened into generic rows, no generous spacing compressed, no strong type flattened, no nested boxes reintroduced.

Order (from `visual-direction-to-ui`): walk one screen from image to tokens first and fix contradictions; then build one full journey through the normal entry point with real content and interactions; then style every state (empty, loading, error, success, hover, focus, disabled, and the state list). Compare with the image before extending (`check.md`).

Light size: no image; build from the coder card and existing components, and follow the code as it stands.

## Pattern rules for every part

1. Compose existing components first. Place, never redraw (Kite).
2. Same structure and same purpose: a variant, with a written use condition.
3. A different structure, content model or behaviour: a new component, which uses only tokens, the same state set and the same prop names as its siblings.
4. When the same part appears on three screens, offer to make it a component (Kite's three frames).

## Interactive controls: the Vercel UI SDK (fixed part of the build)

Read `vercel-ui-sdk.md` before the first interactive control. In short:
1. At project start, run `python3 -I scripts/sdk_controls.py --project <dir>`: it reports the framework, whether it is supported, and what is installed. If supported and missing, install it in the project with the printed command (for React: `npm install @ui-sdk/react @ui-sdk/core`). That is undoable and inside the task, so go ahead and report it in the end message.
2. Before writing any interactive control (menu, select, combobox, dialog, alert dialog, drawer, popover, tooltip, hover card, tabs, accordion, collapsible, listbox, tree, slider, switch, checkbox, radio, toggle, date or time input, date picker, calendar, color picker, command, toast, file input, OTP input, number input, token input, menubar, navigation menu, toolbar, pagination, resizable, scroll area, segmented control, drag and drop), check the SDK's component list and docs for it and use it.
3. Style it through its `data-*` state attributes and CSS variables with the brand tokens. No inline state styles. Declare `@layer ui-sdk;` first in global CSS.
4. A hand-built or other-library control needs a one-line reason (the SDK has no such control, or the project's framework is unsupported) as a `ui-sdk-exception: <reason>` comment on the line above, or a line in `<project>/.harness/ui-sdk-exceptions.md`. `sdk_controls.py` flags any control without one.
5. Where the SDK does not cover the need, Emil's pick from `control-sources.md` is used, and `sdk_controls.py` accepts it without a reason line. A "not known" row is checked in the SDK's current docs first.
Its limits stay visible: 0.1.0-beta, released 2026-11-12, about 25 issues opened on launch day (including default-theme contrast below 3:1 and Tailwind base styles stripping control borders), APIs may change, and it supplies no looks (vercel-ui-sdk.md:51-52).

## Motion

Every candidate passes Emil's four gates from `find-animation-opportunities`, in order: frequency, purpose, speed, then function, and "Expect to reject most candidates". Implement with `animate` (and `choreograph` or `gestures` where they apply), within the ten standards of `review-animations` (`~/.local/share/harness/vendor/emil/review-animations/SKILL.md` and `STANDARDS.md`). Durations and curves come from tokens; Emil's values in `STANDARDS.md` seed the motion tokens when the brand has none. The SDK's motion behaviour keeps elements present until their exit transition ends and honours reduced motion; choreography stays with CSS, View Transitions or a motion library.
