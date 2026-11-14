# Today
Status: draft, *agent proposal* except where a line links a decision. Slug: today. Written 2026-11-14.

The hassle: a seller on five sites has to open five apps to learn that an offer expires in an hour, a label must be printed by tomorrow, and a buyer is waiting on a pickup time. The costliest misses are a shipping deadline, a return claim, or accepting the wrong offer ([user-wants.md](../../research/cross-cutting/ben/user-wants.md)). Today is one list of what needs the person, soonest deadline first, and a quiet record of what was done for them ([today-rework](../../research/today/ben/today-rework/README.md)).

## What the person does and sees

| Step | What happens |
|---|---|
| 1. Open the app | Today is the first tab ([decision](../../product/decisions.md#2026-11-14-the-bottom-bar-is-today--sell----buy--you)). Wordmark top centre, chat icon top right ([decision](../../product/decisions.md#2026-11-14-all-messages-live-behind-a-chat-icon-with-a-count)). |
| 2. One list | Open decisions in one list, ordered by deadline. No "needs you" and "handled" split: Ben called that count "zero sense" ([today-rework](../../research/today/ben/today-rework/README.md)). |
| 3. A card | Item photo, one sentence ("Jamie offered $38"), one line of context ("You asked $45. Similar jackets sold for $36 to $52 lately."), site logo and deadline, one primary action, one secondary, and ··· for the rest of the full action set ([structure-references.md](../../research/today/ben/structure-references.md)). |
| 4. Act | Tapping the primary collapses the card with an Undo toast for about 5 s; the action is sent after the toast or at once if the deadline is under a minute away. |
| 5. Done for you | Under the list, one quiet line per kind ("Answered 'Is it still available?' for 4 buyers. See replies"). Tapping opens the log, each row with Undo where the site allows. |
| 6. Money | One quiet line for payouts and sales, and goal progress when a monthly goal is set ([words](../../product/words.md#2026-11-14-nate-frameworks-and-goals)). |
| 7. Why? | Every card and every log row has "Why?", opening the timeline of what the agent read, judged and checked. |
| 8. Always do this | After the third unedited approval of the same kind, the card offers "Always do this", with the limit in words ("Accept offers of $40 or more on this jacket"). Locked kinds never offer it. |
| 9. Empty | The one next step ("Photograph something to sell"), never a celebration screen. |

Where Ben's design stumbles: a 5 s undo toast on an offer that expires in seconds would lose the sale, hence the exception in step 4. An "Accept $38" card shown without what the seller keeps invites accepting the wrong offer; the context line carries `you_keep` when fees differ by site. What the backend allows that the design does not yet use: since every decision carries `item_id`, offers for the same item on several sites can merge into one card ("Two offers on the jacket: keep $34 on eBay, $36 on Depop").

## What it reads and writes

| Entity | Use |
|---|---|
| `decision` | Read: open ones for the user. Written: `answered_at, option_id, edited, seconds_on_card, opened_detail` |
| `rule` | Read for "Always do this" eligibility; written on promotion, expiry, demotion |
| `event` | Read for the log (actor `auto`), written on every act and undo |
| `item`, `photo`, `listing`, `offer`, `order`, `appointment`, `match`, `goal` | Read for card payloads, never written here except through the act route |
| `limits` | Read to word the context line; edited from the card's ··· ("Change lowest price") |

Approvals and edits are written as MLflow labels on the trace ([generative-ui.md](../../research/today/ben/generative-ui.md)).

## States

Decision (*agent proposal*): `open → acting → done | failed | expired | superseded`. `superseded` when the world changed first (the item sold elsewhere, the buyer withdrew); the card then shows what happened with one action (Decline or Dismiss). `acting → failed` reopens the card with the error.

Rule: `ask → eligible (3 unedited approvals, the gates in [MO](../../research/messages/ben/messages-and-offers.md)) → auto → expired (14 days unused) | demoted (on any undo)`.

## Systems underneath

| Piece | Job here |
|---|---|
| App API (FastAPI on Apps) | Ranks and serves the list, the act route, the log |
| Lakebase | `decision`, `rule`, `event` truth; SSE pushes a new or changed card |
| Every feature's jobs | Create decisions; Today never polls sites itself |
| Plain code | Rank: money or sale lost soonest, then locked kinds, then ask, then age. The agent proposes a deadline, never the rank ([generative-ui.md](../../research/today/ben/generative-ui.md)) |
| Notification service (Expo push) | Sends only what the rule below allows |
| MLflow 3 | Traces become the "why?" timeline; approvals are labels |
| Marketplace adapters | Execute the chosen option, read back to confirm |

What arrives, from where:

| Source | Decision kind |
|---|---|
| [messages](messages.md) | `offer, below_floor, reply_draft, pickup_time, address_share, scam_warning, dispute` |
| post, connect | `failed` (a post, delist or login that did not go through) |
| sold | `ship_by, return_claim, refund, cancellation, no_show, dibs, dibsLost` |
| capture, item research | `draft_ready, clarifying_question` ("Is the zip original?") |
| price | `markdown_suggested` when outside limits; inside limits it is a log row |
| buy | `match, offer_to_seller` |
| goals | `goal_progress` (no deadline; sorts last) |

## Contract for the frontend

| Endpoint | Returns |
|---|---|
| `GET /v1/today` | `{decisions:[...], done_for_you:[{kind, count, label, log_url}], money:{paid_out_cents, currency, goal?}}` under 300 ms |
| `GET /v1/today/stream` | SSE: `decision.added, decision.changed, decision.removed` |
| `POST /v1/decisions/:id/act` | `{option_id, signature, item_version, edit?}` → `job`; 409 `{code:"stale"}` returns the fresh card |
| `GET /v1/log?cursor=` | `[{event_id, item, action, at, undo:{allowed, until}}]` |
| `POST /v1/actions/:event_id/undo` | `job`, or 409 `{code:"site_no_undo"}` |
| `POST /v1/rules` | `{from_decision_id}` creates the rule; 403 for locked kinds |
| `GET /v1/decisions/:id/why` | `[{step, at, read[], judged, checked, result}]` from the trace, no message text |

A card is the frame's decision object plus `card:{photo_url, sentence, context, site, deadline}` and `kind_payload` per kind ([generative-ui.md](../../research/today/ben/generative-ui.md)). An edited option is signed as a new user-authored option and does not count toward promotion ([decision](../../product/decisions.md#2026-11-14-always-accept-is-offered-at-listing-and-only-unedited-approvals-count)).

Full action set per kind (primary first):

| Kind | Payload | Actions |
|---|---|---|
| `offer` | site, buyer, amount, asking, you_keep, expires_at | Accept, Counter $X, Decline, Reply, Always accept $X or more |
| `below_floor` | amount, lowest, you_keep | Counter at lowest, Accept anyway, Decline |
| `reply_draft` | question, draft | Send, Edit, Not now, Always do this |
| `pickup_time`, `address_share` | proposed, hours, spot | Accept, Offer my hours, Decline; Share address, Keep spot |
| `scam_warning` | reason | Block buyer, Reply with safety line, Ignore |
| `ship_by` | order, deadline, label | Print label, Mark shipped, Ask for more time |
| `return_claim`, `dispute`, `refund` | order, claim, deadline | Open on site, Reply, Accept return |
| `cancellation`, `no_show` | order | Relist, Message buyer, Keep |
| `failed` | step, error | Retry, Fix, Leave it |
| `dibs`, `dibsLost` | site, buyer | Hold, Release; Relist |
| `draft_ready` | item, valuation | Post, Edit, Not now |
| `clarifying_question` | question, choices | each choice, I don't know |
| `markdown_suggested` | from, to, reason | Lower to $X, Keep, Change lowest price |
| `match`, `offer_to_seller` | match, price, ceiling | Open on site, Save, Not this; Send offer, Change, Skip |
| `goal_progress` | goal, earned | Dismiss, Change goal |

## Who may act

| Action | Mode |
|---|---|
| Any option on a card | the person, through the signed act route |
| Undo of an auto action | the person, where the site allows |
| Promote to "Always do this" | the person, after 3 unedited approvals; never for home address, payment and refunds, moving off the site, below the lowest price, or completing a purchase ([decision](../../product/decisions.md#2026-11-14-automation-runs-in-tiers-that-learn)) |
| "Always accept $X or more" | the person, at listing or from an offer card, no wait for 3 approvals ([decision](../../product/decisions.md#2026-11-14-always-accept-is-offered-at-listing-and-only-unedited-approvals-count)); what changed: earlier plans required 3 approvals first ([decision](../../product/decisions.md#2026-11-14-accepting-offers-at-or-above-a-set-amount-can-be-promoted-per-item)) |
| Notification | the system, under the rule below |

Notifications (*agent proposal*): only when there is something to know or decide ([research-session-digest.md](../../research/cross-cutting/nate/research-session-digest.md)). Push at once for an offer at or above the lowest price, a deadline within 2 h, a pickup today, a scam warning; the rest in a digest about 3 times a day, the default offered at setup, untested for sellers ([psychology.md](../../research/cross-cutting/ben/psychology.md)). Approve from the notification for kinds that are not locked. Nothing is pushed for auto actions.

What changed: the feature page asked "which actions can skip the inbox"; today's decisions answer it ([decision](../../product/decisions.md#2026-11-14-buyers-are-handled-inside-limits-you-set-then-it-learns)).

## How it fails

| Failure | What the person sees | Recovery |
|---|---|---|
| Act after the world changed | Card refreshes to its new state (409) | One tap on the fresh card |
| Execution fails on the site | Card reopens: "eBay did not take the counter" | Retry with the same idempotency key |
| Undo not allowed by the site | Log row says so; no Undo button shown | none |
| Deadline passes unanswered | Card turns `expired`, one log row | none; an expiry push 2 h before |
| Today slow or offline | Skeleton under 1 s, then the cached list marked with its time | Poll on reconnect |
| Push fails | The card is still in Today | none |

## How we will know it works

| Claim | Check |
|---|---|
| Nothing missed | Zero ship-by or return deadlines passed in `event` while the user opened Today in the prior 24 h |
| Approvals mean something | Share of unedited approvals under 2 s stays low; if high, promotion is rubber-stamping ([handled-by-default.md §7](../../research/messages/nate/handled-by-default.md)) |
| Learning happens | A third or more of ask kinds reach promotion within 4 weeks |
| Fast | `GET /v1/today` p95 under 300 ms on real accounts |
| Quiet | Pushes per active user per day, and the share opened |
| Undo is safe | Every undo in `event` matched by a site read-back |

## Facts that constrain it

| Fact | Source |
|---|---|
| Offer windows (24 h on most sites) and acceptance that charges at once on Mercari | [MO](../../research/messages/ben/messages-and-offers.md), *observed* |
| Return and claim windows per site | [trust-returns-disputes.md](../../research/sold/nate/trust-returns-disputes.md) |
| Batched notifications for sellers are untested | [psychology.md](../../research/cross-cutting/ben/psychology.md), *inferred* |
| Lakebase drops LISTEN/NOTIFY; SSE plus polling | [databricks-platform.md](../../research/data/nate/databricks-platform.md), *observed* |
| Never log message text or addresses | [spec/README.md](../README.md) |

## Demo path

For Ben and Nate to mark.

## Open for Ben and Nate

1. **"Always say first to pay"** for dibs on Depop: Ben raised it ([generative-ui.md](../../research/today/ben/generative-ui.md)). Recommendation: allow, since paying settles it. Depends: the `dibs` kind and the lifecycle "paid beats dibs" line.
2. **Merge offers across sites into one card?** Recommendation: yes, ordered by what the seller keeps. Depends: the card payload.
3. **Approve from the notification for money kinds?** Recommendation: yes for accept at or above the lowest price, no for anything locked. Depends: signed options in push payloads.
4. Earning: a daily digest of what was handled is where a paid tier would be felt; note only.

## Needs from the shared model

- A decision state list (`open, acting, done, failed, expired, superseded`) and the kind names above as one shared list.
- New kinds `clarifying_question`, `goal_progress`, `markdown_suggested`, `ship_by`, `return_claim`, `cancellation`, `no_show`, `draft_ready`, `match`, `offer_to_seller`, beside lifecycle's `failed, refund, dibs, dibsLost`.
- A `notification` rule (push now, digest, never) per kind.
- A log view over `event` (actor `auto`) with an undo window per action and site.
