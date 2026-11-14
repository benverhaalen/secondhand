# Adjacent-field references for secondhand

Researched 2026-11-14. Goal: find apps outside resale whose shipped UX already solves the same underlying problems as secondhand, and name the concrete pattern to borrow.

**Evidence marks**
- **observed**: I opened the source and it states this.
- **asserted**: the company claims it, with no method shown (for example, a vendor's accuracy figure), or I saw it only in search-result headlines and did not open the page.
- **inferred**: my own reasoning about how the pattern carries over to secondhand.

**Source quality.** Official help centers, company blogs and engineering blogs come first. Press is used only where no first-party page could be opened (some sites blocked fetching). The web-fetch budget ran out near the end, so the last few items are marked asserted.

---

## A. Sending one item to the best of several channels, trading speed against value

| Reference | Concrete pattern | What to borrow for secondhand | Evidence | Source |
|---|---|---|---|---|
| Google Flights: "Best" vs "Cheapest" | Two tabs. "Best" is the default and ranks by price plus convenience (duration, stops, airport changes). "Cheapest" ranks by price alone and lets in hassle options (self-transfers, online agencies). Cheaper options are shown in green font relative to the lowest price. | Lead with a **"Best for you"** route (net payout after fees, minus hassle such as shipping and meetups), with a **"Most money"** tab beside it. Hassle factors (ship vs. local meetup, fee %, typical days to sell) play the role of "stops." | observed | https://support.google.com/travel/answer/7664728?hl=en |
| Google Flights: tested Best/Cheapest toggle | In 2024 Google tested a more prominent two-button bar, with "Best" still the default. | The speed/value split works as a **segmented control at the top of results**, not a buried sort menu. | observed (press, test only) | https://9to5google.com/2024/06/21/google-flights-tests-prominent-best-and-cheapest-sorting-for-trip-options/ |
| Opendoor: net-proceeds comparison | A line-item table, "Opendoor vs. traditional sale": sale price, then fees, closing costs, repairs, staging, holding costs and concessions, down to **estimated net proceeds**. The fast option wins or nearly ties *after* costs even though its headline price is lower. Timing shown as "21-60 days (you choose)" vs "60-90+ days". | Compare channels on **"you keep $X"**, not list price. Example: Marketplace $60 local, $0 fees, ~3 days, 1 meetup vs. eBay $78, minus ~13% fee and shipping, = $61 kept, ~7 days, print a label. | observed | https://www.opendoor.com/articles/how-selling-to-opendoor-compares-to-a-traditional-home-sale ; https://help.opendoor.com/selling/how-it-works/how-is-opendoor-different |
| Kelley Blue Book: owner disposal paths | All of an owner's options sit on one page: Donate (a rule of thumb: worth it if the car is worth about $1,000 or less), Instant Cash Offer ("valid for three days"), Trade-In Range, Private Party Value ("traditionally higher than trade-in"). | Put **"Donate / Quick cash / Sell it right"** side by side. Include a "not worth selling" threshold, so low-value items get an honest "donate or bundle it" answer. | observed (2018 press release) | https://mediaroom.kbb.com/donate-sell-trade-in-kelley-blue-book-helps-car-owners-make-informed-decision-about-current-vehicle |
| Hopper: "Wait or Book" | A single binary verdict ("buy now or wait") replaces reading a chart. It is built to answer one anxiety: "What if this price suddenly goes up?" | A **"List now or wait?"** verdict for seasonal items (coats in fall, bikes in spring), shown in one line. | observed (pattern); **asserted** (the "95% accurate" claim has no method shown) | https://medium.com/@hopper_travel/waiting-is-the-hardest-thing-b340626ff123 |

**Takeaway.** Default to a "Best for you" route ranked on net-in-pocket after hassle, keep a one-tap "Most money" alternative, and do the subtraction for the user the way Opendoor's table does. Never compare channels on headline price.

---

## B. Approving actions the agent prepared, with little effort

| Reference | Concrete pattern | What to borrow for secondhand | Evidence | Source |
|---|---|---|---|---|
| Monarch Money: Transaction Review | Each transaction is either "needs review" or "reviewed." Rules can auto-mark the routine ones as reviewed, so you are only notified about items the rules missed. A dashboard card lists what needs review when you open the app. | **Rules mark routine items done, and only exceptions reach the inbox.** Example: "auto-accept offers at or above 90% of ask" pre-approves those; only below-floor offers or odd buyer messages surface. | observed | https://www.monarch.com/blog/transaction-review |
| Copilot Money: "To Review" plus learned categorization | New transactions land in a "To Review" section on the Dashboard. Suggestions start once **at least 30 transactions have been reviewed**, and predictions get better as you review more. | **Earned autonomy:** start with everything needing approval, then offer "auto-handle this kind" once the user's approvals show a consistent pattern. | observed | https://help.copilot.money/en/articles/11157550-quick-start-guide |
| GitHub: suggested changes, batched | A reviewer's suggestion can be applied in one click ("Commit suggestion"), or several can be added to a batch and applied together. | **Accept one, or "Accept all 4"** for agent-drafted listing edits and replies, with each change shown as a diff (before → after title, price). | observed | https://docs.github.com/es/enterprise-server@3.0/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/incorporating-feedback-in-your-pull-request |
| Bank fraud alert texts (Alliant) | A two-sentence text naming the merchant and amount. Reply YES to approve, NO to decline. | **Approve from the notification itself** ("Buyer offers $45 for lamp. Accept / Counter $50 / Decline") with no app open. Fits iOS actionable notifications. | observed | https://www.alliantcreditunion.org/help/real-time-fraud-text-alerts-for-Alliant-Visa-card-transactions |
| Superhuman: Auto Drafts | AI writes follow-up and scheduling drafts into the thread about an hour before a reminder fires, "ready for you to review and send." Nothing sends automatically. Tone is learned from the user's recent emails, and there is a "Give Feedback on Auto Draft" option. | **Drafts already sitting in the thread, never auto-sent:** buyer replies pre-written in the user's tone, with a "doesn't sound like me" feedback control. | observed | https://help.superhuman.com/hc/en-us/articles/40144492186515 |
| Gmail Smart Reply | Short reply chips. The original paper reports it helped with **10% of all mobile replies** in Inbox. | One-tap reply chips for common buyer questions ("Still available?" → "Yes, can meet Sat"). There is proof of real adoption at scale. | observed (abstract) | https://arxiv.org/abs/1606.04870 |

**Takeaway.** Use a Monarch-style inbox where rules clear routine items and only exceptions surface, combined with actionable-notification approvals as in bank fraud texts. Grow autonomy the way Copilot does, after a pattern of approvals, rather than asking up front.

**Known failure.** Apple Notification Summaries (see F) show what happens when AI output is not visibly marked as AI.

---

## C. Showing what your things are worth

| Reference | Concrete pattern | What to borrow for secondhand | Evidence | Source |
|---|---|---|---|---|
| Zillow Zestimate | A point estimate **plus an "estimated sales range."** Accuracy is published openly: median error **1.80% on-market vs 7.21% off-market**. Up to 10 years of history. The owner can update home facts. Explicitly "not an appraisal." | Show **a value with a range**, with confidence tightening as the user adds detail (photo, brand, condition). Let the owner correct facts ("It's the 2022 model"). Label it as an estimate, not an offer. | observed | https://www.zillow.com/zestimate |
| Kelley Blue Book Price Advisor | A gauge with colored zones and **separate values per path** (trade-in vs private party). Ranges were introduced because a single number cannot capture negotiability, with the aim of "setting common expectations." | **Different values per channel:** "Quick sale $40-50 · Patient sale $65-80." Condition picker changes the value live. | observed (2014 press release) | https://mediaroom.kbb.com/range-based-used-car-values-launched-buyers-sellers-price-advisor-tool?asPDF=1 |
| Collectr (trading-card portfolio) | Portfolio value graph with time ranges, "Biggest Gains/Losses" movers, price alerts at a target value, and a button to see sold listings. 4.9★ from 70K ratings. | A **"Your stuff" portfolio**: total resale value of scanned items, which items are rising or falling (sell before it drops), and a "see sold comps" proof link on each item. | observed (App Store) | https://apps.apple.com/app/id1603892248 |
| Robinhood (negative reference) | Removed its confetti celebration in 2021 after the Massachusetts regulator cited "gamification strategies to manipulate customers." | Celebrate a **sale completed**, not value going up. Avoid daily-change dopamine loops for household items. | observed | https://www.cnbc.com/2021/03/31/robinhood-gets-rid-of-confetti-feature-amid-scrutiny-over-gamification.html |

**Takeaway.** Show a range, with a different value per selling path (KBB), and let the user correct the facts to tighten it (Zestimate). The proof is a "sold comps" link, as in Collectr.

**Failure to heed.** Zillow Offers shut down in 2021 after Zillow said it was "unable to predict future pricing of homes to a level of accuracy" (https://www.inman.com/2021/11/03/the-zestimate-comes-back-to-bite-reactions-to-the-end-of-zillow-offers/, observed). Keep estimates (soft) separate from anything presented as a guaranteed payout.

---

## D. Learning a fuzzy preference from taps instead of typing

| Reference | Concrete pattern | What to borrow for secondhand | Evidence | Source |
|---|---|---|---|---|
| Stitch Fix: Style Shuffle | A thumbs up/down game on single items. **10 billion interactions since March 2018, about 4.5M per day.** Dislikes count as much as likes. Players are "overall more satisfied" with what they receive (no figure given). | A **"This or not?" swipe deck** of real listings to teach taste for the buy side (mid-century vs farmhouse; worn-in vs mint). Treat a "no" as a strong signal. | observed (metrics are company-reported) | https://newsroom.stitchfix.com/blog/10-billion-interactions-and-counting-on-style-shuffle-the-data-powering-your-personalized-shopping-experience/ |
| Hinge: "Your Type Lately" | Shows **the traits it inferred** from your recent likes as editable chips. You add or remove them with a tap ("Add+"), give a thumbs down with a reason on a batch, and changes apply in the next day's set. | **Show the inferred profile as chips** ("You seem to like: walnut, under $150, pickup ≤10mi"). Each chip removable, plus "not my style because…" reason chips. | observed | https://help.hinge.co/hc/en-us/articles/53422663985683-What-is-Your-Type-Lately |
| Hinge: "We Met" | A few days after a match moves offline, it asks whether you met and whether you'd see them again. Treated as "the strongest signal." | **Ask after the purchase** ("Did the chair match what you wanted?") to retrain taste from outcomes, not just browsing. | observed (TechCrunch 2018) | https://techcrunch.com/2018/10/16/hinge-is-first-dating-app-to-actually-measure-real-world-success |
| Spotify: Exclude from Taste Profile | One button to stop a playlist from shaping recommendations, applied to past and future plays. Spotify chose explicit control because "we aren't mind readers." **20M+ users; about 4% more recommendation listening.** | **"Don't learn from this"** for gift shopping or one-off searches ("buying a crib for my sister"), so one search doesn't skew the feed. | observed | https://engineering.atspotify.com/2023/10/exclude-from-your-taste-profile |
| Critiquing-based recommenders (academic, Chen & Pu survey) | Users refine by **critiquing a shown item** ("like this but cheaper / more modern"). There are three kinds: natural-language, system-suggested and user-initiated critiques. | Under each result, offer chips such as **"cheaper," "closer," "more like this," "different style."** This is the tap equivalent of a conversation. | observed (abstract) | https://infoscience.epfl.ch/record/176775 |

**Takeaway.** Elicit taste with a swipe deck of real items (Stitch Fix), show the inferred profile back as editable chips (Hinge), and refine each result with critique chips.

**Gap.** Akinator-style narrowing and Netflix/Spotify onboarding pickers were not sourced from first-party pages.

---

## E. Watching for something and sending an alert

| Reference | Concrete pattern | What to borrow for secondhand | Evidence | Source |
|---|---|---|---|---|
| Google Flights: tracking and price insights | You track specific dates or **"Any dates"** (deals emailed across the next 3-6 months), and get an alert on a significant drop. Each result says the price is **low/typical/high vs history**. A price-guarantee badge pays back the difference (pilot). | **Watch "any listing like this"** (a fuzzy watch, not one listing), and label each hit "great / typical / high for this item." | observed | https://blog.google/products-and-platforms/products/travel/google-flights-find-deals/ ; https://support.google.com/travel/answer/7664728?hl=en |
| SeatGeek Deal Score | Each listing gets a 1-10 score for value relative to seat quality. Map pins are green (strong deal) or red (weak), and **blue means "can't calculate."** The engineering rationale: "searching rather than sorting." | Give alerts **a deal score that adjusts for condition and quality**, not raw price, and admit uncertainty explicitly ("not enough data" state). | observed | https://support.seatgeek.com/hc/en-us/articles/360007200954 ; https://chairnerd.seatgeek.com/the-math-behind-ticket-bargains |
| Hopper: watch with wait/book verdict | The watch turns into a push saying when to act. | Turn a watch into an **action verdict** ("This one is 30% under typical. Message seller?") rather than "new item found." | observed (pattern) | https://medium.com/@hopper_travel/waiting-is-the-hardest-thing-b340626ff123 |
| Collectr price alerts | Notifies you "when prices rise or fall to your desired value." | Seller-side **"Tell me when my item is worth $X"** (sell-side watch). | observed | https://apps.apple.com/app/id1603892248 |
| Zillow Instant saved-search alerts | Immediate notification of new listings and price drops on a saved search. | Instant alerts for **scarce local items**, where speed wins (Marketplace items go fast). Use a digest for the rest. | asserted (the first-party page would not load) | https://www.zillowgroup.com/news/zillow-instant-saved-search-immediate-notification-of-new-listings-and-price-drops/ |

**Takeaway.** Let users watch a fuzzy "anything like this" query rather than one listing, and grade every hit against history with a deal score that has an honest "can't tell" state. Make the alert say what to do, not just that something was found.

---

## F. Showing what the agent did on your behalf, with an audit trail and a way to step in

| Reference | Concrete pattern | What to borrow for secondhand | Evidence | Source |
|---|---|---|---|---|
| Pixel Call Screen | Automatic mode screens unknown callers. A **silent "Screening…" notification** opens a live transcript, then rings you only if the call is legitimate and shows what the caller said. Every screened call keeps a transcript in call history. Quick replies such as "Report as spam" and "I'll call you back." | **Agent handles first contact with buyers** ("Is this available? Will you take $20?") silently. The user is pulled in only for real buyers, and **sees the transcript** of what the agent said. | observed | https://support.google.com/pixelphone/answer/9118387?hl=en |
| Pixel Hold for Me | The agent waits on the line. You can glance at live captions any time, and you are alerted by sound, vibration and an on-screen prompt when a human answers. | **"Waiting for buyer" state with a peek-in transcript**, plus a loud handoff when the user is needed ("Buyer is here at the meetup spot"). | observed | https://blog.google/products-and-platforms/devices/pixel/hold-for-me/ |
| Google Assistant / Duplex restaurant booking | The user states the goal. The agent calls the restaurant, then confirms through **three receipts: a notification, an email and a calendar invite.** | After the agent arranges a pickup, write it **into the user's calendar and Messages**. The proof lives in the user's own tools. | observed | https://blog.google/products/assistant/book-table-google-assistant-across-country-more-devices/ |
| Duplex disclosure backlash (2018) | After demo backlash, Google said Duplex would identify itself as an automated caller. | The agent must **disclose to buyers that it is an assistant**. Cross-platform messaging done by an agent needs this, and it may be required by platform terms. | asserted (headlines only; page not opened, fetch budget ran out) | https://www.engadget.com/2018/05/10/google-duplex-ai-identification/ |
| Nest Energy History | Each day shows **one icon for the main reason** behind the change (Weather / You / Schedule / Eco-Away), compared with the prior 7 days. | **Every automated action in the activity log carries a reason tag** ("Price dropped 10% — Rule: no views in 7 days"). | observed | https://support.google.com/googlehome/answer/9247300?hl=en |
| Apple Notification Summaries (negative reference) | Inaccurate news summaries (the BBC complaint) led Apple in iOS 18.3 to pause news summaries, **show summaries in italics**, add a beta warning and add per-app off switches. | **Visually mark agent-written text** (italics or an assistant badge), give a per-thread "stop auto-replying here" control, and never paraphrase the buyer's words without showing the original. | observed | https://macrumors.com/2025/01/16/ios-18-3-news-notifications-removed |

**Takeaway.** Model the agent on Call Screen: it works silently, a transcript is always one tap away, and it interrupts only when a person is needed. Every automated action gets a one-line reason (Nest), and agent-written text is always visibly marked (the lesson from Apple).

---

## G. Camera-first apps where one capture can lead to different goals

| Reference | Concrete pattern | What to borrow for secondhand | Evidence | Source |
|---|---|---|---|---|
| Google Lens: mode consolidation (Dec 2023) | Cut its modes from **6 to 3** (Translate, Search, Homework) and folded Shopping and Text into the default Search. Google's research found users preferred **"one filter for everything"** over picking a mode before capturing. | **Don't make the user choose "Sell / Buy / Value" before shooting.** Capture first, then infer the goal. Keep separate modes only for truly different jobs. | observed (press quoting Google) | https://9to5google.com/2023/12/15/google-lens-three-filters/ |
| Apple Visual Intelligence | After a capture, two fixed buttons (**Ask** and **Search**) plus **contextual chips that appear only when relevant** (Add to Calendar when a date is detected, Summarize for text, Look Up for objects). | After the shot: fixed **"Sell this" / "Find one"** buttons, plus contextual chips ("Worth $40-60", "3 nearby for less", "Recall notice", "Bundle with…"). | observed (PopSci walkthrough; Apple support page body would not load) | https://www.popsci.com/diy/how-to-use-visual-intelligence-iphone/ |
| Shazam redesign | Home is "devoted almost entirely to the Shazam button." Tap to listen, **long-press for Auto Shazam**. Bottom tabs were removed. Swipe left to your history (My Shazam), right to Discover. | **Home = one big camera button.** Long-press could start a batch "declutter mode" that scans a whole room. Swipe left to My Items, right to Finds. | observed | https://www.macstories.net/news/shazam-launches-redesigned-simplified-ios-app/ |

**Takeaway.** Capture first and choose the goal afterwards. Lens shows that pre-capture mode pickers lose to "one filter for everything," and Visual Intelligence shows the two-fixed-buttons-plus-contextual-chips layout.

---

## Patterns that cut across problems

- **Range plus confidence plus an honest "can't tell" state** (Zestimate range, SeatGeek's blue pin, Call Screen's "may be inaccurate"). This builds trust in every number the app shows.
- **Exceptions-only attention** (Monarch rules, Call Screen) is the core way to keep effort low for casual users.
- **Visibly mark what the AI wrote** (Apple 18.3 italics, Superhuman's "review and send").
- **Gaps / not verified:** Copilot Money's swipe-to-review gesture was not documented on the pages I opened. Akinator, Netflix onboarding, Ring/Waymo logs and Wealthfront's activity view were not sourced. Zillow's alerts page and Duplex disclosure are asserted only.
