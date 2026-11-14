# 31 — Per-platform posting rules and the product fit list

Updated: November 14, 2026. Owner: Ben. Agent: Claude Code (project thread "Tailor listings to each platform"). Branch: main. Status: research written; one question for Ben.

## Scope

How to post on each marketplace so it sells, and which product types belong on which. One note per platform (eBay, Facebook Marketplace, Depop, Poshmark, Mercari, OfferUp, Grailed) in [research/list/ben/platforms/](../../../../research/list/ben/platforms/), the summary in [platform-fit.md](../../../../research/list/ben/platform-fit.md), and the verdicts plus each site's listing profile as data in [platform-fit.json](../../../../research/list/ben/platforms/platform-fit.json). `node research/list/ben/platforms/fit.mjs <product type>` prints the route. Ben's ask: [words](../../../../product/words.md#2026-11-14-photos-touch-up-never-change-the-environment).

## What other work should take from it

- **List and connect:** route by product type (best and good post by default; ok is opt-in; avoid warns; blocked refuses). Each adapter's first rule is to read the live form's limits. Depop's API terms bar browser automation by partners, Grailed's and Mercari's terms bar automated tools, and the eBay listing on Facebook is not guaranteed. Details in the summary's "What this research changed".
- **Listing text and search** (added 23:30 UTC, Ben's ask for platform-specific SEO, [words](../../../../product/words.md#2026-11-14-fresh-image-agents-how-references-are-used-and-a-reference-set)): [listing-seo.md](../../../../research/list/ben/listing-seo.md) has 12 base rules and each site's differences. Each profile in the JSON now carries `title` (order, length, fill), `tags` and `search` (what search reads, filter fields). `node scripts/listing-lint.mjs title <site> facts.json` builds a title; `node scripts/listing-lint.mjs <site> draft.json facts.json` returns `block`, `ask` or `warn`. State: usable, 15 tests in `node .agents/check.mjs`. Nate: this is a proposal for [D4](../../../../spec/determinations/listing-and-marketing.md#d4-title-per-site) step 5, plain code for the length, banned-word and backed-word checks in place of the small model, and `buildTitle` as D4's fallback under 10 winners. Corrections it made: Mercari and Depop hashtags should add words the title lacks; eBay clothing needs Age Group and Gender specifics to show on Google Shopping.
- **Price:** compute a list price per platform from one target payout (padding and fees differ: Depop target / 0.85 at 0% fee, Poshmark target / 0.85 at 20%, Mercari target x 1.18, eBay target x 1.10). Depop's partner API has a pricing endpoint with similar sold items. OfferUp has no shipping and no sold prices.
- **Studio and capture** ([packet 30](../studio/30-studio-build-plan.md), [packet 22](../capture/22-capture-measure-identify-plan.md)): one portrait 3:4 capture with the item inside the centered square serves every crop (1:1 for eBay, Depop, Mercari, Facebook, OfferUp; 3:4 for Poshmark; 4:5 for Grailed). Default touch-up level per site is in the summary's photo table: level 1 on eBay, Depop, Poshmark and Mercari; level 0 on Facebook, OfferUp and Grailed. Tag, label, serial and flaw photos stay at level 0 everywhere.
- **Messages:** which offers bind differs per site (Poshmark and Grailed bind; Depop and Facebook do not), and so do offer clocks. See section 9 of each platform note.
- **Pitch:** Facebook now drafts listings with Meta AI and has a Seller app (2026). Our difference is measured items, sold-price data and routing across sites.

## Evidence and limits

Seven helpers ran three search loops each. A shared budget of about 100 page reads an hour ran out, so each note separates what was read at the source from memory and seller blogs. Facebook's and Poshmark's help centers refused automated readers. Verdicts are judgments from fees, rules and shipping limits, not from our own sales data.

## Next action

Ben: should "ok" platforms post by default. Level 2 (flattening creases) is allowed, per Ben at 23:01 UTC ([words](../../../../product/words.md#2026-11-14-garment-templates-a-reference-set-and-reading-c2pa)); where to use it per site stays a proposal in the summary. Answered at 22:09 UTC: posting to Grailed and OfferUp is planned, not built, "things if we have time" ([words](../../../../product/words.md#2026-11-14-grailed-and-offerup-posting-planned-not-built)); the plan is on the [ideas board](../../../../ideas/post-to-grailed-and-offerup.md). Nate: if you are building an adapter, the JSON profile for that site is the starting config; reply here with what you change.
