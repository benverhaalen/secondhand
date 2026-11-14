# Buyer messages

Status: idea. Owner: unassigned. Packet topic: `messages`.

## What and why
Answer buyers, handle offers and schedule meetups, with the user approving anything that commits them.

## How it works
Not designed yet. Keep the mechanism here once research picks one, together with the reference it came from and the job that reference does.

## Decided
- All messages live behind a chat icon with an unread count, top right of every main screen; messages that need you become Today cards ([decision](../../product/decisions.md#2026-11-14-all-messages-live-behind-a-chat-icon-with-a-count)).

## Open
- Which messages can be sent without the user's approval?

## Research
All research for this feature: [research/messages/](../../research/messages/)
- Ben: [research/messages/ben/](../../research/messages/ben/)
- Ben, messages and offers: [messages-and-offers.md](../../research/messages/ben/messages-and-offers.md). eBay Message API and Best Offer calls, Depop Partner API, intent questions on the Decisions API, a send guard that needs a signed tap, and how approvals promote and demote Rules.
- Nate: `research/messages/nate/` (none yet)
- Decided from this note: all messages live behind a chat icon with an unread count at the top right of every main screen. Every buyer message that needs you also becomes a Today card with its deadline, so nothing is lost even if the inbox goes unchecked. [messages-home.md](../../research/messages/ben/messages-home.md)
