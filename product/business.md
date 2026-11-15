# Why people want it, and how free pays

Ben, 05:43: "we should know why people would die to download this... this is the easiest way to sell it, optimized to save you the most time and get you the most money, as cheaply as possible. and its completely free because this is how we propose this is a viable business model... market research. where our market reach could be. where our market doesnt reach. here is what we need to make this viable. here are the hurdles we may run into. keeping it extremely honest." Everything here is an *agent proposal* until Ben and Nate pick it; how it earns is still open in [vision](vision.md#proposed). Marks: *observed*, *asserted*, *inferred*, as in the research. Our own measured numbers are in [numbers.md](numbers.md).

## Why someone downloads it

**If you're selling.** You have a pile of things worth real money and no evening to spend on it. Today you choose between consignment, which pays $3 of a $20 sale, and doing it yourself across five apps for about $17 ([pitch evidence](../research/cross-cutting/ben/pitch-evidence.md)). secondhand gives you the $17 for a few photos:
- **The most money.** It puts the item where its buyers are, at a price solved from what lands in your account. On a $20 item, picking the right site is worth $2.69 by itself (measured, [numbers](numbers.md)).
- **The least time.** It answers buyers, handles offers inside your minimum, and takes listings down everywhere when one sells. You see a short list of decisions, not five inboxes.
- **No risk you didn't choose.** It never sells below your price, never gives out your address, and never sends a reply that states something your item doesn't back.

**If you're buying.** You want a thing used, in your size, at a fair price, and you don't want to search five apps. secondhand searches every site at once, tells you what it usually sells for, shows the total with shipping, and tells you when new or refurbished is the better buy. It watches for the thing you want and tells you once when it turns up.

**Both sides use one engine.** The same photo that prices your jacket to sell tells you what a fair price for someone else's is. People who sell used things also buy them, which is the person we build for first ([decision](decisions.md#2026-11-14-the-first-person-we-build-for-is-someone-clearing-their-own-things)).

## Why free

Every other model charges the person at the wrong moment:

| Model | Who uses it | Why it doesn't fit our person |
|---|---|---|
| Consignment (ThredUp keeps 85% of a $20 sale, *observed*) | people who'd rather not touch it | takes most of the money on cheap items, which is the problem |
| Monthly subscription (crosslisters; one Depop tool listed at $39.99 a month, *asserted*) | resellers with dozens of live items | nobody subscribes to clear out a closet once |
| A cut of each sale | marketplaces already do this (eBay 13.6%, Poshmark 20%) | a second cut on top of the site's makes the "most money" promise false |
| Free, paid for by the buying side | anyone | the person never pays; we earn when a buyer we sent buys |

So: **free to sell and free to buy.** It works only because an agent's cost per item is cents, not dollars. About $0.03 to $0.10 per item listed, or $0.28 to $0.35 with studio photos (an estimate from observed list prices, not yet billed; [numbers](numbers.md#what-a-listing-costs-us)). A person's time costs the same for a $5 shirt and a $200 bag; ours nearly doesn't change with the item.

## How free pays

1. **Referrals on the buying side.** When a buyer we sent buys, the site pays a commission. eBay's Partner Network pays a share of the sale by category (*observed* that it exists, rate card at partnernetwork.ebay.com); one reading of the card puts fashion at 4% and most home categories at 3% (*asserted*). A $40 eBay purchase would pay about $1.20 to $1.60, against cents to list an item ([buyer-side affiliate](../research/watch/nate/buyer-side-actions-and-affiliate.md)). A referral never changes which listing we call best; that is a rule in the code ([buy](../spec/features/buy.md)).
2. **Optional paid extras.** Studio photos cost us about $0.25 an item, so they can be the one paid feature; everything else stays free.
3. **A plan for resellers.** People with 50 live items cost us more to watch and get more from us; a flat monthly price under the crosslisters' is fair to them.
4. **Later, anonymous market data.** What sells, where, for how much and how fast, across sites, from consenting sellers and sources whose terms allow it ([Nate](words.md#2026-11-14-nate-referrals-and-market-data)).

The break-even, honestly (*inferred*): if a seller lists 10 items a month, they cost us about $0.30 to $1.00 a month plus watching. One referred eBay purchase a month by the same person covers it. Whether people buy through us that often is the number we don't have, and it decides whether free works.

## Where we reach

| Who | Why they're ours | The moment |
|---|---|---|
| Students moving out | a deadline and a room of things | move-out week; a campus launch |
| Parents with outgrown kids' things | constant, cheap, high volume | every season |
| Someone clearing a relative's home | many things, no idea what they are | the "I don't know what this is" path ([edge cases §4](../spec/edge-cases.md#4-not-knowing-what-it-is-a-relatives-things-a-pile-a-house)) |
| People who buy used and hate searching | five apps, no fair-price check | any time they want something |
| People scared of meetups | the address lock, public spots, who is coming | Facebook Marketplace sellers |

Scale of the pool: US secondhand apparel is projected at $78.8B by 2030, and ThredUp names supply as the market's constraint (*observed*, ThredUp and GlobalData, sponsor has a stake). eBay found its sellers had 36 sellable items worth $3,675 at home on average (*observed*, eBay's 2020 report, a sample of people who already sell). eBay has 136M active buyers without Depop (*observed*, Q3 2026).

## Where we don't reach, on purpose or not yet

- **Outside the US.** Fees, shipping and sites are US only for now.
- **Luxury and authenticated goods.** Items over a site's authentication line (eBay checks sneakers over $150, *asserted*) need checks we don't do; we flag "could be valuable" and suggest an appraisal.
- **Cars, property, tickets, gift cards, regulated things.** Refused or out of scope.
- **Sites we don't post to.** Etsy, Vinted, Craigslist and Swappa are out; OfferUp and Grailed are search and price only ([decision](decisions.md#2026-11-14-the-platform-list-is-set)). Copy listing covers the rest by hand.
- **People who won't link an account.** They can still price and search, but nothing is posted for them.
- **High-volume resellers as the design target.** They can use it, but they don't shape it; the crosslisters serve them already.

## What has to be true for it to work

1. **Access holds.** The sites keep allowing a person's own signed-in agent, or offer official access. eBay has an API; Depop has a partner program we haven't joined; the others have neither.
2. **Watching stays cheap.** Public-page checks keep working, so a browser opens only to confirm (a browser kept open would cost about $170 a month per person on four sites, [numbers](numbers.md#what-a-listing-costs-us)).
3. **Referral programs accept us.** eBay's Partner Network needs approval for production Buy API access; Facebook and OfferUp have no consumer program we found.
4. **People trust it with their accounts.** The approval-first design and the record of every action are what earn that.
5. **The App Store accepts it.** Server-held site sessions may raise App Review guideline 5.1.1(v); a TestFlight review is the first test ([connect](../spec/features/connect.md)).

## The hurdles, plainly

| Hurdle | How bad | What we'd do |
|---|---|---|
| Site terms bar automated access; eBay's from 2026-02-20 bans LLM bots placing orders without human review | the biggest risk | act only as the person, after their approval, at a human pace; official APIs and partner programs first |
| A site changes its pages | weekly | recorded actions fall back to typed steps, then to an agent, and file a repair |
| Referral revenue is thin outside eBay | decides "free" | paid extras and a reseller plan carry it; measure purchases per user early |
| Account limits for users | high for that person | stop at the first warning; show each site's risk before linking |
| Bot disclosure law (California B&P 17940 to 17943, *asserted*) | at launch | disclose on the first automatic message |
| eBay's API licence bars price modelling on its data | at launch | eBay rows tagged and kept out of models |
| Meetup harm | rare, serious | address locked, public spots, daylight, who is coming shown first |
| We have no users yet | today | 100 real items with students at move-out, and publish the results |
