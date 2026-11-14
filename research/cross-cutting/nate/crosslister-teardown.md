# How do the strongest crosslisting and reseller tools work mechanically as of November 2026, and where do they fail their users?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: cross-cutting.

Method and limits. Rawest source first: vendor help pages, then store listings and review pages, then rival or trade write-ups. Evidence marks: *observed* (opened, URL and source date given), *asserted* (source claims without showing), *inferred* (my reasoning), *unopened* (link not opened). A rival vendor's page about a competitor is *asserted*, not *observed*. Several evidence trails were compacted before writing, so exact page dates are given only where I re-opened the page this session; others say "date not captured". No tool states how it stores marketplace credentials (see Not found).

## 1. Mechanism classes (what "posting" means)

| Class | How it posts and delists | Tools | Consequence for sale detection |
|---|---|---|---|
| Extension in the user's logged-in browser | Fills each marketplace's own listing form or drives its tabs using the user's session | Vendoo, List Perfectly, Flyp, PrimeLister, SellerAider, Crosslist (Poshmark) | Needs the browser or device on and the session alive (inferred from the polling and "laptop closed" reports below) |
| Cloud automation | Vendor servers hold and run the marketplace sessions | Nifty; Closo Cloud (server-side browser on its Unlimited plan, per help.closo.co, date not captured); Voolist (extension for some platforms) | Does not need the user's device (asserted by vendors) |
| Official API (OAuth) | Marketplace's own listing API | eBay and Shopify (Closo help article says so, observed, date not captured) | Order and inventory events from the platform |
| Mobile app first | Phone app drives listing and sharing | OneShop, Lista (App Store listing, observed, date not captured), Crosslist mobile app | Not established |

Inferred: only eBay and Shopify are reached by sanctioned APIs among the tools I opened. Depop, Poshmark, Mercari and Facebook Marketplace are reached by session automation, with no tool documenting an official integration for them.

## 2. Per-tool teardown

### Vendoo
- Sale detection: polls every 10 minutes, observed in the Vendoo help article (URL not preserved; date not captured). Delist after detection follows plan settings.
- Failures: Trustpilot reviews Jul to Oct 2026 report undetected sales, silent disconnects and stale inventory (observed on Trustpilot, reviews dated Jul-Oct 2026; individual review URLs not preserved). [direct-references.md](../ben/direct-references.md) Flow 5 already records the Jul-Aug 2026 reviews; this note adds Oct 2026 and the 10-minute polling figure (extends).
- Rival claim: Vendoo's blog says Crosslist's delisting is manual (asserted, rival), contradicting Crosslist's own page below. Not resolved.

