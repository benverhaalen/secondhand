# What would a reseller want that Ben hasn't named yet?
Researched 2026-11-14 by Ben (Claude Code agent, concept thread). Feature: cross-cutting.

Ben, 20:17: "there are definitely features and things i have yet to discuss because im no domain expert in ebay for example. i need your knowledge to figure out what i could be missing. what i want rather than what i say."

Method: domain knowledge of how eBay, Depop, Poshmark, Mercari and Facebook Marketplace work for sellers and buyers, checked against the [function map](../../../product/functions.md) for gaps. Every platform fact here is *asserted* (from knowledge, not re-opened this session) unless marked. This is a hackathon demo (Ben, 21:08), so build these and fake the platform side where needed; the asserted facts only shape how a card looks. Each row says what the user actually wants, not the platform's feature name.

## The ones that change Today (highest stakes first)

| # | What the user wants | Platform reality (asserted) | Why it matters | Where it lives |
|---|---|---|---|---|
| M1 | "Don't let me miss a shipping deadline" | eBay sellers set a handling time (often 1 to 3 business days). Late shipment counts against seller performance. Depop and Poshmark also expect fast shipping, and Poshmark labels are prepaid | A late ship can cost seller standing and future visibility | Today card with the deadline; Sell tile pill "Ship by Tue" |
| M2 | "Don't let a good offer expire" | eBay buyer offers expire after 24 hours and counters after 96 (eBay help, observed in [messages-and-offers](../../messages/ben/messages-and-offers.md)); Mercari and Poshmark offers expire too | Missed offers are lost sales | Today offer card shows when it expires |
| M3 | "Handle a return or 'not as described' claim before it escalates" | eBay returns and Money Back Guarantee cases have response windows; Depop and Poshmark have their own dispute flows | Ignoring a case can lose the money and hurt the account | Today card, top priority, Never alone |
| M4 | "Tell me when a buyer cancels or doesn't pay" | eBay cancellation requests and unpaid items; Marketplace no-shows | The item has to go back up everywhere | Today card; item returns to Live |
| M5 | "Make my stuff sell faster without me babysitting it" | Poshmark daily "sharing" boosts visibility. Mercari price drops of about 10% or more notify likers. Depop listings can be refreshed. Marketplace lets you renew listings | These are the real levers each platform rewards | Automation rules (Auto tier), logged |
| M6 | "Reach people who already showed interest" | eBay "send offer to watchers"; Poshmark "offer to likers"; Depop and Mercari let you message or offer likers | The highest-converting move most sellers don't use | Today suggestion card: "9 people liked the jacket. Offer them $40?" |
| M7 | "Know when the money actually arrives" | Payout schedules differ, and new sellers can have holds | People plan around cash | You tab; a quiet Today line when a payout lands |

## Selling gaps (not in the function map yet)

| # | What the user wants | Platform reality (asserted) | Proposed home |
|---|---|---|---|
| M8 | "Auto-accept good offers, auto-decline insulting ones" | eBay supports auto-accept and auto-decline thresholds on Best Offer | Item price sheet: "Accept offers over $X automatically" (Auto tier) |
| M9 | "Pay to get seen, only if it's worth it" | eBay Promoted Listings (a fee percentage on sale); Poshmark and Depop boosts | Item card option with the cost spelled out in dollars |
| M10 | "Fill the boring required fields for me" | eBay item specifics (brand, size, color, material) affect search placement | Draft auto-fills them from photos and the tag; marked *estimated* |
| M11 | "Pause everything while I'm away" | eBay Time Away, Depop holiday mode, Poshmark vacation hold | You > Accounts: one switch for all sites |
| M12 | "Relist what didn't sell" and "Sell one like this" | eBay relist and "sell similar"; listing durations end | Sell tile menu: Relist, Duplicate |
| M13 | "Combine shipping when someone buys two things" | eBay combined shipping; Poshmark and Depop bundles | Offer/bundle flow in Today |
| M14 | "Is this authenticated?" | eBay Authenticity Guarantee for some sneakers, watches, bags and trading cards over a price; Poshmark authentication over $500 | Draft flag: "This will go through eBay's authentication" |
| M15 | "What did I actually make?" | Fees, shipping, promotion and cost of goods all differ by site | Each sold item shows "You kept $X" after everything; You tab totals |
| M16 | "Leave feedback for buyers" | eBay sellers can only leave positive feedback for buyers; ratings matter on every site | Auto tier after payment, logged |
| M17 | "Block or limit sketchy buyers" | eBay buyer requirements; block lists on each site | You > Automation, plus a Block action on any conversation |
| M18 | "Edit many listings at once" | eBay bulk edit; crosslisters sell this | Sell: select tiles, then "Lower 10%", "End" or "Move to shelf" |
| M19 | "Answer the same question the same way" | Saved replies on most sites | Learned replies (Auto tier), editable |
| M20 | "Sell safely in person" | Police-station exchange zones; Venmo and Zelle scams; holds and no-shows | Pickup flow: suggests a public spot, warns on payment-screenshot scams (#17) |

## Buying gaps

| # | What the user wants | Platform reality (asserted) | Proposed home |
|---|---|---|---|
| B1 | "What will it actually cost me, delivered?" | Shipping, sales tax and buyer fees (Depop and Poshmark have buyer-side fees in some markets) | Every result shows the total delivered price |
| B2 | "Can I trust this seller?" | Feedback score, rating count, account age | Small seller line on each result, in plain words: "Sold 312 things, 99% happy" |
| B3 | "Can I return it if it doesn't fit?" | Return policies differ; Depop and Poshmark are mostly final sale with buyer protection for "not as described" | Result badge "Returns OK" or "Final sale" |
| B4 | "Make an offer for me" | eBay, Poshmark, Mercari and Depop all take offers | Buy result action "Offer $X"; Ask tier |
| B5 | "Tell me if the one I'm watching gets cheaper" | Mercari and Poshmark notify likers on price drops; eBay watchlist | Watch any listing, not just a search |
| B6 | "Get these from the same seller in one box" | Bundle discounts | Suggest when two matches share a seller |
| B7 | "Is it real?" | Authentication programs and replica risk | Deal check flags price-too-good and missing authentication |

## What this means for Today

Today should be the place where nothing gets lost. That means anything with a deadline or money at stake, ordered by the deadline, each card with its photo, its plain-language situation, its likeliest action and the other reasonable actions. Things that went well appear quietly: a payout landed, an item sold. M1 to M7 are the card types. The [Today rework](../../today/ben/today-rework/README.md) applies this.

## Limits

- Platform rules change often. For the demo, build the cards anyway. Check M1, M2, M3, M8 and M14 only if a real integration ships later.
- Not covered: VAT and non-US rules, business or bulk sellers (eBay Stores, Shopify sync), and consignment.
