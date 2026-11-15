# Price and route

Status: idea. Owner: unassigned. Packet topic: `price`.

Spec (agent proposal): [spec/features/price.md](../../spec/features/price.md).

## What and why
Decide where to sell, at what price, and whether to ship or meet locally, with a slider that trades speed against price. *Agent proposal* from the concept brief.

## How it works
Not designed yet. Keep the mechanism here once research picks one, together with the reference it came from and the job that reference does.

## Decided
Nothing yet. Each entry here links to [decisions.md](../../product/decisions.md).

## Built (agent proposal, not yet decided)
- **Market model** in `jobs/valuation/market.py`, fitted on sold rows only (live asks only cap the range and measure liquidity). A hedonic ridge regression on log price gives each attribute's premium and the time trend, each with a 90% interval. Category residual quantiles give the 80% range, widened by split-conformal scores on the newest sales. The nearest sold comps are moved to the item and to today by the fitted premiums and trend. Segment liquidity gives sell-through, days to sell and the ask-to-sold spread. A range is hidden as `too_few` or `too_wide` (money D5), rounded to whole dollars and labelled Level 1, 2 or 3. `jobs/valuation/fit.py` is the nightly Databricks fold's `valuation` task. Tested on the synthetic market only (`jobs/valuation/synthetic.py`): the range held 82% of the newest 277 sales against an 80% target, and the median error was 20% against 25% for the category median. It has not run on real sales, because there is no `comp` table yet.

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
- *Applied on Ben's word (06:54):* from insurance, lending, iBuying, pawn shops and appraisal: comps weighted by gross adjustment with a bracketing check and a one-sentence reconciliation, a lender-style accuracy report (hit rate, PPE10, PPE20), double-sale risk from the item's own sale speed with hot items held to one site, a downside line, a function adjustment, autonomy gated by measured accuracy, insurer schedules as a labelled cold-start prior, and no guaranteed offers. [risk-and-reconciliation.md](../../research/price/ben/risk-and-reconciliation.md)
- *Agent proposal:* OpenRouter can serve every model call (Decisions, label reading, Seedream) on one key, and Treg about half the data calls (Google Lens, eBay search and detail, scraping, page monitors); sold data and Facebook still need their own keys. Not yet called. [openrouter-and-treg.md](../../research/price/ben/openrouter-and-treg.md). Rebuilding Treg on Databricks is for later: [ideas board](../../ideas/treg-on-databricks.md).
- *Agent proposal:* default offer settings per site from the floor and always-accept lines, and how each site's price drop works: [levers-and-signals.md §6](../../research/list/ben/levers-and-signals.md#6-design-agent-proposal), arithmetic in [levers/defaults.mjs](../../research/list/ben/levers/defaults.mjs).
- Ben: [pricing-psychology.md](../../research/price/ben/pricing-psychology.md). eBay first offers average 61% of list, midpoint counters are accepted more, slow replies lose sales; this backs money D16's midpoint counter; *agent proposal:* answer within minutes, struck-through prices only after 7 days live.
- Ben: [what-predicts-price-and-speed.md](../../research/price/ben/what-predicts-price-and-speed.md). Season shows in how many sell (January about 9% under an average month, March and October about 8% over), not yet in price; identical items resell about 11% apart, so the headline is "within 20%" against the eBay sold median, never R²; *agent proposal:* every signal earns its weight in a switched-off test, and the backtest design with the rows to collect.
