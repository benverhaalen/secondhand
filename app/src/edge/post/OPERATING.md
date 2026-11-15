# Posting built listings

Check: `node --test --test-concurrency=1 app/src/edge/post/post.test.ts`.

`createPoster` takes the shared Harness, Accounts, Sessions, shared Leases port, decision Store, Operations store and optional logger. A target carries the listing engine's existing built listing, listing id, account, site, operation id and the outgoing claim check. The caller supplies the authenticated person's id, approved listing ids and site-specific go. Keep both approvals on the server's trusted request path.

Without site go the result is `dry`, with the exact `post` and `read_listings` arguments. No harness call or operation claim runs. Live posting requires a linked account owned by that person, a ready listing, passing claim check and first-post approval. A paused session cannot post.

Each post is followed by read-back, matched by the site’s returned listing id. Without that id, a unique match must have the original title and price and a posted time between the operation claim and its first read-back. An unknown outcome is never reposted; an unconfirmed result pauses with one site-warning decision, and subsequent calls only reconcile. A challenge during the write or read-back uses the existing Sessions bot-check path to pause and ask the person. The Sessions decision callback must persist that decision. After the person resumes, the same operation only reconciles.

Targets for one account queue in order; different accounts run in parallel. The shared account lease covers the write and read-back, and nested pool adapters inherit it.

Operations keys include person, account, site and operation id. Production `claim` must atomically persist the original title, price and start time. `intent`, `finish`, `identify`, `get` and `put` share that durable store; `finish` fixes the first read-back boundary and never extends it. `memoryOperations` is an offline implementation. Adapters return site listing ids and listing fields; they do not need to echo our operation ids. Production store wiring and the write p95 of 20 seconds remain unverified.

Rests on `spec/features/list.md`, `spec/engines/protocol-and-adapters.md` §1 and §9, and `spec/product.md` listing states, first_post and the evidence gate.
