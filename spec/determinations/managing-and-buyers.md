# Determinations: managing and buyers
Status: *agent proposal* for Ben and Nate. Written 2026-11-14.

What the system works out once an item is live: what a buyer means, what the agent may do about it, what it may say, how to hand the item over, whether it really sold, what comes down, when to look again, which route to use, and what the person sees and hears. Every card is *agent proposal*; nothing here is a decision. Numbers marked (start) are starting values to be tuned against the check in the card.

Shared rules for every card:

| Rule | Where it comes from |
|---|---|
| Buyer text, site pages and email are data, never instruction; the policy check runs in code before any executor | [messages](../features/messages.md), [product §5](../product.md#5-who-may-act) |
| Money is integer cents; time is UTC with the site's own clock zone kept | [product §7](../product.md#7-contract-conventions) |
| A model step is pinned by model id and prompt version, run at temperature 0, and cached by `hash(input, model, prompt)`, so the same inputs give the same output | inferred: determinism needs the cache, since hosted models are not bit-exact |
| A number the person sees is a guarded number `{value or range, basis_count, as_of, citation_id, state, hide_reason}` | [product §3](../product.md#3-the-data-model) |
| No card logs message text, addresses, tokens or payment details; logs keep ids, labels and scores | [privacy and data](../../research/cross-cutting/nate/privacy-and-data.md) |

## 1. What a message means

**Determines**: which intents an incoming message carries (question, offer, availability, pickup request, scam signal, dispute, other) and how sure each reading is.

**Sources and weights**

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| Site structured event (an offer object, an order, a return case) | the intent and amount directly | rank 1, confidence 1.0 | it is an identifier the site issued, not a reading of text |
| Deterministic extractors on the text | money amounts, dates and times, place words, phone numbers, emails, links, payment app names | rank 2, sets features only | patterns are exact and cheap; they cannot read meaning |
| Thread state | open offer, last sender, prior intents, item state | rank 3, prior for the model | the same words mean different things after an accepted offer |
| Classifier (small model, multi-label) | a score per intent | rank 4, calibrated | reads paraphrase that patterns miss |

**Method**
1. If a structured event exists, take its intent with confidence 1.0 and stop for that intent.
2. Run the extractors (code).
3. The model returns a raw score per intent given the text, the extracted fields and the thread state (model).
4. Map each raw score through a per-intent isotonic calibration fitted on labelled threads (arithmetic), giving `p_intent`.
5. Per intent: `act` if `p >= t_auto`, where `t_auto` is the lowest threshold whose acted set reaches 0.98 precision on the labelled set; `flag` for safety intents (scam signal, dispute) if `p >= t_safe`, where `t_safe` is the highest threshold that keeps recall at 0.95 or more; otherwise `ask`.
6. Several intents can be true at once ("still available? would you take 40") and each goes on.

**Why this method**: Two bars, precision for acting and recall for safety, follow the [messages spec](../features/messages.md) (observed in the spec). Calibration is needed because raw model scores are not probabilities (asserted, a standard finding for neural classifiers). A competent person might pick single-label argmax; it drops the second intent in a combined message, which is the common case in resale threads (inferred from the examples in [messages and offers](../../research/messages/ben/messages-and-offers.md)).

**When it is not shown**: the reading is never shown as a number. If no intent reaches `t_auto` and no safety flag fires, the thread shows as a plain message to answer, with no label.

**How it is explained**: "Reads as an offer of $40 and a question about pickup." Tap opens the words that led to each reading, highlighted.

**Speed**: calibration maps and thresholds are kept ready; the classifier runs on arrival (target under 2 s); extractors run in-process.

**Check later**: weekly labelled sample of 200 threads per site. Wrong if auto-acted intents fall below 0.98 precision, or scam or dispute recall falls below 0.95.

## 2. Whether incoming text is trying to instruct the agent

**Determines**: whether a message, listing page or email contains text aimed at steering the agent (prompt injection), and what that changes.

**Sources and weights**

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| Channel separation | buyer text enters only as quoted data, never in the instruction slot | the control itself, not a score | detection of injection is not reliable, so safety cannot rest on it (asserted, OWASP LLM01) |
| Action diff | whether the action planned after reading the text touches a verb or field the person's request did not need | rank 1 | an injection matters only through what it makes the agent do |
| Pattern list | "ignore previous", role tags, addressing an assistant, encoded blocks, hidden text | rank 2 | cheap, exact, catches known forms |
| Classifier score | injection likelihood | rank 3, flag at recall 0.95 | catches paraphrase; false alarms only cost an ask |

**Method**
1. Build every model call with the buyer's text inside a marked data block (code).
2. After planning, compare the planned verbs and fields against those the intent from [card 1](#1-what-a-message-means) needs (code). Any extra verb is `injection_suspected`.
3. Run patterns (code) and the classifier (model); either firing is `injection_suspected`.
4. `injection_suspected` never grants anything. It turns the thread's auto actions into ask, and adds a `scam_warning` decision if the text also asks for money, a code, an address or an off-site move.

**Why this method**: The [agent harness note](../../research/cross-cutting/nate/flue-agent-harness.md) and the [messages spec](../features/messages.md) treat buyer text as untrusted (observed in the spec). Permissions live in code ([card 3](#3-whether-an-action-is-allowed-asked-or-locked)), so a missed injection can at worst produce a reply that still has to pass [card 4](#4-whether-a-drafted-reply-may-be-sent) (inferred). The alternative, a strong detector as the gate, fails open on the first new phrasing.

**When it is not shown**: hidden unless it fires. The person then sees the thread with an "Asked you instead" mark and the decision card.

**How it is explained**: "This message tried to give the assistant orders, so it asked you instead." Tap opens the flagged lines.

**Speed**: patterns and the action diff run in-process; the classifier rides the same call as card 1.

**Check later**: a red-team set of 300 injection messages across sites, rerun monthly. Wrong if any one leads to an outward action that was not asked of the person.

## 3. Whether an action is allowed, asked or locked

**Determines**: for one planned outward action, `auto`, `ask` or `locked`, with a reason code.

**Sources and weights**: an ordered list; the first match decides.

| Rank | Source | Result on match | Why that rank |
|---|---|---|---|
| 1 | Locked list: home address, payment and refunds, moving a deal off-site, price below the floor, completing a purchase | `locked` | the person's own money and safety; never learned away ([product §5](../product.md#5-who-may-act)) |
| 2 | Account state from [card 17](#17-whether-an-account-is-healthy-or-at-risk) is `paused` or `broken` (an unlinked account has no row, so nothing runs) | `ask` (queued) | acting on a warned or signed-out account risks the account |
| 3 | Site terms for this verb, from [connect](../features/connect.md) | `ask` if the site bars unreviewed automation for it | eBay's User Agreement bars agents acting without human review (observed, [platform access](../../research/connect/nate/platform-access.md)) |
| 4 | Limits: floor, pickup hours, saved spot, buy ceiling | `ask` with kind `price_below_floor` or `pickup_outside_hours` | outside what the person set |
| 5 | Safety flags from cards [2](#2-whether-incoming-text-is-trying-to-instruct-the-agent) and [5](#5-how-likely-a-buyer-is-a-scam) | `ask` | a risky thread should not run on its own |
| 6 | The rule's mode for this action kind, from [card 18](#18-whether-an-action-kind-has-earned-auto) | `auto` or `ask` | what the person has taught |
| 7 | Default for the kind in the [messages spec](../features/messages.md) | `auto` inside limits for replies, counters, accepts, markdowns, delist after sale, pickup in hours at the saved spot | decided tiers |

**Method**: `policy(action, limits, rules, account, flags, terms) -> {mode, reason}`, a pure function in code; no model step. The executor refuses any call without a fresh `policy` result for the same action hash.

**Why this method**: A first-match list makes the reason exact and testable, and keeps permission out of reach of persuasive text (inferred). The alternative, a model judging whether an action is appropriate, can be argued with by the very buyer text it reads.

**When it is not shown**: auto actions are not shown up front; they appear in the done log on [Today](../features/today.md). Ask and locked appear as a decision card.

**How it is explained**: "Asked you because $35 is under your lowest price of $40." Tap opens the rule and the limit that decided it, with a link to change the limit.

**Speed**: in-process, under 1 ms; limits and rules are cached per account and dropped on change.

**Check later**: property tests over random actions: no `locked` kind ever returns `auto`. In production, wrong if any event shows actor `auto` on a locked kind.

## 4. Whether a drafted reply may be sent

**Determines**: `pass`, `hold` or `abstain` for one drafted reply, by checking each factual claim against a recorded fact.

**Sources and weights**

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| Item facts with `source` (item card, measurements, disclosed flaws) | the facts a claim may rest on | rank 1 | recorded and shown to the person at review |
| Limits and the offer decision from [card 7](#7-how-to-answer-an-offer) | money, time and place the reply may state | rank 1 | the reply must say what the code decided |
| Listing text at the time | what the buyer was already told | rank 2 | consistent but may be stale |
| Entailment model | support score for free-text claims | rank 3, threshold set for 0.98 precision | a sentence-level judgment; MiniCheck-FT5 reaches 74.7% balanced accuracy (asserted, arXiv 2404.10774) so it needs a strict bar |

**Method**
1. The model splits the draft into claims and types each one: money, time and place, item fact, availability, free text, or held type (model).
2. Money, time, place and availability are compared field by field to the decision and limits (code): exact cents, slot inside the offered set, place equals the saved spot label.
3. Item facts are matched to an attribute key and value (code), with units normalised.
4. Free-text claims get an entailment score against the item facts (model); backed if `score >= t_e`, `t_e` the lowest score whose passed claims reach 0.98 precision while held claims keep recall 0.95 ([evidence gate](../../research/messages/nate/evidence-gate.md)).
5. Authenticity, working condition and hidden condition are always held.
6. Verdict: `pass` if every claim is backed; `hold` if any is not, which becomes decision `unbacked_claim`; `abstain` if the split fails, which also asks.

**Why this method**: Typed claims get exact checks where exactness is possible, and the model is used only for what code cannot read (observed in the [messages spec](../features/messages.md)). The alternative, one model asked "is this reply accurate", gives no claim-level reason and no tunable bar.

**When it is not shown**: a pass is not shown. A hold shows the draft with the unbacked sentence marked and options Send without it, Edit, Add the fact.

**How it is explained**: "Held: the reply says it works, and that was never checked." Tap opens each claim beside the fact it matched or the gap.

**Speed**: item facts are kept ready per item; the split and entailment run on the draft, target under 1.5 s.

**Check later**: monthly audit of 300 sent replies with claims labelled. Wrong if passed claims fall below 0.98 precision, or held-type claims ever pass.

## 5. How likely a buyer is a scam

**Determines**: a scam tier for a buyer in a thread: `hard`, `elevated` or `none`.

**Sources and weights**: likelihood ratios added as log-odds (all start values).

| Signal | Weight (log-odds) | Why that weight |
|---|---|---|
| Asks for a code sent to the seller's phone | hard | the Google Voice pattern (asserted, [trust, returns, disputes §8](../../research/sold/nate/trust-returns-disputes.md)) |
| Claims an overpayment, sends a check, asks for a refund of the difference | hard | named pattern, same source (asserted) |
| Asks to pay or talk off-site (Zelle, phone, email) | +2.0 | moves the deal outside site protection; also a locked action |
| Asks to ship a local-only listing to another address | +1.5 | the "post it to me" pattern, one source only (asserted) |
| Link in the first or second message | +1.0 | common phishing form (inferred) |
| Account younger than 30 days, or no ratings | +0.7 | weak; many real buyers are new (inferred) |
| Urgency without questions on an item over $200 | +0.5 | weak, common in reports (inferred) |
| Completed purchases on the site with good ratings, 10 or more | -1.5 | a history is costly to fake (inferred) |

**Method**
1. Signals come from [card 1](#1-what-a-message-means) extractors and the buyer profile the site shows (code); only "asks for a code" and "claims an overpayment" need the model's reading.
2. Any hard signal: tier `hard`.
3. Else `s = sum(weights present)`; `elevated` if `s >= 1.5` (start), else `none`.
4. `hard` makes a `scam_warning` decision (never promoted). `elevated` turns commit actions (accept, pickup booking) into ask.

**Why this method**: No labelled base rate exists per site, so a learned probability would be invented; a sum of named signals is honest and each reason can be shown (inferred). Named signals come from [trust, returns, disputes](../../research/sold/nate/trust-returns-disputes.md) and [messages and offers](../../research/messages/ben/messages-and-offers.md). The alternative, a trained classifier, is the upgrade once confirmed scams are labelled; until then it would fit noise.

**When it is not shown**: tier `none` shows nothing. No percentage is ever shown, because the base rate is unknown.

**How it is explained**: "This buyer asked for a code sent to your phone. That is a known scam." Tap opens the lines and what the scam does.

**Speed**: profile signals cached per buyer for 24 h; text signals computed on arrival.

**Check later**: label threads the person reports or blocks, and site-confirmed fraud. Wrong if a confirmed scam reached `none` while carrying a listed signal, or if more than 1 in 3 `elevated` threads end in a normal sale (weights too loose).

## 6. How likely a buyer will not show

**Determines**: whether to send a confirm-or-release message before a pickup and whether to keep a backup buyer warm.

**Sources and weights** (start values; ordering is firmer than the numbers)

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| This buyer's past no-shows with this seller (our records) | strongest | rank 1, +2.0 each | direct past behaviour |
| Paid in-app before pickup (eBay local pickup holds funds until the code scan) | lowers risk | rank 1, -3.0 | money committed (observed, [shipping and pickup](../../research/sold/nate/shipping-and-pickup.md)) |
| Exact time agreed and confirmed in the last 24 h | lowers | -1.0 | a concrete commitment (inferred) |
| Vague time ("sometime tomorrow") | raises | +1.0 | inferred |
| No ratings, new account | raises | +0.5 | inferred |
| Hard haggling then accept | raises | +0.3 | inferred, weak |

**Method**: `s = sum`. If `s >= 1.0`: send a confirm message 2 h before (an auto reply inside limits that passes [card 4](#4-whether-a-drafted-reply-may-be-sent)) and keep the next buyer from [card 22](#22-which-buyer-gets-the-item-when-several-want-it) told they are next. No silence for 15 min after the slot start (start) records a no-show and reopens the item.

**Why this method**: What a cancelled no-show does to seller metrics was not found, and off-site deals leave no platform record (observed gap, [shipping and pickup](../../research/sold/nate/shipping-and-pickup.md)). A cheap reminder costs little when wrong, so a loose additive score is enough to decide it (inferred). The alternative, overbooking two buyers into one slot, harms the second buyer and the seller's standing.

**When it is not shown**: never shown as a number. The person sees "Confirm sent" on the appointment.

**How it is explained**: "Sent a quick check that they are still coming." Tap opens the message sent.

**Speed**: computed when the appointment is booked and again 2 h before.

**Check later**: record show or no-show for every appointment. Wrong if no-show rates are the same above and below the 1.0 line.

## 7. How to answer an offer

**Determines**: accept, counter at an amount, or decline, for one buyer offer.

**Sources and weights**

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| Floor (lowest price) | hard lower bound | rank 1 | the person's limit; below it is locked |
| Always-accept amount | auto accept bound | rank 1 | the person's own rule ([decision](../../product/decisions.md#2026-11-14-always-accept-is-offered-at-listing-and-only-unedited-approvals-count)) |
| You-keep after fees and shipping, from [price](../features/price.md) | compares like with like | rank 2 | the person cares what lands, not the headline |
| Price path and days listed, from [price](../features/price.md) | how much give remains | rank 3 | a stale listing should concede more |
| Competing interest: other open offers, watchers, likes in the last 72 h | less give when high | rank 4 | more buyers mean a better outside option |
| Round number | counter at a precise amount | rule | round numbers signal eagerness and draw lower offers (observed, Backus, Blake and Tadelis, in [psychology](../../research/cross-cutting/ben/psychology.md)) |

**Method** (all code; the model only words the reply)
1. `keep(x) = x - fees(x, site) - ship_cost`.
2. If `keep(offer) >= keep(always_accept)`: accept.
3. If `offer < floor`: counter at the counter amount below (never accept); a counter at or above the floor is not a below-floor action.
4. Concession by round `r` (1, 2, 3): `c_r = 0.35, 0.65, 1.0` (start). Interest factor `m = 0.7` if another open offer or 3 or more new watchers or likes in 72 h, else `1.0`; stale factor `d = 1.2` if days listed exceed the price path's next markdown day, else `1.0`.
5. `counter = list - (list - floor) * min(1, c_r * m * d)`, rounded up to a precise amount ending in 5 or 8 dollars over $20, whole dollars under.
6. If `offer >= counter`: accept. If round 3 already reached and `offer >= floor`: accept. Else counter.
7. A higher open offer on the same item is answered first; one accept per item.

**Why this method**: Decreasing concessions keep room for later rounds; Magentic Marketplace agents accepted the first offer 80 to 100% of the time (asserted, [messages and offers](../../research/messages/ben/messages-and-offers.md)), so the decision must sit in code with the person's limits. The precise counter follows the round-number finding (observed in the study). The alternative, split the difference each time, concedes half the gap at once and gives no handle for competing interest.

**When it is not shown**: auto accepts and counters show in the done log only. An offer below the floor shows as an ask card.

**How it is explained**: "Countered at $48: you keep $41, and two others are watching." Tap opens the offer, the floor, fees, and the round.

**Speed**: fees, floor and price path are kept ready per listing; the decision is in-process.

**Check later**: compare you-keep and days to sale between counter rules in a split by listing ([score](../features/score.md)). Wrong if the rule's you-keep per day listed is lower than the plain split rule.

## 8. Which pickup time to offer and whether to book it

**Determines**: up to 3 pickup slots to offer, and whether the agent may book the one the buyer picks.

**Sources and weights**

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| Pickup hours and saved spot (limits) | the allowed set | rank 1, hard | the person's limits |
| Seller calendar busy times, if connected | removes clashes | rank 2, hard | inferred |
| Times the buyer named (card 1 extractors) | preference | rank 3, score +3 for overlap | answers what was asked |
| Soonest | preference | score +2 for the first slot, +1 second | a sooner pickup is less likely to fall through (inferred) |
| Daylight | preference | score +1 inside daylight hours | public daytime meets are the advice for safe exchange (asserted, [trust, returns, disputes §8](../../research/sold/nate/trust-returns-disputes.md)) |

**Method**
1. Candidates: 30-minute slots inside pickup hours, from now + 2 h to now + 72 h, minus busy times with 30 min buffer (code).
2. Score as in the table; ties to the earlier slot; take the top 3, no two within 2 h of each other.
3. Book `auto` if the chosen slot is inside hours, the place is the saved spot, and [card 5](#5-how-likely-a-buyer-is-a-scam) is `none`. Outside hours is `pickup_outside_hours`, never promoted. The home address is locked and never sent.

**Why this method**: Booking inside hours at the saved spot is auto by the tiers decision, and outside it asks ([messages](../features/messages.md)). Offering a short list matches how people schedule in chat (inferred). The alternative, a booking link with every free slot, invites a slot the person dislikes and shares the calendar.

**When it is not shown**: with no pickup hours set, no slots are offered; the thread asks the person "When can you meet?" once and saves the answer as hours.

**How it is explained**: "Offered Saturday 10:00, 12:30 or Sunday 11:00 at your usual spot." Tap opens the hours and spot it used.

**Speed**: slots precomputed per account each hour; scoring on demand.

**Check later**: share of offered slots the buyer takes without asking for another. Wrong if under half.

## 9. Whether to ship or meet

**Determines**: for a sale or a buyer's question, ship or meet in person.

**Sources and weights**: ordered; first match decides.

| Rank | Source | Result | Why |
|---|---|---|---|
| 1 | The paid order's own fulfilment (a shipped order on Poshmark, Mercari, Depop, eBay with shipping) | ship | the site already took the buyer's money for shipping |
| 2 | The person's setting for the item in `strategy` (ship only, pickup only, both) | that | the person's choice |
| 3 | Site: Poshmark ship only; Facebook local default | that | site rules ([shipping and pickup](../../research/sold/nate/shipping-and-pickup.md)) |
| 4 | Billed weight from [card 10](#10-which-label-and-box) over the site label cap, or longest side over the cap | meet | a label is not possible |
| 5 | Buyer distance to the saved spot under the pickup radius (start 15 miles) | offer meet first | inferred |
| 6 | Otherwise | ship | default |

**Method**: first match in code.

**Why this method**: The site's paid order and the person's setting are facts, so they outrank any estimate (inferred). The alternative, a cost model trading shipping cost against travel time, needs a value of the person's time that we do not have.

**When it is not shown**: shown only when both are possible, as two options on the reply.

**How it is explained**: "Meet: it is too big for a Mercari label." Tap opens the size and the cap.

**Speed**: in-process.

**Check later**: count of meet-or-ship choices the person overrides. Wrong if over 10%.

## 10. Which label and box

**Determines**: the box, the declared weight and dimensions, the label to buy or use, whether to offer insurance, and which labels print together.

**Sources and weights**

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| Measured dimensions and weight from [measure](../features/measure.md) | item size | rank 1 | measured |
| Category default size and weight | fallback | rank 2 | estimate; forces a "weigh it" step before printing |
| Packing allowance | +2 in per axis, +0.3 lb (start) | rule | protection; tune from overweight charges |
| Dimensional rule: divisor 139, over 1 lb rounds up | billed weight | rule | observed on Mercari's help pages ([shipping and pickup](../../research/sold/nate/shipping-and-pickup.md)) |
| Site label options and caps | which labels are allowed | hard | Mercari prepaid 50 lb and 34 in longest side; economy services 1,728 cubic in (observed, same note); Poshmark 15 lb cap with overweight deduction ([sold](../features/sold.md)) |
| Carrier quotes | price and days | rank 3 | live price |

**Method** (code)
1. `L, W, H` = item dims + allowance, sorted, rounded up to whole inches.
2. Box = the smallest box in the person's saved box list (or a standard set) with each side at least `L, W, H`.
3. `billed = max(ceil(actual + packaging), ceil(L*W*H / 139))`; the dimensional term only where the carrier applies it.
4. If the site gives a prepaid label: use it, choosing the weight class `>= billed`. Else the cheapest quote whose promised delivery meets the site's clock in [card 11](#11-the-ship-by-deadline-and-other-clocks).
5. Declared weight is never below actual weight, since prepaid label access can be removed for it (observed, [shipping and pickup](../../research/sold/nate/shipping-and-pickup.md)).
6. Address: the buyer's address is validated against the carrier before buying; a correction is shown, never applied silently.
7. Insurance (*agent proposal*): offered when `price_cents` is above the carrier's included cover and the site's own protection does not cover the item; suggested amount is the sale price, up to the carrier's limit (Shopify offers up to $200, observed at [shopify.com/shipping](https://www.shopify.com/shipping), via the [suite map](../../research/cross-cutting/nate/shopify-suite-map.md)). Poshmark's prepaid label carries its own cover, so none is offered there (inferred).
8. Batch: every order in `to_ship` whose label is bought or prepaid joins one print batch, sorted by the pick list in [card 23](#23-where-an-item-is-and-the-pick-list), one PDF in label-printer (4 by 6 in) or letter layout.

**Why this method**: The overage falls on the seller on Mercari and Poshmark (observed), so the method rounds up and never declares low. The alternative, declare the item weight alone, is what produces the deductions.

**When it is not shown**: with only a category default, the label is not bought; the person sees "Weigh it first" with the scale step.

**How it is explained**: "Use a 12 by 10 by 4 box; it bills as 2 lb." Tap opens the size, the rule and the label price.

**Speed**: box list and caps kept ready; quotes fetched when the order is read (cached 1 h).

**Check later**: overweight charges per 100 labels. Wrong if more than 2.

## 11. The ship-by deadline and other clocks

**Determines**: each deadline that runs on an order or case (ship by, respond by, case window), and when to warn.

**Sources and weights**

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| Deadline field on the order from the site | the deadline | rank 1 | the site's own number |
| Site help pages, per site table in [sold](../features/sold.md) | rule when no field | rank 2 | published rule |
| Conflicting sources | the shorter clock | rule | missing a deadline costs more than finishing early ([sold](../features/sold.md)) |
| Business-day calendar (carrier holidays) | business-day arithmetic | rule | eBay and Mercari state business days |

**Method**: `due = start + rule(site, clock)` in the site's time zone, business days skipping weekends and carrier holidays; `due = min(due_from_field, due_from_rule)` when both exist and differ. Cards at `due - 24 h` and `due - 4 h`; a push at `due - 1 h` ([card 20](#20-what-to-notify-now-in-a-batch-or-not-at-all)).

**Why this method**: Taking the shorter of two conflicting clocks is safe by construction (inferred). The alternative, trusting one source, fails the first time a help page is out of date.

**When it is not shown**: if neither a field nor a rule exists for the site, the card says "No deadline found for this site" and uses 3 days.

**How it is explained**: "Ship by Thursday 5 pm, Poshmark's limit." Tap opens the rule and its source.

**Speed**: computed when the order is read; stored on the order.

**Check later**: late shipments per site. Wrong if any shipment marked on time by us is late by the site.

## 12. Whether a sale really happened

**Determines**: that an item sold, on which site, and when, as the trigger for delisting.

**Sources and weights**

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| Paid order read back from the site (API or page) | the sale | the only signal that counts | the site's record of payment |
| Site webhook or notification (eBay ORDER_CONFIRMATION, Depop order.new) | trigger | starts a read | best effort, can be late or missing (observed, [crosspost and delist](../../research/list/ben/crosspost-and-delist.md): eBay's REST `ORDER_CONFIRMATION` topic and Depop's "best-effort" `order.new`) |
| Email or SMS from the site | trigger | starts a read | spoofable; never proof ([email and notification detection](../../research/sold/nate/email-and-notification-detection.md)) |
| Scheduled `check_due` order poll (tiers in [card 15](#15-when-to-check-again)) and the nightly `reconcile` | backstop | starts a read | catches what triggers miss |
| The person marks it sold (Facebook, cash) | the sale | counts for sites without orders | no order exists to read |

**Method**: any trigger sets the account's `next_check_at` to now ([card 15](#15-when-to-check-again)); the read classifies the order: `paid` is sold; `unpaid` is committed, which pauses other listings where the site allows; `cancelled` reverts. eBay is read from orders, since a sold listing can stay Active at quantity 0 (observed, [list](../features/list.md)).

**Why this method**: Separating triggers from proof lets the fastest channel start work while only the site's record moves money and listings (inferred). The alternative, acting on the email, would let a forged email end every listing.

**When it is not shown**: always shown when it fires, as the sale card.

**How it is explained**: "Sold on Depop for $52. Ending the other four." Tap opens the order as read from Depop.

**Speed**: triggers push; the read runs within 30 s (target).

**Check later**: per site, time from payment to our read. Wrong if p95 is over 5 min.

## 13. Which listings come down, in what order, and when a failed delist turns red

**Determines**: the set of listings to end after a sale, the order they go, and when one that has not come down needs the person.

**Sources and weights**

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| All listings of the item not on the sold site, in any state but `delisted` | the set | complete | a posting or unknown listing can still sell |
| Instant-buy exposure: site lets a buyer pay without the seller (eBay, Mercari, Depop, Poshmark buy now) | order | first | a second paid order is the costliest outcome |
| Interest in the last 24 h | order within exposure | second | more attention, sooner a second sale (inferred) |
| Route speed from [card 16](#16-which-route-to-use) | order within ties | third | ends more listings sooner |
| Facebook (seller must agree to sell) | last | rule | no instant buy |

**Method**
1. Cancel in-flight post and revise jobs for the item first (code).
2. One job per listing, key `delist:{item}:{site}`, all enqueued at once; each runs under its own account lease, so order only matters within one account's queue.
3. On Poshmark, void open offers first and pace 2 to 5 s per action.
4. Retry 5 s, 15 s, 45 s, 2 min on the chosen route, then fall back to the cloud browser.
5. A listing counts as down only after read-back.
6. Red: any listing not read back as down 5 min after the sale read gives a `failed_delist` card. This card owns the 5 min value (a starting value): Ben's notes give 3 min ([crosspost and delist](../../research/list/ben/crosspost-and-delist.md)) and 6 min ([build plan](../../research/cross-cutting/ben/build-plan-posting-messages-ui.md)); 5 clears a 2 min poll plus Poshmark pacing and stays under the 10 min bar ([sold](../features/sold.md#design-choices)).

**Why this method**: Steps 1 to 6 follow the [sold spec](../features/sold.md) and [crosspost and delist](../../research/list/ben/crosspost-and-delist.md) (observed in the spec). Ordering by instant-buy exposure is added here (inferred). The alternative, ending in a fixed site order, leaves the riskiest copy up for no reason.

**When it is not shown**: in progress, the item page shows each listing coming down; nothing is pushed unless red.

**How it is explained**: "Ended on 3 of 4. Mercari has not come down yet." Tap opens each listing with its last read.

**Speed**: listings per item kept ready; jobs start within 1 s of the sale read.

**Check later**: `sold_to_all_down_ms` per site. Wrong if median is over 10 min or p95 over 5 min after fallback fixes ([sold](../features/sold.md)).

## 14. Which order to keep when an item sells twice

**Determines**: which of two paid orders for one item to fulfil, and which to cancel.

**Sources and weights**

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| Payment time read from each site | default keeper: the earlier paid | rank 1 | the first buyer to pay has the fair claim (inferred) |
| Cancel cost per site | flag to swap | rank 2 | Poshmark counts it toward a 3% rolling 90-day cancel rate with restrictions; eBay records a defect for out of stock (inferred); Mercari up to 5%, max $25 (inferred); Depop and Facebook none found ([sold](../features/sold.md)) |
| You-keep of each order | tie input | rank 3 | money |

**Method**: `keep = earlier paid`. Compute `cost(cancel) = fee + metric_penalty`, with `metric_penalty` set to a large constant when the cancel would push the account past a site threshold from [card 17](#17-whether-an-account-is-healthy-or-at-risk). If cancelling the earlier one costs at least $10 less (start) or avoids a threshold, suggest the swap. Always a `pick_sale` decision; the person chooses.

**Why this method**: The [sold spec](../features/sold.md) already sets the earlier-paid default with a flag (observed in the spec). The alternative, keep the higher price, treats buyers as interchangeable and invites complaints.

**When it is not shown**: always shown when it happens.

**How it is explained**: "Two people paid. Keep the first buyer; cancelling Poshmark would hurt your account there." Tap opens both orders and each cancel's cost.

**Speed**: costs kept ready per site; computed on the second paid read.

**Check later**: count of double sales per 1,000 sales. Wrong if it rises after this card ships (the delist in card 13 should keep it near zero).

## 15. When to check again

**Determines**: `next_check_at` for a listing, a conversation, a want and an account, and which trigger outranks which.

**Sources and weights**

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| Events (webhook, email hint, person opens the thread) | set to now | rank 1 | a fresh signal beats a schedule |
| Tier floors and ceilings, owned here (starting values, below) | bounds | rank 2 | one table, so [messages](../features/messages.md), [sold](../features/sold.md) and [connect](../features/connect.md) link here instead of stating their own |
| Change seen on the last check | adapt within bounds | rank 3 | a revisit should follow how often a thing changes (asserted, web crawler revisit policy) |
| Site pacing and account lease | delays | hard | one lease per account session, paced per site |

Tiers (*agent proposal*, starting values; they merge the earlier connect and messages cadences, which differed):

| Row in this state | Floor | Ceiling |
|---|---|---|
| Open offer, or a buyer waiting on our reply | 1 min | 2 min |
| Sold page on a site without sale events (Poshmark, Mercari) | 1 min | 2 min |
| Thread active in the last 24 h, waiting on the buyer | 10 min | 60 min |
| Live listing with views or watchers | 1 h | 2 h |
| Quiet live listing or thread | 2 h | 24 h |
| Want: hot, quiet ([watch](../features/watch.md)) | 5 min | 60 min |
| Account health probe | 30 min | 30 min |
| `reconcile`, a full compare per account | nightly, and right after a relink | |

**Method**: `interval_next = clamp(changed ? interval / 2 : interval * 1.5, floor_tier, ceil_tier)`. The halving and the 1.5 stretch are *agent proposal* starting values: halving answers a burst within two checks, and 1.5 (less than doubling) climbs from floor to ceiling over several quiet checks so one quiet read does not lose a live thread; tune both from the check later below; `next_check_at = min(now + interval_next, any event time)`. When jobs compete for one account's lease, run in this order: 1 sale read, 2 delist, 3 offer expiring within 1 h, 4 buyer waiting, 5 ship-by within 24 h, 6 hot want, 7 interest read, 8 quiet listing. Ties: earlier `next_check_at`.

**Why this method**: Halving on change and stretching on quiet is the plain adaptive rule; it stays inside the specs' tiers (inferred). Crosslisters poll every 5 to 30 min flat (Vendoo 10 min observed, others asserted, [crosslister teardown](../../research/cross-cutting/nate/crosslister-teardown.md)). The alternative, a fixed interval per tier, wastes reads on quiet items and misses bursts.

**When it is not shown**: not shown. The item page shows "Checked 3 min ago".

**How it is explained**: "Checked 3 min ago; checking often while an offer is open." Tap opens the last read.

**Speed**: a min-heap of `next_check_at` per account in memory; recomputed on each check.

**Check later**: time from a buyer message to our reply per site. Wrong if p95 exceeds the tier floor plus 2 min, or reads per account rise with no faster replies.

## 16. Which route to use

**Determines**: for one action on one site, the official API, a recorded-call replay, or the cloud browser.

**Sources and weights**

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| Eligibility: capability table and terms ([connect](../features/connect.md)) | which routes are allowed | hard | a route the terms bar is not a choice |
| Success rate per (site, verb, route) | Beta posterior, prior Beta(1,1), last 30 days | rank 1, lower bound at 90% must reach 0.95 | reliability first; a failed delist costs more than a slow one |
| Median time per (site, verb, route) | speed | rank 2 | replay 1 to 3 s against 1 to 4 min in the browser (asserted, [cloud browsers](../../research/replay/nate/cloud-browsers-and-detection.md)) |
| Cost per call | cost | rank 3 | cheapest among equally fast |
| Recipe state ([replay](../features/replay.md)) | only `active` recipes | hard | `drifted` and `retired` are off |

**Method**: among eligible routes, keep those whose success lower bound `>= 0.95`; pick the fastest median, ties to the cheaper. If none qualify, pick the highest success mean. Default order when data is thin (fewer than 20 calls): API, active recipe, browser ([replay](../features/replay.md)). On failure, fall back down that order; the job result records `{route, fell_back, ms}`. A challenge page stops all routes and sets the account `broken`.

**Why this method**: A lower bound rather than the mean keeps a route with 3 lucky calls from taking over (inferred); measured success, speed and freshness per tool is the [treg routing note](../../research/cross-cutting/nate/treg-tool-routing.md) design (observed in the note). The alternative, a fixed order, ignores that a recipe can beat the API on one site and drift on another.

**When it is not shown**: not shown. The trace behind "why?" names the route.

**How it is explained**: "Ended through Mercari's site in 2 s." Tap opens the trace.

**Speed**: posteriors and medians kept per (site, verb, route), updated on each result; choice in-process.

**Check later**: success per route per week, plus the daily canary. Wrong if the chosen route's failure rate is higher than the route it displaced over the same week.

## 17. Whether an account is healthy or at risk

**Determines**: `account.health` (`ok`, `expiring`, `broken`, `paused`, from [product.md](../product.md)) and a risk flag for a site's seller standards. The earlier names map onto it: `needs_signin` is `broken`, `degraded` is `ok` with the risk flag raised, `linking` is the connect flow before the row exists, and `off` is an unlinked account (no row).

**Sources and weights**

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| A warning or restriction from the site | `paused` | rank 1, hard | the site's own word; Poshmark mass suspensions in Nov 2025 (asserted, [platform access](../../research/connect/nate/platform-access.md)) |
| Challenge page or sign-in failure | `broken` | rank 2, hard | session lost |
| Token or saved session expiry within 7 days (start) | `expiring` | rank 3, hard | a relink before it breaks keeps jobs running (inferred) |
| Probe result every 30 min | `ok`, or `broken` when a read fails twice running (start) | rank 4 | read works or not ([connect](../features/connect.md)) |
| Error rate on actions in the last hour | risk flag above 20% (start) | rank 5 | inferred |
| Our own engagement volume per site (shares, offers to likers, relists, ends) against the site's policy and our pace limit ([listing and marketing D26](listing-and-marketing.md#d26-engagement-levers-the-agent-runs-on-its-own)) | risk flag at 80% of our limit | rank 6 | Poshmark has an Excessive Listing Removal policy (May 2025) and a policy against unauthorised automation (observed, [crosslister teardown](../../research/cross-cutting/nate/crosslister-teardown.md)) |
| Seller metrics against the site's published thresholds (cancel rate, late shipment, response time) | risk flag at 80% of a threshold | rank 7 | warns before the site acts; Poshmark: 3% rolling 90-day seller cancellations, a 24 hour restriction then a 14 day suspension (observed, [crosslister teardown](../../research/cross-cutting/nate/crosslister-teardown.md)) |
| Our action rate against the site's pacing | slows the queue | rank 8 | Poshmark about one action per 2 to 5 s (inferred) |

**Method**: first hard match sets the state; else the probe. `risk = max(metric_i / threshold_i)` over the site's metrics, the error rate (threshold 20%) and our engagement volume (threshold our per-site limit); flag at `risk >= 0.8` (start). The per-site risk is shown on You > By site and beside every lever and bulk action that would add to it. Paused stops every action on that site ([card 3](#3-whether-an-action-is-allowed-asked-or-locked)).

**Why this method**: The site's own warning outranks anything we infer, and a ratio to a published threshold is the only risk we can state without inventing a ban model (inferred). The alternative, a predicted ban probability, has no labelled data and the sites publish no ban rules.

**When it is not shown**: `ok` with risk under 0.8 shows nothing. A metric whose threshold is not published is shown as a value with no flag.

**How it is explained**: "Poshmark: 2 of your last 90 days' orders were cancelled. One more and Poshmark may limit you." Tap opens the metric, the threshold and its source.

**Speed**: probe results stored; metrics read once a day per account and on each cancel.

**Check later**: site warnings received. Wrong if a warning arrives for a metric we had under 0.8.

## 18. Whether an action kind has earned auto

**Determines**: when to offer "Always do this" for an ask kind, and when an auto rule is demoted, paused or expires.

**Sources and weights**

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| Unedited approvals of the kind | promotion count | 3 in a row | the decided rule ([decision](../../product/decisions.md#2026-11-14-always-accept-is-offered-at-listing-and-only-unedited-approvals-count)) |
| An edit before approval | resets the count | rule | an edit is a correction |
| An undo of an auto action | demote to ask; an undone accept pauses the rule | rule | [messages](../features/messages.md) |
| Days unused | `rule_expiring` card at 14 days | rule | spec |
| Never-promoted kinds: `price_below_floor`, `pickup_outside_hours`, `scam_warning`, `unbacked_claim`, `buy_offer` | excluded | hard | spec |

**Method**: per (account, kind, scope): count consecutive unedited approvals across at least 2 different items (added here); at 3, show the "Always do this" option once on the next card. The person decides; no rule turns itself on.

**Why this method**: Three of three is a weak sample (3 of 3 still leaves the true approval rate possibly under one half; inferred), so the person, not the count, makes the call, and the 2-item condition stops one long thread from promoting a kind. The alternative, promote on a high approval rate over many cards, delays help for the person who wants it now.

**When it is not shown**: the offer is not shown for never-promoted kinds or before 3.

**How it is explained**: "You sent this kind of reply 3 times without changes. Let the assistant do it?" Tap opens the 3 approvals.

**Speed**: counters kept per rule; updated on each decision.

**Check later**: undo rate in the 30 days after promotion. Wrong if over 5%.

## 19. What evidence to assemble for a dispute

**Determines**: the bundle and draft reply for a return, not-as-described, not-received or damaged case.

**Sources and weights**: ranked by how hard each is to contest.

| Rank | Source | Why that rank |
|---|---|---|
| 1 | Carrier tracking with delivery scan | third party record |
| 2 | Capture frames with timestamps, and each disclosed flaw with its image region | recorded before sale |
| 3 | Listing text and photos as at the sale time | what the buyer agreed to |
| 4 | In-site messages | site has them; off-site messages count for little |
| 5 | The person's statement | needed, weakest |

**Method**: map the case reason to required items (code): not received gives 1; damaged gives 1 and 2 plus packing photos if any; not as described gives 2, 3, 4. Missing required items go on the card as gaps. The draft reply passes [card 4](#4-whether-a-drafted-reply-may-be-sent) and never claims authenticity, working condition or hidden condition. Refunds are locked to the person. Deadline from [card 11](#11-the-ship-by-deadline-and-other-clocks).

**Why this method**: Sites decide cases on records they can verify (asserted, [trust, returns, disputes](../../research/sold/nate/trust-returns-disputes.md)). The alternative, attach everything, buries the one record that decides the case.

**When it is not shown**: always shown on a case.

**How it is explained**: "Ready to send: tracking shows delivery, and the scuff was in your photos." Tap opens each item in the bundle.

**Speed**: capture frames and listing snapshots stored at sale time; the bundle assembles in seconds on the case read.

**Check later**: case outcomes. Wrong if cases with complete bundles are lost as often as cases with gaps.

## 20. What to notify now, in a batch, or not at all

**Determines**: for each card or event, a push now, a place in the next batch, or no push.

**Sources and weights**: ordered.

| Rank | Condition | Result | Why |
|---|---|---|---|
| 1 | A deadline within 1 h (offer expiry, ship-by, case reply, pickup) | now, Time Sensitive | Apple's guidance reserves it for time-bound needs (asserted, [seller metrics and notifications](../../research/today/nate/seller-metrics-and-notifications.md)) |
| 2 | A sale, a `failed_delist`, a `scam_warning` with a pickup within 24 h, an account `paused` | now | money or safety at stake |
| 3 | Any other decision card | next batch (start 9:00, 13:00, 19:00, local) | batching lowers stress (asserted, Fitz et al. 2019); "too frequently" is the top opt-out reason (observed, Airship 2026, same note) |
| 4 | Auto actions done | no push; in the done log | the person asked not to be bothered by handled work |

**Method**: first match. Cap rank 2 pushes at 6 a day (start); over the cap they join the next batch. A batch with nothing new is not sent.

**Why this method**: Sorting by deadline and stake follows the [Today spec](../features/today.md) (observed in the spec). The alternative, push every card, is what drives opt-out.

**When it is not shown**: rank 4 never pushes.

**How it is explained**: "3 things need you." Tap opens Today.

**Speed**: batch built at batch time; rank 1 and 2 on the event.

**Check later**: push opt-out per 1,000 people per month, and offers expiring unanswered. Wrong if over 5% of offers expire unanswered on days the app was opened ([today](../features/today.md)).

## 21. What goes on Today, in what order

**Determines**: which cards are on the home screen and their order.

**Sources and weights**

| Rank | Key | Why |
|---|---|---|
| 1 | Hours until the deadline, in buckets: under 1 h, under 24 h, later, none | a missed deadline cannot be undone ([today](../features/today.md)) |
| 2 | Money at stake: you-keep of the offer or order | bigger first |
| 3 | Age: older first | fairness to waiting buyers |

**Method**: only decision kinds from [product §5](../product.md#5-who-may-act) become cards; one `accept_offer` card per item, best you-keep first, others folded in. Sort by `(bucket, -money_cents, created_at)`. The done log of auto actions sits below the cards.

**Why this method**: A lexicographic key is predictable and explains itself (inferred); it is the Today spec's order (observed in the spec). The alternative, a learned priority, would reorder the screen in ways the person cannot predict.

**When it is not shown**: with no cards, Today shows the done log and what is live.

**How it is explained**: no sentence; the deadline shows on each card ("Expires in 40 min").

**Speed**: the card list is kept as a materialised view per account; target under 5 s from event to card.

**Check later**: time from card shown to answer, by position. Wrong if cards in the under-1-h bucket wait longer than later ones.

## 22. Which buyer gets the item when several want it

**Determines**: on sites where the seller chooses (Facebook, meetups, messages before an offer), who is first, who is next, and when the next is told.

**Sources and weights**

| Rank | Source | Why |
|---|---|---|
| 1 | First to commit: an accepted price and an agreed slot from [card 8](#8-which-pickup-time-to-offer-and-whether-to-book-it) | a commitment, not interest |
| 2 | Scam tier from [card 5](#5-how-likely-a-buyer-is-a-scam) is `none` | a flagged buyer drops back |
| 3 | Time of first message | first come is the norm people expect (inferred) |

**Method**: queue in that order; the first is booked; the next gets "You are next if it falls through" (auto, passes [card 4](#4-whether-a-drafted-reply-may-be-sent)). On a no-show from [card 6](#6-how-likely-a-buyer-will-not-show) or a cancel, the next is offered the item. No price raise to the queue: an auction in the inbox is not offered unless the person asks.

**Why this method**: Commitment first protects the seller's time, and arrival order keeps it fair (inferred). The alternative, pick the highest bidder, invites buyers to drop out and is a choice for the person, not the agent.

**When it is not shown**: with one buyer, no queue shows.

**How it is explained**: "Maya is booked for Saturday; Leo is next." Tap opens the queue.

**Speed**: kept per item; updated on each message.

**Check later**: sales completed by the next buyer after a fall-through. Wrong if under a third of fall-throughs end in a sale within 48 h.

## 23. Where an item is, and the pick list

*agent proposal*

**Determines**: the place shown for an item (`item.location {label, place?}`), the printable shelf label, and the order of the pick list when items sell.

**Sources and weights**

| Rank | Source | Why |
|---|---|---|
| 1 | The person's own entry: a `location.label` typed, picked from their saved places, or set by scanning a shelf label | they put it there |
| 2 | The last place used in the same capture session (inferred) | people photograph a batch and shelve it together |
| 3 | `seller_sku` and `quantity` from [product §3](../product.md) | the label shows both so a scan finds the row |

Weights: a strict order, not a blend; rank 2 fills only an empty field and shows as a suggestion (starting rule).

**Method**: each item gets a label with a code that opens its item page and its `seller_sku`, printed alone or as a sheet for a batch, the way Shopify's inventory labels and SKU barcodes work (observed, [suite map](../../research/cross-cutting/nate/shopify-suite-map.md)). On a sale ([card 12](#12-whether-a-sale-really-happened)), the item joins the pick list for the day: rows grouped by `location.label`, sorted by label text so a walk goes shelf by shelf, each row with the photo, title, buyer's site and ship-by time from [card 11](#11-the-ship-by-deadline-and-other-clocks). Scanning a label on the pick list marks it picked; the label batch in [card 10](#10-which-label-and-box) prints in the same order.

**Why this method**: A typed label is what a small seller keeps (a bin, a shelf, "closet top"); a full warehouse bin model is more than the person asked for and can grow from the same field (inferred). The alternative, guessing location from photos, is wrong too often to trust for a sold item.

**When it is not shown**: with no location set, the pick list shows "No place set" on that row and asks for it once on the item page; nothing is guessed.

**How it is explained**: the place shows under the title on the item page and the pick list; no sentence.

**Speed**: label and pick list render on request, under 1 s for 200 items (target).

**Check later**: time from sale to "picked". Wrong if items with a place take as long to pick as items without one.

## Summary

| # | Name | Owning feature | Main sources | Method in five words | Hide rule |
|---|---|---|---|---|---|
| 1 | Message meaning | messages | site events, extractors, classifier | calibrated multi-label with two bars | no number; unlabelled if under bar |
| 2 | Injection | messages | channel separation, action diff | separate channels, diff planned actions | hidden unless it fires |
| 3 | Allowed, asked, locked | messages | locked list, health, terms, limits, rules | first match ordered list | auto shown only in log |
| 4 | Reply send gate | messages | item facts, decision, entailment | typed claims, exact then entailment | pass not shown |
| 5 | Scam risk | messages | named scam signals | hard signals plus additive score | no percentage ever |
| 6 | No-show risk | sold | past no-shows, paid in-app, commitment | additive score triggers confirm message | never a number |
| 7 | Offer answer | messages | floor, you-keep, price path, interest | decreasing concession, precise counter amount | auto in log only |
| 8 | Pickup slot and booking | messages | hours, spot, calendar, buyer times | score slots inside allowed set | no hours, ask once |
| 9 | Ship or meet | sold | order, setting, site, size | first match ordered list | shown when both possible |
| 10 | Label, box, insurance, batch | sold | measure, dim rule, site caps, sale price | round up, smallest box, batch print | no measure, weigh first |
| 11 | Clocks | sold | order field, help pages | shorter clock, business days | default 3 days, said so |
| 12 | Sale verified | sold | paid order read back | triggers start, read proves | always shown |
| 13 | Delist set and red | sold, list | listings, exposure, routes | parallel jobs, exposure first, read-back | shown on item page |
| 14 | Double-sale keeper | sold | payment time, cancel cost | earlier paid, flag cheaper swap | always shown |
| 15 | Next check | messages, watch, sold, connect | events, tier bounds, change seen | halve on change, stretch quiet | not shown |
| 16 | Route | replay, connect | eligibility, success, speed, cost | lower bound, then fastest | trace only |
| 17 | Account health | connect | site warnings, probe, metrics | hard states, metric to threshold | ok shows nothing |
| 18 | Earned auto | messages | unedited approvals, undos | three across two items, offer | never-promoted kinds hidden |
| 19 | Dispute bundle | sold | tracking, capture, listing snapshot | map case reason to evidence | always shown |
| 20 | Notify tier | today | deadline, stake, kind | first match, batch the rest | auto never pushes |
| 21 | Today order | today | deadline, money, age | bucket, money, age sort | empty shows log |
| 22 | Buyer queue | messages | commitment, scam tier, arrival | commit first then arrival | one buyer, no queue |
| 23 | Location and pick list | sold | person's entry, session, sku | typed place, grouped walk order | no place, ask once |

### Cannot be made credibly now

| Determination | Why |
|---|---|
| A scam probability as a number | no per-site base rate of scams in resale threads was found; a percentage would be invented, so card 5 shows reasons only |
| A no-show probability | no record of no-shows exists for off-site deals and what a no-show does to metrics was not found ([shipping and pickup](../../research/sold/nate/shipping-and-pickup.md)) |
| A ban or suspension probability for an account | sites publish no ban rules; only published metric thresholds can be stated (card 17) |
| Whether a dispute will be won | case outcomes depend on site staff and are not published |
| Whether disclosing the assistant in a reply loses sales | one study (Luo 2019, about 80% fewer purchases, asserted) in another setting; open for Ben and Nate in [messages](../features/messages.md) |
| A guarantee that injection is caught | detection is not reliable; card 2 limits the damage instead |

### Needs from other areas

| From | What |
|---|---|
| [price](../features/price.md) | floor, price path with next markdown day, fees per site and `keep(x)`, per-site valuation range |
| [measure](../features/measure.md) | measured dimensions and weight with a measured or estimated flag |
| [item card](../features/item-card.md), [identify](../features/identify.md) | item facts with `source`, disclosed flaws with image regions, for cards 4 and 19 |
| [capture](../features/capture.md) | timestamped frames kept after sale |
| [connect](../features/connect.md) | capability and terms table per (site, verb), published seller metric thresholds per site |
| [score](../features/score.md), [data](../features/data.md) | labelled thread sets, calibration fitting, split tests for the offer rule, route success records |
| [replay](../features/replay.md) | recipe state and canary results per (site, verb) |
