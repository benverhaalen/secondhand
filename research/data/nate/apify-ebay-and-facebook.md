# What do the Apify eBay and Facebook Marketplace actors return, how fast, at what cost, and where do they beat or lose to our own lanes?
Researched 2026-11-15 by Nate (Claude Code implementer, Opus 5.5). Feature: data.

Decision it feeds: whether an `apify` source lane fills the two gaps our readers have (eBay sold prices, and Facebook Marketplace) and how it composes into search. The adapter is in [app/src/edge/harness/sites/apify/](../../../app/src/edge/harness/sites/apify/README.md).

## The answer

*Observed* (4 probe runs, 2026-11-15): `apify/facebook-marketplace-scraper` reads a Facebook Marketplace city search in about 5 s for 10 listings, at $0.005 a listing. We have no reader for Facebook Marketplace, so this fills a real gap. `automation-lab/ebay-scraper` reads eBay active listings in about 21 s for 10 items, at about $0.003 an item. Our eBay page lane reads a search in about 4.5 s for free, so for active listings this actor loses on speed and adds nothing we lack. Neither actor returns a sold price or a sold date. The eBay sold gap stays open. *Inferred*: use the Facebook lane for search, keep the eBay actor as a fallback only for when the page lane is blocked, and feed neither into valuation's sold comps.

## Draft from memory, and what changed

| Draft (before reading) | Finding |
|---|---|
| The eBay actor may read sold listings if given an eBay sold-search URL. | No. *Asserted* (actor readme, lines 15 and 337-338, read 2026-11-15): "Can I scrape eBay sold/completed listings? Not with this Actor." *Observed* (run ebay2): a `LH_Sold=1&LH_Complete=1` URL failed after 153.6 s with an eBay 502. Nothing was saved or charged. |
| The Facebook actor gives a price with a currency, and a sold date. | Partly. *Observed*: search mode gives `listing_price.amount` with no currency, plus `is_sold`, `is_pending` and `is_live` as flags. Details mode adds `listingPrice.currency`, `condition` and a `timestamp` (the listing date). Neither mode gives a sold date. |
| Both actors cost about a cent a row. | Lower. *Asserted* (actor pricing, 2026-11-15) and *observed* (run costs): eBay costs $0.001 a run plus $0.003-0.00345 an item. Facebook costs $0.005-0.0062 a listing, and details doubles that. |

## Probe runs (observed 2026-11-15, through the run-sync-get-dataset-items endpoint)

| Run | Actor and input | Result | Items | Wall time (actor runtime) | Cost |
|---|---|---|---|---|---|
| ebay1 | automation-lab~ebay-scraper, "Levi 501 jeans", US | succeeded | 10 | 21.0 s (19.7 s) | $0.031 |
| ebay2 | the same actor, an eBay sold-search URL through `startUrls` | failed: "Search page unavailable ... status=502", "nothing was saved or charged" | 0 | 153.6 s | $0 |
| fb1 | apify~facebook-marketplace-scraper, Chicago "office chair", `resultsLimit` 10 | succeeded | 10 | 5.1 s (4.3 s) | $0.05 |
| fb2 | the same with `includeListingDetails`, 3 items | succeeded | 3 | 10.0 s (9.0 s) | $0.03 |

Total spend: $0.111. *Observed* (the usage API): the account limit is $19 a month. The time to the first item could not be measured, because the sync endpoint returns the whole dataset at once.

## Fields

| | eBay actor | Facebook search | Facebook details |
|---|---|---|---|
| id | `itemId` | `id` | `id` |
| title | `title` | `marketplace_listing_title` | `listingTitle` |
| price | `price` (a number) | `listing_price.amount` (a string) | `listingPrice.amount` |
| currency | `currency` | none | `listingPrice.currency` |
| condition | `condition` | none | `condition` (e.g. "Used - Fair") |
| listing date | none | none | `timestamp` |
| photo | `thumbnail`, `images` | `primary_listing_photo` | `primaryListingPhoto` |
| URL | `url` | `listingUrl` | `itemUrl` |
| sold price | **no** | **no** | **no** |
| sold date | **no** | **no** | **no** |
| sold flag | `soldCount` text such as "33+" (units sold of an active listing) | `is_sold` | `isSold` |
| other | `listingType`, `shippingCost`, `bestOffer`, `scrapedAt` | `is_pending`, `is_live`, location, seller | `attributes`, `description`, `locationText` |

