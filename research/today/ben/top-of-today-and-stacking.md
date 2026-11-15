# Where does the good news go, and when does stacking cards help?
Researched 2026-11-15 by Ben (Claude Code, thread "Roll the UI system out everywhere"). Feature: today.

Ben, 03:06, answering two open calls: "think of the different ways we can show 'good' or even if we should have this thing at the top or on another screen. or if we should have a chart or something. reason about the best way to display this info from our personas", and "im not actually sure when and where stacking is useful. comparing it to alternatives and thinking of personas and what we want and what the user wants not what they say." The personas are in [today-wants-alerts-and-clickability.md §1](today-wants-alerts-and-clickability.md#1-who-opens-the-app-next-to-what-they-already-use). The render is [today-v5-good-news-and-groups.png](today-v5-good-news-and-groups.png).

Marks: *observed* (read at the source), *asserted* (claimed without method, or from memory), *inferred* (our reasoning).

## 1. The good news

**What is already decided.** Earned, count, potential and insights live in You ([decision, 19:33](../../../product/decisions.md); [spec/features/insights.md](../../../spec/features/insights.md)), and goal progress is "a You number, never a card" ([spec/features/today.md](../../../spec/features/today.md)). The payout is "one quiet line on Today". Since then Ben asked to highlight the money (02:18), then said the number was "too blank" and should not read $0.00 for a new user (02:46). Read together, under [Article 8](../../../product/ui-constitution.md#article-8-ben-directs-by-reacting-the-agent-proposes), the want is to feel the payoff of the app the moment you open it, not to keep a dashboard on Today (*inferred*).

**What each persona wants from it** (*inferred* from §1 of the today note):

| Person | How often they sell | What "good" means to them | What a weekly total shows them |
|---|---|---|---|
| Clearing out (primary) | A few things, spread over weeks | This thing is gone, and here's the money | Usually $0 or one sale; stale most days |
| Young fashion seller | Bursts around drops | It sold, fast | Spiky |
| Flipper | Most days | The running total, and the trend | Exactly what they want, every day |
| Buyer with intent | Rarely sells | Found at my price | Nothing |

**Common answer:** a big earnings number at the top, maybe with a chart (Shopify's and Uber's home screens, *asserted* from memory for Shopify; Uber *observed* in the today note). It fits the flipper and fails the primary persona, who would see a stale or empty number most days. Dropped as the default.

**Options:**

| | What | Rests on | Wrong if |
|---|---|---|---|
| A | A fixed total at the top ("Earned this week"), always | Uber's tracker, 86% use on driving days (*observed*, today note §1) | The person sells less than weekly: then it is $0 or stale, the case Ben named |
| B | Nothing at the top; good news only as notice rows, totals and a chart on You | Airbnb host Today puts actions first and moved earnings to Insights (*observed*, [structure-references.md](structure-references.md)); decision 19:33 | People open the app for the money and find nothing that tells them it worked |
| C | **News since you last looked**, at the top, only when there is some: "Since yesterday" over "$64.84" and "2 sold, after fees", tapping through to You. Nothing new: no slot, cards start under the nav. A new person: the next setup step in its place ("Connect where you sell"), as Airbnb's "Next steps for you" (*observed*, structure-references) | Ben's "perk up" and "a new user probably doesnt want to see 0.00"; the today note's test that money moving toward you is the one thing worth space | The person wants a stable number to check (the flipper): they get it one tap away on You |
| D | A chart on Today | None for Today; a chart needs many points, and the primary persona has a handful | Holds for the flipper only, on You |

**Recommend C.** It shows the money exactly when it is news, never a blank or $0.00, and leaves the totals where Ben put them. The chart belongs on You: weekly bars of money kept, shown once there are enough sales to make a shape (a starting rule: 3 weeks with a sale; *agent proposal*). Strongest rival: A, for the flipper; if Ben wants the stable number, A is C with the "since" label swapped for "this week" whenever there was a sale this week.

The words: "Since yesterday", "Since Monday", "Since you last looked" for gaps over a week. The amount is the money kept after fees. A sale not yet released says "On its way" under it ([insights](../../../spec/features/insights.md)). No confetti, no counters, no "Handled" (L13).

## 2. Stacking

**Where a stack could go** (*inferred*): Today shows each open decision as a card. Most days that is a handful. Two moments make it long: a folder drop of 40 items (the dense state, [frontend-standard §4](../../../product/frontend-standard.md#4-states-every-screen-must-design)) gives 40 first posts to approve, and a flipper's busy day gives several labels to print.

**What a stack costs:** every card under the top one hides its deadline, its money and its photo. Today's promise is that ignoring the app loses nothing ([spec](../../../spec/features/today.md)), so a stack that hides an offer expiring in an hour breaks it (*inferred*). iOS notification stacks group by app and expand on tap (*asserted*); Gmail's Inbox bundled mail by kind and was shut down in 2019 (*asserted*, from memory).

**Alternatives**, by what the hidden cards need:

| The cards | Best form | Why |
|---|---|---|
| Different kinds, or any deadline under a day | **One card each**, soonest first (as now) | Nothing urgent is hidden |
| Several offers on one item | **One card for the item**, every offer listed (already in the spec) | Answering one changes the others |
| Same kind, can all be done at once (5 labels to print) | **A batch card**: the photos overlapped, "5 to ship by tomorrow", one button "Print 5 labels" | One tap does all of it; a stack would make you open five |
| Same kind, each needs its own look, no deadline (40 first posts) | **A queue card drawn as a stack**: the top item, two slivers under it, "40 ready to post"; tap opens them one at a time, full screen, swipe to the next | The stack shape says "more under this" and fits 40 into one card; reviewing one at a time is what the person actually does |

**Recommend:** no stacks for decisions with a deadline or of mixed kinds. Batch cards when one action covers all of them. A queue card, drawn as a stack, when each needs its own look and none is urgent; tapping it opens the queue rather than spreading the cards in place, because 40 cards in place is the long list the stack was meant to avoid. Strongest rival: spreading in place, which is better under about 5 cards; the queue covers both if it opens at the first card.

## Limits

- No persona was asked; the readings come from the persona table and Ben's words.
- The chart threshold and the "since" wording are starting values.
- Shopify's and Gmail's facts are from memory and were not checked; nothing above rests on them alone.
