# 70: the engines handoff

Updated: November 15, 2026, morning Central (second engines lead, stopping at about half its context, [packet 55](55-team-leads-and-mac-workers.md) "A session ends before it fills"). Owner: Nate. Read this, [the queue](../../../../spec/plans/engines-queue.md), [packet 55](55-team-leads-and-mac-workers.md) and the engine's spec page before touching `app/src/engines/` or the `jobs/` engine twins. Judging is at 1 PM Central today: land, do not widen.

## What is true on main, with the commit and the proof

Run TypeScript one file at a time (`node --test --test-concurrency=1 <file>`), Python with `./.venv/bin/python -m pytest <file> -q` on the Mac (on Windows, `python`; the tests now fall back to it when `.venv` is absent).

| Piece | Commit | What holds | Proof |
|---|---|---|---|
| Check fixes | 06897952, 5fda9dd7 | param parity B1 finds Python without `.venv`; trust `audit.test.ts` tsc error gone; `marketing/calc.ts` names `HOURS_A_DAY`, so `spec/sites.test.mjs` passes | `app/src/engines/param/parity.test.ts` 57/57; `spec/sites.test.mjs` 9/9 |
| Negotiation learns in real time | b565ba90 (`w/eng-rt-neg-1`) | an answered offer moves `P_accept` through `store.apply` in the same transaction and the next counter uses it; the TypeScript update guards each term as `fit.py bounds()` does on main (092a987b), so a tiny prior learns; parity fixture's expected values regenerated from Python, inputs byte-identical | `negotiation/learn.test.ts` 10, `learn.parity.test.ts`, `jobs/negotiation/test_learn_parity.py` 9 |
| Registry rollback | b565ba90 | rolling back a fitted promotion restores the champion it replaced, whatever its origin (canon "Roll back", `spec/product.md:554`), in memory, SQL and Python; SQL restores an existing version in place; an event champion still walks back to the newest fit | `param/param.test.ts` 41, `sql.test.ts` 37, `parity.test.ts` 63, `jobs/param/test_param.py` 91 |
| Real-time sale, comp and view weights | 1f5a70da (`w/eng-rt-sale-1`) | a sold comp moves demand velocity (Gamma, quantiles equal SciPy on 15 cases); a sale on our listing moves valuation's `Q_g` by ACI (`valuation/aci.ts`, log-ratio scores, a group keeps its own scores at D6's 30 and pools below); views move the view rate; seeds and decay in the registry's evidence space (the prior counted once); reads decay without writing | `engines/realtime.test.ts` 4, `demand/velocity.test.ts` 14, `velocity.parity.test.ts` 15, `marketing/interest.test.ts` 13, `valuation/aci.test.ts` 13 |
| Trust decides safely | 4f01e379 (`w/eng-trust-2`) | D2, D5 and its no-show sibling, D11, D13, D17 fixed ([trust.md](../../../../spec/engines/trust.md) state block); runs on code signals with no extractor; `T/action.ts` `messageAction` maps card 5 step 4 | `trust/wired.test.ts` 65 and every `trust/*.test.ts`, `jobs/trust/test_*.py` |
| Specs | 62d9b9f4, ed5141df | the audit's open rows checked against the code and placed on each engine page (NG-, MK-, SC-, DM-, RS-, PA-, IN-, and Person and Param in `spec/engines/README.md`); trust page reviewed fresh (D1's fix and test corrected, D17 added, recall ahead of labels); valuation §9 holds the ablation | the pages |

