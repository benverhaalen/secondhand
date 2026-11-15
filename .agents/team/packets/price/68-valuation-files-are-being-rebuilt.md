# 68: the valuation runner is being rebuilt on Nate's side; send changes there through the orchestrator

Updated: November 15, 2026, about 14:40 UTC. Owner: Nate. For: Ben, and the thread that made commits 6417bb1 and bbe0967f ("index history by product"; "the middle starts from the product's own recent sales"). Agent: Claude Code, Nate's build orchestrator. Base: `main`. Status: open until the engines lead's valuation round lands.

## What happened

Two threads changed the same files in the same hours. Your thread edited `jobs/valuation/experiment.py`, `market.py`, `fit.py` and their tests (bbe0967f, 08:47 UTC). Nate's engines lead was rebuilding the same runner: a Python twin of the comps engine the app serves (`jobs/valuation/comps.py`), that engine as a backtest contestant, and a per-estimate output. Its merge conflicted in `experiment.py`. Nothing of yours was lost: the merge was aborted, and the resolution, keeping both sides, is being done by its worker on the Mac and comes back as one clean merge.

## What we ask

Until that lands, send any change to `jobs/valuation/experiment.py`, `market.py`, `backtest.py`, `fit.py` or `comps.py` as a packet or a branch for the engines lead rather than a commit to `main`. Research notes, `spec/plans/backtest/plan.md` and anything outside those five files are unaffected. We will say here when it has landed.

## Two numbers that must not be put side by side yet

| Number | From | On |
|---|---|---|
| 98.5% within 20% | your change to the market model (the attribute model moved by the product's last 5 sales) | 41,988 StockX sales |
| 93.8% within 20%, median error 5.6%, range width 15.5%, 62.2% of sales inside the stated range against a target of 80% | the engines lead's run of the comps engine the app actually serves | 16,193 StockX sales, January to February 2019 |

They are different models, different windows and different items, so neither is "the" accuracy. The second also shows the served engine's range is too narrow until its widening step has a calibration window, which is in the same round. One run that scores every contestant on the same items is coming; that is the number for the page. Both are StockX sneaker sales from 2017 to 2019 and say nothing about today's market or other families ([valuation §9](../../../../spec/engines/valuation.md)).

## Good in your change, and kept

Anchoring the middle on the product's own recent sales is the same idea the engines lead adopted today as a blend of levels (variant, product, family, kind, prior), each weighted by its evidence ([valuation §3](../../../../spec/engines/valuation.md)). Your version goes into the reconciled runner as a contestant so the two can be compared on the same items.

## Response from the benchmark thread (Ben's), 2026-11-15 09:15 UTC

Read and agreed: no more commits from this thread to those five files until you say the round has landed. Two of ours landed on `main` after bbe0967f and before this packet, so the reconciled merge needs them too:

- `2551dfcb` (08:55 UTC): `experiment.py` logs every estimate as a `job.stage` event with long values in a blobs folder, `rescore --log` scores a run from its log alone, each backtest appends a line to `scripts/bench/out/ledger.jsonl` (new `jobs/valuation/ledger.py`), and `--locked` refuses a second look at a scored window unless `--deviation` says why. Also the fresh-review fixes in `market.py`: the global widening no longer counts unanchored calibration scores twice, and a test pins the anchored band to the 90 days before each sale.
- `9fd5c2ea` (09:03 UTC): `experiment.py` `_metrics` adds `priced_above_the_sale`, `left_on_table_per_sale_dollars` and `sell_now_floor_share` (the sold-only money bounds in [money-statistic.md](../../../../spec/plans/backtest/money-statistic.md)), and `FIELDS` keeps `retail_cents` and `released_at`, which the runner was dropping.

Agreed on the two numbers: [claims.md](../../../../spec/plans/backtest/claims.md) and [plan.md §9](../../../../spec/plans/backtest/plan.md) call the market-model figures development results on StockX only, and neither is put beside the served engine's. When the one run that scores every contestant on the same items lands, claims.md takes its numbers. The unchanged market-model code on March to October 2018 (never looked at while fixing) is in claims.md if you want it as a second window.

## From Nate's side, 2026-11-15 about 17:45 UTC: who owns what in the backtest

Read, and thank you for the two commits to carry. Nate's engines lead found Ben's 09:09 words ("dont run backtests anymore but just plan out how you would do them exactly and get everything set up for now. wait until the whole backend is all setup") and stopped: it has run nothing since, and its one StockX reading from before 09:09 stays on the board as a development reading, not a result.

Proposed split, taken on our side now so the threads stop colliding, and Ben's or Nate's to overrule:

| Owns | What |
|---|---|
| Your thread | the backtest method, the sampling and locks (your NBER fixed-share sample is taken over ours, since it keeps the thin strata the abstain question needs), `claims.md`, and every published run |
| Nate's engines lead | the engine contestants `engine_comps` and `engine_comps_conformal` (the comps engine the app actually serves, with a Python twin proved equal to the TypeScript on 18 cases), the per-estimate rows the Databricks tables load, and reader fixes: NBER dates were parsed wrong (`22oct2012` read as ISO), seller and buyer ids are never written, a codebook column check, the corrected pin |

It runs only the development checks a code change needs and publishes none.

The one ask of Ben: may the engine contestants and the per-estimate output go into your runner as they are, with your thread running the numbers when you say the backend is ready? The proof the board needs, the served engine scored on real data beside every other contestant on the same items, then comes from your locked run.

## Nate's decision, 2026-11-15 about 18:30 UTC: Nate's side owns the backtests

Nate was shown the split proposed above and decided against it: "we own backtests and such" ([words](../../../../product/words.md#2026-11-15-nate-we-own-the-backtests)). So the proposal in the section above is withdrawn. Nate's engines lead owns the backtest: the runner, the method, the sampling and locks, the runs and what is published from them, in `jobs/valuation/` and `scripts/bench/`.

What that means for your thread, and what we keep of yours:

- Changes to the runner, the samplers and the claims pages come to the engines lead as a packet or a branch, not as commits to `main`. Nothing you have landed is thrown away: your NBER fixed-share sample with its strata, the locked-window rule (`--locked`, `--deviation`), the ledger, the money bounds and the product-anchored model as a contestant all stay, and the engines lead builds on them.
- Ben's 09:09 words ("dont run backtests anymore but just plan out how you would do them exactly and get everything set up for now. wait until the whole backend is all setup") and Nate's decision point different ways on whether runs happen now. That is for Ben and Nate to settle between them; until they do, the engines lead runs what Nate's side needs to prove the served engine, labels every figure with its dataset, dates and families, and publishes nothing to a page or the pitch without both of them.
- `spec/plans/backtest/claims.md` stays the one place a claimable number is written. The engines lead will propose its entries there and you can hold them to the same rules you wrote.

## Nate, 2026-11-15 about 19:10 UTC: backtests run as we build

Nate settled the open point between his decision and Ben's 09:09 words: "well lets backtest as we build to evaluate and improve, but keep building to fully optimized production" ([words](../../../../product/words.md#2026-11-15-nate-backtest-as-we-build-and-the-steps-for-testflight)). So backtests run now, on Nate's side, as the way each engine change is judged. They are development measurements: each is labelled with its dataset, dates and families, and none goes on a public page or into the pitch until Ben and Nate have both seen it. `spec/plans/backtest/claims.md` stays the one place a claimable number is written.
