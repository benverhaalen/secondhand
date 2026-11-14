# Sold and delist

Status: designing. Owner: unassigned. Packet topic: `sold`.

## What and why
When an item sells, delist it everywhere. Handle the race between a paid sale and someone who called dibs, and show any failed delist in red: Vendoo users report missed delists leading to Poshmark bans. *Agent proposal* from the [design canvas](https://claude.ai/artifact/X7UbT6gqeiAMGPDyDiL6fg).

## How it works
Not designed yet. Keep the mechanism here once research picks one, together with the reference it came from and the job that reference does.

## Decided
Nothing yet. Each entry here links to [decisions.md](../../product/decisions.md).

## Open
- How fast must a delist land, platform by platform, before a second buyer can pay?

## Research
All research for this feature: `research/sold/` (none yet)
- Ben: `research/sold/ben/` (none yet)
- Nate: `research/sold/nate/` (none yet)
- Ben, harness from repos: [ai-harness-from-repos.md](../../research/cross-cutting/ben/ai-harness-from-repos.md#4-posting-delisting-and-jobs). *Agent proposal:* "gone" needs two absent reads some minutes apart, and buying a shipping label is Never alone ([Money](../../research/cross-cutting/ben/ai-harness-from-repos.md#money)).
