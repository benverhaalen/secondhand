# Codex prompt: one price per mode from the engine, and live sold comps switched on

Written 2026-11-15 by the benchmark thread. Run from the repo root with `codex exec -s workspace-write`. Code, tests first. No backtest runs.

---

You are working in the secondhand repo. Read `AGENTS.md` and `.agents/skills/build/SKILL.md` and follow them: state done and the command that proves it, write the failing test first, take names from `spec/`, log through `log/`, keep the diff small, put a `Rests-on:` trailer on each commit. Do not edit `jobs/valuation/*.py` or anything under `app/src/app/` or `app/src/item/` (the UI thread owns those).

## Why

Ben, 09:09 ([words](product/words.md#2026-11-15-ben-pricing-modes-and-a-reason-for-every-number-backtests-wait-for-the-backend)): "our algorithm can price to sell. it can price to the market. can price other ways. shouldnt it end up showing what each of these toggles is meant to show?" and "so there is no public way to access mercari data? if its there lets use it its for a hackathon demo".

Today the app's Plan prices its three modes itself, from the valuation range: fast = range low, sell = midpoint, best = range high (`app/src/item/model.ts` `priceFor`, about line 262). The engine defines them differently: the slider marks in `app/src/engines/valuation/posture.ts` (quick 0.15, balanced 0.5, max_return 0.85, on a q20 to q85 track of sold prices, capped by live asks, retail and the floor). `spec/plans/backtest/pricing-modes.md` §4 lists this as a disagreement. The fix is that the engine returns the mode prices and the app shows them, so the toggle shows the numbers the engine acts on. The UI thread has already said it will read `valuation.pace` and will read the prices once they exist.

## Part A: `modes` in the valuation result

In `app/src/engines/valuation/check.ts`, add to the result a `modes` object with keys `fast`, `sell`, `best` (the app's names; `planOf` in `path.ts` maps fast to quick, sell to balanced, best to max_return). For each mode, per site, call posture's `pointOnSite` at `MARKS[objective]` on the same kept, adjusted comps the range uses (as `Sold` rows: price_cents = adjusted_cents, w = the comp weight, sold_at), with the person's floor and the ceiling from `ceiling()` when retail inputs exist (none today: pass empty arrays).

The D10 sale curve does not exist yet (no fitter in the repo). `pointOnSite` needs `curve.p` and `curve.t`. Make the curve optional on `SiteInput`; with no curve, `p_sale_30` and `days_t50` are `null` (widen the `Point` type). Never invent a speed. When the range state is not `ok` (too few, too wide), `modes` is `null`, for the same reason the range is hidden.

Each mode's output: `{ ask_cents, list_cents, keep_cents, p_sale_30, days_t50, held_by, site }` for the best site (highest `keep_cents`) plus `per_site` with all of them. Add the field to the API example for `POST /v1/valuations` and the item's `valuation` in `spec/examples/` only if the example check requires it; say which.

Tests first, in `check.test.ts` or `posture.test.ts`:
1. With a fixture of 30 comps, the three modes' asks are ordered fast < sell < best, and each equals `weightedPercentile` at `0.2 + 0.65 × mark` before caps (so fast is about q30, not the range low).
2. No curve gives `p_sale_30: null, days_t50: null`; with a curve they are numbers.
3. A floor above the fast ask holds fast at the floor with `held_by: 'floor'`.
4. Range state `too_few` gives `modes: null`.

## Part B: switch on live sold comps for the demo, inside Nate's source rules

Packet `.agents/team/packets/price/69-live-sold-comps-into-the-valuation.md` asks the harness side to register Mercari and Poshmark for the valuation's sold comps. Nobody has answered it, and Ben asked to use the data for the demo. Nate has already ruled how each site may be read: `app/src/edge/intel/public/sources.ts` and `spec/engines/protocol-and-adapters.md` (the source rulings it cites). Poshmark is a public page lane. Mercari is read only through the asking person's own linked account, only when the person asks, never by anonymous page fetch (commit caaf44bf, test "Mercari uses only the asking person's linked account"). Follow those rules exactly; do not add a second way to read either site.

1. Read `app/src/edge/intel/public/search.ts`, `sources.ts` and `app/src/edge/api/search.ts` to see how search already reaches each site. Make `app/src/engines/valuation/sold.ts`'s sources go through that same path with `status: 'sold'`, with the caller as `person` (a valuation the person requests is their ask) and the person's id and linked accounts, so Mercari answers only when that person has a linked Mercari account and is otherwise `blocked`/skipped with its reason logged.
2. If the existing path cannot express a sold search for a site, add the sold filter there (Poshmark: `availability=sold_out`; Mercari: `itemStatuses=2`, see each adapter's README) rather than a new route, and keep any live network read gated off by default the way the existing live sites are.
3. In both sites' search rows, keep `condition` and `size` when the site returns them (Mercari: `itemCondition.name`, `itemSize.name`; see `sites/mercari/fixtures/search-sold.json`). `sold.ts` already maps a stated condition. Update its test to use them.
4. Do not change Depop. Never use Ben's or anyone's personal account outside the asking person's own request.

Tests: existing search, adapter and sold tests still pass; a new test shows a valuation for a person with no linked Mercari account reads no Mercari rows and logs why; one with a linked account (fake vault) gets product-level comps from the recorded fixture; with live sites off, no network call is made.

## Finish

- Run `node --test` on every test file you touched, then `node .agents/check.mjs`. Report failures in files you did not touch without fixing them.
- Append to packet 69 under a dated heading: what you registered, what is still owed (sale dates; Mercari if not done), and that the benchmark thread did it on Ben's 09:09 words because the packet had no answer.
- Commit Part A and Part B separately, explicit paths only, `type(scope): plain words` messages with `Rests-on:` trailers. Pull with `--no-rebase` and push to main. Never force-push.
- Print: commits, test commands and results, and anything you could not do.
