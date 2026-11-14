# How do we post on Mercari (US) so it sells, and what belongs there?
Researched 2026-11-14 by Ben (Claude Code research helper). Feature: list.

Feeds the Mercari adapter: its listing rules and which product types to send or keep away. Posting route, sale detection and delist are in [crosspost-and-delist.md](../crosspost-and-delist.md) and are not repeated here.

Marks: *observed* = opened today (through a fetch summarizer, so wording is from its excerpts). *asserted* = a source claims it, or memory, or seller folklore. *inferred* = my reasoning. **The shared fetch budget ran out after 15 page reads**, so some rules are *asserted* from memory and listed at the end for a re-check.

## 1. Short answer

1. **Price cuts are the only boost a seller can trigger, and they are free.** Promote (5% drop), Offer to Likers (10%) and Time-limited Sale (10%) each raise visibility. Each new one must undercut the item's lowest price so far *observed*. So the list price must carry padding for a planned ladder.
2. **Shipping is entered as weight and box size, and it sets the buyer's total.** The 10% selling fee and the buyer's 3.6% fee both apply to buyer-paid shipping *observed*. Wrong weight is charged back to the seller *observed*.
3. **Send the right things.** Mercari's growth comes from collectibles and trading cards, with fashion second *observed*. Small, light, under about $50 fits best *asserted*.
4. **Fill brand, category and condition.** Mercari says these raise search visibility *observed*.
5. **Photos: up to 12, plain background, natural light, every side and every flaw** *observed*. Square cover *asserted*.
6. **Edit, do not relist.** Mercari says search favors "genuine updates rather than listings that are frequently deleted and relisted" *observed*. Duplicates are removed and "excessive reposting" is prohibited *observed*. This is the opposite of seller folklore.
7. **The seller counts, not only the listing.** Mercari names sales in a rolling 90-day window, low cancellations and returns, a verified profile and fast replies as search signals *observed*.
8. **Frequent cancellations cost money and rank**: 5% of the item price, up to $25 *observed*. That is the price of a double sale.

Biggest difference from the other platforms: no paid ads found and no sharing chore *asserted*. Visibility is bought with price drops, and each must go under the last *observed*. And furniture, bicycles, major appliances and motorized items cannot use national shipping *observed*.

## 2. Draft from memory, and what changed

Draft (before searching): 10% seller fee since January 2025, no processing fee, buyers pay nothing extra. Instant Pay $3, direct deposit $2 under $10. Title 80, description 1,000, 12 photos, 3 hashtags. Promote needs a 5% drop. Offer to Likers needs 5 to 10%. Mercari Local is gone. Returns were opened to any reason in 2024. Mercari US is shrinking and might close.

What changed:

1. **Buyers do pay a fee**: a 3.6% Buyer Protection fee on item price plus buyer-paid shipping *observed*. The seed "dropped the buyer protection fee" is wrong.
2. **Direct deposit is free at any amount** since 2025-01-06. The $2 only applies to a failed deposit *observed*. The "$2 under $10" rule is gone.
3. **The 10% selling fee also applies to buyer-paid shipping** *observed*.
4. **Mercari US is growing again.** Fiscal 2026 GMV $810 million, up 11%. April to June 2026 GMV up 15%, monthly active users 4.2 million, up 4%. New US CEO since 2026-07-01 *observed*.
5. **Three price tools**, including a Time-limited Sale that was not in the draft *observed*.
6. **Label rates changed on 2026-10-19.** UPS and FedEx economy, once a flat $7.97, are now tiered. Trading cards up to 1 oz ship free until 2027-01-04 *observed*.
7. **A "Meetups (beta)" help page exists** *observed* (title only). Local is not fully dead.
8. **Price cap $2,000, or $5,000 with Authenticate.** A fee for frequent cancellations exists *observed*.
9. **The conduct page bans "any robot ... or other automated means"** unless Mercari provides the interface, plus stock photos and "excessive reposting" *observed*. That bears on our Browser Use route and on relisting.
10. **Smart Offers may be gone** (VAR headline, unread), though a help page still names it.
11. **Mercari published its search signals**, and they disfavor delete and relist *observed*. The seed "search heavily favors new listings" is seller folklore that Mercari's own page argues against.

## 3. Who buys here and what sells

