# Secondary UI: preserve screens and connect their existing actions

Owner: Ben. Recipient: Nate. Agent: Codex. Updated: 2026-11-15.
Inspected base: origin/main `5558541c`, with capture/valuation updates rechecked through `587c7981`.

## Direction

[Ben's latest instruction](../../../../product/words.md#2026-11-15--ben-preserve-ui-and-hand-wiring-findings-to-nate):

> dont completely overhaul ui and remove things just send packets to nate about it all

The preceding request was to make the UI work with real data and functionality already in the repository. Preserve the existing screens, controls and intended interactions. The replacement live screens and disabled-control work attempted during this audit were withdrawn before publication. The findings below are a handoff, not authorization to remove features.

The main Today, Sell, Buy and You compositions and New chooser remain protected. The secondary layout changes only group related fields/actions, wrap clipped permission labels, and align import rows. They do not change handlers, options, routes or persistence.

## Messages and buying: real data gaps

| Surface | Observed code path | Existing connection and next action |
|---|---|---|
| Inbox → conversation | `app/src/app/messages/[id].tsx` selects `world('clearing')` for ordinary navigation. Actual inbox IDs can therefore appear missing. Replies and offer actions in that screen are local simulations. | `GET /v1/conversations/:id/messages` provides paginated history. POST to the same path accepts `{text}` and returns a **job**, not proof of delivery. Connect the existing conversation UI to history and job outcomes. Keep the draft on failure. `edge/api/conversations.ts` still reports missing live transport; do not label a queued job Sent. |
| Matched listing | `app/src/app/listing/[id].tsx` reads matches but Watch, offer, Bought and size-feedback paths simulate completion. Its fallback also includes demo search rows. | `POST /v1/matches/:id/act` supports `save`, `dismiss`, `not_same`, `bought`. No unsave contract was found; dismissal is not an equivalent. No general offer-send endpoint was found. Preserve the UI while defining these missing contracts. Open-on-site is already connected. |
| New: typed/link Sell | The chooser retains its original entry fields and actions. The existing completion path still opens a fixed demo draft ID. | Connect text/link entry to creation/import of an owned item, then navigate to that returned ID. Do not remove its input controls or replace the entry with camera capture. |
| Search | `app/src/app/search.tsx` uses fixture `searchFor()` for normal queries. | The existing `/shop` implementation already uses actual search, assist and SSE results. Reuse its data mechanism in the existing search UI; do not substitute static marketplace results. |
| Worth | `app/src/app/worth.tsx` falls back to a fixture product when an actual item lacks valuation. Keep/look-deeper flows are local. | `POST /v1/valuations` has an actual owned-item path; latest main now composes its store-backed observation port. Connect the returned job and q10/q90 evidence to the existing Worth UI. This audit did not run a production valuation. URL/capture variants still go through the legacy example handler in the inspected source. Never substitute a fixture appraisal for missing evidence. |
| Product history | `app/src/app/product/[id].tsx` reads the global demo catalog; Follow is local. | Catalog/history routes remain example handlers; follow creation validates an example product. Build the missing product projection and follow contract, then connect the existing screen. |
| Gone-by | Room choices/deadlines are local; a timeout advances to a posting-success state. | Versioned item strategy and limits APIs exist, including `gone_by`, floor and fallback. Bulk room publication is not implemented; item listings/sell routes are still example handlers. Preserve the existing plan UI and connect supported persistence separately from actual publication. |

## Acceptance for Nate's integration

Use a non-demo account and non-demo IDs from the normal entry point. Verify reload/reopen persistence and actual response semantics. Include failed, stale-version and queued-job states. Assert that a fixture is never substituted for missing account data, and that a successful local animation cannot stand in for delivery, publication or payment.

These findings were read from actual route implementations. Controlled browser tests demonstrated the earlier selling and capture wiring; they do not demonstrate marketplace message transport or publication. No paid provider call, marketplace message, listing publication or transfer was made during this audit.

## Large headings and density correction

Owner: Ben

Ben's latest [heading and spacing correction](../../../../product/words.md#2026-11-15-large-app-headings-and-breathing-room) supersedes the app wordmark-only interpretation. App heading role (36) uses Clofie SemiBold 600, lowercase; wordmark stays Clofie 600. Text roles and prices stay PP Neue Montreal 500. Do not restore the wordmark-only app restriction from an older packet or brand file.

Scoped visual changes preserve existing handlers and controls: wrapped permissions rows use 16pt vertical padding and 4pt text gaps; live Want uses separate sections for Size, Fit, Color and Dimensions. Review, price, preview and sale retain their existing section layout. Typography consistency is checked against the corrected font assignment, not the superseded wordmark-only assignment.

Remaining density finding for Nate, not implemented: secondary search result cards inherit a fixed 104pt card and 72pt text column, leaving only 4pt total between verdict, title and detail; titles truncate at one line. Proposed correction: a content-driven secondary result-list variant with 4pt text gaps and up to two title lines. Preserve the compact main-tab variant and every result action. Render against current real response data before adopting. This is a layout proposal, not evidence of backend wiring or authorization for a broader UI replacement.
