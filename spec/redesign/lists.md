agent proposal, written by Codex 2026-11-15 at Ben's ask (10:27, 10:30)

# Lists, conversations, and the pages behind You

Design specification only. Feature and wiring audit added at Ben's 10:31 request: "ensuring each checks against what is planned feature wise for each and also noting down what is left to be wired up and such". Source snapshot: `1107a97a`, read on 2026-11-15. File:line references below describe that snapshot, not the concurrent screen rewrite. Only this file was written. The proposals do not change settled product decisions or approve new patterns.

The person is clearing their own things and sometimes buying used. They come here to find a conversation, compare results, understand their sales, or change one preference. Wrong recipients, unintended public actions, lost edits, and misleading money matter more than decorative polish. Success means they enter from a main tab, recognize the subject, complete its next action, and return to the same place without learning a different layout on each page.

Common answer: put every metric and preference under a long profile dashboard and use cards for each group. Reject it. It makes different jobs compete and makes ordinary rows look like decisions. Keep the familiar iOS list and Settings grouping, adapted to the existing kit. A list selects an object; a settings page changes one family of preferences. Neither is a second Today feed.

The strongest rival is leaving By site, worth, and goals together because they fit within three screens. `spec/pages.md` §1 gives several independent reasons to split. Ben's one-purpose instruction and these subjects' different actions decide the split even when their total height is short. Countercheck: moving every small fact to a page would cause needless navigation. Keep facts about one subject as blocks, and one-choice edits as sheets.

## Authority and conflicts

Read in Ben's requested order: UI constitution and frontend standard; brand constitution and coder card; primitives and pages; copy and clean-copy; Appllama and its native-controls/motion references; Emil apple-design, mobile-native, gestures; ui-screen; then the lane and kit code. These are source-based proposals, not a claim of simulator or hardware verification. Reference patterns below are transfers from those supplied sources, not a fresh survey of shipping apps.

| Disagreement | This proposal follows |
|---|---|
| Appllama asks for SF Symbols, system faces, semantic platform colors, and row highlights without scale. | Earlier brand and frontend documents: Hugeicons, brand faces/tokens, existing `Press` spring. Keep ListRow's highlight too. Do not substitute a second icon, color, or press system. |
| Appllama motion examples suggest scroll-linked title collapse, row entrance stagger, and hero stretch. | Earlier frontend frequency rule: no custom animation for scrolling or typing. Existing Screen has an ordinary scrolling title. No invented collapse or direction-sensitive header. |
| Emil gestures includes a 500 ms Vaul example and web mechanisms. | Earlier frontend cap and native Expo context: `MOTIONS.sheet` 300 ms, `MOTIONS.select` 200 ms; no Vaul or browser gesture implementation. Mobile-native explicitly excludes React Native implementation. |
| Broad brand hero test expects a photo or money first, including on settings. | Earlier UI constitution: the page's job controls attention. A settings title or the preference being changed is its focal point. Do not add money or an item photo to satisfy a hero rule. |
| Brand spacing prose generally separates with space; kit List draws hairlines. | Use space between subjects and List hairlines only between repeated rows, as the earlier frontend fixed-parts rule directs. No surrounding boxes. |
| BySite's comment at `app/src/you/by-site.tsx:1-3` says three short subjects can share a page. | Ben's supplied 10:27 instruction. Worth and Goals get separate pushed pages. |
| Pages §6.16 still says Pickups contains windows; current defaults omit windows. | Preserve the earlier UI requirement for agency and the later explicit pickup decision documented in `spec/edge-cases.md` §16: availability is selected for a particular buyer. No standing weekly windows. Flag this stale §6.16 wording for reconciliation, not silent restoration of fixed hours. |

Product primitives are objects, not visual parts. Conversation drives Messages/Thread; Listing and Valuation drive Search; Ledger facts drive analytics; Rule drives Automation; account configuration drives linking; Appointment drives individual pickups. A value block is not automatically a Card. Only a Decision earns decision actions or a field.

## Page boundary and route map

All pages in this lane are pushed Pages, never new Tabs. A one-choice form or confirmation inside them is a Sheet. Today, Sell, +, Buy, You stays unchanged. The You tab is another lane's index: it supplies simple disclosure rows into these subjects, not their full controls.

Paths marked proposed are not implemented in the current route map (`app/src/app/you/[page].tsx:19-28`). Keep existing deep links as aliases to the same subject when building; do not make duplicate destinations. The builder must wire missing destinations before exposing their rows.

| Page | Kind | Route and present implementation |
|---|---|---|
| Messages | Conversation list | `/messages`, `app/src/app/messages/index.tsx` |
| Thread | One Conversation | `/messages/:id`, `app/src/app/messages/[id].tsx` |
| Search | Listing results | `/search`, `app/src/app/search.tsx` |
| By site | Analytics | `/you/insights`, `app/src/you/by-site.tsx` |
| What your things are worth | Analytics | proposed `/you/worth`; currently embedded in BySite |
| Goals | Personal tracking | proposed `/you/goals`; currently embedded in BySite; optional, never a preset goal |
| Accounts | Linking | `/you/connections`, `app/src/you/sites.tsx`; page title becomes Accounts |
| Automation | Settings for delegated actions | `/you/rules`, `app/src/you/rules.tsx`; permission defaults belong to this family |
| Pickups | Pickup preferences | proposed `/you/pickups`; saved spot currently in Defaults |
| Notifications | Notification settings | `/you/notifications`, `app/src/you/notifications.tsx` |
| Your style | Personalization settings | proposed `/you/style`; no current page |
| Records and tax | Sales records | `/you/records`, `app/src/you/records.tsx` |
| Account | Identity and data settings | `/you/settings` alias to proposed `/you/account`, current Settings mixes other subjects |
| Ask | Question over sales data | proposed `/you/ask`; no current page |
| One site's connection | Connection inspection and repair | `/you/connections/:site`, wrapper exports `app/src/you/site.tsx` |

`app/src/app/you/[page].tsx:19` and `app/src/you/state.ts:60-73` enumerate the actual pages. Worth, Goals, Pickups, Your style, Ask, and `/you/messages` are absent; these currently reach Not found at route lines 24-28. Account singular and Accounts plural must never resolve to the same subject. Existing Payouts, Activity, Defaults, and Permissions remain reachable; this lane does not delete their capabilities. Entry placement and any extra pages are handed to the reconciler below.

## The two scaffolds and exact kit vocabulary

These scaffolds are compositions, not new visual components. Every capitalized short name used later resolves through this table. Layout helpers and text/photo are the existing kit exceptions to the requested `parts/` directory: do not recreate them inside a page.

| Short name | File and exported component | Job |
|---|---|---|
| Screen, Section, Stack, List, Row, Line | `app/src/ui/layout.tsx`: `Screen`, `Section`, `Stack`, `List`, `Row`, `Line` | One vertical scroll, topic spacing, row alignment, wrapping peer controls |
| Txt, Photo, Icon, Press | `app/src/ui/text.tsx`: `Txt`; `app/src/ui/photo.tsx`: `Photo`; `app/src/ui/icon.tsx`: `Icon`; `app/src/ui/press.tsx`: `Press` | Brand type, real item image, one icon family, common press feedback |
| Nav, Wash | `app/src/ui/parts/chrome.tsx`: `Nav`, `Wash` | Pushed Back and one optional utility; shared top wash from Screen |
| ListRow | `app/src/ui/parts/list-row.tsx`: `ListRow` | Settings, facts, and disclosure rows, with `value`, `detail`, `trail`, `site` slots |
| ThreadRow, Message, Meta, Draft, Composer | `app/src/ui/parts/thread.tsx`: those five exports | Conversation preview, message, attribution, exact proposed reply, own text |
| ItemCard, DecisionCard, Notice | `app/src/ui/parts/cards.tsx`: those three exports | Item selection, a real decision, one actionable notice |
| MatchCard | `app/src/ui/parts/match.tsx`: `MatchCard` | Listing photo, delivered money, match and price read |
| SearchField | `app/src/ui/parts/search-field.tsx`: `SearchField` | Text, link, camera search |
| SiteStrip | `app/src/ui/parts/site-strip.tsx`: `SiteStrip` | Per-site search progress and counts |
| SiteBadge | `app/src/ui/parts/small.tsx`: `SiteBadge` | Real site logo; site names in accessibility labels |
| Pill, IconButton, FootButton | `app/src/ui/parts/buttons.tsx`: those three exports | Secondary or primary action, icon utility, one bottom act |
| EmptyState, Sheet, Skeleton, UndoToast | `app/src/ui/parts/overlays.tsx`: those four exports | Honest absence/recovery; content-height task; exact supported placeholder; reversible act |
| RouteSheet | `app/src/ui/parts/route-sheet.tsx`: `RouteSheet` | Longer route-backed sheet, scroll body, pinned act, drag handle |
| Guess, Blank, Approve | `app/src/ui/parts/loop.tsx`: those three exports | Editable inferred value, empty field, explicit action with working/failure/undo states |
| Choices | `app/src/ui/parts/pick.tsx`: `Choices` | Labeled single selection, including notification mode and automation mode |
| Choice | `app/src/ui/parts/chip.tsx`: `Choice` | Checkable choice or disclosure within a sheet |
| Switch | `app/src/ui/parts/switch.tsx`: `Switch` | Binary preference, in a nonpressable ListRow's trail |
| GoalBar | `app/src/ui/parts/goal-bar.tsx`: `GoalBar` | Money goal only; formats currency, so never reuse for counts |
| WhySheet | `app/src/ui/parts/why.tsx`: `WhySheet` | Reason first, underlying records behind See the numbers |
| SiteLink, SiteCopy | `app/src/ui/parts/site-link.tsx`: `SiteLink`, `SiteCopy` | External site opening and timestamped actual site capture |

### List page scaffold (L)

Top to bottom: Screen with Nav(back, optional one utility), a Txt heading naming the subject, a conditional Meta for offline/freshness or an actionable failure, then Section containing List of the appropriate repeated primitive. A subject summary is a block before the list only when needed to compare or act. Foot is absent unless the page has an actual single task such as export. An ordinary list does not get a black button merely to have a focal point.

Reasons: Back preserves the path in; title identifies the query; conditional status distinguishes an old answer from a current one; rows support recognition and selection; spacing shows where a subject ends. No greeting, running totals of unrelated work, duplicate section title, explanatory subtitle, decorative icon, or box around List. ThreadRow is for conversations, MatchCard for outside listings, ItemCard for owned items. Do not force these into ListRow and lose photos.

### Settings page scaffold (S)

Top to bottom: Screen with Nav(back), Txt heading, conditional status, Section for each group within this one preference family, List of ListRow. A simple row has label and current value. A disclosure row has `onPress` and the existing chevron. A toggle row has no row `onPress`, with Switch in `trail`, so there are not two competing targets. A fact has neither control nor chevron. Details survive only for a consequence or a value that cannot be understood alone. Destructive actions sit in the final separate group and are never the primary foot action.

Reasons: label identifies what changes; current value prevents opening a sheet just to inspect; chevron promises more detail; a binary switch does one immediate reversible thing; group spacing separates meaningful kinds within the same subject. Use `GAP.section` 32 between topics, `Section`'s 16 between blocks, Stack tight 8 for one object's related facts, List hairlines for peers, the Screen's 20 gutter. Do not make unrelated settings fit by adding more Section headers.

### Shared state and navigation contract, inherited by every page below

Each page's state table supplies its data differences. This contract supplies every scroll, navigation, keyboard, accessibility, and feedback state, including where a state is inapplicable.

| State | Required behavior |
|---|---|
| First load | Draw Nav, heading, and any known query/identity immediately. Cached content stays. Delay a loading indicator 150 ms and hold it at least 300 ms once shown, per frontend §3. Use a Meta with a named loading operation for rows, not fake rows or zeros. Skeleton supports only card-decision, card-item, notice; do not pass a made-up row type or use a 56-high notice as a 76/96-high row skeleton. |
| Loaded | Stable keys, actual facts, no automatic entry stagger. One item uses the identical row as many. Dense content continues vertically with no arbitrary cap. Preserve filter/query, position, and edits on return. |
| Partial | Keep available sections and local edits. Put the missing source's status or Retry at its own position. A failed source is not zero and not an empty result. |
| Loading more | Keep existing rows and anchor. Meta says what is loading; a secondary Pill Retry at the end handles a failed next page without replacing existing results. No scrolling animation or resetting to top on arrival. If the query is bounded, say no pagination rather than inventing more. |
| Refreshing | Only pages explicitly marked refreshable below request a new read. Keep content and position; no full-page skeleton, no success toast. Native UIRefreshControl is the intended gesture, but is a shared capability gap described below. Current-kit fallback is the same labeled secondary Refresh action in a Sheet, never a second inline toolbar on every screen. |
| Offline | Show cached content and one Meta, “Offline”; timestamp old evidence where its age matters. Keep local drafts. Do not imply a send, unlink, rule promotion, or deletion completed. A pending setting shows “Waiting for signal” beside that setting. Actions requiring a fresh price, eligibility, or confirmation must revalidate on reconnect and ask again if meaning changed. |
| Error and retry | With no usable content use EmptyState naming what failed plus Retry. With cached content retain it and show a local error plus Retry. Retry repeats that read/write with the same identity and values; it never navigates to a duplicate route or wipes unsaved text. Distinguish missing/deleted subjects from transient failures. |
| At top | Ordinary native UIScrollView resting at its top. Nav, wash, and the one title appear in their normal slots. No large-title collapse exists in the kit. Pushed pages have no bottom tab bar because they sit over the tab navigator. |
| Scrolling down | Native UIScrollView deceleration and rubber-banding only. Current Screen puts Nav, wash, and title in the scroll: all move out with content. Foot, if specified, stays fixed. No shrinking, fading, parallax, hide-on-down control, or floating action. |
| Scrolling up | Content returns under the finger. Nav/title re-enter only when their original positions return. No direction-triggered header. Back remains available by native interactive edge swipe while Nav is offscreen. Fixed Back is a shared proposal below, not a hidden capability of Screen. |
| Re-tapping current tab | No current-tab control exists on these pushed pages. Back returns to the calling tab with its position. For the main-tab lane, request the shared convention: first re-tap at a root scrolls to top, another at top does nothing, never refreshes or launches +. `RouterTabBar` currently ignores re-taps. If a reconciled shell keeps the tab bar visible on pushed pages, define re-tap as pop to that tab's root, then a later root re-tap scrolls to top; never discard an unsent form. |
| Keyboard | Only focus an actual field after an intentional tap. Native text editing, selection, keyboard timing, Return key semantics. No custom typing animation or haptic. Focused field and its act must remain visible above keyboard; drag can dismiss keyboard interactively without losing text. All exits preserve a draft or offer Discard/Keep editing for unsaved forms. Keyboard avoidance is a shared gap, not present in Screen. Pages with no fields do not raise a keyboard. |
| Reduce Motion | Press uses opacity dip; no scale. Native push honors the system preference, instant per earlier standard where overridden. Sheet uses fade instead of slide; select/field changes appear in place. No gradient drift here. Do not remove state words, focus feedback, or completion/error cues. |

No custom swipe actions or long-press-only capabilities are introduced. Any added gesture must retain its visible action. At largest Dynamic Type, allow readable labels and essential consequences to wrap without overlapping value/trail. Existing fixed ListRow and ThreadRow heights do not guarantee this; see shared gaps. Short previews may ellipsize, full messages and warnings may not. VoiceOver reads identity, site, state, current value, and result; a pending write does not announce success.

### Interaction defaults D

Unless a page states a difference, every control below uses these defaults. No unspecified haptic is implied by a component name: current Press and Switch do not emit one.

| Control | Destination/presentation and return | Feedback, motion, haptic |
|---|---|---|
| Disclosure, ThreadRow, MatchCard | Push the named object route; Back and native leading-edge interactive swipe pop to the exact caller/filter/offset. A cold link falls back to the parent specified per page. | Press-in feedback via `MOTIONS.press`, a spring with feedback token 150 ms inward and panel token 300 ms return in current Press. ListRow also fills gray while pressed. Push is native stack motion, target 300 ms; motion.ts has no separate push entry, so do not mislabel it openItem. No navigation haptic. |
| Owned-item card | Push `/item/:id`; keep thumbnail and known values available on first frame; pop returns to the same item row. | `MOTIONS.openItem`, spring, only where shared continuity is implemented; otherwise native push. No invented fixed spring duration. No haptic. |
| Back | Pop one level; sheet Back closes that sheet before the parent. Cold-entry fallbacks specified below. | Existing Press feedback. Native interactive pop follows the finger and may cancel. No extra animation or haptic. |
| One-choice row | Content-height Sheet in place over caller; no detents supported by current Sheet. Selection saves and closes; explicit Cancel closes without saving. Back/close/scrim returns to caller. | `MOTIONS.sheet` 300 ms entry; `MOTIONS.select` 200 ms exit/selection. One light haptic when a changed value commits locally; no haptic on opening/cancel/same selection. |
| Toggle | In place, optimistic only for reversible preferences. Keep previous value for rollback and show local Retry on rejected save. | Press feedback plus `MOTIONS.select` 200 ms knob movement. One light haptic on changed committed value; never again on network acknowledgment. Disabled toggles show reason and fire nothing. |
| Form save, Send, explicit approval | Form stays until input validates. Show working state at the acted-on object, revalidate stale subject/version, then update there. Use Approve for consequences requiring a final confirmation. | Press; `MOTIONS.fieldsFill` 150 ms for arriving content, `MOTIONS.select` 200 ms for changed state. Light haptic on explicit valid commit, warning haptic once on actual failure. Never a second success haptic for the response. No success sound. |
| Retry/Refresh | Repeat the affected operation in place; Back still leaves. | Press only. No haptic just for starting a read. Failure feedback once per new failed attempt, not on every render. |
| Undo | Reverse the named reversible change in place. UndoToast lasts the kit's 5 s; error stays if reversal failed. Never claim a marketplace send can be unsent. | Select 200 ms, one light haptic when reversal commits. |
| External site, source, share/export | Existing SiteLink or labeled Pill opens the actual URL/site; iOS returns to the app by its system path. Native share sheet cancel returns here with no completion claim. | Press only; OS owns presentation timing. No custom duration or haptic. |

Sheet facts: current Sheet has no drag handle, native detents, scrolling, explicit Close, or keyboard management. For every use below include a secondary Pill “Cancel” or “Done” in its content as well as scrim dismissal. Current RouteSheet has scrolling, one foot, and handle drag, but no medium/large detents. Do not describe either as a native detented sheet. Short menus use Sheet; content that can grow uses RouteSheet with one content-derived height bounded by the existing safe-area maximum. Proposed native medium/large detents require shared work and Ben's OK. Form dismissal preserves entered values until saved or explicitly discarded; a dirty form's close presents Keep editing / Discard changes with existing Sheet and secondary Pills.

