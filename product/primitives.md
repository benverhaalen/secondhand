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
