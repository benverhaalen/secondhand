# What did the ad-ebay run establish?
Researched 2026-11-15 by Nate (Claude). Feature: harness, site eBay.

*Observed*: `node --test --test-concurrency=1 app/src/edge/harness/sites/ebay/adapter.test.ts` passed all 25 tests (exit 0), on fixtures in `app/src/edge/harness/sites/ebay/fixtures/`. The fixtures were written from eBay's published OpenAPI contracts and Trading XML reference. None was captured from a live response.

*Observed*: `node --no-warnings app/src/edge/harness/sites/ebay/live.ts` exited 2 with "EBAY_CLIENT_ID and EBAY_CLIENT_SECRET are not both in this process". No keyset exists yet, so no live read ran and no timing exists. Nate's setup steps are in `app/src/edge/harness/sites/ebay/README.md`.

*Observed*: The developer.ebay.com HTML pages answered 403 to the fetcher. The paths, scopes and bodies come from the OpenAPI specs. The limits come from the API call limits page as indexed on 2026-11-15. The licence quotes come from the account deletion guide and the 2018-10-26 licence PDF. The current licence page was not read.

*Inferred*: With no Retry-After header, the 429 wait runs to midnight Pacific, eBay's daily reset. eBay documents no Retry-After. `item_cents` on an order is assumed to be the accepted Best Offer amount. A live order would confirm both.

Still open: one live run of each public read once the keyset is in the environment. Sold data needs Marketplace Insights approval, and every user-token read needs the RuName and a link.
