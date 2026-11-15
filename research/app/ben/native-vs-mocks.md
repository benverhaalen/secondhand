Researched 2026-11-15 by Ben (Codex, gpt-6-astra)

# Native app versus the mocks

The largest remaining gap is composition. The phone has the right typefaces, corrected top wash and a working You screen, but often gives headings, metadata and secondary controls as much attention as the thing the person came to do. The approved direction felt like a few belongings and a clear next action; the build often feels like a management console made from individually consistent parts. Shrinking everything would preserve the problem.

## Evidence and approval

**Observed (O)** means inspected in the supplied PNG, tree or named source. **Inferred (I)** means a causal hypothesis or design judgment. All proposed changes below are **agent proposals**, not new Ben decisions. This is a senior iOS marketplace design lens applied by Codex, not an independent human designer review. Inspected on 2026-11-15; no new device run or gesture test was performed.

Phone evidence: `features/app/native/{tabs-index,tabs-sell,tabs-buy,tabs-you,messages-index,new,search,want,worth,gone-by,onboarding,stage,camera}.png` and corresponding `.tree.txt`; additionally `messages-world-edge` and `want-id-want_desk`. I viewed the images themselves. Compared their saved web counterparts under `features/app/renders/`, principally `*-dark.png`; no matching Stage render was found. `features/app/gallery.html` is absent. Current root captures, not `native/before/`, are the baseline.

Native coordinates are points: PNG pixels ÷ 3; trees already use points. Web pixels ÷ 2. A 402-point phone with a 62-point top inset is not a 390-wide, full-page web render. Below-the-fold content in the latter is not evidence that the phone omitted it. Font size/weight comes from source corroborated visually; trees expose text frames, not font descriptors.

References personally inspected and how much authority each has:

- **Today:** `research/today/ben/today-v3-light-dark.png`. Strong approval of the dark direction and spacing at `product/words.md:781` (“i like that dark mode a lot”; “the spacing i like”), recorded in `brand/ledger.md` L44/L46. The saved v3 is explicitly a redraw from that feedback (`research/cross-cutting/ben/dark-mode-and-size-system.md:10`), not proof Ben approved that exact file byte for byte.
- **Today/New/Camera:** `research/today/ben/today-v4-light-dark-new-camera.png`. Later direction reference; `product/words.md:827` requests the bigger circular New and its options. Subsequent 06:19 feedback at `product/words.md:1208` explicitly asks for centered New actions, integrated typing and an Apple-like camera frame. Those changes outrank v4's earlier placement.
- **Sell:** `brand/explore/round-11/renders/sell.jpg`. Selective round-11 picks, not blanket approval (`brand/ledger.md:82`). Ben liked needs-you/in-progress grouping and asked for collapsing it (`product/words.md:1208`). R32 in `brand/ledger.md:94` rejects the extra filter row and moves site logos onto photos. Do not restore the older mock's two rows or left-aligned wordmark.
- **Buy:** `features/buy/design/round-2/renders/buy-none.png` and `buy-match.png`. Its README calls the round an **agent proposal until Ben picks**. Useful comparison of photo, price and search hierarchy; no specific approval established.
- **Camera:** `features/capture/design/round-2/renders/cam-front.jpg`. Direction image, not demonstrated native camera behavior; no exact-file approval established. The later camera-frame feedback governs.
- **You:** `research/today/ben/you-tab/YouNumbers.png` and `YouProfile.png`. Older wireframes, not approved finished brand mocks. Ben later requested a dashboard and rejected goals (`product/words.md:1208`); do not restore the old dashboard wholesale.
- **Historical controls:** `research/today/ben/today-rework/Today.png` and `research/today/ben/today-dark-deep-lead-choice.png`. The former belongs to explicitly proposed prebrand work; the latter resembles the expanded implementation. Neither establishes approval of today's first viewport.

Read the requested constitutions, coder card, frontend standard, copy rules and `research/app/ben/native-rules-audit.md`. This report compares artifacts and composition; it does not repeat that audit's enforcement inventory. Product direction comes from `product/decisions.md`: one person selling their own things, with buying also a first-class activity. Recent brand Art. 7.11–16 are explicitly agent proposals responding to this complaint, not retroactive proof of approval.

