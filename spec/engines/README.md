# spec/engines/

One document per engine. All are *agent proposal* for Ben and Nate. Every document has the same ten sections: what it decides, signals, the calculation, learning, speed, what the person sees, how it beats what exists, protections, proof, build tasks. The tasks that can start at once are in [plans/start-now.md](../plans/start-now.md); the full graph is `plans/backend/plan.md` when it lands.

Read [protocol-and-adapters](protocol-and-adapters.md) and [intelligence-api](intelligence-api.md) first: every other engine reads and acts through them.

| Engine | What it decides |
|---|---|
| [protocol-and-adapters](protocol-and-adapters.md) | How each site is reached and acted on: our own adapters first, measured per site, repaired when a site changes |
| [intelligence-api](intelligence-api.md) | How any price, fact or figure is found: a protocol per kind of question, every source started at once, and a wider search when the basis is thin |
| [capture](capture.md) | The capture process for each product type and the fewest follow-up inputs it needs |
| [identity](identity.md) | Whether two listings are the same product, exact or comparable |
| [valuation](valuation.md) | The price range, what the person keeps per site, the chance of sale, and the price slider |
| [photo](photo.md) | The photo set per site: order, crop, caps, and what an edit may not change |
| [negotiation](negotiation.md) | Accept, decline or counter an offer, and the amount and hour of an offer we send |
| [trust](trust.md) | Block, ask or warn on a buyer thread; no-shows, account health, disputes, recalls |
| [demand-and-trend](demand-and-trend.md) | A forward forecast of demand and price per product |
| [recommendation-and-style](recommendation-and-style.md) | What to show each person, and which owned items to sell now |
| [platform-analytics](platform-analytics.md) | Which storefront does best for a person, compared fairly |

How the plan for each site is chosen is in [marketing-engine.md](../marketing-engine.md), written before this folder existed and in the same shape.

## Person: open from the audit

Checked 2026-11-15. Each row of the Person section of [audit.md](audit.md) was checked against the code. 1 of 20 is closed (`learn()` now decays through the param store, which derives elapsed time from `promoted_at`). 19 are open. Worst first. This list sits here because `spec/product.md` is canon and has another owner today.

| # | What is wrong | Where (file:line today) | Fix | Test that proves it |
|---|---|---|---|---|
| PE-A1 | A reset moves the TypeScript scope to `id~epoch`. The Python fold and read always use the raw id, so after a reset the fold writes the old scope and the reset history comes back. | `app/src/engines/person/person.ts:42`; `jobs/person/fold.py:62` | One scope contract for reset in both runtimes. The fold takes the epoch scope. | Person p resets (epoch 1) after 10 events. `fold_person` with epoch 1 and the new events writes at scope `p~1`. `read` for epoch 1 returns that row, never the epoch 0 row. A shared fixture lists both scope strings. |
| PE-A2 | The nightly fold accepts any `success`. A NaN or out-of-range value makes an invalid Beta posterior. | `jobs/person/fold.py:54` | Validate each event: `success` in {0,1} or [0,1], finite weight, valid time. | An event with `success` NaN, 1.5 or -0.1 raises `ValueError`, and no row is proposed. |
| PE-A3 | No negotiation, marketing or recommendation code reads the traits. `read` and `view` are helpers nobody calls. | `app/src/engines/person/person.ts:65`, `:71` | Wire each trait to its consumer (posture to negotiation, see NG-A2; `person_ship_on_time` and `person_keep_share` to marketing and recommendation). | One test per consumer. With 10 `kept` events a person's `person_keep_share` mean is above a new person's, and the recommendation shelf for that person changes accordingly. |
| PE-A4 | The nightly fold sums all past labels with no forgetting and no weights. It disagrees with the online posterior. | `jobs/person/fold.py:54` | Replay the weighted, timestamped events with the same half-life rule as the store. | 8 events, the first 4 dated 400 days before `at`. The fold posterior alpha is below the plain sum and equals the TS store's replay of the same events. |
| PE-A5 | Equal-time events keep input order across the train and holdout split. | `jobs/person/fold.py:48` | Sort by `(at, event id)`. | Two events with the same `at` and different `success`, fed in either order: the same split and the same posterior. |
| PE-A6 | Visible trait means and counts have no citation or guard. | `app/src/engines/person/person.ts:71` | Return each trait as a guarded number with a citation. | A person with 2 events: `view()` returns `notes` with `too_few` and a citation id for every trait. |
| PE-A7 | Priors and fold gates are bare numbers, duplicated in two files with no source: Beta(2,2), (3,1), (3,1), (3.6,0.4), (1,3), hold-out 0.25, minimum 8 events, noise 0.01. | `person.ts:19-23`; `fold.py:17-21`, `:23-25` | Declare each once with its spec citation. Both runtimes read it from the registry. | A test loads one shared prior list and asserts both runtimes equal it. Setting the registry `MIN_EVENTS` to 3 makes the fold run on a 3-event trait. |

