# The server's store and entry (SV0)

Written 2026-11-15 by the server-core lead (Claude Code, Opus 5.5) for row SV0 of [finalization](finalization.md#2-server-core-lead-server). A means decision, so the lead's to make ([decide](../../.agents/skills/decide/SKILL.md)); Nate approved the host, one always-on Fly.io machine with a volume ([words](../../product/words.md), 2026-11-15: "Yes we can host with fly.io").

## The question

Where does the server keep what must outlive a request and be seen by every route, and what program serves the routes?

Facts it rests on (*checked* in source, see [review-server.md](audit-2026-11-15/review-server.md) §1 and §2): every route file is its own bundle in an Expo export, and the dev server evaluates each bundle fresh per request, so module memory is per route or per request; the `Store` port (`app/src/edge/events/ports.ts:88`) is **synchronous** and about forty callers use it that way; the file store rewrites the whole file from one bundle's memory (`events/file-store.ts:44`). Node 24 ships `node:sqlite` (`DatabaseSync`, synchronous; ran on Windows Node 24.14.1 and the Mac has 24.10.0; it prints an experimental warning, *observed* 2026-11-15).

**Common answer:** Postgres (or Lakebase, which the spec names as the app database, [decisions](../../product/decisions.md) "Hosting and agents"). Dropped for now: the port is async, so every Store caller would change, and a second service is a second thing to run. It stays the path after judging; the Store interface is the seam.

| Option | Rests on | Wrong if |
|---|---|---|
| **A. SQLite through `node:sqlite`, one file `$SECONDHAND_DATA_DIR/secondhand.db`, WAL, per-row writes, behind the same synchronous `Store`** | sync API matches the port; no dependency; per-row writes end the whole-file overwrite; several connections (dev's per-request module copies, a second process) see each other's commits | a write under load waits past `busy_timeout`, or the experimental module changes shape in a Node 24 patch |
| B. Keep the JSON file, share one instance through `globalThis` | the jobs workaround (`api/jobs.ts:166`) | a second process or a crash mid-write loses rows; the whole file is rewritten per write |
| C. Postgres or Lakebase now | the spec's target | every caller goes async before anything else can land |

**Decided (agent): A**, because it is the only option that fixes both the production bundles and the dev server with no change to a caller. Strongest rival: C, after judging.

## What follows from it

- **One program.** `server/main.ts` imports every route wrapper under `app/src/app/v1/` once in one Node process (one auth state, one vault, one signing key, one runtime), serves them over `node:http`, and starts the watcher and the pipeline (SV4). The Expo dev server keeps serving the same wrappers; because state is in the database, both behave the same.
- **Where the file lives.** `SECONDHAND_DATA_DIR` set: that folder. Unset under `node --test`: an in-memory database per process. Unset with `NODE_ENV=production`: the server refuses to start (SV10). Unset otherwise (a development server): a temp folder, named in the log.
- **Simple state takes the easiest home** ([Nate](../../product/words.md#2026-11-15-nate-the-easiest-store-for-the-simple-state): "use whatever is easiest for the simple store like chats and such"): a product row goes in the generic `rows` table under its `TABLES` name (conversations, follows, orders), and process state (counters, last-open times, run caps, signing keys) goes in `kv` (`app/src/edge/store/kv.ts`). No feature gets its own schema unless a query needs a column.
- **One machine.** Job claims and leases are in the database, but the watcher runs in one process; Fly runs one machine (`fly scale count 1`).
- *shortcut:* `node:sqlite` is experimental in Node 24; pin the Node version in the Dockerfile and move to the stable module, or to C, when it is.
