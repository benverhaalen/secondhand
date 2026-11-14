# spec/

The rules the app's behavior has to keep, written as code so they can be checked rather than just read. This is an *agent proposal* built from Ben's decisions. If a decision changes, change it here as well.

- `lifecycle.mjs` models an item's life across sites: posting, failures, payments, dibs, delisting, markdowns and pickup ([functions.md §1](../product/functions.md#1-the-one-picture-underneath-an-items-life)). The tier rules come from [decisions.md](../product/decisions.md).
- `lifecycle.test.mjs` walks every interleaving across 3 sites (about 8,000 states) and checks five invariants:
  - only one sale is kept, and a second payment always raises a refund
  - the price never goes below the floor without the user
  - every failure shows in red
  - paid beats dibs, and the dibs holder is told
  - address, pickup time and payment are never automated

  It also proves that after a sale, every other listing comes down or is flagged, without a tap. It plants two bugs and checks that both are caught.
- `replay.mjs` checks a real app log against the same model: `node spec/replay.mjs app.jsonl ebay,depop`.

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
