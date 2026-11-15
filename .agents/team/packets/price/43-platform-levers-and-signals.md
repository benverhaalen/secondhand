# 43 — Each site's pricing levers and seller signals, defaults from the two lines, and relative signals

Updated: November 15, 2026, 01:45 UTC. Owner: Ben. Agent: Claude Code, project thread "Map each platform's pricing levers and analytics". Branch: `main`. Status: research and two small scripts pushed; everything is an *agent proposal* unless it links a decision.

Ben's ask, 00:12 UTC: [words](../../../../product/words.md#2026-11-15-pricing-levers-signals-and-hot-items).

## Read first

| What | Where |
|---|---|
| The note: levers per site, signals per site, why signals are relative, the design | [levers-and-signals.md](../../../../research/list/ben/levers-and-signals.md) |
| Every lever and signal row with its source and mark | [levers/levers.json](../../../../research/list/ben/levers/levers.json) |
| Native settings from floor and always accept, per site | [levers/defaults.mjs](../../../../research/list/ben/levers/defaults.mjs) (`node defaults.mjs 40 30 38`) |
| Band, signals per sale, pull | [levers/interest.mjs](../../../../research/list/ben/levers/interest.mjs) |
| Tests (20 pass) | `node --test research/list/ben/levers/*.test.mjs` |
| Pricing and offer psychology | [pricing-psychology.md](../../../../research/price/ben/pricing-psychology.md) |
| Hot items and a learned price policy, for later | [ideas/hot-items-and-learned-pricing.md](../../../../ideas/hot-items-and-learned-pricing.md) |

## Facts that change specs

| Fact | Mark | Touches |
|---|---|---|
| Depop auto-respond accepts at or above its line and counters everything below at exactly that line | observed | price.md "Floor on the site": put always accept there, never the floor |
| Poshmark Smart Sell may counter above its minimum, and is still a test | observed | same |
| eBay auto-decline sends the buyer an email and allows another offer; there is no auto-counter; auto rules stop during a sale event; sale events, markdowns and volume pricing need an eBay Store | observed | price.md, listing D20 |
| eBay first offers average 61% of list (mode 50%); midpoint counters are accepted 5 to 10 points more | observed (QJE 2020) | money D16: your new `max(floor, midpoint)` counter now has observed support |
| Twice the reply time, 4.4% fewer sales | observed (Mgmt Sci 2025) | managing card 7, the speed of asks |
| Poshmark tells likers of a drop only when it is 10% or more under the lowest-ever price and ends at $10 or more | observed | listing D20 |
| Mercari Promote: 5% or more under the lowest price so far, likers told, boosted in search, once a day | observed | listing D20, D26 |
| Mercari "views" are impressions in search and feeds, updated daily; clicks are listing opens | observed | listing D15, insights funnel |
| Facebook reports views, clicks, message threads (Seller app) and saves and shares (web Insights) | observed (app), asserted (web) | insights "Facts to know" says Facebook none |
| Depop partner API insights: likes, bag adds, pending offers, organic and boosted clicks and impressions, up to 60 min late | observed | read_stats for Depop |
| Depop buyer and seller offers last 24 h (Make Offer page, newsroom 2024-01-09, API docs) | observed | corrects platform-levers.md's 14 days |
| eBay tells watchers of a price drop; own watcher counts and received offers are readable by Trading API without App Check | observed | read_stats for eBay, listing D20 |

## Proposals for your cards

- **price.md, "Floor on the site"**: the site tools take always accept, not the floor, and eBay's auto-decline takes `min(floor, 50% of price)`. Table in the note §6.
- **listing D15**: compute the band per signal with each signal's stage from `levers.json` (exposure, attention, interest, intent), so a Mercari "view" is never compared with an eBay view.
- **listing D17**: first offer to likers at the site minimum (5% eBay and Depop, 10% Poshmark and Mercari); Depop and Mercari can send it natively to new likers.
- **listing D20**: each site's drop rule in `levers.json` (`rules.markdown`); a struck-through price only after 7 days live at the old price (16 CFR 233.1); visible drops staggered across a person's live items.
- **insights**: the You tab's By site gains "signals per sale" per site; a Sell tile shows the furthest stage reached ("2 offers" before "9 likes").

## Open

Still open after the second round: whether Facebook savers are told of a drop, Mercari like display and Smart Pricing pace, Smart Sell availability (still a test), Terapeak's sell-through formula.
