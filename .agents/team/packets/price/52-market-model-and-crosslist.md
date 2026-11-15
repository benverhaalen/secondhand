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

## After the fresh review (same day)

Fixed:
- The model trains on sold rows only, and asks only cap the range.
- Comps are moved to today.
- `too_few` follows §4.5, `too_wide` and whole-dollar rounding follow D5, and the backtest checks 75 to 85%.
- The floor comes from the person (Depop `auto_negotiate_offer_price`) at the same keep on every site.
- A listing not in US dollars is skipped, a site where the item is already live is skipped, and `outcome_unknown` reconciles.

Still open:
- The Mondrian fallback is the whole market, not the parent category, because `comp` rows carry no parent.
- The site premiums the model fits are not used. Platform-fit's one-target-payout rule sets each price instead, and pricing-in-context §6 says that may be wrong. This is a decision for Ben and Nate.
- Nothing plans the delist when one copy sells (crosspost-and-delist.md).
- The guessed constants are listed in the commit messages.

## Cross-listing price rules (same day, later)

- `SPREADS` in `app/src/engines/listing/crosslist.ts`: four rules for how one item's prices relate across sites: `same_keep` (same take-home), `same_price`, `site_market` (each site's median sale, falling back to `same_keep` when there is none), and `home_first` (other sites 10% above the take-home price, a guess).
- `planItem(l, { spread, site_market })` sets `ItemPlan.spread`, and each `SiteDraft` now carries `why: { says, numbers }`. `says` is plain words with no digits, and the test enforces that. `numbers` is the price, fees and take-home.
- The floor pays the same on every site under every rule.
- Ben decided that new sellers start on `same_keep`, with the rule set once for the account and an override per item ([decision](../../../../product/decisions.md#2026-11-15-cross-listing-starts-on-same-take-home)). Research: [crosslist-pricing.md](../../../../research/list/ben/crosslist-pricing.md).

For Nate:
- `site_market` needs a median sale per site from `comp`. The fitted per-site premiums in `valuation_fit` are the natural source once real rows land.
- Nothing stores the account rule or the per-item override yet. If you want them in the server schema, they are one setting per account (`crosslist_spread`, default `same_keep`) and one optional field per item.

## Next action

- Ben: whether cross-listing keeps the person's own price as the payout (the default here) or reprices to the market median (`--market`).
- Nate: whether the account rule and the per-item override live in the server schema.
- Nate: when the `comp` table lands, run the `valuation` task once and reply here with its backtest line.
