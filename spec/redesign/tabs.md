agent proposal, written by Codex 2026-11-15 at Ben's ask (10:27, 10:30)

# The four tabs as one family

Feature and wiring audit added for Ben's 10:31 instruction: "ensuring each checks against what is planned feature wise for each and also noting down what is left to be wired up and such".

The Planned features tables below are the coverage ledger. Each ID names one page-capability assignment, not one backend feature or proof of completion. `In redesign` means held on this root or its contextual decision surface. `Added` means the audit found a gap and this revision adds it. `Elsewhere` names the detail page that carries the capability, with a route from this lane. All are design coverage, not wired functionality. Shared capabilities can appear under more than one tab; the final counts count these assignments explicitly.

Source review: `spec/pages.md` §§6 to 9 and `product/decisions.md`, plus each `features/<slug>/README.md` and `spec/features/<slug>.md` for today, messages, sold, price, list, watch, data, insights, item-card, score, buy, assist, market, connect, capture, measure, studio, appraise, identify and replay. Ran `node scripts/evidence.mjs <slug>` for each of those 20 slugs. The report is a source index, not a freshness guarantee: for example its sold links still include automatic pickup booking, superseded by the November 15 decision requiring approval of the buyer's picked time. Feature READMEs saying “Nothing yet” under Decided do not override `product/decisions.md`.

Endpoint labels below follow the requested page map: `specced` means listed in Feeds or its feature contract; `new in §8` means an extension the page map still requests. A handler can already exist for a new-in-§8 route. Conversely, a route file or `source: engine` label does not establish live data. The code audit below distinguishes demo UI, contract-backed API, store-backed API and actual outside reads. Proposed client owners are assignments to existing app modules, not claims that those clients already exist.

This is a design specification, not an implemented or visually verified redesign. Only this file is in scope. Source observations are from checkout `1107a97a234fa98dbdc415af881475325de674be`, read on 2026-11-15. Line references below describe that snapshot; another session is editing screens. A reconciler must compare the cited block with its current equivalent before applying it.

## Reading and decisions

For the person clearing out their things, the app should make it easy to know what needs them, find a thing, find something to buy, and reach their account information without reading a dashboard. Frequent sellers and buyers use the same structure. A missed deadline or an unintended outward action costs more than an extra navigation tap.

The common answer is four dashboards with counts, cards and shortcuts. Reject that: similarity should come from the frame and the meaning of each part, not from repeating unrelated summaries. Keep the existing photo tiles, decision cards and disclosure rows. Today answers a decision; Sell locates an owned item; Buy locates something to buy; You chooses an account subject.

Ben's supplied 10:27 direction supersedes the dashboard content in `spec/pages.md` §6.16. Its detailed subjects remain available on pushed pages. This proposal does not approve itself or change that source file. The record search also found the exact one-purpose instruction in `said/secondhand/2026-11-15.md:904`; the timestamps stored there differ from the labels supplied in this task. Use this task's 10:27 and 10:30 labels for provenance, not an inferred timezone conversion.

### Conflicts and which rule wins

| Conflict | Apply in this proposal |
|---|---|
| Brand C1 and coder card require a centered wordmark; `tab-nav.tsx:1-5` explicitly replaces it with the tab title, citing 09:56. | Under the source order requested here, retain `Nav` with the wordmark, then one tab title below. Flag the code's contrary owner quote for reconciliation; do not claim it never existed. No additional wordmark elsewhere. |
| `spec/pages.md` §6.16 asks for worth, payouts, potential, sold count, goals and settings together; the UI constitution's Job test and Ben's current instruction reject multiple purposes. | Keep one earned amount as orientation, then navigation. Move breakdowns, charts and controls to their subjects. No goal bar on You. |
| §6.10 describes sideways shelves; the decided Sell grid and existing `Grid`/`Tile` implement vertical photo grids. | Keep the grid. State sections remain `Shelf`; no new carousel. Buy uses the same grid family. |
| Appllama suggests system type, symbols, semantic system colors and translucent bars. | Earlier brand rules win: Clofie, PP Neue Montreal, Hugeicons, theme tokens, solid surfaces and existing capsule bar. No glass. |
| Appllama motion examples permit 350 ms, list entrance staggers and scroll-linked headers; Emil's Vaul example permits 500 ms. | Earlier frontend standard wins: constant actions get no custom motion, selection 200 ms, panels 300 ms, no 500 ms motion and no custom scroll animation. |
| Appllama recommends row highlights without scale; existing `Press` scales rows too. | Frontend standard's shared press treatment wins for this proposal. Keep `Press` consistently, with row highlight as already implemented. Do not create lane-specific press code. |
| The standard calls New a 56 circle; `chrome.tsx:186-193` draws 48 and cites alignment feedback. | Use the standard's 56 token and center it in the existing capsule. Flag the 48 choice to the reconciler; do not change bar geometry in this lane. |
| `product/primitives.md` first says appraise is not a screen, then `spec/pages.md` §6.11 defines the multi-entry result page. | Valuation remains the reusable fact block. The result page is its navigable container. No extra Appraise tab. |

## Shared tab scaffold

The following is normative for all four tabs. Per-tab state tables inherit every row here, including scroll, keyboard and Reduce Motion. A blank per-tab exception means this behavior applies, not that the state was omitted.

### Parts, top to bottom, and why

All part paths in this document are relative to `app/src/ui/`. The structural parts live in `layout.tsx`, not `parts/`; this is the existing kit, not a request for parallel layout components.

| Position | Existing file and component | Reason and contract |
|---|---|---|
| Whole tab | `layout.tsx` `Screen` | One safe-area owner, one vertical scroller, 20 pt gutters and the same content start. Use the tab's name and real state. |
| Background at top | `parts/chrome.tsx` `Wash`, through `Screen` | Same quiet brand ground on every tab and every fetch state. It ends above the first content card; never colors the entire page. |
| Navigation | `parts/chrome.tsx` `Nav` | Centered wordmark, Messages at right with `parts/buttons.tsx` `IconButton` and `parts/small.tsx` `Count`. One messages control per tab. No Back at a tab root. |
| Tab title | `parts/tab-nav.tsx` `TabNav`, title only | Today, Sell, Buy, You, all with the same Clofie heading role. Omit its inbox because `Nav` owns that. Sell may use its existing `action` slot for Select or Done. |
| Content | `layout.tsx` `Section`, `Stack`, `List`, `Grid`, `Line`, `Row` as named below | 32 pt between subjects; 16 between cards or header and content; 12 within groups; 8 within one object. No spacer components or screen-specific padding. List hairlines mean another row of the same kind, not a new subject. |
| Empty or failed subject | `parts/overlays.tsx` `EmptyState` | Left aligned, one line naming what is absent and at most one recovery action. No illustration, encouragement, or tutorial paragraph. |
| Pending content | `parts/overlays.tsx` `Skeleton`; `parts/tile.tsx` `TileSkeleton` | Use only where the pending shape matches that part. Known navigation never becomes a skeleton. |
| Temporary result | `parts/overlays.tsx` `UndoToast`, in `Screen.foot` | One result above the tab bar, with Undo for a reversible act. Never cover a card's buttons or a keyboard field. |
| App navigation | `parts/chrome.tsx` `RouterTabBar` and `TabBar` | Fixed order Today, Sell, +, Buy, You; a single shared instance outside each tab's scroller. |

All text uses `text.tsx` `Txt` with its existing roles; all state labels use `parts/tag.tsx` `Tag` through the tile/card or directly, with `states.ts` defining the meaning. Photos use `photo.tsx` `Photo`; marketplace overlays use `parts/small.tsx` `SiteBadge`. These primitives carry identity and state without explanatory captions.

Large title behavior: one large title at the top of the scroll content, not a second compact title. `Nav` and `TabNav` scroll away together, as they do in `Screen` today. This is ordinary iOS `ScrollView` scrolling with rubber-band overscroll and native deceleration. It is deliberately not UINavigationBar large-title collapse: the kit has no native collapsing header, and the earlier standard forbids custom scroll animation. Returning toward the top reveals the original header in its original position, without a direction-triggered floating header. The tab bar stays visible in both directions. No floating add button in the content because + already owns that job.

At maximum Dynamic Type, the existing fixed 48 pt `TabNav` and fixed row/card heights must grow to contain their text. Do this in the shared parts, with the same tokens and hierarchy. Titles may wrap instead of clipping; money remains labelled; rows must expose their full names. This is a kit accessibility repair, not a new pattern.

### Shared state and scroll contract

| State | What shows and what the person can do |
|---|---|
| First load | Show the real frame, title, static controls and known cached content immediately. For a cold read, reserve the final content slots; after 150 ms show matching skeletons, visible for at least 300 ms once shown, per frontend standard §3. Do not delay a completed user action for this display rule. |
| Loaded, one, typical, dense | Same frame and section rhythm. One item does not cause centering or a promotional empty state. All results are reachable, with stable IDs and retained scroll offset. No invented preview quota. Virtualization is a shared `Screen`/grid responsibility when needed, not a second nested vertical list. |
| Empty | Keep frame, Messages and tab navigation. Do not show counts or money as zero just to fill space. A genuine recorded zero amount remains zero. The empty tab's next action is specified below. |
| Partial | Keep known content and its position. Put a real job label or failure beside the affected subject. A missing source is not an empty collection. Never compute an aggregate by treating unavailable inputs as zero. |
| Loading more | Only applicable if the service has another page. Append at the end of the affected section, with matching placeholders and a non-interactive loading label. Keep the visible anchor. On failure replace that tail with Retry, retaining all loaded rows. No whole-screen skeleton or animation. If the response is complete, there is no loading-more state or endless spinner. |
| Refreshing | Native `RefreshControl` on the sole vertical scroller for Today, Sell and Buy because remote decisions, listings and matches change. Keep all content, filters, folds and offsets; coalesce another pull while fetching. You has no pull to refresh because it is a navigation overview; revalidate its one amount on focus and stream updates. |
| Offline | Keep the last complete copy with `Notice` text `Waiting for signal`; show its recorded update time when available. No cache: `EmptyState` with `No saved copy` and Retry, not a false empty. Navigation and local drafts work. Outward actions require current validation and cannot appear completed offline. |
| Error | Cold load: `EmptyState` names what failed with Retry. Warm load: a `Notice` plus secondary `Pill` Retry beside the affected section, leaving content usable. Retry repeats that read in place, never pushes another copy of a tab. Remove the notice only when recovery succeeds. |
| Scrolled to top | Wordmark, Messages and large tab title visible. Native status-bar tap scrolls the active tab to top. Only the active scroller has `scrollsToTop`. Bar and + remain fixed. |
| Scrolling down | Header, title, summary and filters move with their content. Bar and + stay fixed. No shrink, parallax, header fade, hiding bar or added haptic. A toast stays above the bar while it exists. |
| Scrolling up | Native deceleration in reverse. Header/title appear only when their content reaches the viewport. Bar and + stay fixed. No direction-sensitive chrome or floating action. |
| Re-tap current tab | If away from top, native scroll-to-top. Preserve filters, expanded groups, selected items and drafts. Once at top, another tap does nothing. Do not refresh, reset filters or begin an action. Under Reduce Motion, scroll-to-top jumps immediately. |
| Switch away and return | Swap immediately, retaining each tab's scroll, folds, filters and local draft. Revalidate in background without a full skeleton. A pushed detail hides the root bar until Back restores the originating tab and offset. |
| Keyboard up | No keyboard on the tab roots except Buy. Keyboard behavior for a Today amount editor or + text entry belongs to its sheet, below. Native keyboard geometry drives layout, not a guessed animation timer. Do not raise the root bar over the keyboard. |
| Reduce Motion | Native scrolling stays direct. Custom movement becomes instant state change or crossfade; press becomes the existing opacity dip. No field drift, pile fanning, tile travel or circle expansion. Haptics remain conditional on the same committed event. |

### Shared controls and motion defaults

All controls use `press.tsx` `Press`: feedback on touch-down, commit on release inside, drag-away cancels, disabled means no dispatch. It scales to 0.97 with `MOTIONS.press`, a spring with no fixed duration; `Press` currently configures feedback 150 ms and return 300 ms. Under Reduce Motion it dips opacity. Keep that distinction between configured response and actual spring settling time. Rows retain their existing gray press fill. Hit areas are at least 44 pt and do not overlap.

| Control kind | Presentation, Back, motion, haptic |
|---|---|
| Messages | Push `/messages` from the active tab. Back or interactive left-edge swipe returns to that tab and exact offset. Native navigation push, target panel 300 ms per frontend standard; `motion.ts` has no named push entry, so the shared navigation lane must register it rather than misusing `sheet`. Reduce Motion: instant. No haptic for navigation. |
| Item tile / item card | Push `/item/:id`; buyer listing opens `/listing/:id`. `MOTIONS.openItem` is an origin spring with no fixed duration for photo continuity; native push fallback if continuity is unavailable. Back/edge swipe reverses to the same tile and offset. Crossfade with Reduce Motion. No haptic. |
| Disclosure row | Push its exact subject. Back/edge swipe returns to the originating row and offset. Same native panel transition as Messages. No navigation haptic. Chevron means drill-in, never commit. |
| In-place filter or selection | `MOTIONS.select` 200 ms only for the changed selection indicator, no list entrance. Immediate data swap. No haptic for repeated filtering. One light haptic on a committed explicit bulk checkbox toggle, not when entering selection mode. |
| Short form or choices | `parts/overlays.tsx` `Sheet`, target medium detent, expandable to large for Dynamic Type or keyboard. `MOTIONS.sheet` 300 ms entrance, select 200 ms exit. Close, scrim, downward dismissal or system Back cancels the uncommitted edit and returns focus to its trigger; edge swipe does not pop the tab behind it. No haptic to open or cancel. |
| Commit / retry | Button changes to its real working state immediately. One light haptic when a mutation is accepted, never on touch-down or repeated taps. A newly failed local request gets one warning haptic; passive historical errors and every render stay silent. Retry reads stay silent. No success sound for ordinary actions. |

