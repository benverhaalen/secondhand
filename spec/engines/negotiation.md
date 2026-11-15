# Negotiation engine

*agent proposal* (the whole file). Canon names in [product.md](../product.md) win. This engine answers every offer, sends every counter and nudge, and drafts every offer the person makes as a buyer. It chooses the amount that maximises what the person expects to keep, inside their limits. It sits on top of [D16](../determinations/money.md#d16-offer-response), [card 7](../determinations/managing-and-buyers.md#7-how-to-answer-an-offer) and [D17](../determinations/money.md#d17-most-a-buyer-should-pay). The midpoint counter in D16 rule 2 becomes the champion, and a learned counter is the challenger that replaces it per site and category once it wins (§4).

## 1. What it decides

| Output | Decision kind ([the list](../product.md#decision-kinds-the-complete-list)) | Mode |
|---|---|---|
| Accept an offer | `accept_offer` | auto inside the limits, as D16 rule 1 and the person's mode allow ([§5](../product.md#5-who-may-act)) |
| Counter at an amount | `counter_offer` | auto after promotion; asks below the floor (`price_below_floor`) |
| Decline | `decline_offer` | auto after promotion |
| Wait: hold the reply until a set time | an `offer` job's `next_check_at`; no decision until it fires | follows the kind it then becomes |
| Offer to watchers or likers, with an amount and a time | `offer_to_watchers` (eBay, Depop) | auto after promotion |
| A nudge to a buyer who went quiet | a `send_message` draft through the [evidence gate](../product.md#evidence-gate-on-an-outgoing-message) | follows the reply kinds |
| Opening offer, as a buyer | `buy_offer` | asks every time |
| Answer to a seller's counter, as a buyer | `seller_counter`; `offer_over_ceiling` above max_pay | asks |

Every output carries `{amount, keep_at_amount, p_accept, expected_keep, v_after, basis_n, basis_dates, policy: champion or challenger, param_version}`. The new row `offer_outcome` (a name the canon lacks) records each offer round: `{conversation_id, item_id, site, round, side, offer, ask, counter, response: accepted, countered, declined, expired or walked, final_price, ms_to_response}`.

## 2. Signals

| Input | Source | Freshness |
|---|---|---|
| The offer, its terms (bundle, shipping), its expiry | `read_offers` or the message ([protocol](protocol-and-adapters.md)) | per event |
| The person's limits: `floor`, `always_accept`, current price | [D14](../determinations/money.md#d14-floor-and-always-accept), [D13](../determinations/money.md#d13-listing-price) | per event |
| What the person keeps at any price | `keep(x)` from [D9](../determinations/money.md#d9-what-you-keep-per-site) | cached per item |
| The value of not dealing now | the D15 path's expected keep from the current rung ([D15](../determinations/money.md#d15-markdown-path-stale-and-relist)), and D10 at the current price | recomputed hourly per item |
| The buyer, from this thread | the offer history in the thread: the opening ratio, each concession, the response latency, rounds so far. The message features: a named number, a commitment ("I can pay now"), questions answered, a reason given | per event |
| The buyer, from the account | `buyer_ref_hash` history inside this person's account only: past offers, past purchases, past no-shows | per event |
| The trust tier | [trust](trust.md): scam and no-show signals | per event |
| The market | how similar items sold: the accepted-offer discount `d_offer,cat` ([D1](../determinations/money.md#d1-comparable-set-and-weights)), watchers, likes and bag counts from `read_stats`, competing asks | hourly |
| Every past round | `offer_outcome` across all accounts, pooled with no buyer identity | per event |

## 3. The calculation

**The objective.** For each candidate amount `c`:

`E[keep](c) = P_accept(c) x keep(c) + (1 - P_accept(c)) x V_after(c)`

`V_after(c) = q_return(c) x E[keep | the buyer returns with a new offer] + (1 - q_return(c)) x V_wait`

where `V_wait` is the expected keep of the D15 plan from today. Accepting has `P_accept = 1`. Declining scores `V_wait`. Waiting scores `V_wait` plus the chance this buyer offers higher before expiry.

**The steps, model or rule:**

1. **Hard limits** (rules in code, before any model). These hold:
   - every candidate counter lies between `floor` and the current price;
   - an offer at or over `always_accept` is accepted, as D16 rule 1;
   - an offer under `floor` becomes `price_below_floor` and asks, as D16 rule 3;
   - a trust block from [trust](trust.md) stops the thread.
2. **Candidates** (arithmetic). The candidates are:
   - every price on a site ending (endings in 5 or 8 above $20, whole dollars below) between `floor` and the current price;
   - accept;
   - decline;
   - wait.
3. **P_accept** (a model). A hierarchical Bayesian logistic regression, `logit P = b_global + b_site + b_category + b_site_category + w . x`, with partial pooling. `x` holds:
   - the gap ratio `(c - offer) / (ask - offer)`;
   - `c / ask`;
   - the round;
   - days listed;
   - the buyer's last concession as a share of the gap;
   - the response latency;
   - the commitment and number features from the message extractor (Claude Haiku: booleans with evidence spans; amounts are parsed in code);
   - watcher and like counts.

   The prior is built from the concession curve in the literature, `F(t) = k + (1 - k) t^(1/beta)` (time-dependent negotiation tactics; *inferred*). Its slope is set so a counter at the midpoint is accepted half the time, which makes the champion the prior's own optimum. Before any data, the engine picks the midpoint.
4. **V_after and V_wait** (arithmetic over D10 and D15). `q_return` is a second logistic with the same features, fitted on threads where a declined or countered buyer offered again.
5. **The choice** (arithmetic): `argmax E[keep]` over the candidates. During learning the challenger draws one posterior sample of the weights per offer (Thompson sampling), so it explores only inside the hard limits.
6. **When to wait** (a rule over the model). Wait wins when `V_wait + P(higher offer before expiry) x gain > max E[keep]`. In practice that is a fresh listing with rising watchers, or a second buyer active ([card 22](../determinations/managing-and-buyers.md#22-which-buyer-gets-the-item-when-several-want-it)). A wait holds the reply until 2 h before the offer's expiry, or until the next offer arrives, whichever comes first.
7. **Bundles** (arithmetic): summed keep against summed `V_wait`, as D16 rule 4.
8. **Several buyers**: card 22 orders them; this engine answers each in turn with `V_wait` raised by the other buyers' offers.

**Offers to watchers and likers.** On the sites with the verb, one offer goes out per item per D15 rung. The amount is the same argmax, with `P_accept` fitted on watcher-offer outcomes. The send time is learned per site from the hour-of-week response rate (a Beta per hour bucket, prior flat). The rung days come from D15, and the levers from [D26](../determinations/listing-and-marketing.md#d26-engagement-levers-the-agent-runs-on-its-own).

**Nudges.** One follow-up goes to a buyer who stopped answering after a counter, at the hour their thread was most active, after 24 h, and never twice. A second nudge only follows a new message from the buyer.

**The buying side.** The person sets the target, and [D17](../determinations/money.md#d17-most-a-buyer-should-pay) gives `max_pay`. The opening offer is `argmax_o P_seller_accept(o) x (max_pay - o)` over site endings at or under `max_pay`. `P_seller_accept` is the same logistic, fitted on our sellers' responses (`offer_outcome` rows with `side: sell`, pooled) and on accepted Best Offer amounts read through seller sessions (D1). A seller's counter is answered with the same argmax. Every `buy_offer` asks every time, and an amount over `max_pay` is `offer_over_ceiling`. On eBay, an accepted Best Offer binds the buyer (canon), so the decision card states that before the tap.

**The words.** The amount comes from code. The model drafts the reply text around it, and the evidence gate checks the text; an amount in the draft that differs from the decided amount fails the gate. The floor and `always_accept` never enter a prompt.

## 4. Learning

| What | When | Algorithm | Prior | Switch and rollback |
|---|---|---|---|---|
| `P_accept` weights per (site, category) | per `offer_outcome` | an online Laplace update of the site and category terms, with forgetting at a 30-day half-life ([real-time weights](../product.md#real-time-weights-agent-proposal)) | the concession-curve prior in §3 step 3 | the guards: ±50% from the prior per param, probabilities in [0.02, 0.98] |
| The full hierarchy | nightly | a refit of the hierarchical logistic on all `offer_outcome` rows, then `param_fold` | last night's posterior | a new version only if held-out log loss improves |
| `q_return` | nightly | the same refit | 0.2 | the same |
| Watcher-offer send hour | per send | a Beta per hour-of-week bucket | Beta(1,1) | none needed |
| Champion against challenger | weekly per (site, category) | a comparison of realised keep per offer on matched offers | the midpoint champion | below |

**The switch rule.** The challenger becomes the policy for a (site, category) cell when all three hold:
- at least 50 offers have been answered by each policy in that cell;
- the bootstrap 95% lower bound of the challenger's keep gain per offer is above 0;
- its `P_accept` calibration error is within 5 points.

**Rollback.** If the cell's realised keep per offer then falls 2 SE below the champion's trailing mean for a week, the policy returns to the champion with one UPDATE of `param_version`. Matched offers are those of the same site, category, round and gap-ratio bucket.

## 5. Speed

| Moment | Budget | Kept warm |
|---|---|---|
| An offer arrives to the decision made | p95 1 s for the amount (canon reply budget: within 60 s, offers by rule) | `keep(x)`, `V_wait`, the floor and the posterior per item, held in the item's cache and refreshed hourly |
| The message features | p95 1.5 s (Haiku) | none |
| The reply sent, auto mode | within 60 s of the offer (canon) | the leased session ([protocol](protocol-and-adapters.md)) |
| The buyer's opening offer shown | under 2 s after D17 | the D17 inputs |

The amount never waits for the model's text. If the extractor fails, the engine decides on the thread's numbers alone and marks `features: partial`.

## 6. What the person sees

The decision card says, for example, "Countered $75. Buyers took counters like this 30% of the time; you'd keep $55.40 if they do." A tap shows:
- the keep at each candidate;
- `V_wait`;
- the basis, written as "Based on N offers on similar items from <dates>";
- the policy that chose it.

The person can:
- choose another amount from the same list;
- change the floor or `always_accept`;
- set the mode per kind.

An edited amount is an `offer_outcome` with `overruled: true`. It trains the model only through the buyer's response, never as a label of its own. Promotion follows [§5](../product.md#5-who-may-act): 3 unedited approvals seen.

## 7. How it beats what exists

| Rival | What it does (mark) | Ours |
|---|---|---|
| eBay auto-decline and auto-accept, Depop auto-respond (*observed*, cited in [D16](../determinations/money.md#d16-offer-response)) | a fixed floor and a fixed accept line | judged on keep and on the value of waiting, with a counter chosen by measured acceptance |
| Crosslisters' bulk offers ([parity](../parity.md); *asserted*) | one discount to all watchers or likers | an amount and an hour per item, learned from responses |
| Nifty daily offers; likers targeting not stated on its pricing page ([parity](../parity.md); *observed*) | an automatic send each day | one send per D15 rung, with the amount from the argmax and a learned send hour |
| Split the difference (the norm behind D16, *asserted*) | the midpoint | kept as the champion; replaced per cell only when beaten on realised keep |
| Buyer tools in [parity](../parity.md) | none named that drafts an opening offer against a computed ceiling | `max_pay` from D17 and the opening argmax, asked every time |

## 8. Protections

- The floor, `always_accept` and the person's limits are enforced in code before the choice, and checked again before the outward verb ([§5 policy check](../product.md#5-who-may-act)).
- The floor and limits never enter a prompt. The amount is never written by a model.
- An injected instruction in a buyer's message ([card 2](../determinations/managing-and-buyers.md#2-whether-incoming-text-is-trying-to-instruct-the-agent)) cannot move an amount: no message feature changes the candidate set.
- A trust block ([trust](trust.md)) ends negotiation on that thread.
- Buyer history is read only inside the person's own account. The pooled model sees no buyer identity, and nothing uses names, language or location as a feature.
- Exploration never leaves the candidate set, so a learning step never costs below the floor.
- An `outcome_unknown` answer is reconciled, never resent ([protocol](protocol-and-adapters.md)).

## 9. Proof

| Test | Runnable in a day as | Passes when |
|---|---|---|
| Limits property test | 10,000 random states: offer, ask, floor, `always_accept`, endings, sites | zero counters outside [floor, ask]; every offer at or over `always_accept` accepted; every offer under the floor asks |
| Scripted buyers | 200 simulated buyers whose walk-away prices are drawn from accepted Best Offer amounts and our accepted counters, run against the champion and the challenger | the challenger's mean keep per offer beats the champion's, with a bootstrap 95% lower bound above 0 |
| Calibration | held-out `offer_outcome` rows, by decile of `P_accept` | within 5 points per decile with 30 or more rows |
| The amount and the text agree | 500 drafted replies, with 50 seeded with a wrong amount | the gate fails all 50 and passes the clean drafts |
| Injection | 50 offers whose messages tell the agent to accept | zero amounts changed |
| The D16 check, unchanged | [D16](../determinations/money.md#d16-offer-response): countered items against later sale keep | fewer than half of countered items later sell for less than the declined offer's keep |

The result that counts: realised keep per offer against the midpoint champion, per (site, category), reported with its count and dates.

The fixed set: 50 real offer threads, frozen with their outcomes, across eBay, Poshmark, Depop and Mercari. For the buying side, 10 real buys must close at or under `max_pay` in at least 8 of 10.

## Open from the audit (checked 2026-11-15)

Each row of the Negotiation section of [audit.md](audit.md) was checked against the code. 27 of 32 are closed. These 5 are still open, worst first.

| # | What is wrong | Where (file:line today) | Fix | Test that proves it |
|---|---|---|---|---|
| NG-A1 | The nightly fit publishes the promoted `P_accept` and `q_return`, but nothing in TypeScript loads them. Counters are scored with whatever `pAccept` the caller passes, not the learned model. | `app/src/engines/negotiation/policy.ts:62` (`offerFromRegistry` reads only `negotiation_policy`); `jobs/negotiation/fit.py:155` | Add a loader that reads the champion `P_accept` and `q_return` payloads (terms, weights, label) by scope and builds the two functions. `offerFromRegistry` uses them when present. | Write a `P_accept` champion row with global term logit(0.9) and zero weights into a memory store. `offerFromRegistry` on a 10000 ask and 6000 offer returns candidates with `p_accept` 0.9 (inside the p bounds). With no row it returns the champion midpoint with `p_accept` null. A parity fixture: TS predict equals Python `Logistic.predict` on 5 rows within 1e-9. |
| NG-A2 | The person's learned traits never reach the posture. `offerFromRegistry` takes `posture` as an argument, and no caller reads `person_posture` or `person_policy_agree`. | `policy.ts:62`; `app/src/engines/person/person.ts:65` | Resolve posture from the person's `person_posture` read and the site's category policy before `offer()`. | A person with 10 `posture_chosen` events at 0.9 gets a higher `accept_line_cents` than a new person on the same state (floor 5000, always_accept 9000). A second person's events change nothing. |
| NG-A3 | A settled outcome updates only the in-memory row. No call persists the outcome or refreshes the model read. | `app/src/engines/negotiation/outcome.ts:28` (`settle`) | In the same call as `settle`, hand the settled row to a writer the Python fold reads, and invalidate the reader. | Settle one accepted round. The writer is called once with the outcome id and `accepted: 1`, and the cached reader is invalidated. Settling the same round again with the same response calls the writer zero times. |
| NG-A4 | `online_update` defaults `days` to 0 and the model stores no event time, so forgetting disappears unless the caller supplies elapsed days. | `jobs/negotiation/fit.py:90` | Store `last_event_at` in the model payload. Require the event time. Derive `days` from it. | A model last updated at day 0, updated again at day 30 with the same row: precision is halved before the new information is added. A call with no event time raises. |
| NG-A5 | No watcher-hour Beta exists. Watcher outcomes do not update scoped send-hour posteriors, and nothing uses them to schedule the next send. | `jobs/negotiation/fit.py:90` (the only online path); `negotiation.md` lines 73 and 88 | Record watcher offer outcomes into a Beta per (scope, hour of week). The scheduler picks the hour with the best posterior mean. | Three accepted watcher offers at hour 19 on ebay give Beta(4,1), mean 0.8, against 0.5 at hour 3. The next send is scheduled at hour 19. Another person's outcomes do not move it. |

## 10. Build tasks

The paths are proposed. Tasks 1, 2 and 4 run in parallel; 3 needs 1 and 2; 5 needs 3.

| # | Task | Owned files | Depends on | Proof command |
|---|---|---|---|---|
| 1 | The hard limits, candidates and the argmax, given a `P_accept` function | `app/src/engines/negotiation/choose.ts`, `choose.test.ts` | none | `node --test app/src/engines/negotiation/choose.test.ts` (the limits property test) |
| 2 | The `offer_outcome` row and its writes from `read_offers` and replies | `app/src/engines/negotiation/outcome.ts`, `outcome.test.ts` | none | `node --test app/src/engines/negotiation/outcome.test.ts` |
| 3 | The hierarchical logistic: nightly fit, per-event update, guards | `jobs/negotiation/fit.py`, `jobs/negotiation/test_fit.py` | 1, 2 | `python -m pytest jobs/negotiation/test_fit.py` (calibration on a fixture set) |
| 4 | The scripted-buyer harness | `jobs/negotiation/sim.py`, `jobs/negotiation/test_sim.py` | none | `python -m pytest jobs/negotiation/test_sim.py` |
| 5 | Champion and challenger with the switch rule and rollback; the buying-side opener | `app/src/engines/negotiation/policy.ts`, `policy.test.ts` | 3 | `node --test app/src/engines/negotiation/policy.test.ts` |

## Worked example

All numbers here are examples.

**The setup.** An eBay listing at $80, with a floor of $60 and `always_accept` at $72. The fees are 13.6% plus $0.40, and the seller pays $9 shipping, so `keep(x) = 0.864x - 9.40`. `V_wait = V_after = $44.00`. A buyer offers $62.

**The rules.** $62 sits between the floor and `always_accept`. `keep(62) = 44.17`, which is at least `V_wait`, so D16 alone would accept.

**The candidates.** Using the endings rule:

| Counter | keep | P_accept | E[keep] |
|---|---|---|---|
| $65 | 46.76 | 0.70 | 45.93 |
| $68 | 49.35 | 0.55 | 46.94 |
| $75 | 55.40 | 0.30 | 47.42 |
| $78 | 57.99 | 0.18 | 46.52 |
| accept $62 | 44.17 | 1.00 | 44.17 |
| wait | none | none | 44.00 |

**The choice.** The champion's midpoint, (62 + 80) / 2 = 71, rounds to $68. The challenger picks $75. Over many such offers it keeps $0.48 more than the midpoint and $3.25 more than accepting. That is the gap the weekly switch rule measures.
