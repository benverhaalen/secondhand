# Where do buyer messages live, now that Today has no "All messages" switch?
Researched 2026-11-14 by Ben (Claude Code, thread "Review the repo with poteto mode"). Feature: messages.

Ben, 20:45: "for the second thing, you need to figure this out", meaning where all messages live, after his 20:17 call that the Needs you / All messages switch "is an unneeded ui flow". The decided bar is Today · Sell · ＋ · Buy · You and has no Inbox, yet `functions.md` #13 ("one inbox across sites") is a function he named. This note follows the [UI constitution](../../../product/ui-constitution.md) Article 2.1 method: what they'd say, what they want, found by a seeded loop.

## Says versus wants

- **They'd say:** "I want an inbox." *Inferred* from every resale app having one.
- **They want:** no offer expires unseen and no buyer goes cold, across five sites, without checking five places. Evidence:
  - eBay sellers report offers that never reached Messages: one "lost 30 sales offers he was not aware of", another "every time I come back I have expired offers" [observed, eBay community thread on offers missing from Messages; forum posts, undated].
  - Reseller pain with many marketplaces is "five separate inboxes", where "offers go cold, and buyers move to whoever answered first" [asserted, JivoChat vendor blog, promotional].
  - Vinted mixes notifications and every offer into the Inbox, and a critic calls it "very cluttered", suggesting an offers tab or Mercari's Offer tag [observed, Pratt IxD critique, 2026-09-09].
- **And they still need a place to go on purpose.** Moving messages somewhere less obvious produces complaints every time:
  - Airbnb hosts: a new Host Home "seems to have displaced the inbox" ("Would it be possible to just have a standard inbox on the app?") [observed, Airbnb community post, undated]. Airbnb now keeps a Messages tab that "puts all your hosting, traveling, and support messages in one place" [observed, Airbnb resources, 2025-12-05], and its host bar since 2021 is Today / Inbox / Calendar / Insights / Menu [observed, Rental Scale-Up, 2021-10-06].
  - eBay moved Messages from My eBay to "a small envelope icon at the top of the screen", and users said there was "no access to messages anywhere" until a moderator pointed them to "the header section near the cart" [observed, eBay community thread].
  - **Counterlead.** Instagram did the opposite in 2025. It moved DMs from the top-right icon into the bottom bar, because "nearly all recent Instagram growth has come from DMs" [observed, Inro blog quoting Mosseri, updated 2026-01-06]. Users then complained that the DM button had moved and the swipe went to Reels instead [observed, PiunikaWeb, 2025-12-17]. Taken together: messaging gets a tab when it is the main job, and moving it away from where people's hands already go always costs something.

## What this means for secondhand

*Inferred* from the evidence above and Ben's decisions:
1. **Today is where nothing gets lost.** Ben already decided that offers are Decisions, not chat, and that Today is ordered by deadline. The want, "no offer expires unseen", is met by a rule, not by a place: any buyer message that needs you becomes a Today card. That card names its deadline and opens the conversation in one tap. The tiers answer availability questions on their own. So the inbox is not where the urgent work happens.
2. **The inbox is still a destination,** for checking what a buyer said, finding a conversation, and history. The Airbnb and eBay evidence says it has to sit where people already look and show an unread count.
3. **Messaging is not secondhand's main job.** Selling is, which Ben decided at 19:02. Most buyer traffic is either answered by the tiers or turned into a Today card. So Instagram's reason for giving DMs a tab does not apply here. Giving it a tab would also cost a decided slot.

## Options

| Option | How it works | Familiar from | For | Against |
|---|---|---|---|---|
| **A. Chat icon in the top bar** | A chat icon at the top right of every main screen, beside the centered wordmark, with an unread count. It opens one list of conversations across sites, newest first. Each row shows the item photo, the buyer, the platform logo and the last line. Every Today card and every item also opens its own conversation | eBay app header, Facebook Marketplace, Instagram before 2025 | Keeps the decided bar. Always one tap from anywhere. The count makes it findable, which eBay's bare envelope lacked | A top icon is less visible than a tab. The unread count has to carry that |
| B. Messages replaces You | Today · Sell · ＋ · Buy · Messages, and You moves behind an avatar at the top left | Airbnb host bar, Instagram 2025 | Messages are as visible as possible | Changes a decided bar. Money, accounts and automation get hidden, the same weakness walkthrough §3 found |
| C. No global inbox | Conversations exist only inside each item and on Today cards | Depop-style per-listing chat | Nothing new to add | "Who's asking what" across items has no answer. This repeats eBay's mistake of splitting offers from messages |
| D. A Messages shelf at the bottom of Today | The last section of Today lists recent conversations | Monarch review queue plus feed | No new control | Brings back the mixed flow Ben removed at 20:17 |

**Recommend A.** It meets the want through the Today rule, and it keeps a deliberate, always-visible door with a count. That matches Ben's 19:15 words that all messages is somewhere "id need to specifically select going there". The strongest rival is B. It becomes the right answer if testing shows people use the inbox several times a day even with the tiers and Today in place. That measurement can be made in the demo build.

## Limits

- I did not open Depop's, Mercari's or Poshmark's current tab bars as screens. Their inbox placement is *asserted* from memory and the critique. Vinted's help page failed to load.
- The forum and community posts are complaints, not counts. They show that a failure happens, not how often.
- Whether the tiers really absorb most buyer messages is an assumption until the demo build logs it (`spec/README.md` logging).
