# Which marketplaces should each item go to, and what changes on each?
Researched 2026-11-14 by Ben (Claude Code, with one research helper per platform). Feature: list.

Ben asked for each platform to be tailored on its own, to the depth of his earlier Depop research, with a set list of what belongs where and a photo rule of touch up only ([words](../../../product/words.md#2026-11-14-photos-touch-up-never-change-the-environment)). This note is the summary. The depth is in one note per platform:

| Platform | Our use today | Note |
|---|---|---|
| eBay | post | [ebay.md](platforms/ebay.md) |
| Facebook Marketplace | post | [facebook-marketplace.md](platforms/facebook-marketplace.md) |
| Depop | post | [depop.md](platforms/depop.md) |
| Poshmark | post | [poshmark.md](platforms/poshmark.md) |
| Mercari | post | [mercari.md](platforms/mercari.md) |
| OfferUp | search and price | [offerup.md](platforms/offerup.md) |
| Grailed | search and price | [grailed.md](platforms/grailed.md) |

Each note has the same 16 sections: buyers, fees to the cent, field limits, title and description rules, tags, photos, offers, boosts, shipping, ranking, rules that get accounts restricted, a verdict for 31 product types, and the adapter rules. The verdicts and each platform's listing profile are also in [platform-fit.json](platforms/platform-fit.json), which a program can read. `node research/list/ben/platforms/fit.mjs furniture` prints where a couch goes.

Marks: a fact here is *observed*, *asserted* or *inferred* in the platform note it comes from. Every verdict, set and rule in this note is an *agent proposal* built on those facts.

## Short answer

1. **No product type is a strong fit on all five posting platforms** *inferred* (from the matrix below). "Post everywhere" is the wrong default. The app should route by product type.
2. **Things fall into three groups.** Things you wear go to Depop, Poshmark, eBay and Mercari. Things with a model number go to eBay first, then Mercari and a local Facebook post. Big and heavy things go to Facebook only.
3. **A couch goes on Facebook Marketplace and nowhere else we post.** Depop has a furniture category but ships only and its buyers want clothes. Poshmark caps parcels at 15 lb. Mercari will not ship it. eBay can only offer pickup, with a fee.
4. **Each platform has one lever the others lack.** eBay: item specifics and the 80-character title. Depop: offers sent to likers by its API. Poshmark: the 3:4 cover and offers with a shipping discount. Mercari: price cuts are the boost. Facebook: reply speed and renewing. Grailed: a 10% price drop. OfferUp: staying local and inside its free listing caps.
5. **The touch-up rule costs us nothing on any platform** *inferred*. No platform requires a changed background. Every photo norm we found can be met by guiding the shot at capture.

## How a verdict becomes an action

| Verdict | Meaning | What the app does |
|---|---|---|
| best | a top place for this kind of item | posts there by default |
| good | sells well there | posts there by default |
| ok | will sell, but it is not a strength | offers it as "more reach"; off by default |
| avoid | allowed, but a poor fit | does not post; says why and names a better place; the person can override |
| blocked | not allowed, or no category | never posts; says why |

Whether "ok" platforms are on or off by default is Ben's call. Off is the proposal: fewer live copies means fewer double sales to unwind and fewer buyers to answer.

## The set list for each platform

**eBay.** Post: sneakers, luxury handbags, jewelry and watches, fan apparel and jerseys, phones and computers, cameras, audio and consoles, trading cards and collectibles, tools, auto parts. Also good: vintage, streetwear, designer, men's clothing, shoes, accessories, outdoor apparel, games and media, small home goods, small appliances, sporting goods, instruments, antiques, lots. Only if asked: women's mall brands, kids clothing, sealed beauty, baby gear, handmade. Do not post: single fast-fashion pieces under $15, furniture, large appliances.

**Facebook Marketplace.** Post: furniture, large appliances, home decor, tools, bikes and fitness gear, auto parts and vehicles, baby gear, lots. Also good: kids clothing in lots, phones and computers, consoles and cameras, small appliances, instruments, antiques. Only if asked: most clothing, shoes and accessories (local buyers pay less), media, toys, handmade. Do not post: designer clothing, luxury handbags, fine jewelry and watches, beauty, single fast-fashion pieces.

**Depop.** Post: vintage and Y2K clothing, streetwear. Also good: designer, women's and men's brands, sneakers, shoes, jewelry, accessories, outdoor apparel, jerseys, handmade and reworked pieces. Only if asked: fast fashion over $8, kids clothing, handbags, beauty, records and books, toys, small homeware, small sports gear, art prints. Do not post: furniture, tools, instruments, baby gear, lots. Cannot post: phones, computers, headphones, speakers, consoles, appliances (Depop has banned electronics since July 2020; cameras, film and lenses are allowed), vehicles.

**Poshmark.** Post: women's mainstream brands, shoes, luxury handbags. Also good: vintage, designer, men's brands, kids clothing, sneakers, jewelry, accessories, outdoor apparel, bundles. Only if asked: streetwear, fast fashion in bundles, jerseys, new beauty, small cameras and headphones, toys, light home goods, handmade. Do not post: phones and computers, media, small appliances, sports equipment, baby gear, antiques. Cannot post: furniture, large appliances, tools, instruments, auto parts.

**Mercari.** Post: trading cards, collectibles and toys. Also good: women's brands, kids clothing, sneakers, luxury handbags, beauty, cameras, audio and consoles, video games and media, small home goods, lots. Only if asked: most other clothing, shoes, jewelry, accessories, phones, small appliances, tools, sporting goods, instruments, antiques, handmade. Do not post: furniture, large appliances, anything motorized, baby gear.

**OfferUp** (if we add posting). Post: furniture, large appliances, tools, bikes and fitness gear, auto parts and vehicles. Also good: sneakers in big metros, phones, consoles, home decor, small appliances, instruments, baby gear, lots. Do not post: almost all clothing, handbags, jewelry, accessories, beauty.

**Grailed** (if we add posting). Post: streetwear, designer and archive clothing. Also good: vintage and workwear, sneakers, boots, designer accessories, technical outerwear. Only if asked: men's mainstream brands, handbags, designer jewelry, vintage jerseys. Do not post: women's mall brands, fast fashion, unbranded or custom pieces, lots. Cannot post: anything that is not fashion, and kids clothing.

## The "all" set

Thirteen product types have no "avoid" or "blocked" on any of the five posting platforms, so the app can safely post them everywhere when the person asks for full reach:

vintage clothing, streetwear, women's mainstream brands, men's mainstream clothing, kids clothing, sneakers, other shoes, accessories, outdoor apparel, fan apparel, collectibles and toys, small home decor, handmade.

Read it with one warning: on Facebook every clothing type is only "ok", because local buyers pay less and a single shirt is rarely worth a meetup. For clothing, the real "all" is the four sites that ship.

Three presets cover most items:

| Preset | Product types | Goes to | Never |
|---|---|---|---|
| Wardrobe | clothing, shoes, accessories | Depop, Poshmark, eBay, Mercari | Facebook only as a lot |
| Model number | phones, computers, cameras, consoles, games, cards, collectibles, tools | eBay, Mercari, Facebook for local cash | Depop (electronics ban), Poshmark (20% fee) |
| Big and heavy | furniture, appliances, bikes, fitness gear, baby gear, vehicles | Facebook | Depop, Poshmark, Mercari; eBay only as paid local pickup |

## The full matrix

| Product type | eBay | Facebook | Depop | Poshmark | Mercari | OfferUp | Grailed |
|---|---|---|---|---|---|---|---|
| Vintage and Y2K clothing | good | ok | best | good | ok | avoid | good |
| Streetwear and hype brands | good | ok | best | ok | ok | ok | best |
| Designer and luxury clothing | good | avoid | good | good | ok | avoid | best |
| Women's mainstream brands | ok | ok | good | best | good | avoid | avoid |
| Men's mainstream clothing | good | ok | good | good | ok | avoid | ok |
| Fast fashion and low-value basics | avoid | avoid | ok | ok | ok | avoid | avoid |
| Kids and baby clothing | ok | good | ok | good | good | ok | blocked |
| Sneakers | best | ok | good | good | good | good | good |
| Boots, heels, dress shoes, sandals | good | ok | good | best | ok | ok | good |
| Luxury handbags and small leather goods | best | avoid | ok | best | good | avoid | ok |
| Jewelry and watches | best | avoid | good | good | ok | avoid | ok |
| Hats, belts, sunglasses, scarves | good | ok | good | good | ok | avoid | good |
| Outdoor and technical apparel | good | ok | good | good | ok | ok | good |
| Sports fan apparel and jerseys | best | ok | good | ok | ok | ok | ok |
| Makeup, skincare, fragrance | ok | avoid | ok | ok | good | avoid | blocked |
| Phones, laptops, tablets | best | good | blocked | avoid | ok | good | blocked |
| Cameras, headphones, speakers, game consoles | best | good | blocked | ok | good | good | blocked |
| Video games, books, vinyl, DVDs | good | ok | ok | avoid | good | ok | blocked |
| Trading cards, collectibles, LEGO, toys | best | ok | ok | ok | best | ok | blocked |
| Home decor and small housewares | good | best | ok | ok | good | good | blocked |
| Small kitchen and home appliances | good | good | blocked | avoid | ok | good | blocked |
| Furniture | avoid | best | avoid | blocked | avoid | best | blocked |
| Washers, fridges, other large appliances | avoid | best | blocked | blocked | avoid | best | blocked |
| Hand and power tools | best | best | avoid | blocked | ok | best | blocked |
| Sporting goods, bikes, fitness equipment | good | best | ok | avoid | ok | best | blocked |
| Musical instruments and pro audio | good | good | avoid | blocked | ok | good | blocked |
| Auto parts and vehicles | best | best | blocked | blocked | avoid | best | blocked |
| Strollers, car seats, cribs | ok | best | avoid | avoid | avoid | good | blocked |
| Antiques and art | good | good | ok | avoid | ok | ok | blocked |
| Handmade and custom items | ok | ok | good | ok | ok | ok | avoid |
| Bundles and low-value lots | good | best | avoid | good | good | good | avoid |

The reason for every cell is in the JSON file and in section 14 of each platform note. The table is printed by `fit.mjs`; change the JSON, not the table.

## Do not post this there

The refusals and warnings the app should give, with the reason it shows and where it points instead.

| Item | Not on | Why | Instead |
|---|---|---|---|
| Couch, dresser, mattress | Depop, Poshmark, Mercari, eBay, Grailed | Depop ships only and sells clothes. Poshmark stops at 15 lb. Mercari will not ship furniture. eBay means freight or paid pickup. Grailed has no category | Facebook; OfferUp |
| Washer, fridge | all five ship-only sites | cannot ship; Depop also bans appliances as electronics | Facebook; OfferUp |
| Phone, laptop, headphones, console | Depop, Grailed | Depop's electronics ban; Grailed is fashion only | eBay, then Mercari, Facebook for local cash |
| Phone, laptop | Poshmark | 20% fee and no device checks | eBay |
| Single cheap shirt | eBay under $15, Poshmark under $15, Mercari under $12, Grailed under $33, Depop under $8, Facebook | a fixed fee or the label eats the sale; not worth a meetup | make a lot: Poshmark bundle, Mercari lot, Facebook lot |
| Designer bag, fine jewelry, watch | Facebook, OfferUp | no authentication, counterfeit rules, cash-meetup risk | eBay (authentication), Poshmark (free authentication at $500 and up), Mercari (bags) |
| Women's mall brands | Grailed, OfferUp | Grailed can remove them; no local demand | Poshmark, Depop, Mercari |
| Trading cards | Depop, Poshmark, Grailed, local sites | collectors search eBay and Mercari | eBay, Mercari |
| Used makeup | everywhere | banned or prohibited on eBay, Facebook and OfferUp; new only on Poshmark | refuse |
| Fragrance, nail polish, aerosols | Poshmark | cannot ship there; the seller pays the full $50 hazmat penalty | Mercari with the hazmat choice; eBay if sealed |
| Tools | Poshmark, Depop | no category; Depop bans blades and treats power tools as electronics | eBay, Facebook |
| Stroller, car seat, crib | Depop, Poshmark, Mercari | bulky, over weight caps, safety rules | Facebook, after a recall and expiry check |
| A lot or bundle | Depop, Grailed | Depop buyers pick single pieces; Grailed allows one item per listing | eBay, Poshmark, Mercari, Facebook |
| Kids clothing | Grailed | no kids department | Poshmark, Mercari, Facebook lots |
| Anything over 5 lb | Poshmark | the seller pays $5 or $10 extra; 15 lb is the cap | eBay calculated shipping; Facebook |

## What changes on each platform

The listing's shape:

| | eBay | Facebook | Depop | Poshmark | Mercari |
|---|---|---|---|---|---|
| Title | 80 characters: brand, model, type, model number, size, color | aim for 60; short and plain | none; the first line of the description | 80: brand, style, item, color, size | 80: brand, item, model or character, size, color |
| Description | spec sheet, every flaw | six short lines, pickup area | 1,000 characters, casual, five lines | 1,500, measurements always | 1,000, three to six lines |
| Tags | none; item specifics and category do the work | 8 to 12 product tags | 0 to 5 hashtags that add words line 1 lacks; not a ranking factor | up to 3 style tags | up to 3 hashtags that add words the title lacks |
| Photos | 8 to 12 of 24, cover 1:1 | 6 to 10, cover 1:1 | 5 to 8 of 8, all 1:1 | 8 of 16, all 3:4 | 8 to 12 of 12, all 1:1 |
| What search reads | title, item specifics, category, condition | title, category, distance, recency | description, brand, category, size, color; relevance ranks first | brand, size, condition, category | title, category, brand; seller record |

How it sells:

| | eBay | Facebook | Depop | Poshmark | Mercari |
|---|---|---|---|---|---|
| List price | target plus 10% | target plus 10% at $50 and up | target divided by 0.85 | target divided by 0.85, never under $15 | target times 1.18 |
| Offers | Best Offer: auto-accept at target, auto-decline under 80% | chat only; nothing binds | API sends an offer one hour after a like, and counters at the floor | Smart Sell, or Offer to Likers at 10% off with a shipping discount | Offer to Likers at 10% off; every cut must beat the lowest price so far |
| Does an accepted offer bind? | usually, payment at once | no | no; first to pay wins | yes | yes for Offer to Likers |
| Free visibility | offers to watchers; 30-day returns and 1-day handling rank | renew at day 7; reply in minutes | fill every field; popularity ranks second | ship in 2 days; active closet | price cuts: Promote 5%, Sale 10% |
| Paid boost | Promoted Listings, off | Boost, off | Boost at 12%, a tap | Promoted Closet, off | none |
| Refresh | revise the price; no relist before 60 days | renew, cut, relist near day 30 | edit in place; relist only with no likes | new title or cover, then a 10% drop | one real edit a week; no relisting |
| Fee | 13.6% plus $0.40 in most categories | none local; 10% shipped | 0% plus 3.3% and $0.45 processing | 20%, or $2.95 under $15 | 10% of item plus shipping |
| Seller nets on $40 | about $32.91 | $40.00 local | about $37.91 | $32.00 | about $35.20 |
| Seller nets on $200 | about $169.04 | $200.00 local | about $192.10 | $160.00 | about $179.15 |

The search rules every site shares (12 of them), each site's differences, and a script that builds a title per site and checks a draft with no model call are in [listing-seo.md](listing-seo.md).

The net figures are worked examples from each note with the buyer paying shipping. They are *inferred* from fee pages, and the tax assumptions differ slightly between notes. Grailed nets about $35.71 and $174.53; its fee steps from 6% to 9% at $120, so a $120 sale nets less than a $119 one. OfferUp is local only and takes no fee.

Because Depop takes no selling fee, the same item can be listed about 15% lower there than on Poshmark for the same payout *inferred*. The price step should compute a list price per platform from one target payout, never copy one price everywhere.

## Photos under the touch-up rule

Ben's rule: the app touches up and never changes the environment or lies. The levels are defined in the [studio plan](../../studio/ben/build-plan.md): 0 is true color, 1 is even light, 2 is "pressed".

**One capture serves every crop.** Shoot portrait (3:4) on a plain wall, door or clean floor in window light, with the whole item inside the centered square and a small margin. From that one frame the adapter cuts 1:1 for eBay, Depop, Mercari, Facebook and OfferUp, keeps 3:4 for Poshmark, and trims to 4:5 for Grailed. Nothing is padded: eBay bans added borders *observed*.

**Evidence photos stay at level 0 everywhere.** Tag, label, serial plate and flaw photos get white balance and exposure only, never a generative model. Grailed moderators read tags and stitching before a listing goes live, eBay authenticators compare the item to the photos, and a local buyer inspects at the door.

| Platform | Cover and size | Count | Default level | What sellers do there that we skip | Risk to watch |
|---|---|---|---|---|---|
| eBay | 1:1, 1600 x 1600 | 8 to 12 | 1 | white cut-out; eBay's AI scene backgrounds | "photos that don't accurately represent the item" are banned *observed* |
| Facebook | 1:1, 2048 x 2048; others in native shape | 6 to 10 | 0 | virtual staging, erasing the room | a raw Seedream render carries a signed "made by an AI model" credential (C2PA) *observed* by the studio thread, which Meta can read for its "AI info" label *inferred*; a crop or JPEG re-save drops it *observed*. See the [studio plan](../../studio/ben/build-plan.md) |
| Depop | all 1:1, 1280 x 1280 | 5 to 8 | 1 | Depop's own background remover | none found; only the seller's own photos are allowed *observed* |
| Poshmark | all 3:4, 1200 x 1600, item inside the centered square | 8 | 1 | "NWT" banner covers, collages | covers are cropped to 3:4 since March 2026 *observed* |
| Mercari | all 1:1, 1600 x 1600 | 8 to 12 | 1 | stock photos | "only photos you took" *observed* |
| OfferUp | 1:1, 1600 x 1600; others 4:3 | 8 | 0 | nothing | "a photo of the actual item, not a catalog or stock photo", and no added stickers or text *observed*; the buyer inspects in person |
| Grailed | 4:5, 1600 x 2000 (ratio unconfirmed) | 6 to 9 | 0 | nothing; a real wall or floor is the house style | listings are reviewed for authenticity; keep blacks true |

Level 2 ("pressed", which flattens creases) is allowed. Ben, 23:01 UTC: "it shouldnt change anything in reality except maybe how things are flattened etc" ([words](../../../product/words.md#2026-11-14-garment-templates-a-reference-set-and-reading-c2pa)). Where to use it is still an *agent proposal*: the cover on Depop, Poshmark and Mercari, and not on eBay, OfferUp or Grailed, where the photo is checked against the item in hand. Evidence photos stay at level 0 either way.

No platform we read bans AI-edited photos by name. eBay and Depop both ship tools that replace backgrounds, which our rule forbids. The binding rule everywhere is accuracy, and the touch-up rule is stricter than any of them.

## What this research changed for other work

1. **OfferUp is local only.** Nationwide shipping ended for new listings on 2025-09-23 *observed*. Any plan that assumed shipped OfferUp sales or a 12.9% fee is out of date.
2. **Poshmark covers are 3:4 portrait** since 2026-03-25, shipping is $6.49 by USPS Ground Advantage, and sharing other people's listings no longer affects discovery *observed*. The capture and studio crops need a 3:4 output.
3. **Grailed's terms (effective 2026-01-27) ban third-party tools, scrapers and AI systems without written consent** *observed*. This touches our price reads in [comps-sources-live.md](../../price/ben/comps-sources-live.md) as well as any posting. For the demo we keep reading; for anything past the demo we ask Grailed or hand the post to the person.
4. **Mercari's terms ban automated means unless Mercari provides the interface** *observed*. The demo route stays Browser Use with the person's tap; the longer route is a partner integration, as Vendoo has.
5. **The eBay listing on Facebook is not guaranteed.** Only selected eBay listings appear on Marketplace *observed*. [crosspost-and-delist.md](crosspost-and-delist.md) says a shipped item "rides eBay"; treat that as a bonus and say so in the app.
6. **Depop's partner API negotiates for us.** It sends an offer one hour after a like and counters buyer offers at a set price *observed*. It also has a pricing endpoint with similar sold items, which answers the "no sold prices" gap from depop-plus. Its API terms (2026-04-22) also bar partners from browser automation on Depop *observed*, which conflicts with "Browser Use and replay until granted" in [crosspost-and-delist.md](crosspost-and-delist.md). For the demo, Browser Use with the person's tap stays; once we hold API access, the browser route has to go.
7. **Depop boost is 12%** from 2026-03-23, and eBay closed its purchase of Depop on 2026-07-30 *observed*. No eBay to Depop cross-listing was found.
8. **eBay Promoted Listings charge on almost every promoted sale** since 2026-01-13, when any buyer's click in the last 30 days began to count *observed*. Default off.
9. **Relisting is not a free win.** Mercari says it favors real updates over delete and relist *observed*. Depop ranks popularity above age *observed*, so a relist throws away likes. Only Facebook and a Poshmark listing with zero likes gain from a relist.
10. **Facebook now writes listings with Meta AI and has a Seller app** (2026) *observed*. A judge may ask how we differ: we measure the item, price from sold data and route across sites.

## Platform rules as code, and what goes wrong without them

Ben asked that the code understand each app: "if depop offers only last 24 hours, whatever depends on that fact should actually depend on that" ([words](../../../product/words.md#2026-11-15-the-code-understands-each-app)). [spec/sites.mjs](../../../spec/sites.mjs) holds each such rule once, with its evidence mark, and `node --test spec/sites.test.mjs` proves the cases below. *Agent proposal.*

| What goes wrong | Why | What the code does |
|---|---|---|
| A timer shows the wrong expiry | eBay counters and sent offers last 96 hours, everything on Depop and Mercari 24, Facebook chat offers have no clock | `offerExpiresAt(site, kind, sent)` reads the one fact; Facebook returns no clock |
| We pull the other listings when a Depop offer is accepted, and the buyer never pays | On Depop acceptance charges nobody; the buyer has 24 hours and anyone else can still buy | `afterAccept('depop')` says it is not a sale yet and the others stay up |
| We leave the other listings up after a Poshmark or Mercari acceptance | There the buyer is charged at once | `afterAccept` says sale, delist the others now |
| An offer we sent on Mercari is accepted after the item sold on eBay | A sent offer binds for 24 hours on Mercari, 96 on eBay | `sellerOffer` refuses to send while the item is promised elsewhere; `exposedUntil` gives the time the listing can still sell |
| A sent offer is rejected by the site | Floors differ: 5% under on eBay and Depop, 10% on Poshmark and Mercari, and on Mercari 10% under the lowest price so far; eBay waits 48 hours, Mercari 72 | `sellerOffer` returns the reason before the call goes out |
| Code acts on a number nobody confirmed | Poshmark's help center blocks readers, so its clocks are from memory | An unknown fact throws; `unconfirmed()` lists the facts an adapter must read from the live page first |
| A second copy of a rule drifts | Someone types 24 into a message template | The test fails any product code line that holds an offer clock |

Not in the module yet: cancellation penalties, shipping deadlines, selling limits and prohibited items (the last is the fit list above). Fees belong to the money fee table.

## Open for Ben

- Should "ok" platforms be on or off by default? Proposal: off.

## Planned, not built: posting to Grailed and OfferUp

Ben, 22:09 UTC: "plan them but dont do anything yet. things if we have time" ([words](../../../product/words.md#2026-11-14-grailed-and-offerup-posting-planned-not-built)). Both stay search and price only. The plan moved to the ideas board: [post-to-grailed-and-offerup.md](../../../ideas/post-to-grailed-and-offerup.md).

## Limits

- The helpers shared a budget of about 100 page reads an hour, and it ran out during every platform's second or third loop. Each note lists what was read at the source and what is from memory or from seller blogs. Facebook's and Poshmark's help centers refused automated readers, so their form limits and Poshmark's fee wording are *asserted*.
- A recheck of load-bearing quotes after the helpers finished found one false claim: the OfferUp note said "heavily edited photos" were a named removal reason. A second read of both OfferUp pages found no such sentence, and the note is corrected. The helpers read pages through a fetch summarizer, so an *observed* mark means "the summarizer reported it", and exact wording should be re-read before it is quoted in the pitch or in the app. Rechecked and confirmed: OfferUp's shipping end dates; Grailed's fee table ("$120 and above | 9%", "Under $120 | 6% (minimum $1.99)", for sales on or after 5/20/26); Grailed's terms naming robots, scrapers and "artificial intelligence or machine learning systems (including large language models)"; and that eBay's selling-limits page gives no numbers. A third pass at 22:36 UTC re-read the last three and all held up: Depop's electronics policy ("From 13th July 2020, consumer electronics will no longer be permitted for sale on Depop"; cameras, film, lenses and wrist watches are allowed), Poshmark's post ("Cover photos now display in portrait (3:4) instead of square (1:1)"; no pixel size given) and Mercari's fee page, updated 10/23/2026 ("10% of the item price + buyer-paid shipping"; buyers pay 3.6% on the same base). Not reachable at the source: Poshmark's fee page (its help center refuses automated readers), so the 20% and $2.95 figures stay *asserted*.
- Field limits marked unconfirmed in the JSON (`unconfirmed`) should be overwritten the first time the adapter opens each live form. Every adapter's first rule is to read the form's own counters.
- Verdicts are judgments from fees, rules, shipping limits and each platform's own statements about what sells. None is backed by sell-through data of ours. The data loop should record where each product type sells and how fast, and correct this table.

## Seed frontier log

- **Loop 1** (seeds: Ben's depop-plus playbook and 28-page Depop report; the repo's crosspost and lessons notes). Set the depth target and the 16-section shape. Next: one helper per platform with the same product-type list.
- **Loop 2** (seven helpers, three search loops each; their logs are in the notes). Changed: OfferUp lost shipping; Poshmark went 3:4; Grailed's fee and terms changed; Depop's API automates offers. Contrary lead: is there any product type that fits everywhere? No.
- **Loop 3** (merge). Built the matrix and found that Facebook is only "ok" for every clothing type, which splits the "all" set into the three presets above.
