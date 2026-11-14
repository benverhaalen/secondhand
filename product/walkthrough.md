# Decision walkthrough

Ben asked to work through the whole app one decision at a time, starting wide and narrowing ([words](words.md#2026-11-14-decision-walkthrough)). Each step lists distinct options, the agent's view, the tradeoffs and the research behind it. Ben picks on a card in the project thread, and the pick is logged in [decisions.md](decisions.md). Everything below a pick is *agent proposal* until it is picked.

| # | Decision | Status |
|---|---|---|
| 1 | What the app is at its core | **decided: seller's crosslister** ([log](decisions.md)) |
| 2 | Selling: how the selling features chain | **decided: item by item, one live draft each, folder drop splits into drafts** ([log](decisions.md)) |
| 3 | The always-there bottom bar | **decided: Today · Sell · ＋ · Buy · You, ＋ is the only way in** ([log](decisions.md)) |
| 4 | Selling home | **decided: photo grid with state pills in shelves by state; numbers in You** ([log](decisions.md)) |
| 5 | Inbox: messages, offers, pickups and approvals in one place | — |
| 6 | Shipping and pickup | **decided: your windows plus a saved meetup spot** ([log](decisions.md)) |
| 7 | Buying home | **decided: shelves like Sell** ([log](decisions.md)) |
| 8 | You | **decided: numbers, by site, settings** ([log](decisions.md)) |
| 9 | Human in the loop: what runs on its own, and what always needs a tap | **decided: tiers that learn** ([log](decisions.md)) |
| 10 | **decided: all in, hybrid fallback** ([log](decisions.md)) Behind the scenes: the shared record, agents, posting and replay, Databricks (judged on how well and how creatively the platform is used, with no set criteria: [words](words.md#2026-11-14-databricks-judging)) | — |
| 11 | First launch and onboarding | **decided: setup first** ([log](decisions.md)) |

Since 19:08, every option is derived from the [function map](functions.md) ([words](words.md#2026-11-14-function-map)).

Ben, 19:03 ([words](words.md#2026-11-14-biggest-functions-first)): "ensure its like thinking about everything from the biggest functions. the goal is to hit all the features." So every step asks **how all the features work together**, never which ones to keep, and there is no single hero user. The order runs from the biggest function to the smallest.


---

## 1. What the app is at its core

**Why this is first.** Every later screen hangs off it. It decides what the home screen shows, what a new user does first, and which features feel native versus bolted on.

**Common answer, and why it is not kept.** "An AI crosslister: snap a photo, it lists everywhere." Vendoo, List Perfectly and eBay's magical listing already do this, so it is a commodity. It also gives buying and appraising no natural place. (eBay's magical listing: 10M sellers have used it, with complaints up from 0.6% to 6.1% of negative reviews once the AI step became mandatory, *asserted* — [direct-references](../research/cross-cutting/ben/direct-references.md).)

| Option | What it is | References | Strong at | Weak at |
|---|---|---|---|---|
| **A. Seller's crosslister** | Selling is the job. Appraise and buy are add-on tabs. | Vendoo, List Perfectly, eBay magical listing | Easy to explain, and the demo is obvious | It is a head-on fight with commodity tools, buying feels bolted on, and "post everywhere" is mostly blocked anyway: only eBay has an official listing API ([decisions](decisions.md)) |
| **B. Lens for secondhand** | You point the camera at anything and get its worth, then pick sell or find. | FlipTip, Underpriced, Google Lens (cut its modes from 6 to 3) | A great garage-sale demo, and one entry for every feature | The verdict loop is already a commodity ([existing-tools](../research/appraise/ben/existing-tools.md)), and there's no reason to open it when you aren't holding something |
| **C. Your stuff, measured (item ledger)** | Each scan becomes one measured item card. Sell, appraise, want and watch are actions on cards, and a want is a search over cards. | KBB/Zillow value ranges, Monarch's accounts view, the concept brief's item card | All the features become one system, the data compounds over time (and is the Databricks story), and measured fit is the edge nobody has | Empty for a new user, and it needs a strong way in |
| **D. An agent you hand jobs to** | You say "sell my dorm stuff" or "find a Yelich jersey under $40". It works in the background and brings back decisions. | Monarch's review inbox, Pixel Call Screen | The strongest human-in-the-loop story for judges, and it matches "the user does no thinking" | Trust: when it fails it fails out of sight. Forced automation is what users revolted against at eBay. Meta's assistant gave a buyer a seller's home address (Sept 2026) |

**Agent view: C as the spine.** C is the only option where every feature is the same object seen from a different side:
- appraise is a card that has no listing yet
- a listing is the card rendered for one platform
- a want is a query over cards
- a sale closes the card and teaches the price model

A and B are features of C, and D is how C behaves. Choosing C does not drop the others. Decision 3 can still make the home screen the agent's review inbox (D), with the camera (B) as the center button. Those are separate decisions.

**What would change this view.** If the demo has to land in 60 seconds with one wow moment, B is the stronger stage even with C underneath. That is decision 2.

**Picked: A** (Ben, 19:02). Selling leads; appraise and buy are add-ons. The item card can still be the record under each listing, since a crosslister needs one source to render each platform from; that is decided in step 10, not here.

---

## 2. Selling: how the features chain into one flow

**Features in play:** capture (guided shots, each serving the listing and the image model), measure, identify, studio, price, list, messages, sold.

**Common answer, and why it is not kept.** A step-by-step wizard, one screen per feature, like eBay's magical listing ("photo, then draft, then review"). It works for one item, but eBay's reviews complain that editing goes "section by section, with a new screen for each one", and fixes take about 3x longer than entering by hand (*asserted*, [direct-references](../research/cross-cutting/ben/direct-references.md)). With 8 features, a wizard means 8 screens.

| Option | How it chains | References | Strong at | Weak at |
|---|---|---|---|---|
| **A. Wizard** | One screen per feature, in order | eBay magical listing, Vendoo | Easy to build and to follow | 8 screens per item; every feature is a wait |
| **B. One live draft** | You shoot. Then one draft screen fills itself in as measure, identify, studio and price finish in the background. You fix anything in place and post. Messages and sold run on their own afterwards. | Edit in place (Dietvorst 2018); eBay's 50% fewer steps; Google Docs-style progressive fill | One screen holds every feature; nothing waits on the slowest step; mistakes are fixed where they are | The draft screen has to show which parts are still working, measured, estimated or yours |
| **C. Batch queue** | You shoot many items in one go. The agent drafts all of them, and you approve them in a queue. | Vendoo bulk listing, Monarch's review inbox | Volume: a whole room in one session | A slower first result; a weaker one-item demo |
| **D. Hand-off** | You shoot and walk away. It lists, and only interrupts to confirm price and condition. | Pixel Call Screen | Least effort | People rubber-stamp AI output (Parasuraman and Manzey 2010; Bansal 2021); this is the eBay backlash case |

**Agent view: B, with C as the same draft repeated.** One item is one live draft; a batch is a queue of those same drafts, so the single item and the whole room use one screen and one habit. D's hand-off becomes a setting inside it (decision 6), not the default.

**Picked:** item by item, in a drafting area with a researching state. A dropped folder becomes one draft per item (Ben, 19:08).

---

## 3. The always-there bottom bar

**Derived from** [functions.md §4](functions.md#4-what-the-scaffold-has-to-hold): five homes, which are Add, Selling, Inbox, Buying and You.

**Familiar pattern.** Depop, Vinted and Mercari each put five tabs along the bottom, with Sell in the center slot and Inbox and Profile on the right. eBay puts Selling and Inbox in its bar. (*asserted*, from memory of the apps; not re-checked this session.)

| Option | Bar, left to right | Strong at | Weak at |
|---|---|---|---|
| **A. The resale-app bar as is** | Home · Search · **＋** · Inbox · Profile | Zero learning, since it matches Depop and Vinted slot for slot | "Home" and "Profile" don't say what's in them: drafts and money end up hidden |
| **B. The same slots, named for what's in them** | Selling · Buying · **＋** · Inbox · You | Same positions as A, so it is still familiar, and each name says what's inside. All five homes are covered | Has no single "what needs me" screen; that lives as a badge on Inbox |
| **C. Today first** | Today · Selling · **＋** · Inbox · You, with Buying inside Today and search | One summary screen of decisions; strongest human-in-the-loop focus | Buying, one of Ben's main functions, has no tab |
| **D. Four tabs, inbox up top** | Selling · **＋** · Buying · You, with Inbox as an icon at the top right (Instagram's pattern) | A calmer bar | Messages are the most-used function, and they end up hidden |

**Agent view: B.** The slots sit where Depop and Vinted have taught people to look, and the names remove the guessing. The decisions that need you show as a count on Inbox, and at the top of Selling.

### 3, revised after Ben's 19:15 note

Ben's constraints: Sell and Buy are the core. Appraise sits inside both. Today and the inbox are "relatively integrated", but "all messages" is somewhere you go on purpose. Watching for items is key.

Evidence: Airbnb's host bar is "Today / Inbox / Calendar / Insights / Menu", so a decisions home and a full inbox already sit side by side in a familiar app. Depop gives Selling its own tab. Vinted hides listings in Profile and lets offers clutter the inbox, and a critic flagged both. ([structure-references](../research/today/ben/structure-references.md)). Codex image ideation of options 1, 2 and 4 is in `research/today/ben/nav-ideation/` once it is pushed.

| Option | Bar | Messages | Strong at | Weak at |
|---|---|---|---|---|
| **1. Today first, two segments** | Today · Sell · ＋ · Buy · You | A segment at the top of Today: "Needs you" / "All messages" | Lands on decisions; all messages is one deliberate tap; familiar home on the left | Messages have no tab of their own |
| **2. Sell first** | Sell · Buy · ＋ · Today · You | Same segments inside Today | Sell and Buy lead, as Ben listed them | Lands on a list, not on what needs you |
| **3. Airbnb split** | Today · Sell · ＋ · Buy · Messages, with You behind the avatar | Its own tab | Closest to Airbnb; messages are always one tap away | You, money and settings are hidden behind the avatar |
| **4. Mode switch** | A Selling/Buying toggle; bar is Today · Items · ＋ · Messages · You | Its own tab | Each mode is focused | A concept you have to learn; mixed tasks need switching |

In every option, the ＋ camera ends in "Sell this / What's it worth / Find this". Every item and every match also shows its value, so appraising is everywhere. Watching lives in Buy, and new matches arrive in Today as Decisions.

**Agent view: 1.** It is the most familiar and it matches Ben's "integrated, but all messages on purpose" exactly. Keep option 4's "Researching…" progress state and site chips in the Sell tab.

### 3, second pass: what does ＋ do that Sell and Buy don't?

Ben, 19:23: "what would the + button do that sell and buy wouldnt."

**Plainly: if Sell and Buy each have their own add button, ＋ is redundant.** It earns its slot only under a rule: **tabs are places, and ＋ is the one way a physical thing gets in.**

**Evidence**
- Apple's HIG: "Use a tab bar to support navigation, not to provide actions" (observed, developer.apple.com tab bars, changelog Jun 2026). The page gives no guidance on a center create button.
- Instagram took ＋ out of the bottom bar in its 2025 redesign and put it top-left. The new bar is Home, Reels, DMs, Search, Profile. The stated reason is that growth comes from DMs, Reels and recommendations, not posting (observed on a vendor blog, inro.social, Jan 2026; not checked against Instagram itself). *Inferred:* a center ＋ is worth it only when creating is the main job.
- In secondhand, creating is the main job. ThredUp 2026 says "Supply is the New Constraint" ([problem-and-pitch](../research/cross-cutting/ben/problem-and-pitch.md)). Vinted keeps a center "Sell" ＋ (observed, Vinted critique, Sep 2026).
- Google Lens collapsed its modes so there is one camera, and you choose what to do after the photo ([direct-references](../research/cross-cutting/ben/direct-references.md)). Appraising has no tab, so it needs a front door that doesn't force you to pick buying or selling first.

**Scenarios**

| Scenario | Option 1: ＋ is the only way in | Option 2: no ＋, adding inside each tab |
|---|---|---|
| A shirt in your closet to sell | ＋, guided shots, **Sell this**, and a draft appears in Sell with "Researching…" | Sell, then **Add item**, guided shots, and a draft. One extra tap, but you're already in the right place |
| A whole folder of photos | ＋, then **Drop photos**; the folder splits into drafts in Sell | Sell, then **Add**, then **From photos** |
| You want a Yelich jersey | Buy, type it in the search box, then **Watch**. Typing is search, not creation, so it stays in Buy | Same |
| A friend's jacket you want too | ＋, photo, **Find this**: matches plus a watch | Buy, then the camera icon in search |
| A garage sale lamp at $15 | ＋, photo, **What's it worth**: value per site and "the most to pay". Buy it, then the same card becomes **Sell this** at home | You first pick Buy (then the camera, then value) or Sell. Fine when you know which, awkward when you're deciding whether to flip it |
| A $32 offer comes in | A card in Today: Accept, Counter or Decline | Same |

**Option 3 (the Airbnb split)** is option 1 with Messages as its own tab, and You behind the avatar.

**Agent view: option 1, with the rule enforced.** Sell and Buy have no add buttons; they are lists you look at and act on. ＋ is the single verb, so nothing is duplicated, and the garage-sale case works. It's also the fastest path, which matches "the second hand of the clock". Option 2 is the cleanest choice by Apple's rules, and is the right answer if appraising mostly happens on things you already own or already want.

**Picked: option 1** (Ben, 19:27).

---

## 9 (asked next). Human in the loop: what runs on its own, and what always needs a tap

**Why next:** this decides what lands in Today, the tab the app opens on.

**Evidence**
- People rubber-stamp automated output (Parasuraman and Manzey 2010; Bansal 2021) ([psychology](../research/cross-cutting/ben/psychology.md)).
- Meta's Muse, set to "Allow Always", accepted a lowball offer and sent a stranger to a seller's home address (Proton, 30 Sep 2026).
- eBay's User Agreement, from 20 Feb 2026, bans "any end-to-end flow that attempts to place orders without human review".
- Poshmark suspends listing for 6 days after repeated delisting or mass removals, "manual or automation" (May 2025). Even delist-on-sale needs pacing there.
- 31% of US shoppers would let AI spend $0 on its own; the median limit is $50.

All of these are collected in the pitch thread's [pitch-evidence](../research/cross-cutting/ben/pitch-evidence.md) and [primitives-engineering](../research/cross-cutting/ben/primitives-engineering.md).

| Option | How it works | Reference | Strong at | Weak at |
|---|---|---|---|---|
| **A. Three fixed tiers** | **Auto:** logged and undoable ("still available", size answers, delist after a sale, markdown above your floor). **Ask:** waits in Today (counter-offers, price below your floor, first post). **Never alone:** address, pickup time, payment, off-platform deals. | Pixel Call Screen, Monarch review | Predictable; easy to explain to judges | Fixed, so it can't learn that you always accept offers over 90% |
| **B. Tiers that learn** | Same as A, but an Ask card can offer "Always do this" once you've approved the same kind 3 times. Never alone can never be promoted. | iOS "Allow once / Always", Gmail filters; Muse is the counterexample, so Never alone stays locked | Today gets shorter over time; trust is earned | Approving 3 times can itself be rubber-stamping |
| **C. Autopilot with a digest** | It does everything except Never alone, with a 1-hour undo and an evening summary | Robo-advisors | Fewest taps | Conflicts with eBay's human-review rule; rubber-stamp risk; Muse |
| **D. Draft only** | It drafts every reply and action, and you send each one | Gmail Smart Reply | Full control | Most taps; the "second hand" does little |

**Agent view: B.** It starts as A, so the demo is predictable. Today shrinks as the user teaches it. The Never alone tier answers Muse and eBay's rule directly.

**Picked: B, tiers that learn** (Ben, 19:29).

---

## 6. Pickup and shipping

**Shipping is mostly an established pattern.** eBay, Depop, Poshmark and Mercari issue their own labels (*asserted*, from the platforms' seller flows; not re-checked here). Our job is to:
- pick the box size and weight from the measured item
- show which platform's label to use
- put a "ship by" card in Today
- show the nearest drop-off point

That needs no choice from Ben.

**Pickup is the decision.** It is the local half (Marketplace, OfferUp), and it is where Muse sent a stranger to a seller's home. Address and pickup time are already Never alone ([decisions](decisions.md)).

| Option | How it works | Reference | Strong at | Weak at |
|---|---|---|---|---|
| **A. Your windows** | You set windows once (for example, weekdays 5–7 pm). The agent offers only those times to buyers. A buyer's pick becomes a Today card, and Confirm adds a Google Calendar event. | Calendly booking windows (UNOPENED); Airbnb's Calendar tab | Few taps; buyers get answers fast | You have to set windows first |
| **B. Every time asks** | The agent collects what the buyer proposes, and you approve or suggest another time each time | Today's canvas pickup card | Nothing to set up | Slow back-and-forth; buyers go cold |
| **C. Windows plus a saved meetup spot** | A, plus a default public meetup spot you save (a campus union, or a police station's safe-exchange zone). Your home address goes out only on a separate Never alone tap. | Police safe-exchange zones (*asserted*, common in US cities) | Safest default; the address is never the first thing sent | One more thing to set at first use |

**Agent view: C.** It keeps A's speed, and it makes a public spot the default, which removes the Muse failure from the normal path.

**Picked: C** (Ben, 19:30).

---

## 4. The Sell tab: how your items are organized

**Holds** ([functions.md](functions.md)): drafts and researching items, live items with interest per site, sold items to ship, past listings, stale items, and the totals Ben named (earned, count, potential earnings). Today already surfaces what needs you, so Sell is where you look things up and manage them.

| Option | Layout | Reference | Strong at | Weak at |
|---|---|---|---|---|
| **A. State segments** | A totals strip ("Earned $126 · Could earn $340 · 7 live"), then the segments Drafts · Live · Sold. Each live row shows site chips with interest per site and "12 days listed, similar items sell in 9". | eBay's Selling and Depop's Selling hub list state groups (*asserted* for eBay; Depop *observed*: sold "to ship" count, likes per item) | Matches the resale apps people know; each state has a home | Three places to look |
| **B. One list, sorted by what's next** | One list: researching first, then drafts, then live sorted by how stale they are, then sold. Filter chips sit on top. | Linear-style triage lists | Nothing hidden behind a segment | A long list once you have 40 items; less familiar |
| **C. Photo grid (closet)** | Your items as a photo grid, each with a state badge. Tapping a tile opens the item. | Poshmark closet, Depop shop grid | Visual and fast to recognize | Interest and status numbers don't fit on a tile |

**Agent view: A, with C's grid as a view toggle inside Live.** It's the familiar resale layout. The totals strip answers Ben's earned, count and potential at a glance, and the per-site chips answer "how does it differ by site". The deeper insights (average time to sell, what things sold for, comparisons by site) live in You > Insights.

**Picked:** none of A–C as written. Ben (19:33) chose a photo grid with state pills and moved the numbers to You.

### 4b. How the grid is grouped

Screens: [A](../research/today/ben/sell-grid/SellGridA.png), [B](../research/today/ben/sell-grid/SellGridB.png), [C](../research/today/ben/sell-grid/SellGridC.png).

| Option | Layout | Reference | Strong at | Weak at |
|---|---|---|---|---|
| **A. One grid, filter pills** | All your items in one grid, newest activity first, with All · Needs you · Live · Sold pills on top | Apple Photos, Poshmark closet | Simplest; every item visible; pills do the sorting | Sold items mix in with live ones unless you filter |
| **B. Shelves by state** | Rows for In progress, Live and Sold, each scrolling sideways | Netflix shelves, App Store | Sorted at a glance, and each shelf shows a count | Sideways scroll hides items past the third |
| **C. Grouped by kind** | Sections for Clothes, Room and Tech, with state pills on each tile | Closet and inventory apps | Matches how you think about your stuff | State is scattered across sections |

**Agent view: B.** It reads "sorted into items" as sorted by where each item is in its life. The pills say what to do, and the shelves say where you are. A's filter pills can also sit inside B as a "see all" view.

**Picked: B, shelves by state** (Ben, 19:35).

---

## 7. The Buy tab

**Holds** ([functions.md](functions.md) #25 to #30): one search box across every market, fuzzy wants, watching with alerts (when something is available, or under a price), matches, the deal check, and things you bought, which can become "Sell this". Exa refreshes at most hourly, so alerts promise "within the hour" ([exa-alerts](../research/watch/ben/exa-alerts.md)).

Screens: [A](../research/watch/ben/buy-tab/BuySearch.png), [B](../research/watch/ben/buy-tab/BuyShelves.png), [C](../research/watch/ben/buy-tab/BuyFeed.png).

| Option | Layout | Reference | Strong at | Weak at |
|---|---|---|---|---|
| **A. Search first, wants as a list** | A big search box with recent searches, then a list of the wants you're watching, each with a "2 new" chip | Amazon or eBay search, Google Flights tracked prices | Fastest to type a new search | Text-heavy; matches are hidden one tap down |
| **B. Shelves, mirroring Sell** | Search box, then shelves for New matches, Watching and Bought, with photo tiles and pills ("Fits · $34", "Under $100", "2 new", "Waiting") | The decided Sell tab | The same habit as Sell, so nothing new to learn; matches show without a tap | Three shelves to scan |
| **C. One feed of matches** | Search box, a chip per want, then a 2-column feed of every match | Pinterest, Depop's explore | Best for browsing | Wants become filters, and watching is less visible |

**Agent view: B.** The same visual language as Sell means nothing new to learn. New matches lead because they are what you came for. "Bought" closes the loop back to selling.

**Picked: B, shelves like Sell** (Ben, 19:38).

---

## 8. The You tab

**Holds:** the numbers Ben moved out of Sell (earned, could earn, count) and the insights (average time to sell, sale price compared with asking price, by site). It also holds Accounts with each site's health, Automation (the Rules and their log), Pickups (windows and meetup spot) and Notifications.

Screens (wireframes): [A](../research/today/ben/you-tab/YouNumbers.png), [B](../research/today/ben/you-tab/YouProfile.png).

| Option | Layout | Reference | Strong at | Weak at |
|---|---|---|---|---|
| **A. Numbers, then by site, then settings** | Three numbers at the top. A "By site" card shows how fast each site sells and what share of the asking price it gets. Below that, a settings list: Accounts, Automation, Pickups, Notifications. | Airbnb Insights and Menu folded into one screen | Answers "how am I doing" and "which site is better" in one look; settings are one tap away | Gets long as insights grow |
| **B. Profile first, segments** | Your name and your rating on each site, then Money · Insights · Settings segments with an earnings chart | Depop and Vinted profiles | Feels like a marketplace profile | Ratings belong to each platform, not to us; the most useful numbers sit behind segments |

**Agent view: A.** We aren't a marketplace, so we have no public profile. The By site card is the insight Ben asked for ("how it differentiates by site"), and it is also the Databricks payoff: every sale updates it.

**Picked: A** (Ben, 19:40).

---

## 10. Behind the scenes: how much runs on Databricks

**Judged on** how well and how creatively the platform is used, with no set criteria ([words](words.md#2026-11-14-databricks-judging)). The verified product names and features are in [databricks.md](../research/data/ben/databricks.md) (Lakebase, Databricks Apps, Agent Bricks, Unity Gateway, MLflow 3 tracing and evaluation, AI Search, Genie). The ownership split comes from [primitives-engineering](../research/cross-cutting/ben/primitives-engineering.md).

| Option | What runs where | Strong at | Weak at |
|---|---|---|---|
| **A. Data layer only** | The app and agents run elsewhere (for example Vercel and Supabase). Databricks holds the Delta tables for comps and sales, the price model, and Genie. | Fastest to build | Looks like "we also used Databricks"; the platform is decoration |
| **B. All in on Databricks** | Databricks Apps hosts the backend and webhooks. Agent Bricks runs the agents. Lakebase is the app database, synced to Delta. Unity Gateway calls the models. MLflow traces every step and is shown in the app as a "why?" timeline per item. **Your approvals are evaluation labels**: they recompute the thresholds for the learning tiers. Genie answers "what hasn't sold in 30 days?" | The strongest judging story: the audit trail is the product, and human-in-the-loop measurably trains the system. It ties directly to the learning-tiers decision. | Setup risk: Apps and Lakebase permissions can eat hours; Free Edition may lack Beta features |
| **C. Hybrid** | The app and its database stay off Databricks for speed. Databricks owns comps, valuation, the price model, traces, evaluation and Genie, joined by one identity id. | Less setup risk; keeps the learning loop and the transparency story | Two stacks to wire together; a weaker "used the platform well" claim |

**Agent view: B, with C as a time-boxed fallback.** The decided learning tiers need somewhere to learn, and MLflow evaluation over approvals is exactly that. The "why?" timeline turns transparency into something the judges can see. If Lakebase or Apps isn't working within the first 2 hours of setup, drop to C without changing the product.

**Picked: B, falling back to C** (Ben, 19:41).

---

## 11. First launch and onboarding

**Evidence**
- Plaid's guidance on linking accounts: set expectations before linking, ask for the minimum, and use each site's own sign-in. The canvas Onboard screen already follows it ([adjacent-references](../research/cross-cutting/ben/adjacent-references.md)).
- Apple asks apps to request permissions at the moment they're needed (*asserted*).
- Pickup windows are already asked on first use (decided).
- Only eBay has an official listing API. The other sites post by a prefill and your tap, so connecting them up front buys little.

| Option | First minute | Strong at | Weak at |
|---|---|---|---|
| **A. Value first** | Opens on the ＋ camera: "Point at something you own." You see its value on each site within seconds, with zero accounts. Each site is connected the first time you post there. | Value before any setup; nothing to fill in; the strongest demo opening | You meet the connect step later, in the middle of a task |
| **B. Setup first** | Connect your sites, set pickup windows, choose notifications, then go home (the canvas Onboard screen) | Everything is ready from the start | A form before any value; most people quit setup screens |
| **C. Guided first item** | A short walkthrough sells one of your own items end to end, connecting a site at the post step, then lands on Today | Teaches every part once | Longer; can feel like a tutorial |

**Agent view: A.** The first thing anyone does is the core loop: photo, value. Every permission (camera, sites, notifications, pickup) is asked at the moment it is needed, so there is nothing to learn up front.

**Picked: B, setup first** (Ben, 19:43).

---

## Walkthrough complete

Every step has a decision in [decisions.md](decisions.md). What comes next:
1. The brand thread sets the visual identity. Ben said the brand comes before UI mocks (19:37).
2. Restyle the wireframes on the canvas with the brand, using the ui-factory skill.
3. Build. Each feature page links to its decisions.
