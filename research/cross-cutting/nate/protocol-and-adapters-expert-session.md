# Protocol and adapters engine: expert session
Researched 2026-11-14 by Nate (session ex-hp).

Status: *agent proposal*, research note for Nate. Written 2026-11-14 by session `ex-hp`. Read against [engines/protocol-and-adapters](../../../spec/engines/protocol-and-adapters.md) (all of it; §1 is "what it decides"), [product.md, The harness protocol](../../../spec/product.md#the-harness-protocol) and [protocol.ts](../../../app/src/edge/harness/protocol.ts).

The view taken: a staff engineer who has run browser-automation and scraping infrastructure at scale (the Browserbase, browser-use cloud, Apify or Playwright kind of team). Marks: *observed* (read in the source linked, or run), *asserted* (a source or my memory says it, not checked here), *inferred* (my reasoning from the sources). Fixed constraints, not reopened: no forged fingerprint, no challenge solver, no bot check solved or routed around, no browser vendor in the route table, nothing acts on a live account.

The direction under test (cofounder, tonight): every app action and search is dispatched at once to its own background hosted browser session, several in parallel, in real time, on browser-use and jev patterns, with a warm pool that removes the cold start and is measured.

Draft answer from memory before searching: a context per account in a shared browser is cheap, a persistent profile needs a browser process per profile, warm pools are for browsers and not for logged-in state, and "every action gets its own session" collides with one-account-one-lease. Search changed one thing: Playwright's persistent context is a whole browser (see 2.1), which is stronger than I held.

## 1. Where the engine doc and the code disagree with the direction today

- **The doc names a vendor in §3.1 and bans it in §3.8.** §3.1 opens "A Browser Use cloud profile per (person, site)"; §3.8 and product.md's Session row say hosted by us, no browser vendor (*observed*, [engine §3.1](../../../spec/engines/protocol-and-adapters.md#31-sessions) versus [engine §3.8](../../../spec/engines/protocol-and-adapters.md#38-our-own-api-run-in-the-cloud-what-we-take-from-apify-agent-proposal)). The later direction wins; §3.1 is stale.
- **browser-use's cloud is what we may not copy.** Its README advertises "stealth, CAPTCHA solving and residential proxies" ([browser-use README](https://raw.githubusercontent.com/browser-use/browser-use/main/README.md), *observed*). We take its session, profile and CDP shape only, never those three (*inferred*, from the fixed constraints).
- **"Every action at once to its own session" against the lease.** §3.1 allows one job per account session at a time, a 2 to 5 s step pace with jitter, and one steady IP per account (*observed*, [engine §3.1](../../../spec/engines/protocol-and-adapters.md#31-sessions)). Parallel across accounts and across sites is free; parallel inside one account is forbidden by our own rules. The honest reading of "several in parallel" is: many leases at once, one per account (*inferred*).
- **A pool timeout is mislabelled in code.** `runOne` maps a non-write timeout to `rate_limited` with `after_s: 30`, and a thrown adapter to `page_changed` (*observed*, protocol.ts lines 139 to 152). With a browser pool, a cold start that overruns 20 s, or a crashed browser, would read as "the site slowed us" (which lowers the pace) or "the page changed" (which starts `adapter_author`). Both are wrong causes: the pace would fall and a repair would start for a fault of ours (*inferred*).
- **`meta.ms` hides the cold start.** `meta` is `{route_id, adapter_version, ms, fell_back, observation_ids}` (*observed*, protocol.ts line 48). One number cannot tell cold from warm.

## 2. (a) Everything the engine must determine, checked against §1

§1 decides five outputs: the call result, the route, an adapter release, route health, a repair (*observed*, [engine §1](../../../spec/engines/protocol-and-adapters.md#1-what-it-decides)). For a hosted pool, these are not decided anywhere in the doc. Each row is a missing determination.

| # | Determination | What it fixes | In §1 or elsewhere in the doc? |
|---|---|---|---|
| P1 | Isolation unit: a browser process per account, or a context per account in a shared browser | blast radius of a crash, memory, whether a profile survives a restart | not decided; §3.1 says "saved browser profile" and §5 "leased cloud browser per active account" (*observed*), which implies a browser per account without saying so |
| P2 | Profile persistence: where the profile lives, what is saved (cookies, local storage, IndexedDB), who may read it, how it moves between hosts | login survives a restart and a host move | not decided; tokens "stay in the cloud profile" (§8) only |
| P3 | Warm pool: which state is kept warm (a bare browser, a launched profile, a logged-in page), pool size per host, eviction | the cold start the cofounder wants gone | §5 has one line: kept open 10 min after the last job; no size, no eviction |
| P4 | Dispatch model: how a call reaches a session, queue per account, fan-out limits | "several in parallel, in real time" | the lease only (§3.1); no queue, no wait budget |
| P5 | Per-host and per-IP concurrency caps | the address a site sees; CPU and memory of one machine | none |
| P6 | Crash and hang recovery: detect, kill, relaunch, resume, and what a write in flight becomes | lease leaks, duplicate posts | `outcome_unknown` covers a timed-out write (code); nothing covers the lease or the browser |
| P7 | Infrastructure failures in the error model: a pool fault is neither `rate_limited` nor `page_changed` | wrong pace, wrong repair | not decided; code maps both wrongly (section 1) |
| P8 | The cold-versus-warm measurement: what is timed, at which stage, how it is tested without a live account | whether the pool did its job | §5 has budgets; §9 has no pool test |
| P9 | Session-state handling on the move between phone and cloud ("may be asked to verify once", §3.8) | when a challenge is expected and must not be retried | stated as a limit only |
| P10 | Who owns the login step in a hosted browser: how the person sees and drives it, how the profile is saved at the end | linking works at all | "inside the cloud browser" (§3.1); the transport (live view, remote debugging) is not named |
| P11 | Pool health as `param` rows: acquire time, start failure rate, crash rate per host | router and ops see the pool | §1 route health covers site routes only |
| P12 | Idle and TTL numbers: lease TTL, keep-open time, quiet-hours behaviour | a crashed worker's lease frees on time | lease "with a TTL" and "10 min" with no relation between them |

## 3. (b) The best method for each, with sources

### 3.1 Isolation: context versus browser (P1)

- Playwright contexts are "equivalent to incognito-like profiles. They are fast and cheap to create and are completely isolated, even when running in a single browser" ([browser-contexts](https://raw.githubusercontent.com/microsoft/playwright/main/docs/src/browser-contexts.md), *observed*). They isolate cookies, local storage and session storage (same source).
- `launchPersistentContext(userDataDir)` "returns the only context. Closing this context will automatically close the browser" ([BrowserType](https://raw.githubusercontent.com/microsoft/playwright/main/docs/src/api/class-browsertype.md), *observed*). So a real on-disk profile is one browser process per profile. A context in a shared browser has no disk profile; its state must be exported and restored (`storageState`).
- `storageState` leaves out IndexedDB unless `indexedDB: true` is passed ([auth](https://raw.githubusercontent.com/microsoft/playwright/main/docs/src/auth.md), *observed*). A site that keeps its tokens in IndexedDB would log out on restore without it (*inferred*).
- The trade (*inferred* from the three sources):

| | Browser per account (persistent profile) | Context per account (shared browser, `storageState`) |
|---|---|---|
| Disk profile, survives a crash as the browser saved it | yes | no; state is whatever was last exported |
| Fault isolation | a crash takes one account | a crash takes every context in that browser |
| Memory | a full browser each | shared engine, less per account |
| Start | slower (process launch) | cheap |
| Fingerprint and IP separation | natural, one process, one proxy | per-context proxy is possible, one browser identity shared |
- Method to use: a persistent profile per account as the unit of record, because the engine's promise is "one persistent profile and one steady IP per linked account" (task brief, [engine §3.8](../../../spec/engines/protocol-and-adapters.md#38-our-own-api-run-in-the-cloud-what-we-take-from-apify-agent-proposal)); use contexts only for public reads and recon sandboxes with no login (*inferred*). A public read needs no profile, so it should never take an account's browser (*inferred*).
- Playwright warns that Chrome's main profile cannot be automated, and to use a separate `userDataDir` ([BrowserType](https://raw.githubusercontent.com/microsoft/playwright/main/docs/src/api/class-browsertype.md), *observed*). Chrome's own post says the debugging switches must now go with `--user-data-dir` ([Chrome, remote debugging](https://developer.chrome.com/blog/remote-debugging-port), *observed* in the fetched text; the full rule was not read). Use a dedicated directory per account, never a shared default (*inferred*).

### 3.2 CDP connect and the pool process model (P3, P4)

- `connectOverCDP` attaches to an existing browser, Chromium only, and "is significantly lower fidelity than the Playwright protocol connection"; Playwright also warns that a browser launched without its curated arguments may break some features ([BrowserType](https://raw.githubusercontent.com/microsoft/playwright/main/docs/src/api/class-browsertype.md), *observed*).
- The model that follows (*inferred*): the pool worker launches the browser with Playwright's own launch (so the curated arguments apply) and keeps it in-process; a separate "browser server" that others attach to over CDP is a second hop with lower fidelity and one more thing to authenticate.
- browser-use 1.0: "The model, a REPL and CDP. That's the whole agent." The agent writes Python against raw CDP in a persistent REPL ([README](https://raw.githubusercontent.com/browser-use/browser-use/main/README.md), *observed*). Its `Browser('chromium', user_data_dir=...)` keeps logins between runs; `Browser(cloud_profile_id=...)` keeps them in a cloud profile (same README, *observed*). The pattern to take is a session object with a named, persistent profile and a CDP endpoint; the model is outside the pool.
- Security note from the same README: a local browser opens a debugging port with no authentication on 127.0.0.1, and on a shared machine other local users can attach to its logins (*observed*). In a shared pool host this applies to every account on it. Bind each profile's debug port to a socket only its worker can reach, or skip the port and drive in-process (*inferred*).
- opencli's own sessions: a Browser Bridge extension in the person's Chrome plus a local daemon; "Each Chrome profile runs its own OpenCLI extension instance"; owned tabs idle out and "Bound tabs and persistent adapter sessions ignore idle timeouts"; it also takes `OPENCLI_CDP_ENDPOINT` for remote browsers ([opencli README](https://raw.githubusercontent.com/jackwener/opencli/main/README.md), *observed*). Take: sessions have an owner, an idle timeout and an explicit release. Do not take: the person's Chrome as the pool, since our hosted route is ours.
- Pool states, from cheap to expensive (*inferred*): (1) a launched headless browser with no profile; (2) a launched browser on the account's profile, page closed; (3) the same with the site's home page loaded and the login confirmed. A "warm" pool that holds state 1 only removes process launch; it does not remove profile load, login check or the first navigation. State 2 or 3 per active account is what the 10-minute keep-open in §5 already is. The unspecified part is how many accounts are held at once (see 3.4).

### 3.3 Dispatch and parallel limits (P4, P5)

- Two limits exist and they are different (*inferred*): (i) machine limit, how many browsers one host can hold, set by memory (3.4); (ii) site limit, how many accounts and actions touch one site from one address at once. The doc has the second only as a per-account token bucket.
- Method: a queue per account with a wait budget; the lease row is the queue head. A call that finds the lease busy waits up to its budget, then returns a clear busy answer (the doc says 409 for replay; the harness has no code for it, *observed* by the eight codes in protocol.ts). Dispatch across accounts runs at once, capped by a global semaphore per host and a second per site (*inferred*).
- Public reads (search, market reads) run on plain requests with no browser, as §3.8 already says; sending them to a browser session would spend the pool on work that needs none (*observed* for the doc's rule, [engine §3.8](../../../spec/engines/protocol-and-adapters.md#38-our-own-api-run-in-the-cloud-what-we-take-from-apify-agent-proposal); the cost consequence is *inferred*).
- A site's request limit is a fact to record, not a number to guess. The doc has one: Depop's "200 per 10 s create limit" ([product.md site table](../../../spec/product.md#the-harness-protocol), *asserted* there). It is an API limit; the web path's limit is not found.
- Per-host cap for one site's IPs: not found in any source read. It has to be measured with the pace bench (§3.7 proof in the engine doc, *observed*) on the test account, not set from a vendor's advice (*inferred*).

### 3.4 Memory per context and pool sizing (P1, P3)

- Measured evidence found: Playwright with Chromium peaked at 874 MB (standard), 826 MB (headless) and 770 MB (minimal flags) in one Python run, with the Python driver counted ([Playwright browser footprint](https://datawookie.dev/blog/2025/06/playwright-browser-footprint/), *observed*, one person's run, one page, one machine). It is a ceiling for one browser doing one page, not a per-account steady-state number.
- Per-context memory: not found as a measurement. A blog says a context costs kilobytes and a headless boot 50 to 150 MB, with no source or method (DEV post, *asserted*, found by search, not opened). Do not size from either figure.
- Sizing method (*inferred*): measure resident set per browser at three points on the real adapters (after launch, after the site's home loads signed-in, after a 20-minute read loop), take the p95, and set `max_warm = floor(0.7 x host RAM / p95)`. The 0.7 leaves room for spikes and the OS; treat it as a starting guess, not a sourced figure. Active accounts are not the same as linked accounts: an account with no hot window can be state 1 or stopped, and its profile stays on disk.
- Because the watchers run on tiers (1 to 2 min hot, 15 min live, hourly quiet; [engine §3.6](../../../spec/engines/protocol-and-adapters.md#36-how-every-event-reaches-the-system-agent-proposal)), only the hot tier needs a resident browser. The live and quiet tiers can start a browser from profile for a sweep and close it, if the measured cold start (3.6) fits the sweep's budget (*inferred*).

### 3.5 Profile persistence and crash recovery (P2, P6, P12)

- Persistent profile: a directory per account on the worker's disk; Playwright launches against it and a clean close flushes it ([BrowserType](https://raw.githubusercontent.com/microsoft/playwright/main/docs/src/api/class-browsertype.md), *observed* for the launch and the close; the flush behaviour is *asserted*).
- Single-writer rule: Chromium refuses a second process on one profile directory (a `SingletonLock`, *asserted* from memory, not opened in this session). Our lease is the app-level version of that; the file lock is the last guard. A relaunch after a crash may find a stale lock file and must clear it only when the old process is confirmed gone (*inferred*).
- Moving a profile between hosts: a profile directory is large and holds more than login. Two options (*inferred*): pin an account to a host (simple, loses the account if the host dies) or keep a small exported state (`storageState` with `indexedDB: true`, [auth](https://raw.githubusercontent.com/microsoft/playwright/main/docs/src/auth.md), *observed*) as a backup that can re-seed a fresh profile on another host. The second means a re-seeded session may meet a re-verify (§3.8 limit, *observed*), so it is a recovery path, not a normal move.
- Stored state is a credential. It must sit encrypted at rest and be readable only by the pool worker, matching how §3.7 treats saved passwords (*observed* for the doc's rule; extension to profile files *inferred*).
- Crash recovery, in order (*inferred*): heartbeat on each lease; a worker that misses it loses the lease at TTL; the supervisor kills any leftover browser process for that profile; clear the stale lock; relaunch; the call that was running is classified by verb. A read retries once on the fresh session and is never counted against the site. A write goes to `outcome_unknown` and reconcile (as protocol.ts already does for a timeout, *observed*), because the site may have received it.
- Lease TTL must exceed the longest write (budget p95 20 s, §5) plus its read-back, and must be shorter than the 10-minute keep-open (*inferred* from [engine §5](../../../spec/engines/protocol-and-adapters.md#5-speed)); the doc gives neither the TTL nor this relation.

### 3.6 Measuring cold versus warm dispatch (P8)

Published numbers, for calibration only (all vendor or single-author, none independent):
- Steel's own benchmark of a full create, connect, goto, release cycle on google.com from AWS us-east-1: Steel median 867 ms, p95 1,090 ms; Kernel median 1,485 ms; Browserbase median 1,669 ms ([Steel remote-browser benchmark](https://steel.dev/blog/remote-browser-benchmark), *observed* in the fetched page; *asserted* as to fairness, since Steel ran it). It is a cold lifecycle with one navigation to a public page, and it excludes login and multi-step work (the page's own caveat).
- A same-binary local run: about 476 ms for cold launch plus workflow against about 218 ms for a reused browser with a new context and page, Playwright 1.62.1 on Chrome for Testing 149 (search result summary of a DEV post, *asserted*, the table layout was ambiguous and I did not open the post).
- A third-party claim that warm pools keep session creation under 2 s while cold-booting Chrome takes 6 to 8 s (*asserted*, blog, not opened).
- Our own number does not exist yet. These differ by an order of magnitude on setup, so none is a target (*inferred*).

The method (*inferred*; no source gives a Secondhand-specific one):
1. **Name the stages and time each**, in the pool and the call path: `queue_ms` (waiting for a lease), `acquire_ms` (getting a ready session), `launch_ms` (process start, only if cold), `profile_ms` (profile load and login check), `nav_ms` (first navigation), `verb_ms` (the adapter's own steps), `readback_ms`. The envelope's `meta.ms` is the sum and stays; the parts go on `route_call`.
2. **Tag every call with `start_state`**: `cold` (browser launched for this call), `resumed` (browser up, profile loaded, page closed), `warm` (page loaded, login confirmed). Without the tag, the pool's effect cannot be read off the data.
3. **Test on the fake site and the test account only.** The fake adapter in protocol.ts has modes for ok, throw and hang (*observed*), so queue and crash behaviour can be proven with no site traffic. Cold, resumed and warm timing against a real site runs only on the test account, never a linked person's.
4. **Paired design.** Alternate cold and warm on the same account and verb, in random order, 30 or more pairs each, same host, same time of day; report median, p95 and p99 per stage, not only the total, with the exact browser build and host. A p95 comes from a count; with fewer than 20 calls it is not stable, so state n.
5. **Separate the controls.** A cold start in the middle of a rate-limited window must not be scored as a slow cold start: log `rate_limited` and `blocked` outcomes separately, and drop the paused ones from the timing set.
6. **Done means numbers a reader can check**: a run file holding raw per-call stage times, host RAM and build, and a one-page table. The pool passes when warm `acquire_ms` p95 is under a budget the team sets from the §5 read target (p95 1.5 s for an endpoint read, *observed* in the engine doc); the budget for `acquire_ms` itself is not given and is not set here.

### 3.7 Errors from the pool (P7)

- The eight codes are canon and fixed in the type (*observed*, protocol.ts line 17). Pool faults cannot add a ninth without a canon change (*inferred*). Proposed handling inside the eight: a start failure or crash is retried once on a fresh session, off the books; if it still fails it is returned as `no_route` with a handoff for a read (the route could not be served), or `outcome_unknown` for a write that may have landed. It does not touch `rate_limited` pace or the repair trigger. Whether a ninth code is cleaner is the operator's call.
- opencli maps a bridge-down state to its own exit code `69` and timeout to `75` ([opencli README exit codes](https://raw.githubusercontent.com/jackwener/opencli/main/README.md), *observed*), which keeps "our tooling is down" apart from "the site failed". The engine's table lists opencli equivalents for each code but none for the bridge-down class (*observed*, engine §1).

## 4. (c) What the engine doc misses

1. **No pool section.** Sessions are leases and a pace; nothing on how a browser comes to exist. §5's "kept open 10 min" is the only warm-state rule, and it has no size or eviction (*observed*).
2. **The isolation unit is implied, not chosen.** Persistent profile plus steady IP per account implies a browser per account (3.1), which sets the memory bill. The doc never says it.
3. **Parallelism is read two ways.** The direction says each action goes to its own session. The doc's lease says one job per account. Only the second is safe for an account (section 1).
4. **No measurement of the cold start.** §9 has twelve tests and none of them times acquisition; §5 budgets are end to end.
5. **Pool faults reach the repair and pace logic as site faults.** In code, a timeout becomes `rate_limited` and a throw becomes `page_changed` (section 1). The doc's own "never start a repair for `rate_limited`" rule would be silently bypassed by the second.
6. **Lease crash cases.** A lease with a TTL is named; what happens to a half-run write when the TTL fires is only covered for a timeout in code, not a worker kill (*inferred*).
7. **§3.1 names a vendor.** Section 1 above.
8. **Profile files are credentials.** §8 covers cookies in logs and fixtures; the profile directory on disk, its backup and its host move are not covered.
9. **Debugging port exposure** on a shared pool host (section 3.2), not in §8.
10. **The cofounder's "real time" has no target.** §5 gives read, write and delist budgets; none says how fast a user-triggered action must start. A target is the operator's call.
11. **Per-site concurrency is unmeasured**, and the only rate figure in the doc is an API limit for Depop (3.3).
12. **Retry and idempotency at the pool level.** A pool that retries a start must never retry a write step; the doc states the rule for the call, not for the layer under it (*inferred*).

## 5. Top findings for the browser pool

1. A persistent profile means a browser process per account; contexts do not give a disk profile (3.1, *observed*).
2. Warm state has three levels; the pool sets which one is held for whom (3.2).
3. Parallel means many accounts at once, one lease each; not many sessions on one account (section 1).
4. Pool faults must not be reported as `rate_limited` or `page_changed` (3.7).
5. Timing must be recorded per stage with a `start_state` tag, or the pool cannot be judged (3.6).
6. Public reads should skip the pool (3.3).
7. Profile directories are credentials and need the saved-password treatment (3.5).
8. Pool size comes from measured resident memory at the p95, not from a published figure (3.4).
9. The debug port is an open door on a shared host unless bound to its worker (3.2, *observed*).
10. Lease TTL, heartbeat and the 10-minute keep-open need a stated order (3.5).

## 6. Diff list against the engine doc

None of these edits the engine doc; each is a proposed change for its owner.

- *agent proposal* §3.1: replace "A Browser Use cloud profile per (person, site)" with "a hosted headless browser per (person, site) on our own compute, one persistent profile directory and one steady IP", matching §3.8.
- *agent proposal* §3.1 Lease: add a heartbeat and state `lease TTL > write p95 plus read-back` and `lease TTL < keep-open`; add a supervisor step that kills the profile's leftover browser and clears the stale profile lock before a relaunch.
- *agent proposal* new §3.9 "The browser pool": the isolation unit (a browser per account for signed-in work, contexts for public reads and recon sandboxes), the three warm states, max warm per host from measured p95 resident memory, eviction by last-job time and hot-window membership, a global per-host semaphore and a per-site semaphore, a queue per account with a wait budget.
- *agent proposal* §3.1 Dispatch: state that parallel dispatch means one lease per account at once, and that two jobs on one account queue, not parallelise.
- *agent proposal* §1 error table: add a row stating that a pool or browser fault is retried once on a fresh session off the books, then returns `no_route` (read) or `outcome_unknown` (write), never `rate_limited` or `page_changed`; leave the question of a ninth code to the operator.
- *agent proposal* §5: add `acquire_ms` rows for cold, resumed and warm starts, with the budget to be set from measurement.
- *agent proposal* §9: add two tests, a pool test on the fake site (kill the browser mid-read: one retry, no repair; kill mid-write: `outcome_unknown`, zero duplicates) and a cold-versus-warm timing run on the test account with the paired method in 3.6.
- *agent proposal* §2 or §4: add `param` rows for pool health per host (acquire p95, start failure rate, crash rate), read by ops and by the router.
- *agent proposal* §8: add that profile directories and exported `storageState` are encrypted at rest and readable by the pool worker only, and that debug ports bind to the worker, never a shared interface.
- *agent proposal* §3.8 route table: say that public reads and search never take a browser session.
- *agent proposal* §10: add a task 7 (pool and supervisor, `app/src/edge/harness/pool.ts`, depends on 2) and a task 8 (the stage-timing recorder and the bench, depends on 7).
- *agent proposal* protocol.ts (for its owner): `runOne` maps a timeout to `rate_limited` and a throw to `page_changed`; both need a pool-fault path before a pool exists.

## Not found

- A per-context memory measurement for Chromium under signed-in marketplace pages: not found (a blog gives kilobytes with no method).
- Per-site concurrent-session limits for eBay, Facebook, Depop, Poshmark or Mercari web paths: not found.
- An independent cold-versus-warm benchmark for self-hosted Chrome with a persistent profile: not found; Steel's is a vendor's own.
- Chrome's headless documentation: the fetch returned no usable text, so no claim here rests on it. The SingletonLock behaviour is from memory, not opened.
- browser-use's `profile.py` and `session.py` on main returned empty files (the library was restructured for 1.0), so its crash and reconnect behaviour was not read.
- Apify's browser start times: the search returned none.

## Sources fetched

- https://raw.githubusercontent.com/microsoft/playwright/main/docs/src/browser-contexts.md
- https://raw.githubusercontent.com/microsoft/playwright/main/docs/src/api/class-browsertype.md
- https://raw.githubusercontent.com/microsoft/playwright/main/docs/src/auth.md
- https://raw.githubusercontent.com/browser-use/browser-use/main/README.md
- https://raw.githubusercontent.com/jackwener/opencli/main/README.md
- https://developer.chrome.com/blog/remote-debugging-port (partial text only)
- https://steel.dev/blog/remote-browser-benchmark
- https://datawookie.dev/blog/2025/06/playwright-browser-footprint/
- Search only, not opened: the DEV Community posts on contexts versus instances and a Chromium cold-run benchmark; Browserbase warm-pool claims; Hyperbrowser's page.
- In the repo: spec/engines/protocol-and-adapters.md, spec/product.md (The harness protocol), app/src/edge/harness/protocol.ts, scripts/prove.mjs, .agents/skills/research-note/SKILL.md.
