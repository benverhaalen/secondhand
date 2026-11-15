# Messages worker

Check: `node --test --test-concurrency=1 app/src/edge/messages/messages.test.ts`

Entry: `handleMessages(account, ports, store, log, options)`. Only linked, healthy accounts are read. The default is dry; writes require `options.live` and the site's recorded go. Incoming text is transient. Stored messages carry encrypted `text_ref`; logs carry ids and counts.

| Verb | Input | Output | Before it runs | Failure and retry |
|---|---|---|---|---|
| `read_messages` | Linked account | Thread messages with site ids and encrypted text refs | Account health `ok`; adapter maps to `read_inbox` and thread reads | Propagate the adapter error; next poll can retry |
| `classify` | One transient buyer message | Jev intent, route kind, facets and signals | Buyer text is data, never instructions | Propagate errors; do not draft or send |
| `context` | Account and message ids | Person's item, confirmed attributes, current offer state | Tenant and item must match | Mismatch fails with its cause |
| `trust` | Message and item context | Allow, warn, ask or block | Fixed trust rules also run locally | Anything except allow opens `scam_warning`; locked address and off-site requests ask |
| `negotiate` | Offer and seller limits | Negotiation engine decision | Sell role, matching site; final `assertLimits` check | Lowball holds a `price_below_floor` decision with the policy's counter; no send |
| `draft` | Message and evidenced facts | Transient text and claims | Trust passed; no floor, private location or address in facts | Free prose waits for a calibrated entailment implementation; unsupported or uncovered text is held |
| `save_draft` | Transient draft | Encrypted draft ref | Save before opening a reply decision | Propagate storage error; no send |
| `send_message` | Conversation, operation id, backed text | Signed-in read-back with site message id and exact text | Canonical confirmed facts; promoted rule; replies on; no ask-every-time; live and site go | Mismatch throws. Keep operation held for reconcile; never blindly send twice |
| `answer_offer` | Conversation, operation id, policy action and amount | Signed-in read-back of action and amount | Limits checked; policy permits automatic action; live and site go | Mismatch throws. Keep operation held for reconcile |

The write ports own the account lease, pacing, current-limit recheck and site idempotency. Production storage must replace `memoryMessageStore` with a durable message/decision/check store and atomic operation claims. A process restart must retain unknown write outcomes until reconciled.

Replies start as drafts, following [the recorded decision](../../../../product/decisions.md#2026-11-15-replies-to-buyers-start-as-drafts-the-person-approves). Fact promotion is scoped to the sorted requested attribute names: `answer_fact:size` cannot authorize `answer_fact:colour`. Fact answers use confirmed attribute names and values. An unbacked claim, unparsed text, authenticity claim or unresolved measurement cannot auto-send. Buy offers always ask. Pickup and dispute routes become their existing decisions for the owning workers.

The Jev, trust, encrypted storage and harness implementations plug into `MessagePorts`. Tests use in-memory fakes and the existing negotiation engine. No live target run was performed; see [the run note](../../../../research/cross-cutting/nate/runs/msg-1.md).
