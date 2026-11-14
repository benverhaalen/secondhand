# Which hosted cloud browsers can hold a logged-in marketplace session and expose the run's network calls, and how do the five marketplaces detect and act on automated sessions?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: replay.

Mark key: *observed* = I opened the vendor docs page (saved to disk, then grepped) and it says so; the source date is given where the page shows one. Marketplace sections in part 2 use search-result highlights that I did not open as full pages, so third-party claims there are *asserted* (source claims, page not opened by me) unless a line says otherwise. Prices change monthly; all vendor numbers are as read on 2026-11-14.

## Relation to the existing notes

- Confirms [replay.md line 57](../../../spec/features/replay.md): a raw browser over CDP exposes the network log (*observed*). Extends it: the open item "whether a V4 task run exposes its network log was not found" now has an answer in part 1 (it does not; run events are not the HTTP log).
- Extends [replay.md line 120](../../../spec/features/replay.md) (where replay runs, may the session leave the cloud browser): two vendors have a call-from-inside-the-session route, Kernel `curl` and Browserbase in-page Playwright (part 1). This is the "calls from the page" option named at that line.
- Confirms [replay.md lines 82-83](../../../spec/features/replay.md) (challenge page means stop): part 2 shows challenge pages and 403s are the normal first response on all five sites. Extends line 121 (does replay change ban risk): see "What the sources say about detection layers" in part 2.
- Confirms [posting-browser-use-ebay.md line 19](../../list/ben/posting-browser-use-ebay.md) price line ($5/GB proxy) against the Browser Use pricing page; the billing and pricing pages are in part 1.
- Confirms [crosspost-and-delist.md line 30-31](../../list/ben/crosspost-and-delist.md): Poshmark medium ban risk, Facebook high. Extends with named vendors (part 2). Where that table says eBay "Low on the API", part 2 does not contradict it: the eBay User Agreement bans automated means in browsers.
- Confirms [platform-access.md lines 116-117](../../connect/nate/platform-access.md) (Poshmark Terms and Community Guidelines wording) and [line 69](../../connect/nate/platform-access.md) (Meta Automated Data Collection Terms); extends with the Mercari Help Center wording and the 2026 eBay User Agreement clause (part 2).

## 1. Cloud browser vendors

### 1.1 Does Browser Use cloud expose the network log or HAR?

- A V4 task run does not itself expose a network log or HAR (*observed*, docs.browser-use.com cloud docs: network-capture, stealth, captcha-handling, authentication, billing and pricing pages, fetched 2026-11-14). Run events are not the HTTP log.
- A CDP client can attach to the live V4 browser through `cdpUrl` (`GET /api/v4/browsers/{id}`) and capture `Network.requestWillBeSent`, `responseReceived`, `loadingFinished` and `getResponseBody` from the moment of attachment only (*observed*, same docs). The vendor's sample logs origins only, and HAR needs a custom exporter (*observed*).
- Run settings seen: `browserSettings` with `profileId`, `proxyCountryCode`, `customProxy`, `record`, `networkPolicyId`; `keepAlive`; a busy session returns 409 (*observed*). Profiles persist logins; Profile Sync, 1Password and TOTP are in [posting-browser-use-ebay.md line 16](../../list/ben/posting-browser-use-ebay.md).
- Price: pay as you go, 10 concurrent free, $5/GB proxy, `maxCostUsd` per run (*observed* on the billing page; matches posting-browser-use-ebay.md line 19).
- Inferred: a recording of an action through V4 alone would miss the calls made before a CDP client attached, so a recorder would have to attach to the Browser API session first and drive the task in it.

### 1.2 Comparison table

