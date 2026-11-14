# Decision walkthrough

Ben asked to work through the whole app one decision at a time, starting wide and narrowing ([words](words.md#2026-11-14-decision-walkthrough)). Each step lists distinct options, the agent's view, the tradeoffs and the research behind it. Ben picks on a card in the project thread, and the pick is logged in [decisions.md](decisions.md). Everything below a pick is *agent proposal* until it is picked.

Order runs from the biggest choice to the smallest, because each answer narrows the next.

| # | Decision | Status |
|---|---|---|
| 1 | What the app is at its core | **decided: A, seller's crosslister** ([log](decisions.md)) |
| 2 | Selling: how capture, measure, identify, studio, price, list, messages and sold chain into one flow | asking |
| 3 | Buying: how wants, watch, Exa alerts, the deal check and the search box connect to selling | — |
| 4 | Appraising: where it lives relative to selling and buying | — |
| 5 | Accounts: your secondhand account, and how each platform is linked | — |
| 6 | Human in the loop: what runs on its own, and what always needs a tap | — |
| 7 | Behind the scenes: the shared record, agents, posting and replay, Databricks | — |
| 8 | App shell: the navigation that holds all of it | — |
| 9 | First launch and onboarding | — |
| 10 | The everyday app open | — |

Ben, 19:03 ([words](words.md#2026-11-14-biggest-functions-first)): "ensure its like thinking about everything from the biggest functions. the goal is to hit all the features." So every step asks **how all the features work together**, never which ones to keep, and there is no single hero user. The order runs from the biggest function to the smallest.

---|---|---|
| 1 | What the app is at its core (its spine) | **decided: A, seller's crosslister** ([log](decisions.md)) |
| 2 | Who the hero user is, and the demo story | asking |
| 3 | What you see when you open the app on a normal day | — |
| 4 | First launch and onboarding | — |
| 5 | Accounts: your secondhand account, and how each platform is linked | — |
| 6 | Human in the loop: what runs on its own, and what always needs a tap | — |
| 7 | Selling flow shape | — |
| 8 | Buying flow shape (wants, watch, deal check) | — |
| 9 | Appraising (the garage-sale use) | — |
| 10 | Behind the scenes: the item card, agents, posting, Databricks | — |

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