## Feature and wiring audit conventions

The following per-page Planned features and Left to wire sections amend the redesign above them. “Added” means missing from the earlier draft and now part of the specified stack or its named disclosure. “In redesign” means already present. “Elsewhere” gives the actual destination preserving the capability. IDs count page-level capability obligations once in the lane summary; several obligations may share one endpoint. These counts describe design coverage, never implemented features.

Sources read: pages §6.3, §6.13, §6.16 and §§7-9; `product/decisions.md`; both `features/<slug>/README.md` and `spec/features/<slug>.md` for messages, sold, connect, insights, data, buy, market, score, assist, watch, item-card, price, appraise, list, capture, identify, measure, studio, replay and today. `node scripts/evidence.mjs <slug>` was run for the relevant feature families; stale README “Nothing specific” lines are not proof of no decisions. Pages §6.3 names trust and negotiation, but neither slug has those two feature files in this checkout. Their obligations are traced through messages/sold/price and the canon, rather than fabricated feature documents. No outside service documentation or tax-law claim is newly verified here.

Contract status: **S** = specced feed in pages §6 or canon §7; **P8→S** = described as new in pages §8 but now included in canon §7; **N** = additional contract/field required, explicitly an agent proposal. Endpoint existence is separate from a screen calling it and from its production data source. The page tables give the intended calling module; an absent module is marked proposed, never described as an existing client.

Observed common runtime: You reads a fixture through `app/src/you/state.ts:17-19`, `app/src/demo/screen.ts:21-25`, and `app/src/demo/index.ts:7-19`; fixture worlds are `app/src/demo/worlds/{clearing,flipper,buyer,new}.ts`. State changes in `app/src/you/state.ts:34-36` only log. Loading/error/offline previews come from URL state, not network outcomes (`app/src/you/page-status.tsx:10-25`). All “states left” below mean real request-driven states and persistence, even when a screenshot of that state can already be forced.

Observed backend limits: insights uses a synthetic contract snapshot (`app/src/edge/api/insights.ts:9-15`), goals and records use example handlers (`app/src/edge/api/insights.ts:28`, `app/src/edge/api/records.ts:6`), Genie defaults to a stored question/answer (`app/src/edge/api/genie.ts:15-41`), and the runtime seeds example account/item/rule rows (`app/src/edge/api/runtime.ts:32-56`). There are genuine engine entry points, but those facts do not make these UI pages API-driven. The endpoint manifest distinguishes examples from engines (`app/src/edge/api/routes.ts:33-36`); its explicit example gaps are at `app/src/edge/api/routes.ts:39-59`.


Audit exclusions and precedence: hot-items/seasonal forecasting is superseded by `product/decisions.md:8-9`, so it is not counted as a capability to restore from stale score/price prose. Ordinary listing standing and a source-backed market comparison remain; no seasonal opportunity recommendation is introduced. The old fixed pickup windows, automatic pickup approval and pre-drafts automatic reply defaults are likewise superseded by the newer explicit decisions at `product/decisions.md:14-18`. Style, PDF, auth, notification writes and import preview are P8→S despite stale pages notes; data's proposed `/v1/ask` does not displace `/v1/genie`. Expanded analytics methods remain agent proposals, with missing determination cards identified in `spec/features/insights.md` §Needs from the shared model. Counts retain their planned destinations without presenting these proposals as settled formulas.

Shared presentation parts have no data endpoint. Nav/Back/Sheet open/close are local UI; Screen has a ScrollView, with no refresh or list-pagination interface (`app/src/ui/layout.tsx:21-57`), Press logs and invokes the passed callback (`app/src/ui/press.tsx:65-67`). New disclosure routes and shared keyboard/refresh/virtualization patterns remain implementation work. Per-page tables account for the data and control parts, and inherit these common presentation dependencies.

## 1. Messages

Purpose: find the conversation that needs an answer, then open that thread. L scaffold. Person: clearing seller, several visits a day; they would say “Show my messages,” and want to know who is waiting without opening five sites. Highest-cost mistake: approving text for the wrong item. Familiar reference: iMessage conversation selection; keep previews and time, add item photo and site identity.

### Today and what it is not

| Current top-to-bottom, `app/src/app/messages/index.tsx` | Assessment and destination |
|---|---|
| Nav/filter at 60-61; title, item filter name, offline line at 62-66 | Keep. Selected filter needs a way to clear it. |
| Replies-to-send section, photo, buyer message, Draft, sent counter, Send all at 72-97 | This is a reply-approval task before the inbox. It can push the list out of view and mixes reading/selection with editing, contrary to one job and first-action hierarchy. Proposal: replace with one Notice “Replies to send” carrying the actual count and chevron into a separate pushed approval Page. Its full exact-text approval workflow is preserved, not cut. See shared handoff. |
| List of ThreadRow at 99-108 | Keep newest-message order and waiting tag. Do not reorder rows on incidental render. |
| Empty explanation at 109-111 | Repeats what an inbox is, clean-copy rung 1. Keep cause and one action only. |
| Permanent answering Notice at 112 | Settings/logging subject, not a conversation. Move to Automation > Replies, behind one chevron row in the replies approval page's More sheet. It currently opens absent `/you/messages`. |
| Filter Sheet at 114-127 | Keep item photo selection. Cancel/Done must be explicit. Filtering to no rows needs its own empty/reset state; current code checks all rather than shown at 109. |

### Redesign, top to bottom and reasons

1. Nav with Back and filter utility: return to caller or select one item's conversations.
2. Txt “Messages”; a secondary selected-item line only when filtered: identifies the current query.
3. Conditional Meta offline or source failure: prevents mistaking an old inbox for new silence.
4. Notice for pending reply approvals, only when unfiltered and nonzero: preserves fast batch review as one doorway. This is the one thing that stands out when replies wait. Otherwise the first unread ThreadRow is the focal content, without a field or black button.
5. Section > List > ThreadRow for every conversation: photo, site, buyer, latest text, time, unread/need. Read/blocked rows stay visible; blocked is a word, not just color.
6. EmptyState only instead of the list. No bottom bar, footer statistics, or floating compose button: this inbox aggregates existing marketplace conversations.

### States and controls

| State | Messages difference from shared contract |
|---|---|
| First load | Preserve heading/filter and any cached rows. Meta “Loading messages” when delayed; no card skeleton standing in for ThreadRow. |
| Loaded | One/typical/dense use ThreadRow; newest first. Unread count changes in place, not counter animation. |
| Empty | No connections: “No messages” + “Link a site” pushes Accounts. Linked but none: “No messages” + “Open Sell” returns to Sell. Empty selected filter: “No messages for this item” + “Show all messages” clears filter in place. |
| Partial | Rows from responding sites remain; a local status names the unavailable site by logo/accessibility and Retry. No “no messages” for that site. |
| Loading more | Fetch older conversations at bottom if cursor exists. Preserve last visible row; footer Retry on failure. |
| Refresh | Yes, inbox is time-sensitive. Re-read without clearing filters or drafts. Current-kit Refresh lives in filter Sheet; add it even if only one item exists. |
| Offline/error | Cached threads open read-only evidence and locally writable drafts; no send from inbox. No-cache failure has Retry, not a route replace. |
| Scroll, re-tap, keyboard, Reduce Motion | Shared contract in full. No inbox fields, so no keyboard. Sheet filtering has no text field. |

Filter opens Sheet with Choice “Every item” then Choice rows composed with existing Row/Photo where item recognition is needed; a check identifies current choice. Selecting closes and filters in place, no haptic for unchanged selection. ThreadRow pushes `/messages/:id`. Approval Notice pushes proposed `/messages/replies`, cold Back `/messages`; new route uses existing Message, Draft, Row/Photo, and secondary Send all for eligible confirmed-fact replies. Opening a pending thread marks it read only after content is visible. Back's cold fallback is the originating main tab if known, otherwise Today `/`. D applies to all controls. No sending on row swipe.

Copy: index 69 “Try again” -> “Retry”; 73 count remains at the doorway, remove “Replies sent” section and 92 sent-count summary once list updates (rung 2); 104 “Drafted and sent by you” -> “You sent” in preview only, retain full authorship in thread; 110 explanatory sentences cut (rung 1); 112 “Draft for me is on” cut from inbox (rung 1); filter heading 114 “Show messages about” -> “Filter messages”.

### Planned features

Sources: pages §6.3/§7; messages §What the person does; item-card and data; decisions on the all-site inbox and drafts-first replies.

| ID | Planned capability | Coverage after this audit |
|---|---|---|
| M01 | One newest-first inbox across connected sites, with item photo, site, buyer, last words and unread state | In redesign: L > ThreadRow list and read-on-visible behavior. |
| M02 | Filter conversations by item and open the exact thread | In redesign: filter Sheet and ThreadRow push. |
| M03 | Exact reply queue with buyer words, facts/sources, Send/Edit/Take over and confirmed-fact Send all | In redesign: Replies to send doorway > proposed `/messages/replies`; pending boundary remains explicit. |
| M04 | Show automatic-send authorship and make its evidence reachable | In redesign: ThreadRow did value > Thread's Why/Site copy. |
| M05 | Buyer messages needing a person also appear as Today decisions with deadline/deep link | Elsewhere: Today cards; this inbox opens the same conversation ID, not a duplicate decision store. |
| M06 | Site events/watchers/sweep keep the inbox current; broken connection can be repaired | Added: unavailable-site status opens Accounts at that site via Choice “Repair connection”; Refresh stays an explicit read, not a resend. |
| M07 | Buy-role threads, waiting/closed/blocked and held safety/claim statuses | Added: the inbox query includes both buy and sell roles; ThreadRow labels counterpart correctly and its waiting state opens that role's same Thread. No seller-only filter is silently applied. |

### Left to wire

| Redesigned part | Runs on today, observed code | Required feed, caller and unobservable live states |
|---|---|---|
| Conversation list, unread and filters | Demo `inbox(w)` and fixture World in `app/src/app/messages/index.tsx:26-34`; client filter at `:46-47`. Fixture inbox derivation: `app/src/demo/inbox.ts:65-69`; fixed draft templates at `app/src/demo/inbox.ts:17-25`. | **S** GET /v1/conversations, item joins from GET /v1/items; caller `app/src/app/messages/index.tsx` with a proposed `app/src/messages` reader. Wire cursor/refresh, actual unread/empty/partial/error/offline and mark-read. No mark-read route is in the read/send contract; **N** proposed PATCH /v1/conversations/:id `{last_read_at, version}`. |
| Replies doorway, review and Send all | Queue and edits are local at `index.tsx:34-44`; `send` only uses a timer and setDone at `:52-54`; Draft/Send all callbacks at `:86-95`. | **S** GET /v1/decisions?state=open, thread GET, POST /v1/decisions/:id/act and POST /v1/conversations/:id/messages; proposed reply reader calls existing messages API. Read exact held drafts and evidence, send idempotently per reply. No batch-send endpoint required. True sending/partial batch failure/claim hold/readback are unwired. |
| Authorship/evidence and connection repair | Authorship comes from demo actor fields at `index.tsx:102-105`; answering Notice pushes absent /you/messages at `:112`, while `app/src/app/you/[page].tsx:19-28` rejects it. | **S** GET /v1/events, GET /v1/citations/:id, GET /v1/accounts and message.new stream; repair returns to same filter. Real disconnected/source-unknown states are unwired. Implement the alias and reply settings destination before exposing that link. |
| Retry, refresh, density | Retry replaces the URL at `index.tsx:68-69`; loading/dense are skipped at `:16-17`. | **S** repeat the read, GET /v1/stream or job polling where applicable; same caller. Retry currently does no request. Implement real loading/next-page failure/reconnect and the shared list shell, rather than treating demo state changes as retries. |

## 2. Thread

Purpose: resolve this conversation with this person about this listing, then send or approve the next response. L scaffold with Composer foot. Person: seller who opened a waiting buyer, repeatedly; highest-cost mistake is sending a false fact, price, address, or agreement. Familiar reference: iMessage chronology, eBay offer actions. Keep transcript continuity and exact text before Send.

### Today and what it is not

All references here are `app/src/app/messages/[id].tsx`.

| Current order | Assessment and destination |
|---|---|
| Nav/More and buyer title 148-154 | Keep buyer identity visible at entry; generic More must have a complete menu. |
| Large ItemCard 155-159, SiteLink and screenshot pill 160-165 | Item identity belongs. Two permanent site utilities compete with answering; move utilities into More. Keep the photo. |
| Possible-scam block and Block button 167-175 | Relevant protection, not clutter. Block is destructive and must not be the black recommended action. Keep reason and give Take over, plus secondary Block in More/confirmation. |
| Message stack and embedded offer decisions 177-207 | Keep history, attribution, actual offers and their action sets. Do not render the same unresolved offer twice because it appears in multiple message snapshots. |
| Pickup Notice 209-211 | Relevant doorway to an Appointment; keep only when active. Full scheduling stays in `/item/:id/pickup`. |
| Draft at 213-216, Composer foot at 140-145 | Both modes serve answering. Draft must never remove the ability to write a personal answer; Take over switches to Composer preserving draft. |
| More 218-224, SiteCopy 228-229, why 231-247, counter 249-257, offer More 259-269, Undo 271 | Keep subject-local operations, shorten menus, make exits explicit. Global reply policy belongs in Automation. A setting-only toast at 241-243 is not evidence that policy persisted. |
| “You answer here. Offers still follow your Plan” 142 | Standing explanation, rung 2. Show current takeover mode in More; keep the distinction in the specific mode picker rather than every composer. |

### Redesign and reasons

1. Nav Back/More, buyer Txt plus site identity: establishes who receives the next act.
2. Compact Row with Photo, short item title, and a Choice disclosure to `/item/:id`: recognition and access to facts, without a large card consuming the transcript. Use existing Row/Photo/Choice composition, not ListRow with an unsupported photo prop.
3. Conditional safety/handoff Meta with one plain reason, Take over secondary Pill: makes the reason for human control visible. Never cover it with an invented generic warning.
4. Stack of Message in chronological order; timestamps at actual pauses; authorship on outgoing automatic/drafted messages. Offer DecisionCard immediately follows the offer message; pickup Notice is at the related commitment. These are decisions about this conversation, not analytics.
5. Latest Draft, including facts and sources, directly before the composer position. With draft ready, its Send is the one thing that stands out. A locked or urgent offer can take the first decision's emphasis instead; do not give composer, draft, and offer all black acts together. Secondary reply controls remain reachable.
6. Composer in Screen foot when writing personally. Draft editing uses Draft's input. More includes Reply myself / Resume drafts, Open item, Open on site, Site copy, reply settings, Block or Unblock where supported. Pending/photo request offers a secondary “Take photo” action near the relevant message; see gap below.

### States

| State | Thread difference |
|---|---|
| First load | Known buyer/item stay. Meta “Loading conversation”; no unrelated card-item skeleton for a transcript. Do not claim empty while history loads. |
| Loaded | Enter at newest unread context, otherwise latest message. One-message thread uses same transcript. Dense history remains accessible without a demo-size exemption. |
| Empty | A valid thread with history unavailable shows “No messages loaded” + Retry. Invalid/deleted thread says “Conversation unavailable” + Back to messages, never an empty composer inviting a send to nowhere. New personal text is allowed only with valid conversation identity. |
| Partial | Keep history and photos available; failed evidence shows Retry inside SiteCopy. Pending draft is Meta “Drafting reply”, then fills its place, never wipes the user's personal text. Unconfirmed facts remain visibly editable; they do not become facts merely because a draft arrived. |
| Loading more | At oldest edge load earlier history; retain anchor so old messages insert above without moving what is being read. No pull-to-refresh here. |
| Refresh | No pull: upward history browsing must not cause refresh. Live updates plus More > Refresh read latest. While reading older messages, append without stealing scroll; show secondary “Latest message” Pill to jump. At latest edge follow new messages using native scrolling; no custom animated bubble entrances. |
| Offline/error | Keep text and draft. Send disabled with Offline/Waiting for signal, not an endless working button. A failed send preserves exact text with Retry and Edit; do not clear it. Ambiguous send outcome first checks the site before offering another send. Stale offer revalidates; expired offer loses commit actions and shows its actual end. |
| Sending/job | Started places outgoing text pending immediately; running says Sending there; arrived replaces pending with source-confirmed time/attribution; failed keeps text and local Retry. Leaving does not cancel the operation or resend it. Draft generation follows the same four moments. |
| Scrolling top/down/up | Shared chrome behavior. Transcript position is independent of composer. No collapsing buyer hero. At oldest edge paging preserves anchor; toward latest restores follow mode only when the latest edge is reached. |
| Re-tap/keyboard/Reduce Motion | No tab here. Keyboard moves composer and latest visible context together through OS timing; Back first closes a form Sheet, otherwise navigation preserves draft. Return inserts a newline in Composer; Send is explicit. Reduced Motion keeps jumps instant and status changes in place. |

Offer lifecycle differences: accepted/declined/countered/withdrawn/expired remain readable transcript facts with no stale Accept button; a seller counter on a buy-role thread is a new explicit buy-offer decision, never an auto-accept. A closed conversation keeps readable history and no send until a supported reopen is confirmed; blocked keeps the reason and supported Unblock/Back, not a hidden composer. Stale data revalidation updates these facts before any commit.

### Controls

D applies. More and offer More open content-height Sheet. Their items use Choice or secondary Pill, with Cancel. Item disclosure pushes item; cold Back from thread goes `/messages`. Site copy opens SiteCopy with actual captured timestamp; if absent say “No saved site copy” and offer SiteLink, never draw a fabricated capture. Why opens WhySheet with linked evidence and rule. See the numbers expands in place; Done closes.

Draft Send is confirmation of its visible exact text. Edit switches in place, guesses remain distinguishable, Take over preserves draft and stops automatic replies only here; Resume drafts changes this thread's mode. Composer Send explicitly sends own text, no automatic submission on typing or leaving. Correct it first fixes the underlying item fact through item editing, then returns with a reviewable follow-up draft; never immediately sends a generic correction. Ask me first saves the actual scoped rule with Undo, rather than showing a local-only success toast.

Accept offer opens an existing Approve confirmation Sheet showing amount, You get, recipient, and any site consequence. Counter opens Sheet with Guess numeric input, proceeds to Approve “Send counter”; Back cancels unsent counter and retains amount. Decline uses confirmation or genuine site-supported undo. Expiration remains visible on the card, not only hidden in More. Block opens a consequence Sheet and secondary confirm, then disables sending; offer Undo only if the real integration can reverse blocking. Unblock restores thread handling without sending. Pickup Notice opens the existing pickup route and returns here. Report/contact site are SiteLink actions when actual URLs exist, not simulated support controls.

