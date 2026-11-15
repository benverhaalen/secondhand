# Protocol and adapters engine

*agent proposal* (the whole file). Canon names in [product.md](../product.md) win. This file builds the engine behind [the harness protocol](../product.md#the-harness-protocol): the contract every caller uses, the sessions it runs in, and the agent that writes, tests, watches and repairs one adapter per site and verb. Direction: our own protocol for every site and every action ([words](../../product/words.md), Nate, 2026-11-14).

## 1. What it decides

| Output | Shape | Consumed by |
|---|---|---|
| The call result | `harness.call(site, verb, args)` returns `{ok:true, data, meta}` or `{ok:false, error:{code, message, hint}, meta}`; `meta = {route_id, adapter_version, ms, fell_back, observation_ids[]}` (canon) | every feature that touches a marketplace: [list](../features/list.md), [sold](../features/sold.md), [messages](../features/messages.md), [price](../features/price.md), [market](../features/market.md), [connect](../features/connect.md), the [negotiation](negotiation.md) and [valuation](valuation.md) engines |
| The route for this call | a `route_table` row, chosen per call by the [source router](../product.md#source-router-agent-proposal) | the runtime |
| An adapter release | `adapter_release` (new name): `{site, verb, version, status: candidate, live, retired or rolled_back, gate: {fixture, live_read, round_trip, forbidden_controls}, canary_calls, released_at}` | the router (only `live` and `candidate` rows serve) |
| Route health | Beta success and completeness per route, held as `param` rows ([real-time weights](../product.md#real-time-weights-agent-proposal)) | router order, connect's health state (ok, expiring, broken, paused), the repair trigger |
| A repair | an `adapter_author` job (canon) with `{trigger, rounds, patch, result}` | the router, the ops view |

The 14 verbs are the canon set: `post, revise, end, relist, read_listings, read_inbox, send_message, read_offers, answer_offer, make_offer, read_orders, read_stats, search, save`.

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

- **Where a session runs.** A Browser Use cloud profile per (person, site), which keeps the login while the phone is locked ([decisions](../../product/decisions.md#2026-11-14-each-marketplace-gets-its-own-harness-run-on-browser-use-cloud)). The person's own device is the second route, chosen per site where it lowers account risk (canon). The device route runs the same recipes in the app's own browser view, only while the app is open.
- **Login.** The person signs in inside the cloud browser; we never see the password; tokens and cookies never enter a prompt, a log or a fixture.
- **Keep-alive.** A probe read (the first page of `read_listings`) every 30 min, as in [card 17](../determinations/managing-and-buyers.md#17-whether-an-account-is-healthy-or-at-risk). Two failed probe reads mark the session `broken`. A login wall on a probe is `auth_expired`.
- **Lease.** One job drives an account's session at a time: a `session_lease` row taken with `FOR UPDATE SKIP LOCKED` and a TTL. A busy lease answers 409 (replay's rule). A write holds the lease through its read-back.
- **Pace.** A token bucket per (account, site), filled at the manifest's `pace`. Browser steps run one per 2 to 5 s with jitter, quiet hours at night, one profile per stable US IP ([connect](../features/connect.md)). The learned pace moves down at once on `rate_limited`, `blocked` or a site warning. It moves up 10% only after 14 clean days and never past the manifest cap.

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
4. **Generating the adapter.** The model writes the recipe in one fixed template: `{manifest, steps[]}`, using only the primitives and in-page fetch, with no imports. Code lints it: every manifest field is produced, every control used is in `controls[]`, and no literal cookie or token appears.
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

**Signed-in or public, by what the read needs** ([Nate](../../product/words.md#2026-11-14-nate-the-signed-in-harness-where-the-account-adds-capability-faster-public-paths-elsewhere): "For the things we can leverage with user auth ... its better to adhere to that harness. Of course faster and cheaper for when better, but not when we are limitting capability."). A linked account's session is stored and leased to background jobs, overnight included, so a job acting for the person never waits for them.

| The read or action | Route | Why |
|---|---|---|
| Anything the site ties to the person's account: their listings, orders, offers, messages, their own stats and watcher counts, what the site shows or ranks for them, every write | the signed-in harness, always | the public page does not carry it, or carries less |
| Broad market reads: sold prices, top listings, a product's page, a seller's public shop, reviews | the fastest public path (a server fetch, embedded page data, our fetch engine) | no account is needed, and it works for a person with nothing linked |
| A read that both can serve, such as "did my listing sell" | the public path as the cheap, frequent check; the signed-in read to confirm and for the detail only it has (the paid order, the buyer, the amount) | faster and cheaper where it loses nothing; never chosen where it would limit what we can do |

The route table holds this as `needs_session` per verb and field. A public route is never promoted over a signed-in one for a field it cannot return, whatever its speed.

Each cell is the first route recon targets (*inferred* from the canon site table at [product.md](../product.md#the-harness-protocol), which puts our own adapter first everywhere). An API named in a cell is the last fallback and a fact on record. "page" means a page-driving recipe; "endpoint" means recon expects an internal endpoint.

| Verb | eBay | Facebook | Depop | Poshmark | Mercari | OfferUp | Grailed |
|---|---|---|---|---|---|---|---|
| `post` | adapter, endpoint; Inventory and Offer APIs | adapter, page | adapter, endpoint; products API if granted | adapter, page | adapter, page | adapter, planned ([words](../../product/words.md#2026-11-14-grailed-and-offerup-posting-planned-not-built)) | adapter, planned (same) |
| `revise` | adapter, endpoint; Inventory API | adapter, page | adapter, endpoint; products API | adapter, page | adapter, page | adapter, planned | adapter, planned |
| `end` | adapter, endpoint; withdrawOffer or EndItem | adapter, page | adapter, endpoint; mark as sold | adapter, page | adapter, page | adapter, planned | adapter, planned |
| `relist` | adapter, endpoint (a new item id) | adapter, page | adapter, endpoint | adapter, page; always asks ([money D15](../determinations/money.md#d15-markdown-path-stale-and-relist)) | adapter, page | adapter, planned | adapter, planned |
| `read_listings` | adapter, endpoint; GetMyeBaySelling | adapter, page | adapter, endpoint; products list | adapter, page | adapter, page | adapter, page | adapter, page |
| `read_inbox` | adapter, endpoint; Message API | adapter, page | adapter, page (no inbox in the API) | adapter, page | adapter, page | link-out | link-out |
| `send_message` | adapter, endpoint; Message API | adapter, page | adapter, page | adapter, page | adapter, page | link-out | link-out |
| `read_offers` | adapter, endpoint; GetBestOffers | offers arrive as messages, read by `read_inbox` | adapter, page (no list-offers endpoint) | adapter, page | adapter, page | link-out | link-out |
| `answer_offer` | adapter, endpoint; RespondToBestOffer | a reply by `send_message` | adapter, page | adapter, page | adapter, page | link-out | link-out |
| `make_offer` | adapter, page (a Best Offer binds the buyer) | a message to the seller | adapter, page | adapter, page | adapter, page | link-out | link-out |
| `read_orders` | adapter, endpoint; Fulfillment plus Notification | adapter, page | adapter, endpoint; orders plus webhooks | adapter, page; sale email | adapter, page; sale email | n/a | n/a |
| `read_stats` | adapter, endpoint (views, watchers) | adapter, page | adapter, endpoint (likes, bag counts) | adapter, page | adapter, page | adapter, page | adapter, page |
| `search` | adapter, endpoint; Browse | adapter, endpoint; ScrapeCreators, measured | adapter, endpoint | adapter, endpoint | adapter, endpoint | adapter, endpoint; Firecrawl; Apify last | adapter, endpoint; Firecrawl; Apify last |
| `save` | adapter, endpoint (watch) | adapter, page | adapter, endpoint (like) | adapter, page; runs on the person's tap (likes are named in the guidelines) | adapter, page | adapter, page | adapter, page |

The site terms behind each column are facts on record in the canon table and become `rights` tags. They are not limits on this design ([licences](../product.md#licences-terms-and-the-rules-that-protect-people)).

### 3.6 How every event reaches the system (agent proposal)

Asked by [Nate](../../product/words.md#2026-11-14-nate-hooks-for-every-app-event-what-we-poll-what-the-platform-triggers-sign-in-by-oauth-where-possible). Every source below writes one row to `event` (id, source, site, account, kind, payload ref, dedupe key), and each row starts exactly one job ([product.md](../product.md#6-systems)). A source never acts; it only reports. The harness confirms a site event by a signed-in read before anything is done about it.

| Source | How it is caught | Delay |
|---|---|---|
| The app | each `/v1` route writes its event in the same transaction as its change (an outbox), so no event is lost if the job runner is down | none |
| A site's own push | a signed webhook to the edge: eBay notifications (order, offer, message, listing ended), Depop order webhooks where partner access is granted. Verified by signature, answered in under 1 s, used as a trigger only | seconds |
| The site's live channel | where a site's own web client receives messages and offers over a held connection, a leased session keeps that connection open for an account during a hot window (an open negotiation, the hour after posting) and turns each frame into an event | seconds |
| Our watchers, signed in | one sweep per linked account reads the pages the site already builds for the person: the notification feed, the inbox, offers, orders, the listings list with its counts. The sweep keeps the last normalised snapshot and emits an event per difference (`offer.received`, `message.received`, `listing.sold`, `listing.ended`, `like.added`, `price.changed`) | by tier: 1 to 2 min while hot, 15 min live, hourly quiet, through the night |
| Our watchers, public | a server fetch of the public listing page for the cheap "is it still up" check ([Ben's prototype](../../research/sold/ben/cheap-sale-detection.md)); a hit triggers the signed-in read | 1 to 2 min |
| The market | the intelligence engine's scheduled gathers per product family write `observation` rows; a change past its threshold is an event (`value_moved`, `demand_rose`) | hourly to daily |
| Databricks | a table change (change data feed), a file arriving in a volume, a job ending, a schedule | seconds to minutes |

**Reading the notification feed first** is what makes a sweep cheap: one page holds everything the site thought worth telling the person, so most sweeps are one read. Each watcher cadence is a `param` per site and state, learned from how often a sweep finds something.

**Signing in.**

| Site | How the person links it | Platform push |
|---|---|---|
| eBay | OAuth in a sheet (refresh token 18 months), which also subscribes us to its notifications; a harness session for what the token cannot do | yes, signed |
| Depop | a harness session: the person signs in once on Depop's real login. No partner access ([Nate](../../product/words.md#2026-11-14-nate-no-depop-partner-access-so-build-an-ai-driven-workaround)), so no OAuth and no webhooks; see [3.7](#37-depop-without-partner-access-agent-proposal) | none; watchers and the live channel |
| Facebook, Poshmark, Mercari, OfferUp, Grailed | no OAuth is offered to sellers ([platform access](../../research/connect/nate/platform-access.md)). The person signs in once on the site's real login, inside a page we host; we never see the password, they complete any second factor, and the session is stored and kept alive | none; watchers and the live channel |

Either way the person does one sign-in per site and nothing after it. A session that expires raises one `account_stale` decision with a one-tap re-link; jobs for that account pause and resume, none are dropped.

### 3.7 Depop without partner access (agent proposal)

Nate: "We are not getting depop partner access, so I want you to create a workaround, utilizing ai driven technology, take into account the frameworks and harnesses i showed you." The same design is the template for every site with no API: Poshmark, Mercari, Facebook, OfferUp, Grailed.

**The idea, from opencli:** the person's own signed-in browser session is the API. Depop's site is a client over its own JSON endpoints, and whatever the person can do on the site, a command running inside their session can do the same way. Agents write and repair the commands; running them is deterministic code with no model in the loop.

| Layer | What it does | Built from |
|---|---|---|
| 1. Link | the person signs in on Depop's real login, in a page we host and, on the phone, in an in-app web view. We never see the password. Two routes result: a cloud session for background and overnight work, and the person's own device while the app is open | the session lease (3.1) |
| 2. Recon agent | drives the signed-in site once per verb with browser-use style control while recording network traffic, embedded page state and the DOM. It finds how the site itself does each thing: the endpoint its web client calls to create a listing, edit a price, read offers, send an offer to likers, read and send messages, read orders and stats, mark sold, delete | browser-use for control, the authoring pipeline (3.3) |
| 3. Adapter author | turns each finding into a command in the opencli shape: typed args in, the one JSON envelope out, strategy `COOKIE` (a fetch made inside the session, so the site's own cookies and tokens ride along) with a page-driving recipe as the second strategy. It writes the fixture and field gate with it | the manifest and release gate |
| 4. Run | deterministic: `harness.call('depop', verb, args)` runs the command in the leased session at a person's pace. No model call on the normal path, so a verb costs one or two requests and runs in under a second | the primitives (3.2) |
| 5. Fallback agent | when a command fails its field gate, a fast decision model (Jev) matches the changed element or field; if that is not enough, an agent drives the page as a person would to finish the action, and the repair loop (3.4) rewrites the command from what it saw | Jev, browser-use, the repair loop |
| 6. Events | no webhooks, so the watchers (3.6): the notification feed and inbox in the session for offers, messages and sales; the public product page for the cheap sold check; the live channel during a negotiation | 3.6 |
| 7. Reading | a language model reads only what is text: a buyer's message, a policy notice, a changed error | the trust and negotiation engines |

**The verbs covered:** `link`, `list`, `edit`, `reprice`, `read_listings`, `read_offers`, `respond_offer`, `send_offer` (to likers), `read_messages`, `send_message`, `read_orders`, `read_stats`, `mark_sold`, `delist`, `relist`. Partner access would have added only webhooks; the watchers replace them at a delay of 1 to 2 minutes while a listing is hot.

**Whose action it is.** Nate: "its not automated access, since the user is technically signing off on it, its like if they called Claude in chrome themselves" ([words](../../product/words.md#2026-11-14-nate-the-person-signs-off-so-it-is-their-own-agent-acting)). The system is the person's own agent: it acts only in their account, only on what they turned on, at a pace a person could keep, and every action is in their activity log. Each site's own terms stay on record as a fact with the account risk shown per site ([connect](../features/connect.md)), and Nate's go is needed before a live run on a site and before it is shown on stage.

**Saved passwords, by choice.** Nate: "we need to keep passwords, we indicate to the user they are set as encrypted environment variables we do not save or can see for ourselves, just used by the system, making it opt in" ([words](../../product/words.md#2026-11-14-nate-passwords-are-kept-opt-in-as-encrypted-secrets-we-cannot-see)). Off by default. When the person turns it on for a site:

| Part | How |
|---|---|
| Where it goes | typed into a field that posts straight to the secret store (a Databricks secret scope, one key per account, `token_ref` on `account`); never to a table, a log, a trace, a model prompt or the app's own storage |
| Who can read it | only the sign-in job's service identity, at the moment a session has expired. No person's role and no other job has read access, and every read is in the audit log. This is what makes "we cannot see it" true, so the build proves it with a test that every other identity is refused |
| What it is used for | signing back in when a session expires, so overnight work does not stop. Nothing else |
| Second factor | a code sent to the person still goes to the person: one prompt, and the job waits. A site's own "trust this device" keeps that rare |
| Removing it | one tap deletes the secret; unlinking the account deletes it too |
| Without it | the stored session is used until it expires, then one re-link prompt |

**What it will not do.** It does not solve or route around a bot check: if a site shows a challenge, the job pauses and the person clears it in their session. It reads no other seller's private data.

**Proof.** Each verb passes on a recorded fixture, then on a test account's live session with the result read back; the mutation drill breaks ten page details and the repair loop restores at least nine; the pace bench records the challenge rate per hundred actions, and the pace is lowered until it is zero.

### 3.8 Our own API, run in the cloud: what we take from Apify (agent proposal)

Asked by [Nate](../../product/words.md#2026-11-14-nate-look-into-apify-and-build-our-own-api-on-cloud-browser-use). Evidence: [apify-and-our-own-cloud-api](../../research/connect/nate/apify-and-our-own-cloud-api.md).

| Apify does | We build |
|---|---|
| Packages each fetcher as an Actor with a typed input and output schema | each adapter and fetcher keeps its manifest and the one envelope; same idea, already ours |
| Server Actors: an Actor that stays up as an HTTP server, scaled by concurrent requests, stopped after an idle timeout | each site's adapter set runs as a small always-ready service behind `harness.call`, scaled the same way, so a verb answers in the time of its requests, with no start-up |
| Its marketplace Actors mostly use no browser: they call the site's own public JSON and search services (Depop 48 listings per request; Grailed's public search; Poshmark and Mercari sold search) at $1.50 to $3.50 per 1,000 results | our public market reads do the same from our own servers, as plain HTTP, in parallel. A browser is used only where a signed-in session is needed |
| Sessions: one session id keeps one IP address and its cookies | one account, one session, one steady address in the person's region, one saved browser profile. A steady, ordinary session is what a real person's use looks like, and it is what keeps a site from challenging it |
| Sells these reads per result | we do not buy them and do not measure ourselves against them. They show only that it can be done, so we develop our own ([Nate](../../product/words.md#2026-11-14-nate-not-a-comparison-we-develop-our-own-on-firecrawl-crawl4ai-browser-use-and-jev-ultrafast): "we can and definitely should develop our own. utilizing the firecrawl web4crawl browser use and jev ultrafast technologies to optimize and perfect the way we gather and delvier information"). How each of the four is used is in the [intelligence engine](intelligence-api.md): Firecrawl's and crawl4ai's fetch, render and extraction patterns for reading pages, browser-use for driving a signed-in page, Jev for the fast typed decisions |
| Exposes Actors as MCP tools | our public search API is already planned as MCP tools |

**Where a session runs: ours and the person's, no browser vendor** ([Nate](../../product/words.md#2026-11-14-nate-host-all-engines-ourselves-and-can-the-persons-own-device-do-the-work): "I feel its best to host all engines ourselves"). Every engine and every browser is hosted by us or runs on the person's own device.

| Route | What it is | Good for | Limit |
|---|---|---|---|
| The phone, while the app is open | the app's own web view is a real browser on the person's device, signed in to the site, on their own network. A command runs inside it the same way as anywhere else | linking (the sign-in happens on their own device), and everything done while they are in the app: posting after a capture, answering an offer, a fresh read. It costs us nothing and is the session a site trusts most | iOS suspends an app shortly after it leaves the screen and grants background time only in short windows it chooses, so nothing overnight |
| Our hosted session | a headless browser in a container on our own compute, holding the person's session and saved profile, one steady address per account | watchers, overnight work, anything while the app is closed | compute we pay for; a session moved from the phone to our address may be asked to verify once |
| Plain requests from our servers | once recon has found the site's own endpoints, most verbs are one or two HTTP requests carrying the session's cookies: no browser at all | most reads and many writes, at the lowest cost and highest speed | sites that bind a session to a browser need one of the two routes above |
| The person's computer, optional | a browser extension that runs commands in their own signed-in browser, the opencli way | heavy sellers who leave a computer on | only while that computer is on |

The route table ranks these per site and verb by measured success, speed and challenge rate, like every other route. A phone cannot host the background sessions; it is the best route while the app is open, and our own hosting covers the rest. Whether our hosted browsers run on Databricks compute or on a small container host of ours beside it is a first-hour workspace check; the design is the same either way.

We do not write code that forges a device fingerprint or solves a challenge; when one appears the person clears it.

## 4. Learning

| What | When | Algorithm | Prior | Switch and rollback |
|---|---|---|---|---|
| Route success and completeness | per call, same transaction | Beta update with about 30 days of forgetting (canon) | Beta(9,1), mean 0.9, for a release that passed its gate | the breaker after 3 straight failures; nightly `param_fold` |
| Route order | per call through the router | `unit_cost / (success x completeness x right_90d)` with 5% exploration (canon) | the manifest's `route_kind` order | `route_probe` hourly; demotion within 20 calls under 30% injected failures |
| Adapter version | per release | the canary rule in §3.3 | the live version | an adapter bump freezes the version's rows; rollback is one UPDATE |
| Pace | per warning, and on day 14 of a clean run | down at once, up 10% at most, capped by the manifest | the manifest's `pace` | any warning returns the pace to its last clean value |
| Repair patterns | per finished repair | the patch, its trigger and the recon diff go into a site note that the next recon reads | none | a note that preceded a failed repair is marked and dropped from recon input |

## 5. Speed

| Moment | Budget | Kept warm | Runs on the event |
|---|---|---|---|
| A read through an endpoint recipe | p95 1.5 s | the leased cloud browser per active account, kept open 10 min after its last job; the manifest and `route_table` in a 60 s cache | the in-page fetch |
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
- choose their own device as the session for a site.

## 7. How it beats what exists

| Rival | What it does (mark) | Ours |
|---|---|---|
| opencli ([repo](https://github.com/jackwener/opencli), [author skill](https://github.com/jackwener/opencli/blob/main/skills/opencli-adapter-author/SKILL.md), [autofix skill](https://github.com/jackwener/opencli/blob/main/skills/opencli-autofix/SKILL.md), [exit codes](https://github.com/jackwener/opencli/blob/main/docs/guide/exit-codes.md); *observed*) | a JSON envelope, sysexits codes, strategies `PUBLIC`, `COOKIE`, `INTERCEPT`, `UI`, `LOCAL`; `adapter check` and `test` with optional fixtures; autofix with hard stops, empty-is-not-broken, 3 rounds and "never relax" fixtures; Facebook adapters only among our sites | **adopted:** the envelope, the hard stops, the empty-is-not-broken check, 3 rounds, never loosening a fixture, preferring the endpoint, never replaying an unknown write. **Better:** opencli states "no row-shape or site-memory gate is imposed" and "There is no draft directory, promotion step or required memory file"; we add a required fixture with a field-presence gate, a candidate release with a canary, semver with keep-old-until-pass and rollback, Beta health with a breaker, a repair started by success dropping as well as by an error, `operation_id` with read-back, pace and lease in the manifest, `policy_refused`, and the forbidden-control filter; its sessions are the person's Chrome, ours a cloud profile that works while the phone is locked |
| Vendoo, List Perfectly ([crosslister teardown](../../research/cross-cutting/nate/crosslister-teardown.md#4-documented-failures-by-class), *observed* and *asserted*) | a 10-minute sale poll; delist on higher tiers; documented delist failures | sale seen within 2 min, delist p95 under 2 min for everyone, every write read back |
| RapidAPI, treg, Apify, API2Cart and Rutter ([parity](../parity.md)) | provider health by latency and uptime; pay per result; a unified commerce schema | health by success, completeness and `right_90d` from our own sales; the 14 verbs as the unified schema |

## 8. Protections

- Tokens and cookies stay in the cloud profile. `network` strips them, the fixture masks run before storage, and the `.agents/checks/` secrets check runs on fixtures.
- The §5 policy check runs in code before every outward verb. Locked kinds stay locked. `post` refuses a recalled product ([trust](trust.md)).
- Authoring and repair write only on the test account. The forbidden-control filter holds on every account.
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
- the share of the 98 site-verb cells that are live with a passing gate (OfferUp and Grailed posting counted as planned);
- delist p95;
- the median time from a repair trigger to a live fix.

The fixed set: the recon captures of all 7 sites, plus every real breakage from the first month, replayed as repair drills.

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

1. eBay changes its seller page and the `end` endpoint now nests the listing under `data.item`. The live `end` adapter, v2.3.1, had a success posterior of Beta(188, 4) after its last fold.
2. Over 12 calls, 9 return `page_changed` because `listing_id` is missing. The posterior becomes Beta(191, 13), mean 0.936. P(success < 0.9) is still low, but the third `page_changed` in a row opens the breaker.
3. The router falls `end` to the eBay API route (`fell_back: true`), and delist p95 holds at 70 s.
4. `adapter_author` starts. The empty-is-not-broken check confirms the listing exists through the fetch engine. Round 1 maps `listing_id` to `data.item.id`, a patch, so the release is v2.3.2.
5. The fixture still holds the old shape, so the gate fails on the live read. Recon shows the site changed, so the fixture is re-recorded from the new page, with output unchanged and the version kept as a patch.
6. Round 2 passes all four checks. The canary serves 20 calls, all of which succeed, and v2.3.2 goes live.
7. Connect showed no break the whole time, because the fallback held.
