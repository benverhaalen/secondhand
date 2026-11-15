# Building a page: the contract every builder follows

Ben, 04:09: "i set everything up so it should just be able to run and i get a finished, professional, well designed, deep app (or website)". 04:10: "the system i created could be used to design any new page". This file is how one brief becomes a finished page with no one holding its hand. The loop itself is [frontend-standard §2](../../product/frontend-standard.md#2-build-the-loop); this file says how a builder runs it in this repo, today.

## Read first, in this order

1. [AGENTS.md](../../AGENTS.md) and [.agents/thinking.md](../thinking.md).
2. [product/ui-constitution.md](../../product/ui-constitution.md), [brand/constitution.md](../../brand/constitution.md) Articles 5 to 11, [brand/coder-card.md](../../brand/coder-card.md), [product/frontend-standard.md](../../product/frontend-standard.md), [product/copy.md](../../product/copy.md).
3. Your page in [spec/pages.md §6](../../spec/pages.md#6-the-pages), its rows in [spec/ways-out.md](../../spec/ways-out.md), [product/personas.md](../../product/personas.md), and `node scripts/evidence.mjs <slug>`.
4. [research/cross-cutting/ben/taste-evidence.md](../../research/cross-cutting/ben/taste-evidence.md): what Ben praised and criticized.
5. Emil Kowalski's skills, vendored in [.agents/vendor/emil/](../vendor/emil/): `emil-design-eng` before you build, `animate-expo` and `gestures` for motion and touch, `break-ui` after you build. Ben's own [ui-factory](../vendor/ui-factory/SKILL.md) references `check.md` and `critique-loop.md`.

## When something is not decided

Reason it out as the best product designer you know would: what the product is for, which person on this screen matters most and what they want (not what they would say), how we want the page used, how a shipped app that people already know handles it, and what Ben praised or criticized. Research and earlier calls feed that reasoning; they are not a ranking. Decide, write one line of why in the page's `decisions` list in its behavior table, and keep going. Stop and ask only for a step that cannot be undone or that changes another page.

## The page, from brief to done

| Step | What you do | Done when |
|---|---|---|
| Frame | Who uses it, how often, what they came to do, where a mistake costs most, the ways out from ways-out.md, the moment a person stays in the loop | Five lines at the top of `app/behavior/<page>.json` under `frame` |
| Compose | Build the screen in `app/src/app/...` from the parts in `app/src/ui` only. Two or three variants in code when the layout is not obvious, each leaning toward one persona; merge what serves one and costs nobody | It renders on web at 390 x 844 with demo data from `app/src/demo` |
| Missing part | If no part fits, write the part in `app/src/ui/parts/` with its reason, every state, a data-part name and a row on the parts sheet. Never style a screen by hand | The parts sheet shows it in light and dark |
| Behavior table | A fresh agent that has not seen your code writes `app/behavior/<page>.json` from the render: every state, every control, where Back goes | Every control on screen is in the table |
| Tests first | A fresh agent turns the table into Playwright tests in `app/e2e/<page>.spec.ts` against the web build, read from the event log, and a Maestro flow in `app/e2e/maestro/<page>.yaml` | They fail before the behavior exists |
| Behavior | Make the tests pass. Motion and haptics from `app/src/ui/motion.ts` and frontend-standard §3 | Tests pass |
| Check | `node scripts/app-check.mjs <route>`: brand-check on the real render (U6 logos, U7 nothing moves, sizes, contrast, corners) and Emil's checks; `node .agents/check.mjs` | Zero errors |
| Break it | Run `break-ui` on the page: long text, no data, slow network, huge numbers, dark mode, large type, fast taps | Every break is fixed, and each one that a script could catch is a new check with a failing test |
| Record | A finding that could recur goes to the lowest layer that makes it impossible: a token, a part, a check, then a judge line | The commit names it |

A beautiful page with a dead control fails. So does a working page that drifts from the kit.

## Human in the loop is the signature

Ben, 04:04: "design around human in the loop to show it off as central to our product". Every page shows what the agent guessed and lets the person change it: guesses are underlined dotted until the person touches them, an approval is one tap with what it will do written on the button, and every automatic step can be undone from where it happened. Price, an address and a pickup always wait for a tap. Design these moments to look deliberate and calm, not like warnings.

## Rules for parallel builders

- Own only your page's files: its route, its behavior table, its tests, its demo data file. A part you add goes in its own file under `app/src/ui/parts/`.
- Commit small, with `type(scope): plain words` and a `Rests-on:` trailer. Never push; the integrating thread merges.
- No image model draws UI. A photo the page needs comes from `assets/demo-items/` or is asked for.
- Run `node .agents/check.mjs` before you report. Report what you built, every decision you made with its one line of why, and what you could not finish.