## Per screen

### Today

Mock: `research/today/ben/today-v3-light-dark.png`; v4 supplies later New direction. Phone `tabs-index`; web `tabs-index-dark`.
- **O:** The compact mock reaches decisions much sooner. Native money/news occupies y114–272.3; section group starts y304.3; the first card starts y360.3. Its sold-photo strip adds another visual subject above the work. **Cause O:** `app/src/ui/parts/money-news.tsx:36` and `app/src/app/(tabs)/index.tsx:165`. **Fix I:** keep the requested sale celebration, but make the amount and one opening line the default summary; reveal its photo breakdown on demand.
- **O:** “Needs you now” and card titles both read at 18, with an additional deadline line. The deadline ends at y360.3, exactly where the card begins: zero separation. **Cause O:** `app/src/ui/layout.tsx:53` always uses headline for sections; `app/src/app/(tabs)/index.tsx:189` adds the deadline. **Fix I:** use a quiet 15-point section label over 18-point card titles and put the deadline inside its relevant card.
- **O:** Cards themselves retain 156-point height and 16-point gaps; this part transferred. Long marketplace titles truncate, and two full decision cards plus part of a third compete above the tab bar at y790. **Cause O:** card rendering at `app/src/app/(tabs)/index.tsx:196`; only lower tiers pile at line181. **Fix I:** use short item names and expose actions for the current decision; fold genuinely waiting items without hiding urgent work.
- **O:** The web also has the expanded summary and extra hierarchy; its full-page image merely makes the queue appear more comfortably visible. **Fix I:** judge the first safe viewport and the scrolled state separately, preserving the mock's relative hierarchy rather than equating whole-page screenshots.

### Sell

Mock: `brand/explore/round-11/renders/sell.jpg`, subject to later corrections above. Phone `tabs-sell`; web `tabs-sell-dark`.
- **O:** Native spends roughly its first 300 points on navigation, title, Select, filters and the first shelf header before photos begin. “Needs you 8” appears in both filtering and section hierarchy. **Cause O:** `app/src/app/(tabs)/sell.tsx:209`, `:213`, `:215`, `:231`. **Fix I:** retain one filter row and collapsible states, but remove repeated active-state labeling; make Select a quiet utility.
- **O:** The mock's concise names make the photo grid easy to scan; current listing titles end in ellipses. **Cause O:** grid item rendering at `app/src/app/(tabs)/sell.tsx:233`. **Fix I:** supply short display names while preserving full listing titles in detail. Do not reduce the 15-point tile type to fit them.
- **O:** Two columns, square photos and 20-point outer edges largely transfer; at 402 wide the photos are about 173 points with a 16-point gutter. Native shows far less inventory than the full web image because the tab bar bounds the view. **Fix I:** evaluate the first shelf with real item counts and collapse subsequent groups as Ben requested; do not add a third column to imitate the web's apparent density.
- **O:** Photo badges and the single filter row differ from the old mock deliberately. **Fix I:** keep these later decisions. Reinstating the mock literally would reintroduce rejected work.

### Buy

Mocks: `features/buy/design/round-2/renders/buy-none.png`, `buy-match.png` (unapproved proposals). Phone `tabs-buy`; web `tabs-buy-dark`.
- **O:** The mock uses a recognizable item image and readable query; the current single desk want is a large blank square with a truncated search sentence. **Cause O:** `app/src/app/(tabs)/buy.tsx:105` resolves a product or null, then line107 feeds the query into ItemCard. **Fix I:** use a compact text-led saved-search treatment when there is no item photo; show item, price and radius as separate readable facts.
- **O:** “2 of 3 sites” conveys less useful status than the mock's identifiable platforms. **Cause O:** the Looking for block at `app/src/app/(tabs)/buy.tsx:101`. **Fix I:** make the lagging source and recoverable action available from that status, without expanding a permanent diagnostics panel.
- **O:** The populated mock's Bought shelf cannot be compared as missing functionality against a one-want fixture. Native and web share the sparse state. **Fix I:** keep honest empty space; test the populated and no-match states separately instead of manufacturing inventory to fill the screen.
- **O:** The saved native and web images lack the shared wash, while current `app/src/app/(tabs)/buy.tsx:84` already passes `wash`. **Cause I:** capture/build version mismatch, not established missing code. **Fix I:** recapture the same revision before changing styling. The weak selected Buy icon is a separate shared defect described below.

