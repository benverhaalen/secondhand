# The secondhand pitch constitution

How secondhand is told to anyone judging it: at the table, on stage, in the video, on the Devpost and on the website. Every talk track, slide and written page is checked against it before anyone hears or reads it.

Asked for by Ben on 2026-11-15 at 06:59 ([words](words.md#2026-11-15-a-pitch-constitution-ambiguous-problems-and-the-judges-own-logic)): "there are almost too many features to state all out loud and the process of thinking we went with building it is super important to how we explain it. we want to show that we think like a guy the companies need to hire. all implicit... understanding what i want out of this not what i say."

**Status.** *Agent proposal*, all of it, until Ben or Nate change it. Merged at 07:15 with the hard-calls thread's draft of the same constitution (its thirteen hard calls are in `spec/hard-calls.md`, draft PR #10); one file, not two. Retires after the MadHacks judging, or sooner if Ben picks another structure. It sits beside these and doesn't repeat them:

| Question | Where |
|---|---|
| What we can claim, and the number behind it | [numbers.md](numbers.md), [pitch.md, claims](pitch.md#claims-we-can-make-and-what-makes-each-true) |
| The hard questions and their answers | [qa.md](qa.md) |
| What each audience looks for; the demo script | [showcase.md](showcase.md) |
| What we haven't seen anyone else do | [unique.md](unique.md) |
| The theme | [theme.md](theme.md) |
| **How it's told, and why in that order** | **this file** |

**What Ben wants, read for intent.** Not a longer pitch. A judge with five minutes and forty projects should leave sure of three things: it really works, the people who built it think clearly about hard problems, and they would want those people on their team. Features are evidence for those three, not the point.

---

## Part I. Ends

**E1. They believe it's real.** A working product, not a staged demo.
*Test:* a judge could name one thing they saw happen that a mock-up can't do (their own item photographed; the listing open on the real site; the benchmark run in front of them).

**E2. They remember one thing.** One item, one story, one line. Not a feature list.
*Test:* ask "what did that team build?" ten minutes later. The answer fits in a sentence and has the jacket in it.

**E3. They see how we think.** Judgment shows in what we decided, what we refused, and what we found wrong in our own work.
*Test:* the pitch contains at least one "we chose X over Y because Z", one thing we refused to build, and one failure we caught in our own work.

**E4. Each judge hears their own field's logic, without being told.** Someone from insurance, trading, a data platform, a CRM company or engineering should each think "they get it", and no one should hear a lecture about their field.
*Test:* no field's name or jargon appears in the talk track or on a slide: insurance, underwriting, actuarial, counterparty, order book, pipeline, survivorship, golden record, circuit breaker, materiality, saga, CRM, Salesforce. Each beat of the worked example (Part IV) still maps to a principle each of those fields lives by.

**E5. Conviction.** We know exactly who it's for and why they'll use it.
*Test:* the person is named in one breath (someone clearing out their things), and we can say who it is not for.

**E6. Nothing we say is false on the day.** Confidence comes from saying what isn't done.
*Test:* every number has its mark (measured, observed, designed); the honesty gate in [qa.md](qa.md#before-you-say-it-the-honesty-gate) passes.

---

## Part II. What we have, and why, in three ideas

Everything we built serves one of three ideas. On stage we name the idea and show one proof; the rest of the inventory waits for questions ([showcase](showcase.md), [unique](unique.md), [numbers](numbers.md)).

| Idea | Why it's the idea | The one proof we show | What else is behind it (answers only) |
|---|---|---|---|
| **It does the work after you post** | writing a listing was never the hard part; the buyers, the offers, the second sale and the take-downs are | the sale on one site and the take-downs on the rest, each confirmed on the site | a harness per site that reads back every write; the fallback when a page changes (48 of 48); near-free sale detection (0.44 s); the double-sale check (931,406 states) |
| **It's always you** | people are wary of AI acting in their name, and they're right to be | the offer under your minimum that comes to you, with what you'd keep | code decides money and the address; drafts you send; claims checked against the item; trust earned one kind of action at a time; sign-ins in a secret scope the models never see |
| **It knows what things are worth, and how sure it is** | a price you can't question isn't worth trusting | the plan: what you keep on each site, and the sites it won't sell on | weighted comparable sales; ranges that hide when the data is thin; the photo check (173 of 174) |

**The feature budget.** In the main pitch, three ideas and one proof each. Everything else comes out only when a judge asks. A feature said unprompted has to replace one of the three. A feature appears only as the answer to "what if this goes wrong?"; a list sounds like every other team, a decision under pressure sounds like no one else.

**The same inventory, by the item's life.** Each stage is one beat of the jacket's story; the hard call beside it is the moment that shows it (calls are numbered as in `spec/hard-calls.md`).

| Stage | What we have | Why it exists, in one line | The moment that shows it |
|---|---|---|---|
| See it | guided capture, measuring, identity from the tag, studio photos with a check | condition is what everyone else leaves to the seller's word | the check catching a photo that hid a flaw |
| Value it | a range per site from real sales, what you keep, sell or donate | most things aren't worth the trip, and people can't tell which | the triage: these three are worth it, these twelve aren't |
| List it | one record, a listing shaped for each site's buyers, sites to skip | a couch on Depop is a wasted afternoon | call 8: between two grades, the lower one, with its reason |
| Handle buyers | drafts you send, offers inside your floor, meetups at safe spots | the messages are the part people quit over | calls 1 and 2: the backup offer; a sure $40 against a shaky $45 |
| Close it | the sale seen in seconds, the rest taken down, money clocks, disputes | a double sale or a lost case costs more than the item | calls 6 and 9: live on 3 of 4; the stain claim |
| Buy | a watch on every site, the fair-price check | the same engine, pointed the other way | call 12: a match re-read before it pings you |
| Learn | every sale grades the price we gave; trust earned and lost | an agent that can't be wrong out loud can't be trusted | call 13: a yes on $40 doesn't cover $400 |

---

## Part III. How we think: the questions we asked, in order

This order is the story of building it, and it is the best evidence of judgment we have. Tell it as decisions, not as features.

1. **Who is it for?** Someone clearing out their own things, not a full-time reseller. The crosslisters already serve resellers; the person with a closet of things worth money is served by no one, and gives up. ([decision](decisions.md#2026-11-14-the-first-person-we-build-for-is-someone-clearing-their-own-things))
2. **What's actually hard?** Not the listing: AI writes one in seconds. The hard part starts after you post.
3. **Where does it break?** We listed the failures before the features: two buyers pay at once; a page changes under us; a buyer doesn't show; an AI photo hides a stain; a reply promises something untrue; the price data is thin. Each has an answer below.
4. **Who decides?** Code decides anything about money, the address and deals off the site. The model only reads and words things. Over your line, you decide.
5. **What does it cost?** Cents an item. Watching for sales was the expensive part ($170 a month per person the obvious way), so we designed it down to almost nothing.
6. **How do we know?** We tried to break our own work: planted lies in our photos, broke our own refund rule, and published what we couldn't measure.

### The ten rules underneath every hard call

From `spec/hard-calls.md`. Memorize these, not the answers: any question a judge asks should be answerable from one of them, even one we didn't prepare for.

1. **Silence is never a yes.** When you don't answer, things stay as they are, and the clock that would hurt you gets louder.
2. **Keep the promise, take a backup.** A commitment to a buyer outranks a better price that arrives later.
3. **Count what is likely to land.** An offer is worth what it would put in your account times the chance it completes.
4. **Change only what matters, but a line you drew always matters.**
5. **Stop fast, start slow.** One sign of trouble on a site stops writes there; only a test that works starts them again.
6. **One record is the truth; every site is a copy we keep checking.** Fix forward; undo only what is unsafe.
7. **Each fact has one rightful source.** The camera for what it sees, the tag for codes, you for what no camera can see, the model for none of them.
8. **When unsure, say the less flattering thing, and say why.**
9. **The market answers, not us.**
10. **Every number has an age, and trust has a size.**

Say once, in one sentence, how we got there: every hard call was answered by finding the field that had already solved a problem with the same shape. Don't name the fields; let the answers show it.

### The messy problems, and how we answer each

The [edge cases spec](../spec/edge-cases.md) and the thread resolving the product's ambiguous problems are the full list; this is the part we say out loud. Each answer follows the same few rules, and the rules are what a judge should take away.

| Messy problem | Our answer | The rule underneath |
|---|---|---|
| It sells on two sites at once | take-downs start the moment one is paid; if a second buyer pays anyway, one card names both and suggests keeping the first paid; never silent | only a paid order counts; a known risk gets a planned response, never a surprise |
| An accepted Depop offer doesn't bind the buyer | an acceptance isn't a sale; the item stays live until someone pays | the money moving is the only proof |
| A take-down fails | it turns red after 5 minutes with Try again, Open on the site, Mark unavailable | a failure is shown, never hidden |
| A site changes its page | recorded steps, then typed steps, then an agent reading the page text; then a repair so the next call is plain again | degrade step by step, and learn from it |
| The price data is thin | a wide range and "still learning", or no price, with the reason | refuse to state what you can't back |
| An AI photo might hide something | checked against your photo with no model; held renders fall back to the real photo | the original is the record |
| A reply claims something the item doesn't back | held and shown to you | nothing goes out that the record can't support |
| A buyer might not show | a buyer who missed before is shown as "Missed 1 pickup with you" and gets a confirm 2 hours before; after two, it asks you before booking; a no-show is rebooked or the next buyer asked (`app/src/engines/trust/noshow.ts`) | judge the risk from what happened before; you make the call |
| A site warns the account | stop at the first warning and tell you | protect the account before the sale |

---

## Part IV. The worked example: one jacket

One story, told the same way everywhere. Each beat is plain about a jacket. Under it, a field's own logic is visible to anyone who has spent a career in it, and is never named.

> **One jacket, $40.** You take three photos. That jacket becomes one record: what it is, its size, its flaws, each fact pointing to the spot in the photo it came from. The four listings are views of that one record, never four copies.
>
> **Before it goes live**, we decide where and at what price from what similar jackets actually sold for. Where there's too little to go on, we say so instead of guessing, and the range gets wider.
>
> **You set the limits** once: the lowest price, where you'll meet. Inside them it acts; outside them it asks you.
>
> **A buyer on Depop accepts $40. An hour later, someone on eBay offers $45.** The first buyer keeps their place; the $45 waits as a backup in case they don't pay. A promise to a buyer is worth more than five dollars.
>
> **Saturday, 2:14, it sells on Depop.** From that moment, the three other listings are a risk: every minute they stay up, someone else can pay. So we close them, fastest where the risk is highest, and check each one is really gone.
>
> **If a second buyer pays anyway**, it isn't a surprise. We counted every way it can happen, 931,406 of them, and each one ends with a card in front of you: both buyers, what each refund costs, keep the first paid.
>
> **Every step is written down and never overwritten**, so a week later you can see exactly why it did what it did.
>
> **And if you don't answer, nothing happens that you didn't agree to.** It never takes your silence as a yes.

**For us only: how each beat reads to each judge.** Never say this column out loud; it's here so we pick words that land.

| Beat | Someone from insurance hears | Someone from trading hears | Someone from a data platform hears | Someone from a CRM company hears | An engineer hears |
|---|---|---|---|---|---|
| One record, four views | one policy, many exposures | one position, many venues | one source of truth, lineage to the source | one record, many channels | normalized state, derived views |
| Price from what sold; widen when thin | rating on loss history; credibility when the book is small | mark to market; wider spreads when it's illiquid | data quality gates; don't publish a metric on a thin sample | forecasts from closed deals, not pipeline hopes | calibrated uncertainty |
| You set the limits | policy limits; authority levels | position limits | access control and governance | approval processes | guardrails as code |
| Three listings are a risk until closed | exposure window; close the riskiest first | open exposure; flatten the riskiest leg first | latency against consistency | stale records across systems | race conditions; idempotent retries |
| Every case planned | reserves set before the claim arrives | stress-tested scenarios | tested failure modes | an escalation path for every case | model checking |
| Written down, never overwritten | the claims file; the audit | the trade blotter | append-only tables, time travel | field history, audit trail | an event log |
| The backup offer (call 1) | honor the bound policy; don't rescind for a better risk | time priority in the order book | | an opportunity stage that doesn't skip backwards | |
| Silence is never a yes (call 3) | no coverage bound without consent | no order without an instruction | | escalation rules and SLA timers | |
| The stain claim (call 9) | claims triage: settle small fast, contest on evidence | | | case management | |
| Live on 3 of 4 (call 6) | | | one source of truth reconciled to its copies; idempotent writes | the golden record synced to every system | sagas |

The full table, for all thirteen calls, is in `spec/hard-calls.md` and the hard-calls thread's draft; this one holds what we say on stage.

**Rules for saying it.** Use the words in the quote; they were chosen to sit in more than one field ("risk", "limits", "record", "written down", "planned"). Don't add the field's own jargon to make the mapping obvious; the judge does that part, and that's what makes it land. If a judge names the connection ("so it's like an exposure window"), say yes and go one level deeper in their terms; that is the moment to show you know it.

---

## Part V. The order on stage

Ben, 06:40: show it working first, then the engineering. The three hard calls go inside that order, not after it ([three minutes](pitch.md#the-three-minute-version-with-the-demo)):

1. **It works:** the jacket, three photos, the plan.
2. **It's real, and the demo's hard call:** the Depop buyer accepts, the higher eBay offer arrives, and it keeps the first and holds the second as a backup (call 1). Then the sale, and the take-downs, live on 3 of 4 with the fourth retrying and the record unchanged (call 6).
3. **How we think:** the jacket's story; then the stain claim: the photo from capture means contest; on an item with no photo of that spot, it recommends taking the return to protect the account (call 9).
4. **Close on the rule that covers all of it:** "It never takes your silence as a yes. It's always you."

## Part VI. Rules

**R1. One item.** Every demo, slide and example follows the same jacket, prepared so every step after the photo works. A second item appears only to show something the jacket can't (the couch that doesn't go on Depop). At the table, a judge's own item proves it's real: photograph it and show what it is and what it's worth, then go back to the jacket.

**R2. Show, then explain.** The first minute is the product working on something real. The engineering comes after the judge has seen it work.

**R3. The decision, then the reason, then the number.** The same order the product uses ([Ben, 06:53](words.md#2026-11-15-cross-listing-prices-are-a-choice-the-reason-in-words-first)): "It keeps the first buyer. Breaking a promise costs the account more than $10. On eBay, that cancel counts against a 2% limit." Never a number without the sentence before it. Each prepared answer fits in three sentences.

**R4. Three ideas, one proof each.** See the budget in Part II.

**R5. Say the mark.** "Measured", "observed on [date]", or "designed, not built yet". Never round a mark up.

**R6. Never name the judge's field.** Part IV's beats do that work.

**R7. Show a no and a fix.** Conviction comes from what we refuse: no guaranteed offers from our own estimate; silence never counts as a yes; never below your floor; no AI photo that hides a flaw; no model trained on data we aren't licensed to use. Name at least one refusal, and one flaw our own tests found (lining up the photos undid a stretch, so the gate missed 22 of 38 stretched photos until we fixed it).

**R8. Plain words, like a person.** Ben's writing rules apply ([skill](../.agents/skills/writing/SKILL.md)). No "revolutionary", no "seamless", no "leverage". Contractions. Short sentences.

**R9. Stop when they stop you.** Every version has a 10-second, a 30-second and a 3-minute cut; a judge's question beats the script.

**R10. Everything else lives in the answers.** [qa.md](qa.md) and [unique.md](unique.md) hold what we know; the pitch holds what we choose to say.

**R11. Every number carries its why, and earns its place.** "just saying 70 20 isnt a why. also those numbers arent even helpful" ([Ben, 08:59](words.md#2026-11-15-ben-every-number-and-decision-says-why-the-stockx-statistic-is-how-much-more-money-than-the-median)). A number is shown only when it answers a question the person has (do I get more money, how soon, can I trust it), in their units: dollars, days, "8 in 10". A threshold such as "within 20%" is a method, never the headline. Behind every number, one tap away: the operation that produced it, the baseline and why it is fair, how many items and which, the file, what it does not show, and the result that would have made it false. From Ben's evidence rules in his get-hired repo: never round a mark up, built is not decided, the claim is chosen before the score is seen, and a qualifier stays only if dropping it would mislead. The worked template is [claims.md](../spec/plans/backtest/claims.md).

---

## Part VII. Before going on

- [ ] The jacket is the one item, from the first photo to the take-downs.
- [ ] The first minute shows it working on something real; anything recorded is said to be.
- [ ] Three ideas named, one proof each; nothing else said unprompted.
- [ ] Three hard calls, each as decision, reason, number; one no; one flaw we found and fixed.
- [ ] Every feature named answers a "what if".
- [ ] No judge's field named and none of its jargon (E4's list); Part IV's words used.
- [ ] Every number has its mark; the honesty gate passes.
- [ ] The person it's for is named in one breath.