Full `node .agents/check.mjs` on Windows at the last push: failing only outside engines (`.agents/skills/image-gen/run.test.mjs` 8 tests, the copy-lint fixture test "ui: raw colors…", and integration's HTTP log test that a0121f60 fixed).

## The valuation measurement (development reading; not for a public page or the pitch until Nate and Ben have both seen it)

`dataset:stockx_2019`, 41,988 test sales 2018-11-01 to 2019-02-13, all basis levels pooled, same items for every contestant. All-on engine (`w/eng-valuation-2`): median error **3.89%** (was 6.25%), within 20% **96.0%** (was 87.1%), priced 100%, conformal range holds 86.0% (Wilson 85.6 to 86.3) at width 22.7%. Last sale 3.25% / 97.4%; 90-day median 5.76% / 89.1%. It beats the 90-day median (+7.4 points, 5.7 to 9.0) and trails last sale by 1.0 point (−1.4 to −0.7), so the answer carries last sale beside the range (C1). The anchor bought most of it, the per-family half-life next. Full table and named fixes V-AB1 (over-coverage) and V-AB2 (the last point): [valuation.md §9](../../../../spec/engines/valuation.md).

## Open branches on the Mac (`~/dev/projects/secondhand-wt/`)

| Worktree, branch | Holds | State | Next |
|---|---|---|---|
| `eng-valuation-2`, `w/eng-valuation-2` | committed 5e1d3874: the ablated engine A to G with `params.ts`, the Python twin `jobs/valuation/comps.py`, `ablate.py`, merged with main (Ben's `modes` kept, `curve` optional), realtime-proof link 1's level now `product` with `completion.md` | all its tests, `valuations.test.ts`, `item/model.test.ts`, the proof 13/13 and tsc pass. Fresh Opus review: **merge after fixes 1 and 2**. (1) `checked` ignores `local.state`, so a `too_few` basis can read checked, and no too_few note reaches the range or per_site: this is step 6 of the seam brief now running; verify it there. (2) `Q_g` is a log ratio now: money.md D5 step 2 and D6 step 1 amended to match (this stop's last commit); confirm no producer sends cents. Lower, for the next round: the optional curve's meaning changed (p_sale and path now need `curve_evidence` n ≥ 30, which is Ben's d495553c territory: ask him or keep main's meaning for p_sale); size ratios use the family's weekly median, not same-product pairs (§4); learned params lack the ±50% guard; widened q10 and q90 are not rounded to whole dollars (D5 step 6); the NWT cap is not passed into `modes`; `w_match` rescale ignores the category param; two tests do not exercise what they name; `ablate.py:279` clamps the first test month's as_of to `test_from` | merge `5e1d3874` to main if the review passes, by commit id (the branch tip moves once the seam work is committed on it). Uncommitted in the same worktree: the `valuate` seam worker (send its merge commit to the next integration lead, or to the orchestrator if none has started; integration's trust wiring is packet 69 §3 item 5b) (gpt-6-astra, brief `/tmp/brief-eng-valuation-2-valuate.txt`), see the queue item 1 |
| `eng-valuation-1`, `w/eng-valuation-1` | round two and three of the runner (calibration window, scale-free conformal, baselines, survivorship, duel request ids, the §4 switch rule in `fit.py`), `core.param` gains `origin`, `previous_version`, `keep`, `days_since_last` in `databricks/sql/01_tables.sql` (5262fedf; the orchestrator gave engines those four lines; send the Databricks lead the merge commit) | a fresh review found two blocking faults: the refit overwrites the champion's row (rollback lost), and `conformal_q` drops the test point's mass with a weakened test; round four (brief `/tmp/brief-eng-valuation-1-r4.txt`) fixes those plus the oracle baseline charge, ACI bounds as params, literals, integer-cent baselines | read its report, rerun `pytest jobs/valuation`, review the delta, then merge. Its `comps.py`, `comps.parity.test.ts`, `test_comps_parity.py` and `fixtures/comps-parity.json` collide with `eng-valuation-2`'s at the same paths: take `eng-valuation-2`'s (it mirrors the engine that will be on main) when merging main into this branch |

Merged and removable: `eng-rt-neg-1`, `eng-rt-sale-1`, `eng-trust-2`, and every older worktree listed in the previous version of this packet.

## Decisions made, and why

- **Rollback of a fitted promotion restores the champion it replaced** (canon `spec/product.md:554`); an event champion still goes to the newest fit. Rolling back a bad nightly must not throw away the real-time evidence learned since.
- **The negotiation guard is the Python rule on main** (max of ±50% of the prior and half the logit span), so a tiny prior learns; [negotiation.md §4](../../../../spec/engines/negotiation.md) states it.
- **ACI and conformal scores are log ratios** (scale-free). D6's additive form is to be amended on [money.md](../../../../spec/determinations/money.md) (not done).
- **eng-valuation-2 merges** though it trails last sale: it says which change bought what, beats the old engine on every column and the 90-day median; C1 carries last sale beside the range.
- **Trust with no extractor runs on code signals** and logs it; it never asks on every message. Malformed money and calibration rows still throw: validation at a trust boundary.
- **A partial fitted trust weights row is valid**: each missing name uses its prior.
- **A worker's fixture is regenerated only from the reference language with inputs byte-checked unchanged**, when the reference itself was fixed on main; never to make a test pass.

## What this session learned the hard way

- **My own brief can be wrong.** Twice a worker stopped on a conflict the brief created (rejecting partial fitted rows; a gift-card "ask" that is a hard block). Read the existing tests before writing a rule into a brief.
- **Windows breaks Mac-only tests silently**: `./.venv/bin/python` and `/dev/stdin` hard-coded in tests. Fall back to `python`, write a temp file.
- **Two branches creating the same new files collide later**: both valuation branches made `jobs/valuation/comps.py` and the parity files. Decide which twin survives before briefing the second.
- **A long ablation blocks its worktree**: 40 minutes on 41,988 sales; brief follow-ups into other worktrees meanwhile.
