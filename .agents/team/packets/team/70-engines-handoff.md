# 70: the engines handoff

Updated: November 15, 2026, about 16:00 Central. Owner: Nate. Agent: Claude Code, the engines lead, ending at a clean stop at Nate's word ([packet 55](55-team-leads-and-mac-workers.md), "A session ends before it fills"). Read this, [the queue](../../../../spec/plans/engines-queue.md), and the engines rows of [the board](../../../../spec/plans/board.md) before touching `app/src/engines/` or `jobs/` engine twins.

## What is true on main, per engine

Each line names a commit on `main` and the command that proves it. Run the TypeScript one test file at a time (`node --test --test-concurrency=1 <file>`), and the Python with `./.venv/bin/python -m pytest <path> -q`.

| Engine | Commit | What holds | Proof |
|---|---|---|---|
| money and negotiation | 1d59b81, d14a7362, e90038f9 | Impossible offer states refused before a choice; no auto-accept under the posture line; a negative keep asks instead of crashing; whole cents; the ending rule's Python twin on 15 shared cases; zero and tiny priors learn | `app/src/engines/negotiation/choose.test.ts`, `money/ending.parity.test.ts`, `jobs/negotiation` |
| param registry | 32b38de, 91df3a93 | One 30-day half-life in both stores. Forgetting decays the evidence, also at read. An explicit clock decays the whole posterior, so a route recovers. Gamma and model updates go through `apply()`. One canonical scope key. A guard clamps the read value instead of dropping the data. Rollback goes to the newest `origin: fit` row. Python twin on 17+ shared cases | `app/src/engines/param/parity.test.ts`, `jobs/param` |
| proof and claim check | 764e1b1, f918f8ac, 2889bab8 | A citation id hashes its whole identity. A number shows through a named `basis_level` with notes and hides only with no level. The gate holds a claim that negates or contradicts the facts | `app/src/engines/proof/proof.test.ts`, `app/src/edge/gate/claims.test.ts` (20 drafts: 10 planted false, all held) |
| trust | 610edcec, 65070b33 | Cents throughout; one clipped sigmoid in both languages; `gtin14` verifies the check digit | `app/src/engines/trust/calibration.parity.test.ts`, `gtin.parity.test.ts` |
| marketing, listing, score | 31963596 | The likers offer keeps at least keep(floor). Poshmark share, like and repost are suggestions only. Valuation's `ladder()` is reused. Plans are made at a named basis level instead of skipping. Readiness comes from capture's `missingFor` | `app/src/engines/marketing/calc.test.ts`, `listing/build.test.ts` |
| demand, identity, style, analytics | 8f5fe7d, 51efbcc5, e4140183, efc3759a | Each audit section fixed, R6 rows deferred. Identity reads trust's GTIN fixture. One D12 site rule shared with TypeScript | `jobs/demand`, `jobs/identity`, `jobs/style`, `jobs/analytics` |
| valuation | fe4e2bf (twin), 5138245 and e76bfcef (spec) | `jobs/valuation/comps.py` equals `comps.ts` on 18 shared cases. The spec states the fallback order, the blend and one hide rule | `app/src/engines/valuation/comps.parity.test.ts`, `jobs/valuation/test_comps_parity.py` |
| NBER data | 3dd4caa5 | The reader parses `22oct2012` dates, never writes seller or buyer ids, checks the codebook, maps every eBay category, and sits on main's `freeze.py --share` | `jobs/valuation/data` |

The type check: `cd app && npx tsc --noEmit -p .` shows 2 errors at the stop. One is `app/src/edge/intel/learn.test.ts`, outside the engines. The other is `app/src/engines/trust/audit.test.ts`, in the queue.

## Found at the stop, not yet fixed

The trust page was redrafted from the code ([spec/engines/trust.md](../../../../spec/engines/trust.md), marked as an unreviewed draft). Its two most consequential findings:
- In the running product, trust decides nothing. The port is a stub, `trust: async () => ({ action: 'none' })` at `app/src/edge/api/conversations.ts:83`, and only `evaluateHard` and `gtin14` are reached (`app/src/edge/messages/messages.ts:79`, `:117`).
- A malformed extractor reply throws out of `decideThread` (`app/src/engines/trust/decide.ts:96` via `signals.ts:24-28`) instead of abstaining.

