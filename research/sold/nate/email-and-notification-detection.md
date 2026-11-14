# Can a sale or new buyer message on Poshmark, Mercari, Depop and Facebook Marketplace be detected faster or more reliably from notification emails than by polling in a browser, and what does each email route cost?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: sold.

Evidence marks: *observed* = opened and read, with URL and source date. *asserted* = the source claims it without showing, or secondary. *inferred* = my reasoning. All fetches 2026-11-14.

## 1. What the existing notes say, and where this note confirms, extends or contradicts

- [sold.md](../../../spec/features/sold.md) line 52 lists "Gmail push" for "Poshmark and Mercari sale email"; line 63 says "no push: sale email plus sold-list poll every 1 to 2 min (*inferred*)"; line 64 says Facebook is "person confirms sold, or a watch of the order page"; line 62 lists Depop webhooks `order.new`, `order.update`, `order.refund`.
- [crosspost-and-delist.md](../../list/ben/crosspost-and-delist.md) line 27 says "Sale email (Gmail push) plus sold-list poll... *inferred*"; line 28 says "~10-30 s (email push) or <=2 min (poll)"; line 8 says incumbents poll every few minutes; line 11 says Depop has a partner API.
- [autonomous-features.md](../../cross-cutting/nate/autonomous-features.md) lines 123-127 say Gmail receipt reading needs restricted-scope review (terms "not read"); line 178 says skip the email scope to avoid review; line 187 lists the terms as unread.
- [messages.md](../../../spec/features/messages.md) line 48 has job `inbox_poll` "every few minutes" with a cloud browser; line 99 shows "Depop: last checked 2 h ago".
- [messages-and-offers.md](../../messages/ben/messages-and-offers.md) and [privacy-and-data.md](../../cross-cutting/nate/privacy-and-data.md): grep found no marketplace notification-email content and no Gmail scope content in either (*observed* by search of the files, not a full read).
- [platform-access.md](../../connect/nate/platform-access.md) line 14 (Depop Partner API) is untouched by this note.

Extends: the "10-30 s email push" figure at crosspost-and-delist.md:28 has no observed support. Section 2 gives the Gmail push limits and Section 7 shows no marketplace email content that confirms the body carries what the design needs. The review cost at autonomous-features.md:123-127 is now read from Google's pages (Sections 3 and 4).

## 2. Gmail API push (users.watch, Pub/Sub, history.list)