*Observed*: the eBay seller fields came back empty. *Asserted* (actor changelog, 2026-11-11): the actor now reads eBay's phone pages, which carry no seller data. The Facebook seller and location fields are personal data. The adapter never puts them on a row, and the fixtures remove them.

## Limits and failures

- *Asserted* (Apify API docs): the sync endpoint waits up to 300 s, then returns 408 `run-timeout-exceeded`. The run itself keeps going. The adapter sends `timeout=60`, so the run stops first.
- *Asserted* (Apify API docs): `maxItems` and `maxTotalChargeUsd` cap pay-per-result and pay-per-event runs on Apify's side. The adapter sends 8 items (4 with details) and $0.05.
- *Asserted* (Apify API docs): the errors are 400 `invalid-input`, 401 `invalid-token`, 402 payment required, 403 `insufficient-permissions`, 404 `record-not-found`, 429 `rate-limit-exceeded`, and `run-failed`. The adapter's mapping is in its README.
- *Observed* (fb readme and fb1): a Facebook item that fails comes back as `{url, error, errorDescription}` inside the dataset, not as an HTTP error.
- *Inferred*: the actors depend on eBay's and Facebook's pages, so either can break without notice. ebay2 is an example of eBay refusing the actor.

## Terms

- *Asserted* (the actor pages, 2026-11-15): both are public actors run under Apify's terms. The scraped content stays under eBay's and Facebook's terms, which forbid automated collection without permission.
- *Inferred*: this is cleared for the hackathon demo only. Every row carries `may_model: false` and `use_scope: 'hackathon_demo'`. Use past the demo needs a decision from Ben or Nate.

## Against our lanes

| Need | Our lane | Apify | Verdict |
|---|---|---|---|
| eBay active listings | the page lane, about 4.5 s, free (observed in earlier benchmarks) | 21 s, about $0.03 for 10 | Ours wins. Apify is a fallback only for when the page lane is blocked. |
| eBay sold prices | none without sign-in | none (no sold mode, and the workaround failed) | Still a gap. Next to try: eBay's Marketplace Insights API, or a signed-in session. |
| Facebook Marketplace | no working reader | 5 s and $0.05 for 10, or 10 s and $0.03 for 3 with details | Apify wins. It fills the gap. |

## Sources (all read 2026-11-15)

- https://docs.apify.com/api/v2/act-run-sync-get-dataset-items-post: the endpoint, its query parameters and its 300 s limit. This is the endpoint the adapter calls.
- https://docs.apify.com/api/v2/act-runs-post: `maxItems`, `maxTotalChargeUsd`, `timeout` and the error types.
- https://apify.com/automation-lab/ebay-scraper, and its readme: the fields, the pricing, the statement that there is no sold mode, and the change to phone pages.
- https://apify.com/apify/facebook-marketplace-scraper, and its readme: the fields, the error items, and the pricing ("$6.20 to scrape 1,000 Marketplace items on the Free plan").
- The Apify run, dataset and usage/limits API endpoints (`/v2/actor-runs/{id}`, `/v2/datasets/{id}/items`, `/v2/users/me/limits`): the measured runtime, cost and account limit for each probe.

## Searched and not reached

- An Apify actor that returns eBay sold prices was not searched for further. The task named these two actors.
- A Facebook search with currency at search cost does not exist in this actor. Another actor was not tried.
- The time to the first item cannot be seen through the sync endpoint.
- The actors' own uptime history was not checked.
