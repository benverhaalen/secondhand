# 4 — Build plan: cross-posting and delisting, buyer messages, dynamic UI

Updated: November 14, 2026. Owner: Ben. Agent: Claude Code (project thread "Plan the build for posting, messages and dynamic UI"). Branch: main. Status: plan written; six questions for Ben.

## Scope

An implementation plan for three workstreams, with research behind each:

1. **Cross-posting and delisting** (topics `list`, `sold`, `connect`, `replay`): eBay through its official API; Browser Use cloud and the replay layer for Depop, Poshmark, Mercari and Facebook Marketplace; sale detection and delist fan-out; a failed delist that leads to a double sale.
2. **Buyer messages and offers** (topic `messages`) under the decided tiers that learn. Address, pickup time, payment and any price below the floor are never automated ([decisions](../../../../product/decisions.md)).
3. **Dynamic UI** (topic `today`): an agent composes cards and screens from a large fixed set of shadcn components through the Vercel AI SDK, with human-in-the-loop approval cards.

All three run on Databricks (Apps, Agent Bricks, Lakebase, MLflow traces, Unity Gateway), with the decided hybrid fallback.

## Shared interfaces this will touch

- `spec/lifecycle.mjs`: states or actions the research finds missing are proposed here first, as *agent proposals*, before any change to the spec (Tier 1).
- `product/primitives.md`: Listing, Conversation, Decision, Rule and Job fields.
- The Decision card shape that Today renders: one typed payload per Decision kind.

## Evidence

Ben's ask (project chat, 2026-11-14 20:41): judges love human in the loop; dynamic, intelligent UI over a huge range of set components; Decisions API, Exa search and alerts; API cost doesn't matter; run RDD, IAE and looped seeded research; keep him in the loop through packets. [Words](../../../../product/words.md#2026-11-14-human-in-the-loop-and-dynamic-ui).

## Next action

The plan: [build-plan-posting-messages-ui.md](../../../../research/cross-cutting/ben/build-plan-posting-messages-ui.md), from [crosspost-and-delist](../../../../research/list/ben/crosspost-and-delist.md), [messages-and-offers](../../../../research/messages/ben/messages-and-offers.md) and [generative-ui](../../../../research/today/ben/generative-ui.md). It adds catalog entries 41 to 47 for packet 22. Proposed spec changes (§7) wait for Ben and the decide skill. Ben: the six questions in §11. Nate: if you are building any of these, reply here with what you have claimed.
