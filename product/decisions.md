# Decisions

Newest first. Each entry gives what was decided, who agreed, the words it rests on, and what it changed. A later decision links back to the one it replaces; old entries are never rewritten.

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
