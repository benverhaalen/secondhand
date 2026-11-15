# Selling screens

Scope: live owned-item review, price, listing preparation and sale fulfillment. Existing brand direction is retained. Dark mode is the primary review surface.

Person and intent: a seller needs to verify the actual item, set an asking price and understand where the next action happens. The costly errors are losing edits, overwriting newer data, changing a live listing unintentionally, or mistaking a preview for publication.

Mechanisms carried from the existing kit and brand constitution:
- A compact photo identity row leads item review; View photos opens the full pager without pushing the fields below the fold.
- Labeled native fields keep meaning visible during editing. One pinned Save action follows reading order.
- Compact photo/title rows orient pricing and preview without hiding their next action below a second large photo. Preview opens full photos on request.
- RouteSheet flow mode gives pricing and preview a full-height focused surface with explicit back navigation. The established timing and reduced-motion behavior remain; dirty-price dismissal asks before losing changes.
- Site logos identify marketplace destinations; rows disclose that they open another site. Copy/share preparation does not claim publication.
- Sale detail groups status, actual amounts and delivery action. Unknown fees and payout stay pending.
- Existing tokens supply dark surfaces, typography, spacing and contrast. No new palette, ornamental cards or icon family.

Evidence: app/e2e/selling-live.test.mjs, app/src/edge/api/items.test.ts. Browser renders inspected for review, price, preview and sale. UI proof uses controlled service responses. The independent code review found no remaining actionable defects after live-price, stale reload and late-navigation fixes. Native device interaction remains unverified.

Tradeoff: automatic posting, labels and pickup confirmation require production backend routes; this version uses an explicit marketplace handoff. The price engine currently exposes numeric cents without a currency field; its existing USD contract is used for guidance, while the draft's currency is retained when saving.

Current verification: ten selling browser scenarios pass. The rendered typography suite checks all six approved signatures, including editable inputs, in light and dark states. Fields retain the established transparent underline and ink focus treatment. Review and price opt into keyboard avoidance; native keyboard behavior still needs device verification. Multiple sales for one item require an explicit selection.

Secondary-screen audit: reviewed current main-derived renders and explicit approval history. Main tabs and New were preserved. Changes group existing sign-in and onboarding actions, compact import selection controls, align import titles/prices, group tracking constraints, emphasize appraisal results, and wrap full permission conditions. Existing handlers and options remain. Backend gaps are handed to Nate in the secondary-ui-wiring and account-ui-wiring packets; no replacement screens or removed controls from that investigation were retained.
