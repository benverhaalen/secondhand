# Connect

Today a seller signs in to five sites, keeps each one signed in, and checks every app by hand for messages, offers and sales. Connect links each site once, through the site's own sign-in in a page we host, and from then on the harness for that site acts and checks for them in the background as the person's own agent ([Nate](../../product/words.md#2026-11-14-nate-the-person-signs-off-so-it-is-their-own-agent-acting)). We host every browser ourselves; no browser vendor runs a session ([Nate](../../product/words.md#2026-11-14-nate-host-all-engines-ourselves-and-can-the-persons-own-device-do-the-work)).

Nate on how it runs ([words](../../product/words.md#2026-11-14-nate-innovate-without-overcomplicating-and-the-agent-framework)): "the agentic frameworks we custom design to cloud based browser use drive the platform actions for the user in the background, and autonmously monitoring and periodically checking, unless fired and hooked with an app event like someone messaging back about a listing".

The whole section below is an *agent proposal* built on the decided harness per marketplace ([decisions](../../product/decisions.md#2026-11-14-each-marketplace-gets-its-own-harness-run-on-browser-use-cloud)) and the runtime in [product.md](../product.md) §6. Nate's later words replace the decision's hosting part: our own hosted browsers, not Browser Use cloud, and no Depop partner access ([Nate](../../product/words.md#2026-11-14-nate-no-depop-partner-access-so-build-an-ai-driven-workaround)); the routes are in [protocol and adapters §3.5 to §3.8](../engines/protocol-and-adapters.md#35-starting-routes-site-by-verb). *Agent proposal*; Ben's agreement not recorded.

## What the person does and sees

| # | Moment | What they see |
|---|---|---|
| 1 | First launch is setup ([decisions](../../product/decisions.md#2026-11-14-first-launch-is-setup-first)) | You > Accounts: eBay, Facebook, Depop, Poshmark, Mercari, OfferUp and Grailed, each with a one-line risk for that site and a Link button |
| 2 | Link eBay | eBay's own sign-in in a sheet (OAuth). Back in the app the row reads ok, with what the harness can do there |
| 3 | Link Facebook, Depop, Poshmark, Mercari, OfferUp or Grailed | a one-time sign-in link opens the site's real login in a page we host. They sign in once; the session is kept as a secret. A switch, off by default, saves the password so the sign-in job can sign in again; only that job reads it and one tap deletes it ([Nate](../../product/words.md#2026-11-14-nate-passwords-are-kept-opt-in-as-encrypted-secrets-we-cannot-see)) |
| 4 | A session expires | `account_stale`: a one-tap re-link on the row |
| 5 | Right after a site links | "Found 41 listings" with Bring them in. Each imported listing becomes an item and its live listing; a listing that looks like an item we hold opens a `merge_items` card |
| 6 | Purchases (*agent proposal*) | "Found 41 purchases" with Bring them in: each becomes an item in `owned` with its cost set, plus an `order` of kind purchase |
| 7 | Any day | each row: health pill, the verbs that run there and the ones that open the site instead, last checked, and the risk line |
| 8 | Health changes | `expiring`: a quiet line on the row. `broken`: a `relink` card in Today. The site warned or limited the account: a `site_warning` card and the row goes `paused` |
| 9 | Unlink | the row's menu; the harness stops acting there; history and orders stay |

OfferUp and Grailed link as search and price only: posting there is planned, not built ([words](../../product/words.md#2026-11-14-grailed-and-offerup-posting-planned-not-built)).

## Design choices

| Choice | Options considered | Picked | Why | What would change it |
|---|---|---|---|---|
| How an account links | official OAuth ([platform-access](../../research/connect/nate/platform-access.md)); a cloud browser with a saved login ([posting-browser-use-ebay](../../research/list/ben/posting-browser-use-ebay.md)); a session on the phone; an extension in the person's browser ([crosslister-teardown](../../research/cross-cutting/nate/crosslister-teardown.md#5-capability-by-tool)) | eBay by OAuth in a sheet; every other site by a one-time sign-in on the site's real login in a page we host, the session then run by our own adapter (*agent proposal*, [protocol and adapters §3.6](../engines/protocol-and-adapters.md#36-how-every-event-reaches-the-system-agent-proposal)) | Nate: OAuth where possible, the signed-in harness elsewhere ([words](../../product/words.md#2026-11-14-nate-hooks-for-every-app-event-what-we-poll-what-the-platform-triggers-sign-in-by-oauth-where-possible)); Facebook has no OAuth for US sellers, Depop gives us no partner access, Poshmark and Mercari have no API | a partner grant on a site gives it an API route, measured against our adapter |
| Where sessions run | the phone's web view; our hosted headless browser; plain requests with the session's cookies; a browser extension ([privacy-and-data](../../research/cross-cutting/nate/privacy-and-data.md#9-session-tokens-and-cookies-keychain-versus-server-vault), [protocol and adapters §3.8](../engines/protocol-and-adapters.md#38-our-own-api-run-in-the-cloud-what-we-take-from-apify-agent-proposal)) | all four: the phone's web view while the app is open; our hosted browser, in a container on our compute, for watchers and overnight work; plain requests where the site allows; the extension as an option (*agent proposal*) | Keychain `WhenUnlockedThisDeviceOnly` cannot be read while the phone is locked, so background work needs our hosted copy of the session ([Nate](../../product/words.md#2026-11-14-nate-host-all-engines-ourselves-and-can-the-persons-own-device-do-the-work)) | App Review's reading of guideline 5.1.1(v) on a server-held session (test below) |
| When the harness looks | a fixed poll per site; events only; one loop with two triggers ([email-and-notification-detection](../../research/sold/nate/email-and-notification-detection.md)) | one loop: events set `next_check_at` to now, sweeps pick rows whose time has passed | Nate's words; a fixed poll is either slow or wasteful; Vendoo polls every 10 min | measured lag of each site's events against the sweep |
| Sale detection on Poshmark and Mercari | sold-page poll; Gmail push; a forwarding filter ([email-and-notification-detection](../../research/sold/nate/email-and-notification-detection.md)) | the public-page check every 1 to 2 min as the frequent check, the signed-in read to confirm; no sale email ([protocol and adapters §3.6](../engines/protocol-and-adapters.md#36-how-every-event-reaches-the-system-agent-proposal), [Nate](../../product/words.md#2026-11-14-nate-the-signed-in-harness-where-the-account-adds-capability-faster-public-paths-elsewhere)) | the public page is cheap and needs no session; Gmail read scopes need a yearly assessment and a forwarding filter can be spoofed | measured lag of the public page against the signed-in read |
| One session at a time | parallel jobs on one login; a lease per account ([cloud-browsers-and-detection](../../research/replay/nate/cloud-browsers-and-detection.md#13-replay-relevant-facts)) | a lease: one job drives an account's session, the next waits | a busy session returns 409; one login acting in two places looks like a bot | test accounts that tolerate two sessions without a warning |
| Browser identity | rotating proxies; one stable US address per account ([cloud-browsers-and-detection](../../research/replay/nate/cloud-browsers-and-detection.md#12-comparison-table)) | one hosted browser per account, with one steady US address | a cookie replayed from another IP fails; Poshmark flags server IPs | a site that warns on the stable IP |
| A verb a site lacks | hide the site; a one-tap handoff that opens the site ([crosslister-teardown](../../research/cross-cutting/nate/crosslister-teardown.md#5-capability-by-tool)) | the handoff | the person still finishes the job in two taps | none |

## Data flow

```mermaid
flowchart LR
  P["phone: Link"] -->|"Apps API POST /v1/accounts: job"| S["eBay OAuth, or one-time sign-in in our hosted page"]
  S -->|"Databricks secret scope: account token_ref, health ok"| A["Lakebase account"]
  A -->|"import job, harness read_stats and read_orders: item origin import or purchase, listing, order"| I["Lakebase item, listing, order"]
  T["event or check_due"] -->|"lease, policy in code, harness verb, read-back"| H["harness per site"]
  H -->|"Delta event, MLflow trace: route, fell_back, ms"| E["next_check_at or decision"]
```

## Reads and writes with the proof layer

| Entity | Connect writes | Evidence or guard |
|---|---|---|
| `account` | site, route (`harness`, `search_only`), health, capabilities, linked_at, token_ref | capabilities come from the harness probe at link; the probe's `job_id` and trace back each one |
| `item` | origin `import` or `purchase`; title, category, cost from the site | each `attribute` carries `evidence` of kind `lookup`, `ref` the snapshot of the site page read, `captured_at`, `extractor_version` |
| `listing` | imported live listings with `external_ids`, `state` live, `next_check_at` | read back from the site at import |
| `order` | kind purchase, price, site, `external_order_id` | the order page snapshot |
| `decision` | `relink`, `site_warning`, `merge_items` | `merge_items` shows the matching facts and their evidence |
| `event` | link, unlink, health change, import, every harness verb | `route`, `fell_back`, `ms`, `trace_id` |

Every number on the screen ("Found 41 listings", last checked) is a guarded number with a `citation` (metric, basis_ids of the rows found). Connect sends nothing a buyer reads, so it runs no `claim_check`; the verbs that do send (`post`, `send_message`) run it inside their jobs.

## States

| Account health | Means | Moves to | The person sees |
|---|---|---|---|
| `ok` | the last verb or probe read back | `expiring`, `broken`, `paused` | a green pill |
| `expiring` | a token or session near its end (eBay refresh at 18 months) | `ok` on refresh, `broken` on expiry | a quiet line |
| `broken` | sign-in needed (needsReauth) | `ok` after relink | a `relink` card |
| `paused` | the site warned or limited the account, or the person paused it | `ok` when the person resumes | a `site_warning` card; no outward verb runs |

Sign-in in progress is the account job's stage, not a health value. Job stages: `import` runs `read`, `match`, `write`; `unlink` runs `stop`, `revoke`.

## Harness and systems

### Verbs and capability per site

Every harness has the same 14 verbs: `post, revise, end, relist, read_listings, read_inbox, send_message, read_offers, answer_offer, make_offer, read_orders, read_stats, search, save` ([product.md](../product.md) §6, Harnesses; [protocol and adapters §1](../engines/protocol-and-adapters.md#1-what-it-decides)). What runs underneath:

| Site | Route | Native underneath | Handoff (opens the site) | Detector (asserted) | Risk line shown |
|---|---|---|---|---|---|
| eBay | own adapter first; API last fallback | Inventory and Offer, Fulfillment plus Notification, Message API, Best Offer and Negotiation, Browse | none | Akamai | "eBay bars AI agents from ordering without your review" |
| Facebook | harness, our hosted browser | every verb in the browser | `read_offers`, `answer_offer` (no offers) | Arkose in some flows; warns before it restricts | "Facebook limits automated use; new listings capped at 20 a month" |
| Depop | own adapter over the signed-in session; no partner access ([protocol and adapters §3.7](../engines/protocol-and-adapters.md#37-depop-without-partner-access-agent-proposal)) | the commands the site's own pages call, authored by agents and run as code; a browser agent when a command breaks | none | Cloudflare | "Depop bans scraping without permission" |
| Poshmark | harness, paced | every verb in the browser | none | Cequence and reCAPTCHA | "Poshmark bans automation; accounts were suspended in Nov 2025" |
| Mercari | harness | every verb in the browser | none | Cloudflare | "Mercari bans bots and may hold funds" |
| OfferUp, Grailed | search and price only | `search`, `read_stats` through Firecrawl, Exa and our own fetch engine; no paid fetcher ([Nate](../../product/words.md#2026-11-14-nate-we-do-not-pay-for-apify-priced-tools-prove-it-can-be-done-and-ours-is-free)) | `post` and the rest | not researched | "search only" |

Detection facts are from [cloud-browsers-and-detection §2](../../research/replay/nate/cloud-browsers-and-detection.md#20-what-the-sources-say-about-detection-layers).

### One loop, two triggers

| Site | Events that fire a job | Sweeps (`check_due`) |
|---|---|---|
| eBay | Notification topics (order, offer, message), signature checked; whether they trigger a job is open for Nate ([open questions](../open-questions.md)) | rows whose `next_check_at` passed |
| Depop | signed-in watchers on the notification feed, inbox, offers and orders (no webhooks) | 1 to 2 min hot, 15 min live, hourly quiet |
| Poshmark, Mercari | the public listing page every 1 to 2 min; a hit triggers the signed-in read | inbox and orders by signed-in watcher, tiers in [card 15](../determinations/managing-and-buyers.md#15-when-to-check-again) |
| Facebook | none found | everything by sweep |
| Every site | the person's tap | |

Each trigger becomes one `job` with an idempotency key; a repeat joins the running job. Then the lease, the policy check in code, the verb, the read-back, the event and trace, and either a decision or a new `next_check_at`. The tiers for `next_check_at` (floor, ceiling, and how a change shortens them) are owned by [managing and buyers card 15](../determinations/managing-and-buyers.md#15-when-to-check-again); any event sets it to now.

### Lease and pacing

| Site | Pace set in the harness | Quiet hours |
|---|---|---|
| eBay | API call limits; browser steps 1 per 2 to 5 s | none for API reads |
| Depop | browser steps 1 per 2 to 5 s | local night for browser steps |
| Poshmark | 1 action per 2 to 5 s (inferred) | local night |
| Mercari, Facebook | 1 action per 2 to 5 s (starting value) | local night |

A second job for the same account waits for the lease. A `paused` account takes reads only after the person resumes.

### Read-back and reconcile

Every outward verb reads the site back before the event is written. A post with no read-back stays `posting` (postUnknown) until `reconcile` resolves it. `reconcile` runs nightly per account and right after a relink: it compares the site's listings and orders with ours, writes what it finds as events, and raises `site_changed_listing` ([list.md](list.md)) when a listing differs. What happens when a site changes after the person's tap is open in [product.md](../product.md#9-open-for-ben-and-nate).

### Systems

| Piece | Used for |
|---|---|
| Our hosted headless browsers, one per account with a steady address | sign-in sessions, watchers and every browser verb |
| Databricks secret scope | eBay refresh token, site sessions, and opt-in saved passwords that only the sign-in job reads, each by `token_ref`, every read audited |
| Lakebase | `account`, `job`, the lease row, `next_check_at` |
| Delta through the logger, MLflow | events and one trace per job |
| Lakeflow jobs | `check_due`, `reconcile` |
| Agent framework | open: DurableAgentServer or Flue; a one-site trial on `read_inbox` then `send_message` decides |

## Contract

| Endpoint | Body | Returns |
|---|---|---|
| `POST /v1/accounts` | `{site}` | `201 {account_id, oauth_url}` or `{account_id, signin_session_url}`; `409 stale` if already linked |
| `GET /v1/accounts` | | each account: site, route, health, capabilities, last checked, risk line |
| `POST /v1/accounts/:id/import` | `{kind: listings or purchases}` | `202` `import` job |
| `DELETE /v1/accounts/:id` | | `202` `unlink` job |
| `POST /v1/decisions/:id/act` | `relink`, `site_warning`, `merge_items` options | `relink` returns a new sign-in session |

Errors use `{code, message, failed_step, retry}`; a site refusing sign-in is `502 site_failed` with `retry.by: user`. Ids: `acc_`, `job_`, `dec_`.

## Who may act

| Action | Who |
|---|---|
| Link, relink, unlink, resume a paused account | the person only |
| Import | the person's tap; merging with a held item is `merge_items`, ask |
| Probe health, refresh a token, sweep | auto |
| Any outward verb on a `paused` or `broken` account | nobody until it is `ok` |

## How it fails

| Failure | What happens |
|---|---|
| Sign-in abandoned in the sheet | the job fails at its sign-in stage; the row stays unlinked |
| Captcha or a second factor | the job pauses; the person answers it themselves; we solve no bot check |
| Token or cookie expired | `broken`, a `relink` card; jobs for that account wait |
| The site warns or limits | `paused`, a `site_warning` card with the site's own words |
| Session seen from a new address | the sign-in fails; the harness keeps the stable IP and asks for a relink |
| Lease held too long | the job times out at its stage and the next job takes the lease |

## How we will know it works

| Measure | Bar | Source |
|---|---|---|
| Time from a sale to our knowing on Poshmark and Mercari | inside the delist bar in [sold.md](sold.md#how-we-will-know-it-works); 5 test sales, all detected | Vendoo polls every 10 min ([email-and-notification-detection](../../research/sold/nate/email-and-notification-detection.md)) |
| Time from an eBay push or a Depop watcher hit to the job starting | under 1 min p95 for eBay; inside the watcher's tier for Depop | our test; no published figure found |
| Accounts that stay `ok` over 30 days on test accounts | every site, no `site_warning` | test accounts per site |
| Two jobs on one account at once | never, in the traces | MLflow traces |
| Secrets in prompts, logs or traces | none | `node spec/log.mjs` and the secrets check |
| A server-held session under App Store 5.1.1(v) | passes App Review | a TestFlight review build; untested |

## Facts to know

| Fact | Mark | Source | At public launch |
|---|---|---|---|
| eBay OAuth: access 2 h, refresh 18 months | observed | [platform-access §2](../../research/connect/nate/platform-access.md#2-ebay) | unchanged |
| eBay User Agreement bars LLM bots and buy-for-me agents ordering without human review; effective 2026-06-28 on the live page, 2026-02-20 in Ben's note | observed | [platform-access §2](../../research/connect/nate/platform-access.md#2-ebay) | opening the page again settles the date; buying stays the person's tap |
| eBay API licence bars storing user IDs and passwords | observed | [platform-access §2](../../research/connect/nate/platform-access.md#2-ebay) | unchanged: an eBay password is never held; saved passwords are opt-in and only for sites without OAuth |
| Facebook has no OAuth for US sellers; the partner API is EU and EEA only; the Automated Data Collection Terms apply | observed | [platform-access §3](../../research/connect/nate/platform-access.md#3-facebook-marketplace) | the person's own agent acts on their signed-in session ([Nate](../../product/words.md#2026-11-14-nate-the-person-signs-off-so-it-is-their-own-agent-acting)) |
| Depop partner access is gated; PKCE tokens 1 h and 1 year; scraping banned unless authorised | observed | [platform-access §4](../../research/connect/nate/platform-access.md#4-depop) | Nate: no partner access; the signed-in session is the route |
| Poshmark has no API and bans automation, likes, shares, follows and delete-and-repost; suspensions in Nov 2025 were lifted within 24 h | observed, the lift asserted | [platform-access §5](../../research/connect/nate/platform-access.md#5-poshmark) | a written allowance, or the risk line stays |
| Mercari has no public API, bans bots and may suspend and hold funds; it stays in the set | asserted | [platform-access §6](../../research/connect/nate/platform-access.md#6-mercari), [decisions](../../product/decisions.md#2026-11-14-mercari-stays-in-the-platform-set) | a written allowance, or the risk line stays |
| Terms side by side | observed | [platform-access §7](../../research/connect/nate/platform-access.md#7-cross-marketplace-comparison-of-terms) | each term becomes a `rights` tag that is enforced |
| Gmail read scopes are restricted and need a yearly security assessment ($540 to $1,800) | asserted | [email-and-notification-detection](../../research/sold/nate/email-and-notification-detection.md) | sale email is not used |
| App Store rules on account deletion and data | observed | [privacy-and-data §2](../../research/cross-cutting/nate/privacy-and-data.md#2-apple-app-store-rules) | unchanged |
| Deletion removes sessions and tokens | observed | [privacy-and-data §11](../../research/cross-cutting/nate/privacy-and-data.md#11-retention-and-deletion) | unchanged |
| Browser Use profiles keep a login across sessions | observed | [posting-browser-use-ebay](../../research/list/ben/posting-browser-use-ebay.md#browser-use-for-sites-without-an-api-poshmark-depop-mercari-facebook-marketplace) | shows a session can be kept; ours run in our own hosted browsers |

Rules that protect people, unchanged: a home address goes out only on the person's tap; buyers' data is handled as in [privacy-and-data](../../research/cross-cutting/nate/privacy-and-data.md); a recalled product is not listed; the risk to each real account is shown on its row.

## Signing in to secondhand

*Agent proposal*, from Ben at 02:46: "onboarding. first is getting everything connected and getting accounts. like obviously sign in with apple, google, email. and then connecting the platforms you want to use" ([words](../../product/words.md#2026-11-15-the-new-button-gradients-that-carry-state-seller-intents-onboarding-and-build-ready)). Everything above is about linking marketplaces; this is the person's own secondhand account, which comes first. The screens are in [pages §6.1](../pages.md#61-first-launch-onboarding).

### The order on first launch

| # | Step | Why it is here | Skippable |
|---|---|---|---|
| 1 | Sign in with Apple, Google or an email code | nothing else can be saved without an account; a visitor on the website can still search ([visitors](../product.md#visitors-and-full-users)) | no |
| 2 | Pick the sites you use | sets which sheets follow; also tells the plan which sites to consider | yes |
| 3 | Link each picked site (the table at the top of this page, moments 2 to 4) | the decided setup-first order ([decision](../../product/decisions.md#2026-11-14-first-launch-is-setup-first)) | each one |
| 4 | Bring in what we found (listings, purchases) | the person's existing shop appears at once | yes |
| 5 | Gmail for sale emails | Poshmark and Mercari sale detection | yes |
| 6 | Pickup windows and meetup spot, or Ask me every time | decided | yes |
| 7 | Notifications | the three kinds that interrupt; the rest batched | yes |

Progress is saved after each step on the server, so a person who quits at step 4 resumes there on any device.

### How the person signs in

| Method | On the phone | On the website | We keep |
|---|---|---|---|
| Apple | the native Sign in with Apple sheet (`expo-apple-authentication`, *asserted*) | Sign in with Apple JS | Apple's stable user id; the email, which may be Apple's private relay |
| Google | Google's own sign-in (`@react-native-google-signin/google-signin` or `expo-auth-session`, *asserted*) | Google Identity Services | Google's subject id and verified email |
| Email | a 6-digit code sent to the address; no password | the same | the verified email (hashed in `user.email_ref`, as the canon has it) |

No passwords are ever held, for the app or for a marketplace. A store rule to check before submission: an app that offers Google sign-in must also offer a privacy-focused option such as Sign in with Apple (App Store Review Guideline 4.8, *asserted* from memory; read the live guideline before submission). Account deletion is in the app already (`DELETE /v1/me`), and deleting an account that used Apple must also revoke its Apple token (*asserted*; check Apple's current docs).

**Same person, two methods.** A Google sign-in and an email code with the same verified address are one account. Apple's private relay address never merges on its own; the person links another method from You > Account.

### Design choices

| Choice | Options considered | Picked (*agent proposal*) | Why | What would change it |
|---|---|---|---|---|
| Who runs sign-in | a hosted service (Clerk, Supabase Auth, Firebase Auth); a library on our edge storing users in our own Postgres (Better Auth, which has an Expo integration, *asserted*); our own token checks | a library on the edge (Better Auth) with its tables in Lakebase, next to `user` | the edge already exists in [app/](../../app/README.md) as Expo Router API routes; one database for users and everything else; no second vendor holding identities | Lakebase unreachable from the edge in the first hour (the [Databricks fallback clock](../../product/decisions.md#2026-11-14-databricks-runs-the-whole-backend-with-a-hybrid-fallback)): then Clerk, which needs no database of ours |
| Session on the phone | a cookie; a short access token plus a refresh token | access token about 1 h, refresh token in the Keychain through `expo-secure-store` | the canon already puts the app's own session in the Keychain (§6, secrets) | none |
| Where the user id comes from for the API | the edge forwards a verified user id with its service identity; the phone holds a Databricks token | the edge forwards it, as option A in [product §6](../product.md#front-door-open-9) | an App accepts only Databricks sign-in | the hosting probe passing option B |

### Contract (new; asked of Nate in [packet 47](../../.agents/team/packets/team/47-what-the-pages-need-from-the-backend.md))

| Endpoint | Body | Returns |
|---|---|---|
| `POST /v1/auth/apple` | `{identity_token, nonce, name?}` | `{access_token, refresh_token, user, created}` |
| `POST /v1/auth/google` | `{id_token}` | the same |
| `POST /v1/auth/email/start` | `{email}` | `202`; a code is sent, valid 10 minutes, 5 tries |
| `POST /v1/auth/email/verify` | `{email, code}` | the same as Apple |
| `POST /v1/auth/refresh` | `{refresh_token}` | a new pair; the old refresh token stops working |
| `POST /v1/auth/signout` | | `204`; the refresh token is revoked |
| `GET /v1/me` | | `user` plus `onboarding {done_steps[], finished_at?}` and `auth_methods[]` |
| `PATCH /v1/me` | `{onboarding_step?, notification_pref?, push_token?, tutorial_seen?}`; `onboarding_step` adds one step to `done_steps`; `notification_pref[]` already exists on `user`, only the write is new | the user |
| `POST /v1/auth/link/{apple,google,email}` | the same body as sign-in, with the session | `auth_methods[]`; links a second method to this account |

Errors follow §7: a wrong or expired code is `400 invalid` with `retry.by: user`; too many tries is `429`.

### How it fails

| Failure | What happens |
|---|---|
| The person cancels the Apple or Google sheet | back on Welcome, nothing saved |
| The email code never arrives | Resend after 30 s; a different address |
| Apple hides the email | the account works; the relay address is stored; nothing merges on its own |
| The refresh token is revoked or expired | the next call answers `401`; the app shows Welcome with the last method first |

## Open for Ben and Nate

- Who runs app sign-in: Better Auth on our edge with users in Lakebase (recommended), or a hosted service such as Clerk ([Signing in](#signing-in-to-secondhand)). Nate owns the edge.

Otherwise none. The framework choice and the after-the-tap conflict are open in [product.md](../product.md#9-open-for-ben-and-nate).

## Needs from the shared model

- A verb, or a named use of `read_stats`, that reads the seller's own active listings for `import`.
- The risk line's text per site as a field on `account.capabilities`.
- `user.auth_methods[] {provider, subject_hash, linked_at}` with provider one of apple, google, email; `user.onboarding {done_steps[], finished_at?}`, `user.push_token_ref`, and the `/v1/auth/*` endpoints in [Signing in](#signing-in-to-secondhand).
