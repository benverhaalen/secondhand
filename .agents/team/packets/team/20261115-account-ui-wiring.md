# Account UI: real persistence and money data

Owner: Ben. Recipient: Nate. Agent: Codex. Updated: 2026-11-15.
Inspected base: origin/main `5558541c`, integrated at `9d6daa1e`.
Direction: [preserve the UI and hand off wiring gaps](20261115-secondary-ui-wiring.md). Existing controls stay in place; the proposed replacement/disabled-control implementations were withdrawn.

## Supported APIs not yet connected to their UI

- **Activity Undo:** `you/activity.tsx` marks Undone locally. `POST /v1/events/:id/undo` is implemented and returns `{event, undo_of}`. Await that confirmation, refresh, and retain the original state on failure. A controlled baseline test observed the Undone label with no POST request.
- **Rules and account limits:** `data/live.tsx` does not load `GET /v1/rules` or `GET /v1/limits`. Both are real handlers. Load and paginate rules; preserve absent approval history rather than inventing eligibility. The live Rules screen initializes state before asynchronous data may arrive.
- **Item floor/accept-at-once, delivery and pickup defaults:** versioned `PUT /v1/limits` accepts item limits, `handover`, and `saved_spot`. Read GET after PUT because the write response omits some account fields. Show confirmed persistence, including any displayed Undo. The existing UI only changes local state/logs.
- **Partial limits:** `data/world.ts` requires full strategy metadata to map item limits, but valid backend rows can contain floor/accept values without `plan_choice`. Preserve known pricing values without inventing strategy metadata. `ask_every_time` and `accept_mode` must be considered before describing automatic acceptance.

## Contracts that need definition or completion

- **Permissions:** local ask/never mode changes have no general persistence endpoint. `POST /v1/rules` creates automatic rules and DELETE removes them; deletion is not a general Never policy. Do not silently remap the meanings of the existing controls.
- **Other defaults:** plan, sites, pricing spread, photo processing, reply voice and units are local. The current limits schema does not store these preferences. `/v1/me/style` is a different facet model.
- **Payouts:** instant payout is a local success state with no transfer API. The money timeline estimates arrival rather than reading a payout ledger. Connect actual payout status/fees before confirming a transfer or bank arrival.
- **Records and incomplete sales:** `data/world.ts` drops an entire order when fees or shipping are null, although the orders API allows null. Preserve unknown amounts; never convert them to zero. `selling/useSales` already reads raw paginated orders without dropping them. The existing Records web CSV downloads; native currently reports Downloaded without sharing a file. Wire a native export/share result before confirming completion.
- **Per-site account view:** live Link/Unlink navigates to connection management, while `you/site.tsx` immediately shows Unlinked. Wait for actual unlink confirmation. Its link state is initialized once before account hydration. `site-audit.ts` also claims readback verification without evidence, and a missing checked timestamp becomes Checked just now.
- **Google sign-in:** the button and server exchange exist. The default token provider in `you/sign-in-wire.ts` still throws; Nate must connect the actual Google token-provider integration. Email sign-in is connected.

## Already connected

`account/settings.tsx` and session code use actual account read/update, export, delete and sign-out routes. `account/services.tsx` uses connection lifecycle endpoints. `account/archive.tsx` uses import preview, import and job endpoints. Preserve these working contracts while refining layout.

The main You tab embeds account settings and dashboard components. Avoid altering that approved composition while connecting their data. Use authenticated, non-demo fixtures for read/write/reopen tests; the old You gallery tests alone cannot prove persistence.
