# Apify (eBay listings, Facebook Marketplace)

A gap-filling search source. It runs two public Apify actors through Apify's run-sync-get-dataset-items endpoint. `automation-lab/ebay-scraper` reads eBay listings. `apify/facebook-marketplace-scraper` reads Facebook Marketplace, which has no working reader of our own. It is not a Site, and it does not replace a lane that works. Neither actor returns a sold price or a sold date (probed 2026-11-15), so it feeds search only, never valuation's sold comps. The research is in [research/data/nate/apify-ebay-and-facebook.md](../../../../../../research/data/nate/apify-ebay-and-facebook.md).

Route: `apify.ebay.search`, `apify.facebook.search` (`createApify({ token, log }).search(lane, args, signal)`; `call` answers `search` only).

## Terms and use

Every row is scraped by a third party, so it carries `via: 'apify'`, the actor, `may_model: false` and `use_scope: 'hackathon_demo'`. The rows are cited and shown. They are never trained on. Neither Apify's terms nor the marketplaces' terms are cleared for use past the demo. Seller names and places are never put on a row.

## Conditions

| Condition | Enforced by | Test |
|---|---|---|
| At most 8 items a run, 4 with Facebook details | `MAX_ITEMS`, `MAX_DETAILS`, in `maxItems` and in the actor input | eBay: the sync endpoint...; Facebook details |
| At most $0.05 a run, stopped by Apify itself | `maxTotalChargeUsd` in the query | eBay: the sync endpoint... |
| A 60 s run limit, and a 75 s deadline for us | `timeout` in the query, `AbortSignal.timeout` | timeouts and rate limits... |
| The token only in the `Authorization: Bearer` header, never in a URL | `once` | eBay: the sync endpoint...; the token never reaches... |
| The token is scrubbed from every message, cut to 300 characters | `scrub` | the token never reaches a log line... |
| One run per actor at a time | one promise chain per lane | one run per actor at a time |
| The caller's abort wins | `AbortSignal.any`, rethrows `signal.reason` | timeouts and rate limits... |
| No sold price or sold date is made up; `sold: true` only from `is_sold` | `toRow` | eBay rows; Facebook search |
| The environment is read only in `live.ts` | the adapter takes `token` from its caller | (structure) |

## Errors

| Apify answer | Code | Hint |
|---|---|---|
| no token was passed (nothing is sent) | `auth_expired` | `relink apify` |
| 401, 403 | `auth_expired` | `relink apify` |
| 402, or a message about payment, usage or quota | `policy_refused` | `raise_decision apify_spend` |
| 408, `run-timeout-exceeded` | `rate_limited` | `retry_after 30` |
| 429 | `rate_limited` | `retry_after` Retry-After, or 30 |
| no answer, timed out (not the caller's abort) | `rate_limited` | `retry_after 30` |
| `run-failed`, aborted, 5xx, a dataset of only error items | `blocked` | `pause_session apify` |
| `invalid-input` | `page_changed` | `author ['input']` |
| 404 | `page_changed` | `author ['actor']` |
| not JSON, not a list, the core fields absent from every item | `page_changed` | `author` names what is missing |
| no q, or a Facebook city that is not a slug (nothing is sent) | `policy_refused` | `raise_decision missing_input` |
| a verb other than search | `no_route` | `handoff apify.com` |

An empty dataset is `ok` with no rows.

## Rows

An item without an id, a price or a URL is dropped and counted in `dropped`. The log holds `http apify.<lane>.search`, the lane, the item cap, the row and drop counts, and the error code with its scrubbed message. It never holds the query text or the token.

## Probe coverage (2026-11-15)

| Run | Input | Result | Items | Time | Cost |
|---|---|---|---|---|---|
| ebay1 | "Levi 501 jeans", US | succeeded | 10 | 21.0 s | $0.031 |
| ebay2 | an eBay sold-search URL (`LH_Sold=1&LH_Complete=1`) | failed (eBay 502, nothing saved or charged) | 0 | 153.6 s | $0 |
| fb1 | Chicago, "office chair" | succeeded | 10 | 5.1 s | $0.05 |
| fb2 | the same with details, 3 items | succeeded | 3 | 10.0 s | $0.03 |

Fixtures: [fixtures/](fixtures/README.md), recorded 2026-11-15 and sanitized.

Run: `node --test --test-concurrency=1 app/src/edge/harness/sites/apify/adapter.test.ts`. Live (PowerShell; it spends at most $0.10): `$env:APIFY_TOKEN=[Environment]::GetEnvironmentVariable('APIFY_TOKEN','User'); node app/src/edge/harness/sites/apify/live.ts`.

## Not built

- Sold listings. The eBay actor has no sold mode, and the sold-URL workaround failed.
- Wiring into `intel/public/sources.ts` and `search.ts`. That belongs to the integration lead.
- A currency on a Facebook search row. Search mode gives none. Details mode gives one, at twice the cost.
- Apify's async runs, and paging past 8 items.
