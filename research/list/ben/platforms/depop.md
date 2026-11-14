# How do we post on Depop (US) so it sells, and what belongs there?
Researched 2026-11-14 by Ben (Claude Code research helper). Feature: list.

The posting route, delist and webhooks are in [crosspost-and-delist.md](../crosspost-and-delist.md). What Ben's earlier tool taught is in [depop-plus-lessons.md](../../../cross-cutting/ben/depop-plus-lessons.md). Claims from Ben's depop-plus notes are marked *asserted (Ben)* until a source opened today confirms them.

**Limit.** Page reads and searches were rationed and some Depop help pages refused to load. *Observed* means read at the source today. Section 16 lists what was not reached.

## 1. Short answer

1. **Offers are the main lever.** "Over 40% of all items are now bought via offers", at an average 23% discount *observed* (Depop, Jan 2024). Price with room and set both auto-offer prices on every listing.
2. **Relevance ranks first, then popularity** (views, likes, adds to bag) *observed*. An item "will only show up when its listing details match" the buyer's filters *observed*, so fill every field. Depop's ranking pages never mention hashtags *observed*.
3. **The first line of the description is the title.** No title field exists in any partner API request schema *observed*. The description holds 1,000 characters and up to 5 hashtags *observed*.
4. **Photos: 1 to 8, the seller's own, first one is the cover** *observed*. Square is the house shape.
5. **0% seller fee in the US**, plus 3.3% + $0.45 processing on item, shipping and tax *observed*. Cheap clothes work here.
6. **Boost is a 12% decision, not a default.** Depop told sellers "the fee for boosting will increase from 8% to 12% on March 23" (2026) *observed* (quoted by Value Added Resource).
7. **It is a fashion site.** Consumer electronics have been banned since 13 July 2020 *observed*. A couch is `avoid`, not banned: Depop has a Home > Furniture category *observed*, but it ships only and the buyers want clothes *inferred*.
8. **Biggest difference from the other platforms:** a partner API with OAuth, webhooks and offer automation, so the adapter posts, negotiates and delists without a browser. And the buyers are young: "almost 90% under 34" *observed*.

## 2. Draft from memory, and what changed

Draft (memory): 0% US fee since July 2024; 3.3% + $0.45; buyer fee up to 5% + $1; boost 8%; offers last 24 hours; 8 photos plus video; 1,000 characters; 5 hashtags; no title; eBay deal pending; 90% of users under 26.

Changed after searching (sources in the sections named):

