---
name: ui-factory
description: Use for any UI or UX work in a project with UI code - a new app, a new screen or feature, a website for an existing app, a small UI fix, or "this screen feels generic" - and when Ben asks for only a brand, only direction images, or only a check of a screen. Picks light or full size by how much intent the agent would have to guess, then runs the brand, screen frame, image directions, critique and loop, build (with the Vercel UI SDK and Emil Kowalski's skills), scripted checks and whole-app check that the size calls for. Replaces visual-direction-to-ui.
metadata:
  version: 0.1.0
  owner: Ben. Copied from his harness on 2026-11-14 (see PROVENANCE.md); this copy is the one both Ben's and Nate's agents run here
---

# ui-factory

## In this repo

Every screen in secondhand, by any agent, goes through this skill (Ben, 20:26: "ensure all ui is created using my ui generation skills"). The text below is Ben's, unchanged except paths. A few steps name tools from his own machine. Here they map to:

| Ben's text says | In this repo |
|---|---|
| `recall`, the record, his words | `product/words.md`, `product/decisions.md`, and `research/<slug>/<person>/` |
| `build`, `clean`, the done-gate, `step` | AGENTS.md's table, and `node .agents/check.mjs` must pass before every push |
| `lint-rule` | Add a check with a failing test in `.agents/checks/` |
| the writing skill | `.agents/skills/writing/` (lint: `python3 -I .agents/skills/writing/scripts/lint.py --surface product FILE`) |
| Emil's skills | `.agents/vendor/emil/`, unchanged at commit f7ce8c0 |
| `reference-driven-development` and its references | the `research-note` and `decide` skills, and `product/decision-map.md` |
| the project's brand codes | `brand/constitution.md`, `brand/coder-card.md`, `brand/tokens.css`, then `product/ui-constitution.md` and `product/frontend-standard.md` |
| images from the Codex image tool on his subscription | the same for Ben. Nate's agent uses his own image tool and says which one it used |

Scripts run from the repo root, for example `node .agents/skills/ui-factory/scripts/geometry_a11y.mjs --url http://localhost:3000 --viewport 390x844`.

Before any taste or direction call, run `recall` (record search) for this project and brand, and quote what he said. Read the project's `brand/coder-card.md` before any UI edit; if there is no `brand/` folder, run `scripts/token_scan.mjs` first and treat its tokens as unconfirmed.

Precedence, highest first: his direct decisions; then the brand codes; then the approved image for composition and hierarchy; then the code as it stands; then agent inference. A rule that conflicts with the code is fixed in one place, not overridden by a second rule. Light size has no image and follows the code.

This skill adds UI steps to the `build` feature playbook (builder, done statement, failing check first, worktree, landing, done-gate); it does not run a second build. `clean` runs the writing skill's product-surface lint on screen text. A UI correction a script can check goes through `lint-rule`.

## Which size

The size follows how much the agent would have to guess. His rule: ideation is for "bigger screens where an agent has to infer more intent" and "shouldn't be done for every sub state".
1. New app: full, starting at the brand stage.
2. New screen or feature in an existing app: full when it is a new surface, a new entry point or a new navigation level; light when it is a state of an existing screen or a settled component.
3. Website for an existing app: full. Brand codes carry over; the expression level changes.
4. Small fix (a bug, a label, spacing, one component state): light.
5. "This screen feels generic": light first, with a structure check against the four screen lines; full only if that check says the structure is wrong, not just the finish.

Both sizes: write the four screen lines (user, how often, main task, worst-consequence task; at light size a few lines from code and record); read the coder card and pattern rules; build from existing components and tokens, with interactive controls from the Vercel UI SDK; read Emil's `emil-design-eng` before building and `break-ui` before checking; run the scripted checks, and compare with the approved image if one exists for that screen; end with "usable" and the unfinished list.
Light only: no images and no stops for him; checks run on the changed screens only.
Full only: brand stage if the project has none; screen frame, direction images, critique and combine with the loop; the door check with its table written before the build; the whole-app check after the screen lands.

## Stages, and when to open each file

Paths are relative to this skill's folder. Open a file when its condition holds; each names the Emil files to read before its stage runs.
1. Brand: `references/brand.md`, at full size when the project has no `brand/` folder or he asks to change the brand.
2. Screen frame: `references/screen-frame.md`, at full size before directions for a big screen.
3. Directions: `references/directions.md`, at full size after the screen frame. Reads `.agents/vendor/emil/prototype/SKILL.md`.
4. Critique, combine, loop: `references/critique-loop.md`, once direction images exist; its loop rules also govern the check stage.
5. Build: `references/build.md`, any size, before writing UI code. Before choosing any library or writing any control: `references/control-sources.md` and `references/vercel-ui-sdk.md`.
6. Check: `references/check.md`, any size, after a screen is built or changed. Door-check steps 1 and 2 run before Stage 5.
7. Whole-app check: `references/whole-app.md`, full size, after each new screen lands.
Also: `references/corrections.md` when he corrects any UI; `references/input-and-terms.md` when asking him anything or when he drops a reference; `references/end-message.md` when finishing or stopping; `references/old-skills-map.md` to check where an old rule went; `scripts/README.md` for script usage.

Stop at the requested stage. If he asks only for the brand, only for directions, or only for a check, stop there and hand over what was made, with its evidence.

## Where it stops for him

Regular stops:
1. The brand iteration: he says when the brand is right. No approval by silence or elapsed time; "surprise me" delegates taste and is recorded.
2. The direction pick, once, from the brand showcase images (his click "Direction early, from images", weak). Per-screen directions after that are chosen by the critique and shown in the end message, where he can overrule them.

Exceptional stops, only when they happen:
1. A loop ends without a pass (two rounds in a row with no new accepted finding): show the best candidate so far, not the latest, with the remaining findings.
2. A fix would change something he approved or a brand code: show a picture pair first.
3. Anything not undoable, public or billed to an API key (an API-billed image, an account).

Not stops (they go in the end message): per-screen direction picks, critique results, break-ui reports, rule or check offers from corrections, whole-app findings, and installing the Vercel UI SDK into the project (undoable, inside the task, reported). Questions to him are buttons with the consequence of each option.

## Rules that hold everywhere

- Images come from the Codex image tool on his subscription; from Claude Code, ask Codex by command line (`directions.md`). Never claim an image was made without the file, and never substitute imagined images.
- Browsers only through the scripts here: Playwright's bundled Chromium with a fresh temporary profile per run. Never his Chrome profile or cookies; never Browser Use. Playwright is installed per project when a script says it is missing.
- The builder never edits the transition table, its checks, baselines or the lint config written for its screen.
- Critics are fresh helpers that do not see the favoured answer; their findings are hypotheses; countable things go to scripts.
- Record in `brand/screens/<screen>.run.md` which Emil files were read at which stage. Do not claim a skill ran if its file was not read.
- No count caps beyond those he set. Numbers here name their source: Emil's three directions as a starting point, Kite's three frames, the two-round stall rule from Claude Code's workflow docs, his 3 failed rounds in the done-gate.

Sources: Emil Kowalski's skills are vendored unchanged in `.agents/vendor/emil/` (github.com/emilkowalski/skill, commit f7ce8c0, MIT, Copyright (c) 2026 Emil Kowalski; see `.agents/vendor/emil/SOURCE.md`). Kite mechanisms are restated from Kite's public docs. Rules from the old image skills are restated with section names in `references/old-skills-map.md`. None of this has been tested on a real UI task.

Retire when: a step can be removed on a real UI task of his and the result is no worse, checked one step at a time once he allows testing.