Copy: 55 “Try again” -> Retry; 62 keep unavailable reason only if the site actually reports removal; 142 cut standing Plan explanation (rung 2); 163 “See the site’s copy” -> “Site copy”; 188/205 retain clear authorship but “Drafted and sent by you” -> “You sent a draft”; 220 “Hand it back” -> “Resume drafts”; 237 “Correct it” -> “Correct reply”; 242 “It asks you first next time” -> “Replies ask first”, only after a real policy update; 253 “You’d get” -> “You get” with the counter's calculated amount; 262 retain the real ignored-offer consequence, move it beside the card whose act meets it. Buyer-written text is content, never clean-copy rewritten.

### Planned features

Sources: pages §6.3/§7; messages §Evidence gate/Who may act; sold §pickup and disputes; assist; price offer policy; data traces/undo; decisions drafts-first and no fixed pickup windows.

| ID | Planned capability | Coverage after this audit |
|---|---|---|
| T01 | Chronological conversation, listing context, own writing, draft review and automatic authorship | In redesign: context Row, Message/Draft/Composer and Why. |
| T02 | Accept/counter/decline with You get, real expiry, ask-all/floor checks and same decision as Today | In redesign: DecisionCard and confirmation/counter Sheets. |
| T03 | Held or unparsable outgoing claim: exact unsupported span, reason, Send without it, Edit, It's true | Added: the held Draft uses Meta reason and secondary Pills for all three acts. Send without it removes only that span and reruns claim_check; It's true saves an owner-evidence attribute before generating a reviewable reply. No generic warning substitutes for these controls. The claim gate applies to automatic drafts and the person's own outgoing text alike; Don't send always remains available. |
| T04 | A fact typed in a personal answer can be saved on the item, only after consent | Added: after claim extraction, Choice “Save item fact” opens exact fact/evidence confirmation. Refusal leaves the reply editable and does not write an attribute. |
| T05 | Scam/off-site request/angry buyer/claim handoff; no automatic unverified payment claim | In redesign: safety/handoff reason, Take over, block/site escape; read site order state, not screenshot payment. |
| T06 | Share address on its own explicit tap; book/rebook pickup and inspect buyer, time, place | Added: More > “Share address” opens booked pickup address approval at `/item/:id/pickup?act=address`; Pickup Notice/More > “Arrange pickup” opens the same pickup task. No address is attached to an ordinary Send. |
| T07 | Returns, disputes, no-show, paid-before-dibs queue and shipment actions | Elsewhere: the conversation's Item > order/Ship/Pickup sheets; thread shows only relevant Notice to that subject. |
| T08 | Buy-role conversation uses same view; seller question is reply_other, every buy_offer asks, paying stays on site | Added: Thread chooses role from conversation; buy side uses MatchCard context instead of requiring an owned Item. Offer Sheet creates a buy_offer decision and never pays or auto-binds. Cold return is originating Listing when known. |
| T09 | Take over/resume, per-kind/per-site reply modes, correction, irreversible-send evidence | In redesign: scoped modes, Why > Correct reply and SiteCopy; global mode doorway goes Automation > Replies. |
| T10 | Send existing item media or take requested new photo/video, review before send | In redesign: Take photo and shared attachment gap. Added: More > “Item photos” opens existing photos in the same attachment review; no automatic private-media send. |
| T11 | Assist marks inferred words and exposes fitted corrections without a chatbot | Added: Draft guesses route through shared Assist surface, preserving owner edits; Question/Answer widgets are anchored at the active field, not a new chat. Shared gap below. |
| T12 | Full safety choice set: Reply safely, Ignore, Block; no off-site payment commitment | Added: warning context has Reply safely, Ignore and More > Block. Reply safely opens an exact reviewable draft through claim_check; Ignore dismisses/snoozes only that warning with its consequence, never asserts payment safe. |
| T13 | Don't send / Not now for a held draft, retain its exact text | Added: secondary Pill “Not now” saves the draft and returns to inbox without sending; held-claim Sheet also has “Don't send”. This is distinct from deleting history or switching all replies off. |
| T14 | Offer relative to ask, other offers and eligible per-item Always accept | Added: offer's WhySheet contains asking price and other currently open offers; Choice “Offer settings” opens Item Plan with the same floor/accept mode. Auto promotion still needs real unedited evidence, never a thread-local toggle. |
| T15 | Owner correction wins, provenance is accurate, facts propagate through the one Item record | Added: correction saves a pinned confirmed Item attribute with measured/tag/looked-up/you-said/not-checked provenance, then any live-listing change follows push_my_edit approval/readback. Unknown fit/measurement never becomes a confirmed buyer answer. |
| T16 | New media capture, generation and original preservation | Elsewhere: Item/Camera capture for that same item, with thread return and review. Existing source photos can attach; a requested flaw photo is not auto-generated, and originals stay. |

### Left to wire

| Redesigned part | Runs on today, observed code | Required feed, caller and unobservable live states |
|---|---|---|
| Identity/history/offer/pickup context | Fixture conversation, item, messages, offers and appointment: `app/src/app/messages/[id].tsx:40-42`, `:73-81`, `:101-103`; `app/src/demo/world.ts:106-108` filters fixture rows. | **S** GET /v1/conversations, GET /v1/conversations/:id/messages, GET /v1/items/:id or POST /v1/compare for buy role, GET /v1/appointments, GET /v1/orders; caller current thread, proposed `app/src/messages` read layer. Wire missing identity, true empty/deleted/history paging/live arrival/error/offline states. |
| Draft/Composer sending and claims | setTimeout at `[id].tsx:99`; Send appends local text at `:110-119`; offers change local state at `:121-130`; Draft at `:213-215`. No site write occurs in those callbacks. | **S** POST /v1/conversations/:id/messages, POST /v1/decisions/:id/act, PATCH /v1/items/:id/attributes/:name; use Job GET/events for pending write/readback and GET /v1/citations/:id for evidence. Intended caller thread plus shared message mutation layer. Use the same operation/idempotency identity for retry, and read back an ambiguous write before another send. Live claim hold/abstain, stale/expired decision, ambiguous send, retry, failed attachment are unwired. Default inbox engine ports explicitly have no draft writer/live send transport (`app/src/edge/api/conversations.ts:85-88`); POST route exists at `:111`, which is not proof of delivered sends. |
| Block, takeover, handback, Ask first, correction | Block/Undo only set state at `[id].tsx:106-108`; handback at `:220`; correction replaces spans at `:237-240`; Ask first only creates a toast at `:241-243`. | **N** PATCH /v1/conversations/:id for blocked/open and handling override, or extend the canonical decision act contract explicitly; no endpoint presently promises these fields. **S** rules POST/DELETE for actual policies, item-attribute PATCH for corrections, event undo only when allowed. These controls have local visual effects today, no persisted authority. Create/delete/renewal must use the canonical rules lifecycle; eligibility, renewal state, reply site scope and manual recovery need explicit server fields if absent. Same-operation retries must retain the idempotency identity, not produce a fresh send. Wire conflict/error/rollback and cross-session state. |
| Site opening, proof and media | Linking.openURL works at `[id].tsx:32`; SiteCopy receives no shot at `:228-229`; explanation matches demo events heuristically at `:277-282`; no media input is passed to Composer at `:143`. | **S** evidence snapshot_ref/citations and job events; **N** authorized screenshot/media retrieval and message attachment payload if existing media contract cannot serve them. Caller thread + capture return; do not invent a public proof URL. Actual image unavailable/loading/retry, media consent and upload failure need wiring. |
| Pickup/address/buy offer and Assist | Pickup route push exists at `[id].tsx:210`; current context assumes item and incoming offers at `:73-81`, `:101`; counter numeric Guess is local at `:252-254`. | **S** decision act for book_pickup/share_address/buy_offer, POST /v1/assist and job events, POST /v1/compare; caller thread with existing item pickup module. Add role-aware context and attachment/Assist kit. Provider, claim, proposal, cancellation/return states cannot arise live until integrated. |

## 3. Search

Purpose: compare offers for this query by delivered price and match, then open one listing. L scaffold. Person: used-goods buyer, during a search session; highest-cost mistake is treating an incorrect match or incomplete delivered price as the best deal. Familiar reference: marketplace search results, one query and one ranked list.

### Today and boundaries

`app/src/app/search.tsx`: Nav Watch 28, SearchField 34/46, introductory paragraph 35, offline 48, identity/used and retail money 50-59, SiteStrip 60, product history Notice 63, MatchCard results 65-69, empty/watch 70-72. Keep query, actual match identity, concise comparison basis, progressive site state, and result rows. Cut paragraph 35: the field/camera already show inputs, and a fixed five-site claim hides official stores (§6.13). Move full price history and sale evidence behind product Notice. Watch is a secondary task that creates a Want, not a second results list or inline settings form. Full per-site ranges are a source block in WhySheet reached by the comparison row, not five competing hero figures above the results.

### Redesign and reasons

Nav Back with Watch utility, Txt “Search”, SearchField, conditional offline/source status, then a compact Stack of identified product and a Choice “Used prices” with actual fair interval. Choice opens WhySheet with one KeepRow (`parts/worth.tsx`, `KeepRow`) per site, source dates, and retail comparison when supplied. SiteStrip follows as quiet query progress. First MatchCard result is the one thing that stands out: photo, match label, delivered total. Remaining MatchCard rows use identical treatment, ranked by delivered total against a trustworthy fair comparison, never referral payout. Product-history Notice goes after the comparison block or in its source Sheet, not another large section above results. No floating Watch button.

### States and controls

| State | Search difference |
|---|---|
| First load | Empty query shows SearchField and no example search, product, count, or price. Submitted query stays visible; SiteStrip shows waiting sites, actual result cards appear as available. A known card skeleton may stand in for its exact final card only if geometry matches. |
| Loaded | One/typical/dense preserve one ranked cross-site list including official offers when returned. Unknown shipping is “Shipping unknown”, not zero delivered. Unknown match stays unresolved, not exact. |
| Empty | Completed query with no offers: “Nothing for sale” and Watch search. No-query state does not offer Watch. If all sources failed this is error, not empty. |
| Partial | Results stay usable with truthful per-site counts; failed sites get local Retry in the comparison Sheet. Keep retail and sold/asking apart. Do not label a partial list globally cheapest. |
| Loading more | Next cursor for this query; append without moving existing rows. New source results may update rank on explicit refresh, or before the person starts scrolling; never move a card under a finger. |
| Refresh | Yes for new availability/prices, with the same query, after keyboard dismiss. Native pull when shared shell supports it; current-kit Refresh in comparison Sheet. |
| Offline/error | Cache and local query editing remain. Submitting offline preserves query and says Waiting for signal. Retry same query, no route duplication. Offline unavailable prices are timestamped, not a buying promise. |
| Scroll/re-tap | Shared contract; title and field scroll normally. Returning from listing restores query, result identity, and offset. |
| Keyboard/Reduce Motion | Field tap edits; Search Return commits query in place and dismisses keyboard. Cancel editing restores submitted query, not the last unsubmitted text. Reduced Motion applies shared contract; no spinner replaces the only camera route indefinitely. |

D applies. SearchField text/link submit changes this page query; camera pushes existing `/camera` with find purpose and a return to Search. Its permission refusal keeps text/link available. Watch pushes `/want?q=...`; a visitor signs in at that moment and returns to the same Want draft/query after success or to Search on cancel. MatchCard pushes `/listing/:id`, carrying visitor state. Fair-price Choice opens WhySheet; product Notice pushes `/product/:id`. Save, Offer, Ask, and external opening remain on Listing, avoiding extra targets per result. Cold Back goes Buy, or signed-out search entry when visitor; current unguarded router.back at 28 needs a fallback.

Copy: 34/46 retain “Find an item or paste a link”; 35 cut whole paragraph (rungs 1, 2); 55-56 replace combined sentence with one “Sold used for …” comparison value, move retail details to source Sheet, never erase delivered distinction; 63 “Price history and recent sales” -> “Price history”; 71 “Nothing for sale right now” -> “Nothing for sale”; supporting Watch sentence cut because button supplies the next act (rung 2); action “Watch this search” -> “Watch search”.

### Planned features

Sources: pages §6.13/§7; buy §one search/ranking/better official option; market; score; assist; watch; identify/appraise; decisions fixed platforms and no hot-items/seasons.

| ID | Planned capability | Coverage after this audit |
|---|---|---|
| Q01 | Text/photo/link visitor search, product identification and user correction/variant choice | Added: identity line uses GuessPick (`parts/pick.tsx`, GuessPick) with sourced candidates; wrong identity can be corrected before re-search. No forced sign-in for reading results. The identity Sheet has candidate photos, Not this?, None of these, editable text/Find this and Skip, with no certainty percentage. |
| Q02 | Progressive sites with real counts, freshness, failed/blocked/late distinctions and guarded per-site used/retail values | In redesign: SiteStrip, comparison WhySheet, partial-state contract; no asking-as-sold values. |
| Q03 | One marketplace/official-store list, exact match before loose match, delivered total, deduplication, no referral bias | In redesign: added explicit match-group ordering and duplicate “also on” disclosure. No new unseen shipping value is inferred as zero. |
| Q04 | Search filters for condition, seller kind, shipping origin/destination, price cap and stock | Added: Nav filter in query controls Sheet with Choices/Blank and Save filters; retain Watch as a secondary Choice there when Nav has only one utility slot. Selected filters are readable in that Sheet. |
| Q05 | Result match/score axes, seller/return terms, better official option paired to used offer, Similar for less | Added: each result's details Choice opens its compare/Listing evidence; a better official offer immediately follows the used offer it improves, with plain relation label, delivered/arrival/stock/condition and supported seller reviews/terms; Similar for less is a separate result Section after exact matches. MatchCard cannot represent arbitrary official sellers today, shared extension needed, not fake platform logos. |
| Q06 | Save, offer, ask, link-out/referral and human payment review | Elsewhere: Listing opened by each result, with POST compare and canonical match/decision/out acts. Visitors can open the site; authenticated-only acts trigger sign-in then return. |
| Q07 | Watch this query with availability/price intent | In redesign: Watch -> Want preserving query/filters; schedules and all Want editors remain there. |
| Q08 | Product history/recent sales/follow and cheaper equivalents | Elsewhere: Product page behind Price history; it carries follow and full history, without embedding another product dashboard in Search. |
| Q09 | Assist marked ambiguous spans, required versus optional blanks, fitted widgets, Something else/Not sure, owner edits win | Added: directly under SearchField, shared Assist field/picker, not a question chatbot. Only unfilled required identity blocks submission; optional preferences may stay unknown. |
| Q10 | Recall gate, unavailable offer state, insufficient evidence and incomplete total | Added: remove recalled products from purchasable results; Gone retains reference with no act; hidden fair value names insufficient evidence; unknown delivered components remain explicit and never rank as a known bargain. |
| Q11 | Active-filter hidden count/reset, Not the same for wrong duplicate merge, More like this | Added: filter Sheet shows backend-reported hidden count and Clear filters; Also on detail offers Not the same to separate a wrong merge; result details include More like this -> search with like/photo context. Each remains a comparison action, not a new watch setting. |
| Q12 | Rough/checked appraisal, max to pay, physical check, offline haggle, Deep, Just value it | Elsewhere: What's it worth reached by “Appraise this” in result/identity details. Guard recall unavailable and unresolved identity before a Buy verdict; preserve ranges wider/not checked and photo/date/sold-versus-asking evidence. |
| Q13 | External purchase return, Did you buy, owned purchase cost and Sell this | Elsewhere: Listing/Bought using the canonical purchase/item flow; preserve return context, no buying or adding owned items from a Search row alone. |
| Q14 | Referral disclosure and retained-value comparison | Added: result comparison disclosure includes official warranty/returns/delivery/retained-value/cost-to-own facts only when supported; actual earning link has referral disclosure at its action in Listing. No affiliate preference in rank or verdict. |

### Left to wire

| Redesigned part | Runs on today, observed code | Required feed, caller and unobservable live states |
|---|---|---|
| Search, product, results, ranking | `app/src/app/search.tsx:25-27` calls searchFor/product; `app/src/buy/read.ts:52-57` chooses SEARCH_DUNKS/EMPTY/SLOW by regex; fixtures exported by `app/src/demo/index.ts:27` from `app/src/demo/market.ts`. Ranking is local at `app/src/buy/read.ts:48-49`. | **S** POST /v1/search (not GET), POST /v1/compare, GET /v1/products/:id, GET /v1/scores and citations; intended caller `app/src/buy/read.ts` or a proposed API reader in `app/src/buy`, replacing the fixture selector. Actual arbitrary-query, official-store, dedupe, price/condition/terms and hidden-evidence responses remain unwired. Backend search emits real job batches at `app/src/edge/api/search.ts:137-157`, but default result still has product:null and official:[] at `:129`; fill those projections as well. |
| Query/identity/filter/Assist controls | Submit only router.setParams at `search.tsx:34`, `:46-47`; no filter/Assist call is supplied. SearchField only edits/submits text at `app/src/ui/parts/search-field.tsx:17-38`. | **S** POST /v1/assist + job GET/events, then POST search with assist_job_id/answers/filters. Intended `app/src/buy` client and shared Assist renderer. **N** kit surface for live marked text and anchored picker; existing GuessPick/Choices do not alone implement that field. Unresolved/required/held/superseded spans and validation/conflict are unwired. |
| Site progress, pagination, refresh/offline/retry | Waiting/counts read fixture at `search.tsx:39-41`, SiteStrip at `:60`; failure is forced at `:29`; no dense fixture at `:17`. | **S** GET /v1/jobs/:id/events plus polling GET /v1/jobs/:id; **P8→S** visitor-owned search-job events, not signed-in global stream. Same caller binds actual pending/failed/empty/late/cached batches, paging or no-cursor terminal state. Refresh must submit this query, not set a demo parameter. |
| Watch/product/listing/camera links | Actual router pushes, not API acts: `search.tsx:42`, `:47`, `:63`, `:68`. | **S** POST /v1/wants in Want, GET product/history, POST compare, GET /v1/out in target Listing; **P8→S** auth return. Caller `app/src/buy` with target modules. Watch presently only navigates; verify target saves separately. Photo purpose/query return, visitor cancel, offer unavailable and source loading require integration. |

## 4. By site

Purpose: compare how the person's sales perform on each site, then inspect one site's figures. Analytics, L. Seller checks occasionally; costly error is confusing gross sales with money received or performance with connection health. Familiar transfer: comparable account rows from the supplied Settings/list guidance, with the same measures in the same order.

