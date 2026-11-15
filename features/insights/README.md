# Insights

Status: designing. Owner: unassigned. Packet topic: `insights`.

Spec (agent proposal): [spec/features/insights.md](../../spec/features/insights.md).

## What and why
The You tab: what was earned and what could be, by site, a monthly goal, and the analytics a person selling their own things needs (the listing funnel, slow movers, profit by category, a tax-time export). Nate: [words](../../product/words.md#2026-11-14-nate-a-suite-like-shopify-and-the-better-official-option).

## How it works
In the spec. Every method, weight and hide rule is a card in [spec/determinations/](../../spec/determinations/).

## Decided
- Nothing specific to this feature yet. Joint decisions that touch it are in [decisions.md](../../product/decisions.md).

## Open
- See the spec's "Open for Ben and Nate" section and [spec/open-questions.md](../../spec/open-questions.md).

## Research
Research for this feature is filed under [research/data/](../../research/data/) (no folder of its own yet).
- Ben: [levers-and-signals.md §4 and §5](../../research/list/ben/levers-and-signals.md#4-seller-signals-what-each-site-gives-and-how-to-read-it). What each site reports to sellers and how to read it (Mercari "views" are impressions; Facebook and Depop do report stats), and *agent proposal:* compare signals within a site against listings like it, convert across sites by each site's signals per sale, show the furthest stage reached on a tile. Code in [levers/interest.mjs](../../research/list/ben/levers/interest.mjs).