| Vendor | Persistent login | CDP | Network log or HAR | Stealth and proxies | Session limits and price (as read 2026-11-14) |
|---|---|---|---|---|---|
| Browser Use | Profiles, Profile Sync | `cdpUrl` on a V4 browser | None built in; DIY via CDP, from attach only | Stealth page; proxy $5/GB; `customProxy` | 10 concurrent free; pay as you go |
| Browserbase | Contexts keep cookies, localStorage, IndexedDB (not the HTTP cache); `persist: true`; wait a few seconds after close before reuse | `connectUrl` with Playwright `connectOverCDP` | Yes: Session Logs API `GET /v1/sessions/{id}/logs` returns CDP events including network activity; "Network logs" view in observability. Playwright `routeFromHAR` HAR files stay on the remote instance; docs point to tracing for local network data | Verified tier (Developer: Basic verified and Auto captcha); managed residential proxies via `proxies: true` (best-effort US), 200+ countries, external proxies supported | Free $0: 1 browser hour, 3 concurrent, 15 min sessions, no proxy. Developer $20: 100 hrs, $0.12/hr over, 1 GB proxy then $12/GB, 25 concurrent, 6 hr sessions. Startup $99: 500 hrs, $0.10/hr, 5 GB then $10/GB, 100 concurrent. Scale: 250+ concurrent. Session creation per minute equals the concurrency limit |
| Steel | Profiles hold the user data directory (cookies, extensions, credentials, settings); `persistProfile`, reuse by `profileId`; 300 MB cap; deleted after 30 days unused; docs advise one profile and one dedicated IP per account | `wss://connect.steel.dev?apiKey=...&sessionId=...` (Playwright, Puppeteer, Selenium) | Dashboard tabs Console Logs, Network, Agent Traces (export JSON, markdown, ZIP). No documented API for a network log or HAR found | Signals `captcha_encountered`, `bot_detection_triggered`, `proxy_connection_failed`; CAPTCHA solving and proxies need a $10 deposit; Stealth Browser is Enterprise | Launch $0 + $30 credit: $0.10/hr, $10/GB proxy, 10 concurrent, 15 min sessions, 60 req/min, 7 day retention. Scale $250/mo + $100 credit: $0.08/hr, $6/GB, 100 concurrent, 1 hr sessions, 600 req/min, dedicated IP $5/IP/month. Enterprise: 1,000+ concurrent, 24 hr sessions (pricing page last edited 2026-10-23) |
| Anchor Browser | Browser profiles persist cookies, localStorage, cache; Managed authentication (Applications and Identities) re-authenticates before each session | `cdp_url` and `live_view_url` from the sessions API | MP4 recording only (essentials/recording page). No network log or HAR page found | Proxy, BYO proxy, Dedicated Sticky IP, Extra Stealth (Growth and up), CAPTCHA solving (Starter and up), Web Bot Auth; unique fingerprinting Enterprise only | Free $5 credit/month, 5 concurrent. Starter $50/mo, 25 concurrent. Growth $2000/mo, 200 concurrent, 100 sessions/min. Enterprise 500+. $0.01 per browser, $0.05 per browser hour, Anchor proxy $8/GB, BYO or no-proxy egress $0.2/GB. Retention 7 days on Free and Starter. Also "Automation Tasks": versioned, from a prompt or a demonstration, self-healing, 0.1 credit per run |
| Hyperbrowser | Profiles keep cookies, localStorage, sessionStorage, cache; `persistChanges` defaults false; API has fork, get, delete | CDP session | rrweb "Web Recording" on by default; docs say it captures "DOM changes, interactions, and network requests in a lightweight JSON format". It is rrweb JSON, not HAR; how much of each request it holds was not checked. Optional MP4 | `useStealth`; `useUltraStealth` Enterprise only; `useProxy` with proxy routes page | 1 credit = $0.001; browser $0.10/hr; proxy $10/GB. Concurrency and subscription tiers not found. Action Caching (HyperAgent `page.ai()` returns an `actionCache`) replays recorded actions without an LLM, at action level and not HTTP level |
| Kernel | Profiles capture the user data directory, encrypted per organization; `name` unique per project; Managed Auth (Auth connections) separate | CDP | Yes: opt-in Browser Telemetry. The `network` category emits `network_request`, `network_response`, `network_loading_failed`, `network_idle`, `proxy_error`, with "Request and response headers (including Authorization and Cookie), request bodies, and truncated response bodies, plus full URLs"; streamed over SSE or exported by OTLP. Disabled under a BAA. `network_idle` can miss earlier requests if telemetry attaches mid-load. Not HAR | Stealth mode: Patchright, ISP proxy by default and automatic CAPTCHA solver, both opt-out; ISP proxies "hosted in data centers but announced on residential ISP networks"; browser pools for IP consistency. Configurable proxies Hobbyist and up, BYO proxy Start-Up and up | Developer free ($5 credit), 5 concurrent. Hobbyist $30 ($10 credit), 10 concurrent. Start-Up $200 ($50 credit), 150 concurrent. Per second: headful $0.0001333336, headless $0.0000166667, headful GPU $0.0008000016. Replays kept 1, 7, 30 days. Create-rate limits return 429 with `X-RateLimit-*` |

All cells above are *observed* on the vendor docs and pricing pages fetched 2026-11-14 (docs.browserbase.com, docs.steel.dev, docs.anchorbrowser.io, hyperbrowser.ai/docs, kernel.sh/docs, docs.browser-use.com).

