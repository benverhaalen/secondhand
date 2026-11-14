# Data
Status: draft, *agent proposal* except where a line links a decision. Slug: data. Written 2026-11-14.

Decided: Apps hosts the backend, Lakebase is the app database synced to Delta, traces show as a "why?" timeline, approvals are labels, Genie answers questions over your items and sales, and a two-hour fallback moves the app and database off Databricks if Lakebase or Apps won't work ([decision](../../product/decisions.md#2026-11-14-databricks-runs-the-whole-backend-with-a-hybrid-fallback)). The same decision makes data the backbone for item-card, price, today and You > By site. This page says where each thing lives and what flows between.

## What the person does and sees

| Where | What they see | Backed by |
|---|---|---|
| Item card, "Why?" | A timeline of what was done to this item and why, newest first, each step with who did it (you, auto, the site) and an Undo where the site allows | `event` joined to the job's MLflow trace |
| Today | Anything waiting, and what was done for them | `decision`, `event` |
| You | Earned, kept, sold, by site, goal | derived from `order` and `event` ([insights](insights.md)) |
| You, "Ask" | A question box over their own items and sales ("what sold fastest?") with the rows behind the answer | Genie |
| You > Your data | What we hold, by kind, with Export and Delete account | all stores |
| Any "Always do this" card | Offered after 3 unedited approvals of the same kind | `label` ([decision](../../product/decisions.md#2026-11-14-always-accept-is-offered-at-listing-and-only-unedited-approvals-count)) |

Ben's design stumble: "Why?" is promised on every item but a person cannot yet see what we keep about them. Your data answers that, and deletion is required by Apple 5.1.1(v) ([privacy](../../research/cross-cutting/nate/privacy-and-data.md)). The backend also makes possible a personal "what sold fastest for me" answer that Ben's You tab does not use yet.

## What it reads and writes

Entity names are the frame's; fields are defined in `spec/product.md`, not here. Ben's table names (`items`, `jobs`, `sale_events`, `approvals`, `action_log`) are inputs: `action_log` becomes a query over `event` ([logging packet](../../.agents/team/packets/team/5-logging.md)).

| Store | Holds | Flows to |
|---|---|---|
| Lakebase | `user, account, item, product, capture, photo, attribute, job, valuation, strategy, listing, conversation, message, offer, order, decision, rule, limits, want, match, appointment, goal`; plus `event`, `label`, `sale_receipt` (unique `(site, external_order_id)`), `idempotency` (unique key per outward action) | Delta by Change Data Feed (`lb_<table>_history`) |
| Delta | `comp` (append-only, shared, no user id), `event` history, `label` history, MLflow trace tables, evaluation sets, rollups for Genie | Lakebase by synced tables (price range per product, so the card reads in ms) |
| Volume `raw.photos` | capture files, masks, depth | paths held on `photo` |
| AI Search | product, comp, and per-user approved-example indexes | rebuilt from Delta |

Rules: every row carries `user_id` except `comp` and `product`. An `event` is written in the same Lakebase transaction as the state change it records, so a change never lacks its line. A completed sale writes a `comp` with its true time to sell (Ben); that row holds no user id. Message text, addresses, tokens and payment details never enter `event`, only ids ([README](../README.md)).

## States

| Moves | Trigger |
|---|---|
| `job` `started, running, arrived, failed` | the worker, written with the trace id |
| `label` `proposed, in_use, retired` | eval job proposes; a developer approves a threshold; the person approves a promotion |
| Delete request `requested, running, done, failed` | the person's tap; each store reports its own stage |

Item and order states belong to their features. Data only guarantees each move has one `event`.

## Systems underneath

| Piece | Job here |
|---|---|
| Apps (FastAPI) | the only writer to Lakebase; scopes every query by `user_id` and also sets `app.user_id` per transaction for Postgres row security (*agent proposal*, because Databricks row security keys on `current_user`) |
| Lakebase | operational truth; pool lifetime about 45 minutes; token refresh in the pool |
| Lakeflow jobs | table below |
| MLflow 3 | one trace per job or message, tagged `item_id, user_id, job_id`; "why?" reads `search_traces` by tag. Keep traces experiment-backed, because `logFeedback` does not cover UC-stored traces (*observed*, Ben) |
| Unity Gateway | models; the span stores what was sent as ids, not buyer text (Open 1) |
| AI Search | self-managed embeddings, because image embeddings are not offered (*inferred*) |
| Genie | questions over rollup views (Open 2) |
| Thin edge | webhooks, upload URLs, eBay deletion notices |

| Scheduled job | Cadence | Writes |
|---|---|---|
| Order poll | eBay 60 s; browser sites 1 to 2 min | `order`, `sale_receipt`, `event` |
| Reconcile, our state vs each site | 5 min | `event`, `decision` on drift |
| Watches | per `want` schedule ([watch](watch.md)) | `match` |
| Comp refresh and rollups | hourly | `comp`, synced price ranges |
| Threshold eval | hourly | proposals only; the lowest threshold with precision of 0.98 or better (auto intents) or recall of 0.95 or better (safety checks) (Ben) |
| Retention sweep | daily | deletes by class below |

## Contract for the frontend

| Endpoint | Returns |
|---|---|
| `GET /v1/items/:id/why` | `{steps:[{at, actor, action, summary, undo_id?, trace_id?}]}`; a step with no trace says "no detail recorded" |
| `POST /v1/ask` `{question}` | `job`; result `{answer, rows[], source_ids[]}` |
| `GET /v1/me/data` | `{kinds:[{kind, count, keep_until}]}` |
| `POST /v1/me/export`, `DELETE /v1/me` | `job`; stages `requested, <store>..., done` |
| `GET /v1/jobs/:id/events` | SSE, as the frame |

## Who may act

| Action | Mode |
|---|---|
| Write events, sync, sweep, reconcile | auto, logged |
| Move a kind from Ask to Auto | the person, after 3 unedited approvals; never for the locked kinds |
| Lower an auto threshold | a developer approves; the system only proposes |
| Use a person's labels to train anything shared | never without their opt-in (Open 3) |
| Delete account, export | the person |

## How it fails

| Failure | Person sees | Recovery |
|---|---|---|
| Lakebase waking from zero | nothing, or a retry within a second | pool reconnect; app keeps its last card |
| Lakebase or Apps unusable in 2 hours of setup | nothing | fallback per the decision; comps, traces, eval, Genie stay on Databricks |
| Sync lag | nothing: money and states read Lakebase, never Delta | alert when lag passes a set time |
| Trace not stored | "no detail recorded" on that step | never filled in by a guess |
| Capture upload fails | capture stays on the phone with a Retry | resumable upload; local copy removed on arrival |
| Delete fails in one store | which kind is still pending | job retries; each store is its own stage |
| Genie slow or wrong | "Couldn't answer that" | polling stops after about 10 minutes; rows always shown |

## How we will know it works

| Claim | Check on real data |
|---|---|
| Users cannot see each other | two real users, every `/v1` route and Genie: zero cross reads; row security on too |
| Every change has an event | `node spec/log.mjs` on a real run: zero state changes without a line |
| "Why?" is complete | for every `auto` action in a week of logs, the endpoint returns a step; share with a trace |
| Reconcile works | plant a drift on a test account; found within 5 minutes |
| Deletion is whole | after `DELETE /v1/me`, a scan by user id finds zero rows in Lakebase, Delta, traces, volumes and indexes |
| Thresholds hold | replay held-out real taps: precision at the chosen threshold; synthetic starting sets are labelled synthetic and not reported as results |
| Sync is quick enough | p95 Lakebase to Delta and back, measured (test 5 below) |

## Facts that constrain it

| Fact | Mark | Source |
|---|---|---|
| Lakebase: scale to zero loses pools and LISTEN/NOTIFY; OAuth tokens last 1 hour | observed | [platform](../../research/data/nate/databricks-platform.md) |
| Row security keys on a Databricks identity; a phone user has none | inferred | same |
| Autoscaling ceiling is 112 CU on one page, 64 CU on another | observed, unresolved | same |
| Apps: no public mode; request, SSE and websocket limits not documented | observed, asserted | same |
| MLflow: no per-trace delete by API; 25 MB read limit; 100,000 traces per experiment | observed | same |
| Files API has no presigned URLs found | inferred | same |
| Free Edition is non-commercial | observed | same |
| Does MLflow store prompt text by default | not found | [privacy](../../research/cross-cutting/nate/privacy-and-data.md) |
| eBay: delete personal data promptly, honour deletion notices, no training on eBay content | observed | same |
| Apple 5.1.2(i): ask before sharing personal data with third-party AI | observed | same |
| Ben's tables, thresholds and cadences | asserted | [Ben](../../research/data/ben/databricks.md) |

Test on the real workspace first (all inferred): phone to Apps auth and webhooks; request, SSE and websocket timeouts at 60, 150 and 300 s; whether it is Free Edition; Lakebase wake time under real pools; sync and Change Data Feed latency; one service principal plus app-level user ids against row security; signed upload or proxy upload; trace volume against 200 per second and 25 MB; the minimum Lakeflow trigger interval for a 60 s poll.

## Demo path
For Ben and Nate to mark.

## Open for Ben and Nate

1. Message text in traces. Ben: message text stays in traces for the "why?" panel, ids only in logs (*agent proposal*). Nate: deletion must reach traces, and traces cannot be deleted by API ([privacy](../../research/cross-cutting/nate/privacy-and-data.md)). Recommend: spans hold message ids, "why?" reads the text from the thread while it exists; fixed trace window. Depends on: "why?" on a deleted thread, deletion.
2. Genie for people with no Databricks identity. Options: map each user to a principal by token exchange (no consumer pattern documented), or Genie over rollups the API filters by user. Recommend testing both; until one passes, `/v1/ask` is off, not shared across users. Depends on: Ask on You.
3. Whose labels train what. Recommend: approvals tune that person's own tiers and personal retrieval only; shared training needs an opt-in; eBay content never trains. Depends on: tier learning, shared models.
4. Business: a paid workspace (Free Edition is non-commercial) and paid data (PriceCharting purges on cancel) change cost. Say, not picked.
5. Capture tension: one session where the item picks the mode versus the guided shot list first. Data stores `capture.mode` either way, so it does not decide this.

## Needs from the shared model
- `label` and `approval` entities, with kinds kept apart (owner statement, observed evidence, verified correction, specialist judgement, training permission).
- `user_id`, `trace_id`, `operation_id` on every row and `retention_class` on every entity.
- `delete_user` and `export_user` as job kinds.
- `event` written in the state change's transaction, with `comp` and `product` as the only tables without a user.
