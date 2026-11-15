Researched 2026-11-14 by Nate (retriever seat).
Owner: Nate. Written 2026-11-14 by a retriever seat. Status: reference.

Labels: **observed** = read at the cited URL on 2026-11-14. **asserted** = the vendor says it, no code or reference page shows it. **inferred** = my reasoning. Prices and limits can change; re-read https://browser-use.com/pricing before a spend decision. No browser was started and the cloud API was not called.

## Question and what it decides

Can the TS/Node kernel get a Browser Use Cloud browser, drive it with Playwright over CDP using our own recipes, keep a marketplace sign-in between runs, run many in parallel, and stay cheap and fast? It decides: the create/stop calls the kernel wraps, how sign-in is stored, the cost model, and how a person takes over.

The docs are on API **V4** now (V3/V2 are legacy). Base URL `https://api.browser-use.com/api/v4`. Auth header `X-Browser-Use-API-Key: <key>` (no `Bearer`). Observed: https://docs.browser-use.com/cloud/browser/quickstart.md

## What changed

| Draft | Verdict | Finding |
|---|---|---|
| $0.02/browser-hour | **Changed** | $0.06 per browser-hour, billed by the minute, 1-minute minimum. Observed: https://browser-use.com/pricing and https://docs.browser-use.com/cloud/guides/billing.md (worked example uses $0.06/hour). |
| 10 concurrent on free tier | **Held** | 10 / 50 / 250 / 500 / 1000 concurrent at $0 / $100 / $1,000 / $5,000 / $25,000 lifetime qualifying payments. Observed: https://docs.browser-use.com/cloud/guides/concurrency.md |
| `client.browsers.create()` in `browser-use-sdk` returns `cdp_url` | **Held, spelling changed** | Package `browser-use-sdk`, TS import path `browser-use-sdk/v4`, class `BrowserUse`. TS field is `cdpUrl` (camelCase); Python is `cdp_url`. Also returns `id`, `liveUrl`, `timeoutAt`, `status`. Observed: quickstart above and https://docs.browser-use.com/cloud/api-v4/browsers/create-browser-session.md |
| Closing CDP does not stop the browser; `client.browsers.stop(id)` does | **Held** | "Disconnecting Playwright/CDP or closing the SDK client is not the cloud stop operation." REST: `PATCH /api/v4/browsers/{id}` with `{"action":"stop"}`. Observed: https://docs.browser-use.com/cloud/guides/billing.md and https://docs.browser-use.com/cloud/api-v4/browsers/update-browser-session.md |
| `Browser(storage_state='auth.json')` reloads cookies and localStorage | **Changed / not supported in current docs** | The open-source library is now 1.0 (Python). Its migration table maps `storage_state` and `cookie_whitelist_domains` to: Cloud `cloud_profile_id`; local `Browser('chrome', profile=...)` or `Browser('chromium', user_data_dir=...)`. I found no `storage_state` parameter and no `export_storage_state` in the 1.0 docs. The 0.x docs sit under `/open-source/legacy/0.x/` and were not read. Observed: https://docs.browser-use.com/open-source/browsers.md line "storage_state, cookie_whitelist_domains". This is Python only; the kernel is TS, so none of it applies to us directly. |

## What we build from

Create, connect, work, stop (observed, canonical quickstart):

```typescript
import { BrowserUse } from "browser-use-sdk/v4";
import { chromium } from "playwright";

const client = new BrowserUse(); // reads BROWSER_USE_API_KEY from env (asserted by quickstart wording; not verified in SDK source)
const session = await client.browsers.create({ proxyCountryCode: "us" });
try {
  if (!session.cdpUrl) throw new Error("The browser did not return a CDP URL");
  const browser = await chromium.connectOverCDP(session.cdpUrl);
  try {
    const context = browser.contexts()[0];            // reuse, do not newContext()
    const page = context.pages()[0] ?? await context.newPage();
    await page.goto("https://example.com");
  } finally { await browser.close(); }                // disconnect only
} finally { await client.browsers.stop(session.id); } // this is the real stop
```

