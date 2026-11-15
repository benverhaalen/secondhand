# Hosted sign-in

Check: `node --test --test-concurrency=1 app/src/edge/connect/signin.test.ts`.

`createSignin` uses the Browser Use Cloud Launcher from `browser/cdp.ts`. Pass the production Accounts, AuthVault, account writer, shared leases and logger. The person signs in through the cloud context's `live_url`; code opens the site's login from `harness/platform.ts` and probes the result. It never fills a password or answers a challenge.

| Operation | Reads and actions | Result |
|---|---|---|
| `start` without the person's site in `go` | returns the steps; launches nothing | `dry` |
| `start` with site go | reserves the account lease, opens its hosted profile and marketplace login | `waiting`, account id and opaque `signin_session_url` |
| `liveView` | checks the authenticated person, session and expiry | live-view credential for the server's viewer route |
| `complete` while signed out | probes only | `waiting` |
| `complete` at 2FA or a bot check | keeps the session and raises a `site_warning` decision | `paused`; person clears it in the live view |
| `complete` after a verified sign-in | exports storage, invalidates old pool context, writes AuthVault, links the account, closes browser | `ok`; later pool dispatch loads `account.token_ref` |
| `cancel`, expiry or failed completion | closes the browser and releases its lease | `failed`; a new account remains unlinked |

The shared account lease renews while the session is active. `ttlMs` bounds access to the viewer and completion; a service must call `cancel` when its viewer is abandoned. Cloud browser timeout must also bound unattended billing. Contexts and viewer URLs stay in memory; a worker restart requires another sign-in. Log only account ids and status. Exceptions are sanitized before entering `log.call`, because vendor errors may contain viewer or CDP credentials.

`liveView` is server-only. Its caller must authenticate the person and serve the viewer with no-store caching and no URL logging, including redirect Location headers. It must never expose CDP. The app URL returned by this module needs a route wired to that resolver; this task owns no route files.

`invalidatePool(account_id)` is required in both sign-in and `harness/handoff`. Under the shared account lease it must close and evict any old warm pool context before AuthVault is updated. It must not warm a replacement yet. `pool.ts` currently has no per-account invalidation method, and is outside these tasks' owned paths; the lead must supply this operation before integration. A no-op would allow an old context to overwrite the new sign-in.

The `link` port writes the verified LinkedAccount row. The `probe` port must recognize the real site's signed-in state and distinguish signed-out, second-factor and blocked pages. Tests use offline ports. Production route wiring, pool invalidation, vault/database implementations and site probes have not been exercised here. No live browser run or latency measurement was made.

Rests on `spec/features/connect.md`, `spec/engines/protocol-and-adapters.md` §3.1, `spec/product.md` secrets and marketplace sessions, and `research/cross-cutting/nate/browser-use-cloud.md`. The worker request supersedes older local-browser and challenge-solving assumptions.
