# Instructions for agents

## Active team handoffs

Keep building the current task while staying current with relevant team changes. Read [.agents/coordination.md](.agents/coordination.md) once when starting or resuming substantial work; it routes to bounded handoffs in `.agents/team/`. At natural work boundaries, check relevant team notes roughly every few minutes and before shared-interface changes or integration; there are no automatic hooks. Read only relevant packets, apply or hand off useful changes, and ask the affected humans directly about conflicting opinions. Preserve original quotes and provenance; do not export private conversations or load the whole history. No waiting loops, automatic merges, or mandatory helper launches.

## Git

Use git often, the usual way. Follow the [git rules](.agents/coordination.md#git-rules): pull when you start and before you push, commit each piece that works, push after every working commit, work directly on `main` and push often so teammates' agents pick it up (no long-lived branches; helpers never make their own), small commits of explicit paths with `type(scope): plain words` messages, never auto-reset/stash/rebase a shared or dirty checkout, never force-push shared branches, and never commit secrets or personal data.

## How to work here

The map is in [README.md](README.md). Read [product/vision.md](product/vision.md), the page for your feature (`features/<slug>/`) and [.agents/thinking.md](.agents/thinking.md), which sets how much care your change needs and how to think about its type of problem. `node scripts/evidence.mjs <slug>` lists what the decisions, spec and research already settle for a feature. Then do whatever your situation calls for:

| Situation | Do this |
|---|---|
| A choice that shapes what gets built, or is hard to undo | Skill `decide`: options, evidence, a recommendation. Taste, direction and scope go to Ben or Nate. |
| You need a fact that could have changed, or a reference | Skill `research-note`: rawest sources, every claim marked. File it in `research/<slug>/<your human>/`. |
| Any screen, copy or visual work | Skill `ui-screen`: [product/ui-constitution.md](product/ui-constitution.md), [brand/constitution.md](brand/constitution.md), [brand/coder-card.md](brand/coder-card.md), [product/frontend-standard.md](product/frontend-standard.md), [product/copy.md](product/copy.md). |
| Ben or Nate says something about the product | Quote it verbatim in [product/words.md](product/words.md) (append only), and link to it from where it's used. |
| A correction you could check with a script | Add it as a check with a failing test in `.agents/checks/`, instead of another line of instructions. |
| Writing or changing a rule doc (a skill, a constitution, a standard, this file) | [.agents/thinking.md §4](.agents/thinking.md#4-before-you-write-or-change-a-rule-doc): read the [poteto-mode review](research/cross-cutting/ben/poteto-mode-review.md) first, subtract before you add, one fact in one place. |
| Generating any image | Skill `image-gen`: the Codex CLI with Astra, given the loop to run and how to judge, not the content. |
| Words a person reads, in the app or out of it | Skill `writing` (Ben's lint and rules). |
| Writing code that runs: the app, the server, a job, an agent loop | Skill `build`: done and the command that proves it first, the failing test first, names from `spec/`, a clean diff, a `Rests-on:` trailer citing the sources it follows, and a fresh review against them. Log through [log/](log/README.md): every input, state change, outside call, approval and error. Check a run with `node spec/log.mjs <file>`. |
| Ben or Nate names a skill the repo does not have | Fetch it ([Ben](product/words.md#2026-11-15-a-skill-i-name-that-is-not-in-the-repo-gets-fetched)): from its public source, or ask for the folder it lives in. Copy it unchanged to `.agents/vendor/<author>/` with its LICENSE and a SOURCE.md, then run it, or wrap it in a skill here that says how it runs in this repo. |
| Make something faster or cheaper | Skill `hillclimb`: poteto's playbook with `log/climb.mjs` as the harness. |
| Before every push | `node .agents/check.mjs` (checks and tests). It must pass. |

The skills live in `.agents/skills/` (Codex) and `.claude/skills/` (a link to the same files). Mark your own suggestions as *agent proposal*, and never move one to Decided yourself. When you see a better way that serves the product and the constitutions, build it rather than wait to ask, and say what you changed (Ben, [06:40](product/words.md#2026-11-15-a-sale-and-a-match-ping-at-once-replies-start-as-drafts-and-agents-build-the-better-way)); taste, direction and scope still go to Ben or Nate, and his edits apply everywhere they touch.

## UI writing

The [UI constitution](product/ui-constitution.md) governs how every UI decision is researched, reasoned and made: extreme intention (every element has a stated reason), start from the person, full action sets, plain words. Any agent generating or editing UI follows [product/copy.md](product/copy.md): minimal in-app writing, show rather than say, Ben's anti-claudish skill applied to every string, familiar patterns from apps people already use, and color and layout spent only where attention should go. This is a decision ([decisions.md](product/decisions.md)), not a style preference. How to build, judge, audit and animate a screen is in [product/frontend-standard.md](product/frontend-standard.md); run `node scripts/copy-lint.mjs` on UI strings.
