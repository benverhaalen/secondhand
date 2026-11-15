Status: *agent proposal*, a second-round audit asked for by Nate on 2026-11-15; nothing here is decided.

# Security, privacy and rule-keeping audit, round 2

This was a read-only review of the tracked code at `6eb651d0`. It trusts the code over the docs. No tests, builds, servers or network calls were run.

**No live secret and no real personal data was found in a tracked file.** Every credential-shaped match is a planted test value:
- `probes/workspace/test_run.py:47` is a placeholder inside `test_no_secret_in_report`;
- `spec/fixtures/{frames,mask,pages,planted,requirement}.test.mjs` hold planted values for the PII-scanner tests;
- `app/src/edge/harness/sites/dupe/fixtures/search.sse:2` is a redirect slug that happens to contain the prefix.

## Verdict

The build is not ready for TestFlight. Three things block it:
1. Account deletion only signs the person out.
2. The pipeline records a write that the adapter only planned (a "dry plan") as done, including an automatic delist after a sale.
3. The iOS app has no bundle id, no privacy manifest, no server origin and no session handling.

The tenant scoping on routes, the refusal to solve captchas, the dry-by-default adapters and the Databricks row filter all hold. The problems are mostly at the edges: unthrottled public endpoints that cost money, an `account_id` lookup that ignores the person, and a governance map that anyone with write access can widen.

## Blocks a TestFlight build

### B1. A dry plan is recorded as a completed write, so an automatic delist "succeeds" while the listing stays live
- **Where.**
  - `app/src/edge/events/pipeline.ts:189-191`:
    ```
    const data = await call(j, verb, { ...baseArgs(j, verb), ...extra }, verb);
    put(j.id, verb, { state: 'arrived', result: data, ended_at: iso() });
    ```
  - `pipeline.ts:150` is `if (env.ok) return env.data;`.
- **How it fails.**
  - The Depop adapter returns a successful envelope for a dry plan. `harness/sites/depop/adapter.ts:324` reads `if (a.dry !== false) return { ok: true, data: plan };`.
  - `baseArgs` (`pipeline.ts:155`) never sets `dry: false`.
  - Nothing in `events/`, `delist/`, `sold/` or `harness/protocol.ts` reads `dry`.
  - `events/policy.ts:10` sets `delist_after_sale: 'auto'`.
  - `delist.ts:42` (`if (env.ok || env.error.code === 'not_found')`) then marks the sibling listing delisted.
  - Result: after a confirmed sale, the other listings show as delisted while they are still buyable on the site. That is a double-sale risk, and the person is shown a false state.
  - The same path reports success for `post`, `send_message` and `answer_offer` jobs.
- **Smallest fix.** In `act()`, treat `data.dry === true` as `{ k: 'refused' }`, or raise a handoff decision ("finish this on Depop"). Add a pipeline test in which a dry adapter must not produce `arrived` or `delisted`.

### B2. Account deletion only signs the person out
- **Where.** `app/src/edge/api/me.ts:60-62`:
  ```
  async delete(c) { const r = job(c, 'delete_user', 'unlink_accounts', 'dl'); await store.dropUserSessions(c.user_id!); return r; }
  ```
- **How it fails.**
  - `job()` returns an example-shaped job id. No job runs.
  - No store rows, vault `token_ref`s or saved sign-in passwords are deleted, and nothing in Databricks is purged.
  - App Store Review Guideline 5.1.1(v) requires in-app deletion of the account and its data.
  - The export in `me.ts:63` is the same fake job, which matters for any access request.
- **Smallest fix.** Write a real `delete_user` engine in `runtime.ts` engines, the way `unlink` and `import` are written. It should:
  - unlink every account through the existing `DELETE /v1/accounts/:id` path, which deletes the vault token;
  - tombstone every row for the `user_id`;
  - enqueue a Databricks `DELETE ... WHERE user_id = :u` across the `sh_owner`-tagged tables.

  Return the real job id, and test that `GET /v1/me` returns 401 or 404 afterwards and that the rows are gone.

