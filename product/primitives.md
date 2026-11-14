# Primitives

The small set of objects that every function in [functions.md](functions.md) is built from. Each screen is a view of one or more of them, and each feature is a combination of them. *Agent proposal*, from Ben's ask at 19:15 to "break things down into the primitives that make a lot of sense" ([words](words.md#2026-11-14-pitch-and-structure)).

| Primitive | What it is | Key fields | Who creates it | Shows up as |
|---|---|---|---|---|
| **Item** | A real thing you own or want, as one record | identity, measurements, condition, flaws, photos; every field carries where it came from (*measured*, *estimated*, *you said*) | capture, a folder drop, a purchase | a draft, a closet tile |
| **Photo** | One shot with a role | role (front, back, tag, fabric, flaws, spin), raw file, relit versions | capture | the listing gallery, and input to the image model |
| **Job** | Background work with a visible state | kind (identify, measure, relight, comps, post, delist, search), state (queued, running, done, failed), progress | the system | the "researching" state; red when it fails |
| **Valuation** | What something is worth, and where | price range per site, comps with count and dates, confidence, value drivers, the most to pay | a Job, for any Item **or** any outside listing | **Appraise, everywhere**: on a draft, on a match, from the camera, on a shared link |
| **Listing** | One Item on one site | site, status, price, url, interest stats | posting | Active and past listings, site badges |
| **Conversation** | One buyer about one Listing | messages, detected intent (question, offer, pickup, possible scam) | the site's inbox | All messages |
| **Decision** | Anything that needs a human | kind, options, the suggested option, deadline, why it was raised | Jobs, Conversations, Watches | **Today**: the list of open Decisions |
| **Rule** | What may happen without asking | trigger, action, limits (for example: answer availability questions; drop the price $2 a week down to $30; offer pickup only in these windows) | you, with defaults | Automation settings and the action log |
| **Want** | Something you're looking for | text, measured fit, price ceiling, sites | Buy, or the camera's "find this" | Wants |
| **Watch** | A Want that runs on a schedule | how often it checks, the alert condition (available, or under $X) | a Want | Watching; new matches become Decisions in Today |
| **Event** | A time-bound commitment | pickup, ship-by date, meetup place, calendar link | a Conversation and a Decision | Calendar, and a Today card |
| **Account** | A connection to one site | site, how it posts (API, prefill or browser), health | Connect | You > Accounts |
| **Ledger entry** | Money moving | sale, fee, shipping, what the item cost you | Listings when they sell | You > Money: earned, potential, insights |

## What this buys

- **Appraise is not a screen. It is the Valuation primitive, shown wherever an Item or an outside listing appears.** That is how it sits inside both Sell and Buy (Ben, 19:15).
- **Today is a query: the open Decisions.** All messages is a different query: every Conversation. Today stays short. All messages is a place you choose to go (Ben, 19:15).
- **Watching is a Want plus a Watch.** "Wait until someone sells the thing I want" and "tell me when it drops under $40" are the same primitive with different alert conditions (Ben, 19:15).
- **Human in the loop is two primitives: Decision and Rule.** Anything a Rule doesn't cover becomes a Decision. Price, address and pickup time can never be covered by a Rule.
- **Databricks** holds the Valuations, Listings, Conversations and Ledger entries over time. Every sale feeds back into the price model. That is the data loop the judges see.

## One list, reconciled

*Agent proposal, for Ben to confirm.* This page has 13 primitives and the engineering note ([primitives-engineering.md](../research/cross-cutting/ben/primitives-engineering.md)) has 7. Two lists means the first schema picks one by accident. This is one list, using the engineering note's test: a primitive is used by at least three functions, has one owner table, and removing it would make two features invent their own copy.

| Here | Engineering note | One list | Why |
|---|---|---|---|
| Item | Item | **Item** | Same thing. Photos and what it cost you are fields of it |
| Photo | (a field of Item) | part of Item | No function uses a photo without its item |
| Job | (none) | **Job** | The researching state and red failures need background work with a state |
| Valuation | Valuation | **Valuation** | Computed from Comps each time; a Decision keeps the number it showed |
| (none) | Comp | **Comp** | The market observations Databricks stores. Valuation, deal badges and the by-site numbers all read it |
| Listing | Listing | **Listing** | Its states are `LISTING_STATES` in [spec/lifecycle.mjs](../spec/lifecycle.mjs) |
| Conversation | Conversation | **Conversation** | Same thing |
| Decision | Proposal | **Decision** | One thing under two names. Decision is the name the spec, Today and the tiers already use |
| Rule | (risk levels) | **Rule** | "Always do this" makes a Rule; the spec models it as a promoted kind |
| Want | Want | **Want** | Same thing |
| Watch | (a Want that stays open) | part of Want | A Watch is a Want with a schedule and an alert condition |
| Event | (inside Conversation) | **Appointment** | A pickup or a ship-by date with its own state. Renamed so it doesn't clash with log events in [spec/README.md](../spec/README.md#logging) |
| Account | configuration | configuration | One per site, with health; nothing else depends on its rows |
| Ledger entry | (derived) | derived | Earned and fees come from sold Listings; what it cost you is on the Item |

That leaves ten: Item, Job, Comp, Valuation, Listing, Conversation, Decision, Rule, Want, Appointment. One log of item events (see [spec/README.md](../spec/README.md#logging)) serves the "why?" timeline, undo and the approvals that train the tiers.
