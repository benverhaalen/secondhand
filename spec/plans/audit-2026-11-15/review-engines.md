# Engines and buying conversation: expert review (main 7b2b8da6, read-only)

Method: read the code named in the brief, traced the served path, dry-merged both parked branches (`git merge-tree --write-tree`, exit 0, no CONFLICT lines on either), exported their trees to the scratchpad. No tests were run and no model or vendor was called. Nothing in the repo was written. Unread or only skimmed: engines/trust/*, engines/score/*, negotiation/choose, intel/learn.ts, intel/classify.ts, api/scores.ts, spec/engines/*.md and spec/determinations/ (checked only where a finding needed a spec anchor), per-id A1-A10, AD*, MI3-6, C1-C6, valuation-2's comps.ts diff, and ad9-1's attributes.ts and similar.ts beyond their headers. Nothing below speaks for those.

Verdict on main: the pure arithmetic is mostly sound; the served path is not connected to it. The worst problems are joins and two calibration bugs, not the quantile maths.

## 1. Bugs in arithmetic and logic (ranked by consequence)

### S1. A person's own item cannot be priced: the route prices the fixture, and drops any live comp newer than the fixture date
- `app/src/edge/api/valuations.ts:14` `if (ctx.body.url) return null;` and `:15` reads `example('items.get')`. The product is the spec example whatever id arrives (only `it_7c2m` is accepted).
- `valuations.ts:21` `as_of: range.as_of`. This is the fixture's date, not now. `engines/valuation/comps.ts:95` `if (!Number.isFinite(age_days) || age_days < 0 || age_days > params.max_age_days) continue;` drops every row dated after `as_of` with no note. So when `SECONDHAND_LIVE_SITES` names a site and sold rows newer than the fixture date arrive, they vanish silently and the range falls back to nothing or to the fast fixture.
- `valuations.ts:22-23` hardcodes `floor_cents: 0, objective: 'balanced', param_version: 1, warm_comps: []`, and sites `mercari` and `poshmark`. It passes no calibration, curve, `site_ratios` or sale `as_of`.
- `valuations.ts:36` labels any failure `site_failed`, so an engine fault reads as a vendor fault.
- Smallest fix: `as_of: ctx.now()`, resolve the item from the person's capture or want (product id and condition from the body), and pass real registry values. Detail in section 2.

### S2. Calibration widening is wrong for any asymmetric range (and can push q10 negative)
- `engines/valuation/aci.ts:131` `const cents = Math.round(Math.max(issued.q10 * -Math.expm1(-Q), issued.q90 * Math.expm1(Q)));` then `check.ts:52-55` subtracts and adds that one value on both sides.
- Scenario: q10 = $20, q90 = $60, Q = 0.3 (log ratio). The log form says q10 becomes 20/e^0.3 = $14.82 (widening $5.18) and q90 becomes $80.99. The code computes max(20*0.259, 60*0.350) = $21.0 and applies it to both sides, so q10 = -$1.0, clamped to 0 or garbage. The low edge is far wider than the calibration measured. The stated "share shown" no longer describes the range.
- Fix: carry Q (log ratio) in `CheckInput.calibration` and compute `q10 / Math.exp(Q)` and `q90 * Math.exp(Q)`. `mac/w/eng-valuation-2` already does this (`finalRange`).

### S3. 'checked' is unreachable, and no coverage is measured anywhere
- `aci.ts:133` `return { Q_g: cents, group: scopeKey(group), coverage: 0, passes: false, ... }` is hard-coded. `check.ts:51` `x.calibration?.passes && coverage >= .75 && coverage <= .85` can never be true through `calibrationForCheck`, so the range state is always `not_checked_yet`. That agrees with what the lead observed, and it is correct for today's data, but the code has no path to ever say 'checked' because nothing computes coverage or `n`.
- Smallest fix: from the score history (the err flag per observation), return `n`, `hits`, `coverage = hits/n` and `passes` from them. valuation-2's check needs `n >= 30` and Wilson lower >= .7, so it needs `n` and `hits` from `calibrationForCheck`, which main does not return.

### S4. Forgetting breaks the conformal rank
- `aci.ts:117` `Math.min(1, Math.ceil((mass + 1) * (1 - alpha)) / mass)`: the finite-sample rank uses the undecayed `mass`, but the cumulative it indexes into uses decayed weights. After forgetting, the requested quantile is too high and saturates at 1, which returns the single largest score. The range gets wider than needed after the group has been quiet.
- Fix: use `sum(decayed weights)` for `mass` in both the rank and the divisor.

### S5. A sale on a cheap item loses its learning event
- `comps.ts:248` `Math.round(translate(value, factor) / 100) * 100` rounds each quantile to whole dollars. For a $4 item q10 can round to 0. `aci.ts:56` `range()` then throws on `issued.q10 === 0`, so `onOurSale` drops the observation. Cheap items never calibrate. Fix: round to cents, or round up q10 to at least 100 and record the unrounded value for scoring.

### S6. The proof says more than the evidence
- `engines/proof/proof.ts:115` `answer()` defaults `basis_level` to `'variant'`. `check.ts:47-50` passes none, while the sold source (`engines/valuation/sold.ts`) produces only `product` or `family`. The served citation therefore claims a variant match that never happened.
- `check.ts` never calls `guard`/`guardWith`, so `proof_min_n_eff` (6) and `proof_max_age_days` (14) are never applied. The too_few and stale notes never appear. This is why realtime-proof link 1 is wrong. valuation-2 emits both notes.
- `check.ts:48` the citation filters carry only `{product_id}` (not condition, site, floor or objective), so two different asks cite the same filter. `memoryProof` is the only proof store, so a citation id resolves to no stored rows after the request. `tools.ts` `value_item` hands that id out as `citation_ids`. This breaks the ruling "no figure without the rows it rests on" for any answer built from it.
- `proof.ts:111` returns `no_basis` if any row is dated after `now`; `sha256.ts` is hand-rolled and was not checked against a known vector in this review (it should be, in one test).

### S7. The visibility gate and the shown money can disagree
- `edge/assist/tools.ts:277-289`: the money comes from `check({...})`, then `visible` comes from a second `comparables(...)` call on separately mapped comps (`found.state === 'ok'`). `check` also applies site translation; the second call does not. A range can be shown while the gate says not visible, or the reverse. Fix: expose `check`'s own `found.state` and use it.

### S8. Fee and keep
- `engines/valuation/keep.ts`: `TAX_RATE = 0.07` is an unsourced placeholder that enters the fee base for eBay, Depop and Facebook. Every keep figure for those sites carries it silently. Source it per site or leave it out and say so.
- `fees_may_have_changed` is computed only from `sale.as_of`; `check.ts:77-79` passes no sale `as_of`, so the stale-fee flag never fires.
- Cents arithmetic is integer, and `priceForKeep` inverts it. I found no cents-versus-log mixup inside keep.ts itself.

### S9. Smaller logic gaps (each with a fix)
- `posture.ts:57` `ask / (1 - t * s.offer_discount)` has no guard; an offer_discount of 1 at t = 1 divides by zero. Clamp the product below 1.
- `posture.ts:77` `ticks` divides by `total` (NaN at 0); `path.ts` `weightedPercentile` has no empty-input guard.
- `comps.ts` trim: the median/MAD outlier cut ignores weights, so a heavy recent row can be cut by a pile of stale ones. D5 uses discrete weighted quantiles with no interpolation: at n_eff near 6, q10 and q90 are the min and max row. Say so in the state or widen with the calibration.
- `comps.ts:235` the adjustment-penalty `w / (1 + gross / cut)` is smooth; the hard cut `log(1.25)` and this penalty overlap. Fine, but document it.
- `engines/valuation/sold.ts:33-38`: `at = isoDate(r.sold_at) ?? isoDate(r.listed_at)`. A listing date stands in for a sale date and is treated as a sale age. A float price (`1999.5`) drops the row silently. Match is by title words only.
- `valuation/check.ts:59` `ceiling([], [], x.as_of)`, `:64` `top: [], offer_discount: 0`, `:87` `cancel_cost: 0`, and empty `site_ratios`: all dead on the served path. D4 (site translation) never fires.
- `intel/gather.ts:47` `measure` sums age weights as n_eff (not Kish) and counts listing rows with a price. A site with 30 asking rows can stop the gather as "enough". `:91` a throwing step is recorded with `cents: 0`; `:84` step 6 is always skipped. valuation-2's `valuate` uses Kish `basisOf`.
- `negotiation/policy.ts:85` `maxPay` returns null unless `x.qualified && x.valuation_shown && !x.recall && min(p) >= pv.negotiation_buy_min_probability`. The gate trusts caller-supplied booleans, not the valuation's guard state. `:87` `p_identity * p_condition * p_authentic * keep_p25` is a plug-in product with no calibration on the three probabilities. `switchPolicy:46` takes `calibration_error` from the caller. None are called in a served path.
- `param/param.ts`: no arithmetic fault found in versions, `expectVersion`, held-out margin, rollback or the 30-day forgetting. Limits: only `memoryStore` exists, so versions and forgetting reset on restart, and nothing in the served path reads the registry (valuation-2's `resolve` is the first caller). `withPrior` algebra was not traced.

## 2. Shortest ordered path: "a person's own item, priced from sold comps the system read, a range that says how sure it is, an answer that cites its rows"

Order matters; each join is one function pair.

1. Merge `mac/w/eng-valuation-2` (clean dry merge). It brings `valuate()` (`engines/valuation/valuate.ts`), `resolve()` (`params.ts`), the log-ratio calibration, too_few/stale notes, `basis_level`, the deadline snapshot and `curveOK`. Run the gate on the merged tree first.
2. Item identity: `api/valuations.ts` handler -> the person's item record (`captures`/`wants` read, product id and condition). Replace `example('items.get')` at `valuations.ts:15` and the `reference(..., ['it_7c2m'])` check at `:27-28`.
3. Time: `valuations.ts:21` `as_of: ctx.now()` (S1).
4. Read comps: `valuations.ts` -> `valuate(item, ctx)` (valuate.ts) with `ObservationPort.read`. Remove the inline `check` at `:33`.
5. Sold rows in: `edge/api/valuation-sold.ts` (`SOURCES`, live-site gate) -> `engines/valuation/sold.ts` `soldRows`, with `SECONDHAND_LIVE_SITES` set. Today a site outside the set gives `blocked`.
6. Link 5 (write what a search read as stored observations): implement `ObservationPort.write` (valuate.ts defines the port, no implementation) in `edge/intel/` over the observations table, then call it from `intel/gather.ts` step 5. Realtime-proof link 5 is "not built" because this port has no implementation.
7. Gather when thin: `valuate` returns `gather: GatherNeed | null` -> `intel/gather.ts` `steps`. Call it from the route (or a job) when `reason` is `too_few`, `stale` or `source_gap`, then re-run `valuate`. Fix `measure` to Kish n_eff (gather.ts:47).
8. Calibration: `valuation/aci.ts` `calibrationForCheck` returns `{n, hits, coverage}` (S3); `valuate`/`check` reads it; `onOurSale` called from the sale-recording path (orders) so scores accrue.
9. Registry: a durable `ParamStore` (the db `param_rows` table) behind `param.ts`'s interface, then `resolve(store, scope)` in `valuate` (replace the hardcoded `param_version: 1`).
10. Cite rows: `proof.ts` store: persist `basisHash` rows so `GET /v1/citations/[id]` resolves them (`app/src/app/v1/citations/[id]`). Replace `memoryProof` with a db-backed store; pass `basis_level` from the actual match level (S6).
11. Conversation: `tools.ts` `soldTool` -> `valuate` instead of its own `check` call (S7). Then `defaultDeps` with `caller: 'person'`.

Everything up to step 4 gives a priced own-item with an honest `not_checked_yet`; steps 8-9 earn 'checked'.

## 3. The buying conversation (`edge/assist/converse.ts`, `tools.ts`, `types.ts`, `bench/assist/`)

### Safety with untrusted model output
- Tool input: validated twice (strict JSON schema, `strict: true`, then hand-written `validate()` at `tools.ts:110-126`). `use.name as ToolName` in converse is an unchecked cast but `runTool` re-validates (`tools.ts:374-395`) and wraps everything in try/catch returning a generic `${tool}: port failed`. Good.
- SQL (`market_store`, `tools.ts:325-372`): allow-listed function names, parameterised statements, bearer token held in a closure, 10 s wait; Genie is reachable only for `caller: 'person'` with a 30 s deadline. Good. Apify is excluded from `search_market` (`tools.ts:40`), matching the ruling.
- Loop bound: `maxRounds = o.max_rounds ?? 6` plus an abort signal and a per-tool `deadline()` joined to the parent signal (`tools.ts:138-154`). Bound is real.
- Cost bound: absent. `max_tokens: 16000` per round x up to 6 rounds; `Promise.all(uses.map(...))` is uncapped per round; `web_search` (`converse.ts:217`, `max_uses: 3`) is always on; `thinking: {type: 'adaptive'}`; `effort` accepts `'high'` against the ruling of low or medium. `cost_usd` is recorded and never compared to anything. Fix: a per-answer ceiling checked before each round, a cap of ~4 parallel tool uses, and `effort` limited to `'low' | 'medium'`.
- Unverified numbers can be seen: streamed `assist.text` deltas go out before the number-gate (`checkedDraft`) runs on the final message. A person can read a figure the gate then cuts. Fix: buffer text until the gate runs, or stream only after it.
- The number-gate matches by value presence, not by row or citation: a number the model took from the web counts as a fact if it equals any returned value, and standalone integers 1900-2100 are excluded. It cannot tell a measured price from a coincidence. Fix: require each money figure to match a returned row's `citation_id`.
- Failure message: `answer.reason = safeError(error, o).message` carries a raw SDK message to the person, and the `assist.settled` event carries the whole answer including tool inputs. Fix: a fixed person-facing sentence; keep the detail in the log.

### Real or fixture?
Real wiring, not fixtures: five tools (`search_market`, `value_item`, `price_trend`, `where_to_list`, `market_store`) over real ports. But three are dead in practice today:
- `defaultDeps` sets `caller: 'visitor'` (`tools.ts:74`), so `soldTool` returns `not_connected` (`:247`) until the caller is `'person'`.
- `where_to_list` passes `p_sale_d7/d30/d90: null, days_t50: null` and `rests_on: 'fees only; no sale curve'`; it ranks on keep alone (honestly labelled).
- `price_trend` calls `answer(null, ...)` with no `band90`, so it can never claim a direction. Its bench questions (`price-trend-2`, `-4`) require a trend result and will report inability.
- `value_item` inherits S1, S6 and S7.

### The evaluation set (`bench/assist/`)
- 25 questions in 8 categories; one run per question; no history; no runs recorded. It measures: settled, tool choice (all/any/none), refusal by regex, thin-evidence phrasing by regex, widget-to-result compatibility, gate count reported, and, with `--judge`, Haiku 5.5 low-effort judgement of `must` and `must_not` lines with a quoted evidence line each. Wilson interval is for the share of perfect questions; the effort choice uses a paired bootstrap.
- It does not measure: whether any figure equals a stored row (the gate's own check), cost caps, prompt-injection from listing text, multi-turn behaviour, or any live run. The refusal and thin-evidence checks can be satisfied by regex without the right behaviour. n = 25 cannot separate low from medium unless the gap is large; the README says as much.
- Blocker found: `bench/assist/run.mjs:49` calls `converse({text, image, client, model, effort, tools: TOOL_DEFS, runTool, deps: defaultDeps})`, but `converse.ts:28-41` defines `ConverseOptions` with `tools: ToolPort` (`{defs, run}`), no `runTool` or `deps`, image as `{media_type, data_base64}` (the runner builds `{type: 'base64', media_type, data}`), and requires `now`, `log` and `signal`. A live run cannot work as written. The README's "live integration unverified; modules absent" is out of date and understates it: the modules are present and the shapes disagree. The offline tests use a stand-in that matches the runner, so they hide it.

### What joining to POST /v1/assist takes
`app/src/edge/api/assist.ts` is 23 lines: its `intel` port returns empty facts, its `llm` port throws `'no stored writer answer'`; `converse` is not imported; only `text` is used (`surface`, `item_id`, `want_id`, `capture_id` are validated and ignored). To join:
1. `clientFromEnv(env)` (converse.ts) at startup; return a fixed reply when null.
2. `defaultDeps(env, fetch, log)` with `caller` set from the session (`'person'` only when signed in), and a `ToolPort {defs: TOOL_DEFS, run: (n, i, s) => runTool(n, i, deps, s)}`.
3. Replace the `assist()` call at `api/assist.ts:15` with `converse({text, image, history, effort, model, client, tools, onEvent, now, log, signal})`.
4. Pass `item_id`/`want_id`/`capture_id` as context (resolve to the item's title, condition and product id).
5. Events: map `onEvent` to the job/SSE stream; a history store; the cost ceiling; the fixed failure sentence.
6. Add the `@anthropic-ai/sdk` dependency (assist tests fail on the Mac without it) and a route test.
7. Fix `run.mjs` to the real shapes and run both efforts live (the bench is the only measure of whether this works).
The older `assist()` in `assist.ts` (Intel + Llm ports, code keeps only sentences citing real source ids, no number check) has no caller left once this joins; delete or keep as the fallback.

## 4. Engines no served path calls

Source: the lead's map `audit-engines.md`, spot-checked against importers. "Caller" is my recommendation.

| Engine | File | What it would do | Who should call it |
|---|---|---|---|
| Observation write (link 5) | valuation-2 `valuate.ts` port, no impl | Store what a search read as observations | `intel/gather.ts` step 5 and `valuate` |
| Gather loop | `edge/intel/gather.ts` | Decide which sources to read until the basis is met | `valuate` via `GatherNeed`, in a job |
| Learn | `edge/intel/learn.ts` | Update parameters from outcomes (read: header only) | Sale/order recording path |
| Classify | `edge/intel/classify.ts` | Label listing rows | `gather` / `reconcile` |
| ACI calibration | `engines/valuation/aci.ts` (`onOurSale`, `calibrationForCheck`) | Learn range widths from our own sales | Orders path writes; `valuate` reads |
| Guard / guardWith | `engines/proof/proof.ts:168-184` | Stop a thin or stale basis from being shown | `check` (valuation-2 does) |
| Param registry | `engines/param/param.ts` | Versioned parameters, promote, rollback | `valuate` via `resolve`; admin route |
| Negotiation | `engines/negotiation/policy.ts` (`offer`, `opener`, `maxPay`, `buyingOffer`) | Offer and walk-away | A buying-side route, after valuation shows |
| Policy switch | `policy.ts` `switchPolicy`, `rollbackPolicy` | Promote a policy on a paired bootstrap | A scheduled job |
| Appraise, extract-live | `engines/appraise`, `extract-live` | Appraisal from a capture | Capture job (link 2-4 in the proof) |
| Sold runner | `engines/sold/run` | Run sold reads | `valuation-sold.ts` / gather |
| Capture facts/walks | `engines/capture/*` | Facts from photos | Capture route |
| Listing aspects | `engines/listing/aspects` | Fill listing fields | Listing route |
| Marketing calc/interest | `engines/marketing/*` | Price-to-interest | Insights route |
| Negotiation outcome | `engines/negotiation/outcome` | Record offers' results | Orders path |
| Param regressions | `engines/param/regressions` | Fit parameters | Scheduled job |
| Person | `engines/person` | Per-person scope | Param lineage |
| Trust: action, counterfeit, health, labels, noshow | `engines/trust/*` | Seller/item risk | `maxPay` gate and the item route (not read) |
| Reconcile + other-brand | ad9-1 `identity/attributes.ts`, `similar.ts` | Label `similar_other_brand`, out of the basis | `reconcile.sameProduct` (edited in that branch) |

## 5. Parked branches

### `mac/w/eng-valuation-2` (HEAD 9e8bb9f5): fit to merge after a gate run, not yet to serve
- Dry merge clean; 18 files, +15243/-157, most of it a parity fixture.
- Fixes: asymmetric log calibration (S2), too_few and stale notes (S6, proof link 1), `basis_level` and `last_sale` with their own proof, a deadline snapshot (a `closed` flag, only completed sources), a curve guard (`curveOK`: `n >= 30`, `calibration_error <= .05`, a citation, else p_sale/days/path are null), a registry with guards (`params.ts`, about 60 declared scalars), `valuate()` with an `ObservationPort`, Kish `basisOf`.
- Blockers:
  1. `api/valuations.ts` and `tools.ts` still call `check` directly; nothing calls `valuate`.
  2. `calibrationForCheck` returns no `n` or `hits`, so its 'checked' needs `n >= 30` and Wilson lower >= .7 and can never be met.
  3. No `ObservationPort` implementation (link 5).
  4. Warm-band fallback `q50 = Math.round(Math.sqrt(low * high))` invents a median from a band with no rows. That breaks "no figure without the rows it rests on"; return the band and no point value.
  5. Per-site `cite(...)` can throw and fail the whole check; catch per site.
  6. `modeCap = ceiling([], [], x.as_of)` is still a dead branch; the multi-site greedy selection and cancel cost are unproven.
  7. Python parity tests need `python` (they fail on the Mac, same as `capture/process.test.ts`). Run the gate on the merged tree on Windows.
  8. I did not read the 341-line comps.ts diff; re-check D1-D5 against the main arithmetic above after merging.

### `mac/w/eng-ad9-1` (fcde0de4): fit to merge as additive code; not read in depth
- Dry merge clean; 10 files, +2489/-5. New `engines/identity/attributes.ts` (382 lines) and `similar.ts` (51), tests, a parity fixture, `jobs/identity/similar.py`, and a small edit to `edge/intel/reconcile.ts`.
- The `reconcile.ts` diff (read in full): when the target has `kind` and `fields` (and kind is not electronics) and a result's `brand_norm` differs, `similar(item, row, kind)` decides; if similar, the row is labelled `similar_other_brand` with `in_basis: false` and `by: 'attributes'` and skipped by the code and model paths. Code decides, model abstains: matches the ruling, and these rows stay out of the price basis. The label is added to `CODE_MATCH_LABELS`, so `MatchLabel` widens; any switch on `MatchLabel` elsewhere must handle it (grep before merging).
- Blockers: no caller sets `Target.kind` or `fields` yet, so the pass never runs; the Python job and parity fixture need `python`; attributes.ts and similar.ts were not read for correctness; the rule that other-brand rows are shown and never priced from needs a test in `tools.ts` (`search_market` `exclude_brand`).

## 6. Solid: do not touch
- Money maths in `keep.ts` (integer cents, `priceForKeep` inverse), except the TAX_RATE placeholder.
- `comps.ts` weighting, age decay, Kish n_eff, the level back-off and the D2/D3 adjustments.
- `param.ts` versioning, `expectVersion`, held-out margin, rollback, freeze.
- `sold.ts` marking Apify rows `may_model: false`.
- The conversation's tool layer: strict schemas plus a second validator, parameterised allow-listed SQL, per-tool deadlines, generic port-failure text, Apify excluded from search.
- The ruling-aligned design: code decides, model abstains, no row no figure.

## Commands run
- `git merge-tree --write-tree main mac/w/eng-valuation-2`: exit 0, no CONFLICT.
- `git merge-tree --write-tree main mac/w/eng-ad9-1`: exit 0, no CONFLICT.
- `git diff main...<branch>` to scratchpad: exit 0. `git archive` of both branches to scratchpad `v2tree` and `a9tree`: exit 0.
- Greps on valuations.ts, aci.ts and check.ts to re-confirm S1, S2, S3, S4 line numbers.
- No test run. A single-file run on each fix is the proof; none was made.
