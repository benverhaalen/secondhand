# Instructions for agents

## Active team handoffs

Keep building the current task while staying current with relevant team changes. Read [.agents/coordination.md](.agents/coordination.md) once when starting or resuming substantial work; it routes to bounded handoffs in `.agents/team/`. At natural work boundaries, check relevant team notes roughly every few minutes and before shared-interface changes or integration; there are no automatic hooks. Read only relevant packets, apply or hand off useful changes, and ask the affected humans directly about conflicting opinions. Preserve original quotes and provenance; do not export private conversations or load the whole history. No waiting loops, automatic merges, or mandatory helper launches.

## Git

Use git often, the usual way. Follow the [git rules](.agents/coordination.md#git-rules): pull when you start and before you push, commit each piece that works, push after every working commit, work directly on `main` and push often so teammates' agents pick it up (no long-lived branches; helpers never make their own), small commits of explicit paths with `type(scope): plain words` messages, never auto-reset/stash/rebase a shared or dirty checkout, never force-push shared branches, and never commit secrets or personal data.

## How to work here

The map is in [README.md](README.md). Read [product/vision.md](product/vision.md), the page for your feature (`features/<slug>/`) and [.agents/thinking.md](.agents/thinking.md), which sets how much care your change needs and how to think about its type of problem. Then do whatever your situation calls for:

| Situation | Do this |
|---|---|
| A choice that shapes what gets built, or is hard to undo | Skill `decide`: options, evidence, a recommendation. Taste, direction and scope go to Ben or Nate. |
| You need a fact that could have changed, or a reference | Skill `research-note`: rawest sources, every claim marked. File it in `research/<slug>/<your human>/`. |
| Any screen, copy or visual work | Skill `ui-factory` (Ben's UI procedure, for every agent), then `ui-screen` for what it must meet: [product/ui-constitution.md](product/ui-constitution.md), [brand/constitution.md](brand/constitution.md), [brand/coder-card.md](brand/coder-card.md), [product/frontend-standard.md](product/frontend-standard.md), [product/copy.md](product/copy.md). |
| Ben or Nate says something about the product | Quote it verbatim in [product/words.md](product/words.md) (append only), and link to it from where it's used. |
| A correction you could check with a script | Add it as a check with a failing test in `.agents/checks/`, instead of another line of instructions. |
| Words a person reads, in the app or out of it | Skill `writing` (Ben's lint and rules). |
| Before every push | `node .agents/check.mjs` (checks and tests). It must pass. |

The skills live in `.agents/skills/` (Codex) and `.claude/skills/` (a link to the same files). Mark your own suggestions as *agent proposal*, and never move one to Decided yourself.

## UI writing

The [UI constitution](product/ui-constitution.md) governs how every UI decision is researched, reasoned and made: extreme intention (every element has a stated reason), start from the person, full action sets, plain words. Any agent generating or editing UI follows [product/copy.md](product/copy.md): minimal in-app writing, show rather than say, Ben's anti-claudish skill applied to every string, familiar patterns from apps people already use, and color and layout spent only where attention should go. This is a decision ([decisions.md](product/decisions.md)), not a style preference. How to build, judge, audit and animate a screen is in [product/frontend-standard.md](product/frontend-standard.md); run `node scripts/copy-lint.mjs` on UI strings.