Gaps in current kit, for the reconciler: `Screen` exposes neither a ref, `RefreshControl`, keyboard dismissal nor active-tab scroll registration; `RouterTabBar` ignores re-taps (`chrome.tsx:207`); `Sheet` is a non-detented `Modal` with no drag handoff (`overlays.tsx:19-42`); `Press` has no haptic dispatch. Extend these existing shared components to provide the contracts above. Do not claim their current APIs already implement them. Native sheet behavior may be supplied behind `Sheet`; no new visual sheet language is needed. `Skeleton` does not draw an amount: keep that slot blank with an accessible Loading label rather than draw a wrong card skeleton.

## Today

**Purpose:** resolve the next decision that needs me, with its suggested action as the next tap.

Person: the seller or buyer checking between other tasks, several times a day. They may say “show my activity”; they need to see whether ignoring the app will cost money or miss a commitment. Evidence held here is the UI constitution Article 2 and the existing deadline ordering, not a new user study. Worst mistake: hiding a deadline in a collapsed pile or making an outward act seem done before it is.

### Today now, top to bottom, and what is not Today

References in this section are `app/src/app/(tabs)/index.tsx`.

| Current block | Assessment and destination |
|---|---|
| `163`: `Screen`, wash and `TabNav` with inbox | Keep frame purpose; use the shared scaffold. Header differs from earlier brand C1 as noted above. |
| `165-169`: `MoneyNews` ladder or setup `TopSlot` | Keep only money genuinely since the last visit, or the next unfinished setup step. Lifetime/closet/other flattering fallback numbers belong on You's subject pages. “How am I doing” as another dashboard question fails Job. Money event is quiet orientation, not a rival hero. |
| `172-178`: offline line, failed/empty block and skeletons | Keep these states; use shared placement and Retry. Do not stack setup instructions and a second empty explanation. |
| `179-214`: tiers through `Shelf`, deadline explanation, `Pile`, `Feed`, `DecisionCard` | Keep the tiers and full action set. Cut the `Due first, ...` line at `187-191`: the card already owns its deadline, and brand Art. 7.11 rejects a fourth hierarchy level. |
| `215-218`: notices and handled line | Keep relevant notices after decisions as disclosure rows. A completed-action archive is not this page's job. One quiet Activity row opens `/you/log`. |
| `225-248`: More and amount sheets | Correct secondary surfaces. Keep, with shared detents and keyboard handling; do not inline the forms. |
| `251-273`: sold-twice comparison sheet | Keep contextual decision sheet, including both outcomes and cancellation consequence. No generic account settings here. |
| `276-293`: Done for you sheet and first five events | Move archive to pushed `/you/log`. The five-event slice is an arbitrary preview and a second representation of Activity. Its final `/you/automation` destination is absent from `PAGES`; use `/you/log`. |
| `295-305`: `QueueView`, per-item price, approve, skip, edit | Keep queue as the batch decision's temporary surface. It is not an alternate tab or a replacement for Item. |

### Redesign stack and reasons

1. Shared scaffold. A new person sees `parts/chrome.tsx` `TopSlot` for the next unfinished setup action only. Existing users may see `parts/money-news.tsx` `MoneyNews` for actual new sale money, opening You, as the top-slot decision requires. Do not show zero or an unrelated fallback; it does not receive the lead decision's field.
2. `parts/tile.tsx` `Shelf` with `quiet` headers for the three existing tiers, containing `parts/feed.tsx` `Feed` and `parts/cards.tsx` `DecisionCard`. The nearest consequential deadline is the focal object: one lead decision with its state field and recommended pill. Without a deadline use the existing cost-of-ignoring order, not a fabricated clock. No separate explanatory line.
3. Keep “Needs you now” fully spread. For the lower tiers use `parts/pile.tsx` `Pile` only for independent non-urgent cards. `Shelf` See all expands it in place; Show less folds it. Never group a deadline inside a day; batch/queue count is items, not an inaccurate count of actions. The reason is scanability without hiding a commitment.
4. Under the last tier, `layout.tsx` `List` of `parts/cards.tsx` `Notice` for relevant non-decision changes, plus `parts/list-row.tsx` `ListRow` labelled Activity. Each points to its object or `/you/log`; no five-event archive sheet.
5. `parts/overlays.tsx` `EmptyState` with `Nothing needs you` when there are no decisions, preserving genuine new money or setup above. Do not add an action that invents work. `UndoToast` occupies the foot only after an eligible act.

6. Audit addition: with multiple orders to pack, put a `parts/list-row.tsx` `ListRow` labelled Pack orders above the ship-by cards, with the real order count and a chevron. It pushes the pick-list page at proposed `/orders/pick-list`, using `Section`, `List` and `parts/cards.tsx` `ItemCard` for item photo, location, box and label state. That page owns Print pick list and the batch label approval sheet. No new decision kind or second fulfilment dashboard. Back restores Today's anchor. This preserves the feature's shipping view without crowding the root with packing controls.

7. Audit addition: every non-decision notice has a More action exposing Dismiss in the existing `Sheet` with `parts/chip.tsx` `Choice`; the notice body still opens its subject. Dismiss only that notice with Undo where supported, never its associated decision. A completed deep research job arrives as a notice with its item/photo and opens its Worth or Item result. A held result stays a decision. A source or model job never invents a money figure merely to announce completion.

### Planned features

Scope comes from pages §6.2 and §7: today, messages, sold, price, list, watch, data and insights; connect and capture-related decisions also enter the common queue. Preserve the complete kind/action table in `spec/features/today.md`, not only the demo's frequent kinds.

| ID | Planned capability and source | Disposition and exact home |
|---|---|---|
| T01 | News since last open, no zero/fallback totals; insights, pages §4/§8 and top-slot decision | In redesign: `MoneyNews` above feed, opens You. Persist visit boundary once per open, not on every poll. |
| T02 | Resume next unfinished setup step; connect, pages §6.1/§8 | In redesign: `TopSlot` opens that step. Do not recommend obsolete email-for-sales or fixed pickup-window setup. |
| T03 | Open Decisions, priority, three tiers, singles/batches/queues, full kind tag/photo/deadline/net-money/actions; today, pages §§3/5 | In redesign: tier `Shelf`, `Feed`, `DecisionCard`, `Pile`, `QueueView`; no urgent card hidden in a pile. |
| T04 | First post, agent revision, relist, failed post/delist, changed-by-site, bulk preview approval, end-unsold routes; list/price | In redesign: corresponding cards and contextual sheets. Keep Use mine, manual site handoff, split/untick, Cancel and donation/trade-in/keep escapes. Relist never on Poshmark. |
| T05 | Draft replies, held unsupported claims, facts/identity clarification, retake/missing shot/flaw/group/measurement/studio approvals; messages/capture/identify/measure/studio | In redesign: kind-specific DecisionCard, editable draft or media review on its object. Explicit Send without it, Edit, It's true, Don't send; no automatic assertion of a seller-only fact. |
| T06 | All open offers on one item, counter/edit/decline, below-floor approval; messages/price | In redesign: offer decision and amount sheet; show competing offers and net outcome, not only best-offer acceptance. Every below-floor exception needs a fresh tap. |
| T07 | Buyer-picked meetup time approval, address share, no-show, scam/off-site warnings; messages/sold, newer pickup decision | In redesign: contextual decision and Pickup/Thread destinations. The dynamic day/time picker replaces up-front weekly windows; calendar write is offered after booking, never calendar read. |
| T08 | Sale, ship-by, buy label/insurance, handover, review; sold | In redesign: deadline cards lead to Ship/Pickup; auto delist is visible, failed delist actionable. Sent messages and accepted offers cannot be undone by a generic toast. |
| T09 | Multi-order pick list, physical location and batch print/label approval; today/sold | Added: Pack orders row and pushed pick-list page above. Preserves per-order ship deadlines on Today. |
| T10 | Cancel/refund, return/claim/dispute and evidence, double sale with cancellation costs; sold | In redesign: urgent decision card, existing comparison sheet or pushed claim detail before committing. No blind cancellation or refund. |
| T11 | Watch matches, save-match, outgoing offer, over-ceiling/seller counter, did-you-buy, purchase handoff, replacement after sale; watch/buy | In redesign: shared decision queue. Buy-offer always asks; Open on site finishes payment there. No accidental automatic budget raise. |
| T12 | Value movement, listing stale, ranker/source change and rule-expiring notices; market/score/data | Added: notice dismissal contract above; existing object navigation retained. Rule expiry Keep/Let lapse is a decision when an act is needed. No seasonal hot-item discovery feed. |
| T13 | Deep appraisal completion and visible background work; appraise, pages §9 | Added: result notice above. Started/running/arrived/failed stays on the affected object; opening the notice resumes its result. |
| T14 | Three unedited approvals, eligible Always do this, explicit Never alone and demotion after Undo; data/messages | In redesign: contextual promotion and evidence link. Draft-for-me remains default per site until policy changes. Edited approvals never count. |
| T15 | One quiet automatic-activity line, why, event Undo with real site limits; today/data | In redesign: Activity row may use the real handled action as its label; opens `/you/log`, without a count-only hero or five-row archive preview. |
| T16 | Live changes, guarded money citations, stale/expired/superseded cards, retries, offline, immediate sale/under-price-match push; today/data/notifications decision | In redesign: shared states and Today state contract; add `parts/why.tsx` `WhySheet` from an explicit Why control in each decision's More menu. Push opens the exact object/decision. |
| T17 | Every Conversation, reply editing, buyer/seller threads; messages | Elsewhere: header Messages -> `/messages` -> Thread. Today holds only the exception and its next action. |
| T18 | Rule creation/edit, Ask/Auto/Off per site, pause/site risk management; data/connect | Elsewhere: Activity -> rule's disclosure row -> `/you/rules`; Settings -> Your sites. Never place a rules editor under the feed. |

### Left to wire

The Today root runs on demo data, not the API: `app/src/app/(tabs)/index.tsx:32-41` gets `useScreen` and selects the demo/stops world; `app/src/demo/screen.ts:21-25` resolves URL flags; `app/src/demo/index.ts:7-19` maps the persona fixture files. `app/src/today/stops.ts:52`, `:63` and `:76` supply its failure/one/quiet variants. Those are render fixtures, not stored user outcomes.

| Redesigned part | Runs on today, with code evidence | Left to wire, proposed client owner, and unproved states |
|---|---|---|
| Frame, Messages count | Demo `inbox(w)` calls `unread(w)` at `app/src/today/cards.ts:460`; root passes it at `app/src/app/(tabs)/index.tsx:163`. `TabNav` navigates at `app/src/ui/parts/tab-nav.tsx:27`. | `app/src/today` consumes specced `GET /v1/conversations`, `GET /v1/stream` `message.new` for count; inbox lane owns thread reads. Actual unread loading, remote error, stale count and mark-read reconciliation are not demonstrated. |
| News/setup | Demo top ladder at `app/src/today/cards.ts:400-405`, rendered `index.tsx:165-169`; its final fallback even opens camera, not setup. API has a null headline port and process-local visit map at `app/src/edge/api/today.ts:13-15`. | `app/src/today` calls specced `GET /v1/today`; headline and last-open fields are new in §8. Join `GET/PATCH /v1/me` onboarding, new in §8, to headline producer. API route exists at `app/src/app/v1/today/index+api.ts:5`, but that is not root integration. Wire durable visit boundary, earnings and next-step ports. Genuine empty/no-news, cold loading, multi-device visit and error cannot be exercised through the root API path yet. |
| Feed, grouping and card state | Derived demo feed at `index.tsx:66-83`; rendering at `:179-223`. Backend queue read exists at `app/src/edge/api/today.ts:21`, but notices are always `[]` at `:29`. | `app/src/today` reads `GET /v1/today` and `/v1/stream`, both specced, plus polling fallback; tier/group fields are new in §8. Map DTOs to cards without dropping unrecognized kinds. Need real notices and grouping. Network loading/error/empty, expiry, source partials and pagination remain unproved; URL fixtures can draw some of them only. |
| Primary/secondary, batch/queue, Retry | `index.tsx:93-128` changes local state with timers; queue uses timers at `:137-152`. `JOB_MS` is demo 900 ms at `app/src/today/cards.ts:462`. Retry clears failure params/state rather than demonstrating a recovered executor. | `app/src/today` calls specced `POST /v1/decisions/:id/act` with signature/version/idempotency and streams/polls `GET /v1/jobs/:id[/events]`. Existing act adapter is `app/src/edge/api/decisions.ts:1-7`. Need real operation identity, per-member failures, stale 409 and outside-limits 422; local simulated completion cannot prove sending/posting/retrying. |
| More, counter, confirmations, promotion | Root stores sheet/amount state at `index.tsx:51-57`, edits at `:233-248`; no rule write in that path. | Amount edits go through the same specced act endpoint; promotion uses `POST /v1/rules`, decline/expiry uses rule action/delete per data contract. Proposed caller `app/src/today`, policy owner `app/src/you`. Need persisted eligibility and real locked/expired/failed states; opening a sheet alone is already functional. |
| Pack orders and research arrival | Nothing in current root render `index.tsx:160-223` renders a pick-list row; no root pick-list client there. | `app/src/today` reads specced `GET /v1/orders/pick-list`; orders lane calls `POST /v1/orders/labels`, `POST /v1/orders/:id/ship` and job reads. Those handlers currently use examples at `app/src/edge/api/orders.ts:26-28`, not a carrier. Add actual packing route and print/share handoff. No-label, partial label purchase, print failure, missing location and resumed-job states await integration. Deep result arrives through jobs/stream and decision/notice read; no new arbitrary completion endpoint. |
| Notices and Activity/Undo | Notice derivation just maps fixture records at `app/src/today/cards.ts:418`; render only opens them at `index.tsx:217`. Toast Undo restores local `gone` at `:87-90`; log Undo only changes a Set at `:275-277`. | `app/src/today` and `app/src/you` use specced `GET /v1/events`, `POST /v1/events/:id/undo`, `GET /v1/citations/:id`. Store-backed event handlers exist at `app/src/edge/api/events.ts:17-42`. Notice dismissal has no mutation in this root; propose a new persistent notice-dismiss contract under the Today endpoint owner, or explicitly persisted client dismissal keyed by version until one is agreed. Cannot verify real undo denial, server rollback or synced dismissal yet. |

No root mutation listed above is a working marketplace action merely because its demo card disappears. Existing `Linking.openURL` is a real OS handoff at `index.tsx:95`; it is not evidence of a site-side mutation. Root first-load failure/empty/offline are URL-controlled at `:34-41` and `:172-178`, so they do not yet prove actual network-state handling.

