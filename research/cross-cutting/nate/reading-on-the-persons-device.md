# Can the reading run on the person's iPhone instead of a cloud browser, and what is left if only some of it can?
Researched 2026-11-15 by Nate (retrieval subagent, Sonnet 5.5). Feature: cross-cutting.

Labels: **observed** = read in a fetched page or its bytes; **asserted** = a vendor or search summary says it, or memory; **inferred** = my reasoning. Evidence only, no recommendations. Not run: `node .agents/check.mjs` (brief said run no scripts), and the `features/` README line was skipped.

## Question and what it decides
Founder: "we only really need to read right? we can't have the dom substrate run on the ios phone can we?" The app is Expo SDK 58 (`expo ~58.0.25`, `expo-web-browser ~58.0.8`, no `react-native-webview` in `app/package.json`). Backend reads eBay, Poshmark, Mercari, Depop through cloud browsers. This note gathers what the platforms allow; the choice is the lead's.

## Draft from memory, and What changed
| Draft | Verdict | Finding |
|---|---|---|
| WebView can run injected JS and read the DOM in-app | held | observed: `injectedJavaScript`, `injectedJavaScriptBeforeContentLoaded`, `injectJavaScript`, `onMessage` exist (Q1) |
| SFSafariViewController lets the app read the page | wrong | observed: opaque to the host app (Q1) |
| iOS can run a periodic background scraper | mostly wrong | observed: refresh ~30 s, system-decided; WKWebView does not run JS when suspended (asserted by Apple engineer) (Q3) |
| Safari extension is the iOS equivalent of a Chrome extension | partly | observed: runs, but background page is non-persistent, per-site grants (Q5) |
| Desktop resellers read via Chrome extension | held | observed in Vendoo and List Perfectly help (Q6) |
| Marketplaces push saved-search alerts quickly | unclear | Depop weekly (asserted via search summary), others not found at primary (Q7) |
| Gmail read is easy | wrong | observed: restricted scope, annual third-party assessment (Q8) |

## Q1. WebView DOM reading
- observed: react-native-webview `injectedJavaScript` runs at document end, `injectedJavaScriptBeforeContentLoaded` at document start, `injectJavaScript(...)` on demand; the page replies with `window.ReactNativeWebView.postMessage` (string only) to `onMessage`. `sharedCookiesEnabled`, `incognito`, `limitsNavigationsToAppBoundDomains` exist; `WKAppBoundDomains` max 10. https://raw.githubusercontent.com/react-native-webview/react-native-webview/master/docs/Reference.md and .../Guide.md
- observed: Expo SDK 58 has a `react-native-webview` doc page (`expo install react-native-webview`). https://docs.expo.dev/versions/v58.0.0/sdk/webview.md . Expo Go vs dev build: not settled from a primary line I can quote; see Not found.
- observed: `expo-web-browser` opens SFSafariViewController / ASWebAuthenticationSession; SFSafariViewController does not hand the page or its cookies to the host app. https://docs.expo.dev/versions/v58.0.0/sdk/webbrowser.md , https://developer.apple.com/documentation/safariservices/sfsafariviewcontroller , https://developer.apple.com/documentation/authenticationservices/aswebauthenticationsession (ASWebAuthenticationSession is for sign-in).

