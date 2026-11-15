# 83: Ben's tab and capture changes

Owner: Ben. Agent: Codex. Date: November 15, 2026. Base: 06e40795. Status: implementing on main. For Nate's app-wiring and identify leads.

Ben requested a fixed secondhand/messages header with no page labels; Sell Listings/Sales and filters (All/Active/Drafts; All/To ship/Shipped/Canceled/Completed); Buy Tracked/Appraised/Found; You Dashboard/Settings; Today single-height horizontal tiers (Needs You, Can Wait, Good to Know, Other), removing money summary. Pause selling moves into Settings. Sell tiles remove offer/scam badges and show net proceeds when known.

Capture stays manual: front/back/close/tag and decision-directed quality/defect prompts, editable generated facts, parallel beautification with progress. Video is future work. Find uses Google Lens matching with external product links. Appraise identifies and classifies condition then values secondary markets. Track asks dynamic attributes from free text and alerts arrive in Messages. Ben asks for actual data/connections, no new tests/TDD, and permits landing without CI.

Ownership: this session changes screen composition and shared UI parts. Nate retains server/client/session/provider contracts. Existing useScreen/usePage interfaces are preserved. Please re-read changed route composition before wiring older UI assumptions.

Observed blockers at this base: useScreen supplies demo worlds; camera discards takePictureAsync output; capture upload route returns uploads.example. The UI work will retain actual photo output and call existing routes, but must not report placeholder jobs/uploads as successful live work. Need actual signed upload destination, capture identify/question result, finish/job stream, live app data provider, notification/lookup persistence. Source contracts remain Nate's; no competing server implementation here.

Acceptance: typecheck and rendered main-tab/+ journey, with external capabilities marked unverified until actual calls complete. Follow-up here will name committed changes and remaining gaps.
