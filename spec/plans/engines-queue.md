# Engines: open branches and the queue

The engines lead's state at the wrap-up stop (Nate, 2026-11-15: wrap up, then spec). Building resumes from the reviewed spec. Each item below becomes a named fix on its spec page before it is built.

## Open branches (on the Mac, `w/<name>`, not on main)

| Branch | Holds | Why it is not on main |
|---|---|---|
| `w/eng-rt-neg-1` (9cf9268e) | answered offers update `P_accept` through `store.apply` in the same transaction; the next counter uses it; a TypeScript twin of `jobs/negotiation/fit.py` `online_update` on 8 dated sequences | after merging main, `learn.test.ts` fails: "P_accept has no earlier promoted fitted version". The registry's rollback now restores only a row with origin `fit`, and the test's first champion is an event row |

Workers still finishing at the time of writing are listed on [the board](board.md) with their result when they land.

## The queue, in order

1. **Valuation: the registry read and the seam.** `valuate(item, ctx)` in `app/src/engines/valuation/valuate.ts`, as agreed with the orchestrator and the integration lead: `ctx = {params: ParamStore, sources: CompSource[], observations: {read, write}, as_of, person?}`, no import from `edge/`. It returns `{valuation, gather: GatherRequest | null}`, with a gather request whenever `basis_level` is below variant. `check()` resolves every D1-D4 param through the store and puts each version on the citation. The `too_few` note and `basis_level` go on the answer.
2. **Valuation: the basis and the "checked" state.** The basis counts weight mass by match level as well as Kish `n_eff`, and the conformal groups include `basis_level` (science audit (a)). "Checked" comes from an equivalence test, coverage inside 80% ± 5 points by two one-sided tests at 5% with Holm across cells ([money.md](../determinations/money.md), the D6 rows). The range is shown either way.
3. **Valuation: the comp-source table.** One row per source: price kind sold, asking or guide; has sale dates; may model; weight prior. Rows: the person's own sales (eBay Seller Hub orders, the Mercari sales report, the Depop CSV; the highest prior), the eBay sold page and Terapeak in the person's signed-in session, the Mercari and Poshmark sold searches (listing date only; never fitted), BrickLink and Reverb (per licence), WatchCharts (guide), retail (a ceiling), live asks (a cap), and `dupe_search` (asking; never stored past the request). `sold.ts` reads the table. An asking price or a guide figure is its own evidence kind and never a sold comp.
4. **Negotiation: the read side for the runtime.** `pAccept(x: {site, kind, ask_cents, offer_cents, days_listed, buyer_tier, round?}, store): {p, basis_level, param_versions}`: pooled through `readPooled` from (site, kind) to global and then the concession-curve prior. It never throws on a missing scope. Fix `w/eng-rt-neg-1`'s rollback test on top of it.
5. **Intel calculations** (`app/src/edge/intel/gather.ts`, `reconcile.ts`, `classify.ts`, `learn.ts`). gather uses valuation's `nEff` and comps' `sufficient()`. reconcile carries the match level as a weight, and "exact" needs a score plus GTIN/MPN, or model plus variant. classify maps conditions to D2's bands. `updateContribution` is called when an outcome confirms or contradicts a gathered comp, in the same transaction.
6. **Backtest:** the weighted conformal in `jobs/valuation/backtest.py` includes the test point's own mass (science audit (d)).
7. **Registry:** `promote()` takes the caller's paired bootstrap lower bound and refuses a challenger without one (science audit (e), the open part).
8. **Person:** the "Person" rows of [the audit](../engines/audit.md); one reset epoch in TypeScript and the Python fold.
9. **Type check:** `app/src/engines/trust/audit.test.ts` (1 error).
10. **Fresh reviews**, one at a time, then tick board rows: trust, demand, analytics, recommendation and style, identity, marketing and score, the param registry, proof and the claim check, valuation.

## Decisions held

- Nate: "we own backtests and such", and "lets backtest as we build to evaluate and improve". Every valuation change is judged on the same items against the baselines before it merges. Nothing goes on a public page or the pitch until Nate and Ben have both seen it.
- Under the posture's accept line, at any posture above 0, the champion counters where D16 rule 2 alone would accept. That is the slider's design, and it is with Nate as a product behaviour.
- A fixture or test input is never changed to make an invariant pass.
