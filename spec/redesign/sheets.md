agent proposal, written by Codex 2026-11-15 at Ben's ask (10:27, 10:30)

# Sheets and short decisions

This is a design specification, not a screen implementation or an approved change to the page map. It covers Plan, Post preview, Ship, Pickup, New, and all five requested kit files. Source locations refer to the files read on 2026-11-15. Another session is changing screens, so match the named element as well as the line before building.

The person is usually a casual seller clearing things out, sometimes a fashion seller or reseller, or a buyer making an offer. They visit these surfaces at a particular decision, not to browse a dashboard. They would say “finish this step”; the inferred want is to finish without committing the wrong price, publishing the wrong facts, buying the wrong label, or sending the wrong place or time. This reading follows the supplied owner quotes and the existing ways out, rather than new user research.

The common answer is a tall sheet containing everything related to the task. Keep the familiar bottom presentation, but replace the collection of unrelated controls with one form or one decision. Supporting subjects stay reachable through existing disclosure rows. No feature is removed merely to shorten a sheet.

## Authority and conflicts

Read in the requested order: UI constitution and frontend standard; brand constitution and coder card; primitives and pages; copy and clean-copy; Appllama and the specified Emil skills; ui-screen; then code. The supplied 10:27, 10:30 and 10:08 quotes are the direction for this proposal. The earlier requested source wins a disagreement.

| Conflict | Resolution for this lane |
|---|---|
| `spec/pages.md` §6.7 calls Plan a sheet but places intent, price, automatic acceptance, endings, sites and handover there | Apply §1's one-decision test. Plan chooses a selling plan. Separate forms hold its adjustments. Preserve §6.7's capabilities and preview action. |
| §6.9 calls Ship and Pickup sheets; their code uses `Screen` and `Nav` | The label is not evidence of sheet behavior. Convert the short decision to the common sheet; split supporting tasks as specified below. |
| §6.9 and §6.16 still mention saved pickup windows | Stale against Ben's explicit no-fixed-windows decision in `product/decisions.md:17`. Choose days and spans when arranging this pickup; do not read a calendar. Existing booked time and saved public place remain useful. |
| `product/primitives.md` says price can never be covered by a Rule; Plan and later decisions support automatic changes within limits | Do not settle automation policy here. Preserve the current canonical allowed modes and locked exceptions, show exact consequences, and require the below-minimum tap. Reconciler must resolve the primitive sentence with the product canon. |
| Appllama calls for SF Symbols, system faces, semantic system colors, and no mesh heroes; Emil proposes glass and weight emphasis | Keep the earlier brand's Hugeicons, Neue Montreal 500, Clofie roles, tokens, opaque sheet ground and chosen New field. Borrow navigation, manipulation and recovery, not their visual systems. |
| Appllama's native-controls reference suggests colored input errors; brand forbids colored text on white except alerts | Error text stays readable ink beside the brick alert icon. |
| Emil gestures defaults to Vaul and describes a 500 ms curve; Appllama offers 400 ms springs and custom scroll headers | This is React Native. Reuse the kit, 300 ms sheet entry and 200 ms exit, and no custom scroll animation, per the earlier standard. Do not introduce a web drawer dependency. |
| Appllama says active-tab retap pops its stack; this request asks for scroll-to-top behavior | A sheet has no tab bar. Retaps cannot reach the obscured bar. The underlying lane owns its root scroll-to-top rule. Do not pop or discard sheet input through a background tab event. |

The named reference jobs are iOS presentation for sheet dismissal and keyboard, eBay offer grammar for amount selection, and iOS Camera for New's camera entry. These are patterns supplied by the standards, not claims that new reference captures were inspected. No new images, live app captures or simulator verification were made for this document.


## Feature and wiring audit, added for Ben's 10:31 request

Ben, 2026-11-15 10:31: "ensuring each checks against what is planned feature wise for each and also noting down what is left to be wired up and such"

The Planned features and Left to wire subsections below amend each preceding Redesign. A missing capability marked Added is now part of the proposed design at the location stated, not merely a finding for later. Here means this page or its single-purpose supporting form; Elsewhere means a named separate page reached by a disclosure or by the normal downstream journey. Each numbered capability row is counted once, even when several features supply it. Kit contracts reuse these IDs and are not counted as additional product features.

Sources checked: `spec/pages.md` §§6.4, 6.7-6.9, 6.14 and 7-9; `product/decisions.md`; `features/<slug>/README.md` and `spec/features/<slug>.md` for price, list, score, data, studio, replay, sold, messages, buy, capture, identify, measure, appraise, watch, assist, market and item-card. `node scripts/evidence.mjs <slug>` was run for these slugs. The index is a source map, not proof of implementation. Product decisions override feature READMEs that still say Nothing decided. The later decision excluding hot-item/season work overrides stale inclusions in pages §9. Neither is added to these sheets.

Wiring labels: **S** is specced in the page Feeds or canon; **N8** is still called new by pages §8, even if prototype route code now exists; **N** is a contract extension not supplied there. Caller is the app module that should make the request, not a claim that a client already exists. Existing API route files do not establish live data: `app/src/edge/api/captures.ts:73-80` explicitly serves example responses to the synthetic user; `app/src/edge/api/store.ts:7` selects file-backed or memory storage. For example, `app/src/edge/api/items.ts:51-52` reads seeded plan choices, `:132` serves an example posting handler, and `app/src/edge/api/orders.ts:24-28` serves example appointment/label/ship responses. Do not call these connected marketplace operations.

Across these pages, query-selected loading/error/empty/offline demonstrations come from `app/src/demo/screen.ts:11-25`. They are useful fixtures, not evidence of fetch, connectivity or mutation lifecycle. Every wiring row below names the real states still unavailable from that operation. Native navigation, local editing and existing OS handoffs can work while the sale, message or posting remains simulated.

## One shared sheet scaffold

Use `app/src/ui/parts/route-sheet.tsx::RouteSheet` for routed decisions and `app/src/ui/parts/overlays.tsx::Sheet` for local decisions. They must expose the same behavior and geometry. This is a proposed extension to those existing parts, not a third shell.

**NEW PATTERN, needs Ben's OK: one detented, keyboard-aware, draft-aware sheet contract for both shells.** Neither existing shell can express detents, a dismiss guard, focus restoration, keyboard avoidance or a common footer API. `RouteSheet` already supplies scrolling, a grabber and footer; `Sheet` currently supplies none of those. Composition alone cannot fix their gesture and keyboard ownership. The builder should extend these two parts at their common layer after approval, rather than create page-specific workarounds. Everything inside them below is an existing primitive.

### Geometry and ownership

1. One sheet visible at a time, over the actual originating screen. Preserve that screen's scroll offset, selected tab and content. On a cold route entry, anchor `/item/[id]` beneath an item sheet; anchor the source listing beneath Offer where known, otherwise its Buy entry. New falls back to Today. Do not use a bare back call when there is no history.
2. Content-sized detent for a short choice or confirmation; native medium and large detents for overflowing forms. Start at the smallest detent that shows the title, necessary choices and primary action without clipping. Plan and Post start large; an amount, lateness or confirmation form starts content-sized, expanding to large for keyboard or Dynamic Type. No arbitrary fractional heights. Large leaves the status area and origin visible where the device permits.
3. The sheet ground and continuous top corners come from the existing `Surface kind="sheet"` in `app/src/ui/surface.tsx`. No wash, wordmark, tab bar, nested Card or gradient in a sheet. The one field remains reserved for the originating decision or New's existing takeover.
4. One centered grabber, then one left-aligned title (`app/src/ui/text.tsx::Txt`, headline role), with `app/src/ui/parts/buttons.tsx::IconButton` Close at the trailing edge. The title identifies this decision; there is no large title and no collapsing title. Close is a visible alternative to drag, scrim, accessibility escape and system Back.
5. One vertical scrolling body, 20-point gutters. `app/src/ui/layout.tsx::Stack` uses tight 8, group 12 or cards 16; `Section` separates subjects at 32; `List` uses hairlines only between like rows. Use a flat stack, never a pile of settings cards. Footer and header stay visible while the body scrolls.
6. The only primary action is `app/src/ui/parts/buttons.tsx::FootButton`, or `app/src/ui/parts/loop.tsx::Approve` when it authorizes an outward or money action. Pin it below the body, with the safe-area-aware padding already present in `RouteSheet:86`. The body reserves its full space. It is not an overlay covering the last field. A passive explanation has a light Done action instead of a forced black pill.
7. On first presentation, move VoiceOver focus to the title. On validation failure, focus the first invalid field. On dismissal restore focus to the originating control. Background controls are inaccessible while modal. All controls keep 44-point hit areas. Long strings and largest Dynamic Type increase height and allow wrapping; fixed-height kit rows that truncate meaningful text need a shared accessibility variant before shipping.

### Dismissal, unsaved work and navigation

Clean sheets dismiss by Close, downward swipe, scrim, system Back or accessibility escape and return exactly to origin. An iOS horizontal edge swipe is for a pushed page, not a second sheet-dismiss gesture. A child pushed page's back chevron and edge swipe return to its saved parent context without committing an event.

For dirty fields or changed choices, all dismiss paths enter the same decision: “Discard changes?” with a light `Keep editing` and destructive `Discard changes`. Stay in the same sheet context; do not stack another sheet. This uses `Choice` from `app/src/ui/parts/chip.tsx` and `FootButton` from `buttons.tsx`; the shell's dismissal guard is part of the new scaffold above. Keep editing restores focus, detent and values; discard restores the committed values and closes. A new outward request always needs its explicit approval. Dismissal never sends, posts, buys or shares anything.

When a supporting form opens, suspend the parent draft and replace its sheet contents with that single form, with visible Back. Returning restores the parent scroll and staged values. It is not a second overlaid sheet. Forms needing multiple stages become a pushed page instead: close the sheet after saving its local draft, push the supporting page over the origin, then Back reopens the parent sheet with that draft. This is the existing Page container from §1, not a new visual pattern. Route names listed below for new supporting pages are proposed targets for reconciliation, not routes that exist today.

During a request, suppress duplicate approval and edits that change that request. Once accepted as a background job, allow dismissal and continue the job; report progress on the item or originating decision. Only the short interval where an irreversible request's acceptance is unresolved may prevent dismissal, with visible progress. A timeout becomes an unresolved result to check, not an endless disabled sheet and not a claim that nothing happened. Undo is offered only where the backend actually supports a compensating action, with its limit stated before approval if material.

### Keyboard, scrolling and motion defaults

| State or control | Shared result |
|---|---|
| First load | Title and Close immediately. No flash for short waits. After 150 ms show only matching `overlays.tsx::Skeleton` shapes; once shown hold at least 300 ms, per the existing loading guidance. Existing three skeleton variants cannot stand in for every form: retain labels and unfilled fields rather than invent a fake card silhouette. |
| Loaded | Real choices and values in their final positions. Item identity uses `cards.tsx::ItemCard` with `onPress` omitted unless leaving for the item is an explicit secondary action. Never an item hero that competes with this decision. |
| Top, scrolling down, scrolling up | Fixed grabber, small title, Close and footer in all three. Native vertical deceleration, bounce and scroll indicator in the body. No shrinking header, direction-aware reveal, floating action, custom scroll listener or large-title collapse. At the body's top, downward drag hands to the sheet; a downward drag within content first scrolls content to top. |
| Retap current tab | Inaccessible while sheet or takeover is open. It cannot dismiss, refresh or submit. After return, originating tab handles its own retap: first scroll to top; already at top does nothing, with no forced refresh. |
| Keyboard | Persistent field labels, numeric keyboard for amounts, appropriate address/text keyboard otherwise. Expand to large, keep focused field visible and footer above the keyboard using native keyboard tracking, not a timer. Return advances fields; final Return ends editing, never sends an outward action. Interactive keyboard dismissal consumes the first downward content gesture; once hidden, normal sheet dismissal applies. Keyboard Back hides it first; next Back follows the dirty guard. |
| Press | `app/src/ui/press.tsx::Press` and `MOTIONS.press`: spring to 0.97, configured with feedback 150 ms and return 300 ms in current code, interruptible. Dragging off cancels. Existing rows also inherit scale from Press: retain that earlier shared rule rather than silently applying Appllama's no-scale row exception in this lane. Row gray highlight remains. |
| Present and close | `MOTIONS.sheet`, 300 ms entry; `MOTIONS.select`, 200 ms button/scrim exit. Ease out, transform and opacity only. Direct manipulation tracks 1:1 from the current presentation value; release inherits velocity and snaps to a detent or dismisses. Scrim opacity follows sheet progress. Drag remains catchable mid-close. Current `RouteSheet:45-59` close lock and fixed-timing release need correction in the shared scaffold. No raw page duration. |
| Pushed supporting page | Native iOS stack push/pop and interactive horizontal edge swipe, not a bottom sheet animation. Native navigation owns the interactive duration. The screen-change budget in the standard is panel 300 ms; `motion.ts` currently has no named push entry. The reconciler should register the shared native-navigation policy once, rather than claim a nonexistent `MOTIONS.push` or use the sheet driver for a push. Back never reverses a committed event. |
| Picks and updates | `MOTIONS.select`, 200 ms for a selection indicator; `MOTIONS.fieldsFill`, 150 ms for arrived field content. No animation on typing, scrolling or repeated tab work. Do not use motion timing as fake network latency. |
| Haptics | No haptic for open, Close, Back, scrim, retry navigation, typing, scrolling or passive arrival. One `camera.tsx::haptic.light()` when a user explicitly commits Save, Send, Post, Buy label or Confirm pickup, after validation passes. Do not fire again for duplicate taps. Existing helper has light and success only: reserve `haptic.success()` for confirmed sale completion, not routine sheet success. Standards also call for a warning haptic on failure; a shared helper extension is needed, not an invented existing export. Announce the failure visibly and through VoiceOver regardless. |
| Reduce Motion | Same layout, actions and timing of data. Present/close crossfade (`select`, 200 ms) with no translation; Press becomes its existing opacity dip. Direct finger tracking remains, release has no bounce or momentum flourish. No moving gradient, choice rise or circle expansion. Native keyboard and push transitions honor the OS setting. |
| Refresh | No pull to refresh on these forms: a downward pull means return toward dismissal and must not overwrite input. Revalidate on open, foreground and job events; keep dirty fields. A light Retry control refetches failed data explicitly. No pagination unless the particular table below says otherwise. |

No haptic is wired by `Press` today. These are build requirements, not claims about the current app.

## Plan: `app/src/app/item/[id]/plan.tsx`

**Purpose:** choose this item's selling plan, then preview its listings for a draft or save the plan for a live item.

Who and risk: a seller returning per item, choosing the trade between speed and money; the costly mistake is permitting a sale or markdown below their intended limit. It is a single plan-selection decision only if detailed adjustment forms are separate.

### Today and what it is not

