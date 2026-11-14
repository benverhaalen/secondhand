# How do existing apps split a decisions home, an inbox, selling and buying across their tabs?
Researched 2026-11-14 by Ben (Claude Code agent, concept thread). Feature: today.

Asked by Ben at 19:15: sell and buy are the core, appraise sits inside both, Today and the inbox are "relatively integrated" but "all messages" is a place you go on purpose, and watching for items is key ([words](../../../product/words.md#2026-11-14-pitch-and-structure)).

| Reference | What it does | Job for us | Mark | Source |
|---|---|---|---|---|
| **Airbnb host mode** | Bottom bar: "Today / Inbox / Calendar / Insights / Menu". Today lists, in order of urgency: time-sensitive alerts (requests, actions needed), current and upcoming bookings, "Next steps for you", then tips. Listings moved under Menu, and earnings moved to Insights. | **Interaction, the closest match.** A two-sided marketplace keeps Today (decisions) and Inbox (all messages) as separate tabs, gives Calendar its own home, and puts stats in Insights. This maps one-to-one onto our Decision, Conversation, Event and Ledger primitives. | observed (Oct 2021 article; the current app may differ) | rentalscaleup.com, "What Airbnb's new Today host tab…", 6 Oct 2021 |
| **Depop selling home** | Tapping the Selling ("shop") icon in the bottom bar opens one place to "list items to sell, edit listings, set up discounts and keep track of sold items", plus likes per item and "how many sold items you need to ship at a glance". | **Interaction.** Selling is one tab that holds drafts, live, sold and to-ship. Interest per item is shown as a count. | observed (post undated) | blog.depop.com/articles/a-new-home-for-selling-on-depop |
| **Vinted (critique, Sep 2026)** | Tabs are labelled in text. "View my listings" is hidden in Profile in light text. Every offer becomes its own message block, and the author says "80% of the time potential buyers never respond". Suggested fixes: group offers into their own tab or tag them "Offer" (as Mercari does), and split Profile into Seller and Buyer. | **Anti-pattern evidence.** Never hide listings in Profile. Offers are not messages; they are Decisions. | observed (one designer's critique, not user data) | ixd.prattsi.org, 9 Sep 2026 |
| **Superhuman Split Inbox** | Default splits are "Important" (person-to-person) and "Other" (automated). You Tab between splits, can move a sender into another split, and each split shows its total count. The recommendation is "between 3 and 7" splits. | **Mechanism.** "Needs you" and "All messages" can be splits of one inbox, with automated replies kept out of the important split. Keep the number of splits small. | observed (undated help page) | help.superhuman.com, Split Inbox Basics |
| **Monarch review inbox, Pixel Call Screen** | Only exceptions reach you; routine items are handled and logged. | Supports "Today = open Decisions" | asserted | [adjacent-references](../../cross-cutting/ben/adjacent-references.md) |
| **Google Flights tracking, eBay saved searches** | Tracking a price or a search pings you when it changes. | Watching is a saved query plus an alert | asserted | [direct-references](../../cross-cutting/ben/direct-references.md) |

## What it means for the structure (inferred)

1. Airbnb is evidence that **a decisions home and a full inbox can sit side by side as separate tabs** without confusing people. That matches Ben's "need to specifically select going there".
2. **Offers belong in Today, not in messages.** Vinted's clutter comes from treating offers as chat.
3. **Selling needs a tab of its own** that holds drafts, live, sold and to-ship (Depop). Never bury listings in a profile (Vinted).
4. **Pickups and ship-by dates are a calendar**, as on Airbnb, whether as a tab or inside Today.
5. Five slots cannot fit Today, Sell, Buy, Inbox, Calendar, You and the camera, so something has to merge. That is the real decision.
