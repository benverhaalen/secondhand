# 91: Ben’s live UI, data coverage, and exact listing handoffs

2026-11-15. Branch: feat/real-onboarding. Includes main through 8f878066 and packet 70's second engines handoff. Do not copy files across branches; merge.

Ben’s current direction: preserve the previous app’s look. Keep native cards, typography, photos, pills, rails and sheets. Add already-gathered fields when simple; limit unsupported features. Exact listing redirects into marketplace apps (Safari fallback) are preferred to pretending an action happened. Validate on Ben’s physical iPhone, not only web.

## Integrated here

- Real email onboarding client, owned session and account settings, SecureStore on native, HttpOnly web refresh sessions. Email sender requires RESEND_API_KEY and SECONDHAND_EMAIL_FROM; neither is configured on this Mac. No production development-code bypass.
- Default tabs read owned API data. Explicit world/state previews remain separate. Main Home cards now open known exact HTTPS listing URLs, or a platform-selection/review sheet; opening a listing does not answer its decision. Live item detail reads owned items instead of fixture lookup and uses the existing visual components with SiteLink.
- Hosted profile connection API and UI, owner-scoped connection handles. BROWSER_USE_API_KEY remains unconfigured here. Facebook has no profile connector. Depop/Poshmark/Mercari reads can use linked profiles. eBay private API readers still need their authenticated API client.
- Depop archive preview/import supports cursor pagination and preserves available descriptions/photos/attributes. Poshmark and Mercari import need their username/seller identifier arguments; do not claim those work merely because their read adapters exist.
- Dashboard five snapping slides/dots, Home snapping rails, platform-grouped Messages, pull-to-refresh and full top wash. Home cards use consistent plain surfaces.
- Search normalization preserves existing parser image/brand/engagement/shipping/format fields rather than dropping them. The data mapper preserves compatible valuations, product identity, costs, limits, description, imported listing-state aliases and counterpart names.

## Blocking contracts found by tracing current code

1. Inbox readers return metadata, not message bodies/history. Full marketplace chat cannot be claimed from these rows.
2. Signed-in Depop/Poshmark/Mercari offers/orders/inbox/stats remain largely fixture-proven; README endpoint guesses are not live proof. eBay private reader composition is still absent. Facebook is an uncomposed search-only lane here.
3. Own-listing reads omit important listing attributes. Depop has photos/descriptions but misses size/condition/category/colour. Poshmark/Mercari/eBay archive rows lack complete description/gallery. Pagination is incomplete outside Depop.
4. Marketplace write adapters remain dry plans/handoffs. The decision act route can mark unmapped kinds answered with no operation; mapped events omit execution context. Live Home now uses site handoffs instead of calling that route. Other consumers must not treat receipt of acting/answered as marketplace success.
5. Offer expiry in several adapters is computed from created time plus a platform rule. Snapshot normalization drops it; raised decisions generally lack deadlines. Live Home does not invent a countdown. Exact, observed deadlines and estimated deadlines need separate provenance before rendering.
6. sold.ts uses listed_at when sold_at is missing, labelling listing time as sale time. Valuation observation time inherits comp.sold_at. These are distinct clocks and need correction in the engine-owned files.
7. read_stats is not collected into historical analytics. GET /v1/insights still uses the example snapshot. Do not serve those figures as this person's results.
8. Packet 70's owned-item valuation route is merged. Observation persistence is explicitly uncomposed, results finish a job rather than updating the item, and appraisal history /v1/lookups has no route. Preserve returned values when present, but do not claim this lifecycle complete.
9. Unknown-fee orders are dropped by the current frontend Order projection. Keep the sale and show Net pending once nullable amounts are carried across the UI, rather than inserting zero fees. Current broad numeric Order consumers need a coordinated change.
10. Wants persist, but recurring runWant execution is not composed in the runtime. Saved criteria do not establish active monitoring or notifications.

## Corrections to older handoffs

The old blanket “no signed-in client composed” is stale: withProfileRead now provides owner-profile read transports for several sites. Separate standalone Mercari/Poshmark sold reads are documented in run notes; this is not integrated valuation or account-read proof. Core account/job storage is SQLite, not merely in-memory.

Existing checks: 152/152 selected adapter/page fixture checks and 50/50 public search checks passed; typecheck passes. No new fixture tests were added for these UI changes. Full real-account proof remains blocked by sender/hosted-service configuration. Native validation status will be appended after installation; the earlier installed app was actually driven and captured on Ben’s iPhone.

Ben clarified that Nate’s server is starting and data is still arriving. Empty results are not capability failures. Recheck server readiness/first sync and latest packets before removing a feature. The structural gaps above come from traced code paths, not merely an empty response. Keep unsupported detail as unavailable pending backend integration; use exact listing links for working marketplace actions.

Buy keeps Nate’s ShopView/useShop flow and adds a Shopping chat entry. Onboarding uses the real email/session/services path plus Nate’s First photo step and an optional Shopping chat destination. The old pickup step only logged a change without saving it, so it is not represented as persisted setup. Shop listing handoffs now use native Linking (universal links/app routing, browser fallback).
