Status: *agent proposal*, a second-round audit asked for by Nate on 2026-11-15; nothing here is decided.

# Production readiness: from today's `main` to a TestFlight build a handful of people use

Lens: Nate's "Get everything fully production ready and prepared" and "We will prepare, rigorously and accurately on mac test to prepare for testflight in hands development". Read-only audit: no build, test, server or simulator was run, and `node .agents/check.mjs` was not run; the red state of the check is taken from the brief and [board.md](../../board.md). Owners: "Ben (app)" and "Nate (backend)" follow [words.md](../../../../product/words.md) "Ben has given him the backend"; where the owner is a choice, it is listed under decisions. Platform facts cite the page they were read from on 2026-11-15.

## Verdict

An internal TestFlight build of today's app is about a day away. The steps are a bundle id, an `eas.json`, an export-compliance flag and a privacy manifest. What ships, though, is the demo: 17 screens import `app/src/demo/`, sign-in is faked on the client, and the only two `fetch` calls use relative paths that a native build cannot resolve. Before ten real people can rely on it, the native app needs an API client and a base URL, real Apple sign-in, an auth store that survives a restart, an email sender, a job runner, and account deletion that actually deletes. The server cannot run on EAS Hosting, so it belongs on one Node container with a persistent volume.

## The shortest honest path to a TestFlight build

Ordered. Steps 1 to 12 give an internal-tester build of the demo; steps 13 to 18 make that build talk to a running backend.