1. eBay closed the purchase on 30 July 2026 and "paid $1.4 billion in cash, inclusive of preliminary purchase price adjustments" (announced at $1.2 billion) *observed* ([eBay Q2 2026 8-K exhibit](https://www.sec.gov/Archives/edgar/data/0001065088/000106508826000174/exhibit991erebayq22026.htm)).
2. The age line is now "almost 90% under 34" *observed* (§3).
3. Boost is 12% for boosts made from 23 March 2026, up from 8% *observed* (§4). Ben's "12% from March 2026" held up.
4. An accepted offer does not bind the buyer, and a seller "can accept more than one offer" *observed* (§9).
5. The API sends an offer one hour after a like, and accepts or counters buyer offers at a set price *observed* (§9).
6. Depop's Photoroom editor lets sellers "instantly remove backgrounds" *observed* (§8). Our rule forbids that.
7. Ben's field limits all held up. The API has no title field and no video field *observed* (§5).
8. Depop's AI description tool launched on 12 September 2024, not January 2025 *observed* ([Depop news](https://news.depop.com/company-news/depop-launches-ai-powered-listing-from-one-photo/)). From one photo it writes the description and fills category, colour and brand. Price suggestion now has an API face, the Pricing Inspiration endpoint (May 2026) *observed* (§5).
9. Depop publishes seven ranking factors *observed* (§12). Rating and response time are not on the list; the seller's country is.
10. Furniture is not banned: Depop has a Home > Furniture category *observed (category URL)*. It is still `avoid` (§14).
11. Top Seller needs three months, not four, plus 50 new listings a month *observed* (§13).
12. API partners may not also use browser automation on Depop *observed* (§13).
13. The photo and free-shipping statistics come from a handbook that still quotes a 10% fee, and the offer statistics describe 2023 *observed*.

## 3. Who buys here and what sells

- **Size.** About 7 million active buyers and more than 3 million active sellers at 31 Dec 2025 *observed* (Retail Insight Network, reporting eBay). About $1 billion in 2025 sales *asserted (memory of the Feb 2026 deal release)*.
- **Age.** "Almost 90% under 34" *observed*. Ben's "90% under 26" *asserted (Ben)* is an older line and is no longer the one eBay uses.
- **Owner.** eBay since 30 July 2026. Depop "will continue to run under its existing brand, platform and customer experience" *observed*. eBay plans to add its shipping, personalisation and compliance services *observed*. I found no seller-facing change yet: no eBay crosslisting or authentication in the pages opened, and the partner API changelog through September 2026 does not mention eBay *observed*. Absence in the app is *not confirmed*.
- **What sells.** Depop names three main categories, "Menswear, Womenswear, and Jewelry", with outerwear, bottoms, tops, dresses, shoes and accessories as top sellers. It also names "homeware, art, records, cameras" *observed* ([Depop blog, undated](https://blog.depop.com/articles/what-to-sell-on-depop)).
- **Price band and timing.** Sales of $20 to $60, apparel about 60% *asserted (Ben)*; not re-checked. "Sundays and Mondays are the biggest days for accepting offers" *observed* ([Depop news, 9 Jan 2024](https://news.depop.com/company-news/depop-community-embraces-offers-as-suite-of-negotiation-tools-expands/)).

## 4. Money

| Fee (US seller) | Amount | Mark |
|---|---|---|
| Selling fee | 0% for "new listings from July 15 2024" | *observed* ([Seller fees and charges](https://depophelp.zendesk.com/hc/en-gb/articles/360001791127-Seller-fees-and-charges)). Held up |
| Payment processing | 3.3% + $0.45 on "item sale price plus shipping costs and any applicable taxes" | *observed*. Held up |
| Sellers outside the UK and US | 10% | *observed*. Held up |
| Buyer marketplace fee | "Up to 5% of the item purchase price, plus a fixed amount of up to $1", paid by the buyer, from 18 July 2024 | *observed* ([Depop news, 15 Jul 2024](https://news.depop.com/company-news/depop-removes-selling-fees-in-the-united-states-evolves-fee-structure/)). Held up |
| Boosting fee | 12% for boosts made from 23 March 2026 (8% before), on item price without tax, plus shipping when the seller arranges it. Charged when the buyer purchases "within 28 days of seeing your boosted listing on Depop". Can be turned off at any time | *observed* (Depop's notice, quoted by [Value Added Resource, 3 Mar 2026](https://www.valueaddedresource.net/depop-raises-boosted-listing-ad-fees/)). The quoted notice names no country; the UK rose in Nov 2025, so 12% for the US is *inferred*. Ben's 28 days held up |
| Payout | "All fees are deducted before your sale proceeds are paid to your bank account" *observed*. Days to payout not found | |

Worked examples *inferred* from the observed rates. Assumed: buyer pays shipping, 8% sales tax on item plus shipping.

| | $40 item, $6 shipping | $200 item, $9 shipping |
|---|---|---|
| Charged to the buyer (before the buyer fee) | $49.68 | $225.72 |
| Processing fee | $2.09 | $7.90 |
| **Seller nets** | **$37.91** | **$192.10** |
| Boosted at 12% | $33.11 | $168.10 |
| Free shipping, seller pays the label | $32.12 | $183.42 |

The fixed $0.45 is 4.5% of a $10 item, so about $8 is the floor for a sensible listing *inferred*.

## 5. Listing fields and hard limits

Every row is *observed* today in the partner API [Reference](https://partnerapi.depop.com/api-docs/reference/), [first listing guide](https://partnerapi.depop.com/api-docs/getting-started/your-first-listing/) or [Taxonomy](https://partnerapi.depop.com/api-docs/concepts/taxonomy/) unless marked. Ben's limits held up.

| Field | Limit |
|---|---|
| Title | None. The description's first words become the page slug |
| `description` | Required. Max 1,000 characters. No email addresses. Up to 5 hashtags |
| `pictures` | Required. 1 to 8 URLs. "First image is the main image". No shape rule in the request; Depop serves them at 1280 by 1280. A URL can carry a `#type=` label (`cover-image`, `back`, `tag`) |
| Picture shape | Square, 640 minimum *asserted (Ben)* |
| Video | No video field. In the app, 1 video *asserted (Ben)* |
| `department` | Required. `womenswear`, `menswear`, `kidswear`, `everything-else` |
| `product_type` | Required. From `api.depop.com/api/v3/attributes/` (bot-protected, read it through a browser) |
| `size_set_id`, `size_id` | Required when the product type has sizes. Sets differ by region |
| `condition` | Required. `brand_new`, `used_like_new`, `used_excellent`, `used_good`, `used_fair` |
| `colour` | Max 2: black, grey, white, brown, tan, cream, yellow, red, burgundy, orange, pink, purple, blue, navy, green, khaki, multi, silver, gold |
| `style` | Max 3: streetwear, sportswear, loungewear, goth, retro, boho, western, indie, skater, rave, costume, cosplay, grunge, emo, minimalist, preppy, avant_garde, punk, glam, regency, casual, techwear, futuristic, cottage, fairy, kidcore, y2_k, biker, gorpcore, twee, coquette, whimsygoth |
| `age` | Max 1: modern, y2k, 90s, 80s, 70s, 60s, 50s, antique |
| `source` | Max 2: vintage, preloved, reworked, custom, handmade, deadstock, designer, repaired |
| `brand_name` | Required. Matched to the closest known brand; no match silently becomes "unbranded" |
| `attributes` | Per product type (material, occasion, sleeve-length, body-fit and more), each with `max_selection` and `is_mandatory` |
| `price_amount` | Required. "Must be at least $1.00 or £1.00." No maximum stated |
| `discount_price` | Optional sale price, below the price |
| `quantity` | Required. Minimum 1 |
| Shipping | `national_shipping_cost` (0 means free) or `depop_shipping` (`address_id`, `shipping_provider_id`, `parcel_size_id`, `payer`), never both |
| Auto offers | `auto_send_offer_price`, `auto_negotiate_offer_price`: each at least 5% below the price |
| `is_boosted` | Optional boolean |
| `sku` | Max 50 characters, unique, "can't be reused" |
| Image format | PNG and WebP are converted to JPEG on a white background, with no transparency. Send JPEG |

API changes in 2026 that matter here *observed* ([Changelog](https://partnerapi.depop.com/api-docs/changelog/)): Depop label shipping (Jan), `discount_price` and manual offers (Feb), `is_boosted` (Apr), a **Pricing Inspiration endpoint** giving predicted price ranges and similar sold items for the US and UK (May), shop and product insights (Jun, Jul), self-serve webhooks (Aug). Sold or deleted listings can be restocked (May 2025). Nothing in it mentions eBay, a title or video.

## 6. Title and description conventions

Depop's current rule: "Include measurements and any signs of wear. Leave out anything that isn't about the item." Unrelated information, such as a brand you are not selling, "can hurt your listing's exposure" *observed* (Depop search ranking page, §12). The old [US Seller Handbook](https://sellers.depop.com/Seller_Handbook_Final_US.pdf) says the same: "only mention/hashtag relevant brands" *observed*.

Formula *agent proposal*: line 1 is the stand-in title, 50 to 65 characters, `Brand + item + one detail + size`. Line 2 is condition and every flaw. Line 3 is our measurements and fit. Line 4 is material and era. The last line is up to 5 hashtags. Tone: short, first person, no sales talk *asserted (seller norm, memory)*.

```
Vintage Carhartt Detroit jacket, brown duck canvas, size L
Good used condition. Fading on cuffs, small paint mark on left sleeve (photo 5).
Pit to pit 24 in, length 26 in. Boxy fit.
Blanket lined, 90s, made in USA tag.
#carhartt #detroitjacket #workwear #vintage #90s
```

```
Olympus Stylus Epic 35mm film camera, black, tested
Shutter, flash and film advance tested with a roll. Light scuffs on the door.
Comes with strap and case. Takes one CR123A battery (not included).
#olympus #filmcamera #35mm #pointandshoot
```

Leave out: brands the item is not, emoji walls, shop policy text, links, email addresses (the API rejects them) and any contact details.

## 7. Tags, categories and structured data

- Structured fields decide filter visibility. When buyers filter by colour or condition, "your item will only show up when its listing details match those filters" *observed* (Depop search ranking page, §12). A blank field removes the listing from that filtered search. Mandatory attributes vary by product type *observed*, so the adapter reads the taxonomy before it validates.
- Spam: the old handbook says "irrelevant tags or brand spamming" reduce relevancy *observed*. The API caps hashtags at 5 *observed*.
- The recipe of exactly 5 tags (1 brand, 1 era, 1 aesthetic, 2 category) is *asserted (Ben, seller folklore)*. Nothing from Depop gives a recipe.
- **Contrary lead, answered in part.** I found no Depop sentence saying hashtags stopped counting. But Depop's two current pages on search ranking never mention hashtags *observed*; they talk about relevance, listing details and filters. Against that, Depop's AI description tool (Sept 2024) writes descriptions that "include relevant hashtags" *observed*. Style, age, source and brand are separate fields, so most classic tags (#vintage, #y2k, #nike) repeat a field *inferred*. Treat hashtags as optional: harmless when true, harmful when stuffed.

## 8. Photos

| Topic | What Depop says | Mark |
|---|---|---|
| Own photos only | "Only use photos taken by yourself." Stock images are "an infringement of property rights, which is why we don't allow it" | *observed* ([stock images](https://depophelp.zendesk.com/hc/en-gb/articles/360026574274-What-are-stock-images)). Held up |
| Count | Up to 8. "4 photos lift sales 20%" dates from when 4 was the cap | *observed* (API; old handbook). Stale |
| Cover style | "If you're not using a model, go for flat lays not hanger shots." Flat lays "up to 60% more likely to sell" than hanger shots. Mix model shots, flat lays and close-ups; show tags and flaws | *observed* (old handbook). Matches Ben's "modeled beats flat lay" |
| Angles | "Show your item from every angle and highlight details and flaws" | *observed* (Depop search ranking page, current) |
| Light, video | Indirect sunlight. Video is shown first in the app | *observed* (old handbook). The 40% video lift is *asserted (Ben)*, not found |
| Depop's editor | "Photo editing is now available in the listing flow, powered by Photoroom." Sellers can "instantly remove backgrounds" and "enhance images with drop shadows" | *observed* ([Depop blog, 25 Jun 2025](https://www.depop.com/blog/depop-product-release-june-2025/), [Depop news, 26 Jun 2025](https://news.depop.com/company-news/depop-partners-with-photoroom-to-bring-ai-powered-photo-editing-to-millions/)) |
| AI-generated images, watermarks, text, collages | No Depop rule found. The stock image page and the Seller Misrepresentation Policy do not mention AI or edited photos *observed* | The "own photos" rule and the 30-day "not as described" refund are what bind |

### Under Ben's touch-up rule

Our app fixes light and colour, crops and straightens. It never changes the background, the item or the wear.

- **What we skip.** Depop's editor removes backgrounds *observed*. We do not. Depop offers a cut-out; it does not require one. A real floor or wall is the long-standing Depop look *asserted (seller norm, memory)*.
- **Meet the look at capture** *agent proposal*: plain wall, door or clean floor; window daylight, no flash; flat lay before hanger; the item fills the square with a small margin; one worn shot if the user wants it.
- **Crop and order** *agent proposal*: every picture 1:1 at 1280 by 1280. Order: front as cover (`cover-image`), back (`back`), brand and size label (`tag`), fabric close-up, each flaw, a measurement shot, a worn shot. Send 5 to 8, never fewer than 4.
- **Touch-up only**: white balance, exposure, straighten, square crop. Flaw photos get exposure only.
- **What the rule costs**: no white cut-out covers and no generated model shots. We cope by coaching the shot (a framing guide and a "too dark" warning) and choosing the cleanest real frame as the cover.

## 9. Pricing and offers

| Mechanic | Rule | Mark |
|---|---|---|
| Buyer offers | "You can only have one active offer per item." "You can't edit an offer once sent" | *observed* ([Make Offer](https://depophelp.zendesk.com/hc/en-gb/articles/4412315779345-Make-Offer)). Held up |
| Country | "You can't send offers on items outside your country" | *observed*. Held up |
| Expiry | "If there's no response within 24 hours, the offer expires" | *observed*. Held up |
| After acceptance | Buyer has 24 hours to pay. "Until you do this, someone else could buy it" | *observed*. Not binding |
| Several buyers | "You can accept more than one offer"; first to pay wins. Offers exclude shipping | *observed* |
| Send Offer | "Buyers have 24 hours to buy or counter-offer before the offer expires" | *observed* (Depop news, Jan 2024) |
| API manual offer | Only to buyers who showed interest "(likes, bags, messages)"; at least 5% below price | *observed* ([Managing Offers](https://partnerapi.depop.com/api-docs/how-to-guides/managing-offers/)) |
| API auto-send | Sent one hour after a like or bag; fixed delay | *observed* |
| API auto-negotiate | Offers at or above the threshold are accepted; lower ones are countered at the threshold, in about a minute | *observed* |
| Discounts | "You can set discounts from 5% to 95%" on any number of items. Buyers see the sale price beside the original and a discount tag on the photo. By API: `discount_price`, and auto-offer prices must then sit 5% below it | *observed* ([Discounts](https://depophelp.zendesk.com/hc/en-gb/articles/360033415634-Discounts), API Reference) |
| Shipping Discounts | US sellers with Depop Shipping can take $2, $3 or $4 off shipping, or make it free (set in the iOS app) | *observed* (same page) |
| Cannot be cancelled; 15% prefill; no offers on multi-size listings | | *asserted (Ben)*; not found. The API takes a `size_id` for offers on multi-size products *observed*, which points against the last one |
| Bundles | A help article exists | *observed (title only)* |

How to price *agent proposal*: take the target from Depop's own Pricing Inspiration endpoint (predicted range and similar sold items *observed*), which answers the "no sold prices" gap in the depop-plus lessons. Then list at target divided by 0.85, auto-send at 10% under list, and auto-negotiate at the user's floor. Depop adds that many likes and few buyers "may mean the item is overpriced" *observed*.

## 10. Promotion and boosts

| Tool | Cost and effect | Evidence |
|---|---|---|
| Boosted Listings | 12% of item price, charged on a sale "within 28 days of seeing your boosted listing" (§4). Seeing, not clicking | *observed* |
| Boost Shop | Same fee; "automates promotion across all current and future listings" | *observed* (25 Jun 2025) |
| Lift | "Boosting listings can increase chances of selling by 25%" | *observed* (Depop's claim, no method). Held up |
| Outfits | Buyer collages of listings, launched Sept 2025 | *observed (titles and dates only)*; nothing for the adapter to set |

Boost pays on items over about $40 in crowded searches. It does not pay under $25, or on items that already have likes, where a free offer reaches the same people *inferred*.

## 11. Shipping and local pickup

- Depop Shipping is USPS, delivered as a QR code or printable label, and "fully tracked", so the seller does not add tracking or mark the order shipped *observed* ([Shipping on Depop, US](https://depophelp.zendesk.com/hc/en-gb/articles/16523051318033-How-to-ship-US)). With your own carrier: "Always use a tracked shipping method" and add the tracking number to complete the sale *observed*.
- Prices by weight tier, about $4.49 under 4 oz up to about $16 under 10 lb, are *asserted (Ben)*. The help page has no price table today, so they are *not confirmed*.
- "Most sellers ship within 2 days" *observed* (same page). It states no deadline.
- The API can attach a Depop label by `parcel_size_id` and set who pays *observed*.
- "Offering free shipping doubles your chances of selling", and untracked parcels "aren't covered by Seller Protection" *observed* (old handbook). Processing is charged on shipping either way *observed*.
- A 3-day shipping rule is *asserted (Ben)*; the Top Seller code has no shipping-time rule *observed*.
- **Local pickup: none found.** Every listing needs a shipping cost or a Depop label *observed*. This is why furniture fails here.

## 12. The algorithm

Depop publishes its factors. This is its list, in its order, *observed* today ([How Depop ranks search results and recommends listings](https://depophelp.zendesk.com/hc/en-gb/articles/9422984899985-How-Depop-ranks-search-results-and-recommends-listings), undated):

| # | Factor, in Depop's words | Ben's claim |
|---|---|---|
| 1 | "The relevance of the listing to your search terms". Depop says this has the biggest impact | Held up |
| 2 | "The popularity of the listing, as inferred by how many views, likes and 'add to bags'" | Held up |
| 3 | "The seller's location setting": mainly listings from the buyer's country | New |
| 4 | "Your shopping habits, for example, which brands, styles, sizes and prices you like" | Held up. The "300 views, 600 results" detail was not found |
| 5 | "When the item was listed." "Newer items are slightly favoured in the ranking than older ones" | Held up: a minor factor |
| 6 | "Information about the seller", including items sold and views | Held up for sales history. Rating and response time are not named |
| 7 | "Whether an item has been boosted or not" | Held up |

- "A seller's Top Seller or verified status does not have an impact on the ranking of their listings" *observed*. Held up.
- When a buyer sorts by price or by age, only relevance and seller location apply before the sort *observed*.
- Following policies is "one of the main factors we consider when ranking listings"; a listing or account that falls short "may be ranked lower or removed" *observed* ([Improving the search ranking of your items](https://depophelp.zendesk.com/hc/en-gb/articles/360050410093-Improving-the-search-ranking-of-your-items)).
- Neither page mentions hashtags, relisting or refreshing *observed*.
- Ben's 18% relist lift and the spam detection for daily relists were not found: *asserted (Ben)*.

Relist versus edit *inferred*: a SKU "can't be reused" *observed*, so a relist is a new product. It trades all its popularity (factor 2) for a slight age edge (factor 5). Edit in place, and relist only a listing with no likes. The API's restock call revives a sold or deleted listing *observed*; whether it keeps likes is not stated.

## 13. Rules that bite

Every row is *observed* at the linked Depop page today unless marked.

| Area | Rule | Source |
|---|---|---|
| Electronics | Banned "from 13th July 2020": phones, speakers, headphones, consoles and controllers, computers, tablets, smartwatches, fitness trackers, hair stylers, lighting, appliances, TVs, chargers. Allowed: cameras, film and lenses; phone and laptop cases; analog and digital wristwatches | [Electronics Policy](https://depophelp.zendesk.com/hc/en-gb/articles/22500114413841-Electronics-Policy) |
| Hazardous | "Knives and sharp implements of any type"; weapons; "smoking accessories including rolling papers, filters, lighters and ashtrays"; alcohol; medicines and "medical devices and products"; flammable gases and liquids; gift cards and tickets; "recalled items" | [Restricted and Hazardous Content Policy](https://depophelp.zendesk.com/hc/en-gb/articles/22503846834833-Restricted-and-Hazardous-Content-Policy) |
| Safety | Baby and child items "that don't meet regulatory safety requirements" (carriers, cots, car seats); toys that fail them (button batteries, magnets, small parts); cosmetics with hazardous ingredients. Furniture and vehicles are not mentioned | Same |
| Truth | No "misrepresenting recently mass produced items as 'vintage'" or as "handmade"; no "misleading or inaccurate information in the description or brand section". A buyer gets a full refund for an item "significantly not as described" reported within 30 days | [Seller Misrepresentation Policy](https://depophelp.zendesk.com/hc/en-gb/articles/27193479045265-Seller-Misrepresentation-Policy) |
| Fakes and media | Counterfeits, pirated media, digital downloads and codes; stock or lifted photos | Depop blog; stock images page |
| Payment | Depop Payments only: "No other payment methods are allowed". An out-of-app payment can end the account. Held up | [Terms of Service](https://depophelp.zendesk.com/hc/en-gb/articles/360001773148-Terms-of-Service), "Effective from 23 October 2023" |
| Automation | Users may not "use any bots or other third party software on the Service" or "mine data, scrape or crawl" it. Held up | Same |
| Accounts and stock | Not allowed: "Offer to sell an item that you do not possess"; "Create more than one Account"; links to other sites; email addresses in descriptions (the API rejects them) | Same; API Reference |
| API partners | May not "use or promote the use of automated systems or browser extensions to access, analyse, or scrape the Depop Platform"; may not "divert sales or migrate Depop users from Depop"; may not use API content "for purposes of analytics, machine learning" without written permission; must "promptly remove any Listing" when required. Depop can end access "with 30 days' written notice" | [API Access Service Terms](https://partnerapi.depop.com/api-docs/terms/), published 22 Apr 2026 |
| Top Seller | "All of the following goals for three consecutive months": $1,000 in sales a month, 50 new listings a month, lifetime rating 4.5 or higher, disputes under 3% of lifetime sales. "Drop-shipping is banned on Depop". Ben's $1,000 and 4.5 stars held up; his 4 months, 5% refund rate and 90% shipped in 5 days did not appear | [Top Seller Code of Conduct v2](https://assets.depop.com/sellers/assets/TSP-Code-of-Conduct-v2.pdf), undated |
| Not confirmed | Duplicate listings (not in the Terms; *asserted (Ben)*). Crosslisting tools accepted in a 2026 terms update (*asserted*, [route note](../crosspost-and-delist.md); neither terms page I opened says so). Sealed-only cosmetics and a perfume ban (*asserted*, [List Perfectly](https://listperfectly.com/tips/depop-prohibited-items-guide/)) | Depop's main prohibited items page refused to load three times |

For a tool posting for a user:

- The partner API is the permitted door. Once we hold API access, its terms also rule out a browser agent or extension on Depop *observed*. So "Browser Use and replay until granted" in the route note needs a second look *inferred*.
- Until access is granted, two routes stay inside the rules *agent proposal*: write Depop's own bulk-upload CSV for the user to upload (web listing has supported CSV bulk uploads since June 2025 *observed*), or fill the form in a session the user drives.
- Our data loop should not train on Depop API content, and "post this elsewhere" advice should be worded as fit *inferred*.
- Keep the user's tap on publish, one live listing per item, and delist within minutes of a sale elsewhere.

## 14. What belongs here

Depop calls itself "a fashion marketplace" *observed*. Everything that is not clothing goes in one department, `everything-else` *observed*. Under it Depop has live category pages for Home (with Furniture), Toys (with Trading cards and Action figures and playsets), Beauty (Skincare, Makeup), Art, Books and Magazines, Music and Sports Equipment *observed (category URLs in search results; the pages refused to load)*. I found no category for tools, instruments, baby gear, vehicles or electronics. The adapter should read the taxonomy once to settle the rest.

| Product type | Verdict | Reason | Mark |
|---|---|---|---|
| vintage_clothing | best | Depop's core; tees, denim, outerwear named as top sellers | *observed* |
| streetwear | best | The core under-34 buyer | *inferred* |
| designer_clothing | good | Archive pieces sell; no authentication found, so trust caps the price | *inferred* |
| womens_mall_brands | good | Dresses, tops, leggings named as top sellers | *observed* |
| mens_mainstream | good | Menswear is a main category | *observed* |
| fast_fashion | ok | 0% fee helps; $0.45 plus shipping hurts under $8 | *inferred* |
| kids_baby_clothing | ok | `kidswear` exists, but few buyers are parents | *observed*, *inferred* |
| sneakers | good | "Trainers" named in top shoes | *observed* |
| shoes_other | good | Boots, heels, platforms, sandals named | *observed* |
| luxury_handbags | ok | Bags sell; counterfeit rule and no authentication | *inferred* |
| jewelry_watches | good | Jewelry is a main category; wristwatches allowed, smartwatches banned | *observed* |
| accessories | good | Hats, scarves, sunglasses, belts named | *observed* |
| outdoor_apparel | good | Fleeces, windbreakers, puffers named; `gorpcore` is a style value | *observed* |
| fan_apparel | good | "Jersey" named under tops | *observed* |
| beauty | ok | A Beauty category exists (skincare, makeup); the policy bans only hazardous ingredients. Used makeup is a hard sell, and perfume may fall under flammable liquids | *observed*, *inferred* |
| phones_computers | blocked | Electronics Policy | *observed* |
| cameras_audio_gaming | blocked | Headphones, speakers, consoles banned. **Cameras, film and lenses are allowed: post those** | *observed* |
| media | ok | Music and Books and Magazines categories exist; "records" named; game discs unclear | *observed* |
| collectibles_cards_toys | ok | Toys category with Trading cards and Action figures; a side shelf, not the main draw | *observed* |
| home_decor | ok | "Homeware" named; small shippable pieces. No lighting, ashtrays or lighters | *observed* |
| small_appliances | blocked | "Appliances" in the Electronics Policy | *observed* |
| furniture | avoid | Allowed: a Home > Furniture category exists. Pointless: ships only, no local pickup, fashion buyers | *observed*, *inferred* |
| large_appliances | blocked | Electronics Policy | *observed* |
| tools | avoid | "Knives and sharp implements of any type" are banned; power tools are electronics; no buyers | *observed*, *inferred* |
| sporting_goods | ok | A Sports Equipment category exists; small gear only (skates, boards). Bikes and machines cannot ship | *observed*, *inferred* |
| instruments | avoid | Amps and pedals are electronics; no buyers | *inferred* |
| auto_parts_vehicles | blocked | No category, no local handoff | *inferred* |
| baby_gear | avoid | Cots and car seats must meet safety rules we cannot verify; recalled items banned; bulky | *observed*, *inferred* |
| antiques_art | ok | "Art" named; small prints, not heavy antiques | *observed* |
| handmade | good | `handmade`, `custom`, `reworked` are source values | *observed* |
| bulk_lots | avoid | Buyers pick single pieces | *inferred* |

## 15. Adapter rules (agent proposal)

All *agent proposal*.

1. **Route.** Partner API. Validate against the live taxonomy before the user sees the draft (§5).
2. **Refuse.** `phones_computers`, `small_appliances`, `large_appliances`, `auto_parts_vehicles`, and the audio and gaming half of `cameras_audio_gaming`: "Depop does not allow electronics". Also refuse knives and blades, lighters and ashtrays, lamps, car seats and cots (§13).
3. **Warn and point elsewhere.** `furniture`, `tools`, `instruments`, `baby_gear`, `bulk_lots`, bikes and machines: "Depop buyers shop for clothes and it ships only" (§14).
4. **Title.** Line 1 of the description, `Brand + item + detail + size`, 50 to 65 characters (§6).
5. **Description.** Five lines as in §6, under 1,000 characters, flaws always stated, no email or links.
6. **Tags.** 0 to 5, at the end, each true, at most one brand (§7).
7. **Fields.** Fill every field in §5 and every mandatory attribute. Low confidence on brand or size becomes a question. Set `vintage` or `handmade` only with evidence (a dated label, the user's word), since Depop bans those as false claims (§13). After create, read the product back, because an unmatched brand silently becomes "unbranded".
8. **Photos.** 5 to 8, each 1:1 at 1280 by 1280, in the order in §8, with `#type=` labels. Note in our record: "light and colour corrected, nothing removed".
9. **Price.** Target from Pricing Inspiration where it returns a range, divided by 0.85, rounded to a dollar. Skip Depop under $8 (§4, §9).
10. **Offers.** `auto_send_offer_price` 10% under list. `auto_negotiate_offer_price` at the user's floor, capped at 5% under list (§9).
11. **Refresh.** Edit in place; never relist a listing that has likes, because popularity ranks above age. After 21 days, propose a 10% cut through `discount_price` and reset both offer prices. Offer a relist (new SKU) only for a listing with no likes (§12).
12. **Shipping.** `depop_shipping` with the parcel size from our weight, buyer pays. At $30 and up, offer free shipping with the label folded into the price (§11).
13. **Boost.** Never send `is_boosted: true` without a tap. Omit the field on updates (§10).
14. **Sold means paid.** An accepted offer is not a sale. Delist elsewhere on the order webhook only (§9).

A tap, not automatic: publish; boost; any offer below the floor; a manual offer to one buyer; designer brand claims; a photo with a person in it; cancel or refund.

## 16. References

| Source | Job | What we take |
|---|---|---|
| Depop help: [fees](https://depophelp.zendesk.com/hc/en-gb/articles/360001791127-Seller-fees-and-charges), [Make Offer](https://depophelp.zendesk.com/hc/en-gb/articles/4412315779345-Make-Offer), [Electronics Policy](https://depophelp.zendesk.com/hc/en-gb/articles/22500114413841-Electronics-Policy), [stock images](https://depophelp.zendesk.com/hc/en-gb/articles/360026574274-What-are-stock-images), [shipping US](https://depophelp.zendesk.com/hc/en-gb/articles/16523051318033-How-to-ship-US) | rules | fees, offer rules, what is blocked, own photos, labels |
| Depop help: [how search ranks](https://depophelp.zendesk.com/hc/en-gb/articles/9422984899985-How-Depop-ranks-search-results-and-recommends-listings), [improving ranking](https://depophelp.zendesk.com/hc/en-gb/articles/360050410093-Improving-the-search-ranking-of-your-items) | mechanism | the seven factors, filters, policy as a factor |
| [FLIPSAIL](https://www.flipsail.io/blog/depop-algorithm-explained), [List Perfectly](https://listperfectly.com/tips/depop-prohibited-items-guide/) | pointers, folklore | led to the two ranking pages; reported bans |
| Partner API: [Reference](https://partnerapi.depop.com/api-docs/reference/), [first listing](https://partnerapi.depop.com/api-docs/getting-started/your-first-listing/), [offers](https://partnerapi.depop.com/api-docs/how-to-guides/managing-offers/), [Taxonomy](https://partnerapi.depop.com/api-docs/concepts/taxonomy/) | mechanism | the validation table, auto-offers |
| Depop news and blog: [offers, Jan 2024](https://news.depop.com/company-news/depop-community-embraces-offers-as-suite-of-negotiation-tools-expands/), [Photoroom, Jun 2025](https://news.depop.com/company-news/depop-partners-with-photoroom-to-bring-ai-powered-photo-editing-to-millions/), [product release, Jun 2025](https://www.depop.com/blog/depop-product-release-june-2025/), [what to sell](https://blog.depop.com/articles/what-to-sell-on-depop) | evidence | offer share, editor, Boost Shop, categories |
| [US Seller Handbook](https://sellers.depop.com/Seller_Handbook_Final_US.pdf) | evidence, old | flat lay, flaws, tag spam, free shipping |
| [eBay 8-K exhibit](https://www.sec.gov/Archives/edgar/data/0001065088/000106508826000174/exhibit991erebayq22026.htm), [Retail Insight Network](https://www.retail-insight-network.com/news/ebay-completes-acquisition-depop/) | evidence | close date, price, buyers, sellers |
| [Value Added Resource, 3 Mar 2026](https://www.valueaddedresource.net/depop-raises-boosted-listing-ad-fees/) | evidence (quotes Depop's notice) | boost 12% from 23 March 2026, 28-day window |

### What I searched and couldn't reach

- **Budgets.** Page reads were capped at 100 an hour across all helpers and searches at 200 a turn. I read about 40 pages. Search returned titles and links only.
- **Refused to load**: Depop help pages for Boosted Listings, Send Offer, How to list an item and prohibited items; the Seller Photography Guide PDF; the category sitemap.
- **Found, not opened**: Tips for describing your item, Boosted Listings Policy, Community Guidelines, Bundles, Depop Import, the Outfits post.
- **Still open**: label prices, whether the app has a title box, video length, AI image rules, Depop's main prohibited list, duplicate-listing wording, and any in-app change since the eBay close. None of this proves absence.

### Seed frontier log

- **Loop 1** (fees 2026; eBay completes Depop; hashtags; prohibited items). Changed: closed 30 Jul 2026; under-34 line; electronics ban with camera exception. Contrary lead: has Depop demoted hashtags?
- **Loop 2** (Depop help pages, news posts, handbook, partner API). Changed: accepted offers do not bind; API auto-offers; Photoroom removes backgrounds; handbook statistics stale; field limits confirmed. Contrary lead: multi-size offers may be allowed.
- **Loop 3** (boost fee, category tree, AI images, relist, title, Outfits, shipping). Changed: boost 12% from 23 March 2026; AI descriptions from Sept 2024; category URLs show Furniture, Toys, Trading cards, Beauty. Contrary lead: is furniture banned? No.
- **Loop 4** (a seller algorithm guide, then the Depop pages it cites; Top Seller code; policies; both terms pages; API changelog). Changed: seven ranking factors; Top Seller needs three months; no AI photo rule; API partners barred from browser automation; Pricing Inspiration endpoint. Stopped by the budgets, with the open items above.