### B3. `app/app.json` and the client cannot produce a working iOS build
- **Where.** The missing pieces are in `app/app.json`, with the relative fetches in `app/src/app/dev/health.tsx:9` (`fetch('/v1/health')`) and `want.tsx:54` (`fetch('/v1/stage'…)`).
- **How it fails.**
  - `app.json` has no `ios.bundleIdentifier` and no `buildNumber`, so EAS cannot build.
  - It has no `ios.privacyManifests`, which App Store Connect requires for the required-reason APIs (UserDefaults, file timestamps), and no `ITSAppUsesNonExemptEncryption`.
  - There is no expo-router `origin`, so relative `fetch('/v1/...')` does not resolve in a native build.
  - There is no `app/eas.json`.
  - No client code sends an `Authorization` header or stores a session. No `expo-secure-store` was found.

  The camera and photo-library usage strings are present through the plugins.
- **Smallest fix.**
  - Add `ios.bundleIdentifier`, `ios.privacyManifests` with the reasons the bundled SDKs declare, `ios.config.usesNonExemptEncryption: false`, and the expo-router `origin` set to the deployed API host.
  - Add an `eas.json` with a `preview` profile.
  - Keep the session token in SecureStore and send it as a bearer through one fetch helper.

## High

### H1. The health route is public, unthrottled, and runs a warehouse query on every call
- **Where.** `app/src/app/v1/health+api.ts` calls `databricks.ts:22-29`, which runs `fetch(`${host}/api/2.0/sql/statements`…)` with the server's bearer token.
- **How it fails.** Anyone on the internet can keep the SQL warehouse awake and run up the spend. It also leaks whether the warehouse is reachable.
- **Smallest fix.** Have the public health check report only the process (`{ ok: true }`). Move the warehouse probe behind `auth: 'user'`, an operator check, or a cached result at most once a minute.

### H2. The visitor rate limit can be bypassed and its Map grows without bound
- **Where.** `app/src/edge/api/http.ts:99-106`. The limit of 30 a minute is keyed by the client-chosen `X-Visitor-Id`.
- **How it fails.**
  - Rotating the header resets the limit.
  - Every new id adds an entry to the in-memory `visits` Map, and nothing evicts entries, so memory grows until the process falls over.
  - Routes with `auth: 'none'` have no limit at all.
