# How do the primitives compose, seen from engineering?
Researched 2026-11-14 by Ben (Claude Code agent, pitch thread). Feature: cross-cutting.

Written as input to [product/primitives.md](../../../product/primitives.md), which the walkthrough thread owns. Nothing here changes it; take what helps. *Agent proposal* throughout.

## The test a primitive has to pass

A primitive earns its place only if (a) at least three functions in the map use it, (b) it has one owner table in the data layer, and (c) removing it would force two features to each invent their own copy. Anything that fails is a view, not a primitive.

## Seven nouns

| Primitive | What it is | Functions that use it (map #) | Lives in |
|---|---|---|---|
| **Item** | One physical thing you own: identity, measurements, condition, defects, photos, cost basis, where it is. Each field is marked *measured*, *estimated* or *yours*. | 1–5, 11, 20, 28–30, 34 | app DB, mirrored to Databricks |
| **Want** | One thing you don't own yet: a fuzzy description, hard limits (size, measurements, max price) and how long to keep looking. The mirror of an Item: same fields, no photos of your own. | 25–28 | app DB |
| **Comp** | One market observation: a listing or a sale seen on any platform, with price, condition, platform, date and whether it sold. Never owned by the user. | 5, 6, 8, 9, 15, 23, 25–29 | Databricks (Delta table, append only) |
| **Valuation** | A function, not a stored opinion: Item or Want + Comps → a price range per platform, the time to sell at each price, and what you keep after fees. | 5, 6, 9, 10, 15, 27, 29 | Databricks model, served |
| **Listing** | An Item rendered for one platform: external id, price, status (Live, Stale, Failed, Sold). | 6–12, 19 | app DB |
| **Conversation** | One thread with one person on one platform, tied to a Listing (you sell) or a Comp (you buy). Holds offers and pickup times. | 13–18 | app DB |
| **Proposal** | Something the agent wants to do: post, reprice, reply, counter, accept, schedule, buy, alert. Has a risk level and a state (proposed → approved or auto → done or failed). The log of done Proposals is the automation history. | 9, 10, 14–16, 19, 26, 32 | app DB |

Accounts (one per platform, with health) are configuration, not a primitive.

## Three verbs

1. **Observe.** Everything that happens anywhere becomes a row: a scraped listing or sale becomes a Comp, a buyer message joins a Conversation, a status change updates a Listing.
2. **Value.** Valuation runs whenever an Item, Want, Listing or incoming offer needs a number.
3. **Propose.** Rules and the agent turn observations and values into Proposals. A Proposal either runs on its own or waits for a tap, by its risk level.

Every feature is one of these three verbs applied to one of the seven nouns. Sell, buy and appraise stop being separate systems:

| Ben's feature | Is really |
|---|---|
| Sell | Item → Valuation → Proposal(post) → Listings → Conversations → Proposal(delist) |
| Buy | Want → observe Comps → Valuation(is this a deal?) → Proposal(alert, message, buy) |
| Appraise | Valuation called directly on an Item that has no Listing yet, or on a Comp you are looking at |
| Watch / track | A Want that stays open: every new Comp is checked against it |
| Today | The Proposals that are waiting on you, newest risk first |
| Insights | Queries over Comps, Listings and done Proposals |

## Appraise lives where the actions are

Ben: appraise "should be ... somehow integrated into both. somewhere where the actions are". Because appraise is the Valuation verb, it can show up as a number wherever a decision is made, instead of as its own tab:

- **Adding an item.** The camera's first result is the appraisal (what it is, what it's worth on each site, what you keep). The next button is the choice: *Sell it*, *Keep it* (track its value) or, at a garage sale, *Buy it* (the most to pay).
- **The draft.** The price field is the appraisal, with the range behind it.
- **An offer.** "Would you take $30?" shows beside the range for that Item.
- **A search result or watched listing.** Every result carries a deal badge from the same Valuation.
- **Share sheet.** A link from any app returns the same card: what it is, a fair price, deal or not.

One engine, five places it surfaces, no tab of its own. *Agent proposal*. The walkthrough step on the bottom bar decides where the camera sits.

## Today versus the full places

Ben: "a today / inbox could be relatively integrated but also have more manual things. like i might want to look at all messages but id need to specifically select going there."

The primitive split makes this a filter, not a second system:

- **Today** is a push view: only Proposals in state *waiting on you*, plus Failed Listings. Each card has one action. It empties as you work.
- **Messages, Selling, Buying** are pull views: every Conversation, Listing or Want, whatever its state. You go there on purpose.

The same Conversation can show as a card in Today ("Offer $30 on the lamp: counter at $38?") and as a thread under Messages. Answering in either place resolves both, because both read the same row.

Pattern references (*asserted*, from product knowledge, not re-checked this session): Gmail's Priority inbox versus All Mail, Linear's Triage versus project views, Monarch's transaction review queue versus the full ledger. What we take: the push view must be allowed to empty, and nothing lives only in it.

## Tracking things you want

A Want is a standing query. Two kinds, both from Ben:

1. **Wait for it to exist.** "Tell me when someone lists a Yelich jersey in M under $40." Each new Comp is matched against open Wants. A match makes a Proposal: *alert*, and if allowed, *message the seller*.
2. **Wait for it to get cheaper or for the right moment.** Watch one existing listing for a price drop, or track an Item you own until its value crosses a number you set ("sell my GPU when it's worth $400").

Engineering constraint (*observed* in [exa-alerts.md](../../watch/ben/exa-alerts.md)): Exa monitors refresh at most hourly and price thresholds are our own code, so "the second it's listed" is not reachable on every site. eBay's Browse API can be polled faster. The demo should promise "within the hour", not "instantly".

## Risk levels for Proposals (feeds walkthrough step 9)

| Level | Runs | Examples |
|---|---|---|
| Auto | On its own, logged, undoable | "Yes, still available"; size and measurement answers; delist after a sale; markdown above your floor |
| Ask | Waits in Today | Price below your floor; counter-offers; first post of an item; messaging a seller about a Want |
| Never alone | Always your tap, no setting to change it | Giving out an address; agreeing a pickup time; paying for anything; accepting off-platform payment |

## What the data layer needs (feeds walkthrough step 10)

- **Databricks owns Comps and Valuation.** Comps is the one table that grows without the user doing anything, and it's the only place the price model learns. Every sold Listing writes a Comp back with its true time-to-sell. That loop (a sale teaches the price model) is the Databricks story.
- **The app DB owns Items, Wants, Listings, Conversations and Proposals.** These change at human speed and need row-level edits.
- **One join key:** an identity id (brand, model, size, variant) shared by Items, Wants and Comps. Without it, Valuation and Want matching each invent their own matching. *Inferred*.

## What would show this is wrong

- If Valuation can't produce a usable range for most items (sparse comps for no-name goods), appraise can't be the first screen of Add, and the camera should open on the draft instead.
- If Today fills faster than people empty it, the risk levels are wrong, not the split.
