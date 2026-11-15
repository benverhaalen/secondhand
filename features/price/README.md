# Price and route

Status: idea. Owner: unassigned. Packet topic: `price`.

Spec (agent proposal): [spec/features/price.md](../../spec/features/price.md).

## What and why
Decide where to sell, at what price, and whether to ship or meet locally, with a slider that trades speed against price. *Agent proposal* from the concept brief.

## How it works
Not designed yet. Keep the mechanism here once research picks one, together with the reference it came from and the job that reference does.

## Decided
Nothing yet. Each entry here links to [decisions.md](../../product/decisions.md).

## Open
- Share-sheet deal check: show a typical sold-price band, with a "can't tell" state. It shares this feature's engine with [appraise](../appraise/).
- What price data can we legally get for each platform?

## Research
All research for this feature: [research/price/](../../research/price/)
- Ben: [research/price/ben/](../../research/price/ben/)
- Nate: [research/price/nate/](../../research/price/nate/)
- Nate: [fees-and-taxes.md](../../research/price/nate/fees-and-taxes.md). What a US casual seller keeps and owes on the five marketplaces: fee tables per site plus tax and 1099-K points.
- Nate: [quality-and-value-classifiers.md](../../research/price/nate/quality-and-value-classifiers.md). Published ranking models: price against similar sold items predicts sale best; photo quality helps only slightly; no evidence TikTok scores attractiveness.
- Nate: [range-calibration.md](../../research/price/nate/range-calibration.md). How to calibrate and backtest a price range and days-to-sell from sold comps; conformal methods give marginal coverage, per-category needs group methods.
- *Agent proposal:* value is a range per channel with days to sell, built from a few adjusted sold comps that are shown, with an abstain rule; sold-data access, not the model, is the constraint. [valuation-engine.md](../../research/price/ben/valuation-engine.md)
- *Agent proposal:* price like an illiquid asset: label each estimate Level 1/2/3, size the speed-vs-price slider from the item's liquidity (the bid–ask spread), and get days to sell from its queue position among competing listings. [pricing-in-context.md](../../research/price/ben/pricing-in-context.md)
- *Agent proposal:* the build plan for pricing, search and watch: one engine and three endpoints, sold comps from several paid scrapers run at once, ranges with an abstain rule, the human checkpoints, and Exa kept for the long tail after a live test. [build-plan.md](../../research/price/ben/build-plan.md), [comps-sources-live.md](../../research/price/ben/comps-sources-live.md)
- *Agent proposal:* OpenRouter can serve every model call (Decisions, label reading, Seedream) on one key, and Treg about half the data calls (Google Lens, eBay search and detail, scraping, page monitors); sold data and Facebook still need their own keys. Not yet called. [openrouter-and-treg.md](../../research/price/ben/openrouter-and-treg.md). Rebuilding Treg on Databricks is for later: [ideas board](../../ideas/treg-on-databricks.md).
- *Agent proposal:* default offer settings per site from the floor and always-accept lines, and how each site's price drop works: [levers-and-signals.md §6](../../research/list/ben/levers-and-signals.md#6-design-agent-proposal), arithmetic in [levers/defaults.mjs](../../research/list/ben/levers/defaults.mjs).
- Ben: [pricing-psychology.md](../../research/price/ben/pricing-psychology.md). eBay first offers average 61% of list, midpoint counters are accepted more, slow replies lose sales; this backs money D16's midpoint counter; *agent proposal:* answer within minutes, struck-through prices only after 7 days live.
