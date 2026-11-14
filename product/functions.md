# Function map

Everything a user does in secondhand, from the user's side, audited for gaps. Every UI, UX and product option in the [walkthrough](walkthrough.md) is derived from this map. Ben asked for it at 19:08 ([words](words.md#2026-11-14-function-map)).

Marks: **Ben** means he named it. **Gap** means the audit added it, as an *agent proposal*. Ben's named functions are kept as he stated them.

## 1. The one picture underneath: an item's life

Every screen shows an item somewhere on this line. Each state has one label, one color and one next action, so the user always knows what is happening and what is theirs to do.

```
Photos in ─▶ Researching ─▶ Draft ─▶ Live ─▶ Offer / Hold ─▶ Sold ─▶ Handed over ─▶ Done
 (shoot or     (identify,     (needs   (per     (needs you)     (paid)  (shipped or     (paid out,
  folder)       measure,       you)     site)                            picked up)      reviewed)
                studio,
                price)
                                         │
                                         ├─▶ Stale ─▶ Markdown (auto, down to your floor) ─▶ Live
                                         └─▶ Unsold after N weeks ─▶ Bundle / Donate / Keep
 Anywhere: ✕ Failed (a post or delist didn't go through; red, with one fix)
```

- **Ben:** the drafting area, and the researching state.
- **Gap:** Stale, Markdown, Unsold, Failed, and Handed over versus Done. Without these, items sit forever and failures stay invisible. Vendoo users report missed delists that led to Poshmark bans ([direct-references](../research/cross-cutting/ben/direct-references.md)).

## 2. Functions by the user's question

| # | The user's question | Function | Source | What it needs underneath |
|---|---|---|---|---|
| **Getting items in** |||||
| 1 | "Sell this thing" | Shoot one item with the guided shot list. Every shot serves both the listing and the image model. | Ben | capture, measure |
| 2 | "Sell all of this" | Drop a whole folder or camera-roll selection. It is split into items by grouping photos, and you confirm the groups. | Ben | photo clustering; a "these 4 photos are one item?" confirm |
| 3 | "What is it?" | Researching state: identify, measure, comps and studio photos run in the background, with live progress on the draft | Ben | identify, price, studio |
| 4 | "Is it right?" | The drafting area: one live draft per item. Fix in place. Each field is marked measured, estimated or yours. | Ben | item card |
| 5 | "Is it worth selling?" | Before you list: what you'd keep after fees, how fast items like it sell, or "not worth it, donate?" | Gap | price, appraise |
| **Selling** |||||
| 6 | "Where and for how much?" | Price and sites. Pick "Sell this week" or "Get the most", see what you keep on each site, then post | Ben (per site) | price, connect |
| 7 | "Is it up?" | Active listings. One row per item, with a site badge per platform and its status | Ben | list |
| 8 | "Is anyone interested?" | Interest per item, per site: views, likes or watchers, offers and messages, compared with similar items | Ben | list stats per site (not every site exposes them, so fall back to messages and offers) |
| 9 | "Why isn't it selling?" | Diagnosis plus a one-tap fix: lower the price, retake photos, add a site | Gap | price |
| 10 | "Lower it for me" | Automatic markdown: drop by a set amount each week down to your floor | Gap (eBay pattern) | automation |
| 11 | "Can I sell several together?" | Bundles, and items with more than one unit | Gap | item card |
| 12 | "I changed my mind" | Pause, edit everywhere at once, or end the listing everywhere | Gap | list |
| **Talking to buyers** |||||
| 13 | "Who's asking what?" | Messages: one inbox across sites, grouped by item | Ben | messages |
| 14 | "Answer the easy ones" | Automation: availability and specs answered for you, labelled, and undoable | Ben | messages, automation |
| 15 | "Someone made an offer" | Accept, counter or decline, with the comps beside it | Gap | price |
| 16 | "Someone wants to pick it up" | Pickup scheduling. Either approve time windows the agent can offer, or add the event to Google Calendar. Address and time always need your tap | Ben | calendar, messages |
| 17 | "Is this a scam?" | Warnings for known scam patterns (fake payment screenshots, overpayment, moving the chat off the platform) | Gap | messages |
| 18 | "They didn't show" | Mark a no-show, re-offer to the next buyer in line, and keep the dibs queue | Gap | sold |
| **Selling it** |||||
| 19 | "It sold" | Delist everywhere. Paid beats dibs, and failed delists show in red | Ben (from the canvas) | sold |
| 20 | "How do I ship it?" | Shipping: label, box size from the measured size, the weight to enter, and a drop-off point | Ben | measure → shipping, list |
| 21 | "Did they get it?" | Tracking, a return or dispute, and leaving a review | Gap | sold |
| **Money and history** |||||
| 22 | "How am I doing?" | Total earned, number sold, potential earnings (the live value of your active items), active and past listings | Ben | data |
| 23 | "What actually sells?" | Insights: average time to sell, what things sold for compared with what they were listed at, and how each site differs | Ben | data (the Databricks story) |
| 24 | "What do I owe?" | Fees paid, and what you bought each item for, for anyone who flips. A tax-form note when sales cross the reporting threshold | Gap | data |
| **Buying** |||||
| 25 | "Find me this" | One search box across every secondhand market, fuzzy wants and tap questions | Ben | watch |
| 26 | "Tell me when" | Watch: an alert when an item is available, or under a price (Exa) | Ben | watch |
| 27 | "Is this a good deal?" | Deal check from the share sheet or a link | Ben (from the canvas) | price |
| 28 | "Will it fit me?" | Matches by measurements, not the tag size | Ben | measure |
| 29 | "Should I buy this at the garage sale?" | Appraise: the most to pay, and the value on each site after defects | Ben | appraise |
| 30 | "I bought it, now flip it" | A bought item becomes a draft with the purchase price filled in | Gap | item card |
| **Accounts and control** |||||
| 31 | "Hook up my accounts" | Connect each site, or skip | Ben | connect |
| 32 | "What is it doing on its own?" | Automation settings: one page listing every automatic action, with an on/off switch and a log of what it did | Ben (automation) | today |
| 33 | "Is my account safe?" | Account health for each site: posting method, ban risk and failed actions | Gap | connect |
| 34 | "Where is the thing?" | Where each item physically is (a closet or a storage box), so you can find it when it sells | Gap | item card |
| 35 | "Tell me only what matters" | Notification settings, set per kind of event | Gap | today |

