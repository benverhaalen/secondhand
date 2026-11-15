# Browser Use V4 agent runs: what ran and what was held back

Run by a Nate subagent seat (Opus 5.5) on 2026-11-15, for the agent-run section of [browser-use-cloud.md](../browser-use-cloud.md#the-agent-run-surface-v4-runs-for-the-site-harness). Every line is *observed* in these calls unless marked. The key was checked by presence only and sent only in the `X-Browser-Use-API-Key` header. No CDP or live-view URL was printed or kept. The scripts are in the seat's scratchpad, not the repo.

## What ran

| # | Call | Answer | Cost |
|---|---|---|---|
| 0 | `GET https://api.browser-use.com/api/v2/billing/account` (before) | `totalCreditsBalanceUsd` 99.0170443808, monthly 0, additional 99.0170443808, `concurrentSessionLimit` 50, `activeSessionCount` 0 | none |
| 1 | `POST https://api.browser-use.com/api/v4/runs` with the body below | **422**, `extra_forbidden` at `body.browserSettings.solveCaptchas`; no run id, no session | none |
| 2 | the same billing read (after) | `totalCreditsBalanceUsd` 99.0140443808, `activeSessionCount` 1 | see below |

```json
{"task":"Reply OK. Do not open any website.","model":"bu-ultrafast","maxCostUsd":0.02,"browserSettings":{"solveCaptchas":false}}
```

**The billing difference** is $0.0030, with one active session at the second read. Call 1 created nothing (it returned 422 with no id). Inferred: the spend and the session belong to another actor on the same key, such as the eBay page lane's cloud-browser recon. This seat did not attribute it further.

## What did not run, and why

The brief requires captcha solving off in every run. A V4 run rejects `solveCaptchas` (call 1), and the docs say the field "is not currently part of V4 run `browserSettings`" (browser/captcha-handling.md). Running a trial without the field would mean running with the solver on. So trials a to f were held back for the lead to decide, along with the benchmark's eBay task. That task is a cart add in any case (see the research note).

| Trial | Planned | Held back because |
|---|---|---|
| a | eBay "levis 501 jeans 32x32", `bu-ultrafast` | solver cannot be off |
| b | the same, `bu-fast` | solver cannot be off |
| c | follow-up "nike air force 1 07 white mens 10" on a's `sessionId` | depends on a |
| d | the run's workspace script rerun for a third query | depends on a |
| e | Mercari "carhartt hoodie" | solver cannot be off |
| f | eBay sold listings, signed out | solver cannot be off |
| bench | consumer-0024 ebay.com as written | a cart add changes site state; solver cannot be off |

## Bodies for when the lead decides

These bodies are inferred from the V4 OpenAPI and have not been sent. On the US API, each one runs with the solver on. On the EU API, the stealth page asserts solving is off; that needs an EU key, which this environment does not have.

The schema goes in `outputSchema`:

```json
{"type":"object","properties":{"rows":{"type":"array","items":{"type":"object","properties":{"title":{"type":"string"},"price_cents":{"type":"integer"},"currency":{"type":"string"},"url":{"type":"string"},"condition":{"type":"string"},"sold":{"type":"boolean"}},"required":["title","price_cents","currency","url"]}},"blocked":{"type":"string"}},"required":["rows"]}
```

Trial a:

```json
{"task":"Open https://www.ebay.com/sch/i.html?_nkw=levis+501+jeans+32x32 . Read the first 10 listings: title, price in cents, currency, listing URL, condition if shown. Do not sign in, click buy, or change anything. If a CAPTCHA, challenge or sign-in wall appears, stop at once and put what you saw in `blocked`.","model":"bu-ultrafast","maxCostUsd":0.05,"outputSchema":"<schema above>"}
```

- b is a with `"model":"bu-fast"`.
- c is a's `sessionId` with the Nike query.
- e is `https://www.mercari.com/search/?keyword=carhartt+hoodie`.
- f is a with `&LH_Sold=1&LH_Complete=1` and `sold` filled in.
- The spot-check is three titles and prices from a and e, compared against a plain page read.
