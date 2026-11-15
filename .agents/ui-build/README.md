# Building a page: the contract every builder follows

Ben, 04:09: "i set everything up so it should just be able to run and i get a finished, professional, well designed, deep app (or website)". 04:10: "the system i created could be used to design any new page". This file is how one brief becomes a finished page with no one holding its hand. The loop itself is [frontend-standard §2](../../product/frontend-standard.md#2-build-the-loop); this file says how a builder runs it in this repo, today.

## The method, and why it is the default

Ben loved the dark mode Today at 02:18 ("whatever principles you used to tell if something should exist or not ... were stellar"; "how much did you find issues and audit compared to just using the design system"). What made it work, from his 01:16 notes and how it was refined:

1. **Every element has to earn its place.** Before drawing, each thing on the screen was asked what the person loses without it. Most were cut. Minimal information, with the money and the deadline kept.
2. **One kind, one size.** Every part got a fixed size whatever is inside it ("everything should be standardized size wise no matter whats in it"), and corners nest by arithmetic (36 less 16 is 20).
3. **Measured, not eyeballed.** The real fonts were loaded, the screen was rendered at 390 x 844, and a script measured every box, gap, corner and contrast before Ben saw it. Optical errors were fixed by geometry: a corner inset of r − (r − p)/√2, ink instead of boxes.
4. **Dark is a mirror of light.** Raised surfaces are lighter; separation comes from tone, not lines or shadows.
5. **Every correction reaches everything.** A note on one card was applied to every card of its kind, and became a rule.

Why other UI work fell short: image models drew whole screens and their sizes drifted; each thread kept its own mock and its own kit, so the same card looked different in three places; rules lived in documents with no script behind them (the logo rule only checked file shapes); and mocks reached Ben without passing the checks (one had 187 errors). So: one kit, no hand styling, no image-drawn UI, every rule a check, and nothing reaches Ben until its render passes.

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
| Tests first | A fresh agent turns the table into tests in `app/e2e/<page>.test.mjs` against the web build (copy `app/e2e/today.test.mjs`; run `node --test "app/e2e/*.test.mjs"`), read from the event log, and a Maestro flow in `app/e2e/maestro/<page>.yaml` | They fail before the behavior exists |
| Behavior | Make the tests pass. Motion and haptics from `app/src/ui/motion.ts` and frontend-standard §3 | Tests pass |
| Check | `node scripts/app-check.mjs <route>`: brand-check on the real render (U6 logos, U7 nothing moves, sizes, contrast, corners) and Emil's checks; `node .agents/check.mjs` | Zero errors |
| Break it | Run `break-ui` and `review-animations` on the page: long text, no data, slow network, huge numbers, dark mode, large type, fast taps; walk it as each persona and each ways-out row | Every defect went through the intake below |
| Record | Every defect found, by anyone, goes through the intake below | The commit names the layer it was fixed in |

A beautiful page with a dead control fails. So does a working page that drifts from the kit.

## When the agent acts and when it hands off

Ben, 04:04: design around human in the loop and show it off; 04:12: not as a slogan, as "a decision when navigating when to hand off to human vs agent". Decide it per action, on every page, with this rule (the tiers are in [decisions](../../product/decisions.md#2026-11-14-automation-runs-in-tiers-that-learn)):

| The agent proceeds, and shows it as done with Undo | It hands off, and shows a card with its guess filled in |
|---|---|
| The step can be undone where it happened | The step cannot be undone, or is public in the person's name for the first time |
| It stays inside limits the person set (floor, ceiling, rules) | Money moves outside those limits, or a price is set at all |
| The person approved this kind three times unedited | An address, a pickup, an identity or a payment is shared |
| The agent is sure, and the facts are backed | The agent guessed, a claim has no source, or two sites disagree |

A hand-off shows what the agent would do, written on the button, with every guessed word underlined dotted until the person touches it; one tap approves. A step the agent took shows in the log and on the page it changed, with Undo. Never write a slogan about it; the screens show it.

## One intake for every defect

Ben, 04:11: "what else would become a check? ... ensure your process is generalizable". A defect is anything that should not have reached a person, whatever found it: Ben's correction, break-ui, a judge that fails the same thing twice, an end-to-end test, a bug on the phone, review-animations, an accessibility audit, a persona or ways-out walk, two surfaces that drift apart, a mismatch with the backend's contract, or a research finding. Each one runs the same five steps, in one commit:

1. **Reproduce.** Add the smallest fixture that shows it: a render case, a content case in `.agents/ui-states.json`, an e2e step, or a unit test. It must fail now.
2. **Scope.** Name where it applies: global, app, web, deck, post or story (`media` on the rule's row). A rule for the app never binds the website unless the website has the same problem.
3. **Fix it at the lowest layer.** A token, then a part, then the page. A fix in the page alone is allowed only for a defect that exists on one page.
4. **Hold it.** If a script can decide it, a check with that fixture as its failing test and a `check` row in `.agents/ui-rules.json`. If not, one "Fail if" judge line with its source. A note with neither does not count.
5. **Teach.** If a builder following this file would have made it again, change this file or the skill that misled them, in the same commit, and quote Ben's words in `product/words.md` when the defect came from him.

## Rules for parallel builders

- Own only your page's files: its route, its behavior table, its tests, its demo data file. A part you add goes in its own file under `app/src/ui/parts/`.
- Commit small, with `type(scope): plain words` and a `Rests-on:` trailer. Never push; the integrating thread merges.
- No image model draws UI. A photo the page needs comes from `assets/demo-items/` or is asked for.
- Run `node .agents/check.mjs` before you report. Report what you built, every decision you made with its one line of why, and what you could not finish.
