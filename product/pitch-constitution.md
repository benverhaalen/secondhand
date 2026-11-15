# Pitch constitution

The rules every piece of the pitch follows: the deck, the video, the live demo, the Q&A answers, the Devpost page and the website's explainers. The pitch itself lives in [pitch.md](pitch.md) and the pitch thread's files; this page says how any of it is made. *Agent proposal* from Ben at 06:59 ([words](words.md#2026-11-15-find-the-ambiguous-problems-answer-them-from-adjacent-fields-and-a-pitch-constitution)). Retires after the MadHacks judging, or sooner if Ben picks another structure.

## What the pitch has to do

Ben's words ask for two things he doesn't want said out loud:

1. **Conviction.** The judges believe we understand this problem better than anyone in the room, because we have already decided the hard parts.
2. **The hire signal.** An insurance lifer, a trader, a data-platform engineer and a CRM person each leave thinking "they reason the way we do", without ever hearing their field named.

Everything below serves those two. A slide, line or demo step that serves neither is cut.

## Articles

**1. Show judgment, not features.** A feature appears only as the answer to "what if this goes wrong?" The audience learns the product by watching it decide. We have too many features to list, and a list sounds like every other team. A decision under pressure sounds like no one else.

**2. One item, one life.** The pitch follows one real thing from photo to sale to afterwards. Every feature shown is a moment in that life where something could break. Anything not on that path goes to Q&A, the site or the FAQ.

**3. The decision, then the reason, then the number.** The same order the product uses ([Ben, 06:53](words.md#2026-11-15-cross-listing-prices-are-a-choice-the-reason-in-words-first)). "It keeps the first buyer. Breaking a promise costs the account more than $10. On eBay, that cancel counts against a 2% limit." Never a number without the sentence before it.

**4. Speak their logic in our words.** Never "like insurance", never a field's jargon on a slide. The mechanism lives inside the item's story, and a judge who knows it recognizes it. The table in [the hidden layer](#the-hidden-layer-what-each-judge-hears) is for us, not for the slides.

**5. Conviction comes from what we refuse.** Each telling names at least one thing we won't do, and why: no guaranteed offers from our own estimate; silence never counts as a yes; never below the person's floor; no AI photo that hides a flaw; no model trained on data we aren't licensed to use. Refusals are what make the yeses believable.

**6. Every claim wears its mark.** Measured, built or designed, as in the pitch thread's honesty gate. Show one honest loss. "Designed" said plainly is stronger than "built" caught out.

**7. Show how we decided, once.** Every hard call was answered by finding the field that had already solved its structure ([hard calls](../spec/hard-calls.md)). Say that once, in one sentence, then let the answers show it. Don't name the fields.

**8. Plain words.** The `writing` skill applies, and its lint catches the inflated words every other team uses.

**9. Three hard calls on stage, the rest held for questions.** Each prepared answer is three sentences: the decision, the reason, the number.

## The logic underneath

The ten rules in [hard calls](../spec/hard-calls.md#the-logic-underneath) are the product's reasoning in one list. They are the thing to memorize: any question a judge asks should be answerable from one of them, even one we didn't prepare for.

## The hidden layer: what each judge hears

For us only. The left column is what we say; the others are what each kind of judge recognizes without being told. Calls refer to [hard-calls.md](../spec/hard-calls.md).

| What we show | Insurance hears | Trading hears | Data platform hears | CRM hears |
|---|---|---|---|---|
| A better offer waits as a backup; the first buyer keeps their place (call 1) | honor the bound policy; don't rescind for a better risk | time priority in the order book | | an opportunity stage that doesn't skip backwards |
| A sure $40 can beat a shaky $45 (call 2) | expected loss: frequency times severity | expected value, counterparty risk | | lead scoring |
| Silence never says yes; the clock that hurts gets louder (call 3) | no coverage bound without consent | no order without a trader's instruction | | escalation rules and SLA timers |
| A fee change moves a live price only if it matters, and always if it crosses your floor (call 4) | materiality; a rate change applied at renewal | rebalancing bands | change thresholds | |
| One site breaking pauses it for everyone until a test works (call 5) | a moratorium on new business in a storm zone | a trading halt, a kill switch | the circuit breaker | |
| Live on 3 of 4; it fixes forward and never undoes what worked (call 6) | | | one source of truth reconciled to its copies; idempotent writes | the golden record synced to every system |
| The tape beats the tag for size; you beat the camera for smoke (call 7) | the claim file: which document proves what | | lineage | survivorship rules |
| Between two grades, it lists the lower and says why (call 8) | conservative underwriting; misrepresentation voids the policy | a haircut on collateral | | |
| A stain claim: contest with photos, or take the return to protect the account (call 9) | claims triage: settle small fast, contest on evidence | | | case management |
| $200 to you: listed, and the market answers on Dec 3 (call 10) | the adjuster's comparables, not an argument | mark to market | | |
| "If the tag says Made in USA, about $80 more" (call 11) | scheduled items need an appraisal | the value of information | | |
| A match is re-read before it pings you (call 12) | | never trade on a stale quote | data freshness | |
| A yes on $40 doesn't cover $400; drift takes autonomy away (call 13) | authority limits; actual over expected | position limits | model monitoring in MLflow | approval hierarchies |
| Every price opens to the sales it came from (market.md) | the adjuster's comparables | | lineage from the number to the rows | |

## What we have, and why, by the item's life

The inventory a judge never hears as a list. Each stage is one beat of the story; the hard call beside it is the moment that shows it.

| Stage | What we have | Why it exists, in one line | The moment that shows it |
|---|---|---|---|
| See it | guided capture, measuring, identity from the tag, studio photos with a check | condition is what everyone else leaves to the seller's word | the check catching a photo that hid a flaw |
| Value it | a range per site from real sales, what you keep, sell or donate | most things aren't worth the trip, and people can't tell which | the triage: these three are worth it, these twelve aren't |
| List it | one record, a listing shaped for each site's buyers, sites to skip | a couch on Depop is a wasted afternoon | call 8, the lower grade with its reason |
| Handle buyers | drafts you approve, offers inside your floor, meetups at safe spots | the messages are the part people quit over | calls 1 and 2 |
| Close it | the sale seen in seconds, the rest taken down, money clocks, disputes | a double sale or a lost case costs more than the item | calls 6 and 9 |
| Buy | a watch on every site, the fair-price check | the same engine, pointed the other way | call 12 |
| Learn | every sale grades the price we gave; trust that's earned and lost | an agent that can't be wrong out loud can't be trusted | call 13 |

## The order on stage

The arc in [pitch.md](pitch.md) stands (problem, product, demo, trust, data). The hard calls go inside it, not after it:

1. **In the demo:** the Depop buyer accepts, a higher eBay offer arrives, and the app keeps the first and holds the second as a backup (call 1). Trading and CRM judges recognize it.
2. **In trust:** the stain claim. The app shows the photo from capture and recommends contesting; on a different item with no photo of that spot, it recommends taking the return (call 9). Insurance judges recognize it.
3. **In data:** live on 3 of 4, the fourth retrying, the record unchanged (call 6), then one price opened to its sales. Databricks and Salesforce judges recognize it.
4. **Close on the rule that covers all of it:** "It never takes your silence as a yes."

## Before anything ships

- Each feature named answers a "what if".
- No field's jargon on a slide or in the script: actuarial, survivorship, saga, circuit breaker, materiality, golden record, counterparty, underwriting, A/E.
- Each number carries its mark, and its sentence comes first.
- Each prepared answer fits in three sentences.
