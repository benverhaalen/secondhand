# The workspace works: a read-only check before judging

Checked 2026-11-15, 12:45 to 12:52 UTC, by the Databricks lead, on Nate's word "focus on ensuring databricks works" ([words](../product/words.md)). Nothing was deployed and no job was run. The warehouse was started only by the queries below and stopped by hand at 12:52 UTC. Every line is *observed*, with the command that showed it. Commands use `--profile Nate`; hosts and workspace ids are left out of this page.

## The bundle

- *Observed:* `node deploy/deploy.mjs validate --target dev --profile Nate` prints "Validation OK!" for bundle `secondhand`, target `dev`.

## Every resource exists, and its last state

`databricks jobs list`, then `databricks jobs list-runs --job-id <id> --limit 1` for each job:

| Job | Schedule | Last run (UTC) | Result |
|---|---|---|---|
| secondhand-setup | none | 10:46 | SUCCESS |
| secondhand-measures-setup | none | 09:06 | SUCCESS |
| secondhand-learning-setup | none | 09:18 | SUCCESS |
| secondhand-param-walk | none | 09:39 | SUCCESS |
| secondhand-valuation-backtest | none | 09:44 | SUCCESS |
| secondhand-recompute | none | 09:56 | SUCCESS |
| secondhand-erasure-setup | none | 10:36 | SUCCESS |
| secondhand-parity | none | 10:40 | SUCCESS |
| secondhand-load-logs | none | 10:43 | SUCCESS |
| secondhand-governance-setup | none | 10:48 | SUCCESS |
| secondhand-bench-setup | none | 10:52 | SUCCESS |
| secondhand-load-bench | none | 10:53 | SUCCESS |
| secondhand-vacuum-core | 4 AM Central, unpaused | never ran yet | first run tomorrow 4 AM Central |
| secondhand-nightly-fits | 2 AM Central, **paused** | never ran | paused on purpose (DB8) |
| secondhand-market-refresh | none | never ran | the pipeline was updated directly |
| secondhand-purge-user | none | never ran | runs only on an account deletion |

- *Observed:* `databricks pipelines list-pipelines`: `secondhand-market` IDLE, last update COMPLETED at 08:49 UTC.
- *Observed:* `databricks alerts-v2 list-alerts`: "secondhand guard violations" ACTIVE, `0 0 * * * ?` (hourly, as Nate ruled until judging), UNPAUSED, last evaluated OK at 12:00 UTC.
- *Observed:* `databricks lakeview list`: "secondhand: proof" ACTIVE (and an older "review draft").
- *Observed:* `databricks genie list-spaces`: "secondhand market" is there.
- *Observed:* `databricks warehouses list`: "Serverless Starter Warehouse", Small, auto-stop 10 minutes, STOPPED before and after this check.

## The guard

- *Observed:* `SELECT * FROM secondhand.measures.guard_status`: violations_now 0, refusals_last_7_days 0, last_checked_at 10:49:53 UTC, 18 rules.

## The dashboard's datasets return rows

Each dataset of `databricks/dashboards/proof.lvdash.json` run once with its own catalog and schema through the Statements API (`POST /api/2.0/sql/statements`):

| Dataset | Rows |
|---|---|
| The sales behind one price | 59 |
| Every headline figure with its count | 19 |
| Price accuracy by sale price, from the metric view | 9 |
| Ranges that held the sale, from the metric view | 3 |
| Prices held back, by reason | 4 |
| Price accuracy by week, from the metric view | 48 |
| The half-life in force each month | 15 |
| Each change and its evidence | 1 |
| Rule check across every owner | 1 |
| Locks in force | 11 |
| Actions never taken alone | 4 |
| Where the sales come from | 6 |

None is empty. `measures.bench_by_site` and `bench_cost` are not on this dashboard; they stay empty until a benchmark run with per-read fields lands (DB7).

- *Observed:* `SELECT metric, count(*) FROM secondhand.measures.recompute_check WHERE NOT equal GROUP BY metric`: `asking_p50_cents` 5 and `sold_p50_cents` 1. These are the six of 42,405 numbers that do not rebuild exactly (DB7).

## Genie

- *Observed:* `node databricks/genie/ask.mjs` (12:49 to 12:51 UTC): all eight judge questions COMPLETED; the answers and their SQL are in [genie-answers.md](genie-answers.md). Question 2 now gives the 90-day median's own rate (89.1%). It still says "within 20 percent of the last sale" where it means within 20 percent of the sale price, and leaves out the market model's figure. The summary rows built for DB7 (7bb5ccc7) fix both once they are deployed after judging.

## What it spent

The warehouse ran from about 12:47 to 12:52 UTC (dashboard datasets, the two checks, the eight Genie questions). By the 11:00 UTC measurement in [packet 71](../.agents/team/packets/team/71-databricks-handoff.md), a wake of this Small warehouse costs 0.9 to 2.2 DBU at $0.70, so about $0.60 to $1.54. The billed figure is read from `system.billing.usage` after judging, when the billing rows have landed.

## Broken in a way a judge would see

Nothing found. The two Genie phrasing faults above are the closest; their fix needs a deploy, so it waits for 19:00 UTC.
