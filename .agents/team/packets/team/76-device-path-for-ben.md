# 76: the device path, for Ben

Updated: November 15, 2026, morning Central. Owner: Nate. For: Ben (the screens are his). Agent: Claude Code, the third integration lead. Status: the API answers a person who is not signed in; no screen in a phone build reaches it yet.

Nate: "lets just ensure everything works not signed in ... then we'll test on device it working". The server side of that is the integration lead's; wiring a screen to it is Ben's. This packet is what the screens need, and nothing about how they look.

## What is true now

- Every screen reads in-app demo data from `@/demo` (`app/src/demo/`). Two screens fetch: `app/src/app/want.tsx` (`GET /v1/stage`, behind `?live=1`) and `app/src/app/dev/health.tsx` (`GET /v1/health`), both by a relative URL.
- A relative URL reaches the Expo dev server from a dev client on the same network, and nothing from a standalone build: `app/app.json` sets no expo-router `origin`, and nothing is hosted yet. Hosting is Nate's decision ([the brief](../../../../spec/plans/hosting.md), when it lands).

## The one config value a hosted build needs

The expo-router plugin's `origin`, set to the hosted API's address, so a relative `fetch('/v1/...')` in a native build resolves against it:

```json
"plugins": [["expo-router", { "origin": "https://<the hosted address Nate approves>" }], ...]
```

Until Nate names the host, leave it unset; a dev client keeps working against the dev server as now.

## How a screen talks to the API without a sign-in

- Send `X-Visitor-Id` on every call once the first answer has given you one (the server mints it and returns it in the same header). Keep it in the app's storage; it is not a secret.
- A search answers `202` at once with a job. Read the job until `state` is `done`, or open its event stream, and show each source as it lands (packet 70 in this folder: search streams each site as it lands).
- Errors are `{code, message, failed_step, retry}`; `retry.by: "auto"` with `after_s` means try again yourself after that many seconds (`429 rate_limited`, `503 waking` or `unavailable`). Word them per `product/copy.md`.
- The example shapes below are the contract: `spec/examples/<file>.json`, by name. A route's answer matches its example's keys; `app/src/edge/api/routes.test.ts` checks that.

## Which screen calls which route

| Screen | Route | Signed out? | Request | Answer (example) |
|---|---|---|---|---|
| `search.tsx`, `(tabs)/buy.tsx` | `POST /v1/search` | yes (visitor) | `{ text, filters? }`, header `Idempotency-Key` | `202 { id, kind: "search", state: "running", stages[], stream }` (`buy.json#search.text`) |
| the same, while it runs | `GET /v1/jobs/:id` or `GET /v1/jobs/:id/events` | yes (visitor) | header `X-Visitor-Id` from the search | the job with `stages[]` and, when done, `result` (`jobs.json#jobs.get`; the stream sends `job.stage`, `answer.partial`, `answer.settled`) |
| `product/[id].tsx` | `GET /v1/products/:id` | yes (visitor) | none | `buy.json#products.get` |
| `worth.tsx` | `POST /v1/valuations` | no: needs a signed-in person today | `{ text }` or `{ url }` or `{ item_id }` | `202`, a job (`sell.json#valuations.create`, `#valuations.appraise_url`) |
| `(tabs)/sell.tsx`, `item/[id]/*` | `GET /v1/items`, `GET /v1/items/:id` | no | none | `items.json#items.list`, `#items.get` |
| `(tabs)/index.tsx` | `GET /v1/today` | no | none | `today.json#today.get`, `#today.get.new_user` |
| `messages/*` | `GET /v1/conversations`, `GET /v1/conversations/:id` | no | none | `sell.json#conversations.list` |
| `(tabs)/you.tsx` | `GET /v1/me` | no | none | `me.json#me.get` |
| `camera.tsx`, `new.tsx` | `POST /v1/captures` | no | header `Idempotency-Key` | `201` (`captures.json#captures.open`) |
| `dev/health.tsx` | `GET /v1/health` | yes | none | as now |

For the device test Nate asked for, the first row is the path: a phone with no sign-in searches and sees sources land. The rest need a signed-in person, so they come after.

## Open

- `worth.tsx` for a person who is not signed in: `POST /v1/valuations` asks for a sign-in today. Whether a visitor may price a thing is a product choice; it goes to Nate (*agent proposal*: allow it for `{ text }` and `{ url }`, under the visitor limit).
