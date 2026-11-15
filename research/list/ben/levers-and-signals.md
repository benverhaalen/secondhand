# As of November 2026, what pricing levers and seller signals does each posting site give, what does each do to visibility, and how should secondhand set defaults and show the signals side by side?
Researched 2026-11-15 by Ben (Claude Code, Opus 5.5; six research helpers in parallel, then a second round). Feature: list, price, insights.

Ben asked for this on 2026-11-15 ([words](../../../product/words.md#2026-11-15-pricing-levers-signals-and-hot-items)): "each platform has specific levers. this should also be a feature selling point. like depop you can discount. set defaults in the app for auto accepting", and "everything is relative. views correlate differently from likes, shares, offers".

Marks: *observed* = read on the page (URL and page date in [levers/levers.json](levers/levers.json)); *asserted* = a third party, a snippet or memory; *inferred* = our reasoning. Every row of the two tables per site lives once, with its source, in `levers.json`. This note explains them, corrects older notes and proposes the design. It builds on, and does not repeat: [platform-levers.md](../nate/platform-levers.md) (Nate), the per-site notes in [platforms/](platforms/) (sections 9, 10, 15), [analytics-and-recommendations.md](../../data/nate/analytics-and-recommendations.md) §2, and the cards [money D13 to D16](../../../spec/determinations/money.md#d13-listing-price) and [listing D15 to D20, D26](../../../spec/determinations/listing-and-marketing.md#d15-interest-against-plan).

## 1. Short answer

- **Every site has a different shape of offer tool, and the person's two lines map onto each one differently** (*inferred* from the rows below). eBay has two lines (accept above, decline below) and no auto-counter. Depop and Poshmark have one line that both accepts and counters. Mercari and Facebook have no auto-accept. So "Always accept $X or more" (decided at listing, [decisions](../../../product/decisions.md#2026-11-14-always-accept-is-offered-at-listing-and-only-unedited-approvals-count)) becomes eBay auto-accept, Depop auto-respond and the Poshmark Smart Sell minimum, and our own job answers the rest.
- **Never put the floor into a site tool that counters at its line.** Depop counters every offer under its line at exactly that line (*observed*, partner API guide). Set to the floor, every lowball learns the floor. Set to always accept, a counter never goes below it. Ben's [depop.md §15](platforms/depop.md#15-adapter-rules-agent-proposal) set it at the floor; this changes that.
- **A price drop is a different lever on every site, and the size matters.** Poshmark tells likers only when the drop is 10% or more below the lowest-ever price and ends at $10 or more (*observed*, price drop policy). Mercari's Promote needs 5% under the lowest price so far, tells every liker and boosts search (*observed*, article 347). Depop's Discount shows the old price struck through with a tag in search (*observed*). eBay's struck-through sale events need an eBay Store (*observed*, help 4094), so for most people an eBay drop is a plain edit. Facebook savers may be told; no Meta page says so (*asserted*).
- **The same word means different things.** Mercari "views" are impressions in search and feeds (*observed*, article 5001); eBay "views" are visits to the listing page (*observed*, traffic report docs). A Poshmark like is the audience for Offer to Likers and price-drop notices, so many likes are buyers waiting for a deal (*inferred*). Signals are compared within a site against listings like it, converted across sites through what each has taken to make a sale, and never summed raw.
- **Read routes.** eBay has an API for traffic (impressions, views by source, CTR, conversion; *observed*). Depop's gated partner API now returns likes, bag adds, pending offers and organic and boosted clicks and impressions, up to 60 minutes late (*observed*, changelog July 2026). Poshmark, Mercari and Facebook show their numbers only in the app or site, so the harness `read_stats` reads them from the seller's session.

## 2. Draft from memory, and what changed

Draft: each site has offers to likers at 10%, auto-accept at a floor, and views and likes per listing; Facebook gives sellers nothing. What changed: Depop and Poshmark tools counter at their line, so the floor must not go there; eBay's markdown tools are Store-only; Mercari reports impressions under the name "views"; Facebook does report views, clicks, saves and shares, in its Seller app and web Insights (*observed* for the app, Meta 2026-07-24); Depop buyer offers last 24 hours, not 14 days (*observed*, Make Offer page and API concepts page).

## 3. Pricing levers: what each does

Full rows with parameters and sources: `levers.json` → `sites.<site>.levers`.

| Lever | eBay | Depop | Poshmark | Mercari | Facebook |
|---|---|---|---|---|---|
| Auto-accept | above a line under Buy It Now | at or above one line | Smart Sell minimum, may still counter above it (a test) | none | none |
| Below the line | auto-decline with an email; buyer may offer again; no counter | countered at the line within about 60 s | countered | none | none |
| Offer to interested people | watchers and 2-day carts, 5% off, 30 most recent, 96 h | likers, bag-adders, people who messaged, 5% off; auto-send 1 h after a like or bag | every liker, 10% off and 10% under the 90-day lowest offer, shipping discount required, 24 h | 50 newest likers, 10% under the lowest price so far, 24 h, every 72 h; auto-send to new likers after a chosen delay | none |
| Public price drop | edit; watchers told: *asserted* | Discount: struck-through price, tag on the photo, icon in search | likers told when 10% or more under the lowest-ever price and $10 or more | Promote: 5% or more under the lowest so far, likers told, boosted in search, once a day | edit; savers told: *asserted*, unreliable |
| Timed sale | sale events, Store only | none | Closet Clear Out days | Time-limited Sale after 7 days, 3 days long, "Deals" section | none |
| Bundles | volume pricing, Store only | percent off 2 or more | My Seller Discount | buyer offers on several | none |
| Paid reach | Promoted Listings | Boost 12% on a sale within 28 days | Promoted Closet, per click | none found | Boost, budget or cost per sale |
| Freshness | none | none | 60 days with no edit, offer, bundle or comment makes a listing inactive and lower in search | none | Renew when offered; no published rule |

Visibility statements a site makes itself (*observed*): Mercari Promote and Time-limited Sale boost search; Poshmark prioritises active listings; Depop boosting is a ranking factor and adds a labelled tile; Meta's ranking uses price, saves, shares and recency, and boosts sit outside it (Nate's read of the ranking card, 2026-09-30). Nothing else here has a stated effect on rank.

## 4. Seller signals: what each site gives and how to read it

Full rows: `levers.json` → `sites.<site>.signals`. Stages are the funnel each signal sits in.

| Stage | eBay | Depop | Poshmark | Mercari | Facebook |
|---|---|---|---|---|---|
| Exposure | search and total impressions; top-20 share (CSV only) | organic and boosted impressions | impressions | "views" = impressions, daily | boost reach |
| Attention | page views by source; CTR | clicks; views in the app | clicks | clicks | views and clicks (Seller app) |
| Interest | watchers | likes (public) | likes (public) | likes | saves, shares |
| Intent | offers; carts (public label) | bag adds; pending offers | seller and buyer offers | offers | message threads |
| Outcome | conversion rate; transactions | orders; sales CSV | Posh Stats | Gross Sales Report | sold listings |
| Read by | Sell Analytics API, Trading API | partner API (gated), webhooks | harness | harness | harness |

Where each is thin: Poshmark does not define impressions or clicks; Facebook's numbers may be totals, not per listing (not stated); Mercari likes' public display was not checked; eBay watcher counts for one's own listings by API are *asserted* (Trading `GetMyeBaySelling`).

## 5. Why the signals are relative, and how to compare them

The evidence that a raw count does not travel: the same word names different events (Mercari views against eBay views, above); a like's meaning depends on what the site does with it (Poshmark and Mercari send offers and drop notices to likers, so liking is how a buyer asks for a deal, *inferred*; buyers waiting for markdowns are 5 to 19% of airline buyers in the one field estimate, Li, Granados and Netessine 2014, *observed* abstract); and base rates differ by orders of magnitude between stages.

Two references solved the same structure:

- **X's ranker** scores a post as the sum of weight times predicted probability of each action, with weights in a dated config ("can be adjusted at any time"). The 2026 code says the weights "reflect a combination of how much an action is valued in ranking and typical propensities of these actions", and that they "do not multiply raw engagement counts" (*observed*, `xai-org/x-algorithm` `home-mixer/params/param.rs`, synced 2026-11-10; 2023 weights in `twitter/the-algorithm-ml` `projects/home/recap/README.md`). Take: a rare action carries weight in proportion to its value over its base rate, and the weights are a config people own.
- **Pinterest** gave every action its own calibration model so probabilities from different actions are comparable (*observed*, Pinterest engineering blog). Take: a Depop like and an eBay watcher become comparable only once each is mapped to the same outcome, a sale, per site.

So, three readings, built in [levers/interest.mjs](levers/interest.mjs) with tests (*agent proposal*):

1. **Band**: each signal against listings like it on the same site, category, price position and age (this is [listing D15](../../../spec/determinations/listing-and-marketing.md#d15-interest-against-plan), applied per signal). Ahead, on or behind; nothing on a reference under 50 listings.
2. **Exchange rate**: per site and signal, how many of that signal one sale has taken, from finished listings (own first, pooled when the person consents). "On Depop, 22 likes per sale; on eBay, 3 watchers per sale." Hidden under 5 sales.
3. **Pull**: an item's signals converted to sales' worth through those rates. Within a site, the strongest signal counts, not the sum, since the same buyers like and offer; across sites the values add. Shown only as a relative measure, never as a probability, until the outcome model in the [ideas file](../../../ideas/hot-items-and-learned-pricing.md) calibrates it.

## 6. Design (*agent proposal*)

### Defaults set at listing

One rule: the person sets two lines once (or accepts money D14's), and each site's own tool gets the part it can act on instantly; our job handles the middle with money D16. The arithmetic is [levers/defaults.mjs](levers/defaults.mjs) (`node defaults.mjs 40 30 38` prints every site; 14 tests).

| Site | Offers | Likers | Price drops | Off by default |
|---|---|---|---|---|
| eBay | Best Offer on; auto-accept at always accept (under Buy It Now); auto-decline under the lower of the floor and 50% of the price | our job sends 5% offers to watchers and carts when the plan says (D17) | plain edit | eBay's own auto-offers to future interested buyers (one fixed discount forever); Promoted Listings |
| Depop | auto-respond at always accept, if that is at least 5% under the price | auto-send at 5% off, when that is at or above always accept | Discount tool, once the price has been live 7 days | Boost |
| Poshmark | Smart Sell minimum at always accept, where the account has it | Offer to Likers at 10% off with the $4.99 shipping discount, by our job | drops of 10% or more under the lowest-ever price | Promoted Closet |
| Mercari | our job answers within minutes | Auto Offer to Likers at 10% off, when at or above always accept | Promote, 5% or more | Smart Pricing (its drops lower the bar every later Promote must clear) |
| Facebook | our job answers in chat within minutes | none | edit, in one real step | Boost; availability auto-reply on |

Why each choice:

- **eBay decline at 50%**: on eBay the mean first offer is 61% of the list price and the most common is 50%; 45% of bargaining threads end in a sale, and after a decline buyers come back only 37% of the time (Backus, Blake, Larsen and Tadelis, QJE 2020, 25.5M threads, *observed*). A 55% offer should get our counter, not an eBay decline.
- **Answer within minutes**: when a seller takes twice as long to counter, sales fall 4.4%, and under $30 buyers counter 9% less (Fong and Waisman, Management Science 2025, 5.9M eBay negotiations, *observed* via Kellogg Insight). Sites without an auto tool depend on our job's speed.
- **Counter at the midpoint, never the floor**: midpoint counters are accepted 5 to 10 points more often (Backus et al., *observed*). [Money D16](../../../spec/determinations/money.md#d16-offer-response) now counters at `max(floor, midpoint)` and makes an offer under the floor an ask (Nate's change, 2026-11-15); this evidence moves its midpoint from *asserted* to *observed*. Since asks are slow and slow replies lose sales (next bullet), eBay's auto-decline at 50% keeps the clear lowballs from becoming asks.
- **First offer to likers at the site minimum**: some likers wait for a deal (above); a small first offer keeps room for the next rung and the 7-day cooldown in [listing D17](../../../spec/determinations/listing-and-marketing.md#d17-offer-to-likers-or-watchers) stays.
- **Struck-through prices only after 7 days live**: a former price shown must have been openly offered "for a reasonably substantial period" ([16 CFR 233.1](https://www.law.cornell.edu/cfr/text/16/233.1), *observed*). 7 days is our starting value. This can be a check in `.agents/checks/` once the app writes prices.
- **Stagger drops**: sale signs lose force as more items carry one (Anderson and Simester 2001, field test, *observed* abstract). Cap the share of a person's live items on one site with a visible drop in the same week at about 25% (a starting value).
- **Room above target** stays money D13's learned `d` per site; the priors in `levers.json` (eBay 9%, Depop, Poshmark and Mercari 15%, Facebook 9% at $20 and over) come from Ben's per-site notes.

How it is shown (*agent proposal*, for the `ui-screen` pass): at listing, under "Always accept $X or more", one row per chosen site in that site's own words: "eBay: accepts $38 or more, declines under $21", "Depop: accepts $38 or more, counters lower offers at $38", "Mercari: likers get $42 after an hour". Tap a row to change it. This is the selling point Ben named: one decision, set natively on every site.

### Showing the signals

| Where | What | Why |
|---|---|---|
| Sell tab tile | the furthest stage reached across sites, as a count: "2 offers", else "9 likes", else nothing | an offer outranks any number of views (`strongest` in interest.mjs); views alone are not worth the space |
| Item page, "How it's doing" | one row per site, columns by stage (seen, opened, kept, acted), raw counts in each site's own words; only a cell that is behind plan gets a color | color only where attention should go ([copy.md](../../../product/copy.md)); raw counts stay honest; the band carries the comparison |
| Item page, under it | the next move from listing D16 named as the site's lever: "Send 6 Depop likers $42" | the lever is the action the signal calls for |
| Tap any cell | the site's definition, when it was read, and the curve for listings like it with this one's line | every number opens its citation ([insights](../../../spec/features/insights.md)) |
| You tab, By site | the exchange rates: signals per sale on each site from the person's own sales | answers "everything is relative" with their own numbers |

Read cadence (*inferred* from latency): eBay traffic and Depop insights hourly; Poshmark, Mercari and Facebook through the harness once a day with the `check_due` sweep, since Mercari updates daily and each read costs a session.

## 7. Corrections to older notes

- [platform-levers.md](../nate/platform-levers.md): Depop buyer offers last 24 hours (Make Offer page and API concepts page, *observed* 2026-11-15), not 14 days. Send Offer expiry is still open: 24 hours in the API docs, 14 days on the help page Nate read. eBay offers to interested buyers do have an API (Negotiation), against "only in-app flows documented". Sale events and markdowns are on eBay help 4094, Store only.
- [analytics-and-recommendations.md](../../data/nate/analytics-and-recommendations.md) §2: Facebook seller insights exist (Seller app, *observed* 2026-07-24); Mercari defines views (impressions) and clicks, daily (article 5001); Depop's partner API has per-product insights since July 2026; OfferUp insights are account-level daily charts, not per item (*observed*, help 18954475383060).
- [platforms/ebay.md §9](platforms/ebay.md#9-pricing-and-offers): "can repeat every 48 hours" is eBay's batch pace for its automated offers, not a seller allowance; auto-accept and auto-decline stop during sale events; a declined buyer gets an email and may offer again.
- [platforms/poshmark.md §9](platforms/poshmark.md#9-pricing-and-offers): offer expiry and binding are now *observed*; the drop notice needs 10% under the lowest-ever price and $10 or more; Offer to Likers shipping is none, $4.99 or free.
- [platforms/mercari.md §10](platforms/mercari.md#10-promotion-and-boosts): article 347 names no Price Drop badge; Time-limited Sale also notifies interested buyers.
- [platforms/facebook-marketplace.md §10](platforms/facebook-marketplace.md#10-promotion-and-boosts): "7 days old, up to five times" for Renew comes from one blogger (autobook, 2026-08-19); Facebook publishes no rule.

## 8. Not found, and what limited this

A shared limit of about 100 page reads an hour cut each helper's run short; facebook.com/help and support.poshmark.com refuse automated readers. Not settled: whether eBay watchers or Facebook savers are told of a price drop; Depop Send Offer expiry; Mercari like-count display and whether a private offer sets its "lowest price"; Poshmark Smart Sell availability; Facebook insights per listing or total; any measured comparison of offers to likers against public drops (listing D17's own test is the only route). A narrow search does not show these are absent. The helpers' round-by-round notes are not committed (scratch); their findings with sources are in `levers.json` and this note.
