# Buyer messages

Status: idea. Owner: unassigned. Packet topic: `messages`.

Spec (agent proposal): [spec/features/messages.md](../../spec/features/messages.md).

## What and why
Answer buyers, handle offers and schedule meetups, with the user approving anything that commits them.

## How it works
Not designed yet. Keep the mechanism here once research picks one, together with the reference it came from and the job that reference does.

## Decided
- All messages live behind a chat icon with an unread count, top right of every main screen; messages that need you become Today cards ([decision](../../product/decisions.md#2026-11-14-all-messages-live-behind-a-chat-icon-with-a-count)).
- Message intent runs on both the Decisions API and Jev, and our labels pick which stays. Ben, 21:45 ([decision](../../product/decisions.md#2026-11-14-typed-judgements-run-on-both-the-decisions-api-and-jev-and-our-labels-pick)).

## Open
- Which messages can be sent without the user's approval?

## Research
All research for this feature: [research/messages/](../../research/messages/)
- Ben: [research/messages/ben/](../../research/messages/ben/)
- Ben, messages and offers: [messages-and-offers.md](../../research/messages/ben/messages-and-offers.md). eBay Message API and Best Offer calls, Depop Partner API, intent questions on the Decisions API, a send guard that needs a signed tap, and how approvals promote and demote Rules.
- Nate: [research/messages/nate/](../../research/messages/nate/)
- Nate: [handled-by-default.md](../../research/messages/nate/handled-by-default.md). Evidence on how much buyer messaging and negotiation an agent should handle itself: shipped products, limits set up front, and failures.
- Decided from this note: all messages live behind a chat icon with an unread count at the top right of every main screen. Every buyer message that needs you also becomes a Today card with its deadline, so nothing is lost even if the inbox goes unchecked. [messages-home.md](../../research/messages/ben/messages-home.md)
- Ben, harness from repos: [ai-harness-from-repos.md](../../research/cross-cutting/ben/ai-harness-from-repos.md#6-messages-and-offers). *Agent proposal:* the floor never enters a prompt, code computes the counter-offer, and buyer scripts are tested by whether the state changed (AgenticPay, tau2-bench, Chatwoot).
