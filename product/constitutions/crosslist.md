# The cross-listing constitution

One draft on five sites, priced the way the seller chooses, never sold twice. The method is in [spec/features/list.md](../../spec/features/list.md), [features/list/](../../features/list/README.md), [crosslist-pricing.md](../../research/list/ben/crosslist-pricing.md) and the per-site facts in `spec/sites.mjs`. Reasons and numbers follow [evidence.md](evidence.md). *Agent proposal*.

## The problem

Listing one thing on five sites means five forms, five sets of photo and text limits, five audiences and five prices under five fee schedules. Once it sells on one, the other four are live and can sell it again, and a mentor asked exactly what happens when two sites sell at once ([05:05](../words.md#2026-11-15-edge-cases-from-a-mentor-site-audiences-two-kinds-of-photo-enhancement-and-measuring-it-all)). Sellers want the most money for the least effort, but "most money" conflicts across sites, and some sites are wrong for some things: a couch doesn't belong on Depop ([21:28](../words.md#2026-11-14-photos-touch-up-never-change-the-environment)). So one draft has to become a listing tailored to each site, or a reason not to list there, at prices set by a rule the seller picks in plain words; and the moment it sells anywhere, every other listing comes down and we confirm it did.

**Success, checkably:** a draft posts to five sites with each site's limits met; a sale on one removes the rest and each removal is read back from the site; two sales at once end with one sale and one refunded or cancelled order, never two shipments.

## Ends

| End | Test | Why it matters |
|---|---|---|
| Never sold twice | The double-sale model in `spec/lifecycle.mjs` holds; every take-down is read back | A second sale creates a cancellation or refund and disappoints a buyer. |
| Each listing fits its site | Each site's limits, categories and required fields pass before posting | Rejected fields leave the seller with an incomplete post. |
| The price rule is the seller's | Their rule is shown in words, and they can switch it per account and per item | The seller chooses the tradeoff between proceeds and speed. |
| Everything is auditable from one app | Every listing links to the site, with the site's own picture | The seller can resolve a discrepancy against the marketplace itself. |

## Rules

**X1. A sale anywhere takes it down everywhere, confirmed.** Detected near-free from the sites' own signals, removed, then read back. *Why:* A listing left live can accept a second buyer for the same item. Reading back each removal catches failed take-downs before the seller assumes the risk is gone. Source: "never sold twice" is the promise; taking down posts is "an important feature". *Why:* A listing left live can accept a second buyer for the same item. Reading back each removal catches failed take-downs before the seller assumes the risk is gone. Source: ([user-wants](../../research/cross-cutting/ben/user-wants.md)); ([05:18](../words.md#2026-11-15-judges-and-users-guarantees-buyer-side-safety-approved-messages-sale-detection-where-not-to-list-proving-photo-honesty-an-faq)).

**X2. Tailor to each site.** Categories, attributes, character, hashtag and photo limits, and search wording per site. Collect the most data once and trim per site. *Why:* A site can reject fields or fail to surface wording that works elsewhere. Tailoring one collected record saves the seller repeated forms while making each listing usable on its destination. Source: ([21:28](../words.md#2026-11-14-photos-touch-up-never-change-the-environment), [03:17](../words.md#2026-11-15-new-takes-the-screen-a-live-point-cloud-stage-bubbles-and-the-found-pop-up-item-details-per-site-the-person-takes-the-photo-a-male-voice), [00:11](../words.md#2026-11-15-strategize-deeply-on-listing-seo)); ([06:19](../words.md#2026-11-15-notes-on-the-first-gallery-today-must-explain-itself-you-is-a-dashboard-the-camera-frames-the-listing-photo)).

**X3. The code knows each site's rules.** When a site's offer lasts 24 hours, everything that depends on it depends on that fact, from one place. Check: `spec/sites.test.mjs`. *Why:* Duplicated site facts can drift. One source for an offer's duration makes expiry decisions consistent, so the seller does not act on an offer that has already ended. Source: ([01:11](../words.md#2026-11-15-the-code-understands-each-app)).

**X4. Suggest where not to list; the seller can overrule.** From each site's audience and what sells there. *Why:* An audience that does not want the item adds listing work without a clear benefit. Explaining the mismatch saves seller effort while an override preserves their knowledge of the item. Source: ([05:18](../words.md#2026-11-15-judges-and-users-guarantees-buyer-side-safety-approved-messages-sale-detection-where-not-to-list-proving-photo-honesty-an-faq), [08:09](../words.md#2026-11-15-quantify-everything-a-why-for-every-rule-ranked-identify-and-revenue-streams)).

**X5. Prices across sites are the seller's choice.** Default: the same take-home everywhere; switchable once for the account and per item. Presets cover the reasons people sell; the reasoning is in words, numbers on request. *Why:* Different fees make the same asking price pay differently. A visible take-home rule lets the seller choose between money and speed without calculating every site again. Source: ([07:00](../words.md#2026-11-15-a-new-seller-starts-on-same-take-home)); ([06:51](../words.md#2026-11-15-cross-listing-prices-are-a-choice-the-reason-in-words-first)); ([06:53](../words.md#2026-11-15-cross-listing-prices-are-a-choice-the-reason-in-words-first)).

**X6. Approvals carry over to each site's own mechanism.** An approved price floor becomes Depop's offer setting, eBay's auto-accept and so on. *Why:* A site can act on its own offer settings between app checks. Carrying the approved floor into that mechanism keeps those actions inside the seller's chosen limit. Source: ([05:18](../words.md#2026-11-15-judges-and-users-guarantees-buyer-side-safety-approved-messages-sale-detection-where-not-to-list-proving-photo-honesty-an-faq): "how say on depop my approved action can turn into an approved offer").

**X7. Audit any site from one app.** Every listing has a way back to the site and its own screenshot when something must be verified. *Why:* Our local state can disagree with a marketplace. A direct link and site image let the seller inspect the source before deciding what to correct. Source: ([06:19](../words.md#2026-11-15-notes-on-the-first-gallery-today-must-explain-itself-you-is-a-dashboard-the-camera-frames-the-listing-photo)).

**X8. Existing listings come in.** Depop listings import and cross-list, never from Ben's personal account. *Why:* Retyping an existing listing repeats work the seller has already done. Import makes that work reusable across sites, while a separate account keeps tests out of personal listings. Source: ([05:47](../words.md#2026-11-15-cross-list-existing-depop-listings-and-price-any-product-with-quant-techniques)); ([05:54](../words.md#2026-11-15-stop-using-my-personal-depop)).

**X9. The sites.** eBay, Facebook Marketplace, Depop, Poshmark and Mercari; Grailed and OfferUp planned, not built. No applications to marketplaces yet. *Why:* Listing and search support vary by site. Naming the core sites and separating planned ones lets a seller judge actual coverage. Keeping applications on hold preserves Ben's stated scope. Source: ([18:50](../words.md#2026-11-14-platforms), [22:09](../words.md#2026-11-14-grailed-and-offerup-posting-planned-not-built)); ([08:15](../words.md#2026-11-15-no-applications-to-marketplaces-yet)).

**X10. AI-filled fields look different from the seller's.** A field the AI guessed, such as the garment's color, is drawn in its own color until the person touches it. *Why:* A guessed field can look as authoritative as a seller-entered fact. Distinguishing it directs the seller's review to claims that could otherwise mislead a buyer. Source: ([08:12](../words.md#2026-11-15-a-live-five-site-post-with-the-photo-toggles-and-ai-filled-fields-in-their-own-color)).

## Open

- The five-site post as one live action (Ben 08:12) is not built; Plan and Post pages are still being finished.
- The per-item price rule switch is not on the item page yet.