## 3. Audit: what goes wrong for the user if a function is missing

| Missing | What breaks | Severity |
|---|---|---|
| Failed state (#19) | A sold item stays live elsewhere, gets bought twice, and the account is penalised | High |
| Stale and markdown (#9, #10) | Items sit forever and the "potential earnings" total turns into fiction | High |
| Folder grouping confirm (#2) | Photos of two items merge into one listing | High |
| Pickup approval (#16) | The agent agrees to a time or gives out an address without you, as happened with Meta's assistant (Sept 2026) | High |
| Offer handling (#15) | The most common buyer message, "would you take $X?", has nowhere to go | High |
| Measure → shipping (#20) | Box size and weight are guessed, so a label can come out wrong | Medium |
| Account health (#33) | Bans under automated posting come as a surprise | Medium |
| Scam warnings (#17) | Exactly what new sellers fall for on Marketplace | Medium |
| Where is it (#34) | Matters at volume, such as a folder of 40 items | Low |
| Tax note (#24) | A surprise at year end | Low |

## 4. What the scaffold has to hold

Grouping the 35 functions by how often the user reaches for them gives five homes. Each home becomes a bottom-bar tab or the center button:

| Home | Functions | How often |
|---|---|---|
| **Add** (center button) | 1, 2: shoot or drop a folder | Every time you sell |
| **Selling** (drafts, live, past) | 3–12, 19–21 | Daily while anything is listed |
| **Inbox** (messages, offers, pickups, approvals) | 13–18 | Many times a day |
| **Buying** (search, wants, watch, deal check, appraise) | 25–30 | When you're shopping or out at a sale |
| **You** (money, insights, accounts, automation, settings) | 22–24, 31–35 | Weekly |

The bottom-bar options in [walkthrough.md](walkthrough.md) step 3 are arrangements of these five homes.
