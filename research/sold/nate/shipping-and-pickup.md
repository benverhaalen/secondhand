# As of November 2026, how does an item physically get from seller to buyer on eBay, Facebook Marketplace, Depop, Poshmark and Mercari, and what can software do to make shipping and pickup effortless and correct?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: sold.

Evidence note. Several help centers (Poshmark, Depop, Mercari topic pages, Facebook) returned 404 or 403 to direct fetch. Where a claim says "observed (search highlight)" I saw the official page's text only as a search-engine excerpt and did not open the full page; treat the full page as unopened. Pages marked "pointer only" are blogs and only point to a source. Most help pages carry no date; "undated" means the page showed none.

## 1. Per-marketplace shipping model

### eBay
- Prepaid label: eBay Labels buys USPS, FedEx and UPS labels from Orders or Seller Hub; tracking uploads to the order automatically and the buyer address is auto-loaded. Label formats 8x11, 4x6, 2x7 (USPS only). Options: signature, extra coverage, irregular-package flag. Observed (search highlight), https://www.ebay.com/help/selling/shipping-items/labels-packaging-tips/buying-printing-shipping-labels?id=4157, undated.
- Own label allowed: yes, tracking number plus carrier code is uploaded to the order. Observed (search highlight), https://developer.ebay.com/api-docs/sell/static/orders/handling-unfulfilled-lineitems.html, undated.
- Flat-rate tiers: seller picks Standard, Freight (oversized) or Local pickup only, with flat or calculated cost. Observed (search highlight), https://www.ebay.com/help/selling/shipping-items/setting-shipping-options?id=4089, undated. No eBay-defined weight-tier price table was captured.
- Limits: USPS free home pickup excludes single packages over 130 in length plus girth or over 70 lb. Observed (search highlight), https://www.ebay.com/help/selling/shipping-items/handing-off-packages-shipping-carriers?id=5118, undated. Freight labels do not come from eBay Labels; they come from the freight carrier (same id=4089 page).
- Who pays: seller chooses flat or calculated; the cost type is a listing setting (id=4089). Which side pays is not stated beyond that. Inferred.
- Ship-by and penalty: handling time runs from payment to carrier acceptance scan; 1-day handling means scan by 11:59:59 p.m. the next day. Observed (search highlight), https://www.ebay.com/sellercenter/shipping/preparing-your-shipment/handling-time, undated. Top Rated maximum late-shipment rate is 3%; USPS holidays are not counted as shipping days. Observed (search highlight), https://www.ebay.com/sellercenter/shipping/faqs, undated. A late-shipment defect is removed if tracking was uploaded before the latest estimated delivery date and the acceptance scan fell within handling time; auto-removal takes up to 72 hours; appeals within 90 days. Observed (search highlight), https://www.ebay.com/help/selling/selling-seller-performance/appeal-defect?id=4871, undated.
- Tracking: required; signature required at $750 or more. Observed (search highlight), https://www.ebay.com/help/policies/selling-policies/selling-practices-policy?id=4346, undated. An item-not-received claim goes to the seller if tracking shows delivery to the address (plus signature at $750 or more). Observed (search highlight), https://www.ebay.com/sellercenter/protections/defect-removal, undated.
- QR drop-off: yes. The QR is emailed; weight, dimensions, carrier and service are still required first; USPS, FedEx and UPS offer it but each location must support it; weights and dimensions should be rounded up to whole numbers; up to 100 labels print at once. Observed (search highlight), https://www.ebay.com/sellercenter/shipping/faqs, undated.
- Local pickup: buyer pays at checkout and receives a QR plus a 6-digit code; seller scans or enters it, status becomes "Picked up", funds are usually available within 48 hours. Seller sees username and approximate area; exact address is shared after payment via Messages. Authenticity Guarantee and age-verified items are excluded. eBay advises offering 2 time slots and meeting in public. Observed (search highlight), https://www.ebay.com/help/selling/shipping-items/setting-shipping-options/local-pickup?id=4181, undated. Buyer side: Money Back Guarantee applies and payment can include cash. Observed (search highlight), https://www.ebay.com/help/buying/shipping-delivery/changing-delivery-address-method/local-pickup?id=4056, undated. The scan creates a "Picked Up" tracking event. Observed (search highlight), eBay Innovation post, 2020-07-06.
- Local delivery: not found as a distinct eBay option.
- Large items: "Freight" shipping method and "Local pickup only" add-on for large or hard-to-ship items (id=4089). Freight weight and size thresholds were not captured.