So `product/features-proof.md` item 17's "Proof now: built" overstates what the product does. The draft lists 16 such defects (D1 to D16) with their fixes and tests.

## The backtest, as measured

A development reading, not for a public page or the pitch until Nate and Ben have both seen it. `dataset:stockx_2019`, new deadstock sneakers (Yeezy 350 and Off-White Nike), sales of 2018-11-01 to 2019-02-13, 41,988 test sales, every contestant on the same items, run 2026-11-15 on the Mac in 226 s, code at 4f5bf19 (on branch `w/eng-valuation-1`, not yet on main).

| Contestant | Priced | Median error | Within 20% | Range holds | Width |
|---|---|---|---|---|---|
| engine_comps_conformal (served, calibrated) | 99.2% | 6.25% | 87.1% | 84.3% (Wilson 84.0 to 84.7) | 27.2% |
| engine_comps (served, raw range) | 99.2% | 6.25% | 87.1% | 58.5% | 16.1% |
| last sale | 98.7% | 3.25% | 97.4% | 5.4% | 0 |
| product 90-day median | 98.5% | 5.76% | 89.1% | 59.2% | 16.9% |
| market model, product-anchored (bbe0967) | 94.6% | 3.29% | 98.5% | 78.3% | 13.6% |

What it says: the conformal step closed the range fault (58.5% to 84.3% against 80). The served engine's middle loses to last sale and to the 90-day median. `eng-valuation-2` is the fix, judged by an ablation on these same items.

## The audit, closed over found

[spec/engines/audit.md](../../../../spec/engines/audit.md) found 384 defects. By the merged workers' own reports, 208 are closed: demand 32 of 35, identity 20 of 24, marketing 18 of 21, negotiation 27 of 32, param 16 of 16, analytics 28 of 30, proof 6 of 6, recommendation and style 31 of 35, score 6 of 7, trust 19 of 28, valuation 5 of 111. Open: valuation 106 (54 of them tunables written as literals in `comps.ts` DEFAULTS), intel 19, person 20, and each engine's deferred R6 rows. These counts come from worker reports, not a row-by-row check against the code. The spec pass checks each row against the code and puts the open ones on their pages.

## Open branches and worktrees on the Mac (`~/dev/projects/secondhand-wt/`)

| Worktree, branch | Holds | Passed? | Waits on |
|---|---|---|---|
| `eng-rt-neg-1`, `w/eng-rt-neg-1` (9cf9268e) | Answered offers update `P_accept` through `store.apply`, and the next counter uses it; a twin of `fit.online_update` on 8 dated sequences | Passed on its base. After merging main, `learn.test.ts` fails: "P_accept has no earlier promoted fitted version". The registry's rollback restores only `origin: fit` rows, and the test's first champion is an event row | Queue item 4 |
| `eng-rt-sale-1`, `w/eng-rt-sale-1` (8be27a4d) | A sold comp moves demand velocity (a gamma whose quantiles equal scipy on 14 cases); 30 misses widen the valuation's Q_g; a view rate under the band moves the stale step | `realtime.test.ts` passes after merging main. `demand/velocity.test.ts` and `marketing/interest.test.ts` fail, most likely on the registry's later forgetting rules (evidence-only decay, explicit clocks). Not diagnosed | A worker round to diagnose the two tests; do not change their fixtures to pass |
| `eng-valuation-1`, `w/eng-valuation-1` | Round two (4f5bf19): a calibration window, scale-free conformal, `--estimates`, Ben's metric names, the family and seasonal baselines, the survivorship meter, the duel's request ids. Round three, running at the stop: `fit.py` reads `market.comp_for_model` and `core.param`, the §4 switch rule, and resolving the merge with Ben's money statistic (9fd5c2e) | Round two passed (40 tests). Round three is committed and merged with main on the branch (1684e91f). It passed its own checks against its base. After merging main, `jobs/valuation/test_fit.py` has one failure (`test_registry_records_fol…`), most likely because the registry's new `origin` column (91df3a93, `app/src/engines/param/0001_param_origin.sql`) is missing from `fit.py`'s canonical column list. `test_experiment.py`, `test_backtest.py`, `test_market.py`, the parity tests and the self-test pass | One round: add `origin: 'fit'` to the rows `fit.py` writes and to its schema, then rerun `jobs/valuation` and merge. Until then the runner and the StockX table above live on this branch, not on main |
| `eng-valuation-2`, `w/eng-valuation-2` | The anchored middle, a per-family D3 index, fitted size ratios, the half-life per family, the fallback blend, one unit per item, and log-scale Q_g in `check.ts`, each switchable, with `jobs/valuation/ablate.py` | Running at the stop (`gpt-6-astra`, high) | Judge it by its ablation table: the all-on engine must beat last sale and the 90-day median on the same items, or say which change bought what. Merge only if it passes and `tsc` is clean for its files |

