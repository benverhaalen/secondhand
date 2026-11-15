# One job per page

Status: *agent proposal*, 2026-11-15, at Ben's asks of 10:07, 10:27 and 10:30 ([words](../../product/words.md#2026-11-15-page-jobs-every-controls-intended-action-iphone-standards-and-two-skills-turned-into-checks)): "each page should have one purpose", "for more detailed actions you can go into specific pages", "a lot of clutter", and the four tabs "layed out relatively similar in similar primitives".

The contract a check reads is [page-jobs.json](page-jobs.json) (`scripts/page-jobs.mjs`, rules J1 to J5, run by `node scripts/app-check.mjs`). This page says why each row is so. What each page carries in full is [spec/pages.md](../../spec/pages.md). The per-kind redesigns (tabs, object pages, sheets, lists, flows), with the planned features each page carries and what is left to wire, land in `spec/redesign/`.

## The rule

A page does one job, said in one sentence. Its first screen shows that job and nothing that competes with it. Everything else the page could show opens from a row with a chevron, a See all, or a sheet ([pages §1](../../spec/pages.md#1-when-a-feature-gets-its-own-page)). This is the frontend standard's first question, "Job. What is the one thing this screen is for, and what is the next action?" ([frontend-standard](../../product/frontend-standard.md)), which no page had written down until now.

The four tabs are one family: each opens with its name in the brand face at the same place (`TabNav`), the wash behind it, then its content the same distance below, in the same parts (`Shelf` for a section, `ListRow` for a row that opens a page, tiles or cards for things). That is how Mail, Music and Photos open (Apple HIG, Navigation bars, *asserted*).

## The jobs

| Page | One job | iPhone pattern it follows | What it is not (and where that goes) |
|---|---|---|---|
| Today | Clear what needs you, the most urgent first. | Reminders' Today list, with Wallet's lead card | not a dashboard: charts, goals and money over time go to You > Insights |
| Sell | See everything you sell by where it is, and open one. | Photos' library shelves | not a to-do list: what needs a decision is on Today; filters say the shelf names once, not twice (U19) |
| Buy | Find a thing, or see what your searches found. | App Store's Search tab: the field first | not a feed of deals: matches sit under the searches that found them |
| You | See how you are doing at a glance, and get to each thing about you. | Settings with the account card on top | not analytics, linking, tracking or settings in one place: each is its own page behind one row (Insights, Your sites, Pickups, Automation, Notifications, Settings) |
| Messages | Every conversation, newest first. | Messages and Mail | not a work queue: replies the agent drafted wait in each thread, and decisions are on Today |
| Item | One thing: where it is, and its next step. | a Photos item with its info below | not the market: the product page holds prices everywhere |
| Search | Find one thing across every site. | Safari and App Store search results | |
| Worth | Know what a thing is worth, then decide to sell or keep it. | the Shazam result: the answer, then two acts | |
| Want | Say what you are looking for, and how much you would pay. | a Reminders item with its details | |
| Camera | Get a thing in, one photo at a time. | Camera | |

## What the first audit found (2026-11-15, 10:29, web render at 390 by 844 with phone insets)

| Page | Breaks | What fixes it |
|---|---|---|
| Today | 7 lines before the first card (U11), 10 buttons (U12), a header set like its card titles (U10), every tag in a group the same (U13) | the rebuild in progress: one lead card, then groups by task with quiet rows |
| Sell | "Needs you" and "In progress" shown in the filter and again on the shelf (U19), 5 lines before the first tile (U11) | the filter row goes, or the shelf headers carry the counts and the filter shows only sort |
| Buy | 4 lines before the first match (U11), a search's long name cut (U14) | the want shows its short name; the line under the field goes |
| You | its first row to a page sits at 1935, five screens down (J2), a week chart inline (J4) | the Settings pattern above |
| Item | no photo on its first screen in the demo item (J2); the offline state is not drawn (B35) | the Item lane's redesign |
| Messages, Search, Want, Worth, Camera | pass | |

Limits: the web render with phone insets, not the phone; the phone thread's native captures are the check on that ([native-vs-mocks](../../research/app/ben/native-vs-mocks.md)).
