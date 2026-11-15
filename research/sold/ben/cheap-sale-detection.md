# How does the server learn an item sold on each marketplace, fast and without spending model tokens, and is the design safe to run server-side with an app anyone can decompile?
Researched 2026-11-15 by Ben (Claude Code agent, thread "Detect sales cheaply on the server"). Feature: sold.

Ben asked for this in [his 01:11 message](../../../product/words.md#2026-11-15-a-brand-system-for-anything-alive-and-bold-with-purpose-code-that-knows-each-app-and-knowing-when-things-sell): how we know when things sell, cheap proxies that spend no tokens, a cloud browser that knows the instant the DOM changes, operations on the server, and an app that is fine to decompile.

Method: RDD and IAE as defined in [exa-empirical.md](../../watch/ben/exa-empirical.md) (find who already solved the structure, give each reference a job, transfer the mechanism). This note builds on, and does not repeat, Nate's [email-and-notification-detection.md](../nate/email-and-notification-detection.md) and [cloud-browsers-and-detection.md](../../replay/nate/cloud-browsers-and-detection.md), and the spec's [card 12](../../../spec/determinations/managing-and-buyers.md#12-whether-a-sale-really-happened) (triggers start a read; only a paid order read back counts) and [card 15](../../../spec/determinations/managing-and-buyers.md#15-when-to-check-again) (when to check again). Evidence marks: *observed* (opened or ran), *asserted* (a source says it without showing, or memory), *inferred* (my reasoning).

## Answer

1. **Detection needs no model tokens anywhere.** Every signal below is a webhook, a header, a meta tag, a JSON field or a regex. A model is only worth calling when an extractor breaks on a changed page, once, to propose a new selector that is then cached (*inferred*).
2. **The cheapest trigger the spec is missing is the public page.** A sold Poshmark listing stays public, server-rendered, and says so in a meta tag, with no login (*observed*, below). Checking the seller's public pages from our server costs almost nothing and never touches the user's account, so it carries no ban risk to them. The spec's current backstop for Poshmark and Mercari is a signed-in sold-page poll in the cloud browser every 1 to 2 minutes ([card 15](../../../spec/determinations/managing-and-buyers.md#15-when-to-check-again)), which is the most expensive and most detectable way to ask (*inferred*). *Agent proposal:* swap it for a public-page poll, and open the signed-in session only to read the order once a trigger fires.
3. **"Know the instant the DOM changes" works, but only while a browser is already open.** No hosted browser vendor read here pushes DOM changes (*observed*, §3). A MutationObserver plus a binding, and a listener on the site's own WebSocket frames and JSON responses, report a change in milliseconds. A working prototype with passing tests over a CDP attachment is in [dom-watch/](dom-watch/watch.mjs) (*observed*: `node --test research/sold/ben/dom-watch/watch.test.mjs`, 2 pass). Keeping a browser open per account just to wait is the expensive part: at Browser Use's stated $0.06 per browser-hour that is about $1.44 a day per site per user (*inferred* from the observed rate). Use the live watch while a session is open anyway (posting, messaging, an accepted offer waiting on payment), and on stage in the demo.
4. **Official push and Nate's "our own harness" do not conflict here.** Nate prefers our own harness over official APIs where we can do better ([words](../../../product/words.md#2026-11-14-nate-our-own-harness-over-official-apis-and-opencli)). For detection, the one thing no harness can do is be told by the site that a buyer paid; eBay's and Depop's webhooks do exactly that, at no cost. *Agent proposal:* subscribe to the push as a trigger and keep the harness for every read and action. Nate's call, flagged in the packet.
5. **The server-side assumption holds on main, with five gaps to hand to Nate** (§5). One of them is now a check: `node .agents/check.mjs` fails a secret that the shipped app could carry (§5.1).

## 1. The ladder: cheapest signal first, one authoritative read last

Each rung is a *trigger*. Per card 12, a trigger sets `next_check_at` to now and the harness reads the order. Nothing here changes that rule; it changes which triggers exist and what they cost.

| Rung | What it is | Cost per check | Delay | Ban risk to the user's account |
|---|---|---|---|---|
| 0. Site push | eBay `ORDER_CONFIRMATION`; Depop `v1:order.new` | nothing | seconds (*asserted*: Depop says "within a few moments") | none: official API |
| 1. Our own state | Facebook: the agent itself agreed the deal and booked the pickup | nothing | instant | none |
| 2. Mail hint | the site's sale email, forwarded by a filter to an inbound address | nothing (Cloudflare Email Workers, Mailgun routes) | not measured | none |
| 3. Public page | the seller's public listing or closet page, read from our server | one plain HTTP request; a scraper credit where a bot wall needs one | the poll interval | none: no login, not the user's IP or cookies |
| 4. Signed-in read | the orders or sales page in the user's cloud-browser session | browser minutes, or 1 to 3 s on a recorded call | 1 to 4 min in a browser (*asserted*, [cloud browsers](../../replay/nate/cloud-browsers-and-detection.md)) | the one rung that looks like automation on the account |
| 5. Live watch | a page held open with a DOM observer and socket listener | browser-hours while open | milliseconds | same as rung 4, for as long as it stays open |

Rung 4 is the proof; rungs 0 to 3 decide *when* to spend it. Today the spec spends rung 4 on a timer for Poshmark and Mercari. Moving the timer to rung 3 is the change this note proposes.

## 2. Per site

### eBay: push, then read the order

- *observed* The REST Notification API has an `ORDER_CONFIRMATION` topic, "added" in release 1.6.6 on 2025-12-01, sent "when a buyer completes the checkout process for an auction or fixed-price item" ([asyncapi order_confirmation.yaml](https://developer.ebay.com/api-docs/master/commerce/notification/asyncapi/order_confirmation.yaml), [release notes](https://developer.ebay.com/api-docs/commerce/notification/release-notes.html)). Ben's [crosspost-and-delist.md](../../list/ben/crosspost-and-delist.md) found the same; this run reread it.
- *observed* One notification per line item. If payment fails, checkout goes from complete to incomplete, and a second notification is sent when it completes again (same yaml). So dedupe on `orderId`, not on the notification.
- *observed* The payload carries `orderId`, `orderLineItems[]` with `listingId` and `quantity`, `notificationId`, `publishAttemptCount`. No price and no buyer (same yaml). The price comes from the order read, which card 12 requires anyway.
- *observed* Delivery: an HTTPS destination verified by a challenge (SHA-256 over `challengeCode + verificationToken + endpoint`), and every message signed in an `X-EBAY-SIGNATURE` header checked with the key from `getPublicKey` ([sell communications guide](https://developer.ebay.com/develop/guides/sell-communications-guide.md)). Retry policy, ordering and latency are not stated on the pages read.
- *observed* Fallback topics in the Trading API's Platform Notifications for a seller: `FixedPriceTransaction`, `ItemSold`, `AuctionCheckoutComplete` ([NotificationEventTypeCodeType](https://developer.ebay.com/devzone/xml/docs/Reference/eBay/types/NotificationEventTypeCodeType.html)). `ItemMarkedPaid` was to be decommissioned on 2026-06-22 (same page). Not needed if the REST topic works.
- Backstop: Fulfillment `getOrders` on card 15's schedule (*asserted*: filter names not read this run).

### Depop: webhooks if the partner API is granted, and a catch inside it

- *observed* Events: `v1:order.new`, `v1:order.update`, `v1:order.refund`, `v1:product.update`, `v1:product.like`, `v1:product.unlike`; wildcards `v1:order.*` ([webhooks concept](https://partnerapi.depop.com/api-docs/concepts/webhooks/)). No product-sold or product-deleted event; a listing's `STATUS_MARKED_AS_SOLD` or `STATUS_DELETED` is only readable by GET (reference page, partly read).
- *observed* "Webhooks are delivered on a best-effort basis. Don't rely on them as your only source of truth"; reconcile with the orders endpoint, and the processing guide suggests a once-a-day job for orders still `SHIPPING_PENDING` (concept page; [processing an order](https://partnerapi.depop.com/api-docs/how-to-guides/processing-an-order/)).
- *observed* Validation: `X-Depop-Signature` is HMAC-SHA256 hex over `<X-Depop-Timestamp>.<raw body>`, keyed by a secret shown once at creation, compared in constant time ([validate webhooks](https://partnerapi.depop.com/api-docs/how-to-guides/validate-webhooks/)). No timestamp tolerance is given; *agent proposal*: reject over 5 minutes old.
- *observed* Dedupe: an order event's `id` is "stable per order and shared across those event types", so the key is `id + event_type + created_at` (concept page).
- *observed* **The catch:** "The webhook configuration endpoints currently only support API key authentication. They are not yet available through the OAuth 2.0 flow" (concept page), while the processing guide says "Reach out to us with the URL and we'll configure this for you". A cross-lister acting for many users through OAuth therefore cannot register webhooks itself today (*inferred*). Ask Depop for this in the same email that asks for partner access.
- Until access is granted: Depop pages render in the browser, so a public read needs a browser fetch, and Depop's own JSON returned 403 to cookieless calls in a third-party report (*asserted*, in [cloud browsers](../../replay/nate/cloud-browsers-and-detection.md)). Depop sits on rungs 2 and 4 for the demo.

### Poshmark: the public page is the best free signal

- *observed* (fetched 2026-11-15, no login, HTTP 200, server-rendered) A sold listing stays public and carries `meta-product:availability: oos`, the banner "This item is sold, check out other similar items", and "Sold" near the price ([example listing](https://poshmark.com/listing/Pink-Steam-Heated-Straightening-Brush-for-Women-Sleek-Heated-Styling-Brush-6aea197b88963f23c60dca51)). Ben's Exa test saw the same state as JSON-LD `OutOfStock` on another listing ([exa-empirical.md §7](../../watch/ben/exa-empirical.md)).
- *observed* A public closet page lists cards whose text ends in "Sold" for sold items; the `?availability=sold_out` filter did not apply in a plain fetch, so parse every card rather than trust the filter (`https://poshmark.com/closet/<user>`).
- *inferred* So one public closet fetch per seller covers a page of their listings. Per card 15's 1 to 2 minute tier, that is 720 to 1,440 plain requests a day per seller, from our server's IP, not the user's.
- *asserted* The sale email subject reads "... just sold to ... on Poshmark!" ([Nate's note §7](../nate/email-and-notification-detection.md)). A good rung 2 hint.
- *agent proposal* for card 12, for Nate: on Poshmark a seller cannot create the "sold" state without a buyer paying (*asserted*, from memory; check it), so the public `oos` plus a matching sale email are two independent channels agreeing. That pair could start the delist on the other sites while the rung 4 read fetches the order details, saving the 1 to 4 minute browser read from the critical path. Card 12 as written waits for the read. Nate's call.
- Not checked: whether `oos` also appears when a seller marks an item "not for sale". Save one fixture of each before relying on it.

### Mercari: public JSON-LD behind a bot wall

- *observed* in Ben's Exa test: a sold Mercari listing's JSON-LD `Offer` carried `SoldOut`; an available one carried `InStock` ([exa-empirical.md §7](../../watch/ben/exa-empirical.md)).
- *asserted* Mercari sits behind Cloudflare and a plain request gets 403 ([cloud browsers](../../replay/nate/cloud-browsers-and-detection.md)). This run's fetch of mercari.com also failed. So rung 3 for Mercari goes through the Firecrawl scrape we already pay for through Treg ([own-page-monitor.md](../../watch/ben/own-page-monitor.md)), reading JSON-LD with no model.
- *observed* Mercari offers an SMS opt-in that fires when an item sells ([Nate's note §7](../nate/email-and-notification-detection.md)). An SMS to a number we own, received by a phone-number API's webhook, is a rung 2 hint with no mailbox access at all (*inferred*; Twilio-class inbound SMS webhooks, *asserted* from memory).

### Facebook Marketplace: the sale lives in our own state

- *inferred* For local pickup there is no checkout; the deal is made in Messenger, and in this product our agent is the one making it (messages, `book_pickup`). The agent already knows the deal is agreed and when the pickup is. The "sale" is the appointment reaching `done`, confirmed by the person's tap or the buyer's code, as [sold.md](../../../spec/features/sold.md) already says. No detection is needed, and polling Facebook for it would be the riskiest read of all five sites.
- *observed* (Ben's note) Shipped eBay listings already show on Facebook Marketplace with checkout on eBay, so those sales arrive through eBay's push ([crosspost-and-delist.md](../../list/ben/crosspost-and-delist.md)).
- Not checked: Facebook's own sale emails for shipped Marketplace checkout; facebook.com refused automated fetches this run.

## 3. Knowing the instant a page changes

### What vendors offer

| Vendor | Push of DOM changes? | What it does push | Cost to keep open | Source |
|---|---|---|---|---|
| Kernel | no DOM category | telemetry over SSE: `console`, `network`, `page`, `interaction`; resumable by `seq`; opt-in per category | standby after 10 s idle costs nothing, but an open telemetry stream counts as active, so a waiting stream is billed | *observed*, kernel.sh/docs telemetry categories, streaming, standby |
| Browserbase | none found | signed project webhooks exist; event list not read | sessions end at 6 hours; `keepAlive` to reconnect | *observed*, docs.browserbase.com timeouts and llms.txt |
| Browser Use | none found; events are read by polling (the SDK waits poll every 3 s) | none | $0.06 per browser-hour at the 50-concurrency tier (the billing page's header says $1 for 50 browser-hours, which disagrees; check the pricing page); a V4 agent browser stops about 2 min after its last run, `keepAlive` up to 14,400 s, a 4 hour hard timeout | *observed*, docs.browser-use.com billing and concurrency |
| changedetection.io, Distill, Browse AI | no: interval re-checks (changedetection.io from about 5 min) | notifications after a re-check | per plan | *observed*, their product pages |

So nobody sells "tell me when this node changes". It has to be built, and it is small.

### What we built

[dom-watch/watch.mjs](dom-watch/watch.mjs), about 40 lines, takes any Playwright page and reports three channels to a callback:

| Channel | How | What it catches |
|---|---|---|
| `dom` | `page.exposeBinding` plus an init script that runs a `MutationObserver` on a selector and calls the binding when its text changes | a status badge flipping to Sold, a new row on a sales page |
| `ws` | `page.on('websocket')` and `framereceived` | a site's own realtime push, before any DOM change |
| `http` | `page.on('response')` on a URL pattern | the JSON a page fetches, read as data |

*observed* (2026-11-15, Playwright with the preinstalled Chromium, `node --test research/sold/ben/dom-watch/watch.test.mjs`, 2 of 2 pass): on a local page that flips its badge, receives a WebSocket frame and fetches its listing JSON, all three channels fire, and the DOM observer keeps working after navigating to another page. The second test attaches to a separately launched Chromium over CDP with `connectOverCDP`, which is how a Browser Use, Browserbase or Steel browser is driven, and passes the same way. Playwright's docs warn `connectOverCDP` has "significantly lower fidelity" and did not say whether bindings work over it (*observed*, playwright.dev); the test shows they do on this Chromium. Not run against a real cloud vendor or a real marketplace.

*Agent proposal* for the harness: whenever a session is open for another job, attach `watch` to it for free signals. Hold one open on purpose only in three cases: an accepted offer waiting on payment, the minutes after a listing goes live with heavy interest, and the demo. On Kernel the cleanest wiring may be the `console` telemetry category: the observer writes `console.log('secondhand:' + json)` and our server reads the SSE stream, with no CDP client of our own (*inferred*; not tested).

### Why not keep one open per account

*inferred* from the observed Browser Use rate: $0.06 × 24 h is $1.44 per day per open browser. Four browser-run sites per user is $5.76 a day, about $170 a month per user, to learn something rung 3 learns for almost nothing two minutes later. A browser held open and active around the clock is also the strongest automation signal an account can give (*inferred*; per-account thresholds are not published).

## 4. References and what each one does here (RDD)

| Reference | Job | Take | Change |
|---|---|---|---|
| eBay Notification API | implementation mechanism | signed push, then read the order | dedupe on `orderId`, since one sale can notify per line item and again after a failed payment |
| Depop Partner API | implementation mechanism | HMAC check over timestamp and body; daily reconcile | ask Depop to configure webhooks for OAuth shops |
| Crosslist's "server-side where an API exists, extension elsewhere" ([Nate's note §9](../nate/email-and-notification-detection.md)) | evidence of the industry split | push where offered | our "elsewhere" is a public page, not a browser left running |
| Vendoo's 10-minute scan with a computer left on (same) | evidence of the pain | the interval is the product's weak point | a public read every 1 to 2 min from our server, no computer left on |
| changedetection.io (*asserted*, from memory, via [own-page-monitor.md](../../watch/ben/own-page-monitor.md)) | implementation mechanism | read the page's own product metadata before any selector | we read sold state, not price |
| Ben's page monitor ([own-page-monitor.md](../../watch/ben/own-page-monitor.md)) | the code to reuse | schedule, fetch function per site, JSON-LD first, "gone needs two checks", bot wall as `monitor.behind` | point it at the seller's own closet and listings, and emit a trigger, not an alert |
| Stripe-style signed webhooks (*asserted*) | implementation mechanism | time plus raw body under HMAC with a tolerance window | applies to every inbound hook: eBay, Depop, mail, SMS |

## 5. Server-side and decompile-safe: what main does, and the gaps

What holds (*observed* in the repo, 2026-11-15): [spec/product.md §6](../../../spec/product.md#6-systems) runs everything that acts on the server (Expo API routes as the thin edge, Databricks Apps behind, Lakeflow for schedules, harnesses in the cloud browser), the API derives `user_id` from the token and "a client never sends it" ([§7](../../../spec/product.md#7-contract-conventions)), the policy check runs in code before any executor, and decisions are answered with an HMAC signature valid 15 minutes. The only server code on main is `GET /v1/health`, which keeps its Databricks token in the server route and out of the app ([app/README.md](../../../app/README.md)). No key, token or `EXPO_PUBLIC_` secret is in `app/` today.

Gaps, for Nate (his spec; these are flags, not edits):

1. **Nothing stopped a secret from reaching the app bundle.** Expo compiles every `EXPO_PUBLIC_` value and `app.json` `extra` into the app (*asserted*, from Expo's documented behaviour, not reopened this run). Now a check: `.agents/checks/secrets.mjs` fails an `EXPO_PUBLIC_` name that looks like a key or token, a screen that imports from `app/src/edge/`, and a key-like name under `extra`, with a test in `checks.test.mjs`.
2. **Inbound hooks have no verification rule in the spec.** [sold.md](../../../spec/features/sold.md) says the edge answers 2xx in under 1 s, but not that it checks `X-EBAY-SIGNATURE`, `X-Depop-Signature` with a timestamp window, or a mail provider's signature. An unverified hook is a free "delist everything" button for anyone who finds the URL (*inferred*); card 12's read-back limits the damage to wasted reads, but every route should still reject unsigned calls before they cost a browser session.
3. **The cloud-browser live view is a bearer link.** The user signs in to each marketplace inside the cloud browser (§6 Secrets). The live-view or CDP URL that makes that possible lets whoever holds it drive the signed-in session (*inferred* from how CDP and live-view URLs work; vendor docs show they are returned by the session APIs, *observed* in [cloud browsers](../../replay/nate/cloud-browsers-and-detection.md)). The spec does not say how the app gets that link. *Agent proposal:* the edge hands the app a one-time, short-lived link to a sign-in page we host, never a raw `cdpUrl`, profile id or vendor key.
4. **The Gmail route contradicts its own research.** §6 and sold.md still plan "Gmail OAuth, read-only", while Nate's note found both `gmail.readonly` and `gmail.metadata` are restricted scopes needing a yearly CASA assessment when data passes through a server, and Nate later said he prefers to harness the platforms rather than read mail ([words](../../../product/words.md#2026-11-14-nate-sale-emails-the-expo-account-where-routes-are-hosted-and-a-buy-page-shaped-by-your-style)). *Agent proposal:* drop Gmail OAuth; keep mail as an optional hint by a forwarding filter to an inbound address, which needs no Google review and no mailbox access ([Nate's note §6](../nate/email-and-notification-detection.md)). Since forwarded mail is spoofable, it stays a trigger, never proof, which card 12 already requires.
5. **A Facebook session held on our servers sits against Apple's text** that social network tokens stay on the device ([privacy-and-data.md §9](../../cross-cutting/nate/privacy-and-data.md)); product.md already names the tension. It does not block a demo that is not submitted to the App Store; it would block a store release (*inferred*).

What a decompiler gets, if the gaps close (*inferred*): the `/v1` routes and their shapes, which are documented anyway, and the user's own session token on their own phone. Every price floor, auto-reply limit and delist rule is enforced on the server, so a modified app can only ask the server for what the user could already ask for by tapping.

## Not found, and not run

- eBay: retry policy, ordering and latency for notifications; the scope that `ORDER_CONFIRMATION` needs; `getOrders` filter names.
- Depop: retry policy and timeout; whether `v1:product.update` fires on sale; how an OAuth shop is tied to a webhook configuration.
- Mercari, Depop and Facebook public pages: none loaded this run (403, client-only shell, robots refusal).
- Whether Poshmark shows `oos` for "not for sale" as well as sold; whether a seller can create a sold state without a buyer.
- Facebook's web realtime channel (MQTT over WebSocket is my memory, *asserted*, unopened).
- Kernel and Browserbase hourly prices this run (Nate's note has Kernel per second and Browserbase per plan, *observed* there).
- CDP's own pages for `Runtime.addBinding` returned index stubs; the prototype test is the evidence that the mechanism works.
- No real marketplace page and no real cloud vendor has been through `dom-watch`.

## Sources fetched (2026-11-15)

- eBay: order_confirmation.yaml, Notification API release notes and overview, sell communications guide, NotificationEventTypeCodeType, knowledge-base 2093, a community thread on order webhooks.
- Depop: partnerapi.depop.com webhooks concept, your first webhook, validate webhooks, processing an order, reference (first 40k characters verbatim).
- Poshmark: one sold listing page and one closet page, logged out. eBay: one active item page and the Browse `getItem` reference. Mercari, Depop, Facebook: failed as listed above.
- Playwright: Page (`addInitScript`, `exposeBinding` by summary only), BrowserType `connectOverCDP`, WebSocket. CDP Runtime, Network and Page: index stubs only.
- Kernel docs (telemetry categories, streaming, standby, llms.txt), Browserbase docs (timeouts, llms.txt), Browser Use docs (billing, concurrency), changedetection.io, distill.io, browse.ai.
