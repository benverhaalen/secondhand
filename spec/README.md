# spec/

The rules the app's behavior has to keep, written as code so they can be checked rather than just read. This is an *agent proposal* built from Ben's decisions. If a decision changes, change it here as well.

## Where to start

Everything under `spec/` that is not code is an *agent proposal* for Ben and Nate until a line links a decision.

| Read | For |
|---|---|
| [product.md](product.md) | The canon: every entity, state, verb, endpoint, decision kind, job and event. Where another file differs, this one wins |
| [features/](features/) | One spec per feature (21): what the person does and sees, design choices, data flow, the frontend contract, failures, how we will know it works |
| [determinations/](determinations/) | Every thing the system works out, as cards: sources, weights, method, when it is hidden, how it is explained |
| [engines/](engines/) | One engine per file: what it decides, its signals, the calculation, how it learns, its speed, how it is proved, and the build tasks |
| [marketing-engine.md](marketing-engine.md) | How the plan for each site is chosen: signals, calculation, weights, learning, speed, proof tests |
| [data-use.md](data-use.md) | What data is kept, what learns from it, and what needs a person's consent |
| [assessment.md](assessment.md) | How ready each part is, with the confusions found in the builders' notes |
| [benchmark.md](benchmark.md) | The open benchmark: ten measures run on one fixed item set against named tools, with every raw answer published |
| [parity.md](parity.md) | Every capability a rival tool has, whether we adopt its method or use a better one, and where that lives |
| [databricks.md](databricks.md) | How the platform works, where it is strong and weak for us, and how each feature is built on it |
| [coverage.md](coverage.md) | Which research backs which feature, and the gaps |
| [plans/board.md](plans/board.md) | The build board: every piece as a box with its proving command, ticked to completion |
| [plans/workstreams.md](plans/workstreams.md) | The build piece by piece: the sessions, what each owns and delivers, the seams |
| [plans/start-now.md](plans/start-now.md) | Every task that can begin this minute |
| [plans/](plans/README.md) | How the build is organised: stages, task shape, test layers, the first tasks |
| [hard-calls.md](hard-calls.md) | Where two good answers conflict (a better offer while the first buyer hasn't paid, silence, partial failures, disputes), the call we make and the field it is borrowed from |
| [open-questions.md](open-questions.md) | What only Ben or Nate can settle, each with a recommendation |
| [../docs/how-it-works/](../docs/how-it-works/README.md) | The same system explained for people, not for the agents that build it |

## The checked model

- `lifecycle.mjs` models an item's life across sites: posting, failures, payments, dibs, delisting, markdowns and pickup ([functions.md §1](../product/functions.md#1-the-one-picture-underneath-an-items-life)). The tier rules come from [decisions.md](../product/decisions.md).
- `lifecycle.test.mjs` walks every interleaving across 3 sites (about 61,000 states) and checks six invariants:
  - a second payment always opens a refund. Across sites a double sale can't be prevented (a delist can fail and leave the listing up), so the spec proves it is never silent, not that it never happens
  - the price goes below the floor only to a price the user approved; one approval doesn't let automation go lower
  - every failure shows in red, and a failed delist stays buyable
  - paid beats dibs, and the dibs holder is told
  - address, pickup time and payment are only ever done by the user, and "Always do this" never covers them
  - every other listing comes down or is flagged after a sale, without a tap

  It plants four bugs and checks that each is caught. One test shows why a price below your floor can never be promoted (Ben, [20:41](../product/decisions.md#2026-11-14-a-price-below-your-floor-always-asks)): if it could, automation would break the floor.
- `sites.mjs` holds what each marketplace does as single facts (offer clocks, offer floors and waits, whether accepting an offer is a sale, whether relisting is penalized), each with its evidence mark and source note. Timers, messages and checks read `fact(key, site)` or the functions built on it (`offerExpiresAt`, `afterAccept`, `sellerOffer`, `exposedUntil`); nothing else may hold its own copy, and `sites.test.mjs` fails product code that does. An unconfirmed fact throws instead of returning a guess. Listing limits stay in [platform-fit.json](../research/list/ben/platforms/platform-fit.json) and fees in the [money fee table](determinations/money.md).
- `replay.mjs` checks a real app log against the same model, using the logged `price` and `floor`: `node spec/replay.mjs app.jsonl ebay,depop`.
- `events.json` is the log contract and `log.mjs` checks a log against it ([Logging](#logging)).

## One name for each state

`lifecycle.mjs` is where states are named. `LISTING_STATES` is one listing on one site. `itemPill()` picks the one pill an item shows across its listings: Failed beats Sold, Sold beats Live, Live beats Review (*agent proposal*). Other docs name the same states differently. This is how they map.

| Here | Sell pill (decided) | functions.md §1 | Brand state color |
|---|---|---|---|
| `none` on every site | Review | Draft | new |
| `posting` | Review | Draft | new |
| `live` | Live | Live | live |
| `postFailed`, `delistFailed`, or a refund open | Failed (*agent proposal*: the decided pills have no failed state) | Failed | failed |
| `sale` set | Sold | Sold, Handed over, Done | sold or paid |
| `delisted` | (not shown once sold) | Unsold | ended |

Researching, Offer $X, Ship by and Slow are not modeled yet. They come before posting, from offers, from shipping and from time. Add them here first, then use the same names in the docs.

## Logging

The log contract is [events.json](events.json): every event, the fields it needs, and what gets masked. `log.mjs` checks a log file against it, then runs `replay.mjs` on its `item.action` lines and prints the numbers: `node spec/log.mjs app.jsonl --sites ebay,depop`. The loggers, and how to wire each program to them, are in [log/](../log/README.md).

`item.action` uses the action names in `lifecycle.mjs`, and `actor` is `user`, `auto` or `site`. Tokens, addresses, payment details and message text never reach a line, only their ids.
