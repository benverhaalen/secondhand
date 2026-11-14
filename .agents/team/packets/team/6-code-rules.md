# 6: Code rules from Ben's harness

Updated: November 14, 2026. Owner: Ben. Agent: Claude Code, project thread "Set up logging of everything". Branch: `main`. Status: the skill and the check are on `main` and tested; no app, server or job code exists yet, so the check has nothing to flag today. Source: Ben, 23:01 ([words](../../../../product/words.md#2026-11-14-code-rules-from-the-harness)).

## What changed
- New skill `build` ([.agents/skills/build/SKILL.md](../../../skills/build/SKILL.md)): what to do before and while writing code that runs. Done and its proving command first, find before you write, shape, test first, log, clean the diff, say which state the work is in.
- New check [.agents/checks/code.mjs](../../../checks/code.mjs), run by `node .agents/check.mjs`. It fails on a file or folder named `utils`, `helpers`, `misc` or `common`; on `as any`, `: any`, `@ts-ignore`, `@ts-nocheck`, a blanket `eslint-disable` and a bare `# type: ignore`; on an empty `catch` or `except: pass`; on conversation history in a comment; and on `.skip`, `.only`, `xit` or `@pytest.mark.skip` in a test. It warns on a file over 400 lines and on product code that changed with no test.
- The [AGENTS.md](../../../../AGENTS.md) row for code that runs now names the skill.

## Affected interfaces
- Every program: the app, the server, cloud jobs, agent loops and site harnesses. Tooling, research prototypes and `scripts/` are exempt, the same as for the logging check.
- `.agents/checks/util.mjs` now owns what counts as product code and as a test. The logging check uses it too, so Python and Swift test files may print.

## For Nate's agent
Pull, reread `AGENTS.md` once, and read the `build` skill before the first code. The check's messages say how to fix each failure. If a rule fires on good code, say so in this packet instead of working around it.

## Decision brief (*agent proposal*; the means are the agent's, the ask is Ben's)
```
Question: how do Ben's code rules reach the code Nate's agent writes?
Decides: agent.
Common answer: paste the rules into AGENTS.md. Dropped: the poteto-mode review found that rules held as prose here drift and go unread, and Ben's harness says an always-loaded file holds only what is unusual.
A: a short skill for the rules that need judgment, plus a check with tests for the rules a script can find. Rests on AGENTS.md already routing corrections to checks [observed] and on the review's finding 5 that checks must be shown failing [observed]. Wrong if the check fires on good code often enough that agents learn to skip it.
B: copy the harness skills and their step and done-gate commands. Wrong here: Nate's setup does not have those commands [inferred], and the playbooks are several times longer than every rule this repo needs.
C: a linter config (ESLint, Ruff, SwiftLint) per program. Right later, once a program has a package to hold it; today there is none.
Recommend: A. Strongest rival: C, added per program when its first code lands, with code.mjs kept for the rules that cross languages.
```

## Next action
Whoever writes the first code of a program adds its test command to `.agents/check.mjs`, so one command still runs every check.

Evidence: `node .agents/check.mjs` passes with 12 check tests. Each rule was shown failing on a planted sample and passing on the fixed one, and removing a rule from the check made its test fail.
