# How should one item be priced across several sites at once?

Researched 2026-11-15 by Ben (Claude Code, thread "Cross-list Depop listings and price with quant"). Feature: list, price. Method: reference-driven (`decide` step 3), problems with the same structure in other fields, each given a job.

Ben, 06:51: "how does a user decide what they want with crosslisting ... should you truthfully price or should you keep the same price across platforms for what you get in return ... i think the user should be able to choose". 06:53: "you dont want to make it a quantitative thing. but also you can see the reasoning", and "the user should in plain language be able to understand the reasoning and can then see numbers if need be". [Words](../../../product/words.md#2026-11-15-cross-listing-prices-are-a-choice-the-reason-in-words-first).

**Tags.** *Observed*: read at the source this session. *Asserted*: seen in a search result or a summary, not reopened. *Inferred*: our reasoning.

## Short answer

There is no single right price across sites, because the sellers want different things and those wants conflict. So the choice is a setting the seller picks, from four named rules. Each rule is one sentence in plain words, and the numbers sit under it, shown on a tap. Every rule keeps the same floor and the same take-home per site. *Agent proposal.*

## The structure of the problem

- One item, several shops, and one sale. Whichever site's buyer comes first at an acceptable price wins, and the others delist. So the effective price is set by the listing that looks cheapest relative to its own market (*inferred*).
- Fees differ: Depop 3.3% plus 45¢, Mercari 10%, eBay about 13.6%, Poshmark 20% ([keep.ts](../../../app/src/engines/valuation/keep.ts), money D9). The same sticker price pays very different amounts (*observed*, in our fee table).
- What a buyer will pay also differs by site. The market model fits a premium per site ([market.py](../../../jobs/valuation/market.py)), but only on synthetic data so far (*observed*, in our code).

## References, each with a job

| Reference | What it does | Job here | Mark |
|---|---|---|---|
| [Nifty pricing rules](https://docs.nifty.ai/crosslisting/pricing-rules) | One primary marketplace price; every other site is "Match" or plus or minus a % or $; the default is "a fee-based default", "sized to cover the expected difference in what you take home"; a warning when an item drifts about 10% from its rule | Mechanism: primary price plus a rule per site. Evidence that same take-home is a shipped default | *observed* through a fetch |
| [Crosslist price markups](https://docs.crosslist.com/knowledge-base/listing-management/price-markups), [prices per marketplace](https://docs.crosslist.com/knowledge-base/listing-management/prices-per-marketplace) | Base price, then a fixed or % markup per marketplace, then a custom price that "overrides both"; "By default, markups are set to 0" | Mechanism: three layers (base, rule, override). Evidence that same price is the other shipped default | *observed* through a fetch |
| Hotel rate parity ([Cloudbeds](https://cloudbeds.com/articles/rate-parity), [Stanford paper](https://web.stanford.edu/~bklopack/Vertical_Contracting_and_Price_Parity_Agreements.pdf)) | Hotels sell one room on several booking sites with different commissions; parity clauses kept prices equal; hotels push the cheapest rate to their own site | Mechanism: "your shop first" is channel steering. Evidence that equal prices across channels are a choice made for trust and contracts, not for the seller's margin | *asserted*, search results |
| [Amazon price parity, Pattern 2019](https://pattern.com/blog/amazons-price-parity-s-4-seller-term-has-changed) | Amazon dropped its parity clause, but its Buy Box algorithm "compares current Amazon pricing to other marketplaces" | Warning: a site may demote a listing that is pricier than elsewhere. Not known for our five sites | *observed* through a fetch, dated 2019 |
| Hummingbot, an open-source trading agent ([strategies](https://hummingbot.org/strategies/v1-strategies/), [cross-exchange market making](https://hummingbot.org/strategies/cross-exchange-market-making)) | The user picks a named strategy (the intent), then tunes a few parameters under it (the levers); the agent runs within them | Interaction: name the intent first, levers second, and the agent acts only inside them. This is the same shape as `plan_choice` in [price.md](../../../spec/features/price.md#selling-intents) | *asserted*, search results |
| Best execution and order routing in finance | Send the order to the venue with the best result after fees | Structure: "what each site pays" is routing on take-home, not on sticker price | *inferred* |

## Why sellers would pick each rule, and where the wants conflict

| Rule | What it says | Who wants it | What it costs them |
|---|---|---|---|
| **Same take-home** (default proposal) | "You get the same money wherever it sells." | Most people: they care about what lands in their account, not the sticker ([user-wants P2](../../cross-cutting/ben/user-wants.md#twelve-principles-for-this-user)) | Buyers who compare see a higher price on high-fee sites, so those sites sell less |
| **Same price** | "Every site shows one price." | People who feel a different price is unfair or looks shady; people with followers who would notice | Less money on eBay and Poshmark |
| **What each site pays** | "Each site asks what buyers there have paid." | People who want the most money, flippers, and items whose value really differs by site | Needs real sold data per site; until then it falls back to same take-home and says so |
| **Your shop first** | "Your own shop stays the cheapest place to buy it." | People building one shop's reviews and followers, and people who want the lowest-fee sale | Slower on the other sites |

Conflicts, all *inferred*:
- **Truthful against consistent.** "What each site pays" prices each market honestly. "Same price" is honest to buyers who look around. Both are honest, about different things, so this is a preference and not a fact we can settle.
- **Most money against fastest sale.** In a race between sites, the lowest relative price usually wins. A rule that lists high on one site mostly decides where the item will *not* sell.
- **The floor never moves with the rule.** Under every rule, the lowest you'd take pays the same on each site, so no rule can sell below what you set ([decision](../../../product/decisions.md#2026-11-14-buyers-are-handled-inside-limits-you-set-then-it-learns)).

## How it is shown

- **Words first.** The rule's one sentence. Each site's line gives its reason in words ("A little above your Depop shop, so your shop stays the cheapest").
- **Numbers on a tap.** The price on each site, its fees, and what you keep.
- **Same layers as Crosslist.** A rule for all sites, then an override on one site.
- **A warning, not a change.** As in Nifty, when a site drifts far from its market ("eBay buyers usually pay more for this"), it warns and changes nothing.

Built: `SPREADS` and `planItem(..., { spread })` in [crosslist.ts](../../../app/src/engines/listing/crosslist.ts), tested. The screen is not built.

## Not found

- Whether Depop, Poshmark, Mercari, eBay or Facebook demote a listing that is cheaper elsewhere. Nothing was found for these five.
- What share of crosslisters keep Nifty's fee-based default, and what share change it.