### Today states and controls

| State | Today-specific content and available action |
|---|---|
| First load | Frame then decision skeletons in their final tier slots; do not invent a monetary summary. Cached deadlines remain visible. |
| Loaded / one / dense | Priority decision first; a single card stays the same size. Dense lower tiers pile; urgent cards stay visible. Every secondary intent remains reachable in More. |
| Empty / new | Nothing needs you, or the unfinished setup `TopSlot`. Setup opens its exact step; dismissing it does not manufacture a decision. |
| Partial / jobs | Accepted tap leaves a working card in place with its real stage; running job survives navigation. Arrived closes the card with `MOTIONS.select` 200 ms and Undo where allowed. A failed site or batch member stays with its photo and Retry while successful siblings finish. |
| Loading more | Append to the affected tier only if the service pages it. Urgent ordering must be complete before any claim that nothing needs you. A partial feed cannot use the all-clear empty state. |
| Refreshing | Pull refreshes decisions, notices and relevant headline together; preserve the anchored card. Do not change since-last-open money merely because of a scroll or re-tap. |
| Offline | Show cached decisions. A safe reversible intent can be saved as `Waiting for signal` with Cancel; no send, accept, post, address share or deadline-sensitive commitment is automatically replayed from a stale price/deadline. Revalidate and require the original confirmation policy before dispatch. |
| Error / retry | Page read: Today didn't load, Retry. Act failure: affected card remains, its options and error retained; Retry repeats its operation with duplicate protection, not every card. |
| At top / down / up / re-tap | Shared scroll rows apply exactly. No sticky urgency banner. The lead is a data priority, not whichever card happens to be under the header. Re-tap scrolls first, then does nothing. |
| Keyboard | Amount `Sheet` expands to large; numeric `parts/loop.tsx` `Guess` stays above native keyboard with the explicit send control visible. Dismiss keyboard without losing draft; closing uncommitted sheet discards it. Invalid input leaves field and error visible, not a silent close. |
| Reduce Motion | Card removal is instant, Undo stays; pile opens in place, result chips crossfade. No travel or fanning. |

Control differences from shared defaults: card background opens its `c.open` item/thread, while primary and secondary buttons execute the specific action in `today/cards.ts`; taps do not bubble into card navigation. More opens medium `Sheet` with every `c.more` option, including later, split, edit and other escapes when applicable. Snooze removes only that decision until its recorded return time and offers Undo. Counter/price uses `Guess` plus `parts/loop.tsx` `Approve`, medium to large; a below-minimum warning names the amount before a separate explicit confirmation. Sold-twice uses the same sheet expanded to large if both consequences do not fit; confirm explicitly names the kept and cancelled order. Queue uses `parts/queue.tsx` `QueueView`: full-screen temporary review, Close resumes Today at its anchor; Skip keeps a draft; Edit pushes Item and preserves remaining queue; queue errors stay on that entry. Promotion to Always requires its eligibility evidence and uses the decision's existing permission policy. Navigation has no haptic; accepted commits get one light haptic; failures get one warning. Card closure uses select 200 ms; undo reverses the state, not the whole navigation history.

### Today copy changes

| Source | Change and clean-copy reason |
|---|---|
| `187-191` “Due first, ...” | Cut. Rung 2: card countdown already carries it. |
| `174` “Try again” | Retry. One shared recovery label. Keep “Today didn't load”, which names the missing thing. |
| `236-237` repeated amount name | Keep the `Guess` label; cut the preceding caption. Rung 2. |
| `240` “Under your lowest ... Tap again to send it.” | “Below your minimum of {amount}.” Confirmation button explicitly says Send {amount}. Keep consequence, remove instruction defending double-tap behavior, rung 4. |
| `276`, `290` “Done for you”, “Everything it did” | Replace the archive trigger with Activity leading to `/you/log`. Rungs 1 and 2: navigation names the destination; rows on Activity retain “Done for you” where needed to identify automatic acts. |
| `172` “Waiting for signal” | Keep only in offline/queued state, once per affected scope. It passes the ladder because it explains why an act has not completed. |

## Sell

**Purpose:** find one of my things by its selling state, then open that item.

Person: an owner checking a listing or shipment, daily to weekly. They may ask for a status dashboard; photos and state groups let them find the right object without reading totals. Worst mistake: confusing an ended item with a live listing or accidentally changing many listings.

### Sell now, top to bottom, and what is not Sell

References are `app/src/app/(tabs)/sell.tsx`.

| Current block | Assessment and destination |
|---|---|
| `151-167`: header, empty and read failure | Keep, but current empty check precedes failed/loading, so a missing collection can claim emptiness. Evaluate fetch state first. Empty currently bypasses + with a direct camera button; point to + instead. |
| `199-212`: toast or bulk action foot, blank `Row` containing Select | Keep bulk capability, move Select into shared `TabNav.action`. The otherwise empty utility row spends a content level on a toolbar act, against brand Art. 7.12. |
| `213-222`: one horizontal FilterRow with sort, states, sites | Keep as one row; no extra duplicated state navigation above it. Chips are filters, not headings or cards. |
| `224-239`: offline line, skeleton grid, shelves each limited to four tiles or one filtered grid | Keep photo inventory and real state groups. Remove the unsourced four-item preview cap at `16-17`, `233-234`; every item stays reachable without arbitrary truncation. Shelf See all and a state chip currently set the same filter; retain the chip as the single filter control. |
| `241-245`: Pause selling and “Away for a while” | Move to Settings > Rules and limits > Pause selling. It changes global automation, not the item being located. Keep an active-pause notice linking there, only while paused. |
| `247-250`: Sort sheet | Keep short single choice sheet. |
| `253-263`: bulk change sheet, four changes, affected count, order guard, approve | Keep only in explicit selection mode. This is an inventory operation, not normal browse content. Preserve open-order refusal and outward delisting consequences before commit. |

### Redesign stack and reasons

1. Shared scaffold with `TabNav.action` containing `parts/buttons.tsx` `Pill` Select, light fill. Selected mode replaces it with Done. No blank content row.
2. `parts/chip.tsx` `FilterRow`, containing `Chip` Sort, All, available selling states, Kind, then real site logos. It narrows the same inventory; applying a state does not push a new page. Kind opens a medium `Sheet` of `Choice` rows from actual item kinds, with All kinds to clear. Its loading/error state must be wired rather than omit this planned filter. Keep current enum/filter derivation for the other controls.
3. `parts/tile.tsx` `Shelf` for Needs you, In progress, Live, Sold, Unsold, Kept; `layout.tsx` `Grid` with two columns of `Tile`. No four-item slice and no parallel See all control. Needs you uses Today order; Sold puts to-ship first. All urgent shelves start open, Unsold and Kept start folded. Each fold retains its count and its own state, not a page-wide accordion. The first urgent item's photo is the focal object; without one, first item in the first populated shelf. No extra money hero.
4. A filtered view uses the same `Grid`/`Tile` directly, with the selected chip providing context. Zero matching items uses `EmptyState` “No matching items” with a secondary `Pill` Clear filters. This is distinct from an empty account.
5. During selection only, `parts/buttons.tsx` `FootButton` Change {count} opens a `Sheet`; `parts/chip.tsx` `Choice` and `parts/loop.tsx` `Approve` name the actual changes. Without selection there is no foot action. No tutorial or bulk toolbar on initial entry.

6. Audit addition: the selection sheet also contains a `parts/list-row.tsx` `ListRow` Manage listings -> proposed pushed `/sell/manage`, carrying the selected IDs. That page's single purpose is to preview and approve one bulk listing operation. It supports reprice by percent/rung, relist, end listings, offers to watchers and lever changes; filters include age/kind/site. Use existing `List`, `ItemCard`, `Guess`, `Choice`, `Approve` and per-row check controls from `Tile` selection. Before commit show every included listing's before/after/net, exclusions and why, per-site counts and pacing. No bulk operation promotes a rule; below-floor rows still require their own approval. Keep the simple Keep/Donated/Sold elsewhere/Delete choices as existing inventory changes, not substitutes for these planned listing tools.

### Planned features

Pages §6.10 and §7 assign item-card, list, score and sold, with replay failures and valuation facts visible through the item tiles. Listing/plan work remains behind Item; the Sell root still locates a thing.

| ID | Planned capability and source | Disposition and exact home |
|---|---|---|
| S01 | Needs you, In progress, Live, Sold, Unsold, Kept shelves; derived decisions; to-ship first; folded end states | In redesign: `Shelf`/`Grid`, all results reachable. State filters are the same query, not separate pages. |
| S02 | Photo, lifecycle/action tag, standing, real site badges and honest money fact; item-card/score/sold | In redesign: `Tile`, `TAGS`, sourced net/ask/worth labels. Failed post/delist beats a misleading Live tag. |
| S03 | Sort and filter by state, marketplace and kind; pages §6.10 | Added: actual Kind chip/sheet above; original proposal only made kind conditional. No invented category defaults. |
| S04 | Researching, review, posting, live, delisting, failed, sold and returned/disputed jobs; list/sold/replay | In redesign: tile state updates in place, opening Item for per-site verification and retries. Preserve listing identity across repost/external-ID change. |
| S05 | Selection, keep/donate/sold elsewhere/delete, cancel and reversible undo | In redesign: Select -> Change sheet. Preserve stock/history and open-order guard; no unilateral site deletion. |
| S06 | Bulk reprice/relist/end/offer/lever change with exclusions, net preview and untick; list | Elsewhere: added Manage listings row in selection sheet -> `/sell/manage`; build exact preview and paced per-member outcomes there. |
| S07 | Per-site draft, fields, overrides, photo ordering, recall gate, first-post approval, Retry/Edit/Skip | Elsewhere: tile -> Item -> Post preview. Cross-list existing listing through + Sell it with link or Accounts import. |
| S08 | Five selling intents, price path/date/fallback, per-item floor/Always accept and cross-site pricing rule | Elsewhere: Item -> Plan. Same take-home default, with same price/market/shop alternatives; account default in Settings -> App defaults. The newer cross-listing decision governs older one-price language. |
| S09 | Editable identity/condition/flaws/measurements/photos, evidence, cost/location/quantity/SKU and shelf label | Elsewhere: tile -> Item and its field/Why editors. No editable record form or studio workflow on root. |
| S10 | Paid sale proof, each other site removed, ship/label/insurance/batch print, pickup, payout/return/claim history | Elsewhere: Sold tile -> Item -> Ship/Pickup/order, with urgent decisions also on Today. Root keeps state and net only. |
| S11 | Four score axes, source/basis, ranker-changed state, strongest fix and intent-aware standing | Elsewhere: Tile -> Item -> score basis `WhySheet`. Root keeps concise standing and never calls a reserve/just-checking item stale for not selling. |
| S12 | Events, original evidence, pinned edits, permitted undo, automatic-action transparency | Elsewhere: Item -> Why timeline, and You -> Activity. No duplicate log beneath the grid. |
| S13 | Pause selling/site/account health and permissions without abandoning open orders | Elsewhere: Settings -> Rules and limits -> Pause selling, via You; a real active-pause notice can link there from Sell. |
| S14 | An appraised `owned` item, kept worth and Sell this later | Elsewhere: You -> Worth -> Item -> Sell this, or + Worth result. Do not lose owned records just because Sell is a selling-state query. |

### Left to wire

| Redesigned part | Runs on today, with code evidence | Left to wire, proposed caller, unavailable real states |
|---|---|---|
| Header/count, state shelves and tile identity | Demo `useScreen` at `app/src/app/(tabs)/sell.tsx:97`; fixture shelves at `app/src/demo/world.ts:42-53` exclude `owned`; `sell.tsx:145-147` uses demo photos. `app/src/demo/index.ts:7-19` names the persona files. | `app/src/sell` reads specced `GET /v1/items`, `/v1/stream` state/score changes and conversation count. Needs-you count/kind and `market_standing` are new in §8. Existing item handler uses store plus example tile shapes at `app/src/edge/api/items.ts:15-16`, `:54-62`; runtime seeds example rows at `app/src/edge/api/runtime.ts:40-45`. Root is not connected to it. Real loading/error/empty, cross-tab changes and real per-site photo URLs remain unproved. |
| Money, standing and job tags | Local derivation `sell.tsx:53-90`, demo order/listing data and `pill` at `app/src/demo/world.ts:24-32`; no root job subscription. | `app/src/sell` consumes item DTOs, specced `GET /v1/scores`, `/v1/scores/:id/basis`, `/v1/jobs/:id[/events]`, plus standing fields new in §8. Per-site job failure, delayed read-back, expired standing, unknown net and sparse evidence must come from real records. `score` endpoint name alone does not supply missing observations. |
| Sort/state/site/kind filters, folds | Real local UI behavior: local states at `sell.tsx:102-108`, sort/filter application `:136-139`, chips `:213-222`; fold storage `:38-46` is memory/web localStorage. There is no Kind chip in that render. | Existing local sort/filter can remain local when the complete fetched set is available; fetch all specced `GET /v1/items` cursors first or specify server filter fields before using partial counts. `app/src/sell` maps actual kinds for added sheet. Need device-persistent folds if promised across restart. Filtered empty, taxonomy-read failure and partially loaded shelf counts are not proven by fixed world filtering. |
| Uncapped grids/loading-more/refresh | Current preview slices at `sell.tsx:233-234`; `Grid` maps children in `app/src/ui/layout.tsx:103-108`; Screen scroll is `:39`. Failed/empty/skeleton branches use fixture flags at `sell.tsx:152-167`, `:195-196`, `:227`. | `app/src/sell` must follow specced items pagination without a four-item UI cap; `Screen` needs refresh and anchor API. Backend pagination helper exists at `app/src/edge/api/captures.ts:41-62`, so do not confuse “all demo rows drawn” with remote completeness. Genuine append error, pull refresh and cached offline read are not wired. |
| Select, Change and Undo | Selection toggles locally at `sell.tsx:147`; apply mutates `moved` and toast at `:182-190`, which changes only the demo world at `:118-126`; offline sets `held` at `:261`. No site mutation occurs there. | Proposed `app/src/sell` operation layer must call versioned item/listing actions and the specced Decision act endpoint; `PATCH /v1/items/:id` currently validates only title/location/cost/price at `app/src/edge/api/items.ts:76-78`, so keep/donate/sold-elsewhere/delete and bulk-initiation payloads need an explicit new contract, not imaginary PATCH fields. Undo calls specced events/undo. Need real failed/partial outcomes, guarded exclusions and reconnection validation. |
| Added Manage listings | Nothing yet in current selection sheet: only four changes at `sell.tsx:253-258`. The proposed `/sell/manage` is a new pushed destination, not an existing control. | Client owner `app/src/sell`; `bulk_action` approval at specced `POST /v1/decisions/:id/act`; preview/create endpoint is not named in pages Feeds or list Contract, so propose it as new before implementation. Job reads/stream are specced. Preview loading, no eligible listings, per-site failure and durable resume need actual jobs. |
| Item, Plan, Post, fulfilment and Pause routes | Item push is real navigation at `sell.tsx:147`; Pause pushes `/you/pause` at `:243`, but current `PAGES` accepts no pause at `app/src/you/state.ts:59-72`. | Item/fulfilment callers consume specced `GET/PATCH /v1/items/:id`, strategy/listings/ship/labels endpoints and new-in-§8 intent/plan-choice fields. Site posting and order-label actions must complete behind those routes; `app/src/edge/api/orders.ts:26-28` still serves label examples. Settings lane supplies missing Pause route. The current Pause control is a dead destination, not a working away mode. |