- **Smallest fix.** Key the limit by client IP (the platform's forwarded header) and by visitor id together. Prune entries older than the window on each check, and apply the IP limit to `none` routes too.

### H3. Email sign-in codes have no rate limit, and the code is never delivered
- **Where.** `app/src/edge/api/auth.ts`, the email start and verify handlers. `logSend` at line 247 is a no-op, and sessions live in `memoryStore` at line 249.
- **How it fails.**
  - Nothing limits code requests per address or per IP, so the endpoint can be used to bomb someone's inbox once sending is wired.
  - Nothing limits verify attempts, so a short code can be brute-forced.
  - Sessions are lost on every restart.
- **Smallest fix.**
  - Allow 5 starts per address per hour and 5 verify attempts per code, then burn the code.
  - Reuse the H2 IP limit.
  - Persist sessions in the Store.

## Medium

### M1. `accounts.byId` ignores the person
- **Where.** `app/src/edge/api/runtime.ts:66`: `async byId(id) { return (await accounts.linked()).find(row => row.account_id === id); }`.
- **How it fails.**
  - `linked()` with no person reads `systemRows`, which covers every tenant.
  - These callers pass a bare `account_id` with no person check:
    - `harness/protocol.ts:125`;
    - `browser/pool.ts:103` and `:169`;
    - `browser/auth.ts:40`;
    - `connect/signin.ts:91`;
    - `watcher.ts:383` and `:390`;
    - `schedule.ts:63-75`;
    - `post.ts:44`.
  - `handoff.ts:82` and `:139` do check the person.
  - Routes reach these paths only through `owned()` today, so this is not exploitable from outside yet. But one route or job that takes an `account_id` from input would drive another person's session. The fixed seed ids `acc_dp1`, `acc_eb1` and `acc_depop` make guessing trivial.
- **Smallest fix.** Change the signature to `byId(id, person_id)` and have it call `linked(person_id)`. `protocol.ts:123-129` should also compare `person_id`, not only `site`.

### M2. Example data is seeded into the production store, and the first real job takes a fixed id
- **Where.**
  - `runtime.ts:20-51`: `seedExamples` runs inside `createRuntime` for every store.
  - `accounts.ts:12`: `const job = !runtime.store.getJob(seed.id) ? runtime.store.updateJob(row.id, { id: seed.id }) : row;`.
- **How it fails.**
  - The `usr_8f2k` example tenant, along with its accounts, listings and decision `dec_lb1`, exists in every deployment.
  - The first real person's import or unlink job is renamed to the example job id, which is predictable.
  - `jobs.ts:23` exposes the example visitor job to every visitor.
- **Smallest fix.**
  - Seed only when `SECONDHAND_EXAMPLES=1` or in tests.
  - Drop the id rewrite in `accountJob`; the tests can read the returned id.

### M3. The raw email address is logged
- **Where.** `app/src/edge/api/auth.ts:218`: `log().call('tool','send_code',{ email: p.email },…)`.
- **How it fails.** Personal data goes into the log stream, which ships to `log_event`, and the handle mask (M8) does not cover it.
- **Smallest fix.** Log `{ email_domain }` or a salted hash.

### M4. A Google sign-in merges into an existing email identity
- **Where.** `app/src/edge/api/auth.ts:186-192`.
- **How it fails.** A Google token whose email matches an email-code account is attached to that account without the person proving they own the existing identity. Google verifies the address, so the residual risk is the "email_verified but not authoritative" case for non-Gmail domains.
- **Smallest fix.**
  - Merge only when `email_verified` is true and the domain is Google-hosted (`hd`, or a gmail.com address).
  - Otherwise ask for the email code before linking.

### M5. Marketplace sessions live only in process memory
- **Where.** `runtime.ts:55-56`: `// shortcut: session state is process-local …` and `const vault = memoryVault();`.
- **How it fails.**
  - Every restart or second instance drops every linked account, and `linked()` then filters them out. The people affected see "relink" for no reason.
  - This is labelled as a shortcut, but it is not ready for real people.
- **Smallest fix.** Land the Databricks secret-scope vault named in the comment before TestFlight, or pin one instance and say so in the test notes.

### M6. The push token is stored as-is
- **Where.** `app/src/edge/api/me.ts:48`: `next_.push_token_ref = b.push_token; // shortcut: the token is kept as-is`.
- **How it fails.** It is a device identifier in a plain store row. The field name says "ref", but the value is the token itself.
- **Smallest fix.** Put the token in the vault and keep only the reference.

### M7. `/v1/stage` is unauthenticated and returns a file from the server's disk
- **Where.** `app/src/app/v1/stage+api.ts`: `process.env.STAGE_ALERTS ?? '../logs/stage-alerts.json'`.
- **How it fails.** Anyone can read internal alert state, and the path is relative to the working directory.
- **Smallest fix.**
  - Put the route behind `auth: 'user'` plus an operator check, or only register it when not in production.
  - Resolve the path from a fixed root.

### M8. Only handles are masked in Databricks; payloads and message text are not
- **Where.**
  - `databricks/sql/02_governance.sql:43-44` tags only `seller_handle` and `buyer_handle` as `sh_personal`.
  - `databricks/sql/01_tables.sql:23` reads `payload STRING COMMENT 'JSON payload as read.'`.
- **How it fails.** Message text, offer notes and `log_event` payloads can carry buyer names, addresses or emails (see M3), and anyone mapped to the owning user sees them in full.
- **Smallest fix.** Tag `payload` and the message body columns `sh_personal`, with a mask that redacts them unless the reader is in the support group, or strip PII at write time with the existing `checkOperationEnvelope` scanner.

### M9. `principal_map` has no grants, so a wildcard can be self-granted without the audit
- **Where.**
  - `databricks/sql/02_governance.sql:24`: `RETURN row_user_id IS NULL OR EXISTS (… m.user_id = row_user_id OR m.user_id = '*')`.
  - There are no `GRANT` or `REVOKE` statements anywhere in `databricks/sql`.
- **How it fails.**
  - Any principal with MODIFY on `secondhand.governance` can run `INSERT INTO principal_map VALUES (current_user(), '*')` and read every person's rows.
  - The audit row is written only when `databricks/break_glass.py:21-23` is used, so the break-glass rule depends on people choosing to use the helper.
- **Smallest fix.**
  - `REVOKE MODIFY ON SCHEMA secondhand.governance FROM \`account users\``, and grant MODIFY only to one maintenance service principal.
  - Put the wildcard insert behind a SQL function owned by that principal, which writes the `break_glass` row in the same statement.

### M10. The secret scope has no ACL in tracked config
- **Where.** `deploy/databricks.yml:28-33` declares `secret_scopes.vault` with no `permissions`.
- **How it fails.** The gitignored bundle state shows MANAGE ACLs, so the real ACL lives only in deployed state. A fresh deploy from the repo cannot be checked or reproduced.
- **Smallest fix.** Add `permissions:` to the scope in the bundle, with READ for the app's service principal only and MANAGE for one admin.

### M11. The request boundary has no schema validation
- **Where.** `app/src/edge/api/http.ts:147-150` checks `requireFields` only. The per-route `fields(...)` helpers in `captures.ts` check types, but not every route calls them.
- **How it fails.** This breaches the project's TypeScript rule "Zod (or equivalent) at every system boundary". Unchecked bodies flow into `store.put` spreads (for example `{ ...current, ...connected }`).
- **Smallest fix.** Make `fields()` mandatory in `route()`: a route without a declared body shape rejects any body.

### M12. The Poshmark CDP websocket URL skips the scheme check
- **Where.** `app/src/edge/harness/sites/poshmark/live.ts:31-33` takes `webSocketDebuggerUrl` from `/json/version` and connects to it directly.
- **How it fails.** `browser/cdp.ts:145-157` checks the scheme and host of a configured URL, but the resolved URL is never checked. A rogue or misconfigured endpoint could redirect the browser control to another host.
- **Smallest fix.** Pass the resolved URL through the same `cdp.ts` check.

### M13. `.gitignore` leaves session and data files open to a commit
- **Where.** `.gitignore` covers `.databricks/` (line 19), but not:
  - `.env*`;
  - `*.pem`;
  - Playwright `storageState` or cookie JSON;
  - the `SECONDHAND_DATA_DIR` store file, which `events/file-store.ts:44-48` writes as plain JSON of every person's rows.
- **How it fails.** One `git add .` in a shared checkout publishes personal data or sessions to a public repo.
- **Smallest fix.** Add `.env*`, `*.pem`, `**/storage-state*.json`, `**/cookies*.json` and the default data dir. Consider a check in `.agents/checks/secrets` that fails when such files are tracked.

## Low and hygiene

- **L1.** `http.ts:79`: `X-Request-Id` is echoed and used as `event_id` and `idempotency_key` with no length or charset check. Fix: accept `^[A-Za-z0-9_-]{1,64}$` and otherwise generate one.
- **L2.** `jobs.ts:20`: the SSE frame log is unbounded. Fix: cap it per job.
- **L3.** `buy.ts:22`: the `clicks` array grows without bound. `buy.ts:14` has `referral: { programme: 'example', … }`; that is fine as a placeholder, but it must not ship as a claim. Fix: cap the array, and gate the referral block off until a programme exists.
- **L4.** `pipeline.ts:92`: `decisions({kind:'relink', subject: acc, state:'open'})` has no `user_id`. It is harmless while account ids are unique, but it is cross-tenant by shape. Fix: add `user_id: j.user_id`.
- **L5.** `today.ts:44`: the expiry sweep runs across every tenant on a person's read. Fix: scope it to `ctx.user_id`, or move it to a job.
- **L6.** `api/conversations.ts:21` and `:71` hard-code `usr_8f2k` and `acc_depop`. Fix: read from `ctx` and `owned()`.
- **L7.** `app.json` has `"owner": "ngarelik"` and the EAS `projectId` in a public repo. Neither is a secret; this is informational.
- **L8.** `02_governance.sql:29`: `mask_handle` keeps the first letter (`concat(left(handle, 1), '***')`). That is fine for handles, and is noted only so nobody reuses it for emails.

## Confirmed safe

**Captchas are never solved.**
- `browser/cdp.ts:113` sets `solveCaptchas: false`, asserted in `browser/pool.test.ts:207`.
- The Depop client classifies a challenge page as blocked (`runtime.ts:75`).

**The live view stays server-side.**
- `cdp.ts:56` keeps the vendor live URL on the server and gives the client an opaque token.
- `handoff.ts:136-142` checks the person before serving it.
- `handoff.ts:72` and `:119` never log vendor text.

**The session pool.**
- It masks errors (`pool.ts:158`).
- It logs only `linked` or `public` (`pool.ts:161`).
- It never empties cookies (`pool.ts:136`).
- It closes every context on shutdown (`pool.ts:195-199`).

**Saved passwords.**
- `connect/password.ts:22` refuses eBay.
- `:31` allows only `SIGN_IN_IDENTITY`.
- `:32` reads only when the session has expired.
- `:38` drops the thrown message.
- `:41` sends any second factor to the person.

**A delist needs a confirmed sale.**
- `delist.ts:25` has `if (!s.confirmed) return { refused: 'not_confirmed' }`.
- `delist.ts:27` excludes the sold listing and fans out only to buyable ones.
- The dedupe key `delist:<id>` stops repeats.
- `delist.ts:46` pauses on `auth_expired`.
- B1 still applies to what "done" means.

**The policy floor holds.**
- `runtime.ts:125` takes the max of the item limit and every auto rule's floor.
- `runtime.ts:129` keeps the ask modes (`ask_every_time`, `markdown_on: false`, `accept_mode: 'ask_all'`) for anything the person did not do themselves.

**Writes are dry unless allowed.**
- The site adapters and handlers return dry plans by default:
  - `post.ts:48`;
  - `messages.ts:89` and `:126`;
  - `store/store.ts:54`;
  - `handoff.ts:86`;
  - `connect/signin.ts:93`.
- Poshmark (`adapter.ts:219-292`) returns plans only, so share, like and repost hand the page to the person. Relist is refused when the account is penalized (`:282`).
- Depop (`adapter.ts:228-327`) stops before the submit, and `dry: false` gives `fail('no_route', … { do: 'handoff' })`.
- No real submit exists anywhere. B1 is about how the pipeline reads these plans.

**Route tenancy.**
- `owned()` (`runtime.ts:144-148`) scopes every by-id read to `ctx.user_id`.
- `publicRow` (`:152-155`) strips `token_ref`, `user_id` and the internal fields.
- `me.ts:12-16` allowlists the editable fields.
- `jobs.ts:59` and `:142` are owner-scoped.
- The import engine checks the account (`runtime.ts:104-105`).

**Account links.**
- Unlinking deletes the vault token (`accounts.ts:79-84`).
- A reconnect deletes the old token (`accounts.ts:51`).
- The harness listing response is validated before it is stored (`accounts.ts:21`).

**Auth.**
- An empty Google audience fails closed (`auth.ts:125-127`).
- Linking refuses an identity owned by another user (`auth.ts:232-233`).

**Outbound links.** `/v1/out` in `buy.ts` redirects only to a fixed list.

**Store envelope.** `checkOperationEnvelope` throws on secret or PII keys in an operation record.

**Databricks.**
- The row filter applies to `account users` on every `sh_owner`-tagged table (`02_governance.sql:46-49`), and it is installed before the direct filters are dropped (`:56`).
- `break_glass.py:25-28` removes the wildcard in `finally`.
- `databricks.ts:9-17` takes the token from the environment or the CLI and never writes it.
- The bundle state is gitignored.

**Legal posture.** The code claims no partner programme. `business.md:61` and `feature-breakdown.md:298` both say the Depop partner programme is "not joined".

## Not checked

- `intel/`: `jev.ts`, extract, answer and fetch. Not checked: SSRF on fetched URLs, prompt injection from listing and message text, model output reaching a write, and what is logged from model calls.
- Message drafting, for injection from buyer messages into drafts.
- The never-automated rules in `negotiation/policy.ts` for address, payment, refund, off-site deals and purchases. They were only read past, not traced.
- The person check on `connect/signin.ts:140` (`live_url`).
- Retention jobs against the `retention_class` tags, and any Databricks purge path beyond B2.
- Children's data and age gating. No age gate was found, but the sign-up flow was not traced.
- Transport (ATS exceptions, pinning) and the deployed API host.
- `research/`, `scripts/` and `probes/`, beyond the regex sweep for secrets and emails.
