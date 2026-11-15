# 56: Offers, backups, disputes and reading before acting

Updated: November 15, 2026. Owner: Ben. For: Nate. Agent: Claude Code, project thread "Resolve the product's ambiguous problems". Branch: `claude/project-thread-k236tu` (draft PR #10), to land on `main`. Status: *agent proposal*; nothing here is decided until Ben or Nate answers the open questions named below. Index: [team/54](../team/54-hard-calls-index.md).

## A better offer while the first buyer hasn't paid (call 1, open J51)

[Spec](../../../../spec/hard-calls.md#1-a-better-offer-arrives-while-the-first-buyer-hasnt-paid). Applies where `accept.charges_buyer` is false (Depop, 24 h to pay) and to Facebook dibs.
- An incoming offer on any site while the item is promised: `offer.state = backup`, `backup_of = <promised order>`. Neither declined nor countered; `sellerOffer()` already refuses a binding offer while promised.
- The promise is paid: backups are declined with a polite note (auto).
- The promise lapses unpaid: the open backup with the highest worth becomes an `accept_offer` card. A backup that expires first is gone.
- Cancelling the first buyer is the person's tap only, from a card that shows the cost. Not known: whether Depop counts a seller cancel on an accepted, unpaid offer. Please add it to `sites.mjs` when observed.

## Which offer is worth more (call 2)

[Spec](../../../../spec/hard-calls.md#2-two-offers-wait-at-once-which-is-worth-more). Each `accept_offer` card carries `worth_cents = keep_cents × p_complete`. `p_complete` is about 1 where `accept.charges_buyer`; otherwise it comes from the no-show and scam cards (5, 6). Cards rank by worth when they are more than 10% apart, otherwise by arrival. An offer at or above Always accept is accepted as it arrives and never waits for this ranking.

## Refund or contest (call 9, open J50)

[Spec](../../../../spec/hard-calls.md#9-a-buyer-says-it-isnt-as-described-refund-or-contest-it). The case card gets `recommend: contest | take_return | partial` with a reason. Inputs: whether the named flaw is in a capture frame's flaw region and in the listing text (contest); whether the capture covers that area at all (no coverage gives take_return); keep under $20 (take_return or partial). On eBay, the account read adds `cases_closed_without_resolution` and the period's allowance (2, or 0.3% of transactions) so the card can say "1 of 2 cases this period". Refunds stay locked to the person.

## Read before acting (call 12)

[Spec](../../../../spec/hard-calls.md#12-the-numbers-might-be-out-of-date). Each read fact carries `read_at`. Before `watch_match` pushes, the listing is re-read if its read is older than 10 minutes, since a match under the person's price now pushes at once. The sold rule is unchanged: only an order read moves an item to sold.
