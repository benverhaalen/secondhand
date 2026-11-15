# secondhand on Databricks' retail solutions

For the judges, 2026-11-15. Nate asked us to "see how we can utilize these, or build our engines and features on top" of [Databricks' retail solutions](https://www.databricks.com/solutions/industries/retail-industry-solutions) "to show we truly extend databricks" ([words](../product/words.md)). The full mapping, with every accelerator's licence and cost, is [research/data/nate/databricks-retail-solutions.md](../research/data/nate/databricks-retail-solutions.md).

The **Live** column says only what was read back on the workspace ([WORKS.md](WORKS.md), 12:45 to 12:52 UTC today) or what runs in the served product today. Everything else is marked built (in the repo, not yet on the workspace) or not built.

| Their retail solution | What we use of it | What resale adds | Live |
|---|---|---|---|
| Open Retail Data Model (Apache-2.0) | Its entity names, product and sales, as views over our tables ([16_retail.sql](sql/16_retail.sql)) | A condition on every item, one-of-one sales (units 1), the marketplace as the store, and the rights on every row (`may_model`, `may_show`, `use_scope`) | Not yet: drafted, runs after judging |
| Real-time analytics: Auto Loader and a declarative pipeline | The market pipeline, bronze to silver with expectations, over frozen public sold datasets | A rights row per source in `governance.source_rights`; one view, `market.comp_for_model`, a fit may read | Yes: pipeline `secondhand-market` COMPLETED; "Where the sales come from" returns 6 sources |
| Unity Catalog governance | Row filters, column masks, tags, lineage | Every core table locked to its owner; buyer and seller handles masked; an audited break-glass window for maintenance; a guard that counts rule breaks at the write door | Yes: 11 core tables locked, `guard_status` 0 violations at 10:49 UTC |
| Metric views and AI/BI dashboards | `measures.valuation_metrics` and the "secondhand: proof" dashboard | Every figure with its count and dataset; the served engine and the nightly market model named apart | Yes: 12 of 12 datasets return rows |
| Genie | The "secondhand market" space over the governed views | Answers that start with the dataset and the count, and refuse below a minimum ("too few: N sales") | Yes: 8 of 8 judge questions COMPLETED |
| Dynamic pricing (the page names it; no pricing accelerator exists) | Their shape: a target sales curve adjusted by named signals, with a person deciding | Ours prices the item, never the person looking: a range from comparable sales across marketplaces, what the seller keeps after fees, and the person approves every price | History: yes, sold comps weighted by age, the last sale shown beside the range. Timing: only as that age decay. Demand, competition, customer sensitivity, season, digital behaviour: not read by a served valuation yet. The target curve: not yet (below) |
| Demand forecasting (Many Models, `ai_forecast`) | The sale curve: the chance of sale by day, fitted on eBay Best Offer listings with censoring, exported as param rows the server reads on a timer | One-of-one items, so the curve is by kind and marketplace, not by SKU | Not yet: the export is in build (DB4); an `ai_forecast` view is drafted in [16_retail.sql](sql/16_retail.sql) |
| Agentic commerce (a supervisor over Genie and Unity Catalog functions) | Governed SQL functions the buying conversation calls: asks, term trends, top terms, sell-through, coverage | Every answer carries its count and as-of, and no figure under the minimum count | Built (`sql/15_market.sql`); not on the workspace until after judging |
| Fuzzy item matching | The pattern, for the same product across five marketplaces | Noisy resale titles and one-of-one items | Not built (row DB10) |
| Lakebase, Delta Sharing | Not used | | Not used: both are Nate's call (Lakebase is billed by the hour; a share is public) |

## How to read the pricing row

Databricks frames dynamic pricing as a target sales curve moved by signals: history, timing, demand, competition, customer sensitivity, season and digital behaviour. Today a served price rests on recent sold history across sites. The loop that would move it when demand, competition or sensitivity move is the work in progress (rows EN2 and EN3, and DB4 for the curve). We say so rather than claim it.

## What runs where

The workspace holds the governed history, the proof and the fits. The server never queries the warehouse while a person waits: fitted values reach it as a file on a timer (DB4), and what it reads from public pages lands back in a volume as JSON lines (DB3), loaded by one job.
