# The secondhand pitch constitution

How secondhand is told to anyone judging it: at the table, on stage, in the video, on the Devpost and on the website. Every talk track, slide and written page is checked against it before anyone hears or reads it.

Asked for by Ben on 2026-11-15 at 06:59 ([words](words.md#2026-11-15-a-pitch-constitution-ambiguous-problems-and-the-judges-own-logic)): "there are almost too many features to state all out loud and the process of thinking we went with building it is super important to how we explain it. we want to show that we think like a guy the companies need to hire. all implicit... understanding what i want out of this not what i say."

**Status.** *Agent proposal*, all of it, until Ben or Nate change it. It sits beside these and doesn't repeat them:

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

**E4. Each judge hears their own field's logic, without being told.** Someone from insurance, a data platform, a CRM company or engineering should each think "they get it", and no one should hear a lecture about their field.
*Test:* the words "insurance", "underwriting", "pipeline", "CRM", "Salesforce" and "like a bank" never appear in the talk track. Each beat of the worked example (Part IV) still maps to a principle each of those fields lives by.

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

**The feature budget.** In the main pitch, three ideas and one proof each. Everything else comes out only when a judge asks. A feature said unprompted has to replace one of the three.

---

## Part III. How we think: the questions we asked, in order

This order is the story of building it, and it is the best evidence of judgment we have. Tell it as decisions, not as features.

1. **Who is it for?** Someone clearing out their own things, not a full-time reseller. The crosslisters already serve resellers; the person with a closet of things worth money is served by no one, and gives up. ([decision](decisions.md#2026-11-14-the-first-person-we-build-for-is-someone-clearing-their-own-things))
2. **What's actually hard?** Not the listing: AI writes one in seconds. The hard part starts after you post.
3. **Where does it break?** We listed the failures before the features: two buyers pay at once; a page changes under us; a buyer doesn't show; an AI photo hides a stain; a reply promises something untrue; the price data is thin. Each has an answer below.
4. **Who decides?** Code decides anything about money, the address and deals off the site. The model only reads and words things. Over your line, you decide.
5. **What does it cost?** Cents an item. Watching for sales was the expensive part ($170 a month per person the obvious way), so we designed it down to almost nothing.
6. **How do we know?** We tried to break our own work: planted lies in our photos, broke our own refund rule, and published what we couldn't measure.

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
> **Saturday, 2:14, it sells on Depop.** From that moment, the three other listings are a risk: every minute they stay up, someone else can pay. So we close them, fastest where the risk is highest, and check each one is really gone.
>
> **If a second buyer pays anyway**, it isn't a surprise. We counted every way it can happen, 931,406 of them, and each one ends with a card in front of you: both buyers, what each refund costs, keep the first paid.
>
> **Every step is written down and never overwritten**, so a week later you can see exactly why it did what it did.

**For us only: how each beat reads to each judge.** Never say this column out loud; it's here so we pick words that land.

| Beat | Someone from insurance hears | Someone from a data platform hears | Someone from a CRM company hears | An engineer hears |
|---|---|---|---|---|
| One record, four views | one policy, many exposures | one source of truth, lineage to the source | one record, many channels | normalized state, derived views |
| Price from what sold; widen when thin | rating on loss history; credibility when the book is small | data quality gates; don't publish a metric on a thin sample | forecasts from closed deals, not pipeline hopes | calibrated uncertainty |
| You set the limits | policy limits; authority levels | access control and governance | approval processes | guardrails as code |
| Three listings are a risk until closed | exposure window; close the riskiest first | latency against consistency | stale records across systems | race conditions; idempotent retries |
| Every case planned | reserves set before the claim arrives | tested failure modes | an escalation path for every case | model checking |
| Written down, never overwritten | the claims file; the audit | append-only tables, time travel | field history, audit trail | an event log |

**Rules for saying it.** Use the words in the quote; they were chosen to sit in more than one field ("risk", "limits", "record", "written down", "planned"). Don't add the field's own jargon to make the mapping obvious; the judge does that part, and that's what makes it land. If a judge names the connection ("so it's like an exposure window"), say yes and go one level deeper in their terms; that is the moment to show you know it.

---

## Part V. Rules

**R1. One item.** Every demo, slide and example follows the same jacket, prepared so every step after the photo works. A second item appears only to show something the jacket can't (the couch that doesn't go on Depop). At the table, a judge's own item proves it's real: photograph it and show what it is and what it's worth, then go back to the jacket.

**R2. Show, then explain.** The first minute is the product working on something real. The engineering comes after the judge has seen it work.

**R3. A decision and its reason, not a feature.** "We check the money with code, not the model, because a model can be talked into things" beats "rule-based offer handling".

**R4. Three ideas, one proof each.** See the budget in Part II.

**R5. Say the mark.** "Measured", "observed on [date]", or "designed, not built yet". Never round a mark up.

**R6. Never name the judge's field.** Part IV's beats do that work.

**R7. Show a no and a fix.** One thing we refused to build (auto-accepting offers; showing an AI photo unchecked) and one flaw our own tests found (lining up the photos undid a stretch, so the gate missed 22 of 38 stretched photos until we fixed it).

**R8. Plain words, like a person.** Ben's writing rules apply ([skill](../.agents/skills/writing/SKILL.md)). No "revolutionary", no "seamless", no "leverage". Contractions. Short sentences.

**R9. Stop when they stop you.** Every version has a 10-second, a 30-second and a 3-minute cut; a judge's question beats the script.

**R10. Everything else lives in the answers.** [qa.md](qa.md) and [unique.md](unique.md) hold what we know; the pitch holds what we choose to say.

---

## Part VI. Before going on

- [ ] The jacket is the one item, from the first photo to the take-downs.
- [ ] The first minute shows it working on something real; anything recorded is said to be.
- [ ] Three ideas named, one proof each; nothing else said unprompted.
- [ ] One decision with its reason, one no, one flaw we found and fixed.
- [ ] No judge's field named; Part IV's words used.
- [ ] Every number has its mark; the honesty gate passes.
- [ ] The person it's for is named in one breath.
