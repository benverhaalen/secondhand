# 83: Ben's tab and capture changes

Owner: Ben. Agent: Codex. Date: November 15, 2026. Base: 06e40795. Status: implementing on main. For Nate's app-wiring and identify leads.

Ben requested a fixed secondhand/messages header with no page labels; Sell Listings/Sales and filters (All/Active/Drafts; All/To ship/Shipped/Canceled/Completed); Buy Tracked/Appraised/Found; You Dashboard/Settings; Today single-height horizontal tiers (Needs You, Can Wait, Good to Know, Other), removing money summary. Pause selling moves into Settings. Sell tiles remove offer/scam badges and show net proceeds when known.

Capture stays manual: front/back/close/tag and decision-directed quality/defect prompts, editable generated facts, parallel beautification with progress. Video is future work. Find uses Google Lens matching with external product links. Appraise identifies and classifies condition then values secondary markets. Track asks dynamic attributes from free text and alerts arrive in Messages. Ben asks for actual data/connections, no new tests/TDD, and permits landing without CI.

Ownership: this session changes screen composition and shared UI parts. Nate retains server/client/session/provider contracts. Existing useScreen/usePage interfaces are preserved. Please re-read changed route composition before wiring older UI assumptions.

Observed blockers at this base: useScreen supplies demo worlds; camera discards takePictureAsync output; capture upload route returns uploads.example. The UI work will retain actual photo output and call existing routes, but must not report placeholder jobs/uploads as successful live work. Need actual signed upload destination, capture identify/question result, finish/job stream, live app data provider, notification/lookup persistence. Source contracts remain Nate's; no competing server implementation here.

Acceptance: typecheck and rendered main-tab/+ journey, with external capabilities marked unverified until actual calls complete. Follow-up here will name committed changes and remaining gaps.

## Implemented and checked

Commits 8cfd7c23 (tabs and shared parts) and edbf3f64 (capture/tracking clients), integrated with UI core and copy cleanup through 9668e8ef in 71e5b987. Existing fixed parts are retained. Header is always pinned, page titles removed, Buy uses money icon, segments share one native component, Today cards shift left after removal. You embeds existing charts/settings. Messages combines decisions, notices, tracked matches and conversations; notification settings directs there.

Browser proof on the merged source: tab switches and filters render, Today removal moves next card from x370 to x20 (also with reduced motion), header stays y0 while Other scrolls into view, Pause selling lives in Settings. Track switches jersey size/fit fields to couch dimensions; submit calls the real endpoint and shows its 401. Camera calls the real capture endpoint and shows its 401. Shared nested button and SVG accessibility warnings were fixed. No new tests added. Scoped UI/parts/screens/copy checks pass. Full gate remains red on existing repo findings; the installed Anthropic SDK does not match engine types. Ben explicitly permits landing without CI.

## Backend dependencies still outstanding

- `useScreen`/`usePage` still supply demo worlds. Today actions/settings mutations are existing demo implementations. Need AP3 live provider, acknowledged actions and persisted settings.
- Capture signed upload URLs are placeholders (`uploads.example`). The client keeps real photos and refuses placeholder uploads. Manual photos upload in parallel once signing works.
- Nate's latest treg Lens setup (84dd5896) is preserved. No app-facing Lens implementation or listing URLs exist yet; identification result candidates need real URLs. The client opens supplied HTTP(S) URLs externally.
- Capture finish returns example job identifiers; valuation restricts inputs to example IDs. Client consumes all returned job streams concurrently and reads final job/capture results; it cannot make example jobs into real jobs.
- The answer endpoint permits current questions, not editing already-known generated facts. Add that mutation for full human review.
- Studio generation is not connected. Parallel upload and job consumption are implemented; parallel AI image generation remains server work.
- Want creation persists criteria but does not schedule watching. Enforce minimum price/color/description/dimensions/delivery as well as existing ceiling/size/cut, then deliver matches into Messages.
- Appraisal history needs capture photo + appraisal-time range + Why snapshot; existing Lookup lacks those fields and has no history endpoint. Buy renders optional snapshot fields and says unavailable when missing.
- Account authentication has no configured email sender and frontend session integration is AP1. Health returned 503 NOT_CONFIGURED locally. Anonymous search start did return 202 and its job could be read under the assigned visitor; multiple source stages failed. No account or marketplace connection is claimed verified.

Video capture is future work; default capture is manual only. Preserve explicit demo query paths for review, and wire the default live path instead of the old scripted camera.
