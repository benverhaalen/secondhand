# The hosted browser pool: how it operates

`createPool({launcher, profileRoot, address, maxAccounts, publicConcurrency, log})` in `pool.ts`. The real launcher is `playwrightLauncher(loadPlaywright())` in `playwright.ts`.

- **One profile per account.** Each linked account has its own directory under `profileRoot`, launched as a Playwright persistent context, which is one browser process per account. It has its own steady address from `address(account_id)`. The directory is a credential: it never leaves the host and never goes in a log or a backup we do not encrypt.
- **Warm.** `warm(account_ids)` launches the profiles ahead of any call. A dispatch then only opens a page: about 60 ms against 0.3 to 1.7 s cold (runs/bp-1.md).
- **At once, in parallel.** `dispatchAll(tasks)` sends every task immediately, each on its own page. Linked accounts run side by side. Public reads share up to `publicConcurrency` anonymous contexts and queue past that.
- **One job per account.** A second job on a leased account gets 409 at once, so steps never interleave. A write holds the lease through its read-back (hp-2 owns the lease row; the pool enforces it on the process).
- **Restart.** If a profile's browser dies, the next dispatch relaunches the same directory, so the login survives. A site that logged us out answers `auth_expired` in its adapter.
- **Memory cap.** Past `maxAccounts` the least recently used idle profile is closed and stays on disk. A leased one is never closed.
- **Never.** No forged fingerprint, no stealth plugin, no challenge solver, no browser vendor. A check page means `blocked`.

| verb | how the pool serves it |
|---|---|
| `read_listings`, `read_inbox`, `read_offers`, `read_orders`, `read_stats` | a page in the account's warm profile, under the account's lease |
| `search` | an anonymous public context, many at once; the cookie runner or a plain request first where recon found an endpoint |
| `post`, `revise`, `end`, `relist`, `send_message`, `answer_offer`, `make_offer`, `save` | a page in the account's warm profile; the lease is held through the read-back; never replayed |