These controls are functional local interactions, not no-ops: sort, filter, fold, select and opening sheets. Their missing part is server read/write and cross-screen persistence. Distinguish that from the absent Kind/Manage controls and the unsupported Pause route.

Tiles keep the item photo, one stage/action tag, logos and one money fact. Use `states.ts` `TAGS`; never invent state colors for Kept or Unsold. Standing detail and explanation live on Item; the existing Hot/Slow/failed signals remain on its tile. `You get` on Sold is net, `Listed at` on Live is asking price, `Worth` on Kept is a sourced range. They are not interchangeable figures.

### Sell states and controls

| State | Sell-specific content and available action |
|---|---|
| First load | Shared frame, known filter/selection affordances disabled only if they require missing data; matching `TileSkeleton` grid after delay. Do not branch to Nothing for sale first. |
| Loaded / one / dense | All items accessible in their state sections. Dense grids virtualize behind the shared layout; no content cap. A one-item shelf keeps two-column sizing. |
| Empty / new | `EmptyState` Nothing for sale, no duplicate camera CTA. The persistent + is the next action. A filtered empty uses Clear filters instead. |
| Partial / jobs | A captured item appears immediately on In progress with `working` tag and real job stage. Results update the tile in place. Site failures show failed state without discarding listings that did succeed. Open Item for the site's Retry. |
| Loading more | If a state query is paged, append tiles in that state. A shelf total is labelled only when the total is known; do not claim the fetched length is the inventory total. |
| Refreshing | Native pull refreshes items and open-decision status, preserving site, sort, fold, selections and anchor. A selected item removed remotely is explicitly removed from the selection and announced before a change can commit. |
| Offline | Cached tiles remain navigable. Sort, filter, folds and select work locally. Bulk change sheet can be prepared; outward delist/delete/mark sold waits for reconnection and revalidation, clearly uncommitted. No pretend completed tile movement. |
| Error / retry | Your things didn't load with Retry on cold failure. Warm failure keeps inventory and uses inline Retry. A bulk failure keeps selected items and identifies which succeeded; retry only failed IDs. |
| At top / down / up / re-tap | Shared rows apply, with filter row scrolling normally. Re-tap does not clear the selected state/site, folds or checkboxes. |
| Keyboard | None on the root, Sort or bulk choices. Detail editors use their page's keyboard contract. |
| Reduce Motion | Fold content changes instantly with state announcement; selected ring changes without travel. No animated grid reorder. |

Control differences: state/site chips apply in place; a site chip toggles that site off on a second tap, All clears state but preserves site and sort, Clear filters clears state and site while keeping chosen sort. Sort opens medium `Sheet`, choosing a `Choice` applies and dismisses. Shelf header folds using `MOTIONS.shelfFold` 200 ms with no haptic; no navigation chevron on that fold. Tile tap normally pushes Item; in Select it toggles selection and stays here. Done clears uncommitted selection. Change opens medium bulk sheet, expanding to large when needed. Choices only prepare the operation; `Approve` names item count and live listing count before dispatch, with Delete in destructive styling and its loss consequence. Open orders remain protected; if all selected items are protected, disable commit and say why. Dismissing the sheet preserves the selection but drops the prepared change. Reversible results use `UndoToast` for five seconds; irreversible delete never displays Undo. Haptic only on selection commit, actual bulk commit or new failure, per shared rules.

### Sell copy changes

| Source | Change and reason |
|---|---|
| `156` Sell something | Cut the duplicate button; + is the sole creation entry. Rung 1. Keep Nothing for sale. |
| `164` Try again | Retry, shared label. |
| `202` Select items on a disabled action | Change items while disabled; selected count becomes Change {count}. A disabled action need not instruct selecting. Rung 4. |
| `243` Away for a while | Cut with the row moved to settings. Rung 2: Pause selling already names it. |
| `255` Ends listings. Sell again any time. | Keep “Ends {count} live listings” at confirmation, cut the reassurance. Rung 3. |
| `256-257` Ends listings, keeps the value / counts the sale | Show the listing consequence at confirmation. Keep any record consequence there if it differs; no permanent reassurance under every choice. Rung 4. |
| `258` Removes them and their photos. No undo. | Keep at Delete confirmation, with open-order restriction when applicable. Real irreversible consequence passes the ladder. |

## Buy

**Purpose:** find a thing I want to buy, then open its search results or matching listing.

Person: an intentional buyer checking searches and matches, several times a week. The product's supplied evidence is the constitution's “finds and holds it, and they tap Buy” principle; no claim of a new field study. Worst mistake: sending an offer or raising a budget while intending only to inspect a match.

### Buy now, top to bottom, and what is not Buy

References are `app/src/app/(tabs)/buy.tsx`.

| Current block | Assessment and destination |
|---|---|
| `81-88`: `TabNav`, fetch branches, SearchField | Keep search and one camera entry. Loading branch currently replaces the usable search box with generic card skeletons, breaking stable scaffold and entry point. |
| `89-91`: offline line, empty headline and explanatory paragraph | Keep state-specific meaning, cut the promotional “Search five sites at once” and the explanation beneath an obvious search field. C7 and clean-copy rungs 1/2. |
| `93`: Needs you plus `57-77` offer/over-budget decision cards | Move decisions to Today; show a match tile that opens Listing, where Offer is explicit. Sending or raising a ceiling is a different job from finding a thing, and consumes this tab's first focal region. Keep each decision reachable in Today and its associated Listing/Want. |
| `95-100`: full vertical New matches card list | Keep matches, use the same shelf/photo-grid family as Sell. The current flat run of large cards has no shelf rhythm. |
| `102-113`: Looking for wants as ItemCard list | Keep Wants under Watching, grouped with saved listings rather than an ambiguous second meaning of Watching. Each Want still opens `/want?id=...`. |
| `115-120`: saved listings labelled Watching | Keep as Saved inside Watching's section, distinct from scheduled wants. No disappearing saved capability. |
| `122-130`: Bought ItemCards | Keep completed purchase entry points in Bought shelf; fulfillment detail stays on Item/order. |
| `132-144`: OfferSheet and More | Move to Listing or Today with their decisions. No direct send controls on Buy's root. |

### Redesign stack and reasons

1. Shared scaffold. `parts/search-field.tsx` `SearchField` is the focal control, labelled Find an item or paste a link, with its existing camera icon. Search is immediately usable, including during a shelf refresh.
2. `parts/tile.tsx` `Shelf` New matches; `layout.tsx` `Grid` two columns with `Tile` for each listing, site logos and fact Delivered {total}. Under the tile use `parts/match.tsx` `PriceRead` within `layout.tsx` `Stack gap="tight"`. This is composition of existing parts: the photo locates the thing, delivered price enables comparison, PriceRead preserves uncertainty about size/model. Do not invent a seller lifecycle tag for an outside listing. Whole tile opens Listing; PriceRead has no separate action.
3. `Section` Watching with a `Shelf` Saved searches of Want `Tile`s, followed by `Shelf` Saved of listing tiles. A want tile uses its product photo or an available matching photo; while unavailable retain the kit's neutral photo slot and an honest title, not an invented item image. Want fact is Up to {delivered ceiling}; scheduled/paused state is a word using existing waiting/ended semantics, not a new state hue. These are two queries under the same monitoring purpose. Default both open; no preview cap.
4. For you appears only after actual opt-in, with a `Shelf` and the same listing tiles. Its opt-in and off control belong on Your style in Settings; no permission pitch takes over Buy. Do not manufacture recommendations from absent data.
5. `Shelf` Bought with `Tile` using purchase photo and Paid {actual delivered amount}. It may fold, preserving its count, and opens purchase detail on Item. No automatic buying or confirmation here.
6. All collections empty: `EmptyState` Nothing on your list below SearchField, no extra paragraph or CTA. Search is the one next action. Do not display several empty shelves.

### Buy states and controls

| State | Buy-specific content and available action |
|---|---|
| First load | Frame and SearchField remain real. Mirror known grid slots with `TileSkeleton`; do not draw offer-card skeletons for shelves. |
| Loaded / one / dense | Same shelf/grid rhythm as Sell. One match has normal tile width. Wants, saved listings and purchases all remain reachable without a preview quota. |
| Empty / new | SearchField then Nothing on your list. A Watch with no matches is not an empty tab: keep its tile and last checked state. |
| Partial / jobs | A Want starts immediately; its checking state remains on its tile. Source results arrive without resetting other shelves. Missing sites are unknown, not “No matches”. Failure opens Want for source-specific Retry. |
| Loading more | Append per query, preserve delivered-price ranking as a stable snapshot while browsing. If a refreshed rank would move the touched item, retain its anchor until refresh completes. Tail failure has Retry; search stays usable. |
| Refreshing | Native pull refreshes matches and wants, preserving query draft and shelf folds. Do not submit the draft, send an offer or alter a ceiling. |
| Offline | Keep saved matches/wants with Waiting for signal. Search text can be drafted; submitting offline keeps the query and shows Search needs a connection with Retry. Camera may capture locally in find mode; remote comparison waits. No offer dispatch. |
| Error / retry | Your list didn't load with Retry in the collection region; SearchField remains available. Partial source failure stays within the affected Want. |
| At top / down / up / re-tap | Shared scroll behavior; SearchField scrolls away with content, no floating duplicate search. Re-tap brings it back without focusing or submitting. |
| Keyboard | Tapping field focuses native keyboard with Search return key. Preserve unsent draft after blur, scrolling or switching tabs; existing `SearchField` resets from `value` on re-entry, so fix its shared draft ownership. Interactive scroll dismisses keyboard; outside tap dismisses and does not submit. Return submits nonblank input once, dismisses keyboard and pushes results. Root tab bar is hidden while editing, not lifted above keyboard; restores unchanged on dismissal. |
| Reduce Motion | No tile travel, result stagger or animated typing. Keyboard uses system accessibility behavior; results use native navigation fallback/crossfade. |

Controls: text or pasted URL submits `/search?q={encoded text}`; assist also works under the root input as specified below, while the result list remains on Search results. Back/edge swipe returns to Buy with its draft, folds and offset. Camera explicitly opens `/camera?mode=find` as the existing full-screen capture task; Close returns to Buy, not Sell. New matches and saved listing tiles push `/listing/:id`; want tile pushes `/want?id=:id`; Bought pushes `/item/:item_id` in its purchase context. For you tiles behave like other listings. Shelf folding uses shelfFold 200 ms, no haptic; navigation has none. Search does not haptically acknowledge each character or successful read. No root Offer, Raise, Skip or More decisions remain to conflict with this purpose.

### Planned features

Pages §6.12 and §7 assign buy, watch, assist and market, with score and appraise facts on matches. The feature audit adds the following to the stack and interactions above. These corrections replace the earlier proposal's relocation of all ambiguity controls to Search results.

Audit additions to the redesign:

- Under `SearchField`, while it is being edited, keep one focused assist control anchored under the field. Use `parts/pick.tsx` `GuessPick`, `parts/size-picker.tsx` `SizePicker`, `parts/range-slider.tsx` `RangeSlider`, `parts/colour-swatches.tsx` `ColourSwatches`, `parts/choice-chips.tsx` `ChoiceChips`, and `parts/loop.tsx` `Blank` for Other. Only an input that changes the match set appears. Picking commits in place with select 200 ms, keeps the original words, updates the assumption and closes that picker. Other opens text entry, Not sure preserves an unsettled fact, and Undo removes an assumption. Tapping outside closes the picker; no inferred slot blocks Search. The keyboard hands its space to the focused picker without obscuring the input. Reduce Motion uses immediate changes. No repeated haptic for typing or parsing.
- **NEW PATTERN, needs Ben's OK:** marked spans inside an editable search field, with the anchor for one picker. `SearchField` has no span/interpretation props (`app/src/ui/parts/search-field.tsx:17-26`) and its `TextInput` is plain text (`:43-55`). `GuessPick` is a whole-field picker (`app/src/ui/parts/pick.tsx:20`); it cannot represent two independently marked words in the same editable input. Existing widgets can render the answers, but cannot supply this missing input pattern. Keep this planned capability explicit and gated for the reconciler; a plain search plus a separate unmarked form is not claimed as equivalent coverage.
- On each match tile, preserve `PriceRead` and add a quiet `ListRow` in its Listing destination for Why this match, with measured fit or Size only, fair-range basis and Also on sites. Root duplicates collapse to one physical item with full logos for its known copies. Use recorded identity labels, never percentages. On the Want tile, show current checking or last-checked/behind state in its fact line; the Want page shows each site separately. Stale sites must not look like a completed empty search.
- Each For you tile has a secondary Why this choice action in a contextual `Sheet`, using existing `Choice` and `WhySheet`; it exposes the actual inferred trait and links to Settings > Your style to edit/remove/reset it. Do not bury the opt-in where it cannot be found: when opted out, a single `ListRow` For you -> Your style may sit after Watching, without a pitch, empty shelf or filled primary. No recommendations of the person's own stock.
- A signed-out visitor keeps text/photo/link search and product/referral routes. Watching, saving and offers push sign-in only at that action, carrying query/selection through resume. Do not render fabricated private Watching/Bought shelves for a visitor. + Sell remains gated by its own sign-in flow.