| # | Step | Owner | Command or change | Source |
|---|---|---|---|---|
| 1 | Apple Developer Program membership. An organization needs a D-U-N-S number and verification, so start now; an individual account is faster. | Nate or Ben (decision 1) | developer.apple.com/programs/enroll, $99 a year | [enroll](https://developer.apple.com/programs/enroll/), [compare memberships](https://developer.apple.com/support/compare-memberships/) |
| 2 | Choose the bundle id and set it with a build-number scheme. With `remote`, EAS owns the build number and auto-increments it. | Ben (app) | `app/app.json`: `ios.bundleIdentifier: "<reverse-dns>.secondhand"`; `eas.json` `cli.appVersionSource: "remote"` and `autoIncrement: true` on `production` | [app versions](https://docs.expo.dev/build-reference/app-versions/) |
| 3 | Export compliance. The app uses only HTTPS, so it is exempt. | Ben (app) | `app/app.json` `ios.config.usesNonExemptEncryption: false` | [Expo app config](https://docs.expo.dev/versions/latest/config/app/) |
| 4 | Privacy manifest. Expo libraries ship their own; the app adds any required-reason APIs its own code and its libraries use. | Ben (app) | `ios.privacyManifests.NSPrivacyAccessedAPITypes` in `app/app.json`, then check the archive's report in Xcode (Product > Archive > Generate Privacy Report) | [apple-privacy](https://docs.expo.dev/guides/apple-privacy/) |
| 5 | Info.plist usage strings. Camera and photos come from the plugins already, so check their wording against `product/copy.md`. Add nothing the app does not use. | Ben (app) | `app/app.json` plugin options | — |
| 6 | Icons and launch screen. A 1024 px icon with no alpha, plus the `expo-splash-screen` plugin config. | Ben (app) | `npx expo prebuild --platform ios --clean`, then look at `ios/*/Images.xcassets` | [app icons](https://docs.expo.dev/develop/user-interface/app-icons/) |
| 7 | `eas.json` with four profiles: `development` (dev client), `preview-sim` (`ios.simulator: true`), `preview` (internal), and `production` (store). Each profile sets `environment` and `env.EXPO_PUBLIC_API_URL`. | Ben (app) | new `app/eas.json` | [eas.json](https://docs.expo.dev/eas/json/), [environment variables](https://docs.expo.dev/eas/environment-variables/) |
| 8 | Rehearse on the Mac with no Apple account (see the commands below). | Nate (Mac) | below | [simulators](https://docs.expo.dev/build-reference/simulators/), [local builds](https://docs.expo.dev/build-reference/local-builds/) |
| 9 | Create the App Store Connect record. It needs the bundle id, the SKU and the primary language. | Nate or Ben (account holder) | App Store Connect > Apps > New App, or let `eas submit` create it | [submit/ios](https://docs.expo.dev/submit/ios/) |
| 10 | Signing. Let EAS manage the distribution certificate and the provisioning profile, logged in to the Apple account. | Account holder | `npm i -g eas-cli@latest && cd app && eas credentials -p ios` | [build setup](https://docs.expo.dev/build/setup/) |
| 11 | Build and upload. Uploads must be built with Xcode 26 or later since 2026-04-28, which the EAS image and the Mac's Xcode 27.2 both meet. | Ben (app) | `cd app && eas build -p ios --profile production --auto-submit`, or `npx testflight` | [upcoming requirements](https://developer.apple.com/news/upcoming-requirements/), [npx testflight](https://docs.expo.dev/build-reference/npx-testflight/) |
| 12 | Internal testers: up to 100 App Store Connect users, no beta review, builds expire after 90 days. This is the right tier for "a handful". | Account holder | App Store Connect > TestFlight > Internal Testing | [TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/) |
| 13 | Host the server: one Node container with the `expo-server` Express adapter, a volume at `SECONDHAND_DATA_DIR`, and HTTPS (see Hosting). | Nate (backend) | `npx expo export --platform web` then `node server.js` (an Express wrapper, about 15 lines) | [api-routes](https://docs.expo.dev/router/web/api-routes/) |
| 14 | Point the native app at the server: the expo-router plugin `origin`, or `EXPO_PUBLIC_API_URL` read by one API client. | Ben (app) | `app/app.json` plugins `["expo-router", { "origin": "https://<host>" }]` | [api-routes](https://docs.expo.dev/router/web/api-routes/) |
| 15 | An API client plus real sign-in: `expo-apple-authentication` and the "Sign in with Apple" capability, wired to `POST /v1/auth`. Store the token in `expo-secure-store`. | Ben (app) and Nate (backend) | `npx expo install expo-apple-authentication expo-secure-store` | — |
| 16 | Make the auth store durable and give email codes a real sender, or hide the email option. | Nate (backend) | `app/src/edge/auth.ts:249` | — |
| 17 | Run jobs: a runner that calls `runtime.pipeline.runOnce`, plus a real `delete_user`. | Nate (backend) | `app/src/edge/api/runtime.ts`, `app/src/edge/api/me.ts:61` | [guideline 5.1.1(v)](https://developer.apple.com/app-store/review/guidelines/) |
| 18 | External testers only after 15 to 17. Fill in the test information and sign-in details, and the first build goes to Beta App Review. | Account holder | App Store Connect > TestFlight > External | [external testers](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers/), [test information](https://developer.apple.com/help/app-store-connect/test-a-beta-version/provide-test-information/) |

**Rehearsal on the Mac with no Apple account (step 8).** Simulator builds need no Apple account ([simulators](https://docs.expo.dev/build-reference/simulators/)). Run them in order:

```sh
xcrun simctl list devicetypes | grep iPhone        # pick a type, then a runtime from: xcrun simctl list runtimes
xcrun simctl create "sh-iphone" "<device type id>" "<iOS 26.4 runtime id>"
xcrun simctl boot "sh-iphone" && open -a Simulator
npm i -g eas-cli@latest                            # the installed one is older
cd app && npm ci && npx expo-doctor && npx tsc --noEmit
npx expo prebuild --platform ios --clean           # writes app/ios (already ignored by app/.gitignore:42)
npx expo run:ios --configuration Release --device "sh-iphone"   # a release build, no Metro
# or: eas build -p ios --profile preview-sim --local   (needs an Expo login, not an Apple one)
# server side, same Mac:
npx expo export --platform web && SECONDHAND_DATA_DIR=$PWD/../.data npx expo serve
```

A dev build (`expo-dev-client`, which is not in `app/package.json`) is for iterating with a JS reload. A release build is what TestFlight runs: it bundles the JS, has no Metro and no dev menu, so `fetch('/v1/...')` has no host. Rehearse the release build, because that is where the relative-URL failure appears.

## Blocks that build

| Finding | File | Smallest fix |
|---|---|---|
| There is no bundle id, build number or export-compliance flag. App Store Connect needs the bundle id, and without the flag every upload stops at the compliance question. | `app/app.json` (`ios` has only `icon`) | Steps 2 and 3: three keys. |
| There is no `eas.json` and no `ios/`, so no profile, signing or environment exists. | `app/` | Step 7: one file with four profiles. |
| There is no privacy manifest entry for the app's own required-reason APIs, which Apple checks at upload. | `app/app.json` | Step 4. |
| The Apple account does not exist yet, and an organization's D-U-N-S check can take days. | — | Step 1 today (decision 1). |
| The repo check is red. CI's `check` job fails on a false `top-level await` finding at `depop/adapter.ts` 127/154/189: the brace scanner misreads `Promise<{...}>`. The int-runtime-2 contract test is also red because item responses leak `data`. | `.agents/checks/bundle.mjs:60` (`topLevelAwaits`), `app/src/edge/api/runtime.ts:153` `publicRow` | The bundle fix is owned by int-bundle-2 ([board](../../board.md)). The leak fix is to strip `data` in every item view that does not go through `publicRow`. This does not block `eas build`, but it blocks the "Before every push" gate in AGENTS.md. |
| CI never typechecks and never builds iOS. `tsc` errors reach a build unseen. | `.github/workflows/check.yml` | Add `npx tsc --noEmit` to the `app` job (one line). |

## Blocks real use by ten people

1. **The native app cannot reach any server.** The only client fetches are relative, `fetch('/v1/health')` (`app/src/app/dev/health.tsx:9`) and `fetch('/v1/stage')` (`app/src/app/want.tsx:54`). There is no `origin` on the expo-router plugin, no `EXPO_PUBLIC_*` variable, and no API client. Fix: the `origin` (step 14) plus one `api()` helper that adds the base URL, the bearer token, `X-Request-Id` and `Idempotency-Key`. Then move screens off `app/src/demo/` one at a time, starting with sign-in, onboarding and Today.
2. **Sign-in is fake.** `app/src/you/sign-in.tsx` says "The app has no client for /v1/auth yet, so the demo drives it". Apple sign-in needs `expo-apple-authentication` (absent from `app/package.json`) and the capability. Fix: step 15. The server verifier in `app/src/edge/auth.ts` is real and should be kept.
3. **Every account is lost on a restart.** `app/src/edge/auth.ts:249` has `export const store = memoryStore();`, which ignores `SECONDHAND_DATA_DIR`, so users, identities and sessions vanish on every deploy. Fix: back the auth store with the same `fileStore` volume (one file next to `store.json`), then Lakebase.
4. **Email codes are never sent.** `sendCode: logSend` is a no-op. Fix: a transactional email provider behind `sendCode`, or ship Apple-only and hide email (decision 4).
5. **Account deletion does nothing.** `DELETE /v1/me` (`app/src/edge/api/me.ts:61`) logs a `queued` job and returns 202, but it never inserts a job row. The real `delete_user` in `app/src/edge/data/data.ts` is imported by nothing in `app/src`. Guideline 5.1.1(v) requires deletion in the app, and the Settings UI promises it. Fix: call the `data.ts` delete from the route, or insert a real job and run it (item 6).
6. **Nothing runs background work.** `runtime.pipeline.runOnce` (`app/src/edge/api/runtime.ts:134`) has no caller outside tests. `createWatcher` is built only in `app/src/edge/events/fixtures/week.ts`, and no ledger is constructed. Queued imports, delists and sweeps never run. Fix: one in-process loop started once at server boot (`setInterval(() => runtime.pipeline.runOnce(4), 5000)`, guarded so runs do not overlap), then the watcher behind `SECONDHAND_LIVE_SITES`. This works only on a long-lived Node process, not serverless.
7. **Linked marketplace sessions are lost on a restart.** `const vault = memoryVault()` (`runtime.ts:56`). After a deploy every linked account reads as unlinked. Fix: the Databricks secret-scope AuthVault that the shortcut names. For ten people, an encrypted file on the volume, with the key in the host's secret environment, is the smaller step.
8. **Example rows are seeded into the real store on every boot.** `seedExamples(st)` (`runtime.ts:54`) writes rows for `usr_8f2k` with `data: 'example'`. Real users never see them, because every read is scoped by `user_id`. They do sit in the durable file and in exports and analytics. Fix: seed only when `!process.env.SECONDHAND_DATA_DIR`, or behind a flag.
9. **Health measures Databricks, not the app.** `app/src/app/v1/health+api.ts` returns `health()` from `app/src/edge/databricks.ts`, which answers 503 `NOT_CONFIGURED` without `DATABRICKS_HOST`. A container health probe would restart a healthy server. Fix: `/v1/health` answers 200 with `{build: BUILD_SHA, store: ok}`, and Databricks moves to `/v1/health/deps`.
10. **The server needs folders outside `app/`.** `app/metro.config.js` watches `../log`, `../spec`, `../jobs/capture`, `../research/list/ben/platforms` and `../scripts`. Fix: build the container from the repo root, `COPY . .`, then `cd app && npx expo export --platform web`. Ship only `app/dist`, after confirming the server bundle has inlined them. `npx expo export` passing says it has, but this was not checked.
11. **Stage-only files.** `app/src/app/v1/stage+api.ts` reads `../logs/stage-alerts.json` relative to the working directory. Fix: return 404 unless `STAGE_ALERTS` is set.

## Before a hundred

- **The file store rewrites the whole state synchronously on every write.** `app/src/edge/events/file-store.ts:43-48` does `writeFileSync` of `JSON.stringify(memory.dump())` and then `renameSync`. It is atomic per write, but it has no cross-process lock, so two processes would each overwrite the other's state. It also blocks the event loop longer as the state grows. Fix: the async Lakebase port. The schema exists in `db/migrations/0001..0004`, and `node db/migrate.mjs --url` applies it once, with sha256 guards. The gap is that `Store` is synchronous (`put`, `get` and `rows` return values), so the port means making `Store` async and updating every caller.
- **One process only.** These live in module memory: `deps.idem` and `deps.visits` (`app/src/edge/api/http.ts:45-46`), `memoryLeases()` (`runtime.ts:88`), `intel/run.ts:26-27` `inflight` and `cache` (never evicted), and `captures.ts:101`, `scores.ts:9` and `sources.ts:10` `params`. A second instance would double-drive a marketplace account and replay idempotency wrong. Fix: pin to one instance (decision 2), and add a size cap to `run.ts` `cache` (an LRU of 500 entries).
- **Request ids stop at the server.** `route()` echoes `X-Request-Id`, but no client sends one, so you cannot go from one person's report to their log lines. Fix: the `api()` helper sets it, and the app shows it on the error state ("Couldn't load", plus the id under Details).
- **Logs go to stdout only** (`consoleSink`). That suits a container's log driver, but nothing retains logs or alerts on them. Fix: the host's log drain, plus one alert on `request.end` status ≥ 500 rate and one on `job.state failed`. `node spec/log.mjs <file>` already checks a run.
- **Per-site write kill switch.** Reads are gated by `SECONDHAND_LIVE_SITES` (`runtime.ts:68`), but writes are not: `isWrite(adapter.manifest.verb)` keeps write adapters live (`runtime.ts:83`). Fix: `SECONDHAND_WRITE_SITES` applied the same way, defaulting to empty.
- **Cost caps.** Browser Use Cloud sessions and OpenRouter calls have no per-person or per-day ceiling in the runtime. The pool's timeouts were not checked in this pass. Fix: a daily counter in the store per person per vendor, checked before a session or model call, with a param for the ceiling.
- **A known 503 loop.** Any unexpected error maps to `waking` 503 `{by:'auto', after_s:2}` (`http.ts:124`). A client that honours `by:'auto'` retries a deterministic bug forever. Fix: map unknown errors to 500 `{by:'none'}`, and keep `waking` for real cold starts.
- **The open reviewer HIGH: a delist after a sale is gated by the price rule** ([board](../../board.md)). This must close before any real write runs.

**Scale, inferred, not measured:**
- **10 people.** One container is fine. The first break is a deploy wiping accounts and links (items 3 and 7 above).
- **100 people.** Watcher sweeps (hot cadence 90 s, `runtime.ts:90`) times linked accounts means continuous Browser Use sessions. The first break is the synchronous whole-file write stalling requests, then vendor spend without a cap.
- **1,000 people.** One process cannot hold the sweeps or the SSE streams. The first break is the single-process state: idempotency, leases and the `run.ts` cache. This needs Lakebase plus leases in the database before a second instance.
- The Poshmark read benchmark is p50 0.79 s and p95 2.08 s, at 14 to 19 of 20 coverage (commit f9ce2697).

## First hour: what each failure does

| Situation | Designed? | Where |
|---|---|---|
| Sign-up or sign-in fails | The UI is designed ("Couldn't sign in", Try again, offline), but it is faked, so it never fails for real. | `app/src/you/sign-in.tsx` |
| An expired marketplace session | Server: designed. The scheduler pauses on `auth_expired` and `blocked` (`app/src/edge/events/schedule.ts:89`). Nothing runs the scheduler (item 6). | — |
| A site refuses a read | Designed: `fail('no_route', ..., {do:'handoff'})` (`runtime.ts:84`). The app does not consume it. | — |
| A slow search | Server: designed. `POST /v1/search` returns 202 and streams `answer.partial` over SSE with a heartbeat (`app/src/edge/api/search.ts:224`, `jobs.ts:123`). The app does not call it. | — |
| Offline | Designed on the screens checked (sign-in), on demo data. | `.agents/checks/states` covers the states |
| A 500 | It becomes a 503 `waking` with an auto retry, a possible loop (see above). | `http.ts:124` |
| Empty states | Designed, and checked by the states check, on demo data. | — |
| Hangs | No client timeout exists, because the client makes no API calls yet. The `api()` helper should use `AbortSignal.timeout(15000)`. | — |

## Hosting

| Option | Verdict | What must change |
|---|---|---|
| EAS Hosting (Cloudflare Workers) | Does not fit. | The worker runtime has no `child_process` (`databricks.ts` `execFile`), its `fs` is in-memory (the file store and `stage+api.ts`), and "Secrets cannot be deployed with Expo Hosting". The module-level state also assumes one long-lived process. [worker runtime](https://docs.expo.dev/eas/hosting/reference/worker-runtime/), [hosting env vars](https://docs.expo.dev/eas/hosting/environment-variables/) |
| Serverless Node | Does not fit. | Nothing keeps the job loop, the watcher or the SSE streams alive, and memory resets per instance. |
| **One Node container or VM (recommended)** | Fits today's code. | `expo-server`'s Express adapter (`createRequestHandler({ build: 'dist/server' })`, already in the lockfile as a transitive dependency of expo, so add it to `app/package.json` directly). One instance, a persistent volume at `SECONDHAND_DATA_DIR`, and the job loop started at boot. Secrets go in the host's secret environment, because `expo-server` does not load `.env` ([api-routes](https://docs.expo.dev/router/web/api-routes/)). HTTPS goes through the host. playwright-core is a devDependency and Browser Use is remote over CDP, so no browser goes into the image unless `SECONDHAND_PLAYWRIGHT` is set. |

The API base URL per profile:
- `development` and `preview-sim` use the Mac's LAN or Tailscale URL.
- `preview` and `production` use the container's HTTPS host.

Set it with `EXPO_PUBLIC_API_URL` in each profile's `env`, or an EAS `environment`. The `origin` in `app.json` is static, so `app.config.ts` should read it from that variable.

The secrets the server reads, by name only:
- `BROWSER_USE_API_KEY`, `OPENROUTER_API_KEY`, `DATABRICKS_TOKEN`, `DATABRICKS_HOST` and `DATABRICKS_WAREHOUSE_ID`
- `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET`, `DECISION_SIGNING_KEY`
- the Apple and Google audiences

None of them may carry an `EXPO_PUBLIC_` prefix, because that inlines it into the app. The repo is public (a comment in `.github/workflows/check.yml`), so none goes in `eas.json` either.

## The first-round table (the 15 ai-engineering items)

Marked from greps of the current code on 2026-11-15; "not checked" means no evidence either way.

| # | Item | State | File |
|---|---|---|---|
| 1 | `POST /v1/search` returns 202 and streams per-site partials | closed | `app/src/edge/api/search.ts:121-224` (202, `runPlan`, `answer.partial`) |
| 2 | Warm anonymous page per site | partly, not checked | `app/src/edge/harness/service.ts:9` has a `warm?` hook; its use was not traced |
| 3 | eBay search through the Browse API only | partly | `harness/sites/ebay/adapter.ts` uses `buy/browse`; `intel/extract-live.ts` still fetches `ebay.com/sch` |
| 4 | Route order by health, a breaker, leases and pace, one `route_call` per attempt, no timeout as `rate_limited` | open | No `route_call` under `app/src/edge/harness`; `after_s: 30` is still in `harness/protocol.ts` |
| 5 | Write idempotency survives a restart, and reconcile can succeed | partly | `harness/service.ts` dedupes through `Store.beginOperation`, which is durable only with `SECONDHAND_DATA_DIR`; reconcile was not checked |
| 6 | One Browser Use cloud profile per linked account | open | `app/src/edge/browser/cdp.ts:102` `profileFor = () => undefined` |
| 7 | Persist the watcher's due and paused maps, pause on `blocked`, honour `after_s` | closed (the `after_s` part not checked) | `app/src/edge/events/schedule.ts:9,23,89` |
| 8 | An eval harness with a gate in the check | open | No eval in `.agents/check.mjs` or `.agents/checks/` |
| 9 | A decision dossier and replay (`/v1/decisions/:id/trace`) | open | `app/src/app/v1/decisions/[id]/` holds only `act+api.ts` |
| 10 | Strict structured output and caching | open | `app/src/edge/intel/extract-live.ts` still uses `json_object` |
| 11 | An injection red-team set and a controls allowlist | open | No set under `.agents/checks/` (an allowlist in the adapters was not checked) |
| 12 | The negation hole in `claim_check` | closed | `app/src/edge/gate/gate.ts:20,29` `negators` and `negated()` |
| 13 | An exact-match verifier for the top ten | partly | `likely_same_model` in `api/search.ts` and `intel/reconcile.ts`; the batched typed call was not checked |
| 14 | Module state is single-process, and what breaks first is removed | open | `app/src/edge/intel/run.ts:26-27` `cache` is still never evicted; `runtime.ts:88` `memoryLeases()` |
| 15 | Spec drift on route order and transport | open | `spec/product.md` still says "no browser vendor" |

## What is already production-shaped and should be kept

- `app/src/edge/api/http.ts`: one contract layer. It has bearer-derived `user_id` (a client never sends it), the `{code, message, failed_step, retry}` error shape, `Idempotency-Key` replay with a body-hash mismatch check, `X-Request-Id`, and a request start and end log per call.
- `app/src/edge/auth.ts`: real JWKS RS256 verification for Apple and Google. The email code expires in 10 minutes, allows 5 tries and is checked in constant time. Sessions are stored as hashes, with refresh families. Only its storage and sender need replacing.
- `app/src/edge/events/file-store.ts`: atomic tmp-then-rename writes, a validated load, and `running` jobs reset to `queued` on boot. It is the right bridge to Lakebase.
- `db/migrate.mjs` and `db/migrations/`: ordered, transactional, sha256-guarded migrations, already tested on PGlite.
- `app/src/edge/events/schedule.ts`: saved due times and pause reasons, and a pause on `auth_expired` or `blocked`.
- `SECONDHAND_LIVE_SITES` as a per-site read switch, defaulting to off.
- `app/src/edge/data/data.ts`: a real `delete_user` that deletes secrets and rows. It only needs a caller.
- `.github/workflows/check.yml`: CI already runs the repo check, `expo export`, the screen check and e2e on every push.
- The log contract (`log/`, `node spec/log.mjs`): stdout JSON with request and user children, which a container log drain can take as it is.

## Decisions only Nate or Ben can make

1. **Whose Apple account:** an individual (fast, with a person's name on the listing) or an organization for BNVG (D-U-N-S, days). This also picks who holds signing and App Store Connect.
2. **One instance, accepted for the TestFlight period:** this means accepting downtime on deploy and no horizontal scale until Lakebase. The recommendation is yes.
3. **Where the server runs:** which Node host (any that gives one long-lived container, a volume and secret env), and the spend.
4. **Email sign-in for the first build, or Apple only:** email needs a sender and its spend.
5. **Whether the first TestFlight build is the demo** (internal only, honest about demo data), or waits for the API client. External testers should wait either way, because Beta App Review tests sign-in and deletion.
6. **Live sites and writes for testers:** which sites go in `SECONDHAND_LIVE_SITES`. This also settles whether any write runs on a tester's real account while the delist HIGH is open. Poshmark's terms and robots.txt are noted in `product/live-buy-demo.md`.
7. **Vendor cost ceilings** per person per day for Browser Use and OpenRouter.
