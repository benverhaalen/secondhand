# The cross-listing constitution

One draft on five sites, priced the way the seller chooses, never sold twice. The method is in [spec/features/list.md](../../spec/features/list.md), [features/list/](../../features/list/README.md), [crosslist-pricing.md](../../research/list/ben/crosslist-pricing.md) and the per-site facts in `spec/sites.mjs`. *Agent proposal*.

## The problem

Listing one thing on five sites means five forms, five sets of photo and text limits, five audiences and five prices under five fee schedules. Once it sells on one, the other four are live and can sell it again, and a mentor asked exactly what happens when two sites sell at once ([05:05](../words.md#2026-11-15-edge-cases-from-a-mentor-site-audiences-two-kinds-of-photo-enhancement-and-measuring-it-all)). Sellers want the most money for the least effort, but "most money" conflicts across sites, and some sites are wrong for some things: a couch doesn't belong on Depop ([21:28](../words.md#2026-11-14-photos-touch-up-never-change-the-environment)). So one draft has to become a listing tailored to each site, or a reason not to list there, at prices set by a rule the seller picks in plain words; and the moment it sells anywhere, every other listing comes down and we confirm it did.

**Success, checkably:** a draft posts to five sites with each site's limits met; a sale on one removes the rest and each removal is read back from the site; two sales at once end with one sale and one refunded or cancelled order, never two shipments.

## Ends

| End | Test |
|---|---|
| Never sold twice | The double-sale model in `spec/lifecycle.mjs` holds; every take-down is read back |
| Each listing fits its site | Each site's limits, categories and required fields pass before posting |
| The price rule is the seller's | Their rule is shown in words, and they can switch it per account and per item |
| Everything is auditable from one app | Every listing links to the site, with the site's own picture |

## Rules

**X1. A sale anywhere takes it down everywhere, confirmed.** Detected near-free from the sites' own signals, removed, then read back. *Why:* "never sold twice" is the promise ([user-wants](../../research/cross-cutting/ben/user-wants.md)); taking down posts is "an important feature" ([05:18](../words.md#2026-11-15-judges-and-users-guarantees-buyer-side-safety-approved-messages-sale-detection-where-not-to-list-proving-photo-honesty-an-faq)).

**X2. Tailor to each site.** Categories, attributes, character, hashtag and photo limits, and search wording per site ([21:28](../words.md#2026-11-14-photos-touch-up-never-change-the-environment), [03:17](../words.md#2026-11-15-new-takes-the-screen-a-live-point-cloud-stage-bubbles-and-the-found-pop-up-item-details-per-site-the-person-takes-the-photo-a-male-voice), [00:11](../words.md#2026-11-15-strategize-deeply-on-listing-seo)). Collect the most data once and trim per site ([06:19](../words.md#2026-11-15-notes-on-the-first-gallery-today-must-explain-itself-you-is-a-dashboard-the-camera-frames-the-listing-photo)).

**X3. The code knows each site's rules.** When a site's offer lasts 24 hours, everything that depends on it depends on that fact, from one place ([01:11](../words.md#2026-11-15-the-code-understands-each-app)). Check: `spec/sites.test.mjs`.

**X4. Suggest where not to list; the seller can overrule.** From each site's audience and what sells there ([05:18](../words.md#2026-11-15-judges-and-users-guarantees-buyer-side-safety-approved-messages-sale-detection-where-not-to-list-proving-photo-honesty-an-faq), [08:09](../words.md#2026-11-15-quantify-everything-a-why-for-every-rule-ranked-identify-and-revenue-streams)).

**X5. Prices across sites are the seller's choice.** Default: the same take-home everywhere; switchable once for the account and per item ([07:00](../words.md#2026-11-15-a-new-seller-starts-on-same-take-home)). Presets cover the reasons people sell ([06:51](../words.md#2026-11-15-cross-listing-prices-are-a-choice-the-reason-in-words-first)); the reasoning is in words, numbers on request ([06:53](../words.md#2026-11-15-cross-listing-prices-are-a-choice-the-reason-in-words-first)).

**X6. Approvals carry over to each site's own mechanism.** An approved price floor becomes Depop's offer setting, eBay's auto-accept and so on ([05:18](../words.md#2026-11-15-judges-and-users-guarantees-buyer-side-safety-approved-messages-sale-detection-where-not-to-list-proving-photo-honesty-an-faq): "how say on depop my approved action can turn into an approved offer").

**X7. Audit any site from one app.** Every listing has a way back to the site and its own screenshot when something must be verified ([06:19](../words.md#2026-11-15-notes-on-the-first-gallery-today-must-explain-itself-you-is-a-dashboard-the-camera-frames-the-listing-photo)).

**X8. Existing listings come in.** Depop listings import and cross-list ([05:47](../words.md#2026-11-15-cross-list-existing-depop-listings-and-price-any-product-with-quant-techniques)), never from Ben's personal account ([05:54](../words.md#2026-11-15-stop-using-my-personal-depop)).

**X9. The sites.** eBay, Facebook Marketplace, Depop, Poshmark and Mercari; Grailed and OfferUp planned, not built ([18:50](../words.md#2026-11-14-platforms), [22:09](../words.md#2026-11-14-grailed-and-offerup-posting-planned-not-built)). No applications to marketplaces yet ([08:15](../words.md#2026-11-15-no-applications-to-marketplaces-yet)).

**X10. AI-filled fields look different from the seller's.** A field the AI guessed, such as the garment's color, is drawn in its own color until the person touches it ([08:12](../words.md#2026-11-15-a-live-five-site-post-with-the-photo-toggles-and-ai-filled-fields-in-their-own-color)).

## Open

- The five-site post as one live action (Ben 08:12) is not built; Plan and Post pages are still being finished.
- The per-item price rule switch is not on the item page yet.
