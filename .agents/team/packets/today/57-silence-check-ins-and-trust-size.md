# 57: Decision kinds: silence, the market check-in, and how far trust goes

Updated: November 15, 2026. Owner: Ben. For: Nate. Agent: Claude Code, project thread "Resolve the product's ambiguous problems". Branch: `claude/project-thread-k236tu` (draft PR #10), to land on `main`. Status: *agent proposal*; nothing here is decided until Ben or Nate answers the open questions named below. Index: [team/54](../team/54-hard-calls-index.md).

## What happens when the person doesn't answer (call 3, open J46)

[Spec](../../../../spec/hard-calls.md#3-the-person-goes-quiet). Each decision kind declares:
- `on_silence`: `expire` (offers, on the site's clock), `stay` (markdowns, relists: the price stays), or `none` (drafts unsent, meetup times unconfirmed, refunds untouched).
- `escalate_at[]`: fractions of the kind's clock when the notification steps up (default 0.5, 0.8, plus the evening before). 12 hours for an unsent reply.
- A check: no kind that commits money, an address, a time or a price may have an `on_silence` that acts.
- After 3 days with cards waiting, one message offers Pause selling.
A rule the person set ahead (Always accept $X) is a yes given in advance and still runs.

## The market check-in (call 10)

[Spec](../../../../spec/hard-calls.md#10-the-person-wants-a-price-the-market-wont-pay). When the asking price is above the top of the sold range, the item gets `review_at` = the plan's median days to sell (at least 7 days). On that date one card shows views, saves and offers against similar listings of the same age, with keep the price, take the plan's price, or keep the item. No other warnings before it.

## How far earned trust goes, and when it's lost (call 13, open J52)

[Spec](../../../../spec/hard-calls.md#13-trust-earned-on-small-things-and-trust-lost).
- `rule.max_cents = 1.5 × max(amount among the approvals that earned the rule)`. Above it, the kind asks again. The $500 ceiling stays.
- Per category: `ae = sale_price / range_mid` over the last 30 sales or 90 days, with its interval. Outside 0.85 to 1.15, with the interval excluding 1, that category's auto rules pause with `reason = drift` and its ranges widen, until `ae` returns.