## Param: open from the audit

Checked 2026-11-15. Each row of the Param section of [audit.md](audit.md) was checked against the code. 7 of 16 are closed, not 16 of 16. 8 are open and 1 is unclear. Worst first. Same reason as above: `spec/product.md` is not edited here.

| # | What is wrong | Where (file:line today) | Fix | Test that proves it |
|---|---|---|---|---|
| PR-A1 | `observe` does not check its input. A NaN or out-of-range `success`, a zero or negative `weight`, a negative `days_since_last`, or bad starting hyperparameters write an invalid champion. The SQL store shares the step, so it has the same hole. | `app/src/engines/param/param.ts:115` (`observationStep`); `jobs/param/registry.py:151`; `sql.ts:123` | Validate each observation and the starting alpha and beta (finite, positive) before applying. | `observe` with `success` 1.5, -0.1 or NaN, `weight` 0 or -1, or `days_since_last` -1 throws and leaves the row count unchanged, in TS, SQL and Python. |
| PR-A2 | `propose` and `promote` do not enforce `guard_lo` and `guard_hi`, and do not check the payload shape for the family. | `param.ts:236`, `:246`; `jobs/param/registry.py:205`, `:218` | Validate the payload against the declaration and refuse a value outside its guards. | A scalar of 5 against `guard_hi` 1 is refused. A beta payload with alpha -1 is refused. |
| PR-A3 | A NaN `noise` makes the win test false, so a worse challenger is promoted. A held-out score of Infinity is accepted on both stores. | `param.ts:246`; `registry.py:218`, `:205` | Reject a non-finite `noise` and a non-finite held-out score. | Champion score 0.6, challenger 0.5, `noise` NaN: today it promotes. It must throw. A challenger with score Infinity is refused. |
| PR-A4 | The 60 s read cache is invalidated by hand. After `observe`, `promote` or `rollback` the next read can be stale. | `param.ts:319` | Invalidate the affected scopes inside every committed write. | Read through the cached store, `observe` through it, read again: the new version comes back without a manual `invalidate()`. |
| PR-A5 | No 2-SE drift anomaly. The anomaly flag fires only when the mean leaves its guards. | `param.ts:292`; `registry.py:184` | Compare each update with the prior's standard error and emit the anomaly. | Beta(2,2), `observe` success 1 at weight 20: anomaly true. Beta(50,50), one success at weight 1: anomaly false. |
| PR-A6 | `FORGET_DAYS` is 30 for every param. Identity needs 180 and analytics 90. | `param.ts:91`; `registry.py:18` | Declare the half-life per param and read it by scope. | A param declared with half-life 180: an `observe` after 180 days keeps weight 0.5. The default 30-day param keeps about 0.016. |
| PR-A7 | Unclear. The audit named scalar, normal and gamma. Gamma works now. Scalar and normal still throw on `observe`. Confirm whether the spec needs event updates for them. | `param.ts:124`; `registry.py:163` | If needed, add the conjugate update for each family. | Only if confirmed: `observe` on a normal param moves the mean toward the value by `weight / (n_eff + weight)` and shrinks the sd. |