| Current order and source | Assessment and destination |
|---|---|
| Loading and missing-item branches, lines 52-70 | Keep recovery; distinguish deleted from network failure instead of making the person infer which. |
| Offline line, 151-153 | Keep a factual offline state; current wording promises a queued save that the code does not perform. |
| Intent chips, then a second list of price modes, 155-169 | Two representations of the same choice. Breaks UI constitution Art. 1 and copy ladder 2. Replace with one list of five intent choices, each with its consequence. |
| Gone-by picker, 170-173 | Only show for Gone fast. Required part of that choice, not a general date dashboard. |
| Price, sales range, anomaly confirmation and minimum warning, 176-191 | Decision evidence. Keep the selected price and expected net money near the intent; move numeric editing to the Price form. Keep anomaly and below-minimum confirmation at the committing form. |
| Price track, 192-196; minimum and acceptance controls, 197-212 | Separate price form and Offer rules form. All visible together turns one choice into several decisions, §1. “Always accept” remains reachable, not silently removed. |
| Site switches with reasons and returns, 214-226 | Move to Sites form reached by a `ListRow` showing selected logos/count. No account linking inside Plan; unavailable site leads to Accounts via a disclosure. |
| Cross-site pricing rule and Why, 228-236, 259-267 | Rule row belongs in Price form; explanation remains `WhySheet`. Preserve the chosen same-take-home default and reason, not a new pricing policy. |
| Price-drop schedule, 238-245; ending, 247-251; handover, 253-257 | Each is its own adjustment form. They are not part of the initial intent scan. Show a row summary; full capability stays one disclosure away. Preserve the Poshmark relist restriction. |
| Draft Preview or live Save, 125-136, 272-275 | Keep exactly one according to item stage. Current draft transition closes then replaces the route; ensure the item stays beneath Post and Back can return to the staged plan. |

### Redesign, top to bottom

All shortened names in this section resolve to these exact parts: `route-sheet.tsx::RouteSheet`; `cards.tsx::ItemCard`; `chip.tsx::Choice`; `list-row.tsx::ListRow`; `loop.tsx::Guess`, `Blank`, `Approve`; `buttons.tsx::FootButton`, `IconButton`; `small.tsx::SiteBadge`; `pick.tsx::GuessPick`; `price-track.tsx::PriceTrack`; `switch.tsx::Switch`; `worth.tsx::KeepRow`; `why.tsx::WhySheet`. Files are under `app/src/ui/parts/`. Grouping is `app/src/ui/layout.tsx::Stack`, `List`, `Row`, `Section`, `Line`; text is `app/src/ui/text.tsx::Txt`.

1. RouteSheet title `Selling plan`, Close, then compact ItemCard: photo and identity prevent choosing limits for the wrong item. No tappable duplicate path to the item beneath.
2. One List of five Choice rows: Sell it, Gone fast, Best price, Only at my price, Just checking. Each row shows its actual sold-data consequence, expected time and `You get` amount when available. Selected row has a tick, not a second card or second price-mode comparison. **The chosen plan and its net amount stand out.** No invented estimate when data is sparse.
3. Gone fast alone gets GuessPick `Gone by`; its value is staged until the final action. A choice that forbids drops shows that consequence beside the choice.
4. ListRow `Price` shows selected asking price and minimum; opens Price form. ListRow `Adjustments` opens a proposed pushed `/item/[id]/plan-details` page, built with existing `Screen`, `Nav`, `Section` and ListRow, because it holds several independent decisions. That page has rows for Sites, Offer rules, Price drops, If it doesn't sell and Delivery. No Save button on that index. Back reopens the staged Plan at its former offset.
5. Footer FootButton `Preview listings` for a draft, Approve `Save plan` for a changed live item; unchanged live item gets light Done. Preview validates and saves the staged plan before moving to Post, but publishes nothing. One primary, no simultaneous Save and Preview.

Adjustment forms reuse the shared scaffold and return to their invoking row. Price: Guess asking price, PriceTrack with sold ticks, Guess minimum, current cross-site pricing GuessPick with its one reason, IconButton Why opening WhySheet with KeepRow numbers, footer `Use price`. Offer rules: Blank automatic threshold, Switch Ask every offer, one consequence and footer `Use rules`; disable threshold while Ask is on, preserving its draft. Sites: one site-logo Row with Switch and one reason per site; footer `Use sites`; unlinked sites disclose Accounts and preserve this draft. Price drops: Switch plus the actual schedule, footer `Use changes`; the row remains reachable under every intent, with drops off and the intent's restriction stated if that intent forbids them. Ending: Choice rows including ask, donate, keep, trade in where supported, and permitted relist, footer `Use ending`. Delivery: ship, pickup, either Choice rows, footer `Use delivery`. These stage edits; the root's Save/Preview commits the whole plan. Any automatic policy change must retain its canonical authorization, not rely on a generic Use label to grant new authority.

### States and interactions

| State | What shows and what can be done |
|---|---|
| First load | Shared loading; retain cached item identity and choice if available, lock Preview until actual plan prerequisites resolve. |
| Loaded, one or many sites | Same five intent rows and one selected consequence, no added dashboard. Site count belongs in the Sites row. |
| Empty | Missing/deleted item: EmptyState plus Close or Open Sell. No selected sites: preserve plan, Sites row says `Choose a site`; Preview disabled with that reason and row reachable. |
| Partial | Known choice usable; missing estimate says `Estimate unavailable`. Accept typed price through Price form; do not require research to invent a value. Unknown fees block a misleading net figure, not the rest of the form. |
| Loading more | Not applicable; finite five choices and linked sites. No load-more affordance. |
| Refreshing | No pull; source refresh in place preserves explicit choices and typing. New suggestion never replaces a touched field. |
| Offline | Cached values editable locally, `Changes on this phone`; Save/Preview do not claim server persistence. Retry connection before committing. Do not silently schedule a future automatic save. |
| Error and retry | Inline failed estimate/source with Retry; total item-load failure uses EmptyState. Save failure keeps the staged plan, with Retry save. |
| Top, down, up, tab retap | Shared fixed-title sheet behavior. Plan-details is a pushed page with the family page header and ordinary edge Back, not a second sheet title. |
| Keyboard | Numeric fields only within Price/Offer rules; shared keyboard behavior. Incomplete, negative, malformed and nonfinite amounts cannot commit. Minimum above price stays visible as invalid input, not silently substituted. |
| Reduce Motion | Shared crossfade and opacity feedback, no price-track flourish. Slider remains directly movable and has accessible increment/decrement. |

Choice taps stage only (`select`, 200 ms, no haptic). Price slider tracks the finger, never opens a sheet accidentally; typed amount is the equivalent path. Why replaces the active supporting sheet and restores it on Done. Disclosures push the named supporting page or replace with the single supporting form as above, never apply on navigation. Final Preview goes to `/item/[id]/post`, backed by the item and staged Plan; Back from Post reopens Plan. Live Save waits for acknowledgement, light haptic on valid approval; success returns to the item and offers only supported Undo. Below-minimum price and anomalous price each require the explicit amount confirmation, preserve the warning through Preview and confirm the actual published price in Post. No automatic acceptance below the minimum.

### Copy changes

| Source | Change and ladder reason |
|---|---|
| 156 and 157, `What do you want?` twice | Cut caption; Choice group accessibility name can remain. Ladder 2. |
| 161-168, repeated mode labels | Cut second presentation; attach real consequences to the five choices. Ladder 2. |
| 153, `Changes send when you’re back` and `Your plan saves when you’re back` | `Changes on this phone` until a real queue exists. Truth, ladder 1. |
| 189, `It waits for your tap` | Cut that clause; keep exact under-minimum amount at approval. Ladder 2. |
| 195, `Each tick is a sale like it` | `Similar sales`, retain units and accessible explanation on the track. Ladder 4; no loss of scale. |
| 198-202, `Lowest you take`, explanatory caption | `Lowest you'll take`; retain the under-minimum authorization consequence in the Offer rules/Price form, not as repeated root copy. |
| 205-210, automatic acceptance labels | `Accept offers from` with currency unit; retain `Sells without asking` only next to that threshold. Keep Ask every offer alternative. Safety consequence survives. |
| 131-133, `Save: ...` and long saved recap | `Save plan`; amount/site summary remains directly above it. `Plan saved` after acknowledgement. Ladder 2. |


### Planned features

Feature ownership is price, list, score and data, per pages §6.7 and §7. The table also checks their shared Item/valuation inputs. Do not transplant all four engines into the root sheet.

| ID | Planned capability and source | Disposition in this redesign |
|---|---|---|
| P01 | Five selling intents, default Sell it, per-site time and net consequence before picking; price Selling intents, pages §6.7 | Here: the five Choice rows. Added: each row exposes all selected sites' consequences through an inline detail disclosure, rather than replacing them with only the best site's net. |
| P02 | Adjustable speed/price posture, actual sold-price ticks, typed equivalent; price, assist | Here: Price form. Added: net updates with the staged price; slider and intent are related controls, not independent contradictory objectives. Never manufacture sold dots from a range. |
| P03 | Suggested minimum and Always accept offered at listing; protected below-minimum approval; price and product decisions | Here: Price and Offer rules forms, with final amount confirmation carried into Post. Suggested threshold does not enable automatic selling until accepted. |
| P04 | Per-site offers enabled/disabled and allowable automatic rules; price/list | Here, Added: Offer rules has one site-logo row with offers Switch and the actual site's consequence; Ask every offer remains the item-level override. |
| P05 | Gone-by date, compressed path, fallback ask/donate/keep/trade-in/permitted relist; price Selling intents | Here: Gone by and Ending forms. Added: the end remains an explicit Today decision with the choice preselected; selecting Donate now is not authority to dispose of the item later. Predicted miss points to that deadline decision without lowering under the minimum. |
| P06 | Site suitability, prohibited categories, skipped-site reason, connection health and account risk; list/price | Here: Sites form. Added: separate not linked, blocked and deliberately skipped reasons; avoid-fit is overridable where allowed, prohibited/recall is not. Actual account-risk line appears before adding that site. |
| P07 | Ship/pickup/either and shipping effect on net; price/list | Here: Delivery form, with each site's actual supported handover. A pickup-only platform cannot silently become shipping. |
| P08 | Cross-site pricing policy, same-take-home default, per-item override and imported-shop option; product decision Cross-listing starts on same take-home | Here: Price form rule picker, plain reason and per-site Why numbers. Preserve all four canonical rules, imported-shop option only where applicable. |
| P09 | Explain estimates, comparable photos/dates/sold vs asking, fees, shipping/tax base and source freshness; price/data | Here, Added: Why on selected plan and every net estimate opens actual citation rows, not only fee arithmetic. Too-few/too-wide/unproven states retain hide reasons; no unguarded number. |
| P10 | Source failure/shift, stale model/fees and keep old plan when comparable set changes; price | Here, Added: a refreshed suggestion appears beside a light Keep current choice; no overwrite of confirmed input. Outdated net is marked, retryable and not represented as current. |
| P11 | Standing judged against chosen intent; four score axes and source/hide reasons; score | Here, Added: one Why plan row opens existing WhySheet with the per-site basis and weakest relevant factor. Hidden axes have their reason, never a combined score. Reserve is never Slow/Stuck; check mode is judged by information gathered. No hot-items/season feature. |
| P12 | Actual markdown schedule, off switch, above-minimum path, logged updates and allowed undo; price/data | Here: Price drops form, including next step and end. Added: an active plan's next automatic step and change history are reachable through Why, not a second root action. |
| P13 | Only at my price fixed ask/no drops/review date; Just checking defaults to appraisal, nonbinding listings only if allowed; price | Here, Added: Review date row in Adjustments for reserve/check. Just checking's primary becomes Check value and opens Worth unless an allowed nonbinding listing route is explicitly chosen; Preview is not mandatory for an appraisal-only plan. The open policy about live Just checking remains open, never silently approved. |
| P14 | Listing time/list later, including waiting for a chosen date; price/list | Elsewhere: Post time form in Post preview; Plan details has a Post time ListRow restoring the staged Plan on return. No seasonal prediction is added. |
| P15 | Per-site title form, photo order, fields/category, delivery/return terms and promotional levers; price/list | Elsewhere: per-site Edit listing in Post, reached by Preview; unsupported paid promotion needs its own explicit cost confirmation there. Plan's root stays a plan choice. |
| P16 | Promotion after three unedited approvals, personal rule history/revocation; data and product decisions | Elsewhere: Automation/Why, through an Automation ListRow in Plan details. Never promote locked/below-minimum actions, and do not count changed inputs as unedited approval. |
| P17 | Optional cost/profit input, sell-as-set request and per-item floor conflict; price Selling intents | Elsewhere: Item details through an Item details row. Cost is optional, never demanded of a casual seller. Bundle with a cross-subsidy floor remains an explicit unresolved direction question; do not implement it as a new plan choice. |
| P18 | Versioned choose/edit/save, per-item limits, event history and valid reversal; price/data | Here: Save/Preview commit, signature/version/idempotency policy and Why. Added: a 409 restores the latest server plan beside the person's draft; 422 focuses the invalid limit without losing other input. |

### Left to wire

| Redesign part | Runs on today, with code evidence | Endpoint, caller and work remaining | Real states still unavailable |
|---|---|---|---|
| Identity, choice rows, per-site estimates and ticks | Demo: route `app/src/app/item/[id]/plan.tsx:48` calls `app/src/item/model.ts:20-23`, which searches WORLDS from `app/src/demo/index.ts:7-19`. Mode estimates are fixture-derived at `app/src/item/model.ts:271-278` and `:316-327`; ticks are evenly synthesized at `:421-428`. | S `GET /v1/items/:id`, N8 `GET /v1/items/:id/plan-choices`; app caller `app/src/item` replacing fixture lookup. Backend planChoices remains seeded at `app/src/edge/api/items.ts:51-52,133-135`; wire real consequences and actual comp observations. | Real first load, source-specific partial/error/retry, missing item/choices, abstention, stale version and refresh; current URL states do not prove them. |
| Price, minimum, automatic threshold, date, fallback and delivery | Local React state only in `app/src/app/item/[id]/plan.tsx:87-104`; Save only sets `saved=true` at `:134-136`. Preview carries price/flip/spread in a URL at `:68-71`, not all settings. | S `POST /v1/items/:id/strategy`; N8 per-item plan_choice/gone_by/fallback/markdown_on/accept_mode/review_at. Caller `app/src/item` must serialize every staged field, including per-site edits. Current server accepts a subset at `app/src/edge/api/items.ts:114-130`; review_at, handover/site/spread edits need contract alignment, N where absent. | Saving/acknowledged/failed/409/422 and real persisted reopen; offline draft/queue policy. No server save or server Undo today. |
| Sites, pricing policy, offers and source/risk | Demo connections and fit at `app/src/item/model.ts:336-355`; local fee arithmetic at `:361-364`; policy table in `app/src/engines/listing/spreads.ts` imported at `app/src/item/model.ts:10`. Site and policy controls only update local state in `app/src/app/item/[id]/plan.tsx:217-235`. | S `GET /v1/accounts`, item strategy and limits; S strategy write with per-site edits. Caller `app/src/item`, Accounts owned by You. Wire current site capability/risk/fees and persisted skip reason. Per-site offers UI is nothing yet in current Plan's controls at `:204-212`. | Real unlinked/expired/blocked/avoided, unavailable offer tools, stale fee, partial per-site save failure. |
| Why/score/current plan vs new suggestion | Fee-only Why is populated locally at `app/src/app/item/[id]/plan.tsx:259-267`; score outlook is read from the fixture at `:118`. No citation/score fetch in this path. | S `GET /v1/citations/:id`, `GET /v1/scores?subject_type=listing&subject_id=`, `GET /v1/scores/:id/basis`, `GET /v1/events?item_id=`, `POST /v1/events/:id/undo`; N8 market_standing. Caller `app/src/item`, stream via S `/v1/stream`, polling `/v1/jobs/:id`. | Basis loading/error/empty, hidden axes, source shifts, actual automatic steps and reversal failure. |
| Adjustment index and new rows | Nothing yet: root still renders all settings inline at `app/src/app/item/[id]/plan.tsx:176-257`. | Local navigation/draft store in `app/src/item`; no endpoint for the index itself. Post time goes to Post, Automation to You, Item details to Item. Shared shell tasks below must precede nested forms. | Back restoration, discarded-vs-staged state, keyboard/focus and route-anchor recovery, not API states. |

