# 54: Comps weighted by least adjustment, and the risk of each step measured

Updated: November 15, 2026. Owner: Ben. Agent: Claude Code (project thread "Frame the problems and beat competitors"). Branch: main (also draft PR #9). Status: spec changed and D1 built in TypeScript with tests; the Python jobs are not changed.

## Scope

Ben asked for mechanisms from insurance, lending, appraisal and quant that improve pricing accuracy, quantify risk and explain a price, then said to apply them to the product's logic ([words](../../../../product/words.md#2026-11-15-adjacent-appraisal-risk-and-why-this-price)). Research: [risk-and-reconciliation.md](../../../../research/price/ben/risk-and-reconciliation.md). Market and competitor side: [product/pitch/market.md](../../../../product/pitch/market.md).

## What changed (spec)

- [D1](../../../../spec/determinations/money.md#d1-comparable-set-and-weights): new weight `w_adj = 1 / (1 + G / ln 1.25)`, where G is the gross adjustment (sum of absolute D2 and D3 log factors). The 25% cap is now on gross, not net. A set is `extrapolated: up` or `down` when every kept comp's D2 adjustments moved the same way (time is left out).
- [D5](../../../../spec/determinations/money.md#d5-fair-value-range-overall-and-per-site) step 3: an extrapolated side widens by the parent `Q_g`, before the ask cap.
- [D6](../../../../spec/determinations/money.md#d6-range-calibration-and-display-state) step 4: the backtest reports hit rate, PPE10, PPE20, median absolute percentage error and the share off by more than 30%, per cell (family × price band).
- D12: `P_double_j` from each site's sale speed; items selling in under 24 hours go on one site first. D13: an expected-shortfall downside line. D2: `works` is priced.
- [Card 18](../../../../spec/determinations/managing-and-buyers.md#18-whether-an-action-kind-has-earned-auto): money actions may run without asking only where the cell's range is Checked and PPE20 is at least 70%. Card 17: an incident rate per site and route across all users.
- [M10](../../../../spec/determinations/market-insight.md#m10-depreciation-by-category-and-brand): insurer depreciation schedules as a labelled cold-start prior, once the table rows are read.

## Interfaces Nate should check

- `jobs/valuation/backtest.py` reports coverage and q50 error per cell. Card 18 now reads PPE20 per cell, so the backtest output needs `hit_rate`, `ppe10`, `ppe20`, `mdape` and `share_over_30` next to coverage. Not added here, because it is your file.
- `jobs/valuation/market.py` `adjusted_comps` ranks by distance and has no gross cap or `w_adj`. The TypeScript side (`app/src/engines/valuation/comps.ts`, `adjustDetail`, `extrapolated`) follows D1 now; the two disagree until one of us ports it.
- `valuation_fit` rows would carry the five accuracy numbers if card 18 is to read them from Databricks.

## Next action

- Nate: say whether you will add the five numbers to `backtest.py` and the gross cap to `market.py`, or want this thread to.
- Ben: none needed; the changes are on main and in draft PR #9.
