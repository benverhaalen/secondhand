# How do we post on eBay (US) so it sells, and what belongs there?
Researched 2026-11-14 by Ben (Claude Code research helper). Feature: list.

Feeds the eBay adapter: the deterministic rules our lister applies on eBay. How we post through the API is in [posting-browser-use-ebay.md](../posting-browser-use-ebay.md) and [crosspost-and-delist.md](../crosspost-and-delist.md). This note is about making the listing sell. Marks: *observed* (opened today, link given), *asserted* (a named source says so but was not opened today; with no source named it is my memory), *inferred* (my reasoning).

## 1. Short answer

1. **Structured data beats prose.** Category, item specifics, condition and an 80-character keyword title decide whether search and filters ever show the item. eBay names "how closely the listing matches the buyer's search terms" and "how complete the listing is" as Best Match factors *observed*.
2. **Price from sold comps, then leave offer room.** Fixed price with Best Offer is the default for used goods. Auto-accept and auto-decline run offers without the seller *observed*.
3. **Terms rank.** Return policy and handling time are named factors *observed*. Offer 30-day returns and 1-day handling.
4. **Seller record ranks and costs money.** A Below Standard account pays 6% more in fees *observed*. Cancelling because the item sold elsewhere is a defect *asserted*, so the crosspost delist must be fast.
5. **Photos: square, whole item, up to 24, no text or borders** *observed*.
6. **Promoted Listings now work like a flat extra fee.** Since 2026-01-13 a sale is charged if any buyer clicked the ad in the last 30 days *observed*. Default off for one-off used items.
7. **Fees vary by category.** 13.6% is the base. Sneakers at $150 and up pay 8%, guitars 6.7%, books and DVDs 15.3%, handbags 15% *observed*.

Biggest difference from the other platforms: eBay is a search engine for things with names and numbers. It has no hashtags, likes, shares or followers to work. The buyer types a model number and filters. Anything with a model number, part number, set number or collector following belongs here first. Its User Agreement also leaves the official API as our only allowed route ([prior note](../crosspost-and-delist.md)).

## 2. Draft from memory, and what changed

Draft: 13.25% fee plus $0.30; title 80; up to 24 photos, min 500 px; offers last 48 hours; Promoted Listings Standard charges only when the buyer who clicked buys; Depop purchase pending; AI photo rules unknown.

| Draft | Found |
|---|---|
| 13.25% + $0.30 | 13.6% since 2025-02-14, plus $0.30 on orders of $10 or less and $0.40 above. The live US fee page shows no base-rate change in 2026 *observed* |
| Offers last 48 hours | Buyer offers expire after **24 hours**. Counteroffers and seller-sent offers last **96 hours** *observed* |
| Ad fee only when the clicker buys | From 2026-01-13, charged when **any** buyer clicked in the last 30 days and the item sells while still promoted *observed* |
| Depop deal pending | Closed 2026-07-30 for about $1.4 billion in cash. Depop keeps "its brand, platform, customer experience and culture" *observed*. No eBay to Depop cross-listing found |
| AI photo rules unknown | The picture policy does not mention AI. eBay's own app offers AI-generated "Studio, Surface, and Outside" backgrounds *observed* |
| Nothing on sizes | August 2026: eBay is "standardizing fashion sizes" and asks sellers to update fashion listings *observed* |

The shared fetch budget ran out part way through (section 16). Seller-level thresholds, apparel condition ids, Authenticity Guarantee thresholds, Standard Envelope rates and selling-limit numbers are from memory and marked *asserted*.

## 3. Who buys here and what sells