| ID | Planned capability and source | Disposition and exact home |
|---|---|---|
| B01 | Text, photo and pasted-link entry across marketplaces and official retail; buy/watch | In redesign: one `SearchField`, camera find mode, `/search` submission. |
| B02 | Assist highlights guesses, fitted inputs, preselection, Other, Not sure, assumptions/Undo and no forced chat questions; assist/pages §6.12 | Added: editing block and marked-span pattern above. No result list on root; edits carry into Search results. Pattern approval and implementation remain outstanding. |
| B03 | Unseen New matches across all wants, one result per physical item; watch | In redesign: first `Shelf`, same photo grid as Sell, links to Listing. |
| B04 | Wants on Watching, zero-match wants retained, paused/running/checked/behind states; watch | In redesign: Saved searches shelf and Want route. Per-source checking belongs in Want. |
| B05 | Saved listings remain available; local save versus optional on-site save distinguished | In redesign: Saved shelf. A failed on-site save still leaves Saved here; detail/Today handles approval and failure. Never simulate a Poshmark like as saving. |
| B06 | Opt-in For you, inferred reason, profile editing/reset and no own-stock recommendations; buy/insights | Added: For you discovery row and per-choice Why sheet. Actual recommendation shelf retained; profile control stays on Your style. |
| B07 | Bought shelf with cost, order and owned-item route | In redesign: purchase tiles -> Item in purchase context, with Sell this on the detail page. |
| B08 | Glance/check/recall, Pay up to, offline haggle pad, equivalent products and deep appraisal | Elsewhere: + -> What's it worth, or Listing -> valuation/Worth. Add an explicit What's it worth row in the Listing page so a pasted Buy link can reach the same appraisal, not only the separate + route. |
| B09 | Identify/correct product/variant, streaming sites and counts, delivered-price ranking, condition/stock/location filters, official alternative, Similar for less and sources | Elsewhere: Search results, reached by Search. Search-result lane retains the full comparison, not a simplified keyword list. |
| B10 | Open on site/referral disclosure, Save, Offer/Ask approval, seller terms/protection, fair range/score axes, buy on site and Did you buy it | Elsewhere: Listing and Thread, reached by match tile, plus Today decisions. Referral cannot influence rank; no payment collection on root. |
| B11 | Want creation and touch edits to size/department/color/condition/fit, delivered two-thumb budget, ship/pickup/radius/sites, quiet hours, pause/end, immediate recheck | Elsewhere: Search -> Watch -> Want and Watching tile -> Want. Use captured garment measurements when available; no forced size-only match. |
| B12 | Exact/likely/variant/comparable/unresolved labels, guarded fair pricing, “not stated”, dedupe and alternate sites | Added: match contract above; `PriceRead` remains on root, deeper basis via Listing row. Unknown authenticity/hidden condition never becomes confirmed. |
| B13 | Per-source checking/freshness and behind recovery while watch runs away from app; immediate under-price alert | Added: root Want fact line, source detail on Want, match/checked stream and exact push target. No invented progress or source-complete claim. |
| B14 | Visitor search/referrals, sign-in at save/watch/offer with carried query | Added: visitor variant above. Signed-in shelf behavior does not leak another person's data into visitor mode. |
| B15 | Replace-after-sale, seller counter, above ceiling and explicit purchase confirmation | Elsewhere: Today, with links to Listing/Want. Preserve the same decision IDs; removing Buy's root buttons does not discard these decisions. |
| B16 | Product history, offers, fair range, new-versus-used value, supply/speed, trends and Follow | Elsewhere: Listing/Search -> Product page; each result must link to it. Not a second market dashboard beneath Buy shelves. |

### Left to wire

| Redesigned part | Runs on today, with code evidence | Left to wire, proposed caller, unavailable real states |
|---|---|---|
| Root shelves and count | Demo `app/src/buy/world.ts:8-9` aliases `useScreen`; root derives `asks`, `fresh`, `saved`, `wants`, `bought` from `w` at `app/src/app/(tabs)/buy.tsx:38-45`; `drawn` substitutes buyer fixtures at `:21-26`. Actual files are `app/src/demo/worlds/buyer.ts`, `clearing.ts`, `new.ts`, `flipper.ts`, selected by `app/src/demo/index.ts:7-19`. | `app/src/buy` calls specced `GET /v1/wants`, `GET /v1/wants/:id/matches`, `/v1/orders?kind=purchase` and conversation count, joining stable IDs across shelves. Backend wants is store-backed but seeds `spec/examples/buy.json` through `app/src/edge/api/wants.ts:13-23`; list/match reads are `:59-76`. Remote loading/error/empty, pagination and cache freshness do not currently drive root. |
| Search submit/camera | Real route navigation only at `buy.tsx:87-88`; Search results gets a demo result through `searchFor` at `app/src/app/search.tsx:25`. Root camera URL currently has no find mode at `buy.tsx:87`. | Caller `app/src/buy`: specced `POST /v1/search` and job reads/events, explicit capture purpose new in §8. Preserve root query and hand off job ID to results rather than start two searches. Real fan-out, partial source failure, visitor auth/rate-limit, empty search and retried search are not demonstrated by route changes. |
| Assist input and controls | Nothing wired to assist in root input props `buy.tsx:87-88`. `SearchField` owns only local draft/editing at `app/src/ui/parts/search-field.tsx:28-31`, resets draft on entry at `:58`, with no parsed marks. | `app/src/buy` calls specced page-map `POST /v1/assist`, described as new in assist's feature contract; job stages/clarify acts/undo use specced job, decision and event endpoints. API's intel returns empty facts and writer throws at `app/src/edge/api/assist.ts:9-11`; route finishes the job at `:14-20`. Wire real parser/intel/provider and marked-span renderer. Pending/guessed/changed/stale/dropped and Other-validation states have no real UI path yet. |
| New matches, dedupe, fit, PriceRead and reasons | Current MatchCards render fixture verdict/likeness at `buy.tsx:95-99`, `:115-119`; no root source-backed citation action is passed there. | `app/src/buy` maps specced match reads, `POST /v1/compare`, `GET /v1/scores`, basis/citation reads and stream `match.alerted`. Read target exists in `app/src/edge/api/wants.ts:74-76`, not its root consumer. Need photo URLs, cross-post dedupe, measured-vs-label fit, honest delivered totals and hidden-range/unknown-source states. |
| Wants/checking/behind | Root Want facts only compute count and ceiling at `buy.tsx:103-110`. Separate Want has a real opt-in `/v1/stage` poll at `app/src/app/want.tsx:53-67`, with sample branch at `:51`; that path is not imported as Buy's root data. | `app/src/buy` consumes specced `GET /v1/wants` checked/behind fields and stream `want.checked`, not the stage feed as a complete substitute. Backend update path is `app/src/edge/api/wants.ts:93-114`; it requires actual watch jobs to call it. The existing quiet-hours field ignores the edited value at `app/src/app/want.tsx:204`, so its visible editor is also left to wire on Want. Need genuinely running/partial/behind/recovered states and notification token/deep links, new in §8 via `PATCH /v1/me`. |
| Saved and bought | Fixture filters at `buy.tsx:41-43`; purchase navigation `:126-127`. Demo offer completion uses a timeout at `:52-54`, so the current “sent” text proves no outgoing offer. | Calls belong in `app/src/buy` Listing/Want clients: specced `POST /v1/matches/:id/act`, `POST /v1/orders`, `POST /v1/decisions/:id/act`, `/v1/items/:id/sell`, then invalidate shelves. Match handler accepts only dismiss/save/not_same/bought at `app/src/edge/api/wants.ts:81`; saving changes stored state at `:85` and returns it at `:87`, not a proven marketplace save. Purchase POST is an example at `app/src/edge/api/orders.ts:23`. Need durable order creation, failed on-site save, duplicate submission, cancelled offer and cross-tab reconciliation. |
| For you and profile | Nothing yet on Buy root: current rendering goes from saved to bought and overlays at `buy.tsx:115-144`, with no recommendation query or opt-in control. | Owner `app/src/buy` with `app/src/you` profile client: `GET/PATCH /v1/me/style` is specced intent in §6.16 but marked missing there; handlers now exist at `app/src/edge/api/me.ts:134-135`, `:163-164`. No For you read endpoint is named by page Feeds; propose a new recommendation contract or explicit extension of a match read, including `source=for_you`, reasons, consent and exclusions. Need opted-out/opted-in-empty, learning, unavailable-profile and reset states. Do not invent `GET /v1/recommendations` as already specced. |
| Navigation/refresh/error/keyboard | Fixture loading/failed branches `buy.tsx:82-83`, offline `:89`; no refresh wiring on `Screen` at `app/src/ui/layout.tsx:19-39`. | Shared `Screen`, `RouterTabBar`, input draft and auth client work described in the lane list. All listed endpoints use common auth/error conventions; root currently cannot demonstrate a genuine failed request or recovered retry. Keep working navigation distinct from absent backend action. |

The current root has real navigation and local input, but no working offer send, recommendation fetch or assist parser. The redesigned root deliberately removes direct send controls; the destination clients still have to implement those planned actions.

### Buy copy changes

| Source | Change and reason |
|---|---|
| `87` Find an item or paste a link | Keep. It states the two accepted inputs and supplies an accessible name. |
| `91` Search five sites at once | Cut. Rung 1 and C7: promotional statement is not an empty-state diagnosis. |
| `91` Search for something, then watch it to hear when one turns up. | Cut. Rung 2: search field already supplies the next action; watch explanation belongs at the watch choice if needed. |
| `103` Looking for | Saved searches, within Watching. Concrete distinction from saved listings. |
| `116` Watching for saved matches | Saved, within Watching. Avoid making a manually saved listing sound like a scheduled search. |
| `63-76` Your offer / Over your most / Walk away / Raise to | Move these strings with their decision. On the destination use Your offer / Above your budget / Skip listing / Raise budget to {amount}. Rung 4 and C6; actual delivered ceiling and approval remain explicit. |
| `126` fallback Bought as title | Use real item identity; while missing, Item unavailable in the photo slot's accessible label, with purchase amount and a working detail route. A lifecycle word cannot identify a thing. |
| `buy/states.tsx:29` Nothing changed. Try again in a moment. | Cut from tab error. Rung 3: reassurance about an unfired mutation is unnecessary; use the failure title and Retry. |

## You

**Purpose:** choose the account subject I want to inspect or change, then open its own page.

Person: an owner checking money or preferences, weekly or when something changes. They may ask “how am I doing”; Ben's latest feedback says they need simple visual orientation and routes, rather than charts and controls together. Worst mistake: mistaking potential value for earned money, or changing a service connection while only checking progress.

### You now, top to bottom, and where each unrelated part goes

References are `app/src/app/(tabs)/you.tsx`.

| Current block | Clutter rule and destination |
|---|---|
| `63-65`: frame, PageStatus, signed-out site controls | Header joins scaffold. Site sign-in controls move to pushed `/you/connections`, site-specific link sheet behind its row. Root has no link procedure. Keep an Accounts need attention value on the Settings row, plus actionable relink Decision in Today. UI constitution Job and §6.16 Accounts. |
| `67-74`: earned amount or sales empty state, MoneyBar | Keep only labelled earned amount as a read-only overview. Paid out and On its way go to `/you/payouts`; could earn goes to Worth, with live-item drill-in to Sell. Combining realized, pending and hypothetical money in one colored bar fails honest comparison and divides the focal point. |
| `76-81`: Sales each week and WeekChart | Move to the sales overview on `/you/insights`, with Records one row away. This answers a separate trend question; it is not root navigation. |
| `83-88`: Your things, StateBar and per-state Sell links | Remove bar from You; Sell already owns this query by state. Worth page carries ownership valuation. Root Worth row leads there. No second inventory UI. |
| `90-101`: four PulseRows, All live and PulseKey | Move per-item standing to Sell tiles and Item; comparative performance belongs on `/you/insights`. Arbitrary four-item preview and chart legend ask the person to learn a dashboard before choosing a subject. Job, brand E6 and clean-copy rung 1. |
| `103-108`: By site and Records links only if sold | Keep By site as Sales destination, always reachable; Records sits inside Sales. No hiding a valid capability because its data is empty. |
| `110-116`: Your sites, Rules and limits, Activity, Notifications, Settings | Keep Activity and one Settings row on You. Move Your sites, Rules and limits, Notifications under Settings as separate pushed rows. Counters of linked sites and rules on their own move to those pages. This is Ben's main “different types of settings” problem, not a spacing defect. |
| No goal bar in code (`10` comment), although §6.16 requests it | Keep it off You. Goals is an explicit detail destination, not a nagging empty state. Current code is right about absence; the older page description is stale. |

### Redesign stack and reasons

1. Shared scaffold. No profile avatar, greeting, membership status or new account summary card: none helps choose a subject here.
2. `Section` with `parts/small.tsx` `Amount`, `what="Earned after fees"`, when an actual sales ledger exists. This single amount is the focal object and preserves the decided numbers-led overview without turning it into analytics. Its source period is All time, shown as a caption only if needed to disambiguate the data. Use the insights kept definition from released or handed-over orders, with pending money on Payouts. Audit correction: wrap the amount in existing `press.tsx` `Press`, with a visible Why label and `icon.tsx` `Icon` inside that one target, opening `parts/why.tsx` `WhySheet` with its actual citation and plain definition. This preserves “every number opens its source” without a new row or inline chart. Distinguish released earnings from pending payouts; never count an outstanding payout twice. No sold-count badge, mini chart, color bar, goal or could-earn hero.
3. `layout.tsx` `List` with `parts/list-row.tsx` `ListRow` Payouts, Worth, By site. Values are optional real facts: Payouts may show {amount} on its way, Worth may show a sourced owned-item range, By site has no repeated earned total. These are one-line previews of their destination, not stacked analytics. Unavailable values are omitted; missing is not zero. Reasons: identify money movement, value of things, and sales performance as separate subjects. Chevron on every row.
4. A second `List`, separated by `Screen`'s 32 pt topic gap, with Activity and Settings. Activity reaches actions and Undo. Settings reaches all account controls. Settings may show Needs attention for connection failures, with the affected site's actual status on its page. No Sign in button on the root.
5. When no sales exist, omit the Amount block entirely. The same five rows remain. The destination pages explain their own empty states. Do not show Nothing sold yet and a Sell button that would pull this navigation page into a second job. In this state the first row is the focal entry, with the title as orientation.