Every other worktree of mine (`eng-audit-1`, `moneyfix`, `eng-param-1`, `eng-proof-1`, `eng-gate-1`, `eng-trust-1`, `eng-neg-1`, `eng-mkt-1`, `eng-demand-1`, `eng-identity-1`, `eng-style-1`, `eng-analytics-1`, `eng-data-1`) is merged and can be removed. Rows on the Mac: `~/secondhand-data/sold/stockx_2019/` and `~/secondhand-data/raw/nber/` (NBER's file: sha256 `ceda1275…a646`, 4,451,661,738 bytes). None of it is in git.

## The queue

In order, with the files each owns and a done check per item: [spec/plans/engines-queue.md](../../../../spec/plans/engines-queue.md). Nate's phase rule ([packet 55](55-team-leads-and-mac-workers.md), "The spec pass") means each item goes onto its spec page as a named fix before it is built.

## Decisions made, and why

- **The backtest is ours.** Nate: "we own backtests and such", and "lets backtest as we build to evaluate and improve". Ben's thread sends valuation changes through the orchestrator ([packet 68](../price/68-valuation-files-are-being-rebuilt.md)). Its NBER fixed-share sample with strata, the locked window, the ledger, the money bounds and the product-anchored model are kept. Nothing goes on a public page or the pitch until Nate and Ben have both seen it.
- **Published numbers rest on released data and people's own sales.** The sites' sold pages are not harvested in bulk for a test set ([sold-datasets.md](../../../../research/price/ben/sold-datasets.md): Poshmark §4(b), eBay §3 and §10). An eBay sold row read for a person enters the duel only when frozen before the sale and tied to that person's request.
- **The fallback order.** A price is always given, with its level named and the levels blended; a bar decides only whether the system acts without asking ([valuation §3](../../../../spec/engines/valuation.md#3-the-calculation), Nate's words linked there).
- **The posture's accept line.** Under it, at any posture above 0, the champion counters where D16 rule 2 alone would accept. That is the slider's design. It is with Nate as a product behaviour.
- **A vanished listing is never a sale in a price.** It enters only the D10 hazard as a fractional sale learned on sites that show sold marks, and is held at 0 on Facebook ([money.md](../../../../spec/determinations/money.md), "What its parameters learn from").

## What waits on Nate

- One signed-in marketplace session through the cloud browser, so valuation can price a real item from live sold comps (eBay's sold page under his own sign-in), and one dry run of negotiation, trust and marketing on one real listing.
- Whether third-party eBay sold feeds may be used (the orchestrator has it).
- Whether the posture-line behaviour above stays.

## What this session learned the hard way

- **A fixture clamped to make an invariant pass hides the bug it would have caught.** Three negotiation fixtures had keep clamped at 0, which hid a crash on every lowball offer. Every brief now says a test input is never changed to make an invariant pass.
- **Two threads in one folder collide.** Ben's thread and this lead both rebuilt `jobs/valuation/experiment.py` and `jobs/valuation/data/` the same morning: two merges conflicted and one approach (a 30-sale cut) was thrown away for a better one. Check the folder's recent commits by other authors before briefing, and say in the packet who owns it.
- **Never leave a merge open in the shared checkout.** One conflicted merge sat in `C:\dev\secondhand` for minutes and blocked every session's pull. Merge `origin/main` into the worker branch on the Mac, test there, and bring a clean merge to Windows.
- **A hash taken mid-download is wrong.** The NBER pin was first recorded at 1.5 GB of 4.45. Wait for the download to finish before pinning.
- **`node --test` does not type-check.** 31 `tsc` errors reached main before any brief asked for `tsc`. Every brief now ends with tsc clean for the worker's own files.
- **A worker may write its report inside a subfolder.** Look for `WORKER_REPORT.md` anywhere in the worktree, not only at its root.