### Facebook Marketplace
- Prepaid label: prepaid labels ended for new listings 2025-02-24 and are now offered to "select sellers", quoting Meta's help page. Observed, https://www.valueaddedresource.net/facebook-marketplace-ends-pre-paid-shipping/, published 2025-02-11, updated 2025-09-28 (a blog quoting Meta; Meta's own page returned 404).
- Own label: allowed; switching to your own label cannot be reverted (same source). Without a Meta label Marketplace has no shipment record, so tracking is sent in Messenger (smklog.com, undated, pointer only).
- Flat-rate tiers: not found.
- Limits: access to prepaid labels can be removed for declared weight below actual weight, or USPS dimensions over 12x12x12 in (valueaddedresource, above). 50 lb limit and 3 business days to ship per ListingForge, 2026-01-27 (pointer only, unverified against Meta).
- Who pays and fees: 10% fee including shipping, 2.9% processing, payout about 5 days after delivery (ListingForge, pointer only). Local sales carry no Meta fee (FLUF, undated blog, pointer only).
- Seller Protection: needs a Meta label, onsite checkout, tracking, item price $500 or less, carrier receipt within 7 days; fee 10% with a $0.80 minimum (I'd Ship That, 2026-05-26, pointer only).
- Carriers on Meta labels: UPS and USPS only (smklog.com, pointer only).
- QR drop-off, penalty for late shipping, tracking rules: not found from an official page.
- Local pickup: the default for local listings; payment is arranged by the parties (no Meta fee for local sales, FLUF pointer). No handover-code mechanism was found. Meta's Scam Protection Center lists scam types only and gives no meetup guidance. Observed, https://www.meta.com/safety/scam-protection-center/marketplace-trust-safety/, undated.
- Large items: not found.

### Depop
- Prepaid label: USPS via Depop Shipping gives a QR plus a printable label. Observed (search highlight), https://depophelp.zendesk.com/hc/en-gb/articles/16523051318033-Shipping-on-Depop-US, undated.
- Own label: from 2026-10-28 the "Other" option is closed for new listings; existing "Other" listings stay until they sell or are relisted. "Other" needs tracking entered within 10 days and cannot be amended. A non-Depop label forfeits Depop Protection (same page).
- Flat-rate tiers, weight and size limits: not found.
- Ship-by and penalty: unshipped orders auto-cancel after 10 days with refund (same page). Depop Protection for sellers covers sales up to $300, needs a Depop label within 5 days, and excludes meet-in-person sales. Observed (search highlight), Depop zendesk article 360001845367, undated. An "I haven't received my order" issue can be raised after 5 days; the seller has 48 hours to prove shipment or refund. Observed (search highlight), zendesk 360001772448, undated.
- Local pickup: meeting in person is not covered by Depop; help text says never go alone, use public places, get proof of delivery in chat. Observed (search highlight), zendesk 360001901728, undated.
- Payout: 2 business days after delivery (Sellura, 2026-10-03, pointer only).
- Large items: not found.

### Poshmark
- Prepaid label: pre-addressed label by email; QR at USPS; free USPS pickup; a $5 USPS fee for Priority packaging from 2025-10-12. Observed (search highlight), https://poshmark.com/posh_guide/how_to_ship, undated. Buyer pays the $6.49 label (Rollo, 2025-06-21, pointer only); label moved to USPS Ground Advantage 2025-09-12 (PoshSidekick, 2026-08-13, pointer only).
- Own label: allowed, but own labels are not reimbursed for loss. Observed (search highlight), https://support.poshmark.com/s/topic/0TO1I000000kJqqWAE/faqs, undated.
- Weight tiers: standard label covers up to 5 lb; 5.1 to 10 lb costs $5.00; 10.1 to 15 lb costs $10.00; seller pays the difference. Observed (search highlight), https://blog.poshmark.com/2026/02/13/shipping-heavier-items-on-poshmark-is-now-simpler-and-cheaper/, 2026-02-13.
- Overweight rule change: announced 2026-10-08, effective 2026-10-26, overweight costs are deducted from seller earnings; 15.01 to 25 lb is a $15 deduction; over 25 lb is the full USPS cost; maximum single label is 15 lb. Observed (search highlight), https://www.valueaddedresource.net/poshmark-ends-overweight-shipping-protection/, 2026-10-17. Upgrade path: Account, My Sales, "Need New Shipping Label" / "Need Heavier Weight Label". Observed (search highlight), https://poshmark.com/posh_guide/how_to_get_overweight_shipping_label, undated.
- Ship-by and penalty: 7 days to ship; the buyer can cancel from day 8 (support FAQ above). Other sources in the search results said day 14 or 21; these conflict (the 2026 Poshmark FAQ excerpt is the one cited here).
- Payout: funds released within 3 days of delivery; auto-received if no report within 3 days (support FAQ).
- Terms: Poshmark may discontinue labels at any time. Observed (search highlight), https://www.poshmark.com/privacy, undated.
- Local pickup: not found.
- Large items: label cap of 15 lb (above); no furniture channel found.

### Mercari
- Prepaid label: USPS, UPS, FedEx labels; limits 50 lb actual or dimensional weight, 34 in longest side, 20 in second-longest. Observed (search highlight), https://www.mercari.com/us/help_center/article/6000/, undated.
- Own label: allowed, but a valid tracking number is required or the transaction may be canceled (same page).
- Economy services: FedEx Ground Economy up to 10 lb; UPS Ground Saver up to 5 lb; both max 1,728 cubic in and longest side at most 22 in (same page).
- Who pays: seller picks buyer-pays or free shipping. Observed (search highlight), https://www.mercari.com/us/help_center/topics/shipping/guides/shipping-for-sellers/, undated. Wrong weight class: seller pays the extra cost, can be deducted from balance (article 6000). Dimensional divisor 139 (20x12x8 in = 13 lb); over 1 lb rounds up to the next pound; overage charged to seller. Observed (search highlight), https://www.mercari.com/us/help_center/article/334/, undated.
- Ship-by: within 3 business days, then tap "I Shipped It" (article 6000). Penalty text not captured. A "8% penalty" for inaccurate entries appears in a 2026-06-04 onlinesc guide (unverified, pointer only).
- QR drop-off: works for USPS Ground Advantage, Priority, Media Mail, First-Class Envelope and UPS Ground / Ground Saver, at a staffed Post Office or UPS Store; labels print 8.5x11 or 4x6 (article 6000).
- Protection: shipping protection up to $200 ($20 for the First-Class Envelope) (article 6000). Weight can be edited via "edit label" then "Recreate"; packages cannot be rerouted (seller guide above).
- Local pickup: conflicting sources. FLUF (undated blog) says Mercari Local ended November 2024 and Mercari is ship-only; CartCompare (2026-09-21 blog) says no local pickup; Vendoo help (https://help.vendoo.co/en/articles/6812651-how-do-i-set-up-local-pickup-on-mercari, 2026-07-09, observed search highlight) says a local pickup option exists in the listing form but is not available to all users or areas. Mercari Meetup Beta terms: LA and NYC area codes only, off-platform payment, no Mercari protection. Observed (search highlight), https://www.mercari.com/us/help_center/topics/trust/policies/meetup-terms-of-service/, undated.
- Fees: 10% on item plus buyer-paid shipping; buyer protection 3.6% (CartCompare, 2026-09-21, pointer only).
- Large items: 50 lb / 34 in cap; no furniture channel found.

## 2. Label and rate APIs

| Provider | What it needs | Usable for marketplace orders? |
|---|---|---|
| eBay Logistics API | Restricted limited release, whitelisted via Application Growth Check; payment method on file; 4x6 label; USPS only. Endpoints under `https://api.ebay.com/sell/logistics/v1_beta/`: POST /shipping_quote, GET /shipping_quote/{id}, POST /shipment/create_from_shipping_quote, GET /shipment/{id}, GET /shipment/{id}/download_label_file, POST /shipment/{id}/cancel. Response: shipmentTrackingNumber, labelDownloadUrl, rate.pickupType. | eBay orders only. Observed (search highlight), https://developer.ebay.com/api-docs/sell/logistics/overview.html, undated. |
| eBay Fulfillment API | POST `https://api.ebay.com/sell/fulfillment/v1/order/{orderId}/shipping_fulfillment`; body lineItems, shippedDate (ISO 8601 UTC), shippingCarrierCode plus trackingNumber. Alphanumeric tracking only; eBay cannot verify it; 201 with Location header, no body; one tracking number per line item; line items cannot be moved afterward. Status values NOT_STARTED, IN_PROGRESS, FULFILLED. | eBay orders; takes tracking, buys no label. Observed (search highlight), https://developer.ebay.com/api-docs/sell/fulfillment/types/sel:ShippingFulfillmentDetails and the handling-unfulfilled-lineitems page above. |
| Shippo | POST https://api.goshippo.com/shipments/ with address_from, address_to, parcels (length, width, height, distance_unit, weight, mass_unit, or `template`); header `ShippoToken`; US addresses auto-validated; then POST /transactions with rate, label_file_type, async. Pickups for USPS and DHL Express on shipments already created. Observed (search highlight), https://docs.goshippo.com/guides/generate-shipping-label and https://docs.goshippo.com/spec/shippoapi/public-api.yaml. Pricing, free to 30 labels a month then $17 a month, from Cotlet 2026-10-24 (pointer only). | Buys a label from the seller's own account; no built-in eBay order link; tracking would be sent through eBay Fulfillment API. Inferred. |
| EasyPost | Shipment needs to_address, from_address, parcel; rates auto-populate. Weight in OUNCES, always required; dimensions in inches to 1 decimal; or `predefined_package`. `buyer_address` defaults to to_address. Statuses: unknown, pre_transit, in_transit, out_for_delivery, delivered, available_for_pickup, return_to_sender, failure, cancelled, error. Observed (search highlight), https://docs.easypost.com/docs/shipments and https://docs.easypost.com/docs/parcels. | Same as Shippo: label purchase is independent of the marketplace. Inferred. |
| Pirate Ship | "Pirate Ship doesn't offer an API." Observed (search highlight), https://support.pirateship.com/en/articles/2309246-does-pirate-ship-have-an-api, 2024-06-13. Its integrations page (2026-06-09) lists an eBay integration that imports orders and writes tracking back, plus spreadsheet upload. Cotlet (2026-10-24, pointer only) says no API, MCP or webhooks; wrappers use a private GraphQL. | Manual or spreadsheet upload only; no documented programmatic path. |
| USPS | Web Tools API retired 2026-01-25 (https://www.usps.com/business/web-tools-apis/). New portal https://developers.usps.com/apis, OAuth with Consumer Key and Secret, base apis.usps.com; test environment `https://apis-tem.usps.com/labels/v3/label` with watermarked labels. Domestic Labels 3.0 outputs PDF, TIFF, SVG, JPG, ZPL203DPI, ZPL300DPI. Domestic Prices 3.0 takes ZIPs, weight, dimensions, processing category, mail class, extra services. Default product covers OAuth, Addresses, Pricing, Locations, Service Standards, Shipping Options, UserInfo, Tracking; Labels and Pickup need a request to USPS. All observed (search highlight), undated. | Own-label purchases only; prepaid marketplace labels are not exposed. Inferred. |
| UPS | OAuth2 client credentials; prod `https://onlinetools.ups.com/api`; CIE `https://wwwcie.ups.com/api`. Observed (search highlight), https://github.com/UPS-API/api-documentation/blob/main/Pickup.yaml, undated. Label API details not captured. | Own account. Inferred. |
| FedEx | Ship API needs account number, pickup type, service type, packaging type, shipper, recipient, payment type, weights, label spec. Observed (search highlight), https://developer.fedex.com/api/en-us/catalog/ship/docs.html, undated. | Own account. Inferred. |

Marketplaces other than eBay: no seller API for buying their prepaid labels was found for Facebook, Depop, Poshmark or Mercari (not found; absence of a search hit does not prove absence).

## 3. Carrier pickup-scheduling APIs
- USPS Carrier Pickup 3.0: free, next delivery day Mon to Sat; Priority Mail Express, Priority Mail, First Class Package Service Commercial, international, returns; operations check availability, schedule, change, cancel, inquire. Observed (search highlight), developers.usps.com, undated.
- UPS: rate at /shipments/{version}/pickup/{pickuptype}; create at /pickupcreation/{version}/pickup (v2409); needs account number, ReadyTime, PickupDate, PickupAddress, PickupPiece. Observed (search highlight), UPS-API Pickup.yaml above.
- FedEx Pickup Request API: check availability (cutoff and access time), create (account number, origin, carrier), cancel; Express and Ground. Observed (search highlight), https://developer.fedex.com/api/en-us/catalog/pickup/docs.html.
- EasyPost: POST /v2/pickups with min_datetime, max_datetime, shipment, address, instructions; returns PickupRates that must then be purchased; carriers FedEx, Lasership, LSO, Ontrac, USPS. Observed (search highlight), https://docs.easypost.com/docs/pickups.
- Shippo: pickups with USPS and DHL Express (above).
- eBay's own guidance: USPS free home pickup needs at least 1 day's notice, free in about 98% of ZIPs; FedEx and UPS pickup needs an account (id=5118 page above). Poshmark offers free USPS pickup (how_to_ship page).

## 4. Dimensional weight
- On 2026-07-12 USPS changed the divisor from 166 to 139; each side rounds UP to the next inch; result rounds up to the next pound; applies only to parcels over 1,728 cubic in (1 cubic ft) in zones 1 to 9; dimensional weight over 70 lb pays the 70 lb price; round or non-rectangular parcels use a 0.785 factor. Source of the change: USPS Governors' Decision 26-2 (Federal Register, 2026-05-14), asserted via Supply Chain Dive 2026-05-18, shippingforsellers.com 2026-10-02 and resellerindex.com (quoting DMM 283.1.4.2, read 2026-10-19), all pointer-level; I did not open the Federal Register text.
- UPS Daily Rates and FedEx use 139 on any size; UPS Retail Rates (UPS Store) use 166 (pointer, shippingforsellers 2026-10-02). The same source says eBay applies 166 to UPS and FedEx labels bought through eBay and 139 to USPS (asserted, unverified).
- Conflict: some USPS pages still print 166 (QSG 120) and DMM 223.1.4.3 lags (pointer sources).
- Mercari states its own divisor of 139 (article 334, above).
- Worked example, inferred: 20x12x8 in = 1,920 cubic in, over 1,728, so 1,920/139 = 13.8, rounds to 14 lb under the USPS rule; Mercari's page says 13 lb for this box, so the rounding method differs between the two statements. Not resolved.

## 5. Packaging from measured dimensions
- Padding allowances: 0.25 in soft goods, 0.5 in rigid, 2 in fragile (sellerdesklab.com, undated, pointer only, asserted).
- Poly mailer sizes W x L in inches: 6x9, 7.5x10.5, 9x12, 10x13, 12x15.5, 14.5x19, 19x24, 24x24; stock boxes 6x4x4 to 24x24x24, 36 sizes (same source, pointer only).
- USPS flat-rate box interiors (Teal Packaging, pointer): Small 8 5/8 x 5 3/8 x 1 5/8; Medium top-loading 11 x 8 1/2 x 5 1/2; Medium side-loading 13 5/8 x 11 7/8 x 3 3/8; Large 12 x 12 x 5 1/2. Corrugated outside dimensions add about 1/16 in (E-flute) or 1/8 in (B-flute).
- Garment weights (Local Threads, 2026-04-12, pointer only): light tee 3.9 to 6.4 oz by size; midweight tee 4.9 to 8.3 oz; fleece hoodie 13.5 to 22 oz (Large 16.8 oz, crossing 1 lb); poly mailer 0.3 to 0.5 oz; small box 4 to 6 oz. USPS Ground Advantage bands under 1 lb: 0-4, 4.1-8, 8.1-12, 12.1-15.99 oz. atoship (2026-03-03, pointer): tee 6-8 oz, jeans 1-2 lb, dress 8-12 oz; poly mailers avoid dimensional weight.
- No official garment-weight source was found. Garment fold allowance: no sourced fold-to-flat dimension rule was found; folded size is therefore *inferred* from measured flat dimensions plus the padding above.
- Platform thresholds a box choice interacts with: Facebook USPS dimensions over 12x12x12 in can cost label access; Mercari 34 x 20 in; Mercari economy 1,728 cubic in and 22 in; Poshmark 15 lb label cap.
- eBay asks that weight and dimensions be rounded up to whole numbers (faqs page).

## 6. Address handling (who sees the buyer address)
- eBay shipped order: label purchase auto-loads the buyer address; seller sees it in order details after payment (eBay community thread, 2025-03-26, forum, observed search highlight). eBay local pickup: seller sees only username and approximate area until payment, then address via Messages (id=4181).
- eBay INFORM Consumers Act: at $20,000 annual revenue a high-volume seller's name and address show to buyers; a residential address shows state and country only. Observed (search highlight), https://www.ebay.com/sellercenter/resources/inform-consumers-act, undated.
- Mercari: buyer address is visible on Order Status only while the transaction is in progress (article 6000).
- Depop: address is locked after purchase; seller cannot edit; the fix is cancel and repurchase (Closo, 2025-11-25, pointer only).
- Poshmark and Facebook: buyer address visibility not found. Poshmark seller return address appears on the label (hipsterfashion, 2024, pointer only).
- EasyPost and Shippo both take full `to_address`; a tool that buys a label itself must read the address, which these platforms either expose briefly (Mercari) or load into their own label flow (eBay, Poshmark, Depop). Inferred.

## 7. Calendar integration
- Google Calendar events.insert: start/end.dateTime (RFC3339) with timeZone, location (free text), description, extendedProperties.private and .shared, client id (base32hex, 5 to 1024 chars), reminders.overrides (max 5; method email or popup; minutes 0 to 40320), eventType. Observed (search highlight), https://developers.google.com/workspace/calendar/api/v3/reference/events/insert, undated. OAuth scopes were not read.
- Apple EventKit: iOS 17+ offers requestWriteOnlyAccessToEvents() and requestFullAccessToEvents(); old requestAccess(to:) is deprecated and with the iOS 17 SDK does not prompt; Info.plist keys NSCalendarsWriteOnlyAccessUsageDescription and NSCalendarsFullAccessUsageDescription; EKEventEditViewController needs no permission; write-only access can create but not read events; authorization statuses include .writeOnly and .fullAccess. Observed (search highlight), https://developer.apple.com/documentation/technotes/tn3152-migrating-to-the-latest-calendar-access-levels.md and https://developer.apple.com/documentation/eventkit/accessing-calendar-using-eventkit-and-eventkitui.md, undated.
- Inferred: write-only access means the app cannot check for an existing event or edit one it did not keep an identifier for; Google's client-supplied event id allows idempotent create.

## 8. Published safe-meetup guidance
- DC Metropolitan Police: Safe Exchange Zones at every district station; meet in daylight; tell someone; inspect item; avoid advance payment, wire transfers, gift cards. Observed (search highlight), https://mpdc.dc.gov/page/online-purchases, undated.
- Fairfax County PD: Safe Exchange Zone parking spots under 24-hour video, lobby also available; 10 tips including "bring a friend" and "don't share home address". Observed (search highlight), https://fcpdnews.org/2026/07/27/shop-smart-meet-safe-tips-for-online-buying-and-selling/, 2026-07-27.
- Gaithersburg PD: two marked spaces under video, 8am to 9pm daily, lobby available; police will not witness or broker exchanges; "Be cautious of anyone who changes the meeting location". Observed (search highlight), https://www.gaithersburgmd.gov/services/police-services/internet-purchase-exchange-location, undated.
- Platform guidance: eBay says offer 2 slots and meet in public (id=4181); Depop says never go alone and use public places (zendesk 360001901728).
- The FTC statement on wire transfers, gift cards and crypto is quoted from a blog (marketplaceapp, 2026-10-06, pointer); the FTC page itself was not opened. AARP (2024-01-16) and fliplab (2026-10-23) are unopened pointers.

## 9. Handover states, deadlines and failure cases (all *inferred* from sections 1 to 8)

States per sale, shipped path: paid, label pending, label made, handed to carrier (acceptance scan), in transit, delivered, funds released. Local path: paid or agreed, slot proposed, slot confirmed, met, code scanned or goods inspected, closed. A sale can also be canceled, returned or disputed from most states.

Deadline clocks that differ by platform (from section 1):
- eBay: handling time from payment to acceptance scan (1 to 3 business days per missing-features note); Pacific Time cutoffs for the auto 5-star rating.
- Mercari: 3 business days. Facebook: 3 business days (pointer). Poshmark: 7 days. Depop: 5 days for protection, 10 days to auto-cancel. Note these are counted from payment (eBay, Mercari) or order (others); the start event differs by platform and was not always stated.
- Payout clocks: eBay local about 48 hours after scan; Poshmark 3 days after delivery; Depop 2 business days after delivery; Facebook about 5 days after delivery (pointer).

Failure cases and what the sources say about each:
- Buyer no-show at pickup: eBay payment already taken, so funds are held until the code is scanned (id=4181); off-platform deals (Facebook, Mercari Meetup) have no platform record. What a canceled no-show does to the seller's metrics was not found.
- Label error (wrong address, wrong weight class): Mercari weight can be edited and recreated, packages cannot be rerouted; Depop address is locked, fix is cancel and repurchase; Poshmark has a "Need New Shipping Label" path; eBay labels can be voided through its label flow (not captured). Shippo, EasyPost, USPS and UPS each have their own void or refund windows, which were not captured.
- Wrong-weight surcharge: Mercari charges the seller, deducted from balance; Poshmark deducts from earnings from 2026-10-26; Facebook can remove label access; USPS dimensional rounding up per side (section 4) raises billed weight even when scale weight is under.
- Lost parcel: eBay seller is protected by tracking showing delivery (plus signature at $750 or more); Depop protection needs a Depop label within 5 days and sales up to $300; Poshmark does not reimburse own labels; Mercari protection up to $200; Facebook Seller Protection needs a Meta label and carrier receipt within 7 days (pointer). In every case the own-label path loses protection on at least one platform.
- Tracking not accepted: eBay cannot verify tracking numbers; Mercari cancels if tracking is invalid; Depop "Other" tracking cannot be edited.
- Cross-listed item sold twice: shipping deadlines of the sale that completes first are the only ones that matter; this is a design consequence, not a sourced rule.

## 10. Confirm, extend, contradict against existing notes
- [product/walkthrough.md](../../../product/walkthrough.md) line 163 says eBay, Depop, Poshmark and Mercari issue their own labels. Extends and partly contradicts: confirmed for the four, but Depop "Other" (own label) closes for new listings on 2026-10-28, Facebook prepaid labels are limited to select sellers, and Poshmark prepaid labels cap at 15 lb with overweight deducted from 2026-10-26.
- [product/walkthrough.md](../../../product/walkthrough.md) lines 161 to 181: the app picking box and weight, a "ship by" card and a nearest drop-off point. Extends: the ship-by clocks differ by platform and start event (section 9); QR drop-off exists on eBay, Mercari and Depop (section 1), and Poshmark's how_to_ship page mentions a QR at USPS.
- [product/walkthrough.md](../../../product/walkthrough.md) police safe-exchange zones (asserted there): confirmed as observed for three police departments (section 8).
- [product/walkthrough.md](../../../product/walkthrough.md) pickup option C (windows plus a saved meetup spot) and calendar event on Confirm: extends with Google events.insert and EventKit write-only access constraints (section 7).
- [product/decisions.md](../../../product/decisions.md) line 62 and lines 65 to 73 ("Never alone" for address, pickup time, payment, off-platform deals): extends. eBay shares the exact address only after payment via Messages (id=4181), and Mercari shows it only while the transaction is in progress, so an address the app stores may outlive the platform's own visibility.
- [research/cross-cutting/ben/missing-features.md](../../cross-cutting/ben/missing-features.md) line 12 (eBay handling time 1 to 3 business days, Poshmark prepaid labels): confirms Poshmark prepaid; extends handling time with the 3%, 11:59:59 p.m. and holiday rules. Line 29 (M13 combined shipping) and line 31 (M15): not researched here; Poshmark's "Purchase Additional Labels" button and eBay's one-tracking-number-per-line-item rule are the shipping-side facts. Line 36 (M20 safe in-person selling): confirms and extends with section 8. Line 56 (platform rules change often): confirmed by three changes within 2026-07 to 2026-10 (USPS divisor, Poshmark deduction, Depop "Other").
- [research/measure/ben/build-plan.md](../../measure/ben/build-plan.md) lines 153 and 155 (rigid items get L x W x H for shipping box), line 163 (LiDAR box method), line 182 (dimensions shape l_mm, w_mm, h_mm): extends. The plan has no box-selection step; sections 4 and 5 give the rounding-up per side and the 1,728 cubic inch threshold that a millimetre measurement must be converted through, and EasyPost takes inches to 1 decimal with weight in ounces.

## Not found
- Official Meta/Facebook help text on prepaid labels, flat rates, ship-by penalty, QR, large items (help page returned 404).
- Buyer-address visibility for Poshmark and Facebook.
- Poshmark local pickup.
- Depop parcel-size tiers, weight limits and flat rates.
- eBay Freight weight and size thresholds; eBay local delivery.
- An official source for garment weights or fold allowances.
- UPS and FedEx label endpoint paths, USPS OAuth scopes, Google Calendar scopes.
- Label void and refund windows for any carrier.
- The Federal Register text of USPS Governors' Decision 26-2.
- A resolution of the Mercari local pickup conflict.

## Searched / could not reach
- Searched: Exa web search across eBay, Mercari, Poshmark, Depop and Facebook help text, carrier developer docs, USPS dimensional-weight news, packaging suppliers, police exchange-zone pages, Apple and Google calendar docs.
- Could not reach by direct fetch: Poshmark and Depop help pages (404), Mercari help topic (403), Facebook help (404). The eBay page id=4081 was a link hub only.
- A narrow search does not prove something does not exist; every "not found" above is a search result, not a confirmed absence.

## Sources fetched
No source was read in full via direct fetch except a few pages whose text I saw as search highlights; the list below is by URL, all as observed (search highlight) unless marked pointer.
- eBay: help ids 4346, 4157, 4089, 5118, 4871, 4181, 4056; sellercenter pages handling-time, faqs, defect-removal, inform-consumers-act; developer.ebay.com logistics overview, fulfillment pages.
- Mercari: help_center articles 6000, 334, shipping-for-sellers, meetup-terms-of-service; help.vendoo.co 6812651.
- Poshmark: posh_guide how_to_ship and overweight page; support FAQ; blog 2026-02-13; poshmark.com/privacy; valueaddedresource.net 2026-10-17.
- Depop: zendesk 16523051318033, 360001845367, 360001772448, 360001901728.
- Facebook: valueaddedresource.net 2025-02-11 (updated 2025-09-28); meta.com scam protection center.
- APIs: docs.goshippo.com, docs.easypost.com (shipments, parcels, pickups), support.pirateship.com, developers.usps.com, usps.com web-tools notice, github.com/UPS-API, developer.fedex.com ship and pickup.
- Calendar: developers.google.com events.insert; developer.apple.com TN3152 and EventKit article.
- Meetup: mpdc.dc.gov, fcpdnews.org, gaithersburgmd.gov.
- Pointer-only blogs: TrackCaptain, FLUF, CartCompare, onlinesc, ListingForge, I'd Ship That, smklog, Closo, Sellura, Rollo, PoshSidekick, hipsterfashion, Cotlet, Supply Chain Dive, shippingforsellers, smartlogisticscalc, resellerindex, sellerdesklab, Teal Packaging, Local Threads, atoship, marketplaceapp, AARP, fliplab.
