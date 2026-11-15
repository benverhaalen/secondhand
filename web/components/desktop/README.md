# Signed-in desktop workspace

`/app` uses the mobile app’s bearer session and `/v1` resources. Today shows signed decisions. Sell supports photo upload, inventory, item details, quantity/location/cost edits, asking prices, comparable-price guidance and sales. Buy follows search jobs, creates/edits/pauses watches, groups found matches and shows appraisal history. Shopping chat uses authenticated search and assistant jobs, supports follow-up questions and keeps chats on this browser under the signed-in account. The current chat reopens after a refresh. You shows account totals and marketplace connections. Settings, data export and Messages are available from the rail and header. External listing and sale links preserve the server’s HTTP(S) destination.

Web and mobile follow `/v1/stream`. Authenticated mutations publish per-user invalidations. Workers sharing one SQLite database see durable frames each second; separate database files do not synchronize. Foreground refresh and a 15-second fallback also catch worker changes outside API requests. Item, watch and Settings editors retain their opening version so an update on another device cannot silently overwrite an unsaved draft. Search jobs survive reload through the URL. Job followers stop after completion and retry failed reads against the same job.

## Server boundaries

- Publishing uses the same manual marketplace handoff as the native seller flow: copy the item details, open the marketplace form, add photos and publish there. Automated posting is not claimed.
- Capture finish preserves uploaded photos and follows the real identification work. Upload retries in an open dialog reuse the capture and retain completed transfers. Closing or reloading does not preserve the upload attempt; a lost response to the initial capture creation remains uncertain.
- Appraisal history displays only saved server records. The current lookup endpoint can omit the original photo and appraisal range; the UI says when that original appraisal is unavailable.
- Shopping conversations follow the native device-local history behavior; their transcripts do not synchronize between devices. Listings, watches and other account resources still use the shared API.
- Watches enforce maximum price, size and fit through the current engine. Minimum price, color, dimensions, delivery preference and extra notes are saved preferences, and the form says so.
- Messages submitted through the API are queued, not confirmed delivered. Marketplace service availability comes from the connection service.
- Account deletion is unavailable in the desktop UI because the default backend has no complete workspace-purge connection. Native defaults and permission screens currently use local demo state; they are not presented here as synchronized settings.
- Local item details do not claim to update live marketplace listings. Live prices are edited through their exact marketplace links.

## Design

The labeled Today, Sell, Buy and You rail replaces mobile tabs; Add an item sits below them. Account identity, Settings and Log out sit at the bottom, and Back to website sits at the top. Secondary tasks use centered, scrollable dialogs. Existing Hugeicons, brand fonts, gradient wash and light/dark tokens are shared. No camera access is requested.
