# Beyond what is specified, what could an app that knows a person's items, listings, buyers and wants do for them on its own, and is each possible and wanted as of November 2026?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: cross-cutting.

## Method and limits

- Read first: the 17 files in `spec/features/`, `research/cross-cutting/ben/missing-features.md`, `user-wants.md`, `business-pieces-and-repos.md`, `research/cross-cutting/nate/crosslister-teardown.md`, `research-session-digest.md`. Entries below are only what those files do not cover or cover thinly. Line cites are given where I re-checked a line this window (grep of `spec/features` 2026-11-14); other overlap statements are *inferred* from my earlier read, not re-opened.
- "Observed" below means: the page text came through an Exa search highlight on 2026-11-14 (a search extract, not a full page fetch), or a live API call I made. Anything I did not open is "unopened". Vendor self-description is *asserted*. Tool and API terms expire; re-check before building.
- No secret is recorded. The PriceCharting docs page shows a demo token; I did not copy it.
- Nothing here is a recommendation to cut or defer.

## Where this confirms, extends or contradicts existing notes

- Extends `spec/features/appraise.md:15` and `:71`: appraise already lists "recalls if any" and a `recalls[]` field. It does not name a source, a legal duty, or a block at capture/listing. Section "Before listing", feature B1.
- Confirms `user-wants.md:21` (principle 1, donate is a first-class outcome, 60.1% donated vs 21.6% resold, Kijiji 2016): the donation and trade-in routes below give that principle outside services to hand off to. Nothing found sets the sell-versus-donate threshold (`user-wants.md:38` stays open).
- Updates `user-wants.md:32` (principle 12, 74% trust, 9% autonomous buying): a Salesforce survey dated 2026-11-12 reports 76% not interested in an agent buying for them and 19% of agent users using one at checkout (see G5). It supports "find and hold, person taps Buy"; it does not contradict it.
- Confirms `user-wants.md:25` and `:31` for every feature below that acts: the person's tap stays on anything with money, identity or an outward message.
- Extends `spec/features/item-card.md:65` (what the person paid): receipt capture and mileage are the only way found to fill cost basis and tax records without asking (F1, F2).
- No existing file I read names trade-in or buyback services, Activation Lock, pickup scheduling by carrier or hauler, Form 8283 thresholds, travel-time or weather, or store-calling (grep of `spec/features` for those terms returned only the lines cited above). *Inferred*: these are uncovered.

## A. Before listing: what to sell, sell vs trade in vs donate, timing