## Post preview: `app/src/app/item/[id]/post.tsx`

**Purpose:** check the selected listings as buyers will see them, then authorize posting those exact listings.

Who and risk: a seller per listing, about to publish in their name. The costly mistake is a wrong photo, fact, price or site. Full per-site previews are evidence for this one publishing decision, not separate primary actions.

### Today and what it is not

| Current order and source | Assessment and destination |
|---|---|
| Loading, missing, sold, 45-66; recall block, 128-134 | Keep, but sold copy repeats itself. Missing and deleted require distinct recovery. Recall must remain a block. |
| Approval footer, 136-149; offline and missing-fields banners, 154-155 | Keep one approval, but enable only for complete, connected, selected sites. Current Approve ignores an empty selection by returning silently. No promise to post later offline without an accepted queue. |
| Full photo plus cleanup/AI switches, 156-170 | Preserve the live comparison Ben requested, but put it behind a Photos disclosure, replacing the active sheet with that one photo-choice form. An extra full-width photo before every preview competes with the actual listing. UI constitution Art. 7. |
| Every selected/unselected site's ListingPreview, 171-181 | Keep the real site-specific photo, title, fields, price, terms and count. No arbitrary three-site cap. Site selection stays here as a final scope check. |
| Inline per-site edit controls and their Done, 182-193 | Move to one site's Edit listing form. Several open editors would turn the review into a workbench, §1. Shipping and returns fields must also exist where supported, per ways-out §6.8. |
| Per-site errors and actions, 194-204 | Keep affected-site recovery. Retry must actually restart that site's job, not merely clear its failed flag as line 198 does today. |
| When chips, 209-213 | Replace open-ended Later chip with ListRow `Post time` showing Now or scheduled local date/time; one time-picker form behind it. |

### Redesign, top to bottom

Use `route-sheet.tsx::RouteSheet`, `list-row.tsx::ListRow`, `listing-preview.tsx::ListingPreview`, `switch.tsx::Switch`, `loop.tsx::Blank`, `Guess`, `Approve`, `buttons.tsx::FootButton`, `Pill`, `chip.tsx::Choice`, `why.tsx::WhySheet`, `action-row.tsx::ActionRow`, and `overlays.tsx::EmptyState`, all under `app/src/ui/parts/`; layout/text use the shared files above.

1. RouteSheet title `Post preview`, Close. Brief item identity is already in the first preview; do not repeat an ItemCard and a hero photo.
2. ListRow Photos showing Original, Cleaned up or Enhanced; opens one form using `app/src/ui/photo.tsx::Photo` and Switches. Keep original always, keep both toggles, reflect the current result live in previews, and retain the LiDAR gate for AI. Toggling merely stages a visible choice, never generates or changes a posted photo automatically.
3. Flat Stack of ListingPreview components, one per candidate site, real logos, each with its scoped Switch. Selected previews remain full fidelity; unselected previews are quiet but identifiable. Each has one light Edit disclosure via ListRow to a single-site form. Missing required fields appear at that site's preview and Edit target. **The listing preview photo is the focal point; the publishing action is second.** No audience-marketing caption.
4. ListRow Post time, default Now. The time form uses existing `pick.tsx::GuessPick` where its choices fit; a precise new native date/time wrapper is **NEW PATTERN, needs Ben's OK** because free text in Chips cannot safely represent locale/time-zone scheduling. Until supplied, do not claim a free-text Later value is a validated schedule. Preserve the requested schedule capability for the reconciler.
5. Footer Approve `Post to {count} sites`, or `Schedule posts` with the exact time visible above. Show asking prices and `You get` in each preview; never invent one common amount across unequal site prices. The final tap confirms public scope. If a price is below the person's minimum, explicitly name that amount here and require its authorization.

Single-site editor: a single form of Guess/Blank title, description, required factual fields, price, shipping and return terms where supported, photo order through existing `photo-pager.tsx::PhotoPager` for viewing. The kit has no editable photo reorder pattern: **NEW PATTERN, needs Ben's OK** for an accessible reorder control, because PhotoPager only views. Keep camera/item photo editing as the fallback destination rather than pretending the pager reorders. Footer Use changes returns staged results, never posts that site. Back returns the preview draft.

### States and interactions

| State | What shows and what can be done |
|---|---|
| First load | Shared loader, cached previews where known; approval disabled until required checks finish. |
| Loaded | All scoped previews; one site, typical and dense use the same stack and footer. Large text scrolls without cutting fields or approval. |
| Empty | No selected sites: previews stay with switches, disabled Post and `Choose a site`. Sold: `Already sold`, Close. Deleted: no Post, return to Sell. |
| Partial | Per-site missing fields marked by word/icon, edit that site or skip it. Known-complete sites can be posted only after the user explicitly scopes to them. Pending recall result blocks all posting until resolved. |
| Loading more | No pagination: finite marketplace previews. Lazy images can load in their reserved slots; no separate load-more act. |
| Refreshing | No pull. Revalidate facts and site readiness on open; changed server facts are shown for review, never substituted into a request already approved. |
| Offline | Cached previews editable; Post disabled with `Connect to post`. No public action queued by dismissal or reconnect alone. |
| Error and retry | Failed preview has Retry load, remaining previews stay. Recall match shows why and source through WhySheet, no bypass post. Recalled-model identity can be corrected on Item and checked again. |
| Posting | Immediately mark each selected site Posting; use real job stages, then Live or Failed per site. Allow leaving after job acceptance; item and Today carry progress. No re-post of sites already live on Retry. |
| Partial posting / all failed | Keep successes Live. Failed site offers Retry, Edit, Skip and Post it myself through ActionRow; manual route opens that site with text/photos prepared as promised by ways-out, only when the export actually succeeds. No fabricated delist Undo. |
| Top, down, up, tab retap | Shared fixed header/footer; scroll does not change the site selection or hide Post. |
| Keyboard | Single-site and time forms only, shared field rules. No automatic posting on Return. |
| Reduce Motion | Shared fade; site tags crossfade or change instantly. No celebratory posting animation or count-up. |

Photos and Edit replace the parent sheet contents, returning staged changes; Post time likewise. Switches stage scope, `select` 200 ms, no haptic. Post uses light haptic on valid commit; done state returns to Item after showing each site's outcome, with `overlays.tsx::UndoToast` only if unposting is supported. Native push/back applies to Item or more substantial photo editing; site web handoff uses `site-link.tsx::SiteLink` and the existing external controller, preserving the preview. Approval cannot be retriggered while in flight. An unknown post outcome says `Checking post status` and reconciles by listing/job identity before retry.

### Copy changes

| Source | Change and reason |
|---|---|
| 65, sold title and identical line | `Already sold`, cut body. Ladder 2. |
| 154, `It posts when you’re back` | `Connect to post`, because no accepted queue exists. |
| 162, `Light only. The color stays true` | Cut permanent caption; the live comparison does this job. Ladder 2. |
| 166, scan-validation description | Retain only unavailable-state `Scan with LiDAR first`; put the actual enhancement scope in Photos when choosing it. Do not hide a material AI change. |
| 178, `AUDIENCE[site]` | Cut from review; it explains the design strategy, not what the listing says. Ladder 1. |
| 179, crop and title-format narration | Show actual crop/title. Keep photo count and omitted-photo count, and the required AI marker when applicable. Ladder 2. |
| 185, `Only this site changes` | Cut; the editor's site logo and scoped title carry it. Ladder 2. |
| 201-202, Post it myself caption | Cut caption if the site-opening affordance already conveys it; retain any actual export failure and the next action. |
| 138-139, `One failed` / `Nothing was posted` | Derive actual counts and site outcomes. Unknown result cannot assert nothing was sent. |


### Planned features

Owners: list, studio and replay in pages §6.8/§7, with price/data/assist supplying the listing's facts and authorization. Source details: `spec/features/list.md:12-22,36-46,105-123,143-148`; `spec/features/studio.md:11-40,113-121`; `spec/features/replay.md:78-80`.

| ID | Planned capability | Disposition in this redesign |
|---|---|---|
| T01 | A genuinely site-shaped preview across the five current sites: title/category/description/fields, crop/order/count and actual price/net | Here: ListingPreview stack and each site's editor. No generic preview copied five times. |
| T02 | Shared-field edits propagate unless a site has an override | Here, Added: Edit listing offers an explicit Shared facts disclosure. Shared edits update all non-overridden previews; a site-only edit never mutates the shared item silently. |
| T03 | Site overrides including title/price, offers, shipping, returns and permitted promotion; override dot and Undo override | Here, Added: site editor has those supported controls, an override marker and light Undo override. Paid promotion is its own cost-confirmation form, off until approved. Before/after net remains visible. |
| T04 | Missing fields, provenance, correction, guessed vs seller-only blank and unknown/skip | Here: required fields and editor. Added: seller-only unknowns stay blank or are omitted where permitted, never filled by a model to enable Post. |
| T05 | claim_check allow/hold/abstain before posting and an unsupported-claim resolution | Here, Added: blocked claim replaces Post with the one relevant decision: Edit, Leave it out, Confirm this fact, or Don't post. Confirm keeps the person's attestation; it never clears a recall. Only the affected site's incomplete preview is blocked unless the claim is shared. |
| T06 | Recall failure blocks posting, notice source and correction/recheck path | Here: recall branch and Why source; correction returns through Item and must recheck before Post. |
| T07 | Original/clean/enhanced live comparison, original retained, explicitly approved image versions and site order | Here: Photos form. Added: original is default, not cleanup or AI; only already explicitly approved variants may reopen selected. Keep real evidence photo first and real flaw/detail shots; rejected renders cannot appear in Post. Quick toggles operate on actual completed assets. |
| T08 | Per-photo before/after, true-color/light/pressed level, change line, Use/Redo/Fix texture/Use real, Generate/Add photos and blocked/improving fallback | Elsewhere: Item photos, reached by Photo details row inside Photos. Never block posting real originals while improvement runs. No restaging or hidden wear. Explicit per-photo approval is retained; pressed is never preset. |
| T09 | Non-model crop/straighten/color/privacy tweaks and measured photo score | Elsewhere: Item photos through Photo details. Added that disclosure; show the score's actual basis, not an invented higher-is-better number. |
| T10 | Now or validated later schedule, correct local display and scheduled state | Here: Post time form. Added: schedule requests show actual UTC/time-zone conversion in confirmation and remain Scheduled until the accepted job runs. |
| T11 | Select/unselect sites and excluded reason, no arbitrary count cap | Here: preview switches; blocked sites explain why, no orphan enabled Post. |
| T12 | Explicit public approval, first_post decision where required, exact scope and limits | Here: Approve. Added: honor first_post decision/signature before starting the job; current generic Approve is not a substitute for backend policy. |
| T13 | Job started/running/arrived/failed per site, actual URL after read-back, browser fallback when needed | Here: posting result stack. Added: only confirmed read-back becomes Live with SiteLink; route api/replay/browser and fell_back facts stay in Why. Browser-only sign-in opens its live view, not a fake generic replay button. |
| T14 | Retry/Edit/Skip/manual fallback, reconcile unknown result by listing identity before retry | Here: per-site recovery. Preserve successfully posted sites, copy actual text/save actual photos for manual posting and show export failure if preparation fails. |
| T15 | Delist all after sale, per-site proof and failed-delisting retry | Elsewhere: Item/Today, linked by Open item after posting. This is not a second Post-preview decision. |
| T16 | Later live revisions, read-back diff, unpost/relist and allowed compensations | Elsewhere: Item and Why; live-field changes use push_my_edit or agent_revision policy. Supported reversal remains reachable after toast expiry. |
| T17 | Imported existing listings, account linking/relinking and bulk before/after previews | Elsewhere: New/Accounts import and Sell bulk preview. Post may open for one imported item, but cannot become an inventory-import page. |
| T18 | Traceable original/AI provenance without silently deciding exported AI-mark policy | Here: Photos/site preview and Why. Added: record version and approval source. The documented export-mark disagreement stays unresolved for reconciliation; in-app provenance is not permission to alter exported watermark policy. |

### Left to wire

| Redesign part | Runs on today, with code evidence | Endpoint, caller and work remaining | Real states still unavailable |
|---|---|---|---|
| Site previews, photos and net | Demo lookup `app/src/app/item/[id]/post.tsx:44,87-112`; forms/AUDIENCE imported from `app/src/demo/listing-forms.ts` at `:25`, image variants from `app/src/demo/photos.ts` at `:26`. | S `GET /v1/items/:id`, citation/strategy/photo/version data; caller `app/src/item`. Align per-site photo order and guarded net, not only static form metadata. | Fetch loading/error/empty, actual per-site partial fields, missing assets, current fee/provenance freshness. |
| Shared edit, site override, terms/offers and schedule | Local title/price edits at `app/src/app/item/[id]/post.tsx:183-190`; one shared blank for every site's missing field at `:101,115,180`; When state at `:93-94,209-212`. No persistent terms/offers/override controls there. | S strategy write then item/listing read; per-site payload and list_at are specced, but current `app/src/edge/api/items.ts:116,132` does not apply the full editor contract. Caller `app/src/item`; implement real override identity and Undo override through accepted writes/events. | Saving, rejection, version conflict, scheduled/expired schedule and refresh preserving per-site drafts. |
| Recall, claim check and approval | Recall is forced with query case at `app/src/app/item/[id]/post.tsx:42,70-71,128-134`; the Approve handler only updates local job state at `:140-148`. | S listings POST plus S decisions act for first_post/unbacked_claim, S item read and job events. Caller `app/src/item`. No separate invented /claim-check endpoint: use the returned held decision/job. | Real pending recall, unavailable check, hold/abstain, signature expiry, changed facts and explicit attestation result. |
| Photos selection and detailed correction | Cleanup/AI default on at `app/src/app/item/[id]/post.tsx:109-111`; switches at `:160-166` select bundled variants. This is not a renderer call. | S studio job and studio_approve via `/v1/decisions/:id/act`; `/v1/jobs/:id/events`, Item photos and capture uploads. Caller `app/src/item` and destination Camera. Wire per-photo versions, retained originals, LiDAR evidence and score. No standalone studio REST route is specified. | Actual rendering/repairing/ready/failed/blocked, improving fallback, no render available, redo/fix texture and photo-export failure. |
| Posting/progress/result/undo | Timer advances done at `app/src/app/item/[id]/post.tsx:117-123`; failure fixture derives from listings/fail query at `:114`; Undo clears state at `:149`. Backend listings POST is example-only at `app/src/edge/api/items.ts:132`. | S `POST /v1/items/:id/listings`, decisions act, S job GET/events and stream. Caller `app/src/item`; connect to real post/read-back adapter and reconcile unknown result before retry. Undo must call a supported event compensation, not local reset. | Accepted/queued/running, per-site live URL, partial failure, unknown outcome, offline/reconnect and actual reversal eligibility/failure. |
| Retry/Edit/Skip/manual export | Retry clears failed array at `app/src/app/item/[id]/post.tsx:198`; Skip clears local scope at `:199`; Post myself only opens an existing URL when present at `:201-202`. | S job/decision retry and versioned strategy/site exclusion; manual file/text export is N client/service work where not returned. Caller `app/src/item`; no claim that URL opening copies text or saves photos. | Actual retry result, failed export, unsupported manual site, openURL failure and persistence after leaving. |