Today: `app/src/you/by-site.tsx:32-48` title and per-site sales/days/kept list; 50-59 owned-item worth; 61-69 editable monthly goal. Worth moves to Worth, goal to Goals. These break one-job and two-primary-actions split criteria even without three screens of content. ListRow at 39-42 currently packs unlabeled money beside sale count and days, omitting the §6.16 share-of-asking/funnel/best-selling data.

Redesign: L heading; Choice period selector showing selected period; Section > ListRow per site, real logo, primary value labeled “You get” for net sales, detail “Sold in …” when known, disclosure opens a per-site analytics Page under this route. This comparison is the focal content; no big combined cash total. The detail Page uses L, site logo, period, then separate Section/List rows in this order: sale count, net received, days to sell, share of asking; funnel only for measured stages, and best-selling types only when sourced. Source Choice opens WhySheet with the underlying sales and timestamp. These are blocks about one site's performance, not connection/link controls. No graph if rows already answer the question. Missing metrics say Not available and show no synthetic zero.

States: first load Loading sales by site; loaded one/typical use the same metric order across sites; empty “No sales to compare” + Open Sell; partial retains measured metrics and identifies unavailable ones; loading more applies only to underlying sales in the detail/source, the core site set is bounded; refresh yes, re-read selected period; offline cached timestamped comparisons; error Retry same period; top/down/up/re-tap and Reduce Motion inherit shared contract; keyboard absent. Period Sheet uses Choices from available periods, no arbitrary history limit. Row push returns here, cold Back You; source Sheet Done closes. D applies, no haptic for changing an analytical filter.

Copy: 41 “Linked, no sale to measure yet” -> “No sales yet”, connection fact moves to Accounts; “Sold here before you linked it” remains only in source attribution if necessary; 46 cut instruction about where sites appear, use empty state (rung 1); 51 and 61 headings disappear with relocated subjects; current `PAGES.insights.title` remains By site. Net amounts must gain their label; “Kept” -> “You get” when the value is net, not a payout status.

### Planned features

Sources: pages §6.16 By site/§7 insights; insights §guarded numbers/analytics suite; data; score; decisions own-sales comparison and no hot-items/seasons. These additions preserve comparison as the parent job, with each deeper question pushed behind one row.

| ID | Planned capability | Coverage after this audit |
|---|---|---|
| B01 | Own-sales days to sell/share of last asking price, sold/net figures with period and source | In redesign: site rows > per-site analytics > WhySheet, with hide rules, never peer-seller comparison. |
| B02 | Reported funnel stages, traffic source, views/offer and views/sale conversion, matched definitions | Added: per-site detail has funnel/source rows and calculated ratios only when denominator/source valid; do not aggregate unlike platform definitions. |
| B03 | Best-selling categories/brands and median sold price; profit by category/brand/site with excluded unknown costs | Added: per-site ListRow “What sells here” -> `/you/insights/:site/groups`, filter category/brand and inspect median/net/profit/cost coverage. |
| B04 | Seller reliability: shipment time, cancels/returns, site-reported figure beside own measure | Added: per-site ListRow “Reliability” -> `/you/insights/:site/reliability`, not connection-health controls. |
| B05 | Promotion spend versus matched results, break-even and uncertainty | Added: per-site ListRow “Promotion results” -> `/you/insights/:site/promotion`, with Too early to tell rather than invented uplift. It inspects results, never buys promotion. |
| B06 | Listing-month cohorts and sell-through at planned horizons with evidence/hide rules | Added: per-site ListRow “Listing months” -> `/you/insights/:site/cohorts`; label cohort and horizons, not a misleading stock formula. |
| B07 | Storefront score rollup, weighted by expected net, with lowest contributors and best next move | Added: conditional per-site Choice “Listings to review” -> `/you/insights/:site/scores`; hidden if no supported scores. Source says agent proposal, Ben's agreement not recorded; do not represent it as decided or show hype/seasons. |
| B08 | Stale/slow movers and ABC expected-value groups, stock sell-down forecast, anomalies | Elsewhere: separate analytics subjects reachable from final “More insights” ListRow -> `/you/analysis`, then `/you/analysis/slow`, `/you/analysis/sell-down`, `/you/analysis/changes`. Slow includes category/brand expected-value groups and stale-item action links; forecasts remain fixed evidence-backed pages, not free Genie claims. |
| B09 | P&L, fees, source money lines and export | Elsewhere: Records and tax > period financial report; By site has a “Sales records” disclosure carrying site/period. |
| B10 | Worth, monthly goal and overall You headline totals | Elsewhere: Worth, Goals, and You summary respectively; no editors or totals for those subjects embedded here. |

Added child pages use L with the selected site/period/category/brand retained, ListRow for metrics and source disclosure, ItemCard for contributors, WhySheet for proof. They inherit loading/partial/error/empty/offline/refresh/paging/scroll/Reduce Motion from this page; forecast has no pull-based recomputation without an explicit Refresh. Not enough data shows its hide reason, never an empty success chart. Their metric rows open sources; source records open Item then return to exact filters. No new chart pattern is needed. Per-site stats carry their actual reporting definitions; late fees/refunds/payout anomalies keep sources and action context. Missing determination cards named in insights remain method dependencies, not permission to invent a forecast.

### Left to wire

| Redesigned part | Runs on today, observed code | Required feed, caller and unobservable live states |
|---|---|---| 
| Site comparison and source details | `app/src/you/by-site.tsx:17-23`, `:35-46` derive demo insights and render only sales/days/net. `app/src/demo/world.ts:113-131` has no share-of-asking/funnel/reliability/citation projection. | **S** GET /v1/insights filtered by period/site/category/brand, GET /v1/citations/:id; intended `app/src/you/by-site.tsx` with proposed `app/src/you` API reader. Real guarded hidden/partial/source-error states and definitions/last-as-of are unwired. Backend synthetic feed cited in common audit also requires actual rollups. |
| Analytics child rows and More insights | None in current BySite render at `by-site.tsx:35-69`; child routes absent from `app/src/app/you/[page].tsx:19-32`. | **S** same insights suite fields `profit_by`, `reliability`, `promotion`, `cohorts`, `stale`, `slow_movers`, `sell_down`, `anomalies`, `pnl`; proposed modules under `app/src/you`, new subject routes above. Filters are specced, schema details still need projection, not new fabricated `/analytics` APIs. Real no-basis/loading/error/empty/pagination cannot show until built/wired. |
| Score contributors and action links | None in `by-site.tsx:35-69`; present site rows have no onPress at `:39-42`. | **S** GET /v1/scores?subject_type=listing, GET /v1/scores/:id/basis, item/decision routes for suggested change; proposed contributor reader in `app/src/you`. Rollup weights and contributor IDs need a guarded projection if not in insights, **N** fields on that feed. No live score/correction states today. |
| Period/refresh/Why and shifted subjects | Existing goal input mutates local target at `by-site.tsx:25-29`; current worth row only navigates item at `:55`. | **S** insights/citations; the redesigned period/refresh/source/disclosure controls do not exist yet. Local loaded-state previews do not establish true refresh failure/empty period or preserve a completed API write. |

## 5. What your things are worth

Purpose: understand the current value of owned things, then open an item whose value needs a closer look. Analytics, L. Occasional owner; wrong inference is treating an estimate as guaranteed earnings. Title stays the supplied page name, wrapping at spaces, not clipped to one line.

Today: no separate route (`you/[page].tsx:19`); content is BySite 50-59. Current title-only ListRows at `app/src/you/by-site.tsx:54-55` have no item photos, breaking recognition and C3, and no weekly movement. Connection health, goal editing, sold receipts, and sell-plan controls do not belong here; their current surrounding sections move to their named pages.

Redesign: L heading, conditional freshness; Section with ItemCard per owned/kept/live item, real photo, correct state, `fact` label “Worth” and formatted low-to-high value. Meta immediately beneath that card gives actual weekly movement or “Not valued”; it belongs to this item, not a fourth page heading level. Whole ItemCard opens item valuation. Use one list, with an optional Choice filter for owned/kept/live only when needed; do not duplicate an item that is listed on several sites. The guarded combined low-to-high Range is the focal block above the item list, with weekly change and the count excluded for insufficient evidence. Never sum estimates into an exact amount. Why and comparable sales remain on Item's valuation/source Sheet. No automatic price-change action here.

States: first load Loading values and exact ItemCard skeletons if no cache; loaded includes one/typical/dense without demo caps; empty “No things valued” + Open Sell (which points to the decided + entry, no second capture entry here); partial shows settled values, unknowns as Not valued, working items as actual valuation jobs; loading more appends owned items; refresh yes for a new read, not automatically a paid revaluation; offline retains dated ranges and disables starting unavailable research; error Retry only missing read. Valuation job started/running/arrived/failed stays with the item, shows Pricing then range or Retry, and continues when leaving. Shared scroll/re-tap/Reduce Motion apply; no keyboard. Filter is Sheet; item push Back returns here; cold Back You. D applies.

Copy: BySite 51 heading becomes page title; 54 Kept/Live become existing state words, no duplicate explanatory line; 55 “Not valued yet” -> “Not valued”. Weekly movement always names a period; a missing prior valuation produces no invented unchanged amount. New route has no existing strings to cut.

### Planned features

Sources: pages §6.16 Worth/§7 insights; insights §guarded numbers and worth; appraise/price/item-card/data.

| ID | Planned capability | Coverage after this audit |
|---|---|---|
| W01 | Every owned, kept and live item, deduplicated, with a guarded value interval | In redesign: ItemCard list, owned/kept/live filter and hidden-value explanation. |
| W02 | Combined worth interval and movement over seven days, with count excluded for no valuation | Added: Range (`app/src/ui/parts/worth.tsx`, Range) above the list, count excluded, aggregate citation. This replaces the earlier draft's omission of a total, never sums into an exact amount. |
| W03 | Per-item weekly movement and source/date, open actual sold comparables | In redesign: item Meta and item valuation/source; Added: total and movement Choice open their aggregate WhySheet too. |
| W04 | Update or correct valuation/identity, failed jobs and weak basis without forced selling | Elsewhere: Item valuation/What's it worth, reached through the item; no sale-plan primary action in this page. |
| W05 | Total sold all time distinct from owned worth and live potential | Elsewhere: You > Records all-time summary; add a final “Sold records” disclosure here, never add sales to worth. |
| W06 | Hidden/rough/unvalidated valuation and actual value-moved notice | Added: Worth marks unvalidated kinds Not checked and unknown basis rather than a confident range; source sheet can offer clarification or Deep via Item/Appraise. Value-moved notice itself belongs Today/Item and is reached through that item's row. |

### Left to wire

| Redesigned part | Runs on today, observed code | Required feed, caller and unobservable live states |
|---|---|---|
| Page and owned-item ranges | No separate route (`app/src/app/you/[page].tsx:19-28`); embedded list uses demo item valuation at `app/src/you/by-site.tsx:50-59`, not an API. Fixture kept_worth projection at `app/src/demo/world.ts:129`. | **S** GET /v1/insights plus GET /v1/items and GET /v1/items/:id, citations; proposed `app/src/you/worth.tsx`. Feed needs guarded per-item/week and aggregate fields if absent, **N** projection fields, not permission to compute a fake exact total. All page loading/error/empty/partial/offline states and pagination remain unwired. |
| Combined/week/source controls | No total/weekly values or Why control in existing embedded render (`by-site.tsx:50-59`). | **S** citations read; **N** aggregate worth/week/missing-count projection on insights if needed. Same proposed module calls these; true no-basis/old-prior-value/citation failure need wiring. |
| Refresh/revaluation/item/sold disclosure | Current worth row only pushes Item (`by-site.tsx:55`); no worth refresh control in `:50-59`. | **S** read refresh; POST /v1/valuations and job GET/events in Item/Appraise, GET /v1/records for sold records. Caller Worth reads, target modules mutate. Wire persistent valuation progress/failure/arrival and return position; do not run paid revaluation merely to refresh a list. |

## 6. Goals

Purpose: track a goal the person chose for this month, then edit that goal. Personal tracking, S with one progress block. Occasional owner; no target is imposed, no missed-month guilt. The money goal and item-count goal are two measures of the same chosen monthly outcome, not sales analytics or site preferences.

Today: no Goals route at `you/[page].tsx:19`. Goal is in `app/src/you/by-site.tsx:61-69` with GoalBar and Guess/Blank editing on change at 25-29. Move it out; persisting each numeric keystroke is not an explicit goal-setting action. No money/site insights surround it.

Redesign: Nav/heading; current month Txt in text face; GoalBar for the saved money target, the one focal block; ListRow “Things sold” with “actual of target” for a count target, never GoalBar's currency formatting. Section/ListRow “Money goal” and “Things goal” show current values and open one form Sheet each. Each uses Blank or Guess, numeric input, Approve “Save goal”, secondary Remove goal and Cancel. Removing one target leaves the other. No foot when simply viewing. If no targets, EmptyState “No goal set” with Set goal opens the same form, not a fabricated progress zero.

States: first load Loading goal, keep month; loaded shows saved goal and real progress; empty means no user-set target; partial keeps saved target when progress cannot be read, “Progress unavailable” + Retry; loading more not applicable, this month is bounded; refresh no gesture, progress revalidates on entry and local Retry; offline saved progress timestamped, edits remain marked pending; rejected save restores last saved target and preserves form value. Top/down/up/re-tap/Reduce Motion shared; keyboard decimal for money, whole number for count, no currency characters stored in numeric value; validation on save, no target zero masquerading as a goal. D applies; Save/Remove haptic only on commit. Back to You, or real caller if entered through a summary.

Copy: BySite 62 “Kept so far” -> “You get” only for the confirmed net-sales progress measure; 64-67 repeated “Goal” labels -> Money goal / Things goal with units. The month comes from date, no hard-coded November. No streak, congratulatory line, or reminder for a missed goal.

### Planned features

Sources: pages §6.16 Goals; insights §Goals/goal progress; data citations; decisions money goals are optional proposals.

| ID | Planned capability | Coverage after this audit |
|---|---|---|
| G01 | Person-set month money target and optional sold-count target | In redesign: goal Sheet numeric fields and Approve. No default November goal. |
| G02 | Derived released/handed-over net progress, count and active/reached/ended states | Added: GoalBar reads payout-confirmed Kept only; count progress reads paid sales separately. No sale-in-claim-window counted as spendable money. |
| G03 | Refund after payout reduces progress with an explainable event; actual source arithmetic | Added: progress Choice opens WhySheet with payout/refund rows and computation time. It is not a celebratory counter or silent drop. |
| G04 | Edit/remove target, no missed-month guilt or celebration; optionally inspect sold amount | In redesign: Edit/Remove; Added: WhySheet “Sales behind goal” links the period's Records, keeping alternate gross measure out of main progress. |

### Left to wire

| Redesigned part | Runs on today, observed code | Required feed, caller and unobservable live states |
|---|---|---|
| Route/progress/count | Route absent (`app/src/app/you/[page].tsx:19`); target/progress from demo at `app/src/you/by-site.tsx:20-21`; fixture progress sums noncancelled sales, not only released payouts (`app/src/demo/world.ts:57`, `:131`). | **S** GET /v1/insights goal and PUT /v1/goals/:month `{target_cents,target_sales?}`, GET citations; proposed `app/src/you/goals.tsx`. Correct progress semantics at feed, not UI arithmetic. Actual active/reached/ended/refund/error/empty states require wiring. |
| Goal edits/removal and source | onChange calls setTarget/changed only at `by-site.tsx:25-29`, input at `:64-67`; no source action there. | **S** PUT goal for save, citation GET; **N** explicit clear-target semantics (nullable PUT or DELETE /v1/goals/:month proposal) and count-only representation, since both target_cents and target_sales are currently required by fields validation (`app/src/edge/api/insights.ts:28`). **N** optional-count and clear-count semantics are needed too: do not send an invented zero sales target to satisfy that validator. Wire save failure/conflict/offline pending/restart persistence; do not call this current input a saved goal. |

## 7. Accounts

Purpose: see which sites are connected, then link or repair one connection. Linking, L with S rows. Seller checks at setup or on a failure; wrong assumption is that linking one site authorized every risky action. Connection capabilities and limits must be truthful before consent.

Today: `app/src/you/sites.tsx:29-31` title/status; 32-38 cross-site mismatch list; 39-43 all link rows and password reassurance. LinkRow is `app/src/you/link-row.tsx:11-27`, a helper using ListRow, not a part to copy. Keep real site identity/health/last check; move detailed mismatches to their site's inspection Page, with only a count/state in that site's row. Mismatch items plus external action buttons ahead of linking break one subject hierarchy. No funnel, sales amounts, or user-identity settings here.

Redesign: Nav/heading “Accounts”; conditional connection fetch status; Section/List of ListRow per site. A linked row has logo, Linked/Needs sign-in, last checked, and chevron to connection Page. An unlinked row has logo, Not linked, Link secondary Pill in trail, no competing row press. Linking shows a working state in that row only. Failure keeps reason and Retry there. Use existing Tag (`app/src/ui/parts/tag.tsx`, `Tag`) need/failed only when truthful; do not invent a fifth connection color or label a connection Live. The one repair row needing the person stands out by its state, not a permanent black Link on every site.

Link opens a content-height consent Sheet with this site's actual read/write capabilities and browser/API limitation, risk if relevant, Approve “Link site”, Cancel. Provider sign-in is the provider's secure surface; return restores this row. No password field in secondhand. Successful link reads back health/capabilities; not merely a timer. Relink preserves imported records. Site-specific permissions are connection subjects; default posting policy remains Automation/App defaults.

States: first load Loading accounts; loaded includes all supported sites and real statuses; empty means no connections and still renders Not linked rows; partial health unknown is Checking/Unavailable, not Not linked; loading more absent for bounded supported site set; refresh yes for health/check status, never silently launches sign-in; offline cached status, Link/Retry waits for network without false success; failed linking has local retry/cancel and does not block other sites; OTP needed opens provider continuation, cancelled/expired OTP returns to same row. Started link state appears immediately; running identifies provider sign-in; arrived says Linked after readback; failure says what failed with Retry. Shared scroll/re-tap/Reduce Motion; keyboard only on secure provider surface, OS owns it. Cold Back You. D applies.

Copy: `sites.tsx:20` “Its sign-in ends soon. Link again to keep it” -> “Sign-in expires soon”, Relink action on detail; 21 “Finish on the site’s own sign-in page” keep only while sign-in actually waits; 23 blanket “Post, answer buyers and end listings here” cut, replace with actual capabilities in consent (rung 1, honesty); 33 “Doesn’t match” removed from this page with relocated detail; 43 password reassurance cut here (rung 3), provider identity/security context belongs at actual link consent. LinkRow 26 “Try again” -> Retry.

