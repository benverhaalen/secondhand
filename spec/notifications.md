# Notifications: what interrupts, what waits, and what each one says

*Agent proposal* from Ben at 05:23 ([words](../product/words.md#2026-11-15-notifications-reasoned-from-business-ux-psychology-and-personas)): "what info needs to be in them. whats useful. everything from a business entrepreneur ui ux psychology and persona type thing". It builds on [today research §3](../research/today/ben/today-wants-alerts-and-clickability.md#3-alerts-a-person-perks-up-at) and [today](features/today.md), and uses Today's three tiers ([pages §5](pages.md#5-today-one-feed-ordered-by-what-ignoring-a-card-costs)).

## Why this matters, in three lines

- **For the business**, a push is the one channel that brings a person back without them deciding to open the app, and the first thing they turn off when it wastes their time: "too frequently" is the top reason people opt out (Airship, in [seller metrics](../research/today/nate/seller-metrics-and-notifications.md), *asserted*). Every push spends trust. A sale push earns it back.
- **For the person**, the app exists so they can stop checking five apps. A push should mean "this needs you, or this made you money", and nothing else. Three batches a day beat both every-event and none for stress (Fitz et al. 2019, *asserted* via the same note).
- **The test for any push** ([today research §3](../research/today/ben/today-wants-alerts-and-clickability.md#3-alerts-a-person-perks-up-at)): would this person be glad to be interrupted for it? It moves money toward them, needs them before a deadline, or is something they asked us to watch.

## The three levels

| Level | Matches Today's tier | Delivery | Rule |
|---|---|---|---|
| **Now** | `now` | an immediate push; Time Sensitive only when a deadline is inside the hour (Apple's rule) | money or a promise is at stake within a day, or a sale happened |
| **Later** | `when_you_can` | in the next digest, at most 3 a day (9:00, 13:00 and 19:00 local, moved toward when the person usually opens the app) | it needs them, but not today |
| **Silent** | `good_to_know`, and anything the agent did inside the person's limits | no push; a row in Today or the item's log | likes, views, followers, "someone is looking", promotions, our own automatic actions |

Nothing is ever sent to bring a person back for its own sake: no "we miss you", no streaks, no fake urgency. A countdown appears only for a real deadline set by a site, a buyer or the person ([frontend-standard, honesty](../product/frontend-standard.md#honesty)).

## Every event, and what it says

Money first, then the deadline, then the item. The title names the thing and the amount; the body says what the person keeps and by when. Plain words, no emoji ([Ben](../product/words.md#2026-11-15-standard-sizes-darker-dark-colors-deslop-skills-and-ban-all-emojis)), and checked by `node scripts/copy-lint.mjs`.

| Event | Level | Title | Body | Buttons |
|---|---|---|---|---|
| It sold | Now (*open*: today.md batches it; the research proposes immediate, recommended here) | Sold on Depop: the Carhartt jacket | You keep $31.40. Ship by Thu. | Print label |
| An offer you'd take, under an hour left | Now, Time Sensitive | $42 offer on the Carhartt jacket | You keep $36.70. Expires in 52 min. | Accept, Counter |
| An offer you'd take, more time left | Now | $42 offer on the Carhartt jacket | You keep $36.70. Expires tomorrow 6 pm. | Accept, Counter |
| Offers under your lowest price | Silent; one line in the digest | | "5 offers under your price, answered for you" | |
| Ship by today | Now, the morning of | Ship the lamp today | Mercari cancels it Fri 9 am if it isn't scanned. | Print label |
| A pickup within the hour | Now, Time Sensitive | Sam is coming at 6:30 | Library parking lot. $40 cash. | On my way, Running late |
| A buyer picked a meetup time | Now | Sam can do Mon 6:30 | Library parking lot, for the side table. | Approve, Suggest another |
| A buyer question the agent can't answer | Later (Now if an offer is waiting on it) | A question about the boots | "Are these real leather?" | Reply |
| A reply draft to approve (Draft for me) | Later | 3 replies to send | All about listings you've confirmed. | Review |
| A return, claim or dispute | Now | Return request: the Nike hoodie | Answer by Wed 5 pm or eBay decides. | Open |
| A delist failed after a sale | Now | The lamp is still up on Poshmark | It sold on Mercari. Take it down to avoid a second sale. | Try again |
| Two sales at once | Now | Two buyers paid for the lamp | Pick who gets it. Cancelling costs nothing on Mercari. | Open |
| The money arrived | Later | $31.40 is in your bank | From the Carhartt jacket on Depop. | |
| A watched item under your price | Now (*open* in the research; recommended: it may sell) | Brewers jersey, size L, $48 delivered | On eBay. Your top price is $60. | Open on eBay, Save |
| A watched item over your price, or a weak match | Later, in that want's digest | 4 new matches for the Brewers jersey | Cheapest $62 delivered. | |
| A site account needs signing in again | Later (Now if a sale or offer is waiting on it) | Sign in to Depop again | Your 6 listings there are paused until you do. | Sign in |
| A listing is slow (standing Stuck) | Silent; on the item and in the digest at most once a week | | | |
| The agent did something inside your limits | Silent | | | |

On the lock screen, a notification shows the item and the amount, never a buyer's message text or an address unless the person allows previews, because a phone on a table is seen by others.

## Acting from the lock screen

| Button | Needs unlocking? | Why |
|---|---|---|
| Accept, Approve, Counter | yes, Face ID | it commits the person to a sale or a meeting |
| Print label, Open, Reply, Review, Sign in | opens the app | it needs the screen |
| On my way, Running late | no | it only tells the buyer |
| Save | no | it only saves |

Each button runs the same act as the card in Today, with the same checks, so a stale notification cannot act (the card's version is checked).

## Grouping

- One thread per item: three offers on the jacket stack as one notification, "3 offers on the Carhartt jacket, best $45".
- A digest is one notification with a count and the most valuable line on top: "2 things for later: Sam asked about the boots, $31.40 arrived".
- A batch of the same action groups as one: "Ship 3 today" with Print 3 labels.

## Quiet hours and fatigue

- **Quiet hours** default to 22:00 to 8:00 local and can be changed. Nothing pushes inside them except a pickup within the hour the person approved. A deadline that falls inside quiet hours is pushed before they start ("Answer by 7 am: the return request").
- **A budget.** At most 3 Later pushes a day, and Now pushes are not capped because each is real.
- **Ignored kinds fall back.** If a kind is pushed 3 times and never opened, it moves to the digest, and the next digest says so in one line with Undo ("Moved 'watched items over your price' to the daily summary").
- **Pause selling** stops every seller push except orders already sold ([ways out](ways-out.md#everywhere)).
- **Estate** (open in [edge cases §4](edge-cases.md#4-not-knowing-what-it-is-a-relatives-things-a-pile-a-house)): items marked estate never get celebratory words.

## Defaults by what the person chose, not by asking who they are

The app never asks "which kind of seller are you?". The defaults follow from the choices the person already made ([price § Selling intents](features/price.md#selling-intents), [watch](features/watch.md)):

| They chose | Persona it serves | Pushes now | Waits for the digest | Silent |
|---|---|---|---|---|
| Sell it (default) | Clearing out | sale, offers you'd take, ship by, pickups | questions, money arrived | everything else |
| Gone fast | Fire sale | everything that moves a sale, including any offer at or over the floor | money arrived | standing |
| Best price | Holding a minimum | sale, offers at or over the floor | offers under it as one line | price drops are never automatic here |
| Only at my price | Holding a minimum | sale, an offer at their number | nothing else | everything else |
| Just checking | Testing the water | an offer at their number | how much interest there was, weekly | no nudge to sell, ever |
| A want | Hunting one thing | a match under their top price | matches over it | |
| Many live items (20 or more) | Reseller | sales, failed delists, returns, ship-by | everything else, as counts | |

Every default can be changed per kind in You > Notifications, which lists each kind with one example of what it would say, and the level it is at.

## Asking for permission

Onboarding asks once, at step 7, after the person has linked a site, and says the three things that interrupt (an offer you'd take, a deadline within the hour, a sale) and that the rest is batched ([pages §6.1](pages.md#61-first-launch-onboarding)). If they say no, Today is complete without push, and the first sale offers it again once: "Want to know the moment the next one sells?"

## How we will know it works

| Claim | Bar |
|---|---|
| People keep notifications on | at least 80% of people who allowed them still have them on after their first sale |
| Pushes are opened | Now pushes opened within an hour at least 60% of the time |
| Nothing urgent is missed | no deadline passes with its card unseen and its push unsent |

## Open for Ben and Nate

- A sale and a watched item under the price push at once (recommended), or wait for the digest as today.md has it.
- The digest times, and whether a person can choose one a day.