### 1.3 Replay-relevant facts

- Kernel offers `POST /browsers/{id_or_name}/curl`: "Make an HTTP request through the browser's network stack ... uses the browser's TLS fingerprint, cookies, proxy configuration, and headers. Returns structured JSON with status, headers, body, timing" (*observed*, Kernel docs). This is a vendor-supplied way to repeat a recorded call from inside the session with the session's own fingerprint and cookies.
- Kernel's network telemetry puts `Authorization` and `Cookie` header values into the stream (*observed*). That is the opposite of the recipe rule in [replay.md line 30](../../../spec/features/replay.md) (templates hold allowed header names, never cookies or tokens), so a recorder reading it needs the scrub step in [replay.md line 50](../../../spec/features/replay.md).
- Browserbase's Session Logs API returns network events after the run, without a client attached during it (*observed*). Whether bodies are included was not checked.
- Browserbase and Steel session caps (15 min on free tiers, 6 hr or 1 hr on mid tiers) and Steel's 30 day profile expiry bound how long a logged-in profile lives (*observed*).
- Steel and Browserbase docs tell users to pair a profile or context with a stable IP (Steel: one profile and one dedicated IP per account, *observed*). Inferred: logging in from one IP and replaying from another is the pattern part 2 says sites flag.
- MPP pricing from Kernel: one stealth headful browser for 30 minutes costs $0.50 (*observed*).

## 2. Marketplace detection and enforcement

### 2.0 What the sources say about detection layers