- *Observed* (https://developers.google.com/workspace/gmail/api/guides/push, fetched 2026-11-14, undated page): `watch` must be called at least once every 7 days or updates stop; Google recommends once per day. The response carries a `historyId`, used as `startHistoryId` in `history.list`. Notifications are capped at one event per second per user, excess is dropped. The Pub/Sub topic must grant publish rights to `gmail-api-push@system.gserviceaccount.com`.
- *Observed* (https://developers.google.com/workspace/gmail/api/reference/rest/v1/users/watch, fetched 2026-11-14): request body fields are `labelIds[]`, `labelFilterBehavior` (replaces deprecated `labelFilterAction`) and `topicName`; response is `historyId` and `expiration`. The topic project id must match the project making the watch call.
- *Inferred*: push tells the app that mailbox history changed; the app then calls `history.list` and `messages.get`. Reading subject and body needs a scope that returns the body (Section 3). Latency from marketplace send to push is not published; no figure is *observed*. The 10-30 s at crosspost-and-delist.md:28 stays *inferred*. The marketplace's own send delay is a separate, unmeasured term.

## 3. Gmail scopes: which are restricted

- *Observed* (https://developers.google.com/workspace/gmail/api/auth/scopes, fetched 2026-11-14): `gmail.readonly` and `gmail.metadata` are both listed under "Restricted scopes". `gmail.metadata` is described as "View your email message metadata such as labels and headers, but not the email body". The page says restricted scopes need restricted-scope OAuth verification and that storing or transmitting the data on servers adds requirements.
- *Inferred*: with `gmail.metadata` alone an app sees subject (a header) and sender but not price, order id or buyer text in the body. A subject-only signal ("just sold to ...", Section 7) could still fire a sale event, but it is a restricted scope all the same, so review applies equally.

## 4. Restricted-scope verification and the CASA assessment

- *Observed* (https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification, fetched 2026-11-14): apps that access restricted data from or through a third-party server must complete an annual security assessment by a Google-approved independent assessor, using the App Defense Alliance CASA framework. Reverification is due at least every 12 months from the assessor's Letter of Assessment approval date. A new scope has to be covered by the assessment. The page states "Compliant verification results are valid for 7 days." Branding changes trigger re-review (duration not captured).
- *Asserted* (vendor blog, text says "as of 2024": https://www.switchlabs.dev/post/casa-tier-2-tier-3-security-review-providers-pricing-and-the-cheapest-option): Tier 2 from $540 per app (TAC Security, Google preferred; premium up to $1,800; 1-3 weeks), Tier 3 $4,500; other labs $800 to $1,500+ for Tier 2; KPMG, GDS, DEKRA custom quotes. A search snippet claimed a legacy track at $15k to $75k (vendor marketing, unverified, source unopened).
- *Not found*: an official Google or ADA price list for 2026. The CASA site fetch (appdefensealliance.dev) returned no usable text.
- *Inferred*: a per-user own-mailbox personal tool that never sends mail through a server may fall outside the "third-party server" clause, but the page does not say so; the app here would run on a server, so the clause applies as written.

## 5. Microsoft Graph mail change notifications

- *Observed* (https://learn.microsoft.com/en-us/graph/api/resources/subscription, fetched 2026-11-14): Outlook message subscriptions last at most 10,080 minutes (under 7 days); with resource data (rich notifications) 1,440 minutes (under one day). An expiry under 45 minutes is set to 45. Maximum 1,000 active subscriptions per mailbox across all apps. `/me/mailFolders('inbox')/messages` is a valid resource. Lifecycle notifications exist to signal reauthorization and missed events.
- *Observed* (https://learn.microsoft.com/en-us/graph/api/subscription-post-subscriptions, fetched 2026-11-14): messages need `Mail.Read`. The permission table text was not captured, so delegated versus application naming is unconfirmed.
- *Not found*: whether Microsoft requires a publisher verification or review for `Mail.Read` comparable to Google CASA; not read.
- *Inferred*: only helps for sellers whose marketplace email lands in Outlook or Hotmail; it does not help Gmail users.

## 6. User forwarding filter to an inbound address, no OAuth

- *Observed* (https://support.google.com/mail/answer/10957, fetched 2026-11-14 via Exa): the user adds a forwarding address, Gmail sends a verification link to it, the user confirms, then creates a filter with "Forward it". Spam is not forwarded. A notice shows in the inbox for the first week after setup.
- *Observed* (Mailgun, https://documentation.mailgun.com/docs/mailgun/user-manual/receive-forward-store/receive-http and /route-actions, fetched 2026-11-14): `forward("url")` POSTs the parsed message with fields `subject`, `sender`, `from`, `recipient`, `message-headers`, `body-plain`, `body-html`, `stripped-*`; requests are signed with HMAC256. Retries over 8 hours at 10 min, 15 min, 30 min, 1 h, 2 h, 4 h; a 406 stops retries. Filter and action fields max 4k. `store()` keeps a message up to 3 days. Route actions are `forward()`, `store()`, `stop()`.
- *Observed* (SendGrid, https://docs.sendgrid.com/for-developers/parsing-email/setting-up-the-inbound-parse-webhook, fetched 2026-11-14): needs an MX record at priority 10 to `mx.sendgrid.net` on a dedicated hostname plus a destination URL; do not change the MX after creation.
- *Observed* (Cloudflare, https://developers.cloudflare.com/email-routing/email-workers/, page updated 2026-10-30, fetched 2026-11-14): an `email(message, env, ctx)` handler; `message` exposes `from`, `to`, `headers`, `raw` (MIME stream), `rawSize`, `canBeForwarded`, `setReject`, `forward`, `reply`.
- Postmark inbound (https://postmarkapp.com/developer/webhooks/inbound-webhook): fetch returned navigation only; unopened in effect, no claim made.
- *Inferred*: this route needs no Google or Microsoft review and no mailbox access, only a one-time user setup (add address, confirm link, filter). It receives only mail the filter matches. Sender-address spoofing is a risk for any inbound hook: scam emails imitating Poshmark are widely reported (Section 7), so a sale event from email alone needs a check against the site.
- Latency: not published by any of these four vendors in the pages read; no figure is *observed*.

## 7. What each marketplace emails

- Poshmark sale. *Asserted* (a reseller blog comment from the author, 2025-02-10, https://theresaledoctor.com/poshmark-for-beginners/): subject line is "*item title* just sold to *buyer username* on Poshmark!", sender is a poshmark.com address (obfuscated on the page), the USPS shipping label is attached. Same page (comment 2025-03-19) says the real sale email carries the label as an attachment. A 2026-05-13 blog (https://ordersandreturns.com/know-sold-poshmark, *asserted*) says the email includes the buyer username and the item sold. Whether the body carries an order id or price was not shown anywhere; *not found*. Scam emails with "Congratulations your item just sold" and a "confirm" link are reported (same page; https://www.cityofcreativedreams.com/beware-of-poshmark-scam-when-selling/, 2023-03-27, *asserted*).
- Poshmark offer and comment. *Asserted* only: third-party pages say sellers get emails for offers, likes, comments, sales and shipping labels. The Poshmark support topic page (https://support.poshmark.com/s/topic/0TO1I000000kJqnWAE/buying, snippet only) says offers expire after 24 hours. No subject line for offers or comments was found. Poshmark has no private DMs; buyers use public listing comments (https://closo.co/blogs/beginner-guides-how-tos/sold-on-poshmark-how-it-works-and-what-happens-after-a-sale-2025-guide, 2025-10-15, *asserted*).
- Mercari. *Observed* (https://www.mercari.com/help_center/article/114/, fetched 2026-11-14, undated): notifications toggle under Profile > Settings > Notifications; an SMS opt-in fires only when an item sells or a purchase is delivered. The page lists no email subject lines. A snippet of help_center/article/319 says a prepaid-label email goes to the seller on sale (unopened). Mercari Japan says genuine mail comes from @email.mercari.jp (gl.help.jp.mercari.com/en/guide/articles/gl_0021, unopened; Japan site, not US). No Mercari US subject line, order id or price field was found.
- Facebook Marketplace. *Asserted* (vendor docs, 2025-01-20, https://propelhq.io/docs/integrations/integrating-with-facebook-marketplace): subject pattern "New message from [Name] about [Property]", sender facebookmail.com. Examples are real-estate listings, so not confirmed for item sales. Sold status on Facebook is not emailed as far as any source read shows; *not found*.
- Depop. Nothing found on email subject lines or contents. Depop's own order webhooks are in sold.md:62.
- *Inferred*: for none of the four is there an observed official statement of an email's fields. A parser would be built against sampled mail from a real account, and Section 6 and 3 routes both depend on those formats staying stable.

## 8. iOS and Android notification access

- iOS: *asserted* only. Stack Overflow answers (https://stackoverflow.com/questions/28271854, /30191505, /22073886, unopened beyond snippets, dates 2015 onward) say iOS gives an app no access to other apps' notifications, the one route being ANCS to a Bluetooth accessory. I fetched Apple's `getDeliveredNotifications(completionHandler:)` page (https://developer.apple.com/documentation/usernotifications/unusernotificationcenter/getdeliverednotifications(completionhandler:)) but the text returned was only the title, so Apple's own statement is *not confirmed*. That API is documented elsewhere as returning only the calling app's own delivered notifications (*inferred* from its name and context, not read).
- Android: *observed* (https://developer.android.com/reference/android/service/notification/NotificationListenerService, fetched 2026-11-14): a listener service must declare `android.permission.BIND_NOTIFICATION_LISTENER_SERVICE` and receives `onNotificationPosted`. The page says listeners cannot get notification access or be bound unless the user has enabled them (sentence partly captured). No review process like Gmail's is described on that page; Google Play policy on this permission was not read.
- *Inferred*: Android notification listening sees the marketplace app's push text at push time, with no email, no OAuth and no marketplace API, but only on a phone with the marketplace app installed, logged in and notifications on. It does not exist on iOS.

## 9. How crosslisters detect sales

- Vendoo. *Observed* (https://help.vendoo.co/en/articles/8047348-sale-detection-auto-delist, dated 2026-10-07): Sale Detection is BETA for eBay, Poshmark, Mercari, Depop, WhatNot; scans connected marketplaces every ten minutes; the computer must be on with Vendoo open in a browser tab (Chrome recommended); mobile app also needs that computer on; multi-quantity listings are not delisted until the last unit. No email is mentioned.
- Crosslist. *Observed* (https://crosslist.com/features/autodelisting, undated, fetched 2026-11-14): server-side sale detection for eBay, Etsy, Shopify, Depop, Facebook Marketplace (US only) and WooCommerce; Poshmark and all other marketplaces (incl. Facebook in UK, Canada, Australia) go through the Chrome extension and need the desktop browser running. Quantity-aware.
- List Perfectly. *Observed* (https://listperfectly.com/faq/, undated, and https://listperfectly.com/selling/list-perfectlys-sales-and-order-detection-feature/, 2026-11-10): sales detection runs in the extension "when the extension is active and you're browsing supported marketplaces while signed in"; Auto Delist needs Pro Plus, a device on and running the extension, quantity of 1. Sales detection alerts from Pro. Interval not published.
- Flyp. *Asserted* (comparison blog, 2026-09-23, https://www.flipsail.io/blog/crosslist-vs-flyp-vs-list-perfectly, vendor of a competing product; Flyp's own help center unopened): checks every 15 minutes while logged in and active in Flyp.
- OneShop. Not found beyond a search snippet saying it needs a running app; unopened.
- Competitor and aggregator claims, all *asserted* (blogs by competing vendors, 2026-10-07 https://www.flipsail.io/blog/auto-delist-when-computer-is-off and Treecat https://treecat.io/compare/best-auto-delist-tools, undated): Nifty within 15 minutes, cloud; PrimeLister cloud; Treecat 30 minutes; one competitor claims Poshmark every 5 minutes, Depop and Mercari every 10, from the cloud via the user's browser session. Treecat states that "those marketplaces do not notify outside tools when something sells; every tool polls".
- *Inferred*: no crosslister read here documents email as a detection route. Published intervals for Poshmark and Mercari range 5 to 30 minutes. This contradicts the 1 to 2 min poll at sold.md:63 and "every 2 min" at crosspost-and-delist.md:28 only in that no incumbent publishes a figure that low; it does not show that 1 to 2 min is impossible.

## 10. Comparison, from the above

| Route | Permissions and review | Latency | Coverage |
| --- | --- | --- | --- |
| Gmail push + history.list | restricted scope, OAuth verification, annual CASA assessment (Section 4) | not published; one event per second per user cap; watch renewal at least every 7 days | any marketplace whose email reaches that Gmail |
| Graph subscription | Mail.Read; subscription life under 7 days (under 1 day with rich data) | not published | Outlook mailboxes only |
| Forwarding filter to inbound hook | none from Google or Microsoft; user confirms a forwarding address and builds a filter | not published; Mailgun retries up to 8 h | only mail the filter matches; spoofed senders possible |
| Android notification listener | user-granted notification access; app must be on the phone | at push time (*inferred*) | Android only |
| iOS | none available (*asserted*, Apple page unconfirmed) | n/a | n/a |
| Browser poll | none beyond the user's own session | incumbents publish 5 to 30 min | all four sites |

## Not found
- Official 2026 CASA price list; the CASA site returned no text.
- Any marketplace's official list of notification-email subject lines or fields (Mercari US, Poshmark offers or comments, Depop, Facebook item sales).
- Whether Poshmark or Mercari sale emails carry order id, price and buyer text in the body.
- Apple's own statement that apps cannot read other apps' notifications.
- Measured latency from sale to email arrival, or to Pub/Sub push.
- Microsoft Graph permission table, and any Microsoft review step.
- Postmark inbound contents; Flyp and OneShop official help pages.

## Searched / could not reach
- Searched: Google Gmail push, scopes and restricted-scope verification pages (read); CASA site (no text); Graph subscription pages (read, permission table missing); Gmail forwarding help (read); Mailgun, SendGrid, Cloudflare Email Workers docs (read); Postmark inbound (navigation only); Android NotificationListenerService (read); Apple UNUserNotificationCenter page (title only); Stack Overflow on iOS (snippets only); Mercari help center (read, no subjects); Poshmark support and blogs (secondary only); Vendoo, Crosslist, List Perfectly help and marketing pages (read); Flyp, OneShop, Nifty, PrimeLister (secondary or not reached).
- Could not reach or unopened: Mercari article/319, Mercari Japan gl_0021, the Vendoo April 2026 update post, Flyp help center, OneShop help center, Google Play policy for notification-listener permission.
- A narrow search does not prove the missing items do not exist.

## Sources fetched
- https://developers.google.com/workspace/gmail/api/guides/push
- https://developers.google.com/workspace/gmail/api/reference/rest/v1/users/watch
- https://developers.google.com/workspace/gmail/api/auth/scopes
- https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification
- https://www.switchlabs.dev/post/casa-tier-2-tier-3-security-review-providers-pricing-and-the-cheapest-option
- https://learn.microsoft.com/en-us/graph/api/resources/subscription
- https://learn.microsoft.com/en-us/graph/api/subscription-post-subscriptions
- https://support.google.com/mail/answer/10957
- https://documentation.mailgun.com/docs/mailgun/user-manual/receive-forward-store/receive-http
- https://docs.sendgrid.com/for-developers/parsing-email/setting-up-the-inbound-parse-webhook
- https://developers.cloudflare.com/email-routing/email-workers/
- https://developer.android.com/reference/android/service/notification/NotificationListenerService
- https://www.mercari.com/help_center/article/114/
- https://help.vendoo.co/en/articles/8047348-sale-detection-auto-delist
- https://crosslist.com/features/autodelisting
- https://listperfectly.com/faq/
- https://listperfectly.com/selling/list-perfectlys-sales-and-order-detection-feature/
- https://theresaledoctor.com/poshmark-for-beginners/ (search highlights)
- https://www.flipsail.io/blog/crosslist-vs-flyp-vs-list-perfectly, https://www.flipsail.io/blog/auto-delist-when-computer-is-off, https://treecat.io/compare/best-auto-delist-tools (search highlights)
