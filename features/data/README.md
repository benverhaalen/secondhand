# Databricks

Status: idea. Owner: unassigned. Packet topic: `data`.

Spec (agent proposal): [spec/features/data.md](../../spec/features/data.md).

## What and why
Databricks as the backbone (item data, price history, evaluations, model serving), used creatively where that is warranted. Ben: [words](../../product/words.md#2026-11-14-tools-and-capture).

Judging: Databricks judges on how well and how creatively the platform is used. There are no set criteria. Ben: [words](../../product/words.md#2026-11-14-databricks-judging).

## How it works
Not designed yet, except the event log. Keep the mechanism here once research picks one, together with the reference it came from and the job that reference does.

**The event log** (*agent proposal*; a means, so the agent chose it). Every program writes one kind of JSON line through [log/](../../log/README.md), against one contract in [spec/events.json](../../spec/events.json). One `events` table then serves the "why?" timeline, undo, the approvals that train the tiers, and debugging. Ben's ask: [words](../../product/words.md#2026-11-14-logging-of-everything).

```
Question: how does every part of secondhand log what it does?
Decides: agent. The rule itself is from Ben's harness (log/README.md).
Common answer: a logging library in each runtime plus a hosted tracing tool, with free-text messages. Dropped: free text can't be replayed or checked against spec/lifecycle.mjs, and each runtime would name things its own way.
A: one contract, a thin writer per runtime, a checker in the repo check, the MLflow trace id on each line. Rests on spec/replay.mjs already reading JSON lines [observed]. Wrong if two writers must share one session, or if a line costs too much to write on the phone.
B: MLflow traces only. Rests on MLflow tracing every agent step [observed, research/data/ben/databricks.md]. Wrong here: taps, screens and approvals in the app are not spans, and a log has to work with no Databricks connection.
C: OpenTelemetry in every program, sent to Unity Catalog tables [observed as an Apps feature, same note]. Wrong for a 24 hour build: three SDKs to set up, and our event names are still needed on top.
Recommend: A. Strongest rival: C, later, as one more sink behind the same writers.
```

## Decided
Nothing yet. Each entry here links to [decisions.md](../../product/decisions.md).

## Open
- Which parts of the pipeline should run on Databricks, and which on the device?

## Research
All research for this feature: [research/data/](../../research/data/)
- Ben: [research/data/ben/](../../research/data/ben/)
- Nate: [research/data/nate/](../../research/data/nate/)
- Nate: [analytics-and-recommendations.md](../../research/data/nate/analytics-and-recommendations.md). Which demand and performance signals exist, what an app may honestly claim from them, and how a seller's own listings should drive recommendations.
- Nate: [databricks-dev-tooling.md](../../research/data/nate/databricks-dev-tooling.md). Three layers of tools for building and testing on Databricks: plain pytest locally, Postgres stand-in for Lakebase, then pytester and bundles on the workspace.
- Nate: [databricks-platform.md](../../research/data/nate/databricks-platform.md). What Lakebase, Apps, Agent Bricks, AI Search, MLflow 3 and others provide, with limits, for a consumer app backend; Free Edition limits listed.
- Nate: [market-intelligence.md](../../research/data/nate/market-intelligence.md). How price-history and trend products get their data, and what an app could honestly offer someone who neither sells nor buys.
- Nate: [what-databricks-rewards.md](../../research/data/nate/what-databricks-rewards.md). What Databricks holds up as excellent use and what judged hackathon entries were rewarded for, including citations and uncertainty as a scored criterion.
- Ben, tech stack: [databricks.md](../../research/data/ben/databricks.md). Databricks as system of record and glass box: MLflow traces become the "why?" panel, approvals become labels that tune thresholds.
- Ben, harness from repos: [ai-harness-from-repos.md](../../research/cross-cutting/ben/ai-harness-from-repos.md#7-learning-from-taps). *Agent proposal:* rules are promoted by arithmetic over tap rows with a decline cap and a fade, and a nightly job replays the taps as an eval (Midday, Actual).