### Destination contract for the detail/settings lane

These are handoff requirements, not claims that every destination is implemented. Current `app/src/app/you/[page].tsx:22` accepts only keys in `you/state.ts` `PAGES`; an arbitrary `/you/...` link otherwise renders Not found.

| Root / detail path | Required content and reachability |
|---|---|
| Payouts -> `/you/payouts` | Existing destination. Paid out, on its way, release clocks and per-order details; no potential earnings in an actual-cash total. |
| Worth -> `/you/worth` | Missing `PAGES` key. Implement existing spec §6.16 Worth page using owned, kept and live valuations, showing estimates separately from cash; could earn is a block here with a link to Live on Sell. Do not ship the root row to Not found. |
| By site -> `/you/insights` | Existing destination. Receives weekly trend, site comparison and aggregate performance. Rows into Records `/you/records`, Goals `/you/goals`, and Ask `/you/ask`. Goals and Ask are specified but missing route keys. These are independent questions, so pushed pages per §1. |
| Activity -> `/you/log` | Existing destination. Receives Today's archive; per-event why/Undo stays with the event. |
| Settings -> `/you/settings` | Existing destination becomes the single directory for Your sites `/you/connections`, Rules and limits `/you/rules`, Notifications `/you/notifications`, App defaults `/you/defaults`, Permissions `/you/permissions`, plus Account and Your style. No inline operational controls in this directory. |
| Inside Rules and limits | Keep Pickups and Pause selling as explicit pushed rows. `/you/pause` is referenced by Sell but is not accepted by current `PAGES`; it needs a real route. Pickups follows current decision to choose days/times when booking, not obsolete fixed weekly windows. |
| Inside Settings > Account / Your style | Account includes sign-in, sign out, export and delete; style includes reasons, edits, clearing and recommendation opt-in. Route keys are not present; detail lane must add them before linking. Keep locked/outward confirmations on those destination pages. |

The five root rows remain five subjects regardless of account size; this is a navigation hierarchy, not a cap on content. Every capability removed from the root has a named destination above. No new combined dashboard detail page. The missing destinations use existing Page, Block, Sheet and row patterns; new routes alone are not new visual patterns.

### You states and controls

| State | You-specific content and available action |
|---|---|
| First load | All five navigation rows are immediately usable. Amount slot waits for actual data with accessible Loading label; do not skeletonize settings or show a made-up zero. |
| Loaded / one / typical / dense | Same five rows, one known earned figure; no charts grow onto root with more data. One sale does not unlock a new layout. |
| Empty / new | Five routes, no hero amount. Detail pages explain their own emptiness and recovery action. A buyer with purchases but no sales still has Settings and Activity. |
| Partial / jobs | An unavailable summary leaves amount/value absent and a small Numbers unavailable notice with Retry in that region. Navigation remains usable. Export/link jobs live on their own pages and Activity; no job-progress dashboard here. |
| Loading more | Not applicable: a fixed directory and one aggregate read have no append operation. Detail collections own pagination. |
| Refreshing | No pull to refresh. On focus/stream revalidate numbers in place with no blocking spinner, moved rows or haptic. Retry only the failed summary. |
| Offline | Directory works; cached amount remains with Waiting for signal and recorded update time. Never assume that offline amounts have just settled. Destinations apply their own local/cache behavior. |
| Error / retry | Directory never vanishes because insights failed. Numbers didn't load plus Retry in amount region. Account/session failure belongs to the sign-in flow, not a false Nothing sold yet state. |
| At top / down / up / re-tap | Shared scroll behavior. Re-tap scrolls up then does nothing. No compact chart or money pill appears in the header while scrolling. |
| Keyboard | None on this tab. Fields live on pushed subjects; Back restores root offset after system keyboard dismissal on that subject. |
| Reduce Motion | Amount replaces in place without counting up. Directory push respects the shared navigation fallback. |

Every row pushes the exact path above. Back/edge swipe returns to You at the original row and offset. No root actions mutate or link anything, so all root taps are silent navigation with shared Press feedback and native panel transition. The amount and its visible Why label form one target opening medium `WhySheet`; expand to large for basis rows. Done/scrim/swipe closes it to the amount; its source failure keeps Retry in the sheet. Preview values belong to their disclosure row and are not nested separate targets. Settings attention is a row value, not an alert that auto-opens an auth modal.

### Planned features

Pages §6.16 and §7 assign insights, connect, data/automation and account settings, with buy's style and score's experiment consent behind them. Retaining five root routes does not trim the analytics suite. This audit assigns every planned analytical question below to a detail route.

Audit additions to the redesign: By site remains the comparison page, not a second large dashboard. Its footer uses `List`/`ListRow` into the analytical subjects named below. Each pushed subject uses `Section`, `List`, existing `WeekChart`/`PulseRow`/`GoalBar`/`PriceChart` where its actual shape fits, and `WhySheet` for a source. Do not imply that a chart for one measure already implements a different analytical visualization. If no existing chart fits, use honest `ListRow` values with source drill-in; any genuinely new chart pattern is separately proposed, not silently created. Shared insights read filters are period/site/category/brand, and unreported site statistics stay unreported.

| ID | Planned capability and source | Disposition and exact home |
|---|---|---|
| Y01 | Numbers-led overview, earned net with definition, period, citation and unknown-state handling | Added: amount's WhySheet contract above; one amount, no invented zero. |
| Y02 | Cash movement discoverable | In redesign: Payouts row -> `/you/payouts`. |
| Y03 | Owned/kept/live value discoverable | In redesign: Worth row -> `/you/worth`. |
| Y04 | By-site performance discoverable | In redesign: By site row -> `/you/insights`. |
| Y05 | Automatic activity and undo discoverable | In redesign: Activity row -> `/you/log`. |
| Y06 | All controls discoverable without a root settings list | In redesign: Settings row -> `/you/settings`, attention only for a real issue. |
| Y07 | Released versus pending payouts, payout clock, per-order proof and manual Got paid where needed | Elsewhere: Payouts and each order. Root preview cannot conflate pending with received. |
| Y08 | Worth range, weekly movement, count not valued, live potential net, just-valued owned items | Elsewhere: Worth, with Item and Sell Live rows. Include kept items and their distinct value subtotal. |
| Y09 | Total listed, total sold all time, sold count, source-qualified money and fees by site | Elsewhere: By site, with source rows; not five root counters. |
| Y10 | Sales each week trend and counts | Elsewhere: By site -> Sales history, proposed `/you/sales-history`. Use `parts/week-chart.tsx` `WeekChart` with sourced rows, not fake continuous growth. |
| Y11 | Expected-keep-weighted storefront success band, site and overall, weakest listings/fix on tap | Elsewhere: By site -> Storefront health, proposed `/you/storefront-health`, then Item. Hidden when no eligible scores. This remains an agent proposal, not a confirmed owner metric. |
| Y12 | Per-site listing funnel, source split, impressions/views/likes/offers/sale with each site's definition | Elsewhere: By site -> Listing funnel, proposed `/you/funnel`, Item for a single listing. Never add incompatible site views together. |
| Y13 | Stale notices, slow movers and category/brand ABC by expected value, suggested corrective act | Elsewhere: By site -> Slow movers, proposed `/you/slow-movers`, then Item/its decision; urgent required acts appear in Today. |
| Y14 | Profit by category/brand/site, known-cost coverage and median sale price | Elsewhere: By site -> Profit, proposed `/you/profit`. Cost unknown stays unknown and is never demanded from a casual seller. |
| Y15 | P&L, fees/shipping/tax/refund/promotion lines, cost/gain, site totals, yearly CSV/PDF and sourced tax note | Elsewhere: By site -> Records `/you/records`; PDF is new in pages §8, not already promised by a working export. No tax advice or made-up 1099 threshold. |
| Y16 | Sell-down forecast: half/all inventory time and net ranges with hide rules | Elsewhere: By site -> Sell-down estimate, proposed `/you/sell-down`. A forecast is distinct from a sales history. |
| Y17 | Listing-month cohorts, share sold by age, share of asking and kept | Elsewhere: By site -> Listing cohorts, proposed `/you/cohorts`; source definition travels with each number. |
| Y18 | Ship-time, cancels, returns, delist reliability and site's own account-risk figure | Elsewhere: By site -> Seller reliability, proposed `/you/reliability`; site health control remains Accounts. No unsupported peer comparison. |
| Y19 | Traffic/ranker, sales pace, fee/refund/late-payout anomalies | Elsewhere: By site -> Changes, proposed `/you/changes`, with object/decision drill-in; Today receives relevant notices. No silent corrective spend. |
| Y20 | Promotion spend against measured result, matched baseline and too-early-to-tell | Elsewhere: By site -> Promotions, proposed `/you/promotions`; live lever changes still ask under Item/Manage listings. |
| Y21 | Optional monthly money/count goal, refunded progress, no guilt or celebration | Elsewhere: By site -> Goals `/you/goals`. Only set goals show progress; absence does not create a task. |
| Y22 | Fixed questions and free Ask over own data, rows/definition/query and failed answer | Elsewhere: By site -> Ask `/you/ask`, guarded query; no chatbot on root. |
| Y23 | Accounts health/capabilities/risk/freshness, link/relink/unlink, imports/merge and per-site retained login consent | Elsewhere: Settings -> Your sites `/you/connections` -> site -> link/import sheet. Search-only OfferUp/Grailed never pretend to be posting targets. |
| Y24 | Rules as when/if/then, Ask/Auto/Never alone, per-kind/site modes, promotion/demotion/history, pause and meetup controls | Elsewhere: Settings -> Rules and limits `/you/rules` -> Pause/Pickups; no fixed weekly schedule or calendar read. Rules reach their Activity evidence and eligible Undo. |
| Y25 | Push now/batch/off per kind, quiet hours, permission/token, immediate sale and under-price match | Elsewhere: Settings -> Notifications `/you/notifications`; original top-level availability is preserved through a row. |
| Y26 | Style from sold/kept/saved/followed/bought signals, reasons/edit/remove/reset, recommendation opt-in, experiment consent | Elsewhere: Settings -> Your style `/you/style`; Settings -> Permissions -> Help test what sells for separate opt-in. Removal is not silently relearned; tests never cross floor or hide changes. |
| Y27 | App defaults including cross-site same-take-home rule, sign-in methods/linking, signout, data export/delete and blocked-open-order state | Elsewhere: Settings -> App defaults `/you/defaults` and Account `/you/account`. Data export/delete is its own account subject with real job state. |

The new analytical route names above are proposals using the existing pushed-page pattern. None is asserted as an implemented route. This splits the suite by question rather than put eleven unrelated charts on By site. The existing five You rows remain unchanged; no extra root shortcut is required.

### Left to wire

| Redesigned part | Runs on today, with code evidence | Left to wire, proposed caller, unavailable real states |
|---|---|---|
| Root amount, previews and attention | Fixture provider selects `app/src/demo/worlds/clearing.ts`, `new.ts`, `buyer.ts` or `flipper.ts` through `app/src/demo/index.ts:7-19`; `app/src/you/state.ts:7`, `:17-20` uses it. Demo `usePage`, `insights(w)`, money/dashboard derivation at `app/src/app/(tabs)/you.tsx:40-52`; hero at `:69`. `app/src/you/state.ts:17-20` reads URL fixtures. Demo money is not the insight API response. | `app/src/you` calls specced `GET /v1/insights` and accounts health; use guarded actual net/period, not `w` arithmetic over presumed complete data. API currently uses a synthetic aggregate from `spec/examples/you.json` at `app/src/edge/api/insights.ts:9-15`, merges funnel into the example at `:18-26`. Need real analytics/order/valuation read ports. Loading, hidden/partial money, no-sale empty and source error are currently fixture renders only. |
| Amount Why/source | Current amount has no press/source callback at `you.tsx:69`; `WhySheet` exists at `app/src/ui/parts/why.tsx:17-29`. | `app/src/you` calls specced `GET /v1/citations/:id`; resolve source ID from insights. Wire source loading, unavailable/expired source, privacy and Retry inside sheet. No source control on this amount works today because none is rendered. |
| Payouts and By site routes | Payouts data derived from `moneyRows(w)` at `you.tsx:48-56`; By site push at `:105`. Both route keys exist at `app/src/you/state.ts:60-61`; `app/src/you/by-site.tsx:17-18` still reads demo insights. | `app/src/you` callers consume specced insights, `GET /v1/orders` and citation reads. Need real order/payout clocks, fee sources, bank versus manual cash and period/site filters; root navigation alone does not verify payout release or source coverage. |
| Worth, Goals, Ask and analytical subject routes | Worth/goal/ask/analytical keys are absent from `PAGES` at `app/src/you/state.ts:59-72`; the gate rejects unsupported pages in `app/src/app/you/[page].tsx:24-32`. These added rows therefore have no destination today. | Add route dispatch/components in `app/src/you` and the dynamic page registry before wiring links. Specced reads: `/v1/insights`, `/v1/scores`, `/v1/citations/:id`; `PUT /v1/goals/:month`; `POST /v1/genie`. Need each subject's real ports, error/empty/hide rules. Goal handler is still an example at `app/src/edge/api/insights.ts:28`. No honest completeness claim for funnel/cohorts/profit/forecast/reliability/promotion from a synthetic aggregate. |
| Records | Root routes to Records only when sold at `you.tsx:103-108`; registry has records at `app/src/you/state.ts:62`. | `app/src/you` uses specced `GET /v1/records?tax_year=&format=csv`, source-qualified P&L; PDF remains new in §8. Wire file download/share, year/format controls and export job state; a row opening a demo page is not an exported real ledger. |
| Activity and undo | Root shows Activity only when fixture events exist at `you.tsx:113`; `changed` logs local UI state at `app/src/you/state.ts:32-35`. | `app/src/you` uses specced `GET /v1/events` cursor and `POST /v1/events/:id/undo`; store-backed API exists at `app/src/edge/api/events.ts:17-42`. Need event subscription, trace/source details, durable undo/demotion and server-denied undo state. Activity directory stays accessible when the real result is empty. |
| Settings, Accounts, Rules and Notifications | Registry keys at `app/src/you/state.ts:63-69`; root links `you.tsx:111-115`. Account link state is a timed simulation at `app/src/you/state.ts:81-98`. Settings Pause is local state at `app/src/you/settings.tsx:20-27`; exports only set Preparing at `:52`; signout only logs and navigates at `:61`; delete remains local working at `:70-71`. | Proposed clients `app/src/you`: specced `/v1/accounts`, rule/limits reads/writes and event/undo. New in §8: auth refresh/signout, `/v1/me` onboarding/prefs/push, second-method linking, import preview, capture-purpose/deep-link fields. Wire OS permission, auth/session store and real account jobs, not another timer. Need actual authorizing/needs-code/expired/blocked/partial/site failure/retry, queued export and deletion completion. |
| Style, experiments, defaults and new directories | Style, Account, Pause and Pickups route keys absent at `app/src/you/state.ts:59-72`. Current Settings exposes defaults/permissions at `app/src/you/settings.tsx:44-46` and account controls inline at `:49-55`. | `app/src/you` supplies missing directories, then specced-intent `GET/PATCH /v1/me/style`, `POST /v1/experiments/consent`, `GET/PUT /v1/limits`, account export/delete; new-in-§8 signout and auth-link. Style handlers now exist at `app/src/edge/api/me.ts:134-135`, `:163-164`. Cross-site price-rule default/override needs the agreed decision represented in limits/strategy DTOs, not a root setting. Need real consent persistence, no-profile/removed/reset states and job recovery. |
| Shared first-load/offline/error | `app/src/you/page-status.tsx:11-20` chooses loading/failure/offline from `asked`; Retry only clears URL state at `:14`. | `app/src/you` must separate summary fetch from static directory, use real cache/network state and preserve navigation on errors. Directory itself needs no data-loading spinner. The current Retry is a fixture reset, not a repeated HTTP request. |

