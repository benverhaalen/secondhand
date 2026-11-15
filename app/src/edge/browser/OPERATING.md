# The hosted browser pool: how it operates

`createPool({launcher, profileRoot, accounts, vault, address, maxAccounts, publicConcurrency, log})` in `pool.ts`.

- **Browsers are browser-use browsers, reached over CDP** (`cdp.ts`, Nate: "use browser-use"). `cdpLauncher(pw, localChrome({executablePath, scratch}))` is a local Chrome on a kept profile directory, with its debugging port bound to 127.0.0.1. `cdpLauncher(pw, browserUseCloud({apiKey}))` is a Browser Use Cloud browser (`POST /api/v4/browsers`, connect to `cdpUrl`, `PATCH {action:"stop"}` on close; the key goes only in the `X-Browser-Use-API-Key` header), chosen by `sourceFromEnv()` when `BROWSER_USE_API_KEY` is present (local Chrome otherwise). `playwrightLauncher` (`playwright.ts`) stays as the plain local fallback.
- **Sign-in is storage state behind `account.token_ref`** (`auth.ts`): `{cookies, origins[].localStorage}`, the shape browser-use's `export_storage_state` writes. It loads into the account's browser when its first lease starts and is exported back to the vault when every lease ends. It lives only in the secret scope (the `AuthVault` port), never in a repo file, a log or a trace. Close sends `Browser.close` and waits for Chrome to exit, so the profile's cookie store is flushed.
- **Headed where the site needs it.** `PROFILES[site].headed` (platform.ts) is true for Depop and Mercari, which refuse a headless browser (runs/bp-1.md, run 2). Their accounts, and public reads that pass `site`, run in a real window, on a virtual display on a server. Every other site runs headless.
- **Linked accounts only.** An account task runs only when `accounts.byId` finds an account row with stored sign-in state; otherwise it answers `not_linked` with nothing launched. `warmLinked(person_id)` warms exactly the person's linked accounts. Public market reads need no link.

- **One profile per account.** Each linked account has its own directory under `profileRoot`, launched as a Playwright persistent context, which is one browser process per account. It has its own steady address from `address(account_id)`. The directory is a credential: it never leaves the host and never goes in a log or a backup we do not encrypt.
- **Warm.** `warm(account_ids)` launches the profiles ahead of any call. A dispatch then only opens a page: about 60 ms against 0.3 to 1.7 s cold (runs/bp-1.md).
- **At once, in parallel.** `dispatchAll(tasks)` sends every task immediately, each on its own page. Linked accounts run side by side. Public reads share up to `publicConcurrency` anonymous contexts and queue past that.
- **One job per account.** A second job on a leased account gets 409 at once, so steps never interleave. A write holds the lease through its read-back (hp-2 owns the lease row; the pool enforces it on the process).
- **Restart.** If a profile's browser dies, the next dispatch relaunches the same directory, so the login survives. A site that logged us out answers `auth_expired` in its adapter.
- **Memory cap.** Past `maxAccounts` the least recently used idle profile is closed and stays on disk. A leased one is never closed.
- **Never.** No code here solves a CAPTCHA or defeats a challenge (no `captcha_solver`): a challenge pauses the session, and the person clears it in the live browser (`live_url` on a cloud browser), then the job resumes. No forged fingerprint of our own.

| verb | how the pool serves it |
|---|---|
| `read_listings`, `read_inbox`, `read_offers`, `read_orders`, `read_stats` | a page in the account's warm profile, under the account's lease |
| `search` | an anonymous public context, many at once; the cookie runner or a plain request first where recon found an endpoint |
| `post`, `revise`, `end`, `relist`, `send_message`, `answer_offer`, `make_offer`, `save` | a page in the account's warm profile; the lease is held through the read-back; never replayed |
