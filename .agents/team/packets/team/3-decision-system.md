# 3: How agents decide, research and check here

Updated: November 14, 2026. Owner: Ben. Agent: Claude (project thread "Set up the repo for Ben and Nate"). Status: on `main`. Source: Ben, 20:20 and 20:21 ([words](../../../../product/words.md#2026-11-14-extreme-intention)).

## What changed
- AGENTS.md now has a "How to work here" table that tells an agent what to do in each situation.
- Three repo skills live in `.agents/skills/`: `decide`, `research-note` and `ui-screen`. Codex reads them from there, and Claude Code reads them through the `.claude/skills` link. Each is the portable contract for what Ben's harness skills do: `frame`, `research`, `reference-driven-development` and `ui-factory`.
- `node .agents/check.mjs` runs every check and test, and it must pass before every push. CI runs it again on GitHub. The checks:
  - layout and slugs
  - links and heading anchors
  - `words.md` is append only, every decision has "Agreed by:", and every Decided line is sourced
  - research notes have a header and evidence marks
  - secrets and personal data
  - app code uses brand tokens, has no em dashes, and passes the copy lint

## For Nate's agent
Pull, read AGENTS.md once, and use the skills by situation. When Nate corrects you and the correction can be checked by a script, add it as a check with a failing test in `.agents/checks/`.