## Ship: `app/src/app/item/[id]/ship.tsx`

**Purpose:** get the correct label for this sale, then open or print it.

Who and risk: seller once per shipped sale; highest cost is purchasing a wrong label or mistaking a purchased label for dispatched goods. Ship is not a payout dashboard, carrier-map browser or cancellation hub.

### Today and what it is not

| Current order and source | Assessment and destination |
|---|---|
| Screen/Nav/title and item decision card, 157-165 | Pushed page today, not a sheet. Use shared sheet and passive compact identity with actual ship deadline. |
| Site link and screenshot, 166-170 | Evidence is useful but secondary. One Order on site disclosure to `site-link.tsx::SiteCopy`; it contains the external SiteLink. |
| Label scope chips, 177-183 | “This one” and “All” mix one item with a batch. Batch goes behind a Print all labels row to one separate batch decision, default count and total clearly shown. |
| Service and box or batch rows, 184-207 | Keep label facts. Add missing weight and insurance when relevant, per §6.9. Editable inferred values need callbacks; current service Guess has no change callback. |
| All drop-offs plus instant collection scheduling, 210-224 | Move to Drop-off places pushed page behind one row. A courier-booking tap is an outward commitment, not a side effect of a location row. Give it a distinct confirmation form. |
| Money stages and paid payout speed choice, 226-243 | Move to this order's money detail under You/Records with item/order context; paid payout speed is its own confirmation. Unrelated to obtaining a label, §1. |
| Self-ship and cancellation, 245-249; forms 257-280 | Keep as quieter ActionRows in the sheet. Each opens its own single form. |
| Label “printed” and Undo, 147-153 | Current timer simulates printing, and Undo only clears state. Real purchased, downloaded, printed and shipped are separate outcomes. Never assert printing or refunded postage from local state. |

### Redesign, top to bottom

Use `route-sheet.tsx::RouteSheet`, `cards.tsx::ItemCard`, `small.tsx::SiteBadge`, `loop.tsx::Guess`, `Blank`, `Approve`, `list-row.tsx::ListRow`, `action-row.tsx::ActionRow`, `chip.tsx::Choice`, `buttons.tsx::FootButton`, `Pill`, `tag.tsx::Tag`, `site-link.tsx::SiteCopy`, `overlays.tsx::EmptyState`, plus shared layout/text.

1. RouteSheet `Shipping label`, compact passive ItemCard: item photo, site, ship-by and net proceeds. Deadline belongs with this sale, not a floating banner.
2. List of service, box dimensions with units, measured/estimated provenance, weight and cover. Use Guess for inferred editable values and Blank for unknown required ones. If price exceeds actual included cover, one Cover ListRow opens a Choice form with priced alternatives and no pre-purchased extra. **The label cost or Prepaid state stands out**, with the item photo leading identity.
3. ListRow Order on site, then nearest known drop-off summary leading to proposed `/item/[id]/drop-off`; its list uses ListRow, SiteLink and native Maps handoff. No fabricated nearest location when location is denied; allow typed area in that page.
4. If other labels are due, ListRow `Print all labels` with actual count and combined purchase cost. Opens the batch form, not an implicit scope switch. Batch uses photo Rows per order with cost, deadline and stage; one Approve `Buy {count} labels for {total}` or FootButton `Print {count} labels` when all already exist. Partial failures stay on their own rows.
5. List of ActionRows `Use my label`, `Payment details`, `Cancel sale`. Payment details pushes the order-specific money page owned by the You lane; it is not folded into Ship. Cancellation last and never the black primary.
6. Footer Approve `Buy label {cost}` or FootButton `Open prepaid label`. Once obtained, the action becomes Open label / Print label according to the real label's availability. Native document/print/share controller handles the file. Do not mark shipped until carrier scan or the explicit self-shipping confirmation.

Self-shipping form: Choice With tracking/Without tracking, Guess carrier, Blank tracking number when selected, one specific protection consequence for no tracking, Approve Mark shipped. Cancellation form: Choice reason list, actual refund and site consequence, FootButton kind second confirming `Cancel sale`; no primary black cancellation. Drop-off booking form: actual window, address and price, Approve Book collection, return to label. Insurance and batch remain separate one-decision forms.

### States and interactions

| State | What shows and what can be done |
|---|---|
| First load | Shared loading and cached item/deadline; no price guessed while label quote loads. |
| Loaded | One sale by default; prepaid, quote required, purchased and carrier-scanned states have the appropriate single next action. |
| Empty | No shipment due: EmptyState `Nothing to ship`, Open item. Already shipped: show actual tracking and Close, no Buy. Double sale: block label, `Choose a buyer` opens the specific Today decision, not a vague home route. |
| Partial | Missing weight/dimensions use Blank with explicit units; no purchasable quote until required values resolve. Existing prepaid label remains openable while maps fail. Insurance or quote failure does not erase item facts. |
| Loading more | No pagination for a single order or finite due-label batch. Each batch row can independently be running, downloaded or failed. |
| Refreshing | No pull; reconcile order and carrier updates on open/foreground. Keep edited shipping measurements; requote before approving changed data. |
| Offline | Cached downloaded label can be opened/shared/printed. New purchases, collection bookings and marking shipped wait for an explicit retry online; preserve inputs. Do not show an indefinite Printing state. |
| Error and retry | Specific quote/label/download/print failure with Retry for that operation. Printer cancellation returns to label without a failed sale state. Account expiry has Relink via Accounts, then retry only that label. Unknown purchase outcome checks existing label before charging again. |
| Batch partial / complete | Successful files remain usable; Retry failed only, never rebuy successful labels. Print action only claims printed if the system reports that outcome; otherwise say Labels ready. |
| Top, down, up, tab retap | Shared header/footer; no floating print control or shrinking title. Drop-off page gets ordinary pushed-page Back/edge swipe. |
| Keyboard | Numeric dimensions/weight with unit labels; tracking text keyboard. Shared expansion and validation. |
| Reduce Motion | Shared crossfade; batch row stages update quietly, no stagger across the full list. |

Service, box, weight, cover and label scope edits stage only. Label approval: light haptic on valid charge tap; one stable request identity protects repeated taps and retries. System print/document UI returns to the same sheet. Maps/site links preserve the sheet behind the system controller; their cancellation commits nothing. Cancellation and self-ship each require their named confirm; only a supported cancellation compensation gets Undo. For an already-bought label, refund/void is an explicit separate operation with the carrier's actual limit, not the current `undoLabels` state reset. Drop-off collection scheduling shows its real time and charge before Book.

### Copy changes

| Source | Change and reason |
|---|---|
| 118, `Print ... for ...` on purchase | `Buy ... labels for ...`; printing is a separate controller action. Exact consequence. |
| 151-153, `Printing`, `Label printed` | Use actual job step; `Label ready` once downloaded, only Printed when observed. |
| 186, prepaid sentence | `Prepaid` with site logo; retain buyer-paid detail only if needed to understand an actual charge. Ladder 2. |
| 169, `See the site’s copy` | `Order on site`; SiteCopy carries saved screenshot/time. Short, concrete label. |
| 215, `Pickup set ...` after a row tap | Remove immediate success; Book collection form must acknowledge the request before this claim. |
| 238-239, payout chips | Move with their actual fees to Payment details; no rewrite that hides the charge. |
| 70, `Try again` | `Retry`; item/order context remains in the failure. Preserve original route/query context. |
| 276-277, refund and site consequences | Keep at cancellation, combine only if no consequence is lost. Clean-copy's real-consequence exception. |


### Planned features

Owner sold, with measurement inputs from measure and the Item record, per pages §6.9/§7 and `spec/features/sold.md:9-31,62-75,103-108,128`. Batch label status follows pages' specced designation; sold's older Needs wording is stale.

| ID | Planned capability | Disposition in this redesign |
|---|---|---|
| S01 | Correct sold item, site order, ship-by deadline and seller proceeds | Here: compact identity and label cost, guarded by order state. |
| S02 | Site-issued prepaid label where supplied or an appropriate carrier quote | Here: label facts and footer. Prepaid Open is distinct from a charge; no label re-purchase on retry. |
| S03 | Box dimensions from measurements, weight, provenance, own correction and units | Here: label form; typed values retained, uncertain measurements corrected before quoting. Weight comes from a supplied specification, scale or person, never inferred from photos. |
| S04 | Included cover and optional insurance above that limit | Here: Cover decision with actual price/coverage; explicit insurer/charge outcome. |
| S05 | Approval to buy label, rate/buy/upload-tracking job, print/open and shipment status apart | Here: footer and job stages; dispatch comes from scan or explicit manual action, not download. |
| S06 | Several due labels in pick-list order, total cost, one PDF and 4x6-inch or letter layout | Here, Added: batch form includes layout Choice, actual combined PDF output and only unbought labels in purchase total. Selection does not rebuy existing labels. Existing kit Choice and FootButton suffice. |
| S07 | Day's grouped pick list, location labels and pull/pack walk | Elsewhere, Added: Day's pick list row opens a Today-owned pick-list page ordered by location.label; print that list from its page. Batch form uses the same order. |
| S08 | Enter carrier/tracking for own shipment, no-tracking choice with actual protection consequence | Here: Use my label form and explicit Mark shipped approval. |
| S09 | Use existing own label without buying another | Here: same form and persisted external tracking; not just toggling the fee label locally. |
| S10 | Nearest drop-off, Maps, typed-area fallback, carrier collection only after tap | Elsewhere: Drop-off places page reached by the summary row, with separate Book collection decision. |
| S11 | Cannot send/broken/sold elsewhere: cancel reason, refund and site-account consequence | Here: cancellation form; supported relisting after cancellation is explicit, never Poshmark relist. |
| S12 | Missed shipping deadline and duplicate sale resolution | Elsewhere: the specific Today decision, linked from a blocking reason in Ship; do not offer a label before buyer resolution. |
| S13 | Delivery/claim window, payout status/speed, drafted review and records | Elsewhere: Item/Today for delivery and review; You Payment details/Records for payout and year-end export. Keep the order context on each disclosure. |
| S14 | Claim/return/dispute evidence and reply approval | Elsewhere: sale detail/Today decision, accessible by Order details, not a long form below the label. |
| S15 | Site's actual order/screenshot/time and identity/read-back evidence | Here: Order on site/SiteCopy; no stored screenshot means explicitly unavailable. |
| S16 | Partial batch failure, relink/retry, versioned requests and label void/refund eligibility | Here: batch rows and Why. Added: label void/refund is a distinct permitted action via Why, with actual carrier limit; never a pretend Undo of printing. |

### Left to wire

| Redesign part | Runs on today, with code evidence | Endpoint, caller and work remaining | Real states still unavailable |
|---|---|---|---|
| Order, identity, deadline, label description | Demo world selected at `app/src/app/item/[id]/ship.tsx:54-58`; label service/box parsed from decision prose at `:40-43`; fixture shippable rows from `app/src/demo/handover.ts:109`. | S `GET /v1/items/:id`, `GET /v1/orders` with item context; caller Ship controller in `app/src/item`. Existing server orders are seeded at `app/src/edge/api/orders.ts:8-10`; API route existence is not actual marketplace sync. A GET single-order route is mentioned by sold spec but absent from this handler table `:12-29`; reconcile that gap rather than invent a working call. | Fetch loading/error/empty, current deadline/order cancellation, genuine double sale and stale order. |
| Box/service/weight/insurance | Box/service Guess fields have no onChange at `app/src/app/item/[id]/ship.tsx:187-188`; missing box Blank has no onChange at `:189`. Weight and insurance are absent from Label block `:177-208`. These displayed controls do not persist usable edits. | S item attributes read/PATCH and S `/v1/orders/:id/ship {insure_cents?}`; quote/service/box/weight edit payload needs N alignment if not represented by item attributes. Caller `app/src/item`; server shipping handler currently accepts only insure_cents at `app/src/edge/api/orders.ts:26`. | Quote pending/failure, invalid package, required weight empty, unavailable carrier, changing rate and insurance refusal. |
| Label purchase, batch, layout/PDF, open/print | Print/retry/undo are timed local state in `app/src/app/item/[id]/ship.tsx:123-135`; footer says printed at `:150-153`. No PDF/print controller there. | S ship POST, S `/v1/orders/labels`, `/v1/orders/pick-list`, S job GET/events; caller `app/src/item`. Server handlers are examples at `app/src/edge/api/orders.ts:26-28`; layout validation permits only letter_2up at `:27`, so 4x6 and combined actual PDF require backend work despite planned capability. | Actual purchase acceptance/unknown result, download/print cancellation/failure, partial batch failures and existing-label recovery. |
| Manual tracking and cancellation | Local carrier/tracking/reason at `app/src/app/item/[id]/ship.tsx:101-105`; markShipped/cancel merely set local status at `:136-143`; footer calls them at `:268,279`. | S `/v1/orders/:id/ship`, N self-shipping extension per ways-out, and S decisions act for cancel_sale; caller `app/src/item`. Server ship handler `app/src/edge/api/orders.ts:26` does not accept carrier/tracking/no-tracking yet. Cancellation must use actual returned refund/account consequences. | Real sent/failed tracking, validation, cancelled order/refund, denied cancellation and unknown outcome. |
| Drop-off/collection, pick-list and money disclosures | Demo locations at `app/src/demo/handover.ts:13-19`; Maps opens and collection merely shows toast at `app/src/app/item/[id]/ship.tsx:213-219`; money schedule derives locally at `:107-108,229-239`. Payout-speed chips only change local speed at `:238-239`. | S pick-list/orders for row context. N location lookup/quote/collection booking and paid payout-speed contract if not supplied by provider; do not invent /drop-offs or /payout endpoints. Caller destination pages owned by Today/You and `app/src/item` Drop-off page. | Location denied/empty lookup/error, genuine booking success/failure, actual payout availability, unknown release date and charge acknowledgement. |
| Site evidence and reversal | SiteCopy receives no shot/saved at `app/src/app/item/[id]/ship.tsx:254-255`; SiteCopy fallback appears at `app/src/ui/parts/site-link.tsx:54-60`. Undo is local `ship.tsx:135`. | S order evidence/citation/event reads, S events undo where allowed; caller `app/src/item`. Screenshot reference and saved time must come from actual captured order evidence. | Evidence loading/missing/stale/error, unsupported undo, carrier-void denial and real reversal failure. |

## Pickup: `app/src/app/item/[id]/pickup.tsx`

**Purpose:** resolve the current pickup step with this buyer, then return to the sale.

Who and risk: a seller arranging or completing one handover; highest cost is sharing a private address or agreeing to a time they did not choose. “Current step” is a state machine, not permission to show every step together: offer availability, approve a proposed appointment, await it, then confirm handover.

### Today and what it is not

