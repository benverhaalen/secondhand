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

## The agent-run surface (V4 runs) for the site harness

Added 2026-11-15 by a Nate subagent seat (Opus 5.5). Every page below was read in full past the shared "Agent Instructions" block on 2026-11-15; URLs are under `https://docs.browser-use.com/cloud/`. The one API call is in [runs/bu-agent-runs.md](runs/bu-agent-runs.md).

**Question.** Nate: "Theres some way to browser use cloud you aren't considering." Can a Browser Use agent run (the cloud's own model drives the browser) serve a harness read verb next to our fixed-parser lane, and on what terms?

**Draft from memory, before reading.** A run is a paid model loop on a cloud browser; structured output exists; "rerunnable scripts" replay without a model; captcha solving can be switched off per run; webhooks report completion.

**What changed.** Three of the five drafts were wrong. Scripts do **not** replay without a model. Captcha solving **cannot** be switched off for a run. Webhooks do **not** cover V4 runs. Structured output and the run as a paid model loop held.

### What a run is and what it costs

- `POST /api/v4/runs {task, ...}` starts a run. Each run implicitly creates a **session** (the conversation plus its live browser) and a **workspace** (its files), unless you pass `sessionId` / `workspaceId` (observed, agent/quickstart.md). Status runs `queued, dispatching, running, completed, failed, cancelled` (observed, the RunSummary schema in openapi/v4.json).
- The run object carries `totalInputTokens`, `totalOutputTokens` and `totalCostUsd`. It has **no step count**; steps come from counting the model-call and tool events in `GET /runs/{id}/events` (observed, RunSummary; agent/observability.md).
- `totalCostUsd` is LLM plus search only. Browser time ($0.06/h, billed by the minute) and proxy traffic ($5/GB managed residential, $0.20/GB direct) are on `GET /sessions/{id}/cost`. That returns `llmCostUsd, searchCostUsd, browserCostUsd, proxyCostUsd, proxyUsedMb, totalCostUsd` as six-decimal strings. LLM charges settle up to about 90 s after the run (observed, guides/billing.md).
- The browser stays up and billed about 2 min after the last run activity, or for `keepAlive` seconds (120-14400) (observed, guides/billing.md, agent/sessions.md).
- `bu-ultrafast` is Browser Use Pi in ultrafast mode on GPT-6 Luna: low reasoning, OpenAI priority tier, billed at 2x Standard. `bu-fast` is medium reasoning on the standard tier (observed, agent/ultrafast.md).
  - The vendor quotes about $0.006 per median ultrafast task (asserted, browser-use.com/pricing, read 2026-11-14 above).
  - Presets reject `modelParams`, `mode` and `harness:"browsercode"` with a 422. The preset sticks to the session (observed, agent/ultrafast.md).
  - **New ultrafast and fast sessions run without the managed proxy unless `browserSettings.proxyCountryCode` is set**, e.g. `"us"` (observed, agent/ultrafast.md). Inferred: for eBay, which refuses datacenter traffic ([ebay-when-it-serves](runs/ebay-when-it-serves.md)), the code must be set explicitly.
- Cost caps:
  - `maxCostUsd` on the run caps model and search charges only. New API sessions default to $25 (observed, RunCreateRequest).
  - `PATCH /sessions/{id}/cost-cap {maxCostUsd}` replaces a session's budget without resetting spend (observed, api-v4/sessions/update-session-cost-cap.md).
  - A per-key monthly cap is a soft limit that returns HTTP 402 `api_key_monthly_spend_limit_reached` (observed, guides/billing.md).
  - Inferred: no cap bounds browser minutes. `keepAlive` and deleting the session are the only levers.
- Vendor comparison: V4 solves 76% of hard tasks against V3 67% and V2 54%. A typical task costs $1.64 and takes about 5 min (asserted, choosing-an-agent.md; measured July 2026 on Opus 4.7, not the Luna default). Inferred: that is the general agent. Ultrafast is the only preset in our price range.

### Structured output

- Send `outputSchema` (JSON Schema 2020-12). It comes back as `run.output` (parsed) and `run.result` (text) (observed, agent/structured-output.md).
- If no answer matches, the run **fails** with "Could not produce output matching outputSchema" (observed, agent/structured-output.md).
- Works with API-key runs only. Limits: 64 KiB, 64 nesting levels, about 4,000 values, internal `$ref` only (observed, agent/structured-output.md).
- Inferred: the schema checks shape, not truth. A matching row can still be invented, so the harness needs its own exactness check (below).

### Rerunnable scripts

- The agent writes code into the workspace (for example `scripts/extract.py`). A later run passes `workspaceId` with no `sessionId`, so it gets a new conversation and a new browser, and the task tells the agent to run the script and repair it if it broke (observed, agent/scripts.md).
- "Each later run starts an agent again"; "every later run still starts a model and uses tokens" (observed, agent/scripts.md). **There is no model-free replay.**
- No speed or price is quoted: "Compare the cost and duration ... before making a savings claim" (observed, agent/scripts.md). The docs example uses `gpt-5.6-luna` at xhigh, not a preset.
- A page change triggers the agent's own repair in that run. Nothing reports it as a distinct event (observed, agent/scripts.md; inferred from the event list in agent/observability.md).
- Inferred: a script could be downloaded through `GET /workspaces/{id}/files` and run by us without a model. It is written for the agent's runtime (Python, its browser tools), so it is a draft for one of our recipes, not a recipe.

### Warm sessions

- Pass `sessionId` to continue, and back-to-back runs reuse one live browser (`browser.reattached` event) (observed, agent/sessions.md, agent/observability.md).
- A busy session returns 409. `POST /sessions/{id}/queue {text, interrupt}` holds up to 20 pending messages, and the queued message's `runId` is null until dispatch. `interrupt:true` cancels the active run (observed, agent/sessions.md, api-v4/sessions/queue-session-message.md).
- `DELETE /sessions/{id}` returns 204, cancels the run and the queue, and keeps the billing records (observed, agent/sessions.md).
- Time-to-answer for a warm follow-up: not measured (see the run note).

### Profiles, network capture, human in the loop

- Profiles:
  - `browserSettings.profileId` attaches a stored profile. A follow-up within about 2 min (or `keepAlive`) reuses the live browser; otherwise a fresh browser loads the same profile (observed, guides/authentication.md).
  - One profile per end user. A reused session may keep its current browser, so a newly synced profile needs a fresh browser or conversation (observed, guides/profile-sync.md).
- Network capture is not a download.
  - You find the agent's browser through `data.browser_session_id` on `browser.ready` / `browser.reattached`, or `GET /api/v4/browsers?agentSessionId=`. You read its `cdpUrl` from `GET /api/v4/browsers/{id}` and attach your own CDP `Network.enable` (observed, agent/network-capture.md).
  - It captures only after the attach and misses startup traffic. It is not HAR, and bodies need `Network.getResponseBody`. Run events describe agent activity, not HTTP (observed, agent/network-capture.md).
- Human in the loop:
  - `live_view_url` arrives on `browser.ready`. Set `keepAlive` (e.g. 900). The run ends at the checkpoint, the person acts in the live view, and a follow-up run with the same `sessionId` continues on the same page (observed, agent/human-in-the-loop.md).
  - There is no "human finished" event (observed, the same page; matches the earlier section).

### Captcha handling: cannot be turned off for a run

- "Cloud browsers also solve CAPTCHAs automatically" (asserted, browser/stealth.md). Automatic solving is on by default for V4 agent runs and standalone browsers (observed, browser/captcha-handling.md).
- `"solveCaptchas": false` exists on `POST /api/v4/browsers` only. "This standalone-browser field is not currently part of V4 run `browserSettings`" (observed, browser/captcha-handling.md line 9-10).
- **Observed by a call:** `POST /api/v4/runs` with `browserSettings.solveCaptchas:false` returns **422** `extra_forbidden` at `body.browserSettings.solveCaptchas`, and no run starts ([run note](runs/bu-agent-runs.md)).
- Inferred: our `blocked` rule ("no retry, no solving", protocol.ts `pause_session`) cannot be enforced inside an agent run. A prompt telling the agent to stop on a challenge does not reach a solver that runs in the browser layer.

### Limits and webhooks

- Concurrency follows spend tiers: 10 / 50 / 250 / 500 / 1000 browsers at $0 / $100 / $1k / $5k / $25k paid. This project reads `concurrentSessionLimit: 50` (observed, guides/concurrency.md; billing account call).
- Idle kept-alive browsers are billed but take no concurrency slot (observed, the shared block).
- Request rate: max(25, 2x concurrency) RPS per project, capped at 100 for general traffic, in 5-second windows. Status reads are uncapped. The edge limit is 1000 RPS per IP over 300 s (observed, the shared block, guides/concurrency.md).
- A client wait timeout does not cancel a run (observed, the shared block).
- Webhooks cover V2 `agent.task.status_update` and V3 `session.status.update` only. The signature is HMAC-SHA256 over a Python-canonical JSON, not the raw body, and JS `JSON.stringify` does not match it (observed, guides/webhooks.md).
  - **V4 runs have no webhook.** The page points V4 users to polling and events (observed, guides/webhooks.md), and the V4 OpenAPI has no webhook path (observed, openapi/v4.json).

### The shopping benchmark, read against our rule (no solving, a challenge pauses for the person)

Nate pointed at Browser Use's shopping benchmark as the way round. Sources, all read 2026-11-15:
- https://browser-use.com/benchmarks/consumer-2026-11/methodology.txt, `dataset.json`, `results.json` (November);
- https://browser-use.com/benchmarks/consumer-v10/methodology.txt and `results.json` (October);
- https://browser-use.com/benchmarks/consumer.md and https://browser-use.com/benchmarks/consumer/sites/ebay.md;
- https://browser-use.com/stealth-browsers.md.

**Draft, before reading:** the benchmark's Cloud row is agent runs with solving on, so it says little about solving off, and somewhere it shows an eBay read passing.
**What changed:** the first half held. The second did not: neither set has an eBay information task. The way round the benchmark points to is the **raw stealth browser with the solver off**, plus a line saying solving is off in the EU region.

**1. What the Cloud row ran with.**
- November: 500 frozen tasks (367 cart, 133 public-information), run Nov 7-11, 2026, one attempt each, 900 s per task. Cloud scored 479/500 on "model grades with review corrections" (observed, Nov methodology.txt). "The instructions required each provider to follow its verification-control policy" (observed, same). The run id is `daily-v4-consumer500-2026-11-07-150153Z` (observed, Nov results.json). Inferred from the id: V4 agent runs.
- Per-task November outcomes hold only `{provider, success}`. There is no captcha field and no failure reason (observed, Nov results.json).
- The model, proxy and profile for the Cloud row are not stated in what we read.
- October: the Cloud captcha totals were 54 met, 47 cleared, 7 not cleared, 4 unknown. Their source is "Original execution reports" (observed, v10 results.json `runs[browser-use].captcha`). The October methodology says "A cleared challenge includes automatic clearance" (observed).
- Inferred: the Cloud row ran with the solver on, so its overall score does not hold for solving off.
- The per-task reports narrow that. For every marketplace task, the October Cloud report says captcha `none`, except ebay.com, which says `unknown` (observed, v10 results.json). Inferred: on those sites the solver was not what decided the outcome. The reports are the agent's own, not telemetry ("not independently complete CAPTCHA telemetry" is said of the Dot runner, observed).

**2. What the On-Prem Browser is.**
- "On-prem available. Same browsers, your infrastructure. Gumloop runs on-prem browsers. Talk to sales" (observed, stealth-browsers.md). "Our proprietary browser runs in your infrastructure or sandboxes. Your team controls deployment, network access and data policies" (observed, consumer.md).
- You get it through enterprise sales only. No price, OS or hardware requirement, or self-serve download is published on the pages read (observed by absence on those pages; this does not show that none exists).
- The benchmark ran build "On-prem 0.5.1-socks5.1, staging, SOCKS5 proxy, openai/gpt-6-luna (reasoning high), Oct 26, 2026" and scored 445/500 (observed, v10 results.json). Its captcha totals were 66 met and 56 cleared, so automatic clearance counted there too (observed).
- **M4 Max on a home connection:** unknown from their pages. "macOS ... profiles" on the stealth page are fingerprints, not a host OS (observed wording). Inferred: a home IP is the residential traffic they sell, so the network side would suit us. Whether the build runs on macOS/arm64 is a question for sales, and it means a contract. *Agent proposal:* do not pursue this before the raw-browser trial below.

**3. Did an eBay information task pass?** No such task exists.
- November ebay.com (`consumer-0024`) is a cart task: "Search the public storefront for USB-C cable ... Add one unit to the cart ... Stop after cart verification" (observed, Nov dataset.json). It passed on Cloud in November and failed in October with captcha `unknown`.
- October Cloud on the other eBay sites: co.uk, de, ie and be passed; it, ca, es and pl failed, all with captcha `none`. On-Prem passed everything except es and pl (observed, v10 results.json; sites/ebay.md).
- The one marketplace information task is grailed.com (`consumer-0641`: "Search for T-shirt. Open one available matching product and read its public title, price, and product details. Stop before login or any purchase action"). It passed on Cloud in both months with captcha `none` (observed). Mercari (`consumer-0368`, cart) passed with `none`. There is no Poshmark, Depop or Facebook task.
- **Not run:** the brief allowed running the eBay task as written only if it is an information task. It is a cart add, which changes site state, and a V4 run cannot turn its solver off (422 above).
- Our 81 eBay results from a Cloud browser today are consistent with this (inferred), not proved by it.

**4. Why stock Chromium fails, in their words.**
- "Stock Chromium ran with no proxy and no automatic CAPTCHA solving." It scored 25/500 against On-Prem's 445/500. "Network and browser settings differ" (observed, consumer.md).
- "It does not establish browser-only causality or confirmed block rates" (observed, Nov methodology.txt). "Task completion does not isolate infrastructure stealth" (observed, v10 methodology.txt). They do not claim to know why it fails.
- The stealth page gives the reason they assert: "Our own Chromium fork, patched in C++, rather than detection fixes patched on from the outside" (asserted). Its numbers: on "100 sites, picked where Chrome + home IP failed", Headless Chrome got through 3%, Chrome + home IP 14%, and **"Browser Use, CAPTCHA solver off" 84%** (asserted, no per-site data shown).

**What this gives the harness.**
- The configuration that fits our rule is the one the stealth page measures: `POST /api/v4/browsers` with `"solveCaptchas": false` (observed, browser/captcha-handling.md), driven over CDP by our own page lane, with our parser and our `blocked` → `pause_session` mapping. That is the standalone-browser section at the top of this note, so nothing new needs building to try it.
- The vendor's 84% is on sites chosen because they block, not on ours (asserted).
- The stealth page also says of automatic solving: "Off in the EU region" (asserted, stealth-browsers.md Specs). If that holds, **V4 agent runs on the EU API (`api.eu.browser-use.com`) would run with no solver**, which removes the policy objection to the `agent` route below.
- Inferred: the EU route needs a separate EU key, which this environment does not have (checked by name only). The proving test is one EU run that meets a known challenge and stops without clearing it.

### Agent proposal: an `agent` route kind

*Agent proposal*, not decided. It rests on the docs above and on our lane's numbers: Depop 1.8 s by plain request, Poshmark about 2.5 s and Mercari 5-6 s by cloud browser, eBay under 10 s cold. The paid trials did not run (see the run note), so every speed and cost figure for agent runs here is the vendor's or inferred.

- **Where it beats the fixed-parser lane** (inferred):
  - A read verb on a site or page with no recipe yet, or one whose recipe returned `page_changed`. The agent reads the page as it is now, where our parser fails closed.
  - First drafts of recipes. A run's events and its workspace script show the path the agent took.
- **Where it loses** (inferred):
  - Speed: a model loop takes seconds per step, against one request or one page load.
  - Cost: about $0.006 model cost per ultrafast task plus browser minutes and proxy, against about $0.0001 of browser time for our page read.
  - Determinism and exactness: the schema checks shape, not values.
  - Policy: the captcha solver cannot be turned off, which breaks our `blocked` rule.
  - Writes: never. An agent may not decide a write.
- **Scripts as recipes:** no as a runtime, because every rerun starts a model. Yes as an authoring source: download the workspace script and translate it into a manifest plus parser that our lane runs and tests (inferred).
- **The route's shape** (inferred), within `route_kind: 'endpoint' | 'page'` (protocol.ts line 67), adding `'agent'`:
  - Reads only. The same `Envelope` and `Meta`, with `adapter_version` set to the model preset and the schema hash.
  - Request: `model: "bu-ultrafast"`, `outputSchema` = the verb's canon rows plus `blocked?: string`, `maxCostUsd` per call, `keepAlive: 120`, `proxyCountryCode` set per site, and `DELETE /sessions/{id}` after the read.
  - Error mapping:
    - a `blocked` field filled, or a sign-in wall → `blocked` / `pause_session`, or `auth_expired` / `relink` when signed in;
    - the schema-failure error → `page_changed` / `author`;
    - zero rows with no `blocked` → `not_found`;
    - 429 → `rate_limited`, with `retry_after` from the rate headers;
    - 402 or `maxCostUsd` reached → `policy_refused` / `raise_decision` (`kind: "agent_spend"`);
    - no run within the deadline → `no_route` / `handoff`. `outcome_unknown` never applies, since the route is reads only.
  - Exactness check before a row is trusted: attach our own CDP observer (network-capture.md), or re-fetch the result page by our lane, and confirm that each row's `url` resolves and that its title and price appear verbatim. A row that fails is dropped, and the share of dropped rows is logged per call.
  - Cost ceiling: `maxCostUsd: 0.02` per call for the model share, and the session deleted on completion, keeping browser cost to the 1-minute minimum.
- **Blocking question for the lead:** the `blocked` rule says no solving, and a US V4 run solves captchas automatically. The options:
  - the route runs on the EU API, where the stealth page asserts solving is off, which needs an EU key and the one-run proof above;
  - the rule gets an agent-route exception (Ben or Nate decide);
  - the route waits for `solveCaptchas` on run `browserSettings`.

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
