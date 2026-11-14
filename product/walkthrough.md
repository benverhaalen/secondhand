# Decision walkthrough

Ben asked to work through the whole app one decision at a time, starting wide and narrowing ([words](words.md#2026-11-14-decision-walkthrough)). Each step lists distinct options, the agent's view, the tradeoffs and the research behind it. Ben picks on a card in the project thread, and the pick is logged in [decisions.md](decisions.md). Everything below a pick is *agent proposal* until it is picked.

| # | Decision | Status |
|---|---|---|
| 1 | What the app is at its core | **decided: seller's crosslister** ([log](decisions.md)) |
| 2 | Selling: how the selling features chain | **decided: item by item, one live draft each, folder drop splits into drafts** ([log](decisions.md)) |
| 3 | The always-there bottom bar (reworked from Ben's 19:15 note, the [primitives](primitives.md) and [structure references](../research/today/ben/structure-references.md)) | asking |
| 4 | Selling home: drafts, live and past, interest per item | — |
| 5 | Inbox: messages, offers, pickups and approvals in one place | — |
| 6 | Shipping and pickup (Google Calendar, approved time windows) | — |
| 7 | Buying home: search, wants, watch, deal check, appraise | — |
| 8 | You: money, insights per site, accounts, automation | — |
| 9 | Human in the loop: what runs on its own, and what always needs a tap | — |
| 10 | Behind the scenes: the shared record, agents, posting and replay, Databricks (judged on how well and how creatively the platform is used, with no set criteria: [words](words.md#2026-11-14-databricks-judging)) | — |
| 11 | First launch and onboarding | — |

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
