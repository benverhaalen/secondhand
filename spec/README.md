# spec/

The rules the app's behavior has to keep, written as code so they can be checked rather than just read. This is an *agent proposal* built from Ben's decisions. If a decision changes, change it here as well.

- `lifecycle.mjs` models an item's life across sites: posting, failures, payments, dibs, delisting, markdowns and pickup ([functions.md §1](../product/functions.md#1-the-one-picture-underneath-an-items-life)). The tier rules come from [decisions.md](../product/decisions.md).
- `lifecycle.test.mjs` walks every interleaving across 3 sites (about 61,000 states) and checks six invariants:
  - a second payment always opens a refund. Across sites a double sale can't be prevented (a delist can fail and leave the listing up), so the spec proves it is never silent, not that it never happens
  - the price goes below the floor only to a price the user approved; one approval doesn't let automation go lower
  - every failure shows in red, and a failed delist stays buyable
  - paid beats dibs, and the dibs holder is told
  - address, pickup time and payment are only ever done by the user, and "Always do this" never covers them
  - every other listing comes down or is flagged after a sale, without a tap

  It plants four bugs and checks that each is caught. One test records a clash in the decided rules: "any price below your floor" is an Ask, Asks can be promoted, and a promoted one breaks the floor. Until Ben settles it, `NEVER_PROMOTED` blocks it (*agent proposal*).
- `replay.mjs` checks a real app log against the same model, using the logged `price` and `floor`: `node spec/replay.mjs app.jsonl ebay,depop`.

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

The app writes one JSON object per line, so agents can grep logs, replay them and hill-climb on them.

```
{"ts":"2026-11-14T20:00:00Z","level":"info","event":"item.action","item":"it_1","action":"buyerPays","site":"ebay","actor":"site","trace":"<mlflow trace id>"}
```

- `event` is a dotted noun.verb, such as `item.action`, `job.done`, `http.request` or `model.call`.
- `item.action` uses the action names in `lifecycle.mjs`, and `actor` is `user`, `auto` or `site`.
- Every job and model call logs its `ms`. A model call also logs its `model` and `cost_usd`, and errors log `error`.
- `trace` links the line to its MLflow trace on Databricks.
- Never log tokens, addresses, payment details or message text, only their ids.
