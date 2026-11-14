# How do we post on OfferUp so it sells locally, what belongs there, and how do we read it for search and price?
Researched 2026-11-14 by Ben (Claude Code research helper). Feature: list.

Feeds the per-platform adapter and the buy-side comp reader. We use OfferUp today for search and price only; posting is covered because we may add it.

Marks: *observed* = I opened the source today. *asserted* = a source claims it without showing it, or memory, or seller folklore. *inferred* = my reasoning. Quotation marks are used only where the fetch tool returned the page's exact words; everything else is its summary of the page, so check wording before quoting it onward. The shared fetch budget ran out early (see "couldn't reach"), so several form fields are *asserted* and flagged for a live check.

## 1. Short answer

1. **OfferUp is local pickup only.** Nationwide shipping stopped for new listings on 2025-09-23 and was stripped from existing listings on 2025-10-21 *observed*. There is no shipped fee, no label, no checkout and no payout. This is the biggest difference from every other platform we post to: nothing is sold on the platform, so the listing's only job is to start a chat that ends in a meetup.
2. **Put the right things there.** Furniture, appliances, tools, vehicles, bikes, phones and consoles. Clothing and anything that needs a national buyer belongs elsewhere *inferred*.
3. **Price against local asking prices and leave room.** Every buyer haggles, offers are just chat messages and bind nobody *observed*. Pad about 10 to 15% *agent proposal*.
4. **Cover photo and a plain title.** The feed is a photo grid with a price. The photo must be the real item, with no stock or catalog shots and no added stickers or text *observed*.
5. **Reply fast and look trustworthy.** The guidelines prohibit posting many listings while "rarely (or never)" answering buyers *observed*. TruYou and ratings are the trust signals *asserted*.
6. **Stay under the free listing limits.** 1 car, 15 appliances, 15 phones, 25 furniture, 25 tools, 25 jewelry and 200 everything else per calendar month *observed*. A wrong category counts as fee avoidance *observed*.
7. **Freshness is the only free ranking lever, and it is weak.** Duplicates are banned *observed*. Paid Promote buys placement *asserted*.
8. **For search and price, treat every number as an asking price.** There is no sold price anywhere on OfferUp *inferred*.

## 2. Draft from memory, and what changed

Draft (written before searching): OfferUp does local sales for free and shipped sales for a 12.9% fee with a $1.99 minimum; payout after delivery plus a 2 day inspection window; up to 12 photos; conditions from New to For parts; a "firm on price" toggle; Promote (1, 3, 7 days) and Promote Plus; TruYou; MeetUp Spots; 22% layoff in December 2024 while expanding into jobs, rentals and services.

What changed:

1. **Shipping is gone.** "Starting September 23, 2025, we will no longer offer nationwide shipping." "From this date forward, all newly posted items must be for local pickup only." *observed* ([help](https://help.offerup.com/hc/en-us/articles/41043186552980-Nationwide-shipping-ending)). The 12.9% fee, the size tiers, the 2 day window and the shipped-offer flow in my draft are all dead.
2. **A second layoff and a reset to local** in 2025. The CEO memo names four moves: phase out shipping, modernize the app, spend much more on marketing, and fold auto dealers, storefronts, service providers, employers and landlords into one local business group *observed* ([GeekWire, 2025](https://www.geekwire.com/2025/offerup-hit-with-new-round-of-layoffs-as-marketplace-plans-to-simplify-its-offerings/)).
3. **Free listing limits per category per month** exist and are published *observed*. My draft had none.
4. **The photo rules are about realness, not editing.** "Post a photo of the actual item, not a catalog or stock photo" and "Keep photos clean by not adding extra stickers or text" *observed* (Posting Rules, re-read 2026-11-14). An earlier draft of this note said heavily edited photos were a named removal reason. A second read of the Posting Rules and the removal page found no such sentence: the words "edited" and "altered" do not appear on either. The first read came through a fetch summarizer that added it.
5. **Authenticity checks** can remove high-value, designer and collectible listings until the seller sends tag, serial or receipt photos *observed*.
6. **Listings can carry a video**, mobile app only, rolled out gradually *observed*.
7. **Seller blogs are stale.** A Closo guide dated August 2026 still prints "about 12.9%" for shipped sales *observed* ([Closo](https://closo.co/blogs/platform-specific-guides/selling-on-offerup)). Another 2026 guide is headed "Free to Sell Locally, Shipping Ended" (underpriced.app, headline only). Check any blog's OfferUp fee claim against the help center.

Held up: local sales cost the seller nothing; no duplicates; one real photo required; in-app chat only.

## 3. Who buys here and what sells

| Fact | Value | Evidence |
|---|---|---|
| Transactions | About 30 million a year | *observed* (GeekWire 2025) |
| Staff | 435 on LinkedIn at the time of the 2025 cut (size not disclosed); 22% cut in December 2024 | *observed* (same) |
| Monthly users | 20 million plus after the letgo merger in 2020. No 2026 figure found | *asserted* (memory) |
| letgo | The two marketplaces were combined in 2020 after OfferUp acquired letgo | *asserted* ([TechCrunch 2020-08-31](https://techcrunch.com/2020/08/31/offerup-and-letgo-combine-marketplaces-post-acquisition) headline, not opened) |
| Geography | US only. Strongest in West Coast and Sun Belt metros | *asserted* (memory, not confirmed) |
| Business side | Verified auto dealers, storefronts, services, jobs, rentals | *observed* (GeekWire memo; business help center titles) |
| Feed | A real-time AI discovery feed pilot with Albatross reported an 84% engagement lift | *asserted* (press release headline, not opened) |

Buyers are local deal hunters who expect to inspect, haggle and pay in person *inferred* from the rules: buyers may inspect and test before paying, and "Once money is exchanged, the sale is final" *observed* ([Commitment to Sellers](https://help.offerup.com/hc/en-us/articles/39232498603156-OfferUp-s-Commitment-to-Sellers)).

What sells: the categories OfferUp gives their own listing caps are Cars & Trucks, Motorcycles, Appliances, Cell Phones & Accessories, Furniture, Jewelry & Accessories, and Tools & Machinery *observed*. A platform caps the categories where seller volume crowds the feed, so these are the busiest *inferred*. Seller folklore adds bikes, fitness gear, game consoles, baby gear and sneakers in large metros, and says low-value clothing sits *asserted*. Typical price bands and days to sell: not confirmed by any primary source. Folklore says a well-priced bulky item gets its first messages within hours *asserted*.

## 4. Money

| Item | Cost | Evidence |
|---|---|---|
| Posting, within free limits | $0 | *observed* ([free listing limits](https://help.offerup.com/hc/en-us/articles/13072929390228-About-free-listing-limits)) |
| Seller fee on a local sale | $0. OfferUp never touches the money | *asserted* (Closo Aug 2026; memory) and *inferred* from the in-person payment rules |
| Shipped sale fee | Not applicable since 2025-09-23. Was 12.9% with a $1.99 minimum | ending *observed*; old rate *asserted* |
| Buyer fee | None for local | *inferred* |
| Payment | In person, between the two people. Sale is final when money changes hands | *observed* |
| Payout timing | None. You hold the cash when you leave the meetup | *inferred* |
| Extra listings past the monthly cap | Paid single listings and monthly "For Sale listing subscriptions" exist; the limits page sends businesses to a form and dealers to the Verified Dealer program | titles and routing *observed*; prices not read |
| Promote, Promote Plus | Paid. Prices vary by item and area. Not read today | *asserted* (memory) |

2025 to 2026 changes: shipping and its fee removed *observed*. Listing limits are "subject to change at any time" *observed*.

Worked example (no Promote):

| | $40 item | $200 item |
|---|---|---|
| List price with 12% pad | $45 | $225 |
| Agreed price after haggle | $40 | $200 |
| Platform fee | $0 | $0 |
| Seller nets | $40 cash | $200 cash |

The real costs are time, no-shows and fuel *inferred*. A paid Promote on a $40 item can eat a large share of the sale, so the adapter should not suggest it below about $100 *agent proposal*.

## 5. Listing fields and hard limits

| Field | Limit or values | Evidence |
|---|---|---|
| Photos | At least one photo of the actual item. Maximum not confirmed today; memory says 12 | minimum *observed* ([Posting Rules](https://help.offerup.com/hc/en-us/articles/360031988292-Posting-Rules)); maximum *asserted* |
| Photo size, aspect | No published spec found. Feed tiles crop toward square | *asserted* (memory) |
| Video | One video can be added to a listing. Mobile app only, gradual rollout. No length or format published | *observed* ([Video guidelines](https://help.offerup.com/hc/en-us/articles/48174240530708-Video-Community-Guidelines)) |
| Title | Required. Character limit not confirmed | *asserted* |
| Description | Free text. Limit not confirmed | *asserted* |
| Tags, hashtags | None | *asserted* (memory) |
| Category | Required. One category per item | *observed* (Posting Rules) |
| Condition | New, Reconditioned/Certified, Open box (never used), Used (normal wear), For parts, Other (see description) | labels *asserted* (memory); a `condition` field in listing data was *observed* in our [comps note](../../../price/ben/comps-sources-live.md), not re-opened today |
| Price | Whole dollar asking price. Must not be inflated or used to game search | rule *observed*; format *asserted* |
| Firm on price | A flag on the listing (`isFirmPrice` in listing data) | field *observed* in our comps note; the form toggle *asserted* |
| Quantity | One item per listing. Identical items are listed one at a time | *observed* |
| Location | Set by the seller's ZIP or device location, shown as a city or area (`locationName`) | field *observed* in our comps note; form *asserted* |
| Shipping | None | *observed* |
| Vehicles | Own flow (VIN, year, make, model, mileage, title). Cars without titles are prohibited | flow *asserted*; title rule *observed* |
| Contact info, links | Not allowed in title, description or photos | *observed* |

Free listings per calendar month *observed*:

| Category | Free listings |
|---|---|
| Cars & Trucks | 1 |
| Motorcycles | 1 |
| Appliances | 15 |
| Cell Phones & Accessories | 15 |
| Furniture | 25 |
| Jewelry & Accessories | 25 |
| Tools & Machinery | 25 |
| All other categories, combined | 200 |

They reset on the first of the month and do not roll over. The app warns at 1 left. Posting in the wrong category or opening new accounts to dodge the cap is "strictly prohibited" *observed*.

How we build around the unconfirmed limits: the adapter reads the live form before filling it (the `maxlength` on title and description, the number of photo slots, the condition options) and stores what it saw with a date *agent proposal*. Until then it uses safe caps: title 50 characters, description 1,000 characters, 10 photos *agent proposal*.

## 6. Title and description conventions

The rule: titles and descriptions must not carry keywords or price points meant to manipulate search results, and descriptions must be accurate *observed*. Both fields are named in that rule, so search reads both *inferred*.

Formula *agent proposal*: `Brand + item type + the one spec a local buyer filters on (size, capacity, model) + color`. Plain, under 50 characters, no caps lock, no "L@@K", no price in the title.

- Clothing: `Patagonia Synchilla fleece pullover, men's L, navy`
- Non-clothing: `IKEA Malm 6-drawer dresser, white, 63 in wide`

Description, in this order *agent proposal*: (1) what it is and the model number, (2) measurements, (3) condition in one honest sentence with each flaw named, (4) what is included, (5) pickup facts: neighborhood or cross streets (never an address), ground floor or stairs, whether one person can carry it, whether it fits in a car, (6) when you are free. Tone is neighbor to neighbor, two to six short lines.

Leave out: phone numbers, emails, addresses, links and social handles *observed*; lists of other brands; "will ship" (it cannot); "cash only, no lowballers" rants, which read badly and filter nobody *inferred*.

## 7. Tags, categories and structured data

There are no tags *asserted*. The structured fields are category, condition, price, firm flag and location. Search takes a radius in miles, a price range, a condition and a sort order (*observed* in our comps note as the inputs of a scraper that calls OfferUp's own search).

Category does three jobs: it places the item in browse, it decides which monthly cap the listing counts against, and a wrong category is both a removal reason and "fee avoidance" *observed*. The adapter must pick the category from a fixed map, never guess to save a slot.

Spam on OfferUp means: the same item in more than one listing or category, keyword stuffing, placeholder prices, and mass posting without answering buyers *observed* ([Community Guidelines](https://help.offerup.com/hc/en-us/articles/360031988352-Community-Guidelines)).

**Search rules as data and a check.** The rules every site shares and this site's differences are in [listing-seo.md](../listing-seo.md). `node scripts/listing-lint.mjs title offerup facts.json` builds this site's title from an item's facts, and the same script checks a draft.

## 8. Photos

Rules *observed* (Posting Rules, [Why listings are removed](https://help.offerup.com/hc/en-us/articles/360032337011-Why-listings-are-removed)):

- A photo of the actual item. No catalog or stock photos. No text-only images.
- Clear and well lit, with no stickers or added text.
- No phone numbers, emails or addresses in the picture.
- Your own photos only.
- "Don't use stock or catalog photos of items": they get listings removed *observed* (removal page, re-read 2026-11-14). Editing is not named.
- "Include high-quality, well-lit photos" *observed*.
- For video: no stock footage, no edits that hide defects, no bot-generated video, no plugs for other sites.

Norms *asserted*: phone photos in the home, driveway or garage. Nobody expects a white studio background. The cover should show the whole item. Use most of the photo slots for furniture and appliances: every side, the label or model plate, each flaw, and the item powered on.

Platform photo tools: the pages I opened name no OfferUp background remover, AI enhancer or photo-to-listing tool *observed* (an absence in about a dozen pages, which is not proof).

AI stance: none of the Posting Rules, removal reasons, Community Guidelines or Video guidelines mention AI-generated or AI-edited images *observed*. The working rule is the older one: the photo must be of the actual item *observed*. A generated or re-staged image is no longer a photo of the actual item *inferred*.

### Under Ben's touch-up rule

Our rule (fix light and color, crop, straighten; never change the scene, the item or the wear) suits OfferUp well: its rules ask for a real, well-lit photo of the actual item with nothing added, and the buyer inspects the item in person, so an edit that flatters it only produces a failed meetup *inferred*.

- **Met at capture, not by editing:** whole item in frame, daylight or all the room lights on, clutter physically moved out of the shot, a straight-on front view, the item pulled away from the wall for side and back shots, a tape measure laid on the item for scale *agent proposal*.
- **Crop and order the adapter produces:** cover is a 1:1 square at 1600 x 1600 px with the whole item inside the middle 80%, so a square feed tile never cuts it off. Other photos keep 4:3 at 1600 x 1200 px (or 3:4 for tall items). Produce 8 photos, never more than 10 until the live cap is read. Order: 1 whole item at a three-quarter angle, 2 straight front, 3 side or back, 4 label or model and serial plate, 5 and 6 each flaw close up, 7 item with tape measure or powered on, 8 what is included *agent proposal*. The square tile is from memory, so check it against a live feed *asserted*.
- **What the rule stops us doing:** nothing sellers here rely on. White cut-out backgrounds are not the norm, and measurement text burned into the photo is banned anyway *observed*. Measurements go in the description.
- **Touch-up note to store with the listing:** "Light, color, crop and straighten only. Scene and item unchanged." *agent proposal*

## 9. Pricing and offers

- Buyers message or send an offer; it lands in the seller's inbox. The seller accepts "by replying to their message", declines the same way, or sends a counteroffer *observed* ([Accept an offer](https://help.offerup.com/hc/en-us/articles/360032334451-Accept-an-offer)).
- Nothing binds either side. "If you change your mind on an offer, that's ok!" and the sale is final only "once money is exchanged" *observed*.
- The pages I opened describe no expiry timer, auto accept, auto decline, offers to watchers, bundles or auctions *observed*. Treat all of them as missing *inferred*.
- The firm flag tells buyers not to haggle *asserted*; buyers still try *asserted* (folklore).
- Lowering the price is the standard nudge. Whether OfferUp notifies people who saved the item was not confirmed *asserted* (memory says it does).
- How sellers price: against other local asks for the same thing, not against eBay sold prices, because the buyer saves shipping and the seller saves fees *inferred*.

Room to leave *agent proposal*: list at the target price plus 10 to 15%, rounded to a number ending in 0 or 5. Set the firm flag only when the price is already at the floor. Folklore says opening offers come in 20 to 40% under ask *asserted*; do not treat that range as measured.

## 10. Promotion and boosts

| Tool | What it is | Cost | Evidence |
|---|---|---|---|
| Promote | Paid placement of one item in buyers' feeds and search for a set number of days, shown with a promoted label | Varies by item and area | *asserted* (memory; help page title seen, page not opened) |
| Promote Plus | Monthly subscription with always-on promoted slots you can move between items | Monthly, from about $20 in memory | *asserted*, low confidence |
| Insights | "Track item listing performance" page in the seller tools | Free | title *observed*, content not read |
| OfferUp Premium | A separate subscription; in memory it is aimed at buyers | Monthly | title *observed*; content *asserted* |
| Price drop | Edit the price down | Free | *asserted* |
| Fresh post | A new listing gets new-item exposure | Free, but uses a monthly slot | *inferred* |

When Promote pays *inferred*: an item over about $100, in a dense metro, with a category many people browse (furniture, appliances, tools, phones), in its first week. When it does not: under about $40, in a thin area, or when the price is simply above local asks, because promotion buys views and local buyers compare prices side by side.

## 11. Shipping and local pickup

- No shipping, labels, weight tiers or handling time *observed*. Sellers who deliver do it as a private favor *inferred*.
- Meet in public. OfferUp points sellers to "vetted Community MeetUp Spots" and has a "Suggest a MeetUp Spot" action in chat *observed*.
- The buyer inspects and tests first, then pays; after that the sale is final. Returns are the seller's choice *observed*.
- Payment method is between the two people. Cash is the norm *asserted*. Fake payment screenshots and overpayment are the common scams *asserted* (several 2026 scam guides; OfferUp's own scam page not opened). The adapter's buyer-chat side should tell the seller to confirm money in hand or in their own account before handing over *agent proposal*.
- Large items: say in the listing whether the buyer needs a truck and help carrying *agent proposal*.

## 12. The algorithm

What OfferUp has said:

1. Listing caps exist to keep the feed diverse for buyers and give every seller a fair chance *observed*. So the feed is managed against one seller flooding it.
2. Posting many listings and rarely answering is a guidelines violation *observed*. Responsiveness is at least an enforcement signal.
3. Duplicate listings confuse buyers and are removed *observed*.
4. A partner press release says the feed is being personalized in real time by a recommendation model *asserted* (headline only).

I found no published ranking formula. The likely order *asserted* and *inferred*:

| Factor | Evidence |
|---|---|
| Distance to the buyer | *asserted*; the product is local only *observed* |
| Text match of title and description to the query | *inferred* from the keyword rule |
| Recency of the post | *asserted* (folklore, and "newest" sort exists in memory) |
| Paid promotion slots | *asserted* |
| Buyer's own behavior (personalized feed) | *asserted* |
| Seller reputation and reply speed | *inferred* from the guidelines; strength unknown |

Relist versus edit: duplicates are banned, and the Posting Rules say nothing separate about deleting and reposting *observed*. Folklore says a delete and repost puts the item back on top *asserted*. Each new post uses a monthly slot *inferred*. Proposal: edit first (price down), repost only after 14 quiet days, and delete the old listing first so two never coexist *agent proposal*. Timing: evenings and weekends *asserted* (folklore).

## 13. Rules that bite

- **Prohibited** *observed* ([Prohibited Items](https://help.offerup.com/hc/en-us/articles/360032329711-Prohibited-Items-Guidelines)): alcohol, tobacco and vapes, drugs and CBD, adult items, live animals, firearms and replicas, most weapons including airsoft and bows, recalled products (drop-side cribs, Rock n' Play sleepers, Boppy loungers, BlendJet 2), counterfeits, digital goods and gift cards, prepared food, vitamins and supplements, contact lenses, **used cosmetics and makeup applicators**, cars without titles, current license plates, catalytic converters, loose airbags, **locked phones**, **TV streaming devices such as Roku or Fire Stick**, mystery boxes, services, rentals and wanted ads in the items marketplace.
- **Duplicates:** one listing per item, one category *observed*.
- **Off-platform:** no contact details or links in listings; keep messaging on OfferUp; no steering buyers to other sites *observed*.
- **Fee avoidance:** wrong category or extra accounts to beat listing caps *observed*.
- **Authenticity checks:** designer, collectible and high-value items can be pulled until proof is sent *observed*.
- **Mass posting without replies** *observed*.
- **Enforcement:** removal without notice; suspension or ban for severe or repeated violations; appeals exist *observed*.
- **Automation:** I could not open the Terms of Service today, so the exact clause on bots and scraping is unread. The video rules ban bot-generated videos *observed*. Assume the terms forbid automated access, as marketplace terms normally do *asserted*. OfferUp has no public listing API *asserted*. How we still build it *agent proposal*: the website has login and an inbox *observed*, so Browser Use fills the web post form in the user's own session, stops before Post, and the user taps. One item at a time, human pace, never a second account.
- **No cancellation or late-ship penalties** exist, since there are no orders *inferred*. The local version is ratings: no-shows and rudeness cost reputation *asserted*.

## 14. What belongs here

| Product id | Verdict | Reason | Evidence |
|---|---|---|---|
| vintage_clothing | avoid | Needs a national buyer; local deal hunters will not pay vintage prices | *inferred* |
| streetwear | ok | Sells in person in big metros; expect authenticity checks and lowballs | *asserted*, *observed* (checks) |
| designer_clothing | avoid | Wrong buyers, authenticity removals, no buyer protection to justify the price | *inferred* |
| womens_mall_brands | avoid | Low local demand per item; Poshmark buyers pay more | *inferred* |
| mens_mainstream | avoid | Same; a meetup for a $25 shirt is not worth it | *inferred* |
| fast_fashion | avoid | Value too low for a meetup | *inferred* |
| kids_baby_clothing | ok | Only as a bagged lot by size | *asserted* |
| sneakers | good | Local meetups in large metros let buyers check the pair | *asserted* |
| shoes_other | ok | Work boots sell; heels and dress shoes sit | *asserted* |
| luxury_handbags | avoid | Counterfeit checks, scam risk and cash meetups for high sums | *observed* (checks), *inferred* |
| jewelry_watches | avoid | Same risks; capped at 25 a month | *observed* (cap), *inferred* |
| accessories | avoid | Low value, no local pull | *inferred* |
| outdoor_apparel | ok | Shells and jackets move in season in outdoor metros | *asserted* |
| fan_apparel | ok | Local team gear has local buyers | *inferred* |
| beauty | avoid | Used cosmetics are prohibited; sealed items are low value locally | *observed*, *inferred* |
| phones_computers | good | High local demand; phones must be unlocked; 15 phone listings a month | *observed* (rules), *asserted* |
| cameras_audio_gaming | good | Consoles and speakers sell fast for cash; streaming sticks are prohibited | *asserted*, *observed* |
| media | ok | Game lots sell; single books and DVDs do not | *asserted* |
| collectibles_cards_toys | ok | Toy and LEGO lots sell; graded cards need a national market; mystery boxes prohibited | *asserted*, *observed* |
| home_decor | good | Rugs, mirrors, lamps: bulky to ship, easy to pick up | *inferred* |
| small_appliances | good | Buyers can test before paying; recalled models blocked | *inferred*, *observed* |
| furniture | best | Cannot ship; has its own 25 a month cap, a sign of volume | *observed* (cap), *inferred* |
| large_appliances | best | Same; 15 a month | *observed* (cap), *inferred* |
| tools | best | Tools & Machinery has its own cap; buyers pay cash and test | *observed* (cap), *asserted* |
| sporting_goods | best | Bikes, weights, treadmills: heavy and local | *asserted* |
| instruments | good | Amps, drums, keyboards are bulky; rare guitars do better on Reverb | *inferred* |
| auto_parts_vehicles | best | Core category with a dealer program; 1 free car a month, title required; no catalytic converters or loose airbags | *observed* |
| baby_gear | good | Strollers and high chairs sell; recalled sleepers and drop-side cribs are blocked; warn on car seat age | *observed*, *asserted* |
| antiques_art | ok | Sells as furniture or decor; true collector pieces need a wider market | *inferred* |
| handmade | ok | Furniture and planters yes; no prepared food; no custom-order services | *observed* (rules), *inferred* |
| bulk_lots | good | Moving-sale lots and bundles clear locally; contents must be shown | *observed* (mystery box rule), *asserted* |

## 15. Adapter rules (agent proposal)

All *agent proposal*; the section each rests on is in brackets.

1. **Gate:** post here when the type is `best` or `good`, or the item is over 20 lb or 24 in on a side. Warn on `ok`. Refuse `avoid` unless the user overrides [14].
2. **Refuse:** the prohibited list. Hard checks: used makeup, locked phones, streaming sticks, recalled baby gear, vehicles without a title, mystery lots [13].
3. **Title:** `Brand + item type + key spec + color`, 50 characters at most until the live limit is read, no price, no keyword lists [6].
4. **Description:** the six-part order. Strip phone numbers, emails, URLs, handles and street addresses [6, 13].
5. **Category:** from a fixed map, never chosen to save a monthly slot. Count posts per category per calendar month and stop at the cap minus one [5].
6. **Condition:** map our grades to OfferUp's values; a fault that affects use goes in line one of the description [5].
7. **Photos:** 8 photos, cover 1:1 at 1600 x 1600 px with the item inside the middle 80%, the rest 4:3. No text, borders, collages or watermarks. Flaw photos required when wear was detected. Store the touch-up note [8].
8. **Price:** local asking median within 25 miles plus 10 to 15%, rounded to 0 or 5. Firm flag off [9, Reading OfferUp].
9. **Offers:** no auto accept. Draft a counter at the midpoint of offer and list price, never under the user's floor [9].
10. **Refresh:** day 7 with no messages, lower the price 10%. Day 14, delete, then repost once with a new cover [12].
11. **Promote:** suggest only above $100 and after 3 quiet days [10].
12. **Pickup:** propose a public MeetUp Spot and two time windows; share only a neighborhood [11].
13. **Sold elsewhere:** mark sold or delete here within minutes, so the user stops getting messages [13].
14. **Form read:** before the first post each week, read the form's limits and options and update section 5 [5].

Human taps, never automatic: the final Post; accepting or countering an offer; meetup place and time; confirming payment; marking sold; paying for Promote; any repost; overriding `avoid`; answering an authenticity request.

## Reading OfferUp for search and price

What a listing exposes:

| Field | Notes | Evidence |
|---|---|---|
| Asking price | `price` | *observed* in our comps note (scraper fields), not re-opened today; same for the next four rows |
| Firm flag | `isFirmPrice` | comps note |
| Condition | Seller's choice from the fixed scale | field in comps note; labels *asserted* |
| Location | `locationName`, a city or area, never an address | comps note |
| Age of listing | Search rows carry no creation date; the post date needs the detail call | comps note and [watch note](../../../watch/ben/fanout-and-watch-loop.md) |
| Shipping available | Always no for anything posted after 2025-09-23. A "ships" flag on a row means stale data or an old cache | *observed* (policy), *inferred* |
| Seller signals | Rating, number of ratings, TruYou badge, join date, verified business or dealer badge | *asserted* (help titles seen: "Public profile badges", "TruYou verification program", "About your reputation") |
| Sold state | Sold listings stay reachable and show a "SOLD" line; 59 to 62% of OfferUp pages a web index returned were already sold | *observed* in our [Exa test](../../../watch/ben/exa-empirical.md), a text heuristic |
| Promoted | Paid placements are mixed into results | *asserted* |

Rules for the reader *agent proposal*:

1. **Asking is not sold.** OfferUp records no sale price, since payment happens in person *inferred*. A sold listing tells us only the last asking price and roughly when it went. Label every OfferUp comp "asking" in the UI.
2. **Estimate the clearing price from asks.** Take active listings for the same item inside the buyer's radius, drop the top and bottom 10%, and use the median. Then discount for haggle: 10% as a default, 0 to 5% when the firm flag is set. The discount is our assumption, not a measured figure.
3. **Use listing age as the demand signal.** An ask that has sat 30 days is above the market. A sold listing whose post date is recent is the best evidence that its ask was near the clearing price. Weight recent sold asks highest, fresh actives next, old actives lowest.
4. **Price levels are per metro.** Do not blend Seattle asks with Phoenix asks. Fall back to a wider radius only when there are fewer than 5 matches, and say so.
5. **Skip promoted rows and dealer rows** when sizing the private-seller market; keep them when showing the buyer what is available.
6. **Flag scam-shaped rows** for the buyer: price far under the local median, new account with no ratings, no TruYou, stock-looking photos.

OfferUp against Facebook Marketplace for the same item:

| | OfferUp | Facebook Marketplace | Evidence |
|---|---|---|---|
| Reach by plain HTTP | Yes, anonymous | Internal GraphQL, harder | *observed* in our [build plan](../../../price/ben/build-plan.md), not re-run today |
| Shipping | None | Shipped listings with checkout exist | OfferUp *observed*; Facebook *observed* in our [crosspost note](../crosspost-and-delist.md) |
| Structured fields | Condition and firm flag on every listing | Condition present; no firm flag | OfferUp per our comps note; Facebook *asserted* |
| Seller identity | Pseudonymous profile with ratings and TruYou | Real Facebook profile | *asserted* |
| Volume | Smaller; about 30 million transactions a year | Much larger | OfferUp *observed* (GeekWire); Facebook *asserted* |
| Price level | Similar asks; the same seller often posts on both, so dedupe by photo and title | | *inferred* |
| Sold listings | Stay reachable for a while | Usually vanish or show as sold to people who messaged | OfferUp per our Exa test; Facebook *asserted* |

## 16. References

| Source | Its job | What we take |
|---|---|---|
| [Nationwide shipping ending](https://help.offerup.com/hc/en-us/articles/41043186552980-Nationwide-shipping-ending) | Proof OfferUp is local only | Dates; adapter never offers shipping |
| [About free listing limits](https://help.offerup.com/hc/en-us/articles/13072929390228-About-free-listing-limits) | Monthly caps | Cap table; fee-avoidance rule |
| [Posting Rules](https://help.offerup.com/hc/en-us/articles/360031988292-Posting-Rules) | What a listing may contain | Photo, duplicate, contact and keyword rules |
| [Why listings are removed](https://help.offerup.com/hc/en-us/articles/360032337011-Why-listings-are-removed) | Enforcement | Stock and catalog photos get listings removed; authenticity checks |
| [Prohibited Items Guidelines](https://help.offerup.com/hc/en-us/articles/360032329711-Prohibited-Items-Guidelines) | Refuse list | Section 13 |
| [Community Guidelines](https://help.offerup.com/hc/en-us/articles/360031988352-Community-Guidelines) | Behavior | Offers do not bind; reply to buyers |
| [Video Community Guidelines](https://help.offerup.com/hc/en-us/articles/48174240530708-Video-Community-Guidelines) | Listing video | Mobile only; no defect-hiding edits |
| [Commitment to Sellers](https://help.offerup.com/hc/en-us/articles/39232498603156-OfferUp-s-Commitment-to-Sellers) | Sale terms | Inspect, pay, final |
| [Accept an offer](https://help.offerup.com/hc/en-us/articles/360032334451-Accept-an-offer) | Offer mechanics | Offers are inbox messages; web has login and inbox |
| [GeekWire 2025](https://www.geekwire.com/2025/offerup-hit-with-new-round-of-layoffs-as-marketplace-plans-to-simplify-its-offerings/) | Company state | 30 million transactions; local reset |
| [Closo, Aug 2026](https://closo.co/blogs/platform-specific-guides/selling-on-offerup) (seller blog) | Contrary lead | Blogs still print the dead 12.9% fee |
| Repo notes: [comps](../../../price/ben/comps-sources-live.md), [watch](../../../watch/ben/fanout-and-watch-loop.md), [Exa test](../../../watch/ben/exa-empirical.md) | Listing data | Field names, no date on rows, sold share |

## What I searched and couldn't reach

The session's shared fetch budget ran out after my first dozen pages, and search results gave titles and links only. Found but not opened:

- OfferUp help: "Post an item to sell", "Promote your items" and "Best practices for selling" (all three returned a site error to the fetch tool), "How to create a great listing", "Promote Plus subscription", "OfferUp Premium subscription", "For Sale listing subscriptions", "Buy single listings", "Track item listing performance", "Update an item listing", "Search for items to buy", "How to pay", "Getting paid", "TruYou verification program", "Public profile badges", "About your reputation", "Selling a vehicle", "Common buying and selling scams".
- OfferUp Terms of Service (site error): the automation and scraping clause is unread.
- OfferUp business help: "Listing Rules for Storefronts", "Listing Rules for Motors", "About the Verified Dealer Program".
- The App Store page (its in-app purchase list would give Promote prices), the Recommerce Report 2025, the Albatross press release, GeekWire's December 2024 story.
- Seller guides from Crosslist, Nifty, Vendoo and underpriced.app (folklore only).

Still unconfirmed: photo maximum, title and description limits, exact condition labels, Promote and Promote Plus prices and labels, any OfferUp AI listing tool, search sort options, whether a price drop notifies savers, in-app payment options, monthly users in 2026, metro strength. A narrow search does not show that an OfferUp AI listing tool does not exist.

## Seed frontier log

**Loop 1.** Seeds: fees (12.9%, $1.99), posting rules, company state. Read Posting Rules, Why listings are removed, GeekWire 2025, Closo Aug 2026. Changed: GeekWire says shipping is being phased out, against the fee seeds. Next: OfferUp's own word on shipping. Contrary lead: 2026 blogs that still quote the shipped fee.

**Loop 2.** Seeds: "nationwide shipping ending", Rules & Policies index, Terms. Read the shipping article, Commitment to Sellers, Prohibited Items, Video and Community guidelines. Changed: local only, with dates; listing video; no AI clause anywhere; Terms unreachable. Next: listing form, Promote, offers. Contrary lead: is listing really free?

**Loop 3.** Seeds: help-center searches for post flow, Promote, offers, limits. Read Accept an offer and About free listing limits. Changed: monthly caps per category with fee-avoidance enforcement; offers are plain messages. Budget ran out. Next seeds for whoever continues: "Promote your items", "Post an item to sell", "How to pay", the App Store in-app purchase list, Terms, then a live read of the web post form. Contrary lead: is the feed tile really square, and is the photo cap still 12?