### Planned features

Sources: pages §6.16 Accounts/§7 connect/§8 auth/import/relink; connect §What the person does and Signing in; data and replay. Decisions core five remain; OfferUp/Grailed are later search/price-only, not silently enabled posting.

| ID | Planned capability | Coverage after this audit |
|---|---|---|
| A01 | Core site health/last-check/capabilities/risk and link or relink independently, skip without blocking others | In redesign: connection rows > per-site consent/repair; keep site-specific risk at link choice and capabilities one tap away. |
| A02 | OAuth where available, hosted sign-in/OTP, clear session expiration/rate-limit/site-warning handoff | In redesign: consent/provider flow and four job moments; Added: paused health displays no outbound actions and opens connection repair, not automatic retrying writes. |
| A03 | After link, preview/import existing live listings and purchases, preserving purchase cost | Added: successful linked row offers “Import found items” disclosure -> `/you/connections/:site/import`; Page has listing/purchase selections, Photo/ItemCard previews and Approve Import items. Skip returns Accounts. No accidental duplicate owned items. |
| A04 | Potential duplicate import uses a merge_items decision with matching facts/evidence | Elsewhere: import Page > existing Item/merge decision detail; Accounts never merges because titles match. |
| A05 | Optional saved-password consent off by default and one-tap removal, per-site risk | Added: site consent Sheet has Switch “Save sign-in”, only if backend supports encrypted password purpose-bound access; manage/remove on connection detail. No password text in logs. |
| A06 | Unlink stops harness actions while keeping history/orders; reconnect does not destroy imported records | In redesign: connection > Unlink confirmation, real job outcome; no fake reversible session restoration. |
| A07 | App identity sign-in, onboarding progress and add another sign-in method | Elsewhere: onboarding and Account; Accounts does not become app identity settings. |
| A08 | Later search/price-only marketplaces and unsupported verbs | Added: explicit future-supported entries only when enabled by contract; use existing capability row with Open on site handoff, no posting promise. Keep OfferUp/Grailed pending as planned, core five unchanged. |

### Left to wire

| Redesigned part | Runs on today, observed code | Required feed, caller and unobservable live states |
|---|---|---|
| Site list/health | Fixture `w.connections` at `app/src/you/sites.tsx:14-24`, `LinkRow` at `:41`; demo usePage chain is in common audit. | **S** GET /v1/accounts; intended `app/src/you/sites.tsx` and shared account client replacing useLinks fixture. Actual capabilities/health/freshness/empty/partial/error/offline are unwired. |
| Link/relink/OTP and risk consent | `app/src/you/state.ts:91-98` is a timer with first-Mercari failure and local unlink. No provider opens there. | **S** POST /v1/accounts and returned secure link, job GET/events plus account readback; caller `app/src/you`. Server currently accepts only ebay/depop at `app/src/edge/api/accounts.ts:39-41`, so core other-three link routes and real consent/provider completion need work. Backend route existence alone does not replace demo timers. |
| Import listing/purchase preview and merge | No import controls in `sites.tsx:32-43`; route map lacks an import child (`app/src/app/you/[page].tsx:19`). | **P8→S** GET /v1/accounts/:id/import-preview; **S** POST /v1/accounts/:id/import, merge via decision act, jobs. Proposed `app/src/you` import page/client. Server preview reads listings/purchase count (`app/src/edge/api/accounts.ts:56-63`); purchase preview rows/selection details need **N** projection extension if unavailable. True import/read/match/write/duplicate/partial-failure states are unwired. |
| Save-sign-in, future sites, pause/unsupported verb | No password-consent or capability detail controls in `sites.tsx:39-43`; fixed five-site order at `app/src/you/state.ts:76`. | **N** opt-in password-secret save/remove and capability consent write contract; use a proposal such as POST/DELETE /v1/accounts/:id/credentials, never a body in Markdown/logs. Caller connection module; backend route capability must determine availability. Until implemented these controls have nothing to call and must be marked unavailable, not fake toggles. |

## 8. Automation

Purpose: control what the agent may do without a tap, then change one action's mode. Settings, S. Person visits when granting trust or correcting a mistake; worst error is silently allowing a public or locked action. Not listing-by-listing pricing, not a general account settings index.

Today: `app/src/you/rules.tsx:42-61` heading and rule switches/promotion explanations; 63-66 Permissions doorway; 68-74 per-live-item price limits; 77 onward price-limit form. Move per-item lowest prices to that item's Plan Sheet, accessible from Sell/Item. Their current title-only rows also omit photos. Keep promotion evidence, but stop listing two competing global control systems as “rules” and “permissions”. `permissions.tsx:54-71` is this family's action-mode detail, not identity settings. Activity is a rule-log detail, not a second summary on the main page.

Redesign: Nav/heading “Automation”; Section/ListRow for each action kind, current mode value, short consequence only when needed, chevron to one action's settings Page. One actual action being changed is the focal content, no decorative hero. Eligible binary rule may use Switch in trail; three-state modes use Choice/Choices in Sheet. Locked rows say Never alone with no toggle. Action detail: plain when/if/then block, current mode, eligibility and its three unedited approval records behind WhySheet, then Rule log disclosure. Rule log is a pushed L page filtered to that rule, real actions with timestamp, outcome, source, and Undo only where reversible. Reply handling detail contains Draft for me / Answer for me / Off and per-site overrides; Answer for me remains earned per kind. Offers continue to follow the item's Plan.

Existing permission controls, experiment consent, pause selling, and listing defaults must stay reachable within their proper subjects. Automation lists “Pause selling” as a disclosure to its confirmation/form, plus disclosure “Listing defaults” to existing Defaults, not all defaults inline. The temporary pause consequence names sold-order duties and site behavior before approval. Experiments consent belongs in an action-detail settings group and starts from stored consent, never inferred.

States: first load Loading automation, no fabricated enabled defaults; loaded shows real modes; empty rules still shows supported action kinds as Ask/Never alone, not “approve cards to unlock this screen”; partial mode unknown disables only that action; loading more only in filtered Rule log; refresh no pull on preference page, revalidate permissions on entry/save and provide local Retry; offline mode changes remain visibly pending and cannot promote to Auto without fresh eligibility; error preserves the previous mode and proposed edit. Promotion job started/running/arrived/failed is in that row, no premature Auto. Shared scroll/re-tap/Reduce Motion; no keyboard on main page, forms in listing defaults use appropriate numeric/text keyboard and preserve edits. Back actual caller, cold You; child Back Automation; D applies.

Controls: row pushes action detail; mode Sheet selects eligible mode with consequence confirmation for increased authority; turning a reversible rule off commits in place with Undo. History rows push item/thread as named, then pop to filtered log. Pause selling opens form with return date and exact per-site consequences, final Approve; no immediate network/public changes on Switch alone. Resume selling revalidates each site's state rather than promising every listing returns. Reply review doorway from Messages reaches this detail with Back returning to Messages. No below-minimum or address action can be promoted.

Copy: `rules.tsx:43` title -> Automation; 46 “Runs on its own” not a second title for the entire list; 52-53 promotion paragraph -> current mode on row, exact evidence inside detail; 59 cut universal tutorial (rung 1); 64-65 Permissions detail sentence cut (rung 2), use “Action permissions”; 69 Lowest prices moves to Plan; `permissions.tsx:59` global Undo explanation moves beside actual reversible log actions; 71/79 repeated promotion instructions move to the eligibility detail once. Mode words Ask, Auto, Never alone retain the product meaning, with a plain action-specific consequence in the picker.

### Planned features

Sources: pages §6.16 Automation/§7 data; data Who may act/events/learning; messages reply modes; price/list/sold action tiers; score experiments; decisions three unedited approvals, never below floor and drafts-first.

| ID | Planned capability | Coverage after this audit |
|---|---|---|
| R01 | One rule system with when/if/then, Ask/Auto/Never alone, scoped by kind/item/site where supported | In redesign: S > action detail > mode control, with canonical policy and locked action read-only. |
| R02 | Promotion after three unedited approvals; show evidence and allow more cautious control/undo | In redesign: eligibility WhySheet and evidence records, never arithmetic from button taps alone. |
| R03 | Rule/event log, why/trace, source, undo availability/deadline, no fabricated replay | In redesign: action detail > Rule log; Added: a missing trace says No detail recorded, and undo absent/expired is a fact rather than a dead control. |
| R04 | Draft for me/earned Answer for me/Off, per-site override, thread takeover distinction | In redesign: Replies detail and same real rule system; no offers conflated with messages. |
| R05 | Pause/resume selling with site limits, return date and sold-order duties | In redesign: pause confirmation/form; one operation has per-site partial/failure states, not a universal successful switch. |
| R06 | Standing experiments opt-in, explicit experiment decision with budget/floor, shared training consent | Added: Experiments detail row reads actual tests and consent; distinct training-consent Choice belongs in Account data use, never infer shared-model permission from a listing experiment. |
| R07 | Listing defaults, cross-site price rule and example arithmetic, photo/voice/unit defaults | Elsewhere: existing App defaults pushed Page with source example; same take-home is the new-seller default; Same price, What each site pays, and Your shop first remain selectable, with reason and one-item arithmetic behind WhySheet. Per-item override remains Plan. No defaults are lost by moving permissions out of Account. |
| R08 | Per-item minimum, accept-at-once, seller intent, address/pickup/payment boundaries | Elsewhere: Item Plan and pickup/payment decisions; Automation links to relevant item rather than editing arbitrary listing floors inline. |
| R09 | Registry/source routing health, missing need, rights/trace evidence and developer kill switch | Elsewhere: source health diagnostic Page for developer use; ordinary person sees only source line and actual evidence in Why. No developer routing control added to personal Automation. |
| R10 | Create/remove rule without promotion prompt, fixed When/Then by kind and editable If limits | Added: action detail has Create rule/Remove rule forms using fixed kind vocabulary plus editable supported limits; Ask is the starting mode unless explicitly authorized/eligible. Locked kinds have no creation path granting Auto. |
| R11 | Rule expiry/renewal, correction demotion and unavailable site undo | Added: action detail shows state and Keep rule/Let it lapse when renewal is due; expiry prompt lives Today. Actual Undo demotes the responsible rule; 409 site_no_undo gives named manual recovery and does not pretend reversal succeeded. |

### Left to wire

| Redesigned part | Runs on today, observed code | Required feed, caller and unobservable live states |
|---|---|---|
| Rules/modes/eligibility | Fixture w.rules and local on map in `app/src/you/rules.tsx:18-21`, flip only setOn/changed at `:27`; Permissions modes are local at `app/src/you/permissions.tsx:43-48`. | **S** GET/POST /v1/rules and DELETE /v1/rules/:id, GET limits and decision evidence; intended `app/src/you/rules.tsx`, permissions child, shared API layer. Server only accepts all or item scope (`app/src/edge/api/rules.ts:68-78`), so **N** reply/site scope and explicit ask/off defaults contract. POST currently writes state:auto unconditionally (`app/src/edge/api/rules.ts:83-85`): an Ask-mode Create rule form cannot call it unchanged. Add versioned mode/limits/lifecycle writes and server eligibility evidence for promotion, expiry, renewal, Keep rule and Let it lapse, rather than inventing PATCH as an existing route. Actual expired/renewed/removed/rejected-increased-authority states are unwired. Wire persisted/rejected/locked/stale/offline/eligibility states before enabling Auto. |
| Logs/evidence/undo | Activity uses demo events (`app/src/you/activity.tsx:14-22`); rule page has no rule-log disclosure at `rules.tsx:46-74`; changed only logs (`state.ts:34-36`). | **S** GET /v1/events?item_id=&cursor= and POST /v1/events/:id/undo, citations; **N** rule_id/site filters if existing event query cannot narrow correctly. Caller proposed rule-log reader. Actual pagination/expired undo/no trace/undo failed cannot be established by local toggles. |
| Pause/defaults | Pause is local Switch in `app/src/you/settings.tsx:20-27`, `:37-40`; defaults are local state at `app/src/you/defaults.tsx:33-47`. | **S** limits for supported fields; **N** versioned pause/until and remaining listing-default fields on limits/user plus actual per-site away-mode operation. Proposed `app/src/you` settings client calls agreed projection, not new policy hidden in UI. Real partial pause/resume/return-date/save failure are unwired. |
| Experiments and training consent | No experiment controls in current rule render (`rules.tsx:46-74`); no training consent in current account section (`settings.tsx:49-55`). | **S** GET /v1/experiments, POST /v1/experiments/consent; **N** distinct shared-training opt-in contract, to be agreed, default no. Caller Automation experiments detail and Account data-use child. True consent/revocation/join-test-decision/failure states absent. |

## 9. Pickups

Purpose: set the saved preferences used when arranging a pickup, then edit the saved meeting place. Settings, S. Seller visits occasionally; sending an address or agreeing a time without consent costs most. This page is not a calendar, pickup queue, or fixed weekly availability form.

Today: absent from route map `you/[page].tsx:19`; the saved spot input is `app/src/you/defaults.tsx:65-67`, handover selector 64 and 106. Existing individual `/item/:id/pickup` owns buyer/time approval and safety context. §6.16's windows are stale against the explicit no-fixed-windows decision. Move saved place here, leave a disclosure in Defaults if needed. Do not place appointment records here just to fill the page.

Redesign: Nav/heading; Section/ListRow “Meeting place” with saved label or Not set, disclosure to short place form; ListRow “Pickup approval” with read-only “Every buyer”, honoring the later approval decision; a noninteractive “Pickup times” value “Chosen per buyer” only if people would otherwise expect standing hours. No separate safety paragraph. The saved meeting place is focal content. Place Sheet uses Blank/Guess with visible label, saved public place suggested first, Approve Save place, Remove place, Cancel. No maps unless a real existing map part is found; a named address/text form fits the current kit, so a map is not required. Home address is not sent by saving a preference.

States: first load Loading pickup preferences; loaded saved place; empty Not set with Add place; partial missing place detail preserves stored label and Retry, cannot imply a safe verified location; loading more absent; refresh no pull, preferences re-read on entry/save; offline edits remain local and marked pending, no buyer receives them; failure retains old saved place and editable attempted value; shared scrolling/re-tap/Reduce Motion. Keyboard plain text/address in Sheet, Return ends editing, Approve saves. Existing live appointment continues if a saved default changes. Cold Back You. D applies; current appointment actions/deep links belong to the other lane's pickup Sheet.

Copy: `defaults.tsx:65-67` “Pickup spot” -> “Meeting place” consistently with pickup lane; “A public place” is an input hint only while empty, not permanent policy copy; do not add “Your address is never shared automatically” caption, show consequence at Share address. Any Ask each time default comes from stored policy, not an agent-invented reset.

### Planned features

Sources: pages §6.16/§7 sold; sold/messages pickup capabilities; decision `product/decisions.md:17-18` supersedes fixed recurring windows.

| ID | Planned capability | Coverage after this audit |
|---|---|---|
| P01 | Saved public meeting place, edit/remove, and asking for pickup approval each time | In redesign: S > Meeting place form and read-only Every buyer approval. The older ask_every_time toggle must not disable the later mandatory buyer/time approval. Add handover preference here only as a pickup default, with its current value; no buyer commitment changes merely by saving. |
| P02 | Per-buyer days/time spans, approve actual buyer/time/place, no calendar read | Elsewhere: individual Pickup Sheet via Thread/Item; days and spans are for that buyer, never standing hours here. |
| P03 | Separate home-address consent, safety context and buyer trust before agreement | Elsewhere: individual Pickup/address approval. Added: final ListRow “Pickup arrangements” goes to the relevant Appointment list if any, with each row opening its existing Pickup Sheet; it does not embed a calendar in preferences. |
| P04 | Apple/Google Calendar write only, running late/on my way, no-show/rebook/next buyer and Share my plan | Elsewhere: individual Pickup Sheet, reached by the arrangements doorway; each outward message/calendar/share is explicit. |

### Left to wire

| Redesigned part | Runs on today, observed code | Required feed, caller and unobservable live states |
|---|---|---|
| Preferences page/meeting place | Page absent at `app/src/app/you/[page].tsx:19`; `app/src/you/defaults.tsx:36-37` initializes demo handover/spot, `:65-67` only local/log edit. | **S** GET/PUT /v1/limits `{version,saved_spot,handover}`; legacy ask_every_time is not an authority to auto-book times; proposed `app/src/you/pickups.tsx` with shared You client. Server accepts those fields (`app/src/edge/api/rules.ts:42-55`), but no screen uses it. Real loading/empty-place/write error/conflict/offline persistence are unwired. **N** nullable/removal semantics for saved_spot: current validator requires an object, not null (`:44`). |
| Arrangements doorway and safety/calendar actions | Current Defaults handover Sheet only changes local choice (`defaults.tsx:106`); existing specific pickup page reads fixture appointment (`app/src/app/item/[id]/pickup.tsx:50-54`). | **S** GET /v1/appointments, GET orders, decision act for book_pickup/share_address, job events. Caller preference index reads, existing item pickup owns actions. Endpoint appointments is still an example (`app/src/edge/api/orders.ts:24`); local previews do not establish live proposed/booked/no_show/error/empty. Calendar/share provider actions and their permission/cancel result must be wired in pickup lane, no calendar-read endpoint. |

## 10. Notifications

Purpose: choose which events interrupt the person and when, then change one event's delivery. Settings, S. Occasional owner; highest-cost error is implying a disabled push means the in-app decision disappeared. No account linking, sales analytics, or live notification feed.

Today: `app/src/you/notifications.tsx:49-60` heading, Right away and Summary switches with example per kind; 63-65 Never sent plus adaptation caption; 68-74 Grouping; 76-90 quiet hours; 92-100 lock-screen action-policy rows and preview toggle. Keep kinds, current modes, useful examples, grouping, hours, preview consequence. Two separate on/off lists cannot let a person move a kind between Push now and Batch as §6.16 requires. Lock-screen authentication facts at 94-96 are not preferences: move behind a “Lock screen” detail disclosure, not three always-visible teaching rows.

Redesign: Nav/heading; conditional system permission ListRow, with Open Settings only when denied; one Section/ListRow per event kind with current Push now / Summary / Off value; row opens Sheet with Choices and a real example for that kind. One unambiguous delivery value per event is the focal content. Retain spec/notifications.md silent kinds as noninteractive Off/in-app facts when needed to explain scope; do not enable likes/followers pushes. Then Section “Timing” with Quiet hours Switch, hours disclosure if enabled, and actual Summary times value; Section “Privacy” with Group by item Switch and Message previews Switch, with consequence only when enabling private previews. Lock screen policy details behind one disclosure. No permanent paragraph under every row.