All five root disclosure rows are navigation controls; only their data previews and destination clients need HTTP. Do not disable Settings because the insights service failed. Missing destination keys are an implementation blocker even when a backend endpoint for that subject exists.

### You copy changes

| Source | Change and reason |
|---|---|
| `55` In your bank or your hand | Move only if cash destination cannot otherwise be understood on Payouts. Cut from You with MoneyBar. Rung 2: Paid out already conveys completed payout; preserve cash-vs-bank distinctions on detail. |
| `58-59` Could still earn / If your ... live things sell | Move to Worth and qualify as an estimate from net listing outcomes; keep the condition where a decision needs it. Never mix with earned. |
| `69` Earned after fees, from ... sales | Earned after fees. Move sale count to By site or Records; root needs meaning, not another statistic. Rung 2. |
| `71` Nothing sold yet / What you get after fees shows here. / Sell something | Cut all three from root. Rungs 1/2: account navigation is useful without sales and + already creates things. |
| `77`, `84`, `91` Sales each week / Your things / How they're doing | Remove these root sections, preserving specific destination headings where those questions are answered. This is a split, not cosmetic copy shortening. |
| `97` All ... live | Cut here; Sell's Live filter owns the inventory. |
| `99` The tick is what's usual for it | Cut here with chart. If a chart needs this permanent decoding legend on detail, ask whether its representation is understandable before rewriting it. Rung 1. |
| `111` linked count and `112` ... on their own | Cut root values; retain factual status on their own pages where it informs control. Rung 1. |
| `105`, `107`, `111-115` destination titles | Root labels become Payouts, Worth, By site, Activity, Settings. Detail menu keeps Records, Your sites, Rules and limits, Notifications and the other subject names. No motivational captions. |

## Tab bar and +

**Purpose:** go to one of the four places, or start one of the three item tasks through +, with that destination as the next action.

The bar is navigation chrome, not a fifth content page. + is an action entry, never the selected tab. Current code for the actual bar is `app/src/ui/parts/chrome.tsx`, not `tab-nav.tsx`; the latter is the page heading. `_layout.tsx:8-12` correctly has four routes and no animated transition.

### Bar now and redesign

| Source | Observation and disposition |
|---|---|
| `(tabs)/_layout.tsx:8` | Keep `Tabs` with `animation: 'none'`, `headerShown: false`, custom `RouterTabBar`. No swipe between tabs. |
| `chrome.tsx:103-149` | `TabBar` has five equal slots in a solid capsule. Keep this existing primitive and token geometry. Its raw inset formula is an implementation detail to reconcile with safe-area rules, not a reason for a new bar. |
| `chrome.tsx:151-175` | Active icon pill and unchanged label weight are correct. Keep filled active icon, ink label, secondary inactive icons/labels. Optional dots mean actual new content; no numbers, no pulse. |
| `chrome.tsx:177-195` | `NewSlot` and `NewCircle` draw +; standard calls for 56 rather than current 48. Keep one centered circle; accessibility name New item, visible glyph +. No extra floating add buttons on tabs. |
| `chrome.tsx:199-209` | RouterTabBar changes tabs only if different. Add the shared active-tab scroll-to-top dispatch for a re-tap; do not use `router.push` to accumulate duplicate tab roots. |
| `tab-nav.tsx:19-34` | It is a title row with optional action and Messages, not the bottom bar. Use title/action here, inbox only in shared Nav under this proposal's precedence choice. |

No part of the bar needs a new visual pattern. Use `RouterTabBar`, `TabBar` and their internal slots from `parts/chrome.tsx`, `IconButton` from `parts/buttons.tsx`, existing `Icon` from `icon.tsx`, and `Press`. The selected icon pill provides orientation; + is the one creation action, not a second dashboard hero. No black pill elsewhere merely to balance it.

### + handoff and complete control contract

Tap + presents `/new` as the existing temporary full-screen overlay, with its actual point of origin recorded from the button. It does not change selected tab or scroll offset. `new.tsx:62-78` already composes `parts/takeover.tsx` `TakeoverPlace`, `CircleStage`, `ChoiceColumn`, `ChoiceCapsule`, `PlusClose`, and `parts/camera.tsx` `FeedLayer`. Keep those patterns and the three jobs from pages §6.4: Sell it, What's it worth, Find or buy it. This task owns their entry/return contract; the capture lane owns the internal flow.

| Control | Result and return |
|---|---|
| Other tab | Swap content immediately, no animated pill travel, haptic or forced refetch. Preserve each tab's local state. |
| Current tab | Shared scroll-to-top, then no-op at top. It does not become a refresh gesture. |
| + tap | `MOTIONS.newOpen` 300 ms, choices `newChoice` 200 ms with the standard's 30 ms stagger; PlusClose transforms + to close. Reduce Motion fades the overlay, no expansion. No haptic for opening navigation. |
| + long press | Existing page spec §6.4 requires last-used camera mode directly; `NewSlot` has no long-press API today. Extend that shared control. Native long-press recognition, one selection haptic when the shortcut is recognized, suppress following tap. Tap menu is the visible fallback; VoiceOver custom action names the mode. No arbitrary new timer in the tab screen. |
| Sell it / What's it worth / Find or buy it | Open camera with `mode=sell|worth|find` using `MOTIONS.cameraOpen` 300 ms from the chosen control. Last-used order updates on actual choice, not merely opening menu. No automatic post, bid or purchase. |
| Pencil on a job | Open that job's existing text/link `Sheet`, medium expanding to large with keyboard. `parts/loop.tsx` `Blank` provides actual fields; closing sheet returns to the three choices. Finishing lands in Item draft, Worth or Search, as the camera route would. |
| Close / system Back | Reverse overlay to the same + and restore original tab/offset. Edge swipe must dismiss the temporary task or do nothing, never navigate to a different tab. Direct `/new` entry without origin returns to Today. Camera Close returns to originating tab, preserving captured draft according to capture lane's contract. |

Fields inside + preserve text on keyboard dismissal. Closing the full entry flow with a material draft offers Save draft or Discard via the existing sheet/choice parts; it must not post anything. A deep link into a task has explicit origin fallback. Prevent double taps from creating duplicate route entries without locking ordinary tab input behind an animation.

### Bar state coverage

| State | Bar and + behavior |
|---|---|
| First load / loaded / empty / partial | Once fonts/app shell are ready, all four places and + are available. Each tab's content state is independent of bar rendering. No bar skeleton. |
| Loading more / refreshing | Bar remains usable; no spinner replaces an icon and no selection changes. Re-tap retains its normal scroll behavior. |
| Offline | Same bar. + can start local capture or text draft; remote jobs wait on their own surfaces. No disabled whole-app navigation. |
| Error / retry | Failed content uses its inline Retry; bar stays normal. If routing itself fails, keep the selected tab and show a specific notice with Retry opening that destination once, without changing tab selection early. |
| Scrolled top / down / up | Fixed capsule and centered + in every case, with bottom safe area. Do not hide, shrink, lift, or morph it on scroll. |
| Keyboard | Root bar hidden while Buy field is editing; on a pushed page it is already absent. + overlay and its sheet cover the root bar. Dismissal restores exact active tab. |
| Reduce Motion | Tab swaps remain instant; press opacity; new overlay and camera fade, no circle growth or choice stagger. All three tasks and close remain reachable. |

Bar copy: retain Today, Sell, Buy, You. `chrome.tsx:180` accessibility New becomes New item, distinguishing the action from a destination; no visible explanatory caption. The jobs retain the names in §6.4, not three different Sell labels in empty states. No badge text is spoken as color: announce the actual new-content meaning on its tab. Messages keeps its accessible unread count, distinct from tab dots.

### Planned features

Pages §6.4 and §7 make + the shared entry to capture/measure/identify/studio/appraise and the sell/find paths. The bar retains the four decided places; it does not become another content lane. Its shared Messages and refresh behavior is already covered by each tab's wiring table.

| ID | Planned capability and source | Disposition and exact home |
|---|---|---|
| N01 | Today, Sell, +, Buy, You order; tabs as places, no add buttons in inventories; bottom-bar decision | In redesign: one `RouterTabBar` with four routes and one action slot. |
| N02 | Instant switching, active icon pill/label, real dot badges, retained page state and current-tab scroll to top | In redesign: shared scaffold/bar contracts; navigation never sends a mutation or refreshes on re-tap. |
| N03 | Sell it, What's it worth, Find or buy it, with origin-aware open/close and camera transition | In redesign: existing takeover/choice components and three exact modes. No fourth import task. |
| N04 | Last-used option first | In redesign: reorder on actual chosen job; retain session value and define persistent storage if promised after restart. |
| N05 | Long-press + skips menu into last-used camera mode, visible tap alternative | In redesign: shared NewSlot long-press contract, accessibility action and one recognition haptic. |
| N06 | Cancel to source tab/offset, Back/deep-link fallback, keyboard and Reduce Motion, local draft escape | In redesign: + presentation/return table. Save draft/discard affects only this unposted task. |
| N07 | Each task also takes text/link, shared existing listings and camera-roll/folder photos | Elsewhere: pencil -> that task's input sheet; camera photo button -> existing import/group approval. Added task-entry contract: external share must select sell/worth/find explicitly when known, retaining original URL and evidence; no generic mode-changing import page. |
| N08 | Guided type-specific capture, all required facts, LiDAR/garment measurement, confirmation/correction, talk, skip/retake/finish, offline/local permission escape | Elsewhere: camera lane, entered with mode and return origin. No shot list, measure editor or model-progress dashboard on the tab bar. |
| N09 | Real photos first, optional Generate, non-generated tweaks/photo score, original preservation and studio Use/Redo/Use real | Elsewhere: camera/Item/Post preview; generated edits never auto-apply. Preserve the planned photo-tweak gap in pages §9 as work there, not an extra + choice. |
| N10 | Rough appraisal, recall, checked per-site net/value, one useful check, offline haggle, equivalents/history, Sell/Trade in/Donate/Keep/Bought/Deep | Elsewhere: Worth result, entered by + worth or buyer appraisal. Failed/too-few-sales result remains useful without an invented range. |
| N11 | Find by photo/text/link, identity/variant clarification, cross-market and official comparison, Watch/Offer/Buy and returned purchase | Elsewhere: Search results -> Listing/Want/Product; same buying capabilities as Buy path. No purchase action on the bar. |
| N12 | Signed-in setup, site selection/link/import, photo groups/duplicate merge, real job progression and website upload counterpart | Elsewhere: sign-in/onboarding when needed, then camera/import and Item. Groups/merges arrive in Today; web substitutes upload for phone-only capture. Bar never collects credentials or shows private traces. |

### Left to wire

