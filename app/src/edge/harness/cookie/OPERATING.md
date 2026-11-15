# Cookie runner: how it operates

`cookieRunner({account_id, manifest, jar, bucket, sessions, fetch, request, parse, wait?, log?})` returns an `Adapter`. One request per call, carrying the account's own cookie header, after the account's token bucket (`sessions.bucket`) says go.

The cookie value lives in memory for one request. `CookieJar.header(account_id, site)` hands it over; it is never put in an envelope, a log line, an error message or a hint. Logging is ids only (`account_id`, `operation_id`).

| Verb | Request | Success | 401 or login redirect | 429 | Other non-2xx | Missing from the jar |
|---|---|---|---|---|---|---|
| read_listings, search, read_orders and every other read | `request(args)`, GET | `ok` with `parse(json)`; bucket sees `ok` | `auth_expired`, hint `relink`; `sessions.expire` marks the account `account_stale` and pauses its jobs | `rate_limited`, hint `retry_after 60 s`; bucket halves its rate | `page_changed`, hint `author`; a 404 is `not_found` | `auth_expired` as for a 401, no request sent |
| post, edit, delist and every other write | `request(args)`, POST or the manifest's method, `operation_id` carried by the caller | `ok`; the caller reads back through reconcile | as above, and the write is not retried | as above; a write never switches route | as above | as above |

Likely breaks and where they are tested (`cookie.test.ts`): `expiry` (401, login redirect, no cookie), `masked` (no log line or envelope holds the cookie), `paced` (every request asks the bucket first).

Not handled here: a bot check page returned with a 200 (needs the manifest's `expect` check, run by replay), and a timeout after a write was sent (the harness answers `outcome_unknown`; reconcile reads it back).