### A1. Trade-in and buyback quote beside the sell estimate
- Does for the person: shows what a buyer-of-record would pay now, with no listing, no messages and no shipping.
- Trigger and action: item identified as phone, laptop, console, tablet or similar; the app fetches quotes and shows them next to the per-site net on Appraise.
- Data needed: product id, storage or spec, condition grade. Held: product and condition from identify (inferred).
- Outside service and terms: Gazelle has a price promise when the device matches the stated condition and a 30-day return policy; its affiliate program (ShareASale and Partnerality) pays up to 8% on certified pre-owned with a 30-day cookie and is free to join (observed, https://buy.gazelle.com/pages/help-sell-general, undated page). SellCell compares 40+ buyers (observed, https://www.sellcell.com/blog/sellcell-expands-comparison-platform-with-major-us-tech-buyers/, updated 2026-03-02). No public quote API for Gazelle or SellCell found; a secondary post (2026-09-23) says Gazelle may have an API v2 workflow (asserted, unverified). Back Market has trade-in and an API (asserted, EuropeanStack 2026-03-11, secondary). Decluttr US operations shut in 2025 and EcoATM kiosks pay 57-71% of market value, both from a competitor's marketing page (asserted, BuyBackBear 2026-06-26). Carrier trade-in is bill credits over 24-36 months (same source, asserted).
- Stays the person's decision: whether to ship the device, and accepting a re-quote after inspection.
- Main risk: the payout depends on inspection, and quote locks are about 48 hours (asserted, laptopjudge 2026-09-23); a stale quote shown as "you keep $x" misleads. Buyer sites are closed businesses that can change terms.
- Evidence people want it: not found as a stated wish. Price shopping across buyers exists as a business (SellCell), which is behavior (observed, above).

### A2. Recall and safety screen before an item is offered for sale
- Does: tells the person an item cannot legally be sold, before they photograph more or list it.
- Trigger and action: identify returns a brand and model for a product class CPSC covers; the app queries recalls and blocks listing with a plain reason, or warns for unstable baby gear.
- Data: brand, model, manufacture date range. Held after identify (inferred).
- Service and terms: CPSC Recall REST API, JSON or XML (https://www.saferproducts.gov/RestWebServices/Recall; docs https://www.cpsc.gov/Recalls/CPSC-Recalls-Application-Program-Interface-API-Information). Live call 2026-11-14 returned 200 with no key (observed, RecallNumber 26639, RecallDate 2026-07-23). Law: selling any recalled product is illegal under CPSA Section 19 (15 U.S.C. 2068), including secondhand by a consumer in an online marketplace, and the seller is responsible for knowing (observed, https://www.cpsc.gov/Business--Manufacturing/Business-Education/ResaleThrift-Stores-Information-Center/Stop-Online-Sale-of-Recalled-Products). It is unlawful even if the item is in good shape (observed, https://www.cpsc.gov/About-CPSC/Division-of-Field-Operations/FAQs-For-Buying-and-Selling-Products-Online). Resellers Guide: do not sell broken or unstable nursery and durable infant products even if not recalled; no testing duty (observed, https://www.cpsc.gov/s3fs-public/Resellers-Guide-Updated-Final-3-3--21.pdf, 2021).
- Stays the person's: what to do with the item (dispose, remedy from the maker, keep).
- Risk: model matching is fuzzy; a false block frustrates, a miss leaves legal exposure with the seller. US only; other regions have other lists (not searched).
- Wanted: not found as a seller wish. The duty is stated by the regulator.

### A3. Sell, trade in, consign, donate or haul: one routed answer
- Does: for each item, names the route that fits its value and bulk, and starts it.
- Trigger and action: appraise finishes with a low net or a bulky item; the app offers the route and prepares it (label, pickup request, quote request).
- Data: appraised net, size or weight (measure), category, location. Held (inferred).
- Services and terms: ThredUp Clean Out has Standard, Premium or Donation, a free label or bag, optional Uber pickup ($5.99 shown), accepts 60-80% of items in Standard, about 38% of accepted items do not sell, 10-14 weeks, an 80% price-edit cap in Premium, a $5.99 reclaim fee for unaccepted items, and no men's clothing or jewelry (observed, https://www.thredup.com/cleanout, undated). AptDeco: buyer requests, seller confirms pickup time, AptDeco does pickup, delivery and assembly in the contiguous US (observed, https://www.aptdeco.com/how-it-works); a 2024 blog says it takes up to 60% of revenue (asserted). 1-800-GOT-JUNK?: free in-person estimate, no deposit, same-day available, priced by truck volume, donates usable items (observed, https://www.1800gotjunk.com/us_en/furniture-donation); no public quote API found. Charity pickup varies: of 10 Goodwills checked, 3 free pickup, 2 free and paid, 4 via ReSupply paid, 1 none; trucks refuse mattresses, large appliances and old TVs (asserted, donatefurniturepickup.org 2026-10-16, secondary).
- Stays the person's: the route, and any fee.
- Risk: none of these exposes an API I could find, so each is a hand-off link or a form fill, not an automated action (inferred). Terms differ by city.
- Wanted: yes for the donate side, via `user-wants.md:21`. Direct wish for routing: not found.

### A4. Timing: hold an item for its season, or list now
- Does: tells the person the month an item sells best and the cost of waiting.
- Trigger and action: item in a seasonal category (coats, patio, skis, costumes); the app proposes a list date and sets a reminder.
- Data: category, sold history by month. `appraise.md:71` carries `price_history:[{month, median_cents, basis_count}]` (observed in repo), so monthly medians exist in the design.
- Service: Google Trends API is alpha, application-only, 5-year window (asserted, dev.to 2026-11-14, secondary); only unofficial scrapers otherwise, which return 429s (same source). PriceCharting gives current prices only, no history, with an internal-use license and written permission needed to show data to others (observed, https://www.pricecharting.com/api-documentation).
- Stays the person's: waiting versus selling now.
- Risk: waiting conflicts with "stuff gone first" (`user-wants.md:21`); season signal from own sold data may be thin.
- Wanted: not found.

## B. While listed

### B1. Buyer-location travel time and weather for a pickup
- Does: shows how far a buyer is and whether the slot is wet or dark.
- Trigger and action: a pickup is proposed; the app attaches drive time and the forecast to the card and flags a bad slot.
- Data: the saved public spot and buyer area. Held in part (appointment table, `data.md:25`).
- Services: Google Routes API pay-as-you-go, Essentials $5 per 1,000 after 10,000 free calls a month, Pro $10 per 1,000 (5,000 free), traffic-aware requests billed higher (asserted, scrap.io Oct 2026 summary of https://developers.google.com/maps/documentation/routes/usage-and-billing, summary only). NWS API: free, no key, User-Agent required, rate limit not public (observed earlier this session).
- Stays the person's: confirming the slot.
- Risk: sending a buyer's location to a third party is a privacy cost; NWS is US only.
- Wanted: not found.

### B2. Price-watch drops tied to a plan (extends P4)
Already specified in `user-wants.md:24` (plan agreed once). No outside service needed; not repeated.

### B3. Competitor-listing watch for the same item
- Does: warns when a nearly identical item lists cheaper nearby.
- Trigger and action: new local or same-site listing matching the product id; the app shows it and the "You keep" effect of matching.
- Data: product id, price. Held.
- Service: marketplace search terms differ per site; not checked here.
- Stays: any price change.
- Risk: scraping terms. Wanted: not found.

## C. With buyers

### C1. Auto-answer "is this available?"
Marketplaces now ship this: Meta AI auto-reply to "Is this still available?" toggled per listing, AI-drafted listing, local price suggestion, tone options, prepaid labels (observed, The Verge 2026-03-12; Value Added Resource 2026-03-16, both through search extracts). eBay's AI Assistant drafts replies from the listing only, opt-in, "Edit and send" or "Dismiss" (observed, https://www.ebay.com/sellercenter/news/2025-august/ai-responses). Confirms `user-wants.md:25` (P5) and the messages spec; not a new feature here.

### C2. Buyer scam and overpayment screen
Covered by P9 (`user-wants.md:29`). Extension: the FTC names fake payment notices, overpayment and verification-code requests (asserted per `user-wants.md:29`, unopened by me).

### C3. Translate a buyer's message
- Does: shows and answers a foreign-language message.
- Trigger and action: message language differs; the app shows a translation and a drafted reply.
- Data: message text. Held.
- Service: translation APIs not checked (see Not found).
- Stays: sending. Risk: wrong translation of a price or place. Wanted: not found.

## D. After sale

### D1. Pickup scheduling for shipped sales
- Does: books the carrier pickup so the seller does not go to the post office.
- Trigger and action: label bought; the app requests pickup for the next delivery day.
- Data: address, parcel weight, service, count, package location. Held in part (order, label).
- Service: USPS Package Pickup is free next delivery day for Priority Mail Express, Priority Mail and Ground Advantage; request by 2:00 AM CT; Schedule API takes name, address, phone, service type, count, weight and package location; Pickup On Demand is paid and web-only (observed, https://www.usps.com/business/web-tools-apis/package-pickup-api.htm). Web Tools retired 2026-01-25 (observed, https://www.usps.com/business/web-tools-apis/documentation-updates.htm); replacement "Carrier Pickup 3.0" at https://developers.usps.com/carrierpickupv3 (page body not read); registered users get the APIs free (asserted).
- Stays: the pickup request, since it puts a carrier at a home address.
- Risk: API migration state; home address exposure. `user-wants.md:21` and `:23` support "1 trip to the post office" as value.
- Wanted: not found as a quote. Reduced effort is P2/P3 in kind.

### D2. Donation receipt and Form 8283 helper
- Does: after a donate hand-off, stores a receipt record and tells the person if a form is triggered.
- Trigger and action: item marked `kept` with reason donate (`item-card.md:80`) or donated via route; the app logs date, charity, estimated value, photos.
- Data: item, photos, appraised value. Held.
- Rules: no deduction for clothing or household items unless good used condition or better; Form 8283 required over $500 per item or group; Section A covers $500-$5,000; Section B and a qualified appraisal over $5,000; a single item not in good used condition claimed over $500 needs an appraisal; value is what buyers pay in consignment or thrift shops (observed, https://www.irs.gov/publications/p561 and https://www.irs.gov/instructions/i8283, both 12/2025).
- Stays: valuation and filing. Risk: tax advice liability; it is US only.
- Wanted: not found; the 21.6/60.1 split (`user-wants.md:21`) shows donation is the main outcome.

### D3. Packaging supplies and box sizing
- Does: tells the person which box size and how much tape, and could order it.
- Data: measured dimensions and weight (measure).
- Service: ordering APIs for packing supplies not found (see Not found).
- Wanted: not found.

## E. Money and records

### E1. Receipt capture to cost basis
- Does: reads a receipt or order email and fills what was paid.
- Trigger: photo of a receipt (held in `capture.md:32`, `identify.md:15`) or connected email.
- Service: Gmail connection needs Google restricted-scope review; ResellIQ states its Gmail sync is "in review with Google" (asserted, vendor listing). Terms not opened.
- Stays: confirmation of the match. `user-wants.md:30` says never ask what they paid in the pricing flow; that is a conflict to resolve by keeping the field optional (`item-card.md:65`).
- Risk: email scope is the heaviest permission in the set. Wanted: Flippd offers receipt scan, auto mileage and Schedule C reports (asserted, Google Play listing updated 2026-11-09).

### E2. Mileage log for drop-offs and pickups
- Does: records trips to the post office, charity and buyer meets for tax.
- Data: device location (new data); a seller-side opt-in.
- Service: none needed; Flippd does auto mileage (asserted, above).
- Stays: whether location is tracked. Risk: location data. Wanted: asserted by a vendor feature, not a stated user wish.

### E3. Profit and aging inventory report
Flippd lists AI Coach and aging inventory (asserted). Overlaps the You tab in `item-card.md:65`; not new.

## F. Buying side

### F1. Price watch and back-in-stock for wants
- Does: watches listings for a want and holds the match.
- Services in market: Google agentic checkout tracks price by size, color and budget, buys only after confirmation (observed, https://blog.google/products-and-platforms/products/shopping/agentic-checkout-holiday-ai-shopping/, 2025-11-13). Google Universal Cart (2026-05-19) watches price drops and back-in-stock and uses AP2 mandates and spending guardrails (asserted via secondary). Amazon Rufus has memory, price tracking and auto-buy (2025-11-18, asserted).
- Stays: the Buy tap, budget, size. Confirms `user-wants.md:32`.
- Evidence of want: Salesforce 2026-11-12 survey of 2,500+ shoppers in US, UK, CA and AU: 76% not interested in an agent buying for them, 19% of agent users used one at checkout, 9% give unrestricted financial access, 36% use a separate card, 27% say an agent bought something too expensive, most give up after 2-3 mistakes, top barriers are data sharing and unwanted charges (observed, https://www.salesforce.com/news/stories/ai-first-holiday/, plus Fathom and PPC Land summaries).
- Risk: some paid-checkout attempts failed: OpenAI Instant Checkout was shut in March 2026 after Walmart reported 3x lower in-chat conversion (asserted, ppc.land timeline).

### F2. Agent calls a local seller or store for availability
- Does: asks a store for stock and price and sends a summary.
- Service: Google "Let Google Call" (observed, same Google blog, 2025-11-13). No equivalent for private sellers found.
- Stays: authorising any call. Risk: calling on a person's behalf needs disclosure rules (not checked). Wanted: not found.

### F3. Stolen-device and Activation Lock check before buying a phone
- Does: warns before a person pays for a locked or blacklisted device.
- Service: CTIA Stolen Phone Checker is powered by GSMA Device Check; red means "Reported Lost or Stolen", green means not on the GSMA block list at the time (observed, https://www.stolenphonechecker.org/spc/faqs.jsp). It is a consumer web form; up to 5 free queries a day, and a clean IMEI does not prove no Activation Lock, carrier lock or unpaid financing (asserted, RottenWiFi 2026-09-30). No public API found. Activation Lock is checked on the device: do not take ownership of a locked device, and the check ends at the Hello screen without a prior-owner prompt (observed, https://support.apple.com/en-us/108794, 2026-04-29, and https://support.apple.com/en-us/104999, 2026-03-16). No remote status API found.
- Stays: the purchase. Risk: scripted checker use likely breaches its terms (inferred, terms not opened). The app could prompt a manual check with a script for the meetup (inferred).
- Wanted: Apple's own pages advise it; no user wish found.

## G. Safety

### G1. Same checks for the seller
- A seller handing over a phone should reset and sign out of the Apple account; Apple's pages above state the lock behaviour (observed). Covered by nothing in the specs I re-checked (inferred).

### G2. Meetup protections
Covered by P9 (`user-wants.md:29`). Extension candidates (share live meet details with a contact; travel time from B1) have no source here.

## Ten features marked inferred, best value against risk and new data needed

All are *inferred* from the evidence above. Ranking is my judgement; the operator decides.

1. A2 recall screen: free keyless API (observed), legal duty stated by regulator, data already held after identify.
2. D2 donation receipt log: no new outside service, uses held data, rules observed in IRS text.
3. D1 carrier pickup request: free USPS service (observed), reduces a stated pain (P2); only migration risk.
4. A3 route chooser with hand-off links for donate and consign: aligns with P1; needs no API, just links.
5. F3 phone-check prompts, buy and sell: no API needed, manual script; observed Apple guidance.
6. A1 trade-in quote links: affiliate path observed for Gazelle; only links, no stored quote.
7. B1 travel time and weather on a pickup: metered but cheap, free tiers observed second-hand.
8. F1 price watch on wants with a Buy tap: confirmed by Google, Amazon and the Salesforce data; the person decides.
9. E1 receipt capture to cost basis: capture already stores receipts; skip the email scope to avoid review.
10. A4 seasonal timing from own sold data: no outside service; weak want evidence.

## Not found

- Reseller forum wish quotes (r/Flipping, r/Reselling, eBay, Poshmark, Mercari communities) for any feature above.
- A public quote API for trade-in buyers, junk haulers or charity pickups.
- A public remote API for Activation Lock or CTIA IMEI checks.
- Packaging supply ordering APIs, and carrier pickup APIs beyond USPS (EasyPost, Shippo not checked).
- Gmail restricted-scope terms, Google Calendar terms, translation API terms.
- eBay Terapeak access terms; Mercari's ChatGPT app (unopened); Apple trade-in terms.
- A threshold for sell versus donate (matches `user-wants.md:38`).

## Searched / could not reach

- Tried: Exa searches on CPSC, CTIA, Apple, Gazelle, SellCell, ThredUp, AptDeco, 1-800-GOT-JUNK?, IRS, USPS, PriceCharting, Google Trends and Routes, Salesforce, eBay, Meta, reseller apps. CPSC pages `/Resale-Round-Up` and `/Resale-Stores-and-Online-Marketplaces` returned 404; the pages cited were used instead.
- Most pages were read as search extracts, not full fetches, so quoted figures from them carry that limit. CPSC Recall API was called directly.

## Sources fetched

- https://www.saferproducts.gov/RestWebServices/Recall (live call, 200, no key)
- https://www.cpsc.gov/Business--Manufacturing/Business-Education/ResaleThrift-Stores-Information-Center/Stop-Online-Sale-of-Recalled-Products
- https://www.cpsc.gov/About-CPSC/Division-of-Field-Operations/FAQs-For-Buying-and-Selling-Products-Online
- https://www.cpsc.gov/s3fs-public/Resellers-Guide-Updated-Final-3-3--21.pdf
- https://www.stolenphonechecker.org/spc/faqs.jsp
- https://support.apple.com/en-us/108794 and https://support.apple.com/en-us/104999
- https://buy.gazelle.com/pages/help-sell-general
- https://www.sellcell.com/blog/sellcell-expands-comparison-platform-with-major-us-tech-buyers/
- https://www.thredup.com/cleanout
- https://www.aptdeco.com/how-it-works
- https://www.1800gotjunk.com/us_en/furniture-donation
- https://www.irs.gov/publications/p561 and https://www.irs.gov/instructions/i8283
- https://www.usps.com/business/web-tools-apis/package-pickup-api.htm and .../documentation-updates.htm
- https://www.pricecharting.com/api-documentation
- https://blog.google/products-and-platforms/products/shopping/agentic-checkout-holiday-ai-shopping/
- https://www.salesforce.com/news/stories/ai-first-holiday/
- https://www.ebay.com/sellercenter/news/2025-august/ai-responses and https://www.ebayinc.com/stories/news/ebay-makes-selling-easier-with-a-new-camera-first-experience/ (2026-11-11)
- Secondary or unopened: donatefurniturepickup.org, RottenWiFi, laptopjudge, BuyBackBear, EuropeanStack, dev.to, scrap.io, ppc.land, The Verge, Value Added Resource, Flippd Google Play listing, https://developers.usps.com/carrierpickupv3 (body not read).
