# Decisions

Newest first. Each entry gives what was decided, who agreed, the words it rests on, and what it changed. A later decision links back to the one it replaces; old entries are never rewritten.

## 2026-11-14: extreme intention, and a UI constitution
Agreed by: Ben, project chat at 20:17 and 20:20 ([words](words.md#2026-11-14-constitutions), [20:20](words.md#2026-11-14-extreme-intention)). Decided: "everything needs to be done with extreme intention". Every UI element has a stated reason. Ben also asked for a project constitution for how UI decisions are researched and made, grounded in his thesis. Text on screen must be understood by a person: no statistics notation ("Sold $36–52 n=41"), no counters that mean nothing ("3 need you, 11 handled"). Cards offer more than two actions. Items show their photo. The wordmark sits top center. The Needs you / All messages switch goes. Written up as [ui-constitution.md](ui-constitution.md); its articles beyond these are *agent proposals*. Changed: Today is reworked ([research/today/ben/today-rework](../research/today/ben/today-rework/README.md)), and seller features he hadn't named are listed in [missing-features.md](../research/cross-cutting/ben/missing-features.md). The 19:40 Today wireframe with the segments is superseded.

## 2026-11-14: in-app copy is minimal, and the UI shows rather than says
Agreed by: Ben, project chat at 19:45 ([words](words.md#2026-11-14-show-not-say)). Decided: writing in the app is kept to the minimum, and state is shown (photos, pills, numbers, icons, motion) instead of explained in sentences. Every UI generation pass, by any agent, applies Ben's **anti-claudish** skill from his harness. The working rules are in [copy.md](copy.md), linked from AGENTS.md and the brand coder card. Changed: every screen gets a copy pass before it counts as done, and existing wireframe copy is cut on the next restyle.

Added by Ben at 19:46 ([words](words.md#2026-11-14-familiar-and-attention)): communicate as much as possible through patterns people already know from similar apps, and use color, layout and hierarchy to direct attention, applying the psychology and principles expert designers use. Rules in [copy.md § Familiar patterns and attention](copy.md#familiar-patterns-and-attention).

At 19:47 Ben asked for this to be made rigorous for building, judging and auditing, motion included ([words](words.md#2026-11-14-frontend-standard)). The standard is [frontend-standard.md](frontend-standard.md) (*agent proposal* in its specifics, built on his ui-factory and writing skills). `scripts/copy-lint.mjs` ports the writing skill's product rules.

## 2026-11-14: first launch is setup first
Agreed by: Ben, on the onboarding card in the concept thread at 19:43 ([walkthrough §11](walkthrough.md#11-first-launch-and-onboarding)). He picked B over the agent's recommendation, A (value first). Decided: first launch connects your sites, then sets pickup windows and the meetup spot (or "ask me every time"), then notifications, before you reach Today. This is the canvas Onboard screen. Changed: pickup setup moves from first use into onboarding. *Agent proposal, to keep the cost of a form low:* each step can be skipped, and it says why it asks. The canvas Onboard screen already says "you can skip all of them and still scan, price and search".

## 2026-11-14: Databricks runs the whole backend, with a hybrid fallback
Agreed by: Ben, on the Databricks card in the concept thread at 19:41 ([walkthrough §10](walkthrough.md#10-behind-the-scenes-how-much-runs-on-databricks)).

Decided:
- **Hosting and agents:** Databricks Apps hosts the backend and webhooks. Agent Bricks runs the agents. Lakebase is the app database, synced to Delta. Unity Gateway calls the models.
- **Visible traces:** MLflow traces every step and is shown as a "why?" timeline on each item.
- **Learning from approvals:** your approvals are evaluation labels that move actions between the Ask and Auto tiers.
- **Questions:** Genie answers questions over your items and sales.
- **Fallback:** if Lakebase or Apps isn't working within 2 hours of setup, the app and its database move off Databricks (option C). Comps, valuation, traces, evaluation and Genie stay on it. The product does not change.

Changed: features/data is the backbone for item-card, price, today and You > By site.

## 2026-11-14: the You tab leads with numbers and a by-site comparison
Agreed by: Ben, on the You card in the concept thread at 19:40 ([walkthrough §8](walkthrough.md#8-the-you-tab)). Decided: You opens with earned, could earn and sold. A By site card follows, showing how fast each site sells and at what share of the asking price. Below that is a settings list: Accounts (with each site's health), Automation (Rules and their log), Pickups (windows and meetup spot) and Notifications. There is no public profile. Changed: the By site numbers come from the sales data on Databricks.

## 2026-11-14: the Buy tab mirrors Sell with shelves
Agreed by: Ben, on the Buy card in the concept thread at 19:38 ([walkthrough §7](walkthrough.md#7-the-buy-tab)). Decided: a search box across every market, then three shelves of photo tiles with pills: New matches, Watching and Bought. Bought items can become "Sell this". Alerts promise "within the hour". Changed: Buy and Sell share one visual habit. Screens are wireframes only until the brand is set (Ben, 19:37).

Added at 19:38 ([words](words.md#2026-11-14-appraise-from-buy)): Buy's search bar gets a camera icon and accepts a pasted listing link, the visual-search pattern of Amazon, eBay and Google (*asserted*). Both open the same Valuation card, framed for a buyer: a fair price and the most to pay. A "Bought it" button turns the card into an item you own, ready to sell. This keeps the bar rule, because photo search is still search: ＋ adds things you own, and Buy's camera looks things up.

## 2026-11-14: the Sell tab is a photo grid with state pills; numbers live in You
Agreed by: Ben, in words at 19:33 ([words](words.md#2026-11-14-sell-grid)). This replaced the agent's recommendation of segments with a totals strip. Decided: each item is a photo tile carrying a state pill (Researching, Review, Live, Offer $X, Ship by, Sold, Slow) and small badges for the sites where it is live. Earned, count, potential and insights move to You. Grouping (Ben, card at 19:35): **shelves by state**. In progress, Live and Sold rows each scroll sideways with a count; "see all" opens a filtered grid. The variants are in `research/today/ben/sell-grid/`.

## 2026-11-14: pickups use your windows and a saved meetup spot
Agreed by: Ben, on the pickup card in the concept thread at 19:30 ([walkthrough §6](walkthrough.md#6-pickup-and-shipping)). Decided: you set pickup windows once, and the agent offers buyers only those times. The default place is a public spot you saved. Your home address goes out only on a separate Never alone tap. A confirmed pickup becomes a Google Calendar event. For shipping, the app picks the box size from the measurements, uses the platform's own label, and puts a "ship by" card in Today. Ben added at 19:31: "keeping an option for B's functionality is good". So a setting, **Ask me every time**, switches off the windows. The agent then relays each time the buyer proposes, and you approve it or suggest another. Changed: when you first use pickup, it asks for your windows and a meetup spot, or you choose "ask me every time". The Event primitive carries the place and the calendar link.

## 2026-11-14: automation runs in tiers that learn
Agreed by: Ben, on the human-in-the-loop card in the concept thread at 19:29 ([walkthrough §9](walkthrough.md#9-asked-next-human-in-the-loop-what-runs-on-its-own-and-what-always-needs-a-tap)).

Decided: three tiers.
- **Auto**, logged and undoable: availability and size answers, delisting after a sale (paced on Poshmark), and markdowns above your floor.
- **Ask**, waiting in Today: counter-offers, any price below your floor, and the first post of an item.
- **Never alone**: address, pickup time, payment, and off-platform deals.

After you approve the same kind of Ask 3 times, its card offers "Always do this". Never alone can never be promoted.

Changed: Today holds Ask and Never alone cards. You > Automation lists each Rule with its log.

## 2026-11-14: the bottom bar is Today · Sell · ＋ · Buy · You
Agreed by: Ben, on the bar card in the concept thread at 19:27 ([walkthrough §3](walkthrough.md#3-second-pass-what-does--do-that-sell-and-buy-dont)). Decided:
- Tabs are places; ＋ is the only way a physical thing gets in. The camera or a dropped folder then offers Sell this, What's it worth, or Find this.
- Sell and Buy are lists with no add buttons. Typing a want stays as search in Buy.
- Today opens on "Needs you"; "All messages" is a segment at its top.
- Appraise shows as a value on every item and match.

Changed: [functions.md §4](functions.md#4-what-the-scaffold-has-to-hold) homes map to these tabs. The canvas's Today, Closet, Wants and You bar is replaced.

## 2026-11-14: listing goes item by item, in a drafting area
Agreed by: Ben, in words at 19:08 ([words](words.md#2026-11-14-function-map)). This answered walkthrough step 2, and the card was closed as option B. Decided: each item gets its own live draft. The draft shows a researching state while identify, measure, studio and price run. Dropping a whole folder of photos splits it into one draft per item. Changed: the selling flow is one draft screen per item. The [function map](functions.md) is now the source for every later option.

## 2026-11-14: secondhand is a seller's crosslister at its core
Agreed by: Ben, on decision card 1 of the [walkthrough](walkthrough.md#1-what-the-app-is-at-its-core) in the concept thread (19:02 UTC). He picked A over the agent's recommendation, C (item ledger). Decided: selling leads. Appraise and buy stay in scope ([keep every feature](#2026-11-14-keep-every-feature-in-scope)) as add-ons to the selling flow. Changed: decisions 2 to 10 are framed around a seller first. The edge has to come from how well it sells (measured fit, honest relit photos, net proceeds, messages handled), not from posting to more places, since only eBay has an official listing API.

## 2026-11-14: the platform list is set
Agreed by: Ben ("set those in stone"). Source: [words.md](words.md#2026-11-14-platforms). Decided: the core platforms, which both list and search, are eBay, Facebook Marketplace, Depop, Poshmark and Mercari. OfferUp and Grailed come later and are search and price only. Craigslist, Etsy, Vinted and Swappa are skipped. Only eBay has an official listing API, so the demo posts to 3 or 4 platforms and searches the rest. Changed: connect, list and watch are scoped to these platforms.

## 2026-11-14: research is filed feature first
Agreed by: Ben, on the layout decision card in the project thread. Changed: research moved from `research/<person>/<slug>/` to `research/<slug>/<person>/`.

## 2026-11-14: keep every feature in scope
Agreed by: Ben. Source: [words.md](words.md#2026-11-14-scope). Changed: the concept brief stopped trimming features and now lists them in build order.
