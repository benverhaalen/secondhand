# 69: live sold comps reach the valuation endpoint; three harness pieces make them flow

Updated: November 15, 2026, 09:30 UTC. Owner: Ben. For: Nate's harness and engines leads. Agent: Claude Code, Ben's benchmark thread. Branch: `main`. Status: open until the three asks below land.

## What happened

`POST /v1/valuations` called the comps engine with `warm_comps: []` and `sources: []`, so the app priced from an example item's family band and never ran on live comps [observed, `app/src/edge/api/valuations.ts` before this change]. The coordinator asked this thread to wire the Mercari and Poshmark sold searches in.

## What changed (on `main`)

- New `app/src/engines/valuation/sold.ts`, tested in `sold.test.ts`: one source per site calls `harness.call(site, 'search', { q, status: 'sold' })` and turns sold rows into D1 comps. Rules [agent proposal, in the file's header]: sold rows with a price only; the listing date stands in for the sale date (never understates age); a title holding every query word is `product` (w_match 0.5), any other hit `family` (0.25); a stated condition maps to D2's grades (extraction 0.9), an unstated one takes the item's grade with extraction 0.7; `may_model: false`. A site the harness cannot reach adds nothing and goes to `log.error`; nothing throws.
- `valuations.ts` passes those sources for Mercari and Poshmark, with the item's name (the title before its first comma) as the query, and the target grade `good` (it said `used_good`, which has no D2 ratio and would have thrown on the first real comp).
- No harness file changed. Offline nothing differs: the runtime harness has no Mercari or Poshmark route, both answer `no_route`, and the family band shows as before (`node --test app/src/edge/api/valuations.test.ts`, 17 pass).

## What we ask of the harness side

1. **Register the Mercari and Poshmark adapters in `app/src/edge/api/runtime.ts`'s harness**, gated by `SECONDHAND_LIVE_SITES` the way Depop is. Mercari needs a browser client (its search answers through the page's GraphQL, as in `sites/mercari/live.ts`); Poshmark's `doc` and `json` client is plain fetch. This is the switch that turns live comps on.
2. **Add `condition` and `size` to search rows.** Mercari's search items already carry `itemCondition.name` and `itemSize.name` (see `fixtures/search-sold.json`); the adapter drops them. Without them every comp prices as the item's grade at extraction 0.7.
3. **A sale date, if either site has one on a sold row.** Today only `listed_at` exists, so a comp listed in March and sold last week is aged from March. If Mercari's item has an `updated` time or Poshmark an `inventory` status time, a `sold_at` field fixes D1's age weight.

One question for the harness lead: Mercari maps `trading` (in a transaction) to `sold`. A trade can still be cancelled. Is that acceptable for comps, or should comps take only `sold_out`?

## Next action

Harness side: the three asks. This thread: none until they land; then a live check on one query and a note in `spec/plans/backtest/how-we-price.md` §3.

Evidence: `node --test app/src/engines/valuation/sold.test.ts` (5 pass, including the recorded Mercari sold search priced through `comparables`, which honestly comes back `too_few` on its five rows).
