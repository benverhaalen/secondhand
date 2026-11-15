# How should the signed-in website change when the input is a mouse, a trackpad or a keyboard instead of a finger?
Researched 2026-11-15 by Ben (Claude Code). Feature: web (the signed-in website; no features/web page yet).

The decision it feeds: the web-scoped rules and checks for the signed-in site (one Expo codebase with the app), and the four web-only parts agreed with the "Roll the UI system out everywhere" thread (side rail, right pane, drop zone, QR handoff). Ben, [05:23](../../../product/words.md): "consider the dynamic ui and intelligent ui and everything and consider app vs desktop and how mouse vs touch changes things and maybe research it".

## Draft from memory, before searching

1. Pick the layout by width and the input by width too: under 768 is touch, above is mouse.
2. With a mouse, targets can shrink to WCAG's 24 px.
3. Hide secondary actions until hover, and on touch show them all the time.
4. Bottom sheets become side panels on desktop.
5. Drag and drop for photos, with a button as a fallback.

## What changed

| Draft | Finding | Changed? |
|---|---|---|
| 1. Input by width | Media Queries 4 has `pointer`, `hover`, `any-pointer` and `any-hover`, which describe the input, not the width. A device can have several inputs, and the spec tells authors to consider the `any-` forms (*asserted*: read through a fetch tool's summary of section 7, the page itself was blocked here). Apple: people "move fluidly between multiple types of input" (*observed*, HIG Pointing devices) | Yes. Layout by width, input by capability. A 1440 touch laptop and an iPad with a trackpad both exist |
| 2. Targets shrink to 24 | Apple's minimum control sizes: iOS and iPadOS 44 × 44 pt default, 28 × 28 minimum; macOS 28 × 28 default, 20 × 20 minimum (*observed*, HIG Accessibility, "Offer sufficiently sized controls"). WCAG 2.2 2.5.8 (AA): pointer targets at least 24 × 24 CSS px, or spaced so a 24 px circle around each touches no other; 2.5.5 (AAA): 44 × 44 (*asserted*, fetch-tool summary of the Recommendation of 12 Dec 2024) | Partly. 24 is the legal floor; 28 is the comfortable default with a fine pointer. Apple also says padding matters as much as size: about 12 pt around a bezeled control, about 24 pt around one without a bezel (*observed*) |
| 3. Hover-only actions, always visible on touch | Apple, added 28 Oct 2026, "Touch support for hidden controls": reserve touch support for essential controls; "Avoid keeping hidden controls visible all the time just to accommodate touch"; reveal a hidden control when someone taps its general location, hide it after use or a few seconds; keep the current selection when revealing; put essential hidden controls in a context menu, which touch opens with touch and hold (*observed*, HIG Pointing devices) | Yes. Not always visible on touch: a tap reveals them, and the context menu always has them |
| 3b. Hover timing | NN/g (Harley, 11 Jan 2015): feedback within 0.1 s; wait 0.3 to 0.5 s before revealing hidden content on hover; hide only after the pointer has been away more than 0.5 s; a click or tap is the clearest sign of intent (*observed*) | Added. Our `--t-feedback` (150 ms) is the feedback; a reveal waits 300 ms |
| 4. Sheets become side panels | Material 3's bottom sheet and side sheet pages say a bottom sheet is "anchored to the bottom of the screen" and a side sheet "to the side" (*observed*, page descriptions only); the usage guidance and the window size class breakpoints did not load | Unchanged, and unconfirmed by Material's own text |
| 5. Drag with a button fallback | WCAG 2.2 2.5.7 (AA): everything done by dragging can be done with a single pointer without dragging, unless dragging is essential (*asserted*, fetch-tool summary). Apple: a click and drag over several items draws a selection rectangle (*observed*) | Unchanged, now required, and it covers reordering photos too |
| (new) Keyboard | WCAG 2.2 2.1.4 (A): a shortcut made only of printable characters can be turned off, remapped to include a modifier, or works only while its part has focus (*asserted*). Apple: on a Mac people combine the pointer with the keyboard; let people use the keyboard alone (*observed*, Pointing devices and Accessibility) | Added |
| (new) Hover content | WCAG 2.2 1.4.13 (AA): content shown on hover or focus can be dismissed, can itself be hovered, and stays until dismissed (*asserted*) | Added |

## What it means for secondhand (*agent proposal*, web-scoped, Ben has not ruled)

| # | Rule | Where it bites |
|---|---|---|
| W1 | Layout follows width (rail and pane at 1100 and up, collapsed rail 768 to 1100, the phone layout under 768). Input follows capability: hover styles only under `(any-hover: hover)`, and target sizes by pointer: 44 when any pointer is coarse, otherwise 28, never under 24 | every control on the web |
| W2 | A control shown only on hover is never the only way: the same action is in the item's context menu, and keyboard focus reveals it as hover does. On touch, a tap on the row reveals it; it is not kept visible | row actions in Sell, Buy and Today (archive, relist, share) |
| W3 | Right-click opens the same menu as a long press in the app, with the same items in the same order | every item, listing, message and decision |
| W4 | Every drag has a click way: the drop zone has Choose photos, reordering photos has Move left and Move right in the menu, and a photo can be set as cover from the menu | the web upload that replaces the camera, and the item's photo strip |
| W5 | Multi-select the way desktop lists work: click selects one, Shift-click a range, Cmd or Ctrl-click toggles, a checkbox shows on hover or focus and stays while anything is selected, and a bar with the count and the bulk actions appears. Touch keeps the app's long press | Sell's grid, Today's batch cards (buy labels), Buy's saves |
| W6 | Keyboard: every action reachable by Tab; arrows move in lists and grids; Enter opens; Esc closes the pane or menu; Cmd or Ctrl-K is search; `?` lists shortcuts. Single-letter shortcuts work only while a list has focus. Money and address decisions are never a single key: they take focus on the button and Enter | the whole signed-in site |
| W7 | The app's parts translate, never by stretching: a bottom sheet becomes the right pane at 1100 and up and a centered dialog for a confirmation; a wheel picker becomes a list with type-to-find; a slider gets a number field beside it and steps with the arrow keys; chips stay chips, with a hover state | the parts the UI rollout thread owns |
| W8 | Hover timing: feedback in `--t-feedback`; anything revealed by hover waits 300 ms, stays 500 ms after the pointer leaves, can itself be hovered, and Esc dismisses it. A menu opens on click, never on hover alone | previews, tooltips, menus |
| W9 | What a mouse adds, the intelligent part: hovering a row previews the item in the right pane without losing the list; the pointer shows what a drag will do (open hand on a photo that can move); selection persists across the pane; a pasted link in search runs What's it worth | Today, Sell, Buy on desktop |

Checks that can hold these (*agent proposal*, to build once the rollout thread agrees the parts):
- Target size by pointer: render each web page at 1440 with a fine pointer and at 1440 with a coarse one (Playwright's `hasTouch`), and fail any control under 28 and 44 respectively, and any under 24 anywhere.
- A drag has a click: every element marked `draggable` or `data-drop` sits in a part that also has a button or a file input.
- Hover is not the only way: render with hover forced off and with keyboard focus moved through the page; every control visible under hover must become visible by focus, or be in the part's context menu (`data-menu`).

## References and their jobs

| Source | Job | Take | Why it's good |
|---|---|---|---|
| [Apple HIG, Pointing devices](https://developer.apple.com/design/human-interface-guidelines/pointing-devices) (changelog entry 28 Oct 2026; read through its `.md` version) | interaction | hidden controls on touch, context menus as the dependable path, hit-region padding, selection rectangle, pointer shapes for drag | written for devices that have both touch and a pointer, which is exactly a touch laptop on our site; updated last month |
| [Apple HIG, Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) (changelog through 7 Mar 2025) | evidence | the default and minimum control sizes by platform, spacing as important as size | numbers per platform, from the platform owner |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/) (Recommendation, 12 Dec 2024) | evidence, the floor | 2.5.8, 2.5.5, 2.5.7, 2.1.4, 1.4.13 | the legal and accessibility floor; not a design target |
| [Media Queries Level 4](https://www.w3.org/TR/mediaqueries-4/) (CR Draft, 19 Feb 2026) | implementation mechanism | `any-hover`, `any-pointer` | how the web detects the input; react-native-web leaves this to CSS |
| [NN/g, Timing guidelines for exposing hidden content](https://www.nngroup.com/articles/timing-exposing-content/) (11 Jan 2015) | interaction | 0.1 s feedback, 0.3 to 0.5 s reveal delay, 0.5 s grace on leave | old but measured guidance on intent; nothing newer found here |

## What I searched and couldn't reach

- Opened the Apple pages myself as Markdown and read the cited lines (*observed*).
- W3C pages were refused by this machine's network; the WCAG and Media Queries wording above comes from a fetch tool's summary, so it is marked *asserted*. Read the criteria at the source before a check quotes them.
- Material 3's window size classes page failed to load, and its sheet guidance pages render only with JavaScript; nothing from Material is relied on beyond the two page descriptions.
- Not searched: how Depop, Poshmark, Mercari and eBay's own desktop sites handle multi-select and hover. That is the next comparison worth making, since sellers already know them.
