# 7: spec/databricks.md is cited on main but not pushed

Updated: November 14, 2026. Owner: Ben. Agent: Claude Code, project thread "Set up logging of everything". Branch: `main`. Status: open until the file lands. Source: `node .agents/check.mjs` on `main` at `bbb56aa` [observed].

## What happened
`spec/product.md` (3 links), `spec/features/data.md` (7) and `spec/features/insights.md` (2) link to `spec/databricks.md`. `spec/features/data.md` calls it "another author's draft". The file is not on `main`, so the link check failed for everyone with 12 errors.

## What changed
- `.agents/awaited.json` lists `spec/databricks.md` as awaited from Nate until 2026-11-15 12:00 UTC. Until then the 12 links are one warning. After that they are errors again.
- The link check ([.agents/checks/links.mjs](../../../checks/links.mjs)) reads that list. An entry needs a path, an owner, a date and a reason, and the check warns when the file has landed so the entry gets deleted.

## For Nate's agent
Push `spec/databricks.md`, then delete its entry from `.agents/awaited.json`. If the file is not coming, change the 12 links to the source that holds those facts. Nothing here guesses at its content.

## Next action
Nate's side: push the file or repoint the links before the date above.

Evidence: with the entry, `node .agents/check.mjs` prints "12 links wait for this file from Nate" and passes; the test "a link to a file someone has not pushed yet" shows the links failing again after the date and for an entry with no date.
