# List everywhere

Status: idea. Owner: unassigned. Packet topic: `list`.

Spec (agent proposal): [spec/features/list.md](../../spec/features/list.md).

## What and why
Post to every marketplace, then delist everywhere once the item sells, using Browser Use's cloud computer use where no API exists. Ben: [words](../../product/words.md#2026-11-14-tools-and-capture).

Posting to Grailed and OfferUp is for later: [ideas board](../../ideas/post-to-grailed-and-offerup.md).

## How it works
Not designed yet. Keep the mechanism here once research picks one, together with the reference it came from and the job that reference does.

## Decided
Nothing yet. Each entry here links to [decisions.md](../../product/decisions.md).

## Built (agent proposal, not yet decided)
- **Cross-list existing listings.** `app/src/edge/connect/depop-import.ts` turns Depop products (Partner API shape) into source listings; `app/src/engines/listing/crosslist.ts` routes each one by product type, prices every other linked site to keep the same payout and the same floor (`priceForKeep`; with no floor the draft asks for one), skips a site where the item is already live and a listing not in US dollars, builds each draft with `buildListing`, and posts only ready drafts whose first_post decision was approved, through the harness `post` verb with one operation id per listing and site. Sold listings become comps, not drafts. Run `node scripts/crosslist.mjs` on the made-up shop in `spec/fixtures/depop/shop.json`. Not run on a real account: no Depop adapter reads a shop yet, and no site adapter posts.

## Open
- **How prices relate across sites** (decided by Ben, [decisions](../../product/decisions.md#2026-11-15-cross-listing-starts-on-same-take-home); [crosslist-pricing.md](../../research/list/ben/crosslist-pricing.md)). The seller picks one of four rules, each told in words with the numbers on a tap: same take-home (the default), same price, what each site pays, your shop first. The rule is set once for the account and can be overridden per item. The floor pays the same on every site under all four. Open: the screen.
- Automatic posting or one tap by the user? There is a risk of account bans. (See the vision's Open section.)

## Research
All research for this feature: [research/list/](../../research/list/)
- Ben: [research/list/ben/](../../research/list/ben/)
- Nate: [research/list/nate/](../../research/list/nate/)
- Nate: [listing-fields-by-platform.md](../../research/list/nate/listing-fields-by-platform.md). Exactly which fields each of the five sites needs or accepts to create a listing, per kind of item, from API specs and help pages.
- Nate: [observing-rank-and-performance.md](../../research/list/nate/observing-rank-and-performance.md). How to measure from outside which listings rank on top and why, and turn it into honest choices for title, photos, price and timing.
- Nate: [platform-levers.md](../../research/list/nate/platform-levers.md). Seller and buyer levers on seven sites that software could pull, what each already automates, and corrections to earlier notes.
- Nate: [ranking-algorithms.md](../../research/list/nate/ranking-algorithms.md). What nine marketplaces have disclosed about search and feed ranking; only Meta, Vinted and eBay publish staged structure; recency boosts are small.
- Ben, cross-posting and delisting: [crosspost-and-delist.md](../../research/list/ben/crosspost-and-delist.md). eBay stays API only; Depop has a partner API; Browser Use and the replay layer cover Poshmark, Mercari and Facebook; sales come from orders and webhooks, and a delist counts only after a read-back.
- Ben, tech stack: [posting-browser-use-ebay.md](../../research/list/ben/posting-browser-use-ebay.md). eBay through its Listing/Inventory API with a dry-run mode; Browser Use V4 for sites without an API, stopped before Post until the user approves.
- Ben, harness from repos: [ai-harness-from-repos.md](../../research/cross-cutting/ben/ai-harness-from-repos.md#4-posting-delisting-and-jobs). *Agent proposal:* a posting click is never retried; the listing sits in `verifying` while a reconciler reads back (thrift-agent).
- Ben, tailoring each platform: [platform-fit.md](../../research/list/ben/platform-fit.md). *Agent proposal:* route by product type, since nothing is a strong fit everywhere; a couch goes to Facebook only; each site gets its own title, tags, crop, price padding and offer rules. One note per platform in [platforms/](../../research/list/ben/platforms/), and the verdicts as data in [platform-fit.json](../../research/list/ben/platforms/platform-fit.json).
- Ben, search on each platform: [listing-seo.md](../../research/list/ben/listing-seo.md). *Agent proposal:* 12 rules that hold on every site (only words a fact backs, brand first, every filter field filled or asked) plus each site's differences as data; `node scripts/listing-lint.mjs` builds a title per site and checks a draft with no model call.
- Ben, the search strategy: [listing-seo-strategy.md](../../research/list/ben/listing-seo-strategy.md). *Agent proposal:* text is a threshold (be findable by every search worth being in, at the first post); price and the first photo are the dials. Score a word by the buyer demand it adds, stop padding titles and fields. `node scripts/listing-lint.mjs coverage` measures reach.
- Ben, each site's pricing levers and seller signals: [levers-and-signals.md](../../research/list/ben/levers-and-signals.md). *Agent proposal:* the person's floor and always-accept lines become each site's own tool (eBay auto-accept and a 50% auto-decline, Depop auto-respond and Poshmark Smart Sell at always accept, never the floor), drops use each site's lever (Depop Discount, Mercari Promote, Poshmark 10%), and signals are compared within a site and through each site's signals per sale. Data and tests in [levers/](../../research/list/ben/levers/).
