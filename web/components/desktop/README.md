# Signed-in desktop workspace

`/app` uses the same bearer session and `/v1` resources as the mobile application. Today reads open decisions; Sell reads the user's items; Buy searches marketplaces and manages wants; You manages marketplace connections. Settings are in the rail. Every mutation stays on the authenticated API, and marketplace decisions keep their signed option and version checks.

The browser follows `/v1/stream`, refreshes on focus, and reads visible resources every 15 seconds because not every server mutation currently emits a user stream event. Search jobs retain their identifier in the URL so reloading reattaches to the same search. All external listing links use the server-provided HTTP(S) URL.

## Current server boundaries

The UI does not simulate posting. At the original integration baseline, `POST /v1/items/:id/sell` and `POST /v1/items/:id/listings` were restricted example handlers. Capture upload accepted real image bytes, but finish returned a copied example job and created an item with no photo references. Those require genuine backend wiring before upload-to-approved-publication can be demonstrated. Item edits, watch management, signed decisions, live search, settings, connection-service availability, and message submission use existing engine handlers. Message submission means queued, not delivered.

## Design

The rail replaces the phone's tab pill; routes preserve Back and refresh. The app's Hugeicons, paired-tag mark, Clofie wordmark, PP Neue Montreal body, gradient wash and theme tokens are shared. Photos lead the inventory; decisions group by urgency; dialogs constrain secondary tasks without losing context. Motion is confined to dialog arrival and pointer feedback, with reduced motion honored. No mobile camera capability is requested.
