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