States: first load Loading notification settings; loaded shows all kinds, never empty because preferences exist before any sale; first-use defaults are actual stored/default policy; partial unknown delivery shows Unavailable and local Retry, no enabled assumption; loading more absent for bounded kinds; refresh no pull, reread OS authorization on foreground; offline preference changes pending without pretending OS permission changed; failed write rolls back control, retains desired value for Retry. Top/down/up/re-tap/Reduce Motion shared. No keyboard main page; quiet times use existing Choice/Choices options or text fields in a Sheet until a shared time-picker exists, with timezone and overnight range validated. Do not silently add custom native picker dependency.

D applies. Event row Sheet commit changes one kind, Cancel preserves value; permission row opens iOS Settings; quiet-time row opens form with Save hours; System Settings return updates state; group/previews toggle saves in place, enabling sensitive previews asks its actual visibility consequence. Summary times follow stored/spec policy, not a new cap. Authentication requirement rows are facts with no switch. Cold Back You.

Copy: 15-28 invented jacket amounts/names are examples only inside the selected event Sheet, visibly “Example” or using actual event content; do not present them as current sales. 59 “At most 3 a day, moved toward when you open the app” moves to Summary detail where that policy matters; 65 adaptive-delivery caption cut until an actual move occurs, then show that move with Undo (rung 1); 70-71 reduce to Group by item, example in detail (rung 2); 79 retain the quiet-hours exception at the hours decision, not every row; 94-96 move policy facts; 98 retain “Anyone who sees your phone can read them” at enabling previews because it is a real consequence. Never silently remove required per-kind examples; relocating them keeps them one tap away.

### Planned features

Sources: pages §6.16/§8/§9; insights notification cadence; `spec/notifications.md` event/lock-screen/quiet/fatigue tables; decisions immediate sale and under-ceiling watched match.

| ID | Planned capability | Coverage after this audit |
|---|---|---|
| N01 | Every planned kind with Push now/Summary/Off and one real/labeled example | In redesign: single per-kind current value and mode Sheet, including sale/offer/deadline/pickup/claim/delist/watch/message/draft/money/relink. Silent likes/views/promotions stay silent. |
| N02 | Decided sale and under-ceiling watched match notify immediately; real deadline/approved pickup urgency | In redesign: defaults follow decision/spec, not a new unrequested cap. Page changes delivery, never hides the corresponding Today item. |
| N03 | Digest/group by item, actual summary times, quiet hours and approved-pickup exception | In redesign: timing/grouping rows; Added: ignored-kind delivery adaptation appears only when it occurs, with Undo and exact changed mode, not permanent teaching copy. |
| N04 | System authorization, push token, private previews and actual lock-screen authentication rules | In redesign: permission row, previews confirmation, policy detail; implementation must enforce authentication rather than merely label Face ID. |
| N05 | Deep links and stale notification action checks reuse the same decision | Added: every interactive push carries canonical kind/decision/item/path and version context; tapping opens actual subject, validates stale action, and returns through its real parent. No second offer policy on lock screen. |
| N06 | Pause selling suppresses seller alerts except open sold-order duties | Elsewhere: Automation pause operation and delivery worker; Notifications shows its actual paused state with a disclosure to Automation, never a second pause store. |

### Left to wire

| Redesigned part | Runs on today, observed code | Required feed, caller and unobservable live states |
|---|---|---|
| Kinds/examples/mode persistence | `app/src/you/notifications.tsx:14-30` hardcodes examples; demo user prefs at `:33-35`; toggles only local/log at `:40-44`. | **P8→S** GET /v1/me and PATCH /v1/me `{version,notification_pref}`; intended current Notifications module + shared You client. Server supports versioned prefs (`app/src/edge/api/me.ts:19`, `:54-77`); wire actual push/batch/off/rollback/stale/offline and stored default states. Examples must be labeled, not live balances. |
| Grouping/hours/summary/previews | Initial values local at `notifications.tsx:36-39`; summary fixed at `:59`; hours edits local at `:84-86`; preview toggle at `:97-99`. | **N** add versioned quiet-hours/grouping/preview/summary fields, using the already-supported timezone to the agreed me/limits schema: current PATCH writable field set omits them (`app/src/edge/api/me.ts:16-20`). Same caller. No actual server schedule/adaptation/undo/failure states until delivery worker and schema are integrated. No fake fields that PATCH silently ignores. |
| OS permission/token and notification navigation/actions | Current page supplies only preference UI (`notifications.tsx:47-102`); Face ID rows are text at `:94-96`, not authentication code. | **P8→S** PATCH me push_token plus platform authorization/registration; push payload path fields from pages §8, GET decision and POST decision act with stale checks. Intended Notifications module + shared session/push runtime (proposed). Permission denied, registration failed, background/terminated deep link, system unlock cancellation and stale-offer states need actual wiring. |
| Retry | PageStatus Retry only clears query state (`app/src/you/page-status.tsx:14`). | Re-read me/retry specific versioned write. A successful local flip today does not demonstrate notification delivery. |

## 11. Your style

Purpose: inspect and correct what the app learned about the person's taste, then edit or remove one learned preference. Personalization settings, S. Buyer/owner visits after a poor recommendation; highest-cost mistake is deleting learning they meant only to correct or inferring consent to experiments. Not listing defaults, body measurements editor, or shopping recommendations feed.

Today: no page or content implementation in `app/src/app/you/[page].tsx:19`; Defaults 83-87 controls reply voice and units, which are explicit defaults rather than learned taste. Do not rename Defaults Your style. No current style strings to cut.

Redesign: Nav/heading; Section/ListRow for each learned preference, readable value, one short source reason where necessary for trust, disclosure to its preference detail. Each detail shows the exact learned statement, supporting items as ItemCard or outside listings as MatchCard, and Edit/Remove preference secondary actions. First preference is focal, no algorithm score or fake certainty. A final ListRow “Clear learned style” opens a consequence/confirmation Sheet. Use Guess/Blank plus Approve “Save preference” for editing; removing a preference updates the list with UndoToast if backend reversal is supported. Clear all needs confirmation; it does not delete purchases or saved items. Learned versus explicitly set remains distinguishable by plain source label, not color alone.

States: first load Loading style; loaded one/typical/dense same rows; empty “No learned preferences” with “Open Buy”, no made-up onboarding quiz; partial preserve verified preferences and omit unsupported inference with local Retry; loading more if paged learned entries, stable keys; refresh no gesture, re-read on entry and local Retry; offline cached preference edits pending, destructive clear awaits connection/confirmation; error preserve old value and draft; shared top/down/up/re-tap/Reduce Motion; keyboard only in edit Sheet, plain text, full statement remains visible. A learning job started says Updating style in its slot, running preserves existing values, arrived replaces affected value, failed offers Retry without clearing profile. Cold Back You; child Back Your style; D applies.

Copy: new rows use the preference itself, not “Personalized for you” or “We learned your unique taste”. Keep source reason when the preference would otherwise be inexplicable. Existing `defaults.tsx:85` “Learned from messages you sent” remains specific to reply voice, not evidence for shopping taste. Experiments consent remains an explicit separate Automation setting.

### Planned features

Sources: pages §6.16; buy §Your style profile; insights; data owner edits/consent; current canon me/style despite stale pages parenthetical.

| ID | Planned capability | Coverage after this audit |
|---|---|---|
| Y01 | Learned traits from sell/keep/save/follow/buy, with why and source count | Added: ListRow detail shows the specific reason and count; preference detail shows supporting records, not inferred certainty percentages. |
| Y02 | Edit/remove/clear learned preferences and inspect real sources | In redesign: preference detail and clear confirmation; source items/listings remain intact. |
| Y03 | Pin owner-set trait so learning cannot overwrite it; removed trait not relearned without new visible signal | Added: preference detail has Switch “Keep this preference”; save sets edited/pinned. Removed trait keeps a tombstone and only new visible supporting behavior may propose it again. No repeated silent resurrection. |
| Y04 | Opt-in For you recommendations, own-item exclusion, fit and Buy-related actions | Elsewhere: Buy/Want and their personalization opt-in, with Your style link; this page edits learned preference data rather than becoming a product feed. |

### Left to wire

| Redesigned part | Runs on today, observed code | Required feed, caller and unobservable live states |
|---|---|---|
| Page/list/detail/source | No style route in `app/src/app/you/[page].tsx:19-28`; World only declares style field at `app/src/demo/world.ts:14`, with no style page rendering it. | **P8→S** GET/PATCH /v1/me/style, now canonical; proposed `app/src/you/style.tsx` and versioned client. Backend facet read/write exists at `app/src/edge/api/me.ts:134-151`, route bindings `app/src/edge/api/me.ts:163-164`. Its default profile is seeded traits, not demonstrated personal learning (`app/src/edge/auth.ts:45-48`, `app/src/edge/auth.ts:58`, `app/src/edge/auth.ts:72`). **N** source-count/reason/evidence projection if missing from that response. Nothing yet renders real first load/empty/partial/failed/profile-conflict/offline or learning job states. |
| Edit/pin/remove/clear | No controls exist in the allowed page map (`you/[page].tsx:19`). Server supports pinned/remove, version check, and removed_at at `app/src/edge/api/me.ts:137-150`. | Same specced PATCH; clear sends removals of actual current facets, no undocumented clear endpoint. Owner correction can remove old facet and add edited value in one versioned write. Learning must honor tombstones/pins; re-read for conflict and Undo. Every proposed control is currently nothing yet in the UI, not a dead callback pretending success. |

## 12. Records and tax

Purpose: inspect the year's sales record, then export that record. Records, L with FootButton. Occasional owner/reseller; missing cost must not become zero profit or tax advice. It contains records, not goal progress, market value, or connection management.

Today: `app/src/you/records.tsx:34-37` heading, status, export foot; 40-47 year and sold/fees/costs/kept totals; 48-57 sales rows; 60 empty copy. Keep this coherent subject. Current rows at 54 use only site logos instead of item photos, and footer says Downloaded after a phone action that does not export: code 23-28 only downloads on web, but 29-30 always claims completion. This is an honesty defect, not a copy-only issue. PDF is newly requested in pages §8 and is now in the canon, `spec/product.md` §7; retain it as a pending export format, without claiming the phone already produces one.

Redesign: Nav/heading “Records and tax”; Choice year selector from real available years; Section/ListRow totals for Sold for, Fees and shipping, Known costs with coverage, You get. No zero cost substituted for unknown. Sale Section uses ItemCard per sale for photo/title/net amount, with Meta date/fee/cost facts immediately beneath; source/receipt detail opens through that row's item or WhySheet. This remains a sales record, not a second owned-item valuation page. FootButton “Export records” is the one thing that stands out; its format Sheet offers CSV and PDF, each reflecting actual availability. It opens the native share sheet only when a file actually exists. No permanent tax assurance paragraph.

States: first load Loading records; loaded one/typical/dense show true coverage and year; empty “No sales this year” with Choose year if history exists, otherwise Open Sell, no export act for empty data; partial keeps sales and explicitly incomplete totals/coverage, export identifies included records and does not imply completeness; loading more appends sales but export uses full selected-year data, not only visible page; refresh yes for new receipts, same year; offline cached selected-year export permitted only if complete cache is known, otherwise waiting, not silently partial; read error Retry same year. Export started shows Preparing file on act, running can leave, arrived opens system share sheet on explicit return/tap if person left, failed shows Retry. Never opens system UI unexpectedly over another screen. Shared scroll/re-tap/Reduce Motion; no keyboard. D applies; Cancel share produces no Downloaded state, successful file preparation does not prove a recipient saved it. Cold Back You.

Copy: 35 “Download CSV” -> “Export records” with CSV/PDF choices, “Downloaded” cut as a persistent button replacement; 42 “Sold, N sales” -> “Sold for” with count secondary; 44 “What you paid, for N of them” -> “Known costs” plus actual coverage; 45 “Kept” -> “You get”; 53 keep date/fees/known cost labels; 60 “ready for tax time” cut, it is an unsupported assurance and unnecessary (rung 1). Keep the title requested by §6.16 without promising tax calculation.

### Planned features

Sources: pages §6.16 Records/§8 PDF; insights §records/P&L/guarded numbers; sold year-end; data citations/export. PDF is P8→S in current canon, not deleted scope. Do not hard-code tax thresholds from the feature prose; display the dated stored source.

| ID | Planned capability | Coverage after this audit |
|---|---|---|
| F01 | Year's sales/fees/shipping/known costs/net, each sale with evidence; per-site and total | In redesign: added site filter Sheet and per-site summary disclosure, actual year/period retained. |
| F02 | Cost basis/gain or loss only where known, source api/csv/typed/estimated and coverage | Added: totals and receipt WhySheet show cost coverage, gain/loss only for that subset, estimate labels and source dates. Unknown cost stays unknown. |
| F03 | Period P&L with fee types, shipping, tax, refund, payout and promotion spend | Added: ListRow “Financial report” -> `/you/records/report?period=&site=`. L page has same source money lines and export, not forecasts or goals. |
| F04 | Full selected-year CSV and PDF, not only visible page; native share and honest completion | Added: Export records -> Choices CSV/PDF -> real file/share job. CSV remains available if PDF fails independently; never simulate phone download. |
| F05 | Optional person-supplied per-site 1099-K beside own sales figure, dated sourced tax-form explanation | Added: ListRow “Tax forms” -> `/you/records/tax-forms?year=`. ListRow per site compares supplied gross with recorded gross; Guess/Blank plus Approve saves only volunteered form figure; WhySheet shows stored explanation/source/date. It never declares this person's tax liability. |
| F06 | All-time sold summary and source drilldown | Added: Records accepts `period=all` for a sold-summary view, separate from a tax-year export; year selector remains the default. No sum of owned value and sales. |
| F07 | Shipping labels, payout confirmation, returns/disputes and individual order actions | Elsewhere: Item/order/Ship/Pickup sheets and Payouts; source receipt links there without adding order-operation controls to the records list. |

Receipt/detail and financial/tax child pages inherit L states. Their primary act is inspect/export that record; supplied tax-form figure is a one-form Sheet. Source failure leaves money hidden or marked incomplete. No legal/tax recommendation is added by this specification.

### Left to wire

| Redesigned part | Runs on today, observed code | Required feed, caller and unobservable live states |
|---|---|---|
| Ledger/year/totals/site and receipt rows | `app/src/you/records.tsx:12-16` calls demo records; `app/src/demo/world.ts:141-144` filters current fixture year. Rows only navigate item at `records.tsx:54`. | **S** GET /v1/records?tax_year=&format=csv and GET /v1/insights pnl + citations, orders/item joins; caller current Records plus proposed report/tax children under `app/src/you`. **N** structured receipt rows/period=all/source money-line projections if binary export endpoint cannot provide them. Feed handlers currently return example formats (`app/src/edge/api/records.ts:6`). Real selected-year empty/loading/partial/error/known-cost coverage cannot show until wired. |
| Export CSV/PDF | CSV string generated locally at `records.tsx:20-22`; web-only anchor at `:23-28`; unconditional downloaded flag at `:29-30`. Phone button currently does no file export. | **S/P8→S** GET records format=csv\|pdf, full-year read; actual artifact preparation/storage and native share in Records. Wire preparing/failed/cancelled/returned/result states. Backend route supports examples, not a demonstrated report engine. **N** asynchronous job/artifact delivery contract only if the report cannot return a file directly; do not invent one as already specced. |
| Tax forms/source counts and financial detail | None in current Records body `records.tsx:40-60`; current route map has no tax child (`app/src/app/you/[page].tsx:19`). | **S** insights pnl and citation reads; **N** saved 1099-K input write and structured report projection. Proposed POST /v1/records/tax-forms `{tax_year,site,reported_gross,version}` requires agreement, not silently PATCHing an order. Data-source unavailable/estimated/mismatch/save conflict states need wiring. |

## 13. Account

Purpose: manage sign-in and the person's secondhand data, then choose the account action they came for. Identity/data settings, S. Rare use; deletion and sign-out consequences matter most. Not Accounts connections, app defaults, notification settings, or operational pause controls.

Today: `app/src/you/settings.tsx:31-40` title and Pause selling/return date; 43-47 other settings index; 49-55 actual sign-in/export/sign-out/delete; 59-74 confirmations. Move pause to Automation, notifications to its own You row, defaults/permissions to their existing settings family. Keep only account group and its confirmations. `settings.tsx:1-3` describing a general settings index is stale against this requested separation. Actual methods can be multiple; do not collapse them to a single unspecified provider.

Redesign: Nav/heading “Account”; Section/ListRow each linked sign-in method and disclosure “Add sign-in method”; then ListRow “Export your data”; final Section with secondary Sign out and Delete account rows, each opens Sheet. No primary black deletion or permanent sticky footer. Current sign-in method is the focal content until the person opens an action. Add-method Sheet uses existing supported provider choices and email-code sign-in flow, returning here without creating a second account; no invented provider integration. Export preparation appears at its row with later Share file act. Delete confirmation contains precise consequences, open-order blocker, and explicit Cancel; final destructive confirm uses a shared destructive treatment gap below, never a black recommended act.

States: first load Loading account; loaded all linked methods; empty is not a valid authenticated profile, expired session shows Sign in with return destination, local drafts kept; partial missing methods says Unavailable rather than no methods; loading more absent; refresh no gesture, revalidate session and blockers on foreground and before action; offline read cached identity, export/delete waits, sign-out can clear local access but must distinguish pending server revocation if required; error keeps session and shows action-local Retry. Export/deletion jobs started/running/arrived/failed remain truthful: preparation is not a download, deletion requested is not account deleted. Once confirmed deleted/sign-out complete, replace authenticated navigation with sign-in entry; Back cannot recover authenticated content. Shared scroll/re-tap/Reduce Motion; provider/email fields own keyboard, no main-page keyboard. Cold Back You before session exit; D applies.

Controls: method row opens method detail, Add opens existing sign-in flow with link intent; Sign out Sheet keeps the current real consequence at 60 and Approve, then resets session navigation; Delete Sheet rechecks openSales, shows affected orders as item disclosures if blocked; otherwise confirms actual deletion policy. Do not copy “Ends your listings first” without integration guaranteeing that ordering. Cancel/back leaves account intact and retains form. Export row starts explicit export, then Share file; failed export can retry without signing out.

Copy: title Settings -> Account; 38 pause explanation moves with its controls; 45-46 descriptive index captions cut when rows relocate (rung 2); 51 “Signed in with” becomes a sign-in methods group, actual provider names retained; 60 sign-out consequence stays; 66 keep real blocker and path to those sales; 69 keep actual data/site retention consequence only as implemented; 70 long “Delete and end N listings” needs separate consequence text and short “Delete account” action, destructive styling. Do not shorten away irreversible consequences.

