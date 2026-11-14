# Decision walkthrough

Ben asked to work through the whole app one decision at a time, starting wide and narrowing ([words](words.md#2026-11-14-decision-walkthrough)). Each step lists distinct options, the agent's view, the tradeoffs and the research behind it. Ben picks on a card in the project thread, and the pick is logged in [decisions.md](decisions.md). Everything below a pick is *agent proposal* until it is picked.

Order runs from the biggest choice to the smallest, because each answer narrows the next.

| # | Decision | Status |
|---|---|---|
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

## 2. Who the hero user is, and the demo story

**Why it matters.** With selling at the core, the hero is a kind of seller. It sets what onboarding asks for, how many items the app expects at once, and the one story told to the judges. MadHacks is at UW–Madison, so the judges and most of the room are students. The Databricks track's criteria are not in the repo; a quick search did not find them (*not checked against a primary source*).

| Option | Who | Demo story | Strong at | Weak at |
|---|---|---|---|---|
| **A. Student moving out** | A student with a room of stuff and a deadline (break, lease end) | "Clear my room before break": scan 6 things, listed by lunch, messages handled, delisted when sold | The room relates instantly; volume shows off batch capture, the inbox and delisting | Low-value items; the price story is small dollars |
| **B. Casual declutterer** | Anyone with a closet of things they mean to sell "someday" | "Sell the jacket you haven't worn in a year": one item, done in 2 minutes | Widest market; the "no thinking" interface fits | Low urgency; one item makes a thin demo |
| **C. Part-time flipper** | Someone who buys at garage sales and thrift stores to resell | Garage sale: appraise a jersey, buy it, measure, relight, list, sell, delist | One item runs through every feature, including appraise | The crowded market (Vendoo, List Perfectly, FlipTip); power users pull the interface toward complexity |

**Agent view: A.** It is the seller with the most items, the hardest deadline and the least patience, so it stresses exactly what a crosslister must do better: batch capture, messages handled for you, and reliable delisting. It is also the room. C's garage-sale appraisal can be one beat inside A's story (the student checks a find before buying it) instead of the hero.
