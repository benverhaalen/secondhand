# What does on-the-spot appraisal at a garage sale need, beyond a price from a photo?
Researched 2026-11-14 by Ben (Claude Code agent, project thread "Research market-value pricing and appraisal"). Feature: appraise.

Ben: "we also came up with a new use case. can say go to a garage sale and with our tool 'appraise' a product. think of all the context and nuance that is truly needed in this" ([words](../../../product/words.md#2026-11-14-pavlo-and-appraise)).

Everything in this note is **inferred** design unless a line cites a source. The value model it builds on is in [what-market-value-is.md](../../price/ben/what-market-value-is.md); competing apps are in [existing-tools.md](existing-tools.md).

## The question is different from selling

A seller asks "what should I list this at?". A buyer at a garage sale asks **"should I buy this at the asking price, and what is the most I should pay?"** That needs:

```
max_pay = P(identity right) × P(condition as judged) × expected_net(best channel, realistic time)
          − time and hassle cost − risk margin − target profit
```

- **expected_net** comes from the same valuation engine as [price](../../../features/price/), on the channel where this item nets the most.
- **P(identity right)** and **P(condition as judged)** are where garage-sale appraisal fails. A photo in a driveway cannot tell a reproduction from an original or show that a lamp works.
- **Time and hassle** are real: a $15 profit on a couch that needs a truck and a week on Facebook Marketplace is not a buy for most people.
- **Target profit** is personal: a casual buyer who wants the thing for themselves needs "is this a fair price?" not a flip margin. Ask once at setup, not per item.

FlipTip already shows "The most to pay", profit after fees, sell speed, and "Worth it" / "Skip" (observed, fliptip.ai). So the verdict alone is not a differentiator.

## The context and nuance it actually needs

### 1. Speed tiers, because the seller is standing there

| Tier | Target | What it does |
|---|---|---|
| Glance | under 2 s | Recognise the category and coarse identity on device or from cache; show a category price band ("vintage tees usually $8–25") and whether it is worth a closer look |
| Check | 5–10 s | Resolve identity, pull comps from the index, give a range per channel and max pay |
| Deep | background, minutes | Long-tail research (maker's mark, artist, pattern name), Exa and agent browsing; notifies when done, even after the user has left |

Competitors report 10–20 s (FlipperScanner, multi-item) and 30–70 s (FlipTip) (asserted, vendor pages). 30–70 s is too slow to hold a conversation with a seller; tiering lets the user move on and get the deep answer later.

### 2. Ask for the physical check that changes the price

The user is holding the item. The app should ask for the one action with the highest value of information, as a single button prompt:

- "Flip the label: does it say Made in USA?" (era and origin driver)
- "Look at the runout etching near the label: what's written there?" (record pressing)
- "Plug it in: does it turn on?" (function)
- "Count the pieces: are all 4 controllers there?" (completeness)
- "Check the base for a maker's mark: photograph it" (attribution)
- "Smell it" (smoke and mildew kill clothing and furniture value; photos can't show it)

Each question comes from the value-driver lexicon in [what-market-value-is.md](../../price/ben/what-market-value-is.md) and is chosen because its answer moves the range the most. Stop asking once the range is tight enough to decide.

### 3. Authenticity risk is part of the value

For branded goods (bags, sneakers, watches, designer clothing), a fake is worth near zero and some platforms will refuse it. The appraisal needs an authenticity confidence, the cues it checked, and the instruction "don't pay more than X unless you can verify Y". FlipTip includes fake flags (observed). This is also where Ben's Pangram idea for AI-generated photos fits on the buying side.

### 4. Batch mode for a whole table

Garage and estate sales are tables of mixed items. Point the camera at the table, get every item boxed with a glance-tier band, tap the interesting ones. FlipTip's "Sale X-Ray" and FlipperScanner's "Scan Everything" already do versions of this (observed). The difference worth building: rank the table by **expected profit per minute of effort**, not by value.

### 5. Poor signal

Garages and estate sales are often in basements or rural areas. Cache category priors and the value-driver lexicon on device so the glance tier and the questions work offline; queue check-tier lookups.

### 6. Negotiation help, kept honest

Garage-sale prices are informal and negotiable. Show "Asking $20 · Fair to offer $12 · Walk away above $28". Do not script deception; the seller is a neighbour, not a counterparty on an exchange.

### 7. Bulky and local items

For furniture and large items, only local channels and local comps matter, and transport cost dominates. Use local asking prices with the "asking, not sold" label (Facebook's own suggested price uses listed prices, observed in [direct-references.md](../../cross-cutting/ben/direct-references.md)).

### 8. Legal and category limits

Some items cannot be resold on major platforms or need care: recalled products, car seats and cribs (recall and safety rules), cosmetics, weapons, ivory and some animal products. Flag "can't easily resell" before the user pays. (Asserted from memory; check each platform's prohibited-items policy before shipping this.)

## The loop competitors don't close

The strongest difference is what happens after "buy":

1. The appraisal already holds identity, the drivers that were checked, defect photos and comps.
2. Tapping "Bought it for $12" turns it into an [item-card](../../../features/item-card/) with the purchase cost.
3. At home, [capture](../../../features/capture/) fills the remaining shots and the [price](../../../features/price/) feature routes it to the best channel.
4. When it sells, the actual sale price and days are logged against the appraisal. That labelled outcome trains the engine and tells the user how good their buys are ("your garage-sale buys returned 3.1x on average").

None of the appraisal apps found (FlipTip, Underpriced, FlipperScanner, Flipper Vintage) were described as listing the item for you afterwards (observed: none of their pages say so; a narrow search does not prove none does).

## Open questions for Ben

- Is the garage-sale user a reseller (wants margin) or a casual buyer (wants "is this fair")? Both, with a setting, is the default proposal.
- Should "Deep" research be allowed to cost money per item (agent browsing, Exa calls)? If so, cap it per day.