### Planned features

Sources: pages §6.16 Account/§8 auth; connect §Signing in; data exports/deletion/consent; decisions no public profile.

| ID | Planned capability | Coverage after this audit |
|---|---|---|
| C01 | Actual Apple/Google/email linked methods, add a second method without a second account | In redesign: method rows and add-method link-intent provider flow. |
| C02 | Authenticated session, refresh/revoke/sign out, return to correct protected route | In redesign: Sign out confirmation and replace session navigation, no Back into protected data. |
| C03 | Export all the person's data, status, real result access, failure/retry and retention clarity | Added: export row becomes Open export after completed job; it opens artifact/share, not a forever Preparing flag. Job and result survive page exit. |
| C04 | Delete user data across stores/sessions/secrets, open-sale blocker and honest remaining-store failure | In redesign: confirmation/blocker and Job status; do not claim request=purged or invent live-listing delist sequencing. |
| C05 | Inspect/clear learned data and shared-training permission | Added: ListRow “Data use” -> `/you/account/data-use`, existing style inspection via Your style; separate explicit training-consent choice, defaults off. Export/delete remain Account, not Automation. |
| C06 | Marketplace linking, operational pause/defaults/notification choices | Elsewhere: Accounts, Automation/App defaults, Notifications. This page has no selling or service-link toggles. |

### Left to wire

| Redesigned part | Runs on today, observed code | Required feed, caller and unobservable live states |
|---|---|---|
| Methods/session/add method | Demo auth methods shown at `app/src/you/settings.tsx:51`; shared sign-in fakes success via timer at `app/src/you/sign-in.tsx:28-37`. | **P8→S** GET /v1/me, POST auth/{apple,google,email/start,email/verify,refresh,signout}, POST auth/link/{apple,google,email}; intended `app/src/you` session client and secure storage, current Account renderer. Auth handlers exist separately (`app/src/edge/api/auth.ts:32-40`); default store is memory (`app/src/edge/auth.ts:249-250`). True expired/refreshed/denied/cancelled/link-conflict/session-restored states remain unwired. |
| Export/deletion/sign-out | Export at `settings.tsx:52` sets local flag/log only; sign-out at `:61` logs and pushes onboarding; delete at `:70-71` only sets working/logs. | **S** POST /v1/me/export, DELETE /v1/me; **P8→S** signout; GET jobs/events for result. Caller Account client. Server export gathers result at `app/src/edge/api/me.ts:127-132`; deletion needs workspace port at `:95-125`, no proven live listing termination there. Wire real blocker, jobs, per-store failures, result artifact retrieval/share, session clearing and retry. Export currently gathers runtime store rows only (`app/src/edge/api/me.ts:127-130`, `app/src/edge/events/ports.ts:139-145`), while user/preferences/identity/style live in separate auth maps (`app/src/edge/auth.ts:51-53`). Deletion calls dropUserSessions (`app/src/edge/api/me.ts:93`), but AuthStore has no user/identity/style purge operation (`app/src/edge/auth.ts:25-42`). Extend cross-store export/purge before claiming all personal data exported/deleted; UI wiring alone is insufficient. These current controls have visual effects but do not perform their named account action. |
| Data use/style/training consent | Absent in current Account list (`settings.tsx:49-55`). | **S** GET/PATCH me/style and explicit experiments consent are separate; **N** shared-training consent and data-use projection/write on me once agreed. Proposed data-use module under `app/src/you` calls that contract, not experiment consent. Loading/error/no learned data/revocation/save conflict need wiring. |

## 14. Ask

Purpose: answer a question about the person's sales from their records, then open the supporting record or refine the question. Question/answer Page, L with input. Occasional seller; false numeric answers and answers without evidence are the costly mistakes. Not a general AI chatbot, account settings, or another analytics dashboard.

Today: absent in `you/[page].tsx:19`; no Genie question UI to assess or strings to cut. Do not substitute a canned dashboard or reuse SearchField's marketplace semantics. The six fixed questions in `spec/features/insights.md` §Questions precede the free question field, using Choice rows. They are shortcuts to records-backed answers, not invented suggestions. `POST /v1/genie` is the specified feed; answer evidence must be available before a money answer is trusted.

Redesign: Nav/heading “Ask”; Blank labeled “Question about sales” and Approve “Ask question” as one submitted form, not marketplace camera search; after submission retain the question as Txt and allow Edit question secondary Pill. A result Stack holds one direct answer, named period/units, and ListRow “Source records” disclosure to a filtered Records Page or WhySheet with actual citations. One result is focal; no animated counters, avatar, greeting, prefilled invented prompt, or suggested question carousel. Follow-up reuses the same input and carries current question context explicitly. No chat bubbles implying a human counterpart. The answer includes a Choice “Query and rows”, opening its actual query, rows, definitions and computation time; fixed-only tax and forecast questions link to their record pages instead of being answered freely. If tool returns additional dimensions, put their rows under the answer only when they answer this same question.

States: first load shows form immediately, no network call before a question; loaded question/result/source; empty no question is blank form, no data answer is “No sales match” plus Edit question; partial answer must identify missing data and cannot display a precise total as complete; loading more absent for one answer, source records paginate in their own view; refresh no pull, Ask again explicitly reruns the same question; offline save typed question, existing cited answer remains timestamped, Ask waits for connection; error “Answer didn't load” plus Retry and Edit question, preserving text. Job started places question and “Checking sales” immediately, running shows actual steps only if reported, arrived fills answer in place, failure leaves retry there; leaving does not erase the question/job. Shared scroll/re-tap/Reduce Motion; keyboard plain text, Return newline if multiline, Ask question is explicit submission, no typing haptic. Cold Back You; D applies.

Source row opens records/WhySheet and returns to this answer, not a reset Ask form. Edit returns field focus with exact previous text. Ask again is secondary, no extra authority to change a listing or call a write tool. Unsupported questions give one plain scope reason and retain editable question, not invented advice.

### Planned features

Sources: pages §6.16 Ask/§7 insights/data; insights §Questions in plain language; market question scope; data guarded_query. Canonical endpoint is Genie; data's proposed /v1/ask alias is not used.

| ID | Planned capability | Coverage after this audit |
|---|---|---|
| K01 | Fixed questions first: month net, fastest site, worth, why unsold, fees, goal progress | Added: six plain Choice rows above free Question field, directly from insights, no invented suggestion carousel. Choice runs the fixed guarded metric or opens the focused page/subject picker required to answer it. |
| K02 | Free question over this user's sales/items and permitted anonymous market facts, full-user only | In redesign: Blank + Ask question; Added: unsigned entry goes sign-in then restores exact question, no cross-user Genie space. |
| K03 | Guarded answer, source rows, actual SQL/query, period/units/freshness and definition | Added: answer evidence contains Query and rows disclosure, actual SQL in selectable Txt, rows in ListRow/ItemCard, source time, and reason hidden when basis fails. No SQL text needs running on the phone. |
| K04 | AI-generated result caution and failed/unsupported/partial response with editable question | Added: “AI-generated. Check the rows.” at free-answer evidence, not as a permanent greeting. No answer without supported basis; fixed questions remain available when Genie fails. |
| K05 | Tax/P&L/forecast/reliability fixed-only subjects and actionable listing fixes | Elsewhere: Records report/tax forms, dedicated sell-down/reliability pages, or Item/Plan. Ask links the relevant subject; Genie cannot become an unbounded tax/forecast/action tool. |

### Left to wire

| Redesigned part | Runs on today, observed code | Required feed, caller and unobservable live states |
|---|---|---|
| Page/fixed questions/free field/result | No Ask route in `app/src/app/you/[page].tsx:19-28`. No rendering or submit callback exists there. | **S** POST /v1/genie plus GET /v1/insights/citations for fixed metrics; proposed `app/src/you/ask.tsx` and guarded answer client. All controls/data are nothing yet. Backend Genie defaults to known stored question/SQL/answer (`app/src/edge/api/genie.ts:15-41`) and verifies basis at `:58-69`; supply real per-user Genie connection and proof snapshot, not just a UI request. |
| Source/query/rows and result lifecycle | No Ask page at route dispatch cited above; backend returns answer/sql/rows/citation at `app/src/edge/api/genie.ts:69`. | **S** GET /v1/citations/:id and fixed subject route reads; **N** async Genie job return if background resumability is required, since current handler directly returns 200 (`:69`). Caller proposed Ask. Real loading/timeout/empty-basis/partial/error/unauthenticated/offline/job-return cannot show until the page and service are integrated. Free answers must not borrow an unrelated fixture citation. |

## 15. One site's connection

Purpose: inspect what this connection can see and do and repair it when needed, then open the affected site record or relink. Linking/connection inspection, L. Seller arrives from Accounts or an error; worst error is trusting a stale read after a failed outward operation. This is the operational evidence for a connection, never sales-performance analytics.

Today: route `app/src/app/you/connections/[site].tsx:3` exports SitePage. `app/src/you/site.tsx:36-45` shows connection state and Link/Retry, but no explicit page title; 47-51 mismatches; 53-65 read counts; 67-69 action history; 71-73 externally changed history; fixed Unlink foot at 38-39. Keep connection health, mismatches, readback evidence and capability boundaries. Unlink is not the page's promoted primary next act. Counting listings/threads/sales at 57-59 does not satisfy inspection of the actual records in ways-out §6.16. Expand a selected category rather than stacking full logs plus counts on this page.

Redesign: Nav/heading “Connection”, site logo with accessible site name; one ListRow of health/last check and Relink when needed; capability facts as Section/ListRow for read/post/reply/end, from actual adapter, not a blanket promise. Mismatch Notice, if any, is the one thing that stands out and opens a pushed filtered mismatch Page. Then disclosure ListRows Listings, Messages, Sales, Activity, Changed on site, with counts only when known, each opens its site's filtered records using L. Category results show actual item/listing price/state, message preview, offer/order identity, source time and Open on site. Activity details show action and site readback together. Final secondary Unlink row opens a consequence Sheet; it is not pinned at the foot. No performance funnel or “best marketplace” recommendations.

States: first load Loading connection, keep known logo; loaded linked health with source time; empty unlinked still offers Link and preserves historical records, no false “Unlinking left your listings up” for a site never linked; partial individual read/check unavailable keeps last successful data with date and Retry; loading more applies in the category/history children, parent is bounded; refresh yes for a new read/check, no re-execution of past writes; offline cached audits visibly old, cannot claim live site match, linking/unlinking waits; error local to check/readback/sign-in, fresh Retry and external site escape. Invalid site has Connection unavailable + Back to Accounts, not an unlabeled Not found. Link job follows Accounts four moments. A repair job started/running keeps prior evidence, arrived replaces it with readback, failed preserves discrepancy and Retry. Shared top/down/up/re-tap/Reduce Motion; keyboard provider only. Cold Back `/you/connections`, children return to this site's page. D applies.

Controls: health Relink uses the same consent/provider flow as Accounts; category row pushes a subject-filtered Page, not an inline expanding table; record row pushes item/thread, source opens actual site URL; mismatch opens a detail with both records and Retry check/Open on site, does not silently apply either record. Unlink confirmation says what stops and whether listings remain; no automatic delisting unless separately approved. Undo only when reconnect can truly restore the previous authority/session, otherwise confirmation with later Link, no fake 5-second reversal.

Copy: `site.tsx:27` Not found -> Connection unavailable with Back to Accounts; 43 “Checked just now” only if known, otherwise “Not checked”; same line's “Unlinking left your listings up” -> Not linked for an unlinked state, actual unlink consequence stays in confirmation; 44 Try again -> Retry; 48 “Doesn’t match” -> “Records differ”; 53 “What we read” -> disclosure labels for actual categories; 67 “What we did” -> “Activity”; 68 explanatory empty paragraph cut, child EmptyState “No actions recorded”; 71 “Changed there, not by us” -> “Changed on site”; 72 “Nothing since the last check” belongs only in the opened filtered history if supported. `mismatch-row.tsx:16` Open on the site -> Open on site. Never erase the readback or outside-change distinction while shortening its heading.

### Planned features

Sources: pages §6.16 Accounts/§7 connect; connect import/session lifecycle; data evidence; ways-out §6.16 audit; message/offer/order reads.

| ID | Planned capability | Coverage after this audit |
|---|---|---|
| S01 | Health/capabilities/risk/last successful check, actual available verbs versus site handoff | In redesign: health/capability blocks; Added: retain one real account-risk consequence when active, not only during initial consent, because ongoing paused risk can affect next action. |
| S02 | Actual latest listings/prices/states, open offers, messages and orders, each source time/URL | Added: explicit “Offers” disclosure -> `/you/connections/:site/offers`, not hidden only in Messages; listing detail links its open offers and order. All category rows inspect records, no analytics metrics. |
| S03 | Actions with readback evidence, mismatches first, changes not made by us and Open on site | In redesign: category/detail pages and SiteCopy/Why where available; absence of a mismatch is not proof a write succeeded. |
| S04 | Relink/pause/site-warning repair, unlink stopping actions with retained history and correct undo limit | In redesign: shared account flows; no insecure credential restoration by a timer. |
| S05 | Listing/purchase import preview, duplicate merge review and optional password-secret lifecycle | Added: “Import found items” row -> import Page; “Saved sign-in” row opens consent/removal detail when supported. Account preference is never a password text field. |
| S06 | Site sales performance and provider-source developer routing metrics | Elsewhere: By site analytics and developer source-health screen respectively; only actual source line appears here for connection evidence. |
| S07 | Site-changed fields expose Keep site's / Put mine back with before/after evidence | Added: mismatch detail opens that actual site_changed_listing DecisionCard, including source field/version and confirmation/readback. A comparison page never unconditionally overwrites either copy. |
| S08 | Successful direct/browser fallback remains quiet; unknown writes reconcile before retry | Added: Activity distinguishes confirmed source, direct/browser route when useful, and postUnknown/reconcile. Harmless fallback does not mark health broken. Retry keeps operation identity and checks site before any repeated write; live browser view appears only for a real browser job. |

### Left to wire

| Redesigned part | Runs on today, observed code | Required feed, caller and unobservable live states |
|---|---|---|
| Health/title/capabilities and category counts | `app/src/you/site.tsx:19-20` uses fixture/useLinks; audit at `:31-34`; counts at `:57-59` are not pressable. Audit counts come from World at `app/src/you/site-audit.ts:69-74`. | **S** GET /v1/accounts, items/listings, conversations, orders, appointments and events; caller `app/src/you/site.tsx` plus proposed site-audit reader. **N** aggregate account-audit projection such as GET /v1/accounts/:id/audit, with per-category record IDs/source/as_of, if canonical reads cannot supply true live offers/readback. Not an existing endpoint. True unloaded/empty category/partial/offline/cursor/read-error and capability unknown remain unwired. |
| Readback, mismatch, source/external record | `app/src/you/site-audit.ts:30-37` infers checked-on-site from fixture events and absence of disagreement; changed list fixture-derived at `:54-65`. Mismatch external open really calls Linking at `app/src/you/mismatch-row.tsx:14-16`. | **S** GET events and citations with evidence.snapshot_ref; GET account state; **N** explicit offers/readback/source projection if not served. Same reader resolves actual source URLs. Wire actual mismatch/unknown-readback/not checked/snapshot failure separately, never infer readback success from no error row. |
| Link/unlink/undo/credential/import | `site.tsx:38-44` calls fake link/unlink; shared fake functions are `app/src/you/state.ts:91-98`; no import/credential control in `site.tsx:41-73`. | **S** POST accounts, DELETE /v1/accounts/:id, import POST and job GET/events; **P8→S** import-preview GET; **N** explicit credential-secret and account-audit contracts as above. Caller shared account reader/mutator and import page. True sign-in pending/OTP/cancel/unlink stop/revoke/import partial/conflict/credential failure states remain unwired. |
| Category/detail route navigation | Current activity rows push Item only (`site.tsx:32`); wrapper just exports page (`app/src/app/you/connections/[site].tsx:3`); no nested category dispatch there. | Add proposed child route map and bind canonical filtered readers. Currently new category/Offers/import/credentials controls have no implementation, not even local callbacks. Shared L scroller/refresh and authentic backing evidence must be wired as well. |

## Proposed child-route contracts

These route names make the disclosure destinations concrete for the later builder. They are proposals, not existing endpoints or permission to create a parallel navigation system. Child pages inherit their parent's scaffold and full shared state contract; the differences below define their one job. Local one-choice Sheets remain local state, with no new route required. Preserve the real caller when present; the cold fallback is the named parent.

| Entry control | Proposed route or local Sheet | One job and return |
|---|---|---|
| Replies to send | `/messages/replies` | Review pending exact replies. Back Messages; after sending the last, show Replies sent and Back to messages, never automatically send or push another subject. |
| By site row | `/you/insights/:site?period=:period` | Inspect the selected site's performance for that period. Back By site, preserving period. Loading/empty/error concern only that site's figures, and Refresh keeps period. |
| Automation action row | `/you/rules/:kind` | Change that kind's authority. Back Automation. The kind is the canon's kind key, not a display label. Missing kind has Action unavailable and Back to Automation. |
| Rule log | `/you/rules/:kind/log` | Inspect outcomes of that rule. Back action detail. Empty No actions recorded; progressive/partial/offline/paging follow L; no settings embedded in the log. |
| Reply settings | `/you/rules/answer_fact?scope=replies` | Inspect reply modes and per-site overrides; the scope also includes other reply kinds and never silently grants their authority from answer_fact. Back actual caller, cold Automation. Preserve legacy `/you/messages` as alias to this subject. |
| Listing defaults | existing `/you/defaults` | Change a new listing's defaults. Back Automation; pickup-place row opens Pickups. Item-specific limits stay on `/item/:id/plan`. Existing `/you/permissions` remains the action-mode family entry/alias, never Account. |
| Style preference | `/you/style/:id` | Inspect and correct one learned preference. Back Your style. Supporting item/listing links return to this preference. Missing preference has Preference unavailable and Back to Your style. |
| Connection category | `/you/connections/:site/:section`, section is `mismatches`, `listings`, `offers`, `messages`, `sales`, `activity`, or `changed` | Inspect only that site/category. Back that connection. Empty names the category; read failures keep cached evidence; progressive history and Refresh follow L. Messages use ThreadRow, listings/sales use ItemCard with source facts, activity/changed use ListRow facts and source disclosures. |
| Ask Source records | `/you/records?answer=:answerId` when supported, otherwise local WhySheet | Inspect cited records for that answer. Retain answer and citations; Back Ask. Never reinterpret the answer text as an executable filter. Without resolvable citations, the answer cannot claim to be evidenced. |
| Site performance groups/reliability/promotion/cohorts/contributors | `/you/insights/:site/groups`, `/reliability`, `/promotion`, `/cohorts`, `/scores` under that same prefix | One analytical question per child, retain period/category/brand filters and source access. Back site-performance Page. |
| More insights | `/you/analysis`, then `/you/analysis/slow`, `/you/analysis/sell-down`, `/you/analysis/changes` | Subject index then one query: slow/ABC groups, stock forecast, or anomalies. Back index then caller. Stale item's move opens Item/decision. |
| Financial report and tax forms | `/you/records/report?period=&site=`, `/you/records/tax-forms?year=` | Inspect one report or compare supplied forms with recorded gross. Back Records with selected period/year/site. |
| Connection import, offers, saved sign-in | `/you/connections/:site/import`, `/you/connections/:site/offers`, `/you/connections/:site/credentials` | Preview/import found items, inspect open offers, or manage optional saved-sign-in secret respectively. Back same connection, or actual Accounts caller. |
| Account data use | `/you/account/data-use` | Inspect data uses and explicit consent, Back Account. No experiment toggle substituted for training permission. |
| Pickup arrangements | `/you/pickups/appointments` | List actual Appointments, each opens existing `/item/:id/pickup`; Back Pickups. No recurring-calendar editor. |
| Account method row | local Sheet, `method=:provider` | Inspect one sign-in method; Done returns Account. Do not offer removal unless the existing auth integration can keep at least one valid sign-in path. |
| Notification event, quiet hours, goal target, meeting place, style edit, mode, counter, sign-out, delete, unlink | local Sheet keyed by subject and operation | Complete that one choice/form, then return to the same object. Cancel does not commit. Shared dirty-form and pending-write rules apply. |

