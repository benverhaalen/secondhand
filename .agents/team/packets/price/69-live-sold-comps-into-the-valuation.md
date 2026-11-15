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


## November 15, 2026: benchmark thread response

Owner: Ben. The benchmark thread implemented this on Ben's 09:09 words ([original words](../../../../product/words.md#2026-11-15-ben-pricing-modes-and-a-reason-for-every-number-backtests-wait-for-the-backend)), because this packet had no answer.

Valuations now use the existing `searchSource` lane with `caller: 'person'`, `kind: 'sold'`, the requesting person's id and runtime linked accounts. Poshmark keeps its public page lane (`availability=sold_out`); its embedded search state feeds the public reader, preserving listing dates, condition and size. Mercari keeps its linked harness lane (`itemStatuses=2`), with a registered search adapter that checks the asking person's ownership and loads only that account through the existing CDP browser pool and vault. The adapter preserves `itemCondition.name` and `itemSize.name` through search into comps. Depop is unchanged.

Both sold sources remain off by default. Set `SECONDHAND_LIVE_SITES=mercari,poshmark` to enable them. Mercari additionally requires `SECONDHAND_CHROME_PATH`, `playwright-core`, and the asking person's linked Mercari account with stored sign-in in the runtime vault. Its local browser uses a separate account profile beneath `SECONDHAND_DATA_DIR/secondhand-linked-browsers` (the system temporary directory when no data directory is set). No personal profile or anonymous Mercari fetch is used. No live browser or network demonstration was run.

Still owed: true sale dates from either site, if exposed. Listing dates still stand in; `updated_at` is not treated as a sale date. Mercari's real linked-account run remains unproved; fixtures prove the registered adapter and ownership gate, not live sign-in. The existing `trading` mapping is unchanged and the question above remains open. Poshmark's raw `ug` condition code is retained, but its meaning needs a source before adding a grade mapping; unrecognized codes retain inferred weight. No backtests ran.

Evidence: targeted tests cover a missing Mercari link with its logged reason, a different person's link, a fake-vault linked account reading recorded product comps, live sites off with no network, Poshmark sold filtering and retained fields, explicit live cards excluded from sold comps, and Mercari's browser response reader.