### You

Mocks: `research/today/ben/you-tab/YouNumbers.png`, `YouProfile.png` (earlier wireframes). Phone `tabs-you`; web `tabs-you-dark`.
- **O:** The old wireframe exposes a compact financial summary and account access together. Native opens with a relink warning, amount, segmented breakdown and chart; account/settings require scrolling. **Cause O:** `app/src/app/(tabs)/you.tsx:65`, `:73`, `:76`, `:111`. **Fix I:** preserve the requested dashboard but open the breakdown from the amount and provide a clear account/settings entry near navigation.
- **O:** A sparse weekly chart takes substantial first-screen space for four sales. The full web image conceals its cost to nearby tasks. **Cause O:** fixed plot geometry at `app/src/ui/parts/week-chart.tsx:15`, rendered unconditionally when weeks exist at `app/src/app/(tabs)/you.tsx:76`. **Fix I:** give a compact recent-sales summary priority; expand the chart when the person asks for trend detail.
- **O:** “You” replaces the centered wordmark used on other main tabs. **Cause O:** `app/src/app/(tabs)/you.tsx:63` uses TabNav with a title. **Fix I:** choose one main-tab navigation contract and apply it consistently; keep You's identity in its content if retaining the shared wordmark.
- **O:** You renders successfully. The larger dashboard is explicitly requested, so divergence from the wireframe is not itself drift. **Fix I:** reduce simultaneous explanations, not the requested insight capability; do not reopen the fixed crash or font issue.

### Messages

Mock: **no mock** with established approval. Phone `messages-index` is a missing-conversation screen; `messages-world-edge` is the inspected inbox. Web comparison uses corresponding states, not an assumed inbox equivalence.
- **O:** The nominal index capture says the conversation is unavailable instead of showing Messages. **Cause O:** `app/src/app/messages/[id].tsx:62` renders that fallback; **cause I:** `/messages/index` is being interpreted as an id rather than the canonical `/messages` route. **Fix I:** capture through the actual inbox entry and assert its heading before evaluating it; do not redesign the inbox around this error image.
- **O:** In the valid edge inbox, a single expanded reply review consumes most of the viewport before the conversation list. **Cause O:** `app/src/app/messages/index.tsx:73` places the draft queue before threads. **Fix I:** show a compact pending-reply summary and open the selected review, preserving explicit send approval.
- **O:** Full listing title, buyer message, draft, inferred-word markings, evidence chips and multiple actions all compete. Web has the same structure. **Cause O:** draft at `app/src/app/messages/index.tsx:86`, Send all at `:94`. **Fix I:** lead with buyer and item; keep Send/Edit immediately available in review and disclose supporting facts on demand. Do not remove provenance or silently send replies.

### New

Mock: `research/today/ben/today-v4-light-dark-new-camera.png`; later centered/full-field instructions supersede its arrangement. Phone `new`; web `new-dark`.
- **O:** V4 presents small options emerging near New; current build is a full-field takeover with three 88-point capsules. **Cause O:** `app/src/app/new.tsx:65`, `app/src/ui/parts/takeover.tsx:142`. **Fix I:** retain the later requested centered takeover; this is intentional divergence, not evidence the renderer failed.
- **O:** Each capsule adds a 56-point icon well and separate circular pencil. Repeated nested surfaces dominate more than the three choices. **Cause O:** `app/src/ui/parts/takeover.tsx:169`, `:190`. **Fix I:** simplify the internal ground steps and make the typing alternative legible as an input method; keep the requested integrated typing affordance.
- **O:** Find is topmost and Sell nearest the thumb in this state, unlike a simple top-to-bottom priority list; web matches. **Cause O:** column-reverse at `app/src/ui/parts/takeover.tsx:143`, last-used ordering in `app/src/app/new.tsx:32`. **Fix I:** retain thumb proximity if it remains the intended rule, but verify people identify the main capsule as camera entry and the pencil as typing. Do not infer comprehensibility from accessible labels alone.

