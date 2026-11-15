# 55: Posting: failures, fee changes and condition grades

Updated: November 15, 2026. Owner: Ben. For: Nate. Agent: Claude Code, project thread "Resolve the product's ambiguous problems". Branch: `claude/project-thread-k236tu` (draft PR #10), to land on `main`. Status: *agent proposal*; nothing here is decided until Ben or Nate answers the open questions named below. Index: [team/54](../team/54-hard-calls-index.md).

## A site failing for everyone (call 5, open J48)

[Spec](../../../../spec/hard-calls.md#5-a-site-starts-failing-for-everyone). A breaker per `{site, route}`, shared across accounts: `breaker {site, route, state: closed|open|half_open, opened_at, next_test_at, reason}`.
- Opens on 3 failed writes in a row within 15 minutes across accounts, or one write page whose fingerprint does not match its fixture.
- Open: writes on that route fail at once with `reason = breaker_open`; reads are never blocked, so sales are still seen. The app shows "Posting to Mercari is paused" with Post it myself.
- Half-open after 15 minutes: one write goes through. Success closes; failure reopens and doubles the wait (15, 30, 60).
- The system can open a breaker on its own; it closes only on a successful test write.
- Unchanged: `site_warning` stops automation on that one account; an `outcome_unknown` write is never replayed.

## A half-done post or change (call 6)

[Spec](../../../../spec/hard-calls.md#6-it-posted-on-three-sites-out-of-four-or-a-change-half-applied). Fix forward. Retries at 1, 5, 15 and 60 minutes with the same `operation_id`, then a card. No compensating undo except the unsafe states already in `lifecycle.mjs` (a listing up after a sale). The item card stays the desired state; reconcile compares each site to it.

## Fee changes on live listings (call 4, open J47)

[Spec](../../../../spec/hard-calls.md#4-a-site-changes-its-fees-while-things-are-listed). On a new fee row:
- Drafts re-solve at once.
- A live listing re-solves only when `|Δkeep_cents| > max(100, 0.05 × keep_cents)`.
- Any change that leaves the keep under the floor's keep raises `price_below_floor`, whatever its size.
- A new required field or rule pauses that step on that site only, with a card naming what's needed.

## Condition grade per site (call 8, open J49)

[Spec](../../../../spec/hard-calls.md#8-the-condition-is-between-two-grades-and-every-site-grades-differently). When the measured condition falls between two grades on a site's scale, the mapping picks the lower grade and adds the reason to the description ("Light pilling at the cuffs, so Good, not Excellent"). Needs: the condition mapping returns `{grade, between: bool, reason}` per site.
