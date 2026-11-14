# Instructions for agents

## Active team handoffs

Keep building the current task while staying current with relevant team changes. Read [.agents/coordination.md](.agents/coordination.md) once when starting or resuming substantial work; it routes to bounded handoffs in `.agents/team/`. At natural work boundaries, check relevant team notes roughly every few minutes and before shared-interface changes or integration; there are no automatic hooks. Read only relevant packets, apply or hand off useful changes, and ask the affected humans directly about conflicting opinions. Preserve original quotes and provenance; do not export private conversations or load the whole history. No waiting loops, automatic merges, or mandatory helper launches.

## Git

Use git often, the usual way. Follow the [git rules](.agents/coordination.md#git-rules): pull when you start and before you push, commit each piece that works, push after every working commit, one `type/short-name` branch per workstream (helpers do not make their own), small commits of explicit paths with `type(scope): plain words` messages, merge finished work to `main` through a PR, never auto-reset/stash/rebase a shared or dirty checkout, never force-push shared branches, and never commit secrets or personal data.