- Vendor attribution is mostly from third-party response-signature registries and scraper blogs, not from the marketplaces. Treat each vendor name as *asserted* unless a line says otherwise.
- A July 2026 registry lists eBay as Akamai, Depop as Cloudflare, Mercari as Cloudflare, and rates Depop and Mercari "Hard target" and eBay "Moderate" (*asserted*, search highlight, https://www.proxies.sx/anti-bot/category/marketplace, reviewed July 2026, not opened as a full page).
- A signal list for the vendors (*asserted*, https://liarjs.dev/blog/anti-bot-vendor-stack/, 2026-10-24, highlight only): Akamai uses `sensor_data` JavaScript and the `_abck` cookie, plus datacenter IP as a strong signal; DataDome binds its `datadome` cookie to the IP that obtained it; HUMAN/PerimeterX is behavior-heavy with a "Press & Hold" captcha. Inferred: a session cookie obtained in the cloud browser may stop working when replayed from a different IP, which is the case for Kernel `curl` and in-page calls staying inside the session (they keep the IP).
- Across sources the common signals are IP reputation (datacenter versus residential), TLS fingerprint, browser environment, and behavior (*asserted*, https://link.sc/blog/bypass-datadome-perimeterx-akamai, 2026-07-18, highlight only).

### 2.1 eBay

- Anti-bot: Akamai Bot Manager, with a plain Python request returning 403 from `AkamaiGHost` (*asserted*, https://ebayscraperapi.com/blog/how-to-scrape-ebay-with-python, 2026-06-16, highlight only; registry above agrees). The same source says eBay names itself as an Akamai customer in an enterprise case study (*asserted*).
- Terms: User Agreement section 3 bans "any robot, spider, scraper, data mining tools, data gathering and extraction tools, or other automated means (including, without limitation buy-for-me agents, LLM-driven bots, or any end-to-end flow that attempts to place orders without human review)" without prior express permission; also bans circumventing technical measures and sharing login credentials with third parties; version for existing users effective 2026-06-28, same wording in the 2026-02-20 version (*asserted*, https://ppc.land/ebay-bans-the-robot-shopper-unless-ebay-sends-the-invitation/, 2026-11-13, highlight only). The existing note at [platform-access.md line 47](../../connect/nate/platform-access.md) says the same by inference.
- Actions: "limit, suspend, or terminate your user account(s)", and "take technical and/or legal steps" (*asserted*, same source). A spokesperson said eBay permits "AI search, discovery and certain agent-assisted navigation" while blocking unauthorized scraping "when detected"; Meta's Muse agent was reported blocked from eBay listings in November 2026 (*asserted*, same source, citing The Verge, unopened).
- Rate limits: official Inventory API create/update 200 per 10 s (*observed* in [crosspost-and-delist.md line 30](../../list/ben/crosspost-and-delist.md)); Browse API 5,000 calls/day free by default (*asserted*, ebayscraperapi.com).
- Captchas and soft blocks: CAPTCHA injection, soft blocks and silently degraded pages for uniform paced traffic (*asserted*, https://alterlab.io/blog/how-to-scrape-ebay-complete-guide-for-2026, undated, highlight only).

### 2.2 Poshmark

- Anti-bot: two different attributions. Cequence (API protection, blocking credential stuffing on web and API, cut captcha challenges 99.3% from 2,600,000 to 18,000 per week) is from a Cequence case study (*asserted*, https://www.cequence.ai/case-studies/poshmark-prevents-automated-attacks, 2023-03-02, vendor marketing, highlight only). A 2026-08 comparison lists Poshmark with Cequence Security and TransUnion TruValidate Device Risk (*asserted*, https://data-ox.com/resources/blog/stockx-vinted-depop-scraper/, 2026-08-26, highlight only). I found no source naming Akamai, PerimeterX, DataDome or Arkose on Poshmark.
- Captcha: Trend Micro reported Poshmark presents reCAPTCHA to automation and that Poshmark bots call a captcha-solving service through proxyware networks (*asserted*, https://www.trendmicro.com/en_us/research/23/e/abusing-web-services-using-automated-captcha-breaking-services-and-residential-proxies.html, 2023-05-25, highlight only).
- Terms: Community Guidelines bar "unauthorized programs or other forms of automation", naming "deleting and reposting content, liking, sharing, following, and unfollowing", and allow "human helpers"; violations "may result in deleted content, removal of listings or restrictions to your account" (*observed* at [platform-access.md line 117](../../connect/nate/platform-access.md), fetched 2026-11-14). Terms 4(b) bans automated systems to collect data (*observed*, platform-access.md line 116). Terms section 16 allows suspension "at our discretion without explanation, notice, and liability" and bans creating new accounts to evade it (*asserted*, https://hproxy.com/blog/proxies-for-poshmark, 2026-07-11, highlight only).
- Behavior thresholds reported by resellers (all *asserted*, highlight only): captchas appearing, share button stopping ("share jail"), follow and comment restrictions, "unusual activity" emails, then longer suspensions (https://www.flipsail.io/blog/poshmark-bot-guide-2026, 2026-02-03); cloud accounts on server IPs that do not match the home location are called out as a flag, and the same source says its own cloud accounts were flagged (same URL); a sharing limit around 5,000 shares per day is quoted by a tool vendor (https://theresaledoctor.com/poshmark-share-jail/, 2023-03-29). The November 2025 mass suspensions are at [platform-access.md line 120](../../connect/nate/platform-access.md) (*asserted* there).

### 2.3 Mercari

- Anti-bot: Cloudflare (*asserted*, proxies.sx registry July 2026; https://scraperly.com/scrape/mercari, 2025-06-01, which says a plain request returns 403, both highlight only). No source for DataDome, PerimeterX, Akamai or Arkose on Mercari.
- Terms: Prohibited Conduct bars "any robot, spambot, spider, crawler, scraper or other automated means or interface not provided by us to access the Service or to extract data", circumventing security features, and multiple accounts or new accounts after a ban (*asserted*, search highlight of https://www.mercari.com/us/help_center/topics/account/policies/prohibited-conduct/, no date shown, not opened as a full page). Matches [platform-access.md line 136](../../connect/nate/platform-access.md).
- Actions: may contact users or use a third-party verification service, remove items, suspend access until verification, bar future use, and hold funds after a suspension to cover chargebacks or refunds (*asserted*, same highlight).
- Rate limits and captcha behavior for logged-in sellers: not found.

### 2.4 Depop

- Anti-bot: Cloudflare, with `__cf_bm` and Turnstile state (*asserted*: https://www.proxies.sx/anti-bot/depop, 2026-07-01; https://github.com/Gertje823/Vinted-Scraper/issues/47, undated, which reports 403 on the Depop API after Cloudflare was added; highlights only).
- A skill listing sourced to Browserbase (2026-05-18) says `webapi.depop.com/api/v2/search/products/` returns 403 to cookieless requests even from a residential proxy, and works only from the page's own fetch context that carries `__cf_bm` and Turnstile state; it says a Browserbase session with `--verified --proxies` is required past the first 24 results (*asserted*, https://www.explainx.ai/skills/depop.com/search-listings-p8xawn/search-listings, highlight only). Inferred: for Depop, a recorded call replayed from outside the browser session fails and a call made from the page context is the pattern that works; this supports the in-session option at [replay.md line 120](../../../spec/features/replay.md).
- Terms: Depop API terms prohibit automated systems or software to access, analyze or scrape the platform, listings, shops or profiles unless authorized in writing (*asserted*, https://www.webscrapinghq.com/blog/depop-scraper, 2026-10-30, highlight only). Cross-listing exception and its three conditions are at [platform-access.md line 140](../../connect/nate/platform-access.md) (*asserted* there).
- Account actions and rate limits for seller accounts: not found.

### 2.5 Facebook Marketplace

- Anti-bot vendor: not found. Arkose is named only in a third-party tool's spec, which routes Arkose challenges to a captcha service and sends Facebook's own challenge to a person (*asserted*, https://log.listeningkit.com/docs/howItWorks/specs/marketplacePublish, undated, highlight only). That shows Arkose challenges appear in Facebook flows, not on which actions.
- Terms: Meta Terms of Service (effective 2025-01-01) "You may not access or collect data from our Products using automated means (without our prior permission)"; Automated Data Collection Terms (2024-10-07) need "express written permission" (*asserted*, https://siftmarketplace.com/guides/facebook-marketplace-bots, 2026-10-12, highlight only; the second one is *observed* at [platform-access.md line 69](../../connect/nate/platform-access.md)). A second source quotes the same Terms line adding "regardless of whether such automated access or collection is undertaken while logged-in to a Facebook account" (*asserted*, https://admakeai.com/blog/meta-account-flagged-automation, 2026-07-20, highlight only).
- Actions and messages: "We suspect automated behaviour on your account ... To prevent your account from being temporarily restricted or permanently disabled, ensure that no other users or tools have access to your account" is the warning stage, before restriction (*asserted*, admakeai.com; the same text quoted in a user thread at https://github.com/mautrix/meta/issues/44, 2024-03, highlight only). In that thread a bridge token was blocked and a second token was blocked within 24 hours while the account stayed open (*asserted*). Captcha, phone number or password reset prompts are reported for suspicious activity (*asserted*, mautrix docs quote in the same thread).
- Account-level cascade: a flagged profile can also restrict Page, ad account and Business Manager access (*asserted*, admakeai.com, which says a review left incomplete for 30 days becomes permanent; not checked against Meta).
- Marketplace limits: Meta Help Center documents 20 total new Marketplace listings per month and 5 in Vehicles (*asserted*, https://autolander.ai/guide/facebook-marketplace-automation/, 2026-09-03, highlight only).

## Not found

- Whether Browserbase Session Logs include response bodies; whether Hyperbrowser rrweb includes request bodies or headers.
- A documented Steel API for the dashboard Network tab; any Anchor network log.
- Hyperbrowser concurrency and subscription tiers.
- Which anti-bot vendor Poshmark, Facebook Marketplace use in 2026 on the seller-logged-in surface (only Cequence and TruValidate for Poshmark, from vendor and comparison pages, no Akamai, HUMAN, DataDome or Arkose attribution found for Poshmark or Mercari).
- Per-account rate limits for logged-in seller actions on Mercari, Depop and Facebook.
- Any source on whether a recorded call replayed from a different IP than the login IP is rejected on these five sites.
- Meta's own Help Center and Terms pages (only second-hand quotes).

## Searched / could not reach

- Searched (Exa, 2026-11-14): Poshmark bot detection and suspension; Mercari anti-bot and automation; Depop bot protection; eBay Akamai and automation; Facebook Marketplace automation and restrictions. Results were search highlights; I did not open each page in full, so marketplace third-party claims are *asserted*.
- Not reached: eBay User Agreement page, Depop terms page, Meta Terms and Commerce Policies pages (JavaScript shells in the earlier note, [platform-access.md line 69](../../connect/nate/platform-access.md)); The Verge report on Meta Muse (unopened); Akamai, HUMAN, DataDome and Arkose vendor documentation.
- Vendor docs were fetched and read in full for part 1 (saved to the session scratchpad); a narrow search does not prove a log or HAR API absent where I wrote "not found".

## Sources fetched

- Browser Use cloud docs (docs.browser-use.com): network-capture, stealth, captcha-handling, authentication, billing, pricing, llms.txt.
- Browserbase docs (docs.browserbase.com): contexts, observability, session logs API, plans, proxies.
- Steel docs (docs.steel.dev): profiles, sessions and CDP connection, pricing and limits (last edit 2026-10-23).
- Anchor Browser docs (docs.anchorbrowser.io): profiles, authentication, recording, network-and-stealth overview, plans.
- Hyperbrowser docs (hyperbrowser.ai/docs): profiles, web recording, stealth, proxies, pricing.
- Kernel docs (kernel.sh/docs): profiles, stealth, browser telemetry categories, `curl` API, pricing.
- Search highlights only (marketplace section): the URLs cited in part 2.