| Fact | Value | Evidence |
|---|---|---|
| US GMV, fiscal 2026 (July 2025 to June 2026) | $810 million, up 11%. Still about 20% under fiscal 2023 ($1.015 billion) | *observed* ([VAR, 2026-08-10](https://valueaddedresource.net/mercari-q4-2026-earnings/), from Mercari's earnings) |
| US GMV, April to June 2026 | $208 million, up 15% | *observed* (same) |
| US monthly active users | 4.2 million, up 4% | *observed* (same) |
| US profit | Core operating profit ¥2 billion in fiscal 2026. First full-year profit was fiscal 2025 (¥900 million) | *observed* (same, and [VAR 2025-08-06](https://www.valueaddedresource.net/mercari-us-first-ever-full-year-profit/)) |
| Staff and owners | About 45% of US staff laid off in 2024. Jeff LeBeau is US CEO from 2026-07-01. Still owned by Mercari, Inc. (Japan), which said it is "continuing to operate in the US" and is open to partners | *observed* ([VAR 2026-06-13](https://www.valueaddedresource.net/mercari-names-jeff-lebeau-us-ceo/)) |
| What drives growth | "Entertainment & Hobbies (especially collectibles and trading cards)". Fashion is the next focus, with a Fashion Exchange returns pilot | *observed* (VAR 2026-08-10, 2025-08-06) |
| Japan link | A "Mercari Global App" opened Japan listings to US buyers in June 2026 | *asserted* (headlines only: [VAR](https://www.valueaddedresource.net/mercari-opens-global-app-to-us/), [Digital Commerce 360](https://www.digitalcommerce360.com/2026/06/19/mercari-launches-us-app/)) |
| Buyer demographics | Not confirmed today. Seller blogs describe a mostly female, parent-heavy, bargain-minded buyer | *asserted* (memory, folklore) |
| Typical order | Not published for the US. Mercari's holiday promo gives free shipping on orders of $50 or more ([VAR headline](https://www.valueaddedresource.net/mercari-free-holiday-shipping/)), which suggests the usual order sits under $50 | *inferred* |

What sells, by seller consensus *asserted* (Vendoo, Closo, Nifty "what sells" posts, not opened today): Funko, Squishmallows, anime and K-pop goods, Pokemon and sports cards, LEGO, video games and consoles, beauty, women's mall brands, kids clothing lots, small home goods. Speed of sale: no platform figure found.

## 4. Money

All from Mercari's fee page, "Updated 10/23/2026" *observed* ([Fees on Mercari](https://www.mercari.com/us/help_center/article/169/)), and its [fee FAQ](https://www.mercari.com/us/help_center/article/2518/).

| Fee | Amount | Who pays |
|---|---|---|
| Listing | Free | n/a |
| Selling fee | 10% of item price plus buyer-paid shipping | Seller |
| Payment processing | None on listings made or edited since 2025-01-06 | n/a |
| Buyer Protection fee | 3.6% of item price plus buyer-paid shipping | Buyer |
| Direct deposit | Free, once a day, arrives within about 5 business days. $2 for a failed deposit | Seller |
| Instant Pay | $3 per cash-out, up to $600 a month, once a day, about 30 minutes | Seller |
| Cancellation fee | 5% of item price, capped at $25, for frequent cancellations, after warnings | Seller |
| Mercari Authenticate | $5. Certificate $10 | Seller |
| Promote, Offer to Likers, Sale, Smart Pricing | No fee stated. The cost is the price cut | Seller |
| Carrier corrections | Seller covers underpaid labels, wrong packaging and 100% of carrier fines | Seller |
| USPS hazmat fine | $50, Mercari absorbs half, seller pays $25 | Seller ([VAR](https://valueaddedresource.net/mercari-q4-2026-earnings/)) |

History: March 2024 removed seller fees and charged buyers. 2025-01-06 set today's split *observed*. No base fee change in 2026 found. Label prices rose on 2026-10-19 *observed*. A VAR headline reports "Seller Tiers With Limited-Time Fee Discounts for High-Volume Sellers" ([link](https://www.valueaddedresource.net/mercari-seller-tiers-fee-discounts/), not opened) *asserted*. That would not reach a casual seller *inferred*.

Payout timing *asserted* (memory): money moves to the seller's balance after the buyer rates, or 3 days after delivery if the buyer does nothing.

**Worked examples** *inferred* from the fees above and the 2026-10-19 Best rates:

| | $40 item, 1 lb | $200 item, 2 lb |
|---|---|---|
| Label (Best rate) | USPS Ground Advantage $7.99 | UPS SurePost or FedEx Economy $8.49 |
| Buyer pays shipping: fee | 10% of $47.99 = $4.80 | 10% of $208.49 = $20.85 |
| Buyer pays shipping: **seller nets** | **$35.20** | **$179.15** |
| Buyer's total before tax | $47.99 + $1.73 = $49.72 | $208.49 + $7.51 = $216.00 |
| Seller pays shipping: fee | 10% of $40 = $4.00 | 10% of $200 = $20.00 |
| Seller pays shipping: **seller nets** | $40 less $4.00 fee and $7.99 label = **$28.01** | $200 less $20.00 fee and $8.49 label = **$171.51** |

## 5. Listing fields and hard limits

| Field | Limit or values | Evidence |
|---|---|---|
| Title | 80 characters | *asserted* (memory, crosslister guides). Not on the help page |
| Description | 1,000 characters | *asserted* (memory) |
| Photos | Up to 12. First photo is the main image. Reorder any time | *observed* ([Creating a Listing](https://www.mercari.com/us/help_center/topics/listing/guides/creating-a-listing/)) |
| Photo size, ratio | No pixel spec found. Grid thumbnails are square | *asserted* (memory) |
| Video | Not on the help page I read. Treat as unsupported | *inferred* |
| Hashtags | Up to 3 | *observed* ([Mercari blog](https://blog.mercari.com/us/6-ways-to-optimize-your-listings-for-more-mercari-sales), 2022-03-31: "you've got three to use for every listing"). The help page adds "don't add brand names or hashtags that don't relate to the item" *observed* |
| Category | Required. Three levels | *asserted* (memory). Help says category improves searchability *observed* |
| Brand | Optional, picked from a list. "Improves visibility in search" | *observed* |
| Condition | Required. New, Like new, Good, Fair, Poor | *asserted* (memory) |
| Color, size | Optional structured fields, size for apparel and shoes | *asserted* (memory) |
| Price | $1 to $2,000. Up to $5,000 for Authenticate-eligible designer shoes, handbags and wallets. $2,000 to $5,000 needs extra identity verification | *observed* |
| Quantity | One item per listing. No quantity field | *asserted*. "Each listing must represent an item that is available for purchase" *observed* ([article 362](https://www.mercari.com/us/help_center/article/362/)) |
| Shipping | Weight first, then carrier. Box dimensions needed for Best rate. Seller-paid or buyer-paid. Or ship on your own | *observed* |
| Smart Pricing | Optional floor price. Mercari lowers the price over time, never under the floor | *observed* |
| Smart Offers | Optional minimum. Offers at or above it are accepted automatically. **Status unclear**: the Promote help page still names it *observed*, while a VAR headline says "Mercari Discontinues Smart Offers" ([link](https://valueaddedresource.net/mercari-discontinues-smart-offers-changes-promotions), not opened) | *asserted* |

## 6. Title and description conventions

How search reads fields: Mercari says it favors "clear, relevant, and accurate keywords that buyers would genuinely use", and that brand, category and condition help search *observed* (section 12). Sellers say title words weigh most and the description is also searched *asserted*.

Formula *agent proposal*, built from seller convention: **Brand + item type + model, character or style name + size + color + "NWT" or "New" if true**. Put the search words in the first 40 characters, since the mobile grid cuts titles short *asserted* ([SnapList](https://snaplistai.app/blog/mercari-titles-on-mobile/), folklore). No emoji, no all caps, no "L@@K", no brands the item is not.

- Clothing: `Lululemon Align High Rise Legging 25" Black Size 6`
- Non-clothing: `Pokemon Charizard ex 199/165 Scarlet Violet 151 Near Mint`

Description: 3 to 6 short lines. What it is, measurements, exact flaws ("small pull on left cuff, shown in photo 6"), what is included, "ships in 1 day". Tone is plain and friendly. Leave out: contact details, links, other marketplaces, "price firm" unless the user wants no offers (Mercari itself suggests writing that in the description *observed*). End with up to 3 hashtags.

## 7. Tags, categories and structured data

- **Category**: pick the deepest match. It drives browse and filters *asserted*.
- **Brand**: pick from Mercari's list. If the brand is missing, leave the field blank and put the brand first in the title *agent proposal*.
- **Condition**: be strict. Returns are for "not as described" *asserted* ([VAR headline](https://valueaddedresource.net/mercari-backtracks-on-new-return-policy)), so an over-rated condition is the main way to lose a sale after it ships *inferred*.
- **Hashtags**: up to 3, lower case, words the title does not already carry (`#yogapants #athleisure #highwaisted`). Mercari: "use your three tags to supplement rather than repeat what you've already written" *observed* (2022 blog). An earlier draft of this note repeated the title in the tags. Unrelated brands or tags are against the listing guide, and the conduct page bans "Listing an excessive amount of search keywords", "Setting unrelated categories" and "Setting a false brand" *observed*.
- **Color and size**: fill both. They are filter fields *asserted*.

**Search rules as data and a check.** The rules every site shares and this site's differences are in [listing-seo.md](../listing-seo.md). `node scripts/listing-lint.mjs title mercari facts.json` builds this site's title from an item's facts, and the same script checks a draft.

## 8. Photos

- Up to 12 photos. "Use natural lighting and a plain background", show every side and any flaws *observed*.
- The first photo is what shoppers see in search *observed*. Thumbnails are square *asserted*.
- Banned: "Using any stock or advertisement photos", "Using photos that you do not own or have not taken yourself", and another member's photos *observed* ([Prohibited Conduct](https://www.mercari.com/us/help_center/topics/account/policies/prohibited-conduct/), last dated 1/23/2023). Watermarks, text overlays and collages are not named there. Cover collages are common for lots *asserted*.
- Mercari's own tools: an image-based AI listing tool in beta that drafts a listing from a photo, and an AI importer that copies listings from eBay and Depop *asserted* (VAR headlines: [AI listing beta](https://www.valueaddedresource.net/mercari-image-ai-listing-tool-beta), [importer](https://valueaddedresource.net/mercari-introduces-ai-importer-from-ebay-depop)). Merchat AI, a shopping assistant, launched in 2023 *asserted* (memory).
- AI-generated or AI-edited images: "Not addressed" on the Prohibited Conduct page *observed*. A generated picture of the item would still be a photo the seller did not take, so it falls under the rule above *inferred*. A touched-up photo the seller took does not.

### Under Ben's touch-up rule

Mercari's stated photo norm is natural light, plain background, all sides, all flaws *observed*. That is the same thing our rule asks for, so nothing here needs a scene edit.

- **At capture**: guide the user to a plain wall, floor, table or bedsheet near a window. Clothing flat or on a hanger. Small collectibles on a plain surface, box front first.
- **Touch-up only**: exposure, white balance, straighten, crop.
- **Crop**: cover as a 1:1 square, 1600 by 1600 pixels, item filling about 85% of the frame *agent proposal* (Mercari publishes no size that I could reach). Other photos also square so nothing is cut in the viewer.
- **Order, 8 to 12 photos**: 1 front, 2 back, 3 label or brand tag, 4 size tag or model number, 5 detail, 6 and up every flaw close up, then sole or base, accessories and box, last a measurement shot.
- **What the rule stops**: white cut-out covers and text collages ("LOT OF 12") that some sellers use. We cope with one real overhead photo of the whole lot on a plain floor, and the count in the title.
- **Trading cards**: front, back, four corners, on a dark plain surface, no sleeve glare. Never brighten so far that whitening on edges disappears *agent proposal*.

## 9. Pricing and offers

| Mechanic | Rule | Evidence |
|---|---|---|
| Buyer offer | On one item or a bundle. Seller can accept, decline or counter. Minimum offer percent not stated | *observed* ([article 330](https://www.mercari.com/us/help_center/article/330/)) |
| Offer window | 24 hours, then it expires | *observed* |
| Counteroffer | Buyer has 24 hours. If the buyer accepts, "they are automatically charged" | *observed* |
| Accepted buyer offer | Buyer is charged on acceptance, so it binds | *asserted* (memory. The page only states it for counters) |
| Offer to Likers | At least 10% under the current price, and a repeat must be 10% under the lowest price so far. Goes to up to 50 newest likers. Valid 24 hours. Binding if accepted. Once every 72 hours per item | *observed* ([article 347](https://www.mercari.com/us/help_center/article/347/)) |
| Auto Offer to Likers | Your latest offer is sent to each new liker after a delay you pick (Profile > Promotion settings) | *observed* |
| Smart Offers | Set a minimum. Offers at or above it are accepted without you. May be discontinued (section 5) | *asserted* (memory) |
| Bundles | Buyers can offer on several of your items at once | *observed* |
| Auctions | None | *asserted* |
| 1099-K block | Without a verified W-9, once a sale would cross the 1099-K threshold you cannot accept or send offers, and Buy now is turned off | *observed* |

How much room to leave *agent proposal*: list at the target price times 1.18. That leaves one Offer to Likers (10%) and one Promote (5%), or one accepted buyer offer, before the target is reached. Example: target $40, list $47, Offer to Likers at $42.30. Whether a private offer counts as the "lowest price so far" is not stated. Test it.

Do not turn on Smart Pricing when we run our own ladder. Each automatic drop lowers the "lowest price so far", and every later Promote or Offer must undercut that *inferred*.

## 10. Promotion and boosts

All three are free. The cost is the discount *observed* (article 347).

| Tool | Minimum cut | Who sees it | Lasts | How often |
|---|---|---|---|---|
| Promote | 5% under current price. Repeats must be 5% under the lowest price so far | All likers are notified. "Boosted in search results". Price Drop badge | Permanent price change | Once per 24 hours per item |
| Offer to Likers | 10%, same rule on repeats | Up to 50 newest likers | 24 hours, private price | Once per 72 hours per item |
| Time-limited Sale | 10% under the lowest price so far. Item must be listed 7 days or more | Everyone. Boosted in search and shown in "Deals" | 72 hours, then the price returns | Not stated |

Pays off: when the item has likers (Offer to Likers), or has sat 7 days with views and no likes (Sale). Does not pay: Promote on an item with no likers and no padding, since the drop is permanent.

Paid ads: none found. Mercari funds its own buyer coupons and shipping promos (section 3, section 11).

## 11. Shipping and local pickup

Mercari prepaid labels, rates effective 2026-10-19 *observed* (fee page). "Best" needs box dimensions at listing and a small box (the May 2026 table said within 1 cubic foot and 22 inches on the longest side). Bigger boxes pay the Standard rate by dimensional weight.

| Weight | Cheapest Best rate | Standard rate for that service |
|---|---|---|
| Trading cards, 1 oz envelope | $0 until 2027-01-04 | $0.74 (May 2026 table) |
| Trading cards, 2 to 3 oz envelope | $0.49 until 2027-01-04 | $1.03, $1.32 |
| 4 oz | USPS Ground Advantage $5.39 | $6.49 |
| 8 oz | USPS $5.99 | $7.49 |
| 12 oz | USPS $7.39 | $8.49 |
| 1 lb | USPS $7.99 (UPS SurePost or FedEx Economy $8.09) | $8.99 |
| 2 lb | SurePost or FedEx Economy $8.49 (USPS $13.09) | $9.99 |
| 3 lb | $8.69 | $10.49 |
| 5 lb | $9.39 | $12.99 |
| 10 lb | FedEx Economy $12.49 (UPS Ground $18.49) | $20.99 |
| 20 lb | UPS Ground or FedEx Home $35.99 | $42.99 |
| 50 lb | $50.99 | $140.99 UPS, $160.99 FedEx |
| 100 lb | $120.00 | $350.99 UPS, $375.99 FedEx |
| Media Mail (books, movies, music only) | 1 lb $4.47, 2 lb $5.22, 3 lb $5.97 | n/a |

- **Limits**: prepaid labels up to 100 lb, longest side 30 inches, girth 130 inches. Above that the seller ships alone and pays everything. Motorized items, furniture, bicycles and major appliances are "not eligible for national shipping" *observed*. The older listing guide says to ship on your own above 50 lb or 34 inches *observed*. The fee page is newer, so the adapter uses the fee page.
- **Protection**: $200 with every prepaid label, $20 on envelopes *observed*. Above $200 in value, ship on your own with insurance *observed*.
- **Who pays**: either. Seller-paid shows as free shipping *asserted* (the page summary read the other way round, which I take as a summarizer slip). Fee cost is about the same both ways, because the 10% also covers buyer-paid shipping *inferred*.
- **Handling time**: ship within 3 business days, or the buyer can cancel *asserted* (memory. Help articles [59](https://www.mercari.com/us/help_center/article/59/) and [536](https://www.mercari.com/us/help_center/article/536/) not opened).
- **Local**: Mercari Local (Uber delivery) was discontinued *asserted* ([VAR headline](https://valueaddedresource.net/mercari-local-uber-delivery-discontinued)). A "[Meetups (beta)](https://www.mercari.com/us/help_center/topics/shipping/guides/meetups/)" help page exists in November 2026 *observed* (title only, rules not read). Until we read it, treat Mercari as ship-only and send local items to Facebook Marketplace.

## 12. The algorithm

What Mercari has said, in its own help article "Unlock Better Visibility: How Mercari Search Spotlights Your Items" ([article 2514](https://www.mercari.com/us/help_center/article/2514), undated) *observed*. The page lists six signals and calls the system "complex", with "many signals":

| # | Signal | Mercari's words | What the adapter does |
|---|---|---|---|
| 1 | Transaction success | Sellers who "consistently turn listings into sales", with few cancellations, returns or issues | Strict condition, true photos, fast delist elsewhere so we never cancel |
| 2 | Sales, lifetime and recent | "both your long-term sales history and your recent sales momentum", recent = rolling 90 days | Nothing per listing. A new seller starts behind, so price to sell the first items |
| 3 | Verified profile | Email, phone, payment method, Government ID. ID earns a badge | Account health check before first post |
| 4 | Listing management | "designed to favor genuine updates rather than listings that are frequently deleted and relisted". Update with new information, fresh photos or price changes | Edit in place. No routine relist |
| 5 | Keywords | "clear, relevant, and accurate keywords that buyers would genuinely use" | Title formula, no stuffing |
| 6 | Platform engagement | Regular listing updates, prompt replies, efficient shipping. "consistently active" sellers | Reply fast, ship in 1 day, touch stale listings |

Also from Mercari:

- Brand "improves visibility in search". Category and condition give "better searchability" *observed* (listing guide).
- Promote and Time-limited Sale are "boosted in search results". Sale items are "featured in the Deals section" *observed* (article 347).
- Price is called a "significant" driver of sales, but not named as a ranking signal *observed*. Photos, shipping price and star ratings are not named either.
- The Sale tool opens at 7 days listed *observed*, which reads as Mercari's own line for a stale listing *inferred*.
- Mercari's engineering blog describes machine-learned re-ranking trained on click logs ([2023-01-01](https://engineering.mercari.com/en/blog/entry/20230101-the-journey-to-machine-learned-re-ranking)) *asserted* (memory of the post, Japan app).

Seller folklore, none of it shown with data *asserted*:

- New listings get a boost for the first days. One analytics vendor tracks a "7 day freshness boost" ([Vortex IQ](https://docs.vortexiq.ai/nerve-centre/kpi-cards/mercari/listings-in-7-day-freshness-boost), title only).
- Delete and relist every 2 to 4 weeks beats editing ([Crosslist](https://crosslist.com/blog/how-to-relist-on-mercari), [Closo](https://closo.co/blogs/platform-specific-guides/how-to-relist-on-mercari), titles only, both sell relist tools). Mercari's signal 4 says the reverse.
- Evenings and weekends are the best time to post.

Relist versus edit: edit. Signal 4 and the "excessive reposting" rule both point one way *observed*. A relist also throws away the likers, who are the audience for Offer to Likers *inferred*. Its one gain is a reset of the "lowest price so far" *inferred*, so keep it as a rare, user-approved last step.

## 13. Rules that bite

| Rule | Detail | Evidence |
|---|---|---|
| Duplicates | "Multiple listings for the same item will be removed". "Creating multiple listings of the same item" is prohibited conduct | *observed* (article 362, Prohibited Conduct) |
| Reposting | "Excessive reposting of previously listed items" is prohibited. No threshold given | *observed* |
| Photos | No stock or advertisement photos. Only photos you took | *observed* |
| Keywords | No "excessive amount of search keywords", no unrelated category, no false brand | *observed* |
| One account | "Having multiple Mercari accounts" is prohibited | *observed* |
| Pre-orders | No items that ship "at a future date" | *observed* |
| Cancellations | Frequent cancellations: 5% of item price up to $25, after warnings | *observed* |
| Hazmat | Fragrance, nail polish, aerosols, lithium batteries must be declared. USPS fine $50, seller's share $25 | *observed* (VAR), item list *asserted* |
| Tax form | No verified W-9 near the 1099-K threshold blocks offers and Buy now | *observed* |
| Prohibited items | Alcohol, tobacco and vapes, drugs, weapons, counterfeits, recalled goods, digital-only goods and more | *asserted* (memory. [Policy page](https://www.mercari.com/us/help_center/topics/account/policies/prohibited-items/) not opened) |
| Off-platform | "Encouraging payments outside of Mercari", "Proposing or completing a transaction in person or off of the Mercari platform" and "Soliciting users to an external website" are prohibited | *observed* (page dated 2023, older than Meetups beta) |
| Penalties | Item removal, suspension until verified, and "Mercari may hold funds after a suspension or termination" | *observed* |
| Returns | Buyer must ask within 3 days of delivery and before rating. The 2024 "any reason" policy was rolled back to "not as described" only. A Fashion Exchange program adds fit returns on some clothing | *asserted* (memory plus VAR headlines) |
| Automation | Prohibited: "any robot, spambot, spider, crawler, scraper or other automated means" to access the service or extract data, unless Mercari provides the interface | *observed* |
| Crosslisting tools | Mercari built its own importer from eBay and Depop *asserted* (VAR headline), and Vendoo has a direct server integration in testing ([crosspost note](../crosspost-and-delist.md)). So crosslisting is welcome through Mercari's own doors, and a browser agent is against the letter of the rule | *inferred* |
| Identity checks | Sellers report forced ID and face verification through Jumio ([VAR headline](https://www.valueaddedresource.net/mercari-forced-biometric-verification-jumio/), not opened) and payout holds on new accounts | *asserted* |

For a tool that posts for the user: keep the user's tap on Publish, never post a second copy, enter true weight and box size, and delete the Mercari listing within seconds of a sale elsewhere. An open Offer to Likers is binding for 24 hours *observed*, so do not send one on an item that has an offer pending on another site *agent proposal*.

How we still build posting under the automation rule *agent proposal*, in order of safety: (a) ask Mercari for the partner integration Vendoo is testing. (b) Post to eBay and Depop by API, then hand the user to Mercari's own importer, which is an interface Mercari provides. (c) For the demo, Browser Use in the user's own signed-in session, paced like a person, stopping before Publish for the tap. Say plainly in the pitch that (c) is a demo route.

## 14. What belongs here

| Product type | Verdict | Reason | Evidence |
|---|---|---|---|
| vintage_clothing | ok | Sells, but buyers search by brand, not era | *asserted* |
| streetwear | ok | Buyers exist. No authentication for clothing | *asserted* |
| designer_clothing | ok | Authenticate covers shoes, bags, wallets only. $2,000 cap | *observed* cap, *inferred* fit |
| womens_mall_brands | good | Fashion is Mercari's named focus. Lululemon class brands move | *observed* focus, *asserted* brands |
| mens_mainstream | ok | Smaller men's audience | *asserted* |
| fast_fashion | ok | Only as lots. A $5.39 label kills a $6 top | *inferred* from rates |
| kids_baby_clothing | good | Lots and bundles suit parent buyers | *asserted* |
| sneakers | good | Designer shoes can be authenticated. Box fits Best rate | *observed* Authenticate, *asserted* demand |
| shoes_other | ok | Heavier boxes, weaker demand | *asserted* |
| luxury_handbags | good | Authenticate, cap raised to $5,000 | *observed* |
| jewelry_watches | ok | Costume and mid-price fine. No authentication, $2,000 cap | *observed* cap |
| accessories | ok | Light and cheap to ship | *inferred* |
| outdoor_apparel | ok | Brand search works. Better buyers elsewhere | *asserted* |
| fan_apparel | ok | Jerseys sell in season | *asserted* |
| beauty | good | Long-time strong category. Declare hazmat on fragrance and polish | *asserted* demand, *observed* hazmat fee |
| phones_computers | ok | Allowed under $2,000. $200 label protection is thin | *observed* limits, *inferred* |
| cameras_audio_gaming | good | Consoles and headphones are core "Entertainment & Hobbies" | *observed* category, *asserted* items |
| media | good | Video games strong. Media Mail from $4.47 | *observed* rate |
| collectibles_cards_toys | best | Mercari credits collectibles and trading cards for its growth. Free card envelopes | *observed* |
| home_decor | good | Small housewares sell. Pack well | *asserted* |
| small_appliances | ok | 10 lb costs $12.49 or more to ship | *observed* rate |
| furniture | avoid | Not eligible for national shipping. Meetups is beta and unread | *observed* |
| large_appliances | avoid | Same rule | *observed* |
| tools | ok | Hand tools fine. Heavy kits cost $18 and up | *observed* rate |
| sporting_goods | ok | Small gear fine. Bicycles cannot ship | *observed* |
| instruments | ok | Pedals and small gear. A guitar box passes the 30 inch label limit | *inferred* from size limit |
| auto_parts_vehicles | avoid | Motorized items cannot ship. Small parts only | *observed* |
| baby_gear | avoid | Bulky, and recalled goods are prohibited | *inferred*, *asserted* |
| antiques_art | ok | Wrong audience for high prices | *asserted* |
| handmade | ok | Allowed, low search demand | *asserted* |
| bulk_lots | good | Bundles and lots are a native habit | *observed* bundles, *asserted* demand |

## 15. Adapter rules (agent proposal)

1. **Title**: `Brand + item type + model/character/style + size + color + New/NWT`. Max 80 characters, search words in the first 40 (section 6).
2. **Description**: 3 to 6 lines, flaws named with the photo number, max 1,000 characters, then up to 3 hashtags that add words the title lacks (sections 5, 7).
3. **Structured fields**: always set deepest category, brand from the list, condition, color, size (sections 7, 12).
4. **Photos**: 8 to 12, all 1:1 at 1600 by 1600, order as in section 8. Touch-up note: "light and color corrected, cropped, nothing removed".
5. **Price**: list at target times 1.18, rounded to a whole dollar. Clamp to $1 to $2,000. Above $2,000, only shoes, handbags and wallets with Authenticate (sections 5, 9).
6. **Offers**: if the form shows Smart Offers, set its minimum to the target price. If it does not, our app answers offers: accept at or above target, counter at target below it. Auto Offer to Likers on, at 10% off, with a delay. Smart Pricing off (section 9).
7. **Ladder**: day 3 with likers, Offer to Likers 10%. Day 7 with no sale, Time-limited Sale 10%. Day 14, Promote 5%. Stop at the user's floor (section 10).
8. **Refresh by editing**: every 7 days without a sale, make one real update in place (swap in a better cover photo, add a measurement, or take a ladder step). No routine delete and relist, since Mercari search favors updates and bans "excessive reposting". Offer a relist only when the ladder has hit the floor, at most once per item. Never keep two copies live (sections 12, 13).
9. **Shipping**: Mercari prepaid label, buyer pays, weight rounded up, box dimensions always entered to get Best rate. Pick the cheapest row in section 11. Cards under 3 oz go by envelope. Books, games and discs go Media Mail (section 11).
10. **Hazmat flag**: fragrance, polish, aerosols and loose lithium batteries get the hazmat choice and ground service (section 13).
11. **Refuse**: furniture, large appliances, bicycles, anything motorized, anything over 100 lb or 30 inches, and prohibited goods. Suggest Facebook Marketplace (sections 11, 14).
12. **Warn**: any single item priced under $12 ("label costs more than a third of the price, make it a lot"), anything worth over $200 (label protection stops at $200), and items in `avoid` rows.
13. **Account health**: before the first post, check email, phone, payment method and ID are verified (search signal 3), and that a W-9 is verified if the seller is near the 1099-K threshold (sections 9, 12).
14. **Reply and ship fast**: draft replies to buyer messages within minutes for the user to send, and prompt for shipping within 1 day (search signal 6).

Human taps, never automatic: Publish. Accepting or countering a buyer offer under the Smart Offers minimum. Sending a Time-limited Sale or Promote (they change the public price). Delete and relist. Cancelling an order. Anything with Authenticate.

## 16. References

| Source | Job | What we take |
|---|---|---|
| [Fees on Mercari](https://www.mercari.com/us/help_center/article/169/) (updated 10/23/2026) | Fee and rate table | All fees, label rates, limits, protection |
| [Fee structure FAQ](https://www.mercari.com/us/help_center/article/2518/) | History | 2025-01-06 split, fee base |
| [Creating a Listing](https://www.mercari.com/us/help_center/topics/listing/guides/creating-a-listing/) | Field rules | 12 photos, price range, photo norms, search fields |
| [Promote button](https://www.mercari.com/us/help_center/article/347/) | Boost mechanics | Three tools and their rules |
| [Offers for sellers](https://www.mercari.com/us/help_center/article/330/) | Offer mechanics | 24 hour windows, auto-charge, W-9 block |
| [Multiple listings](https://www.mercari.com/us/help_center/article/362/) | Duplicate rule | One listing per item |
| [Prohibited Conduct](https://www.mercari.com/us/help_center/topics/account/policies/prohibited-conduct/) (last dated 1/23/2023) | Conduct rules | Automation ban, photo ownership, reposting, keywords, one account |
| [How Mercari Search Spotlights Your Items](https://www.mercari.com/us/help_center/article/2514) (undated) | Ranking, from the platform itself | Six signals. Edit, do not relist |
| Value Added Resource: [earnings](https://valueaddedresource.net/mercari-q4-2026-earnings/), [CEO](https://www.valueaddedresource.net/mercari-names-jeff-lebeau-us-ceo/), [profit](https://www.valueaddedresource.net/mercari-us-first-ever-full-year-profit/), [rates](https://www.valueaddedresource.net/mercari-shipping-rates-october-2026/) | Company state, reporting Mercari's earnings | Size, growth, focus categories, rate change date |
| [Voolist fee guide](https://www.voolist.com/blog/mercari-fees-2026) | Contrary lead | Nothing. Its $2 Instant Pay is contradicted by the fee page |

## What I searched and couldn't reach

The fetch budget shared by all helpers ran out. These pages were found but not read, so the linked rules stay *asserted*:

- Mercari help: buyer offers (327), Prohibited Items, Terms of Service, Returns (6002, 57), Ratings for Sellers, Seller Badges (288), Meetups (beta), manage listings (332), views and clicks (5001), bundles, shipping labels (6000), cancel rules (59, 536), account limits (162), Authenticate terms (480), Fashion Exchange (2513), old listing guide (451, fetch error).
- VAR: Smart Offers discontinued, return policy rollback, Mercari Local shutdown, AI listing beta, importer, seller tiers, Jumio verification, holiday shipping, Global App.
- Found only in a 2022 Mercari blog post, not on a current help page: the 80-character title, the 1,000-character description and the three hashtags. Not found at all: minimum buyer offer percent, pixel specs, any policy on AI-edited photos, US buyer demographics, average order value, a 2026 trend report for the US.

None of this shows absence. Re-check order for the parent: the Smart Offers article, Meetups, returns, buyer offers (327), Terms of Service.

## Seed frontier log

- **Loop 1** (seeds: "Mercari US 2026 layoffs wind down", "Mercari fees 2026"). Read VAR earnings, CEO and profit articles, Voolist. Changed: Mercari is growing, not closing. Next: the fee page itself. Contrary lead: Voolist says no buyer fee and $2 Instant Pay.
- **Loop 2** (seeds: mercari.com fee page 169, FAQ 2518, listing guide, VAR October rates). Changed: 3.6% buyer fee, fee on shipping, free direct deposit, cancellation fee, new rate table, $5,000 Authenticate cap. Contrary lead settled against Voolist. Next: offers and Promote.
- **Loop 3** (seeds: help articles 330, 347, 362). Changed: three price tools with "lowest price so far" rule, binding Offer to Likers, 50 likers, 72 hours, duplicates removed. Contrary lead: "Mercari Local is dead" met a Meetups (beta) page. Budget ran out here.
- **Loop 4** (search titles: returns, AI tools, search algorithm, terms, offers. One page read after a wait: Prohibited Conduct). Changed: automation ban, photo ownership rule, "excessive reposting", and three fallbacks for the posting route. Contrary lead left open: a VAR headline says Smart Offers was discontinued, while the Promote help page still names it.
- **Loop 5** (seed: Mercari help article 2514 on search, read after a second wait). Changed: Mercari names six search signals and says it favors updates over delete and relist. The relist rule became "edit in place", and two account rules were added. Contrary lead answered: the folklore that relisting wins is contradicted by the platform. Stop: budget.
