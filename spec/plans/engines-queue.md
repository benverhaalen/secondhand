# Engines: open branches and the queue

The engines lead's state at the wrap-up stop (Nate, 2026-11-15: wrap up, then spec). Building resumes from the reviewed spec. Each item below becomes a named fix on its spec page before it is built.

## Open branches (on the Mac, `w/<name>`, not on main)

See [packet 70](../../.agents/team/packets/team/70-engines-handoff.md) for each branch's state: `w/eng-valuation-2` (the ablated engine, 5e1d3874, under review, with the `valuate` seam being built on top) and `w/eng-valuation-1` (the runner and fit, round four fixing two blocking review findings).

## The queue, in order (Nate's order of 2026-11-15 morning: land, do not widen)

1. **Land `w/eng-valuation-2` at 9e8bb9f5** (the engine and the valuate seam, merged with main): three fixes first, named in [packet 70](../../.agents/team/packets/team/70-engines-handoff.md). Done: on main, `app/src/engines/realtime.test.ts` 4/4, the realtime proof 13/13, `tsc` clean.
2. **The `valuate(item, ctx)` seam**, agreed with the integration lead: `app/src/engines/valuation/valuate.ts`, brief `/tmp/brief-eng-valuation-2-valuate.txt` on the Mac (the shape, links 1, 2, 5, 6, 7, 9, `basisOf` as the one effective-sample formula, `last_sale` beside the range for C1, and `edge/intel/gather.ts` `measure()` on `basisOf` with a shown thin answer also gathering). Done: `valuate.test.ts` and the brief's list pass, the proof's moved links updated in the same commit, the commit sent to the integration lead.
3. **Merge `w/eng-valuation-1`** after round four and a review of its delta; send the Databricks lead the merge commit for the four `core.param` columns.
4. **AD9, the off-brand match** (the adaptation lead's [adaptation.md](../engines/adaptation.md) AD9, Nate called it important): spec on [identity.md](../engines/identity.md) first (capture's part stays capture's): the brand-free attribute record, a brand alias normaliser, a size parser, a `similar_other_brand` pass before `reconcile.ts`'s wrong-item cut (`reconcile.ts:46`), `in_basis` false, a `similar` relation in `rank()`. Then MI3 (identity adopts `jobs/measures/attributes.py`, TypeScript twin in parity) once that worker's merge lands.
5. **AD5, the best site for this person** (Nate, 07:30: assess the linked platforms for the one it performs best on, or list both): spec on [marketing-engine.md](../marketing-engine.md) first, build on `valuation/path.ts` `bestSites` (D12): per linked site, expected keep = supported price × P(sale within horizon, D10 by site and kind) − fees and shipping from `spec/sites.mjs`, each term with its basis level and count; a both-sites answer when a second listing adds more expected keep than it risks (`sold.confirm` ends the others; `offer.seller.binds` keeps the item committed). Python twin in parity. Tests: a fee or sell-through change flips the ranking; one case where both-sites wins and one where it loses.
6. **V-AB1 and V-AB2** ([valuation.md §9](../engines/valuation.md)): the range over-covers (86.0% against 80%); close the last point to last sale. Each judged by a rerun of the same ablation command on the same items.
7. **Small follow-ups found in review**: NG-A6 to NG-A9 ([negotiation.md](../engines/negotiation.md)); amend D6 on [money.md](../determinations/money.md) to the log-ratio score; the valuation twin's input handling (a zone-less date, a None `sold_at`, a NaN drift, untested paths: size ratios, parent site ratios, own orders, extrapolated down, the fast half-life) with one fixture case each, `test_comps_parity.py` parametrised.
8. Then the older items: the basis and the "checked" equivalence test, the comp-source table, the negotiation runtime read side, intel calculations, the backtest's weighted conformal (in `w/eng-valuation-1` round four), `promote()` taking the caller's bootstrap bound, Person, then AD1 to AD4 and C3 from [adaptation.md](../engines/adaptation.md) and [credibility.md](../engines/credibility.md), each only after its measure is proved.

## Decisions held

- Nate: "we own backtests and such", and "lets backtest as we build to evaluate and improve". Every valuation change is judged on the same items against the baselines before it merges. Nothing goes on a public page or the pitch until Nate and Ben have both seen it.
- Under the posture's accept line, at any posture above 0, the champion counters where D16 rule 2 alone would accept. That is the slider's design, and it is with Nate as a product behaviour.
- A fixture or test input is never changed to make an invariant pass.
