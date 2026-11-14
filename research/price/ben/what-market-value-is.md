# What is the market value of a used item, and what does it depend on?
Researched 2026-11-14 by Ben (Claude Code agent, project thread "Research market-value pricing and appraisal"). Feature: price.

Ben calls this "a multidimensional problem" and says "its definitely market value dependent. like ebay and depop have different values" ([words](../../../product/words.md#2026-11-14-pavlo-and-appraise)). This file breaks that space into components that can each be measured, and says which ones the system observes, asks about, or learns.

## The quantity we are estimating

Inferred. For an item *i*, a channel *c* (eBay, Depop, Facebook Marketplace and so on) and a time horizon *t*:

```
value(i, c, t) = distribution of the price a buyer on c pays within t days
net(i, c, t)   = value − platform fee − payment fee − shipping or pickup cost − hassle
```

Three consequences:

- **There is no single "market value".** The same item has a different distribution on each channel, because each channel is a different pool of buyers with different fees and search behaviour. This is Ben's "ebay and depop have different values".
- **Price and time trade off.** A lower price sells sooner. The seller's slider in the UX research ("Sell this week ~$45 · Typical ~$60 · Hold out ~$75", [direct-references.md](../../cross-cutting/ben/direct-references.md), Flow 4) is a readout of this curve.
- **Buying uses the same curve inverted.** A garage-sale appraisal asks "what is the most I should pay, given what it will net me and how long it will sit" ([garage-sale.md](../../appraise/ben/garage-sale.md)).

## The dimensions

| # | Dimension | What it covers | How we get it | Evidence |
|---|---|---|---|---|
| 1 | **Identity** | What exactly the item is: brand, line, model, style code, release, edition, pressing, year, variant | Photo + text recognition, barcode/UPC/GTIN, label OCR, then confirmation | Most comp error starts here (inferred). PriceCharting removes "For Parts", "Reproduction" listings by keyword before pricing (observed, pricecharting.com/page/methodology) |
| 2 | **Condition** | Wear, defects, completeness, function, originality | Photos, structured defect questions, category grading scales | MMR adjusts for condition grade (observed). Disclosure of defects raises prices in used-goods markets (Lewis 2011; Dimoka et al. 2012, in [psychology.md](../../cross-cutting/ben/psychology.md) §8) |
| 3 | **Hidden desirability** | Attributes that buyers pay for but a casual seller does not notice: era markers, made-in, first pressing, discontinued colourway, collaboration, size scarcity, provenance | Learned per category from sold listings, then asked about | See "Finding the things not super apparent" below |
| 4 | **Fit and measurements** | For clothing: true size from measurements, cut ("boxy"), tag vs actual | Measurement from photos | Covered by [measure](../../../features/measure/); it is a filter on comps |
| 5 | **Channel** | Which buyer pool, fee structure, shipping norm, local vs shipped | Per-platform comp distributions + fee tables | 2022 VoucherCodes check: the same 20 branded items cost £980.74 on eBay, £1084.36 on Vinted, £1177.96 on Depop (observed, theindustry.fashion, Sep 2022). One Mulberry satchel was £320 on Depop vs £151.95 on eBay |
| 6 | **Time** | Recency of comps, trend, seasonality, hype cycles | Time-decay weighting, trend index | MMR weights recent transactions more and recomputes nightly (observed, site.manheim.com MMR help) |
| 7 | **Liquidity** | How many buyers exist; sell-through; days to sell | Sold vs active counts, sold dates | MMR hides its range and falls back when a trim has fewer than 6 sales in a year or 2 in 90 days (observed) |
| 8 | **Location** | For bulky or local items, what buyers nearby pay | Local-marketplace comps, distance | Facebook Marketplace prices from "similar items listed in your area" (observed, in [direct-references.md](../../cross-cutting/ben/direct-references.md)) |
| 9 | **Trust** | Authenticity risk, seller reputation, photo quality | Authentication flags, listing quality | Product uncertainty has a stronger effect on price premiums than seller uncertainty (Dimoka et al. 2012, in [psychology.md](../../cross-cutting/ben/psychology.md)) |

Dimensions 1 to 3 describe the *item*. Dimensions 5 to 8 describe the *market* it meets. Most tools collapse all of them into one median of keyword-matched eBay sales, which is why their numbers are often wrong (eBay's "$12 for a $100 item", in [direct-references.md](../../cross-cutting/ben/direct-references.md), asserted by app reviewers).

## Finding the "things not super apparent"

Ben: "pricing something including all the defects and info and things not super apparent to why someone would want it".

**Reframe (inferred):** a hidden desirability factor is an attribute that splits one apparent identity into sub-identities that sell for different prices. "Levi's 501" is one identity to a casual seller. To a buyer, a 501 with a "Big E" tab (pre-1971), "Made in USA", and a specific size is a different item. So hidden desirability is mostly *identity at a finer grain*, plus a few true market signals (hype, scarcity).

That makes it learnable rather than hand-curated:

1. **Collect sold listings per category.** Titles and item specifics from sellers who know what they have already name the drivers ("single stitch", "deadstock", "first press", "made in Japan", "Big E", "OG box").
2. **Find the tokens and attributes that move price**, controlling for identity and condition. This is a hedonic regression over listing text, the same family as the Mercari Price Suggestion Challenge, where the winning model reached RMSLE 0.3875 from listing text and a few fields (observed, engineering.mercari.com, 2018-11-14). The output is a per-category **value-driver lexicon**: driver, how to detect it, typical premium, how often it appears.
3. **Detect each driver** from photos and label OCR where possible. Example cues for US clothing (observed, underpriced.app vintage label guide, 2026, a seller-app blog; treat as practitioner knowledge): no care label often points before July 1972; written care instructions 1972 to 1997, symbols from 1997; union label "ILGWU" without "AFL-CIO" means pre-1959; RN numbers below 13,670 were issued before 1959.
4. **When a driver cannot be seen, ask for it.** Pick the question whose answer would change the estimate most ("Flip the label: does it say Made in USA?"). This is a value-of-information choice, and it is what an expert appraiser does. It also fits the UX direction of one-tap decision cards rather than a chat (see [today](../../../features/today/)).

Categories and their typical hidden drivers (asserted from memory unless marked; each needs checking against sold data before it is used):

| Category | Hidden drivers |
|---|---|
| Vintage clothing | Era (labels, stitching, RN), made-in, union label, brand line (e.g. Patagonia older tags), size scarcity, graphic/band/event, deadstock |
| Denim | Selvedge, Big E, made-in, specific lot numbers, fade quality |
| Sneakers | Exact style code and colourway, OG box, size (very small and very large sizes trade differently), deadstock vs worn |
| Records | Pressing (matrix/runout etching), country, first press, colour vinyl, insert/obi, sleeve condition separately from disc condition |
| Video games | Loose vs complete vs sealed; graded (observed: PriceCharting prices Loose, CIB, New, Graded separately) |
| Trading cards | Exact card, parallel, grade and grader (observed: PriceCharting prices ungraded, 7, 8, 9, 9.5, PSA 10, BGS 10) |
| Kitchenware (Pyrex, Le Creuset, Dansk) | Pattern, colour, era, made-in, chips and dishwasher haze |
| Furniture | Maker marks, designer attribution (mid-century), solid wood vs veneer, original finish; local only |
| Electronics | Exact model and storage, function tested, accessories, battery health, carrier/region lock |
| Tools and audio gear | Model, made-in, function; Reverb and eBay buyers differ |

## Condition and defects as data

Inferred design, grounded in observed scales:

- **Use a category grading scale, mapped to a common 0-to-1 score.** Established scales exist: Hagerty's four car grades from #1 Concours to #4 Fair ("daily drivers, with flaws visible to the naked eye", observed, hagerty.com); PSA and TAG card grades (TAG maps a 1000-point score to 1 to 10, observed via phantomdisplay.com); record grading (Goldmine M to P, asserted from memory); eBay item conditions (new, new with tags, pre-owned, for parts, asserted from memory).
- **Store defects as a list, not a word.** Each defect: type (stain, hole, chip, crack, missing part, not working), location, size, severity, photo, disclosed yes/no. The condition score is a function of this list. This keeps the listing honest (the psychology research recommends one structured condition block) and lets the adjustment be learned from comps whose defects are known.
- **Function and completeness are separate from wear.** "Untested" is its own state with its own discount; "for parts" is a separate market.
- **Grade with uncertainty.** AI card graders disagree with human graders by about half a grade on hard cases (observed: Ximilar graded a BGS 6 card as 6.5, misjudging centering and surface). Photos at a garage sale will be worse than lab images, so carry a grade range forward into the price range.

## What the output should look like (inferred)

The numbers below are illustrative, not data.

```
identity:        candidates with probabilities, confirmed one
drivers:         [ {name: "Made in USA", present: unknown, premium: +35%, ask: "Check the inner label"} ]
condition:       score 0.7 ± 0.1, defects [...]
by channel:      eBay   p25 $38  p50 $46  p75 $55  ~9 days   net $39
                 Depop  p25 $45  p50 $58  p75 $70  ~21 days  net $50
                 FB     n/a (too few local sales)
comps:           6 sold listings, each with link, date, price, condition, and the adjustment applied
confidence:      medium: 14 effective comps, 2 drivers unresolved
```

A value is never shown without the comps behind it, and the engine says "not enough sales to price this" rather than guessing (MMR does this; SeatGeek shows a "can't calculate" state, observed in [adjacent-references.md](../../cross-cutting/ben/adjacent-references.md)).
