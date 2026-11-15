# Moving a phone session to the hosted browser

Check: `node --test --test-concurrency=1 app/src/edge/harness/handoff/handoff.test.ts`.

`createHandoff` reads only a linked account owned by the authenticated person. Without site-specific go it returns the steps and reads no phone state. With go it reserves and renews the shared account lease, reads phone storage through the server-only port, loads it into a Launcher context, opens the site's home page and probes it.

A challenge returns `paused`, one persistent site-warning decision and an opaque viewer URL. The authenticated viewer route resolves that URL through `liveView`. The cloud `live_url` is a credential; neither the result envelope nor logs contain it. The person clears the challenge and calls `resume`. If the site challenges again, the same decision is returned even if it was already answered.

After verification the module exports storage, invalidates any old warm pool context, writes AuthVault through the existing account token reference, and closes the temporary browser. The next pool dispatch loads the updated state. `invalidatePool` must be supplied by integration; its contract and missing pool support are described in `connect/OPERATING.md`.

Failure raises account_stale through the existing events stale handler: queued and running jobs remain queued and paused with attempts and checkpoints intact. Phone state is never deleted. Session access expires after `leaseTtlMs`; the host must cancel an abandoned viewer and configure a bounded cloud timeout. Worker restart loses the temporary browser reference, so the host must clean up that browser and begin again. Stored decisions still prevent a second prompt for that handoff id.

Production phone export, viewer routes, site probes and pool invalidation remain unwired in these owned paths. No browser or network run was performed.

Rests on `spec/engines/protocol-and-adapters.md` §3.1 and §3.8, `spec/product.md` account_stale and marketplace sessions, and `research/cross-cutting/nate/browser-use-cloud.md`, with the worker request's cloud-browser correction.
