# cr-1: cookie runner
Researched 2026-11-15 by Nate (original agent not recorded).

*Observed in the recorded local run:* No live run was made. Nate has not given a go to run cookies against a real site. Everything here is a dry run on fixtures: `node --test app/src/edge/harness/cookie/cookie.test.ts` (3 tests, exit 0) with a fake `CookieJar` holding a made-up value, a fake `fetch` returning scripted replies, and the in-memory lease store.

What the dry run shows:
- A 401, a redirect to a login path and a missing cookie each give `auth_expired` with hint `relink`, and the account goes `account_stale`.
- A scan of every log line and the envelope finds no part of the cookie value.
- Each request asks the account's token bucket first.

What it does not show: how any real site answers, whether its cookies carry a login redirect we recognise, or the real pace limits. The first live run needs Nate's go, one account of his own, and one site.
