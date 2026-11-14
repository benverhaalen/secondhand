# Replay (recorded calls)
Status: draft, *agent proposal* except where a line links a decision. Slug: replay. Written 2026-11-14.

The hassle it removes: when an item sells on Depop, the person needs the Poshmark copy gone in seconds, not after a cloud browser spends minutes clicking. Replay records what a browser run did once and repeats the same calls without a browser, so the actions that must be fast and frequent (delists, price changes, read-backs) are fast and cheap, and fall back to the browser the moment a site changes.

The name: [spec/replay.mjs](../replay.mjs) is an unrelated piece in the shared spec, and the old feature page calls this "Replay (Pavlo)" ([features/replay](../../features/replay/README.md)). Ben has his own private replay tool; this spec describes the role the product needs and takes nothing from that tool.

## What the person does and sees

Replay has no tab and no button. The person sees its effect:

1. In **Sell**, after a sale, the other sites' pills go from Ending to Ended in seconds.
2. In the "why?" timeline of any action, one line says how it ran: "Ran directly", or "Ran in the browser, the site had changed".
3. In **You > Accounts**, a site whose replay broke shows no warning, because the browser takes over; only if the browser also fails does the account go amber ([connect](connect.md)).

**Where Ben's design would make a person stumble.** None visible: replay is invisible by design. The stumble is in timing: if the person watches a live view of a delist, a replayed delist has no browser to watch. The live view button hides for replayed runs.

**What the backend makes possible that the design does not yet use.** Because a replayed read is cheap, read-back after every outward action and reconcile every few minutes stop costing a browser session each, so the "Live everywhere" claim on an item can be checked often instead of trusted.

## What it reads and writes

| Entity | Fields |
|---|---|
| `recipe` (new, see Needs) | `id` (`rcp_`), `site`, `action`, `version`, `steps[{method, url_template, headers_allowlist[], body_template, expect{status, shape_hash}}]`, `recorded_from_job`, `state`, `success_count`, `fail_count`, `last_ok_at`, `drift_reason` |
| `account` | reads `session_ref` and `route`; writes `health = degraded` when replay is down and the browser works |
| `listing` | the same writes the action would make through any route ([list](list.md)) |
| `job` | result gains `{route, fell_back, ms}` |
| `event` | `replay.recorded`, `replay.drift`, `replay.fallback` (proposed, see Needs) |

A recipe is per site and action, never per person: it holds templates and allowed header names, never cookies, tokens, buyer text or addresses. Values that differ per call (listing id, price, CSRF token read from the page) are filled at run time.

## States

`recipe.state` (*agent proposal*):

| State | Enters when | Leaves when |
|---|---|---|
| `candidate` | a harness run of that action succeeded and its calls were captured | it replays correctly on a test account and passes read-back 3 times |
| `active` | promoted from candidate | any drift signal |
| `drifted` | drift seen in a live call or the daily canary | a new recording passes, then the old version is `retired` |
| `retired` | replaced by a newer version | never |

The listing moves through the same [lifecycle.mjs](../lifecycle.mjs) states whatever the route.

## Systems underneath

| Piece | What it does here |
|---|---|
| Browser Use cloud harness | the exploring run; its network calls during a successful action are the recording |
| Recorder | strips cookies and personal values, turns ids and prices into template slots, hashes the response shape |
| Replay runner | makes the recorded calls with the person's session and checks each `expect` |
| Marketplace layer | picks the route per call: official API, then an `active` recipe, then the harness ([list](list.md)) |
| Lakebase | `recipe` rows, the outward queue, idempotency keys |
| Lakeflow jobs | the daily canary per recipe on a test account; reconcile reads through replay |
| MLflow | the route and any fallback as spans in the action's trace |

**Where recording comes from.** Browser Use's own docs show a raw browser reached over CDP, which exposes the network log (*observed*); whether a V4 task run exposes its network log was not found. Run fields and limits are in [crosspost-and-delist](../../research/list/ben/crosspost-and-delist.md#browser-use-cloud-v4-for-posting-and-for-delists-the-replay-layer-cant-do).

**What replay covers** (*agent proposal*):

| Action | Replay? | Why |
|---|---|---|
| delist, revise price, pause | yes | frequent, time-critical, small calls |
| readBack, listLive, listOrders, readInterest, readInbox | yes | frequent reads; cheap reconcile |
| post | the release step only, after the person's tap | photo upload and form shape change most often |
| sign-in, 2FA, anything with a challenge page | never | the person does it in the browser ([connect](connect.md)) |

## Contract for the frontend

No endpoints of its own. Every job result that ran an outward action carries `{route: "api" | "replay" | "browser", fell_back: bool, ms}`. The "why?" timeline shows `route` as one line from [copy](../../product/copy.md). Live view links come back only when `route` is `browser`.

## Who may act