| Current order and source | Assessment and destination |
|---|---|
| Screen, header, sold ItemCard and site price, 129-137 | Convert to sheet; keep photo/buyer/time rather than a large competing money card. |
| Cancelled state, buyer request, MeetPicker, sent lines, 140-147 | Distinct states belong in separate current-step forms. Repeated `said[]` checkmarks are an event log, not the active decision. Move history to Thread/Why. |
| Who's coming, 151, 323-340 | Keep buyer identity/review summary for appointment approval. Full message history belongs in Thread, not copied bubbles inside Pickup. |
| When/where and repeated daylight/saved-spot explanations, 153-165 | Keep time/place, retain after-dark consequence only when it matters. Cut redundant reassurance for a normal public spot. |
| On my way/late, another/decline, both calendars, site/screenshot, 168-195 | All real actions, but too many equal pills. Keep current-stage action and one likely secondary; other controls become a More disclosure using existing Choice rows in a replacement sheet. Calendar providers become one system Add to calendar action after booking. |
| Address decision, 198-206 | Independent Never alone decision. Show public-place default and an Address request row; open an address-only form, never place a second black act beside appointment approval. |
| Sent lines, change-plan grid, 208-225 | Fold event history into Why/Thread; move Share plan, Move time and Cancel into More. They are not the booked appointment's purpose. |
| SiteCopy, alternate-time, address, late and cancel sheets, 231-267 | Retain as single forms under common scaffold, no nested modal pile. |
| MeetPicker, 278-318 | One availability form with selected days/spans/place and a draft. Preserve no preselected days, own message path and after-dark check. It should not sit below a pickup dashboard. |
| No-show and handover completion | Missing from this route despite §6.9. Add reachable current-step decisions, not silent automatic completion. |

### Redesign, top to bottom

Use `route-sheet.tsx::RouteSheet`, `cards.tsx::ItemCard`, `list-row.tsx::ListRow`, `chip.tsx::Chip`, `Choice`, `time-span.tsx::TimeSpan`, `thread.tsx::Draft`, `Message`, `Meta`, `loop.tsx::Approve`, `Blank`, `buttons.tsx::FootButton`, `Pill`, `IconButton`, `site-link.tsx::SiteCopy`, `why.tsx::WhySheet`, `overlays.tsx::EmptyState`, `UndoToast`, with shared layout/text. More is a Choice list in the same Sheet presentation, not a new custom menu primitive.

1. Fixed title names current task: `Offer pickup times`, `Confirm pickup`, `Pickup`, or `Confirm handover`. Passive compact ItemCard identifies the item and buyer. **The proposed/booked time and place stand out**; in the availability form the chosen times fill that role.
2. Asking: one relevant buyer Message, then day Chips with no picked day, TimeSpan for each chosen day, Choice public places including saved spot, then Draft preview. Its Send is the only approval and occupies the common footer. Draft's Edit and Take over remain secondary. The current Draft has its own Send area: adapting it to a footer slot is part of the shared footer integration, not permission to render two Send buttons. Own-message Take over pushes the actual Thread preserving the appointment draft.
3. Buyer proposed time: ListRow buyer with genuine review summary, time/place rows and after-dark consequence when applicable. Footer Approve `Confirm pickup`; light `Suggest another` and More containing Decline and Thread. No action sends a time before its tap.
4. Booked: time/place rows, buyer arrival status when actually supplied, public-place/address-request row if relevant. Before the meeting, footer light `Done` and visible light Running late. When buyer is on the way, On my way is reachable; no routine black button solely to fill a footer. During/after the meeting, footer Approve `Confirm handover` only after a person chooses that step; show actual money-received/receipt consequence and never infer payment from presence.
5. More list: Message buyer, Suggest another time, Add to calendar, Share plan, Order on site, Buyer didn't come, Cancel pickup. Availability/time changes open one form; calendars and sharing invoke native controllers with exact time/place for review. No calendar read or duplicated provider pills.

Differences between the short forms: Address has one Blank, recipient identity and `This sends your address to {buyer} in the site chat`, then Approve Send address. Running late has existing 10/20/30 minute Chips, an editable own-message path via Thread and Approve Send update. Suggest another uses the availability form, preserving the booked slot until the replacement is agreed. No-show is one resolution choice: Rebook, Next buyer (only if one exists), Relist (only if permitted); footer names the selected consequence, no silent cancellation or relisting. Cancel has buyer-message and listing consequence, destructive secondary confirm; do not assert back on sale until the site confirms it. Confirm handover is a single explicit sale-completion decision with the exact transaction terms.

### States and interactions

| State | What shows and what can be done |
|---|---|
| First load | Shared loading plus cached identity/time. No approval until appointment status is known. |
| Loaded | One of asking, proposed, booked, buyer travelling, handover awaiting confirmation, completed, cancelled. Each uses the current step above; never show conflicting confirms together. |
| Empty | No appointment yet but a buyer request: availability form. No sale/buyer at all: EmptyState `No pickup planned`, Open item. No days selected: Send disabled with `Choose a day`, keep place visible. |
| Partial | Missing public place requires a place choice before sending. Missing buyer reviews says `No reviews available`; never invent a rating. Missing arrival signal is simply absent. Time-zone/date ambiguity blocks Confirm until clarified through Thread. |
| Loading more | No pagination of this one appointment. Long thread history lives on Thread. A week's finite day options stay fully accessible. |
| Refreshing | No pull. Reconcile arrival/time changes from events without replacing unsent availability or address. A changed appointment invalidates an obsolete approval and shows its new time. |
| Offline | Cached appointment and address locally visible only as authorized; local edits preserved. Send, time approval, late message, cancel and handover confirmation cannot claim completion. Show Connect to send/confirm and allow explicit retry. |
| Error and retry | Fetch failure has Retry; send failure keeps exact drafted message. Unknown send outcome checks conversation before resending. A failed calendar/share controller does not cancel the appointment. |
| Completed/cancelled/no-show | Actual outcome, Close to Item. No-show retains old appointment facts while resolving it; cancelling navigation is not cancelling the appointment. |
| Top, down, up, tab retap | Shared fixed title/footer, no scrolling-dependent action changes. Meeting stage updates come from data, not scroll direction. |
| Keyboard | Address or Draft edit expands the same form; labels and recipient remain visible, footer above keyboard. Return does not send. |
| Reduce Motion | Shared fade; availability spans track touch directly, with no bounce; arrival never pulses. |

Day, span, place and lateness picks stage values only. TimeSpan snaps to existing half-hour steps; its accessible increment/decrement is the non-drag path. Existing selected day has no automatic consent effect. Draft Send and Confirm pickup use light haptic after valid explicit commit; Back never agrees or rejects. Suggest another replaces the form, then restores the parent context on Back. Decline, Cancel, Share address and handover each get their own consequence and tap, no automatically promoted rule. Add to calendar opens a system event editor only after booking; dismissing it leaves the appointment unchanged. Share plan opens native Share with the actual message and place; no automatic send. Thread pushes with ordinary edge Back. The rare confirmed sale-completion moment can use `MOTIONS.sold` and existing success haptic on the Item, once, rather than playing a second celebration inside Pickup.

### Copy changes

| Source | Change and reason |
|---|---|
| 124, long `Meet {buyer} {when}` | `Confirm pickup`; recipient, date and place remain adjacent above. Exact consequence preserved without truncating a person's name to “them”. |
| 140, cancelled line claiming relist | Show only acknowledged buyer-message and listing state, otherwise `Cancelling pickup` or operation-specific error. |
| 157, `In daylight` | Cut ordinary-state caption, keep After dark when it changes the decision. Ladder 1. |
| 161, `Your saved spot, out in public` / `A place you picked` | Cut repeated provenance sentence; place selection and a concise Saved label suffice. Ladder 2. |
| 185-186, two provider-specific calendar buttons | `Add to calendar`, one system control. Ladder 2. |
| 208-211 and 146, accumulated sent receipts | Move to Thread/Why. Show only the latest action's result in place. Ladder 1. |
| 243, `Only you can send this` | Cut that clause; keep recipient and actual transmission consequence. Ladder 3. |
| 249-251, minute choices | Keep units, no abbreviation requiring interpretation; add an own-update path, do not cap what a person may say to three durations. |
| 262, item back on sale claim | State only the actual cancellation/relist consequence the site can perform. Safety copy remains before confirm. |
| 315, `Tap the days that work. The agent writes ...` | `Choose days` only in the empty selection state; cut agent narration. Ladder 2. |


### Planned features

Owners sold and messages, with data/assist supporting evidence and drafts. Sources: pages §6.9/§7, `spec/features/sold.md:62-75,128`, `spec/features/messages.md:50-65,83-98`, and the no-fixed-windows and replies-start-as-drafts decisions. Old auto-booking/window language does not authorize new automatic appointments.

| ID | Planned capability | Disposition in this redesign |
|---|---|---|
| K01 | Choose this week's days/spans and public place when asked; no calendar read or preselected days | Here: availability form with typed/manual alternatives where needed. |
| K02 | Draft times/place in plain words, edit/take over, all outbound text gated | Here, Added: before every Send or changed-pickup message, including own text, claim_check allow/hold/abstain applies. A held claim offers Edit, Leave it out, Confirm this fact or Don't send; unresolved only-you facts remain Blank. |
| K03 | Who is coming: actual name, review history and source conversation | Here: proposal's buyer summary and Message buyer disclosure, no fabricated profile. |
| K04 | Buyer proposes a time, person approves/suggests another/declines | Here: Confirm pickup single decision; no promotion or acceptance from merely viewing it. |
| K05 | Booked time/place, buyer On my way and seller travel update | Here: booked view and current travel action; distinguish actual buyer signal from seller's own update. |
| K06 | Saved public spot first; home address on its own explicit tap | Here: Address request and recipient-specific send form, never auto-promoted. |
| K07 | Running late with actual update and own wording | Here: lateness form and Thread escape. |
| K08 | Move/rebook without losing the still-valid old agreement until accepted | Here: Suggest another availability form and explicit buyer-message send. |
| K09 | No-show: rebook, next in line or permitted relist | Here, Added: awaiting resolution does not close the sale; appointment no_show and selected sale consequence become real only after acknowledgement. Next buyer exists only when data supplies one. |
| K10 | Cancel pickup, message buyer, show actual listing/sale consequence | Here: cancellation decision; undo only if semantically supported, not undoing a sent message. |
| K11 | Add agreed time to calendar only after booking | Here: system event editor write; no account calendar access is needed. |
| K12 | Share plan with a trusted person, exact time/place and public-spot safety | Here: native Share review. Sharing the plan is different from sending a home address to the buyer. |
| K13 | Handover by buyer-code scan or explicit person tap, money/receipt confirmation | Here, Added: light Scan buyer code alternative opens Camera scoped to this order, then returns to the same Confirm handover decision. The code verifies identity, not payment; final state comes from order response. |
| K14 | Full messages, scam/off-site-payment warning, block buyer and source evidence | Elsewhere: Thread/Today through Message buyer and Order on site; no second inbox in Pickup. |
| K15 | Public place preferences and correcting stored location | Elsewhere: You's pickup/place preferences via Change saved place, preserving appointment draft. This is not permission to restore fixed pickup windows. |
| K16 | Post-sale reviews, dispute/claim evidence, ledger/payout and records | Elsewhere: Item/Today and You Payment details, through Order details. |

### Left to wire

| Redesign part | Runs on today, with code evidence | Endpoint, caller and work remaining | Real states still unavailable |
|---|---|---|---|
| Identity, booked slot, buyer request/profile and arrival | Fixture world/order/appointment at `app/src/app/item/[id]/pickup.tsx:47-50`; request/pick/profile fixtures imported at `:18` from `app/src/demo/handover.ts:84-90`; fixture time override at `pickup.tsx:91`; profile rendering at `:324-336`. | S `GET /v1/orders`, `/v1/appointments`, conversations/messages and stream; caller Pickup controller in `app/src/item`, shared conversation state with Messages. Appointment handler is example-only at `app/src/edge/api/orders.ts:24`. Buyer arrival/profile fields need N adapter shape if not returned; do not turn the local buyer name into verified identity. | Real loading/error/no appointment, awaiting buyer, changed slot, actual arrival/no-show/cancelled/done and freshness. |
| Availability, place, proposed time and approval | Local day/span/place state at `app/src/app/item/[id]/pickup.tsx:263-276`; Draft Send uses a timer at `:313`; approval uses later/setApprove at `:123-125`. | S conversation message POST and decisions act for schedule_pickup; S appointment read. N move-time semantics per ways-out. Caller `app/src/item` with Messages controller. Wire signed options/version and preserve accepted appointment until replacement acknowledged. | Sending, held/abstain, rejected time, changed version, partial delivery, unknown send and actual booked result. |
| Address, keep-public-place, late, decline and cancel | `tell` only writes local said state at `app/src/app/item/[id]/pickup.tsx:105-108`; address approval calls it at `:238`, late at `:245`, cancellation timer at `:251`; decline local cancellation at `:175-178`. | S decisions act for share_address/running_late/cancel/decline and S messages POST with claim gate, not a direct text-send bypass. Caller `app/src/item`; confirm actual decision kinds/available options from server rather than invent routes. | Real validation, address-send pending/failure, buyer notification, cancellation/refund/relisting eligibility and no duplicate messages. |
| No-show and handover/code | Nothing yet in current booked/change-plan section `app/src/app/item/[id]/pickup.tsx:212-221` or its Open union `:78`: there is no no-show or handover control there. | S decisions act for no_show and S `/v1/orders/:id/handed-over`; N code-payload verification/scanner handoff if not supplied by order backend. Caller `app/src/item` and Camera handoff. | Actual no_show resolution, next-buyer unavailable, invalid/foreign code, confirmed payment/handed_over and error/retry. |
| Calendar, plan sharing and source screenshot | Actual OS/link intents, fed fixtures: `app/src/app/item/[id]/pickup.tsx:112-120` opens calendar URLs and Share; site URL opens at `:190`; SiteCopy has no shot/saved at `:226-227`. These do not prove event creation or message delivery. | Local system calendar/share integration with acknowledged appointment. S order/conversation evidence read for SiteCopy. Caller Pickup route/destination Messages; no calendar-read endpoint. | OS cancellation/permission failure, unavailable screenshot, event creation confirmation where controller supports it; sale must stay unchanged on cancellation. |
| History, safety, saved place and undo | Repeated local said lines at `app/src/app/item/[id]/pickup.tsx:205-209`; cancelled Undo restores local mode at `:251`; saved spot from fixture limits at `:86`. | S events/citations, messages and appropriate limits read/write for saved public place; S events undo only where allowed. Caller Item/Thread/You detail. Do not expose an Undo for an already sent address/message or accepted offer. | Real history empty/error, blocked buyer, saved-place failure and actual compensation denial. |

## New: `app/src/app/new.tsx` and `app/src/ui/parts/takeover.tsx`

**Purpose:** choose whether to sell, value or find a thing, then enter that chosen capture flow.

Who and risk: anyone starting a thing, daily rather than per message; the mistake is entering a selling flow when they only wanted a value, or thinking a draft-creation tap publishes. New is an entry chooser, not a fifth peer tab, a listing editor or a universal search page.

### Today and what it is not

