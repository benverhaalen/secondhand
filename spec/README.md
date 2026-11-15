# spec/

The rules the app's behavior has to keep, written as code so they can be checked rather than just read. This is an *agent proposal* built from Ben and Nate's decisions.

*Agent proposal*: the settled transport is in [protocol §§3.5 to 3.8](engines/protocol-and-adapters.md#35-starting-routes-site-by-verb): [Browser Use Cloud](../product/words.md#2026-11-14-nate-browser-use-on-cloud-tested-the-way-production-runs-with-milestones-that-are-finalised-as-they-are-hit) behind `Launcher`, with [official APIs where offered](../product/words.md#2026-11-15-nate-official-apis-where-they-exist-the-browser-design-as-specced-ranking-systems-accounted-for-databricks-perfected). [Packet 49](../.agents/team/packets/team/49-handoff-to-the-mac-session.md) records the handoff and replaces the self-hosted, thirteen-session build.

## Where to start

Everything under `spec/` that is not code is an *agent proposal* for Ben and Nate until a line links a decision.

| Read | For |
|---|---|
| [product.md](product.md) | Canon entities, states, verbs, endpoints, decisions, jobs and events; wins on conflicts |
| [features/](features/) | Feature behavior, data flow, contracts, failures and proof |
| [determinations/](determinations/) | Determination cards: sources, weights, method and explanation |
| [engines/](engines/) | Engine outputs, signals, calculation, learning, speed, proof and tasks |
| [marketing-engine.md](marketing-engine.md) | Site plans, calculation and proof |
| [data-use.md](data-use.md) | What data is kept, what learns from it, and what needs a person's consent |
| [assessment.md](assessment.md) | How ready each part is, with the confusions found in the builders' notes |
| [benchmark.md](benchmark.md) | Open benchmark on a fixed item set, with raw answers |
| [parity.md](parity.md) | Rival capabilities and our methods |
| [databricks.md](databricks.md) | Platform design and feature integration |
| [databricks-build.md](databricks-build.md) | What is built on Databricks: tables, lineage, pipeline, parity, governance and the demo path |
| [items/](items/manifest.json) | The benchmark's fixed item set (`manifest.json`), its scorer (`score.mjs`) and a real capture |
| [coverage.md](coverage.md) | Which research backs which feature, and the gaps |
| [plans/board.md](plans/board.md) | Build progress and proving commands |
| [plans/workstreams.md](plans/workstreams.md) | Build ownership, delivery and seams |
| [plans/start-now.md](plans/start-now.md) | Every task that can begin this minute |
| [plans/](plans/README.md) | How the build is organised: stages, task shape, test layers, the first tasks |
| [plans/waiting.md](plans/waiting.md) | Who is waiting on what, each row with an owner and a "meanwhile" |
| [plans/joins.md](plans/joins.md) | The join map: the demo path link by link, real, example or missing |
| [plans/ben-asks.md](plans/ben-asks.md) | What Ben's packets ask of the backend, and what we do with each |
| [plans/sweep/](plans/sweep/) | Audits of the build and the repo; [round-2/repo-organization.md](plans/sweep/round-2/repo-organization.md) is the repo organisation plan |
| [hard-calls.md](hard-calls.md) | Calls on conflicting goals, silence, partial failures and disputes |
| [open-questions.md](open-questions.md) | What only Ben or Nate can settle, each with a recommendation |
| [../docs/how-it-works/](../docs/how-it-works/README.md) | The system explained for people |

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