Replay is a route, not an actor. An action replayed keeps exactly the mode it had: a delist after a sale stays `auto`, a first post stays `ask`, the locked kinds stay locked. The policy check runs before the route is picked, so replay cannot widen what is allowed. Pacing is per account and action, shared across routes, so a replayed Poshmark delist waits like a browser one. Recording and canary runs act only on test accounts.

## How it fails

| Failure | Signal | What happens |
|---|---|---|
| Site changed a field or endpoint | status not expected, or response shape hash differs | `replay.drift`; read back first, then rerun on the harness under the same idempotency key; recipe `drifted`, re-record queued |
| Call accepted but nothing changed | read-back does not match | as above; never counted as success |
| Challenge or sign-in page returned | HTML where JSON was expected, or a known challenge marker | stop; no fallback retry; account `needs_signin` or `paused` |
| Session expired | 401 or 403 | account `needs_signin`; outward actions wait |
| Fallback also fails | harness error | the listing's own failure path in [list](list.md) |
| Recording captured a personal value | the recorder's scrub check | recipe rejected, never stored |

Read-back before any retry matters most: a delist that reached the site but timed out must not be sent twice ([harness lessons](../../research/cross-cutting/ben/ai-harness-from-repos.md#4-posting-delisting-and-jobs)).

## How we will know it works

| Claim | Check |
|---|---|
| Replay is fast | p50 and p95 `ms` per site and action, replay against browser, from job results |
| Drift is caught | share of drifted runs found by `expect` or read-back, not by a person or the next reconcile; target all |
| Fallback is safe | zero double actions (two delists, two price changes) under one idempotency key, from read-backs |
| Replay pays | share of outward actions on `replay`, per site, per week |
| Recipes stay clean | the recorder's scrub check and `node spec/log.mjs` find no cookies or personal values in `recipe` rows |

## Facts that constrain it

| Fact | Mark | Source |
|---|---|---|
| Ben's plan: the browser explores once, following runs call the site's own web endpoints, and on drift fall back | *agent proposal* in Ben's note | [CD](../../research/list/ben/crosspost-and-delist.md#browser-use-cloud-v4-for-posting-and-for-delists-the-replay-layer-cant-do) |
| Delist speed about 1 to 3 s by replay against 1 to 4 min in the browser | *asserted* | [CD pipeline](../../research/list/ben/crosspost-and-delist.md#the-sold--delist-pipeline) |
| Browser Use V4 has no webhook; a busy session returns 409; the live view link is a credential | *observed* | [CD](../../research/list/ben/crosspost-and-delist.md#browser-use-cloud-v4-for-posting-and-for-delists-the-replay-layer-cant-do) |
| Poshmark, Mercari and the eBay User Agreement ban automated means whatever the route; replay is automation | *observed* | [platform-access §7](../../research/connect/nate/platform-access.md#7-cross-marketplace-comparison-of-terms) |
| Browser automation is not proof of permission | *inferred* | [teardown §6](../../research/cross-cutting/nate/crosslister-teardown.md#6-things-no-tool-does-well-inferred-from-the-gaps-above) |
| Replay needs the session outside the cloud browser, which is where Apple 5.1.1(v) applies | *inferred* | [privacy §9](../../research/cross-cutting/nate/privacy-and-data.md#9-session-tokens-and-cookies-keychain-versus-server-vault) |

What changed: today every site gets its own harness on Browser Use cloud ([harness decision](../../product/decisions.md#2026-11-14-each-marketplace-gets-its-own-harness-run-on-browser-use-cloud)); replay sits under each harness as its fast path rather than as a separate system.

## Demo path

For Ben and Nate to mark.

## Open for Ben and Nate

| Question | Quotes | Recommendation | What depends on it |
|---|---|---|---|
| Where does replay run, and may the session leave the cloud browser to do it? | Ben's posting note: cloud cookies "conflict with keeping credentials on the user's device"; Nate: login "persisted" in the cloud browser ([words](../../product/words.md#2026-11-14-nate-frameworks-and-goals)) | run replay inside the same Browser Use session (calls from the page), so cookies never leave it | speed gain, App Store review |
| Does replay change ban risk compared with the browser? | [vision Open](../../product/vision.md#open) | treat it as the same automation under the same pacing; say so at Connect | which actions replay |
| Use Ben's private tool behind this role, or build the role here? | none | Ben decides; the role and contract above hold either way | recorder and runner |

## Needs from the shared model

- A `recipe` entity with prefix `rcp_`, owned by the marketplace layer.
- A name for this feature that does not collide with [spec/replay.mjs](../replay.mjs).
- `route` (`api | replay | browser`), `fell_back` and `ms` on job results and events.
- Event names `replay.recorded`, `replay.drift`, `replay.fallback` in [events.json](../events.json).
- Test accounts per site for recording and the daily canary.