| Current order and source | Assessment and destination |
|---|---|
| Transparent takeover and expanding field, new.tsx:62-65; takeover.tsx:37-39, 61-96 | Keep the intentionally chosen origin-aware New mechanism. Do not replace it with a generic sheet. |
| Three capsules, remembered order and pencils, new.tsx:33-34, 66-71; takeover.tsx:128-195 | Keep all three intents and equivalent text/link paths. Remembered order is current behavior; do not change order during a presentation. Secondary pencil label must name the same intent. |
| PlusClose, new.tsx:73; takeover.tsx:108-124 | Keep visible Close at the same origin; it is not a destructive cancel. |
| Camera circle, new.tsx:74-78 | Keep animation but make camera transition cancelable. There must be one camera session per chosen intent despite rapid taps. |
| Text/link sheet plus price and anomaly check, new.tsx:80-85 | One input form is appropriate, but seller price/anomaly belong in Plan, not before a draft exists. “List at” in line 58 falsely implies publishing. Move price control and confirmation to Plan; inbound price can be saved as an uncommitted draft fact. |
| Shared external link defaults to sell, 26-30 | Do not silently change an established routing decision. Show the selected Sell intent in the sheet title and allow closing to choose Worth or Find with the same link retained. No publication occurs. |

### Redesign, top to bottom

Use existing `takeover.tsx::TakeoverPlace`, `CircleStage`, `ChoiceColumn`, `ChoiceCapsule`, `PlusClose`, `usePlus`, `useChoices`, and `camera.tsx::FeedLayer`. These are all in `app/src/ui/parts/`. The text entry uses the unified `overlays.tsx::Sheet`, `loop.tsx::Blank`, `buttons.tsx::FootButton`, `list-row.tsx::ListRow` for a recognized item, and the common text/layout parts.

1. TakeoverPlace with the existing CircleStage field originating at Plus; no header, large title, navigation bar or added paragraph. **The last-used intent's icon well is the one emphasized element**, existing ChoiceCapsule lead behavior; the other jobs remain equally reachable.
2. ChoiceColumn holds Sell this, What's it worth, Find this, with each existing pencil for Describe or paste a link. Keep actual mode identity through every entry. No fourth action and no in-between pricing question.
3. PlusClose remains in its original lower position. Keep available during entrance; once a text form opens it is behind the active modal and cannot discard that input.
4. Pencil opens a single Sheet titled with that intent, Blank `Description or link`, recognized identity if there is a real match, footer `Create draft`, `Check value`, or `Find matches`. Link sell uses `Import listing`, still a private draft. No ask-price field. Returning retains draft text for that mode while New is open; intentionally discarding clears it.

### States and interactions

| State | What shows and what can be done |
|---|---|
| First load / loaded | Three locally available choices immediately; no network splash. Camera permission/loading begins only on selection. |
| Empty | The chooser itself cannot be empty. Blank input has labeled field and disabled form action until there is a description/link. No generic empty illustration. |
| Partial | Recognized item may be shown while link import metadata is pending. Keep original input, allow editing or cancel. Never claim a match that is only a demo heuristic as a verified fact. |
| Loading more | Not applicable, fixed three intents. No pagination or extra reveal gesture. |
| Refreshing | No pull or refresh. Choice order and default lead freeze for this presentation; remember the committed choice for the next opening. |
| Offline | Chooser and camera still work with local captures. Description can create a local draft; link fetch/value/search remains visibly waiting for connection on its destination, with explicit retry. No fabricated listing imported. |
| Error and retry | Failed description/link submission remains in the input form with exact input and Retry. Camera denial goes to camera's existing permission/fallback controls, including own photos; New never traps the person behind a spinner. |
| Top, down, up | No scroll in normal chooser, so no header change. Largest Dynamic Type may require a scrollable choice region while Close stays safe; this is a required extension to ChoiceColumn, not smaller text. No collapse, floating action or tab-bar animation. |
| Retap current tab | Underlying bar inaccessible during takeover. Close returns to unchanged origin; then the owning tab's retap behavior applies. |
| Keyboard | Only text/link form; shared scaffold expands and keeps action visible, respects dirty guard and hides keyboard before sheet dismissal. |
| Reduce Motion | CircleStage and camera crossfade in place; capsules appear together without spatial stagger; PlusClose presents its final cross orientation without rotation. Dark mode never flashes a light field. |

Capsule main target selects a mode, uses `MOTIONS.newOpen` 300 ms and `newChoice` 200 ms with existing 30 ms stagger for entry; camera uses `MOTIONS.cameraOpen` 300 ms from the chosen well. No added pause or haptic on camera navigation. `MOTIONS.select` 200 ms closes toward Plus. Once a mode is selected, duplicate taps do not create another navigation; Close or system Back may cancel before navigation commits. Camera replaces New as today, with origin retained beneath the capture flow; cancelling camera returns to origin, not a dead New animation. The pencil presents the common Sheet; Back/Close/scrim follows its dirty guard and returns to the chooser. Form action creates one draft/job and routes to Item, Worth or Search as appropriate; Back returns to the originating tab, not a form that would duplicate creation. Light haptic on actual valid draft creation/job submission only, never on text recognition.

### Copy changes

| Source | Change and reason |
|---|---|
| new.tsx:58, `List at {amount}` | `Create draft`; price moves to Plan. Accurate action, ladder 1. |
| new.tsx:58, `Bring it in` / `Make a draft` | `Import listing` / `Create draft`; explicit object, C6. |
| new.tsx:59, `See what it’s worth` / `Find it` | `Check value` / `Find matches`; concrete next action. |
| new.tsx:81, `What it is, or a link` | `Description or link`, persistent field label. |
| new.tsx:83-84, price and anomalous-price text | Move intact to Plan's relevant validation state; not required to select intent. |
| takeover.tsx:176, pencil accessibility label | Keep the intent plus `Describe or paste a link`; this is necessary to distinguish the two targets. |
| Capsule labels sourced by new.tsx:68 | Reconcile CHOICES in `app/src/demo/capture.ts` to the same three names everywhere, including camera, without introducing a new visible string in this spec's code. |


### Planned features

Pages §6.4 has no separate Features cell. §7 maps the downstream branches to capture/measure/identify/studio, appraise/price, buy/watch and assist; these engines do not all belong in the chooser. Read their feature READMEs/specs rather than treating the three labels as the complete scope.

| ID | Planned capability | Disposition in this redesign |
|---|---|---|
| N01 | Exactly Sell, Worth and Find entry intents, camera purpose retained | Here: three ChoiceCapsules and the chosen mode handoff, no fourth photo-upload job. |
| N02 | Last-used intent first and retained between visits | Here: remembered order, frozen while open. Added: persistence must survive app restart, not only module memory. |
| N03 | Hold Plus to skip chooser and open last-used capture intent | Here, Added: normal Plus long press in the tab scaffold opens that camera directly; same permission/return path and visible tap chooser alternative. No haptic loop or hold-to-publish. |
| N04 | Type description or paste link for each intent, same eventual destination as camera | Here: one form per intent. Keep raw input and provenance; do not reword the user's search silently. |
| N05 | Existing listing link to cross-list, one item and private review before posting | Here: Sell link input initiates actual read/import and returns an identified draft with source attribution; failed link offers photos/manual description. Never reuse the fixed jacket as an imported listing. |
| N06 | Capture purpose vs process mode, type-aware process and no lost source context | Here: entry payload distinguishes purpose sell/appraise/find from mode shots/scan/talk and carries source URI or description into downstream intake. New chooses purpose, not a guessed process mode. Reconcile worth in the UI/finish feature contract with appraise in the canonical capture purpose at a single adapter boundary. |
| N07 | Offline local entry, no camera/no LiDAR/no permission paths, preserve input and origin | Here: local capture/text entry plus exact destination fallback. Outward work still needs connectivity and its actual approval. |
| N08 | Assist under typed input: editable guesses, blanks, Other, leave out/undo; one widget at a time | Here, Added: inferred identity/options appear under the field using existing Guess/Blank/Choice parts and explicit Apply. True marked text inside the person's input is **NEW PATTERN, needs Ben's OK**: existing Blank has no interactive span/selection renderer. Reconcile that shared input with Buy/Messages; no chatbot or new clarification page is substituted. Parser failure keeps plain text usable. |
| N09 | Guided shots, auto-keep/retake, talk tree, mask/privacy, capture analysis facts/counts, resume | Elsewhere: Camera, entered by the capsule; guided shot list remains default, talk requires its own tap. |
| N10 | Camera-roll/folder import, grouping/approve_groups, one draft per group and own photos | Elsewhere: Camera photo button, never a fourth New choice. Group approval belongs in its own decision there. |
| N11 | Identification candidates/Not this/None of these, measured vs typed facts and confirmation | Elsewhere: Camera/Item review. Wrong identity can be corrected without discarding photos; no percentages. The recognized line in the entry form has a light Not this disclosure to that destination, carrying raw text/link evidence rather than asserting an exact identity from image similarity. |
| N12 | Clothing measurement correction, rigid-item LiDAR, no-scale fallback and truthful units | Elsewhere: Camera and Item measure_review; New does not promise LiDAR on every phone. |
| N13 | Rough Glance, recall, Check/Deep, max pay, haggle offline, Sell/Keep/Bought/Trade-in/Donate | Elsewhere: Worth, reached by Worth intent; rough is labelled, no verdict when recall unavailable. Owned/kept item remains unposted. |
| N14 | Photo search, all-market results/official alternatives, save Want when no match, watch availability/under price | Elsewhere: Search/Listing/Want through Find, preserving source image/text, then Buy; alert, cadence and purchase approval stay there. |

### Left to wire

| Redesign part | Runs on today, with code evidence | Endpoint, caller and work remaining | Real states still unavailable |
|---|---|---|---|
| Chooser, ordering, origin animation and long press | Local state and `ordered`/rememberMode at `app/src/app/new.tsx:32,49-50`; chooser/camera navigation at `:44-55`. Plus target only passes onPress at `app/src/ui/parts/chrome.tsx:177-182`; Press's signature has no long-press handler in `app/src/ui/press.tsx:30-67`. | No API for choosing a mode. Caller New/tab scaffold; persistent last-mode store and long-press Press contract still needed. Current tab circle is 48 in `app/src/ui/parts/chrome.tsx:186-192`, while takeover PLUS is 56 at `app/src/ui/parts/takeover.tsx:42`; reconcile actual measured origin rather than assume the prior 56 assertion matches changed code. | Restart-restored default, long-press skip, cancelled/interrupted transitions and correct origin after layout change; these are local behavior gaps. |
| Describe/link Sell and recognition | Fixture matcher uses PRODUCTS at `app/src/demo/capture-edges.ts:5,41-43`; Sell action routes straight to DRAFT_ID at `app/src/app/new.tsx:53`; DRAFT_ID and jacket data are fixed at `app/src/demo/capture.ts:119-127`. No actual import/creation from typed input here. | S capture creation/attribute PATCH for a real draft, plus N description/link intake mapping not specified by New feeds. Current capture handler accepts mode/purpose and hints, not a general description/url field at `app/src/edge/api/captures.ts:304-309`. Caller New intake in `app/src/item`; reuse account import for supported linked inventory, do not invent an already-supported POST /items. | Creating, import progress/error/blocked link, empty recognized result, duplicate import, local-only draft and source/readback failure. |
| Worth text/link submission | `app/src/app/new.tsx:54` navigates with a fixture product match, no valuation POST in this branch. | S `/v1/valuations` with capture_id or url_ref, S jobs GET/events and item/citation reads; caller New handoff to Worth module/route. The feature's GET /valuations/:id is still a model need, not an implemented read here: `app/src/edge/api/valuations.ts:26-46` exposes only POST, and `:27` accepts url rather than the feature's url_ref. Align that payload/read contract; job/item retrieval is the known fallback. | Actual rough-vs-Check arrival, recall outage, valuation abstention, source failure, retry and retained offline input. |
| Find text/link/image handoff | `app/src/app/new.tsx:55` only passes q to Search; initial mode route at `:47` has no capture identity yet. | S `POST /v1/search`, downstream S wants/matches/compare/out; purpose N8 on capture. Caller New and `app/src/buy`; preserve captured image/link, source title and original query, then create Want only with its own save tap. | Real search stages, per-site partial/error/empty, unavailable visitor stream and genuine no-match-to-Want handoff. |
| Assist and typed corrections | Nothing yet in text form `app/src/app/new.tsx:80-85` beyond one fixture recognized caption and local price warning. | N `/v1/assist` and the proposed span workflow in the assist feature spec, job events/poll, decisions act and events Undo. Caller New input controller shared with `app/src/buy`; signed decisions/visitor answer semantics must be preserved. | Parser loading/error, plain-text fallback, stale options, server-applied assumption/Undo and changed-field rerun. |
| Camera/photo intake and privacy | New only replaces to Camera with mode at `app/src/app/new.tsx:46-48`; bundled web feed appears at `:76-77`. This is a functioning navigation handoff, not evidence that native capture uploads are wired. | S captures open/read/photos/finish, S item read, N8 purpose/talk transport, job stages/fact.found/found.comps. Caller Camera and `app/src/item`; owned by capture lane, pass actual IDs back. | Actual upload failure/resume, identity/measure/studio stages, permission/no-LiDAR fallback and completed draft identity. Verify destination separately; no claim here that all camera behavior is absent. |

## Kit sheets and overlays

The common state/interaction contract applies to each kit surface below, including keyboard, scroll directions, dismissal, retap and Reduce Motion. Differences are explicit here. These are reusable parts, so “first load” refers to caller-owned data, never a second independent fetch in the component.

### `app/src/ui/parts/offer-sheet.tsx::OfferSheet`

**Purpose:** choose the amount of one offer to one seller, then approve sending it.

Today, top to bottom: Sheet title Offer at line 37, List of suggested Choice amounts plus Something else at 38-41, conditional Blank at 43, Approve or disabled FootButton at 44-48, site-payment consequence at 49. This passes one decision. It lacks listing/seller context, common footer ownership and dirty/input handling. The open effect at 33 resets typed input whenever `pick` changes; a refreshed suggestion must not overwrite a touched field. The failure claim at 46 is unsafe for an unknown site response.

Redesign: unified Sheet title `Make an offer`; compact `cards.tsx::ItemCard` with listing photo/site/asking price and seller identity supplied by the caller, then `chip.tsx::Choice` amount rows including Other amount; `loop.tsx::Blank` when Other is selected; one real payment consequence; pinned `loop.tsx::Approve` `Offer {amount}`. Suggested amount and fair-range note use real caller evidence, not an invented “recommended” amount. **Offer amount stands out.** No Watch setup, fee dashboard or counteroffer conversation inside this form. Those belong to Want, source evidence via WhySheet, or Thread.

