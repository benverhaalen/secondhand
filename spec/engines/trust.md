# Trust engine

*agent proposal* (the whole file). Canon names in [product.md](../product.md) win. This engine joins five cards into one build: scams ([card 5](../determinations/managing-and-buyers.md#5-how-likely-a-buyer-is-a-scam)), no-shows ([card 6](../determinations/managing-and-buyers.md#6-how-likely-a-buyer-will-not-show)), account health ([card 17](../determinations/managing-and-buyers.md#17-whether-an-account-is-healthy-or-at-risk)), recalls ([seeing the item, card 20](../determinations/seeing-the-item.md#20-recall-or-safety-flag)) and counterfeits. The cards hold the start values; this file says how they run, what learns, and how the rows in [cannot be made credibly now](../determinations/managing-and-buyers.md#cannot-be-made-credibly-now) become credible.

## 1. What it decides

For every buyer thread, appointment, listing, purchase the person is weighing and account, one action per risk:

| Action | What it does |
|---|---|
| block | the agent will not do it. No draft is sent, no link is opened, nothing is shared, and the commit is not offered as one tap. A `scam_warning` card opens with Block buyer, Reply with safety line and Ignore ([messages](../features/messages.md)). The person can still act by hand |
| ask | the agent drafts and the commit (accept, book a pickup, mark sold, post, contest) waits for the person's tap, whatever the kind's mode ([who may act](../product.md#5-who-may-act)) |
| warn | the agent goes ahead in the kind's mode and shows one line with the reason |
| none | nothing is shown |

The objective is the lowest expected cost per decision: `cost(a) = p · L · miss(a) + (1 - p) · F(a)`, where `p` is the risk, `L` the money lost if the risk comes true, `miss(a)` how often the harm still happens under action `a`, and `F(a)` what the action costs an honest buyer or the person. Locked actions, hard rules and recall flags sit outside the objective: they are fixed ([real-time weights](../product.md#real-time-weights-agent-proposal), the fixed list).

Two rows the canon lacks:

```
trust_signal { conversation_id | appointment_id | listing_id | account_id, message_id?, signal, present: bool,
               evidence_span, extractor: code | model, model_version, confidence, at }
trust_label  { subject_id, kind: scam | no_show | dispute | not_authentic | challenge,
               value: 0 | 1, weight, source, observed_at, resolved_at }
```

A third table, `script_print`, holds salted 64-bit SimHash prints of normalised buyer messages (no text) with the count of distinct sellers and buyers that received them in the last 7 days.

## 2. Signals

Every signal is either code (a regex, a site field the adapter reads, a lookup) or the model's reading through the [card 1](../determinations/managing-and-buyers.md#1-what-a-message-means) extractor, with the evidence span kept. Predicates and their names follow [messages and offers](../../research/messages/ben/messages-and-offers.md). No signal reads a name, a language, a dialect or where the buyer is.

### Scam: hard rules (fixed, never learned)

| Signal | Read by | Action |
|---|---|---|
| Asks for a code sent to the seller's phone | model (`asks_code`) | block; no reply drafted |
| Claims an overpayment, sends a check, asks for the difference back | model (`overpay_or_shipping_label`) | block |
| Says payment was sent while the site shows no order | model (`claims_paid`) plus the adapter's order state | block on sites with checkout; on a Facebook local deal, ask the person to check their own payment app before handing over |
| Asks the seller to use the buyer's own label or courier | model (`overpay_or_shipping_label`) | block |
| A link that claims to be a payment, a verification or the site's own page | code (URL, domain against the site's) | block; the agent never opens a buyer's link |
| Asks to pay or talk off-site on a deal with checkout | model (`off_platform`) | block for the agent (`move_off_site` is locked), and +2.0 to the score |
| Asks for the seller's address or phone | model | block for the agent (`share_address` is locked) |
| A draft would call the item authentic | code on the draft | block the draft (`identity_claim` is locked) |

The patterns are from [trust, returns, disputes §8](../../research/sold/nate/trust-returns-disputes.md#8-local-pickup-scams-safe-exchange-cash-versus-in-app) and the Facebook list in [facebook-marketplace](../../research/list/ben/platforms/facebook-marketplace.md) (asserted there). Locked kinds are in [decision kinds](../product.md#decision-kinds-the-complete-list).

### Scam: scored signals (learned, card 5's weights as the prior)

| Signal | Read by | Prior weight | Source of the prior |
|---|---|---|---|
| Asks to pay off-site before meeting, or off-site on a deal with checkout | model | +2.0 | card 5. On a Facebook local deal, cash or an app payment at the meeting scores 0: that is how local sales are paid ([facebook-marketplace](../../research/list/ben/platforms/facebook-marketplace.md), asserted) |
| Asks to ship a local-only listing to another address | model | +1.5 | card 5 |
| A link in message 1 or 2 | code | +1.0 | card 5 |
| Account under 30 days old, or no ratings | adapter | +0.7 | card 5 |
| Urgency with no question about the item, over $200 | model plus the price | +0.5 | card 5 |
| 10 or more good purchases on the site | adapter | -1.5 | card 5 |
| A third party collects ("my mover will pick it up") | model | +1.5 | the "mover with a check" pattern in [facebook-marketplace](../../research/list/ben/platforms/facebook-marketplace.md), asserted |
| The site's own warning banner in the thread | adapter | +2.0 | the site's own word, as card 17 ranks it |
| Same `script_print` from 3 or more buyers to 3 or more sellers in 7 days | code | +1.0 | inferred: honest buyers write their own words |
| The buyer sent the same text to 5 or more of the person's listings within 10 minutes | code | +0.7 | inferred, as weak as a new account |

### No-show (card 6's weights as the prior)

| Signal | Prior weight | Action it can reach |
|---|---|---|
| A past no-show with this seller | +2.0 each | 2 or more: ask before booking |
| Paid in-app before pickup | -3.0 | none |
| Exact time agreed and confirmed in the last 24 h | -1.0 | none |
| Vague time | +1.0 | warn, and a confirm goes out |
| New account, no ratings | +0.5 | none alone |
| Hard haggling, then accept | +0.3 | none alone |
| Already rescheduled once | +0.7 (inferred) | warn |
| Replied to the confirm within 30 min | -1.5 (inferred) | none |

### Account health (card 17's arithmetic)

Site warnings, challenge pages, session expiry, the probe, the action error rate, our engagement volume against the [D26](../determinations/listing-and-marketing.md#d26-engagement-levers-the-agent-runs-on-its-own) pace limit, and seller metrics against published thresholds (Poshmark: 3% cancellations over a rolling 90 days, then a 24 h restriction, then a 14-day suspension). Added: every `route_call` across all accounts records whether it met a challenge page, bucketed by the account's actions per hour on that site.

### Recall (fixed, never learned)

Card 20's matching on brand plus model number or GTIN against the daily CPSC mirror ([data](../features/data.md)). The engine adds two triggers: every new day's recall rows are matched against every live listing and draft, and every item the person weighs buying in [buy](../features/buy.md) is matched before a `buy_offer` is drafted.

### Counterfeit

| Signal | Read by | Action |
|---|---|---|
| The person's item is a brand on the counterfeit-prone list (`param`, seeded from the brands the authentication programmes cover) with no proof photo (receipt, serial, date code) | the item card | ask for the proof photo before posting where "not authentic" is a buyer case reason (Poshmark, Depop: *observed*, [trust, returns, disputes §6](../../research/sold/nate/trust-returns-disputes.md#6-counterfeits-and-authentication)) |
| The price is at or over Posh Authenticate's floor ($500 USD, *observed*, same source) | arithmetic | warn: Poshmark checks it before it reaches the buyer and cancels the order if it cannot confirm it ([sold](../features/sold.md)) |
| The eBay listing falls in an Authenticity Guarantee category and price floor (select shoes from $75, *observed*; other floors unread in the same source) | arithmetic | warn, with the route |
| A listing the person weighs buying is priced under 0.6 x the [valuation](valuation.md) q50 for a counterfeit-prone brand | arithmetic | warn, with both numbers |
| Its photos match a retail or stock image (reverse match through the information engines) | code | warn |
| Both of the above plus a seller account under 30 days | code | added as a reason on the ask that `buy_offer` already has, and the engine ranks listings covered by an authentication programme first |

The engine never says an item is fake or authentic; authenticity is never inferred (fixed in [real-time weights](../product.md#real-time-weights-agent-proposal)). Its signals describe the listing, not the item.

### Disputes

For each case: site, case reason ([trust, returns, disputes §2](../../research/sold/nate/trust-returns-disputes.md#2-disputes-and-case-timelines)), whether the [card 19](../determinations/managing-and-buyers.md#19-what-evidence-to-assemble-for-a-dispute) bundle was complete, and the outcome the adapter reads when the case closes.

## 3. The calculation

| Step | Model or arithmetic |
|---|---|
| 1. Code signals on arrival: URLs, phone and email patterns, prints, the site's order state, the buyer profile (cached 24 h, card 5) | arithmetic and lookups |
| 2. Text predicates with evidence spans | model (Haiku through card 1); if the model fails or times out, the commit becomes ask and the reason says the check did not finish |
| 3. Any hard rule present: block, stop | rules |
| 4. Score `s = sum(w_i · x_i)` over present scored signals; `logit p = b_g + s`, with `b_g` the base log-odds of the site group (`facebook_local`, `facebook_shipped`, `ebay`, `poshmark`, `mercari`, `depop`) | arithmetic |
| 5. Loss `L` = the item's keep at the [valuation](valuation.md) q50, plus any amount the buyer asked to have sent back; at least $20 | arithmetic |
| 6. Friction `F_ask = c_tap + delta · L`: a tap's cost plus the share of honest sales lost to the wait | arithmetic |
| 7. Ask when `p · L · (1 - m_ask) >= (1 - p) · F_ask`, that is `b_g + s >= ln(F_ask / (L · (1 - m_ask)))`. Warn when `s` is within `warn_gap` (0.5) of the ask line | arithmetic |
| 8. Block from the score alone only when the calibrated `p >= 0.95` and the calibration gate in section 4 has passed for the group | rules |
| 9. No-show: `logit q = b_ns + sum(v_j · y_j)`; confirm 2 h before at the confirm line (card 6's `s >= 1.0`), ask before booking at `s >= 3.0`; 15 min of silence after the slot starts records `no_show`, reopens the item and offers it to the next buyer from [card 22](../determinations/managing-and-buyers.md#22-which-buyer-gets-the-item-when-several-want-it) | arithmetic and rules |
| 10. Account health: `risk = max(metric_i / threshold_i)`, flag at the learned `flag_m` (start 0.8); a projected crossing on the next action (one more cancel) turns that action into ask; a site warning sets `paused` and blocks every action on the site ([card 3](../determinations/managing-and-buyers.md#3-whether-an-action-is-allowed-asked-or-locked)) | arithmetic and rules |
| 11. Recall: card 20's exact match blocks `post` and takes live listings down through [card 13](../determinations/managing-and-buyers.md#13-which-listings-come-down-in-what-order-and-when-a-failed-delist-turns-red); a name-only match holds and asks; on the buy side, the agent drafts no `buy_offer` and the notice is shown | rules |
| 12. Counterfeit: the table in section 2 | arithmetic and rules |

Start values: `b_g = -4.0`, `m_ask = 0.1`, `c_tap = $1.00`, `delta = 0.0538`. They are set together so that at the reference loss `L_ref = $50` the ask line is exactly `s = 1.5`, card 5's elevated line: `F_ask(50) = 1.00 + 2.69 = 3.69`, and `ln(3.69 / 45) = -2.50 = b_g + 1.5`. Above `L_ref` the line falls slowly (at $300 it is 1.24), so a dear item is asked about sooner. Before the gate passes, `p` is a score and is never shown as a number.

The score is a scored sum and not a model's free reading because each term is a named reason the person can read and a label can correct. The model only reads predicates; it never decides the action.

## 4. Learning

Every event starts the engine's pipeline: a message in, an appointment booked or due, a listing posted, a recall row added, an order cancelled, a metric read, a case closed and a label written. Every number below is a `param` row with the written value as its prior ([real-time weights](../product.md#real-time-weights-agent-proposal), [data](../features/data.md#real-time-weights-agent-proposal)).

### Labels

| Source | Label | Weight |
|---|---|---|
| The person taps Block buyer on a thread | scam 1 | 1.0 |
| The site removes or suspends the buyer within 30 days (the adapter reads the profile) | scam 1 | 0.8 |
| The person taps Ignore on a `scam_warning` | scam 0 | 0.3 |
| A sale through the site's checkout that passes the buyer's claim window with no case (Poshmark and Mercari 72 h after delivery, *observed*; eBay's window by its policy) | scam 0 | 1.0 |
| A local pickup the person marks done | scam 0 | 0.7 |
| Seeded threads written from published scam scripts (FTC and IC3 pages, the research above) | used to test the extractor's recall only; never counted in a base rate | 0 |
| Every appointment: came, or `no_show` at 15 min | no_show 1 or 0 | 1.0 |
| A case closed by the site | dispute 1 (won) or 0 | 1.0 |
| A Posh Authenticate failure or a "not authentic" case | not_authentic 1 | 1.0 |
| A challenge page or site restriction on a `route_call` | challenge 1, else 0 | 1.0 |

A thread is resolved when it has a label or its claim window has passed. One seller's labels count for at most 5% of any signal's positive weight, so no single account can steer the weights for everyone.

### Cadence and algorithm

| When | What |
|---|---|
| Per event, in the label's transaction | For each scored signal `i` and site group: `r_i`, its rate in all threads (scams are a small share, so this is the honest rate from day one), and `q_i ~ Beta(a_i, b_i)`, its rate in positive threads. Prior `q_i = r_i · e^(w_i)` at a strength of 20 threads. A positive label adds its weight to `a_i` or `b_i`; `w_i = ln(E[q_i] / r_i)`. All counts decay with a 30-day half-life. The same update runs for no-show signals on appointment labels, for `b_ns` as `Beta(1, 4)` on the no-show rate, and for disputes as `Beta(1, 1)` per (site, reason, bundle complete) |
| Per event | `flag_m` per (site, metric): a site warning at ratio `r < flag_m` sets `flag_m = 0.9 · r` |
| Per event | Pace: `Beta(1, 99)` on challenges per action, per (site, actions-per-hour bucket); the pace limit is the highest bucket whose 95% upper bound is at or under 1% |
| Nightly (`param_fold`) | A challenger: L2 logistic regression on resolved threads, weighted by label weight and the 30-day decay, with a Gaussian prior centred on the written card weights (sd 0.5). It handles signals that come together (off-site and a link), which the per-event counts add twice. Then isotonic calibration per site group on the last 30 days held out. The same fit runs for no-shows |
| Nightly | The extractor's threshold per predicate (start values from [messages and offers](../../research/messages/ben/messages-and-offers.md): 0.1 for `asks_code`, 0.2 for the others) moves to keep recall at or over 0.95 on the seeded and labelled set |

### Switch rule

A challenger becomes champion when, on the held-out 30 days with at least 30 weighted positives: its total decision cost is lower with the bootstrap 95% lower bound of the gain above 0; its recall of positives at ask or above is not lower than the champion's; and no hard-rule outcome changes. Guards from the canon hold: each scored weight stays within ±50% of its written value until that signal has 30 positive and 30 negative resolved threads, and a raise never turns into a lowering until it has 100.

### The calibration gate (row 703 and row 704)

A percentage is shown for a site group only with at least 300 resolved labelled threads (or appointments), at least 30 positives and an expected calibration error within 5 points on the held-out 30 days. Below the gate the person sees reasons and real counts.

### Rollback

One UPDATE puts the previous champion back when: a confirmed scam reached none or warn while carrying a listed signal; more than 1 in 3 asked threads end in a normal sale, over at least 30 (card 5's check); no-show rates above and below the confirm line stop differing by more than 2 SE over 50 appointments (card 6's check); a site warning arrives for a metric under its flag (card 17's check); or the daily ask rate moves over 2 SE.

## 5. Speed

| Path | Budget |
|---|---|
| Code signals and the score | under 50 ms on arrival |
| Text predicates | under 2 s p95; a reply is never sent before the trust result exists ([evidence gate](../product.md#evidence-gate-on-an-outgoing-message), [card 4](../determinations/managing-and-buyers.md#4-whether-a-drafted-reply-may-be-sent)), which keeps the 60 s reply |
| Buyer profile | read once, cached 24 h |
| `script_print` | a lookup under 10 ms; counts updated on every message |
| No-show | at booking and 2 h before |
| Recall | the daily delta matched against all live listings and drafts in one pass; a buy-side match inside the 10 s Check |
| Account health | on each cancel, each `route_call` and once a day per account |
| Params | read through the 60 s cache |

## 6. What the person sees

Words follow [copy](../../product/copy.md); these are the shapes.

| Case | What shows |
|---|---|
| block | "This buyer asked for a code sent to your phone. That's a known scam. Don't share it." Block buyer · Reply with safety line · Ignore. Tap opens the lines and what the scam does |
| ask | the commit button carries the reason: "Check before you accept: they want to pay by Zelle before meeting." |
| warn | one line under the thread: "Don't open links from buyers." |
| real counts | "Seen in 41 threads people here reported as scams this month", from `trust_label`, always the window and the count |
| percentage | only past the gate: "About 3 in 10 threads like this were scams (212 checked)" |
| no-show | "Missed 1 of 2 pickups with you. Confirm sent." |
| account | card 17's line, plus the pace: "At this pace, 3 of 412 accounts got a check page in 30 days." |
| dispute | "Won 14 of 17 cases like this", shown from 10 closed cases |
| recall | the notice, its remedy, and which listings came down |
| counterfeit | "Priced at $120. This model usually sells for $310." and the authentication route, never a verdict |

## 7. How it beats what exists

- No product in [parity](../parity.md) screens buyer threads, scores no-shows or ties a recall feed to live listings; the table has no row for any of them. The sites screen their own channels, one site at a time.
- One seller sees their own threads. The engine sees every seller's: a script that reaches three sellers today scores for the fourth within the hour, through prints that carry no text.
- It replaces card 5's fixed sum with weights that learn from labels, and a loss that scales with the item, while starting from exactly card 5's decisions. The test that proves the gain is the switch rule: a challenger is only promoted when it lowers the decision cost on held-out threads.
- Row 705 becomes a measured challenge rate per pace with its count, not a ban guess; row 706 becomes won-of-closed counts per site and reason.

## 8. Protections

- The agent never opens a buyer's link, never reads back a code, never shares an address and never moves a deal off-site. These are fixed and outside learning.
- Block stops the agent, not the person; ask and warn can always be overridden by a tap.
- A model failure turns the commit into ask, never into block and never into silence.
- Incoming text never grants authority ([card 2](../determinations/managing-and-buyers.md#2-whether-incoming-text-is-trying-to-instruct-the-agent)). Row 708 is answered by limiting what text can do, plus a measured catch rate on a fixed injection set, reported with the set's size.
- No signal reads a name, a language, a dialect or the buyer's location. A counterfactual test swaps them and the score must not move.
- Prints are salted SimHash with the salt rotated monthly; no buyer text crosses accounts. Rows obey `may_model` ([databricks](../databricks.md), [data use](../data-use.md)).
- The 5% cap per seller keeps one account from poisoning shared weights.
- Row 707, whether the assistant tells buyers it is answering, stays with Ben and Nate ([open](../product.md#9-open-for-ben-and-nate)). If they allow both arms, the engine measures it as a randomised holdout on the sale rate.

## 9. Proof

| Test | Passes when |
|---|---|
| `trust.prior_equals_card5` | with the priors, every card 5 and card 6 fixture gets card 5's and card 6's action at `L_ref` |
| `trust.hard_rules` | each hard fixture blocks, no draft is sent and the network mock records zero fetches of the link |
| `trust.extractor_recall` | recall at or over 0.95 on the seeded and labelled scam set, false positives at or under 2% on the honest set |
| `trust.counterfactual` | swapping names, language and place changes no score |
| `trust.model_down` | an extractor timeout turns every commit into ask |
| `trust.gate` | no percentage is rendered below 300 threads, 30 positives or above 5 points of calibration error |
| `trust.learns` | on a simulated label stream with planted weights, the champion recovers each within 0.2 after 2,000 resolved threads, and a planted bad challenger is never promoted |
| `trust.rollback` | each rollback trigger restores the previous champion in one UPDATE |
| `trust.poison_cap` | 500 labels from one seller move no weight past its 5% share |
| `trust.recall_delta` | a new CPSC row takes the matching fixture listing down in one run |
| `trust.health_flag` | a warning at ratio 0.7 sets that metric's flag to 0.63 |
| `trust.speed` | code path p95 under 50 ms and the full path under 2 s on 1,000 fixture threads |

## 10. Build tasks

The paths are proposed. Tasks 1, 2 and 4 run in parallel; 3 needs 1 and 2; 5 needs 3; 6 needs 3.

| # | Task | Owned files | Depends on | Proof command |
|---|---|---|---|---|
| 1 | Code signals, hard rules, prints and the link guard | `app/src/engines/trust/signals.ts`, `hard.ts`, `signals.test.ts` | the card 1 extractor and the [adapters](protocol-and-adapters.md) | `node --test app/src/engines/trust/signals.test.ts` |
| 2 | `trust_signal`, `trust_label`, `script_print`, the per-event Beta updates and the poison cap | `app/src/engines/trust/labels.ts`, `labels.test.ts` | none | `node --test app/src/engines/trust/labels.test.ts` |
| 3 | The score, loss, friction and action; the gate; what the person sees | `app/src/engines/trust/decide.ts`, `decide.test.ts` | 1, 2 | `node --test app/src/engines/trust/decide.test.ts` (the worked example below as a fixture) |
| 4 | No-show, account health with flags and pace, disputes, recall and counterfeit triggers | `app/src/engines/trust/noshow.ts`, `health.ts`, `recall.ts`, `counterfeit.ts`, `rest.test.ts` | the [valuation](valuation.md) q50 | `node --test app/src/engines/trust/rest.test.ts` |
| 5 | The nightly fit, isotonic calibration, extractor thresholds, switch and rollback | `jobs/trust/fit.py`, `jobs/trust/test_fit.py` | 3 | `python -m pytest jobs/trust/test_fit.py` |
| 6 | The simulated label stream and the speed bench | `jobs/trust/sim.py`, `jobs/trust/test_sim.py` | 3 | `python -m pytest jobs/trust/test_sim.py` |

## Worked example

Every number here is an example. A Facebook local listing, a phone with a keep of $300 at the valuation q50.

1. Message 1, from an account 9 days old: "Still available? I'll pay by Zelle now, send me your email so I can lock it in. Here's my number: [a link]."
   - Hard rules: asks for the seller's email, so `share_address` is locked and the agent will not give it; the link is never opened.
   - Scored: pay off-site before meeting +2.0, a link in message 1 +1.0, new account +0.7, urgency with no item question over $200 +0.5. `s = 4.2`.
   - `L = $300`. `F_ask = 1.00 + 0.0538 · 300 = 17.14`. Line: `ln(17.14 / 270) = -2.76`, so ask at `s >= -2.76 + 4.0 = 1.24`. 4.2 is over it: ask, and every commit waits for the person.
   - The group has 212 resolved threads, under 300, so no percentage. The person sees "Check before you reply: they want to pay by Zelle before meeting, and sent a link in their first message." and "Seen in 41 threads people here reported as scams this month."
2. Message 3: "Zelle says you need a business account. I sent $350, please refund the $50." Overpayment: hard. Block, a `scam_warning` with Block buyer, Reply with safety line and Ignore.
3. The person taps Block buyer: a scam label of weight 1.0. The off-site signal's rate in all Facebook local threads is `r = 0.04`. Prior `q = 0.04 · e^2.0 = 0.2956` at strength 20: `a = 5.91`, `b = 14.09`. The label adds 1 to `a`: `q = 6.91 / 21 = 0.329`, `w = ln(0.329 / 0.04) = 2.11`, inside the guard of 1.0 to 3.0. The next thread with an off-site ask reads 2.11 from the 60 s cache.
4. The thread's normalised message 1 gets a print. It is the third seller to receive it this week from a third buyer, so the next seller's copy scores +1.0 more on arrival.