Source: https://docs.browser-use.com/cloud/browser/quickstart.md and https://docs.browser-use.com/cloud/browser/playwright-puppeteer-selenium.md (observed). Reuse of `contexts()[0]` / `pages()[0]` is observed there; the profile's cookies do not apply to a `newContext()` (observed, same page). Selenium is not supported (observed, same page).

Raw REST (observed, https://docs.browser-use.com/cloud/api-v4/browsers/create-browser-session.md):

```bash
curl https://api.browser-use.com/api/v4/browsers \
  -H "X-Browser-Use-API-Key: $BROWSER_USE_API_KEY" -H "Content-Type: application/json" \
  -d '{"profileId":"<uuid>","proxyCountryCode":"us","timeout":2}'
# stop
curl -X PATCH https://api.browser-use.com/api/v4/browsers/$ID \
  -H "X-Browser-Use-API-Key: $BROWSER_USE_API_KEY" -H "Content-Type: application/json" \
  -d '{"action":"stop"}'
```

Create-browser request fields (observed, OpenAPI in the create page; all optional):

| Field | Type / limit | Note |
|---|---|---|
| `profileId` | uuid | cloud profile to attach |
| `networkPolicyId` | uuid | allow/block domains; changes reach the browser "within seconds" |
| `proxyCountryCode` | country code, default `us`, `null` = no proxy | |
| `timeout` | integer minutes, 1-240, default 60 | server stops the browser at this time |
| `browserScreenWidth` / `browserScreenHeight` | 320-6144 / 320-3456 | viewport; there is no `viewport` object |
| `allowResizing` | bool, default false | vendor says resizing lowers stealth |
| `solveCaptchas` | bool, default true | |
| `pdfRendererEnabled` | bool, default true | |
| `enableRecording` | bool, default false | |
| `extensionIds` | up to 3 uuids | |
| `customProxy` | `{host,port,username,password}` | enterprise only; top-level on `/browsers` |
| `metadata` | up to 10 string pairs | filterable on list |

Response fields: `id`, `status`, `liveUrl`, `cdpUrl`, `timeoutAt`, `startedAt`, `finishedAt`, `proxyUsedMb`, `proxyCost`, `browserCost`, `recordingUrl` (only on GET one), `metadata`. A 429 on create means too many concurrent active sessions.

There is **no** parameter for ad blocking, image/font blocking, or an explicit keep-alive on `POST /browsers` (not-found in the OpenAPI above). Domain blocking exists through `networkPolicyId` (https://docs.browser-use.com/cloud/browser/network-policies.md; page was fetched but only its summary line was read). Inferred: block images, fonts and ads on our side with Playwright `context.route(...)` over CDP.

Capacity check (observed): `GET https://api.browser-use.com/api/v2/billing/account` returns `totalCreditsBalanceUsd` etc. Per-session full cost: `GET /api/v4/sessions/{id}/cost` returns `browserCostUsd`, `proxyCostUsd`, `proxyUsedMb` (observed in billing.md; this is keyed by agent session id, whether it works for a standalone browser id was not checked).

## Speed

- Cold start time: **not-found**. No page I read states a number. Create returns `cdpUrl` in the same response (observed in the quickstart, which connects immediately), so inferred: the wait is the create call itself. Measure it; I was told not to call the API.
- Warm reuse: a standalone browser stays alive until stopped or `timeout`, and holds a concurrency slot the whole time (observed, https://docs.browser-use.com/cloud/guides/concurrency.md). Inferred: you can keep one open and reconnect with `connectOverCDP(cdpUrl)` repeatedly, paying browser-minutes while idle. No pool or "warm browser" product is described.
- Agent runs: the V4 agent browser stays open about 2 minutes after last run activity, or `keepAlive` seconds (120-14400) if set on the run; that time is billed (observed, billing.md).
- Regions: US (`api.browser-use.com`) and EU Frankfurt (`api.eu.browser-use.com/api/v4`, separate EU API key, dashboard and profiles/sessions are separate resources). Observed: https://docs.browser-use.com/cloud/eu-deployment.md. No other regions seen. Proxy country is separate from datacentre region.
- Page weight: only `networkPolicyId` (domain allow/block) and the `proxyCountryCode: null` option (no proxy overhead) are offered; see above. Image/font blocking is ours to do (inferred).
- Cheapest agent latency presets: `bu-ultrafast`, `bu-fast` (see section on authoring). Observed: https://docs.browser-use.com/cloud/agent/models.md

## Cost

Rule (observed, https://docs.browser-use.com/cloud/api-v4/browsers/create-browser-session.md and billing.md): the full `timeout` is charged at start; on stop the unused time is refunded pro rata; billed time is rounded up to the whole minute with a 1-minute minimum. Example in billing.md: 12 min 13 s bills as 13 minutes.

Rates (observed, https://browser-use.com/pricing): browser $0.06/hour; managed residential (home-IP) proxy $5/GB; direct or own-proxy traffic $0.20/GB; $1 one-time signup credit. Network traffic is billed separately from browser time, including with a custom proxy or `proxyCountryCode: null` (billing.md). Top-ups: $5 minimum, whole dollars; purchased credits do not expire.

Worked figure, 1,000 runs of 20 s each, each browser stopped as soon as the run ends:
- Browser time: each run bills 1 minute (rounded up). 1,000 x 1 min x $0.06/60 = **$1.00**. (Under per-second billing it would be $0.33; the minute rounding triples it.)
- Proxy traffic, **inferred** with an assumed 2 MB per run (not from the docs): 1,000 x 2 MB = about 1.95 GB. Managed proxy: about $9.77. Direct (`proxyCountryCode: null`): about $0.39. Change the 2 MB to your measured page weight.
- If a browser is not stopped, it bills for its whole `timeout` (default 60 min = $0.06 per run, 20 times the 1-minute figure): inferred from the upfront-charge rule.
- Free tier: $1 signup credit is about 16 browser-hours of time and no proxy, or fewer with proxy (inferred arithmetic).
- Spend caps: an API key can have a monthly soft cap; reaching it returns HTTP 402 `api_key_monthly_spend_limit_reached` on new admission (observed, billing.md).

Concurrency: a standalone browser holds a slot from create until stop (observed, concurrency.md). Idle V4 agent browsers do not hold a slot.

API rate limits (observed, concurrency.md): per project max(25, 2 x concurrency) requests per second, general cap 100, counted in 5-second windows; edge limit 1000 RPS per IP over 300 s; over the limit returns 429 with `Retry-After`.

## Stored sign-in

Cloud profiles (observed, https://docs.browser-use.com/cloud/api-v4/profiles/create-profile.md, list-profiles.md, delete-browser-profile.md):
- Create: `POST /api/v4/profiles` body `{name, userId}`.
- List: `GET /api/v4/profiles?pageSize&pageNumber&query`.
- Delete: `DELETE /api/v4/profiles/{profile_id}`; deletes stored cookies and localStorage.
- Update: `PATCH /api/v4/profiles/{profile_id}` exists; body not read.
- Attach: `profileId` on `POST /browsers` (or `browserSettings.profileId` on a run).

What persists (observed, https://docs.browser-use.com/cloud/guides/authentication.md and profile-sync.md): cookies, localStorage and login state, saved when the browser is stopped. Inferred consequence: a browser that is never stopped, or killed at timeout, may not save the session; always stop through the API. The docs recommend one profile per end user (observed, authentication.md). A profile count limit exists; the number was not found.

Import: the vendor's helper copies logins from your local Chrome into a cloud profile: `curl -fsSL https://browser-use.com/profile.sh | sh` with the API key in env; it returns a profile id (observed, profile-sync.md). I did not read that script; it is a pipe-to-shell, so read it before running it. No REST endpoint to upload a storage-state JSON or a cookie list into a profile was found. Inferred alternative: after `connectOverCDP`, call `context.addCookies(...)` on `contexts()[0]` yourself from our own vault (the repo already has `app/src/edge/browser/` with `StorageState` and `AuthVault` types, not read here). The docs warn sites may reject a moved login that is bound to device or location; use a stable proxy country (profile-sync.md).

Two browsers on one profile at once: **not-found**. No page states whether it is allowed. Inferred risk: both would save on stop and the later save may overwrite the first. Do not assume it is safe.

Open-source `storage_state` / `user_data_dir` / `export_storage_state`: in the 1.0 Python library, `user_data_dir` is kept for local Chromium (observed, https://docs.browser-use.com/open-source/browsers.md, https://docs.browser-use.com/open-source/all-parameters.md); `storage_state` is replaced (see "What changed"); `export_storage_state` not found. Playwright's own `context.storageState()` is a Playwright feature, not a Browser Use one (inferred; I did not fetch Playwright docs).

2FA: the vendor suggests a saved profile or a human checkpoint (observed, https://docs.browser-use.com/cloud/guides/2fa.md).

## A person takes over

- Standalone browser: `liveUrl` in the create response. Observed: create-browser-session.md, https://docs.browser-use.com/cloud/browser/live-preview.md.
- Agent run: `live_view_url` in the `browser.ready` (and `browser.reattached`) event; set `keepAlive` so the browser outlives the human's work (observed, https://docs.browser-use.com/cloud/agent/human-in-the-loop.md and concurrency.md).
- The URL is a credential: anyone with it can drive the browser (observed, live-preview.md and browsers.md `live_view`). The viewer takes `readOnly=true` and `ui=false` query options (observed, live-preview.md).
- Learning that they are done: **no webhook or event** for "human finished" was found. The doc example uses a Continue control in the UI or pressing Enter. Inferred: the kernel gets its own signal, by polling the page over CDP for a known post-login state (URL or element) or by our own "Done" button in our app, then continues the recipe and stops the browser.

## Authoring recipes with the agent (tasks API)

Only as far as authoring needs (observed, https://docs.browser-use.com/cloud/api-v4/runs/create-run.md, models.md, https://browser-use.com/pricing):

```typescript
const run = await client.runs.create({
  task: "Log in and open the order list",
  model: "bu-ultrafast",                          // or "bu-fast"; default is gpt-6-luna (High reasoning)
  browserSettings: { proxyCountryCode: "us", profileId: "<uuid>" }, // TS type needs proxyCountryCode whenever browserSettings is present
  keepAlive: 300,                                  // seconds, 120-14400
});
// then client.runs.waitForCompletion(...) / waitForEvent(...)  (names seen in docs; signatures not read)
```

Model prices per 1M tokens (input / cached / output): BU Ultrafast $0.24 / $0.024 / $1.20, about $0.006 per median task; BU Fast $0.12 / $0.012 / $0.60; GPT-6 Luna $0.12 / $0.012 / $0.60; GPT-5.6 Luna $0.24 / $0.024 / $1.44. Free-plan projects (no purchase yet) can use only `gpt-6-luna`, `gpt-5.6-luna`, `deepseek-v4.1-flash`, `gemini-3-flash`, `minimax-m3`, `bu-ultrafast` and `bu-fast` (models.md). Cost per step: **not-found** as a number; the vendor quotes about $0.006 per median task for Ultrafast only. Using your own provider key adds an orchestration fee of 0.2x the model token cost (billing.md). Run `totalCostUsd` covers LLM and search only; browser time and proxy are on the session cost (billing.md).

## Not found

- Cold-start time of a cloud browser. Looked: quickstart, create page, pricing, FAQ, concurrency, billing.
- Whether two browsers may use one profile at once. Looked: profile pages, authentication, profile-sync, FAQ.
- Profile-count limit number. Looked: authentication.md, create-profile.md.
- An API to upload storage state or a cookie list into a cloud profile (only the local `profile.sh` sync helper and our own `addCookies` route). Looked: profile and browser reference pages, profile-sync.
- Ad, image or font blocking parameter on browser create. Looked: create OpenAPI schema (full field list above).
- A "human finished" event or webhook. Looked: live-preview, human-in-the-loop, 2FA.
- Open-source `export_storage_state` and a 1.0 `storage_state` parameter; the 0.x legacy docs (`/open-source/legacy/0.x/`) were not opened.
- Cost per agent step as a number (only per-token and per median Ultrafast task).
- Contents of the SDK GitHub README, the SDK source, and the `PATCH /profiles/{id}` body, the network-policies page body, and the stealth page body were not read in full. context7 was not available in this session, so docs came from docs.browser-use.com `.md` pages via curl.
- Exact limits of a "free tier" beyond concurrency and models: there is a $1 one-time signup credit; no recurring free allowance found.

## Sources fetched

All fetched 2026-11-14 with curl (bytes read):
- https://docs.browser-use.com/llms.txt
- https://browser-use.com/pricing
- https://docs.browser-use.com/cloud/browser/quickstart.md
- https://docs.browser-use.com/cloud/browser/playwright-puppeteer-selenium.md
- https://docs.browser-use.com/cloud/browser/proxies.md
- https://docs.browser-use.com/cloud/browser/live-preview.md
- https://docs.browser-use.com/cloud/browser/network-policies.md (summary only)
- https://docs.browser-use.com/cloud/api-v4/browsers/create-browser-session.md
- https://docs.browser-use.com/cloud/api-v4/browsers/update-browser-session.md
- https://docs.browser-use.com/cloud/api-v4/profiles/create-profile.md
- https://docs.browser-use.com/cloud/api-v4/profiles/list-profiles.md
- https://docs.browser-use.com/cloud/api-v4/profiles/delete-browser-profile.md
- https://docs.browser-use.com/cloud/api-v4/runs/create-run.md
- https://docs.browser-use.com/cloud/guides/authentication.md
- https://docs.browser-use.com/cloud/guides/profile-sync.md
- https://docs.browser-use.com/cloud/guides/concurrency.md
- https://docs.browser-use.com/cloud/guides/billing.md
- https://docs.browser-use.com/cloud/guides/2fa.md
- https://docs.browser-use.com/cloud/agent/human-in-the-loop.md
- https://docs.browser-use.com/cloud/agent/models.md
- https://docs.browser-use.com/cloud/eu-deployment.md
- https://docs.browser-use.com/open-source/browsers.md
- https://docs.browser-use.com/open-source/all-parameters.md

## Seen in the console (added 2026-11-14 about 23:00 Central)

From Nate's screenshot of cloud.browser-use.com "Launch a cloud browser", account on tier 1. Each line is *observed* on that page, not in the docs.

- The price line reads "Up to $0.01 for 15 min · billed by the minute while it runs". At the documented $0.06 per hour, 15 minutes is $0.015. The page and the docs disagree by rounding or by rate; a real run's `totalCostUsd` settles it. Not resolved.
- Timeout choices: 5 m, 15 m, 30 m, 1 h, 4 h. Location: United States, with a selector.
- A profile selector (set to none), and toggles for Record session, Allow resizing, Fixed viewport and Custom proxy. The custom proxy toggle is shown on a tier 1 account; the API reference read earlier marks `customProxy` as enterprise only. Not resolved: try it on create and record the answer.
- Its Python sample: `from browser_use_sdk.v4 import AsyncBrowserUse`, `client.browsers.create(proxy_country_code="us", timeout=15)`, prints `cdp_url` and `live_url`, and stops in a `finally` with `client.browsers.stop(browser.id)`, with the comment "Billing runs until the browser stops or its timeout expires."
