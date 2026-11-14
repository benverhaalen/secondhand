# Item card

Status: idea. Owner: unassigned. Packet topic: `item-card`.

Spec (agent proposal): [spec/features/item-card.md](../../spec/features/item-card.md).

## What and why
One measured record per item. It holds photos, measurements, identity, condition, defects and price, and marks each field as measured, inferred or stated by the seller. Every platform listing is built from it. *Agent proposal* from the concept brief.

## How it works
Not designed yet. Keep the mechanism here once research picks one, together with the reference it came from and the job that reference does.

## Decided
Nothing yet. Each entry here links to [decisions.md](../../product/decisions.md).

## Open
- Which fields are required before the item can be listed?

## Research
All research for this feature: `research/item-card/` (none yet)
- Ben: `research/item-card/ben/` (none yet)
- Nate: [research/item-card/nate/](../../research/item-card/nate/)
- Nate: [identity-schema-by-kind.md](../../research/item-card/nate/identity-schema-by-kind.md). What identifies each kind of used item exactly, what drives its value, and what capture must record, look up or ask; condition words differ by market.
- Ben, harness from repos: [ai-harness-from-repos.md](../../research/cross-cutting/ben/ai-harness-from-repos.md#5-listing-text). *Agent proposal:* each field holds its value, the photos that prove it, its source and a typed reason when it is in doubt (thrift-agent, doc-pilot).
