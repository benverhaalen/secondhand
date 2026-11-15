# Hard calls: where there is no obvious right answer, and what the app does

*Agent proposal* from Ben at 06:59 ([words](../product/words.md#2026-11-15-find-the-ambiguous-problems-answer-them-from-adjacent-fields-and-a-pitch-constitution)): the messy problems where the product has to make a judgment call or can fail, each answered with the reasoning first and the numbers underneath. [edge-cases.md](edge-cases.md) lists what goes wrong; this file covers the cases where two good answers conflict and someone has to choose. Each answer borrows a mechanism from a field that already solved the same structure; the sources and their marks are in [hard-calls-references.md](../research/cross-cutting/ben/hard-calls-references.md) (R1 to R19). What only Ben or Nate can settle is in [open-questions.md](open-questions.md#for-both) (J46 to J52).

## The logic underneath

Ten rules decide every call below. A new hard call should be answered from these before anything new is written.

1. **Silence is never a yes.** When the person doesn't answer, things stay as they are, and the clock that would hurt them gets louder (call 3).
2. **Keep the promise, take a backup.** A commitment to a buyer outranks a better price that arrives later. The account's standing is worth more than any one sale (calls 1 and 9).
3. **Count what is likely to land.** An offer is worth what it would put in the person's account times the chance it completes (call 2).
4. **Change only what matters, but a line the person drew always matters.** Small drifts are absorbed; anything that crosses the floor asks (call 4).
5. **Stop fast, start slow.** One sign of trouble on a site stops writes there; only a test that works starts them again (call 5).
6. **One record is the truth; every site is a copy we keep checking.** Fix forward; undo only what is unsafe (call 6).
7. **Each fact has one rightful source.** The camera for what it sees, the tag for codes, the person for what no camera can see, the model for none of them (call 7).
8. **When unsure, say the less flattering thing, and say why.** It costs a little price and saves a return (calls 8 and 11).
9. **The market answers, not us.** We say once what similar things sold for, then let a date show the person (call 10).
10. **Every number has an age, and trust has a size.** Act only on fresh numbers; a yes on $40 does not cover $400; a model that drifts loses its say (calls 12 and 13).

## Already answered elsewhere

| Hard call | Where it is answered |
|---|---|
| One item priced on several sites: same take-home, same price, or what each site pays | [crosslist-pricing.md](../research/list/ben/crosslist-pricing.md); the seller picks a rule |
| "Gone by Friday" against "not under $X", and keeping as a good outcome | [selling intents](features/price.md#selling-intents) |
| It never sells | [D15](determinations/money.md#d15-markdown-path-stale-and-relist) and the `fallback` chosen at listing |
| It sells on two sites at once | [lifecycle.mjs](lifecycle.mjs) proves no double sale is silent; [edge cases §1](edge-cases.md#1-two-sites-sell-it-at-once) |
| Several buyers want it on Facebook | [card 22](determinations/managing-and-buyers.md#22-which-buyer-gets-the-item-when-several-want-it): commitment first, then arrival order |
| How accurate the price is, and the downside if it doesn't sell | the pitch thread's market.md (hit rate, PPE10, expected shortfall, accuracy-gated autonomy) |

## 1. A better offer arrives while the first buyer hasn't paid

**In their words.** "Someone on Depop took my price but hasn't paid. Now someone on eBay offers $10 more."

**Why it's hard.** The first buyer has a promise, not a payment. Taking the second offer means more money; keeping the first means being someone people can deal with. On eBay, Poshmark and Mercari, accepting an offer charges the buyer at once, so the gap only exists on Depop (24 hours to pay) and Facebook (dibs, no payment at all) ([sites.mjs](sites.mjs), `accept.charges_buyer`, `accept.pay_within_h`).

**Our answer.** Keep the promise, and make the better offer the backup. The eBay offer is left open, not declined and not countered, because accepting it would be a second sale. If the Depop buyer pays, the eBay buyer gets a polite "it sold." If the Depop window passes unpaid, the eBay offer becomes a one-tap card while it is still open. If it expires first, that money is lost, and the eBay buyer can be sent an offer later. The agent never cancels the first buyer for a better price. The person can, from the card, after seeing what it costs and how the first buyer will be told.

**The numbers underneath.** Depop's pay window is 24 hours and an eBay buyer offer expires in 24 hours (`offer.buyer.expires_h`, *observed*). On eBay, a cancel because the seller "sold it to someone else" is a defect, capped at 2% of transactions (R1, *observed*). `sellerOffer()` already refuses to send a binding offer while the item is promised elsewhere.

**Borrowed from.** The backup offer in real estate (R3): the seller doesn't break the first contract for a better one, but signs the better one to take over if the first falls through.

**Stands.** *New*: the backup state on an incoming offer. Who decides: the agent holds; only the person cancels a promise. Open: [J51](open-questions.md#for-both).

## 2. Two offers wait at once: which is worth more?

**In their words.** "One person offers $45, another $40. Easy, right?"

**Why it's hard.** The bigger offer isn't always the bigger payout. Fees differ by site, and an offer that only promises payment can fall through.

**Our answer.** Compare what each would most likely put in the person's account, and say it in words: "Ana's $40 on eBay is paid the moment you accept. Leo's $45 on Depop leaves you more, but he has no reviews and still has to pay." When one offer is clearly ahead, it is suggested first. When they are close, the first to arrive is suggested, because that is the norm people expect. Offers above an Always accept line never wait for this comparison: the first is accepted as it arrives.

**The numbers underneath.** Worth = what you keep × the chance it completes. An offer that charges at acceptance completes with near certainty; a promise takes its chance from [card 6](determinations/managing-and-buyers.md#6-how-likely-a-buyer-will-not-show) (no-show) and [card 5](determinations/managing-and-buyers.md#5-how-likely-a-buyer-is-a-scam). Illustration, not a measurement: eBay $40 keeps $34.16 (13.6% + $0.40) at about 1.0; Depop $45 keeps $43.07 (3.3% + $0.45), and at a 0.8 chance of payment it is worth $34.45. "Clearly ahead" means more than 10% apart (*agent proposal*).

**Borrowed from.** Counterparty risk in trading and lending (R4): an order is worth its size times the chance it settles.

**Stands.** *New* as a ranking on the offer cards; card 22 stays the rule for Facebook queues.

## 3. The person goes quiet

**In their words.** "I didn't open the app for three days."

**Why it's hard.** Every decision the app hands back can sit unanswered. Doing nothing has its own costs (a buyer drifts away, a ship-by date passes), but acting without a yes breaks the rule that money, address and price stay with the person.

**Our answer.** Silence leaves things as they are. Each kind of card says what happens if it isn't answered, and that outcome is always the one that can be undone. What gets louder is the clock that would hurt the person.

| Waiting on you | If you don't answer | Why |
|---|---|---|
| An offer | it expires on the site's clock; nothing is accepted | an unanswered offer is already a no on every site |
| A reply to a buyer (drafts) | the draft is not sent; one stronger reminder at 12 hours | a reply in your name needs your yes ([decision](../product/decisions.md#2026-11-15-replies-to-buyers-start-as-drafts-the-person-approves)) |
| A meetup time the buyer picked | nothing is confirmed; the buyer is told nothing | the agent never confirms a time you did not approve ([decision](../product/decisions.md#2026-11-15-no-fixed-pickup-windows-tap-the-days-and-times-that-work-and-approve-the-buyers-pick)) |
| A price drop or relist step | the price stays | a lower price can be taken by a buyer at once; staying can be changed later |
| A ship-by date | nothing can be done for you; reminders step up at half the site's clock, at 80% and the evening before | the site cancels and counts it against you ([card 11](determinations/managing-and-buyers.md#11-the-ship-by-deadline-and-other-clocks)) |
| A refund after a double sale | nothing is refunded for you; it goes to the top of Today and pushes at once | refunds are locked to the person |
| Many cards for 3 days | one message offers Pause selling | stops new buyers until the person is back ([ways out](ways-out.md)) |

A rule the person set ahead, such as Always accept $40 or more, is not silence: it is a yes given in advance, and it runs.

**The numbers underneath.** Reminder steps at 50% and 80% of each clock, plus the evening before (*agent proposal*); 12 hours for an unsent reply; 3 days to the Pause selling offer. Each `decision` kind carries `on_silence` (what happens) and `escalate_at[]`.

**Borrowed from.** Contract law, where silence is not acceptance unless agreed (R12), and escalation policies in incident response, where a page gets louder as time passes (R13).

**Stands.** *New*: the per-kind table ([J46](open-questions.md#for-both)). Today already lets a card expire with the site's outcome logged ([today](features/today.md)).

## 4. A site changes its fees while things are listed

**In their words.** "Mercari raised its fee. Are my prices wrong now?"

**Why it's hard.** Re-solving every price after each change keeps the take-home exact, but a price edit is not free: on some sites it notifies likers, and on Poshmark and Mercari a later offer must undercut the lowest price the item has had (`offer.seller.under_lowest`). Ignoring the change lets the take-home slip.

**Our answer.** Drafts re-solve at once, because nothing is live. Live listings change only when the difference in what the person keeps is big enough to matter. Any change that would leave the take-home under the person's floor always asks, however small. A change in a site's rules, such as a new required field, pauses that step on that site only, with a card that says what is needed.

**The numbers underneath.** A live price is re-solved when the keep moves by more than $1 or 5% of the keep, whichever is larger (*agent proposal*). The floor test runs on every fee change. Fee rows keep `valid_from`; a row older than 30 days already marks "fees may have changed" ([edge cases §2](edge-cases.md#2-different-fees-take-and-payout-timing)).

**Borrowed from.** Materiality in accounting (R9): small changes under a rule of thumb (the SEC's 5%) are absorbed, but "qualitative factors may cause misstatements of quantitatively small amounts to be material". The floor is our qualitative factor.

**Stands.** *New*: the threshold and the floor override ([J47](open-questions.md#for-both)).

## 5. A site starts failing for everyone

**In their words.** "Posting to Mercari keeps failing."

**Why it's hard.** One failure may be one person's expired sign-in. Many failures at once usually mean the site changed. Retrying hard looks like a bot and can get accounts limited; stopping too soon leaves people stuck.

**Our answer.** Stop fast, start slow. When writes to one site through one route fail in a pattern, writes there stop for every account on that route; reads continue, so sales are still seen. People see "Posting to Mercari is paused" with Post it myself, which opens the site with the listing copied. After a wait, one write is tried. If it works, writing resumes. If it fails, the wait doubles. The system can stop a site on its own; it can start one again only after a test that worked.

**The numbers underneath.** Opens on 3 failed writes in a row across accounts within 15 minutes, or on one write page whose fingerprint doesn't match the fixture ([protocol](engines/protocol-and-adapters.md)). First test after 15 minutes, then 30, 60. A warning on one account already stops automation on that account (`site_warning`). A write whose outcome is unknown is never replayed (existing rule).

**Borrowed from.** The circuit breaker (R8): open "fails immediately"; half-open lets "a limited number of requests" through; "If any request fails ... it reverts to the Open state."

**Stands.** *New*: the breaker across accounts. Open for Nate: [J48](open-questions.md#for-both).

## 6. It posted on three sites out of four, or a change half applied

**In their words.** "It's live on eBay, Depop and Poshmark, but Mercari failed."

**Why it's hard.** Undo everything and the listings that worked are lost; leave it and the item is in a half state.

**Our answer.** The item card is the one record of what the person wants. Each site is a copy, and a loop keeps checking each copy against the card and fixing what differs. Steps that worked stay. Failed steps are retried with the same operation id, so a retry never posts twice. Something is undone only when the half state is unsafe, such as a listing still up after a sale, which already turns red ([edge cases §14](edge-cases.md#14-taking-a-listing-down)). The screen says it plainly: "Live on 3. Mercari: trying again at 3:40." When the person edits a listing on the site itself, that is a new wish, not an error, and the app asks once: this site only, or everywhere ([`site_changed_listing`](edge-cases.md#9-more-places-it-can-go-wrong)).

**The numbers underneath.** Retries at 1, 5, 15 and 60 minutes, then a card (*agent proposal*). Every write carries an `operation_id`; reconcile settles any write with an unknown outcome by reading, never by sending again ([protocol](engines/protocol-and-adapters.md)).

**Borrowed from.** Sagas with compensating steps (R6): each step idempotent, and compensation "doesn't necessarily return the system data to its state at the start". The desired-state loop of infrastructure controllers (R7).

**Stands.** Mostly specced; *new* is the stated rule: fix forward, undo only what is unsafe.

## 7. The sources disagree about a fact

**In their words.** "The tag says M but it fits like an L." "I said like new, but it has pilling."

**Why it's hard.** Every source is right about something. The tag is right about what the maker printed; the tape is right about the garment; the person knows what no photo shows.

**Our answer.** Each kind of fact has one rightful source, in order. When two sources disagree in a way a buyer cares about, the listing shows both: "Tag says M. Measures 22 in. pit to pit, like an L."

| Fact | First | Then | Never decides |
|---|---|---|---|
| Measurements, visible flaws, colour | measured from photos, with a scale | the person | the model's guess |
| Brand, size label, style code, RN | the tag, read by two readers that agree | the catalog, the person | |
| What it is (model, year) | a code on the label matched to the catalog | photo match, the person | |
| What no camera sees: works, smoke, pets, history | the person | | the model |
| Condition grade | worked out from the flaw list | the person may grade it lower; higher only with a photo that shows the flaw is not there | |

**The numbers underneath.** Each fact keeps its `source` and `confidence` ([item card](features/item-card.md)); a conflict after two frames becomes a question with both readings ([seeing the item](determinations/seeing-the-item.md)).

**Borrowed from.** Survivorship in master data management (R5): per field, sources are ranked by trust, and a source's trust can be lowered by its data quality.

**Stands.** Partly specced (measured wins, tag beside it; conflicts ask). *New*: the one table.

## 8. The condition is between two grades, and every site grades differently

**In their words.** "Is this Excellent or Good?"

**Why it's hard.** Five sites use five condition scales ([listing fields](../research/list/nate/listing-fields-by-platform.md)). A higher grade sells for more and sooner; a grade a buyer disagrees with comes back as a return.

**Our answer.** One measured condition record, mapped to each site's own scale. When it falls between two grades, the listing takes the lower one and the description says why: "Light pilling at the cuffs, so Good, not Excellent." A buyer who reads the reason trusts the rest.

**The numbers underneath.** The price gap between two grades is learned from paired sales, like flaw discounts ([D2](determinations/money.md#d2-condition-variant-completeness-and-size-adjustment)); until then it is unknown. A not-as-described return costs shipping both ways, the sale, and on eBay a case (R2). The rule is right if returns for condition fall and the price given up is smaller than the returns saved. Measure it on the first real sales.

**Borrowed from.** Bank capital rules (R11): when two ratings of the same loan differ, the worse one applies.

**Stands.** *New*. Open for Ben: [J49](open-questions.md#for-both).

## 9. A buyer says it isn't as described: refund, or contest it?

**In their words.** "The buyer says there's a stain. There wasn't."

**Why it's hard.** Refunding when the person was right feels unfair; contesting and losing marks the account. For a small seller the account is the asset: eBay allows 2 cases closed without seller resolution per period, or 0.3% of transactions, whichever is higher (R2). With 40 sales a year, the count of 2 is the limit that binds.

**Our answer.** The person always decides; refunds stay locked to them. The app recommends, in words, from what our own record can prove:

1. The flaw the buyer names is in our photos and in the listing: contest, with the evidence ready ([card 19](determinations/managing-and-buyers.md#19-what-evidence-to-assemble-for-a-dispute)).
2. Our photos don't cover that spot, or show the flaw and the listing missed it: take the return. We can't prove it, or it is our miss.
3. A small item where contesting costs more time than it saves: take the return, or a partial refund if the buyer offers to keep it.

On eBay the card shows where the account stands: "1 of 2 cases this period."

**The numbers underneath.** "Small" is a keep under $20 (*agent proposal*). The case count comes from the account read ([card 17](determinations/managing-and-buyers.md#17-whether-an-account-is-healthy-or-at-risk)).

**Borrowed from.** Insurance claims (R19): small claims are settled fast when investigating costs more than paying; large ones are contested on evidence gathered at the time.

**Stands.** *New*: the recommendation ([J50](open-questions.md#for-both)). The evidence bundle is specced.

## 10. The person wants a price the market won't pay

**In their words.** "It's worth $200 to me."

**Why it's hard.** Owners value their things above what buyers pay. Arguing loses the person; listing silently wastes their time.

**Our answer.** List it at their price; it's their thing. Say once what similar ones sold for, and set a date when the market will answer: "Similar ones sold for $36 to $52. We'll show you how it's doing on Dec 3." On that date the card shows views, saves and offers against similar listings of the same age, with three choices: keep the price, take the plan's price, or keep the item. No warnings in between.

**The numbers underneath.** Shown when the price is above the top of the sold range; above three times, the typo check asks first ([edge cases §3](edge-cases.md#3-human-error-in-what-people-type)). The date is the plan's median days to sell ([D11](determinations/money.md#d11-time-to-sell-range)), at least 7 days.

**Borrowed from.** The endowment effect (R14): owners ask about twice what buyers will pay, so the answer is evidence on a date, not an argument.

**Stands.** Partly specced (reserve mode, `review_at` in [selling intents](features/price.md#selling-intents)). *New*: one check-in in place of repeated warnings.

## 11. We aren't sure what it is, and the answer changes the price a lot

**In their words.** "Is this the rare one?"

**Why it's hard.** Pricing the rare version risks a listing that never sells, or a fake. Pricing the common one may leave money behind.

**Our answer.** Price the version we can show. Ask the one question or photo that would settle it only when the answer is worth the ask. Show the upside as a condition, never as the price: "If the tag says Made in USA, it's worth about $80 more. Show us the tag." A brand that is often faked is never written into the listing on a guess, and the listing says what was not checked.

**The numbers underneath.** Ask when the chance of the better version times the price difference is more than $5 or 10% of the price (*agent proposal*). The "could be valuable" mark stops the quick path above that ([edge cases §4](edge-cases.md#4-not-knowing-what-it-is-a-relatives-things-a-pile-a-house)).

**Borrowed from.** Value of information in decision analysis (R15), and the appraiser's stated "extraordinary assumption" (R16).

**Stands.** Capture's "one more view only when it settles something" is decided ([decision](../product/decisions.md#2026-11-14-capture-is-one-session-and-the-item-picks-the-mode)). *New*: the threshold for asking.

## 12. The numbers might be out of date

**In their words.** "It said $30 but it's $45 now." "It said the jacket was still up."

**Why it's hard.** Reading everything live is slow and costs sessions; reading nothing live acts on yesterday's world.

**Our answer.** Every number keeps when it was true. Each kind has a shelf life set by how fast it changes and what it's used for. Before acting on a number past its shelf life, the app reads it again. The age is shown only when it matters.

| Number | Good for | Past that |
|---|---|---|
| A listing we'd buy: still up, and its price | 10 minutes | read again before the push or the Buy tap |
| Whether our item sold | about 2 minutes, the watch interval | only an order read moves it to sold ([edge cases §12](edge-cases.md#12-how-a-sale-is-seen-and-what-stands-in-for-it)) |
| Comparables for a price | 90 days, older counting less ([D3](determinations/money.md#d3-time-adjustment)) | the range widens |
| A site's fees | 30 days | "fees may have changed" |
| A buyer's profile on a card | when the card opens | read again |
| An offer's state | at the tap | a stale card can't act (`409 stale`) |

**The numbers underneath.** The 10-minute budget is *agent proposal*; the rest are specced where linked.

**Borrowed from.** Trading never acts on a stale quote (R17).

**Stands.** *New*: one table, and the read before a buy alert, which matters since a watched item under your price now pushes at once ([decision](../product/decisions.md#2026-11-15-a-sale-and-a-watched-item-under-your-price-notify-at-once)).

## 13. Trust earned on small things, and trust lost

**In their words.** "I said yes three times on $40 offers. Did I just say yes to $400?"

**Why it's hard.** Asking less over time is the point of the tiers. But three approvals at one size say little about a much bigger one, and a model that was right last month may be drifting now.

**Our answer.** Trust is sized to the stakes. Three unedited approvals let the agent act alone up to about the size of what was approved, not beyond; above that it asks again. Trust can also be lost by the model: when sale prices in a category keep landing away from our estimates, that category's ranges widen and its automatic steps pause until they come back. The person sees why: "Jacket prices have been off lately, so we're asking again."

**The numbers underneath.** An earned rule covers up to 1.5 times the largest amount among the approvals that earned it (*agent proposal*); the $500 ceiling stays ([edge cases §8](edge-cases.md#8-breaking-the-ai-on-purpose)). Drift is actual over expected: sale price divided by the middle of our range, over the last 30 sales or 90 days in a category. It pauses automation when it leaves 0.85 to 1.15 and its interval excludes 1 (*agent proposal*). This complements the pitch thread's accuracy gate, which uses the backtest before launch; this one watches real sales after.

**Borrowed from.** Delegated authority limits in underwriting and lending (R18), and the actuary's actual-to-expected ratio (R10).

**Stands.** [Card 18](determinations/managing-and-buyers.md#18-whether-an-action-kind-has-earned-auto) counts approvals per kind and scope; *new* is the size limit and the drift pause. Open: [J52](open-questions.md#for-both).

## Backend asks

Fields and endpoints these calls need are in [packet 53](../.agents/team/packets/team/53-hard-calls-for-the-backend.md).
