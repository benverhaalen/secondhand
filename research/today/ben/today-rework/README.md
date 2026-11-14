# What should Today show, from the seller's side?
Researched 2026-11-14 by Ben (Claude Code agent, concept thread). Feature: today.

Ben, 20:17, on the previous Today:
- "a lot of the text on the ui is super 'claudy' in the way where it is impossible for a human to really know whats actually going on. like the Sold 36-52 n=41 etc."
- "there are only two decisions there like think of what if a user wanted to do something else"
- "for a carhartt jacket, you should probably have a picture of it"
- "i think the secondhand wordmark should be right at the top, centered"
- "the 3 need you, 11 handled thing atually makes zero sense"
- "needs you and all messages is an unneeded ui flow"

This is the first worked example of the [UI constitution](../../../../product/ui-constitution.md). The canvas board is `Today.dc.html` ("Today, reworked") in the [design canvas](https://claude.ai/artifact/X7UbT6gqeiAMGPDyDiL6fg). Everything here is an *agent proposal*.

## Decision path (constitution steps 1 to 5)

1. **End.** Nothing the seller cares about gets lost (a sale, an offer, a deadline, a buyer), and each thing takes one tap to clear.
2. **Already decided.** Today is the first tab. Approvals follow Auto / Ask / Never alone. Pickups use windows. Copy is show-don't-say. Platforms are logos. Ben's 20:17 corrections overrule the segment control and the counter, which were in the earlier decided wireframe.
3. **Four lines.**
   - **User:** someone selling a handful to a few dozen of their own things on two to five sites.
   - **How often:** several times a day, usually from a notification.
   - **Main task:** clear what's waiting.
   - **Costliest mistake:** missing a shipping deadline or a return claim, or accepting the wrong offer.
   - **Wants, not says:** "tell me I'm not losing anything, and let me deal with it right here."
4. **Intents on this screen.** Answer an offer (accept, counter, decline, message, offer to the people who liked it), ship a sale, answer a question, approve a draft, act on a want match, see what the app did for me, add something new (the ＋ button), and go deeper on any item. The full list is in [missing-features.md](../../../cross-cutting/ben/missing-features.md) (M1 to M7).
5. **References.**
   - Instagram home: the wordmark top-center and no page title. Users know which tab they are on from the tab bar.
   - eBay Seller Hub tasks: shipping and offers ordered by urgency.
   - Gmail: an action row on each message, with More for the rest.
   - iOS notifications: the photo leads, then one line of what happened.
   - Common answer, rejected: a counter header plus tabs.

## Content model

One list, ordered by deadline (soonest first). There are no sections, counts or tabs. Each card has:

| Slot | Content | Example |
|---|---|---|
| Photo | The seller's own photo of the item | The jacket on a hanger |
| Item | The item name the seller recognises | Carhartt Detroit jacket |
| What happened | One plain sentence, the headline | Jamie offered $38 |
| Context | The one fact needed to decide, in plain words | You asked $45. Similar jackets sold for $36 to $52 lately. |
| Where and when | Platform logo, plus the deadline or time | Depop logo · Offer ends tomorrow, 6 pm |
| Primary action | The likeliest action, filled | Accept $38 |
| Secondary action | The next likeliest, outlined | Counter |
| More (···) | Every other reasonable action, named | Decline, Message Jamie, Offer $40 to the 9 people who liked it, View listing |

Card types, ordered by deadline:
- return or claim (M3)
- ship by (M1)
- offer (M2)
- buyer question
- pickup today
- cancellation or no-show (M4)
- draft ready
- want match
- suggestions, such as offering to likers or lowering a price (M5, M6)

Payouts and sales appear as one quiet line, not cards. Under the list there is one specific, quiet line about what the app did on its own ("Answered 'Is it still available?' for 4 buyers today. See replies"), because the HITL decision requires every automatic action to be visible and undoable.

When nothing is waiting, the list is replaced by the one most useful next step (for example "Add something to sell"). It is not a cheer.

## Reason table (constitution Article 1)

| Element | User need | Without it | Source |
|---|---|---|---|
| Wordmark, top center | Know which app this is; brand presence | The top reads as a generic list | Ben 20:17 |
| No page title "Today" | The tab bar already says where you are | A duplicate label | Instagram pattern; agent |
| No counter ("3 need you, 11 handled") | Nothing: the cards are the count | A number that means nothing on its own | Ben 20:17 |
| No Needs you / All messages switch | All messages lives one tap away inside any card (Message, Open chat) and in the Inbox | A second mode to learn | Ben 20:17 |
| Photo on every card | Recognise the item before reading | Reading titles to work out which jacket | Ben 20:17; iOS notifications |
| Item name | Confirm which item, and tell similar ones apart | Two jerseys look alike | agent |
| Headline in plain words | Know what happened | Inside-knowledge text such as "n=41" | Ben 20:17; constitution Art. 5 |
| One context line | The single fact the decision needs (what you asked, what similar items sold for, what you keep) | Accepting blind, or opening the item | agent; psychology §2 (anchoring on relevant numbers) |
| Platform logo | Where it's happening | Writing the site name | Ben 19:59 |
| Deadline | Nothing gets lost; what happens if ignored | Missed offers and late shipping | M1, M2; constitution Art. 6 |
| Primary button with the amount ("Accept $38") | One tap for the likeliest action, saying exactly what will happen | An "Accept" that hides the price | Vercel guidelines; copy C6 |
| Secondary button | The second most common action is visible | Hunting in a menu for Counter | eBay offer pattern |
| More (···) naming everything else | Whatever else the user might want | Only two choices (Ben 20:17) | constitution Art. 6 |
| Quiet "answered for you" line | Trust: see what the app did, and undo it | Hidden automation | Decided HITL tiers |
| Order by deadline | The most urgent thing comes first | Urgent items buried | eBay Seller Hub; agent |

## Open

- Real photos come from Codex image gen on Ben's Mac (`photos/`). Until they land, the board shows grey frames.
- Typography, color and the wordmark's look belong to the brand thread. This board stays plain so it doesn't pre-empt them.
- Check against the help pages before building: eBay offer expiry, handling time and return windows (missing-features.md Limits).
