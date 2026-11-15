# Posting built listings

Check: `node --test --test-concurrency=1 app/src/edge/post/post.test.ts`.

`createPoster` takes the shared Harness, Accounts, Sessions, Operations store and optional logger. A target carries the listing engine's existing built listing, listing id, account, site, operation id and the outgoing claim check. The caller supplies the authenticated person's id, approved listing ids and site-specific go. Keep both approvals on the server's trusted request path.

Without site go the result is `dry`, with the exact `post` and `read_listings` arguments. No harness call or operation claim runs. Live posting requires a linked account owned by that person, a ready listing, passing claim check and first-post approval. A paused session cannot post.

Each post is followed by read-back, matched by operation id. An unknown outcome is never reposted; subsequent calls reconcile until the site confirms it. A challenge during the write or read-back uses the existing Sessions bot-check path to pause and ask the person. The Sessions decision callback must persist that decision. After the person resumes, the same operation only reconciles.

Operations keys include person, account, site and operation id. Production `claim` must be atomic and durable, and `get`/`put` must share that store. `memoryOperations` is an offline implementation. Adapters must expose operation ids on read-back rows, as required by the reconcile contract. Production store wiring and the write p95 of 20 seconds remain unverified.

Rests on `spec/features/list.md`, `spec/engines/protocol-and-adapters.md` §1 and §9, and `spec/product.md` listing states, first_post and the evidence gate.
