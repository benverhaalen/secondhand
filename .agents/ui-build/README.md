# Building a page: the contract every builder follows

Ben, 04:09: "i set everything up so it should just be able to run and i get a finished, professional, well designed, deep app (or website)". 04:10: "the system i created could be used to design any new page". This file is how one brief becomes a finished page with no one holding its hand. The loop itself is [frontend-standard §2](../../product/frontend-standard.md#2-build-the-loop); this file says how a builder runs it in this repo, today.

## Start from the existing contract

Read `AGENTS.md` and `.agents/thinking.md`, then run:

```sh
node scripts/ui-proof.mjs context --medium app /buy
```

Replace `/buy` with the concrete route. If the web route manifest is absent, export the app first with `cd app && npx expo export --platform web`. Context selects the existing page job, behavior table, interaction rows, rule brief and relevant proposed interaction/copy sections. It also identifies missing contracts and actual test consumers. Open the cited sources that affect this change; hashes identify the version, not evidence that a source was read. Do not create a parallel page-purpose file or a second rule registry.

Use [frontend-standard §1](../../product/frontend-standard.md#1-judge-the-order-of-questions-for-any-screen) for the order of decisions and medium distinctions. [Taste evidence](../../research/cross-cutting/ben/taste-evidence.md) records previous reactions. [Appllama usage](../vendor/appllama/appllama-usage/SKILL.md) guides flow research when the structure is uncertain. [The copy audit](../../spec/copy-cuts.md) is a proposal to inspect in context, not a batch-deletion instruction. The brand's [coder card](../../brand/coder-card.md) and the [shared parts](../../app/src/ui/README.md) define the visual vocabulary.

Prove a representative complete journey before expanding a redesign: normal entry and default content, one meaningful action, its confirmed result, then return. Include direct entry, refresh, failure and interrupted work where the platform permits them. An image idea does not establish behavior, and a logged tap does not establish its promised result.

## When something is not decided

Reason it out as the best product designer you know would: what the product is for, which person on this screen matters most and what they want (not what they would say), how we want the page used, how a shipped app that people already know handles it, and what Ben praised or criticized. Research and earlier calls feed that reasoning; they are not a ranking. Decide, write one line of why in the page's `decisions` list in its behavior table, and keep going. Continue reversible implementation within the authorized scope. Ask when a decision changes product direction, scope or locked taste, or needs an irreversible action; cross-page consistency work alone is not a reason to stop.

## The page, from brief to done

| Step | What you do | Done when |
|---|---|---|
| Frame | Who uses it, how often, what they came to do, where a mistake costs most, the ways out from ways-out.md, the moment a person stays in the loop | Five lines at the top of `app/behavior/<page>.json` under `frame` |
| Compose | Build the screen in `app/src/app/...` from the parts in `app/src/ui` only, starting from the recipes below. One version; a second only when the layout is truly open | It renders on web at 390 x 844 with demo data from `app/src/demo` |
| Missing part | If no part fits, write the part in `app/src/ui/parts/` with its reason, every state, a data-part name and a row on the parts sheet. Never style a screen by hand | The parts sheet shows it in light and dark |
| Behavior table | A fresh agent compares the intended journey and existing `app/behavior/<page>.json` with the render; reconcile every state, control and return path without replacing the contract from pixels alone | Every visible control has its intended result and a recovery path where needed |
| Tests first | The same agent turns the table into tests in `app/e2e/<page>.test.mjs` against the web build (copy `app/e2e/today.test.mjs`; run `node --test "app/e2e/*.test.mjs"`), read from the event log, and a Maestro flow in `app/e2e/maestro/<page>.yaml` | They fail before the behavior exists |
| Behavior | Make the tests pass. Motion and haptics from `app/src/ui/motion.ts` and frontend-standard §3 | Tests pass |
| Check | Run the scoped proof command below, inspect the actual current renders and exercise the intended journey | Required checks pass, meaningful outcomes are asserted, and remaining judgment has a current artifact review |
| Break it | Once for the whole app before a demo, not per page: `break-ui` and `review-animations` (long text, no data, slow network, huge numbers, dark mode, large type, fast taps; each persona and ways-out row) | Every defect went through the intake below |
| Record | Every defect found, by anyone, goes through the intake below | The commit names the layer it was fixed in |

A beautiful page with a dead control fails. So does a working page that drifts from the kit.

## Right the first time: what every page already needs

These are what fresh tests and Ben's gallery notes found missing, again and again, on pages that had passed their checks (44 gaps on Item, Plan and Post alone; the same kinds on Ship, Today and You). Build them in from the first render; the tests will look for them.

| Every page has | How, with the part that does it |
|---|---|
| All eight states from `useScreen()` (`app/src/demo/screen.ts`), or `<Screen skip="state: why">` | failed is the page with what did not load and Try again (`EmptyState` with an action); offline is the last copy, and every action on it says "Waiting for signal" and does nothing else: never "Saved", "Posted" or "Accepted" |
| A way back to the site on anything that lives there | `SiteLink` (the logo and "Open on the site", never the site's name in words); where the person checks a time or a listing's state, `SiteCopy` with the site's own screenshot (`parts/site-link.tsx`) |
| "Why?" on every number the agent chose | The reason in plain words first, the numbers on a tap (Ben 06:53: "in plain language ... then see numbers if need be"); the same pattern as the price rule on You, Settings |
| An honest Undo, or a warning before | A step that can be undone shows as done with `UndoToast`; one that cannot says so on the button or the line above it before the tap |
| Money as "You get $X" | What reaches the person after fees. Never "You keep". A big amount always has its words (C6) |
| Controls that say what they are | A switch has role switch and on or off and names its subject ("Post on eBay"); a header that folds passes `expanded` to `Press`; one testID per control on a screen (a pager and a row both called `photos` fail) |
| Every input logged | Scrim taps, sheet closes and failed saves go through `log/`; a `catch` that only hides an error fails the code check |
| Facts that agree with the state | A sold thing offers no Post; a live thing's changed plan shows Save; a brand typed wrong is corrected ("Carhart" to "Carhartt") |
| The wash only if it is a main tab | `<Screen wash>` on `(tabs)/` routes and nowhere else (U8) |

**Recipes that already exist; reach for them before writing a part.** A grid of things: `Tile` in a `Shelf` (folds from its header, `onAll` for See all). A tier of cards that can wait: `Pile` (piled, fans out on tap, `onLess` folds it back). The money at the top: `MoneyNews` with the best true number (`top()` in `app/src/today/cards.ts`). A dashboard: `MoneyBar`, `WeekChart`, `StateBar`, `PulseRow`. A choice of rules with its reason: the list on You, App defaults, then the numbers on a second sheet. A price range: `Range`. Sales the person can leave out: `SaleRow`. Times for a pickup: day chips and `TimeSpan`.

## Spend checks where the change is

```sh
node scripts/ui-proof.mjs check --medium app /buy --out logs/ui-proof
```

Use a supported Node version with dependencies installed in `app`. This executes the repository gate, associated browser behavior tests, the tab-shell suite for main tabs and `app-check` renders. Missing purpose/behavior/test contracts, failed commands, zero executed passing tests, missing or mismatched renders and inputs changed during execution fail the proof. The receipt records command outcomes and source/artifact hashes under the existing ignored logs directory. Each run has isolated render files, so parallel runs do not substitute each other's screenshots. A `checks-passed` result means only those checks passed; it does not approve design or establish native behavior.

For a shared component or token change, add `--shared` to expand to all exported routes, resolving dynamic paths from concrete behavior states. Missing coverage fails explicitly. If two requested paths share a dynamic route, check them separately; the tool rejects ambiguous artifact identities. A local page check cannot establish safety for every consumer of a shared primitive. CI also runs the full browser suites; a local receipt is not a bypass for CI.

A fresh reviewer gets the intended purpose, existing contracts, actual current render and completed journey, without the builder's preferred verdict. It checks priority, content ownership, density, comprehension and state continuity. Revise the contract if evidence shows it was wrong; never weaken a failing check merely to get green. The builder can iterate independently within accepted direction. Ben remains the decision maker for unresolved taste and product direction.

`--medium web --source <file.html>` provides partial brand evidence and explicitly fails complete proof without behavior and visual review. Video has no registered temporal/audio proof here; a story-frame check is not a movie check. Use the actual delivery medium's review from frontend-standard §1. These gaps are visible limitations, not inferred passes.

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
5. **Teach.** If a builder following this file would have made it again, correct the existing source and its consumer in the same commit. Preserve scope and evidence; do not turn a local correction into a universal design prohibition. Quote Ben's words in `product/words.md` when the defect came from him. Retire a rule when it no longer catches a useful failure or rejects a justified design.

## Rules for parallel builders

- Own only your page's files: its route, its behavior table, its tests, its demo data file. A part you add goes in its own file under `app/src/ui/parts/`.
- Commit small, with `type(scope): plain words` and a `Rests-on:` trailer. Never push; the integrating thread merges.
- No image model draws UI. A photo the page needs comes from `assets/demo-items/` or is asked for.
- Run `node .agents/check.mjs` before you report. Report what you built, every decision you made with its one line of why, and what you could not finish.