### Search

Mock: **no mock** for this blank entry screen; Buy round 2 only supplies adjacent search/result direction. Phone `search`; web `search-dark`.
- **O:** A 48-point field is followed by a paragraph repeating the ways to search, then an empty page. **Cause O:** `app/src/app/search.tsx:34` and `:35`. **Fix I:** let the field and camera affordance communicate input; retain only helper text that answers an otherwise unresolved question.
- **O:** The captured entry has no keyboard and the field initially behaves as a pressable label. **Cause O:** `app/src/ui/parts/search-field.tsx:29` initializes editing false; line43 autofocus applies only after editing begins. **Fix I:** when the person explicitly opens text search, enter the input state immediately; preserve a deliberate camera entry path.
- **O:** Native and web share this sparse composition; there is no evidence of a dropped results list in an empty-query state. **Fix I:** compare populated results separately. Do not fill honest empty space with decorative recommendation cards just to resemble a populated mock.

### Want

Mock: **no mock** for the editor. Phone `want` is empty; `want-id-want_desk` shows the substantive editor, paired with its dark web render.
- **O:** Empty Want's Search action goes back to Buy, requiring another search action. **Cause O:** `app/src/app/want.tsx:75` routes to `/buy`. **Fix I:** route that action to the ready-to-type search entry.
- **O:** The saved want opens as a long settings form: 36-point heading, query, five large platform cells, price range and numerous equally prominent chips. **Cause O:** `app/src/app/want.tsx:139`, `:149`, `:159`, `:192`, `:198`. **Fix I:** lead with the watched thing, delivered price and current progress; group optional constraints behind an edit action without dropping any requested controls.
- **O:** “Looking on 3 sites” sits over five cells including Off states; service health gets more visual weight than the desired item. **Cause O:** `app/src/app/want.tsx:113` renders all sites through SiteStrip. **Fix I:** summarize active sources and expose the full source selector on demand.
- **O:** The 390-wide web wraps 50 mi and Fair onto extra rows; at 402 native they fit. This is a real width/font-layout difference, not missing native controls. **Fix I:** test both widths and largest text with wrapping intact; avoid hardcoding the compact native row as the only acceptable layout.

### Worth

Mock: **no distinct mock found**; Ben's 06:19 “kind of like that screen; looks good” supports the direction, not an identified file. Phone `worth`; web `worth-dark`.
- **O:** The core hierarchy works: item, large range, then net proceeds by site. Native's item title fits one line where the narrower web wraps. **Cause O:** item row at `app/src/app/worth.tsx:155`. **Fix I:** preserve the range as the focal point and use a short name rather than relying on this fixture fitting.
- **O:** “Check the sales” and its explanation form a full section between the range and the money the person keeps. **Cause O:** `app/src/app/worth.tsx:159` through `:165`. **Fix I:** make evidence access a quieter part of the range, so valuation leads directly to the sale decision.
- **O:** Five site rows give unavailable/unlinked outcomes almost the same space as useful prices. The normal-flow Sell/Keep buttons begin at y768.7; the Facebook badge ends at y720.7, so the current tree does **not** show overlap. **Cause O:** `app/src/app/worth.tsx:167` and `:196`; fixed 56-point rows at `app/src/ui/parts/worth.tsx:58`. **Fix I:** prioritize usable net proceeds and disclose unavailable sites; preserve all comparisons. Do not patch a nonexistent sticky-footer collision.

### Gone by

