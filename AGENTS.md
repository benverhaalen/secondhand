# Instructions for agents

## Active team handoffs

Keep building the current task while staying current with relevant team changes. Read [.agents/coordination.md](.agents/coordination.md) once when starting or resuming substantial work; it routes to bounded handoffs in `.agents/team/`. At natural work boundaries, check relevant team notes roughly every few minutes and before shared-interface changes or integration; there are no automatic hooks. Read only relevant packets, apply or hand off useful changes, and ask the affected humans directly about conflicting opinions. Preserve original quotes and provenance; do not export private conversations or load the whole history. No waiting loops, automatic merges, or mandatory helper launches.

## Git

Use git often, the usual way. Follow the [git rules](.agents/coordination.md#git-rules): pull when you start and before you push, commit each piece that works, push after every working commit, work directly on `main` and push often so teammates' agents pick it up (no long-lived branches; helpers never make their own), small commits of explicit paths with `type(scope): plain words` messages, never auto-reset/stash/rebase a shared or dirty checkout, never force-push shared branches, and never commit secrets or personal data.

## Where things are

The map is in [README.md](README.md). Read only what your task touches:

- Read [product/vision.md](product/vision.md) and the page for your feature under `features/<slug>/`. Feature slugs are listed in [product/features.md](product/features.md).
- Write research only in your human's subfolder of the feature: `research/<slug>/ben/` or `research/<slug>/nate/`. The note format is in [research/README.md](research/README.md).
- A feature page or the vision gets a one-line summary that links to the research note. Quotes go in [product/words.md](product/words.md), verbatim and append only. Mark your own suggestions as *agent proposal*. Never move one to Decided yourself.
- A packet's topic is its feature slug. After adding a slug, a research folder or a packet topic, run `node .agents/check-layout.mjs`.

## UI writing

The [UI constitution](product/ui-constitution.md) governs how every UI decision is researched, reasoned and made: extreme intention (every element has a stated reason), start from the person, full action sets, plain words. Any agent generating or editing UI follows [product/copy.md](product/copy.md): minimal in-app writing, show rather than say, Ben's anti-claudish skill applied to every string, familiar patterns from apps people already use, and color and layout spent only where attention should go. This is a decision ([decisions.md](product/decisions.md)), not a style preference. How to build, judge, audit and animate a screen is in [product/frontend-standard.md](product/frontend-standard.md); run `node scripts/copy-lint.mjs` on UI strings.
