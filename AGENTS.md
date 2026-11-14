# Instructions for agents

## Active team handoffs

Keep building the current task while staying current with relevant team changes. Read [.agents/coordination.md](.agents/coordination.md) once when starting or resuming substantial work; it routes to bounded handoffs in `.agents/team/`. At natural work boundaries, check relevant team notes roughly every few minutes and before shared-interface changes or integration; there are no automatic hooks. Read only relevant packets, apply or hand off useful changes, and ask the affected humans directly about conflicting opinions. Preserve original quotes and provenance; do not export private conversations or load the whole history. No waiting loops, automatic merges, or mandatory helper launches.

## Git

Follow the [git rules](.agents/coordination.md#git-rules): pull often and report conflicts, one branch per workstream (helpers do not make their own), small commits of explicit paths, push often, merge finished work to `main` continuously, never auto-reset/stash/rebase a shared or dirty checkout, never commit secrets or personal data, and commit/push only what your human authorized.