## Shared work and approval boundaries

The following are dependencies for the reconciler and builder, not edits authorized to this agent. Existing pieces may be improved centrally without creating a second set per lane. No proposed file/component below is claimed to exist.

| Need | Existing mechanism and exact gap | Proposal, fallback, affected lanes |
|---|---|---|
| One main-tab and pushed-page header family | Screen/Nav above; `parts/tab-nav.tsx` `TabNav` exists for main pages. Screen's Nav currently scrolls out. | Use the stated current-kit scrolling behavior consistently now. **NEW PATTERN, needs Ben's OK:** shared fixed Back/compact page header and native large-title treatment if desired. No existing pinned/collapsing pushed header fits. Main tabs and every pushed lane must adopt one decision, not each improvise. |
| Growing list/refresh/anchor behavior | Screen contains ScrollView with children, no ref, refreshControl, pagination, or virtualization props. | Shared extension of Screen/list body needs refresh, saved position, anchor preservation and virtualized rows. **NEW PATTERN, needs Ben's OK:** virtualized list scaffold, since no existing part supplies one. Keep named row components. Current-kit Refresh Sheet action works, but not a native pull gesture; large histories remain a performance verification obligation. Do not claim native pull or density tested from this doc. |
| Settings rows at large text sizes | ListRow fixed 56/76; ThreadRow fixed 96; goal text can also overrun. | Shared adaptive accessibility layout for the same row primitive, with value/control wrapping and no overlap. Preserve default sizes; never local height hacks. Rendering at largest text size is required before calling built UI usable. All settings, onboarding, records, and conversations share this. |
| True sheets and keyboard safety | Sheet is custom Modal at content height, no detents/inner scroll/keyboard strategy. RouteSheet has scroll/drag but no detents, and its claimed Reduce Motion crossfade is not implemented by an explicit opacity variant. | Use short Sheet with explicit Done/Cancel as specified, RouteSheet only for long route-backed content. **NEW PATTERN, needs Ben's OK:** common native detented form Sheet, medium/large, with keyboard avoidance, dirty-draft exits, and reduced-motion fade. No current part fits all of those requirements. Shared by Plan, offers, pickup, settings, links. |
| Press/haptic defaults | Press already supplies spring; no haptic in Press/Switch, no shared success/failure dispatcher outside camera-specific helpers. | Implement D centrally with one haptic per causal commit, no navigation haptics. Do not import camera-specific haptics into every page. Earlier frontend press rule wins over vendor no-row-scale advice unless Ben changes it. No new visual pattern required. |
| Destructive confirmations | Pill/Approve/FootButton expose only primary/second, no destructive kind; ListRow brick tone colors failure icon, not destructive confirm. | **NEW PATTERN, needs Ben's OK:** a shared destructive action treatment for final Delete account/Block/Unlink confirmations. Existing primary is the recommended act and cannot honestly represent destruction. Until approved, use the existing secondary confirm with explicit consequence and Cancel, never restyle a screen's private red pill. |
| Fast reply approval | Message/Draft and existing queue logic support exact text; QueueView in `parts/queue.tsx` is price/item approval, not conversation reply approval. | New `/messages/replies` Page composed from existing Message/Draft, preserving confirmed-fact Send all eligibility and per-reply Edit/Take over. A new Page for its separate task is authorized as a design proposal, not a new visual pattern. It replaces the large inline inbox queue only after reconciliation accepts this boundary. Strongest rival: keep it in Messages to preserve 05:18 default entry; if chosen, inbox must be a separate pushed Page and Messages must be titled Replies. Do not pretend both jobs are one sentence. |
| Media in a conversation | Composer has only text/Send; no attachment slot or preview. | **NEW PATTERN, needs Ben's OK:** shared attachment composer/preview for photos/video; no text or image-picker part currently fits review-before-send. Until approved, a visible Take photo can open capture with thread return context, but completion requires this shared review path. Do not ship a dead attachment control. Item/camera/thread lane must agree. |
| Sources and object rows | ItemCard, MatchCard, ThreadRow, ListRow, WhySheet exist. ListRow does not have a photo prop. | Keep these rows throughout lanes; use existing Row/Photo/Choice composition for compact context, not unsupported props. Analytics/source details use WhySheet, readback SiteCopy. Fix cropped logos in ListRow's internal Logo centrally: current circular clipping contradicts unaltered-logo rule. |
| You navigation and legacy settings | You route map lacks requested pages and contains useful extra settings. | You lane provides rows to these distinct subjects. Listing defaults and Permissions remain pushed settings in Automation family; payout/history remain their own queries. Reconcile “You > Messages” from ways-out into Automation > Replies and legacy deep-link alias. No duplicate identity/connection or rule/mode stores. |
| Honest read/write states | `you/page-status.tsx` replaces all content with three notice skeletons and says every failure is “The site didn’t answer. Nothing changed.” | Shared status behavior must follow per-operation cause, exact placeholder shape, retained cache/drafts and pending writes. Do not reuse PageStatus verbatim as evidence of designed states. This affects every You page. |

Feature-audit shared additions: **NEW PATTERN, needs Ben's OK:** extend the shared SearchField/Assist field for live marked spans, required/optional blanks and one anchored fitted picker. GuessPick (`app/src/ui/parts/pick.tsx`, GuessPick), Choices, Chips (`app/src/ui/parts/chips.tsx`, Chips), ChoiceChips (`app/src/ui/parts/choice-chips.tsx`, ChoiceChips), SizePicker (`app/src/ui/parts/size-picker.tsx`, SizePicker), and Blank/Guess supply fitted controls, but current SearchField does not expose spans. Search and Thread must share signed span IDs/owner-edit state with Want/Capture rather than invent independent parsing. **NEW PATTERN, needs Ben's OK:** extend MatchCard's site/source presentation for official stores and non-marketplace terms; its current site type is the five-marketplace Site (`app/src/ui/parts/match.tsx:48-61`), so do not pass a maker as an invented eBay logo. A shared official-offer variant must keep photo, total, match and disclosure geometry. Until these are built, the planned capability remains designed but not usable UI.

The small shared-list and settings compositions above need no new color, font, radius, section container, row shell, or empty illustration. No new chart is required for this lane. Native time/date pickers could improve form ergonomics, but use existing labeled fields/Choices until a shared picker is approved; do not misrepresent them as already installed parts.

## Acceptance walks for the builder and reconciler

These walks are checks to run against the implementation, not passing test results.

1. Today > Messages > filter an item > Thread > item > Back twice. Same query and inbox row remain. Approve replies doorway covers exact draft, edit, own reply, eligible batch, and failure without losing text. Verify both candidate queue boundaries against the 05:18 requirement before selecting one.
2. Thread: receive while at newest, while reading history, while editing, while offline, and after blocked/expired offer. Exercise send ambiguity, retry, canceled counter, unsupported unsend, factual correction, real SiteCopy absence, takeover and handback. No action targets the wrong conversation/version.
3. Buy > Search with text, link, and camera return > partial results > Listing > Back. Check match/price-source uncertainty, official option, unknown shipping, failed one-site search, all-source failure, visitor sign-in/cancel and Want return. No result moves underneath a pressed finger.
4. You > each of the eleven §6.16 pages. Each title resolves, each has only its named kind, each cold-entry Back has the specified parent. By site contains no item worth or goal form; Account contains no operational selling controls; Accounts contains no performance analytics.
5. Accounts > one site > failed/expired link > Retry/cancel > actual records > mismatch > external site return > Unlink cancel/confirm. Preserve historical records; a new sign-in is not a proof that a failed post succeeded.
6. Change a notification mode, quiet time, automation mode, saved place, style preference, and goal; leave and return; retry a failed save; restart offline; reconnect with conflicting server state. Preserve intent and never announce a local-only state as persisted authority. Never promote a locked kind.
7. Records: selected year with paged sales, missing costs, incomplete cache, failed export, canceled share. Account export/delete/sign-out: real file and readback, blockers, canceled confirmation, session back-navigation after completion. Ask: no matching data, uncited result, partial data, retry and retained question.
8. Every page: top, down, up, native bounce, long titles/names/money, one/typical/dense where applicable, light/dark, largest Dynamic Type, VoiceOver, keyboard open/close, interrupted push/pop/sheet, Reduce Motion. Verify actual row geometry, contrast, safe area, composer and footer above keyboard/home indicator. Current Screen/Sheet do not prove these pass.

Usable as a design proposal for reconciliation. Not implementation approval for new patterns. Unfinished: shared boundary decisions named above, backend support for missing routes/feeds/actions, and device/render/motion verification. No screenshots, performance measurements, fresh independent critique, or live end-to-end test were performed for this design-only deliverable.

## Lane summary

The feature audit found **116 page-level capability obligations**. The redesign carries **90 on their relevant page or focused child**, including **51 added by this audit**; **26 belong on another named subject page** and remain reachable through explicit disclosures. All 116 have a destination, with **0 left missing from the design inventory**. These are design placements, not unique APIs or shipped-feature counts. A multi-step planned capability is one row; IDs above make the count reproducible.

| Page | Found | Carried here or its child | Moved to another subject |
|---|---:|---:|---:|
| Messages | 7 | 6 | 1 |
| Thread | 16 | 14 | 2 |
| Search | 14 | 10 | 4 |
| By site | 10 | 7 | 3 |
| What your things are worth | 6 | 4 | 2 |
| Goals | 4 | 4 | 0 |
| Accounts | 8 | 6 | 2 |
| Automation | 11 | 8 | 3 |
| Pickups | 4 | 1 | 3 |
| Notifications | 6 | 5 | 1 |
| Your style | 4 | 3 | 1 |
| Records and tax | 7 | 6 | 1 |
| Account | 6 | 5 | 1 |
| Ask | 5 | 4 | 1 |
| One site's connection | 8 | 7 | 1 |

### Left to wire

Most blocking first. Each item refers to the detailed caller/endpoint/state rows above; proposed new fields/endpoints stay marked N, never described as already specced.

1. **A real authenticated mobile data path and protected return state.** Replace fixture reads with a shared client using real me/session/refresh/signout/link flows, secure token handling and per-user caches. Preserve signed-out Search and visitor-owned job identity. The current shared source selects fixture worlds (`app/src/demo/screen.ts:21-25`), and sign-in success is a local timer (`app/src/you/sign-in.tsx:28-37`). Without this, no lane read/write is demonstrated for a real user.
2. **Safe outward conversation/offer operations.** Bind personal and draft sends, every claim_check outcome, decision acts, owner-fact save, media review and site readback to actual transport. Keep one operation identity across retries; reconcile ambiguous writes before repeating them. Thread's current send/offer callbacks change local state (`app/src/app/messages/[id].tsx:110-130`), and default conversation engine ports lack live send/draft transport (`app/src/edge/api/conversations.ts:85-88`). Block/read/handling overrides still need explicit contracts.
3. **All core connection flows and true site evidence.** Replace useLinks timer, finish secure link for the core sites, link risk/capabilities to probes, import/merge, and stop/revoke on unlink. Current link/unlink is local (`app/src/you/state.ts:91-98`); current account POST accepts only eBay/Depop (`app/src/edge/api/accounts.ts:39-41`). Expose actual offers/listings/messages/orders with check time and readback, not fixture-derived inferred success (`app/src/you/site-audit.ts:30-37`). Credential opt-in/removal and aggregate audit/offer views need new agreed contracts where canonical reads are insufficient.
4. **Guarded analytics and records projections.** Supply actual own-sale rollups, released-payout goal progress, share-of-asking/funnel/reliability/profit/cohorts/promotion, aggregate worth/week and all source citations. Keep hidden/unknown distinct from zero and identify missing analytics determination methods. Current insights source is synthetic (`app/src/edge/api/insights.ts:9-15`); goals and record formats are example handlers (`app/src/edge/api/insights.ts:28`, `app/src/edge/api/records.ts:6`). New structured report, goal-clear/count-only and volunteered tax-form write shapes must be agreed.
5. **Missing page and child destinations.** Implement Worth, Goals, Pickups, Your style, Ask, reply review/settings alias and the focused analytics/connection/report children before exposing their rows. Current You dispatch only recognizes its existing keys (`app/src/app/you/[page].tsx:19-28`), and the inbox currently navigates to absent /you/messages (`app/src/app/messages/index.tsx:112`). Reconcile the 05:18 default reply-review entry against the proposed inbox doorway without losing fast approval.
6. **Versioned rule and preference mutations.** Replace changed-only callbacks with rules/limits/me operations, fresh eligibility/locked checks and supported Undo, including renewal/removal/demotion. Existing changed only logs (`app/src/you/state.ts:34-36`); current permission mode changes are local (`app/src/you/permissions.tsx:43-48`). Define supported per-site reply modes, pause/defaults, quiet hours/grouping/previews and nullable saved-place fields. Current me PATCH ignores fields outside its writable set (`app/src/edge/api/me.ts:16-20`, `:58`), and rules scope is all/item (`app/src/edge/api/rules.ts:68-78`). Do not display a committed state for an ignored field.
7. **Actual search/compare/Assist result integration.** Replace query-to-fixture regex (`app/src/buy/read.ts:52-57`) with POST search and job batches, identity correction, filters/hidden count/reset, accurate delivered components and match terms, official-offer projection and correct deduplication. Backend search already returns a job (`app/src/edge/api/search.ts:232-249`), but its result projection has product:null and official:[] (`:129`). Wire target Listing/Want purchase/save/offer and visitor continuation separately; do not count a router push as a saved Want.
8. **Resumable jobs, refresh, live arrival and caches.** Connect job events/polling and signed-in stream to inbox updates, draft generation, search arrivals, link/import, valuation, export and deletion. Bind real errors/retries/terminal empty states and preserve scroll, local edits and pending identity. Current You status Retry only changes a URL flag (`app/src/you/page-status.tsx:14`); it cannot establish network recovery. Contract gaps such as asynchronous Genie resumability must be explicit rather than faked by a timer.
9. **Replayable proof and authorized source media.** Resolve citations to actual basis rows/definitions/computation time and snapshot_ref to authorized site captures. SiteCopy currently receives no captured image (`app/src/app/messages/[id].tsx:228-229`). Add any necessary authorized media/artifact delivery contract, expiry/error UI and full source access without exporting private tokens. Keep fallback routing quiet when successful; a failed readback is unknown, not automatically failed-and-repost.
10. **Real account/data operations and native record exports.** Bind auth revocation and me export/delete jobs; verify blockers, every-store outcome, result access and session navigation reset. Current Account export/signout/delete callbacks only log/change UI (`app/src/you/settings.tsx:52`, `:61`, `:70-71`). Record CSV only downloads on web yet claims downloaded on phone (`app/src/you/records.tsx:23-30`). Implement actual CSV/PDF report generation, native share/cancel and completed data-export artifact opening. Server deletion is conditional on workspace ports (`app/src/edge/api/me.ts:95-125`), not demonstrated site delisting; cross-store export/purge must also include separate auth/preferences/identity/style maps, not only runtime rows (`app/src/edge/events/ports.ts:139-145`, `app/src/edge/auth.ts:51-53`).
11. **Style and guarded Ask sources.** Build style reader/editor/source count/pin/remove/clear with conflict handling and learning respect for owner edits. Build fixed questions and own-user Genie connection, query/rows/citation display and unsupported/fixed-only fallback. These screens lack route entries today (`app/src/app/you/[page].tsx:19`); default Genie serves stored question snapshots (`app/src/edge/api/genie.ts:15-41`). Existing server style writes (`app/src/edge/api/me.ts:134-151`) still need the mobile consumer and provenance projection.
12. **Push authorization, delivery and authenticated deep-link actions.** Register permission/token, bind stored kinds/quiet/digest/privacy policy to actual worker delivery, apply ignored-kind changes with Undo, and enforce system unlocking/stale-version checks. Current lock-screen authentication is only explanatory text (`app/src/you/notifications.tsx:94-96`); changing a local toggle does not prove a push, summary, or Face ID action. Follow the decided immediate sale/under-price-match defaults.
13. **Shared native scaffolds and missing kit patterns.** Resolve the marked header/list/keyboard/detent/destructive/Assist/official-offer/media patterns once with the other lanes, then build approved behavior centrally. Current Screen is a simple ScrollView (`app/src/ui/layout.tsx:30-43`), current Sheet is a non-detented Modal (`app/src/ui/parts/overlays.tsx:18-38`), and current SearchField exposes no marked-span API (`app/src/ui/parts/search-field.tsx:17-25`). Add commit haptics centrally; current Press callback only logs/invokes (`app/src/ui/press.tsx:67`).
14. **Demonstrate the complete journeys.** Run the acceptance walks against real feeds, one/typical/dense lists, live partial and failed writes, offline/reconnect, vanished/stale subjects, both themes, Dynamic Type/VoiceOver, keyboard, interrupted native navigation and Reduce Motion. Forced URL states are currently fixture selection (`app/src/demo/screen.ts:21-25`); they are useful UI previews, not integrated request-state evidence.

Usable as a feature-checked design and wiring handoff. No capability count above claims a live API-backed screen, completed outward operation, device verification, or approval of a marked new pattern.