Mock: **no mock** identified. Phone `gone-by`; web `gone-by-dark`.
- **O:** Three columns produce roughly 110-point photos with heavily truncated names. The screen feels like an inventory dashboard beside Sell's two-column belongings view. **Cause O:** `app/src/app/gone-by.tsx:234` selects three columns. **Fix I:** use concise names and a consistent item presentation; retain a denser overview only where it improves deciding the fate of a room's contents.
- **O:** The screen leads with grouped stock and tags while the deadline-driven plan continues below. **Cause O:** title and date at `app/src/app/gone-by.tsx:168`, grouped grid at `:229`. **Fix I:** make the next batch action and what will happen by the date clear before secondary inventory detail. The full web page does not prove that this order works on the phone.
- **O:** The pinned approval button occupies y810–858 on an 874-point screen, only 16 points above the glass bottom. **Cause O:** `app/src/ui/layout.tsx:37` omits bottom safe-area handling and `:124` gives the footer only 16 bottom padding. **Fix I:** pad above the actual bottom inset plus 16; reserve corresponding scroll space. Stage's separate footer already accounts for the inset.

### Onboarding

Mock: **no mock** identified. Phone `onboarding`; the file `onboarding-dark.png` actually shows a light web page.
- **O:** Native is dark while the nominal dark web artifact is light. **Cause I:** theme/capture-state mismatch; no cause established in current sign-in code. **Fix I:** regenerate matched theme evidence before treating the contrast as an implementation regression.
- **O:** Welcome, an explanatory paragraph and three content-width pills read as a generic menu rather than an intentional sign-in step. **Cause O:** `app/src/you/sign-in.tsx:77` through `:90`. **Fix I:** make the immediate reason to sign in specific to the entry task and align provider actions consistently.
- **O:** Apple, Google and email have unequal widths and no provider marks, while ample space remains. **Cause O:** separate Lines around Pills at `app/src/you/sign-in.tsx:86`. **Fix I:** use recognizable provider treatments and equal action widths; keep the quiet lower area rather than adding ornamental onboarding claims.

### Stage post

Mock: **no mock** identified; no matching web render found. Phone `stage` only.
- **O:** A 360-point square photo occupies y176.7–536.7, pushing listing review below enhancement controls and toward the pinned posting action. **Cause O:** `app/src/app/item/[id]/post.tsx:158` uses a square fill Photo. **Fix I:** use a compact review image with an inspect action; make selected sites, price and net proceeds visible before the person commits.
- **O:** The sheet and nested listing surfaces have weak separation; the large photo and switches carry more emphasis than publication consequences. **Cause O:** switches at `app/src/app/item/[id]/post.tsx:160`, `:164`, listing at `:177`. **Fix I:** group image edits with the image and give the posting summary one clear review hierarchy, not additional decorative containers.
- **O:** The sheet begins at y110, has a grabber and Preview title but no visible close action. **Cause O:** `app/src/ui/parts/route-sheet.tsx:75` sets height from top inset plus a 48-point peek; `:77` attaches a custom pan to the header. **Fix I:** provide explicit dismissal and appropriate native sheet behavior. A full-height review can be right; medium detents are not mandatory. Scrolling reachability and dismissal behavior still need a device test.

### Camera

Mocks: `features/capture/design/round-2/renders/cam-front.jpg`, camera panel in v4; later Apple-like framing instruction governs. Phone `camera`; web `camera-dark`.
- **O:** The generated mock uses a full, well-lit jacket photo behind sparse chrome; native shows a dark live feed bounded by solid top and bottom regions. **Cause O:** `app/src/ui/parts/camera.tsx:142`, `:145` and `app/src/app/camera.tsx:214` enable framing. **Fix I:** preserve the requested camera frame and compare using the same real object and light. A dark capture does not prove a broken camera or justify substituting a stock photo.
- **O:** Guidance, stages, unresolved attribute chips, mode choices and capture controls compete; the mock has one instruction and one obvious shutter. **Cause O:** `app/src/app/camera.tsx:215` renders facts above bottom modes at `:240`. **Fix I:** show the current shot instruction and relevant missing fact first; disclose the remaining attributes while keeping correction available. This implements Ben's request to make modes and facts work together.
- **O:** The mock's microphone is absent from the inspected current CameraBar, which supplies close and stage bubbles. **Cause O:** `app/src/app/camera.tsx:207`. **Fix I:** resolve whether spoken correction remains required before restoring a mic solely for visual fidelity; use the current edit affordances as the functional baseline.
- **O:** Native live feed and web demonstration imagery are different inputs. **Cause O:** `app/src/app/camera.tsx:202` supplies null demo feed on native and the shown feed on web. **Fix I:** test recognition overlays against actual frames; a polished generated photograph cannot validate overlay registration, camera performance or capture confidence.

