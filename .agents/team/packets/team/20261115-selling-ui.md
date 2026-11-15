# Selling UI integration

Owner: Ben. Agent: Codex. Updated: 2026-11-15. Base: 6b8f5b46; integration with current main follows.

[Ben's request](../../../../product/words.md#2026-11-15-ben-wire-the-main-selling-flows): check and wire the main selling flows, with screens following the brand constitution and familiar interaction patterns.

## Connected journey

Sell inventory → owned item → Review item → saved title, quantity, location and cost → Choose a price → saved asking price → Listing preview → copy/share details and open a selling site. Capture Sell finishes into its own item review. Existing live listings send price changes to their selling site because PATCH price can trigger marketplace repricing.

Sales reads the owned, paginated orders API directly, preserving orders with unknown fees/payout. The selected sale opens delivery or pickup detail with actual money and status, plus a sale/listing link or marketplace home. No label, publication or handover success is simulated in a live route. Explicit demo routes retain their demonstrations.

The backend GET item projection now returns stored price_cents and description; previously a successful price edit disappeared when reopened. A real owned-item regression proves PATCH then GET. Price guidance consumes the actual valuation job range.q10/q90 shape; failed guidance leaves manual entry available.

## Backend dependencies

Capture finish's photo/title materialization and identify/Lens join stay with Nate's capture workstream. The latest capture packet says that join is built on its branch; it was not merged on the inspected main. Attributes, sell/listing creation and shipping-label/appointment routes still use example gating on that main. This UI does not invoke them as if they were production. Typed/link Sell import offers camera capture instead of opening a fixed demo item.

The handoff exports title, description, quantity, attributes and asking price. Photos must be added on the selling site. It does not connect accounts or detect publication from opening a link. Quantity is preserved without inventing a per-unit versus lot-price contract.

## Verification

Eight dark-mode browser scenarios use controlled service responses: inventory edit/price/reopen, version conflict/reload failure, capture-to-owned-draft, valuation success/failure, live-price protection, nullable-fee sale/fulfillment, copy/site handoff and dirty price dismissal. This proves client wiring, not a live marketplace transaction. Owned item API suite: 72 tests. Typecheck and scoped lint are recorded after integration. Phone screenshots inspected at 390 pixels; overflow checked at 320 pixels. Native camera/keyboard, system back gestures and marketplace-account operation were not demonstrated on a device.

[UI rationale](../../../../brand/screens/selling.run.md). Whole-repository checker has unrelated failures; no push exception is inferred from earlier brand/sign-in authorization.