| State | Behavior |
|---|---|
| First load | Cached identity immediately; amount suggestions may load but Other amount stays available. No automatic offer selected unless caller supplies a real prior draft or explicit suggestion. |
| Loaded / empty | Suggested amounts, chosen tick and one approval. No selection means disabled Offer with inline `Choose an amount`. Empty suggestions still allow Other amount; missing listing means no send and return to origin. |
| Partial / invalid | Keep known asking price. Unknown shipping/payment binding facts must be checked before approval. Invalid, zero, nonfinite, above-rule or changed-price amount has inline specific error; disabled label remains stable, not an error paragraph inside a button. |
| Loading more / refreshing | No pagination and no pull. Recheck availability on submit and re-open; never reset Other input when suggestions refresh. |
| Offline | Keep draft amount; Send unavailable with Connect to send and explicit retry. No background offer after reconnect without its approved request. |
| Working / failed / unknown | Single request, same amount and recipient locked. Failure preserves amount with Retry. Unknown outcome checks whether an offer was created before resending; no `Nothing was sent` unless verified. |
| Sent / unavailable | Acknowledged offer appears on source listing with actual expiry if supplied, sheet returns there. A sold/removed listing disables Send and explains it; stale selection cannot create a new offer. |
| Top/down/up, retap, keyboard, Reduce Motion | Exactly the shared sheet rules; no large title, no floating send. Numeric keyboard only for Other amount; Return ends editing. |

Choice selection is in place with select 200 ms; Other opens its field, not a new modal. Approval uses press spring and one light haptic after validation. Back/edge rules are shared; no navigation sends. No offer is promotable to automatic. Offer revocation, if supported, lives on the resulting offer and states its actual deadline; do not promise a universal Undo.

Copy: line 39 `Something else` becomes `Other amount` (the object matters); line 46 `Send a ... offer` becomes `Offer ...` with recipient above. Line 48 moves `problem(amount)` from disabled button text to an inline field error (ladder 4). Line 49 survives only as the actual site's consequence: `If they accept, you pay on the site` must be replaced if the site's acceptance is binding or payment happens differently. Line 46's failure becomes `Couldn’t confirm the offer` for unknown result, with Check status. Do not assume the current generic sentence is true for every marketplace.


### Planned features

OfferSheet is not a page row in §6. It is the buyer's offer form carried by Listing/Want/Buy in pages §6.14 and §7, with buy/appraise/messages/assist rules. Sources: `spec/features/buy.md:12-24,135,140-151`, `spec/features/messages.md:50-65,97-98`, and appraise's Who may act.

| ID | Planned capability | Disposition in this redesign |
|---|---|---|
| O01 | Offer only as a full signed-in user, preserve the intended action through sign-in | Here, Added: unauthenticated caller presents sign-in over the source listing and resumes the same unsent amount/context afterward. Visitor search and source viewing remain available. |
| O02 | Suggested amounts, custom amount, real listing/seller/site context and expiry | Here: Choice/Blank and compact identity. Suggestions are explicitly suggestions; actual returned offer carries expiry. |
| O03 | Price vs delivered total, shipping/fees and max_total, site-specific binding/payment consequence | Here, Added: net cost to buyer, including available shipping/fees, appears beside the amount. Unknown total is not asserted as final. Exact binding commitment appears before Send; generic pay-on-site wording cannot replace it. |
| O04 | An offer above the person's ceiling asks separately | Here, Added: offer_over_ceiling single confirmation replaces the form, naming exact delivered amount and previous limit, with Back restoring the draft. It does not silently raise the saved Want budget. Asking-price and platform-validity rules still apply. |
| O05 | Every offer explicitly approved, signed/versioned, locked commitment never promoted | Here: Approve and returned buy_offer decision. No Always action, repeated tap or retry may send another offer. |
| O06 | Outbound offer note, when supplied, passes claim_check; unsupported/held claims editable or omitted | Here, Added: if the source supplied an offer note, preview it and expose Edit note through the existing Draft/Blank pattern. No obligatory new note field. Hold/abstain resolves before sending; exact offer amount does not imply approval of unsupported text. |
| O07 | Seller counter, expiry and purchase-followup decision | Elsewhere: source Listing/Thread/Today shows seller_counter or did_you_buy, with its own approval, never silently accepting a counter inside the closed offer form. |
| O08 | Fair-range evidence, official alternatives, watch/save, final payment and purchase record | Elsewhere: Listing/Worth/Want for comparison/save/watch, site checkout for payment, Bought it on return. Offer sheet's one purpose ends at the acknowledged offer. |

### Left to wire

| Redesign part | Runs on today, with code evidence | Endpoint, caller and work remaining | Real states still unavailable |
|---|---|---|---|
| Amount options, custom field and validation | Caller props/local state in `app/src/ui/parts/offer-sheet.tsx:16-35`; choices at `:38-43`; demo amount suggestions and asking-price-only check in `app/src/buy/read.ts:25-35`. No delivered ceiling/fees validator here. | S compare/match/Want reads plus returned decision; caller `app/src/buy`, supplying ItemCard/seller/site and actual max_total/fees/binding facts. No new standalone GET /offers endpoint is needed. | Actual loading/error/removed listing, unknown fees/total and expired proposal. |
| Send/approval/result | OfferSheet delegates onSend at `app/src/ui/parts/offer-sheet.tsx:46-47`. Both audited callers simulate: `app/src/app/listing/[id].tsx:55` and `app/src/app/(tabs)/buy.tsx:54` mark sent after timers. Neither timer proves an offer reached a site. | S `/v1/matches/:id/act` where the spec's action can propose buy_offer, then S `/v1/decisions/:id/act {option_id,signature,version,edit?}` authorizes it; S job events/status and stream reconcile. Caller `app/src/buy`; do not assume the canon's currently enumerated match actions already accept direct offer (check feature/canon mismatch). | Sending/acknowledged/failed/unknown, genuine expiry, counter arrival and duplicate-send recovery. |
| Sign-in, ceiling confirmation and optional note/claim gate | No auth/ceiling/note controls in the current complete form body `app/src/ui/parts/offer-sheet.tsx:36-51`; current failure text assumes Nothing sent at `:46`. | S auth session/resume, S decisions act for offer_over_ceiling/buy_offer/unbacked_claim and S message/job paths for any note. Caller `app/src/buy`, session shared app-wide. Wire actual available signed options rather than invent boolean client permission. | Login cancelled/failed, ceiling denied, held/abstain, stale signature, changed price and unresolved send outcome. |
| Dismiss/reopen, context and footer | Current useEffect resets amount/Other when open or pick changes at `app/src/ui/parts/offer-sheet.tsx:33`; action stays within scrolling children at `:44-50`. | Local shared scaffold and caller draft persistence, no network endpoint. Context supplied by caller plus acknowledgement identity from the request. | Dirty-dismiss recovery, keyboard/footer behavior, refresh that preserves Other input and focus return. |

### `app/src/ui/parts/route-sheet.tsx::RouteSheet`

**Purpose:** host one routed decision with its origin intact, then dismiss to that origin.

Today: animated scrim 67-72; height-limited Surface 75-76; draggable grabber/title 77-82; plain ScrollView 83-85; optional safe-area footer 86. It already has the right visual hierarchy. What it is not: a second navigator, a forced full-height page or a way to suppress Back without a reason. No title duplication or page-level wash inside it.

Redesign: retain those same parts and order, add the shared scaffold's visible Close, detent/body gesture handoff, dirty guard and keyboard handling at this layer. Current `pan.onUpdate` starts from translation rather than captured presentation value and close sets a permanent lock; fix both to allow interruption. Current ReduceMotion.System setting alone does not establish a crossfade, so explicitly supply the shared fallback. A deeply linked route must have the correct Item anchor. **The caller's decision is the focus**, not the shell.

States: first load, empty, partial, offline, errors and retry are caller content; the shell keeps title and Close usable in each. Loading more is caller content and never a shell spinner. Refresh has no default pull. At top/down/up and active-tab retap use the shared table. Keyboard shifts the body/footer together. Open, partly dragged, cancelled drag, detent changed, dismiss attempted with dirty work, close interrupted, request pending, closed and reopened must all restore the right content and scroll, including Reduce Motion. None of these states can call onClosed twice. No new copy except Close and the common discard decision.


### Planned features

This is the container for P01-P18 and T01-T18 and the proposed short Ship/Pickup decisions, not an independent feature in pages §7. It must preserve item identity, one approval, ways out and asynchronous job recovery for those capabilities. All are in the shared scaffold above. Added: a caller whose work leaves the sheet must retain the item/job ID, origin and staged fields; moving a form to a disclosure cannot discard its planned payload.

### Left to wire

| Part | Today and evidence | Remaining work and states |
|---|---|---|
| Presentation, scrolling and footer | Actual local gesture/animation code at `app/src/ui/parts/route-sheet.tsx:41-63`, body/footer at `:75-86`; no API request belongs here. | Shared UI implementation, not an endpoint: medium/large/content detents, visible Close, scroll/drag coordination, catchable close and safe keyboard footer. Test open/drag/snap/dismiss/interruption plus loading/error/empty caller content. |
| Dirty state, Back and draft restoration | Props include onClosed but no dirty/draft/focus/keyboard contract at `app/src/ui/parts/route-sheet.tsx:28-39`; scrim invokes close directly at `:70-71`. | Caller `app/src/item` owns draft/origin/version; shell invokes guard once on every dismissal. No endpoint for local discard; server Save stays caller-owned. Dirty/clean/request-unknown, cold deep link and keyboard-up Back are not implemented by these props today. |
| Background work and API results | Child content and foot are caller ReactNodes at `app/src/ui/parts/route-sheet.tsx:35-39,83-86`. | Do not fetch in shell. Item/Buy callers wire the endpoints listed above and return actual job states; shell remains usable across request failure, no data and offline. |

### `app/src/ui/parts/overlays.tsx`

This file contains four different primitives; only Sheet is a decision container.

| Part | Purpose, current assessment and redesign |
|---|---|
| `Sheet`, 18-39 | Host one local decision, then return to its caller. Today a Modal, scrim, animated Surface, title and children, with no grabber, scroll limit, safe-area footer or keyboard strategy. Unify with RouteSheet's contract above. Header/body/footer order and the caller's focal point are identical. Do not use it for multi-subject settings or stacked nested dialogs. |
| `UndoToast`, 44-66 | Offer reversal of one acknowledged action. Today FadeIn, a 5-second timer, one-line body and Undo. Keep existing 5-second guidance; position once above the active footer/keyboard or tab bar through the host, never as an ordinary scrolling child. Not a second primary and not a confirmation. Long text and Dynamic Type cannot truncate the identity of what is undone; host needs flexible accessible layout. Undo uses Press, no navigation, select 200 ms appearance and feedback 150 ms exit, no extra haptic. On reversal failure retain actual result and show Retry reversal at the origin. Timer expiry removes the toast, not the action's history. Pause the dismissal while accessibility focus is interacting; persistent supported reversal remains in Why. |
| `EmptyState`, 71-79 | Explain absence and give the one action that resolves it. Keep title, optional essential sentence, one Pill. It is not a celebratory moment or an error bucket. No extra illustration or unrelated checklist. Its caller supplies empty/error/offline distinctions and real Retry. The action does what it says using standard Press and normal navigation; no haptic for navigation. |
| `Skeleton`, 83-99 | Reserve known content geometry while data loads. No controls and no decoration. Keep static gray and accessible Loading. Choose only a matching shape; current variants are notice, card-item and card-decision. A row form uses labels and unresolved values, not a fake card skeleton. Skeleton never persists as the empty/error state and never shows fabricated values. |

State coverage: Sheet uses the shared complete matrix. UndoToast is absent before acknowledgement, visible after success, reversing on Undo, removed after confirmed reversal or expiry, failed with an explicit retry at origin; offline Undo preserves the actual action and never claims reversal. EmptyState renders caller-owned missing, zero-result, offline or failure state with the relevant next action. Skeleton is only delayed first-load or missing-part content, never loading-more over an already usable form. All four are stable at top/down/up; no scroll listeners. No tab retap through a Sheet; a toast does not block the underlying tab. None owns keyboard input; Sheet hosts it, toast avoids it. Reduce Motion is opacity or instant, no slide for Sheet and no shimmer. Copy changes: cut `EmptyState.line` when it repeats the title; keep `Undo` and `Loading`; never use Saved/Sent/Printed before the operation acknowledges it. There are no other permanent product strings in this file to rewrite.


### Planned features

No independent page/feature row exists for overlays in pages §§6-7. Sheet, EmptyState, Skeleton and UndoToast carry the already counted page capabilities above: a single decision, honest waiting/absence/failure and supported compensation. Added: every Undo must retain its event ID and site/window eligibility, while every empty/error action receives a real caller callback. Notification/transient copy does not create another product capability.

### Left to wire

| Part | Today and evidence | Remaining endpoint/caller and states |
|---|---|---|
| Sheet | Local Modal/scrim/Surface at `app/src/ui/parts/overlays.tsx:18-39`. Only open/title/onClose/children props, no footer/dirty/keyboard contract at `:18`. | No API. Share RouteSheet scaffold for every lane. Keyboard, scroll handoff, dirty dismissal, focus return and interrupted gestures need implementation; empty/error/offline data remain caller-owned. |
| UndoToast | Local 5-second timer and onUndo callback at `app/src/ui/parts/overlays.tsx:44-49,57`; no event API in this part. | S `/v1/events/:id/undo` from owning Item/Buy/Today controller, not from generic toast. Retain action/event ID, eligibility and reversal-in-flight state. Actual denied/expired/offline/reversal-error cannot appear from a timer. Never promise Undo for sent messages, shared address or accepted offers. |
| EmptyState | Optional caller action at `app/src/ui/parts/overlays.tsx:71-76`; no data source. | Caller must distinguish true zero, deleted, permission failure, fetch error and offline. No shared endpoint. An action with no supplied onPress can display a nonworking control; audit consumers rather than count a labelled button as wired. |
| Skeleton | Static three local variants at `app/src/ui/parts/overlays.tsx:83-99`; delay/minimum time exist only as the comment at `:81-82`, not timing logic here. | Caller request lifecycle supplies real first-load/partial-load and enforces the delay/minimum; no API in Skeleton. Add matching shared form skeletons only where retained field labels cannot reserve geometry. Never use skeleton as empty/error state. |

### `app/src/ui/parts/item-parts-sheet.tsx::ItemParts`

**Purpose:** let a developer inspect item primitives and their states, then exercise one example.

This is a developer catalogue, not a user-facing “parts” sheet and not a candidate for the one-decision product rule. Today it is one Section: PhotoPager examples 26-28, counter Chips 29-34, switch variants 35-42, two ListingPreview examples 43-48, QuestionCard variants 49-51, PriceTrack variants 52-54, Why opener and WhySheet 55-58. None belongs on a customer's item or Plan page. Do not ship this catalogue as a product route.

Redesign: use the same existing `layout.tsx::Section`, Stack, Line and List to separate named specimen groups. Keep every current example. Add catalogue coverage for the shared Sheet/RouteSheet contract through route links to actual examples rather than squeezing a full shell into the Section. Use `chip.tsx::Choice` with leads for those developer links, `buttons.tsx::Pill` for local fixture actions, and the same listed specimen components. **The active specimen stands out**, with no global hero. This is no new product primitive.

States: first load uses local examples immediately; loaded has the groups above; empty means an intentionally empty fixture explicitly named by its developer label, not missing app data; partial means one controlled specimen, with other examples unchanged; no pagination or pull; offline remains usable for local fixtures, with remote images allowed to fail in their reserved slot; fixture-load error has Reload example. Top/down/up use ordinary catalogue scroll and no animated header. No active-tab retap because it is not a tab. Only counter/Blank inputs open a keyboard and follow the shared field behavior; Why uses the common sheet on open and restores focus on Done/Close. Reduce Motion is passed through to the exact same components. Keep example values labelled as fixtures, not asserted live market evidence.