## Expert read, ranked by likely effect on Ben's impression

1. **I: Restore a clear first decision.** Today, Messages, You and Stage devote their best space to summaries, explanation or inspection controls before the task. For an occasional seller, the order should answer “what needs me, which thing, what happens next?” The mock is right about that restraint; the build drifted in whole-page composition even where its individual tokens match. Use the current product scope, not a frozen old mock, to restore the order.
2. **O/I: Separate hierarchy through size and grouping.** Rendered roles are 13/15/18/21/36/50; text face is weight500 and Clofie600 (`app/src/ui/text.tsx:9`, `:51`). The fault is repeated 18-point headings and surplus levels, not missing bold. Main edges generally align at x20 and card content at x36. Keep those edges. Repair the zero deadline/card gap, repeated Sell labels and equal-strength Want sections using Art.7's 4–12 internal, 12–16 between-item and 24–48 section spacing.
3. **O/I: Make belongings readable.** Clean short names and recognizable photos explain much of the mocks' appeal. Truncated listing strings, Buy's empty square and Gone by's tiny inventory tiles lose that appeal. A short display name is a data/presentation responsibility, not a smaller-font workaround. The old mocks' unusually tidy content also underestimates real titles, no-photo searches and zero-result states; those mocks would not survive phone use unchanged.
4. **O/I: Give controls a consistent importance.** Neutral pills currently stand for filters, modes, optional edits, decisions and providers. Full-field New is intentional, but nested wells amplify this sameness. The bottom tab bar is 84 points; New is 56 and rises12 (`app/src/ui/parts/chrome.tsx:132`, `:178`), a requested brand choice worth keeping. Selected Buy/You glyphs lose recognizable detail: `app/src/ui/icon.tsx:31` fills the first arbitrary vector shape and paints later strokes in page color. Use designed selected variants; inspect every tab, not just Today.
5. **O/I: Clarify dark surfaces without brightening the whole app.** Today's raised cards remain distinguishable from the page, consistent with the approved dark direction. Stage's nested surfaces and New's wells are harder to parse. Keep the page, raised surfaces and control grounds distinct and purposeful; avoid adding another box to solve weak hierarchy. Contrast ratios were not measured in this review, so there is no new numeric pass/fail claim. Measure worst rendered backgrounds against B6: 4.5:1 text, 3:1 large text; frontend standard also requires 3:1 UI parts. Do not reopen the fixed wash seam.
6. **O/I: Finish native presentation and safe-area behavior.** Gone by has a measured unsafe footer. Stage is a custom sheet, not a system detent presentation; its grabber suggests behavior not established by stills. Add an explicit exit and verify scroll/drag handoff. Apple's [sheet guidance](https://developer.apple.com/design/human-interface-guidelines/sheets) supports swipe dismissal and context-dependent detents; it does not require a medium sheet for every task. Its [layout guidance](https://developer.apple.com/design/human-interface-guidelines/layout) supports respecting safe areas and adapting content.
7. **I, not demonstrated failures: validate text and interaction under use.** Txt does not disable scaling, but fixed156 cards, fixed56 rows and single-line labels need largest-Dynamic-Type testing; absence of an explicit ramp is not proof that text never scales. Custom 36-point titles are not collapsing native large titles; `app/src/app/_layout.tsx:18` hides stack headers. Large titles are not mandatory everywhere. Swipe-back failure cannot be inferred from screenshots or hidden headers. Camera haptics exist (`app/src/ui/parts/camera.tsx:72`); generic Press has no haptic call (`app/src/ui/press.tsx:67`). Verify commit feedback, not a buzz on every tap. Motion, Reduce Motion, swipe back and keyboard avoidance require recordings/device interaction, not PNG judgments.

