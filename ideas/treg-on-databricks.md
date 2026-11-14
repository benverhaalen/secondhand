# Treg rebuilt on Databricks

Nate's idea, as Ben put it at 23:06: "nate is thinking of doing a sort of refactoring treg into databricks platform. that if we get to it would be so cool but we need the product first before we optimize yk." ([words](../product/words.md#2026-11-14-ideas-board-and-treg-on-databricks-after-the-product)). Nate's own words point the same way: "Look at https://treg.to/" ([words](../product/words.md#2026-11-14-nate-verify-the-gap-outperform-departments)) and "Developing a feature for our app, and making it a thing for databricks" ([words](../product/words.md#2026-11-14-nate-provable-and-features-for-databricks)).

**Waits on:** price and watch working through Treg.

## What it is

Treg is one key for thousands of tool and data endpoints, paid per call ([openrouter-and-treg.md](../research/price/ben/openrouter-and-treg.md#treg)). The idea is to build that on Databricks.

*Agent reading, for Nate to correct:* each data source we call (sold comps, Google Lens, page scrapes) becomes a function in Unity Catalog behind one gateway, the way Unity Gateway already fronts the model calls ([decision](../product/decisions.md#2026-11-14-databricks-runs-the-whole-backend-with-a-hybrid-fallback)). Every call, its cost and its result land in a Delta table, so any price can be traced back to the calls behind it.

## First step

Ask Nate what he means by it. Then list the Treg calls the product really makes once price and watch work; those are the first functions to move.
