# 54: pitch claims that need Nate's workspace, and what not to say yet

Updated: November 15, 2026, 07:20 UTC. Owner: Ben. Agent: Claude Code, project thread "Prepare the pitch, Q&A and video". Branch: `claude/project-thread-8q3co1` (draft PR #8), base `main`. Status: docs pushed, nothing to build unless Nate wants the live reads scripted. *Agent proposal*.

Ben asked that Nate get the packets he needs ([words](../../../../product/words.md#2026-11-15-ensure-the-repo-has-everything-and-nate-gets-his-packets)). The pitch now makes claims about the Databricks side. These are the ones only Nate's workspace can make true, and the ones we've told the team not to say.

## What the pitch says about Databricks, and its status

From [showcase.md §2](../../../../product/showcase.md#2-how-we-use-databricks), checked against [workspace checks](../../../../research/data/nate/workspace-checks.md) and the bundle:

| Claim | Status the pitch uses |
|---|---|
| The bundle deploys the schema, two volumes, the secret scope, the nightly fits job and the purge job | built (`deploy/databricks.yml`) |
| Lakebase holds live state | a probe project was created 2026-11-14 (observed); say no more until the app runs on it |
| Databricks Apps hosts the backend behind a thin public edge | a probe app was created (observed) |
| Every model call goes through the gateway | open models only answered (gpt-oss-120b in 750 ms); Claude models weren't on the workspace |
| MLflow traces as the Why? screen; Genie over market tables; citations on every number | designed |
| Agent Bricks | not available on the workspace (observed); our own loop instead |
| Marketplace sign-ins live in the `vault` secret scope, readable only by the sign-in job; models never see them | built in code (`app/src/edge/browser/auth.ts`, `app/src/edge/connect/password.ts`); the scope was created by T0-1 |

## What Nate could make true before judging (each is optional)

1. **The live read at the table** ([numbers, for the Databricks judges](../../../../product/numbers.md#for-the-databricks-judges)): how many comps the `comp` table holds, from how many sites, the newest one's age; how many MLflow traces the demo wrote, with one opened. A one-command script that prints those three lines would let anyone at the table run it.
2. **One price recomputed from its citation, on stage.** Only if the citation path is built; otherwise the pitch says "designed".
3. **Confirm the secret scope's ACL**: only the sign-in job's identity can read `password/*` keys. The pitch claims it; the code enforces it in our process; the workspace ACL is what a Databricks judge would ask about.

## What we've told the team not to say

- "Runs on Databricks" for any piece that isn't deployed: say "built as a bundle; here is what is deployed".
- A count of rows, traces or comps that wasn't read live that day.
- "No third party sees your credentials": the cloud browser host runs the session. Say "the AI models never see your credentials".
- Ben's personal Depop in any demo (Ben, 05:54).

## Where the pitch material lives

All in `product/` on the branch above: [pitch-constitution.md](../../../../product/pitch-constitution.md) (how it's told), [pitch.md](../../../../product/pitch.md), [showcase.md](../../../../product/showcase.md), [unique.md](../../../../product/unique.md), [theme.md](../../../../product/theme.md), [qa.md](../../../../product/qa.md), [demo-reel.md](../../../../product/demo-reel.md), [devpost.md](../../../../product/devpost.md), [business.md](../../../../product/business.md), [faq.md](../../../../product/faq.md), [pitch-video.md](../../../../product/pitch-video.md).

## Next action

Nate: tell the pitch thread (or Ben) which of 1 to 3 you'll do, so the talk track says "live" or "designed" correctly.