**Where the mocks themselves need correction:** the old Sell has superseded filtering and branding; the generated camera assumes perfect imagery and full-bleed space despite the later framing request; You's wireframes predate the dashboard request; populated Buy images don't specify empty/default behavior. V4's New placement was superseded. Preserve clear priority, short names and controlled density in the actual states. Do not copy obsolete pixels.

## Proposed native checks

These are checks to add later, not executed or implemented here. Thresholds below come from existing rule docs; proposals in those docs remain proposals. No arbitrary first-card y-coordinate or screenshot-similarity percentage is introduced.

| Drift caught | Input and assertion | Existing threshold/source |
|---|---|---|
| Wrong screen/theme/revision | PNG + tree + route/state/build identity: heading and selected tab match requested route; PNG theme matches manifest; paired captures use the same state/revision. Reject Messages missing-conversation as inbox evidence. | Frontend standard §5: every mismatch classified; compare actual requested screen. No invented numeric tolerance. |
| Whole-page composition hiding the fold | Native first viewport and scrolled PNGs, with tree frames: assess visible focal point and first action; never expand viewport to fit content. | Brand Art.7.6/7.16: reference390×844 with59/34 insets; use actual402×874 and measured device insets for this capture. |
| Lost hierarchy/late first task | Tree text roles inferred from source + PNG: section over18-point card titles is15/quiet; no fourth metadata level; between nav and first item only amount, its line, at most one header. | Art.7.11/7.12 and U10/U11, explicitly agent proposals. No universal205-point cutoff. |
| Primitive and rhythm drift | Deduplicated tree frames + PNG edges: decision156, photo72, nav44, card gaps16, section gaps32, nav gap8; verify4–12 internal grouping. Compare like parts in logical points. | Art.7.1/7.2/7.8; B31 allows1px variance between like parts; normalize that unit before applying to3× PNGs. |
| Misalignment/truncated names | Tree start edges + PNG text: no accidental neighboring starts1–3 logical units apart; titles are complete short names, not ellipsized listing strings. | B36; Art.7.15/U14 is an agent proposal. Tree labels alone cannot reveal visual ellipsis. |
| Excess simultaneous choices | Native viewport, actionable tree nodes + PNG: distinguish current decision from waiting cards; count visible buttons under the rule's scope. | Art.7.13/U12 proposes at most7; Art.7.14/U13 permits piles for3+ waiting items of one kind. Treat scope ambiguity as a rule question, not a new exception. |
| Unsafe/obscured action | Tree button bounds + actual bottom inset: pinned action ends16 above safe area; last scroll content can clear footer/tab bar. | Art.7.9:16 above safe area; scrolling end32 plus home inset (34 in reference). Gone by currently ends only16 above glass. |
| Weak selected icons/grounds | PNGs for all selected tabs and sheets, plus background-only render for contrast: recognizable selected silhouette, intended elevation, measured text/UI contrast. | Art.10.1, B6 and frontend standard §5:4.5:1 text,3:1 large text/UI; no invented ground-step luminance threshold. |
| Scaled text/targets | Largest-text native PNG/tree plus target hit testing: no clipped essential text or overlapping actions; 40-point visible controls retain44-point targets. | Art.6.8, Art.7.8, frontend standard §5/B34. Fixed-height tokens yield where accessibility requires adaptation. |
| Sheet and navigation feel | PNG/tree prove visible close/selection/target labels only; supplement with device recordings of dismissal, back, keyboard, commit haptic and Reduce Motion. | Frontend standard §3/§5; Apple sheets guidance. No still-image assertion can certify gestures or haptics. |

Limits: supplied captures establish appearance, not the exact binary/source revision or live interaction quality. Buy's wash and onboarding's saved theme require matched recaptures. Messages index needs route correction before comparison. No implementation, external designer review, fresh capture, commit or check-run log was produced; this file is the only requested artifact.
