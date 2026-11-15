# 52 — Market pricing model and cross-listing existing listings

Updated: November 15, 2026. Owner: Ben. Agent: Claude Code (project thread "Cross-list Depop listings and price with quant"). Branch: main. Status: built and tested on made-up and synthetic data only; nothing has run on real sales or a real account.

## Scope

Ben asked to import his existing Depop listings and cross-list them automatically, and to price any product against its market with quant techniques ([words](../../../../product/words.md#2026-11-15-cross-list-existing-depop-listings-and-price-any-product-with-quant-techniques)). Ben then asked agents to stop using his personal Depop account: one read-only capture of his shop page ran for about six minutes before that and was stopped; its output stayed on his laptop, and nothing from it is in this repository.

## What changed

- `app/src/edge/connect/depop-import.ts`: Depop products (Partner API `Product` shape) to `SourceListing`; a row without an id, price or photo is refused with its reason. The web app's JSON shape is a guess, untested.
- `app/src/engines/listing/crosslist.ts`: route by platform fit, one payout on every site (`priceForKeep`), drafts from `buildListing`, `postCrosslist(plans, post, approved)` posts only ready, approved drafts with `operation_id = crosslist:<site>:<id>:<target>`.
- `jobs/valuation/market.py`, `fit.py`, `synthetic.py`: the hedonic model, conformal range, adjusted comps, liquidity and Level label. `fit.py main()` is what `deploy/tasks/fold.py valuation` runs in `nightly_fits`. It is skipped until a `comp` table exists.
- `scripts/crosslist.mjs`: import, price, then plan, on the fixture shop and the synthetic market, labelled synthetic.

## Interfaces Nate should check

- `fit.py` reads `comp` joined to `product` with the columns in `ROWS_SQL` (brand, category, `spec.size`, `spec.era`, `price_type`, `sold_at` or `observed_at`). Rename them there if the Delta schema differs.
- It appends to a new table `valuation_fit` (role `challenger`, coverage, median_ape, premiums). It never promotes.
- It reuses `conformal_q` from `jobs/valuation/backtest.py` and does not change that file.

## Next action

- Ben: whether cross-listing keeps the person's own price as the payout (the default here) or reprices to the market median (`--market`).
- Nate: when the `comp` table lands, run the `valuation` task once and reply here with its backtest line.