| Redesigned part | Runs on today, with code evidence | Left to wire, proposed caller, unavailable real states |
|---|---|---|
| Four routes and + button | Actual local navigation: `app/src/app/(tabs)/_layout.tsx:8-12`, `app/src/ui/parts/chrome.tsx:199-209`; + really pushes `/new` at `:205`. No API is needed to switch places. | Shared UI/router owner supplies re-tap/scroll registration and origin capture. Current `:207` discards re-taps; NewSlot is only `onPress` at `chrome.tsx:177-183`, so long press currently does nothing beyond normal press. These are client gaps, not missing endpoints. |
| Badge and unread state | `TabBar` accepts optional badges at `chrome.tsx:111-116`, but `RouterTabBar` passes only current/onTab at `:202-208`. There are no root stream-backed badge bindings in that adapter. | Shared `app/src/today`/`app/src/buy` selectors provide badge meaning from specced today/wants/conversations reads and `/v1/stream`. New-in-§8 notification prefs/token/deep-link routing must resume exact objects. Need true unread, recovered counts, offline last-copy and no-duplicate-push handling. |
| New choices/order/close | Real local overlay and routing at `app/src/app/new.tsx:32`, `:43-50`, `:62-78`; choices/last mode are module memory in `app/src/demo/capture.ts:144-153`. | No endpoint for showing choices. Shared entry-state owner persists last mode only if desired and keeps tab/offset when opening. Native motion is client-side. Startup without prior mode and cancelled/interrupted transition need actual device verification, not another backend feed. |
| Circle origin and 56 geometry | `usePlus` estimates an origin from window size at `app/src/ui/parts/takeover.tsx:53-55`; drawn button is 48 at `chrome.tsx:190` while takeover constant is 56 at `takeover.tsx:42`. | Measure the existing button on layout/press, pass its real rectangle through entry state, resolve the 56/48 conflict once. No API. Orientation/safe-area/large-text and interrupted close cannot be claimed correct from the current geometric estimate. |
| Pencil text/link task | Demo product lookup at `new.tsx:35-38`; Sell uses fixed `DRAFT_ID`, Worth navigates to a product, Find changes route at `:52-55`. `app/src/demo/capture.ts:119` defines the demo draft ID. | Caller should be a shared capture-entry client used by + and `app/src/buy`, not code in `TabBar`. Specced `POST /v1/captures`, `POST /v1/valuations {url_ref}`, `POST /v1/search` plus item read/attribute correction; new-in-§8 capture purpose distinguishes job intent. Text/link-to-owned-draft initiation needs an explicit agreed payload if not covered by these contracts, not navigation to fixed `it_draft`. Need invalid URL, unknown identity, duplicate/partial import, actual empty and source failure states. |
| Camera/media/talk/jobs and outcomes | Camera imports `app/src/demo/capture.ts` steps/facts and `app/src/demo/capture-photos.ts` feed at `app/src/app/camera.tsx:26-30`; judged progression uses a timer at `:126-135`. This does not prove remote identify/measure/studio/valuation. Existing camera permission import is at `:24`; do not claim the whole camera is only a static image. | Capture client owns specced captures/photos/finish, item reads, correction/decision acts and job events/polling. Fact-found streaming, purpose and talk transport are new in §8. Need real upload/research/failed-site/retry/resume, permission-denied and durable local capture with later sync. Camera lane verifies Swift measurements and talk, not this bar spec. |
| Save draft/close, auth/import/deep links | Current `leave` just back/replaces at `new.tsx:43-45`; no save-draft confirmation in its render `:62-86`. The proposed root-return contract is therefore partly unwired. | Shared entry/capture owner stores unposted draft and origin locally; server resume uses the specced capture/item APIs. Sign-in/refresh/me/import-preview are new in §8; account import and merge Decision acts are specced. Need auth-cancel preserving input, resumed job, offline save, discard and deep-link-without-origin states. Do not lose a real draft because demo navigation had no persistent entity. |
| Press, haptics, keyboard, refresh and event delivery | `app/src/ui/press.tsx:65-67` animates and logs but dispatches no haptic; `app/src/ui/layout.tsx:19-39` has no refresh/ref/keyboard APIs. App log writes to a local memory sink at `app/src/ui/log.ts:8-11`, not a server collector. | Shared kit supplies native refresh/scroll/keyboard handoff and one haptic owner. Feature callers use existing authenticated endpoint logging; forwarding app input logs needs an explicit agreed ingestion transport, not an invented public endpoint or sensitive payloads. Pull refresh, keyboard-bar hide, native detents and persisted event delivery cannot be validated by URL state fixtures. |

No loading, error or empty network state is needed merely to draw the bar or its three fixed choices. Those states attach to auth, capture, imports, valuation and search after a task is chosen. Keeping the bar operational offline does not assert that remote jobs have succeeded.

## Shared work for reconciliation

| Shared concern | Required agreement with other lanes |
|---|---|
| Header and title | One resolution of the centered-wordmark versus 09:56 TabNav conflict, applied to all four at once. This proposal follows earlier brand source and uses Nav plus TabNav title. Pushed pages own Back; tabs never borrow it. |
| Scroll and refresh | One `Screen` active-scroll registration, native refresh support and offset retention. No scroll-reactive animations, native collapsing title clone or per-screen competing scroller. You alone omits pull refresh for its directory purpose. |
| Lists and space | `ListRow` is the common disclosure row, `List` draws same-kind separators, `Section`/`Shelf` use the same section gap. Fix Dynamic Type in those parts, not with shorter screen-specific labels. |
| Items | `Tile` and `Grid` establish Sell/Buy family. `PriceRead` preserves match uncertainty on Buy. Item/Listing lanes must accept the same photo and cached facts immediately, then fill missing detail without a white flash. |
| Decisions | Today remains the owner of open decisions. Buy and Sell reference the same IDs and state, never clone send/approve state. A completed act must disappear everywhere together, with one Undo policy and no duplicate dispatch. |
| Subject pages | You's detail lane must absorb charts, cash breakdown, standing details and settings controls, and supply missing Worth, Goals, Ask, Account, Style, Pickups and Pause routes before navigation ships. Existing `PAGES` is the implementable route gate, not proof that a named URL exists. |
| Sheets | One `Sheet` implementation with medium/large detents, content scroll handoff, keyboard avoidance, Close fallback and focus restoration. `QueueView` is full-screen review; do not give it a fake medium detent. |
| Navigation and haptics | Register missing native push motion centrally; use existing press, sheet, select, shelfFold, openItem, newOpen/newChoice/cameraOpen names. Centralize haptic dispatch so Press plus business logic cannot fire twice. Passive refresh and navigation stay silent. |
| New entry | Capture lane receives origin tab, source button rect and mode. No direct empty-state camera bypass. Text/link, camera roll, denied camera permission and offline capture remain reachable within the three existing jobs. |
| Empty and failures | `EmptyState` is a missing collection or cold failure; `Notice` plus Retry is warm/partial failure. A directory with empty data stays navigable. Unavailable totals never become fake zero. |

**NEW PATTERN, needs Ben's OK:** the feature audit found one required gap: marked spans inside Buy's editable search input, described in Buy's Planned features. The answer widgets already exist, but the input/anchor pattern does not. Native refresh, detented sheets, shared navigation handling and accessibility fixes remain missing behaviors of existing parts. A sticky collapsing header, custom tab minimization or new account dashboard is not assumed here.

## Checks for the later build

Specification checks performed here: read the requested standards and kit; audited feature contracts and ran the evidence command for all 20 relevant slugs; searched Ben's record for the one-purpose instruction; traced the actual four root files, router, dynamic You route gate and + entry; compared the dashboard counterexample against one-purpose navigation. No simulator, screenshot, runtime motion or independent visual review was performed. The supplied native skills are reference material for this written stage, not evidence that their full build loop ran.

The builder should turn these into observable checks rather than claim that the prose passes a device audit:

1. Launch Today by the normal signed-in entry. Open Messages, return with edge swipe, answer one real decision, see working then completion/Undo, undo it, and verify that Sell and Today still agree. Repeat offline and with one failed batch member. No stale outward confirmation is replayed silently.
2. Switch all four tabs and compare top origin, wordmark, title, Messages, gaps and bar at 390 by 844 in both themes. Scroll down and up, tap status bar and re-tap each current tab; verify anchor retention, no header animation and no refresh from re-tap. Include sheets and interrupted gestures.
3. Sell: no items, one item, typical set and the full dense collection. Filter by state/site, sort, fold, select, cancel, commit, retry and undo. Confirm no four-item truncation or missing end state, no open-order deletion, and accurate affected listing counts.
4. Buy: type, paste URL, dismiss keyboard, switch away/back, submit and edge-swipe back. Search draft survives. Camera opens find mode and returns here. Wants with zero matches remain visible; saved listing and scheduled Want are distinguishable; root never sends an offer or raises a budget.
5. You: first account, buyer-only account, one sale and dense seller all have the same subject directory. Every removed capability has a working route; missing `PAGES` keys never ship as Not found. Insights failure cannot hide Settings. Potential money is never reported as earned or paid out.
6. + from each tab: tap, cancel, long press, each job, pencil entry, keyboard up/down, camera denied, offline draft and direct link without origin. Selected tab never changes merely because + opened. Rapid taps do not duplicate overlays or commitments.
7. Repeat with Reduce Motion, largest Dynamic Type, long identity text, large amounts, missing photos and VoiceOver. No clipped navigation labels, hidden retry, overlapping targets or color-only state. Time and source labels remain truthful.
8. Run repo and copy checks when implementing. Observe and record motion on a device; scripted layout checks alone do not establish native feel. A fresh review should judge the rendered journey against these requirements without using this proposal as proof that it looks good.

Usable as a lane proposal for reconciliation. Not implemented or approved. Remaining dependencies are the shared kit behavior extensions, the header/56-circle precedence conflicts, and the named detail-route handoffs above.

## Lane summary

Coverage is counted by the stable IDs in the five Planned features tables. A row with several inseparable actions is one capability assignment; appearances of a shared backend feature on two pages are counted separately so a builder can check each entry path. This is not a claim that 87 unique product features were found, built or tested.

| Scope | Planned capability assignments found | Carried on root/contextual surface after audit | Moved to a named detail page |
|---|---:|---:|---:|
| Today, T01 to T18 | 18 | 16 | 2 |
| Sell, S01 to S14 | 14 | 5 | 9 |
| Buy, B01 to B16 | 16 | 10 | 6 |
| You, Y01 to Y27 | 27 | 6 | 21 |
| Bar and +, N01 to N12 | 12 | 6 | 6 |
| Total | 87 | 43 | 44 |

All 87 now have an explicit design home: 43 within these roots or their immediate contextual surfaces, 44 behind named routes. Buy assist's marked input is counted as specified coverage with a new-pattern approval dependency, not as an available primitive or working feature. Nothing is silently deleted to meet one purpose. Seasonal hot-item discovery remains excluded by the November 15 decision; the already specified per-listing standing indicator is not a new seasonal discovery feature. The detailed analytical route names, bulk-initiation contract and notice-dismissal persistence remain agent proposals.

Pages §8/§9 also contain work outside this lane. Capture fact/talk/measurement/studio and photo-tweak work goes through + and Item; seller intents and same-take-home go through Plan/defaults; full market search/appraisal and official alternatives go through Buy's destinations; website sign-in, uploads, cookie/CORS and site hosting belong to the website lane. No root redesign claims to have wired them. Both input paths must reach the same durable entities and job states. No Depop partner membership, seasonal forecaster or replacement page-monitor service is claimed by this design.

### Left to wire, whole lane

Most blocking first. Endpoint classifications and exact source lines are in each page's Left to wire table above.

1. **Authenticated app read path and shared entity/cache ownership.** Replace demo-world selection for the four roots with real typed clients in `app/src/today`, `app/src/sell`, `app/src/buy`, `app/src/you`. Bind session/refresh, owner isolation, offline cache and common money/photo/decision DTOs. Use specced reads and new-in-§8 auth/me fields. The route side currently uses a process-memory/file store (`app/src/edge/api/store.ts:7`) and example seeding (`app/src/edge/api/runtime.ts:32-62`); calling it does not by itself demonstrate a live marketplace or Databricks connection.
2. **Truthful decisions and outward execution.** Today act/queue/more/edits, signatures/versions/idempotency, stale/expired policy, full kind mapping, job stream with polling, and actual per-site completion. Wire event Undo and rule eligibility/demotion, without Undo for already-sent messages/accepted offers. Server-side read-back must determine completion; remove timer-based success from the user path. This enables a representative complete Today -> act -> job -> completed/failed -> undo or manual recovery journey.
3. **Shared kit behavior.** `Screen` native refresh, active-tab scroll-to-top, anchor/cache retention, keyboard handoff and accessible growing rows; `Sheet` detents/drag/Close and focus restore; `Press` one commit-haptic owner. Keep native navigation/Reduce Motion behavior. No endpoint supplies these missing client behaviors.
4. **Inventory and fulfillment integration.** Items, decisions per item, standing/scores, all cursors, Kind filter and real per-site job states; add the selection -> Manage listings route and agree bulk preview/start payload. Connect Item/Plan/Post preview/retry and Pack orders -> pick list/labels/print. Label API examples and local inventory mutations are not fulfilment proof.
5. **Live buying path.** Root Search starts the real search once and hands its job to results; match/want/order reads and per-source checks feed the shelves. Connect saves/purchases/confirmation and actual watch delivery. The Want `/v1/stage` demonstration is a separate path; it does not complete the normal Buy journey. Preserve visitor search with contextual sign-in for protected actions.
6. **Assist and recommendation gaps.** Obtain Ben's OK for marked editable spans; compose the existing answer widgets and wire real assist jobs, clarify/Other/Undo and input-state retention. Replace empty intel/writer placeholders. Agree a For you read contract, source reasons/exclusions/consent/profile updates, rather than pretend wants list already returns recommendations.
7. **Durable money, insights and citations.** Supply real order/receipt/valuation/stat read ports for insights, source/definition freshness and hidden reasons. Wire amount Why and real payouts, owned worth, potential money and sales filters. Replace synthetic aggregate snapshots; missing inputs cannot become zero. The directory stays usable while numbers fail.
8. **Destination coverage.** Add and register Worth, Goals, Ask, Account, Style, Pause, Pickups, packing, Manage listings and the analytical subject routes. Connect By site/Records/goals/Genie to actual data and exports. Test every row from its ordinary entry point and Back; a route mentioned in a spec is not a registered component.
9. **Account controls and background return.** Real link/relink/import/merge, per-site modes, same-take-home defaults, pause with open orders retained, notification permission/token/deep links, export/delete/auth-link/signout and style/experiment consent. Remove demo-only Preparing/Deleting/signed-out outcomes and retry-by-clearing-URL. Keep newer pickup and draft-reply policy in every destination.
10. **+ lifecycle and capture handoff.** Wire long press and accessibility shortcut, actual measured origin, consistent circle size, draft persistence/save/discard and captured mode/return context. Text/link starts actual durable work instead of fixed demo IDs; photo upload/camera/talk/valuation/find jobs belong to the capture and results lanes, with honest partial/failure/offline states.
11. **Notices, refresh boundaries and input-log transport.** Produce actual Today notices, persist dismissal and deep-research arrivals, set last-open once per visit, invalidate shared objects/counts on stream recovery, and agree app-event ingestion without sensitive content. No invented notice/log endpoint is treated as settled.
12. **Demonstrate each wired state through normal use.** Run the existing lane checks plus real cold/warm error, empty, partial, append, refresh, offline/reconnect and duplicate/stale-act paths; exercise keyboard, scroll/Back/tab re-tap, native sheets and Reduce Motion on device. Fixture screenshots remain useful for layout, but cannot prove API integration or outward effects. No live API/device test was performed for this written audit.