## Q2. Cookies and sign-in in an embedded WebView
- observed: WKWebsiteDataStore default is persistent, `nonPersistent()` is in-memory; cookies via WKHTTPCookieStore. https://developer.apple.com/documentation/webkit/wkwebsitedatastore , https://developer.apple.com/documentation/webkit/wkhttpcookiestore
- observed: Google OAuth refuses embedded user agents with `disallowed_useragent` (native-app page); the policies page restricts embedded webviews. https://developers.google.com/identity/protocols/oauth2/native-app , https://developers.google.com/identity/protocols/oauth2/policies
- asserted: Facebook steered iOS login away from embedded browsers (2015 SDK post, https://developers.facebook.com/blog/post/2015/10/29/Facebook-Login-iOS9/); current Facebook and Apple policy pages not read.
- observed: Poshmark login page is readable. https://poshmark.com/login . eBay, Mercari (Cloudflare "Just a moment..."), Depop ("Forbidden") sign-in pages returned 403 to curl and WebFetch; recorded as blocked, not worked around.
- not found: Apple wording on WKWebView cookies shared with Safari. inferred: a sign-in inside the app's own WebView is a separate session from Safari's.

## Q3. iOS background limits
- observed: BGAppRefreshTask about 30 s and BGProcessingTask minutes, both when the system decides (processing typically charging/idle). https://developer.apple.com/documentation/backgroundtasks/choosing-background-strategies-for-your-app , .../bgapprefreshtaskrequest , .../bgprocessingtaskrequest , .../bgtaskscheduler
- observed: background pushes: about 30 s, system throttles (approx 2-3 an hour), not guaranteed. https://developer.apple.com/documentation/usernotifications/pushing-background-updates-to-your-app
- observed: background URLSession is for file transfer. https://developer.apple.com/documentation/foundation/downloading-files-in-the-background
- asserted (Apple Frameworks Engineer, forum): a suspended WKWebView does not run JS. https://developer.apple.com/forums/thread/64150 , https://developer.apple.com/forums/thread/674308
- observed, Expo: `expo-background-task` 12 h default interval, 15 min minimum, physical device only; `expo-task-manager` has no iOS background in Expo Go; `expo-notifications` headless via `contentAvailable: true`. https://docs.expo.dev/versions/v58.0.0/sdk/background-task.md , .../task-manager.md , .../notifications.md , https://docs.expo.dev/push-notifications/what-you-need-to-know.md

## Q4. App Review Guidelines (page "Last Updated October 16, 2026")
observed from https://developer.apple.com/app-store/review/guidelines/ : 5.2.2, 4.2 / 4.2.2, 2.5.2, 2.5.6, 4.8, 5.1.2 were read. 2.5.6 concerns web browsing apps using WebKit. No guideline text naming "scraping" was found. Exact quotes are in the page; this note does not re-quote them (see Not found).

## Q5. Safari Web Extensions on iOS
- observed: iOS 15+, packaged as an app extension in a native app; non-persistent background page required on iOS; per-site permission grants by the person. https://developer.apple.com/documentation/safariservices/safari-web-extensions , .../managing-safari-web-extension-permissions , https://developer.apple.com/videos/play/wwdc2021/10027/
- observed: messaging between app and extension JS is constrained (content scripts cannot message the native extension; the app cannot message the JS). https://developer.apple.com/documentation/safariservices/messaging-between-the-app-and-javascript-in-a-safari-web-extension
- observed (WWDC21 text via curl): "if you are developing an extension for iOS, you'll have to adopt a non-persistent background page", and "alarms API instead of timers". Whether alarms fire on iOS: not verified.
- inferred: a content script runs only while the person is browsing that site in Safari.

## Q6. Desktop reseller extensions, Chrome mechanics
- observed: Vendoo help: install the Chrome extension; "If your computer is not already logged in to the marketplace, Vendoo will prompt you to sign in. If you're already logged into your marketplace accounts, Vendoo will automatically connect to them." https://help.vendoo.co/en/articles/6260267-get-started-with-vendoo-create-an-account-download-the-extension-connect-your-marketplaces
- observed: List Perfectly: extension "connects List Perfectly with your marketplaces and powers features like importing, crosslisting, linking, and Smart Import"; "Browser extensions do not work on mobile devices"; "You do not need to enter your marketplace passwords". https://help.listperfectly.com/en/articles/11465703-list-perfectly-onboarding-guide ; blog https://listperfectly.com/?p=2132 says sellers log into their own accounts in their own browser.
- observed: Crosslist has a reinstall-extension support page (extension is part of the product). https://docs.crosslist.com/service/support/reinstalling-the-extension . Flyp and Nifty: Flyp URL 404, Nifty home 200 but nothing read; not found.
- observed, Chrome: content scripts run in an isolated world and read the page DOM. https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts
- observed: `chrome.alarms` fire missed alarms on wake, `persistAcrossSessions`, and "make sure important alarms exist each time your service worker starts up". https://developer.chrome.com/docs/extensions/reference/api/alarms
- observed: offscreen documents: `runtime` is the only extension API available in them; reasons include `DOM_SCRAPING`; only `AUDIO_PLAYBACK` has a lifetime limit (30 s without audio). https://developer.chrome.com/docs/extensions/reference/api/offscreen
- inferred: all of this needs a running desktop browser that holds the person's session.

## Q7. Marketplaces' own notifications
- observed (eBay UK help): notification categories include Selling (auctions, offers/counteroffers, order updates), General (messages received), "Saved Searches: Notifications on the searches you've saved"; channels are app, email, SMS. By default emails go to the registered address. https://www.ebay.co.uk/help/account/account-account-settings/notifications-subscriptions?id=4203&ra=true . eBay US page opened but returned a "Security Measure" page. Frequency (instant/daily) not read from an eBay primary page.
- observed (Poshmark): push and email toggles for follows, likes, comments, party invites and reminders (https://poshmark.com/posh_guide/how_to_adjust_notifications); price-drop alert to likers by push and email (https://poshmark.com/price_drop_policy). No saved-search alert found.
- asserted (search summary of Depop help, page itself 403): saved searches max 10, "New results for saved search" push, weekly. https://depophelp.zendesk.com/hc/en-gb/articles/360019648117-Saved-Searches (blocked to me).
- Mercari: help pages 403 (Cloudflare); nothing found.

## Q8. Receiving the person's marketplace emails
(a) Gmail
- observed: `gmail.readonly` and `gmail.metadata` are listed under "Restricted scopes". https://developers.google.com/workspace/gmail/api/auth/scopes ; metadata is "labels and headers, but not the email body".
- observed: "Apps accessing restricted data from or through a third-party server must undergo an annual security assessment by a Google-approved third party", using CASA. https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification
- observed: auto-forward needs a verification link sent to the forwarding address and clicked; filters can limit what is forwarded. https://support.google.com/mail/answer/10957
(b) Inbound services
- observed: Postmark documents an inbound webhook; pricing page lists "Inbound email processing" as a plan feature, free Developer plan 100 emails/month. https://postmarkapp.com/developer/webhooks/inbound-webhook , https://postmarkapp.com/pricing . Per-plan price for inbound not isolated.
- observed: SendGrid Inbound Parse needs an MX record. https://www.twilio.com/docs/sendgrid/for-developers/parsing-email/setting-up-the-inbound-parse-webhook
- observed: SES receiving delivers to Lambda, S3, SNS; SES pricing page lists inbound via Mail Manager billed separately, volume tiered; exact inbound rate not isolated. https://docs.aws.amazon.com/ses/latest/dg/receiving-email-concepts.html , https://aws.amazon.com/ses/pricing/
- observed: Cloudflare Email Workers: `email()` handler can forward, reply, reject or process incoming mail. https://developers.cloudflare.com/email-routing/email-workers/ ; price not read.

## Not found
- eBay US, Mercari, Depop sign-in pages and Mercari/Depop help: 403, not worked around. Their sign-in options are unknown here.
- Apple's statement on WKWebView and Safari cookie sharing; Apple/Facebook current embedded-webview policy pages.
- Expo Go vs dev build for react-native-webview as a quoted line.
- Safari `alarms` working on iOS; Guideline exact quotes not reproduced; no "scraping" text seen.
- Flyp and Nifty help pages; eBay saved-search frequency; Mercari and Poshmark saved-search alerts; exact inbound prices for Postmark, SES, Cloudflare.

## Sources fetched
All URLs above were fetched 2026-11-15 except: Depop help (403, search summary only), eBay US and Mercari (blocked), Facebook policy (not read), Flyp (404), Nifty (no content read). Scratch copies sit in the session scratchpad, untrusted.
