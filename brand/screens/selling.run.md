# Selling screens

Scope: live owned-item review, price, listing preparation and sale fulfillment. Existing brand direction is retained. Dark mode is the primary review surface.

Person and intent: a seller needs to verify the actual item, set an asking price and understand where the next action happens. The costly errors are losing edits, overwriting newer data, changing a live listing unintentionally, or mistaking a preview for publication.

Mechanisms carried from the existing kit and brand constitution:
- PhotoPager leads item review; the user's object is the subject, not a decorative graphic.
- Labeled native fields keep meaning visible during editing. One pinned Save action follows reading order.
- Compact photo/title rows orient pricing and preview without hiding their next action below a second large photo. Preview opens full photos on request.
- RouteSheet separates a focused choice from inventory navigation. The established timing and reduced-motion behavior remain; dirty-price dismissal asks before losing changes.
- Site logos identify marketplace destinations; rows disclose that they open another site. Copy/share preparation does not claim publication.
- Sale detail groups status, actual amounts and delivery action. Unknown fees and payout stay pending.
- Existing tokens supply dark surfaces, typography, spacing and contrast. No new palette, ornamental cards or icon family.

Evidence: app/e2e/selling-live.test.mjs, app/src/edge/api/items.test.ts. Browser renders inspected for review, price, preview and sale. UI proof uses controlled service responses. The independent code review found no remaining actionable defects after live-price, stale reload and late-navigation fixes. Native device interaction remains unverified.

Tradeoff: automatic posting, labels and pickup confirmation require production backend routes; this version uses an explicit marketplace handoff. The price engine currently exposes numeric cents without a currency field; its existing USD contract is used for guidance, while the draft's currency is retained when saving.
