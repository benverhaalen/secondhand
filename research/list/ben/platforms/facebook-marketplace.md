# How do we post on Facebook Marketplace so it sells, and what belongs there?
Researched 2026-11-14 by Ben (Claude Code research helper). Feature: list.

Feeds the Facebook Marketplace adapter. The posting route (no individual-seller API, a Browser Use draft, the user taps Publish) is in [crosspost-and-delist.md](../crosspost-and-delist.md) and is not repeated here. Scope: US, individual sellers.

Limit: facebook.com help and policy pages refuse automated readers, and the fetch budget ran out mid-run. Meta's newsroom posts were opened. Most form limits and policy lines are *asserted* and must be read off the live form (section 15, rule 1).

## 1. Short answer

1. **Post what is heavy, bulky or cheap, for local pickup.** A local sale has no fee, no shipping and no payout wait *asserted*. Everything else follows from that.
2. **Refuse or warn by product type.** Furniture, appliances, tools, baby gear, bikes and lots belong here. Designer pieces, handbags, fine jewelry and used makeup do not (section 14).
3. **Win the tile.** The feed shows a square first photo, the price and a short title *asserted*. A clear whole-item cover and a price just above the target do most of the work.
4. **Answer fast.** Chat is the checkout. Reply speed feeds a badge and decides who gets the item *asserted*.
5. **Keep it fresh on a schedule.** Renew at day 7, drop the price, delete and relist near day 30 *asserted* (Vendoo).
6. **Set the location and pickup terms well.** Distance is a ranking input *asserted*; the meetup choice filters out many scams.
7. **Leave boost off.** A test of the pay-per-sale boost produced impression-billed campaigns with $400 to $600 daily budgets *observed* (Value Added Resource, VAR below).
8. **Skip a shipped Facebook post when the item is on eBay.** Some eBay listings already appear on Marketplace *observed*.

Biggest difference from the other platforms: a local sale has no checkout. Nothing binds an offer, no payment passes through Meta, and "sold" is two people meeting. After posting, the adapter's work is conversation and scheduling.

## 2. Draft from memory, and what changed

Draft: a billion-plus monthly users; local sales free; shipped fee 5%, later 10%; shipping being wound down (prepaid labels and Shops checkout ended in 2025); 10 photos, title near 100 characters, 20 tags; renew after 7 days, 5 times; boost is an impression ad; clothing sells badly; AI limited to suggested questions.

What changed after searching:

