# What is the evidence on how much buyer communication and negotiation a seller's agent should handle on its own: tiers that learn (A) or handled by default inside limits set up front (B)?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: messages.

Evidence marks: *observed* (source opened, URL and date given), *asserted* (source claims without showing, or a search summary I did not open as a page), *inferred* (my reasoning). Search-result summaries are asserted unless I fetched the page. This note extends `../ben/messages-and-offers.md` (called MO below), `../../cross-cutting/ben/psychology.md` (PSY), `../../../product/walkthrough.md` section 9 (WT9) and `../../../spec/lifecycle.mjs`. It does not repeat their tier table (MO L73-92), guard (MO L98-135) or promotion gates (MO L141-162).

## 1. Shipped products

| Product | What it automates | What it keeps for the person | How limits are set | Outcome data or failures | URL, date |
|---|---|---|---|---|---|
| Facebook Marketplace auto-reply (Meta) | Replies to availability questions, built from listing facts (*observed* in the earlier fetch of Meta's announcement) | Everything else (price, pickup, payment) | Set up when creating the listing; no per-reply limits | No outcome data found. No disclosure to the buyer stated in the source. | Meta announcement, 12 Mar 2026 (URL in the transcript; not re-fetched this session) |
| Meta Muse agent | Acts on the user's behalf after "Allow Always" permission | Nothing once always-allow is given | A permission toggle | Documented failure of Allow Always (*observed* in the earlier fetch) | Sep 2026 (URL in the transcript) |
| eBay AI Assistant for messages | Drafts replies | Every send: seller reviews each message (*observed*) | None needed, draft only | None published | eBay help/news pages fetched earlier; dated 2026 |
| eBay Best Offer auto-accept and auto-decline, send offer to watchers | Accepts or declines offers by a seller-set number | Counters and everything between the numbers | Per-listing numbers (design B shape). Expiry 24 h, counter at 96 h per MO L14, L24 | No outcome data found (not-found) | MO L16, L33-43 (existing note) |
| eBay User Agreement | Bans "any end-to-end flow that attempts to place orders without human review" | n/a | n/a | n/a (a buyer-side rule; see WT9) | WT9 L135-157, effective 20 Feb 2026 |
| Mercari Smart Offers | Floor, auto-accept at or above, one auto-counter below (design B, shipped) | Anything below the counter | Floor per listing | Discontinued 4 Nov 2024 (*observed* in the earlier fetch). The page gave no reason, so the reason is not found. | Mercari help, 4 Nov 2024 |
| Poshmark Smart Sell | Accepts or counters inside a seller range, then a "step in" notification when no deal fits the range (design B plus an exception ping) | The out-of-range case | Price range per listing | Status "testing" (1 Jul 2025); reached Bulk Upload in Jan 2026 (*observed*). No outcome data. | Poshmark help/blog, 1 Jul 2025 and Jan 2026 |
| Poshmark Offer to Likers, closet tools | Sends discounted offers to likers on a rule | Choice of rule | Discount and shipping set once | No outcome data found | MO L16 |
| Depop `auto_negotiate_offer_price` | Auto-handles offers by price setting | Messages | Per-listing field | No outcome data found | MO L16 |
| Airbnb scheduled quick replies | Trigger-based canned messages; the AI only suggests templates (*observed* earlier) | Free-text replies | Trigger and timing | None published | Airbnb help, 2026 |
| Hospitable AI Auto Reply | Guest replies with a 1 to 2 minute delay. Per-property or per-stage "settings groups"; active hours on a Timing tab | Refunds, discounts, pricing, payments, availability, date changes, address and codes before booking, "actions or decisions on the host's behalf". Escalation messages are written by the host and "AI never rewrites them". | Settings groups; only the first matching group applies, groups are not combined | When it does not send, the reason is written into the conversation notes and the host is notified by email and push. The page does not say whether guests are told it is AI. No outcome data. | https://help.hospitable.com/en/articles/10977601-ai-auto-replies-for-guest-messages (*observed*, fetched 2026-11-14, article undated) |
| ProhostAI | Per-type auto-send with a confidence threshold (vendor claim, *asserted*) | Below-threshold messages | Threshold | None | vendor page, not opened this session |
| Dealership lead responders (Impel, Numa, BDC.ai and others) | First reply to web leads, after-hours | Handoff to a salesperson | Vendor configured | Vendor claims only, see section 4 | search summary, *asserted* |
| OfferUp, Vinted, Depop messaging, Carvana and Opendoor instant offers, Shopify Inbox, real-estate responders | Not reached | | | | See Searched / could not reach |

Reading across the rows (*inferred*): every shipped seller-side automation that touches price is design B (a number the seller sets), and none learns. The one that tried B with an automatic counter (Mercari Smart Offers) was withdrawn. The products that keep text for the person are the ones that touch money, address, availability and "decisions on the host's behalf", which matches `NEVER_ALONE` in `spec/lifecycle.mjs` (address, pickupTime, payment). Hospitable's never-auto list is the closest outside confirmation of that set; it also adds refunds and discounts (the analogue of `priceBelowFloor`).

New relative to MO: Hospitable shows a design with limits as a per-scope settings group plus a host-written escalation text the model cannot rewrite. MO L98-135 guards the final text; Hospitable guards the escalation path instead. Both are in the same spirit; only the first is in our spec.

## 2. Research on agents negotiating and being manipulated

- LLM negotiators over-concede and can be exploited (ICLR 2026 paper abstract, *asserted* from search summary; I did not open the PDF).
- Magentic Marketplace (Microsoft Research, MSR-TR-2025-50, Oct 2025, *observed* on the Microsoft page fetched 2026-11-14): agents strongly favor the first offer received (the page says roughly 80 to 100 percent of agents accepted the first proposal, and the abstract gives a 10 to 30 times speed advantage over higher quality offers). Fake reviews, fake awards and prompt injection were tested. Some frontier models resisted everything, others were fully compromised: "All payments were redirected to the attackers." Press accounts disagree on which model fared how, so a per-model ranking is *asserted* only. Note this is a buyer-agent study; the seller side is *inferred* to carry the mirror risk (a buyer message that tells the seller agent to accept, or to reveal the floor).
- Prompt injection through buyer messages: the Magentic result is the only primary source I opened. A dedicated primary source on injection into messaging agents was not found.
- Automation bias, approval fatigue, trust: already covered at PSY section 4 (L115-142), section 5 (L144-162) and section 6 (L164-206): Bansal 2021, Buçinca 2021, Dietvorst 2018, Lee and See, Parasuraman and Manzey, defaults as endorsement. Not repeated.
- Autonomy sliders and observed approval behavior: Anthropic, "Measuring AI agent autonomy in practice", 18 Feb 2026 (search summary, *asserted*; page not opened, URL https://www.anthropic.com/research/measuring-agent-autonomy). Per that summary: users with under 50 sessions used full auto-approve in about 20 percent of sessions, over 40 percent by 750 sessions, a gradual rise; experienced users also interrupt more often; the product default is manual approval so part of the rise is users changing settings. Relevance (*inferred*): trust moves gradually and the user chooses the setting, which supports a user-set limit (B) as much as learned promotion (A); it also says an experienced user who has granted more still wants to stop things, so any design needs a one-tap stop. The secondary figures of 73 percent human-in-the-loop and 0.8 percent irreversible are unconfirmed and not used.
- Buyer reaction when told a bot answered: Luo et al. 2019 (*asserted*, from the earlier search; not re-opened): disclosing a chatbot in phone sales cut purchases by about 80 percent, and the effect shrank when disclosure came late in the call. No marketplace study found.

## 3. Response time and conversion

- No marketplace study (eBay, Facebook, Mercari, Poshmark) of reply latency against sale rate was found (not-found).
- Only general lead handling material: dealership vendor material (Pied Piper mystery shop median of 47 minutes during business hours; Demand Local Q1 2024 average of 42 hours; Impel/Cresta "90 percent more top-tier responses within 10 minutes"; Calldrip "33 percent of after-hours leads booked"; "78 percent buy from the first dealer to respond"). All *asserted*, vendor-run, no control group, and the 78 percent origin is unverified. A reported figure that leads handed from AI to a person score 9 points lower is also *asserted*.
- Use (*inferred*): the evidence supports "speed probably matters" but gives no number to size an auto-reply benefit against a draft-and-tap delay. A holdout test in the product is the only way to get one (see section 7).

## 4. Disclosure rules for automated replies

- EU AI Act Article 50(1): duty to tell people they are talking to an AI system applies from 2 Aug 2026; the Digital Omnibus (Regulation (EU) 2026/1744) delayed high-risk duties to Dec 2027 and Aug 2028 but, per several law-firm summaries, not 50(1). The machine-readable marking duty in 50(2) was reportedly moved to 2 Dec 2026 for systems already on the market. *Asserted*: from search summaries (Jones Walker, Cooley, others); EUR-Lex not opened. There is also a "obvious from the circumstances" exception whose reach for a seller's reply sent in a person's name is not settled by anything I read.
- California SB 1001 (BOT Act): not reached (search returned nothing). From memory (*asserted*): it bars using a bot to mislead a person about its artificial identity to incite a purchase or sale in a commercial transaction, unless disclosed.
- Marketplace terms: Meta's announcement states no disclosure (*observed*). Hospitable's article states none (*observed*). eBay, Mercari, Poshmark, Depop terms on automated messaging were not reached (not-found).
- Consequence (*inferred*): the seller's sending channel is the platform's, in the seller's name. Whether a buyer must be told is a legal question for the operators; I have not decided it.

## 5. Comparison of A and B (all *inferred*)

Assumptions: 10 live items, a modest 3 buyer threads per item per week (30 threads), about 6 messages each. Numbers are my arithmetic, not measurements.

| Question | A: tiers that learn | B: handled by default inside limits | 
|---|---|---|
| Taps per week | Start: most of the 30 threads ask on first contact, since nothing is promoted yet. Promotion needs 3 clean approvals in 2 conversations (MO L141-162), so a recurring intent (availability, "still available?", ship method) costs about 3 taps then drops to 0 plus the 1 in 20 spot check. Steady state perhaps 5 to 15 taps a week, with a heavy first two weeks (about 30 to 60). | Set up once: 10 items x (floor, ship or pickup, pickup hours) is up to 30 fields, fewer if defaults are copied from item to item. Steady state taps are only the out-of-limits pings. If 1 in 5 threads falls outside, about 6 pings a week. Heavy first day, light after. |
| Worst-case harm | A promoted action fires where the earlier approvals did not cover the case (a "yes still available" auto-sent after the item sold elsewhere). Contained by the limit and the 14-day expiry on a rule, and by `NEVER_PROMOTED` keeping payment, address, pickup time and below-floor price out. | A limit set too loose, or forgotten, applies to every buyer for as long as it stands: a floor typed wrong sells the item cheap, pickup hours wrong send a stranger to the door. Nothing asks again, so one wrong number repeats. |
| Under a manipulative buyer | Each new kind of message is asked first, so the first pressure move reaches the person. After promotion, the rule matches on intent, so a buyer who words a request to look like the promoted intent gets through; the guard on final text (MO L98-135) is the defence. | The limits are the defence and they are numeric, so a message cannot move the floor unless the model can edit it. Pressure inside limits (urgency, a story, a fake "I'm a friend of the seller") is handled with no person in the loop. A message that tells the agent to ignore the limits is the injection case; the Magentic result suggests some models are fully compromised, so the limit has to be enforced outside the model. |
| How each explains itself | Natural: "I asked you 3 times, you said yes each time, so I now send it". The explanation is a history the user can check, and an undo demotes the rule (MO L141-162). | Natural: "this was inside your floor of $40 and your pickup hours". The explanation is the user's own number. It cannot say why a limit was right. Silence is the default, so the user sees only the digest. |
| One design? | Yes. Limits set up front can be the starting defaults of the tiers: a price at or above the floor starts at Auto for the counter and accept, below the floor stays `NEVER_PROMOTED`; pickup hours bound `pickupTime` proposals but the final time stays `NEVER_ALONE`. A tier then moves only inside the limits, and learned promotion fills in what the limits do not name. | Same. B alone leaves out `NEVER_ALONE` unless limits are required for address, pickup time and payment, which they cannot express as numbers. |

Fit with WT9 (L135-157): WT9 picked option B in its own labels ("tiers that learn"), which is this note's A. The native rules on the platforms (eBay auto-accept, Poshmark Smart Sell, Depop auto-negotiate) are this note's B and exist whatever we choose; MO L16 and L33-43 already decide to mirror them with our default. This note adds: that mirroring is what makes the merged design real, and Mercari's withdrawal of Smart Offers is the one shipped case of the B counter being pulled (reason unknown).

## 6. Where this confirms, extends or contradicts the existing notes

- Confirms MO L73-92: Hospitable's never-auto list (payment, address before booking, date changes, refunds, discounts, actions on the host's behalf) matches `NEVER_ALONE` and `priceBelowFloor`.
- Confirms MO L205-206 (Muse): the Allow Always failure is the case for the 14-day expiry on a rule.
- Extends MO L141-162: the Anthropic summary says trust rises gradually and users change the setting themselves, so a rule promoted only by approval counts ignores a user who simply wants it on from the start. The merge in section 5 lets them say so with a limit.
- Extends MO L98-135: Hospitable's host-written escalation text that the model cannot rewrite is a second guard shape for the escalation message.
- Possible tension with PSY section 5 (L144-162, defaults as endorsement): limits that are pre-filled become endorsed numbers. A pre-filled floor should show where it came from (the price note) rather than look like the user's choice.
- Nothing found contradicts the existing notes.

## 7. What result on real conversations would show each wrong (*inferred*)

- A is wrong if: the share of approvals that go through with no edit and under 2 seconds stays high for months (the user is clicking through, not reading) while the spot check at 1 in 20 finds errors; or fewer than a third of recurring intents reach promotion within 4 weeks, so the taps never fall.
- B is wrong if: out-of-limits pings are rare but a review of the auto-handled threads finds more than a few percent where the seller, shown the thread, would have wanted a say; or limits are left at the pre-filled value on most items (never edited) and later undone at a high rate.
- Either is wrong on speed if a holdout (some threads auto, some asked) shows no difference in reply time to sale; then the cost of asking is not sized and the choice rests on harm alone.
- Either is wrong on manipulation if a set of planted buyer messages (ignore the floor, "the seller said yes", a fake friend) gets any through to a send, since the guard and limits must hold outside the model.

## Not found

- Outcome data (accept rate, sale rate, complaints) for any marketplace seller automation: eBay Best Offer auto rules, Poshmark Smart Sell, Depop auto-negotiate, Meta auto-reply.
- Why Mercari discontinued Smart Offers.
- Any marketplace study of reply latency against sales.
- Any study of buyer reaction to a bot reply in a used-goods marketplace.
- Primary source on prompt injection into a seller messaging agent.
- Disclosure rules in the eBay, Mercari, Poshmark, Depop and Facebook Marketplace terms for automated replies.

## Sources fetched

- https://help.hospitable.com/en/articles/10977601-ai-auto-replies-for-guest-messages (fetched 2026-11-14, undated)
- https://www.microsoft.com/en-us/research/publication/mage/ (page for Magentic Marketplace, MSR-TR-2025-50, Oct 2025; the page was a summary and may be the MAGE entry, so the quotes are from the fetched summary)
- Existing repo notes: MO, PSY, WT9, `spec/lifecycle.mjs`, `seat-rules.md`.
- Fetched earlier in this task and not re-opened this session: Meta Marketplace auto-reply announcement (12 Mar 2026), eBay AI Assistant, Poshmark Smart Sell, Mercari Smart Offers notice, Airbnb quick replies, VAR January 2026. Their URLs are in the transcript at C:\Users\Nate2\.claude\projects\C--dev-secondhand\d22fafc5-1d4e-41fe-97ff-78137943fe5a\subagents\agent-a7f497aa514af005a.jsonl. The product rows that cite them have no URL in this file: the check "rows carry URL" is therefore only partly met (Hospitable has one; the rest do not).
- Search summaries only (asserted): Anthropic autonomy post (https://www.anthropic.com/research/measuring-agent-autonomy), EU AI Act Article 50 summaries (Jones Walker, Cooley), dealership lead response vendors.

## Searched / could not reach

- California SB 1001 text: search returned only EU results; not opened.
- OfferUp, Vinted, Depop messaging automation, Carvana and Opendoor instant offers, Shopify Inbox, real-estate lead responders: not searched or nothing usable.
- EUR-Lex text of Article 50 and Regulation (EU) 2026/1744: not opened.
- ICLR 2026 negotiation paper PDF, Luo 2019 paper: not opened this session.
- A narrow search does not prove any of these do not exist.
