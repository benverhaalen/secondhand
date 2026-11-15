# Trust engine

**Draft, not yet reviewed** (the engines lead's spec pass, 2026-11-15, drafted by a Sonnet seat from the code and checked only for the state block). An Opus review of this page comes before any build from it; see [packet 70](../../.agents/team/packets/team/70-engines-handoff.md).

*agent proposal* (the whole file). Canon names in [product.md](../product.md) win. This engine joins five cards into one build: scams ([card 5](../determinations/managing-and-buyers.md#5-how-likely-a-buyer-is-a-scam)), no-shows ([card 6](../determinations/managing-and-buyers.md#6-how-likely-a-buyer-will-not-show)), account health ([card 17](../determinations/managing-and-buyers.md#17-whether-an-account-is-healthy-or-at-risk)), recalls ([card 20](../determinations/seeing-the-item.md#20-recall-or-safety-flag)) and counterfeits. The cards hold the start values; this file says how they run and what learns. How a `param` updates, folds, promotes and rolls back is in [real-time weights](../product.md#real-time-weights-agent-proposal), not here.

Paths: `T/` is `app/src/engines/trust/`, `J/` is `jobs/trust/`. References are `file:line` as of 2026-11-15. A thing marked *not built* has no code.

## State, 2026-11-15

**Built and tested.** Every function below exists with tests (`T/*.test.ts`, `J/test_*.py`). Sections 1 to 4 say which parts.

**Not in the product yet.** One call: `evaluateHard` at `app/src/edge/messages/messages.ts:79` and `:117`, fed only the classifier's signals. Everything else is unreached: the production trust port is `trust: async () => ({ action: 'none' })` (`app/src/edge/api/conversations.ts:83`), so no thread is scored. `gtin14` is also used by `app/src/edge/intel/reconcile.ts:6`. No caller of `postGate`, `takedowns`, `buyGate`, `nsDecide`, `health`, `counterfeit` or `fold` exists outside the engine and its tests. The model extractor is injected (`Deps.model`, `T/decide.ts:16`); none is wired. No label, print or signal row is stored (D3).

**Merged today, checked against the code:**
- Money is cents. Inputs are `*_cents`, validated by `cents()` (`T/money.ts:1`); `loss()` refuses NaN, negative or fractional (`T/decide.ts:35`). The old fallback to a dollar price now converts once through `dollarsToCents` (`T/money.ts:5`, used at `T/decide.ts:79`). Dollar fields still exist (D11).
- One sigmoid, clipped at ±50 before `exp`, in `T/calibration.ts:4` and `J/fit.py:23`. Shared fixture `T/fixtures/calibration-parity.json` (21 cases, run by `T/calibration.parity.test.ts` and `J/test_calibration_parity.py`).
- Isotonic knots are validated in both languages: finite, sorted, outputs in [0,1] (`T/calibration.ts:13`, `J/fit.py:105`).
- An empty held-out set refuses a fit: `J/fit.py:157` (and `brier` `:119`, `ece` `:128`, zero total weight `:83`). Test `J/test_audit.py:9`.
- `gtin14()` (`T/recall.ts:15`) checks the GS1 check digit and pads to 14. Fixture `T/fixtures/gtin-parity.json` (16 cases) is read by `T/gtin.parity.test.ts` and by `jobs/identity` (`jobs/identity/test_audit.py:103`).
- Also fixed since the audit, each with a test: the model's reading is validated (`T/signals.ts:22`); health refuses a bad threshold (`T/health.ts:5`); published numbers carry a guarded citation (`T/publication.ts:5`, used at `T/decide.ts:107`, `T/counterfeit.ts:28`, `T/noshow.ts:20`); calibration and base risk read at the thread's site and person scope (`T/decide.ts:75`); `r` is updated on every thread read, `q` on scams (`T/labels.ts:66`); recall ties are stable (`T/recall.ts:60`); no-show, print, salt, warning and isotonic constants are named params; authentication floors come from `spec/sites.mjs` (`T/counterfeit.ts:24`).

## Wrong today

From the "Trust" rows of [the audit](audit.md#trust) not yet fixed, the [science audit](../plans/sweep/science-audit.md) row for trust, [the completion table](../plans/completion.md) and my own read of the code. The security, production and completion pages name no trust finding. Order is by harm. Each fix is done when its test passes.

| # | What is wrong | Where | Fix | Test that proves it |
|---|---|---|---|---|
| D1 | The product never scores a thread: the port returns `none`, and messages call only `evaluateHard`, so code signals (`payment_link`, `gift_crypto_wire`, link guard) never run | `conversations.ts:83`, `messages.ts:79` | Wire `decideThread` as the port, with `codeSignals` on the raw text | `trust.wired`: a gift-card message through the messages route makes a `scam_warning` with the extractor down |
| D2 | A malformed extractor reply throws out of `decideThread`; only the model call is inside the catch. Spec §8 says a model failure becomes ask | `T/decide.ts:96` (`readModel` throws at `T/signals.ts:24-28`) | Treat a throw from `readModel` as `modelFailed` | `trust.model_down`: confidence 2, an unknown signal and an empty span each give `ask` |
| D3 | Labels, prints and the poison-cap ledger live in `Map`s and an array, so a restart empties them and resets the cap. `trust_signal`, `trust_label` and `script_print` rows are not written | `T/labels.ts:33-36` | Write the rows; derive the ledger from them | `trust.poison_cap` across a restart: 500 labels, restart, 500 more, still inside 5% |
| D4 | A changed label overwrites its row but its earlier counts stay and the new ones add again (comment at `:53`) | `T/labels.ts:54-72` | Store each label's folded contribution; reverse it before applying a change | A scam label changed to fine leaves the same counts as one fine label |
| D5 | Live weights from `q/r` are not held to ±50% of the written value until 30 positive and 30 negative threads; only the nightly fit holds them | `T/decide.ts:58-65`; band at `J/fit.py:248-251` | Apply the band in `weight()` | A signal with 2 labels cannot move more than 50% of its prior |
| D6 | Priors are declared twice, in TypeScript and Python, with no parity test: `trust_b`, `trust_m_ask`, `trust_c_tap_cents`, `trust_delta`, `trust_loss_min_cents`, `trust_weight_band`, `trust_isotonic_n`. The 30-day half-life is `FORGET_DAYS` (`param.ts:90`) and also `trust_half_life_days` | `T/params.ts:30-37`, `J/params.py:33` | One prior file both read | A parity test over that file, as for calibration |
| D7 | A warning computes `flag_m` but never stores it; `trust_flag_m` is one global scalar | `T/health.ts:19-22` | Observe it per (site, metric) and read it | `trust.health_flag`: warning at 0.7, then `health()` flags at 0.63 |
| D8 | Pace: `observeChallenge` takes whatever scope the caller passes, with no actions-per-hour bucket; `paceAllowed` uses a Cantelli bound, not a Beta quantile; at the prior the bound is about 0.053, so no pace passes until about 450 clean actions in a bucket (my arithmetic, *inferred*) | `T/health.ts:23`, `:33-43` | Bucket as scope; exact Beta upper bound; state the starting pace as a param | `trust.pace`: 500 clean actions pass; one challenge in 50 fails |
| D9 | No-show learning is per event only. No nightly fit, no 2 h confirm timer. The dispute record is kept but never shown (`shown: null`) and `trust_dispute_show` is unused | `T/noshow.ts:23`, `T/health.ts:29-32`, `J/fit.py` | A no-show fit in `fold`; the confirm job; publish closed-case counts | `trust.learns` for no-shows; "Won 14 of 17" only from 10 closed cases |
| D10 | Rollback covers calibration only (`watch`, Brier worse by `trust_watch_tolerance`). The weights champion and the spec's other triggers (§4) have none | `J/fit.py:174-190` | One `watch` per champion kind, with the §4 triggers | `trust.rollback` for each trigger |
| D11 | Dollar fields remain, and units disagree: `keep_q50` is read as cents, `refund_asked` as dollars. `price_usd`, `priceUsd`, `q50` also remain | `T/decide.ts:79-80`, `T/signals.ts:113`, `T/counterfeit.ts:15-16` | Delete the legacy fields; the type refuses them | `tsc` fails on `keep_q50`; a $50 refund and a 4800-cent keep give loss 9800 |
| D12 | Calibration promotion has noise 0, so any held-out gain promotes. The spec's switch rule (cost, bootstrap, recall) is built for weights only | `J/fit.py:147`, `:325` | Pass a bootstrap noise from the held-out Brier gap | Two fits of equal quality never swap champions |
| D13 | The warn line is always "Don't open links from buyers", whatever fired | `T/decide.ts:122` | Name the signal that put the score near the line | `warn` on `new_account` shows that reason |
| D14 | A recall model token is any 4+ character token with a digit and a letter ("120V", "1500W"); one shared token is `exact`, which blocks with no override. Spec says brand plus model (*inferred* risk from the regex) | `T/recall.ts:34-41`, `:51`, `:81-86` | Require a shared brand word, or a minimum token shape (params) | The 20 lookalikes (§9) |
| D15 | Counterfeit "ask for a proof photo" applies on every site; spec limits it to where "not authentic" is a case reason (Poshmark, Depop) | `T/counterfeit.ts:34` | Read the case reasons from site facts | A proof-less brand item on eBay does not ask |
| D16 | Beta guards are [0.001, 0.95]; the canon says [0.02, 0.98] | `T/params.ts:20` | Take the canon's, or change the canon | A trust Beta cannot leave the canon band |

## 1. What it decides

For every buyer thread, appointment, listing, purchase the person is weighing and account, one action per risk. `Action` is `none | warn | ask | block` (`T/decide.ts:29`). What each does is in [who may act](../product.md#5-who-may-act) and the `scam_warning` row of [messages](../features/messages.md); in short, block stops the agent and offers no one-tap commit, ask holds the commit for a tap, warn shows one line.

The objective: `cost(a) = p · L · miss(a) + (1 - p) · F(a)`. Built as one inequality (`T/decide.ts:41`, §3). Locked actions, hard rules and recall flags sit outside it: fixed ([real-time weights](../product.md#real-time-weights-agent-proposal), the fixed list).

Rows the canon lacks: `trust_signal { subject ids, message_id?, signal, present, evidence_span, extractor, model_version, confidence, at }` (the code returns it as `Reading`, `T/signals.ts:18`, and stores none, D3); `trust_label { subject_id, kind: scam | no_show | dispute | not_authentic | challenge, value, weight, source, observed_at, resolved_at }` (code has `LabelRow` with `scam | fine` only, `T/labels.ts:17`; no_show, dispute and challenge go straight to Beta rows, `not_authentic` has no path); `script_print` is in [product.md](../product.md) (`T/labels.ts:75-95`).

## 2. Signals

Each signal is code, an adapter field, or the model's reading through the [card 1](../determinations/managing-and-buyers.md#1-what-a-message-means) extractor with the evidence span kept. No signal reads a name, a language, a dialect or a place (tests `T/decide.test.ts`, `T/signals.test.ts`: "counterfactual"). Predicate names follow [messages and offers](../../research/messages/ben/messages-and-offers.md).

### Scam: hard rules (fixed, never learned) — `T/hard.ts:20`

| Signal | Read by | Result |
|---|---|---|
| `asks_code` | model | block (`:26`) |
| `overpay_or_shipping_label` | model | block (`:27`) |
| `payment_link`: a link that claims to be a payment, a verification or the site's page, or spells a lookalike or punycode host | code, `guardLinks` (`T/signals.ts:52-64`) | block (`:28`); every off-site link is replaced by its host, none is fetched |
| `gift_crypto_wire` | code regex (`T/signals.ts:109`); FTC's insist-on-gift-card pattern. *Not in the earlier page; kept: it works with the model down* | block (`:29`) |
| `claims_paid` with no paid order | model plus order state | block with checkout; ask on a Facebook local deal (`:30-32`) |
| `off_platform` | model | locks `move_off_site`, on every deal; the earlier page said "with checkout". The code is right: the predicate already separates a meeting-time payment (`:37`) |
| `asks_address_phone` | model | locks `share_address` (`:38`) |
| A draft that calls the item authentic (`AUTH`, `:18`) | code on the draft | locks `identity_claim`, blocks the draft (`:39`) |

Sources: [trust, returns, disputes §8](../../research/sold/nate/trust-returns-disputes.md#8-local-pickup-scams-safe-exchange-cash-versus-in-app), the Facebook list in [facebook-marketplace](../../research/list/ben/platforms/facebook-marketplace.md) (asserted), FTC gift-card guidance. Locked kinds are in [decision kinds](../product.md#decision-kinds-the-complete-list).

### Scam: scored signals (learned; the prior is `SCORED`, `T/params.ts:2-8`)

| Signal | By | Prior | Source of the prior |
|---|---|---|---|
| `off_platform` | model | +2.0 | card 5. On a Facebook local deal, paying at the meeting scores 0 (asserted, facebook-marketplace) |
| `ship_elsewhere` | model | +1.5 | card 5 |
| `link_early` (flagged link in message 1 or 2, `T/signals.ts:118`) | code | +1.0 | card 5 |
| `new_account`: age under `trust_new_days` (30) or no ratings | adapter | +0.7 | card 5 |
| `urgency_no_question` over `trust_urgent_cents` (20,000) | model plus price | +0.5 | card 5 |
| `good_history`: at least `trust_good_buys` (10) | adapter | -1.5 | card 5 |
| `third_party_collects` | model | +1.5 | the "mover with a check" pattern (asserted) |
| `site_banner` | adapter | +2.0 | the site's own word, as card 17 ranks it |
| `script_print_hit`: at least `trust_print_min` (3) sellers and buyers within `trust_print_hamming` (3 of 64 bits) in `trust_print_days` (7); only messages of at least `trust_print_tokens` (8) words that are not a site prefill (`T/signals.ts:86`) | code | +1.0 | inferred: honest buyers write their own words. 3 and 3 bits are *agent proposal*, unmeasured |
| `burst_same_text`: same text to `trust_burst_n` (5) listings in 10 min | code | +0.7 | inferred |

The model's threshold per predicate is `trust_thr.<signal>`: 0.1 for `asks_code`, 0.2 for the rest (`T/params.ts:14`; source: messages-and-offers). The salt rotates monthly and last month's is also read for `trust_salt_overlap_days` (7) (`T/signals.ts:93`).

### No-show (prior weights `trust_ns_<k>_weight`, `T/params.ts:47-48`; source card 6, the last two inferred)

`past` +2.0 each, `paid` -3.0, `exact` -1.0, `vague` +1.0, `new` +0.5, `haggle` +0.3, `reschedule` +0.7, `reply` -1.5. Confirm at `trust_ns_confirm` 1.0, ask before booking at `trust_ns_ask` 3.0 or `trust_ns_past_ask` 2 past no-shows (`T/noshow.ts:14-19`). Silence of `trust_ns_wait_min` 15 after the slot is `no_show` (`T/noshow.ts:40`).

### Account health — `T/health.ts`

`risk = max(value/threshold)` (`:10`); flagged at `trust_flag_m` 0.8 (card 17). One more action that would cross 1.0 becomes ask; `paused` blocks. Site metrics (Poshmark: 3% cancellations over a rolling 90 days, 24 h restriction, then 14-day suspension) are inputs, not code. Pace: Beta posterior of challenges per action, prior `Beta(1, 99)`, bound by `trust_pace_ceiling` 0.01 and `trust_pace_tail_odds` 19 (`:33`). Built, but see D7, D8.

### Recall (fixed, never learned) — `T/recall.ts`

`matchRecall` (`:45`): `exact` on a shared GTIN-14, or a shared model token, or a name hit plus a date code inside the recalled range; `name` on two shared words of 4+ letters (`:53`); else `none`. `postGate` blocks an exact match with no override and holds a name match until the person confirms the identifier differs (`:81`); `takedowns` (`:94`) and `buyGate` (`:101`) cover live listings and the buy side. `recallDelta` keys on `LastPublishDate` and rejects a delta over `trust_recall_max_delta` (500) rows (`:72`). *Not built:* the daily mirror job, and the trigger that matches every new day's rows. Brand is not used (D14).

### Counterfeit — `T/counterfeit.ts:11`

The signals describe the listing, never the item; authenticity is never inferred ([fixed list](../product.md#real-time-weights-agent-proposal)).

| Signal | Action |
|---|---|
| Brand in `trust_cf_brands` with no proof photo | ask (`:34`, D15). The list is 10 brands, *agent proposal*, not read from the programmes |
| Poshmark price at or over `authentication.floor_cents`; eBay shoes at `authentication.shoes.floor_cents` | warn (`:24-25`). Facts from `spec/sites.mjs` (*observed*: $500 and $75, [trust, returns, disputes §6](../../research/sold/nate/trust-returns-disputes.md#6-counterfeits-and-authentication)), not params |
| Brand in the list and price under `trust_cf_price_ratio` (0.6) x the [valuation](valuation.md) q50 | warn; both prices are shown only if each has a guarded citation (`:28-34`) |
| Stock-image match (`stockPhoto`, supplied by the caller; the matcher is *not built*) | warn |
| Buy side: the two above and a seller under `trust_cf_young_days` (30) | ask (`:36`) |

*Not built:* ranking listings covered by an authentication programme first.

### Disputes

Beta `trust_dispute` (prior `Beta(1, 1)`) per (site, reason, bundle complete) from `observeDispute` (`T/health.ts:26`). Display not built (D9).

## 3. The calculation — `decideThread`, `T/decide.ts:74`

| Step | Code |
|---|---|
| 1. Code signals (`codeSignals`, `T/signals.ts:112`) | built. The 24 h buyer-profile cache is *not built*: the caller passes `ctx.buyer` |
| 2. Model predicates, started first, with `trust_model_timeout_ms` (2000) | built (`:86-97`). On timeout or error: `ask`, reason says the check did not finish. Haiku is the spec's choice; no model is wired. D2 |
| 3. Hard rules: block | built (`:100`, `:115`) |
| 4. `s = sum(w_i)` over present scored signals; `logit p = trust_b + s` | built (`:102`, `:106`). `trust_b` is one prior for every group; the six per-group base rates are *not built*. A fitted `trust_weights` row replaces `q/r` weights and `trust_b` (`:58-65`, `T/params.ts:67`) |
| 5. `L = max(trust_loss_min_cents, keep_q50 + refund asked)` | built (`:35`) |
| 6. `F = round(trust_c_tap_cents + trust_delta · L)` | built (`:37`) |
| 7. Ask when `s >= ln(F / (L (1 - trust_m_ask))) - trust_b`; warn within `trust_warn_gap` below | built (`:41`, `:118-119`) |
| 8. Block from the score alone when the gate has passed and calibrated `p >= trust_p_block` | built (`:117`). The gate passes only if the calibration was fitted on the same weights version (`:104`) |
| 9. No-show: `logit q = log(a/b) of trust_ns_b + score` | built (`T/noshow.ts:31`). Confirm 2 h before and re-offer to the next buyer ([card 22](../determinations/managing-and-buyers.md#22-which-buyer-gets-the-item-when-several-want-it)): *not built* |
| 10. Health, 11. Recall, 12. Counterfeit | §2 |

Start values and where they come from: `trust_b` -4.0, `trust_m_ask` 0.1, `trust_c_tap_cents` 100, `trust_delta` 0.0538, `trust_warn_gap` 0.5, `trust_p_block` 0.95, `trust_loss_min_cents` 2000. They are set together so at `L_ref` = $50 the ask line is exactly card 5's elevated line `s = 1.5`: `F(50) = 1.00 + 2.69 = 3.69`, `ln(3.69 / 45) = -2.50 = -4.0 + 1.5`. The values `m_ask`, `c_tap`, `warn_gap` and `p_block` are *agent proposal*; `delta` and `trust_b` are solved from them. Test: `T/decide.test.ts`, "the reference loss puts the ask line at exactly card 5's". Above $50 the line falls (at $300 it is 1.24), so a dear item is asked sooner. The score is a sum of named reasons so each can be read and corrected; the model reads predicates and never picks the action.

## 4. Learning

Events and cadence follow [real-time weights](../product.md#real-time-weights-agent-proposal). What is trust's own:

| Piece | Built | Code |
|---|---|---|
| Per label: `q_i ~ Beta` (rate in scams) and `r_i ~ Beta` (rate in all threads); prior `q = r · e^w` at `STRENGTH` 20 threads, `R0` 0.04; `w = ln(E[q]/E[r])` | yes | `T/params.ts:17-27`, `T/labels.ts:66-71`; decay by elapsed days in `store.observe` |
| Poison cap `trust_seller_cap` 0.05 per person per row | yes, in memory (D3) | `T/labels.ts:42-50` |
| No-show: `trust_ns_b` `Beta(1, 4)` and `trust_ns_q/r.<k>` per appointment | per event only (D9) | `T/noshow.ts:23` |
| Challenge and dispute Betas | per event | `T/health.ts:23-28` |
| `flag_m` = 0.9 x warning ratio (`trust_warning_factor`) | not stored (D7) | `T/health.ts:19` |
| Nightly `fit_signals`: L2 logistic centred on the written weights, sd `trust_prior_sd` 0.5, label weight x 30-day decay, last `trust_holdout_days` (30) held out | yes | `J/fit.py:202` |
| Switch: held-out positive weight at least `trust_switch_positive_weight` 30, bootstrap lower bound (`trust_bootstrap_n` 500, tail 0.025, seeded) of the cost gain above 0, recall not lower. Bands: ±`trust_weight_band` 50% until `trust_weight_support` 30 of each sign; a sign flip needs `trust_weight_reverse_support` 100 | yes | `J/fit.py:243-274` |
| Thresholds: highest per-predicate threshold keeping recall at `trust_predicate_recall` 0.95; start 0.1 and 0.2 | yes | `J/fit.py:281` |
| Calibration: Platt below `trust_isotonic_n` 1000 rows, isotonic above; every 4th row held out (`trust_holdout_every`); ECE is the weighted mean gap over `trust_ece_bins` 10 equal-width bins | yes | `J/fit.py:36-135`, `:147` |
| `fold`: weights, then calibration on the weights' held-out rows, then thresholds | yes, not scheduled | `J/fit.py:316` |
| Hard rules are never inputs to `fit_signals` | yes by construction | `T/params.ts:12` |
| Label sources and weights (Block buyer 1.0, site removal 0.8, Ignore 0.3, claim window passed 1.0, local pickup done 0.7; seeded scripts count for recall tests only) | *not built*: `addLabel` takes `outcome` and `weight` from the caller | `T/labels.ts:54` |

Priors above 1000 rows, the Platt/isotonic switch, 4th-row hold-out and the bootstrap settings are *agent proposal* (the spec names the objective, not the solver); the 0.5 sd, 0.95 recall, ±50%, 30 and 100 supports come from the canon and card 5.

### The calibration gate (rows 703, 704)

A percentage shows only with `trust_gate_n` 300 resolved threads, `trust_gate_pos` 30 positives and ECE at most `trust_gate_ece` 0.05, all on the group's held-out rows (`T/decide.ts:46`, `J/fit.py:160`). Below it the person sees reasons and counts. The science audit notes ECE is noisy at 30 positives; the page names the estimator above; an interval on it is a next step (N6).

### Rollback

`watch` (`J/fit.py:174`) restores the previous calibration when its Brier on live threads is worse by `trust_watch_tolerance` 0.05 (*agent proposal*). The other triggers (a confirmed scam reaching none or warn with a listed signal; over 1 in 3 asked threads ending in a normal sale; no-show rates not separating by 2 SE over 50 appointments; a site warning under its flag; ask rate moving 2 SE) are *not built* (D10).

## 5. Speed

| Path | Budget (*agent proposal*) | State |
|---|---|---|
| Code signals and score | under 50 ms | `J/sim.py:119` benches the whole fixture path on 1,000 synthetic threads; no result is recorded in the repo |
| Text predicates | under 2 s p95 (`trust_model_timeout_ms`) | enforced as a timeout; a live extractor's latency is unmeasured |
| Buyer profile cache 24 h; `script_print` lookup under 10 ms; no-show at booking and 2 h before; recall daily pass; health on each cancel, `route_call` and daily | per [data](../features/data.md) | *not built* except the lookup, which is an in-memory scan (`T/labels.ts:83`) |

## 6. What the person sees

Words follow [copy](../../product/copy.md). Shapes only:

| Case | What shows | Built |
|---|---|---|
| block | the reason, then Block buyer · Reply with safety line · Ignore | reasons in `T/hard.ts`; the card is [messages](../features/messages.md) |
| ask | "Check before you reply: they want to pay or talk off the site, ..." on the commit | `T/decide.ts:121` |
| warn | one line | generic (D13) |
| real counts | "Seen in 41 threads people here reported as scams this month" | not built |
| percentage | only past the gate, with a guarded citation | `T/decide.ts:107-110` |
| no-show | "Missed 1 pickup with you. Confirm sent." | `T/noshow.ts:21`, only with a cited count |
| account, dispute, recall, counterfeit | card 17's line; "Won N of M" from 10 closed cases; the notice and which listings came down; "Priced at $120. This model usually sells for $310." | account line not built; dispute D9; recall `T/recall.ts:81-101`; counterfeit `T/counterfeit.ts:30-34` |

## 7. How it beats what exists

- No product in [parity](../parity.md) screens buyer threads, scores no-shows or ties a recall feed to live listings. The sites screen their own channels, one site at a time.
- One seller sees their own threads. The engine sees all: a script to three sellers scores for the fourth, through prints that carry no text. Built (`T/signals.ts:75`), unwired (D1).
- It replaces card 5's fixed sum with learned weights and a loss that scales with the item, starting from card 5's decisions. The gain is proven by the switch rule on held-out threads (`J/fit.py:274`) and measured on the 60 messages in §9.
- Row 705 becomes a measured challenge rate per pace; row 706 becomes won-of-closed counts per site and reason. Neither is shown yet (D8, D9).

## 8. Protections

- The agent never opens a buyer's link, reads back a code, shares an address or moves a deal off-site: fixed, outside learning (§2).
- Block stops the agent, not the person. A model failure turns the commit into ask, never block, never silence (D2 is the hole).
- Incoming text never grants authority ([card 2](../determinations/managing-and-buyers.md#2-whether-incoming-text-is-trying-to-instruct-the-agent)). Row 708 is answered by limiting what text can do, plus a catch rate on a fixed injection set with its size. The set is *not built*.
- No signal reads a name, language, dialect or place; tests swap them and the score must not move.
- Prints are salted SimHash, salt rotated monthly; the evidence span is masked on write and dropped at close or after `trust_retention_days` (30) (`T/labels.ts:22`, `:97`). Rows obey `may_model` ([data use](../data-use.md)).
- The 5% cap keeps one account from poisoning shared weights. Row 707 stays with Ben and Nate ([open](../product.md#9-open-for-ben-and-nate)).

## 9. Proof

| Test | Passes when | State |
|---|---|---|
| `trust.prior_equals_card5` | priors give card 5 and card 6's action at `L_ref` | built (`T/decide.test.ts`) |
| `trust.hard_rules` | each hard fixture blocks, no draft, zero link fetches | built (`T/signals.test.ts`) |
| `trust.counterfactual` | swapping names, language, place moves no score | built |
| `trust.model_down` | an extractor timeout turns every commit into ask | built for timeout; D2 for bad output |
| `trust.gate` | no percentage below 300, 30 or above 5 points | built |
| `trust.poison_cap` | 500 labels from one seller stay inside the cap | built in memory (`J/test_sim.py:20`); D3 |
| `trust.health_flag` | warning at 0.7 gives flag 0.63 | arithmetic only; D7 |
| `trust.rollback` | each trigger restores the previous champion | calibration only; D10 |
| `trust.learns` | on a planted stream, weights recovered within 0.2 after 2,000 threads; a planted bad challenger never promoted | bad challenger only (`J/test_sim.py:13`); recovery *not built*: `J/sim.py:6-7` says it waits for the weight learner, which now exists (`J/fit.py:202`); the planted-weight run is unwritten |
| `trust.speed` | code path p95 under 50 ms, full path under 2 s on 1,000 threads | bench built, no recorded run |
| `trust.recall_set` | 20 CPSC recalls blocked, 20 lookalikes not ([features-proof item 17](../../product/features-proof.md), table row 5) | *not built*. Source of the 20: the CPSC list; lookalikes chosen first by hand |
| `trust.scam_set` | 30 public scam scripts caught, 30 ordinary messages not flagged (row 6). Both counts reported, with n | *not built*. Needs a wired extractor (D1) |
| `trust.wired` | D1's test | *not built* |

The old `trust.extractor_recall` (recall at least 0.95, false positives at most 2%) is the row 6 set run against the fitted thresholds.

## 10. Next, in build order

Each step lists the measure that says it worked. Steps 1 to 4 are fixes, not product choices.

| # | Task | Measure | Files |
|---|---|---|---|
| N1 | Wire D1 and D2: `decideThread` as the port; bad extractor output becomes ask | `trust.wired`, `trust.model_down` pass | `conversations.ts`, `messages.ts`, `T/decide.ts` |
| N2 | Persist labels, prints and signals; fix replacement (D3, D4, D5) | `trust.poison_cap` across a restart; changed-label test | `T/labels.ts` |
| N3 | Recall: fix D14, run the 20 and 20, wire `postGate`, `takedowns`, `buyGate` and the daily delta | "20 of 20 blocked, 0 false blocks" with n | `T/recall.ts` |
| N4 | Scam set: wire an extractor, run 30 scripts and 30 ordinary messages, fit `trust_thr` on half, report on the other half | recall at least 0.95 and false positives at most 2% on the held-back half, both counts and n | `J/fit.py` `fit_thresholds` |
| N5 | One prior file for both languages; delete legacy dollar fields; calibration noise (D6, D11, D12) | parity test passes; `tsc` clean; two equal fits do not swap | `T/params.ts`, `J/params.py`, `J/fit.py` |
| N6 | Health: store `flag_m`, bucketed pace, exact Beta bound; show an ECE interval beside the gate | `trust.health_flag`, `trust.pace`; bootstrap interval of ECE under 5 points before a percentage shows (*agent proposal*) | `T/health.ts` |
| N7 | No-show fold, the 2 h confirm job, disputes shown, more rollback triggers (D9, D10) | `trust.learns` recovers planted weights within 0.2 after 2,000 resolved threads; a simulated no-show stream beats the prior on held-out Brier | `J/fit.py`, `J/sim.py` |
| N8 | Per-group `trust_b`; label sources and weights from the table; the five seed counts | each group's `trust_b` fitted on at least 300 threads or left at -4.0 | `T/params.ts`, `T/labels.ts` |

### Worked example

Every number is an example. A Facebook local listing, a phone with a keep of $300 at the valuation q50. Reproduced by `T/decide.test.ts`, "worked example".

1. Message 1, from an account 9 days old, asks to pay by Zelle now, asks for the seller's email, and sends a link. Hard: `asks_address_phone` locks `share_address`; the link is never opened. Scored: `off_platform` +2.0, `link_early` +1.0, `new_account` +0.7, `urgency_no_question` +0.5, `s = 4.2`. `L = 30000`, `F = 100 + 0.0538 · 30000 = 1714` cents. Line `ln(17.14 / 270) + 4.0 = 1.24`. 4.2 is over: ask. The group has 212 resolved threads, under 300, so no percentage.
2. Message 3, "I sent $350, please refund the $50": `overpay_or_shipping_label`, block, `scam_warning`.
3. The person taps Block buyer: scam label, weight 1.0. `r = 0.04`, prior `q = 0.04 · e^2.0 = 0.2956` at strength 20, `a = 5.91`, `b = 14.09`. The label adds 1 to `a`: `q = 6.91 / 21 = 0.329`, `w = ln(0.329 / 0.04) = 2.11`. That is inside [1.0, 3.0] (±50% of 2.0) by luck: nothing applies the band here (D5).
4. The thread's normalised message 1 gets a print. It is the third seller this week from a third buyer, so the next seller's copy scores +1.0 on arrival.