1. **Shipping came back.** Prepaid labels ended for new listings on 2025-02-24, returned for "select sellers" by September 2025 *observed* ([VAR](https://www.valueaddedresource.net/facebook-marketplace-ends-pre-paid-shipping/)), and on 2026-03-12 Meta told sellers they can "generate prepaid shipping labels in just a few clicks" with a dashboard for shipped orders *observed* ([Meta](https://about.fb.com/news/2026/03/facebook-marketplace-new-meta-ai-tools-make-selling-faster-and-easier/)).
2. **Meta AI now writes the listing.** "Upload your item images and let Meta AI do the rest": draft, details and a price "based on similar items listed in your area" *observed* (same post). It can also "draft and send an auto reply" to availability questions *observed*.
3. **There is a Seller app** (2026-07-24, iOS, US, 18 and over): AI listing, bulk listing, inventory, an inbox threaded by item, and insights on "views, clicks, message threads, and sold listings" *observed* ([Meta](https://about.fb.com/news/2026/07/introducing-seller-app-facebook-marketplace/)).
4. **Facebook Verified** (2026-07-24): a free selfie-video badge that shows on Marketplace *observed* ([Meta](https://about.fb.com/news/2026/07/introducing-facebook-verified/)).
5. **Fashion is large by listings.** Over 200 million fashion items are listed in the US, second after home decor *observed* ([Meta, 2025-11-13](https://about.fb.com/news/2025/11/facebook-marketplace-gets-a-glow-up/amp/)). That counts supply, and includes eBay and Poshmark partner listings, so it does not show clothing sells well locally *inferred*.
6. **Boost has a second mode, Cost per Sale**, at 15, 20, 25 or 30% of the item price, and its billing does not match its terms *observed* ([VAR, 2026-10-12](https://www.valueaddedresource.net/facebook-marketplace-cost-per-sale-ads/)).
7. **The eBay ride is partial.** Only selected eBay listings appear, and in January 2025 sellers largely could not find theirs *observed* (VAR article summaries). Do not promise it for a given item.

## 3. Who buys here and what sells

| Fact | Evidence |
|---|---|
| "More than 3.5 million listings posted on Facebook Marketplace every single day" in the US and Canada | *observed* (Meta, 2026-03-12) |
| "430 million items are listed each month globally" | *observed* (Meta, 2026-07-24) |
| 44 million vehicles listed per month globally | *asserted* ([seller blog](https://justbeingresourceful.com/2026/08/06/facebook-seller-app-and-free-verification-what-marketplace-sellers-need-to-know/) citing Meta's 2026-07-24 post, which I did not open) |
| One in four young adult daily Facebook users in the US and Canada visits Marketplace each day | *observed* (Meta, 2025-11-13) |
| Home decor is the largest US category by listings, fashion second | *observed* (same) |
| Vehicles are a top-five search for young adults | *observed* (same) |
| Monthly users: Meta said more than one billion in 2021 | *asserted* (memory). No 2026 figure found |

Buyers are anyone with a Facebook account within driving distance: broader and older than Depop, plus the young adults Meta is courting with collections and group chats *observed* (Meta, 2025-11-13). They want a deal they can collect today *inferred*.

What sells, by seller consensus *asserted* (memory; 2026 seller guides found, not opened): furniture, home goods, appliances, tools, vehicles and parts, baby gear, bikes, fitness and garden equipment, game consoles, free items.

Price bands and time to sell: no platform data found. Folklore says a fairly priced bulky item goes within days and a free item within hours *asserted*.

## 4. Money

| Item | Amount | Evidence |
|---|---|---|
| Listing | Free | *asserted* |
| Local sale | No fee | *asserted* ([VAR, 2026-07-24](https://www.valueaddedresource.net/facebook-dedicated-seller-app/); [Swappa, 2026-06-16](https://swappa.com/blog/?p=29422)) |
| Shipped sale with checkout | "10%, or a minimum of $0.80 per listing", effective 2024-04-15; before that 5%, $0.40 minimum | *observed* ([VAR](https://www.valueaddedresource.net/facebook-marketplace-doubling-selling-fees/) reproduces Meta's notice). Still quoted in June to August 2026 *asserted* |
| What the 10% is taken on | Item price plus buyer-paid shipping plus sales tax | *asserted* (VAR, 2026-07-24). Meta's Merchant Policies page blocked my reader |
| Payment processing | Inside the selling fee | *asserted* (memory) |
| Buyer fee | None; the buyer pays shipping and tax at checkout | *asserted* |
| Payout, shipped | 5 business days after delivery is confirmed, or 15 to 20 business days after tracking is entered | *asserted* ([OneShop, 2022](https://oneshop.com/blog/understanding-how-facebook-marketplace-shipping-works)); no 2026 check |
| Payout, local | Cash, Venmo, Zelle or Cash App between the two people; Meta is not involved and Purchase Protection does not apply | *asserted* (memory) |
| Boost | Section 10 | |

2025 to 2026 changes: prepaid labels pulled and restored (section 2). Shops moved to website checkout from June 2025 *observed* ([VAR](https://www.valueaddedresource.net/meta-phases-out-native-checkout-facebook-instagram-shops/)); Marketplace shipping stayed. eBay and Poshmark partner listings check out on the partner's site *observed* (Meta, 2025-11-13).

Worked example (arithmetic *inferred*; shipped rows assume the fee is on the item price only):

| | $40 item | $200 item |
|---|---|---|
| Local pickup | $40.00 | $200.00 |
| Shipped, buyer pays the label | $40.00 less $4.00 = $36.00 | $200.00 less $20.00 = $180.00 |
| Shipped, if the fee also covers shipping and tax (assume 7% tax; $8 and $15 labels) | fee $5.08, net $34.92 | fee $22.90, net $177.10 |

An item at $8 or less pays the $0.80 minimum.

## 5. Listing fields and hard limits

None of these came from Meta's page today. Correct this table from the live form.

| Field | Limit or values | Evidence |
|---|---|---|
| Listing type | Item for sale; Vehicle; Home for sale or rent (separate forms) | *asserted* (memory) |
| Photos | Up to 10 for an item; more for vehicles and homes | *asserted* (memory) |
| Video | One, optional | *asserted*, unconfirmed |
| Photo file | JPEG or PNG; Facebook recompresses, long edge about 2048 px | *asserted* (memory) |
| Title | Required. Seller sources disagree: 99, 100 or 150 characters | *asserted*, unconfirmed |
| Price | Required, whole dollars; 0 shows as "Free" | *asserted* |
| Price range for checkout with shipping | $5 to $500 | *asserted* (OneShop, 2022) |
| Category | Required, one leaf (list in section 7) | *asserted* |
| Condition | New; Used, Like New; Used, Good; Used, Fair | *asserted* |
| Description | Optional; limit not confirmed | unknown |
| Brand, size, color, material | Optional, shown by category | *asserted* |
| Product tags | Optional, up to 20 | *asserted* (memory) |
| SKU | Optional free text (holds our item id) | *asserted* |
| Availability | "List as single item" or "List as in stock" | *asserted* |
| Location | Required; buyers see the city | *asserted* |
| Meetup preferences | Public meetup; door pickup; door dropoff | *asserted* |
| Delivery method | Local pickup only; shipping only; both | *asserted* |
| Toggles | Hide from friends; boost after publish | *asserted* |
| List in more places | The user's buy and sell groups, up to 20 | *asserted* (memory) |
| Meta AI draft | "Create listing details" from a photo; tones "Recommended, Friendly, Professional, and Concise" | *observed* ([VAR test, 2026-03-16](https://www.valueaddedresource.net/meta-ai-listing-facebook-marketplace/)) |
| Meta AI auto reply | Toggle at listing time, with preview and edit | *observed* (Meta, 2026-03-12) |

## 6. Title and description conventions

How search reads the fields: title, description, tags and category are all matched *asserted*; Meta publishes no weights.

Title formula *agent proposal*: `{Brand} {item} {model or key spec} {size or dimensions} {color}`. Plain words, at most 60 characters so the tile does not cut it *inferred*. No capitals for emphasis, emoji, price, phone number or "must go".

- Clothing: `Patagonia Better Sweater Fleece Jacket Men's Large Gray`
- Non-clothing: `IKEA Hemnes 8 Drawer Dresser White 63 in Wide`

Description, in this order *agent proposal*:

1. What it is and its condition, in one sentence.
2. Measurements. A local buyer needs to know whether it fits the car and the doorway.
3. Every flaw, named plainly.
4. What is included, and the model number.
5. Pickup area as a neighborhood or cross streets, loading help, and payment accepted.
6. "If it is listed, it is available." This answers the default first message.

Tone: a neighbor, short. Leave out the street address, phone, email, links and lines such as "no lowballers".

## 7. Tags, categories and structured data

Category decides which browse page and filters the item appears under; a wrong category is a known removal reason *asserted*. The item form's categories *asserted* (memory):

- Home and Garden: Tools; Furniture; Household; Garden; Appliances
- Entertainment: Video Games; Books, Movies and Music
- Clothing and Accessories: Bags and Luggage; Women's Clothing and Shoes; Men's Clothing and Shoes; Jewelry and Accessories
- Family: Health and Beauty; Pet Supplies; Baby and Kids; Toys and Games
- Electronics: Electronics and Computers; Mobile Phones
- Hobbies: Bicycles; Arts and Crafts; Sports and Outdoors; Auto Parts; Musical Instruments; Antiques and Collectibles
- Classifieds: Garage Sale; Miscellaneous

Tags: up to 20 *asserted*. Use 8 to 12 *agent proposal*: words buyers type that the title lacks (couch, sofa, sectional), plus brand, material, room and style. Unrelated brands are keyword stuffing; no written rule confirmed, so treat it as a risk *inferred*.

Condition, brand, size and color feed buyer filters *asserted*. Fill each one the form shows.

**Search rules as data and a check.** The rules every site shares and this site's differences are in [listing-seo.md](../listing-seo.md). `node scripts/listing-lint.mjs title facebook facts.json` builds this site's title from an item's facts, and the same script checks a draft.

## 8. Photos

| Point | Finding | Evidence |
|---|---|---|
| Count | Up to 10; use 6 to 10 | *asserted*; count is *agent proposal* |
| Display | Feed tile is a square crop of the first photo; the listing page fits each photo at any aspect | *asserted* (memory) |
| Size | No listing spec found; long edge about 2048 px after upload | *asserted* |
| Cover norm | The real item in a real home or driveway, whole item in frame | *asserted* (folklore) |
| Video | A short clip of the item running helps electronics and appliances | *inferred* |
| Rules | Photos must show the item and match the title and description; no before-and-after pictures | *asserted* (memory; page not reachable) |
| Stock photos, overlays, collages | No written ban found. Buyers read a stock photo on a used item as a scam | *asserted* (folklore) |
| Platform photo tools | Meta AI reads the photo to write the listing *observed*. No background removal or AI enhance found for item photos | narrow search |
| AI labels | Meta adds "AI info" when it detects C2PA or IPTC markers or the uploader discloses. Since September 2024 the label sits in the post menu for AI-edited content and on the image for fully generated content | *asserted* (memory of Meta's 2024 posts, not reopened) |
| Labels on Marketplace photos | A 2026 dealer blog says AI-edited car photos get the label ([autobook](https://autobook.io/blog/facebook-ai-info-label-car-photos), unopened) | unconfirmed |

Meta AI describes whatever is in the frame: in VAR's test it wrote a coaster under a mug into the listing *observed*. Clear the frame at capture.

### Under Ben's touch-up rule

The rule fits this platform well. The norm is an honest photo in a lived-in room, and a white cut-out makes a used couch look like a dealer or a scam *inferred*. We lose nothing by keeping backgrounds.

- **Meet the norm at capture.** Ask for daylight, the item pulled away from clutter, a blank wall behind it when one exists, the whole item in frame, and a level camera.
- **Cover:** a 1:1 crop with the item centered and about 5% margin, exported at 2048 x 2048 px when the source allows and never below 1080 x 1080 *agent proposal*.
- **Other photos:** keep the native 4:3 or 3:4, long edge 2048 px.
- **Order:** whole item; second angle; back or underside; brand tag or model plate; a tape measure in frame; each flaw close up; proof it works (screen on, drill spinning); what is included.
- **What the rule stops:** erasing the messy room behind a sofa, virtual staging, removing a stain. We cope with a tighter crop, a prompt to move the laundry basket, and a flaw photo. A buyer inspects at the door, so a hidden flaw becomes a failed pickup *inferred*.
- **AI label risk:** do the touch-up with ordinary image operations (exposure, white balance, crop, rotate). Nothing is generated, so no generative marker is written *inferred*. If a generative model does the touch-up, its output may carry C2PA data and get an "AI info" label *inferred*; test one photo before the demo.

## 9. Pricing and offers

- **Local listings have no offer object.** A buyer types a number in chat. Nothing binds either side until the handoff, and the seller can mark the listing pending or sold *asserted*.
- **Shipped listings** can take an offer through checkout *asserted* (memory). Expiry, counters and whether an accepted offer charges the buyer: not confirmed.
- No auto accept, auto decline or offers to savers found (narrow search).
- **Price drop:** the listing shows the old price struck through *asserted* (memory), and a cut "may notify interested shoppers" *observed* as Vendoo's claim ([Vendoo, 2026-08-25](https://blog.vendoo.co/facebook-marketplace-delete-and-relist)).
- **Meta's price suggestion** uses items "listed in your area" *observed*: asking prices. Our comps use sold prices ([sold-price-data.md](../../../price/ben/sold-price-data.md)), a better anchor *inferred*.
- **How sellers price:** below shipped platforms, because the buyer collects and nobody pays a fee *inferred*. Floor *agent proposal*: the eBay net after fees and shipping.
- **Room for offers** *agent proposal*: 10% above the target at $50 and over; the next $5 up between $20 and $50; the target itself below $20. Haggling is the norm *asserted* (folklore).
- **Bundles:** no bundle tool. A lot is one listing with a count in the title *inferred*. No auctions.
- **Free:** price 0 lists as Free and draws the most messages *asserted* (folklore).

## 10. Promotion and boosts

| Tool | Cost | What it does | Evidence and verdict |
|---|---|---|---|
| Renew | Free | Offered once a listing is 7 days old, up to five times; keeps views and saves; "Small bump in search" | *asserted* (Vendoo). Use every time |
| Price drop | Free | Strike-through, possible alert to savers | Section 9. Use at day 14 and 21 |
| Delete and relist | Free | New listing ID and age; loses views and saves; an old and new copy live together can be flagged as duplicates | *asserted* (Vendoo). Use near day 30 |
| List in more places | Free | Copies the listing to buy and sell groups | *asserted*. One to three local groups; each group has rules |
| Share, collections, comments | Free | Share to Feed, Messenger or WhatsApp; buyers collect listings with friends, react and comment | *observed* (Meta, 2025-11-13). User's choice; answer comments |
| Facebook Verified | Free | Badge on Marketplace | *observed*. Do once |
| Shipping on | 10% of a shipped sale | Reach past driving distance | *inferred*. Small items only |
| Boost, Fixed Budget | Seller-set budget, billed for delivery whether or not it sells | A Meta ad built from the listing | *observed* (VAR). Rarely |
| Boost, Cost per Sale | 15, 20, 25 or 30% of the price | Shipped listings; "only be charged if your item sells"; 7-day click window; 30-day run | *observed* (VAR), whose test produced continuous campaigns with $400 and $600 daily budgets. Do not use |

When boost pays *inferred*: an item over about $200 with few local buyers and a deadline, such as a moving date. Under $50 the ad cost takes the margin. No current minimum budget found.

## 11. Shipping and local pickup

- **Local is the default.** Public meetup for small valuables, door pickup for furniture, door dropoff if the seller will deliver *asserted*. The buyer pays in person.
- **Shipping in 2026:** prepaid labels exist again *observed* (Meta), though the help page said they go to "select sellers" and can be withdrawn for wrong weights or sizes, with 12 inches per side as the limit for USPS labels *observed* (VAR quoting the help page, September 2025). A seller's own label is the fallback *observed* (VAR).
- Ship within three business days; an order not shipped within seven days is cancelled; keep cancellations under 10% *asserted* (OneShop, 2022).
- Label prices by weight, carriers and weight caps: not found.
- **Why sellers stay local** *inferred*: the 10% fee, a payout wait of up to 20 business days, packing, and shipping scams.

## 12. The algorithm

What Meta has said:

- Marketplace is a ranked, personalized feed with a [system card](https://transparency.meta.com/features/explaining-ranking/fb-marketplace/) in the Transparency Center (its body did not load for my reader). From memory it predicts which listings a person will open or message about, from their past activity and the listing's attributes *asserted*.
- Marketplace uses likes on listings to personalize what people see *observed* (Meta, 2025-11-13).
- The seller's funnel is "views, clicks, message threads, and sold listings" *observed* (Meta, 2026-07-24). Those are the numbers to tune against.
- Buyers see an AI summary of the seller: time on Facebook, friend count, listing history, item types, ratings *observed* (Meta, 2026-03-12).

Likely order of factors *inferred*; Meta gives no weights:

1. Match to the buyer: search words against title, tags, description and category, and their browsing history.
2. Distance from the buyer's location and radius.
3. Recency. New listings "receive the most exposure" *asserted* (Vendoo, no Meta source).
4. Engagement on the listing: clicks, saves, messages, reactions.
5. Price against similar local items.
6. Seller signals: ratings, the Very Responsive and Community Recommended badges *asserted* (memory), Verified, account age.

Folklore, all *asserted*: delete and relist gives a "high" lift, a price cut of 5% or more "medium", renew "low" (Vendoo's ratings, no data shown); more than ten relists an hour is risky ("not an official limit"); evenings and weekends are better for posting (memory).

Edit versus relist *inferred*: an edit keeps saves and message history, so renew and cut the price while a listing has saves, and relist only when it has none.

## 13. Rules that bite

Meta's Commerce Policies were not readable today. All *asserted* from memory unless marked.

- **Prohibited:** animals; alcohol; tobacco and vapes; weapons, ammunition and explosives; drugs and prescription items; medical devices; ingestible supplements; adult products; recalled products; digital goods and accounts; counterfeits; stolen goods; gift cards and currency; used cosmetics; airbags; hazardous materials; body fluids. Services, jobs and "in search of" posts are not item listings.
- **Listing rules:** a real physical item; photos and description must match it; the right category; no before-and-after pictures; no duplicates.
- **Recalls** matter for cribs, car seats, strollers and small appliances.
- **Access:** an account must be 18 or older. New accounts may have no Marketplace access, and restrictions arrive with little explanation.
- **Automation:** Meta's Terms bar automated access without permission. Vendoo advertises "security features" against detection *observed* (Vendoo), so detection is real *inferred*. How we still build it: the Browser Use draft in the user's own session with the user's tap ([route](../crosspost-and-delist.md)); or a hand-off pack (photos saved to the phone; title, description, price and tags ready to paste) that opens Marketplace or the Seller app. Human-paced actions only.
- **Off-platform payment** is normal for local sales. Scams to refuse *asserted*: overpayment and refund requests, Zelle "business account" emails, requests for a verification code, a buyer's "mover" with a check, any link to pay or get paid.
- **Two repliers:** if our agent answers buyers, turn Meta AI auto reply off for that listing, or buyers get two answers *inferred*.

## 14. What belongs here

Verdicts are *inferred* from sections 3, 4, 11 and 13 unless marked.

| Product type | Verdict | Category | Reason |
|---|---|---|---|
| vintage_clothing | ok | Men's or Women's Clothing and Shoes | Local buyers pay less for vintage; post as a second site |
| streetwear | ok | Men's Clothing and Shoes | City meetups work; no authentication, many fakes |
| designer_clothing | avoid | Clothing | No authentication, lowball offers |
| womens_mall_brands | ok | Women's Clothing and Shoes | Sells as bundles by size |
| mens_mainstream | ok | Men's Clothing and Shoes | Fine locally at low prices |
| fast_fashion | avoid | Women's or Men's Clothing | Singles are not worth a meetup; make it a lot |
| kids_baby_clothing | good | Baby and Kids | Parents buy lots by size nearby *asserted* |
| sneakers | ok | Men's or Women's Clothing and Shoes | Cash meetups are common; fakes and robbery risk |
| shoes_other | ok | Clothing and Shoes | Work boots move; heels do not |
| luxury_handbags | avoid | Bags and Luggage | Counterfeit rule, no authentication, scams |
| jewelry_watches | avoid | Jewelry and Accessories | Cannot be verified at a meetup |
| accessories | ok | Jewelry and Accessories | Low value; bundle |
| outdoor_apparel | ok | Sports and Outdoors | Seasonal local demand |
| fan_apparel | ok | Clothing | Home-team buyers are local |
| beauty | avoid | Health and Beauty | Used cosmetics are prohibited *asserted*; sealed only |
| phones_computers | good | Mobile Phones; Electronics and Computers | No fee, cash, same day; heavy scam traffic |
| cameras_audio_gaming | good | Electronics and Computers; Video Games | Consoles and speakers sell fast locally *asserted* |
| media | ok | Books, Movies and Music; Video Games | Lots only |
| collectibles_cards_toys | ok | Toys and Games; Antiques and Collectibles | LEGO and toy lots sell; graded cards do better on eBay |
| home_decor | best | Household | Largest US category by listings *observed* |
| small_appliances | good | Appliances | Cheap, tested at pickup; check recalls |
| furniture | best | Furniture | No shipping, no fee; the core use *asserted* |
| large_appliances | best | Appliances | Cannot ship; buyers bring a truck |
| tools | best | Tools | Steady local demand *asserted* |
| sporting_goods | best | Bicycles; Sports and Outdoors | Bikes and fitness gear are bulky *asserted* |
| instruments | good | Musical Instruments | Amps, drums and keyboards; rare pieces sell higher elsewhere |
| auto_parts_vehicles | best | Auto Parts; Vehicle form | 44 million vehicles listed a month *asserted*; airbags prohibited |
| baby_gear | best | Baby and Kids | Bulky, short-lived need; recall and car seat expiry check |
| antiques_art | good | Antiques and Collectibles | Heavy antiques sell locally; fine art does not |
| handmade | ok | Arts and Crafts | Allowed; few buyers search for it |
| bulk_lots | best | Garage Sale; Miscellaneous | One pickup, no fee, no packing |

No type is `blocked` outright. Blocked cases sit inside types: used makeup, airbags, recalled baby gear, replicas.

## 15. Adapter rules (agent proposal)

1. **Read the form first.** On the first draft, record the form's own counters and errors (title, description, photos, tags) and overwrite section 5 (s5).
2. **Route by verdict.** `best` and `good`: post. `ok`: post only when the user asked for more than one site. `avoid`: warn and name a better site. Block used cosmetics, airbags, replicas and recalled models (s13, s14).
3. **Title:** the section 6 template, at most 60 characters, hard cap 99 (s5, s6).
4. **Description:** the six lines of section 6, with measurements and every flaw. No contact details, address or links (s6, s13).
5. **Category** from the section 14 column. **Condition** mapped to the four values. Fill brand, size and color when shown (s7).
6. **Tags:** 8 to 12 synonyms, no unrelated brands (s7).
7. **Photos:** 6 to 10. Cover 1:1 at 2048 x 2048 px; the rest in native aspect with a 2048 px long edge; the section 8 order. Touch-up is light, color, crop and straighten with ordinary image operations (s8).
8. **Price:** target plus 10% at $50 and over; the next $5 up from $20 to $50; the target under $20; whole dollars. Floor is the eBay net (s9).
9. **Delivery:** local pickup only. Public meetup under $100 and for anything that fits a bag; door pickup for furniture and appliances (s11).
10. **Shipping** off by default. If the item is on eBay, rely on the partner listing and say plainly that it may not appear (s2, s11).
11. **Refresh:** day 7 renew; day 14 cut 10% and renew; day 21 cut again; day 30 with no saves, delete and relist after the old copy is gone. Never more than ten relists an hour (s10, s12).
12. **Boost** off, with no automatic spend. Never Cost per Sale (s10).
13. **Messages:** answer the first message within minutes with availability and the pickup area. Hold only for a named time. First to collect gets it. Turn Meta AI auto reply off (s12, s13).
14. **Scam filter:** flag codes, overpayment, Zelle email stories, shipping requests on a local listing, and links (s13).
15. **Sold:** the user confirms the handoff; mark sold and tell others who asked ([lifecycle](../crosspost-and-delist.md)).

Human taps, never automatic: Publish; a price below the floor; holding the item for a buyer; meetup place and time; giving out an address; shipping on; any boost; posting to groups; hide from friends; delete and relist; mark sold; Facebook Verified.

## 16. References

| Source | Job | What we take |
|---|---|---|
| [Meta newsroom, 2026-03-12](https://about.fb.com/news/2026/03/facebook-marketplace-new-meta-ai-tools-make-selling-faster-and-easier/) | evidence, mechanism | AI draft, local-listing price suggestion, auto reply, prepaid labels, 3.5 million listings a day |
| [Meta newsroom, 2025-11-13](https://about.fb.com/news/2025/11/facebook-marketplace-gets-a-glow-up/amp/) | evidence | Category sizes, young adults, partner listings, likes as a signal |
| [Meta newsroom, Seller app, 2026-07-24](https://about.fb.com/news/2026/07/introducing-seller-app-facebook-marketplace/) | mechanism | Insight metrics, bulk listing, 430 million items a month |
| [Meta newsroom, Facebook Verified](https://about.fb.com/news/2026/07/introducing-facebook-verified/) | mechanism | Free trust badge on Marketplace |
| Value Added Resource (links in sections 2, 4, 5) | evidence (reproduces Meta notices) | Fee notice, label timeline, boost billing problem, fee base |
| [Vendoo, 2026-08-25](https://blog.vendoo.co/facebook-marketplace-delete-and-relist) | folklore pointer | Renew 7 days and five times, relist timing, duplicate risk. A crosslister's blog |
| [OneShop, 2022](https://oneshop.com/blog/understanding-how-facebook-marketplace-shipping-works) | folklore pointer, old | Payout timing, 3 and 7 day rules, $5 to $500. Needs a 2026 check |
| [Swappa, 2026-06-16](https://swappa.com/blog/?p=29422), [seller blog, 2026-08-06](https://justbeingresourceful.com/2026/08/06/facebook-seller-app-and-free-verification-what-marketplace-sellers-need-to-know/) | evidence (secondary) | Fee still 10% in 2026 |

## What I searched and couldn't reach

- facebook.com help center and `legal/merchant_policies`: refused (robots). The fee base, payout timing, renew limits, field limits and Commerce Policy wording are not confirmed at the source.
- The Transparency Center Marketplace system card loaded with no body text.
- The shared fetch budget (100 pages an hour across all helpers) ran out during loop 2. Found but unopened: autobook on "AI info" labels, the Vendoo and mbial 2026 selling guides, OneShop on badges and prohibited items, Meta's Marketplace safety page, closo's boost test.
- Search returned titles only. Pages were read through a fetch summarizer, so quotes are its excerpts.
- Not found: a 2026 monthly user figure, label prices and weight caps, a boost minimum, offer expiry rules, listing photo pixel specs, a Meta statement on AI labels for Marketplace photos. A narrow search does not show these do not exist.

## Seed frontier log

- **Loop 1** (seeds: fee, newsroom 2026, user numbers, field limits). Changed: AI listing and auto reply, Seller app, Verified; fee still 10%. Contrary lead: is shipped checkout gone? No; labels were restored.
- **Loop 2** (seeds: VAR Facebook tag, labels, Shops checkout, Cost per Sale, fee notice, ranking card). Changed: label timeline; Cost per Sale billing; fee base; the eBay ride covers selected listings only. Contrary lead: does pay-per-sale boost charge only on a sale? VAR's test says no.
- **Loop 3** (seeds: renew and relist, AI info label, boost cost, payout, photo specs, badges, groups, Commerce Policies). Changed: Vendoo's renew numbers and duplicate risk; 2022 payout figures. The budget ran out, so photo specs, AI labels and policy wording stayed *asserted*. Contrary lead: does clothing sell here? Meta counts 200 million fashion listings; no sales data either way.