Interactions: PhotoPager swipes photos in place; Chips/Switch/PriceTrack change the specimen only; inert/disabled examples remain explicitly labelled developer fixtures and cannot look like broken customer controls; Why opens its real sheet and Done dismisses. No product haptic for changing a fixture unless testing that haptic explicitly. Copy at 26, 30, 36, 44, 47, 49-51 and 57 is developer explanation or sample content, not UI clutter to transplant elsewhere. Line 55's `Open a Why sheet` is appropriate for the catalogue; product controls should say Why or name the source. No requirement to strip useful catalogue labels using the product copy ladder.


### Planned features

There is no customer page or independent feature for ItemParts in pages §§6-7. It demonstrates the same Plan/Post/Why capabilities P02-P04, P09 and T01/T04, plus the shared kit. Keep the existing specimen inventory and add test entries for the approved shared scaffold and any accepted new control. These are developer fixtures, not additional product capabilities in the lane count.

### Left to wire

| Part | Today and evidence | Remaining work |
|---|---|---|
| Photo/chip/switch/preview/question/track fixtures | Literal photos, amounts and props in `app/src/ui/parts/item-parts-sheet.tsx:26-54`; state at `:20-24`. Switch off example at `:39` has no onChange; preview switch at `:45` likewise; QuestionCard answers are no-ops at `:50`; second PriceTrack onChange is empty at `:54`. | Intentionally no production endpoint. Keep labelled fixed/disabled fixtures, make interactive fixtures actually change, and link real route examples for lifecycle coverage. No attempt to connect catalogue to customer data. |
| Why fixture | Local why open state and literal fee rows at `app/src/ui/parts/item-parts-sheet.tsx:55-58`. | No API by design. Test local open/Done/Close, keyboard and Reduce Motion through actual parts; use caller-supplied fixture variants for loading/error/empty/offline rather than pretending these fees were fetched. |
| New shell/control examples | Current catalogue covers only its listed parts at `app/src/ui/parts/item-parts-sheet.tsx:26-58`; it contains no detent/draft guard or scheduling specimen. | Local component work after approval, no endpoint. Add examples and route links for those controls without creating another customer destination. |

### `app/src/ui/parts/takeover.tsx`

**Purpose:** show the three New entry choices from Plus, then hand the selected intent to capture.

The New section above specifies this kit's product behavior. Today it owns origin math (`usePlus`, 53-55), CircleStage (61-96), root markers (100-105), PlusClose (110-124), choice positions/column (130-145), capsules/main/type target (153-204). Keep these responsibilities in the shared part. It is not a second sheet shell, a generic navigation transition or a place to add unrelated brand motion. Native usable height and safe areas must drive both origin math and choice placement; test on keyboard absence, orientation/layout changes and home-indicator devices, rather than trusting fixed tab height alone.

States not to miss in addition to New's table: opening interrupted by Close, closing interrupted by reopening, choosing during entrance, repeated choice taps, layout change during expansion, camera transition cancelled, returning after a text sheet, and remount after completed creation. Start each from current presentation geometry, not a previous target. Pointer hit regions and VoiceOver order remain the three visible intents plus their alternative inputs and Close. `CircleStage:80` currently advances with a timer; navigation must reflect the actual transition result and cancellation, never route merely because an obsolete timer fired. Reduce Motion removes the timer dependency on a visual circle. Header, large title, bar and floating action are absent throughout; PlusClose alone remains fixed. Copy has no extra headings to add.


### Planned features

N01-N08 specify this kit's own chooser duties; N09-N14 are the downstream journey it must preserve. No additional independently counted feature exists for takeover in pages §7. Added: long press lives in the tab's Plus target, not ChoiceCapsule; imports, camera mode changes and returning from a text form must retain the chosen intent and origin. The shared input's marked-span pattern is a separate approval dependency from CircleStage.

### Left to wire

| Part | Today and evidence | Remaining work and states |
|---|---|---|
| CircleStage, Plus origin and choice placement | Local transforms/layout in `app/src/ui/parts/takeover.tsx:53-55,61-96,130-145`; stage-settled callback uses timer at `:80`. No API data. | Caller New/tab scaffold, no endpoint: measure actual Plus, honor insets/layout changes and cancellation, start from presentation value, remove obsolete timer navigation. Open/close reversal, layout change and cancelled camera entry need proof. |
| Choice/type/Close controls | Local onPress/onType callbacks at `app/src/ui/parts/takeover.tsx:153-179`; PlusClose callback at `:117`. | No API in these parts. New caller owns persisted mode and dirty input; shared tab Press gets long-press as N03. Do not duplicate downstream capture/valuation/search API calls here. |
| Handoff identity and system entry | Only intent icon names are encoded at `app/src/ui/parts/takeover.tsx:41`; route mode handoff is at `app/src/app/new.tsx:46-55`. | S captures with N8 purpose and downstream endpoint adapters from New's table. Source URI, returned capture/item/job IDs and alias mapping worth vs appraise must survive. Real capture error/empty/loading come from the destination, not the circle timer. |

## Shared with the other four lanes

| Shared obligation | Primitive and reconciliation needed |
|---|---|
| Modal presentation and origin restoration | `route-sheet.tsx::RouteSheet`, `overlays.tsx::Sheet` need the one approved scaffold, not five lane-specific dialogs. Reconcile detents, draft guard, keyboard and focus before implementing each consumer. |
| Main navigation | Keep Today, Sell, +, Buy, You and per-tab history. `chrome.tsx::TabBar`, `RouterTabBar` stay owned by the main scaffold. Sheets never redraw or animate them; New uses the real Plus geometry. |
| Header/title/scroll | Sheets have fixed small title and no wash; main/pushed pages use `chrome.tsx::Nav`, `Wash` through `layout.tsx::Screen`. Reconcile root scroll-to-top and pushed-page title behavior with the page lanes. Do not implement custom native large-title collapse inside this lane. |
| Identity, money, state | `cards.tsx::ItemCard`, `small.tsx::SiteBadge`, `tag.tsx::Tag`, `states.ts::TAGS`, and actual photos. One passive compact identity on a decision; no duplicate item navigation. Same You get labels and net calculations across Plan, Offer, Post, Today and Item. |
| Rows and spacing | `list-row.tsx::ListRow` for facts/disclosures, `action-row.tsx::ActionRow` for actions, `chip.tsx::Choice` for selection. Shared `layout.tsx` spacing/separators; no box around every group. Accessible wrapping must be fixed in parts for all lanes. |
| Fields and authorization | `loop.tsx::Guess`, `Blank`, `Approve`; `pick.tsx::GuessPick`; `switch.tsx::Switch`. Same touched/dirty behavior, validation, decimal currency parsing and explicit locked-action confirmation. Do not send on blur, Return, dismissal, choice selection or reconnect. |
| Recovery and jobs | `overlays.tsx::EmptyState`, `Skeleton`, `UndoToast`; shared item/job state. Background posting/labels/messages belong on the originating Item/Today/Thread after leaving. Reconcile actual endpoints and idempotency with the builder; local timers are not operation evidence. |
| Detail destinations | Item lane owns photos/facts and reopening Plan; Buy lane supplies listing/seller/payment context to Offer; Messages lane owns Thread and drafted own-message handoff; You lane owns Accounts, order money and payout detail; Today lane owns double-sale/no-show/failed-job entry points. Each must accept origin and draft context rather than route to a generic home page. |
| Proposed supporting pages | Plan details, Drop-off places and order Payment details use existing Page/Screen/Nav/ListRow patterns. Reconciler assigns exact routes and owners before building so no disclosure points to a missing screen. These are proposed splits, not silently decided new scope. |
| Genuinely missing patterns | Approve shared detented/keyboard/draft sheet behavior; precise scheduled date/time input; accessible photo reordering if kept inside per-site edit. Existing parts do not implement these. No other new visual primitive is needed for this lane. |
| Motion and haptic vocabulary | `motion.ts::MOTIONS`, generated feedback/select/panel 150/200/300, `press.tsx::Press`, `camera.tsx::haptic`. Share failure haptic helper and interrupted-transition fixes at the kit layer, not in routes. |

## Builder acceptance walk

This document is usable for reconciliation. It is not approval of the marked new patterns and is not a demonstrated UI. Build after resolving those shared decisions and the exact supporting routes.

Verify the complete entry-to-return journey, not isolated sheets: Item to Plan to adjustment to Plan to Post to partial result to Item; Sold item to label purchase to native print cancellation and back; Today pickup request to availability draft to explicit send to proposed time approval to late/address/no-show forms and confirmed handover; each tab's Plus to every intent by camera and by text/link, then cancel and retry; Buy listing to suggested/custom offer and actual result. All exits preserve the originating tab, offset and selected item.

For each journey exercise fresh load, cache, missing item, zero selection, one/typical/dense content where applicable, partial results, request running, offline, failed and unknown request outcomes, explicit retry, expired/changed facts, repeated approval taps, cancelled gestures, mid-animation reversal, largest Dynamic Type, long title/price, dark mode, VoiceOver, keyboard and Reduce Motion. Verify no duplicate public request, no charge on row selection, no unsent address shared, no automatic pickup consent, no accidental re-post, no printed claim from a timer, and no unsupported Undo.

No production code, behavior tables, tests, screenshots or renders were changed by this task. Code review supplies the findings above; implementation, on-device gesture/keyboard verification and an independent visual review remain for the builder. Do not mark these states tested from this prose alone.

## Lane summary

Found **90 page-level planned capability groups**: Plan 18, Post 18, Ship 16, Pickup 16, New 14 and Offer 8. The redesign now carries **65 here**, including the single-purpose forms reached from that page, and assigns **25 to another named page**. No counted group is left without a destination. This counts the explicit IDs above, not every sub-action as another feature; shared kit obligations reuse those IDs, and unresolved policy choices remain explicitly unresolved rather than counted as built.

| Page | Found | Here | Elsewhere |
|---|---:|---:|---:|
| Plan P01-P18 | 18 | 14 | 4 |
| Post T01-T18 | 18 | 13 | 5 |
| Ship S01-S16 | 16 | 11 | 5 |
| Pickup K01-K16 | 16 | 13 | 3 |
| New N01-N14 | 14 | 8 | 6 |
| Offer O01-O08 | 8 | 6 | 2 |
| Total | 90 | 65 | 25 |

These are design coverage counts, not feature-completion counts. The audited page paths remain fixture/local-state flows at the code locations in Left to wire; API handlers serving examples are not live marketplace integration. Existing working navigation and native external intents remain distinct from acknowledged backend actions.

### Left to wire, most blocking first

1. **Authenticated, versioned app-to-API transport and source-of-truth reads.** Item controller and Buy must consume actual IDs and responses rather than WORLDS/fixed draft IDs. Start with item/order/appointment/decision reads, preserve draft inputs across refresh, and integrate session resume. Evidence: `app/src/item/model.ts:20-23`, `app/src/demo/index.ts:13-19`, `app/src/app/new.tsx:53`, `app/src/app/item/[id]/pickup.tsx:47-50`. Real loading/error/empty must follow requests, not only query fixtures.
2. **Close contract gaps and replace example-only critical operations.** Real postings, shipping/labels, appointment reads/actions and link/description intake must match their specced payloads; label PDFs/layout, review_at/per-site strategy edits and offer proposals need explicit alignment. Evidence: `app/src/edge/api/items.ts:114-135`, `app/src/edge/api/orders.ts:24-28`, `app/src/edge/api/captures.ts:304-309`. Keep N8/new-contract status separate from prototype existence and verify actual provider read-back.
3. **Wire authorization and supported compensation.** Real signed decisions for first_post, below-minimum, buy_offer/over-ceiling, held claims, pickup/address/cancel/handover. Use stable idempotency identity, never duplicate on unknown outcome; unsupported Undo must disappear. Current local commits are `app/src/app/item/[id]/plan.tsx:134-143`, `post.tsx:140-149`, `ship.tsx:123-143`, `pickup.tsx:105-108,123-125`, and Offer callers' timers at `app/src/app/listing/[id].tsx:55`, `app/src/app/(tabs)/buy.tsx:54`.
4. **Connect durable jobs, event streams, polling and reconciliation.** Replace timers with accepted jobs/stages; preserve operations when leaving and returning. Per-site success, unknown outcome, failure/retry and rollback are distinct. Current timers: `app/src/app/item/[id]/post.tsx:117-123`, `ship.tsx:110-129`, `pickup.tsx:103-108,313`. Caller Item/Buy/Thread consumes `/v1/jobs/:id`, `/events` and `/v1/stream`, with source read-back before retry.
5. **Build the approved shared sheet behavior and complete supporting routes.** RouteSheet/Sheet need detents, keyboard/footer, dirty guard, accessible Close/focus and interruption; Plan details, Drop-off, Payment details and full photo work need real destinations and draft restoration. Current shells are `app/src/ui/parts/route-sheet.tsx:28-39,41-86` and `overlays.tsx:18-39`. No endpoint belongs in the shell. Do not ship a chevron to a missing destination.
6. **Replace valuation/score/fee placeholders with evidence.** Five choices' per-site consequences, actual sold observations, guarded net, sources, score basis/hidden reasons and plan-change comparison. Current inferred fixture modes and evenly spread ticks are `app/src/item/model.ts:316-327,421-428`. Wire the S item/score/citation/event feeds and N8 choices/standing without inventing data or adding excluded hot/season features.
7. **Finish media and scheduling controls.** Actual original/approved render versions, claim-gated photo/text edits, shared-vs-site override persistence, live review, Add/Generate/Redo/Fix texture, safe original fallback, score/non-model tweaks and validated date/time. Existing bundled photo toggles and local edits are `app/src/app/item/[id]/post.tsx:109-112,160-166,183-190,209-212`. Marked-input spans, precise scheduling and accessible photo reorder remain shared approval dependencies, not simulated wiring.
8. **Finish fulfillment and pickup side effects.** Real rate/label/insurance/tracking/PDF, typed package values, pick list and booking; appointment messages, no-show and code-or-tap handover; system print/calendar/share use actual returned data. Package fields without change handlers are `app/src/app/item/[id]/ship.tsx:187-189`; no-show/handover are absent from the current Pickup action section `app/src/app/item/[id]/pickup.tsx:212-221`. Coordinate Today, Item, Messages and You; never infer payment or dispatch from a UI timer.
9. **Complete New and offer entry parity.** Persistent last intent, Plus long press, real description/link intake, source-preserving camera/import/grouping, Worth/Search/Want handoffs, signed-in Offer with actual delivered ceiling and binding terms. Evidence: `app/src/ui/parts/chrome.tsx:177-182`, `app/src/app/new.tsx:46-55,80-85`, `app/src/ui/parts/offer-sheet.tsx:36-51`. Assist is a proposed shared service/input workflow, not implemented by the fixture matcher `app/src/demo/capture-edges.ts:41-43`.
10. **Prove the full journeys after wiring.** Retain the acceptance walk above and exercise real pending/error/empty/partial/offline/unknown-result states, duplicate taps, keyboard, Dynamic Type, VoiceOver, mid-gesture reversal and Reduce Motion. `app/src/demo/screen.ts:11-25` is only the fixture switch. Catalogue no-op examples at `app/src/ui/parts/item-parts-sheet.tsx:39,45,50,54` must remain clearly labelled developer fixtures. A design coverage count is not evidence of demonstrated use.