### List Perfectly
- Observed (https://help.listperfectly.com/en/articles/12263540-does-list-perfectly-remove-listings-when-sold, dated 2025-09-11): every plan can mark sold or end listings manually; Pro gives Sales Detection alerts but "you must end or mark the item sold on other marketplaces yourself"; Pro Plus gives Auto Delist that removes the listing from connected marketplaces after a sale is detected; "Shopify is not currently supported by Automatic Sales Detection or Auto Delist". The page does not state a detection interval.
- Asserted (search snippets, not re-opened): user-set check interval. Trustpilot page returned 404, so no review evidence.
- Design-relevant fact: automatic delisting is a paid-tier gate, so a Pro user gets an alert and a double-sale window by design (inferred from the help page).

### Crosslist
- Observed (vendor AI-info page, date not captured): AI add-on at +$4.99/month. Vendor says it autodelists before reposting on Depop (asserted, vendor, via search snippet). Contradicted by Vendoo's blog (above).

### Flyp
- Observed (Chrome Web Store reviews, date not captured): sales missed while the laptop is closed; a Depop import lost titles and categories. Sale refresh runs while the user is logged in (asserted in reviews).
- Flyp's store page is already in [direct-references.md](../ben/direct-references.md) Flow 5 (confirms).

### Nifty
- Observed (Nifty comparison page, vendor, date not captured): cloud automation, AI credits called Smart Credits. A July 2026 roundup lists Nifty at $39.99/month for Depop bots (asserted, vendor-adjacent, from search snippet).

### PrimeLister
- Observed (a Vendoo-authored review, so interested party, date not captured): extension based; automation of relisting and sharing.

### SellerAider and OneShop
- SellerAider: self-description only (observed, vendor, date not captured). OneShop: no primary source opened. Both unverified beyond that.

### Reeva
- Not found in two searches. Could be a renamed or defunct product.

### Newer entrants (2025-2026)
- Closo: help.closo.co article observed (date not captured): Closo Cloud server-side browser on Unlimited plan; API for eBay and Shopify. A separate closo.co page returned unrelated liquidation content, so the identity of that domain is mixed; I use only the help article. A Closo blog dated September 2026 says Poshmark has no official seller AI tool (asserted, contradicted below).
- Lista: App Store listing observed (date not captured), mobile-first.
- Voolist: comparison pages only; per-listing AI credit (asserted).
- Sidekick Tools: press release unreachable (SSL handshake failure). Known only from search snippets and a valueaddedresource article (asserted).

## 3. Marketplace-native tools

- eBay AI messaging (observed, https://www.valueaddedresource.net/ebay-us-august-2025-seller-update/, August 2025): announced at eBay Open 2025; suggests quick replies from live listings; the seller can "review and refine each suggested message before sending". It drafts and does not auto-send. Same page: from 2025-09-03 eBay leaves automatic positive feedback for eligible orders (tracked, on time, no buyer feedback, no reported issue); tracking is used to auto-release funds on delivery. Extends [direct-references.md](../ben/direct-references.md) Flow 1 and Flow 6, which cover eBay AI listing and Meta auto-replies. I found no 2026 eBay messaging update (see Not found).
- Mercari (observed via search summary; sources valueaddedresource and digitalcommerce360, not re-opened): AI Assistant for unsold items, Oct 2023; photo-to-listing AI, Sept 2024, "about 15 seconds" (company claim); the image beta review found it still needs much seller input; an AI importer for eBay and Depop listings "doesn't always get it right". Official app inside ChatGPT, June 2026 (asserted, Japanese trade press, unopened). Importer is mentioned in [direct-references.md](../ben/direct-references.md) Flow 8 as unopened; this note adds the accuracy caveat (extends, still second-hand).
- Poshmark: Smart List AI, announced Jan 2025, photo to title, description, category; "48%" faster listing is Poshmark's claim (asserted, Retail Dive snippet). Closo's Sept 2026 claim that no official AI tool exists conflicts with that launch (contradiction between sources, not resolved). Policy facts from valueaddedresource and List Perfectly articles (observed, dates not captured): 3% rolling 90-day seller-cancellation rate; 24-hour restriction then 14-day suspension; Excessive Listing Removal policy (May 2025); a policy against unauthorised automation; Bulk Sharing removed Nov 2025 and restored around Dec 15, 2025. Inferred: a late delist that ends in a seller cancellation counts toward that 3% rate, so a missed sale on another site can threaten the Poshmark account.
- Depop: official news found is AI photo editing via Photoroom (observed in search result, date not captured). eBay agreed to buy Depop from Etsy (Diginomica, Feb 2026, asserted from snippet). No native bulk relist or automation feature found; relist bots are third-party, and Depop's own automation rules were not reached.
- Facebook Marketplace: no new material beyond [direct-references.md](../ben/direct-references.md) Flow 1 and Flow 6 (Meta AI, auto-replies, the Muse address incident). No crosslister was found using an official Marketplace listing API (not found, not proof of absence).

## 4. Documented failures, by class

| Class | Evidence | Date |
|---|---|---|
| Undetected sale, double sale | Vendoo Trustpilot reviews (observed) | Jul to Oct 2026 |
| Detection depends on device awake | Flyp Chrome Web Store reviews (observed) | date not captured |
| Detection only alerts on lower tier | List Perfectly help page (observed) | 2025-09-11 |
| Import data loss | Flyp Depop import lost titles and categories (observed) | date not captured |
| AI wrong details | Mercari AI importer "doesn't always get it right" (asserted via trade summary); sizes wrong in reviews (asserted) | 2024 to 2026 |
| Platform enforcement on automation | Poshmark 3% cancellation rule, Excessive Listing Removal, Bulk Sharing pulled and restored | May 2025 to Dec 2025 |
| Rival-vendor contradiction | Crosslist says autodelist, Vendoo says manual | date not captured |

Not found: dated ban reports tied to a named crosslister; status-page incidents for any tool; refund-dispute specifics.

## 5. Capability by tool

Y = a source says so (mostly vendor, asserted unless noted); N = source says no; ? = not established.

| Capability | Vendoo | List Perfectly | Crosslist | Flyp | Nifty | PrimeLister | SellerAider | OneShop | Closo | eBay native | Poshmark native |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Post mechanism | Extension | Extension | Extension | Extension | Cloud | Extension | Extension | Mobile | Cloud (Unlimited) | API | Own app |
| Sale detection | Poll 10 min (observed) | Alerts on Pro, interval ? | ? | While logged in | ? | ? | ? | ? | ? | Native | Native |
| Auto delist | Plan based | Pro Plus only (observed) | Disputed | ? | Y | ? | ? | ? | ? | n/a | n/a |
| Relist / sharing | Y | Y | Y (Depop) | Y | Y | Y | ? | ? | Y (Depop bot) | Relist | Bulk Share (restored Dec 2025) |
| Offers to likers | ? | ? | ? | ? | Y (asserted) | ? | ? | ? | ? | Offers to watchers | Y |
| Message replies | ? | ? | ? | ? | ? | ? | ? | ? | ? | AI drafts, manual send (observed) | ? |
| AI listing | Y | Y | Add-on $4.99 | Y | Smart Credits | ? | ? | ? | ? | Y | Smart List AI |
| Analytics | Y | Y | Y | Y | Y | ? | ? | ? | ? | Y | Seller Hub (asserted) |
| Credentials held | Not stated by any tool | | | | | | | | | | |

Inferred: the Y cells for relisting, sharing and offers are vendor marketing and I did not test any of them.

## 6. Things no tool does well (inferred from the gaps above)

- Real-time cross-site delist independent of a user's device on extension tools; the polling gap is the double-sale window.
- Stating how credentials or sessions are held; no source opened says.
- Reply automation that sends: eBay drafts only, and no crosslister reply feature was established.
- A shared, dated incident record: none of the tools exposes a status page I found.
- Import fidelity: titles, categories and sizes are lost or wrong in Flyp and Mercari imports.
- Warning before a delist miss turns into a Poshmark cancellation.

## 7. Confirms, extends, contradicts

- Confirms [direct-references.md](../ben/direct-references.md) Flow 5 (Vendoo detection, List Perfectly tiers, Flyp store page).
- Extends it with the 10-minute interval, Oct 2026 reviews, Poshmark enforcement thresholds, and eBay's no-auto-send messaging.
- Extends [missing-features.md](../ben/missing-features.md) M5, M6, M12, M18, M19 (asserted there): sharing, relisting and bulk edit exist in tools, though Bulk Sharing was pulled from Poshmark in Nov 2025; M19 saved replies has no crosslister evidence.
- No contradiction found with [existing-tools.md](../../appraise/ben/existing-tools.md); it covers appraisal, not crosslisting.

## Searched / could not reach

Sidekick press release (SSL failure). List Perfectly Trustpilot (404). One Closo domain (unrelated content). Reeva (two searches, nothing). Not tried: app-store reviews for OneShop, Facebook groups, Reddit threads, Poshmark and Depop help centres directly.

## Not found

- Reeva.
- How any tool stores credentials or sessions.
- Delist latency for List Perfectly (page gives no interval), Flyp, Nifty, Crosslist.
- Depop, Mercari and Facebook assistant specifics beyond secondary reports.
- 2026 eBay messaging update; Smart Offers or Poshmark 2026 announcement.
- Status pages and changelogs with dated incidents.
- Dated ban reports tied to a named crosslister.

## Sources fetched

- https://help.listperfectly.com/en/articles/12263540-does-list-perfectly-remove-listings-when-sold (2025-09-11)
- https://www.valueaddedresource.net/ebay-us-august-2025-seller-update/ (Aug 2025)
- Search-result summaries only (not opened): Mercari AI coverage (valueaddedresource, digitalcommerce360 2026-06-19), Depop and Photoroom, Poshmark Smart List AI (Retail Dive), Nifty and Closo blogs.
- Opened earlier, URLs not preserved after compaction: Vendoo help article and Trustpilot; Crosslist AI page; Flyp Chrome Web Store; Nifty comparison; PrimeLister review; SellerAider site; help.closo.co article; Lista App Store listing; valueaddedresource Poshmark policy article.
