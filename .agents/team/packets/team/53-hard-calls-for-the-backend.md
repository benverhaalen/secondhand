# 53: Hard calls: what the backend needs for them

Updated: November 15, 2026. Owner: Ben. For: Nate. Agent: Claude Code, project thread "Resolve the product's ambiguous problems". Branch: `claude/project-thread-k236tu`, based on `main` at 055ad3e. Status: *agent proposal*; the open decisions are J46 to J52 in [open questions](../../../../spec/open-questions.md#for-both). Source: Ben at 06:59 ([words](../../../../product/words.md#2026-11-15-find-the-ambiguous-problems-answer-them-from-adjacent-fields-and-a-pitch-constitution)).

Where it is written: [spec/hard-calls.md](../../../../spec/hard-calls.md). Evidence: [hard-calls-references.md](../../../../research/cross-cutting/ben/hard-calls-references.md).

## What changes on your side

- **Backup offers (call 1).** An incoming offer on a site where acceptance would be a second sale, while the item is promised on Depop or by Facebook dibs, gets `offer.state = backup` with `backup_of` (the promised order). It is neither declined nor countered. When the promise is paid, backups are declined with a polite note (auto). When it lapses, the open backup with the most worth becomes an `accept_offer` card.
- **Offer worth (call 2).** Each `accept_offer` card carries `worth_cents = keep_cents × p_complete`, with `p_complete` near 1 where `accept.charges_buyer`, else from cards 5 and 6. Cards rank by worth when more than 10% apart, else by arrival.
- **Silence (call 3).** Each decision kind declares `on_silence` (`expire`, `stay`, `none`) and `escalate_at[]` as fractions of its clock (default 0.5, 0.8, plus the evening before). Nothing that commits money, an address, a time or a price may have an `on_silence` that acts.
- **Materiality (call 4).** On a fee row change: drafts re-solve; live listings re-solve only when `|Δkeep| > max(100, 0.05 × keep)` cents; any change that leaves the keep under the floor's keep raises `price_below_floor`.
- **Breaker (call 5).** `breaker {site, route, state: closed|open|half_open, opened_at, next_test_at, reason}` shared across accounts. Opens on 3 failed writes in a row within 15 minutes, or one write page fingerprint mismatch. Half-open allows one write; tests at 15, 30, 60 minutes. Reads are never blocked.
- **Forward fix (call 6).** Retries at 1, 5, 15, 60 minutes with the same `operation_id`, then a card. No compensating undo except the unsafe states already in `lifecycle.mjs`.
- **Shelf life (call 12).** Each read fact carries `read_at`; a watch match is re-read if older than 10 minutes before `watch_match` pushes.
- **Trust size and drift (call 13).** `rule.max_cents = 1.5 × max(amount of the approvals that earned it)`; above it the kind asks. Per category, `ae = sale_price / range_mid` over the last 30 sales or 90 days with its interval; outside 0.85 to 1.15 with the interval excluding 1, that category's auto rules pause with `reason = drift`.

## Next action

Nate: say which of these you'd rather change before J46 to J52 are decided. None of them blocks the demo path.
