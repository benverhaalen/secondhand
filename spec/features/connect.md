# Connect
Status: draft, *agent proposal* except where a line links a decision. Slug: connect. Written 2026-11-14.

The hassle it removes: a seller today keeps five logins, five apps and five copies of the same closet in their head. Connect links each site once, shows plainly what secondhand can and cannot do there, and brings in what the person already has listed and bought, so the app is full on day one.

## What the person does and sees

Lives in first-launch setup and in **You > Accounts** ([first launch is setup first](../../product/decisions.md#2026-11-14-first-launch-is-setup-first); [You tab](../../product/decisions.md#2026-11-14-the-you-tab-leads-with-numbers-and-a-by-site-comparison)). Sites: eBay, Facebook Marketplace, Depop, Poshmark, Mercari ([platform list](../../product/decisions.md#2026-11-14-the-platform-list-is-set)).

1. Setup step one shows the five sites as rows: logo, name, a Connect button. Each step can be skipped.
2. **eBay**: Connect opens eBay's own sign-in sheet (OAuth). The person approves and returns to the app with the row showing Connected.
3. **Depop**: the same OAuth sheet once Depop grants partner access; until then, the cloud browser route below.
4. **Poshmark, Mercari, Facebook**: Connect opens a sheet showing the site's real sign-in page running in the cloud browser. The person types their own password and any 2FA code into it. secondhand never sees the password. When sign-in lands, the sheet closes.
5. Right after a site connects, a row appears under it: "Found 23 listings" and "Found 41 purchases", each with Bring in / Not now.
6. Bring in fills the Sell grid with the person's live listings. Where the same thing is listed on two sites, it shows as one item with two site badges. When unsure, a card asks "Same item?" with both photos.
7. Purchases fill Buy > Bought, each with its photo, price paid and date, and a Sell this button that starts an item from it.
8. Tapping a connected site opens its capability table (below), its health, the last time it worked, and Disconnect.
9. When a session dies, the row turns amber, a "Sign in to Poshmark again" card lands on Today, and tapping it reopens step 4. Nothing outward runs on that site until it is fixed.

**Capability table the person sees** (one per site, from that account's capability rows; values here are today's reading of the research):

| Can secondhand... | eBay | Depop | Poshmark | Mercari | Facebook |
|---|---|---|---|---|---|
| Post a listing | yes, after your tap | yes, after your tap | yes, after your tap | yes, after your tap | yes, after your tap |
| Change the price | yes | yes | yes | yes | yes |
| End or relist | yes | yes | yes | yes | yes |
| See sales | yes, instantly | yes, instantly with partner access | within 2 min | within 2 min | you confirm handover |
| Read and answer messages | yes | through the cloud browser | through the cloud browser | through the cloud browser | through the cloud browser |
| Answer offers | yes | through the cloud browser | through the cloud browser | through the cloud browser | not a site feature for local |
| See views, likes, watchers | views and watchers | likes and bags | from the listing page | from the listing page | from the listing page |

The words come from `product/copy.md`; route names (api, browser, replay) never show. "Linking an account does not imply every capability is available" ([teardown](../../research/cross-cutting/nate/crosslister-teardown.md#5-capability-by-tool), *observed*), so a "no" is shown, never hidden.

**Where Ben's design would make a person stumble.** His posting plan gets the login by Profile Sync from local Chrome ([posting note](../../research/list/ben/posting-browser-use-ebay.md#browser-use-for-sites-without-an-api-poshmark-depop-mercari-facebook-marketplace), *observed*). A phone-first person has no local Chrome to sync from, so sign-in has to happen inside the cloud browser on the phone (step 4). His approval live view is read-only; sign-in needs a live view the person can type into, which is a second, short-lived kind of link.

**What the backend makes possible that the design does not yet use.** Import on connect means the Sell grid, You numbers and Buy history start full, not empty. Health per site lets the system stop every automation on one site the moment that site warns the account (gap G9 in [crosspost-and-delist](../../research/list/ben/crosspost-and-delist.md#edge-cases--lifecyclemjs)).

## What it reads and writes

| Entity | Fields written here |
|---|---|
| `account` | `id`, `user_id`, `site`, `route` (`api`, `browser`), `health`, `capabilities[]` (`{action, available, route, mode_ceiling, note}`), `session_ref` (an id, never the secret), `external_user_id`, `linked_at`, `last_ok_at`, `last_error_code`, `scopes[]`, `token_expires_at` |
| `listing` | imported live listings: `site`, `external_ids[]`, `state = live`, price, url |
| `item` | one per distinct imported listing group, `state = live`; photos copied in as a `capture` with `source = marketplace` attributes |
| `product` | resolved from imported titles and ids where possible |
| `order` | imported sales and purchases, with the site's order id as the dedupe key |
| `decision` | `relink`, `same_item`, `site_warning` |
| `event` | `account.linked`, `account.health`, `account.unlinked`, `import.done` (names proposed, see Needs) |

**What is stored and where:**

| Secret or session | Lives in | Never |
|---|---|---|
| Password | nowhere; typed by the person into the site's own page | seen, logged or stored by us |
| eBay and Depop OAuth tokens | encrypted at rest on the server, key held in a Databricks secret scope; `account.session_ref` points to it | in Lakebase plaintext, Delta, MLflow traces or logs |
| Cloud browser session (cookies) | the person's Browser Use profile; we hold the profile id | copied into our database |
| Live view links | issued per use, short expiry, sent only to the signed-in owner | logged; the link is a credential ([crosspost-and-delist](../../research/list/ben/crosspost-and-delist.md#browser-use-cloud-v4-for-posting-and-for-delists-the-replay-layer-cant-do), *observed*) |

**Revoking.** Disconnect asks one thing: end the listings on that site or leave them up. Then it revokes the OAuth grant where the site offers revocation, deletes our token copy, deletes the Browser Use profile, cancels queued jobs for that account and writes `account.unlinked`. Deleting the whole secondhand account does the same for every site and reaches traces and model logs ([privacy §11](../../research/cross-cutting/nate/privacy-and-data.md#11-retention-and-deletion), *inferred*).

## States

`account.health` (*agent proposal*):

| State | Meaning | Enters when | Leaves when |
|---|---|---|---|
| `linking` | sign-in in progress | Connect tapped | token or session confirmed, or the person leaves |
| `ok` | every listed capability works | probe or any call succeeds | an error below |
| `degraded` | a route is down, a fallback works (replay drifted, partner API slow) | adapter falls back | route recovers |
| `needs_signin` | session or refresh token dead, 2FA asked | 401, sign-in page seen, refresh fails | person signs in again |
| `paused` | the site warned, limited or suspended the account | warning text, removal notice, listing restrictions | person resumes after reading the notice |
| `off` | disconnected | Disconnect | Connect again |

Gap G6 (`needsReauth`) is `needs_signin` here, a person-only decision with no auto retry. Imported listings enter `LISTING_STATES` at `live` ([lifecycle.mjs](../lifecycle.mjs)). Imported items enter the item state `live`, skipping `capturing` and `researching`.

## Systems underneath

| Piece | What it does here |
|---|---|
| Public edge | receives the OAuth redirect, holds the PKCE verifier (Depop needs S256), passes the code to the app API |
| App API on Databricks Apps | exchanges codes, writes `account`, issues live view links, scopes every query by user |
| Databricks secret scope | holds the key that encrypts OAuth tokens |
| Lakebase | `account`, imported `listing`, `item`, `order` rows |
| Lakeflow jobs | token refresh before expiry; a health probe per account every 30 min (a read-only `listLive` page or an API call); the import job |
| Browser Use cloud | one profile per person per browser-route site; an interactive live view for sign-in |
| Agents and AI Search | match imported listings across sites into one item (photo and title similarity), resolve `product` |
| MLflow | a trace per import, so "why are these one item?" has an answer |

## Contract for the frontend

| Call | Returns |
|---|---|
| `GET /v1/accounts` | `[{id, site, route, health, capabilities[], linked_at, last_ok_at}]` |
| `POST /v1/accounts` `{site}` | `{account_id, method: "oauth", authorize_url}` or `{account_id, method: "browser", live_view:{url, expires_at}}` |
| `GET /v1/accounts/:id` | the account plus `last_error: {code, message, failed_step, retry}` |
| `POST /v1/accounts/:id/relink` | same shape as `POST /v1/accounts` |
| `DELETE /v1/accounts/:id` `{end_listings: bool}` | a `job` of kind `unlink` |
| `POST /v1/accounts/:id/import` `{listings: bool, purchases: bool}` | a `job` of kind `import`, stages `read_site`, `match`, `write`, each `started, running, arrived, failed` |

Account ids use the prefix `acc_` (see Needs). Decision kinds: `relink` (options: Sign in, Turn off this site), `same_item` (Same item, Different items), `site_warning` (Resume, Keep paused, Open on site). Webhooks from sites reach the edge, never the phone.

## Who may act

| Action | Mode |
|---|---|
| Sign in, approve OAuth, type 2FA | the person, always |
| Refresh a token, probe health, read listings and purchases after the person tapped Bring in | `auto`, read-only, logged |
| Retry a dead sign-in | never automatic; `needs_signin` waits for the person |
| Pause all automation on a warned site | `auto`, protective, logged |
| Resume a paused site | the person (`ask`, never promoted) |
| Disconnect, end listings on disconnect | the person |

## How it fails

| Failure | What the person sees | Recovery |
|---|---|---|
| OAuth refused or closed | the row stays on Connect | tap again |
| Depop partner access not granted | Depop connects through the cloud browser | switch to OAuth when granted, no re-link if the session holds |
| Wrong password or 2FA inside the cloud browser | the site's own message, inside the sheet | the person retries on the site's page |
| Session expires | amber row, `relink` card on Today | sign in again; queued outward actions wait, read-only polls stop |
| Site warns or restricts the account | `paused` row and a `site_warning` card | automation stays off until the person resumes |
| Browser Use down | `degraded`; API sites unaffected | jobs queue; health probe clears it |
| Import finds the same thing twice | one `same_item` card per unsure pair | the person picks; sure matches merge silently and can be split |
| Live view link leaks | nothing visible | link expiry is minutes and owner-bound |

## How we will know it works

| Claim | Check |
|---|---|
| Linking is quick | median seconds from Connect to `ok`, per site, from `account.linked` events |
| We never hold a password or log a secret | `node spec/log.mjs` on real logs finds no token or cookie fields; secret-scope access is the only path in the code |
| Dead sessions never act | zero outward events on an account while `needs_signin` or `paused`, across real logs |
| Import is complete | imported live listing count equals the site's own count for 10 real accounts |
| Matching is right | of merged items, share the person split afterwards; of `same_item` cards, share answered "different" |
| Tokens outlive the user's attention | eBay accounts stay `ok` for 30 days with no sign-in |

## Facts that constrain it

| Fact | Mark | Source |
|---|---|---|
| eBay links by OAuth auth code; user token about 2 h, refresh about 18 months | *asserted* | [platform-access §2](../../research/connect/nate/platform-access.md#2-ebay) |
| Depop partner OAuth uses PKCE S256, not self-serve; access 1 h, refresh 1 year rotating | *observed* | [platform-access §4](../../research/connect/nate/platform-access.md#4-depop) |
| Facebook has no OAuth for individual sellers; its partner program is EU and EEA only | *observed* | [platform-access §3](../../research/connect/nate/platform-access.md#3-facebook-marketplace) |
| Poshmark has no API; Mercari's is partner only | *not found*; *asserted* | [platform-access §5](../../research/connect/nate/platform-access.md#5-poshmark), [§6](../../research/connect/nate/platform-access.md#6-mercari) |
| Apple 5.1.1(v): an app may not store credentials or tokens to social networks off the device; whether a marketplace counts is not stated | *observed*; *inferred* | [privacy §2](../../research/cross-cutting/nate/privacy-and-data.md#2-apple-app-store-rules) |
| Device-only Keychain items block background agents; crosslisters keep cookies on servers | *asserted* | [privacy §9](../../research/cross-cutting/nate/privacy-and-data.md#9-session-tokens-and-cookies-keychain-versus-server-vault) |
| Browser Use profiles carry cookies, which conflicts with keeping credentials on the device | *observed* | [posting note](../../research/list/ben/posting-browser-use-ebay.md#pavlo-upgrade) |
| Account deletion must start in the app | *observed* | [privacy §2](../../research/cross-cutting/nate/privacy-and-data.md#2-apple-app-store-rules) |

What changed: the old feature page planned official APIs for eBay and Depop, a prefilled handoff for Facebook and OfferUp, and browser posting only if opted in ([features/connect](../../features/connect/README.md)). Today's decisions put every site on its own harness on Browser Use cloud, with the API used where faster ([harness decision](../../product/decisions.md#2026-11-14-each-marketplace-gets-its-own-harness-run-on-browser-use-cloud); [it's a demo, so build it](../../product/decisions.md#2026-11-14-its-a-demo-so-build-it)). OfferUp is search only.

## Demo path

For Ben and Nate to mark.

## Open for Ben and Nate

| Question | Quotes | Recommendation | What depends on it |
|---|---|---|---|
| Where do sessions live: on our servers (needed for delists while the phone sleeps) or on the device (Apple 5.1.1(v))? | Ben: Browser Use storing cookies "conflicts with keeping credentials on the user's device" ([posting note](../../research/list/ben/posting-browser-use-ebay.md#pavlo-upgrade)). Nate: "a cloud based browser use system where login auth is persisted" ([words](../../product/words.md#2026-11-14-nate-frameworks-and-goals)) | server side, encrypted, disclosed at Connect, revocable per site | background delists, App Store review, the replay feature |
| Is Mercari in? | Ben lists it; Nate named "ebay, depop, poshmark, fb marketplace" ([vision Open](../../product/vision.md#open)) | keep it in; it costs one harness | setup rows, harness count |
| Apply for Depop partner access now? | none differ | yes, today; browser route until granted | Depop sale speed, its API terms |
| Business: is the number of linked sites something a plan could price on? | none | one line only; no model picked | pricing page, if any |

## Needs from the shared model

- `account` fields above, the `health` enum, capability rows, and the id prefix `acc_`.
- Where session secrets live (secret scope plus encrypted column, never Lakebase plaintext) as a shared rule.
- Event names `account.linked`, `account.health`, `account.unlinked`, `import.done` in [events.json](../events.json) and `log/example.mjs`, per [log/README.md](../../log/README.md).
- A purchase `order` without an `item` until the person taps Sell this; or an item state for "owned, not for sale".
- Decision kinds `relink`, `same_item`, `site_warning`.
