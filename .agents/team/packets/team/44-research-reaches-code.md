# 44: Research reaches the code

Updated: November 15, 2026. Owner: Ben. Agent: Claude Code, project thread "Make agents use our research". Branch: `main`. Status: on `main` and tested. Source: Ben, 01:19 ([words](../../../../product/words.md#2026-11-15-agents-use-the-research-we-did)).

## What changed
- `node scripts/evidence.mjs <slug>...` prints what work on a feature rests on, read from the links the docs already hold: the decisions (they beat the spec), the spec and its determination cards, the research the spec cites with its evidence marks, research filed under the feature that the spec does not cite yet, and the coverage audit's untested or weak choices.
- **Every commit that changes product code now needs a `Rests-on:` trailer**, checked by `node .agents/check.mjs` ([.agents/checks/rests.mjs](../../../checks/rests.mjs)). Name the sources at their anchor: `Rests-on: spec/features/messages.md#who-may-act, spec/sites.mjs#offer.buyer.expires_h`. A .md file with several sections needs a heading; any other file needs a quoted key in it. A feature page does not count; cite what it summarizes. When nothing applies: `Rests-on: none (renames a variable)`. Fix the last commit with `git commit --amend --trailer "Rests-on: ..."`. Only commits not yet on `origin/main` are checked, and only those made after the check reached you (a commit whose tree has no `.agents/checks/rests.mjs` is skipped), so work you committed before pulling this is not blocked.
- `node scripts/evidence.mjs brief <start commit>` writes the prompt for a fresh reviewer of the commits since then: the cited sources, the diff, the proving command (`Proved-by:` trailer), and five questions. The author's reasoning is left out.
- The `build` skill's step 1 starts from the evidence, and its step 6 is cite, then review. AGENTS.md, the `research-note` skill and the plan task shape (`rests:`) point at the same things.
- `node .agents/check.mjs` prints how many research notes the spec or decisions cite (119 of 133 at this push).

## Affected interfaces
- **UI work in `app/src/ui` and screens** counts as product code. Cite the pick's row: `Rests-on: .agents/ui-rules.json#L6`, or a `brand/` file, or a spec line.
- `.agents/checks/links.mjs` now exports `anchors`.

## For Nate's agent
Pull, reread `AGENTS.md` and the `build` skill once. Your next product code commit needs the trailer, or the check fails before the push and in CI. If the rule fires on a commit where citing makes no sense, say so here instead of working around it.

## Decision brief (*agent proposal*; the means are the agent's)
```
Question: how do agents that implement things actually use the research?
Decides: agent (the means), reported to Ben.
Common answer: a longer instruction ("read the research before coding") or a hand-kept index of tasks to notes. Dropped: the poteto-mode review found prose rules here drift and go unread, and a second index restates the links spec/ already holds.
Baseline [observed, one fresh Sonnet agent, 2026-11-15]: asked to plan an offer responder, it read AGENTS.md, the build skill, spec/features/messages.md, two determination cards and sites.mjs, and opened no research note. It missed research/price/ben/pricing-psychology.md (first offers, midpoint counters), which no spec cites, and found three conflicts between spec and decisions with no rule for which wins.
A: a generated evidence list per feature, a commit trailer that a check enforces, and a fresh reviewer briefed with the sources. Rests on the spec already citing 119 of 133 notes [observed]. Wrong if agents fill the trailer with a path they never opened; the reviewer is the check on that.
B: a fact registry for every research number, like spec/sites.mjs. Right where code reads a number, and sites.mjs already does it for marketplaces; the build skill now says such a number lives in spec/. A registry for everything before code exists would be a new layer of docs.
C: a comment in each module linking its sources. Dropped: the build skill keeps comments for what code cannot say, and comments are not checked.
Recommend: A. Strongest rival: B, grown per number as code needs it.
```

## Next action
Whoever writes the first feature code runs `node scripts/evidence.mjs <slug>` first and hands `node scripts/evidence.mjs brief` to a fresh agent before calling it usable. The 14 notes no spec cites are listed per feature by the same script; the feature's spec owner decides whether each changes a row.

Evidence: 6 tests in [.agents/checks/evidence.test.mjs](../../../checks/evidence.test.mjs). Each check was broken on purpose (no trailer accepted, anchors unchecked, feature pages allowed, cards not followed, decisions' back-links ignored, earlier commits held, a none line hiding paths, a whole multi-section file accepted) and a test failed each time. A fresh agent reviewed the change; its findings (nested brackets in a reason, a `none` line hiding a bad path, `#L1` matching `L10`, an empty brief once pushed, blocking teammates' earlier commits) are fixed, each with a test. Not caught: a trailer that names a real but wrong source, and merge commits. Those are the reviewer's job.