- **Size.** About 134 million active buyers and over 2 billion live listings *asserted (memory of 2025 filings)*. Q3 2026: revenue $3.20 billion, GMV up 16% *asserted (FashionUnited and Longbridge headlines in search results, pages not opened)*.
- **Buyers.** Older and more male than Depop or Poshmark, and search-led *asserted*.
- **Focus categories** eBay names in earnings: motors parts and accessories, collectibles and trading cards, luxury (watches, handbags, sneakers, jewelry), refurbished electronics, pre-loved fashion *asserted (memory; the Oct 2026 headline reads "circular fashion momentum")*.
- **Price bands.** From $5 cards to five-figure watches. The fee table has tiers from $150 to $7,500 *observed*.
- **Speed.** Fixed-price listings run until cancelled. Electronics priced at comps can sell in days. Used clothing commonly takes one to three months *asserted (seller folklore; Flowlister and Closo sell-through tables not opened)*. Auctions end in 1 to 10 days *observed*.
- **Where eBay wins** *inferred*: anything with a model or part number, "for parts" items, collectibles, rare items with few buyers nationwide, items that gain from authentication.
- **Where it is weak** *inferred*: bulky furniture (no delivery network), and items under about $15, where the per-order fee and postage eat the sale.

## 4. Money

From the [US selling fees page](https://www.ebay.com/help/selling/fees-credits-invoices/selling-fees?id=4822) *observed* unless marked.

| Fee | Amount |
|---|---|
| Insertion | 250 free listings a month, then $0.35. Guitars and basses free. Athletic shoes free at a start price of $150 or more |
| Final value fee, most categories (clothing, electronics, home, toys, motors parts) | 13.6% of the total sale up to $7,500, 2.35% above |
| Books, magazines, movies, TV, music (not vinyl) | 15.3% |
| Trading cards, card games, comics, coins | 13.25% |
| Athletic shoes | 8% and no per-order fee at $150 or more. 13.6% under $150 |
| Women's bags and handbags | 15% up to $2,000, 9% above |
| Jewelry | 15% up to $5,000, 9% above |
| Watches | 15% up to $1,000, 6.5% to $7,500, 3% above |
| Guitars and basses | 6.7% |
| Per-order fee | $0.30 on orders of $10.00 or less, $0.40 above |
| International fee | 1.65%, not charged when the sale uses eBay International Shipping |
| Below Standard seller | +6% on the fee rate next month (+7% after four months) |
| Very high "not as described" rate | +5% in the affected categories |
| Dispute lost | $20.00 |
| Subtitle | $2.00 (price up to $150) or $6.00 on fixed price |
| Reserve price (auctions) | the greater of $5 or 7.5% of the reserve, charged even if unsold |

- The percent applies to the total sale *observed*. That total includes shipping the buyer pays and sales tax *asserted*, so free shipping does not lower fees.
- Payment processing is included. US buyers pay no fee *asserted*.
- Payout: funds usually become available about two days after payment and go to the bank daily or weekly. New sellers can have funds held until delivery *asserted*.
- Changes. The US base rate rose from 13.25% to 13.6% on 2025-02-14 *observed* ([Feb 2025 update](https://www.ebay.com/sellercenter/resources/seller-updates/2025-january/final-value-fee)). eBay UK's free selling for private sellers has not reached the US: the US page still charges 13.6% *observed*. One March 2026 report describes an invite-only US promotion waiving fees on up to 25 items in baby, fashion and home decor *asserted (Shopifreaks, read through a reposting site with inconsistent dates)*.

**Worked examples** (clothing at 13.6%, buyer pays shipping, 7% sales tax; *inferred* from the table):

| | $40 item | $200 item |
|---|---|---|
| Shipping charged to buyer | $6.00 | $10.00 |
| Sales tax (eBay collects it) | $3.22 | $14.70 |
| Fee base | $49.22 | $224.70 |
| Final value fee | $6.69 | $30.56 |
| Per-order fee | $0.40 | $0.40 |
| Seller receives | $38.91 | $179.04 |
| After buying the label | $32.91 (82% of price) | $169.04 (85%) |

A $200 pair of sneakers nets more: 8% of $224.70 is $17.98 with no per-order fee, so $182.02 after the label. A 5% Promoted Listings rate would add about $2.46 on the $40 item and $11.23 on the $200 item *inferred; that the ad fee base includes shipping and tax is from memory*.

## 5. Listing fields and hard limits

| Field | Limit | Evidence |
|---|---|---|
| Title | 80 characters | *observed* ([Best Match page](https://www.ebay.com/help/Selling/-/Optimizing_your_listings_for_Best_Match?id=4166)) |
| Subtitle | 55 characters, paid | fee *observed*; length *asserted* |
| Description | HTML, up to 500,000 characters through the API. No off-eBay links or contact details | *asserted* |
| Photos | 1 required, up to 24 free | *observed* ([adding pictures](https://www.ebay.com/help/selling/listings/adding-pictures-listings?id=4148)) |
| Photo size | at least 500 px on the longest side; "about 1600 x 1600" recommended; up to 12 MB | *observed* |
| Photo ratio and format | 1:1 or 16:9 look best. JPEG, PNG, GIF, TIFF, BMP, WEBP, HEIC, AVIF | *observed* |
| Video | one per listing, MP4 or MOV, up to 150 MB, through the Media API | *asserted* |
| Category | one leaf category. A second costs another insertion fee and the higher final value fee | *observed* (fees page) |
| Item specifics (aspects) | required and recommended sets differ per category. Read them from the Taxonomy API `getItemAspectsForCategory`. Values up to 65 characters | *asserted* |
| Condition | required; allowed values differ per category. Read them from the Metadata API `getItemConditionPolicies` | *asserted* |
| Condition description | free text for used items, up to 1,000 characters | *asserted* |
| Product identifiers | UPC, EAN, ISBN or MPN. Required for many new items; used items may send "Does not apply" | *asserted* |
| Price | fixed price from $0.99; auction start from $0.01 | *asserted* |
| Quantity | 1 or more on fixed price; 1 on auctions | *asserted* |
| Duration | fixed price is Good 'Til Cancelled; auctions 1, 3, 5, 7 or 10 days | *observed* (fees page) |
| Best Offer | on or off, with auto-accept and auto-decline prices. Auto-accept must be below the price | *observed* ([Best Offer page](https://www.ebay.com/help/selling/listings/selling-buy-now/adding-best-offer-listing?id=4144)) |
| Business policies | an Inventory API offer needs payment, return and fulfillment policy ids and an inventory location. Calculated shipping also needs package weight and size | *observed* ([prior note](../posting-browser-use-ebay.md)); weight *asserted* |

**Condition values** *asserted (memory; the [2025 new item conditions page](https://www.ebay.com/sellercenter/resources/seller-updates/2025-january/new-item-conditions) was found, not opened)*. Clothing, shoes and accessories: New with tags (1000), New without tags (1500), New with imperfections (1750), Pre-owned - Excellent (2990), Pre-owned - Good (3000), Pre-owned - Fair (3010). Most hard goods: New (1000), Open box (1500), Used (3000), For parts or not working (7000). Refurbished grades are for approved sellers only. The adapter fetches the allowed list per category and never hard-codes it.

## 6. Title and description conventions

**How search reads them.** Search matches the title and the item specifics. The description is searched only when the buyer ticks "include description" *asserted*. eBay's advice: "Write a clear and concise title with correct spelling and no more than 80 characters" *observed*.

**Formula** *agent proposal*: `Brand + Line or Model + Item type + Model or style number + Size + Color + one or two key attributes + a condition word if it helps (NWT, Tested)`. Front-load the words a buyer would type. Use most of the 80 characters, each word once.

- Clothing (71 characters): `Patagonia Better Sweater 1/4 Zip Fleece Pullover Men's Large Gray 25523`
- Non-clothing (75 characters): `Sony WH-1000XM4 Wireless Noise Cancelling Headphones Black Tested With Case`

Leave out: ALL CAPS, "L@@K", "WOW", emoji, "rare" without cause, other brands' names ("like Lululemon" is search manipulation) *asserted*, and words the category already implies.

**Description.** Plain and short; phone buyers see the first lines. Order: what it is, condition and every flaw, measurements (clothing), what is included, tested or not, smoke or pet exposure. Tone is a spec sheet, where Depop is chatty *inferred*. Use catalog product details where eBay has them *observed*.

## 7. Tags, categories and structured data

- No tags or hashtags. **Category**, **item specifics**, **condition** and, for known products, a **catalog match** do that job *asserted*.
- Item specifics feed the left-hand filters (size, color, brand, storage, model). An item with a blank specific drops out when a buyer uses that filter *asserted (memory of Seller Center guidance)*. eBay tells sellers to add "make, model, size, color, and style" *observed*.
- Rule *agent proposal*: fill every required aspect, and every recommended one we can read from the photos or measure. Unknown values stay blank. Never guess a material or model number.
- Fashion sizes are being standardized (August 2026) *observed*. Map our measured size to eBay's allowed values and put raw measurements in the description.
- Catalog match: for phones, consoles, books, games and LEGO sets, a UPC, ISBN or eBay product id fills specifics and groups the listing with the product page *asserted*. The catalog stock photo cannot be the main picture for a used item *observed*.
- Spam: keyword stuffing in title or specifics, wrong category, wrong condition *asserted*.

## 8. Photos

| Point | Rule | Evidence |
|---|---|---|
| Count | 1 to 24, free; "taken from every angle, and show any flaws or scratches" | *observed* |
| Size | 500 px minimum longest side, about 1600 x 1600 recommended, 12 MB | *observed* |
| Main photo | shows in search beside the title; the whole item face-on; a bundle shows everything in it | *observed* |
| Background and light | "White backgrounds are generally best"; darker for shiny items; uncluttered; no flash or overhead glare | *observed* |
| Banned | added borders; added text, artwork or marketing material; any watermark; stock photos for used, damaged or defective items; placeholder images; "photos that don't accurately represent the item" | *observed* ([picture policy](https://www.ebay.com/help/policies/listing-policies/picture-policy?id=4370)) |
| eBay's tools | crop, rotate, brightness, contrast. Web: replace the background with solid white. App: AI-generated Studio, Surface and Outside backgrounds | *observed* |
| Video | allowed, one per listing | *asserted* |
| AI images | the picture policy says nothing on AI; the accuracy rule applies. Reports say eBay tested AI model images inside fashion listings | first *observed*; second *asserted (Shopifreaks and Value Added Resource headlines, not opened)* |

Clothing covers: flat lay, hanger and mannequin all appear; the whole garment on a plain light surface *asserted*.

### Under Ben's touch-up rule

Our app fixes light and color, crops and straightens. It never changes the background, the item or the wear. On eBay:

- **Met at capture, not by editing.** White is preferred, not required. Guide the shot onto a plain light wall, door, sheet or floor in window light, flash off, item filling most of a square frame. That meets "uncluttered" and "whole item face-on" *inferred*.
- **What the rule stops.** Many sellers use a white cut-out, and eBay's own tool makes one. We do not. A user who wants it can tap eBay's background tool after we post *agent proposal*. We never use eBay's AI scene backgrounds, since they change the environment.
- **Crop.** Cover at 1:1, 1600 x 1600 px, JPEG, cropped from a wider capture. Never pad with bars: added borders are banned *inferred*. Other photos may be 1:1 or 4:3, 1600 px on the long side.
- **Order** *agent proposal*: 1 front, whole item. 2 back. 3 brand label or model plate. 4 size tag, serial or part number. 5 to 8 details (cuffs, soles, ports, screen on). Then every flaw, close, with a coin for scale. Last: a tape-measure shot (clothing) or everything included (electronics).
- **Count.** 8 to 12 for clothing, 6 to 12 for hard goods, never fewer than 4. Flaw photos are never dropped to save slots.

## 9. Pricing and offers

- **Format.** eBay's guidance: auctions suit items of uncertain value or that are unique or hard to find; fixed price suits known value and listings that should stay up past 10 days *observed*. Default: fixed price with Best Offer. Auction is a tap for rare collectibles.
- **Comps.** Sold prices come from Product Research (Terapeak) in Seller Hub, free, up to three years back *asserted*. Our pipeline uses the Browse API for active listings ([prior note](../posting-browser-use-ebay.md)).
- **Best Offer mechanics** *observed* ([help page](https://www.ebay.com/help/selling/listings/selling-buy-now/adding-best-offer-listing?id=4144)):

| Mechanic | Value |
|---|---|
| Buyer offer lifetime | 24 hours, or until the listing ends |
| Offers per buyer per item | up to 3 in most categories |
| Counteroffers | up to 5 each side; each lasts 96 hours; "whoever accepts your counteroffer first wins" |
| Auto-accept and auto-decline | seller sets both; buyers are not told the limits |
| Does acceptance bind | accepting ends the listing; "in most cases" the buyer must pay at once |
| Seller offers to interested buyers | at least 5% below the price; go to "the 30 most recent interested buyers"; valid 96 hours; can repeat every 48 hours |
| Auctions | a first bid declines all open offers |
| Not available | the page lists cell phones, motors, real estate, tablets and tickets. Check per category before sending the field |

- A seller-sent offer does not reserve the item. It stays buyable until someone pays *observed*.
- **Room for offers** *agent proposal*: list at target price plus 10%. Auto-accept at the target. Auto-decline below 80% of list. Offers in between go to the user as a tap.
- **Markdowns.** Sale events in Seller Hub show a struck-through price *asserted*. Our markdown step revises the price through the API, then sends offers to watchers.
- **Bundles.** No closet-bundle feature. Buyers use a cart; sellers can set combined shipping *asserted*.

## 10. Promotion and boosts

| Tool | Cost | Use |
|---|---|---|
| Promoted Listings, general (was Standard) | a seller-set percent of the sale. Official minimum 2%; some sellers were held to 5% in a test on 2026-10-01 and 02 *observed* ([Value Added Resource](https://www.valueaddedresource.net/ebay-promoted-general-ad-rate-minimum-jumps/)) | commodity items with many identical listings |
| Promoted Listings priority (was Advanced), Promoted Offsite | cost per click, daily budget *asserted* | not for one-off used items |
| Subtitle, Bold, Gallery Plus | $2.00 to $6.00, $4.00, $1.00 on fixed price *observed* | skip; Gallery Plus is free in art, antiques, collectibles and pottery |
| Offers to watchers, sale events | free *observed* | always |
| Facebook Marketplace and Google Shopping reach | free, automatic ([prior note](../crosspost-and-delist.md)) | always |

**Attribution rule.** eBay: "The ad fee is charged when a buyer purchases the promoted item from a general ad that any buyer clicked on in the most recent 30 days. The item must be promoted at the time of click and the time of sale" *observed* (quoted in an [eBay community thread](https://community.ebay.com/forum/selling-57920/topic/promoted-listings-general-attribution-changes-coming-to-us-canada-january-13-2026-153958/), effective 2026-01-13). A promoted item that sells has almost always had one ad click, so the ad rate acts as a surcharge on nearly every promoted sale *inferred*. Suggested rates often run 5 to 12% *asserted (seller folklore)*.

It pays for identical items competing on one results page (phones, consoles, current sneakers) with margin to spare. It does not pay for a one-of-a-kind item that already tops its own narrow search. Default off, offered as a tap at 2 to 5% *agent proposal*.

## 11. Shipping and local pickup

- **Labels.** eBay sells discounted USPS, UPS and FedEx labels and uploads tracking itself *asserted*. From August 2026, delivery delays do not hurt the seller's rating when the item shipped on time with an eBay label *observed* ([Aug 2026 news](https://www.ebay.com/sellercenter/news/2026-august)). Always use eBay labels.
- **Who pays.** Both are common. Calculated shipping (buyer pays by weight and distance) is the safe default for mixed items. Free shipping passes the "Free shipping" filter, but the cost must go into the price *asserted*. Fees are the same either way *inferred*.
- **Services** *asserted (rates not checked today)*: USPS Ground Advantage for most parcels (70 lb limit); Media Mail for books, DVDs and vinyl; eBay Standard Envelope for cards, coins and stamps up to $20 an item and 3 oz, about a dollar with tracking; UPS and FedEx to 150 lb; freight above that.
- **Handling time.** A named Best Match input *observed*. Use 1 business day. Late shipments count against the seller *asserted*.
- **International.** With eBay International Shipping the seller ships to a US hub and eBay handles customs *asserted*. The 1.65% international fee does not apply *observed*. Leave it on.
- **Local pickup.** A shipping option on any listing. The buyer pays through eBay checkout and shows a code at pickup *asserted*. Fees still apply. For furniture and appliances it is the only sane eBay option, and Facebook Marketplace does the same with no fee.
- "Simple delivery" is an eBay UK scheme, not US *asserted*.

## 12. The algorithm

**What eBay says** *observed*. Best Match considers, in eBay's order: "How closely the listing matches the buyer's search terms", "How popular the item is", "The price of the item", "The quality of your listing (description, photos, and so on)", "How complete the listing is", "The listing terms of service, such as your return policy and handling time", and "Your track record as a seller".

The adapter controls six of the seven (section 15). Popularity (sales, watchers, clicks) builds over time and is not ours to set *inferred*.

**Seller folklore** (*asserted*, none confirmed by eBay): the engine is called Cassini; new listings get a short boost; stale listings do better after "End and Sell Similar" than after an edit; editing a title resets sales history; auctions should end Sunday evening; free shipping ranks higher. Buyers can also sort by "Newly listed" and by lowest price plus shipping *asserted*, and those views skip the ranking model *inferred*.

Relist versus edit *agent proposal*: a price revision keeps the listing id, watchers and offers; ending and relisting loses watchers. Prefer revise. Relist only after 60 days with no watchers.

## 13. Rules that bite

- **Automation.** The 2026 User Agreement bans robots and "LLM-driven bots" without eBay's permission; the API is the permitted route ([prior note](../crosspost-and-delist.md)). Every listing goes through the API with the user's OAuth consent and a tap to publish.
- **AI content.** No rule against AI-written text or AI-edited photos in the picture policy *observed (absence)*. eBay ships its own AI description and photo-to-listing tools *asserted (memory; a Nov 2026 Digital Commerce 360 headline covers a "visual identification" upgrade to the magical listing tool)*. The binding rule is accuracy.
- **Seller levels** *asserted (memory; [policy page](https://www.ebay.com/help/policies/selling-policies/seller-standards-policy?id=4347) found, not opened)*. Above Standard: defect rate at or under 2%, cases closed without seller resolution at or under 0.3%. Top Rated: 0.5%, 0.3%, late shipments under 3%, 100 sales. Defects are seller cancellations and unresolved cases. Below Standard pays 6% more in fees *observed* and loses search placement *asserted*.
- **Cancelling because it sold elsewhere is a defect** *asserted*. Require immediate payment and delist within seconds.
- **Selling limits.** Every account has a monthly limit shown in Seller Hub under "Monthly limits", reviewed by eBay each month, and "if you're new to selling in a particular category, we might limit how much you can sell" *observed* ([help page](https://www.ebay.com/help/selling/listings/selling-limits?id=4107), read 2026-11-14; it gives no numbers). New accounts are often capped near 10 items or $500 a month *asserted (memory)*. Read the limit and tell the user before queuing 30 items.
- **Duplicates.** One fixed-price listing per identical item *asserted (memory; [policy](https://www.ebay.com/help/policies/listing-policies/duplicate-listings-policy?id=4255) not opened)*. Dedupe by our SKU.
- **Off-eBay sales.** No phone numbers, emails or links in listings or messages *asserted*.
- **Returns.** A buyer can open "not as described" within 30 days even on a no-returns listing, and the seller pays return postage *asserted*. A lost payment dispute costs $20 *observed*.
- **Unpaid items.** Enforcement on non-paying buyers tightened in 2026 *observed*.
- **Prohibited or restricted** *asserted*: used cosmetics, used underwear, recalled items (drop-side cribs, some car seats), alcohol, tobacco and vapes, firearms and many parts, counterfeits and "inspired" goods. Brand owners can pull listings through VeRO.
- **Authenticity Guarantee** *asserted (memory; thresholds may have moved)*: eligible sneakers, handbags, watches, jewelry, trading cards and streetwear above a category price threshold go through an authenticator at no cost to the seller. The item must match the listing, so photos and condition must be honest.

## 14. What belongs here

Fee facts are *observed* (section 4). Demand claims are *asserted* (eBay's focus categories, memory). The verdicts are *inferred*.

| Product type | Verdict | Reason |
|---|---|---|
| vintage_clothing | good | strong search demand by tag, era and team; slower than Depop for trend pieces |
| streetwear | good | brand and season searches; authentication on pricier pieces |
| designer_clothing | good | national reach for rare sizes and archive pieces |
| womens_mall_brands | ok | sells by style name, but Poshmark's buyers are closer |
| mens_mainstream | good | buyer base leans male; Patagonia, Levi's, Nike search well |
| fast_fashion | avoid | $0.40 plus 13.6% plus postage leaves little under $15 |
| kids_baby_clothing | ok | works as lots, not single pieces |
| sneakers | best | 8% fee and no per-order fee at $150 and up; authentication |
| shoes_other | good | boots and dress shoes search by model and size |
| luxury_handbags | best | authentication builds trust; note the 15% fee |
| jewelry_watches | best | watch fee falls to 6.5% above $1,000; authentication |
| accessories | good | sunglasses and hats by model; cheap to post |
| outdoor_apparel | good | model names and technical specs suit search |
| fan_apparel | best | sports memorabilia and fan shop is core eBay |
| beauty | ok | new and sealed only; used cosmetics are banned |
| phones_computers | best | model-number search, national demand, parts market |
| cameras_audio_gaming | best | same; "for parts" units still sell |
| media | good | games and vinyl at 13.6%; books and DVDs pay 15.3% but ship by Media Mail |
| collectibles_cards_toys | best | eBay's strongest category; 13.25% on cards; envelope shipping |
| home_decor | good | small, shippable, pattern-name searches (pottery, glass) |
| small_appliances | good | model numbers and replacement parts |
| furniture | avoid | freight cost; local pickup only, which Facebook does free |
| large_appliances | avoid | local pickup only; sell the parts here instead |
| tools | best | brand and model searches; strong used power-tool demand |
| sporting_goods | good | golf, cycling parts, fishing; bulky fitness gear is avoid |
| instruments | good | guitars and basses at 6.7%; pedals and pro audio search by model |
| auto_parts_vehicles | best | part numbers and fitment data; vehicles use eBay Motors fees |
| baby_gear | ok | bulky to ship; cribs and car seats need a recall warning |
| antiques_art | good | auctions suit uncertain value; Gallery Plus is free here |
| handmade | ok | allowed, but buyers look on Etsy |
| bulk_lots | good | lots are a native format: card lots, LEGO by weight, clothing lots |

## 15. Adapter rules (agent proposal)

1. **Route.** API only, `VALIDATE` dry run, user taps to publish (13, prior notes).
2. **Category.** Leaf category from the Taxonomy API suggestion; show the top two if scores are close (7).
3. **Title.** `Brand Model/Line Type ModelNo Size Color Attribute`, at most 80 characters, aim for 65 to 80, no word twice, no caps-lock words, no other brand names (6).
4. **Specifics.** Fetch the category's aspects. Block publish if a required aspect is empty. Fill recommended aspects only from evidence (photo, tag, measurement). Map sizes to eBay's standardized values (5, 7).
5. **Condition.** Fetch allowed condition ids per category and map our wear grade to them. Always write a condition description listing each flaw we photographed (5, 8).
6. **Photos.** 8 to 12 (max 24), cover 1:1 at 1600 x 1600 JPEG, in the section 8 order. Reject any image with text, border or watermark. Touch-up note: "Light and color corrected. Background and item unchanged."
7. **Price.** Target plus 10%. Best Offer on where the category allows. Auto-accept at target, auto-decline under 80% of list. Immediate payment on (9, 13).
8. **Offers.** After 7 days with watchers and no sale, send watchers an offer at 5 to 10% off. Repeat at most every 14 days (9).
9. **Shipping.** Calculated shipping from our measured weight and size, eBay label, 1-day handling, International Shipping on. Media Mail for books and discs. Standard Envelope for cards under $20 (11).
10. **Returns.** 30 days, buyer pays return postage (12).
11. **Promotion.** Off by default (10).
12. **Refresh.** Revise the price down 5 to 10% every 21 days without a sale. No end-and-relist before 60 days (12).
13. **Refuse.** Used cosmetics, used underwear, recalled items, replicas (13).
14. **Warn and suggest another platform.** `furniture`, `large_appliances`, `fast_fashion` under $15, single low-value kids pieces (suggest a lot) (14).
15. **Account guard.** Read the selling limit and seller level at connect. Stop auto-posting at the limit (13).

**Human taps, never automatic:** publish; auction instead of fixed price; any offer between the auto thresholds; turning on Promoted Listings; a price cut past 20% below the first price; cancelling an order; accepting a return or refunding; using eBay's white-background tool.

## 16. References, limits and log

| Source | Job | What we take |
|---|---|---|
| [eBay selling fees](https://www.ebay.com/help/selling/fees-credits-invoices/selling-fees?id=4822) | evidence | fee table for net-payout math per category |
| [Best Match help](https://www.ebay.com/help/Selling/-/Optimizing_your_listings_for_Best_Match?id=4166) | evidence, mechanism | the seven stated factors; format advice |
| [Picture policy](https://www.ebay.com/help/policies/listing-policies/picture-policy?id=4370), [Adding pictures](https://www.ebay.com/help/selling/listings/adding-pictures-listings?id=4148) | mechanism | photo validation and capture guidance |
| [Best Offer help](https://www.ebay.com/help/selling/listings/selling-buy-now/adding-best-offer-listing?id=4144) | mechanism | offer clocks and thresholds |
| [Feb 2025 fee update](https://www.ebay.com/sellercenter/resources/seller-updates/2025-january/final-value-fee), [Seller News Aug 2026](https://www.ebay.com/sellercenter/news/2026-august), [Jan 2026](https://www.ebay.com/sellercenter/news/2026-january) | evidence | date of the 13.6% rate; size standardization; delay protection |
| [Attribution thread](https://community.ebay.com/forum/selling-57920/topic/promoted-listings-general-attribution-changes-coming-to-us-canada-january-13-2026-153958/) (quotes eBay) | evidence | the any-click rule. Re-check on [eBay's attribution page](https://pages.ebay.com/sell/pl/attribution.html) (unopened) |
| [Value Added Resource, ad minimum](https://www.valueaddedresource.net/ebay-promoted-general-ad-rate-minimum-jumps/) (trade blog) | evidence | 2% minimum, 5% test |
| [FashionUnited, Depop close](https://fashionunited.com/news/business/ebay-completes-1-4-billion-dollar-depop-acquisition/2026073073828) | evidence | close date; Depop keeps its platform |
| Prior notes: [crosspost-and-delist](../crosspost-and-delist.md), [posting-browser-use-ebay](../posting-browser-use-ebay.md) | mechanism | API route, User Agreement clause, Facebook reach |

All rows were opened today except where marked, through a fetch summarizer, so quotes come from its excerpts.

**What I searched and couldn't reach.** The session's shared fetch budget (100 pages an hour across all helpers) ran out after about ten pages, and search returned titles and links with no page text. Found but not opened, so their content here is from memory: seller standards policy, new item conditions (2025), Authenticity Guarantee, Standard Envelope, selling limits, duplicate listings policy, Promoted Listings help, International Shipping, return policy setup, eBay Q3 2026 results, the List Perfectly and Shopifreaks pieces on Depop, reports of AI model images in listings, and the Flowlister sell-through tables. I found no eBay statement on eBay to Depop cross-listing; that does not prove none exists. eBay Live, the vault and eBay Refurbished were not researched.

**Seed frontier log**

- **Loop 1** (seeds: fees page, Best Match help, Depop close news). Changed: 13.6% plus $0.30 or $0.40, no 2026 US change; Depop closed 2026-07-30. Contrary lead: did UK-style free selling reach the US? No, the US page still charges.
- **Loop 2** (seeds: picture policy, adding pictures, Best Offer help, Feb 2025 fee update). Changed: offer clocks are 24 and 96 hours, not 48; 1:1 or 16:9; eBay's own AI backgrounds. Contrary lead: does eBay ban AI photos? No rule found.
- **Loop 3** (seeds: Seller News Jan and Aug 2026, attribution thread, Value Added Resource on ad minimums). Changed: any-click attribution from 2026-01-13; size standardization; delay protection with eBay labels. Next seeds were seller standards, conditions, Authenticity Guarantee and envelope rates. Stopped by the fetch budget, not by convergence.
