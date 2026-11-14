# What does Shopify's seller suite do, and what does each part mean for an app where every item is one used unit sold on someone else's marketplace?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: cross-cutting.

Scope. Shopify Catalog (and agent shopping) and Shopify Analytics are covered by two other workers and are not researched here. This note covers the rest of the merchant suite, plus the nearest all-in-one used-goods seller tools (features only). The earlier teardown of crosslisters is [crosslister-teardown.md](crosslister-teardown.md); this note adds only what it lacks. Page dates were not shown on the Shopify marketing pages unless stated; all were fetched 2026-11-14. Evidence marks: observed (read at the URL), asserted (a vendor or third party claims it), inferred (mine).

## 1. Edition context
- Shopify's Fall '26 Edition page shows 1B+ products in the catalog, 400M+ shoppers with Shop Pay accounts, and Shopify Payments preventing 12K+ high-risk payments a minute (observed, https://www.shopify.com/editions/fall2026, date not shown). Sidekick is described as an agent that plans staged changes and applies them after one approval (observed, same page).

## 2. Product and inventory management
- Does for the seller: stock levels across locations with states (damaged, reserved, committed, incoming), purchase orders, transfers, ABC inventory analysis, tracking of in-person, B2B, bundle, subscription, draft and pre-order stock (observed, https://www.shopify.com/inventory-management, date not shown). Real-time sync to TikTok, YouTube, Facebook, Instagram, Amazon, Target, Walmart and eBay (observed, same page).
- Data held: quantity per variant per location, barcodes (up to 20 per variant, asserted from the help centre via a search excerpt), supplier and purchase order records. Trigger: a sale on any channel, a transfer, a received purchase order.
- Used-unit meaning (inferred): quantity is always 1, so variants, transfers and purchase orders collapse into one record per thing plus a "where it physically is" label. What remains useful is location, barcode and SKU lookup, and a sourcing record (what was bought, from whom, at what cost).
- Used-goods tools: List Perfectly has an SKU generator, inventory labels with QR codes and a pick list for sold orders showing SKU, location and quantity (observed in vendor page excerpts, https://listperfectly.com/, date not shown). Vendoo has custom labels, a multi-quantity manager, stale-listing reminders and downloadable inventory spreadsheets (observed in excerpts, https://www.vendoo.co/, date not shown). Flyp has bulk delist, relist and import with multi-quantity (observed, https://resellertools.zendesk.com/hc/en-us/articles/29303062009357-Why-Flyp-Reseller-Tools, date not shown).

## 3. Orders and fulfilment
- Shopify holds orders from all channels in one place with pick lists with bin locations (observed, https://www.shopify.com/shipping, date not shown). Flow can hold or release orders (observed, https://www.shopify.com/flow).
- Used-unit meaning (inferred): the order lives on the marketplace; the app mirrors it and adds a ship-by deadline and a "now delist elsewhere" action.
- Used-goods tools: Flyp has order management across platforms with label printing and delist on sale (observed in excerpts, same Flyp page). Vendoo and List Perfectly detect a sale and delist elsewhere (observed in excerpts; List Perfectly's Auto Delist is only on its top plan, https://listperfectly.com/pricing/, date not shown).

## 4. Shipping labels and rates
- Discounted domestic and international labels; up to 250 labels at once; up to $200 insurance at no extra cost on every order; buyer tracking by email and push; package and carrier recommendations that learn from past orders; labels in POS; up to 3% cashback with Shopify Credit; connect your own carrier account; claims filed in the admin; address validation (observed, https://www.shopify.com/shipping, date not shown). The help-centre labels page timed out (not read).
- Used-unit meaning (inferred): on Poshmark the label is prepaid by the marketplace; on eBay, Mercari and Depop the seller may buy a label. Insurance and claims matter most where the marketplace does not provide them.

## 5. Returns
- The help-centre Returns page was behind a bot wall (not read). Evidence comes from Collective help pages: retailer return policies auto-create returns, sync labels and reasons, and sync closing (observed in search excerpts of help.shopify.com, date not shown).
- Used-unit meaning (inferred): a return reopens one unit; it must go back to stock as the same item with condition re-checked.

## 6. Unified inbox
- Not found as a cross-channel inbox. The Shopify Inbox page now describes an AI storefront sales associate, not a cross-channel inbox (observed, shopify.com Inbox page excerpt, date not shown).
- Used-goods tools: SellerAider claims a "unified messaging inbox" on its own comparison page while other lists say message management is "coming soon" (asserted both ways, https://selleraider.com/crosslisting-app/, date not shown).

## 7. Flow (automation)
- No-code trigger, condition and action blocks with pre-built templates. Playbooks: inventory (hide out of stock, reorder when low), fraud (flag high-risk orders), loyalty, fulfilment (hold or release) (observed, https://www.shopify.com/flow, date not shown). The help-centre Flow page was behind a bot wall (not read).
- Data: order, customer, product and inventory events. Trigger: any store event or a schedule.
- Used-unit meaning (inferred): user-defined rules such as "when a unit sits 30 days, drop 10%" or "when sold, hold other listings". Used-goods tools offer fixed versions of this (auto-delist, auto offers, stale alerts) rather than user-defined rules.

## 8. Sidekick and the Magic features
- Designer, photo editor, writer, tech support, marketer. Slash prompts such as /product-description and /pricing. "Start for free, then 3 months for $1/mo" (observed, https://www.shopify.com/sidekick, date not shown). /magic serves the same page (observed). Staged changes applied after one approval (observed, Fall '26 page). The Sidekick help page was not read.
- Used-goods tools: Vendoo has AI Listing Enhancement and PhotoRoom background removal; Flyp has AI auto-fill; SellerAider has AI listing from one photo; Crosslist sells an AI add-on at $4.99 a month (asserted via comparison pages, https://crosslisty.com/best-crosslisting-apps, date not shown).

## 9. Marketing and email (Shopify Messaging)
- Email and SMS campaigns; templates pull branding, products and prices from the store; Sidekick writes copy; express checkout buttons in emails; automation templates (welcome, winback, upsell) with triggers, conditions and wait steps; forms, segmentation and automation analytics (observed, https://www.shopify.com/email-marketing, date not shown).
- Used-unit meaning (inferred): a "back in stock" message cannot apply to a one-off item; what applies is telling past buyers or followers about a new similar unit.

## 10. Audiences
- Requires Shopify Plus, Shopify Payments, a US or Canada store and Shopify Network Intelligence (required from 2025-07-25). Builds likely-buyer audiences from cross-merchant signals and exports hashed audiences to Meta, Google, Criteo, Pinterest, Snapchat and TikTok, usually within 24 hours; the merchant cannot view the data (observed in help excerpts, help.shopify.com Audiences pages, date not shown).
- Used-unit meaning (inferred): needs a store with its own customers; marketplace sellers do not own buyer data.

## 11. Collabs
- Affiliate links and discount codes; direct invites, open access or an application page; commissions billed through the Shopify bill; holding period 1 to 90 days (default 30) with auto-cancel on refund; 2.9% processing fee; creator payouts through Hyperwallet twice a month, $25 minimum, USD; not accepting new creator signups; manual payments ended 2024-01-08 (observed in help excerpts, help.shopify.com Collabs pages, date not shown).
- Used-goods tools: List Perfectly has a referral program (observed in excerpt, https://listperfectly.com/, date not shown).

## 12. Collective
- Connects Shopify stores as retailers and suppliers. Suppliers share price lists, public or private; retailers import products and keep margins of roughly 20% to 50%. Orders auto-forward to the supplier, who ships directly, with tracking synced back. Imported inventory is read-only, up to 100 variants, SKU required, placed in an app-created location. Free in supported countries. Supplier analytics: units sold, return rate, revenue. Collective orders cannot be edited or refunded; they are cancelled and re-placed, with automatic cancel if unpaid or if paid but not fulfilled within 14 days (observed in help excerpts, help.shopify.com Collective pages, date not shown).
- Used-unit meaning (inferred): dropship from a single-unit supplier is a "listed by someone else, sold by us" model; each unit would need a live existence check.

## 13. Markets and tax
- Markets: regions, B2B and in-person; local language and currency; fulfilment from the closest centre; own domains; per-market product and price selection and bulk editing on higher tiers (observed, https://www.shopify.com/markets, date not shown).
- Tax (US sales tax): liability insights by state with threshold warnings; rooftop precision across 11,000+ US jurisdictions; product-category suggestions; sales and tax views by state, county and local jurisdiction; reports for filing prep (observed, https://www.shopify.com/tax, date not shown).
- Used-unit meaning (inferred): marketplaces collect and remit sales tax in most US states, so the seller's tax need is mostly income records and the 1099-K threshold, which our spec already notes.

## 14. Payments and balance
- Cards, wallets, installments, crypto; 130+ currencies; "20% fewer chargebacks"; a view of sales and cash flow across online and in-store; Shop Pay "up to 50% higher conversion vs guest checkout" (vendor claim, asserted); Agentic Storefronts sell across AI chats (observed, https://www.shopify.com/payments, date not shown). Shopify Finance also lists Balance, Credit (pay-in-full Visa, up to 3% cashback), Capital and Bill Pay (observed, https://www.shopify.com/tax page footer, date not shown).
- Used-unit meaning (inferred): payouts come from each marketplace; the app can read and reconcile them but does not hold the money.

## 15. Capital
- No credit check; funds in as little as two business days; repaid as a percentage of daily sales; early renewal; offers inside the admin; "Since 2016" (observed, https://www.shopify.com/capital, date not shown).
- Used-unit meaning (inferred): needs a processor that sees daily sales; with payouts held by marketplaces the repayment mechanism has no equivalent. Stock-buying finance would depend on sourcing data.

## 16. Point of sale
- Single store, multiple stores or on the go (pop-ups, markets); integrated hardware and payments; staff management; omnichannel; receive transfers and orders; a sales-suggestion page finds non-selling stock (observed, https://www.shopify.com/pos, date not shown).
- Used-unit meaning (inferred): in-person sale of a listed unit (flea market, local pickup) must delist everywhere else, which our spec treats as local pickup.

## 17. App and channel model
- Marketplace Connect (first-party, formerly Codisto) connects Amazon, Walmart and eBay; orders, fulfilment, inventory and listings are managed in Shopify; bulk editing and attribute mapping per marketplace (observed, https://www.shopify.com/marketplace-connect, date not shown). Linking by SKU, UPC or title; 1% fee after 50 orders, capped at $99 a month (asserted, from a help excerpt, date not shown).
- Used-unit meaning (inferred): Shopify treats marketplaces as outputs of one catalog; Facebook Marketplace, Depop, Poshmark and Mercari are not in the list it shows.

## 18. Shop app (buyers)
- 400M+ verified shoppers; 49% of first-time-brand orders for orders placed 2025-05-01 to 2026-04-30; "no marketplace fees"; personalised product feed; cart syncing; real-time order tracking; collections, subscriptions and offers; checkout in Shop; campaigns that "acquire customers at a set cost, only pay for what converts" (observed, https://www.shopify.com/shop, date not shown).
- Used-unit meaning (inferred): the buyer-side record (orders across stores, tracking, follows) is the part that maps to our buy and watch features.

## 19. Resale and trade-in (Shopify App Store partners)
Observed in App Store listing excerpts; ratings and prices as shown at fetch, dates not shown.

| App | Price | What it does |
|---|---|---|
| Recommerce by Relished (https://apps.shopify.com/relished) | $89.70 a month | 30 items included, $2.99 each beyond; trade-in for cash or store credit; smart pricing; labels |
| Tern Trade-in (https://apps.shopify.com/tern-trade-in) | from $299 a month; $499 Resale tier | trade-in; automatic relisting and restock against the original SKU; works with Flow |
| Furloop (https://apps.shopify.com/furloop-buyback) | from $29 a month | consignment agreements, seller splits and payouts, gift-card payouts; publishes accepted stock and takes it down on sale |
| Resello (URL not recorded) | free to install, 5% per approved resale | trade in from order history, labels, condition pricing, one-click relist |
| Trash to Cash (https://apps.shopify.com/trash-to-cash-buyback-trade) | free plan, $9.99 and $19.99 a month | trade-in form, gift cards or discount codes |
| Diatome (https://apps.shopify.com/diatome) | free | resale, buyback, C2C marketplace on the store, mixed checkout, payouts |
| Circlestack (https://apps.shopify.com/circlestack) | from $299 a month | buyback online and in POS; grade, refurbish, republish; auto-generated listing content and pricing |
| SmartResell (apps.shopify.com/p2p-resale, inferred from a URL list, not read) | not read | brand-certified resale on the original product page; verification queue; audit log; prepaid label |

## 20. All-in-one used-goods seller tools (features only)
Vendor pages are observed in search excerpts unless marked. Dates not shown unless given.
- Vendoo (https://www.vendoo.co/pricing): crosslists to 10+ marketplaces; bulk import; templates; sale detection with auto-delist on Poshmark, eBay, Mercari, Depop, Whatnot and Etsy; bulk actions on up to 240 listings (Growth); profit tracking; Auto Send Offers to likers on 6+ marketplaces (Pro); sharing for Poshmark, Depop and Grailed; Depop refresh and Grailed bump; listing videos; mobile apps. Starter $14.99, Growth $29.99, Pro $59.99 a month. A "33% more sales" figure for regular relisters is a vendor claim (asserted).
- List Perfectly (https://listperfectly.com/pricing/; pricing article 2025-05-30 at https://listperfectly.com/tips/list-perfectly-pricing/; Poshmark dashboard article 2025-09-18 at https://listperfectly.com/tips/poshmark-tools-dashboard-list-perfectly/): custom titles per marketplace; Mark Sold ends listings elsewhere; Link Existing Listings; Custom Marketplaces; Google Lens and eBay comps price tools; barcode lookup; SKU generator; QR labels; Issue Finder; pick list; stale alerts; measurement templates; sales analytics with CSV; sub-accounts; Poshmark sharing, auto offers, follow-backs, captcha solving and a Stats view. Plans $29, $49, Pro, Pro Plus.
- Flyp (https://www.joinflyp.com/): crosslists to Poshmark, eBay, Etsy, Mercari, Facebook Marketplace, Depop and Vinted; Poshmark automation (scheduled and community shares, auto and bulk offers, follows); Offers page for bulk offers to likers; analytics; AI auto-fill. $9 a month flat (asserted via third-party comparison). A third-party piece (https://vylist.ai/crosslisting-app-pricing, July 2026) says Flyp has no true auto-delist and its consumer app was discontinued, which contradicts Flyp's own "Auto-Delist sold items" (asserted both ways).
- Nifty, OneShop, Crosslist, SellerAider: read only through comparison pages (https://crosslisty.com/best-crosslisting-apps, https://selleraider.com/crosslisting-app/, https://selleraider.com/free-crosslisting-app/ dated 2025-01-12, https://www.flipsail.io/blog/flyp-alternatives dated 2026-09-26), so all asserted, and SellerAider's page is its own comparison. Nifty (formerly Auto Posher): cloud-run sharing, relisting, offers, follows; tax-ready reports; $25 to $89.99 a month. OneShop: $45 a month; bots that relist, bump and share; sales graph with monthly goals; mobile only. Crosslist: $29.99 to $44.99 a month; auto-delist only on top two tiers. SellerAider: $12.99 and $29.99; auto-delist only on Pro; offers and sharing in a separate Grow subscription.
- Added to crosslister-teardown.md (inferred from reading it against these pages): the items new here are SKU and QR labels, pick lists, stale alerts, bulk-action limits, Poshmark stats dashboards, referral programs and the trade-in and consignment apps in section 19.

## 21. End table
Spec files are in [spec/features](../../../spec/features/). "Not covered" means a search of those 19 files found nothing.

| Suite capability | Shopify feature (link) | Meaning for one used unit on someone else's marketplace (inferred) | Our spec file |
|---|---|---|---|
| One record per product, quantity, cost, location | [Inventory](https://www.shopify.com/inventory-management) | one record per thing, quantity 1 or a lot, cost and place | [item-card.md](../../../spec/features/item-card.md) |
| Barcode and SKU lookup | [Inventory](https://www.shopify.com/inventory-management) | barcode to identity | [identify.md](../../../spec/features/identify.md), [capture.md](../../../spec/features/capture.md) |
| SKU generator, QR labels, pick lists | [Shipping pick lists](https://www.shopify.com/shipping) | shelf and bin label per unit | not covered |
| Import existing listings | [Marketplace Connect](https://www.shopify.com/marketplace-connect) | pull live listings into cards | [connect.md](../../../spec/features/connect.md) |
| Listing per channel from one record | [Marketplace Connect](https://www.shopify.com/marketplace-connect) | per-site plan and field rules | [list.md](../../../spec/features/list.md) |
| Bulk actions on many listings | [Marketplace Connect bulk edit](https://www.shopify.com/marketplace-connect) | edit, delist, relist many at once | partly, list.md (relists, revise); bulk limit not covered |
| Orders from all channels, delist on sale | [Shipping](https://www.shopify.com/shipping) | sale detection, delist elsewhere, ship-by | [sold.md](../../../spec/features/sold.md) |
| Shipping labels and rates | [Shipping](https://www.shopify.com/shipping) | buy label as an ask | [sold.md](../../../spec/features/sold.md) |
| Label insurance and carrier claims | [Shipping](https://www.shopify.com/shipping) | claims on lost or damaged parcels | partly, sold.md (claim window, evidence bundle) |
| Returns | Returns (help page not read; Collective excerpts) | one unit reopens | [sold.md](../../../spec/features/sold.md) |
| Unified customer inbox | not found as cross-channel | read all inboxes, answer from the card | [messages.md](../../../spec/features/messages.md) |
| Offers to likers and watchers | none at Shopify; Vendoo, Flyp | auto offers inside limits | [list.md](../../../spec/features/list.md), [messages.md](../../../spec/features/messages.md) |
| Poshmark share, follow, scheduled automation | none at Shopify; List Perfectly, Flyp, Nifty | background keep-alive actions | not covered |
| Stale-listing alerts | none at Shopify; Vendoo, List Perfectly | age-based nudge | partly, [price.md](../../../spec/features/price.md) (sell speed, recompute on stale comp set); alert not covered |
| User-defined automation | [Flow](https://www.shopify.com/flow) | rules over item and sale events | partly, [today.md](../../../spec/features/today.md) (auto log with undo); user rules not covered |
| AI assistant that stages changes | [Sidekick](https://www.shopify.com/sidekick) | staged actions with one approval | partly, [today.md](../../../spec/features/today.md) |
| AI listing text and photo edit | [Sidekick](https://www.shopify.com/sidekick) | title, description, background | [list.md](../../../spec/features/list.md), [studio.md](../../../spec/features/studio.md) |
| Email and SMS marketing | [Messaging](https://www.shopify.com/email-marketing) | message past buyers or followers | not covered |
| Ad audiences | Audiences (help pages) | needs own customer data | not covered |
| Affiliate and creator program | Collabs (help pages) | referral | not covered |
| Supplier network and purchase orders | [Collective](https://www.shopify.com/inventory-management) and purchase orders | sourcing record of what was bought and from whom | partly, [buy.md](../../../spec/features/buy.md) (purchase becomes an owned item with cost); suppliers not covered |
| Markets (region, currency) | [Markets](https://www.shopify.com/markets) | cross-border by marketplace | not covered |
| Sales tax by state | [Tax](https://www.shopify.com/tax) | income records and 1099-K threshold | partly, [insights.md](../../../spec/features/insights.md) (1099-K note, records); per-state liability not covered |
| Payments and balance | [Payments](https://www.shopify.com/payments) | read payouts, reconcile | partly, [insights.md](../../../spec/features/insights.md) (money lines by source) |
| Financing | [Capital](https://www.shopify.com/capital) | repay from sales | not covered |
| Point of sale | [POS](https://www.shopify.com/pos) | local sale, delist everywhere | partly, [sold.md](../../../spec/features/sold.md) (local pickup) |
| Buyer app: tracking, follows, feed | [Shop app](https://www.shopify.com/shop) | buyer-side orders and watches | [buy.md](../../../spec/features/buy.md), [watch.md](../../../spec/features/watch.md) |
| Trade-in, consignment, store credit | App Store resale apps (section 19) | taking in used units with payouts | partly, [appraise.md](../../../spec/features/appraise.md) (sell, trade in or donate); payouts and credit not covered |
| Analytics | other worker | covered elsewhere | [insights.md](../../../spec/features/insights.md) |
| Catalog | other worker | covered elsewhere | [market.md](../../../spec/features/market.md) |

## Searched / could not reach
- help.shopify.com Returns and Flow pages: bot wall ("Verifying your connection"). The shipping-labels help page timed out. Help-centre facts (Collective, Collabs, Audiences) come from search excerpts, not full pages.
- shopify.com/returns, /shopify-collective and /barcodes returned 404; /editions/summer2026 returned 404.
- Sidekick and Magic help pages not read; SmartResell not read; Resello URL not recorded.
- Nifty, OneShop, Crosslist and SellerAider vendor pages not read directly.
- Poshmark and eBay terms on automation were not checked.

## Not found
- A Shopify cross-channel unified inbox for customer messages.
- Facebook Marketplace, Depop, Poshmark or Mercari in Shopify's marketplace-connection list as shown on the page read.
- A page date on any Shopify marketing page.

## Sources fetched
- https://www.shopify.com/editions/fall2026, /shop, /shipping, /payments, /tax, /email-marketing, /markets, /pos, /flow, /capital, /marketplace-connect, /inventory-management, /sidekick (fetched 2026-11-14, dates not shown)
- help.shopify.com Collective, Collabs and Audiences pages (excerpts only)
- https://apps.shopify.com/relished, /tern-trade-in, /furloop-buyback, /trash-to-cash-buyback-trade, /diatome, /circlestack (excerpts)
- https://www.vendoo.co/, /pricing, /crosslister; https://listperfectly.com/, /pricing/, /tips/list-perfectly-pricing/, /tips/poshmark-tools-dashboard-list-perfectly/; https://www.joinflyp.com/; https://resellertools.zendesk.com/hc/en-us/articles/29303062009357-Why-Flyp-Reseller-Tools
- https://crosslisty.com/best-crosslisting-apps, https://selleraider.com/crosslisting-app/, https://selleraider.com/free-crosslisting-app/, https://www.flipsail.io/blog/flyp-alternatives, https://vylist.ai/crosslisting-app-pricing
- Repo: crosslister-teardown.md and the 19 files in spec/features
