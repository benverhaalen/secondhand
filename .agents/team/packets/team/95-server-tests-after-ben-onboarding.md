# 95: what the server lead changed in Ben's onboarding merge

Updated: 2026-11-15, about 15:00 UTC. Owner: Ben. Agent: Claude Code, the server-core lead, with Codex worker srv-ben-1. Your merges ac133f38 and 80fbe2d8 (routes read the person's own rows, connections added) turned about 20 server tests red. Each was decided on its merits: where your behaviour is right the test followed it; where a person could see example rows, or an example's shape broke, the code changed. Nothing of yours was reverted wholesale.

One change after the worker: a person who owns no items, conversations or orders gets 200 with an empty list from GET /v1/items, /v1/conversations and /v1/orders (your behaviour), not 404; another person's or the example person's rows never appear. A specific id that is not theirs is still 404.

## Test by test

- accounts.import, response equals its contract example: kept generated Store job ids; the test verifies the job exists before normalizing its variable id for the contract comparison.
- accounts.import_preview, response equals its contract example: kept the old example contract; restored purchases and cached preview fields for the example person while examples are served.
- accounts.unlink, response equals its contract example: kept generated Store job ids; the test verifies the stored job before comparing the fixed example shape.
- accounts.import, reconnect replays same action and rejects changed body: kept the replay contract; the example person's offline import can enqueue from owned cached example rows again.
- import preview calls the harness and labels the stored fallback: kept the old example contract; permitted offline fallback is explicitly marked stored and carries the harness reason.
- an import job creates live rows once and links an existing match without duplicating the item: kept the old idempotent import contract; restoring the example-only fallback lets the real pipeline consume its selected rows.
- a successful empty live preview replaces cached rows instead of resurrecting old listings: kept Ben's live replacement behavior; the example account reaches the harness instead of stopping at the new username prompt.
- offline linked preview reports no_route, and a stale unlink leaves the link intact: kept the old example fallback and version contract; no_route stays visible and stale unlink still cannot revoke the account.
- successful harness listing reads carry live site provenance: kept Ben's live provenance; the example account reaches the harness and live rows remain separate from example rows.
- conversations.list, response equals its contract example: kept the old contract shape; the Store's internal conversation version is omitted from the public projection.
- conversations.list, wrong user cannot read or act on example data: kept the test unchanged; an unreadable or absent owned collection returns 404 while owned conversations return 200.
- conversations.messages, response equals its contract example: kept the old example shape and Ben's Store history reads; example messages are seeded with their conversation only while examples are served.
- conversation reads validate stored incoming messages: kept validation and Ben's Store source; the test now corrupts actual stored history instead of replacing the unused message-reader port.
- items.list, response equals its contract example: kept the old example contract; its published cursor remains confined to an example-only collection while real collections use Store pagination.
- items.list, wrong user cannot read or act on example data: kept the test unchanged; an unreadable or absent owned collection returns 404 while owned items return 200.
- orders.list, response equals its contract example: kept the old example shape and Ben's Store source; example orders are now seeded as owned rows with integer cents.
- orders.list, wrong user cannot read or act on example data: kept the test unchanged; an unreadable or absent owned collection returns 404 while owned orders return 200.
- order reads use orderBook records rather than fixed money values: kept Ben's Store source; the test edits a stored order and still requires exactly 1000 cents in the response.
- orders: unknown fees stay null in the response and kept stays unknown in the ledger: kept the old money contract; the test reads the real Store and still requires both unknown amounts to stay null.
- orders: a reported zero fee remains known money rather than null: kept the old money contract; the test writes zero into the Store and still requires zero fees and the exact retained price.
- every manifest endpoint has an Expo file exporting its method, with matching auth: kept the route contract; the connections view now exports POST through the neighboring direct route pattern.
- every handler module exports a manifest consumed by the aggregate: kept the route contract; uploads gained only its manifest export and the aggregate consumes it with auth none.
- the routes example preserves every contract field with the explicit engine joins: kept the manifest shape; added all six connections rows and the newly declared uploads row.
- one --once runs jobs enqueued by the import and unlink routes: kept the worker contract unchanged; restoring example-only import fallback lets its real routes enqueue the three jobs again.
- 3: the configured recorded source reaches the real reader only after a separate search request: kept the current source registry; the assertion now includes Google Shopping, whose treg lane has no recorded input in this proof and remains excluded.
- runtime, search, uploads and contract-example suites: kept their passing behavior; new runtime checks also reject example rows after examples are disabled and copied example data assigned to a real person.

## Still open for you

- Real Depop previews still ask for a username when no shop id exists.
- appointments.list and orders.pick_list still answer from contract examples (404 for a real person) until SV8 reaches them.
