# 32 — What Databricks judges rewarded, and nine proposed changes to the data plan

Updated: November 14, 2026. Owner: Ben. Agent: Claude Code (Opus 5.5). Branch: main. Status: research written and freshly reviewed; the changes are agent proposals for Ben and Nate.

## Scope

All Databricks-judged tracks found (13 events; 6 winner repos read) and how Databricks staff build Apps and agents now, tested against [spec/features/data.md](../../../../spec/features/data.md) and the [Databricks decision](../../../../product/decisions.md#2026-11-14-databricks-runs-the-whole-backend-with-a-hybrid-fallback). The note is [research/data/ben/databricks-judging-evidence.md](../../../../research/data/ben/databricks-judging-evidence.md). It extends Nate's [what-databricks-rewards.md](../../../../research/data/nate/what-databricks-rewards.md).

## What other work should take from it

- **The decision stands.** Nothing in it is overturned; the proposals below add to it.
- **Go to the Databricks session.** "Getting Started with Databricks" runs today, 2:00–3:00 PM in B2550. MadHacks posts no Databricks criteria, so someone should attend and write down what the staff say they will judge.
- **Expect judges to test Genie live** (Queens gave 30% to five unseen questions). Proposal:
  - a public market Genie space over `comp`/`product`/rollups, with no user rows, so Open 2 doesn't block it;
  - the pricing agent calls it as a tool;
  - a 30-question verified-SQL benchmark is logged to MLflow.
- **Clearest "beyond the standard" piece:** align an MLflow judge to approve/edit taps and show agreement before and after. No winner read did this. Respect data Open 3: use our own or opted-in taps, or a per-person judge.
- **Vectors, if the workspace is Free Edition:** AI Search embeds text only and there is no Direct Vector Access, so image vectors would go in Lakebase pgvector (*inferred*).
- **Identify:** run extraction as `ai_query` over Volume photos into Delta.
- **Studio and price:** use start-then-poll. Forum reports say App requests are cut at 30–120 s.
- **Agent Bricks:** Knowledge Assistant and Supervisor Agent are legacy since Oct 12. Use code agents in an App.

## Test before building on it

- Is the workspace Free Edition or paid?
- Do Foundation Model APIs answer, and which model takes images?
- Can a deployed App reach Exa, Seedream, OpenAI and eBay?
- Do synced tables and change data feed work?

## Next action

- **Nate:** fold proposals 1–9 into the Databricks explanation you're writing, or reply here with which ones you reject and why.
- **Ben:** attend the 2 PM session or send someone.
