# Protocol and adapters engine

*agent proposal* (the whole file). Canon names in [product.md](../product.md) win. This file builds the engine behind [the harness protocol](../product.md#the-harness-protocol): the contract every caller uses, the sessions it runs in, and the agent that writes, tests, watches and repairs one adapter per site and verb. Direction: [a custom harness per site](../../product/words.md#2026-11-14-nate-each-harness-is-built-from-what-it-understands-of-the-site-as-documented-endpoints-such-as-write-listing), with [official APIs where offered](../../product/words.md#2026-11-15-nate-official-apis-where-they-exist-the-browser-design-as-specced-ranking-systems-accounted-for-databricks-perfected).

## 1. What it decides

| Output | Shape | Consumed by |
|---|---|---|
| The call result | `harness.call(site, verb, args)` returns `{ok:true, data, meta}` or `{ok:false, error:{code, message, hint}, meta}`; `meta = {route_id, adapter_version, ms, fell_back, observation_ids[]}` (canon) | every feature that touches a marketplace: [list](../features/list.md), [sold](../features/sold.md), [messages](../features/messages.md), [price](../features/price.md), [market](../features/market.md), [connect](../features/connect.md), the [negotiation](negotiation.md) and [valuation](valuation.md) engines |
| The route for this call | a `route_table` row, chosen per call by the [source router](../product.md#source-router-agent-proposal) | the runtime |
| An adapter release | `adapter_release` (new name): `{site, verb, version, status: candidate, live, retired or rolled_back, gate: {fixture, live_read, round_trip, forbidden_controls}, canary_calls, released_at}` | the router (only `live` and `candidate` rows serve) |
| Route health | Beta success and completeness per route, held as `param` rows ([real-time weights](../product.md#real-time-weights-agent-proposal)) | router order, connect's health state (ok, expiring, broken, paused), the repair trigger |
| A repair | an `adapter_author` job (canon) with `{trigger, rounds, patch, result}` | the router, the ops view |

The 15 verbs in [names.ts](../../app/src/edge/harness/names.ts) are: `post, revise, end, relist, read_listings, read_inbox, send_message, read_offers, answer_offer, make_offer, read_orders, read_stats, read_storefront, search, save`.

### The error codes and the hint an agent acts on

`hint` is an object, `{do, ...args}`, so an agent step branches on `hint.do` and never parses `message`.

| Code | Meaning | `hint.do` and what follows | opencli equivalent |
|---|---|---|---|
| `auth_expired` | the session lost its login | `relink`: raise the `relink` decision; no retry; connect shows `expiring` or `broken` | `AUTH_REQUIRED` (77) |
| `not_found` | the listing, order or thread is gone | `reconcile`: it is a fact, not a failure; no repair | none |
| `rate_limited` | the site slowed us | `retry_after` with `after_s`; the job's `next_check_at` moves; a write never switches route | `TIMEOUT` (75) |
| `page_changed` | a manifest field or a step's target is missing after the empty-is-not-broken check (§3.4) | `author`: a read falls to the next route at once; `adapter_author` starts | `SELECTOR`, `EMPTY_RESULT` |
| `blocked` | a challenge page or a detector fired | `pause_session` with `site`: no retry, no solving; raise `site_warning` | `CAPTCHA` |
| `policy_refused` | the [§5 check](../product.md#5-who-may-act) said no | `raise_decision` with `kind`: the decision the person answers | none |
| `outcome_unknown` | a write was sent and no read-back settled it | `reconcile` with `operation_id`: never replay; reconcile reads the state | opencli's rule, "Do not automatically replay a write with an unknown outcome" |
| `no_route` | no route can serve this site and verb | `handoff` with `url`: a one-tap link that opens the site at the right page ([parity](../parity.md)) | none |

### The manifest and its versions

The canon manifest `{site, verb, version, input_schema, output_schema, fields[], session, pace, fixture_ref, recorded_at}` gains four fields: `route_kind` (`endpoint` or `page`), `expect` (the response check [replay](../features/replay.md) runs on every call), `read_back` (the verb and match that confirms a write) and `controls[]` (the page controls the recipe may touch; everything else is forbidden). Versions are semver: a major bump changes `output_schema`, a minor bump changes the route kind or endpoint, a patch changes a selector or a path. A run records `adapter_version`; the old live version serves until the new one passes the gate; a failed release rolls back to the last passing version with one UPDATE.

## 2. Signals

| Input | Source | Freshness | How it enters |
|---|---|---|---|
| Call outcomes | `route_call` rows, one per call | per call | Beta success and completeness update in the same transaction |
| Page evidence | `observation` (snapshot plus fingerprint) on every read | per call | the fingerprint diff against the fixture flags drift before a call fails |
| Recon bundle | the primitives on the test account: accessibility tree, DOM refs, captured requests, loaded scripts | per authoring or repair job | input to the authoring pipeline (§3.3) |
| Live check | the nightly fixture-against-live read on the test account | nightly | a field missing from live output starts a repair |
| Site warnings | read_stats, account pages and the site's emails ([trust](trust.md)) | every 30 min probe | lowers the pace, may pause the session |
| Route truth | our own sales feed, `route_truth` ([data](../features/data.md#source-registry-and-router-agent-proposal)) | nightly | corrects completeness when a read silently misses rows |

## 3. The calculation

### 3.1 Sessions

- **Transport.** [Nate chose Browser Use Cloud](../../product/words.md#2026-11-14-nate-we-run-on-browser-use-cloud-with-its-docs-saved-as-reference-and-the-seats-on-it-versed-for-speed-and-cost). The build and demo reach its browsers over CDP behind the one `Launcher` port ([cdp.ts](../../app/src/edge/browser/cdp.ts), [pool.ts](../../app/src/edge/browser/pool.ts)). Own hosting or the phone's web view can implement that port later; neither is required for this build.
- **Link once.** The person signs in themselves through the cloud browser's live view, including any second factor. [Stored auth](../../product/words.md#2026-11-14-nate-store-auth-through-browser-use-build-fewer-things-at-once-focus-on-the-browser-harnesses) is per account behind `account.token_ref`: cookies and localStorage in `AuthVault`, loaded at lease start and exported after a successful lease ([auth.ts](../../app/src/edge/browser/auth.ts)). Credentials and viewer URLs never enter prompts, logs or fixtures. A login wall pauses for the person.
- **Background work.** The account works for days and weeks while the phone is locked; the person stays in our app after linking, except when sign-in or a challenge needs them. Each action is an intent they opted into ([Nate](../../product/words.md#2026-11-15-nate-official-apis-where-they-exist-the-browser-design-as-specced-ranking-systems-accounted-for-databricks-perfected)); this does not promise a session will never expire.
- **Linked only.** No account browser, sweep or job launches for a site the person did not link and store auth for ([Nate](../../product/words.md#2026-11-14-nate-the-kernel-covers-platform-specifics-and-storefront-analytics-and-runs-only-what-each-person-linked)). Anonymous market research is separate from working their accounts.
- **Keep-alive.** A probe read (the first page of `read_listings`) every 30 min, as in [card 17](../determinations/managing-and-buyers.md#17-whether-an-account-is-healthy-or-at-risk). Two failed probe reads mark the session `broken`. A login wall on a probe is `auth_expired`.
- **Lease.** One job drives an account's session at a time: a `session_lease` row taken with `FOR UPDATE SKIP LOCKED` and a TTL. A busy lease answers 409 (replay's rule). A write holds the lease through its read-back.
- **Pace.** A token bucket per (account, site), filled at the manifest's `pace`. Browser steps run one per 2 to 5 s with jitter, quiet hours at night, one saved profile and stable country, with no proxy rotation (§3.8) ([connect](../features/connect.md)). The learned pace moves down at once on `rate_limited`, `blocked` or a site warning. It moves up 10% only after 14 clean days and never past the manifest cap.

### 3.2 The primitives

All six run inside the leased session and log through [log/](../../log/README.md) with ids, never text or cookies.

| Primitive | Takes | Returns |
|---|---|---|
| `open` | url | `page_id`, final url, status |
| `inspect` | `page_id`, mode (`a11y`, `dom`, `state`) | a tree with stable `ref`s |
| `click` | `ref` | the new state fingerprint |
| `fill` | `ref`, value | the read-back value of the field |
| `extract` | `page_id`, a JSON schema | JSON with a source path or ref per field |
| `network` | `page_id`, filter, optional detail key | captured requests and responses with `cookie`, `set-cookie` and `authorization` removed |

`click` and `fill` on a signed-in session pass two checks in code first: the §5 policy check, and the forbidden-control filter, which refuses any control not in the recipe's `controls[]`. That covers buy, accept, delete, send and payment buttons; an authoring run on the test account may touch only the controls of the verb being authored.

### 3.3 The authoring pipeline

An `adapter_author` job is one durable agent step whose tools are the six primitives. Each stage writes its output to the job before the next starts.

1. **Recon.** On the test account, open the target page, perform the verb once by hand through the primitives, and capture the accessibility tree, the requests and a static scan of loaded scripts for endpoint candidates. A model reads the bundle and names the candidate requests and controls. Code stores the bundle as an `observation`.
2. **Endpoint or page.** A rule, not a model. An internal endpoint wins when all three hold:
   - it returns every manifest field;
   - it returns the same field paths across 2 sessions and 2 inputs;
   - it runs as an in-page fetch with the page's own session.

   A write also needs the endpoint to return the new object's id for read-back. Otherwise the recipe drives the page. The endpoint is preferred because it is faster and survives markup redesigns.
3. **Field decoding.** Each output field maps to a JSON path or a ref. An opaque field (an enum code, cents, an epoch, a size id) is decoded by changing one input and diffing the responses, for example two drafts that differ only in price. Units go into `output_schema` as cents, ISO time and the site's size system.
4. **Generating the adapter.** Each adapter follows that site's observed structure, with a typed manifest and deterministic commands ([Nate](../../product/words.md#2026-11-14-nate-each-harness-is-built-from-what-it-understands-of-the-site-as-documented-endpoints-such-as-write-listing)). Page recipes use the primitives and in-page fetch. Code lints it: every manifest field is produced, every control used is in `controls[]`, and no literal cookie or token appears.
5. **A fixture from a real page.** The recon capture, masked with the log masks (buyer names and handles become `buyer_ref_hash`, addresses removed), plus the expected JSON, saved as `fixture_ref`.
6. **The test and the release gate.** All four checks must pass:
   - the fixture test offline: every field present and typed, values equal;
   - a live read on the test account matching the fixture's fields;
   - for a write, a round trip on the test account: post, read back, end;
   - the forbidden-control check: a dry run that logs every control touched.

   The release goes `candidate` and serves 5% of calls for 1 h or its first 20 calls. It goes `live` when its success posterior mean is at least the live version's lower 95% bound. The old version retires only then.
7. **Health.** The canon router rules hold: a Beta success update per call, the breaker opening after 3 straight failures, and 5% exploration. Completeness is the share of manifest fields present, also Beta, per route.

### 3.4 The repair trigger and the repair loop

**Triggers.** Any one of these starts a repair:
- a `page_changed` error;
- `no_route`;
- the posterior probability that success sits below the guard (prior 0.9) exceeding 0.95;
- completeness under 0.9 over the last 50 calls;
- the nightly live check failing.

**Empty is not broken (from opencli's autofix).** Before a repair starts, code runs three checks:
- the same read with a second input;
- the same page through the fetch engine;
- a retry after 3 s.

If the fetch engine sees rows the adapter does not, the adapter is broken. If both see none, the empty result is an answer. A challenge page is `blocked`. `auth_expired`, `blocked` and `rate_limited` never start a repair.

**The loop.** At most 3 rounds per trigger, on the test account:
1. Read the failing call's observation, diff it against the fixture, and write the smallest patch.
2. Run the full gate.

The fixture is never loosened to pass. When the site itself changed shape, a fresh recon diff proves it, and the fixture is re-recorded with a major or minor bump. After 3 failed rounds the route stays demoted and the router serves the next route. A second job with a stronger model rewrites the adapter from a fresh recon. If that fails too, callers get `no_route` with a handoff, and ops is paged.

### 3.5 Starting routes, site by verb

[Nate combines public reads with signed-in actions](../../product/words.md#2026-11-14-nate-combine-signed-in-actions-with-public-no-login-fetches-for-the-fastest-searches), retaining [what the account adds](../../product/words.md#2026-11-14-nate-the-signed-in-harness-where-the-account-adds-capability-faster-public-paths-elsewhere). *Agent proposal*: measure the following lanes per site and verb; choose order from time to first row, completeness, bytes and browser-seconds, rather than launching three browsers for every read.

| Lane | Use |
|---|---|
| Plain request, no browser | Public pages or data calls that accept it; official APIs where offered |
| Anonymous cloud browser | Public pages that refuse a plain request or omit needed fields |
| The person's cloud browser and profile | What their account adds: inbox, offers, orders, private stats and every browser write |

Inside an open page, try the site's own data calls before driving controls. A manifest's `session` and per-field `needs_session` prevent a cheaper route from dropping account-only fields. Writes never switch routes after acting.

[Official APIs are used where offered](../../product/words.md#2026-11-15-nate-official-apis-where-they-exist-the-browser-design-as-specced-ranking-systems-accounted-for-databricks-perfected): eBay uses its developer APIs with OAuth, including Browse for public search. Elsewhere the person's own session serves account actions. The build covers [five sites](../../product/words.md#2026-11-14-nate-five-sites-offerup-and-grailed-are-a-future-idea-and-ebays-push-only-if-it-beats-our-harness); OfferUp and Grailed remain a future idea.

*Agent proposal, observed in [M1](../../research/cross-cutting/nate/runs/m1.md)*: create-to-CDP connection took 0.48 to 0.54 s in the first four runs, about half a second. Public search read 24 Depop and 48 Poshmark listings without login; the Mercari rerun read 30. eBay refused the signed-out browser with 403; its public route is Browse, whose live proof is still due. Depop and Mercari refused headless local Chrome but returned real pages in the cloud. These are individual runs, not latency guarantees.

*Agent proposal, observed in the build*: [platform profiles](../../app/src/edge/harness/platform.ts) hold site capabilities, listing limits, clocks, storefront fields and headed-browser needs as data. [Manifests](../../app/src/edge/harness/protocol.ts) hold each verb's schemas, session, pace, controls and read-back. [Endpoint docs](../../app/src/edge/harness/ENDPOINTS.md) are generated from those profiles and manifests; availability there does not prove a live adapter.

[Storefront analytics are part of the kernel](../../product/words.md#2026-11-14-nate-the-kernel-covers-platform-specifics-and-storefront-analytics-and-runs-only-what-each-person-linked). `read_storefront` reads shop figures into `storefront_snapshot`, with `fields_missing[]` distinguishing unavailable fields from real zeros ([storefront.ts](../../app/src/edge/harness/storefront.ts)); public shop fields need no login, private totals use the linked account.

[Site terms are recorded as facts](../../product/decisions.md#2026-11-14-licences-and-site-terms-are-recorded-as-facts-and-do-not-shape-the-build). *Agent proposal*: show those facts and the account risk at linking and opt-in: automated access can lead to restrictions or suspension on sites whose terms restrict it. The person's approval does not change a site's terms.

### 3.6 How every event reaches the system (agent proposal)

Asked by [Nate](../../product/words.md#2026-11-14-nate-hooks-for-every-app-event-what-we-poll-what-the-platform-triggers-sign-in-by-oauth-where-possible). Every source below writes one row to `event` (id, source, site, account, kind, payload ref, dedupe key), and each row starts exactly one job ([product.md](../product.md#6-systems)). Account sources run only for linked accounts (§3.1). A source never acts; it only reports. The harness confirms a site event by a signed-in read before anything is done about it.

| Source | How it is caught | Delay |
|---|---|---|
| The app | each `/v1` route writes its event in the same transaction as its change (an outbox), so no event is lost if the job runner is down | none |
| A site's own push | a signed webhook to the edge: eBay notifications (order, offer, message, listing ended). Verified by signature, answered in under 1 s, used as a trigger only | seconds |
| The site's live channel | where a site's own web client receives messages and offers over a held connection, a leased session keeps that connection open for an account during a hot window (an open negotiation, the hour after posting) and turns each frame into an event | seconds |
| Our watchers, signed in | one sweep per linked account reads the pages the site already builds for the person: the notification feed, the inbox, offers, orders, the listings list with its counts. The sweep keeps the last normalised snapshot and emits an event per difference (`offer.received`, `message.received`, `listing.sold`, `listing.ended`, `like.added`, `price.changed`) | by tier: 1 to 2 min while hot, 15 min live, hourly quiet, through the night |
| Our watchers, public | a server fetch of the public listing page for the cheap "is it still up" check ([Ben's prototype](../../research/sold/ben/cheap-sale-detection.md)); a hit triggers the signed-in read | 1 to 2 min |
| The market | the intelligence engine's scheduled gathers per product family write `observation` rows; a change past its threshold is an event (`value_moved`, `demand_rose`) | hourly to daily |
| Databricks | a table change (change data feed), a file arriving in a volume, a job ending, a schedule | seconds to minutes |

**Reading the notification feed first** is what makes a sweep cheap: one page holds everything the site thought worth telling the person, so most sweeps are one read. Each watcher cadence is a `param` per site and state, learned from how often a sweep finds something.

**Signing in.**

| Site | How the person links it | Platform push |
|---|---|---|
| eBay | OAuth in a sheet (refresh token 18 months), with notifications used only as triggers; a harness session for capabilities the API lacks | yes, signed |
| Depop | a harness session: the person signs in once on Depop's real login. No partner access ([Nate](../../product/words.md#2026-11-14-nate-no-depop-partner-access-so-build-an-ai-driven-workaround)), so no OAuth and no webhooks; see [3.7](#37-depop-without-partner-access-agent-proposal) | none; watchers and the live channel |
| Facebook, Poshmark, Mercari | no OAuth is offered to sellers ([platform access](../../research/connect/nate/platform-access.md)). The person signs in once on the site's real login, through the cloud browser live view; they complete any second factor, and the session is stored behind `account.token_ref` | none; watchers and the live channel |

After linking, jobs run in the background; a login wall or challenge pauses for the person. A session that expires raises one `account_stale` decision with a one-tap re-link; jobs for that account pause and resume, none are dropped.

### 3.7 Depop without partner access (agent proposal)

[Nate ruled out partner access](../../product/words.md#2026-11-14-nate-no-depop-partner-access-so-build-an-ai-driven-workaround). The [Depop operating design](../../app/src/edge/harness/sites/depop/README.md) records its own structure, rather than prescribing one DOM recipe for every site.

*Agent proposal, observed in [ad-depop](../../research/cross-cutting/nate/runs/ad-depop.md)*: plain Node fetch returned 403 on both www and webapi. Public search uses the cloud page's Next flight data; listing, shop products, reviews and status reads use presentation calls from inside the open page. The old search endpoint returned 410. There is no public sold search; sold status is available per listing and shop.

Two anonymous live runs returned 24 search rows each, plus listing, storefront, shop listings, reviews and legitimate empty results. `read_storefront` returned followers, following, rating, review_count, sold_count and active_count. Connect took 463 ms in both runs; whole runs through stop took 6.198 and 7.034 s. These are two runs, not a p95.

Signed-in reads and all eight writes have only synthetic fixture proof because no Depop account was linked in those runs. The signed-in endpoint paths are guesses awaiting recon. Writes return a dry plan by default; live submission remains unavailable until observed on a linked account. No fixture result is a live success.

### 3.8 Cloud transport and cost (agent proposal)

The [cloud decision](../../product/words.md#2026-11-14-nate-browser-use-on-cloud-tested-the-way-production-runs-with-milestones-that-are-finalised-as-they-are-hit) replaces the earlier self-hosting plan for the build and demo. `browserUseCloud` creates a browser, connects over CDP and stops through the vendor API; disconnecting CDP alone does not stop billing. The `Launcher` port keeps transport separate from site recipes.

*Agent proposal, observed in the [cloud reference](../../research/cross-cutting/nate/browser-use-cloud.md)*: browser time is $0.06/hour, billed by the started minute with a one-minute minimum. The full timeout is charged up front and unused time refunded on stop. Managed proxy traffic is $5/GB, separate from browser time; M1's $0.001 browser cost excludes it.

- Pass a job-sized `timeout` on every create, including sign-in.
- Stop on every path, including errors and cancellation; close in `finally`. Sweep browsers left without a lease, including failed stops.
- Use one browser per account lease, shared by its verbs; hold the lease through write read-back. Save auth between runs rather than paying for an idle browser for weeks.
- Block images, media and fonts on reads where not needed; record browser-seconds and bytes, with missing content-length treated as a lower bound.
- Use the saved profile and stable country. [Nate dropped proxy rotation](../../product/words.md#2026-11-14-nate-we-do-not-need-our-own-proxy-rotation); there is no custom rotation. Vendor default routing is separate.
- Send `solveCaptchas:false`. A challenge or login wall pauses for the person in the live view; no solver, alternate identity or route around it.
- Keep every write dry until Nate's go per site ([packet 49 protections](../../.agents/team/packets/team/49-handoff-to-the-mac-session.md#protections-that-still-hold)). Act once with `operation_id`, read back, and never replay an uncertain write. A person's approval and the site's go are separate gates.

*Agent proposal, observed implementation limits*: [sign-in](../../app/src/edge/connect/OPERATING.md) and [posting](../../app/src/edge/post/OPERATING.md) have offline port proof; production viewer routes, vault/store wiring and site probes still need live proof. The pool can keep idle contexts warm; the cost rules above require bounded lifetime and cleanup, not an unmeasured ten-minute warm period. The [watcher](../../app/src/edge/events/schedule.ts) can sweep storefronts when that dependency is supplied; deployment wiring still needs proof.

## 4. Learning

| What | When | Algorithm | Prior | Switch and rollback |
|---|---|---|---|---|
| Route success and completeness | per call, same transaction | Beta update with about 30 days of forgetting (canon) | Beta(9,1), mean 0.9, for a release that passed its gate | the breaker after 3 straight failures; nightly `param_fold` |
| Route order | per call through the router | `unit_cost / (success x completeness x right_90d)` with 5% exploration (canon) | the manifest's `route_kind` order | `route_probe` hourly; demotion within 20 calls under 30% injected failures |
| Adapter version | per release | the canary rule in §3.3 | the live version | an adapter bump freezes the version's rows; rollback is one UPDATE |
| Pace | per warning, and on day 14 of a clean run | down at once, up 10% at most, capped by the manifest | the manifest's `pace` | any warning returns the pace to its last clean value |
| Repair patterns | per finished repair | the patch, its trigger and the recon diff go into a site note that the next recon reads | none | a note that preceded a failed repair is marked and dropped from recon input |

## 5. Speed

*Agent proposal*: these are targets, not measured results; live measurements are in §§3.5 and 3.7.

| Moment | Budget | Kept warm | Runs on the event |
|---|---|---|---|
| A read through an endpoint recipe | p95 1.5 s | the leased cloud browser per active account, bounded by its job timeout (§3.8); the manifest and `route_table` in a 60 s cache | the in-page fetch |
| A read that drives a page | p95 8 s at the site's pace | same | the recipe's steps |
| A write | p95 20 s including the read-back | same | write, read-back, `route_call` |
| Delist after a sale | p95 under 2 min, red at 5 min (canon) | a hold on every other site the moment a sale is seen | `end` on each site, highest-risk site first |
| A read failing over | under 1 s added | the next route's manifest | the router's next row |
| A repair | a candidate within 30 min of the trigger | the last recon bundle and the fixture | the authoring pipeline from stage 3 |

## 6. What the person sees

In [connect](../features/connect.md), each site shows:
- its health state;
- the time of the last success;
- real counts, for example "41 of 42 actions worked this week";
- the account risk for that site.

A verb with no route shows a one-tap button that opens the site at the right page. A verb under repair shows the work waiting on it ("2 drafts wait for eBay posting"). Repairs that finish inside the failover leave no trace in the app. The person can:
- pause a site;
- relink it;
- finish sign-in or a challenge in the live view.

## 7. How it beats what exists

| Rival | What it does (mark) | Ours |
|---|---|---|
| opencli ([repo](https://github.com/jackwener/opencli), [author skill](https://github.com/jackwener/opencli/blob/main/skills/opencli-adapter-author/SKILL.md), [autofix skill](https://github.com/jackwener/opencli/blob/main/skills/opencli-autofix/SKILL.md), [exit codes](https://github.com/jackwener/opencli/blob/main/docs/guide/exit-codes.md); *observed*) | a JSON envelope, sysexits codes, strategies `PUBLIC`, `COOKIE`, `INTERCEPT`, `UI`, `LOCAL`; `adapter check` and `test` with optional fixtures; autofix with hard stops, empty-is-not-broken, 3 rounds and "never relax" fixtures; Facebook adapters only among our sites | **adopted:** the envelope, the hard stops, the empty-is-not-broken check, 3 rounds, never loosening a fixture, preferring the endpoint, never replaying an unknown write. **Better:** opencli states "no row-shape or site-memory gate is imposed" and "There is no draft directory, promotion step or required memory file"; we add a required fixture with a field-presence gate, a candidate release with a canary, semver with keep-old-until-pass and rollback, Beta health with a breaker, a repair started by success dropping as well as by an error, `operation_id` with read-back, pace and lease in the manifest, `policy_refused`, and the forbidden-control filter; its sessions are the person's Chrome, ours a cloud profile that works while the phone is locked |
| Vendoo, List Perfectly ([crosslister teardown](../../research/cross-cutting/nate/crosslister-teardown.md#4-documented-failures-by-class), *observed* and *asserted*) | a 10-minute sale poll; delist on higher tiers; documented delist failures | sale seen within 2 min, delist p95 under 2 min for everyone, every write read back |
| RapidAPI, treg, Apify, API2Cart and Rutter ([parity](../parity.md)) | provider health by latency and uptime; pay per result; a unified commerce schema | health by success, completeness and `right_90d` from our own sales; the 15 verbs as the unified schema |

## 8. Protections

- Tokens and cookies stay in the cloud profile and the vault behind `account.token_ref`. `network` strips them, the fixture masks run before storage, and the `.agents/checks/` secrets check runs on fixtures.
- The §5 policy check runs in code before every outward verb. Locked kinds stay locked. `post` refuses a recalled product ([trust](trust.md)).
- Authoring and repair write only on the test account. The forbidden-control filter holds on every account.
- On Poshmark, `share`, `save` (a like) and `relist` are never submitted by the system: Poshmark's Community Guidelines name automated liking, sharing and reposting, and its Seller Policy prohibits excessive removal and reposting ([run note](../../research/cross-cutting/nate/runs/ad-poshmark.md)). The marketing engine still works out when one is worth doing and says so as a suggestion with its reason; the adapter answers `no_route` with `handoff {url}`, and the app opens that page in its own in-app browser, already at the listing, so the person taps the button themself without leaving the app ([Nate](../../product/words.md#2026-11-15-nate-poshmark-share-like-and-repost-are-suggested-and-the-person-taps)). This rule is Poshmark's alone; other sites keep their own rules in `spec/sites.mjs`.
- An `outcome_unknown` write is never replayed. Reconcile settles it by `operation_id`.
- Learning only slows the pace on a warning and never raises it past the manifest cap.
- Buyer data in fixtures and observations follows [privacy-and-data](../../research/cross-cutting/nate/privacy-and-data.md): `buyer_ref_hash` only.

## 9. Proof

| Test | Runnable in a day as | Passes when |
|---|---|---|
| Envelope contract | a fake site that returns each failure; a scripted agent acts on `hint.do` | every code maps to its hint; the scripted agent takes the right next step 8 of 8 |
| Fixture test | per adapter, offline | every field present and typed, values equal |
| Live read | nightly on the test account | live fields equal the fixture's |
| Write round trip | post, read back, end on the test account | the read-back matches; nothing is left live |
| Router test (canon, [databricks.md](../databricks.md) §9) | 30% injected failures | demotion within 20 calls, recovery within 1 h |
| Repair drill | 10 mutations of recorded pages: a renamed class, a field moved into nested JSON, a new wrapper, a renamed endpoint, a pagination change | a passing candidate within 3 rounds on at least 8 of 10; the fixture is untouched in all 10 |
| Empty is not broken | a zero-result search, and a soft-blocked page | the first returns `ok` with `[]` and starts no repair; the second returns `blocked` |
| Unknown outcome | kill the call after the post is sent | reconcile settles it; zero duplicate posts |
| Lease | two jobs on one account | one gets 409; their steps never interleave |
| Forbidden controls | a recipe that tries to click a buy button | refused in code, logged |

The result that counts:
- the share of supported verbs on the five build sites that are live with a passing gate;
- delist p95;
- the median time from a repair trigger to a live fix.

The fixed set: the recon captures of the five build sites, plus every real breakage from the first month, replayed as repair drills.

## 10. Build tasks

The paths are proposed. Tasks 1, 2 and 3 run in parallel, 4 needs 1 and 2, 5 needs 4, and 6 needs 1.

| # | Task | Owned files | Depends on | Proof command |
|---|---|---|---|---|
| 1 | The envelope, error codes, hints and the manifest types | `app/src/edge/harness/protocol.ts`, `protocol.test.ts` | none | `node --test app/src/edge/harness/protocol.test.ts` |
| 2 | Sessions: lease, token-bucket pace, keep-alive probe | `app/src/edge/harness/session.ts`, `session.test.ts` | none | `node --test app/src/edge/harness/session.test.ts` |
| 3 | The primitives with network redaction and the forbidden-control filter | `app/src/edge/harness/primitives.ts`, `primitives.test.ts` | none | `node --test app/src/edge/harness/primitives.test.ts` |
| 4 | The release gate: fixture test, field gate, canary, semver rollback | `app/src/edge/harness/release.ts`, `release.test.ts`, `fixtures/` | 1, 2 | `node --test app/src/edge/harness/release.test.ts` |
| 5 | The repair trigger, empty-is-not-broken and the 3-round loop, with the 10-mutation drill | `app/src/edge/harness/repair.ts`, `repair.test.ts` | 4 | `node --test app/src/edge/harness/repair.test.ts` |
| 6 | Route health and order on `param` rows, with the router test | `app/src/edge/harness/health.ts`, `health.test.ts` | 1 | `node --test app/src/edge/harness/health.test.ts` |

## Worked example

All numbers here are examples.

1. A browser-only site's seller page changes and the `end` endpoint now nests the listing under `data.item`. The live `end` adapter, v2.3.1, had a success posterior of Beta(188, 4) after its last fold.
2. Over 12 calls, 9 return `page_changed` because `listing_id` is missing. The posterior becomes Beta(191, 13), mean 0.936. P(success < 0.9) is still low, but the third `page_changed` in a row opens the breaker.
3. The write does not fall to another route. Reconciliation reads its outcome before any further action.
4. `adapter_author` starts. The empty-is-not-broken check confirms the listing exists through the fetch engine. Round 1 maps `listing_id` to `data.item.id`, a patch, so the release is v2.3.2.
5. The fixture still holds the old shape, so the gate fails on the live read. Recon shows the site changed, so the fixture is re-recorded from the new page, with output unchanged and the version kept as a patch.
6. Round 2 passes all four checks. The canary serves 20 calls, all of which succeed, and v2.3.2 goes live.
7. Connect showed the pending reconciliation until the read-back settled the outcome; the repair did not repeat the write.
