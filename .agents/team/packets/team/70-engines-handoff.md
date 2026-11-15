# 70: the engines handoff

Updated: November 15, 2026, about 05:30 Central, by the third engines lead at the wrap-up Nate called at 10:00 Central ([words](../../../../product/words.md#2026-11-15-nate-wrap-up-the-sessions-review-the-whole-project-then-the-presentation), "Lets wrap up models as they stand when finished on whats currently happening"). Owner: Nate. Read this, [packet 55](55-team-leads-and-mac-workers.md), [the queue](../../../../spec/plans/engines-queue.md) and the engine's spec page before touching `app/src/engines/` or the `jobs/` engine twins.

**The improved valuation is not on main.** It is committed on its branch, `w/eng-valuation-2` at 9e8bb9f5 on the Mac, with origin/main merged in. It waits on three small fixes, listed under "left" below. Main still serves the engine from before the ablation.

## What works on main today

Run TypeScript one file at a time (`node --test --test-concurrency=1 <file>`), Python with `./.venv/bin/python -m pytest <file> -q` on the Mac (`python` on Windows).

- Negotiation learns in real time: an answered offer moves `P_accept` in the same transaction (b565ba90). `negotiation/learn.test.ts` 10, `learn.parity.test.ts`, `jobs/negotiation/test_learn_parity.py` 9.
- Registry rollback restores the champion a fitted promotion replaced, in memory, SQL and Python (b565ba90). `param/param.test.ts` 41, `sql.test.ts` 37, `parity.test.ts` 63, `jobs/param/test_param.py` 91.
- Real-time sale, comp and view weights: a sold comp moves demand velocity, our sale moves `Q_g` by ACI, views move the view rate (1f5a70da). `engines/realtime.test.ts` 4/4 on main (checked 2026-11-15 05:05 on Windows), `demand/velocity.test.ts` 14, `valuation/aci.test.ts` 13.
- Trust decides on code signals with no extractor; D2, D5, D11, D13, D17 fixed (4f01e379). `trust/wired.test.ts` 65 and every `trust/*.test.ts`.
- The real-time proof on main: `node --test --test-concurrency=1 scripts/realtime-proof.test.mjs` 13/13.
- Specs: AD9 on [identity.md §3 G](../../../../spec/engines/identity.md) with test 7 and task id-7 (044c8ecf); AD5 on [marketing-engine.md §3.8](../../../../spec/marketing-engine.md) (044c8ecf, 75b2e7e1); money D5 and D6 say the conformal score is a log ratio (777eec10).

## What does not work, or is not joined

- **The improved valuation and `valuate(item, ctx)` are on a branch, not main** (`w/eng-valuation-2`: 5e1d3874 the ablated engine, 153e09c2 the seam, 9e8bb9f5 merged with origin/main). Its own checks pass after the merge (`valuate.test.ts` 18, `check.test.ts` 31, `comps.test.ts` 30, `comps.parity.test.ts` 28, `keep.test.ts` 17, `aci.test.ts` 13, `gather.test.ts` 16, `valuations.test.ts` 17, `sources.test.ts` 5, the real-time proof 13, `tsc` clean). But `app/src/engines/realtime.test.ts` fails 2 of 4 on the branch while main passes 4. A fresh review found the causes:
  1. `aci.ts` `calibrationForCheck` (from main) still hands `Q_g` in cents, and `check.ts:75` now widens by `exp(Q_g)`, so q90 overflows: `RangeError: q90 must be nonnegative safe integer cents` (realtime.test.ts:61). Fix: return `Q_g: Q`, drop the cents translation.
  2. `check.ts:80` `checked` never reads `local.state`, so a too_few range with a passing calibration reads `checked` while carrying a too_few note. Fix: add `local.state !== 'too_few' &&`, with one test on the overall and per-site state.
  3. The branch hides `p_sale` and `price_path` when a curve comes without `curve_evidence` n ≥ 30 (realtime.test.ts:79 gets `price_path` null). Keep main's meaning: a supplied curve prices; evidence only annotates. The system always answers (packet 55).
  Lower: valuate.ts:49 still sends a made-up `param_version` (the max of resolved versions); the route at `edge/api/valuations.ts:22` passes `param_version: 1`.
- The integration lead's route and real-time links 2, 3, 5 and 7 wait on `valuate` reaching main. No message was sent to it, because the seam did not land.
- **AD9** is built and parked on `w/eng-ad9-1` at fcde0de4: `attributes.test.ts` 9, `similar.test.ts` 7, `similar.parity.test.ts` 25, `reconcile.test.ts` 25 (18 old unchanged plus 7 new), `jobs/identity/test_similar.py` 26. It is not landable alone: `tsc` fails at `app/src/edge/api/search.ts:31`, whose exhaustive `matchOrder` lacks `similar_other_brand`. That file is the integration lead's (its `int-search-2` worker had it open), and the `similar` relation in `rank()` (`search.ts:74`) goes with it. The TypeScript record is a port of the adaptation lead's `jobs/measures/attributes.py`, uncommitted in `adp-slice-1` (SHA-256 9923d596… when read). Parity of the record waits on that file reaching main.
- Canon: the match label `similar_other_brand` and the offer relation `similar` are not yet in `spec/product.md` (the match label row, line 149). That change goes to the orchestrator.
- AD5 is specified only. Python `jobs/analytics/placement.py` `pick()` runs D12 in full; its TypeScript twin `path.ts` `bestSites` does not (fixed `P_DOUBLE`, no hot-item rule), and `check.ts:87` passes `cancel_cost: 0`, so check picks every site with positive gain.
- `w/eng-valuation-1` round five: see the last line of "left".

## What is left, in order

1. Land `w/eng-valuation-2`: fixes 1 to 3 above as one follow-up brief in that worktree (`AGAIN=1`; gpt-6.1-sol, high). Done when `app/src/engines/realtime.test.ts` passes 4, the files listed above stay green, the proof is 13 and `tsc` is clean. Then a fresh review of the delta, and a merge to main by commit id. Tell the integration lead the commit the moment it is on main.
2. Land AD9 (`w/eng-ad9-1` fcde0de4) together with the integration lead's two lines in `search.ts`: `similar_other_brand` in `matchOrder`, and `relation: 'similar'` in `rank()`. A fresh review first. Then the canon rows to the orchestrator. Record parity once `jobs/measures/attributes.py` is on main.
3. AD5: the brief is written and not sent (it was a scratchpad file; restated here). Owned files: `app/src/engines/valuation/sites.ts` and `sites.test.ts` (new), `path.ts` (bestSites, made the exact twin of `pick()`), `check.ts` (the site choice), `params.ts` (`site_set.horizon_days` 30, `site_set.cancel_cost_cents` 2500 *agent proposal*, `site_set.delist_window_min` 4), `valuate.ts` (pass-through of `linked` and `committed`), `jobs/analytics/placement.py` and its test, and `best-sites-parity.json` (add cases only). Done: the tests of §3.8 (a fee change and a sell-through change each flip the ranking; both-sites wins once and loses once; an unlinked top site is not picked; a binding open offer holds the plan on Poshmark and an open offer on Depop does not; a hot item goes alone), plus `keep`, `check`, `valuate`, `realtime`, `sources`, the valuations route test, the proof 13 and `tsc`. It starts after item 1, because both change `check.ts`.
4. V-AB1, the range over-covers (86.0% against 80%), and V-AB2, the last point behind last sale ([valuation.md §9](../../../../spec/engines/valuation.md)). Each is judged by rerunning the same ablation on the same 41,988 items. The Databricks lead keeps the 11-15 ablation row in `secondhand.measures.engine_ablation` until then; send it the new commit and run id.
5. The value of an item's parts, from the capture lead (packet 72, row 8): queued, not started.
6. Older items as in [the queue](../../../../spec/plans/engines-queue.md) items 7 and 8.
7. Land `w/eng-valuation-1` at 4a434c78 (the runner and fit, rounds two to five; the `core.param` columns origin, previous_version, keep and days_since_last at 5262fedf), **after item 1**. Its `comps.py`, `comps.parity.test.ts`, `test_comps_parity.py` and `fixtures/comps-parity.json` collide with `eng-valuation-2`'s; when merging main into it, take eng-valuation-2's. Round five passed its five checks (`pytest jobs/valuation/test_fit.py`, `test_backtest.py`, `test_experiment.py`, `test_market.py`, `PYTHONPATH=jobs python scripts/bench/backtest.py self-test`, all exit 0). Round four's fresh review said merge after one fix (the refit ran only on a paired gain), and round five made it. Still needed: a fresh review of 015b81c1..4a434c78, the merge with main, and a rerun. Then send the Databricks lead the merge commit for the four `core.param` columns.

## Decisions made, and why

- **The serve refit runs every night that is not frozen**, whoever wins (valuation §4: "the winner is then refitted on all rows to serve"). The round-four review found it ran only on a paired gain.
- **Off-brand similarity is one function, `similar()`, in both languages.** The A11 measure is to read the same function, so "similar" has one meaning. Condition grade is the cell A11 compares within, not a match attribute. `jeans` implies `denim`.
- **The similar pass runs before the id clash and the wrong-item cut**, because a different maker's GTIN always clashes. Jev is never offered the new label; code decides.
- **AD5 is D12, stated once on money.md.** The marketing page adds only the linked filter, each term's basis, real cancel costs and the binding-offer hold. With no `linked` passed, the caller's sites count as linked, so today's callers keep their pick.

## What this session learned the hard way

- **A plain `ssh` command has no `node` or `npx` on the Mac.** Wrap test runs in `zsh -lc "…"`, or they print nothing and look like a pass.
- **A worker's "all checks pass" covers only the files its brief named.** `realtime.test.ts` was not in the seam brief, and that is where the branch broke main's behaviour. List the callers' tests in the brief, not only the files it owns.
- **A port of an uncommitted file chases a moving target**: `attributes.py` changed during the AD9 run. Record its hash, and land the reference before its twin.
