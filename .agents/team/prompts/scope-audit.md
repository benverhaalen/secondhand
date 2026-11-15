# Scope audit: what is planned, what is built, what is left

Brief for four Codex runs on Ben's Mac, one per lane (the lane is named at the end of the prompt). Written by Claude for Ben's ask on 2026-11-15 at 10:34 Central: "go through every feature we had planned and the specifics about each one as we said and seeing if it was done or sorta done or not done and creating a list of essentially what we have left to do in scope".

## Goal

For every feature in your lane, list each specific thing Ben or Nate planned for it, mark it **done**, **partial** or **not done** with evidence, and say what is left to build. The list is read by Ben, Nate and the agents choosing the next piece of work, so it must be true to the repo as it stands, not to what the spec hopes.

## Inputs, in this order

1. `AGENTS.md`, `product/vision.md`, `.agents/thinking.md`.
2. For each slug in your lane: `node scripts/evidence.mjs <slug>` (what the decisions and spec settle), then `features/<slug>/README.md`, `spec/features/<slug>.md`, and the decisions it lists in `product/decisions.md`.
3. What Ben and Nate said: `grep -n -i '<slug or feature words>' product/words.md`, then read the matching entries in full. A quote is the most specific statement of what was planned; quote it short and link its anchor.
4. The page map `spec/pages.md`, the page jobs `features/app/page-jobs.md`, the build board `spec/plans/finalization.md#13-what-works-kept-by-the-orchestrator` and the joins `spec/plans/joins.md`. A board row ticked with a commit id is strong evidence; an unticked row is a plan, not evidence.
5. The code: screens in `app/src/app/` and `app/src/{today,sell,buy,item,you}/`, engines in `app/src/engines/`, server and outside calls in `app/src/edge/`, jobs in `jobs/` and `databricks/`, the data model in `db/`. Tests sit next to the code (`*.test.ts`, `*.test.mjs`, `test_*.py`).
6. Phone evidence: `features/app/native/` (`*.png` captures and `*.tree.txt` view trees from the real phone build) and `features/app/renders/`. A capture shows a screen exists and what it shows; it does not show where its data comes from.

## How to mark each specific

| Mark | Needs |
|---|---|
| done | code that does it, and a test that exercises it or a phone capture that shows it, and real inputs (an engine, an API route, a stored record) behind what the screen shows |
| partial | some of the above but not all: code without a test, a screen fed by `app/src/demo/` or a fixture where the plan says live data, an engine with no screen, a route that returns a stub, a write verb proved only dry |
| not done | spec, decision or quote only; nothing in code |
| out of scope | a decision, a quote or `ideas/` says it waits; cite the line |

Every mark carries its evidence as a path, with a line number where one line settles it (`app/src/engines/price/plan.ts:42`, `app/src/engines/price/plan.test.ts`, `features/app/native/tabs-sell.png`). If you could not find evidence either way, write "not found" and the searches you ran; do not guess a mark. You may run one test file at a time to confirm a "done" (`node --test --test-concurrency=1 <file>`, `./.venv/bin/python -m pytest <file> -q`); record the result. Do not run `.agents/check.mjs`, a server, a browser or anything that needs the network.

**Wiring gaps** get their own line under each feature: a screen or block whose data does not yet come from the engine or route the spec names. Name the screen file, what it reads now (fixture path or hard-coded value), and the route or engine it should read (`spec/product.md` names). The UI thread has five Codex runs on this Mac writing per-page wiring gaps for the page families (tabs, object pages, sheets, lists, camera and onboarding). Before writing a wiring gap, look for their output: `git -C /Users/benverhaalen/secondhand status --short` and `find /Users/benverhaalen/secondhand /Users/benverhaalen/secondhand-wt -newer /Users/benverhaalen/secondhand/AGENTS.md -name '*.md' -path '*spec*' 2>/dev/null` and any file whose name has "wiring", "redesign" or "family". If a matching gap is already written there, cite that file instead of rewriting it.

## Size of what is left

Give each "left" item a size and the reason it is that size, never a time:

- **S**: one file and its test, inside one layer, with the names and inputs already settled.
- **M**: several files in one layer, or one join between two layers that both exist.
- **L**: crosses screen, route and engine, or needs an outside service, a key, a real account or a choice not yet made.

If an item cannot start until something else is done or decided, say what, and who decides (Ben for taste, direction and scope; Nate for data, jobs, pricing and Databricks).

## Output

Write one file: `spec/plans/scope/<lane letter, lowercase>.md`. Nothing else is created or changed. Shape:

```
# Lane <X>: <features>

Checked against main at <commit id from `git rev-parse --short HEAD`>, <date and time>.

## <slug>: <one-line feature name from product/features.md>

<one or two sentences: what the feature is for the person, and its overall state>

| Planned specific | Source | Mark | Evidence | Left to do | Size and why |
|---|---|---|---|---|---|

Wiring gaps: <list, or "none found" with what you checked>
Backend, data or Databricks items for Nate: <list, or "none">
```

End the file with a section `## Lane totals` (count of done, partial, not done, out of scope per feature) and `## Read but not placed`: any planned specific you found that fits none of your lane's features, with its source, so the merge can place it.

## Writing

Plain sentences a person skims. Short rows. No hedging words, no "robust", "seamless", "leverage", "comprehensive", no em dashes, no arrows in prose. Run `python3 -I .agents/skills/writing/scripts/lint.py --surface prose spec/plans/scope/<lane>.md` and fix what it flags before you stop. Never invent a number, a quote or a file.

## Lanes

| Lane | Features (slugs) | Also covers |
|---|---|---|
| A | capture, measure, identify, studio, item-card, list, replay, sold | the camera and the Item page's draft and live states |
| B | price, appraise, score, insights, market, data | the You tab's numbers, the Databricks jobs and dashboards, the backtest |
| C | today, connect, buy, watch, messages, assist | onboarding, notifications, the chat icon and threads, search |
| D | app | every page in `spec/pages.md` §2 (the map) and the website: for each page, does it exist, which features feed it, is each block wired to live data. Reuse the UI thread's per-page output first; add only what it lacks. Also every Ben or Nate quote in `product/words.md` from 2026-11-14 and 2026-11-15 that asks for something to be built and is not owned by one feature slug |

## How to work

- Read only; the one file you write is your lane's output. Do not commit; the session that started you commits.
- No secret, token or personal data in the file. Do not open `.env` files.
- When you are done, the last line of your output file is `End of lane <X>.`
