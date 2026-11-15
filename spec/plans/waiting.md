# Who is waiting on what

Nate ([words](../../product/words.md#2026-11-15-nate-no-worker-waits-confused-and-experts-sweep-the-spec)): "ensure workers aren't going to get confused and all wait in a way that connects to it working". This is the one list of things one seat needs from another. A lead adds a row the moment it finds a need, and removes it when the need is met. The orchestrator reads it at every report and chases the oldest row.

## The rule

1. Nobody waits idle. A seat that needs something another seat owns writes the row, agrees the shape with the owner in one message through the orchestrator, builds against that shape with a planted fixture, and moves to its next piece.
2. Every row has one owner and a "meanwhile". A row with no owner is the orchestrator's until it names one. A row with no meanwhile is not allowed: say what the waiter builds in the meantime.
3. A worker never waits. If a Codex worker's brief depends on something that does not exist yet, the brief gives it the agreed shape as a fixture; the worker does not poll, sleep or stop for it.
4. Two seats waiting on each other is a design fault, not a queue: the first to see it sends the orchestrator both rows, and the orchestrator cuts the knot by fixing the shape between them.
5. A row that waits on Nate or Ben says exactly what they are asked to do, in one line, and the orchestrator carries it to them. Work does not stop for it.

## Open now

| Needed | By | Owner | Meanwhile, the waiter | Since |
|---|---|---|---|---|
| The benchmark's item set: `spec/items/manifest.json` has ten skeleton items, every answer null, no photos; the first run needs 20 real items across five families | integration (the runner's first run), engines (row 7) | orchestrator for market items (a described product with a known identity and a public listing, from the harness reads); Nate and Ben for owned items (photos, tape measurements, the price it later sold for) | builds `bench/run.mjs` and `bench/score.mjs` against a planted record set with known scores, as [the benchmark](../benchmark.md#how-it-is-built) already requires | 2026-11-15 |
| The public search and valuation paths answering from engines, not examples | integration (the benchmark runner asks only the public API) | integration | works down `exampleReasons`; the runner is written against the route contract | 2026-11-15 |
| The backtest writing one row per held-out item and contestant, not only the scored report | databricks (the `measures` tables) | engines | builds the tables and the loader against the shape read from `jobs/valuation/experiment.py` `run()`: `contestant`, `item_id`, `as_of`, `freeze_basis`, `q10`, `q50`, `q90`, `shown`, `comp_ids`, plus `data` | 2026-11-15 |
| A valuation backtest on real sold listings, by family | databricks (the accuracy tile), the benchmark's row 7 | engines; the network reads run from Windows or through the orchestrator | everything is labelled `synthetic` or `dataset:<name>` until it lands; no tile shows synthetic accuracy as real | 2026-11-15 |
| The question contract capture returns (field, kind, options, why, what it unlocks) | Ben's capture screens | capture | Ben's screens render from `spec/examples/` as today | 2026-11-15 |
| The benchmark's record shape and `bench/out/results.json` | databricks (to load a run) | integration | shapes `measures` from [the benchmark](../benchmark.md) and adjusts when the shape is fixed | 2026-11-15 |
| The Poshmark, Mercari and eBay adapters under `app/src/edge/harness/sites/` | integration (the walk's real stages, the multi-day watcher test) | orchestrator | uses the Depop adapter and recorded replies | 2026-11-15 |

## Waiting on Nate or Ben

| Asked of | What, in one line | Unlocks | Meanwhile |
|---|---|---|---|
| Nate | sign in to one marketplace account once through the cloud browser's live view | the first proof of any signed-in verb (inbox, offers, orders, storefront) on a real account | signed-in verbs are proved on recorded pages only |
| Nate | eBay developer keys in the environment (checked by presence, never written down) | eBay through its official APIs | the eBay adapter is built and tested against the documented responses |
| Nate | a go for each paid Databricks resource a lead asks for through the orchestrator | whatever that resource serves | the lead builds what does not need it |
| Nate and Ben | photograph and measure the owned items for the item set, and record what each later sold for | the capture accuracy numbers and the owned half of the benchmark | market items carry the first run |
| Nate and Ben | which rivals are named, whether a paid plan is bought, who the two judges are ([open questions](../benchmark.md#open-for-nate-and-ben)) | the rivals' side of the benchmark | ours is run and published to the record first |
