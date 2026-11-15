# Pages: every screen, what it is for, and what feeds it

Status: *agent proposal*, written 2026-11-15 for Ben's ask to "clearly explain and can access the features needed for each section or page ... knowing when to split up features" ([words](../product/words.md#2026-11-15-the-new-button-gradients-that-carry-state-seller-intents-onboarding-and-build-ready)). This is the content and feature map the screens are built from. How a page looks (layout, color, motion) belongs to the UI loop ([frontend-standard §2](../product/frontend-standard.md#2-build-the-loop), the `ui-screen` skill) and the brand ([constitution](../brand/constitution.md)). Names, states, entities and endpoints are the canon's ([product.md](product.md)); a name this page needs and the canon lacks is listed in §8 and sent to Nate in [packet 47](../.agents/team/packets/team/47-what-the-pages-need-from-the-backend.md).

Decided structure this page keeps: the bar is Today · Sell · ＋ · Buy · You, and ＋ is the only way a thing gets in ([decision](../product/decisions.md#2026-11-14-the-bottom-bar-is-today--sell----buy--you)); messages sit behind a chat icon at the top right with a count ([decision](../product/decisions.md#2026-11-14-all-messages-live-behind-a-chat-icon-with-a-count)); first launch is setup first ([decision](../product/decisions.md#2026-11-14-first-launch-is-setup-first)); Sell is a photo grid in shelves by state ([decision](../product/decisions.md#2026-11-14-the-sell-tab-is-a-photo-grid-with-state-pills-numbers-live-in-you)); Buy mirrors it ([decision](../product/decisions.md#2026-11-14-the-buy-tab-mirrors-sell-with-shelves)); You leads with numbers ([decision](../product/decisions.md#2026-11-14-the-you-tab-leads-with-numbers-and-a-by-site-comparison)); the phone app comes first and the website does the same minus the camera and LiDAR ([decision](../product/decisions.md#2026-11-14-the-phone-app-comes-first-a-website-follows)).

## 1. When a feature gets its own page

A feature is not a page. Most features show up inside pages as a block, a field or a card (appraise is a Valuation on every item and match, [primitives](../product/primitives.md#what-this-buys)). These rules decide which container a thing gets:

| Container | Use it when | Examples |
|---|---|---|
| **Tab** | a place the person comes back to on their own, many times a week | Today, Sell, Buy, You |
| **Page** (pushed, with back) | a subject with its own question that holds more than one decision, or that a push or link must open directly | Item, Thread, Product, Want, By site |
| **Sheet** (slides up, returns you where you were) | one decision or one form, finished in under a minute, after which the person goes back to what they were doing | counter an offer, pick a selling plan, link a site, buy a label |
| **Block** (inside a page) | a fact or a small set of facts about the object the page is about | the Valuation, the standing line, the site row, the why timeline entry |
| **Card** (in Today or a list) | a Decision or a notice: something that asks for one tap or says one thing | an offer, a ship-by, value moved |

Split a page in two when any of these holds:

1. **Two primary actions compete.** The brand allows one black pill per decision and at most one per card ([C4](../brand/constitution.md)). If a page needs two, it is two subjects.
2. **The entry points differ.** If a push, a deep link or the website must land on part of a page, that part is its own page (a thread, a want, a product).
3. **A different person uses it.** Visitors see the product page and search, never the item page (market spec, [visitors](product.md#visitors-and-full-users)).
4. **It scrolls past three screens of unrelated subjects.** Move the least used subject behind a row with a chevron.

Merge two pages when they are the same query with a filter. "See all" on a Sell shelf is the Sell grid filtered, not a new page. Today is the open Decisions; All messages is every Conversation ([primitives](../product/primitives.md#what-this-buys)).

## 2. The map

```
First launch:  Welcome and sign-in → Your sites → Link each (sheet) → Bring in what we found → Pickups → Notifications → Today

Bottom bar:    Today        Sell          ＋ New         Buy            You
               │            │             │              │              │
               │            │             ├ Sell this ───┤              ├ By site
               │            │             ├ What's it worth             ├ What your things are worth
               │            │             └ Find this ───┘              ├ Goals
               │            │               (photos already taken: from │ Accounts ─ Link (sheet)
               │            │                the camera's photo button)
               │            │                   │                       ├ Automation ─ Rule log
               │            │                   ▼                       ├ Pickups
               │            │               Camera                      ├ Notifications
               │            │                   │                       ├ Your style
               │            │                   ▼                       ├ Records and tax
               │            ├──────────▶   Item (draft → plan → live → sold → done)
               │            │                   ├ Plan (sheet) ─ Post preview (sheet)
               │            │                   ├ Ship (sheet), Pickup (sheet)
               │            │                   └ Why (sheet)
               │                                                        │
               │                                     Search results ◀───┤ (text, camera, link)
               │                                     Product page  ◀────┤
               │                                     Listing (buy) ◀────┤
               │                                     Want (watch)  ◀────┘
Top right of every main screen: Messages ─ Thread
Website (signed out): Home · Search · Product page · Sign in. Signed in: every page above except the Camera, which is photo upload.
```

## 3. What every card and tile tells

Ben wants the color and the gradient to carry meaning that people learn without being told ([words](../product/words.md#2026-11-15-the-new-button-gradients-that-carry-state-seller-intents-onboarding-and-build-ready)), and Nate wants each listing's success score shown by color ([words](../product/words.md#2026-11-14-nate-the-system-runs-the-storefront-learns-the-person-and-scores-every-listing-with-one-success-score)). This section names *what* a card has to say. *How* it is encoded is the colors thread's and the brand's call. The brand has four state fills, and [Article 5](../brand/constitution.md) warns against a fifth (a warning, not a wall) because it can fail Ben's color vision. At 02:59 Ben said "dont weight to colorblindness too much" ([words](../product/words.md#2026-11-15-do-not-weight-color-blindness-too-much)), At 03:41 Ben chose red for Hot, like fire, with no glow ("feels too ai slop like"), and the same rule everywhere: a card's gradient comes from its state. The colors thread writes this into [constitution Articles 5 and 11](../brand/constitution.md#article-5-color); this section follows them.

**The five things a card can say, in the order a person needs them:**

| Facet | The question it answers | Values | Comes from | Encoding constraint (for the colors thread) |
|---|---|---|---|---|
| **Stage** | where is this thing in its life? | the canon `item.state` names: researching, review, live, stale, sold, handed_over, done, unsold, kept, returned, disputed, failed; "needs you" is derived (an open decision on the item), not a state | `item.state`, the Sell pill derivation ([spec/README](README.md#one-name-for-each-state)) | the four decided fills (sky live, mint sold, marigold needs you, lime paid) plus brick and gray; always with a word and icon |
| **Standing** | how is it doing against the market and against what I asked for? | hot, on pace, slow, stuck, still learning (names are a proposal) | the success score band judged against the person's intent ([score](features/score.md), [price §selling intents](features/price.md#selling-intents)) | never reuses a stage fill. Hot is red, like fire, with no glow; On pace shows nothing; Slow and Still learning are words in the caption; Stuck is a gray tag with a moon and the fact ("No views in 9 days"); Waiting for price is a plain Live tag with its word, never gray. The drawn form is in [constitution Article 5](../brand/constitution.md#article-5-color) |
| **Urgency** | do I have to do something, by when? | none, a deadline with time left | `decision.deadline`, `appointment.window`, the site's clock in [sites.mjs](sites.mjs) | the countdown in words ("3h 40m") stays, and nothing pulses. The card's gradient grows stronger as time runs out, at Ben's ask at 03:41; how much and when is in [constitution Articles 5 and 11](../brand/constitution.md#article-11-motion-sound-and-time) |
| **Money** | what do I get? | you keep $X; earned; could earn $A to $B | `offer.you_keep_cents`, `order`, `valuation` | ink weight and size, never a color |
| **Kind** | what is this about? | offer, question, ship, pickup, match, price drop, value moved, failed post | `decision.kind`, notice kind | the small kind tag Ben asked for (02:18) |

**What each persona looks at first on a card** (from [today research §1](../research/today/ben/today-wants-alerts-and-clickability.md#1-who-opens-the-app-next-to-what-they-already-use) and [user-wants](../research/cross-cutting/ben/user-wants.md)):

| Card | Clearing out (primary) | Young fashion seller | Flipper | Buyer with intent |
|---|---|---|---|---|
| Offer | you keep, then accept | the buyer's offer against the ask | margin over cost | n/a |
| Live item tile | is it gone yet (stage) | standing: is it hot | days listed, standing | n/a |
| Sold item tile | the ship deadline | the ship deadline | you keep | n/a |
| Match | n/a | n/a | under what it resells for | delivered price against my max |

**Standing words, mapped to the signals.** Ben's examples were hot, stale and sold; Nate's bands are strong, on track, needs attention, at risk. Sold is a stage, not a standing, so the two lists are different facets and both survive:

| Standing (proposal) | Nate's band | When | What the tap shows |
|---|---|---|---|
| Hot | strong, and interest rising faster than similar listings (`demand_rose`, offers or likes above peers of the same age) | the listing is ahead of plan | "3 offers in 2 days. Similar ones take 9." |
| On pace | on track | inside the plan's expected days | nothing extra; silence is the signal |
| Slow | needs attention, `item.state` stale | past the plan's patience with interest below plan | the one change worth the most, always with its consequence ("Lower to $44: sells about 6 days sooner"). A suggested price never goes below `floor_cents`; under the floor the move is `price_below_floor`, which always asks |
| Stuck | at risk | slow and the plan has run out of moves above the floor, or a site problem | the choices at the end of the plan (relist, lower past the floor, donate, keep) |
| Still learning | hidden score | too few comparable sales | what is being gathered |

Standing is judged against the intent the person picked. A listing set to "Only at my price" is never Slow or Stuck, it is "waiting for your price" ([price §selling intents](features/price.md#selling-intents)).

## 4. The top slot

**Decided** by Ben at 03:17 ([decision](../product/decisions.md#2026-11-15-the-top-of-today-shows-money-kept-since-you-last-looked-only-when-there-is-some)): the slot under the wordmark shows money kept since the person last opened the app, labeled ("Since yesterday", the amount, "2 sold, after fees"), and taps through to You. When nothing is new since the last open there is no slot. A new person sees their next setup step ("Link Depop"). Never $0.00. Totals and the weekly chart live on You.

The server picks so web and phone agree: `GET /v1/today` returns `headline {kind, value, label, sub, citation_id}` with `kind` `kept_since_last_open` or `next_setup_step`, or no `headline` at all. It needs `user.last_open_at`, set when Today opens (§8).

The other rows this map first proposed (on its way, goal, could earn, worth, watching, "What's it worth?" for nothing yet) are not in the slot. Their numbers belong on You, and "What's it worth?" stays the empty state's invitation in §6.2.

## 5. Today: one feed, ordered by what ignoring a card costs

Ben asked to debate stacking cards as a queue you tap to fan out ([words](../product/words.md#2026-11-15-the-new-button-gradients-that-carry-state-seller-intents-onboarding-and-build-ready)). The "Roll the UI system out everywhere" thread carried it to this shape ([today feed and card states](../research/today/ben/today-feed-and-card-states.md), *agent proposal* on Ben's card):

- **One feed in three tiers**, by what ignoring a card costs: `now` (money or a promise within a day), `when_you_can`, `good_to_know`. A label shows only where two tiers meet. Inside a tier, soonest deadline first.
- **Each decision kind has one form** when several are open: `single` (each carries its own deadline or risk, like `accept_offer`), `batch` (one action for all, like `buy_label`: "Print 3 labels"), or `queue` (each needs its own look and none is due within a day, like `first_post`; drawn as a stack with "1 of 40", opened one at a time full screen). Anything due within a day never stacks. The table of all 40 kinds is [§3 of that note](../research/today/ben/today-feed-and-card-states.md#3-every-card-kind-its-form-and-its-states).
- **Every card moves through the same states**: open, working (the pressed button shows the step from `job.stage`), done (leaves, with Undo), failed (stays, with what failed and Retry).

The tier and form are per kind and fixed, so the server sends them and web and phone agree: `tier` and `group_form` on each decision kind, and `group_key` and `group_rank` on each decision (§8).

## 6. The pages

Each page: what it is for and whom, where it opens from, what it shows in order, what you can do, what splits off, what feeds it, and the empty or first-run state. "Specced" means the endpoint is in [product.md §7](product.md#7-contract-conventions); "new" means it is asked of Nate in §8.

Each page's ways out (its own photos, no AI edits, by hand, not now, undo, without a site) are in [ways-out.md](ways-out.md), section by section.

### 6.1 First launch (onboarding)

The order is Ben's: accounts first, then the sites you use, then pickups and notifications ([decision](../product/decisions.md#2026-11-14-first-launch-is-setup-first), [words](../product/words.md#2026-11-15-the-new-button-gradients-that-carry-state-seller-intents-onboarding-and-build-ready)). Full behaviour, choices and failures are in [connect § Signing in to secondhand](features/connect.md#signing-in-to-secondhand).

| Step | Shows | Actions | Feeds | State on skip |
|---|---|---|---|---|
| **1. Welcome and sign-in** | the wordmark, one line on what it does, a 6-second loop of a photo becoming listings on five sites (the website's hero, in code) | Continue with Apple · Continue with Google · Continue with email (a 6-digit code) | new: `POST /v1/auth/apple`, `/google`, `/email/start`, `/email/verify` on the edge | cannot skip; a visitor on the website can search without it |
| **2. Your sites** | the five sites as logo tiles (eBay, Facebook Marketplace, Depop, Poshmark, Mercari; OfferUp and Grailed are a [future idea](../ideas/post-to-grailed-and-offerup.md), [Nate](../product/words.md#2026-11-14-nate-five-sites-offerup-and-grailed-are-a-future-idea-and-ebays-push-only-if-it-beats-our-harness)), each with one line of what we do there | tap the ones you use; Next | none (local) | Skip: no sites, scan and price still work |
| **3. Link each** | one sheet per picked site: eBay's own OAuth, or the site's real login shown live from the cloud browser; we never see the password | sign in; Not now | specced: `POST /v1/accounts` | the site stays unlinked; a quiet row in You > Accounts |
| **4. We found these** | "Found 41 listings on Depop" with their photos, and purchases where the site shows them | Bring them in · Not now | specced: `POST /v1/accounts/:id/import`; `merge_items` cards land in Today later | nothing imported |
| **5. Email for sales** | why: "Poshmark and Mercari tell you a sale by email" | Connect Gmail (read only) · Skip | specced: `POST /v1/accounts {site: email}` | sale detection reads the sold page only |
| **6. Pickups** | your pickup windows on a week strip, a public meetup spot on a map; or "Ask me every time" | set, skip | specced: `PUT /v1/limits` | asks the first time a pickup is needed |
| **7. Notifications** | the three kinds that interrupt (an offer you'd take, a deadline within the hour, a sale) and that the rest is batched | Allow · Not now | new: `PATCH /v1/me {notification_pref}`; Expo push token registration | batched only |
| **then Today** | empty Today with the next setup step in the top slot | | | |

Every step after sign-in says why it asks and can be skipped. Resume: `GET /v1/me` returns `onboarding {done_steps[]}` so a person who leaves at step 4 comes back to step 4 (new).

### 6.2 Today (tab)

| | |
|---|---|
| For | everyone; "what needs me, and how am I doing" |
| Opens from | launch, the tab, any push |
| Shows, in order | header (wordmark, messages icon with count) · the top slot (§4) · Decision cards in the three tiers of §5, single, batch or queue by kind · notices (value moved, demand rose, rule expiring) as rows ending in a chevron |
| Each decision card | kind tag, countdown when there is a deadline, photo with its site logo, one sentence, the money (you keep), the full action set with one black pill for the suggested option ([today spec](features/today.md)) |
| Actions | act on a card (one tap); open the card's item or thread; Edit the suggestion (does not count toward Always do this); Always do this when offered; dismiss a notice |
| Splits off | the item page, a thread, the Ship and Pickup sheets, Counter (sheet), the rule log (from You) |
| Feeds | specced: `GET /v1/today`, `POST /v1/decisions/:id/act`, `GET /v1/stream` (`decision.open`, `decision.close`, `job.stage`); new: `headline`, `group_key` |
| Empty | "Nothing needs you." with the top slot still showing |
| Features | today, messages, sold, price, list, watch, data (rules), insights (headline) |

### 6.3 Messages and a thread (top right)

| | Messages | Thread |
|---|---|---|
| For | anyone selling; "who's asking what" | one buyer about one listing |
| Opens from | the icon on every main screen; a push | a message row, an offer card, the item page |
| Shows | one row per conversation across sites: item photo, site logo, buyer's last line, unread dot; sent-for-you replies marked | the messages with "sent for you" on automatic ones; the offer bar (amount, you keep, the clock); the listing at the top; a scam banner when flagged |
| Actions | open; filter by item | reply (the agent drafts, you edit); accept, counter, decline; share address (Never alone, a separate tap); book a pickup; open on the site |
| Feeds | specced: `GET /v1/conversations` | specced: `GET /v1/conversations/:id/messages`, `POST .../messages`, `POST /v1/decisions/:id/act`; stream `message.new` |
| Empty | the empty list under its title, no sentence | n/a |
| Features | messages, trust, negotiation | messages, sold (pickup), trust |

### 6.4 New (the ＋)

Ben: a bigger center circle, more responsive, it shows its options in an animation because ＋ could mean several things, then animates into the camera ([words](../product/words.md#2026-11-15-the-new-button-gradients-that-carry-state-seller-intents-onboarding-and-build-ready)). The motion is the UI loop's; the content is:

| Option | Means | Camera opens in | Ends in |
|---|---|---|---|
| **Sell this** | I own it and want it gone | capture, full process for the type | the item draft |
| **What's it worth** | I own it, or I'm at a garage sale | appraise: the glance in 2 s, then the check | the Valuation card; Sell this, Keep it (just value it) or Bought it |
| **Find this** | I want one like this | search by photo | Search results |


Photos already taken (a folder or many from the camera roll) come in from the photo button inside the camera, not as a fourth choice, so the menu keeps three ([UI thread](../research/cross-cutting/ben/buttons-taps-corners-new-camera.md)); they split into one draft per group after `approve_groups`.

The last-used option is first. Holding ＋ (long press) skips the menu and opens the camera in the last mode. Feeds: none until the camera starts.

### 6.5 Camera

| | |
|---|---|
| For | getting a thing in with no thinking; "the app says take a big picture, take a back picture, take a tag picture" (Ben, [18:32](../product/words.md#2026-11-14-tools-and-capture)) |
| Shows | the live camera; on first use only, the tutorial as short animated steps like an ID check (Nate, [words](../product/words.md#2026-11-14-nate-capture-opens-on-the-type-pick-a-confident-suggestion-may-skip-the-tap-and-the-tutorial-is-animated-steps)); the type pick over the camera with the suggested type first; then the type's process one step at a time (a named frame, or a move-around ring with coverage); one instruction at a time with an outline or arrow; each kept shot with a 3 s undo; the voice button for talk mode |
| The analysis moment | Ben asked for something like an ID scanner verifying a face, a visible "it's working it out" ([words](../product/words.md#2026-11-15-the-new-button-gradients-that-carry-state-seller-intents-onboarding-and-build-ready)). What it must show is real: the outline it found, the text it read off the tag, each fact as a chip with a check when found and as a blank chip when it is not (the Leaving Blanks pattern, [assist](features/assist.md)), the comparison in words ("Matching against 214 sold jackets"), and the counts as they arrive (sources searched, similar listings found, prices weighed: the `found{}` fields, Nate's "show the work", [words](../product/words.md#2026-11-14-nate-the-ui-shows-the-work-animation-and-findings-as-they-arrive)). Never a fake progress bar. The visual is the UI loop's |
| After shooting | follow-ups only for what a camera cannot see (at most 3, each preselected where it can be); the free note (type or say anything: where you got it, why you're selling) |
| Actions | shutter (auto when the gates pass), change type, add photos, Generate (studio, off by default), talk mode, skip a step, finish |
| Splits off | nothing: one session, then the item draft |
| Feeds | specced: `POST /v1/captures`, `POST /v1/captures/:id/photos`, `PATCH /v1/captures/:id`, `POST /v1/captures/:id/finish`, `GET /v1/jobs/:id/events` |
| Phone only | the Swift camera module: auto-shutter gates, LiDAR, Object Capture. The website uploads photos instead |
| Features | capture, measure, identify, studio, assist (follow-ups), appraise |

### 6.6 Item (one page, five moments)

The item page is one page whose top half changes with the stage. It is the page most features feed. Splitting it by stage would put one item's facts in five places.

| Moment | Top of the page | The black pill | Below |
|---|---|---|---|
| **Researching** | the photos; stages filling in with real counts (identified, sales found, range ready) | none | fields arriving as they settle |
| **Review** | identity line (Confirmed once settled), the four facts to confirm (what it is, condition, price, ship or pickup) | Plan it | every field with where it came from (measured, from the tag, looked up, you said, not checked); tap to fix in place |
| **Live** | per-site row (logo, state pill, price, views, likes, offers where shown) and the standing line ("Cheapest of 9 like it. Should sell this week.") | the one change worth the most, if standing is Slow; otherwise none | the plan's next step ("drops to $42 on day 10"); Market block (similar sold, for sale now) |
| **Sold** | which site sold, you keep, proof the others came down (a logo per site with a tick, red if one failed) | Ship it, or Handed over for a pickup | the order's clocks (ship by, money arrives) |
| **Done, unsold or kept** | what it sold for and how long it took, or "kept, worth $A to $B" | Sell again (for kept or unsold) | the why timeline |

| | |
|---|---|
| Actions on any moment | edit a field (pushes to every live listing), Why? on any field or number, pause, end everywhere, mark where it is, set what you paid (optional, never asked) |
| Splits off | Plan (sheet), Post preview (sheet), Ship (sheet), Pickup (sheet), Why (sheet: the item's events with undo), the product page, a thread |
| Feeds | specced: `GET /v1/items/:id`, `PATCH /v1/items/:id/attributes/:name`, `GET /v1/scores?subject_type=listing`, `GET /v1/scores/:id/basis`, `GET /v1/events?item_id=`, `POST /v1/events/:id/undo`, `POST /v1/orders/:id/ship`, `POST /v1/orders/:id/handed-over`; new: `market_standing` on each listing (§8) |
| Features | item-card, identify, measure, studio, price, list, score, sold, market, data |

### 6.7 Plan (sheet, from the item)

The selling plan and the seller's intent in one sheet. Full model in [price §selling intents](features/price.md#selling-intents).

| Order | Shows | Actions |
|---|---|---|
| 1 | **What do you want?** five choices, each filled from sold data with its consequence: Sell it (default), Gone fast, Best price, Only at my price, Just checking | one tap |
| 2 | under the pick: "about 9 days, you keep $41" per site, and the sold prices as ticks on the price track | drag the price (the posture slider) |
| 3 | lowest you'd take (prefilled from sold prices, shown after them), and "Always accept $X or more" | edit either |
| 4 | the date for Gone fast; what happens if it doesn't sell (ask me, donate, keep, trade in, relist; relist is never offered on Poshmark). The end still arrives as a one-tap card with this answer already picked | set once |
| 5 | sites: the picked ones with one reason each; a skipped site greyed with its reason | add or skip a site |
| 6 | ship or pickup | pick |

Pill: Preview listings. Feeds: specced `POST /v1/items/:id/strategy`; new per-item `limits` fields `plan_choice`, `gone_by`, `fallback`, `accept_mode` (§8). Features: price, list, score, data (limits).

### 6.8 Post preview (sheet)

One stack of previews, one per site, each as that site shows it (title in its form, its photo order and count, its fields), with a dot where a site still needs a field. A failed recall check blocks the post and says why. Pill: Post to 4 sites. After: each site's pill moves Posting to Live; a failed site shows Retry, Edit or Skip. Feeds: specced `POST /v1/items/:id/listings`, stream `job.stage`. Features: list, studio, replay.

### 6.9 Ship and Pickup (sheets)

| Ship | Pickup |
|---|---|
| the site's label, box from the measurements, weight, the nearest drop-off, insurance when the price is above the carrier's cover; batch labels when several are due | the booked time inside your windows, the saved spot, "On my way" from the buyer, Share address (Never alone), Running late, No-show (rebook, next in line, relist) |
| specced: `POST /v1/orders/:id/ship`, `POST /v1/orders/labels`, `GET /v1/orders/pick-list` | specced: `GET /v1/appointments`, `POST /v1/decisions/:id/act` |

### 6.10 Sell (tab)

Shelves by state, each scrolling sideways with a count and "see all": Needs you, In progress (researching, review), Live, Sold (to ship first), then Unsold and Kept folded at the bottom. Needs you is derived from open decisions; the other shelves are `item.state` names. Each tile is the photo with its stage tag, its standing where it is live, and site badges. Sort and filter by site and kind in the shelf header (Ben, [round 10](../product/words.md#2026-11-15-round-10-picks): "live vs needs you vs sold are all the same primitive. then things like type or marketplace"). Feeds: specced `GET /v1/items`; stream `state.change`, `score.change`. Empty: the ＋ is the only thing to point to. Features: item-card, list, score, sold.

### 6.11 What's it worth (the appraisal result)

A page, because it is reached from three places (＋, the Buy camera, a pasted link) and the website. Shows: what it is and a rough range in 2 s labelled rough; the recall check; the check in 10 s (for a buyer: Buy, Offer, Skip or Unsure, "Pay up to $40"; for an owner: what you'd keep per site); the one thing to check ("Check the zipper works"); the haggle pad (type the seller's price, offline); cheaper equivalents; for an owner, Sell, Trade in or Donate side by side. Actions: Sell this, Keep it (just value it), Bought it, Find more like this, Deep research. Feeds: specced `POST /v1/valuations`, `GET /v1/jobs/:id/events`. Features: appraise, price, identify, market.

### 6.12 Buy (tab)

The search box (text, a camera icon, a pasted link) on top, then shelves: New matches, Watching, For you (opt in), Bought. Assist marks the words in a typed search it made a guess about and opens a fitted control under each (Garlic's research on Bruce Liu's posts, [packet 41](../.agents/team/packets/today/41-intra-turn-ui-for-nate.md); [assist](features/assist.md)). Feeds: specced `GET /v1/wants`, `GET /v1/wants/:id/matches`, `POST /v1/assist`. Features: buy, watch, assist, market.

### 6.13 Search results

Sites fill in as they answer, with the real counts. On top: what it is, the new retail price where sold new, the fair used range per site. Then one list across the five marketplaces and official stores, ranked by delivered total against the fair range, each with its match label, condition, site and delivered price; the better official option beside a used one when it wins. Actions: open on the site (with a referral), save, watch this search, offer or ask (full users; every offer asks). Feeds: specced `POST /v1/search`, `POST /v1/compare`, `GET /v1/out`. Visitor allowed. Features: buy, market, score, assist.

### 6.14 Listing (buy side) and Want

| Listing | Want |
|---|---|
| one listing against the product's other offers: price against the fair range, delivered total, what it confirms and what it doesn't state, the seller's site protection, fit by measurements for clothes | the text, the fitted inputs (size, condition floor, radius), the most you'd pay delivered with the fair range under it, sites, checked times per site, quiet hours, pause or end |
| Open on site · Save · Offer (asks every time) · Ask the seller · Bought it | Save · Pause · End |
| specced: `POST /v1/compare`, `POST /v1/matches/:id/act` | specced: `POST /v1/wants`, `PATCH /v1/wants/:id` |

### 6.15 Product page

One per product, for visitors and users: what it is, used price per site (sold and asking apart), for sale now and median days to sell, price history new against used, cheaper equivalents, every offer in one list, the better official option, Follow. Feeds: specced `GET /v1/products/:id`, `/history`, `/v1/trends`. Features: market, score.

### 6.16 You (tab) and its pages

| Page | Shows | Feeds (specced unless marked) |
|---|---|---|
| **You** | worth of what you kept (the `kept` items), on its way, could earn; sold count; goal bar if set; By site card; then the settings list | `GET /v1/insights` |
| **By site** | each site as a storefront: days to sell, share of asking, funnel where the site shows it, what sells best there | `GET /v1/insights` (`funnel[]`, `reliability[]`) |
| **What your things are worth** | every owned, kept and live item with its range and how it moved this week | `GET /v1/insights` |
| **Goals** | money and count this month, progress | `PUT /v1/goals/:month` |
| **Accounts** | each site: health pill, what runs there and what opens the site instead, last checked, the risk line, Link or Relink | `GET /v1/accounts` |
| **Automation** | each rule as when, if, then, with its log and undo; Ask, Auto and Never alone shown as such | `GET /v1/rules`, `GET /v1/events` |
| **Pickups** | windows, saved spot, Ask me every time | `GET`, `PUT /v1/limits` |
| **Notifications** | per kind: push now, batch, off | new: `PATCH /v1/me {notification_pref}` |
| **Your style** | what it learned from what you sell, keep, save and buy, each with its reason; edit or remove | new: `GET`, `PATCH /v1/me/style` (`style_profile` exists in the canon, its endpoint does not) |
| **Records and tax** | the year's sales, fees, costs, a CSV (a PDF is not specced yet; asked in §8) | `GET /v1/records` |
| **Account** | sign-in method, sign out, export, delete | `POST /v1/me/export`, `DELETE /v1/me`; new: `POST /v1/auth/signout` |
| **Ask** | questions over your sales in words (Genie) | `POST /v1/genie` |

### 6.17 The website

Ben wants the site built in tandem with the app and alive, not static ([words](../product/words.md#2026-11-15-every-feature-the-ui-builds-for-the-site-in-tandem-and-image-runs-rate-limited)). Signed out it is Home (the product's own flow playing as the hero in code: a photo becoming listings on five sites, [bold-and-alive](../research/cross-cutting/ben/bold-and-alive.md)), Search, Product pages and Sign in; a visitor can search and open product pages ([visitors](product.md#visitors-and-full-users)). Signed in it has every page in §6 except the Camera, which is photo upload, and talks to the same `/v1` API. How it is built in parallel with the app is in [plans/parallel-build.md](plans/parallel-build.md).

## 7. Where features split, at a glance

| Feature | Its own page | Inside other pages as |
|---|---|---|
| today | Today | the top slot; stacks |
| connect | Accounts; onboarding steps | relink and site warning cards |
| item-card | Item | tiles in Sell, rows in Messages |
| capture, measure | Camera | measurements on the item; the box size in Ship |
| identify | none | the identity line; clarify inputs in the camera and item |
| studio | none | Generate in the camera; improved photos marked on the item and preview |
| price | Plan (sheet) | the Valuation block; standing line; you keep on every offer |
| appraise | What's it worth | the Valuation on every item and match |
| list | Post preview (sheet) | per-site rows on the item |
| replay | none | invisible; failures show as a red site pill |
| sold | Ship and Pickup (sheets) | the Sold moment on the item; ship-by cards |
| messages | Messages, Thread | offer cards in Today |
| watch | Want | New matches, Watching shelves; match cards |
| buy | Buy, Search results, Listing | Bought shelf; replace after sale card |
| market | Product page | the Market block on the item |
| insights | You, By site, Worth | the top slot |
| score | none | standing on every tile and item; axes on tap |
| assist | none | marked words and fitted inputs under any text box |
| data | Automation | Why sheets and undo everywhere |

## 8. What the pages need that the canon does not have yet

Sent to Nate as [packet 47](../.agents/team/packets/team/47-what-the-pages-need-from-the-backend.md) with shapes. Until a row lands in [product.md](product.md), the app mocks it from the example in the packet.

| Need | For | Shape |
|---|---|---|
| App sign-in: Apple, Google, email code; session and refresh | onboarding, every call | `POST /v1/auth/{apple,google}`, `POST /v1/auth/email/start`, `/email/verify`, `POST /v1/auth/refresh`, `POST /v1/auth/signout` |
| Onboarding progress | resume onboarding | `GET /v1/me` (a new route) with `user.onboarding {done_steps[], finished_at?}` and `auth_methods[]`; `PATCH /v1/me {onboarding_step}` adds a step ([connect](features/connect.md#signing-in-to-secondhand)) |
| Push token and notification prefs | Notifications | `PATCH /v1/me {notification_pref[], push_token}`; `notification_pref[]` already exists on `user`, only the write is new |
| A second sign-in method | You > Account | `POST /v1/auth/link/{apple,google,email}` |
| Web sessions | the website | cookie or token storage on the web, CORS for the site's origin, Apple and Google web client ids (the edge's call) |
| Push deep links | every push | `{kind, decision_id?, item_id?, path}` in the push payload, so a tap opens the right page |
| The top slot (decided) | Today | `headline {kind, value, label, sub, citation_id}` on `GET /v1/today`, `kind` `kept_since_last_open` or `next_setup_step`, absent when nothing is new; `user.last_open_at`, set when Today opens |
| Tiers and stacks | Today | per decision kind: `tier` (`now`, `when_you_can`, `good_to_know`) and `group_form` (`single`, `batch`, `queue`); per decision: `group_key`, `group_rank`; nothing due within a day is grouped |
| Facts one at a time, and the comp count, while the camera is open | Camera | a `fact.found` frame per attribute (name, value or blank, source) and `found.comps` on the identify and valuate job streams |
| Seller intent | Plan, standing, every automatic move | on `limits` per item: `plan_choice`, `gone_by?`, `fallback`, `markdown_on`, `accept_mode`, `review_at?` ([price](features/price.md#selling-intents)) |
| Standing | tiles, item, Today | `listing.market_standing {word, place {rank, of}, outlook, fix?, citation_id}` (not `standing`, which the canon's `strategy` already uses for its standing levers), judged against the intent ([score](features/score.md#standing-against-the-market)) |
| Style profile endpoint | Your style | `GET`, `PATCH /v1/me/style` |
| The five choices with their consequences | Plan sheet | a read of each choice's days and you-keep from sold data before one is picked, e.g. `GET /v1/items/:id/plan-choices`, and per-site sold prices for the ticks |
| Why the camera opened | Camera | a purpose on the capture (`sell`, `appraise`, `find`) beside the canon's `capture.mode` (shots, scan, talk) |
| Talk mode | Camera | a realtime session for talk mode (token and transport) |
| "We found these" | onboarding import | a preview of a site's listings before import, e.g. `GET /v1/accounts/:id/import-preview` |
| A visitor's search | signed-out Search | job events for a visitor (`/v1/stream` is signed-in only) |
| Needs you per item | Sell shelf | the open-decision count and top kind on each item in `GET /v1/items` |
| Records as a PDF | Records and tax | `format=pdf` on `GET /v1/records`, or drop it |
| One name for the relink card | Today, Accounts | the canon says `relink`; packet 3.6 of the protocol engine says `account_stale`; pick one |

## 9. Everything you asked for that the pages must carry

Ben, 02:52: "theres a lot i probably missed so i need to know again. all the features the ui should build for" ([words](../product/words.md#2026-11-15-every-feature-the-ui-builds-for-the-site-in-tandem-and-image-runs-rate-limited)). Each line is something Ben said, where it lands, and whether a page above holds it yet. Decided items are in [decisions.md](../product/decisions.md) and not repeated.

| What Ben asked for | Said | Lands on | Held above? |
|---|---|---|---|
| Build every feature, don't trim scope | [18:07](../product/words.md#2026-11-14-scope) | every page | yes |
| An Amazon-style search box across every secondhand market | [search box](../product/words.md#2026-11-14-search-box) | Buy, Search results | yes |
| Appraise at a garage sale: what to pay, value per site after defects | [pavlo and appraise](../product/words.md#2026-11-14-pavlo-and-appraise) | What's it worth, the haggle pad | yes |
| A guided shot list where the person does no thinking; shots serve both the listing and the model | [tools and capture](../product/words.md#2026-11-14-tools-and-capture), [shots serve both](../product/words.md#2026-11-14-shots-serve-both) | Camera | yes |
| Measuring first for clothes; LiDAR for rigid things | [tools and capture](../product/words.md#2026-11-14-tools-and-capture) | Camera, Item fields, Ship box size | yes |
| Studio relighting with real photos kept; touch up, never change the environment | [photos touch up](../product/words.md#2026-11-14-photos-touch-up-never-change-the-environment) | Camera (Generate), Item photos, Post preview | yes |
| Photo tweaks without generation, and a photo score | [photo tweaks](../product/words.md#2026-11-14-photo-tweaks-without-generation-and-a-photo-score) | Item photos, Post preview; the fix line in standing | partly: the score feeds standing; no page shows the tweak itself yet |
| Talk to the camera: a video decision tree with spoken, friendly lines also shown on screen | [live video](../product/words.md#2026-11-14-live-video-you-can-talk-to), [decision tree](../product/words.md#2026-11-14-video-capture-as-a-decision-tree), [capture voice](../product/words.md#2026-11-14-capture-voice-frame-quality-measuring-skipping-and-video-storage) | Camera, talk mode | yes, as the voice button; its screen is a wave 1 page in the loop |
| Notify me when something is available or under a price, from a sentence | [human in the loop and dynamic ui](../product/words.md#2026-11-14-human-in-the-loop-and-dynamic-ui) | Want, New matches, match cards | yes |
| Dynamic, intelligent UI from a large set of components; questions as buttons, not a chatbot | [human in the loop and dynamic ui](../product/words.md#2026-11-14-human-in-the-loop-and-dynamic-ui) | assist under every text box; Garlic's research on Bruce Liu's posts ([packet 41](../.agents/team/packets/today/41-intra-turn-ui-for-nate.md)) | yes, in Buy, Camera follow-ups and Plan |
| Human in the loop, visible to judges | [human in the loop](../product/words.md#2026-11-14-human-in-the-loop-and-dynamic-ui) | Today cards, Automation, Why sheets | yes |
| Understand loading for cloud jobs | [studio edit loop](../product/words.md#2026-11-14-studio-edit-loop-cloud-jobs-and-loading) | the researching moment, the analysis moment, Post preview | yes |
| Know when an item is hot; levers per platform | [pricing levers](../product/words.md#2026-11-15-pricing-levers-signals-and-hot-items) | standing (Hot), the fix line | yes |
| Code that knows each app's rules (a Depop offer clock is one fact) | [the code understands each app](../product/words.md#2026-11-15-the-code-understands-each-app) | every countdown reads [sites.mjs](sites.mjs) | yes |
| Logging of everything | [logging](../product/words.md#2026-11-14-logging-of-everything) | every page logs through [log/](../log/README.md) | yes, by the build skill |
| A website with sign-in, same features, photo upload | [app first](../product/words.md#2026-11-14-app-first-and-ui-factory-after-the-brand) | §6.17 | yes |
| AI images allowed on the website if masked and touched up | [the ui loop](../product/words.md#2026-11-14-the-ui-loop) | the website's Home and feature shots | yes, in [parallel-build §5](plans/parallel-build.md#5-generated-images-allowed-and-rate-limited) |
| Messages that make you perk up, not slop | [dark mode approved](../product/words.md#2026-11-15-dark-mode-approved-the-size-system-everywhere-clickability-money-and-countdowns-color-blind-checks) | Notifications step; the push rules | yes |
| Countdowns for time; money that stands out; a kind tag on each card | the same | §3, Today | yes |
| Clickability: a card that leads somewhere looks it | the same | every card and row | for the UI loop |
| The handoff hand, and a snap sound on a sale | [round 10](../product/words.md#2026-11-15-round-10-picks) | the Sold moment on the item | yes, as the moment; the asset is the brand thread's |
| Real data over made-up data in demos | [real data](../product/words.md#2026-11-15-real-data-over-made-up-data-and-what-the-voice-pairs-mean) | the contract examples and the mock | yes |
| A bigger ＋ that shows its options, then opens the camera | [02:46](../product/words.md#2026-11-15-the-new-button-gradients-that-carry-state-seller-intents-onboarding-and-build-ready) | §6.4 | yes |
| An ID-scanner-style analysis moment in the camera | 02:46 | §6.5 | yes |
| Gradients and colors that say hot, stale, sold, learned over time | 02:46 | §3 | yes, as content; the colors thread draws it |
| Seller intents: a minimum, a fire sale, keep unless my price | 02:46 | Plan, standing | yes |
| Onboarding: Apple, Google, email, then the sites you use | 02:46 | §6.1 | yes |
| Stacked cards that fan out | 02:46 | §5 | yes |
| "Earned this week", dynamic, no $0.00 for a new user | 02:46 | §4, decided as money since you last looked | yes |
| Button sizing, tap areas, the countdown's inset from the corner | 02:46 | the UI system | no: these are rules for the "Roll the UI system out everywhere" thread, not page content |
| Treg, more marketplaces, hot-items pricing model, own page monitor | [ideas board](../ideas/README.md) | after the product works | not in scope here |
