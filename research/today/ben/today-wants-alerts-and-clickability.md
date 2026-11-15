# What should Today show, which alerts earn a push, and how does a person know what is tappable?
Researched 2026-11-15 by Ben (Claude Code, thread "Roll the UI system out everywhere"). Feature: today.

Ben, 02:18 ([words](../../../product/words.md#2026-11-15-dark-mode-approved-the-size-system-everywhere-clickability-money-and-countdowns-color-blind-checks)): highlight the money and the key facts, use countdowns for time, make the ship notice lead to an action, think about the content "from the user want not need", what a user would want on Today, alerts a person "perks up" at instead of "slop like depops", and who our customers are next to the apps they already use. Every design line is an *agent proposal*. The mock is in the project files (`secondhand-brand/today-v3/`); its values are in [dark-mode-and-size-system.md](../../cross-cutting/ben/dark-mode-and-size-system.md).

Marks: *observed* (opened and read through a fetch helper; words in quotation marks are as the helper returned them and may be paraphrased), *asserted* (a source claims it without method, or from memory), *inferred* (our reasoning), *measured* (a script or a headless render).

## 1. Who opens the app, next to what they already use

The first person we build for is someone clearing their own things who also buys used ([decision](../../../product/decisions.md#2026-11-14-the-first-person-we-build-for-is-someone-clearing-their-own-things)). The others use it without shaping it.

| Person | What they already use, and what it taught them | What they want, from what they did | Mark |
|---|---|---|---|
| **Clearing out** (primary) | Facebook Marketplace for bulky local things, Mercari for "anything", consignment (ThredUp) for no effort, Decluttr-style instant offers | The stuff gone, then take-home money; to be needed rarely ([user-wants.md](../../cross-cutting/ben/user-wants.md) principles 1 to 3). In the US, 27% sold their own clothes in 2024; sellers move about 43% of what they don't want and 57% goes unsold; 42% find it hard to "responsibly get rid of clothes" (thredUP 2025 Resale Report, 3,000+ US adults, via [The Vintage Seeker](https://www.thevintageseeker.ca/magazine/secondhand-shopping-selling-takeaways-2025-resale-report)) | observed (secondary) |
| **Young fashion seller** | Depop: browse by look, social, offers | Identity and quick sales. Depop "approximately 90% of active users are under 26" and buyers "shop for identity" ([Measure Protocol](https://www.measureprotocol.com/insights/depop-vs-vinted-secondhand-fashion-market), June 2026, no method given) | asserted |
| **Side income, flipper** | Crosslisters (Vendoo, List Perfectly), eBay Seller Hub | A running total of what they made and "never sold twice" ([seller-metrics-and-notifications.md](../nate/seller-metrics-and-notifications.md), [user-wants.md](../../cross-cutting/ben/user-wants.md) principle 7) | observed |
| **Buyer with intent** | Vinted and eBay search by brand and size, StockX bid and ask, Google Flights price tracking | The thing at their price without watching. Vinted buyers "arrive with intent" and search "Levi's 501 W32 L30" (Measure Protocol, as above); watching is a saved query plus an alert ([structure-references.md](structure-references.md)) | asserted |

What the four share (*inferred*): money that is certain and effort that is small. None of them opens a resale app to read about it.

**The closest analogue for a money home is a gig driver's app** (*observed*): Uber found drivers "would keep a notebook in their car to manually track the fare earned from every trip" and "needed to know exactly how much money they were making so they could pay bills" ([Uber Design, 2015](https://medium.com/uber-design/designing-a-partner-centric-experience-d9900e6511dc)). Its tracker shows the last trip and the day's earnings as cards on the home screen, and "86 percent of drivers use it on days when they are picking up riders" ([Uber Engineering, 2019](https://www.uber.com/blog/real-time-earnings-tracker/)). Airbnb's host Today puts time-sensitive actions first ([structure-references.md](structure-references.md)).

## 2. What Today shows, in order

| Slot | What | Why it is there | Want it serves |
|---|---|---|---|
| Header | Wordmark centered (Ben, [20:17](../../../product/words.md#2026-11-14-constitutions)), messages at the top right with a count ([decision](../../../product/decisions.md#2026-11-14-all-messages-live-behind-a-chat-icon-with-a-count)) | Familiar: a centered title with one trailing button is the iOS nav bar | Know there is nothing hidden |
| Top slot (*open*: ledger R40, and the spec puts goal progress on You) | "Earned this week" over "$96.20" at 36, "3 sold, after fees" under it. Dynamic and never $0.00: Ben, 02:46, "a new user probably doesnt want to see 0.00"; the order is in [buttons-taps-corners-new-camera.md §6](../../cross-cutting/ben/buttons-taps-corners-new-camera.md#6-what-the-top-of-today-shows) | Ben asked for the money to stand out (02:18). The Uber notebook: the number people open a money app for. Take-home, never gross (user-wants principle 2). Airbnb moved earnings off its Today into Insights, which argues the other way | Money, and stuff gone |
| Decisions | One card per open Decision, soonest deadline first ([spec](../../../spec/features/today.md)) | Each card: a kind tag, a countdown, the photo with its site, the item, what you keep, the full action set | Nothing lost by ignoring the app |
| Notices | A row per thing that asks nothing but is good to know, ending in a chevron: "Your Patagonia fleece went up $12" (`value_moved`) | Opens the item. Money moving toward you is the one notice worth space | Perk up |

Removed from the earlier sheets, with the reason:
- **The "Ship the Nike Dunks by tomorrow" banner.** It repeated the Dunks card. A deadline now sits on the card whose buttons resolve it, as "Ship in 21h" (*inferred*; one fact, one place).
- **The "Sold" chip on the photo.** At 72 pt it covered the item. The state is now a kind tag on the card.
- **A "Handled 6 things" row.** Ben ruled the handled counter out ([ledger L13](../../../brand/ledger.md)); the log opens from You.
- **A separate large "Today" title under the wordmark.** Two titles stacked read as two spacings (Ben, 02:18); the tab bar already says Today.

## 3. Alerts a person perks up at

The test for any push (*inferred*): **would this person be glad to be interrupted for it?** It moves money toward them, needs them before a deadline, or is something they asked us to watch. Apple's guidance agrees: "provide valuable information succinctly", avoid notifications "that tell people to perform specific tasks within your app" unless the task can be done from the notification's own buttons ([HIG, Notifications](https://developer.apple.com/design/human-interface-guidelines/notifications), *observed*). The top reason people opt out of push is "too frequently" (Airship 2026, *observed* in [seller-metrics-and-notifications.md](../nate/seller-metrics-and-notifications.md)).

| Event | Delivery | Buttons on the notification |
|---|---|---|
| An offer at or above the lowest you'd take, under an hour left | Time Sensitive (spec) | Accept, Counter |
| A pickup within the hour | Time Sensitive (spec) | On my way, Running late |
| **A sale** | *agent proposal, open*: an immediate normal push, "Sold. You keep $31.40". It is the moment the app exists for, and the snap. The spec batches it today | Print label |
| A watched item under your max | *agent proposal, open*: immediate, since it may sell | Buy, Hold |
| An offer under the lowest you'd take, value moved, demand rose | Batch, up to 3 a day (spec; Fitz et al. 2019) | none |
| Anything the agent did inside your limits | Log only | none |
| Likes, views, "someone is looking", followers, promotions | Never | |

The two open rows change [spec/features/today.md](../../../spec/features/today.md) step 8 and are for Ben and Nate.

## 4. Countdowns

Our audit list banned countdowns as a dark pattern ([frontend-standard §5](../../../product/frontend-standard.md#honesty)). The evidence is against fake ones: invented scarcity and timers that reset ([psychology.md §9](../../cross-cutting/ben/psychology.md)). A real deadline set by a site, a buyer or a carrier is a fact (*inferred*). Depop offers last 14 days and Poshmark offers 24 hours ([spec facts](../../../spec/features/today.md#facts-to-know)), so the time left is the thing the person needs. Rule taken: time left under 24 hours ("3h 40m", by the minute, never by the second), a day and time beyond that, never red, nothing that pulses.

## 5. Clickability

NN/g's eyetracking study, 71 users, nine page pairs: weak signifiers took 22% more time and 25% more fixations to find the target; on one pair 86% of users went straight to the link with strong signifiers against 50% with weak ones, and nine users stopped at a heading they thought was a link ([NN/g, 2017](https://www.nngroup.com/articles/flat-ui-less-attention-cause-uncertainty/), *observed*; desktop, a find-the-click task, not a usability test). Apple: a row that drills into a view uses a disclosure indicator (the chevron); an info button never navigates ([HIG, Lists and tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables), *observed*).

What follows (*inferred*): the "ship" banner had an X, which says "dismiss me", and nothing that says "this leads somewhere". So:
- A filled pill is a button. A row or notice that opens something ends in a chevron. A card that opens its item is raised (a shadow in light, an edge in dark), and the whole card is the target.
- Nothing that isn't pressable looks it: tags, counts and the countdown are flat and borderless.
- The words that name the deadline sit next to the buttons that meet it.

## 6. Color blindness

Ben is color blind (02:18). Simulated with Machado et al. 2009 at full severity (*measured*): the four state fills stay .056 to .182 apart in Oklab under protanopia and deuteranopia. The closest pair is paid lime and needs-you marigold at .056 (deuteranopia); the pair on Today, sold mint and needs-you marigold, is .068 to .071. So a state is a word, an icon and a color, never the color alone. A dark yellow is brown by physics (sRGB caps lime at chroma .09 near L .4), so in dark mode yellow and lime never fill a ground; the dark field is sky, mint and aqua. The simulated render is `secondhand-brand/today-v3/today-color-blind-sim.png`.

## Limits

- Persona numbers come from vendors and secondary articles; the thredUP figures are about clothing.
- The Uber analogue is about drivers who sell their time daily; casual sellers check less often (*inferred*).
- No design here has been tried with a person. The open alert rows need Ben and Nate.
